// "A new version is ready" bar — the New Design's update prompt.
//
// WHY THIS EXISTS, given src/components/UpdateToast.jsx already did this job:
// that toast is rendered only in the LEGACY branch of src/App.jsx (line ~229),
// below the `if (NEW_DESIGN_ONLY) return <App5/>` early return added at the
// 2026-07-06 cutover. So since that date NOBODY has seen an update prompt — the
// component was live code in a tree that never renders. The service worker still
// updated silently in the background, but a user sitting on a cached build was
// never told, and never offered the choice.
//
// That is not academic: it cost a full day (Vic, 2026-08-05) — he was looking at
// a cached build and correctly reported "there is no sign in" when the button was
// live. This bar is the fix, and it deliberately reuses the SAME swUpdate.js
// machinery rather than introducing a second update mechanism.
//
// Styled in App5 tokens and positioned inside the phone frame, because the legacy
// toast reads --col-* / --r-pill tokens that do not exist in the App5 shell and
// uses position:fixed, which escapes the frame on desktop.

import React from 'react';
import { onUpdateState, applyUpdate } from '../../lib/swUpdate.js';

export default function UpdateBar() {
  const [ready, setReady] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => onUpdateState((s) => { if (s.updateReady) setReady(true); }), []);

  if (!ready || hidden) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute', left: 14, right: 14,
        bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))',
        zIndex: 44,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 12px 12px 16px', borderRadius: 20,
        // No backdrop-filter: this element animates in, and the binding perf law
        // keeps blur off animated surfaces.
        background: 'var(--surface-strong)', border: '1px solid var(--rim)',
        boxShadow: 'var(--elev-hi)', color: 'var(--ink)',
        animation: 'ppwSheetIn .45s cubic-bezier(.3,1.36,.4,1) both',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>
        A new version is ready
        <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, fontWeight: 500, color: 'var(--dim)' }}>
          You can keep using this one — it just won’t have the latest fixes.
        </span>
      </span>
      <button
        onClick={() => setHidden(true)}
        style={{ flex: 'none', minHeight: 40, padding: '0 10px', background: 'none', border: 'none', color: 'var(--dim)', fontSize: 13, fontWeight: 600 }}
      >
        Later
      </button>
      <button
        onClick={applyUpdate}
        style={{ flex: 'none', minHeight: 40, padding: '0 16px', borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 13.5, fontWeight: 700, boxShadow: 'var(--acc-glow)' }}
      >
        Update
      </button>
    </div>
  );
}
