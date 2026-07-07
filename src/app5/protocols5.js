// protocols5 — PPW Protocol PDFs, loaded from a GitHub-hosted manifest.
//
// A sibling pipeline is standing up a repo of Protocol PDFs indexed by a
// manifest.json with entries: { id, title, filename, url, tags, version }.
// ── PLUG-IN POINT ─────────────────────────────────────────────────────────
// When Dispatch relays the repo, set PROTOCOLS_MANIFEST_URL to the RAW
// manifest URL (e.g. https://raw.githubusercontent.com/<owner>/<repo>/main/manifest.json).
// Until then it is null and the Protocols tab shows its "on the way" state.
// ──────────────────────────────────────────────────────────────────────────
export const PROTOCOLS_MANIFEST_URL = null;

const CACHE_KEY = 'ppw5.protocolsManifest';

// normalise + validate one manifest entry to the agreed schema
function toProtocol(e) {
  if (!e || typeof e !== 'object') return null;
  const id = String(e.id || '').trim();
  const title = String(e.title || '').trim();
  const url = String(e.url || '').trim();
  if (!id || !title || !/^https:\/\//.test(url)) return null;
  return {
    id, title, url,
    filename: String(e.filename || '').trim() || (title.replace(/[^a-z0-9]+/gi, '-') + '.pdf'),
    tags: Array.isArray(e.tags) ? e.tags.map(String).slice(0, 8) : [],
    version: e.version !== undefined ? String(e.version) : '1',
  };
}

// fetch the manifest (network-first, localStorage fallback for offline).
// Returns { status: 'unconfigured' | 'ready' | 'error', list }.
export async function fetchProtocols() {
  if (!PROTOCOLS_MANIFEST_URL) return { status: 'unconfigured', list: [] };
  try {
    const res = await fetch(PROTOCOLS_MANIFEST_URL + (PROTOCOLS_MANIFEST_URL.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    const raw = Array.isArray(data) ? data : Array.isArray(data.protocols) ? data.protocols : [];
    const list = raw.map(toProtocol).filter(Boolean);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch {}
    return { status: 'ready', list };
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (Array.isArray(cached) && cached.length) return { status: 'ready', list: cached };
    } catch {}
    return { status: 'error', list: [] };
  }
}

// a protocol as a stack-item snapshot (viewer shows the PDF; Add-to-Stack schedules it)
export function protocolToItem(p) {
  return { title: p.title, meta: 'Protocol · v' + p.version, thumb: 'doc', kind: 'pdf', url: p.url };
}
