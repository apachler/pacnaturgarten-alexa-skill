import { getIntentName, getRequestType, getSlot, getSlotValue, type ErrorHandler, type HandlerInput, type RequestHandler } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import { errorScreen, helpScreen, mainScreen } from '../apl/screens';
import { ApiError } from '../api/errors';
import { festivalInfoAnswer, festivalKey, festivalMoreAnswer, nextFestivalAnswer } from '../answers/festival';
import { gardenTodayAnswer, gardenWeekAnswer, taskAnswer } from '../answers/garden';
import { moonAnswer, moonGardenAnswer } from '../answers/moon';
import { daylightAnswer, seasonAnswer } from '../answers/nature';
import { dayAnswer, todayAnswer } from '../answers/today';
import { apiFor, getPending, viewportKind } from '../context';
import { log } from '../log';
import { respond, type Answer } from '../respond';
import { T } from '../speech/texts';

type Produce = (hi: HandlerInput) => Promise<Answer> | Answer;

const forRequest = (type: string, produce: Produce): RequestHandler => ({
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === type,
  handle: async (hi) => respond(hi, await produce(hi)),
});

const forIntent = (names: string[], produce: Produce): RequestHandler => ({
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'IntentRequest' && names.includes(getIntentName(hi.requestEnvelope)),
  handle: async (hi) => respond(hi, await produce(hi)),
});

/** Entity-resolved slot id, if Alexa matched a value of the custom type. */
function slotId(hi: HandlerInput, name: string): string | undefined {
  const authorities = getSlot(hi.requestEnvelope, name)?.resolutions?.resolutionsPerAuthority ?? [];
  const match = authorities.find((a) => a.status.code === 'ER_SUCCESS_MATCH');
  return match?.values?.[0]?.value?.id;
}

const festivalFromSlot = (hi: HandlerInput) => {
  const id = slotId(hi, 'festival');
  return festivalKey(id ?? getSlotValue(hi.requestEnvelope, 'festival'));
};

const helpAnswer = (hi: HandlerInput): Answer => ({
  speech: T.help,
  screen: helpScreen(viewportKind(hi)),
  ask: { question: T.helpQuestion, reprompt: T.reprompt },
});

const goodbye: Answer = { speech: T.goodbye, end: true };

// ---------- the skill's own intents ----------

const launch = forRequest('LaunchRequest', (hi) => todayAnswer(hi, { launch: true }));
const today = forIntent(['TodayIntent'], (hi) => todayAnswer(hi, { launch: false }));
const nextFestival = forIntent(['NextFestivalIntent'], nextFestivalAnswer);
const festivalInfo = forIntent(['FestivalInfoIntent'], (hi) => festivalInfoAnswer(hi, festivalFromSlot(hi)));
const moon = forIntent(['MoonIntent'], (hi) => moonAnswer(hi, slotId(hi, 'moonEvent')));
const moonGarden = forIntent(['MoonGardenIntent'], moonGardenAnswer);
const daylight = forIntent(['DaylightIntent'], daylightAnswer);
const gardenToday = forIntent(['GardenTodayIntent'], gardenTodayAnswer);
const gardenWeek = forIntent(['GardenWeekIntent'], (hi) => gardenWeekAnswer(hi));
const season = forIntent(['SeasonIntent'], seasonAnswer);
const day = forIntent(['DayIntent'], (hi) => dayAnswer(hi, getSlotValue(hi.requestEnvelope, 'date')));

// ---------- built-in intents ----------

const help = forIntent(['AMAZON.HelpIntent'], helpAnswer);
const stop = forIntent(['AMAZON.StopIntent', 'AMAZON.CancelIntent'], () => goodbye);

const navigateHome = forIntent(['AMAZON.NavigateHomeIntent'], async (hi) => {
  const { data } = await (await apiFor(hi)).today();
  return { speech: 'Hier ist das Jahresrad von heute.', screen: mainScreen(data, viewportKind(hi)) };
});

/** „Das habe ich nicht verstanden“; after two in a row, the help. */
const fallback: RequestHandler = {
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'IntentRequest' && getIntentName(hi.requestEnvelope) === 'AMAZON.FallbackIntent',
  handle: (hi) => fallbackResponse(hi),
};

function fallbackResponse(hi: HandlerInput): Response {
  const count = Number(hi.attributesManager.getSessionAttributes().fallbacks ?? 0) + 1;
  if (count >= 2) return respond(hi, helpAnswer(hi));
  const response = respond(hi, { speech: T.fallback, ask: { question: '', reprompt: T.reprompt } });
  hi.attributesManager.setSessionAttributes({ ...hi.attributesManager.getSessionAttributes(), fallbacks: count });
  return response;
}

const yes: RequestHandler = {
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'IntentRequest' && getIntentName(hi.requestEnvelope) === 'AMAZON.YesIntent',
  handle: async (hi) => {
    const pending = getPending(hi);
    switch (pending?.type) {
      case 'launchMenu':
      case 'anythingElse':
        return respond(hi, { speech: '', ask: { question: T.whatThen, reprompt: T.reprompt } });
      case 'festivalMore':
        return respond(hi, await festivalMoreAnswer(hi, pending.festivalId, pending.year));
      case 'gardenWeekMore':
        return respond(hi, await gardenWeekAnswer(hi, pending.start, pending.offset));
      case 'whichFestival':
        return respond(hi, { speech: '', ask: { question: T.whichFestival, pending } });
      default:
        // A „ja“ nobody asked for (e.g. after a list that ended without a question): take it kindly.
        return respond(hi, { speech: T.gladly, ask: { question: T.whatThen, reprompt: T.reprompt } });
    }
  },
};

/** „Nein“ ends kindly, whether or not a question was pending. */
const no: RequestHandler = {
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'IntentRequest' && getIntentName(hi.requestEnvelope) === 'AMAZON.NoIntent',
  handle: (hi) => respond(hi, { speech: `${T.okay} ${T.goodbye}`, end: true }),
};

// ---------- touch (APL UserEvent) ----------

const TOUCH: Record<string, (hi: HandlerInput, param?: string, extra?: string) => Promise<Answer> | Answer> = {
  today: (hi) => todayAnswer(hi, { launch: false }),
  season: seasonAnswer,
  moon: (hi) => moonAnswer(hi),
  moonGarden: moonGardenAnswer,
  festival: (hi, id) => (festivalKey(id) ? festivalInfoAnswer(hi, festivalKey(id)) : nextFestivalAnswer(hi)),
  imbolc: (hi) => festivalInfoAnswer(hi, 'imbolc'),
  daylight: daylightAnswer,
  gardenToday: gardenTodayAnswer,
  gardenWeek: (hi) => gardenWeekAnswer(hi),
  task: (hi, id, view) => taskAnswer(hi, id ?? '', view === 'today' ? 'today' : 'week'),
};

const touch: RequestHandler = {
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'Alexa.Presentation.APL.UserEvent',
  handle: async (hi) => {
    const args = ((hi.requestEnvelope.request as { arguments?: unknown[] }).arguments ?? []).map(String);
    let [, target, param, extra] = args;
    if (target === 'say') [target, param] = [param, undefined];
    const produce = target ? TOUCH[target] : undefined;
    if (!produce) return respond(hi, { speech: '', end: true });
    const answer = await produce(hi, param, extra);
    // A tap answers and stays quiet: no „Möchtest du noch etwas wissen?“ after every touch.
    return respond(hi, answer.ask ? answer : { ...answer, end: true });
  },
};

// ---------- lifecycle ----------

const sessionEnded: RequestHandler = {
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'SessionEndedRequest',
  handle: (hi) => {
    const req = hi.requestEnvelope.request as { reason?: string; error?: { type?: string; message?: string } };
    if (req.reason === 'ERROR') log('session_error', { type: req.error?.type ?? null, message: req.error?.message ?? null });
    return hi.responseBuilder.getResponse();
  },
};

/** Forget everything about the user when they disable the skill. */
const skillDisabled: RequestHandler = {
  canHandle: (hi) => getRequestType(hi.requestEnvelope) === 'AlexaSkillEvent.SkillDisabled',
  handle: async (hi) => {
    try {
      await hi.attributesManager.deletePersistentAttributes?.();
      log('attributes_deleted');
    } catch (err) {
      log('attributes_delete_failed', { reason: err instanceof Error ? err.message : 'unknown' });
    }
    return hi.responseBuilder.getResponse();
  },
};

// ---------- errors ----------

export const errorHandler: ErrorHandler = {
  canHandle: () => true,
  handle: (hi, error) => {
    const kind = getRequestType(hi.requestEnvelope);
    const intent = kind === 'IntentRequest' ? getIntentName(hi.requestEnvelope) : null;
    if (error instanceof ApiError) {
      log('api_failure', { kind: error.kind, status: error.status ?? null, code: error.code ?? null, request: kind, intent });
      switch (error.kind) {
        case 'unlinked':
          return respond(hi, { speech: T.unlinked, card: { kind: 'linkAccount' }, end: true });
        case 'not_companion':
          return respond(hi, { speech: T.notCompanion, card: { kind: 'simple', title: 'Jahresrad', content: T.notCompanionCard }, end: true });
        case 'unavailable':
          return respond(hi, {
            speech: T.unavailable,
            screen: errorScreen(viewportKind(hi), 'Das Jahresrad ist gerade nicht erreichbar.', 'Bitte versuch es später noch einmal.'),
            end: true,
          });
        default:
          return respond(hi, { speech: T.failed, end: true });
      }
    }
    log('handler_error', { message: error instanceof Error ? error.message : String(error), request: kind, intent });
    return respond(hi, { speech: T.failed, end: true });
  },
};

export const requestHandlers: RequestHandler[] = [
  launch,
  today,
  nextFestival,
  festivalInfo,
  moon,
  moonGarden,
  daylight,
  gardenToday,
  gardenWeek,
  season,
  day,
  help,
  stop,
  navigateHome,
  yes,
  no,
  fallback,
  touch,
  sessionEnded,
  skillDisabled,
];
