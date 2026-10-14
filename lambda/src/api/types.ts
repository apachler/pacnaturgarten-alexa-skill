/**
 * Shapes of the Jahresrad API (`/api/v1/jahresrad/*`).
 *
 * Source of truth: `netlify/lib/openapi.mjs` and `netlify/lib/day-info.mjs` in
 * apachler/pacnaturgarten (branch `preview`). The OpenAPI document leaves several objects
 * untyped (moon quarters, week days, periods); those are written here from day-info.mjs and
 * pinned by the fixtures in lambda/test/fixtures, which are generated from that code.
 *
 * Optional (`?`) marks fields the skill must not rely on: newer fields, or parts that may be
 * missing. Speech code drops a sentence when its field is missing, never says "null".
 */

export interface Envelope<T> {
  data: T;
  meta?: { api_version?: string; generated_at?: string };
}

export interface Location {
  type: 'profile' | 'place' | 'search' | 'coordinates' | 'default';
  label: string;
  lat: number;
  lon: number;
  /** The place's own zone; clock times (sunrise, sunset) are given in it. */
  timezone?: string;
}

export interface Festival {
  id: string;
  name: string;
  date: string;
  rule?: string;
  short?: string | null;
  epithet?: string | null;
  customs?: string | null;
  impulses?: string[];
  days_until?: number;
  speech?: string;
}

export interface Season {
  id: string;
  name: string;
  since: string;
  indicators?: string[];
  source?: string | null;
  next?: { id: string; name: string; date: string } | null;
}

export type MoonPhase =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

/** One of the four main phases with its local date. */
export interface MoonQuarter {
  phase: MoonPhase;
  name: string;
  date: string;
  at?: string;
}

export interface MoonPathChange {
  turn: 'highest' | 'lowest';
  name: string;
  date?: string;
  at?: string;
}

export interface Moon {
  phase: MoonPhase;
  name: string;
  illumination: number;
  phase_angle?: number;
  waxing?: boolean;
  rising?: boolean;
  change_today?: { phase: MoonPhase; name: string } | null;
  next_change?: MoonQuarter | null;
  upcoming?: MoonQuarter[];
  path_change_today?: MoonPathChange | null;
  next_path_change?: MoonPathChange | null;
}

export interface Daylight {
  sunrise: string | null;
  sunset: string | null;
  day_length_min: number;
  change_vs_yesterday_min: number;
}

export interface Task {
  id: string;
  title: string;
  speech?: string;
}

/** Gardening with the moon: old garden wisdom, not science. */
export interface MoonGarden {
  waxing: boolean;
  rising: boolean;
  rhythm?: { phase: string; path: string; text: string };
  tips: { id: string; text: string }[];
  /** Only on a day without tips: the next day with tips, at most 21 days ahead. */
  next?: { date: string; weekday: string; days_until: number; rhythm: string; tips: { id: string; text: string }[] } | null;
  note?: string;
  speech?: string;
}

export interface ImageRef {
  url: string;
  width: number;
  height: number;
}

export interface Image extends ImageRef {
  generated_at?: string;
  timezone?: string;
  variants?: ImageRef[];
}

export interface Period {
  id: string;
  name: string;
  day: number;
  of: number;
  night?: { title: string; month: string } | null;
}

export interface Day {
  date: string;
  weekday: string;
  timezone: string;
  location?: Location;
  season: Season | null;
  festival: { today: Festival | null; eve: Festival | null; next: Festival | null };
  period?: Period | null;
  moon: Moon;
  daylight: Daylight;
  garden: { tasks: Task[]; moon?: MoonGarden };
  image?: Image | null;
  summary?: { speech?: string };
}

export interface WeekDay {
  date: string;
  weekday: string;
  festival: { id: string; name: string } | null;
  period?: { name: string; day: number; of: number } | null;
  season: { id: string; name: string; starts_today: boolean } | null;
  moon_change?: { phase: MoonPhase; name: string } | null;
  moon_path_change?: MoonPathChange | null;
  daylight?: Daylight;
}

export interface Week {
  start: string;
  end: string;
  timezone?: string;
  location?: Location;
  days: WeekDay[];
  garden: { tasks: Task[] };
  summary?: { speech?: string };
}

export interface Festivals {
  year: number;
  festivals: Festival[];
  periods?: { id: string; name: string; date: string; end_date: string }[];
}

export interface NextFestival {
  today: string;
  festival: Festival | null;
}

export interface MoonDay {
  date: string;
  timezone: string;
  moon: Moon;
}

export interface DaylightDay {
  date: string;
  timezone: string;
  location?: Location;
  daylight: Daylight;
}
