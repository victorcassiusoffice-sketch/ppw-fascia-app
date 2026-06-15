// "New version available" toast (2026-06-15, SW auto-update fix).
//
// Surfaces when src/lib/swUpdate.js detects a freshly-installed build waiting to
// take over. Tapping Refresh applies it immediately; otherwise it auto-applies
// when the app is backgrounded or on the next cold launch (see swUpdate.js).
//
// Liquid-glass laws kept intact: a toast ANIMATES (rise + fade), so per the
// binding perf law it must NOT carry a backdrop-filter — it uses the solid
// `--col-surface` token, exactly like the existing BottomNav status toast. It
// is reduced-motion safe (the shared `toastIn` variant collapses to an
// instant opacity fade) and fully aria-labelled / keyboard reachable.

import React, { useEffect, useState } from 'react';
import { m, AnimatePresence, toastIn } from '../lib/motion';
import { onUpdateState, applyUpdate } from '../lib/swUpdate.js';

export default function UpdateToast() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => onUpdateState((s) => {
    if (s.updateReady) setShow(true);
  }), []);

  const visible = show && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <m.div
          role="status"
          aria-live="polite"
          aria-label="A new version of the app is available"
          variants={toastIn}
          initial="hidden"
          animate="show"
          exit="exit"
          style={{
            position: 'fixed',
            left: '50%',
            x: '-50%',
            bottom: 'calc(84px + env(safe-area-inset-bottom))',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            maxWidth: 'calc(100vw - 32px)',
            background: 'var(--col-surface)',
            color: 'var(--col-ink)',
            boxShadow: 'var(--elv-2)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-pill)',
            padding: '8px 8px 8px 16px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span>New version available</span>
          <button
            type="button"
            onClick={() => { applyUpdate(); }}
            style={{
              background: 'var(--accent-glass-bg)',
              backgroundImage: 'var(--glass-fill)',
              color: 'var(--col-accent)',
              border: '1px solid var(--col-accent)',
              borderRadius: 'var(--r-pill)',
              padding: '6px 14px',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            title="Dismiss"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--col-muted, currentColor)',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </m.div>
      )}
    </AnimatePresence>
  );
}
