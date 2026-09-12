"use client";
import { useMemo, useState } from "react";
import {
  DEFAULT_CONFIG, fmtDate, money, price, schedule, startOf,
  type Mode, type SimConfig,
} from "@/lib/help/sim";
import { APP_NAME } from "@/lib/help/types";

/** Step three: what a checkout becomes in your admin.
 *
 *  Two surfaces, because merchants use both and confuse them. Shopify's Orders list is where
 *  the money and the fulfilment live, one row per order. StackBack's Purchase Contracts is
 *  where the subscription lives, one row per customer commitment with its deliveries counted
 *  off against it. A run of six is six rows in one and one row in the other, and not knowing
 *  that is how "why do I have seven orders" starts.
 *
 *  The difference between prepaid and pay as you go is drawn rather than described: on pay as
 *  you go an unpaid delivery has no order at all, so its row has no number. */
export default function Simulator({ config, onConfig }: {
  config?: SimConfig; onConfig?: (next: SimConfig) => void;
}) {
  const [own, setOwn] = useState<SimConfig>(DEFAULT_CONFIG);
  const c = config ?? own;
  const write = onConfig ?? setOwn;
  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => write({ ...c, [k]: v });

  const [surface, setSurface] = useState<"shopify" | "contracts">("shopify");

  const prepaid = useMemo(() => ({ p: price({ ...c, mode: "prepaid" }), rows: schedule(c, "prepaid") }), [c]);
  const payg = useMemo(() => ({ p: price({ ...c, mode: "payg" }), rows: schedule(c, "payg") }), [c]);

  return (
    <section>
      <p className="hc-blurb hc-flowlede">
        Checkout creates <b>two orders</b>, whatever the run length, and one subscription. Everything
        after that appears later, and only when it is paid for.
      </p>

      <ol className="hc-atcheckout">
        <li>
          <span className="hc-otag warn">PARENT</span>
          <b>Holds the subscription</b>
          <p>
            Carries the contract details, not the real product. <b>Auto fulfilled by default</b> and
            marked <b>shipping not required</b>, so your warehouse and inventory system do not pick it
            up. Filter it out of revenue reports or the money is counted twice.
          </p>
        </li>
        <li>
          <span className="hc-otag ok">CHILD 1</span>
          <b>The real order</b>
          <p>
            The one that ships. Written in the same minute as the parent, which is the pair most often
            reported to us as a duplicate. It is not: one takes the money, one carries the goods.
          </p>
        </li>
        <li className="hc-later">
          <span className="hc-otag muted">LATER</span>
          <b>Nothing else exists yet</b>
          <p>
            Each remaining delivery&rsquo;s order is created <b>{c.leadDays} days before its delivery
            date</b>, and only if that delivery is <b>paid for</b>. That is the whole difference between
            the two columns below.
          </p>
        </li>
      </ol>

      <div className="hc-simbar hc-simbar-order">
        <label className="hc-field hc-simnum">
          <span>Lead time, days</span>
          <input type="number" min={0} max={30} value={c.leadDays}
            onChange={(e) => set("leadDays", Math.min(30, Math.max(0, +e.target.value || 0)))} />
        </label>
        <label className="hc-field">
          <span>First delivery</span>
          <input type="date" value={c.startDate || startOf(c).toISOString().slice(0, 10)}
            onChange={(e) => set("startDate", e.target.value)} />
        </label>
        <p className="hc-simnote">
          Everything else comes from the plans you set in step one. These two are about your
          warehouse, so they live here.
        </p>
      </div>

      <div className="hc-surfaces" role="tablist" aria-label="Which screen">
        <button role="tab" aria-selected={surface === "shopify"}
          className={"hc-surface" + (surface === "shopify" ? " on" : "")}
          onClick={() => setSurface("shopify")}>
          <b>Shopify · Orders</b><em>One row per order. Money and fulfilment.</em>
        </button>
        <button role="tab" aria-selected={surface === "contracts"}
          className={"hc-surface" + (surface === "contracts" ? " on" : "")}
          onClick={() => setSurface("contracts")}>
          <b>{APP_NAME} · Purchase Contracts</b><em>One row per subscription. Deliveries counted off.</em>
        </button>
      </div>

      {surface === "shopify" ? (
        <>
          <div className="hc-modecols">
            <OrdersColumn mode="prepaid" c={c} p={prepaid.p} rows={prepaid.rows} />
            <OrdersColumn mode="payg" c={c} p={payg.p} rows={payg.rows} />
          </div>

          <ul className="hc-oflags hc-childnote">
            <li>The <b>parent</b> carries a helper line, not the real product. It is auto fulfilled, moves no stock, and must be filtered out of revenue and inventory reports or the money is counted twice</li>
            <li>Each <b>child</b> carries the real product, is left unfulfilled, and carries the shipping. Your 3PL ships these</li>
            <li>Orders after the first two appear <b>{c.leadDays} {c.leadDays === 1 ? "day" : "days"} before</b> their
              delivery date, not at checkout. That is <code>time_to_delivery</code>, a per-store setting</li>
            <li>On pay as you go, <b>no Shopify order exists</b> for an unpaid delivery. It is not an unpaid order sitting in your admin, it is not there at all, which is what stops anything shipping unpaid</li>
          </ul>
        </>
      ) : (
        <Contracts c={c} prepaidRows={prepaid.rows} paygRows={payg.rows} />
      )}

      <p className="hc-note hc-simfoot">
        This models the behaviour your answers describe. It is a teaching tool, not a preview of your
        store: it does not read your catalogue, your shipping rates or your tax settings.
      </p>
    </section>
  );
}

function OrdersColumn({ mode, c, p, rows }: {
  mode: Mode; c: SimConfig;
  p: ReturnType<typeof price>; rows: ReturnType<typeof schedule>;
}) {
  const prepaid = mode === "prepaid";
  const base = 44521;
  // Exists today, not paid for. Prepaid pays for the whole run at checkout and still has two
  // orders, which is the thing this column is here to show.
  const live = rows.filter((r) => r.existsToday).length;
  return (
    <div className="hc-modecol">
      <div className="hc-modehead">
        <b>{prepaid ? "Prepaid" : "Pay as you go"}</b>
        <span>
          {money(p.chargedNow)} at checkout ·{" "}
          <b>{live + 1} of {c.deliveries + 1}</b> orders exist today
          {prepaid ? ", the rest arrive on schedule" : ", the rest wait on payment"}
        </span>
      </div>

      <div className="hc-shopscroll">
        <table className="hc-shoptable">
          <thead>
            <tr><th>Order</th><th>Created</th><th className="hc-num">Total</th><th>Payment</th><th>Fulfilment</th><th>Tags</th></tr>
          </thead>
          <tbody>
            <tr className="hc-parentrow">
              <td><b>#{base}</b></td>
              <td>{fmtDate(rows[0].createdOn)}<em>at checkout</em></td>
              <td className="hc-num"><b>{money(p.chargedNow)}</b></td>
              <td><Dot tone="ok" />Paid</td>
              <td><Dot tone="ok" />Fulfilled<em>shipping not required</em></td>
              <td><Tag>parent</Tag></td>
            </tr>
            {rows.map((o) => (
              <tr key={o.n} className={o.withParent ? "hc-togetherrow" : o.existsToday ? "" : "hc-pendingrow"}>
                <td>{o.existsToday ? <b>#{base + o.n}</b> : <span className="hc-noorder">none yet</span>}</td>
                <td>
                  {o.existsToday
                    ? fmtDate(o.createdOn)
                    : <b className={o.paidAtCheckout ? "hc-sched" : "hc-await"}>
                        {o.paidAtCheckout ? `Due ${fmtDate(o.createdOn)}` : "Waits for payment"}
                      </b>}
                  {o.withParent
                    ? <em className="hc-same">same minute as the parent</em>
                    : <em>delivers {fmtDate(o.deliveryDate)}</em>}
                </td>
                <td className="hc-num">{money(o.amount)}</td>
                <td>{o.paidAtCheckout
                  ? <><Dot tone="ok" />Paid</>
                  : <><Dot tone="warn" />Invoice {fmtDate(o.invoicedOn ?? o.createdOn)}</>}</td>
                <td>{o.existsToday
                  ? <><Dot tone="warn" />Unfulfilled<em>your 3PL ships this</em></>
                  : <span className="hc-noorder">not created yet</span>}</td>
                <td>{o.existsToday
                  ? <><Tag>child</Tag><Tag>subscription</Tag></>
                  : <span className="hc-noorder">&mdash;</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={"hc-modekey " + (prepaid ? "ok" : "warn")}>
        {prepaid
          ? <>Every delivery is <b>already paid</b>, so each order is created automatically {c.leadDays} days before its delivery, drawing down the store credit. Nothing is waiting on the customer.</>
          : <>Only the first is paid. Each later delivery is invoiced {3 + c.leadDays} days ahead, and its order reaches Shopify <b>only once that invoice is paid</b>. An unpaid delivery has no order at all.</>}
      </p>
    </div>
  );
}

/** The StackBack side. Same run, one row, with the deliveries counted off against it. */
function Contracts({ c, prepaidRows, paygRows }: {
  c: SimConfig;
  prepaidRows: ReturnType<typeof schedule>;
  paygRows: ReturnType<typeof schedule>;
}) {
  const [tab, setTab] = useState<"product" | "bundle">("product");
  const [status, setStatus] = useState("All");
  const done = (rows: ReturnType<typeof schedule>) => rows.filter((r) => r.paidAtCheckout).length;

  const contracts = [
    { code: "PC-1042", customer: "Aarti Menon", mode: "Prepaid", completed: done(prepaidRows), status: "Active" },
    { code: "PC-1043", customer: "Rahul Shah", mode: "Pay as you go", completed: done(paygRows), status: "Active" },
    { code: "PC-1039", customer: "Nisha Rao", mode: "Prepaid", completed: c.deliveries, status: "Paused" },
  ];

  const shown = status === "All" ? contracts : contracts.filter((x) => x.status === status);

  return (
    <div className="hc-contracts">
      <div className="hc-ctabs">
        {(["product", "bundle"] as const).map((t) => (
          <button key={t} className={"hc-ctab" + (tab === t ? " on" : "")} onClick={() => setTab(t)}>
            {t === "product" ? "Product Subscriptions" : "Bundle Subscriptions"}
          </button>
        ))}
      </div>

      <div className="hc-cfilters">
        {["All", "Active", "Paused", "Cancelled"].map((f) => (
          <button key={f} className={"hc-cfilter" + (status === f ? " on" : "")} onClick={() => setStatus(f)}>{f}</button>
        ))}
      </div>

      {tab === "bundle" ? (
        <p className="hc-cempty">No bundle orders yet. Bundles get their own tab, and their own contracts.</p>
      ) : (
        <div className="hc-shopscroll">
          <table className="hc-shoptable hc-ctable">
            <thead>
              <tr><th>Subscription Code</th><th>Customer</th><th>Product</th><th>Orders</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.code}>
                  <td><b>{x.code}</b><em>{x.mode}</em></td>
                  <td>{x.customer}</td>
                  <td>{c.productName}</td>
                  <td>
                    <b>{x.completed} of {c.deliveries}</b>
                    <span className="hc-cbar"><i style={{ width: `${(x.completed / c.deliveries) * 100}%` }} /></span>
                  </td>
                  <td><span className={"hc-pill " + (x.status === "Active" ? "p-w" : x.status === "Paused" ? "p-l" : "p-n")}>{x.status}</span></td>
                  <td><span className="hc-noorder">View · Edit</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="hc-modefoot">
        Showing {tab === "bundle" ? 0 : shown.length} of {tab === "bundle" ? 0 : contracts.length} subscriptions.
        One row per commitment, however many orders it has produced. This is where you pause, skip, swap or
        reschedule, and the Shopify orders follow from what you do here.
      </p>
    </div>
  );
}

const Tag = ({ children }: { children: React.ReactNode }) => <i className="hc-shoptag">{children}</i>;
const Dot = ({ tone }: { tone: "ok" | "warn" }) => <i className={"hc-shopdot " + tone} />;
