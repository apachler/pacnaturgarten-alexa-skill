import type { HandlerInput } from 'ask-sdk-core';
import { mainScreen } from '../apl/screens';
import { apiFor, viewportKind } from '../context';
import type { Answer } from '../respond';
import { joinList, longDate, shortDate, speak, spokenDuration, spokenTime } from '../speech/format';
import { T } from '../speech/texts';

/**
 * „Wann geht die Sonne auf?“, „Wie lange ist es heute hell?“ — with the main screen (its daylight
 * card): an answer without a screen would end the session and blank an Echo Show after a tap.
 */
export async function daylightAnswer(hi: HandlerInput): Promise<Answer> {
  const api = await apiFor(hi);
  const [{ data, stale }, { data: day }] = await Promise.all([api.daylight(), api.today()]);
  const dl = data.daylight;
  // Only the default place is named: then the user knows the times are not for their garden.
  const where = data.location?.type === 'default' ? `In ${data.location.label}` : 'Heute';
  const sun =
    dl.sunrise && dl.sunset
      ? `${where} geht die Sonne um ${spokenTime(dl.sunrise)} auf und um ${spokenTime(dl.sunset)} unter.`
      : '';
  const ch = dl.change_vs_yesterday_min;
  const change =
    ch === 0
      ? 'Das ist etwa so lang wie gestern.'
      : `Die Tage werden um ${Math.abs(ch)} ${Math.abs(ch) === 1 ? 'Minute' : 'Minuten'} ${ch > 0 ? 'länger' : 'kürzer'}.`;
  return {
    speech: speak(stale ? T.stale : '', sun, `Es ist ${spokenDuration(dl.day_length_min)} hell.`, change),
    screen: mainScreen(day, viewportKind(hi)),
  };
}

/** „Welche Jahreszeit haben wir?“ — the phenological season. */
export async function seasonAnswer(hi: HandlerInput): Promise<Answer> {
  const api = await apiFor(hi);
  const { data: day, stale } = await api.today();
  const s = day.season;
  if (!s) return { speech: speak(stale ? T.stale : '', 'Die Naturjahreszeit kann ich gerade nicht bestimmen.') };
  const year = Number(day.date.slice(0, 4));
  const signs = (s.indicators ?? []).filter(Boolean);
  return {
    speech: speak(
      stale ? T.stale : '',
      `In der Natur ist ${s.name}, seit dem ${shortDate(s.since)}.`,
      signs.length ? `Typische Zeichen: ${joinList(signs)}.` : '',
      s.next ? `Etwa ab ${longDate(s.next.date, year)} beginnt der ${s.next.name}.` : '',
    ),
    screen: mainScreen(day, viewportKind(hi)),
  };
}
