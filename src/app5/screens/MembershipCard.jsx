// MembershipCard — Settings → Membership.
//
// Replaces the old manual "Premium" toggle, which was a switch anyone could flip
// to unlock the paid features for free. Membership is now an account: sign in,
// and the server says whether you're Premium.
//
// Free users never need this screen — the app works signed-out exactly as before.
// Signing in only matters for Premium.

import React from 'react';
import { useStore5, setState, syncEntitlement, signOutMembership, applyServerEntitlement, syncProfile } from '../store5.js';
import {
  GUMROAD_URL, PREM_PRICE, PREM_PRICE_FULL,
  requestSignIn, completeSignIn, fetchEntitlement, readEmail, isSignedIn,
  checkoutUrl, pollForPremium, readEntitlementCache,
  setDevPremium, devPremiumAvailable,
  passwordSignIn, setPassword, PASSWORD_MIN, staySignedIn, setStaySignedIn,
  consumeNewAccount, isAdminGrant, passwordSetHere,
} from '../membership.js';

/**
 * LEGIBILITY (Vic, 2026-08-06: the Premium panel is "hard to read").
 *
 * The Premium state used to paint the whole card in `--acc-surf` and write on it
 * in white. On the light themes that token is a near-solid orange
 * (rgba(242,121,43,.94)), so the card became a slab of paint carrying white body
 * text at roughly 2.5:1 — the one surface in the app that did not look or read
 * like its siblings.
 *
 * Two binding laws were being broken (skills/liquid-glass-implementation.md):
 * accent is a rim and a glow, never opaque paint; and legibility comes from the
 * scrim tier, not from filling a surface. So Premium is now the SAME glass card
 * as everything else, marked by an accent rim, an accent glow and the crown —
 * and its text uses the app's ordinary ink pairing.
 *
 * Deliberately no backdrop-filter here: this card renders inside AccountSheet,
 * which is already blurred glass. Stacking blur is glass-on-glass — banned by
 * the same skill, and a known renderer trap.
 */
const card = (accent) => ({
  position: 'relative', marginTop: 12, borderRadius: 24, overflow: 'hidden', padding: 18,
  background: 'var(--surface)',
  border: `1px solid ${accent ? 'var(--acc-rim)' : 'var(--rim)'}`,
  boxShadow: accent ? 'var(--elev), var(--acc-glow)' : 'var(--elev)',
});
const input = {
  width: '100%', height: 48, borderRadius: 14, padding: '0 14px', fontSize: 15,
  background: 'var(--track)', border: '1px solid var(--hairline)', color: 'var(--ink)',
  boxShadow: 'var(--inset)', outline: 'none',
};
const primaryBtn = {
  width: '100%', height: 50, borderRadius: 16, border: '1px solid var(--acc-rim)',
  background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15,
  boxShadow: 'var(--acc-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  textDecoration: 'none',
};
const quietBtn = {
  width: '100%', height: 44, background: 'none', border: 'none',
  color: 'var(--dim)', fontSize: 13.5, fontWeight: 600,
};
// One ink pairing everywhere — white-on-orange body text is gone, see card().
// Call sites may still pass the old `accent` argument; it is simply ignored.
const note = () => ({
  marginTop: 12, fontSize: 11.5, lineHeight: 1.55, color: 'var(--dim)',
});

/**
 * The error the user actually sees.
 *
 * Vic typed a wrong password on his phone and saw nothing. The message existed and
 * was correct — it was rendered at the FOOT of the card, below the buttons, the
 * explanatory note and the dev block, inside a sheet that scrolls. On a phone it
 * was simply off the bottom of the screen. An error the user cannot see is an
 * error that does not exist, so this one sits directly under the field it is
 * about, is coloured and iconed like an error, and scrolls itself into view.
 */
function FieldError({ children }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!ref.current) return;
    try { ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* jsdom / old webview */ }
  }, [children]);
  if (!children) return null;
  return (
    <div ref={ref} role="alert" aria-live="assertive"
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 2, padding: '10px 12px', borderRadius: 14, background: 'var(--track)', border: '1px solid var(--bad, #c05)', color: 'var(--bad, #c05)', fontSize: 12.5, lineHeight: 1.5, fontWeight: 600 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flex: 'none', marginTop: 1 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.2v.5" />
      </svg>
      <span>{children}</span>
    </div>
  );
}

/**
 * What the buyer sees while a purchase is in flight (F1, UX pass 2026-08-11).
 *
 * The rule this encodes: NEVER show a wait for a page the customer might not be
 * looking at. The checkout link is rendered every time — not only when the popup
 * was blocked — because a window can also be swallowed by a tab-switch, closed by
 * accident, or lost behind the app. A plain <a> works where window.open does not:
 * the tap is the user gesture, so no popup blocker applies.
 */
function CheckoutWaiting({ href, blocked, onCancel }) {
  return (
    <div style={{ marginTop: 14, padding: 16, borderRadius: 18, border: `1px solid ${blocked ? 'var(--acc-rim)' : 'var(--rim)'}`, background: 'var(--track)', boxShadow: 'var(--inset)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, textShadow: 'var(--emboss)' }}>
        {blocked ? 'Your browser blocked the checkout window' : 'Waiting for your purchase to confirm…'}
      </div>
      <div style={{ marginTop: 6, fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>
        {blocked
          ? 'That is a browser setting, not a problem with your card — use the link below.'
          : 'It opened in another tab. If you cannot see it, use the link below.'}
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer"
        style={{ ...primaryBtn, marginTop: 12, textDecoration: 'none' }}>
        Open the checkout page
      </a>
      <button onClick={onCancel} style={{ ...quietBtn, marginTop: 4 }}>Cancel</button>
      <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
        Premium unlocks by itself the moment your payment goes through — you do not need to come back here.
      </div>
    </div>
  );
}

const crown = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>
);

function fmtDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MembershipCard() {
  const S = useStore5();
  const [email, setEmail] = React.useState(readEmail() || '');
  const [pw, setPw] = React.useState('');
  const [stay, setStay] = React.useState(staySignedIn());
  const [code, setCode] = React.useState('');
  // out → confirm → sent → in. `confirm` exists because a mistyped address is
  // silently unrecoverable: the backend answers "we sent you a link" for any
  // address (correct — it stops strangers probing who has an account), so a typo
  // produces a confident success message and an email that never arrives.
  const [phase, setPhase] = React.useState(isSignedIn() ? 'in' : 'out');
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [waiting, setWaiting] = React.useState(false);
  // F1: the live checkout URL while a purchase is in flight, so it can always be
  // offered as a link, and whether the browser refused to open the window for us.
  const [checkoutHref, setCheckoutHref] = React.useState(null);
  const [popupBlocked, setPopupBlocked] = React.useState(false);

  // A sign-in can fail far from this card — a dead magic link lands on the Stack
  // screen. App5 parks the reason here so the account screen can show it.
  React.useEffect(() => {
    if (S.signInError) { setErr(S.signInError); setState({ signInError: null }); }
  }, [S.signInError]);

  const creating = S.accountMode === 'create' && !isSignedIn();

  const cache = readEntitlementCache();
  const periodEnd = fmtDate(cache?.currentPeriodEnd);

  const run = async (fn) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong.'); } finally { setBusy(false); }
  };

  // The main door. Everything else on this card is a way to get here.
  const pwRef = React.useRef(null);

  const onPasswordSignIn = () => run(async () => {
    try {
      const ent = await passwordSignIn(email, pw);
      applyServerEntitlement(ent);
      if (consumeNewAccount()) setState({ justCreated: true });
      await syncProfile();
      setPw(''); setPhase('in'); setMsg('Signed in.');
    } catch (e) {
      // Put the cursor back on the field that is wrong, so the fix is one tap
      // away and the error lands next to what it is about.
      try { pwRef.current?.focus(); } catch { /* noop */ }
      throw e;
    }
  });

  const onToggleStay = () => {
    const next = !stay;
    setStay(next);
    setStaySignedIn(next); // applies to the live session too, not just the next one
  };

  // Two steps on purpose (Wave 2 item 3). Step one only checks the address is
  // well-formed and shows it back; nothing is sent until the person confirms.
  const onAskLink = () => {
    setErr(null); setMsg(null);
    const clean = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setErr('Enter a valid email address.'); return; }
    setEmail(clean);
    setPhase('confirm');
  };

  const onSendLink = () => run(async () => {
    const r = await requestSignIn(email);
    if (r.completed) { await syncEntitlement(); await syncProfile(); setPhase('in'); setMsg('Signed in.'); }
    // The old copy said "paste the code", the email said "open this link", and
    // they were the same string — which is why people got stuck. As of the
    // backend's A2 (2026-08-04) the email carries a button AND a labelled code,
    // and lasts an hour. Say the same words the email says, and accept either
    // (extractLoginToken takes a whole pasted link too).
    else { setPhase('sent'); setMsg('We emailed you a sign-in link. Tap the button in it — or copy the code underneath the button and paste it below. It works for the next hour.'); }
  });

  const onCompleteCode = () => run(async () => {
    const ent = await completeSignIn(code, email);
    applyServerEntitlement(ent);
    if (consumeNewAccount()) setState({ justCreated: true });
    await syncProfile();
    setCode(''); setPhase('in'); setMsg('Signed in.');
  });

  /**
   * "Check membership" — always answer, in words.
   *
   * Vic tapped this on his own account and saw NOTHING change, and read the app
   * as broken. He was right to. It did set a message, but the Premium branch of
   * this card never rendered `msg` at all, so on a Premium account the button was
   * a no-op with a 200ms flicker. A check that reports nothing is worse than no
   * check: it teaches people the app is dead.
   *
   * Now: the button says "Checking…" while it works, and afterwards there is
   * always a line saying what the server said — including the date, so "checked"
   * cannot be confused with a stale answer from ten minutes ago.
   */
  const onRefresh = () => run(async () => {
    const ent = await fetchEntitlement();
    applyServerEntitlement(ent);
    if (ent.signedOut) { setPhase('out'); setErr('Your session has ended — please sign in again.'); return; }
    const until = fmtDate(readEntitlementCache()?.currentPeriodEnd);
    if (ent.premium) setMsg(until ? `Checked — Premium, active until ${until}.` : 'Checked — Premium is active.');
    else setMsg('Checked — you are on the Free plan. No payment has been picked up on this account.');
  });

  const onSignOut = () => { signOutMembership(); setPhase('out'); setCode(''); setMsg(null); setErr(null); };

  /**
   * Buy: open Gumroad with our user id attached, then watch for the webhook so
   * Premium flips without the user doing anything else.
   *
   * F1 (UX pass 2026-08-11) — THE MONEY PATH WAS A DEAD END. This threw away
   * window.open's return value, so the app could not tell whether the checkout
   * had actually opened. It flipped to "Waiting for your purchase to confirm…"
   * either way, the Go Premium button disappeared, and there was no link, no
   * cancel and no retry. On iPhone Safari — which blocks popups by default — a
   * customer holding a card sat on a spinner with no checkout anywhere and no way
   * forward. That is money lost at the last step, to a browser default.
   *
   * Now: the return value decides the copy, the checkout URL is ALWAYS rendered
   * as a real tappable link (a plain <a> navigates even when popups are blocked,
   * because the tap is the user gesture), and Cancel genuinely stops the poll.
   */
  const buyCancelled = React.useRef(false);

  const onBuy = () => {
    const url = checkoutUrl(GUMROAD_URL);
    if (!url) return;
    buyCancelled.current = false;

    let win = null;
    try { win = window.open(url, '_blank', 'noopener,noreferrer'); } catch { win = null; }
    const blocked = !win;

    setCheckoutHref(url);
    setPopupBlocked(blocked);
    setWaiting(true); setErr(null); setMsg(null);

    pollForPremium({ shouldStop: () => buyCancelled.current }).then((ent) => {
      if (buyCancelled.current) return;
      setWaiting(false); setCheckoutHref(null); setPopupBlocked(false);
      if (ent) { applyServerEntitlement(ent); setMsg('Premium unlocked. Enjoy.'); }
      else setMsg('Still waiting on confirmation. It can take a minute — tap “Check membership” once you’ve paid.');
    });
  };

  const onCancelBuy = () => {
    buyCancelled.current = true;
    setWaiting(false); setCheckoutHref(null); setPopupBlocked(false); setMsg(null);
  };

  /**
   * Wave 2 item 4 — say an account was made.
   *
   * The backend creates the account silently on first sight of an email, so
   * until now a customer signed in and was never told they now HAVE an account,
   * let alone that setting a password would spare them the next inbox trip.
   *
   * Shown only when the server confirms it (`isNewAccount`). If that flag is
   * missing — the backend half is not built yet — nobody is told an account was
   * created, because we would be guessing. The password nudge below stands on
   * its own and is true either way.
   */
  /**
   * Why the founder sees Premium without paying (Vic, 2026-08-06).
   *
   * `auth.ts` promotes every address on ADMIN_EMAILS to role:admin / paid on each
   * login, and the entitlement endpoint computes premium from that role. So Vic's
   * own account shows Premium with no purchase behind it, which reads exactly like
   * a billing bug when you are the person testing the billing. Naming it costs one
   * line and stops the founder's own view being misleading. Customers never see it.
   */
  const adminNote = isAdminGrant() ? (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', fontSize: 11.5, lineHeight: 1.5, color: 'var(--dim)' }}>
      <strong style={{ color: 'var(--ink)' }}>Premium (admin account).</strong> This is on because your
      address is on the staff list, not because a payment was found. A customer with the same account
      state would see the Free plan.
    </div>
  ) : null;

  const createdNote = S.justCreated ? (
    <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 18, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>
      <div style={{ fontSize: 14.5, fontWeight: 700, textShadow: 'var(--label-shadow)' }}>Your account is set up</div>
      <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.5, opacity: .95 }}>
        Set a password below and you can sign straight in next time, without waiting for an email.
      </div>
    </div>
  ) : null;

  // ── signed in + Premium ────────────────────────────────────────────────────
  if (phase === 'in' && S.premium) {
    return (
      <div style={card(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>{crown}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>Premium · active</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{readEmail() || 'Signed in'}</div>
          </div>
        </div>
        {adminNote}
        <div style={note()}>
          {periodEnd ? `Access runs to ${periodEnd}.` : 'Renews automatically.'} Manage or cancel from your Gumroad account.
        </div>
        {createdNote}
        <SetPasswordBlock defaultOpen={S.justCreated} />
        <button onClick={onRefresh} disabled={busy} style={quietBtn}>{busy ? 'Checking…' : 'Check membership'}</button>
        <button onClick={onSignOut} style={quietBtn}>Sign out</button>
        {/* This card never rendered `msg`, which is why "Check membership"
            looked dead on a Premium account. */}
        {msg && <div style={note()}>{msg}</div>}
        {err && <div style={{ ...note(), color: 'var(--bad, #c05)' }}>{err}</div>}
      </div>
    );
  }

  // ── signed in, not Premium → buy ───────────────────────────────────────────
  if (phase === 'in') {
    const url = checkoutUrl(GUMROAD_URL);
    return (
      <div style={card(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.2)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{crown}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>Free plan</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{readEmail() || 'Signed in'}</div>
          </div>
        </div>
        <div style={note(false)}>Premium adds unlimited stacks, saved routines and the full protocol library. {PREM_PRICE_FULL}.</div>
        {url && waiting ? (
          <CheckoutWaiting href={checkoutHref || url} blocked={popupBlocked} onCancel={onCancelBuy} />
        ) : url ? (
          <button onClick={onBuy} style={{ ...primaryBtn, marginTop: 14 }}>
            {`Go Premium · ${PREM_PRICE}/mo`}
          </button>
        ) : (
          <div style={{ marginTop: 14, minHeight: 50, borderRadius: 16, border: '1px dashed var(--hairline)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', textAlign: 'center', lineHeight: 1.45 }}>
            Premium isn’t on sale yet — it’s coming soon.
          </div>
        )}
        {createdNote}
        <SetPasswordBlock defaultOpen={S.justCreated} />
        <button onClick={onRefresh} disabled={busy} style={quietBtn}>{busy ? 'Checking…' : 'Check membership'}</button>
        <button onClick={onSignOut} style={quietBtn}>Sign out</button>
        {msg && <div style={note(false)}>{msg}</div>}
        {err && <div style={{ ...note(false), color: 'var(--bad, #c05)' }}>{err}</div>}
        <DevUnlock />
      </div>
    );
  }

  // ── confirm the address before anything is sent ────────────────────────────
  // Wave 2 item 3. The FULL address is shown, not a masked one: the whole job of
  // this step is spotting a typo, and "v…@gmail.com" hides the exact characters
  // that would be wrong. (The spec sketched it masked; masking defeats its own
  // stated purpose, so it is shown in full and flagged in the handoff.)
  if (phase === 'confirm') {
    return (
      <div style={card(false)}>
        <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>Is this right?</div>
        <div style={{ marginTop: 10, padding: '14px 16px', borderRadius: 16, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', fontSize: 15.5, fontWeight: 600, wordBreak: 'break-all' }}>
          {email}
        </div>
        <div style={note(false)}>
          We’ll send your sign-in link here. If a single letter is wrong the email simply never arrives —
          nothing will tell you, so it is worth a second look.
        </div>
        <button onClick={onSendLink} disabled={busy} style={{ ...primaryBtn, marginTop: 14, opacity: busy ? .6 : 1 }}>
          {busy ? 'Sending…' : 'Yes, send the link'}
        </button>
        <button onClick={() => { setPhase('out'); setMsg(null); setErr(null); }} style={quietBtn}>
          Change the address
        </button>
        {err && <div style={{ ...note(false), color: 'var(--bad, #c05)' }}>{err}</div>}
      </div>
    );
  }

  // ── signed out ─────────────────────────────────────────────────────────────
  return (
    <div style={card(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.2)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{crown}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>{creating ? 'Create your account' : 'Sign in'}</div>
          <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>
            {creating ? 'No password to invent — we email you a link' : 'Sign in to restore or buy Premium'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" style={input}
          onKeyDown={(e) => { if (e.key === 'Enter' && creating && email.trim()) onAskLink(); }}
        />

        {/* CREATING — no password field at all. A new account HAS no password
            (the backend makes one silently on first sight of an email), so
            offering the box here would hand every new customer the 401 dead end
            this wave exists to remove. */}
        {creating ? (
          <>
            <button onClick={onAskLink} disabled={busy || !email.trim()} style={{ ...primaryBtn, opacity: busy || !email.trim() ? .6 : 1 }}>
              Create my account
            </button>
            <div style={note(false)}>
              We’ll email you a link to finish. You can set a password afterwards, so next time you
              sign straight in.
            </div>
            <button onClick={() => setState({ accountMode: 'signin' })} style={quietBtn}>
              I already have an account
            </button>
          </>
        ) : (
          <>
            <input
              ref={pwRef}
              type="password" autoComplete="current-password" placeholder="Password"
              value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password"
              onKeyDown={(e) => { if (e.key === 'Enter' && pw && email) onPasswordSignIn(); }}
              style={{ ...input, ...(err ? { borderColor: 'var(--bad, #c05)' } : null) }}
            />
            {/* Directly under the field it is about — not at the foot of a
                scrolling card, where Vic never saw it. In the 'sent' phase the
                error belongs to the code box instead, so it moves down there. */}
            {phase !== 'sent' && <FieldError>{err}</FieldError>}

            {/* Wave 2 item 2 — ALWAYS visible, not only after a failure. Every new
                account starts with no password, and the server answers the same
                401 "invalid email or password" whether the password is wrong or
                was never set (it must not say which — that would confirm whether
                an address is registered). Without this line, a new customer meets
                a flat contradiction: their details are right, and the app says
                they are wrong. This one sentence is the whole fix. */}
            <div style={{ ...note(false), marginTop: 0 }}>
              New here, or never set a password? Use the email link below.
            </div>

            <button onClick={onToggleStay} role="checkbox" aria-checked={stay} aria-label="Keep me signed in"
              style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: 0, background: 'none', border: 'none', color: 'var(--ink)', textAlign: 'left' }}>
              <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1px solid ${stay ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: stay ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                {stay && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Keep me signed in</span>
            </button>

            <button onClick={onPasswordSignIn} disabled={busy || !email.trim() || !pw} style={{ ...primaryBtn, opacity: busy || !email.trim() || !pw ? .6 : 1 }}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <button onClick={onAskLink} disabled={busy || !email.trim()} style={{ ...quietBtn, marginTop: 2 }}>
              Email me a sign-in link instead
            </button>
            <button onClick={() => setState({ accountMode: 'create' })} style={quietBtn}>
              New here? Create an account
            </button>
          </>
        )}

        {phase === 'sent' && (
          <>
            <input
              type="text" inputMode="text" autoComplete="one-time-code"
              placeholder="Paste the link or code from your email"
              value={code} onChange={(e) => setCode(e.target.value)} aria-label="Sign-in link or code" style={input}
            />
            <button onClick={onCompleteCode} disabled={busy || !code.trim()} style={{ ...primaryBtn, opacity: busy || !code.trim() ? .6 : 1 }}>
              {creating ? 'Finish creating my account' : 'Sign in with the link'}
            </button>
            <FieldError>{err}</FieldError>
            {/* Wave 2 item 5 — "nothing arrived" used to be a dead end with no
                next move. Both real causes get an action. */}
            <div style={note(false)}>
              Nothing after a minute? Check your junk folder — and check the address above is exactly right.
            </div>
            <button onClick={onSendLink} disabled={busy} style={quietBtn}>Send it again</button>
            <button onClick={() => { setPhase('out'); setCode(''); setMsg(null); setErr(null); }} style={quietBtn}>
              Use a different address
            </button>
          </>
        )}
      </div>

      <div style={note(false)}>
        The app is free without an account — an account saves your membership and lets you sign in on
        another phone. Your stacks stay on this device either way.
      </div>
      {msg && <div style={note()}>{msg}</div>}
      {/* Errors from the PASSWORD path are rendered under that field instead —
          see FieldError. This foot position only carries errors from the
          emailed-link path, where there is no single field to sit beneath. */}
      {creating && phase !== 'sent' && <FieldError>{err}</FieldError>}
      <DevUnlock />
    </div>
  );
}

/**
 * Set (or change) the account password, so the next sign-in needs no inbox.
 *
 * Collapsed by default: for a signed-in user this is housekeeping, not the point
 * of the screen. There is deliberately no "you already have a password" state —
 * the backend exposes no way to ask, and guessing would be worse than saying
 * nothing, so the label covers both.
 */
function SetPasswordBlock({ accent, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // F8: seeded from storage, so the confirmation survives this card re-rendering
  // into another state (it used to revert to "Set a password" moments after).
  const [saved, setSaved] = React.useState(passwordSetHere);
  const [err, setErr] = React.useState(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await setPassword(pw);
      setPw(''); setSaved(true); setOpen(false);
    } catch (e) {
      setErr(e?.message || 'Could not save that password.');
    } finally { setBusy(false); }
  };

  const quiet = { ...quietBtn, ...(accent ? { color: 'rgba(255,255,255,.9)' } : null) };

  if (!open) {
    return (
      <>
        <button onClick={() => { setOpen(true); setSaved(false); }} style={quiet}>
          {saved ? 'Password saved · change it' : 'Set a password'}
        </button>
        {saved && <div style={note(accent)}>Saved. Next time you can sign in with your email and password — no waiting for an email.</div>}
      </>
    );
  }

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        type="password" autoComplete="new-password" placeholder={`New password (${PASSWORD_MIN}+ characters)`}
        value={pw} onChange={(e) => setPw(e.target.value)} aria-label="New password" style={input}
      />
      <button onClick={save} disabled={busy || pw.length < PASSWORD_MIN}
        style={{ ...primaryBtn, height: 46, opacity: busy || pw.length < PASSWORD_MIN ? .6 : 1 }}>
        {busy ? 'Saving…' : 'Save password'}
      </button>
      <button onClick={() => { setOpen(false); setPw(''); setErr(null); }} style={quiet}>Cancel</button>
      {err && <div style={{ ...note(accent), color: accent ? '#ffd9d9' : 'var(--bad, #c05)' }}>{err}</div>}
    </div>
  );
}

/**
 * Local-development unlock. Vite compiles import.meta.env.DEV to `false` for the
 * production build, so this renders nowhere on the live site — it exists purely so
 * the app can be worked on before the backend is deployed. This is the deliberate
 * replacement for the old always-shipped Premium toggle.
 */
function DevUnlock() {
  if (!devPremiumAvailable()) return null;
  const S = useStore5();
  return (
    <button
      onClick={() => { setDevPremium(!S.premium); applyServerEntitlement({ premium: !S.premium }); }}
      style={{ ...quietBtn, marginTop: 4, fontSize: 12, opacity: .75 }}
    >
      dev-only: {S.premium ? 'lock' : 'unlock'} Premium locally
    </button>
  );
}
