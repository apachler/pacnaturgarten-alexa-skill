# Publishing the skill

**Version 1.0 is live** (certified 15.10.2026; DE, AT, CH). This list records how it got there;
open boxes were skipped or remain optional. For later releases see the README
([Every release of the skill](../README.md#every-release-of-the-skill)); new work is under
[Later](#later-version-11). Commands and background are in the
[README](../README.md#deploying-alexa-hosted).

## 1. Merge what is ready — done

- [x] **Skill PR** [apachler/pacnaturgarten-alexa-skill#1](https://github.com/apachler/pacnaturgarten-alexa-skill/pull/1)
      merged into `main`.
- [x] **Terms PR** [apachler/pacnaturgarten#89](https://github.com/apachler/pacnaturgarten/pull/89)
      merged and released; `https://naturgarten.bio/nutzungsbedingungen` is live.
- [x] Section „Amazon Alexa“ on `https://naturgarten.bio/privacy` is live (checked in the served page code).

## 2. Set up on Amazon (once) — done

- [x] ASK CLI installed and configured (Node 22; no AWS profile).
- [x] Skill created: „Jahresrad“, German (DE), Custom, Alexa-hosted (Node.js), EU (Ireland).
      Skill id: `amzn1.ask.skill.9c0c794a-a5a0-4b9e-b017-8f965bce13b6`
- [x] Hosted code checked out next to this repo: `../jahresrad-hosted` (`master` = development).

## 3. Account Linking — done

- [x] Client `alexa-jahresrad` and secret set on Netlify and in the Alexa console.
- [x] All three Alexa Redirect URLs in `OAUTH_ALEXA_REDIRECT_URIS`; production redeployed.
- [x] Account linked in the Alexa app (Android).

## 4. Deploy — first deploy done; for every release

```bash
git pull && npm ci && npm run verify
npm run deploy:hosted -- ../jahresrad-hosted
```

- [x] Version 1 on the development stage; simulator run of all README examples.
- [x] Fixes from the simulator run deployed (#2–#4): „erzähl mir vom Mond“, friendly „ja“/„nein“,
      deploy script, unambiguous moon turn day.
- [x] API: moon gardening names the next good day when today has no tip
      (apachler/pacnaturgarten#97, released).

## 5. Test (no Echo at hand: console simulator for screens, Android Alexa app for voice)

- [x] Simulator (CLI): all README examples, the three example phrases, open/help/stop/cancel/no,
      unrelated requests twice, „welches Fest“ follow-up, one-shots. Amazon validation: passed.
- [x] Console → *Test* → „Development“ → tick **Device Display**: check the screens for Echo Show 5,
      8/10, 15/21 and Show 15 upright; tap the cards (moon, festival, garden tip) and help chips
      (`/screen-check`, #8–#11).
- [ ] Android Alexa app (speaks only, like a screenless Echo): the same questions by voice; every
      question must work without a screen.
- [ ] Real Echo devices: none available; Amazon tests on devices during certification.
- [x] „Erzähl mir vom Mond“, „erzähl mir von der Sonne“, „ja“ after „Gartenarbeiten der Woche“.
- [ ] Error cases: unlink the account in the profile („Verbundene Apps“) → the skill must answer
      with the linking hint and a card in the Alexa app.
- [ ] Routine: Alexa app → Routines → daily 07:00 → action *Custom*: „frag Jahresrad, was es heute
      gibt“.
- [ ] Problems? Console → *Code* → *CloudWatch Logs* (JSON lines, no ids or tokens).

## 6. Before certification

- [x] **Test Gefährten account** for Amazon's reviewers created and approved. Keep it for every
      later re-certification; its password goes only into the certification form, never into a repo.
- [ ] Check that its profile has a garden place (otherwise reviewers get the location hint).
- [x] Store description says how to become a Gefährte (`naturgarten.bio/netzwerk`, then manual
      approval); testing instructions give reviewers a step-by-step path.
- [ ] Optional: a simplified icon. The 108 px icon from the full wheel is recognisable but
      fine labels blur; replace `skill-package/assets/images/de-DE_smallIconUri.png` (108×108) and
      `de-DE_largeIconUri.png` (512×512) if you make one.

## 7. Submit

- [x] Console → *Distribution*: check name, descriptions, example phrases, icons, privacy and
      terms URLs (all come from `skill-package/skill.json`).
- [x] *Privacy & Compliance*: no purchases, personal info yes (Account Linking), not for children,
      no ads, export compliant.
- [x] *Certification* → *Validation*, fix what it reports, then submit with the testing
      instructions and the test account.
- [x] Submitted 14.10.2026 („Certify and publish now“), approved and published 15.10.2026; DE, AT, CH.
- [ ] Smoke test of the live skill: enable it from the store, link the account, „Alexa, öffne
      Jahresrad“.

## Later (version 1.1)

- Reminders for festivals and full moon (Reminders API, permission prompt, reminder ids in the
  persistent attributes, scope `reminders` in the main repo's OAuth `SCOPES`).
