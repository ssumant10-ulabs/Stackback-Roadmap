import { NextResponse } from "next/server";
import { writeClient } from "@/lib/sanity/client";
import { STEP_BY_ID } from "@/lib/help/checklist";
import { revalidateTag } from "next/cache";

/** Ticking a step on the internal tab.
 *
 *  This is a privileged write: it changes what the team believes about a store. The client
 *  is not trusted to say who it is, so the caller sends a Firebase ID token and this route
 *  verifies it against Google's public keys before writing, and checks the email domain the
 *  Firestore rules already enforce elsewhere. A client-side auth check alone would mean
 *  anybody who can reach the URL can rewrite any store's progress. */

export const runtime = "nodejs";

const ALLOWED = (process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS || "")
  .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

interface TokenInfo { email?: string; email_verified?: boolean; aud?: string; exp?: string }

/** Verified by Google, not by us reading the payload. tokeninfo is the simple route and
 *  costs one request; the alternative is carrying a JWKS cache in a route that is hit a
 *  few times a day. */
async function verify(idToken: string): Promise<string | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const info = (await res.json()) as TokenInfo;
    if (info.aud !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) return null;
    if (info.email_verified !== true && String(info.email_verified) !== "true") return null;
    const email = (info.email || "").toLowerCase();
    const domain = email.split("@")[1];
    if (ALLOWED.length && (!domain || !ALLOWED.includes(domain))) return null;
    return email || null;
  } catch { return null; }
}

export async function POST(req: Request) {
  const sanity = writeClient();
  if (!sanity) return NextResponse.json({ error: "Not connected to the CMS." }, { status: 503 });

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const email = await verify(token);
  if (!email) return NextResponse.json({ error: "That account cannot change a store's progress." }, { status: 403 });

  let body: { storeId?: unknown; step?: unknown; done?: unknown; note?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Could not read that." }, { status: 400 }); }

  const storeId = typeof body.storeId === "string" ? body.storeId : "";
  const step = typeof body.step === "string" ? body.step : "";
  const done = Boolean(body.done);
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : undefined;

  // Only steps the spine actually defines. Without this the array becomes a junk drawer
  // and the progress count stops meaning anything.
  if (!storeId || !STEP_BY_ID.has(step)) {
    return NextResponse.json({ error: "Unknown store or step." }, { status: 400 });
  }

  const entry = { _key: step, step, done, at: new Date().toISOString(), by: email, note };

  try {
    // Replace the row for this step if it exists, append if it does not. Done as one
    // patch so two people ticking different steps cannot drop each other's write.
    await sanity
      .patch(storeId)
      .setIfMissing({ progress: [] })
      .unset([`progress[step=="${step}"]`])
      .append("progress", [entry])
      .commit({ autoGenerateArrayKeys: true });
    // Next 16 takes a cache profile alongside the tag. "seconds" is right here: a tick
    // should show on the other person's screen before they ask whether it saved.
    revalidateTag("help", "seconds");
    return NextResponse.json({ ok: true, at: entry.at, by: email });
  } catch {
    return NextResponse.json({ error: "Could not save that." }, { status: 502 });
  }
}
