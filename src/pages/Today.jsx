// /today (extracted verbatim from App.jsx, 2026-06-11 liquid-glass redesign
// — zero logic change).
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ZONES, moduleMediaPath, loadMedia, resolveRoutineZones } from '../data.js';
import {
  useActiveProtocols, useActiveModules, useActiveRoutines, useCompletedToday,
  useDateScopedStorage, useDailyHidden, useDailyDuplicates, useDailyMerges,
  useDailyTitles, useUserStacks, useIfPrefs, useNotificationPrefs,
  useAutoplayPatterns, useRecurrenceRules, useRecurrenceOverrides,
  migrateRecurrenceData, todayISO,
} from '../state.js';
import { recurringStacksForDate, makeRule } from '../recurrence.js';
import { resolveLaunchHref, stackThumbnailUrl } from '../lib/mediaStore.js';
import { isSupplementItem, isAccessoryItem, affiliateUrlFor, applyIfWindow, scheduleIfNotifications, clearIfNotifications } from '../lib/tags.js';
import AddStackModal from '../AddStackModal.jsx';
import { fetchProtocol, mergeDailyItems } from '../protocols.js';
import { LS_KEYS } from '../config.js';
import { DirectMediaPlayer } from '../MediaPlayer.jsx';
import SortableList from '../SortableList.jsx';
import { requestPermission, scheduleStackNotifications, clearAllScheduled } from '../notifications.js';
import { downloadSlotIcs } from '../lib/ics.js';
import { ensurePersistentStorage } from '../lib/storagePersist.js';
import { m, AnimatePresence, useReducedMotion, motionPresets } from '../motion.js';
import { DUR, STAGGER, EASE, SPRING, glideIndicator, toastIn, borderTrace, sheetUp, pressScale } from '../lib/motion';
import { IconTrash, IconCopy, IconPlus, IconShoppingCart, IconExternalLink, IconBookOpen, IconCalendar, Tickbox } from '../components/icons.jsx';
import { InlineRename } from '../components/shared.jsx';
import MergedStack from '../components/today/MergedStack.jsx';
import UserStackBody from '../components/today/UserStackBody.jsx';
import { ClearCalendarModal, NotificationOverlay, AddProtocolModal, DragMergePlusOverlay } from '../components/today/overlays.jsx';
import { KNOWN_AUDIO_MODULES } from '../constants/knownAudioModules.js';
import { queueAck } from '../lib/assistantSync.js';

/* ═══════════════════════════════════════════
   Phase 1.4 (2026-05-23) — DateStrip
   Horizontal scrollable date list: previous 7 days through next 30 days.
   Today is highlighted with navy #232C3B (brand ink). The user-selected
   date is highlighted with an accent ring + accent text.
   ═══════════════════════════════════════════ */
const DateStrip = React.forwardRef(function DateStrip({ selectedDate, onSelect }, jumpRef) {
  const today = todayISO();
  const stripRef = useRef(null);
  const todayRef = useRef(null);
  // Iter 2 Phase 6.2 — expose jumpToToday() to parent via imperative ref.
  React.useImperativeHandle(jumpRef, () => ({
    jumpToToday: () => {
      if (todayRef.current && stripRef.current) {
        const node = todayRef.current;
        const parent = stripRef.current;
        const left = node.offsetLeft - parent.clientWidth / 2 + node.clientWidth / 2;
        parent.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
      }
      onSelect(today);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  }), [today, onSelect]);

  const days = useMemo(() => {
    const out = [];
    const base = new Date(today + 'T12:00:00');
    for (let i = -7; i <= 30; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      out.push({
        iso,
        weekday: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
        day: d.getDate(),
        month: d.toLocaleDateString(undefined, { month: 'short' }),
      });
    }
    return out;
  }, [today]);

  useEffect(() => {
    if (todayRef.current && stripRef.current) {
      const node = todayRef.current;
      const parent = stripRef.current;
      const left = node.offsetLeft - parent.clientWidth / 2 + node.clientWidth / 2;
      parent.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
    }
  }, []);

  return (
    <div
      ref={stripRef}
      className="flex gap-2 overflow-x-auto pb-3 mb-6 scrollbar-thin"
      style={{ scrollSnapType: 'x mandatory' }}
      role="tablist"
      aria-label="Date navigation"
    >
      {/* Liquid-glass (board 01, clip 3): selection is ONE pill that GLIDES
          between days via layoutId — buttons stay still, labels colour-fade.
          The pill is solid accent (it moves → no blur, perf law). */}
      {days.map(d => {
        const isToday = d.iso === today;
        const sel = d.iso === selectedDate;
        return (
          <button
            key={d.iso}
            ref={isToday ? todayRef : null}
            type="button"
            role="tab"
            aria-selected={sel}
            onClick={() => onSelect(d.iso)}
            className="seg-opt shrink-0 flex flex-col items-center justify-center"
            style={{
              width: 54, padding: '9px 0', borderRadius: 'var(--r-16)',
              background: 'var(--col-surface)',
              color: sel ? 'var(--col-on-accent)' : 'var(--col-ink)',
              boxShadow: isToday && !sel
                ? 'var(--elv-1), 0 0 0 2px var(--col-accent) inset'
                : 'var(--elv-1)',
              scrollSnapAlign: 'center',
              transition: 'color var(--dur-mid) var(--ease)',
            }}
            title={d.iso}
          >
            {sel && (
              <m.span
                className="glide-pill"
                aria-hidden="true"
                style={{ borderRadius: 'var(--r-16)' }}
                {...glideIndicator('day-pill')}
              />
            )}
            <span className={'seg-label ' + (sel ? '' : 'text-muted')} style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}>{d.weekday}</span>
            <span className="font-display tnum" style={{ fontSize: 18, lineHeight: 1, marginTop: 3 }}>{d.day}</span>
            <span className={'seg-label ' + (sel ? '' : 'text-muted')} style={{ fontSize: 9, marginTop: 2, opacity: 0.75, textTransform: 'uppercase' }}>{d.month}</span>
          </button>
        );
      })}
    </div>
  );
});

/* ═══════════════════════════════════════════
   NEW — /today
   ═══════════════════════════════════════════ */
// Daily completion ring — gold progress arc + count. Reads already-computed
// counts (no new persisted state). Reduced-motion users still get the static arc.
function CompletionRing({ done, total, hero = false }) {
  const pct = total > 0 ? done / total : 0;
  const allDone = total > 0 && done === total;
  if (hero) {
    // Large gradient ring for the Next-up hero (buildspec §4.1.4).
    const r = 38;
    const circ = 2 * Math.PI * r;
    const pctNum = Math.round(pct * 100);
    return (
      <div className="relative shrink-0" style={{ width: 92, height: 92 }} aria-label={`${pctNum}% of today done`}>
        <svg width="92" height="92" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r={r} fill="none" stroke="var(--col-inset)" strokeWidth="9" />
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke="url(#ppwHeroRing)" strokeWidth="9" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            transform="rotate(-90 48 48)"
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
          />
          <defs>
            <linearGradient id="ppwHeroRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F5A623" /><stop offset="1" stopColor="rgb(var(--c-accent))" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="tnum" style={{ fontSize: 22, fontWeight: 700 }}>{pctNum}%</b>
          <span className="text-muted" style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>today</span>
        </div>
      </div>
    );
  }
  const r = 11;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-1.5 shrink-0" title={`${done} of ${total} done`} aria-label={`${done} of ${total} done`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="14" cy="14" r={r} fill="none" stroke="var(--col-inset)" strokeWidth="3" />
        <circle
          cx="14" cy="14" r={r} fill="none"
          stroke="rgb(var(--c-accent))" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="text-xs text-muted tracking-wide tabular-nums">{done}/{total}{allDone ? ' ✓' : ''}</span>
    </div>
  );
}

// Consecutive-day completion streak, read from the existing
// ppw.completedToday::<DATE> storage (no new persisted state, no backend).
// A day counts toward the streak if it has >=1 completed item. Anchored to
// today, or yesterday when today is still empty, so a fresh morning doesn't
// read 0 before the first tick of the day.
function isoMinusDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function computeCompletionStreak() {
  if (typeof localStorage === 'undefined') return 0;
  const prefix = LS_KEYS.COMPLETED_TODAY + '::';
  const doneDays = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || k.indexOf(prefix) !== 0) continue;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || 'null');
      if (Array.isArray(arr) && arr.length > 0) doneDays.add(k.slice(prefix.length));
    } catch (_) { /* skip malformed */ }
  }
  const today = todayISO();
  let anchor = doneDays.has(today) ? today : isoMinusDays(today, 1);
  let streak = 0;
  while (doneDays.has(anchor)) { streak++; anchor = isoMinusDays(anchor, 1); }
  return streak;
}

// Gold flame chip — surfaces the active streak. Hidden when streak < 1 so a
// fresh user never sees a discouraging zero.
function StreakChip({ count }) {
  if (!count || count < 1) return null;
  return (
    <div
      className="inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-1 transition-transform"
      style={{ backgroundColor: 'var(--accent-soft)', border: '1px solid rgb(var(--c-accent) / 0.3)', minHeight: 28 }}
      title={`${count}-day streak`}
      aria-label={`${count} day streak`}
    >
      <svg width="11" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="rgb(var(--c-accent))"
          d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
        />
      </svg>
      <span className="text-xs font-bold tabular-nums" style={{ color: 'rgb(var(--c-accent))' }}>{count}</span>
    </div>
  );
}

// D2 (2026-06-11) — an item is "assistant-origin" when its underlying stack
// carries source:'assistant'. Holds for both one-off user stacks and the
// stack inside a recurring rule (it.userStack === rule.stack). Returns the
// server op id (for ack) or null.
function assistantOpIdOf(it) {
  const st = it && it.userStack;
  return st && st.source === 'assistant' && st.assistantOpId ? st.assistantOpId : null;
}

// Small helix chip marking a coach-created row.
function AssistantChip() {
  return (
    <span
      className="inline-flex items-center justify-center shrink-0 rounded-full"
      style={{ width: 18, height: 18, background: 'var(--accent-soft)', border: '1px solid rgb(var(--c-accent) / 0.35)' }}
      title="Added by your Wellness Assistant"
      aria-label="Added by your Wellness Assistant"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-accent))" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M5 3c0 6 14 6 14 12M19 3c0 6-14 6-14 12M5 21h14M5 3h14" />
      </svg>
    </span>
  );
}

function TodayView() {
  // Phase 1.4 (2026-05-23) — selected date drives every per-date state hook.
  const [selectedDate, setSelectedDate] = useState(() => todayISO());

  const [activeProtocols, setActiveProtocols] = useActiveProtocols();
  const [activeModules, setActiveModules] = useActiveModules();
  const [activeRoutines, setActiveRoutines] = useActiveRoutines();
  const { isDone, toggle, completed } = useCompletedToday(selectedDate);
  const [dailyOrder, setDailyOrder] = useDateScopedStorage(LS_KEYS.DAILY_ORDER, selectedDate, []);
  const [timeOverrides, setTimeOverrides] = useDateScopedStorage(LS_KEYS.DAILY_TIMES, selectedDate, {});
  const { isHidden, hide, hideMany, unhideAll, hiddenIds } = useDailyHidden(selectedDate);
  const { duplicates, addDuplicate, removeDuplicate, updateDuplicateTime, clearDuplicates } = useDailyDuplicates(selectedDate);
  const {
    merges,
    mergeOnto, unmergeItem, dissolveMerge,
    setMergeTitle, setActiveTab, pruneMissing,
    setMergeTime, setPlayOrder, setCollapsed,
    setMergeMode, dissolveAll,
  } = useDailyMerges(selectedDate);
  // Phase 2 (2026-05-23) — user-created stacks per-date.
  const { stacks: userStacks, addStack: addUserStack, updateStack: updateUserStack, removeStack: removeUserStack, clearStacks: clearUserStacks } = useUserStacks(selectedDate);
  // 2026-06-03 — recurrence: global rules + per-date overrides for selectedDate.
  const { rules: recurrenceRules, addRule: addRecurrenceRule, removeRule: removeRecurrenceRule } = useRecurrenceRules();
  const { overrides: recurrenceOverrides, deleteOccurrence, patchOccurrence } = useRecurrenceOverrides(selectedDate);
  // Run-once non-destructive migration on first load.
  useEffect(() => { migrateRecurrenceData(); }, []);
  // Scope sheet for deleting a recurring item (This day only / All occurrences).
  const [pendingRecurringDelete, setPendingRecurringDelete] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  // Iter 2 Phase 6.4 — Add Protocol modal + transient toast.
  const [addProtocolOpen, setAddProtocolOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // Iter 2 Phase 6.2 — imperative ref into DateStrip for the Today jump.
  const dateStripRef = useRef(null);
  // Iter 2 Phase 6.5 / 7.0 — notification prefs (bell icon + scheduling gate).
  const [notifPrefs, setNotifPrefs] = useNotificationPrefs();
  const [autoplayPatterns, setAutoplayPatterns] = useAutoplayPatterns();
  // Iter 2 Phase 7.2 — currently-firing stack (drives in-app overlay).
  const [firedItem, setFiredItem] = useState(null);
  // Phase 3.1 (2026-05-23) — IF prefs (eating window + auto-arrange + notifications).
  const [ifPrefs] = useIfPrefs();
  // M9: rename any routine stack title (single OR merged).
  const { getTitle, setTitle: setItemTitle } = useDailyTitles();
  // M14 — visual feedback target during the drag-handle gesture.
  // Set when SortableList tells us the dragged card's centre overlaps a target.
  const [mergeDragOverId, setMergeDragOverId] = useState(null);

  const [protocols, setProtocols] = useState([]);
  const [moduleEntries, setModuleEntries] = useState([]);
  const [expanded, setExpanded] = useState(null);
  // id of item whose time picker is currently open
  const [editingTimeId, setEditingTimeId] = useState(null);
  // Iter 2 Phase 5 — multi-select state. Tickbox in every row toggles ids
  // into this Set; Merge/Delete operate on the full set then clear.
  // Patch 1 (2026-05-24): Merge/Delete promoted to the top sticky toolbar;
  // floating SelectionActionBar removed. Master tickbox added with Gmail
  // empty/mixed/full semantics.
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const isSelected = useCallback((id) => selectedIds.has(id), [selectedIds]);
  const toggleSelected = useCallback((id) => {
    setSelectedIds(cur => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);
  // Patch 1 — Clear calendar modal.
  const [clearOpen, setClearOpen] = useState(false);
  // Redesign (2026-06-03) — overflow ⋮ menu for rare actions (select-all,
  // clear, create routine) so the action row stays to two balanced pills.
  const [overflowOpen, setOverflowOpen] = useState(false);
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const presets = motionPresets(reduced);

  useEffect(() => {
    let cancelled = false;
    Promise.all(activeProtocols.map(id => fetchProtocol(id))).then(arr => {
      if (cancelled) return;
      setProtocols(arr.filter(Boolean));
      // M14 — sentinel: mark hydrated only AFTER the async fetch resolved.
      setHasProtocolsHydrated(true);
    });
    return () => { cancelled = true; };
  }, [activeProtocols]);

  useEffect(() => {
    let cancelled = false;
    Promise.all(activeModules.map(async slug => {
      const known = KNOWN_AUDIO_MODULES.find(m => m.slug === slug);
      const media = await loadMedia(moduleMediaPath('audio', slug));
      return { slug, media, scheduledTime: known?.defaultTime || '14:30' };
    })).then(arr => {
      if (cancelled) return;
      setModuleEntries(arr);
      // M14 — sentinel: mark hydrated only AFTER the async fetch resolved.
      setHasModulesHydrated(true);
    });
    return () => { cancelled = true; };
  }, [activeModules]);

  const baseItems = useMemo(
    () => mergeDailyItems({ protocols, activeRoutines, activeModuleEntries: moduleEntries }),
    [protocols, activeRoutines, moduleEntries]
  );

  // Phase 2 (2026-05-23) — user-created stacks projected into the items list.
  const userStackItems = useMemo(() => {
    return userStacks.map(s => ({
      kind: 'user',
      id: s.id,
      isUserStack: true,
      userStack: s,
      time: s.time,
      category: 'user_' + s.type,
      label: s.title || s.text || s.url || '(Untitled)',
      duration_min: Math.max(0, Math.ceil((s.durationSec || 0) / 60)),
      notes: null,
    }));
  }, [userStacks]);

  // 2026-06-03 — recurring stacks projected onto selectedDate. Each rule that
  // occurs today (minus per-date {deleted}, plus per-date {patch}) becomes a
  // user-stack-shaped item. The id is rule-id + date so completed / order /
  // time state is naturally per-date and never bleeds across dates.
  const recurringStackItems = useMemo(() => {
    return recurringStacksForDate(recurrenceRules, recurrenceOverrides, selectedDate).map(({ ruleId, stack }) => ({
      kind: 'user',
      id: `${ruleId}::${selectedDate}`,
      isUserStack: true,
      isRecurring: true,
      ruleId,
      userStack: stack,
      time: stack.time,
      category: 'user_' + stack.type,
      label: stack.title || stack.text || stack.url || '(Untitled)',
      duration_min: Math.max(0, Math.ceil((stack.durationSec || 0) / 60)),
      notes: null,
    }));
  }, [recurrenceRules, recurrenceOverrides, selectedDate]);

  // Resolve duplicate snapshots into "live" items. A duplicate carries its own
  // instanceId so deleting it never affects siblings. We rehydrate display
  // fields (label, kind, etc.) from the duplicate's own snapshot since the
  // source item may have been hidden or edited since it was created.
  const duplicateItems = useMemo(() => {
    return duplicates.map(d => ({
      kind: d.kind || 'duplicate',
      id: d.instanceId,                // unique stable id used everywhere
      isDuplicate: true,
      sourceId: d.sourceId,
      time: d.time,
      category: d.category,
      label: d.label,
      duration_min: d.duration_min || 0,
      notes: d.notes,
      media_ref: d.media_ref || null,
      fascia_routine: d.fascia_routine || null,
      zones: d.zones || null,
      level: d.level || null,
      lifestyle: d.lifestyle || null,
    }));
  }, [duplicates]);

  // Apply user-defined order, hidden filter, time overrides, and append
  // per-day duplicates. Hidden filter is applied LAST so duplicates of hidden
  // sources still show.
  const items = useMemo(() => {
    const applyOverride = (it) => timeOverrides[it.id] ? { ...it, time: timeOverrides[it.id] } : it;
    const all = [...baseItems, ...duplicateItems, ...userStackItems, ...recurringStackItems];
    let ordered;
    if (!dailyOrder || dailyOrder.length === 0) {
      ordered = all.map(applyOverride);
    } else {
      const byId = new Map(all.map(it => [it.id, it]));
      ordered = [];
      for (const id of dailyOrder) {
        if (byId.has(id)) {
          ordered.push(applyOverride(byId.get(id)));
          byId.delete(id);
        }
      }
      for (const it of all) if (byId.has(it.id)) ordered.push(applyOverride(it));
    }
    // N15: hide individual items without affecting siblings.
    const filtered = ordered.filter(it => !hiddenIds.includes(it.id));
    // Phase 1.1 fix (2026-05-23): only sort by time when the user has NOT
    // manually reordered. Sorting always would clobber dailyOrder on every
    // memo recompute — the "stacks snap back" bug Vic flagged.
    if (!dailyOrder || dailyOrder.length === 0) {
      filtered.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    }
    // Phase 3.1 — IF auto-arranger: move food items inside the eating window.
    return applyIfWindow(filtered, ifPrefs);
  }, [baseItems, duplicateItems, userStackItems, recurringStackItems, dailyOrder, timeOverrides, hiddenIds, ifPrefs]);

  // Lookup table for tab body rendering inside MergedStack.
  const itemsById = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  // M14 — Fully-loaded sentinel.
  // The M9 v1 caveat: on reload, the FIRST `pruneMissing` could fire before
  // every async data source had hydrated, occasionally wiping merges.
  // Sentinel flips true ONLY after protocols, moduleEntries, and duplicates
  // have ALL resolved at least once (i.e. all hydrators have fired).
  // pruneMissing is gated until then. Single-shot guard.
  const loadedSentinelRef = useRef(false);
  const [hasProtocolsHydrated, setHasProtocolsHydrated] = useState(false);
  const [hasModulesHydrated, setHasModulesHydrated] = useState(false);
  const [hasDuplicatesHydrated, setHasDuplicatesHydrated] = useState(false);

  // M14 fixed — protocols/modules hydration is set inside the .then() of
  // their respective fetch useEffects (above). duplicates comes from
  // useLocalStorage which hydrates synchronously, so we mark it on mount.
  useEffect(() => { setHasDuplicatesHydrated(true); }, []);
  // If the user has zero active protocols/modules, the fetch effect's .then()
  // still resolves immediately with [] — but we set a fallback timer here in
  // case .then never fires (e.g. cancelled before resolve).
  useEffect(() => {
    const t = setTimeout(() => {
      setHasProtocolsHydrated(true);
      setHasModulesHydrated(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loadedSentinelRef.current) return;
    if (hasProtocolsHydrated && hasModulesHydrated && hasDuplicatesHydrated) {
      loadedSentinelRef.current = true;
    }
  }, [hasProtocolsHydrated, hasModulesHydrated, hasDuplicatesHydrated]);

  useEffect(() => {
    if (!loadedSentinelRef.current) return;       // gate prune until hydrated
    if (!items) return;
    pruneMissing(items.map(it => it.id));
  }, [items, pruneMissing, hasProtocolsHydrated, hasModulesHydrated, hasDuplicatesHydrated]);

  // For the top-level list, each merge appears as ONE row anchored to its
  // first member's id. Other merge members are hidden from the top list
  // (they show as tabs inside the stack).
  const mergeLeadByItemId = useMemo(() => {
    const lead = new Map();
    const hidden = new Set();
    for (const [mid, m] of Object.entries(merges)) {
      const ids = (m.itemIds || []).filter(id => itemsById.has(id));
      if (ids.length < 2) continue;
      lead.set(ids[0], mid);
      for (let i = 1; i < ids.length; i++) hidden.add(ids[i]);
    }
    return { lead, hidden };
  }, [merges, itemsById]);

  const visibleItems = useMemo(
    () => items.filter(it => !mergeLeadByItemId.hidden.has(it.id)),
    [items, mergeLeadByItemId]
  );

  const handleReorder = (newItems) => {
    setDailyOrder(newItems.map(it => it.id));
  };

  // Renamed title (if any) > source label.
  const titleFor = useCallback((it) => getTitle(it.id, it.label), [getTitle]);

  // Shared body renderer — used for top-level cards (when expanded) AND for
  // merged-stack tab content. `inMerge` adds a "remove from stack" button.
  // Phase 2 (2026-05-23) — auto-advance: when a stack's media ends, expand
  // the next visible item so the user sees the next stack inline.
  const advanceToNext = useCallback((currentId) => {
    const idx = items.findIndex(x => x.id === currentId);
    if (idx < 0 || idx + 1 >= items.length) return;
    const next = items[idx + 1];
    setExpanded(next.id);
  }, [items]);

  const renderItemBody = (it, inMerge) => {
    const done = isDone(it.id);
    return (
      <div className={(inMerge ? '' : 'px-4 pb-4') + ' space-y-3 ' + (inMerge ? '' : 'border-t border-cream/5')}>
        {it.isUserStack && it.userStack && (
          <div className="pt-3">
            <UserStackBody
              stack={it.userStack}
              onEnded={() => advanceToNext(it.id)}
              onPatch={(patch) => it.isRecurring ? patchOccurrence(it.ruleId, patch) : updateUserStack(it.id, patch)}
            />
          </div>
        )}
        {it.notes && <p className="text-muted text-sm pt-3">{it.notes}</p>}
        {it.kind === 'routine' && it.zones && (
          <div className="pt-3">
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Saved zones</div>
            <div className="flex flex-wrap gap-2">
              {it.zones.map(z => (
                <span key={z} className="text-xs px-2 py-1 rounded-full bg-cream/5 border border-cream/10">
                  {ZONES.find(x => x.code === z)?.label || z}
                </span>
              ))}
            </div>
          </div>
        )}
        {it.media_ref && (
          <div className="pt-2">
            <DirectMediaPlayer media={it.media_ref} autoplay={inMerge} />
          </div>
        )}
        {it.fascia_routine && it.fascia_routine.body_zone_chain && (
          <div className="text-xs text-muted">
            Targets fascia chain: <span className="text-accent">{it.fascia_routine.body_zone_chain.replace(/_/g, ' ')}</span>
            {' '}({resolveRoutineZones(it.fascia_routine).length} zones)
          </div>
        )}
        {/* Morph CTA (board 01, clip 1): Mark done ↔ Done cross-fades colour
            in place with a squishy press — reshape, not swap. */}
        <m.button
          onClick={() => toggle(it.id)}
          className={'w-full text-center py-2.5 rounded-full text-sm font-bold transition-all ' + (done ? 'bg-cream/10 text-muted' : 'bg-accent text-bg')}
          {...pressScale()}
        >
          {done ? '✓ Done — tap to undo' : 'Mark done'}
        </m.button>
        <button
          onClick={() => handleDuplicate(it)}
          className="w-full text-center py-2 rounded-full text-xs font-bold border border-accent/40 text-accent hover:bg-accent/5 transition-colors"
          title="Add a copy 4 hours later — drag to reorder, tap time to edit"
        >
          + Duplicate (later today)
        </button>
        {inMerge && (
          <button
            onClick={() => {
              if (window.confirm('Remove this tab from the merged stack? It returns to the main list.')) {
                unmergeItem(it.id);
              }
            }}
            className="w-full text-center py-2 rounded-full text-xs font-bold border border-accent/30 text-accent/80 hover:text-accent transition-colors"
          >
            Remove from stack
          </button>
        )}
        <button
          onClick={() => {
            // Recurring items open the scope sheet (This day only / All
            // occurrences). One-off items keep the simple confirm.
            if (it.isRecurring) { setPendingRecurringDelete(it); return; }
            if (window.confirm('Remove just this item from today? Other items in your stack stay.')) {
              handleRemoveItem(it);
            }
          }}
          className="w-full text-center py-2 rounded-full text-xs font-bold border border-cream/10 text-muted hover:text-accent hover:border-accent transition-colors"
        >
          Remove from daily plan
        </button>
      </div>
    );
  };

  // Phase 1.2 (2026-05-23) — drag-merge inherits the EARLIER start time
  // of the two cards (Vic spec: "Merged stack inherits the EARLIER start
  // time and TOTAL duration is the longer of the two — they play in
  // parallel, side by side"). Replaces M14's "destination time wins" rule.
  const handleSortableMergeDrop = useCallback((activeId, overId) => {
    if (!activeId || !overId || activeId === overId) return;
    const draggedItem = itemsById.get(activeId);
    const targetItem  = itemsById.get(overId);
    if (!draggedItem || !targetItem) return;
    const a = draggedItem.time || null;
    const b = targetItem.time || null;
    const earlier = (a && b) ? (a.localeCompare(b) <= 0 ? a : b) : (a || b || null);
    mergeOnto(activeId, overId, { time: earlier });
  }, [itemsById, mergeOnto]);

  const handleSortableDragOverChange = useCallback((info) => {
    if (info && info.isMergeZone) {
      setMergeDragOverId(info.overId);
    } else {
      setMergeDragOverId(null);
    }
  }, []);

  // Persist a new time for an item. Routine items are special-cased so the
  // change also updates the routine settings the rest of the app reads from.
  // Duplicates store their own time on the duplicate record (per-instance).
  const handleTimeChange = useCallback((it, newTime) => {
    if (!newTime) return;
    if (it.isDuplicate) {
      updateDuplicateTime(it.id, newTime);
      return;
    }
    if (it.kind === 'routine') {
      setActiveRoutines(prev => ({ ...prev, scheduledTime: newTime }));
    }
    setTimeOverrides(prev => ({ ...prev, [it.id]: newTime }));
  }, [setActiveRoutines, setTimeOverrides, updateDuplicateTime]);

  // N15: remove a SINGLE item from today's plan, leaving its siblings intact.
  // Protocols/modules/routines stay active in localStorage; we just hide the
  // individual id from the rolling "Today" view. Duplicates are removed from
  // the duplicates list directly. Bulk-clear is the explicit "Remove stack"
  // button, never a side effect.
  const handleRemoveItem = useCallback((it) => {
    if (it.isRecurring) {
      // Safe default (Vic's law): a plain delete of a recurring item only
      // skips THIS date via a per-date override — it never cascades. The
      // explicit scope sheet is what offers "All occurrences". This default
      // also makes bulk-delete of recurring items non-destructive.
      deleteOccurrence(it.ruleId);
    } else if (it.isUserStack) {
      removeUserStack(it.id);
      // D2 — tell the coach a one-off assistant item was locally deleted so its
      // server-side plan op is marked deleted and never re-pulled.
      const opId = assistantOpIdOf(it);
      if (opId) queueAck(opId, 'deleted');
    } else if (it.isDuplicate) {
      removeDuplicate(it.id);
    } else {
      hide(it.id);
    }
    setDailyOrder(cur => (cur || []).filter(id => id !== it.id));
    setTimeOverrides(cur => {
      if (!cur || !(it.id in cur)) return cur;
      const next = { ...cur };
      delete next[it.id];
      return next;
    });
    setExpanded(prev => prev === it.id ? null : prev);
  }, [hide, removeDuplicate, removeUserStack, deleteOccurrence, setDailyOrder, setTimeOverrides]);

  // 2026-06-03 — resolve the recurring-delete scope sheet choice.
  const handleConfirmRecurringDelete = useCallback((mode) => {
    const it = pendingRecurringDelete;
    if (!it) return;
    if (mode === 'all') {
      removeRecurrenceRule(it.ruleId);   // cascade: drop the rule
      // D2 — only a full "all occurrences" removal acks deleted; a "this day
      // only" skip leaves the rule (and its server op) intact.
      const opId = assistantOpIdOf(it);
      if (opId) queueAck(opId, 'deleted');
    } else {
      deleteOccurrence(it.ruleId);                          // this day only
    }
    setDailyOrder(cur => (cur || []).filter(id => id !== it.id));
    setTimeOverrides(cur => {
      if (!cur || !(it.id in cur)) return cur;
      const next = { ...cur };
      delete next[it.id];
      return next;
    });
    setExpanded(prev => prev === it.id ? null : prev);
    setPendingRecurringDelete(null);
  }, [pendingRecurringDelete, removeRecurrenceRule, deleteOccurrence, setDailyOrder, setTimeOverrides]);

  // N19: duplicate a routine card. Default time = source time + 4h, capped at
  // 23:59. Snapshot the display fields so the duplicate survives the source
  // being hidden later. New per-instance ID — totally independent.
  const handleDuplicate = useCallback((it) => {
    const [hh, mm] = (it.time || '08:00').split(':').map(Number);
    const total = (hh * 60 + mm + 4 * 60);
    const capped = Math.min(total, 23 * 60 + 59);
    const newH = String(Math.floor(capped / 60)).padStart(2, '0');
    const newM = String(capped % 60).padStart(2, '0');
    const newTime = `${newH}:${newM}`;
    const instanceId = `dup::${it.id}::${Date.now()}::${Math.floor(Math.random() * 9999)}`;
    addDuplicate({
      instanceId,
      sourceId: it.id,
      kind: it.kind,
      time: newTime,
      category: it.category,
      label: it.label,
      duration_min: it.duration_min || 0,
      notes: it.notes,
      media_ref: it.media_ref || null,
      fascia_routine: it.fascia_routine || null,
      zones: it.zones || null,
      level: it.level || null,
      lifestyle: it.lifestyle || null,
    });
  }, [addDuplicate]);

  // Wipe the whole stack — used when every item is ticked. Mirrors the
  // "Reset everything" action in Settings, but stays inline. Also clears
  // per-day hide + duplicate state so a fresh activation starts clean.
  const handleRemoveStack = useCallback(() => {
    setActiveProtocols([]);
    setActiveModules([]);
    setActiveRoutines(prev => ({ ...prev, savedZones: [] }));
    setDailyOrder([]);
    setTimeOverrides({});
    unhideAll();
    clearDuplicates();
    setExpanded(null);
  }, [setActiveProtocols, setActiveModules, setActiveRoutines, setDailyOrder, setTimeOverrides, unhideAll, clearDuplicates]);

  // Iter 2 Phase 5.3 — multi-select Merge. Take all selected ids, treat the
  // earliest-time card as the LEAD (target), and merge the rest onto it with
  // mode='tabs' so the expanded stack shows a tab strip instead of parallel-
  // play. Lead stack's time + duration become the merged defaults. Clears
  // selection on completion.
  const handleBulkMerge = useCallback(() => {
    if (selectedIds.size < 2) return;
    const ids = Array.from(selectedIds);
    const visible = ids
      .map(id => itemsById.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    if (visible.length < 2) { clearSelection(); return; }
    const lead = visible[0];
    const rest = visible.slice(1);
    // First merge creates the stack with tabs mode + lead time inherited.
    // Subsequent merges append into the existing stack (mode preserved).
    rest.forEach((it, i) => {
      const opts = i === 0 ? { time: lead.time || null, mode: 'tabs' } : {};
      mergeOnto(it.id, lead.id, opts);
    });
    clearSelection();
  }, [selectedIds, itemsById, mergeOnto, clearSelection]);

  // Iter 2 Phase 5.4 — multi-select Delete. Single confirmation modal then
  // hide() each. Per Vic Protocol HARD STOP: ALWAYS confirm. Clears selection.
  // Iter 2 Phase 6.4 — activate a protocol from the modal. Existing
  // TodayView useEffect on [activeProtocols] will re-fetch + merge its
  // daily_plan into items. Toast confirms count after re-hydration.
  const handleActivateProtocol = useCallback((p) => {
    setActiveProtocols(cur => cur.includes(p.protocol_id) ? cur : [...cur, p.protocol_id]);
    const n = p.sections?.daily_plan?.length || 0;
    setToast({ tone: 'ok', text: `${p.topic} added — ${n} stack${n === 1 ? '' : 's'} created today` });
    setAddProtocolOpen(false);
    setTimeout(() => setToast(null), 3500);
  }, [setActiveProtocols]);

  // Iter 2 Phase 6.5 / 7.0 — notifications toggle. First tap requests
  // Notification.permission. If granted -> enabled=true and the existing
  // scheduleNotifications useEffect handles per-stack timers. If denied,
  // show a brief banner explaining the user must enable in browser settings.
  // When toggled OFF, manual expand only — schedulers are cleared by the
  // existing useEffect cleanup when items deps change.
  const handleToggleNotifications = useCallback(async () => {
    if (notifPrefs.enabled) {
      setNotifPrefs(p => ({ ...p, enabled: false }));
      setToast({ tone: 'ok', text: 'Notifications off — routines stay manual.' });
      setTimeout(() => setToast(null), 2500);
      return;
    }
    if (typeof Notification === 'undefined') {
      setToast({ tone: 'warn', text: 'This browser does not support notifications.' });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await requestPermission();
    }
    if (perm === 'granted') {
      setNotifPrefs(p => ({ ...p, enabled: true }));
      setToast({ tone: 'ok', text: 'Notifications on. Reminders fire at each stack time.' });
      setTimeout(() => setToast(null), 3000);
    } else {
      setToast({ tone: 'warn', text: 'Notifications require permission. Open browser settings to enable.' });
      setTimeout(() => setToast(null), 4500);
    }
  }, [notifPrefs.enabled, setNotifPrefs]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size < 1) return;
    const n = selectedIds.size;
    const msg = `Delete ${n} stack${n === 1 ? '' : 's'} for this day?\n\nThis won't remove the protocol routine, just hide it from this day.`;
    if (!window.confirm(msg)) return;
    const ids = Array.from(selectedIds);
    ids.forEach(id => {
      // Patch 2 (2026-05-29) — merge-aware: a selected stack (lead item id)
      // removes ALL its children + dissolves, matching the old inline stack
      // delete icon. A plain item just hides itself.
      const leadMergeId = mergeLeadByItemId.lead.get(id);
      if (leadMergeId) {
        const m = merges[leadMergeId];
        (m?.itemIds || []).forEach(cid => {
          const child = itemsById.get(cid);
          if (child) handleRemoveItem(child);
        });
        dissolveMerge(leadMergeId);
      } else {
        const it = itemsById.get(id);
        if (it) handleRemoveItem(it);
      }
    });
    clearSelection();
  }, [selectedIds, itemsById, handleRemoveItem, clearSelection, mergeLeadByItemId, merges, dissolveMerge]);

  // Patch 2 (2026-05-29) — single-select Duplicate in the bulk toolbar, so the
  // inline per-stack duplicate icon can be retired for cleaner rows. Mirrors the
  // old inline behavior: a merged stack duplicates each child (+4h); a single
  // item duplicates itself.
  const handleBulkDuplicate = useCallback(() => {
    if (selectedIds.size !== 1) return;
    const id = Array.from(selectedIds)[0];
    const leadMergeId = mergeLeadByItemId.lead.get(id);
    if (leadMergeId) {
      const m = merges[leadMergeId];
      (m?.itemIds || []).forEach(cid => {
        const child = itemsById.get(cid);
        if (child) handleDuplicate(child);
      });
    } else {
      const it = itemsById.get(id);
      if (it) handleDuplicate(it);
    }
    clearSelection();
  }, [selectedIds, mergeLeadByItemId, merges, itemsById, handleDuplicate, clearSelection]);

  // Patch 1 — master tickbox: select-all-visible / clear depending on state.
  const handleMasterToggle = useCallback((state) => {
    if (state === 'empty') {
      setSelectedIds(new Set(visibleItems.map(it => it.id)));
    } else {
      clearSelection();
    }
  }, [visibleItems, clearSelection]);

  // Patch 1 — Clear handler. Wipes per-date storage for the picked day or
  // every date in the picked range. Underlying protocols/modules/routines
  // stay active globally; only that date's view of them is hidden.
  // - For selectedDate: use the React hooks so state updates synchronously.
  // - For OTHER dates: write directly to localStorage; hooks re-read on
  //   the next navigation to that date.
  const handleClearConfirm = useCallback(({ mode, day, start, end }) => {
    const dates = [];
    if (mode === 'day' && day) {
      dates.push(day);
    } else if (mode === 'range' && start && end) {
      const a = new Date(start + 'T12:00:00');
      const b = new Date(end   + 'T12:00:00');
      const d = new Date(a);
      while (d <= b) {
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
    }
    if (dates.length === 0) { setClearOpen(false); return; }

    // Hide-list = every date-independent id currently visible. Protocols /
    // audio / routines use stable, date-independent ids; user stacks and
    // duplicates are date-scoped and get wiped via the userStacks /
    // duplicates lanes instead.
    const dateIndependentIds = items
      .filter(it => !it.isUserStack && !it.isDuplicate)
      .map(it => it.id);

    const safeWrite = (key, value) => {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    };

    for (const dt of dates) {
      if (dt === selectedDate) {
        hideMany(dateIndependentIds);
        clearDuplicates();
        clearUserStacks();
        dissolveAll();
        setDailyOrder([]);
        setTimeOverrides({});
        setExpanded(null);
        clearSelection();
      } else {
        safeWrite(`ppw.dailyHidden::${dt}`,     dateIndependentIds);
        safeWrite(`ppw.dailyDuplicates::${dt}`, []);
        safeWrite(`ppw.dailyMerges::${dt}`,     {});
        safeWrite(`ppw.userStacks::${dt}`,      []);
        safeWrite(`ppw.dailyOrder::${dt}`,      []);
        safeWrite(`ppw.dailyTimes::${dt}`,      {});
      }
    }

    setClearOpen(false);
    const summary = mode === 'day' ? day : `${start} → ${end}`;
    setToast({ tone: 'ok', text: `Cleared stacks for ${summary} (${dates.length} day${dates.length === 1 ? '' : 's'}).` });
    setTimeout(() => setToast(null), 3500);
  }, [items, selectedDate, hideMany, clearDuplicates, clearUserStacks, dissolveAll, setDailyOrder, setTimeOverrides, clearSelection]);

  // P1 (2026-06-02) — ask the browser to make storage persistent so iOS / under
  // pressure can't silently evict saved routines (the likely "added then gone
  // on mobile" cause). Best-effort, one-time on mount. If it can't be granted
  // (e.g. not installed yet) we surface a one-time hint.
  useEffect(() => {
    let on = true;
    ensurePersistentStorage().then((r) => {
      if (!on) return;
      if (r.supported && !r.persisted) {
        // Don't nag — only hint once per device that installing protects data.
        try {
          if (!localStorage.getItem('ppw.persistHintShown')) {
            localStorage.setItem('ppw.persistHintShown', '1');
          }
        } catch (_) {}
      }
    });
    return () => { on = false; };
  }, []);

  // Iter 2 Phase 7.1 — schedule stack-time fires when the bell is ON AND
  // the user is viewing today. Past days never fire; future days never
  // fire (selectedDate !== todayISO). Native Notification + onFire run
  // inside scheduleStackNotifications.
  useEffect(() => {
    if (!notifPrefs.enabled) return;
    if (selectedDate !== todayISO()) return;
    scheduleStackNotifications(items, {
      onFire: (item) => {
        const key = `${item.id}__${item.time}`;
        const autoplayOptedIn = !!(autoplayPatterns && autoplayPatterns[key]);
        if (autoplayOptedIn || notifPrefs.autoplayAll) {
          // Auto-expand inline — no overlay.
          setExpanded(item.id);
        } else {
          setFiredItem(item);
        }
      },
    });
    return () => clearAllScheduled();
  }, [items, notifPrefs.enabled, notifPrefs.autoplayAll, autoplayPatterns, selectedDate]);

  // Phase 3.1 — schedule IF window open / pre-close / close notifications.
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      scheduleIfNotifications(ifPrefs);
    }
    return () => clearIfNotifications();
  }, [ifPrefs]);

  // Phase 1.4 — heading reflects the selected date, not always "today".
  const headingDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  const completedCount = items.filter(it => completed.includes(it.id)).length;
  const empty = items.length === 0;
  const allDone = !empty && completedCount === items.length;
  // Streak recomputes whenever today's completion set changes (toggle a tick).
  const streak = useMemo(() => computeCompletionStreak(), [completed, selectedDate]);

  // Redesign — month/year header line + the "Next up" hero source item.
  const monthLabel = new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'long' });
  const yearLabel = new Date(selectedDate + 'T12:00:00').getFullYear();
  const nextUp = useMemo(() => {
    const pending = visibleItems.filter(it => !completed.includes(it.id));
    if (pending.length === 0) return null;
    const nowHM = new Date().toTimeString().slice(0, 5);
    const upcoming = pending.find(it => (it.time || '99:99') >= nowHM);
    return upcoming || pending[0];
  }, [visibleItems, completed]);

  return (
    <main className="px-5 pt-1 pb-28 max-w-3xl mx-auto">
      {/* Sticky top bar — month line · date strip · rebalanced action row.
          Token-driven surface so it flips light↔dark. Sits below the global
          Header (z-40); uses z-30. Full-bleed via negative-x margin. */}
      <div
        className="sticky z-30 -mx-5 px-5 pt-2 pb-2"
        style={{
          top: 56,
          background: 'var(--glass-bg-strong)',
          backdropFilter: 'saturate(150%) blur(var(--glass-blur-2))',
          WebkitBackdropFilter: 'saturate(150%) blur(var(--glass-blur-2))',
          borderBottom: '1px solid var(--glass-border)',
          boxShadow: '0 1px 0 var(--glass-highlight) inset',
        }}
      >
        {/* Month line — big display month + year (left), glance cluster (right). */}
        <div className="flex items-end justify-between mb-1.5">
          <div className="min-w-0">
            <div className="font-display leading-none" style={{ fontSize: 26, letterSpacing: '-0.02em' }}>
              {monthLabel}<span className="text-muted ml-1.5" style={{ fontSize: 15, fontWeight: 500 }}>{yearLabel}</span>
            </div>
            <button
              type="button"
              onClick={() => dateStripRef.current?.jumpToToday()}
              className="mt-1 inline-flex items-center gap-1 today-time-chip"
              style={{ height: 26, minHeight: 26, padding: '0 12px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                borderColor: selectedDate === todayISO() ? 'var(--col-accent)' : 'var(--hairline)' }}
              aria-label="Jump to today"
              title="Jump to today"
            >Today</button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <StreakChip count={streak} />
            {items.length > 0 && <CompletionRing done={completedCount} total={items.length} />}
          </div>
        </div>
        <DateStrip ref={dateStripRef} selectedDate={selectedDate} onSelect={setSelectedDate} />

        {/* Rebalanced action row — two equal pills + ⋮ overflow (bell moved to
            bottom nav per Vic change #1). Rare actions (select-all, clear,
            create routine) live under ⋮ so nothing crowds at 360px. */}
        <div className="grid items-center gap-2.5" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
          <m.button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="btn-accent flex items-center justify-center gap-2"
            style={{ height: 44, padding: 0 }}
            title="Add a custom stack"
            {...pressScale()}
          >
            <IconPlus /><span className="text-sm">Stack</span>
          </m.button>
          {/* REF-08: labelled secondary action = glass capsule. */}
          <m.button
            type="button"
            onClick={() => setAddProtocolOpen(true)}
            className="glass-capsule flex items-center justify-center gap-2 text-sm font-bold"
            style={{ height: 44, padding: 0 }}
            title="Add a science protocol from your library"
            {...pressScale()}
          >
            <IconBookOpen /><span className="text-sm">Protocol</span>
          </m.button>
          <div className="relative">
            {/* REF-08: icon-only action = circular glass disc. */}
            <button
              type="button"
              onClick={() => setOverflowOpen(v => !v)}
              className="glass-disc"
              style={{ height: 44, width: 44, padding: 0, fontSize: 20, color: 'var(--col-ink)' }}
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              aria-label="More actions"
              title="More — select all, clear, create routine"
            >⋯</button>
            {overflowOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOverflowOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="absolute right-0 mt-2 z-50 card p-1.5"
                  style={{ minWidth: 208 }}
                >
                  <button role="menuitem" type="button" onClick={() => { handleMasterToggle(selectedIds.size === 0 ? 'empty' : 'full'); setOverflowOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-cream/5 flex items-center gap-2">
                    <span aria-hidden="true">☑</span>{selectedIds.size === 0 ? 'Select all on this day' : 'Clear selection'}
                  </button>
                  <button role="menuitem" type="button" onClick={() => { setClearOpen(true); setOverflowOpen(false); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-cream/5 flex items-center gap-2">
                    <IconCalendar /> Clear a day or range…
                  </button>
                  <button role="menuitem" type="button" onClick={() => { setOverflowOpen(false); nav('/welcome'); }} className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-cream/5 flex items-center gap-2">
                    <span aria-hidden="true">◆</span> Create personalised routine
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-cream/10 flex-wrap">
            <button
              type="button"
              onClick={handleBulkMerge}
              disabled={selectedIds.size < 2}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: selectedIds.size >= 2 ? 'var(--col-accent)' : 'transparent', color: selectedIds.size >= 2 ? 'var(--col-on-accent)' : 'var(--col-ink)', border: '1px solid var(--col-accent)' }}
              title={selectedIds.size >= 2 ? 'Merge selected into one tabbed stack' : 'Select 2 or more to merge'}
            >
              <span>Merge ({selectedIds.size})</span>
            </button>
            {selectedIds.size === 1 && (
              <button
                type="button"
                onClick={handleBulkDuplicate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
                style={{ backgroundColor: 'transparent', color: 'var(--col-ink)', border: '1px solid var(--col-accent)' }}
                title="Duplicate the selected stack (adds a copy 4h later)"
              >
                <IconCopy /><span>Duplicate</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold transition-all"
              style={{ backgroundColor: 'transparent', color: 'rgb(var(--c-status-alert))', border: '1px solid rgb(var(--c-status-alert) / 0.6)' }}
              title="Delete selected stacks from this day"
            >
              <IconTrash /><span>Delete</span>
            </button>
            <div className="flex-1" />
            <span className="text-[11px] text-muted font-bold">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={clearSelection}
              className="w-7 h-7 flex items-center justify-center text-muted hover:text-cream"
              aria-label="Clear selection"
              title="Clear selection"
            >×</button>
          </div>
        )}
      </div>

      {/* Next-up hero — liquid-glass (board 01): the ONE frosted card floating
          over the organic texture zone (clip 6, dark theme only via
          --hero-art-opacity). The accent border TRACES around it when the
          next-up item changes (clip 4). Big thin tabular numerals. */}
      {!empty && (
        <div className="relative mt-4">
          <div className="hero-art" aria-hidden="true">
            <img
              src={`${import.meta.env.BASE_URL}assets/backgrounds/fascia_fluid_motion.png`}
              alt=""
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <div
            className="glass-strong relative flex items-center justify-between gap-4 overflow-hidden"
            style={{ padding: '20px 22px', borderRadius: 'var(--r-24)' }}
          >
            {!reduced && nextUp && (
              <svg className="border-trace" aria-hidden="true" key={nextUp.id}>
                <m.rect
                  x="0" y="0" rx="24"
                  width="100%" height="100%"
                  variants={borderTrace}
                  initial="hidden"
                  animate="show"
                />
              </svg>
            )}
            {nextUp ? (
              <>
                <div className="min-w-0">
                  <div className="eyebrow" style={{ color: 'rgb(var(--c-status-now))' }}>Next up</div>
                  <div className="font-display tnum" style={{ fontSize: 40, fontWeight: 350, letterSpacing: '-0.01em', lineHeight: 1, margin: '8px 0 4px' }}>{nextUp.time || '—:—'}</div>
                  <div className="text-muted text-sm truncate" style={{ maxWidth: '52vw' }}>{titleFor(nextUp)}</div>
                  <m.button
                    type="button"
                    onClick={() => setExpanded(nextUp.id)}
                    className="btn-accent mt-3 inline-flex items-center gap-1"
                    style={{ height: 38, padding: '0 18px', fontSize: 13 }}
                    whileTap={reduced ? undefined : { scale: 0.96 }}
                    transition={SPRING.press}
                  >Open ▸</m.button>
                </div>
                <CompletionRing done={completedCount} total={items.length} hero />
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <div className="eyebrow" style={{ color: 'rgb(var(--c-status-done))' }}>All done</div>
                  <div className="font-display" style={{ fontSize: 22, lineHeight: 1.1, margin: '8px 0 2px' }}>Nice work today ✓</div>
                  <div className="text-muted text-sm">Everything on this day is ticked off.</div>
                </div>
                <CompletionRing done={completedCount} total={items.length} hero />
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast — toastIn rise+fade (board 06, clip 4): soft spring, no bounce.
          Solid surface (it moves → no blur). */}
      <AnimatePresence>
        {toast && (
          <m.div
            variants={toastIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className={'mt-3 text-xs px-3 py-2 rounded-lg border ' + (toast.tone === 'ok' ? 'bg-accent/10 text-accent border-accent/30' : 'bg-cream/5 text-cream border-cream/15')}
            role="status"
          >
            {toast.text}
          </m.div>
        )}
      </AnimatePresence>


      {empty && (
        <div className="card p-10 text-center fade-in is-visible">
          <img
            src={`${import.meta.env.BASE_URL}images/science/dna-helix.webp`}
            alt=""
            aria-hidden="true"
            loading="lazy"
            width="116"
            height="116"
            className="mx-auto mb-4 rounded-2xl"
            style={{ objectFit: 'cover', boxShadow: '0 20px 50px -20px rgba(0,0,0,0.75)' }}
          />
          <div className="font-display slot-empty-title text-2xl mb-2">Nothing scheduled yet.</div>
          <p className="text-muted text-sm mb-6 max-w-sm mx-auto leading-relaxed">Activate a protocol, save a body-zone routine, or pick an audio module — they will all show up here.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/protocols" className="btn-accent tile-amber">Browse protocols</Link>
            <Link to="/welcome" className="btn-accent tile-green">Create our Personalised Release Routine</Link>
            <Link to="/modules" className="btn-ghost">Audio modules</Link>
          </div>
        </div>
      )}

      {!empty && (
        /* Loop-1 defect fix: single flowing span so the ≡ glyph never wraps
           onto its own line at 390px. */
        <p className="text-muted text-xs mb-3">
          <span className="text-accent">≡</span> Drag handle to reorder. Drop on another routine to merge them into a stack. Tap any title to rename.
        </p>
      )}

      <SortableList
        items={visibleItems}
        onReorder={handleReorder}
        onMergeDrop={handleSortableMergeDrop}
        onDragOverChange={handleSortableDragOverChange}
        className="stack-deck"
      >
        {(it, dragHandleProps, _i, isDragging) => {
          // Liquid-glass (board 01, clip 4): rows enter staggered — rise +
          // fade on the locked tokens, keyed on selectedDate so a day switch
          // re-runs the cascade. Solid cards (they drag → no blur, perf law).
          // Reduced motion → static (no initial offset, no delay, no lift).
          // REF-07 lift-to-front: the open/selected card scales to the deck
          // front on SPRING.glide (transform only); enter keeps the stagger.
          const rowDelay = Math.min(_i, 8) * (STAGGER.list / 1000);
          const deckProps = (lifted) => (reduced ? {} : {
            initial: { opacity: 0, y: 14 },
            animate: { opacity: 1, y: 0, scale: lifted ? 1.02 : 1 },
            transition: {
              opacity: { duration: DUR.base / 1000, ease: EASE.standard, delay: rowDelay },
              y: { duration: DUR.base / 1000, ease: EASE.standard, delay: rowDelay },
              scale: SPRING.glide,
            },
          });
          // M9 — render the parent MergedStack instead of a plain card when
          // this item is the LEAD member of a merge.
          const leadMergeId = mergeLeadByItemId.lead.get(it.id);
          if (leadMergeId) {
            // NB: named mergeRec, NOT m — `m` is the motion component import.
            const mergeRec = merges[leadMergeId];
            const mergeIsDragOver = mergeDragOverId === it.id;
            const mergeLifted = mergeRec.collapsed === false || isSelected(it.id);
            return (
              <m.div
                key={selectedDate}
                {...deckProps(mergeLifted)}
                style={{ position: 'relative', zIndex: mergeLifted ? 30 : undefined }}
                className={mergeIsDragOver ? 'merge-target-pulse' : ''}
              >
                <div className="flex items-stretch gap-2">
                  <button
                    {...dragHandleProps}
                    className="drag-handle font-display text-muted hover:text-accent w-11 self-stretch flex items-center justify-center text-2xl shrink-0"
                    title="Drag to reorder · drop on another routine to merge"
                  >≡</button>
                  <div className="flex-1 min-w-0">
                    <MergedStack
                      mergeId={leadMergeId}
                      merge={mergeRec}
                      itemsById={itemsById}
                      isDragOver={mergeIsDragOver}
                      onSetTitle={setMergeTitle}
                      onUnmergeItem={unmergeItem}
                      onDissolve={dissolveMerge}
                      onSetTime={setMergeTime}
                      onToggleCollapsed={setCollapsed}
                      onAddToCalendar={(mid, title, time, durationMin) => {
                        const ok = downloadSlotIcs({
                          itemId: `merge-${mid}`,
                          title: title || 'Stack',
                          dateISO: selectedDate,
                          time,
                          durationMin,
                          description: 'Merged stack',
                        });
                        setToast({ tone: ok ? 'ok' : 'err', text: ok ? 'Opening your phone calendar — confirm to add the lock-screen alarm.' : 'Could not create calendar file.' });
                        setTimeout(() => setToast(null), 4000);
                      }}
                      onSetActiveTab={setActiveTab}
                      selectionChecked={isSelected(it.id)}
                      onToggleSelection={() => toggleSelected(it.id)}
                      selectionAriaLabel={`Select stack: ${mergeRec.title || titleFor(it)}`}
                      renderTabBody={(tabItem) => renderItemBody(tabItem, true)}
                    />
                  </div>
                </div>
              </m.div>
            );
          }
          const done = isDone(it.id);
          const isOpen = expanded === it.id;
          const isEditingTime = editingTimeId === it.id;
          const isDragOver = mergeDragOverId === it.id;
          const customTitle = titleFor(it);
          const kindClass = `timeline-${it.kind === 'protocol' ? 'protocol' : it.kind === 'audio' ? 'audio' : 'routine'}`;
          const lifted = isOpen || isSelected(it.id);
          return (
            <m.div
              key={selectedDate}
              {...deckProps(lifted)}
              style={{ zIndex: lifted ? 30 : undefined }}
              className={`card today-routine-card overflow-hidden transition-all relative ${done ? 'timeline-done opacity-80' : ''} ${isOpen ? 'is-open' : ''} ${isDragging ? 'border-accent is-dragging' : ''} ${isDragOver ? 'merge-target-pulse ring-2 ring-accent/60 border-accent' : ''} ${isSelected(it.id) ? 'ring-2 ring-accent/40' : ''}`}
            >
              {isDragOver && <DragMergePlusOverlay />}
              <div className="flex items-center gap-2 p-4">
                <button
                  {...dragHandleProps}
                  className="drag-handle font-display text-muted hover:text-accent w-8 sm:w-11 h-11 flex items-center justify-center text-2xl shrink-0 -ml-2"
                  title="Drag to reorder · drop on another routine to merge"
                >≡</button>
                <Tickbox
                  checked={isSelected(it.id)}
                  onChange={() => toggleSelected(it.id)}
                  ariaLabel={`Select stack: ${customTitle || it.label}`}
                  kindClass={kindClass}
                />
                {isEditingTime ? (
                  <input
                    type="time"
                    autoFocus
                    defaultValue={it.time}
                    onBlur={(e) => { handleTimeChange(it, e.target.value); setEditingTimeId(null); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { handleTimeChange(it, e.currentTarget.value); setEditingTimeId(null); }
                      if (e.key === 'Escape') { setEditingTimeId(null); }
                    }}
                    onChange={(e) => handleTimeChange(it, e.target.value)}
                    className="font-display text-accent text-sm bg-cream/5 border border-accent rounded px-2 py-1 w-[88px] shrink-0 focus:outline-none"
                    aria-label="Edit time"
                  />
                ) : (
                  /* The settle beat (board 01): the leading time chip lands a
                     touch after its row begins — ~8% overshoot, the signature. */
                  <m.button
                    key={selectedDate}
                    initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduced ? { duration: 0 } : { ...SPRING.settle, delay: Math.min(_i, 8) * (STAGGER.list / 1000) + 0.08 }}
                    onClick={(e) => { e.stopPropagation(); setEditingTimeId(it.id); }}
                    className="today-time-chip shrink-0"
                    title="Tap to edit time"
                    aria-label={`Edit time, currently ${it.time}`}
                  >{it.time}</m.button>
                )}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {/* REF-06 — media thumbnail tile inside the glass stack card.
                      thumbnailUrl/youtubeId derive a static image (no runtime
                      fetch); offline/missing → app glyph chip fallback. */}
                  {it.isUserStack && it.userStack && (stackThumbnailUrl(it.userStack) || it.userStack.appKind) && (
                    <span
                      className="glass-disc shrink-0 overflow-hidden"
                      style={{ width: 36, height: 36, borderRadius: 10 }}
                      aria-hidden="true"
                    >
                      {stackThumbnailUrl(it.userStack) ? (
                        <img
                          src={stackThumbnailUrl(it.userStack)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: 14 }}>{it.userStack.appKind === 'spotify' ? '♪' : it.userStack.appKind === 'youtube' ? '▶' : '↗'}</span>
                      )}
                    </span>
                  )}
                  <InlineRename
                    value={customTitle === it.label ? '' : customTitle}
                    placeholder={it.label}
                    onSave={(v) => setItemTitle(it.id, v)}
                    titleClassName="timeline-label flex-1 min-w-0 text-sm"
                  />
                  {/* Duration hidden below sm — title legibility wins on 390px
                      (loop-2 critique); duration still reads in the time chip
                      context + merged-stack header + protocol detail. */}
                  {it.duration_min ? <span className="text-muted text-xs shrink-0 hidden sm:inline">{it.duration_min} min</span> : null}
                  {/* 2026-06-03 — recurring badge so the user knows a scope
                      choice (this day / all) is coming on delete. */}
                  {it.isRecurring && (
                    <span className="text-accent text-xs shrink-0" title="Recurring routine" aria-label="Recurring routine">↻</span>
                  )}
                  {/* D2 — coach-created rows carry a small helix chip. */}
                  {assistantOpIdOf(it) && <AssistantChip />}
                  {/* Bug C (2026-06-02) — one-tap "open" launch. Opens the EXACT
                      stored href (youtu.be short-links normalised to the real
                      watch URL) in a new tab. Independent of expand/selection. */}
                  {it.isUserStack && resolveLaunchHref(it.userStack) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const href = resolveLaunchHref(it.userStack);
                        if (href) window.open(href, '_blank', 'noopener');
                      }}
                      className="glass-disc text-muted hover:text-accent w-8 h-8 shrink-0"
                      aria-label="Open link in a new tab"
                      title="Open"
                    ><IconExternalLink /></button>
                  )}
                  {/* Phase 3.2 (2026-05-23) — affiliate cart icon for supplement/accessory items */}
                  {(isSupplementItem(it) || isAccessoryItem(it)) && (
                    <a
                      href={affiliateUrlFor(it) || '#'}
                      target="_blank"
                      rel="noopener nofollow sponsored"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = affiliateUrlFor(it);
                        if (!url || url.startsWith('TODO_')) {
                          e.preventDefault();
                          window.alert('Affiliate link not yet configured — Vic to fill in src/config/affiliates.json.');
                        }
                      }}
                      className="glass-disc text-muted hover:text-accent w-8 h-8 shrink-0"
                      aria-label="Buy this product"
                      title="Buy via affiliate link"
                    ><IconShoppingCart /></a>
                  )}
                  {/* P0a (2026-06-02) — add this slot to the phone's own calendar.
                      The phone Calendar/Clock then fires a reliable lock-screen
                      alarm at slot time with the app fully closed. */}
                  {it.time && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ok = downloadSlotIcs({
                          itemId: it.id,
                          title: customTitle || it.label || 'Reminder',
                          dateISO: selectedDate,
                          time: it.time,
                          durationMin: it.duration_min || 15,
                          description: `${it.category || ''}${it.duration_min ? ` · ${it.duration_min} min` : ''}`.trim(),
                        });
                        setToast({ tone: ok ? 'ok' : 'err', text: ok ? 'Opening your phone calendar — confirm to add the lock-screen alarm.' : 'Could not create calendar file.' });
                        setTimeout(() => setToast(null), 4000);
                      }}
                      className="glass-disc text-muted hover:text-accent w-8 h-8 shrink-0"
                      aria-label="Tap to add this reminder to your phone calendar"
                      title="Tap to add this reminder to your phone calendar — your phone fires the lock-screen alarm"
                    ><IconCalendar /></button>
                  )}
                  {/* Phase 1.3 (2026-05-23) — inline duplicate + delete icons.
                      Loop-1 defect fix (2026-06-11): hidden below sm — at
                      390px the icon cluster squeezed the title to 0 width.
                      Both actions stay reachable on mobile via the selection
                      toolbar and the expanded card body. */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDuplicate(it); }}
                    className="glass-disc text-muted hover:text-accent w-8 h-8 hidden sm:inline-flex shrink-0"
                    aria-label="Duplicate stack"
                    title="Duplicate"
                  ><IconCopy /></button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (it.isRecurring) { setPendingRecurringDelete(it); return; }
                      if (window.confirm('Delete this stack?')) handleRemoveItem(it);
                    }}
                    className="glass-disc text-muted hover:text-red-400 w-8 h-8 hidden sm:inline-flex shrink-0"
                    aria-label="Delete stack"
                    title="Delete"
                  ><IconTrash /></button>
                  <button onClick={() => setExpanded(isOpen ? null : it.id)} className="text-muted text-xs px-1 py-1 shrink-0" aria-label="Toggle details">
                    {isOpen ? '▴' : '▾'}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <m.div
                    key="body"
                    initial={presets.expand.initial}
                    animate={presets.expand.animate}
                    exit={presets.expand.exit}
                    transition={presets.expand.transition}
                    style={{ overflow: 'hidden' }}
                  >
                    {renderItemBody(it, false)}
                  </m.div>
                )}
              </AnimatePresence>
            </m.div>
          );
        }}
      </SortableList>

      {allDone && (
        <div className="mt-6 card p-5 text-center border-accent">
          <div className="font-display text-lg mb-1">All ticked off ✓</div>
          <p className="text-muted text-xs mb-4">Wipe the stack to start fresh — protocols, audio, and saved zones all clear.</p>
          <button
            onClick={() => {
              if (window.confirm('Remove the whole stack? This deactivates all your protocols, audio modules, and saved zones.')) {
                handleRemoveStack();
              }
            }}
            className="btn-accent w-full"
          >
            Remove stack
          </button>
        </div>
      )}

      {/* +Add Stack + +Add Protocol moved to top action bar (Iter 2 Phase 6.3). */}

      <AddStackModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={(stack) => {
          const { recurrence, ...stackPayload } = stack;
          if (recurrence) {
            // Recurring → one rule record anchored to the selected date. The
            // rule is expanded on read; not copied into 30 day-buckets.
            addRecurrenceRule(makeRule({
              id: `rule::${stackPayload.id}`,
              stack: stackPayload,
              anchorDate: selectedDate,
              freq: recurrence.freq,
              interval: recurrence.interval,
              createdAt: Date.now(),
            }));
          } else {
            addUserStack(stackPayload);            // one-off, this day only
          }
          // P1 (2026-06-02) — explicit success confirmation so mobile users
          // see the add landed (the "did it save?" uncertainty was a repro lead).
          setToast({ tone: 'ok', text: `Saved ✓ ${stack.title ? '— ' + String(stack.title).slice(0, 40) : ''}` });
          setTimeout(() => setToast(null), 3000);
        }}
        defaultTime={(items[items.length - 1]?.time) || '08:00'}
      />

      {/* 2026-06-03 — recurring-delete scope sheet. Default highlighted choice
          is "This day only" so the destructive cascade is never accidental. */}
      {pendingRecurringDelete && (
        <m.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DUR.fast / 1000 }}
          className="fixed inset-0 z-50 ppw-scrim flex items-end sm:items-center justify-center p-4"
          onClick={() => setPendingRecurringDelete(null)}
        >
          {/* Sheet arrives on SPRING.sheet — solid surface (it moves → no
              blur); the static scrim above carries the glass (board 06). */}
          <m.div variants={sheetUp} initial="hidden" animate="show" className="card w-full max-w-sm p-5" style={{ backgroundColor: 'var(--col-surface-a)' }} onClick={(e) => e.stopPropagation()}>
            <div className="font-display text-lg mb-1">Remove recurring routine</div>
            <p className="text-muted text-xs mb-4">This routine repeats. Remove it from just this day, or from every day it appears?</p>
            <button
              onClick={() => handleConfirmRecurringDelete('this-day')}
              className="w-full text-center py-2.5 rounded-full text-sm font-bold bg-accent text-bg mb-2"
            >
              This day only
            </button>
            <button
              onClick={() => handleConfirmRecurringDelete('all')}
              className="w-full text-center py-2.5 rounded-full text-sm font-bold border border-cream/15 text-muted hover:text-accent hover:border-accent transition-colors mb-2"
            >
              All occurrences
            </button>
            <button
              onClick={() => setPendingRecurringDelete(null)}
              className="w-full text-center py-2 rounded-full text-xs font-bold text-muted hover:text-cream"
            >
              Cancel
            </button>
          </m.div>
        </m.div>
      )}

      <AddProtocolModal
        open={addProtocolOpen}
        onClose={() => setAddProtocolOpen(false)}
        onActivate={handleActivateProtocol}
      />

      {/* Patch 1 (2026-05-24) — floating SelectionActionBar removed; Merge/Delete now live in the sticky toolbar. */}

      <ClearCalendarModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={handleClearConfirm}
      />

      <NotificationOverlay
        item={firedItem}
        onOpen={() => {
          if (firedItem) setExpanded(firedItem.id);
          setFiredItem(null);
        }}
        onSkip={() => setFiredItem(null)}
        onAutoplay={({ allFuture }) => {
          if (firedItem) {
            if (allFuture) {
              const key = `${firedItem.id}__${firedItem.time}`;
              setAutoplayPatterns(prev => ({ ...prev, [key]: true }));
            }
            setExpanded(firedItem.id);
          }
          setFiredItem(null);
        }}
      />
    </main>
  );
}

export default TodayView;
export { DateStrip, CompletionRing, StreakChip, computeCompletionStreak };
