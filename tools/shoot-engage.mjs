// "Movement engagement" verification (2026-06-15): liquid responds to scroll/tap
// (energy uniform), 60fps, reduced-motion freeze, 0 console errors. Real Chrome.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/engage-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
const stacks = Array.from({ length: 6 }, (_, i) => ({ id: 's' + i, type: 'text', title: 'Routine ' + (i + 1), text: 'Zone', time: (7 + i) + ':00', durationSec: 180 + i * 30 }));
const SEED = {
  'ppw.theme': 'dark', 'ppw.background': JSON.stringify({ kind: 'liquid' }),
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify(stacks),
};
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);

const present = await page.evaluate(() => ({ liquid: !!document.querySelector('.liquid-bg-canvas'), shown: document.querySelector('.liquid-bg-canvas') && getComputedStyle(document.querySelector('.liquid-bg-canvas')).display !== 'none' }));

// fps while scrolling (exercises the energy path)
const fps = await page.evaluate(() => new Promise((r) => { let f = 0; const t0 = performance.now(); function t(n){ f++; window.scrollBy(0, 6); if (n - t0 < 1200) requestAnimationFrame(t); else r(Math.round(f * 1000 / (n - t0))); } requestAnimationFrame(t); }));

// GIF frames: idle → scroll burst (energy surge) → tap impulse → settle
let fi = 0; const shot = async () => { await page.screenshot({ path: join(OUT, `g-${String(fi).padStart(3, '0')}.png`) }); fi++; };
await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(250);
for (let i = 0; i < 3; i++) { await shot(); await page.waitForTimeout(120); }     // idle/calm
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 240); await shot(); await page.waitForTimeout(90); } // scroll surge
for (let i = 0; i < 3; i++) { await page.mouse.click(195, 300); await shot(); await page.waitForTimeout(110); } // tap impulses
for (let i = 0; i < 4; i++) { await shot(); await page.waitForTimeout(150); }     // settle back to calm
await ctx.close();

// reduced motion — canvas renders, no loop/listeners (just confirm no error + present)
const rctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
await rctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
const rp = await rctx.newPage();
rp.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
await rp.goto(BASE + '/today', { waitUntil: 'networkidle' });
await rp.waitForTimeout(500);
const rmShown = await rp.evaluate(() => { const c = document.querySelector('.liquid-bg-canvas'); return !!c && getComputedStyle(c).display !== 'none'; });
await rp.screenshot({ path: join(OUT, 'reduced-motion.png') });
await rctx.close();
await browser.close();
console.log(JSON.stringify({ present, fps, rmShown, consoleErrors: errs.length, errSample: errs.slice(0, 4) }, null, 2));
console.log('FRAMES', fi, 'OUT ->', OUT);
