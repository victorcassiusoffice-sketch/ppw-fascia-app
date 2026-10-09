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
//
// TWO THINGS ARE ASKED HERE, not one (2026-10-08). The app is pre-release software
// being shown to prospective business customers, so beside the code there is a
// confidentiality agreement, and it is a GATE rather than a link someone could
// scroll past: the button does not work until the box is ticked. The wording, the
// version, and the record of what was agreed all live in nda.js — see its header
// for what that record honestly is (a note on this device, not a signed
// document). Bumping NDA_VERSION sends every device back here.

import React from 'react';
import {
  verifyCode, grantAccess, hasAccess, accessCodeId, accessCheckAvailable,
  CODE_HINT, NO_CRYPTO_MESSAGE,
  attemptWaitMs, recordWrongCode, clearWrongCodes,
} from '../access.js';
import {
  NDA_TITLE, NDA_INTRO, NDA_POINTS, NDA_TICK_LABEL, NDA_NUDGE, NDA_FOOTNOTE,
  ndaAccepted, acceptNda,
} from '../nda.js';
import { isDemo } from '../demo.js';

// One refusal for every refusal. A revoked code and a code that never existed
// must read identically, or the door tells a stranger which of their guesses
// used to be real.
const REFUSED = 'That code was not recognised. Check it and try again.';
const CONTACT = 'info@ppwellness.co';

/**
 * The throttle, in words. Rounded UP and never below one, so it never reads
 * "wait 0 seconds" while the button is still disabled.
 */
function waitMessage(ms) {
  const s = Math.max(1, Math.ceil(ms / 1000));
  if (s < 60) return `Too many wrong codes. Wait ${s} ${s === 1 ? 'second' : 'seconds'} and try again.`;
  const m = Math.ceil(s / 60);
  return `Too many wrong codes. Wait ${m} ${m === 1 ? 'minute' : 'minutes'} and try again.`;
}

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
  // BOTH must be true to be past this door: a live licence AND agreement to the
  // wording that is shipping right now. A device that agreed to older words is
  // sent back here — that is the whole mechanism keeping nda.js's record honest.
  const [open, setOpen] = React.useState(() => !isDemo() && !(hasAccess() && ndaAccepted()));
  // Which of the two doors this is, decided once at mount. A device that already
  // holds a licence and is only back because the wording changed must not be sent
  // hunting for a code it already used, so it is asked for the tick alone.
  const [needCode] = React.useState(() => !hasAccess());
  const [accepted, setAccepted] = React.useState(false);
  const [value, setValue] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const inputRef = React.useRef(null);
  // A ref as well as `busy`, for the same reason LockScreen keeps the digits in
  // one: two taps in the same frame both read the OLD `busy` out of the closure
  // and both start a 310,000-iteration derivation. The ref is current.
  const runningRef = React.useRef(false);
  // Only to re-render the countdown. The wait itself is never held in state —
  // see below.
  const [, forceTick] = React.useState(0);

  // READ FROM THE CLOCK ON EVERY RENDER, not held in state. A wait that is over
  // must be over, even on a tab that has been sitting open since it started and
  // has not re-rendered since.
  //
  // Only while the door is up, though: this component stays mounted for the life
  // of the app and re-renders with every store change, and a shut door has no
  // business reading localStorage on each of them.
  const wait = open ? attemptWaitMs() : 0;
  const waiting = wait > 0;

  React.useEffect(() => {
    if (open && needCode && inputRef.current) { try { inputRef.current.focus(); } catch { /* noop */ } }
  }, [open, needCode]);

  // Tick the countdown only while there is one. The dependency is the BOOLEAN, so
  // the interval is created once per wait rather than once per 500ms.
  React.useEffect(() => {
    if (!open || !waiting) return undefined;
    const h = setInterval(() => forceTick((n) => n + 1), 500);
    return () => clearInterval(h);
  }, [open, waiting]);

  // Every hook is above this line — the door closes at runtime, so an early
  // return above a hook would change the hook count between renders.
  if (!open) return null;

  const submit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (runningRef.current) return;

    // THE AGREEMENT FIRST, ALWAYS — and here in the handler, not only on the
    // disabled button, because the Enter key does not care that a button is
    // disabled. Same lesson as the double-tap guard below it.
    if (!accepted) {
      setErr(NDA_NUDGE);
      return;
    }

    // Re-read the wait rather than trusting `wait` from this render, for the
    // reason given where it is computed.
    const held = attemptWaitMs();
    if (held > 0) {
      setErr(waitMessage(held));
      forceTick((n) => n + 1);
      return;
    }

    // The licence is already in hand and only the wording changed, so there is
    // nothing to check — just write down what was agreed to and stand aside.
    if (!needCode) {
      acceptNda(accessCodeId());
      setOpen(false);
      return;
    }

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
        // The agreement is written BEFORE the grant, so there is never a device
        // that is inside with no record of what it agreed to.
        acceptNda(id);
        grantAccess(id);
        clearWrongCodes();      // the door opened; the run of wrong guesses is over
        setOpen(false);
        return;
      }
      // Only a REFUSAL counts against the throttle. An empty field and a missing
      // tick both return above this line, so neither spends a try.
      const next = recordWrongCode();
      setErr(next > 0 ? waitMessage(next) : REFUSED);
    } catch (e2) {
      // A browser that cannot hash, or a registry that cannot be read. Both mean
      // nobody gets in, and both say so instead of pretending the code was wrong.
      setErr((e2 && e2.message) || REFUSED);
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  };

  const blocked = busy || !accepted || waiting;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      {/* CENTRED BY `margin: auto` ON THE CHILD, NOT by justify-content on the
          scroller. They look identical until the content is taller than the
          screen, and then they could not differ more: `justify-content: center`
          overflows BOTH ends of a scroll container and the top becomes
          unreachable — no scrolling gets it back. The agreement made this door
          tall enough to hit exactly that, and the heading and the "your code
          comes from whoever gave you the app" line were the part that vanished.
          Auto margins only absorb space that exists, so they centre a short door
          and get out of the way of a tall one. */}
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '32px 20px calc(28px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ width: '100%', maxWidth: 390, margin: 'auto' }}>
          {/* the key, in the accent of whatever colourway is on */}
          <div style={{ width: 54, height: 54, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', color: 'var(--accent)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3.5M15.5 12v3" />
            </svg>
          </div>

          <h1 style={{ margin: '16px 0 0', fontSize: 'clamp(22px, 6.6vw, 27px)', fontWeight: 700, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>
            {needCode ? 'Enter your access code' : 'One quick thing'}
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 14.5, lineHeight: 1.55, color: 'var(--dim)' }}>
            {needCode
              ? 'The Lifestyle App is licensed to businesses — gyms, clinics, studios and employers — who hand it to their own people. Your code comes from whoever gave you the app.'
              : 'We have changed the wording below since you last agreed to it. Have a read and tick the box, and you are straight back in — your access has not changed.'}
          </p>

          {/* ── the confidentiality agreement ──────────────────────────────
              A GATE, not a link: the button below stays disabled until the box
              is ticked, and the handler refuses too. The wording is rendered
              from nda.js so what is on screen and what gets recorded are the
              same text — see that file's header for what the record is worth. */}
          <div style={{ marginTop: 22, padding: '16px 18px', borderRadius: 20, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>{NDA_TITLE}</div>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--dim)' }}>{NDA_INTRO}</p>

            {NDA_POINTS.map((point) => (
              <React.Fragment key={point.h}>
                <div style={{ marginTop: 12, fontSize: 12.5, fontWeight: 800, letterSpacing: '.01em', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>{point.h}</div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--ink)' }}>{point.p}</p>
              </React.Fragment>
            ))}

            {/* The onboarding consent idiom, verbatim: a button that IS the
                checkbox, so a screen-reader user can tell agreed from
                not-agreed on a gate that is the whole point of the screen. */}
            <button
              type="button"
              onClick={() => { setAccepted((v) => !v); if (err) setErr(null); }}
              role="checkbox"
              aria-checked={accepted ? 'true' : 'false'}
              aria-label={NDA_TICK_LABEL}
              style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', gap: 11, minHeight: 44, background: 'none', border: 'none', padding: 0, color: 'var(--ink)', textAlign: 'left', cursor: 'pointer' }}
            >
              <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 9, border: `1px solid ${accepted ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: accepted ? 'var(--acc-surf)' : 'var(--surface)', boxShadow: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                {accepted && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 }}>{NDA_TICK_LABEL}</span>
            </button>

            <p style={{ margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.55, color: 'var(--dim)' }}>{NDA_FOOTNOTE}</p>
          </div>

          <form onSubmit={submit} style={{ marginTop: 22 }}>
            {needCode && (
              <>
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
              </>
            )}

            <div style={{ minHeight: 40, marginTop: 10 }}>
              {err && (
                <div role="alert" style={{ fontSize: 12.5, lineHeight: 1.45, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>
              )}
            </div>

            <button
              type="submit"
              disabled={blocked}
              aria-busy={busy ? 'true' : 'false'}
              style={{
                width: '100%', minHeight: 56, borderRadius: 18,
                border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)',
                boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)',
                fontSize: 16, fontWeight: 700, textShadow: 'var(--label-shadow)',
                opacity: blocked ? .45 : 1, transition: 'opacity .2s',
              }}
            >
              {busy ? 'Checking the code…' : (needCode ? 'Open the app' : 'Continue')}
            </button>

            {/* The onboarding's nudge line, and for the same reason: a disabled
                button with no explanation reads as a broken app. Hidden while an
                error is showing so the same sentence is never on screen twice. */}
            {!accepted && !err && (
              <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', textAlign: 'center' }}>
                {NDA_NUDGE}
              </p>
            )}
          </form>

          {needCode && (
            <p style={{ margin: '14px 2px 0', fontSize: 12, lineHeight: 1.55, color: 'var(--dim)' }}>
              Capitals and dashes do not matter — type it however it was sent to you.
            </p>
          )}

          {/* Said UP FRONT on a browser that cannot hash, rather than only after
              a tap — and in access.js's own words, so the warning and the thrown
              message can never drift apart. */}
          {needCode && !accessCheckAvailable() && (
            <p style={{ margin: '10px 2px 0', fontSize: 12, lineHeight: 1.55, fontWeight: 600, color: 'var(--bad)' }}>
              {NO_CRYPTO_MESSAGE}
            </p>
          )}

          {/* Nobody is left guessing. A visitor with no code is not a mistake —
              they are a lead — so the door says who to ask. */}
          {needCode && (
            <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 18, border: '1px solid var(--hairline)', background: 'var(--track)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>No code?</div>
              <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.6, color: 'var(--dim)' }}>
                If you run a business and want to give this app to your clients or staff,
                email{' '}
                <a href={`mailto:${CONTACT}`} style={{ display: 'inline-block', minHeight: 24, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>{CONTACT}</a>
                {' '}and we will set you up.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
