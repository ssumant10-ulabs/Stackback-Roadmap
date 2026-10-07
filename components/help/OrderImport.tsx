"use client";
import { useRef, useState } from "react";
import { analyse, brandFromFilename, guessCategory, readOrders, type OrderInsight } from "@/lib/help/orders";
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
    everyDays: number; runs: number[]; products: string[];
    /* Everything else the file can answer, so one click fills the form rather than two
       fields of it. A ladder the store's own customers have already accepted beats one off
       a category table, which is the whole argument for reading the file at all. */
    discountMin: number | null; discountMax: number | null; scale: string | null;
    category: string | null; brand: string | null;
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
              <p>
                They reorder about <b>{freqWord(out.suggestEveryDays).toLowerCase()}</b>, from{" "}
                {out.gapSample.toLocaleString("en-IN")} intervals across {out.repeatCustomers.toLocaleString("en-IN")}{" "}
                repeat {out.repeatCustomers === 1 ? "customer" : "customers"}.
                {out.suggestRuns.length > 0 && <> Run lengths of <b>{out.suggestRuns.join(", ")}</b> cover roughly three months, six months and a year at that cadence.</>}
              </p>
              <button type="button" className="hc-btn hc-sugapply" data-noexport="true"
                onClick={() => onApply({
                  everyDays: out.suggestEveryDays as number,
                  runs: out.suggestRuns,
                  products: out.topProducts.slice(0, 3).map((p) => p.title),
                  discountMin: out.discounts.bands[0]?.pct ?? out.discounts.medianPct,
                  discountMax: out.discounts.maxPct,
                  scale: bandFor(out),
                  category: guessCategory(out.topProducts),
                  brand: name ? brandFromFilename(name) : null,
                })}>
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
