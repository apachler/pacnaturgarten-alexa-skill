---
name: screen-check
description: Visual check of every Jahresrad APL screen on every Echo Show form factor (Show 5, 8, 10, 15/21, 15 upright) in the Alexa developer console simulator, driven by Playwright — real skill, real API data, real taps, screenshots plus an automatic lint for text outside the screen or clipped. Use after any change to screens, sizes or touch handling, before certification, or when the user asks whether the skill looks right on all devices.
---

# Screen check across Echo Show form factors

Tests the **deployed development stage** of the skill in the developer console simulator
(*Test* → *Device Display*), one device after the other, and reviews every screen. The schema
test (`lambda/test/apl.test.ts`) only checks structure; layout problems (mid-word breaks, text
cut off, white page after a tap) only show here.

## 0. Prerequisites

1. **Browser tools:** the MCP server `playwright-chromium` (Playwright's own Chromium; a snap
   Chromium does not work). If `/mcp` does not list it:
   ```bash
   claude mcp add --scope user playwright-chromium -- npx -y @playwright/mcp@latest --browser chromium
   npx -y @playwright/mcp@latest install-browser chrome-for-testing
   ```
   then restart Claude Code. Its tools are deferred: load them with ToolSearch
   (`+playwright-chromium`), at least `browser_navigate`, `browser_run_code_unsafe`.
2. **Logged in:** navigate to
   `https://developer.amazon.com/alexa/console/ask/test/amzn1.ask.skill.9c0c794a-a5a0-4b9e-b017-8f965bce13b6/development/de_DE/`.
   If it lands on Amazon's sign-in page, the **user** logs in in that window (two-factor,
   CAPTCHA); never type credentials yourself. The profile keeps the login.
3. **The version to test is deployed:** `npm run deploy:hosted -- ../jahresrad-hosted` (asks
   before pushing; only the development stage). SMAPI sometimes reports the Lambda as FAILED
   although the new code runs — check with an utterance only the new code answers.
4. Screenshots go to `.playwright-mcp/` (kept out of git via `.git/info/exclude`; add the line
   `.playwright-mcp/` there if `git status` shows it).

## 1. Run the flow, one device per call

```text
browser_run_code_unsafe  code: async (page) => page.evaluate(() => sessionStorage.removeItem('screenCheck'))
browser_run_code_unsafe  filename: scripts/screen-check/console-flow.js      ← repeat
```

Each call of `scripts/screen-check/console-flow.js` tests the next device (Show 5 → 8 → 10 →
15/21 → 15 upright) and returns a JSON report with `remaining`. Repeat until `remaining` is
empty. A call takes 2–3 minutes and is moved to the background after 120 s — wait for its
notification, do not start a second one in parallel (they share the browser tab).

The flow per device: reload the test page, choose the device, confirm the „By changing device…“
dialog, then: launch → moon card → back → festival card → back → season card → daylight card →
garden tip (week list) → first task → back → „was ist heute im garten zu tun“ → „was sagt der
mond zum garten“ → „hilfe“ → help chip „Erzähl mir von Imbolc“ → back → „stopp“.

## 2. Review

For every step of every device, read the screenshot
(`.playwright-mcp/screen-check/<device>/<step>.png`) and the report's `ok` / `issues`:

- `ok: false` → the expected screen did not come (wrong answer, white page, tap missed).
- `issues` → text outside the screen or clipped by its box (scrolling lists are skipped).
- Look yourself for what the lint cannot see:
  - words broken mid-word (APL breaks a word that is wider than its box), cut-off titles or
    labels („Naturjahres…“), text too small to read from a few metres;
  - empty boxes or lists without text (a growing text in a box that does not stretch);
  - a white or empty display after a tap — every tap must answer with a screen
    (`lambda/test/intents.test.ts` → „tap … keeps a screen“);
  - „‹ Jahresrad“ top left on every detail screen and leading back to the wheel;
  - the tapped task marked in the list; the wheel image visible; daylight times plausible for
    the profile place (07–08 h / 16–18 h in autumn, not 22:17).

Report per device: a table step → OK / problem, with the screenshot path for each problem.

## 3. Fix and re-run

- Sizes per form factor: `SIZES` in `lambda/src/apl/ui.ts` (`small` = Show 5, `landscape` =
  Show 8/10/15/21, `portrait` = Show 15 upright; units vh/vw). Form factor from the request:
  `viewportKind()` in `lambda/src/context.ts` (pixel size, not dp: Show 8 reports 1280×800).
- Boxes: `box()` is a Container with the Frame behind and the TouchWrapper over the content —
  Frame and TouchWrapper never stretch their child, and the schema allows neither `alignSelf`
  nor percentage widths there.
- Declared viewports: `manifest.apis.custom.interfaces[0].supportedViewports` in
  `skill-package/skill.json` (Show 5, Show 8 = 960–1279×600–959 dp, 10–21, 15 upright).
- After a fix: `npm run verify`, deploy, re-run only the affected devices (remove their ids
  from `sessionStorage.screenCheck.done`, or reset and run all).

## Screens the live flow cannot reach

The error screen, the main screen on a festival day and the moon screen with gardening tips
depend on the day and the API. Their documents for every form factor come from the fixtures:

```bash
APL_DUMP=.playwright-mcp/screens npx vitest run lambda/test/apl-dump.test.ts
```

They are schema-checked by `npm run verify`. For a visual check, paste a document into the APL
authoring tool (`https://developer.amazon.com/alexa/console/ask/displays` → Blank Document →
Code View) and pick the device size there.

## Pitfalls seen in the console

- The preview size is fixed by the **first answer after a page load**; switching the device
  afterwards keeps the old size. Hence reload → device → confirm → first utterance.
- The device dropdown opens via its arrow (`.Select-arrow-zone`); the „Proceed“ dialog appears
  a moment later — wait for it (`waitFor`), `isVisible()` does not wait.
- Taps: the display's texts are `<data>` elements under the touch layer; click at their
  coordinates (`page.mouse.click`), not with `locator.click()`.
