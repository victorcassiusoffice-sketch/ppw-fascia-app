// LiquidSplit — the MLT (Minimalistic Liquid Transition) entrance engine.
//
// Generalises LiquidMorphCluster (the stack-card horizontal melt) to a 2D set
// of arbitrary glass pills/tokens: on mount, every option starts FULLY
// OVERLAPPED at the cluster centroid (one liquid mass) and TRAVELS OUT to its
// laid-out rest slot. While overlapped, the SVG goo filter (blur → alpha
// threshold) solidifies thick necks between the blurred blob alphas; the necks
// thin as the options separate, then the goo layer fades as the crisp glass
// pills resolve. This is Vic's "one-mass-splits" melt, reused for every
// selection page (Entry / Lifestyle / Level).
//
// Glass laws honoured:
//  • goo is WHITE liquid LIGHT, never opaque accent paint (law #2).
//  • the crisp option pills are .glass-capsule/.glass-disc — gradient-painted,
//    NO backdrop-filter — so animating their transform never hits perf law #3.
//  • prefers-reduced-motion / -transparency → static rest cluster (no goo, no rAF).
//
// Contract: pass the option elements as direct children (buttons/links). They
// are cloned with a data-flag + measured; the caller styles them as pills and
// sets the layout via `className` (this component IS the flex/grid container).

import React, { useRef, useLayoutEffect, useId } from 'react';
import { DUR, reduced as reducedFn } from '../lib/motion';

// Deliberately slow ease (matches LiquidMorphCluster): the mass LINGERS, then
// eases out with a whisper of overshoot — "melt then settle".
function easeTravel(p) {
  if (p <= 0) return 0; if (p >= 1) return 1;
  const s = Math.max(0, (p - 0.16) / 0.84);
  const c1 = 1.70158 * 0.55;
  return 1 + (c1 + 1) * Math.pow(s - 1, 3) + c1 * Math.pow(s - 1, 2);
}
function smooth(a, b, p) { const t = Math.min(1, Math.max(0, (p - a) / (b - a))); return t * t * (3 - 2 * t); }

export default function LiquidSplit({ children, className = '', as: Tag = 'div', playKey = 0 }) {
  const wrapRef = useRef(null);
  const rawId = useId();
  const filterId = 'ls-goo-' + rawId.replace(/[^a-zA-Z0-9]/g, '');
  const reduced = reducedFn();
  const kids = React.Children.toArray(children);
  const n = kids.length;

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const items = Array.from(wrap.querySelectorAll('[data-ls-item]'));
    const gooLayer = wrap.querySelector('[data-ls-goo]');
    const blobs = gooLayer ? Array.from(gooLayer.children) : [];
    if (!items.length) return;

    const wrapRect = wrap.getBoundingClientRect();
    const cx = wrapRect.width / 2, cy = wrapRect.height / 2;
    const targets = items.map((el) => {
      const r = el.getBoundingClientRect();
      const left = r.left - wrapRect.left;
      const top = r.top - wrapRect.top;
      return { dx: cx - (left + r.width / 2), dy: cy - (top + r.height / 2), w: r.width, h: r.height, left, top };
    });

    // Size + place the goo blobs to mirror each option's rest rect.
    blobs.forEach((b, i) => {
      const t = targets[i]; if (!t) return;
      b.style.width = t.w + 'px'; b.style.height = t.h + 'px';
      b.style.left = t.left + 'px'; b.style.top = t.top + 'px';
    });

    if (reduced) {
      items.forEach((el) => { el.style.transform = ''; el.style.opacity = '1'; el.style.willChange = ''; });
      if (gooLayer) gooLayer.style.opacity = '0';
      return;
    }

    const place = (p) => {
      const e = easeTravel(p);
      const gooOp = 1 - smooth(0.58, 1.0, p);     // mass fades as the pills crisp
      const crispOp = smooth(0.26, 0.84, p);      // pills resolve EARLY (melt within the mass)
      for (let i = 0; i < items.length; i++) {
        const t = targets[i];
        const x = t.dx * (1 - e), y = t.dy * (1 - e);   // start overlapped at centroid → travel to rest
        items[i].style.transform = `translate(${x}px,${y}px) scale(${0.8 + 0.2 * e})`;
        items[i].style.opacity = String(crispOp);
        if (blobs[i]) blobs[i].style.transform = `translate(${x}px,${y}px)`;
      }
      if (gooLayer) gooLayer.style.opacity = String(gooOp);
    };

    let raf = 0, t0 = null;
    const DURMS = DUR.morph;
    items.forEach((el) => { el.style.willChange = 'transform,opacity'; });
    place(0);
    const frame = (now) => {
      if (t0 == null) t0 = now;
      const p = Math.min(1, (now - t0) / DURMS);
      place(p);
      if (p < 1) { raf = requestAnimationFrame(frame); }
      else {
        // Hand control back to CSS so :active press-melt works (inline transform
        // would otherwise override the .glass-disc/.glass-capsule :active rule).
        items.forEach((el) => { el.style.transform = ''; el.style.opacity = ''; el.style.willChange = ''; });
        if (gooLayer) gooLayer.style.opacity = '0';
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  // re-run on each (re)mount / explicit replay.
  }, [n, reduced, playKey]);

  return (
    <Tag ref={wrapRef} className={'liquid-split ' + className}>
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
          <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9" result="goo" />
        </filter>
      </svg>
      {!reduced && (
        <div data-ls-goo className="liquid-split-goo" style={{ filter: `url(#${filterId})`, opacity: 0 }} aria-hidden="true">
          {kids.map((_, i) => (<span key={i} className="liquid-split-blob" />))}
        </div>
      )}
      {kids.map((c, i) =>
        React.cloneElement(c, {
          key: c.key ?? i,
          'data-ls-item': '',
          style: { ...(c.props.style || {}), position: 'relative', zIndex: 1, opacity: reduced ? 1 : 0 },
        })
      )}
    </Tag>
  );
}
