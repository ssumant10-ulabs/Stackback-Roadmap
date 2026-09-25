/** What the cohort actually runs, per category, read off the pilot rows at the moment the
 *  page renders.
 *
 *  The category suggestions in `categories.ts` were written from what the cohort ran in
 *  July. The activation columns are filled in now, so the honest version is derived rather
 *  than remembered: nothing is copied into a file that can go stale, and whatever the team
 *  types into the Pilots tab is what a merchant is shown the next time the page loads.
 *
 *  `discountMargin`, `frequency` and `shipping` are free-text columns, because they were
 *  free text on the sheet before they were here. So the parsers are deliberately tolerant
 *  and deliberately honest: a row they cannot read is counted as unread, not as zero, and
 *  the panel says how many of a category's stores it managed to read. A confident average
 *  over three of eleven rows is the same mistake as a confident brand colour that belongs
 *  to nobody. */
import type { PilotStore } from "../types";

export interface CategoryReference {
  /** The pilot sheet's own category wording. */
  label: string;
  /** Every store in the category, and how many of them logged each thing. */
  stores: string[];
  discounts: number[];
  everyDays: number[];
  deliveries: number[];
  /** Prepaid / PAYG / Both, counted. */
  payment: { prepaid: number; payg: number; both: number };
  bundles: number;
  /** Rows with nothing in the plan columns at all. Named so the gap is visible. */
  unlogged: string[];
}

const blank = (v: string | null | undefined) => {
  const t = (v || "").trim();
  return !t || t === "—" || t === "-" || /^n\/?a$/i.test(t);
};

/** Percentages out of free text: "15%", "10-20%", "10/15/20", "upto 18 percent". */
export function parseDiscounts(text: string | null | undefined): number[] {
  if (blank(text)) return [];
  const out: number[] = [];
  /* Ranges first. "10-20%" carries the sign only on the second number, so a pass that
     requires one per figure reads it as a single 20 and loses the low end of the band. */
  const range = /(\d{1,2}(?:\.\d)?)\s*(?:-|to|\u2013|\u2014)\s*(\d{1,2}(?:\.\d)?)\s*(?:%|percent)?/gi;
  let m: RegExpExecArray | null;
  while ((m = range.exec(text!))) { out.push(Number(m[1]), Number(m[2])); }
  const re = /(\d{1,2}(?:\.\d)?)\s*(?:%|percent|pc\b)/gi;
  while ((m = re.exec(text!))) if (!out.includes(Number(m[1]))) out.push(Number(m[1]));
  if (!out.length) {
    // "10-20" and "10/15/20" with the sign only on the last one, or missing entirely.
    const nums = (text!.match(/\b\d{1,2}(?:\.\d)?\b/g) || []).map(Number).filter((n) => n >= 3 && n <= 60);
    out.push(...nums);
  }
  return out.filter((n) => n > 0 && n <= 60);
}

const WORD_DAYS: [RegExp, number][] = [
  [/\bweekly\b/i, 7], [/\bfortnight(ly)?\b/i, 14], [/\bbi[- ]?weekly\b/i, 14],
  [/\bmonthly\b/i, 30], [/\bbi[- ]?monthly\b/i, 60], [/\bquarterly\b/i, 90],
  [/\b15\s*days?\b/i, 15], [/\b45\s*days?\b/i, 45],
];

/** Cadence and run length out of one free-text cell: "Monthly x 6", "every 15 days, 3
 *  cycles", "30 days / 6 deliveries", "fortnightly". */
export function parseFrequency(text: string | null | undefined): { everyDays: number[]; deliveries: number[] } {
  if (blank(text)) return { everyDays: [], deliveries: [] };
  const t = text!;
  const everyDays: number[] = [];
  const deliveries: number[] = [];

  for (const [re, d] of WORD_DAYS) if (re.test(t)) everyDays.push(d);
  const dre = /(\d{1,3})\s*(?:-|\s)?\s*days?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = dre.exec(t))) { const n = Number(m[1]); if (n >= 3 && n <= 180) everyDays.push(n); }

  // A run length: "x 6", "6 cycles", "6 deliveries", "6 months".
  const cre = /(?:x\s*|×\s*)?(\d{1,2})\s*(?:cycles?|deliveries|deliveres|months?|times)\b/gi;
  while ((m = cre.exec(t))) { const n = Number(m[1]); if (n >= 2 && n <= 24) deliveries.push(n); }
  const xre = /\b[x×]\s*(\d{1,2})\b/gi;
  while ((m = xre.exec(t))) { const n = Number(m[1]); if (n >= 2 && n <= 24) deliveries.push(n); }

  return { everyDays: uniq(everyDays), deliveries: uniq(deliveries) };
}

const uniq = (a: number[]) => [...new Set(a)];

/** Most common first, ties broken by the smaller number: a tie between fortnightly and
 *  monthly should read as the tighter cadence, which is the one a merchant under-sets. */
export function byFrequency(values: number[]): number[] {
  const n = new Map<number, number>();
  for (const v of values) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([v]) => v);
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round(((s[mid - 1] + s[mid]) / 2) * 10) / 10;
}

/** One reference per category the cohort actually has stores in. Categories with no stores
 *  are left out rather than shown empty: a category with nothing in it is not a reference. */
export function categoryReferences(pilots: PilotStore[]): CategoryReference[] {
  const byCat = new Map<string, PilotStore[]>();
  for (const p of pilots) {
    const label = (p.category || "").trim();
    if (!label || label === "—") continue;
    const list = byCat.get(label) || [];
    list.push(p);
    byCat.set(label, list);
  }

  const out: CategoryReference[] = [];
  for (const [label, list] of byCat) {
    const discounts: number[] = [];
    const everyDays: number[] = [];
    const deliveries: number[] = [];
    const payment = { prepaid: 0, payg: 0, both: 0 };
    let bundles = 0;
    const unlogged: string[] = [];

    for (const p of list) {
      const d = parseDiscounts(p.discountMargin);
      const f = parseFrequency(p.frequency);
      discounts.push(...d);
      everyDays.push(...f.everyDays);
      deliveries.push(...f.deliveries);

      const pay = (p.paymentType || "").toLowerCase();
      if (pay.includes("both")) payment.both++;
      else if (pay.includes("prepaid")) payment.prepaid++;
      else if (pay.includes("payg") || pay.includes("pay as")) payment.payg++;

      if (/^yes$/i.test((p.bundles || "").trim())) bundles++;
      if (!d.length && !f.everyDays.length && !f.deliveries.length && !pay) unlogged.push(p.name);
    }

    out.push({
      label,
      stores: list.map((p) => p.name),
      discounts,
      everyDays: byFrequency(everyDays),
      deliveries: byFrequency(deliveries),
      payment,
      bundles,
      unlogged,
    });
  }
  // Biggest cohort first: the category with the most stores behind it is the best reference.
  return out.sort((a, b) => b.stores.length - a.stores.length || a.label.localeCompare(b.label));
}

/** How much of a category is actually logged, 0 to 1. Below a third, the panel says so
 *  rather than quoting a median over three rows as though it were the cohort. */
export function coverage(r: CategoryReference): number {
  if (!r.stores.length) return 0;
  return (r.stores.length - r.unlogged.length) / r.stores.length;
}

export function discountBand(r: CategoryReference): { low: number; mid: number; high: number } | null {
  if (!r.discounts.length) return null;
  const s = [...r.discounts].sort((a, b) => a - b);
  return { low: s[0], mid: median(s)!, high: s[s.length - 1] };
}
