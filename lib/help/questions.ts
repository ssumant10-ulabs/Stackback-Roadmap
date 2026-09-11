/** The decisions we cannot curate plans without. They were prose, which is a list of things
 *  to go and reply about somewhere else; as fields they are a thing you finish. */
import { CATEGORIES, SCALES } from "./categories";

export type FieldKind = "choice" | "multi" | "text" | "number" | "list" | "bands";

export interface Field {
  id: string;
  kind: FieldKind;
  label: string;
  help?: string;
  options?: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  suffix?: string;
  showWhen?: { field: string; is: string[] };
  optional?: boolean;
}

export interface Question {
  id: string;
  topic: string;
  title: string;
  blurb: string;
  fields: Field[];
}

export const QUESTIONS: Question[] = [
  {
    id: "brand", topic: "products",
    title: "Your brand",
    blurb: "So the answers file against the right store, and so the suggestions beside this form know what sells in your category.",
    fields: [
      { id: "brand_name", kind: "text", label: "Brand name", placeholder: "As your customers know it" },
      { id: "category", kind: "choice", label: "Category",
        options: CATEGORIES.map((c) => ({ value: c.id, label: c.label })) },
      { id: "scale", kind: "choice", label: "Roughly how many orders a month",
        help: "It decides which payment types are worth offering, not just what we suggest.",
        options: SCALES.map((x) => ({ value: x.id, label: x.label, hint: x.hint })) },
    ],
  },
  {
    id: "scope", topic: "products",
    title: "Scope",
    blurb: "Which products carry a subscription. The one that most often holds a launch up.",
    fields: [
      {
        id: "scope_kind", kind: "choice", label: "What should carry it",
        options: [
          { value: "products", label: "Named products", hint: "The cleanest start. Pick what people already reorder." },
          { value: "collection", label: "A collection", hint: "Anything added to it later inherits the plan." },
          { value: "all", label: "All products", hint: "Fastest, and the one we most often talk stores out of." },
        ],
      },
      { id: "scope_detail", kind: "list", label: "Which ones",
        placeholder: "Cold brew 250g, Single origin 500g, Sampler",
        help: "Separate them with commas.",
        showWhen: { field: "scope_kind", is: ["products", "collection"] } },
      {
        id: "variants", kind: "choice", label: "Variants",
        options: [
          { value: "all", label: "Every variant carries it" },
          { value: "some", label: "Only some sizes or packs" },
        ],
      },
      { id: "variants_detail", kind: "list", label: "Which variants", placeholder: "250g, 500g",
        help: "Separate them with commas.", showWhen: { field: "variants", is: ["some"] } },
      { id: "unit_price", kind: "number", label: "One-time price of one delivery", suffix: "\u20b9",
        help: "What a customer pays today without a subscription. Everything downstream is priced off it." },
    ],
  },
  {
    id: "frequency", topic: "frequency",
    title: "Frequency and run length",
    blurb: "You can offer more than one of each. A customer picks from what you allow here.",
    fields: [
      {
        id: "every_days", kind: "multi", label: "Deliveries can go out",
        help: "Pick every frequency you want to offer.",
        options: [
          { value: "7", label: "Every week" },
          { value: "14", label: "Every 2 weeks" },
          { value: "30", label: "Every month" },
          { value: "60", label: "Every 2 months" },
        ],
      },
      { id: "deliveries", kind: "list", label: "Run lengths", placeholder: "3, 6, 12", suffix: "deliveries",
        help: "Separate them with commas. Each becomes a plan a customer can choose." },
    ],
  },
  {
    id: "discount",
    topic: "discount",
    title: "Discount",
    blurb: "What a subscriber saves. Prepaid carries the most, because they have handed over the whole run and taken the risk. Pay as you go carries the least, because nothing is committed and you are wearing the collection cost.",
    fields: [
      { id: "discount_min", kind: "number", label: "Lowest you would go", suffix: "%",
        help: "What pay as you go gets." },
      { id: "discount_max", kind: "number", label: "Most you would give", suffix: "%",
        help: "What prepaid gets. Pay per delivery lands between the two." },
      {
        id: "tiered", kind: "choice", label: "Does a longer run earn more",
        options: [
          { value: "no", label: "One rate per payment type" },
          { value: "yes", label: "A better rate on longer runs too" },
        ],
      },
      { id: "bands", kind: "bands", label: "Prepaid rate per run length",
        help: "The prepaid rate for each run you offered. Pay per delivery and pay as you go scale down from it.",
        showWhen: { field: "tiered", is: ["yes"] } },
      { id: "freebie", kind: "text", label: "Freebie on pay as you go", optional: true,
        placeholder: "A sampler with the first delivery",
        help: "Optional, and often worth more than another two points off. Pay as you go is where a free item does the most work." },
    ],
  },
  {
    id: "payment",
    topic: "payment",
    title: "Payment and shipping",
    blurb: "What a customer can choose, and what a delivery costs them.",
    fields: [
      {
        id: "modes", kind: "multi", label: "Accept",
        options: [
          { value: "prepaid", label: "Prepaid", hint: "The whole run paid at checkout." },
          { value: "payg", label: "Pay as you go", hint: "A payment link before every delivery." },
          { value: "auto_debit", label: "Pay per delivery", hint: "Charged automatically. Needs Razorpay connected." },
        ],
      },
      {
        id: "cod", kind: "choice", label: "Cash on delivery",
        help: "COD cannot back a subscription: there is no stored instrument to charge for delivery two.",
        options: [
          { value: "no", label: "Subscriptions are prepaid only" },
          { value: "first", label: "COD on the first delivery, then a payment link" },
        ],
      },
      {
        id: "shipping_kind", kind: "choice", label: "Shipping on a subscription delivery",
        options: [
          { value: "free", label: "Always free" },
          { value: "threshold", label: "Free above a cart value" },
          { value: "flat", label: "A flat rate every time" },
        ],
      },
      { id: "shipping_rate", kind: "number", label: "The rate", suffix: "\u20b9 per delivery",
        showWhen: { field: "shipping_kind", is: ["threshold", "flat"] } },
      { id: "shipping_threshold", kind: "number", label: "Free above", suffix: "\u20b9 cart value",
        showWhen: { field: "shipping_kind", is: ["threshold"] } },
      {
        id: "cancellation", kind: "choice", label: "If a prepaid customer wants out mid-run",
        help: "Whatever you pick here is what the widget shows as your cancellation policy.",
        options: [
          { value: "refund", label: "Refund the deliveries they have not had" },
          { value: "credit", label: "Store credit for the remainder" },
          { value: "none", label: "Run it to the end, no refund" },
        ],
      },
    ],
  },
  {
    id: "stack",
    topic: "other",
    title: "Your stack",
    blurb: "Four things that change what we build rather than what we price. Each of them has held up a go-live for somebody.",
    fields: [
      {
        id: "checkout", kind: "choice", label: "Checkout",
        help: "A third-party checkout intercepts the cart, and subscriptions need Shopify's own checkout to create the contract.",
        options: [
          { value: "shopify", label: "Shopify's own" },
          { value: "gokwik", label: "GoKwik" },
          { value: "shopflo", label: "Shopflo" },
          { value: "other", label: "Something else" },
        ],
      },
      {
        id: "builder", kind: "choice", label: "Page builder on the product page",
        help: "Page builders publish straight to live, so we tell you before touching one.",
        options: [
          { value: "none", label: "None, it is the theme" },
          { value: "pagefly", label: "PageFly" },
          { value: "gempages", label: "GemPages" },
          { value: "other", label: "Something else" },
        ],
      },
      {
        id: "wms", kind: "choice", label: "Who picks and ships",
        help: "A WMS pulls orders on its own schedule, which has to agree with when we create them.",
        options: [
          { value: "inhouse", label: "In house" },
          { value: "shiprocket", label: "Shiprocket" },
          { value: "unicommerce", label: "Unicommerce" },
          { value: "other", label: "Another 3PL or WMS" },
        ],
      },
      { id: "lead_days", kind: "number", label: "Days of notice your warehouse needs", suffix: "days",
        help: "We create each delivery's order this far ahead. Default 7; several stores run 5 or 10." },
    ],
  },
];

export type Answers = Record<string, string | string[]>;

export const DEFAULT_ANSWERS: Answers = {
  brand_name: "", category: "", scale: "",
  scope_kind: "products", scope_detail: "", variants: "all", unit_price: "750",
  every_days: ["30"], deliveries: "3, 6",
  tiered: "no", discount_min: "10", discount_max: "20", bands: "", freebie: "",
  modes: ["prepaid", "payg"], cod: "no", shipping_kind: "free", cancellation: "refund",
  checkout: "shopify", builder: "none", wms: "inhouse", lead_days: "7",
};

export function visible(f: Field, a: Answers): boolean {
  if (!f.showWhen) return true;
  const v = a[f.showWhen.field];
  return typeof v === "string" && f.showWhen.is.includes(v);
}

/** "3, 6, 12" to [3, 6, 12]. Tolerant of spacing and stray separators, because a client
 *  typing a list should not have to match a format. */
export function parseList(v: string | string[] | undefined): number[] {
  if (Array.isArray(v)) return v.map(Number).filter((n) => n > 0);
  return String(v ?? "").split(/[,/]+/).map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function parseNames(v: string | string[] | undefined): string[] {
  if (Array.isArray(v)) return v;
  return String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

/** Bands are stored as "3:15,6:18,12:20" so they survive a reload as one field. */
export function parseBands(v: string | string[] | undefined): Record<number, number> {
  const out: Record<number, number> = {};
  String(v ?? "").split(",").forEach((pair) => {
    const [d, pct] = pair.split(":").map((x) => parseInt(x.trim(), 10));
    if (Number.isFinite(d) && Number.isFinite(pct)) out[d] = pct;
  });
  return out;
}

export const writeBands = (b: Record<number, number>) =>
  Object.entries(b).map(([d, pct]) => `${d}:${pct}`).join(",");

export function complete(a: Answers): boolean {
  return QUESTIONS.every((q) => q.fields.filter((f) => visible(f, a) && !f.optional).every((f) => {
    const v = a[f.id];
    if (f.kind === "bands") {
      const bands = parseBands(v);
      const runs = parseList(a.deliveries);
      return runs.length > 0 && runs.every((r) => Number.isFinite(bands[r]));
    }
    return Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim());
  }));
}

export function asLines(a: Answers): { question: string; answer: string }[] {
  const label = (f: Field, v: string) => f.options?.find((o) => o.value === v)?.label || v;
  return QUESTIONS.flatMap((q) =>
    q.fields.filter((f) => visible(f, a)).map((f) => {
      const v = a[f.id];
      let text: string;
      if (f.kind === "bands") {
        const b = parseBands(v);
        text = Object.entries(b).map(([d, pct]) => `${pct}% at ${d}`).join(", ");
      } else if (Array.isArray(v)) {
        text = v.map((x) => label(f, x)).join(", ");
      } else {
        text = label(f, String(v ?? "")) + (f.suffix ? ` ${f.suffix}` : "");
      }
      return { question: `${q.title}: ${f.label}`, answer: text };
    }),
  ).filter((l) => l.answer.trim());
}
