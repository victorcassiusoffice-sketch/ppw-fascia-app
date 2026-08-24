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
//
// GUIDED ONBOARDING (2026-08-24) — this component now runs in two modes:
//
//   passive  the original behaviour. Read, tap anywhere, move on.
//   do       the user does the REAL thing. The spotlight hole stays genuinely
//            empty so the tap reaches the real control underneath, the dim only
//            BLOCKS (it no longer advances), and the step advances when the
//            step's own `advanceOn(S)` predicate goes true against the store.
//
// Per-step shape:
//   { target, title, body, mode?, buttons?, advanceOn?, before?, dormantWhen?, escape? }
//     before(S)       side effect on step entry — this is how a quest navigates
//     advanceOn(S)    do-mode completion predicate, watched via the store
//     dormantWhen(S)  render NOTHING while true but stay armed (keyboard, sheets)
//     buttons         [{ label, action }] for choice steps
//
// Every controlled step carries a ✕ pause in the bubble corner, so the dim is
// never the only surface on screen with no way out.

import React from 'react';
import { save, useStore5, getState, advanceCoach, closeCoach } from '../store5.js';
import { TOUR_STEPS } from './tourSteps.js';

const SEEN_KEY = 'tourSeen';

export function markTourSeen() { try { save(SEEN_KEY, '1'); } catch { /* ignore */ } }
export function hasSeenTour() {
  try { return localStorage.getItem('ppw5.' + SEEN_KEY) === '1'; } catch { return false; }
}

/**
 * @param {boolean}  open        uncontrolled mode (the welcome) — steps from `steps`
 * @param {function} onClose     uncontrolled close
 * @param {array}    steps       uncontrolled step list
 *
 * When `S.coach` is set the component runs CONTROLLED off the store instead:
 * `S.coach = { steps, questId?, i }`, advanced by advanceCoach() and closed by
 * closeCoach(). The two paths never run at once — the store wins.
 */
export default function CoachMarks({ open, onClose, steps: propSteps = TOUR_STEPS }) {
  const S = useStore5();
  const controlled = !!S.coach;
  const steps = controlled ? S.coach.steps : propSteps;

  const [localI, setLocalI] = React.useState(0);
  const i = controlled ? S.coach.i : localI;

  const [rect, setRect] = React.useState(null);
  const [frame, setFrame] = React.useState(null);
  const hostRef = React.useRef(null);

  const live = controlled || open;
  const step = live ? steps[i] : null;

  // Dormancy: a step can ask to disappear while the keyboard or a sheet it
  // opened is up, without losing its place. It stays armed underneath.
  const dormant = !!(step && typeof step.dormantWhen === 'function' && step.dormantWhen(S));

  // ── step entry side effect (`before`) ──────────────────────────────────
  // Runs ONCE per step arrival. This is how a quest walks the user across
  // screens — the original tour could only point at what was already there.
  const beforeKey = controlled ? ((S.coach.questId || 'q') + ':' + i) : ('local:' + i + ':' + (live ? 1 : 0));
  const lastBefore = React.useRef(null);
  React.useEffect(() => {
    if (!live || !step) return;
    if (lastBefore.current === beforeKey) return;
    lastBefore.current = beforeKey;
    if (typeof step.before === 'function') {
      try { step.before(getState()); } catch { /* a broken step must never wedge the guide */ }
    }
  }, [live, step, beforeKey]);

  // ── do-mode advance predicate ──────────────────────────────────────────
  // useStore5 re-renders on every store emit, so this effect IS the
  // subscription: it re-evaluates against the fresh snapshot each time.
  React.useEffect(() => {
    if (!controlled || !step || step.mode !== 'do') return;
    if (typeof step.advanceOn !== 'function') return;
    let fired = false;
    try { fired = !!step.advanceOn(S); } catch { fired = false; }
    if (!fired) return;
    // Let the real interaction finish painting before the coach moves.
    const t = setTimeout(() => {
      const c = getState().coach;
      if (c && c.i === i) advanceCoach();
    }, 420);
    return () => clearTimeout(t);
  }, [controlled, step, S, i]);

  const measure = React.useCallback(() => {
    if (!live || !step) return;
    const host = hostRef.current;
    // the app frame is our positioning context
    const frameEl = host ? host.parentElement : null;
    if (!frameEl) return;
    const fr = frameEl.getBoundingClientRect();
    setFrame({ w: fr.width, h: fr.height });
    const want = typeof step.target === 'function' ? safeCall(step.target) : step.target;
    if (!want) { setRect(null); return; }
    const el = frameEl.querySelector('[data-tour="' + want + '"]');
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height });
  }, [live, step, S]);

  // Measure without depending on requestAnimationFrame alone: rAF does NOT fire
  // while the page isn't compositing (backgrounded tab, hidden pane, some
  // low-power modes). Relying on it left the spotlight permanently unmeasured and
  // the overlay dimmed with no cut-out. Measure synchronously, then again on the
  // next frame AND on a short timer, so it is correct however the page wakes up.
  React.useEffect(() => {
    if (!live) return;
    measure();
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 260);
    // A `do` step waits on a real interaction that may move the page under it
    // (a sheet opens, a row is added), so keep re-measuring while it is up.
    const poll = setInterval(measure, 500);
    window.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', measure);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1); clearTimeout(t2); clearInterval(poll);
      window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', measure);
    };
  }, [live, i, measure, dormant]);

  if (!live || !step) return null;
  if (dormant) return null;

  const isDo = step.mode === 'do';
  // Title, body and buttons may be written as functions of the store, so a step
  // can change what it says when the app answers back — the free-cap refusal in
  // Quest 5 is the reason this exists.
  const read = (v) => { try { return typeof v === 'function' ? v(S) : v; } catch { return null; } };
  const title = read(step.title);
  const body = read(step.body);
  const buttons = read(step.buttons);

  const done = () => {
    if (controlled) { closeCoach(); return; }
    markTourSeen();
    setLocalI(0);
    onClose && onClose();
  };
  const next = () => {
    if (controlled) { advanceCoach(); return; }
    if (i + 1 >= steps.length) done(); else setLocalI(i + 1);
  };
  // A do-step must never advance on a stray tap on the dim — the whole promise
  // is "it moves when YOU do the thing".
  const dimTap = isDo ? undefined : next;

  const PAD = 8;
  const hole = rect ? { x: rect.x - PAD, y: rect.y - PAD, w: rect.w + PAD * 2, h: rect.h + PAD * 2 } : null;

  // place the bubble on whichever side has more room, so it never hides the target
  const frameH = (frame && frame.h) || 800;
  const below = hole ? (frameH - (hole.y + hole.h)) > 210 : true;
  const bubbleTop = hole ? (below ? hole.y + hole.h + 14 : Math.max(12, hole.y - 200)) : Math.round(frameH / 2) - 90;

  return (
    // THE HOST TAKES NO TAPS. It covers the whole frame so it can measure
    // against it, and for as long as it also ATE pointer events the spotlight
    // hole was a lie — the cut-out looked empty but every tap landed on this
    // div. The dim panels and the bubble opt back in individually below.
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none' }} role="dialog" aria-live="polite">
      {/* dimmer with a cut-out over the target (4 panels — works on any ground) */}
      {hole ? (
        <>
          <Dim style={{ left: 0, top: 0, right: 0, height: Math.max(0, hole.y) }} onClick={dimTap} />
          <Dim style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} onClick={dimTap} />
          <Dim style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} onClick={dimTap} />
          <Dim style={{ left: 0, top: hole.y + hole.h, right: 0, bottom: 0 }} onClick={dimTap} />
          {/* ring around the target — pointer-events:none, so in `do` mode the
              hole is genuinely empty and the tap lands on the real control */}
          <div aria-hidden="true" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 18, border: '2px solid var(--accent)', boxShadow: '0 0 0 3px rgba(232,119,46,.20)', pointerEvents: 'none', animation: 'ppwRise .32s ease both' }} />
        </>
      ) : (
        <Dim style={{ inset: 0 }} onClick={dimTap} />
      )}

      {/* the dialogue box */}
      <div data-coach-bubble="1" style={{ pointerEvents: 'auto', position: 'absolute', left: 16, right: 16, top: bubbleTop, borderRadius: 22, padding: '18px 18px 14px', background: 'var(--surface-strong)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .42s cubic-bezier(.3,1.3,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>
              {i + 1} of {steps.length}
            </div>
            <div style={{ marginTop: 6, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{title}</div>
          </div>
          {/* the pause ✕ — the dim is never a room with no door */}
          {controlled && (
            <button onClick={closeCoach} aria-label="Pause the guide" title="Pause"
              style={{ flex: 'none', width: 34, height: 34, marginTop: -2, marginRight: -4, borderRadius: 999, border: 'none', background: 'none', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
        <p style={{ margin: '7px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--dim)' }}>{body}</p>

        {/* A do-step has no Next: the real control on the screen behind is the
            button. Say so plainly, so nobody sits waiting for a Next that is
            never coming. A do-step MAY also offer an opt-out button (Quest 3's
            "Keep 9:00"), in which case both are shown. */}
        {isDo && (
          <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, letterSpacing: '.02em', color: 'var(--accent)' }}>
            <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: 'var(--accent)', animation: 'ppwFade 1.4s ease-in-out infinite alternate' }} />
            Your turn — do it on the screen
          </div>
        )}

        {Array.isArray(buttons) && buttons.length ? (
          <div style={{ marginTop: isDo ? 10 : 14, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            {buttons.map((b, k) => (
              <button key={b.label} onClick={() => { try { b.action && b.action(getState()); } catch {} if (b.advance !== false) next(); }}
                style={k === 0 && !isDo
                  ? { minHeight: 42, padding: '0 16px', borderRadius: 13, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 700, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }
                  : { minHeight: 42, padding: '0 14px', borderRadius: 13, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontSize: 13, fontWeight: 600 }}>
                {b.label}
              </button>
            ))}
          </div>
        ) : isDo ? null : (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            {!controlled && (
              <button onClick={done} style={{ height: 42, padding: '0 14px', borderRadius: 13, border: 'none', background: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600 }}>Skip</button>
            )}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {steps.map((_, k) => (
                <span key={k} style={{ width: k === i ? 18 : 6, height: 6, borderRadius: 999, background: k === i ? 'var(--accent)' : 'var(--hairline)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }} />
              ))}
            </div>
            <button onClick={next} style={{ height: 42, padding: '0 20px', borderRadius: 13, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 700, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>
              {i + 1 >= steps.length ? 'Done' : 'Next'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// A step's target/title/body/buttons may be written as functions of the store.
// A throwing step must never wedge the guide, so every call is guarded.
function safeCall(fn) { try { return fn(getState()); } catch { return null; } }

// A dim panel BLOCKS (that is its job — everything outside the hole is off
// limits), and in passive mode it also advances. It opts into pointer events
// explicitly, because the host above it takes none.
function Dim({ style, onClick }) {
  return <div onClick={onClick} style={{ pointerEvents: 'auto', position: 'absolute', background: 'rgba(18,22,28,.58)', animation: 'ppwFade .3s ease both', cursor: onClick ? 'pointer' : 'default', ...style }} />;
}
