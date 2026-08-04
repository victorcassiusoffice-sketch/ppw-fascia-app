// AccountSheet — the sign-in surface, reachable from the Stack header.
//
// Sign-in already worked, but the only way to reach it was the paywall or
// Settings → Membership, so a signed-out user had no visible way in. This sheet
// adds the entry point and nothing else: it renders the SAME MembershipCard the
// Settings screen renders, so there is exactly one auth flow in the app.

import React from 'react';
import { useStore5, closeAccount } from '../store5.js';
import MembershipCard from './MembershipCard.jsx';

export default function AccountSheet() {
  const S = useStore5();
  if (!S.accountOpen) return null;
  const signedIn = S.signedIn;

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
            <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>{signedIn ? 'Membership and sign-out' : 'Email and password, or a link by email'}</div>
          </div>
          <button onClick={closeAccount} aria-label="Close" style={{ width: 34, height: 34, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <MembershipCard />
      </div>
    </div>
  );
}
