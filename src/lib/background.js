// User-selectable backgrounds (Refinement 2, 2026-06-11 — REF-01/04/05).
//
// The surface behind the glass UI is the user's choice. Two PPW defaults
// (Vic-referenced): 'nature' — the dark organic fascia texture (REF-04 mood,
// derived from the existing asset, nothing generated/purchased) and 'grey' —
// the soft neumorphic ground (REF-05). 'custom' = a photo from the user's
// device, stored as a Blob in the existing IndexedDB media store. 'auto'
// (default) resolves by theme: dark → nature, light → grey.
//
// Storage: NEW localStorage key `ppw.background` (additive — no existing key
// shapes change): { kind: 'auto'|'nature'|'grey'|'custom', mediaId?: string }.

import { useState, useEffect, useCallback } from 'react';
import { putMedia, deleteMedia, getMediaUrl } from './mediaStore.js';

export const BG_KEY = 'ppw.background';
export const CUSTOM_BG_MEDIA_ID = 'ppw-custom-bg';

export const BG_OPTIONS = [
  { kind: 'auto',   label: 'Auto',   hint: 'Follows the theme — nature in dark, soft grey in light' },
  { kind: 'nature', label: 'Nature', hint: 'Dark organic texture (PPW fascia)' },
  { kind: 'grey',   label: 'Grey',   hint: 'Soft neumorphic ground' },
  { kind: 'custom', label: 'Custom', hint: 'A photo from your device' },
];

export function getBackgroundChoice() {
  try {
    const raw = localStorage.getItem(BG_KEY);
    if (!raw) return { kind: 'auto' };
    const v = JSON.parse(raw);
    if (v && ['auto', 'nature', 'grey', 'custom'].includes(v.kind)) return v;
  } catch (_) { /* fall through */ }
  return { kind: 'auto' };
}

export function setBackgroundChoice(choice) {
  try { localStorage.setItem(BG_KEY, JSON.stringify(choice)); } catch (_) { /* ignore */ }
  emitChange();
}

/** 'auto' resolves by the RESOLVED theme; explicit kinds pass through. */
export function resolveBackgroundKind(choice, resolvedTheme) {
  if (!choice || choice.kind === 'auto') return resolvedTheme === 'light' ? 'grey' : 'nature';
  return choice.kind;
}

/* Tiny same-tab change bus so AppBackground re-renders when Settings saves
   (the `storage` event only fires across tabs). */
const listeners = new Set();
function emitChange() { listeners.forEach((fn) => { try { fn(); } catch (_) {} }); }

/** Store a user-picked background photo (replaces any previous custom bg). */
export async function saveCustomBackground(file) {
  await putMedia(CUSTOM_BG_MEDIA_ID, file);
  setBackgroundChoice({ kind: 'custom', mediaId: CUSTOM_BG_MEDIA_ID });
}

export async function clearCustomBackground() {
  try { await deleteMedia(CUSTOM_BG_MEDIA_ID); } catch (_) { /* best-effort */ }
}

/**
 * React hook — { choice, kind, customUrl, setChoice, pickCustom }.
 * `kind` is the resolved render kind for the given resolved theme.
 */
export function useBackground(resolvedTheme) {
  const [choice, setChoiceState] = useState(() => getBackgroundChoice());
  const [customUrl, setCustomUrl] = useState(null);

  useEffect(() => {
    const onChange = () => setChoiceState(getBackgroundChoice());
    listeners.add(onChange);
    return () => { listeners.delete(onChange); };
  }, []);

  const kind = resolveBackgroundKind(choice, resolvedTheme);

  useEffect(() => {
    let revoked = false;
    let url = null;
    if (kind === 'custom') {
      getMediaUrl(choice.mediaId || CUSTOM_BG_MEDIA_ID).then((u) => {
        if (revoked) { if (u) URL.revokeObjectURL(u); return; }
        url = u;
        setCustomUrl(u);
      }).catch(() => setCustomUrl(null));
    } else {
      setCustomUrl(null);
    }
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [kind, choice.mediaId]);

  const setChoice = useCallback((next) => {
    setBackgroundChoice(next);
    setChoiceState(next);
  }, []);

  const pickCustom = useCallback(async (file) => {
    if (!file) return;
    await saveCustomBackground(file);
    setChoiceState(getBackgroundChoice());
  }, []);

  return { choice, kind, customUrl, setChoice, pickCustom };
}
