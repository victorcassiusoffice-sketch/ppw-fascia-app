// suppsAffiliates — read model over the build-time-synced supps manifest.
//
// The manifest is baked in from the PRIVATE ppw-affiliates repo by
// tools/sync-supps-affiliates.mjs (no PAT in client). The app only READS it.
//
// Two facts drive everything and must not be contradicted in UI/copy:
//   1. iHerb has NO multi-add cart URL — buy = open the first item (sets the
//      7-day affiliate cookie), then the user adds the rest in-session.
//   2. Commission is gated on program.iherb.affiliate_live (currently false):
//      until it's true the UI must NOT claim a cash commission.

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
