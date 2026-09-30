/** The card vocabulary, as locked for the QA team in Linear.
 *
 *  Source: `Project Deliverables/stackback/Operations/StackBack_Linear_Guide.html` and the
 *  project's own `CLAUDE.md`. Reproduced here rather than paraphrased, because the point of
 *  a locked vocabulary is that a card raised on this board and a ticket raised in Linear are
 *  the same words — a surface label that reads "Portal" here and "Portal Surface" there is
 *  two vocabularies again.
 *
 *  These do NOT decide where a card sits. Placement is the stage and the team, unchanged;
 *  these are what the card is CALLED. Keeping them apart is deliberate: the board's four
 *  backlog piles sort by `kind`, and folding Linear's labels into that would move cards. */

/** Linear's QA workflow, in order. The board's own stages are finer than these; this is the
 *  state a ticket is in over in Linear, and it is written on the card so the two can be
 *  reconciled without opening both. */
export const LINEAR_STATES = ["Triage", "Backlog", "Confirmed", "In Review", "Done"] as const;
export type LinearState = (typeof LINEAR_STATES)[number];

export const LINEAR_STATE_NOTE: Record<LinearState, string> = {
  Triage: "All new issues land here",
  Backlog: "Small or low priority, parked",
  Confirmed: "Dev has picked it up",
  "In Review": "A PR is open — set by GitHub",
  Done: "PR merged, live — set by GitHub",
};

/** Surface labels. Every ticket carries one, and they are grouped by zone in Linear. */
export const SURFACES = [
  { id: "storefront", label: "Storefront Surface", zone: "Customer Zone" },
  { id: "portal", label: "Portal Surface", zone: "Customer Zone" },
  { id: "landing", label: "Landing Surface", zone: "Customer Zone" },
  { id: "order", label: "Order Module", zone: "Merchant Zone" },
  { id: "cx", label: "CX Module", zone: "Merchant Zone" },
  { id: "selling", label: "Selling Formats", zone: "Merchant Zone" },
  { id: "custnotif", label: "Customer Notification", zone: "Merchant Zone" },
  { id: "adminnotif", label: "Admin Notification", zone: "Merchant Zone" },
  { id: "settings", label: "Settings & Config", zone: "Merchant Zone" },
  { id: "onboarding", label: "Onboarding", zone: "Merchant Zone" },
  { id: "customer", label: "Customer Module", zone: "Merchant Zone" },
  { id: "integrations", label: "Integrations", zone: "Merchant Zone" },
] as const;
export type SurfaceId = (typeof SURFACES)[number]["id"];

/** Error types. The second label every ticket carries, and the bracket the title opens with. */
export const ERROR_TYPES = [
  { id: "purchase", label: "Purchase Error", note: "Checkout, cart, pricing, drawer flows" },
  { id: "timeline", label: "Timeline Error", note: "Order summary, edit state, calculation" },
  { id: "scheduler", label: "Scheduler Error", note: "Delivery job timing, jobs running unexpectedly" },
  { id: "cx", label: "CX Module Error", note: "CX Module or Settings affecting portal or widget" },
  { id: "ui", label: "UI Feedback", note: "Visual, usability, design gaps" },
] as const;
export type ErrorTypeId = (typeof ERROR_TYPES)[number]["id"];

export const surfaceLabel = (id: string | null | undefined) =>
  SURFACES.find((s) => s.id === id)?.label ?? null;
export const errorTypeLabel = (id: string | null | undefined) =>
  ERROR_TYPES.find((e) => e.id === id)?.label ?? null;
export const surfaceZone = (id: string | null | undefined) =>
  SURFACES.find((s) => s.id === id)?.zone ?? null;

/** The locked title format: `[Error Type] What broke — Surface — Store`.
 *
 *  Offered rather than enforced. A dev should know which module to look at and which store
 *  is affected from the title alone, and the guide's own bad examples are all titles that
 *  read fine to whoever typed them. */
export function linearTitle(
  title: string, errorType: string | null | undefined, surface: string | null | undefined, store?: string | null,
): string {
  const et = errorTypeLabel(errorType);
  const sf = surfaceLabel(surface);
  const body = title.replace(/^\s*\[[^\]]+\]\s*/, "").split(" — ")[0].trim();
  return [et ? `[${et}] ${body}` : body, sf, (store || "").trim() || null]
    .filter(Boolean).join(" — ");
}
