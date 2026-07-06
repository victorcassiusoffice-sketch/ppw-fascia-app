// AddSheet — New Design "Add to your stack" bottom sheet (functional core port).
//
// Ported now: the 2×2 tile grid (tiles route to Library filtered), the
// Assistant CTA (Premium-gated), the Custom-apps quick links, and the real
// paste-a-share-link → adds a media item to today's stack. Deferred: the inline
// note composer + document upload (need more logic) — tiles still present.

import React from 'react';
import { useStore5, closeAdd, setCustomUrl, addCustomUrl, goLibrary, setUpsell, openNoteComposer, setNoteField, addNote, parseRoutineMd, addItemsToToday, createRoutine, getState, addDocToToday } from '../store5.js';
import { saveFile } from '../files5.js';

const tsvg = (p) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{p}</svg>;
export const TILE_ICONS = {
  routine: tsvg(<path d="M12 3s6 6.3 6 10.3a6 6 0 0 1-12 0C6 9.3 12 3 12 3z" />),
  media: tsvg(<><path d="M9 18V6l8-2v12" /><circle cx="7" cy="18" r="2.2" /><circle cx="15" cy="16" r="2.2" /></>),
  protocol: tsvg(<><path d="M5 7.5 12 4l7 3.5-7 3.5-7-3.5z" /><path d="M5 12l7 3.5 7-3.5" /><path d="M5 16.5 12 20l7-3.5" /></>),
  text: tsvg(<><path d="M5 4h14v11l-4 5H5z" /><path d="M15 20v-5h4M8.5 9h7M8.5 12.5h4" /></>),
  doc: tsvg(<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" /></>),
};
export const DOC_ACCEPT = '.pdf,.doc,.docx,.txt,.md,.rtf,.csv,.ppt,.pptx,.xls,.xlsx,image/*';
const TILES = [
  { key: 'routines', name: 'Routine', tab: 'routines', icon: TILE_ICONS.routine },
  { key: 'media', name: 'Media', tab: 'media', icon: TILE_ICONS.media },
  { key: 'protocols', name: 'Protocol', tab: 'protocols', icon: TILE_ICONS.protocol },
  // Vic 2026-07-07 — "Affirmation" is called "Text" everywhere in Add Stacks.
  { key: 'note', name: 'Text', note: true, icon: TILE_ICONS.text },
];
const NOTE_STYLES = [
  { key: 'still', label: 'Still' },
  { key: 'pulse', label: 'Pulse' },
  { key: 'marquee', label: 'Scroll' },
  { key: 'flash', label: 'Flash' },
];
const SEG = { position: 'relative', height: 40, borderRadius: 12, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', display: 'flex' };
const segBtn = (active) => ({ position: 'relative', flex: 1, background: active ? 'var(--acc-surf)' : 'none', borderRadius: 9, margin: 3, border: active ? '1px solid var(--acc-rim)' : 'none', fontSize: 11, fontWeight: 600, color: active ? 'var(--acc-ink)' : 'var(--dim)' });

export default function AddSheet() {
  const S = useStore5();
  // Vic 1a — routine import: parsed .md is held as a DRAFT for review before
  // anything is added.
  const [draft, setDraft] = React.useState(null); // { name, items } | { error }
  const [draftMsg, setDraftMsg] = React.useState(null);
  const onRoutineFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseRoutineMd(reader.result);
      setDraftMsg(null);
      setDraft(res.ok ? { name: res.name, items: res.items } : { error: 'That file doesn’t look like a PPW routine (.md).' });
    };
    reader.readAsText(f);
  };
  if (!S.addOpen) return null;
  const hasSpeed = S.noteAnim !== 'still';

  const onAssistant = () => {
    if (!S.premium) { setUpsell('The Assistant is part of Premium — it plans, researches and rebuilds your day, right from this corner.'); return; }
    // premium: assistant builder is a later port; for now route to Library
    goLibrary('media');
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30 }}>
      <div onClick={closeAdd} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100% - 130px)', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', transformOrigin: '50% 105%', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Add to your stack</div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TILES.map((t) => (
            <button key={t.key} onClick={() => t.note ? openNoteComposer() : goLibrary(t.tab)} style={{ height: 92, borderRadius: 22, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', color: (t.note && S.noteOpen) ? 'var(--accent)' : 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {t.icon}
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</span>
            </button>
          ))}
          {/* Document — stays on this device, reopens after a restart */}
          <label style={{ height: 92, borderRadius: 22, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
            {TILE_ICONS.doc}
            <span style={{ fontSize: 13, fontWeight: 600 }}>Document</span>
            <input type="file" accept={DOC_ACCEPT} onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; const fileId = await saveFile(f); addDocToToday(f.name, fileId); }} style={{ display: 'none' }} />
          </label>
          <button onClick={onAssistant} style={{ gridColumn: '1 / -1', height: 60, borderRadius: 20, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z" /><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" /></svg>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Assistant — build it for me</span>
          </button>
        </div>

        {/* inline affirmation composer */}
        {S.noteOpen && (
          <div style={{ marginTop: 14, borderRadius: 22, padding: 16, border: '1px solid var(--rim)', background: 'var(--surface)', animation: 'ppwRise .35s cubic-bezier(.22,1,.36,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h14v11l-4 5H5z" /><path d="M15 20v-5h4M8.5 9h7M8.5 12.5h4" /></svg>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Text</span>
            </div>
            <input value={S.noteText} onChange={(e) => setNoteField({ noteText: e.target.value })} placeholder="Write text to appear on screen…" aria-label="Text content" style={{ marginTop: 10, width: '100%', height: 46, padding: '0 14px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 }} />
            <div style={{ marginTop: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Style</div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 7 }}>
              {NOTE_STYLES.map((ns) => (
                <button key={ns.key} onClick={() => setNoteField({ noteAnim: ns.key })} style={{ height: 40, borderRadius: 12, border: `1px solid ${S.noteAnim === ns.key ? 'var(--acc-rim)' : 'var(--rim)'}`, background: S.noteAnim === ns.key ? 'var(--acc-surf)' : 'transparent', color: S.noteAnim === ns.key ? 'var(--acc-ink)' : 'var(--dim)', fontSize: 11, fontWeight: 600, textShadow: 'var(--label-shadow)' }}>{ns.label}</button>
              ))}
            </div>
            {hasSpeed && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)', flex: 'none' }}>Speed</div>
                <div style={{ ...SEG, flex: 1, maxWidth: 200 }}>
                  {['slow', 'med', 'fast'].map((sp) => (
                    <button key={sp} onClick={() => setNoteField({ noteSpeed: sp })} style={segBtn(S.noteSpeed === sp)}>{sp === 'med' ? 'Med' : sp[0].toUpperCase() + sp.slice(1)}</button>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Time</div>
                <input type="time" value={S.noteTime} onChange={(e) => setNoteField({ noteTime: e.target.value })} aria-label="Note time" style={{ marginTop: 5, width: '100%', height: 42, padding: '0 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 17, fontWeight: 600 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Stays for</div>
                <div style={{ ...SEG, marginTop: 5, height: 42 }}>
                  {[['5', '5s'], ['15', '15s'], ['stay', 'Until off']].map(([v, l]) => (
                    <button key={v} onClick={() => setNoteField({ noteDur: v })} style={segBtn(S.noteDur === v)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={addNote} style={{ marginTop: 14, width: '100%', height: 46, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Add text</button>
          </div>
        )}

        {/* Vic 1a — import a shared routine (.md): stacks arrive as a draft */}
        <label style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 52, borderRadius: 18, border: '2px dashed var(--hairline)', color: 'var(--dim)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7" /><path d="M12 3v12M8 11l4 4 4-4" /></svg>
          Import routine (.md)
          <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onRoutineFile} style={{ display: 'none' }} />
        </label>
        {draft && (
          <div style={{ marginTop: 12, borderRadius: 20, padding: 16, border: '1px solid var(--rim)', background: 'var(--surface)', animation: 'ppwRise .3s ease both' }}>
            {draft.error ? (
              <div style={{ fontSize: 13, color: 'var(--dim)' }}>{draft.error}</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Routine draft</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 16, fontWeight: 700, textShadow: 'var(--emboss)' }}>{draft.name}</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {draft.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
                      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--accent)', flex: 'none' }} />
                      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--ink)' }}>{it.title}</span>
                      {it.time && <span>{it.time}</span>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button onClick={() => { const r = addItemsToToday(draft.items); if (r.ok) { setDraftMsg(`${r.count} stack${r.count === 1 ? '' : 's'} added to today`); setDraft(null); } }} style={{ flex: 1, height: 44, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 13.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Add all to today</button>
                  {S.premium && (
                    <button onClick={() => { createRoutine(draft.name, draft.items); setDraftMsg(`Saved “${draft.name}” to your Routines`); setDraft(null); }} style={{ height: 44, padding: '0 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 13 }}>Save as routine</button>
                  )}
                  <button onClick={() => setDraft(null)} style={{ height: 44, padding: '0 12px', borderRadius: 14, border: 'none', background: 'none', color: 'var(--dim)', fontWeight: 600, fontSize: 13 }}>✕</button>
                </div>
              </>
            )}
          </div>
        )}
        {draftMsg && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: 'var(--accent)', textAlign: 'center', animation: 'ppwRise .3s ease both' }}>{draftMsg}</div>}

        <div style={{ marginTop: 20, fontSize: 11, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Custom apps</div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>YouTube
          </a>
          <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l8-2v12" /><circle cx="7" cy="18" r="2.2" /><circle cx="15" cy="16" r="2.2" /></svg>Spotify
          </a>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          <input value={S.customUrl} onChange={(e) => setCustomUrl(e.target.value)} placeholder="Paste a share link…" aria-label="Paste a share link" style={{ flex: 1, height: 48, padding: '0 16px', borderRadius: 15, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 }} />
          <button onClick={() => addCustomUrl(S.customUrl)} style={{ height: 48, padding: '0 20px', borderRadius: 15, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Add</button>
        </div>
        {S.addedCustom && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 18, border: '1px solid var(--rim)', background: 'var(--surface)', animation: 'ppwRise .3s ease both' }}>
            <div style={{ flex: 1, fontSize: 13.5, color: 'var(--ink)' }}><strong>{S.addedCustom.title}</strong> added to today's stack</div>
            <button onClick={() => goLibrary('media')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 600 }}>View</button>
          </div>
        )}
      </div>
    </div>
  );
}
