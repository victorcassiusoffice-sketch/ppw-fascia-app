// Shared presentational pieces (extracted verbatim from App.jsx, 2026-06-11
// liquid-glass redesign — zero logic change).
import React, { useState, useEffect } from 'react';
import { useScrollFadeIn } from '../useScrollFadeIn.js';

// Wave-2 — cinematic science divider. Register B (bioluminescent cyan on deep
// black) is correct here: this is embedded content imagery, NOT surface chrome.
// Uses `fade-in is-visible` (both classes) so it paints immediately even where
// the scroll-reveal hook isn't wired — avoids an invisible band.
function ScienceDivider({ src, label, aspect = '16 / 3' }) {
  return (
    <div className="relative my-10 rounded-xl overflow-hidden fade-in is-visible" style={{ aspectRatio: aspect }}>
      <img
        src={`${import.meta.env.BASE_URL}images/science/${src}`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="w-full h-full object-cover"
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(10,22,40,0.88) 0%, rgba(10,22,40,0.18) 48%, rgba(10,22,40,0.88) 100%)' }}
      />
      {label && (
        <div className="absolute inset-0 flex items-center px-5">
          <span className="eyebrow">{label}</span>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   M9 — InlineRename
   Tap a title → input → save on blur/Enter. Used by every routine card and
   every merged-stack header. Vic spec: rename ANY routine stack title.
   ═══════════════════════════════════════════ */
function InlineRename({ value, placeholder, onSave, className = '', inputClassName = '', titleClassName = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter')   { onSave(draft); setEditing(false); }
          if (e.key === 'Escape')  { setDraft(value || ''); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={'bg-cream/5 border border-accent/60 rounded-md px-2 py-1 text-cream focus:outline-none focus:border-accent ' + inputClassName}
        aria-label="Rename"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className={'text-left hover:underline underline-offset-4 decoration-dotted decoration-accent/50 truncate ' + className + ' ' + titleClassName}
      title="Tap to rename"
    >
      {value
        ? <span>{value}</span>
        : <span className="text-muted italic">{placeholder || 'Tap to name…'}</span>}
    </button>
  );
}

function Section({ title, children }) {
  const ref = useScrollFadeIn();
  return (
    <section ref={ref} className="mb-10 fade-in">
      <h2 className="font-display text-2xl md:text-3xl mb-4 leading-tight">{title}</h2>
      {children}
    </section>
  );
}

export { ScienceDivider, InlineRename, Section };
