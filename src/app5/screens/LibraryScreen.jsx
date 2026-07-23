// LibraryScreen — New Design "Library" (tabbed content library, focused port).
//
// Ported now: the 4-tab gliding segmented control (Routines/Media/Protocols/
// Supps), the Routines Premium gate (upsell vs "you're Premium"), and the Media
// tab (list of media items, tick to add into today's stack). Protocols/Supps
// tabs show a faithful empty state until their content sources are ported.

import React from 'react';
import { THUMBS } from '../theme5.js';
import { useStore5, setTab, addToStack, setUpsell, openPlayer, createRoutine, deleteRoutine, updateRoutine, routineToMd, itemFromUrl, openSchedule, loadProtocols, PREMIUM_PROTOCOL_UPSELL } from '../store5.js';
import { TILE_ICONS, DOC_ACCEPT } from './AddSheet.jsx';
import { saveFile } from '../files5.js';
import { protocolToItem } from '../protocols5.js';
import SuppsSection from './SuppsSection.jsx';

// small calendar "Add to Stack" disc — opens SchedulePicker to pick the day
const ICal = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3M12 13v4M10 15h4" /></svg>;
function AddToStackBtn({ onClick, label = 'Add to Stack on a day' }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={label} title={label}
      style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {ICal}
    </button>
  );
}

// share a routine as a .md file — native share sheet when the device supports
// sharing files (phones), else a plain download.
async function shareRoutine(r) {
  const md = routineToMd(r);
  const slug = r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'routine';
  const file = new File([md], `${slug}.ppw-routine.md`, { type: 'text/markdown' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: r.name, text: `PPW routine: ${r.name}` }); return; } catch { /* cancelled → fall through */ }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }));
  a.download = `${slug}.ppw-routine.md`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// Routine builder (Vic #5 + rework 2026-07-06, premium): name a routine, then
// ADD STACKS THE SAME WAY THE MAIN ＋ ADD WORKS — paste a share link, write an
// affirmation, or pull from your library — accumulating inside the named
// routine. Saved routines are applied to any day from the Calendar. Unlimited.
function RoutineBuilder({ query = '' }) {
  const S = useStore5();
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null); // Vic 1c — open + edit a saved routine
  const [name, setName] = React.useState('');
  const [items, setItems] = React.useState([]); // snapshots added so far
  const [panel, setPanel] = React.useState(null); // 'media' | 'protocol' | 'text' | null
  const [link, setLink] = React.useState('');
  const [noteText, setNoteText] = React.useState('');
  const count = items.length;
  const reset = () => { setOpen(false); setEditingId(null); setName(''); setItems([]); setPanel(null); setLink(''); setNoteText(''); };
  const openEdit = (r) => { setEditingId(r.id); setName(r.name); setItems(r.items.map((x) => ({ ...x }))); setPanel(null); setOpen(true); };
  const addLink = () => {
    const snap = itemFromUrl(link);
    if (!snap) return;
    setItems((xs) => [...xs, snap]); setLink('');
  };
  const addNoteItem = () => {
    const t = noteText.trim();
    if (!t) return;
    setItems((xs) => [...xs, { title: t, meta: 'Text · Still', kind: 'note', noteAnim: 'still', noteSpeed: 'med', noteDur: '5' }]);
    setNoteText('');
  };
  const addFromLibrary = (c) => { const { id, ...rest } = c; setItems((xs) => [...xs, { ...rest }]); };
  const addDoc = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const fileId = await saveFile(f);
    setItems((xs) => [...xs, { title: f.name, meta: 'Document', thumb: 'doc', kind: 'doc', fileId }]);
  };
  const saveIt = () => {
    if (!name.trim() || !count) return;
    if (editingId) updateRoutine(editingId, { name: name.trim(), items });
    else createRoutine(name, items);
    reset();
  };
  const IN = { height: 44, padding: '0 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 };
  const ADD = { height: 44, padding: '0 16px', flex: 'none', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 14, fontWeight: 600, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' };
  const LABEL = { marginTop: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
  return (
    <>
      {/* saved routines */}
      {S.routines.length > 0 && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {S.routines.filter((r) => !query || r.name.toLowerCase().includes(query)).map((r) => (
            // Vic 1c — tap the routine to open + edit it
            <div key={r.id} onClick={() => openEdit(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', cursor: 'pointer' }}>
              <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{r.name}</div>
                <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>{r.items.length} stack{r.items.length === 1 ? '' : 's'} · tap to open &amp; edit</div>
              </div>
              {/* Vic item 2 — schedule the whole routine onto a chosen day */}
              <button onClick={(e) => { e.stopPropagation(); openSchedule({ type: 'routine', id: r.id, name: r.name }); }} aria-label="Add routine to a day" title="Add to a day" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {ICal}
              </button>
              {/* Vic 2026-07-06 — share as a .md file others can import via ＋ Add */}
              <button onClick={(e) => { e.stopPropagation(); shareRoutine(r); }} aria-label="Share routine" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7" /><path d="M12 15V3M8 7l4-4 4 4" /></svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteRoutine(r.id); }} aria-label="Delete routine" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--hairline)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {/* create */}
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ marginTop: 16, width: '100%', height: 52, borderRadius: 18, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Create Routine</button>
      ) : (
        <div style={{ marginTop: 16, borderRadius: 24, padding: 16, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', animation: 'ppwRise .3s ease both' }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Routine name — e.g. Morning Reset" aria-label="Routine name" style={{ width: '100%', height: 46, padding: '0 14px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 }} />

          {/* stacks added so far */}
          {count > 0 && (
            <>
              <div style={LABEL}>In this routine ({count})</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, opacity: .8 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                    <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove from routine" style={{ width: 24, height: 24, flex: 'none', borderRadius: 999, border: 'none', background: 'rgba(0,0,0,.18)', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Vic 1 — same tile format as the main ＋ Add, minus Routines */}
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['media', 'Media'], ['protocol', 'Protocol'], ['text', 'Text']].map(([k, label]) => (
              <button key={k} onClick={() => setPanel(panel === k ? null : k)} style={{ height: 80, borderRadius: 20, border: `1px solid ${panel === k ? 'var(--acc-rim)' : 'var(--rim)'}`, background: panel === k ? 'var(--acc-surf)' : 'var(--surface)', boxShadow: 'var(--elev)', color: panel === k ? 'var(--acc-ink)' : 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {TILE_ICONS[k]}
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
              </button>
            ))}
            <label style={{ height: 80, borderRadius: 20, border: '1px solid var(--rim)', background: 'var(--surface)', boxShadow: 'var(--elev)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
              {TILE_ICONS.doc}
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Document</span>
              <input type="file" accept={DOC_ACCEPT} onChange={addDoc} style={{ display: 'none' }} />
            </label>
          </div>

          {/* contextual panel per tile */}
          {panel === 'media' && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, animation: 'ppwRise .25s ease both' }}>
              {S.mediaItems.map((c) => (
                <button key={c.id} onClick={() => addFromLibrary(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', color: 'var(--ink)', textAlign: 'left' }}>
                  <span style={{ width: 18, height: 18, flex: 'none', borderRadius: 999, border: '1.5px solid var(--accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, lineHeight: 1 }}>+</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                </button>
              ))}
              <div style={{ fontSize: 11, color: 'var(--dim)', textAlign: 'center' }}>…or paste any link below.</div>
            </div>
          )}
          {panel === 'protocol' && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, animation: 'ppwRise .25s ease both' }}>
              {S.protocols.length > 0 ? S.protocols.map((p) => (
                <button key={p.id} onClick={() => addFromLibrary(protocolToItem(p))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', color: 'var(--ink)', textAlign: 'left' }}>
                  <span style={{ width: 18, height: 18, flex: 'none', borderRadius: 999, border: '1.5px solid var(--accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, lineHeight: 1 }}>+</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
                </button>
              )) : (
                <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>
                  Your PPW protocols will appear here as they’re approved for the app.
                </div>
              )}
            </div>
          )}
          {panel === 'text' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, animation: 'ppwRise .25s ease both' }}>
              <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNoteItem(); }} placeholder="Write text to appear on screen…" aria-label="Text for this routine" style={{ flex: 1, minWidth: 0, ...IN }} />
              <button onClick={addNoteItem} disabled={!noteText.trim()} style={{ ...ADD, opacity: noteText.trim() ? 1 : .45 }}>Add</button>
            </div>
          )}

          {/* Custom apps — same as the main ＋ Add */}
          <div style={LABEL}>Custom apps</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 10 }}>
            <a href="https://www.youtube.com" target="_blank" rel="noopener noreferrer" style={{ height: 36, padding: '0 13px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>YouTube
            </a>
            <a href="https://open.spotify.com" target="_blank" rel="noopener noreferrer" style={{ height: 36, padding: '0 13px', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: 'var(--ink)', textDecoration: 'none' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V6l8-2v12" /><circle cx="7" cy="18" r="2.2" /><circle cx="15" cy="16" r="2.2" /></svg>Spotify
            </a>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }} placeholder="Paste a share link…" aria-label="Paste a share link for this routine" style={{ flex: 1, minWidth: 0, ...IN }} />
            <button onClick={addLink} disabled={!link.trim()} style={{ ...ADD, opacity: link.trim() ? 1 : .45 }}>Add</button>
          </div>

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={reset} style={{ height: 46, padding: '0 16px', borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5 }}>Cancel</button>
            <button onClick={saveIt} disabled={!name.trim() || !count} style={{ flex: 1, height: 46, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', opacity: (!name.trim() || !count) ? .45 : 1 }}>{editingId ? 'Save changes' : 'Save routine'}{count ? ` (${count})` : ''}</button>
          </div>
        </div>
      )}
    </>
  );
}

const PREM_PRICE = '$4.99';
const TABS = [
  { key: 'routines', label: 'Routines' },
  { key: 'media', label: 'Media' },
  { key: 'protocols', label: 'Protocols' },
  { key: 'supps', label: 'Supps' },
];

const IPlay = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>;

function MediaRow({ it }) {
  const bg = it.thumbUrl ? `url(${it.thumbUrl})` : (THUMBS[it.thumb] || THUMBS.au);
  const [added, setAdded] = React.useState(false);
  const add = (e) => { e.stopPropagation(); if (addToStack(it)) setAdded(true); };
  return (
    <div onClick={() => { if (it.embed || it.url) openPlayer(it); }} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', minHeight: 76, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', cursor: (it.embed || it.url) ? 'pointer' : 'default' }}>
      <div style={{ width: 56, height: 56, flex: 'none', borderRadius: 16, background: bg, backgroundSize: 'cover', backgroundPosition: 'center', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.92)' }}>{!it.thumbUrl && IPlay}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{it.title}</div>
        <div style={{ marginTop: 3, fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.meta}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 'none' }}>
        {/* calendar Add-to-Stack (item 2) — schedule onto a chosen day */}
        <AddToStackBtn onClick={() => openSchedule({ type: 'item', item: it })} />
        {/* quick add to today (existing tick) */}
        <button onClick={add} aria-label="Add to today's stack" title="Quick add to today" style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1.5px solid ${added ? 'var(--acc-rim)' : 'var(--rim)'}`, background: added ? 'var(--acc-surf)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)', padding: 0, transition: 'all .2s' }}>
          {added && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
        </button>
      </div>
    </div>
  );
}

// Protocol row — cleared PDF from the build-time bundle. Free protocols open for
// everyone (View → PDF, calendar disc → schedule onto a day). A `monetised`
// protocol (catalog register) is Premium-gated: for a non-Premium user the row
// shows a lock and both actions route to the upsell instead of opening. Premium
// members (and every free protocol) behave exactly as before.
function ProtocolRow({ p }) {
  const S = useStore5();
  const locked = p.register === 'monetised' && !S.premium;
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', minHeight: 76, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
      <div style={{ position: 'relative', width: 48, height: 48, flex: 'none', borderRadius: 14, background: 'var(--disc)', border: '1px solid var(--rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9.5 12h5M9.5 15.5h5" /></svg>
        {locked && (
          <span aria-hidden="true" style={{ position: 'absolute', right: -5, bottom: -5, width: 20, height: 20, borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--acc-glow)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{p.title}</div>
        <div style={{ marginTop: 3, fontSize: 13, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{locked ? 'Premium · ' : 'Protocol · '}{p.category || 'PPW'}</div>
      </div>
      {locked ? (
        <button onClick={() => setUpsell(PREMIUM_PROTOCOL_UPSELL)} aria-label={`Unlock ${p.title}`} title="Premium — unlock to open" style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
        </button>
      ) : (
        <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="View protocol" title="View" style={{ width: 40, height: 40, flex: 'none', borderRadius: 12, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
        </a>
      )}
      <AddToStackBtn onClick={() => locked ? setUpsell(PREMIUM_PROTOCOL_UPSELL) : openSchedule({ type: 'item', item: protocolToItem(p) })} />
    </div>
  );
}

export default function LibraryScreen() {
  const S = useStore5();
  React.useEffect(() => { loadProtocols(); }, []); // item 1 — pull the bundled manifest
  const idx = TABS.findIndex((t) => t.key === S.stackTab);
  const tabLeft = `calc(${idx < 0 ? 0 : idx} * 25% + 3px)`;
  // Vic #5 — search within whichever category is selected
  const [search, setSearch] = React.useState('');
  const query = search.trim().toLowerCase();
  const mediaFiltered = S.mediaItems.filter((it) => !query || it.title.toLowerCase().includes(query) || (it.meta || '').toLowerCase().includes(query));

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwScreenIn .38s cubic-bezier(.26,1,.4,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Library</h1>
      </div>
      <div style={{ marginTop: 5, fontSize: 14, color: 'var(--dim)' }}>Everything you can slot into a day.</div>

      {/* tab bar with gliding indicator */}
      <div style={{ position: 'relative', marginTop: 22, height: 48, borderRadius: 16, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', display: 'flex' }}>
        <div style={{ position: 'absolute', top: 4, bottom: 4, width: 'calc(25% - 5px)', left: tabLeft, borderRadius: 12, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', boxShadow: 'var(--acc-glow)', transition: 'left .38s cubic-bezier(.3,1.3,.4,1)' }} />
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ position: 'relative', flex: 1, background: 'none', border: 'none', fontSize: 12, fontWeight: 600, color: S.stackTab === t.key ? 'var(--acc-ink)' : 'var(--dim)', textShadow: 'var(--label-shadow)', transition: 'color .25s' }}>{t.label}</button>
        ))}
      </div>

      {/* Vic #5 — search the selected category */}
      <div style={{ position: 'relative', marginTop: 12 }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--dim)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${TABS[idx < 0 ? 0 : idx].label.toLowerCase()}…`} aria-label="Search library" style={{ width: '100%', height: 44, padding: '0 36px 0 38px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 }} />
        {search && (
          <button onClick={() => setSearch('')} aria-label="Clear search" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: 999, border: 'none', background: 'var(--disc)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        )}
      </div>

      {/* Routines — premium gated */}
      {S.stackTab === 'routines' && (
        !S.premium ? (
          <div style={{ position: 'relative', marginTop: 18, borderRadius: 24, overflow: 'hidden', padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            <div style={{ opacity: .5, pointerEvents: 'none' }}>
              <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--disc)', border: '1px solid var(--rim)', color: 'var(--ink)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
              </span>
              <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Routines</div>
              <p style={{ margin: '8px auto 0', maxWidth: 270, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Chain videos, audio and affirmations into one named stack.</p>
            </div>
            <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 13px', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', fontSize: 12, fontWeight: 700, boxShadow: 'var(--acc-glow)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.8 10H4.8L3 8z" /></svg>Premium · {PREM_PRICE}/mo
            </div>
            <button onClick={() => setUpsell('Routines let you chain many videos, audios and affirmations into one named stack that plays in order — with your own cover image.')} style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Unlock Routines</button>
          </div>
        ) : (
          <div style={{ position: 'relative', marginTop: 18, borderRadius: 24, overflow: 'hidden', padding: '22px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            <span style={{ display: 'inline-flex', width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', boxShadow: 'var(--acc-glow)' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
            </span>
            <div style={{ marginTop: 12, fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Routines</div>
            <p style={{ margin: '8px auto 0', maxWidth: 280, fontSize: 13, lineHeight: 1.55, color: 'var(--dim)', textShadow: 'var(--emboss)' }}>Bundle stacks into a named routine, then drop the whole thing onto any day from the Calendar.</p>
          </div>
        )
      )}
      {S.stackTab === 'routines' && S.premium && <RoutineBuilder query={query} />}

      {/* Media — list + add to stack */}
      {S.stackTab === 'media' && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mediaFiltered.map((it) => <MediaRow key={it.id} it={it} />)}
          {query && mediaFiltered.length === 0 && <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 13, color: 'var(--dim)' }}>Nothing matches “{search.trim()}”.</div>}
        </div>
      )}

      {/* Protocols — PPW protocol PDFs baked in at build time (item 1) */}
      {S.stackTab === 'protocols' && (() => {
        const protoFiltered = S.protocols.filter((p) => !query || p.title.toLowerCase().includes(query) || (p.tags || []).some((t) => t.toLowerCase().includes(query)));
        if (S.protocols.length > 0) {
          return (
            <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {protoFiltered.map((p) => <ProtocolRow key={p.id} p={p} />)}
              {query && protoFiltered.length === 0 && <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 13, color: 'var(--dim)' }}>Nothing matches “{search.trim()}”.</div>}
            </div>
          );
        }
        return (
          <div style={{ marginTop: 18, borderRadius: 24, padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>Protocols</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
              {S.protocolsStatus === 'error'
                ? 'Could not load the protocol library — check your connection and reopen.'
                : 'Your PPW protocols will appear here as they’re approved for the app. Each one opens as a PDF and can be added to any day.'}
            </div>
          </div>
        );
      })()}

      {/* Supps — affiliate multi-select + honest iHerb buy flow (item 4) */}
      {S.stackTab === 'supps' && <SuppsSection query={query} />}
    </div>
  );
}
