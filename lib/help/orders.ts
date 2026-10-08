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
  };
  warnings: string[];
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

/** The frequencies the widget offers, so a suggestion is always one a merchant can pick. */
const OFFERED = [7, 14, 30, 60];
const nearestOffered = (days: number) =>
  OFFERED.reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a), OFFERED[0]);

/** The runs worth selling at a cadence: roughly three months, six months and a year.
 *  Prepaid only — AutoPay has no run, which is the point of it. */
const runsFor = (everyDays: number) => [...new Set([
  Math.max(2, Math.round(90 / everyDays)),
  Math.max(3, Math.round(180 / everyDays)),
  Math.max(4, Math.round(365 / everyDays)),
])].sort((a, b) => a - b).slice(0, 3);

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
    : OFFERED.reduce((a, b) => (Math.abs(b - medianGap) < Math.abs(a - medianGap) ? b : a), OFFERED[0]);

  /* Run lengths from the gap, not from a category table: three months of cover is the
     shortest commitment worth selling, and a year is the longest most people will take. */
  const suggestRuns = suggestEveryDays ? runsFor(suggestEveryDays) : [];

  const plans = plansBySize(withEmail, suggestEveryDays, warnings);

  const prod = new Map<string, { orders: number; units: number; revenue: number }>();
  for (const o of live) {
    const seen = new Set<string>();
    for (const it of o.items) {
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
  };

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
  { id: "supplements", words: /\b(supplement|vitamin|protein|collagen|omega|probiotic|capsule|tablet|gummies|booster|nutrition)\b/i },
  { id: "personal-care", words: /\b(shampoo|conditioner|serum|cream|lotion|soap|skin|hair|face|body wash|moistur)\b/i },
  { id: "beverages", words: /\b(juice|kombucha|soda|drink|mix|smoothie|cordial|syrup|hydration)\b/i },
  { id: "food-staples", words: /\b(rice|atta|flour|dal|oil|ghee|masala|spice|sugar|salt|snack|chikki|mittai|namkeen)\b/i },
  { id: "home", words: /\b(detergent|cleaner|cleaning|dish ?wash|floor|laundry|refill|wipes?)\b/i },
];

export function guessCategory(top: { title: string; orders: number }[]): string | null {
  const score = new Map<string, number>();
  for (const p of top) {
    for (const c of CATEGORY_WORDS) {
      if (c.words.test(p.title)) score.set(c.id, (score.get(c.id) || 0) + p.orders);
    }
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

/** How much of a store's discounted volume the ladder has to be built from. The rates that
 *  carry the bulk of the orders are the ones the store runs; everything past that is a promo,
 *  a win-back or a clearance code, and those are not tiers. */
export const PLAN_RATE_COVERAGE = 0.6;

/** The rates worth anchoring a plan ladder to, ascending.
 *
 *  Two things this has been wrong about, both of which reached a client's document:
 *
 *  1. It read `maxPct`, the deepest SINGLE order. One 100%-off replacement then set the top
 *     of the ladder and the widget priced every delivery at zero.
 *  2. It then read the lowest and highest rate that cleared a 2% floor, which on a file of a
 *     few thousand discounted orders is any code used a few dozen times. A one-week 5% promo
 *     and a clearance 30% became the two ends of the plan — 5/18/30 on a store that runs 10.
 *
 *  So: take the rates in order of volume until they account for most of the discounting, and
 *  build the ladder out of those. A store with one house rate gets one rate, flat, which is
 *  the honest answer rather than an invented slope. */
export function planRates(d: OrderInsight["discounts"]): number[] {
  const pool = d.bands.filter((b) => b.pct > 0 && b.pct <= PLAN_RATE_CEILING);
  if (!pool.length) return [];
  const total = pool.reduce((n, b) => n + b.orders, 0);
  /* `bands` arrives sorted by volume, so this walks the rates the store leans on first. */
  const keep: typeof pool = [];
  let seen = 0;
  for (const b of pool) {
    keep.push(b);
    seen += b.orders;
    if (seen >= total * PLAN_RATE_COVERAGE) break;
  }
  return [...new Set(keep.map((b) => Math.round(b.pct)))].sort((a, b) => a - b);
}
