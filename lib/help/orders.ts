/** Read a Shopify orders export and propose plans from what the store already sells.
 *
 *  The whole point of this file is that a category average is a guess and a store's own
 *  repeat gap is not. Everything here runs in the browser: the CSV never leaves the machine,
 *  which is the only reason it is safe to drop a customer list into a help page.
 *
 *  Two traps are encoded rather than commented, because both have already produced a wrong
 *  answer on a real merchant file:
 *
 *  1. A Shopify export puts the ORDER header on the first row of an order and leaves it blank
 *     on every following line item. Forward-filling those columns propagates `Cancelled at`
 *     across every following row, which silently drops most of the file. Orders are grouped by
 *     `Name` and the header is taken from the first row of the group, never filled down.
 *
 *  2. Draft orders carry no `Email`. Counting them as one anonymous customer produced a 64.7%
 *     repeat rate on a 0-day median gap, which is a plausible-looking number and completely
 *     wrong. Rows with no email are counted and reported, never merged.
 */

export interface OrderRow {
  name: string;
  email: string;
  createdAt: Date;
  cancelled: boolean;
  source: string;
  items: { title: string; qty: number; price: number }[];
  /** Order-level discount in currency, and the code if one was used. A Shopify export puts
   *  both on the first row of an order, so they are read with the rest of the header. */
  discount: number;
  discountCode: string;
}

/** A plan the file supports, for one group of pack sizes.
 *
 *  Prepaid and AutoPay are listed apart because they are not the same product. Prepaid is a
 *  fixed run bought upfront, so it has run lengths. AutoPay runs until the customer stops
 *  it, so it has no fixed run at all — the twelve is a year at this cadence, which is what a
 *  merchant needs for pricing and forecasting rather than a commitment anyone is making. */
export interface PlanSuggestion {
  /** "Smaller packs", "Larger packs", or "All products" when there is nothing to split. */
  label: string;
  /** The pack sizes in this group, as written on the products. */
  sizes: string[];
  products: string[];
  everyDays: number;
  medianGap: number;
  gapSample: number;
  customers: number;
  /** Prepaid only: the fixed runs worth selling at this cadence. */
  prepaidRuns: number[];
  /** AutoPay: a year at this cadence, and never a commitment. Always 12 deliveries' worth
   *  of planning regardless of cadence, because that is the horizon merchants price against. */
  autopayCycles: number;
}

export interface OrderInsight {
  orders: number;
  cancelled: number;
  noEmail: number;
  customers: number;
  repeatCustomers: number;
  repeatRate: number;
  /** Median days between consecutive orders from the same customer. */
  medianGap: number | null;
  gapSample: number;
  /** Nearest frequency we actually offer, across the whole file. Kept because a store with
   *  one pack size has one answer and should not be shown two. */
  suggestEveryDays: number | null;
  suggestRuns: number[];
  /** One plan per pack-size band, where the bands genuinely reorder differently. A 100g bag
   *  comes back in three weeks and a 1kg bag in three months; averaging them produces a
   *  cadence that is wrong for both. Single-entry when the file does not support a split. */
  plans: PlanSuggestion[];
  topProducts: { title: string; orders: number; units: number; revenue: number }[];
  aov: number;
  /** Days between the first and last order in the file, so a count can become a rate. A
   *  file is worth a volume band only if it says over how long it was collected. */
  windowDays: number | null;
  /** What the store already discounts, off its own orders rather than a category table.
   *  `maxPct` is the deepest single order, `topPct` the deepest rate that more than a
   *  handful of orders actually used — a one-off 90% staff order is not a plan. */
  discounts: {
    orders: number;
    share: number;
    medianPct: number | null;
    maxPct: number | null;
    /** The most-used rate and how many orders took it, rounded to whole percent. */
    bands: { pct: number; orders: number }[];
    codes: { code: string; orders: number }[];
    /** A pay-online discount (PREPAID-DISCOUNT and the like): a payment-method nudge, not a
     *  product discount, so it is shown and left out of the plan rates. */
    payment: { code: string; pct: number; orders: number } | null;
    /** The store's real promotions, one rate per code: the lowest rate the code is seen at
     *  with real volume (higher ones are the code stacked with the pay-online discount). */
    promos: { code: string; pct: number; orders: number }[];
    /** The order-weighted typical promo rate. What the plan ladder starts from. */
    usualPct: number | null;
  };
  /** Build Your Own Box, from what customers already buy together in one order. Null when
   *  too few orders carry two or more products for a box to be worth offering. */
  byob: ByobSuggestion | null;
  /** Every product worth listing, with its own repeat cycle and where it goes. */
  mix: ProductMix[];
  warnings: string[];
}

/** Where a variant's delivery frequency came from, strongest first. */
export type CadenceSource = "reorders" | "pack" | "size" | "default";

/** One product as the order file sees it: where it goes (subscription or box), and each
 *  variant's own delivery frequency with the evidence for it. */
export interface ProductMix {
  title: string;
  orders: number;
  customers: number;
  /** The typical line price, for drawing it on a landing page. */
  price: number;
  /** Customers who bought it two or more times. */
  repeaters: number;
  /** Bought in the same order as another product. */
  together: number;
  role: "subscription" | "bundle";
  /** One line on why it went where it went. */
  why: string;
  variants: { name: string; orders: number; medianGap: number | null; everyDays: number; source: CadenceSource }[];
}

/** Subscription products grouped by how often they ship: one plan group per frequency. */
export interface CadenceGroup {
  everyDays: number;
  runs: number[];
  items: { title: string; variants: string[]; allVariants: boolean; sources: CadenceSource[] }[];
}

export const CADENCE_WORD: Record<number, string> = { 7: "Every week", 30: "Every month", 60: "Every 2 months", 90: "Every 3 months" };

export function cadenceGroups(mix: ProductMix[]): CadenceGroup[] {
  const by = new Map<number, CadenceGroup>();
  for (const m of mix) {
    if (m.role !== "subscription") continue;
    const vs = new Map<number, typeof m.variants>();
    for (const v of m.variants) vs.set(v.everyDays, [...(vs.get(v.everyDays) || []), v]);
    for (const [every, list] of vs) {
      const g = by.get(every) || { everyDays: every, runs: runsFor(every), items: [] };
      g.items.push({ title: m.title, variants: list.map((v) => v.name), allVariants: vs.size === 1,
        sources: [...new Set(list.map((v) => v.source))] });
      by.set(every, g);
    }
  }
  return [...by.values()].sort((a, b) => a.everyDays - b.everyDays);
}

export interface ByobSuggestion {
  /** Share of orders with two or more different products. */
  share: number;
  multiOrders: number;
  /** The products customers combine, most combined first: the box's pick list. */
  pool: { title: string; orders: number }[];
  /** The pairs bought together most often. */
  pairs: { a: string; b: string; orders: number }[];
  /** Typical number of different products in a combined order, 2 to 4. */
  size: number;
}

/* ---------------------------------------------------------------- csv */

/** A CSV reader that survives quoted commas and embedded newlines, which a Shopify export
 *  has in every product description. Splitting on "," is why the first version of this was
 *  wrong on the second file it met. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ",") { row.push(cell); cell = ""; continue; }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const num = (v: string) => {
  const n = Number(String(v || "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Shopify's own column names, plus the ones its older exports use. */
const COL = {
  name: ["name", "order", "order name"],
  email: ["email", "customer email", "contact email"],
  created: ["created at", "created_at", "processed at", "paid at"],
  cancelled: ["cancelled at", "cancelled_at"],
  source: ["source", "source name"],
  discount: ["discount amount", "discount_amount", "discounts"],
  code: ["discount code", "discount_code"],
  item: ["lineitem name", "lineitem_name", "line item name", "product title"],
  qty: ["lineitem quantity", "lineitem_quantity", "quantity"],
  price: ["lineitem price", "lineitem_price", "price"],
};

function indexOfAny(head: string[], names: string[]): number {
  for (const n of names) {
    const i = head.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}

export function readOrders(csv: string): { rows: OrderRow[]; warnings: string[] } {
  const table = parseCsv(csv);
  const warnings: string[] = [];
  if (table.length < 2) return { rows: [], warnings: ["That file had no rows under its header."] };

  const head = table[0].map((h) => h.trim().toLowerCase());
  const iName = indexOfAny(head, COL.name);
  const iCreated = indexOfAny(head, COL.created);
  if (iName < 0 || iCreated < 0) {
    return { rows: [], warnings: ["That does not look like a Shopify orders export: it has no order name or created-at column."] };
  }
  const iEmail = indexOfAny(head, COL.email);
  const iCancelled = indexOfAny(head, COL.cancelled);
  const iSource = indexOfAny(head, COL.source);
  const iDiscount = indexOfAny(head, COL.discount);
  const iCode = indexOfAny(head, COL.code);
  const iItem = indexOfAny(head, COL.item);
  const iQty = indexOfAny(head, COL.qty);
  const iPrice = indexOfAny(head, COL.price);

  // Group by order name. The header columns are read from the FIRST row of each group and
  // never filled down: see the note at the top of this file.
  const byName = new Map<string, OrderRow>();
  // A continuation row carries the line item and a BLANK order name. Skipping those loses
  // every line item after the first on a multi-line order, which leaves the order count right
  // and the product mix wrong. The group identity carries down; no header value ever does.
  let lastName = "";
  for (const r of table.slice(1)) {
    const nm = (r[iName] || "").trim() || lastName;
    if (!nm) continue;
    lastName = nm;
    let o = byName.get(nm);
    if (!o) {
      const raw = (r[iCreated] || "").trim();
      const when = new Date(raw);
      if (Number.isNaN(when.getTime())) continue;
      o = {
        name: nm,
        email: iEmail >= 0 ? (r[iEmail] || "").trim().toLowerCase() : "",
        createdAt: when,
        cancelled: iCancelled >= 0 ? Boolean((r[iCancelled] || "").trim()) : false,
        source: iSource >= 0 ? (r[iSource] || "").trim() : "",
        discount: iDiscount >= 0 ? num(r[iDiscount]) : 0,
        discountCode: iCode >= 0 ? (r[iCode] || "").trim() : "",
        items: [],
      };
      byName.set(nm, o);
    }
    const title = iItem >= 0 ? (r[iItem] || "").trim() : "";
    if (title) o.items.push({ title, qty: num(r[iQty]) || 1, price: num(r[iPrice]) });
  }

  if (iEmail < 0) warnings.push("No email column, so repeat behaviour cannot be worked out from this file. Export orders with customer details.");
  return { rows: [...byName.values()], warnings };
}

/* ---------------------------------------------------------------- analysis */

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** The frequencies a plan is offered at: weekly, monthly, every 2 months, every 3 months.
 *  A product's repeat cycle snaps to the nearest, so a suggestion is always one a merchant
 *  can pick and a shopper reads at a glance. */
export const OFFERED = [7, 30, 60, 90];
/* Leans longer: a fortnightly buyer on a monthly plan adds a second unit, while one on a
   weekly plan skips every other delivery, and skips read as churn. */
const nearestOffered = (days: number) => days <= 10 ? 7 : days <= 45 ? 30 : days <= 75 ? 60 : 90;

/** The prepaid runs worth selling at a cadence: round counts a shopper reads at a glance.
 *  The first plan is always 2 or 3 deliveries, the easy first commitment; the rest step up.
 *  Never 13 or 26: the count is what the widget shows, so it has to look chosen. */
const RUNS: Record<number, number[]> = { 7: [3, 6, 12], 30: [3, 6, 12], 60: [2, 4, 6], 90: [2, 4] };
const runsFor = (everyDays: number) => RUNS[nearestOffered(everyDays)] || [3, 6, 12];

/** AutoPay never ends, so there is no run length to suggest. Twelve is a year's worth of
 *  deliveries at any cadence — the horizon a merchant prices and forecasts against, not a
 *  commitment anybody is being asked for. */
export const AUTOPAY_CYCLES = 12;

/* ---- pack size -------------------------------------------------------------------------
   A 100g bag comes back in three weeks and a 1kg bag in three months. Averaging them gives a
   cadence that is wrong for both, which is what this file did until now: one median gap over
   every customer regardless of what they bought. */

const UNIT_TO_G: Record<string, number> = {
  g: 1, gm: 1, gms: 1, gram: 1, grams: 1, kg: 1000, kgs: 1000,
  ml: 1, l: 1000, ltr: 1000, litre: 1000, liter: 1000, litres: 1000,
};

/** The pack size a title names, normalised to grams or millilitres, with a count as a
 *  fallback. Returns null when the title says nothing about size, which is most of them on
 *  some stores and is why a split is never forced. */
export function packSize(title: string): { grams: number; text: string } | null {
  const m = /(\d+(?:\.\d+)?)\s*(kgs?|gms?|grams?|g|ml|litres?|liters?|ltr|l)\b/i.exec(title);
  if (m) {
    const n = parseFloat(m[1]);
    const mult = UNIT_TO_G[m[2].toLowerCase()];
    if (mult && n > 0) return { grams: n * mult, text: `${m[1]}${m[2].toLowerCase()}` };
  }
  /* A pack of N, for stores that sell by count rather than weight. Treated as its own scale
     and only ever compared with other counts, which the banding handles by splitting on the
     median of whatever scale the file is on. */
  const c = /(\d+)\s*(?:x|pack|packs|count|ct|pcs|pieces|sachets?|capsules?|tablets?|chews?)\b/i.exec(title);
  if (c) { const n = parseInt(c[1], 10); if (n > 0) return { grams: n, text: `${n} pack` }; }
  return null;
}

/** "Daily Scoop Plant Protein - 500g" is the product "Daily Scoop Plant Protein", variant
 *  "500g": Shopify writes line items as product, dash, variant. */
const productBase = (t: string) => t.replace(/\s+-\s+[^-]+$/, "").trim();
const variantOf = (t: string) => { const m = /\s+-\s+([^-]+)$/.exec(t); return m ? m[1].trim() : "Default"; };

/** The repeat cycle of one product (or variant): per customer, the days between consecutive
 *  orders that carried it. Same-day and over-400-day gaps are a split cart and a lapse. */
function cycle(dates: Map<string, number[]>): { gaps: number[]; repeaters: number } {
  const gaps: number[] = [];
  let repeaters = 0;
  for (const ds of dates.values()) {
    const u = [...new Set(ds)].sort((a, b) => a - b);
    if (u.length < 2) continue;
    repeaters++;
    for (let i = 1; i < u.length; i++) {
      const d = Math.round((u[i] - u[i - 1]) / 86_400_000);
      if (d >= 1 && d <= 400) gaps.push(d);
    }
  }
  return { gaps, repeaters };
}

/** A duration in a variant name: "1 Month", "3 months", "30 days", "2 weeks". */
export function durationDays(name: string): number | null {
  const m = /(\d+)\s*(day|days|week|weeks|wk|month|months|mo|mos)\b/i.exec(name);
  if (!m) return null;
  const n = parseInt(m[1], 10), u = m[2].toLowerCase();
  const d = u.startsWith("d") ? n : u.startsWith("w") ? n * 7 : n * 30;
  return d >= 5 && d <= 400 ? d : null;
}

/** A pack's quantity for comparing sibling variants: "2x500g" is 1000, "500g" 500. */
export function sizeUnits(name: string): number | null {
  const ps = packSize(name);
  if (!ps) return null;
  const mult = /(\d+)\s*x\s*\d/i.exec(name);
  return ps.grams * (mult ? parseInt(mult[1], 10) : 1);
}

const KIT = /\b(trial|sample|starter|kit|duo|trio|combo|bundle|hamper|gift|set|travel|on the go|pack of \d+ sachets?)\b/i;
const ACCESSORY = /\b(mug|bottle|shaker|strainer|spoon|whisk|bowl|tumbler|cup|frother|kettle|infuser|scoop & go|scoop and go|e-?book|book|cookbook|guide|massager|comb|brush|roller|band|tote)\b/i;

/** A line a customer chose to buy. Free gifts (a 🎁 line at ₹0) and fee lines ride along
 *  with the order, so they are neither a top product nor a box pick. */
const paid = (i: { title: string; price: number }) =>
  i.price > 0 && !/\u{1F381}|free gift|freebie|^payment for|shipping|cod (fee|charge)|gift wrap|insurance|^tip\b/iu.test(i.title);

export function analyse(rows: OrderRow[], extraWarnings: string[] = []): OrderInsight {
  const warnings = [...extraWarnings];
  const live = rows.filter((o) => !o.cancelled);
  const cancelled = rows.length - live.length;

  const withEmail = live.filter((o) => o.email);
  const noEmail = live.length - withEmail.length;
  if (noEmail > 0) {
    warnings.push(
      `${noEmail} of ${live.length} orders carry no email, usually draft or POS orders. They are counted in the totals and left out of the repeat numbers, because merging them into one anonymous customer is what produces a flattering repeat rate that is not real.`,
    );
  }

  const byCustomer = new Map<string, Date[]>();
  for (const o of withEmail) {
    const list = byCustomer.get(o.email) || [];
    list.push(o.createdAt);
    byCustomer.set(o.email, list);
  }

  const gaps: number[] = [];
  let repeatCustomers = 0;
  for (const dates of byCustomer.values()) {
    if (dates.length < 2) continue;
    repeatCustomers++;
    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const days = Math.round((sorted[i].getTime() - sorted[i - 1].getTime()) / 86_400_000);
      // A same-day second order is a split cart, not a reorder.
      if (days >= 1 && days <= 400) gaps.push(days);
    }
  }

  const medianGap = median(gaps);
  const suggestEveryDays = medianGap == null ? null
    : nearestOffered(medianGap);

  /* Run lengths from the gap, not from a category table: three months of cover is the
     shortest commitment worth selling, and a year is the longest most people will take. */
  const suggestRuns = suggestEveryDays ? runsFor(suggestEveryDays) : [];

  let plans = plansBySize(withEmail, suggestEveryDays, warnings);

  const prod = new Map<string, { orders: number; units: number; revenue: number }>();
  for (const o of live) {
    const seen = new Set<string>();
    for (const it of o.items.filter(paid)) {
      const e = prod.get(it.title) || { orders: 0, units: 0, revenue: 0 };
      if (!seen.has(it.title)) { e.orders++; seen.add(it.title); }
      e.units += it.qty;
      e.revenue += it.qty * it.price;
      prod.set(it.title, e);
    }
  }
  const topProducts = [...prod.entries()]
    .map(([title, v]) => ({ title, ...v }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 8);

  /* Each product's own repeat cycle, and where it goes. A store sells a 30-sachet trial box
     and a 500g tub of the same protein; one window over the whole file averaged them into a
     cadence that was wrong for both. */
  const pDates = new Map<string, Map<string, number[]>>();
  const vDates = new Map<string, Map<string, Map<string, number[]>>>();
  const pOrders = new Map<string, number>(), vOrders = new Map<string, number>(), pTogether = new Map<string, number>();
  const pPrice = new Map<string, number[]>();
  for (const o of withEmail) {
    const lines = o.items.filter(paid);
    const prods = new Set(lines.map((i) => productBase(i.title)));
    for (const it of lines) {
      const pb = productBase(it.title), vn = variantOf(it.title);
      pPrice.set(pb, [...(pPrice.get(pb) || []), it.price]);
      const pm = pDates.get(pb) || new Map<string, number[]>();
      pm.set(o.email, [...(pm.get(o.email) || []), o.createdAt.getTime()]);
      pDates.set(pb, pm);
      const vm = vDates.get(pb) || new Map<string, Map<string, number[]>>();
      const vv = vm.get(vn) || new Map<string, number[]>();
      vv.set(o.email, [...(vv.get(o.email) || []), o.createdAt.getTime()]);
      vm.set(vn, vv); vDates.set(pb, vm);
      vOrders.set(pb + "\u0000" + vn, (vOrders.get(pb + "\u0000" + vn) || 0) + 1);
    }
    for (const pb of prods) {
      pOrders.set(pb, (pOrders.get(pb) || 0) + 1);
      if (prods.size >= 2) pTogether.set(pb, (pTogether.get(pb) || 0) + 1);
    }
  }
  /* The store-wide default when nothing else speaks: the file's own repeat gap if it is
     solid, else monthly. */
  const fallback = medianGap != null && gaps.length >= 20 ? nearestOffered(medianGap) : 30;
  const mix: ProductMix[] = [...pOrders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([title, orders]) => {
    const dates = pDates.get(title)!;
    const c = cycle(dates);
    const together = pTogether.get(title) || 0;
    const raw = [...(vDates.get(title) || new Map()).entries()].map(([name, vd]) => {
      const vc = cycle(vd as Map<string, number[]>);
      const vg = median(vc.gaps);
      return { name, orders: vOrders.get(title + "\u0000" + name) || 0, medianGap: vg, gapN: vc.gaps.length };
    }).sort((x, y) => y.orders - x.orders).slice(0, 8);
    const prodGap = median(c.gaps);
    /* 1 reorders, 2 the pack's own duration ("1 Month"), 3 scaled by pack size from a sibling
       that has one ("2x500g" lasts twice "500g"), 4 the product's measured cycle, 5 default. */
    const first = raw.map((v) => {
      if (v.medianGap != null && v.gapN >= MIN_GAPS) return { ...v, everyDays: nearestOffered(v.medianGap), source: "reorders" as CadenceSource };
      const d = durationDays(v.name);
      if (d) return { ...v, everyDays: nearestOffered(d), source: "pack" as CadenceSource };
      return { ...v, everyDays: 0, source: "default" as CadenceSource };
    });
    const anchor = first.find((v) => v.everyDays && sizeUnits(v.name)) ;
    const base = prodGap != null && c.gaps.length >= MIN_GAPS ? nearestOffered(prodGap)
      : (first.find((v) => v.everyDays)?.everyDays || fallback);
    const ref = anchor || (first[0] && sizeUnits(first[0].name) ? { ...first[0], everyDays: base } : null);
    const variants = first.map((v) => {
      if (v.everyDays) return { name: v.name, orders: v.orders, medianGap: v.medianGap, everyDays: v.everyDays, source: v.source };
      const su = sizeUnits(v.name), ru = ref ? sizeUnits(ref.name) : null;
      if (su && ru && ref && su !== ru) return { name: v.name, orders: v.orders, medianGap: v.medianGap, everyDays: nearestOffered(ref.everyDays * (su / ru)), source: "size" as CadenceSource };
      return { name: v.name, orders: v.orders, medianGap: v.medianGap, everyDays: base,
        source: (prodGap != null && c.gaps.length >= MIN_GAPS ? "reorders" : first.some((x) => x.source === "pack") ? "pack" : "default") as CadenceSource };
    });
    /* Kits, trials, duos and accessories sell in a box: nobody restocks a mug or a trial
       pack on a cycle. Everything else is a consumable and goes on subscription. */
    const kit = KIT.test(title) || raw.every((v) => KIT.test(v.name) && !durationDays(v.name));
    const acc = ACCESSORY.test(title);
    const reordered = c.repeaters >= MIN_REPEATERS;
    const role: ProductMix["role"] = reordered ? "subscription" : kit || acc ? "bundle" : "subscription";
    const why = reordered ? `${c.repeaters} customers reordered it`
      : acc ? "An accessory: bought once, sells with other products"
      : kit ? "A kit or trial pack: a one-time buy, best in a box"
      : variants.some((v) => v.source === "pack") ? "Packs are sold by duration, so it is a refill"
      : "A consumable that runs out";
    return { title, orders, customers: dates.size, price: median(pPrice.get(title) || []) || 0, repeaters: c.repeaters, together, role, why, variants };
  });

  /* One plan group per delivery frequency, from each product's own cycle. */
  const groups = cadenceGroups(mix);
  if (groups.length) {
    plans = groups.map((g) => ({
      label: CADENCE_WORD[g.everyDays] || `Every ${g.everyDays} days`,
      sizes: [],
      products: g.items.map((i) => i.allVariants ? i.title : `${i.title} (${i.variants.join(", ")})`),
      everyDays: g.everyDays, medianGap: g.everyDays, gapSample: 0,
      customers: 0, prepaidRuns: g.runs, autopayCycles: AUTOPAY_CYCLES,
    }));
  }

  const revenue = live.reduce((s, o) => s + o.items.reduce((t, i) => t + i.qty * i.price, 0), 0);

  /* What the store already discounts, read off its own orders. A category table says what
     competitors do; this says what these customers have already accepted, which is the
     number worth anchoring a plan ladder to.
     The rate is discount over the GROSS line total, because the export's discount column is
     currency off a total it does not restate. An order whose lines sum to nothing — a pure
     gift card, a fully refunded row — would divide by zero, so it is left out. */
  const discounted = live
    .map((o) => {
      const gross = o.items.reduce((t, i) => t + i.qty * i.price, 0);
      return { pct: gross > 0 && o.discount > 0 ? (o.discount / gross) * 100 : 0, code: o.discountCode };
    })
    .filter((d) => d.pct > 0 && d.pct <= 100);
  /* Per code. A pay-online discount is a payment nudge (TBW: PREPAID-DISCOUNT, 2%, on 338 of
     541 discounted orders) and dragged the typical rate to 2%; it is set aside. A code's own
     rate is the LOWEST rate it shows with real volume: basics15 reads 15% alone and 17% when
     stacked with the 2% pay-online discount, and 17% is not the promo. */
  const perCode = new Map<string, number[]>();
  for (const d of discounted) {
    const k = d.code || "Automatic discount";
    perCode.set(k, [...(perCode.get(k) || []), Math.round(d.pct)]);
  }
  const codeRate = (ps: number[]) => {
    const n = new Map<number, number>();
    for (const p of ps) n.set(p, (n.get(p) || 0) + 1);
    const real = [...n.entries()].filter(([p, c]) => c >= ps.length * 0.1 && p <= PLAN_RATE_CEILING).map(([p]) => p);
    return real.length ? Math.min(...real) : null;
  };
  let payment: { code: string; pct: number; orders: number } | null = null;
  const promoAll: { code: string; pct: number; orders: number }[] = [];
  for (const [code, ps] of perCode) {
    const pct = codeRate(ps);
    if (pct == null) continue;
    if (PAY_CODE.test(code) && pct <= 5) {
      if (!payment || ps.length > payment.orders) payment = { code, pct, orders: ps.length };
    } else if (!/^custom discount$/i.test(code)) {
      promoAll.push({ code, pct, orders: ps.length });
    }
  }
  const busiestPromo = Math.max(0, ...promoAll.map((p) => p.orders));
  const promos = promoAll.filter((p) => p.orders >= Math.max(3, busiestPromo * PLAN_RATE_SHARE))
    .sort((a, b) => b.orders - a.orders);
  const usualPct = (() => {
    if (!promos.length) return null;
    const sorted = [...promos].sort((a, b) => a.pct - b.pct);
    const half = sorted.reduce((n, p) => n + p.orders, 0) / 2;
    let acc = 0;
    for (const p of sorted) { acc += p.orders; if (acc >= half) return p.pct; }
    return sorted[sorted.length - 1].pct;
  })();
  const pcts = discounted.map((d) => Math.round(d.pct));
  const byBand = new Map<number, number>();
  for (const p of pcts) byBand.set(p, (byBand.get(p) || 0) + 1);
  const byCode = new Map<string, number>();
  for (const d of discounted) if (d.code) byCode.set(d.code, (byCode.get(d.code) || 0) + 1);
  const discounts = {
    orders: discounted.length,
    share: live.length ? discounted.length / live.length : 0,
    medianPct: median(pcts),
    maxPct: pcts.length ? Math.max(...pcts) : null,
    bands: [...byBand.entries()].map(([pct, n]) => ({ pct, orders: n }))
      .sort((a, b) => b.orders - a.orders || b.pct - a.pct).slice(0, 5),
    codes: [...byCode.entries()].map(([code, n]) => ({ code, orders: n }))
      .sort((a, b) => b.orders - a.orders).slice(0, 5),
    payment,
    promos: promos.slice(0, 5),
    usualPct,
  };

  /* Build Your Own Box: products customers already put in one cart. Variants fold into the
     product ("GG Matcha - 30 Gms" and "- 100 Gms" are one pick), so the box lists products. */
  const base = (t: string) => t.replace(/\s+-\s+[^-]+$/, "").trim();
  const multi = live.map((o) => [...new Set(o.items.filter(paid).map((i) => base(i.title)).filter(Boolean))]).filter((ts) => ts.length >= 2);
  const pairN = new Map<string, number>();
  const inMulti = new Map<string, number>();
  for (const ts of multi) {
    for (const t of ts) inMulti.set(t, (inMulti.get(t) || 0) + 1);
    const srt = [...ts].sort();
    for (let i = 0; i < srt.length; i++) for (let j = i + 1; j < srt.length; j++) {
      const k = srt[i] + "\u0000" + srt[j];
      pairN.set(k, (pairN.get(k) || 0) + 1);
    }
  }
  const boxable = mix.filter((m) => m.role === "bundle").length;
  const byob: ByobSuggestion | null = multi.length >= 10 && multi.length >= live.length * 0.05 && boxable >= 2 ? {
    share: live.length ? multi.length / live.length : 0,
    multiOrders: multi.length,
    /* Only products that belong in a box (kits, trials, accessories). Refills are on
       subscription, so the two lists never overlap. */
    pool: mix.filter((m) => m.role === "bundle").map((m) => ({ title: m.title, orders: m.orders }))
      .sort((a, b) => b.orders - a.orders).slice(0, 8),
    pairs: [...pairN.entries()].map(([k, orders]) => { const [a, b] = k.split("\u0000"); return { a, b, orders }; })
      .sort((x, y) => y.orders - x.orders).slice(0, 5),
    size: Math.min(4, Math.max(2, median(multi.map((t) => t.length)) || 2)),
  } : null;

  if (gaps.length > 0 && gaps.length < 20) {
    warnings.push(`Only ${gaps.length} repeat intervals in this file, so the median gap is indicative rather than solid. Export a longer window if you can.`);
  }
  if (medianGap !== null && medianGap <= 2) {
    warnings.push("The median gap is a day or two, which usually means the file carries split carts or draft orders rather than genuine reorders. Check the source column before trusting it.");
  }

  return {
    orders: rows.length,
    cancelled,
    noEmail,
    customers: byCustomer.size,
    repeatCustomers,
    repeatRate: byCustomer.size ? repeatCustomers / byCustomer.size : 0,
    medianGap,
    gapSample: gaps.length,
    suggestEveryDays,
    suggestRuns,
    plans,
    topProducts,
    aov: live.length ? revenue / live.length : 0,
    windowDays: live.length > 1
      ? Math.max(1, Math.round(
        (Math.max(...live.map((o) => o.createdAt.getTime()))
          - Math.min(...live.map((o) => o.createdAt.getTime()))) / 86_400_000))
      : null,
    discounts,
    byob,
    mix,
    warnings,
  };
}

/* ---------------------------------------------------------------- reading the rest of it */

/** The category the products in this file belong to.
 *
 *  A guess, and a cheap one: the form asks for a category and the file already names what
 *  the store sells, so leaving it to be picked by hand beside a panel listing "Chicken
 *  Pumpkin Fresh Dog Food" five times over is the form ignoring its own evidence. Scored
 *  across the top products by order count, so one stray title cannot decide it, and it
 *  returns null rather than "other" when nothing matches — a wrong category is worse than an
 *  unanswered one, because the whole suggestion panel keys off it.
 */
const CATEGORY_WORDS: { id: string; words: RegExp }[] = [
  { id: "pet", words: /\b(dog|cat|puppy|kitten|pet|kibble|paw|treats? for)\b/i },
  { id: "coffee-tea", words: /\b(coffee|espresso|arabica|robusta|tea|chai|matcha|brew|beans?)\b/i },
  { id: "supplements", words: /\b(supplement|vitamin|protein|collagen|omega|probiotic|capsule|tablet|gummies|booster|nutrition|whey|creatine|electrolyte|ashwagandha|multivitamin|scoop)\b/i },
  { id: "personal-care", words: /\b(shampoo|conditioner|serum|cream|lotion|soap|skin|hair|face|body wash|moistur)\b/i },
  { id: "beverages", words: /\b(juice|kombucha|soda|drink|mix|smoothie|cordial|syrup|hydration)\b/i },
  { id: "food-staples", words: /\b(rice|atta|flour|dal|oil|ghee|masala|spice|sugar|salt|snack|chikki|mittai|namkeen)\b/i },
  { id: "home", words: /\b(detergent|cleaner|cleaning|dish ?wash|floor|laundry|refill|wipes?)\b/i },
];

export function guessCategory(top: { title: string; orders: number }[]): string | null {
  const score = new Map<string, number>();
  /* One category per product, supplements first: "Plant Protein Coffee" is a protein in a
     coffee flavour, and counting its flavour word scored a protein store as coffee and tea. */
  const order = ["supplements", ...CATEGORY_WORDS.map((c) => c.id).filter((id) => id !== "supplements")];
  for (const p of top) {
    const hit = order.map((id) => CATEGORY_WORDS.find((c) => c.id === id)!).find((c) => c.words.test(p.title));
    if (hit) score.set(hit.id, (score.get(hit.id) || 0) + p.orders);
  }
  if (!score.size) return null;
  const [best] = [...score.entries()].sort((a, b) => b[1] - a[1]);
  return best[0];
}

/** A brand name out of the file's own name.
 *
 *  A Shopify order export carries no store-name column, so the only thing on hand is what the
 *  merchant called the file. `orders_export_1.csv` says nothing and must stay empty rather
 *  than becoming a brand called "Orders Export 1"; `blepworld-orders-2026.csv` says plenty.
 *  So: strip the words every export carries, strip dates and numbers, and keep what is left
 *  only if something is.
 */
export function brandFromFilename(name: string): string | null {
  const stem = name.replace(/\.[a-z0-9]+$/i, "");
  /* Separators are normalised FIRST. `_` is a word character, so `\borders\b` never matches
     inside `orders_export_1` and the whole strip silently did nothing on the commonest
     filename Shopify produces. */
  const cleaned = stem
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\b(orders?|export|exports|shopify|all|csv|xlsx?|report|data|screencapture|screenshot|final|copy|new)\b/gi, " ")
    .replace(/\b\d+\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (cleaned.length < 3) return null;
  return cleaned
    .split(/\s+/)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}


/** One plan per pack-size band, where the file supports a split.
 *
 *  Customers are assigned to the band they actually buy from — by order count, not by a
 *  single purchase — and each band's gaps are measured among its own customers only. A
 *  split is offered only when both bands carry enough intervals to mean anything AND their
 *  cadences land on different offered frequencies. A 29-day gap and a 31-day gap are the
 *  same plan; printing two of them is noise dressed as insight.
 */
function plansBySize(
  withEmail: OrderRow[], overall: number | null, warnings: string[],
): PlanSuggestion[] {
  const all = (): PlanSuggestion[] => overall == null ? [] : [{
    label: "All products",
    sizes: [], products: [],
    everyDays: overall,
    medianGap: overall,
    gapSample: 0,
    customers: new Set(withEmail.map((o) => o.email)).size,
    prepaidRuns: runsFor(overall),
    autopayCycles: AUTOPAY_CYCLES,
  }];

  /* Every distinct size the file names, weighted by how many orders carried it. */
  const sized = new Map<number, { text: string; orders: number }>();
  for (const o of withEmail) {
    for (const it of o.items) {
      const ps = packSize(it.title);
      if (!ps) continue;
      const e = sized.get(ps.grams) || { text: ps.text, orders: 0 };
      e.orders++;
      sized.set(ps.grams, e);
    }
  }
  if (sized.size < 2) return all();

  /* Split at the median SIZE weighted by orders, so the line falls where the volume is
     rather than between two sizes nobody buys. */
  const bySize = [...sized.entries()].sort((a, b) => a[0] - b[0]);
  const totalOrders = bySize.reduce((n, [, v]) => n + v.orders, 0);
  let seen = 0;
  let cut = bySize[0][0];
  for (const [g, v] of bySize) { seen += v.orders; cut = g; if (seen >= totalOrders / 2) break; }
  const smallSizes = bySize.filter(([g]) => g <= cut);
  const largeSizes = bySize.filter(([g]) => g > cut);
  if (!smallSizes.length || !largeSizes.length) return all();

  /* Which band a customer belongs to: whichever they ordered from more often. */
  const bandOf = (title: string): "small" | "large" | null => {
    const ps = packSize(title);
    return ps ? (ps.grams <= cut ? "small" : "large") : null;
  };
  const byCustomer = new Map<string, { small: number; large: number; dates: { band: string; at: Date }[] }>();
  for (const o of withEmail) {
    const e = byCustomer.get(o.email) || { small: 0, large: 0, dates: [] };
    let band: string | null = null;
    for (const it of o.items) {
      const b = bandOf(it.title);
      if (!b) continue;
      e[b]++;
      band = band ?? b;
    }
    if (band) e.dates.push({ band, at: o.createdAt });
    byCustomer.set(o.email, e);
  }

  const gapsFor = (want: "small" | "large") => {
    const gaps: number[] = [];
    let customers = 0;
    for (const e of byCustomer.values()) {
      const mine = e.small === e.large ? null : e.small > e.large ? "small" : "large";
      if (mine !== want) continue;
      customers++;
      const ds = e.dates.map((d) => d.at).sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < ds.length; i++) {
        const days = Math.round((ds[i].getTime() - ds[i - 1].getTime()) / 86_400_000);
        if (days >= 1 && days <= 400) gaps.push(days);
      }
    }
    return { gaps, customers };
  };

  const small = gapsFor("small");
  const large = gapsFor("large");
  const sg = median(small.gaps);
  const lg = median(large.gaps);
  /* Both have to say something, and they have to say different things. */
  if (sg == null || lg == null || small.gaps.length < 15 || large.gaps.length < 15) return all();
  const sEvery = nearestOffered(sg);
  const lEvery = nearestOffered(lg);
  if (sEvery === lEvery) {
    warnings.push(
      `Smaller and larger packs reorder at much the same rate (${sg} and ${lg} days), so one plan covers both.`,
    );
    return all();
  }

  const titlesFor = (want: "small" | "large") => {
    const n = new Map<string, number>();
    for (const o of withEmail) for (const it of o.items) {
      if (bandOf(it.title) === want) n.set(it.title, (n.get(it.title) || 0) + 1);
    }
    return [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);
  };
  const mk = (
    label: string, sizes: [number, { text: string; orders: number }][],
    g: number, every: number, got: { gaps: number[]; customers: number }, want: "small" | "large",
  ): PlanSuggestion => ({
    label,
    sizes: sizes.map(([, v]) => v.text),
    products: titlesFor(want),
    everyDays: every,
    medianGap: g,
    gapSample: got.gaps.length,
    customers: got.customers,
    prepaidRuns: runsFor(every),
    autopayCycles: AUTOPAY_CYCLES,
  });
  return [
    mk("Smaller packs", smallSizes, sg, sEvery, small, "small"),
    mk("Larger packs", largeSizes, lg, lEvery, large, "large"),
  ];
}

/** The deepest rate a plan may be built at. Anything above this in an export is a staff
 *  order, a replacement or a full refund, never a subscription tier. */
export const PLAN_RATE_CEILING = 60;

/** A product needs this many repeat intervals for its cycle to be read, and this many
 *  customers who came back for it, to be offered on subscription. */
export const MIN_GAPS = 3;
export const MIN_REPEATERS = 3;

/** Box sizes and their discount for a Build Your Own Box, off the store's usual promo rate:
 *  the smallest box at that rate, +3 for the next size, +5 for the one after. */
export function byobTiers(b: ByobSuggestion, usualPct: number | null): { size: number; pct: number }[] {
  const base = usualPct && usualPct > 0 ? usualPct : 10;
  const max = Math.min(4, b.pool.length);
  return [0, 3, 5].slice(0, Math.max(0, max - 1)).map((add, i) => ({ size: 2 + i, pct: Math.min(PLAN_RATE_CEILING, base + add) }));
}

/** Discount codes that pay for a payment method (pay online, not COD), not for the product. */
export const PAY_CODE = /prepaid|\bcod\b|online|upi|card|wallet|payment|gokwik|razorpay|snapmint/i;

/** A rate needs this share of the busiest band's volume to count as something the store
 *  runs, rather than a clearance code or a one-week promo. */
export const PLAN_RATE_SHARE = 0.1;

/** The two ends of a plan ladder, read off the store's own orders: `[base, top]`, or `[base]`
 *  where the file shows no room above it, or `[]` where it shows no discounting at all.
 *
 *  Three rules this has been wrong about, each of which reached a client's document:
 *
 *  1. It read `maxPct`, the deepest SINGLE order. One 100%-off replacement set the top of the
 *     ladder and the widget priced every delivery at zero.
 *  2. It read the extremes of every rate clearing a 2% floor, so a one-week promo and a
 *     clearance code became the two ends of the plan — 5/18/30 on a store that runs 12.
 *  3. It read only the most-voluminous rate, which on a store that discounts ad hoc is its
 *     cheapest code, and proposed a 5% subscription on a file whose median order is 12% off.
 *
 *  So: start at the discount its customers typically already get, because a subscription has
 *  to beat a one-off, and rise towards the deepest rate the store genuinely runs — capped at
 *  twice the base, so a thin 30% code cannot drag the whole ladder up behind it. */
export function planRates(d: OrderInsight["discounts"]): number[] {
  /* The store's own promo codes first, with the pay-online discount set aside. */
  if (d.usualPct != null && d.usualPct > 0) {
    const base = d.usualPct;
    const top = Math.min(Math.max(base, ...d.promos.map((p) => p.pct)), base * 2, PLAN_RATE_CEILING);
    return top > base ? [base, top] : [base];
  }
  /* No codes to read: the median of the orders that are not a pay-online discount. */
  const pool = d.bands.filter((b) => b.pct > 0 && b.pct <= PLAN_RATE_CEILING);
  if (!pool.length) return [];
  /* The median of the discounted orders, not the busiest band: the busiest band on a store
     that discounts by hand is whichever coupon it mailed most, which is its cheapest. */
  const busiest = Math.max(...pool.map((b) => b.orders));
  const base = Math.round(
    d.medianPct != null && d.medianPct > 0 && d.medianPct <= PLAN_RATE_CEILING ? d.medianPct : pool[0].pct,
  );
  const real = pool.filter((b) => b.orders >= busiest * PLAN_RATE_SHARE).map((b) => b.pct);
  const top = Math.min(Math.max(base, ...real), base * 2, PLAN_RATE_CEILING);
  return top > base ? [base, Math.round(top)] : [base];
}
