// parseSpec.js — reading a shop listing's free-text spec into real lines.
//
// The shop products describe themselves in marketing prose: "5000 IU D3 +
// 90-100 mcg K2 MK-7", "about 2,000 mg EPA + DHA", "15-30 mg". That is enough
// to PRE-FILL an add form so nobody retypes their whole bottle, and nowhere near
// enough to trust as a dose.
//
// So everything this produces is marked `fromSpec` and, where the listing gave a
// range, `needsCheck`. A range resolves to the HIGH end, because the high end is
// the cautious read for a safe maximum — if the bottle turns out to be the lower
// one, the person corrects it down and the warning goes away. The reverse
// mistake would hide a breach.
//
// This never writes to the cabinet by itself. It fills a form the person then
// confirms against the bottle in their hand.

import { normaliseUnit } from './units.js';
import { lookupName, normaliseName } from './data.js';

/** "2,000" → 2000. Labels write thousands separators; Number() does not. */
function num(raw) {
  if (raw == null) return null;
  const n = Number(String(raw).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

// A chunk looks like: [amount or range] [unit] [name...]  — or the reverse,
// "Vitamin D3 5000 IU". Both orders appear on real listings.
const AMOUNT_FIRST = /^\s*(?:about\s+|approx\.?\s+|~)?([\d.,]+)\s*(?:[-–—]\s*([\d.,]+))?\s*([a-zµμ.]+(?:\s+(?:dfe|rae|cfu|ne))?)\s+(.+)$/i;
const NAME_FIRST = /^\s*(.+?)\s+(?:about\s+|approx\.?\s+|~)?([\d.,]+)\s*(?:[-–—]\s*([\d.,]+))?\s*([a-zµμ.]+(?:\s+(?:dfe|rae|cfu|ne))?)\s*$/i;

/** Split a spec into the chunks that each describe one ingredient. */
export function splitSpec(spec) {
  return String(spec || '')
    .split(/\s*(?:\+|,|;|\band\b|\/)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse one chunk into a line.
 * Returns null when there is no amount to be found — the caller keeps the text
 * so the person can fill it in rather than losing the ingredient.
 */
export function parseChunk(chunk, data) {
  const text = String(chunk || '').trim();
  if (!text) return null;

  let m = AMOUNT_FIRST.exec(text);
  let lo, hi, unitRaw, nameRaw;
  if (m) {
    [, lo, hi, unitRaw, nameRaw] = m;
  } else {
    m = NAME_FIRST.exec(text);
    if (!m) return { name: text, amount: null, unit: null, fromSpec: true, needsCheck: true, unmatched: true };
    [, nameRaw, lo, hi, unitRaw] = m;
  }

  const unit = normaliseUnit(unitRaw);
  const low = num(lo);
  const high = num(hi);
  // A range resolves HIGH: the cautious read against a safe maximum.
  const amount = high != null ? Math.max(low, high) : low;

  const hit = lookupName(data, nameRaw);
  return {
    id: hit?.id || 'other',
    kind: hit?.kind || 'other',
    name: String(nameRaw).trim(),
    amount,
    unit: unit || String(unitRaw || '').trim() || null,
    unitRecognised: !!unit,
    range: high != null ? [low, high] : null,
    fromSpec: true,
    // Anything the person must look at before trusting: a range, an unknown
    // unit, or an ingredient we could not name.
    needsCheck: high != null || !unit || !hit,
  };
}

/**
 * Parse a whole `brand_spec` into draft lines.
 *
 * Returns { lines, needsCheck } — needsCheck true if ANY line needs a human
 * eye, which is what the add sheet uses to decide whether to say "check this
 * against your bottle" before saving.
 */
export function parseBrandSpec(spec, data) {
  const lines = splitSpec(spec)
    .map((c) => parseChunk(c, data))
    .filter(Boolean);
  return { lines, needsCheck: lines.some((l) => l.needsCheck) };
}

/**
 * Build a draft product from a shop listing.
 *
 * `source: 'shop'` is kept so the cabinet can say where it came from, and so a
 * later catalogue change can be reconciled against what people actually saved.
 */
export function productFromShopItem(item, data, { id, time = '08:00', repeat = 'daily' } = {}) {
  const { lines, needsCheck } = parseBrandSpec(item?.brand_spec, data);
  return {
    id,
    name: [item?.brand, item?.name].filter(Boolean).join(' '),
    servings: 1,
    time,
    repeat,
    withFood: false,
    perServing: lines.map((l) => ({
      id: l.id, name: l.name, amount: l.amount, unit: l.unit, form: null,
      fromSpec: true, needsCheck: l.needsCheck,
    })),
    supervised: false,
    supervisedFor: null,
    scheduled: true,
    source: 'shop',
    shopId: item?.id,
    specText: item?.brand_spec || null,
    needsCheck,
  };
}

/** A readable summary of a parsed spec, for the confirm step. */
export function describeLines(lines = []) {
  return lines
    .map((l) => [l.amount != null ? `${l.amount}${l.unit ? ` ${l.unit}` : ''}` : 'amount?', l.name].filter(Boolean).join(' '))
    .join(' · ');
}

export { normaliseName };
