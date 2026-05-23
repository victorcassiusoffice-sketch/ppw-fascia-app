import { useEffect, useState, useCallback } from 'react';
import { LS_KEYS } from './config.js';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (_) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

export function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => readJSON(key, initial));
  useEffect(() => { writeJSON(key, val); }, [key, val]);
  return [val, setVal];
}

export function useActiveProtocols() {
  return useLocalStorage(LS_KEYS.ACTIVE_PROTOCOLS, []);
}

export function useActiveModules() {
  return useLocalStorage(LS_KEYS.ACTIVE_MODULES, []);
}

export function useActiveRoutines() {
  return useLocalStorage(LS_KEYS.ACTIVE_ROUTINES, {
    savedZones: [],
    level: 'beginner',
    lifestyle: null,
    scheduledTime: '08:00',
  });
}

export function todayISO() { return new Date().toISOString().slice(0, 10); }

// Phase 1.4 (2026-05-23) — date-scoped keys so each date holds its own
// stack state (order, hidden, duplicates, merges, completed, times).
function dateKey(base, date) {
  return `${base}::${date || todayISO()}`;
}

// Phase 1.4 — generic date-scoped useLocalStorage wrapper.
export function useDateScopedStorage(baseKey, date, initial) {
  const key = dateKey(baseKey, date);
  return useLocalStorage(key, initial);
}

export function useDailyHidden(date) {
  const [ids, setIds] = useDateScopedStorage(LS_KEYS.DAILY_HIDDEN, date, []);
  const isHidden = useCallback((id) => ids.includes(id), [ids]);
  const hide = useCallback((id) => {
    setIds((cur) => cur.includes(id) ? cur : [...cur, id]);
  }, [setIds]);
  const unhideAll = useCallback(() => setIds([]), [setIds]);
  return { isHidden, hide, unhideAll, hiddenIds: ids };
}

export function useDailyDuplicates(date) {
  const [items, setItems] = useDateScopedStorage(LS_KEYS.DAILY_DUPLICATES, date, []);
  const addDuplicate = useCallback((dup) => {
    setItems((cur) => [...cur, dup]);
  }, [setItems]);
  const removeDuplicate = useCallback((instanceId) => {
    setItems((cur) => cur.filter(i => i.instanceId !== instanceId));
  }, [setItems]);
  const updateDuplicateTime = useCallback((instanceId, time) => {
    setItems((cur) => cur.map(i => i.instanceId === instanceId ? { ...i, time } : i));
  }, [setItems]);
  const clearDuplicates = useCallback(() => setItems([]), [setItems]);
  return {
    duplicates: items,
    addDuplicate, removeDuplicate, updateDuplicateTime, clearDuplicates,
  };
}

/* M9 — useDailyMerges. Schema:
     { [mergeId]: { title, itemIds:[...], collapsed, activeTabId?, time?, playOrder? } }
   Persists across days; user-organised.
   M14 additions:
     - `time` — single time string ("HH:MM") for the whole stack (overrides per-tab time)
     - `playOrder` — ordered tab ids for video auto-play sequence */
export function useDailyMerges(date) {
  const [merges, setMerges] = useDateScopedStorage(LS_KEYS.DAILY_MERGES, date, {});
  const findMergeFor = useCallback((itemId) => {
    for (const [mid, m] of Object.entries(merges)) {
      if (m.itemIds && m.itemIds.includes(itemId)) return mid;
    }
    return null;
  }, [merges]);
  // M14 — optional `opts.time` sets the stack time at the moment of merging
  // (caller passes the destination card's current time so the stack inherits it).
  // Iter 2 (2026-05-24) — optional `opts.mode` = 'parallel' (M14 default) or
  // 'tabs' (Phase 5.3 multi-select merge). Stored on the merge record; only
  // applied at creation time — subsequent appends preserve the existing mode.
  const mergeOnto = useCallback((draggedItemId, targetItemId, opts) => {
    if (draggedItemId === targetItemId) return null;
    const inheritedTime = opts && opts.time ? opts.time : null;
    const mode = opts && opts.mode ? opts.mode : 'parallel';
    let resultId = null;
    setMerges((cur) => {
      const next = { ...cur };
      const mA = Object.entries(next).find(([_, m]) => m.itemIds?.includes(draggedItemId));
      const mB = Object.entries(next).find(([_, m]) => m.itemIds?.includes(targetItemId));
      if (mA && mB && mA[0] === mB[0]) { resultId = mA[0]; return cur; }
      if (mA && mB) {
        const merged = {
          ...mB[1],
          itemIds: [...mB[1].itemIds, ...mA[1].itemIds.filter(id => !mB[1].itemIds.includes(id))],
        };
        if (inheritedTime && !merged.time) merged.time = inheritedTime;
        next[mB[0]] = merged;
        delete next[mA[0]];
        resultId = mB[0];
      } else if (mB) {
        const m = mB[1];
        const updated = { ...m };
        if (!m.itemIds.includes(draggedItemId)) updated.itemIds = [...m.itemIds, draggedItemId];
        if (inheritedTime && !updated.time) updated.time = inheritedTime;
        next[mB[0]] = updated;
        resultId = mB[0];
      } else if (mA) {
        const m = mA[1];
        const updated = { ...m };
        if (!m.itemIds.includes(targetItemId)) updated.itemIds = [...m.itemIds, targetItemId];
        if (inheritedTime) updated.time = inheritedTime;
        next[mA[0]] = updated;
        resultId = mA[0];
      } else {
        const newId = 'merge::' + Date.now() + '::' + Math.floor(Math.random() * 9999);
        next[newId] = {
          title: '',
          itemIds: [targetItemId, draggedItemId],
          collapsed: true,                              // M14: stacks default to compact
          time: inheritedTime || null,                  // M14: inherit destination's time
          playOrder: [targetItemId, draggedItemId],     // default play order = creation order
          mode,                                         // Iter 2: 'parallel' | 'tabs'
          activeTabId: targetItemId,                    // Iter 2: default tab when mode='tabs'
        };
        resultId = newId;
      }
      return next;
    });
    return resultId;
  }, [setMerges]);
  const unmergeItem = useCallback((itemId) => {
    setMerges((cur) => {
      const next = { ...cur };
      for (const [mid, m] of Object.entries(next)) {
        if (m.itemIds?.includes(itemId)) {
          const remaining = m.itemIds.filter(id => id !== itemId);
          if (remaining.length <= 1) delete next[mid];
          else next[mid] = { ...m, itemIds: remaining };
          break;
        }
      }
      return next;
    });
  }, [setMerges]);
  const dissolveMerge = useCallback((mergeId) => {
    setMerges((cur) => {
      if (!(mergeId in cur)) return cur;
      const next = { ...cur };
      delete next[mergeId];
      return next;
    });
  }, [setMerges]);
  const setMergeTitle = useCallback((mergeId, title) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], title } } : cur));
  }, [setMerges]);
  const setActiveTab = useCallback((mergeId, itemId) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], activeTabId: itemId } } : cur));
  }, [setMerges]);
  const reorderTabs = useCallback((mergeId, newItemIds) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], itemIds: newItemIds } } : cur));
  }, [setMerges]);
  // M14 — single source of truth for stack time
  const setMergeTime = useCallback((mergeId, time) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], time } } : cur));
  }, [setMerges]);
  // M14 — video auto-play sequence
  const setPlayOrder = useCallback((mergeId, newOrder) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], playOrder: newOrder } } : cur));
  }, [setMerges]);
  // M14 — toggle compact vs expanded
  const setCollapsed = useCallback((mergeId, collapsed) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], collapsed } } : cur));
  }, [setMerges]);
  // Iter 2 — switch between parallel-play and tabbed multi-merge view.
  const setMergeMode = useCallback((mergeId, mode) => {
    setMerges((cur) => (cur[mergeId] ? { ...cur, [mergeId]: { ...cur[mergeId], mode } } : cur));
  }, [setMerges]);
  const pruneMissing = useCallback((existingIds) => {
    setMerges((cur) => {
      // M14 defensive guards — refuse to prune in obvious partial-load states:
      //   • no merges at all → nothing to do
      //   • caller passed an empty id list while we DO have merges → almost
      //     certainly a partial-hydration race; bail out and try later.
      if (Object.keys(cur).length === 0) return cur;
      if (!existingIds || existingIds.length === 0) return cur;
      let changed = false;
      const next = { ...cur };
      const set = new Set(existingIds);
      for (const [mid, m] of Object.entries(next)) {
        const keep = (m.itemIds || []).filter(id => set.has(id));
        if (keep.length !== (m.itemIds || []).length) {
          changed = true;
          if (keep.length <= 1) delete next[mid];
          else next[mid] = { ...m, itemIds: keep };
        }
      }
      return changed ? next : cur;
    });
  }, [setMerges]);
  return {
    merges,
    findMergeFor,
    mergeOnto,
    unmergeItem,
    dissolveMerge,
    setMergeTitle,
    setActiveTab,
    reorderTabs,
    pruneMissing,
    setMergeTime,    // M14
    setPlayOrder,    // M14
    setCollapsed,    // M14
    setMergeMode,    // Iter 2
  };
}

/* M9 — useDailyTitles. Single map: { [itemIdOrMergeId]: customTitle } */
export function useDailyTitles() {
  const [titles, setTitles] = useLocalStorage(LS_KEYS.DAILY_TITLES, {});
  const setTitle = useCallback((id, title) => {
    setTitles((cur) => {
      const trimmed = (title || '').trim();
      if (!trimmed) {
        if (!(id in cur)) return cur;
        const next = { ...cur };
        delete next[id];
        return next;
      }
      return { ...cur, [id]: trimmed };
    });
  }, [setTitles]);
  const getTitle = useCallback((id, fallback) => titles[id] || fallback, [titles]);
  return { titles, getTitle, setTitle };
}

export function useFastingPrefs() {
  return useLocalStorage(LS_KEYS.FASTING_PREFS, {
    windowKey: '16:8',
    startISO: null,
    addToPlan: false,
  });
}

// Phase 2 (2026-05-23) — user-created stacks, per-date.
export function useUserStacks(date) {
  const [stacks, setStacks] = useDateScopedStorage(LS_KEYS.USER_STACKS, date, []);
  const addStack = useCallback((stack) => {
    setStacks((cur) => [...cur, stack]);
  }, [setStacks]);
  const updateStack = useCallback((id, patch) => {
    setStacks((cur) => cur.map(s => s.id === id ? { ...s, ...patch } : s));
  }, [setStacks]);
  const removeStack = useCallback((id) => {
    setStacks((cur) => cur.filter(s => s.id !== id));
  }, [setStacks]);
  return { stacks, addStack, updateStack, removeStack };
}

// Phase 3 (2026-05-23) — intermittent fasting daily window prefs.
// Distinct from useFastingPrefs which is for one-off long-fasts.
export function useIfPrefs() {
  return useLocalStorage(LS_KEYS.IF_PREFS, {
    enabled: false,
    windowStart: '12:00',  // eating window opens
    windowEnd:   '20:00',  // eating window closes
  });
}

export function useCompletedToday(date) {
  const [ids, setIds] = useDateScopedStorage(LS_KEYS.COMPLETED_TODAY, date, []);
  const isDone = useCallback((id) => ids.includes(id), [ids]);
  const toggle = useCallback((id) => {
    setIds((cur) => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }, [setIds]);
  return { isDone, toggle, completed: ids };
}
