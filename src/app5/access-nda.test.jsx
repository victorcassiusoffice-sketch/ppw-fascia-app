// THE NON-DISCLOSURE ON THE DOOR (2026-10-08) — and the throttle beside it.
//
// Vic is showing pre-release software to prospective business customers, so the
// door now asks for two things rather than one: the code, and an agreement to
// keep what is behind it confidential. Three claims rest on this file:
//
//   1. NOBODY GETS IN WITHOUT AGREEING. Not "there was a link they could have
//      read" — the button does not work until the box is ticked, and the guard is
//      in the handler too, so the Enter key cannot walk around it.
//   2. WHAT WAS AGREED IS WRITTEN DOWN, AND CANNOT DRIFT. The record carries the
//      wording's VERSION, so when the wording changes the device is asked again
//      instead of being credited with agreeing to words it never saw.
//   3. THE KEYPAD IS NOT FREE TO WALK. The code is four digits — ten thousand
//      guesses — so a run of wrong ones costs a growing wait. This is not
//      security (anyone can edit the JS); it stops a bored person and a trivial
//      front-end script, and nothing more.
//
// Every code in here is MINTED AT RUNTIME from the same alphabet the real minter
// uses. No code anyone has been issued is read, named or referenced by this file.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act, fireEvent, waitFor } from '@testing-library/react';

// The throwaway registry, set up exactly as access-gate.test.jsx does it: hoisted
// so vi.mock's factory can see it, and filled in beforeAll because the verifier
// reads `registry.codes` on every call. 1000 iterations, not 310000 — nothing
// here is protecting anything.
const { REGISTRY } = vi.hoisted(() => ({
  REGISTRY: { version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000 }, codes: [] },
}));
vi.mock('./access-codes.json', () => ({ default: REGISTRY }));

import {
  grantAccess, hasAccess,
  attemptWaitMs, recordWrongCode, clearWrongCodes, _resetAttemptsForTest,
} from './access.js';
import {
  NDA_VERSION, NDA_TITLE, NDA_INTRO, NDA_POINTS, NDA_TICK_LABEL,
  ndaAccepted, readNdaAcceptance, acceptNda, clearNdaAcceptance,
} from './nda.js';
import AccessGate from './screens/AccessGate.jsx';

const LS_NDA = 'ppw5.nda';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // no 0 O 1 I L, as minted

function mintThrowaway() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const body = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return 'PPW-' + body.slice(0, 5) + '-' + body.slice(5);
}

const b64 = (buf) => {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Exactly what tools/mint-access-code.mjs writes into the registry. */
async function hashLikeTheMinter(code, saltB64, iterations) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(code.trim().toUpperCase()), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' }, key, 256,
  );
  return b64(bits);
}

let LIVE = '';
let STRANGER = '';

beforeAll(async () => {
  LIVE = mintThrowaway();
  do { STRANGER = mintThrowaway(); } while (STRANGER === LIVE);
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  REGISTRY.codes = [
    { id: 'cLive01', label: 'A gym - pilot', salt, hash: await hashLikeTheMinter(LIVE, salt, 1000), issued: '2026-10-08', revoked: false },
  ];
});

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  // The throttle keeps an in-memory mirror on purpose, so clearing storage is NOT
  // enough to reset it between tests — that is the whole point of the mirror.
  _resetAttemptsForTest();
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  window.history.replaceState({}, '', '/');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// ── the door's controls ──────────────────────────────────────────────────────
const field = () => screen.getByLabelText(/access code/i);
const queryField = () => screen.queryByLabelText(/access code/i);
const type = (v) => fireEvent.change(field(), { target: { value: v } });
const theTick = () => screen.getByRole('checkbox', { name: new RegExp(NDA_TICK_LABEL, 'i') });
const tick = () => fireEvent.click(theTick());
const goBtn = () => screen.getByRole('button', { name: /open the app|continue/i });
const checking = () => screen.queryByText(/checking the code/i);

/** Tap and wait for a real PBKDF2 derivation to finish, not just for act() to flush. */
async function tapAndSettle() {
  await act(async () => { fireEvent.click(goBtn()); });
  await waitFor(() => expect(checking()).toBeNull());
}

// ── 1. agreeing is not optional ─────────────────────────────────────────────
describe('the confidentiality agreement on the door', () => {
  it('says what it is asking, in its own words, before anything is typed', () => {
    render(<AccessGate />);
    expect(screen.getByText(NDA_TITLE)).toBeTruthy();
    // The real wording, not a link to it and not a placeholder.
    for (const point of NDA_POINTS) expect(screen.getByText(point.p)).toBeTruthy();
    expect(theTick().getAttribute('aria-checked')).toBe('false');
  });

  it('will not open the app until the box is ticked', async () => {
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    render(<AccessGate />);
    type(LIVE);

    // Disabled in the markup...
    expect(goBtn().disabled).toBe(true);
    await tapAndSettle();
    expect(queryField()).toBeTruthy();

    // ...and guarded in the handler, because the Enter key does not care that a
    // button is disabled. Same lesson as the double-tap guard.
    await act(async () => { fireEvent.submit(field().closest('form')); });
    expect(queryField()).toBeTruthy();
    expect(hasAccess()).toBe(false);
    expect(ndaAccepted()).toBe(false);
    // The right code was in the field the whole time and was never even hashed.
    expect(derive).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/tick|agree/i);
  });

  it('opens the app on the right code once the box is ticked', async () => {
    render(<AccessGate />);
    tick();
    expect(theTick().getAttribute('aria-checked')).toBe('true');
    type(LIVE);
    expect(goBtn().disabled).toBe(false);
    await tapAndSettle();

    expect(queryField()).toBeNull();
    expect(hasAccess()).toBe(true);
    expect(ndaAccepted()).toBe(true);
  });

  it('does not record an agreement when the code is refused', async () => {
    render(<AccessGate />);
    tick();
    type(STRANGER);
    await tapAndSettle();
    expect(hasAccess()).toBe(false);
    expect(readNdaAcceptance()).toBeNull();
  });
});

// ── 2. the record of what was agreed ────────────────────────────────────────
describe('the record on the device', () => {
  it('carries the wording version, the date, and the code that was used', async () => {
    render(<AccessGate />);
    tick();
    type(LIVE);
    await tapAndSettle();

    const rec = readNdaAcceptance();
    expect(rec.version).toBe(NDA_VERSION);
    expect(rec.codeId).toBe('cLive01');
    expect(Number.isFinite(Date.parse(rec.at))).toBe(true);
    // Within a minute of now — it is the moment of agreement, not a default.
    expect(Math.abs(Date.now() - Date.parse(rec.at))).toBeLessThan(60000);
  });

  it('writes down the code ID and never the code itself', async () => {
    render(<AccessGate />);
    tick();
    type(LIVE);
    await tapAndSettle();

    const stored = localStorage.getItem(LS_NDA);
    expect(stored).toContain('cLive01');
    expect(stored).not.toContain(LIVE);
    expect(stored).not.toContain(LIVE.replace(/-/g, ''));
  });
});

// ── 3. the wording cannot drift from what was agreed ────────────────────────
describe('when the wording changes', () => {
  /** A device that got in, and agreed to wording that has since been replaced. */
  const deviceAgreedToOldWording = () => {
    grantAccess('cLive01');
    localStorage.setItem(LS_NDA, JSON.stringify({
      v: 1, version: 'some-earlier-wording', at: '2026-10-01T09:00:00.000Z', codeId: 'cLive01',
    }));
  };

  it('is not asked again by a device that agreed to the wording on file', () => {
    grantAccess('cLive01');
    acceptNda('cLive01');
    render(<AccessGate />);
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(queryField()).toBeNull();
  });

  it('asks a device that only ever agreed to the old wording', () => {
    deviceAgreedToOldWording();
    expect(hasAccess()).toBe(true);        // the licence is untouched
    expect(ndaAccepted()).toBe(false);     // the agreement is not
    render(<AccessGate />);
    expect(theTick()).toBeTruthy();
    expect(screen.getByText(NDA_TITLE)).toBeTruthy();
  });

  // The licence has not changed, only the words — so do not send a gym owner
  // hunting for a code they already used. The code field is not even shown.
  it('asks for the agreement again but not for the code again', async () => {
    deviceAgreedToOldWording();
    render(<AccessGate />);
    expect(queryField()).toBeNull();

    expect(goBtn().disabled).toBe(true);
    tick();
    await act(async () => { fireEvent.click(goBtn()); });

    expect(screen.queryByRole('checkbox')).toBeNull();      // through the door
    const rec = readNdaAcceptance();
    expect(rec.version).toBe(NDA_VERSION);                  // the new wording
    expect(rec.codeId).toBe('cLive01');                     // the licence it holds
  });

  it('holds the door shut for a device with no licence at all, old agreement or not', () => {
    localStorage.setItem(LS_NDA, JSON.stringify({ v: 1, version: NDA_VERSION, at: new Date().toISOString(), codeId: 'cLive01' }));
    render(<AccessGate />);
    expect(queryField()).toBeTruthy();     // agreeing is not a licence
  });
});

// ── 4. the throttle ─────────────────────────────────────────────────────────
// Four digits is ten thousand guesses. This does not make the door strong — it
// makes walking it by hand or with a one-line script not worth the afternoon.
describe('a run of wrong codes', () => {
  it('costs nothing for the first few, then starts costing time', () => {
    expect(attemptWaitMs()).toBe(0);
    for (let i = 0; i < 4; i++) {
      recordWrongCode();
      expect(attemptWaitMs()).toBe(0);
    }
    recordWrongCode();
    expect(attemptWaitMs()).toBeGreaterThan(0);
  });

  it('makes each further wrong code cost longer than the last', () => {
    for (let i = 0; i < 5; i++) recordWrongCode();
    const first = attemptWaitMs();
    recordWrongCode();
    const second = attemptWaitMs();
    recordWrongCode();
    const third = attemptWaitMs();
    expect(second).toBeGreaterThan(first);
    expect(third).toBeGreaterThan(second);
  });

  it('is not reset by clearing the browser, within the same page life', () => {
    for (let i = 0; i < 5; i++) recordWrongCode();
    const held = attemptWaitMs();
    expect(held).toBeGreaterThan(0);
    localStorage.clear();                       // "clear site data" mid-attack
    expect(attemptWaitMs()).toBeGreaterThan(0);
    expect(attemptWaitMs()).toBeLessThanOrEqual(held);
  });

  it('is not reset by a reload either — it is on disk as well as in memory', () => {
    for (let i = 0; i < 5; i++) recordWrongCode();
    expect(attemptWaitMs()).toBeGreaterThan(0);
    _resetAttemptsForTest({ keepStorage: true });   // a fresh page life, same device
    expect(attemptWaitMs()).toBeGreaterThan(0);
  });

  it('clears the moment a code is accepted', () => {
    for (let i = 0; i < 5; i++) recordWrongCode();
    expect(attemptWaitMs()).toBeGreaterThan(0);
    clearWrongCodes();
    expect(attemptWaitMs()).toBe(0);
  });

  // A wrong clock must not be able to lock someone out of their own app for a
  // week. The wait is capped at the longest step, however far away `until` is.
  it('never holds the door for longer than the longest step', () => {
    for (let i = 0; i < 20; i++) recordWrongCode();
    expect(attemptWaitMs()).toBeLessThanOrEqual(5 * 60 * 1000);
  });
});

describe('the throttle at the door', () => {
  it('stops hashing guesses once the wait has started, and says how long', async () => {
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    render(<AccessGate />);
    tick();

    for (let i = 0; i < 5; i++) {
      type(STRANGER + i);
      await tapAndSettle();
    }
    expect(derive).toHaveBeenCalledTimes(5);
    expect(hasAccess()).toBe(false);

    // The door is now holding. The message says so rather than claiming the code
    // was wrong, and the button cannot be tapped.
    expect(goBtn().disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toMatch(/wait|too many/i);

    // Submitted anyway, the way the Enter key would.
    await act(async () => { fireEvent.submit(field().closest('form')); });
    expect(derive).toHaveBeenCalledTimes(5);        // not one more guess hashed
  });

  // The whole point of a WAIT rather than a lockout: it ends, and the person who
  // mistyped their code four times gets in on the fifth.
  it('lets the right code in once the wait is over', async () => {
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    render(<AccessGate />);
    tick();

    for (let i = 0; i < 5; i++) {
      type(STRANGER + i);
      await tapAndSettle();
    }
    expect(goBtn().disabled).toBe(true);

    // The clock moves, rather than the test sleeping. Beyond the longest step, so
    // this holds whatever the first step is set to.
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => realNow + 6 * 60 * 1000);

    type(LIVE);                                      // re-renders, so the wait is re-read
    expect(goBtn().disabled).toBe(false);
    await tapAndSettle();

    expect(queryField()).toBeNull();
    expect(hasAccess()).toBe(true);
    expect(derive).toHaveBeenCalledTimes(6);
  });

  it('forgets the run of wrong codes once one is accepted', async () => {
    render(<AccessGate />);
    tick();
    for (let i = 0; i < 3; i++) {
      type(STRANGER + i);
      await tapAndSettle();
    }
    type(LIVE);
    await tapAndSettle();
    expect(hasAccess()).toBe(true);
    expect(attemptWaitMs()).toBe(0);
  });
});

// ── 5. housekeeping ─────────────────────────────────────────────────────────
describe('the agreement record', () => {
  it('is nothing at all on a device that has never seen the door', () => {
    expect(readNdaAcceptance()).toBeNull();
    expect(ndaAccepted()).toBe(false);
  });

  it('can be given back', () => {
    acceptNda('cLive01');
    expect(ndaAccepted()).toBe(true);
    clearNdaAcceptance();
    expect(ndaAccepted()).toBe(false);
  });

  it('survives a half-written key rather than throwing', () => {
    localStorage.setItem(LS_NDA, '{not json');
    expect(readNdaAcceptance()).toBeNull();
    expect(ndaAccepted()).toBe(false);
  });

  it('declares a version that is a real, non-empty string', () => {
    expect(typeof NDA_VERSION).toBe('string');
    expect(NDA_VERSION.length).toBeGreaterThan(0);
  });
});

// ── 6. the wording must not forbid the licence ───────────────────────────────
// THE BUG THIS BLOCK EXISTS TO STOP COMING BACK. The first draft of this
// agreement asked the visitor to keep the access code "inside your own
// organisation" and to email first before anyone outside it saw the app. Read
// literally by the person it is aimed at — a gym owner — that forbids the single
// journey this product is built around.
//
// It is not a hypothetical. access-gate.test.jsx's last block walks it: a
// practitioner sends a client a `#r=` routine link, the client lands with no code,
// and the door asks them for one. So routine sharing REQUIRES handing the code to
// someone who is a customer of the business, not a colleague inside it. Vic's
// instruction on 2026-10-08 was "all access available including sharing routines";
// the gate's own copy says the app is licensed to businesses "who hand it to their
// own people". An agreement that quietly bans that is worse than no agreement: it
// makes the honest reader stop doing the thing they are paying for.
//
// So the confidentiality ask is scoped to the OUTSIDE WORLD — don't publish it,
// don't hand it to another business — and the people a licensee serves are named
// as welcome. These tests hold that distinction in place.
describe('what the agreement asks of a business', () => {
  const allWording = () => NDA_POINTS.map((p) => `${p.h} ${p.p}`).join(' ');

  it('tells them their own clients are exactly who the app is for', () => {
    const text = allWording();
    // The people a gym, clinic or studio actually serves, named rather than
    // left to be inferred from "your organisation".
    expect(text).toMatch(/clients|members|patients/i);
    // And named as a PERMISSION, not as a restriction with an exception.
    expect(text).toMatch(/never need to ask|do not need to ask|you never have to ask/i);
  });

  it('says in so many words that sending them routines is allowed', () => {
    // The flagship journey. If the agreement does not mention it, the reader is
    // left guessing about the one feature Vic said must be open.
    expect(allWording()).toMatch(/routine/i);
  });

  it('scopes the confidentiality ask to the world outside the business', () => {
    const text = allWording();
    expect(text).toMatch(/publicly|in public|open internet|social media/i);
    expect(text).toMatch(/another business|other businesses|press|competitor/i);
  });

  it('never tells them to keep the access code from their own people', () => {
    // The exact regression: a sentence confining the CODE to the organisation.
    // Checked as a phrase because that phrase is what broke it, and a future
    // rewrite that reaches for it again should fail here rather than ship.
    expect(allWording()).not.toMatch(/code[^.]*inside your own organisation/i);
  });

  // The intro counts the points in words ("agree to five things"). A sixth point
  // added without touching that sentence makes the door miscount itself on the
  // one screen that is asking to be trusted. Cheap to assert, easy to miss.
  it('counts its own points correctly in the intro sentence', () => {
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    expect(NDA_INTRO).toContain(words[NDA_POINTS.length]);
  });

  it('puts all of that in front of the visitor on the door itself', () => {
    render(<AccessGate />);
    // Not a link, not a summary — the permission is on screen beside the tick.
    const permission = NDA_POINTS.find((p) => /routine/i.test(p.p));
    expect(permission).toBeTruthy();
    expect(screen.getByText(permission.p)).toBeTruthy();
  });
});
