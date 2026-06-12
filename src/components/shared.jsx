// Shared presentational pieces (extracted verbatim from App.jsx, 2026-06-11
// liquid-glass redesign — zero logic change).
import React, { useState, useEffect } from 'react';
import { useScrollFadeIn } from '../useScrollFadeIn.js';

// 2026-06-12 revamp (Vic purge order): the Wave-2 ScienceDivider stock-image
// component is RETIRED with its assets — no importers remain (App.jsx +
// Protocols.jsx usages removed in the same commit). Content surfaces are
// glass panes per the REF contract.

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

export { InlineRename, Section };
