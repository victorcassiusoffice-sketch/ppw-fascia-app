// Stack-card minimal + tap-open morph proof (2026-06-16, Vic reference pass).
// Captures the COLLAPSED token, the mid-MORPH frame, and the settled OPEN
// action cluster across theme × background, and probes the DOM for the REF
// claims (collapsed has no action discs; open reveals the morph cluster; goo
// filter present; 0 console errors; no horizontal overflow).
// Usage: node tools/shoot-stackcard.mjs [port]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.argv[2] || process.env.PORT || '3517';
const todayISO = new Date().toISOString().slice(0, 10);
const OUT = '.shots/stackcard';
mkdirSync(OUT, { recursive: true });

const SEED = {
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 's1', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '07:00', durationSec: 900 },
    { id: 's2', type: 'text', title: 'Box breathing', text: 'Four counts in, four out', time: '09:30', durationSec: 120 },
    { id: 's3', type: 'text', title: 'Evening hamstring stretch', text: 'Long holds', time: '18:00', durationSec: 300 },
  ]),
};

const MATRIX = [
  { theme: 'dark', bg: 'nature' },
  { theme: 'dark', bg: 'grey' },
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

  // 1 — COLLAPSED token
  await page.screenshot({ path: `${OUT}/collapsed-${tag}.png` });
  const collapsedProbe = await page.evaluate(() => {
    const card = document.querySelector('.today-routine-card');
    const head = card && card.querySelector('.stack-head');
    return {
      cards: document.querySelectorAll('.today-routine-card').length,
      headTappable: !!(head && head.getAttribute('role') === 'button'),
      // collapsed token must NOT carry the action discs (they live in the open cluster)
      collapsedActionDiscs: card ? card.querySelectorAll('.stack-actions .stack-act').length : -1,
      hasThumb: !!(head && head.querySelector('.glass-disc')) || !!(head && head.querySelector('img')),
      hasChevron: !!(head && head.querySelector('.stack-chevron')),
      gooFilter: !!document.querySelector('#stack-goo'),
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    };
  });

  // 2 — tap the card open; grab a mid-morph frame, then the settled frame
  await page.evaluate(() => { const h = document.querySelector('.stack-head'); if (h) h.click(); });
  await page.waitForTimeout(130);
  await page.screenshot({ path: `${OUT}/morph-${tag}.png` });
  await page.waitForTimeout(700);
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
      // every disc must be aria-labelled (i18n-ready / a11y)
      allLabelled: [...discs].every((d) => !!d.getAttribute('aria-label')),
    };
  });

  results.push({ tag, ...collapsedProbe, ...openProbe, errs: errs.length, errSample: errs.slice(0, 3) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
