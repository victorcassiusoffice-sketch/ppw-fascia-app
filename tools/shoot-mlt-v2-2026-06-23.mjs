// Verify MLT v2 (icon-only orbs, hero text removed, floating 3D-glass nav,
// convex glass) across the flow + Today/Settings regression, real Chrome.
// Usage: BASE=http://localhost:3007 node tools/shoot-mlt-v2-2026-06-23.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3007';
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/mlt-v2-2026-06-23';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
const R = {};

async function run(theme) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`[${theme}] ` + m.text()); });
  p.on('pageerror', (e) => errs.push(`[${theme}] ` + e.message));

  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
  await p.waitForTimeout(500);
  await p.mouse.click(206, 480);
  await p.waitForTimeout(1500);

  // Entry — orbs only, no hero text, nav has no bar
  R['entry-' + theme] = await p.evaluate(() => {
    const orbs = document.querySelectorAll('.mlt-orb');
    const navBg = getComputedStyle(document.querySelector('.botnav')).backgroundColor;
    return {
      orbs: orbs.length,
      heroH1: !!document.querySelector('.mlt-entry h1'),
      sessionBuilderText: document.body.innerText.includes('Session Builder'),
      unlockText: document.body.innerText.includes('Unlock'),
      navHasBar: navBg !== 'rgba(0, 0, 0, 0)' && navBg !== 'transparent',
      orbOpacity: orbs.length ? getComputedStyle(orbs[0]).opacity : 'n/a',
    };
  });
  await p.screenshot({ path: `${OUT}/entry-${theme}.png`, fullPage: true });

  // hover an orb → caption reveals
  await p.hover('.mlt-orb');
  await p.waitForTimeout(450);
  R['entry-hover-' + theme] = await p.evaluate(() => {
    const cap = document.querySelector('.mlt-caption');
    return { capText: cap?.innerText?.trim(), capOpacity: cap ? getComputedStyle(cap).opacity : 'n/a' };
  });
  await p.screenshot({ path: `${OUT}/entry-hover-${theme}.png`, fullPage: true });

  // Lifestyle grid
  await p.click('button[aria-label="Lifestyle"]');
  await p.waitForTimeout(1500);
  R['lifestyle-' + theme] = await p.evaluate(() => ({
    path: location.pathname,
    orbs: document.querySelectorAll('.mlt-orb').length,
    orbOpacity: document.querySelector('.mlt-orb') ? getComputedStyle(document.querySelector('.mlt-orb')).opacity : 'n/a',
  }));
  await p.screenshot({ path: `${OUT}/lifestyle-${theme}.png`, fullPage: true });

  // pick a lifestyle (tap reveals caption, then navigates after 640ms)
  await p.click('.mlt-orb');
  await p.waitForTimeout(1600);
  R['level-' + theme] = await p.evaluate(() => ({
    path: location.pathname,
    orbs: document.querySelectorAll('.mlt-orb').length,
  }));
  await p.screenshot({ path: `${OUT}/level-${theme}.png`, fullPage: true });

  // Regression: Today + Settings still render (global glass change)
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate((th) => document.documentElement.setAttribute('data-theme', th), theme);
  // seed active state so /today renders content
  await p.evaluate(() => localStorage.setItem('ppw.activeRoutines', JSON.stringify({ savedZones: ['calf-left'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' })));
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(900);
  R['today-' + theme] = await p.evaluate(() => ({ rootKids: document.getElementById('root')?.childElementCount, path: location.pathname }));
  await p.screenshot({ path: `${OUT}/today-${theme}.png`, fullPage: false });

  await ctx.close();
}

for (const t of ['dark', 'light']) await run(t);
console.log('RESULTS:', JSON.stringify(R, null, 1));
console.log('CONSOLE ERRORS:', errs.length, errs.slice(0, 10));
await browser.close();
