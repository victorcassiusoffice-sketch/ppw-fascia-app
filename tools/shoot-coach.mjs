// Render-verify the Coach surface (2026-06-16). Captures the Today entry tile
// and the /coach page across themes + viewports against the repo's own Chrome
// harness (authoritative — the sandbox preview times out on stacked
// backdrop-filter). FAILS the process if any console error / pageerror fires or
// if the expected coach controls are missing — so a green run IS the proof.
//
// Usage: node tools/shoot-coach.mjs   (vite preview must be live on :3000)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-coach-wt/.shots/coach';
mkdirSync(OUT, { recursive: true });

const todayISO = new Date().toISOString().slice(0, 10);
const SEED = {
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'knee-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'seed-1', type: 'text', title: 'Morning mobility flow', text: 'Cat-camel x10', time: '07:30', durationSec: 600 },
    { id: 'seed-2', type: 'link', title: 'Evening breathwork', url: 'https://example.com/breath', time: '21:00', durationSec: 300 },
  ]),
  'ppw.background': JSON.stringify({ kind: 'grey' }),
};

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];

async function shoot(name, { route, theme, width, height, assertSel }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ seed, theme }) => {
    try { localStorage.setItem('ppw.theme', theme); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {}
  }, { seed: SEED, theme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] CONSOLE ${m.text()}`); });
  await page.goto(`http://localhost:3017${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (assertSel) {
    const found = await page.locator(assertSel).first().count();
    if (!found) errors.push(`[${name}] MISSING expected selector: ${assertSel}`);
  }
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path });
  console.log('shot ->', path);
  await ctx.close();
}

// Today with the "Ask your coach" entry tile (mobile, dark + light)
await shoot('today-entry-dark-390',  { route: '/today', theme: 'dark',  width: 390, height: 844, assertSel: 'button[aria-label="Open your Wellness Coach"]' });
await shoot('today-entry-light-390', { route: '/today', theme: 'light', width: 390, height: 844, assertSel: 'button[aria-label="Open your Wellness Coach"]' });
// The /coach destination (mobile dark + light, desktop dark)
await shoot('coach-dark-390',  { route: '/coach', theme: 'dark',  width: 390, height: 844,  assertSel: 'button[aria-label="Open your Wellness Coach in a new tab"]' });
await shoot('coach-light-390', { route: '/coach', theme: 'light', width: 390, height: 844,  assertSel: 'button[aria-label="Open your Wellness Coach in a new tab"]' });
await shoot('coach-dark-1280', { route: '/coach', theme: 'dark',  width: 1280, height: 900, assertSel: 'button[aria-label="Open your Wellness Coach in a new tab"]' });

await browser.close();

if (errors.length) {
  console.error('\n❌ RENDER-VERIFY FAILED:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\n✅ RENDER-VERIFY PASSED — all routes mounted, controls present, zero console errors.');
