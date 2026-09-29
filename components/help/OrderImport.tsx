"use client";
import { useRef, useState } from "react";
import { analyse, readOrders, type OrderInsight } from "@/lib/help/orders";
import { freqWord } from "@/lib/help/sim";

/** Read a store's own order export and propose plans from it.
 *
 *  The file is parsed in the browser and never sent anywhere. That is not a nicety: it is the
 *  only reason it is reasonable to drop a customer list into a help page, and it is said on
 *  the screen so nobody has to take it on trust. */
export default function OrderImport({ onApply }: {
  onApply: (v: { everyDays: number; runs: number[]; products: string[] }) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [out, setOut] = useState<OrderInsight | null>(null);

  async function read(f: File) {
    setBusy(true); setErr(null); setOut(null);
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
                })}>
                Use this cadence and these runs
              </button>
            </div>
          ) : (
            <p className="hc-note">
              Not enough repeat behaviour in this file to name a cadence. That is an answer too: it
              usually means the window is too short rather than that nobody reorders.
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
