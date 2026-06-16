// MergedStack (extracted verbatim from App.jsx, 2026-06-11 liquid-glass
// redesign — zero logic change).
import React, { useState, useMemo } from 'react';
import { Tickbox, IconCalendar, IconUnmerge, IconCheckSquare } from '../icons.jsx';
import { InlineRename } from '../shared.jsx';
import { DragMergePlusOverlay } from './overlays.jsx';
import { m, AnimatePresence, SPRING, STAGGER, DUR, EASE, useReducedMotion } from '../../lib/motion';

/* ═══════════════════════════════════════════
   M14 — MergedStack (compact-by-default, expandable)
   ───────────────────────────────────────────
   Parent card grouping multiple routines as TABS. Stays the SAME COMPACT
   SIZE regardless of how many routines are merged — count badge + tab dots
   only. Tap to expand → tabs visible + active tab body. Tap collapse → back
   to compact.
     - TIME LIVES ON THE STACK (single time chip; per-tab time hidden)
     - editable title (default blank → "Name this stack…" placeholder)
     - drop target: whole stack accepts a dropped routine to add a tab
     - video auto-play: if every tab is a video routine, the active video
       cascades into the next on `onEnded` per `merge.playOrder`
   ═══════════════════════════════════════════ */
function MergedStack({
  mergeId,
  merge,
  itemsById,
  isDragOver,
  onSetTitle, onUnmergeItem, onDissolve,
  onSetTime, onToggleCollapsed,
  renderTabBody,
  onDelete, onDuplicate, onAddToCalendar,
  // Iter 2 Phase 5 — selection + tab-mode props (all optional for back-compat).
  selectionChecked, onToggleSelection, selectionAriaLabel,
  selecting,
  onSetActiveTab,
}) {
  const reduced = useReducedMotion();
  const ids = (merge.itemIds || []).filter(id => itemsById.has(id));
  const children = ids.map(id => itemsById.get(id));

  const collapsed = merge.collapsed !== false;

  // Phase 1.2 (2026-05-23) — stack time is the EARLIEST of children's times,
  // unless the user has explicitly set merge.time. Duration is the LONGEST.
  const earliestChildTime = useMemo(() => {
    const times = children.map(c => c.time).filter(Boolean);
    if (times.length === 0) return '';
    return times.reduce((a, b) => (a.localeCompare(b) <= 0 ? a : b));
  }, [children]);
  const stackTime = merge.time || earliestChildTime || '';
  const totalDurationMin = useMemo(() => {
    const ds = children.map(c => c.duration_min || 0);
    return ds.length ? Math.max(...ds) : 0;
  }, [children]);

  const [editingTime, setEditingTime] = useState(false);

  // Iter 2 Phase 5.3 — tabbed mode for multi-select merges.
  const mode = merge.mode || 'parallel';
  const activeTabId = merge.activeTabId || (ids[0] || null);
  const activeChild = children.find(c => c.id === activeTabId) || children[0];

  // 2026-06-16 (Vic ref pass) — tap-open action cluster, matched to the single
  // stack card: the actions that used to clutter the compact header now bloom
  // out as REF-08 glass discs when the stack opens.
  const mergedActions = [
    onToggleSelection && {
      key: 'select', label: selectionChecked ? 'Deselect stack' : 'Select stack',
      icon: <IconCheckSquare />, on: !!selectionChecked, onClick: onToggleSelection,
    },
    (stackTime && onAddToCalendar) && {
      key: 'cal', label: 'Add stack to phone calendar', icon: <IconCalendar />,
      onClick: () => onAddToCalendar(mergeId, merge.title || 'Stack', stackTime, totalDurationMin || 15),
    },
    {
      key: 'unmerge', label: 'Unmerge stack — split back into separate routines', icon: <IconUnmerge />,
      onClick: () => { if (window.confirm('Unmerge this stack? Routines return as separate cards.')) onDissolve(mergeId); },
    },
  ].filter(Boolean);

  return (
    <div
      className={
        'card today-routine-card overflow-hidden transition-all relative '
        + (isDragOver ? 'border-accent ring-2 ring-accent/60 ' : '')
        + (!collapsed ? 'is-open ' : '')
        + (selectionChecked ? 'ring-2 ring-accent/40 is-selected ' : '')
      }
    >
      {isDragOver && <DragMergePlusOverlay />}
      {/* ── COLLAPSED TOKEN (2026-06-16, Vic ref pass) — minimal, matched to the
          single stack card: count tile · title · time · chevron. The whole head
          taps open; every action moved into the morph cluster below. ── */}
      <div
        className="stack-head flex items-center gap-2.5 p-3.5"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-label={`${merge.title || 'Merged stack'}, ${children.length} routines${stackTime ? `, ${stackTime}` : ''} — tap to ${collapsed ? 'open' : 'collapse'}`}
        onClick={() => onToggleCollapsed(mergeId, !collapsed)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleCollapsed(mergeId, !collapsed); } }}
      >
        {/* selection tick — only in selection mode (keeps the token clean). */}
        {onToggleSelection && selecting && (
          <span onClick={(e) => e.stopPropagation()} className="shrink-0 inline-flex">
            <Tickbox
              checked={!!selectionChecked}
              onChange={onToggleSelection}
              ariaLabel={selectionAriaLabel || `Select stack: ${merge.title || 'merged stack'}`}
              kindClass="timeline-routine"
            />
          </span>
        )}

        {/* Recognisable visual — a glass deck tile carrying the routine count
            (this is how you tell a merged stack from a single card at a glance). */}
        <span className="merged-count-tile glass-disc shrink-0" aria-hidden="true">
          <span className="merged-count-n tnum">{children.length}</span>
        </span>

        {/* Title only — the verbose "N parallel · X min total" subtext is gone. */}
        <span className="flex-1 min-w-0">
          <InlineRename
            value={merge.title}
            placeholder="Name this stack…"
            onSave={(v) => onSetTitle(mergeId, v)}
            titleClassName="font-display text-base block w-full truncate"
          />
        </span>

        {/* Time — small, trailing; tap edits. */}
        {stackTime && (editingTime ? (
          <input
            type="time"
            autoFocus
            defaultValue={stackTime}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => { onSetTime(mergeId, e.target.value); setEditingTime(false); }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter')   { onSetTime(mergeId, e.currentTarget.value); setEditingTime(false); }
              if (e.key === 'Escape')  { setEditingTime(false); }
            }}
            className="font-display text-accent text-sm bg-cream/5 border border-accent rounded px-2 py-1 w-[88px] shrink-0 focus:outline-none"
            aria-label="Edit stack time"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingTime(true); }}
            className="today-time-chip shrink-0"
            title="Tap to edit stack time"
            aria-label={`Edit stack time, currently ${stackTime}`}
          >{stackTime}</button>
        ))}

        {/* Chevron — the open affordance (rotates/melts on open). */}
        <span className="stack-chevron" aria-hidden="true">▾</span>
      </div>

      {/* ── TAP-OPEN ACTION CLUSTER (REF Recording A) — select · calendar ·
          unmerge bloom out as glass discs with the goo metaball neck. ── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <m.div
            key="merged-actions"
            initial={reduced ? false : { height: 0, opacity: 0 }}
            animate={reduced ? { height: 'auto', opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduced ? { height: 0, opacity: 0 } : { height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: DUR.base / 1000, ease: EASE.standard }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pt-1 pb-3">
              <div className="stack-actions-zone">
                {!reduced && (
                  <m.div
                    className="stack-goo-layer"
                    aria-hidden="true"
                    initial="hidden"
                    animate="show"
                    variants={{
                      hidden: { opacity: 0 },
                      show: { opacity: [0, 0.72, 0], transition: { duration: DUR.slow / 1000, ease: EASE.standard, staggerChildren: STAGGER.list / 1000 } },
                    }}
                  >
                    {mergedActions.map((a) => (
                      <m.span
                        key={a.key}
                        className="stack-goo-blob"
                        variants={{ hidden: { scale: 0.2 }, show: { scale: 1, transition: SPRING.settle } }}
                      />
                    ))}
                  </m.div>
                )}
                <m.div
                  className="stack-actions"
                  initial={reduced ? false : 'hidden'}
                  animate={reduced ? false : 'show'}
                  variants={reduced ? undefined : { hidden: {}, show: { transition: { staggerChildren: STAGGER.list / 1000, delayChildren: 0.03 } } }}
                >
                  {mergedActions.map((a) => (
                    <m.button
                      key={a.key}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); a.onClick(); }}
                      className={`glass-disc stack-act${a.on ? ' is-on' : ''}`}
                      aria-label={a.label}
                      aria-pressed={a.on || undefined}
                      title={a.label}
                      variants={reduced ? undefined : { hidden: { opacity: 0, scale: 0.3 }, show: { opacity: 1, scale: 1, transition: SPRING.settle } }}
                    >{a.icon}</m.button>
                  ))}
                </m.div>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* EXPANDED — tabbed view (Iter 2 Phase 5.3) OR parallel-play (M14 default) */}
      {!collapsed && mode === 'tabs' && (
        <>
          <div className="border-t border-cream/5">
            <div className="flex gap-1 overflow-x-auto px-3 pt-3 pb-2" role="tablist" aria-label="Stack tabs">
              {children.map(child => {
                const active = child.id === (activeChild?.id);
                return (
                  <button
                    key={child.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSetActiveTab && onSetActiveTab(mergeId, child.id)}
                    className={'shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ' + (active ? 'bg-accent text-bg' : 'bg-cream/5 text-muted hover:text-cream')}
                    title={child.label}
                  >
                    {(child.label || '').slice(0, 24)}
                  </button>
                );
              })}
            </div>
            {activeChild && (
              <div className="p-3">
                <div className="card p-3 bg-cream/[0.02]">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="font-display text-sm truncate" title={activeChild.label}>{activeChild.label}</div>
                    {activeChild.duration_min ? (
                      <span className="text-muted text-[10px] shrink-0">{activeChild.duration_min} min</span>
                    ) : null}
                  </div>
                  {renderTabBody(activeChild, mergeId)}
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-cream/5 text-[11px] text-muted">
            <span>Tap a tab to switch · drag a routine here to add one.</span>
          </div>
        </>
      )}
      {!collapsed && mode !== 'tabs' && (
        <>
          <div className="border-t border-cream/5 p-3">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(children.length, 2)}, minmax(0, 1fr))` }}>
              {children.map(child => (
                <div key={child.id} className="card p-3 bg-cream/[0.02]">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <div className="font-display text-sm truncate" title={child.label}>{child.label}</div>
                    {child.duration_min ? (
                      <span className="text-muted text-[10px] shrink-0">{child.duration_min} min</span>
                    ) : null}
                  </div>
                  {renderTabBody(child, mergeId)}
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 py-2 border-t border-cream/5 text-[11px] text-muted">
            <span>Plays in parallel · drag a routine here to add one.</span>
          </div>
        </>
      )}
    </div>
  );
}

export default MergedStack;
