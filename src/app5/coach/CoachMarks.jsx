// CoachMarks — the animated dialogue boxes that teach the app over the REAL UI
// (Vic 2c). Runs once after onboarding; replayable from Settings.
//
// Design constraints that shaped this:
//  • App5 renders a fixed phone frame (position:relative, overflow:hidden), so
//    the overlay is absolutely positioned INSIDE that frame, not the viewport.
//  • Targets are found by [data-tour="key"] and measured relative to the frame.
//  • The bubble never covers its own target: it flips above/below by measuring.
//  • Motion reuses the existing ppw keyframes — no new motion language.
//  • Reduced-motion → no animation, still fully usable.

import React from 'react';
import { save } from '../store5.js';
import { TOUR_STEPS } from './tourSteps.js';

const SEEN_KEY = 'tourSeen';

export function markTourSeen() { try { save(SEEN_KEY, '1'); } catch { /* ignore */ } }
export function hasSeenTour() {
  try { return localStorage.getItem('ppw5.' + SEEN_KEY) === '1'; } catch { return false; }
}

export default function CoachMarks({ open, onClose, steps = TOUR_STEPS }) {
  const [i, setI] = React.useState(0);
  const [rect, setRect] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const hostRef = React.useRef(null);

  const step = steps[i];

  const measure = React.useCallback(() => {
    if (!open || !step) return;
    const host = hostRef.current;
    // the app frame is our positioning context
    const frameEl = host ? host.parentElement : null;
    if (!frameEl) return;
    const fr = frameEl.getBoundingClientRect();
    setFrame({ w: fr.width, h: fr.height });
    if (!step.target) { setRect(null); return; }
    const el = frameEl.querySelector(`[data-tour="${step.target}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height });
  }, [open, step]);

  // Measure without depending on requestAnimationFrame alone: rAF does NOT fire
  // while the page isn't compositing (backgrounded tab, hidden pane, some
  // low-power modes). Relying on it left the spotlight permanently unmeasured and
  // the overlay dimmed with no cut-out. Measure synchronously, then again on the
  // next frame AND on a short timer, so it is correct however the page wakes up.
  React.useEffect(() => {
    if (!open) return;
    measure();
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 260);
    window.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', measure);
    };
  }, [open, i, measure]);

  if (!open || !step) return null;

  const done = () => { markTourSeen(); onClose && onClose(); };
  const next = () => { if (i + 1 >= steps.length) done(); else setI(i + 1); };

  const PAD = 8;
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;

  // place the bubble on whichever side has more room, so it never hides the target
  const frameH = (frame && frame.h) || 800;
  const below = hole ? (frameH - (hole.y + hole.h)) > 210 : true;
  const bubbleTop = hole ? (below ? hole.y + hole.h + 14 : Math.max(12, hole.y - 200)) : Math.round(frameH / 2) - 90;

  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, zIndex: 60 }} role="dialog" aria-live="polite">
      {/* dimmer with a cut-out over the target (4 panels — works on any ground) */}
      {hole ? (
        <>
          <Dim style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }} onClick={next} />
          <Dim style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} onClick={next} />
          <Dim style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} onClick={next} />
          <Dim style={{ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }} onClick={next} />
          {/* ring around the target */}
          <div aria-hidden="true" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 18, border: '2px solid var(--accent)', boxShadow: '0 0 0 3px rgba(232,119,46,.20)', pointerEvents: 'none', animation: 'ppwRise .32s ease both' }} />
        </>
      ) : (
        <Dim style={{ inset: 0 }} onClick={next} />
      )}

      {/* the dialogue box */}
      <div style={{ position: 'absolute', left: 16, right: 16, top: bubbleTop, borderRadius: 22, padding: '18px 18px 14px', background: 'var(--surface-strong)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .42s cubic-bezier(.3,1.3,.4,1) both' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>
          {i + 1} of {steps.length}
        </div>
        <div style={{ marginTop: 6, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{step.title}</div>
        <p style={{ margin: '7px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>{step.body}</p>
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={done} style={{ height: 42, padding: '0 14px', borderRadius: 13, border: 'none', background: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600 }}>Skip</button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {steps.map((_, k) => (
              <span key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 999, background: k === i ? 'var(--accent)' : 'var(--hairline)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }} />
            ))}
          </div>
          <button onClick={next} style={{ height: 42, padding: '0 20px', borderRadius: 13, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 700, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>
            {i + 1 >= steps.length ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dim({ style, onClick }) {
  return <div onClick={onClick} style={{ position: 'absolute', background: 'rgba(18,22,28,.58)', animation: 'ppwFade .3s ease both', ...style }} />;
}
