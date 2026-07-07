// Live Supps-tab render check (item 4) against production.
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error' && !/websocket|Failed to load resource/.test(m.text())) errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { try { localStorage.setItem('ppw5.onboarded', '1'); localStorage.setItem('ppw5.terms', '1'); localStorage.setItem('ppw5.premium', '1'); } catch {} });
await p.goto(BASE + '/?cb=' + Date.now(), { waitUntil: 'networkidle' });
await p.waitForTimeout(2000);
await p.click('button[aria-label="Library"]').catch(() => {});
await p.waitForTimeout(600);
// click the Supps tab by text
await p.evaluate(() => { const t = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Supps'); if (t) t.click(); });
await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const txt = document.body.innerText;
  const shop = [...document.querySelectorAll('button')].find((b) => /Shop \d+ on iHerb/.test(b.textContent));
  return {
    checkboxes: document.querySelectorAll('button[role="checkbox"]').length,
    shopBtn: shop ? shop.textContent.trim() : 'MISSING',
    disclaimer: txt.includes('please read before buying'),
    preSignup: txt.includes('yet earn'),
    noCommissionClaim: !txt.includes('PPW earns a small commission'),
  };
});
console.log(JSON.stringify({ live: true, errs, ...r }, null, 2));
await b.close();
