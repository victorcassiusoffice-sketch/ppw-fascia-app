// Merged-stack minimal + tap-open morph proof (2026-06-16, Vic ref pass).
// Seeds a MERGED (deck) stack, captures the minimal collapsed token + the
// settled open action cluster across theme × background, and probes the REF
// claims (collapsed has no action discs; count tile present; open reveals the
// morph cluster discs, all aria-labelled; 0 console errors; no overflowX).
// Usage: node tools/shoot-mergedstack.mjs [port]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.argv[2] || process.env.PORT || '3519';
const todayISO = new Date().toISOString().slice(0, 10);
const OUT = '.shots/mergedstack';
mkdirSync(OUT, { recursive: true });

const SEED = {
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'd3', type: 'text', title: 'Evening hamstring stretch', text: 'Long holds', time: '18:00', durationSec: 300 },
    { id: 'd4', type: 'text', title: 'Calf release', text: 'Foam roll', time: '18:30', durationSec: 180 },
  ]),
  [`ppw.dailyMerges::${todayISO}`]: JSON.stringify({
    'merge::proof::1': { title: 'Evening wind-down', itemIds: ['d3', 'd4'], collapsed: true, time: '18:00', playOrder: ['d3', 'd4'], mode: 'tabs', activeTabId: 'd3' },
  }),
};

const MATRIX = [
  { theme: 'dark', bg: 'nature' },
  { theme: 'light', bg: 'grey' },
];

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [];

for (const { theme, bg } of MATRIX) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ seed, theme, bg }) => {
    try {
      localStorage.setItem('ppw.theme', theme);
      localStorage.setItem('ppw.background', JSON.stringify({ kind: bg }));
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    } catch (_) {}
  }, { seed: SEED, theme, bg });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`http://localhost:${PORT}/today`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.today-routine-card', { timeout: 15000 });
  await page.waitForTimeout(1100);

  const tag = `${theme}-${bg}`;

  // 1 — COLLAPSED merged token
  await page.screenshot({ path: `${OUT}/collapsed-${tag}.png` });
  const collapsedProbe = await page.evaluate(() => {
    const card = document.querySelector('.today-routine-card');
    const head = card && card.querySelector('.stack-head');
    return {
      cards: document.querySelectorAll('.today-routine-card').length,
      headTappable: !!(head && head.getAttribute('role') === 'button'),
      collapsedActionDiscs: card ? card.querySelectorAll('.stack-actions .stack-act').length : -1,
      countTile: !!(head && head.querySelector('.merged-count-tile')),
      countN: head && head.querySelector('.merged-count-n') ? head.querySelector('.merged-count-n').textContent : null,
      hasChevron: !!(head && head.querySelector('.stack-chevron')),
      gooFilter: !!document.querySelector('#stack-goo'),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  // 2 — tap the merged head open
  await page.evaluate(() => { const h = document.querySelector('.stack-head'); if (h) h.click(); });
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/morph-${tag}.png` });
  await page.waitForTimeout(750);
  await page.screenshot({ path: `${OUT}/open-${tag}.png` });
  const openProbe = await page.evaluate(() => {
    const card = document.querySelector('.today-routine-card.is-open');
    const discs = card ? card.querySelectorAll('.stack-actions .stack-act') : [];
    const cs = discs[0] ? getComputedStyle(discs[0]) : null;
    return {
      openCard: !!card,
      actionDiscs: discs.length,
      discMinSize: cs ? Math.min(parseFloat(cs.width), parseFloat(cs.height)) : 0,
      gooLayerPresent: !!(card && card.querySelector('.stack-goo-layer')),
      allLabelled: [...discs].every((d) => !!d.getAttribute('aria-label')),
      hasUnmerge: [...discs].some((d) => /unmerge/i.test(d.getAttribute('aria-label') || '')),
      tabs: card ? card.querySelectorAll('[role="tab"]').length : 0,
    };
  });

  results.push({ tag, ...collapsedProbe, ...openProbe, errs: errs.length, errSample: errs.slice(0, 3) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
