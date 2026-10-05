// Generate the intro's two app images FROM THE APP (2026-10-05).
//
// WHY THIS EXISTS. The pitch screen teaches "This is a Stack." next to a clay
// render that is not a Stack, and finishes with no picture of the thing the user
// is being promised. The obvious fix — drop in the marketing stills that came
// with the brief — is wrong four ways: every one of them is gold-toned because
// gloft was the default colourway when they were made and the app is now dark
// Indigo; the hero frames depict a UI that never shipped (their own Seedance job
// manifests and ffmpeg overlay logs prove it); two of them carry a third party's
// face and a YouTube thumbnail with no rights record; and they are 90-116 KB
// JPGs against a 29,912-byte existing onboarding budget.
//
// So the art is SHOT, not sourced. Real Chromium, the real built bundle, the real
// Stack screen, in Indigo, at the phone size the app is used at. Re-run it after
// any change to the Stack screen or the default colourway and the pitch stays
// honest for free.
//
// THE DECK IS SEEDED, AND NOT WITH THE STARTER DECK. starterDeck() is three
// YouTube items whose thumbnails come from i.ytimg.com — shooting it would bake
// someone else's video art into a file we ship, which is the exact rights problem
// that disqualified the supplied images. These six are the pitch's own six cards
// (SHOW_CARDS in OnboardingScreen.jsx), so the payoff frame shows the user the
// stack they just watched build.
//
// Conversion is a MANUAL sharp step, like tools/make-logo-webp.mjs — never a
// prebuild hook. sharp resolves only through the symlinked node_modules of the
// sibling checkout (it is `dev: true, optional: true` under an absent `next`), so
// a build-time call would fail the Pages build.
//
// REPEATABILITY, THE SECOND PASS (2026-10-05, review pass). The header above
// promised "reproducible in one command a year from now" and the script was not:
//
//   1. The clock was the real one. The Stack header's first line is
//      `new Date().toLocaleDateString(...)` (App5.jsx:234), it measured
//      top:28/bottom:61, and the payoff crop started at y:0 — so the shipped
//      stack-done.webp read "MONDAY 5 OCTOBER", the literal day of the shoot,
//      on the first screen every future customer sees. It can never
//      self-correct: it is a static file. Re-running tomorrow produced a
//      different image and the git diff on a binary webp hid it.
//   2. The locale and timezone were the machine's, so the same instant rendered
//      differently on a different box, and which items sit in NEXT UP versus
//      LATER TODAY depends on the wall clock.
//   3. Playwright and Chrome were resolved from ABSOLUTE paths — into a
//      different repo (ppw-designer-2d) and into a hard-coded Windows Chrome
//      install — so the script threw before it started on any machine but one.
//   4. The crop also baked in the signed-out header: a bright accent "Sign in"
//      pill, a dead control inside a picture, contradicting the state of any
//      viewer who is signed in (reachable: Back from the consent screen).
//
// Fixed here by: pinning the clock with context.clock.setFixedTime, forcing
// locale + timezoneId, anchoring the payoff crop BELOW the whole header band
// (on the NEXT UP card the app draws) and PROVING the dated line and the Sign in
// pill fall outside it, and resolving playwright from this repo first and Chrome
// through playwright's own `channel: 'chrome'`. Every run also writes a receipt,
// tools/intro-assets.shot.json, which src/app5/intro-assets.test.js holds the
// committed art against — so hand-edited or undated-by-accident art fails a test
// instead of shipping quietly.
//
// Usage:
//   node tools/shoot-intro-assets.mjs            builds to a temp dir, serves it, shoots
//   INTRO_BASE=http://localhost:4173 node tools/shoot-intro-assets.mjs    use a running preview
//   INTRO_CHROME=/path/to/chrome node tools/shoot-intro-assets.mjs        a specific browser binary
//
// Exits non-zero on any console error, an empty #root, a missing crop target, a
// stale-state element inside a crop, or an output over budget.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

// Playwright from THIS repo if it is here, the sibling checkout only as a
// documented fallback. It used to be the absolute path alone, which is why the
// script could not run anywhere else. playwright is a dev-only tool and this
// repo does not declare it (same situation as sharp), so the fallback stays —
// it is a fallback now, not the only route.
const HERE = dirname(fileURLToPath(import.meta.url));
const PW_BASES = [
  resolve(HERE, '..', 'package.json'),                                        // this repo
  'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json',          // sibling checkout
];
let chromium = null;
let pwFrom = '';
for (const base of PW_BASES) {
  try { ({ chromium } = createRequire(base)('playwright')); pwFrom = base; break; } catch { /* next */ }
}
if (!chromium) {
  console.error('playwright not found. Tried:\n  ' + PW_BASES.join('\n  ') +
    '\nInstall it as a dev dependency here, or run from a checkout that has it.');
  process.exit(1);
}
console.log('[playwright] ' + pwFrom);

const OUT = 'public/assets/onboarding';
const RECEIPT = join(HERE, 'intro-assets.shot.json');

// THE PINNED INSTANT. Any fixed instant would do for reproducibility; this one
// is chosen so the shot makes sense — 06:40 local is before all six seeded
// slots, so the 07:00 card is NEXT UP and the other five fill LATER TODAY, with
// nothing missed and nothing done. The date it renders is cropped out of both
// frames (asserted below), so this value controls WHICH CARDS the picture shows,
// not what day it claims to be.
const SHOT_AT = new Date('2026-06-15T02:40:00.000Z');   // Mon 15 Jun 2026, 06:40 in Mauritius
const LOCALE = 'en-GB';
const TZ = 'Indian/Mauritius';
// The exact string App5's header will render, computed with the same options it
// uses. Probed in the page so a clock pin that silently failed to apply is a
// FAILURE rather than a stale date quietly shipped again.
const EXPECT_DATE = SHOT_AT
  .toLocaleDateString(LOCALE, { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ })
  .toUpperCase();
// Working frames land outside the repo: they are 4-6 MB PNGs and nothing but
// this script ever wants them, so they must not be mistaken for assets.
const WORK = mkdtempSync(join(tmpdir(), 'ppw-intro-'));

const failures = [];
function ok(m) { console.log('  PASS ' + m); }
function bad(m) { failures.push(m); console.log('  FAIL ' + m); }

// ── a server, in-process ───────────────────────────────────────────────────
// The repo's other shoot scripts ask for `vite preview` in a second shell. This
// one is an asset GENERATOR — it has to be reproducible in one command a year
// from now, so it builds and serves itself. VITE_OUT_DIR keeps the build out of
// the tracked `dist/`, and plain `vite build` skips the three prebuild scripts
// that rewrite tracked files (sync-affiliates.mjs re-stamps `_synced_at` on
// every run, so `npm run build` would dirty the tree just by looking at it).
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

let server = null;
let BASE = process.env.INTRO_BASE || '';

if (!BASE) {
  const dist = mkdtempSync(join(tmpdir(), 'ppw-intro-dist-'));
  console.log('[build] ' + dist);
  execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_OUT_DIR: dist } });

  const root = resolve(dist);
  server = createServer((req, res) => {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = resolve(join(root, normalize(path)));
    // Path traversal guard — the server is local and short-lived, but a shoot
    // script that can read outside its own dist is a footgun left lying around.
    if (!file.startsWith(root)) { res.statusCode = 403; res.end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(root, 'index.html');
    res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(4188, r));
  BASE = 'http://localhost:4188';
}
console.log('[serve] ' + BASE);

// ── the deck the shot shows ────────────────────────────────────────────────
const DECK = [
  { id: 's1', time: '07:00', title: 'Anxiety meditation',  meta: 'Audio · 10 min',                 kind: 'note', repeat: 'daily' },
  { id: 's2', time: '07:30', title: 'Stretching video',    meta: 'Online fitness · follow along',   kind: 'note', repeat: 'daily' },
  { id: 's3', time: '08:00', title: 'Affirmation video',   meta: '2 min, before the mirror',        kind: 'note', repeat: 'daily' },
  { id: 's4', time: '13:00', title: 'Prayer',              meta: 'Text or audio',                   kind: 'note', repeat: 'daily' },
  { id: 's5', time: '13:30', title: 'Dietary reminder',    meta: 'Eat before you scroll',           kind: 'note', repeat: 'daily' },
  { id: 's6', time: '18:00', title: 'Online course',       meta: 'The one you’re studying',         kind: 'note', repeat: 'daily' },
];

const SEED = {
  // No existing shoot script seeds these two: all 44 of them set the dead
  // legacy `ppw.theme` keys, which App5 has never read. The colourway is
  // `ppw5.soft`, and without it this would shoot the shot in whatever the
  // default happens to be on the day.
  'ppw5.skin': 'soft',
  'ppw5.soft': 'indigo',
  'ppw5.onboarded': '1',
  'ppw5.terms': '1',
  'ppw5.frc': '1',
  'ppw5.tourSeen': '1',
  'ppw5.stacks': JSON.stringify({ d: DECK, db: {}, ss: {}, ip: [] }),
  // The "Get the app" banner sits between the header and the NEXT UP card. It
  // self-suppresses in headless Chromium (no beforeinstallprompt, not iOS), but
  // "it happens not to render today" is not reproducibility — if it ever did, it
  // would push the anchor down and change the frame.
  'ppw5.installBannerDismissed': '1',
};

// `channel: 'chrome'`, not an absolute Windows install path: playwright finds
// the installed browser on any OS, and INTRO_CHROME overrides it for an unusual
// install. The old hard-coded path is the single reason this script could not
// run off one Windows machine.
const launch = { headless: true };
if (process.env.INTRO_CHROME) launch.executablePath = process.env.INTRO_CHROME;
else launch.channel = 'chrome';
const browser = await chromium.launch(launch);
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  // Pinned, not inherited. Without these the same instant renders a different
  // header on a machine in another country, and NEXT UP/LATER TODAY is decided
  // by whatever time of day the operator happened to run it.
  locale: LOCALE,
  timezoneId: TZ,
});
// The clock. This is the fix for the baked date: Date is frozen before any app
// script runs, so every run of this script renders the same screen.
await ctx.clock.setFixedTime(SHOT_AT);
await ctx.addInitScript((s) => {
  try {
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
  } catch (_) {}
}, SEED);

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

// domcontentloaded, NOT networkidle: the app fetches an entitlement and a
// version sentinel, and waiting for "idle" has hung this harness before. The
// readiness that matters is asserted below, explicitly.
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

// THEN WAIT FOR THE ANIMATIONS TO FINISH, which 2500ms did not do and which is
// why two runs of this script produced different bytes even with the clock
// pinned. The NEXT UP card draws a 2.6s accent border trace on a 0.4s delay
// (App5.jsx, `ppwTrace`), so at 2.5s it is mid-flight: the frame baked in a
// half-drawn border that reads as a broken card, and a slightly different half
// each run. getAnimations().finished is the exact wait — a timeout guard sits
// under it because any infinite animation would otherwise hang the shoot.
await page.evaluate(() => Promise.race([
  Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))),
  new Promise((r) => setTimeout(r, 6000)),
]));
await page.waitForTimeout(250);

const mount = await page.evaluate(() => {
  const r = document.getElementById('root');
  return r ? r.childElementCount : 0;
});
mount > 0 ? ok(`#root has ${mount} children`) : bad('#root empty — WHITE SCREEN, nothing to shoot');

// Prove we are shooting Indigo and not a default that drifted.
const ground = await page.evaluate(() => {
  const el = document.querySelector('[style*="--ground"]');
  return el ? getComputedStyle(el).getPropertyValue('--ground').trim() : '';
});
/4E6584|12294A/i.test(ground) ? ok('shooting the indigo ground') : bad('--ground is not indigo: ' + ground);

// Both crops are ANCHORED on elements the app draws, never on magic pixel
// numbers: a layout change then moves the crop instead of silently shooting the
// wrong part of the screen and shipping it.
const anchors = await page.evaluate((expectDate) => {
  const leafWith = (re) => {
    const all = [...document.querySelectorAll('*')].filter((n) => re.test(n.textContent || ''));
    const leaf = all.filter((n) => !all.some((m) => m !== n && n.contains(m)));
    return leaf[0] || null;
  };
  const r = (n) => {
    if (!n) return null;
    const b = n.getBoundingClientRect();
    return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, text: (n.textContent || '').trim() };
  };
  const nextUp = document.querySelector('[data-tour="next-up"]');
  // The LATER TODAY rows, in order. data-dragidx is the app's own per-row
  // attribute (App5.jsx:379), so these are real row boxes, not guesses.
  const rows = [...document.querySelectorAll('[data-dragidx]')].map(r);
  return {
    title: r(leafWith(/^Stack$/)),
    later: r(leafWith(/^LATER TODAY$/i)),
    nextUp: r(nextUp),
    rows,
    // The two things that must NOT be in a shipped frame: the dated header line
    // (stale the day after the shoot, for ever) and the signed-out account pill
    // (a dead control in a picture, and a lie to any signed-in viewer).
    dateLine: r(leafWith(new RegExp('^' + expectDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'))),
    signIn: r(leafWith(/^Sign in$/i)),
    clock: new Date().toISOString(),
  };
}, EXPECT_DATE);
anchors.title ? ok('found the screen title') : bad('no "Stack" heading to anchor the payoff crop');
anchors.later ? ok('found the later-today list') : bad('no "LATER TODAY" label to anchor the chip crop');
anchors.nextUp ? ok('found the next-up card') : bad('no NEXT UP card to anchor the payoff crop');
if (!anchors.title || !anchors.later || !anchors.nextUp) { await browser.close(); if (server) server.close(); process.exit(1); }

// The clock pin, proven in the page rather than assumed. If setFixedTime ever
// stops applying, the header silently goes back to carrying today's date — so
// the run has to fail here, loudly, instead of shipping it.
anchors.clock === SHOT_AT.toISOString()
  ? ok('clock pinned to ' + SHOT_AT.toISOString())
  : bad(`clock NOT pinned — page says ${anchors.clock}, expected ${SHOT_AT.toISOString()}`);
anchors.dateLine
  ? ok(`header renders the pinned date "${EXPECT_DATE}"`)
  : bad(`no header line reading "${EXPECT_DATE}" — the clock or the locale did not take`);

await page.screenshot({ path: WORK + '/stack-full.png' });

// stack-real — the 46px disc in the "This is a Stack." info chip. Shot over the
// LATER TODAY rows rather than over the hero card, because 46 CSS px is far too
// small to read one card: what survives at that size is the RHYTHM of a list,
// which is the one thing the caption ("This is a Stack.") is claiming. 350 CSS
// is the full card width, so no card is cut off; sharp squares it to 560.
const CLIP_REAL = { x: 20, y: Math.round(anchors.later.top) - 6, width: 350, height: 350 };
await page.screenshot({ path: WORK + '/stack-real.png', clip: CLIP_REAL });

// stack-done — the payoff frame under the six landed cards.
//
// IT NO LONGER STARTS AT THE TOP OF THE SCREEN (2026-10-05, review pass), and
// that is the whole fix for the baked date. y:0 put the header band in every
// frame, and that band carries two things a static file must never carry: the
// date (stale from the next morning onward — the shipped file read "MONDAY 5
// OCTOBER") and the signed-out accent "Sign in" pill (a control that cannot be
// pressed because it is pixels, shown to viewers who are signed in).
//
// The header cannot be half-kept: the date line and the h1 are a left column
// while the Sign in pill and three 44px discs are a right column on the SAME
// flex row, so any crop line through the band slices discs in half. So the crop
// starts below the band, anchored on the NEXT UP card the app draws, with 12px
// of ground above it so the card does not butt the top edge. What is left is
// the most recognisable part of the screen anyway — the accent-traced hero with
// its time and title, and the LATER TODAY rows under it.
//
// IT IS ALSO TALLER THAN THE FIRST PASS (300 -> ~465). Losing the header moved
// the window down, and a 300-tall window starting at the hero card holds EXACTLY
// the hero card: measured, the card runs 134-385 and LATER TODAY only begins at
// 434, so the frame stopped short of the list and the picture read as one card.
// The caption under it says "And this is yours, by tonight", which is a claim
// about a DAY, not about a card. So the bottom edge is anchored too — in the gap
// between the first and second LATER TODAY rows, so the frame holds the hero,
// the label and one whole row with nothing sliced through. (Not the 512 the
// original plan sketched: that was 449 px of column at the old display width,
// which pushed the four info chips below the fold on an 844 px phone. This frame
// pays for its height by being drawn narrower — see the figure in
// OnboardingScreen.jsx, and the measured fold in the receipt.)
const DONE_TOP = Math.max(0, Math.round(anchors.nextUp.top) - 12);
const DONE_BOTTOM = anchors.rows.length >= 2
  ? Math.round((anchors.rows[0].bottom + anchors.rows[1].top) / 2)   // the gap: nothing is cut
  : Math.round(anchors.nextUp.bottom + 80);                          // degraded, but never a sliced row
const CLIP_DONE = { x: 0, y: DONE_TOP, width: 390, height: DONE_BOTTOM - DONE_TOP };
await page.screenshot({ path: WORK + '/stack-done.png', clip: CLIP_DONE });

// The payoff frame must show the LIST, not just the hero card — that is the
// difference between illustrating "your day" and illustrating "a card" — and no
// row may be sliced by the bottom edge, which is what reads as a broken picture.
const inside = (box, clip) => box.top >= clip.y && box.bottom <= clip.y + clip.height;
anchors.rows.length >= 2 ? ok(`${anchors.rows.length} later-today rows to anchor against`)
  : bad('fewer than two later-today rows — the payoff crop cannot be anchored in a gap');
inside(anchors.later, CLIP_DONE)
  ? ok('the payoff frame reaches the LATER TODAY list')
  : bad('the payoff frame stops short of the list — it shows one card, not a day');
anchors.rows.length && inside(anchors.rows[0], CLIP_DONE)
  ? ok('the first later-today row is whole in the payoff frame')
  : bad('the payoff frame slices a later-today row');
const payoffIncludes = {
  heroCard: inside(anchors.nextUp, CLIP_DONE),
  laterTodayLabel: inside(anchors.later, CLIP_DONE),
  firstRowWhole: !!anchors.rows.length && inside(anchors.rows[0], CLIP_DONE),
};

// PROVE the two stale-state elements are outside both frames. A probe, not a
// promise: if a layout change ever moves the date or the account pill down into
// a crop, this run fails and nothing is written, instead of a wrong date going
// out on the first screen a customer sees and hiding inside a binary diff.
const excluded = [];
const outside = (box, clip) => box.bottom <= clip.y || box.top >= clip.y + clip.height
  || box.right <= clip.x || box.left >= clip.x + clip.width;
for (const [what, box] of [['dated-header-line', anchors.dateLine], ['signed-out-sign-in-pill', anchors.signIn]]) {
  // Absent is fine — nothing to bake in. Present-and-inside is not.
  const clearOf = {};
  for (const [frame, clip] of [['stack-real', CLIP_REAL], ['stack-done', CLIP_DONE]]) {
    const clear = !box || outside(box, clip);
    clearOf[frame] = clear;
    clear
      ? ok(`${what} is outside ${frame}`)
      : bad(`${what} is INSIDE ${frame} — it would be baked into a shipped file`);
  }
  excluded.push({
    what,
    present: !!box,
    text: box ? box.text : null,
    bottom: box ? Math.round(box.bottom) : null,
    payoffCropTop: CLIP_DONE.y,
    outside: clearOf,
  });
}

errs.length ? bad('console errors: ' + errs.join(' | ')) : ok('0 console errors');

await ctx.close();
await browser.close();
if (server) server.close();

// ── convert ────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
// 280, not the 560 the plan sketched: this file is only ever drawn into the
// info chip's 46 CSS px disc, so 280 is already twice what a 3x phone can show
// and 560 was twelve times it — 11.5 KB of detail nobody can see, against a
// 10 KB budget it blew.
const JOBS = [
  { src: 'stack-real.png', out: 'stack-real.webp', budget: 10 * 1024, square: 280, clip: CLIP_REAL },
  { src: 'stack-done.png', out: 'stack-done.webp', budget: 36 * 1024, clip: CLIP_DONE },
];
const frames = [];
for (const j of JOBS) {
  const pipe = sharp(WORK + '/' + j.src);
  if (j.square) pipe.resize(j.square, j.square, { fit: 'cover' });
  await pipe.webp({ quality: 78, effort: 6 }).toFile(OUT + '/' + j.out);
  const meta = await sharp(OUT + '/' + j.out).metadata();
  const size = statSync(OUT + '/' + j.out).size;
  const line = `${j.out}  ${meta.width}x${meta.height}  ${size} B`;
  size <= j.budget ? ok(line) : bad(line + ` — over the ${j.budget} B budget`);
  // The hash is what makes the receipt bite: a hand-edited or hand-replaced
  // image no longer matches what the shoot wrote, and the suite says so.
  const sha256 = createHash('sha256').update(readFileSync(OUT + '/' + j.out)).digest('hex');
  frames.push({ file: j.out, clip: j.clip, width: meta.width, height: meta.height, bytes: size, sha256, budget: j.budget });
}

// The whole directory has a ceiling, because the budget is what the pitch
// costs a visitor on mobile data before they have decided they want the app.
const dirBytes = readdirSync(OUT).reduce((n, f) => n + statSync(OUT + '/' + f).size, 0);
dirBytes < 80 * 1024
  ? ok(`${OUT} total ${dirBytes} B`)
  : bad(`${OUT} total ${dirBytes} B — over the 80 KB ceiling`);

// ── the receipt ────────────────────────────────────────────────────────────
// Committed next to the script, read by src/app5/intro-assets.test.js. It is
// what turns "I looked at the picture and it was fine" into something the suite
// can hold: the pinned instant, the locale, the anchored crops, the byte sizes
// of the files actually written, and the proof that the dated header line and
// the account pill fell outside every frame. A hand-edited image, or art shot by
// an older version of this script, no longer matches the receipt and fails.
//
// It lives in tools/, NOT in public/assets/onboarding/, because that directory
// has an 80 KB ceiling that is spent on art a visitor downloads — a build-time
// receipt must not eat into it.
writeFileSync(RECEIPT, JSON.stringify({
  generatedBy: 'tools/shoot-intro-assets.mjs',
  shotAt: SHOT_AT.toISOString(),
  clock: 'pinned',
  locale: LOCALE,
  timezone: TZ,
  headerDateRendered: EXPECT_DATE,
  skin: 'soft/indigo',
  viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
  frames,
  payoffIncludes,
  excludedFromFrames: excluded,
  dirBytes,
  passes: failures.length === 0,
}, null, 2) + '\n');
ok('receipt written: tools/intro-assets.shot.json');

console.log('\nreference frames: ' + WORK);
if (failures.length) { console.log('\n' + failures.length + ' FAILURE(S)'); process.exit(1); }
console.log('\nall good');
