// RepeatSheet — New Design "Repeat options" bottom sheet (faithful port).
//
// Opened from an item's repeat control. Sets the item's recurrence: Every day /
// Weekly / Every N days (with a stepper) / Just once. setRepeat stamps an anchor
// date so weekly/every-N math (itemOnDate) works.

import React from 'react';
import { useStore5, closeRepeat, setRepeat, setNoTime } from '../store5.js';

const OPTS = [
  { key: 'daily', label: 'Every day', desc: 'Repeats daily' },
  { key: 'weekly', label: 'Weekly', desc: 'Same day each week' },
  { key: 'custom', label: 'Every few days', desc: 'Choose the gap' },
  { key: 'once', label: 'Just once', desc: 'One time only' },
];

const isCustomVal = (r) => { const n = parseInt(r, 10); return String(n) === String(r) && n > 1; };

export default function RepeatSheet() {
  const S = useStore5();
  if (!S.repeatId) return null;
  const it = S.deckItems.find((x) => x.id === S.repeatId);
  if (!it) return null;
  const cur = it.repeat === undefined ? 'daily' : it.repeat;
  const custom = isCustomVal(cur);
  const n = custom ? parseInt(cur, 10) : 3;

  const selectedKey = cur === 'daily' ? 'daily' : cur === 'weekly' ? 'weekly' : cur === 'once' ? 'once' : (custom ? 'custom' : 'daily');
  const pick = (key) => {
    if (key === 'custom') setRepeat(it.id, String(n));
    else setRepeat(it.id, key);
  };
  const bump = (d) => { const nn = Math.min(14, Math.max(2, n + d)); setRepeat(it.id, String(nn)); };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 34 }}>
      <div onClick={closeRepeat} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', transformOrigin: '50% 105%', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Repeat</div>
        <div style={{ marginTop: 4, fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 9 }}>
          {OPTS.map((o) => {
            const active = selectedKey === o.key;
            return (
              <button key={o.key} onClick={() => pick(o.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 52, padding: '0 16px', borderRadius: 16, border: `1px solid ${active ? 'var(--acc-rim)' : 'var(--rim)'}`, background: active ? 'var(--acc-surf)' : 'var(--surface)', color: active ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 14.5, fontWeight: 600, textShadow: 'var(--label-shadow)', transition: 'all .2s' }}>
                {o.label}
                <span style={{ fontSize: 12, fontWeight: 500, opacity: .75 }}>{o.desc}</span>
              </button>
            );
          })}
        </div>
        {selectedKey === 'custom' && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Repeat every</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => bump(-1)} aria-label="Fewer days" style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <div style={{ fontSize: 21, fontWeight: 600, minWidth: 74, textAlign: 'center', textShadow: 'var(--emboss)' }}>{n} days</div>
              <button onClick={() => bump(1)} aria-label="More days" style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
        )}
        {/* Vic #3 — no fixed time: the stack queues at the top as Next Up. */}
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '0 4px' }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>No fixed time</div>
            <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>Sits at the top as Next Up until you do it</div>
          </div>
          <button onClick={() => setNoTime(it.id, !!it.time)} role="switch" aria-checked={!it.time} aria-label="Toggle no fixed time" style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${!it.time ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: !it.time ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', transition: 'background .3s' }}>
            <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${!it.time ? 26 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
          </button>
        </div>
        <button onClick={closeRepeat} style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Done</button>
      </div>
    </div>
  );
}
