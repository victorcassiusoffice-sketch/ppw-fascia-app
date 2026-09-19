// The restructure half of the AI bridge (Vic, 2026-09-19).
//
// Until now the AI was handed a COUNT of free slots and nothing else, and Apply
// could only append — so "reorganise my week" returned a second set of stacks
// next to the first. The user now picks, in the sheet, before the prompt is
// built: keep what I have, or redo the whole day. That choice IS the consent,
// which is why nothing is echoed in the default FRESH mode.
//
// Two rules are load-bearing and are pinned here:
//   • Redaction is by KIND. A note's title is the user's private affirmation and
//     a document's title is a filename, so neither is ever sent — only that the
//     slot is taken. By kind, never by wording, so a future kind is excluded the
//     day it exists.
//   • A rebuild may only replace what the AI was actually shown. Private stacks
//     were never offered, so a rebuild can never delete them.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildPrompt, planEcho, replaceableItems, isPrivateKind, PLAN_MODE } from './assistant/aiPrompt.js';

async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

const DECK = [
  { id: 'w', title: 'Sunrise loop', time: '07:30', repeat: 'daily' },
  { id: 'n', title: 'I am doing enough.', time: '21:30', repeat: 'daily', kind: 'note' },
  { id: 'd', title: 'Blood-results-2026.pdf', time: '09:00', repeat: 'daily', kind: 'doc' },
  { id: 'g', title: 'Heavy lift', time: '18:00', repeat: 'weekly' },
];

beforeEach(() => { localStorage.clear(); });

describe('what the AI is shown', () => {
  it('sends nothing about the plan unless the user asked', () => {
    const p = buildPrompt({ deckItems: DECK, premium: false });
    expect(p).not.toContain('Sunrise loop');
    expect(p).not.toContain('ALREADY IN MY DAY');
    expect(p).not.toContain('AS IT STANDS');
  });

  it('sends nothing when there is no day to send', () => {
    expect(planEcho({ deckItems: [] }, PLAN_MODE.REBUILD)).toBe('');
    expect(planEcho({ deckItems: DECK }, PLAN_MODE.FRESH)).toBe('');
  });

  it('lists the day as fixed when the user keeps it', () => {
    const e = planEcho({ deckItems: DECK }, PLAN_MODE.AROUND);
    expect(e).toContain('all of it stays exactly as it is');
    expect(e).toContain('Sunrise loop');
    expect(e).toContain('ONLY the new things');
  });

  it('offers the day as a draft when the user redoes it', () => {
    const e = planEcho({ deckItems: DECK }, PLAN_MODE.REBUILD);
    expect(e).toContain('you are rebuilding this');
    expect(e).toContain('Send me the WHOLE day back');
    expect(e).toContain('Anything from the draft you leave out is removed');
  });
});

describe('redaction is by kind, in every mode', () => {
  for (const mode of [PLAN_MODE.AROUND, PLAN_MODE.REBUILD]) {
    it(`never sends a note's words or a document's name (${mode})`, () => {
      const e = planEcho({ deckItems: DECK }, mode);
      expect(e).not.toContain('I am doing enough.');
      expect(e).not.toContain('Blood-results-2026.pdf');
      expect(e).toContain('a note to myself');
      expect(e).toContain('a document');
      // the slot is still visible, so the AI can plan around it
      expect(e).toContain('21:30');
      expect(e).toContain('09:00');
    });
  }

  it('tells the AI the private ones are staying put', () => {
    const e = planEcho({ deckItems: DECK }, PLAN_MODE.REBUILD);
    expect(e).toContain('they stay exactly where they are');
    expect(e).toContain('do not try to guess what they say');
  });

  it('classifies kinds the same way everywhere', () => {
    expect(replaceableItems(DECK).map((i) => i.id)).toEqual(['w', 'g']);
    expect(isPrivateKind({ kind: 'note' })).toBe(true);
    expect(isPrivateKind({ kind: 'doc' })).toBe(true);
    expect(isPrivateKind({ kind: 'med' })).toBe(true);   // excluded before it exists
    expect(isPrivateKind({ title: 'Sunrise loop' })).toBe(false);
  });
});

describe('applyPlanRebuild — replaces only what the AI was shown', () => {
  it('removes the replaceable stacks, keeps the private ones, adds the new plan', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [...DECK], premium: true, doneByDate: {} });

    const res = s.applyPlanRebuild(
      [{ title: 'Evening walk', time: '18:30', _day: 0, _repeat: 'daily' }],
      ['w', 'g'],
    );

    expect(res.ok).toBe(true);
    const titles = s.getState().deckItems.map((i) => i.title);
    expect(titles).toContain('Evening walk');
    expect(titles).toContain('I am doing enough.');      // private, untouched
    expect(titles).toContain('Blood-results-2026.pdf');  // private, untouched
    expect(titles).not.toContain('Sunrise loop');
    expect(titles).not.toContain('Heavy lift');
  });

  it('hands back the removed stacks in full, so Undo can restore them', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [...DECK], premium: true, doneByDate: {} });

    const res = s.applyPlanRebuild([{ title: 'New thing', time: '10:00', _day: 0 }], ['w', 'g']);
    expect(res.removed.map((i) => i.id)).toEqual(['w', 'g']);

    s.removeItemsByIds(res.ids);
    s.restoreItems(res.removed);

    const titles = s.getState().deckItems.map((i) => i.title).sort();
    expect(titles).toEqual(['Blood-results-2026.pdf', 'Heavy lift', 'I am doing enough.', 'Sunrise loop']);
  });

  it('does not restore something that is already back', async () => {
    const s = await freshStore();
    s.setState({ deckItems: [...DECK], premium: true, doneByDate: {} });
    s.restoreItems([DECK[0]]);
    expect(s.getState().deckItems.filter((i) => i.id === 'w')).toHaveLength(1);
  });
});

describe('the free cap counts what survives, not what was there', () => {
  const full = () => Array.from({ length: 10 }, (_, i) => ({ id: 'x' + i, title: 't' + i, time: '08:00' }));

  it('lets a full free Stack be rebuilt smaller without an upsell', async () => {
    const s = await freshStore();
    s.setState({ deckItems: full(), premium: false, doneByDate: {} });

    const res = s.applyPlanRebuild(
      [{ title: 'A', time: '08:00' }, { title: 'B', time: '09:00' }],
      full().map((i) => i.id),
    );

    expect(res.ok).toBe(true);
    expect(s.getState().deckItems).toHaveLength(2);
    expect(s.getState().premiumUpsell).toBeNull();
  });

  it('still refuses a rebuild that would overflow, and says what fits', async () => {
    const s = await freshStore();
    s.setState({ deckItems: full(), premium: false, doneByDate: {} });

    // replace only 2 of the 10 with 5 new ones -> 8 kept + 5 = 13 > 10
    const res = s.applyPlanRebuild(
      Array.from({ length: 5 }, (_, i) => ({ title: 'n' + i, time: '10:00' })),
      ['x0', 'x1'],
    );

    expect(res.upsell).toBe(true);
    expect(res.fits).toBe(2);
    expect(s.getState().deckItems).toHaveLength(10); // nothing half-applied
  });

  it('appending still uses the plain count', async () => {
    const s = await freshStore();
    s.setState({ deckItems: full(), premium: false, doneByDate: {} });
    const res = s.addItemsToPlan([{ title: 'one more', time: '11:00' }]);
    expect(res.upsell).toBe(true);
  });
});

describe('headroom follows the mode', () => {
  it('charges a rebuild only for the stacks it cannot touch', () => {
    const around = buildPrompt({ deckItems: DECK, premium: false }, PLAN_MODE.AROUND);
    const rebuild = buildPrompt({ deckItems: DECK, premium: false }, PLAN_MODE.REBUILD);
    expect(around).toContain('room for 6 more things');   // 10 cap - 4 on the Stack
    expect(rebuild).toContain('room for 8 more things');  // 10 cap - 2 pinned private
  });
});
