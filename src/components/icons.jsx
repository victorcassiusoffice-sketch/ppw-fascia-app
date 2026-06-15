// Inline Lucide-style icons + tickboxes (extracted verbatim from App.jsx,
// 2026-06-11 liquid-glass redesign — zero logic change).
import React from 'react';

/* ─── Phase 1.3 — Lucide-style inline icons (no new dep) ─── */
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function IconCopy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function IconLink2() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
      <path d="M15 7h2a5 5 0 0 1 0 10h-2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function IconMusic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
function IconMessageSquare() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconShoppingCart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}
/* Bug C (2026-06-02) — one-tap "open" launch icon on a slot row. */
function IconExternalLink() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

/* Background-picker line icons (2026-06-15) — replace the ◑ ❧ ◻ 🖼 emoji in
   Settings → Appearance with clean glyphs matching the icon grammar. */
function IconAuto() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconDroplet() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z" />
      <path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5" opacity="0.6" />
    </svg>
  );
}
function IconLeaf() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 4 13c0-5 5-9 16-9 0 9-4 13-9 13z" />
      <path d="M7 17c4-1 7-4 9-8" opacity="0.6" />
    </svg>
  );
}
function IconSquareRounded() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="5" />
    </svg>
  );
}

/* Icon-first pass 3 (2026-06-15) — retire the last old emoji/text glyphs
   (⋯ trigger, ☑ select-all, ◆ create-routine) for clean Lucide-line icons. */
function IconMore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
function IconCheckSquare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
function IconSparkle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 4.9L18.7 9 13.8 10.8 12 15.7 10.2 10.8 5.3 9l4.9-1.1z" />
      <path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" />
    </svg>
  );
}

/* Icon-first pass 2 (2026-06-15) — sliders glyph for the "edit stack fields"
   toggle (was an underlined text link). */
function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

/* Less-text pass (2026-06-15) — back-arrow for glass-disc back buttons that
   replace the "← Today" / "← Protocols" text links. */
function IconArrowLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

/* Fix 2026-06-14 (Vic) — "unmerge stack" icon: two rounded tiles pulling
   apart, signalling the merged stack splits back into separate routines. */
function IconUnmerge() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="6" width="9" height="9" rx="2" />
      <rect x="12.5" y="9" width="9" height="9" rx="2" />
      <path d="M16 3.5l2 2-2 2" />
      <path d="M8 20.5l-2-2 2-2" />
    </svg>
  );
}

/* ─── Iter 2 Phase 5.1 — Tickbox + kind-dot pill ───
   Replaces the kind dot in the row between drag handle and time chip.
   Kind dot survives as a small coloured pill BEHIND the checkbox so
   category remains visible at a glance. 18×18 box, 24×24 tap target. */
function Tickbox({ checked, onChange, ariaLabel, kindClass }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className="relative w-6 h-6 shrink-0 flex items-center justify-center"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {kindClass && (
        <span
          className={`absolute inset-0 m-auto w-[22px] h-[22px] rounded-full opacity-40 ${kindClass}`}
          aria-hidden="true"
        />
      )}
      <span
        className="relative inline-block"
        style={{
          width: 18,
          height: 18,
          border: '1.5px solid ' + (checked ? 'var(--col-accent)' : 'var(--col-mid)'),
          backgroundColor: checked ? 'var(--col-accent)' : 'var(--col-inset)',
          transition: 'background-color 200ms cubic-bezier(0.22,1,0.36,1), border-color 200ms cubic-bezier(0.22,1,0.36,1), border-radius 200ms cubic-bezier(0.22,1,0.36,1)',
          // liquid morph: the box relaxes from a square tick to a softer
          // blob when checked — a tiny melt that matches the app character.
          borderRadius: checked ? 7 : 4,
        }}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-on-accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
    </button>
  );
}

/* Multilingual pass (2026-06-16) — Apps selector becomes icon-only so its
   YouTube / Spotify / Custom labels no longer need translating. Monochrome
   line icons (currentColor, thin uniform stroke) per the SOURCE BTN v.02
   grammar — NOT brand-coloured logos (those would break the glass monochrome
   rule). Accessible name lives on the control via aria-label + title. */
function IconYouTube({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="4" />
      <path d="M10 8.75l5.5 3.25L10 15.25z" />
    </svg>
  );
}
function IconSpotify({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M7 9.5c3-1 7-1 10 1" />
      <path d="M7 12.5c2.5-0.7 6-0.7 8.5 0.8" />
      <path d="M7 15.5c2-0.5 5-0.5 7 0.6" />
    </svg>
  );
}

/* ─── Iter 2 Phase 6.5 — Bell icon for notifications toggle ─── */
function IconBell({ filled }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
function IconBookOpen() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
/* Iter 2 patch 1 — calendar icon for the Clear button. */
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* ─── Iter 2 patch 1 — Master tickbox for the toolbar ───
   State machine (Gmail-style):
     - empty  (size === 0)        → tap selects all visible
     - mixed  (0 < size < visible) → tap clears (indeterminate marker)
     - full   (size === visible)   → tap clears
   Visual mirrors the per-row Tickbox: navy border, cream fill, gold tick
   when "full"; dash glyph when "mixed". */
function MasterTickbox({ selectedCount, visibleCount, onToggle }) {
  const state = visibleCount === 0
    ? 'empty'
    : selectedCount === 0
      ? 'empty'
      : selectedCount >= visibleCount
        ? 'full'
        : 'mixed';
  const filled = state === 'full' || state === 'mixed';
  const label = state === 'full'
    ? 'Unselect all'
    : state === 'mixed'
      ? 'Clear selection (' + selectedCount + ' selected)'
      : 'Select all on this day';
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(state); }}
      className="w-9 h-9 shrink-0 flex items-center justify-center"
      role="checkbox"
      aria-checked={state === 'full' ? 'true' : state === 'mixed' ? 'mixed' : 'false'}
      aria-label={label}
      title={label}
    >
      <span
        className="relative inline-block"
        style={{
          width: 18,
          height: 18,
          border: '1.5px solid ' + (filled ? 'var(--col-accent)' : 'var(--col-mid)'),
          backgroundColor: filled ? 'var(--col-accent)' : 'var(--col-inset)',
          transition: 'background-color 200ms cubic-bezier(0.22,1,0.36,1), border-color 200ms cubic-bezier(0.22,1,0.36,1), border-radius 200ms cubic-bezier(0.22,1,0.36,1)',
          // liquid morph: the box relaxes from a square tick to a softer
          // blob when filled — a tiny melt that matches the app character.
          borderRadius: filled ? 7 : 4,
        }}
      >
        {state === 'full' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-on-accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
        {state === 'mixed' && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--c-on-accent))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        )}
      </span>
    </button>
  );
}

export {
  IconTrash, IconCopy, IconPlus, IconLink2, IconImage, IconVideo, IconMusic,
  IconMessageSquare, IconShoppingCart, IconExternalLink, IconBell,
  IconBookOpen, IconCalendar, IconUnmerge, IconArrowLeft, IconSliders,
  IconMore, IconCheckSquare, IconSparkle,
  IconAuto, IconDroplet, IconLeaf, IconSquareRounded, Tickbox, MasterTickbox,
  IconYouTube, IconSpotify,
};
