// Verify Soft stays OPT-IN (2026-06-17): the default app must be unchanged —
// no data-soft-skin, no .soft-btn anywhere in the normal routes — while
// /soft-lab opts in and /settings exposes the click-sound off toggle (ON default).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = 'http://localhost:' + (process.argv[2] || '4319');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-wt-soft1/screenshots/soft-v1-2026-06-17';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

const htmlProbe = () => page.evaluate(() => ({
  theme: document.documentElement.getAttribute('data-theme'),
  softSkin: document.documentElement.getAttribute('data-soft-skin'),
  tactile: document.documentElement.getAttribute('data-tactile'),
  softBtns: document.querySelectorAll('.soft-btn').length,
  root: document.getElementById('root')?.childElementCount ?? -1,
}));

// 1. Default app — fresh user, NO seed. Must be unchanged (no soft-skin, no soft-btn).
await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const today = await htmlProbe();
console.log('DEFAULT /today', JSON.stringify(today));

// 2. Settings — the click-sound toggle (ON by default) + Button feedback card.
await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const settings = await page.evaluate(() => {
  const sw = document.querySelector('button[role="switch"][aria-label*="Click sound"]');
  return {
    softSkin: document.documentElement.getAttribute('data-soft-skin'),
    soundToggleFound: !!sw,
    soundOn: sw ? sw.getAttribute('aria-checked') : null,
  };
});
await page.evaluate(() => { const el=[...document.querySelectorAll('*')].find(n=>n.textContent==='Button feedback'); if(el) el.scrollIntoView(); });
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, 'settings-button-feedback.png') });
console.log('SETTINGS', JSON.stringify(settings));

// 3. /soft-lab — opts in (soft-skin set, soft-btns present, Sound shows On).
await page.goto(BASE + '/soft-lab', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const lab = await htmlProbe();
const soundLabel = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.soft-btn')].find(x => x.textContent.trim().startsWith('Sound:'));
  return b ? b.textContent.trim() : null;
});
await page.screenshot({ path: join(OUT, 'soft-lab-default-sound-on.png') });
console.log('SOFT-LAB', JSON.stringify({ ...lab, soundLabel }));

console.log('ERRS', errs.length, JSON.stringify(errs.slice(0, 4)));
writeFileSync(join(OUT, 'optin-probe.json'), JSON.stringify({ today, settings, lab, soundLabel, errs }, null, 2));
await browser.close();
