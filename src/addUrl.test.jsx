// P1 (2026-06-02) — regression guard for the add-URL flow + reminder exports.
//
// This is the guard that the WORKING desktop add-URL flow stays working:
// paste a YouTube link → save → the stack record lands in localStorage under
// the date-scoped key → a fresh mount (simulated reload) reads it back. If a
// future change breaks persistence, this test goes red before it ships.

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserStacks } from './state.js';
import { LS_KEYS } from './config.js';
import { buildSlotIcs, slotUid } from './lib/ics.js';

const DATE = '2026-06-02';
const KEY = `${LS_KEYS.USER_STACKS}::${DATE}`;

describe('add-URL persistence (the working flow guard)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('persists an added link stack to the date-scoped localStorage key', () => {
    const { result } = renderHook(() => useUserStacks(DATE));
    act(() => {
      result.current.addStack({
        id: 'user::test::1',
        type: 'link',
        time: '08:30',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        youtubeId: 'dQw4w9WgXcQ',
        title: 'Test routine',
        durationSec: 600,
      });
    });
    const raw = JSON.parse(localStorage.getItem(KEY));
    expect(Array.isArray(raw)).toBe(true);
    expect(raw).toHaveLength(1);
    expect(raw[0].title).toBe('Test routine');
    expect(raw[0].time).toBe('08:30');
    expect(raw[0].youtubeId).toBe('dQw4w9WgXcQ');
  });

  it('reads the record back on a fresh mount (simulated app reload)', () => {
    // Seed storage as if a prior session saved it.
    localStorage.setItem(KEY, JSON.stringify([
      { id: 'user::test::2', type: 'link', time: '09:00', title: 'Persisted bar', youtubeId: 'abc12345678' },
    ]));
    const { result } = renderHook(() => useUserStacks(DATE));
    expect(result.current.stacks).toHaveLength(1);
    expect(result.current.stacks[0].title).toBe('Persisted bar');
    expect(result.current.stacks[0].time).toBe('09:00');
  });

  it('keeps multiple adds and survives a remount', () => {
    const first = renderHook(() => useUserStacks(DATE));
    act(() => {
      first.result.current.addStack({ id: 'a', type: 'text', time: '07:00', title: 'A' });
      first.result.current.addStack({ id: 'b', type: 'text', time: '08:00', title: 'B' });
    });
    // Remount = reload.
    const second = renderHook(() => useUserStacks(DATE));
    expect(second.result.current.stacks.map(s => s.id)).toEqual(['a', 'b']);
  });
});

describe('.ics reminder export (P0a)', () => {
  it('builds a VEVENT with an at-time VALARM', () => {
    const ics = buildSlotIcs({
      uid: slotUid('user::x', DATE, '08:30'),
      title: 'Morning fascia',
      dateISO: DATE,
      time: '08:30',
      durationMin: 15,
    });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER;RELATED=START:PT0M');
    expect(ics).toContain('DTSTART:20260602T083000');
    expect(ics).toContain('DTEND:20260602T084500');
    expect(ics).toContain('SUMMARY:PPW · Morning fascia');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('escapes commas/semicolons in the title', () => {
    const ics = buildSlotIcs({ uid: 'u1', title: 'A, B; C', dateISO: DATE, time: '10:00' });
    expect(ics).toContain('SUMMARY:PPW · A\\, B\\; C');
  });

  it('caps DTEND at end-of-day so it never precedes DTSTART', () => {
    const ics = buildSlotIcs({ uid: 'u2', title: 'Long', dateISO: DATE, time: '23:50', durationMin: 30 });
    expect(ics).toContain('DTSTART:20260602T235000');
    expect(ics).toContain('DTEND:20260602T235900'); // capped, never wraps past midnight
  });
});
