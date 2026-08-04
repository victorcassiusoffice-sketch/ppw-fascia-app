// AccountSheet — the app's Account screen, reachable from the Stack header and
// from Settings → Membership.
//
// It began as a sign-in entry point and nothing else. Vic, 2026-08-04: "there is
// no set password, keep logged in, add passkey etc. It's not a professional
// normal app, it's random and lacks professional structure." He was describing
// what was ABSENT — the app had magic-link sign-in and no account surface at all,
// so there was nowhere for any of that furniture to live. This is that surface.
//
// It renders the SAME MembershipCard the Settings screen renders, so there is
// still exactly one auth flow in the app, and adds the account rows around it.

import React from 'react';
import { useStore5, closeAccount, signOutMembership } from '../store5.js';
import { readEmail, staySignedIn, setStaySignedIn, deleteAccount } from '../membership.js';
import MembershipCard from './MembershipCard.jsx';

const row = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 12, minHeight: 58,
  padding: '14px 16px', borderRadius: 18, textAlign: 'left',
  background: 'var(--surface)', border: '1px solid var(--rim)', color: 'var(--ink)',
  boxShadow: 'var(--elev)',
};
const rowTitle = { fontSize: 14.5, fontWeight: 600, textShadow: 'var(--emboss)' };
const rowNote = { marginTop: 2, fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' };
const sectionNote = { margin: '12px 2px 0', fontSize: 11.5, lineHeight: 1.6, color: 'var(--dim)' };

export default function AccountSheet() {
  const S = useStore5();
  const [stay, setStay] = React.useState(staySignedIn());
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  if (!S.accountOpen) return null;
  const signedIn = S.signedIn;
  const email = readEmail();

  const onToggleStay = () => { const v = !stay; setStay(v); setStaySignedIn(v); };

  const onDelete = async () => {
    setBusy(true); setErr(null);
    try {
      await deleteAccount();
      signOutMembership();
      setConfirmDelete(false);
      closeAccount();
    } catch (e) {
      setErr(e?.message || 'Could not delete the account. Try again in a moment.');
    } finally { setBusy(false); }
  };

  // z-index 42 sits ABOVE the onboarding wizard (40). Below that, a returning user
  // could not sign in without first completing setup again: the wizard covers the
  // whole screen, so this sheet opened underneath it and was never seen. Terms (50)
  // and the coach marks (60) still sit above.
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 42 }}>
      <div onClick={closeAccount} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxHeight: '78%', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.5" r="3.6" /><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" /></svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{signedIn ? 'Your account' : 'Sign in'}</div>
            {/* Who you are, permanently on screen — before this, a signed-in user
                had no way to tell they were signed in. */}
            <div style={{ fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {signedIn ? (email ? `Signed in as ${email}` : 'Signed in') : 'Email and password, or a link by email'}
            </div>
          </div>
          <button onClick={closeAccount} aria-label="Close" style={{ width: 34, height: 34, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <MembershipCard />

        {signedIn && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={onToggleStay} role="checkbox" aria-checked={stay} aria-label="Keep me signed in on this device" style={row}>
              <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 9, border: `1px solid ${stay ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: stay ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                {stay && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', ...rowTitle }}>Keep me signed in</span>
                <span style={{ display: 'block', ...rowNote }}>{stay ? 'Stays signed in on this device.' : 'Signs out when you close the app.'}</span>
              </span>
            </button>

            {!confirmDelete ? (
              <button onClick={() => { setConfirmDelete(true); setErr(null); }} style={{ ...row, color: 'var(--bad, #c05)' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', ...rowTitle }}>Delete my account</span>
                  <span style={{ display: 'block', ...rowNote }}>Removes your account from our server for good.</span>
                </span>
              </button>
            ) : (
              <div style={{ ...row, display: 'block' }}>
                <div style={rowTitle}>Delete this account?</div>
                <div style={{ ...rowNote, marginTop: 6 }}>
                  This permanently removes your account and your membership record from our server. It cannot be undone.
                  {' '}<strong style={{ color: 'var(--ink)' }}>It does not cancel your subscription</strong> — cancel that on
                  Gumroad first, or you will keep being charged. The stacks saved on this device stay on this device.
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDelete(false)} disabled={busy} style={{ flex: 1, height: 44, borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontWeight: 600, fontSize: 13.5 }}>
                    Keep it
                  </button>
                  <button onClick={onDelete} disabled={busy} style={{ flex: 1, height: 44, borderRadius: 14, border: '1px solid var(--bad, #c05)', background: 'var(--bad, #c05)', color: '#fff', fontWeight: 700, fontSize: 13.5, opacity: busy ? .6 : 1 }}>
                    {busy ? 'Deleting…' : 'Delete for good'}
                  </button>
                </div>
                {err && <div style={{ ...rowNote, color: 'var(--bad, #c05)' }}>{err}</div>}
              </div>
            )}
          </div>
        )}

        {/* Said out loud, deliberately. Silence about how sign-in works is what
            made a finished design read as an unfinished one. */}
        <div style={sectionNote}>
          Sign in with your email and password, or with a link we email you — whichever suits.
          Passkeys are coming. Your password is stored scrambled, so it cannot be read back out
          of our database by anyone, including us.
        </div>
      </div>
    </div>
  );
}
