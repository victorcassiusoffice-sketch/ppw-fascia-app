// GuideDisc — the guide's home in the Stack header.
//
// A small disc in the same neumorphic family as the Completed and bell discs,
// wearing an eight-segment ring: one segment per quest, filling as they land.
// It is the only permanent entry point to the guide while the guide is running,
// and it retires the moment all eight are done — the disc animates out and the
// journal moves to Settings, so a finished guide stops taking up header space.
//
// Tapping it resumes an interrupted quest where it was left, otherwise it opens
// the journal. Someone who paused mid-quest and came back should not have to
// find their place again.

import React from 'react';
import { useStore5, openJournal, getState } from '../store5.js';
import { QUEST_IDS, doneCountOf, startQuest } from '../coach/quests5.js';
import { readResume } from '../store5.js';

const SIZE = 46;
const R = 19;
const CIRC = 2 * Math.PI * R;
const GAP = 5;                                  // degrees of gap between segments
const SEG = (360 / QUEST_IDS.length) - GAP;
const segLen = (SEG / 360) * CIRC;
const gapLen = (GAP / 360) * CIRC;

export default function GuideDisc() {
  const S = useStore5();
  const done = doneCountOf(S);
  const finished = !!(S.guide && S.guide.done);
  const pulsing = !!(S.hint && S.hint.id === 'guide-pulse');

  // The finale plays the disc out rather than snapping it away, so the guide
  // visibly LEAVES instead of just being gone next time you look.
  const [leaving, setLeaving] = React.useState(false);
  const wasFinished = React.useRef(finished);
  React.useEffect(() => {
    if (finished && !wasFinished.current) { setLeaving(true); const t = setTimeout(() => setLeaving(false), 520); return () => clearTimeout(t); }
    wasFinished.current = finished;
  }, [finished]);

  if (finished && !leaving) return null;

  const tap = () => {
    const r = readResume();
    if (r && r.questId && !((getState().guide.q || {})[r.questId])) { startQuest(r.questId, r.i || 0); return; }
    openJournal();
  };

  return (
    <button
      onClick={tap}
      data-tour="guide"
      data-guide-disc="1"
      aria-label={'Your guide — ' + done + ' of ' + QUEST_IDS.length + ' quests done'}
      style={{
        position: 'relative', width: SIZE, height: SIZE, flex: 'none', borderRadius: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--disc)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', color: 'var(--ink)',
        transform: leaving ? 'scale(.6)' : 'scale(1)', opacity: leaving ? 0 : 1,
        transition: 'transform .5s cubic-bezier(.3,1.2,.4,1), opacity .5s ease',
        animation: pulsing ? 'ppwRise .6s cubic-bezier(.3,1.4,.4,1) 3' : undefined,
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={'0 0 ' + SIZE + ' ' + SIZE} aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        {QUEST_IDS.map((id, k) => (
          <circle
            key={id}
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            fill="none"
            stroke={(S.guide && S.guide.q && S.guide.q[id]) ? 'var(--accent)' : 'var(--hairline)'}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={segLen + ' ' + (CIRC - segLen)}
            strokeDashoffset={-(k * (segLen + gapLen))}
            style={{ transition: 'stroke .45s ease' }}
          />
        ))}
      </svg>
      {/* a compass rose, not a question mark: this is a guide, not a help desk */}
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'relative' }}>
        <circle cx="12" cy="12" r="7.4" />
        <path d="M14.7 9.3l-1.5 4-4 1.5 1.5-4z" />
      </svg>
    </button>
  );
}
