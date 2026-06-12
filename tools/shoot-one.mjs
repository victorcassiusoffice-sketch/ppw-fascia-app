// Quick single-shot for the glass iteration loop: /today at 390px with a
// given theme + background. Usage: node tools/shoot-one.mjs <out.png> <theme> <bgKind>
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const [out, theme = 'dark', bgKind = 'grey'] = process.argv.slice(2);
const todayISO = new Date().toISOString().slice(0, 10);
const SEED = {
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'knee-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'seed-1', type: 'text', title: 'Morning mobility flow', text: 'Cat-camel x10', time: '07:30', durationSec: 600 },
    { id: 'seed-2', type: 'link', title: 'Evening breathwork', url: 'https://example.com/breath', time: '21:00', durationSec: 300 },
  ]),
  'ppw.background': JSON.stringify({ kind: bgKind }),
};

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await ctx.addInitScript(({ seed, theme }) => {
  try { localStorage.setItem('ppw.theme', theme); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {}
}, { seed: SEED, theme });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto('http://localhost:3000/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
console.log('shot ->', out);
