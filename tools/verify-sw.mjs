// Verify the SW version-sentinel in real Chrome (2026-06-17):
//  Phase A — fresh load, server build == running build → must NOT reload-loop.
//  Phase B — simulate a NEW deploy (rewrite version.json to a different build)
//            while the tab still runs the OLD bundle → sentinel must do exactly
//            ONE guarded hard reload, then settle (sessionStorage loop-guard).
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.argv[2] || '4317';
const BASE = `http://localhost:${PORT}`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const VER = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-wt-night/dist/version.json';
const ORIG = readFileSync(VER, 'utf8');

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();
let loads = 0;
page.on('load', () => { loads++; });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));

try {
  // Phase A — fresh load, builds in sync.
  await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);                 // give SW register + sentinel time
  const loadsA = loads;
  await page.waitForTimeout(2500);                 // watch for a runaway loop
  const loopedA = loads > loadsA;
  console.log('PHASE A (in-sync):', JSON.stringify({ loads: loadsA, extraLoadsWhileWatching: loads - loadsA, loop: loopedA }));

  // Phase B — simulate a new deploy: server now serves a DIFFERENT build while
  // this tab keeps running the old bundle (BUILD constant baked into the JS).
  writeFileSync(VER, JSON.stringify({ build: 'SIMULATED-NEW-DEPLOY' }) + '\n');
  const before = loads;
  await page.reload({ waitUntil: 'networkidle' }); // manual reload → tab re-runs, sentinel sees mismatch
  await page.waitForTimeout(4000);                 // sentinel fires its one guarded reload
  const after = loads;
  let guard = null;
  try { guard = await page.evaluate(() => sessionStorage.getItem('ppw.swReloadedFor')); } catch {}
  await page.waitForTimeout(3000);                 // confirm it SETTLES (no further reloads)
  const settled = loads;
  console.log('PHASE B (stale recovery):', JSON.stringify({
    loadsBeforeManualReload: before,
    loadsAfterSentinelWindow: after,
    loadsAfterSettleWindow: settled,
    sentinelDrivenReloads: after - before - 1,    // minus the 1 manual reload
    loopGuardValue: guard,
    settledNoFurtherReload: settled === after,
    errs: errs.length,
  }));
} finally {
  writeFileSync(VER, ORIG);                         // restore real version.json
  await browser.close();
}
