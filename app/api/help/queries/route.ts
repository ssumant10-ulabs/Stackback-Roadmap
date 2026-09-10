import { NextResponse } from "next/server";
import { writeClient } from "@/lib/sanity/client";

/** Where a merchant's question becomes a row somebody has to answer.
 *
 *  The write token lives only here. A browser-side write would mean shipping a token that
 *  can rewrite the dataset, so the form posts to this route instead and the route decides
 *  what a submission is allowed to contain.
 *
 *  Everything arrives as `status: "new"`, which is invisible on the merchant-facing tab.
 *  Nothing a merchant types is public until somebody at ULABS reads it, answers it, and
 *  flips the status in the Studio. That is the whole safety model: no auto-publish. */

export const runtime = "nodejs";

const MAX_QUESTION = 1200;
const MAX_NAME = 120;

/** One submission per window per address. Not a security boundary, a politeness one: it
 *  stops a stuck form or a bored visitor from filling the queue. A real abuse problem
 *  needs the platform's rate limiting, not a Map. */
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(key) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(key, hits);
  if (RECENT.size > 500) for (const [k, v] of RECENT) if (!v.some((t) => now - t < WINDOW_MS)) RECENT.delete(k);
  return hits.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const sanity = writeClient();
  if (!sanity) {
    return NextResponse.json(
      { error: "The query log is not connected yet. Use Send to the team in the chat and it will reach us." },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(ip)) {
    return NextResponse.json({ error: "That is a few in quick succession. Give it a minute." }, { status: 429 });
  }

  let body: { question?: unknown; topic?: unknown; askedBy?: unknown; trap?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Could not read that." }, { status: 400 }); }

  // A field no person sees and no person fills. Bots fill everything.
  if (typeof body.trap === "string" && body.trap.length > 0) {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question.length < 8) {
    return NextResponse.json({ error: "Tell us a little more than that and we can actually answer it." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION) {
    return NextResponse.json({ error: `Keep it under ${MAX_QUESTION} characters. The detail can come in the reply.` }, { status: 400 });
  }

  const topic = typeof body.topic === "string" && body.topic ? body.topic.slice(0, 40) : undefined;
  const askedBy = typeof body.askedBy === "string" && body.askedBy.trim()
    ? body.askedBy.trim().slice(0, MAX_NAME) : undefined;

  try {
    await sanity.create({
      _type: "merchantQuery",
      question,
      topic,
      askedBy,
      status: "new",
      source: "merchant",
      raisedCount: 1,
      raisedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch {
    // The merchant does not need our stack trace, and the token error must not leak out.
    return NextResponse.json({ error: "We could not log that just now. Try again, or use Send to the team." }, { status: 502 });
  }
}
