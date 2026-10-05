// THE DEMO EMBED (2026-10-05) — the app in an iframe on ppwellness.co.
//
// Vic: "I want to embed the Lifestyle app as a demo on my site ppwellness.co."
// The app is licensed to businesses now and the way in is a partner code, so
// without a second door the marketing page would frame a code prompt, which is
// not a demo. `?demo=1` is that door.
//
// FOUR CLAIMS REST ON THIS FILE, and all four are about what the demo must NOT
// do, because that is where a demo door goes wrong:
//
//   1. It opens the app with no code.
//   2. It grants NOTHING lasting — no `ppw5.access`, nothing else on disk.
//   3. A normal load in the same browser afterwards still meets the gate.
//   4. It never touches a real user's data. Not their stacks, not their flags,
//      not their theme — and it does not READ them either, so the embed cannot
//      show one person's own day back to them inside a web page.
//
// HOW THIS FILE IS ARRANGED, and why. The store's localStorage pass runs ONCE,
// at module evaluation, so a demo boot can only be observed under a URL that was
// already set when the module was imported. Two mechanisms, deliberately:
//
//   · vi.hoisted below sets `?demo=1` ahead of the hoisted imports, so the
//     statically imported store5 and App5 in this file ARE the embed. Those
//     tests render the real screens against the real demo boot, end to end.
//   · bootStore() clears the module registry and re-imports under a URL of its
//     choosing, which is the only way to compare a demo boot against a plain one
//     in the same file. Components are never dynamically imported — a second
//     React would not share the statically imported render().
//
// No access code appears anywhere in this file, in any form.

// Before the imports, which are hoisted above everything else in the file. This
// is the embed's own URL; initialState() reads it on the import that follows.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.hoisted(() => {
  try { window.history.replaceState({}, '', '/?demo=1'); } catch { /* no jsdom history */ }
});

import { render, cleanup, screen, act } from '@testing-library/react';

// Reports an install prompt as available so InstallBanner has something to
// offer. Without this the banner stays quiet in jsdom for an unrelated reason
// (no beforeinstallprompt event) and a test could not tell the demo guard from
// that silence.
vi.mock('../lib/installPrompt.js', () => ({
  isStandalone: () => false,
  isIOS: () => false,
  canPromptInstall: () => true,
  promptInstall: async () => true,
  subscribeInstall: () => () => {},
}));

import { isDemo, DEMO_PARAM } from './demo.js';
import { hasAccess } from './access.js';
import App5 from './App5.jsx';
import AccessGate from './screens/AccessGate.jsx';
import { InstallBanner } from './screens/InstallAppCard.jsx';
import { getState, setState } from './store5.js';

const LS = (k) => 'ppw5.' + k;
const at = (url) => window.history.replaceState({}, '', url);

/**
 * A store booted the way a page load boots it — module registry cleared, so
 * initialState() genuinely runs under `url` rather than under this file's.
 */
async function bootStore(url) {
  at(url);
  vi.resetModules();
  return await import('./store5.js');
}

/** A day someone has actually built, as it sits on disk. */
function aRealUsersDeviceOnDisk() {
  localStorage.setItem(LS('stacks'), JSON.stringify({
    d: [
      { id: 'u1', time: '06:00', title: 'My own 6am swim', meta: 'Pool', repeat: 'daily' },
      { id: 'u2', time: '19:30', title: 'Physio homework', meta: 'From my clinic', repeat: 'daily' },
    ],
    db: { '2026-10-04': ['u1'] }, ss: {}, ip: [],
  }));
  localStorage.setItem(LS('routines'), JSON.stringify([{ id: 'rtMine', name: 'My week', items: [] }]));
  localStorage.setItem(LS('onboarded'), '1');
  localStorage.setItem(LS('frc'), '1');
  localStorage.setItem(LS('terms'), '1');
  localStorage.setItem(LS('soft'), 'gloft');     // a colourway they chose
  localStorage.setItem(LS('hintsOff'), '0');
}

/** Everything in `ppw5.*`, so "nothing changed" can be one comparison. */
function diskSnapshot() {
  const out = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('ppw5.')) out[k] = localStorage.getItem(k);
  }
  return out;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  at('/?demo=1');
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  // App5's boot pass talks to the membership API on a NON-demo load, which is
  // one of the things being asserted below. Stubbed so the assertion is about
  // whether a call was made, not about the network.
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ premium: false, entitlement: 'none' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// ── 1. reading the URL ──────────────────────────────────────────────────────
describe('what counts as a demo load', () => {
  it('is a demo on the parameter the embed carries', () => {
    at('/?demo=1');
    expect(isDemo()).toBe(true);
  });

  it('is a demo on the bare parameter, for a web builder who drops the =1', () => {
    at('/?demo');
    expect(isDemo()).toBe(true);
    at('/?demo=true');
    expect(isDemo()).toBe(true);
  });

  it('is not a demo on an ordinary load', () => {
    at('/');
    expect(isDemo()).toBe(false);
    at('/?utm_source=newsletter');
    expect(isDemo()).toBe(false);
  });

  // So the embed can be switched off by editing one character of the snippet.
  it('is not a demo when the parameter says no', () => {
    at('/?demo=0');
    expect(isDemo()).toBe(false);
    at('/?demo=false');
    expect(isDemo()).toBe(false);
  });

  // Read live, never remembered: that is the whole of "this load only".
  it('stops being a demo the moment the parameter goes', () => {
    at('/?demo=1');
    expect(isDemo()).toBe(true);
    at('/');
    expect(isDemo()).toBe(false);
  });

  it('names the parameter the iframe snippet has to use', () => {
    expect(DEMO_PARAM).toBe('demo');
  });
});

// ── 2. the store a prospect lands in ────────────────────────────────────────
describe('booting as a demo', () => {
  it('has every first-run question already answered', async () => {
    const s = await bootStore('/?demo=1');
    const S = s.getState();
    // The wizard, the create-or-sign-in choice and the consent tick-box all key
    // off these three. A demo of an app is not a demo of its sign-up.
    expect(S.onboarded).toBe(true);
    expect(S.firstRunChoice).toBe(true);
    expect(S.termsOk).toBe(true);
    // And the two-step coach-mark welcome, which would otherwise dim the whole
    // frame 700ms after the page settles.
    expect(S.guide.welcomed).toBeTruthy();
  });

  it('opens on a day with something in it', async () => {
    // Seeded, so this cannot pass merely because the browser was empty: without
    // the demo branch the deck here would be the two stacks below, neither of
    // which is an example.
    aRealUsersDeviceOnDisk();
    const s = await bootStore('/?demo=1');
    const S = s.getState();
    expect(S.deckItems.length).toBeGreaterThan(0);
    // The app's own starter slots, not invented demo content — and every one of
    // them still marked as an example, which is what the cards say on screen.
    expect(S.deckItems.every((it) => it.example)).toBe(true);
    expect(S.mediaItems.length).toBeGreaterThan(0);
  });

  // Library opens on the routines tab, the one screen that would otherwise be
  // empty. The bundle is made of the starter deck's own stacks.
  it('has a routine to show, built from those same stacks', async () => {
    const s = await bootStore('/?demo=1');
    const [r, ...rest] = s.getState().routines;
    expect(rest).toEqual([]);
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.name).toMatch(/example/i);
    const starters = new Set(s.getState().deckItems.map((it) => it.id));
    expect(r.items.every((it) => starters.has(it.id))).toBe(true);
  });

  it('shows the whole product, and claims no membership', async () => {
    // A real subscriber's verified purchase, sitting on this device. The demo
    // must not wear it: `premiumPaid` is the server's verdict about a PERSON,
    // and it drives what the account screen says they are paying for.
    localStorage.setItem(LS('authToken'), 'jwt');
    localStorage.setItem(LS('authEmail'), 'buyer@example.com');
    localStorage.setItem(LS('ent'), JSON.stringify({
      premium: true, entitlement: 'paid', currentPeriodEnd: null,
      userId: 'usr_1', checkedAt: Date.now(), verified: true,
    }));
    const s = await bootStore('/?demo=1');
    expect(s.getState().premium).toBe(true);        // PREMIUM_OPEN is on
    expect(s.getState().premiumPaid).toBe(false);   // nobody bought anything
  });

  it('is not signed in as whoever owns this browser', async () => {
    localStorage.setItem(LS('authToken'), 'a-real-persons-session');
    localStorage.setItem(LS('authEmail'), 'someone@example.com');
    const s = await bootStore('/?demo=1');
    expect(s.getState().signedIn).toBe(false);
  });

  // THE READ SIDE of claim 4. An embed that hydrated from the visitor's own
  // browser would show one person their own day inside a marketing page.
  it('shows the sample day, never the day already on this device', async () => {
    aRealUsersDeviceOnDisk();
    const s = await bootStore('/?demo=1');
    const S = s.getState();
    expect(S.deckItems.map((it) => it.title)).not.toContain('My own 6am swim');
    expect(S.deckItems.map((it) => it.title)).not.toContain('Physio homework');
    expect(S.routines.map((r) => r.name)).not.toContain('My week');
    expect(S.soft).toBe('indigo');                  // the default, not their 'gloft'
    expect(S.doneByDate).toEqual({});
  });

  // The control. Without it, the test above could pass simply because nothing
  // on disk is ever read, which would be a different bug entirely.
  it('reads that same device normally when the parameter is absent', async () => {
    aRealUsersDeviceOnDisk();
    const s = await bootStore('/');
    const S = s.getState();
    expect(S.deckItems.map((it) => it.title)).toContain('My own 6am swim');
    expect(S.routines.map((r) => r.name)).toContain('My week');
    expect(S.soft).toBe('gloft');
  });
});

// ── 3. the demo leaves no trace ─────────────────────────────────────────────
describe('what the demo writes to the device', () => {
  // THE WRITE SIDE of claim 4, and claim 2. Every localStorage write in the
  // store goes through one pair of primitives, so this covers the lot.
  it('writes nothing at all, however hard it is driven', async () => {
    aRealUsersDeviceOnDisk();
    const before = diskSnapshot();
    const s = await bootStore('/?demo=1');

    // A prospect doing the things the app is for.
    s.save('onboarded', 1);
    s.save('soft', 'graphite');
    s.saveRoutines([{ id: 'rtDemo2', name: 'Something a visitor made', items: [] }]);
    s.clearExamples();                       // the stacks write, debounced 200ms
    s.setState({ doneByDate: { '2026-10-05': ['d1'] } });
    s.saveStacks();
    await new Promise((r) => setTimeout(r, 260));

    expect(diskSnapshot()).toEqual(before);
  });

  // The same control: these calls DO write on an ordinary load, so the test
  // above is about the demo and not about dead code.
  it('writes exactly those things on an ordinary load', async () => {
    const s = await bootStore('/');
    s.save('soft', 'graphite');
    s.saveRoutines([{ id: 'rtReal', name: 'Mine', items: [] }]);
    s.saveStacks();
    await new Promise((r) => setTimeout(r, 260));

    expect(localStorage.getItem(LS('soft'))).toBe('graphite');
    expect(localStorage.getItem(LS('routines'))).toContain('rtReal');
    expect(localStorage.getItem(LS('stacks'))).toBeTruthy();
  });

  it('never leaves an access grant behind', async () => {
    const s = await bootStore('/?demo=1');
    s.save('access', JSON.stringify({ v: 1, id: 'nope' }));   // even if asked to
    expect(localStorage.getItem('ppw5.access')).toBeNull();
    expect(hasAccess()).toBe(false);
  });
});

// ── 4. the frame a prospect actually sees ───────────────────────────────────
// These render the REAL screens against the store this file booted as a demo
// (see the header): URL → store → screen, end to end.
describe('the embed on screen', () => {
  const codeField = () => screen.queryByLabelText(/access code/i);

  beforeEach(() => {
    // Only the transient layers — a sheet left open by an earlier test would
    // cover the thing being asserted. The first-run flags are deliberately NOT
    // set here: they come from this file's own demo boot, which is the chain
    // under test.
    setState({
      screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
      addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false,
      completedOpen: false, playerItem: null, scheduleTarget: null, repeatId: null,
      editId: null, premiumUpsell: null, selectedIds: [],
      pendingShare: null, shareError: null, shareHidden: false,
    });
  });

  it('opens the app with no code asked for', async () => {
    at('/?demo=1');
    await act(async () => { render(<App5 />); });
    expect(codeField()).toBeNull();
  });

  it('shows the app itself, not a wizard', async () => {
    at('/?demo=1');
    await act(async () => { render(<App5 />); });
    // The store this file booted answered the first-run questions, so none of
    // the three doors are mounted.
    expect(getState().onboarded).toBe(true);
    expect(screen.queryByText(/already have an account/i)).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /terms and health disclaimer/i })).toBeNull();
    // And the day is furnished: the starter affirmation is on screen.
    expect(screen.getByText(/I did enough today/i)).toBeTruthy();
  });

  it('says it is a demo, out loud and out of the way', async () => {
    at('/?demo=1');
    await act(async () => { render(<App5 />); });
    const marker = screen.getByRole('note');
    expect(marker.textContent).toBe('Demo');
    // A 9px pill is no use to a screen reader, so the full sentence is said in
    // the label — including the part that matters, that nothing is kept.
    expect(marker.getAttribute('aria-label')).toMatch(/nothing here is saved/i);
    // It can never eat a tap.
    expect(marker.style.pointerEvents).toBe('none');
  });

  it('carries no demo marker on an ordinary load', async () => {
    at('/');
    await act(async () => { render(<App5 />); });
    expect(screen.queryByRole('note')).toBeNull();
  });

  // Claim 3 — the one that makes the demo honest. Same browser, same stored
  // state, parameter gone.
  it('meets the gate again on the very next load without the parameter', async () => {
    at('/?demo=1');
    await act(async () => { render(<App5 />); });
    expect(codeField()).toBeNull();
    cleanup();

    at('/');                                   // a fresh page life, same device
    await act(async () => { render(<App5 />); });
    expect(codeField()).toBeTruthy();
    expect(hasAccess()).toBe(false);
  });

  it('puts no door on the frame at all while the parameter is there', () => {
    at('/?demo=1');
    render(<AccessGate />);
    expect(codeField()).toBeNull();
    at('/');
    cleanup();
    render(<AccessGate />);
    expect(codeField()).toBeTruthy();
  });

  // "Share → Add to Home Screen" from inside an iframe adds the PAGE, not the
  // app — and the dismissal is the last thing in the app that would write to a
  // prospect's device.
  it('does not invite a visitor to install a page they are only looking at', () => {
    at('/?demo=1');
    render(<InstallBanner />);
    expect(screen.queryByText(/get the app/i)).toBeNull();
    cleanup();

    at('/');
    render(<InstallBanner />);
    expect(screen.getByText(/get the app/i)).toBeTruthy();
  });

  // The sheet behind this button sends a real magic-link email. An iframe on a
  // marketing page must not be able to do that, and the account it would make
  // opens nothing anyway — the way into the app is a partner code.
  it('offers no sign-in from inside the frame', async () => {
    at('/?demo=1');
    await act(async () => { render(<App5 />); });
    expect(screen.queryByRole('button', { name: /^sign in$/i })).toBeNull();
    cleanup();

    at('/');
    await act(async () => { render(<App5 />); });
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeTruthy();
  });

  // The demo is a shop window on somebody else's web page. It has no business
  // renewing the session of whoever happens to own that browser.
  it('makes no request on the visitor\'s behalf', async () => {
    at('/?demo=1');
    localStorage.setItem(LS('authToken'), 'a-real-persons-session');
    await act(async () => { render(<App5 />); });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
