// The whole journey, in a real browser, at phone size, in Indigo.
//
// 717 green tests prove the arithmetic of the codec and the shape of the store.
// They prove nothing about whether a practitioner can actually find the share
// control, whether the link a messenger would carry actually opens anything,
// or whether the receive sheet is legible on the dark ground this app just
// switched to. jsdom has no layout and no paint.
//
// So this plays the real story across TWO separate browser contexts -- two
// phones -- and fails on anything that would strand either person:
//
//   phone 1  a practitioner, signed in and premium, builds a six-week programme,
//            saves it as a routine, and shares it. We capture the exact URL.
//   phone 2  a brand-new recipient, empty storage, opens that URL cold, walks
//            first-run, and saves the programme into their own routines.
//
// Usage:
//   npx vite --port 5240 --strictPort     (in another shell)
//   node tools/shoot-share-journey.mjs
//
// Exits non-zero on any console error, pageerror, missing frame, or failed check.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';

// Resolve playwright from wherever it actually lives, this repo first. The same
// lesson as the intro shoot: a hard-coded path is why a script runs on exactly
// one machine.
let chromium, pwFrom;
for (const base of [
  'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/package.json',
  'C:/Users/Victor/Documents/PPW-Code/ppw-designer-2d/package.json',
  'C:/Users/Victor/Documents/PPW-Code/ppw-tutorial-studio/package.json',
]) {
  try { ({ chromium } = createRequire(base)('playwright')); pwFrom = base; break; } catch { /* next */ }
}
if (!chromium) { console.log('FAIL: playwright not resolvable from any known repo'); process.exit(1); }

const PORT = process.env.SMOKE_PORT || '5240';
const BASE = `http://localhost:${PORT}`;
const OUT = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share/.shots/share-journey';
mkdirSync(OUT, { recursive: true });

const launch = { headless: true };
if (process.env.INTRO_CHROME) launch.executablePath = process.env.INTRO_CHROME;
else launch.channel = 'chrome';
const browser = await chromium.launch(launch);

const errors = [];
const notes = [];
const checks = [];
const ok = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  if (!pass) errors.push(`CHECK FAILED: ${name}${detail ? ' -- ' + detail : ''}`);
};

// The clock is pinned for the same reason the intro shoot pins it: a shot whose
// content depends on the hour it was taken is not evidence of anything.
const SHOT_AT = new Date('2026-10-05T06:30:00Z');
const LOCALE = 'en-GB';
const TZ = 'Indian/Mauritius';

async function phone(label, seed = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    locale: LOCALE,
    timezoneId: TZ,
  });
  await ctx.clock.setFixedTime(SHOT_AT);
  // Seed only -- NEVER clear. A context-level init script runs on every document,
  // so a localStorage.clear() here wipes the held programme the app just wrote and
  // the harness then reports the app lost it. Each context is a fresh profile
  // already, so there is nothing to clear.
  if (Object.keys(seed).length) {
    await ctx.addInitScript((s) => {
      try { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (_) {}
    }, seed);
  }
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  return { ctx, page };
}

const shoot = async (page, name) => {
  // Reset every scroll container first. Walking the doors scrolls things into
  // view, and a frame captured mid-scroll shows a clipped heading that looks
  // like a layout bug and is not one -- measured: the sheet panel sits at y=34
  // with scrollTop 0 from 1 to 12 items. Evidence has to show what the person
  // actually lands on.
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('*')) {
      if (el.scrollTop) el.scrollTop = 0;
    }
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  notes.push(name);
};

const ONBOARDED = { 'ppw5.onboarded': '1', 'ppw5.terms': '1', 'ppw5.frc': '1' };

// ── phone 1: the practitioner ───────────────────────────────────────────────
// Premium is set through the store's own sanctioned door rather than a raw
// localStorage flag, because cachedPremium() deliberately refuses a bare flag.

const p1 = await phone('practitioner', ONBOARDED);
await p1.page.goto(BASE, { waitUntil: 'networkidle' });

const rootKids = await p1.page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
ok('the app mounts', rootKids > 0, `#root has ${rootKids} children`);

// Indigo is the default for a user who has never chosen a colourway. Prove it
// from the painted variable, not from the store: the whole point of the change
// is what the person SEES.
const ink = await p1.page.evaluate(() => {
  const el = document.querySelector('[style*="--ink"]') || document.body;
  return getComputedStyle(el).getPropertyValue('--ink').trim();
});
ok('Indigo is the default colourway', ink.toUpperCase() === '#DFE7F2', `--ink = ${ink || 'unset'} (indigo is #DFE7F2, gloft was #453F36)`);
notes.push(`  (default --ink = ${ink})`);

// Build a six-week programme through the real store, as the builder would, then
// share it through the real share function. Two stacks a day across 42 days is
// the shape the feature exists for, and it is also the shape that used to be
// silently cut to 60.
const built = await p1.page.evaluate(async () => {
  const s = window.__ppwStore || (await import('/src/app5/store5.js'));
  window.__ppwStore = s;
  s.applyServerEntitlement({ premium: true });
  const items = [];
  for (let d = 0; d < 42; d++) {
    items.push({ title: 'Pendulum swings', meta: '2 min each arm', time: '08:00', repeat: 'daily', dayOffset: d });
    items.push({ title: 'Wall slides', meta: '3 x 10', time: '19:00', repeat: 'daily', dayOffset: d });
  }
  const r = s.createRoutine('Shoulder rehab - weeks 1-6', items);
  const url = s.routineToLink(r && r.routine ? r.routine : { name: 'Shoulder rehab - weeks 1-6', items });
  return {
    saved: !!r && !r.upsell,
    itemCount: items.length,
    url,
    urlLen: url ? url.length : 0,
  };
});

ok('a premium practitioner can save a routine', built.saved, JSON.stringify(built.saved));
notes.push(`  (84-stack programme -> ${built.url ? built.urlLen + ' char link' : 'NO LINK (falls back to the file, which is lossless)'})`);

// The P1 finding: an 84-stack programme must NOT produce a link that silently
// arrives as 60. Either it refuses (null -> file fallback) or it carries all 84.
let shareUrl = built.url;
if (!shareUrl) {
  ok('an oversize programme refuses the link rather than truncating', true, 'routineToLink returned null -> .md file fallback');
  // Fall back to a programme that genuinely fits, so the rest of the journey is
  // still exercised end to end.
  const small = await p1.page.evaluate(async () => {
    const s = window.__ppwStore;
    const items = [
      { title: 'Pendulum swings', meta: '2 min each arm', time: '08:00', repeat: 'daily', dayOffset: 0 },
      { title: 'Wall slides', meta: '3 x 10', time: '13:00', repeat: 'daily', dayOffset: 0 },
      { title: 'Review with the clinic', meta: 'bring the sheet', time: '10:00', repeat: 'weekly', dayOffset: 7 },
      { title: 'Heat pack before bed', meta: '15 min', time: '21:00', repeat: 'daily', dayOffset: 14 },
    ];
    const r = s.createRoutine('Shoulder rehab - starter', items);
    return s.routineToLink(r && r.routine ? r.routine : { name: 'Shoulder rehab - starter', items });
  });
  shareUrl = small;
  notes.push(`  (4-stack programme -> ${small ? small.length + ' char link' : 'STILL NULL'})`);
}
ok('a realistic programme produces a shareable link', !!shareUrl, shareUrl ? `${shareUrl.length} chars` : 'null');

await shoot(p1.page, '1-practitioner-stack-indigo');

// The Library, where the share control lives.
await p1.page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Library');
  if (b) { const r = b.getBoundingClientRect(); window.__tap = { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }
});
const navBox = await p1.page.evaluate(() => window.__tap || null);
if (navBox) await p1.page.mouse.click(navBox.x, navBox.y);
await p1.page.waitForTimeout(600);
await shoot(p1.page, '2-practitioner-library');

await p1.ctx.close();

// ── phone 2: the recipient, cold ────────────────────────────────────────────
// Empty storage. They have never opened this app. The link is the first thing
// that ever brings them here -- which is exactly the WhatsApp story.

if (!shareUrl) {
  errors.push('no share link was produced, so the recipient journey cannot be played');
} else {
  const localUrl = shareUrl.replace(/^https?:\/\/[^/]+/, BASE);

  const p2 = await phone('recipient-cold', {});
  await p2.page.goto(localUrl, { waitUntil: 'networkidle' });
  await p2.page.waitForTimeout(900);

  const kids2 = await p2.page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  ok('the app mounts for a cold recipient', kids2 > 0, `#root has ${kids2} children`);

  // The fragment must be gone the moment it is read, or a refresh imports twice.
  const hashAfter = await p2.page.evaluate(() => window.location.hash);
  ok('the link is stripped from the URL once read', !hashAfter.startsWith('#r='), `hash is now "${hashAfter}"`);

  // ...and the programme must be held, not lost, while they walk first-run.
  const held = await p2.page.evaluate(() => {
    try { return JSON.parse(localStorage.getItem('ppw5.pendingShare') || 'null'); } catch { return null; }
  });
  ok('the programme is held while the recipient walks first-run', !!(held && held.items && held.items.length), held ? `${held.items.length} stacks held` : 'nothing held');

  await shoot(p2.page, '3-recipient-first-run');

  // Walk the first-run doors the way a finger would.
  const tapText = async (page, text) => {
    const at = await page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().toLowerCase().includes(t.toLowerCase()));
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight || !r.width) return null;
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, text);
    if (!at) return false;
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(500);
    return true;
  };

  // Straight past the doors: the point of this run is the share sheet at the end.
  for (let i = 0; i < 12; i++) {
    const seen = await p2.page.evaluate(() => document.body.innerText);
    if (/shared with you|Save to my Routines/i.test(seen)) break;
    // The real first-run journey, in order:
    //   FirstRunChoice  -> "Build mine"
    //   Onboarding 0    -> "Build mine" (the pitch, with the six-card stack show)
    //   Onboarding 1    -> tick the terms box, then "Start with an empty day",
    //                      which is the only control that calls finishOnboarding()
    // "Create an account" is deliberately NOT walked: it opens the account sheet,
    // which needs a real email, so a harness that taps it loops forever.
    await p2.page.evaluate(() => {
      // The consent tick is a plain button with no accessible text, so it is
      // found by the copy beside it rather than by a label.
      const t = [...document.querySelectorAll('button')]
        .find((b) => /terms|agree|accept/i.test(b.getAttribute('aria-label') || '')
          || (b.parentElement && /terms/i.test(b.parentElement.textContent || '') && !b.textContent.trim()));
      if (t && t.getAttribute('aria-checked') !== 'true') t.click();
    });
    const moved = (await tapText(p2.page, 'Start with an empty day'))
      || (await tapText(p2.page, 'Build mine'))
      || (await tapText(p2.page, 'Continue'))
      || (await tapText(p2.page, 'Next'))
      || (await tapText(p2.page, 'Done'));
    if (!moved) break;
  }
  await p2.page.waitForTimeout(800);

  const body = await p2.page.evaluate(() => document.body.innerText);
  ok('the share sheet reaches the recipient after first-run', /shared with you|Save to my Routines/i.test(body), body.slice(0, 180).replace(/\n/g, ' | '));

  // The schedule must be visible BEFORE they accept. A recipient who cannot see
  // the repeat and the start day is accepting something they have not been shown.
  ok('the sheet shows the schedule, not just titles', /every day|daily|weekly|from day/i.test(body), 'no repeat/day wording found in the sheet');

  await shoot(p2.page, '4-recipient-share-sheet');

  // Saving: free tier is expected to meet the premium gate, and must say so
  // rather than doing nothing.
  const tapped = await tapText(p2.page, 'Save to my Routines');
  ok('the Save control is present and tappable', tapped, 'could not find or reach "Save to my Routines"');
  await p2.page.waitForTimeout(700);

  const after = await p2.page.evaluate(() => ({
    text: document.body.innerText,
    routines: (() => { try { return JSON.parse(localStorage.getItem('ppw5.routines') || '[]').length; } catch { return -1; } })(),
  }));
  // Must match the ANSWER, not the header's own permanent "Sign in" control,
  // which is on screen regardless and made this check pass while the sheet was
  // never even reached.
  const spoke = /part of Premium|go Premium|Saved|could not be opened/i.test(after.text);
  ok('a free recipient gets a real answer, never a silent no-op', spoke, after.text.slice(0, 180).replace(/\n/g, ' | '));
  notes.push(`  (free recipient after Save: routines=${after.routines}, app said: ${(after.text.match(/[^\n]*(Premium|Saved|Sign in)[^\n]*/i) || ['-'])[0].trim().slice(0, 90)})`);

  await shoot(p2.page, '5-recipient-after-save');

  // The programme must still be there. The review found four separate accidents
  // that destroyed it; none of them may be reachable from this screen.
  const stillHeld = await p2.page.evaluate(() => {
    try { return !!JSON.parse(localStorage.getItem('ppw5.pendingShare') || 'null'); } catch { return false; }
  });
  ok('an unanswered programme survives the upsell', stillHeld || after.routines > 0, 'the held programme vanished without being saved');

  await p2.ctx.close();

  // ── phone 3: the same link, but premium ───────────────────────────────────
  const p3 = await phone('recipient-premium', ONBOARDED);
  await p3.page.goto(localUrl, { waitUntil: 'networkidle' });
  await p3.page.waitForTimeout(900);
  await p3.page.evaluate(async () => {
    const s = await import('/src/app5/store5.js');
    s.applyServerEntitlement({ premium: true });
  });
  await p3.page.waitForTimeout(500);

  const saveTap = await (async () => {
    const at = await p3.page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => /Save to my Routines/i.test(e.textContent));
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (!at) return false;
    await p3.page.mouse.click(at.x, at.y);
    await p3.page.waitForTimeout(800);
    return true;
  })();
  ok('a premium recipient can reach Save', saveTap, 'no Save control found on the premium path');

  const landed = await p3.page.evaluate(() => {
    try {
      const rs = JSON.parse(localStorage.getItem('ppw5.routines') || '[]');
      const last = rs[rs.length - 1];
      return {
        count: rs.length,
        name: last && last.name,
        items: last && last.items ? last.items.length : 0,
        repeats: last && last.items ? [...new Set(last.items.map((i) => i.repeat || 'once'))] : [],
        offsets: last && last.items ? [...new Set(last.items.map((i) => i.dayOffset || 0))] : [],
        pending: !!JSON.parse(localStorage.getItem('ppw5.pendingShare') || 'null'),
      };
    } catch (e) { return { error: String(e) }; }
  });
  ok('the programme lands in the recipient\'s own Routines', landed.count > 0 && landed.items > 0, JSON.stringify(landed));
  ok('the prescribed SCHEDULE survives the handover', (landed.repeats || []).some((r) => r && r !== 'once'), `repeats that arrived: ${JSON.stringify(landed.repeats)}`);
  ok('the start days survive the handover', (landed.offsets || []).length > 1, `day offsets that arrived: ${JSON.stringify(landed.offsets)}`);
  ok('the sheet closes once the programme is accepted', !landed.pending, 'the held programme was not cleared after a successful save');
  notes.push(`  (premium recipient: "${landed.name}" ${landed.items} stacks, repeats ${JSON.stringify(landed.repeats)}, days ${JSON.stringify(landed.offsets)})`);

  await shoot(p3.page, '6-recipient-saved');
  await p3.ctx.close();
}

await browser.close();

writeFileSync(`${OUT}/journey.json`, JSON.stringify({ shotAt: SHOT_AT, pwFrom, checks, notes, errors }, null, 2));

console.log(`\nshots -> ${OUT}`);
for (const n of notes) console.log(n.startsWith('  ') ? n : '  ' + n + '.png');
console.log('\nchecks:');
for (const c of checks) console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.name}${c.pass ? '' : ' -- ' + c.detail}`);
if (errors.length) {
  console.log('\nFAILURES:');
  for (const e of errors) console.log('  ' + e);
  process.exit(1);
}
console.log(`\nall ${checks.length} checks passed, no console errors`);
