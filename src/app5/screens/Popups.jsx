// Popups — runtime overlays fired by the slot engine (faithful ports).
//
// NotePopup: the full-screen affirmation display (Still/Flash/Pulse/Scroll
// animation per the item's settings, auto-dismisses per its duration).
// SlotReminder: the top banner when a timed slot arrives — Play (opens the
// in-app player) or dismiss.

import React from 'react';
import { useStore5, closeNotePop, dismissSlotPop, noteAnimCss, openPlayer, getState } from '../store5.js';

export function NotePopup() {
  const S = useStore5();
  const n = S.notePop;
  if (!n) return null;
  const marquee = n.anim === 'marquee';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}>
      <div onClick={closeNotePop} style={{ position: 'absolute', inset: 0, background: 'rgba(20,26,38,.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 360, borderRadius: 28, padding: '34px 26px', overflow: 'hidden', textAlign: 'center', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.3,.4,1) both' }}>
        <div style={{ position: 'relative', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <div style={{ display: 'inline-block', fontSize: 26, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.35, whiteSpace: marquee ? 'nowrap' : 'normal', color: 'var(--ink)', textShadow: 'var(--emboss)', animation: noteAnimCss(n.anim, n.speed) }}>{n.text}</div>
        </div>
        <button onClick={closeNotePop} style={{ position: 'relative', marginTop: 26, height: 44, padding: '0 26px', borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontWeight: 600, fontSize: 14 }}>Dismiss</button>
      </div>
    </div>
  );
}

export function SlotReminder() {
  const S = useStore5();
  const p = S.slotPop;
  if (!p) return null;
  const play = () => {
    const it = getState().deckItems.find((x) => x.id === p.id);
    dismissSlotPop();
    if (it) openPlayer(it);
  };
  return (
    <div style={{ position: 'absolute', left: 14, right: 14, top: 'calc(14px + env(safe-area-inset-top, 0px))', zIndex: 37, borderRadius: 22, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both' }}>
      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 999, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{p.title}</span>
        <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--dim)' }}>It is {p.time}, time for this slot</span>
      </span>
      {p.hasUrl && (
        <button onClick={play} aria-label="Play now" style={{ height: 40, padding: '0 16px', flex: 'none', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 13.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>Play
        </button>
      )}
      <button onClick={dismissSlotPop} aria-label="Dismiss" style={{ width: 34, height: 34, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
