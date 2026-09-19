// .ics reminders — the only path that reminds a user when the app is CLOSED and
// costs nothing to run (2026-09-19).
//
// app5's slot engine is a 20s setInterval that runs only while the app is open.
// Web Push is fully built (src/lib/push.js, public/sw.js) but its sender was
// never deployed — push-config.PUSH_SYNC_ENDPOINT is '' — so it cannot fire
// either. The phone's own Calendar needs no server, no account and no permission
// prompt, so it is what the app actually offers.
//
// Two defects this pins:
//   • app5's date keys are NOT zero-padded (store5.dateKeyFromOffset returns
//     '2026-9-19'). toFloating stripped the hyphens, so DTSTART came out as
//     '202699T073000' — silently malformed, rejected by every calendar.
//   • There was no RRULE, so a stack repeating every day produced ONE alarm,
//     once. That is not a reminder.
import { describe, it, expect } from 'vitest';
import { buildSlotIcs, slotUid, padDateKey, rruleFor } from './ics.js';

const build = (o) => buildSlotIcs({ uid: 'u@ppwellness.co', title: 'Morning walk', dateISO: '2026-09-19', time: '07:30', ...o });

describe('padDateKey — app5 keys are not ISO', () => {
  it('pads the unpadded key app5 actually produces', () => {
    expect(padDateKey('2026-9-19')).toBe('2026-09-19');
    expect(padDateKey('2026-1-1')).toBe('2026-01-01');
  });

  it('leaves a real ISO date alone', () => {
    expect(padDateKey('2026-09-19')).toBe('2026-09-19');
  });

  it('does not mangle something that is not a date', () => {
    expect(padDateKey('')).toBe('');
    expect(padDateKey(null)).toBe('');
    expect(padDateKey('not-a-date-at-all-x')).toBe('not-a-date-at-all-x');
  });
});

describe('the calendar event is valid', () => {
  it('emits a well-formed DTSTART from an UNPADDED app key', () => {
    const ics = build({ dateISO: '2026-9-19' });
    expect(ics).toContain('DTSTART:20260919T073000');
    expect(ics).not.toContain('DTSTART:202699');
  });

  it('ends after it starts', () => {
    const ics = build({ durationMin: 15 });
    expect(ics).toContain('DTSTART:20260919T073000');
    expect(ics).toContain('DTEND:20260919T074500');
  });

  it('carries an alarm that fires at the slot time', () => {
    const ics = build({});
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER;RELATED=START:PT0M');
    expect(ics).toContain('ACTION:DISPLAY');
  });

  it('gives the same slot the same uid whichever date format it arrives in', () => {
    expect(slotUid('d1', '2026-9-19', '07:30')).toBe(slotUid('d1', '2026-09-19', '07:30'));
    expect(slotUid('d1', '2026-9-19', '07:30')).toBe('ppw-d1-20260919-0730@ppwellness.co');
  });
});

describe('a repeating stack becomes a repeating alarm', () => {
  it('maps every repeat the app can store', () => {
    expect(rruleFor('daily')).toBe('RRULE:FREQ=DAILY');
    expect(rruleFor('weekly')).toBe('RRULE:FREQ=WEEKLY');
    expect(rruleFor('3')).toBe('RRULE:FREQ=DAILY;INTERVAL=3');
    expect(rruleFor('14')).toBe('RRULE:FREQ=DAILY;INTERVAL=14');
  });

  it('stays a one-off when the stack is a one-off', () => {
    expect(rruleFor('once')).toBeNull();
    expect(rruleFor(undefined)).toBeNull();
    expect(rruleFor('')).toBeNull();
  });

  it('puts the rule in the event', () => {
    expect(build({ repeat: 'daily' })).toContain('RRULE:FREQ=DAILY');
    expect(build({ repeat: 'weekly' })).toContain('RRULE:FREQ=WEEKLY');
    expect(build({ repeat: '2' })).toContain('RRULE:FREQ=DAILY;INTERVAL=2');
  });

  it('leaves the event alone when there is nothing to repeat', () => {
    expect(build({ repeat: 'once' })).not.toContain('RRULE');
    expect(build({})).not.toContain('RRULE');
  });
});
