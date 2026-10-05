// AccessGate — the front door of the whole app.
//
// Above EVERY other gate: the onboarding wizard, the terms screen, the first-run
// choice and the passcode lock all sit behind this one, because none of them are
// questions you should be asked before the app has established you are allowed
// to be here at all. In App5 it renders last, at z80, over the passcode's z70.
//
// It is a COVER, not a replacement. App5 still mounts and still runs its boot
// pass underneath — which matters for exactly one journey: a practitioner's
// client arriving on a `#r=` routine link with no code yet. That fragment is
// read and stripped on boot, so if this gate had replaced the app, the link
// would have been spent on a screen that never read it and the programme would
// be gone. It is held in the store instead, and is waiting the moment the door
// opens. See access-gate.test.jsx, last block.
//
// Honest about what it is: see the header of access.js. This keeps the app off a
// stranger's screen and makes a licence revocable. It is not a secret-keeper.

import React from 'react';
import { verifyCode, grantAccess, hasAccess, accessCheckAvailable, CODE_HINT, NO_CRYPTO_MESSAGE } from '../access.js';
import { isDemo } from '../demo.js';

// One refusal for every refusal. A revoked code and a code that never existed
// must read identically, or the door tells a stranger which of their guesses
// used to be real.
const REFUSED = 'That code was not recognised. Check it and try again.';
const CONTACT = 'info@ppwellness.co';

export default function AccessGate() {
  // Local state, not store state: nothing else in the app needs to know about
  // the door, and a store flag would be one more thing to keep in step.
  //
  // THE DEMO DOOR (`?demo=1`, see demo.js) stands BESIDE the code door rather
  // than opening it. `hasAccess()` is left telling the truth — false — so
  // nothing in the app comes to believe this device holds a licence, and
  // grantAccess() is never called, so there is nothing on disk to clear
  // afterwards. The same browser meets this gate again on the very next load
  // without the parameter.
  const [open, setOpen] = React.useState(() => !isDemo() && !hasAccess());
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const inputRef = React.useRef(null);
  // A ref as well as `busy`, for the same reason LockScreen keeps the digits in
  // one: two taps in the same frame both read the OLD `busy` out of the closure
  // and both start a 310,000-iteration derivation. The ref is current.
  const runningRef = React.useRef(false);

  React.useEffect(() => {
    if (open && inputRef.current) { try { inputRef.current.focus(); } catch { /* noop */ } }
  }, [open]);

  // Every hook is above this line — the door closes at runtime, so an early
  // return above a hook would change the hook count between renders.
  if (!open) return null;

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (runningRef.current) return;
    if (!String(value).trim()) {
      setErr('Type the code the business that gave you the app sent you.');
      return;
    }
    runningRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const id = await verifyCode(value);
      if (id) {
        grantAccess(id);
        setOpen(false);
        return;
      }
      setErr(REFUSED);
    } catch (e2) {
      // A browser that cannot hash, or a registry that cannot be read. Both mean
      // nobody gets in, and both say so instead of pretending the code was wrong.
      setErr((e2 && e2.message) || REFUSED);
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '32px 20px calc(28px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 390, margin: '0 auto' }}>
          {/* the key, in the accent of whatever colourway is on */}
          <div style={{ width: 54, height: 54, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', color: 'var(--accent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3.5M15.5 12v3" />
            </svg>
          </div>

          <h1 style={{ margin: '16px 0 0', fontSize: 'clamp(22px, 6.6vw, 27px)', fontWeight: 700, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>
            Enter your access code
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--dim)' }}>
            The Lifestyle App is licensed to businesses — gyms, clinics, studios and
            employers — who hand it to their own people. Your code comes from whoever
            gave you the app.
          </p>

          <form onSubmit={submit} style={{ marginTop: 22 }}>
            <label htmlFor="ppw-access-code" style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>
              Access code
            </label>
            <input
              ref={inputRef}
              id="ppw-access-code"
              value={value}
              onChange={(ev) => { setValue(ev.target.value); if (err) setErr(null); }}
              placeholder={CODE_HINT}
              maxLength={40}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              aria-invalid={err ? 'true' : 'false'}
              style={{
                marginTop: 8, width: '100%', height: 58, padding: '0 16px', boxSizing: 'border-box',
                borderRadius: 18, border: `1px solid ${err ? 'var(--bad)' : 'var(--rim)'}`,
                background: 'var(--surface)', boxShadow: 'var(--elev)', color: 'var(--ink)',
                // 17px, because anything under 16 makes iOS Safari zoom the page
                // on focus and the frame never comes back straight.
                fontSize: 17, fontWeight: 700, letterSpacing: '.08em', textAlign: 'center',
                textTransform: 'uppercase', outline: 'none',
              }}
            />

            <div style={{ minHeight: 40, marginTop: 10 }}>
              {err && (
                <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              aria-busy={busy ? 'true' : 'false'}
              style={{
                width: '100%', minHeight: 56, borderRadius: 18,
                border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)',
                boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)',
                fontSize: 16, fontWeight: 700, textShadow: 'var(--label-shadow)',
                opacity: busy ? .72 : 1, transition: 'opacity .2s',
              }}
            >
              {busy ? 'Checking the code…' : 'Open the app'}
            </button>
          </form>

          <p style={{ margin: '14px 2px 0', fontSize: 12, lineHeight: 1.55, color: 'var(--dim)' }}>
            Capitals and dashes do not matter — type it however it was sent to you.
          </p>

          {/* Said UP FRONT on a browser that cannot hash, rather than only after
              a tap — and in access.js's own words, so the warning and the thrown
              message can never drift apart. */}
          {!accessCheckAvailable() && (
            <p style={{ margin: '10px 2px 0', fontSize: 12, lineHeight: 1.55, fontWeight: 600, color: 'var(--bad)' }}>
              {NO_CRYPTO_MESSAGE}
            </p>
          )}

          {/* Nobody is left guessing. A visitor with no code is not a mistake —
              they are a lead — so the door says who to ask. */}
          <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 18, border: '1px solid var(--hairline)', background: 'var(--track)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>No code?</div>
            <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.6, color: 'var(--dim)' }}>
              If you run a business and want to give this app to your clients or staff,
              email{' '}
              <a href={`mailto:${CONTACT}`} style={{ display: 'inline-block', minHeight: 24, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>{CONTACT}</a>
              {' '}and we will set you up.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
