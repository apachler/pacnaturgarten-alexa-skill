# Jahresrad — Alexa skill for naturgarten.bio

A German-language Alexa skill that brings the [naturgarten.bio](https://naturgarten.bio)
Jahresrad (wheel of the year) to Echo devices. Each day it tells you where you are in the year:
nature season, moon phase, the next of the eight seasonal festivals, daylight, and fitting
garden tasks. On Echo Show devices it shows the wheel with tappable cards.

The skill is public, but usable only by **Gefährten**: approved members of naturgarten.bio, who
link their account through Alexa Account Linking (OAuth 2.0).

> **Status:** planning done, implementation starting. Nothing is published yet.

## What it can do

| Ask Alexa … | Answer |
|---|---|
| „Alexa, öffne Jahresrad“ / „Was gibt’s heute?“ | Daily briefing (also as a routine, e.g. daily at 07:00) |
| „Wann ist das nächste Fest?“ | Next festival, date, countdown, meaning |
| „Erzähl mir von Imbolc“ | Any of the eight festivals |
| „Wie steht der Mond?“ / „Wann ist Vollmond?“ | Moon phase and the next phase changes |
| „Was sagt der Mond zum Garten?“ | Gardening with the moon (old garden wisdom) |
| „Wann geht die Sonne auf?“ | Sunrise, sunset, day length |
| „Was ist heute im Garten zu tun?“ / „Gartenarbeiten der Woche“ | Garden tasks for today or the week |
| „Welche Jahreszeit haben wir?“ | Nature season with indicator plants |
| „Wie sieht es am 21. Dezember aus?“ | Short briefing for any date (this year ±1) |

Reminders (festivals, full moon) are planned for a later version.

## How it works

```
Echo device ──▶ Alexa ──▶ skill backend (Alexa-hosted, Node.js/TypeScript, ASK SDK v2)
                              │  Bearer token from Account Linking
                              ▼
               https://naturgarten.bio/api/v1/jahresrad/*   (today, day, week, festivals,
                                                             moon, daylight, image)
```

- **All data comes from the Jahresrad API.** The skill has no astronomical or garden logic of
  its own; it picks fields, phrases short answers and renders APL screens.
- **Location:** the skill asks for no address permission. The API uses the Gefährte's profile
  place (garden → home → Klagenfurt). If only the default place is known, the skill says once
  that a garden place can be set in the naturgarten.bio profile.
- **Images:** the wheel-only PNGs from the API (`rad-1080x1080`, `rad-600x600`, transparent),
  so the skill sets the text itself, sized per device.
- **Look:** the light naturgarten.bio style (Cormorant Garamond, Open Sans, off-white, brown and
  leaf green).

The API contract lives in the private main repository `apachler/pacnaturgarten`
(`docs/API.md`, OpenAPI at `https://naturgarten.bio/api/v1/openapi.json`). That spec wins over
anything written here.

## Devices

- Echo Show 5, 8, 10, 15 (also portrait), 21: voice plus APL screens
- Echo, Echo Dot and other screenless devices: voice only, all features
- Language `de-DE`; marketplaces Germany, Austria, Switzerland

## Development

Setup instructions follow with the first code. Planned layout:

```
skill-package/      manifest, de-DE interaction model, APL documents
lambda/src/
  api/              API client (timeout, ETag, cache to local midnight, typed errors)
  handlers/         one file per intent, plus UserEvent, SkillDisabled, errors
  speech/           the few texts the skill composes itself
  apl/              data sources for the screens
lambda/test/        unit tests with API fixtures (Vitest)
```

## License

[GPL-3.0](LICENSE). The names „naturgarten.bio“ and „PAC Natur&Garten“, their logos, the skill
icons and the Jahresrad images served by the API are not covered by this license.
