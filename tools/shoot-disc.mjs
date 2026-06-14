// REF-08 disc fidelity + icon-first verification (2026-06-15). Real local
// Chrome. Proves: refined discs render both themes, thin-line glyphs applied,
// edit-fields icon disc present + aria kept, legibility on a bright skin, FPS,
// reduced-motion, 0 console errors. Usage: node tools/shoot-disc.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/disc-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
function seed(theme, skin) {
  return {
    'ppw.theme': theme, 'ppw.background': JSON.stringify({ kind: 'skin', skinId: skin }),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
    ]),
  };
}
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
async function open(theme, skin, extra) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...(extra || {}) });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, skin));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  return { ctx, p };
}
// open a routine card so its action discs show
async function openCard(p) {
  await p.evaluate(() => { const t = [...document.querySelectorAll('button')].find(x => /toggle details/i.test(x.getAttribute('aria-label') || '')); if (t) t.click(); });
  await p.waitForTimeout(450);
}

const dark = await open('dark', 'forest-mist');
await openCard(dark.p);
await dark.p.screenshot({ path: join(OUT, 'discs-dark-forest.png') });
// probe: disc box-shadow layer count + glyph stroke-width thinned
const discInfo = await dark.p.evaluate(() => {
  const d = document.querySelector('.today-routine-card.is-open .glass-disc') || document.querySelector('.glass-disc');
  const svgChild = d && d.querySelector('svg :is(path,line,polyline,circle,rect,polygon)');
  return {
    found: !!d,
    raisedDrop: d ? /16px|6px 16px|6px 16/.test(getComputedStyle(d).boxShadow) : false,
    glyphStroke: svgChild ? getComputedStyle(svgChild).strokeWidth : null,
  };
});
// edit-fields icon disc present? open a user-stack card (the 18:00 one) — it's the userStack
const editDisc = await dark.p.evaluate(() => {
  const b = [...document.querySelectorAll('.glass-disc')].find(x => /edit stack fields/i.test(x.getAttribute('aria-label') || ''));
  return b ? { label: b.getAttribute('aria-label'), hasSvg: !!b.querySelector('svg') } : null;
});
await dark.ctx.close();

const darkBright = await open('dark', 'azure'); await darkBright.p.screenshot({ path: join(OUT, 'discs-dark-azure.png') }); await darkBright.ctx.close();
const light = await open('light', 'chrome'); await openCard(light.p); await light.p.screenshot({ path: join(OUT, 'discs-light-chrome.png') }); await light.ctx.close();

// FPS while scrolling
const fctx = await open('dark', 'forest-mist');
const fps = await fctx.p.evaluate(() => new Promise((r) => { let f = 0; const t0 = performance.now(); function t(n){ f++; if (n-t0<1200){ window.scrollBy(0,2); requestAnimationFrame(t);} else r(Math.round(f*1000/(n-t0))); } requestAnimationFrame(t); }));
await fctx.ctx.close();

// reduced motion — disc glyph transition collapsed
const r = await open('dark', 'forest-mist', { reducedMotion: 'reduce' });
const reduced = await r.p.evaluate(() => { const s = document.querySelector('.glass-disc svg'); return s ? getComputedStyle(s).transitionDuration : null; });
await r.ctx.close();
await browser.close();
console.log(JSON.stringify({ discInfo, editDisc, fps, reducedGlyphDur: reduced, consoleErrors: errs.length, errSample: errs.slice(0, 4) }, null, 2));
console.log('OUT ->', OUT);
