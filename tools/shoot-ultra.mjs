// Ultra pass verification (2026-06-15): clear-glass dialogs, zero orange-highlight,
// flowing liquid WebGL bg (render + motion + fps), reduced-motion freeze, 0 errors.
// Real local Chrome with WebGL enabled. Usage: node tools/shoot-ultra.mjs [outDir]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/screenshots/ultra-2026-06-15';
const BASE = 'http://localhost:3000';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const todayISO = new Date().toISOString().slice(0, 10);
const GL_ARGS = ['--ignore-gpu-blocklist', '--enable-gpu', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader'];

function seed(theme, bg) {
  return {
    'ppw.theme': theme,
    'ppw.background': JSON.stringify(bg),
    'ppw.activeRoutines': JSON.stringify({ savedZones: ['calf-left', 'hamstring-right'], level: 'beginner', lifestyle: null, scheduledTime: '08:00' }),
    [`ppw.userStacks::${todayISO}`]: JSON.stringify([{ id: 's1', type: 'text', title: 'Morning mobility', text: 'Hips', time: '07:30', durationSec: 240 }]),
  };
}
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: GL_ARGS });
const errs = [];
async function ctxFor(theme, bg, extra) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, ...(extra || {}) });
  await ctx.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, seed(theme, bg));
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error' && !/websocket|HMR|vite|favicon|manifest/i.test(m.text())) errs.push(m.text()); });
  p.on('pageerror', (e) => errs.push(e.message));
  return { ctx, p };
}

// ── Flowing liquid: render + motion + fps (dark + light) ──
const liq = await ctxFor('dark', { kind: 'liquid' });
await liq.p.goto(BASE + '/today', { waitUntil: 'networkidle' });
await liq.p.waitForTimeout(1000);
const glInfo = await liq.p.evaluate(() => {
  const c = document.querySelector('.liquid-bg-canvas');
  if (!c) return { canvas: false };
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  return { canvas: true, hasGL: !!gl, w: c.width, h: c.height, shown: getComputedStyle(c).display !== 'none' };
});
// motion: two frames ~400ms apart should differ if animating
await liq.p.screenshot({ path: join(OUT, 'liquid-dark-f0.png') });
await liq.p.waitForTimeout(500);
await liq.p.screenshot({ path: join(OUT, 'liquid-dark-f1.png') });
// fps over 1.2s
const fps = await liq.p.evaluate(() => new Promise((r) => { let f = 0; const t0 = performance.now(); function t(n){ f++; if (n - t0 < 1200) requestAnimationFrame(t); else r(Math.round(f * 1000 / (n - t0))); } requestAnimationFrame(t); }));
// motion-diff: sample a center pixel twice
const pixelDiff = await liq.p.evaluate(async () => {
  const c = document.querySelector('.liquid-bg-canvas');
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  function sample() { const px = new Uint8Array(4); gl.readPixels((c.width/2)|0, (c.height/2)|0, 1, 1, gl.RGB?gl.RGBA:gl.RGBA, gl.UNSIGNED_BYTE, px); return [px[0],px[1],px[2]]; }
  const a = sample(); await new Promise(r => setTimeout(r, 600)); const b = sample();
  return { a, b, changed: Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) > 2 };
});
await liq.ctx.close();

const liqLight = await ctxFor('light', { kind: 'liquid' });
await liqLight.p.goto(BASE + '/today', { waitUntil: 'networkidle' });
await liqLight.p.waitForTimeout(900);
await liqLight.p.screenshot({ path: join(OUT, 'liquid-light.png') });
await liqLight.ctx.close();

// ── Clear-glass dialog: open Add Stack over the liquid bg, probe see-through ──
const dlg = await ctxFor('dark', { kind: 'liquid' });
await dlg.p.goto(BASE + '/today', { waitUntil: 'networkidle' });
await dlg.p.waitForTimeout(800);
await dlg.p.evaluate(() => { const a = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').includes('Add a custom stack')); if (a) a.click(); });
await dlg.p.waitForTimeout(600);
const dialogProbe = await dlg.p.evaluate(() => {
  const d = document.querySelector('.glass-dialog');
  if (!d) return { found: false };
  const cs = getComputedStyle(d);
  return {
    found: true,
    hasBackdropBlur: /blur/.test(cs.backdropFilter || cs.webkitBackdropFilter || ''),
    bg: cs.backgroundColor, // expect low-alpha rgba, not opaque
  };
});
await dlg.p.screenshot({ path: join(OUT, 'clear-dialog-addstack.png') });
await dlg.ctx.close();

// ── Zero orange-highlight: nav-dot is accent-GLASS not opaque orange ──
const orange = await ctxFor('dark', { kind: 'forest-mist' });
await orange.p.goto(BASE + '/today', { waitUntil: 'networkidle' });
await orange.p.waitForTimeout(700);
const navDot = await orange.p.evaluate(() => {
  const d = document.querySelector('.nav-dot');
  if (!d) return { found: false };
  const cs = getComputedStyle(d);
  // accent-glass = translucent rgba (alpha<1) + a background-image (glass-fill). opaque orange = solid rgb.
  return { found: true, bg: cs.backgroundColor, hasGlassFill: cs.backgroundImage !== 'none' };
});
// new icons present (no emoji): overflow trigger has an svg
const iconCheck = await orange.p.evaluate(() => {
  const more = document.querySelector('button[aria-label="More actions"]');
  return { moreHasSvg: !!(more && more.querySelector('svg')), moreText: more ? more.textContent.trim() : null };
});
await orange.p.screenshot({ path: join(OUT, 'nav-icons-forest.png') });
await orange.ctx.close();

// ── Reduced motion: liquid renders ONE static frame (no loop) ──
const rm = await ctxFor('dark', { kind: 'liquid' }, { reducedMotion: 'reduce' });
await rm.p.goto(BASE + '/today', { waitUntil: 'networkidle' });
await rm.p.waitForTimeout(400);
const rmDiff = await rm.p.evaluate(async () => {
  const c = document.querySelector('.liquid-bg-canvas');
  if (!c) return { canvas: false };
  const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
  function sample(){ const px=new Uint8Array(4); gl.readPixels((c.width/2)|0,(c.height/2)|0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px); return [px[0],px[1],px[2]]; }
  const a = sample(); await new Promise(r=>setTimeout(r,700)); const b = sample();
  return { canvas: true, frozen: Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]) <= 1 };
});
await rm.p.screenshot({ path: join(OUT, 'liquid-reduced-motion.png') });
await rm.ctx.close();

await browser.close();
console.log(JSON.stringify({ glInfo, fps, pixelDiff, dialogProbe, navDot, iconCheck, rmDiff, consoleErrors: errs.length, errSample: errs.slice(0, 5) }, null, 2));
console.log('OUT ->', OUT);
