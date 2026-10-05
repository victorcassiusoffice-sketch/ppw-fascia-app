// The pitch nobody ever saw (2026-10-05).
//
// The first screen of this app is a six-card show that builds a Stack in front
// of a brand-new visitor — 6 landings at 420ms plus a 450ms settle, 2.97s end to
// end. Its interval started at MOUNT, and its guard checked `onboarded`, `obStep`
// and `assembled` but never `firstRunChoice`. FirstRunChoice renders at z-41 over
// this screen's z-40 until the visitor picks one of its three doors, so the show
// played out, in full, behind a screen covering it, and was already over by the
// time anyone could have seen a frame of it. The repo's own shoot script had
// written the symptom down as if it were the design: "the show has been running
// behind the first-run choice since mount".
//
// These tests pin the fix on the only thing that matters — whether the cards are
// still arriving when the visitor is actually looking — and then pin the budget,
// because the second half of this work item puts real screenshots on that screen
// and the whole onboarding image set has to stay small enough to load on mobile
// data before anyone has decided they want the app.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act } from '@testing-library/react';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { setState } from './store5.js';
import OnboardingScreen from './screens/OnboardingScreen.jsx';

const DIR = 'public/assets/onboarding';
const SETTLE = 6 * 420 + 450 + 60;   // six landings, the settle, and a little slack

beforeEach(() => {
  localStorage.clear();
  // The info carousel scrolls its row into place the moment the show finishes,
  // and jsdom has no scrollTo — without this the assembled state throws.
  Element.prototype.scrollTo = () => {};
  window.scrollTo = () => {};
  setState({ onboarded: false, obStep: 0, termsOk: false, signedIn: false, firstRunChoice: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/**
 * Run the clock far enough that a show which is running has certainly finished.
 *
 * TWO passes, deliberately. React flushes effects at the END of an act() block,
 * so inside a single synchronous advance the six landings are queued but never
 * committed — which means the effect that schedules the 450ms settle has not run
 * yet and the settle timer does not exist to be advanced. One pass lands the
 * cards; the second reaches the settle and the payoff.
 */
function runClock(ms = SETTLE) {
  act(() => { vi.advanceTimersByTime(ms); });
  act(() => { vi.advanceTimersByTime(600); });
}

/** Count matches without getBy's "found multiple elements" throw — the swap line
 *  above the stack names each card as it lands, so a title can legitimately be
 *  on screen twice mid-show. */
const seen = (re) => screen.queryAllByText(re).length;

describe('the build show waits for the visitor', () => {
  it('does not advance a single card while the first-run choice is still up', () => {
    vi.useFakeTimers();
    setState({ firstRunChoice: false });
    render(<OnboardingScreen />);
    runClock(SETTLE * 2);
    // Twice the full duration has passed. If the guard is wrong the show is not
    // merely mid-flight by now, it is over and the payoff line is on screen.
    expect(seen('Anxiety meditation')).toBe(0);
    expect(seen('Online course')).toBe(0);
    expect(seen(/Your turn/i)).toBe(0);
  });

  it('starts once the first-run choice is dismissed, and lands all six cards', () => {
    vi.useFakeTimers();
    setState({ firstRunChoice: false });
    render(<OnboardingScreen />);
    runClock(SETTLE);
    expect(seen('Anxiety meditation')).toBe(0);

    act(() => { setState({ firstRunChoice: true }); });
    runClock(SETTLE);

    // Vic's own six, in time order — first and last prove the whole run.
    expect(seen('Anxiety meditation')).toBeGreaterThan(0);
    expect(seen('Online course')).toBeGreaterThan(0);
    expect(seen(/Your turn/i)).toBeGreaterThan(0);
  });

  it('resolves to the payoff after the settle, not just to six cards', () => {
    vi.useFakeTimers();
    setState({ firstRunChoice: true });
    render(<OnboardingScreen />);
    runClock(SETTLE);
    expect(screen.getByText(/Your Ideal Lifestyle\./)).toBeTruthy();
    expect(screen.getByText(/And this is yours, by tonight\./i)).toBeTruthy();
  });
});

describe('the pitch illustrates itself with the app', () => {
  // The caption says "This is a Stack." and the picture beside it used to be an
  // abstract clay render. Both intro images are now shot from the running app by
  // tools/shoot-intro-assets.mjs, so this asserts the retired one is gone from
  // what actually renders — not from the source, where it is still named in a
  // comment explaining why it was left on disk rather than deleted.
  it('renders the app screenshots and no longer the clay stack-hero', () => {
    vi.useFakeTimers();
    setState({ firstRunChoice: true });
    const { container } = render(<OnboardingScreen />);
    runClock(SETTLE);

    const srcs = [...container.querySelectorAll('img')].map((n) => n.getAttribute('src'));
    expect(srcs.some((s) => s.endsWith('/stack-real.webp'))).toBe(true);
    expect(srcs.some((s) => s.endsWith('/stack-done.webp'))).toBe(true);
    expect(srcs.some((s) => s.includes('stack-hero'))).toBe(false);
  });

  it('every image the screen asks for is a real file on disk', () => {
    vi.useFakeTimers();
    setState({ firstRunChoice: true });
    const { container } = render(<OnboardingScreen />);
    runClock(SETTLE);

    const srcs = [...new Set([...container.querySelectorAll('img')].map((n) => n.getAttribute('src')))];
    // Six show cards + the stack chip + the payoff: a missing one is a broken
    // image on the first screen a paying customer ever sees.
    expect(srcs.length).toBeGreaterThanOrEqual(8);
    for (const src of srcs) {
      expect(src.startsWith('/assets/onboarding/')).toBe(true);
      expect(existsSync('public' + src)).toBe(true);
    }
  });
});

describe('the onboarding art has a budget', () => {
  // Modelled on the 64 KB wordmark guard. The point is not tidiness: this set
  // loads before the visitor has decided they want the app, quite possibly on
  // mobile data, and the images that were offered for this job were 90-116 KB
  // JPEGs each. A ceiling is what stops one of those being dropped in quietly.
  it('the whole directory stays under 80 KB', () => {
    const total = readdirSync(DIR).reduce((n, f) => n + statSync(`${DIR}/${f}`).size, 0);
    expect(total).toBeLessThan(80 * 1024);
  });

  it('no single onboarding image is over 36 KB', () => {
    for (const f of readdirSync(DIR)) {
      expect(statSync(`${DIR}/${f}`).size).toBeLessThan(36 * 1024);
    }
  });
});
