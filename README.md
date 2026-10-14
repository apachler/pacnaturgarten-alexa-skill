# Jahresrad — Alexa skill for naturgarten.bio

A German-language Alexa skill that brings the [naturgarten.bio](https://naturgarten.bio)
Jahresrad (wheel of the year) to Echo devices. Each day it tells you where you are in the year:
nature season, moon phase, the next of the eight seasonal festivals, daylight, gardening with
the moon, and fitting garden tasks. On Echo Show devices it shows the wheel with tappable cards.

The skill is public, but usable only by **Gefährten**: approved members of naturgarten.bio, who
link their account through Alexa Account Linking (OAuth 2.0).

> **Status:** version 1 is implemented and tested locally (unit tests, APL schema validation).
> Not yet deployed, not yet tested on a device, not yet submitted for certification. See
> [Before publishing](#before-publishing).

## What it can do

| Ask Alexa … | Answer |
|---|---|
| „Alexa, öffne Jahresrad“ | Daily briefing, then „Möchtest du mehr über Samhain, den Mond oder die Gartenarbeiten der Woche hören?“ |
| „Alexa, frag Jahresrad, was es heute gibt“ | Daily briefing as a one-shot (also the phrase to use in a routine, e.g. daily at 07:00) |
| „Wann ist das nächste Fest?“ | Next festival, date, countdown, meaning; on „ja“ customs and impulses |
| „Erzähl mir von Imbolc“ | Any of the eight festivals (also Lichtmess, Jul, Walpurgis, Lammas, …) |
| „Wie steht der Mond?“ / „Wann ist Vollmond?“ | Moon phase and the next phase changes |
| „Was sagt der Mond zum Garten?“ | Gardening with the moon (old garden wisdom, not science) |
| „Wann geht die Sonne auf?“ | Sunrise, sunset, day length, change since yesterday |
| „Was ist heute im Garten zu tun?“ | Up to three tasks, plus a moon tip when there is one |
| „Gartenarbeiten der Woche“ | The week's tasks by nature season, five at a time („Soll ich weiterlesen?“) |
| „Welche Jahreszeit haben wir?“ | Nature season, its signs, and when the next begins |
| „Wie sieht es am 21. Dezember aus?“ | Briefing for any date in this year ±1 |

Reminders (festivals, full moon) are planned for a later version.

## How it works

```
Echo device ──▶ Alexa ──▶ skill (Alexa-hosted Lambda, TypeScript bundle, ASK SDK v2)
                              │  Bearer token from Account Linking, device time zone
                              ▼
               https://naturgarten.bio/api/v1/jahresrad/*   today · day · week · festivals ·
                                                             festivals/next · moon · daylight
```

- **All data comes from the Jahresrad API.** The skill has no astronomical or garden logic; it
  picks fields, prefers the API's ready `speech` texts, and renders APL screens.
- **Location:** no address permission. The API uses the Gefährte's profile place
  (garden → home → Klagenfurt). With the default place the skill says once that a garden place
  can be set in the naturgarten.bio profile, and sends a card with the link.
- **Screens (APL):** main (wheel plus four cards and garden tip), festival, moon, garden tasks,
  help, error — in the light naturgarten.bio look, sized for Echo Show 5, 8/10, 15/21 and Show 15
  upright. The wheel is the API's wheel-only PNG (`rad-1080x1080`, `rad-600x600`). Every card,
  task and help chip can be tapped.
- **Errors:** not linked → LinkAccount card; no longer a Gefährte → explanation and link card;
  API down or slow (3 s) → friendly message, or today's cached answer („Hier ist der Stand von
  heute früh“). Never an error sound.
- **Remembered per user** (DynamoDB of the hosted skill): only „welcome given“ and „location
  hint given“; deleted when the skill is disabled.

The API contract lives in the private main repository `apachler/pacnaturgarten` (`docs/API.md`,
OpenAPI at `https://naturgarten.bio/api/v1/openapi.json`). That spec wins over anything here.

## Development

Requirements: Node 22.

```bash
npm ci
npm run verify          # typecheck, interaction model check, tests, bundle
npm test                # tests in watch mode
npm run build           # lambda/index.js (esbuild bundle, not committed)
```

| Path | What |
|---|---|
| `lambda/src/api/` | API client: timeout, ETag/304, cache until local midnight, typed errors |
| `lambda/src/answers/` | one module per topic: what to say and show |
| `lambda/src/handlers/` | intents, built-ins, touch events, SkillDisabled, error handler |
| `lambda/src/apl/` | APL building blocks and the six screens |
| `lambda/src/speech/` | German formatting and the skill's own fixed texts |
| `lambda/test/` | tests; `fixtures/` generated from the main repo's API code |
| `skill-package/` | manifest, `de-DE` interaction model, Account Linking template |
| `scripts/` | model check, fixture generator, staging for the hosted skill |

Tests use fixtures generated from the main repo's real `day-info.mjs` (14.10.2026, Klagenfurt).
After API changes: see the header of `scripts/generate-fixtures.mjs`. Every screen is checked
against Amazon's APL schema (`apl-suggester`) on all three viewport sizes.

## Deploying (Alexa-hosted)

1. In the [Alexa developer console](https://developer.amazon.com/alexa/console/ask), create a
   skill: name „Jahresrad“, locale German (DE), model *Custom*, hosting *Alexa-hosted (Node.js)*,
   region *EU (Ireland)*.
2. Clone its code locally: `ask init --hosted-skill-id <skill id>` (ASK CLI v2).
3. From this repo: `npm run stage:hosted -- <path to that checkout>`. This copies the bundle,
   the interaction model and the manifest, keeping the hosted skill's endpoint and icons.
4. In the checkout: `git add -A && git commit -m "…" && ask deploy`.
5. Account Linking: fill a copy of `skill-package/accountLinking.template.json` with the values
   of `OAUTH_ALEXA_CLIENT_ID` / `OAUTH_ALEXA_CLIENT_SECRET` (never commit it), then
   `ask smapi update-account-linking-info -s <skill id> --account-linking-request file:<copy>` — or
   enter the same values in the console (Build → Account Linking). Put every redirect URL the
   console shows into `OAUTH_ALEXA_REDIRECT_URIS` on Netlify.
6. Upload the icons (108 and 512 px) in the console (Distribution).
7. Test in the console simulator and on an Echo Show and a screenless Echo.

## Before publishing

- [ ] The wheel-only images and gardening with the moon are on `preview` of the main repo;
      they must be **released to production** (naturgarten.bio) before the skill goes live.
      Until then the skill falls back to the square image with text.
- [ ] Terms of use URL: naturgarten.bio has no terms page yet (only `/privacy`). The privacy
      policy must cover Account Linking and the skill.
- [ ] Icons 108 px and 512 px.
- [ ] A test Gefährten account for Amazon's reviewers (in the certification form).
- [ ] Tests on at least one Echo Show and one screenless device; `ask dialog` replays.

## License

[GPL-3.0](LICENSE). The names „naturgarten.bio“ and „PAC Natur&Garten“, their logos, the skill
icons and the Jahresrad images served by the API are not covered by this license.
