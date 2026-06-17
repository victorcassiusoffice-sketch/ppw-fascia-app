// PROTOTYPE capture (3C liquid de-clutter). Today collapsed + reveal-open,
// dark+light, on :3029. Usage: node tools/shoot-proto.mjs [outDir] [port]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/proto-3c';
const PORT = process.argv[3] || '3029';
const BASE = `http://localhost:${PORT}`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
const seed = (theme) => ({
  'ppw.theme': theme,
  'ppw.background': JSON.stringify({ kind: 'auto' }),
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right', 'quad-left'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips + lower back', time: '07:30', durationSec: 240 },
    { id: 's2', type: 'video', title: 'Calf release flow', url: 'https://youtube.com/watch?v=x', time: '12:00', durationSec: 300 },
    { id: 's3', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
  ]),
});
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
async function run(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(`[${theme}] ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`[${theme}] ${e.message}`));
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(OUT, `today-${theme}-collapsed.png`) });
  // open the liquid "More" reveal
  const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /show coach and tips/i.test(x.getAttribute('aria-label') || '')); if (b) { b.click(); return true; } return false; });
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(OUT, `today-${theme}-revealed.png`) });
  const probe = await p.evaluate(() => ({
    rootChildren: document.getElementById('root')?.childElementCount || 0,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  await ctx.close();
  return { theme, revealFound: ok, probe };
}
const r1 = await run('dark');
const r2 = await run('light');
await browser.close();
console.log(JSON.stringify({ r1, r2, consoleErrors: errs.length, errSample: errs.slice(0, 5) }, null, 2));
console.log('OUT ->', OUT);
