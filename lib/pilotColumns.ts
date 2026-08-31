import type { PilotStore } from "./types";

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

export const DEFAULT_ORDER = PILOT_COLUMNS.map((c) => c.key as string);
export const DEFAULT_VISIBLE = PILOT_COLUMNS.filter((c) => !c.hidden).map((c) => c.key as string);
export const colByKey = (k: string) => PILOT_COLUMNS.find((c) => (c.key as string) === k);

/** CSV with the columns in the order the user has them on screen, so an export matches
 *  what they were looking at rather than some canonical order they never chose. */
export function toCsv(rows: PilotStore[], order: string[]): string {
  const cols = order.map(colByKey).filter(Boolean) as PilotCol[];
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const head = ["#", ...cols.map((c) => c.label)].join(",");
  const body = rows.map((r) => [r.n, ...cols.map((c) => esc(r[c.key]))].join(","));
  return [head, ...body].join("\n");
}
