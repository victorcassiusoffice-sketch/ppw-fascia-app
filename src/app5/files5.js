// files5 — on-device document storage for Document stacks (IndexedDB).
// Files stay on this device and reopen after a restart (matching the
// prototype's promise). A shared routine .md carries the document's NAME
// only — the file itself never leaves the device.

const DB = 'ppw5-files';

function openDb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveFile(file) {
  const id = 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const d = await openDb();
  await new Promise((res, rej) => {
    const tx = d.transaction('files', 'readwrite');
    tx.objectStore('files').put({ id, name: file.name, type: file.type, blob: file });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  return id;
}

const urlCache = {};
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
