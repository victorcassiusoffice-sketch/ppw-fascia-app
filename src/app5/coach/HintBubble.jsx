// HintBubble — one quiet bubble, at the moment the user walks into a trap.
//
// Deliberately NOT a coach mark: no dimmer, no spotlight, nothing blocked. A
// hint is a whisper next to the control, and the app underneath stays fully
// usable. It sits at z44 — above the screens, below the AI bridge and the
// sheets, because a hint must never be the thing covering the thing.
//
// It uses the same frame-relative measurement as CoachMarks: App5 is a fixed
// phone frame with overflow:hidden, so everything is positioned inside that
// frame rather than the viewport.

import React from 'react';
import { useStore5, getState } from '../store5.js';
import { HINTS, hintCopy, hintDwell, hintQuestOffer, dismissHint } from './hints5.js';
import { openJournal } from '../store5.js';
import { startQuest } from './quests5.js';
import ReorderGhost from './ReorderGhost.jsx';

export default function HintBubble() {
  const S = useStore5();
  const id = S.hint ? S.hint.id : null;
  const h = id ? HINTS[id] : null;

  const [rect, setRect] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const hostRef = React.useRef(null);

  const measure = React.useCallback(() => {
    if (!h) return;
    const host = hostRef.current;
    const frameEl = host ? host.parentElement : null;
    if (!frameEl) return;
    const fr = frameEl.getBoundingClientRect();
    setFrame({ w: fr.width, h: fr.height });
    if (!h.anchor) { setRect(null); return; }
    const el = frameEl.querySelector('[data-tour="' + h.anchor + '"]');
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height });
  }, [h]);

  React.useEffect(() => {
    if (!h) return;
    measure();
    const raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 80);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [h, measure]);

  // Auto-dismiss. A hint the user ignored should leave on its own rather than
  // sit there waiting to be acknowledged.
  React.useEffect(() => {
    if (!id) return;
    const t = setTimeout(dismissHint, hintDwell(id));
    return () => clearTimeout(t);
  }, [id]);

  // One tap anywhere dismisses — including a tap on the app underneath, which
  // still does its own job. The catcher is transparent and does not block.
  React.useEffect(() => {
    if (!id) return;
    const onDown = () => dismissHint();
    const t = setTimeout(() => window.addEventListener('pointerdown', onDown, { capture: true }), 120);
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', onDown, { capture: true }); };
  }, [id]);

  if (!id || !h) return null;
  // `guide-pulse` is an animation on the disc itself, not a bubble.
  if (h.pulseOnly) return null;

  const body = hintCopy(id, S);
  const offer = hintQuestOffer(id);

  const PAD = 6;
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;
  const frameH = (frame && frame.h) || 800;
  const below = hole ? (frameH - (hole.y + hole.h)) > 190 : true;
  const top = hole ? (below ? hole.y + hole.h + 12 : Math.max(12, hole.y - 178)) : Math.round(frameH / 2) - 100;

  const takeQuest = (e) => {
    e.stopPropagation();
    dismissHint();
    const s = getState();
    // Offer the journal at that quest rather than yanking them into it — the
    // user asked to see it, not to be moved.
    if (offer) { openJournal(); setTimeout(() => { if (!getState().coach) startQuest(offer.quest); }, 220); }
    void s;
  };

  return (
    <div ref={hostRef} aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 44, pointerEvents: 'none' }}>
      {/* a soft ring on the thing being talked about — never a dimmer */}
      {hole && (
        <div aria-hidden="true" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 16, border: '1.5px solid var(--acc-rim)', boxShadow: '0 0 0 4px rgba(232,119,46,.12)', pointerEvents: 'none', animation: 'ppwRise .3s ease both' }} />
      )}
      <div data-hint={id} style={{ position: 'absolute', left: 16, right: 16, top, borderRadius: 20, padding: '15px 16px 14px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', pointerEvents: 'auto', animation: 'ppwSheetIn .34s cubic-bezier(.3,1.3,.4,1) both' }}>
        {h.ghost && <ReorderGhost />}
        {h.title && <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{h.title}</div>}
        <p style={{ margin: h.title ? '6px 0 0' : 0, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)' }}>{body}</p>
        {offer && (
          <button onClick={takeQuest} style={{ marginTop: 10, padding: 0, minHeight: 40, background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>
            {offer.label}
          </button>
        )}
      </div>
    </div>
  );
}
