"use client";
import { useEffect, useMemo, useState } from "react";
import { PortableText } from "@portabletext/react";
import { QUERY_TOPIC_NAME } from "@/lib/help/topics";
import { parseSettings, type WidgetSettings } from "@/lib/help/widget";
import { APP_NAME } from "@/lib/help/types";
import { DEFAULT_CONFIG, money, planOptions, type SimConfig } from "@/lib/help/sim";
import { DEFAULT_ANSWERS, freebieRuns, parseBands, parseList, parseNames, type Answers } from "@/lib/help/questions";
import { modeDiscounts } from "@/lib/help/categories";
import type { LoggedQuery, PlanRec, StoreRecord } from "@/lib/sanity/queries";
import PlanForm from "./PlanForm";
import WidgetPreview from "./WidgetPreview";
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
  { id: 1, title: "Your plans", sub: "The four we need decided" },
  { id: 2, title: "What customers see", sub: "The flow, and the widget" },
  { id: 3, title: "What you get", sub: "The orders in Shopify" },
];

/** Tab one, as three steps.
 *
 *  The order is the order the decisions happen in: answer, then see what the answers do on
 *  the storefront, then see what they do in your admin. Running them together on one page
 *  meant somebody could scroll past the questions to the pretty part and never come back,
 *  which is the exact failure this is meant to fix. */
export default function Brief({ store, open, answered, connected }: {
  store: StoreRecord | null;
  open: LoggedQuery[];
  answered: LoggedQuery[];
  connected: boolean;
}) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<Answers>(DEFAULT_ANSWERS);
  const [settings, setSettings] = useState<WidgetSettings>(() => parseSettings(store?.widgetSettings));
  const [cfg, setCfg] = useState<SimConfig>(() => ({ ...DEFAULT_CONFIG }));
  const [active, setActive] = useState(0);

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
      productName: names[0] || "Dummy product",
      unitPrice: Number(answers.unit_price) || prev.unitPrice,
    }));
    const modes = Array.isArray(answers.modes) ? answers.modes : [];
    setSettings((s) => ({
      ...s,
      hide_prepaid: !modes.includes("prepaid"),
      hide_payg: !modes.includes("payg"),
      hide_auto_debit: !modes.includes("auto_debit"),
      // The line only ever says shipping is free. When it is not, there is no line.
      hide_free_shipping_line: false,
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

  const rates = useMemo(
    () => modeDiscounts(Number(answers.discount_min) || 0, Number(answers.discount_max) || 0),
    [answers.discount_min, answers.discount_max],
  );
  const plans = useMemo(() => planOptions(cfg, runs, bands, settings.schedule_text_format),
    [cfg, runs, bands, settings.schedule_text_format]);
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <section>
      <p className="hc-eyebrow">{store ? store.name : "Part one"}</p>
      <h1 className="hc-h1">{store ? "Your subscription plans" : "Subscription plans"}</h1>
      {store?.intro && <p className="hc-blurb">{store.intro}</p>}

      <ol className="hc-steps-nav">
        {STEPS.map((sdef) => (
          <li key={sdef.id} className={step === sdef.id ? "on" : step > sdef.id ? "past" : ""}>
            <button onClick={() => go(sdef.id)}>
              <i>{step > sdef.id ? "✓" : sdef.id}</i>
              <span><b>{sdef.title}</b><em>{sdef.sub}</em></span>
            </button>
          </li>
        ))}
      </ol>

      {recs.length > 1 && step === 1 && (
        <div className="hc-rectabs">
          {recs.map((r, i) => (
            <button key={r._key} className={"hc-rectab" + (i === active ? " on" : "")} onClick={() => setActive(i)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {rec && step === 1 && <RecCard rec={rec} />}

      {/* ------------------------------------------------------------ step 1 */}
      {step === 1 && (
        <PlanForm
          settings={settings}
          answers={answers} onAnswers={setAnswers}
          storeId={store?._id ?? null} storeName={store?.name ?? null}
          connected={connected} onDone={() => go(2)}
        />
      )}

      {/* ------------------------------------------------------------ step 2 */}
      {step === 2 && (
        <>
          <h2 className="hc-h2">What the customer does</h2>
          <p className="hc-note">One page, one choice, one payment. They never see the order flow in step three.</p>
          <ol className="hc-userflow">
            <li><b>Opens the product page</b><span>Sees the one-time price at {money(cfg.unitPrice)}, and your subscription beside it.</span></li>
            <li><b>Picks a schedule</b><span>{freqLabel(cfg.everyDays)}, {cfg.deliveries} deliveries, {money(plans[0].perDelivery)} each.</span></li>
            <li><b>Chooses how to pay</b><span>Whichever of prepaid, pay as you go and pay per delivery you accept.</span></li>
            <li><b>Checks out once</b><span>The last action they take. Every delivery after this happens on its own.</span></li>
          </ol>

          <h2 className="hc-h2">The widget on your product page</h2>
          <WidgetPreview
            s={settings} onChange={setSettings}
            plans={plans}
            productName={cfg.productName || "Your product"}
            variantLine={rec?.scope === "collection" ? rec.scopeDetail || undefined : undefined}
            unitPrice={cfg.unitPrice}
            compareAt={Math.round(cfg.unitPrice * 1.22)}
            onSubscribe={() => go(3)}
            rates={rates}
            shippingRate={answers.shipping_charged === "yes" ? Number(answers.shipping_rate) || 0 : 0}
            freebieRuns={freebieRuns(answers.freebies)}
          />

          <div className="hc-stepnav">
            <button className="hc-btn" onClick={() => go(1)}>Back to your answers</button>
            <button className="hc-btn primary" onClick={() => go(3)}>Next: what lands in your orders</button>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ step 3 */}
      {step === 3 && (
        <>
          <Simulator config={cfg} onConfig={setCfg} />
          <div className="hc-stepnav">
            <button className="hc-btn" onClick={() => go(2)}>Back to the widget</button>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------ always */}
      {open.length > 0 && step === 1 && (
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

      {answered.length > 0 && step === 1 && (
        <>
          <h2 className="hc-h2">Answered</h2>
          <div className="hc-list">{answered.map((q) => <Answered key={q._id} q={q} />)}</div>
        </>
      )}
    </section>
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
