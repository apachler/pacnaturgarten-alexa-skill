# Next steps to publish the skill

Status on 14.10.2026. Work from top to bottom; tick boxes as you go. Commands and background
are in the [README](../README.md#deploying-alexa-hosted).

## 1. Merge what is ready — done

- [x] **Skill PR** [apachler/pacnaturgarten-alexa-skill#1](https://github.com/apachler/pacnaturgarten-alexa-skill/pull/1)
      merged into `main`.
- [x] **Terms PR** [apachler/pacnaturgarten#89](https://github.com/apachler/pacnaturgarten/pull/89)
      merged and released; `https://naturgarten.bio/nutzungsbedingungen` is live.
- [ ] Look at the section „Amazon Alexa“ on `https://naturgarten.bio/privacy` in a browser.

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
- [ ] Deploy the fixes from the simulator run (PR „fix/v1-feedback“: „erzähl mir vom Mond“,
      friendly „ja“/„nein“, deploy script) after merging.
- [ ] API: moon gardening names the next good day when today has no tip (PR in
      `apachler/pacnaturgarten`, released to `main`). No skill change needed.

## 5. Test on devices (after the fixes are deployed)

- [ ] Console → *Test* → „Development“: check the screens for Echo Show 5, 8 and 15.
- [ ] On a real Echo Show: daily briefing, tap the cards (moon, festival, garden tip), help chips.
- [ ] On a screenless Echo: the same questions by voice; every question must work without a screen.
- [ ] „Erzähl mir vom Mond“, „erzähl mir von der Sonne“, „ja“ after „Gartenarbeiten der Woche“.
- [ ] Error cases: unlink the account in the profile („Verbundene Apps“) → the skill must answer
      with the linking hint and a card in the Alexa app.
- [ ] Routine: Alexa app → Routines → daily 07:00 → action *Custom*: „frag Jahresrad, was es heute
      gibt“.
- [ ] Problems? Console → *Code* → *CloudWatch Logs* (JSON lines, no ids or tokens).

## 6. Before certification

- [ ] Create a **test Gefährten account** for Amazon's reviewers (e.g.
      `alexa-review@naturgarten.bio`), approve it as Gefährte, set a garden place in its profile.
      Its password goes only into the certification form, never into a repo.
- [ ] Optional: a simplified icon. The 108 px icon from the full wheel is recognisable but
      fine labels blur; replace `skill-package/assets/images/de-DE_smallIconUri.png` (108×108) and
      `de-DE_largeIconUri.png` (512×512) if you make one.

## 7. Submit

- [ ] Console → *Distribution*: check name, descriptions, example phrases, icons, privacy and
      terms URLs (all come from `skill-package/skill.json`).
- [ ] *Privacy & Compliance*: no purchases, personal info yes (Account Linking), not for children,
      no ads, export compliant.
- [ ] *Certification* → *Validation*, fix what it reports, then submit with the testing
      instructions and the test account.
- [ ] After approval: publish; availability DE, AT, CH.

## Later (version 1.1)

- Reminders for festivals and full moon (Reminders API, permission prompt, reminder ids in the
  persistent attributes, scope `reminders` in the main repo's OAuth `SCOPES`).
