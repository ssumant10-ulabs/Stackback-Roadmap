/** The plan configuration as a document, alongside the picture.
 *
 *  `sheet-png.ts` draws the same thing for a deck or a WhatsApp thread. This is for the
 *  half of the uses that are a paragraph in a reply or a line in a ticket: a picture cannot
 *  be searched, quoted, or diffed against the version you sent last week.
 *
 *  Walks `QUESTIONS` rather than naming fields, so a field added to the form appears here
 *  without anybody remembering to add it. Unanswered fields are listed rather than dropped:
 *  this downloads from a half-filled form on purpose, and a document that quietly omits what
 *  it does not know reads as a complete specification. */
import { QUESTIONS, autopayRate, parseBands, parseFreebies, parseList, readPlanBands, visible, type Answers, type Field } from "./questions";
import { CATEGORIES } from "./categories";
import { freqWord } from "./sim";
import type { WidgetSettings } from "./widget";

const MODE_NAME: Record<string, string> = {
  prepaid: "Prepaid", payg: "Pay as you go", autopay: "AutoPay (UPI mandate)",
};

function shown(f: Field, a: Answers): string | null {
  const raw = a[f.id];
  const v = Array.isArray(raw) ? raw.filter(Boolean) : String(raw ?? "").trim();
  if (Array.isArray(v)) {
    if (!v.length) return null;
    return v.map((x) => f.options?.find((o) => o.value === x)?.label || MODE_NAME[x] || x).join(", ");
  }
  if (!v) return null;
  return f.options?.find((o) => o.value === v)?.label || v;
}

export function planDoc(a: Answers, brand: string, settings?: WidgetSettings): string {
  const L: string[] = [];
  const date = new Date().toISOString().slice(0, 10);
  L.push(`# ${brand || "Subscription plans"}`);
  L.push("", `StackBack subscription plans, as configured on ${date}.`, "");

  /* The plan ladder first, because it is the thing that gets argued about. */
  const runs = parseList(a.deliveries);
  const bands = parseBands(a.bands);
  const tiered = a.tiered === "yes";
  const flat = Number(a.discount_pct) || 0;
  /* One table per pack-size band where the order file found two, because a 100g bag and a
     1kg bag do not reorder at the same rate and one table over both is wrong for one of
     them. AutoPay is its own row: it is not a run, it bills until the customer stops it, and
     it takes the second-highest rung — open-ended is in practice the longest commitment on
     the page, so the floor would point a customer at the shortest prepaid run instead, while
     the top rung stays with the money paid upfront. */
  const planBands = readPlanBands(a);
  const offersAutopay = (Array.isArray(a.modes) ? a.modes : []).includes("auto_debit");
  const pctFor = (r: number) => (tiered ? (bands[r] ?? flat) : flat);
  const table = (rs: number[], freq: string) => {
    L.push("", "| Plan | Frequency | Discount |", "|---|---|---|");
    for (const r of rs) L.push(`| ${r} deliveries | ${freq} | ${pctFor(r)}% off |`);
    if (offersAutopay) {
      L.push(`| AutoPay — no fixed run | ${freq} | ${autopayRate(rs.length ? rs.map(pctFor) : [flat])}% off |`);
    }
    L.push("");
  };

  if (planBands.length > 1) {
    L.push("## The plans");
    for (const b of planBands) {
      L.push("", `### ${b.label}${b.sizes.length ? ` — ${b.sizes.join(", ")}` : ""}`);
      L.push("", `Reorders about every ${b.medianGap} days off this band's own customers.`);
      table(b.prepaidRuns, freqWord(b.everyDays));
    }
    if (offersAutopay) {
      L.push(
        "AutoPay has no run length: it bills until the customer stops it. The number to price",
        "and forecast against is " + planBands[0].autopayCycles + " deliveries, a year at that cadence.",
        "",
      );
    }
  } else if (runs.length) {
    L.push("## The plans");
    table(runs, freqWord(Number((Array.isArray(a.every_days) ? a.every_days : [])[0]) || 30));
  }
  const gifts = parseFreebies(a.freebies);
  if (gifts.length) {
    L.push("**Freebies.** " + gifts
      .map((g) => `${g.product || "a gift"} on delivery ${g.delivery} of the ${g.run}-run`)
      .join("; ") + ".", "");
  }

  /* Then every answer, in the order the form asks for them. */
  const missing: string[] = [];
  for (const q of QUESTIONS) {
    const rows: string[] = [];
    for (const f of q.fields) {
      if (!visible(f, a)) continue;
      const v = shown(f, a);
      if (v) rows.push(`- **${f.label}:** ${v}`);
      else if (!f.optional) missing.push(`${q.title} › ${f.label}`);
    }
    if (rows.length) L.push(`## ${q.title}`, "", ...rows, "");
  }

  const cat = CATEGORIES.find((c) => c.id === String(a.category || ""));
  if (cat) {
    L.push("## Why this shape", "", cat.why, "",
      `Category default: every ${cat.everyDays.join(" or ")} days, ${cat.deliveries.join(", ")} deliveries, ${cat.discounts.join("/")}% off.`, "");
  }

  if (missing.length) {
    L.push("## Still to answer", "", ...missing.map((m) => `- ${m}`), "");
  }

  if (settings) {
    const t = settings.theme;
    L.push("## Widget", "",
      `- **Primary:** ${t.colors.primary}`,
      `- **Accent:** ${t.colors.subscriptionAccent}`,
      `- **Widget background:** ${t.surfaces.widgetBackground}`,
      `- **Corner radius:** ${t.shape.radius}px`,
      `- **Payment modes shown:** ${[
        settings.hide_prepaid ? null : "Prepaid",
        settings.hide_payg ? null : "Pay as you go",
        settings.hide_auto_debit ? null : "AutoPay",
      ].filter(Boolean).join(", ") || "none"}`, "");
  }

  L.push("---", "", "Generated by the StackBack Help Centre. Prices on the picture version are",
    "illustrative; this document carries the configuration only.");
  return L.join("\n");
}
