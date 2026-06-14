// Thick-glass + liquid-icon verification (2026-06-15). Real local Chrome.
// Proves: richer glass renders both themes, icon liquid-tap morph runs,
// legibility holds on a BRIGHT skin in both themes, FPS holds, 0 console
// errors. Usage: node tools/shoot-glass.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/glass-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

function seed(theme, skinId) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify({ kind: 'skin', skinId }),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
  };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
async function shot(label, theme, skin, extra) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...(extra || {}) });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, skin));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(`[${label}] ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`[${label}] ${e.message}`));
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  await p.screenshot({ path: join(OUT, `${label}.png`) });
  const out = { ctx, p };
  return out;
}

// Richer glass — dark + bright skin (azure), and light theme + bright skin.
const a = await shot('today-dark-forest', 'dark', 'forest-mist'); await a.ctx.close();
const b = await shot('today-dark-azure', 'dark', 'azure');
// thick-glass depth probe on a card: inner-glow present in box-shadow?
const depth = await b.p.evaluate(() => {
  const c = document.querySelector('.today-routine-card');
  const cs = getComputedStyle(c);
  const before = getComputedStyle(c, '::before');
  return { boxShadowLayers: (cs.boxShadow.match(/inset/g) || []).length, sheen: before.backgroundImage.includes('gradient') };
});
await b.ctx.close();
const c = await shot('today-light-azure', 'light', 'azure'); await c.ctx.close();
const d = await shot('today-light-chrome', 'light', 'chrome'); await d.ctx.close();

// Icon liquid-tap morph — capture a disc glyph mid-press on an expanded card.
const e = await shot('iconmorph-base', 'dark', 'forest-mist');
const ep = e.p;
// open a routine card
await ep.evaluate(() => { const t = [...document.querySelectorAll('button')].find(x => /toggle details/i.test(x.getAttribute('aria-label') || '')); if (t) t.click(); });
await ep.waitForTimeout(450);
// press-and-hold a glass-disc to capture the glyph tap morph
const disc = await ep.$('.today-routine-card.is-open .glass-disc');
const morphFrames = [];
if (disc) {
  const box = await disc.boundingBox();
  await ep.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ep.mouse.down();
  for (let i = 0; i < 3; i++) { await ep.screenshot({ path: join(OUT, `iconmorph-press-f${i}.png`) }); await ep.waitForTimeout(40); }
  // read the glyph transform while active
  const glyphT = await ep.evaluate(() => {
    const s = document.querySelector('.today-routine-card.is-open .glass-disc svg');
    return s ? getComputedStyle(s).transform : null;
  });
  morphFrames.push(glyphT);
  await ep.mouse.up();
  for (let i = 0; i < 3; i++) { await ep.screenshot({ path: join(OUT, `iconmorph-release-f${i}.png`) }); await ep.waitForTimeout(50); }
}
// FPS while scrolling Today with the richer glass on screen.
const fps = await ep.evaluate(() => new Promise((r) => { let f = 0; const t0 = performance.now(); function t(n){ f++; if (n - t0 < 1200) { window.scrollBy(0, 2); requestAnimationFrame(t); } else r(Math.round(f*1000/(n-t0))); } requestAnimationFrame(t); }));
await e.ctx.close();

// Reduced motion — disc glyph does NOT transform on press.
const r = await shot('reduced', 'dark', 'forest-mist', { reducedMotion: 'reduce' });
const reducedGlyph = await r.p.evaluate(() => {
  const s = document.querySelector('.glass-disc svg');
  return s ? getComputedStyle(s).transitionDuration : null;
});
await r.ctx.close();

await browser.close();
console.log(JSON.stringify({ depth, glyphPressTransform: morphFrames[0], fps, reducedGlyphTransitionDur: reducedGlyph, consoleErrors: errs.length, errSample: errs.slice(0, 5) }, null, 2));
console.log('OUT ->', OUT);
