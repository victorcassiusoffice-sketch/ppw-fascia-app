// THE INTRO ART IS HELD TO ITS SHOOT (2026-10-05, review pass).
//
// THE DEFECTS THESE CLOSE. tools/shoot-intro-assets.mjs generates the two app
// images on the pitch screen, and its own header promised "reproducible in one
// command a year from now". It was not:
//
//   1. The clock was the real one and the payoff crop started at y:0, so the
//      shipped stack-done.webp had "MONDAY 5 OCTOBER" — the literal day of the
//      shoot — baked into it. Every visitor from the next morning onward was
//      shown a wrong date inside the app's own intro, under the caption "And
//      this is yours, by tonight", while the app behind it said the real date.
//      A static file can never self-correct.
//   2. The same crop baked in the signed-out header: a bright accent "Sign in"
//      pill, identical in styling to the app's real accent buttons. It is a
//      control that cannot be pressed, because it is pixels — and a signed-in
//      viewer (Back from the consent screen reaches step 0) sees it directly
//      above a footer reading "Signed in as <their email>".
//   3. Locale and timezone were the machine's, and playwright and Chrome were
//      resolved from absolute paths into a DIFFERENT repo and Program Files, so
//      the script threw before it started on any machine but one.
//
// WHY THIS FILE TESTS A RECEIPT RATHER THAN PIXELS. Reading what a webp actually
// DEPICTS needs a decoder, and this repo does not declare sharp (see the note in
// intro-art-tone.test.js: the shoot script reaches into a sibling checkout's
// node_modules for it). So the shoot writes tools/intro-assets.shot.json — the
// pinned instant, the locale, the anchored crop rectangles, the measured boxes
// of the date line and the account pill with the proof they fell OUTSIDE every
// frame, and a sha256 of each file it produced. This file holds the committed
// art to that receipt. Hand-edited art, art shot by an older script, or a crop
// that creeps back up into the header all fail here.
//
// What is a GUARD rather than a regression test is marked as such below: the
// aspect-ratio and byte-ceiling checks passed before this pass too. The
// receipt, the crop origin, the clock and the portability checks did not.
//
// Verified by eye, which no test can do: the regenerated stack-done.webp was
// opened and read at full size and at its true 210px display width. It is the
// Indigo app, the hero card and the first row of the day are whole, nothing is
// sliced, and it matches "And this is yours, by tonight." Two consecutive runs
// of the fixed script produced byte-identical files.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.cwd();
const ART = join(ROOT, 'public', 'assets', 'onboarding');
const SCRIPT = join(ROOT, 'tools', 'shoot-intro-assets.mjs');
const RECEIPT = join(ROOT, 'tools', 'intro-assets.shot.json');
const SCREEN = join(ROOT, 'src', 'app5', 'screens', 'OnboardingScreen.jsx');

const source = readFileSync(SCRIPT, 'utf8');
const screen = readFileSync(SCREEN, 'utf8');
const receipt = existsSync(RECEIPT) ? JSON.parse(readFileSync(RECEIPT, 'utf8')) : null;

/**
 * Width and height straight out of the RIFF/WEBP header — no decoder, no
 * dependency. sharp writes these at quality 78 as lossy "VP8 " chunks, where
 * the dimensions are two 14-bit fields after the start code; the other two
 * chunk kinds are handled so a future encoder change fails loudly instead of
 * reading nonsense out of the wrong offset.
 */
function webpSize(file) {
  const b = readFileSync(file);
  expect(b.toString('ascii', 0, 4)).toBe('RIFF');
  expect(b.toString('ascii', 8, 12)).toBe('WEBP');
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8X') return { width: (b.readUIntLE(24, 3) & 0xffffff) + 1, height: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
  throw new Error(`${file}: unhandled webp chunk ${JSON.stringify(chunk)} — teach webpSize about it`);
}

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

describe('the shipped intro art is the art the shoot produced', () => {
  it('leaves a receipt of the run that made it', () => {
    expect(receipt, 'tools/intro-assets.shot.json is missing — re-run node tools/shoot-intro-assets.mjs').toBeTruthy();
    expect(receipt.generatedBy).toBe('tools/shoot-intro-assets.mjs');
    expect(receipt.passes).toBe(true);
    expect(receipt.frames.map((f) => f.file).sort()).toEqual(['stack-done.webp', 'stack-real.webp']);
  });

  it('matches it byte for byte, so nothing was hand-edited afterwards', () => {
    for (const f of receipt.frames) {
      const file = join(ART, f.file);
      expect(existsSync(file), `${f.file} is in the receipt but not on disk`).toBe(true);
      expect(statSync(file).size, `${f.file} byte size`).toBe(f.bytes);
      expect(sha256(file), `${f.file} content`).toBe(f.sha256);
      expect(webpSize(file), `${f.file} pixel size`).toEqual({ width: f.width, height: f.height });
    }
  });
});

describe('nothing stale or state-dependent is inside a frame', () => {
  it('starts the payoff crop BELOW the header band, not at the top of the screen', () => {
    const done = receipt.frames.find((f) => f.file === 'stack-done.webp');
    expect(done.clip.y, 'a crop from y:0 catches the dated header and the account pill').toBeGreaterThan(0);
    expect(source).not.toMatch(/clip:\s*\{\s*x:\s*0,\s*y:\s*0\s*,/);
  });

  it('proves the dated header line fell outside every frame', () => {
    const date = receipt.excludedFromFrames.find((e) => e.what === 'dated-header-line');
    expect(date, 'the shoot did not even look for the date line').toBeTruthy();
    expect(date.present, 'the app stopped drawing a date — re-check this guard still means anything').toBe(true);
    expect(date.outside['stack-done']).toBe(true);
    expect(date.outside['stack-real']).toBe(true);
    expect(date.bottom).toBeLessThanOrEqual(date.payoffCropTop);
  });

  it('proves the signed-out "Sign in" pill fell outside every frame', () => {
    const pill = receipt.excludedFromFrames.find((e) => e.what === 'signed-out-sign-in-pill');
    expect(pill).toBeTruthy();
    expect(pill.outside['stack-done']).toBe(true);
    expect(pill.outside['stack-real']).toBe(true);
  });

  it('still shows a DAY and not one card — the caption claims a day', () => {
    expect(receipt.payoffIncludes).toEqual({ heroCard: true, laterTodayLabel: true, firstRowWhole: true });
  });
});

describe('the shoot is repeatable', () => {
  it('pins the clock, so a re-run cannot stamp a new date into the art', () => {
    expect(receipt.clock).toBe('pinned');
    expect(receipt.shotAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(source).toMatch(/clock\.setFixedTime/);
  });

  it('fixes the locale and the timezone instead of inheriting the machine', () => {
    expect(receipt.locale).toBeTruthy();
    expect(receipt.timezone).toBeTruthy();
    expect(source).toMatch(/locale:\s*LOCALE/);
    expect(source).toMatch(/timezoneId:\s*TZ/);
  });

  it('waits for the animations to settle, which is what made two runs differ', () => {
    // `document.getAnimations()`, not bare `getAnimations()`: the prose above
    // the call mentions the latter, and a comment must not be able to satisfy
    // an assertion about behaviour.
    expect(source).toMatch(/document\.getAnimations\(\)/);
  });

  it('can run off this one machine', () => {
    // Playwright is looked for HERE first; the sibling checkout survives only as
    // a named fallback, because neither playwright nor sharp is declared in this
    // repo's package.json.
    expect(source).toMatch(/fileURLToPath\(import\.meta\.url\)/);
    // Compared INSIDE the candidate list, not across the whole file: the header
    // comment names the sibling checkout while explaining why it is a fallback.
    const bases = /const PW_BASES = \[([\s\S]*?)\];/.exec(source);
    expect(bases, 'no PW_BASES candidate list').toBeTruthy();
    expect(bases[1].indexOf("resolve(HERE, '..', 'package.json')")).toBeGreaterThan(-1);
    expect(bases[1].indexOf("resolve(HERE, '..', 'package.json')"))
      .toBeLessThan(bases[1].indexOf('ppw-designer-2d'));
    // The browser comes from playwright's own channel lookup, not a Windows path.
    expect(source).toMatch(/channel:\s*'chrome'/);
    expect(source).not.toMatch(/Program Files/);
  });
});

describe('the art and the screen it is drawn into agree (guard, not a regression)', () => {
  it('declares the payoff aspect ratio the file actually has', () => {
    // objectFit:'cover' crops silently when these disagree — a mismatch is
    // invisible in review and shows up as a sliced screenshot on a phone.
    const after = screen.slice(screen.indexOf("obImg('stack-done')"));
    const m = /aspectRatio:\s*'(\d+)\s*\/\s*(\d+)'/.exec(after);
    expect(m, 'no aspectRatio on the payoff image').toBeTruthy();
    const declared = Number(m[1]) / Number(m[2]);
    const file = webpSize(join(ART, 'stack-done.webp'));
    expect(Math.abs(declared - file.width / file.height)).toBeLessThan(0.002);
  });

  it('keeps the onboarding directory inside the budget a visitor pays for', () => {
    const files = readdirSync(ART);
    const total = files.reduce((n, f) => n + statSync(join(ART, f)).size, 0);
    expect(total).toBeLessThan(80 * 1024);
    expect(statSync(join(ART, 'stack-done.webp')).size).toBeLessThan(36 * 1024);
    expect(statSync(join(ART, 'stack-real.webp')).size).toBeLessThan(10 * 1024);
  });
});
