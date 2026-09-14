import { NextResponse } from "next/server";
import { writeClient } from "@/lib/sanity/client";
import { revalidateTag } from "next/cache";

/** A client answering their plan queries.
 *
 *  The answer is written onto the query it answers, as a client answer awaiting our write-up,
 *  and stamped with the brand that gave it. It does NOT flip the query to answered: the
 *  public answer is ours to write, and publishing a client's own words back at every other
 *  merchant is not what they agreed to by typing in a box. */

export const runtime = "nodejs";

const MAX_ANSWER = 800;
const MAX_BRAND = 120;
const MAX_BATCH = 12;

const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 6;

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(key) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  RECENT.set(key, hits);
  if (RECENT.size > 500) for (const [k, v] of RECENT) if (!v.some((t) => now - t < WINDOW_MS)) RECENT.delete(k);
  return hits.length > MAX_PER_WINDOW;
}

interface Incoming { id: string; question: string; answer: string }

export async function POST(req: Request) {
  const sanity = writeClient();
  if (!sanity) {
    return NextResponse.json({ error: "The query log is not connected yet. Send these on WhatsApp and we will file them." }, { status: 503 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(ip)) return NextResponse.json({ error: "That is a few in quick succession. Give it a minute." }, { status: 429 });

  let body: { brand?: unknown; storeId?: unknown; answers?: unknown; trap?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Could not read that." }, { status: 400 }); }

  if (typeof body.trap === "string" && body.trap.length > 0) return NextResponse.json({ ok: true }, { status: 202 });

  const brand = typeof body.brand === "string" ? body.brand.trim().slice(0, MAX_BRAND) : "";
  if (!brand) return NextResponse.json({ error: "Tell us the brand, so the answers get filed against it." }, { status: 400 });

  const raw = Array.isArray(body.answers) ? (body.answers as unknown[]) : [];
  const answers: Incoming[] = raw.slice(0, MAX_BATCH).flatMap((a) => {
    if (!a || typeof a !== "object") return [];
    const { id, question, answer } = a as Record<string, unknown>;
    if (typeof id !== "string" || typeof answer !== "string") return [];
    const text = answer.trim().slice(0, MAX_ANSWER);
    if (text.length < 2) return [];
    return [{ id, question: typeof question === "string" ? question.slice(0, 400) : "", answer: text }];
  });
  if (!answers.length) return NextResponse.json({ error: "Nothing to send yet." }, { status: 400 });

  const at = new Date().toISOString();
  try {
    // One transaction: either the whole set of answers lands or none does, so a client is
    // never told four were sent when two were.
    let tx = sanity.transaction();
    for (const a of answers) {
      tx = tx.patch(a.id, (p) =>
        p.setIfMissing({ clientAnswers: [] })
          .append("clientAnswers", [{ _key: `${Date.now()}-${a.id.slice(-6)}`, brand, answer: a.answer, at }]),
      );
    }
    await tx.commit();
    revalidateTag("help", "seconds");
    return NextResponse.json({ ok: true, count: answers.length });
  } catch {
    return NextResponse.json({ error: "We could not log those just now. Try again, or send them on WhatsApp." }, { status: 502 });
  }
}
