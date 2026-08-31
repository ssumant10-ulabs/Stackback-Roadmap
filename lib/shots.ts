/** Screenshots live as downscaled data URLs inside the shared state, because there is no
 *  file storage until Supabase is on. That makes size the whole problem: localStorage gives
 *  roughly 5 MB per origin for everything, and the rest of the app already needs some of it.
 *
 *  So: hard-downscale on the way in, cap the count per request, and refuse a write that
 *  would push the total past budget. A refused upload with a clear message beats a silent
 *  quota failure, which is how you lose a whole board. */

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
