"use client";
import { useEffect, useState } from "react";
import { QUERY_TOPIC_NAME } from "@/lib/help/topics";
import type { LoggedQuery } from "@/lib/sanity/queries";

const DRAFT_KEY = "sb-help-answers";

/** The client answers here, and the answer is logged against their brand.
 *
 *  The alternative was a WhatsApp thread, which is where these answers have lived and where
 *  they get lost: a discount agreed in March is three hundred messages up by June, and the
 *  store that got opposite answers on inventory reservation eight days apart got them that
 *  way. An answer written here is attached to the query it answers and to the brand that
 *  gave it, and it is still there in June.
 *
 *  Drafts are kept on the device, because these are four decisions somebody may want to take
 *  to their co-founder before sending. */
export default function AnswerQueries({ queries, storeId, storeName, connected }: {
  queries: LoggedQuery[];
  storeId: string | null;
  storeName: string | null;
  connected: boolean;
}) {
  const [brand, setBrand] = useState(storeName || "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { brand?: string; answers?: Record<string, string> };
        if (d.answers) setAnswers(d.answers);
        if (d.brand && !storeName) setBrand(d.brand);
      }
    } catch { /* private window: the form works, it just will not remember */ }
  }, [storeName]);

  const save = (next: Record<string, string>, nextBrand = brand) => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ brand: nextBrand, answers: next })); }
    catch { /* nothing to do: the answer is still in the box */ }
  };

  const setAnswer = (id: string, text: string) => {
    const next = { ...answers, [id]: text };
    setAnswers(next); save(next);
  };

  const filled = queries.filter((q) => (answers[q._id] || "").trim().length > 1 && !sentIds.includes(q._id));

  async function send() {
    if (!filled.length || sending) return;
    if (!brand.trim()) { setResult({ ok: false, msg: "Tell us the brand first, so the answers get filed against it." }); return; }
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/help/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(),
          storeId,
          answers: filled.map((q) => ({ id: q._id, question: q.question, answer: answers[q._id].trim() })),
          trap: "",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, msg: json.error || "That did not go through." }); return; }
      setSentIds((prev) => [...prev, ...filled.map((q) => q._id)]);
      const cleared = { ...answers };
      filled.forEach((q) => { delete cleared[q._id]; });
      setAnswers(cleared); save(cleared);
      setResult({ ok: true, msg: `${filled.length} ${filled.length === 1 ? "answer" : "answers"} logged against ${brand.trim()}. We will build against these.` });
    } catch {
      setResult({ ok: false, msg: "No connection. Your answers are saved on this device, so try again when you are back." });
    } finally { setSending(false); }
  }

  if (!queries.length) return null;

  return (
    <div className="hc-answerbox">
      <label className="hc-field hc-brandfield">
        <span>Your brand</span>
        <input value={brand} onChange={(e) => { setBrand(e.target.value); save(answers, e.target.value); }}
          placeholder="So the answers get filed against the right store" maxLength={120}
          readOnly={Boolean(storeName)} />
      </label>

      <ol className="hc-answerq">
        {queries.map((q) => {
          const done = sentIds.includes(q._id);
          return (
            <li key={q._id} className={done ? "answered" : ""}>
              <b>{q.question}</b>
              {q.topic && <span className="hc-atopic">{QUERY_TOPIC_NAME.get(q.topic)}</span>}
              {done ? (
                <p className="hc-adone">Sent. It will appear under Answered once we have written it up.</p>
              ) : (
                <textarea
                  rows={2} maxLength={800} value={answers[q._id] || ""}
                  onChange={(e) => setAnswer(q._id, e.target.value)}
                  placeholder="Your answer"
                  aria-label={`Your answer to: ${q.question}`}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div className="hc-formactions">
        <button className="hc-btn primary" onClick={send} disabled={!filled.length || sending}>
          {sending ? "Sending" : filled.length ? `Send ${filled.length} ${filled.length === 1 ? "answer" : "answers"}` : "Send answers"}
        </button>
        <span className="hc-savedat">Saved on this device as you type.</span>
      </div>

      {result && <p className={"hc-result " + (result.ok ? "ok" : "bad")} role="status">{result.msg}</p>}
      {!connected && (
        <p className="hc-result bad" role="status">
          Not connected to the CMS yet, so sending will not reach anybody. Your answers are still saved here.
        </p>
      )}
    </div>
  );
}
