// UpsellModal — company-licence gate.
//
// Shown whenever a full-access action fires (state.premiumUpsell holds the
// reason). There is no public checkout. The way forward is a company licence,
// or signing in as staff who already have one.

import React from 'react';
import { useStore5, clearUpsell, openAccount, FREE_STACK_CAP, FREE_CAP_UPSELL, onlyExamplesLeft, clearExamples } from '../store5.js';
import { isSignedIn } from '../membership.js';
import LicenseNotice from './LicenseNotice.jsx';

const tick = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
);

export default function UpsellModal() {
  const S = useStore5();
  if (!S.premiumUpsell) return null;

  // ONE THING AT A TIME. Consent first, then the account moment, then this.
  // The reason stays in state so it appears once those are done.
  if (!S.onboarded || S.accountOpen) return null;

  const signedIn = isSignedIn();

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 47, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={clearUpsell} style={{ position: 'absolute', inset: 0, background: 'rgba(20,26,38,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 344, borderRadius: 28, padding: '28px 24px 22px', textAlign: 'center', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both' }}>
        <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>
        </span>
        <div style={{ marginTop: 14, fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Company licence</div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>{S.premiumUpsell}</p>

        {S.premiumUpsell === FREE_CAP_UPSELL && (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>
              The preview keeps up to {FREE_STACK_CAP} things, and the example cards count. Clearing them frees their slots.
            </p>
            {onlyExamplesLeft() && (
              <button onClick={() => { clearExamples(); clearUpsell(); }}
                style={{ marginTop: 12, width: '100%', minHeight: 46, borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600 }}>
                Clear the examples
              </button>
            )}
          </>
        )}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>{tick}Routines — chain many items into one stack</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>{tick}Unlimited stacks (the preview is capped at {FREE_STACK_CAP})</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>{tick}Drop a saved routine onto any day in one tap</div>
        </div>
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          <LicenseNotice
            heading="Licensed per company"
            detail="For the staff of a licensed organisation. Contact Peak Performance Wellness to arrange access — there is nothing to buy here."
          />
        </div>
        {!signedIn && (
          <button
            onClick={() => openAccount('signin')}
            style={{ marginTop: 8, width: '100%', height: 44, background: 'none', border: 'none', color: 'var(--ink)', fontSize: 14, fontWeight: 700 }}
          >
            Staff sign in
          </button>
        )}
        <button onClick={clearUpsell} style={{ marginTop: 6, width: '100%', height: 44, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 14, fontWeight: 600 }}>Not now</button>
      </div>
    </div>
  );
}
