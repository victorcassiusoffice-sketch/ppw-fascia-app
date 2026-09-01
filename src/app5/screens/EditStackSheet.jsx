// EditStackSheet — "Edit this stack" bottom sheet (Vic 2026-08-31).
//
// The gap this closes: once a stack was added there was no way back into its
// settings. A note (Text) was the worst case — you could never change its
// message or its Still / Pulse / Scroll / Flash style, so a typo or the wrong
// animation meant deleting it and starting over. Every card now carries an edit
// (pencil) icon that opens this sheet with the stack's CURRENT settings already
// in place.
//
// Fully controlled from the store: it reads the live item on every render and
// writes each change straight through the existing setters (setItemTime,
// setRepeat, setNoTime, toggleAuto) plus updateItem for the note fields — so
// there is no local copy that can fall out of step with the card behind it.

import React from 'react';
import {
  useStore5, closeEditItem, updateItem, setItemTime, setRepeat, setNoTime,
  toggleAuto, deleteItem, noteAnimCss,
} from '../store5.js';

const NOTE_STYLES = [
  { key: 'still', label: 'Still' },
  { key: 'pulse', label: 'Pulse' },
  { key: 'marquee', label: 'Scroll' },
  { key: 'flash', label: 'Flash' },
];
const REPEAT_OPTS = [
  { key: 'daily', label: 'Every day' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'custom', label: 'Every few days' },
  { key: 'once', label: 'Just once' },
];

const SEG = { position: 'relative', height: 40, borderRadius: 12, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', display: 'flex' };
const segBtn = (active) => ({ position: 'relative', flex: 1, background: active ? 'var(--acc-surf)' : 'none', borderRadius: 9, margin: 3, border: active ? '1px solid var(--acc-rim)' : 'none', fontSize: 11, fontWeight: 600, color: active ? 'var(--acc-ink)' : 'var(--dim)' });
const INPUT = { width: '100%', height: 46, padding: '0 14px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 14 };
const LABEL = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };

const capitalise = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
// a repeat value like "3" means "every 3 days" — mirrors RepeatSheet.
const isCustomVal = (r) => { const n = parseInt(r, 10); return String(n) === String(r) && n > 1; };

export default function EditStackSheet() {
  const S = useStore5();
  const it = S.editId ? S.deckItems.find((x) => x.id === S.editId) : null;
  if (!it) return null;

  const isNote = it.kind === 'note';
  const hasUrl = !!(it.url || it.embed);
  const anim = it.noteAnim || 'still';
  const speed = it.noteSpeed || 'med';
  const dur = it.noteDur || '5';

  const cur = it.repeat === undefined ? 'daily' : it.repeat;
  const custom = isCustomVal(cur);
  const n = custom ? parseInt(cur, 10) : 3;
  const repeatKey = cur === 'daily' ? 'daily' : cur === 'weekly' ? 'weekly' : cur === 'once' ? 'once' : (custom ? 'custom' : 'daily');

  // Keep meta in step with the style exactly as addNote() writes it, so an edited
  // note is indistinguishable from a freshly added one ("Text · Still" etc.).
  const setAnim = (a) => updateItem(it.id, { noteAnim: a, meta: 'Text · ' + capitalise(a) });
  const pickRepeat = (key) => setRepeat(it.id, key === 'custom' ? String(n) : key);
  const bump = (d) => setRepeat(it.id, String(Math.min(14, Math.max(2, n + d))));
  const del = () => { deleteItem(it.id); closeEditItem(); };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 36 }}>
      <div onClick={closeEditItem} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', maxHeight: 'calc(100% - 130px)', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', transformOrigin: '50% 105%', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Edit stack</div>
            <div style={{ marginTop: 3, fontSize: 19, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{isNote ? 'Text' : (it.title || 'Stack')}</div>
          </div>
          <button onClick={closeEditItem} aria-label="Close" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        {/* ── the words: message for a note, name for anything else ── */}
        <div style={{ marginTop: 16 }}>
          <div style={LABEL}>{isNote ? 'Message' : 'Name'}</div>
          <input
            value={it.title || ''}
            onChange={(e) => updateItem(it.id, { title: e.target.value })}
            placeholder={isNote ? 'Write text to appear on screen…' : 'Name this stack…'}
            aria-label={isNote ? 'Text content' : 'Stack name'}
            style={{ ...INPUT, marginTop: 8 }}
          />
        </div>

        {/* ── note style + speed + live preview + duration ── */}
        {isNote && (
          <>
            <div style={{ marginTop: 16, ...LABEL }}>Style</div>
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 7 }}>
              {NOTE_STYLES.map((ns) => (
                <button key={ns.key} onClick={() => setAnim(ns.key)} style={{ height: 40, borderRadius: 12, border: `1px solid ${anim === ns.key ? 'var(--acc-rim)' : 'var(--rim)'}`, background: anim === ns.key ? 'var(--acc-surf)' : 'transparent', color: anim === ns.key ? 'var(--acc-ink)' : 'var(--dim)', fontSize: 11, fontWeight: 600, textShadow: 'var(--label-shadow)' }}>{ns.label}</button>
              ))}
            </div>

            {anim !== 'still' && (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                <div style={{ ...LABEL, flex: 'none' }}>Speed</div>
                <div style={{ ...SEG, flex: 1, maxWidth: 200 }}>
                  {['slow', 'med', 'fast'].map((sp) => (
                    <button key={sp} onClick={() => updateItem(it.id, { noteSpeed: sp })} style={segBtn(speed === sp)}>{sp === 'med' ? 'Med' : capitalise(sp)}</button>
                  ))}
                </div>
              </div>
            )}

            {/* live preview — the same animation the full-screen popup will play */}
            <div style={{ marginTop: 14, borderRadius: 16, padding: '18px 16px', background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', overflow: 'hidden', textAlign: 'center' }}>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                <div style={{ display: 'inline-block', fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink)', textShadow: 'var(--emboss)', whiteSpace: anim === 'marquee' ? 'nowrap' : 'normal', animation: noteAnimCss(anim, speed) }}>
                  {it.title || 'Your text'}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={LABEL}>Stays for</div>
              <div style={{ ...SEG, marginTop: 8, height: 42 }}>
                {[['5', '5s'], ['15', '15s'], ['stay', 'Until off']].map(([v, l]) => (
                  <button key={v} onClick={() => updateItem(it.id, { noteDur: v })} style={segBtn(dur === v)}>{l}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── autoplay (media / link items only) ── */}
        {hasUrl && (
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Play by itself</div>
              <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>Opens on its own at its time</div>
            </div>
            <button onClick={() => toggleAuto(it.id)} role="switch" aria-checked={!!it.auto} aria-label="Toggle autoplay" style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${it.auto ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: it.auto ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', transition: 'background .3s' }}>
              <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${it.auto ? 26 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
            </button>
          </div>
        )}

        {/* ── time + no-fixed-time ── */}
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 'none' }}>
            <div style={LABEL}>Time</div>
            {it.time ? (
              <input type="time" value={it.time} onChange={(e) => setItemTime(it.id, e.target.value)} aria-label="Stack time" style={{ marginTop: 8, height: 42, padding: '0 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 17, fontWeight: 600 }} />
            ) : (
              <div style={{ marginTop: 8, height: 42, display: 'flex', alignItems: 'center', fontSize: 12.5, color: 'var(--accent)', fontWeight: 700 }}>Next Up · anytime</div>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>No fixed time</div>
              <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>Sits at the top as Next Up</div>
            </div>
            <button onClick={() => setNoTime(it.id, !!it.time)} role="switch" aria-checked={!it.time} aria-label="Toggle no fixed time" style={{ position: 'relative', width: 60, height: 34, flex: 'none', borderRadius: 999, border: `1px solid ${!it.time ? 'var(--acc-rim)' : 'var(--hairline)'}`, background: !it.time ? 'var(--acc-surf)' : 'var(--track)', boxShadow: 'var(--inset)', transition: 'background .3s' }}>
              <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: 999, background: 'var(--thumb)', border: '1px solid var(--rim)', boxShadow: '0 3px 8px rgba(40,50,70,.25)', transform: `translateX(${!it.time ? 26 : 0}px)`, transition: 'transform .38s cubic-bezier(.3,1.3,.4,1)' }} />
            </button>
          </div>
        </div>

        {/* ── repeat ── */}
        <div style={{ marginTop: 16, ...LABEL }}>Repeat</div>
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {REPEAT_OPTS.map((o) => {
            const active = repeatKey === o.key;
            return (
              <button key={o.key} onClick={() => pickRepeat(o.key)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48, padding: '0 16px', borderRadius: 14, border: `1px solid ${active ? 'var(--acc-rim)' : 'var(--rim)'}`, background: active ? 'var(--acc-surf)' : 'var(--surface)', color: active ? 'var(--acc-ink)' : 'var(--ink)', fontSize: 14, fontWeight: 600, textShadow: 'var(--label-shadow)' }}>{o.label}</button>
            );
          })}
        </div>
        {repeatKey === 'custom' && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>Repeat every</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => bump(-1)} aria-label="Fewer days" style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
              <div style={{ fontSize: 20, fontWeight: 600, minWidth: 74, textAlign: 'center', textShadow: 'var(--emboss)' }}>{n} days</div>
              <button onClick={() => bump(1)} aria-label="More days" style={{ width: 42, height: 42, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
            </div>
          </div>
        )}

        {/* ── delete + done ── */}
        <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
          <button onClick={del} aria-label="Delete this stack" style={{ height: 50, width: 54, flex: 'none', borderRadius: 16, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 4h4M6.5 7l1 13h9l1-13M10 11v6M14 11v6" /></svg>
          </button>
          <button onClick={closeEditItem} style={{ flex: 1, height: 50, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
