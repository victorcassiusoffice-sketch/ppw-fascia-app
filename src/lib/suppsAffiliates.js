// suppsAffiliates — read model over the build-time-synced supps manifest.
//
// The manifest is baked in from the PRIVATE ppw-affiliates repo by
// tools/sync-supps-affiliates.mjs (no PAT in client). The app only READS it.
//
// Two facts drive everything and must not be contradicted in UI/copy:
//   1. iHerb has NO multi-add cart URL — buy = open the first item (sets the
//      7-day affiliate cookie), then the user adds the rest in-session.
//   2. Commission is gated on program.iherb.affiliate_live (currently false):
//      until it's true the UI must NOT claim a cash commission. It may only say
//      "PPW may earn a small commission if you buy." — and only beside a link
//      that really carries a referral code (linkCarriesReferral, below).

import manifest from '../config/supps-affiliates.json';

const SUPPS = Array.isArray(manifest.supplements) ? manifest.supplements : [];
const BY_PROTOCOL = manifest.by_protocol || {};

export function affiliateLive() {
  return manifest.program?.iherb?.affiliate_live === true;
}

// iHerb has no supported multi-add cart deep link. Exposed so UI never assumes one.
export function multiAddSupported() {
  return manifest.program?.iherb_multi_add_cart_supported === true; // false today
}

// the pre-built affiliate deeplink (rcode/param + utm already baked by the pipeline)
export function buyUrl(supp) {
  return supp?.iherb_affiliate_url || '';
}

// all supplements, or a filtered view. Out-of-stock kept but flagged (UI greys them).
export function allSupps() {
  return SUPPS.slice();
}

// supplements grouped by their protocol id (for the Library Supps list).
// [{ protocolId, supps: [...] }]
export function suppsGroupedByProtocol() {
  return Object.keys(BY_PROTOCOL).map((protocolId) => ({
    protocolId,
    supps: (BY_PROTOCOL[protocolId] || []).map((id) => SUPPS.find((s) => s.id === id)).filter(Boolean),
  })).filter((g) => g.supps.length);
}

// per-protocol join (spec API). Falls back to a protocol JSON's own supplement
// list (name-matched into the manifest) when the protocol isn't in by_protocol,
// so protocols not yet in the affiliate manifest still render.
export function getSuppsForProtocol(protocolId, protocolJson) {
  const ids = BY_PROTOCOL[protocolId];
  if (Array.isArray(ids) && ids.length) {
    return ids.map((id) => SUPPS.find((s) => s.id === id)).filter(Boolean);
  }
  const own = protocolJson?.sections?.supplements || protocolJson?.supplements;
  if (Array.isArray(own)) {
    return own.map((row) => {
      const name = (row.name || row.title || '').toLowerCase();
      const sku = String(row.iherb_sku || row.iherb_product_id || '');
      return SUPPS.find((s) => s.name.toLowerCase() === name || (sku && String(s.iherb_product_id) === sku)) || null;
    }).filter(Boolean);
  }
  return [];
}

// ── The warnings that travel with every supplement (27 Oct 2026) ──────────
// Victor, 27 Oct 2026 (V-SUPPS-DISCLAIMERS-1027): "We maximise on disclaimers
// for this." The supplements stay on show; every place that shows one says
// plainly that PPW has not checked it yet, and every link to a shop says it
// leaves the app. All of it is read from the manifest, so clearing a supplement
// in ppw-affiliates takes its label off with no change to this code.

// The one evidence value the manifest generator treats as cleared
// (ppw-affiliates scripts/generate_affiliates.py: publishable needs
// evidence_status == 'approved'). Anything else is held.
const EVIDENCE_CLEARED = 'approved';

/**
 * Has PPW NOT yet cleared this supplement? True means it wears "Not checked yet".
 * Fails closed: a missing row, a missing flag or an unknown status all count as
 * not checked. Both flags must clear, because the generator only ever sets
 * `publishable` after the evidence is approved.
 */
export function suppUnchecked(s) {
  if (!s) return true;
  return s.publishable !== true || s.evidence_status !== EVIDENCE_CLEARED;
}

/** The manifest row with this id, or null. */
export function suppById(id) {
  if (!id) return null;
  return SUPPS.find((s) => s.id === id) || null;
}

/**
 * The manifest supplement a stack item came from, or null. A stack added from
 * the Supps shelf keeps `suppId`; a shared routine keeps only the url, so an
 * exact match on PPW's own link counts too. A link the user pasted themselves is
 * never PPW's, so it never matches.
 */
export function suppForItem(it) {
  if (!it) return null;
  const byId = suppById(it.suppId);
  if (byId) return byId;
  const url = typeof it.url === 'string' ? it.url.trim() : '';
  if (!url) return null;
  return SUPPS.find((s) => s.iherb_affiliate_url && s.iherb_affiliate_url === url) || null;
}

// Query keys that carry an affiliate or referral code: iHerb rewards (rcode) and
// partner (pcode), Amazon Associates (tag), Awin (awc, clickref), Impact
// (irclickid, irgwc), and the generic affiliate ids. `ref` is left out on
// purpose: shops use it for their own page tracking. utm_* is analytics, not a
// code, and earns nothing.
const REFERRAL_KEYS = ['rcode', 'pcode', 'tag', 'awc', 'clickref', 'irclickid', 'irgwc', 'aff', 'affid', 'aff_id', 'affiliate', 'affiliate_id'];

/** Does this link carry an affiliate or referral code? */
export function linkCarriesReferral(url) {
  let u;
  try { u = new URL(String(url || '')); } catch { return false; }
  if (/(^|\.)awin1\.com$/i.test(u.hostname)) return true;
  const keys = new Set(REFERRAL_KEYS);
  // the real cash-affiliate parameter, once the iHerb signup names it
  const own = manifest.program?.iherb?.affiliate_param;
  if (typeof own === 'string' && own.trim() && !/TBD/i.test(own)) keys.add(own.trim().toLowerCase());
  for (const [k, v] of u.searchParams) if (keys.has(k.toLowerCase()) && String(v).trim()) return true;
  return false;
}

/** Does any of these links carry an affiliate or referral code? */
export function linksCarryReferral(urls) {
  return (urls || []).some((u) => linkCarriesReferral(u));
}

/** The shop a link opens, by name, for the leave-the-app line. */
export function shopName(url) {
  let host = '';
  try { host = new URL(String(url || '')).hostname.toLowerCase(); } catch { return 'another website'; }
  if (/(^|\.)iherb\.com$/.test(host)) return 'iHerb';
  if (/(^|\.)amazon\.[a-z.]+$/.test(host)) return 'Amazon';
  return host.replace(/^www\./, '') || 'another website';
}

// a supplement as a stack-item snapshot (Add to Stack reuses the calendar picker)
export function suppToStackItem(s, protocolId) {
  return {
    title: s.name,
    meta: 'Supplement' + (s.brand ? ' · ' + s.brand : ''),
    kind: 'supp',
    url: buyUrl(s),
    suppId: s.id,
    protocolId: protocolId || (s.protocol_ids && s.protocol_ids[0]) || '',
  };
}
