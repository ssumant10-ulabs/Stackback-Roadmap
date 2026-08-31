/** Screenshots live as downscaled data URLs inside the shared state, because there is no
 *  file storage until Firebase Storage is on. That makes size the whole problem: localStorage gives
 *  roughly 5 MB per origin for everything, and the rest of the app already needs some of it.
 *
 *  So: hard-downscale on the way in, cap the count per request, and refuse a write that
 *  would push the total past budget. A refused upload with a clear message beats a silent
 *  quota failure, which is how you lose a whole board. */

/** With Firebase Storage on, images leave the state document entirely and only their URL is
 *  kept, so the byte budget below stops applying. Downscaling still happens: a 3 MB phone
 *  screenshot helps nobody, and smaller images make the table quick to open. */
export const SHOT_MAX_EDGE = 1100;
export const SHOT_QUALITY = 0.62;
export const SHOT_MAX_PER_REQUEST = 4;
/** Total bytes of image data allowed across every request. Deliberately well under the
 *  5 MB origin quota so normal roadmap edits always have room. */
export const SHOT_TOTAL_BUDGET = 2_600_000;

export const fmtBytes = (n: number) =>
  n >= 1_000_000 ? (n / 1_048_576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB";

/** Draw the image onto a canvas at a capped edge length and re-encode as JPEG. A 3 MB PNG
 *  screenshot lands around 120 KB, which is the difference between four uploads and none. */
export function downscale(file: File): Promise<{ src: string; bytes: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Only image files can be attached.")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, SHOT_MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("Could not read that image.")); return; }
      // JPEG has no alpha, so flatten onto white rather than letting it go black.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const src = c.toDataURL("image/jpeg", SHOT_QUALITY);
      resolve({ src, bytes: Math.round((src.length - "data:image/jpeg;base64,".length) * 0.75) });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be opened as an image.")); };
    img.src = url;
  });
}


/** Firebase Storage needs the Blaze plan, so a Spark project has Firestore and auth but no
 *  file storage. That combination is the dangerous one: falling back to a data URL would
 *  embed a 200 KB image in a Firestore document that is capped at 1 MB, so a few uploads
 *  would break the document rather than merely being unavailable. Uploads are therefore
 *  refused when the shared backend is on without Storage, and the link route covers it. */
export async function uploadShot(file: File, featureId: string): Promise<{ src: string; bytes: number; stored: "remote" | "local" }> {
  const { fbStorage, firebaseEnabled, storageConfigured } = await import("./firebase");
  const storage = firebaseEnabled && storageConfigured() ? fbStorage() : null;

  if (firebaseEnabled && !storageConfigured()) {
    throw new Error(
      "Uploading from this machine needs Firebase Storage, which requires the Blaze plan. " +
      "Use the link button instead and paste a hosted image URL.",
    );
  }

  const { src, bytes } = await downscale(file);
  if (!storage) return { src, bytes, stored: "local" };   // no Firebase at all: local budget

  const { ref, uploadString, getDownloadURL } = await import("firebase/storage");
  const id = `${featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const r = ref(storage, `shots/${id}.jpg`);
  await uploadString(r, src, "data_url");
  return { src: await getDownloadURL(r), bytes: 0, stored: "remote" };
}
