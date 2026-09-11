"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_ANSWERS, QUESTIONS, asLines, complete, parseBands, parseList, visible, writeBands,
  type Answers, type Field,
} from "@/lib/help/questions";
import { CATEGORY_BY_ID, freqWord } from "@/lib/help/categories";

const DRAFT = "sb-help-planform";

/** Step one. The decisions, as fields, with what similar stores run beside them.
 *
 *  The suggester is not decoration: the first question a client asks after "what discount"
 *  is "what does everyone else do", and having an answer on the page turns a two-day email
 *  round trip into a click. It proposes, it never fills, because a store's own repeat gap
 *  beats a category average every time and quietly overwriting their number would hide that. */
export default function PlanForm({ answers, onAnswers, storeId, storeName, connected, onDone }: {
  answers: Answers; onAnswers: (a: Answers) => void;
  storeId: string | null; storeName: string | null;
  connected: boolean; onDone: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT);
      if (raw) {
        const d = JSON.parse(raw) as { answers?: Answers };
        if (d.answers) onAnswers({ ...DEFAULT_ANSWERS, ...d.answers });
      } else if (storeName) {
        onAnswers({ ...DEFAULT_ANSWERS, brand_name: storeName });
      }
    } catch { /* private window: the form works, it just will not remember */ }
    // Once, on mount: this restores a draft, it does not track later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (a: Answers) => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ answers: a })); }
    catch { /* the answer is still in the box */ }
  };
  const set = (id: string, v: string | string[]) => { const next = { ...answers, [id]: v }; onAnswers(next); save(next); };

  const cat = CATEGORY_BY_ID.get(String(answers.category || ""));
  const done = complete(answers);

  const applySuggestion = () => {
    if (!cat) return;
    const bands: Record<number, number> = {};
    cat.deliveries.forEach((d, i) => { bands[d] = cat.discounts[i] ?? cat.discounts[cat.discounts.length - 1]; });
    const next: Answers = {
      ...answers,
      every_days: cat.everyDays.map(String),
      deliveries: cat.deliveries.join(", "),
      tiered: cat.discounts.length > 1 ? "yes" : "no",
      bands: writeBands(bands),
      discount_pct: String(cat.discounts[0]),
    };
    onAnswers(next); save(next);
  };

  async function send() {
    if (!done || sending) return;
    setSending(true); setResult(null);
    const brand = String(answers.brand_name || storeName || "").trim();
    try {
      const res = await fetch("/api/help/answers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand, storeId, trap: "",
          answers: asLines(answers).map((l, i) => ({ id: storeId ? `${storeId}-q${i}` : `q${i}`, question: l.question, answer: l.answer })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, msg: json.error || "That did not go through." }); return; }
      setSent(true);
      setResult({ ok: true, msg: `Sent, filed against ${brand}. We will build against these.` });
    } catch {
      setResult({ ok: false, msg: "No connection. Your answers are saved on this device, so try again when you are back." });
    } finally { setSending(false); }
  }

  return (
    <div className="hc-formgrid">
      <div className="hc-form">
        {QUESTIONS.map((q, i) => (
          <fieldset key={q.id} className="hc-qblock">
            <legend><i>{i + 1}</i>{q.title}</legend>
            <p className="hc-qblurb">{q.blurb}</p>
            {q.fields.filter((f) => visible(f, answers)).map((f) => (
              <FieldRow key={f.id} f={f} answers={answers} value={answers[f.id]}
                onChange={(v) => set(f.id, v)}
                readOnly={f.id === "brand_name" && Boolean(storeName)} />
            ))}
          </fieldset>
        ))}

        <div className="hc-formactions">
          <button className="hc-btn primary" onClick={send} disabled={!done || sending}>
            {sending ? "Sending" : sent ? "Send again" : "Send these answers"}
          </button>
          <button className="hc-btn" onClick={onDone}>
            {sent ? "Next: what your customers see" : "Skip ahead and look first"}
          </button>
          <span className="hc-savedat">Saved on this device as you type.</span>
        </div>

        {!done && <p className="hc-note hc-incomplete">Every field above needs an answer before these can be sent.</p>}
        {result && <p className={"hc-result " + (result.ok ? "ok" : "bad")} role="status">{result.msg}</p>}
        {!connected && (
          <p className="hc-result bad" role="status">
            Not connected to the CMS yet, so sending will not reach anybody. Your answers are still saved here.
          </p>
        )}
      </div>

      <aside className="hc-suggest">
        <p className="hc-suggesth">What similar stores run</p>
        {!cat ? (
          <p className="hc-note">Pick a category above and this fills in with what works for it.</p>
        ) : (
          <>
            <p className="hc-suggestcat">{cat.label}</p>
            <dl className="hc-suggestrows">
              <div><dt>Frequency</dt><dd>{cat.everyDays.map(freqWord).join(", ").toLowerCase()}</dd></div>
              <div><dt>Run lengths</dt><dd>{cat.deliveries.join(", ")} deliveries</dd></div>
              <div><dt>Discount</dt><dd>{cat.deliveries.map((d, i) => `${cat.discounts[i]}% at ${d}`).join(", ")}</dd></div>
            </dl>
            <p className="hc-suggestwhy">{cat.why}</p>
            <button className="hc-btn" onClick={applySuggestion}>Use these as a starting point</button>
            <p className="hc-note hc-suggestnote">
              A starting point, not an answer. Once we have read your order history we will propose
              numbers from your own repeat gap, and those beat a category average every time.
            </p>
          </>
        )}
      </aside>
    </div>
  );
}

function FieldRow({ f, value, answers, onChange, readOnly }: {
  f: Field; value: string | string[] | undefined; answers: Answers;
  onChange: (v: string | string[]) => void; readOnly?: boolean;
}) {
  if (f.kind === "choice" || f.kind === "multi") {
    const multi = f.kind === "multi";
    const list = Array.isArray(value) ? value : [];
    return (
      <div className="hc-frow">
        <span className="hc-flabel">{f.label}</span>
        <div className="hc-fchoices">
          {f.options?.map((o) => {
            const on = multi ? list.includes(o.value) : value === o.value;
            return (
              <label key={o.value} className={"hc-fchoice" + (on ? " on" : "")}>
                <input type={multi ? "checkbox" : "radio"} name={f.id} checked={on}
                  onChange={() => onChange(multi
                    ? (on ? list.filter((x) => x !== o.value) : [...list, o.value])
                    : o.value)} />
                <span>{o.label}{o.hint && <em>{o.hint}</em>}</span>
              </label>
            );
          })}
        </div>
        {f.help && <p className="hc-fhelp">{f.help}</p>}
      </div>
    );
  }

  if (f.kind === "bands") {
    // One rate per run length the client actually offered, so the bands cannot describe a
    // plan that does not exist, which is how a discount ends up promised and unbuildable.
    const runs = parseList(answers.deliveries);
    const bands = parseBands(value);
    if (!runs.length) {
      return <div className="hc-frow"><span className="hc-flabel">{f.label}</span>
        <p className="hc-fhelp">Add the run lengths above first, and a rate appears for each.</p></div>;
    }
    return (
      <div className="hc-frow">
        <span className="hc-flabel">{f.label}</span>
        <div className="hc-bands">
          {runs.map((r) => (
            <label key={r} className="hc-band">
              <span>{r} deliveries</span>
              <input type="number" min={0} max={90} value={Number.isFinite(bands[r]) ? String(bands[r]) : ""}
                placeholder="0"
                onChange={(e) => {
                  const next = { ...bands };
                  const n = parseInt(e.target.value, 10);
                  if (Number.isFinite(n)) next[r] = n; else delete next[r];
                  onChange(writeBands(next));
                }} />
              <i>%</i>
            </label>
          ))}
        </div>
        {f.help && <p className="hc-fhelp">{f.help}</p>}
      </div>
    );
  }

  return (
    <div className="hc-frow">
      <label className="hc-flabel" htmlFor={`f-${f.id}`}>{f.label}</label>
      <span className="hc-finput">
        <input id={`f-${f.id}`} type={f.kind === "number" ? "number" : "text"}
          value={typeof value === "string" ? value : ""} placeholder={f.placeholder}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)} maxLength={300} />
        {f.suffix && <i>{f.suffix}</i>}
      </span>
      {f.help && <p className="hc-fhelp">{f.help}</p>}
    </div>
  );
}
