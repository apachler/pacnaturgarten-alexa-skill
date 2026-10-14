import type { HandlerInput } from 'ask-sdk-core';
import { mainScreen } from '../apl/screens';
import type { Day } from '../api/types';
import { apiFor, deps, localDate, saveUserAttributes, userAttributes, viewportKind } from '../context';
import type { Answer } from '../respond';
import { clean, longDate, sentence, speak } from '../speech/format';
import { T } from '../speech/texts';

/** The daily briefing: launch, „Was gibt’s heute?“, routines (as a one-shot phrase). */
export async function todayAnswer(hi: HandlerInput, opts: { launch: boolean }): Promise<Answer> {
  const api = await apiFor(hi);
  const { data: day, stale } = await api.today();
  const user = await userAttributes(hi);
  const parts: string[] = [];
  const changes: Record<string, boolean> = {};
  let card: Answer['card'];

  if (stale) parts.push(T.stale);
  if (opts.launch && !user.seen) {
    parts.push(T.welcome);
    changes.seen = true;
  }
  parts.push(briefing(day));
  if (day.location?.type === 'default' && !user.locationHintGiven) {
    parts.push(T.locationHint(day.location.label));
    card = { kind: 'simple', title: T.locationCardTitle, content: T.locationCard(day.location.label) };
    changes.locationHintGiven = true;
  }
  if (Object.keys(changes).length) await saveUserAttributes(hi, changes);

  const answer: Answer = { speech: speak(...parts), screen: mainScreen(day, viewportKind(hi)), card };
  if (opts.launch) {
    const festival = day.festival.today ?? day.festival.next;
    answer.ask = {
      question: festival
        ? `Möchtest du mehr über ${festival.name}, den Mond oder die Gartenarbeiten der Woche hören?`
        : 'Möchtest du mehr über den Mond oder die Gartenarbeiten der Woche hören?',
      reprompt: T.whatThen,
      pending: { type: 'launchMenu' },
    };
  }
  return answer;
}

/** The API's own briefing, or a short one from the parts when it is missing. */
export function briefing(day: Day): string {
  const ready = clean(day.summary?.speech);
  if (ready) return ready;
  return speak(
    sentence(`${longDate(day.date)}`),
    day.season ? sentence(`In der Natur ist ${day.season.name}`) : '',
    day.moon?.name ? sentence(`Der Mond: ${day.moon.name}`) : '',
  );
}

// ---------- a specific date ----------

export type DateResult = { ok: true; date: string } | { ok: false; reason: 'missing' | 'unclear' | 'range' };

/**
 * AMAZON.DATE values: full dates as they are, a week (2026-W43) as its Monday, a month
 * (2026-12) or a year as its first day. Unknown years (XXXX-12-21) are the current year.
 * Allowed: the current year ±1.
 */
export function resolveDate(value: string | undefined, todayIso: string): DateResult {
  if (!value) return { ok: false, reason: 'missing' };
  const year = Number(todayIso.slice(0, 4));
  const v = value.replace(/^XXXX/, String(year));
  let date: string | undefined;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v))) date = `${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = /^(\d{4})-W(\d{2})(?:-WE)?$/.exec(v))) date = isoWeekMonday(Number(m[1]), Number(m[2]));
  else if ((m = /^(\d{4})-(\d{2})$/.exec(v))) date = `${m[1]}-${m[2]}-01`;
  else if ((m = /^(\d{4})$/.exec(v))) date = `${m[1]}-01-01`;
  if (!date || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, reason: 'unclear' };
  const y = Number(date.slice(0, 4));
  if (y < year - 1 || y > year + 1) return { ok: false, reason: 'range' };
  return { ok: true, date };
}

function isoWeekMonday(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 864e5 + (week - 1) * 7 * 864e5);
  return monday.toISOString().slice(0, 10);
}

export async function dayAnswer(hi: HandlerInput, slotValue: string | undefined): Promise<Answer> {
  const api = await apiFor(hi);
  const todayIso = localDate(deps.now(), api.timeZone);
  const year = Number(todayIso.slice(0, 4));
  const r = resolveDate(slotValue, todayIso);
  if (!r.ok) {
    const question =
      r.reason === 'range'
        ? `Ich kann Tage von ${year - 1} bis ${year + 1} nachschlagen. Welcher Tag soll es sein?`
        : 'Welchen Tag meinst du? Sag zum Beispiel: Wie sieht es am 21. Dezember aus?';
    return { speech: '', ask: { question } };
  }
  const { data: day, stale } = await api.day(r.date);
  return {
    speech: speak(stale ? T.stale : '', briefing(day)),
    screen: mainScreen(day, viewportKind(hi), year),
  };
}
