// InstallAppCard — Row 15 (L2-LS-DISTRIB), Ledger V2, 2026-07-29.
//
// "Get the app" section: the PWA has always been installable (manifest is
// correct — standalone display, maskable icons) but nothing ever invited
// anyone to install it. This is that invitation. Per-device behaviour:
//   Android / desktop Chrome+Edge → real one-tap Install button
//   iPhone / Safari               → "Tap Share → Add to Home Screen" card
//   already installed             → renders nothing
// No backend, no accounts, no store review — pure browser PWA APIs.

import React from 'react';
import { isStandalone, isIOS, canPromptInstall, promptInstall, subscribeInstall } from '../../lib/installPrompt.js';

function useInstallState() {
  const [tick, setTick] = React.useState(0);
  const [standalone, setStandalone] = React.useState(isStandalone());
  React.useEffect(() => {
    const unsub = subscribeInstall(() => { setTick((n) => n + 1); setStandalone(isStandalone()); });
    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onChange = () => setStandalone(isStandalone());
    mq?.addEventListener?.('change', onChange);
    return () => { unsub(); mq?.removeEventListener?.('change', onChange); };
  }, []);
  return { standalone, canInstall: canPromptInstall(), ios: isIOS(), tick };
}

const IDownload = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v13" /><path d="M6.5 11 12 16.5 17.5 11" /><path d="M4 20h16" /></svg>;
const IShare = <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v6.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V12" /></svg>;
const IPlus = <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="4.5" /><path d="M12 8.5v7M8.5 12h7" /></svg>;

// Full card — Settings → "Get the app". Always available so the invitation
// never disappears from the app's one permanent home.
export function InstallAppCard() {
  const { standalone, canInstall, ios } = useInstallState();
  const [busy, setBusy] = React.useState(false);
  if (standalone) return null; // already installed — the button hides itself

  const install = async () => {
    setBusy(true);
    try { await promptInstall(); } finally { setBusy(false); }
  };

  return (
    <div style={{ marginTop: 12, borderRadius: 24, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--rim)', boxShadow: 'var(--elev)', overflow: 'hidden' }}>
      <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IDownload}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, textShadow: 'var(--emboss)' }}>Get the app</div>
            <div style={{ marginTop: 2, fontSize: 12.5, color: 'var(--dim)' }}>{ios ? 'Add it to your Home Screen — no App Store needed.' : 'Install for a full-screen app, no browser bars.'}</div>
          </div>
        </div>

        {!ios && canInstall && (
          <button onClick={install} disabled={busy} style={{ height: 48, borderRadius: 14, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontWeight: 700, fontSize: 14.5, textShadow: 'var(--label-shadow)', boxShadow: 'var(--acc-glow)', opacity: busy ? .6 : 1 }}>
            {busy ? 'Installing…' : 'Install app'}
          </button>
        )}

        {!ios && !canInstall && (
          <div style={{ padding: '12px 14px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)', fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)' }}>
            Use your browser's menu → <strong>Install app</strong> (or <strong>Add to Home screen</strong>) to add it here.
          </div>
        )}

        {ios && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, border: '1px solid var(--hairline)', background: 'var(--track)' }}>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--dim)', flex: 1 }}>
              Tap <span style={{ display: 'inline-flex', verticalAlign: '-3px', color: 'var(--ink)' }}>{IShare}</span> <strong style={{ color: 'var(--ink)' }}>Share</strong>, then <strong style={{ color: 'var(--ink)' }}>Add to Home Screen</strong> <span style={{ display: 'inline-flex', verticalAlign: '-3px', color: 'var(--ink)' }}>{IPlus}</span>.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Compact dismissible banner — shown once on the Stack landing screen so a
// first-time visitor sees the invitation without digging into Settings.
const DISMISS_KEY = 'ppw5.installBannerDismissed';

export function InstallBanner() {
  const { standalone, canInstall, ios } = useInstallState();
  const [dismissed, setDismissed] = React.useState(() => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } });
  const [busy, setBusy] = React.useState(false);
  if (standalone || dismissed) return null;
  if (!ios && !canInstall) return null; // nothing actionable yet — stay quiet on the landing screen

  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch {} setDismissed(true); };
  const install = async () => { setBusy(true); try { const r = await promptInstall(); if (r) dismiss(); } finally { setBusy(false); } };

  return (
    <div style={{ position: 'relative', marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 20, background: 'var(--surface)', backdropFilter: 'var(--blur)', WebkitBackdropFilter: 'var(--blur)', border: '1px solid var(--acc-rim)', boxShadow: 'var(--acc-glow)', animation: 'ppwRise .3s ease both' }}>
      <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 12, background: 'var(--acc-surf)', border: '1px solid var(--acc-rim)', color: 'var(--acc-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{IDownload}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, textShadow: 'var(--emboss)' }}>Get the app</div>
        <div style={{ marginTop: 1, fontSize: 11.5, color: 'var(--dim)' }}>{ios ? 'Share → Add to Home Screen' : 'One tap, no App Store'}</div>
      </div>
      {ios ? (
        <button onClick={dismiss} style={{ height: 34, padding: '0 13px', borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 12, fontWeight: 700 }}>Got it</button>
      ) : (
        <button onClick={install} disabled={busy} style={{ height: 34, padding: '0 13px', borderRadius: 999, border: '1px solid var(--acc-rim)', background: 'var(--acc-surf)', color: 'var(--acc-ink)', fontSize: 12, fontWeight: 700, opacity: busy ? .6 : 1 }}>{busy ? '…' : 'Install'}</button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" style={{ position: 'absolute', top: -7, right: -7, width: 22, height: 22, borderRadius: 999, border: '1px solid var(--rim)', background: 'var(--disc)', color: 'var(--dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--elev)' }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
