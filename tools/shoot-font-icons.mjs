// Font (Geist self-hosted) + icon thin-stroke verification (2026-06-15).
// Real local Chrome. Proves: Geist loads + applies, no Google CDN, icon glyphs
// render at 1.6 stroke (thin/uniform), genuine icon before/after (2.0 vs 1.6),
// 0 console errors. Usage: node tools/shoot-font-icons.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/font-icons-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
const SEED = {
  'ppw.theme': 'dark', 'ppw.background': JSON.stringify({ kind: 'liquid' }),
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([{ id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 }]),
};
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'] });
const errs = [];
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, SEED);
const page = await ctx.newPage();
const reqs = [];
page.on('request', (r) => { const u = r.url(); if (/fonts\.googleapis|fonts\.gstatic/.test(u)) reqs.push(u); });
page.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(900);

const font = await page.evaluate(() => {
  const h = document.querySelector('h1, .font-display, [class*="text-4xl"], [class*="text-2xl"]') || document.body;
  return {
    geistLoaded: document.fonts.check('600 24px Geist'),
    families: [...document.fonts].map(f => f.family).filter((v, i, a) => a.indexOf(v) === i),
    headingFontFamily: getComputedStyle(h).fontFamily,
    bodyFontFamily: getComputedStyle(document.body).fontFamily,
  };
});

// open a routine card so the action-disc icon row shows
await page.evaluate(() => { const t = [...document.querySelectorAll('button')].find(x => /toggle details/i.test(x.getAttribute('aria-label') || '')); if (t) t.click(); });
await page.waitForTimeout(450);
const iconStroke = await page.evaluate(() => {
  const g = document.querySelector('.glass-disc svg path, .glass-disc svg line, .glass-disc svg polyline, .glass-disc svg rect');
  const nav = document.querySelector('nav svg path, nav svg line, nav svg polyline, nav svg rect, nav svg circle');
  return { discGlyphStroke: g ? getComputedStyle(g).strokeWidth : null, navGlyphStroke: nav ? getComputedStyle(nav).strokeWidth : null };
});

// AFTER (thin 1.6) — full screen + zoom on the icon row
await page.screenshot({ path: join(OUT, 'after-today.png') });
const card = await page.$('.today-routine-card.is-open');
if (card) await card.screenshot({ path: join(OUT, 'after-iconrow.png') });

// BEFORE (inject stroke-width 2.0 to simulate the pre-change icon set) — same DOM
await page.addStyleTag({ content: 'svg[stroke="currentColor"] * { stroke-width: 2px !important; }' });
await page.waitForTimeout(150);
if (card) await card.screenshot({ path: join(OUT, 'before-iconrow.png') });
await page.screenshot({ path: join(OUT, 'before-today.png') });

await ctx.close();

// light theme too (font + icons)
const lctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await lctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, { ...SEED, 'ppw.theme': 'light', 'ppw.background': JSON.stringify({ kind: 'grey' }) });
const lp = await lctx.newPage();
lp.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
await lp.goto(BASE + '/today', { waitUntil: 'networkidle' });
await lp.evaluate(() => document.fonts.ready); await lp.waitForTimeout(700);
await lp.screenshot({ path: join(OUT, 'after-today-light.png') });
await lctx.close();
await browser.close();

console.log(JSON.stringify({ font, iconStroke, googleFontReqs: reqs.length, consoleErrors: errs.length, errSample: errs.slice(0, 4) }, null, 2));
console.log('OUT ->', OUT);
