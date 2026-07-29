// Install-prompt utilities — Row 15 (L2-LS-DISTRIB), Ledger V2.
//
// Captures the browser's `beforeinstallprompt` event (Android/Chrome/Edge/
// desktop Chromium) so a real "Install" button can trigger it later, and
// exposes plain-JS helpers for iOS/standalone detection. No backend, no
// accounts, no network calls — pure browser APIs, module-singleton state so
// every component sees the same captured event regardless of mount order.

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // stop the mini-infobar; we drive install from our own button
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS Safari's own flag
  );
}

export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as "Macintosh" but exposes multi-touch — the standard
  // sniff for telling an iPad apart from a real Mac.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

export function canPromptInstall() {
  return !!deferredPrompt;
}

export async function promptInstall() {
  if (!deferredPrompt) return null;
  const prompt = deferredPrompt;
  prompt.prompt();
  const choice = await prompt.userChoice; // { outcome: 'accepted' | 'dismissed' }
  deferredPrompt = null;
  notify();
  return choice;
}

export function subscribeInstall(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
