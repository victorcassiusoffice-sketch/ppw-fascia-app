// ReorderGhost — a two-card loop that shows what dragging actually does.
//
// The drag semantics in this app are genuinely surprising: the TIME SLOTS stay
// put and the things swap between them. Words alone did not land it in testing,
// so the `reorder` hint shows it: two cards trade places while their time
// labels sit still.
//
// prefers-reduced-motion gets a static two-frame swap instead of the loop —
// the same information, no movement.

import React from 'react';

const CARD = {
  position: 'absolute', left: 0, right: 0, height: 30, borderRadius: 12,
  border: '1px solid var(--rim)', background: 'var(--surface)',
  display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
  fontSize: 11.5, fontWeight: 600, color: 'var(--ink)',
};
const TIME = { marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--dim)' };

export default function ReorderGhost() {
  const reduced = usePrefersReducedMotion();
  const [swapped, setSwapped] = React.useState(false);

  React.useEffect(() => {
    if (reduced) { setSwapped(true); return; }         // one still swap, no loop
    const t = setInterval(() => setSwapped((s) => !s), 1400);
    return () => clearInterval(t);
  }, [reduced]);

  const move = reduced ? 'none' : 'top .5s cubic-bezier(.3,1.2,.4,1)';

  return (
    <div aria-hidden="true" style={{ position: 'relative', height: 74, marginBottom: 12 }}>
      {/* the slots — these never move, which is the whole point */}
      <div style={{ position: 'absolute', right: 10, top: 6, ...TIME }}>07:30</div>
      <div style={{ position: 'absolute', right: 10, top: 44, ...TIME }}>21:00</div>

      <div style={{ ...CARD, top: swapped ? 38 : 0, transition: move }}>
        <span style={{ width: 14, height: 14, borderRadius: 5, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', flex: 'none' }} />
        Yoga
      </div>
      <div style={{ ...CARD, top: swapped ? 0 : 38, transition: move }}>
        <span style={{ width: 14, height: 14, borderRadius: 5, background: 'var(--track)', border: '1px solid var(--rim)', flex: 'none' }} />
        Breathing
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let mq;
    try { mq = window.matchMedia('(prefers-reduced-motion: reduce)'); } catch { return; }
    const on = () => setReduced(!!mq.matches);
    on();
    if (mq.addEventListener) { mq.addEventListener('change', on); return () => mq.removeEventListener('change', on); }
    if (mq.addListener) { mq.addListener(on); return () => mq.removeListener(on); }
  }, []);
  return reduced;
}
