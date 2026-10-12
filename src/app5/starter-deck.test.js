// THE FIRST DAY A NEW CUSTOMER OPENS.
//
// Vic, 2026-10-12: "When you open an empty stack, it starts with some default,
// arrange it so it avoids mentioning yoga. Have stretching, supplements,
// affirmation, a youtube HITT workout."
//
// So this file is about the four slots `starterDeck()` puts on a brand-new
// install, and about one word being gone from the whole seed. Both halves
// matter and neither implies the other: swapping the deck still leaves "Yoga
// For Complete Beginners" sitting in the Library a tap away, which is the
// mention Vic would actually see.
//
// WHY THE VIDEO IDS ARE ASSERTED BY SHAPE AND BY ID. src/app5/assistant/
// verifyVideo.js records the reason at length: an 11-character YouTube id that
// LOOKS real can be invented, and the nastiest failure is an id that resolves
// to a different video than the title claims. These two were checked against
// YouTube's own oEmbed endpoint while this change was written — both answered
// 200 and the titles and channels below are YouTube's, copied, not composed:
//   yLDAHd_C7G0  "10 MIN DAILY STRETCH (full body) ..."  MadFit
//   zr08J6wB53Y  "10 MIN HIGH INTENSITY WORKOUT ..."     Pamela Reif
// A test cannot re-run that check (no network in CI, and a flaky suite is worse
// than none), so what it CAN hold is the pair: if someone edits an id they must
// edit the id named here, which is the moment to go and ask YouTube again.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YT_ID } from './assistant/verifyVideo.js';

const STRETCH_ID = 'yLDAHd_C7G0';
const HIIT_ID = 'zr08J6wB53Y';

/** A store booted from a clean module registry — what a brand-new install gets. */
async function freshStore() {
  vi.resetModules();
  return await import('./store5.js');
}

/** Every YouTube id anywhere in a seeded item, however it is carried. */
function idsIn(items) {
  const out = [];
  for (const it of items) {
    for (const field of [it.url, it.embed, it.thumbUrl]) {
      const m = String(field || '').match(/(?:watch\?v=|embed\/|\/vi\/)([^?&/]+)/);
      if (m) out.push(m[1]);
    }
  }
  return out;
}

describe('the starter deck a brand-new install opens on', () => {
  beforeEach(() => { localStorage.clear(); });

  it('gives the first day a stretch, a supplement reminder, a HIIT workout and an affirmation', async () => {
    const s = await freshStore();
    const deck = s.getState().deckItems;

    const stretch = deck.find((it) => String(it.url || '').includes(STRETCH_ID));
    expect(stretch).toBeTruthy();
    expect(stretch.title).toMatch(/stretch/i);
    expect(stretch.meta).toMatch(/MadFit/);

    // Not a video and not a note: a plain slot that arrives at a time of day and
    // says take them. Tapping it must not try to open a player, so it carries no
    // url and no embed — the shape SuppsSection's own stack items have minus the
    // affiliate link, because we are not picking a product for anyone.
    const supp = deck.find((it) => it.kind === 'supp');
    expect(supp).toBeTruthy();
    expect(supp.url).toBeUndefined();
    expect(supp.embed).toBeUndefined();
    expect(`${supp.title} ${supp.meta}`).toMatch(/supplement/i);

    const hiit = deck.find((it) => String(it.url || '').includes(HIIT_ID));
    expect(hiit).toBeTruthy();
    expect(hiit.title).toMatch(/HIIT|high intensity/i);
    expect(hiit.meta).toMatch(/Pamela Reif/);

    const affirmation = deck.find((it) => it.kind === 'note');
    expect(affirmation).toBeTruthy();
    expect(String(affirmation.title).length).toBeGreaterThan(0);

    // Four distinct slots, not one item answering to several descriptions.
    expect(new Set([stretch.id, supp.id, hiit.id, affirmation.id]).size).toBe(4);

    // They run through the day in the order they are listed, so the Stack screen
    // reads as a day rather than as a pile.
    const times = deck.map((it) => it.time);
    expect([...times].sort()).toEqual(times);
  });

  it('says yoga nowhere a new user can read it', async () => {
    const s = await freshStore();
    const seeded = JSON.stringify(s.getState());
    expect(seeded).not.toMatch(/yoga/i);
  });

  it('carries only well-formed YouTube ids, and the two that were verified', async () => {
    const s = await freshStore();
    const st = s.getState();
    const ids = idsIn([...st.deckItems, ...st.mediaItems]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(YT_ID.test(id)).toBe(true);
    expect(ids).toContain(STRETCH_ID);
    expect(ids).toContain(HIIT_ID);
  });

  it('is still ours to clear in one tap', async () => {
    const s = await freshStore();
    expect(s.getState().deckItems).toHaveLength(4);
    expect(s.getState().deckItems.every((it) => it.example)).toBe(true);
    expect(s.onlyExamplesLeft()).toBe(true);
    s.clearExamples();
    expect(s.getState().deckItems).toEqual([]);
    expect(s.onlyExamplesLeft()).toBe(false);   // nothing left to clear
  });

  it('leaves a day alone once one of the four is the user’s own', async () => {
    const s = await freshStore();
    const mine = { id: 'mine', title: 'My own thing', time: '08:00' };
    s.setState({ deckItems: [...s.getState().deckItems, mine] });
    expect(s.onlyExamplesLeft()).toBe(false);
    s.clearExamples();
    expect(s.getState().deckItems.map((it) => it.id)).toEqual(['mine']);
  });
});
