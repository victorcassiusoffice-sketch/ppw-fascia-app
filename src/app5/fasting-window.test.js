// Fasting eating-window helpers (Vic 2026-08-31).
//
// Locks the wrap-aware behaviour the settings UI relies on — in particular the
// cross-midnight window the 16:8 preset can derive from a late open (18:00 →
// 02:00), which the F/E badge and slot engine used to get wrong.

import { describe, it, expect } from 'vitest';
import { addHoursHM, fastWindowHours, isInEatWindow } from './store5.js';

describe('addHoursHM', () => {
  it('adds hours and wraps past midnight', () => {
    expect(addHoursHM('12:00', 8)).toBe('20:00');   // 16:8 from a noon open
    expect(addHoursHM('18:00', 8)).toBe('02:00');   // 16:8 from a late open → wraps
    expect(addHoursHM('12:00', 1)).toBe('13:00');   // OMAD
    expect(addHoursHM('23:30', 1)).toBe('00:30');
  });
});

describe('fastWindowHours', () => {
  it('reports whole eating hours, wrap-aware, else null (= custom)', () => {
    expect(fastWindowHours('12:00', '20:00')).toBe(8);    // default = 16:8
    expect(fastWindowHours('18:00', '02:00')).toBe(8);    // wrapping window still 8h
    expect(fastWindowHours('12:00', '13:00')).toBe(1);    // OMAD
    expect(fastWindowHours('12:15', '20:00')).toBe(null); // not whole hours → custom
  });
});

describe('isInEatWindow — same-day window', () => {
  it('is inclusive of open, exclusive of close', () => {
    expect(isInEatWindow('12:00', '12:00', '20:00')).toBe(true);   // at open
    expect(isInEatWindow('19:59', '12:00', '20:00')).toBe(true);
    expect(isInEatWindow('20:00', '12:00', '20:00')).toBe(false);  // at close
    expect(isInEatWindow('06:00', '12:00', '20:00')).toBe(false);
  });
});

describe('isInEatWindow — cross-midnight window (the reviewed bug)', () => {
  it('treats 18:00 → 02:00 as one continuous eating window', () => {
    expect(isInEatWindow('18:00', '18:00', '02:00')).toBe(true);
    expect(isInEatWindow('23:59', '18:00', '02:00')).toBe(true);   // was false before the fix
    expect(isInEatWindow('01:59', '18:00', '02:00')).toBe(true);
    expect(isInEatWindow('02:00', '18:00', '02:00')).toBe(false);  // at close
    expect(isInEatWindow('12:00', '18:00', '02:00')).toBe(false);  // midday = fasting
  });
});
