// REFINEMENT-4 proof shot — REF-06 thumbnail tile + REF-07 deck/select-to-front
// + MergedStack glass rim, all in one /today frame. Seeds a merged stack and a
// selected (lifted) solo card, then captures dark+nature.
// Usage: node tools/shoot-deck-proof.mjs <out.png> [theme] [bgKind]
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const [out = '.shots/refinement4/deck-proof.png', theme = 'dark', bgKind = 'nature'] = process.argv.slice(2);
const todayISO = new Date().toISOString().slice(0, 10);
const SEED = {
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'd1', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '07:00', durationSec: 900 },
    { id: 'd2', type: 'text', title: 'Breathwork reminder', text: 'Box breathing', time: '09:30', durationSec: 120 },
    { id: 'd3', type: 'text', title: 'Evening stretch', text: 'Hamstrings', time: '18:00', durationSec: 300 },
    { id: 'd4', type: 'text', title: 'Cool-down', text: 'Calves', time: '18:30', durationSec: 180 },
  ]),
  [`ppw.dailyMerges::${todayISO}`]: JSON.stringify({
    'merge::proof::1': { title: 'Evening wind-down', itemIds: ['d3', 'd4'], collapsed: true, time: '18:00', playOrder: ['d3', 'd4'], mode: 'parallel', activeTabId: 'd3' },
  }),
  // pre-select the merged stack's lead so its z-lift / scale reads in the still
  'ppw.background': JSON.stringify({ kind: bgKind }),
};

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(({ seed, theme }) => {
  try { localStorage.setItem('ppw.theme', theme); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {}
}, { seed: SEED, theme });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://localhost:3000/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
// Select a solo card to demonstrate REF-07 select-to-front (z-lift + scale).
await page.evaluate(() => {
  const tick = document.querySelector('.today-routine-card input[type="checkbox"], .today-routine-card [role="checkbox"]');
  if (tick) tick.click();
});
await page.waitForTimeout(700);
const probe = await page.evaluate(() => {
  const cards = [...document.querySelectorAll('.today-routine-card')];
  const merged = cards.find((c) => c.querySelector('[aria-label*="xpand stack"],[aria-label*="ollapse stack"]'));
  const mergedBox = merged ? getComputedStyle(merged).boxShadow.includes('255, 255, 255') : false;
  const lifted = [...document.querySelectorAll('.stack-deck > *')].some((el) => Number(getComputedStyle(el).zIndex) >= 30);
  return { cards: cards.length, mergedGlassRim: mergedBox, anyLifted: lifted, tiles: document.querySelectorAll('.stack-deck .glass-disc').length };
});
await page.screenshot({ path: out });
await browser.close();
console.log('shot ->', out, JSON.stringify({ ...probe, errs: errs.length }));
