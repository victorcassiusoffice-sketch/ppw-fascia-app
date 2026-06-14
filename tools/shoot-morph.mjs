// Liquid-morph + less-text verification (2026-06-15). Real local Chrome via
// Playwright. Proves: morph runs (selection radius melt), refraction layer
// present + holds 60fps, icon-only controls keep aria-labels, reduced-motion
// collapses, zero console errors. Usage: node tools/shoot-morph.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/morph-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

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
function wire(p) {
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((seed) => { try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {} }, SEED);
const page = await ctx.newPage();
wire(page);

await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

// REF-03 refraction present + filter def in DOM.
const refraction = await page.evaluate(() => ({
  filterDef: !!document.querySelector('filter#ppw-liquid-glass'),
  refractSurfaces: document.querySelectorAll('.liquid-refract').length,
}));

// Selection radius MELT — capture the card radius before/after select + a frame arc.
const cardBefore = await page.evaluate(() => {
  const c = document.querySelector('.today-routine-card');
  return c ? getComputedStyle(c).borderTopLeftRadius : null;
});
// tick the first card's checkbox
await page.evaluate(() => {
  const tb = document.querySelector('.today-routine-card [role="checkbox"]');
  if (tb) tb.click();
});
const morphFrames = [];
for (let i = 0; i < 6; i++) {
  await page.screenshot({ path: join(OUT, `morph-select-f${i}.png`) });
  morphFrames.push(i);
  await page.waitForTimeout(45);
}
const cardAfter = await page.evaluate(() => {
  const c = document.querySelector('.today-routine-card.is-selected');
  return c ? getComputedStyle(c).borderTopLeftRadius : null;
});

// FPS probe — sample rAF for ~1s while scrolling (refraction + glass on screen).
const fps = await page.evaluate(() => new Promise((resolve) => {
  let frames = 0; const t0 = performance.now();
  function tick(t) { frames++; if (t - t0 < 1000) { window.scrollBy(0, 2); requestAnimationFrame(tick); } else resolve(Math.round(frames * 1000 / (t - t0))); }
  requestAnimationFrame(tick);
}));

// Open a card (radius unfurl morph) for the GIF.
await page.evaluate(() => { window.scrollTo(0, 0); });
await page.waitForTimeout(200);
await page.evaluate(() => {
  const t = [...document.querySelectorAll('button')].find(b => /toggle details/i.test(b.getAttribute('aria-label') || ''));
  if (t) t.click();
});
for (let i = 0; i < 5; i++) {
  await page.screenshot({ path: join(OUT, `morph-open-f${i}.png`) });
  await page.waitForTimeout(60);
}

// Less-text proof: aria-labels intact on icon-only controls across routes.
async function goTab(re) {
  await page.evaluate((r) => { const n = [...document.querySelectorAll('nav button, nav a')].find(b => new RegExp(r, 'i').test(b.getAttribute('aria-label') || b.textContent || '')); if (n) n.click(); }, re);
  await page.waitForTimeout(600);
}
await goTab('protocol');
const protoBack = await page.evaluate(() => {
  const a = document.querySelector('a[aria-label="Back to Today"]');
  return a ? { label: a.getAttribute('aria-label'), hasSvg: !!a.querySelector('svg'), text: a.textContent.trim() } : null;
});
await page.screenshot({ path: join(OUT, 'detext-protocols.png') });

await goTab('module');
await page.screenshot({ path: join(OUT, 'detext-modules.png') });
await goTab('settings');
const setBack = await page.evaluate(() => !!document.querySelector('a[aria-label="Back to Today"]'));
await page.screenshot({ path: join(OUT, 'detext-settings.png') });

// Today expanded icon-row aria-labels.
await goTab('today');
await page.waitForTimeout(300);
await page.evaluate(() => { const t = document.querySelector('.today-routine-card .font-display'); if (t) t.click(); });
await page.waitForTimeout(400);
const iconRow = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.today-routine-card .glass-disc')].map(b => b.getAttribute('aria-label')).filter(Boolean);
  return labels;
});
await page.screenshot({ path: join(OUT, 'detext-today-iconrow.png') });

await ctx.close();

// Reduced motion — selection radius does NOT morph (stays base).
const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
await rctx.addInitScript((seed) => { try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {} }, SEED);
const rp = await rctx.newPage(); wire(rp);
await rp.goto(BASE + '/today', { waitUntil: 'networkidle' });
await rp.waitForTimeout(600);
await rp.evaluate(() => { const tb = document.querySelector('.today-routine-card [role="checkbox"]'); if (tb) tb.click(); });
await rp.waitForTimeout(200);
const reducedRadius = await rp.evaluate(() => {
  const c = document.querySelector('.today-routine-card.is-selected');
  return c ? getComputedStyle(c).borderTopLeftRadius : null;
});
await rp.screenshot({ path: join(OUT, 'reduced-select.png') });
await rctx.close();
await browser.close();

console.log(JSON.stringify({
  refraction,
  selectionMorph: { before: cardBefore, after: cardAfter, melted: cardBefore !== cardAfter },
  fps,
  protoBack, settingsBack: setBack, iconRowLabels: iconRow,
  reducedRadius,
  consoleErrors: errs.length, errSample: errs.slice(0, 4),
}, null, 2));
console.log('OUT ->', OUT);
