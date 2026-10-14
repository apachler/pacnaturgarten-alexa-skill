import { StaticAplTemplateValidator } from 'apl-suggester';
import { describe, expect, it } from 'vitest';
import { errorScreen, festivalScreen, gardenScreen, helpScreen, mainScreen, moonScreen, type Screen } from '../src/apl/screens';
import { weekGroups } from '../src/answers/garden';
import type { Day, NextFestival, Week } from '../src/api/types';
import type { ViewportKind } from '../src/context';
import { fixture } from './helpers';

/** Every screen on every viewport passes Amazon's APL schema validation (apl-suggester). */
const day = fixture<Day>('today');
const yule = fixture<Day>('day-2026-12-21');
const spring = fixture<Day>('day-2026-05-20');
const next = fixture<NextFestival>('festivals-next');
const week = fixture<Week>('week');

const screens: [string, (k: ViewportKind) => Screen][] = [
  ['main', (k) => mainScreen(day, k)],
  ['main on a festival, no image', (k) => mainScreen(yule, k, 2026)],
  ['festival', (k) => festivalScreen(next.festival!, '2026-10-14', k)],
  ['moon', (k) => moonScreen(day.moon, k)],
  ['moon with garden tips', (k) => moonScreen(spring.moon, k, spring.garden.moon)],
  ['garden today', (k) => gardenScreen({ title: 'Heute', groups: [{ tasks: day.garden.tasks }], moon: spring.garden.moon }, k)],
  ['garden week', (k) => gardenScreen({ title: 'Diese Woche', subtitle: 'Mi, 14. Oktober – Di, 20. Oktober', groups: weekGroups(week) }, k)],
  ['help', (k) => helpScreen(k)],
  ['error', (k) => errorScreen(k, 'Das Jahresrad ist gerade nicht erreichbar.', 'Bitte versuch es später noch einmal.')],
];

describe('APL documents', () => {
  const validator = new StaticAplTemplateValidator();
  for (const [name, build] of screens) {
    for (const kind of ['landscape', 'small', 'portrait'] as ViewportKind[]) {
      it(`${name} (${kind}) is valid APL`, async () => {
        const doc = build(kind).document;
        const problems = await validator.validate(doc as never);
        expect(problems.map((p) => `${p.path ?? ''}: ${p.errorMessage ?? JSON.stringify(p)}`)).toEqual([]);
      });
    }
  }
});
