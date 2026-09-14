/** The onboarding spine. One definition, every store measured against it, so adding a step
 *  adds it everywhere and two stores can actually be compared. Per-store tick state lives
 *  on the store document in Sanity; this file is only the shape of the work.
 *
 *  The order is the real order, and the `blockedBy` field is what makes it a spine rather
 *  than a list: plans cannot be curated before the client has answered the plan queries,
 *  which is the step that most often stalls and the reason previews are not sent earlier. */

export interface Step {
  id: string;
  title: string;
  /** Who has to do it. The stalls are almost always on the client side, and naming that
   *  stops "waiting on them" from being an invisible state. */
  owner: "ulabs" | "client" | "both";
  detail: string;
  blockedBy?: string;
}

export interface Phase {
  id: string;
  title: string;
  steps: Step[];
}

export const CHECKLIST: Phase[] = [
  {
    id: "access",
    title: "Access",
    steps: [
      { id: "collab-code", title: "Collaborator code received", owner: "client",
        detail: "Shared from Settings > Users > Collaborators. Nothing can start without it." },
      { id: "access-approved", title: "Access request approved", owner: "client",
        detail: "Roles are pre-selected in the request, so the client only has to accept.", blockedBy: "collab-code" },
      { id: "app-installed", title: "App installed from the private link", owner: "client",
        detail: "Approving access does not install anything. This is the step most stores miss.", blockedBy: "access-approved" },
    ],
  },
  {
    id: "data",
    title: "Data and plan queries",
    steps: [
      { id: "orders-read", title: "Order history read", owner: "ulabs",
        detail: "What repeats, how often, and the gap between repeat purchases.", blockedBy: "app-installed" },
      { id: "queries-sent", title: "Plan queries sent to the client", owner: "ulabs",
        detail: "Scope, frequency, discount and payment type. Sent as their Help Centre link.", blockedBy: "orders-read" },
      { id: "scope-answered", title: "Scope answered: products, collections or all", owner: "client",
        detail: "Including whether every variant carries the plan.", blockedBy: "queries-sent" },
      { id: "frequency-answered", title: "Frequency and plan length agreed", owner: "client",
        detail: "We propose from their repeat gap; they confirm or change it.", blockedBy: "queries-sent" },
      { id: "discount-answered", title: "Discount and bands agreed", owner: "client",
        detail: "Check it against their margin before promising it.", blockedBy: "queries-sent" },
      { id: "payment-answered", title: "Payment types agreed", owner: "client",
        detail: "Prepaid, pay as you go, AutoPay, and which the customer sees first.", blockedBy: "queries-sent" },
    ],
  },
  {
    id: "build",
    title: "Build",
    steps: [
      { id: "plans-curated", title: "Plans curated against the answers", owner: "ulabs",
        detail: "Real plans, real pricing. Not placeholders.", blockedBy: "discount-answered" },
      { id: "theme-copy", title: "Preview theme taken from the live theme", owner: "ulabs",
        detail: "Confirm which theme first if they are mid-redesign. Page builders publish directly, so flag those before touching one.", blockedBy: "plans-curated" },
      { id: "widget-pdp", title: "Subscription widget placed on the PDP", owner: "ulabs",
        detail: "On the preview theme, on a product the plans actually cover. This is link A in the preview email.", blockedBy: "theme-copy" },
      { id: "bundle-lp", title: "Bundle landing page built", owner: "ulabs",
        detail: "At /apps/stackback-portal/lp/bundle-builder/<id>. Link B in the preview email. Skip only if the store is running no bundles.", blockedBy: "theme-copy" },
      { id: "menu-items", title: "Subscriptions and Bundles added to the theme menu", owner: "ulabs",
        detail: "On the backup theme, so the client can reach both pages without a deep link. The preview email calls this out explicitly.", blockedBy: "bundle-lp" },
      { id: "widget-configured", title: "Widget settings configured", owner: "ulabs",
        detail: "Payment modes shown, default mode, tabs, discount format, branding.", blockedBy: "widget-pdp" },
      { id: "shipping-checked", title: "Shipping and pincode rules checked", owner: "ulabs",
        detail: "A double charge on child orders is the classic miss here.", blockedBy: "theme-copy" },
      { id: "notifications-set", title: "Notification templates set", owner: "ulabs",
        detail: "Sender identity, WhatsApp gating, reminder timing.", blockedBy: "theme-copy" },
    ],
  },
  {
    id: "review",
    title: "Review",
    steps: [
      { id: "preview-sent", title: "Preview email sent with both links", owner: "ulabs",
        detail: "Widget on the PDP, bundle landing page, and the line that says their live store is untouched. Only now: a preview before the plans exist invites a reaction to pricing that is not theirs.", blockedBy: "widget-configured" },
      { id: "call-booked", title: "Walkthrough call booked", owner: "both",
        detail: "Asked for in the same email. Chase it if no slot comes back inside two days.", blockedBy: "preview-sent" },
      { id: "call-done", title: "Call done, flow and plans finalised", owner: "both",
        detail: "Write the edits down here, not in the thread.", blockedBy: "call-booked" },
      { id: "test-order", title: "Test order placed end to end", owner: "ulabs",
        detail: "Parent order, first child order, and the notification that goes with each.", blockedBy: "call-done" },
    ],
  },
  {
    id: "live",
    title: "Go live",
    steps: [
      { id: "client-signoff", title: "Client has given the word", owner: "client",
        detail: "Explicit. Nothing publishes on an assumed yes.", blockedBy: "call-done" },
      { id: "published", title: "Published to the live theme", owner: "ulabs", blockedBy: "client-signoff",
        detail: "Check the live theme is still the one we built against." },
      { id: "first-real-order", title: "First real subscription watched through", owner: "ulabs",
        detail: "Through to the first child order being created, not just the checkout.", blockedBy: "published" },
      { id: "billing-live", title: "Billing live and charging", owner: "ulabs",
        detail: "A non-dev merchant with no successful charge cycle is not live.", blockedBy: "published" },
    ],
  },
];

export const ALL_STEPS = CHECKLIST.flatMap((p) => p.steps);
export const STEP_BY_ID = new Map(ALL_STEPS.map((s) => [s.id, s]));
export const TOTAL_STEPS = ALL_STEPS.length;
