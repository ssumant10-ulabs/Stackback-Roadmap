"use client";
import { useMemo, useState } from "react";
import {
  DEFAULT_CONFIG, FREQUENCIES, fmtDate, money, price, schedule, startOf,
  type SimConfig,
} from "@/lib/help/sim";
import { APP_NAME } from "@/lib/help/types";

/** The flows merchants ask about most, made playable instead of described.
 *
 *  It replaced a set of screenshots. Screenshots of an admin go stale the week after they
 *  are taken and cannot answer "what if we ran it fortnightly at 20 percent", which is the
 *  actual question underneath most of these tickets. Change a number here and the widget,
 *  the checkout and the order schedule all move together, which is the part that is hard
 *  to hold in your head and easy to get wrong on a call. */
export default function Simulator() {
  const [c, setC] = useState<SimConfig>(DEFAULT_CONFIG);
  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => setC({ ...c, [k]: v });

  const p = useMemo(() => price(c), [c]);
  const orders = useMemo(() => schedule(c), [c]);
  const immediate = orders.filter((o) => o.immediate).length;

  return (
    <section>
      <p className="hc-eyebrow">Simulate</p>
      <h1 className="hc-h1">What a subscription actually does</h1>
      <p className="hc-blurb">
        Set it up the way you are thinking of selling it. The widget, the checkout and the orders
        {" "}{APP_NAME} creates in the background all move together, so you can see what a frequency
        or a discount does before you commit to it.
      </p>

      <div className="hc-simbar">
        <label className="hc-field">
          <span>Product</span>
          <input value={c.productName} onChange={(e) => set("productName", e.target.value)} maxLength={60} />
        </label>
        <label className="hc-field hc-simnum">
          <span>One-time price</span>
          <input type="number" min={1} step={10} value={c.unitPrice}
            onChange={(e) => set("unitPrice", Math.max(1, +e.target.value || 0))} />
        </label>
        <label className="hc-field hc-simnum">
          <span>Deliveries</span>
          <input type="number" min={1} max={36} value={c.deliveries}
            onChange={(e) => set("deliveries", Math.min(36, Math.max(1, +e.target.value || 1)))} />
        </label>
        <label className="hc-field">
          <span>Frequency</span>
          <select value={c.everyDays} onChange={(e) => set("everyDays", +e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f.days} value={f.days}>{f.label}</option>)}
          </select>
        </label>
        <label className="hc-field hc-simnum">
          <span>Discount %</span>
          <input type="number" min={0} max={90} value={c.discountPct}
            onChange={(e) => set("discountPct", Math.min(90, Math.max(0, +e.target.value || 0)))} />
        </label>
        <label className="hc-field">
          <span>Payment</span>
          <select value={c.mode} onChange={(e) => set("mode", e.target.value as SimConfig["mode"])}>
            <option value="prepaid">Prepaid, paid upfront</option>
            <option value="payg">Pay as you go</option>
          </select>
        </label>
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
      </div>

      {/* ---------- stage 1: the product page ---------- */}
      <h2 className="hc-h2">1 · What the customer sees on the product page</h2>
      <div className="hc-widget">
        <p className="hc-wprod">{c.productName}</p>
        <label className="hc-wopt">
          <input type="radio" readOnly checked={false} />
          <span className="hc-woptl">One time purchase</span>
          <b>{money(p.oneTimePerDelivery)}</b>
        </label>
        <label className="hc-wopt on">
          <input type="radio" readOnly checked />
          <span className="hc-woptl">
            Subscribe and save
            {c.discountPct > 0 && <em className="hc-wsave">Save {c.discountPct}%</em>}
            <small>
              {FREQUENCIES.find((f) => f.days === c.everyDays)?.label.toLowerCase()},
              {" "}{c.deliveries} {c.deliveries === 1 ? "delivery" : "deliveries"}
            </small>
          </span>
          <b>
            {money(p.perDelivery)}
            {c.discountPct > 0 && <s>{money(p.oneTimePerDelivery)}</s>}
          </b>
        </label>
        <div className="hc-wtotal">
          <span>{c.mode === "prepaid" ? "Charged today" : "Charged today, first delivery"}</span>
          <b>{money(p.chargedNow)}</b>
        </div>
        {p.chargedLater > 0 && (
          <div className="hc-wtotal sub">
            <span>Then {money(p.perDelivery)} per delivery, {c.deliveries - 1} more</span>
            <b>{money(p.chargedLater)}</b>
          </div>
        )}
        {p.savings > 0 && <p className="hc-wnote">Customer saves {money(p.savings)} over {money(p.oneTimeTotal)} at the one-time price.</p>}
      </div>

      {/* ---------- stage 2: checkout ---------- */}
      <h2 className="hc-h2">2 · What checkout collects</h2>
      <div className="hc-cards hc-simcards">
        <div className="hc-simcard">
          <b>{money(p.chargedNow)}</b>
          <span>charged at checkout</span>
          <p>{c.mode === "prepaid"
            ? "The whole run is paid now and sits as store credit against this subscription. Each delivery draws it down as its order is created."
            : "Only the first delivery is paid now. Every later one is invoiced ahead of its own lead time."}</p>
        </div>
        <div className="hc-simcard">
          <b>{c.deliveries}</b>
          <span>deliveries on the contract</span>
          <p>The contract holds the timeline. It is not an order and it never ships; it is the record the deliveries are generated from.</p>
        </div>
        <div className="hc-simcard">
          <b>{orders.length + 1}</b>
          <span>Shopify orders in total</span>
          <p>One parent that takes the money, plus one child per delivery. This is the count that surprises people, and it is by design.</p>
        </div>
      </div>

      {/* ---------- stage 3: the orders ---------- */}
      <h2 className="hc-h2">3 · The orders {APP_NAME} creates in Shopify</h2>

      <div className="hc-parent">
        <div className="hc-ohead">
          <span className="hc-otag warn">ORDER 1 · PARENT</span>
          <b>{money(p.chargedNow)}</b>
        </div>
        <p>Created at checkout. Collects the payment and holds the contract.</p>
        <ul className="hc-oflags">
          <li>Carries a helper line item, not the real product</li>
          <li>Auto fulfilled, shipping not required</li>
          <li>Moves no stock</li>
          <li>Filter it out of revenue and inventory reports, or you will count the money twice</li>
        </ul>
      </div>

      {immediate > 0 && (
        <p className="hc-simwarn">
          {immediate === 1 ? "One delivery is" : `${immediate} deliveries are`} already inside the
          {" "}{c.leadDays}-day lead time, so {immediate === 1 ? "its order is" : "their orders are"} created
          straight away. That is the case merchants report as a duplicate order: it is the first delivery,
          not a second charge. Push the first delivery date out to see the normal pattern.
        </p>
      )}

      <div className="hc-otable">
        <table className="hc-table">
          <thead>
            <tr>
              <th>Delivery</th>
              <th>Delivery date</th>
              {c.mode === "payg" && <th>Invoice sent</th>}
              <th>Order created</th>
              <th>Amount</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.n}>
                <td><span className="hc-otag ok">ORDER {o.n + 1}</span> Delivery {o.n}</td>
                <td>{fmtDate(o.deliveryDate)}</td>
                {c.mode === "payg" && <td>{o.invoicedOn ? fmtDate(o.invoicedOn) : "At checkout"}</td>}
                <td>{fmtDate(o.createdOn)}{o.immediate && <em className="hc-onow">immediately</em>}</td>
                <td className="hc-num">{money(o.amount)}</td>
                <td>{o.paidAtCheckout
                  ? <span className="hc-pill p-w">Paid</span>
                  : <span className="hc-pill p-l">On invoice</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="hc-oflags hc-childnote">
        <li>Each child order carries the <b>real product</b> and is left unfulfilled, so your 3PL ships it</li>
        <li>Each carries the shipping, which is why shipping is charged on the delivery and not on the parent</li>
        <li>Orders appear <b>{c.leadDays} {c.leadDays === 1 ? "day" : "days"} before</b> the delivery date. That is
          {" "}<code>time_to_delivery</code>, a per-store setting. Tell us the number your warehouse needs</li>
        {c.mode === "payg" && <li>An <b>unpaid</b> pay as you go delivery cannot be pushed, by us or by you. That is what stops anything shipping unpaid</li>}
      </ul>

      <p className="hc-note hc-simfoot">
        This models the behaviour the answers describe. It is a teaching tool, not a preview of your store:
        it does not read your catalogue, your shipping rates or your tax settings.
      </p>
    </section>
  );
}
