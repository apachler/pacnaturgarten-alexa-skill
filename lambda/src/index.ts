/**
 * Alexa skill „Jahresrad“ for naturgarten.bio. Entry point of the Lambda bundle
 * (lambda/index.js, handler `index.handler`).
 */
import { DefaultApiClient, getIntentName, getRequestType, SkillBuilders, type PersistenceAdapter, type RequestInterceptor } from 'ask-sdk-core';
import { config } from './config';
import { errorHandler, requestHandlers } from './handlers';
import { log } from './log';
import { defaultAdapter } from './persistence';

/** Request type and intent only — never ids or tokens. */
const logRequest: RequestInterceptor = {
  process(hi) {
    const type = getRequestType(hi.requestEnvelope);
    log('request', { type, intent: type === 'IntentRequest' ? getIntentName(hi.requestEnvelope) : null, newSession: hi.requestEnvelope.session?.new ?? null });
  },
};

export function createSkill(adapter: PersistenceAdapter = defaultAdapter()) {
  return SkillBuilders.custom()
    .withSkillId(config.skillId)
    .addRequestHandlers(...requestHandlers)
    .addErrorHandlers(errorHandler)
    .addRequestInterceptors(logRequest)
    .withPersistenceAdapter(adapter)
    .withApiClient(new DefaultApiClient())
    .withCustomUserAgent('jahresrad-skill/1.0')
    .create();
}

const skill = createSkill();

export const handler = (event: unknown, context: unknown) => skill.invoke(event as never, context as never);
