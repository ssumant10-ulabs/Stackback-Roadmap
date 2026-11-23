/** The uploaded product page, held in this browser for the Widget lab's preview frame.
 *
 *  IndexedDB, not sessionStorage: a self-contained saved page (SingleFile) inlines its images
 *  and runs past sessionStorage's ~5 MB per site, which is the "file too large" a merchant
 *  page hits. The preview frame is the same site, so it reads the same record. Mirrored by the
 *  plain-JS reader in public/widget-lab/pdp.js: same database, store and key. */

const DB = "sbw-lab", STORE = "kv", KEY = "upload";

export interface Upload {
  html: string;
  /** Shopify's product record (`/products/<handle>.js`), pasted when the page lacks prices. */
  product?: unknown;
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveUpload(u: Upload): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(u, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function readUpload(): Promise<Upload | null> {
  const db = await open();
  const out = await new Promise<Upload | null>((res, rej) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
    r.onsuccess = () => res((r.result as Upload) || null);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return out;
}
