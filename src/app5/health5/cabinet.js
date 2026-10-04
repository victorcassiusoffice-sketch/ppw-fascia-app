// cabinet.js — the person's supplements, and the slots they become.
//
// A cabinet is a list of products. The Stack screen does not want twelve
// separate cards at 08:00; it wants one that says "Morning supplements · 4".
// So products sharing a TIME and a REPEAT collapse into one slot, and a slot is
// what becomes a deck item. One slot costs one stack against the free cap,
// however many bottles are inside it.
//
// The important rule here is about what must NOT get a slot. A product flagged
// `avoid` is never scheduled and never reminds — it sits in the cabinet marked
// "Not scheduled", with its reason, and goes on the list of questions for the
// doctor. If the person says "I still take this", they get a way to LOG it —
// because the limits have to see it — but still no slot and no reminder, and
// the red badge stays everywhere. Scheduling something the data says to avoid
// would make the app complicit in it.

import { flagsForProduct } from './flags.js';
import { dayTotals, productContributions } from './totals.js';
import { evaluate } from './limits.js';
import { targetFor } from './targets.js';

export const SUPPS_KIND = 'supps';

/** Products at the same time, on the same repeat, are one slot. */
export const slotKey = (product) => `${product?.time || 'anytime'}|${product?.repeat || 'daily'}`;

/** A stable deck id for a slot, so re-syncing does not churn ids. */
export const slotId = (key) => `supps:${key}`;

/**
 * Is this product allowed to be scheduled?
 *
 * `avoid` is the only thing that blocks a slot. doctor_first does not: the
 * person has either tapped "my doctor says it's OK" (and it behaves normally)
 * or they have not, in which case the UI holds it — but that is the UI's call,
 * not a reason to refuse the slot outright.
 */
export function isSchedulable(product, ctx) {
  if (product?.scheduled === false) return false;
  const { action } = flagsForProduct(product, ctx);
  return action !== 'avoid';
}

/**
 * Group a cabinet into slots.
 *
 * Returns [{ key, id, time, repeat, products, count, withFood }], earliest
 * first, with untimed products last. `avoid` products are excluded entirely —
 * they are reported separately by unscheduled().
 */
export function slotsFrom(cabinet = [], ctx = {}) {
  const map = new Map();
  for (const product of cabinet) {
    if (!isSchedulable(product, { ...ctx, cabinet })) continue;
    const key = slotKey(product);
    if (!map.has(key)) {
      map.set(key, {
        key,
        id: slotId(key),
        time: product.time || null,
        repeat: product.repeat || 'daily',
        products: [],
        withFood: false,
      });
    }
    const slot = map.get(key);
    slot.products.push(product);
    if (product.withFood) slot.withFood = true;
  }

  return [...map.values()]
    .map((s) => ({ ...s, count: s.products.length }))
    .sort((a, b) => String(a.time || '99:99').localeCompare(String(b.time || '99:99')));
}

/** Products that are in the cabinet but deliberately not scheduled. */
export function unscheduled(cabinet = [], ctx = {}) {
  const out = [];
  for (const product of cabinet) {
    const { action, flags } = flagsForProduct(product, { ...ctx, cabinet });
    if (action === 'avoid') {
      out.push({ product, reason: 'avoid', flags, stillTaking: !!product.stillTaking });
    } else if (product.scheduled === false) {
      out.push({ product, reason: 'unscheduled', flags, stillTaking: !!product.stillTaking });
    }
  }
  return out;
}

/** What the slot card says: "Morning supplements", "Evening supplements"… */
export function slotTitle(slot) {
  const t = slot?.time;
  if (!t) return 'Supplements';
  const h = Number(String(t).slice(0, 2));
  if (!Number.isFinite(h)) return 'Supplements';
  if (h < 11) return 'Morning supplements';
  if (h < 15) return 'Midday supplements';
  if (h < 19) return 'Afternoon supplements';
  return 'Evening supplements';
}

/**
 * Turn slots into deck items.
 *
 * The title carries no product names on purpose: §5.9 says a lock-screen
 * reminder must never show health detail, and the deck item's title is what a
 * notification would use. "Time for your supplements" is the whole point.
 */
export function deckItemsForCabinet(cabinet = [], ctx = {}, todayKey = null) {
  return slotsFrom(cabinet, ctx).map((slot) => ({
    id: slot.id,
    kind: SUPPS_KIND,
    title: slotTitle(slot),
    meta: `${slot.count} supplement${slot.count === 1 ? '' : 's'}${slot.withFood ? ' · with food' : ''}`,
    time: slot.time || undefined,
    repeat: slot.repeat,
    anchor: todayKey || undefined,
    suppsCount: slot.count,
    productIds: slot.products.map((p) => p.id),
  }));
}

/**
 * Reconcile the deck with the cabinet.
 *
 * Deck items of kind `supps` are DERIVED — the cabinet owns them. Anything the
 * person added themselves is left completely alone.
 */
export function syncDeck(deckItems = [], cabinet = [], ctx = {}, todayKey = null) {
  const mine = deckItemsForCabinet(cabinet, ctx, todayKey);
  const byId = new Map(mine.map((d) => [d.id, d]));
  const kept = [];

  for (const item of deckItems) {
    if (item.kind !== SUPPS_KIND) { kept.push(item); continue; }
    const fresh = byId.get(item.id);
    // Keep the person's own edits to time/repeat out of the way: the cabinet is
    // the source of truth, so a stale slot simply goes.
    if (fresh) { kept.push({ ...item, ...fresh }); byId.delete(item.id); }
  }

  return [...kept, ...byId.values()];
}

/** One slot costs one stack, however many bottles are in it. */
export function slotsAgainstCap(cabinet = [], ctx = {}) {
  return slotsFrom(cabinet, ctx).length;
}

// ── ticking ─────────────────────────────────────────────────────────────────

/** Product ids taken today, across every slot plus any logged-only items. */
export function takenToday(doneSupps = {}, dateKey) {
  const day = doneSupps?.[dateKey] || {};
  const out = new Set();
  for (const ids of Object.values(day)) for (const id of ids || []) out.add(id);
  return out;
}

/** Tick or untick a whole slot — every product in it. */
export function setSlotTaken(doneSupps = {}, dateKey, slot, taken) {
  const day = { ...(doneSupps[dateKey] || {}) };
  day[slot.id] = taken ? slot.products.map((p) => p.id) : [];
  return { ...doneSupps, [dateKey]: day };
}

/** Tick one product inside a slot. */
export function setProductTaken(doneSupps = {}, dateKey, slotIdValue, productId, taken) {
  const day = { ...(doneSupps[dateKey] || {}) };
  const current = new Set(day[slotIdValue] || []);
  if (taken) current.add(productId); else current.delete(productId);
  day[slotIdValue] = [...current];
  return { ...doneSupps, [dateKey]: day };
}

/**
 * Log an unscheduled product the person says they still take.
 *
 * Kept under its own key so it can never be confused with a slot being ticked:
 * this is "they told us", not "the app reminded them and they did it".
 */
export const STILL_TAKING_SLOT = 'still-taking';

export function logStillTaking(doneSupps = {}, dateKey, productId) {
  return setProductTaken(doneSupps, dateKey, STILL_TAKING_SLOT, productId, true);
}

// ── editing ─────────────────────────────────────────────────────────────────

let seq = 0;
export function newProductId() {
  seq += 1;
  return `sup${Date.now().toString(36)}${seq.toString(36)}`;
}

/** A blank product, with the fields the engine expects. */
export function emptyProduct() {
  return {
    id: newProductId(),
    name: '',
    servings: 1,
    time: '08:00',
    times: null,
    repeat: 'daily',
    withFood: false,
    perServing: [],
    supervised: false,
    supervisedFor: null,
    scheduled: true,
    stillTaking: false,
    source: 'manual',
  };
}

export function upsertProduct(cabinet = [], product) {
  const i = cabinet.findIndex((p) => p.id === product.id);
  if (i === -1) return [...cabinet, product];
  const next = cabinet.slice();
  next[i] = product;
  return next;
}

export function removeProduct(cabinet = [], id) {
  return cabinet.filter((p) => p.id !== id);
}

/**
 * Which products are pushing a nutrient over its safe maximum today?
 *
 * The cabinet list showed a product's condition and medicine flags but said
 * NOTHING about dose: "Niacin 500" sat in the morning slot looking ordinary
 * while contributing fifty times its 10 mg supplements-only maximum, and the
 * only place that was ever said was inside the edit sheet. A warning a person
 * has to go looking for is not a warning.
 *
 * Judged on the planned day, not on the product alone, because two ordinary
 * bottles can be over the line together while neither is over it by itself.
 * Doctor-supervised nutrients are reported, never judged, so they are excluded.
 *
 * Returns { ids: Set<productId>, byProduct: { id: [{ nutrientId, name, counted, limit, unit }] } }
 */
export function overMaxProducts(cabinet = [], ctx = {}) {
  const { data, profile = {} } = ctx;
  const out = { ids: new Set(), byProduct: {} };
  if (!data || !cabinet.length) return out;

  const totals = dayTotals({ cabinet, data, scope: 'planned' });
  const age = profile.age ?? null;

  for (const [id, bucket] of Object.entries(totals.byNutrient)) {
    const nutrient = data.nutrientsById.get(id);
    if (!nutrient) continue;
    const r = evaluate(nutrient, {
      totals: bucket,
      target: targetFor(nutrient, profile),
      age,
      supervised: totals.supervisedNutrients.has(id),
      thresholds: data.thresholds,
    });
    if (r.state !== 'over_max') continue;

    // Name every product that put something into this nutrient — a person
    // cannot act on "you are over" without knowing which bottle to put down.
    for (const p of cabinet) {
      if (p.scheduled === false) continue;
      const mine = productContributions(p, data).byNutrient[id];
      if (!mine || !(mine.meter > 0 || mine.limitTotal > 0)) continue;
      out.ids.add(p.id);
      (out.byProduct[p.id] ||= []).push({
        nutrientId: id,
        name: nutrient.name,
        counted: r.countedForLimit,
        limit: r.limit,
        unit: r.limitUnit,
      });
    }
  }
  return out;
}
