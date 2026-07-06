// TermsScreen — New Design "Terms & Health Disclaimer" (faithful port).
//
// Vic's actual legal + health disclaimer text (verbatim from the prototype).
// Full-screen overlay opened from Settings. Close returns to the app.

import React from 'react';
import { useStore5, closeTerms } from '../store5.js';

const SECTIONS = [
  { h: '1 · Not medical advice', p: <>Everything here is general wellbeing information and personal suggestions drawn from publicly available studies. It is <strong>not</strong> medical, psychological or professional health advice and does not replace a qualified doctor, therapist or licensed professional. Consult one before starting any exercise, fasting, breathwork, cold exposure or mental-health practice — especially if you have a condition, are pregnant or take medication. You use every routine at your own risk.</> },
  { h: '2 · What this service is', p: <>PPWellness organizes links, manages schedules and provides curation and assistant support — arranging the content <em>you</em> choose into time slots. We do <strong>not</strong> host, copy, download, store or sell any content of any kind — videos, audio, text, courses or otherwise. Every item plays or opens from its original third-party source (e.g. YouTube, Spotify) under that source's own terms, and <strong>all content remains freely available outside this app</strong>; we only point to what already exists elsewhere. You choose and control what occupies each slot, and can change or remove it at any time.</> },
  { h: '3 · Our model & fees', p: <>Any fee is for our labor only — the time spent organizing slots, scheduling, curation and administrative support — never for the content itself. No direct distribution: we do not restrict, paywall or resell third-party material. You are responsible for following the terms of service of any platform you use and for only linking content you are permitted to access. Organizing publicly available links carries the lowest risk.</> },
  { h: '4 · Cached logins', p: <>If you save a course or login shortcut, any session is stored only on your own device for your convenience. We never receive or store your passwords. Keep your device secure.</> },
  { h: '5 · Liability', p: <>The app is provided "as is" without warranties of any kind. To the fullest extent permitted by law, PPWellness and Victor Cassius Bhatoolaul accept no liability for any loss, injury or damage arising from use of this app, from third-party content or platforms, or from changes in content availability.</> },
];

export default function TermsScreen() {
  const S = useStore5();
  if (!S.termsOpen) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'var(--ground)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '22px 20px 12px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-.01em', textShadow: 'var(--emboss)' }}>Terms &amp; Health Disclaimer</div>
        <button onClick={closeTerms} aria-label="Close" style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', padding: '6px 22px 24px' }}>
        <p style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--dim)' }}>Provided by Victor Cassius Bhatoolaul (“PPWellness”, “we”). Please read before you begin.</p>
        {SECTIONS.map((s) => (
          <React.Fragment key={s.h}>
            <div style={{ marginTop: 16, fontSize: 13, fontWeight: 800, letterSpacing: '.02em', color: 'var(--accent)', textShadow: 'var(--emboss)' }}>{s.h}</div>
            <p style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)' }}>{s.p}</p>
          </React.Fragment>
        ))}
      </div>
      <div style={{ position: 'relative', padding: '12px 20px calc(18px + env(safe-area-inset-bottom, 0px))' }}>
        <button onClick={closeTerms} style={{ width: '100%', height: 52, borderRadius: 16, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 15, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)' }}>Close</button>
      </div>
    </div>
  );
}
