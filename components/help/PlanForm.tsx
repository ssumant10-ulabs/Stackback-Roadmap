"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_ANSWERS, QUESTIONS, asLines, complete, visible,
  type Answers, type Field,
} from "@/lib/help/questions";

const DRAFT = "sb-help-planform";

/** Step one. The four decisions, as fields rather than prose.
 *
 *  They were a list of things to go and reply about somewhere else, which is how they ended
 *  up living in a WhatsApp thread: a discount agreed in March is three hundred messages up
 *  by June. As a form they are a thing somebody finishes, and the answers arrive attached to
 *  the brand that gave them.
 *
 *  What is typed here also drives the simulation and the widget on the next step, so the
 *  numbers a client sees are the ones they just chose. */
export default function PlanForm({ answers, onAnswers, brand, onBrand, storeId, storeName, connected, onDone }: {
  answers: Answers; onAnswers: (a: Answers) => void;
  brand: string; onBrand: (b: string) => void;
  storeId: string | null; storeName: string | null;
  connected: boolean; onDone: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT);
      if (!raw) return;
      const d = JSON.parse(raw) as { brand?: string; answers?: Answers };
      if (d.answers) onAnswers({ ...DEFAULT_ANSWERS, ...d.answers });
      if (d.brand && !storeName) onBrand(d.brand);
    } catch { /* private window: the form works, it just will not remember */ }
    // Deliberately once, on mount: this restores a draft, it does not track later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (a: Answers, b: string) => {
    try { localStorage.setItem(DRAFT, JSON.stringify({ brand: b, answers: a })); }
    catch { /* nothing to do: the answer is still in the box */ }
  };

  const set = (id: string, v: string | string[]) => {
    const next = { ...answers, [id]: v };
    onAnswers(next); save(next, brand);
  };

  const done = complete(answers);

  async function send() {
    if (!done || sending) return;
    if (!brand.trim()) { setResult({ ok: false, msg: "Tell us the brand first, so the answers get filed against it." }); return; }
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/help/answers", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          brand: brand.trim(), storeId, trap: "",
          answers: asLines(answers).map((l, i) => ({ id: storeId ? `${storeId}-q${i}` : `q${i}`, question: l.question, answer: l.answer })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setResult({ ok: false, msg: json.error || "That did not go through." }); return; }
      setSent(true);
      setResult({ ok: true, msg: `Sent, filed against ${brand.trim()}. We will build against these.` });
    } catch {
      setResult({ ok: false, msg: "No connection. Your answers are saved on this device, so try again when you are back." });
    } finally { setSending(false); }
  }

  return (
    <div>
      <p className="hc-blurb">
        Four decisions. Nothing gets built until they are made, and everything after this step is drawn
        from what you put here.
      </p>

      <div className="hc-form">
        <label className="hc-field hc-brandfield">
          <span>Your brand</span>
          <input value={brand} onChange={(e) => { onBrand(e.target.value); save(answers, e.target.value); }}
            placeholder="So the answers get filed against the right store" maxLength={120}
            readOnly={Boolean(storeName)} />
        </label>

        {QUESTIONS.map((q, i) => (
          <fieldset key={q.id} className="hc-qblock">
            <legend><i>{i + 1}</i>{q.title}</legend>
            <p className="hc-qblurb">{q.blurb}</p>
            {q.fields.filter((f) => visible(f, answers)).map((f) => (
              <FieldRow key={f.id} f={f} value={answers[f.id]} onChange={(v) => set(f.id, v)} />
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
    </div>
  );
}

function FieldRow({ f, value, onChange }: {
  f: Field; value: string | string[] | undefined; onChange: (v: string | string[]) => void;
}) {
  if (f.kind === "choice") {
    return (
      <div className="hc-frow">
        <span className="hc-flabel">{f.label}</span>
        <div className="hc-fchoices">
          {f.options?.map((o) => (
            <label key={o.value} className={"hc-fchoice" + (value === o.value ? " on" : "")}>
              <input type="radio" name={f.id} checked={value === o.value} onChange={() => onChange(o.value)} />
              <span>{o.label}{o.hint && <em>{o.hint}</em>}</span>
            </label>
          ))}
        </div>
        {f.help && <p className="hc-fhelp">{f.help}</p>}
      </div>
    );
  }

  if (f.kind === "multi") {
    const list = Array.isArray(value) ? value : [];
    return (
      <div className="hc-frow">
        <span className="hc-flabel">{f.label}</span>
        <div className="hc-fchoices">
          {f.options?.map((o) => {
            const on = list.includes(o.value);
            return (
              <label key={o.value} className={"hc-fchoice" + (on ? " on" : "")}>
                <input type="checkbox" checked={on}
                  onChange={() => onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])} />
                <span>{o.label}{o.hint && <em>{o.hint}</em>}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="hc-frow">
      <label className="hc-flabel" htmlFor={`f-${f.id}`}>{f.label}</label>
      <span className="hc-finput">
        <input id={`f-${f.id}`} type={f.kind === "number" ? "number" : "text"}
          value={typeof value === "string" ? value : ""} placeholder={f.placeholder}
          onChange={(e) => onChange(e.target.value)} maxLength={200} />
        {f.suffix && <i>{f.suffix}</i>}
      </span>
      {f.help && <p className="hc-fhelp">{f.help}</p>}
    </div>
  );
}
