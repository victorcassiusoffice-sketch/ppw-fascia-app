// The B2B front door, proven in a real browser.
//
// Three things that unit tests cannot settle:
//   1. Does the access gate actually stand in front of the app, and does a real
//      code get a real person in and keep them in?
//   2. Does `?demo=1` open the app for Vic's website embed WITHOUT handing out
//      lasting access?
//   3. Does it survive being put in an IFRAME ON ANOTHER ORIGIN -- which is the
//      entire point of the embed, and the one thing no same-origin test can show.
//
// The plaintext code is read from the gitignored ACCESS-CODES.md at runtime. It
// is typed into the page and never printed, never written to a screenshot name,
// never put in the JSON receipt.
//
// Usage:
//   npx vite --port 5241 --strictPort      (in another shell)
//   node tools/shoot-b2b-gate.mjs
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';

let chromium;
for (const base of [
  'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/package.json',
  'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json',
]) {
  try { ({ chromium } = createRequire(base)('playwright')); break; } catch { /* next */ }
}
if (!chromium) { console.log('FAIL: playwright not resolvable'); process.exit(1); }

const PORT = process.env.SMOKE_PORT || '5241';
const APP = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/.shots/b2b-gate';
mkdirSync(OUT, { recursive: true });

// The code, read not hardcoded. If this file is missing the run stops rather
// than quietly testing nothing.
let CODE;
try {
  CODE = (readFileSync('C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/ACCESS-CODES.md', 'utf8')
    .match(/PPW-[A-Z0-9]{5}-[A-Z0-9]{5}/) || [])[0];
} catch { /* reported below */ }
if (!CODE) { console.log('FAIL: no access code found in ACCESS-CODES.md'); process.exit(1); }

// A SEPARATE ORIGIN to host the iframe, standing in for ppwellness.co. Same-origin
// framing would prove nothing: the question is whether another site can embed this
// app, and that is decided by headers the app sends, not by the markup.
const SITE_PORT = 5341;
const siteHtml = `<!doctype html><html><head><meta charset="utf-8"><title>ppwellness.co stand-in</title>
<style>body{margin:0;background:#F5EBD7;font-family:system-ui;padding:24px}
.ppw-app-demo{max-width:390px;margin:0 auto;aspect-ratio:390/844;border-radius:28px;overflow:hidden;box-shadow:0 18px 50px rgba(10,20,40,.35)}
.ppw-app-demo iframe{width:100%;height:100%;border:0;display:block}</style></head>
<body><h1 style="text-align:center;color:#232C3B">See it working</h1>
<div class="ppw-app-demo"><iframe src="${APP}/?demo=1" title="PPWellness Lifestyle App - interactive demo" loading="eager" allow="clipboard-write" referrerpolicy="no-referrer"></iframe></div>
</body></html>`;
const site = createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(siteHtml); });
await new Promise((r) => site.listen(SITE_PORT, r));

const browser = await chromium.launch({ headless: true, channel: process.env.INTRO_CHROME ? undefined : 'chrome', executablePath: process.env.INTRO_CHROME });
const errors = [];
const notes = [];
const checks = [];
const ok = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) errors.push(`CHECK FAILED: ${name}${detail ? ' -- ' + detail : ''}`);
};

const phone = async (label) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'en-GB', timezoneId: 'Indian/Mauritius' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  return { ctx, page };
};
const shoot = async (page, name) => {
  await page.evaluate(() => { window.scrollTo(0, 0); for (const el of document.querySelectorAll('*')) if (el.scrollTop) el.scrollTop = 0; });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  notes.push(name);
};
// THE GATE IS AN OPAQUE OVERLAY OVER A RENDERED APP -- deliberately, so the boot
// pass underneath still reads a `#r=` routine link that arrived before the code
// did. Two consequences for any harness, both of which fooled this one first time:
//   - document.body.innerText carries the app's text even while the gate covers
//     it, so "is the gate up" must be asked of the GATE's own subtree and never
//     inferred from the absence of app words.
//   - the first <input> in DOM order belongs to the app underneath (a stack
//     card's time field), so typing must be scoped to the gate as well.
const gateRoot = () => `(() => {
  const h = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /Enter your access code/i.test(e.textContent || ''));
  if (!h) return null;
  let n = h;
  for (let i = 0; i < 8 && n.parentElement; i++) { n = n.parentElement; if (n.querySelector('input')) break; }
  return n;
})()`;

const gateUp = (page) => page.evaluate(`!!${gateRoot()}`);

const type = async (page, value) => {
  const box = await page.evaluate(`(() => {
    const g = ${gateRoot()};
    const i = g && g.querySelector('input');
    if (!i) return null;
    i.scrollIntoView({ block: 'center' });
    const r = i.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  // Clear first, so a second attempt cannot append to the first one's text.
  await page.keyboard.press('Control+A');
  await page.keyboard.type(value, { delay: 8 });
  return true;
};
const submit = async (page) => {
  const at = await page.evaluate(`(() => {
    const g = ${gateRoot()};
    const b = g && [...g.querySelectorAll('button')].find((e) => /open the app|enter|unlock|continue/i.test(e.textContent));
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  // The KDF is 310k iterations on purpose; give it room on a cold JIT.
  await page.waitForTimeout(3000);
  return true;
};
// In the app == the gate is gone AND the app is genuinely there.
const inApp = async (page) => !(await gateUp(page))
  && await page.evaluate(() => /NEXT UP|LATER TODAY|Stack/i.test(document.body.innerText));

// ── 1. cold: the gate stands in front ───────────────────────────────────────
{
  const { ctx, page } = await phone('cold');
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const up = await gateUp(page);
  ok('a stranger meets the access gate', up, up ? '' : 'no gate subtree found');
  // Opacity is what matters to a person: the app IS rendered beneath the gate, so
  // a translucent overlay would let a stranger read somebody's day through it.
  // Walk UP from the card to the outermost ancestor that still covers the
  // viewport -- that is the backdrop, and it is the thing whose opacity decides
  // whether a stranger can read the day rendered behind it. gateRoot() stops at
  // the inner card (350x611), which measures nothing useful.
  const covered = await page.evaluate(`(() => {
    let n = ${gateRoot()}; if (!n) return null;
    let best = null;
    while (n && n !== document.body) {
      const r = n.getBoundingClientRect();
      if (r.width >= innerWidth - 2 && r.height >= innerHeight - 2) { best = n; break; }
      n = n.parentElement;
    }
    if (!best) return { nocover: true };
    const cs = getComputedStyle(best);
    const r = best.getBoundingClientRect();
    // Sample what is actually painted at four points, which is the only honest
    // test of "can you see through it".
    const pts = [[8,8],[innerWidth-8,8],[8,innerHeight-8],[Math.round(innerWidth/2),Math.round(innerHeight/2)]];
    const topmost = pts.map(([x,y]) => { const el = document.elementFromPoint(x,y); return el && best.contains(el); });
    return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight,
             bg: cs.backgroundColor, op: cs.opacity, coversAllCorners: topmost.every(Boolean) };
  })()`);
  const solid = !!covered && covered.coversAllCorners === true && covered.op === '1';
  ok('the gate covers the whole screen opaquely', solid, JSON.stringify(covered));
  await shoot(page, '1-access-gate');

  // A wrong code must not get in, and must not say whether the code exists.
  await type(page, 'PPW-AAAAA-BBBBB');
  await submit(page);
  const after = await page.evaluate(() => document.body.innerText);
  ok('a wrong code is refused', !(await inApp(page)), after.slice(0, 120).replace(/\n/g, ' | '));
  ok('the refusal does not reveal whether the code exists', !/no such|not found|unknown code|does not exist/i.test(after), after.slice(0, 160).replace(/\n/g, ' | '));
  await shoot(page, '2-wrong-code');
  await ctx.close();
}

// ── 2. the real code gets in, and stays in ──────────────────────────────────
{
  const { ctx, page } = await phone('real-code');
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await type(page, CODE);
  await submit(page);
  ok('the issued code opens the app', await inApp(page), 'still gated after entering the real code');
  await shoot(page, '3-unlocked');

  // Lowercase and dash-free, because someone will read it down a phone.
  const stored = await page.evaluate(() => localStorage.getItem('ppw5.access'));
  ok('access is remembered by id, never by the code itself', !!stored && !/^PPW-/i.test(stored), `ppw5.access = ${stored}`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  ok('access survives a reload', await inApp(page), 'the gate came back after a refresh');

  // Everything unlocked: no cap, no paywall, routines savable.
  const unlocked = await page.evaluate(async () => {
    const s = await import('/src/app5/store5.js');
    const st = s.getState();
    const many = Array.from({ length: 24 }, (_, i) => ({ title: 'Stack ' + (i + 1), time: '08:00' }));
    const added = s.addItemsToToday(many);
    const r = s.createRoutine('Clinic programme', [{ title: 'Pendulum swings', time: '08:00', repeat: 'daily' }]);
    return {
      premium: st.premium, premiumPaid: st.premiumPaid,
      addedUpsell: !!(added && added.upsell),
      routineUpsell: !!(r && r.upsell),
      routines: JSON.parse(localStorage.getItem('ppw5.routines') || '[]').length,
      upsellOnScreen: /Premium|\$9\.99/i.test(document.body.innerText),
    };
  });
  ok('everything is unlocked without paying', unlocked.premium === true && unlocked.premiumPaid === false, JSON.stringify(unlocked));
  ok('no stack cap', !unlocked.addedUpsell, JSON.stringify(unlocked.addedUpsell));
  ok('routines save with no paywall', !unlocked.routineUpsell && unlocked.routines > 0, JSON.stringify(unlocked));
  ok('nothing tries to sell Premium', !unlocked.upsellOnScreen, 'a price or Premium wording is on screen');
  await ctx.close();
}

// ── 3. the demo path, for the website embed ─────────────────────────────────
{
  const { ctx, page } = await phone('demo');
  await page.goto(`${APP}/?demo=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  ok('?demo=1 opens the app with no code', await inApp(page), (await page.evaluate(() => document.body.innerText)).slice(0, 120).replace(/\n/g, ' | '));

  const demoState = await page.evaluate(() => ({
    access: localStorage.getItem('ppw5.access'),
    text: document.body.innerText,
    items: (() => { try { return (JSON.parse(localStorage.getItem('ppw5.stacks') || '{}').deckItems || []).length; } catch { return -1; } })(),
  }));
  ok('the demo shows a populated day, not an empty app', /NEXT UP|LATER TODAY/i.test(demoState.text), demoState.text.slice(0, 120).replace(/\n/g, ' | '));
  ok('the demo says it is a demo', /demo/i.test(demoState.text), 'no demo marker visible');
  ok('the demo grants NO lasting access', !demoState.access, `ppw5.access = ${demoState.access}`);
  await shoot(page, '4-demo-mode');

  // ...and a normal load in the same browser still meets the gate.
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  ok('after the demo, a normal visit still meets the gate', !(await inApp(page)), 'the demo leaked lasting access');
  await ctx.close();
}

// ── 4. the actual embed, from another origin ────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[embed] pageerror: ${e.message}`));
  await page.goto(`http://localhost:${SITE_PORT}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const frames = page.frames().filter((f) => f !== page.mainFrame());
  ok('the iframe is not blocked by the app', frames.length > 0, `${frames.length} child frames`);
  let frameText = '';
  if (frames.length) {
    try { frameText = await frames[0].evaluate(() => document.body.innerText); } catch (e) { frameText = 'EVAL FAILED: ' + e.message; }
  }
  ok('the embedded app renders its own UI', /NEXT UP|LATER TODAY|Stack/i.test(frameText), frameText.slice(0, 140).replace(/\n/g, ' | '));
  ok('the embed shows no code prompt', !/access code|enter your code/i.test(frameText), frameText.slice(0, 140).replace(/\n/g, ' | '));
  await page.screenshot({ path: `${OUT}/5-embed-on-website.png` });
  notes.push('5-embed-on-website');
  await ctx.close();
}

await browser.close();
site.close();

writeFileSync(`${OUT}/gate.json`, JSON.stringify({ checks, notes, errors, codeLength: CODE.length }, null, 2));

console.log(`\nshots -> ${OUT}`);
for (const n of notes) console.log('  ' + n + '.png');
console.log('\nchecks:');
for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name}${c.pass ? '' : ' -- ' + c.detail}`);
if (errors.length) {
  console.log('\nFAILURES:');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log(`\nall ${checks.length} checks passed, no console errors`);
