// Screen check in the Alexa developer console (skill `.claude/skills/screen-check`).
//
// Run with the Playwright MCP tool `browser_run_code_unsafe` and `filename:
// scripts/screen-check/console-flow.js`, in a browser logged into the developer console. Each call
// tests ONE device (the next one not yet done) and returns its report; call again until
// `remaining` is empty. Progress lives in the console tab's sessionStorage (the tool runs each
// call isolated: no globals, no file access); to start over, run
// `async (page) => page.evaluate(() => sessionStorage.removeItem('screenCheck'))`.
//
// Per device: reload the test page, choose the device and confirm the dialog BEFORE the first
// utterance — the console fixes the preview size at the first rendered answer after a page load,
// so switching later keeps the old size. Then the flow below; a screenshot per step lands in
// .playwright-mcp/screen-check/<device>/, and every step is linted for text outside the screen
// and clipped text.
async (page) => {
  const SKILL = 'amzn1.ask.skill.9c0c794a-a5a0-4b9e-b017-8f965bce13b6';
  const TEST = `https://developer.amazon.com/alexa/console/ask/test/${SKILL}/development/de_DE/`;
  const DEVICES = [
    { id: 'show5', console: 'Hub Landscape Small', name: 'Echo Show 5', size: '960x480' },
    { id: 'show8', console: 'Hub Landscape Medium', name: 'Echo Show 8', size: '960x600 dp' },
    { id: 'show10', console: 'Hub Landscape Large', name: 'Echo Show 10', size: '1280x800' },
    { id: 'show15', console: 'Hub Landscape Extra Large', name: 'Echo Show 15/21', size: '1920x1080' },
    { id: 'show15-portrait', console: 'Hub Portrait Medium', name: 'Echo Show 15 upright', size: '1080x1920' },
  ];
  // Step kinds: say (type an utterance), tap (touch the first display text matching one of the
  // labels exactly), tapFirstTask (the first task row of a garden list).
  const FLOW = [
    { id: '01-main', say: 'öffne jahresrad', expect: 'GARTENTIPP' },
    { id: '02-moon', tap: ['MOND'], expect: 'MOND HEUTE' },
    { id: '03-back', tap: ['‹ Jahresrad'], expect: 'GARTENTIPP' },
    { id: '04-festival', tap: ['NÄCHSTES FEST', 'HEUTE'], expect: '‹ Jahresrad' },
    { id: '05-back', tap: ['‹ Jahresrad'], expect: 'GARTENTIPP' },
    { id: '06-season', tap: ['NATURJAHRESZEIT', 'JAHRESZEIT'], expect: 'GARTENTIPP' },
    { id: '07-daylight', tap: ['TAGESLICHT'], expect: 'GARTENTIPP' },
    { id: '08-garden-week', tap: ['GARTENTIPP'], expect: 'Diese Woche' },
    { id: '09-task', tapFirstTask: true, expect: 'Diese Woche' },
    { id: '10-back', tap: ['‹ Jahresrad'], expect: 'GARTENTIPP' },
    { id: '11-garden-today', say: 'was ist heute im garten zu tun', expect: 'Heute' },
    { id: '12-moon-garden', say: 'was sagt der mond zum garten', expect: 'MOND HEUTE' },
    { id: '13-help', say: 'hilfe', expect: 'Frag das Jahresrad' },
    { id: '14-help-chip', tap: ['„Erzähl mir von Imbolc“'], expect: 'Imbolc' },
    { id: '15-back', tap: ['‹ Jahresrad'], expect: 'GARTENTIPP' },
  ];
  const WAIT = 8000;

  const state = JSON.parse((await page.evaluate(() => sessionStorage.getItem('screenCheck')).catch(() => null)) ?? '{"done":[]}');
  const device = DEVICES.find((d) => !state.done.includes(d.id));
  if (!device) return { done: state.done, remaining: [], note: 'all devices done; remove sessionStorage.screenCheck to start over' };

  const display = () => page.locator('.askt-renderer__container').first();
  const frame = () => page.evaluate(() => { const e = document.querySelector('.askt-renderer__container'); return e ? `${e.offsetWidth}x${e.offsetHeight}` : 'none'; });
  const hasText = (text) => display().getByText(text, { exact: false }).first().isVisible().catch(() => false);
  const say = async (text) => {
    const box = page.getByRole('textbox', { name: 'Type or click and hold the mic' });
    await box.fill(text);
    await box.press('Enter');
    await page.waitForTimeout(WAIT);
  };
  const tapAt = async (locator) => {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    const b = await locator.boundingBox().catch(() => null);
    if (!b) return false;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(WAIT);
    return true;
  };
  const tapLabel = async (labels) => {
    for (const label of labels) {
      const el = display().getByText(label, { exact: true }).first();
      if (await el.isVisible().catch(() => false)) return (await tapAt(el)) ? label : null;
    }
    return null;
  };
  // Text that sticks out of the screen, or is cut by its box (outside scrolling lists).
  const lint = () =>
    page.evaluate(() => {
      const root = document.querySelector('.askt-renderer__container > *');
      if (!root) return ['no APL screen rendered'];
      const r = root.getBoundingClientRect();
      const issues = [];
      // Inside a ScrollView or Sequence: its content may continue below the edge on purpose.
      const scrolls = (el) => {
        for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (/(auto|scroll)/.test(s.overflowY + s.overflowX) || p.scrollHeight > p.clientHeight + 2) return true;
        }
        return false;
      };
      for (const el of root.querySelectorAll('*')) {
        const text = (el.childElementCount === 0 ? el.textContent : '').trim();
        if (!text || scrolls(el)) continue;
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.right > r.right + 2 || b.bottom > r.bottom + 2 || b.left < r.left - 2) issues.push(`outside screen: „${text.slice(0, 40)}“`);
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) issues.push(`clipped: „${text.slice(0, 40)}“`);
        // APL shortens a text over maxLines with „…“ itself; no API text ends like that.
        if (/…$/.test(text)) issues.push(`truncated: „${text.slice(-40)}“`);
      }
      return [...new Set(issues)].slice(0, 12);
    });

  // Fresh page, device first, then the first utterance. The window is large enough for the
  // biggest preview (Show 15 upright), and the console's Personalization panel, which lies over
  // the top of the display, is hidden — otherwise taps on „‹ Jahresrad“ hit the panel.
  await page.setViewportSize({ width: 2000, height: 2300 });
  await page.goto(TEST);
  await page.waitForTimeout(5000);
  await page.addStyleTag({ content: 'iframe { display: none !important; }' });
  const select = page.locator('.Select').filter({ has: page.locator('.Select-value-label', { hasText: /^(Hub|TV|Mobile)/ }) });
  await select.waitFor();
  if ((await select.locator('.Select-value-label').innerText()).trim() !== device.console) {
    await select.locator('.Select-arrow-zone').click();
    await page.locator(`.Select-menu-outer [title="${device.console}"]`).click();
    const proceed = page.getByRole('button', { name: 'Proceed' });
    await proceed.waitFor({ state: 'visible', timeout: 5000 }).then(() => proceed.click()).catch(() => {});
    await page.waitForTimeout(1500);
  }

  const steps = [];
  for (const step of FLOW) {
    let action = '';
    if (step.say) {
      await say(step.say);
      action = `say „${step.say}“`;
    } else if (step.tap) {
      const hit = await tapLabel(step.tap);
      action = hit ? `tap „${hit}“` : `tap ${step.tap.join('/')}: NOT FOUND`;
    } else if (step.tapFirstTask) {
      const hit = await tapAt(display().getByText('›', { exact: true }).first());
      action = hit ? 'tap first task' : 'tap first task: NOT FOUND';
    }
    const file = `.playwright-mcp/screen-check/${device.id}/${step.id}.png`;
    await display().screenshot({ path: file }).catch(() => page.screenshot({ path: file }));
    const ok = step.expect ? await hasText(step.expect) : true;
    steps.push({ step: step.id, action, expected: step.expect, ok, issues: await lint(), file });
  }

  const report = { device: device.name, console: device.console, size: device.size, frame: await frame(), steps };
  state.done.push(device.id);
  await say('stopp');
  await page.evaluate((s) => sessionStorage.setItem('screenCheck', s), JSON.stringify(state));
  return { ...report, remaining: DEVICES.filter((d) => !state.done.includes(d.id)).map((d) => d.id) };
}
