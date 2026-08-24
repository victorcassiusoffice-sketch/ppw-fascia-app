// SuppsSection — New Design Library "Supps" tab (Vic item 4).
//
// User-friendly + uncluttered supplement multi-select with the HONEST iHerb buy
// flow (no multi-add cart URL exists): "Shop on iHerb" opens the FIRST selected
// item (sets iHerb's 7-day affiliate cookie), then shows the rest as an
// "add these too" tap-list — every item added in that session is attributed.
//
// All commission wording is gated behind affiliate_live (currently false → no
// cash-commission claim). Per-supp Add to Stack reuses the item-2 calendar
// picker. Supps are grouped by protocol for context.

import React from 'react';
import { useStore5, openSchedule } from '../store5.js';
import { suppsGroupedByProtocol, buyUrl, affiliateLive, suppToStackItem } from '../../lib/suppsAffiliates.js';

const PROTOCOL_LABEL = {
  'testosterone-optimisation-v1': 'Testosterone Optimisation',
  'testosterone_standard_v1': 'Testosterone (Standard)',
};
const labelFor = (id) => PROTOCOL_LABEL[id] || id.replace(/[-_]+/g, ' ').replace(/\bv\d+\b/i, '').trim();

function Disclaimer() {
  const [open, setOpen] = React.useState(false);
  const live = affiliateLive();
  return (
    <div style={{ marginTop: 14, borderRadius: 18, border: '1px solid var(--hairline)', background: 'var(--track)', overflow: 'hidden' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'none', border: 'none', color: 'var(--ink)', textAlign: 'left' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color: 'var(--dim)' }}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' }}>Important — please read before buying</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color: 'var(--dim)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', fontSize: 11.5, lineHeight: 1.55, color: 'var(--dim)', animation: 'ppwRise .25s ease both' }}>
          <p style={{ margin: 0 }}>Educational info from Peak Performance Wellness — not medical advice, not a diagnosis or treatment. Talk to a qualified professional before starting any supplement (especially if pregnant, nursing, on medication, or unwell). PPW isn’t responsible for products bought from third-party retailers.</p>
          <p style={{ margin: '8px 0 0' }}>
            {live
              ? 'Affiliate links: buy through them and your price is unchanged; PPW earns a small commission that funds the next protocol. We don’t stock or sell these ourselves.'
              : 'These links go to iHerb; our code may give you a discount. We’re still setting up our affiliate account, so we don’t yet earn on these purchases.'}
          </p>
        </div>
      )}
    </div>
  );
}

function SuppRow({ s, checked, onToggle, protocolId }) {
  const disabled = s.in_stock === false;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, border: `1px solid ${checked && !disabled ? 'var(--acc-rim)' : 'var(--rim)'}`, background: 'var(--surface)', boxShadow: 'var(--elev)', opacity: disabled ? 0.5 : 1 }}>
      <button
        onClick={() => !disabled && onToggle(s.id)}
        role="checkbox" aria-checked={checked && !disabled} aria-label={`Select ${s.name}`} disabled={disabled}
        style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1.5px solid ${checked && !disabled ? 'var(--acc-rim)' : 'var(--rim)'}`, background: checked && !disabled ? 'var(--acc-surf)' : 'transparent', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: disabled ? 'default' : 'pointer' }}>
        {checked && !disabled && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{s.name}</div>
        <div style={{ marginTop: 2, fontSize: 12, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {disabled ? 'Currently unavailable on iHerb' : [s.brand, s.brand_spec].filter(Boolean).join(' · ')}
        </div>
      </div>
      <button onClick={() => openSchedule({ type: 'item', item: suppToStackItem(s, protocolId) })} aria-label={`Add ${s.name} to a day`} title="Add to Stack on a day"
        style={{ width: 38, height: 38, flex: 'none', borderRadius: 11, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3M12 13v4M10 15h4" /></svg>
      </button>
    </div>
  );
}

export default function SuppsSection({ query = '' }) {
  useStore5(); // subscribe (re-render on premium/theme changes)
  const groups = suppsGroupedByProtocol();
  // Nothing starts ticked. A pre-ticked basket of 14 supplements is a sales pitch the
  // user did not ask for, on a screen they opened to look around — it made "Shop 14 on
  // iHerb" the first thing a novice read. The list is theirs to build, one tick at a time.
  const [selected, setSelected] = React.useState(() => new Set());
  const [shopList, setShopList] = React.useState(null); // the "add these too" reveal

  if (!groups.length) {
    return (
      <div style={{ marginTop: 18, borderRadius: 24, padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>Supplements</div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>Protocol supplements will appear here as they’re approved.</div>
      </div>
    );
  }

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const q = query.trim().toLowerCase();

  // selected supplements in list order across all groups (in-stock only)
  const orderedSelected = [];
  for (const g of groups) for (const s of g.supps) if (selected.has(s.id) && s.in_stock !== false && !orderedSelected.find((x) => x.id === s.id)) orderedSelected.push(s);
  const n = orderedSelected.length;

  const shop = () => {
    if (!n) return;
    try { window.open(buyUrl(orderedSelected[0]), '_blank', 'noopener'); } catch { /* popup blocked */ }
    setShopList(orderedSelected.slice(1));
  };

  return (
    <div style={{ marginTop: 18 }}>
      <Disclaimer />

      {groups.map((g) => {
        const rows = g.supps.filter((s) => !q || s.name.toLowerCase().includes(q) || (s.brand || '').toLowerCase().includes(q));
        if (!rows.length) return null;
        return (
          <div key={g.protocolId} style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{labelFor(g.protocolId)}</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((s) => <SuppRow key={s.id} s={s} protocolId={g.protocolId} checked={selected.has(s.id)} onToggle={toggle} />)}
            </div>
          </div>
        );
      })}

      {/* Shop the selection on iHerb (honest single-open + add-these-too) */}
      <button onClick={shop} disabled={!n}
        style={{ marginTop: 18, width: '100%', height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', opacity: n ? 1 : 0.45, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.4 12.5a1.5 1.5 0 0 0 1.5 1.2h8.2a1.5 1.5 0 0 0 1.5-1.2L21.5 7H6" /></svg>
        {/* With nothing ticked the button says what the Supps hint says, word for word,
            so the screen only ever teaches one sentence for this idea. */}
        {n ? `Shop ${n} on iHerb` : 'Tick what you want.'}
      </button>
      <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: 'var(--dim)', textAlign: 'center' }}>
        {affiliateLive()
          ? 'Your price is unchanged; PPW earns a small commission that funds the next protocol.'
          : 'These open on iHerb; our code may give you a discount. We don’t yet earn on these purchases.'}
      </div>

      {shopList && (
        <div style={{ marginTop: 14, borderRadius: 18, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', padding: 16, animation: 'ppwRise .3s ease both' }}>
          {shopList.length ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, textShadow: 'var(--emboss)' }}>Add these too</div>
              <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>Your basket keeps our code for 7 days — add the rest and check out together.</div>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {shopList.map((s) => (
                  <a key={s.id} href={buyUrl(s)} target="_blank" rel="noopener nofollow sponsored"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', color: 'var(--ink)', textDecoration: 'none' }}>
                    <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 600, color: 'var(--accent)' }}>Add ↗</span>
                  </a>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--dim)', textAlign: 'center' }}>Opened on iHerb — your basket keeps our code for 7 days.</div>
          )}
          <button onClick={() => setShopList(null)} style={{ marginTop: 12, width: '100%', height: 40, background: 'none', border: 'none', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600 }}>Done</button>
        </div>
      )}
    </div>
  );
}
