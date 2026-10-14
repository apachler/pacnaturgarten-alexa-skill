import type { HandlerInput } from 'ask-sdk-core';
import { gardenScreen, type GardenView, type Screen, type TaskGroup } from '../apl/screens';
import type { Day, Task, Week } from '../api/types';
import { apiFor, deps, localDate, viewportKind } from '../context';
import type { Answer } from '../respond';
import { screenDate, sentence, shortDate, speak, weekday } from '../speech/format';
import { T } from '../speech/texts';

const PAGE = 5;
const TODAY_MAX = 3;

const said = (t: Task) => sentence(t.speech ?? t.title);

/** „Was ist heute im Garten zu tun?“ — up to three tasks, plus the moon when it has a tip. */
export async function gardenTodayAnswer(hi: HandlerInput): Promise<Answer> {
  const api = await apiFor(hi);
  const { data: day, stale } = await api.today();
  const tasks = day.garden.tasks;
  const moon = day.garden.moon;
  const screen = todayScreen(hi, day);
  if (!tasks.length) return { speech: speak(stale ? T.stale : '', 'Für heute habe ich keine Gartenarbeit.'), screen };
  return {
    speech: speak(
      stale ? T.stale : '',
      day.season ? `Im ${day.season.name} steht an:` : 'Heute im Garten:',
      ...tasks.slice(0, TODAY_MAX).map(said),
      moon?.tips.length ? sentence(moon.speech) : '',
    ),
    screen,
  };
}

/** The week's tasks grouped by nature season; a season that starts mid-week is named. */
export function weekGroups(week: Week): TaskGroup[] {
  const firstDay = new Map<string, { name: string; date: string }>();
  for (const d of week.days) if (d.season && !firstDay.has(d.season.id)) firstDay.set(d.season.id, { name: d.season.name, date: d.date });
  const groups = new Map<string, TaskGroup>();
  for (const t of week.garden.tasks) {
    const seasonId = t.id.replace(/-\d+$/, '');
    const s = firstDay.get(seasonId);
    if (!groups.has(seasonId)) {
      const startsLater = s && s.date !== week.start;
      groups.set(seasonId, {
        title: !s ? undefined : startsLater ? `Ab ${weekday(s.date)}, ${shortDate(s.date)}: ${s.name}` : s.name,
        intro: !s ? undefined : startsLater ? `Ab ${weekday(s.date)} ist ${s.name}:` : `Im ${s.name}:`,
        tasks: [],
      });
    }
    groups.get(seasonId)!.tasks.push(t);
  }
  return [...groups.values()];
}

/** „Gartenarbeiten der Woche“, five at a time („Soll ich weiterlesen?“). */
export async function gardenWeekAnswer(hi: HandlerInput, start?: string, offset = 0): Promise<Answer> {
  const api = await apiFor(hi);
  const from = start ?? localDate(deps.now(), api.timeZone);
  const { data: week, stale } = await api.week(from);
  const groups = weekGroups(week);
  const screen = weekScreen(hi, week);
  const all = groups.flatMap((g) => g.tasks.map((t) => ({ t, group: g })));
  if (!all.length) return { speech: speak(stale ? T.stale : '', 'Für diese Woche habe ich keine Gartenarbeiten.'), screen };

  const page = all.slice(offset, offset + PAGE);
  const parts: string[] = [stale ? T.stale : '', offset === 0 ? 'Diese Woche im Garten.' : 'Weiter.'];
  let current: TaskGroup | undefined;
  for (const { t, group } of page) {
    if (group !== current && group.intro) parts.push(group.intro);
    current = group;
    parts.push(said(t));
  }
  const rest = all.length - (offset + page.length);
  return {
    speech: speak(...parts),
    screen,
    ask: rest > 0 ? { question: T.readOn, pending: { type: 'gardenWeekMore', start: week.start, offset: offset + PAGE } } : undefined,
  };
}


/**
 * Tap on a task in a list: read its speech and redraw the same list with the task marked. Without
 * a screen the response would end the session and the Echo Show would drop to a blank page.
 */
export async function taskAnswer(hi: HandlerInput, taskId: string, view: GardenView = 'week'): Promise<Answer> {
  const api = await apiFor(hi);
  const [{ data: day }, { data: week }] = await Promise.all([api.today(), api.week(localDate(deps.now(), api.timeZone))]);
  const task = [...day.garden.tasks, ...week.garden.tasks].find((t) => t.id === taskId);
  const screen = view === 'today' ? todayScreen(hi, day, taskId) : weekScreen(hi, week, taskId);
  return { speech: task ? said(task) : 'Diese Aufgabe finde ich gerade nicht.', screen };
}

function todayScreen(hi: HandlerInput, day: Day, highlight?: string): Screen {
  return gardenScreen(
    { view: 'today', title: 'Heute', subtitle: day.season?.name, groups: [{ tasks: day.garden.tasks }], moon: day.garden.moon, highlight },
    viewportKind(hi),
  );
}

function weekScreen(hi: HandlerInput, week: Week, highlight?: string): Screen {
  return gardenScreen(
    { view: 'week', title: 'Diese Woche', subtitle: `${screenDate(week.start)} – ${screenDate(week.end)}`, groups: weekGroups(week), highlight },
    viewportKind(hi),
  );
}
