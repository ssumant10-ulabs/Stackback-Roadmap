"use client";
import { useEffect, useMemo, useState } from "react";
import { PortableText } from "@portabletext/react";
import { QUERY_TOPIC_NAME } from "@/lib/help/topics";
import { parseSettings, type WidgetSettings } from "@/lib/help/widget";
import { APP_NAME } from "@/lib/help/types";
import { DEFAULT_CONFIG, money, type SimConfig } from "@/lib/help/sim";
import { DEFAULT_ANSWERS, parseBands, parseList, parseNames, type Answers } from "@/lib/help/questions";
import type { LoggedQuery, PlanRec, StoreRecord } from "@/lib/sanity/queries";
import PlanForm, { answersFromImport, saveDraft } from "./PlanForm";
import OrderImport from "./OrderImport";
import type { PilotStore } from "@/lib/types";
import { CATEGORY_DEFAULTS } from "@/lib/help/categories";
import Simulator from "./Simulator";

const MODE_LABEL: Record<string, string> = {
  prepaid: "Prepaid, paid upfront", payg: "Pay as you go", autopay: "Pay per delivery",
};
const SCOPE_LABEL: Record<string, string> = {
  products: "Named products", collection: "A collection", all: "All products",
};
const freqLabel = (d: number) =>
  d === 7 ? "Every week" : d === 14 ? "Every 2 weeks" : d === 30 ? "Every month"
  : d === 60 ? "Every 2 months" : `Every ${d} days`;

const STEPS = [
  { id: 1, title: "Your orders", sub: "Upload them, or skip" },
  { id: 2, title: "Your plans", sub: "Check, edit, download" },
  { id: 3, title: "What you get", sub: "The orders in Shopify" },
];

/** Tab one, as three steps.
 *
 *  The order is the order the decisions happen in: answer, then see what the answers do on
 *  the storefront, then see what they do in your admin. Running them together on one page
 *  meant somebody could scroll past the questions to the pretty part and never come back,
 *  which is the exact failure this is meant to fix. */
export default function Brief({ store, open, answered, connected, step, onStep, pilots }: {
  store: StoreRecord | null;
  open: LoggedQuery[];
  answered: LoggedQuery[];
  connected: boolean;
  /** The step lives in the address, so a client can be sent straight to their plans. */
  step: number;
  onStep: (n: number) => void;
  /** Pilot rows from the host, for the "stores on this setup" block. */
  pilots?: PilotStore[];
}) {
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [settings, setSettings] = useState<WidgetSettings>(() => parseSettings(store?.widgetSettings));
  const [cfg, setCfg] = useState<SimConfig>(() => ({ ...DEFAULT_CONFIG }));
  const [active, setActive] = useState(0);
  /* How step two was reached. From the order file the plans are already answered, so step
     two shows them as the sheet; by hand, or once "Edit" is pressed, it is the form. */
  const [fromOrders, setFromOrders] = useState(false);
  const [editing, setEditing] = useState(false);

  const recs = store?.recommendations || [];
  const rec: PlanRec | undefined = recs[active];

  /* The form's answers are the source for everything downstream, so step 2 and 3 show the
     client their own choices rather than our defaults. A store's recommendation seeds them
     when there is one. */
  const runs = useMemo(() => parseList(answers.deliveries), [answers.deliveries]);
  const bands = useMemo(
    () => (answers.tiered === "yes" ? parseBands(answers.bands) : {}),
    [answers.tiered, answers.bands],
  );

  useEffect(() => {
    const freqs = (Array.isArray(answers.every_days) ? answers.every_days : []).map(Number).filter(Boolean);
    const names = parseNames(answers.scope_detail);
    setCfg((prev) => ({
      ...prev,
      // The first frequency and the shortest run are what the orders below are drawn for.
      // A store can offer several of each; the simulation has to pick one to be about.
      everyDays: freqs[0] || prev.everyDays,
      deliveries: runs[0] || prev.deliveries,
      // The widget shows the rate for the payment type the customer is looking at, so the
      // simulation is about the one the store leads with.
      discountPct: answers.tiered === "yes"
        ? (bands[runs[0]] ?? (Number(answers.discount_max) || 0))
        : Number(answers.discount_max) || 0,
      productName: names[0] || "Store Product",
    }));
    const modes = Array.isArray(answers.modes) ? answers.modes : [];
    setSettings((s) => ({
      ...s,
      hide_prepaid: !modes.includes("prepaid"),
      hide_payg: !modes.includes("payg"),
      hide_auto_debit: !modes.includes("auto_debit"),
      /* Two settings depend on what is being sold rather than on how it is paid for, so the
         category sets them and the call does not have to. A supplement is priced per serving
         and a staple is not; putting a per-delivery figure on a low-ticket staple reads as
         the whole price. Both stay editable in step two. */
      ...(CATEGORY_DEFAULTS[String(answers.category || "")] ?? {}),
    }));
  }, [answers, runs, bands]);

  useEffect(() => {
    if (!rec) return;
    setAnswers((a) => ({
      ...a,
      scope_kind: rec.scope, scope_detail: rec.scopeDetail || "",
      every_days: [String(rec.everyDays)], deliveries: String(rec.deliveries),
      discount_pct: String(rec.discountPct),
    }));
    setCfg((prev) => ({ ...prev, unitPrice: rec.unitPrice || prev.unitPrice }));
  }, [rec]);

  const go = (n: number) => { onStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <section>
      <header className="hc-pagehead">
        <p className="hc-eyebrow">{store ? store.name : "Subscription plan setup"}</p>
        <h1 className="hc-h1">{store ? "Your subscription plans" : "Set up your plans"}</h1>
        <p className="hc-blurb">{store?.intro || "Start from your own orders, or skip and answer by hand. Then see the orders your plans create in Shopify."}</p>
      </header>

      {/* Where you are, in one line. The four step cards were a second navigation over a
          flow that only goes forward and back. */}
      <p className="hc-stepcount">Step {step} of {STEPS.length}<b>{STEPS[step - 1].title}</b></p>

      {/* ------------------------------------------------------------ step 1 */}
      {step === 1 && (
        <OrderImport onApply={(v) => {
          const next = answersFromImport(answers, v);
          setAnswers(next); saveDraft(next);
          setFromOrders(true); setEditing(false); go(2);
        }} />
      )}
      {step === 1 && (
        <StepNav
          next={fromOrders ? "Next: your plans" : "Next: enter plans by hand"}
          onNext={() => { if (!fromOrders) setEditing(true); go(2); }} />
      )}

      {recs.length > 1 && step === 2 && (
        <div className="hc-rectabs">
          {recs.map((r, i) => (
            <button key={r._key} className={"hc-rectab" + (i === active ? " on" : "")} onClick={() => setActive(i)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {rec && step === 2 && <RecCard rec={rec} />}

      {/* ------------------------------------------------------------ step 2 */}
      {step === 2 && (
        <PlanForm
          settings={settings}
          answers={answers} onAnswers={setAnswers}
          storeId={store?._id ?? null} storeName={store?.name ?? null}
          connected={connected} pilots={pilots}
          editing={editing}
          fromOrders={fromOrders}
          onEdit={() => setEditing((e) => !e)}
        />
      )}
      {step === 2 && <StepNav prev="Previous: your orders" onPrev={() => go(1)} next="Next: what lands in your orders" onNext={() => go(3)} />}

      {/* ------------------------------------------------------------ step 3
          "What customers see" was step three, archived 2026-11-20: the Widget Lab shows the
          widget on the store's own page, which this step only approximated. */}
      {step === 3 && (
        <>
          <Simulator config={cfg} onConfig={setCfg} />
          <StepNav prev="Previous: your plans" onPrev={() => go(2)} />
        </>
      )}

      {/* ------------------------------------------------------------ always */}
      {open.length > 0 && step === 2 && (
        <>
          <h2 className="hc-h2">Also waiting on you</h2>
          <ol className="hc-openq">
            {open.map((q) => (
              <li key={q._id}>
                <b>{q.question}</b>
                {q.topic && <span>{QUERY_TOPIC_NAME.get(q.topic)}</span>}
              </li>
            ))}
          </ol>
        </>
      )}

      {answered.length > 0 && step === 2 && (
        <>
          <h2 className="hc-h2">Answered</h2>
          <div className="hc-list">{answered.map((q) => <Answered key={q._id} q={q} />)}</div>
        </>
      )}
    </section>
  );
}

function StepNav({ prev, onPrev, next, onNext }: { prev?: string; onPrev?: () => void; next?: string; onNext?: () => void }) {
  return (
    <div className="hc-stepnav">
      {prev && onPrev ? <button type="button" className="hc-btn" onClick={onPrev}>&larr; {prev}</button> : <span />}
      {next && onNext && <button type="button" className="hc-btn primary" onClick={onNext}>{next} &rarr;</button>}
    </div>
  );
}

function RecCard({ rec }: { rec: PlanRec }) {
  const per = rec.unitPrice ? rec.unitPrice * (1 - rec.discountPct / 100) : null;
  return (
    <div className="hc-rec">
      <p className="hc-recwhat">What we propose, from your order history. The form below is pre-filled with it.</p>
      <div className="hc-recgrid">
        <Fact label="Scope" value={SCOPE_LABEL[rec.scope]} detail={rec.scopeDetail} />
        <Fact label="Frequency" value={freqLabel(rec.everyDays)} detail={`${rec.deliveries} deliveries in a run`} />
        <Fact label="Discount" value={`${rec.discountPct}% off`} detail={per ? `${money(per)} per delivery` : null} />
        <Fact label="Payment" value={MODE_LABEL[rec.mode] || rec.mode} detail={null} />
      </div>
      {rec.rationale && <p className="hc-recwhy"><b>Why this</b>{rec.rationale}</p>}
    </div>
  );
}

const Fact = ({ label, value, detail }: { label: string; value: string; detail?: string | null }) => (
  <div className="hc-fact"><span>{label}</span><b>{value}</b>{detail && <em>{detail}</em>}</div>
);

function Answered({ q }: { q: LoggedQuery }) {
  const [openState, setOpen] = useState(false);
  const topic = q.topic ? QUERY_TOPIC_NAME.get(q.topic) : null;
  return (
    <article className={"hc-item" + (openState ? " open" : "")}>
      <button className="hc-q" onClick={() => setOpen(!openState)} aria-expanded={openState}>
        <span className="hc-qtext">{q.question}</span>
        {q.raisedCount && q.raisedCount > 1 && <span className="hc-pill p-m">{q.raisedCount} clients</span>}
        <svg className="hc-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2 L8.5 6 L4 10" /></svg>
      </button>
      {openState && (
        <div className="hc-a">
          <div className="hc-prose">{q.answer ? <PortableText value={q.answer as never} /> : <p>Answer pending.</p>}</div>
          <div className="hc-meta">
            <span>Answered {new Date(q.raisedAt).toLocaleDateString()}</span>
            {topic && <span>{topic}</span>}
          </div>
        </div>
      )}
    </article>
  );
}
