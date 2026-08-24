// CompletedRing — the day's progress, drawn round the Completed disc.
//
// App5 lost the legacy build's streak ring and never replaced it, so the only
// signal that a day was going well was a small number in a badge. This is the
// permanent replacement: a thin arc round the Completed disc showing done ÷
// (done + still to do) for the day being viewed.
//
// Deliberately not a score, a streak, or a badge — nothing to break, nothing to
// lose. It fills as the day goes and starts empty tomorrow.
//
// It is also what the guide leaves behind: when the eighth quest lands the
// GuideDisc retires from the header and this ring does one full sweep in its
// place, so the header ends up with a permanent progress surface rather than a
// gap where the guide used to be.

import React from 'react';

const SIZE = 46;
const R = 21.4;                    // just outside the 46px disc's edge
const CIRC = 2 * Math.PI * R;

export default function CompletedRing({ done = 0, remaining = 0, sweep = false }) {
  const total = done + remaining;
  const target = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;

  // The finale sweep: one full lap, then settle on the real value.
  const [shown, setShown] = React.useState(target);
  React.useEffect(() => {
    if (!sweep) { setShown(target); return; }
    setShown(1);
    const t = setTimeout(() => setShown(target), 900);
    return () => clearTimeout(t);
  }, [sweep, target]);

  if (total === 0 && !sweep) return null;   // nothing planned, nothing to say

  return (
    <svg
      width={SIZE + 6} height={SIZE + 6} viewBox={'0 0 ' + (SIZE + 6) + ' ' + (SIZE + 6)}
      aria-hidden="true"
      data-guide-ring="1"
      style={{ position: 'absolute', left: -3, top: -3, pointerEvents: 'none', transform: 'rotate(-90deg)' }}
    >
      <circle cx={(SIZE + 6) / 2} cy={(SIZE + 6) / 2} r={R} fill="none" stroke="var(--hairline)" strokeWidth="2.2" />
      <circle
        cx={(SIZE + 6) / 2} cy={(SIZE + 6) / 2} r={R}
        fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - shown)}
        style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.3,1.1,.4,1)' }}
      />
    </svg>
  );
}
