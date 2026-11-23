import { NextResponse } from "next/server";
import { getText, safeUrl } from "@/lib/net/storefront";

/** A store's name and logo, for the Landing Page Lab's header.
 *
 *  GET /api/lp-lab/store?url=https://store.com
 *
 *  Reads the store's home page (through the same guarded fetch as the other lab routes) and
 *  returns only two strings: the logo URL (the theme's JSON-LD Organization logo, else the
 *  header logo image) and the store name (og:site_name, else the page title). Never the page. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

function absolute(src: string, origin: string): string | null {
  const s = src.replace(/&amp;/g, "&").replace(/\\\//g, "/").trim();
  try {
    const u = new URL(s.startsWith("//") ? "https:" + s : s, origin);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const u = safeUrl(new URL(req.url).searchParams.get("url") || "");
  if (!u) return fail("Paste the store link, for example yourstore.com", 400);
  let html = "";
  try { html = await getText(u.origin + "/", 1_500_000, 10_000); }
  catch { return fail("We could not open that store's home page.", 502); }

  const ldLogo = /"@type"\s*:\s*"Organization"[\s\S]{0,600}?"logo"\s*:\s*(?:\{[^}]*?"url"\s*:\s*)?"([^"]+)"/.exec(html)?.[1];
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const headerImg = imgTags.find((t) => /class="[^"]*logo[^"]*"/i.test(t)) || imgTags.find((t) => /alt="[^"]*logo[^"]*"/i.test(t));
  const headerSrc = headerImg ? (/\bsrc="([^"]+)"/i.exec(headerImg)?.[1] || /\bsrcset="([^"\s,]+)/i.exec(headerImg)?.[1]) : undefined;
  const logo = (headerSrc && absolute(headerSrc, u.origin)) || (ldLogo && absolute(ldLogo, u.origin)) || null;

  const site = /<meta[^>]+property="og:site_name"[^>]+content="([^"]+)"/i.exec(html)?.[1]
    || /<title>([^<|–-]+)/i.exec(html)?.[1];
  const name = site ? site.replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim().slice(0, 60) : null;

  return NextResponse.json({ ok: true, name, logo });
}
