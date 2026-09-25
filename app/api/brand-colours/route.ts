import { NextResponse } from "next/server";
import { inlineCss, looksPasswordProtected, mapTokens, stylesheetHrefs } from "@/lib/brand/extract";

/** Read a storefront's theme settings and return StackBack's six brand tokens.
 *
 *  Server-side because a browser cannot fetch another origin, and because the useful data is
 *  in the page's own inline <style>, not in anything a proxy would have to render. One route
 *  serves both callers: the merchant admin's Branding screen and the pilot tracking screen.
 *
 *  GET /api/brand-colours?url=thebasicswoman.com
 *
 *  Only http(s) and only a public host: a URL is user input, and this runs on our server, so
 *  a private address would turn it into an internal port scanner. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 3_000_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

const RECENT = new Map<string, number[]>();

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(key) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(key, hits);
  if (RECENT.size > 400) {
    for (const [k, v] of RECENT) if (!v.some((t) => now - t < WINDOW_MS)) RECENT.delete(k);
  }
  return hits.length > MAX_PER_WINDOW;
}

/** Reject anything that is not a public web host. Blocks the obvious SSRF shapes. */
function safeUrl(raw: string): URL | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h) && (
      h.startsWith("10.") || h.startsWith("127.") || h.startsWith("0.") ||
      h.startsWith("169.254.") || h.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    ) ||
    h.includes(":")
  ) return null;
  return u;
}

async function getText(url: string, cap: number): Promise<string> {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      redirect: "follow",
      headers: {
        // Identify honestly. A storefront that blocks us should be able to see who we are.
        "user-agent": "StackBackBrandReader/1.0 (+https://stackback.ai)",
        accept: "text/html,text/css,*/*",
      },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const buf = await r.arrayBuffer();
    return new TextDecoder("utf-8").decode(buf.slice(0, cap));
  } finally {
    clearTimeout(timer);
  }
}

/** One real product off the storefront: its name, its price and its picture.
 *
 *  Shopify serves `/products.json` on every store that has not switched it off, so the widget
 *  preview can say "Daily Greens, Rs 750" instead of "Dummy product, Rs 750". A merchant
 *  looking at their own product in their own colours is looking at their store; the same
 *  screen with our placeholder in it is looking at ours.
 *
 *  Also returns the handle, because the product page is where the Add to cart button lives
 *  and the homepage usually has no button to read. Best effort throughout: a store with this
 *  endpoint closed still gets its colours. */
async function readProduct(origin: string): Promise<{
  title: string; handle: string; priceMinor: number | null; compareAtMinor: number | null;
  image: string | null; vendor: string | null; currency: string | null;
} | null> {
  try {
    const raw = await getText(origin + "/products.json?limit=6", 400_000);
    const list = JSON.parse(raw)?.products;
    if (!Array.isArray(list) || !list.length) return null;
    /* The first product with a price and a picture. A store's first row is often a gift card
       or a sample, and neither reads as "your product" on a preview. */
    const pick = list.find((p: Record<string, unknown>) => {
      const v = (p.variants as { price?: string }[] | undefined)?.[0];
      const imgs = p.images as unknown[] | undefined;
      return v?.price && Number(v.price) > 0 && imgs?.length
        && !/gift[- ]?card|sample|tester/i.test(String(p.title || ""));
    }) || list[0];
    const v = pick.variants?.[0] || {};
    const money = (x: unknown) => (x == null || x === "" ? null : Math.round(Number(x) * 100));
    return {
      title: String(pick.title || "").trim().slice(0, 80),
      handle: String(pick.handle || ""),
      priceMinor: money(v.price),
      compareAtMinor: money(v.compare_at_price),
      image: pick.images?.[0]?.src ? String(pick.images[0].src) : null,
      vendor: pick.vendor ? String(pick.vendor) : null,
      currency: null,
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") || "";
  const u = safeUrl(raw);
  if (!u) {
    return NextResponse.json({ ok: false, error: "Enter a public website address, for example yourstore.com" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) {
    return NextResponse.json({ ok: false, error: "Too many looks in a minute. Try again shortly." }, { status: 429 });
  }

  let html: string;
  try {
    html = await getText(u.toString(), MAX_BYTES);
  } catch (e) {
    const msg = String(e).includes("abort")
      ? "That site took too long to answer."
      : "We could not reach that site. Check the address, or set the colours by hand.";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }

  if (looksPasswordProtected(html)) {
    return NextResponse.json({
      ok: false,
      code: "password_protected",
      error: "That store is still password protected, so we can only see Shopify's lock screen. Remove the password, or set your colours by hand for now.",
    }, { status: 422 });
  }

  /* The product page, not the homepage, is where the Add to cart button is, and the button is
     what the brand colour is read off. Both fetches are best effort and neither is fatal. */
  const product = await readProduct(u.origin);
  let pdp = "";
  if (product?.handle) {
    try { pdp = await getText(`${u.origin}/products/${encodeURIComponent(product.handle)}`, MAX_BYTES); } catch { /* homepage it is */ }
  }
  const forElements = pdp || html;

  let css = inlineCss(html) + (pdp ? "\n" + inlineCss(pdp) : "");

  // Dawn keeps its colour schemes inline, so this is usually enough. A theme that ships them
  // in a stylesheet needs one more hop, and only that: four files, best effort, never fatal.
  if (!/--color-button|\.color-scheme-/.test(css)) {
    const sheets = stylesheetHrefs(forElements, u.toString());
    const fetched = await Promise.allSettled(sheets.map((s) => getText(s, 1_200_000)));
    css += "\n" + fetched.map((r) => (r.status === "fulfilled" ? r.value : "")).join("\n");
  }

  if (!css.trim()) {
    return NextResponse.json({ ok: false, error: "That page carried no readable styles." }, { status: 422 });
  }

  const result = mapTokens(css, u.toString(), forElements);
  return NextResponse.json({ ...result, product, readFrom: pdp ? "product" : "home" }, {
    headers: { "cache-control": "public, max-age=900, stale-while-revalidate=3600" },
  });
}
