// Passcode lock (2026-08-06) — Vic picked option B: privacy, done for real.
//
// The whole feature rests on ONE claim: with a passcode set, the session is not
// on the device in readable form. If that is ever untrue, this is a lock screen
// with the key taped to the door — the exact thing Vic said not to build. The
// first test is that claim, and it is the one that must never be softened.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enablePasscode, unlockPasscode, lockNow, disablePasscode, updateSealedToken,
  isEnabled, isLocked, passcodeToken, validPasscode, passcodeAvailable,
  _resetPasscodeForTest,
} from './passcode.js';
import {
  readToken, isSignedIn, setSessionPasscode, clearSessionPasscode, signOut,
} from './membership.js';

const LS = (k) => 'ppw5.' + k;
const TOKEN = 'header.eyJzdWIiOiJ1c3JfMSJ9.signature';

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); _resetPasscodeForTest(); });
afterEach(() => { _resetPasscodeForTest(); vi.unstubAllGlobals(); });

describe('the session is not on the device in readable form', () => {
  it('leaves NO plaintext copy anywhere after the passcode is set', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');

    expect(localStorage.getItem(LS('authToken'))).toBeNull();
    expect(sessionStorage.getItem(LS('authToken'))).toBeNull();

    // And nothing else on the device is quietly holding it either.
    const everything = JSON.stringify([
      ...Object.entries(localStorage),
      ...Object.entries(sessionStorage),
    ]);
    expect(everything).not.toContain(TOKEN);
  });

  it('what IS stored cannot be read without the passcode', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    const vault = localStorage.getItem(LS('pc'));
    expect(vault).toBeTruthy();
    expect(vault).not.toContain(TOKEN);
    expect(vault).not.toContain('eyJzdWIi');    // not even the payload segment
  });

  it('a locked app has no session at all — not a hidden one', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    lockNow();
    expect(isLocked()).toBe(true);
    expect(passcodeToken()).toBeNull();
    expect(readToken()).toBeNull();
    expect(isSignedIn()).toBe(false);
  });
});

describe('unlocking', () => {
  it('the right passcode gives back the exact session', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    lockNow();
    await unlockPasscode('4821');
    expect(readToken()).toBe(TOKEN);
    expect(isSignedIn()).toBe(true);
  });

  it('the wrong passcode gives back nothing', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    lockNow();
    await expect(unlockPasscode('1234')).rejects.toThrow(/wrong passcode/i);
    expect(readToken()).toBeNull();
    expect(isLocked()).toBe(true);
  });

  it('counts down the tries left, out loud', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    lockNow();
    await expect(unlockPasscode('0000')).rejects.toThrow(/9 tries left/);
    await expect(unlockPasscode('0000')).rejects.toThrow(/8 tries left/);
  });

  it('wipes the stored session after ten wrong tries', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    lockNow();
    for (let i = 0; i < 9; i++) await unlockPasscode('0000').catch(() => {});
    await expect(unlockPasscode('0000')).rejects.toThrow(/too many wrong tries/i);
    expect(isEnabled()).toBe(false);
    expect(localStorage.getItem(LS('pc'))).toBeNull();
  });
}, 30000);

describe('it keeps up with a session that rotates', () => {
  // Load-bearing. Sessions renew in the background (ensureFreshSession), so a
  // vault that still held the token from the day the passcode was set would hand
  // back a dead session at the next unlock — the user would be "signed out" with
  // no explanation and no way to tell why.
  it('a renewed token is re-sealed, and it is the NEW one that comes back', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');

    const rotated = 'header.eyJzdWIiOiJ1c3JfMSIsIm5ldyI6dHJ1ZX0.sig2';
    await updateSealedToken(rotated);

    lockNow();
    await unlockPasscode('4821');
    expect(readToken()).toBe(rotated);
  });

  it('the rotated token is not written down in the clear either', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    const rotated = 'header.rotated-payload.sig2';
    await updateSealedToken(rotated);
    expect(JSON.stringify(Object.entries(localStorage))).not.toContain('rotated-payload');
  });
}, 20000);

describe('turning it off, and signing out', () => {
  it('turning it off hands the session back to ordinary storage', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    clearSessionPasscode();
    expect(isEnabled()).toBe(false);
    expect(readToken()).toBe(TOKEN);
    expect(localStorage.getItem(LS('authToken'))).toBe(TOKEN);
  });

  // Otherwise a later unlock would resurrect a session the user had ended.
  it('signing out takes the vault with it', async () => {
    localStorage.setItem(LS('authToken'), TOKEN);
    await setSessionPasscode('4821');
    signOut();
    expect(isEnabled()).toBe(false);
    expect(readToken()).toBeNull();
    expect(localStorage.getItem(LS('pc'))).toBeNull();
  });
}, 20000);

describe('what it refuses', () => {
  it('will not set one without a session to protect', async () => {
    await expect(setSessionPasscode('4821')).rejects.toThrow(/sign in first/i);
  });

  it('holds the line on length', () => {
    expect(validPasscode('4821')).toBe(true);
    expect(validPasscode('48213456')).toBe(true);
    expect(validPasscode('482')).toBe(false);
    expect(validPasscode('482134567')).toBe(false);
    expect(validPasscode('abcd')).toBe(false);
    expect(validPasscode('')).toBe(false);
  });

  it('does not pretend to work where the browser has no crypto', async () => {
    vi.stubGlobal('crypto', {});
    expect(passcodeAvailable()).toBe(false);
    await expect(enablePasscode('4821', TOKEN)).rejects.toThrow(/cannot store a passcode/i);
  });
});
