// VideoPicker — "Add a video or link" for one stack (Vic, 2026-10-17).
//
// "Find appropriate videos on YouTube which associate with the stack as a
// recommended button where they can click … and then it can add it."
//
// Three sources, best first, and the user always chooses:
//   1. Suggested — what the user's own AI suggested for this stack in an
//      organise or plan reply, each one checked against YouTube first
//      (verifyVideo.js); the title and channel shown are YouTube's own.
//   2. PPW picks — a short list of videos checked by us (videoCatalog.js),
//      matched to the stack's words. Nothing is shown for a stack the list knows
//      nothing about: a wrong pick is worse than "search for it".
//   3. Find one yourself — a YouTube search for the stack in a new tab, and a
//      box to paste the link back. A YouTube link is checked and titled by
//      YouTube; a Spotify or any other https link is kept as a link.
//
// Nothing here plays anything by itself: an added video lands with AUTO off,
// and the embed carries no autoplay (verifyVideo.embedUrl).

import React from 'react';
import { useStore5, closeVideoPicker, attachMedia, detachMedia, parseYouTubeId, safeUrl } from '../store5.js';
import { verifyId, watchUrl, embedUrl, thumbUrl, searchUrl } from '../assistant/verifyVideo.js';
import { picksFor, searchWordsFor } from '../assistant/videoCatalog.js';
import { readText } from '../assistant/clipboard.js';

const CARD = { background: 'var(--surface)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' };
const LABEL = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)' };
const smallThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

/** The media fields a checked YouTube video puts on a stack. */
export function ytMedia(id, title, author) {
  return { url: watchUrl(id), embed: embedUrl(id), thumb: 'yt', thumbUrl: thumbUrl(id), title: title || 'YouTube video', author: author || '' };
}

function VideoRow({ v, onAdd, busy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, ...CARD }}>
      <a href={watchUrl(v.yt)} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${v.title} on YouTube`}
        style={{ width: 96, height: 54, flex: 'none', borderRadius: 12, background: `#000 url(${smallThumb(v.yt)}) center/cover`, border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>
      </a>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden', overflowWrap: 'anywhere' }}>{v.title}</div>
        <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[v.author, v.mins ? `${v.mins} min` : null, 'YouTube'].filter(Boolean).join(' · ')}</div>
      </div>
      <button onClick={onAdd} disabled={busy} style={{ flex: 'none', minHeight: 44, padding: '0 14px', borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', fontSize: 13, fontWeight: 700 }}>Add</button>
    </div>
  );
}

export default function VideoPicker() {
  const S = useStore5();
  const it = S.videoFor ? S.deckItems.find((x) => x.id === S.videoFor) : null;
  // Every hook above the early return (see EditStackSheet's P0 note).
  const [link, setLink] = React.useState('');
  const [check, setCheck] = React.useState(null);   // null | { state, … } for the pasted link
  const [done, setDone] = React.useState(null);     // the title just added, for the confirmation
  const run = React.useRef(0);
  React.useEffect(() => { setLink(''); setCheck(null); setDone(null); }, [S.videoFor]);
  React.useEffect(() => {
    if (!S.videoFor) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') closeVideoPicker(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [S.videoFor]);
  if (!it) return null;

  const recs = Array.isArray(it.recs) ? it.recs.filter((r) => r && r.yt) : [];
  const recIds = new Set(recs.map((r) => r.yt));
  const picks = picksFor(it, 3).filter((p) => !recIds.has(p.yt));
  const words = searchWordsFor(it);
  const hasMedia = !!(it.url || it.embed);

  const add = (media) => {
    const r = attachMedia(it.id, media);
    if (r.ok) { setDone(media.title || 'Link'); setTimeout(closeVideoPicker, 900); }
  };

  // The pasted link: a YouTube link is asked of YouTube, anything else https is
  // a plain link, anything else is refused in words.
  const inspect = async (raw) => {
    const text = String(raw || '').trim();
    const runId = ++run.current;
    if (!text) { setCheck(null); return; }
    const url = safeUrl(text);
    if (!url) { setCheck({ state: 'bad' }); return; }
    const id = parseYouTubeId(url);
    if (!id) { setCheck({ state: 'link', url }); return; }
    setCheck({ state: 'checking' });
    const v = await verifyId(id);
    if (run.current !== runId) return;
    if (v.state === 'ok') setCheck({ state: 'yt', id, title: v.title, author: v.author });
    else if (v.state === 'no') setCheck({ state: 'gone' });
    else setCheck({ state: 'yt', id, title: '', author: '', unchecked: true });
  };
  const pasteIn = async () => {
    const r = await readText();
    if (r.ok) { setLink(r.text); inspect(r.text); }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 46 }}>
      <div onClick={closeVideoPicker} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.4)', animation: 'ppwFade .3s ease both' }} />
      <div role="dialog" aria-label="Add a video or link" style={{ position: 'absolute', left: 12, right: 12, bottom: 'calc(20px + env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100% - 60px)', overflowY: 'auto', borderRadius: 30, padding: '20px 18px 18px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', transformOrigin: '50% 105%', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Add a video or link</div>
            <div style={{ marginTop: 3, fontSize: 18, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)', overflowWrap: 'anywhere' }}>{it.title}</div>
          </div>
          <button onClick={closeVideoPicker} aria-label="Close" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {done && (
          <div role="status" style={{ marginTop: 14, padding: '12px 14px', borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 600 }}>
            Added to {it.title}. Tap the stack to watch it.
          </div>
        )}

        {hasMedia && !done && (
          <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 16, ...CARD, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--dim)' }}>
              Now: <strong style={{ color: 'var(--ink)' }}>{it.mediaTitle || (() => { try { return new URL(it.url).hostname.replace(/^www\./, ''); } catch { return 'a link'; } })()}</strong>
              {' '}— adding another replaces it.
            </div>
            <button onClick={() => detachMedia(it.id)} style={{ flex: 'none', minHeight: 40, padding: '0 12px', borderRadius: 12, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600 }}>Remove</button>
          </div>
        )}

        {recs.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={LABEL}>Suggested by your AI</div>
            <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--dim)' }}>Checked with YouTube. The titles are YouTube's own.</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recs.map((v) => <VideoRow key={v.yt} v={v} busy={!!done} onAdd={() => add(ytMedia(v.yt, v.title, v.author))} />)}
            </div>
          </div>
        )}

        {picks.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={LABEL}>PPW picks</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {picks.map((v) => <VideoRow key={v.yt} v={v} busy={!!done} onAdd={() => add(ytMedia(v.yt, v.title, v.author))} />)}
            </div>
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <div style={LABEL}>Find one yourself</div>
          {words && (
            <a href={searchUrl(words)} target="_blank" rel="noopener noreferrer" style={{ marginTop: 10, minHeight: 46, padding: '0 16px', borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13.5, fontWeight: 600, textDecoration: 'none', textAlign: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
              Search YouTube for “{words.length > 34 ? words.slice(0, 33) + '…' : words}” ↗
            </a>
          )}
          <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>
            Found one you like? Copy its link (Share → Copy link), come back and paste it here. A Spotify or website link works too.
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input value={link} onChange={(e) => { setLink(e.target.value); inspect(e.target.value); }} placeholder="Paste a link…" aria-label="Paste a video or link"
              style={{ flex: 1, minWidth: 0, height: 46, padding: '0 14px', borderRadius: 14, border: `1px solid ${check && (check.state === 'bad' || check.state === 'gone') ? 'var(--accent)' : 'var(--hairline)'}`, background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 }} />
            <button onClick={pasteIn} style={{ flex: 'none', minHeight: 46, padding: '0 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 13, fontWeight: 600 }}>Paste</button>
          </div>
          {check && check.state === 'checking' && <div role="status" style={{ marginTop: 8, fontSize: 12.5, color: 'var(--dim)' }}>Checking with YouTube…</div>}
          {check && check.state === 'bad' && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>That is not a web link. Copy the link itself and paste it again.</div>}
          {check && check.state === 'gone' && <div role="alert" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>YouTube says that video is not available. Try another one.</div>}
          {check && check.state === 'yt' && (
            <div style={{ marginTop: 10 }}>
              <VideoRow v={{ yt: check.id, title: check.title || 'YouTube video', author: check.unchecked ? 'Not checked — no connection' : check.author }} busy={!!done}
                onAdd={() => add(ytMedia(check.id, check.title, check.author))} />
            </div>
          )}
          {check && check.state === 'link' && (
            <button onClick={() => add({ url: check.url, thumb: /spotify\.com/.test(check.url) ? 'sp' : 'au', title: (() => { try { return new URL(check.url).hostname.replace(/^www\./, ''); } catch { return 'Link'; } })() })} disabled={!!done}
              style={{ marginTop: 10, width: '100%', minHeight: 46, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', fontSize: 13.5, fontWeight: 700 }}>
              Add this link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
