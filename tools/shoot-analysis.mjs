// REF-difference analysis capture (2026-06-17). Real local Chrome on :3029.
// Captures Today/Protocols/Modules/Settings × dark/light + a skin, plus an
// OPENED stack card (the liquid morph) and the bottom nav, and probes DOM
// clutter metrics (visible interactive controls per screen). Usage:
//   node tools/shoot-analysis.mjs [outDir] [port]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/analysis-2026-06-17';
const PORT = process.argv[3] || '3029';
const BASE = `http://localhost:${PORT}`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

function seed(theme, bg) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify(bg),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right', 'quad-left'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips + lower back', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'video', title: 'Calf release flow', url: 'https://youtube.com/watch?v=x', time: '12:00', durationSec: 300 },
      { id: 's3', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
  };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
const metrics = {};

async function open(theme, bg) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, bg));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p };
}

async function shot(p, route, label) {
  await p.goto(BASE + route, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: join(OUT, `${label}.png`) });
  // clutter probe: count visible interactive controls + text nodes in main
  const m = await p.evaluate(() => {
    const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0' && r.top < window.innerHeight && r.bottom > 0; };
    const ctrls = [...document.querySelectorAll('button, a, input, [role=button], [role=checkbox], [role=switch]')].filter(vis);
    const main = document.querySelector('main') || document.body;
    return {
      visibleControls: ctrls.length,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      rootChildren: document.getElementById('root')?.childElementCount || 0,
    };
  });
  return m;
}

// Dark default ground
{
  const { ctx, p } = await open('dark', { kind: 'auto' });
  metrics['today-dark'] = await shot(p, '/today', 'today-dark');
  metrics['protocols-dark'] = await shot(p, '/protocols', 'protocols-dark');
  metrics['modules-dark'] = await shot(p, '/modules', 'modules-dark');
  metrics['settings-dark'] = await shot(p, '/settings', 'settings-dark');
  // open a stack card to capture the liquid morph cluster
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const h = document.querySelector('.stack-head'); if (h) h.click(); });
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(OUT, 'today-dark-cardopen.png') });
  // nav crop
  const nav = await p.$('.botnav');
  if (nav) await nav.screenshot({ path: join(OUT, 'nav-dark.png') });
  await ctx.close();
}
// Light default ground
{
  const { ctx, p } = await open('light', { kind: 'auto' });
  metrics['today-light'] = await shot(p, '/today', 'today-light');
  metrics['settings-light'] = await shot(p, '/settings', 'settings-light');
  const nav = await p.$('.botnav');
  if (nav) await nav.screenshot({ path: join(OUT, 'nav-light.png') });
  await ctx.close();
}
// Dark over the nature skin (the closest to Vic's jungle reference)
{
  const { ctx, p } = await open('dark', { kind: 'skin', skinId: 'forest-mist' });
  metrics['today-dark-forest'] = await shot(p, '/today', 'today-dark-forest');
  await ctx.close();
}
// Grey ground (REF-05) dark
{
  const { ctx, p } = await open('dark', { kind: 'grey' });
  metrics['today-dark-grey'] = await shot(p, '/today', 'today-dark-grey');
  await ctx.close();
}

await browser.close();
writeFileSync(join(OUT, 'metrics.json'), JSON.stringify({ metrics, consoleErrors: errs.length, errSample: errs.slice(0, 8) }, null, 2));
console.log(JSON.stringify({ metrics, consoleErrors: errs.length, errSample: errs.slice(0, 8) }, null, 2));
console.log('OUT ->', OUT);
