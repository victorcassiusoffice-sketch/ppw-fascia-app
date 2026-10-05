// files5 — on-device document storage for Document stacks (IndexedDB).
// Files stay on this device and reopen after a restart (matching the
// prototype's promise). A shared routine .md carries the document's NAME
// only — the file itself never leaves the device.

import { isDemo } from './demo.js';

const DB = 'ppw5-files';

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

// Declared above its first reader: saveFile seeds it directly in demo mode.
const urlCache = {};

export async function saveFile(file) {
  const id = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  // THE DEMO keeps the blob in memory instead (2026-10-05). The one thing a
  // prospect can do inside the embed that would otherwise outlive their visit is
  // attach a document: the stack referencing it is never written down, so the
  // blob would be left in the visitor's IndexedDB with nothing pointing at it.
  // The object URL goes straight into the cache fileUrl() already reads first,
  // so a Document stack still opens for the rest of the page's life, and dies
  // with the tab. See demo.js.
  if (isDemo()) {
    try { urlCache[id] = URL.createObjectURL(file); } catch { /* no blob URLs — the stack renders without a preview */ }
    return id;
  }
  const d = await openDb();
  await new Promise((res, rej) => {
    const tx = d.transaction('files', 'readwrite');
    tx.objectStore('files').put({ id, name: file.name, type: file.type, blob: file });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return id;
}

// Nothing ever deleted a file. Removing a Document stack left its blob in
// IndexedDB for good: dead weight, and no way for a user to actually erase a
// document they had second thoughts about. Callers must check no OTHER stack
// still references the id — the Library can place one file on several days.
export async function deleteFile(id) {
  if (!id) return;
  if (urlCache[id]) { try { URL.revokeObjectURL(urlCache[id]); } catch { /* already revoked */ } delete urlCache[id]; }
  try {
    const d = await openDb();
    await new Promise((res, rej) => {
      const tx = d.transaction('files', 'readwrite');
      tx.objectStore('files').delete(id);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* no IndexedDB (private mode, test env) — nothing to free */ }
}
export async function fileUrl(id) {
  if (!id) return null;
  if (urlCache[id]) return urlCache[id];
  try {
    const d = await openDb();
    const rec = await new Promise((res, rej) => {
      const rq = d.transaction('files').objectStore('files').get(id);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    if (!rec) return null;
    urlCache[id] = URL.createObjectURL(rec.blob);
    return urlCache[id];
  } catch { return null; }
}
