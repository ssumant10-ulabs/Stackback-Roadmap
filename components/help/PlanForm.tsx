"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_ANSWERS, QUESTIONS, asLines, complete, parseBands, parseFreebies, parseList,
  reconcileModes, visible, writeBands, writeFreebies,
  type Answers, type Field, type Freebie,
} from "@/lib/help/questions";
import { CATEGORY_BY_ID, SCALE_BY_ID, freqWord } from "@/lib/help/categories";
import { drawPlanSheet } from "@/lib/help/sheet-png";
import type { WidgetSettings } from "@/lib/help/widget";

const DRAFT = "sb-help-planform";

/** Step one. The decisions, as fields, with what similar stores run beside them.
 *
 *  The suggester is not decoration: the first question a client asks after "what discount"
 *  is "what does everyone else do", and having an answer on the page turns a two-day email
 *  round trip into a click. It proposes, it never fills, because a store's own repeat gap
 *  beats a category average every time and quietly overwriting their number would hide that. */
export default function PlanForm({ answers, onAnswers, storeName, onDone, settings }: {
  answers: Answers; onAnswers: (a: Answers) => void;
  /** Snapshotted into the export, so the picture records what was toggled as well as priced. */
  settings: WidgetSettings;
  storeId: string | null; storeName: string | null;
  connected: boolean; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

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
  const set = (id: string, v: string | string[]) => {
    // Pay as you go and pay per delivery both collect per delivery, one by asking and one
    // automatically. Offering both asks a customer to choose between those, which nobody
    // does, so ticking either unticks the other.
    const value = id === "modes" && Array.isArray(v)
      ? reconcileModes(v, Array.isArray(answers.modes) ? answers.modes : [])
      : v;
    const next = { ...answers, [id]: value };
    onAnswers(next); save(next);
  };

  const cat = CATEGORY_BY_ID.get(String(answers.category || ""));
  const done = complete(answers);

  const applySuggestion = () => {
    const sc = SCALE_BY_ID.get(String(answers.scale || ""));
    if (!cat && !sc) return;
    if (!cat) { const next = { ...answers, modes: reconcileModes(sc!.modes, []) }; onAnswers(next); save(next); return; }
    const bands: Record<number, number> = {};
    cat.deliveries.forEach((d, i) => { bands[d] = cat.discounts[i] ?? cat.discounts[cat.discounts.length - 1]; });
    const next: Answers = {
      ...answers,
      every_days: cat.everyDays.map(String),
      deliveries: cat.deliveries.join(", "),
      tiered: cat.discounts.length > 1 ? "yes" : "no",
      bands: writeBands(bands),
      discount_pct: String(cat.discounts[0]),
      ...(sc ? { modes: reconcileModes(sc.modes, []) } : {}),
    };
    onAnswers(next); save(next);
  };

  /** Export rather than send.
   *
   *  These answers get walked through on a call, forwarded to a co-founder, and pasted into
   *  a thread. A PNG survives all three; a row in our CMS survives none of them, and the
   *  client cannot see it. So the deliverable is the picture, and it carries the plans AND
   *  what similar stores run, because the second is what the forwarded copy gets argued about.
   *
   *  Rendered from the live DOM at 2x, so it is legible pasted into a deck. */
  /** Export the plans as a picture.
   *
   *  Drawn on a canvas rather than rasterised from the DOM: html-to-image goes through an
   *  SVG foreignObject loaded into an <img>, and when that image never fires onload there is
   *  no error to catch, only a button that says "making the image" forever. It did exactly
   *  that here. Canvas cannot hang, and the output is the same in every browser. */
  function download() {
    if (busy) return;
    setBusy(true); setResult(null);
    try {
      const canvas = drawPlanSheet(answers, settings);
      const brand = String(answers.brand_name || storeName || "plans").trim()
        .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plans";
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `stackback-plans-${brand}-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      setResult({ ok: true, msg: "Downloaded. Send it on, or bring it to the call." });
    } catch {
      setResult({ ok: false, msg: "The image could not be made in this browser. A screenshot of this page carries the same thing." });
    } finally { setBusy(false); }
  }

  const scale = SCALE_BY_ID.get(String(answers.scale || ""));

  return (
    <div className="hc-formgrid">
      <div className="hc-form">
        {QUESTIONS.map((q, i) => (
          <fieldset key={q.id} className="hc-qblock">
            <legend><i>{i + 1}</i>{q.title}</legend>
            <p className="hc-qblurb">{q.blurb}</p>
            <div className="hc-qfields">
            {q.fields.filter((f) => visible(f, answers)).map((f) => (
              <FieldRow key={f.id} f={f} answers={answers} value={answers[f.id]}
                onChange={(v) => set(f.id, v)}
                onFreebies={(v) => set("freebies", v)}
                readOnly={f.id === "brand_name" && Boolean(storeName)} />
            ))}
            </div>
          </fieldset>
        ))}

        <div className="hc-formactions" data-noexport="true">
          <button className="hc-btn primary" onClick={download} disabled={!done || busy}>
            {busy ? "Making the image" : "Download these plans"}
          </button>
          <button className="hc-btn" onClick={onDone}>
            {done ? "Next: what your customers see" : "Skip ahead and look first"}
          </button>
          <span className="hc-savedat">Saved on this device as you type.</span>
        </div>

        {!done && <p className="hc-note hc-incomplete" data-noexport="true">Every field above needs an answer before this can be downloaded.</p>}
        {result && <p className={"hc-result " + (result.ok ? "ok" : "bad")} role="status" data-noexport="true">{result.msg}</p>}
      </div>

      <aside className={"hc-suggest" + (!cat && !scale ? " empty" : "")}>
        <p className="hc-suggesth">What similar stores run</p>

        {!cat && !scale && (
          <p className="hc-note">Pick a category and a size, and this fills in.</p>
        )}

        {cat && (
          <section className="hc-sugblock">
            <h3>{cat.label}</h3>
            <ul className="hc-sugfacts">
              <li><span>Frequency</span><b>{cat.everyDays.map(freqWord).join(", ").toLowerCase()}</b></li>
              <li><span>Run lengths</span><b>{cat.deliveries.join(", ")} deliveries</b></li>
              <li><span>Discount</span><b>{cat.deliveries.map((d, i) => `${cat.discounts[i]}% at ${d}`).join(", ")}</b></li>
            </ul>
            <p className="hc-sugwhy">{cat.why}</p>
          </section>
        )}

        {scale && cat && (
          <section className="hc-sugblock">
            <h3>{scale.hint}</h3>
            <p className="hc-sugwhy">{scale.why}</p>
            <ul className="hc-sugoffers">
              {scale.modes.map((m) => {
                const rate = MODE_RATE[m];
                const runs = m === "auto_debit" ? null : cat.deliveries;
                return (
                  <li key={m}>
                    <b>{MODE_NAME[m]}</b>
                    <span>
                      {runs
                        ? runs.map((d, i) => `${Math.round(cat.discounts[i] * rate)}% at ${d}`).join(", ")
                        : `${Math.round(cat.discounts[0] * rate)}% off, no run length`}
                    </span>
                    <em>{m === "auto_debit"
                      ? "One plan that runs until they stop it."
                      : m === "prepaid" ? "Best rate, because they carry the whole run."
                      : "Lowest rate, and where a freebie does the most work."}</em>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {scale && !cat && (
          <section className="hc-sugblock">
            <h3>{scale.hint}</h3>
            <ul className="hc-sugfacts">
              <li><span>Offer</span><b>{scale.modes.map((m) => MODE_NAME[m]).join(", ")}</b></li>
            </ul>
            <p className="hc-sugwhy">{scale.why}</p>
          </section>
        )}

        {(cat || scale) && (
          <div data-noexport="true">
            <button className="hc-btn hc-sugapply" onClick={applySuggestion}>Use these as a starting point</button>
            <p className="hc-note hc-suggestnote">
              A starting point, not an answer. Once we have read your order history we will propose
              numbers from your own repeat gap, and those beat a category average every time.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function FieldRow({ f, value, answers, onChange, onFreebies, readOnly }: {
  f: Field; value: string | string[] | undefined; answers: Answers;
  onChange: (v: string | string[]) => void;
  onFreebies: (v: string) => void;
  readOnly?: boolean;
}) {
  if (f.kind === "choice" || f.kind === "multi") {
    const multi = f.kind === "multi";
    const list = Array.isArray(value) ? value : [];
    return (
      <div className={"hc-frow " + (f.span || "full")}>
        <span className="hc-flabel">{f.label}</span>
        {/* Columns that divide the option count evenly, so a group never ends on an orphan
            row. Eight categories read as 4 and 4; five sizes read as one row of five. */}
        <div className="hc-fchoices" style={{ "--cols": evenCols(f.options?.length || 1) } as React.CSSProperties}>
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
    // One rate per run the client actually offered, so the bands cannot describe a plan that
    // does not exist, which is how a discount ends up promised and unbuildable.
    const runs = parseList(answers.deliveries);
    const bands = parseBands(value);
    const freebies = parseFreebies(answers.freebies);
    if (!runs.length) {
      return <div className="hc-frow full"><span className="hc-flabel">{f.label}</span>
        <p className="hc-fhelp">Add the run lengths above first, and a rate appears for each.</p></div>;
    }
    return (
      <div className="hc-frow full">
        <span className="hc-flabel">{f.label}</span>
        <div className="hc-bands">
          {runs.map((r) => {
            const free = freebies.find((x) => x.run === r);
            const put = (next: Freebie[]) => onFreebies(writeFreebies(next));
            return (
              <div key={r} className={"hc-band" + (free ? " open" : "")}>
                <div className="hc-bandtop">
                  <span>{r} deliveries</span>
                  <label className="hc-bandrate">
                    <input type="number" min={0} max={90}
                      value={Number.isFinite(bands[r]) ? String(bands[r]) : ""} placeholder="0"
                      onChange={(e) => {
                        const next = { ...bands };
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n)) next[r] = n; else delete next[r];
                        onChange(writeBands(next));
                      }} />
                    <i>%</i>
                  </label>
                  <label className="hc-bandfree">
                    <input type="checkbox" checked={Boolean(free)}
                      onChange={(e) => put(e.target.checked
                        ? [...freebies, { run: r, delivery: 1, product: "" }]
                        : freebies.filter((x) => x.run !== r))} />
                    <span>Freebie</span>
                  </label>
                </div>

                {free && (
                  <div className="hc-bandgift">
                    {/* Which delivery and which product, because "there is a freebie" is not
                        an instruction anybody can build from. */}
                    <label>
                      <span>On delivery</span>
                      <input type="number" min={1} max={r} value={String(free.delivery)}
                        onChange={(e) => {
                          const d = Math.min(r, Math.max(1, parseInt(e.target.value, 10) || 1));
                          put(freebies.map((x) => (x.run === r ? { ...x, delivery: d } : x)));
                        }} />
                    </label>
                    <label className="hc-bandwhat">
                      <span>What they get</span>
                      <input type="text" value={free.product} maxLength={80}
                        placeholder="Sampler pack"
                        onChange={(e) => put(freebies.map((x) => (x.run === r ? { ...x, product: e.target.value } : x)))} />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {f.help && <p className="hc-fhelp">{f.help}</p>}
      </div>
    );
  }

  return (
    <div className={"hc-frow " + (f.span || "full")}>
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

/** The largest column count up to five that divides evenly, so no group leaves one option
 *  stranded on a row of its own. */
function evenCols(n: number): number {
  for (const c of [5, 4, 3, 2]) if (n % c === 0) return Math.min(c, n);
  return n <= 5 ? n : 4;
}

const MODE_NAME: Record<string, string> = {
  prepaid: "Prepaid", payg: "Pay as you go", auto_debit: "Pay per delivery",
};

/** The category's discounts are quoted at the prepaid rate. The other two scale off it, the
 *  same split the form takes as a lowest and a most. */
const MODE_RATE: Record<string, number> = { prepaid: 1, auto_debit: 0.75, payg: 0.5 };
