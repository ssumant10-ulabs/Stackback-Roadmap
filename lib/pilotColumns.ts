import type { CustomCol, PilotStore } from "./types";

export type ColKind = "text" | "select" | "long" | "readonly" | "date";

export interface PilotCol {
  key: keyof PilotStore;
  label: string;
  kind: ColKind;
  /** Fixed vocabulary. A dropdown beats free text here: it is what stops the same status
   *  arriving as "active", "Active " and "activated" across three people. */
  options?: string[];
  width?: number;
  /** Off by default, shown via the column picker. Every Activation Pointers column exists;
   *  the sparse ones just start hidden so the table opens readable. */
  hidden?: boolean;
}

/** Bugs only. Which layer the fault sits in, so triage can route it without reading the note. */
export const ISSUE_TYPES = ["Theme", "App", "3rd Party checkout"];

export const POCS = ["Ishita", "Shreya", "Sumant", "Rohan", "Shubham"];

export const CATEGORIES = [
  "Food & Grocery Brands", "Protein & Supplement Brands", "Bath & Body Products",
  "Specialty Food & Snacks", "Coffee Brands", "Tea Brands",
  "Water, Juices, Kombucha & Bottled Beverages",
];

export const PILOT_COLUMNS: PilotCol[] = [
  { key: "name", label: "Store", kind: "readonly", width: 170 },
  { key: "activationStatus", label: "Status", kind: "select", options: ["Activated", "Active", "Inactive"], width: 128 },
  { key: "poc", label: "POC", kind: "select", options: POCS, width: 112 },
  { key: "category", label: "Category", kind: "select", options: CATEGORIES, width: 200 },
  { key: "paymentType", label: "Payment", kind: "select", options: ["Prepaid", "PAYG", "Both"], width: 116 },
  { key: "groupCreated", label: "Group created", kind: "date", width: 132 },
  { key: "pilotStart", label: "Pilot start", kind: "date", width: 132 },
  { key: "lastTouch", label: "Last touch", kind: "date", width: 140 },
  { key: "activationNotes", label: "Comments", kind: "long", width: 300 },
  { key: "bundles", label: "Bundles", kind: "select", options: ["Yes", "No"], width: 96, hidden: true },
  { key: "discountMargin", label: "Discount margin", kind: "text", width: 150, hidden: true },
  { key: "frequency", label: "Frequency & cycles", kind: "text", width: 190, hidden: true },
  { key: "shipping", label: "Shipping", kind: "text", width: 140, hidden: true },
  { key: "themeNotes", label: "Theme compatibility", kind: "long", width: 240, hidden: true },
  { key: "email", label: "Email", kind: "text", width: 210, hidden: true },
  { key: "onboardingNotes", label: "Onboarding notes", kind: "long", width: 300, hidden: true },
  { key: "url", label: "Store URL", kind: "text", width: 200, hidden: true },
];

/** Built-ins plus whatever the team has added. Everything downstream (the table, the picker,
 *  the CSV) works off this, so a custom column is not a special case anywhere else. */
export const allColumns = (custom: CustomCol[] = []): PilotCol[] => [
  ...PILOT_COLUMNS,
  ...custom.map((c) => ({ key: c.key as keyof PilotStore, label: c.label, kind: c.kind, options: c.options, width: 170 })),
];
export const isCustomKey = (k: string) => k.startsWith("c_");
/** Custom values live in `p.custom`, built-ins on the record itself. */
export const cellValue = (p: PilotStore, key: string): string => {
  const raw = isCustomKey(key) ? p.custom?.[key] : (p as unknown as Record<string, unknown>)[key];
  return raw === null || raw === undefined ? "" : String(raw);
};

export const DEFAULT_ORDER = PILOT_COLUMNS.map((c) => c.key as string);
export const DEFAULT_VISIBLE = PILOT_COLUMNS.filter((c) => !c.hidden).map((c) => c.key as string);
export const colByKey = (k: string) => PILOT_COLUMNS.find((c) => (c.key as string) === k);

/** CSV with the columns in the order the user has them on screen, so an export matches
 *  what they were looking at rather than some canonical order they never chose. */
export function toCsv(rows: PilotStore[], order: string[], custom: CustomCol[] = []): string {
  const all = allColumns(custom);
  const cols = order.map((k) => all.find((c) => (c.key as string) === k)).filter(Boolean) as PilotCol[];
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = ["#", ...cols.map((c) => c.label)].join(",");
  const body = rows.map((r) => [r.n, ...cols.map((c) => esc(cellValue(r, c.key as string)))].join(","));
  return [head, ...body].join("\n");
}
