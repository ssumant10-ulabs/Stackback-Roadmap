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

export type Mode = "prepaid" | "payg" | "autopay";

/** The tags we actually write, per payment type, quoted from the code that writes them.
 *  Parent: applyParentTags in webhooks.app.orders-create.tsx, plus the two conversion tags
 *  from delivery-conversion.server.ts, plus autopay-order.server.ts for the Razorpay order.
 *  Delivery: the createorders payload in utils/scheduler.ts, identical for all three. */
export const ORDER_TAGS: Record<Mode, { parent: string[]; delivery: string[] }> = {
  prepaid: {
    parent: ["parent", "id-<n>", "sb-delivery-1-converted", "sb-delivery-1-value-<amount>"],
    delivery: ["subscription", "automated", "scheduler", "child", "id-<n>"],
  },
  payg: {
    parent: ["parent", "pay-as-you-go", "id-<n>", "sb-delivery-1-converted", "sb-delivery-1-value-<amount>"],
    delivery: ["subscription", "automated", "scheduler", "child", "id-<n>"],
  },
  autopay: {
    parent: ["subscription", "autopay", "razorpay", "parent", "id-<n>"],
    delivery: ["subscription", "automated", "scheduler", "child", "id-<n>"],
  },
};

export const MODE_LABEL: Record<Mode, string> = {
  prepaid: "Prepaid",
  payg: "Pay as you go",
  autopay: "Pay per delivery (AutoPay)",
};

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
  /** Delivery 1 has no order of its own. Its goods are added to the storefront order that
   *  already carried the money, by an order edit on that same order. Changed 2026-09-24:
   *  before this, delivery 1 was a second order cut at checkout beside a parent, and a
   *  merchant reading these two rows as a duplicate is why it is one order now. */
  onParent: boolean;
  /** A later delivery whose lead window has already passed, so its order is cut now too. */
  early: boolean;
  /** Is this delivery in Shopify today, as its own order or as lines on the storefront
   *  order? Being paid for is necessary and not sufficient: a prepaid delivery three months
   *  out is paid and has nothing in the admin. */
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
    // Delivery 1 goes onto the checkout order itself. Later ones wait for their lead
    // window and become orders of their own.
    const atCheckout = i === 0;
    const due = addDays(deliveryDate, -c.leadDays);
    const createdOn = atCheckout ? today : (due <= today ? today : due);
    /* Prepaid pays the run at checkout. AutoPay debits each delivery through the mandate
       ahead of its date, so a delivery is paid by the time its order is placed, the same as
       prepaid from the order's point of view. PAYG waits on a person. */
    const paid = mode === "prepaid" || mode === "autopay" || i === 0;
    return {
      n: i + 1,
      deliveryDate,
      createdOn,
      onParent: atCheckout,
      early: !atCheckout && due <= today,
      // Paid and inside the lead window. Prepaid pays for everything up front, which is why
      // "paid" on its own was the wrong test and made the whole run look like it exists.
      existsToday: atCheckout || (paid && due <= today),
      invoicedOn: mode === "payg" && i > 0 ? addDays(due, -3) : mode === "autopay" && i > 0 ? addDays(due, -1) : null,
      amount: p.perDelivery,
      paidAtCheckout: paid,
    };
  });
}

/** One line on the storefront order, as Shopify shows it. */
export interface OrderLine {
  title: string;
  sub?: string;
  qty: number;
  unit: number;
  /** Struck-through original, when an edit discounted the line. */
  was?: number;
  /** The `_sb_*` note attributes Shopify prints under a subscription line. */
  attrs?: [string, string][];
}

export interface ParentOrder {
  /** False for AutoPay: nothing was converted, so there is no Removed line to show. */
  converted: boolean;
  /** Dummy line after the edit: one unit per delivery still to come. */
  held: OrderLine | null;
  /** Delivery 1's real goods, added by the edit. */
  shipping: OrderLine;
  /** The dummy line as it stood before the edit, which Shopify keeps under Removed. */
  removed: OrderLine;
  subtotal: number;
  discount: number;
  total: number;
  /** What the value tag records for delivery 1. */
  deliveryValue: number;
  tags: string[];
}

/** What one checkout puts in the admin.
 *
 *  Shape taken from `app/services/delivery-conversion.server.ts` and a real order: the cart
 *  transform expands the line into a placeholder variant at one unit per delivery, priced per
 *  delivery, so the whole run is paid on one line. A job then edits that same order, drops the
 *  placeholder by one delivery and adds the real goods at the timeline price. The pre-edit
 *  line stays visible under Removed, which is Shopify keeping the history, not a cancellation.
 */
export function parentOrder(c: SimConfig, mode: Mode = c.mode, productName = "Your product"): ParentOrder {
  const p = price({ ...c, mode });
  /* AutoPay's first order is placed by us through Razorpay and already carries the REAL
     variant, price, shipping and tax: the money moved inside the mandate authorisation, so
     there is no placeholder to hold and nothing to convert. Prepaid holds the rest of the
     run on the placeholder; PAYG paid for one delivery, so it holds nothing. */
  const held = mode === "prepaid" ? c.deliveries - 1 : 0;
  const converted = mode !== "autopay";
  const planTitle = runLabel(c.everyDays, c.deliveries);
  const attrs: [string, string][] = [
    ["_sb_subscription", "true"],
    ["_payment_method", mode === "prepaid" ? "prepaid" : "pay_as_you_go"],
    ...(mode === "autopay" ? [["_sb_autopay_mandate_ready", "true"] as [string, string]] : []),
    ["_sb_plan_title", planTitle],
    ["Info", `${freqWord(c.everyDays)} for ${c.deliveries} deliveries`],
    ["_sb_shipping_service", "Free Shipping"],
  ];
  if (!converted) {
    return {
      held: null,
      shipping: { title: productName, sub: "Delivery 1, charged on the mandate", qty: 1, unit: p.perDelivery, attrs },
      removed: { title: planTitle, sub: productName, qty: 1, unit: p.perDelivery },
      converted, subtotal: c.unitPrice, discount: c.unitPrice - p.perDelivery,
      total: p.perDelivery, deliveryValue: p.perDelivery, tags: ORDER_TAGS.autopay.parent,
    };
  }
  return {
    converted,
    held: held > 0
      ? { title: planTitle, sub: `${productName} · held for ${held} more deliver${held === 1 ? "y" : "ies"}`, qty: held, unit: p.perDelivery, attrs }
      : null,
    shipping: { title: productName, sub: "Delivery 1", qty: 1, unit: p.perDelivery, was: c.unitPrice },
    removed: { title: planTitle, sub: productName, qty: mode === "prepaid" ? c.deliveries : 1, unit: p.perDelivery, attrs },
    subtotal: c.unitPrice * (mode === "prepaid" ? c.deliveries : 1),
    discount: (c.unitPrice - p.perDelivery) * (mode === "prepaid" ? c.deliveries : 1),
    total: p.chargedNow,
    deliveryValue: p.perDelivery,
    tags: ORDER_TAGS[mode].parent,
  };
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
  format: "frequency-deliveries" | "cadence" | "none" | "custom" = "frequency-deliveries",
  /** Used only by "custom", and an empty one falls back to the cadence rather than to a
   *  blank line, so half-finished copy never reaches a client on a call. */
  customLine = "",
): PlanOption[] {
  const freq = freqWord(c.everyDays);

  const line = (deliveries: number) => {
    if (format === "none") return "";
    if (format === "custom") return customLine.trim() || `1 delivery ${freq.toLowerCase()}`;
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
