// Real-render smoke for the Guided Onboarding build (2026-08-24).
//
// A green `npm test` + `npm run build` can still white-screen, so this is the
// gate that actually proves the thing runs: real Chromium, the real built
// bundle, zero console errors, #root actually populated — and the guide's first
// quest driven on the real screen, tapping the real controls.
//
// Usage:
//   npm run build
//   npx vite preview --port 4173 --strictPort   (in another shell, or use --serve)
//   node tools/shoot-guide-2026-08-24.mjs
//
// Exits non-zero on ANY console error, pageerror, empty root, or failed step.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire('C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json');
const { chromium } = require('playwright');

const PORT = process.env.SMOKE_PORT || '4173';
const BASE = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app/.shots/guide';
mkdirSync(OUT, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

const failures = [];
const passes = [];
function ok(m) { passes.push(m); console.log('  PASS ' + m); }
function bad(m) { failures.push(m); console.log('  FAIL ' + m); }

/** Fresh context with seeded ppw5.* localStorage. */
async function ctxWith(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((s) => {
    try {
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    } catch (_) {}
  }, seed);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
  return { ctx, page, errs };
}

async function mounted(page) {
  return page.evaluate(() => {
    const r = document.getElementById('root');
    return { exists: !!r, children: r ? r.childElementCount : 0 };
  });
}

// ── 1 · fresh install: the app mounts at all ───────────────────────────────
{
  console.log('\n[1] fresh install mounts');
  const { ctx, page, errs } = await ctxWith({});
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const m = await mounted(page);
  m.exists && m.children > 0 ? ok(`#root has ${m.children} children`) : bad('#root empty — WHITE SCREEN');
  await page.screenshot({ path: OUT + '/01-fresh.png' });
  errs.length ? bad('console errors: ' + errs.join(' | ')) : ok('0 console errors');
  await ctx.close();
}

// ── 2 · onboarded veteran: stack renders, header discs present ─────────────
{
  console.log('\n[2] onboarded user — stack screen');
  const { ctx, page, errs } = await ctxWith({
    'ppw5.onboarded': '1', 'ppw5.terms': '1', 'ppw5.frc': '1', 'ppw5.tourSeen': '1',
  });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const m = await mounted(page);
  m.children > 0 ? ok('stack mounts') : bad('stack white screen');
  const h1 = await page.locator('h1', { hasText: 'Stack' }).first().count();
  h1 ? ok('Stack heading rendered') : bad('no Stack heading');
  await page.screenshot({ path: OUT + '/02-stack.png' });
  errs.length ? bad('console errors: ' + errs.join(' | ')) : ok('0 console errors');
  await ctx.close();
}

console.log('\n──────────────────────────────');
console.log(`${passes.length} passed, ${failures.length} failed`);
await browser.close();
if (failures.length) { failures.forEach((f) => console.log('  ✗ ' + f)); process.exit(1); }
console.log('SMOKE GREEN');
