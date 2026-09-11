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
export default function Simulator({ seed, compact }: { seed?: Partial<SimConfig>; compact?: boolean } = {}) {
  const [c, setC] = useState<SimConfig>({ ...DEFAULT_CONFIG, ...seed });
  const set = <K extends keyof SimConfig>(k: K, v: SimConfig[K]) => setC({ ...c, [k]: v });

  const prepaid = useMemo(() => ({ p: price({ ...c, mode: "prepaid" }), rows: schedule(c, "prepaid") }), [c]);
  const payg = useMemo(() => ({ p: price({ ...c, mode: "payg" }), rows: schedule(c, "payg") }), [c]);

  return (
    <section>
      {compact ? (
        <h2 className="hc-h2">Simulate it</h2>
      ) : (
        <>
          <p className="hc-eyebrow">Simulate</p>
          <h1 className="hc-h1">One checkout, several orders</h1>
        </>
      )}
      <p className="hc-blurb">
        Set a plan up the way you are thinking of selling it. Below it: what the customer does,
        then what {APP_NAME} creates in your Shopify admin once they have done it, on both payment
        types. Change anything and both move.
      </p>

      <div className="hc-simbar hc-simbar-row">
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
      </div>

      {/* ------------------------------------------------ the customer's side */}
      <h2 className="hc-h2">What the customer does</h2>
      <p className="hc-note">One page, one choice, one payment. They never see any of the backend flow below.</p>
      <ol className="hc-userflow">
        <li>
          <b>Opens the product page</b>
          <span>Sees the one-time price at {money(c.unitPrice)}, and a subscription option beside it.</span>
        </li>
        <li>
          <b>Picks the subscription</b>
          <span>
            {FREQUENCIES.find((f) => f.days === c.everyDays)?.label.toLowerCase()}, {c.deliveries} deliveries,
            {" "}{money(prepaid.p.perDelivery)} each instead of {money(c.unitPrice)}.
          </span>
        </li>
        <li>
          <b>Chooses how to pay</b>
          <span>Prepaid, {money(prepaid.p.chargedNow)} now for the whole run. Or pay as you go, {money(payg.p.chargedNow)} now and the rest per delivery.</span>
        </li>
        <li>
          <b>Checks out once</b>
          <span>That is the last action they take. Every delivery after this happens on its own.</span>
        </li>
      </ol>

      {/* ------------------------------------------------ the store's side */}
      <h2 className="hc-h2">What {APP_NAME} creates in your Shopify admin</h2>
      <p className="hc-blurb hc-flowlede">
        That one checkout becomes <b>{c.deliveries + 1} Shopify orders</b>: a parent that takes the money,
        and one child per delivery that actually ships. The parent and the first child are created
        <b> in the same moment</b>, which is the thing most often reported to us as a duplicate order.
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

      <p className="hc-note hc-simfoot">
        This models the behaviour the answers describe. It is a teaching tool, not a preview of your store:
        it does not read your catalogue, your shipping rates or your tax settings.
      </p>
    </section>
  );
}

function ModeColumn({ mode, c, p, rows }: {
  mode: Mode; c: SimConfig;
  p: ReturnType<typeof price>; rows: ReturnType<typeof schedule>;
}) {
  const prepaid = mode === "prepaid";
  return (
    <div className="hc-modecol">
      <div className="hc-modehead">
        <b>{prepaid ? "Prepaid" : "Pay as you go"}</b>
        <span>{prepaid
          ? `${money(p.chargedNow)} taken at checkout, the whole run`
          : `${money(p.chargedNow)} taken at checkout, one delivery`}</span>
      </div>

      <ol className="hc-orders">
        <li className="hc-order parent">
          <span className="hc-otag warn">PARENT</span>
          <b>{money(p.chargedNow)}</b>
          <em>At checkout · takes the money, ships nothing</em>
        </li>
        {rows.map((o) => (
          <li key={o.n} className={"hc-order" + (o.withParent ? " together" : "")}>
            <span className="hc-otag ok">CHILD {o.n}</span>
            <b>{money(o.amount)}</b>
            <em>
              {o.withParent
                ? <><strong>At checkout, with the parent</strong> · delivers {fmtDate(o.deliveryDate)}</>
                : <>Created {fmtDate(o.createdOn)} · delivers {fmtDate(o.deliveryDate)}</>}
            </em>
            {!o.paidAtCheckout && o.invoicedOn && (
              <em className="hc-oinv">Invoice sent {fmtDate(o.invoicedOn)}, and it cannot be pushed until it is paid</em>
            )}
            {o.early && <em className="hc-oinv">Its lead window has already passed, so it is cut now too</em>}
          </li>
        ))}
      </ol>

      <p className="hc-modefoot">
        {prepaid
          ? `All ${c.deliveries} paid up front. Each child draws down the store credit as it is created.`
          : `${money(p.chargedLater)} still to collect, one invoice per delivery.`}
      </p>
    </div>
  );
}
