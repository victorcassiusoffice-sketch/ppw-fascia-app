// UserStackBody (extracted verbatim from App.jsx, 2026-06-11 liquid-glass
// redesign — zero logic change).
import React, { useState, useEffect, useCallback } from 'react';
import { getMediaUrl } from '../../lib/mediaStore.js';
import DurationField from '../DurationField.jsx';

/* ═══════════════════════════════════════════
   Phase 2 (2026-05-23) — UserStackBody
   Renders an inline player for a user-created stack inside the expanded
   card body. Calls onEnded when media playback completes so the parent
   can auto-advance to the next stack.
   ═══════════════════════════════════════════ */
function UserStackBody({ stack, onEnded, onPatch }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [editFields, setEditFields] = useState(false);

  useEffect(() => {
    let revoked = false;
    let url = null;
    (async () => {
      if (stack.mediaStoreId) {
        url = await getMediaUrl(stack.mediaStoreId);
        if (!revoked) setBlobUrl(url);
      }
    })();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [stack.mediaStoreId]);

  const startSec = Number(stack.startAtSec) || 0;
  const endSec = stack.endAtSec != null ? Number(stack.endAtSec) : null;

  // Auto-honour endAt for HTML5 media — pause + onEnded when timeUpdate hits endSec.
  const handleTimeUpdate = useCallback((e) => {
    if (endSec == null) return;
    const t = e.target.currentTime;
    if (t >= endSec) {
      try { e.target.pause(); } catch (_) {}
      if (onEnded) onEnded();
    }
  }, [endSec, onEnded]);

  const handleLoaded = useCallback((e) => {
    if (startSec > 0) {
      try { e.target.currentTime = startSec; } catch (_) {}
    }
  }, [startSec]);

  let player = null;
  if (stack.type === 'link') {
    if (stack.youtubeId) {
      const src = `https://www.youtube-nocookie.com/embed/${stack.youtubeId}?rel=0&modestbranding=1&playsinline=1&start=${startSec}${endSec != null ? `&end=${endSec}` : ''}`;
      player = (
        <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe src={src} title={stack.title || 'Stack video'} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen className="w-full h-full" loading="lazy" />
        </div>
      );
    } else if (stack.url) {
      // Direct media URL or general embed.
      const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(stack.url);
      const isAudio = /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(stack.url);
      if (isVideo) {
        player = <video src={stack.url} controls playsInline className="w-full rounded-xl bg-black" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
      } else if (isAudio) {
        player = <audio src={stack.url} controls className="w-full" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
      } else {
        player = <a href={stack.url} target="_blank" rel="noopener" className="text-accent underline underline-offset-4 break-all">{stack.url}</a>;
      }
    }
  } else if (stack.type === 'image' && blobUrl) {
    player = <img src={blobUrl} alt={stack.title || ''} className="w-full rounded-xl" />;
  } else if (stack.type === 'video' && blobUrl) {
    player = <video src={blobUrl} controls playsInline className="w-full rounded-xl bg-black" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
  } else if (stack.type === 'audio' && blobUrl) {
    player = <audio src={blobUrl} controls className="w-full" onLoadedMetadata={handleLoaded} onTimeUpdate={handleTimeUpdate} onEnded={onEnded} />;
  } else if (stack.type === 'text') {
    player = (
      <div className="card p-4 bg-cream/5">
        <p className="text-cream whitespace-pre-wrap">{stack.text}</p>
        <div className="text-muted text-[10px] mt-2 uppercase tracking-widest">Stays until next stack opens</div>
      </div>
    );
  } else if ((stack.type === 'image' || stack.type === 'video' || stack.type === 'audio') && !blobUrl) {
    player = <div className="text-muted text-sm">Loading media…</div>;
  }

  return (
    <div className="space-y-3">
      {player}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setEditFields(v => !v)}
          className="text-xs text-muted hover:text-accent underline underline-offset-4"
        >
          {editFields ? 'Hide fields' : 'Edit stack fields'}
        </button>
        {stack.durationSec ? <span className="text-[10px] text-muted">{stack.durationSec}s</span> : null}
      </div>
      {editFields && (
        <div className="card p-3 bg-cream/[0.02] space-y-2">
          <div className="grid grid-cols-2 gap-2 items-center text-xs">
            <span className="text-muted uppercase tracking-widest">Duration</span>
            {/* Vic fix 2026-06-14 — mm:ss timer (was seconds-only); still stored as durationSec. */}
            <DurationField
              valueSec={stack.durationSec || 0}
              onChangeSec={(sec) => onPatch({ durationSec: sec })}
              idPrefix="editstack-dur"
              inputClassName="bg-cream/5 border border-cream/15 rounded px-2 py-1 text-cream focus:outline-none focus:border-accent"
            />
          </div>
          {(stack.type === 'link' || stack.type === 'video' || stack.type === 'audio') && (
            <>
              <label className="grid grid-cols-2 gap-2 items-center text-xs">
                <span className="text-muted uppercase tracking-widest">Start at (sec)</span>
                <input type="number" min="0" value={stack.startAtSec || 0} onChange={(e) => onPatch({ startAtSec: Number(e.target.value) || 0 })} className="bg-cream/5 border border-cream/15 rounded px-2 py-1 text-cream focus:outline-none focus:border-accent" />
              </label>
              <label className="grid grid-cols-2 gap-2 items-center text-xs">
                <span className="text-muted uppercase tracking-widest">End at (sec)</span>
                <input type="number" min="0" value={stack.endAtSec == null ? '' : stack.endAtSec} placeholder="(optional)" onChange={(e) => onPatch({ endAtSec: e.target.value === '' ? null : Number(e.target.value) })} className="bg-cream/5 border border-cream/15 rounded px-2 py-1 text-cream focus:outline-none focus:border-accent" />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default UserStackBody;
