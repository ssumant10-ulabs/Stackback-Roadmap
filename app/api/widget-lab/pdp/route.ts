import { NextResponse } from "next/server";
import { looksPasswordProtected } from "@/lib/brand/extract";
import { getText, safeUrl } from "@/lib/net/storefront";

/** A merchant's product page, for the Widget lab.
 *
 *  GET /api/widget-lab/pdp?url=https://store.com/products/handle
 *
 *  Returns the page's HTML and Shopify's own product record (`/products/<handle>.js`), which
 *  has the real variants and prices. The page is returned as text and never rendered here:
 *  the preview page keeps only the product section and strips every script before showing it.
 *
 *  Only Shopify product links: the `.js` record has to answer, which keeps this from being a
 *  general purpose proxy. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 3_000_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const RECENT = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(key) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(key, hits);
  if (RECENT.size > 400) for (const [k, v] of RECENT) if (!v.some((t) => now - t < WINDOW_MS)) RECENT.delete(k);
  return hits.length > MAX_PER_WINDOW;
}

const fail = (error: string, status: number) =>
  NextResponse.json({ ok: false, error }, { status, headers: { "access-control-allow-origin": "*" } });

const abs = (src: unknown) => {
  const s = String(src || "");
  return s.startsWith("//") ? "https:" + s : s;
};

export async function GET(req: Request) {
  const u = safeUrl(new URL(req.url).searchParams.get("url") || "");
  if (!u || !/\/products\/[^/]+/.test(u.pathname)) {
    return fail("Paste a product page link, for example yourstore.com/products/your-product", 400);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) return fail("Too many pages in a minute. Try again shortly.", 429);

  /* The product path without collection prefixes, query or trailing slash: Shopify serves the
     record at /products/<handle>.js whatever path the shopper came in on. */
  const handle = u.pathname.match(/\/products\/([^/?#.]+)/)![1];
  const page = new URL(u.toString());
  page.hash = "";

  /* `only=product`: the record alone, for a page the merchant uploaded. Shopify often refuses
     a server the page itself but still answers the product record, which has every variant. */
  const onlyProduct = new URL(req.url).searchParams.get("only") === "product";
  const [htmlR, jsonR] = await Promise.allSettled([
    onlyProduct ? Promise.resolve("") : getText(page.toString(), MAX_BYTES, 10_000),
    getText(`${u.origin}/products/${handle}.js`, 1_500_000, 10_000),
  ]);
  if (htmlR.status === "rejected") {
    const why = String(htmlR.reason);
    return fail(why.includes("abort") ? "That store took too long to answer. Upload the saved page instead."
      : /HTTP (403|429|430)/.test(why) ? "That store blocks automated page reads. Save the product page in your browser and upload it instead."
      : "We could not open that page. Check the link, or upload the saved page instead.", 502);
  }
  const html = htmlR.value;
  if (!onlyProduct && looksPasswordProtected(html)) {
    return fail("That store is password protected, so only Shopify's lock screen is visible. Save the product page as HTML and upload it instead.", 422);
  }

  let product = null;
  if (jsonR.status === "fulfilled") {
    try {
      const p = JSON.parse(jsonR.value);
      if (Array.isArray(p?.variants)) {
        product = {
          title: String(p.title || ""),
          image: abs(p.featured_image),
          variants: p.variants.map((v: Record<string, unknown>) => ({
            name: String(v.title || ""),
            price: Number(v.price) / 100,
            compareAt: v.compare_at_price ? Number(v.compare_at_price) / 100 : undefined,
            image: abs((v.featured_image as { src?: string } | null)?.src || ""),
          })),
        };
      }
    } catch { /* not a Shopify product record */ }
  }
  if (!product) return fail("That link did not answer as a Shopify product. Upload the saved page instead.", 422);

  const currency = html.match(/Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/)?.[1] || null;

  return NextResponse.json({ ok: true, url: page.toString(), html, product, currency }, {
    headers: {
      "cache-control": "public, max-age=600, stale-while-revalidate=3600",
      "access-control-allow-origin": "*",
    },
  });
}
