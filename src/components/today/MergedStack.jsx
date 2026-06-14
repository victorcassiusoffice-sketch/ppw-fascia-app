// MergedStack (extracted verbatim from App.jsx, 2026-06-11 liquid-glass
// redesign — zero logic change).
import React, { useState, useMemo } from 'react';
import { Tickbox, IconCalendar, IconUnmerge } from '../icons.jsx';
import { InlineRename } from '../shared.jsx';
import { DragMergePlusOverlay } from './overlays.jsx';

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
  onSetActiveTab,
}) {
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

  return (
    <div
      className={
        'card today-routine-card overflow-hidden transition-all relative '
        + (isDragOver ? 'border-accent ring-2 ring-accent/60 ' : '')
        + (selectionChecked ? 'ring-2 ring-accent/40 ' : '')
      }
    >
      {isDragOver && <DragMergePlusOverlay />}
      {/* COMPACT HEADER — always visible */}
      <div className="flex items-center gap-2 p-4">
        {onToggleSelection ? (
          <Tickbox
            checked={!!selectionChecked}
            onChange={onToggleSelection}
            ariaLabel={selectionAriaLabel || `Select stack: ${merge.title || 'merged stack'}`}
            kindClass="timeline-routine"
          />
        ) : (
          <span className="text-accent shrink-0 text-xl leading-none" aria-hidden>▤</span>
        )}
        {editingTime ? (
          <input
            type="time"
            autoFocus
            defaultValue={stackTime}
            onBlur={(e) => { onSetTime(mergeId, e.target.value); setEditingTime(false); }}
            onKeyDown={(e) => {
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
          >{stackTime || '—:—'}</button>
        )}
        <div className="flex-1 min-w-0">
          <InlineRename
            value={merge.title}
            placeholder="Name this stack…"
            onSave={(v) => onSetTitle(mergeId, v)}
            titleClassName="font-display text-base block"
          />
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest text-accent/85 font-bold">{children.length} parallel</span>
            {totalDurationMin > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-muted">{totalDurationMin} min total</span>
            )}
          </div>
        </div>
        {/* Patch 2 (2026-05-29) — inline duplicate/delete icons retired for
            cleaner rows. Both actions now live in the sticky bulk toolbar:
            select the stack (tickbox) → Duplicate (single-select) / Delete. */}
        {/* Fix 2026-06-14 (Vic) — un-merge affordance was buried in the expanded
            footer as text; surface it as a glass icon-disc in the compact header
            so a merged stack can always be split back into separate routines. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('Unmerge this stack? Routines return as separate cards.')) onDissolve(mergeId);
          }}
          className="glass-disc shrink-0"
          style={{ width: 36, height: 36, color: 'var(--col-ink)' }}
          aria-label="Unmerge stack — split back into separate routines"
          title="Unmerge stack"
        ><IconUnmerge /></button>
        {/* P0a (2026-06-02) — add merged stack to phone calendar. */}
        {stackTime && onAddToCalendar && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddToCalendar(mergeId, merge.title || 'Stack', stackTime, totalDurationMin || 15); }}
            className="text-muted hover:text-accent w-9 h-9 flex items-center justify-center shrink-0 transition-colors"
            aria-label="Add stack to phone calendar"
            title="Add to phone calendar (reliable lock-screen reminder)"
          ><IconCalendar /></button>
        )}
        <button
          type="button"
          onClick={() => onToggleCollapsed(mergeId, !collapsed)}
          className="text-muted text-base hover:text-accent w-9 h-9 flex items-center justify-center shrink-0"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand stack' : 'Collapse stack'}
          title={collapsed ? 'Tap to expand' : 'Tap to collapse'}
        >{collapsed ? '▾' : '▴'}</button>
      </div>

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
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-cream/5 text-[11px] text-muted">
            <span>Tabbed stack · tap a tab to switch · drag another routine onto this card to add a tab.</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Unstack? Routines return as separate cards.')) onDissolve(mergeId);
              }}
              className="text-muted hover:text-accent px-2 py-1 rounded shrink-0"
              title="Unstack"
            >Unstack</button>
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
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-t border-cream/5 text-[11px] text-muted">
            <span>Children play in parallel · drag another routine onto this card to add a child.</span>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Unstack? Routines return as separate cards.')) onDissolve(mergeId);
              }}
              className="text-muted hover:text-accent px-2 py-1 rounded shrink-0"
              title="Unstack"
            >Unstack</button>
          </div>
        </>
      )}
    </div>
  );
}

export default MergedStack;
