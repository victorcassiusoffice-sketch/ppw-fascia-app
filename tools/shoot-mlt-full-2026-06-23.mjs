// Verify the full MLT build across the selection flow in real Chrome.
// Drives the actual in-app navigation: Entry → Lifestyle grid → Level.
// Usage: BASE=http://localhost:3007 node tools/shoot-mlt-full-2026-06-23.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3007';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/mlt-full-2026-06-23';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
const results = {};

async function run(theme) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`[${theme}] ` + m.text()); });
  p.on('pageerror', (e) => errs.push(`[${theme}] ` + e.message));

  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
  await p.waitForTimeout(500);
  await p.mouse.click(206, 480); // skip intro
  await p.waitForTimeout(1500);  // let melt-split settle

  // ── Entry ──
  const entry = await p.evaluate(() => {
    const pills = document.querySelectorAll('.mlt-choice');
    const opac = pills.length ? getComputedStyle(pills[0]).opacity : 'n/a';
    return {
      pills: pills.length,
      bigCards: document.querySelectorAll('.protocol-tile').length,
      gooSvg: !!document.querySelector('.liquid-split-goo'),
      firstPillOpacity: opac,
      h1: (document.querySelector('h1')?.innerText || '').replace(/\n/g, ' '),
    };
  });
  results['entry-' + theme] = entry;
  await p.screenshot({ path: `${OUT}/entry-${theme}.png`, fullPage: true });

  // ── Lifestyle grid (click the Lifestyle pill) ──
  await p.click('button[aria-label="Select by Lifestyle"]');
  await p.waitForTimeout(1500);
  const lifestyle = await p.evaluate(() => {
    const toks = document.querySelectorAll('.mlt-token');
    return {
      path: location.pathname,
      tokens: toks.length,
      bigCards: document.querySelectorAll('.card').length,
      firstTokOpacity: toks.length ? getComputedStyle(toks[0]).opacity : 'n/a',
    };
  });
  results['lifestyle-' + theme] = lifestyle;
  await p.screenshot({ path: `${OUT}/lifestyle-${theme}.png`, fullPage: true });

  // ── Level (click a lifestyle token → /level) ──
  await p.click('.mlt-token');
  await p.waitForTimeout(1500);
  const level = await p.evaluate(() => {
    const pills = document.querySelectorAll('.mlt-choice');
    return {
      path: location.pathname,
      pills: pills.length,
      firstPillOpacity: pills.length ? getComputedStyle(pills[0]).opacity : 'n/a',
    };
  });
  results['level-' + theme] = level;
  await p.screenshot({ path: `${OUT}/level-${theme}.png`, fullPage: true });

  await ctx.close();
}

for (const t of ['dark', 'light']) await run(t);
console.log('RESULTS:', JSON.stringify(results, null, 1));
console.log('CONSOLE ERRORS:', errs.length, errs.slice(0, 8));
await browser.close();
