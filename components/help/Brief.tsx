"use client";
import { useState } from "react";
import { PortableText } from "@portabletext/react";
import { QUERY_TOPIC_NAME } from "@/lib/help/topics";
import { parseSettings, type WidgetSettings } from "@/lib/help/widget";
import { APP_NAME } from "@/lib/help/types";
import { money } from "@/lib/help/sim";
import type { LoggedQuery, PlanRec, StoreRecord } from "@/lib/sanity/queries";
import AnswerQueries from "./AnswerQueries";
import WidgetPreview from "./WidgetPreview";
import Simulator from "./Simulator";

const MODE_LABEL: Record<string, string> = {
  prepaid: "Prepaid, paid upfront", payg: "Pay as you go", autopay: "UPI AutoPay",
};
const SCOPE_LABEL: Record<string, string> = {
  products: "Named products", collection: "A collection", all: "All products",
};
const freqLabel = (d: number) =>
  d === 7 ? "Weekly" : d === 15 ? "Every 15 days" : d === 30 ? "Monthly" : `Every ${d} days`;

/** Tab one. What we are proposing for this store, what we still need them to decide, and
 *  the two things that make those decisions concrete: the widget their customers would see,
 *  and the order schedule the plan would generate.
 *
 *  With no store in the URL this is the generic version: the queries anybody can raise, the
 *  widget playground and the simulator, with no recommendations. That is the link to hand
 *  somebody before they are a store record. */
export default function Brief({ store, open, answered, connected }: {
  store: StoreRecord | null;
  open: LoggedQuery[];
  answered: LoggedQuery[];
  connected: boolean;
}) {
  /* AutoPay is not offered on this screen. It is a live payment mode in the product, but it
     is not one we put in front of a client while plans are still being agreed, so the
     preview never shows it and there is no toggle to turn it back on here. */
  const [settings, setSettings] = useState<WidgetSettings>(
    () => ({ ...parseSettings(store?.widgetSettings), hide_auto_debit: true }),
  );
  const recs = store?.recommendations || [];
  const [active, setActive] = useState(0);
  const rec: PlanRec | undefined = recs[active];

  return (
    <section>
      <p className="hc-eyebrow">{store ? store.name : "Part one"}</p>
      <h1 className="hc-h1">{store ? "Your subscription plans" : "Subscription plans and queries"}</h1>
      <p className="hc-blurb">
        {store?.intro
          ? store.intro
          : "What we propose selling, and the four things we need decided before it can be built: which products carry a subscription, how often it delivers, what the discount is, and which payment types you accept."}
      </p>

      {/* ---------------- what we propose ---------------- */}
      {recs.length > 0 && (
        <>
          <h2 className="hc-h2">What we are proposing</h2>
          {recs.length > 1 && (
            <div className="hc-rectabs">
              {recs.map((r, i) => (
                <button key={r._key} className={"hc-rectab" + (i === active ? " on" : "")} onClick={() => setActive(i)}>
                  {r.label}
                </button>
              ))}
            </div>
          )}
          {rec && <RecCard rec={rec} />}
        </>
      )}

      {/* ---------------- what we need answered ---------------- */}
      <h2 className="hc-h2">{store ? "What we need from you" : "The four we always ask"}</h2>
      {open.length > 0 ? (
        <>
          <p className="hc-note">
            Nothing gets built until these are answered. Answer them here and they are filed against your
            brand, so the decision is on a page rather than three hundred messages up a thread.
          </p>
          <AnswerQueries queries={open} storeId={store?._id ?? null} storeName={store?.name ?? null} connected={connected} />
        </>
      ) : (
        <ol className="hc-openq hc-openq-generic">
          {[
            ["Scope", "Which products, which collections, or all products carry a subscription. Including whether every variant does."],
            ["Frequency", "How often a delivery goes out. We propose this from the gap in your own repeat purchases."],
            ["Discount", "What a subscriber saves, and whether it grows with a longer commitment."],
            ["Payment type", "Prepaid, pay as you go, UPI AutoPay, or a mix, and which one a customer sees first."],
          ].map(([t, d]) => (
            <li key={t}><b>{t}</b><span>{d}</span></li>
          ))}
        </ol>
      )}

      {/* ---------------- the widget ---------------- */}
      <h2 className="hc-h2">What your customers would see</h2>
      <p className="hc-blurb">
        This is the {APP_NAME} widget on your product page, drawn from your settings. Flip anything on the
        right and it redraws, so you can decide on the call rather than after the build.
      </p>
      <WidgetPreview
        s={settings} onChange={setSettings}
        productName={rec?.scopeDetail || "Your product"}
        unitPrice={rec?.unitPrice || 750}
        everyDays={rec?.everyDays || 30}
        deliveries={rec?.deliveries || 6}
        discountPct={rec?.discountPct ?? 15}
      />

      {/* ---------------- the maths ---------------- */}
      <div className="hc-simblock">
        <Simulator
          compact
          seed={rec ? {
            productName: rec.scopeDetail || rec.label,
            unitPrice: rec.unitPrice || 750,
            everyDays: rec.everyDays,
            deliveries: rec.deliveries,
            discountPct: rec.discountPct,
            mode: rec.mode === "payg" ? "payg" : "prepaid",
          } : undefined}
        />
      </div>

      {/* ---------------- answered ---------------- */}
      <h2 className="hc-h2">Answered</h2>
      {answered.length === 0 ? (
        <div className="hc-empty">
          <p>{connected
            ? "Nothing answered yet. Anything you ask us gets written up here, so the decision is on a page instead of in a thread."
            : "Answered queries appear here once the CMS is connected."}</p>
        </div>
      ) : (
        <div className="hc-list">
          {answered.map((q) => <Answered key={q._id} q={q} />)}
        </div>
      )}
    </section>
  );
}

function RecCard({ rec }: { rec: PlanRec }) {
  const per = rec.unitPrice ? rec.unitPrice * (1 - rec.discountPct / 100) : null;
  return (
    <div className="hc-rec">
      <div className="hc-recgrid">
        <Fact label="Scope" value={SCOPE_LABEL[rec.scope]} detail={rec.scopeDetail} />
        <Fact label="Frequency" value={freqLabel(rec.everyDays)} detail={`${rec.deliveries} deliveries in a run`} />
        <Fact label="Discount" value={`${rec.discountPct}% off`} detail={per ? `${money(per)} per delivery` : null} />
        <Fact label="Payment" value={MODE_LABEL[rec.mode] || rec.mode} detail={null} />
      </div>
      {rec.rationale && (
        <p className="hc-recwhy"><b>Why this</b>{rec.rationale}</p>
      )}
    </div>
  );
}

const Fact = ({ label, value, detail }: { label: string; value: string; detail?: string | null }) => (
  <div className="hc-fact">
    <span>{label}</span>
    <b>{value}</b>
    {detail && <em>{detail}</em>}
  </div>
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
          <div className="hc-prose">
            {q.answer ? <PortableText value={q.answer as never} /> : <p>Answer pending.</p>}
          </div>
          <div className="hc-meta">
            <span>Answered {new Date(q.raisedAt).toLocaleDateString()}</span>
            {topic && <span>{topic}</span>}
          </div>
        </div>
      )}
    </article>
  );
}

