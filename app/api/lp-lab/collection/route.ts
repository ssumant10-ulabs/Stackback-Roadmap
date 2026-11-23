import { NextResponse } from "next/server";
import { getText, safeUrl } from "@/lib/net/storefront";
import { mapShopifyProducts, type ShopifyProduct } from "@/lib/help/collection";

/** A merchant's collection, for the Landing Page Lab's product picker.
 *
 *  GET /api/lp-lab/collection?url=https://store.com/collections/handle
 *
 *  Reads Shopify's own collection record (`/collections/<handle>/products.json`), which every
 *  open Shopify store answers: names, prices, compare-at, images, variants, product type.
 *  Only Shopify collection links, so this is not a general proxy. A password-protected store
 *  does not answer; the lab then takes a saved collection page instead. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function GET(req: Request) {
  const u = safeUrl(new URL(req.url).searchParams.get("url") || "");
  const m = u ? /\/collections\/([^/?#.]+)/.exec(u.pathname) : null;
  if (!u || !m) return fail("Paste a collection link, for example yourstore.com/collections/all", 400);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) return fail("Too many collections in a minute. Try again shortly.", 429);

  /* The collection's record first; for "all", the store's product list, which some stores
     answer when they rate-limit collection reads. */
  const tries = [`${u.origin}/collections/${m[1]}/products.json?limit=250`];
  if (m[1] === "all") tries.push(`${u.origin}/products.json?limit=250`);
  let body = "";
  let lastErr: unknown = null;
  for (const t of tries) {
    try { body = await getText(t, 3_000_000, 10_000); lastErr = null; break; } catch (e) { lastErr = e; }
  }
  if (lastErr) {
    const why = String(lastErr);
    if (/HTTP 429/.test(why)) return fail("That store is limiting reads right now. Try again in a minute, or upload the saved collection page.", 502);
    return fail(/HTTP (401|403|429|430)/.test(why) || /password/i.test(why)
      ? "That store did not share its collection (password protected or blocked). Save the collection page in your browser and upload it instead."
      : "We could not open that collection. Check the link, or upload the saved page instead.", 502);
  }
  let list: ShopifyProduct[] = [];
  try { list = (JSON.parse(body) as { products?: ShopifyProduct[] }).products || []; }
  catch { return fail("That link did not answer as a Shopify collection. Upload the saved page instead.", 422); }
  if (!list.length) return fail("That collection has no products.", 422);

  const products = mapShopifyProducts(list);
  return NextResponse.json({ ok: true, url: `${u.origin}/collections/${m[1]}`, products });
}
