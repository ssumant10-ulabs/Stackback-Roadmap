"use client";
import { useMemo, useState } from "react";
import {
  BUNDLE_NOTE, CUSTOMER_TAGS, DEFAULT_CONFIG, MODE_LABEL, ORDER_TAGS, fmtDate, money, parentOrder, price, schedule, startOf,
  type Mode, type OrderLine, type SimConfig,
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

  const [surface, setSurface] = useState<"shopify" | "contracts">("shopify");

  const prepaid = useMemo(() => ({ p: price({ ...c, mode: "prepaid" }), rows: schedule(c, "prepaid") }), [c]);
  const payg = useMemo(() => ({ p: price({ ...c, mode: "payg" }), rows: schedule(c, "payg") }), [c]);
  const autopay = useMemo(() => ({ p: price({ ...c, mode: "autopay" }), rows: schedule(c, "autopay") }), [c]);
  /* Which payment type the drawn order is showing. The three are genuinely different orders,
     not the same order with a different badge: AutoPay's carries the real goods from the
     start and never gets converted. */
  const [drawn, setDrawn] = useState<Mode>("prepaid");
  /** Which of the two order shapes is being drawn. A delivery order looks nothing like the
      checkout order, and until now the only place it appeared was as a row in a list. */
  const [which, setWhich] = useState<"parent" | "child">("parent");

  return (
    <section>
      <p className="hc-blurb hc-flowlede">
        Checkout creates <b>one order</b>, whatever the run length. Delivery one&rsquo;s goods go onto
        that same order. Everything after it appears later, and only when it is paid for.
      </p>

      <ol className="hc-atcheckout">
        <li>
          <span className="hc-otag ok">THE ORDER</span>
          <b>One order takes the money</b>
          <p>
            Checkout writes a single order carrying a placeholder line: one unit per delivery, priced
            per delivery, so the whole run is paid on one line.
          </p>
        </li>
        <li>
          <span className="hc-otag ok">MINUTES LATER</span>
          <b>Delivery one is added to it</b>
          <p>
            A job edits that same order. The placeholder drops by one delivery, the real product is
            added at the plan price, and the order is tagged <code>sb-delivery-1-converted</code>. The
            pre-edit line stays visible under <b>Removed</b>, which is Shopify keeping history, not a
            cancellation.
          </p>
        </li>
        <li className="hc-later">
          <span className="hc-otag muted">LATER</span>
          <b>Nothing else exists yet</b>
          <p>
            Every remaining delivery becomes <b>its own order</b>, created {c.leadDays} days before its
            delivery date, and only if that delivery is <b>paid for</b>.
          </p>
        </li>
      </ol>

      <p className="hc-note hc-flowwas">
        The checkout order is tagged <code>parent</code>. Every delivery order after it is tagged{" "}
        <code>child</code>. That is how you tell them apart in a report, and it is the same on all
        three payment types.
      </p>

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
          <div className="hc-modepick" role="tablist" aria-label="Payment type">
            {(["prepaid", "payg", "autopay"] as Mode[]).map((m) => (
              <button key={m} role="tab" aria-selected={drawn === m}
                className={"hc-modepillb" + (drawn === m ? " on" : "")}
                onClick={() => setDrawn(m)}>{MODE_LABEL[m]}</button>
            ))}
          </div>
          {/* Two orders, two shapes, and the second one is the one nobody has seen. The
              checkout order is the edited parent; every delivery after the first is its own
              order and looks nothing like it, which is the question the list below prompts
              and could not answer. */}
          <div className="hc-modepick hc-whichorder" role="tablist" aria-label="Which order">
            <button role="tab" aria-selected={which === "parent"}
              className={"hc-modepillb" + (which === "parent" ? " on" : "")}
              onClick={() => setWhich("parent")}>The checkout order</button>
            <button role="tab" aria-selected={which === "child"}
              className={"hc-modepillb" + (which === "child" ? " on" : "")}
              onClick={() => setWhich("child")}>A delivery order</button>
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
                    <td className="hc-tagcell">{ORDER_TAGS[m].parent.map((t) => <Tag key={t}>{t}</Tag>)}</td>
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
            <li>The checkout order carries <b>two kinds of line</b>: the real product for delivery one, which your 3PL ships, and the placeholder holding the deliveries still to come, which is fulfilled as <b>shipping not required</b> so nothing picks it up</li>
            <li>The order total does not move when the edit commits. The placeholder is reduced and the goods are added at the same value, so <b>revenue is counted once</b>, on this one order</li>
            <li>Every delivery after the first appears <b>{c.leadDays} {c.leadDays === 1 ? "day" : "days"} before</b> its
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

/** One subscription is one customer, so the column is not a variable. Named rather than left
 *  blank because an empty Customer column is the one thing Shopify's Orders index never has. */
const CUSTOMER = "Aarti Menon";

function OrdersColumn({ mode, c, p, rows }: {
  mode: Mode; c: SimConfig;
  p: ReturnType<typeof price>; rows: ReturnType<typeof schedule>;
}) {
  const prepaid = mode === "prepaid";
  const base = ORDER_NO;
  // Orders in the admin today: the checkout order, plus any later delivery whose lead window
  // has already opened. Delivery one is not counted separately, it is ON the checkout order.
  const live = 1 + rows.slice(1).filter((r) => r.existsToday).length;
  return (
    <div className="hc-modecol pl">
      <div className="hc-modehead">
        <b>{MODE_LABEL[mode]}</b>
        <span>
          <b>{live} of {c.deliveries}</b> orders exist today.
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
                <em>delivery 1 ships from here</em>
              </td>
              <td className="pl-r">{c.deliveries === 1 ? "1 item" : `${c.deliveries} items`}</td>
              <td className="pl-otags">{ORDER_TAGS[mode].parent.map((t) => <Tag key={t}>{t}</Tag>)}</td>
            </tr>
            <tr className="pl-orowsplit"><td colSpan={8}>Child &middot; one order per delivery after the first</td></tr>
            {rows.slice(1).map((o) => (
              <tr key={o.n} className={"pl-orow" + (o.existsToday ? "" : " pl-opending")}>
                <td>{o.existsToday ? <b>#{base + o.n}</b> : <span className="pl-onone">none yet</span>}</td>
                <td>
                  {o.existsToday
                    ? fmtDate(o.createdOn)
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
          ? <>Delivery one is on the order above. Every later delivery is <b>already paid</b>, so its order is created automatically {c.leadDays} days before its delivery, drawing down the store credit. Nothing waits on the customer.</>
          : mode === "payg"
          ? <>Delivery one is on the order above and is the only one paid. Each later delivery is invoiced {3 + c.leadDays} days ahead, and its order reaches Shopify <b>only once that invoice is paid</b>. An unpaid delivery has no order at all.</>
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

          {o.converted && (
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
                <tr><td>Subtotal</td><td>{o.held ? 2 : 1} items</td><td className="pl-r">{money(o.subtotal)}</td></tr>
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
