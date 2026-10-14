import { createHash } from 'node:crypto';
import { getDeviceId, getRequestType, getSupportedInterfaces, getUserId, type HandlerInput } from 'ask-sdk-core';
import { JahresradApi } from './api/client';
import { sharedCache, type ResponseCache } from './api/cache';
import { ApiError } from './api/errors';
import { httpsGet, type Transport } from './api/transport';
import { config } from './config';
import { log } from './log';
import type { UserAttributes } from './persistence';

/** Seams for tests: the network, the clock, the time zone lookup, the cache. */
export const deps: {
  transport: Transport;
  now: () => number;
  timeZone: (hi: HandlerInput) => Promise<string>;
  cache: ResponseCache;
} = {
  transport: httpsGet,
  now: () => Date.now(),
  timeZone: settingsTimeZone,
  cache: sharedCache,
};

// ---------- the API for this request ----------

const API_KEY = 'jahresradApi';

/** The API client for this request; „not linked“ when Alexa sent no access token. */
export async function apiFor(hi: HandlerInput): Promise<JahresradApi> {
  const attrs = hi.attributesManager.getRequestAttributes();
  if (attrs[API_KEY]) return attrs[API_KEY] as JahresradApi;
  const token = hi.requestEnvelope.context?.System?.user?.accessToken;
  if (!token) throw new ApiError('unlinked');
  const api = new JahresradApi({
    token,
    userKey: userKey(hi),
    timeZone: await deps.timeZone(hi),
    transport: deps.transport,
    cache: deps.cache,
    now: deps.now,
  });
  attrs[API_KEY] = api;
  return api;
}

const userKey = (hi: HandlerInput): string =>
  createHash('sha256').update(getUserId(hi.requestEnvelope) ?? 'anonymous').digest('hex').slice(0, 16);

/** YYYY-MM-DD in a time zone. */
export const localDate = (at: number, tz: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));

// ---------- time zone (Alexa Settings API, no permission needed) ----------

const zones = new Map<string, string>();

async function settingsTimeZone(hi: HandlerInput): Promise<string> {
  const deviceId = getDeviceId(hi.requestEnvelope);
  if (!deviceId) return config.defaultTimeZone;
  const known = zones.get(deviceId);
  if (known) return known;
  try {
    const client = hi.serviceClientFactory?.getUpsServiceClient();
    if (!client) return config.defaultTimeZone;
    const tz = await Promise.race([
      client.getSystemTimeZone(deviceId),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), config.timeZoneLookupMs)),
    ]);
    if (typeof tz === 'string' && isTimeZone(tz)) {
      zones.set(deviceId, tz);
      return tz;
    }
  } catch (err) {
    log('timezone_lookup_failed', { reason: err instanceof Error ? err.message : 'unknown' });
  }
  return config.defaultTimeZone;
}

export function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// ---------- device ----------

export const supportsApl = (hi: HandlerInput): boolean =>
  Boolean(getSupportedInterfaces(hi.requestEnvelope)?.['Alexa.Presentation.APL']);

export type ViewportKind = 'small' | 'landscape' | 'portrait';

/** Echo Show 5 (960×480) is „small“; Show 15 standing upright is „portrait“. */
export function viewportKind(hi: HandlerInput): ViewportKind {
  const vp = hi.requestEnvelope.context?.Viewport;
  const w = vp?.pixelWidth ?? 1280;
  const h = vp?.pixelHeight ?? 800;
  if (h > w) return 'portrait';
  if (w <= 1024 || h <= 600) return 'small';
  return 'landscape';
}

/** A one-shot request („Alexa, frag Jahresrad, …“): answer and end. */
export const isOneShot = (hi: HandlerInput): boolean =>
  getRequestType(hi.requestEnvelope) === 'IntentRequest' && hi.requestEnvelope.session?.new === true;

// ---------- session state ----------

/** What a „ja“ or „nein“ answers. */
export type Pending =
  | { type: 'launchMenu' }
  | { type: 'anythingElse' }
  | { type: 'festivalMore'; festivalId: string; year: number }
  | { type: 'gardenWeekMore'; start: string; offset: number }
  | { type: 'whichFestival' };

export const getPending = (hi: HandlerInput): Pending | undefined =>
  hi.attributesManager.getSessionAttributes().pending as Pending | undefined;

// ---------- remembered per user ----------

export async function userAttributes(hi: HandlerInput): Promise<UserAttributes> {
  try {
    return (await hi.attributesManager.getPersistentAttributes()) as UserAttributes;
  } catch (err) {
    log('attributes_read_failed', { reason: err instanceof Error ? err.message : 'unknown' });
    return {};
  }
}

export async function saveUserAttributes(hi: HandlerInput, changes: Partial<UserAttributes>): Promise<void> {
  try {
    const current = await userAttributes(hi);
    hi.attributesManager.setPersistentAttributes({ ...current, ...changes });
    await hi.attributesManager.savePersistentAttributes();
  } catch (err) {
    log('attributes_write_failed', { reason: err instanceof Error ? err.message : 'unknown' });
  }
}
