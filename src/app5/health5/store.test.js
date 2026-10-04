// The health store slice, the age gate, and the new `weekdays` repeat.
//
// The age gate is a safety rule, not a preference: under 18 means no
// supplements, no protocols, no meters. Unknown age must ASK rather than
// assume — assuming either way is wrong.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  emptyHealth, loadHealth, saveHealth, deleteHealth, healthAgeState, healthAllowed,
  weekKey, addConsent, hasConsent, addAskDoctor, HEALTH_KEY,
} from './store.js';

async function freshStore() {
  vi.resetModules();
  return await import('../store5.js');
}

beforeEach(() => { localStorage.clear(); });

describe('the slice is self-contained', () => {
  it('starts empty and round-trips through storage', () => {
    const h = emptyHealth();
    h.profile.sex = 'female';
    h.cabinet.push({ id: 'p1', name: 'D3', perServing: [] });
    expect(saveHealth(h)).toBe(true);
    const back = loadHealth();
    expect(back.profile.sex).toBe('female');
    expect(back.cabinet).toHaveLength(1);
  });

  it('survives corrupt storage rather than throwing', () => {
    localStorage.setItem(HEALTH_KEY, 'not json');
    expect(loadHealth().profile).toBeTruthy();
  });

  it('fills in fields a older build never wrote', () => {
    localStorage.setItem(HEALTH_KEY, JSON.stringify({ profile: { sex: 'male' } }));
    const h = loadHealth();
    expect(h.profile.sex).toBe('male');
    expect(h.settings.trackMacros).toBe(false);   // from the empty shape
    expect(Array.isArray(h.cabinet)).toBe(true);
  });

  it('deleting removes the one key completely', () => {
    saveHealth(emptyHealth());
    expect(localStorage.getItem(HEALTH_KEY)).toBeTruthy();
    deleteHealth(loadHealth());
    expect(localStorage.getItem(HEALTH_KEY)).toBeNull();
  });

  it('does not touch the existing stack keys', () => {
    localStorage.setItem('ppw5.stacks', JSON.stringify({ d: [{ id: 'x' }] }));
    saveHealth(emptyHealth());
    deleteHealth(loadHealth());
    expect(JSON.parse(localStorage.getItem('ppw5.stacks')).d).toHaveLength(1);
  });
});

describe('the age gate', () => {
  it('allows 18 and over', () => {
    expect(healthAllowed({ age: 18 })).toBe(true);
    expect(healthAllowed({ age: 45 })).toBe(true);
  });

  it('blocks under 18', () => {
    expect(healthAllowed({ age: 17 })).toBe(false);
    expect(healthAgeState({ age: 17 }).reason).toBe('under_18');
  });

  it('asks when the age is unknown, rather than assuming', () => {
    const s = healthAgeState({});
    expect(s.allowed).toBe(false);
    expect(s.ask).toBe(true);
  });

  // The real default from emptyHealth() is age: null, NOT undefined — and
  // Number(null) is 0, which is finite. Before this was guarded, every new user
  // was read as "age 0" and silently locked out instead of being asked. Caught
  // by looking at the rendered screen, not by a unit test, which is why it is
  // pinned here now.
  it('treats a null or empty age as unknown, never as zero', () => {
    for (const age of [null, undefined, '']) {
      const s = healthAgeState({ ...emptyHealth().profile, age });
      expect(s.ask).toBe(true);
      expect(s.reason).toBe('ask');
    }
  });

  it('the default profile asks rather than locking out', () => {
    expect(healthAgeState(emptyHealth().profile).ask).toBe(true);
  });

  it('accepts a one-off confirmation when there is no birth date', () => {
    expect(healthAllowed({ ageConfirmed: true })).toBe(true);
    expect(healthAllowed({ ageConfirmed: false })).toBe(false);
  });
});

describe('consents and questions are recorded with a date', () => {
  it('stores a doctor-OK tap once', () => {
    let h = emptyHealth();
    h = addConsent(h, 'doctor_ok', 'product:p1', '2026-10-04');
    h = addConsent(h, 'doctor_ok', 'product:p1', '2026-10-05');
    expect(h.consents).toHaveLength(1);
    expect(h.consents[0].dateISO).toBe('2026-10-04');
    expect(hasConsent(h, 'doctor_ok', 'product:p1')).toBe(true);
    expect(hasConsent(h, 'doctor_ok', 'product:p2')).toBe(false);
  });

  it('adds a doctor question without duplicating it', () => {
    let h = emptyHealth();
    h = addAskDoctor(h, 'Is my iron dose right?', '2026-10-04');
    h = addAskDoctor(h, 'Is my iron dose right?', '2026-10-05');
    h = addAskDoctor(h, '   ', '2026-10-05');
    expect(h.askDoctor).toHaveLength(1);
  });
});

describe('ISO week key, for plant variety', () => {
  it('groups a week together and splits across weeks', () => {
    expect(weekKey('2026-10-04')).toBe(weekKey('2026-10-04'));
    expect(weekKey('2026-10-05')).not.toBe(weekKey('2026-10-04'));  // Sun vs Mon
  });
});

describe('the weekdays repeat', () => {
  it('normRepeat understands the spellings people use', async () => {
    const s = await freshStore();
    for (const v of ['weekdays', 'Weekdays', 'Mon-Fri', 'monday to friday', 'work days']) {
      expect(s.normRepeat(v)).toBe('weekdays');
    }
  });

  it('occurs Monday to Friday and not at the weekend', async () => {
    const s = await freshStore();
    // 2026-10-05 is a Monday; 2026-10-10 a Saturday; 2026-10-11 a Sunday.
    const item = { anchor: '2026-10-5', repeat: 'weekdays' };
    expect(s.itemOnDate(item, '2026-10-5')).toBe(true);    // Mon
    expect(s.itemOnDate(item, '2026-10-9')).toBe(true);    // Fri
    expect(s.itemOnDate(item, '2026-10-10')).toBe(false);  // Sat
    expect(s.itemOnDate(item, '2026-10-11')).toBe(false);  // Sun
  });

  it('does not start before its anchor', async () => {
    const s = await freshStore();
    expect(s.itemOnDate({ anchor: '2026-10-5', repeat: 'weekdays' }, '2026-10-2')).toBe(false);
  });

  it('leaves the existing repeats alone', async () => {
    const s = await freshStore();
    expect(s.normRepeat('daily')).toBe('daily');
    expect(s.normRepeat('weekly')).toBe('weekly');
    expect(s.normRepeat('every 3 days')).toBe('3');
    expect(s.normRepeat('nonsense')).toBeUndefined();
    const weekly = { anchor: '2026-10-5', repeat: 'weekly' };
    expect(s.itemOnDate(weekly, '2026-10-12')).toBe(true);
    expect(s.itemOnDate(weekly, '2026-10-11')).toBe(false);
  });
});
