// Add Stack modal (Phase 2 — 2026-05-23).
// 5-icon row picker. Selecting an icon shows the icon's title at the top
// and renders the appropriate input fields below. Returns a `stack` object
// to the parent on save.

import React, { useState, useCallback } from 'react';
import { putMedia, probeDuration, probeUrlDuration, parseYouTubeId, fetchYouTubeOEmbed } from './lib/mediaStore.js';

/* ─── Inline lucide-style icons (no new dep) ─── */
const Icon = {
  link: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  image: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  video: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ),
  audio: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  ),
  text: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
};

const TYPES = [
  { key: 'link',  title: 'Link',           icon: Icon.link  },
  { key: 'image', title: 'Image',          icon: Icon.image },
  { key: 'video', title: 'Video',          icon: Icon.video },
  { key: 'audio', title: 'Audio',          icon: Icon.audio },
  { key: 'text',  title: 'Text Reminder',  icon: Icon.text  },
];

function newId() {
  return 'user::' + Date.now() + '::' + Math.floor(Math.random() * 999999);
}

export default function AddStackModal({ open, onClose, onSave, defaultTime = '08:00' }) {
  const [chosen, setChosen] = useState(null);
  const [time, setTime] = useState(defaultTime);
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [duration, setDuration] = useState(60); // seconds
  const [startAt, setStartAt] = useState(0);
  const [endAt, setEndAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [titlePreview, setTitlePreview] = useState('');
  const [thumbPreview, setThumbPreview] = useState(null);
  const [filePicked, setFilePicked] = useState(null);

  const reset = useCallback(() => {
    setChosen(null);
    setTime(defaultTime);
    setUrl(''); setText(''); setDuration(60);
    setStartAt(0); setEndAt(''); setBusy(false); setError(null);
    setTitlePreview(''); setThumbPreview(null); setFilePicked(null);
  }, [defaultTime]);

  const handleClose = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const onPickFile = useCallback(async (file) => {
    setFilePicked(file);
    setError(null);
    if (!file) return;
    const d = await probeDuration(file);
    if (d && d > 0) setDuration(d);
  }, []);

  const onPasteUrl = useCallback(async (v) => {
    setUrl(v);
    setError(null);
    if (!v) { setTitlePreview(''); setThumbPreview(null); return; }
    const yt = parseYouTubeId(v);
    if (yt) {
      setBusy(true);
      const meta = await fetchYouTubeOEmbed(v);
      if (meta) {
        setTitlePreview(meta.title || '');
        setThumbPreview(meta.thumbnail_url || null);
      }
      setBusy(false);
      return;
    }
    // Direct media URL — try to probe duration.
    if (/\.(mp4|webm|mov)(\?|$)/i.test(v)) {
      setBusy(true);
      const d = await probeUrlDuration(v, 'video');
      if (d) setDuration(d);
      setBusy(false);
    } else if (/\.(mp3|m4a|wav|ogg)(\?|$)/i.test(v)) {
      setBusy(true);
      const d = await probeUrlDuration(v, 'audio');
      if (d) setDuration(d);
      setBusy(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const baseStack = {
        id: newId(),
        type: chosen,
        time,
        durationSec: Number(duration) || 60,
        startAtSec: Number(startAt) || 0,
        endAtSec: endAt === '' ? null : Number(endAt),
      };
      if (chosen === 'link') {
        if (!url) throw new Error('Paste a URL.');
        const yt = parseYouTubeId(url);
        baseStack.url = url;
        baseStack.youtubeId = yt || null;
        baseStack.title = titlePreview || url;
      } else if (chosen === 'image' || chosen === 'video' || chosen === 'audio') {
        if (!filePicked) throw new Error('Choose a file.');
        const mediaId = newId();
        await putMedia(mediaId, filePicked);
        baseStack.mediaStoreId = mediaId;
        baseStack.mime = filePicked.type;
        baseStack.title = filePicked.name;
      } else if (chosen === 'text') {
        if (!text.trim()) throw new Error('Enter the reminder text.');
        baseStack.text = text.trim();
        baseStack.title = text.trim().slice(0, 80);
        baseStack.durationSec = 0; // text = until-next
      }
      onSave(baseStack);
      handleClose();
    } catch (err) {
      setError(err.message || String(err));
      setBusy(false);
    }
  }, [chosen, time, duration, startAt, endAt, url, titlePreview, filePicked, text, onSave, handleClose]);

  if (!open) return null;

  const chosenType = TYPES.find(t => t.key === chosen);

  return (
    <div className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={handleClose}>
      <div
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: '#0a1628' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream/10">
          <div className="font-display text-xl">
            {chosenType ? chosenType.title : 'Add Stack'}
          </div>
          <button onClick={handleClose} className="text-muted hover:text-accent text-2xl leading-none" aria-label="Close">×</button>
        </div>

        {/* 5-icon row — always visible at top */}
        <div className="flex justify-around px-3 py-4 border-b border-cream/10">
          {TYPES.map(t => {
            const active = chosen === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setChosen(t.key)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${active ? 'text-accent bg-accent/15 ring-2 ring-accent' : 'text-muted hover:text-cream'}`}
                aria-label={t.title}
                title={t.title}
              >
                {t.icon}
              </button>
            );
          })}
        </div>

        {/* Type-specific inputs */}
        <div className="p-5 space-y-4">
          {!chosen && (
            <p className="text-muted text-sm text-center">Pick an icon above to choose what kind of stack to add.</p>
          )}

          {chosen === 'link' && (
            <>
              <label className="block">
                <span className="text-xs text-muted uppercase tracking-widest mb-1 block">URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => onPasteUrl(e.target.value)}
                  placeholder="https://youtube.com/... or direct video URL"
                  className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
                  autoFocus
                />
              </label>
              {titlePreview && (
                <div className="card p-3 flex items-center gap-3">
                  {thumbPreview && <img src={thumbPreview} alt="" className="w-20 h-12 object-cover rounded" />}
                  <div className="text-sm text-cream truncate flex-1 min-w-0">{titlePreview}</div>
                </div>
              )}
            </>
          )}

          {(chosen === 'image' || chosen === 'video' || chosen === 'audio') && (
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-widest mb-1 block">Pick {chosen} from device</span>
              <input
                type="file"
                accept={chosen === 'image' ? 'image/*' : chosen === 'video' ? 'video/*' : 'audio/*'}
                onChange={(e) => onPickFile(e.target.files && e.target.files[0])}
                className="w-full text-sm text-cream"
              />
              {filePicked && (
                <div className="text-xs text-accent mt-1 truncate">{filePicked.name} · {Math.round(filePicked.size / 1024)} KB</div>
              )}
              {chosen === 'audio' && (
                <p className="text-[10px] text-muted mt-2">Google Drive sync is deferred to Phase 4 (Vic Y required). For now, audio is stored locally on this device.</p>
              )}
            </label>
          )}

          {chosen === 'text' && (
            <label className="block">
              <span className="text-xs text-muted uppercase tracking-widest mb-1 block">Reminder text</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What should this remind you of?"
                rows={3}
                className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent resize-none"
                autoFocus
              />
              <p className="text-[10px] text-muted mt-2">Stays on screen until you open the next stack (no auto-advance).</p>
            </label>
          )}

          {chosen && (
            <div className="border-t border-cream/10 pt-4 space-y-3">
              <label className="grid grid-cols-2 gap-3 items-center">
                <span className="text-xs text-muted uppercase tracking-widest">Start time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
                />
              </label>
              {chosen !== 'text' && (
                <label className="grid grid-cols-2 gap-3 items-center">
                  <span className="text-xs text-muted uppercase tracking-widest">Duration (sec)</span>
                  <input
                    type="number"
                    min="1"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
                  />
                </label>
              )}
              {(chosen === 'link' || chosen === 'video' || chosen === 'audio') && (
                <>
                  <label className="grid grid-cols-2 gap-3 items-center">
                    <span className="text-xs text-muted uppercase tracking-widest">Start at (sec)</span>
                    <input
                      type="number"
                      min="0"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                      className="bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
                    />
                  </label>
                  <label className="grid grid-cols-2 gap-3 items-center">
                    <span className="text-xs text-muted uppercase tracking-widest">End at (sec)</span>
                    <input
                      type="number"
                      min="0"
                      value={endAt}
                      onChange={(e) => setEndAt(e.target.value)}
                      placeholder="(optional)"
                      className="bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
                    />
                  </label>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-400/30 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-cream/10">
          <button onClick={handleClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!chosen || busy}
            className="btn-accent flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Add to today'}
          </button>
        </div>
      </div>
    </div>
  );
}
