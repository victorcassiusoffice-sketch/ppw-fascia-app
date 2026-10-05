// LibraryScreen — New Design "Library" (tabbed content library, focused port).
//
// Ported now: the 4-tab gliding segmented control (Routines/Media/Protocols/
// Supps), the Routines Premium gate (upsell vs "you're Premium"), and the Media
// tab (list of media items, tick to add into today's stack). Protocols/Supps
// tabs show a faithful empty state until their content sources are ported.

import React from 'react';
import { THUMBS } from '../theme5.js';
import { useStore5, getState, setTab, addToStack, setUpsell, openPlayer, createRoutine, deleteRoutine, updateRoutine, routineItemsForSave, routineToMd, routineToLink, itemFromUrl, openSchedule, loadProtocols, markLibSeen, repeatLabel, normOffset, SHARE_MAX_OFFSET, PREMIUM_PROTOCOL_UPSELL } from '../store5.js';
import { TILE_ICONS, DOC_ACCEPT } from './AddSheet.jsx';
import { RepeatChoices } from './RepeatSheet.jsx';
import { saveFile } from '../files5.js';
import { protocolToItem } from '../protocols5.js';
import SuppsSection from './SuppsSection.jsx';
import { PREM_PRICE } from '../membership.js';

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

// Quick-add feedback. Tapping the tick used to do its work in silence — the only
// sign anything happened was a 24px outline filling in, on a screen that is not
// the stack the item just landed in. There is no shared toast anywhere in the
// app, so the Library carries its own: a pill above the nav dock, inside the
// phone frame, gone in two seconds. Context rather than props because the rows
// that fire it sit well below this screen's root.
const ToastCtx = React.createContext(() => {});
const QUICK_ADD_TOAST = 'Added to today, 9:00.';
// Motion is decoration on the toast — the words are the message, so a user who
// has asked for less movement still gets the words, just without the rise.
function reducedMotion() {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { return false; }
}

// ── sharing a routine (link-first since 2026-10-05) ──
// A .md attachment tapped in WhatsApp cannot open this app on any phone: the
// manifest declares no `file_handlers` and no `share_target`, iOS gives a web
// app no way to claim a document type at all, and Chromium's file handling is
// desktop-and-installed-only. So the thing a client taps is now a LINK whose
// whole payload is the programme (routineToLink → `/#r=…`), and the file rail
// below is kept for the two cases a link cannot serve: a programme too long for
// one URL, and a device with no navigator.share at all.
const LINK_COPIED_TOAST = 'Link copied — paste it into WhatsApp.';
const TOO_LONG_TOAST = 'This programme is too long for a link — sharing it as a file instead.';

// share a routine as a .md file — native share sheet when the device supports
// sharing files (phones), else a plain download. The oversize fallback and the
// desktop path; unchanged behaviour, lifted into its own function so the link
// path can fall into it.
async function shareRoutineAsFile(r) {
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

/**
 * Send a routine. A link by default, a file only when the programme will not
 * fit in one.
 * → null when it is on its way (shared, or on the clipboard, or handed over as
 *   a file), or the url itself when every delivery route failed, so the caller
 *   can put it on screen rather than leave a tap with no outcome.
 */
async function shareRoutine(r, flash = () => {}) {
  const url = routineToLink(r);
  // null means over LINK_MAX_URL. Never a truncated link: half a payload
  // decodes to nothing on the far end, and the recipient has no way to tell
  // that from a broken app.
  if (!url) { flash(TOO_LONG_TOAST); await shareRoutineAsFile(r); return null; }
  if (navigator.share) {
    // Web Share Level 1 (title/text/url), not the Level 2 `{files}` call this
    // used to make: a url is the thing a messenger renders as a tappable link.
    try { await navigator.share({ title: r.name, text: `PPW routine: ${r.name}`, url }); return null; }
    catch { /* cancelled, or the sheet refused — the clipboard is still a whole path */ }
  }
  try { await navigator.clipboard.writeText(url); flash(LINK_COPIED_TOAST); return null; }
  catch { return url; }
}

// Routine builder (Vic #5 + rework 2026-07-06, premium): name a routine, then
// ADD STACKS THE SAME WAY THE MAIN ＋ ADD WORKS — paste a share link, write an
// affirmation, or pull from your library — accumulating inside the named
// routine. Saved routines are applied to any day from the Calendar. Unlimited.
function RoutineBuilder({ query = '' }) {
  const S = useStore5();
  const flash = React.useContext(ToastCtx);
  // The last resort of the send path: a link that could not be shared and could
  // not be copied is shown here, selectable, so the tap still ends somewhere.
  const [shareFallback, setShareFallback] = React.useState(null); // { id, url } | null
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState(null); // Vic 1c — open + edit a saved routine
  const [name, setName] = React.useState('');
  const [items, setItems] = React.useState([]); // snapshots added so far
  const [panel, setPanel] = React.useState(null); // 'media' | 'protocol' | 'text' | null
  const [link, setLink] = React.useState('');
  const [noteText, setNoteText] = React.useState('');
  // WHICH STAGED ROW HAS ITS SCHEDULE OPEN (2026-10-05, review pass) — index, or
  // null for none. Progressive disclosure: the two schedule controls live behind
  // a tap on the row rather than always-on, because this list already carries a
  // title, a meta line and a remove control per row and has to stay legible at
  // 390px. One row at a time, so the day field and the repeat options on screen
  // are never ambiguous.
  const [schedFor, setSchedFor] = React.useState(null);
  const count = items.length;
  const reset = () => { setOpen(false); setEditingId(null); setName(''); setItems([]); setPanel(null); setLink(''); setNoteText(''); setSchedFor(null); };
  const openEdit = (r) => { setEditingId(r.id); setName(r.name); setItems(r.items.map((x) => ({ ...x }))); setPanel(null); setSchedFor(null); setOpen(true); };
  // One staged item, patched in place. `dayOffset` is the public key and `_day`
  // the in-flight parsed one (store5's naming law): openEdit can load a routine
  // saved before that law, so setting a day clears `_day` rather than leaving
  // two numbers on the item for a later reader to choose between.
  const patchItem = (i, patch) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setDay = (i, v) => patchItem(i, { dayOffset: normOffset(v, SHARE_MAX_OFFSET), _day: undefined });
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
    // routineItemsForSave: openEdit copies a SAVED routine's items into the
    // builder, so an older routine written before the naming law can still be
    // carrying `_day`. Normalising on every save is what retires it from disk.
    if (editingId) updateRoutine(editingId, { name: name.trim(), items: routineItemsForSave(items) });
    else createRoutine(name, routineItemsForSave(items));
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
            <React.Fragment key={r.id}>
            {/* Vic 1c — tap the routine to open + edit it */}
            <div onClick={() => openEdit(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', cursor: 'pointer' }}>
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
              {/* Vic 2026-07-06, link-first 2026-10-05 — send it as a link that
                  opens straight in the recipient's app; a file only when the
                  programme is too long for one URL. */}
              <button onClick={async (e) => {
                e.stopPropagation();
                setShareFallback(null);
                const undelivered = await shareRoutine(r, flash);
                if (undelivered) setShareFallback({ id: r.id, url: undelivered });
              }} aria-label="Share routine" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-7" /><path d="M12 15V3M8 7l4-4 4 4" /></svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); deleteRoutine(r.id); }} aria-label="Delete routine" style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, border: '1px solid var(--hairline)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13" /></svg>
              </button>
            </div>
            {/* Share sheet refused AND the clipboard refused — the link itself,
                selectable, so the tap is never a dead end. stopPropagation
                because the row above opens the editor on click. */}
            {shareFallback && shareFallback.id === r.id && (
              <div onClick={(e) => e.stopPropagation()} style={{ padding: '0 4px' }}>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>Copy this link and paste it into your message.</div>
                <input readOnly value={shareFallback.url} aria-label="Routine share link" onFocus={(e) => e.target.select()} style={{ marginTop: 6, width: '100%', ...IN, fontSize: 12 }} />
              </div>
            )}
            </React.Fragment>
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
                {items.map((it, i) => {
                  // Either name in, one number out — a staged item can be fresh
                  // from a tile (`dayOffset`) or copied out of a saved routine
                  // written before the naming law (`_day`).
                  const day = normOffset(it.dayOffset ?? it._day ?? 0, SHARE_MAX_OFFSET);
                  const openSched = schedFor === i;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, opacity: .8 }}>{i + 1}</span>
                        {/* The row IS the disclosure control — tap it for the day
                            and the repeat. */}
                        <button onClick={() => setSchedFor(openSched ? null : i)} aria-label={'Schedule for ' + it.title} aria-expanded={openSched}
                          style={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', minHeight: 36, padding: '2px 0', background: 'none', border: 'none', color: 'inherit' }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</span>
                          {/* SAID THE WAY THE RECIPIENT WILL BE SHOWN IT: the
                              receive sheet prints `repeatLabel(repeat || 'once')`
                              and " · from day N", because an absent repeat is
                              read as 'once' by both import paths. Defaulting to
                              'daily' here — which is the STACK screen's rule —
                              would promise the practitioner a recurrence the
                              client never gets. */}
                          <span style={{ display: 'block', marginTop: 1, fontSize: 11, fontWeight: 600, opacity: .82, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            Day {day} · {repeatLabel(it.repeat || 'once')}
                          </span>
                        </button>
                        <button onClick={() => { setItems((xs) => xs.filter((_, j) => j !== i)); setSchedFor(null); }} aria-label="Remove from routine" style={{ width: 24, height: 24, flex: 'none', borderRadius: 999, border: 'none', background: 'rgba(0,0,0,.18)', color: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </div>
                      {/* THE TWO THINGS THE WIRE FORMAT CARRIES AND THE BUILDER
                          COULD NOT SET (2026-10-05, review pass). `repeat` and
                          `dayOffset` are transmitted by linkItem, written by
                          mdItem and printed on the recipient's sheet — but there
                          was no control for either here, so every routine built
                          in the app went out as a flat list of day-0 one-offs
                          and a six-week prescription could only be authored by
                          hand-writing a ```ppw-routine``` block. Both flow
                          straight through routineItemsForSave → linkItem with no
                          codec change. */}
                      {openSched && (
                        <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--surface)', color: 'var(--ink)', animation: 'ppwRise .25s ease both' }}>
                          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>Starts on day</div>
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => setDay(i, day - 1)} disabled={day <= 0} aria-label="Earlier day" style={{ width: 44, height: 44, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 19, opacity: day <= 0 ? .4 : 1 }}>−</button>
                            {/* A number field as well as the steppers: week 6 is
                                day 35, and nobody taps + thirty-five times. */}
                            <input type="number" inputMode="numeric" min={0} max={SHARE_MAX_OFFSET} value={day} onChange={(e) => setDay(i, e.target.value)} aria-label="Starts on day"
                              style={{ flex: 1, minWidth: 0, ...IN, textAlign: 'center', fontSize: 15, fontWeight: 600 }} />
                            <button onClick={() => setDay(i, day + 1)} disabled={day >= SHARE_MAX_OFFSET} aria-label="Later day" style={{ width: 44, height: 44, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 19, opacity: day >= SHARE_MAX_OFFSET ? .4 : 1 }}>+</button>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.45, color: 'var(--dim)' }}>
                            Day 0 is the day they start. A shared programme reaches day {SHARE_MAX_OFFSET}.
                          </div>
                          {/* RepeatSheet's own chooser, not a second one — see
                              the note on RepeatChoices. */}
                          <RepeatChoices value={it.repeat || 'once'} onChange={(v) => patchItem(i, { repeat: v })} />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
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
                  Protocols land here as they are ready.
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
  const flash = React.useContext(ToastCtx);
  const add = (e) => { e.stopPropagation(); if (addToStack(it)) { setAdded(true); flash(QUICK_ADD_TOAST); } };
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
  const [added, setAdded] = React.useState(false);
  const flash = React.useContext(ToastCtx);
  // Protocols now get the same one-tap add as media. Until this, the only way to
  // put a protocol into today was the day picker — three taps to do the thing
  // most people want first, which is simply "put it on today".
  const quickAdd = (e) => {
    e.stopPropagation();
    if (locked) { setUpsell(PREMIUM_PROTOCOL_UPSELL); return; }
    if (addToStack(protocolToItem(p))) { setAdded(true); flash(QUICK_ADD_TOAST); }
  };
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 'none' }}>
        {/* calendar Add-to-Stack — schedule onto a chosen day */}
        <AddToStackBtn onClick={() => locked ? setUpsell(PREMIUM_PROTOCOL_UPSELL) : openSchedule({ type: 'item', item: protocolToItem(p) })} />
        {/* quick add to today — same tick, same meaning, as a media row. On a
            monetised protocol a free user's tap can only ever reach the upsell,
            so the control has to say that before it is tapped, not after: a
            padlock where the tick would be, and the same words the View button
            already uses. The paywall itself is unchanged. */}
        <button data-tour="protocol-add" onClick={quickAdd} aria-label={locked ? `Unlock ${p.title} to add it to today` : "Add to today's stack"} title={locked ? 'Premium — unlock to add it' : 'Quick add to today'} style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1.5px solid ${added ? 'var(--acc-rim)' : 'var(--rim)'}`, background: added ? 'var(--acc-surf)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: locked ? 'var(--dim)' : 'var(--acc-ink)', padding: 0, transition: 'all .2s' }}>
          {locked
            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>
            : added && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
        </button>
      </div>
    </div>
  );
}

// First impression. A free user opening the Library landed on Routines, which
// for them is a locked card — a paywall as the first thing the shelf ever showed
// them. This has to be the DEFAULT rather than a one-off welcome: nothing
// persists `stackTab`, so every launch starts on 'routines' again, and hanging
// the correction on "have they been here before" put the paywall straight back
// from the second session onward.
//
// So the default is corrected here, at import — App5 pulls this screen in at
// boot, before anything renders and before the user has had a chance to ask for
// anything. That is also what makes the rest honest: from this moment on, a
// `stackTab` of 'routines' can only be something the user actually asked for —
// the Routine tile in ＋ Add, or the tab bar below — and that request now always
// wins, because nothing overrides the tab on entry any more.
//
// `premium` here is the cached entitlement the store boots with, so a Premium
// member whose cache is cold lands on Media for one launch and taps back.
{
  const boot = getState();
  if (boot.stackTab === 'routines' && !boot.premium) setTab('media');
}

export default function LibraryScreen() {
  const S = useStore5();
  React.useEffect(() => { loadProtocols(); }, []); // item 1 — pull the bundled manifest

  // `ppw5.libSeen` records that this device has met the Library. It no longer
  // decides which tab you land on — that gate is what made the media-first fix
  // last exactly one session — and nothing else reads it yet. It is kept
  // because "has this person ever seen the Library" is a fact worth having, and
  // it costs one key.
  React.useEffect(() => { markLibSeen(); }, []);

  // The Library's own toast (see ToastCtx above). It carries a sequence number
  // as well as its words: every quick-add says the same sentence, so without one
  // React sees an identical node, leaves the mounted pill exactly where it is,
  // and the second add neither replays the rise nor gives aria-live anything new
  // to announce — as silent as it was before the toast existed.
  const [toast, setToast] = React.useState(null); // { text, n } | null
  const toastTimer = React.useRef(null);
  const toastSeq = React.useRef(0);
  const flash = React.useCallback((text) => {
    toastSeq.current += 1;
    setToast({ text, n: toastSeq.current });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  }, []);
  React.useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const idx = TABS.findIndex((t) => t.key === S.stackTab);
  const tabLeft = `calc(${idx < 0 ? 0 : idx} * 25% + 3px)`;
  // Vic #5 — search within whichever category is selected
  const [search, setSearch] = React.useState('');
  const query = search.trim().toLowerCase();
  const mediaFiltered = S.mediaItems.filter((it) => !query || it.title.toLowerCase().includes(query) || (it.meta || '').toLowerCase().includes(query));

  return (
    <ToastCtx.Provider value={flash}>
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '28px 20px 140px', animation: 'ppwScreenIn .38s cubic-bezier(.26,1,.4,1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Library</h1>
      </div>
      <div style={{ marginTop: 5, fontSize: 14, color: 'var(--dim)' }}>Everything you can slot into a day.</div>

      {/* tab bar with gliding indicator */}
      <div data-tour="lib-tabs" style={{ position: 'relative', marginTop: 22, height: 48, borderRadius: 16, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', display: 'flex' }}>
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
            <button data-tour="routines-lock" onClick={() => setUpsell('Routines let you chain many videos, audios and affirmations into one named stack that plays in order — with your own cover image.')} style={{ marginTop: 16, width: '100%', height: 50, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Unlock Routines</button>
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
              {/* One protocol on the shelf looks like a mistake unless we say
                  otherwise. Honest about the shelf being short, and about the
                  one that is there being free. */}
              {!query && <div style={{ padding: '4px 4px 0', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>More protocols are on the way. Myofascial Recovery is free while you wait.</div>}
            </div>
          );
        }
        return (
          <div style={{ marginTop: 18, borderRadius: 24, padding: '24px 20px', textAlign: 'center', background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', textShadow: 'var(--emboss)' }}>Protocols</div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
              {/* This block only renders when the shelf is genuinely empty, so it
                  cannot name the free protocol. It also no longer explains our
                  internal approval queue to someone who does not work here. */}
              {S.protocolsStatus === 'error'
                ? 'Could not load the protocol library — check your connection and reopen.'
                : 'Protocols land here as they are ready.'}
            </div>
          </div>
        );
      })()}

      {/* Supps — affiliate multi-select + honest iHerb buy flow (item 4) */}
      {S.stackTab === 'supps' && <SuppsSection query={query} />}
    </div>
    {/* Sibling of the scrolling screen, not a child of it: a child would scroll
        away with the list. Sits above the nav dock (z20), under every sheet. */}
    {toast && (
      <div key={toast.n} role="status" aria-live="polite" style={{ position: 'absolute', left: 20, right: 20, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', zIndex: 21, padding: '13px 16px', borderRadius: 999, textAlign: 'center', background: 'var(--surface-strong)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, pointerEvents: 'none', animation: reducedMotion() ? 'none' : 'ppwRise .3s ease both' }}>{toast.text}</div>
    )}
    </ToastCtx.Provider>
  );
}
