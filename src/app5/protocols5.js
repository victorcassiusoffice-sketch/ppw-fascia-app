// protocols5 — PPW Protocol PDFs surfaced in the app.
//
// The PDFs live in the PRIVATE repo `victorcassiusoffice-sketch/ppw-protocols`.
// They are baked into THIS app at BUILD time by tools/sync-protocols.mjs, which
// ships ONLY the cleared subset (app_eligible && approved; review/draft/the
// fabricated testosterone sample are excluded) into public/protocols/. NO PAT
// and NO private-repo access ever ship in the client — at runtime the app reads
// its OWN same-origin bundled manifest below.
//
// Today this is EMPTY: both app_eligible protocols are status=review (Vic's
// GATE-2 pending). The moment Vic approves one (manifest → app_eligible:true +
// status:free), the next build bakes it in and it appears here automatically.

const MANIFEST_PATH = 'protocols/app-manifest.json'; // relative to import.meta.env.BASE_URL

// fetch the app's bundled protocol manifest (same-origin, public, no auth).
// → { status: 'ready' | 'error', list }
export async function fetchProtocols() {
  const base = import.meta.env.BASE_URL || '/';
  try {
    const res = await fetch(base + MANIFEST_PATH + '?cb=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    const raw = Array.isArray(data.protocols) ? data.protocols : [];
    const list = raw.map((p) => ({
      id: String(p.id || ''),
      slug: String(p.slug || p.id || ''),
      title: String(p.title || ''),
      category: String(p.category || ''),
      tags: Array.isArray(p.tags) ? p.tags : [],
      version: String(p.version || '1'),
      url: base + String(p.url || ''), // resolve bundled PDF to an absolute app URL
    })).filter((p) => p.id && p.title && p.url);
    return { status: 'ready', list };
  } catch {
    return { status: 'error', list: [] };
  }
}

// a protocol as a stack-item snapshot (Add-to-Stack schedules it; tap opens PDF)
export function protocolToItem(p) {
  return { title: p.title, meta: 'Protocol · ' + p.version, thumb: 'doc', kind: 'pdf', url: p.url };
}
