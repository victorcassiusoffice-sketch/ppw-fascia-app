// AiBridgeSheet — "Talk to your AI to organise your life".
//
// Four steps, phone-first, zero cost to PPW:
//   1 Send    — share/copy the prompt into the user's own AI app
//   2 Paste   — paste the reply back
//   3 Preview — see exactly what will be added, untick anything, Apply
//   4 Done    — with a single Undo
//
// Graphite neumorphic: opaque surfaces, dual-shadow, no blur.

import React from 'react';
import { useStore5, setState, closeAiBridge, addItemsToPlan, removeItemsByIds, parsePlanDoc, dateKeyFromOffset } from '../store5.js';
import { buildPrompt } from './aiPrompt.js';
import { extractPlanCandidates, PARSE_HELP } from './parsePlan.js';
import { sharePrompt, copyText, readText, canShare } from './clipboard.js';

const CARD = { background: 'var(--surface)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' };
const BTN_PRIMARY = { height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', width: '100%' };
const BTN_GHOST = { height: 46, borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, width: '100%' };

const DAY_LABEL = (n) => {
  if (!n) return 'Today';
  if (n === 1) return 'Tomorrow';
  const p = dateKeyFromOffset(n).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
};
const REPEAT_LABEL = { daily: 'every day', weekly: 'weekly', once: 'once' };
const repeatText = (r) => REPEAT_LABEL[r] || (`every ${r} days`);

export default function AiBridgeSheet() {
  const S = useStore5();
  const [step, setStep] = React.useState(1);
  const [raw, setRaw] = React.useState('');
  const [parsed, setParsed] = React.useState(null);   // { name, items }
  const [alts, setAlts] = React.useState([]);
  const [err, setErr] = React.useState(null);
  const [picked, setPicked] = React.useState({});     // index -> bool
  const [applied, setApplied] = React.useState(null); // { ids, count }
  const [toast, setToast] = React.useState(null);

  if (!S.aiOpen) return null;

  const close = () => { closeAiBridge(); setTimeout(() => { setStep(1); setRaw(''); setParsed(null); setAlts([]); setErr(null); setApplied(null); }, 250); };

  const send = async () => {
    const r = await sharePrompt(buildPrompt(S), 'Plan my day');
    if (r.cancelled) return;
    setToast(r.ok ? (r.via === 'share' ? 'Sent — paste it into your AI' : 'Prompt copied') : 'Could not copy — select the text below');
    setTimeout(() => setToast(null), 2200);
    if (r.ok) setStep(2);
  };

  const copyOnly = async () => {
    const r = await copyText(buildPrompt(S));
    setToast(r.ok ? 'Prompt copied' : 'Could not copy');
    setTimeout(() => setToast(null), 2000);
    if (r.ok) setStep(2);
  };

  const tryParse = (text) => {
    const found = extractPlanCandidates(text);
    if (!found.ok) { setErr(PARSE_HELP[found.reason] || PARSE_HELP['no-block']); setParsed(null); return; }
    const doc = parsePlanDoc(found.data);
    if (!doc.ok) { setErr(PARSE_HELP['bad-shape']); setParsed(null); return; }
    setErr(null);
    setParsed(doc);
    setAlts(found.alternates || []);
    const all = {}; doc.items.forEach((_, i) => { all[i] = true; });
    setPicked(all);
    setStep(3);
  };

  const pasteAssist = async () => {
    const r = await readText();
    if (r.ok) { setRaw(r.text); tryParse(r.text); }
    else { setToast('Paste it into the box below'); setTimeout(() => setToast(null), 2000); }
  };

  const useAlternate = (a) => {
    const doc = parsePlanDoc(a.data);
    if (!doc.ok) return;
    setParsed(doc);
    const all = {}; doc.items.forEach((_, i) => { all[i] = true; });
    setPicked(all);
    setAlts(alts.filter((x) => x !== a));
  };

  const chosen = parsed ? parsed.items.filter((_, i) => picked[i]) : [];
  const apply = () => {
    const res = addItemsToPlan(chosen);
    if (res.upsell) { close(); return; }
    if (res.ok) { setApplied({ ids: res.ids, count: res.count }); setStep(4); }
  };
  const undo = () => { if (applied) { removeItemsByIds(applied.ids); setApplied(null); close(); } };

  // group the preview by day so "a whole week" is legible
  const groups = [];
  if (parsed) {
    for (let i = 0; i < parsed.items.length; i++) {
      const d = parsed.items[i]._day || 0;
      let g = groups.find((x) => x.day === d);
      if (!g) { g = { day: d, rows: [] }; groups.push(g); }
      g.rows.push({ it: parsed.items[i], i });
    }
    groups.sort((a, b) => a.day - b.day);
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />

      {/* header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '22px 20px 0' }}>
        <button onClick={close} aria-label="Close" style={{ width: 44, height: 44, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>Step {step} of 4</div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Talk to your AI</div>
        </div>
      </div>

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '18px 20px 28px' }}>

        {/* ── 1 SEND ── */}
        {step === 1 && (
          <div style={{ animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--dim)' }}>
              Use the AI you already have — ChatGPT, Claude, Gemini, any of them. We send it a prompt,
              it asks you a few questions, and it writes your plan. <strong style={{ color: 'var(--ink)' }}>It costs you nothing extra and we never see your chat.</strong>
            </p>
            <div style={{ marginTop: 18, padding: 16, borderRadius: 20, ...CARD }}>
              <div style={{ fontSize: 13, fontWeight: 700, textShadow: 'var(--emboss)' }}>How it works</div>
              <ol style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--dim)' }}>
                <li>Send the prompt to your AI app</li>
                <li>Answer its 5 quick questions</li>
                <li>Copy its whole reply</li>
                <li>Paste it back here — done</li>
              </ol>
            </div>
            <button onClick={send} style={{ ...BTN_PRIMARY, marginTop: 20 }}>
              {canShare() ? 'Send to my AI' : 'Copy the prompt'}
            </button>
            {canShare() && (
              <button onClick={copyOnly} style={{ ...BTN_GHOST, marginTop: 10 }}>Copy the prompt instead</button>
            )}
            <button onClick={() => setStep(2)} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>I’ve already got a reply →</button>
          </div>
        )}

        {/* ── 2 PASTE ── */}
        {step === 2 && (
          <div style={{ animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--dim)' }}>
              Copy your AI’s <strong style={{ color: 'var(--ink)' }}>whole reply</strong> and paste it here — including the block of code at the end.
            </p>
            <button onClick={pasteAssist} style={{ ...BTN_GHOST, marginTop: 14 }}>Paste from clipboard</button>
            <textarea
              value={raw}
              onChange={(e) => { setRaw(e.target.value); if (err) setErr(null); }}
              placeholder="Paste your AI's reply here…"
              aria-label="Paste your AI's reply"
              style={{ marginTop: 12, width: '100%', minHeight: 200, padding: 14, borderRadius: 16, border: `1px solid ${err ? 'var(--accent)' : 'var(--hairline)'}`, background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 13.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
            />
            {err && <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.5, color: 'var(--accent)', fontWeight: 600 }}>{err}</div>}
            <button onClick={() => tryParse(raw)} disabled={!raw.trim()} style={{ ...BTN_PRIMARY, marginTop: 16, opacity: raw.trim() ? 1 : .45 }}>See my plan</button>
            <button onClick={() => setStep(1)} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>← Back</button>
          </div>
        )}

        {/* ── 3 PREVIEW ── */}
        {step === 3 && parsed && (
          <div style={{ animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{parsed.name}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--dim)' }}>
              {chosen.length} of {parsed.items.length} selected · untick anything you don’t want
            </div>

            {alts.length > 0 && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid var(--accent)', background: 'var(--track)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Your AI sent more than one plan</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--dim)' }}>Showing the fullest one. </div>
                {alts.map((a, k) => (
                  <button key={k} onClick={() => useAlternate(a)} style={{ marginTop: 8, width: '100%', height: 40, borderRadius: 12, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>
                    Use the other one ({(a.data.items || []).length} items) instead
                  </button>
                ))}
              </div>
            )}

            {groups.map((g) => (
              <div key={g.day} style={{ marginTop: 18 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' }}>{DAY_LABEL(g.day)}</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {g.rows.map(({ it, i }) => (
                    <button key={i} onClick={() => setPicked({ ...picked, [i]: !picked[i] })}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, textAlign: 'left', border: `1px solid ${picked[i] ? 'var(--acc-rim)' : 'var(--rim)'}`, background: 'var(--surface)', boxShadow: 'var(--elev)', opacity: picked[i] ? 1 : .5 }}>
                      <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 7, border: `1.5px solid ${picked[i] ? 'var(--acc-rim)' : 'var(--rim)'}`, background: picked[i] ? 'var(--acc-surf)' : 'transparent', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {picked[i] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: 'var(--emboss)' }}>{it.title}</span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>
                          {[it.time, it.meta, repeatText(it._repeat)].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button onClick={apply} disabled={!chosen.length} style={{ ...BTN_PRIMARY, marginTop: 22, opacity: chosen.length ? 1 : .45 }}>
              Add {chosen.length} to my day
            </button>
            <button onClick={() => setStep(2)} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>← Paste a different reply</button>
          </div>
        )}

        {/* ── 4 DONE ── */}
        {step === 4 && applied && (
          <div style={{ textAlign: 'center', paddingTop: 30, animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ width: 84, height: 84, margin: '0 auto', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            </div>
            <div style={{ marginTop: 20, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Added to your day</div>
            <p style={{ margin: '8px auto 0', maxWidth: 260, fontSize: 14, lineHeight: 1.55, color: 'var(--dim)' }}>
              {applied.count} thing{applied.count === 1 ? '' : 's'} scheduled. You can edit or delete any of them like anything else.
            </p>
            <button onClick={close} style={{ ...BTN_PRIMARY, marginTop: 24 }}>See my stack</button>
            <button onClick={undo} style={{ ...BTN_GHOST, marginTop: 10 }}>Undo — remove them again</button>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 26, zIndex: 3, padding: '13px 16px', borderRadius: 16, textAlign: 'center', background: 'var(--surface-strong)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', animation: 'ppwRise .3s ease both' }}>{toast}</div>
      )}
    </div>
  );
}
