// Verify the MLT-trial change (fascia-network card removed) on the live dev
// server in real Chrome — handles backdrop-filter the sandbox shot tool can't.
// Usage: node tools/shoot-mlt-trial-2026-06-23.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4599';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/mlt-trial-2026-06-23';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));

// Load, wipe any saved state so "/" renders the Entry hero (not a /today redirect)
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(400);
// skip the ~1.6s intro overlay
await p.mouse.click(206, 450);
await p.waitForTimeout(1200);

const facts = await p.evaluate(() => {
  const txt = document.body.innerText;
  return {
    path: location.pathname,
    h1: (document.querySelector('h1')?.innerText || '').replace(/\n/g, ' '),
    hasNetworkCard: /connective architecture/i.test(txt) || /fascia network/i.test(txt),
    bodyZone: txt.includes('Select by Body Zone'),
    lifestyle: txt.includes('Select by Lifestyle'),
    protocolsLink: txt.includes('evidence-based protocols'),
    rootKids: document.getElementById('root')?.childElementCount || 0,
  };
});
console.log('FACTS:', JSON.stringify(facts));
console.log('ERRORS:', errs.length, errs.slice(0, 5));

for (const t of ['dark', 'light']) {
  await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), t);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}/welcome-${t}.png`, fullPage: true });
  console.log('SHOT welcome-' + t + '.png');
}
await browser.close();
console.log('DONE errors=', errs.length);
