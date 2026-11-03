// StudioSheet — the therapist's studio (2026-11-03, Victor's "lifestyle option 1").
//
// WHO IT IS FOR. A practitioner whose account holds the yearly PPW licence
// (`entitlement: 'practitioner'` from /api/me/entitlement — membership.js,
// cachedPractitioner). They build a routine in the ordinary Routines builder,
// then come here to put their NAME on it, say what it is FOR, give it a VERSION,
// and hand it to a client three ways: copy the link, show a QR code, print a card.
//
// WHO IT IS NOT FOR, and how that is held. The sheet renders NOTHING unless the
// store says `practitioner` — not for a signed-out visitor, not for a client
// account, not in the demo — and store5's openStudio() refuses to set
// `studioOpen` for anyone else, so there is no state a non-licensed account can
// reach that paints this layer. The Library only offers the Studio button to a
// practitioner; the two checks together are the gate (studio.test.jsx).
//
// WHAT IT NEVER DOES. Sell anything. There is no price here, nowhere to pay, and
// no mention of a store: the app is free and public, the practitioner sells the
// routine outside it (cash, their own invoice), and PPW's licence fee is a web
// invoice that never touches this screen. The client who scans the card pays
// nothing to PPW.
//
// THE QR. `uqr` 0.1.3 (the same library Tenant Folder MU uses), rendered as an
// inline SVG string — no QR web service, so the programme in the link never
// leaves this device to be drawn. The link is base64url, which is QR byte mode,
// and a QR code holds at most ~2,950 bytes at ECC L, so a long programme is
// refused for the QR and offered as the link instead. Never truncated.
//
// z38: above the stack-config sheets (30-36), below the account sheet (42) and
// the shared-routine sheet (45), so a sign-in or an incoming programme always
// lands on top of it.

import React from 'react';
import { renderSVG } from 'uqr';
import {
  useStore5, closeStudio, studioName, setStudioName, updateRoutine, routineToLink,
  routineMeta, STUDIO_MAX_NAME, ROUTINE_MAX_GOAL,
} from '../store5.js';
import { readEmail } from '../membership.js';

/** The longest link a printable QR will take (ECC L, byte mode, version 40). */
export const QR_MAX_CHARS = 2900;

const IN = { width: '100%', height: 46, padding: '0 14px', boxSizing: 'border-box', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 15 };
const LABEL = { display: 'block', marginTop: 14, fontSize: 10.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--dim)' };
const btnPrimary = { width: '100%', minHeight: 48, borderRadius: 15, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' };
const btnQuiet = { flex: 1, minHeight: 44, borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 13.5 };
const btnPlain = { minHeight: 44, padding: '0 14px', borderRadius: 14, border: 'none', background: 'none', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5 };

/** The SVG for a link, or null when the link will not fit a QR code. */
export function qrSvgFor(link) {
  if (!link || link.length > QR_MAX_CHARS) return null;
  try { return renderSVG(link, { ecc: 'L', border: 2, pixelSize: 4 }); } catch { return null; }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * The printable card, as a complete HTML page. Plain and black-on-white on
 * purpose: it is for a printer, and it is the one thing from this app that
 * leaves the phone on paper. Nothing on it is a price.
 */
export function cardHtml({ practitioner, routine, link, svg }) {
  const items = Array.isArray(routine.items) ? routine.items : [];
  const meta = routineMeta(routine);
  const rows = items.slice(0, 12).map((it) => `<li>${escapeHtml(it.title)}${it.time ? ` · ${escapeHtml(it.time)}` : ''}</li>`).join('');
  const more = items.length > 12 ? `<li>… and ${items.length - 12} more</li>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(routine.name)} — routine card</title>
<style>
  @page { margin: 14mm; }
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; margin: 0; padding: 24px; }
  .card { max-width: 560px; margin: 0 auto; border: 1px solid #222; border-radius: 18px; padding: 24px 26px; }
  h1 { margin: 0; font-size: 24px; letter-spacing: -.01em; }
  .from { margin: 6px 0 0; font-size: 14px; color: #333; }
  .for { margin: 14px 0 0; font-size: 15px; }
  /* 300px = ~79 mm on paper. A routine whose steps carry video links makes a
     dense code (version 25-30), and a phone camera wants its modules at
     0.5 mm or more. */
  .qr { margin: 18px auto 0; width: 300px; height: 300px; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .how { margin: 16px 0 0; font-size: 13.5px; line-height: 1.5; }
  ol { margin: 6px 0 0; padding-left: 20px; } li { margin: 2px 0; }
  .link { margin: 14px 0 0; font-size: 10.5px; word-break: break-all; color: #444; }
  .items { margin: 14px 0 0; font-size: 12.5px; color: #333; }
  .items ul { margin: 4px 0 0; padding-left: 18px; }
  .foot { margin: 16px 0 0; font-size: 11px; color: #666; }
</style></head><body><div class="card">
  <h1>${escapeHtml(routine.name)}</h1>
  <p class="from">From ${escapeHtml(practitioner)}${meta.version ? ` · version ${escapeHtml(meta.version)}` : ''}</p>
  ${meta.goal ? `<p class="for"><strong>For:</strong> ${escapeHtml(meta.goal)}</p>` : ''}
  ${svg ? `<div class="qr">${svg}</div>` : '<p class="how"><strong>This programme is too long for a QR code.</strong> Use the link below instead.</p>'}
  <div class="how"><strong>How to open it</strong>
    <ol>
      <li>${svg ? 'Point your phone camera at the code and tap the link.' : 'Type or paste the link below into your phone browser.'}</li>
      <li>The PPWellness Lifestyle App opens, free, with this routine ready.</li>
      <li>Tap <strong>Save to my Routines</strong>. It stays on your phone, even offline.</li>
    </ol>
  </div>
  <div class="items">What is in it (${items.length} step${items.length === 1 ? '' : 's'}):<ul>${rows}${more}</ul></div>
  <p class="link">${escapeHtml(link)}</p>
  <p class="foot">Made with the PPWellness Lifestyle App · app.ppwellness.co · The routine lives on your own phone; nothing about you is sent to us.</p>
</div></body></html>`;
}

export default function StudioSheet() {
  const S = useStore5();
  // Every hook above every early return (React #300).
  const [name, setName] = React.useState(() => studioName());
  const [pickId, setPickId] = React.useState(null);
  const [goal, setGoal] = React.useState('');
  const [version, setVersion] = React.useState('1');
  const [showQr, setShowQr] = React.useState(false);
  const [copied, setCopied] = React.useState(null); // null | 'ok' | 'failed'
  const [msg, setMsg] = React.useState(null);

  const routines = Array.isArray(S.routines) ? S.routines : [];
  const picked = pickId ? routines.find((r) => r.id === pickId) || null : null;

  // The sheet is NOT painted for anyone but a practitioner — see the header.
  // `studioOpen` alone is not enough: openStudio() refuses to set it for
  // anyone else, but a licence can be revoked while the sheet is open, and the
  // next entitlement read must take it down.
  if (!S.practitioner || !S.studioOpen) return null;

  const trimmedName = String(name || '').trim().slice(0, STUDIO_MAX_NAME);
  const draft = picked ? { ...picked, author: trimmedName || undefined, goal: goal.trim() || undefined, version } : null;
  const link = draft ? routineToLink(draft) : null;
  const svg = showQr && link ? qrSvgFor(link) : null;

  const pick = (r) => {
    setPickId(r.id); setShowQr(false); setCopied(null); setMsg(null);
    const m = routineMeta(r);
    setGoal(m.goal || '');
    setVersion(m.version || '1');
  };
  const saveName = (v) => { setName(v); setStudioName(v); };
  const saveDetails = () => {
    if (!picked) return;
    updateRoutine(picked.id, { author: trimmedName || undefined, ...routineMeta({ goal, version }) });
    setMsg('Saved on the routine.');
  };
  const bump = () => {
    const n = parseInt(version, 10);
    setVersion(String(Number.isFinite(n) && n > 0 ? n + 1 : 2));
  };
  const onCopy = async () => {
    if (!link) return;
    saveDetails();
    try { await navigator.clipboard.writeText(link); setCopied('ok'); } catch { setCopied('failed'); }
  };
  const onPrint = () => {
    if (!link || !picked) return;
    saveDetails();
    const html = cardHtml({ practitioner: trimmedName || 'your practitioner', routine: draft, link, svg: qrSvgFor(link) });
    const w = typeof window.open === 'function' ? window.open('', '_blank') : null;
    if (!w || !w.document) { setMsg('Your browser blocked the print window. Allow pop-ups, or copy the link instead.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    try { w.focus(); } catch { /* noop */ }
    try { w.print(); } catch { /* the card is on screen; the person can print from there */ }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 38, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={closeStudio} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div role="dialog" aria-label="Studio" style={{ position: 'relative', margin: '0 14px calc(96px + env(safe-area-inset-bottom, 0px))', width: '100%', maxHeight: 'calc(100% - 110px)', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--accent)' }}>Studio</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Send a routine to a client</div>
            <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Practitioner licence · {readEmail() || 'signed in'}</div>
          </div>
          <button onClick={closeStudio} aria-label="Close Studio" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <label htmlFor="ppw-studio-name" style={LABEL}>Your name on routines</label>
        <input id="ppw-studio-name" value={name} onChange={(e) => saveName(e.target.value)} maxLength={STUDIO_MAX_NAME} placeholder="e.g. Victor, Peak Performance Wellness" style={{ ...IN, marginTop: 6 }} />
        <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' }}>Clients see this name on every routine you send. It is kept on this device.</div>

        <div style={LABEL}>Pick a routine</div>
        {routines.length === 0 ? (
          <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 16, border: '1px dashed var(--hairline)', background: 'var(--track)', fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
            No routines yet. Close this and tap Create Routine, then come back.
          </div>
        ) : (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {routines.map((r) => (
              <button key={r.id} onClick={() => pick(r)} aria-pressed={pickId === r.id} aria-label={`Pick ${r.name}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '8px 12px', borderRadius: 14, textAlign: 'left', border: `1px solid ${pickId === r.id ? 'var(--acc-rim)' : 'var(--rim)'}`, background: pickId === r.id ? 'var(--acc-surf)' : 'var(--surface)', color: pickId === r.id ? 'var(--acc-ink)' : 'var(--ink)' }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ flex: 'none', fontSize: 12, opacity: .8 }}>{(r.items || []).length} step{(r.items || []).length === 1 ? '' : 's'}</span>
              </button>
            ))}
          </div>
        )}

        {picked && (
          <>
            <label htmlFor="ppw-studio-goal" style={LABEL}>What it addresses</label>
            <input id="ppw-studio-goal" value={goal} onChange={(e) => { setGoal(e.target.value); setCopied(null); }} maxLength={ROUTINE_MAX_GOAL} placeholder="e.g. Right shoulder, weeks 1 to 6" style={{ ...IN, marginTop: 6 }} />

            <label htmlFor="ppw-studio-version" style={LABEL}>Version</label>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <input id="ppw-studio-version" value={version} onChange={(e) => { setVersion(e.target.value); setCopied(null); }} inputMode="numeric" maxLength={24} style={{ ...IN, flex: 1 }} />
              <button onClick={bump} aria-label="Next version" style={{ ...btnQuiet, flex: 'none', padding: '0 16px' }}>+1</button>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45, color: 'var(--dim)' }}>Change the routine, raise the version, send it again. The client sees which version they hold.</div>

            <button onClick={onCopy} style={{ ...btnPrimary, marginTop: 16 }}>{copied === 'ok' ? 'Link copied' : 'Copy link'}</button>
            {copied === 'failed' && (
              <input readOnly value={link || ''} aria-label="Routine link" onFocus={(e) => e.target.select()} style={{ ...IN, marginTop: 8, fontSize: 12 }} />
            )}
            {!link && (
              <div role="alert" style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}>This programme is too long for one link. Share it from the Routines list as a file instead.</div>
            )}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowQr((v) => !v); saveDetails(); }} disabled={!link} style={{ ...btnQuiet, opacity: link ? 1 : .45 }}>{showQr ? 'Hide QR code' : 'Show QR code'}</button>
              <button onClick={onPrint} disabled={!link} style={{ ...btnQuiet, opacity: link ? 1 : .45 }}>Print card</button>
            </div>
            {showQr && link && (
              svg ? (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {/* White ground on every colourway: a QR code on navy does not scan. */}
                  <div data-studio-qr="" aria-label={`QR code for ${picked.name}`} role="img" style={{ width: 220, height: 220, padding: 10, boxSizing: 'border-box', borderRadius: 16, background: '#fff' }} dangerouslySetInnerHTML={{ __html: svg }} />
                  <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)', textAlign: 'center' }}>The client points their camera at this and taps the link. The app opens with the routine ready to save.</div>
                </div>
              ) : (
                <div role="alert" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}>This programme is too long for a QR code. Copy the link instead, or make it shorter.</div>
              )
            )}
            {msg && <div role="status" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.45, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>{msg}</div>}
          </>
        )}

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--hairline)', fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>
          The app is free for your clients. What you charge them is between you and them, outside the app.
        </div>
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={closeStudio} style={btnPlain}>Done</button>
        </div>
      </div>
    </div>
  );
}
