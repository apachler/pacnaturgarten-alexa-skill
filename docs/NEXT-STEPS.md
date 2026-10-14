# Next steps to publish the skill

Status on 14.10.2026. Work from top to bottom; tick boxes as you go. Commands and background
are in the [README](../README.md#deploying-alexa-hosted).

## 1. Merge what is ready

- [ ] **Skill PR** [apachler/pacnaturgarten-alexa-skill#1](https://github.com/apachler/pacnaturgarten-alexa-skill/pull/1)
      → review and merge into `main` (CI green).
- [ ] **Terms PR** [apachler/pacnaturgarten#89](https://github.com/apachler/pacnaturgarten/pull/89)
      → read the draft (no legal review yet; check the liability and governing-law sections), open
      the Amazon privacy link once by hand, then squash-merge into `preview`.
- [ ] Look at `https://preview--pacnaturgarten.netlify.app/nutzungsbedingungen` and the new
      section „Amazon Alexa“ on `/privacy` of the preview.

## 2. Set up on Amazon (once)

- [ ] Install the ASK CLI: `npm install -g ask-cli`, then `ask configure` (sign in with the
      developer account; answer **no** to the AWS profile question).
- [ ] Create the skill in the [developer console](https://developer.amazon.com/alexa/console/ask):
      name „Jahresrad“, German (DE), Custom, **Alexa-hosted (Node.js)**, region **EU (Ireland)**.
      Note the skill id: `amzn1.ask.skill.…` → ______________________
- [ ] Fetch its code in an empty folder **outside** this repo:
      `ask init --hosted-skill-id <skill id>`.

## 3. Account Linking

- [ ] Copy `skill-package/accountLinking.template.json` outside any repo, fill in the values of
      `OAUTH_ALEXA_CLIENT_ID` and `OAUTH_ALEXA_CLIENT_SECRET` from Netlify.
- [ ] `ask smapi update-account-linking-info -s <skill id> --account-linking-request file:<copy>`
      (or enter the same values in the console under *Build → Account Linking*). Delete the copy.
- [ ] Copy all „Alexa Redirect URLs“ from *Build → Account Linking* into
      `OAUTH_ALEXA_REDIRECT_URIS` on Netlify (comma-separated). Production picks them up with the
      next deploy.

## 4. First deploy

```bash
cd pacnaturgarten-alexa-skill && git pull && npm ci
npm run verify
npm run stage:hosted -- <hosted skill folder>
cd <hosted skill folder> && git add -A && git commit -m "Jahresrad 1.0" && ask deploy
```

## 5. Test

- [ ] Alexa app → *Skills & Games → Your Skills → Dev* → Jahresrad → enable → sign in on
      naturgarten.bio → *Erlauben*.
- [ ] Console → *Test* → „Development“: „öffne jahresrad“, then every example from the README
      table. Check the screens for Echo Show 5, 8 and 15 in the simulator.
- [ ] On a real Echo Show: daily briefing, tap the cards (moon, festival, garden tip), help chips.
- [ ] On a screenless Echo: the same questions by voice; every question must work without a screen.
- [ ] Error cases: unlink the account in the profile („Verbundene Apps“) → the skill must answer
      with the linking hint and a card in the Alexa app.
- [ ] Routine: Alexa app → Routines → daily 07:00 → action *Custom*: „frag Jahresrad, was es heute
      gibt“.
- [ ] Problems? Console → *Code* → *CloudWatch Logs* (JSON lines, no ids or tokens).
      Report what you saw in a new session.

## 6. Before certification

- [ ] **Release** `pacnaturgarten` (`preview` → `main`) so `/nutzungsbedingungen` and the new
      privacy section are live; bundle it with the Netlify redeploy for the redirect URLs.
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
