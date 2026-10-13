// The SHIPPED bundle, driven the way a person drives it.
//
// Every other shoot in this repo talks to the dev server and reaches into the
// app's modules with import('/src/app5/store5.js'). That is fine for proving
// logic, and it proves nothing about what gets deployed: a production build is
// bundled and minified, those module paths do not exist, and a handful of things
// only bite in the built artefact -- a JSON import that did not get inlined, a
// dynamic import that lost its chunk, WebCrypto behaving differently outside a
// dev server.
//
// So this one touches nothing but the screen. It types the code into the field
// and presses the button, exactly as a gym owner would.
//
// Usage:
//   npm run build && npx vite preview --port 5250 --strictPort
//   node tools/shoot-prod-bundle.mjs
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

let chromium;
for (const base of [
  'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/package.json',
  'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json',
]) {
  try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* next */ }
}
if (!chromium) { console.log('FAIL: playwright not resolvable'); process.exit(1); }

const PORT = process.env.SMOKE_PORT || '5250';
const APP = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/.shots/prod-bundle';
mkdirSync(OUT, { recursive: true });

const CODE = (readFileSync('C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/ACCESS-CODES.md', 'utf8')
  .match(/\|\s*`([0-9A-Z-]+)`/g) || []).slice(-1)[0]?.replace(/[|`\s]/g, '');
if (!CODE) { console.log('FAIL: no access code found'); process.exit(1); }

const browser = await chromium.launch({ headless: true, channel: process.env.INTRO_CHROME ? undefined : 'chrome', executablePath: process.env.INTRO_CHROME });
const errors = [];
const checks = [];
const notes = [];
const ok = (n, pass, d) => { checks.push({ n, pass, d }); if (!pass) errors.push(`CHECK FAILED: ${n}${d ? ' -- ' + d : ''}`); };

const phone = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  return { ctx, page };
};
const mounted = (page) => page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, { timeout: 20000 }).catch(() => {});

// The gate is an opaque overlay OVER a rendered app, so everything is scoped to
// the gate's own subtree -- body text and the first <input> both belong to the
// app underneath.
const GATE = `(() => {
  const h = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Enter your access code/i.test(e.textContent || ''));
  if (!h) return null;
  let n = h;
  for (let i = 0; i < 10 && n.parentElement; i++) { n = n.parentElement; if (n.querySelector('input')) break; }
  return n;
})()`;
const gateUp = (page) => page.evaluate(`!!${GATE}`);

const clickIn = async (page, expr) => {
  const at = await page.evaluate(`(() => {
    const el = ${expr};
    if (!el) return null;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (!r.width || r.bottom < 0 || r.top > innerHeight) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  return true;
};

// ── the shipped bundle, from a cold visit ───────────────────────────────────
{
  const { ctx, page } = await phone('prod');
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await mounted(page);
  await page.waitForTimeout(1200);

  ok('the shipped bundle mounts', await page.evaluate(() => (document.getElementById('root')?.childElementCount ?? 0) > 0), '');
  ok('a stranger meets the door', await gateUp(page), 'no gate in the production build');
  await page.screenshot({ path: `${OUT}/1-door.png` }); notes.push('1-door');

  // Tick the agreement, then type the code and press the button. No module
  // imports anywhere -- this is the whole point of the file.
  const ticked = await clickIn(page, `(() => {
    const g = ${GATE}; if (!g) return null;
    return [...g.querySelectorAll('button')].find((b) => b.getAttribute('role') === 'checkbox' || b.getAttribute('aria-checked') !== null) || null;
  })()`);
  ok('the agreement can be ticked', ticked, 'no tick control found inside the gate');

  const typed = await clickIn(page, `(() => { const g = ${GATE}; return g && g.querySelector('input'); })()`);
  ok('the code field is reachable', typed, '');
  await page.keyboard.type(CODE, { delay: 15 });

  const pressed = await clickIn(page, `(() => {
    const g = ${GATE}; if (!g) return null;
    return [...g.querySelectorAll('button')].find((b) => /open the app/i.test(b.textContent)) || null;
  })()`);
  ok('the way in is pressable once agreed', pressed, '');
  // PBKDF2 at 310k iterations, in a minified bundle, on a cold JIT.
  await page.waitForFunction(`!${GATE}`, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const inside = !(await gateUp(page));
  ok('THE REAL CODE OPENS THE SHIPPED BUILD', inside, 'still gated after typing the issued code into the production bundle');
  const stored = await page.evaluate(() => localStorage.getItem('ppw5.access'));
  ok('the licence is written by id, not by the code', !!stored && !new RegExp(CODE, 'i').test(stored), `ppw5.access = ${stored}`);
  await page.screenshot({ path: `${OUT}/2-inside.png` }); notes.push('2-inside');

  const body = await page.evaluate(() => document.body.innerText);
  ok('the first day is the new one', /stretch/i.test(body) && !/yoga/i.test(body), body.slice(0, 140).replace(/\n/g, ' | '));
  ok('nothing is selling anything', !/9\.99|Go Premium|Unlock Routines/i.test(body), '');
  await ctx.close();
}

// ── the embed path, from the shipped bundle ─────────────────────────────────
{
  const { ctx, page } = await phone('demo');
  await page.goto(`${APP}/?demo=1`, { waitUntil: 'domcontentloaded' });
  await mounted(page);
  await page.waitForTimeout(1500);
  ok('?demo=1 opens the shipped build with no code', !(await gateUp(page)), '');
  ok('the demo grants nothing lasting', !(await page.evaluate(() => localStorage.getItem('ppw5.access'))), '');
  await page.screenshot({ path: `${OUT}/3-demo.png` }); notes.push('3-demo');
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/prod.json`, JSON.stringify({ checks, errors }, null, 2));
console.log(`\nshots -> ${OUT}`);
for (const n of notes) console.log('  ' + n + '.png');
console.log('\nchecks:');
for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.n}${c.pass ? '' : ' -- ' + c.d}`);
if (errors.length) { console.log('\nFAILURES:'); for (const e of errors) console.log('  ' + e); process.exit(1); }
console.log(`\nall ${checks.length} checks passed against the production bundle`);
