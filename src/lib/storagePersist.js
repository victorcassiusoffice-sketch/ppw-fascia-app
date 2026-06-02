// P1 (2026-06-02) — storage persistence hardening.
//
// iOS Safari (and other browsers under pressure) can EVICT localStorage /
// IndexedDB for sites that aren't "persistent". That silently wipes saved
// routines after the user closes the app — the most likely cause of the
// reported "add-URL works then disappears on mobile". navigator.storage.persist()
// asks the browser to exempt this origin from eviction. On an installed PWA /
// after engagement, browsers usually grant it.

export async function ensurePersistentStorage() {
  try {
    if (!navigator.storage || !navigator.storage.persist) {
      return { supported: false, persisted: false };
    }
    let persisted = false;
    if (navigator.storage.persisted) {
      persisted = await navigator.storage.persisted();
    }
    if (!persisted) {
      persisted = await navigator.storage.persist();
    }
    return { supported: true, persisted };
  } catch (_) {
    return { supported: false, persisted: false };
  }
}

export async function isStoragePersistent() {
  try {
    if (navigator.storage && navigator.storage.persisted) {
      return await navigator.storage.persisted();
    }
  } catch (_) {}
  return false;
}
