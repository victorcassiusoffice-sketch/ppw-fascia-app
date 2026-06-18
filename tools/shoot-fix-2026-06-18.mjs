// Glass-frost + Soft-theme verification (2026-06-18). Real local Chrome.
// Captures: Today glass (dark, over a skin), an OPEN dialog/sheet (heavy frost),
// and the Soft lab across skins. Usage: node tools/shoot-fix-2026-06-18.mjs <outDir>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/fix-2026-06-18/after';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

function seed(theme, extra) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify({ kind: 'skin', skinId: 'azure' }),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
    ...(extra || {}),
  };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];

async function page(theme, extra) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, extra));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p };
}

async function shot(p, label, route) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(OUT, `${label}.png`) });
}

// 1. Today glass — dark over azure skin (cards + dock = the everyday glass)
{ const { ctx, p } = await page('dark'); await shot(p, 'today-dark', '/today'); await ctx.close(); }

// 2. An open SHEET (Add Stack) — the heavy-frost dialog surface.
{ const { ctx, p } = await page('dark');
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  const addBtn = await p.$('[aria-label*="Add" i], button:has-text("Add")');
  if (addBtn) { await addBtn.click(); await p.waitForTimeout(700); }
  await p.screenshot({ path: join(OUT, 'sheet-dark.png') });
  await ctx.close();
}

// 3. Soft lab across the 5 skins (light theme).
for (const skin of ['cream', 'slate', 'frost', 'honey', 'sage']) {
  const { ctx, p } = await page('light');
  await p.addInitScript(() => {}, {});
  await p.goto(BASE + '/soft-lab', { waitUntil: 'networkidle' });
  await p.evaluate((s) => { document.documentElement.setAttribute('data-soft-skin', s); document.documentElement.setAttribute('data-theme', 'light'); }, skin);
  await p.waitForTimeout(500);
  await p.screenshot({ path: join(OUT, `soft-${skin}.png`) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ consoleErrors: errs.length, errSample: errs.slice(0, 5) }, null, 2));
console.log('OUT ->', OUT);
