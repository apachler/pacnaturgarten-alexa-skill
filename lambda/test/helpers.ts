import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { ResponseCache } from '../src/api/cache';
import type { HttpResponse } from '../src/api/transport';
import { config } from '../src/config';
import { deps } from '../src/context';
import { createSkill } from '../src/index';
import { MemoryAdapter } from '../src/persistence';

export const TOKEN = 'ngbat_testgrant_secretvalue123';
export const USER = 'amzn1.ask.account.TESTUSER';
/** 14 October 2026, 07:00 in Vienna — the day the fixtures were generated for. */
export const NOW = Date.parse('2026-10-14T05:00:00Z');

export function fixture<T = unknown>(name: string): T {
  return (JSON.parse(readFileSync(join(__dirname, 'fixtures', `${name}.json`), 'utf8')) as { data: T }).data;
}

export interface Call {
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
}

/** A fake Jahresrad API serving the fixtures. `overrides` replace answers per path. */
export class FakeApi {
  calls: Call[] = [];
  overrides = new Map<string, () => HttpResponse | Promise<HttpResponse>>();
  data = new Map<string, unknown>();

  transport = async (url: string, headers: Record<string, string>): Promise<HttpResponse> => {
    const u = new URL(url);
    const path = u.pathname.replace('/api/v1/jahresrad', '');
    this.calls.push({ path, query: Object.fromEntries(u.searchParams), headers });
    const override = this.overrides.get(path);
    if (override) return override();
    const name =
      path === '/festivals' ? `festivals-${u.searchParams.get('year')}` : path === '/festivals/next' ? 'festivals-next' : path.slice(1).replace('/', '-');
    const data = this.data.has(name) ? this.data.get(name) : fixture(name);
    const etag = `"${name}"`;
    if (headers['If-None-Match'] === etag) return { status: 304, headers: { etag, 'cache-control': 'private, max-age=3600' }, body: '' };
    return { status: 200, headers: { etag, 'cache-control': 'private, max-age=68400' }, body: JSON.stringify({ data, meta: { api_version: 'v1' } }) };
  };

  problem(path: string, status: number, code?: string) {
    this.overrides.set(path, () => ({ status, headers: {}, body: JSON.stringify({ type: 'about:blank', title: 'x', status, code }) }));
  }
}

export function setup() {
  const api = new FakeApi();
  const adapter = new MemoryAdapter();
  let now = NOW;
  deps.transport = api.transport;
  deps.now = () => now;
  deps.timeZone = async () => 'Europe/Vienna';
  deps.cache = new ResponseCache();
  const skill = createSkill(adapter);
  return {
    api,
    adapter,
    advance: (ms: number) => {
      now += ms;
    },
    invoke: (env: RequestEnvelope) => skill.invoke(env) as Promise<ResponseEnvelope>,
  };
}

export interface EnvOptions {
  token?: string | null;
  apl?: boolean;
  viewport?: { w: number; h: number };
  newSession?: boolean;
  attributes?: Record<string, unknown>;
  skillId?: string;
}

export function envelope(request: Record<string, unknown>, o: EnvOptions = {}): RequestEnvelope {
  const token = o.token === null ? undefined : (o.token ?? TOKEN);
  const user = { userId: USER, ...(token ? { accessToken: token } : {}) };
  const application = { applicationId: o.skillId ?? config.skillId };
  const vp = o.viewport ?? { w: 1280, h: 800 };
  return {
    version: '1.0',
    session: { new: o.newSession ?? true, sessionId: 'amzn1.echo-api.session.test', application, user, attributes: o.attributes ?? {} },
    context: {
      System: {
        application,
        user,
        device: {
          deviceId: 'amzn1.ask.device.TEST',
          supportedInterfaces: o.apl ? { 'Alexa.Presentation.APL': { runtime: { maxVersion: '2023.3' } } } : {},
        },
        apiEndpoint: 'https://api.eu.amazonalexa.com',
        apiAccessToken: 'test',
      },
      ...(o.apl ? { Viewport: { pixelWidth: vp.w, pixelHeight: vp.h, shape: 'RECTANGLE', dpi: 160, currentPixelWidth: vp.w, currentPixelHeight: vp.h, experiences: [], keyboard: [], touch: ['SINGLE'], video: {} } } : {}),
    },
    request: { requestId: 'amzn1.echo-api.request.test', timestamp: '2026-10-14T05:00:00Z', locale: 'de-DE', ...request },
  } as unknown as RequestEnvelope;
}

export const launch = () => ({ type: 'LaunchRequest' });

export function intent(name: string, slots: Record<string, { value?: string; id?: string }> = {}) {
  return {
    type: 'IntentRequest',
    dialogState: 'COMPLETED',
    intent: {
      name,
      confirmationStatus: 'NONE',
      slots: Object.fromEntries(
        Object.entries(slots).map(([slot, s]) => [
          slot,
          {
            name: slot,
            confirmationStatus: 'NONE',
            ...(s.value !== undefined ? { value: s.value } : {}),
            ...(s.id
              ? { resolutions: { resolutionsPerAuthority: [{ authority: 'amzn1.er-authority.test', status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { name: s.value ?? s.id, id: s.id } }] }] } }
              : {}),
          },
        ]),
      ),
    },
  };
}

export const userEvent = (...args: string[]) => ({ type: 'Alexa.Presentation.APL.UserEvent', token: 'mainScreen', arguments: args, source: {}, components: {} });

/** The spoken text without the <speak> wrapper. */
export function said(res: ResponseEnvelope): string {
  const out = res.response.outputSpeech as { ssml?: string } | undefined;
  return (out?.ssml ?? '').replace(/^<speak>|<\/speak>$/g, '').replace(/&amp;/g, '&');
}

export function directive(res: ResponseEnvelope): { token: string; document: Record<string, unknown> } | undefined {
  return res.response.directives?.find((d) => d.type === 'Alexa.Presentation.APL.RenderDocument') as never;
}
