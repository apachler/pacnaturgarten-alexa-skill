import { config } from '../config';
import { log } from '../log';
import { ResponseCache, type CacheEntry } from './cache';
import { ApiError, errorFromResponse } from './errors';
import type { Transport } from './transport';
import type { Day, DaylightDay, Envelope, Festivals, MoonDay, NextFestival, Week } from './types';

export interface ApiOptions {
  token: string;
  /** Hash of the Alexa user id: separates cache entries per user. */
  userKey: string;
  timeZone: string;
  transport: Transport;
  cache: ResponseCache;
  now: () => number;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface ApiResult<T> {
  data: T;
  /** Served from today's cache because the API could not be reached. */
  stale: boolean;
}

type Params = Record<string, string | number | undefined>;

/** The Jahresrad API for one request of one user. All API access goes through here. */
export class JahresradApi {
  constructor(private readonly o: ApiOptions) {}

  get timeZone(): string {
    return this.o.timeZone;
  }

  today() {
    return this.get<Day>('/today', { tz: this.o.timeZone });
  }

  day(date: string) {
    return this.get<Day>(`/day/${date}`, { tz: this.o.timeZone });
  }

  week(start?: string) {
    return this.get<Week>('/week', { start, tz: this.o.timeZone });
  }

  festivals(year: number) {
    return this.get<Festivals>('/festivals', { year });
  }

  nextFestival() {
    return this.get<NextFestival>('/festivals/next', { tz: this.o.timeZone });
  }

  moon(date?: string) {
    return this.get<MoonDay>('/moon', { date, tz: this.o.timeZone });
  }

  daylight(date?: string) {
    return this.get<DaylightDay>('/daylight', { date, tz: this.o.timeZone });
  }

  private async get<T>(path: string, params: Params): Promise<ApiResult<T>> {
    const query = new URLSearchParams(
      Object.entries(params)
        .filter((p): p is [string, string | number] => p[1] !== undefined && p[1] !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    const url = `${this.o.baseUrl ?? config.apiBaseUrl}${path}${query ? `?${query}` : ''}`;
    const key = `${this.o.userKey}|${path}?${query}`;
    const now = this.o.now();
    const entry = this.o.cache.get(key);
    const usable = entry && now < entry.expiresAt ? entry : undefined;

    if (usable && now - usable.checkedAt < config.revalidateAfterMs) return { data: usable.data as T, stale: false };

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${this.o.token}`,
      'User-Agent': 'jahresrad-alexa-skill',
    };
    if (usable?.etag) headers['If-None-Match'] = usable.etag;

    const started = this.o.now();
    let res;
    try {
      res = await this.o.transport(url, headers, this.o.timeoutMs ?? config.apiTimeoutMs, config.apiMaxBodyBytes);
    } catch (err) {
      log('api_unreachable', { path, reason: err instanceof Error ? err.message : 'unknown', ms: this.o.now() - started });
      return this.fallback<T>(usable, path, new ApiError('unavailable'));
    }

    if (res.status === 304 && usable) {
      usable.checkedAt = now;
      usable.expiresAt = expiry(res.headers, now, usable.expiresAt);
      return { data: usable.data as T, stale: false };
    }

    if (res.status === 200) {
      let body: Envelope<T>;
      try {
        body = JSON.parse(res.body) as Envelope<T>;
      } catch {
        log('api_bad_body', { path });
        return this.fallback<T>(usable, path, new ApiError('unavailable', 200));
      }
      if (!body || typeof body !== 'object' || body.data === undefined || body.data === null) {
        log('api_bad_body', { path });
        return this.fallback<T>(usable, path, new ApiError('unavailable', 200));
      }
      const fresh: CacheEntry = {
        etag: res.headers.etag,
        data: body.data,
        checkedAt: now,
        expiresAt: expiry(res.headers, now, now + 5 * 60 * 1000),
      };
      this.o.cache.set(key, fresh);
      return { data: body.data, stale: false };
    }

    const error = errorFromResponse(res.status, res.body);
    log('api_error', { path, status: res.status, code: error.code ?? null, retryAfter: res.headers['retry-after'] ?? null });
    if (error.kind === 'unavailable') return this.fallback<T>(usable, path, error);
    throw error;
  }

  /** Today's cached answer when the API cannot be reached; otherwise the error. */
  private fallback<T>(entry: CacheEntry | undefined, path: string, error: ApiError): ApiResult<T> {
    if (entry) {
      log('api_stale_served', { path });
      return { data: entry.data as T, stale: true };
    }
    throw error;
  }
}

function expiry(headers: Record<string, string>, now: number, fallback: number): number {
  const m = /max-age=(\d+)/.exec(headers['cache-control'] ?? '');
  return m ? now + Number(m[1]) * 1000 : fallback;
}
