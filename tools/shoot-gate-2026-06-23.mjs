// GATE shoot (whole-app redesign, 2026-06-23) — renders the LIVE built app via
// `vite preview` (base '/') in real Chrome and captures every key screen ×
// {dark,light} + the Add sheet, asserting zero console errors per screen.
// The sandbox preview-shot tool times out on stacked backdrop-filter, so this
// repo Chrome harness is authoritative (ref-fidelity-verification skill).
// Usage: vite preview --port 4173  (then)  node tools/shoot-gate-2026-06-23.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = 'http://localhost:4173';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/gate-2026-06-23';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });

const SCREENS = [
  { id: 'today', path: '/today' },
  { id: 'stack', path: '/protocols' },
  { id: 'add', path: '/today?add=1' },
  { id: 'calendar', path: '/calendar' },
  { id: 'settings', path: '/settings' },
];
const THEMES = ['dark', 'light'];
const report = [];

for (const theme of THEMES) {
  for (const s of SCREENS) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(e.message));
    // seed theme + realistic data before app boots (so screens show real
    // content, not the empty state — a truthful render of the redesign).
    await p.addInitScript((t) => {
      try {
        localStorage.setItem('ppw.theme', JSON.stringify(t));
        const today = new Date().toISOString().slice(0, 10);
        localStorage.setItem('ppw.userStacks::' + today, JSON.stringify([
          { id: 'seed1', title: 'Morning fascia reset', time: '06:30', type: 'routine', durationSec: 600 },
          { id: 'seed2', title: 'Box-breathing audio', time: '14:30', type: 'audio', durationSec: 480 },
          { id: 'seed3', title: 'Magnesium + Zinc', time: '20:00', type: 'supplement' },
          { id: 'seed4', title: 'Sleep protocol — read', time: '21:30', type: 'text', durationSec: 240 },
        ]));
        localStorage.setItem('ppw.completedToday::' + today, JSON.stringify(['seed1']));
        localStorage.setItem('ppw.recurrenceRules', JSON.stringify([
          { id: 'rule1', stack: { id: 'r1', title: 'Morning fascia reset', time: '06:30', type: 'routine' }, anchorDate: today, freq: 'everyday', interval: 1, createdAt: 0 },
        ]));
        localStorage.setItem('ppw.activeRoutines', JSON.stringify({ savedZones: ['neck', 'lower_back', 'hamstrings', 'calves'], level: 'intermediate', lifestyle: 'desk', scheduledTime: '07:00' }));
      } catch {}
    }, theme);
    await p.goto(`${BASE}${s.path}`, { waitUntil: 'networkidle' });
    // force the data-theme attr too (covers any storage-key drift) + settle motion
    await p.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    await p.waitForTimeout(900);
    const probe = await p.evaluate(() => {
      const root = document.getElementById('root');
      const nav = document.querySelector('.botnav');
      const navTabs = nav ? [...nav.querySelectorAll('button')].map(b => (b.querySelector('.navlabel,.stacklabel')?.textContent || b.getAttribute('aria-label') || '').trim()).filter(Boolean) : [];
      return {
        rootKids: root ? root.childElementCount : 0,
        theme: document.documentElement.getAttribute('data-theme'),
        navTabs,
        addSheet: !!document.querySelector('[aria-label="Add to your day"]'),
        calGrid: !!document.querySelector('main') && /June|May|July|2026/.test(document.querySelector('main')?.textContent || ''),
      };
    });
    await p.screenshot({ path: `${OUT}/${theme}-${s.id}.png` });
    report.push({ theme, screen: s.id, errors: errs.length, errSample: errs.slice(0, 3), rootKids: probe.rootKids, navTabs: probe.navTabs, addSheet: probe.addSheet });
    console.log(`[${theme}/${s.id}] rootKids=${probe.rootKids} errors=${errs.length} nav=${JSON.stringify(probe.navTabs)} addSheet=${probe.addSheet}` + (errs.length ? ' :: ' + JSON.stringify(errs.slice(0,2)) : ''));
    await p.close();
  }
}

// reduced-motion proof (one screen)
{
  const p = await ctx.newPage();
  const errs = [];
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/dark-today-reduced.png` });
  report.push({ theme: 'dark', screen: 'today-reduced', errors: errs.length, errSample: errs.slice(0, 3) });
  console.log(`[reduced/today] errors=${errs.length}`);
  await p.close();
}

const totalErrs = report.reduce((a, r) => a + r.errors, 0);
writeFileSync(`${OUT}/REPORT.json`, JSON.stringify({ when: '2026-06-23', totalErrors: totalErrs, report }, null, 2));
console.log('\nGATE TOTAL CONSOLE ERRORS:', totalErrs);
console.log('REPORT:', `${OUT}/REPORT.json`);
await browser.close();
process.exit(totalErrs > 0 ? 1 : 0);
