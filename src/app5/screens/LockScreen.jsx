// LockScreen — the passcode gate.
//
// Sits above everything (z-70, over the coach marks) because while it is up the
// app genuinely has no session: the token is ciphertext on disk until the right
// passcode decrypts it. There is nothing underneath to reach, which is the point
// — this is a lock, not a curtain.
//
// Wording is deliberately plain about what it is worth. It stops someone picking
// up your phone. It is not a bank vault, and saying so is the difference between
// a feature and a lie.

import React from 'react';
import { unlockPasscode, isLocked, onPasscodeState, MAX_ATTEMPT_NOTE } from '../passcode.js';
import { syncEntitlement, syncAuthState, syncProfile, signOutMembership } from '../store5.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'];

export default function LockScreen() {
  const [locked, setLocked] = React.useState(isLocked());
  const [pin, setPin] = React.useState('');
  const [err, setErr] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  // The digits live in a ref as well as in state. Reading `pin` from the closure
  // drops taps that land in the same frame — a fast tapper types 4821 and the
  // screen sees "1". Caught by driving the keypad programmatically; on a phone it
  // would have surfaced as an occasional "wrong passcode" for the RIGHT passcode,
  // which is exactly the kind of fault nobody can reproduce on demand.
  const pinRef = React.useRef('');

  React.useEffect(() => onPasscodeState((s) => setLocked(s.locked)), []);

  // Every hook is above this line — the lock flips on and off at runtime, so an
  // early return above a hook would change the hook count between renders.
  if (!locked) return null;

  const submit = async (value) => {
    setBusy(true); setErr(null);
    try {
      await unlockPasscode(value);
      pinRef.current = ''; setPin('');
      syncAuthState();
      // The session was invisible while locked, so re-read what it is entitled to.
      syncEntitlement(); syncProfile();
    } catch (e) {
      pinRef.current = ''; setPin('');
      setErr(e?.message || 'That passcode did not work.');
    } finally { setBusy(false); }
  };

  const setPinBoth = (v) => { pinRef.current = v; setPin(v); };

  const press = (k) => {
    if (busy) return;
    setErr(null);
    if (k === 'del') { setPinBoth(pinRef.current.slice(0, -1)); return; }
    const next = (pinRef.current + k).slice(0, 8);
    setPinBoth(next);
    if (next.length === 4) submit(next);   // 4 digits is the common case — no extra tap
  };

  const forgot = () => {
    // Signing out clears the vault with the session inside it, so the way back in
    // is an ordinary sign-in. Nothing is recoverable from the passcode side, by
    // design — there is no key escrow anywhere.
    signOutMembership();
    setLocked(false);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px 24px' }}>
        <div style={{ width: 54, height: 54, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--accent)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
          </svg>
        </div>
        <div style={{ marginTop: 14, fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Enter your passcode</div>

        {/* dots */}
        <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{
              width: 13, height: 13, borderRadius: 999,
              background: pin.length > i ? 'var(--accent)' : 'transparent',
              border: `1px solid ${pin.length > i ? 'var(--acc-rim)' : 'var(--hairline)'}`,
              transition: 'background .18s ease',
            }} />
          ))}
        </div>

        <div style={{ minHeight: 42, marginTop: 12, maxWidth: 300, textAlign: 'center' }}>
          {err && <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 600, color: 'var(--bad, #c05)' }}>{err}</div>}
        </div>

        <div style={{ marginTop: 4, display: 'grid', gridTemplateColumns: 'repeat(3, 74px)', gap: 12 }}>
          {KEYS.map((k, i) => k === null ? <span key={i} /> : (
            <button key={i} onClick={() => press(k)} disabled={busy} aria-label={k === 'del' ? 'Delete' : k}
              style={{ height: 64, borderRadius: 22, fontSize: k === 'del' ? 15 : 22, fontWeight: 600, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', textShadow: 'var(--emboss)' }}>
              {k === 'del' ? '⌫' : k}
            </button>
          ))}
        </div>

        <button onClick={forgot} style={{ marginTop: 18, minHeight: 44, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600 }}>
          Forgotten it? Sign in instead
        </button>

        <p style={{ margin: '10px 20px 0', fontSize: 11, lineHeight: 1.5, color: 'var(--dim)', textAlign: 'center', maxWidth: 320 }}>
          {MAX_ATTEMPT_NOTE}
        </p>
      </div>
    </div>
  );
}
