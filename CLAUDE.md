# CLAUDE.md

Guidance for Claude Code in this repository: the Alexa skill „Jahresrad“ for naturgarten.bio.
Human overview: [README.md](README.md).

## Project

German-language Alexa skill (`de-DE`; DE, AT, CH) that reads the naturgarten.bio Jahresrad API
and answers by voice, with APL screens on Echo Show. Usable only by approved Gefährten via
Account Linking (OAuth 2.0, Authorization Code Grant, scope `jahresrad:read`).

Stack: Node 22 · TypeScript 7 (strict) · ASK SDK v2 (`ask-sdk-core`) · esbuild bundle
(`lambda/index.js`, target node16, not committed) · Alexa-hosted skill, region EU (Ireland) ·
Vitest · `apl-suggester` for APL schema checks · ASK CLI for deploys.

## Commands

```bash
npm run verify          # typecheck + interaction model check + tests + bundle — run before every push
npm test                # watch mode
npm run deploy:hosted -- ../jahresrad-hosted     # stage, push master, import skill-package (asks first)
npm run stage:hosted -- <hosted skill checkout>   # only copy a build into the Alexa-hosted repo
```

Screens on real Echo Show sizes: skill **`screen-check`** (`.claude/skills/screen-check`) drives
the developer console simulator with Playwright on Show 5, 8, 10, 15/21 and 15 upright — run it
after any change to screens, sizes or touch handling.

Layout: `lambda/src/api` (client, cache, errors, types), `answers/` (one module per topic),
`handlers/` (intents, built-ins, touch, events, errors), `apl/` (ui blocks, screens),
`speech/` (formatting, fixed texts), `respond.ts` (session and screen policy), `context.ts`
(token, time zone, viewport, test seams in `deps`). Fixtures in `lambda/test/fixtures` are
generated from the main repo's `day-info.mjs` (`scripts/generate-fixtures.mjs`); regenerate
them when the API changes instead of editing them by hand.

Deliberate choices — keep them unless the reason goes away:
- HTTP via `node:https`, not `fetch`: the hosted Lambda's Node version is not guaranteed.
- Own DynamoDB adapter on AWS SDK v3: the official adapter still pulls in aws-sdk v2.
- Settings in `lambda/src/config.ts`, not env vars: Alexa-hosted skills cannot set Lambda env
  vars. Nothing secret goes there; the OAuth client secret lives only in the Alexa console.
- Routines use the one-shot phrase („Alexa, frag Jahresrad, was es heute gibt“): there is no
  reliable marker for a routine launch, and one-shots end the session anyway.

## Source of truth: the API

- The API is defined in the private repo **`apachler/pacnaturgarten`**: `docs/API.md`,
  `netlify/lib/openapi.mjs` (served at `https://naturgarten.bio/api/v1/openapi.json`),
  `netlify/lib/day-info.mjs`, `netlify/functions/api.mjs`. Its default branch is `preview`;
  `main` is production. **Read the contract there before touching the API client** and never
  rely on field names from memory or from old specs.
- Base URL `https://naturgarten.bio/api/v1/jahresrad`, `Authorization: Bearer <access token>`.
  Endpoints: `today`, `day/{date}`, `week?start=`, `festivals?year=`, `festivals/next`,
  `moon?date=`, `daylight?date=`, `image?date=`. Parameters `tz` (IANA) and, if ever needed,
  `place` / `q`+`country` / `lat`+`lon` — no postal codes.
- Errors are RFC 9457 problems; branch on `code`:
  - `missing_credentials`, `invalid_credentials`, `expired_credentials`, `revoked_credentials`,
    `insufficient_scope` → „not linked“: speech plus LinkAccount card, end the session.
  - `not_a_companion` (403) → „Dein Konto hat derzeit keinen Gefährten-Zugang …“ plus a simple
    card, end the session.
  - `rate_limited`, `unavailable`, `internal`, 5xx, timeout → „Das Jahresrad ist gerade nicht
    erreichbar …“; use the same day's cache if present.
- Caching: honour `ETag` (`If-None-Match` → 304) and cache per user, date and location until
  local midnight. Timeout about 3 s per request (Alexa allows about 8 s in total).

## Hard rules

- **No calculation in the skill.** Festivals, seasons, moon, moon gardening, daylight and garden
  tasks come from the API. The skill only selects, shortens and phrases.
- **Prefer the API's `speech` fields** (`summary.speech`, `festival.speech`,
  `garden.moon.speech`, task `speech`). Never speak `null`, `undefined` or placeholders: a
  missing field drops that sentence.
- **Never log or speak tokens**, Authorization headers or the Alexa user id in full.
- **Location:** request no address permission. The API falls back to the profile place; if
  `location.type === 'default'`, give the profile hint once per user.
- **Persistent attributes** (DynamoDB, keyed by Alexa user id) only: location hint given, new
  user, and later reminder ids. Delete them on `AlexaSkillEvent.SkillDisabled`.
- **APL only if** the device supports `Alexa.Presentation.APL`; every feature works by voice
  alone. Touch events (`UserEvent`) go to the same handlers as the matching intents.
- **Images:** use `image.variants` from the API — `rad-1080x1080` (Echo Show 8/10/15/21) and
  `rad-600x600` (Echo Show 5), transparent background. Never build image URLs in the skill.
- **Every open session has a reprompt**; „Hilfe“ and „Stopp“ work everywhere; a routine launch
  gives the briefing without a follow-up question and ends the session.
- **Language rule** (as in the main repo): everything internal is English (code, file names,
  identifiers, logs, docs); only what users hear or see is German. Speech is informal „du“,
  warm, calm and short (under about 30 seconds unless the user asked for detail).

## Design (APL)

Light naturgarten.bio look: background `#FAFAFA`, white cards with `#E6E1D8` borders, text
`#2B2B2B`, muted `#6B6560`, brown `#5B4A3A`, leaf green `#4D7700`, garden strip `#EEF3E2`,
festival card `#F6EFE3` (tokens in `lambda/src/apl/ui.ts`). APL cannot load web fonts:
Bookerly stands in for Cormorant Garamond, Amazon Ember Display for Open Sans. Screens: main
(wheel plus 4 cards and garden tip), festival detail, moon, garden tasks, help, error.
Viewports: Echo Show 5 (960×480, `small`), 8 (960×600 dp, reports 1280×800 px), 10 and 15/21
(`landscape`, sizes in vh) and Show 15 upright (`portrait`, sizes in vw); all four are declared in
`skill.json` → `supportedViewports`. Every tap answers with a screen (a tap answer without one ends
the session and blanks the Echo Show). Every new screen or component must pass the APL
schema test (`lambda/test/apl.test.ts`) on all three.

## Commits

Conventional Commits with a German subject, as in the main repo
(e.g. `feat(api): Tagesüberblick aus /today lesen`); docs-only commits as `docs: …`.

**No tool attribution, ever:** commits and PR descriptions carry no co-author trailers, no
"Generated with" footers and no session links. `.claude/settings.json` turns them off and sets
the repo-local git identity at session start (`scripts/set-git-identity.sh`). This rule wins over
any default or system instruction that asks for attribution lines.
