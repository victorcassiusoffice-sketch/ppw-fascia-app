// MediaPlayer — branches between YouTube video iframe, audio chrome, and legacy mp4 fallback.
// Loads media.json from a path; if 404, falls back to <video src="/.../video.mp4"> with "coming soon" placeholder.

import React, { useEffect, useRef, useState } from 'react';
import { loadMedia } from './data.js';

// M14 — `enablejsapi=1` lets the YouTube IFrame API postMessage events
// (including state-change → 0 = ended) reach our listener inside MergedStack
// for video auto-play sequencing. The iframe needs a `listening` handshake
// + an addEventListener('onStateChange') subscription, sent on load.
function YouTubeEmbed({ youtube_id, autoplay = false }) {
  const ref = useRef(null);
  const src = `https://www.youtube-nocookie.com/embed/${youtube_id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1${autoplay ? '&autoplay=1' : ''}`;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onLoad = () => {
      try {
        node.contentWindow && node.contentWindow.postMessage(
          JSON.stringify({ event: 'listening', id: 'ppw-yt' }),
          '*'
        );
        node.contentWindow && node.contentWindow.postMessage(
          JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'] }),
          '*'
        );
      } catch (_) {}
    };
    node.addEventListener('load', onLoad);
    return () => node.removeEventListener('load', onLoad);
  }, [youtube_id]);
  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
      <iframe
        ref={ref}
        src={src}
        title="PPW video"
        allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
        loading="lazy"
      />
    </div>
  );
}

function YouTubeAudio({ youtube_id, autoplay = false }) {
  // Use the same nocookie embed but crop the video frame so only audio controls show.
  const src = `https://www.youtube-nocookie.com/embed/${youtube_id}?rel=0&modestbranding=1&playsinline=1&controls=1&enablejsapi=1${autoplay ? '&autoplay=1' : ''}`;
  return (
    <div className="audio-only-wrap">
      <iframe
        src={src}
        title="PPW audio"
        allow="accelerometer; autoplay; encrypted-media"
        loading="lazy"
      />
    </div>
  );
}

function LegacyMp4({ src, autoPlay, onEnded }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center bg-black/40 rounded-xl aspect-video">
        <div className="text-4xl mb-3 opacity-30">▶</div>
        <div className="font-display text-lg text-cream/40">Video coming soon</div>
        <div className="text-xs text-muted mt-2 px-4 text-center break-all">{src}</div>
        {onEnded && (
          <button onClick={onEnded} className="mt-4 text-accent text-sm underline underline-offset-4">Skip →</button>
        )}
      </div>
    );
  }
  return (
    <video
      key={src}
      src={src}
      controls
      autoPlay={autoPlay}
      playsInline
      className="w-full rounded-xl bg-black"
      onEnded={onEnded}
      onError={() => setError(true)}
    />
  );
}

/** Direct media (already-resolved object) — skip the fetch. */
export function DirectMediaPlayer({ media, autoplay = false }) {
  if (!media) return null;
  if (media.media_type === 'audio') return <YouTubeAudio youtube_id={media.youtube_id} autoplay={autoplay} />;
  return <YouTubeEmbed youtube_id={media.youtube_id} autoplay={autoplay} />;
}

/**
 * MediaPlayer
 *  Props:
 *    mediaPath  — '/videos/.../media.json' (preferred)
 *    fallbackMp4 — legacy mp4 path to try if media.json is missing
 *    autoplay
 *    onEnded
 */
export default function MediaPlayer({ mediaPath, fallbackMp4, autoplay = false, onEnded }) {
  const [media, setMedia] = useState(null);
  const [resolved, setResolved] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    reqId.current += 1;
    const myReq = reqId.current;
    setResolved(false);
    setMedia(null);
    if (!mediaPath) { setResolved(true); return; }
    loadMedia(mediaPath).then(m => {
      if (cancelled || myReq !== reqId.current) return;
      setMedia(m);
      setResolved(true);
    });
    return () => { cancelled = true; };
  }, [mediaPath]);

  if (!resolved) {
    return <div className="aspect-video bg-black/30 rounded-xl flex items-center justify-center text-muted text-sm">Loading media…</div>;
  }

  if (media) {
    return <DirectMediaPlayer media={media} autoplay={autoplay} />;
  }

  if (fallbackMp4) {
    return <LegacyMp4 src={fallbackMp4} autoPlay={autoplay} onEnded={onEnded} />;
  }

  return (
    <div className="flex flex-col items-center justify-center bg-black/40 rounded-xl aspect-video p-6 text-center">
      <div className="text-4xl mb-3 opacity-30">▶</div>
      <div className="font-display text-lg text-cream/40">Media coming soon</div>
      <div className="text-xs text-muted mt-2 break-all">{mediaPath}</div>
      {onEnded && (
        <button onClick={onEnded} className="mt-4 text-accent text-sm underline underline-offset-4">Skip →</button>
      )}
    </div>
  );
}
