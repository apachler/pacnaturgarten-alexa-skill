// Regenerates lambda/test/fixtures from the main repo's real API code (netlify/lib/day-info.mjs),
// so the tests pin the API as it is. Day: 14.10.2026, default place Klagenfurt, no weather data.
//
//   cd <pacnaturgarten checkout> && npm ci
//   node_modules/.bin/jiti <this repo>/scripts/generate-fixtures.mjs <pacnaturgarten checkout> <this repo>/lambda/test/fixtures
//
// jiti is needed because day-info.mjs imports TypeScript from src/lib without extensions.
import { writeFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [repo, out] = process.argv.slice(2);
const imp = (p) => import(pathToFileURL(`${repo}/${p}`).href);
const di = await imp('netlify/lib/day-info.mjs');
const { seasonsAt } = await imp('netlify/lib/place-seasons.mjs');
const items = JSON.parse(readFileSync(`${repo}/src/data/festivals.json`, 'utf8')).items;
const place = { type: 'default', label: 'Klagenfurt', lat: 46.62, lon: 14.31, alt: 446 };
const tz = 'Europe/Vienna';
const today = '2026-10-14';
const failingStore = { get: async () => { throw new Error('offline'); }, set: async () => {}, getWithMetadata: async () => { throw new Error('offline'); } };
const seasons = await seasonsAt(place, { today, weatherStore: failingStore });
const ctx = { items, place, seasons, tz, today };
// Mirrors imageFor() in netlify/functions/api.mjs (not exported): dated `v2` URL per 0.5° cell,
// rendered in the place's zone, so `generated_at` is midnight there and `timezone` that zone.
const make = (date, f, w, h) => ({ url: `https://naturgarten.bio/jahresrad/bild/v2/${date}/46.5,14.5/${f}.png`, width: w, height: h });
const midnight = (date, zone) => {
  const utc = Date.parse(`${date}T00:00:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).format(utc).match(/GMT([+-]\d{2}):(\d{2})/);
  const minutes = offset ? Number(offset[1]) * 60 + Math.sign(Number(offset[1])) * Number(offset[2]) : 0;
  return new Date(utc - minutes * 60_000).toISOString();
};
const image = (date) => ({ ...make(date, '1920x1080', 1920, 1080), generated_at: midnight(date, tz), timezone: tz,
  variants: [make(date, '1920x1080', 1920, 1080), make(date, '1200x1200', 1200, 1200), make(date, '1080x1920', 1080, 1920), make(date, 'rad-1080x1080', 1080, 1080), make(date, 'rad-600x600', 600, 600)] });
const env = (data) => JSON.stringify({ data, meta: { api_version: 'v1', generated_at: '2026-10-14T05:00:00.000Z' } }, null, 2) + '\n';
const w = (name, data) => writeFileSync(`${out}/${name}.json`, env(data));
w('today', di.dayInfo({ ...ctx, image: image(today) }, today));
w('day-2026-12-21', di.dayInfo({ ...ctx, today, image: null }, '2026-12-21'));
w('day-2026-05-20', di.dayInfo({ ...ctx, today, seasons: await seasonsAt(place, { today: '2026-05-20', weatherStore: failingStore }), image: null }, '2026-05-20'));
w('week', di.weekInfo(ctx, today));
w('festivals-2026', di.festivalsOfYear(items, 2026));
w('festivals-2027', di.festivalsOfYear(items, 2027));
w('festivals-next', { today, festival: di.nextFestival(items, today) });
w('moon', { date: today, timezone: tz, moon: di.moonOn(today, tz) });
w('daylight', { date: today, timezone: tz, location: di.publicLocation(place), daylight: di.daylightOn(today, place, tz) });
console.log('ok');
