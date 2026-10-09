// GateNotice — what a person sees when a gate turns an action down.
//
// WAS "UpsellModal", and was a shop window: a crown, a feature tick-list, $9.99 a
// month and a Go Premium button into Gumroad checkout. Vic removed the Go Premium
// surfaces on 2026-10-08 — the app is behind an access code with a confidentiality
// agreement now, so everyone who reaches it already has everything, and a card
// offering to sell them that would be charging for what they were handed.
//
// WHAT IS LEFT IS THE EXPLANATION, and that was worth keeping. Flip PREMIUM_OPEN
// back to false (membership.js) and the gates in store5.js bite again; without
// this card they would refuse in silence, which is the worst possible paywall — an
// action that does nothing, with no reason given. So this renders the store's own
// refusal sentence plus the one remedy that costs nothing (clearing the example
// cards frees their slots), and offers no way to pay for anything.
//
// On the shipped build it renders nothing at all: no gate can refuse while the
// switch is open.

import React from 'react';
import { useStore5, clearUpsell, FREE_STACK_CAP, freeSlotAdviceApplies, onlyExamplesLeft, clearExamples } from '../store5.js';
import { PREMIUM_OPEN } from '../membership.js';

export default function GateNotice() {
  const S = useStore5();

  /**
   * NOTHING CAN BE REFUSED (PREMIUM_OPEN, membership.js — Vic, 2026-10-05).
   *
   * Checked before `premiumUpsell`, not after: no gate should be able to set that
   * reason any more (they all route through premiumGated()), and if one ever does
   * — a stale view, a future caller — a refusal must not be what the user meets on
   * a build where they are entitled to the lot.
   */
  if (PREMIUM_OPEN) return null;

  if (!S.premiumUpsell) return null;

  // ONE THING AT A TIME (Vic, 2026-08-06: account sheet + terms + this, all in the
  // first seconds of signing in). Order of right-of-way: consent first, because it
  // is legally required and blocks everything; then the account moment; then this.
  // The reason is NOT dropped — it stays in state, so it arrives on the next beat,
  // once the user is not being spoken to from three directions at once.
  if (!S.onboarded || S.accountOpen) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 47, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={clearUpsell} style={{ position: 'absolute', inset: 0, background: 'rgba(20,26,38,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'ppwFade .3s ease both' }} />
      <div role="alertdialog" aria-label="Not on your plan" style={{ position: 'relative', width: '100%', maxWidth: 344, borderRadius: 28, padding: '28px 24px 22px', textAlign: 'center', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both' }}>
        {/* A plain mark, not the crown. The crown was the Premium badge, and this
            card no longer belongs to something being sold — it reports a limit. */}
        <span aria-hidden="true" style={{ display: 'inline-flex', width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8.2v.4M12 11.6V16" /></svg>
        </span>
        <div style={{ marginTop: 14, fontSize: 21, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Not on your plan</div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>{S.premiumUpsell}</p>

        {/* THE CAP COUNTS OUR OWN EXAMPLE CARDS. Four of the ten slots a capped
            user gets were filled by us before they arrived, and being told "you
            have reached the limit" without being told that reads as a much
            smaller allowance than it is. Said here because THIS is the refusal
            point — the moment the add was turned down.

            The gate is freeSlotAdviceApplies(), not `=== FREE_CAP_UPSELL`
            (2026-10-05, review pass): a 20-stack programme against a 10-stack
            cap was shown this advice and the button under it, and clearing four
            example cards cannot make room for twenty. The tap emptied the
            starter deck, read as the problem being solved, and the retry failed
            the same way with the remedy now gone. The store answers whether
            freeing slots can actually help.

            This is the one thing on the card that ACTS, and that is deliberate:
            it is a way out of the refusal that costs the person nothing — the
            opposite of the checkout button that used to sit below it. */}
        {freeSlotAdviceApplies(S) && (
          <>
            <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>
              Your plan keeps up to {FREE_STACK_CAP} things, and the example cards count. Clearing them frees their slots.
            </p>
            {onlyExamplesLeft() && (
              <button onClick={() => { clearExamples(); clearUpsell(); }}
                style={{ marginTop: 12, width: '100%', minHeight: 46, borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 13.5, fontWeight: 600 }}>
                Clear the examples
              </button>
            )}
          </>
        )}

        {/* THE SELL LIVED BETWEEN HERE AND THE CLOSE BUTTON, and all of it went on
            2026-10-08: a tick-list of paid features, "$9.99 / month", "from
            $4.99/mo billed yearly", a "Sign in first — Premium attaches to an
            account" line, the Go Premium link into Gumroad checkout, and a dashed
            "Premium isn't on sale yet" placeholder left over from before the
            product existed. Nothing replaced them. The person is told why the
            action stopped, and that is the end of the conversation. */}
        <button onClick={clearUpsell} style={{ marginTop: 16, width: '100%', height: 48, borderRadius: 16, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 14.5, fontWeight: 600 }}>Close</button>
      </div>
    </div>
  );
}
