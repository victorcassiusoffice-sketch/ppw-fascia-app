// SharedRoutineSheet — answering a routine someone sent you (2026-10-05).
//
// A practitioner sends a client one link; the boot pass decodes it and HOLDS it
// (store5.js setPendingShare). This is where the recipient answers for it, and
// it is the only place that payload can become their data.
//
// Three things it exists to get right:
//
//   1. IT SHOWS THE SCHEDULE. The .md import draft (AddSheet.jsx) prints only
//      title and time, so a recipient could accept a six-week programme with no
//      way of seeing that stack four is weekly and starts on day 7. Every row
//      here carries title · time · repeat · "from day N".
//   2. NO BUTTON IS A SILENT NO-OP. "Save to my Routines" is shown to EVERYONE,
//      because hiding it is not a paywall (the G1/W11 reasoning in store5.js) —
//      createRoutine refuses for a free user and raises `premiumUpsell`, and
//      that upsell is the outcome they see. "Add all to today" is refused the
//      same way by the free stack cap. Either way the sheet stays up, so the
//      programme is still here afterwards.
//   3. THE iOS ESCAPE HATCH. WhatsApp's in-app browser on iOS is a separate
//      storage partition: a save made in there is written to a throwaway
//      profile and is invisible in the installed app. When we are not running
//      standalone we say so and hand the link back, so it can be opened where
//      it will actually stick. This is the single most likely field failure.
//
// z-45: above the wizard (40) and the first-run doors (41), below the upsell
// modal (47) so a free user's paywall lands ON TOP of this rather than behind
// it, and below terms (50) and the lock screen (70).
//
// NOT above the account sheet (42) any more, however high this layer sits
// (2026-10-05, review pass). The account sheet is the app's only sign-in door,
// and the boot pass opens it to say things that cannot wait — "that sign-in link
// is dead", "your account is set up, set a password" — while the recipient's own
// "Save to my Routines → Sign in to go Premium" is what opens it most often of
// all. Painting over it left the sign-in field in the DOM and unreachable, with
// the only visible affordance a backdrop that deleted the programme. So this
// sheet STANDS DOWN while accountOpen is set, exactly as UpsellModal already
// does, and comes back when the account layer closes — the held programme is in
// state and mirrored to localStorage, so standing down costs nothing.
//
// DISMISSAL IS NOT A DECISION, either. The backdrop and "Not now" used to call
// clearPendingShare, which wipes state AND the localStorage mirror — and `#r=`
// was stripped from the URL on boot, so there was no way back at all. Both now
// hide the sheet and leave the programme held, reachable from the "1 programme
// waiting" chip; only the explicitly labelled "Discard this programme" clears.

import React from 'react';
import {
  useStore5, clearPendingShare, clearShareError, hideShareSheet, showShareSheet,
  createRoutine, routineItemsForSave, addItemsToToday, routineToLink, repeatLabel,
  anySheetOpen,
} from '../store5.js';
import { isStandalone, isIOS } from '../../lib/installPrompt.js';

const btnPrimary = { width: '100%', minHeight: 48, borderRadius: 15, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' };
const btnQuiet = { flex: 1, minHeight: 44, borderRadius: 14, border: '1px solid var(--rim)', background: 'transparent', color: 'var(--accent)', fontWeight: 600, fontSize: 13.5 };
const btnPlain = { minHeight: 44, padding: '0 16px', borderRadius: 14, border: 'none', background: 'none', color: 'var(--dim)', fontWeight: 600, fontSize: 13.5 };
// The one control on this sheet that destroys the programme. Subordinate to
// everything else on purpose, and it says what it does — the point of the
// 2026-10-05 pass is that nothing UNLABELLED can delete a prescription.
const btnDiscard = { width: '100%', minHeight: 40, marginTop: 4, borderRadius: 12, border: 'none', background: 'none', color: 'var(--dim)', fontWeight: 600, fontSize: 12.5 };

export default function SharedRoutineSheet() {
  const S = useStore5();
  // Every hook above every early return — React #300, as documented at
  // OnboardingScreen.jsx:123-126.
  const [msg, setMsg] = React.useState(null);
  const [copied, setCopied] = React.useState(null); // null | 'ok' | 'failed'
  // BOTH answers clear the pending share — otherwise the localStorage mirror
  // puts this sheet back on the next boot for a programme they already took —
  // so the acknowledgement cannot live in the share itself. Unlike the .md draft
  // (AddSheet), there is no surrounding sheet left to print "Saved …" into, so
  // this holds it for one beat.
  // { kind: 'routine', name } | { kind: 'today', count }
  const [ack, setAck] = React.useState(null);
  const pending = S.pendingShare;
  // Rebuilt rather than remembered: the URL the link arrived on was stripped
  // the moment it was read, so this is the only way back to a copyable link.
  const link = React.useMemo(() => (pending ? routineToLink(pending) : null), [pending]);
  React.useEffect(() => {
    setMsg(null); setCopied(null);
    // A new link arriving — readable or not — replaces the acknowledgement for
    // the last one rather than being buried under it.
    if (pending || S.shareError) setAck(null);
  }, [pending, S.shareError]);

  // A new recipient meets the first-run doors and the terms gate first. Clearing
  // either is not an answer to the share, so the sheet waits; the payload is
  // mirrored in localStorage and survives a reload in the middle of that.
  if (!S.firstRunChoice || !S.onboarded) return null;

  // RIGHT OF WAY. See the header: the account sheet is z42 and this is z45, and
  // burying the app's only sign-in door — which the paywall on this very sheet
  // is what sends people to — left them with no reachable control but a
  // destructive backdrop. Mirror of UpsellModal.jsx's own `S.accountOpen` guard.
  // Nothing is lost: the programme is held in state and on disk, and this comes
  // straight back when the account layer closes.
  if (S.accountOpen) return null;

  if (!pending && ack) {
    const title = ack.kind === 'today'
      ? `${ack.count} stack${ack.count === 1 ? '' : 's'} added to today`
      : `Saved “${ack.name}” to your Routines`;
    const body = ack.kind === 'today'
      ? 'They are on your Stack now, each on the day and time it was sent for.'
      : 'Find it under Library → Routines, and drop it onto any day.';
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'flex', alignItems: 'flex-end' }}>
        <div onClick={() => setAck(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
        <div role="status" style={{ position: 'relative', margin: '0 14px calc(96px + env(safe-area-inset-bottom, 0px))', width: '100%', borderRadius: 26, padding: '20px 20px 16px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both' }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{title}</div>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--dim)' }}>{body}</p>
          <button onClick={() => setAck(null)} style={{ ...btnPrimary, marginTop: 16 }}>Done</button>
        </div>
      </div>
    );
  }

  // A link mangled in transit used to fail in complete silence — the recipient
  // tapped it, the app opened on the stack screen, and nothing ever said why.
  //
  // clearShareError, not clearPendingShare: this panel answers for the BAD link
  // only. It used to clear the held share as well, which is how tapping OK on an
  // unrelated corrupt link was what finally deleted a good programme still
  // sitting in localStorage.
  if (!pending) {
    if (!S.shareError) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'flex', alignItems: 'flex-end' }}>
        <div onClick={clearShareError} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
        <div role="alert" style={{ position: 'relative', margin: '0 14px calc(96px + env(safe-area-inset-bottom, 0px))', width: '100%', borderRadius: 26, padding: '20px 20px 16px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both' }}>
          <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>That link didn’t open</div>
          <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, color: 'var(--ink)' }}>{S.shareError}</p>
          <button onClick={clearShareError} style={{ ...btnPrimary, marginTop: 16 }}>OK</button>
        </div>
      </div>
    );
  }

  // TAPPED PAST, NOT THROWN AWAY. The way back from a dismissal — without it,
  // "non-destructive" would just mean the programme was unreachable instead of
  // deleted. No backdrop here: the wrapper is pointer-transparent so the app
  // underneath is fully usable while the chip waits.
  //
  // It steps aside for any other layer, which is the same courtesy this sheet
  // now extends to the account layer — a pill floating at z45 over an open
  // AddSheet or player reads as a glitch, and the dismissal the person just made
  // was a request for the screen back. No recursion: shareSheetUp is false while
  // shareHidden is set, so anySheetOpen here answers only for the OTHER layers.
  if (S.shareHidden) {
    if (anySheetOpen(S) || S.coach || S.journalOpen) return null;
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 45, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end' }}>
        <button
          onClick={showShareSheet}
          aria-label={'1 programme waiting — reopen ' + pending.name}
          style={{ pointerEvents: 'auto', margin: '0 14px calc(104px + env(safe-area-inset-bottom, 0px))', maxWidth: 'calc(100% - 28px)', minHeight: 40, padding: '0 15px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 600, fontSize: 12.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', animation: 'ppwFade .3s ease both' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9" /><path d="M14 11a5 5 0 0 0-7.1 0L4.5 13.4a5 5 0 0 0 7.1 7.1l1.4-1.4" /></svg>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>1 programme waiting</span>
        </button>
      </div>
    );
  }

  const items = Array.isArray(pending.items) ? pending.items : [];
  const n = items.length;
  // A share held from before this field existed has no `dropped` at all.
  const dropped = Math.max(0, Math.floor(Number(pending.dropped)) || 0);

  const onSave = () => {
    // routineItemsForSave is not optional: these are PARSED items carrying the
    // internal `_day`, and writing that into ppw5.routines is how a day-21 stack
    // came back as day 0 the next time it was shared (naming law in store5.js).
    const r = createRoutine(pending.name, routineItemsForSave(items));
    if (r) { setAck({ kind: 'routine', name: r.name || pending.name }); clearPendingShare(); return; }
    // null = the store refused it (free tier) and has already raised the
    // upsell, which renders above this sheet. Keep the programme on screen so
    // it is still here when the paywall is dismissed.
    setMsg('Saving a routine is part of Premium — the programme stays here until you decide.');
  };

  const onToday = () => {
    const r = addItemsToToday(items);
    // ADDING IS AN ANSWER, exactly as saving is. This used to set a message and
    // stop there, leaving the programme in state and in the localStorage mirror:
    // the sheet was waiting over the app on the next launch and every launch
    // after it, and its live primary button re-added the whole programme on
    // every tap (addItemsToToday mints fresh ids and never dedupes, so a
    // two-stack programme became W1, W2, W1, W2 — and on the free tier the
    // duplicates ate the 10-stack cap).
    if (r && r.ok) { setAck({ kind: 'today', count: r.count }); clearPendingShare(); return; }
    // { upsell: true } — the free cap counts the WHOLE batch and imported
    // nothing, so saying nothing here would read as a broken button. The
    // programme is deliberately NOT cleared: a refusal is not an answer.
    setMsg('That’s more stacks than the free plan holds, so nothing was added.');
  };

  const onCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied('ok');
    } catch {
      // No clipboard permission, or no clipboard at all. Show the link instead
      // of leaving the tap with no outcome.
      setCopied('failed');
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 45, display: 'flex', alignItems: 'flex-end' }}>
      {/* hideShareSheet, NOT clearPendingShare. The whole dim upper half of a
          phone screen was a delete button with no label, no confirmation and no
          undo — one stray tap, or a quest spotlight's pass-through tap landing
          here, and a six-week prescription was gone from state, gone from the
          localStorage mirror, and unrecoverable because `#r=` had already been
          stripped from the URL on boot. */}
      <div onClick={hideShareSheet} style={{ position: 'absolute', inset: 0, background: 'rgba(30,38,52,.35)', animation: 'ppwFade .3s ease both' }} />
      <div style={{ position: 'relative', margin: '0 14px calc(96px + env(safe-area-inset-bottom, 0px))', width: '100%', maxHeight: 'calc(100% - 130px)', overflowY: 'auto', borderRadius: 30, padding: '22px 20px 20px', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', border: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .5s cubic-bezier(.3,1.36,.4,1) both' }}>
        {/* A SECOND LINK THAT DID NOT OPEN, reported WITHOUT disturbing the one
            already waiting (2026-10-05, review pass). shareError used to be
            mutually exclusive with pendingShare: a mangled link replaced the
            good programme's rows with a full error panel whose only button then
            deleted the orphaned localStorage copy. Now it is a banner above the
            programme, and dismissing it is just that. */}
        {S.shareError && (
          <div role="alert" style={{ marginBottom: 14, padding: '11px 12px', borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--surface)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>That other link didn’t open</div>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}>{S.shareError}</p>
            <p style={{ margin: '5px 0 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}>The programme below is unaffected.</p>
            <button onClick={clearShareError} style={{ ...btnQuiet, width: '100%', flex: 'none', minHeight: 38, marginTop: 9 }}>OK</button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9" /><path d="M14 11a5 5 0 0 0-7.1 0L4.5 13.4a5 5 0 0 0 7.1 7.1l1.4-1.4" /></svg>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase' }}>Shared with you</span>
        </div>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{pending.name}</div>
        <div style={{ marginTop: 3, fontSize: 12.5, color: 'var(--dim)' }}>{n} stack{n === 1 ? '' : 's'} · shared with you</div>

        {/* THE DECODER'S CEILING, SAID OUT LOUD (2026-10-05, review pass).
            parseRoutineLink keeps at most PLAN_MAX_ITEMS stacks and used to
            report nothing, so a programme that arrived a third shorter printed
            its truncated count here as though it were the whole thing — and the
            sender saw a normal "Link copied". This app's own sender now refuses
            above the ceiling (routineToLink returns null → the .md file, which
            carries them all), so a non-zero count means a hand-made or
            newer-version link: exactly the case that must not pass in silence. */}
        {dropped > 0 && (
          <div role="alert" style={{ marginTop: 8, padding: '9px 11px', borderRadius: 14, border: '1px solid var(--acc-rim)', fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}>
            {dropped} stack{dropped === 1 ? '' : 's'} on this link could not be opened. Ask whoever sent it for the file instead.
          </div>
        )}

        {/* The schedule, in full. A recipient who cannot see that a stack is
            weekly and starts on day 7 is not in a position to accept it. */}
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it, i) => {
            const day = Number(it.dayOffset ?? it._day ?? 0) || 0;
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 13px', borderRadius: 18, border: '1px solid var(--rim)', background: 'var(--surface)' }}>
                <span style={{ marginTop: 6, width: 6, height: 6, flex: 'none', borderRadius: 999, background: 'var(--accent)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--ink)', overflowWrap: 'anywhere' }}>{it.title}</div>
                  {/* `repeat` undefined means 'once' on BOTH import paths
                      (addItemsToToday and applyRoutineToDate both do
                      `repeat || 'once'`), so the label must say "Just once"
                      here. repeatLabel's own default for undefined is daily,
                      which is the stack screen's rule, not this one's — showing
                      it would promise a recurrence that never arrives. */}
                  <div style={{ marginTop: 2, fontSize: 12, color: 'var(--dim)' }}>
                    {it.time ? it.time + ' · ' : ''}{repeatLabel(it.repeat || 'once')}{day > 0 ? ' · from day ' + day : ''}
                  </div>
                  {/* A DOCUMENT CANNOT TRAVEL, on either rail. `fileId` points
                      at the sender's own IndexedDB and both parsers drop it, so
                      the row arrives with its title and nothing behind it.
                      Fixing that needs file upload, i.e. a backend, which the
                      README forbids — so say it plainly instead of handing
                      someone a stack that opens nothing. `thumb: 'doc'` with no
                      url is exact today: addDocToToday is the only writer of
                      that thumb, and it always sets a fileId. */}
                  {it.thumb === 'doc' && !it.url && (
                    <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--dim)' }}>The file stays on the sender’s device — ask them for it</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shown to everyone on purpose. The store answers for the free tier. */}
        <button onClick={onSave} style={{ ...btnPrimary, marginTop: 16 }}>Save to my Routines</button>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button onClick={onToday} style={btnQuiet}>Add all to today</button>
          {/* "Not now" means not now. It used to mean "forget this permanently",
              which is not what those words say and not what the quietest button
              on a sheet should do — so it hides, and the chip brings it back. */}
          <button onClick={hideShareSheet} style={btnPlain}>Not now</button>
        </div>
        {msg && <div role="status" style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.45, fontWeight: 600, color: 'var(--ink)', textAlign: 'center' }}>{msg}</div>}
        {/* The ONLY control that destroys the programme, and it says so. Before
            this, the two things that deleted it were an unlabelled backdrop and
            a button reading "Not now". */}
        <button onClick={clearPendingShare} style={btnDiscard}>Discard this programme</button>

        {/* The in-app-browser trap. Not a nag about installing — a specific
            warning that a save made HERE may not be the app they keep. */}
        {!isStandalone() && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hairline)' }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>
              {isIOS()
                ? 'Opened from a message? Anything you save here may stay in that app’s own browser. Copy the link and open it in Safari, or in the app on your home screen, so it sticks.'
                : 'Opened from a message? Anything you save here may stay in that app’s own browser. Copy the link and open it in your browser, or in the installed app, so it sticks.'}
            </div>
            {link && (
              <button onClick={onCopy} style={{ ...btnQuiet, width: '100%', flex: 'none', marginTop: 10 }}>
                {copied === 'ok' ? 'Link copied' : 'Copy this link'}
              </button>
            )}
            {copied === 'failed' && (
              <input readOnly value={link || ''} aria-label="Shared routine link" onFocus={(e) => e.target.select()} style={{ marginTop: 8, width: '100%', height: 42, padding: '0 12px', borderRadius: 12, border: '1px solid var(--hairline)', background: 'var(--track)', boxShadow: 'var(--inset)', color: 'var(--ink)', fontSize: 12 }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
