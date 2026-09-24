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

  let css = inlineCss(html);

  // Dawn keeps its colour schemes inline, so this is usually enough. A theme that ships them
  // in a stylesheet needs one more hop, and only that: four files, best effort, never fatal.
  if (!/--color-button|\.color-scheme-/.test(css)) {
    const sheets = stylesheetHrefs(html, u.toString());
    const fetched = await Promise.allSettled(sheets.map((s) => getText(s, 1_200_000)));
    css += "\n" + fetched.map((r) => (r.status === "fulfilled" ? r.value : "")).join("\n");
  }

  if (!css.trim()) {
    return NextResponse.json({ ok: false, error: "That page carried no readable styles." }, { status: 422 });
  }

  const result = mapTokens(css, u.toString());
  return NextResponse.json(result, {
    headers: { "cache-control": "public, max-age=900, stale-while-revalidate=3600" },
  });
}
