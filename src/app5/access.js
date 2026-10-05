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
//   gitignored ACCESS-CODES.md and never leaves Vic's machine. The hash being
//   public is also why the iteration count is high: an offline guess has to
//   cost real time, because an attacker can make those guesses at their leisure.
//
// Paired with tools/mint-access-code.mjs, which is the only thing that writes
// access-codes.json. The two must agree exactly on normalisation and KDF or no
// code ever verifies — see `canonical()` for the one subtlety in that contract.

import registry from './access-codes.json';

const LS_KEY = 'ppw5.access';

/** The shape a code is minted in, for the UI to show as a hint. */
export const CODE_HINT = 'PPW-XXXXX-XXXXX';

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
