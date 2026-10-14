import type { HandlerInput } from 'ask-sdk-core';
import { festivalScreen } from '../apl/screens';
import type { Festival } from '../api/types';
import { apiFor, deps, localDate, viewportKind } from '../context';
import type { Answer } from '../respond';
import { clean, daysBetween, inDays, longDate, sentence, speak } from '../speech/format';
import { T } from '../speech/texts';

export const FESTIVAL_KEYS = ['samhain', 'yule', 'imbolc', 'ostara', 'beltane', 'litha', 'lughnasadh', 'mabon'] as const;

/** Other names and spellings → key; the same idea as festivalKey() in the main repo. */
const ALIASES: Record<string, string> = {
  samain: 'samhain',
  jul: 'yule',
  julfest: 'yule',
  yul: 'yule',
  wintersonnenwende: 'yule',
  oimelc: 'imbolc',
  lichtmess: 'imbolc',
  fruhlingstagundnachtgleiche: 'ostara',
  beltaine: 'beltane',
  bealtaine: 'beltane',
  walpurgis: 'beltane',
  walpurgisnacht: 'beltane',
  sommersonnenwende: 'litha',
  mittsommer: 'litha',
  lughnasad: 'lughnasadh',
  lughnasa: 'lughnasadh',
  lugnasad: 'lughnasadh',
  lammas: 'lughnasadh',
  schnitterfest: 'lughnasadh',
  herbsttagundnachtgleiche: 'mabon',
  erntedank: 'mabon',
};

export function festivalKey(name: string | undefined | null): string | null {
  if (!name) return null;
  const plain = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');
  const key = ALIASES[plain] ?? plain;
  return (FESTIVAL_KEYS as readonly string[]).includes(key) ? key : null;
}

const sameFestival = (f: Festival, key: string) => festivalKey(f.id) === key || festivalKey(f.name) === key;

const hasMore = (f: Festival) => Boolean(clean(f.customs) || f.impulses?.length);

function moreQuestion(f: Festival): Answer['ask'] {
  return hasMore(f)
    ? { question: T.moreCustoms, reprompt: T.moreCustoms, pending: { type: 'festivalMore', festivalId: f.id, year: Number(f.date.slice(0, 4)) } }
    : undefined;
}

/** „Wann ist das nächste Fest?“ */
export async function nextFestivalAnswer(hi: HandlerInput): Promise<Answer> {
  const api = await apiFor(hi);
  const { data, stale } = await api.nextFestival();
  const f = data.festival;
  if (!f) return { speech: speak(stale ? T.stale : '', 'Ich finde gerade kein nächstes Fest im Jahresrad.') };
  const todayIso = data.today || localDate(deps.now(), api.timeZone);
  const said = clean(f.speech) || describeDate(f, todayIso);
  return {
    speech: speak(stale ? T.stale : '', said),
    screen: festivalScreen(f, todayIso, viewportKind(hi)),
    ask: moreQuestion(f),
  };
}

/** „Erzähl mir von Imbolc“ */
export async function festivalInfoAnswer(hi: HandlerInput, key: string | null): Promise<Answer> {
  if (!key) return { speech: '', ask: { question: T.whichFestival, pending: { type: 'whichFestival' } } };
  const api = await apiFor(hi);
  const todayIso = localDate(deps.now(), api.timeZone);
  const year = Number(todayIso.slice(0, 4));
  const { data, stale } = await api.festivals(year);
  const f = data.festivals.find((x) => sameFestival(x, key));
  if (!f) return { speech: speak(stale ? T.stale : '', 'Dieses Fest finde ich gerade nicht im Jahresrad.'), ask: { question: T.whichFestival, pending: { type: 'whichFestival' } } };

  let shown = f;
  let said: string;
  if (f.date >= todayIso) {
    said = speak(describeDate(f, todayIso), sentence(f.short));
  } else {
    const next = (await api.festivals(year + 1)).data.festivals.find((x) => sameFestival(x, key));
    said = speak(
      `${f.name} war dieses Jahr am ${longDate(f.date)}.`,
      next ? `Nächstes Jahr ist es am ${longDate(next.date)}, ${inDays(daysBetween(todayIso, next.date))}.` : '',
      sentence(f.short),
    );
    if (next) shown = next;
  }
  return {
    speech: speak(stale ? T.stale : '', said),
    screen: festivalScreen(shown, todayIso, viewportKind(hi)),
    ask: moreQuestion(shown),
  };
}

function describeDate(f: Festival, todayIso: string): string {
  const days = daysBetween(todayIso, f.date);
  if (days === 0) return `Heute ist ${f.name}.`;
  return `${f.name} ist am ${longDate(f.date, Number(todayIso.slice(0, 4)))}, ${inDays(days)}.`;
}

/** „Ja“ after „Soll ich dir mehr über das Brauchtum erzählen?“ */
export async function festivalMoreAnswer(hi: HandlerInput, festivalId: string, year: number): Promise<Answer> {
  const api = await apiFor(hi);
  const key = festivalKey(festivalId) ?? festivalId;
  const f = (await api.festivals(year)).data.festivals.find((x) => sameFestival(x, key) || x.id === festivalId);
  if (!f) return { speech: 'Dazu habe ich gerade nichts weiter.' };
  const impulses = (f.impulses ?? []).map(clean).filter(Boolean);
  return {
    speech: speak(
      sentence(f.customs),
      impulses.length ? `${impulses.length === 1 ? 'Ein Impuls' : 'Impulse'} zum Nachspüren: ${impulses.join(' ')}` : '',
    ),
  };
}
