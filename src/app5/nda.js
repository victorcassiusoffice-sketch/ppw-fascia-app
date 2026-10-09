// nda.js — the confidentiality undertaking that sits beside the access code.
//
// WHY THIS EXISTS. The Lifestyle App is pre-release software being shown to
// prospective business customers — gyms, clinics, studios, employers. Vic wants
// whoever walks through the door to have agreed to keep what they see to
// themselves. So the door asks for two things now: the code, and this.
//
// WHAT IT IS HONESTLY WORTH — and nothing in the UI may claim more:
//   This is a tick box in a web app. What it produces is a NOTE ON THAT DEVICE
//   saying which wording was shown and when it was agreed to. It is not a signed
//   document, there is no server keeping an audit trail, and it is not proof of
//   anything: whoever clears their browser clears the record, and a record on the
//   visitor's own machine was never evidence against them in the first place.
//   If an agreement has to actually hold, that is a real NDA signed out of band.
//   What this DOES do is make the ask explicit and unmissable, so nobody can say
//   they were never told — which is most of the value most of the time.
//
//   The wording below has NOT been checked by a lawyer. It is plain English
//   written to be read, not contract language written to be enforced.
//
// WHY THE VERSION MATTERS. The record stores NDA_VERSION, and `ndaAccepted()` is
// true only when the stored version is the one shipping right now. So the wording
// and the record of what was agreed cannot drift: change the words, bump the
// version, and every device is asked again rather than being silently credited
// with agreeing to sentences it never saw. That is the entire reason the text and
// the version live in ONE file — a second copy of either is a way for them to
// disagree.

const LS_KEY = 'ppw5.nda';

/**
 * Bump this WHENEVER the wording below changes in substance.
 *
 * Dated so that a record found on a device a year from now says which month's
 * words it is, and SUFFIXED because a bare date cannot express two revisions on
 * one day — which is not hypothetical: the wording below was rewritten hours
 * after it was first written, and a date-only version would have left both
 * drafts calling themselves '2026-10-08'. Any device holding the first one would
 * then have been silently credited with agreeing to sentences it never saw,
 * which is the exact failure this whole mechanism exists to prevent.
 *
 * So: roll the date and go back to `.1` on a later day, bump the suffix for a
 * same-day change. Every device that agreed to an earlier value is asked again
 * on the next load — see `ndaAccepted()`.
 */
export const NDA_VERSION = '2026-10-08.2';

export const NDA_TITLE = 'Keep what you see confidential';

export const NDA_INTRO =
  'This app has not been released yet, and we are showing it to you early. Before you go in, please agree to five things.';

/**
 * The agreement itself. `{ h, p }` rows, the same shape TermsScreen uses for the
 * terms, so both legal surfaces read and render the same way.
 *
 * Written for a gym owner to read in under a minute and know exactly what they
 * have agreed to. Honest and non-threatening on purpose: a prospective customer
 * being asked a favour, not a counterparty being served notice.
 *
 * ⚠ THE LINE THESE WORDS HAVE TO WALK, and the bug that taught it. The first
 * draft asked the reader to keep the access code "inside your own organisation"
 * and to email before anyone outside it saw the app. That reads as a reasonable
 * confidentiality ask and is in fact a ban on the product's main journey: a
 * practitioner sends a client a `#r=` routine link, and the client needs a code
 * to open it (access-gate.test.jsx, last block). The client is a customer of the
 * business, not a colleague in it — so the honest reader of that draft would have
 * stopped sharing routines, which is the one thing Vic said on 2026-10-08 must be
 * open, and which the door's own copy promises ("licensed to businesses ... who
 * hand it to their own people").
 *
 * So the ask is scoped to the OUTSIDE WORLD — don't publish it, don't hand it to
 * another business — and the people a licensee serves are named as welcome.
 * `access-nda.test.jsx` block 6 holds that distinction in place.
 */
export const NDA_POINTS = [
  {
    h: 'It is not public yet',
    p: 'The app is still being built. We are showing it early to a small number of businesses, and we would rather it did not travel further than that for now.',
  },
  {
    h: 'Your own clients and staff are who it is for',
    p: 'Give it to the people you look after — your clients, members, patients or staff — and send them routines. That is what your access is for and you never need to ask us first.',
  },
  {
    h: 'Please keep it off the open internet',
    p: 'Please do not post the access code, screenshots or screen recordings publicly, and do not pass the app to another business or to the press. If someone else outside your own business would like a look, email us and we will almost certainly say yes.',
  },
  {
    h: 'Use made-up examples while you are trying it out',
    p: 'Whatever you put into the app is yours, and it stays on your own device. While you are only evaluating it, please do not enter anyone else’s real health information.',
  },
  {
    h: 'It comes with no promises',
    p: 'This is a preview, not a finished product. It may change, break or stop working, and it is provided without any warranty.',
  },
];

/** The words beside the tick box. Also what a screen reader announces. */
export const NDA_TICK_LABEL = 'I agree to keep what I see confidential';

/** Shown when someone tries to go in without ticking. */
export const NDA_NUDGE = 'Tick the box above to agree, then you can go in.';

/** Said on screen, so the UI never oversells what the tick produces. */
export const NDA_FOOTNOTE =
  'Your agreement is noted on this device, with the date and the wording you agreed to.';

// ── the record on this device ───────────────────────────────────────────────
// Beside the access grant in `access.js` — a sibling key, written at the same
// moment, holding the same code id. Deliberately NOT inside the grant: the grant
// is re-checked against the registry on every load and is about the licence,
// while this is about the words, and the two change on different days.

/**
 * What this device agreed to, or null.
 *
 * Tolerates a half-written or non-JSON key (private mode, a storage quota death
 * mid-write) by answering "nothing was agreed" rather than throwing, because the
 * only caller is a gate that must still render.
 */
export function readNdaAcceptance() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!v || typeof v.version !== 'string' || !v.version) return null;
    return v;
  } catch { return null; }
}

/**
 * Has this device agreed to the wording that is shipping RIGHT NOW?
 *
 * Version-exact, not "has ever agreed to something". An old version is treated
 * as no agreement at all, which is what sends the device back to the door.
 */
export function ndaAccepted() {
  const rec = readNdaAcceptance();
  return !!rec && rec.version === NDA_VERSION;
}

/**
 * Write the agreement down: which wording, when, and under which licence.
 *
 * The code ID, never the code — same rule as the access grant. A device's
 * localStorage is not a safe place to leave something a human could read out.
 */
export function acceptNda(codeId) {
  const rec = {
    v: 1,
    version: NDA_VERSION,
    at: new Date().toISOString(),
    codeId: codeId ? String(codeId) : null,
  };
  try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch { /* private mode */ }
  return rec;
}

/** Hand it back — used by "this isn't my code" and by tests. */
export function clearNdaAcceptance() {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}
