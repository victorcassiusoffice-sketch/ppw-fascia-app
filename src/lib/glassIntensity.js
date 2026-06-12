// User-controllable glass intensity (Liquid Glass framework Lens 4, BINDING
// skill 06-Roadmap/skills/liquid-glass-ui-analysis.md). Three levels mapped
// to CSS via html[data-glass]: 'low' (less blur + more body — visual-comfort
// AND the perf escape hatch for weak blur paths like Android WebView),
// 'standard' (default tokens), 'high' (maximum lensing).
// NEW additive LS key — no existing shapes change.

import { useState, useCallback, useEffect } from 'react';

export const GLASS_KEY = 'ppw.glassIntensity';
export const GLASS_LEVELS = [
  { key: 'low',      label: 'Subtle' },
  { key: 'standard', label: 'Standard' },
  { key: 'high',     label: 'Max' },
];

export function getGlassIntensity() {
  try {
    const v = localStorage.getItem(GLASS_KEY);
    if (v === 'low' || v === 'standard' || v === 'high') return v;
  } catch (_) { /* ignore */ }
  return 'standard';
}

export function applyGlassIntensity(level) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-glass', level);
  }
  return level;
}

export function setGlassIntensity(level) {
  try { localStorage.setItem(GLASS_KEY, level); } catch (_) { /* ignore */ }
  return applyGlassIntensity(level);
}

export function useGlassIntensity() {
  const [level, setLevelState] = useState(getGlassIntensity);
  useEffect(() => { applyGlassIntensity(level); }, [level]);
  const setLevel = useCallback((next) => {
    setLevelState(next);
    setGlassIntensity(next);
  }, []);
  return { level, setLevel };
}
