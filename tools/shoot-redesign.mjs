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
    // REF-06 proof: a YouTube stack whose tile shows REAL video art.
    { id: 'seed-3', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '12:00', durationSec: 900 },
  ]),
};

/* Refinement 2 — background-variant extras (REF-01/04/05): /today under the
   non-default BG per theme + a CUSTOM image bg (canvas-generated blob seeded
   straight into the app's IndexedDB media store — no asset, no network). */
const BG_EXTRAS = [
  { name: 'today-dark-bgGrey',   theme: 'dark',  bg: { kind: 'grey' } },
  { name: 'today-light-bgNature', theme: 'light', bg: { kind: 'nature' } },
  { name: 'today-dark-bgCustom', theme: 'dark',  bg: { kind: 'custom', mediaId: 'ppw-custom-bg' }, seedCustom: true },
  // Lens 5 (Android parity, BINDING skill): Android phone viewport pass.
  { name: 'today-dark-android',  theme: 'dark',  bg: { kind: 'auto' }, viewport: { width: 412, height: 915 } },
  { name: 'settings-dark-android', theme: 'dark', bg: { kind: 'auto' }, viewport: { width: 412, height: 915 }, route: '/settings' },
  // Lens 4: glass-intensity LOW (the comfort/perf level) renders legibly.
  { name: 'today-dark-glassLow', theme: 'dark',  bg: { kind: 'auto' }, glass: 'low' },
];

const seedCustomBgScript = () => new Promise((resolve) => {
  const c = document.createElement('canvas');
  c.width = 800; c.height = 1600;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 800, 1600);
  grad.addColorStop(0, '#2b1d3a'); grad.addColorStop(0.5, '#0f2f3c'); grad.addColorStop(1, '#3a2710');
  g.fillStyle = grad; g.fillRect(0, 0, 800, 1600);
  for (let i = 0; i < 40; i++) {
    g.beginPath();
    g.arc(Math.sin(i * 7.3) * 380 + 400, (i / 40) * 1600, 60 + (i % 5) * 28, 0, Math.PI * 2);
    g.fillStyle = `rgba(255,255,255,${0.02 + (i % 3) * 0.015})`;
    g.fill();
  }
  c.toBlob((blob) => {
    const r = indexedDB.open('ppw-media-store', 1);
    r.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains('files')) db.createObjectStore('files'); };
    r.onsuccess = () => {
      const tx = r.result.transaction('files', 'readwrite');
      tx.objectStore('files').put(blob, 'ppw-custom-bg');
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    };
    r.onerror = () => resolve(false);
  }, 'image/png');
});

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

  // Background / platform / intensity extras.
  for (const extra of BG_EXTRAS) {
    const ctx = await browser.newContext({ viewport: extra.viewport || { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(({ seed, theme, bg, glass }) => {
      try {
        localStorage.setItem('ppw.theme', theme);
        localStorage.setItem('ppw.background', JSON.stringify(bg));
        if (glass) localStorage.setItem('ppw.glassIntensity', glass);
        for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      } catch (_) {}
    }, { seed: SEED, theme: extra.theme, bg: extra.bg, glass: extra.glass || null });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
    await page.goto(BASE + (extra.route || '/today'), { waitUntil: 'networkidle' });
    if (extra.seedCustom) {
      await page.evaluate(seedCustomBgScript);
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(1800);
    const probe = await page.evaluate(() => ({
      rootChildren: document.getElementById('root')?.childElementCount ?? -1,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      dataBg: document.documentElement.getAttribute('data-bg'),
    }));
    await page.screenshot({ path: join(OUT, `_${extra.name}-fold.png`) });
    results.push({ route: '/today', theme: extra.theme, viewport: `mobile-${extra.name}`, ...probe, consoleErrors: [...errors] });
    console.log(extra.name, JSON.stringify({ root: probe.rootChildren, bg: probe.dataBg, errs: errors.length }));
    await ctx.close();
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
