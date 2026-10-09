// access.js — the access-code front door.
//
// WHAT THIS IS FOR. The Lifestyle App pivoted to B2B on 2026-10-05: it is no
// longer sold to the public a seat at a time, it is licensed to businesses who
// embed it or run it as a platform. So everything in the product is unlocked
// (PREMIUM_OPEN in membership.js) and the thing that decides who gets in is a
// partner code handed out by Vic, one per client.
//
// WHAT IT IS HONESTLY WORTH — and say this out loud, like passcode.js does:
//   This runs in the browser, in a bundle that ships to everyone. Anybody who
//   opens devtools can call grantAccess() themselves and walk straight in. It is
//   a FRONT DOOR for legitimate B2B access — it keeps the app off a stranger's
//   screen and makes a licence a real, revocable thing — and it is NOT a
//   security boundary. Nothing behind it is a secret; the app's data is the
//   user's own and lives on their device.
//
//   What the hashing DOES protect is the codes themselves. ppw-fascia-app is a
//   PUBLIC GitHub repo (`gh repo view` -> visibility PUBLIC), so a code written
//   into the source in plaintext is a code published to the world, and every
//   partner code Vic ever issued would be readable in one file. Only PBKDF2
//   hashes with per-code salts are committed; the plaintext lives in the
//   gitignored ACCESS-CODES.md and never leaves Vic's machine.
//
//   AND THAT PROTECTION IS ONLY AS GOOD AS THE CODE IS LONG. Since 2026-10-08
//   the live code is FOUR DIGITS, at Vic's instruction, and four digits is a
//   doorbell rather than a lock. Measured on Vic's laptop: ~46ms per PBKDF2 guess
//   at the count below, so the whole 10,000-code space falls in about 7.7 minutes
//   on one core and roughly a minute across eight. The hashes are public, so
//   publishing hash("a four-digit code") is in practice publishing the code. The
//   high iteration count still earns its keep for the long minted codes in the
//   same registry — it does nothing for a four-digit one.
//
//   This is a deliberate trade, not an oversight: the code is there to keep
//   passers-by out and to make a licence revocable, and the real control on what
//   a visitor does with what they see is the confidentiality agreement beside it
//   (see nda.js). The throttle at the bottom of this file is the same kind of
//   thing — it makes walking the keypad through the UI tedious, and that is all.
//
// Paired with tools/mint-access-code.mjs, which is the only thing that writes
// access-codes.json. The two must agree exactly on normalisation and KDF or no
// code ever verifies — see `canonical()` for the one subtlety in that contract.

import registry from './access-codes.json';

const LS_KEY = 'ppw5.access';

/**
 * The placeholder in the code field.
 *
 * Deliberately NOT a shape. It used to read 'PPW-XXXXX-XXXXX', which was true
 * only of the long minted codes; the moment a short code was issued (2026-10-08)
 * that placeholder started telling every visitor the wrong format, and someone
 * holding a four-digit code would reasonably think they had the wrong thing.
 * Codes now come in more than one shape, so the field asks for the code rather
 * than describing it -- and it must never show a REAL one, since this string
 * ships in a public bundle.
 */
export const CODE_HINT = 'Type your code';

/** What a browser with no WebCrypto is told. Failing closed, in words. */
export const NO_CRYPTO_MESSAGE =
  'This browser cannot check an access code. Open the app in Safari, Chrome or Edge over https.';

function subtle() {
  const c = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  return c && c.subtle ? c.subtle : null;
}

/** False on an insecure context (plain http, or an old in-app webview). */
export function accessCheckAvailable() { return !!subtle(); }

const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
};

/**
 * THE NORMALISATION CONTRACT — the one place this can silently go wrong.
 *
 * The minter hashes `code.trim().toUpperCase()`, i.e. the code WITH its dashes,
 * exactly as printed: `PPW-XXXXX-XXXXX`. The dashes are therefore part of the
 * hashed string, and the registry holds no plaintext to compare a typed code
 * against — so "accept it without the dashes" cannot be done by comparing
 * shapes. It has to be done by REBUILDING the string the minter hashed.
 *
 * So: strip every non-alphanumeric from what was typed and uppercase it (which
 * absorbs lower case, spaces, en-dashes, underscores, dots, and a missing dash),
 * then put the minter's own punctuation back:
 *
 *   ppw a2345 b6789  ->  PPWA2345B6789  ->  PPW-A2345-B6789   (the hashed form)
 *
 * Both lengths are accepted because a code read down a phone arrives either way:
 * 13 alphanumerics is the whole code, 10 is the body without the PPW. The tests
 * are ordered 13-then-10 on purpose — the minting alphabet contains P and W, so
 * a body can itself begin "PPW", and stripping a prefix before checking the
 * length would mangle it.
 *
 * Anything else is passed through trimmed and uppercased, so a code in some
 * future shape still verifies when it is typed exactly as printed.
 */
function canonical(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (!raw) return '';
  const dashed = (body) => 'PPW-' + body.slice(0, 5) + '-' + body.slice(5);
  if (/^PPW[0-9A-Z]{10}$/.test(raw)) return dashed(raw.slice(3));
  if (/^[0-9A-Z]{10}$/.test(raw)) return dashed(raw);
  return String(input).trim().toUpperCase();
}

/**
 * The iteration count comes from the registry the minter wrote, so there is ONE
 * copy of it. If it is missing or nonsense, refuse rather than guess: a wrong
 * count silently matches nothing, which would look like "every code is wrong"
 * with no clue why.
 *
 * `row.iterations` is honoured first for a reason worth knowing: the minter only
 * writes `kdf.iterations` when it CREATES the registry, so bumping ITERATIONS in
 * that script later would hash new codes at the new count while the file still
 * declares the old one. A per-code count is the escape hatch for that day.
 */
function iterationsFor(row) {
  const n = Number(row && row.iterations) || Number(registry && registry.kdf && registry.kdf.iterations);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('The access-code registry is missing its KDF settings. Nothing can be checked.');
  }
  return n;
}

async function derive(code, saltB64, iterations) {
  const s = subtle();
  const key = await s.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveBits']);
  const bits = await s.deriveBits({ name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' }, key, 256);
  return toB64(bits);
}

/**
 * Compare without leaking where the two differ. The hashes are public and the
 * timing tells an attacker nothing they cannot read in the repo — but a sloppy
 * comparison is free to avoid, so avoid it.
 */
function sameHash(a, b) {
  const x = String(a), y = String(b);
  const n = Math.max(x.length, y.length);
  let diff = x.length ^ y.length;
  for (let i = 0; i < n; i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * Check a typed code.
 *
 * @returns the id of the matching, non-revoked code, or null. A revoked code and
 *   a code that never existed are the SAME answer — the caller must not be able
 *   to tell a stranger which of their guesses used to be real.
 * @throws if the browser cannot hash (insecure context) or the registry is
 *   unusable. Both are "nobody gets in", said out loud rather than silently
 *   turning into "everybody gets in".
 */
export async function verifyCode(input) {
  const code = canonical(input);
  if (!code) return null;
  if (!subtle()) {
    const e = new Error(NO_CRYPTO_MESSAGE);
    e.unavailable = true;
    throw e;
  }
  const rows = Array.isArray(registry && registry.codes) ? registry.codes : [];
  for (const row of rows) {
    if (!row || row.revoked || !row.salt || !row.hash) continue;
    const got = await derive(code, row.salt, iterationsFor(row));
    // Returning here leaks only WHICH row matched, by timing, to someone who
    // already holds a working code. A wrong code always walks every row. The
    // alternative costs ~100ms per issued partner on every refusal, on a phone.
    if (sameHash(got, row.hash)) return row.id;
  }
  return null;
}

// ── the grant on this device ─────────────────────────────────────────────────
// The code ID is written down, never the code: a device's localStorage is not a
// safe place to leave something a human might read out, and the ID is all that
// is needed to check the licence is still live.

function readGrant() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    return v && typeof v.id === 'string' ? v.id : null;
  } catch { return null; }      // private mode, or a half-written key
}

/** The id this device got in with, or null. Exposed for support ("which code?"). */
export function accessCodeId() { return readGrant(); }

/**
 * Does this device have access?
 *
 * Re-checked against the registry every time, not just "was a grant ever
 * written". Revoking is the only lever Vic has over a client who has stopped
 * paying, and it has to reach devices that are already inside — the next build
 * they load locks them out.
 */
export function hasAccess() {
  const id = readGrant();
  if (!id) return false;
  const rows = Array.isArray(registry && registry.codes) ? registry.codes : [];
  return rows.some((c) => c && c.id === id && !c.revoked);
}

/** Remember that this device was let in, and with which code. */
export function grantAccess(id) {
  if (!id) return false;
  try { localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, id: String(id), at: new Date().toISOString() })); } catch { /* private mode */ }
  return true;
}

/** Hand the device back to the door — used by "this isn't my code" and by tests. */
export function revokeLocalAccess() {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}

// ── the throttle on wrong codes ─────────────────────────────────────────────
//
// WHAT THIS IS AND IS NOT. The live code is four digits, so the door is a
// 10,000-guess keypad. This makes a run of wrong guesses cost a growing wait.
//
// It is NOT a security control, and it would be dishonest to call it one: all of
// it runs in the visitor's own browser, so anyone willing to open devtools can
// call grantAccess() and skip the door entirely, or clear this counter, or just
// hash the registry offline (see the header — that costs minutes). What it stops
// is the realistic case: a bored person typing guesses, or a three-line script
// pumping the form. Those give up; this is enough for those.
//
// A WAIT, NOT A LOCKOUT. It always ends, and a correct code arriving after it has
// ended gets in — `attemptWaitMs()` is recomputed from the clock on every call
// and the counter is only ever extended by a FAILURE, never by an attempt. The
// person who mistyped their code four times must not be the one who gets punished.

const LS_TRIES = 'ppw5.access.tries';

/** Wrong codes that cost nothing. Enough for a genuine mistyping, not enough to sweep. */
const FREE_TRIES = 4;

/** The wait after each further wrong code. The last step repeats for ever. */
const WAIT_STEPS_MS = [15000, 30000, 60000, 120000, 300000];
const MAX_WAIT_MS = WAIT_STEPS_MS[WAIT_STEPS_MS.length - 1];

/**
 * The in-memory mirror, and the reason it exists: localStorage is the visitor's
 * to clear. Clearing site data halfway through a run of guesses must not hand
 * back a fresh allowance, so whichever of memory and disk has seen MORE failures
 * is the one that counts. Memory dies with the page life, disk survives a reload,
 * and between them a guesser has to do both to get anywhere — which, again, is
 * trivial for anyone technical and tedious for everyone else.
 */
let _tries = null;

function diskTries() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_TRIES) || 'null');
    return v && Number.isFinite(v.n) ? v : null;
  } catch { return null; }
}

function currentTries() {
  const mem = _tries;
  const disk = diskTries();
  if (!mem) return disk;
  if (!disk) return mem;
  if (disk.n !== mem.n) return disk.n > mem.n ? disk : mem;
  return (disk.until || 0) > (mem.until || 0) ? disk : mem;
}

/**
 * How much longer the door is holding, in ms. 0 when it is not.
 *
 * Capped at the longest step however far away `until` is, so a device whose clock
 * jumps backwards — or a tampered-with record — cannot shut someone out of their
 * own app for a week.
 */
export function attemptWaitMs() {
  const t = currentTries();
  if (!t || !t.until) return 0;
  const left = t.until - Date.now();
  if (left <= 0) return 0;
  return Math.min(left, MAX_WAIT_MS);
}

/**
 * Count one wrong code and return the wait it just bought (0 for the early ones).
 *
 * Called ONLY on a refusal. A correct code never passes through here, so the
 * counter cannot grow underneath someone who is getting it right.
 */
export function recordWrongCode() {
  const prev = currentTries();
  const n = (prev && Number.isFinite(prev.n) ? prev.n : 0) + 1;
  const over = n - FREE_TRIES;
  const wait = over > 0 ? WAIT_STEPS_MS[Math.min(over - 1, WAIT_STEPS_MS.length - 1)] : 0;
  const rec = { v: 1, n, until: wait > 0 ? Date.now() + wait : 0 };
  _tries = rec;
  try { localStorage.setItem(LS_TRIES, JSON.stringify(rec)); } catch { /* private mode */ }
  return wait;
}

/** Forget the run. Called when a code is accepted — the door opened, so it is over. */
export function clearWrongCodes() {
  _tries = null;
  try { localStorage.removeItem(LS_TRIES); } catch { /* noop */ }
}

/**
 * For tests only.
 *
 * `keepStorage` simulates a RELOAD rather than a reset: memory goes, the disk
 * record stays, which is exactly the state a new page life starts in.
 */
export function _resetAttemptsForTest(opts) {
  _tries = null;
  if (!(opts && opts.keepStorage)) {
    try { localStorage.removeItem(LS_TRIES); } catch { /* noop */ }
  }
}
