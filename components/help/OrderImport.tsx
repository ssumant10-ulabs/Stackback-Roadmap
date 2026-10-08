"use client";
import { useRef, useState } from "react";
import { analyse, brandFromFilename, guessCategory, planRates, readOrders, type OrderInsight } from "@/lib/help/orders";
import { ladderFor } from "@/lib/help/questions";
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

export default function OrderImport({ onApply }: {
  onApply: (v: {
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
  }) => void;
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

  return (
    <section className="hc-import">
      <p className="hc-importh">Read it from your own orders</p>
      <p className="hc-note">
        Export your orders from Shopify and drop the CSV here. It is read <b>in this browser</b> and
        never uploaded, so nothing leaves your machine. Your own repeat gap beats a category
        average every time.
      </p>

      <div className="hc-importrow" data-noexport="true">
        <input ref={file} type="file" accept=".csv,text/csv" className="hc-importfile"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); }} />
        <button type="button" className="hc-btn" disabled={busy}
          onClick={() => file.current?.click()}>
          {busy ? "Reading…" : out ? "Read another file" : "Choose your orders CSV"}
        </button>
        <span className="hc-note hc-importhow">Shopify admin &rsaquo; Orders &rsaquo; Export &rsaquo; all orders, CSV for Excel</span>
      </div>

      {err && <p className="hc-importerr">{err}</p>}

      {out && (
        <>
          <ul className="hc-importstats">
            <li><b>{out.orders.toLocaleString("en-IN")}</b><span>orders read</span></li>
            <li><b>{out.customers.toLocaleString("en-IN")}</b><span>customers</span></li>
            <li><b>{pct(out.repeatRate)}</b><span>ordered more than once</span></li>
            <li><b>{out.medianGap ?? "—"}{out.medianGap ? " days" : ""}</b><span>median gap between orders</span></li>
          </ul>

          {out.suggestEveryDays ? (
            <div className="hc-importsug">
              {/* One block per pack-size band. A 100g bag and a 1kg bag do not reorder at the
                  same rate, and one median over both is wrong for whichever band has fewer
                  intervals in it. Single block when the file does not support a split. */}
              {out.plans.map((pl) => (
                <div className="hc-plan" key={pl.label}>
                  <p className="hc-planh">
                    {pl.label}
                    {pl.sizes.length > 0 && <em>{[...new Set(pl.sizes)].slice(0, 4).join(", ")}</em>}
                  </p>
                  <p>
                    {out.plans.length > 1 ? "These" : "They"} reorder about{" "}
                    <b>{freqWord(pl.everyDays).toLowerCase()}</b>, from{" "}
                    {pl.gapSample.toLocaleString("en-IN")} intervals
                    {pl.customers > 0 && <> across {pl.customers.toLocaleString("en-IN")} {pl.customers === 1 ? "customer" : "customers"}</>}.
                  </p>
                  {/* Prepaid and AutoPay are not the same product, so they do not share a
                      line. Prepaid is a fixed run bought upfront. AutoPay runs until the
                      customer stops it — the twelve is a year at this cadence, which is what
                      a merchant prices against, not a commitment anyone is making. */}
                  <dl className="hc-planmodes">
                    <div>
                      <dt>Prepaid</dt>
                      <dd>
                        {pl.prepaidRuns.length
                          ? <>Runs of <b>{pl.prepaidRuns.join(", ")}</b> deliveries &mdash; roughly three months, six months and a year.</>
                          : <>No run length this cadence supports.</>}
                      </dd>
                    </div>
                    <div>
                      <dt>AutoPay</dt>
                      <dd>
                        No fixed run: it bills until they stop it. Price and forecast against{" "}
                        <b>{pl.autopayCycles}</b> deliveries, a year at this cadence.
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
              <button type="button" className="hc-btn hc-sugapply" data-noexport="true"
                onClick={() => {
                  const rates = planRates(out.discounts);
                  const runsOut = out.plans.length ? out.plans[0].prepaidRuns : out.suggestRuns;
                  return onApply({
                  /* Both cadences where the file supports two plans: the form takes a list,
                     so a store with two pack sizes offers both rather than one averaged
                     number that is wrong for one of them. */
                  everyDays: out.plans.length ? out.plans[0].everyDays : (out.suggestEveryDays as number),
                  extraEveryDays: out.plans.slice(1).map((p) => p.everyDays),
                  runs: runsOut,
                  products: out.topProducts.slice(0, 3).map((p) => p.title),
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
                  bands: out.plans.length > 1 ? out.plans.map((p) => ({
                    label: p.label, sizes: [...new Set(p.sizes)], everyDays: p.everyDays,
                    medianGap: p.medianGap, prepaidRuns: p.prepaidRuns, autopayCycles: p.autopayCycles,
                  })) : [],
                  });
                }}>
                Use everything in this file
              </button>
            </div>
          ) : (
            <p className="hc-note">
              Not enough repeat behaviour in this file to name a cadence. That is an answer too: it
              usually means the window is too short rather than that nobody reorders.
            </p>
          )}

          {/* What this store already discounts. The ask was the maximum and how many took it,
              because a ladder anchored to a rate these customers have already accepted is a
              different argument from one off a category table. */}
          {out.discounts.orders > 0 ? (
            <div className="hc-importdisc">
              <p className="hc-importsub">Discounts already given</p>
              <ul className="hc-importstats">
                <li><b>{out.discounts.maxPct}%</b><span>deepest on one order</span></li>
                <li><b>{out.discounts.medianPct}%</b><span>typical when discounted</span></li>
                <li>
                  <b>{out.discounts.orders.toLocaleString("en-IN")}</b>
                  <span>orders discounted, {pct(out.discounts.share)} of all</span>
                </li>
              </ul>
              {out.discounts.bands.length > 0 && (
                <ol className="hc-importbands">
                  {out.discounts.bands.map((b) => (
                    <li key={b.pct}>
                      <b>{b.pct}% off</b>
                      <span>{b.orders.toLocaleString("en-IN")} {b.orders === 1 ? "order" : "orders"}</span>
                    </li>
                  ))}
                </ol>
              )}
              {out.discounts.codes.length > 0 && (
                <p className="hc-note">
                  Most used {out.discounts.codes.length === 1 ? "code" : "codes"}:{" "}
                  {out.discounts.codes.map((c) => `${c.code} (${c.orders})`).join(", ")}.
                </p>
              )}
            </div>
          ) : (
            <p className="hc-note">
              No order-level discounts in this file, so the plan ladder has nothing of your own
              to anchor to. The export carries them in a Discount Amount column; if yours has
              none, discounts were applied some other way.
            </p>
          )}

          {out.topProducts.length > 0 && (
            <div className="hc-importtop">
              <p className="hc-importsub">Most ordered, by number of orders</p>
              <ol>
                {out.topProducts.slice(0, 5).map((p) => (
                  <li key={p.title}>
                    <b>{p.title}</b>
                    <span>{p.orders.toLocaleString("en-IN")} orders &middot; {p.units.toLocaleString("en-IN")} units</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {out.warnings.length > 0 && (
            <ul className="hc-importwarn">
              {out.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
