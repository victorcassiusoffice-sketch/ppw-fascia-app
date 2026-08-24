// QuestJournalSheet — "Your guide": the eight quests as a list you tick off.
//
// The app's own idea is that a day is a stack of things you tick off, so the
// tutorial wears the same clothes. Same rounded rows, same round tick, same
// spring, same press sound. Learning the app and using the app should not feel
// like two different products.
//
// Nothing here is locked, nothing expires, order does not matter, and a
// finished quest can be replayed forever without un-ticking.

import React from 'react';
import { useStore5, closeJournal } from '../store5.js';
import { QUESTS, QUEST_IDS, doneCountOf, startQuest } from '../coach/quests5.js';
import { sfx } from '../sfx5.js';

export default function QuestJournalSheet() {
  const S = useStore5();
  if (!S.journalOpen) return null;

  const q = (S.guide && S.guide.q) || {};
  const done = doneCountOf(S);
  const total = QUEST_IDS.length;

  // The halfway line is the one bit of encouragement in the whole guide, and it
  // is a fact rather than a cheer.
  const sub = done >= total ? 'All eight done. Replay any of them whenever you want.'
    : done >= 4 ? 'Halfway. The rest is quicker.'
      : 'Eight small quests. Any order.';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 43, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={closeJournal} style={{ position: 'absolute', inset: 0, background: 'rgba(18,22,28,.45)', animation: 'ppwFade .3s ease both' }} />
      <div role="dialog" aria-label="Your guide" data-guide-sheet="1" style={{ position: 'relative', maxHeight: '82%', overflowY: 'auto', borderRadius: '28px 28px 0 0', padding: '22px 20px calc(26px + env(safe-area-inset-bottom, 0px))', background: 'var(--surface-strong)', backdropFilter: 'var(--blur-heavy)', WebkitBackdropFilter: 'var(--blur-heavy)', borderTop: '1px solid var(--rim)', boxShadow: 'var(--elev-hi)', animation: 'ppwSheetIn .42s cubic-bezier(.3,1.3,.4,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-.02em', textShadow: 'var(--emboss)' }}>Your guide</h2>
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--dim)' }}>{sub}</div>
          </div>
          <div style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--accent)', paddingTop: 6 }}>{done} of {total}</div>
          <button onClick={closeJournal} aria-label="Close" style={{ flex: 'none', width: 40, height: 40, marginTop: -2, marginRight: -6, borderRadius: 999, border: 'none', background: 'none', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {QUESTS.map((quest) => {
            const isDone = !!q[quest.id];
            return (
              <button
                key={quest.id}
                onClick={() => { sfx('drop'); startQuest(quest.id); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '13px 15px', minHeight: 66, borderRadius: 22, background: 'var(--surface)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', color: 'var(--ink)' }}
              >
                {/* the deck's own round tick, same spring */}
                <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 999, border: '1.5px solid ' + (isDone ? 'var(--acc-rim)' : 'var(--rim)'), background: isDone ? 'var(--acc-surf)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--acc-ink)', transition: 'all .3s cubic-bezier(.3,1.3,.4,1)' }}>
                  {isDone && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'ppwRise .34s cubic-bezier(.3,1.4,.4,1) both' }}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>{quest.title}</span>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: 'var(--dim)' }}>{quest.blurb}</span>
                </span>
                <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 700, letterSpacing: '.04em', color: 'var(--accent)' }}>{isDone ? 'Replay' : 'Start'}</span>
              </button>
            );
          })}
        </div>

        {/* Said plainly, because there is no backend behind this yet and a
            promise of sync we cannot keep is worse than the limitation. */}
        <div style={{ marginTop: 16, fontSize: 12, lineHeight: 1.5, color: 'var(--dim)', textAlign: 'center' }}>
          Your guide progress lives on this phone.
        </div>
      </div>
    </div>
  );
}
