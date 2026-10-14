import type { HandlerInput } from 'ask-sdk-core';
import { moonScreen } from '../apl/screens';
import type { MoonPhase, MoonQuarter } from '../api/types';
import { apiFor, deps, localDate, viewportKind } from '../context';
import type { Answer } from '../respond';
import { clean, daysBetween, longDate, sentence, speak, weekday } from '../speech/format';
import { T } from '../speech/texts';

/** Slot ids of MOON_EVENT (interaction model) → API phases. */
const EVENTS: Record<string, MoonPhase> = {
  full_moon: 'full_moon',
  new_moon: 'new_moon',
  first_quarter: 'first_quarter',
  last_quarter: 'last_quarter',
};

function when(q: MoonQuarter, todayIso: string): string {
  const days = daysBetween(todayIso, q.date);
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return `am ${longDate(q.date, Number(todayIso.slice(0, 4)))}`;
}

/** „Wie steht der Mond?“, „Wann ist Vollmond?“ */
export async function moonAnswer(hi: HandlerInput, event?: string): Promise<Answer> {
  const api = await apiFor(hi);
  const { data, stale } = await api.moon();
  const moon = data.moon;
  const todayIso = data.date || localDate(deps.now(), api.timeZone);
  const upcoming = moon.upcoming ?? [];
  const screen = moonScreen(moon, viewportKind(hi));
  const prefix = stale ? T.stale : '';

  const phase = event ? EVENTS[event] : undefined;
  if (phase) {
    const q = upcoming.find((u) => u.phase === phase && u.date >= todayIso);
    if (!q) return { speech: speak(prefix, 'Das kann ich gerade nicht sagen.'), screen };
    // The API calls the new moon „Schwarzmond“; people ask for „Neumond“.
    const name = phase === 'new_moon' ? 'Schwarzmond, also Neumond,' : q.name;
    const isToday = q.date === todayIso;
    return {
      speech: speak(prefix, isToday ? `Heute ist ${phase === 'new_moon' ? 'Schwarzmond' : q.name}.` : `Der nächste ${name} ist ${when(q, todayIso)}.`),
      screen,
    };
  }

  const pct = Math.round(moon.illumination * 100);
  const next = moon.next_change;
  return {
    speech: speak(
      prefix,
      `Heute: ${moon.name}, zu ${pct} Prozent beleuchtet.`,
      moon.change_today ? `Heute ist ${moon.change_today.name}.` : '',
      next ? `${next.name} ist ${when(next, todayIso)}.` : '',
    ),
    screen,
  };
}

/** „Was sagt der Mond zum Garten?“ — gardening with the moon, from /today. */
export async function moonGardenAnswer(hi: HandlerInput): Promise<Answer> {
  const api = await apiFor(hi);
  const { data: day, stale } = await api.today();
  const g = day.garden.moon;
  const screen = moonScreen(day.moon, viewportKind(hi), g);
  if (!g) return { speech: speak(stale ? T.stale : '', 'Dazu habe ich heute keinen Hinweis.'), screen };
  const turn = day.moon.next_path_change;
  const turnSaid =
    turn?.date && daysBetween(day.date, turn.date) <= 7
      ? `Ab ${weekday(turn.date)} ${turn.turn === 'lowest' ? 'steigt' : 'sinkt'} der Mond.`
      : '';
  return {
    speech: speak(stale ? T.stale : '', sentence(g.speech ?? g.rhythm?.text), turnSaid, g.tips.length ? clean(g.note) || T.moonNote : ''),
    screen,
  };
}
