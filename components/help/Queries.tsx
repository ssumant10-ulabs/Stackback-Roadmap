"use client";
import { useEffect, useMemo, useState } from "react";
import { PortableText } from "@portabletext/react";
import { QUERY_TOPICS, QUERY_TOPIC_NAME } from "@/lib/help/topics";
import type { LoggedQuery } from "@/lib/sanity/queries";


const DRAFT_KEY = "sb-help-query-draft";
const SENT_KEY = "sb-help-query-sent";

interface Draft { question: string; topic: string; askedBy: string }
const EMPTY: Draft = { question: "", topic: "", askedBy: "" };

/** Part one: the query log. Questions merchants and the team raise, and the answers we
 *  write back. Separate from the FAQs because these are live: they start unanswered, and
 *  the honest thing is to show that rather than to publish only what is already tidy. */
export default function Queries({ answered, connected }: { answered: LoggedQuery[]; connected: boolean }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [saved, setSaved] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sent, setSent] = useState<{ question: string; at: number }[]>([]);
  const [filter, setFilter] = useState("");

  /* A half-written question survives a reload, a closed tab, and a phone call. Nobody
     should have to remember what they were about to ask. */
  useEffect(() => {
    try {
      const d = localStorage.getItem(DRAFT_KEY);
      if (d) { const p = JSON.parse(d) as Draft & { at?: number }; setDraft({ ...EMPTY, ...p }); if (p.at) setSaved(new Date(p.at).toLocaleString()); }
      setSent(JSON.parse(localStorage.getItem(SENT_KEY) || "[]"));
    } catch { /* private window: the form still works, it just will not remember */ }
  }, []);

  const saveDraft = () => {
    try {
      const at = Date.now();
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, at }));
      setSaved(new Date(at).toLocaleString());
      setResult({ ok: true, msg: "Saved on this device. It will be here when you come back." });
    } catch { setResult({ ok: false, msg: "This browser will not let the page save anything." }); }
  };

  const clearDraft = () => {
    setDraft(EMPTY); setSaved(null); setResult(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* nothing to clear */ }
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (draft.question.trim().length < 8 || sending) return;
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/help/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, trap: "" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, msg: json.error || "That did not go through." }); return; }
      const row = { question: draft.question.trim(), at: Date.now() };
      const next = [row, ...sent].slice(0, 20);
      setSent(next);
      try { localStorage.setItem(SENT_KEY, JSON.stringify(next)); localStorage.removeItem(DRAFT_KEY); } catch { /* the send worked, the record of it is a convenience */ }
      setDraft(EMPTY); setSaved(null);
      setResult({ ok: true, msg: "Logged. We answer here, and the answer shows up in this tab." });
    } catch {
      setResult({ ok: false, msg: "No connection. Save it and send when you are back online." });
    } finally { setSending(false); }
  }

  const shown = useMemo(() => {
    const t = filter.trim().toLowerCase();
    if (!t) return answered;
    return answered.filter((q) => q.question.toLowerCase().includes(t));
  }, [answered, filter]);

  const dirty = draft.question.trim().length > 0 || draft.askedBy.trim().length > 0;

  return (
    <section>
      <p className="hc-eyebrow">Part one</p>
      <h1 className="hc-h1">Subscription queries</h1>
      <p className="hc-blurb">
        The questions we work through with you while your plans are being set up: frequency, plan length,
        discount bands, which products carry a subscription. Raise one here and the answer is posted back
        on this page, so the decision is written down instead of living in a thread.
      </p>

      <form className="hc-form" onSubmit={submit}>
        <h2 className="hc-h2 hc-formh">Raise a query</h2>

        <label className="hc-field">
          <span>Your query</span>
          <textarea
            value={draft.question} rows={4} maxLength={1200}
            onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            placeholder="What are you trying to decide? A monthly run at 15 percent, or fortnightly at 10? Which products should carry it?"
            required minLength={8}
          />
          <em>{draft.question.length}/1200</em>
        </label>

        <div className="hc-fieldrow">
          <label className="hc-field">
            <span>What is it about <i>(optional)</i></span>
            <select value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })}>
              <option value="">Not sure</option>
              {QUERY_TOPICS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label className="hc-field">
            <span>Your store <i>(optional)</i></span>
            <input
              value={draft.askedBy} maxLength={120}
              onChange={(e) => setDraft({ ...draft, askedBy: e.target.value })}
              placeholder="So we know who to reply to"
            />
          </label>
        </div>

        <p className="hc-formnote">
          Answers here are published for every merchant to read, so leave out anything you would not
          put on a public page: no card details, no passwords, no customer phone numbers or addresses.
        </p>

        <div className="hc-formactions">
          <button className="hc-btn primary" disabled={draft.question.trim().length < 8 || sending}>
            {sending ? "Sending" : "Send it"}
          </button>
          <button type="button" className="hc-btn" onClick={saveDraft} disabled={!dirty}>Save for later</button>
          {dirty && <button type="button" className="hc-btn ghost" onClick={clearDraft}>Clear</button>}
          {saved && <span className="hc-savedat">Draft saved {saved}</span>}
        </div>

        {result && <p className={"hc-result " + (result.ok ? "ok" : "bad")} role="status">{result.msg}</p>}
        {!connected && (
          <p className="hc-result bad" role="status">
            The query log is not connected to its CMS yet, so Send it will not reach anybody. Saving for
            later still works, and Ask support in the corner can carry the question now.
          </p>
        )}
      </form>

      {sent.length > 0 && (
        <>
          <h2 className="hc-h2">What you have sent</h2>
          <ul className="hc-sent">
            {sent.map((s) => (
              <li key={s.at}>
                <b>{s.question}</b>
                <span>{new Date(s.at).toLocaleDateString()} · with us</span>
              </li>
            ))}
          </ul>
          <p className="hc-note">This list is on this device only. It is your record, not a ticket queue.</p>
        </>
      )}

      <h2 className="hc-h2">Answered</h2>
      {answered.length === 0 ? (
        <div className="hc-empty">
          <p>
            {connected
              ? "Nothing answered here yet. The Help Centre tab already covers 234 questions, and Simulate will show you what a frequency or a discount actually does before you ask."
              : "This is where answered queries appear once the CMS is connected. The 234 FAQs in the Help Centre tab work either way."}
          </p>
        </div>
      ) : (
        <>
          <input
            className="hc-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder={`Filter ${answered.length} answered ${answered.length === 1 ? "query" : "queries"}`}
            aria-label="Filter answered queries"
          />
          <div className="hc-list">
            {shown.map((q) => <Answered key={q._id} q={q} />)}
            {shown.length === 0 && <p className="hc-note hc-nofilter">Nothing matches that.</p>}
          </div>
        </>
      )}
    </section>
  );
}

function Answered({ q }: { q: LoggedQuery }) {
  const [open, setOpen] = useState(false);
  const topic = q.topic ? QUERY_TOPIC_NAME.get(q.topic) : null;
  return (
    <article className={"hc-item" + (open ? " open" : "")}>
      <button className="hc-q" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="hc-qtext">{q.question}</span>
        {q.raisedCount && q.raisedCount > 1 && <span className="hc-pill p-m">{q.raisedCount} clients</span>}
        <svg className="hc-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2 L8.5 6 L4 10" /></svg>
      </button>
      {open && (
        <div className="hc-a">
          <div className="hc-prose">
            {q.answer ? <PortableText value={q.answer as never} /> : <p>Answer pending.</p>}
          </div>
          <div className="hc-meta">
            <span>Answered {new Date(q.raisedAt).toLocaleDateString()}</span>
            {topic && <span>{topic}</span>}
            {q.source === "merchant" && <span>Raised by a merchant</span>}
          </div>
        </div>
      )}
    </article>
  );
}
