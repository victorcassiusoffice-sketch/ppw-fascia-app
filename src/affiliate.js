/* ──────────────────────────────────────────────────────────────
   PPWellness affiliate helpers
   Mirrors the v5 scheme used on ppwellness.co (affiliate.js).
   IMMUTABLE FACTS:
     - iHerb rcode: QCI0747
     - Amazon UK tag: ppwellness21-21
     - Amazon US tag: stub-only until US Associates approves
   All affiliate <a> elements must carry:
     target="_blank" rel="noopener nofollow sponsored"
   ────────────────────────────────────────────────────────────── */

export const IHERB_RCODE = 'QCI0747';
export const AMAZON_UK_TAG = 'ppwellness21-21';

function utm(topic, suffix = '') {
  const campaign = `app-protocol-${encodeURIComponent(topic || 'unknown')}${suffix}`;
  return `utm_source=ppwellness&utm_medium=affiliate&utm_campaign=${campaign}`;
}

/**
 * Build an iHerb deeplink for a single supplement.
 * Prefers SKU deeplink; falls back to keyword search.
 * @param {{name:string, brand?:string, iherb_sku?:string}} supplement
 * @param {string} topic - protocol topic, used in utm_campaign
 * @returns {string}
 */
export function iherbUrl(supplement, topic) {
  if (!supplement) return `https://iherb.com/?rcode=${IHERB_RCODE}&${utm(topic)}`;
  if (supplement.iherb_sku) {
    return `https://iherb.com/pr/_/${supplement.iherb_sku}?rcode=${IHERB_RCODE}&${utm(topic)}`;
  }
  const q = encodeURIComponent(`${supplement.brand || ''} ${supplement.name || ''}`.trim());
  return `https://iherb.com/search?kw=${q}&rcode=${IHERB_RCODE}&${utm(topic)}`;
}

/**
 * Build an Amazon UK search/deeplink for a single supplement.
 * No ASIN field exists in the protocol JSON yet, so always search.
 */
export function amazonUkUrl(supplement, topic) {
  if (!supplement) return `https://amazon.co.uk/?tag=${AMAZON_UK_TAG}&${utm(topic)}`;
  const q = encodeURIComponent(`${supplement.brand || ''} ${supplement.name || ''}`.trim());
  return `https://amazon.co.uk/s?k=${q}&tag=${AMAZON_UK_TAG}&${utm(topic)}`;
}

/**
 * Build a single iHerb URL that adds every SKU-known supplement to the cart.
 * Returns null if fewer than 2 supplements have an iherb_sku — bulk-add
 * is pointless for one item (the per-supplement button already exists).
 *
 * @param {Array<{iherb_sku?:string}>} supplements
 * @param {string} topic
 * @returns {string|null}
 */
export function iherbCartAllUrl(supplements, topic) {
  if (!Array.isArray(supplements)) return null;
  const skus = supplements.filter(s => s && s.iherb_sku).map(s => s.iherb_sku);
  if (skus.length < 2) return null;
  const cartParams = skus.map((sku, i) => `p${i + 1}=${encodeURIComponent(sku)}&q${i + 1}=1`).join('&');
  return `https://iherb.com/cart/add?${cartParams}&rcode=${IHERB_RCODE}&${utm(topic, '-bulk')}`;
}
