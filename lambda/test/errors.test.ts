import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { T } from '../src/speech/texts';
import { directive, envelope, intent, launch, said, setup, TOKEN } from './helpers';

let t: ReturnType<typeof setup>;
beforeEach(() => {
  t = setup();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('account and access', () => {
  it('without a linked account: explanation, LinkAccount card, end — no API call', async () => {
    const res = await t.invoke(envelope(launch(), { token: null, apl: true }));
    expect(said(res)).toBe(T.unlinked);
    expect(res.response.card).toEqual({ type: 'LinkAccount' });
    expect(res.response.shouldEndSession).toBe(true);
    expect(t.api.calls).toHaveLength(0);
  });

  it.each([
    ['invalid_credentials', 401],
    ['expired_credentials', 401],
    ['revoked_credentials', 401],
    ['insufficient_scope', 403],
  ])('%s → treated as not linked', async (code, status) => {
    t.api.problem('/today', status, code);
    const res = await t.invoke(envelope(intent('TodayIntent')));
    expect(said(res)).toBe(T.unlinked);
    expect(res.response.card).toEqual({ type: 'LinkAccount' });
  });

  it('no longer a Gefährte: explanation and a card with the link', async () => {
    t.api.problem('/festivals/next', 403, 'not_a_companion');
    const res = await t.invoke(envelope(intent('NextFestivalIntent')));
    expect(said(res)).toBe(T.notCompanion);
    expect(res.response.card).toMatchObject({ type: 'Simple', content: expect.stringContaining('https://naturgarten.bio') });
    expect(res.response.shouldEndSession).toBe(true);
  });
});

describe('skill id', () => {
  it('refuses a request for another skill before any handler or API call', async () => {
    await expect(t.invoke(envelope(launch(), { skillId: 'amzn1.ask.skill.someone-else' }))).rejects.toThrow(/skill id/i);
    expect(t.api.calls).toHaveLength(0);
  });
});

describe('outages', () => {
  it('5xx without a cache: friendly message and the error screen', async () => {
    t.api.problem('/moon', 503, 'unavailable');
    const res = await t.invoke(envelope(intent('MoonIntent'), { apl: true }));
    expect(said(res)).toBe(T.unavailable);
    expect(directive(res)?.token).toBe('errorScreen');
  });

  it('timeout or network error: the same', async () => {
    t.api.overrides.set('/daylight', () => Promise.reject(new Error('timeout')));
    const res = await t.invoke(envelope(intent('DaylightIntent')));
    expect(said(res)).toBe(T.unavailable);
    expect(res.response.shouldEndSession).toBe(true);
  });

  it('429 counts as unavailable', async () => {
    t.api.problem('/today', 429, 'rate_limited');
    expect(said(await t.invoke(envelope(intent('TodayIntent'))))).toBe(T.unavailable);
  });

  it('with today’s cache: the cached answer, said to be from earlier', async () => {
    await t.invoke(envelope(intent('DaylightIntent')));
    t.advance(2 * 60 * 60 * 1000);
    t.api.problem('/daylight', 502);
    const res = await t.invoke(envelope(intent('DaylightIntent')));
    expect(said(res)).toMatch(new RegExp(`^${T.stale} In Klagenfurt geht die Sonne`));
  });

  it('after midnight yesterday’s cache is not used', async () => {
    await t.invoke(envelope(intent('DaylightIntent')));
    t.advance(20 * 60 * 60 * 1000);
    t.api.problem('/daylight', 502);
    expect(said(await t.invoke(envelope(intent('DaylightIntent'))))).toBe(T.unavailable);
  });
});

describe('caching', () => {
  it('serves repeat questions from the cache, then revalidates with If-None-Match', async () => {
    await t.invoke(envelope(intent('TodayIntent')));
    await t.invoke(envelope(intent('SeasonIntent')));
    expect(t.api.calls.filter((c) => c.path === '/today')).toHaveLength(1);
    t.advance(61 * 60 * 1000);
    const res = await t.invoke(envelope(intent('SeasonIntent')));
    const calls = t.api.calls.filter((c) => c.path === '/today');
    expect(calls).toHaveLength(2);
    expect(calls[1]!.headers['If-None-Match']).toBe('"today"');
    expect(said(res)).toContain('Vollherbst');
  });
});

describe('logging', () => {
  it('never writes the token', async () => {
    const lines: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    t.api.problem('/today', 401, 'invalid_credentials');
    await t.invoke(envelope(intent('TodayIntent')));
    await t.invoke(envelope(launch()));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.join('\n')).not.toContain(TOKEN);
    expect(lines.join('\n')).not.toContain('amzn1.ask.account');
  });
});
