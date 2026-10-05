// THE ACCESS-CODE FRONT DOOR (2026-10-05) — the B2B pivot's one new gate.
//
// The app is licensed to businesses now, so the way in is a partner code rather
// than a card. Two claims rest on this file and both are load-bearing:
//
//   1. A CODE IS NEVER PUBLISHED. ppw-fascia-app is a PUBLIC GitHub repo, so the
//      committed registry may only ever carry PBKDF2 hashes. One test reads the
//      real `access-codes.json` off disk and fails if anything in it could be a
//      plaintext code.
//   2. THE SHARED PROGRAMME SURVIVES THE DOOR. A practitioner's client arrives on
//      a `#r=` link with no code yet. The fragment is read and STRIPPED on boot,
//      so if the gate let that drop, the programme would be gone and the URL
//      already clean — nothing left anywhere to recover it from. The last test
//      walks exactly that journey.
//
// Every code in here is MINTED AT RUNTIME from the same alphabet the real minter
// uses. Vic's own code is never read, named, or referenced by this file.
//
// The minter's `hashCode` is deliberately NOT imported: tools/mint-access-code.mjs
// is a script, not a library — importing it executes its top-level body, which
// mints a code and WRITES to the real registry and to ACCESS-CODES.md. The six
// lines of hashing are re-stated here instead, which also means a change to the
// KDF has to be made in the verifier AND admitted here.

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// ── the throwaway registry ───────────────────────────────────────────────────
// vi.hoisted, because vi.mock's factory is hoisted above the imports and would
// hit a TDZ on a plain const. The SAME object is mutated in beforeAll — the
// verifier reads `registry.codes` per call, so filling it later is enough.
//
// iterations: 1000, not 310000. Nothing here is protecting anything, and it
// doubles as proof that the verifier reads the count out of the registry instead
// of hardcoding it — a hardcoded 310000 cannot match a hash derived at 1000.
const { REGISTRY } = vi.hoisted(() => ({
  REGISTRY: { version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 1000 }, codes: [] },
}));
vi.mock('./access-codes.json', () => ({ default: REGISTRY }));

import { verifyCode, hasAccess, grantAccess, revokeLocalAccess } from './access.js';
import AccessGate from './screens/AccessGate.jsx';
import App5 from './App5.jsx';
import { setState, getState } from './store5.js';

const LS_ACCESS = 'ppw5.access';
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // no 0 O 1 I L, as minted

/** A fresh code in the real shape. Never a code anyone has been issued. */
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

let LIVE = '';     // an issued, working code
let DEAD = '';     // one that was revoked
let STRANGER = ''; // never issued at all

beforeAll(async () => {
  LIVE = mintThrowaway();
  DEAD = mintThrowaway();
  do { STRANGER = mintThrowaway(); } while (STRANGER === LIVE || STRANGER === DEAD);

  const saltA = b64(crypto.getRandomValues(new Uint8Array(16)));
  const saltB = b64(crypto.getRandomValues(new Uint8Array(16)));
  REGISTRY.codes = [
    { id: 'cLive01', label: 'A gym - pilot', salt: saltA, hash: await hashLikeTheMinter(LIVE, saltA, 1000), issued: '2026-10-05', revoked: false },
    { id: 'cDead01', label: 'A clinic - ended', salt: saltB, hash: await hashLikeTheMinter(DEAD, saltB, 1000), issued: '2026-10-05', revoked: true, revokedAt: '2026-10-05' },
  ];
});

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  REGISTRY.kdf.iterations = 1000;      // one test below changes it
  if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};
  if (!window.scrollTo) window.scrollTo = () => {};
  window.history.replaceState({}, '', '/');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// ── 1. the verifier ─────────────────────────────────────────────────────────
describe('checking a code', () => {
  it('lets an issued code in, and says which one it was', async () => {
    expect(await verifyCode(LIVE)).toBe('cLive01');
  });

  it('refuses a code nobody was ever given', async () => {
    expect(await verifyCode(STRANGER)).toBeNull();
  });

  it('refuses a code that was revoked', async () => {
    expect(await verifyCode(DEAD)).toBeNull();
  });

  // Somebody will read a code down a phone. "P P W, A 2 3 4 5..." arrives with no
  // dashes, or with the wrong punctuation, or in lower case.
  it('accepts it typed without the dashes', async () => {
    expect(await verifyCode(LIVE.replace(/-/g, ''))).toBe('cLive01');
  });

  it('accepts it in lower case, with stray spaces', async () => {
    expect(await verifyCode('  ' + LIVE.toLowerCase().replace(/-/g, ' ') + ' ')).toBe('cLive01');
  });

  it('accepts the ten characters on their own, without the PPW', async () => {
    expect(await verifyCode(LIVE.slice(4).replace('-', ''))).toBe('cLive01');
  });

  it('refuses nothing at all', async () => {
    expect(await verifyCode('')).toBeNull();
    expect(await verifyCode('   ')).toBeNull();
    expect(await verifyCode(null)).toBeNull();
  });

  // Fails CLOSED. A browser with no crypto.subtle (an insecure context) must not
  // become a browser where every code works.
  it('fails closed, loudly, where the browser cannot hash', async () => {
    vi.stubGlobal('crypto', { getRandomValues: (a) => a });   // no .subtle
    await expect(verifyCode(LIVE)).rejects.toThrow(/cannot check/i);
  });

  // The count is read from the registry, not from a second copy in the verifier.
  it('derives with the iteration count the registry declares', async () => {
    REGISTRY.kdf.iterations = 2000;      // the hashes on file were made at 1000
    expect(await verifyCode(LIVE)).toBeNull();
  });
});

// ── 2. what is committed to a public repo ───────────────────────────────────
describe('the committed registry', () => {
  // Read off DISK, not imported: the import is mocked above, and the claim here
  // is about the bytes that are committed to a public repo. Vitest runs from the
  // repo root, and `import.meta.url` is an http URL under Vite, so neither a
  // relative import nor new URL(...) would reach the file.
  const real = JSON.parse(readFileSync(resolve(process.cwd(), 'src/app5/access-codes.json'), 'utf8'));

  it('publishes no code, only hashes', () => {
    expect(Array.isArray(real.codes)).toBe(true);
    for (const row of real.codes) {
      expect(typeof row.salt).toBe('string');
      expect(typeof row.hash).toBe('string');
      expect(row.id).toBeTruthy();
      // Nothing in the row may be, or contain, a code.
      expect(Object.keys(row)).not.toContain('code');
      expect(JSON.stringify(row)).not.toMatch(/PPW-[0-9A-Z]{5}-[0-9A-Z]{5}/);
    }
  });

  it('keeps each offline guess expensive — the hashes are public', () => {
    expect(real.kdf.iterations).toBeGreaterThanOrEqual(310000);
    expect(real.kdf.hash).toBe('SHA-256');
  });
});

// ── 3. the grant on the device ──────────────────────────────────────────────
describe('access on this device', () => {
  it('is closed until a code is accepted', () => {
    expect(hasAccess()).toBe(false);
  });

  it('opens on a grant and survives a reload', () => {
    grantAccess('cLive01');
    expect(hasAccess()).toBe(true);
    expect(localStorage.getItem(LS_ACCESS)).toBeTruthy();
  });

  it('writes down the code ID and never the code', () => {
    grantAccess('cLive01');
    const stored = localStorage.getItem(LS_ACCESS);
    expect(stored).toContain('cLive01');
    expect(stored).not.toContain(LIVE);
    expect(stored).not.toContain(LIVE.replace(/-/g, ''));
  });

  it('closes again when the grant is given up', () => {
    grantAccess('cLive01');
    revokeLocalAccess();
    expect(hasAccess()).toBe(false);
  });

  // Revoking is the only lever Vic has over a device that already got in, and it
  // has to work on the device, not just at the door.
  it('shuts out a device whose code has since been revoked', () => {
    grantAccess('cDead01');
    expect(hasAccess()).toBe(false);
  });

  it('shuts out an ID that is in no registry', () => {
    grantAccess('cMadeUp');
    expect(hasAccess()).toBe(false);
  });
});

// ── 4. the door itself ──────────────────────────────────────────────────────
const field = () => screen.getByLabelText(/access code/i);
const type = (v) => fireEvent.change(field(), { target: { value: v } });
const openTheApp = () => screen.getByRole('button', { name: /open the app/i });
const checking = () => screen.queryByText(/checking the code/i);

/**
 * Tap the button and wait for the check to genuinely finish.
 *
 * A real PBKDF2 derivation resolves on a later turn than act() flushes, so a
 * bare `await act(() => click())` returns while the hash is still running — and
 * the grant then lands in the middle of the NEXT test. (Found exactly that way:
 * three tests failed with a grant none of them had made.)
 */
async function tapAndSettle() {
  await act(async () => { fireEvent.click(openTheApp()); });
  await waitFor(() => expect(checking()).toBeNull());
}

describe('the gate on screen', () => {
  it('asks for a code, and says what to do without one', () => {
    render(<AccessGate />);
    expect(screen.getByLabelText(/access code/i)).toBeTruthy();
    expect(openTheApp()).toBeTruthy();
    // Nobody is left guessing: there is a named way to get a code.
    expect(screen.getByText(/info@ppwellness\.co/i)).toBeTruthy();
  });

  it('is not there at all once this device has access', () => {
    grantAccess('cLive01');
    render(<AccessGate />);
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
  });

  it('opens the app on the right code', async () => {
    render(<AccessGate />);
    type(LIVE);
    await tapAndSettle();
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
    expect(hasAccess()).toBe(true);
  });

  it('stays open on a wrong code, and stays shut', async () => {
    render(<AccessGate />);
    type(STRANGER);
    await tapAndSettle();
    expect(field()).toBeTruthy();
    expect(hasAccess()).toBe(false);
    expect(screen.getByRole('alert').textContent).toMatch(/not recognised/i);
  });

  // A refusal must not tell a stranger which of their guesses was once real.
  it('refuses a revoked code in exactly the same words as an unknown one', async () => {
    render(<AccessGate />);
    type(STRANGER);
    await tapAndSettle();
    const unknown = screen.getByRole('alert').textContent;
    cleanup();

    render(<AccessGate />);
    type(DEAD);
    await tapAndSettle();
    expect(screen.getByRole('alert').textContent).toBe(unknown);
    expect(unknown).not.toMatch(/revoked|expired|no longer|cancelled|exists/i);
  });

  it('survives a reload once accepted', async () => {
    render(<AccessGate />);
    type(LIVE);
    await tapAndSettle();
    cleanup();

    render(<AccessGate />);      // a fresh page life, same device
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
  });

  // 310k iterations is ~100ms here and noticeably more on a cheap phone. Someone
  // WILL tap twice, and the second attempt must not start a second derivation.
  it('shows it is working, and a second attempt mid-check does nothing', async () => {
    // The registry here derives at 1000 iterations, which finishes inside the
    // same act() flush as the tap — so the working state is real but invisible
    // to a test. The shipped count is 310,000 (~100ms here, and plainly longer
    // on a cheap phone), so the derivation is HELD open deliberately to put the
    // test in the state a person on a slow phone is actually in.
    let release;
    const held = new Promise((r) => { release = r; });
    const real = crypto.subtle.deriveBits.bind(crypto.subtle);
    const derive = vi.spyOn(crypto.subtle, 'deriveBits')
      .mockImplementation(async (...a) => { await held; return real(...a); });

    render(<AccessGate />);
    const form = field().closest('form');
    type(LIVE);

    await act(async () => { fireEvent.click(openTheApp()); });
    // The screen says so, and the button cannot be tapped again. Found by type,
    // not by name: its name is now "Checking the code…", which is the point.
    const btn = form.querySelector('button[type="submit"]');
    expect(checking()).toBeTruthy();
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    // Submitted AGAIN anyway — this is the Enter key, which does not care that a
    // button is disabled. The guard is in the handler, not only in the markup.
    await act(async () => { fireEvent.submit(form); });

    await act(async () => { release(); await held; });
    await waitFor(() => expect(checking()).toBeNull());
    expect(hasAccess()).toBe(true);
    // One derivation per non-revoked code in the registry. Once, not twice.
    expect(derive).toHaveBeenCalledTimes(1);
  });

  it('says nothing happened when the field is empty', async () => {
    const derive = vi.spyOn(crypto.subtle, 'deriveBits');
    render(<AccessGate />);
    await tapAndSettle();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(derive).not.toHaveBeenCalled();
    expect(hasAccess()).toBe(false);
  });
});

// ── 5. the journey this gate could silently break ───────────────────────────
// A client taps their practitioner's WhatsApp link. They have never opened the
// app and have no code. App5's boot pass reads `#r=` and STRIPS it from the URL,
// so from that instant the only copy of the programme is the one the store is
// holding. If the gate discarded it — or if the fragment were never read because
// the gate replaced the app instead of covering it — the programme would be gone
// with no way back.
describe('a shared programme arriving before the code does', () => {
  const payload = (obj) => {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const PROGRAMME = {
    p: 'ppwr', v: 1, n: 'Shoulder rehab — weeks 1-6',
    i: [
      { t: 'Pendulum swings', m: '2 min each arm', h: '08:00', r: 'daily' },
      { t: 'Wall slides', h: '08:20', r: 'daily' },
    ],
  };

  beforeEach(() => {
    setState({
      pendingShare: null, shareError: null, shareHidden: false,
      screen: 'stack', viewDate: null, coach: null, journalOpen: false, hint: null,
      guide: { q: {}, welcomed: 1 }, hints: {}, hintsOff: true,
      onboarded: true, firstRunChoice: true, termsOk: true, signedIn: false,
      addOpen: false, aiOpen: false, termsOpen: false, accountOpen: false,
      completedOpen: false, playerItem: null, scheduleTarget: null, repeatId: null,
      premiumUpsell: null, routines: [], selectedIds: [],
    });
  });

  it('is still waiting after the code is entered', async () => {
    window.history.replaceState({}, '', '/#r=' + payload(PROGRAMME));
    await act(async () => { render(<App5 />); });

    // The door is shut, and the programme was read anyway.
    expect(screen.getByLabelText(/access code/i)).toBeTruthy();
    expect(getState().pendingShare).toBeTruthy();
    expect(getState().pendingShare.items.length).toBe(2);
    expect(window.location.hash).toBe('');   // already stripped — nothing to retry

    type(LIVE);
    await tapAndSettle();

    // Through the door, and the reason they came is on screen.
    expect(screen.queryByLabelText(/access code/i)).toBeNull();
    expect(getState().pendingShare).toBeTruthy();
    expect(screen.getByText(/Shoulder rehab — weeks 1-6/)).toBeTruthy();
  });
});
