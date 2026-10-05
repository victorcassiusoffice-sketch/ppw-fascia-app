// The colour of an error (2026-10-05).
//
// THE DEFECT THIS FILE CLOSES. Every error message in the app was painted
// `var(--bad, #c05)`. `--bad` was defined by no stylesheet and by no branch of
// theme5.js, so the fallback — #CC0055 — was what actually painted, in every
// skin, always. On the Indigo default that literal measures 1.05:1 against the
// top stop of the app's own ground: not "hard to read", invisible. The worst
// case was the passcode lock, where a mistyped PIN told the person nothing at
// all and a wrong code was indistinguishable from a frozen app. The same token
// carried the "Delete my account" row label (1.25:1 on --surface) — the one
// destructive row in the app, blank while every row beside it read fine.
//
// WHY A TOKEN AND NOT `--ink`. The author had already fixed one of the twelve
// sites by switching it to `var(--ink)`. That is legible, but it leaves the app
// with no error colour at all and leaves `var(--bad, …)` at the other eleven,
// reading as though a token existed. So the token now exists, per colourway, and
// the fallbacks are gone — a bare `var(--bad)` either resolves or is a bug these
// tests catch, rather than silently painting pink.
//
// WHAT THE NUMBERS ARE HELD TO. Two bars, both measured here from the real
// emitted vars rather than asserted by eye:
//   1. Indigo — the default, and the colourway that caused this — clears the
//      WCAG 4.5:1 body-text floor on every stop of --ground and of --surface.
//   2. Every colourway's --bad is at least as legible as that colourway's own
//      --ink on the same stops. An error line is never fainter than the ordinary
//      body text the design already ships. (Graphite's and Crimson's own ink are
//      2.76:1 and 1.78:1 — those colourways cannot reach 4.5:1 for ANY text, and
//      pretending otherwise here would mean inventing a colour out of register
//      with the skin. Ink parity is the honest bar for them; the gap is a
//      pre-existing property of those two palettes, noted and not hidden.)

import { describe, it, expect } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import { SOFT, themeVars, parseVars } from './theme5.js';

// ── contrast maths, WCAG 2.1 relative luminance ────────────────────────────
const hex = (h) => {
  const s = h.trim().replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const la = lum(hex(a)), lb = lum(hex(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
/** `color-mix(in srgb, A p%, B)` — srgb is the GAMMA-ENCODED space, so this is a
 *  plain weighted average of the 0-255 channels, which is what the browser does. */
const mix = (a, b, p) => {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v * p / 100 + B[i] * (100 - p) / 100)
    .toString(16).padStart(2, '0')).join('');
};

const vars = (S) => parseVars(themeVars(S));

/**
 * Every backdrop a --bad text run can land on in one soft colourway: the three
 * stops of --ground (the app's own backdrop, and what the lock screen and the
 * share sheet sit on) and the three stops of --surface (every card and sheet).
 *
 * --ground stops are read out of the EMITTED value, so a re-tuned gradient is
 * re-measured for free. --surface is built from color-mix() at runtime, which
 * jsdom will not resolve, so its stops are recomputed here from the same two
 * fields themeVars uses — and the test below pins the formula so the two cannot
 * drift apart silently.
 */
function backdrops(key) {
  const c = SOFT[key];
  const v = vars({ skin: 'soft', soft: key });
  const groundStops = v['--ground'].match(/#[0-9A-Fa-f]{6}/g) || [];
  expect(groundStops.length, `${key}: --ground should be a 3-stop hex gradient`).toBe(3);
  return [
    ...groundStops,
    mix(c.base, c.lite || '#FFFFFF', 60),   // --surface 0%  (its lightest stop)
    c.base,                                  // --surface 50%
    mix(c.base, c.deep || '#5A5248', 84),    // --surface 100%
  ];
}

const SOFT_KEYS = Object.keys(SOFT).filter((k) => !SOFT[k].gel);

// Every state themeVars can be in, so "every branch" is a list and not a hope.
// Five code branches: glass-dark, glass-light, gel-darkInk, gel-lightInk, soft.
const EVERY_BRANCH = [
  ...SOFT_KEYS.map((k) => [`soft/${k}`, { skin: 'soft', soft: k }]),
  ...SOFT_KEYS.map((k) => [`soft/${k} + a11y`, { skin: 'soft', soft: k, a11y: { on: true } }]),
  ['soft/gel + light ink', { skin: 'soft', soft: 'gel', gelBg: 'zen', inkMode: 'light' }],
  ['soft/gel + dark ink', { skin: 'soft', soft: 'gel', gelBg: 'zen', inkMode: 'dark' }],
  ['glass dark', { skin: 'glass', bg: 'slate' }],
  ['glass light', { skin: 'glass', bg: 'grey' }],
  ['glass + custom photo', { skin: 'glass', bg: 'grey', customBgUrl: 'blob:x' }],
  ['unknown colourway', { skin: 'soft', soft: 'no-such-colourway' }],
];

describe('the error colour is a real token', () => {
  it('is emitted by every branch of themeVars, not just the soft one', () => {
    for (const [label, S] of EVERY_BRANCH) {
      const v = vars(S);
      expect(v['--bad'], `${label} emits no --bad`).toBeTruthy();
      expect(v['--bad-surf'], `${label} emits no --bad-surf`).toBeTruthy();
      expect(v['--bad-ink'], `${label} emits no --bad-ink`).toBeTruthy();
      expect(v['--bad'], `${label}: --bad is not a colour`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('every colourway declares its own, so a new skin cannot inherit a stranger’s red', () => {
    for (const key of SOFT_KEYS) {
      expect(SOFT[key].bad, `${key} has no bad:`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  // The whole point of finishing the job: `var(--bad, #c05)` is a token system
  // with its own contradiction written into it. If the token resolves the
  // fallback is dead code; if it does not, the app paints #CC0055 and nobody
  // finds out. There is now no fallback anywhere, so a missing token is a
  // visible bug instead of an invisible one.
  it('no call site still carries the #CC0055 fallback', () => {
    const SELF = 'src/app5/error-colour.test.jsx';
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
    const files = walk('src').filter((f) => f !== SELF && /\.(js|jsx|ts|tsx|css|html)$/.test(f));

    const withFallback = files.filter((f) => /var\(\s*--bad[a-z-]*\s*,/.test(readFileSync(f, 'utf8')));
    expect(withFallback, 'var(--bad, …) still has a fallback here').toEqual([]);

    const withLiteral = files.filter((f) => /#c{2}0055|#c05\b/i.test(readFileSync(f, 'utf8')));
    expect(withLiteral, 'the #CC0055 literal is still in these files').toEqual([]);
  });
});

describe('Indigo — the default, and the colourway that caused this', () => {
  it('clears the 4.5:1 body-text floor on every ground and surface stop', () => {
    const bad = vars({ skin: 'soft', soft: 'indigo' })['--bad'];
    for (const bg of backdrops('indigo')) {
      expect(ratio(bad, bg), `--bad ${bad} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The number that made this a P1 rather than a polish item.
  it('is a wholesale improvement on the #CC0055 it replaces', () => {
    const bad = vars({ skin: 'soft', soft: 'indigo' })['--bad'];
    const groundTop = backdrops('indigo')[0];
    expect(ratio('#CC0055', groundTop)).toBeLessThan(1.1);      // the defect: invisible
    expect(ratio(bad, groundTop)).toBeGreaterThan(4.5);         // the fix
  });
});

describe('every colourway', () => {
  it('reads at least as well as that colourway’s own body ink', () => {
    for (const key of SOFT_KEYS) {
      const v = vars({ skin: 'soft', soft: key });
      const bgs = backdrops(key);
      const inkWorst = Math.min(...bgs.map((b) => ratio(v['--ink'], b)));
      const badWorst = Math.min(...bgs.map((b) => ratio(v['--bad'], b)));
      expect(badWorst, `${key}: --bad ${badWorst.toFixed(2)}:1 vs --ink ${inkWorst.toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(inkWorst);
    }
  });

  // --bad-surf is the one place the error colour is PAINT rather than text: the
  // "Delete my account" confirm button. A pale rose that is right for text on a
  // dark skin is catastrophic as a fill under white text, which is exactly why
  // these are two tokens and not one.
  it('can carry white text on the destructive button', () => {
    for (const [label, S] of EVERY_BRANCH) {
      const v = vars(S);
      expect(ratio(v['--bad-ink'], v['--bad-surf']), `${label}: ${v['--bad-ink']} on ${v['--bad-surf']}`)
        .toBeGreaterThanOrEqual(4.5);
    }
  });

  // backdrops() recomputes --surface by hand because jsdom cannot resolve
  // color-mix(). If themeVars ever changes those two mix percentages, the
  // measurements above would quietly start grading the wrong colour.
  it('still builds --surface from the stops this file measures', () => {
    for (const key of SOFT_KEYS) {
      const c = SOFT[key];
      const surface = vars({ skin: 'soft', soft: key })['--surface'];
      expect(surface, `${key} --surface`).toContain(`color-mix(in srgb, ${c.base} 60%, ${c.lite || 'white'})`);
      expect(surface, `${key} --surface`).toContain(`color-mix(in srgb, ${c.base} 84%, ${c.deep || '#5A5248'})`);
    }
  });
});

describe('the screens that were blank', () => {
  // The worst case in the finding: a wrong PIN with nothing on screen. The error
  // element has to name the token, and the token has to exist — this file's first
  // describe block proves the second half, so here we only prove the first.
  it('the passcode error names the token with no fallback behind it', () => {
    const src = readFileSync('src/app5/screens/LockScreen.jsx', 'utf8');
    expect(src).toContain("color: 'var(--bad)'");
    expect(src).not.toMatch(/var\(--bad\s*,/);
  });

  it('the Delete-my-account row and its confirm button are both themed', () => {
    const src = readFileSync('src/app5/screens/AccountSheet.jsx', 'utf8');
    expect(src).not.toMatch(/var\(--bad\s*,/);
    // The row LABEL is text on --surface; the confirm BUTTON is paint. Different
    // tokens, because one pale colour cannot be both.
    expect(src).toContain("color: 'var(--bad)'");
    expect(src).toContain("background: 'var(--bad-surf)'");
    expect(src).toContain("color: 'var(--bad-ink)'");
  });
});

describe('the error still reaches the person', () => {
  // A colour change must not quietly drop the alert semantics with it — the
  // screen reader path is the one that was never broken, and regressing it to
  // fix the sighted path would be a poor trade.
  it('the paste-a-link error is still announced, and no longer the odd one out', async () => {
    const { default: AddSheet } = await import('./screens/AddSheet.jsx');
    const { setState } = await import('./store5.js');
    localStorage.clear();
    setState({ addOpen: true, tab: 'link', customUrl: 'not-a-link', premium: true });
    render(<AddSheet />);
    const addBtn = screen.getByText('Add');
    addBtn.click();
    const alert = await screen.findByRole('alert');
    expect(alert.style.color).toBe('var(--bad)');
    cleanup();
  });
});
