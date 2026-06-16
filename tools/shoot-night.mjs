// Overnight verify (2026-06-17): home-screen capture + accent/icon DOM probe.
// Real local Chrome via Playwright (sandbox preview-shot times out on stacked
// backdrop-filter — repo harness is the authoritative path per ref-fidelity skill).
// Usage: node tools/shoot-night.mjs <label> [port]
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const LABEL = process.argv[2] || 'after';
const PORT = process.argv[3] || '4317';
const BASE = `http://localhost:${PORT}`;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = `C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-wt-night/screenshots/night-2026-06-17/${LABEL}`;
const todayISO = new Date().toISOString().slice(0, 10);

const SEED = {
  'ppw.background': JSON.stringify({ kind: 'nature' }),
  [`ppw.userStacks::${todayISO}`]: JSON.stringify([
    { id: 'd1', type: 'link', title: 'Hip mobility follow-along', url: 'https://youtu.be/dQw4w9WgXcQ', youtubeId: 'dQw4w9WgXcQ', appKind: 'youtube', time: '07:00', durationSec: 900 },
    { id: 'd2', type: 'text', title: 'Breathwork reminder', text: 'Box breathing', time: '09:30', durationSec: 120 },
    { id: 'd3', type: 'text', title: 'Evening stretch', text: 'Hamstrings', time: '18:00', durationSec: 300 },
  ]),
};

mkdirSync(OUT, { recursive: true });

async function shoot(theme, vp, tag) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript(([seed, th]) => {
    try {
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      localStorage.setItem('ppw.theme', th);
    } catch (_) {}
  }, [SEED, theme]);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1400);

  const probe = await page.evaluate(() => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const accent = document.querySelector('.btn-accent');
    const pill = document.querySelector('.glide-pill');
    const navDot = document.querySelector('.nav-dot');
    const navActive = document.querySelector('.navbtn.active');
    const txt = (el) => (el ? (el.textContent || '').trim() : null);
    return {
      root: document.getElementById('root')?.childElementCount ?? -1,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
      stack: accent ? {
        textContent: txt(accent),
        ariaLabel: accent.getAttribute('aria-label'),
        bg: cs(accent).backgroundColor,
        w: Math.round(accent.getBoundingClientRect().width),
        h: Math.round(accent.getBoundingClientRect().height),
      } : null,
      dayPillBg: pill ? cs(pill).backgroundColor : null,
      navDotBg: navDot ? cs(navDot).backgroundColor : null,
      navActiveColor: navActive ? cs(navActive).color : null,
    };
  });
  const name = `today-${theme}-${tag}`;
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(name, JSON.stringify({ ...probe, errs: errs.length, errsList: errs.slice(0, 3) }));
  await browser.close();
  return { name, probe, errs };
}

const results = [];
results.push(await shoot('dark', { width: 390, height: 844 }, 'mobile'));
results.push(await shoot('light', { width: 390, height: 844 }, 'mobile'));
results.push(await shoot('dark', { width: 1024, height: 800 }, 'desktop'));
writeFileSync(join(OUT, 'probe.json'), JSON.stringify(results, null, 2));
console.log('OUT ->', OUT);
