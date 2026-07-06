// Live render verification — New Design go-live (2026-07-06).
// Real Chrome against the deployed GH Pages URL. Two states:
//   1. fresh (no storage) → onboarding wizard must show ("Get started")
//   2. onboarded → Stack screen must show (NEXT UP + nav dock)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = 'https://victorcassiusoffice-sketch.github.io/ppw-fascia-app';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/live-newdesign-2026-07-06';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: CHROME, headless: true });
const report = [];

// 1 — fresh first run → onboarding
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/?cb=' + Date.now(), { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const text = await p.evaluate(() => document.body.innerText);
  const mounted = await p.evaluate(() => document.getElementById('root').childElementCount > 0);
  await p.screenshot({ path: OUT + '/1-fresh-onboarding.png' });
  report.push({ state: 'fresh', mounted, hasGetStarted: text.includes('Get started'), hasTerms: text.includes('Terms & Health Disclaimer'), errs });
  await ctx.close();
}

// 2 — onboarded → Stack screen
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage(); const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('ppw5.onboarded', '1'); localStorage.setItem('ppw5.terms', '1'); } catch {} });
  await p.goto(BASE + '/?cb=' + Date.now(), { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const text = await p.evaluate(() => document.body.innerText);
  const mounted = await p.evaluate(() => document.getElementById('root').childElementCount > 0);
  const navDock = await p.evaluate(() => !!document.querySelector('button[aria-label="Add a stack"]'));
  await p.screenshot({ path: OUT + '/2-stack.png' });
  report.push({ state: 'onboarded', mounted, hasNextUp: text.includes('NEXT UP'), navDock, hasStack: text.includes('Stack'), errs });
  await ctx.close();
}

await b.close();
writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
