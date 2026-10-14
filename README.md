# Jahresrad — Alexa skill for naturgarten.bio

A German-language Alexa skill that brings the [naturgarten.bio](https://naturgarten.bio)
Jahresrad (wheel of the year) to Echo devices. Each day it tells you where you are in the year:
nature season, moon phase, the next of the eight seasonal festivals, daylight, gardening with
the moon, and fitting garden tasks. On Echo Show devices it shows the wheel with tappable cards.

The skill is public, but usable only by **Gefährten**: approved members of naturgarten.bio, who
link their account through Alexa Account Linking (OAuth 2.0).

> **Status:** version 1 runs on the development stage of the Alexa-hosted skill, with Account
> Linking; tested in the simulator and on a phone. Not yet tested on Echo devices, not yet
> submitted for certification. See [Before publishing](#before-publishing).

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

### Once: tools and the skill

1. **ASK CLI** (needs Node 22 and git): `npm install -g ask-cli`, then `ask configure`. A browser
   opens; sign in with your Amazon developer account (developer.amazon.com). When asked about an
   AWS profile, answer **no**: an Alexa-hosted skill needs none.
2. **Create the skill** in the [developer console](https://developer.amazon.com/alexa/console/ask)
   → *Create Skill*: name „Jahresrad“, locale *German (DE)*, experience *Other* → *Custom*, model
   *Start from scratch*, hosting **Alexa-hosted (Node.js)**, region **EU (Ireland)**. Copy the skill
   id (`amzn1.ask.skill.…`) from the skill list.
3. **Fetch its code**: next to this repo (not inside it),
   `ask init --hosted-skill-id <skill id>`; it asks for a folder name (e.g. `jahresrad-hosted`).
   That folder is the hosted skill's own git repository: `master` deploys the development stage,
   `prod` the live stage (Amazon fills it on certification; never push to it).
   Check its `.gitignore`: `ask init` has been seen to append `skill-package/skill.json` without a
   line break, which leaves both that and `ask-resources.json` unignored.
4. **Account Linking**: copy `skill-package/accountLinking.template.json` to a place outside any
   repo, fill in `OAUTH_ALEXA_CLIENT_ID` / `OAUTH_ALEXA_CLIENT_SECRET` (the values set on Netlify),
   then `ask smapi update-account-linking-info -s <skill id> --account-linking-request file:<copy>`.
   Delete the copy afterwards. Or enter the same values in the console (*Build → Account Linking*).
   The client id is any name (e.g. `alexa-jahresrad`), the secret at least 24 random characters
   (`openssl rand -base64 36`); you generate both, and the same values go to Netlify and Amazon.
5. **Redirect URLs**: the console shows them under *Build → Account Linking* („Alexa Redirect
   URLs“): `https://{pitangui.amazon.com,layla.amazon.com,alexa.amazon.co.jp}/api/skill/link/<vendor id>`.
   Put all three, comma-separated, into `OAUTH_ALEXA_REDIRECT_URIS` on Netlify (scope: Functions);
   production needs a redeploy to pick up the change. Without all three variables there is no OAuth
   client and linking fails.

### Every release of the skill

```bash
npm run verify
npm run deploy:hosted -- <hosted skill folder>
```

`deploy:hosted` (`scripts/deploy-hosted.mjs`) checks that this repo is committed and the hosted
checkout is on `master` and in sync, stages the build (bundle, model, manifest, icons), shows what
changed and asks before it commits and pushes `master` — Amazon builds the development Lambda from
that push. It then imports `skill-package` through SMAPI (the hosted repo ignores `skill.json`, so
the push alone updates neither manifest nor model) and waits for import and Lambda deployment.

`ask deploy` does not work here: for hosted skills ASK CLI 2.30 only prints „use git push“.
`npm run stage:hosted -- <folder>` still exists to stage without deploying.

Right after a deploy or a change to Account Linking, the simulator can answer „This utterance did
not resolve to any intent“ for a few minutes without calling the skill; try again before debugging.

### Testing

- **Screens on every Echo Show size:** in Claude Code, `/screen-check` (skill in
  `.claude/skills/screen-check`). It drives the developer console simulator with Playwright on
  Echo Show 5, 8, 10, 15/21 and 15 upright: launch, every card, garden list and task, help chips,
  the way back — screenshots per step plus a lint for text outside the screen, clipped or cut
  with „…“. Needs a browser logged into the developer console (see the skill).

- Console → *Test* → enable „Development“, type or say „öffne jahresrad“. The simulator shows the
  APL screens for different Echo Show sizes. From the shell:
  `ask smapi simulate-skill -s <skill id> -g development --device-locale de-DE --input-content "öffne jahresrad"`,
  then `ask smapi get-skill-simulation -s <skill id> -g development -i <id>`.
- Link the account first: Alexa app → *More → Skills & Games → Your Skills → Dev* → Jahresrad →
  *Enable* → sign in on naturgarten.bio → *Erlauben*.
- Devices signed in with the same Amazon account get the development version: test on an Echo Show
  and a screenless Echo.
- Logs: console → *Code* → *CloudWatch Logs*. Lines are JSON (`event`, request type, errors).

## Before publishing

The full step-by-step list with checkboxes: [docs/NEXT-STEPS.md](docs/NEXT-STEPS.md).

- [x] Wheel-only images and gardening with the moon are live on naturgarten.bio.
- [x] Icons (108 and 512 px, from the wheel) in `skill-package/assets/images`.
- [x] Terms of use: page `/nutzungsbedingungen` is live (apachler/pacnaturgarten#89, released).
- [x] The „Amazon Alexa“ section on `/privacy` is live.
- [x] A test Gefährten account for Amazon's reviewers (separate account, approved; its password
      only in the certification form).
- [ ] Screens in the console simulator (*Device Display*, all Echo Show sizes) and voice-only in the
      Alexa app; no Echo devices at hand, Amazon tests on devices during certification.

## License

[GPL-3.0](LICENSE). The names „naturgarten.bio“ and „PAC Natur&Garten“, their logos, the skill
icons and the Jahresrad images served by the API are not covered by this license.
