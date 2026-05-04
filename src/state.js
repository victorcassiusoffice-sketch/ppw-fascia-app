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
