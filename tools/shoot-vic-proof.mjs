// Crisp 2x phone-viewport proof set for Vic to eyeball. Home, the stack/deck
// view (REF-06 tile + REF-07 deck + selection), protocols, and the body-zone map.
// Usage: node tools/shoot-vic-proof.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/vic-proof-2026-06-14';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

const SEED = {
  'ppw.theme': 'dark',
  'ppw.background': JSON.stringify({ kind: 'nature' }),
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'knee-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'd1', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '07:00', durationSec: 900 },
    { id: 'd2', type: 'text', title: 'Breathwork reminder', text: 'Box breathing', time: '09:30', durationSec: 120 },
    { id: 'd3', type: 'text', title: 'Evening stretch', text: 'Hamstrings', time: '18:00', durationSec: 300 },
    { id: 'd4', type: 'text', title: 'Cool-down', text: 'Calves', time: '18:30', durationSec: 180 },
  ]),
  [`ppw.dailyMerges::${todayISO}`]: JSON.stringify({
    'merge::proof::1': { title: 'Evening wind-down', itemIds: ['d3', 'd4'], collapsed: true, time: '18:00', playOrder: ['d3', 'd4'], mode: 'parallel', activeTabId: 'd3' },
  }),
};

const SHOTS = [
  { name: '1-home-landing',        route: '/welcome' },
  { name: '2-today-stack-deck',    route: '/today', selectFirst: true },
  { name: '3-protocols',           route: '/protocols' },
  { name: '4-body-zone-map',       route: '/body' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript((seed) => { try { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {} }, SEED);
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

for (const s of SHOTS) {
  await page.goto(BASE + s.route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1300);
  if (s.selectFirst) {
    await page.evaluate(() => {
      const tick = document.querySelector('.today-routine-card input[type="checkbox"], .today-routine-card [role="checkbox"]');
      if (tick) tick.click();
    });
    await page.waitForTimeout(600);
  }
  const root = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? -1);
  await page.screenshot({ path: join(OUT, `${s.name}.png`) });
  console.log(s.name, JSON.stringify({ route: s.route, root, errs: errs.length }));
}
await browser.close();
console.log('OUT ->', OUT);
