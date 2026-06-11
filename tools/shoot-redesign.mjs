// Liquid-glass critique-loop capture harness (2026-06-11, Phase 3 + GATE-1).
// Drives the LOCALLY INSTALLED Chrome via the Playwright library already
// present in the sibling ppw-designer-2d repo — no new installs, no spend.
//
// Per Design Visual-Critique Gate (BINDING): every route × both themes ×
// mobile 390px + desktop 1440px, fold + full-page PNGs saved as deliverables,
// console errors collected, root-mount + overflow + low-res-image probes.
//
// Usage: node tools/shoot-redesign.mjs <outDir> [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || '.shots/run';
const BASE = process.argv[3] || 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const ROUTES = ['/today', '/protocols', '/modules', '/settings', '/welcome'];
const THEMES = ['dark', 'light'];
const VIEWPORTS = [
  { tag: 'mobile', width: 390, height: 844 },
  { tag: 'desktop', width: 1440, height: 900 },
];

const todayISO = new Date().toISOString().slice(0, 10);
// Demo content so /today renders rows + hero (zones routine + 2 user stacks).
const SEED = {
  'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'knee-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'seed-1', type: 'text', title: 'Morning mobility flow', text: 'Cat-camel x10, hip CARs x5/side', time: '07:30', durationSec: 600 },
    { id: 'seed-2', type: 'link', title: 'Evening breathwork', url: 'https://example.com/breath', time: '21:00', durationSec: 300 },
  ]),
};

const run = async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const results = [];

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
      await ctx.addInitScript(({ seed, theme }) => {
        try {
          localStorage.setItem('ppw.theme', theme);
          for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
        } catch (_) {}
      }, { seed: SEED, theme });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

      for (const route of ROUTES) {
        const name = `${route.replace(/\//g, '_') || '_root'}-${theme}-${vp.tag}`;
        errors.length = 0;
        await page.goto(BASE + route, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1800); // let enters/stagger/trace settle
        const probe = await page.evaluate(() => {
          const root = document.getElementById('root');
          const overflowX = document.documentElement.scrollWidth > window.innerWidth + 1;
          const lowres = [...document.images]
            .filter((i) => i.naturalWidth > 0 && i.getBoundingClientRect().width / i.naturalWidth > 1.3)
            .map((i) => i.currentSrc.split('/').pop());
          return { rootChildren: root ? root.childElementCount : -1, overflowX, lowres, title: document.title };
        });
        await page.screenshot({ path: join(OUT, `${name}-fold.png`) });
        await page.screenshot({ path: join(OUT, `${name}-full.png`), fullPage: true });
        results.push({ route, theme, viewport: vp.tag, ...probe, consoleErrors: [...errors] });
        console.log(name, JSON.stringify({ root: probe.rootChildren, overflowX: probe.overflowX, errs: errors.length }));
      }
      await ctx.close();
    }
  }

  // Reduced-motion verification pass (no screenshots needed beyond /today).
  const rmCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await rmCtx.addInitScript(({ seed }) => {
    try { localStorage.setItem('ppw.theme', 'dark'); for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); } catch (_) {}
  }, { seed: SEED });
  const rmPage = await rmCtx.newPage();
  const rmErrors = [];
  rmPage.on('pageerror', (e) => rmErrors.push(e.message));
  await rmPage.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await rmPage.waitForTimeout(800);
  const rm = await rmPage.evaluate(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.getElementById('root');
    // Every row must already be at full opacity / settled transform.
    const rows = [...document.querySelectorAll('.today-routine-card')].map((el) => {
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, transform: cs.transform };
    });
    return { reduce, rootChildren: root ? root.childElementCount : -1, rows };
  });
  await rmPage.screenshot({ path: join(OUT, '_today-dark-mobile-reduced-motion.png') });
  results.push({ route: '/today', theme: 'dark', viewport: 'mobile-reduced-motion', ...rm, consoleErrors: rmErrors });
  await rmCtx.close();

  await browser.close();
  writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  console.log('DONE ->', OUT);
};

run().catch((e) => { console.error(e); process.exit(1); });
