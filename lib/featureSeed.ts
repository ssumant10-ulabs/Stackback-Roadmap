import type { Feature } from "./types";

/** Seeded from the `Priority Features` tab of `Ongoing Stackback Pilot Tracking.xlsx`
 *  (Drive 1OdtY_vIl2G9_ql4GDHCcDYTinTW6SUSe, modified 2026-08-27). The sheet's own three
 *  blocks are kept as `band`, and its wording is kept verbatim so a row here can still be
 *  found in the sheet by eye. Statuses are the sheet's, until a feature is linked to a
 *  roadmap task, at which point the board becomes the authority. */
export const FEATURE_SEED_SOURCE =
  "Priority Features tab, Ongoing Stackback Pilot Tracking.xlsx (2026-08-27)";

const f = (
  ref: string, band: Feature["band"], title: string,
  o: Partial<Feature> = {},
): Feature => ({
  id: "", ref, band, title,
  priority: o.priority ?? null, sheetStatus: o.sheetStatus ?? null,
  requestedBy: o.requestedBy ?? null, effort: o.effort ?? null,
  urgency: o.urgency ?? null, importance: o.importance ?? null, team: o.team ?? null,
  objective: o.objective ?? null, nextSteps: o.nextSteps ?? null, blockers: o.blockers ?? null,
  taskId: null, taskTitle: null,
  storeId: null, storeName: o.storeName ?? null, kind: o.kind ?? "feature",
  updatedAt: "",
});

export function featureSeed(): Feature[] {
  return [
    /* A: upcoming, planned and upcoming */
    f("INT-01", "upcoming", "Billing Plans", { priority: "PMFv1", sheetStatus: "In Review", requestedBy: "Engineering", effort: "L", urgency: "High", importance: "High" }),
    f("INT-02", "upcoming", "Self serving merchant dashboard - shopify admin", { priority: "PMFv1", sheetStatus: "Planning", effort: "XL", urgency: "High", importance: "High", team: "Team", objective: "Self serve version of a dashboard where a merchant can onboard themselves", nextSteps: "Sumant to wireframe & Neel + Anshuman to Design after the widget & landing pages are closed" }),
    f("INT-03", "upcoming", "Purchase Option - Bundle/Subscription builder page", { priority: "Phase 1", sheetStatus: "Done", requestedBy: "Engineering/Client", objective: "Bundle/Subscription builder independent page to be developed" }),
    f("INT-04", "upcoming", "Autodebit", { priority: "PMFv1", sheetStatus: "Planning", effort: "XL", urgency: "High", importance: "High", team: "Na" }),
    f("INT-05", "upcoming", "Stackbacks own Whatsapp for customer messages & WA Meta Account Integration", { priority: "PMFv1", effort: "High", urgency: "High", importance: "High", team: "Na", objective: "Whatsapp Meta integration to be setup & tested out" }),
    f("INT-06", "upcoming", "SMS", { priority: "PMFv1", effort: "Low", urgency: "Low", importance: "Low", team: "Na", objective: "SMS flows to be figured out & Setup" }),
    f("INT-07", "upcoming", "Admin Notifications", { priority: "PMFv1", sheetStatus: "Backlog", requestedBy: "Engineering", effort: "Low", urgency: "Low", importance: "Low", team: "Na", objective: "Admin route for notifications, and emails" }),
    f("INT-08", "upcoming", "Admin - Inventory planner & validation - Part of reporting", { priority: "PMFv1", sheetStatus: "Backlog", requestedBy: "Engineering", team: "Team", effort: "S", objective: "Inventory planning for the merchants to be setup" }),
    f("INT-09", "upcoming", "Analytics v1 - Part of reporting", { priority: "PMFv1", sheetStatus: "Planning", requestedBy: "Engineering", team: "Team", objective: "Merchant Analytics v1 to be setup", nextSteps: "Ishita is figuring out the metrics - Master admin to be figured out as well" }),
    f("INT-10", "upcoming", "Subscription renewal Nugde/mail/notification - with a renewal payment link and a renew button on customer portal", { priority: "PMFv1", sheetStatus: "Backlog", effort: "Low", urgency: "Low", importance: "Low", team: "Na", objective: "1. Email with payment link to renew the subscription. 2. A button on customer portal to renew the subscription" }),
    f("INT-11", "upcoming", "Widgets, Landing page & Customer Portal UI options", { priority: "PMFv1", sheetStatus: "In Design", effort: "High", urgency: "High", importance: "High", team: "Team", objective: "3x subscription widgets, 4-5x bundle use-case widgets, 3x customer portal templates", nextSteps: "4 Subscription widgets cofirmed & designed. 4 bundle widgets - Fixed / BXGY / BYOB / Add on. New - Mix & Match. Customer portal - tracking-centric / V2 of the existing customer portal" }),
    f("INT-12", "upcoming", "WhatsApp Meta integration testing", { priority: "PMFv1", sheetStatus: "In Dev", objective: "Whatsapp Meta integration to be setup & tested out", nextSteps: "The setup is complete - need a merchant accounts access to test it out" }),
    f("INT-13", "upcoming", "Event tracking to be setup", { priority: "PMFv1", effort: "High", urgency: "High", importance: "High", team: "Na", objective: "Events to be tracked on the widget & landing pages" }),
    f("INT-14", "upcoming", "PAYG without an end timeline (continuous PAYG)", { priority: "PMFv1", sheetStatus: "Backlog", effort: "Low", urgency: "Low", importance: "Low", team: "Na" }),
    f("INT-15", "upcoming", "Quiz-based Bundles", { priority: "PMFv1", effort: "High", urgency: "Low", importance: "Low", team: "Team" }),
    f("INT-16", "upcoming", "In PAYG: 1st 2-3 orders as prepaid, then rest as PAYG email reminders", { priority: "PMFv1", effort: "Low", urgency: "Medium", importance: "High", team: "Na" }),
    f("INT-17", "upcoming", "Primary plan option selection on the Widget - global", { priority: "PMFv1", sheetStatus: "Done", effort: "Low", urgency: "Low", importance: "Low", team: "Na" }),
    f("INT-18", "upcoming", "Subscription builder page", { priority: "PMFv1", effort: "Medium", urgency: "Medium", importance: "Medium", team: "Team" }),
    f("INT-19", "upcoming", "Bundle tiered pricing on order value rather than no of products", { priority: "PMFv1", effort: "Low", urgency: "High", importance: "High", team: "Na" }),
    f("INT-20", "upcoming", "Internal Systems", { priority: "PMFv1", effort: "Low", urgency: "High", importance: "High", team: "Na" }),
    f("INT-21", "upcoming", "Auth / Login for customer page", { priority: "PMFv1", effort: "Low", urgency: "High", importance: "High" }),
    f("INT-22", "upcoming", "Collection option in plan configuration", { priority: "PMFv1" }),
    f("INT-23", "upcoming", "Add normal orders to the 1st subscription order that get pushed", { sheetStatus: "In Design" }),
    f("INT-24", "upcoming", "Add Upsell/crossell Widget to bundles"),
    f("INT-25", "upcoming", "Mix & Match widget & configuration", { sheetStatus: "In Design", objective: "New bundle format to be figured out & designed", nextSteps: "The configuration logic has been figured out, widget & config design to be finalised" }),
    f("INT-26", "upcoming", "Dairy - Daily, alternate & custom date selection", { sheetStatus: "Backlog", objective: "To be planned" }),
    f("INT-27", "upcoming", "Shipment tracking module", { sheetStatus: "Backlog", objective: "A module to track shipment in the customer portal" }),
    f("INT-28", "upcoming", "Purchase Option - Try before you buy page & widget", { sheetStatus: "Backlog", requestedBy: "Engineering", objective: "TBYB to be developed" }),
    f("INT-29", "upcoming", "Settings to hide the One time/Sub/Bundle widget bar", { priority: "PMFv1", sheetStatus: "Done", objective: "Bar would hide & individual sub or bundle widget to be visible" }),
    f("INT-30", "upcoming", "Purchase Option - Flash sale", { priority: "Phase 3", sheetStatus: "Done", requestedBy: "Engineering", effort: "M", objective: "Flash sale to be figured out" }),
    f("INT-31", "upcoming", "Convert PAYG to Prepaid - a purchased PAYG contract to be converted to prepaid", { sheetStatus: "Backlog", objective: "A purchased PAYG contract to be converted to prepaid, from the customer portal, and admin can edit the contract and convert from PAYG to prepaid" }),
    f("INT-32", "upcoming", "Landing page config - meta title/description fields", { sheetStatus: "Backlog", objective: "Meta title & description fields to be added for the landing pages" }),
    f("INT-33", "upcoming", "Product Level Overview", { sheetStatus: "Backlog", objective: "Merchant is unable to look at the product level overview of the plans on the app", nextSteps: "Part of the self serve admin" }),
    f("INT-34", "upcoming", "Store credits based recurring subscriptions", { sheetStatus: "Backlog", objective: "Mimicing how Country Delight uses a wallet system to run a recurring continuous subscription" }),
    f("INT-35", "upcoming", "Time + schedule management on customer portal - for high-frequency categories like milk", { sheetStatus: "Backlog", objective: "Mimicing the schedule management feature of the Country Delight app" }),
    f("INT-36", "upcoming", "Subscription management for Dairy"),
    f("INT-37", "upcoming", "Custom Checkout", { sheetStatus: "Done", requestedBy: "Engineering", objective: "Custom cart & checkout to be figured out" }),
    f("INT-38", "upcoming", "Email Notifications", { sheetStatus: "Done", requestedBy: "Engineering", objective: "Notifications on the app to be reworked so they are manageable & sync with emails, along with additional inventory based notifications & emails to be consolidated" }),
    f("INT-39", "upcoming", "Quiz widget format for upselling, quick view & cart", { objective: "Quiz widget scaffold is in place, flow to be minimised & cleaned up - StackBack spec subscription widget v3" }),
    /* Unnumbered rows at the foot of block A, kept because they are real asks. */
    f("", "upcoming", "Manual Bundle Order creation"),
    f("", "upcoming", "Inventory - Hold - Auto customer notification for swap/reschedule"),
    f("", "upcoming", "Subscription & Bundle section"),
    f("", "upcoming", "Sticky Subscription & Bundle button"),
    f("", "upcoming", "To add a delivery estimator (shows the date of the scheduled deliveries)"),
    f("", "upcoming", "Landing Page: rich text formatting and a Read More option on the description"),
    f("", "upcoming", "Add/remove/Swap on CP to open the customer drawer (instead of toast)"),
    f("", "upcoming", "Figure out meal plan widget flow & fields", { objective: "The line items should be passed for all the orders of that contract" }),

    /* B: merchant requested, from pilot stores */
    f("MR-01", "merchant", "Memberships Engine x3", { requestedBy: "Zama", storeName: "Zama", effort: "M" }),
    f("MR-02", "merchant", "Loyalty Engine", { requestedBy: "TBW", storeName: "The Basics Woman", effort: "L" }),
    f("MR-03", "merchant", "Quiz-based Bundles", { requestedBy: "Zama", storeName: "Zama", effort: "S" }),
    f("MR-04", "merchant", "In PAYG: 1st 2-3 orders as prepaid, then rest as PAYG email reminders", { requestedBy: "Shloka", effort: "M", objective: "A customer purchasing PAYG prepays for 2-3 deliveries while making the first purchase" }),
    f("MR-05", "merchant", "Subscription builder page", { requestedBy: "Rohan", effort: "M", objective: "Subscription builder page required & will be added to the menu" }),
    f("MR-06", "merchant", "Primary plan option selection on the Widget - global", { priority: "PMFv1", objective: "Configure which plan option opens by default. Setting to be created" }),
    f("MR-07", "merchant", "Collection option in plan configuration", { requestedBy: "Shubham", objective: "Selling plans mapped to collections instead of products" }),
    f("MR-07b", "merchant", "UPI Referral for the loyalty engine stack", { requestedBy: "Rohan", objective: "https://apps.shopify.com/referrush", nextSteps: "Sheet reuses the id MR-07 for this row and the one above it" }),
    f("MR-08", "merchant", "Bundle tiered pricing on order value rather than no of products", { priority: "PMFv1", sheetStatus: "Planned", requestedBy: "Arusha", storeName: "Arusha Foods" }),
    f("MR-09", "merchant", "Subscription sequence - 1st product one SKU, later orders different items", { objective: "Ref https://skininspired.in/products/retinol-night-cream" }),

    /* C: partner and integrations */
    f("PT-01", "partner", "WhatsApp Integrations (Wati & Interakt)", { priority: "PMFv1", sheetStatus: "Planned", requestedBy: "Internal + Partner", effort: "L", objective: "Whatsapp Integration to be made" }),
    f("PT-02", "partner", "Shopflo Integration", { priority: "PMFv1", sheetStatus: "Planned", requestedBy: "Internal + Partner", effort: "L" }),
    f("PT-03", "partner", "GoKwik Integration", { priority: "PMFv1", sheetStatus: "Planned", requestedBy: "Internal + Partner", effort: "M" }),
  ];
}
