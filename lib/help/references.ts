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

/** Percentages out of free text: "15%", "10-20%", "10/15/20", "upto 18 percent", and the
 *  sheet's own "15 max, so 15, 12, 10".
 *
 *  The figure pattern reads a decimal whole. A `\d{1,2}` one could not, so it walked past
 *  "12.5" in "12.52%", matched the "52%" that was left, and reported a fifty-two percent
 *  discount: wrong in a way that reads as deliberate. */
export function parseDiscounts(text: string | null | undefined): number[] {
  if (blank(text)) return [];
  const out: number[] = [];
  const num = String.raw`\d{1,3}(?:\.\d+)?`;
  /* Ranges first. "10-20%" carries the sign only on the second number, so a pass that
     requires one per figure reads it as a single 20 and loses the low end of the band. */
  const range = new RegExp(`(${num})\\s*(?:-|to|–|—)\\s*(${num})\\s*(?:%|percent)?`, "gi");
  let m: RegExpExecArray | null;
  while ((m = range.exec(text!))) { out.push(Number(m[1]), Number(m[2])); }
  const re = new RegExp(`(${num})\\s*(?:%|percent|pc\\b)`, "gi");
  while ((m = re.exec(text!))) if (!out.includes(Number(m[1]))) out.push(Number(m[1]));
  if (!out.length) {
    // "10-20" and "10/15/20" with the sign only on the last one, or missing entirely.
    const nums = (text!.match(new RegExp(`\\b${num}\\b`, "g")) || []).map(Number);
    out.push(...nums.filter((n) => n >= 3 && n <= 60));
  }
  return out.filter((n) => n > 0 && n <= 60);
}

/** Every way the sheet writes a cadence, longest first so "Bi-Monthly" is never read as a
 *  plain "Monthly". The separator is loose on purpose: one column holds "Bi-Weekly",
 *  "Bi- Monthly" and "BiWeekly". */
/* The lookbehind is the whole of "12 months": a number at the END of a list is a run
   length and the unit word is the cadence ("3, 6 & 12 months" is monthly, sold three,
   six and twelve deliveries at a time), while a number on its own IS the cadence
   ("3 months - 2, 4" is quarterly). Without it that store read as a yearly plan. */
const CADENCE = String.raw`\bbi[-\s]*monthly\b|\bbi[-\s]*weekly\b|\bfortnight(?:ly)?\b|\bquarterly\b|\bmonthly\b|\bweekly\b|\b\d{1,3}\s*days?\b|(?<!\d\s*[,&]\s*)\b\d{1,2}\s*months?\b|(?<!\d\s*[,&]\s*)\b\d{1,2}\s*weeks?\b|\bmonths?\b|\bweeks?\b`;

function cadenceDays(token: string): number {
  const t = token.toLowerCase();
  if (/^bi[-\s]*monthly/.test(t)) return 60;
  if (/^bi[-\s]*weekly/.test(t)) return 14;
  if (/^fortnight/.test(t)) return 14;
  if (/^quarterly/.test(t)) return 90;
  if (/^monthly/.test(t)) return 30;
  if (/^weekly/.test(t)) return 7;
  const n = Number((t.match(/\d+/) || ["1"])[0]);
  if (/month/.test(t)) return n * 30;
  if (/week/.test(t)) return n * 7;
  return n;
}

/** Run lengths out of a fragment, however they are written: "3, 6, 12", "x 6", "6 cycles"
 *  and "2x, 3x, 4x" are the same thing said four ways, so read the numbers and stop
 *  requiring the word. */
function runsIn(fragment: string): number[] {
  return uniq((fragment.match(/\d{1,3}/g) || []).map(Number).filter((n) => n >= 2 && n <= 60));
}

/** Cadence and run lengths out of one free-text cell.
 *
 *  The sheet's own shape is `Cadence - n, n, n`: "Monthly - 3, 6, 9" is a monthly plan sold
 *  at three, six and nine deliveries. */
export function parseFrequency(text: string | null | undefined): { everyDays: number[]; deliveries: number[] } {
  const plans = parsePlans(text);
  return {
    everyDays: uniq(plans.flatMap((p) => p.everyDays)),
    deliveries: uniq(plans.flatMap((p) => p.deliveries)),
  };
}

/** The same cell, one entry per cadence, so each keeps its OWN run lengths.
 *
 *  Anchored on the cadence words rather than split on a separator. Splitting was the bug:
 *  the 39 filled-in rows separate their clauses with a semicolon, a colon, an ampersand and
 *  a bare comma, and a comma is also what separates the run lengths, so no split character
 *  is safe. Reading "Weekly- 6, Monthly- 3" by splitting on the comma gives one weekly plan
 *  and a naked "Monthly- 3"; reading it by cadence gives the two plans the store sells.
 *
 *  Held to `scripts/fixtures/pilot-plans.json`, which is every filled-in plan cell from the
 *  live Pilots tab rather than shapes imagined here. */
export function parsePlans(text: string | null | undefined): { everyDays: number[]; deliveries: number[] }[] {
  if (blank(text)) return [];
  const src = text!;
  const hits: { days: number; from: number; to: number }[] = [];
  const re = new RegExp(CADENCE, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) hits.push({ days: cadenceDays(m[0]), from: m.index, to: m.index + m[0].length });

  /* No cadence named at all. "2x, 3x, 4x, prepaid only" is a real cell: a run ladder with
     the cadence left out, which is worth showing as exactly that rather than as nothing. */
  if (!hits.length) {
    const runs = runsIn(src);
    return runs.length ? [{ everyDays: [], deliveries: runs }] : [];
  }

  return hits.map((h, i) => {
    const tail = src.slice(h.to, hits[i + 1]?.from ?? src.length);
    let runs = runsIn(tail);
    /* "3, 6 & 12 monthly & bi-weekly 3, 6, 12": the first ladder is written before its own
       cadence. Only the first cadence in a cell can claim what came before it. */
    if (!runs.length && i === 0) runs = runsIn(src.slice(0, h.from));
    return { everyDays: [h.days], deliveries: runs };
  });
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

/** Every pilot category that maps onto one PLAN category, merged into a single reference.
 *
 *  The sheet has seven categories and the plan form has eight, and they are not the same
 *  seven: "Coffee Brands" and "Tea Brands" both land on `coffee-tea`, and "Food & Grocery
 *  Brands" and "Specialty Food & Snacks" both land on `food-staples`. Looking up by the
 *  first match showed a merchant selling tea the coffee stores and nothing else, which is
 *  half the cohort and the wrong half. */
export function referenceFor(
  pilots: PilotStore[], planId: string, mapId: (label: string) => string | null,
): CategoryReference | null {
  const parts = categoryReferences(pilots).filter((r) => mapId(r.label) === planId);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return {
    // Named for what it covers, so nobody reads a merged reference as one sheet category.
    label: parts.map((p) => p.label).join(" and "),
    stores: parts.flatMap((p) => p.stores),
    discounts: parts.flatMap((p) => p.discounts),
    everyDays: byFrequency(parts.flatMap((p) => p.everyDays)),
    deliveries: byFrequency(parts.flatMap((p) => p.deliveries)),
    payment: parts.reduce((a, p) => ({
      prepaid: a.prepaid + p.payment.prepaid,
      payg: a.payg + p.payment.payg,
      both: a.both + p.payment.both,
    }), { prepaid: 0, payg: 0, both: 0 }),
    bundles: parts.reduce((a, p) => a + p.bundles, 0),
    unlogged: parts.flatMap((p) => p.unlogged),
  };
}

/** Days between deliveries, said the way a merchant says it. */
export function freqLabel(days: number): string {
  if (days === 7) return "Weekly";
  if (days === 14) return "Fortnightly";
  if (days === 30) return "Monthly";
  if (days === 60) return "Every two months";
  if (days === 90) return "Quarterly";
  if (days === 365 || days === 360) return "Yearly";
  // "Every 150 days" is a number nobody says out loud; the month it lands on is.
  if (days > 90 && days % 30 === 0) return `Every ${days / 30} months`;
  return `Every ${days} days`;
}

/** The payment column, said the way a merchant says it.
 *
 *  The sheet writes "Both", which is our shorthand for the two modes and tells a reader
 *  nothing about which two. It also writes "PAYG" and "Auto-Pay", which are ours rather than
 *  anybody's product language. */
export function paymentLabel(v: string | null | undefined): string | null {
  const t = (v || "").trim();
  if (!t) return null;
  if (/^both$/i.test(t)) return "Prepaid and pay as you go";
  if (/^payg$|^pay.?as.?you.?go$/i.test(t)) return "Pay as you go";
  if (/^auto.?pay$|^auto.?debit$/i.test(t)) return "AutoPay";
  if (/^prepaid$/i.test(t)) return "Prepaid";
  return t;
}

/** The shipping column, which is a rupee figure as often as a word. A bare "60" is a
 *  per-delivery charge and a bare "0" is free; printing either as itself reads as a code. */
export function shippingLabel(v: string | null | undefined): string | null {
  const t = (v || "").trim();
  if (!t) return null;
  if (/^free$/i.test(t)) return "Free";
  if (/^0+$/.test(t)) return "Free";
  if (/^\d{1,5}$/.test(t)) return `₹${t} per delivery`;
  return t;
}
