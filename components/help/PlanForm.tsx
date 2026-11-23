"use client";
import { useEffect, useState } from "react";
import {
  DEFAULT_ANSWERS, QUESTIONS, asLines, autopayRate, complete, flatRate, parseBands, parseFreebies, parseList, parseNames, rateForRun, readPlanBands,
  reconcileModes, visible, writeBands, writeFreebies,
  type Answers, type Field, type Freebie,
} from "@/lib/help/questions";
import { CATEGORY_BY_ID, SCALE_BY_ID, freqWord } from "@/lib/help/categories";
import { drawPlanSheet } from "@/lib/help/sheet-png";
import { planDoc } from "@/lib/help/plan-doc";
import type { ImportResult } from "./OrderImport";
import type { PilotStore } from "@/lib/types";
import { coverage, discountBand, referenceFor, type CategoryReference } from "@/lib/help/references";
import ReferenceDrawer from "./ReferenceDrawer";
import { CATEGORY_DEFAULTS, categoryIdFor } from "@/lib/help/categories";
import type { WidgetSettings } from "@/lib/help/widget";

const DRAFT = "sb-help-planform";

/** Step one. The decisions, as fields, with what similar stores run beside them.
 *
 *  The suggester is not decoration: the first question a client asks after "what discount"
 *  is "what does everyone else do", and having an answer on the page turns a two-day email
 *  round trip into a click. It proposes, it never fills, because a store's own repeat gap
 *  beats a category average every time and quietly overwriting their number would hide that. */
/** A discount per run length out of a single observed band: the shortest run gets the low
 *  end, the longest the high end. A cohort logs one number per store, not a ladder, and a
 *  ladder is what a merchant has to be shown. */
function spread(band: { low: number; mid: number; high: number }, n: number): number[] {
  if (n <= 1) return [band.mid];
  const step = (band.high - band.low) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round(band.low + step * i));
}

/** Prepaid / pay as you go, counted, in one line. */
function payWord(r: CategoryReference): string {
  const parts: string[] = [];
  if (r.payment.prepaid) parts.push(`${r.payment.prepaid} prepaid`);
  if (r.payment.payg) parts.push(`${r.payment.payg} pay as you go`);
  if (r.payment.both) parts.push(`${r.payment.both} both`);
  return parts.join(", ");
}

export default function PlanForm({ answers, onAnswers, storeName, settings, pilots = [], editing, onEdit, fromOrders }: {
  answers: Answers; onAnswers: (a: Answers) => void;
  /** Snapshotted into the export, so the picture records what was toggled as well as priced. */
  settings: WidgetSettings;
  storeId: string | null; storeName: string | null;
  connected: boolean;
  /** Pilot rows, for naming stores already on this setup. */
  pilots?: PilotStore[];
  /** The form is open under the summary. */
  editing: boolean;
  /** Opens or closes the form. */
  onEdit: () => void;
  /** The answers came from the store's order file. */
  fromOrders?: boolean;
}) {
  /* Stores already on this setup, named. A category average is an argument; "three of your
     own pilots run exactly this" is a fact, and it is the thing that ends the discussion on a
     call. Matched on the sheet's own category wording, then narrowed by payment type once one
     is chosen, because that is what makes two setups the same rather than adjacent. */
  const like = (() => {
    const id = String(answers.category || "");
    if (!id || !pilots.length) return [] as PilotStore[];
    const modes = Array.isArray(answers.modes) ? answers.modes : [];
    const wantsPrepaid = modes.includes("prepaid");
    const wantsPayg = modes.includes("payg");
    return pilots
      .filter((st) => categoryIdFor(st.category) === id)
      .filter((st) => {
        if (!modes.length) return true;
        const pay = (st.paymentType || "").toLowerCase();
        if (!pay || pay === "\u2014") return true;
        if (pay.includes("both")) return true;
        if (wantsPrepaid && pay.includes("prepaid")) return true;
        if (wantsPayg && (pay.includes("payg") || pay.includes("pay as"))) return true;
        return false;
      })
      .slice(0, 6);
  })();

  /* What this store's own category actually runs, off the pilot rows, so the suggestion is
     the cohort's numbers rather than the ones somebody typed into categories.ts in July. It
     only overrides the default where enough of the category is logged to mean anything;
     below that the default stands and the cohort line is shown beside it as a check. */
  const ref = (() => {
    const id = String(answers.category || "");
    if (!id || !pilots.length) return null;
    /* Merged, not the first match: two sheet categories land on one plan category and
       taking the first showed a tea merchant the coffee stores and nothing else. */
    const mine = referenceFor(pilots, id, categoryIdFor);
    if (!mine) return null;
    const band = discountBand(mine);
    return { ref: mine, band, cov: coverage(mine), solid: coverage(mine) >= 0.34 && Boolean(band) };
  })();

  const [showLike, setShowLike] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  /* `#/refs` is a route an answer can link to, and the Help Centre resolves it to this
     screen. The drawer is this component's state, so it listens for the route itself rather
     than having one threaded down through two parents. */
  useEffect(() => {
    const check = () => { if (location.hash.replace(/^#\/?/, "") === "refs") setRefsOpen(true); };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, []);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT);
      if (raw) {
        const d = JSON.parse(raw) as { answers?: Answers };
        if (d.answers) {
          const m = d.answers.modes;
          onAnswers({ ...DEFAULT_ANSWERS, ...d.answers, ...(Array.isArray(m) ? { modes: reconcileModes(m) } : {}) });
        }
      } else if (storeName) {
        onAnswers({ ...DEFAULT_ANSWERS, brand_name: storeName });
      }
    } catch { /* private window: the form works, it just will not remember */ }
    // Once, on mount: this restores a draft, it does not track later edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = saveDraft;
  const set = (id: string, v: string | string[]) => {
    // Pay as you go and pay per delivery both collect per delivery, one by asking and one
    // automatically. Offering both asks a customer to choose between those, which nobody
    // does, so ticking either unticks the other.
    const value = id === "modes" && Array.isArray(v)
      ? reconcileModes(v, Array.isArray(answers.modes) ? answers.modes : [])
      : v;
    const next: Answers = { ...answers, [id]: value };
    /* Answering the volume question sets the payment types, because that question says in
       its own help text that it "decides which payment types are worth offering". It did
       not: the form shipped with prepaid and pay as you go ticked and they stayed ticked at
       every volume, so a store doing a few thousand orders was shown the small-store answer
       and AutoPay was never on screen. The band is still only a starting point — every box
       is still a box, and unticking one is a click. */
    if (id === "scale") {
      const band = SCALE_BY_ID.get(String(value || ""));
      if (band) next.modes = reconcileModes(band.modes, []);
    }
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

  /** The same configuration as text, for pasting into an email or a ticket.
   *
   *  "A document or a screenshot" was the ask, and the screenshot already existed. A picture
   *  cannot be searched, quoted or diffed against the next version, and half of what this
   *  gets used for is a paragraph in a reply. */
  function downloadDoc() {
    if (busy) return;
    setBusy(true); setResult(null);
    try {
      const brand = String(answers.brand_name || storeName || "plans").trim();
      const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "plans";
      const blob = new Blob([planDoc(answers, brand, settings)], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `stackback-plans-${slug}-${new Date().toISOString().slice(0, 10)}.md`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setResult({ ok: true, msg: "Downloaded as a document. Paste it straight into a reply." });
    } catch {
      setResult({ ok: false, msg: "The document could not be written in this browser." });
    } finally { setBusy(false); }
  }

  const scale = SCALE_BY_ID.get(String(answers.scale || ""));

  const [likeOpen, setLikeOpen] = useState(false);
  useEffect(() => {
    if (!likeOpen) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setLikeOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [likeOpen]);
  return (
    <div className="hc-planwrap">
      {/* The plans first, as a summary, and the form only on "Edit". From an order file the
          answers are already there, and a form of thirty fields is the wrong way to read them. */}
      <PlanSummary a={answers} storeName={storeName} fromOrders={Boolean(fromOrders)} />

      <div className="hc-plantools" data-noexport="true">
        <button type="button" className={"hc-btn" + (editing ? "" : " primary")} onClick={onEdit}>
          {editing ? "Done editing" : "Edit these plans"}
        </button>
        <button type="button" className="hc-btn" onClick={download} disabled={busy}>
          {busy ? "Making the image" : "Download as image"}
        </button>
        <button type="button" className="hc-btn" onClick={downloadDoc} disabled={busy}>Download as a document</button>
        <button type="button" className="hc-btn ghost hc-plansim" onClick={() => setLikeOpen(true)}>What similar stores run</button>
      </div>
      {result && <p className={"hc-result " + (result.ok ? "ok" : "bad")} role="status" data-noexport="true">{result.msg}</p>}

      {editing && (
        <div className="hc-form">
          <p className="hc-note">Answer what you know. The summary above follows as you type, and it saves on this device.</p>
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
        </div>
      )}

      {/* What similar stores run, on demand. It was a sticky panel beside the form, which
          halved the form on a laptop for something asked about once per call. */}
      {likeOpen && (
        <div className="hc-drawerwrap" role="dialog" aria-modal="true" aria-label="What similar stores run">
          <div className="hc-drawerscrim" onClick={() => setLikeOpen(false)} role="presentation" />
          <aside className="hc-drawer">
            <header className="hc-drawerh">
              <div>
                <b>What similar stores run</b>
                <span>{cat ? cat.label : "Pick a category in the plans"}{scale ? `, ${scale.hint.toLowerCase()}` : ""}</span>
              </div>
              <button type="button" onClick={() => setLikeOpen(false)} aria-label="Close">&times;</button>
            </header>
            <div className="hc-drawerbody hc-suggest hc-suggestin">
              <button type="button" className="hc-btn ghost hc-refbtn" onClick={() => { setLikeOpen(false); setRefsOpen(true); }}>
                See every category
              </button>
        {!cat && !scale && (
          <p className="hc-note">Pick a category and a size, and this fills in.</p>
        )}

        {/* The cohort's own numbers where enough of the category is logged, ours where it is
            not. This used to be the written-down category default with the cohort as a line
            underneath, and a separate References tab holding the real numbers, which is two
            places to read the same thing and one of them stale. */}
        {cat && (
          <section className="hc-sugblock">
            <h3>{cat.label}</h3>
            {ref?.solid && ref.band ? (
              <>
                <ul className="hc-sugfacts">
                  <li><span>Frequency</span><b>{ref.ref.everyDays.length ? ref.ref.everyDays.map(freqWord).join(", ").toLowerCase() : cat.everyDays.map(freqWord).join(", ").toLowerCase()}</b></li>
                  <li><span>Run lengths</span><b>{(ref.ref.deliveries.length ? ref.ref.deliveries : cat.deliveries).join(", ")} deliveries</b></li>
                  <li><span>Discount</span><b>{ref.band.mid}%{ref.band.low !== ref.band.high ? `, ${ref.band.low} to ${ref.band.high}` : ""}</b></li>
                  <li><span>Paid</span><b>{payWord(ref.ref) || "not logged"}</b></li>
                </ul>
                <p className="hc-sugwhy">
                  Read off {ref.ref.stores.length - ref.ref.unlogged.length} of your{" "}
                  {ref.ref.stores.length} {cat.label.toLowerCase()} stores, as the Pilots tab
                  stands right now. {cat.why}
                </p>
                <details className="hc-sugmore">
                  <summary>Which stores</summary>
                  <p>{ref.ref.stores.join(", ")}.</p>
                  {ref.ref.unlogged.length > 0 && <p className="hc-sugunlogged">Nothing logged yet: {ref.ref.unlogged.join(", ")}.</p>}
                </details>
              </>
            ) : (
              <>
                <ul className="hc-sugfacts">
                  <li><span>Frequency</span><b>{cat.everyDays.map(freqWord).join(", ").toLowerCase()}</b></li>
                  <li><span>Run lengths</span><b>{cat.deliveries.join(", ")} deliveries</b></li>
                  <li><span>Discount</span><b>{cat.deliveries.map((d, i) => `${cat.discounts[i]}% at ${d}`).join(", ")}</b></li>
                </ul>
                <p className="hc-sugwhy">
                  {cat.why}
                  {ref && <> {" "}Only {ref.ref.stores.length - ref.ref.unlogged.length} of your {ref.ref.stores.length} stores in this category have their plan columns filled in, so these are the category default rather than yours.</>}
                </p>
              </>
            )}
          </section>
        )}

        {scale && cat && (
          <section className="hc-sugblock">
            <h3>{scale.hint}</h3>
            <p className="hc-sugwhy">{scale.why}</p>
            {ref?.band && !ref.solid && (
              <p className={"hc-sugcohort thin"}>
                <b>Your cohort:</b> {ref.ref.stores.length} {ref.ref.label} store{ref.ref.stores.length === 1 ? "" : "s"} run{ref.ref.stores.length === 1 ? "s" : ""}{" "}
                {ref.band.mid}%{ref.band.low !== ref.band.high ? ` (${ref.band.low} to ${ref.band.high})` : ""}
                {ref.ref.everyDays[0] ? `, every ${ref.ref.everyDays[0]} days` : ""}
                {ref.ref.deliveries[0] ? `, ${ref.ref.deliveries[0]} deliveries` : ""}.
                {ref.solid
                  ? " The rates below are theirs."
                  : ` Only ${ref.ref.stores.length - ref.ref.unlogged.length} of ${ref.ref.stores.length} are logged, so the rates below are still the category default.`}
              </p>
            )}
            <ul className="hc-sugoffers">
              {scale.modes.map((m) => {
                const rate = MODE_RATE[m];
                /* The cohort's own run lengths and discounts once enough of the category is
                   logged, because "what your category runs" beats "what we wrote down". */
                const runs = m === "auto_debit" ? null
                  : (ref?.solid && ref.ref.deliveries.length ? ref.ref.deliveries.slice(0, 3) : cat.deliveries);
                const base = ref?.solid && ref.band
                  ? spread(ref.band, (runs || cat.deliveries).length)
                  : cat.discounts;
                return (
                  <li key={m}>
                    <b>{MODE_NAME[m]}</b>
                    <span>
                      {runs
                        ? runs.map((d, i) => `${Math.round((base[i] ?? base[base.length - 1]) * rate)}% at ${d}`).join(", ")
                        : `${Math.round(base[0] * rate)}% off, no run length`}
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

        {like.length > 0 && !showLike && (
          <button type="button" className="hc-btn ghost hc-sugask" data-noexport="true"
            onClick={() => setShowLike(true)}>What other stores are doing</button>
        )}

        {like.length > 0 && showLike && (
          <section className="hc-sugblock hc-sugstores">
            <h3>What other stores are doing</h3>
            <ul className="hc-sugpilots">
              {like.map((st) => (
                <li key={st.id || st.name}>
                  <b>{st.name}</b>
                  <span>
                    {[st.paymentType, st.frequency, st.discountMargin, st.shipping]
                      .map((x) => (x || "").trim()).filter((x) => x && x !== "\u2014").join(" \u00b7 ") || "setup not logged yet"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="hc-sugwhy">
              From the pilot sheet, matched on category{Array.isArray(answers.modes) && answers.modes.length ? " and payment type" : ""}.
              Blank columns mean nobody has logged that store&rsquo;s setup, not that it has none.
            </p>
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
            </div>
          </aside>
        </div>
      )}

      {refsOpen && <ReferenceDrawer pilots={pilots} onClose={() => setRefsOpen(false)} />}
    </div>
  );
}

/** The order file's answers, written over the form's. Pressing "use everything in this file"
 *  IS the instruction, so it overwrites rather than filling only the blanks. */
export function answersFromImport(answers: Answers, v: ImportResult): Answers {
  const { everyDays, extraEveryDays, runs, products, discountMin, discountMax, scale, category, brand, bands, ladder } = v;
  const band = scale ? SCALE_BY_ID.get(scale) : null;
  return {
    ...answers,
    every_days: [...new Set([everyDays, ...extraEveryDays])].sort((a, b) => a - b).map(String),
    ...(runs.length ? { deliveries: runs.join(", ") } : {}),
    ...(products.length ? { scope_kind: "products", scope_detail: products.join(", ") } : {}),
    ...(category ? { category } : {}),
    ...(brand && !String(answers.brand_name || "").trim() ? { brand_name: brand } : {}),
    plan_bands: bands.length ? JSON.stringify(bands) : "",
    byob_plan: v.byob ? JSON.stringify(v.byob) : "",
    product_mix: v.mix?.length ? JSON.stringify(v.mix.map((m) => ({ title: m.title, role: m.role, why: m.why, orders: m.orders, price: m.price,
      variants: m.variants.map((x) => ({ name: x.name, everyDays: x.everyDays, source: x.source, orders: x.orders })) }))) : "",
    ...(band ? { scale: band.id, modes: reconcileModes(band.modes, []) } : {}),
    /* `discount_pct` as well as the ends: the document reads that one and the widget reads
       `discount_max`, and a flat rate is not written as a tier. */
    ...(discountMin != null && discountMax != null && new Set(Object.values(ladder)).size > 1
      ? {
          discount_pct: String(discountMin),
          discount_min: String(Math.min(...Object.values(ladder))), discount_max: String(Math.max(...Object.values(ladder))),
          tiered: "yes", bands: writeBands(ladder),
        }
      : discountMax != null
        ? {
            discount_pct: String(discountMax),
            discount_min: String(discountMax), discount_max: String(discountMax),
            tiered: "no", bands: "",
          }
        : {}),
  };
}

/** Kept on this device, so leaving the step and coming back finds the same answers. */
export function saveDraft(a: Answers) {
  try { localStorage.setItem(DRAFT, JSON.stringify({ answers: a })); }
  catch { /* private window: the answers still hold for this visit */ }
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
  prepaid: "Prepaid", payg: "Pay per delivery (AutoPay)", auto_debit: "Pay per delivery (AutoPay)",
};

/** The category's discounts are quoted at the prepaid rate. The other two scale off it, the
 *  same split the form takes as a lowest and a most. */
const MODE_RATE: Record<string, number> = { prepaid: 1, auto_debit: 0.75, payg: 0.5 };

const SCOPE_WORD: Record<string, string> = { products: "Named products", collection: "A collection", all: "All products" };
const PAY_WORD: Record<string, string> = { prepaid: "Prepaid", payg: "Pay per delivery (AutoPay)", auto_debit: "Pay per delivery (AutoPay)" };
/** A run length as time, so "12 deliveries" reads as the commitment it is. */
function spanWord(run: number, every: number[]): string {
  if (!every.length) return "";
  const days = run * Math.min(...every);
  if (days < 56) return `about ${Math.round(days / 7)} weeks`;
  const m = Math.round(days / 30);
  return m >= 12 && m % 12 === 0 ? (m === 12 ? "about a year" : `about ${m / 12} years`) : `about ${m} months`;
}

/** The plans in one card: what a merchant reads and what the image download carries. */
type MixRow = { title: string; role: "subscription" | "bundle"; why: string; orders: number;
  variants: { name: string; everyDays: number; source: "reorders" | "pack" | "size" | "default"; orders: number }[] };
function readMix(a: Answers): MixRow[] {
  try { const v = JSON.parse(String(a.product_mix || "[]")); return Array.isArray(v) ? v : []; } catch { return []; }
}
const SOURCE_WORD: Record<string, string> = {
  reorders: "from reorders", pack: "pack duration", size: "scaled by pack size", default: "default, no reorders yet",
};
const RUNS_FOR: Record<number, number[]> = { 7: [3, 6, 12], 30: [3, 6, 12], 60: [2, 4, 6], 90: [2, 4] };
/** A group's prepaid rates by position: the first plan at the lowest rate, stepping to the
 *  most you would give, so every group's first plan reads the same rate. */
function groupRates(a: Answers, n: number): number[] {
  const lo = Number(a.discount_min) || flatRate(a), hi = Number(a.discount_max) || lo;
  if (a.tiered !== "yes") return Array.from({ length: n }, () => flatRate(a) || lo);
  return Array.from({ length: n }, (_, i) => Math.round(lo + ((hi - lo) * i) / 2));
}

/** Step 2 off an order file: what goes on subscription, what goes in a box, and the plans for
 *  each delivery frequency, with every product's evidence underneath. */
function MixSummary({ a, mix, brand, fromOrders }: { a: Answers; mix: MixRow[]; brand: string; fromOrders: boolean }) {
  const cat = CATEGORY_BY_ID.get(String(a.category || ""));
  const modes = Array.isArray(a.modes) ? a.modes : [];
  const subs = mix.filter((m) => m.role === "subscription"), boxes = mix.filter((m) => m.role === "bundle");
  const groups = new Map<number, { title: string; variants: string[]; all: boolean }[]>();
  for (const m of subs) {
    const by = new Map<number, string[]>();
    for (const v of m.variants) by.set(v.everyDays, [...(by.get(v.everyDays) || []), v.name]);
    for (const [e, vs] of by) groups.set(e, [...(groups.get(e) || []), { title: m.title, variants: vs, all: by.size === 1 }]);
  }
  let byob: { pool: string[]; tiers: { size: number; pct: number }[]; share: number } | null = null;
  try { byob = a.byob_plan ? JSON.parse(String(a.byob_plan)) : null; } catch { byob = null; }
  const freebies = parseFreebies(a.freebies);
  const ship = a.shipping_charged === "yes"
    ? `\u20b9${Number(a.shipping_rate) || 0} per delivery${Number(a.shipping_threshold) ? ` below \u20b9${Number(a.shipping_threshold)}` : ""}`
    : "Free on every delivery";
  return (
    <section className="hc-plansum hc-mix">
      <header>
        <div>
          <b>{brand || "Your plans"}</b>
          <span>{cat?.label || "Category not set"}</span>
        </div>
        {fromOrders && <em>Read from your orders</em>}
      </header>

      <div className="hc-mixsplit">
        <div>
          <p className="hc-mixh">On subscription <em>{subs.length}</em></p>
          <p className="hc-mixsub">Refills customers run out of. Sold as prepaid runs and AutoPay.</p>
          <ul className="hc-mixchips">{subs.map((m) => <li key={m.title}>{m.title}</li>)}</ul>
        </div>
        <div>
          <p className="hc-mixh">In a bundle <em>{boxes.length}</em></p>
          <p className="hc-mixsub">Kits, trials and accessories: bought once, best in a Build your own box.</p>
          <ul className="hc-mixchips alt">{boxes.length ? boxes.map((m) => <li key={m.title}>{m.title}</li>) : <li>None</li>}</ul>
        </div>
      </div>

      <h3 className="hc-mixsect">Subscription plans, by delivery frequency</h3>
      {[...groups.entries()].sort((x, y) => x[0] - y[0]).map(([every, items]) => {
        const runs = RUNS_FOR[every] || [3, 6, 12];
        const rates = groupRates(a, runs.length);
        return (
          <div key={every} className="hc-mixgrp">
            <div className="hc-mixgrph">
              <b>{freqWord(every)}</b>
              <span>{items.map((i) => i.all ? i.title : `${i.title} (${i.variants.join(", ")})`).join(" \u00b7 ")}</span>
            </div>
            <table>
              <thead><tr><th>Plan</th><th>Payment</th><th>Discount</th></tr></thead>
              <tbody>
                {modes.includes("prepaid") && runs.map((r, i) => (
                  <tr key={r}>
                    <td>{r} deliveries <small>{spanWord(r, [every])}</small></td>
                    <td>Prepaid</td>
                    <td><b>{rates[i]}% off</b></td>
                  </tr>
                ))}
                {modes.includes("auto_debit") && (
                  <tr>
                    <td>Ongoing <small>until they stop</small></td>
                    <td>Pay per delivery (AutoPay)</td>
                    <td><b>{autopayRate(rates)}% off</b></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}

      {byob?.tiers?.length ? (
        <>
          <h3 className="hc-mixsect">Build your own box</h3>
          <div className="hc-mixgrp">
            <div className="hc-mixgrph">
              <b>Pick from {byob.pool.length} products</b>
              <span>{byob.pool.join(" \u00b7 ")}</span>
            </div>
            <table>
              <thead><tr><th>Box</th><th>Bought</th><th>Discount</th></tr></thead>
              <tbody>
                {byob.tiers.map((t) => (
                  <tr key={t.size}><td>Pick any {t.size}</td><td>One time, or on subscription</td><td><b>{t.pct}% off</b></td></tr>
                ))}
              </tbody>
            </table>
            <p className="hc-mixnote">{Math.round(byob.share * 100)}% of your orders already combine two or more products.</p>
          </div>
        </>
      ) : null}

      <details className="hc-mixdetail" open>
        <summary>Product by product <span>why each one went where it did</span></summary>
        <table>
          <thead><tr><th>Product</th><th>Variants and delivery</th><th>Goes under</th></tr></thead>
          <tbody>
            {mix.map((m) => (
              <tr key={m.title}>
                <td><b>{m.title}</b><small>{m.orders} orders &middot; {m.why}</small></td>
                <td>{m.role === "bundle" ? <span className="hc-mixmute">Not delivered on a cycle</span> : (
                  <ul className="hc-mixvars">{m.variants.map((v) => (
                    <li key={v.name}><span>{v.name === "Default" ? "All" : v.name}</span><b>{freqWord(v.everyDays)}</b><em>{SOURCE_WORD[v.source]}</em></li>
                  ))}</ul>
                )}</td>
                <td><i className={"hc-mixrole " + m.role}>{m.role === "subscription" ? "Subscription" : "Bundle"}</i></td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <dl className="hc-plansumfacts">
        <div><dt>Payment</dt><dd>{modes.length ? modes.map((m) => PAY_WORD[m] || m).join(", ") : "Not set"}</dd></div>
        <div><dt>Shipping</dt><dd>{ship}</dd></div>
        <div><dt>Freebies</dt><dd>{freebies.length ? freebies.map((f) => `${f.product || "A gift"} on delivery ${f.delivery} of ${f.run}`).join("; ") : "None"}</dd></div>
      </dl>
    </section>
  );
}

function PlanSummary({ a, storeName, fromOrders }: { a: Answers; storeName: string | null; fromOrders: boolean }) {
  const mixRows = readMix(a);
  if (mixRows.length) return <MixSummary a={a} mix={mixRows} brand={String(a.brand_name || storeName || "").trim()} fromOrders={fromOrders} />;
  const cat = CATEGORY_BY_ID.get(String(a.category || ""));
  const scale = SCALE_BY_ID.get(String(a.scale || ""));
  const freqs = (Array.isArray(a.every_days) ? a.every_days : []).map(Number).filter(Boolean);
  const runs = parseList(a.deliveries);
  const modes = Array.isArray(a.modes) ? a.modes : [];
  const bands = readPlanBands(a);
  const freebies = parseFreebies(a.freebies);
  const products = parseNames(a.scope_detail);
  const groups = bands.length > 1
    ? bands.map((b) => ({ label: b.label + (b.sizes.length ? ` (${b.sizes.slice(0, 3).join(", ")})` : ""), every: [b.everyDays], runs: b.prepaidRuns }))
    : [{ label: "", every: freqs, runs }];
  const brand = String(a.brand_name || storeName || "").trim();
  const ship = a.shipping_charged === "yes"
    ? `\u20b9${Number(a.shipping_rate) || 0} per delivery${Number(a.shipping_threshold) ? ` below \u20b9${Number(a.shipping_threshold)}` : ""}`
    : "Free on every delivery";
  return (
    <section className="hc-plansum">
      <header>
        <div>
          <b>{brand || "Your plans"}</b>
          <span>{[cat?.label, scale?.label].filter(Boolean).join(" \u00b7 ") || "Category and size not set"}</span>
        </div>
        {fromOrders && <em>Read from your orders</em>}
      </header>
      {groups.map((g) => (
        <div key={g.label || "all"} className="hc-plansumgrp">
          {g.label && <p className="hc-plansumh">{g.label}</p>}
          {modes.includes("prepaid") && (g.runs.length ? (
            <table>
              <caption>Prepaid <span>paid upfront for the whole run</span></caption>
              <thead><tr><th>Plan</th><th>Frequency</th><th>Discount</th></tr></thead>
              <tbody>
                {g.runs.map((r) => (
                  <tr key={r}>
                    <td>{r} deliveries <small>{spanWord(r, g.every)}</small></td>
                    <td>{g.every.length ? g.every.map(freqWord).join(" or ") : "Not set"}</td>
                    <td><b>{rateForRun(a, r)}% off</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="hc-note">No prepaid run lengths yet. Edit the plans to add them.</p>)}
          {modes.includes("auto_debit") && (
            <table>
              <caption>Pay per delivery (AutoPay) <span>charged each delivery, runs until they stop</span></caption>
              <thead><tr><th>Plan</th><th>Frequency</th><th>Discount</th></tr></thead>
              <tbody>
                {(g.every.length ? g.every : [0]).map((e) => (
                  <tr key={e}>
                    <td>Ongoing <small>no fixed run</small></td>
                    <td>{e ? freqWord(e) : "Not set"}</td>
                    <td><b>{autopayRate(g.runs.map((r) => rateForRun(a, r)))}% off</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
      {(() => {
        let b: { pool: string[]; pairs: string[]; tiers: { size: number; pct: number }[]; share: number } | null = null;
        try { b = a.byob_plan ? JSON.parse(String(a.byob_plan)) : null; } catch { b = null; }
        if (!b || !b.tiers?.length) return null;
        return (
          <div className="hc-plansumgrp">
            <table>
              <caption>Build your own box <span>{Math.round(b.share * 100)}% of your orders already combine products</span></caption>
              <thead><tr><th>Box</th><th>Pick from</th><th>Discount</th></tr></thead>
              <tbody>
                {b.tiers.map((t, i) => (
                  <tr key={t.size}>
                    <td>Pick any {t.size}</td>
                    <td>{i === 0 ? `${b!.pool.slice(0, 4).join(", ")}${b!.pool.length > 4 ? ` +${b!.pool.length - 4}` : ""}` : "Same list"}</td>
                    <td><b>{t.pct}% off</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
      <dl className="hc-plansumfacts">
        <div><dt>Products</dt><dd>{SCOPE_WORD[String(a.scope_kind || "")] || "Not set"}{products.length ? `: ${products.slice(0, 3).join(", ")}${products.length > 3 ? ` +${products.length - 3}` : ""}` : ""}</dd></div>
        <div><dt>Payment</dt><dd>{modes.length ? modes.map((m) => PAY_WORD[m] || m).join(", ") : "Not set"}</dd></div>
        <div><dt>Shipping</dt><dd>{ship}</dd></div>
        <div><dt>Freebies</dt><dd>{freebies.length ? freebies.map((f) => `${f.product || "A gift"} on delivery ${f.delivery} of ${f.run}`).join("; ") : "None"}</dd></div>
      </dl>
    </section>
  );
}
