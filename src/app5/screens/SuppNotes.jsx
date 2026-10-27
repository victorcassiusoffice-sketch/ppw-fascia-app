// SuppNotes — the warnings that go with every supplement PPW lists.
//
// Victor, 27 Oct 2026 (V-SUPPS-DISCLAIMERS-1027), asked whether the supplements
// nobody has checked against the research yet should be hidden: "We maximise on
// disclaimers for this." So they stay on show, and these pieces go wherever one
// appears:
//
//   SuppsNotice     — the top of the Supps tab, always open, never collapsed
//   NotCheckedLabel — on every supplement PPW has not cleared, on its row and
//                     on its detail view (the Stack card and the viewer too)
//   ShopLinkNote    — beside every button or link that opens a shop: it opens
//                     the shop, outside the app; PPW does not sell the product;
//                     and, only when the link really carries a referral code,
//                     that PPW may earn a small commission
//
// The words live here, once, so the Supps tab, the Stack and the viewer cannot
// drift apart. Whether a label or the commission sentence shows is read from
// the manifest (lib/suppsAffiliates.js), never hard-coded: a supplement cleared
// in ppw-affiliates loses its label with no change here.
//
// Plain words on purpose: short sentences, no claim about what any supplement
// does, no price, no amount. Ink colour, not the dim one, because a warning has
// to be read, including at Settings → Bigger text on a 360px phone.

import React from 'react';
import { suppUnchecked, linksCarryReferral, shopName } from '../../lib/suppsAffiliates.js';

export const NOT_CHECKED = 'Not checked yet';
export const COMMISSION_LINE = 'PPW may earn a small commission if you buy.';
export const INFO_LINE = 'This is not medical advice.';
export const DOCTOR_LEAD = 'Speak to your doctor or pharmacist before you take any supplement, above all if you:';
export const DOCTOR_CASES = [
  'take medicines or hormone treatment',
  'are pregnant or breastfeeding',
  'are under 18',
  'have a health condition',
];

const IAlert = (size) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
    <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" />
  </svg>
);

/**
 * "Not checked yet" — a status, not a control. Ink on the track colour with a
 * rim, so it never reads as a tick box or a button. `compact` drops the glyph
 * and lets the words wrap, for the Stack card's narrow column (about 110px at
 * 360px with Bigger text).
 */
export function NotCheckedLabel({ compact = false, style }) {
  return (
    <span
      data-supp-unchecked=""
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%',
        // compact may wrap onto two or three lines in a narrow card: a soft
        // rectangle stays a tidy tag there, where a full pill turns into a blob
        padding: compact ? '2px 7px' : '2px 8px', borderRadius: compact ? 8 : 999,
        border: '1px solid var(--rim)', background: 'var(--track)', color: 'var(--ink)',
        fontSize: compact ? 10.5 : 11, lineHeight: 1.35, fontWeight: 700,
        whiteSpace: compact ? 'normal' : 'nowrap', overflowWrap: 'anywhere',
        ...style,
      }}
    >
      {!compact && IAlert(11)}
      {NOT_CHECKED}
    </span>
  );
}

/**
 * The leave-the-app sentence. `lead` names the thing being tapped ("This
 * button", "Each link", "This link"); `single` says "this product" instead of
 * "these products".
 */
export function leaveAppText(urls, { lead = 'This link', single = false } = {}) {
  const shops = [...new Set((urls || []).filter(Boolean).map(shopName))];
  const where = shops.length ? shops.join(' or ') : 'another website';
  return `${lead} opens ${where}, outside the app. PPW does not sell ${single ? 'this product' : 'these products'}.`;
}

/**
 * The line beside a shop button or link. The commission sentence appears only
 * when one of the links carries an affiliate or referral code; with none, the
 * line says nothing about commission at all.
 */
export function ShopLinkNote({ id, urls, lead, single = false, align = 'left', style }) {
  const commission = linksCarryReferral(urls);
  return (
    <div id={id} data-shop-note="" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink)', textAlign: align, ...style }}>
      <span data-leave-app="">{leaveAppText(urls, { lead, single })}</span>
      {commission && <>{' '}<span data-commission="">{COMMISSION_LINE}</span></>}
    </div>
  );
}

/**
 * The notice at the top of the Supps tab. Always shown, never collapsed. The
 * first sentence follows the data: every supplement held → "these
 * supplements"; some → the ones wearing the label; none → it is left out
 * rather than becoming untrue.
 */
export function SuppsNotice({ supps }) {
  const list = supps || [];
  const held = list.filter(suppUnchecked).length;
  const allHeld = list.length > 0 && held === list.length;
  const heading = allHeld ? NOT_CHECKED : held ? 'Some are not checked yet' : 'Please read';
  const first = allHeld
    ? 'PPW has not yet checked these supplements against the research.'
    : held ? `PPW has not yet checked the supplements marked “${NOT_CHECKED}” against the research.` : null;
  const P = { margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5 };
  return (
    <section
      role="note"
      aria-label="About these supplements"
      data-supps-notice=""
      style={{ position: 'relative', padding: '14px 16px 15px', borderRadius: 18, border: '1px solid var(--acc-rim)', background: 'var(--surface-strong)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', boxShadow: 'var(--elev)', color: 'var(--ink)' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
        {IAlert(18)}
        <h2 style={{ margin: 0, fontSize: 15.5, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{heading}</h2>
      </div>
      {first && <p style={P}>{first}</p>}
      <p style={P}>{first ? 'They are' : 'These supplements are'} listed for information only. {INFO_LINE}</p>
      <p style={P}>{DOCTOR_LEAD}</p>
      <ul style={{ margin: '4px 0 0', paddingLeft: 20, listStyle: 'disc', fontSize: 13.5, lineHeight: 1.5 }}>
        {DOCTOR_CASES.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </section>
  );
}
