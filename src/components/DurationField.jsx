// Duration field — mm:ss timer (Vic fix, 2026-06-14).
//
// Vic: "When you select Seconds in add video needs to changed to timer with
// minutes and seconds." The app still STORES durations as a plain integer
// `durationSec` everywhere (no migration needed) — this is purely a friendlier
// input: two small number fields (minutes + seconds) that read/write the same
// total seconds. Existing saved durations parse straight through secToParts().

import React from 'react';

/** Split total seconds into { mm, ss } (ss clamped 0–59). */
export function secToParts(totalSec) {
  const t = Math.max(0, Math.floor(Number(totalSec) || 0));
  return { mm: Math.floor(t / 60), ss: t % 60 };
}

/** Combine minutes + seconds into total seconds (seconds clamped 0–59). */
export function partsToSec(mm, ss) {
  const m = Math.max(0, Math.floor(Number(mm) || 0));
  const s = Math.min(59, Math.max(0, Math.floor(Number(ss) || 0)));
  return m * 60 + s;
}

/** "M:SS" label for display (e.g. 90 → "1:30"). */
export function formatMMSS(totalSec) {
  const { mm, ss } = secToParts(totalSec);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * Minutes + seconds inputs bound to a single total-seconds value.
 * Props: valueSec (number), onChangeSec (fn), idPrefix (string, for labels),
 * inputClassName (string, to match host styling).
 */
export default function DurationField({ valueSec, onChangeSec, idPrefix = 'dur', inputClassName = '' }) {
  const { mm, ss } = secToParts(valueSec);
  const base = inputClassName || 'bg-cream/5 border border-cream/15 rounded-lg px-2 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent';
  const setMin = (v) => onChangeSec(partsToSec(v, ss));
  const setSec = (v) => onChangeSec(partsToSec(mm, v));
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Duration (minutes and seconds)">
      <div className="flex items-center gap-1">
        <input
          id={`${idPrefix}-min`}
          type="number"
          min="0"
          inputMode="numeric"
          value={mm}
          onChange={(e) => setMin(e.target.value)}
          className={`w-16 text-center ${base}`}
          aria-label="Minutes"
        />
        <span className="text-xs text-muted">min</span>
      </div>
      <span className="text-muted font-display" aria-hidden="true">:</span>
      <div className="flex items-center gap-1">
        <input
          id={`${idPrefix}-sec`}
          type="number"
          min="0"
          max="59"
          inputMode="numeric"
          value={ss}
          onChange={(e) => setSec(e.target.value)}
          className={`w-16 text-center ${base}`}
          aria-label="Seconds"
        />
        <span className="text-xs text-muted">sec</span>
      </div>
    </div>
  );
}
