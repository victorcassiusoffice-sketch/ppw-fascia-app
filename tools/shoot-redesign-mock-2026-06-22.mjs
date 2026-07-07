// Shoot the redesign mocks (standalone HTML) in real Chrome — handles
// backdrop-filter that the sandbox shot tool times out on. Drives the mock's
// own Screen + Theme controls, clips to the phone frame.
// Usage: node tools/shoot-redesign-mock-2026-06-22.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const URL = 'file:///C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/media-dept/design-training/APP-REDESIGN-MOCKS.html';
const OUT = 'C:/Users/Victor/Documents/PPW-Second-Brain/06-Roadmap/media-dept/design-training/_mock-shots';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 460, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);

const sanity = await p.evaluate(() => ({
  screens: document.querySelectorAll('#screens button').length,
  phone: !!document.querySelector('.phone'),
  nav: !!document.querySelector('.nav'),
}));
console.log('SANITY:', JSON.stringify(sanity), 'errors:', errs.length, errs.slice(0, 3));

const screens = ['home', 'stack', 'add', 'calendar', 'settings'];
const themes = ['dark', 'light'];
for (const t of themes) {
  await p.click(`#themes button[data-t="${t}"]`);
  await p.waitForTimeout(150);
  for (const s of screens) {
    await p.click(`#screens button[data-s="${s}"]`);
    await p.waitForTimeout(650); // let ground drift + morph settle
    const el = await p.$('.phone');
    await el.screenshot({ path: `${OUT}/${t}-${s}.png` });
    const curNow = await p.evaluate(() => (typeof cur !== 'undefined' ? cur : 'n/a'));
    console.log('SHOT', `${t}-${s}.png`, 'rendered=', curNow, 'errs=', errs.length, errs.slice(-1));
  }
}
// a contact sheet of dark home full window (controls + phone) for context
await p.click('#themes button[data-t="dark"]');
await p.click('#screens button[data-s="home"]');
await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/_context-window.png` });
console.log('DONE. errors:', errs.length);
await browser.close();
