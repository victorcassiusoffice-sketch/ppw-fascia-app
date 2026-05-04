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

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function useDailyHidden() {
  const todayStr = todayISO();
  const [state, setState] = useLocalStorage(LS_KEYS.DAILY_HIDDEN, { date: todayStr, ids: [] });
  useEffect(() => {
    if (state.date !== todayStr) setState({ date: todayStr, ids: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);
  const isHidden = useCallback((id) => state.ids.includes(id), [state.ids]);
  const hide = useCallback((id) => {
    setState((s) => {
      const date = todayISO();
      const baseIds = s.date === date ? s.ids : [];
      return { date, ids: baseIds.includes(id) ? baseIds : [...baseIds, id] };
    });
  }, [setState]);
  const unhideAll = useCallback(() => setState({ date: todayISO(), ids: [] }), [setState]);
  return { isHidden, hide, unhideAll, hiddenIds: state.date === todayStr ? state.ids : [] };
}

export function useDailyDuplicates() {
  const todayStr = todayISO();
  const [state, setState] = useLocalStorage(LS_KEYS.DAILY_DUPLICATES, { date: todayStr, items: [] });
  useEffect(() => {
    if (state.date !== todayStr) setState({ date: todayStr, items: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);
  const addDuplicate = useCallback((dup) => {
    setState((s) => {
      const date = todayISO();
      const base = s.date === date ? s.items : [];
      return { date, items: [...base, dup] };
    });
  }, [setState]);
  const removeDuplicate = useCallback((instanceId) => {
    setState((s) => {
      const date = todayISO();
      const base = s.date === date ? s.items : [];
      return { date, items: base.filter(i => i.instanceId !== instanceId) };
    });
  }, [setState]);
  const updateDuplicateTime = useCallback((instanceId, time) => {
    setState((s) => {
      const date = todayISO();
      const base = s.date === date ? s.items : [];
      return { date, items: base.map(i => i.instanceId === instanceId ? { ...i, time } : i) };
    });
  }, [setState]);
  const clearDuplicates = useCallback(() => setState({ date: todayISO(), items: [] }), [setState]);
  return {
    duplicates: state.date === todayStr ? state.items : [],
    addDuplicate, removeDuplicate, updateDuplicateTime, clearDuplicates,
  };
}

/* M9 — useDailyMerges. Schema:
     { [mergeId]: { title, itemIds:[...], collapsed, activeTabId?, time?, playOrder? } }
   Persists across days; user-organised.
   M14 additions:
     - `time` — single time string ("HH:MM") for the whole stack (overrides per-tab time)
     - `playOrder` — ordered tab ids for video auto-play sequence */
export function useDailyMerges() {
  const [merges, setMerges] = useLocalStorage(LS_KEYS.DAILY_MERGES, {});
  const findMergeFor = useCallback((itemId) => {
    for (const [mid, m] of Object.entries(merges)) {
      if (m.itemIds && m.itemIds.includes(itemId)) return mid;
    }
    return null;
  }, [merges]);
  // M14 — optional `opts.time` sets the stack time at the moment of merging
  // (caller passes the destination card's current time so the stack inherits it).
  const mergeOnto = useCallback((draggedItemId, targetItemId, opts) => {
    if (draggedItemId === targetItemId) return null;
    const inheritedTime = opts && opts.time ? opts.time : null;
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
  const pruneMissing = useCallback((existingIds) => {
    setMerges((cur) => {
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

export function useCompletedToday() {
  const todayStr = todayISO();
  const [state, setState] = useLocalStorage(LS_KEYS.COMPLETED_TODAY, { date: todayStr, ids: [] });
  useEffect(() => {
    if (state.date !== todayStr) setState({ date: todayStr, ids: [] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayStr]);
  const isDone = useCallback((id) => state.ids.includes(id), [state.ids]);
  const toggle = useCallback((id) => {
    setState((s) => {
      const has = s.ids.includes(id);
      return { date: todayStr, ids: has ? s.ids.filter(x => x !== id) : [...s.ids, id] };
    });
  }, [setState, todayStr]);
  return { isDone, toggle, completed: state.ids };
}
