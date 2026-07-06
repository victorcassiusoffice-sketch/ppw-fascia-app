// LibraryScreen — New Design "Library" (tabbed content library, focused port).
//
// Ported now: the 4-tab gliding segmented control (Routines/Media/Protocols/
// Supps), the Routines Premium gate (upsell vs "you're Premium"), and the Media
// tab (list of media items, tick to add into today's stack). Protocols/Supps
// tabs show a faithful empty state until their content sources are ported.

import React from 'react';
import { THUMBS } from '../theme5.js';
import { useStore5, setTab, addToStack, setUpsell, openPlayer } from '../store5.js';

const PREM_PRICE = '$4.99';
const TABS = [
  { key: 'routines', label: 'Routines' },
  { key: 'media', label: 'Media' },
  { key: 'protocols', label: 'Protocols' },
  { key: 'supps', label: 'Supps' },
];

const IPlay = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>;

function MediaRow({ it }) {
  const bg = it.thumbUrl ? `url(${it.thumbUrl})` : (THUMBS[it.thumb] || THUMBS.au);
  const [added, setAdded] = React.useState(false);
  const add = (e) => { e.stopPropagation(); if (addToStack(it)) setAdded(true); };
  return (
    <div onClick={() => { if (it.embed || it.url) openPlayer(it); }} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', minHeight: 76, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', cursor: (it.embed || it.url) ? 'pointer' : 'default' }}>
      <div style={{ width: 56, height: 56, flex: 'none', borderRadius: 16, background: bg, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)' }}>{!it.thumbUrl && IPlay}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{it.title}</div>
        <div style={{ marginTop: 3, fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.meta}</div>
      </div>
      <button onClick={add} aria-label="Add to today's stack" style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1.5px solid ${added ? 'var(--acc-rim)' : 'var(--rim)'}`, background: added ? 'var(--acc-surf)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)', padding: 0, transition: 'all .2s' }}>
        {added && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
      </button>
    </div>
  );
}

export default function LibraryScreen() {
  const S = useStore5();
  const idx = TABS.findIndex((t) => t.key === S.stackTab);
  const tabLeft = `calc(${idx < 0 ? 0 : idx} * 25% + 3px)`;

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwRise .5s cubic-bezier(.26,1,.4,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Library</h1>
      </div>
      <div style={{ marginTop: 5, fontSize: 14, color: 'var(--dim)' }}>Everything you can slot into a day.</div>

      {/* tab bar with gliding indicator */}
      <div style={{ position: 'relative', marginTop: 22, height: 48, borderRadius: 16, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', display: 'flex' }}>
        <div style={{ position: 'absolute', top: 4, bottom: 4, width: 'calc(25% - 5px)', left: tabLeft, borderRadius: 12, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', boxShadow: 'var(--acc-glow)', transition: 'left .38s cubic-bezier(.3,1.3,.4,1)' }} />
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ position: 'relative', flex: 1, background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: S.stackTab === t.key ? 'var(--acc-ink)' : 'var(--dim)', textShadow: 'var(--label-shadow)', transition: 'color .25s' }}>{t.label}</button>
        ))}
      </div>

      {/* Routines — premium gated */}
      {S.stackTab === 'routines' && (
        !S.premium ? (
          <div style={{ position: 'relative', marginTop: 18, borderRadius: 24, overflow: 'hidden', padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            <div style={{ opacity: .5, pointerEvents: 'none' }}>
              <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
              </span>
              <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Routines</div>
              <p style={{ margin: '8px auto 0', maxWidth: 270, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Chain videos, audio and affirmations into one named stack.</p>
            </div>
            <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', fontSize: 12, fontWeight: 700, boxShadow: 'var(--acc-glow)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>Premium · {PREM_PRICE}/mo
            </div>
            <button onClick={() => setUpsell('Routines let you chain many videos, audios and affirmations into one named stack that plays in order — with your own cover image.')} style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Unlock Routines</button>
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: 18, borderRadius: 24, overflow: 'hidden', padding: '22px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
            </span>
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Routines — you're Premium</div>
            <p style={{ margin: '8px auto 0', maxWidth: 280, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Ask the Assistant to build a routine — the full builder is on the way.</p>
          </div>
        )
      )}

      {/* Media — list + add to stack */}
      {S.stackTab === 'media' && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {S.mediaItems.map((it) => <MediaRow key={it.id} it={it} />)}
        </div>
      )}

      {/* Protocols / Supps — faithful empty states until their sources are ported */}
      {(S.stackTab === 'protocols' || S.stackTab === 'supps') && (
        <div style={{ marginTop: 18, borderRadius: 24, padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>{S.stackTab === 'protocols' ? 'Protocols' : 'Supplements'}</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>This library is being wired up in the New Design build.</div>
        </div>
      )}
    </div>
  );
}
