// Local verification (2026-06-22 design-dept rebuild). Serves the built dist
// and proves: default background = ANIMATED liquid ground (motion via 2-frame
// hash diff), glass cards carry backdrop-filter, app mounts, 0 console errors.
// Usage: node tools/shoot-rebuild-2026-06-22.mjs <baseURL>
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/rebuild-2026-06-22';
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
    // NOTE: deliberately NO ppw.background key → exercises the new default (auto → liquid).
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
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
    const cardEl = document.querySelector('.glass, .glass-strong, .card-glass, [class*="glass"]');
    const cs = cardEl ? getComputedStyle(cardEl) : null;
    return {
      rootChildren: root ? root.childElementCount : 0,
      liquidCanvas: !!canvas,
      canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
      sampleGlassClass: cardEl ? cardEl.className : null,
      sampleBackdrop: cs ? (cs.backdropFilter || cs.webkitBackdropFilter) : null,
    };
  });

  // Motion proof: hash a background-only clip (top strip, above the cards) twice.
  const clip = { x: 0, y: 0, width: 390, height: 70 };
  const a = await p.screenshot({ clip });
  await p.waitForTimeout(1300);
  const b = await p.screenshot({ clip });
  const moving = md5(a) !== md5(b);

  await p.screenshot({ path: join(OUT, `today-${theme}.png`) });
  await ctx.close();
  return { theme, probe, moving, errCount: errs.length, errSample: errs.slice(0, 4) };
}

const dark = await shoot('dark');
const light = await shoot('light');
await browser.close();
console.log(JSON.stringify({ dark, light }, null, 2));
console.log('OUT ->', OUT);
