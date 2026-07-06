// MediaViewer — New Design in-app media viewer (focused port).
//
// Tapping a media/video stack or library item opens this. Shows the YouTube
// embed inline (for items with an `embed` url), else a poster with the source
// thumbnail, plus title/meta, an "Open ↗" external link and Cancel. Deferred:
// the Video/Audio/Text format switcher + AI text-version generation (that used
// Claude Design's window.claude API, unavailable outside it).

import React from 'react';
import { THUMBS } from '../theme5.js';
import { useStore5, closePlayer } from '../store5.js';

export default function MediaViewer() {
  const S = useStore5();
  const it = S.playerItem;
  if (!it) return null;

  const poster = it.thumbUrl ? `url(${it.thumbUrl})` : (THUMBS[it.thumb] || THUMBS.au);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={closePlayer} style={{ position: 'absolute', inset: 0, background: 'rgba(20,26,38,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', width: '100%', borderRadius: 28, padding: 18, background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.3,.4,1) both' }}>
        {it.embed ? (
          <iframe src={it.embed} title="Media player" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen style={{ position: 'relative', width: '100%', aspectRatio: '16/9', border: 'none', borderRadius: 18, background: '#000', display: 'block' }} />
        ) : (
          <div aria-hidden="true" style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 18, background: poster, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.9)' }}>
            {!it.thumbUrl && <svg width="42" height="42" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>}
          </div>
        )}
        <div style={{ position: 'relative', marginTop: 14, fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{it.title}</div>
        <div style={{ position: 'relative', marginTop: 3, fontSize: 13, color: 'var(--dim)' }}>{it.meta}</div>
        <div style={{ position: 'relative', marginTop: 16, display: 'flex', gap: 10 }}>
          {it.url && (
            <a href={it.url} target="_blank" rel="noopener noreferrer" style={{ height: 48, padding: '0 16px', borderRadius: 15, border: '1px solid var(--rim)', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>Open ↗</a>
          )}
          <button onClick={closePlayer} style={{ flex: 1, height: 48, padding: '0 16px', borderRadius: 15, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
