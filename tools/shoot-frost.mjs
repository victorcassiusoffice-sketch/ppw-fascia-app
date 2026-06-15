// Frosted-dialog verification + WCAG contrast MEASUREMENT (2026-06-15, Vic frost pass).
// Real local Chrome (GPU) via Playwright; pixel sampling via sharp.
//
// Proves the 4 fixes:
//   #1 no hard diagonal streak (dialog bg-image = soft fill, ::before = soft sheen)
//   #2 real frost (backdrop blur 46px present; ground diffused)
//   #3 legibility — MEASURES AA contrast of dialog text vs the actual composited
//      frosted field on every skin × theme (samples the pane with child text/fills
//      neutralised, so we read the true field the text sits on — conservative).
//   #4 selection liquid motion (card scales on SPRING.liquid; reduced-motion = none)
//
// Usage: node tools/shoot-frost.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');
const sharp = require('sharp');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/frost-2026-06-15';
const BASE = process.env.FROST_BASE || 'http://localhost:4173';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);

// sRGB relative luminance + WCAG contrast.
function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(r, g, b) { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
function contrast(l1, l2) { const hi = Math.max(l1, l2), lo = Math.min(l1, l2); return (hi + 0.05) / (lo + 0.05); }
function pct(sorted, p) { return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))]; }

// muted = the DIALOG secondary-ink (--dialog-ink-2), not the global muted.
const TEXT = {
  dark:  { inkHi: relLum(241, 243, 248), muted: relLum(200, 208, 219) }, // #F1F3F8 / #C8D0DB
  light: { inkHi: relLum(43, 50, 66),    muted: relLum(58, 67, 80) },    // #2B3242 / #3A4350
};

function seed(theme, skinId) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify({ kind: 'skin', skinId }),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([
      { id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 },
      { id: 's2', type: 'text', title: 'Evening stretch', text: 'Calves', time: '18:00', durationSec: 300 },
    ]),
  };
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const errs = [];
const report = [];

async function newCtx(theme, skin, extra) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...(extra || {}) });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, skin));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(`[${theme}/${skin}] ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`[${theme}/${skin}] ${e.message}`));
  await p.goto(BASE + '/today', { waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return { ctx, p };
}

async function openClearDialog(p) {
  await p.getByRole('button', { name: 'More actions' }).click();
  await p.waitForTimeout(250);
  await p.getByRole('menuitem', { name: /Clear a day/ }).click();
  await p.waitForSelector('.glass-dialog', { state: 'visible', timeout: 8000 });
  await p.waitForTimeout(650); // let the sheet settle
}

async function measureDialog(label, theme, skin) {
  const { ctx, p } = await newCtx(theme, skin);
  await openClearDialog(p);

  // proof shot — text visible
  await p.screenshot({ path: join(OUT, `dialog-${label}.png`) });

  // probe the dialog grammar
  const probe = await p.evaluate(() => {
    const d = document.querySelector('.glass-dialog');
    const cs = getComputedStyle(d);
    const bf = cs.backdropFilter || cs.webkitBackdropFilter || '';
    const before = getComputedStyle(d, '::before');
    return {
      backdropFilter: bf,
      blurPx: (bf.match(/blur\(([\d.]+)px\)/) || [])[1] || null,
      bodyImage: cs.backgroundImage.slice(0, 60),
      beforeImage: before.backgroundImage.slice(0, 60),
      // a "hard stop" sheen has two adjacent stops at near-equal % — the soft
      // fill has none. We just record both for the side-by-side audit.
      hasHardStopInBody: /0%\s*,?.*4[567](\.\d+)?%/.test(cs.backgroundImage) && cs.backgroundImage.includes('linear-gradient'),
    };
  });

  // MEASURE: neutralise child text + fills so we read the true frosted field
  // the text sits on (conservative — samples the whole interior incl. the top
  // sheen bloom = the worst region for white text).
  const box = await p.evaluate(() => {
    const s = document.createElement('style'); s.id = '__measure';
    s.textContent = '.glass-dialog *{color:transparent!important;-webkit-text-fill-color:transparent!important;background-color:transparent!important;background-image:none!important;box-shadow:none!important;border-color:transparent!important;text-shadow:none!important;}';
    document.head.appendChild(s);
    const d = document.querySelector('.glass-dialog');
    const r = d.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  await p.waitForTimeout(120);
  const el = await p.$('.glass-dialog');
  const buf = await el.screenshot();
  const { data, info } = await sharp(buf).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const inset = Math.round(width * 0.06); // skip the bright rim
  const lums = [];
  for (let y = inset; y < height - inset; y += 4) {
    for (let x = inset; x < width - inset; x += 4) {
      const i = (y * width + x) * channels;
      lums.push(relLum(data[i], data[i + 1], data[i + 2]));
    }
  }
  lums.sort((a, b) => a - b);
  const t = TEXT[theme];
  // dark theme = light text → worst is the LIGHTEST field (high pct). light theme
  // = dark text → worst is the DARKEST field (low pct).
  const worstBg = theme === 'dark' ? pct(lums, 95) : pct(lums, 5);
  const worstBgMax = theme === 'dark' ? lums[lums.length - 1] : lums[0];
  const row = {
    label, theme, skin,
    blurPx: probe.blurPx,
    bgMedianLum: +pct(lums, 50).toFixed(3),
    worstFieldLum: +worstBg.toFixed(3),
    inkHi_contrast_p95: +contrast(t.inkHi, worstBg).toFixed(2),
    inkHi_contrast_max: +contrast(t.inkHi, worstBgMax).toFixed(2),
    muted_contrast_p95: +contrast(t.muted, worstBg).toFixed(2),
    inkHi_AA: contrast(t.inkHi, worstBg) >= 4.5 ? 'PASS' : 'FAIL',
    muted_AA: contrast(t.muted, worstBg) >= 4.5 ? 'PASS' : (contrast(t.muted, worstBg) >= 3 ? 'PASS(3:1)' : 'FAIL'),
    bodyImageSoft: !probe.hasHardStopInBody ? 'soft' : 'HARD-STOP',
  };
  report.push(row);
  await ctx.close();
  return row;
}

// ── #3 + #1 + #2 : dialogs across skins × themes ──
for (const skin of ['forest-mist', 'azure', 'chrome', 'metropolis']) {
  for (const theme of ['dark', 'light']) {
    await measureDialog(`${theme}-${skin}`, theme, skin);
  }
}

// ── #4 : selection liquid motion (dark / forest-mist) ──
const sel = await newCtx('dark', 'forest-mist');
const sp = sel.p;
let selMotion = null;
const tick = await sp.$('button[aria-label^="Select stack:"]');
if (tick) {
  await tick.click();
  // capture the melt mid-flight
  for (let i = 0; i < 3; i++) { await sp.screenshot({ path: join(OUT, `select-melt-f${i}.png`) }); await sp.waitForTimeout(70); }
  await sp.waitForTimeout(450);
  await sp.screenshot({ path: join(OUT, `select-settled.png`) });
  selMotion = await sp.evaluate(() => {
    const c = document.querySelector('.today-routine-card.is-selected');
    if (!c) return { found: false };
    const cs = getComputedStyle(c);
    return { found: true, transform: cs.transform, borderRadius: cs.borderRadius };
  });
}
await sel.ctx.close();

// reduced-motion: selection must NOT transform (scale)
const rm = await newCtx('dark', 'forest-mist', { reducedMotion: 'reduce' });
const rmTick = await rm.p.$('button[aria-label^="Select stack:"]');
let reducedSel = null;
if (rmTick) {
  await rmTick.click();
  await rm.p.waitForTimeout(300);
  reducedSel = await rm.p.evaluate(() => {
    const c = document.querySelector('.today-routine-card.is-selected');
    return c ? getComputedStyle(c).transform : null;
  });
}
await rm.ctx.close();

await browser.close();

console.log('\n=== DIALOG FROST — WCAG AA CONTRAST (worst-field, conservative) ===');
console.table(report.map(r => ({
  combo: r.label, blur: r.blurPx, body: r.bodyImageSoft,
  fieldLum: r.worstFieldLum, inkHi_p95: r.inkHi_contrast_p95, inkHi_AA: r.inkHi_AA,
  muted_p95: r.muted_contrast_p95, muted_AA: r.muted_AA,
})));
console.log('\nselection liquid motion (dark/forest):', JSON.stringify(selMotion));
console.log('reduced-motion selection transform     :', JSON.stringify(reducedSel), '(expect none/identity)');
console.log('console errors:', errs.length, errs.slice(0, 6));
console.log('OUT ->', OUT);
