/** The maths behind the flow simulators.
 *
 *  Every rule here is one the corpus states, not one invented to make a nice demo:
 *   - one checkout creates a parent order that collects the money, plus one child order
 *     per delivery, and the parent never ships (it carries a helper line and is
 *     auto-fulfilled, which is why it must be filtered out of revenue reports);
 *   - checkout creates exactly TWO orders, whatever the run length. The parent carries the
 *     subscription contract details and is auto-fulfilled and marked shipping-not-required so
 *     a warehouse or inventory system does not pick it up. The first child is the real order,
 *     the one that ships. A merchant sees two appear at once and reads it as a duplicate;
 *   - no other order exists yet. Each later delivery's order is created `time_to_delivery`
 *     days before its delivery date, and ONLY IF that delivery is paid for. Prepaid has paid
 *     for all of them at checkout, so they appear on schedule. Pay as you go has not, so each
 *     one waits on its invoice. The lead time is a per-store setting defaulting to 7;
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

/** The widget's own vocabulary, and its own arithmetic: "every 2 weeks" is 14 days, not 15,
 *  which is what makes 6 deliveries read as a 12 week plan rather than a 13 week one. */
export const FREQUENCIES = [
  { label: "Every week", days: 7 },
  { label: "Every 2 weeks", days: 14 },
  { label: "Every month", days: 30 },
  { label: "Every 2 months", days: 60 },
];

export interface PlanOption {
  /** "3 months plan". The card's headline. */
  title: string;
  /** "Every 1 month \u00b7 3 deliveries". The line under it. */
  schedule: string;
  deliveries: number;
  everyDays: number;
  discountPct: number;
  perDelivery: number;
  total: number;
}

/** How the plan card names a run length. A monthly plan counts in months; anything shorter
 *  counts in weeks, because "26 weeks plan" is how you describe half a year to nobody. */
export function runLabel(everyDays: number, deliveries: number): string {
  if (everyDays % 30 === 0) {
    const months = (everyDays / 30) * deliveries;
    return `${months} month${months === 1 ? "" : "s"} plan`;
  }
  const weeks = Math.round((everyDays * deliveries) / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} plan`;
}

export const DEFAULT_CONFIG: SimConfig = {
  productName: "Dummy product",
  unitPrice: 750,
  deliveries: 6,
  everyDays: 14,
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
  /** Cut at checkout, in the same moment as the parent order. True for delivery 1, always.
   *  This is the pair a merchant reads as a duplicate. */
  withParent: boolean;
  /** A later delivery whose lead window has already passed, so its order is cut now too. */
  early: boolean;
  /** Does a Shopify order exist for this delivery today? Being paid for is necessary and
   *  not sufficient: a prepaid delivery three months out is paid and has no order. */
  existsToday: boolean;
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

export function schedule(c: SimConfig, mode: Mode = c.mode): ChildOrder[] {
  const p = price({ ...c, mode });
  const first = startOf(c);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: c.deliveries }, (_, i) => {
    const deliveryDate = addDays(first, i * c.everyDays);
    // Delivery 1's order is cut at checkout, alongside the parent. Later ones wait for
    // their lead window. Treating delivery 1 like the rest is what makes a simulator
    // disagree with the store a merchant is looking at.
    const atCheckout = i === 0;
    const due = addDays(deliveryDate, -c.leadDays);
    const createdOn = atCheckout ? today : (due <= today ? today : due);
    const paid = mode === "prepaid" || i === 0;
    return {
      n: i + 1,
      deliveryDate,
      createdOn,
      withParent: atCheckout,
      early: !atCheckout && due <= today,
      // Paid and inside the lead window. Prepaid pays for everything up front, which is why
      // "paid" on its own was the wrong test and made the whole run look like it exists.
      existsToday: atCheckout || (paid && due <= today),
      invoicedOn: mode === "payg" && i > 0 ? addDays(due, -3) : null,
      amount: p.perDelivery,
      paidAtCheckout: paid,
    };
  });
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });


/** The schedule options a widget offers. A run of N is one option; the longer commitment
 *  beside it is the pattern every screenshot shows, because a tiered discount is how these
 *  stores sell a longer plan. Both are derived from the configured run so the numbers on the
 *  card always agree with the orders underneath. */
export function planOptions(
  c: SimConfig,
  runs: number[] = [c.deliveries],
  bands: Record<number, number> = {},
  format: "frequency-deliveries" | "cadence" | "none" = "frequency-deliveries",
): PlanOption[] {
  const freq = freqWord(c.everyDays);

  const line = (deliveries: number) => {
    if (format === "none") return "";
    // The codebase's own wording for each format. "cadence" is what a client asked for and
    // what the widget already supports; inventing a third phrasing here would just be wrong.
    if (format === "cadence") return `1 delivery ${freq.toLowerCase()}`;
    return `${freq} \u00b7 ${deliveries} deliver${deliveries === 1 ? "y" : "ies"}`;
  };

  const list = (runs.length ? runs : [c.deliveries]).slice(0, 4);
  return list.map((deliveries) => {
    const discountPct = Number.isFinite(bands[deliveries]) ? bands[deliveries] : c.discountPct;
    const perDelivery = c.unitPrice * (1 - discountPct / 100);
    return {
      title: runLabel(c.everyDays, deliveries),
      schedule: line(deliveries),
      deliveries, everyDays: c.everyDays, discountPct,
      perDelivery, total: perDelivery * deliveries,
    };
  });
}

export const freqWord = (d: number) =>
  d === 7 ? "Every week" : d === 14 ? "Every 2 weeks" : d === 30 ? "Every month"
  : d === 60 ? "Every 2 months" : `Every ${d} days`;
