// LibraryScreen — New Design "Library" (tabbed content library, focused port).
//
// Ported now: the 4-tab gliding segmented control (Routines/Media/Protocols/
// Supps), the Routines Premium gate (upsell vs "you're Premium"), and the Media
// tab (list of media items, tick to add into today's stack). Protocols/Supps
// tabs show a faithful empty state until their content sources are ported.

import React from 'react';
import { THUMBS } from '../theme5.js';
import { useStore5, setTab, addToStack, setUpsell, openPlayer, createRoutine, deleteRoutine, routineToMd, itemFromUrl } from '../store5.js';

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
function RoutineBuilder() {
  const S = useStore5();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [items, setItems] = React.useState([]); // snapshots added so far
  const [link, setLink] = React.useState('');
  const [noteText, setNoteText] = React.useState('');
  const count = items.length;
  const reset = () => { setOpen(false); setName(''); setItems([]); setLink(''); setNoteText(''); };
  const addLink = () => {
    const snap = itemFromUrl(link);
    if (!snap) return;
    setItems((xs) => [...xs, snap]); setLink('');
  };
  const addNoteItem = () => {
    const t = noteText.trim();
    if (!t) return;
    setItems((xs) => [...xs, { title: t, meta: 'Affirmation · Still', kind: 'note', noteAnim: 'still', noteSpeed: 'med', noteDur: '5' }]);
    setNoteText('');
  };
  const addFromLibrary = (c) => { const { id, ...rest } = c; setItems((xs) => [...xs, { ...rest }]); };
  const saveIt = () => {
    if (!name.trim() || !count) return;
    createRoutine(name, items);
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
          {S.routines.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
              <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{r.name}</div>
                <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>{r.items.length} stack{r.items.length === 1 ? '' : 's'} · add it to a day from the Calendar</div>
              </div>
              {/* Vic 2026-07-06 — share as a .md file others can import via ＋ Add */}
              <button onClick={() => shareRoutine(r)} aria-label="Share routine" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7" /><path d="M12 15V3M8 7l4-4 4 4" /></svg>
              </button>
              <button onClick={() => deleteRoutine(r.id)} aria-label="Delete routine" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--hairline)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

          {/* add a link — same as the main ＋ Add paste flow */}
          <div style={LABEL}>Add a link</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }} placeholder="Paste a YouTube / Spotify / share link…" aria-label="Paste a share link for this routine" style={{ flex: 1, minWidth: 0, ...IN }} />
            <button onClick={addLink} disabled={!link.trim()} style={{ ...ADD, opacity: link.trim() ? 1 : .45 }}>Add</button>
          </div>

          {/* add an affirmation */}
          <div style={LABEL}>Add an affirmation</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addNoteItem(); }} placeholder="Write an affirmation…" aria-label="Affirmation for this routine" style={{ flex: 1, minWidth: 0, ...IN }} />
            <button onClick={addNoteItem} disabled={!noteText.trim()} style={{ ...ADD, opacity: noteText.trim() ? 1 : .45 }}>Add</button>
          </div>

          {/* pull from your library */}
          {S.mediaItems.length > 0 && (
            <>
              <div style={LABEL}>From your library</div>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {S.mediaItems.map((c) => (
                  <button key={c.id} onClick={() => addFromLibrary(c)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', color: 'var(--ink)', textAlign: 'left' }}>
                    <span style={{ width: 18, height: 18, flex: 'none', borderRadius: 999, border: '1.5px solid var(--accent)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, lineHeight: 1 }}>+</span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
            <button onClick={reset} style={{ height: 46, padding: '0 16px', borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5 }}>Cancel</button>
            <button onClick={saveIt} disabled={!name.trim() || !count} style={{ flex: 1, height: 46, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', opacity: (!name.trim() || !count) ? .45 : 1 }}>Save routine{count ? ` (${count})` : ''}</button>
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
      <button onClick={add} aria-label="Add to today's stack" style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1.5px solid ${added ? 'var(--acc-rim)' : 'var(--rim)'}`, background: added ? 'var(--acc-surf)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)', padding: 0, transition: 'all .2s' }}>
        {added && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
      </button>
    </div>
  );
}

export default function LibraryScreen() {
  const S = useStore5();
  const idx = TABS.findIndex((t) => t.key === S.stackTab);
  const tabLeft = `calc(${idx < 0 ? 0 : idx} * 25% + 3px)`;

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
      {S.stackTab === 'routines' && S.premium && <RoutineBuilder />}

      {/* Media — list + add to stack */}
      {S.stackTab === 'media' && (
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {S.mediaItems.map((it) => <MediaRow key={it.id} it={it} />)}
        </div>
      )}

      {/* Protocols / Supps — faithful empty states until their sources are ported */}
      {(S.stackTab === 'protocols' || S.stackTab === 'supps') && (
        <div style={{ marginTop: 18, borderRadius: 24, padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>{S.stackTab === 'protocols' ? 'Protocols' : 'Supplements'}</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>This library is being wired up in the New Design build.</div>
        </div>
      )}
    </div>
  );
}
