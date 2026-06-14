// Proof shots for the 3 phone-test fixes (2026-06-14). Local Chrome via
// Playwright. Usage: node tools/shoot-fixes.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/fixes-2026-06-14';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

const SEED = {
  'ppw.theme': 'dark',
  'ppw.background': JSON.stringify({ kind: 'skin', skinId: 'forest-mist' }),
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'm1', type: 'text', title: 'Evening stretch', text: 'Hamstrings', time: '18:00', durationSec: 300 },
    { id: 'm2', type: 'text', title: 'Cool-down', text: 'Calves', time: '18:30', durationSec: 180 },
  ]),
  [`ppw.dailyMerges::${todayISO}`]: JSON.stringify({
    'merge::fix::1': { title: 'Evening wind-down', itemIds: ['m1', 'm2'], collapsed: true, time: '18:00', playOrder: ['m1', 'm2'], mode: 'parallel', activeTabId: 'm1' },
  }),
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((seed) => { try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {} }, SEED);
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite/i.test(m.text())) errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

// (b) merged stack with the unmerge/collapse glass icon
await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const unmergePresent = await page.evaluate(() =>
  [...document.querySelectorAll('button')].some(b => /unmerge stack/i.test(b.getAttribute('aria-label') || '')));
await page.screenshot({ path: join(OUT, 'b-merged-stack-collapse-icon.png') });

// (c) mm:ss timer in Add Stack → Video
await page.evaluate(() => {
  const add = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title') || '').includes('Add a custom stack'));
  if (add) add.click();
});
await page.waitForTimeout(500);
await page.evaluate(() => { const v = document.querySelector('button[aria-label="Video"]'); if (v) v.click(); });
await page.waitForTimeout(400);
const mmss = await page.evaluate(() => ({
  min: !!document.querySelector('input[aria-label="Minutes"]'),
  sec: !!document.querySelector('input[aria-label="Seconds"]'),
}));
await page.screenshot({ path: join(OUT, 'c-mmss-timer-picker.png') });

// (a) home control destination — the logo from /today lands on the landing
await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const homeHref = await page.evaluate(() => {
  const a = document.querySelector('header a[aria-label="PPW home"]');
  return a ? a.getAttribute('href') : null;
});
await page.evaluate(() => { const a = document.querySelector('header a[aria-label="PPW home"]'); if (a) a.click(); });
await page.waitForTimeout(700);
// tap to skip the ~1.6s landing splash so the settled Entry hero is captured
await page.mouse.click(195, 200);
await page.waitForTimeout(1400);
const landed = await page.evaluate(() => ({ path: location.pathname, isLanding: /SESSION BUILDER|Unlock|your body/i.test(document.body.innerText) }));
await page.screenshot({ path: join(OUT, 'a-home-from-today.png') });

await browser.close();
console.log(JSON.stringify({ unmergePresent, mmss, homeHref, landed, errs: errs.length, errSample: errs.slice(0, 3) }, null, 2));
console.log('OUT ->', OUT);
