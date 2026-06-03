// Dual-theme controller (2026-06-03).
//
// Three user choices persist in localStorage `ppw.theme`:
//   'dark'   — force dark (DEFAULT, brand-forward)
//   'light'  — force light (neumorphic)
//   'system' — follow prefers-color-scheme, live
//
// The RESOLVED theme ('light'|'dark') is written to <html data-theme>, which is
// what src/index.css keys every semantic token off. An anti-flash inline script
// in index.html applies the resolved theme before React mounts; this module is
// the single source of truth React uses thereafter.

import { useState, useEffect, useCallback } from 'react';

export const THEME_KEY = 'ppw.theme';

const mql = () =>
  (typeof window !== 'undefined' && window.matchMedia)
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

export function getThemeChoice() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch (_) { /* ignore */ }
  return 'dark'; // default: dark
}

export function resolveTheme(choice) {
  if (choice === 'system') {
    const m = mql();
    return m && m.matches ? 'dark' : 'light';
  }
  return choice === 'light' ? 'light' : 'dark';
}

export function applyTheme(choice) {
  const resolved = resolveTheme(choice);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', resolved);
  }
  return resolved;
}

export function setThemeChoice(choice) {
  try { localStorage.setItem(THEME_KEY, choice); } catch (_) { /* ignore */ }
  return applyTheme(choice);
}

// React hook: returns { choice, resolved, setChoice, toggle }.
export function useTheme() {
  const [choice, setChoiceState] = useState(getThemeChoice);
  const [resolved, setResolved] = useState(() => resolveTheme(getThemeChoice()));

  const setChoice = useCallback((next) => {
    setChoiceState(next);
    setResolved(setThemeChoice(next));
  }, []);

  // Quick light↔dark flip (used by the header puck). From 'system' it flips to
  // the opposite of whatever is currently showing.
  const toggle = useCallback(() => {
    setChoiceState((cur) => {
      const showing = resolveTheme(cur);
      const next = showing === 'dark' ? 'light' : 'dark';
      setResolved(setThemeChoice(next));
      return next;
    });
  }, []);

  // Live-follow the OS only while choice === 'system'.
  useEffect(() => {
    if (choice !== 'system') return;
    const m = mql();
    if (!m) return;
    const onChange = () => setResolved(applyTheme('system'));
    m.addEventListener ? m.addEventListener('change', onChange) : m.addListener(onChange);
    return () => { m.removeEventListener ? m.removeEventListener('change', onChange) : m.removeListener(onChange); };
  }, [choice]);

  // Keep <html> in sync on mount / choice change.
  useEffect(() => { setResolved(applyTheme(choice)); }, [choice]);

  return { choice, resolved, setChoice, toggle };
}
