// Local pre-deploy check — renders the built dist via vite preview and asserts
// the FRESH-EYES fixes: Protocol gone from Today main, "Add stack" action,
// glass tokens, liquid filter present. Usage: node tools/shoot-localcheck-2026-06-20.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = 'http://localhost:4173';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/localcheck-2026-06-20';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
const errs = [];
const p = await ctx.newPage();
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => {
  const main = document.querySelector('main') || document.body;
  const protoInMain = [...main.querySelectorAll('a,button')].map(b => (b.innerText||'').trim()).filter(t => /protocol/i.test(t));
  const addStack = [...main.querySelectorAll('button')].some(b => /add stack/i.test(b.innerText||''));
  const nav = document.querySelector('nav');
  const navButtons = nav ? [...nav.querySelectorAll('a,button')].map(b => (b.getAttribute('aria-label')||b.innerText||'').trim().replace(/\s+/g,' ')).filter(Boolean) : [];
  const cs = getComputedStyle(document.documentElement);
  return {
    protoInMain, addStack, navButtons,
    glassFill: cs.getPropertyValue('--glass-fill').trim().slice(0,60),
    rimlight: cs.getPropertyValue('--glass-rimlight').trim().slice(0,80),
    hasLiquid: !!document.querySelector('#ppw-liquid-glass'),
  };
});
await p.screenshot({ path: `${OUT}/today-local.png`, fullPage: true });
console.log('PROTOCOL in main :', JSON.stringify(r.protoInMain), r.protoInMain.length === 0 ? 'GONE ✓' : 'STILL PRESENT ✗');
console.log('ADD STACK btn    :', r.addStack);
console.log('NAV              :', JSON.stringify(r.navButtons));
console.log('glass-fill       :', r.glassFill, '...');
console.log('rimlight         :', r.rimlight, '...');
console.log('liquid filter    :', r.hasLiquid);
console.log('console errors   :', errs.length, errs.slice(0,4));
console.log('SHOT             :', `${OUT}/today-local.png`);
await browser.close();
