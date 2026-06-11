// Today-screen overlays (extracted verbatim from App.jsx, 2026-06-11
// liquid-glass redesign — zero logic change).
import React, { useState, useMemo, useEffect } from 'react';
import { useActiveProtocols, todayISO } from '../../state.js';
import { listProtocols } from '../../protocols.js';
import { m, sheetUp, DUR, reduced } from '../../lib/motion';

/* Liquid-glass (board 06): shared enter grammar for every overlay — the
   static scrim fades (opacity only; it carries the blur), the sheet ARRIVES
   on SPRING.sheet (solid surface — it moves, so no backdrop-filter on it). */
const scrimEnter = () => (reduced()
  ? {}
  : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: DUR.fast / 1000 } });

/* ─── Iter 2 patch 1 — ClearCalendarModal ───
   Pops from tapping the Clear button in the sticky toolbar.
   Two modes:
     - 'day'   single tap → one ISO date string.
     - 'range' first tap = start, second tap = end. Re-tap start before
                 end re-anchors the start.
   Confirm fires onConfirm({ mode, day, start, end }). Modal closes;
   caller wipes per-date storage for each impacted date.
   Visual: month grid (Mon-Sun), prev/next arrows. Selected day(s) lit
   in gold; range fill is a faint gold band; today carries a navy chip. */
function ClearCalendarModal({ open, onClose, onConfirm }) {
  const today = todayISO();
  const initialMonth = useMemo(() => {
    const d = new Date(today + 'T12:00:00');
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [today]);

  const [mode, setMode] = useState('day');
  const [day, setDay] = useState(null);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [{ y, m }, setMonth] = useState(initialMonth);

  // Reset when opening.
  useEffect(() => {
    if (open) {
      setMode('day');
      setDay(null);
      setStart(null);
      setEnd(null);
      setMonth(initialMonth);
    }
  }, [open, initialMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(y, m, 1);
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [y, m]);

  const grid = useMemo(() => {
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    // Mon=0..Sun=6 offset.
    const dayOfWeek = (first.getDay() + 6) % 7;
    const cells = [];
    for (let i = 0; i < dayOfWeek; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      const date = new Date(y, m, d);
      const iso = date.toISOString().slice(0, 10);
      cells.push({ d, iso });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [y, m]);

  const prevMonth = () => {
    const d = new Date(y, m - 1, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const nextMonth = () => {
    const d = new Date(y, m + 1, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  const pick = (iso) => {
    if (!iso) return;
    if (mode === 'day') {
      setDay(iso);
      return;
    }
    // range mode
    if (!start || (start && end)) {
      setStart(iso);
      setEnd(null);
      return;
    }
    // start set, no end yet
    if (iso < start) {
      // re-anchor
      setStart(iso);
      return;
    }
    setEnd(iso);
  };

  const inRange = (iso) => {
    if (mode !== 'range') return false;
    if (!start || !end) return false;
    return iso >= start && iso <= end;
  };
  const isStart = (iso) => mode === 'range' && start === iso;
  const isEnd   = (iso) => mode === 'range' && end === iso;
  const isDay   = (iso) => mode === 'day' && day === iso;

  const canConfirm = (mode === 'day' && day) || (mode === 'range' && start && end);

  const summary = mode === 'day'
    ? (day ? `Clear stacks for ${day}` : 'Pick a day')
    : (start && end ? `Clear stacks for ${start} → ${end}` : start ? 'Pick an end day' : 'Pick a start day');

  if (!open) return null;
  return (
    <m.div {...scrimEnter()} className="fixed inset-0 z-[55] ppw-scrim flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <m.div
        variants={sheetUp}
        initial="hidden"
        animate="show"
        className="card w-full max-w-md max-h-[92vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--col-surface-a)', border: '1px solid rgb(var(--c-accent) / 0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-cream/10">
          <div className="font-display text-lg">Clear stacks</div>
          <button onClick={onClose} className="text-muted hover:text-accent text-2xl leading-none" aria-label="Close">×</button>
        </div>

        <div className="flex gap-1 p-3 border-b border-cream/10">
          <button
            type="button"
            onClick={() => { setMode('day'); setStart(null); setEnd(null); }}
            className={'flex-1 py-2 rounded-full text-xs font-bold transition-all ' + (mode === 'day' ? 'btn-accent' : 'bg-cream/5 text-muted')}
          >Single day</button>
          <button
            type="button"
            onClick={() => { setMode('range'); setDay(null); }}
            className={'flex-1 py-2 rounded-full text-xs font-bold transition-all ' + (mode === 'range' ? 'btn-accent' : 'bg-cream/5 text-muted')}
          >Date range</button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-cream/10">
          <button onClick={prevMonth} className="w-9 h-9 flex items-center justify-center text-muted hover:text-accent" aria-label="Previous month">‹</button>
          <div className="font-display text-sm uppercase tracking-widest">{monthLabel}</div>
          <button onClick={nextMonth} className="w-9 h-9 flex items-center justify-center text-muted hover:text-accent" aria-label="Next month">›</button>
        </div>

        <div className="px-3 pt-2">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-widest text-muted text-center mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              if (!cell) return <div key={'gap-' + i} />;
              const isT = cell.iso === today;
              const sel = isDay(cell.iso) || isStart(cell.iso) || isEnd(cell.iso);
              const inR = inRange(cell.iso);
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => pick(cell.iso)}
                  className="aspect-square rounded-md flex items-center justify-center text-sm font-display transition-all"
                  style={{
                    backgroundColor: sel
                      ? 'var(--col-accent)'
                      : inR
                        ? 'var(--accent-soft)'
                        : isT
                          ? 'var(--col-inset)'
                          : 'transparent',
                    color: sel ? 'var(--col-on-accent)' : 'var(--col-ink)',
                    border: '1px solid ' + (sel ? 'var(--col-accent)' : isT ? 'rgb(var(--c-accent) / 0.6)' : 'transparent'),
                  }}
                  title={cell.iso}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 border-t border-cream/10 space-y-3">
          <div className="text-xs text-muted text-center">{summary}</div>
          <p className="text-[10px] text-muted leading-relaxed">
            Clearing hides every stack on the chosen day(s) — your protocols, modules, and saved zones stay active on other days.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button
              type="button"
              onClick={() => {
                if (!canConfirm) return;
                onConfirm({ mode, day, start, end });
              }}
              disabled={!canConfirm}
              className="btn-accent flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >Clear</button>
          </div>
        </div>
      </m.div>
    </m.div>
  );
}

/* ─── Iter 2 Phase 7.2 — Notification Overlay (FOREGROUND-ONLY) ───
   IMPORTANT (P0a 2026-06-02): this overlay is an IN-SESSION enhancement only.
   It is driven by an in-page setTimeout (scheduleStackNotifications) which is
   FROZEN when the tab is backgrounded or the phone is locked, and does not
   exist on iOS at all. It must NOT be presented as "the phone will remind you".
   For a reliable lock-screen reminder with the app closed, the user adds the
   slot to their phone calendar (the IconCalendar action on each row → .ics) or,
   on an installed PWA, opts into Web Push (P0b). This overlay only fires while
   the app is open and in the foreground.
   Renders when a stack timer fires. Modal takes focus until user picks
   Open / Skip / Autoplay. Autoplay switch flips to ON triggers a secondary
   prompt asking whether to opt this stack+time pattern into "all future
   calendars" (Phase 7.3). */
function NotificationOverlay({ item, onOpen, onSkip, onAutoplay }) {
  const [askingFuture, setAskingFuture] = useState(false);
  if (!item) return null;
  const handleAutoplayClick = () => setAskingFuture(true);
  if (askingFuture) {
    return (
      <m.div {...scrimEnter()} className="fixed inset-0 z-[60] ppw-scrim flex items-end sm:items-center justify-center p-4">
        <m.div
          variants={sheetUp}
          initial="hidden"
          animate="show"
          className="card w-full max-w-sm p-5"
          style={{ backgroundColor: 'var(--col-surface-a)', border: '1px solid var(--col-accent)' }}
        >
          <div className="font-display text-lg mb-2">Autoplay this stack</div>
          <p className="text-muted text-sm mb-5">
            Is this for all future calendars? If yes, this stack at <span className="text-accent">{item.time}</span> will autoplay on future days too.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { onAutoplay({ allFuture: true }); setAskingFuture(false); }}
              className="btn-accent w-full"
            >Yes — all future</button>
            <button
              type="button"
              onClick={() => { onAutoplay({ allFuture: false }); setAskingFuture(false); }}
              className="btn-ghost w-full"
            >Just this one</button>
          </div>
        </m.div>
      </m.div>
    );
  }
  return (
    <m.div {...scrimEnter()} className="fixed inset-0 z-[60] ppw-scrim flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Stack reminder">
      <m.div
        variants={sheetUp}
        initial="hidden"
        animate="show"
        className="card w-full max-w-sm p-5"
        style={{ backgroundColor: 'var(--col-surface-a)', border: '1px solid var(--col-accent)' }}
      >
        <div className="text-xs uppercase tracking-widest text-accent mb-1">{item.time} · In-app reminder</div>
        <div className="font-display text-xl mb-1 leading-tight">{item.label}</div>
        {item.duration_min ? (
          <div className="text-muted text-xs mb-4">{item.duration_min} min</div>
        ) : <div className="mb-4" />}
        <div className="flex flex-col gap-2">
          {/* Accent cleanup (Phase 2.5): legacy gold gradient + hard white →
              theme tokens, so the overlay flips correctly in both themes. */}
          <button
            type="button"
            onClick={onOpen}
            className="w-full py-3 rounded-full font-bold transition-all btn-accent"
          >Open</button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full py-3 rounded-full font-bold transition-all btn-secondary"
          >Skip</button>
          <button
            type="button"
            onClick={handleAutoplayClick}
            className="w-full py-2 rounded-full text-xs font-bold border border-accent/40 text-accent hover:bg-accent/10 transition-all"
          >Autoplay this stack now</button>
        </div>
      </m.div>
    </m.div>
  );
}

/* ─── Iter 2 Phase 6.4 — Add Protocol modal ───
   Lists every locally-available protocol from protocols.js LOCAL_CATALOG.
   Tap a row → activate (push id into activeProtocols). Existing TodayView
   useEffect re-fetches the protocol and merges its daily_plan into today.
   Already-active protocols render disabled with "✓ Active" badge. */
function AddProtocolModal({ open, onClose, onActivate }) {
  const [list, setList] = useState(null);
  const [activeProtocols] = useActiveProtocols();
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listProtocols().then(arr => { if (!cancelled) setList(arr || []); });
    return () => { cancelled = true; };
  }, [open]);
  if (!open) return null;
  return (
    <m.div {...scrimEnter()} className="fixed inset-0 z-50 ppw-scrim flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <m.div
        variants={sheetUp}
        initial="hidden"
        animate="show"
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--col-surface-a)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream/10">
          <div className="font-display text-xl">Add Protocol</div>
          <button onClick={onClose} className="text-muted hover:text-accent text-2xl leading-none" aria-label="Close">×</button>
        </div>
        <div className="p-4 space-y-2">
          {list == null && <div className="text-muted text-sm animate-pulse text-center py-6">Loading protocols…</div>}
          {list && list.length === 0 && (
            <div className="text-muted text-sm text-center py-6">No protocols available. Check Settings → Data source.</div>
          )}
          {list && list.map(p => {
            const isActive = activeProtocols.includes(p.protocol_id);
            const n = p.sections?.daily_plan?.length || 0;
            return (
              <button
                key={p.protocol_id}
                type="button"
                onClick={() => !isActive && onActivate(p)}
                disabled={isActive}
                className={'w-full text-left card p-4 transition-all ' + (isActive ? 'opacity-60 cursor-not-allowed' : 'hover:border-accent')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base leading-tight truncate">{p.topic}</div>
                    <div className="text-muted text-xs mt-1">{n} daily item{n === 1 ? '' : 's'} · {p.variant || ''}</div>
                  </div>
                  {isActive ? (
                    <span className="text-xs text-accent shrink-0">✓ Active</span>
                  ) : (
                    <span className="text-xs text-accent shrink-0">Add →</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </m.div>
    </m.div>
  );
}

/* ─── Iter 2 Phase 5.5 — Drag-to-merge gold (+) overlay ───
   Renders centred over a card while its drag-over candidate state is set
   by SortableList (mergeDragOverId). pointer-events:none so it never
   intercepts drag. */
function DragMergePlusOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ pointerEvents: 'none', zIndex: 20 }}
      aria-hidden="true"
    >
      <span
        className="rounded-full flex items-center justify-center"
        style={{
          width: 56,
          height: 56,
          backgroundColor: 'var(--col-accent)',
          boxShadow: '0 8px 28px -6px var(--accent-soft)',
          color: 'var(--col-on-accent)',
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </span>
    </div>
  );
}

export { ClearCalendarModal, NotificationOverlay, AddProtocolModal, DragMergePlusOverlay };
