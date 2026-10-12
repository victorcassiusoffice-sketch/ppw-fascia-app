// The first day a person sees, and the quit plan, in a real browser.
//
// What unit tests cannot settle here:
//   - whether the four starter slots actually READ as a day worth keeping, at
//     phone width, in Indigo, with real thumbnails fetched from YouTube
//   - whether the quit setup can be filled in without thinking
//   - whether the over-allowance wording lands as neutral when you SEE it, which
//     is the whole design constraint and the one a green test cannot judge
//
// Usage:
//   npx vite --port 5243 --strictPort
//   node tools/shoot-starter-and-quit.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

let chromium;
for (const base of [
  'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/package.json',
  'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json',
]) {
  try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* next */ }
}
if (!chromium) { console.log('FAIL: playwright not resolvable'); process.exit(1); }

const PORT = process.env.SMOKE_PORT || '5243';
const APP = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/.shots/starter-quit';
mkdirSync(OUT, { recursive: true });

// Read, never hardcode. The door is in the way of every screen below it.
const CODE = (readFileSync('C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/ACCESS-CODES.md', 'utf8')
  .match(/\|\s*`([0-9A-Z-]+)`/g) || []).slice(-1)[0]?.replace(/[|`\s]/g, '');
if (!CODE) { console.log('FAIL: no access code found'); process.exit(1); }

const browser = await chromium.launch({ headless: true, channel: process.env.INTRO_CHROME ? undefined : 'chrome', executablePath: process.env.INTRO_CHROME });
const errors = [];
const notes = [];
const checks = [];
const ok = (name, pass, detail) => { checks.push({ name, pass, detail }); if (!pass) errors.push(`CHECK FAILED: ${name}${detail ? ' -- ' + detail : ''}`); };

// 'networkidle' is wrong for this app: the starter deck fetches thumbnails from
// i.ytimg.com, so the network never goes idle and every goto times out. We wait
// for the document and then for the app to actually mount, which is the thing we
// care about anyway.
const settle = async (page, ms = 1600) => {
  await page.waitForFunction(() => (document.getElementById('root')?.childElementCount ?? 0) > 0, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
};

const phone = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Indian/Mauritius' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  return { ctx, page };
};
const shoot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); notes.push(name); };

// Past the door, through the app's own functions rather than by faking a grant:
// a seeded localStorage key would prove the screens render for a state no real
// visitor can reach.
const letIn = async (page) => {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await settle(page, 600);
  await page.evaluate(async (code) => {
    const a = await import('/src/app5/access.js');
    const id = await a.verifyCode(code);
    if (id) a.grantAccess(id);
    const n = await import('/src/app5/nda.js').catch(() => null);
    if (n && n.NDA_VERSION) {
      try { localStorage.setItem('ppw5.nda', JSON.stringify({ version: n.NDA_VERSION, on: new Date().toISOString().slice(0, 10), code: id })); } catch (_) {}
    }
  }, CODE);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page);
  await walkFirstRun(page);
};

// The access grant gets you past the DOOR, not past first-run. Without this the
// Stack renders underneath the first-run overlay: innerText-based checks pass
// (they read straight through it) while every screenshot shows the wizard, which
// is evidence of the wrong screen. Walk it the way a finger does.
const tap = async (page, label) => {
  const at = await page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().startsWith(t.toLowerCase()));
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || !r.width) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, label);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(550);
  return true;
};
async function walkFirstRun(page) {
  for (let i = 0; i < 10; i++) {
    const done = await page.evaluate(() => !/Create an account|Build mine|Start with an empty day|I agree/i.test(document.body.innerText));
    if (done) return;
    // the consent tick has no accessible text; it is found by the copy beside it
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('button')]
        .find((b) => /terms|agree|accept/i.test(b.getAttribute('aria-label') || '')
          || (b.parentElement && /terms/i.test(b.parentElement.textContent || '') && !b.textContent.trim()));
      if (t && t.getAttribute('aria-checked') !== 'true') t.click();
    });
    if (await tap(page, 'Start with an empty day')) continue;
    if (await tap(page, 'Look around first')) continue;
    if (await tap(page, 'Build mine')) continue;
    break;
  }
}

// ── 1. the first day ────────────────────────────────────────────────────────
{
  const { ctx, page } = await phone('starter');
  await letIn(page);
  const text = await page.evaluate(() => document.body.innerText);

  ok('the first day mentions no yoga', !/yoga/i.test(text), (text.match(/.{0,40}yoga.{0,40}/i) || [''])[0]);
  ok('there is a stretch', /stretch/i.test(text), text.slice(0, 160).replace(/\n/g, ' | '));
  ok('there is a supplement reminder', /supplement/i.test(text), '');
  ok('there is a HIIT workout', /hiit|high intensity/i.test(text), '');
  ok('there is an affirmation', /i did enough today|consistent/i.test(text), '');

  // The thumbnails are fetched from YouTube, so a dead id shows as a broken
  // image rather than as a failing test. Ask the browser whether they loaded.
  // App5's cardIcon paints the thumbnail as a CSS background on a div, not as an
  // <img>, so an <img> selector finds nothing and reports "no thumbnails" for a
  // screen that is full of them. Collect the urls off the computed styles and
  // then actually FETCH each one, which is the only way to learn that an id is
  // dead -- a broken CSS background looks exactly like a styled empty box.
  const thumbUrls = await page.evaluate(() => [...document.querySelectorAll('*')]
    .map((e) => getComputedStyle(e).backgroundImage || '')
    .filter((b) => b.includes('ytimg.com'))
    .map((b) => (b.match(/url\(["']?([^"')]+)/) || [])[1])
    .filter(Boolean));
  const thumbs = [];
  for (const u of [...new Set(thumbUrls)]) {
    const r = await page.request.get(u).catch(() => null);
    thumbs.push({ id: u.split('/vi/')[1]?.split('/')[0], status: r ? r.status() : 'no-response' });
  }
  ok('every starter thumbnail is a live YouTube video', thumbs.length > 0 && thumbs.every((t) => t.status === 200), JSON.stringify(thumbs));
  notes.push(`  (starter thumbnails: ${thumbs.map((t) => t.id + ' ' + t.status).join(', ')})`);

  await shoot(page, '1-first-day');
  await ctx.close();
}

// ── 2. the quit plan ────────────────────────────────────────────────────────
{
  const { ctx, page } = await phone('quit');
  await letIn(page);

  // Build a plan through the real engine + store, the way the sheet would.
  const made = await page.evaluate(async () => {
    const P = await import('/src/app5/quit5/plan.js');
    const s = await import('/src/app5/store5.js');
    const today = s.todayKey();
    s.startQuitPlan({ from: 20, to: 0, days: 28 });
    const plan = s.getState().quitPlan;
    return {
      wired: !!plan,
      today,
      allowanceToday: P.allowanceFor(plan, today),
      curveStart: P.allowanceCurve(plan).slice(0, 5),
      curveEnd: P.allowanceCurve(plan).slice(-3),
    };
  });
  ok('a plan can be created and stored through the app', made.wired, JSON.stringify(made));
  ok('today\'s allowance is where they already are, not a cut on day one', made.allowanceToday === 20, JSON.stringify(made));
  notes.push(`  (20 -> 0 over 28 days: starts ${JSON.stringify(made.curveStart)} ... ends ${JSON.stringify(made.curveEnd)})`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 900);
  const onStack = await page.evaluate(() => document.body.innerText);
  ok('the allowance reaches the Stack', /20|allowance|left today|cigarette|smok/i.test(onStack), onStack.slice(0, 200).replace(/\n/g, ' | '));
  await shoot(page, '2-quit-on-stack');

  // Over the allowance: the wording is the whole point.
  const over = await page.evaluate(async () => {
    const P = await import('/src/app5/quit5/plan.js');
    const s = await import('/src/app5/store5.js');
    const today = s.todayKey();
    s.startQuitPlan({ from: 10, to: 0, days: 10 });
    for (let i = 0; i < 14; i++) s.logOneSmoked(today);   // four past the allowance
    return { status: s.quitStatus(today) };
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await settle(page, 900);
  const overText = await page.evaluate(() => document.body.innerText);
  const shaming = /\bfail(ed|ure)?\b|\bbad\b|shame|guilt|broke your|streak lost|you should/i;
  ok('going over is said without shame', !shaming.test(overText), (overText.match(/.{0,60}(fail|bad|shame|guilt|streak|should).{0,60}/i) || [''])[0]);
  notes.push(`  (over-allowance status: ${JSON.stringify(over.status).slice(0, 180)})`);
  await shoot(page, '3-over-allowance');

  // It is a habit tracker and has to say so somewhere a person will meet it.
  const P = await page.evaluate(async () => {
    const m = await import('/src/app5/quit5/plan.js');
    return { disclaimer: m.DISCLAIMER, method: m.METHOD_NOTE, help: m.HELP_LINE };
  });
  ok('it says plainly that it is not medical advice', /not medical advice/i.test(P.disclaimer || ''), P.disclaimer || '(none)');
  ok('it does not claim tapering is the best way', /not the only one|may not be/i.test(P.method || ''), P.method || '(none)');
  ok('it points at real help', /pharmacist|doctor/i.test(P.help || ''), P.help || '(none)');
  ok('it invents no success rate', !/\b\d{1,3}\s?%|\btriples?\b|\bdoubles?\b/i.test([P.disclaimer, P.method, P.help].join(' ')), [P.disclaimer, P.method, P.help].join(' '));

  await ctx.close();
}

// ── 3. the demo must not write a plan ───────────────────────────────────────
{
  const { ctx, page } = await phone('demo');
  await page.goto(`${APP}/?demo=1`, { waitUntil: 'domcontentloaded' });
  await settle(page, 900);
  const wrote = await page.evaluate(async () => {
    const P = await import('/src/app5/quit5/plan.js');
    const s = await import('/src/app5/store5.js');
    s.startQuitPlan({ from: 20, to: 0, days: 28 });
    return Object.keys(localStorage).filter((k) => /quit/i.test(k));
  });
  ok('the demo writes no quit plan to the device', wrote.length === 0, JSON.stringify(wrote));
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/run.json`, JSON.stringify({ checks, notes, errors }, null, 2));

console.log(`\nshots -> ${OUT}`);
for (const n of notes) console.log(n.startsWith('  ') ? n : '  ' + n + '.png');
console.log('\nchecks:');
for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name}${c.pass ? '' : ' -- ' + c.detail}`);
if (errors.length) { console.log('\nFAILURES:'); for (const e of errors) console.log('  ' + e); process.exit(1); }
console.log(`\nall ${checks.length} checks passed, no console errors`);
