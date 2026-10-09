// Mint an access code for the Lifestyle App.
//
// THE CONSTRAINT THIS EXISTS FOR: ppw-fascia-app is a PUBLIC GitHub repo
// (`gh repo view` -> "visibility": "PUBLIC"), and the built bundle ships to
// every visitor. A code written into the source in plaintext is therefore a
// code PUBLISHED to the world, and a competitor could read every partner code
// Vic has ever issued straight out of the repository.
//
// So the repo stores only a PBKDF2-SHA-256 hash per code, with a per-code salt.
// The plaintext lives in ACCESS-CODES.md, which is gitignored and never leaves
// this machine.
//
// Iterations are deliberately high. The hash IS public, so an attacker can
// brute-force it offline at their leisure; the only defence is making each
// guess expensive. At 310,000 iterations a guess costs roughly 100 ms, and the
// code space (31^10, about 8.2e14) puts an exhaustive search far out of reach.
// The unambiguous alphabet drops 0/O/1/I/L so a code can be read down a phone
// without being written down wrong.
//
// Usage:
//   node tools/mint-access-code.mjs "Acme Physio - pilot"
//   node tools/mint-access-code.mjs "Guest" --revoke=<id>
import { webcrypto as crypto } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REPO = 'C:/Users/Victor/Documents/PPW-Code/ppw-fascia-app-share';
const REGISTRY = `${REPO}/src/app5/access-codes.json`;   // committed: hashes only
const PLAINTEXT = `${REPO}/ACCESS-CODES.md`;             // gitignored: the codes

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';      // no 0 O 1 I L
const ITERATIONS = 310000;
const GROUPS = [5, 5];

const b64 = (buf) => Buffer.from(buf).toString('base64');

function mintCode() {
  const need = GROUPS.reduce((a, b) => a + b, 0);
  const out = [];
  // Rejection sampling, so every character is uniformly likely. A plain
  // `% ALPHABET.length` would quietly bias the first few letters.
  while (out.length < need) {
    const bytes = crypto.getRandomValues(new Uint8Array(need * 2));
    for (const b of bytes) {
      if (out.length >= need) break;
      if (b < 256 - (256 % ALPHABET.length)) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  let i = 0;
  return 'PPW-' + GROUPS.map((g) => out.slice(i, (i += g)).join('')).join('-');
}

export async function hashCode(code, saltB64, iterations = ITERATIONS) {
  const salt = Buffer.from(saltB64, 'base64');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(code.trim().toUpperCase()), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256);
  return b64(new Uint8Array(bits));
}

const label = process.argv[2] || 'Guest';
const revoke = (process.argv.find((a) => a.startsWith('--revoke=')) || '').split('=')[1];
// --code=XXXX sets an EXPLICIT code instead of minting a random one, for when a
// human has to read it down a phone. Short codes are a doorbell, not a lock: the
// hash is committed to a PUBLIC repo, so a 4-digit code is recoverable from it in
// minutes. That is a deliberate trade when the real control is the confidentiality
// acknowledgement at the door, and the tool says so out loud rather than pretending.
const explicit = (process.argv.find((a) => a.startsWith('--code=')) || '').split('=')[1];

const registry = existsSync(REGISTRY)
  ? JSON.parse(readFileSync(REGISTRY, 'utf8'))
  : { version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS }, codes: [] };

if (revoke) {
  const row = registry.codes.find((c) => c.id === revoke);
  if (!row) { console.log(`no code with id ${revoke}`); process.exit(1); }
  row.revoked = true;
  row.revokedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');
  console.log(`revoked ${revoke} (${row.label}). Rebuild and redeploy for it to stop working.`);
  process.exit(0);
}

const code = explicit ? explicit.trim().toUpperCase() : mintCode();
if (explicit) {
  const space = /^[0-9]+$/.test(code) ? Math.pow(10, code.length) : Math.pow(ALPHABET.length, code.length);
  if (space < 1e9) {
    console.log(`
  NOTE: "${'*'.repeat(code.length)}" has ~${space.toLocaleString()} possibilities.`);
    console.log('  The hash is committed to a PUBLIC repo, so this code is recoverable');
    console.log('  from it by brute force. Treat it as a doorbell that keeps out passers-by,');
    console.log('  not as a secret. The confidentiality notice at the door is the real control.');
  }
}
const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
const hash = await hashCode(code, salt);
const id = 'c' + b64(crypto.getRandomValues(new Uint8Array(6))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6);
const issued = new Date().toISOString().slice(0, 10);

registry.codes.push({ id, label, salt, hash, issued, revoked: false });
writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + '\n');

const line = `| \`${code}\` | ${label} | ${id} | ${issued} | active |`;
if (existsSync(PLAINTEXT)) {
  const cur = readFileSync(PLAINTEXT, 'utf8').trimEnd();
  writeFileSync(PLAINTEXT, cur + '\n' + line + '\n');
} else {
  writeFileSync(PLAINTEXT, `# Lifestyle App access codes

**This file is gitignored and must stay that way.** The repo is PUBLIC; only the
PBKDF2 hashes in \`src/app5/access-codes.json\` are committed. If this file is ever
committed, every code in it is published and all of them must be revoked.

Mint another:   \`node tools/mint-access-code.mjs "Client name - what it is for"\`
Revoke one:     \`node tools/mint-access-code.mjs x --revoke=<id>\`
                (then rebuild and redeploy; a revoked code keeps working until you do)

Codes are case-insensitive and the dashes are optional when typing them in.

| Code | Issued to | id | Date | Status |
|---|---|---|---|---|
${line}
`);
}

console.log(`\nMinted for: ${label}`);
console.log(`  id        ${id}`);
console.log(`  written   ACCESS-CODES.md  (gitignored - the code itself is ONLY there)`);
console.log(`  committed src/app5/access-codes.json  (the hash, safe for a public repo)`);
console.log(`\nThe code is NOT printed here on purpose. Open ACCESS-CODES.md to read it.\n`);
