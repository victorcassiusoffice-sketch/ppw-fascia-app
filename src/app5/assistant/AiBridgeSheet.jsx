// AiBridgeSheet — "Talk to your AI to organise your life".
//
// Four steps, phone-first, zero cost to PPW:
//   1 Send    — share/copy the prompt into the user's own AI app
//   2 Paste   — paste the reply back
//   3 Preview — see exactly what will change, untick anything, Apply
//   4 Done    — with a single Undo, and the offer to add a video to each stack
//
// ORGANISE (Vic, 2026-10-17): with stacks already on the day, the default is
// now "Organise my stacks". The AI is shown each stack with a ref, asks how each
// one is going, and sends the whole list back; planDiff.js turns that into a
// list of CHANGES to the user's own stacks — moved, renamed, repeat changed,
// new, removed — and nothing happens until the user approves them. A stack that
// is kept keeps its id, its video, its AUTO and its ticks.
//
// VIDEOS: the AI's video suggestions are checked against YouTube here, before
// the user commits, and stored on the stack as suggestions (`recs`). Nothing is
// attached by itself: step 4 asks "would you like to add a video or link to
// this?" and opens the picker (screens/VideoPicker.jsx) for the stack.
//
// Graphite neumorphic: opaque surfaces, dual-shadow, no blur.

import React from 'react';
import {
  useStore5, closeAiBridge, addItemsToPlan, applyPlanDiff, undoPlanDiff, removeItemsByIds,
  parsePlanDoc, dateKeyFromOffset, finishOnboarding, setAiStep, recordQuest, FREE_STACK_CAP,
  premiumGated, setAiRefs, openVideoPicker, videoable,
} from '../store5.js';
import { buildPrompt, PLAN_MODE, replaceableItems, refMapFor } from './aiPrompt.js';
import { verifyAll } from './verifyVideo.js';
import { extractPlanCandidates, PARSE_HELP } from './parsePlan.js';
import { sharePrompt, copyText, readText, canShare } from './clipboard.js';
import { diffPlan, describeField } from './planDiff.js';
import { picksFor } from './videoCatalog.js';

const CARD = { background: 'var(--surface)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)' };
const BTN_PRIMARY = { height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', width: '100%' };
const BTN_GHOST = { height: 46, borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5, width: '100%' };
const SECTION = { fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--dim)', textShadow: 'var(--emboss)' };
const CHIP = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--hairline)', background: 'var(--track)', fontSize: 11, fontWeight: 600, color: 'var(--dim)' };

// The three AIs the prompt is written for. Plain web addresses: on a phone with
// the AI's own app installed, each opens that app; anywhere else, the website.
export const AI_APPS = [
  { name: 'ChatGPT', url: 'https://chatgpt.com/' },
  { name: 'Claude', url: 'https://claude.ai/new' },
  { name: 'Gemini', url: 'https://gemini.google.com/app' },
];

const DAY_LABEL = (n) => {
  if (!n) return 'Today';
  if (n === 1) return 'Tomorrow';
  const p = dateKeyFromOffset(n).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
};
const REPEAT_LABEL = { daily: 'every day', weekly: 'weekly', once: 'once' };
const repeatText = (r) => REPEAT_LABEL[r] || (`every ${r} days`);

/**
 * The checked video suggestions for one planned item: the claims that YouTube
 * answered for, with YouTube's own title and channel, and the first search the
 * model wrote (what "Search YouTube" will look for).
 */
export function recsFor(claims, verdicts) {
  const list = Array.isArray(claims) ? claims : [];
  const recs = [];
  list.forEach((c, j) => {
    const v = verdicts && verdicts[j];
    if (c && c.yt && v && v.state === 'ok' && !recs.some((r) => r.yt === c.yt)) {
      recs.push({ yt: c.yt, title: v.title || c.q || 'YouTube video', author: v.author || '' });
    }
  });
  const q = (list.find((c) => c && c.q) || {}).q;
  return { recs, recQ: q || undefined };
}

function Tick({ on }) {
  return (
    <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 7, border: `1.5px solid ${on ? 'var(--acc-rim)' : 'var(--rim)'}`, background: on ? 'var(--acc-surf)' : 'transparent', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
    </span>
  );
}

const IVideo = <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 6.2v11.6l9.4-5.8L9 6.2z" /></svg>;

export default function AiBridgeSheet() {
  const S = useStore5();
  const [step, setStep] = React.useState(1);
  const [raw, setRaw] = React.useState('');
  const [parsed, setParsed] = React.useState(null);   // { name, items }
  const [diff, setDiff] = React.useState(null);       // organise only: planDiff result
  const [alts, setAlts] = React.useState([]);
  const [err, setErr] = React.useState(null);
  const [picked, setPicked] = React.useState({});     // add: index -> bool · organise: 'c:id' | 'a:i' | 'r:id' -> bool
  const [applied, setApplied] = React.useState(null); // what Undo and the video step need
  const [toast, setToast] = React.useState(null);
  const [capErr, setCapErr] = React.useState(null);   // free-cap refusal, shown in place
  // null until the user picks: organise when there are stacks to organise
  // (Vic, 2026-10-17), otherwise a fresh plan. See effMode below.
  const [mode, setMode] = React.useState(null);
  const [confirmReplace, setConfirmReplace] = React.useState(false);
  // YouTube's verdicts, per planned item, per suggestion: vids[i][j]. null while
  // the check is in flight. A token guards against a second paste landing its
  // results on top of a newer one.
  const [vids, setVids] = React.useState(null);
  const vidRun = React.useRef(0);
  const [showPrompt, setShowPrompt] = React.useState(false);
  const [showSame, setShowSame] = React.useState(false);

  // The guide has to know where the user is inside this sheet, and the step
  // lives in local state that nothing outside can see. Mirror it into the store
  // so a coach step can wait on it. The mapping is the sheet's own numbering:
  //   1 = prompt sent or copied, awaiting the paste
  //   2 = paste screen
  //   3 = preview reached with parsed items  (Quest 6 gates on aiStep >= 3)
  //   4 = applied
  // Closed reads 0. One effect, so each step change writes exactly once —
  // setAiStep already no-ops when the value is unchanged. It sits above the
  // early return because hooks cannot be conditional.
  React.useEffect(() => { setAiStep(S.aiOpen ? step : 0); }, [S.aiOpen, step]);
  // Every step starts at its top. The body is one scroller shared by all four,
  // so the done screen used to open wherever the long preview had been
  // scrolled to — with its own title hidden under the header.
  const bodyRef = React.useRef(null);
  React.useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; }, [step]);

  if (!S.aiOpen) return null;

  // F3: while onboarding is unfinished this sheet is a SUB-flow of the start
  // choice, so closing it returns there rather than stranding the user.
  const midOnboarding = !S.onboarded;

  // The mode only means anything once there is a day to keep or organise. With
  // an empty Stack there is nothing to echo, so the question is never asked and
  // nothing about the existing plan is sent.
  const deck = Array.isArray(S.deckItems) ? S.deckItems : [];
  const replaceable = replaceableItems(deck);
  const privateCount = deck.length - replaceable.length;
  const effMode = !deck.length ? PLAN_MODE.FRESH
    : (mode || (replaceable.length ? PLAN_MODE.REBUILD : PLAN_MODE.AROUND));
  const organising = effMode === PLAN_MODE.REBUILD;

  // The reset runs here, in the same breath as the close. It used to run 250ms
  // later, which left a window in which reopening the sheet republished the OLD
  // step: Quest 6 opens this sheet on its very first step, and the empty Stack's
  // "Plan with AI" button sits one tap away from a close, so a fast round trip
  // wrote a stale 3 into the store and the quest skipped its own paste step.
  // The delay protected nothing — the sheet stops rendering the instant aiOpen
  // clears, so there is no frame in which the emptied screen can be seen.
  const close = () => { closeAiBridge(); setStep(1); setRaw(''); setParsed(null); setDiff(null); setAlts([]); setErr(null); setApplied(null); setShowPrompt(false); setCapErr(null); setMode(null); setConfirmReplace(false); setVids(null); setShowSame(false); };

  /** Leaving for good: the user arrived somewhere, so onboarding is done. */
  const finishAndClose = () => { if (midOnboarding) finishOnboarding(); close(); };

  /**
   * F4 (UX pass 2026-08-11) — the flagship "talk to my AI" button appeared to do
   * nothing. A cancelled share returned in silence, so no toast mounted on either
   * success OR failure, and the prompt text existed nowhere on the page — if the
   * copy failed there was nothing to select by hand. Every path now says
   * something, and the prompt is always readable (see "Show me the prompt").
   */
  const flash = (text, ms = 2200) => { setToast(text); setTimeout(() => setToast(null), ms); };

  // The refs the prompt hands out are remembered the moment the prompt leaves
  // the app — the reply comes back later, often after a reload, and its s1 must
  // still mean the stack s1 meant when it was copied.
  const remember = () => { if (organising) setAiRefs(refMapFor(deck).map); };
  const prompt = () => buildPrompt(S, effMode);

  const send = async () => {
    remember();
    const r = await sharePrompt(prompt(), 'Plan my day');
    if (r.cancelled) { flash('No app chosen — or copy it instead, below'); return; }
    if (r.ok) { flash(r.via === 'share' ? 'Sent — paste it into your AI' : 'Prompt copied'); setStep(2); return; }
    flash('Could not copy automatically — open “Show me the prompt” and copy it by hand', 3200);
    setShowPrompt(true);
  };

  const copyOnly = async () => {
    remember();
    const r = await copyText(prompt());
    if (r.ok) { flash('Prompt copied'); setStep(2); return; }
    flash('Could not copy automatically — the prompt is below, select and copy it', 3200);
    setShowPrompt(true);
  };

  // The map the reply is read against: the one remembered when the prompt was
  // copied, else today's — the same function built both.
  const refsNow = () => (S.aiRefs && S.aiRefs.map && typeof S.aiRefs.map === 'object') ? S.aiRefs.map : refMapFor(deck).map;

  const load = (doc) => {
    setParsed(doc);
    setCapErr(null); setConfirmReplace(false); setShowSame(false);
    const all = {};
    if (organising) {
      const d = diffPlan(replaceable, doc.items, refsNow());
      setDiff(d);
      d.changes.forEach((c) => { all['c:' + c.id] = true; });
      d.adds.forEach((a) => { all['a:' + a.index] = true; });
      d.removes.forEach((r) => { all['r:' + r.id] = true; });
    } else {
      setDiff(null);
      doc.items.forEach((_, i) => { all[i] = true; });
    }
    setPicked(all);
    checkVideos(doc);
  };

  const tryParse = (text) => {
    const found = extractPlanCandidates(text);
    if (!found.ok) { setErr(PARSE_HELP[found.reason] || PARSE_HELP['no-block']); setParsed(null); return; }
    const doc = parsePlanDoc(found.data);
    if (!doc.ok) { setErr(PARSE_HELP['bad-shape']); setParsed(null); return; }
    setErr(null);
    setAlts(found.alternates || []);
    load(doc);
    setStep(3);
  };

  /** Ask YouTube about every id the model claimed, before the user commits. */
  const checkVideos = (doc) => {
    const run = ++vidRun.current;
    const flat = [];
    doc.items.forEach((it, i) => (it._videos || []).forEach((c, j) => { if (c.yt) flat.push({ i, j, yt: c.yt }); }));
    if (!flat.length) { setVids(doc.items.map(() => [])); return; }
    setVids(null);
    verifyAll(flat.map((f) => f.yt)).then((vs) => {
      if (vidRun.current !== run) return;
      const out = doc.items.map(() => []);
      flat.forEach((f, k) => { out[f.i][f.j] = vs[k]; });
      setVids(out);
    });
  };

  const pasteAssist = async () => {
    const r = await readText();
    if (r.ok) { setRaw(r.text); tryParse(r.text); }
    else { setToast('Paste it into the box below'); setTimeout(() => setToast(null), 2000); }
  };

  const useAlternate = (a) => {
    const doc = parsePlanDoc(a.data);
    if (!doc.ok) return;
    setAlts(alts.filter((x) => x !== a));
    load(doc);
  };

  // ── what each planned item carries into the store ──
  const recsAt = (i) => {
    const it = parsed && parsed.items[i];
    if (!it || it.kind === 'note') return { recs: [], recQ: undefined };
    return recsFor(it._videos, vids && vids[i]);
  };
  // Only fields with something in them, so a stack never gains empty keys.
  const recPatch = (i) => {
    const { recs, recQ } = recsAt(i);
    const p = {};
    if (recs.length) p.recs = recs;
    if (recQ) p.recQ = recQ;
    return p;
  };
  // A planned item as a stack: its own fields, plus its suggestions. Never a
  // video by itself any more — the user chooses in step 4.
  const materialise = (it, i) => {
    const { _video, _videos, ...rest } = it;
    return { ...rest, ...recPatch(i) };
  };

  const vidClaimed = parsed ? parsed.items.reduce((n, it) => n + (it._videos || []).filter((c) => c.yt).length, 0) : 0;
  const vidFound = vids ? vids.reduce((n, row) => n + (row || []).filter((v) => v && v.state === 'ok').length, 0) : 0;
  const vidChecking = vidClaimed > 0 && !vids;
  const used = deck.length;
  // Infinity while the app is open, so the "Stack is full" banner below can never
  // reach a client who has no cap. (It used to end "or go Premium"; that half of
  // the advice came out with the storefront on 2026-10-08.)
  const headroom = premiumGated(S) ? Math.max(0, FREE_STACK_CAP - used) : Infinity;
  const stackFull = headroom === 0;

  // ── the counts the Apply button and the cap message need ──
  const chosenAdds = parsed && !organising ? parsed.items.map((it, i) => ({ it, i })).filter(({ i }) => picked[i]) : [];
  const org = organising && diff ? {
    changes: diff.changes.filter((c) => picked['c:' + c.id]),
    adds: diff.adds.filter((a) => picked['a:' + a.index]),
    removes: diff.removes.filter((r) => picked['r:' + r.id]),
  } : null;
  const total = org ? org.changes.length + org.adds.length + org.removes.length : chosenAdds.length;

  const apply = () => {
    setCapErr(null);
    if (org) {
      // Removing asks twice. The first tap only arms it.
      if (org.removes.length && !confirmReplace) { setConfirmReplace(true); return; }
      const updates = [
        ...org.changes.map((c) => ({ id: c.id, patch: { ...c.patch, ...recPatch(c.index) } })),
        // A stack the AI kept as it was, but found videos for: the suggestions
        // land quietly and the stack is otherwise untouched.
        ...diff.keeps.filter((k) => Object.keys(recPatch(k.index)).length).map((k) => ({ id: k.id, patch: recPatch(k.index), keepExample: true })),
      ];
      const res = applyPlanDiff({
        updates,
        adds: org.adds.map((a) => materialise(a.item, a.index)),
        removeIds: org.removes.map((r) => r.id),
      });
      if (res.upsell) {
        setConfirmReplace(false);
        const room = res.fits ?? 0;
        setCapErr(room === 0
          ? `Your Stack is full — ${used} of ${FREE_STACK_CAP}. Untick some new stacks, or tick some to remove. Your plan is still here.`
          : `That's ${org.adds.length} new stacks but there is room for ${room}. Untick ${org.adds.length - room} and try again — nothing is lost.`);
        return;
      }
      if (res.ok) {
        // `suggested`: stacks the AI kept as they were but found videos for — they
        // belong in step 4's "add a video?" list as much as the changed ones.
        const suggested = updates.filter((u) => u.keepExample).map((u) => u.id);
        setApplied({ kind: 'organise', res, added: res.ids, changed: org.changes.map((c) => c.id), suggested, removedCount: res.removed.length, count: org.changes.length + res.ids.length + res.removed.length });
        setStep(4);
        if (midOnboarding) recordQuest('ai');
      }
      return;
    }
    const chosen = chosenAdds.map(({ it, i }) => materialise(it, i));
    const res = addItemsToPlan(chosen);
    // The cap refusal used to close() — throwing away the parsed plan AND the
    // pasted reply, after the user had already been out to their AI and back,
    // with no message at all. Stay on the preview so they can untick down to what
    // fits. The global GateNotice still fires (addItemsToPlan sets premiumUpsell);
    // this is what they see the moment they dismiss it.
    if (res.upsell) {
      setCapErr(headroom === 0
        ? `Your Stack is full — ${used} of ${FREE_STACK_CAP}. Delete something on your Stack, then come back. Your plan is still here.`
        : `That's ${chosen.length} items but you have room for ${headroom}. Untick ${chosen.length - headroom} and try again — nothing is lost.`);
      return;
    }
    if (res.ok) {
      setApplied({ kind: 'add', ids: res.ids, added: res.ids, changed: [], removedCount: 0, count: res.count });
      setStep(4);
      // Someone who took the AI fork out of the wizard has just done the whole
      // of Quest 6 for real. Marking it here means the guide never asks them to
      // repeat, in a tutorial, a thing they already did in the product.
      if (midOnboarding) recordQuest('ai');
    }
  };

  // Undo takes back everything the apply did: adds, changes and removals.
  const undo = () => {
    if (!applied) return;
    if (applied.kind === 'organise') undoPlanDiff(applied.res);
    else removeItemsByIds(applied.ids);
    setApplied(null);
    close();
  };

  // ── preview rows ──
  const videoChip = (i) => {
    if (!parsed || !parsed.items[i] || parsed.items[i].kind === 'note') return null;
    const n = recsAt(i).recs.length;
    if (vidChecking && (parsed.items[i]._videos || []).some((c) => c.yt)) return <span style={CHIP}>{IVideo} checking…</span>;
    return n ? <span style={{ ...CHIP, color: 'var(--accent)', borderColor: 'var(--acc-rim)' }}>{IVideo} {n} video{n === 1 ? '' : 's'} found</span> : null;
  };
  const toggle = (k) => { setPicked({ ...picked, [k]: !picked[k] }); setConfirmReplace(false); };
  // A function, not a component: a component declared inside render is a new
  // type every render, so React would remount every row on each keystroke.
  const row = ({ key, k, title, sub, chips, struck }) => (
    <button key={key} onClick={() => toggle(k)} aria-pressed={!!picked[k]}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 16, textAlign: 'left', border: `1px solid ${picked[k] ? 'var(--acc-rim)' : 'var(--rim)'}`, background: 'var(--surface)', boxShadow: 'var(--elev)', opacity: picked[k] ? 1 : .55 }}>
      <Tick on={!!picked[k]} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, overflowWrap: 'anywhere', textDecoration: struck ? 'line-through' : 'none', textShadow: 'var(--emboss)' }}>{title}</span>
        {sub && <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: 'var(--dim)' }}>{sub}</span>}
        {chips && chips.length > 0 && <span style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>{chips}</span>}
      </span>
    </button>
  );

  // group the add-preview by day so "a whole week" is legible
  const groups = [];
  if (parsed && !organising) {
    for (let i = 0; i < parsed.items.length; i++) {
      const d = parsed.items[i]._day || 0;
      let g = groups.find((x) => x.day === d);
      if (!g) { g = { day: d, rows: [] }; groups.push(g); }
      g.rows.push({ it: parsed.items[i], i });
    }
    groups.sort((a, b) => a.day - b.day);
  }

  // ── step 4: the stacks that could take a video ──
  // The user's own stacks first (changed, then kept-with-suggestions), new ones after.
  const videoCandidates = applied ? [...new Set([...applied.changed, ...(applied.suggested || []), ...applied.added])]
    .map((id) => deck.find((x) => x.id === id)).filter((it) => it && videoable(it)) : [];

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

      <div ref={bodyRef} style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '18px 20px 28px' }}>

        {/* ── 1 SEND ── */}
        {step === 1 && (
          <div style={{ animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: 'var(--dim)' }}>
              Use the AI you already have — ChatGPT, Claude, Gemini, any of them. We send it a prompt,
              it asks you how things are going, and it writes your plan. <strong style={{ color: 'var(--ink)' }}>It costs you nothing extra and we never see your chat.</strong>
            </p>
            <div style={{ marginTop: 18, padding: 16, borderRadius: 20, ...CARD }}>
              <div style={{ fontSize: 13, fontWeight: 700, textShadow: 'var(--emboss)' }}>How it works</div>
              {/* listStyle: the global CSS reset strips list markers, so the
                  four steps rendered as four loose lines with no order to
                  them (tester pass 1, 2026-10-17). */}
              <ol style={{ margin: '10px 0 0', paddingLeft: 20, listStyle: 'decimal', fontSize: 13, lineHeight: 1.7, color: 'var(--dim)' }}>
                <li>Send the prompt to your AI app</li>
                <li>{organising ? 'Tell it how each of your stacks is going' : 'Tell it about your days — as much or as little as you like'}</li>
                <li>Copy its whole reply</li>
                <li>Paste it back here — you see every change before it happens</li>
              </ol>
            </div>
            {/* The choice belongs HERE, before the prompt is built — it changes
                what the prompt says. It is only asked when there is a day to
                keep or organise; an empty Stack has nothing to decide, so the
                question never appears and nothing about the plan is sent. */}
            {deck.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textShadow: 'var(--emboss)' }}>
                  You already have {deck.length} thing{deck.length === 1 ? '' : 's'} on your Stack
                </div>
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { k: PLAN_MODE.REBUILD, t: 'Organise my stacks', s: `Your AI asks how each one is going, then moves, changes, removes and adds. You approve every change first${privateCount ? ' — your notes and documents are never touched' : ''}.`, off: !replaceable.length },
                    { k: PLAN_MODE.AROUND, t: 'Keep them, add new things', s: 'Your AI fits new things around what you have. Nothing is changed or removed.' },
                  ].filter((o) => !o.off).map((o) => (
                    <button key={o.k} onClick={() => { setMode(o.k); setConfirmReplace(false); }} aria-pressed={effMode === o.k}
                      style={{ padding: '12px 14px', borderRadius: 16, textAlign: 'left', border: `1px solid ${effMode === o.k ? 'var(--acc-rim)' : 'var(--rim)'}`, background: effMode === o.k ? 'var(--acc-surf)' : 'var(--surface)', boxShadow: 'var(--elev)' }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: effMode === o.k ? 'var(--acc-ink)' : 'var(--ink)' }}>{o.t}</span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, lineHeight: 1.45, color: effMode === o.k ? 'var(--acc-ink)' : 'var(--dim)', opacity: effMode === o.k ? .85 : 1 }}>{o.s}</span>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: 'var(--dim)' }}>
                  Either way your AI is shown the names and times on your Stack, so it can work with them.
                  {privateCount > 0 && ' Your notes and documents are never sent — only that the slot is taken.'}
                </div>
              </div>
            )}
            {stackFull && !organising && (
              <div role="alert" style={{ marginTop: 18, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--accent)', background: 'var(--track)', boxShadow: 'var(--inset)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--accent)', fontWeight: 600 }}>
                Your Stack is full — {used} of {FREE_STACK_CAP}. Make room first, or choose “Organise my stacks” above.
              </div>
            )}
            {/* data-tour: the guide points here. This button, not the ghost one
                below it — it is the only copy path that exists on every device. */}
            <button onClick={send} disabled={stackFull && !organising} data-tour="ai-copy" style={{ ...BTN_PRIMARY, marginTop: 20, opacity: (stackFull && !organising) ? .45 : 1 }}>
              {canShare() ? 'Send to my AI' : 'Copy the prompt'}
            </button>
            {canShare() && (
              <button onClick={copyOnly} disabled={stackFull && !organising} style={{ ...BTN_GHOST, marginTop: 10, opacity: (stackFull && !organising) ? .45 : 1 }}>Copy the prompt instead</button>
            )}
            <button onClick={() => { remember(); setStep(2); }} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>I’ve already got a reply →</button>

            {/* F4: the prompt has to be readable, or a failed copy leaves the user
                with nothing to select. Always available, not only after a failure. */}
            <button onClick={() => { if (!showPrompt) remember(); setShowPrompt((v) => !v); }} aria-expanded={showPrompt}
              style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>
              {showPrompt ? 'Hide the prompt' : 'Show me the prompt'}
            </button>
            {showPrompt && (
              <textarea
                readOnly value={prompt()} aria-label="The prompt to send to your AI"
                onFocus={(e) => e.target.select()}
                style={{ marginTop: 10, width: '100%', minHeight: 170, padding: 14, borderRadius: 16, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', outline: 'none', fontSize: 12.5, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
              />
            )}

            {/* F3: the way back to "Start with an empty day". Before this the
                choice was destroyed the moment the AI path was picked. */}
            {midOnboarding && (
              <button onClick={close} style={{ ...BTN_GHOST, marginTop: 16, border: 'none' }}>
                ← Back — I’ll start with an empty day instead
              </button>
            )}
          </div>
        )}

        {/* ── 2 PASTE ── */}
        {step === 2 && (
          <div style={{ animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            {/* THE WAY OUT TO THE AI (tester pass 1, 2026-10-17). After "Copy
                the prompt" the sheet jumped straight to "paste its reply", and
                the user had to work out on their own that they should now leave
                the app, open an AI and paste. Three plain links say it, and
                open the AI's own app on a phone that has it. */}
            <div style={{ padding: 14, borderRadius: 18, ...CARD }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, textShadow: 'var(--emboss)' }}>Now open your AI and paste the prompt</div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AI_APPS.map((a) => (
                  <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44, padding: '0 14px', borderRadius: 14, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>{a.name} ↗</a>
                ))}
              </div>
              <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>
                {organising
                  ? 'It will go through your stacks with you. When it sends your plan, copy its whole reply and come back here.'
                  : 'Chat with it about your days. When it sends your plan, copy its whole reply and come back here.'}
              </div>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--dim)' }}>
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
            {err && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--accent)', fontWeight: 600 }}>{err}</div>
                {/* F5: "paste it again" is a loop for the user whose AI genuinely
                    never produced a code block. Give them the sentence that fixes
                    it, and a way out that isn't this screen. */}
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 14, background: 'var(--track)', border: '1px solid var(--hairline)', boxShadow: 'var(--inset)', fontSize: 12, lineHeight: 1.55, color: 'var(--dim)' }}>
                  If your AI didn’t include a code block, send it this:{' '}
                  <strong style={{ color: 'var(--ink)' }}>“Send that again as a single code block.”</strong>
                  {' '}Then copy its whole reply and paste it here.
                </div>
                {midOnboarding && (
                  <button onClick={close} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>
                    ← Give up on this and start with an empty day
                  </button>
                )}
              </div>
            )}
            <button onClick={() => tryParse(raw)} disabled={!raw.trim()} style={{ ...BTN_PRIMARY, marginTop: 16, opacity: raw.trim() ? 1 : .45 }}>See my plan</button>
            <button onClick={() => setStep(1)} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>← Back</button>
          </div>
        )}

        {/* ── 3 PREVIEW ── */}
        {step === 3 && parsed && (
          <div style={{ animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{parsed.name}</div>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--dim)' }}>
              {diff
                ? `${diff.changes.length} change${diff.changes.length === 1 ? '' : 's'} · ${diff.adds.length} new · ${diff.removes.length} to remove · ${diff.keeps.length} the same`
                : `${chosenAdds.length} of ${parsed.items.length} selected · untick anything you don’t want`}
            </div>
            {vidClaimed > 0 && (
              <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>
                {vidChecking
                  ? `Checking ${vidClaimed} video${vidClaimed === 1 ? '' : 's'} with YouTube…`
                  : vidFound === vidClaimed
                    ? `${vidFound} of ${vidClaimed} video${vidClaimed === 1 ? '' : 's'} found. You can add them after this. Titles come from YouTube, not from your AI.`
                    : `${vidFound} of ${vidClaimed} videos found. Your AI was not sure of the rest — you can search for them after this.`}
              </div>
            )}

            {alts.length > 0 && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: '1px solid var(--accent)', background: 'var(--track)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--accent)' }}>Your AI sent more than one plan</div>
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--dim)' }}>Showing the most recent one. </div>
                {alts.map((a, k) => (
                  <button key={k} onClick={() => useAlternate(a)} style={{ marginTop: 8, width: '100%', height: 40, borderRadius: 12, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', fontSize: 12.5, fontWeight: 600 }}>
                    Use the other one ({(a.data.items || []).length} items) instead
                  </button>
                ))}
              </div>
            )}

            {/* data-tour: one wrapper so the guide can point at the whole
                parsed list, not a single row. The Apply button lives INSIDE
                it because the guide spotlights this wrapper in do-mode and dims
                everything outside — leave the button out and the coach hides the
                one control its own step is asking the user to press. Unstyled on
                purpose — the list and the button keep their own spacing. */}
            <div data-tour="ai-preview">
            {diff ? (
              <>
                {diff.changes.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={SECTION}>Changes to your stacks</div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {diff.changes.map((c) => row({
                        key: c.id, k: 'c:' + c.id, title: c.patch.title || c.before.title,
                        sub: c.patch.title ? `was “${c.before.title}”` : null,
                        chips: [...c.fields.filter((f) => f.key !== 'title').map((f) => <span key={f.key} style={CHIP}>{describeField(f)}</span>), videoChip(c.index)].filter(Boolean),
                      }))}
                    </div>
                  </div>
                )}
                {diff.adds.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={SECTION}>New stacks</div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {diff.adds.map((a) => row({
                        key: a.index, k: 'a:' + a.index, title: a.item.title,
                        sub: [a.item.time || 'anytime', a.item.meta, repeatText(a.item._repeat), a.item._day ? DAY_LABEL(a.item._day) : null].filter(Boolean).join(' · '),
                        chips: [videoChip(a.index)].filter(Boolean),
                      }))}
                    </div>
                  </div>
                )}
                {diff.removes.length > 0 && (
                  <div style={{ marginTop: 18 }}>
                    <div style={SECTION}>To remove</div>
                    <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--dim)' }}>Your AI left these out. Untick any you want to keep.</div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {diff.removes.map((r) => row({
                        key: r.id, k: 'r:' + r.id, title: r.title, struck: !!picked['r:' + r.id],
                        sub: [r.time || 'anytime', repeatText(r.repeat === undefined ? 'daily' : r.repeat)].join(' · '),
                      }))}
                    </div>
                  </div>
                )}
                {diff.keeps.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <button onClick={() => setShowSame((v) => !v)} aria-expanded={showSame} style={{ background: 'none', border: 'none', padding: '6px 0', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600 }}>
                      {showSame ? '▾' : '▸'} {diff.keeps.length} stack{diff.keeps.length === 1 ? '' : 's'} stay the same
                    </button>
                    {showSame && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {diff.keeps.map((k) => (
                          <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--dim)' }}>
                            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{k.before.time || 'anytime'} · {k.before.title}</span>
                            {videoChip(k.index)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!diff.changes.length && !diff.adds.length && !diff.removes.length && (
                  <div style={{ marginTop: 18, padding: '12px 14px', borderRadius: 14, ...CARD, fontSize: 13, lineHeight: 1.5, color: 'var(--dim)' }}>
                    Your AI kept every stack as it is. {vidFound ? 'It found some videos — tap Apply to keep them as suggestions.' : 'Nothing to change.'}
                  </div>
                )}
              </>
            ) : (
              groups.map((g) => (
                <div key={g.day} style={{ marginTop: 18 }}>
                  <div style={SECTION}>{DAY_LABEL(g.day)}</div>
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {g.rows.map(({ it, i }) => row({
                      key: i, k: i, title: it.title,
                      sub: [it.time, it.meta, repeatText(it._repeat)].filter(Boolean).join(' · '),
                      chips: [videoChip(i)].filter(Boolean),
                    }))}
                  </div>
                </div>
              ))
            )}
            {capErr && (
              <div role="alert" style={{ marginTop: 16, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--accent)', background: 'var(--track)', boxShadow: 'var(--inset)', fontSize: 12.5, lineHeight: 1.55, color: 'var(--accent)', fontWeight: 600 }}>
                {capErr}
              </div>
            )}
            {org && org.removes.length > 0 && (
              <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 14, border: `1px solid ${confirmReplace ? 'var(--accent)' : 'var(--rim)'}`, background: 'var(--track)', boxShadow: 'var(--inset)', fontSize: 12.5, lineHeight: 1.55, color: confirmReplace ? 'var(--accent)' : 'var(--dim)', fontWeight: confirmReplace ? 700 : 500 }}>
                {confirmReplace
                  ? `This removes ${org.removes.length} stack${org.removes.length === 1 ? '' : 's'}. Tap again to confirm — you can undo straight after.`
                  : `${org.removes.length} stack${org.removes.length === 1 ? '' : 's'} will be removed.${privateCount ? ' Your private notes and documents are not touched.' : ''}`}
              </div>
            )}
            {(() => {
              const quietOnly = !!(diff && !total && vidFound);
              const label = diff
                ? (quietOnly ? 'Keep the video suggestions'
                  : confirmReplace ? `Yes — apply ${total} change${total === 1 ? '' : 's'}`
                  : `Apply ${total} change${total === 1 ? '' : 's'}`)
                : `Add ${total} to my day`;
              const can = total > 0 || quietOnly;
              return (
                <button onClick={apply} disabled={!can} style={{ ...BTN_PRIMARY, marginTop: (capErr || (org && org.removes.length)) ? 12 : 22, opacity: can ? 1 : .45 }}>{label}</button>
              );
            })()}
            </div>
            <button onClick={() => setStep(2)} style={{ ...BTN_GHOST, marginTop: 10, border: 'none' }}>← Paste a different reply</button>
          </div>
        )}

        {/* ── 4 DONE (+ "would you like to add a video or link to this?") ── */}
        {step === 4 && applied && (
          <div style={{ paddingTop: 18, animation: 'ppwScreenIn .5s cubic-bezier(.26,1,.4,1)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 999, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', boxShadow: 'var(--acc-glow)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
              </div>
              <div style={{ marginTop: 16, fontSize: 22, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{applied.kind === 'organise' ? 'Your stacks are organised' : 'Added to your day'}</div>
              <p style={{ margin: '8px auto 0', maxWidth: 280, fontSize: 14, lineHeight: 1.55, color: 'var(--dim)' }}>
                {applied.kind === 'organise'
                  ? [applied.changed.length && `${applied.changed.length} changed`, applied.added.length && `${applied.added.length} new`, applied.removedCount && `${applied.removedCount} removed`].filter(Boolean).join(', ') || 'Video suggestions kept'
                  : `${applied.count} thing${applied.count === 1 ? '' : 's'} scheduled`}. You can edit any of them like anything else.
              </p>
            </div>

            {/* THE LITTLE TUTORIAL (Vic, 2026-10-17): "would you like to add a
                video or link to this?" — asked right here, for each stack the
                AI just added or changed that could take one, with what is
                already waiting for it (the AI's checked suggestions, or our
                picks). The picker opens on top and comes back here. */}
            {videoCandidates.length > 0 && (
              <div data-tour="ai-videos" style={{ marginTop: 22, padding: 14, borderRadius: 20, ...CARD }}>
                <div style={{ fontSize: 14, fontWeight: 700, textShadow: 'var(--emboss)' }}>Would you like to add a video or link to these?</div>
                <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)' }}>Optional. You can do it any time — tap ▶ Video on a stack.</div>
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {videoCandidates.map((it) => {
                    const has = !!(it.url || it.embed);
                    const nRec = Array.isArray(it.recs) ? it.recs.length : 0;
                    const nPick = picksFor(it, 3).length;
                    const hint = has ? (it.mediaTitle || 'Video added')
                      : nRec ? `${nRec} suggested by your AI`
                      : nPick ? `${nPick} PPW pick${nPick === 1 ? '' : 's'}`
                      : 'Search YouTube for one';
                    return (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 10px 12px', borderRadius: 14, background: 'var(--track)', border: '1px solid var(--hairline)' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: 'anywhere' }}>{it.title}</div>
                          <div style={{ marginTop: 2, fontSize: 11.5, color: has ? 'var(--accent)' : 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{has ? '✓ ' : ''}{hint}</div>
                        </div>
                        <button onClick={() => openVideoPicker(it.id)} style={{ flex: 'none', minHeight: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${has ? 'var(--rim)' : 'var(--acc-rim)'}`, background: has ? 'transparent' : 'var(--acc-surf)', color: has ? 'var(--dim)' : 'var(--acc-ink)', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {IVideo}{has ? 'Change' : 'Add a video'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={finishAndClose} style={{ ...BTN_PRIMARY, marginTop: 22 }}>See my stack</button>
            <button onClick={undo} style={{ ...BTN_GHOST, marginTop: 10 }}>Undo — put it all back</button>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 26, zIndex: 3, padding: '13px 16px', borderRadius: 16, textAlign: 'center', background: 'var(--surface-strong)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', animation: 'ppwRise .3s ease both' }}>{toast}</div>
      )}
    </div>
  );
}
