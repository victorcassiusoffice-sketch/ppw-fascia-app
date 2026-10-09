// ─────────────────────────────────────────────────────────────────────────
// store5.js — New Design app state + persistence.
//
// Ports the prototype DCLogic's state model + its localStorage persistence
// (the `ppw5.` key namespace — deliberately separate from the current app's
// `ppw.` keys, so the New Design runs on its own data and the old app is never
// touched). Faithful ports of starterDeck / itemOnDate / stackFor / date math.
//
// Exposed as a tiny external store (useSyncExternalStore) so any app5 screen
// subscribes with useStore5(). Grows one slice at a time as screens are ported.
// ─────────────────────────────────────────────────────────────────────────
import { deleteFile } from './files5.js';

import { useSyncExternalStore } from 'react';
import { cachedPremium, fetchEntitlement, isSignedIn, signOut as membershipSignOut, PREMIUM_OPEN } from './membership.js';
import { fetchProfile, saveProfile } from './profile.js';
import { isDemo } from './demo.js';

const LS = (k) => 'ppw5.' + k;

// ── the two write primitives ────────────────────────────────────────────────
// EVERY localStorage write in this file goes through these, so the demo's "touch
// nothing on this device" promise is one check in one place rather than a flag
// remembered at a dozen call sites. A demo runs entirely in memory: a prospect
// tapping around an embed on ppwellness.co must not be able to leave a mark on
// the browser of someone who later uses the app properly — and must certainly
// not overwrite a day they had already built. See demo.js.
//
// isDemo() is read per write, not captured once, because this module is imported
// before anything has had a chance to read a URL.
function lsWrite(k, v) { if (isDemo()) return; try { localStorage.setItem(LS(k), v); } catch {} }
function lsDrop(k) { if (isDemo()) return; try { localStorage.removeItem(LS(k)); } catch {} }

// ── curated starter deck (verbatim from the prototype) ──
/**
 * F6 (UX pass 2026-08-11) — these four are OURS, not the user's.
 *
 * They exist so the app has something to show instead of an empty screen, but
 * they carried no marking, so after sign-up a new customer's "day" was three
 * YouTube videos and an affirmation that they never chose and could not tell
 * apart from their own. `example: true` lets the card say so, and lets the user
 * clear the lot in one tap.
 */
function starterDeck() {
  const yt = (xid, time, id, title, meta) => ({
    id: xid, time, title, meta, thumb: 'yt', repeat: 'daily', example: true,
    url: 'https://www.youtube.com/watch?v=' + id,
    embed: 'https://www.youtube.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0',
    thumbUrl: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg',
  });
  return [
    yt('d1', '07:30', 'v7AYKMP6rOE', 'Yoga For Complete Beginners', 'YouTube · Basic Yoga · 20 min'),
    yt('d2', '12:30', 'O-6f5wQXSu8', 'Guided Meditation for Calm', 'YouTube · Meditation · 10 min'),
    yt('d3', '17:00', 'UBMk30rjy0o', 'Full Body Workout, No Equipment', 'YouTube · Fitness · 20 min'),
    { id: 'd4', title: 'I did enough today. I am consistent.', meta: 'Text · Still', time: '21:00', kind: 'note', noteAnim: 'still', noteSpeed: 'med', noteDur: '5', repeat: 'daily', example: true },
  ];
}

/** True while the day is still entirely the examples we put there. */
export function onlyExamplesLeft() {
  const d = state.deckItems;
  return d.length > 0 && d.every((it) => it.example);
}

/** Clear the examples in one tap, for someone who wants their own day. */
export function clearExamples() {
  setState({
    deckItems: state.deckItems.filter((it) => !it.example),
    selectedIds: [],
  });
  saveStacks();
}

// ── initial state (subset in use so far; grows as screens are ported) ──
function initialState() {
  const def = {
    screen: 'stack',
    // theme
    // DEFAULT COLOURWAY (Vic, 2026-10): a new user opens on `indigo`. This
    // supersedes the 2026-08-07 decision that made it `gloft` (which itself
    // superseded graphite). It is the first-impression surface, so it is a
    // product decision rather than a style tweak. Anyone who has already chosen
    // a theme keeps it — the saved-preference read further down overrides this
    // line, never the other way round.
    //
    // NO MIGRATION, deliberately. We do NOT write `ppw5.soft = 'gloft'` for the
    // existing untouched cohort, for three reasons. (1) `ppw5.soft` is written
    // only by the Settings colourway picker, so key-present means "chose" and
    // key-absent means "never chose" — stamping a value would permanently fake a
    // choice and make every future default change impossible for that cohort.
    // (2) The graphite→gloft swap was itself migration-free, so these same users
    // have already been flipped once by a decision of exactly this shape.
    // (3) Indigo measures BETTER on ink-on-ground contrast at every stop of the
    // gradient (4.79/7.51/11.69 vs gloft's 4.13/6.02/7.33), so nobody who is
    // flipped ends up worse off.
    //
    // Keep this line on ONE line in this exact shape — brand-and-default-theme
    // .test.jsx regex-matches `skin: 'soft', bg: '\w+', soft: '(\w+)'` out of
    // this source file, so that a stray setState in another test cannot mask
    // what a brand-new install actually gets.
    skin: 'soft', bg: 'grey', soft: 'indigo', gelBg: 'zen', intensity: null, customBgUrl: null,
    glassStyle: 'frosted', inkMode: 'light',
    // routines (premium): [{ id, name, items: [snapshot…] }]
    routines: [],
    a11y: { on: false, zoom: 1 },
    // membership. `signedIn` is state, not a localStorage read at render time, so
    // every surface (header, onboarding, settings) flips the moment sign-in lands.
    // `premium` is the EFFECTIVE unlock the app runs on. `premiumPaid` is the
    // server's own verdict and nothing else — see PREMIUM_OPEN in membership.js.
    // Keeping them apart is what lets the B2B switch unlock the app without
    // telling a non-payer they have a membership, and what lets a real
    // subscriber survive the switch going back to false.
    premium: false, premiumPaid: false, premiumUpsell: null, orbTipSeen: false, signedIn: isSignedIn(),
    // What a batch add asked for when the free cap refused it — see
    // raiseFreeCapUpsell. Null for every other paywall.
    capRefusal: null,
    // stack data
    deckItems: starterDeck(),
    doneByDate: {},
    suppSel: {},
    importedProtos: [],
    // media library (verbatim starters from the prototype)
    mediaItems: [
      { id: 'm1', title: 'Deep Tissue Soundscape', meta: 'Spotify · 20 min', thumb: 'sp', note: true, url: 'https://open.spotify.com' },
      { id: 'm2', title: 'Yoga For Complete Beginners', meta: 'YouTube · Basic Yoga · 20 min', thumb: 'yt', url: 'https://www.youtube.com/watch?v=v7AYKMP6rOE', embed: 'https://www.youtube.com/embed/v7AYKMP6rOE?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/v7AYKMP6rOE/hqdefault.jpg' },
      { id: 'm3', title: 'Wim Hof Guided Breathing', meta: 'YouTube · Breathwork · 11 min', thumb: 'yt', url: 'https://www.youtube.com/watch?v=tybOi4hjZFQ', embed: 'https://www.youtube.com/embed/tybOi4hjZFQ?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/tybOi4hjZFQ/hqdefault.jpg' },
    ],
    // library tab
    stackTab: 'routines',
    // A routine someone shared by link, parsed and waiting for an answer
    // (2026-10-05). It is HELD, never applied: the fragment reader on boot only
    // decodes, so nothing a stranger sends can write to the deck or to routines
    // without the recipient tapping it. Mirrored to `ppw5.pendingShare` because
    // a recipient who has never opened the app meets the first-run doors and the
    // terms gate first, and a reload during that would otherwise lose the
    // programme — the fragment is already gone from the URL by then.
    // shareError: a link that arrived corrupt, so the app can say so instead of
    // looking like it ignored the tap. It is deliberately ORTHOGONAL to
    // pendingShare (2026-10-05, review pass): a bad SECOND link used to null the
    // held programme in state while leaving it on disk, and the error panel's
    // only button then deleted that orphan — so acknowledging "that link didn't
    // open" was what destroyed the programme that did. An error about a new link
    // must never touch a programme already waiting.
    //
    // shareHidden: the recipient tapped the sheet away WITHOUT answering it.
    // Dismissal used to BE the delete — the backdrop and "Not now" both called
    // clearPendingShare, and `#r=` was already stripped from the URL — so one
    // stray tap on the dim upper half of the screen lost a six-week prescription
    // with no undo and no mention of it anywhere else in the app. Hiding keeps
    // both copies: the sheet is one tap away from the "1 programme waiting" chip,
    // and the localStorage mirror brings it back on the next launch. NOT
    // persisted, on purpose — an unanswered programme reappearing is the whole
    // point of that mirror, and there is now an explicit "Discard this
    // programme" for a real no.
    pendingShare: null, shareError: null, shareHidden: false,
    // add sheet
    addOpen: false, customUrl: '', addedCustom: null,
    // library "Add to Stack" calendar picker
    scheduleTarget: null,
    // AI bridge sheet ("Talk to your AI") — zero-cost paste-prompt flow
    aiOpen: false,
    // protocols from the GitHub manifest (item 1)
    protocols: [], protocolsStatus: 'idle',
    // note / affirmation composer
    noteOpen: false, noteText: '', noteAnim: 'still', noteSpeed: 'med', noteTime: '09:00', noteDur: '5',
    // calendar → stack (per-date view; null = today)
    viewDate: null,
    // in-app media viewer (null = closed)
    playerItem: null,
    // completed-today sheet
    completedOpen: false,
    // account sheet (sign in / membership, reachable from the Stack header).
    // accountMode: 'signin' | 'create' — the same sheet, two front doors, because
    // a new customer and a returning one need different words for the same form.
    // justCreated: the account was made by the sign-in that just happened.
    // firstRunChoice: has this device been offered "create / already have one"?
    // signInError: a sign-in that failed somewhere the user wasn't looking (a dead
    // magic link lands on the Stack screen), carried to the screen that can act on it.
    accountOpen: false, accountMode: 'signin', justCreated: false, firstRunChoice: false, signInError: null,
    // runtime popups: slot reminder banner + full-screen note (affirmation)
    slotPop: null, notePop: null, eatingNow: false, autoplay: false,
    // general prefs
    sounds: true,
    // repeat picker (repeatId = item being edited, null = closed)
    repeatId: null,
    // edit-stack sheet (editId = the item whose settings are open, null = closed).
    // The one place a stack's every setting can be changed after it was added —
    // a note's message + Still/Pulse/Scroll/Flash style especially, which had no
    // re-edit path at all before (Vic 2026-08-31).
    editId: null,
    // terms & health disclaimer overlay
    termsOpen: false,
    // onboarding (first run: onboarded=false → wizard over the app)
    onboarded: false, obStep: 0, termsOk: false,
    obLifestyle: ['Office & desk-bound'], obAnchors: [], obInterests: ['Meditation'],
    obLevels: { Yoga: 5, Fitness: 5, Meditation: 5, Breathwork: 5, 'Cold exposure': 5 },
    obCustom: '', obBody: ['Stress'],
    obModules: { Routines: true, Media: true, Protocols: true, Supplements: false },
    discreet: true, dayT: { wake: '07:00', bed: '22:30', ws: '09:00', we: '17:00' },
    fastOn: false, eatOpen: '12:00', eatClose: '20:00',
    reminders: true,
    integrations: { spotify: false, youtube: true },
    courseLinks: [], courseLabel: '', courseUrl: '',
    obCreators: [], creatorInput: '',
    // ── GUIDED ONBOARDING (2026-08-24) ──────────────────────────────────
    // "Your Guide": eight one-minute quests that teach the app by doing the
    // real thing on the real screen. The coach is store-driven (not App5-local)
    // so a quest step can advance on a real store event — the whole point of a
    // do-it-yourself tour.
    //   coach:       null | { steps, questId?, i }  — the live spotlight tour
    //   journalOpen: the quest journal sheet
    //   hint:        null | { id } — the one-shot contextual hint bubble
    //   lastAddedId: set by every add path, so a step can anchor "the thing you
    //                just made" and a hint can point at it
    //   aiStep:      AiBridgeSheet mirrors its internal step here (1..4)
    //   calSelKey:   which day the Calendar's panel is showing. This lived as
    //                local component state, which meant "they opened tomorrow"
    //                was invisible to everything outside that one component —
    //                and Quest 4 has to know. Lifted, not duplicated.
    coach: null, journalOpen: false, hint: null, lastAddedId: null, aiStep: 0, calSelKey: null, calMonthOff: 0,
    guide: { q: {} }, hints: {}, hintsOff: false,
    // selection / interaction
    selectedIds: [],
    // completed
    completed: [], completedDate: null,
  };
  // THE DEMO (?demo=1) — before the device is read, not after. See demo.js.
  //
  // Returning here is the whole of "it must not pollute a real user's data" on
  // the READ side: the entire hydration pass below is skipped, so the demo
  // cannot show one visitor's own day back to them inside a marketing page,
  // cannot inherit a half-finished wizard, and cannot be thrown by whatever
  // state the browser was already in. (The one device read that happens ABOVE
  // this line — `signedIn: isSignedIn()` in the literal — is discarded in
  // demoState.) The write side is lsWrite/lsDrop at the top of this file.
  if (isDemo()) return demoState(def);
  try {
    const g = (k) => localStorage.getItem(LS(k));
    const gj = (k) => { try { return JSON.parse(g(k) || 'null'); } catch { return null; } };
    if (g('bg') && g('bg') !== 'custom') def.bg = g('bg');
    if (g('soft')) def.soft = g('soft');
    if (g('skin')) def.skin = g('skin');
    if (g('gelBg') && g('gelBg') !== 'custom') def.gelBg = g('gelBg');
    if (g('intensity')) def.intensity = g('intensity');
    // PREMIUM (G3, 2026-07-28): NOT hydrated from a bare localStorage flag any
    // more. `ppw5.premium` used to be the whole paywall — set it to '1' in
    // DevTools and everything unlocked. It is now only a mirror of the last
    // server answer; cachedPremium() re-checks that the user is still signed in,
    // that the value came from a verified /api/me/entitlement read, that it isn't
    // stale, and that the paid period hasn't lapsed. Only the server grants Premium.
    // PREMIUM_OPEN (2026-10-05): the paid answer is recorded as it always was,
    // then the switch decides what the app actually runs on. With the switch off
    // these two are the same value and boot behaves exactly as it did.
    def.premiumPaid = cachedPremium();
    def.premium = PREMIUM_OPEN || def.premiumPaid;
    if (g('orbTip') === '1') def.orbTipSeen = true;
    if (g('onboarded') === '1') def.onboarded = true;
    if (g('terms') === '1') def.termsOk = true;
    // Someone who already set the app up has met the first-run choice by
    // definition — don't show a "create an account" screen to an existing user.
    if (g('frc') === '1' || def.onboarded) def.firstRunChoice = true;
    if (g('reminders')) def.reminders = g('reminders') === '1';
    if (g('sounds') === '0') def.sounds = false;
    if (g('autoplay') === '1') def.autoplay = true;
    if (g('glassStyle')) def.glassStyle = g('glassStyle');
    if (g('inkMode')) def.inkMode = g('inkMode');
    const rt = gj('routines'); if (Array.isArray(rt)) def.routines = rt;
    // A held share survives a reload (gj already swallows garbage), but only if
    // it still looks like one — a half-written key must not put an empty sheet
    // on screen with nothing to accept.
    const ps = gj('pendingShare');
    if (ps && typeof ps === 'object' && Array.isArray(ps.items) && ps.items.length) {
      // `dropped` comes back with it. The recipient this mirror exists for is
      // the one who reloads before ever seeing the sheet (first-run doors, then
      // the terms gate), so dropping the count here would lose it on exactly
      // the path where it is the only surviving record that the link carried
      // more stacks than arrived — see parseRoutineLink.
      def.pendingShare = {
        name: String(ps.name || 'Shared routine').slice(0, 60),
        items: ps.items,
        dropped: Math.max(0, Math.floor(Number(ps.dropped)) || 0),
      };
    }
    const ay = gj('a11y'); if (ay && typeof ay === 'object') def.a11y = { on: !!ay.on, zoom: (+ay.zoom >= .85 && +ay.zoom <= 1.4) ? +ay.zoom : 1 };
    const gd = gj('guide'); if (gd && typeof gd === 'object') def.guide = { q: (gd.q && typeof gd.q === 'object') ? gd.q : {}, ...(gd.done ? { done: gd.done } : {}), ...(gd.welcomed ? { welcomed: gd.welcomed } : {}) };
    const hn = gj('hints'); if (hn && typeof hn === 'object') def.hints = hn;
    if (g('hintsOff') === '1') def.hintsOff = true;
    // MIGRATION (2026-08-24): anyone who already met the old 5-step tour, or is
    // already onboarded, skips the new 2-step WELCOME only. Every quest and
    // every hint stays armed — veterans of the old tour were never taught any
    // of this, so silencing the guide for them would be a downgrade.
    if (!def.guide.welcomed && (g('tourSeen') === '1' || g('onboarded') === '1')) {
      def.guide = { ...def.guide, welcomed: 1 };
      lsWrite('guide', JSON.stringify(def.guide));
    }
    const cs = gj('courses'); if (Array.isArray(cs)) def.courseLinks = cs;
    const ig = gj('integrations'); if (ig && typeof ig === 'object') def.integrations = ig;
    const pf = gj('prefs');
    if (pf && typeof pf === 'object') {
      if (Array.isArray(pf.l)) def.obLifestyle = pf.l;
      if (Array.isArray(pf.b)) def.obBody = pf.b;
      if (Array.isArray(pf.i)) def.obInterests = pf.i;
      if (typeof pf.c === 'string') def.obCustom = pf.c;
      if (pf.lv && typeof pf.lv === 'object') def.obLevels = { ...def.obLevels, ...pf.lv };
      if (Array.isArray(pf.a)) def.obAnchors = pf.a;
      if (Array.isArray(pf.cr)) def.obCreators = pf.cr;
    }
    const pf2 = gj('prefs2');
    if (pf2 && typeof pf2 === 'object') {
      if (typeof pf2.d === 'boolean') def.discreet = pf2.d;
      if (pf2.t && pf2.t.wake) def.dayT = pf2.t;
      if (pf2.f) { def.fastOn = !!pf2.f.on; if (pf2.f.o) def.eatOpen = pf2.f.o; if (pf2.f.c) def.eatClose = pf2.f.c; }
    }
    // stacks live in one consolidated blob; legacy per-key blobs load as fallback
    const st = gj('stacks') || {};
    const di = Array.isArray(st.d) ? st.d : gj('deckItems'); if (Array.isArray(di) && di.length) def.deckItems = di;
    const db = (st.db && typeof st.db === 'object') ? st.db : gj('doneByDate'); if (db && typeof db === 'object') def.doneByDate = db;
    const ss = (st.ss && typeof st.ss === 'object') ? st.ss : gj('suppSel'); if (ss && typeof ss === 'object') def.suppSel = ss;
    const ip = Array.isArray(st.ip) ? st.ip : gj('importedProtos'); if (Array.isArray(ip)) def.importedProtos = ip;
  } catch { /* private mode / storage off → defaults */ }
  return def;
}

/**
 * The store a demo visitor boots into — the embed on ppwellness.co.
 *
 * NO NEW CONTENT. The day is already furnished: `def.deckItems` is
 * `starterDeck()`, the four slots marked `example: true` that every brand-new
 * install gets, and `mediaItems` already carries three library starters. A demo
 * is a brand-new install that is never written down, so it needs no seed of its
 * own — it needs the first-run QUESTIONS answered, which is what this does.
 *
 * Those four cards still say "Example" on their own faces and the day still
 * carries its "these are examples" note, which is the right thing to show a
 * prospect: they are looking at a furnished demo and the app says so in its own
 * words, above and beyond the Demo marker in the frame.
 *
 * The one addition is a routine, bundled from those same starter stacks, because
 * Library opens on the routines tab and that tab is the only screen in the app
 * that would otherwise be empty — an empty screen is exactly what a demo must
 * not open on. Reuse, not invention: the items are the starter deck's own.
 */
function demoState(def) {
  // The three timed media slots, without the affirmation — a routine is a block
  // of things to do, and a note sitting at 21:00 is not that. Copied, so the
  // routine's snapshots can never alias the live deck items.
  const bundle = def.deckItems.filter((it) => it.kind !== 'note').map((it) => ({ ...it }));
  return {
    ...def,
    // Every first-run door answered. A prospect in an iframe is not a first run
    // — they cannot be asked to accept terms on behalf of a licence they have
    // not been sold, and a wizard is not a demo of an app. `onboarded` also
    // keeps FirstRunChoice down (it bails on `firstRunChoice || onboarded`), and
    // `termsOk` is what the wizard's consent gate waits for.
    onboarded: true, firstRunChoice: true, termsOk: true,
    // `welcomed` stands the two-step coach-mark welcome down, which would
    // otherwise mount 700ms after load and dim the whole frame. The eight
    // quests and the guide disc are left armed — those are the product.
    guide: { q: {}, welcomed: 1 },
    // One-shot teaching bubbles are for someone learning their own app. In a
    // shop window they are clutter that arrives unprompted.
    hintsOff: true,
    // Whatever session is on this device belongs to a real person using the app
    // properly; a demo must not wear their account. Discarded, not read again.
    signedIn: false,
    // What a visitor actually gets today. PREMIUM_OPEN is the B2B switch in
    // membership.js: while it is on, this is `true` and the demo shows the whole
    // product. If the paid tier is ever switched back on, the demo shows exactly
    // what an unpaid visitor would meet — which is the honest default, because a
    // demo that unlocks more than the thing being demoed is a lie.
    premium: PREMIUM_OPEN, premiumPaid: false,
    routines: bundle.length
      ? [{ id: 'rtDemoExample', name: 'Example routine', items: bundle }]
      : [],
  };
}

// ── external store plumbing ──
let state = initialState();
const listeners = new Set();
function emit() { for (const l of listeners) l(); }
function subscribe(l) { listeners.add(l); return () => listeners.delete(l); }
function getSnapshot() { return state; }

// merge + notify (React-setState-like). Accepts object or updater fn.
export function setState(patch) {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  emit();
}
export function getState() { return state; }

export function save(k, v) { lsWrite(k, String(v)); }

// consolidated, debounced stacks write; completed-history pruned to 60 days
let _saveT = null;
function writeStacks() {
  try {
    const today = todayKey();
    const db = {};
    Object.keys(state.doneByDate).forEach((k) => {
      const d = dayDiff(today, k);
      if (d <= 60 && d > -400) db[k] = state.doneByDate[k];
    });
    lsWrite('stacks', JSON.stringify({
      d: state.deckItems.filter((x) => !x.local), db, ss: state.suppSel, ip: state.importedProtos,
    }));
    ['deckItems', 'doneByDate', 'suppSel', 'importedProtos'].forEach((k) => lsDrop(k));
  } catch {}
}
export function saveStacks() {
  if (_saveT) clearTimeout(_saveT);
  _saveT = setTimeout(() => { _saveT = null; writeStacks(); }, 200);
}

// ── date math + recurrence (verbatim from the prototype) ──
export function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
export function keyToDate(k) { const p = String(k).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
export function dayDiff(aKey, bKey) { return Math.round((keyToDate(aKey) - keyToDate(bKey)) / 86400000); }
export function itemOnDate(it, key) {
  if (!it.anchor) return true; // legacy items — every day
  const d = dayDiff(key, it.anchor);
  const r = it.repeat === undefined ? 'daily' : it.repeat;
  if (r === 'once') return d === 0;
  if (d < 0) return false;
  if (r === 'daily') return true;
  if (r === 'weekly') return d % 7 === 0;
  const n = parseInt(r, 10);
  return n > 1 ? d % n === 0 : true;
}
// items scheduled on `key`, excluding those already marked done that day.
export function stackFor(key) {
  const done = (state.doneByDate[key] || []).map((x) => x.id);
  return state.deckItems.filter((it) => itemOnDate(it, key) && done.indexOf(it.id) === -1);
}

// ── stack operations ──
// W12 (2026-07-29): the free cap used to be the bare literal `10` at four call
// sites, with its upsell copy hand-duplicated at seven more. Changing the number
// meant finding eleven places and getting all of them right. One constant now,
// and the copy is derived from it so the two can never drift apart.
//
// ⚠ This cap is TOTAL, not per-day — `deckItems.length` counts every item on
// every date, forever (T7). A fresh install ships 4 starter items, so a free
// user has 6 slots for the life of the app. The copy below deliberately still
// reads as it shipped; whether that limit and that wording are right is a
// product decision for Vic, not a refactor.
/**
 * premiumGated() — "does the paid tier apply to this user, right now?"
 *
 * THE ONE QUESTION every gate in this file asks. It exists so the B2B switch is
 * answered in a single place instead of being sprinkled through a dozen `if`s:
 * while PREMIUM_OPEN is true this is always false, so each gate below runs its
 * normal test, finds nothing to refuse, and falls through. Flip the constant and
 * every one of them reads and behaves exactly as it did before.
 *
 * Deliberately NOT `!state.premium` on its own: a caller that forces
 * `state.premium = false` (an old view, a test, a console poke) must not be able
 * to resurrect a paywall the business has switched off.
 */
export function premiumGated(S = state) { return !PREMIUM_OPEN && !S.premium; }

export const FREE_STACK_CAP = 10;
// This used to end "Go Premium for unlimited stacks." — a call to action for a
// checkout that no longer exists (2026-10-08). A refusal's job is to say what
// happened and what the person can do themselves; selling the way out of it was
// never part of that, and now there is nothing to sell.
export const FREE_CAP_UPSELL = `You have reached the limit of ${FREE_STACK_CAP} stacks on this plan.`;
export function overLimit() { return premiumGated() && state.deckItems.length >= FREE_STACK_CAP; }

/**
 * The refusal a BATCH add gets (2026-10-05, review pass).
 *
 * FREE_CAP_UPSELL is an at-the-cap sentence and the single adds that raise it
 * really are at the cap (`overLimit()`). A batch add is a different test —
 * `deck + batch > cap` — and reusing the sentence told a client holding 4 of 10
 * stacks that they had "reached the free limit of 10", which is simply false,
 * and then the paywall offered "Clear the examples" as the remedy. Four freed
 * slots cannot hold a 20-stack programme, so the tap destroyed the starter deck,
 * read as the problem being solved, and the retry failed identically with the
 * button now gone. Both numbers are known here, so say them.
 *
 * `capRefusal` carries the message it produced, so freeSlotAdviceApplies() can
 * tell a live cap refusal from a stale flag left behind by some other paywall.
 */
export function raiseFreeCapUpsell(wanted, used = state.deckItems.length) {
  // Nothing to count — fall back to the plain sentence rather than describing a
  // "0-stack programme".
  if (!(wanted > 0)) { setState({ premiumUpsell: FREE_CAP_UPSELL, capRefusal: null }); return FREE_CAP_UPSELL; }
  // Both sentences used to end in "go Premium for unlimited stacks" (removed
  // 2026-10-08). The numbers are the useful part and they stay; the only remedy
  // offered now is one the person can act on without paying anyone.
  const msg = wanted > FREE_STACK_CAP
    ? `This programme has ${wanted} stacks and this plan keeps ${FREE_STACK_CAP} in total, so none of it fits.`
    : `This plan keeps ${FREE_STACK_CAP} stacks in total, with ${used} in use, so this ${wanted}-stack programme does not fit. Clear what you no longer need and try again.`;
  setState({ premiumUpsell: msg, capRefusal: { wanted, used, msg } });
  return msg;
}

/**
 * Does "the example cards count — clearing them frees their slots" apply to the
 * paywall on screen? True at the cap, and true for a batch that would fit once
 * slots were freed. FALSE for a batch bigger than the whole cap, where clearing
 * cannot possibly help — which is the suggestion this closes.
 */
export function freeSlotAdviceApplies(S = state) {
  if (!S.premiumUpsell) return false;
  if (S.premiumUpsell === FREE_CAP_UPSELL) return true;
  const c = S.capRefusal;
  return !!c && c.msg === S.premiumUpsell && c.wanted <= FREE_STACK_CAP;
}

export function markDone(id, key = todayKey()) {
  const it = state.deckItems.find((x) => x.id === id);
  if (!it) return;
  const prev = state.doneByDate[key] || [];
  if (prev.some((x) => x.id === id)) return;
  setState({ doneByDate: { ...state.doneByDate, [key]: [...prev, { id, at: Date.now() }] } });
  saveStacks();
}
export function undoDone(id, key = todayKey()) {
  const prev = state.doneByDate[key] || [];
  setState({ doneByDate: { ...state.doneByDate, [key]: prev.filter((x) => x.id !== id) } });
  saveStacks();
}
export function setItemTime(id, time) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, time } : it) });
  saveStacks();
}
export function deleteItem(id) {
  const gone = state.deckItems.find((it) => it.id === id);
  const next = state.deckItems.filter((it) => it.id !== id);
  setState({ deckItems: next, selectedIds: state.selectedIds.filter((x) => x !== id) });
  saveStacks();
  // Free the blob only when the LAST stack pointing at it goes. Without this the
  // file stayed in IndexedDB forever and the user had no way to erase it.
  if (gone && gone.fileId && !next.some((it) => it.fileId === gone.fileId)) deleteFile(gone.fileId);
}
// ── edit-stack sheet (Vic 2026-08-31): re-open ANY stack's settings ──────────
// The gap this closes: a note (kind:'note') had NO re-edit path at all. Once
// addNote() had run you could change its time and repeat, but never its message
// or its Still/Pulse/Scroll/Flash style — so a wrong word or the wrong animation
// meant deleting it and starting again. `updateItem` is the generic in-place
// patch the EditStackSheet writes through; openEditItem/closeEditItem drive the
// sheet. One-layer-at-a-time (F2): opening it closes the add + account sheets.
export function openEditItem(id) { setState({ editId: id, addOpen: false, accountOpen: false }); }
export function closeEditItem() { setState({ editId: null }); }
export function updateItem(id, patch) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, ...patch } : it) });
  saveStacks();
}
export function reorderDeck(orderedIds) {
  const byId = Object.fromEntries(state.deckItems.map((it) => [it.id, it]));
  setState({ deckItems: orderedIds.map((id) => byId[id]).filter(Boolean) });
  saveStacks();
}
// per-item autoplay tickbox — when set, the slot engine opens the item at its
// time without a Play press (Vic #1).
export function toggleAuto(id) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, auto: !it.auto } : it) });
  saveStacks();
}
// no-time stacks (Vic #3, "Always Next Up first"): time:null → the item queues
// at the very top as Next Up, ahead of all timed items, in deck order.
export function setNoTime(id, on) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id ? { ...it, time: on ? null : (it._lastTime || '09:00'), _lastTime: on ? (it.time || '09:00') : it._lastTime } : it) });
  saveStacks();
}
// day-ordered view: no-time items first (deck order), then timed sorted by time.
const _toMin = (t) => { const [h, m] = String(t || '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export function orderedStackFor(key) {
  const items = stackFor(key);
  const noTime = items.filter((x) => !x.time);
  const timed = items.filter((x) => !!x.time).sort((a, b) => _toMin(a.time) - _toMin(b.time));
  return [...noTime, ...timed];
}
// drag reorder, times-stay-with-positions (Vic #2): the day's sorted times are
// fixed slots; dragging re-assigns which TIMED stack occupies which slot.
// orderedTimedIds = the timed items' ids in their new visual order.
export function reorderTimed(key, orderedTimedIds) {
  const timed = stackFor(key).filter((x) => !!x.time);
  const slots = timed.map((x) => x.time).sort((a, b) => _toMin(a) - _toMin(b));
  const timeById = {};
  orderedTimedIds.forEach((id, i) => { if (slots[i] !== undefined) timeById[id] = slots[i]; });
  setState({ deckItems: state.deckItems.map((it) => timeById[it.id] !== undefined ? { ...it, time: timeById[it.id] } : it) });
  saveStacks();
}

// ── routines (Vic #5, premium): named bundles of stacks, applied to a day ──
export function saveRoutines(list) {
  setState({ routines: list });
  lsWrite('routines', JSON.stringify(list));
}
export function createRoutine(name, items) {
  // G1 (2026-07-28): the store enforces this, not just the UI. LibraryScreen hides
  // the builder from free users, but hiding a button is not a paywall — anything
  // that can reach this function (a stale view, a future caller, the console) was
  // able to create routines for free until this guard existed.
  if (premiumGated()) {
    setState({ premiumUpsell: 'Routines are part of Premium — bundle stacks and drop them onto any day in one tap.' });
    return null;
  }
  const r = { id: 'rt' + Date.now().toString(36), name: String(name).trim(), items };
  saveRoutines([...state.routines, r]);
  return r;
}
export function deleteRoutine(id) { saveRoutines(state.routines.filter((r) => r.id !== id)); }
// edit a saved routine in place (Vic 1c)
export function updateRoutine(id, patch) {
  // W11 (2026-07-29): the last asymmetry in the routines paywall. `createRoutine`
  // and `applyRoutineToDate` both guard; this did not. Not exploitable today —
  // its only caller renders behind `S.premium` — but "the UI hides it" is the
  // exact reasoning the G1 guard above was added to stop relying on. A lapsed
  // subscriber whose routines are still on disk could otherwise keep editing them.
  if (premiumGated()) {
    setState({ premiumUpsell: 'Routines are part of Premium — bundle stacks and drop them onto any day in one tap.' });
    return null;
  }
  saveRoutines(state.routines.map((r) => r.id === id ? { ...r, ...patch } : r));
  return true;
}

// ── stack selection + bulk delete (Vic 4/4b) ──
export function toggleSelect(id) {
  const sel = state.selectedIds.includes(id) ? state.selectedIds.filter((x) => x !== id) : [...state.selectedIds, id];
  setState({ selectedIds: sel });
}
export function selectAll(ids) { setState({ selectedIds: [...new Set([...state.selectedIds, ...ids])] }); }
export function clearSelection() { setState({ selectedIds: [] }); }
export function deleteSelected() {
  const sel = new Set(state.selectedIds);
  if (!sel.size) return;
  setState({ deckItems: state.deckItems.filter((it) => !sel.has(it.id)), selectedIds: [] });
  saveStacks();
}
// ── Protocols from the build-time bundled manifest (Vic item 1) ──
// The refusal shown when a gated user taps a `monetised` protocol. Free protocols
// never reach this — they open for everyone as a lead magnet. "Unlock to open the
// full PDF and add it to any day" came off the end on 2026-10-08: there is nothing
// to unlock it with any more, and an instruction nobody can follow is worse than
// no instruction.
export const PREMIUM_PROTOCOL_UPSELL = 'This protocol is part of Premium, which is not on this account.';
let _protocolsLoaded = false;
export async function loadProtocols() {
  if (_protocolsLoaded) return;
  _protocolsLoaded = true;
  setState({ protocolsStatus: 'loading' });
  const { fetchProtocols } = await import('./protocols5.js');
  const { status, list } = await fetchProtocols();
  setState({ protocols: list, protocolsStatus: status });
}

// ── Library "Add to Stack" via calendar picker (Vic item 2) ──
// scheduleTarget: { type: 'item', item } | { type: 'routine', id } | null
/**
 * ONE LAYER AT A TIME (F2, UX pass 2026-08-11).
 *
 * A new customer crossed seven stacked layers — welcome walkthrough, account
 * sheet, password offer, terms, start choice, the four AI steps, a five-step
 * tour — and the ACCOUNT SHEET STAYED OPEN UNDERNEATH ALL OF IT. Close the last
 * overlay and you were dropped back onto a panel you had opened seven screens
 * ago, with no idea why it was there. It reads as plumbing, not a welcome.
 *
 * Anything that takes over the screen now closes the account sheet on its way in,
 * so each finished step leaves nothing behind it.
 */
export function openAiBridge() { setState({ aiOpen: true, addOpen: false, accountOpen: false }); }
export function closeAiBridge() { setState({ aiOpen: false }); }
export function openSchedule(target) { setState({ scheduleTarget: target }); }
export function closeSchedule() { setState({ scheduleTarget: null }); }
// ── add paths — every one records `lastAddedId` ────────────────────────────
// WHY: the guide points at the thing the USER just made, not at a generic row.
// "That one you just added" reads as help; anchoring the first row of a demo
// deck reads as a canned tour. Each add path writes `lastAddedId` inside the
// same setState that appends the item, so the anchor is live on the very render
// the item first appears on — one render, never a flash of the wrong target.
// Batch adds record the LAST id: the row nearest the bottom, where the eye lands.
// schedule one item snapshot onto an arbitrary date (repeat once, anchored)
export function addItemToDate(snapshot, dateKey, time = '09:00') {
  if (premiumGated() && state.deckItems.length + 1 > FREE_STACK_CAP) {
    setState({ premiumUpsell: FREE_CAP_UPSELL });
    return { upsell: true };
  }
  const { id, anchor, repeat, ...rest } = snapshot;
  const item = { ...rest, id: 'sc' + Date.now().toString(36), time: snapshot.time || time, anchor: dateKey, repeat: 'once' };
  setState({ deckItems: [...state.deckItems, item], lastAddedId: item.id });
  saveStacks();
  return { ok: true, item };
}

// add a Document stack to today (file already saved to IndexedDB → fileId)
export function addDocToToday(name, fileId) {
  if (overLimit()) { setState({ premiumUpsell: FREE_CAP_UPSELL }); return { upsell: true }; }
  const item = { id: 'doc' + Date.now().toString(36), title: name, meta: 'Document', thumb: 'doc', kind: 'doc', fileId, time: '09:00', repeat: 'daily' };
  setState({ deckItems: [...state.deckItems, item], addedCustom: item, lastAddedId: item.id });
  saveStacks();
  return { ok: true, item };
}

// ── ONE NAME FOR THE DAY OFFSET, EVERYWHERE (2026-10-05) ───────────────────
// `dayOffset` is the PUBLIC key: it is what a share payload carries, what the
// .md file writes, and what a saved routine item stores on disk. `_day` is the
// in-flight name a freshly PARSED item carries, and nothing else.
//
// The bug this closes: routineToMd serialised `r.items` whole, so it re-emitted
// the internal `_day` that parseRoutineMd had just attached — and parseRoutineMd
// only ever reads `dayOffset`. One export → import → export cycle therefore
// moved a day-21 stack to day 0, silently flattening a practitioner's six-week
// programme into a single morning. `_day` was also written straight into
// `ppw5.routines` by AddSheet's "Save as routine", so the leak was on disk as
// well as in the file.
//
// Every reader accepts EITHER key, forever — routines already saved with `_day`
// keep working, and nobody has to migrate storage.

/**
 * Normalise parsed items for storage in `ppw5.routines`: `_day` becomes
 * `dayOffset`, and an offset of 0 is omitted rather than stored as noise.
 * Nothing else is stripped — a builder's own fields (fileId, noteAnim, …) are
 * part of the routine and must survive a save.
 */
export function routineItemsForSave(items) {
  return (Array.isArray(items) ? items : []).map((it) => {
    if (!it || typeof it !== 'object') return it;
    const { _day, dayOffset, ...rest } = it;
    const d = normOffset(dayOffset ?? _day ?? 0, SHARE_MAX_OFFSET);
    return d > 0 ? { ...rest, dayOffset: d } : rest;
  });
}

// The ten keys parseRoutineMd reads back, and only those — see the note on
// routineToMd for why the payload stopped being `JSON.stringify(r.items)`.
// undefined values are dropped by JSON.stringify, so an item with no url writes
// no url and the file stays readable by a human.
function mdItem(it) {
  const d = normOffset(it.dayOffset ?? it._day ?? 0, SHARE_MAX_OFFSET);
  return {
    title: it.title,
    meta: it.meta || undefined,
    thumb: it.thumb || undefined,
    url: it.url || undefined,
    embed: it.embed || undefined,
    thumbUrl: it.thumbUrl || undefined,
    kind: it.kind || undefined,
    time: it.time || undefined,
    repeat: it.repeat || undefined,
    dayOffset: d > 0 ? d : undefined,
  };
}

// ── routine sharing via Markdown (Vic 2026-07-06) ──
// Human-readable MD with a fenced `ppw-routine` JSON block as the lossless
// machine payload. Import looks for the block first; the prose is for people.
//
// Since 2026-10-05 the file is the FALLBACK rail, not the main one: a routine
// normally travels as a link (routineToLink, below), and the file is what a
// programme too long for one URL falls back to — plus the desktop path, and the
// only route that still works on a device with no navigator.share.
//
// The payload now writes an EXPLICIT per-item field list instead of
// JSON.stringify-ing the items whole. Two reasons: it emits `dayOffset` rather
// than re-emitting the internal `_day` (the day-21 → day-0 bug above), and the
// list is exactly the keys parseRoutineMd reads, so export and import state the
// same contract in one place. Keys the importer always discarded stop being
// written at all — including `fileId`, which points at the SENDER's IndexedDB
// and could never have travelled.
export function routineToMd(r) {
  const lines = [
    `# ${r.name}`,
    '',
    `PPW Routine · ${r.items.length} stack${r.items.length === 1 ? '' : 's'} · shared from the PPWellness Lifestyle App`,
    '',
    'A PPW routine normally arrives as a link that opens straight in the app. This file is the fallback for a programme too long to fit in one.',
    '',
    'To use it: open the app → ＋ Add → **Import routine** → pick this file.',
    '',
    '## Stacks',
    '',
    ...r.items.map((it, i) => {
      const head = `${i + 1}. **${it.title}**${it.meta ? ` — ${it.meta}` : ''}${it.time ? ` · ${it.time}` : ''}`;
      return it.url ? head + `\n   ${it.url}` : head;
    }),
    '',
    '```ppw-routine',
    JSON.stringify({ ppw: 'routine', v: 1, name: r.name, items: r.items.map(mdItem) }, null, 2),
    '```',
    '',
  ];
  return lines.join('\n');
}
// SECURITY (2026-07-28): only absolute http(s) URLs may ever reach an <a href>
// or an <iframe src>. Item urls arrive from THREE untrusted places — an imported
// .md routine (someone else's file), a pasted share link, and (soon) an
// AI-generated plan — and are rendered raw in App5.jsx / MediaViewer.jsx. A
// `javascript:` or `data:` url there executes on tap. Strict allow-list: the
// string must literally begin with http:// or https://, so javascript:, data:,
// vbscript:, blob:, and protocol-relative //evil.com are all rejected.
export function safeUrl(u) {
  if (typeof u !== 'string') return undefined;
  const s = u.trim();
  if (!/^https?:\/\//i.test(s)) return undefined;
  try { new URL(s); } catch { return undefined; }
  return s.slice(0, 500);
}

// ── AI-bridge / plan v2 helpers ──────────────────────────────────────────────
export const PLAN_MAX_ITEMS = 60;
export const PLAN_MAX_OFFSET = 27;

// THE AI BRIDGE'S PLANNING CEILING IS NOT THE SHARE RAILS' CEILING (2026-10-05,
// review pass). PLAN_MAX_OFFSET is the four-week horizon the AI plans inside,
// and until now it governed prescribed programmes too: a six-week course's week
// 5, week 6 and discharge review were all rewritten to day 27 — three
// prescribed days merged into one, the last of them anchored a fortnight early,
// and neither the practitioner nor the client was told. A shared routine is the
// one thing this app carries that is routinely longer than four weeks (the
// feature exists to send exactly that), so the share rails get a ceiling that
// fits a real course of treatment — about six months — while the AI keeps its
// own. Still a ceiling: the offset arrives from a stranger's link.
export const SHARE_MAX_OFFSET = 180;

let _uidSeq = 0;
// Date.now() alone collides when a loop stages several items in the same ms —
// duplicate ids make deleteItem remove two rows and markDone tick two.
export function uid(prefix) { return prefix + Date.now().toString(36) + (_uidSeq++).toString(36); }

// "YYYY-M-D" — MUST match todayKey()'s UNPADDED format or the item files on a
// day the app never renders.
export function dateKeyFromOffset(n, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + (Number(n) || 0));
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// The slot engine and <input type="time"> both need zero-padded 24h. AIs emit
// "7am", "7:30", "07:30:00", "1300", "noon" — accept them all, or the time is
// silently dropped and the item lands at the 09:00 default.
export function normTime(v) {
  if (v == null) return null;
  let s = String(v).trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, ':');
  if (s === 'noon' || s === 'midday') return '12:00';
  if (s === 'midnight') return '00:00';
  if (/^\d{4}$/.test(s)) s = s.slice(0, 2) + ':' + s.slice(2);
  const m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm|a|p)?$/.exec(s);
  if (!m) return null;
  let h = +m[1];
  const min = m[2] === undefined ? 0 : +m[2];
  if (min > 59) return null;
  const ap = m[3] && m[3][0];
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  if (h > 23) return null;
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
}

// Synonym-mapped onto the app's real vocabulary (once | daily | weekly | "N").
// "every day" must NOT silently become a one-off.
export function normRepeat(v) {
  if (v == null) return undefined;
  const s = String(v).trim().toLowerCase().replace(/\s+/g, ' ');
  if (/^(daily|every ?day|everyday|each ?day|every single day)$/.test(s)) return 'daily';
  if (/^(weekly|every ?week|each ?week|once a week|same day each week)$/.test(s)) return 'weekly';
  if (/^(once|just once|one ?off|one time|single|today only)$/.test(s)) return 'once';
  if (/^every other day$/.test(s)) return '2';
  const m = /^(?:every )?(\d{1,2})(?: ?days?)?$/.exec(s);
  if (m) { const n = +m[1]; if (n === 1) return 'daily'; if (n >= 2 && n <= 14) return String(n); }
  return undefined; // unknown → default applied, and the preview shows it
}

// `max` defaults to the AI's four-week horizon, so every existing caller keeps
// the ceiling it had; the share rails pass SHARE_MAX_OFFSET (see the note on it).
export function normOffset(v, max = PLAN_MAX_OFFSET) {
  const n = Math.floor(Number(v));
  if (!isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

/**
 * parsePlanDoc(data) — whitelist a parsed plan object into safe stack items.
 * v1 (no dayOffset/repeat) stays backward compatible: everything lands today,
 * repeat 'once', exactly as before.
 * → { ok:true, name, items:[{...snapshot, _day, _repeat}] } | { ok:false, reason }
 */
// An AI's video suggestion, kept as an unverified CLAIM. Nothing is attached to
// the item here: the id is checked against YouTube in the preview first
// (assistant/verifyVideo.js), because models fabricate ids that look real.
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;
function videoClaim(v) {
  if (!v || typeof v !== 'object') return undefined;
  const q = v.q ? String(v.q).trim().slice(0, 120) : undefined;
  const yt = YT_ID_RE.test(String(v.yt || '')) ? String(v.yt) : undefined;
  return (q || yt) ? { q, yt } : undefined;
}

export function parsePlanDoc(data) {
  if (!data || data.ppw !== 'routine' || !Array.isArray(data.items) || !data.items.length) {
    return { ok: false, reason: 'bad-shape' };
  }
  const items = data.items.slice(0, PLAN_MAX_ITEMS).map((it) => {
    if (!it || typeof it !== 'object') return null;
    const title = String(it.title || '').trim().slice(0, 120);
    if (!title) return null; // a bare string in the list is not an item
    return {
      title,
      meta: it.meta ? String(it.meta).slice(0, 120) : undefined,
      // The prompt promises the model "any link you write is deleted on import"
      // (aiPrompt.js). That was not true: safeUrl only validates the SCHEME, so a
      // fabricated https://www.youtube.com/embed/<madeup> passed straight through
      // and rendered as a live iframe. Make the promise true for the AI bridge.
      // NOTE: the identical whitelist in parseRoutineMd is deliberately untouched —
      // a routine shared by a real person may carry a real, curated video.
      thumb: undefined,
      url: undefined,
      embed: undefined,
      thumbUrl: undefined,
      _video: videoClaim(it.video),
      kind: it.kind === 'note' ? 'note' : undefined,
      time: normTime(it.time) || undefined,
      _day: normOffset(it.dayOffset),
      _repeat: normRepeat(it.repeat) || 'once',
    };
  }).filter(Boolean);
  if (!items.length) return { ok: false, reason: 'bad-shape' };
  return { ok: true, name: String(data.name || 'My plan').slice(0, 60), items };
}

/**
 * addItemsToPlan(items) — apply a previewed plan across days.
 * Each item carries _day (offset) and _repeat. Untimed items stagger from 09:00.
 * Free tier: the 10-stack cap is checked ONCE for the whole batch.
 */
function stageItems(list) {
  const base = 9 * 60;
  let untimed = 0;
  return list.map((it) => {
    const { _day, _repeat, ...rest } = it;
    let time = it.time;
    if (!time) {
      const mins = base + (untimed++ * 30);
      time = String(Math.floor(mins / 60) % 24).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    }
    return { ...rest, id: uid('ai'), time, anchor: dateKeyFromOffset(_day || 0), repeat: _repeat || 'once' };
  });
}

export function addItemsToPlan(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { ok: false, reason: 'empty' };
  if (premiumGated() && state.deckItems.length + list.length > FREE_STACK_CAP) {
    // Same batch-vs-at-the-cap falsehood as addItemsToToday had — see
    // raiseFreeCapUpsell.
    raiseFreeCapUpsell(list.length);
    return { upsell: true };
  }
  const added = stageItems(list);
  // Guarded like its two sibling call sites. Today list.length >= 1 guarantees a
  // non-empty `added`, but an op-based apply (drops only) would crash here.
  setState({ deckItems: [...state.deckItems, ...added], lastAddedId: added.length ? added[added.length - 1].id : state.lastAddedId });
  saveStacks();
  return { ok: true, count: added.length, ids: added.map((a) => a.id) };
}

/**
 * applyPlanRebuild(items, replaceIds) — the "Start fresh" apply.
 *
 * Removes the stacks the AI was actually shown as replaceable, then adds what it
 * sent back. Anything private (a note, a document) was never offered to the AI
 * and is never touched here — see isPrivateKind in aiPrompt.js. The removed
 * stacks come back in full so Undo can restore them; the append-only Undo could
 * only ever take things away again, which is useless once a rebuild can delete.
 */
export function applyPlanRebuild(items, replaceIds) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return { ok: false, reason: 'empty' };
  const kill = new Set(replaceIds || []);
  const removed = state.deckItems.filter((it) => kill.has(it.id));
  const kept = state.deckItems.filter((it) => !kill.has(it.id));
  // The cap counts what SURVIVES, not what was there before. A rebuild that
  // shrinks the day must never trip the upsell.
  if (premiumGated() && kept.length + list.length > FREE_STACK_CAP) {
    // `kept.length`, not the whole deck: what is in use after the rebuild is
    // what the client has to reason about.
    raiseFreeCapUpsell(list.length, kept.length);
    return { upsell: true, fits: Math.max(0, FREE_STACK_CAP - kept.length) };
  }
  const added = stageItems(list);
  setState({
    deckItems: [...kept, ...added],
    lastAddedId: added.length ? added[added.length - 1].id : state.lastAddedId,
  });
  saveStacks();
  return { ok: true, count: added.length, ids: added.map((a) => a.id), removed };
}

/** Put back stacks a rebuild removed. Undo, for the half that deletes. */
export function restoreItems(items) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return;
  const have = new Set(state.deckItems.map((it) => it.id));
  const back = list.filter((it) => it && !have.has(it.id));
  if (!back.length) return;
  setState({ deckItems: [...state.deckItems, ...back] });
  saveStacks();
}

// Undo the most recent plan apply (single slot — matches the preview's one-tap Apply).
export function removeItemsByIds(ids) {
  const set = new Set(ids || []);
  if (!set.size) return;
  setState({ deckItems: state.deckItems.filter((it) => !set.has(it.id)) });
  saveStacks();
}

export function parseRoutineMd(text) {
  try {
    const m = /```ppw-routine\s*([\s\S]*?)```/.exec(String(text));
    if (!m) return { ok: false, reason: 'no-block' };
    const data = JSON.parse(m[1]);
    if (data.ppw !== 'routine' || !Array.isArray(data.items) || !data.items.length) return { ok: false, reason: 'bad-shape' };
    // sanitise: only known fields survive the import
    const items = data.items.map((it) => ({
      title: String(it.title || 'Stack').slice(0, 120),
      meta: it.meta ? String(it.meta).slice(0, 120) : undefined,
      thumb: typeof it.thumb === 'string' ? it.thumb.slice(0, 8) : undefined,
      url: safeUrl(it.url),
      embed: safeUrl(it.embed),
      thumbUrl: safeUrl(it.thumbUrl),
      kind: it.kind === 'note' ? 'note' : undefined,
      // normTime, not a loose regex: `/^\d{1,2}:\d{2}$/` accepted '99:99' and
      // '24:00', and the file stored them verbatim. The slot engine compares
      // `x.time === hm` against a zero-padded real clock value, so such a stack
      // could never remind on any day, the row's <input type="time"> rendered
      // blank, and "Add to phone calendar" emitted DTSTART…T999900 and still
      // reported success. normTime range-checks AND pads, so '7:30' — which
      // never matched the clock either — becomes '07:30'.
      time: normTime(it.time) || undefined,
      // A shared routine is a SCHEDULE, not a shopping list. routineToMd has
      // always serialised `repeat` (it JSON.stringifies the items whole), but
      // this whitelist dropped it and addItemsToToday then hard-set 'once' — so
      // a practitioner's six-week DAILY programme arrived on the client's phone
      // as six one-off items on the day they happened to open the file, and
      // every reminder past day one silently did not exist.
      repeat: normRepeat(it.repeat) || undefined,
      _day: normOffset(it.dayOffset, SHARE_MAX_OFFSET),
    }));
    return { ok: true, name: String(data.name || 'Shared routine').slice(0, 60), items };
  } catch {
    return { ok: false, reason: 'parse' };
  }
}

// ── routine sharing via LINK (2026-10-05) ──────────────────────────────────
// WHY A LINK AND NOT THE FILE. A .md tapped in WhatsApp cannot open this app on
// either phone platform. iOS routes a document only to a native app that
// declares a matching UTI in its bundle; Chromium's `file_handlers` is
// desktop-only and needs the PWA installed first. public/manifest.json declares
// none of file_handlers / share_target / protocol_handlers, so "tap the file and
// it opens in the app" has never worked for the client on the other end of a
// practitioner's message — the file rail only ever worked for whoever could get
// it onto a desktop. A link is the thing WhatsApp actually makes tappable.
//
// WHY THE FRAGMENT, AND WHY `/`. The host serves every path except `/` as HTTP
// 404 (CI copies index.html to 404.html), so a path-based `/r/<payload>` link
// gets no WhatsApp preview card and is never cached by the service worker,
// which stores a navigation only when `res.ok`. The fragment is also never
// transmitted: a client's programme stays out of GitHub's request logs and out
// of any Referer header — the lesson `?login_token=` already taught us.
//
// WHY base64url BY HAND. No new runtime dependency (9, and the README forbids a
// backend), so no compression library. `CompressionStream` was rejected for a
// harder reason than size: it does not exist in jsdom, which is this repo's only
// test environment, and a sender who has it producing a link for a receiver who
// does not is the one failure nobody in the field can recover from. The slim
// wire shape below carries a realistic 20-stack six-week programme in well under
// 4,000 characters without any of that.

// The budget is the WHOLE URL, not the payload. Far below every real browser and
// messenger limit, and still short enough to paste by hand if a share sheet
// mangles it.
export const LINK_MAX_URL = 8000;

// base64url by hand: btoa over a latin1 byte-string, then the URL-safe alphabet
// with padding dropped. The byte-string is built in a loop rather than
// String.fromCharCode(...bytes) because the spread form blows the call stack
// once a payload reaches any real size.
function b64urlEncode(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // Non-fatal utf-8 on purpose: a truncated payload decodes to replacement
  // characters and then fails JSON.parse, which the caller reports as 'parse'.
  // A throwing decoder would just move the same failure somewhere less clear.
  return new TextDecoder().decode(bytes);
}

// Never hardcode an origin: the same app is also built for `/lifestyle-app/`
// (tools/build-lifestyle.mjs), and a link that assumed the Pages root would
// point a client at a 404.
function linkBase() {
  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  return window.location.origin + base;
}

// One slim item on the wire. Short keys because every byte is doubled by
// base64; `embed` and `thumbUrl` are NOT transmitted at all — they are derived
// back from `u` on the other side, which is both smaller and safer, since a
// sender then chooses only which PAGE a link points at and never what lands in
// an <iframe src>. `b` (the 8-char thumb code) still travels, because an item
// with no url — a note, a document — has no url to derive it from.
function linkItem(it) {
  if (!it || typeof it !== 'object') return null;
  const title = String(it.title == null ? '' : it.title).trim().slice(0, 120);
  if (!title) return null;
  const o = { t: title };
  if (it.meta) o.m = String(it.meta).slice(0, 120);
  const u = safeUrl(it.url);
  if (u) o.u = u;
  if (it.thumb) o.b = String(it.thumb).slice(0, 8);
  if (it.kind === 'note') o.k = 'note';
  // normTime, not `/^\d{1,2}:\d{2}$/`: that regex passed '99:99' and '24:00'
  // straight onto the wire, and it also emitted '7:30' unpadded, which the slot
  // engine's exact `x.time === hm` comparison can never match. Pad it or drop it.
  const hm = normTime(it.time);
  if (hm) o.h = hm;
  const rep = normRepeat(it.repeat);
  if (rep) o.r = rep;
  // Either name in, one name out (see the naming-law note above routineToMd):
  // a saved routine item carries `dayOffset`, a freshly parsed one `_day`.
  const d = normOffset(it.dayOffset ?? it._day ?? 0, SHARE_MAX_OFFSET);
  if (d > 0) o.d = d;
  return o;
}

/**
 * routineToLink(r) — the whole routine as one tappable URL.
 * → `<origin><BASE_URL>#r=<base64url>` , or null when it will not fit, in which
 *   case the caller falls back to the .md file rather than handing the sender a
 *   link a messenger will truncate into something undecodable. Never truncates.
 */
export function routineToLink(r) {
  if (!r || !Array.isArray(r.items)) return null;
  const i = r.items.map(linkItem).filter(Boolean);
  if (!i.length) return null;
  // REFUSE ABOVE THE CEILING, DON'T LET THE OTHER END SWALLOW IT (2026-10-05,
  // review pass). The sender used to encode every stack and only check the URL
  // budget, while parseRoutineLink sliced to PLAN_MAX_ITEMS. Short cues are
  // small on the wire, so an 84-stack programme fitted one link and arrived as
  // 60 with both ends reporting success — the practitioner saw "Link copied",
  // the client's sheet said "60 stacks", and days 31 onward did not exist.
  // Returning null sends the caller to the .md file, which has no item cap and
  // carries all of them, exactly as the oversize path already does.
  if (i.length > PLAN_MAX_ITEMS) return null;
  const json = JSON.stringify({ p: 'ppwr', v: 1, n: String(r.name == null ? '' : r.name).trim().slice(0, 60), i });
  const url = linkBase() + '#r=' + b64urlEncode(json);
  return url.length > LINK_MAX_URL ? null : url;
}

// Rebuild one item in EXACTLY the shape parseRoutineMd returns, so the receive
// sheet and addItemsToToday consume a link and a file through the same code.
function linkItemBack(it) {
  if (!it || typeof it !== 'object') return null;
  const title = String(it.t == null ? '' : it.t).trim().slice(0, 120);
  if (!title) return null;
  const url = safeUrl(it.u);
  const snap = url ? itemFromUrl(url) : null;
  return {
    title,
    meta: it.m ? String(it.m).slice(0, 120) : undefined,
    thumb: (snap && snap.thumb) || (typeof it.b === 'string' ? it.b.slice(0, 8) : undefined),
    url,
    // Derived, then re-checked. safeUrl is applied to the derived values too:
    // the point of the 2026-07-28 whitelist is that nothing reaches an <a href>
    // or an <iframe src> without passing it, including values we built ourselves.
    embed: safeUrl(snap && snap.embed),
    thumbUrl: safeUrl(snap && snap.thumbUrl),
    kind: it.k === 'note' ? 'note' : undefined,
    // normTime, not `/^\d{1,2}:\d{2}$/`. A stranger's payload carrying
    // h:'99:99' used to be stored verbatim as the stack's time: the slot engine
    // matches `x.time === hm` against a padded real clock value, so that stack
    // could never fire on any day; its <input type="time"> rendered blank, so
    // nobody could correct it from the card; and "Add to phone calendar"
    // produced DTSTART…T999900 while telling the user the alarm was set.
    // normTime range-checks the hour and the minute and pads the result.
    time: normTime(it.h) || undefined,
    repeat: normRepeat(it.r) || undefined,
    _day: normOffset(it.d ?? it.dayOffset ?? it._day, SHARE_MAX_OFFSET),
  };
}

/**
 * parseRoutineLink(input) — a full URL, a bare `#r=…`, or a bare payload.
 * → { ok:true, name, items:[{…parseRoutineMd's shape, _day}], dropped }
 * → { ok:false, reason:'no-payload' | 'bad-shape' | 'parse' }
 * Never throws: this is the FOURTH untrusted url source named in safeUrl's
 * header comment, and it arrives from a stranger's message.
 *
 * `dropped` is how many stacks the PLAN_MAX_ITEMS ceiling refused, so the
 * receive sheet can say so. The slice used to be invisible: a payload with 84
 * stacks came back as 60 with `ok:true` and nothing in the result recording the
 * other 24, so the sheet printed "60 stacks · shared with you" as though that
 * were the whole programme. This app's own sender now refuses above the ceiling
 * (routineToLink), so a non-zero `dropped` means a hand-made or future-version
 * payload — exactly the case that must not pass silently.
 */
export function parseRoutineLink(input) {
  const raw = String(input == null ? '' : input).trim();
  if (!raw) return { ok: false, reason: 'no-payload' };
  const at = raw.indexOf('#r=');
  // A URL or a fragment that simply isn't ours: say so, rather than feeding the
  // whole href to the decoder and reporting it as a corrupt payload.
  if (at < 0 && (raw[0] === '#' || raw.includes('://'))) return { ok: false, reason: 'no-payload' };
  // Messengers wrap long links, and a fragment has no second '#', so everything
  // after the marker is payload once the whitespace is gone.
  const payload = (at >= 0 ? raw.slice(at + 3) : raw).replace(/\s+/g, '');
  if (!payload) return { ok: false, reason: 'no-payload' };
  // Longer than any link this app could have produced, so not worth decoding.
  if (payload.length > LINK_MAX_URL) return { ok: false, reason: 'bad-shape' };
  let data;
  try { data = JSON.parse(b64urlDecode(payload)); } catch { return { ok: false, reason: 'parse' }; }
  // `p:'ppwr'` is deliberately NOT the `{ppw:'routine'}` envelope the .md rail
  // uses. That one is read by two parsers with DIFFERENT url trust — parsePlanDoc
  // nulls every url because an AI invents them, parseRoutineMd keeps curated
  // https ones because a real person shared them — and neither checks `v`. A
  // distinct marker means a file payload can never be read with the link's rules
  // or the other way round.
  if (!data || data.p !== 'ppwr' || !Array.isArray(data.i) || !data.i.length) return { ok: false, reason: 'bad-shape' };
  const items = data.i.slice(0, PLAN_MAX_ITEMS).map(linkItemBack).filter(Boolean);
  if (!items.length) return { ok: false, reason: 'bad-shape' };
  // Counted off the SLICE, not off `items`: blank rows the whitelist drops are
  // not stacks anyone prescribed, and reporting them as lost would be wrong.
  const dropped = Math.max(0, data.i.length - PLAN_MAX_ITEMS);
  return { ok: true, name: String(data.n || 'Shared routine').slice(0, 60), items, dropped };
}

/**
 * The held share (2026-10-05). The boot-time fragment reader strips `#r=` from
 * the URL the moment it has decoded it — otherwise a refresh imports the same
 * programme twice — so the only copy of it after that lives here. It is written
 * to localStorage as well as to state because the recipient most likely to be
 * mid-reload is the one who has never opened the app before: they land on the
 * first-run choice, then the terms gate, and the URL they arrived on is already
 * clean.
 *
 * Holding is not accepting. Nothing here touches `routines` or `deckItems`.
 */
export function setPendingShare(p) {
  if (!p || !Array.isArray(p.items) || !p.items.length) return;
  // `dropped` travels with the held programme (and into the mirror, so it
  // survives the reload the first-run doors cause) because it is the only
  // record that the link carried more stacks than arrived — see parseRoutineLink.
  const dropped = Math.max(0, Math.floor(Number(p.dropped)) || 0);
  const pending = { name: String(p.name || 'Shared routine').slice(0, 60), items: p.items, dropped };
  lsWrite('pendingShare', JSON.stringify(pending));
  // shareHidden is reset: a NEW programme arriving is not something the person
  // has tapped away. Without this, a recipient who dismissed yesterday's share
  // would get today's as a chip they had no reason to suspect was new.
  setState({ pendingShare: pending, shareError: null, shareHidden: false });
}
export function clearPendingShare() {
  lsDrop('pendingShare');
  setState({ pendingShare: null, shareError: null, shareHidden: false });
}

/**
 * A link that could not be read (2026-10-05, review pass).
 *
 * This writes ONLY the error. It is the fix for the one place in the tree that
 * used to write `pendingShare` without going through the two accessors that own
 * the state/localStorage pair: the fragment reader's failure branch did
 * `setState({ pendingShare: null, shareError: … })`, which nulled a held
 * programme in state and left it on disk. The error panel's OK then removed that
 * orphan — so the honest act of acknowledging a dead link was what deleted the
 * programme that had arrived fine and was still waiting for an answer.
 *
 * shareHidden is reset so the message is actually seen by someone who had tapped
 * the held programme away: the error is about the link they JUST tapped.
 */
export function setShareError(msg) {
  setState({ shareError: String(msg || ''), shareHidden: false });
}
/** Dismiss the error alone. Never an answer to a held programme. */
export function clearShareError() {
  if (state.shareError !== null) setState({ shareError: null });
}

/**
 * Put the sheet away without answering it, and bring it back.
 *
 * Dismissal is not a decision. Before this, the backdrop (the whole dim upper
 * half of the phone) and the quietest button on the sheet both called
 * clearPendingShare, which removes the state copy AND the localStorage mirror —
 * and the `#r=` fragment was stripped from the URL on boot, so there was no way
 * back at all. One mis-tap, or one quest spotlight landing on the backdrop, and
 * a prescription was gone for good.
 */
export function hideShareSheet() { if (!state.shareHidden) setState({ shareHidden: true }); }
export function showShareSheet() { if (state.shareHidden) setState({ shareHidden: false }); }

/**
 * Is the shared-routine layer actually PAINTING right now?
 *
 * Held is not the same as on screen, and the difference is what makes this safe
 * to put in anySheetOpen: a recipient can tap the sheet away and go on using the
 * app with the programme still waiting, and the guide has to be free to run
 * then. Testing `pendingShare` directly would silence every hint and every quest
 * for as long as a programme sat unanswered.
 *
 * The three terms mirror SharedRoutineSheet's own early returns exactly, so the
 * two can never disagree about whether that layer owns the screen.
 */
export function shareSheetUp(s = state) {
  if (!s.firstRunChoice || !s.onboarded) return false;   // the first-run doors have it
  if (s.accountOpen) return false;                       // the sheet stands down (z42 vs z45)
  return !!(s.shareError || (s.pendingShare && !s.shareHidden));
}

// bulk-add imported stacks, honouring the schedule they were shared WITH:
// each item keeps its own repeat and starts on its own day offset. Items that
// carry neither behave exactly as before (once, today), so every existing
// caller is unaffected. Untimed items stagger from 09:00.
// Free tier: respects the 10-stack cap → upsell.
export function addItemsToToday(items) {
  if (premiumGated() && state.deckItems.length + items.length > FREE_STACK_CAP) {
    raiseFreeCapUpsell(items.length);
    return { upsell: true };
  }
  const base = 9 * 60;
  const added = items.map((item, i) => {
    // Either name in, neither on the stored stack: a parsed item carries `_day`,
    // an item read back off a saved routine carries `dayOffset`. Both are
    // schedule INPUTS, not item fields (naming law above routineToMd).
    const { _day, dayOffset, ...rest } = item;
    return {
      ...rest,
      // uid(), not `'im' + Date.now() + i`: the index made ids unique WITHIN one
      // batch and nothing made them unique BETWEEN batches, so two applies in
      // the same millisecond minted the same ids — and duplicate ids make
      // deleteItem remove two rows and markDone tick two. uid()'s sequence
      // counter is the fix that already exists for exactly this.
      id: uid('im'),
      // normTime here as well as in the parsers: a routine SAVED by the
      // pre-2026-10-05 importer can still hold '99:99' on disk, and a stack
      // built from it would never fire and would export a .ics the phone
      // rejects while the app said the alarm was set. An unusable time falls
      // back to the stagger, which at least exists on the clock.
      time: normTime(item.time) || (String(Math.floor((base + i * 30) / 60)).padStart(2, '0') + ':' + String((base + i * 30) % 60).padStart(2, '0')),
      anchor: dateKeyFromOffset(dayOffset ?? _day ?? 0),
      repeat: item.repeat || 'once',
    };
  });
  setState({ deckItems: [...state.deckItems, ...added], lastAddedId: added.length ? added[added.length - 1].id : state.lastAddedId });
  saveStacks();
  return { ok: true, count: added.length };
}
// Put a saved routine on the calendar, STARTING at the given date — honouring
// the schedule it was prescribed with. Items keep their saved times, staggered
// from 09:00 in 30-min steps when they don't have one.
//
// `dateKey` is where the programme STARTS, not the whole of it. This function
// used to hard-set `anchor: dateKey, repeat: 'once'` for every item, and it is
// the ONLY route from a saved routine onto the calendar — so it was both the one
// place a prescribed programme could be used and the place that destroyed it.
// A six-week plan arrived as one day's to-do list, and because src/lib/ics.js's
// rruleFor() returns null for 'once', the "add to phone calendar" export then
// produced an alarm that fired once: every reminder past day one did not exist.
// Items with no offset and no repeat land exactly as they did before.
export function applyRoutineToDate(routineId, dateKey) {
  const r = state.routines.find((x) => x.id === routineId);
  if (!r) return { ok: false };
  if (premiumGated()) { setState({ premiumUpsell: 'Routines are part of Premium — bundle stacks and drop them onto any day in one tap.' }); return { upsell: true }; }
  const base = 9 * 60;
  // Offsets count from the chosen day, so the offsets need a real Date to count
  // from. A key the app did not build would make dateKeyFromOffset emit
  // 'NaN-NaN-NaN' and hide every item on a date that never renders, so an
  // unparseable key falls back to anchoring the lot on the key itself.
  const start = keyToDate(dateKey);
  const datable = start instanceof Date && !isNaN(start);
  const added = r.items.map((item, i) => {
    // dayOffset/_day are schedule INPUTS, not item fields: neither may land on a
    // stored stack (the naming law above routineToMd).
    const { id, anchor, repeat, dayOffset, _day, ...rest } = item;
    // normTime for the same reason as addItemsToToday: a routine already on
    // disk may carry a time the clock cannot reach, from the loose regex the
    // import rails used before 2026-10-05.
    const t = normTime(item.time) || (String(Math.floor((base + i * 30) / 60)).padStart(2, '0') + ':' + String((base + i * 30) % 60).padStart(2, '0'));
    const off = normOffset(dayOffset ?? _day ?? 0, SHARE_MAX_OFFSET);
    return {
      ...rest,
      // uid() for the same reason as addItemsToToday: `'ra' + Date.now() + i`
      // collides between two applies in the same millisecond, and a duplicate
      // id makes deleteItem remove two rows and markDone tick two.
      id: uid('ra'),
      time: t,
      anchor: datable ? dateKeyFromOffset(off, start) : dateKey,
      repeat: repeat || 'once',
    };
  });
  setState({ deckItems: [...state.deckItems, ...added], lastAddedId: added.length ? added[added.length - 1].id : state.lastAddedId });
  saveStacks();
  return { ok: true, count: added.length };
}

// ── add flows ──
// A real YouTube host, not the letters "youtube.com" anywhere in the string
// (2026-10-05, review pass). The old regex was unanchored, so
// `https://evil.example/youtube.com/watch?v=<real id>` matched: the item came
// back with a genuine i.ytimg.com thumbnail and a genuine youtube.com/embed
// iframe while `url` — the only thing the "Open ↗" control uses — stayed on the
// attacker's host. Harmless while every url was one the user had pasted
// themselves; a stranger's shared link now reaches this function too, and the
// receive sheet never shows the destination. Parse the hostname and require it.
const YT_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be']);
const YT_PATH_ID = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/;
export function parseYouTubeId(url) {
  let u;
  try { u = new URL(String(url)); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!YT_HOSTS.has(host)) return null;
  const id = host === 'youtu.be'
    ? u.pathname.slice(1).split('/')[0]
    : (u.searchParams.get('v') || (YT_PATH_ID.exec(u.pathname) || [])[1] || '');
  // Exactly 11 characters, not "the first 11 of a longer string": a trailing
  // slug used to be truncated into an id that pointed at a different video.
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
// build a stack-item SNAPSHOT (no id/time) from a pasted share link — shared
// by the main ＋ Add and the Routine builder.
export function itemFromUrl(url) {
  // Reject anything that isn't an absolute http(s) link before it can be stored
  // and later rendered into an <a href> (see safeUrl).
  const raw = safeUrl(url);
  if (!raw) return null;
  const yt = parseYouTubeId(raw);
  if (yt) return { title: 'YouTube video', meta: 'YouTube', thumb: 'yt', url: raw, embed: 'https://www.youtube.com/embed/' + yt + '?autoplay=1&playsinline=1&rel=0', thumbUrl: 'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg' };
  if (/spotify\.com|open\.spotify/.test(raw)) return { title: 'Spotify', meta: 'Spotify', thumb: 'sp', url: raw };
  let host = raw; try { host = new URL(raw).hostname.replace(/^www\./, ''); } catch {}
  return { title: host, meta: 'Link', thumb: 'au', url: raw };
}
// add a pasted share link to today's stack. Returns { ok } or { upsell }.
export function addCustomUrl(url) {
  const snap = itemFromUrl(url);
  if (!snap) return { ok: false };
  if (overLimit()) {
    setState({ premiumUpsell: FREE_CAP_UPSELL });
    return { upsell: true };
  }
  const item = { ...snap, id: 'u' + Date.now().toString(36), time: '09:00', repeat: 'daily' };
  setState({ deckItems: [...state.deckItems, item], addedCustom: item, customUrl: '', lastAddedId: item.id });
  saveStacks();
  return { ok: true, item };
}
// add a library item into today's stack (free-tier cap → upsell). Returns bool added.
export function addToStack(libItem, time = '09:00') {
  if (overLimit()) { setState({ premiumUpsell: FREE_CAP_UPSELL }); return false; }
  const id = 'l' + Date.now().toString(36);
  const { note, ...rest } = libItem;
  const item = { ...rest, id, time, repeat: 'daily' };
  setState({ deckItems: [...state.deckItems, item], lastAddedId: id });
  saveStacks();
  return true;
}
export function setTab(tab) { setState({ stackTab: tab }); }
// in-app media viewer
export function openPlayer(item) { if (item) setState({ playerItem: item }); }
export function closePlayer() { setState({ playerItem: null }); }

// ── runtime slot engine (ported from the prototype's _slotTimer, 20s tick) ──
// Fires when a slot's time arrives: notes → full-screen affirmation popup
// (auto-dismiss per its duration); media with autoplay → opens the player;
// otherwise (reminders on) → the slot reminder banner. Also announces the
// fasting window opening/closing.
let _noteTimer = null;
export function showNotePop(note) {
  if (_noteTimer) clearTimeout(_noteTimer);
  setState({ notePop: note });
  if (note.dur !== 'stay') {
    const ms = (note.dur === '15' ? 15 : 5) * 1000;
    _noteTimer = setTimeout(() => setState({ notePop: null }), ms);
  }
}
export function closeNotePop() { if (_noteTimer) clearTimeout(_noteTimer); setState({ notePop: null }); }
export function dismissSlotPop() { setState({ slotPop: null }); }

// `_fired` replaces a single `_lastFire` string. Two stacks can legitimately share
// a time — a medicine taken with food and the stretch after it — but the engine
// used .find() (singular) and then memoised that one id for the whole minute, so
// every item after the first in insertion order NEVER fired. Not late: never, on
// any day. The set is per-minute and resets when the minute turns.
let _slotTimer = null, _lastFast = null, _firedMin = null;
let _fired = new Set();
export function startSlotEngine() {
  if (_slotTimer) return () => {};
  _slotTimer = setInterval(() => {
    const S = state;
    const now = new Date();
    const hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const key = todayKey();
    if (S.fastOn && S.reminders) {
      if (hm === S.eatOpen && _lastFast !== key + '|open') { _lastFast = key + '|open'; setState({ slotPop: { id: null, title: 'Eating window open', time: hm, hasUrl: false } }); return; }
      if (hm === S.eatClose && _lastFast !== key + '|close') { _lastFast = key + '|close'; setState({ slotPop: { id: null, title: 'Eating window closed · fasting begins', time: hm, hasUrl: false } }); return; }
    }
    const eating = S.fastOn ? isInEatWindow(hm, S.eatOpen, S.eatClose) : false;
    if (eating !== S.eatingNow) setState({ eatingNow: eating });
    if (_firedMin !== key + '|' + hm) { _firedMin = key + '|' + hm; _fired = new Set(); }
    // Never stomp something the user has not dealt with yet. The queue drains on
    // the next tick once they dismiss it (the engine ticks every 20s).
    if (S.slotPop || S.notePop || S.playerItem) return;
    const due = stackFor(key).filter((x) => x.time === hm);
    if (!due.length) return;
    const item = due.find((x) => !_fired.has(x.id));
    if (!item) return;
    _fired.add(item.id);
    // A note whose message was edited down to empty must not fire a blank
    // full-screen popup — the add path forbids empty, so the edit path can't
    // leave one that shows (Vic 2026-08-31 edit-stack review).
    if (item.kind === 'note') { if (String(item.title || '').trim()) showNotePop({ text: item.title, anim: item.noteAnim, speed: item.noteSpeed, dur: item.noteDur }); return; }
    if (item.url && (S.autoplay || item.auto)) { setState({ playerItem: item, slotPop: null }); return; }
    if (S.reminders) { setState({ slotPop: { id: item.id, title: item.title, time: item.time, hasUrl: !!(item.url || item.embed) } }); }
  }, 20000);
  return () => { clearInterval(_slotTimer); _slotTimer = null; };
}

// note popup animation css (verbatim mapping from the prototype)
export function noteAnimCss(anim, sp) {
  const d = { slow: { flash: '1.4s', pulse: '2.6s', marquee: '14s' }, med: { flash: '.8s', pulse: '1.6s', marquee: '9s' }, fast: { flash: '.4s', pulse: '.9s', marquee: '5s' } }[sp || 'med'];
  if (anim === 'flash') return 'ppwNoteFlash ' + d.flash + ' steps(1,end) infinite';
  if (anim === 'pulse') return 'ppwNotePulse ' + d.pulse + ' ease-in-out infinite';
  if (anim === 'marquee') return 'ppwNoteMarquee ' + d.marquee + ' linear infinite';
  return 'none';
}
// completed-today sheet
export function openCompleted() { setState({ completedOpen: true }); }
export function closeCompleted() { setState({ completedOpen: false }); }
// mode is optional. Existing callers pass it straight to onClick, so the first
// argument can be a click event — anything that isn't the string 'create' means
// the ordinary sign-in door.
export function openAccount(mode) {
  setState({ accountOpen: true, accountMode: mode === 'create' ? 'create' : 'signin' });
}
export function closeAccount() { setState({ accountOpen: false, justCreated: false }); }
/** Remember this device has been offered the create/sign-in choice. */
export function finishFirstRunChoice() { save('frc', 1); setState({ firstRunChoice: true }); }
// repeat picker — set an item's recurrence (stamps an anchor so weekly/every-N works)
export function openRepeat(id) { setState({ repeatId: id }); }
export function closeRepeat() { setState({ repeatId: null }); }
export function setRepeat(id, value) {
  setState({ deckItems: state.deckItems.map((it) => it.id === id
    ? { ...it, repeat: value, anchor: it.anchor || todayKey() }
    : it) });
  saveStacks();
}
export function openTerms() { setState({ termsOpen: true }); }
export function closeTerms() { setState({ termsOpen: false }); }

// ── onboarding ──
export function savePrefsNow() {
  const S = state;
  save('prefs', JSON.stringify({ l: S.obLifestyle, b: S.obBody, i: S.obInterests, c: S.obCustom, lv: S.obLevels, a: S.obAnchors, cr: S.obCreators }));
}
export function finishOnboarding() {
  const S = state;
  save('onboarded', 1);
  save('terms', S.termsOk ? 1 : 0);
  save('reminders', S.reminders ? 1 : 0);
  save('integrations', JSON.stringify(S.integrations));
  save('courses', JSON.stringify(S.courseLinks));
  savePrefsNow();
  savePrefs2();
  // F2: land on the day view with NOTHING left open behind. Before this, the
  // account sheet the user opened at the very start was still sitting there.
  setState({ onboarded: true, obStep: 0, screen: 'stack', accountOpen: false, premiumUpsell: null });
  // Tell the ACCOUNT it is set up, so the next device doesn't ask again. Silent
  // by design: signed-out users skip it, and it fails soft while A3 is unbuilt.
  saveProfile({ onboarded: true, termsAcceptedAt: new Date().toISOString() });
  // An account created mid-setup had its "you now have an account, set a password"
  // moment held back so it wouldn't stack on the consent screen. Setup is done —
  // it can have the screen to itself now.
  if (state.justCreated) setState({ accountOpen: true, accountMode: 'signin' });
}
// toggle a value in a string-array field (chip select)
export function toggleInList(key, label) {
  const arr = state[key] || [];
  setState({ [key]: arr.includes(label) ? arr.filter((x) => x !== label) : arr.concat(label) });
}
export function repeatLabel(repeat) {
  const r = repeat === undefined ? 'daily' : repeat;
  if (r === 'daily') return 'Every day';
  if (r === 'weekly') return 'Weekly';
  if (r === 'once') return 'Just once';
  const n = parseInt(r, 10);
  return n > 1 ? `Every ${n} days` : 'Every day';
}
// today's completed entries joined with their item (title/time), newest first
export function completedToday(key = todayKey()) {
  const done = state.doneByDate[key] || [];
  return done.map((d) => {
    const it = state.deckItems.find((x) => x.id === d.id) || {};
    return { id: d.id, at: d.at, title: it.title || 'Item', time: it.time || '' };
  }).sort((a, b) => (b.at || 0) - (a.at || 0));
}
// open a specific date's stack (null / today → clear viewDate)
export function openStackForDate(key) {
  const isToday = !key || key === todayKey();
  setState({ viewDate: isToday ? null : key, screen: 'stack' });
}
export function backToToday() { setState({ viewDate: null }); }
// all items scheduled on `key` (incl. done — for calendar preview). done flag attached.
export function itemsForDate(key) {
  const done = (state.doneByDate[key] || []).map((x) => x.id);
  return state.deckItems.filter((it) => itemOnDate(it, key)).map((it) => ({ ...it, done: done.indexOf(it.id) !== -1 }));
}
export function openAdd() { setState({ addOpen: true }); }
export function closeAdd() { setState({ addOpen: false, addedCustom: null, noteOpen: false }); }

// note / affirmation composer
export function openNoteComposer() { setState({ noteOpen: true }); }
export function setNoteField(patch) { setState(patch); }
export function addNote() {
  const text = String(state.noteText || '').trim();
  if (!text) return { ok: false };
  if (overLimit()) { setState({ premiumUpsell: FREE_CAP_UPSELL }); return { upsell: true }; }
  const anim = state.noteAnim || 'still';
  const animLabel = anim.charAt(0).toUpperCase() + anim.slice(1);
  const item = {
    id: 'n' + Date.now().toString(36), title: text, meta: 'Text · ' + animLabel,
    time: state.noteTime || '09:00', kind: 'note', noteAnim: anim, noteSpeed: state.noteSpeed || 'med',
    noteDur: state.noteDur || '5', repeat: 'daily',
  };
  setState({ deckItems: [...state.deckItems, item], noteOpen: false, addOpen: false, noteText: '', lastAddedId: item.id });
  saveStacks();
  return { ok: true, item };
}
export function setCustomUrl(v) { setState({ customUrl: v }); }
export function goLibrary(tab) { setState({ addOpen: false, addedCustom: null, screen: 'library', ...(tab ? { stackTab: tab } : {}) }); }
// capRefusal goes with the message it describes: a stale one left behind would
// make freeSlotAdviceApplies() answer for a paywall it knows nothing about.
export function setUpsell(reason) { setState({ premiumUpsell: reason, capRefusal: null }); }
export function clearUpsell() { setState({ premiumUpsell: null, capRefusal: null }); }

// theme setters
export function setTheme(patch) {
  Object.entries(patch).forEach(([k, v]) => save(k, v));
  setState(patch);
}
// ── membership (server-verified) ──────────────────────────────────────────────
// There is no setPremium(true) any more. Premium is whatever the backend last
// said it was; the only way into that state is a real, verified purchase.

/**
 * Apply a verified answer from /api/me/entitlement.
 *
 * UNCHANGED BY THE B2B SWITCH, on purpose (PREMIUM_OPEN, membership.js). The
 * server's verdict is recorded verbatim in `premiumPaid` whatever the switch
 * says, so the day it goes back to false an existing subscriber is still a
 * subscriber — nothing here has to be remembered or undone. The switch only
 * widens `premium`, the effective unlock the gates read.
 *
 * Still returns the SERVER's answer, not the effective one: its callers report
 * what the account is entitled to, and saying "yes, paid" because the app is
 * open to everyone would make that report a lie.
 */
export function applyServerEntitlement(ent) {
  const paid = !!(ent && ent.premium);
  setState({ premium: PREMIUM_OPEN || paid, premiumPaid: paid, signedIn: isSignedIn() });
  return paid;
}

/** Re-read whether there is a session, for surfaces that must show it. */
export function syncAuthState() {
  setState({ signedIn: isSignedIn() });
  return state.signedIn;
}

/**
 * Apply the account's own setup state, so setup follows the PERSON rather than
 * the device. Called after every sign-in.
 *
 * Only ever moves flags to `true`. A null answer (route not deployed, offline,
 * signed out) is "no opinion" and must change nothing — if it cleared the local
 * flags, a returning customer would be pushed through the wizard by our own bug,
 * which is the exact fault this is here to fix.
 */
export function applyServerProfile(p) {
  if (!p) return false;
  const patch = {};
  if (p.onboarded && !state.onboarded) { patch.onboarded = true; save('onboarded', 1); }
  if (p.termsAcceptedAt && !state.termsOk) { patch.termsOk = true; save('terms', 1); }
  if (Object.keys(patch).length) setState(patch);
  return !!patch.onboarded;
}

/** Read the account's setup state and apply it. Safe to call whenever. */
export async function syncProfile() {
  return applyServerProfile(await fetchProfile());
}

/**
 * Ask the server what this user is entitled to and unlock accordingly. Safe to
 * call on boot, on app-resume and after sign-in. Signed-out users are free-tier
 * with no network call at all. If the request fails (offline, server down) the
 * cached value stands — we never lock a paying member out over a dropped request.
 */
export async function syncEntitlement() {
  // Both no-network paths fall back to the cached paid answer exactly as before,
  // then let the switch widen it — so an open build never locks a signed-out or
  // offline visitor out of the app it just let them into.
  if (!isSignedIn()) {
    const paid = cachedPremium();
    setState({ premium: PREMIUM_OPEN || paid, premiumPaid: paid, signedIn: false });
    return false;
  }
  try {
    return applyServerEntitlement(await fetchEntitlement());
  } catch {
    const paid = cachedPremium();
    setState({ premium: PREMIUM_OPEN || paid, premiumPaid: paid, signedIn: isSignedIn() });
    return paid;
  }
}

export function signOutMembership() {
  membershipSignOut();
  // Signing out drops the PURCHASE, not the app. On an open build the person is
  // still entitled to everything, so locking the screen behind them here would
  // make "Sign out" read as "lock me out" — which is not what it says.
  setState({ premium: PREMIUM_OPEN, premiumPaid: false, signedIn: false });
}
// general prefs (prototype key encodings)
export function setSounds(on) { save('sounds', on ? '1' : '0'); setState({ sounds: !!on }); }
export function setReminders(on) { save('reminders', on ? '1' : '0'); setState({ reminders: !!on }); }
export function setAutoplay(on) { save('autoplay', on ? '1' : '0'); setState({ autoplay: !!on }); }

// ── intermittent-fasting eating window (Vic 2026-08-31) ─────────────────────
// The state (fastOn/eatOpen/eatClose), the corner F/E badge and the open/close
// reminders already shipped — the slot engine fires them and FastingBadge reads
// them — but nothing let the user TURN IT ON or set the window. The old app had
// that UI ("with options like it did before"): presets 16:8 / 18:6 / 20:4 plus
// a custom window. This re-creates it, driving the state App5 already consumes.
//
// A preset is expressed as EATING hours; the close time is derived from the open
// time so picking "16:8" keeps the user's chosen open and moves the close.
export const FAST_PRESETS = [
  { key: '16:8', label: '16:8', eatH: 8 },
  { key: '18:6', label: '18:6', eatH: 6 },
  { key: '20:4', label: '20:4', eatH: 4 },
  { key: 'omad', label: 'OMAD', eatH: 1 },
];
// add whole/fractional hours to an "HH:MM" clock time, wrapping past midnight.
export function addHoursHM(hm, hours) {
  const [h, m] = String(hm || '00:00').split(':').map(Number);
  const t = ((((h || 0) * 60 + (m || 0)) + Math.round(hours * 60)) % 1440 + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
// eating-window length in whole hours (close − open, wrapping), or null if it
// doesn't land on a whole hour — used only to light up the matching preset chip.
export function fastWindowHours(open, close) {
  const d = (_toMin(close) - _toMin(open) + 1440) % 1440;
  const h = (d === 0 ? 1440 : d) / 60;
  return Number.isInteger(h) ? h : null;
}
// Whether an "HH:MM" time falls inside the eating window — WRAP-AWARE, so an
// evening window that crosses midnight (18:00 → 02:00, which the 16:8 preset can
// derive from a late open) is handled. The slot engine and FastingBadge BOTH use
// this, so the F/E badge, the eating state, and the open/close popups can never
// contradict each other.
export function isInEatWindow(hm, open, close) {
  const t = _toMin(hm), o = _toMin(open), c = _toMin(close);
  if (o === c) return true;              // a full 24h "window"
  return o < c ? (t >= o && t < c) : (t >= o || t < c);
}
// write prefs2 (discreet + day times + fasting) from live state. Single source
// so setFasting and finishOnboarding can never encode the blob differently.
function savePrefs2() {
  const S = state;
  save('prefs2', JSON.stringify({ d: S.discreet, t: S.dayT, f: { on: S.fastOn, o: S.eatOpen, c: S.eatClose } }));
}
// patch any of { fastOn, eatOpen, eatClose } and persist. The slot engine and
// FastingBadge pick the new values up on their own.
export function setFasting(patch) {
  setState(patch);
  savePrefs2();
}
// vision / a11y — easy-read (bold + full-strength dim) and zoom (.85–1.4)
export function setA11y(patch) {
  const a = { on: !!(patch.on !== undefined ? patch.on : state.a11y.on), zoom: patch.zoom !== undefined ? patch.zoom : state.a11y.zoom };
  a.zoom = Math.round(Math.min(1.4, Math.max(.85, a.zoom)) * 100) / 100;
  save('a11y', JSON.stringify(a));
  setState({ a11y: a });
}

// ── React hook ──
export function useStore5() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// ─────────────────────────────────────────────────────────────────────────
// GUIDED ONBOARDING — "Your Guide" (2026-08-24)
//
// The app's own metaphor is "your day is a stack of things you tick off", so
// the tutorial is one more stack of things you tick off: eight one-minute
// quests, each a guided do-it-yourself mini-tour on the REAL UI. The spotlight
// hole is genuinely tappable and a `do` step only advances when the real store
// event fires — the user learns by doing the thing, not by reading about it.
//
// Everything here is device-local under the `ppw5.` namespace and free. Two
// flat JSON keys (`guide`, `hints`) so they can ride the profile POST body
// later without a schema change.
// ─────────────────────────────────────────────────────────────────────────

/** Persist the guide blob and mirror it into state. */
function writeGuide(next) {
  save('guide', JSON.stringify(next));
  setState({ guide: next });
}

/** Has this quest been completed? */
export function questDone(id) { return !!(state.guide && state.guide.q && state.guide.q[id]); }
/** How many of the eight are done. */
export function questCount() { return Object.keys((state.guide && state.guide.q) || {}).length; }
/** Has the welcome been shown (or migrated past)? */
export function guideWelcomed() { return !!(state.guide && state.guide.welcomed); }
export function markGuideWelcomed() {
  if (guideWelcomed()) return;
  writeGuide({ ...state.guide, welcomed: 1 });
}
/** Is the whole guide finished (the disc retires)? */
export function guideFinished() { return !!(state.guide && state.guide.done); }

/**
 * Open the spotlight coach on a step list.
 * `spec` = { steps, questId?, i? }. Never opens over another guidance layer or
 * a sheet — the one-layer-at-a-time rule is law.
 */
export function openCoach(spec) {
  if (!spec || !Array.isArray(spec.steps) || !spec.steps.length) return false;
  setState({ coach: { i: 0, ...spec }, journalOpen: false, hint: null });
  return true;
}
/**
 * Advance to the next step.
 *
 * Completion is recorded HERE and nowhere else: the last step of every quest
 * carries `complete: true`, and moving past it is what ticks the quest off.
 * One place to be right, instead of eight step definitions each remembering to
 * call recordQuest — and, more importantly, a quest can then only be completed
 * by actually passing through its last step.
 */
export function advanceCoach() {
  const c = state.coach;
  if (!c) return;
  const step = c.steps[c.i];
  if (step && step.complete && c.questId) {
    if (recordQuest(c.questId)) {
      // The same soft tock the deck uses when something is ticked off — a quest
      // completing is the same gesture as a card completing, so it makes the
      // same sound. Sounds-gated like everything else; no fanfare, no confetti.
      import('./sfx5.js').then((m) => m.sfx('drop')).catch(() => {});
    }
    clearResume();
  }
  if (c.i + 1 >= c.steps.length) { setState({ coach: null }); return; }
  setState({ coach: { ...c, i: c.i + 1 } });
}

/**
 * Pause/close the coach WITHOUT recording completion (the ✕ escape).
 *
 * Where the user got to is written to disk, not just to memory: Quest 6 sends
 * them out of the app entirely to talk to their AI, and coming back an hour
 * later — or on a cold boot — should pick up where they left off rather than
 * start the quest again.
 */
export function closeCoach() {
  const c = state.coach;
  if (c && c.questId && c.questId !== '__finale__' && !questDone(c.questId)) {
    save('guideResume', JSON.stringify({ questId: c.questId, i: c.i }));
  }
  setState({ coach: null });
}

/**
 * Write the resume point WITHOUT closing the coach.
 *
 * Quest 6 sends the user out of the app on purpose — copy the prompt, go and
 * talk to ChatGPT, come back. They will not tap the pause ✕ on their way out,
 * and a phone may kill the tab while they are gone, so the place has to be on
 * disk before they leave rather than as a side effect of closing.
 */
export function stashCoachPosition() {
  const c = state.coach;
  if (!c || !c.questId || c.questId === '__finale__' || questDone(c.questId)) return;
  save('guideResume', JSON.stringify({ questId: c.questId, i: c.i }));
}

/** Where an interrupted quest left off, or null. */
export function readResume() {
  try {
    const r = JSON.parse(localStorage.getItem(LS('guideResume')) || 'null');
    if (r && r.questId && !questDone(r.questId)) return r;
  } catch {}
  return null;
}
export function clearResume() { lsDrop('guideResume'); }

export function openJournal() { setState({ journalOpen: true, coach: null, hint: null }); }
export function closeJournal() { setState({ journalOpen: false }); }

/** Record a quest as complete. Idempotent — replaying never un-ticks. */
export function recordQuest(id) {
  if (!id || questDone(id)) return false;
  const q = { ...((state.guide && state.guide.q) || {}), [id]: Date.now() };
  writeGuide({ ...state.guide, q });
  return true;
}
/** The finale ran — retire the GuideDisc for good. */
export function guideDone() {
  if (guideFinished()) return;
  writeGuide({ ...state.guide, done: Date.now() });
}

// ── hints ────────────────────────────────────────────────────────────────
export function setHint(id) { setState({ hint: id ? { id } : null }); }
export function clearHint() { setState({ hint: null }); }
/** How many times a hint has fired (count-based, so lifetime caps work). */
export function hintCount(id) { return +(((state.hints || {})[id]) || 0); }
/** Burn one use of a hint. */
export function burnHint(id) {
  const hints = { ...(state.hints || {}), [id]: hintCount(id) + 1 };
  save('hints', JSON.stringify(hints));
  setState({ hints });
}
/** Re-arm a hint that is allowed a second life (e.g. `today-chip`). */
export function rearmHint(id) {
  const hints = { ...(state.hints || {}) };
  if (!hints[id]) return;
  hints[id] = Math.max(0, hints[id] - 1);
  save('hints', JSON.stringify(hints));
  setState({ hints });
}
export function setHintsOff(off) { save('hintsOff', off ? '1' : '0'); setState({ hintsOff: !!off }); }

// ── misc surfacing the guide needs ───────────────────────────────────────
/** Remember the id of the thing the user just added, for "look what you made". */
export function noteAdded(id) { if (id) setState({ lastAddedId: id }); }
/** AiBridgeSheet mirrors its internal step so a quest can watch the round trip. */
export function setAiStep(n) { if (state.aiStep !== n) setState({ aiStep: n }); }
/** The Library has been visited once — drives the permanent media-first default. */
export function markLibSeen() { try { if (localStorage.getItem(LS('libSeen')) !== '1') save('libSeen', '1'); } catch {} }
export function hasLibSeen() { try { return localStorage.getItem(LS('libSeen')) === '1'; } catch { return false; } }

/**
 * Count this as a distinct day of use (max 10 kept) and return the total.
 * Drives the install nudge, which should reward a habit rather than nag a
 * first-time visitor.
 */
export function recordUseDay() {
  let days = [];
  try { days = JSON.parse(localStorage.getItem(LS('daysUsed')) || '[]'); } catch {}
  if (!Array.isArray(days)) days = [];
  const k = todayKey();
  if (!days.includes(k)) { days.push(k); if (days.length > 10) days = days.slice(-10); save('daysUsed', JSON.stringify(days)); }
  return days.length;
}
export function useDayCount() {
  try { const d = JSON.parse(localStorage.getItem(LS('daysUsed')) || '[]'); return Array.isArray(d) ? d.length : 0; } catch { return 0; }
}

/** Tomorrow's date key, in the store's unpadded `YYYY-M-D` form. */
export function tomorrowKey() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/**
 * Is any layer that owns the screen currently up? Guidance never stacks on
 * top of a sheet — the one-layer-at-a-time rule (F2), applied to the guide.
 */
export function anySheetOpen(s = state) {
  // shareSheetUp (2026-10-05, review pass): the shared-routine sheet (z45) was
  // the one full-screen layer this list did not know about, so the welcome tour
  // (z60 full-frame dim), the quest coach and the one-shot hints (z44, i.e.
  // BEHIND it) all fired on top of a programme a client had just been sent — a
  // hint's single lifetime use burned where nobody could read it, and a quest
  // spotlight routing the user's tap into the sheet's backdrop.
  return !!(s.aiOpen || s.addOpen || s.termsOpen || s.accountOpen || s.completedOpen ||
            s.playerItem || s.scheduleTarget || s.repeatId || s.editId || s.premiumUpsell ||
            shareSheetUp(s) || !s.onboarded);
}

/** Which day the Calendar's panel is showing (unpadded `YYYY-M-D`, or null). */
export function setCalSel(key) { if (state.calSelKey !== key) setState({ calSelKey: key }); }

/**
 * The item the guide should point at when it says "the thing you just added".
 *
 * SINGLE SOURCE OF TRUTH, deliberately: the quest steps and the [data-tour]
 * anchors in the Stack both ask this, so they can never disagree about which
 * row is being talked about. It only ever answers with something the user can
 * actually SEE — an item scheduled for another date, or already ticked off, is
 * not on screen, so the guide falls back to the top of the stack instead of
 * spotlighting a row that is not there.
 */
export function guideFocusItem() {
  const id = state.lastAddedId;
  if (!id) return null;
  return orderedStackFor(state.viewDate || todayKey()).find((x) => x.id === id) || null;
}

/** Which month the Calendar is showing, as an offset from this one. */
export function setCalMonth(off) { if (state.calMonthOff !== off) setState({ calMonthOff: off }); }
