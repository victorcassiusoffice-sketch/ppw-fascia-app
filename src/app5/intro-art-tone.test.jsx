// One app, not two, on the first screen (2026-10-05).
//
// THE DEFECT. Step 0 of onboarding lands six DemoCards, each with a 38px round
// clay thumbnail, and the moment the stack assembles a screenshot of the real
// Stack screen renders directly beneath them. The six clay webps were rendered
// when Gloft — a light, warm colourway — was the default. The app's default is
// now Indigo, which is dark and cold, and the two intro frames were re-shot
// from the running app in Indigo. Measured channel means (sharp stats):
//
//     six clay discs   L = 0.70–0.76   R−B = +20…+27   (warm cream-gold)
//     stack-real       L = 0.073       R−B = −56       (cold navy)
//     stack-done       L = 0.087       R−B = −56       (cold navy)
//     indigo --ground  L = 0.022–0.126
//
// So six cream discs sat at 5–6× the luminance of the gradient behind them,
// inches above a cold navy screenshot. Same screen, two visual registers.
//
// WHY A CSS TONE AND NOT RE-TONED FILES. The six files are shared by all eight
// colourways. Baking Indigo's temperature into the bytes would fix Indigo by
// breaking Gloft — the colourway the art was actually made for — and Ivory,
// Silver and Crimson with it. A per-colourway token is the only form of this fix
// that is correct for every skin at once, and it is reversible, costs no bytes
// against the 80 KB onboarding budget, and can be measured here. (It is also the
// only form that can be tested: webp decoding needs sharp, which this repo does
// not declare — tools/shoot-intro-assets.mjs reaches into a sibling checkout's
// node_modules for it precisely because of that.)
//
// WHAT THESE TESTS PROVE, AND WHAT WAS PROVEN ELSEWHERE. Below is the
// arithmetic — the declared filter chain maps the measured clay art into
// Indigo's own luminance band and turns it cold, without clipping its tonal
// range — plus the wiring, that every surface showing this art names the token.
// jsdom cannot execute a filter, so the pixels were checked separately in real
// Chromium on the built bundle (2026-10-05): Canvas2D's filter, which is the
// same implementation as CSS filter, returns rgb(79,104,149) for the clay mean
// against this model's rgb(80,105,149) — one unit, in one channel — and the
// first-run poster, the build show and the desktop room were all screenshot at
// 430px and 1440px and read as one app. Not claimed: any phone, any colourway
// other than Indigo, and the question of whether re-RENDERING the art would be
// better than toning it. It probably would; it needs new source assets and Vic.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { SOFT, themeVars, parseVars } from './theme5.js';
import { setState } from './store5.js';
import OnboardingScreen from './screens/OnboardingScreen.jsx';
import FirstRunChoice from './screens/FirstRunChoice.jsx';
import App5 from './App5.jsx';

const SETTLE = 6 * 420 + 450 + 60;

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollTo = () => {};
  window.scrollTo = () => {};
  setState({ onboarded: false, obStep: 0, termsOk: false, signedIn: false, firstRunChoice: true, soft: 'indigo' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

function runClock(ms = SETTLE) {
  act(() => { vi.advanceTimersByTime(ms); });
  act(() => { vi.advanceTimersByTime(600); });
}

const vars = (S) => parseVars(themeVars(S));

// ── the CSS filter shorthand, implemented ─────────────────────────────────
// Filter Effects 1: the shorthand functions operate on sRGB (gamma-encoded)
// values and clamp to [0,1]. Each function is a colour matrix except
// brightness(), which is a per-channel linear multiply.
const mul = (M, v) => [0, 1, 2].map((r) => M[r][0] * v[0] + M[r][1] * v[1] + M[r][2] * v[2]);
const FN = {
  grayscale: (a) => { const s = 1 - a; return (v) => mul([
    [0.2126 + 0.7874 * s, 0.7152 - 0.7152 * s, 0.0722 - 0.0722 * s],
    [0.2126 - 0.2126 * s, 0.7152 + 0.2848 * s, 0.0722 - 0.0722 * s],
    [0.2126 - 0.2126 * s, 0.7152 - 0.7152 * s, 0.0722 + 0.9278 * s]], v); },
  sepia: (a) => { const s = 1 - a; return (v) => mul([
    [0.393 + 0.607 * s, 0.769 - 0.769 * s, 0.189 - 0.189 * s],
    [0.349 - 0.349 * s, 0.686 + 0.314 * s, 0.168 - 0.168 * s],
    [0.272 - 0.272 * s, 0.534 - 0.534 * s, 0.131 + 0.869 * s]], v); },
  saturate: (s) => (v) => mul([
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]], v),
  'hue-rotate': (deg) => {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return (v) => mul([
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072]], v);
  },
  brightness: (k) => (v) => v.map((x) => x * k),
};

/** Parse "grayscale(1) brightness(.38) hue-rotate(180deg)" into a pipeline.
 *  Throws on anything unrecognised, so a future tone cannot pass these tests by
 *  being un-modellable. */
function compile(tone) {
  const steps = [...tone.matchAll(/([a-z-]+)\(([^)]+)\)/g)].map(([, name, arg]) => {
    const make = FN[name];
    expect(make, `no model for filter function ${name}()`).toBeTruthy();
    return make(parseFloat(arg));
  });
  expect(steps.length, `nothing parsed out of "${tone}"`).toBeGreaterThan(0);
  return (rgb255) => {
    let v = rgb255.map((x) => x / 255);
    let clipped = false;
    for (const step of steps) {
      v = step(v).map((x) => {
        if (x < -0.002 || x > 1.002) clipped = true;
        return Math.min(1, Math.max(0, x));
      });
    }
    return { rgb: v.map((x) => x * 255), clipped };
  };
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum255 = (rgb) => {
  const [r, g, b] = rgb.map((v) => lin(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Measured with sharp .stats() over the six clay webps in
// public/assets/onboarding (meditation, stretch, affirmation, prayer, diet,
// course). CLAY_MEAN is the mean of their channel means; BRIGHT/MID/DARK are
// representative points across their tonal range, used to prove the tone does
// not crush the art into one flat value.
const CLAY_MEAN = [230, 221, 206];
const CLAY_BRIGHT = [252, 250, 245];
const CLAY_MID = [200, 185, 160];
const CLAY_DARK = [150, 130, 105];

// Indigo's ground, the thing these discs sit on:
// radial-gradient(#4E6584 0%, #31476B 46%, #12294A 100%) → L 0.126 / 0.059 / 0.022.
const INDIGO_GROUND_TOP_L = 0.1259;

const SOFT_KEYS = Object.keys(SOFT).filter((k) => !SOFT[k].gel);
const EVERY_BRANCH = [
  ...SOFT_KEYS.map((k) => [`soft/${k}`, { skin: 'soft', soft: k }]),
  ['soft/gel + light ink', { skin: 'soft', soft: 'gel', gelBg: 'zen', inkMode: 'light' }],
  ['soft/gel + dark ink', { skin: 'soft', soft: 'gel', gelBg: 'zen', inkMode: 'dark' }],
  ['glass dark', { skin: 'glass', bg: 'slate' }],
  ['glass light', { skin: 'glass', bg: 'grey' }],
  ['unknown colourway', { skin: 'soft', soft: 'no-such-colourway' }],
];

describe('the clay art is toned by the colourway, not baked', () => {
  it('every branch of themeVars emits a tone, even if that tone is none', () => {
    for (const [label, S] of EVERY_BRANCH) {
      expect(vars(S)['--art-tone'], `${label} emits no --art-tone`).toBeTruthy();
    }
  });

  // The whole argument for a token: the art was made FOR Gloft, so Gloft is the
  // colourway that must be left alone. If this ever flips to a filter, the fix
  // has turned into the bug it was closing.
  it('leaves the colourway the art was drawn for completely untouched', () => {
    expect(vars({ skin: 'soft', soft: 'gloft' })['--art-tone']).toBe('none');
    expect(vars({ skin: 'soft', soft: 'ivory' })['--art-tone']).toBe('none');
    expect(vars({ skin: 'soft', soft: 'silver' })['--art-tone']).toBe('none');
  });

  it('tones the dark colourways, where warm cream art is the defect', () => {
    // A real filter list, not merely "something other than none" — undefined is
    // also not 'none', and that is exactly the state this fix started from.
    const isFilterList = /^[a-z-]+\([^)]+\)( [a-z-]+\([^)]+\))*$/;
    expect(vars({ skin: 'soft', soft: 'indigo' })['--art-tone']).toMatch(isFilterList);
    expect(vars({ skin: 'soft', soft: 'black' })['--art-tone']).toMatch(isFilterList);
    expect(vars({ skin: 'glass', bg: 'slate' })['--art-tone']).toMatch(isFilterList);
  });
});

describe('Indigo’s tone actually lands the art in Indigo', () => {
  const tone = () => compile(vars({ skin: 'soft', soft: 'indigo' })['--art-tone']);

  // The defect, stated as a number so the fix has something to beat.
  it('the untreated art is five times brighter than the ground behind it', () => {
    expect(lum255(CLAY_MEAN) / INDIGO_GROUND_TOP_L).toBeGreaterThan(5);
  });

  it('brings it into the ground’s own luminance band', () => {
    const { rgb } = tone()(CLAY_MEAN);
    const L = lum255(rgb);
    // Visible against the gradient without shouting over it: same order as the
    // ground (0.022-0.126), and within reach of the two Indigo-shot frames
    // (0.073 / 0.087).
    expect(L).toBeGreaterThan(0.05);
    expect(L).toBeLessThan(0.25);
  });

  it('turns it cold, like the frames it shares the screen with', () => {
    const { rgb } = tone()(CLAY_MEAN);
    // Was R-B = +25 (warm). The two re-shot frames are -56.
    expect(rgb[0] - rgb[2]).toBeLessThan(-40);
  });

  // A tone that clips is not a tone, it is a flat disc. The previous attempt at
  // these parameters put brightness() AFTER sepia(), which pushed the whole
  // upper half of the range past 1.0 and clamped it: mean and highlight came out
  // at the same value and the image was gone.
  it('keeps the art’s tonal range instead of crushing it flat', () => {
    const t = tone();
    const pts = [CLAY_BRIGHT, CLAY_MEAN, CLAY_MID, CLAY_DARK].map((p) => t(p));
    for (const p of pts) expect(p.clipped, 'the tone clips a channel').toBe(false);
    const Ls = pts.map((p) => lum255(p.rgb));
    // Strictly ordered bright → dark, with a real spread left in it.
    expect(Ls[0]).toBeGreaterThan(Ls[1]);
    expect(Ls[1]).toBeGreaterThan(Ls[2]);
    expect(Ls[2]).toBeGreaterThan(Ls[3]);
    expect(Ls[0] - Ls[3]).toBeGreaterThan(0.08);
  });
});

describe('the tone reaches the pixels', () => {
  const show = () => {
    vi.useFakeTimers();
    const { container } = render(<OnboardingScreen />);
    runClock(SETTLE);
    return container;
  };

  it('every clay disc on the build show carries it', () => {
    const container = show();
    const clay = [...container.querySelectorAll('img')]
      .filter((n) => !/stack-(real|done)/.test(n.getAttribute('src') || ''));
    expect(clay.length).toBeGreaterThanOrEqual(6);      // the six show cards
    for (const n of clay) expect(n.style.filter, n.getAttribute('src')).toBe('var(--art-tone)');
  });

  // These two were shot FROM the app in Indigo. They are already in register, so
  // toning them would tone them twice — a navy screenshot pushed through a navy
  // duotone. This is the assertion that stops the fix spreading.
  it('the two frames shot in Indigo are left alone', () => {
    const container = show();
    const shots = [...container.querySelectorAll('img')]
      .filter((n) => /stack-(real|done)/.test(n.getAttribute('src') || ''));
    expect(shots.length).toBe(2);
    for (const n of shots) expect(n.style.filter, n.getAttribute('src')).toBe('');
  });
});

// The six clay webps are shown on THREE surfaces, not one, and the first two a
// customer meets are not the build show at all: the first-run poster lands all
// six as a drifting halo around the wordmark, and on a desktop window three of
// them sit in the room beside the phone. Toning only the show would have left
// warm cream art on the literal first screen and called the defect closed —
// which is the shape of the half-fix this whole pass is finishing.
describe('the same clay art, on the other two surfaces that show it', () => {
  // Named, not pattern-matched: public/assets/onboarding also holds the two
  // Indigo-shot frames (which must NOT be toned), the unused stack-hero, and
  // qr-app.svg — a QR code, which a duotone would make unscannable.
  const CLAY = /assets\/onboarding\/(meditation|stretch|affirmation|prayer|diet|course)\.webp/;
  const clayOf = (container) => [...container.querySelectorAll('img')]
    .filter((n) => CLAY.test(n.getAttribute('src') || ''));

  it('the first-run poster montage carries the tone', () => {
    // FirstRunChoice renders only before the choice is made, which is precisely
    // when it is the first thing on screen.
    setState({ firstRunChoice: false, onboarded: false, soft: 'indigo' });
    const { container } = render(<FirstRunChoice />);
    const clay = clayOf(container);
    expect(clay.length, 'the six montage images').toBe(6);
    for (const n of clay) expect(n.style.filter, n.getAttribute('src')).toBe('var(--art-tone)');
  });

  it('the desktop room beside the phone carries it', async () => {
    // useDesktop() is gated on matchMedia, which jsdom answers "no" to, so every
    // other test in the repo renders the mobile tree. This is the one place the
    // desktop tree has to be real.
    const real = window.matchMedia;
    window.matchMedia = (q) => ({
      matches: /min-width:\s*980px/.test(q), media: q,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    });
    try {
      setState({
        onboarded: true, firstRunChoice: true, termsOk: true, screen: 'stack',
        hintsOff: true, guide: { q: {}, welcomed: 1 }, hints: {},
        pendingShare: null, shareError: null, accountOpen: false, addOpen: false,
      });
      let container;
      await act(async () => { ({ container } = render(<App5 />)); });
      const clay = clayOf(container);
      expect(clay.length, 'the three images in the desktop room').toBe(3);
      for (const n of clay) expect(n.style.filter, n.getAttribute('src')).toBe('var(--art-tone)');
    } finally {
      window.matchMedia = real;
    }
  });
});
