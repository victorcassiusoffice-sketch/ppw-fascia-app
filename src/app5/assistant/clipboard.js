// clipboard — the phone round-trip helpers.
//
// Sending the prompt OUT: navigator.share() opens the native iOS/Android share
// sheet, so the user picks their real ChatGPT/Claude/Gemini app (already logged
// in). We deliberately do NOT link to chatgpt.com — from an installed PWA that
// opens an in-app web view where the user is signed out and the return trip
// breaks. Copy-to-clipboard is the always-present fallback.
//
// Getting the reply BACK: a plain textarea paste is the primary path — it works
// everywhere. readText() is offered as a one-tap assist and fails silently
// (Safari only allows it from a user gesture, and may still refuse).

export async function sharePrompt(text, title = 'Plan my day') {
  try {
    if (navigator.share) { await navigator.share({ text, title }); return { ok: true, via: 'share' }; }
  } catch (e) {
    if (e && e.name === 'AbortError') return { ok: false, via: 'share', cancelled: true };
  }
  return copyText(text);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true, via: 'clipboard' };
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return { ok, via: 'execCommand' };
  } catch { return { ok: false, via: 'none' }; }
}

// One-tap "paste for me". Never throws, never blocks the flow — the textarea is
// always there if this is refused.
export async function readText() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const t = await navigator.clipboard.readText();
      if (t && t.trim()) return { ok: true, text: t };
    }
  } catch { /* permission denied / unsupported — silent by design */ }
  return { ok: false, text: '' };
}

export const canShare = () => typeof navigator !== 'undefined' && !!navigator.share;
