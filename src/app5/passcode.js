// passcode.js — a passcode that actually holds the session, not a screen over it.
//
// Vic asked for a 4-digit unlock "like a banking app" and, when given the options,
// picked B: PRIVACY, done properly. So this is deliberately NOT a lock screen with
// the session sitting in storage behind it — that version secures nothing, since
// anyone can open devtools, read the token, and walk past the screen.
//
// HOW IT WORKS
//   The session token is encrypted with a key derived from the passcode
//   (PBKDF2-SHA256 → AES-GCM). Only the ciphertext is ever written to disk. While
//   unlocked the plaintext token lives in this module's memory and nowhere else —
//   `membership.readToken()` reads it from here. Lock, close the tab, or kill the
//   app and what remains on the device is unreadable without the passcode.
//
// WHAT IT IS HONESTLY WORTH (and the UI says this, in these words)
//   It stops the person who picks up your unlocked phone. It does NOT stop someone
//   technical who has your device: four digits is ten thousand guesses, and those
//   guesses happen on their machine, at their speed. A real banking app is safe
//   because the phone's security chip and the bank's server count wrong attempts;
//   a web app has neither. Face ID / passkey unlock is the fix for that and is a
//   later, separate job.
//
//   The iteration count below makes each guess cost real time, which is the only
//   lever available here. It buys tens of minutes against a casual attacker, not
//   safety against a determined one. Do not oversell it in the UI.

const LS_KEY = 'ppw5.pc';

// MEASURED, not assumed. On this dev machine 310,000 iterations (the OWASP floor
// for PBKDF2-HMAC-SHA256) cost 29ms per attempt — so the whole 4-digit keyspace
// falls in about 5 minutes on one core, and far less in parallel. 1,000,000 puts
// a single attempt near 95ms here, so an unlock still feels instant while a full
// sweep costs roughly 15 minutes single-threaded. On a slow phone one unlock is
// perhaps half a second, paid once.
//
// This does NOT make four digits strong, and no iteration count would: the guesses
// happen on the attacker's machine, at their speed. It raises the floor and buys
// time. The honest ceiling is a passkey — see MAX_ATTEMPT_NOTE and the options note.
const ITERATIONS = 1000000;
const MAX_FAILS = 10;        // then the stored session is wiped — sign in again

/** Lock after this long in the background. Short enough to matter, long enough
 *  not to punish someone answering a text mid-routine. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

/** What the passcode is honestly worth, in the words the UI uses. */
export const MAX_ATTEMPT_NOTE =
  'Your passcode keeps your session locked on this device. It stops someone who picks up your phone — it is not a bank vault.';

// ── in-memory only, deliberately ─────────────────────────────────────────────
let _token = null;   // the decrypted session, while unlocked
let _key = null;     // the derived AES key, so a token refresh can re-encrypt
const _listeners = new Set();

function emit() {
  const s = { enabled: isEnabled(), locked: isLocked() };
  _listeners.forEach((cb) => { try { cb(s); } catch { /* one bad listener must not break the rest */ } });
}

export function onPasscodeState(cb) {
  _listeners.add(cb);
  try { cb({ enabled: isEnabled(), locked: isLocked() }); } catch { /* noop */ }
  return () => _listeners.delete(cb);
}

// ── storage ──────────────────────────────────────────────────────────────────
function readVault() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; }
}
function writeVault(v) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* private mode */ }
}
function dropVault() {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}

export function isEnabled() { return !!readVault(); }
/** Enabled but not yet unlocked in this page life. */
export function isLocked() { return isEnabled() && _token === null; }
/** The session, or null while locked. membership.readToken() defers to this. */
export function passcodeToken() { return _token; }

// ── crypto ───────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function subtle() {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  return c && c.subtle ? c.subtle : null;
}
export function passcodeAvailable() { return !!subtle(); }

function rand(n) {
  const a = new Uint8Array(n);
  globalThis.crypto.getRandomValues(a);
  return a;
}
const toB64 = (u8) => btoa(String.fromCharCode(...u8));
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passcode, salt, iterations) {
  const base = await subtle().importKey('raw', enc.encode(String(passcode)), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function sealWith(key, token) {
  const iv = rand(12);
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token));
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

// ── the four things the UI does ──────────────────────────────────────────────

/** Digits only, and long enough to be worth the ceremony. */
export function validPasscode(pc) { return /^\d{4,8}$/.test(String(pc ?? '')); }

/**
 * Turn it on. Takes the CURRENT session token and swaps it for ciphertext — the
 * caller must clear the plaintext copy it holds afterwards (membership does).
 */
export async function enablePasscode(passcode, token) {
  if (!passcodeAvailable()) throw new Error('This browser cannot store a passcode securely.');
  if (!validPasscode(passcode)) throw new Error('Use 4 to 8 digits.');
  if (!token) throw new Error('Sign in first, then set a passcode.');
  const salt = rand(16);
  const key = await deriveKey(passcode, salt, ITERATIONS);
  const { iv, ct } = await sealWith(key, String(token));
  writeVault({ v: 1, iter: ITERATIONS, salt: toB64(salt), iv, ct, fails: 0 });
  _key = key; _token = String(token);
  emit();
  return true;
}

/**
 * Unlock. A wrong passcode fails the AES-GCM tag check, which is what makes this
 * real: there is nothing to compare against and nothing to skip past.
 *
 * Returns the session on success. After MAX_FAILS the stored session is wiped —
 * not real protection against an offline attacker (they have their own copy of
 * the ciphertext), but it closes the easy case of someone poking at the keypad.
 */
export async function unlockPasscode(passcode) {
  const v = readVault();
  if (!v) throw new Error('No passcode is set.');
  if (!passcodeAvailable()) throw new Error('This browser cannot check the passcode.');
  let key;
  try {
    key = await deriveKey(passcode, fromB64(v.salt), v.iter || ITERATIONS);
    const plain = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(v.iv) }, key, fromB64(v.ct));
    _key = key; _token = dec.decode(plain);
    if (v.fails) writeVault({ ...v, fails: 0 });
    emit();
    return _token;
  } catch {
    const fails = (v.fails || 0) + 1;
    if (fails >= MAX_FAILS) {
      dropVault(); _key = null; _token = null; emit();
      const e = new Error('Too many wrong tries. Sign in with your email and password to start again.');
      e.wiped = true;
      throw e;
    }
    writeVault({ ...v, fails });
    const left = MAX_FAILS - fails;
    const e = new Error(`Wrong passcode. ${left} ${left === 1 ? 'try' : 'tries'} left before you have to sign in again.`);
    e.attemptsLeft = left;
    throw e;
  }
}

/** Drop the decrypted session from memory. The ciphertext stays. */
export function lockNow() {
  _token = null; _key = null;
  emit();
}

/** Turn it off and hand the plaintext session back to normal storage. */
export function disablePasscode() {
  const t = _token;
  dropVault(); _token = null; _key = null;
  emit();
  return t;
}

/**
 * Keep the vault in step when the session rotates.
 *
 * Load-bearing: sessions renew in the background (ensureFreshSession), so without
 * this the vault would still hold the token from the day the passcode was set and
 * the user would be signed out on the next unlock.
 */
export async function updateSealedToken(token) {
  if (!isEnabled() || !_key || !token) return false;
  const v = readVault();
  if (!v) return false;
  const { iv, ct } = await sealWith(_key, String(token));
  writeVault({ ...v, iv, ct });
  _token = String(token);
  return true;
}

/** For tests. */
export function _resetPasscodeForTest() { _token = null; _key = null; _listeners.clear(); dropVault(); }
