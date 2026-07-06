// UpsellModal — New Design "Premium feature" paywall (faithful port).
//
// Shown whenever a Premium-gated action fires (state.premiumUpsell holds the
// reason). "Enable Premium" flips the same premium flag the Settings toggle
// uses — this is the button a real Gumroad checkout replaces later.

import React from 'react';
import { useStore5, clearUpsell, setPremium } from '../store5.js';

const PREM_PRICE = '$4.99';

const tick = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}><path d="M20 6 9 17l-5-5" /></svg>
);

export default function UpsellModal() {
  const S = useStore5();
  if (!S.premiumUpsell) return null;

  const enable = () => { setPremium(true); clearUpsell(); };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 47, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={clearUpsell} style={{ position: 'absolute', inset: 0, background: 'rgba(20,26,38,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 344, borderRadius: 28, padding: '28px 24px 22px', textAlign: 'center', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both' }}>
        <span style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>
        </span>
        <div style={{ marginTop: 14, fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Premium feature</div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>{S.premiumUpsell}</p>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9, textAlign: 'left' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>{tick}Routines — chain many items into one stack</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>{tick}Unlimited stacks (free is capped at 10)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--ink)' }}>{tick}Always-on Assistant in the corner</div>
        </div>
        <div style={{ marginTop: 18, fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{PREM_PRICE} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dim)' }}>/ month</span></div>
        {/* GUMROAD SEAM: replace this button's action with the real checkout/redeem
            flow; on verified purchase call setPremium(true). */}
        <button onClick={enable} style={{ marginTop: 14, width: '100%', height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Enable Premium (test)</button>
        <button onClick={clearUpsell} style={{ marginTop: 6, width: '100%', height: 44, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 14, fontWeight: 600 }}>Not now</button>
      </div>
    </div>
  );
}
