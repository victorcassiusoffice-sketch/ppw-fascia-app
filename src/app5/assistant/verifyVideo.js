// AI-suggested YouTube, verified before anyone sees it.
//
// The prompt used to ban links outright, for a reason recorded in aiPrompt.js:
// models fabricate 11-character video ids that LOOK completely real. A fabricated
// id is indistinguishable from a good one by shape alone, so the only safe way to
// let an AI suggest a video is to go and ask YouTube.
//
// YouTube's oEmbed endpoint answers exactly that, from the browser, with no
// backend, no API key and no cost. Probed live on 2026-09-19 with an
// app.ppwellness.co Origin:
//   real id          -> 200 + the real title and channel name
//   fabricated id    -> 400
//   well-formed dead -> 404
//   Access-Control-Allow-Origin came back reflected, so plain fetch() works.
//
// What we do with the answer matters as much as asking it. The title and channel
// come from YOUTUBE, never from the model. A hallucinated id that happens to
// resolve to a REAL video is the nastiest failure mode — the id checks out, but
// the model called it "Gentle Lower Back Stretch" and it is something else
// entirely. Taking the title from the source makes that impossible.
//
// And an unverified suggestion still has to leave the user with something that
// works, so it degrades to a YouTube search rather than a dead embed.

export const YT_ID = /^[A-Za-z0-9_-]{11}$/;

export const watchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
// Deliberately NO autoplay. starterDeck bakes autoplay=1 into videos the USER
// chose; a video an AI suggested must never start a stranger's audio by itself,
// possibly in an office or a waiting room.
export const embedUrl = (id) => `https://www.youtube.com/embed/${id}?playsinline=1&rel=0`;
export const thumbUrl = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const searchUrl = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

/**
 * Ask YouTube whether this id is a real video.
 * Returns { state: 'ok' | 'no' | 'unk' }.
 *   ok  — it exists; title and author are YouTube's own.
 *   no  — YouTube says it is not a video (fabricated, deleted, or private).
 *   unk — we could not reach YouTube. NOT proof the video is bad, so it is never
 *         treated as a failure of the video, only of the check.
 */
export async function verifyId(id, fetchImpl) {
  if (!YT_ID.test(String(id || ''))) return { state: 'no' };
  const f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
  if (!f) return { state: 'unk' };
  try {
    const r = await f(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl(id))}&format=json`
    );
    if (r && r.status === 200) {
      const d = await r.json();
      return {
        state: 'ok',
        id,
        title: String((d && d.title) || '').slice(0, 120),
        author: String((d && d.author_name) || '').slice(0, 80),
      };
    }
    // 400 = not a video at all. 401/403/404 = gone, private, or not embeddable.
    if (r && r.status >= 400 && r.status < 500) return { state: 'no' };
    return { state: 'unk' };
  } catch {
    // Offline, a corporate proxy, a region block. The check failed, not the video.
    return { state: 'unk' };
  }
}

/**
 * Verify a list of ids with at most `limit` requests in flight. A null entry
 * means "this item never claimed a video" and costs no request.
 */
export async function verifyAll(ids, limit = 4, fetchImpl) {
  const list = Array.isArray(ids) ? ids : [];
  const out = new Array(list.length);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const k = next++;
      out[k] = list[k] ? await verifyId(list[k], fetchImpl) : { state: 'none' };
    }
  };
  const lanes = Math.max(1, Math.min(limit, list.length || 1));
  await Promise.all(Array.from({ length: lanes }, worker));
  return out;
}

/**
 * Turn a verdict into the media fields an item carries.
 *   ok       -> a real, playable video, titled by YouTube.
 *   anything -> a YouTube search, which always resolves, instead of a dead embed.
 *   no claim -> nothing; it stays an ordinary stack.
 */
export function mediaFor(verdict, q, fallbackTitle) {
  if (verdict && verdict.state === 'ok') {
    return {
      title: verdict.title || fallbackTitle,
      meta: verdict.author ? `YouTube · ${verdict.author}` : 'YouTube',
      thumb: 'yt',
      url: watchUrl(verdict.id),
      embed: embedUrl(verdict.id),
      thumbUrl: thumbUrl(verdict.id),
    };
  }
  if (q) return { thumb: 'yt', url: searchUrl(q), meta: 'Find it on YouTube' };
  return {};
}
