// ORGANISE (Vic, 2026-10-17): an AI reply becomes a list of changes to the
// user's OWN stacks, not a replacement day. These pin how a reply is matched to
// stacks and what counts as a change — the two places this can go wrong in a way
// the user would not notice until a stack lost its video or its schedule.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { diffPlan, describeField, startOffset, normTitle } from './planDiff.js';
import { parsePlanDoc, dateKeyFromOffset, todayKey } from '../store5.js';
import { refMapFor, buildPrompt, planEcho, PLAN_MODE } from './aiPrompt.js';

const plan = (items) => parsePlanDoc({ ppw: 'routine', v: 3, name: 'x', items }).items;

const DECK = [
  { id: 'a', title: 'Morning stretch', meta: '10 min', time: '07:30', repeat: 'daily', anchor: dateKeyFromOffset(-5), url: 'https://www.youtube.com/watch?v=yLDAHd_C7G0', auto: true },
  { id: 'b', title: 'Box breathing', time: '13:00', repeat: 'daily', anchor: dateKeyFromOffset(-2) },
  { id: 'c', title: 'Long run', time: '18:00', repeat: 'weekly', anchor: dateKeyFromOffset(-3) },
  { id: 'd', title: 'Supplements', time: '08:00', repeat: 'daily' },   // a legacy stack: no start date
];
const REFS = refMapFor(DECK).map;   // s1 a 07:30 · s2 d 08:00 · s3 b 13:00 · s4 c 18:00

describe('refs', () => {
  it('are handed out by time, s1 first', () => {
    expect(REFS).toEqual({ s1: 'a', s2: 'd', s3: 'b', s4: 'c' });
  });
  it('appear in the organise prompt next to each stack, with a video flagged', () => {
    const e = planEcho({ deckItems: DECK }, PLAN_MODE.REBUILD);
    expect(e).toMatch(/s1\s+07:30\s+Morning stretch\s+·\s+every day\s+·\s+has a video/);
    expect(e).toMatch(/s4\s+18:00\s+Long run\s+·\s+weekly/);
    expect(e).toContain('A stack from my list that you leave out is removed');
  });
  it('the organise prompt opens by asking how each stack is going', () => {
    const p = buildPrompt({ deckItems: DECK }, PLAN_MODE.REBUILD);
    expect(p).toContain('ask how each one is going');
    expect(p).not.toContain('invite me to tell you anything at all');
    // and an empty Stack falls back to the open door
    expect(buildPrompt({ deckItems: [] }, PLAN_MODE.REBUILD)).toContain('invite me to tell you anything at all');
  });
});

describe('diffPlan — matching', () => {
  it('keeps, changes, adds and removes by ref', () => {
    const d = diffPlan(DECK, plan([
      { ref: 's1', title: 'Morning stretch', meta: '10 min', time: '07:30', repeat: 'daily', dayOffset: 0 },
      { ref: 's3', title: 'Box breathing', time: '21:00', repeat: 'daily' },
      { title: 'Evening walk', time: '19:00', repeat: 'daily' },
      { ref: 's2', title: 'Supplements', time: '08:00' },
    ]), REFS);
    expect(d.keeps.map((k) => k.id).sort()).toEqual(['a', 'd']);
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0].id).toBe('b');
    expect(d.changes[0].patch).toEqual({ time: '21:00' });
    expect(d.adds.map((a) => a.item.title)).toEqual(['Evening walk']);
    expect(d.removes.map((r) => r.id)).toEqual(['c']);
  });

  it('falls back to the same title when the model dropped the ref', () => {
    const d = diffPlan(DECK, plan([{ title: 'box   BREATHING!', time: '13:00', repeat: 'daily' }]), REFS);
    expect(d.keeps.map((k) => k.id)).toEqual(['b']);
    expect(d.adds).toHaveLength(0);
  });

  it('never matches a stack twice, and an unknown ref is just new', () => {
    const d = diffPlan(DECK, plan([
      { ref: 's1', title: 'Morning stretch' },
      { ref: 's1', title: 'Stretch again' },
      { ref: 's99', title: 'Mystery' },
    ]), REFS);
    expect(d.keeps.concat(d.changes).map((x) => x.id)).toEqual(['a']);
    expect(d.adds.map((a) => a.item.title)).toEqual(['Stretch again', 'Mystery']);
  });

  it('titles are compared as words', () => {
    expect(normTitle('Café  stretch — 10 MIN')).toBe('cafe stretch 10 min');
  });
});

describe('diffPlan — what counts as a change', () => {
  it('a field the model left out is not a change', () => {
    // No repeat, no meta, no time, no dayOffset: parsePlanDoc defaults repeat to
    // "once", and that default must NOT reach a daily stack.
    const d = diffPlan(DECK, plan([{ ref: 's1', title: 'Morning stretch' }]), REFS);
    expect(d.changes).toHaveLength(0);
    expect(d.keeps.map((k) => k.id)).toEqual(['a']);
  });

  it('dayOffset 0 on a stack already running is not a move', () => {
    const d = diffPlan(DECK, plan([{ ref: 's3', title: 'Box breathing', dayOffset: 0, repeat: 'daily' }]), REFS);
    expect(d.changes).toHaveLength(0);
  });

  it('moving a weekly stack to another day sets its start', () => {
    const d = diffPlan(DECK, plan([{ ref: 's4', title: 'Long run', dayOffset: 3, repeat: 'weekly' }]), REFS);
    expect(d.changes[0].patch).toEqual({ anchor: dateKeyFromOffset(3) });
    expect(describeField(d.changes[0].fields[0])).toMatch(/^starts /);
  });

  it('a repeat change on a stack with no start date gives it one, or it would still show every day', () => {
    const d = diffPlan(DECK, plan([{ ref: 's2', title: 'Supplements', repeat: 'weekly' }]), REFS);
    expect(d.changes[0].patch.repeat).toBe('weekly');
    expect(d.changes[0].patch.anchor).toBe(todayKey());
  });

  it('describes changes in plain words', () => {
    expect(describeField({ key: 'time', from: '07:30', to: '18:00' })).toBe('07:30 → 18:00');
    expect(describeField({ key: 'repeat', from: 'daily', to: 'weekly' })).toBe('every day → weekly');
    expect(describeField({ key: 'repeat', from: '3', to: 'once' })).toBe('every 3 days → once');
    expect(describeField({ key: 'title', from: 'A', to: 'Evening stretch' })).toBe('new name: Evening stretch');
    expect(describeField({ key: 'day', from: 0, to: 1 })).toBe('starts tomorrow');
  });

  it('startOffset counts days ahead, and a past start as 0', () => {
    expect(startOffset({ anchor: dateKeyFromOffset(4) })).toBe(4);
    expect(startOffset({ anchor: dateKeyFromOffset(-4) })).toBe(0);
    expect(startOffset({})).toBe(0);
  });
});

describe('parsePlanDoc v3', () => {
  it('reads refs and up to three video suggestions, old single video too', () => {
    const [a, b] = plan([
      { ref: 'S2', title: 'Walk', videos: [{ q: 'walk 1' }, { q: 'walk 2', yt: 'yLDAHd_C7G0' }, { q: 'walk 3' }, { q: 'walk 4' }] },
      { ref: 'nope', title: 'Old', video: { q: 'old search', yt: 'tybOi4hjZFQ' } },
    ]);
    expect(a._ref).toBe('s2');
    expect(a._videos).toHaveLength(3);
    expect(a._videos[1]).toEqual({ q: 'walk 2', yt: 'yLDAHd_C7G0' });
    expect(b._ref).toBeUndefined();
    expect(b._videos).toEqual([{ q: 'old search', yt: 'tybOi4hjZFQ' }]);
  });
  it('records which fields were really sent', () => {
    const [x] = plan([{ title: 'X', time: '7am' }]);
    expect(x._timeGiven).toBe(true);
    expect(x._repeatGiven).toBe(false);
    expect(x._dayGiven).toBe(false);
    expect(x._metaGiven).toBe(false);
  });
});
