// The cabinet, the slots, and what must never get one.
//
// The §9 cases for Phase 2, plus the shop-spec parser. The avoid cases are the
// ones that matter: scheduling something the data says to avoid, or letting its
// red badge quietly disappear, would make the app complicit in it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { setHealthData } from './data.js';
import {
  slotsFrom, slotsAgainstCap, deckItemsForCabinet, syncDeck, unscheduled, slotTitle,
  setSlotTaken, setProductTaken, takenToday, logStillTaking, isSchedulable,
  emptyProduct, upsertProduct, removeProduct, SUPPS_KIND, overMaxProducts,
} from './cabinet.js';
import { parseBrandSpec, parseChunk, productFromShopItem } from './parseSpec.js';
import { dayTotals } from './totals.js';
import { evaluate } from './limits.js';
import { slotConflicts } from './timing.js';

const read = (f) => JSON.parse(readFileSync(join(process.cwd(), 'docs/health-pack/data', f), 'utf8'));
const data = setHealthData({
  nutrients: read('nutrients.json'),
  ingredients: read('ingredients.json'),
  rules: read('rules.json'),
});
const TODAY = '2026-10-4';
const ctx = { data, profile: {}, todayISO: TODAY };

const P = (id, over = {}) => ({
  ...emptyProduct(), id, name: id, time: '08:00', repeat: 'daily',
  perServing: [{ id: 'vitamin_c', amount: 100, unit: 'mg' }], ...over,
});

describe('slots — many bottles, one card', () => {
  it('three supplements at 08:00 daily become one deck item', () => {
    const cabinet = [P('a'), P('b'), P('c')];
    const slots = slotsFrom(cabinet, ctx);
    expect(slots).toHaveLength(1);
    expect(slots[0].count).toBe(3);

    const deck = deckItemsForCabinet(cabinet, ctx, TODAY);
    expect(deck).toHaveLength(1);
    expect(deck[0].kind).toBe(SUPPS_KIND);
    expect(deck[0].meta).toContain('3 supplements');
  });

  it('counts once against the free cap', () => {
    expect(slotsAgainstCap([P('a'), P('b'), P('c')], ctx)).toBe(1);
  });

  it('different repeats at the same time are separate slots', () => {
    const cabinet = [P('a'), P('b', { repeat: 'weekly' }), P('c', { repeat: 'weekdays' })];
    expect(slotsFrom(cabinet, ctx)).toHaveLength(3);
    expect(slotsAgainstCap(cabinet, ctx)).toBe(3);
  });

  it('different times are separate slots, earliest first', () => {
    const slots = slotsFrom([P('pm', { time: '20:00' }), P('am', { time: '08:00' })], ctx);
    expect(slots.map((s) => s.time)).toEqual(['08:00', '20:00']);
  });

  it('names the slot by the time of day, never by what is in it', () => {
    expect(slotTitle({ time: '08:00' })).toBe('Morning supplements');
    expect(slotTitle({ time: '20:00' })).toBe('Evening supplements');
    // §5.9: a lock-screen reminder must never carry health detail, and the deck
    // title is what a notification would use.
    const deck = deckItemsForCabinet([P('a', { name: 'Ashwagandha KSM-66' })], ctx, TODAY);
    expect(deck[0].title).not.toContain('Ashwagandha');
  });

  it('says when a slot is taken with food', () => {
    expect(deckItemsForCabinet([P('a', { withFood: true })], ctx, TODAY)[0].meta).toContain('with food');
  });
});

describe('an `avoid` product never gets a slot', () => {
  // St John's wort with an SSRI is `avoid` in rules.json.
  const sjw = P('sjw', { name: "St John's wort", perServing: [{ id: 'st_johns_wort', amount: 300, unit: 'mg' }] });
  const onSSRI = { data, profile: { medicines: ['ssris_snris'] }, todayISO: TODAY };

  it('is refused a slot', () => {
    expect(isSchedulable(sjw, { ...onSSRI, cabinet: [sjw] })).toBe(false);
    expect(slotsFrom([sjw], onSSRI)).toHaveLength(0);
    expect(deckItemsForCabinet([sjw], onSSRI, TODAY)).toHaveLength(0);
  });

  it('is still listed, with its reason', () => {
    const list = unscheduled([sjw], onSSRI);
    expect(list).toHaveLength(1);
    expect(list[0].reason).toBe('avoid');
    expect(list[0].flags.some((f) => f.action === 'avoid')).toBe(true);
  });

  it('costs nothing against the cap, because it is not scheduled', () => {
    expect(slotsAgainstCap([sjw], onSSRI)).toBe(0);
  });

  it('"I still take this" logs it without ever scheduling it', () => {
    const taking = { ...sjw, stillTaking: true };
    expect(slotsFrom([taking], onSSRI)).toHaveLength(0);      // still no slot
    expect(unscheduled([taking], onSSRI)[0].stillTaking).toBe(true);

    const done = logStillTaking({}, TODAY, taking.id);
    expect(takenToday(done, TODAY).has(taking.id)).toBe(true);
  });

  it('a logged avoid item is still counted, so the limits can see it', () => {
    const zinc = P('z', { perServing: [{ id: 'zinc', amount: 50, unit: 'mg' }], scheduled: false, stillTaking: true });
    const t = dayTotals({ cabinet: [zinc], takenIds: ['z'], data });
    const r = evaluate(data.nutrientsById.get('zinc'), { totals: t.byNutrient.zinc, target: 11, thresholds: data.thresholds });
    expect(r.state).toBe('over_max');
  });

  it('an unscheduled item is NOT counted in planned, only when logged', () => {
    const zinc = P('z', { perServing: [{ id: 'zinc', amount: 50, unit: 'mg' }], scheduled: false, stillTaking: true });
    const planned = dayTotals({ cabinet: [zinc], data, scope: 'planned' });
    expect(planned.byNutrient.zinc).toBeUndefined();
  });
});

describe('ticking', () => {
  const cabinet = [P('a'), P('b')];
  const slot = slotsFrom(cabinet, ctx)[0];

  it('ticking the slot marks everything in it', () => {
    const done = setSlotTaken({}, TODAY, slot, true);
    expect(takenToday(done, TODAY)).toEqual(new Set(['a', 'b']));
  });

  it('unticking the slot clears it', () => {
    let done = setSlotTaken({}, TODAY, slot, true);
    done = setSlotTaken(done, TODAY, slot, false);
    expect(takenToday(done, TODAY).size).toBe(0);
  });

  it('one product can be ticked on its own', () => {
    const done = setProductTaken({}, TODAY, slot.id, 'a', true);
    expect(takenToday(done, TODAY)).toEqual(new Set(['a']));
  });

  it('keeps days apart', () => {
    const done = setSlotTaken({}, TODAY, slot, true);
    expect(takenToday(done, '2026-10-5').size).toBe(0);
  });
});

describe('the deck stays in step with the cabinet', () => {
  it('adds a slot and leaves the person’s own items alone', () => {
    const mine = [{ id: 'walk', title: 'Morning walk', time: '07:30', repeat: 'daily' }];
    const next = syncDeck(mine, [P('a')], ctx, TODAY);
    expect(next).toHaveLength(2);
    expect(next.find((d) => d.id === 'walk')).toBeTruthy();
    expect(next.find((d) => d.kind === SUPPS_KIND)).toBeTruthy();
  });

  it('removes a slot when its last supplement goes', () => {
    const withSlot = syncDeck([], [P('a')], ctx, TODAY);
    expect(withSlot.filter((d) => d.kind === SUPPS_KIND)).toHaveLength(1);
    const emptied = syncDeck(withSlot, [], ctx, TODAY);
    expect(emptied.filter((d) => d.kind === SUPPS_KIND)).toHaveLength(0);
  });

  it('does not churn ids when nothing changed', () => {
    const a = syncDeck([], [P('a')], ctx, TODAY);
    const b = syncDeck(a, [P('a')], ctx, TODAY);
    expect(b.map((d) => d.id)).toEqual(a.map((d) => d.id));
  });
});

describe('timing tips inside a slot', () => {
  it('iron and calcium together raise a move tip', () => {
    const cabinet = [
      P('fe', { perServing: [{ id: 'iron', amount: 14, unit: 'mg' }] }),
      P('ca', { perServing: [{ id: 'calcium', amount: 500, unit: 'mg' }] }),
    ];
    const slot = slotsFrom(cabinet, ctx)[0];
    expect(slot.count).toBe(2);
    expect(slotConflicts({ slotProducts: slot.products, data }).length).toBeGreaterThan(0);
  });
});

describe('reading a shop listing', () => {
  it('parses the D3 + K2 spec into two lines', () => {
    const { lines } = parseBrandSpec('5000 IU D3 + 90-100 mcg K2 MK-7', data);
    expect(lines).toHaveLength(2);
    expect(lines[0].id).toBe('vitamin_d');
    expect(lines[0].amount).toBe(5000);
    expect(lines[0].unit).toBe('IU');
    expect(lines[1].id).toBe('vitamin_k');
  });

  it('resolves a range to the HIGH end, and asks the person to check', () => {
    const l = parseChunk('15-30 mg zinc', data);
    expect(l.amount).toBe(30);          // cautious against a maximum
    expect(l.range).toEqual([15, 30]);
    expect(l.needsCheck).toBe(true);
  });

  it('reads thousands separators and hedging words', () => {
    const l = parseChunk('about 2,000 mg EPA', data);
    expect(l.amount).toBe(2000);
    expect(l.unit).toBe('mg');
  });

  it('reads a name-first spec too', () => {
    const l = parseChunk('Magnesium glycinate 400 mg', data);
    expect(l.id).toBe('magnesium');
    expect(l.amount).toBe(400);
  });

  it('keeps an ingredient it cannot name, rather than dropping it', () => {
    const l = parseChunk('200 mg SomethingNovel', data);
    expect(l.id).toBe('other');
    expect(l.name).toContain('SomethingNovel');
    expect(l.needsCheck).toBe(true);
  });

  it('builds a draft the person still has to confirm', () => {
    const item = { id: 'vitamin-d3-k2', brand: 'Sports Research', name: 'Vitamin D3 + K2', brand_spec: '5000 IU D3 + 90-100 mcg K2 MK-7' };
    const p = productFromShopItem(item, data, { id: 'x' });
    expect(p.source).toBe('shop');
    expect(p.needsCheck).toBe(true);
    expect(p.perServing.every((l) => l.fromSpec)).toBe(true);
  });

  it('the over-max shop products really do read as over max', () => {
    // From review/CATALOG-REVIEW.md: 5,000 IU D3 is 125 ug against a 100 ug limit.
    const item = { id: 'd', brand: 'X', name: 'D3', brand_spec: '5000 IU D3' };
    const p = productFromShopItem(item, data, { id: 'd' });
    const t = dayTotals({ cabinet: [p], takenIds: ['d'], data });
    const r = evaluate(data.nutrientsById.get('vitamin_d'), { totals: t.byNutrient.vitamin_d, target: 15, thresholds: data.thresholds });
    expect(r.countedForLimit).toBe(125);
    expect(r.state).toBe('over_max');
  });
});

describe('editing the cabinet', () => {
  it('adds, updates and removes', () => {
    let cab = [];
    const p = P('a');
    cab = upsertProduct(cab, p);
    expect(cab).toHaveLength(1);
    cab = upsertProduct(cab, { ...p, name: 'Renamed' });
    expect(cab).toHaveLength(1);
    expect(cab[0].name).toBe('Renamed');
    cab = removeProduct(cab, 'a');
    expect(cab).toHaveLength(0);
  });

  it('a new product starts schedulable with sane defaults', () => {
    const p = emptyProduct();
    expect(p.scheduled).toBe(true);
    expect(p.servings).toBe(1);
    expect(p.repeat).toBe('daily');
    expect(p.supervisedFor).toBeNull();
  });
});

describe('over-max is visible in the cabinet, not only in the edit sheet', () => {
  it('names a product that is over a limit on its own', () => {
    // 500 mg niacin against a 10 mg supplements-only maximum.
    const b3 = P('b3', { name: 'Niacin 500', perServing: [{ id: 'vitamin_b3', amount: 500, unit: 'mg' }] });
    const r = overMaxProducts([b3], ctx);
    expect(r.ids.has('b3')).toBe(true);
    expect(r.byProduct.b3[0]).toMatchObject({ nutrientId: 'vitamin_b3', limit: 10, unit: 'mg' });
    expect(r.byProduct.b3[0].counted).toBe(500);
  });

  it('names BOTH products when neither is over on its own', () => {
    // This is the case a per-product check cannot see: 15 mg + 15 mg of zinc is
    // over the 25 mg maximum while each bottle looks ordinary.
    const a = P('a', { perServing: [{ id: 'zinc', amount: 15, unit: 'mg' }] });
    const b = P('b', { perServing: [{ id: 'zinc', amount: 15, unit: 'mg' }] });
    expect(overMaxProducts([a], ctx).ids.size).toBe(0);
    const both = overMaxProducts([a, b], ctx);
    expect([...both.ids].sort()).toEqual(['a', 'b']);
  });

  it('says nothing about a dose the person’s doctor set', () => {
    const fe = P('fe', {
      perServing: [{ id: 'iron', amount: 65, unit: 'mg' }],   // over the 40 mg safe level
      supervised: true,
    });
    expect(overMaxProducts([fe], ctx).ids.has('fe')).toBe(false);
    // ...but without the doctor flag it is named.
    expect(overMaxProducts([{ ...fe, supervised: false }], ctx).ids.has('fe')).toBe(true);
  });

  it('ignores what is not scheduled, since it is not part of the planned day', () => {
    const b3 = P('b3', { perServing: [{ id: 'vitamin_b3', amount: 500, unit: 'mg' }], scheduled: false });
    expect(overMaxProducts([b3], ctx).ids.size).toBe(0);
  });

  it('is quiet about an ordinary cabinet', () => {
    const r = overMaxProducts([P('a'), P('b', { perServing: [{ id: 'vitamin_d', amount: 1000, unit: 'IU' }] })], ctx);
    expect(r.ids.size).toBe(0);
  });

  it('returns nothing rather than throwing before the data has loaded', () => {
    expect(overMaxProducts([P('a')], { data: null }).ids.size).toBe(0);
  });
});
