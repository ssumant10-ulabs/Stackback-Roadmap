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
  /** Nearest frequency we actually offer. */
  suggestEveryDays: number | null;
  suggestRuns: number[];
  topProducts: { title: string; orders: number; units: number; revenue: number }[];
  aov: number;
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
  const suggestRuns = suggestEveryDays
    ? [...new Set([
        Math.max(2, Math.round(90 / suggestEveryDays)),
        Math.max(3, Math.round(180 / suggestEveryDays)),
        Math.max(4, Math.round(365 / suggestEveryDays)),
      ])].sort((a, b) => a - b).slice(0, 3)
    : [];

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
    topProducts,
    aov: live.length ? revenue / live.length : 0,
    warnings,
  };
}
