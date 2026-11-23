"use client";
import { useRef, useState } from "react";
import { analyse, brandFromFilename, byobTiers, guessCategory, planRates, readOrders, type OrderInsight } from "@/lib/help/orders";
import { autopayRate, ladderFor } from "@/lib/help/questions";
import { freqWord } from "@/lib/help/sim";

/** Read a store's own order export and propose plans from it.
 *
 *  The file is parsed in the browser and never sent anywhere. That is not a nicety: it is the
 *  only reason it is reasonable to drop a customer list into a help page, and it is said on
 *  the screen so nobody has to take it on trust. */
/** The scale band this file implies, from orders per month across the window it covers.
 *  The form asks for it as a guess; a file of real orders knows. */
function bandFor(out: OrderInsight): string | null {
  /* A file of 9,750 orders is not a volume until it says over how long. Three weeks of data
     is not a month, so anything shorter than that is left alone rather than extrapolated. */
  if (!out.windowDays || out.windowDays < 21) return null;
  const per = out.orders / (out.windowDays / 30.44);
  return per < 100 ? "early"
    : per < 500 ? "small"
    : per < 1000 ? "growing"
    : per < 5000 ? "established"
    : per < 20000 ? "large" : "enterprise";
}

export interface ImportResult {
    everyDays: number; extraEveryDays: number[]; runs: number[]; products: string[];
    /* Everything else the file can answer, so one click fills the form rather than two
       fields of it. A ladder the store's own customers have already accepted beats one off
       a category table, which is the whole argument for reading the file at all. */
    discountMin: number | null; discountMax: number | null; scale: string | null;
    /** The prepaid rate per run length, so the document and the widget agree. */
    ladder: Record<number, number>;
    category: string | null; brand: string | null;
    /** One plan per pack-size band, for the sheet and the document. */
    bands: { label: string; sizes: string[]; everyDays: number; medianGap: number; prepaidRuns: number[]; autopayCycles: number }[];
    /** A Build Your Own Box off what customers already buy together, or null. */
    byob: ByobPlan | null;
    /** Every product with its role and each variant's delivery frequency. */
    mix: OrderInsight["mix"];
}

export interface ByobPlan { pool: string[]; pairs: string[]; tiers: { size: number; pct: number }[]; share: number }

export default function OrderImport({ onApply }: {
  onApply: (v: ImportResult) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<OrderInsight | null>(null);
  /* The file's own name is the only thing on hand that could be a brand: a Shopify export
     carries no store-name column. */
  const [name, setName] = useState<string | null>(null);

  async function read(f: File) {
    setBusy(true); setErr(null); setOut(null);
    setName(f.name);
    try {
      const text = await f.text();
      const { rows, warnings } = readOrders(text);
      if (!rows.length) { setErr(warnings[0] || "No orders could be read from that file."); return; }
      setOut(analyse(rows, warnings));
    } catch {
      setErr("That file could not be read. A CSV exported from Shopify Orders is what this expects.");
    } finally { setBusy(false); }
  }

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const n = (x: number) => x.toLocaleString("en-IN");
  const rates = out ? planRates(out.discounts) : [];
  const byobPlan: ByobPlan | null = out?.byob ? {
    pool: out.byob.pool.map((p) => p.title),
    pairs: out.byob.pairs.slice(0, 3).map((p) => `${p.a} + ${p.b}`),
    tiers: byobTiers(out.byob, out.discounts.usualPct),
    share: out.byob.share,
  } : null;

  function apply() {
    if (!out) return;
                  const runsOut = out.plans.length ? out.plans[0].prepaidRuns : out.suggestRuns;
                  return onApply({
                  /* Both cadences where the file supports two plans: the form takes a list,
                     so a store with two pack sizes offers both rather than one averaged
                     number that is wrong for one of them. */
                  everyDays: out.plans.length ? out.plans[0].everyDays : (out.suggestEveryDays as number),
                  extraEveryDays: out.plans.slice(1).map((p) => p.everyDays),
                  runs: runsOut,
                  products: out.mix.filter((m) => m.role === "subscription").map((m) => m.title),
                  /* The rates this store's customers actually took, not the deepest single
                     order: one free replacement used to set the top of the ladder. */
                  discountMin: rates[0] ?? null,
                  discountMax: rates.length ? rates[rates.length - 1] : null,
                  ladder: ladderFor(runsOut, rates),
                  scale: bandFor(out),
                  category: guessCategory(out.topProducts),
                  brand: name ? brandFromFilename(name) : null,
                  /* Only where the file genuinely split. One plan over everything is the
                     normal case and must not print as a band. */
                  bands: out.plans.length > 1 || out.mix.length ? out.plans.map((p) => ({
                    label: p.label, sizes: [...new Set(p.sizes)], everyDays: p.everyDays,
                    medianGap: p.medianGap, prepaidRuns: p.prepaidRuns, autopayCycles: p.autopayCycles,
                  })) : [],
                  byob: byobPlan,
                  mix: out.mix,
                  });
  }

  const picker = (
    <input ref={file} type="file" accept=".csv,text/csv" className="hc-importfile"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); }} />
  );

  /* Before a file: one card, one action. The skip route is the step's Next button. */
  if (!out) {
    return (
      <section className="hc-oi-empty">
        {picker}
        <div className="hc-oi-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>
        </div>
        <h2>Start from your own orders</h2>
        <p>
          Drop in your Shopify orders export and we propose plans from how your customers already
          reorder. It is read <b>in this browser</b> and never uploaded.
        </p>
        <button type="button" className="hc-btn primary hc-oi-cta" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? "Reading\u2026" : "Choose your orders CSV"}
        </button>
        <span className="hc-oi-path">Shopify admin &rsaquo; Orders &rsaquo; Export &rsaquo; All orders &rsaquo; CSV for Excel</span>
        {err && <p className="hc-importerr">{err}</p>}
        <p className="hc-oi-skip">No file to hand? Press <b>Next</b> below and answer the plans by hand.</p>
      </section>
    );
  }

  const top = out.topProducts.slice(0, 5);
  const topMax = Math.max(1, ...top.map((p) => p.orders));

  return (
    <section className="hc-oi">
      {picker}
      <div className="hc-oi-file">
        <span className="hc-oi-fileic" aria-hidden="true">CSV</span>
        <div><b>{name || "Orders file"}</b><span>{n(out.orders)} orders read in this browser, nothing uploaded</span></div>
        <button type="button" className="hc-btn ghost" disabled={busy} onClick={() => file.current?.click()}>
          {busy ? "Reading\u2026" : "Use another file"}
        </button>
      </div>

      <div className="hc-oi-grid">
        <div className="hc-oi-main">
          <ul className="hc-oi-stats">
            <li><b>{n(out.orders)}</b><span>Orders</span></li>
            <li><b>{n(out.customers)}</b><span>Customers</span></li>
            <li><b>{pct(out.repeatRate)}</b><span>Ordered again</span></li>
            <li><b>{out.medianGap ? `${out.medianGap}d` : "\u2014"}</b><span>Typical gap</span></li>
          </ul>

          <div className="hc-oi-card">
            <p className="hc-oi-h">Discounts already given</p>
            {out.discounts.orders > 0 ? (
              <>
                <div className="hc-oi-disc">
                  <div><b>{out.discounts.usualPct != null ? `${out.discounts.usualPct}%` : `${out.discounts.medianPct}%`}</b><span>{out.discounts.usualPct != null ? "your usual promo" : "typical"}</span></div>
                  <div><b>{pct(out.discounts.share)}</b><span>of orders discounted</span></div>
                  <div><b>{rates.length ? `${ladderFor([3], rates)[3]}%` : "\u2014"}</b><span>first plan starts at</span></div>
                </div>
                {out.discounts.promos.length > 0 && (
                  <ul className="hc-oi-chips">
                    {out.discounts.promos.map((p) => <li key={p.code}><b>{p.pct}%</b> {p.code} &middot; {n(p.orders)}</li>)}
                  </ul>
                )}
                {out.discounts.payment && (
                  <p className="hc-oi-codes">
                    Left out: {out.discounts.payment.code} ({out.discounts.payment.pct}% on {n(out.discounts.payment.orders)} orders) is a
                    pay-online discount, not a product discount. Higher rates on a code are that code stacked with it.
                  </p>
                )}
                {!out.discounts.promos.length && out.discounts.codes.length > 0 && (
                  <p className="hc-oi-codes">Top codes: {out.discounts.codes.slice(0, 3).map((c) => `${c.code} (${c.orders})`).join(", ")}</p>
                )}
              </>
            ) : (
              <p className="hc-note">No order-level discounts in this file, so the plans start from your category instead.</p>
            )}
          </div>

          {top.length > 0 && (
            <div className="hc-oi-card">
              <p className="hc-oi-h">Most ordered</p>
              <ol className="hc-oi-top">
                {top.map((p) => (
                  <li key={p.title}>
                    <span className="hc-oi-topname">{p.title}</span>
                    <span className="hc-oi-bar"><i style={{ width: `${Math.round((p.orders / topMax) * 100)}%` }} /></span>
                    <span className="hc-oi-topn">{n(p.orders)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {byobPlan && (
            <div className="hc-oi-card">
              <p className="hc-oi-h">Bought together</p>
              <p className="hc-oi-codes">{pct(byobPlan.share)} of orders carry two or more products. Most common pairs:</p>
              <ul className="hc-oi-pairs">{byobPlan.pairs.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}

          {out.warnings.length > 0 && (
            <ul className="hc-importwarn">{out.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          )}
        </div>

        <aside className="hc-oi-plan">
          <p className="hc-oi-eyebrow">Proposed from your orders</p>
          {out.suggestEveryDays || out.plans.length ? (
            <>
              {out.repeatRate < 0.05 && (
                <p className="hc-oi-after">Few reorders in this file, so each product&rsquo;s frequency comes from its pack: the duration in the variant name, or its size.</p>
              )}
              {out.plans.map((pl) => (
                <div key={pl.label} className="hc-oi-pl">
                  <p className="hc-oi-plh">{pl.label}{pl.sizes.length > 0 && <em>{[...new Set(pl.sizes)].slice(0, 3).join(", ")}</em>}</p>
                  {pl.products.length > 0
                    ? <p className="hc-oi-cad">{pl.products.slice(0, 4).join(" \u00b7 ")}{pl.products.length > 4 ? ` +${pl.products.length - 4} more` : ""}</p>
                    : <p className="hc-oi-cad">Delivered <b>{freqWord(pl.everyDays).toLowerCase()}</b></p>}
                  <div className="hc-oi-mode">
                    <span>Prepaid</span>
                    {pl.prepaidRuns.length
                      ? <ul>{pl.prepaidRuns.map((r) => <li key={r}>{r} deliveries{rates.length ? <b> {ladderFor(pl.prepaidRuns, rates)[r]}%</b> : null}</li>)}</ul>
                      : <em>No run length fits this cadence</em>}
                  </div>
                  <div className="hc-oi-mode">
                    <span>Pay per delivery (AutoPay)</span>
                    <em>Charged each delivery, runs until they stop.{rates.length ? <b> {autopayRate(Object.values(ladderFor(pl.prepaidRuns, rates)))}% off</b> : null}</em>
                  </div>
                </div>
              ))}
              {byobPlan && (
                <div className="hc-oi-pl">
                  <p className="hc-oi-plh">Build your own box<em>from products bought together</em></p>
                  <div className="hc-oi-mode">
                    <span>Box sizes</span>
                    <ul>{byobPlan.tiers.map((t) => <li key={t.size}>Pick {t.size}<b> {t.pct}%</b></li>)}</ul>
                  </div>
                  <p className="hc-oi-cad">From: {byobPlan.pool.slice(0, 5).join(", ")}{byobPlan.pool.length > 5 ? ` +${byobPlan.pool.length - 5}` : ""}</p>
                </div>
              )}
              <button type="button" className="hc-btn primary hc-oi-cta" onClick={apply}>
                Build my plans from this file <span aria-hidden="true">&rarr;</span>
              </button>
              <p className="hc-oi-after">Fills in your plans. You can change any of it on the next step.</p>
            </>
          ) : (
            <p className="hc-note">
              Not enough repeat orders in this file to name a cadence. It usually means the window is
              too short. Press Next and set the plans by hand.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
