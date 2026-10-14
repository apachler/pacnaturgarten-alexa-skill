/**
 * Small formatters for spoken German. Dates come from the API as YYYY-MM-DD calendar days;
 * they are formatted in UTC so the day never shifts.
 */

const at0 = (iso: string) => new Date(`${iso}T00:00:00Z`);
const LONG = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const LONG_YEAR = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const WEEKDAY = new Intl.DateTimeFormat('de-DE', { weekday: 'long', timeZone: 'UTC' });
const WEEKDAY_SHORT = new Intl.DateTimeFormat('de-DE', { weekday: 'short', timeZone: 'UTC' });

/** „Montag, 9. November“, with the year when it is not `currentYear`. */
export function longDate(iso: string, currentYear?: number): string {
  const year = Number(iso.slice(0, 4));
  return (currentYear !== undefined && year !== currentYear ? LONG_YEAR : LONG).format(at0(iso));
}

/** „9. November“ */
export const shortDate = (iso: string): string => SHORT.format(at0(iso));

/** „Montag“ */
export const weekday = (iso: string): string => WEEKDAY.format(at0(iso));

/** „Mo, 9. November“ (screens) */
export const screenDate = (iso: string): string => `${WEEKDAY_SHORT.format(at0(iso)).replace('.', '')}, ${SHORT.format(at0(iso))}`;

/** Whole days from `fromIso` to `toIso`. */
export const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((at0(toIso).getTime() - at0(fromIso).getTime()) / 864e5);

/** „heute“, „morgen“, „in 26 Tagen“ */
export function inDays(n: number): string {
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  return `in ${n} Tagen`;
}

/** „07:19“ → „7 Uhr 19“, „18:00“ → „18 Uhr“ */
export function spokenTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return m ? `${h} Uhr ${m}` : `${h} Uhr`;
}

/** 659 → „10 Stunden und 59 Minuten“ */
export function spokenDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? '1 Stunde' : `${h} Stunden`;
  const mins = m === 1 ? '1 Minute' : `${m} Minuten`;
  if (!h) return mins;
  return m ? `${hours} und ${mins}` : hours;
}

/** 659 → „10 h 59 min“ (screens) */
export const screenDuration = (minutes: number): string =>
  `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;

/** „a“, „a und b“, „a, b und c“ */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}

/** Collapses line breaks and runs of spaces; `null`/`undefined` become ''. */
export const clean = (text: string | null | undefined): string => (text ?? '').replace(/\s+/g, ' ').trim();

/** Ends the text with a full stop unless it already ends with punctuation. */
export function sentence(text: string | null | undefined): string {
  const t = clean(text);
  if (!t) return '';
  return /[.!?…“"]$/.test(t) ? t : `${t}.`;
}

/** Joins sentences, skipping empty ones. */
export const speak = (...parts: (string | null | undefined | false)[]): string =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').map((p) => p.trim()).join(' ');

/** Text for SSML: the characters that would break `<speak>`. */
export const escapeSsml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
