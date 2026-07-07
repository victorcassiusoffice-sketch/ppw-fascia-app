// LIVE production verification (2026-06-18). Shoots the real GitHub Pages URL
// Vic opens — proves the de-frosted glass + Soft ground are live, app mounts,
// 0 console errors. Usage: node tools/shoot-live-2026-06-18.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/fix-2026-06-18/live';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];

async function ctxPage(theme, soft) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify({ kind: 'skin', skinId: 'azure' }),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
  });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest|sw\.js|ServiceWorker/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p };
}

// Mount probe + Today glass (live).
const { ctx: c1, p: p1 } = await ctxPage('dark');
await p1.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
await p1.waitForTimeout(1500);
const mount = await p1.evaluate(() => {
  const r = document.getElementById('root');
  const blur = getComputedStyle(document.querySelector('.glass') || document.body).backdropFilter || getComputedStyle(document.querySelector('.glass') || document.body).webkitBackdropFilter;
  return { rootChildren: r ? r.childElementCount : 0, sampleGlassBlur: blur };
});
await p1.screenshot({ path: join(OUT, 'live-today-dark.png') });
await c1.close();

// Soft lab (live).
const { ctx: c2, p: p2 } = await ctxPage('light');
await p2.goto(`${BASE}/soft-lab`, { waitUntil: 'networkidle' });
await p2.evaluate(() => { document.documentElement.setAttribute('data-soft-skin', 'slate'); document.documentElement.setAttribute('data-theme', 'light'); });
await p2.waitForTimeout(900);
await p2.screenshot({ path: join(OUT, 'live-soft-slate.png') });
await c2.close();

await browser.close();
console.log(JSON.stringify({ mount, consoleErrors: errs.length, errSample: errs.slice(0, 5) }, null, 2));
console.log('OUT ->', OUT);
