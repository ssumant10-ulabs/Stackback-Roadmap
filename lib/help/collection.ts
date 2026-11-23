/** Shopify's public product records (`/collections/<handle>/products.json`, `/products.json`)
 *  mapped to what the Landing Page Lab's picker shows. Shared by the browser read and the
 *  server fallback (app/api/lp-lab/collection), so both pick the same price and variants. */

export type LabProduct = {
  name: string; handle?: string; price: number; mrp?: number; image?: string; cat?: string;
  option?: string; variants?: string[]; available?: boolean;
};
type ShopifyVariant = { title?: string; price?: string; compare_at_price?: string | null; available?: boolean };
export type ShopifyProduct = {
  title?: string; handle?: string; product_type?: string; images?: { src?: string }[];
  options?: { name?: string }[]; variants?: ShopifyVariant[];
};

const abs = (s: unknown) => { const v = String(s || ""); return v.startsWith("//") ? "https:" + v : v; };

export function mapShopifyProducts(list: ShopifyProduct[]): LabProduct[] {
  return list.slice(0, 120).map((p) => {
    const vs = p.variants || [];
    const prices = vs.map((v) => Number(v.price)).filter((n) => n > 0);
    const price = prices.length ? Math.min(...prices) : 0;
    const cheapest = vs.find((v) => Number(v.price) === price);
    const mrp = Number(cheapest?.compare_at_price) || 0;
    const names = vs.map((v) => String(v.title || "")).filter((t) => t && t !== "Default Title");
    return {
      name: String(p.title || ""), handle: String(p.handle || ""), price, mrp: mrp > price ? mrp : undefined,
      image: abs(p.images?.[0]?.src) || undefined, cat: String(p.product_type || "") || undefined,
      option: names.length > 1 ? String(p.options?.[0]?.name || "Option") : undefined,
      variants: names.length > 1 ? names.slice(0, 6) : undefined,
      available: vs.some((v) => v.available !== false),
    };
  }).filter((p) => p.name && p.price > 0);
}

/** The store origin and collection handle out of a pasted link, or null. */
export function parseCollection(input: string): { origin: string; handle: string } | null {
  try {
    const u = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : "https://" + input.trim());
    const m = /\/collections\/([^/?#.]+)/.exec(u.pathname);
    if (!m || !/^https?:$/.test(u.protocol)) return null;
    return { origin: u.origin, handle: m[1] };
  } catch { return null; }
}
