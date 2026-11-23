"use client";
import { useMemo, useState } from "react";
import {
  BUNDLE_NOTE, CUSTOMER_TAGS, DEFAULT_CONFIG, FIRST_DELIVERY_LABEL, FREQUENCIES, MODE_LABEL, ORDER_TAGS, fmtDate, freqWord, money,
  parentOrder, parentTags, price, runLabel, schedule, startOf,
  type FirstDelivery, type Mode, type OrderLine, type SimConfig,
} from "@/lib/help/sim";
import { APP_NAME } from "@/lib/help/types";

/** One invented order number, shared by the drawn order and the list, so the two are
 *  visibly the same order rather than two examples that happen to sit together. */
const ORDER_NO = 44521;

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

  const [surface, setSurface] = useState<"shopify" | "contracts" | "customer">("shopify");
  const flow: FirstDelivery = c.firstDelivery ?? "same";

  const prepaid = useMemo(() => ({ p: price({ ...c, mode: "prepaid" }), rows: schedule(c, "prepaid") }), [c]);
  const payg = useMemo(() => ({ p: price({ ...c, mode: "payg" }), rows: schedule(c, "payg") }), [c]);
  const autopay = useMemo(() => ({ p: price({ ...c, mode: "autopay" }), rows: schedule(c, "autopay") }), [c]);
  /* Which payment type the drawn order is showing. The three are genuinely different orders,
     not the same order with a different badge: AutoPay's carries the real goods from the
     start and never gets converted.
     It opens on whatever was chosen on the widget: picking pay as you go and then being
     shown a prepaid order is the one thing this screen exists to stop. The tabs here still
     move it, because comparing the three side by side is the other reason to be on it. */
  const [drawnOverride, setDrawnOverride] = useState<Mode | null>(null);
  const drawn = drawnOverride ?? c.mode;
  const setDrawn = setDrawnOverride;
  /* The three payment types are the point of this screen, so picking one here picks it
     everywhere: the bar above draws its prices from `c.mode`. */
  const pickMode = (m: Mode) => { setDrawnOverride(m); set("mode", m); };
  /** Which of the two order shapes is being drawn. A delivery order looks nothing like the
      checkout order, and until now the only place it appeared was as a row in a list. */
  const [which, setWhich] = useState<"parent" | "child">("parent");

  const p = price(c);

  return (
    <section>
      <header className="hc-pagehead">
        <p className="hc-eyebrow">Simulate an order</p>
        <h1 className="hc-h1">What one checkout creates</h1>
        <p className="hc-blurb">
          Pick how your store ships the first delivery, set a plan, and see the orders in Shopify, the
          subscription in StackBack and what your customer sees.
        </p>
      </header>

      {/* Settings › First delivery. The two flows a store can run, side by side, because the
          question behind most "why do I have two orders" tickets is which one the store is on. */}
      <div className="hc-flowpick" role="radiogroup" aria-label="First delivery setting">
        <p className="hc-flowpickh">Your <b>Settings › First delivery</b> setting</p>
        <div className="hc-flowopts">
          {(["same", "separate"] as FirstDelivery[]).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={flow === f}
              className={"hc-flowopt" + (flow === f ? " on" : "")} onClick={() => set("firstDelivery", f)}>
              <b>{FIRST_DELIVERY_LABEL[f].name}</b>
              <em>&ldquo;{FIRST_DELIVERY_LABEL[f].setting}&rdquo;</em>
              <span>{f === "same"
                ? "Delivery 1 ships from the order the customer paid on. One order at checkout."
                : "Delivery 1 ships from its own order, created seconds after checkout. Two orders at checkout."}</span>
            </button>
          ))}
        </div>
      </div>

      {/* The plan the orders are drawn from, as controls rather than as a widget. The widget
          belongs to the widget module; this screen is about what a checkout BECOMES, and a
          second copy of the storefront on top of it was the premise taking up half the page
          above the thing being explained. */}
      <div className="hc-simbar hc-simbar-order">
        <label className="hc-field">
          <span>Deliver</span>
          <select value={c.everyDays} onChange={(e) => set("everyDays", +e.target.value)}>
            {FREQUENCIES.map((f) => <option key={f.days} value={f.days}>{f.label}</option>)}
          </select>
        </label>
        <label className="hc-field hc-simnum">
          <span>Deliveries</span>
          <input type="number" min={1} max={24} value={c.deliveries}
            onChange={(e) => set("deliveries", Math.min(24, Math.max(1, +e.target.value || 1)))} />
        </label>
        <label className="hc-field hc-simnum">
          <span>Price per delivery</span>
          <input type="number" min={1} value={c.unitPrice}
            onChange={(e) => set("unitPrice", Math.max(1, +e.target.value || 0))} />
        </label>
        <label className="hc-field hc-simnum">
          <span>Discount, %</span>
          <input type="number" min={0} max={60} value={c.discountPct}
            onChange={(e) => set("discountPct", Math.min(60, Math.max(0, +e.target.value || 0)))} />
        </label>
        <label className="hc-field hc-simnum">
          <span>Time to delivery, days</span>
          <input type="number" min={0} max={30} value={c.leadDays}
            onChange={(e) => set("leadDays", Math.min(30, Math.max(0, +e.target.value || 0)))} />
        </label>
        <label className="hc-field">
          <span>First delivery date</span>
          <input type="date" value={c.startDate || startOf(c).toISOString().slice(0, 10)}
            onChange={(e) => set("startDate", e.target.value)} />
        </label>
      </div>
      <ol className="hc-atcheckout">
        <li>
          <span className="hc-otag ok">AT CHECKOUT</span>
          <b>One order takes the money</b>
          <p>
            The customer pays once. That order is tagged <code>parent</code> and holds a placeholder
            line: one unit per delivery paid for, so the payment sits on one line.
          </p>
        </li>
        {flow === "same" ? (
          <li>
            <span className="hc-otag ok">MINUTES LATER</span>
            <b>Delivery 1 is added to that same order</b>
            <p>
              We edit the order: the placeholder drops by one and delivery 1&rsquo;s product is added.
              Your warehouse ships it from this order. The old line shows under <b>Removed</b>, which is
              Shopify keeping history, not a cancellation.
            </p>
          </li>
        ) : (
          <li>
            <span className="hc-otag ok">SECONDS LATER</span>
            <b>Delivery 1 gets its own order</b>
            <p>
              A second order, tagged <code>child</code>, appears with delivery 1&rsquo;s product. Your
              warehouse ships that one. The <code>parent</code> keeps the placeholder, has no shipping
              and is fulfilled automatically, so it never reaches your warehouse.
            </p>
          </li>
        )}
        <li className="hc-later">
          <span className="hc-otag muted">LATER</span>
          <b>Each later delivery, when it is due</b>
          <p>
            Deliveries 2 onward become <b>their own orders</b>, {c.leadDays} days before each delivery
            date, and only once that delivery is <b>paid for</b>.
          </p>
        </li>
      </ol>

      <p className="hc-note hc-flowwas">
        {drawn === "autopay"
          ? <>AutoPay works the same on both settings: its first order already carries the real product, so there is nothing to add and no separate delivery 1 order.</>
          : <>Count revenue on <code>parent</code> orders only. <code>child</code> orders are deliveries the customer has already paid for.</>}
      </p>

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
        <button role="tab" aria-selected={surface === "customer"}
          className={"hc-surface" + (surface === "customer" ? " on" : "")}
          onClick={() => setSurface("customer")}>
          <b>What your customer sees</b><em>Thank-you page, emails and their portal.</em>
        </button>
      </div>

      {surface === "shopify" ? (
        <>
          <div className="hc-modepick" role="tablist" aria-label="Payment type">
            {(["prepaid", "payg", "autopay"] as Mode[]).map((m) => (
              <button key={m} role="tab" aria-selected={drawn === m}
                className={"hc-modepillb" + (drawn === m ? " on" : "")}
                onClick={() => pickMode(m)}>{MODE_LABEL[m]}</button>
            ))}
          </div>
          {/* Two orders, two shapes, and the second one is the one nobody has seen. The
              checkout order is the edited parent; every delivery after the first is its own
              order and looks nothing like it, which is the question the list below prompts
              and could not answer. */}
          <div className="hc-modepick hc-whichorder" role="tablist" aria-label="Which order">
            <button role="tab" aria-selected={which === "parent"}
              className={"hc-modepillb" + (which === "parent" ? " on" : "")}
              onClick={() => setWhich("parent")}>The checkout order (parent)</button>
            <button role="tab" aria-selected={which === "child"}
              className={"hc-modepillb" + (which === "child" ? " on" : "")}
              onClick={() => setWhich("child")}>A delivery order (child)</button>
          </div>

          {which === "parent" ? <ShopifyOrder c={c} mode={drawn} /> : <ShopifyChildOrder c={c} mode={drawn} />}

          <p className="hc-note hc-orderafter">
            {which === "parent"
              ? "That is one order in your admin. Below is the same run as a list, with the deliveries that become orders of their own later."
              : "Every delivery after the first is an order like that one. Below is the whole run as a list, so you can see when each of them appears."}
          </p>

          {/* One payment type at a time. Three columns side by side is a comparison nobody
              asked for while they are reading about the one they chose. */}
          <div className="hc-modecols one">
            {drawn === "prepaid" && <OrdersColumn mode="prepaid" c={c} p={prepaid.p} rows={prepaid.rows} />}
            {drawn === "payg" && <OrdersColumn mode="payg" c={c} p={payg.p} rows={payg.rows} />}
            {drawn === "autopay" && <OrdersColumn mode="autopay" c={c} p={autopay.p} rows={autopay.rows} />}
          </div>

          <div className="hc-tagtable">
            <p className="hc-tagtableh">Every tag we write</p>
            <table>
              <thead><tr><th>Order</th><th>Tags</th></tr></thead>
              <tbody>
                {(["prepaid", "payg", "autopay"] as Mode[]).flatMap((m) => [
                  <tr key={m + "-p"}>
                    <td>{MODE_LABEL[m]}<em>checkout order</em></td>
                    <td className="hc-tagcell">{parentTags(m, flow).map((t) => <Tag key={t}>{t}</Tag>)}</td>
                  </tr>,
                  <tr key={m + "-c"}>
                    <td>{MODE_LABEL[m]}<em>delivery order</em></td>
                    <td className="hc-tagcell">{ORDER_TAGS[m].delivery.map((t) => <Tag key={t}>{t}</Tag>)}</td>
                  </tr>,
                ])}
                <tr>
                  <td>The customer<em>not the order</em></td>
                  <td className="hc-tagcell">{CUSTOMER_TAGS.map((t) => <Tag key={t}>{t}</Tag>)}</td>
                </tr>
              </tbody>
            </table>
            <p className="hc-note">
              {BUNDLE_NOTE.replace(/`/g, "")} A live order also carries whatever the store&rsquo;s other
              apps write, which is none of the above.
            </p>
          </div>

          <ul className="hc-oflags hc-childnote">
            {flow === "same" && drawn !== "autopay" ? (
              <>
                <li>The checkout order carries <b>two kinds of line</b>: delivery 1&rsquo;s product, which your warehouse ships, and the placeholder for the deliveries still to come, marked <b>shipping not required</b> so nothing picks it up</li>
                <li>The order total does not move when we add delivery 1, so <b>revenue is counted once</b>, on this one order</li>
              </>
            ) : drawn !== "autopay" ? (
              <>
                <li>Two orders appear at checkout: the <code>parent</code> takes the money and ships nothing, the <code>child</code> ships delivery 1. <b>This is expected, not a duplicate</b></li>
                <li>Count revenue on the <code>parent</code> only. The delivery 1 <code>child</code> is paid for by it</li>
              </>
            ) : (
              <li>AutoPay&rsquo;s first order is placed by us through Razorpay with the real product on it, on either setting</li>
            )}
            <li>Every later delivery appears <b>{c.leadDays} {c.leadDays === 1 ? "day" : "days"} before</b> its
              delivery date, not at checkout. That is your <code>time_to_delivery</code> setting</li>
            <li>On pay as you go, an unpaid delivery has <b>no order at all</b>. That is what stops anything shipping unpaid</li>
          </ul>
        </>
      ) : surface === "contracts" ? (
        <Contracts c={c} prepaidRows={prepaid.rows} paygRows={payg.rows} />
      ) : (
        <>
          <div className="hc-modepick" role="tablist" aria-label="Payment type">
            {(["prepaid", "payg", "autopay"] as Mode[]).map((m) => (
              <button key={m} role="tab" aria-selected={drawn === m}
                className={"hc-modepillb" + (drawn === m ? " on" : "")}
                onClick={() => pickMode(m)}>{MODE_LABEL[m]}</button>
            ))}
          </div>
          <CustomerView c={c} mode={drawn} />
        </>
      )}

      <p className="hc-note hc-simfoot">
        This models the behaviour your answers describe. It is a teaching tool, not a preview of your
        store: it does not read your catalogue, your shipping rates or your tax settings.
      </p>
    </section>
  );
}

/** One subscription is one customer, so the column is not a variable. Named rather than left
 *  blank because an empty Customer column is the one thing Shopify's Orders index never has. */
const CUSTOMER = "Aarti Menon";

function OrdersColumn({ mode, c, p, rows }: {
  mode: Mode; c: SimConfig;
  p: ReturnType<typeof price>; rows: ReturnType<typeof schedule>;
}) {
  const base = ORDER_NO;
  const flow: FirstDelivery = mode === "autopay" ? "same" : (c.firstDelivery ?? "same");
  /* Deliveries that get an order of their own. On a single order delivery 1 is ON the
     checkout order; on a separate order it is the first child. */
  const children = rows.filter((r) => !r.onParent);
  const live = 1 + children.filter((r) => r.existsToday).length;
  const total = 1 + children.length;
  return (
    <div className="hc-modecol pl">
      <div className="hc-modehead">
        <b>{MODE_LABEL[mode]}</b>
        <span>
          <b>{live} of {total}</b> orders exist today.
          {" "}{money(p.chargedNow)} taken at checkout,{" "}
          {mode === "prepaid" ? "the rest arrive on schedule."
            : mode === "autopay" ? "the rest are debited on the mandate."
            : "the rest wait on payment."}
        </span>
      </div>

      <div className="hc-shopscroll">
        {/* Shopify's Orders index, not a table of ours. Same column order, same badges, same
            hairlines, on Polaris' own light ground in either theme: a merchant is being told
            what will be in their admin, and they recognise that screen by its look. */}
        <table className="pl-orders">
          <thead>
            <tr>
              <th>Order</th><th>Date</th><th>Customer</th><th className="pl-r">Total</th>
              <th>Payment status</th><th>Fulfillment status</th><th className="pl-r">Items</th><th>Tags</th>
            </tr>
          </thead>
          <tbody>
            <tr className="pl-orowsplit"><td colSpan={8}>Parent &middot; the checkout order</td></tr>
            <tr className="pl-orow pl-oparent">
              <td><b>#{base}</b></td>
              <td>{fmtDate(rows[0].createdOn)}<em>at checkout</em></td>
              <td>{CUSTOMER}</td>
              <td className="pl-r"><b>{money(p.chargedNow)}</b></td>
              <td><span className="pl-badge ok"><i />Paid</span></td>
              <td>
                <span className="pl-badge ok"><i />Fulfilled</span>
                <em>{flow === "same" ? "delivery 1 ships from here" : "auto-fulfilled, ships nothing"}</em>
              </td>
              <td className="pl-r">{c.deliveries === 1 ? "1 item" : `${c.deliveries} items`}</td>
              <td className="pl-otags">{parentTags(mode, flow).map((t) => <Tag key={t}>{t}</Tag>)}</td>
            </tr>
            <tr className="pl-orowsplit"><td colSpan={8}>
              Child &middot; {flow === "same" ? "one order per delivery after the first" : "one order per delivery, delivery 1 included"}
            </td></tr>
            {children.map((o) => (
              <tr key={o.n} className={"pl-orow" + (o.existsToday ? "" : " pl-opending")}>
                <td>{o.existsToday ? <b>#{base + o.n}</b> : <span className="pl-onone">none yet</span>}</td>
                <td>
                  {o.existsToday
                    ? <>{fmtDate(o.createdOn)}{o.n === 1 && <em>seconds after checkout</em>}</>
                    : <b className={o.paidAtCheckout ? "pl-sched" : "pl-await"}>
                        {o.paidAtCheckout ? `Due ${fmtDate(o.createdOn)}` : "Waits for payment"}
                      </b>}
                  <em>delivers {fmtDate(o.deliveryDate)}</em>
                </td>
                <td>{CUSTOMER}</td>
                <td className="pl-r">{money(o.amount)}</td>
                <td>{o.paidAtCheckout
                  ? <span className="pl-badge ok"><i />{mode === "autopay" ? "Debited" : "Paid"}</span>
                  : <span className="pl-badge warn"><i />Invoice {fmtDate(o.invoicedOn ?? o.createdOn)}</span>}</td>
                <td>{o.existsToday
                  ? <><span className="pl-badge warn"><i />Unfulfilled</span><em>your 3PL ships this</em></>
                  : <span className="pl-onone">not created yet</span>}</td>
                <td className="pl-r">{o.existsToday ? "1 item" : <span className="pl-onone">&mdash;</span>}</td>
                <td className="pl-otags">{o.existsToday
                  ? ORDER_TAGS[mode].delivery.map((t) => <Tag key={t}>{t}</Tag>)
                  : <span className="pl-onone">&mdash;</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={"hc-modekey " + (mode === "payg" ? "warn" : "ok")}>
        {mode === "prepaid"
          ? <>{flow === "same" ? "Delivery 1 is on the checkout order." : "Delivery 1 ships from its own order, created at checkout."} Every later delivery is <b>already paid</b>, so its order is created automatically {c.leadDays} days before its delivery, drawing down the store credit. Nothing waits on the customer.</>
          : mode === "payg"
          ? <>{flow === "same" ? "Delivery 1 is on the checkout order" : "Delivery 1 ships from its own order"} and is the only one paid. Each later delivery is invoiced {3 + c.leadDays} days ahead, and its order reaches Shopify <b>only once that invoice is paid</b>. An unpaid delivery has no order at all.</>
          : <>The order above was placed by us through Razorpay and carries the real goods already, because the money moved inside the mandate authorisation. Every later delivery is <b>debited on the mandate</b> the day before its order is cut, so nothing waits on the customer and no invoice is sent.</>}
      </p>
    </div>
  );
}


/** The checkout order, as Shopify draws it.
 *
 *  Rendered on Polaris' own light surface whatever theme this module is on, the same way the
 *  widget preview renders in the store's colours: a merchant recognises this screen by its
 *  look, and a dark-mode version of it is a screen they have never seen. Metrics and wording
 *  follow a real order, down to Removed keeping the pre-edit line.
 */
function ShopifyOrder({ c, mode }: { c: SimConfig; mode: Mode }) {
  const o = useMemo(() => parentOrder(c, mode, c.productName || "Your product"), [c, mode]);
  const num = ORDER_NO;
  const date = fmtDate(startOf(c));

  return (
    <div className="pl">
      <div className="pl-top">
        <div className="pl-titlerow">
          <span className="pl-back">&lsaquo;</span>
          <h3>#{num}</h3>
          <span className="pl-badge ok"><i />Paid</span>
          <span className="pl-badge ok"><i />Fulfilled</span>
          <span className="pl-badge">Archived</span>
        </div>
        <p className="pl-sub">{date} from Online Store</p>
      </div>

      <div className="pl-grid">
        <div className="pl-main">
          {o.shipping ? (
            <section className="pl-card">
              <header className="pl-cardh">
                <b><span className="pl-fico">&#10003;</span>Fulfilled</b>
                <span className="pl-muted">#{num}-F2</span>
                <span className="pl-chip">Confirmed</span>
              </header>
              <p className="pl-line2">{date}<span className="pl-loc">&#9679; Your 3PL</span></p>
              <p className="pl-line2">Tracking number: <a>Track package</a></p>
              <Item l={o.shipping} />
            </section>
          ) : (
            <p className="pl-note">
              Nothing on this order ships. With <b>Create a separate order</b>, delivery 1&rsquo;s product
              goes on order #{num + 1}, created seconds after this one. This order only holds the payment.
            </p>
          )}

          {!o.held ? (
            <p className="pl-note">
              {mode === "autopay"
                ? "One fulfilment, not two. AutoPay\u2019s order carries the real goods from the start, because the money moved inside the mandate authorisation, so there is no placeholder line to hold the run and nothing to convert."
                : "One fulfilment, not two. Pay as you go paid for one delivery, so the placeholder held one unit, and converting it consumed the whole line. It moves to Removed rather than staying on the order."}
            </p>
          ) : (
            <section className="pl-card">
              <header className="pl-cardh">
                <b><span className="pl-fico">&#10003;</span>Fulfilled</b>
                <span className="pl-muted">#{num}-F1</span>
              </header>
              <p className="pl-line2">{date}<span className="pl-flag">&#8856; Shipping not required</span></p>
              {o.held
                ? <Item l={o.held} />
                : <p className="pl-empty">Nothing held: on pay as you go the order pays for one delivery.</p>}
            </section>
          )}

          {o.converted && o.removed && (
            <section className="pl-card pl-removed">
              <header className="pl-cardh"><b>Removed</b></header>
              <Item l={o.removed} dim />
            </section>
          )}

          <section className="pl-card">
            <header className="pl-cardh"><b><span className="pl-fico">&#10003;</span>Paid</b></header>
            <table className="pl-tot">
              <tbody>
                <tr><td>Original order</td><td>{date}</td><td className="pl-r">{money(o.total)}</td></tr>
                <tr><td>Subtotal</td><td>{o.held && o.shipping ? 2 : 1} items</td><td className="pl-r">{money(o.subtotal)}</td></tr>
                <tr><td>Discounts</td><td>Subscription</td><td className="pl-r">-{money(o.discount)}</td></tr>
                <tr><td>Taxes</td><td>Tax details</td><td className="pl-r">Included</td></tr>
                <tr className="pl-totrow"><td><b>Paid</b></td><td /><td className="pl-r"><b>{money(o.total)}</b></td></tr>
              </tbody>
            </table>
          </section>
        </div>

        <aside className="pl-side">
          <section className="pl-card">
            <header className="pl-cardh"><b>Customer</b></header>
            <p className="pl-link">Your customer</p>
            <p className="pl-muted">1 order</p>
          </section>
          <section className="pl-card">
            <header className="pl-cardh"><b>Tags</b></header>
            <div className="pl-tags">{o.tags.map((t) => <span key={t}>{t}</span>)}</div>
            <p className="pl-muted pl-tagnote">
              {o.converted
                ? <><code>sb-delivery-1-converted</code> is what stops the job running twice, and the
                    value tag records what delivery one was worth.</>
                : mode !== "autopay"
                ? <>No conversion tags: with a separate order nothing is added to this one, so there is nothing to mark.</>
                : <>No conversion tags: nothing was converted. <code>autopay</code> and{" "}
                    <code>razorpay</code> are written when we place the order, <code>parent</code> once
                    the contract exists.</>}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** One line item, Polaris' own two-column row. */
function Item({ l, dim }: { l: OrderLine; dim?: boolean }) {
  return (
    <div className={"pl-item" + (dim ? " dim" : "")}>
      <span className="pl-thumb" />
      <div className="pl-itemmain">
        <b>{l.title}</b>
        {l.sub && <em>{l.sub}</em>}

      </div>
      <span className="pl-price">
        {money(l.unit)}
        {l.was && l.was > l.unit && <s>{money(l.was)}</s>}
      </span>
      <span className="pl-qty">&times; {l.qty}</span>
      <span className="pl-tot1">{money(l.unit * l.qty)}</span>
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
    <div className="pl hc-contracts">
      <div className="pl-top">
        <div className="pl-titlerow"><h3>Purchase Contracts</h3></div>
        <p className="pl-sub">StackBack &rsaquo; Purchase Contracts</p>
      </div>
      <div className="pl-card">
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
      </div>

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

/** A delivery order, as Shopify draws it.
 *
 *  Deliveries two onward are ordinary orders: one real line at the plan price, one
 *  fulfilment, the child tags, created inside the lead window. No placeholder, no edit, no
 *  Removed line, because there is nothing to convert. Drawn because the list above says a
 *  delivery "becomes an order of its own" and a merchant's next question is what that order
 *  looks like in their admin. */
function ShopifyChildOrder({ c, mode }: { c: SimConfig; mode: Mode }) {
  const p = price({ ...c, mode });
  const rows = schedule(c, mode);
  /* The second delivery, which is the first one that gets an order of its own. */
  const row = rows[1] || rows[0];
  const num = ORDER_NO + (row?.n ?? 1);
  const created = fmtDate(row.createdOn);
  const delivers = fmtDate(row.deliveryDate);
  const paid = row.paidAtCheckout;

  return (
    <div className="pl">
      <div className="pl-top">
        <div className="pl-titlerow">
          <span className="pl-back">&lsaquo;</span>
          <h3>#{num}</h3>
          <span className="pl-badge ok"><i />Paid</span>
          <span className="pl-badge warn"><i />Unfulfilled</span>
        </div>
        <p className="pl-sub">{created} from {mode === "autopay" ? "StackBack, on the mandate" : "StackBack"}</p>
      </div>

      <div className="pl-grid">
        <div className="pl-main">
          <section className="pl-card">
            <header className="pl-cardh">
              <b>Unfulfilled</b>
              <span className="pl-muted">#{num}-F1</span>
            </header>
            <p className="pl-line2">Delivers {delivers}<span className="pl-loc">&#9679; Your 3PL ships this</span></p>
            <Item l={{ title: c.productName || "Your product", sub: `Delivery ${row.n + 1} of ${c.deliveries}`, qty: 1, unit: row.amount }} />
          </section>

          <p className="pl-note">
            {mode === "prepaid"
              ? `No payment step. This delivery was paid at checkout, so the order is created ${c.leadDays} days ahead on its own and draws down the store credit.`
              : mode === "autopay"
              ? "Debited on the mandate the day before the order is cut, so nothing waits on the customer and no invoice is sent."
              : "This order exists only because the invoice was paid. An unpaid delivery has no order at all, which is what stops anything shipping unpaid."}
          </p>

          <section className="pl-card">
            <header className="pl-cardh"><b><span className="pl-fico">&#10003;</span>Paid</b></header>
            <table className="pl-tot">
              <tbody>
                <tr><td>Original order</td><td>{created}</td><td className="pl-r">{money(row.amount)}</td></tr>
                <tr><td>Subtotal</td><td>1 item</td><td className="pl-r">{money(c.unitPrice)}</td></tr>
                <tr><td>Discounts</td><td>Subscription</td><td className="pl-r">-{money(Math.max(0, c.unitPrice - row.amount))}</td></tr>
                <tr><td>Taxes</td><td>Tax details</td><td className="pl-r">Included</td></tr>
                <tr className="pl-totrow"><td><b>Paid</b></td><td /><td className="pl-r"><b>{money(row.amount)}</b></td></tr>
              </tbody>
            </table>
          </section>
        </div>

        <aside className="pl-side">
          <section className="pl-card">
            <header className="pl-cardh"><b>Customer</b></header>
            <p className="pl-link">Your customer</p>
            <p className="pl-muted">{c.deliveries} orders</p>
          </section>
          <section className="pl-card">
            <header className="pl-cardh"><b>Tags</b></header>
            <div className="pl-tags">{ORDER_TAGS[mode].delivery.map((t) => <span key={t}>{t}</span>)}</div>
            <p className="pl-muted pl-tagnote">
              <code>child</code> is how you tell a delivery order from the checkout order in a
              report. Every delivery order carries the same set, whichever way the run is paid
              for, because <code>createorders</code> places all of them.
            </p>
          </section>
          <section className="pl-card">
            <header className="pl-cardh"><b>Not here</b></header>
            <p className="pl-muted">
              No placeholder line, no Removed line and no second fulfilment. There was nothing
              to convert: this order was created with the real goods on it.
              {!paid && " And on pay as you go it does not exist at all until the invoice is paid."}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}


/** What the customer sees, on the same plan.
 *
 *  The merchant's question after "what lands in my admin" is "what does my customer see", and
 *  the answer differs by payment type far more than by the First delivery setting: the
 *  customer pays once and sees one order either way. Delivery 1 is the only line that reads
 *  differently in the portal. */
function CustomerView({ c, mode }: { c: SimConfig; mode: Mode }) {
  const p = price({ ...c, mode });
  const rows = schedule(c, mode);
  const flow: FirstDelivery = mode === "autopay" ? "same" : (c.firstDelivery ?? "same");
  const product = c.productName || "Your product";
  const plan = runLabel(c.everyDays, c.deliveries);

  const emails: [string, string][] = [
    ["At checkout", "Subscription confirmed: plan, deliveries and what was paid"],
    ...(mode === "prepaid" ? [
      ["Before each delivery", "Upcoming delivery reminder, then Delivery order confirmed when its order is created"],
    ] as [string, string][] : mode === "payg" ? [
      ["Before each delivery", `A payment link for ${money(p.perDelivery)}, then reminders until it is paid`],
      ["When paid", "Payment success, then Delivery order confirmed"],
      ["Still unpaid on the date", "The subscription pauses. Paying the link later resumes it"],
    ] as [string, string][] : [
      ["Once", "Approve the UPI AutoPay mandate"],
      ["Before each debit", `Pre-debit notice for ${money(p.perDelivery)}`],
    ] as [string, string][]),
    ["Whenever they change something", "A confirmation for each reschedule, swap, pause or cancel request"],
  ];

  return (
    <div className="hc-cust">
      <div className="hc-custgrid">
        <section className="hc-custcard">
          <p className="hc-custh">1 · Thank-you page</p>
          <div className="hc-custthanks">
            <span className="hc-custok">&#10003;</span>
            <div>
              <b>Order #{ORDER_NO} confirmed</b>
              <span>Thank you, Aarti!</span>
            </div>
          </div>
          <div className="hc-custline">
            <span className="pl-thumb" />
            <div><b>{product}</b><em>{plan} · {freqWord(c.everyDays)} · {c.deliveries} deliveries</em></div>
            <b>{money(p.chargedNow)}</b>
          </div>
          <p className="hc-custsmall">
            {mode === "prepaid" ? `Paid today for all ${c.deliveries} deliveries. Saved ${money(p.savings)}.`
              : mode === "payg" ? `Paid today for delivery 1 only. Each later delivery is paid by link.`
              : `Paid today for delivery 1. Later deliveries are debited by UPI AutoPay.`}
          </p>
          <p className="hc-custnote">
            {flow === "separate"
              ? "The customer checks out and pays once. The separate delivery 1 order is created by StackBack after checkout, not by a second purchase."
              : "The customer checks out and pays once. Delivery 1 is added to this same order after checkout."}
          </p>
        </section>

        <section className="hc-custcard">
          <p className="hc-custh">2 · Emails from {APP_NAME}</p>
          <ol className="hc-custmails">
            {emails.map(([when, what]) => (
              <li key={when}><em>{when}</em><span>{what}</span></li>
            ))}
          </ol>
          <p className="hc-custnote">All templates can be previewed and edited under Notification Templates.</p>
        </section>
      </div>

      <section className="hc-custcard hc-custportal">
        <p className="hc-custh">3 · Their subscription, in your customer portal</p>
        <div className="hc-portal">
          <div className="hc-portalhead">
            <span className="pl-thumb" />
            <div>
              <b>{product}</b>
              <em>{plan} · {freqWord(c.everyDays)} · {MODE_LABEL[mode]}</em>
            </div>
            <span className="hc-pill p-w">Active</span>
          </div>
          <ul className="hc-portalrows">
            {rows.map((r) => {
              let status: React.ReactNode;
              if (r.n === 1) {
                status = flow === "same"
                  ? <span className="ok">Part of order #{ORDER_NO}</span>
                  : <span className="ok">Placed as a separate order · #{ORDER_NO + 1}</span>;
              } else if (mode === "prepaid") {
                status = <span>Paid · order created {fmtDate(r.createdOn)}</span>;
              } else if (mode === "payg") {
                status = <><span className="warn">Pay {money(r.amount)} by {fmtDate(r.deliveryDate)}</span>
                  {r.n === 2 && <button type="button" className="hc-portalpay">Pay now</button>}</>;
              } else {
                status = <span>Auto-debit {money(r.amount)} on {fmtDate(r.invoicedOn ?? r.createdOn)}</span>;
              }
              return (
                <li key={r.n}>
                  <b>Delivery {r.n}</b>
                  <em>{fmtDate(r.deliveryDate)}</em>
                  <span className="hc-portalst">{status}</span>
                </li>
              );
            })}
          </ul>
          <div className="hc-portalacts">
            {["Reschedule", "Swap", "Add a product", "Pause", "Cancel"].map((x) => (
              <span key={x} className="hc-portalact">{x}</span>
            ))}
          </div>
        </div>
        <p className="hc-custnote">
          Reschedule is free. Swap and Add change the next delivery only, and the customer pays any
          difference first. Cancel is a request: it reaches you in the app, and you approve it.
        </p>
      </section>
    </div>
  );
}
