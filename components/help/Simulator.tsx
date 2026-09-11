"use client";
import { useMemo, useState } from "react";
import {
  DEFAULT_CONFIG, FREQUENCIES, fmtDate, money, price, schedule, startOf,
  type Mode, type SimConfig,
} from "@/lib/help/sim";
import { APP_NAME } from "@/lib/help/types";

/** The two flows merchants confuse, side by side and playable.
 *
 *  The USER flow is what the customer does: one page, one choice, one checkout. The BACKEND
 *  flow is what {APP_NAME} creates in Shopify off the back of it, which is several orders
 *  over several months. Merchants read the second and assume the first went wrong, and the
 *  specific moment that happens is checkout: the parent order and the first delivery's order
 *  appear together, and that reads as a duplicate.
 *
 *  So both modes are shown at once rather than behind a toggle. "What is the difference
 *  between prepaid and pay as you go" is answered by putting them next to each other. */
export default function Simulator({ seed, compact, config, onConfig, hideOrders, ordersOnly }: {
  seed?: Partial<SimConfig>; compact?: boolean;
  /** When given, the caller owns the numbers and other things on the page read them too. */
  config?: SimConfig; onConfig?: (next: SimConfig) => void;
  /** The wizard splits this across two steps: the controls on one, the orders on the next. */
  hideOrders?: boolean; ordersOnly?: boolean;
} = {}) {
  const [own, setOwn] = useState<SimConfig>({ ...DEFAULT_CONFIG, ...seed });
  const c = config ?? own;
  const write = onConfig ?? setOwn;
  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => write({ ...c, [k]: v });

  const prepaid = useMemo(() => ({ p: price({ ...c, mode: "prepaid" }), rows: schedule(c, "prepaid") }), [c]);
  const payg = useMemo(() => ({ p: price({ ...c, mode: "payg" }), rows: schedule(c, "payg") }), [c]);

  return (
    <section>
      {ordersOnly ? null : compact ? (
        <h2 className="hc-h2">Simulate it</h2>
      ) : (
        <>
          <p className="hc-eyebrow">Simulate</p>
          <h1 className="hc-h1">One checkout, several orders</h1>
        </>
      )}
      {!ordersOnly && (<>
      <p className="hc-blurb">
        Set a plan up the way you are thinking of selling it. Below it: what the customer does,
        then what {APP_NAME} creates in your Shopify admin once they have done it, on both payment
        types. Change anything and both move.
      </p>

      {!ordersOnly && <div className="hc-simbar hc-simbar-row">
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
      </div>}

      </>)}

      {!hideOrders && (<>
      {/* ------------------------------------------------ the store's side */}
      <h2 className="hc-h2">What lands in your Shopify orders</h2>
      <p className="hc-blurb hc-flowlede">
        That one checkout becomes <b>{c.deliveries + 1} orders</b>: a parent that takes the money and
        one child per delivery that ships. The parent and the first child are written
        <b> at the same minute</b>, which is the pair most often reported to us as a duplicate.
        This is how the list reads.
      </p>

      <div className="hc-modecols">
        <ModeColumn mode="prepaid" c={c} p={prepaid.p} rows={prepaid.rows} />
        <ModeColumn mode="payg" c={c} p={payg.p} rows={payg.rows} />
      </div>

      <ul className="hc-oflags hc-childnote">
        <li>The <b>parent</b> carries a helper line, not the real product. It is auto fulfilled, moves no stock, and must be filtered out of revenue and inventory reports or the money is counted twice</li>
        <li>Each <b>child</b> carries the real product, is left unfulfilled, and carries the shipping. Your 3PL ships these</li>
        <li>Children after the first appear <b>{c.leadDays} {c.leadDays === 1 ? "day" : "days"} before</b> their delivery date.
          That is <code>time_to_delivery</code>, a per-store setting. Tell us what your warehouse needs</li>
        <li>On pay as you go an <b>unpaid</b> delivery cannot be pushed, by us or by you. That is what stops anything shipping unpaid</li>
      </ul>

      </>)}

      {!hideOrders && <p className="hc-note hc-simfoot">
        This models the behaviour the answers describe. It is a teaching tool, not a preview of your store:
        it does not read your catalogue, your shipping rates or your tax settings.
      </p>}
    </section>
  );
}

function ModeColumn({ mode, c, p, rows }: {
  mode: Mode; c: SimConfig;
  p: ReturnType<typeof price>; rows: ReturnType<typeof schedule>;
}) {
  const prepaid = mode === "prepaid";
  // Order numbers are cosmetic here, but sequential ones make the table read like the real
  // list rather than like a diagram, which is the whole point of showing it this way.
  const base = 44521;
  return (
    <div className="hc-modecol">
      <div className="hc-modehead">
        <b>{prepaid ? "Prepaid" : "Pay as you go"}</b>
        <span>{prepaid
          ? `${money(p.chargedNow)} taken at checkout, the whole run`
          : `${money(p.chargedNow)} taken at checkout, one delivery`}</span>
      </div>

      <div className="hc-shopscroll">
        <table className="hc-shoptable">
          <thead>
            <tr>
              <th>Order</th><th>Created</th><th>Channel</th><th className="hc-num">Total</th>
              <th>Payment</th><th>Fulfilment</th><th>Delivery method</th><th>Tags</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hc-parentrow">
              <td><b>#{base}</b></td>
              <td>{fmtDate(rows[0].createdOn)}<em>at checkout</em></td>
              <td>Online Store</td>
              <td className="hc-num"><b>{money(p.chargedNow)}</b></td>
              <td><Dot tone="ok" />Paid</td>
              <td><Dot tone="ok" />Fulfilled</td>
              <td>Shipping not required</td>
              <td><Tag>parent</Tag><Tag>id-1989</Tag></td>
            </tr>
            {rows.map((o) => (
              <tr key={o.n} className={o.withParent ? "hc-togetherrow" : ""}>
                <td><b>#{base + o.n}</b></td>
                <td>
                  {fmtDate(o.createdOn)}
                  {o.withParent ? <em className="hc-same">same minute as the parent</em>
                    : <em>delivers {fmtDate(o.deliveryDate)}</em>}
                </td>
                <td>StackBack Subscriptions &amp; More</td>
                <td className="hc-num">{money(o.amount)}</td>
                <td>{o.paidAtCheckout ? <><Dot tone="ok" />Paid</> : <><Dot tone="warn" />Unpaid</>}</td>
                <td><Dot tone="warn" />Unfulfilled</td>
                <td>Free Shipping</td>
                <td><Tag>child</Tag><Tag>subscription</Tag><Tag>scheduler</Tag><Tag>automated</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="hc-modefoot">
        {prepaid
          ? `All ${c.deliveries} paid up front. Each child draws down the store credit as it is created.`
          : `${money(p.chargedLater)} still to collect. Each child is invoiced ${3 + c.leadDays} days before its delivery and cannot be pushed until it is paid.`}
      </p>
    </div>
  );
}

const Tag = ({ children }: { children: React.ReactNode }) => <i className="hc-shoptag">{children}</i>;
const Dot = ({ tone }: { tone: "ok" | "warn" }) => <i className={"hc-shopdot " + tone} />;
