// LiquidMorphCluster — the recording-grade liquid metaball morph for the
// stack-card tap-open action cluster (REF Recording A: a control MELTS open
// into its option icons through thick liquid necks, then settles crisp).
//
// WHY THIS, NOT THE PRIOR PASS (banked in 06-Roadmap/skills/advanced-liquid-morph.md):
//   The first pass laid the goo blobs at their RESTING separated positions and
//   only scaled them up in place. An SVG goo filter (blur → alpha threshold)
//   can only NECK shapes whose blurred alphas OVERLAP — static blobs 12px apart
//   never overlap, so no neck formed and it read as a soft bloom. The fix is the
//   "one-mass-splits" drive: every disc/blob starts FULLY OVERLAPPED at the row
//   centre (one mass) and TRAVELS OUT to its rest slot. Mid-travel the blurred
//   alphas overlap heavily → the threshold solidifies a thick neck → the neck
//   thins as they separate → the goo layer fades as the crisp discs resolve.
//   Measured 60fps (incl. 4× CPU throttle) — the filter region is tiny + the
//   morph is a ~1.1s one-shot. Approaches tried + fps in the skill file.
//
// Glass laws honoured: goo is WHITE liquid LIGHT (never opaque accent paint);
// the crisp discs are the app's `.glass-disc` (no backdrop-filter, so the
// travelling transforms don't violate perf law #3); reduced-motion / reduced-
// transparency collapse to a static rest cluster (no goo, no rAF).

import React, { useRef, useLayoutEffect } from 'react';
import { DUR } from '../../lib/motion';

const DISC = 48;        // --ppw-tap-min (Lens-3 tap law)
const MAX_GAP = 12;
const MIN_GAP = 4;

// Deliberately slow ease: the mass LINGERS (first ~18%), then eases out with a
// whisper of overshoot — the "melt then settle" character of the reference.
function easeTravel(p) {
  if (p <= 0) return 0; if (p >= 1) return 1;
  const s = Math.max(0, (p - 0.18) / 0.82);
  const c1 = 1.70158 * 0.6; // softened overshoot
  return 1 + (c1 + 1) * Math.pow(s - 1, 3) + c1 * Math.pow(s - 1, 2);
}
function smooth(a, b, p) { const t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); }

export default function LiquidMorphCluster({ actions, reduced }) {
  const zoneRef = useRef(null);
  const gooRef = useRef(null);
  const blobRefs = useRef([]);
  const discRefs = useRef([]);
  const n = actions.length;

  useLayoutEffect(() => {
    const zone = zoneRef.current;
    if (!zone) return;
    // Fit the row to the available width: keep the 48px tap target, shrink the
    // gap (down to 4px) so 6 discs never overflow a 320px card. Closer discs
    // also neck more readily — a happy alignment.
    const avail = Math.max(DISC, zone.clientWidth || (n * DISC + (n - 1) * MAX_GAP));
    const gap = n > 1
      ? Math.max(MIN_GAP, Math.min(MAX_GAP, (avail - n * DISC) / (n - 1)))
      : MAX_GAP;
    const rowW = n * DISC + (n - 1) * gap;
    const offset = Math.max(0, (avail - rowW) / 2);     // centre the cluster
    const restX = (i) => offset + i * (DISC + gap);
    const startX = avail / 2 - DISC / 2;                // one overlapped mass at centre

    const place = (i, x, scale, op) => {
      const d = discRefs.current[i];
      if (d) { d.style.transform = `translateX(${x}px) scale(${scale})`; d.style.opacity = String(op); }
      const b = blobRefs.current[i];
      if (b) b.style.transform = `translateX(${x}px)`;
    };

    if (reduced) {
      // Static rest cluster — honours prefers-reduced-motion / -transparency.
      for (let i = 0; i < n; i++) place(i, restX(i), 1, 1);
      if (gooRef.current) gooRef.current.style.opacity = '0';
      return;
    }

    let raf = 0, t0 = null;
    const DURMS = DUR.morph;
    const frame = (now) => {
      if (t0 == null) t0 = now;
      const p = Math.min(1, (now - t0) / DURMS);
      const e = easeTravel(p);
      const gooOp = 1 - smooth(0.66, 1.0, p);   // gooey mass fades as discs crisp
      const crispOp = smooth(0.32, 0.90, p);    // icons resolve EARLY — melt within the mass
      if (gooRef.current) gooRef.current.style.opacity = String(gooOp);
      for (let i = 0; i < n; i++) {
        const x = startX + (restX(i) - startX) * e;
        place(i, x, 0.88 + 0.12 * e, crispOp);
      }
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  // re-run when the action set or motion preference changes (= each open).
  }, [n, reduced]);

  return (
    <div className="stack-actions-zone" ref={zoneRef} style={{ height: DISC }}>
      {!reduced && (
        <div className="stack-goo-layer" ref={gooRef} aria-hidden="true" style={{ opacity: 0 }}>
          {actions.map((a, i) => (
            <span
              key={a.key}
              className="stack-goo-blob"
              ref={(el) => { blobRefs.current[i] = el; }}
            />
          ))}
        </div>
      )}
      <div className="stack-actions">
        {actions.map((a, i) => (
          <button
            key={a.key}
            type="button"
            ref={(el) => { discRefs.current[i] = el; }}
            onClick={(e) => { e.stopPropagation(); a.onClick(); }}
            className={`glass-disc stack-act${a.danger ? ' is-danger' : ''}${a.on ? ' is-on' : ''}`}
            aria-label={a.label}
            aria-pressed={a.on || undefined}
            title={a.label}
            style={{ opacity: reduced ? 1 : 0 }}
          >{a.icon}</button>
        ))}
      </div>
    </div>
  );
}
