// MOCK proof for the RADICAL UI REDO (2026-06-22). Renders the redesigned Today
// screen (dark + light) at phone size on the NEW default ground (auto → clean
// liquid), and captures a 2-frame motion proof (full screen, ~1.4s apart) so Vic
// can see the liquid ground actually MOVES. No deploy — branch-only mock.
// Usage: node tools/shoot-radical-redo-2026-06-22.mjs <baseURL>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/radical-redo-2026-06-22';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const md5 = (buf) => createHash('md5').update(buf).digest('hex');

async function shoot(theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = [];
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, {
    'ppw.theme': theme,
    // NO ppw.background key → exercises the new default (auto → clean liquid).
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips + lower back', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'audio', title: 'Magnesium + Zinc', text: '', time: '20:00', durationSec: 300 },
      { id: 's3', type: 'text', title: 'Evening calf release', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
  });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest|sw\.js|ServiceWorker|404/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1400);

  const probe = await p.evaluate(() => {
    const root = document.getElementById('root');
    const canvas = document.querySelector('.liquid-bg-canvas');
    const cardEl = document.querySelector('.glass-strong, .card');
    const cs = cardEl ? getComputedStyle(cardEl) : null;
    const nav = document.querySelector('.botnav');
    return {
      rootChildren: root ? root.childElementCount : 0,
      liquidCanvas: !!canvas,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
      cardBackdrop: cs ? (cs.backdropFilter || cs.webkitBackdropFilter) : null,
      navPresent: !!nav,
    };
  });

  // Full-screen 3-frame motion proof (saved for Vic) spread over ~5s so the
  // slow/elegant real-time drift accumulates into a CLEARLY visible travel.
  const fa = await p.screenshot({ path: join(OUT, `motion-${theme}-a.png`) });
  await p.waitForTimeout(2600);
  const fb = await p.screenshot({ path: join(OUT, `motion-${theme}-b.png`) });
  await p.waitForTimeout(2600);
  const fc = await p.screenshot({ path: join(OUT, `motion-${theme}-c.png`) });
  const moving = md5(fa) !== md5(fb) && md5(fb) !== md5(fc);

  // Hero shot.
  await p.screenshot({ path: join(OUT, `today-${theme}.png`) });
  await ctx.close();
  return { theme, probe, moving, errCount: errs.length, errSample: errs.slice(0, 4) };
}

const dark = await shoot('dark');
const light = await shoot('light');
await browser.close();
console.log(JSON.stringify({ dark, light }, null, 2));
console.log('OUT ->', OUT);
