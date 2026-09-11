/** The four answers we cannot curate plans without. They were prose on the page, which is
 *  a list of things to go and reply about somewhere else; as fields they are a thing you
 *  finish. Each one maps to a query topic so an answer files against the same taxonomy the
 *  Studio uses. */
import type { SimConfig } from "./sim";

export type FieldKind = "choice" | "text" | "number" | "multi";

export interface Field {
  id: string;
  kind: FieldKind;
  label: string;
  help?: string;
  options?: { value: string; label: string; hint?: string }[];
  placeholder?: string;
  suffix?: string;
  /** Shown only when another field holds one of these values. */
  showWhen?: { field: string; is: string[] };
  /** Which simulator input this answer drives, when it drives one. */
  drives?: keyof SimConfig;
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
      { id: "scope_detail", kind: "text", label: "Which ones", placeholder: "Product or collection names, as you would say them to us",
        showWhen: { field: "scope_kind", is: ["products", "collection"] } },
      {
        id: "variants", kind: "choice", label: "Variants",
        options: [
          { value: "all", label: "Every variant carries it" },
          { value: "some", label: "Only some sizes or packs" },
        ],
      },
      { id: "variants_detail", kind: "text", label: "Which variants", placeholder: "For example: 250g and 500g only",
        showWhen: { field: "variants", is: ["some"] } },
    ],
  },
  {
    id: "frequency", topic: "frequency",
    title: "Frequency and run length",
    blurb: "How often a delivery goes out, and how many are in a run. We propose these from the gap in your own repeat purchases; change them if you know better.",
    fields: [
      {
        id: "every_days", kind: "choice", label: "A delivery goes out", drives: "everyDays",
        options: [
          { value: "7", label: "Every week" },
          { value: "14", label: "Every 2 weeks" },
          { value: "30", label: "Every month" },
          { value: "60", label: "Every 2 months" },
        ],
      },
      { id: "deliveries", kind: "number", label: "Deliveries in a run", suffix: "deliveries", drives: "deliveries",
        help: "Six on a monthly plan is a six month commitment." },
    ],
  },
  {
    id: "discount", topic: "discount",
    title: "Discount",
    blurb: "What a subscriber saves. Check it against your margin before it is promised, because it is hard to walk back.",
    fields: [
      { id: "discount_pct", kind: "number", label: "Subscriber discount", suffix: "%", drives: "discountPct" },
      {
        id: "tiered", kind: "choice", label: "Does it grow with a longer commitment",
        options: [
          { value: "no", label: "One rate for every run" },
          { value: "yes", label: "A better rate on longer runs" },
        ],
      },
      { id: "tiers", kind: "text", label: "The bands", placeholder: "For example: 15% at 3, 18% at 6, 20% at 12",
        showWhen: { field: "tiered", is: ["yes"] } },
    ],
  },
  {
    id: "payment", topic: "payment",
    title: "Payment type",
    blurb: "What a customer can choose, and what they see first.",
    fields: [
      {
        id: "modes", kind: "multi", label: "Accept",
        options: [
          { value: "prepaid", label: "Prepaid", hint: "The whole run paid at checkout." },
          { value: "payg", label: "Pay as you go", hint: "A payment link before every delivery." },
          { value: "auto_debit", label: "Pay per delivery", hint: "Charged automatically before every delivery." },
        ],
      },
      {
        id: "default_mode", kind: "choice", label: "Shown first",
        options: [
          { value: "prepaid", label: "Prepaid" },
          { value: "payg", label: "Pay as you go" },
          { value: "auto_debit", label: "Pay per delivery" },
        ],
      },
    ],
  },
];

export type Answers = Record<string, string | string[]>;

export const DEFAULT_ANSWERS: Answers = {
  scope_kind: "products", variants: "all",
  every_days: "30", deliveries: "6",
  discount_pct: "15", tiered: "no",
  modes: ["prepaid", "payg"], default_mode: "prepaid",
};

export function visible(f: Field, a: Answers): boolean {
  if (!f.showWhen) return true;
  const v = a[f.showWhen.field];
  return typeof v === "string" && f.showWhen.is.includes(v);
}

/** Everything answered that the form actually asked for. */
export function complete(a: Answers): boolean {
  return QUESTIONS.every((q) => q.fields.filter((f) => visible(f, a)).every((f) => {
    const v = a[f.id];
    return Array.isArray(v) ? v.length > 0 : Boolean(v && String(v).trim());
  }));
}

/** Flatten to the lines a human reads in the Studio, in the order they were asked. */
export function asLines(a: Answers): { question: string; answer: string }[] {
  const label = (f: Field, v: string) => f.options?.find((o) => o.value === v)?.label || v;
  return QUESTIONS.flatMap((q) =>
    q.fields.filter((f) => visible(f, a)).map((f) => {
      const v = a[f.id];
      const text = Array.isArray(v) ? v.map((x) => label(f, x)).join(", ") : label(f, String(v ?? ""));
      return { question: `${q.title}: ${f.label}`, answer: text + (f.suffix && !Array.isArray(v) ? ` ${f.suffix}` : "") };
    }),
  );
}
