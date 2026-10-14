import { describe, expect, it } from 'vitest';
import { mainScreen, pickWheel } from '../src/apl/screens';
import { moonLitPath } from '../src/apl/ui';
import { resolveDate } from '../src/answers/today';
import { festivalKey } from '../src/answers/festival';
import { redact } from '../src/log';
import type { Day } from '../src/api/types';
import { escapeSsml, inDays, joinList, longDate, spokenDuration, spokenTime } from '../src/speech/format';
import { fixture } from './helpers';

describe('spoken German', () => {
  it('dates, times, durations, lists', () => {
    expect(longDate('2026-11-09')).toBe('Montag, 9. November');
    expect(longDate('2027-02-01', 2026)).toBe('Montag, 1. Februar 2027');
    expect(spokenTime('07:19')).toBe('7 Uhr 19');
    expect(spokenTime('18:00')).toBe('18 Uhr');
    expect(spokenDuration(659)).toBe('10 Stunden und 59 Minuten');
    expect(spokenDuration(61)).toBe('1 Stunde und 1 Minute');
    expect(spokenDuration(600)).toBe('10 Stunden');
    expect(inDays(0)).toBe('heute');
    expect(inDays(1)).toBe('morgen');
    expect(inDays(26)).toBe('in 26 Tagen');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b und c');
    expect(escapeSsml('Natur & Garten <3')).toBe('Natur &amp; Garten &lt;3');
  });
});

describe('AMAZON.DATE', () => {
  const today = '2026-10-14';
  it.each([
    ['2026-12-21', '2026-12-21'],
    ['XXXX-12-21', '2026-12-21'],
    ['2026-W52', '2026-12-21'],
    ['2026-W52-WE', '2026-12-21'],
    ['2027-03', '2027-03-01'],
    ['2025', '2025-01-01'],
  ])('%s → %s', (value, date) => {
    expect(resolveDate(value, today)).toEqual({ ok: true, date });
  });
  it('refuses what it cannot use', () => {
    expect(resolveDate(undefined, today)).toEqual({ ok: false, reason: 'missing' });
    expect(resolveDate('PRESENT_REF', today)).toEqual({ ok: false, reason: 'unclear' });
    expect(resolveDate('2024-05-01', today)).toEqual({ ok: false, reason: 'range' });
    expect(resolveDate('2028-01-01', today)).toEqual({ ok: false, reason: 'range' });
  });
});

describe('festival names', () => {
  it.each([
    ['Samhain', 'samhain'],
    ['Jul', 'yule'],
    ['Lichtmess', 'imbolc'],
    ['Beltaine', 'beltane'],
    ['Walpurgis', 'beltane'],
    ['Lammas', 'lughnasadh'],
    ['Herbst-Tagundnachtgleiche', 'mabon'],
    ['Frühlings-Tagundnachtgleiche', 'ostara'],
    ['Rauhnächte', null],
  ])('%s → %s', (name, key) => {
    expect(festivalKey(name)).toBe(key);
  });
});

describe('screens', () => {
  const day = fixture<Day>('today');
  it('picks the wheel-only image per device', () => {
    expect(pickWheel(day.image, 'landscape')).toMatch(/\/rad-1080x1080\.png$/);
    expect(pickWheel(day.image, 'portrait')).toMatch(/\/rad-1080x1080\.png$/);
    expect(pickWheel(day.image, 'small')).toMatch(/\/rad-600x600\.png$/);
  });

  it('falls back to the square image while the wheel-only one is missing', () => {
    const old = { ...day.image!, variants: day.image!.variants!.filter((v) => !v.url.includes('/rad-')) };
    expect(pickWheel(old, 'landscape')).toMatch(/\/1200x1200\.png$/);
    expect(pickWheel(null, 'landscape')).toBeUndefined();
  });

  it('main screen without an image (dates far away) still has the cards', () => {
    const doc = JSON.stringify(mainScreen({ ...day, image: null }, 'landscape').document);
    expect(doc).not.toContain('"type":"Image"');
    expect(doc).toContain('Vollherbst');
    expect(doc).toContain('Samhain');
  });

  it('moon disc paths', () => {
    expect(moonLitPath(0.5, true, 96, 100, 100)).toBe('M100,4 A96,96 0 0 1 100,196 A0,96 0 0 1 100,4 Z');
    expect(moonLitPath(0.14, true, 96, 100, 100)).toContain('A69.12,96 0 0 0');
    expect(moonLitPath(0.9, false, 96, 100, 100)).toContain('0 0 0 100,196');
  });
});

describe('log redaction', () => {
  it('masks tokens and keys', () => {
    expect(redact('Bearer ngbat_abc_def')).toBe('[redacted]');
    expect(redact('key ngb_live_abc_def_ghi')).toBe('key [redacted]');
    expect(redact('token Atza|IwEBIabc')).toBe('token [redacted]');
  });
});
