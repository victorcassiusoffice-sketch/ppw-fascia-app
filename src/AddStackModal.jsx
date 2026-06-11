// Add Stack modal (Phase 2 — 2026-05-23).
// 5-icon row picker. Selecting an icon shows the icon's title at the top
// and renders the appropriate input fields below. Returns a `stack` object
// to the parent on save.

import React, { useState, useCallback, useEffect } from 'react';
import { putMedia, probeDuration, probeUrlDuration, parseYouTubeId, fetchYouTubeOEmbed, fetchSpotifyOEmbed, isSpotifyUrl } from './lib/mediaStore.js';
import { m, SPRING, DUR, reduced } from './lib/motion';

/* P1 (2026-06-02) — keyboard inset hook. On mobile the on-screen keyboard
   overlays the bottom of the layout viewport (iOS especially), hiding the
   "Add to today" button. window.visualViewport tells us how much is covered;
   we lift the bottom sheet by that amount so the Save button stays reachable. */
function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const onResize = () => {
      // Amount of the layout viewport hidden below the visual viewport.
      const hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setInset(hidden);
    };
    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', onResize); };
  }, []);
  return inset;
}

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

/* Iter 2 Phase 8.2 — Spotify placeholder (legal-gated; disabled). */
const SpotifyIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M7 9.5c3-1 7-1 10 1" />
    <path d="M7 12.5c2.5-0.7 6-0.7 8.5 0.8" />
    <path d="M7 15.5c2-0.5 5-0.5 7 0.6" />
  </svg>
);

const TYPES = [
  { key: 'link',  title: 'Link',           icon: Icon.link  },
  { key: 'image', title: 'Image',          icon: Icon.image },
  { key: 'video', title: 'Video',          icon: Icon.video },
  { key: 'audio', title: 'Audio',          icon: Icon.audio },
  { key: 'text',  title: 'Text Reminder',  icon: Icon.text  },
];

/* ── Refinement 2 (Vic, 2026-06-11) — APPS row. YouTube + Spotify default
   chips; the user pastes a URL/share-link to attach it to the stack, and the
   stack card carries its thumbnail (REF-06). Spotify here = LINK + public
   oEmbed metadata ONLY — playback stays behind the existing legal gate
   (no SDK, no Premium requirement, no keys, no spend). This row replaces the
   old disabled Spotify placeholder tile. */
const APPS = [
  { key: 'youtube', label: 'YouTube', glyph: '▶', placeholder: 'Paste a YouTube link or share-link…' },
  { key: 'spotify', label: 'Spotify', glyph: '♪', placeholder: 'Paste a Spotify track / episode / playlist link…' },
  { key: 'custom',  label: 'Custom',  glyph: '↗', placeholder: 'Paste any app link or share-link…' },
];

function newId() {
  return 'user::' + Date.now() + '::' + Math.floor(Math.random() * 999999);
}

/* Iter 2 Phase 8.1 — inline YouTube search popover.
   Tap "Search YouTube" to reveal a small query input + Open button. Open
   launches youtube.com/results?search_query=<encoded> in a new tab. User
   copies the URL of their pick and pastes back into the URL field above
   (the existing onPasteUrl + oEmbed fetch handles the rest). */
function YouTubeSearchPopover({ onPickUrl }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const doSearch = () => {
    if (!query.trim()) return;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`;
    if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 text-xs text-accent hover:underline underline-offset-4"
      >
        <span aria-hidden>▶</span>
        {open ? 'Hide YouTube search' : 'Search YouTube'}
      </button>
      {open && (
        <div className="card p-3 bg-cream/[0.02] border border-accent/20 space-y-2">
          <label className="block">
            <span className="text-[10px] text-muted uppercase tracking-widest mb-1 block">Query</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
              placeholder="e.g. 10 min sciatica stretch"
              className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={doSearch}
              disabled={!query.trim()}
              className="btn-accent text-xs px-3 py-1.5 disabled:opacity-40"
            >Open YouTube</button>
            <span className="text-[10px] text-muted">Copy the chosen video URL back into the URL field above.</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddStackModal({ open, onClose, onSave, defaultTime = '08:00' }) {
  const keyboardInset = useKeyboardInset();
  const [chosen, setChosen] = useState(null);
  const [appKind, setAppKind] = useState(null); // 'youtube' | 'spotify' | 'custom' | null
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
  // 2026-06-03 — recurrence scope. 'this-day' (default, one-off) · 'everyday' ·
  // 'weekly' · 'everyN' (reveals the 1..30 stepper).
  const [scope, setScope] = useState('this-day');
  const [everyN, setEveryN] = useState(2);

  const reset = useCallback(() => {
    setChosen(null);
    setAppKind(null);
    setTime(defaultTime);
    setUrl(''); setText(''); setDuration(60);
    setStartAt(0); setEndAt(''); setBusy(false); setError(null);
    setTitlePreview(''); setThumbPreview(null); setFilePicked(null);
    setScope('this-day'); setEveryN(2);
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
      setAppKind('youtube');
      setBusy(true);
      const meta = await fetchYouTubeOEmbed(v);
      if (meta) {
        setTitlePreview(meta.title || '');
        setThumbPreview(meta.thumbnail_url || null);
      }
      setBusy(false);
      return;
    }
    // Refinement 2 — Spotify share-link → public oEmbed (lazy, cached,
    // offline-silent; a null result just keeps the app glyph fallback).
    if (isSpotifyUrl(v)) {
      setAppKind('spotify');
      setBusy(true);
      const meta = await fetchSpotifyOEmbed(v);
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
      // 2026-06-03 — recurrence scope rides along on the saved stack. The
      // parent reads `recurrence` to decide one-off (null) vs rule creation.
      baseStack.recurrence = scope === 'this-day'
        ? null
        : { freq: scope, interval: scope === 'everyN' ? Math.min(30, Math.max(1, Number(everyN) || 1)) : (scope === 'weekly' ? 7 : 1) };
      if (chosen === 'link') {
        if (!url) throw new Error('Paste a URL.');
        const yt = parseYouTubeId(url);
        baseStack.url = url;
        baseStack.youtubeId = yt || null;
        baseStack.title = titlePreview || url;
        // Refinement 2 — ADDITIVE fields (no existing shape changes): which
        // app the link belongs to + the resolved thumbnail for the stack card.
        baseStack.appKind = appKind || (yt ? 'youtube' : isSpotifyUrl(url) ? 'spotify' : 'custom');
        baseStack.thumbnailUrl = thumbPreview || null;
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
  }, [chosen, appKind, time, duration, startAt, endAt, url, titlePreview, thumbPreview, filePicked, text, scope, everyN, onSave, handleClose]);

  if (!open) return null;

  const chosenType = TYPES.find(t => t.key === chosen);
  const noMotion = reduced();

  return (
    <m.div
      {...(noMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: DUR.fast / 1000 } })}
      className="fixed inset-0 z-50 ppw-scrim flex items-end sm:items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* REF-04/05 — the sheet IS the "+ Stack" control grown open: shared
          layoutId morphs button → sheet (transform-only, SPRING.sheet).
          Reduced motion keeps the CSS slide-in fallback (also media-guarded). */}
      <m.div
        {...(noMotion ? {} : { layoutId: 'add-stack-morph', transition: SPRING.sheet })}
        className={'card w-full max-w-md flex flex-col' + (noMotion ? ' slot-sheet-enter' : '')}
        style={{ backgroundColor: 'var(--glass-bg-strong)', maxHeight: '90vh', borderRadius: 'var(--r-24)', marginBottom: keyboardInset ? keyboardInset : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream/10 shrink-0">
          <div className="font-display text-xl">
            {chosenType ? chosenType.title : 'Add Stack'}
          </div>
          <button onClick={handleClose} className="text-muted hover:text-accent text-2xl leading-none" aria-label="Close">×</button>
        </div>

        {/* P1 (2026-06-02) — scrollable body; footer below stays pinned + reachable above the keyboard. */}
        <div className="flex-1 overflow-y-auto min-h-0">
        {/* 5-icon row — always visible at top. REF-08: circular glass discs. */}
        <div className="flex justify-around px-2 py-4 border-b border-cream/10 gap-1">
          {TYPES.map(t => {
            const active = chosen === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => { setChosen(t.key); if (t.key !== 'link') setAppKind(null); }}
                className={`glass-disc w-12 h-12 ${active ? 'text-accent ring-2 ring-accent' : 'text-muted hover:text-cream'}`}
                aria-label={t.title}
                title={t.title}
              >
                {t.icon}
              </button>
            );
          })}
        </div>

        {/* Refinement 2 — APPS row (Vic new feature): YouTube + Spotify
            default chips + Custom. One tap arms the link flow with the right
            placeholder; pasting a share-link resolves title + thumbnail
            (public oEmbed only — link-out, no playback). */}
        <div className="px-5 py-3 border-b border-cream/10">
          <div className="text-[10px] text-muted uppercase tracking-widest mb-2">Apps</div>
          <div className="flex gap-2 flex-wrap">
            {APPS.map(a => {
              const active = chosen === 'link' && appKind === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => { setChosen('link'); setAppKind(a.key); setUrl(''); setTitlePreview(''); setThumbPreview(null); }}
                  className={`glass-capsule text-xs ${active ? 'text-accent ring-2 ring-accent' : 'text-muted hover:text-cream'}`}
                  style={{ padding: '8px 14px' }}
                  aria-pressed={active}
                  title={`Attach a ${a.label} link to this stack`}
                >
                  <span aria-hidden="true">{a.glyph}</span> {a.label}
                </button>
              );
            })}
          </div>
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
                  placeholder={(APPS.find(a => a.key === appKind) || {}).placeholder || 'https://youtube.com/... or direct video URL'}
                  className="w-full bg-cream/5 border border-cream/15 rounded-lg px-3 py-2 text-sm font-display text-cream focus:outline-none focus:border-accent"
                  autoFocus
                />
              </label>
              {/* Iter 2 Phase 8.1 — explicit YouTube search popover */}
              <YouTubeSearchPopover onPickUrl={(picked) => onPasteUrl(picked)} />
              {titlePreview && (
                <div className="card p-3 flex items-center gap-3">
                  {thumbPreview && <img src={thumbPreview} alt="" className="w-20 h-12 object-cover rounded" />}
                  <div className="text-sm text-cream truncate flex-1 min-w-0">{titlePreview}</div>
                </div>
              )}
            </>
          )}

          {chosen === 'link' && appKind === 'spotify' && (
            <p className="text-[10px] text-muted leading-relaxed">
              Spotify links open in the Spotify app — the stack shows the cover art
              and title; playback stays in Spotify.
            </p>
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

              {/* 2026-06-03 — recurrence scope picker */}
              <div className="space-y-2">
                <span className="text-xs text-muted uppercase tracking-widest block">Repeat</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { key: 'this-day', label: 'This day' },
                    { key: 'everyday', label: 'Everyday' },
                    { key: 'weekly',   label: 'Weekly' },
                    { key: 'everyN',   label: 'Every N' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setScope(opt.key)}
                      className={`text-xs px-2 py-2 rounded-lg border transition-all ${scope === opt.key ? 'border-accent text-accent bg-accent/15' : 'border-cream/15 text-muted hover:text-cream'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {scope === 'everyN' && (
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-xs text-muted">Every</span>
                    <button
                      type="button"
                      onClick={() => setEveryN(n => Math.max(1, Number(n) - 1))}
                      className="w-8 h-8 rounded-lg border border-cream/15 text-cream hover:border-accent"
                      aria-label="Fewer days"
                    >−</button>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={everyN}
                      onChange={(e) => setEveryN(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-16 bg-cream/5 border border-cream/15 rounded-lg px-2 py-1.5 text-sm text-center font-display text-cream focus:outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => setEveryN(n => Math.min(30, Number(n) + 1))}
                      className="w-8 h-8 rounded-lg border border-cream/15 text-cream hover:border-accent"
                      aria-label="More days"
                    >+</button>
                    <span className="text-xs text-muted">days</span>
                  </div>
                )}
                {scope !== 'this-day' && (
                  <p className="text-[10px] text-muted">Recurring routines fill your calendar up to 30 days ahead.</p>
                )}
              </div>
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
        </div>{/* end scrollable body */}

        <div className="flex gap-2 p-4 border-t border-cream/10 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={handleClose} className="btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!chosen || busy}
            className="btn-accent flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? 'Saving…' : 'Add to today'}
          </button>
        </div>
      </m.div>
    </m.div>
  );
}
