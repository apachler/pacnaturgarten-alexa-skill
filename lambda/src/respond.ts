import type { HandlerInput } from 'ask-sdk-core';
import type { Response } from 'ask-sdk-model';
import type { Screen } from './apl/screens';
import { isOneShot, supportsApl, type Pending } from './context';
import { escapeSsml, speak } from './speech/format';
import { T } from './speech/texts';

/**
 * What a handler wants to say and show. `respond()` turns it into an Alexa response and decides
 * how the session goes on:
 *  - `ask`: a question; the session stays open with a reprompt, `pending` says what „ja“ means;
 *  - `end`: the conversation is over (stop, errors, one-shot answers);
 *  - neither: one-shot requests end, answers inside a conversation ask „Möchtest du noch etwas
 *    wissen?“ so there is never a dead end.
 *
 * Ending with a screen leaves `shouldEndSession` unset: the Echo Show keeps the screen without
 * listening. Without a screen the session ends explicitly.
 */
export interface Answer {
  speech: string;
  screen?: Screen;
  card?: { kind: 'linkAccount' } | { kind: 'simple'; title: string; content: string };
  ask?: { question: string; reprompt?: string; pending?: Pending };
  end?: boolean;
}

export function respond(hi: HandlerInput, a: Answer): Response {
  const rb = hi.responseBuilder;
  const session = hi.attributesManager.getSessionAttributes();
  delete session.pending;
  session.fallbacks = 0;

  let ask = a.ask;
  if (!ask && !a.end && !isOneShot(hi)) ask = { question: T.anythingElse, reprompt: T.reprompt, pending: { type: 'anythingElse' } };

  rb.speak(escapeSsml(speak(a.speech, ask?.question)));

  let rendered = false;
  if (a.screen && supportsApl(hi)) {
    rb.addDirective({
      type: 'Alexa.Presentation.APL.RenderDocument',
      token: a.screen.token,
      document: a.screen.document,
    } as never);
    rendered = true;
  }

  if (a.card?.kind === 'linkAccount') rb.withLinkAccountCard();
  else if (a.card?.kind === 'simple') rb.withSimpleCard(a.card.title, a.card.content);

  if (ask) {
    rb.reprompt(escapeSsml(ask.reprompt ?? ask.question));
    if (ask.pending) session.pending = ask.pending;
  } else if (!rendered) {
    rb.withShouldEndSession(true);
  }
  hi.attributesManager.setSessionAttributes(session);
  return rb.getResponse();
}
