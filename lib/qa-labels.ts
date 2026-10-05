/** The QA label vocabulary: which surface an issue lives in, and what kind of failure it is.
 *
 *  Source: the module map in `Project Deliverables/stackback/CLAUDE.md`. These are
 *  StackBack's own surfaces and its own failure types; they were written down for a Linear
 *  setup that is not running, and QA is handled from this dashboard instead, so the labels
 *  live here and the Linear framing is gone.
 *
 *  They say what a card IS CALLED, never where it sits. Placement is the stage and the team.
 *  Folding these into `kind` would move cards, because the backlog's four piles sort on it. */

/** Surface labels, grouped by zone. Every issue carries one. */
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

/** Error types. The second label every issue carries, and the bracket its title opens with. */
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

/** The title format: `[Error Type] What broke — Surface — Store`.
 *
 *  Offered rather than enforced. A dev should know which module to look at and which store
 *  is affected from the title alone, and the bad examples in the QA guide are all titles
 *  that read fine to whoever typed them. */
export function qaTitle(
  title: string, errorType: string | null | undefined, surface: string | null | undefined, store?: string | null,
): string {
  const et = errorTypeLabel(errorType);
  const sf = surfaceLabel(surface);
  const body = title.replace(/^\s*\[[^\]]+\]\s*/, "").split(" — ")[0].trim();
  return [et ? `[${et}] ${body}` : body, sf, (store || "").trim() || null]
    .filter(Boolean).join(" — ");
}
