/** The decisions we cannot curate plans without. They were prose, which is a list of things
 *  to go and reply about somewhere else; as fields they are a thing you finish. */
import { CATEGORIES } from "./categories";

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
    id: "discount", topic: "discount",
    title: "Discount",
    blurb: "What a subscriber saves. Check it against your margin before it is promised, because it is hard to walk back.",
    fields: [
      {
        id: "tiered", kind: "choice", label: "How it works",
        options: [
          { value: "no", label: "One rate for every run" },
          { value: "yes", label: "A better rate on longer runs" },
        ],
      },
      { id: "discount_pct", kind: "number", label: "Subscriber discount", suffix: "%",
        showWhen: { field: "tiered", is: ["no"] } },
      { id: "bands", kind: "bands", label: "Discount per run length",
        help: "One rate for each run length you offered above.",
        showWhen: { field: "tiered", is: ["yes"] } },
    ],
  },
  {
    id: "payment", topic: "payment",
    title: "Payment and shipping",
    blurb: "What a customer can choose, and what a delivery costs them.",
    fields: [
      {
        id: "modes", kind: "multi", label: "Accept",
        options: [
          { value: "prepaid", label: "Prepaid", hint: "The whole run paid at checkout." },
          { value: "payg", label: "Pay as you go", hint: "A payment link before every delivery." },
          { value: "auto_debit", label: "Pay per delivery", hint: "Charged automatically before every delivery. Needs Razorpay connected." },
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
      { id: "shipping_rate", kind: "number", label: "The rate", suffix: "₹ per delivery",
        showWhen: { field: "shipping_kind", is: ["threshold", "flat"] } },
      { id: "shipping_threshold", kind: "number", label: "Free above", suffix: "₹ cart value",
        showWhen: { field: "shipping_kind", is: ["threshold"] } },
    ],
  },
];

export type Answers = Record<string, string | string[]>;

export const DEFAULT_ANSWERS: Answers = {
  brand_name: "", category: "",
  scope_kind: "products", scope_detail: "", variants: "all",
  every_days: ["30"], deliveries: "3, 6",
  tiered: "no", discount_pct: "15", bands: "",
  modes: ["prepaid", "payg"], shipping_kind: "free",
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
