/**
 * Writes the APL document of every screen for every Echo Show form factor, as the skill renders
 * them from the fixtures, so they can be previewed at the device's real size (skill `screen-check`,
 * which loads them into the APL authoring tool of the developer console).
 *
 *   APL_DUMP=.playwright-mcp/screens npx vitest run lambda/test/apl-dump.test.ts
 *
 * Skipped without APL_DUMP, so `npm run verify` does not write files.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { directive, envelope, fixture, intent, launch, setup, userEvent } from './helpers';

const out = process.env.APL_DUMP;

/** `pixel` is what the device reports to the skill, `dp` the size the authoring tool previews. */
export const DEVICES = [
  { id: 'show5', name: 'Echo Show 5', pixel: { w: 960, h: 480 }, dp: { w: 960, h: 480 } },
  { id: 'show8', name: 'Echo Show 8', pixel: { w: 1280, h: 800 }, dp: { w: 960, h: 600 } },
  { id: 'show10', name: 'Echo Show 10', pixel: { w: 1280, h: 800 }, dp: { w: 1280, h: 800 } },
  { id: 'show15', name: 'Echo Show 15/21', pixel: { w: 1920, h: 1080 }, dp: { w: 1920, h: 1080 } },
  { id: 'show15-portrait', name: 'Echo Show 15 upright', pixel: { w: 1080, h: 1920 }, dp: { w: 1080, h: 1920 } },
];

type T = ReturnType<typeof setup>;
const SCREENS: { id: string; name: string; run: (t: T, vp: { w: number; h: number }) => ReturnType<T['invoke']> }[] = [
  { id: '01-main', name: 'Main (launch)', run: (t, viewport) => t.invoke(envelope(launch(), { apl: true, viewport })) },
  {
    id: '02-main-festival-day',
    name: 'Main on a festival day (21.12.)',
    run: (t, viewport) => {
      t.api.data.set('today', fixture('day-2026-12-21'));
      return t.invoke(envelope(launch(), { apl: true, viewport }));
    },
  },
  { id: '03-festival-next', name: 'Festival detail (next: Samhain)', run: (t, viewport) => t.invoke(envelope(userEvent('nav', 'festival'), { apl: true, viewport, newSession: false })) },
  {
    id: '04-festival-imbolc',
    name: 'Festival detail (Imbolc)',
    run: (t, viewport) => t.invoke(envelope(intent('FestivalInfoIntent', { festival: { value: 'Imbolc', id: 'imbolc' } }), { apl: true, viewport, newSession: false })),
  },
  { id: '05-moon', name: 'Moon', run: (t, viewport) => t.invoke(envelope(userEvent('nav', 'moon'), { apl: true, viewport, newSession: false })) },
  {
    id: '06-moon-garden-tips',
    name: 'Moon with gardening tips (20.05.)',
    run: (t, viewport) => {
      t.api.data.set('today', fixture('day-2026-05-20'));
      return t.invoke(envelope(intent('MoonGardenIntent'), { apl: true, viewport, newSession: false }));
    },
  },
  { id: '07-garden-today', name: 'Garden today', run: (t, viewport) => t.invoke(envelope(intent('GardenTodayIntent'), { apl: true, viewport, newSession: false })) },
  {
    id: '08-garden-today-tips',
    name: 'Garden today with moon tips (20.05.)',
    run: (t, viewport) => {
      t.api.data.set('today', fixture('day-2026-05-20'));
      return t.invoke(envelope(intent('GardenTodayIntent'), { apl: true, viewport, newSession: false }));
    },
  },
  { id: '09-garden-week', name: 'Garden week', run: (t, viewport) => t.invoke(envelope(userEvent('nav', 'gardenWeek'), { apl: true, viewport, newSession: false })) },
  {
    id: '10-garden-week-tapped',
    name: 'Garden week, task tapped',
    run: (t, viewport) => t.invoke(envelope(userEvent('nav', 'task', 'fullAutumn-2', 'week'), { apl: true, viewport, newSession: false })),
  },
  { id: '11-help', name: 'Help', run: (t, viewport) => t.invoke(envelope(intent('AMAZON.HelpIntent'), { apl: true, viewport, newSession: false })) },
  {
    id: '12-error',
    name: 'Error (API unavailable)',
    run: (t, viewport) => {
      t.api.problem('/today', 503, 'unavailable');
      return t.invoke(envelope(launch(), { apl: true, viewport }));
    },
  },
];

describe.skipIf(!out)('APL dump for the screen check', () => {
  it('writes every screen for every form factor', async () => {
    const dir = resolve(out ?? '.');
    const index: { devices: typeof DEVICES; screens: { id: string; name: string }[]; files: string[] } = {
      devices: DEVICES,
      screens: SCREENS.map(({ id, name }) => ({ id, name })),
      files: [],
    };
    for (const device of DEVICES) {
      mkdirSync(join(dir, device.id), { recursive: true });
      for (const screen of SCREENS) {
        const res = await screen.run(setup(), device.pixel);
        const doc = directive(res)?.document;
        expect(doc, `${device.id}/${screen.id} renders a screen`).toBeDefined();
        const file = join(device.id, `${screen.id}.json`);
        writeFileSync(join(dir, file), JSON.stringify(doc, null, 2));
        index.files.push(file);
      }
    }
    writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2));
  });
});
