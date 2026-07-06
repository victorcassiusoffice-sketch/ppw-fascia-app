// AddSheet — New Design "Add to your stack" bottom sheet (functional core port).
//
// Ported now: the 2×2 tile grid (tiles route to Library filtered), the
// Assistant CTA (Premium-gated), the Custom-apps quick links, and the real
// paste-a-share-link → adds a media item to today's stack. Deferred: the inline
// note composer + document upload (need more logic) — tiles still present.

import React from 'react';
import { useStore5, closeAdd, setCustomUrl, addCustomUrl, goLibrary, setUpsell } from '../store5.js';

const tsvg = (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
const TILES = [
  { key: 'routines', name: 'Routine', tab: 'routines', icon: tsvg(<path d="M12 3s6 6.3 6 10.3a6 6 0 0 1-12 0C6 9.3 12 3 12 3z" />) },
  { key: 'media', name: 'Media', tab: 'media', icon: tsvg(<><path d="M9 18V6l8-2v12" /><circle cx="7" cy="18" r="2.2" /><circle cx="15" cy="16" r="2.2" /></>) },
  { key: 'protocols', name: 'Protocol', tab: 'protocols', icon: tsvg(<><path d="M5 7.5 12 4l7 3.5-7 3.5-7-3.5z" /><path d="M5 12l7 3.5 7-3.5" /><path d="M5 16.5 12 20l7-3.5" /></>) },
  { key: 'supps', name: 'Supplement', tab: 'supps', icon: tsvg(<><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" /><path d="M12 8.5v7" /></>) },
];

export default function AddSheet() {
  const S = useStore5();
  if (!S.addOpen) return null;

  const onAssistant = () => {
    if (!S.premium) { setUpsell('The Assistant is part of Premium — it plans, researches and rebuilds your day, right from this corner.'); return; }
    // premium: assistant builder is a later port; for now route to Library
    goLibrary('media');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
      <div onClick={closeAdd} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100% - 130px)', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', transformOrigin: '50% 105%', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Add to your stack</div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TILES.map((t) => (
            <button key={t.key} onClick={() => goLibrary(t.tab)} style={{ height: 92, borderRadius: 22, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {t.icon}
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
            </button>
          ))}
          <button onClick={onAssistant} style={{ gridColumn: '1 / -1', height: 60, borderRadius: 20, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Assistant — build it for me</span>
          </button>
        </div>

        <div style={{ marginTop: 20, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Custom apps</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>YouTube
          </a>
          <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l8-2v12" /><circle cx="7" cy="18" r="2.2" /><circle cx="15" cy="16" r="2.2" /></svg>Spotify
          </a>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <input value={S.customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="Paste a share link…" aria-label="Paste a share link" style={{ flex: 1, height: 48, padding: '0 16px', borderRadius: 15, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 }} />
          <button onClick={() => addCustomUrl(S.customUrl)} style={{ height: 48, padding: '0 20px', borderRadius: 15, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Add</button>
        </div>
        {S.addedCustom && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, border: '1px solid var(--rim)', background: 'var(--surface)', animation: 'ppwRise .3s ease both' }}>
            <div style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}><strong>{S.addedCustom.title}</strong> added to today's stack</div>
            <button onClick={() => goLibrary('media')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>View</button>
          </div>
        )}
      </div>
    </div>
  );
}
