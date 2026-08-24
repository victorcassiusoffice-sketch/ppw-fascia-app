// Real-render smoke for the Guided Onboarding build (2026-08-24).
//
// A green `npm test` + `npm run build` can still white-screen, and a jsdom test
// cannot tell you whether the spotlight hole is genuinely tappable — jsdom has
// no layout, so "the dim panel is not covering the button" is untestable there.
// This is the gate that actually proves it: real Chromium, the real built
// bundle, zero console errors, #root actually populated, and the guide's first
// quest walked with real taps at real coordinates.
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 --strictPort     (in another shell)
//   node tools/shoot-guide-2026-08-24.mjs
//
// Exits non-zero on ANY console error, pageerror, empty root, or failed step.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '4173';
const BASE = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/guide';
mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const failures = [];
const passes = [];
function ok(m) { passes.push(m); console.log('  PASS ' + m); }
function bad(m) { failures.push(m); console.log('  FAIL ' + m); }

const ONBOARDED = { 'ppw5.onboarded': '1', 'ppw5.terms': '1', 'ppw5.frc': '1' };

/** Fresh context with seeded ppw5.* localStorage. */
async function ctxWith(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => {
    try {
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch (_) {}
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  return { ctx, page, errs };
}

async function mounted(page) {
  return page.evaluate(() => {
    const r = document.getElementById('root');
    return { exists: !!r, children: r ? r.childElementCount : 0 };
  });
}

async function go(page, seedless) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(seedless ? 1400 : 1200);
}

function clean(errs, label) {
  errs.length ? bad(label + ' console errors: ' + errs.join(' | ')) : ok(label + ' 0 console errors');
}

// ── 1 · fresh install mounts ───────────────────────────────────────────────
{
  console.log('\n[1] fresh install mounts');
  const { ctx, page, errs } = await ctxWith({});
  await go(page);
  const m = await mounted(page);
  m.exists && m.children > 0 ? ok(`#root has ${m.children} children`) : bad('#root empty — WHITE SCREEN');
  await page.screenshot({ path: OUT + '/01-fresh.png' });
  clean(errs, 'fresh:');
  await ctx.close();
}

// ── 2 · the guide has a home in the header ─────────────────────────────────
{
  console.log('\n[2] the guide disc is in the Stack header');
  const { ctx, page, errs } = await ctxWith({ ...ONBOARDED, 'ppw5.tourSeen': '1' });
  await go(page);
  const disc = page.locator('[data-tour="guide"]');
  (await disc.count()) ? ok('GuideDisc rendered') : bad('GuideDisc missing from the header');
  const label = await disc.first().getAttribute('aria-label');
  /0 of 8/.test(label || '') ? ok('disc reads "' + label + '"') : bad('disc aria-label wrong: ' + label);
  await page.screenshot({ path: OUT + '/02-header.png' });
  clean(errs, 'header:');
  await ctx.close();
}

// ── 3 · the journal holds eight quests ─────────────────────────────────────
{
  console.log('\n[3] the journal opens with eight quests');
  const { ctx, page, errs } = await ctxWith({ ...ONBOARDED, 'ppw5.tourSeen': '1' });
  await go(page);
  await page.locator('[data-tour="guide"]').first().click();
  await page.waitForTimeout(600);
  const heading = await page.locator('text=Your guide').first().count();
  heading ? ok('journal opened') : bad('journal did not open');
  const starts = await page.getByText('Start', { exact: true }).count();
  starts === 8 ? ok('eight quests listed') : bad('expected 8 quests, found ' + starts);
  const footer = await page.locator('text=Your guide progress lives on this phone.').count();
  footer ? ok('footer states where progress lives') : bad('footer line missing');
  await page.screenshot({ path: OUT + '/03-journal.png' });
  clean(errs, 'journal:');
  await ctx.close();
}

// ── 4 · a genuinely new device: wizard → welcome → quest 1 ────────────────
// The welcome CANNOT be reached by seeding `onboarded` — the migration rule
// deliberately skips it for anyone who was already set up, because they have
// already met the old tour. So this walks the real wizard from a blank device,
// which is the only honest way to see it.
{
  console.log('\n[4] a new device: 2-screen wizard, then the welcome, then quest 1');
  const { ctx, page, errs } = await ctxWith({});
  await go(page, true);

  // the first-run choice sits in front of the wizard
  const look = page.locator('button', { hasText: 'Look around first' });
  if (await look.count()) { await look.first().click(); await page.waitForTimeout(500); }

  const dots = await page.evaluate(() => {
    const w = document.querySelector('[style*="z-index: 40"]');
    if (!w) return -1;
    return [...w.querySelectorAll('span')].filter((n) => {
      const st = n.getAttribute('style') || '';
      return /height: 7px/.test(st) && /width: (7|22)px/.test(st);
    }).length;
  });
  dots === 2 ? ok('the wizard is 2 screens, not 3') : bad('wizard step count is ' + dots + ', expected 2');

  const tryIt = await page.getByText('Try it — tap a card to tick it off.').count();
  tryIt ? ok('step 1 invites a real tap') : bad('the "try it" line is missing');
  await page.locator('button', { hasText: 'Morning walk' }).first().click();
  await page.waitForTimeout(400);
  const struck = await page.evaluate(() => !!document.querySelector('[style*="line-through"]'));
  struck ? ok('the demo card actually ticks') : bad('the demo card is still just a picture');
  await page.screenshot({ path: OUT + '/04a-wizard.png' });

  await page.locator('button', { hasText: 'Next' }).last().click({ force: true });
  await page.waitForTimeout(600);

  const why = await page.getByText('Tick the box above to continue — it is the legal bit.').count();
  why ? ok('the dimmed CTA says why it is dim') : bad('the terms why-line is missing');
  // by its label, not by index: the Stack's own row-selection circles are also
  // role=checkbox and sit in the DOM underneath the wizard
  await page.locator('[aria-label="I agree to the Terms and Health Disclaimer"]').click({ force: true });
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: 'Start with an empty day' }).first().click({ force: true });
  await page.waitForTimeout(1800);       // the welcome waits 700ms to settle
  const w1 = await page.locator('text=This is your Stack.').count();
  w1 ? ok('welcome step 1 shown') : bad('welcome step 1 missing');
  const counter = await page.locator('[data-coach-bubble] >> text=1 of 2').count();
  counter ? ok('welcome is 2 steps, not 5') : bad('welcome step count is not 2');
  await page.locator('[data-coach-bubble] button', { hasText: 'Next' }).first().click();
  await page.waitForTimeout(500);
  const w2 = await page.locator('text=Your guide lives here.').count();
  w2 ? ok('welcome step 2 shown') : bad('welcome step 2 missing');
  await page.screenshot({ path: OUT + '/04-welcome.png' });
  await page.locator('button', { hasText: 'Start the first quest' }).first().click();
  await page.waitForTimeout(700);
  const q1 = await page.locator('text=Do the thing, then tick it.').count();
  q1 ? ok('quest 1 started from the welcome') : bad('quest 1 did not start');
  clean(errs, 'welcome:');
  await ctx.close();
}

// ── 5 · THE REAL TEST — the spotlight hole is genuinely tappable ───────────
// A do-step must not advance on a tap on the dimmer, and MUST advance when the
// user taps the real control through the hole. jsdom cannot prove either.
{
  console.log('\n[5] quest 1 walks on the real screen');
  const { ctx, page, errs } = await ctxWith({ ...ONBOARDED, 'ppw5.tourSeen': '1' });
  await go(page);
  await page.locator('[data-tour="guide"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Tick one off' }).first().click();
  await page.waitForTimeout(800);

  const step1 = await page.locator('text=Do the thing, then tick it.').count();
  step1 ? ok('quest 1 step 1 up') : bad('quest 1 step 1 did not open');

  const yourTurn = await page.locator('text=Your turn — do it on the screen').count();
  yourTurn ? ok('the step says the screen is the user’s turn') : bad('do-step affordance line missing');

  // (a) a tap on the DIM must do nothing
  await page.mouse.click(215, 890);            // low on the frame, over the dim
  await page.waitForTimeout(500);
  const stillStep1 = await page.locator('text=Do the thing, then tick it.').count();
  stillStep1 ? ok('a tap on the dim does NOT advance a do-step') : bad('the dim advanced the step — it is a slideshow, not a quest');

  // (b) a tap on the REAL Done tick, through the hole, must advance it
  const doneBtn = page.locator('[data-tour="done"]').first();
  const box = await doneBtn.boundingBox();
  if (!box) { bad('the hero Done tick was not on screen'); }
  else {
    // deliberately a raw coordinate click, not .click(): a Playwright element
    // click would report the overlay as the hit target and refuse. This is the
    // exact tap a thumb makes.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(1200);
    const done = await page.evaluate(() => {
      const raw = localStorage.getItem('ppw5.stacks');
      try { const s = JSON.parse(raw); return Object.values(s.db || {}).flat().length; } catch { return 0; }
    });
    done > 0 ? ok('the real tick fired through the spotlight hole') : bad('the tap did not reach the real control — the hole is blocked');
    const step2 = await page.locator('text=Done things do not disappear.').count();
    step2 ? ok('the step advanced because the real thing happened') : bad('the step did not advance after the real tick');
    await page.screenshot({ path: OUT + '/05-quest1-step2.png' });
  }

  // (c) the pause must exist and must not record the quest
  const pause = page.locator('[aria-label="Pause the guide"]').first();
  (await pause.count()) ? ok('the step offers a way out') : bad('the dim has no exit');
  await pause.click();
  await page.waitForTimeout(400);
  const guide = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw5.guide') || '{}'));
  !(guide.q && guide.q.tick) ? ok('pausing did not tick the quest off') : bad('pausing falsely recorded the quest as done');
  const resume = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw5.guideResume') || 'null'));
  (resume && resume.questId === 'tick') ? ok('the quest remembered where it was') : bad('no resume point written');
  clean(errs, 'quest1:');
  await ctx.close();
}

// ── 6 · the honesty fixes are on screen ────────────────────────────────────
{
  console.log('\n[6] the honest copy is actually rendered');
  const { ctx, page, errs } = await ctxWith({ ...ONBOARDED, 'ppw5.tourSeen': '1' });
  await go(page);
  await page.locator('[data-tour="settings"]').first().click();
  await page.waitForTimeout(700);
  const honest = await page.locator('text=Nudges appear while the app is open on screen. Nothing rings when it is closed.').count();
  honest ? ok('Settings states the reminder truth') : bad('the reminders honesty line is missing');
  const anchor = await page.locator('[data-tour="set-reminders"]').count();
  anchor ? ok('set-reminders anchor present') : bad('set-reminders anchor missing');
  await page.screenshot({ path: OUT + '/06-settings.png' });
  clean(errs, 'settings:');
  await ctx.close();
}

// ── 7 · the Library no longer opens a free user on the paywall ─────────────
{
  console.log('\n[7] first Library visit lands on Media, not the paywall');
  const { ctx, page, errs } = await ctxWith({ ...ONBOARDED, 'ppw5.tourSeen': '1' });
  await go(page);
  await page.locator('[data-tour="library"]').first().click();
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => localStorage.getItem('ppw5.libSeen'));
  seen === '1' ? ok('first visit recorded') : bad('libSeen not written');
  const tabs = await page.locator('[data-tour="lib-tabs"]').count();
  tabs ? ok('lib-tabs anchor present') : bad('lib-tabs anchor missing');
  await page.screenshot({ path: OUT + '/07-library.png' });
  clean(errs, 'library:');
  await ctx.close();
}

// ── 8 · a hint actually fires, on the real screen ─────────────────────────
{
  console.log('\n[8] the hint engine answers a real tap');
  const { ctx, page, errs } = await ctxWith({ ...ONBOARDED, 'ppw5.tourSeen': '1' });
  await go(page);
  // the selection circle is one tap from bulk delete and looks like a done tick
  await page.locator('[data-tour="select-circle"]').first().click();
  await page.waitForTimeout(900);
  const bubble = await page.locator('[data-hint="select-circle"]').count();
  bubble ? ok('the select-circle hint answered the tap') : bad('no hint fired for the selection circle');
  const said = await page.getByText('That circle is for choosing, not finishing.').count();
  said ? ok('and it says what the circle is for') : bad('the hint copy did not render');
  await page.screenshot({ path: OUT + '/08-hint.png' });
  // one tap anywhere dismisses
  await page.mouse.click(215, 700);
  await page.waitForTimeout(500);
  const gone = await page.locator('[data-hint="select-circle"]').count();
  !gone ? ok('one tap dismisses it') : bad('the hint would not go away');
  // and it is one-shot
  const burned = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw5.hints') || '{}'));
  burned['select-circle'] === 1 ? ok('it is spent, and will not repeat') : bad('the hint flag was not burned');
  clean(errs, 'hint:');
  await ctx.close();
}

// ── 9 · the finale: the guide leaves ──────────────────────────────────────
{
  console.log('\n[9] the eighth quest retires the guide');
  const seven = { tick: 1, add: 1, time: 1, tomorrow: 1, library: 1, ai: 1, reminders: 1 };
  const { ctx, page, errs } = await ctxWith({
    ...ONBOARDED, 'ppw5.tourSeen': '1',
    'ppw5.guide': JSON.stringify({ q: seven, welcomed: 1 }),
  });
  await go(page);
  const label = await page.locator('[data-tour="guide"]').first().getAttribute('aria-label');
  /7 of 8/.test(label || '') ? ok('the ring shows 7 of 8') : bad('disc reads: ' + label);

  // finish the last one for real: Quest 8 completes on any look change
  await page.locator('[data-tour="guide"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Make it yours' }).first().click();
  await page.waitForTimeout(1000);
  const onSettings = await page.locator('[data-tour="set-theme"]').count();
  onSettings ? ok('the quest walked itself to Settings') : bad('the quest did not navigate');

  // tap a colourway through the spotlight hole
  const sw = page.locator('[data-tour="set-theme"] button').nth(2);
  const b = await sw.boundingBox();
  if (!b) { bad('no colourway swatch on screen'); }
  else {
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForTimeout(1400);
    const guide = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw5.guide') || '{}'));
    (guide.q && guide.q.yours) ? ok('the last quest completed on a real theme change') : bad('quest 8 did not complete');
    await page.waitForTimeout(2600);            // the finale waits 1s, then opens
    const fin = await page.getByText('Guide complete.').count();
    fin ? ok('the finale said goodbye') : bad('the finale never fired');
    await page.screenshot({ path: OUT + '/09-finale.png' });
    const behind = await page.locator('[data-guide-sheet] >> text=8 of 8').count();
    behind ? ok('the journal is open behind it, showing all eight') : bad('the finale is a bubble on an empty screen');
    // [Done] is what retires the guide — not the moment the finale opened
    const early = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw5.guide') || '{}'));
    !early.done ? ok('the guide is not retired until the user closes the finale') : bad('guide.done was set before [Done]');
    await page.locator('[data-coach-bubble] button', { hasText: 'Done' }).first().click();
    await page.waitForTimeout(600);
    const done = await page.evaluate(() => JSON.parse(localStorage.getItem('ppw5.guide') || '{}'));
    done.done ? ok('and [Done] retires it') : bad('guide.done was never set');
    await page.waitForTimeout(1000);
    const disc = await page.locator('[data-tour="guide"]').count();
    !disc ? ok('the disc left the header') : bad('the disc is still there after the finale');
    // and the journal lives on in Settings, forever
    const row = await page.locator('[data-tour="set-guide"]').count();
    row ? ok('the journal keeps its home in Settings') : bad('the Settings Guide row is missing');
  }
  clean(errs, 'finale:');
  await ctx.close();
}

// ── 10 · easy read at 140% — the bubbles stay inside the phone ────────────
{
  console.log('\n[10] easy read, 140% zoom');
  const { ctx, page, errs } = await ctxWith({
    ...ONBOARDED, 'ppw5.tourSeen': '1',
    'ppw5.a11y': JSON.stringify({ on: true, zoom: 1.4 }),
  });
  await go(page);
  await page.locator('[data-tour="guide"]').first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'Tick one off' }).first().click();
  await page.waitForTimeout(1000);
  // Against the VIEWPORT, not the frame. Easy read scales the phone with CSS
  // zoom, so the frame becomes 1305px tall inside a 932px window — "inside the
  // frame" was true of a bubble sitting 8px below the bottom of the screen,
  // which is exactly where this check used to pass while the user saw a dimmed
  // screen and no instructions at all.
  const fits = await page.evaluate(() => {
    const b = document.querySelector('[data-coach-bubble]');
    if (!b) return { found: false };
    const br = b.getBoundingClientRect();
    return { found: true, box: { top: Math.round(br.top), bottom: Math.round(br.bottom), left: Math.round(br.left), right: Math.round(br.right) },
      vw: innerWidth, vh: innerHeight,
      onScreen: br.top >= -1 && br.bottom <= innerHeight + 1 && br.left >= -1 && br.right <= innerWidth + 1 };
  });
  if (!fits.found) bad('no coach bubble at 140% zoom');
  else fits.onScreen
    ? ok('the bubble is fully on screen at 140% (' + JSON.stringify(fits.box) + ' in ' + fits.vw + 'x' + fits.vh + ')')
    : bad('the bubble is off-screen at 140%: ' + JSON.stringify(fits.box) + ' in ' + fits.vw + 'x' + fits.vh);

  // and the spotlight must ring its target, not a patch of screen beside it
  const ring = await page.evaluate(() => {
    const t = document.querySelector('[data-tour="next-up"]');
    const r = [...document.querySelectorAll('div')].find((n) => (n.getAttribute('style') || '').includes('border: 2px solid var(--accent)'));
    if (!t || !r) return null;
    const a = t.getBoundingClientRect(), b = r.getBoundingClientRect();
    return { dx: Math.abs(a.left - b.left), dy: Math.abs(a.top - b.top), dw: Math.abs(a.width - b.width) };
  });
  if (!ring) bad('no spotlight ring at 140%');
  // the ring is the target plus an 8px pad each side, scaled by the zoom
  else (ring.dx < 22 && ring.dy < 22 && ring.dw < 44)
    ? ok('the spotlight rings its target at 140%')
    : bad('the spotlight is misplaced at 140%: ' + JSON.stringify(ring));
  await page.screenshot({ path: OUT + '/10-easyread.png' });
  clean(errs, 'easyread:');
  await ctx.close();
}


console.log('\n──────────────────────────────');
console.log(`${passes.length} passed, ${failures.length} failed`);
await browser.close();
if (failures.length) { failures.forEach((f) => console.log('  x ' + f)); process.exit(1); }
console.log('SMOKE GREEN');
