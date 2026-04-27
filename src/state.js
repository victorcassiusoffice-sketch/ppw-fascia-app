// Tiny localStorage-backed state primitives — no backend, no auth.
// Keys live in src/config.ts (LS_KEYS).

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

/* ─── Active protocols (string[] of protocol_id) ─── */
export function useActiveProtocols() {
  return useLocalStorage(LS_KEYS.ACTIVE_PROTOCOLS, []);
}

/* ─── Active modules (string[] of slugs like 'daytime_stress') ─── */
export function useActiveModules() {
  return useLocalStorage(LS_KEYS.ACTIVE_MODULES, []);
}

/* ─── Active body-zone routines ─── */
export function useActiveRoutines() {
  return useLocalStorage(LS_KEYS.ACTIVE_ROUTINES, {
    savedZones: [],     // ['12_lower_back_left', ...]
    level: 'beginner',
    lifestyle: null,
    scheduledTime: '08:00',
  });
}

/* ─── Completed-today checklist ─── */
export function useCompletedToday() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [state, setState] = useLocalStorage(LS_KEYS.COMPLETED_TODAY, { date: todayStr, ids: [] });

  // Roll over at midnight
  useEffect(() => {
    if (state.date !== todayStr) {
      setState({ date: todayStr, ids: [] });
    }
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
