// Skin-feature proof + render verification (2026-06-14, Vic feature pass).
// Captures the Settings skin picker + /today under several skins × both themes
// (incl. bright-tone legibility), and the bulk-toolbar glass icon buttons.
// Drives the locally-installed Chrome via Playwright. Probes root-mount +
// console errors per frame. Usage: node tools/shoot-skins.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/skins-2026-06-14';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

const STACKS = JSON.stringify([
  { id: 'd1', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '07:00', durationSec: 900 },
  { id: 'd2', type: 'text', title: 'Breathwork reminder', text: 'Box breathing', time: '09:30', durationSec: 120 },
  { id: 'd3', type: 'text', title: 'Evening stretch', text: 'Hamstrings', time: '18:00', durationSec: 300 },
]);

// name, route, theme, skinId, selectFirst (show bulk glass-icon toolbar)
const SHOTS = [
  { name: 'skin-picker-dark',     route: '/settings', theme: 'dark',  skin: 'orbit',        scrollToSkins: true },
  { name: 'skin-picker-light',    route: '/settings', theme: 'light', skin: 'forest-mist',  scrollToSkins: true },
  { name: 'today-forest-mist',    route: '/today',    theme: 'dark',  skin: 'forest-mist',  selectFirst: true },
  { name: 'today-orbit',          route: '/today',    theme: 'dark',  skin: 'orbit' },
  { name: 'today-crimson-peak',   route: '/today',    theme: 'dark',  skin: 'crimson-peak' },
  { name: 'today-saturn',         route: '/today',    theme: 'dark',  skin: 'saturn',       selectFirst: true },
  { name: 'today-azure-bright',   route: '/today',    theme: 'dark',  skin: 'azure' },
  { name: 'today-chrome-light',   route: '/today',    theme: 'light', skin: 'chrome' },
  { name: 'today-metropolis',     route: '/today',    theme: 'dark',  skin: 'metropolis' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];

for (const s of SHOTS) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ theme, skin, stacks, todayISO }) => {
    try {
      localStorage.setItem('ppw.theme', theme);
      localStorage.setItem('ppw.background', JSON.stringify({ kind: 'skin', skinId: skin }));
      localStorage.setItem(`ppw.userStacks::${todayISO}`, stacks);
    } catch (_) {}
  }, { theme: s.theme, skin: s.skin, stacks: STACKS, todayISO });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite/i.test(m.text())) errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + s.route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (s.selectFirst) {
    await page.evaluate(() => {
      const t = document.querySelector('.today-routine-card input[type="checkbox"], .today-routine-card [role="checkbox"]');
      if (t) t.click();
    });
    await page.waitForTimeout(500);
  }
  if (s.scrollToSkins) {
    await page.evaluate(() => {
      const grid = document.querySelector('[aria-label="Background skins"]');
      if (grid) grid.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(400);
  }
  const probe = await page.evaluate(() => ({
    root: document.getElementById('root')?.childElementCount ?? -1,
    dataBg: document.documentElement.getAttribute('data-bg'),
    tone: document.documentElement.getAttribute('data-bg-tone'),
    skinImgLoaded: (() => { const i = document.querySelector('.app-bg img'); return i ? i.complete && i.naturalWidth > 0 : false; })(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  await page.screenshot({ path: join(OUT, `${s.name}.png`) });
  results.push({ ...s, ...probe, errs: errs.length, errSample: errs.slice(0, 2) });
  console.log(s.name, JSON.stringify({ root: probe.root, bg: probe.dataBg, tone: probe.tone, imgLoaded: probe.skinImgLoaded, errs: errs.length }));
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.log('OUT ->', OUT);
