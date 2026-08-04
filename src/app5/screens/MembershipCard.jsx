// MembershipCard — Settings → Membership.
//
// Replaces the old manual "Premium" toggle, which was a switch anyone could flip
// to unlock the paid features for free. Membership is now an account: sign in,
// and the server says whether you're Premium.
//
// Free users never need this screen — the app works signed-out exactly as before.
// Signing in only matters for Premium.

import React from 'react';
import { useStore5, syncEntitlement, signOutMembership, applyServerEntitlement } from '../store5.js';
import {
  GUMROAD_URL, PREM_PRICE, PREM_PRICE_FULL,
  requestSignIn, completeSignIn, fetchEntitlement, readEmail, isSignedIn,
  checkoutUrl, pollForPremium, readEntitlementCache,
  setDevPremium, devPremiumAvailable,
  passwordSignIn, setPassword, PASSWORD_MIN, staySignedIn, setStaySignedIn,
} from '../membership.js';

const card = (accent) => ({
  position: 'relative', marginTop: 12, borderRadius: 24, overflow: 'hidden', padding: 18,
  background: accent ? 'var(--acc-surf)' : 'var(--surface)',
  border: `1px solid ${accent ? 'var(--acc-rim)' : 'var(--rim)'}`,
  boxShadow: 'var(--elev)',
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
const note = (accent) => ({
  marginTop: 12, fontSize: 11.5, lineHeight: 1.55,
  color: accent ? 'rgba(255,255,255,.82)' : 'var(--dim)',
});

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
  const [phase, setPhase] = React.useState(isSignedIn() ? 'in' : 'out'); // out | sent | in
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [waiting, setWaiting] = React.useState(false);

  const cache = readEntitlementCache();
  const periodEnd = fmtDate(cache?.currentPeriodEnd);

  const run = async (fn) => {
    setBusy(true); setErr(null); setMsg(null);
    try { await fn(); } catch (e) { setErr(e?.message || 'Something went wrong.'); } finally { setBusy(false); }
  };

  // The main door. Everything else on this card is a way to get here.
  const onPasswordSignIn = () => run(async () => {
    const ent = await passwordSignIn(email, pw);
    applyServerEntitlement(ent);
    setPw(''); setPhase('in'); setMsg('Signed in.');
  });

  const onToggleStay = () => {
    const next = !stay;
    setStay(next);
    setStaySignedIn(next); // applies to the live session too, not just the next one
  };

  const onSendLink = () => run(async () => {
    const r = await requestSignIn(email);
    if (r.completed) { await syncEntitlement(); setPhase('in'); setMsg('Signed in.'); }
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
    setCode(''); setPhase('in'); setMsg('Signed in.');
  });

  const onRefresh = () => run(async () => {
    const ent = await fetchEntitlement();
    applyServerEntitlement(ent);
    if (ent.signedOut) { setPhase('out'); setErr('Your session expired — please sign in again.'); return; }
    setMsg(ent.premium ? 'Premium is active.' : 'No active membership on this account yet.');
  });

  const onSignOut = () => { signOutMembership(); setPhase('out'); setCode(''); setMsg(null); setErr(null); };

  // Buy: open Gumroad in a new tab with our user id attached, then watch for the
  // webhook to land so Premium flips without the user doing anything else.
  const onBuy = () => {
    const url = checkoutUrl(GUMROAD_URL);
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
    setWaiting(true); setErr(null); setMsg('Waiting for your purchase to confirm…');
    pollForPremium().then((ent) => {
      setWaiting(false);
      if (ent) { applyServerEntitlement(ent); setMsg('Premium unlocked. Enjoy.'); }
      else setMsg('Still waiting on confirmation. It can take a minute — tap “Check membership” once you’ve paid.');
    });
  };

  // ── signed in + Premium ────────────────────────────────────────────────────
  if (phase === 'in' && S.premium) {
    return (
      <div style={card(true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.2)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)' }}>{crown}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--acc-ink)', textShadow: 'var(--emboss)' }}>Premium · active</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'rgba(255,255,255,.82)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{readEmail() || 'Signed in'}</div>
          </div>
        </div>
        <div style={note(true)}>
          {periodEnd ? `Access runs to ${periodEnd}.` : 'Renews automatically.'} Manage or cancel from your Gumroad account.
        </div>
        <SetPasswordBlock accent />
        <button onClick={onRefresh} disabled={busy} style={{ ...quietBtn, color: 'rgba(255,255,255,.9)' }}>{busy ? 'Checking…' : 'Check membership'}</button>
        <button onClick={onSignOut} style={{ ...quietBtn, color: 'rgba(255,255,255,.7)' }}>Sign out</button>
        {err && <div style={{ ...note(true), color: '#ffd9d9' }}>{err}</div>}
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
        {url ? (
          <button onClick={onBuy} disabled={waiting} style={{ ...primaryBtn, marginTop: 14, opacity: waiting ? .6 : 1 }}>
            {waiting ? 'Waiting for confirmation…' : `Go Premium · ${PREM_PRICE}/mo`}
          </button>
        ) : (
          <div style={{ marginTop: 14, minHeight: 50, borderRadius: 16, border: '1px dashed var(--hairline)', color: 'var(--dim)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', textAlign: 'center', lineHeight: 1.45 }}>
            Premium isn’t on sale yet — it’s coming soon.
          </div>
        )}
        <SetPasswordBlock />
        <button onClick={onRefresh} disabled={busy} style={quietBtn}>{busy ? 'Checking…' : 'Check membership'}</button>
        <button onClick={onSignOut} style={quietBtn}>Sign out</button>
        {msg && <div style={note(false)}>{msg}</div>}
        {err && <div style={{ ...note(false), color: 'var(--bad, #c05)' }}>{err}</div>}
        <DevUnlock />
      </div>
    );
  }

  // ── signed out ─────────────────────────────────────────────────────────────
  return (
    <div style={card(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.2)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>{crown}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>Membership</div>
          <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>Sign in to restore or buy Premium</div>
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email address" style={input}
        />
        <input
          type="password" autoComplete="current-password" placeholder="Password"
          value={pw} onChange={(e) => setPw(e.target.value)} aria-label="Password" style={input}
          onKeyDown={(e) => { if (e.key === 'Enter' && pw && email) onPasswordSignIn(); }}
        />

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

        {/* The backup door, and the way in for anyone who has no password yet. */}
        <button onClick={onSendLink} disabled={busy || !email.trim()} style={{ ...quietBtn, marginTop: 2 }}>
          No password yet, or forgotten it? Email me a sign-in link
        </button>

        {phase === 'sent' && (
          <>
            <input
              type="text" inputMode="text" autoComplete="one-time-code"
              placeholder="Paste the link or code from your email"
              value={code} onChange={(e) => setCode(e.target.value)} aria-label="Sign-in link or code" style={input}
            />
            <button onClick={onCompleteCode} disabled={busy || !code.trim()} style={{ ...primaryBtn, opacity: busy || !code.trim() ? .6 : 1 }}>
              Sign in with the link
            </button>
          </>
        )}
      </div>

      <div style={note(false)}>
        The app is free without an account — signing in only matters for Premium. Your stacks stay on this device either way.
        Once you are in, you can set a password from this screen.
      </div>
      {msg && <div style={note(false)}>{msg}</div>}
      {err && <div style={{ ...note(false), color: 'var(--bad, #c05)' }}>{err}</div>}
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
function SetPasswordBlock({ accent }) {
  const [open, setOpen] = React.useState(false);
  const [pw, setPw] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
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
