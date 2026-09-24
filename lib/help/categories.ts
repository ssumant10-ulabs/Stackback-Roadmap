/** What we propose before a store's own data is read, by category.
 *
 *  These come from what the pilot cohort actually runs, not from theory: coffee and tea
 *  reorder fastest, supplements settle on a month because that is how a jar is dosed, pet
 *  food follows bag size, and personal care is the slowest and the one most often set too
 *  frequent. They are a starting point for the conversation, and the store's own repeat gap
 *  overrules them every time, which is why the UI says so rather than presenting them as
 *  an answer. */

export interface CategorySuggestion {
  id: string;
  label: string;
  /** Days between deliveries, most common first. */
  everyDays: number[];
  /** Run lengths that sell in this category. */
  deliveries: number[];
  /** A discount band per run length, same order as `deliveries`. */
  discounts: number[];
  why: string;
}

export const CATEGORIES: CategorySuggestion[] = [
  {
    id: "coffee-tea", label: "Coffee and tea",
    everyDays: [14, 30], deliveries: [3, 6, 12], discounts: [10, 15, 20],
    why: "A 250g bag lasts a fortnight in a two-person household, so fortnightly is the honest default and monthly is the safe one. Discounts stay modest because the category already reorders.",
  },
  {
    id: "supplements", label: "Supplements and nutrition",
    everyDays: [30], deliveries: [3, 6, 12], discounts: [15, 18, 20],
    why: "A jar is dosed to a month, so anything but monthly fights the product. Three months is the shortest run worth selling, because the customer has not felt the benefit before that.",
  },
  {
    id: "pet", label: "Pet food and care",
    everyDays: [30, 60], deliveries: [3, 6], discounts: [10, 15],
    why: "Follows bag size rather than habit. Ask what size they sell most of before fixing the frequency.",
  },
  {
    id: "personal-care", label: "Skin, hair and personal care",
    everyDays: [30, 60], deliveries: [3, 6], discounts: [15, 20],
    why: "The slowest repeat gap of the lot and the one most often set too frequent, which shows up as skipped deliveries rather than churn.",
  },
  {
    id: "food-staples", label: "Food staples and groceries",
    everyDays: [14, 30], deliveries: [4, 6, 12], discounts: [8, 12, 15],
    why: "High frequency, thin margin. The discount matters less here than the convenience, so do not give away more than the category can carry.",
  },
  {
    id: "beverages", label: "Beverages and mixes",
    everyDays: [14, 30], deliveries: [3, 6], discounts: [10, 15],
    why: "Consumption is seasonal, so expect pauses in winter and build the run length to survive them.",
  },
  {
    id: "home", label: "Home and cleaning",
    everyDays: [30, 60], deliveries: [3, 6], discounts: [10, 15],
    why: "Predictable but slow. Bundles do more work than frequency here.",
  },
  {
    id: "other", label: "Something else",
    everyDays: [30], deliveries: [3, 6], discounts: [15, 18],
    why: "No category default to lean on, so this leans on the safest one. Your own repeat gap should replace it.",
  },
];

/** How big the store is, which is what decides the payment types worth offering.
 *
 *  Auto-debit is the one that scales: it needs Razorpay connected, mandates to manage and
 *  somebody to watch failed debits, so below real volume it costs more attention than it
 *  saves. Prepaid is the opposite, and works from the first order. Pay as you go sits in
 *  between: it lowers the upfront ask, at the cost of an invoice to chase per delivery. */
export interface ScaleBand {
  id: string;
  label: string;
  hint: string;
  /** Payment modes worth offering at this size, in the order to enable them. */
  modes: string[];
  why: string;
  /** At this size AutoPay is the recommendation rather than an option, and prepaid is the
   *  one you choose to keep. */
  autopayFirst?: boolean;
}

export const SCALES: ScaleBand[] = [
  {
    id: "early", label: "Under 100 orders a month", hint: "Launching, or early",
    modes: ["prepaid"],
    why: "Prepaid only. The money is in the bank on day one and there is nothing to chase, which matters more than conversion while the volume is small. Pay as you go here buys you invoices to follow up and little else.",
  },
  {
    id: "growing", label: "100 to 1,000 orders a month", hint: "Growing",
    modes: ["prepaid", "payg"],
    why: "Prepaid and pay as you go. The upfront ask starts costing conversions at this size, and the invoice volume is still small enough for one person to chase.",
  },
  {
    id: "established", label: "1,000 to 5,000 orders a month", hint: "Established",
    modes: ["prepaid", "auto_debit"],
    why: "Prepaid, and AutoPay in place of pay as you go. Chasing invoices is becoming a job at this volume, and the Razorpay setup pays for itself. Offering both per-delivery options asks a customer to choose between being invoiced and being charged, which nobody does.",
  },
  {
    id: "large", label: "5,000 to 20,000 orders a month", hint: "Large",
    modes: ["auto_debit", "prepaid"],
    why: "AutoPay regardless, and it should be the default a customer sees. At this volume manual collection is a headcount decision rather than a preference. Prepaid becomes optional: keep it if your customers like the discount, drop it if the refund handling on cancellations is costing you more than it earns.",
    autopayFirst: true,
  },
  {
    id: "enterprise", label: "Over 20,000 orders a month", hint: "Enterprise",
    modes: ["auto_debit", "prepaid"],
    why: "AutoPay regardless. Nothing else collects reliably at this scale, and every prepaid cancellation is a refund somebody has to process. Prepaid is optional and usually kept only for a long-run plan where the discount does real work.",
    autopayFirst: true,
  },
];

export const SCALE_BY_ID = new Map(SCALES.map((s) => [s.id, s]));

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export { freqWord } from "./sim";


/** How a discount differs by payment type.
 *
 *  Prepaid carries the most because the customer has handed over the whole run and taken the
 *  risk. Pay per delivery sits in the middle: the money is committed but arrives over time.
 *  Pay as you go carries the least, because nothing is committed at all and the store is
 *  wearing the collection cost, which is why a freebie often does more work there than
 *  another two points off.
 *
 *  Given a min and a max the client sets, this is the split. */
export function modeDiscounts(min: number, max: number): Record<string, number> {
  const lo = Math.min(min, max), hi = Math.max(min, max);
  return {
    prepaid: hi,
    auto_debit: Math.round((lo + hi) / 2),
    payg: lo,
  };
}

export const MODE_LABEL: Record<string, string> = {
  prepaid: "Prepaid", payg: "Pay as you go", auto_debit: "Pay per delivery",
};

/* ---------------------------------------------------------------- per-category defaults

   Two settings genuinely depend on what is being sold, and both were being left at their
   global default and set by hand on the call.

   `tag_shows_per_delivery_price` puts the per-delivery price on the plan tag. It is worth it
   wherever the customer already thinks in a unit rate: supplements are priced per serving,
   coffee per bag, pet food per month. It is noise on a low-ticket staple, where the saving is
   the story and the per-delivery figure is small enough to look like the whole price.

   `freebie_label_shows_value` is the opposite: it earns its place where a gift has a price
   the customer recognises. */
export const CATEGORY_DEFAULTS: Record<string, { tag_shows_per_delivery_price: boolean; freebie_label_shows_value: boolean }> = {
  "coffee-tea":    { tag_shows_per_delivery_price: true,  freebie_label_shows_value: false },
  supplements:     { tag_shows_per_delivery_price: true,  freebie_label_shows_value: true },
  pet:             { tag_shows_per_delivery_price: true,  freebie_label_shows_value: false },
  "personal-care": { tag_shows_per_delivery_price: false, freebie_label_shows_value: true },
  "food-staples":  { tag_shows_per_delivery_price: false, freebie_label_shows_value: false },
  beverages:       { tag_shows_per_delivery_price: true,  freebie_label_shows_value: false },
  home:            { tag_shows_per_delivery_price: false, freebie_label_shows_value: false },
  other:           { tag_shows_per_delivery_price: false, freebie_label_shows_value: false },
};

/** The pilot sheet writes categories in its own words ("Protein & Supplement Brands"), so a
 *  store is matched on keywords rather than on an id neither sheet nor form agrees on. */
const CATEGORY_WORDS: Record<string, RegExp> = {
  "coffee-tea": /coffee|tea(?!m)/i,
  supplements: /supplement|protein|nutrition|nutra|wellness/i,
  pet: /pet|dog|cat\b/i,
  "personal-care": /skin|hair|personal|bath|body|beauty/i,
  "food-staples": /food|grocer|staple|snack|speciality|specialty/i,
  beverages: /beverage|juice|kombucha|water|drink/i,
  home: /home|clean|household/i,
};

export function categoryIdFor(text: string | null | undefined): string | null {
  const t = (text || "").trim();
  if (!t) return null;
  for (const [id, re] of Object.entries(CATEGORY_WORDS)) if (re.test(t)) return id;
  return null;
}
