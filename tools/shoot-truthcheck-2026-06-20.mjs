// TRUTH CHECK 2026-06-20 — render the REAL live GitHub Pages build with the
// service worker BLOCKED (no device-cache illusion). Reports, against the live
// Today screen: build hash, Protocol-on-Today?, nav structure, glass blur/tint,
// liquid SMIL motion present?, + screenshots. Usage: node tools/shoot-truthcheck-2026-06-20.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const BASE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/truthcheck-2026-06-20';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
// serviceWorkers:'block' => we see the TRUE network build, not a cached SW build.
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block',
});
const errs = [];
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));

const liveVersion = await (await fetch(`${BASE}/version.json?cb=${Date.now()}`)).text();

await p.goto(`${BASE}/today?cb=${Date.now()}`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1800);

const report = await p.evaluate(() => {
  const txt = (document.body.innerText || '');
  // Bottom nav
  const nav = document.querySelector('nav') || document.querySelector('[class*="dock"],[class*="bottom"]');
  const navButtons = nav ? [...nav.querySelectorAll('a,button')].map(b => (b.getAttribute('aria-label') || b.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean) : [];
  // Protocol button anywhere in the MAIN content (not nav)
  const main = document.querySelector('main') || document.body;
  const protoInMain = [...main.querySelectorAll('a,button')]
    .map(b => (b.innerText || b.getAttribute('aria-label') || '').trim())
    .filter(t => /protocol/i.test(t));
  // Stack hub presence
  const stackHit = navButtons.filter(t => /stack/i.test(t));
  // Glass tokens
  const cs = getComputedStyle(document.documentElement);
  const tokens = {};
  for (const k of ['--glass-blur','--glass-blur-strong','--glass-tint','--glass-bg','--glass-rim','--glass-specular','--glass-fill']) {
    tokens[k] = cs.getPropertyValue(k).trim();
  }
  // sample an actual glass element's backdrop-filter
  const glassEl = document.querySelector('[class*="glass"]');
  const glassBackdrop = glassEl ? getComputedStyle(glassEl).backdropFilter || getComputedStyle(glassEl).webkitBackdropFilter : null;
  // Liquid motion: SMIL animate inside the svg filter
  const animates = [...document.querySelectorAll('animate')].map(a => ({ attr: a.getAttribute('attributeName'), values: a.getAttribute('values')||a.getAttribute('from') }));
  const liquidFilter = !!document.querySelector('#ppw-liquid-glass');
  return {
    bodyTextSnippet: txt.slice(0, 600),
    navButtons, protoInMain, stackHit,
    tokens, glassBackdrop, hasLiquidFilter: liquidFilter, smilAnimates: animates,
  };
});

await p.screenshot({ path: `${OUT}/today-dark-live.png`, fullPage: true });

writeFileSync(`${OUT}/REPORT.json`, JSON.stringify({ liveVersion, errs, ...report }, null, 2));
console.log('LIVE version.json :', liveVersion.trim());
console.log('NAV BUTTONS       :', JSON.stringify(report.navButtons));
console.log('STACK in nav      :', JSON.stringify(report.stackHit));
console.log('PROTOCOL in main  :', JSON.stringify(report.protoInMain));
console.log('GLASS tokens      :', JSON.stringify(report.tokens));
console.log('GLASS backdrop    :', report.glassBackdrop);
console.log('LIQUID filter     :', report.hasLiquidFilter, '| SMIL animates:', JSON.stringify(report.smilAnimates));
console.log('CONSOLE errors    :', errs.length, errs.slice(0,5));
console.log('SCREENSHOT        :', `${OUT}/today-dark-live.png`);
await browser.close();
