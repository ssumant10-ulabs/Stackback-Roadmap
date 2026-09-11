/** The maths behind the flow simulators.
 *
 *  Every rule here is one the corpus states, not one invented to make a nice demo:
 *   - one checkout creates a parent order that collects the money, plus one child order
 *     per delivery, and the parent never ships (it carries a helper line and is
 *     auto-fulfilled, which is why it must be filtered out of revenue reports);
 *   - a child order is created `time_to_delivery` days BEFORE its delivery date, not on
 *     it, so the warehouse can pick. That is a per-store setting defaulting to 7;
 *   - on prepaid the whole run is paid at checkout and sits as store credit, debited as
 *     each child order is created;
 *   - on pay as you go only the first delivery is paid at checkout. Each later one is
 *     invoiced ahead of its lead time, and an unpaid delivery cannot be pushed at all.
 *
 *  If a rule here ever disagrees with the corpus, the corpus is right and this is stale. */

export type Mode = "prepaid" | "payg";

export interface SimConfig {
  productName: string;
  /** One-time price of a single delivery's worth, in rupees. */
  unitPrice: number;
  deliveries: number;
  /** Days between deliveries. */
  everyDays: number;
  discountPct: number;
  mode: Mode;
  /** `time_to_delivery`: days before a delivery that its order is created. */
  leadDays: number;
  /** First delivery date, ISO yyyy-mm-dd. */
  startDate: string;
}

export const FREQUENCIES = [
  { label: "Weekly", days: 7 },
  { label: "Every 15 days", days: 15 },
  { label: "Monthly", days: 30 },
  { label: "Every 2 months", days: 60 },
];

export const DEFAULT_CONFIG: SimConfig = {
  productName: "Cold pressed coffee, 250g",
  unitPrice: 750,
  deliveries: 6,
  everyDays: 30,
  discountPct: 15,
  mode: "prepaid",
  leadDays: 7,
  startDate: "",
};

export const money = (n: number) =>
  "₹" + Math.round(n).toLocaleString("en-IN");

export interface Pricing {
  perDelivery: number;
  oneTimePerDelivery: number;
  subscriptionTotal: number;
  oneTimeTotal: number;
  savings: number;
  /** What the card actually gets charged at checkout. */
  chargedNow: number;
  /** What is collected later, across the remaining deliveries. */
  chargedLater: number;
}

export function price(c: SimConfig): Pricing {
  const oneTimePerDelivery = c.unitPrice;
  const perDelivery = c.unitPrice * (1 - c.discountPct / 100);
  const subscriptionTotal = perDelivery * c.deliveries;
  const oneTimeTotal = oneTimePerDelivery * c.deliveries;
  const chargedNow = c.mode === "prepaid" ? subscriptionTotal : perDelivery;
  return {
    perDelivery,
    oneTimePerDelivery,
    subscriptionTotal,
    oneTimeTotal,
    savings: oneTimeTotal - subscriptionTotal,
    chargedNow,
    chargedLater: subscriptionTotal - chargedNow,
  };
}

export interface ChildOrder {
  n: number;
  deliveryDate: Date;
  /** When StackBack creates the Shopify order. */
  createdOn: Date;
  /** Created the moment the subscription starts, because the delivery is already inside
   *  the lead window. Merchants read this as a duplicate order; it is not. */
  immediate: boolean;
  /** PAYG only: when the invoice for this delivery goes out. */
  invoicedOn: Date | null;
  amount: number;
  paidAtCheckout: boolean;
}

const addDays = (d: Date, n: number) => {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
};

export function startOf(c: SimConfig): Date {
  if (c.startDate) {
    const [y, m, d] = c.startDate.split("-").map(Number);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  // Default to a fortnight out, which is past the default lead time, so the first order
  // is scheduled rather than immediate and the normal case is what shows first.
  return addDays(new Date(), 14);
}

export function schedule(c: SimConfig): ChildOrder[] {
  const p = price(c);
  const first = startOf(c);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: c.deliveries }, (_, i) => {
    const deliveryDate = addDays(first, i * c.everyDays);
    const due = addDays(deliveryDate, -c.leadDays);
    const immediate = due <= today;
    return {
      n: i + 1,
      deliveryDate,
      createdOn: immediate ? today : due,
      immediate,
      invoicedOn: c.mode === "payg" && i > 0 ? addDays(due, -3) : null,
      amount: p.perDelivery,
      paidAtCheckout: c.mode === "prepaid" || i === 0,
    };
  });
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
