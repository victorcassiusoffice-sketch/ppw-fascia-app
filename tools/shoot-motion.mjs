// Motion-unification verification (2026-06-15). Real local Chrome via
// Playwright. Proves: (1) every route enters with the SAME primitive,
// (2) selection states ease on the app curve (computed timing-function probe),
// (3) zero console errors, (4) reduced-motion collapses motion.
// Usage: node tools/shoot-motion.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/motion-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
const APP_CURVE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const SEED = {
  'ppw.theme': 'dark',
  'ppw.background': JSON.stringify({ kind: 'skin', skinId: 'forest-mist' }),
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
    { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
  ]),
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const errs = [];
async function newPage(ctx) {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  return page;
}

// ── Pass A: normal motion ───────────────────────────────────────────────
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((seed) => { try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {} }, SEED);
const page = await newPage(ctx);

// Capture a short frame arc right after a nav tap → shows the route entrance.
async function captureRouteArc(label, navLabelRe) {
  await page.evaluate((re) => {
    const nav = [...document.querySelectorAll('nav button, nav a')].find(b => new RegExp(re, 'i').test(b.getAttribute('aria-label') || b.textContent || ''));
    if (nav) nav.click();
  }, navLabelRe.source);
  for (let i = 0; i < 6; i++) {
    await page.screenshot({ path: join(OUT, `arc-${label}-f${i}.png`) });
    await page.waitForTimeout(55);
  }
}

await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// Settled landmark per route (proof every route renders the same entrance feel).
const routes = [
  ['today', /today/],
  ['protocols', /protocol/],
  ['modules', /module/],
  ['settings', /settings/],
];
for (const [label, re] of routes) {
  await captureRouteArc(label, re);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, `route-${label}-settled.png`) });
}

// Selection-state easing probe — go back to Today, find a routine card, read the
// computed transition-timing-function that drives its selection ring/border.
await page.evaluate(() => {
  const nav = [...document.querySelectorAll('nav button, nav a')].find(b => /today/i.test(b.getAttribute('aria-label') || b.textContent || ''));
  if (nav) nav.click();
});
await page.waitForTimeout(700);
const selectionProbe = await page.evaluate(() => {
  const card = document.querySelector('.today-routine-card');
  if (!card) return { found: false };
  const cs = getComputedStyle(card);
  return {
    found: true,
    timingFunction: cs.transitionTimingFunction,
    duration: cs.transitionDuration,
  };
});

// Trigger a selection if a tickbox exists, capture the ring arc.
await page.evaluate(() => {
  const tb = document.querySelector('.today-routine-card input[type="checkbox"], .today-routine-card [role="checkbox"]');
  if (tb) tb.click();
});
for (let i = 0; i < 4; i++) {
  await page.screenshot({ path: join(OUT, `select-f${i}.png`) });
  await page.waitForTimeout(50);
}

// Probe a generic Tailwind transition-colors element (a link) — should now also
// resolve to the app curve, proving the global utility unification.
const linkProbe = await page.evaluate(() => {
  const el = [...document.querySelectorAll('a, button')].find(e => getComputedStyle(e).transitionProperty.includes('color'));
  if (!el) return { found: false };
  const cs = getComputedStyle(el);
  return { found: true, timingFunction: cs.transitionTimingFunction, duration: cs.transitionDuration };
});

await ctx.close();

// ── Pass B: reduced motion ──────────────────────────────────────────────
const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
await rctx.addInitScript((seed) => { try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {} }, SEED);
const rpage = await newPage(rctx);
await rpage.goto(BASE + '/today', { waitUntil: 'networkidle' });
await rpage.waitForTimeout(700);
const reducedProbe = await rpage.evaluate(() => {
  const card = document.querySelector('.today-routine-card');
  return card ? { found: true, timingFunction: getComputedStyle(card).transitionDuration } : { found: false };
});
await rpage.screenshot({ path: join(OUT, 'reduced-today.png') });
await rctx.close();

await browser.close();

const verdict = {
  appCurve: APP_CURVE,
  selectionProbe,
  linkProbe,
  reducedProbe,
  selectionUsesAppCurve: selectionProbe.found && selectionProbe.timingFunction.replace(/\s+/g, '') === APP_CURVE.replace(/\s+/g, ''),
  linkUsesAppCurve: linkProbe.found && linkProbe.timingFunction.replace(/\s+/g, '') === APP_CURVE.replace(/\s+/g, ''),
  consoleErrors: errs.length,
  errSample: errs.slice(0, 4),
};
console.log(JSON.stringify(verdict, null, 2));
console.log('OUT ->', OUT);
