// Routine format v2 in the share link (2026-11-03, plan step 3).
//
// A practitioner's programme now says WHO wrote it (`a`), WHAT it addresses
// (`g`) and WHICH VERSION it is (`rv`); videos still travel as a URL in `u`.
// The item shape did not change, so a v1 link opens exactly as before and a v1
// reader that ignores unknown keys still opens a v2 link. Round trips through
// the REAL codec, plus hand-built payloads so a change to the wire format fails
// here instead of being quietly followed.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  routineToLink, parseRoutineLink, routineMeta, normRoutineVersion, createRoutine, updateRoutine,
  setPendingShare, getState, setState, routineItemsForSave,
  ROUTINE_MAX_AUTHOR, ROUTINE_MAX_GOAL, ROUTINE_MAX_VERSION,
} from './store5.js';

beforeEach(() => {
  localStorage.clear();
  setState({ routines: [], pendingShare: null, shareError: null, shareHidden: false, premium: true, premiumPaid: false });
});

function payload(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Decode what routineToLink wrote, by hand. */
function decode(url) {
  const b64 = url.slice(url.indexOf('#r=') + 3).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

const ITEMS = [
  { title: 'Pendulum swings', meta: '2 min each arm', url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', thumb: 'yt', time: '08:00', repeat: 'daily' },
  { title: 'Wall slides', time: '08:20', repeat: 'daily' },
  { title: 'Review with the clinic', time: '10:00', repeat: 'weekly', dayOffset: 7 },
];
const PROGRAMME = {
  name: 'Shoulder rehab — weeks 1-6', items: ITEMS,
  author: 'Victor Cassius Bhatoolaul', goal: 'Right shoulder after the fall', version: 2,
};

describe('v2 on the wire', () => {
  it('writes v:2 with the author, the issue and the version, and reads them back', () => {
    const url = routineToLink(PROGRAMME);
    expect(url).toBeTruthy();
    const wire = decode(url);
    expect(wire.v).toBe(2);
    expect(wire.a).toBe('Victor Cassius Bhatoolaul');
    expect(wire.g).toBe('Right shoulder after the fall');
    expect(wire.rv).toBe('2');
    // The item shape is the v1 shape — a video is a URL in `u`, nothing else.
    expect(wire.i[0]).toEqual({ t: 'Pendulum swings', m: '2 min each arm', u: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', b: 'yt', h: '08:00', r: 'daily' });
    expect(wire.i[2].d).toBe(7);

    const res = parseRoutineLink(url);
    expect(res.ok).toBe(true);
    expect(res.wire).toBe(2);
    expect(res.author).toBe('Victor Cassius Bhatoolaul');
    expect(res.goal).toBe('Right shoulder after the fall');
    expect(res.version).toBe('2');
    expect(res.items.map((it) => it.title)).toEqual(['Pendulum swings', 'Wall slides', 'Review with the clinic']);
    // The video arrives as a URL and its embed is DERIVED on arrival, as before.
    expect(res.items[0].url).toBe('https://www.youtube.com/watch?v=v7AYKMP6rOE');
    expect(res.items[0].embed).toMatch(/youtube\.com\/embed\/v7AYKMP6rOE/);
    expect(res.items[2]._day).toBe(7);
  });

  it('writes no meta keys for a routine that has none — and still says v:2', () => {
    const wire = decode(routineToLink({ name: 'Morning reset', items: ITEMS }));
    expect(wire.v).toBe(2);
    expect('a' in wire).toBe(false);
    expect('g' in wire).toBe(false);
    expect('rv' in wire).toBe(false);
    const res = parseRoutineLink(routineToLink({ name: 'Morning reset', items: ITEMS }));
    expect(res.author).toBeNull();
    expect(res.goal).toBeNull();
    expect(res.version).toBeNull();
  });
});

describe('backward compatible: v1 links keep opening', () => {
  const V1_ITEMS = [
    { t: 'Pendulum swings', m: '2 min each arm', u: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', h: '08:00', r: 'daily' },
    { t: 'Wall slides', h: '08:20', r: 'daily' },
    { t: 'Review with the clinic', h: '10:00', r: 'weekly', d: 7 },
  ];

  it('a v1 payload (v:1) opens with the meta absent', () => {
    const res = parseRoutineLink('#r=' + payload({ p: 'ppwr', v: 1, n: 'Shoulder rehab', i: V1_ITEMS }));
    expect(res.ok).toBe(true);
    expect(res.wire).toBe(1);
    expect(res.name).toBe('Shoulder rehab');
    expect(res.items).toHaveLength(3);
    expect(res.items[0].url).toBe('https://www.youtube.com/watch?v=v7AYKMP6rOE');
    expect(res.items[2]._day).toBe(7);
    expect(res.author).toBeNull();
    expect(res.goal).toBeNull();
    expect(res.version).toBeNull();
  });

  it('a payload with no version field at all is read as v1', () => {
    const res = parseRoutineLink('#r=' + payload({ p: 'ppwr', n: 'Old link', i: V1_ITEMS }));
    expect(res.ok).toBe(true);
    expect(res.wire).toBe(1);
    expect(res.author).toBeNull();
  });

  it('a hand-built v2 payload opens with the meta', () => {
    const res = parseRoutineLink('#r=' + payload({ p: 'ppwr', v: 2, n: 'Shoulder rehab', a: 'Victor', g: 'Right shoulder', rv: '3', i: V1_ITEMS }));
    expect(res.ok).toBe(true);
    expect(res.wire).toBe(2);
    expect(res.author).toBe('Victor');
    expect(res.goal).toBe('Right shoulder');
    expect(res.version).toBe('3');
  });

  it('a link from a LATER version still opens: unknown top-level keys are not read', () => {
    const res = parseRoutineLink('#r=' + payload({ p: 'ppwr', v: 3, n: 'Future', a: 'Victor', future: { x: 1 }, i: V1_ITEMS }));
    expect(res.ok).toBe(true);
    expect(res.wire).toBe(3);
    expect(res.author).toBe('Victor');
    expect(res.items).toHaveLength(3);
  });

  it('a stranger\'s meta is bounded, not trusted', () => {
    const res = parseRoutineLink('#r=' + payload({ p: 'ppwr', v: 2, n: 'X', a: 'A'.repeat(500), g: 'G'.repeat(500), rv: 'V'.repeat(500), i: V1_ITEMS }));
    expect(res.author).toHaveLength(ROUTINE_MAX_AUTHOR);
    expect(res.goal).toHaveLength(ROUTINE_MAX_GOAL);
    expect(res.version).toHaveLength(ROUTINE_MAX_VERSION);
    // Non-strings become nothing, never a crash.
    const odd = parseRoutineLink('#r=' + payload({ p: 'ppwr', v: 2, n: 'X', a: { evil: 1 }, g: 42, rv: null, i: V1_ITEMS }));
    expect(odd.ok).toBe(true);
    expect(odd.author).toBe('[object Object]'.slice(0, ROUTINE_MAX_AUTHOR));
    expect(odd.goal).toBe('42');
    expect(odd.version).toBeNull();
  });
});

describe('routineMeta and the version', () => {
  it('normalises the three fields and leaves absent ones out', () => {
    expect(routineMeta({ author: '  Victor   Cassius  ', goal: '', version: 2 })).toEqual({ author: 'Victor Cassius', version: '2' });
    expect(routineMeta({})).toEqual({});
    expect(routineMeta(null)).toEqual({});
    expect(Object.keys(routineMeta({ author: '   ' }))).toEqual([]);
  });
  it('a version is a short string; a number is its digits; blank or zero is none', () => {
    expect(normRoutineVersion(3)).toBe('3');
    expect(normRoutineVersion(3.7)).toBe('3');
    expect(normRoutineVersion(0)).toBeUndefined();
    expect(normRoutineVersion(-1)).toBeUndefined();
    expect(normRoutineVersion('2026-11')).toBe('2026-11');
    expect(normRoutineVersion('')).toBeUndefined();
    expect(normRoutineVersion(undefined)).toBeUndefined();
  });
});

describe('the saved routine keeps the meta', () => {
  it('createRoutine stores author, goal and version, and nothing else from the meta', () => {
    const r = createRoutine('Shoulder rehab', routineItemsForSave(ITEMS), { author: 'Victor', goal: 'Right shoulder', version: 2, evil: 'no' });
    expect(r).toMatchObject({ name: 'Shoulder rehab', author: 'Victor', goal: 'Right shoulder', version: '2' });
    expect('evil' in r).toBe(false);
    const onDisk = JSON.parse(localStorage.getItem('ppw5.routines'));
    expect(onDisk[0]).toMatchObject({ author: 'Victor', goal: 'Right shoulder', version: '2' });
    // And it shares on with the same three fields.
    const res = parseRoutineLink(routineToLink(onDisk[0]));
    expect(res.author).toBe('Victor');
    expect(res.version).toBe('2');
  });

  it('a routine built by hand carries no meta keys at all', () => {
    const r = createRoutine('Morning reset', routineItemsForSave(ITEMS));
    expect('author' in r).toBe(false);
    expect('goal' in r).toBe(false);
    expect('version' in r).toBe(false);
  });

  it('updateRoutine raises the version in place', () => {
    const r = createRoutine('Shoulder rehab', routineItemsForSave(ITEMS), { author: 'Victor', version: 1 });
    updateRoutine(r.id, { version: '2', goal: 'Weeks 7-12' });
    const saved = getState().routines.find((x) => x.id === r.id);
    expect(saved.version).toBe('2');
    expect(saved.goal).toBe('Weeks 7-12');
    expect(saved.author).toBe('Victor');
  });

  it('a held programme carries the meta into state and into the mirror', () => {
    const res = parseRoutineLink(routineToLink(PROGRAMME));
    setPendingShare({ name: res.name, items: res.items, dropped: res.dropped, author: res.author, goal: res.goal, version: res.version });
    expect(getState().pendingShare).toMatchObject({ author: 'Victor Cassius Bhatoolaul', goal: 'Right shoulder after the fall', version: '2' });
    expect(JSON.parse(localStorage.getItem('ppw5.pendingShare'))).toMatchObject({ author: 'Victor Cassius Bhatoolaul', version: '2' });
  });

  // The real-browser gate caught this one (2026-11-03): the mirror held the
  // author, and the reload the first-run doors cause rebuilt the held programme
  // from the mirror WITHOUT it — so the sheet a brand-new client finally saw
  // said nothing about who sent it. The boot pass must carry all three fields.
  it('a fresh boot rebuilds the held programme from the mirror WITH the meta', async () => {
    const res = parseRoutineLink(routineToLink(PROGRAMME));
    setPendingShare({ name: res.name, items: res.items, dropped: res.dropped, author: res.author, goal: res.goal, version: res.version });
    const { vi } = await import('vitest');
    vi.resetModules();
    const s = await import('./store5.js');
    expect(s.getState().pendingShare).toMatchObject({ name: 'Shoulder rehab — weeks 1-6', author: 'Victor Cassius Bhatoolaul', goal: 'Right shoulder after the fall', version: '2' });
    expect(s.getState().pendingShare.items).toHaveLength(3);
    vi.resetModules();
  });
});
