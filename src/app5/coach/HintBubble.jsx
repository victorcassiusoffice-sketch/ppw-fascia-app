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
import { useStore5, getState, setState } from '../store5.js';
import { HINTS, hintCopy, hintDwell, hintQuestOffer, dismissHint, snoozeInstall } from './hints5.js';
import { startQuest } from './quests5.js';
import ReorderGhost from './ReorderGhost.jsx';

// A hint's buttons are declared as data in the registry, so the action is a
// NAME rather than a closure — the registry stays a plain table that can be
// read (and tested) without pulling half the app in behind it.
function runHintAction(action) {
  if (action === 'settings-install') setState({ screen: 'settings' });
  if (action === 'snooze-install') snoozeInstall(7);
}

export default function HintBubble() {
  const S = useStore5();
  const id = S.hint ? S.hint.id : null;
  const h = id ? HINTS[id] : null;

  const [rect, setRect] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const [bubbleSize, setBubbleSize] = React.useState(0);
  const hostRef = React.useRef(null);
  const bubbleRef = React.useRef(null);

  // Same two corrections as CoachMarks, and for the same reasons: easy read
  // scales the frame with CSS `zoom`, so screen pixels have to be divided back
  // into the frame's own space or the ring lands beside its target; and the
  // zoomed frame is taller than the phone, so "inside the frame" is not the
  // same as "on the screen".
  const measure = React.useCallback(() => {
    if (!h) return;
    const host = hostRef.current;
    const frameEl = host ? host.parentElement : null;
    if (!frameEl) return;
    const fr = frameEl.getBoundingClientRect();
    const z = (S.a11y && S.a11y.zoom) || 1;
    const visibleBottom = Math.min(fr.bottom, (typeof window !== 'undefined' && window.innerHeight) || fr.bottom);
    setFrame({ w: fr.width / z, h: fr.height / z, visH: Math.max(0, visibleBottom - fr.top) / z });
    if (!h.anchor) { setRect(null); return; }
    const el = frameEl.querySelector('[data-tour="' + h.anchor + '"]');
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: (r.left - fr.left) / z, y: (r.top - fr.top) / z, w: r.width / z, h: r.height / z });
  }, [h, S.a11y]);

  React.useEffect(() => {
    if (!h) return;
    measure();
    const raf = requestAnimationFrame(measure);
    const t = setTimeout(measure, 80);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [h, measure]);

  // Its own height feeds the clamp — hint copy runs from one line to a
  // paragraph, and a fixed guess puts the long ones off the bottom.
  React.useLayoutEffect(() => {
    const el = bubbleRef.current;
    if (!el) return;
    const z = (S.a11y && S.a11y.zoom) || 1;
    const hh = el.getBoundingClientRect().height / z;
    setBubbleSize((prev) => (Math.abs(prev - hh) > 1 ? hh : prev));
  });

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
  const visH = (frame && frame.visH) || frameH;
  const bubbleH = bubbleSize || 178;
  const below = hole ? (visH - (hole.y + hole.h)) > (bubbleH + 20) : true;
  const wanted = hole ? (below ? hole.y + hole.h + 12 : hole.y - bubbleH - 12) : Math.round(visH / 2) - Math.round(bubbleH / 2);
  const top = Math.max(12, Math.min(wanted, visH - bubbleH - 12));

  const takeQuest = (e) => {
    e.stopPropagation();
    dismissHint();
    if (!offer) return;
    // Straight into the quest the line names. This used to open the journal
    // first and swap it for the quest 220ms later — which meant the sheet was
    // torn out halfway through its own entrance animation, for no gain: the
    // user tapped a line about ONE quest, so showing them a list of eight was
    // never the answer.
    setTimeout(() => { if (!getState().coach) startQuest(offer.quest); }, 180);
  };

  return (
    <div ref={hostRef} aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 44, pointerEvents: 'none' }}>
      {/* a soft ring on the thing being talked about — never a dimmer */}
      {hole && (
        <div aria-hidden="true" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 16, border: '1.5px solid var(--acc-rim)', boxShadow: '0 0 0 4px rgba(232,119,46,.12)', pointerEvents: 'none', animation: 'ppwRise .3s ease both' }} />
      )}
      <div ref={bubbleRef} data-hint={id} style={{ position: 'absolute', left: 16, right: 16, top, borderRadius: 20, padding: '15px 16px 14px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', pointerEvents: 'auto', animation: 'ppwSheetIn .34s cubic-bezier(.3,1.3,.4,1) both' }}>
        {h.ghost && <ReorderGhost />}
        {h.title && <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{h.title}</div>}
        <p style={{ margin: h.title ? '6px 0 0' : 0, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)' }}>{body}</p>
        {Array.isArray(h.buttons) && h.buttons.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {h.buttons.map((btn, k) => (
              <button key={btn.label} onClick={(e) => { e.stopPropagation(); runHintAction(btn.action); dismissHint(); }}
                style={k === 0
                  ? { minHeight: 42, padding: '0 15px', borderRadius: 13, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13, fontWeight: 700, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }
                  : { minHeight: 42, padding: '0 13px', borderRadius: 13, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600 }}>
                {btn.label}
              </button>
            ))}
          </div>
        )}
        {offer && (
          <button onClick={takeQuest} style={{ marginTop: 10, padding: 0, minHeight: 40, background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent)', fontSize: 12.5, fontWeight: 700 }}>
            {offer.label}
          </button>
        )}
      </div>
    </div>
  );
}
