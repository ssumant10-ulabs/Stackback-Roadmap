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
  /** The message we actually send at this step, from the Activation Steps thread. Having it
   *  here rather than in a mail thread is the difference between every store getting the same
   *  onboarding and every store getting whoever happened to send it. `<Client Name>` and the
   *  bracketed parts are the only things meant to be edited. */
  message?: { subject: string; body: string; note?: string };
}

export interface Phase {
  id: string;
  title: string;
  steps: Step[];
}

/** Copy we hand over rather than send: the store puts these on its own pages. */
export interface Runbook { id: string; title: string; blurb: string; body: string }

export const RUNBOOKS: Runbook[] = [
  {
    id: "faq",
    title: "FAQ copy for the store",
    blurb: "Six questions, in the merchant's voice, for their own FAQ section. Sumant's revision of 2026-08-21, which is the one to send.",
    body: `1. How often will my items be delivered?

Deliveries follow a fixed schedule based on the plan you choose, so you always know exactly when your next order is arriving. Once you subscribe, you will receive updates on your registered email, and you can track everything anytime from your customer portal.

2. Can I choose my delivery date, or is it fixed?

Your delivery date is set when you subscribe and stays consistent through your plan. That said, you have full control from your customer portal. If you need to reschedule a delivery or make any changes to your plan, you can do it yourself in just a few taps, anytime.

3. What if I am travelling or unavailable for a delivery cycle?

No problem at all. Just log into your customer portal and reschedule that delivery to a date that works better for you. Nothing is lost, your delivery simply moves.

4. What if I need more items, or want to change what I am getting?

You can update your subscription anytime from your customer portal. Increase the quantity, add a new item, or swap an existing item for something else. Make the change, pay for the difference, and your updated order reflects from the very next delivery.

5. Can I pause my subscription?

Yes. You can pause your subscription from your customer portal whenever you need a break, and resume it just as easily when you are ready. Your plan stays intact while paused, nothing is cancelled and nothing is lost.

6. How do I cancel my subscription?

You can cancel anytime directly from your customer portal and it will be reviewed by the team. Your cancellation applies from your next scheduled delivery onwards. Any delivery already processed will still reach you.`,
  },
  {
    id: "cancellation",
    title: "Cancellation policy for the widget",
    blurb: "The line behind the Cancellation Policy link in the widget footer, where a store wants one.",
    body: `Cancellation requests for paid orders are subject to review and are approved only where a valid reason has been provided. Customers are encouraged to reschedule or pause an order instead, where flexibility is needed. Cancellation, rescheduling, and pausing can all be raised through the customer portal.`,
  },
  {
    id: "autopay-setup",
    title: "Setting up AutoPay on a store",
    blurb: "Only for stores taking AutoPay. It cannot be tested anywhere but the live domain, which is the step that catches people out.",
    body: `1. Get Razorpay access from the merchant.
2. Enable "charge at will" under Subscriptions by raising a Razorpay support ticket.
3. Generate API keys in Razorpay: search "Websites & API keys", then download them. They cannot be viewed again.
4. Add the Razorpay API key and secret to StackBack AutoPay.
5. Ask dev (Shubham) to generate StackBack's own secret key for AutoPay and add it to StackBack AutoPay.
6. Back in Razorpay, add the StackBack webhook under Webhooks:
   https://app.stackback.ai/webhooks/razorpay
   with the StackBack secret key, and enable the permissions on the list Shubham shares.

AutoPay can only be tested on the LIVE domain. It also has to be enabled at plan level and at
theme level, under the "Subscription widget" block.`,
  },
];

export const CHECKLIST: Phase[] = [
  {
    id: "access",
    title: "Access",
    steps: [
      { id: "collab-code", title: "Collaborator code received", owner: "client",
        detail: "Shared from Settings > Users > Collaborators. Nothing can start without it.",
        message: {
          subject: "Step 1: Installation & Access",
          body: `Hey Team,

I hope you are well. Really excited to get started!

To kick things off:

1) We need to request collaborator access to your store, for which we need the collaborator code.

2) Once you share the required access with us, here is the private app link: https://apps.shopify.com/stackback that you can use to install the app.

Do let me know in case of any queries; I'll be happy to help.`,
          note: "Covers the collaborator code and the install, so it is one message for the first three steps.",
        } },
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
        detail: "Scope, frequency, discount and payment type. Sent as their Help Centre link.", blockedBy: "orders-read",
        message: {
          subject: "Step 3: Information required",
          body: `Hi <Client Name>,

We had a couple of questions that would help us curate the plans as per your taste.

1. Delivery frequency. As per your brand category, we were planning on two plans, one with 1 delivery every 2 weeks and the other monthly, over a 3 month and a 6 month plan. Is this the repeat order pattern that you have noticed as well, or would you want to tweak it?

2. Discount. What discount range would you be comfortable giving on subscriptions?

3. Subscriptions or bundles. We can do either or both, just let us know what fits your customers and if you have a preference.

4. Payments. We have two options: prepaid, where the customer pays upfront for the entire order, and pay as you go, where the customer pays for the first order and a payment link is shared by email for the ones after it. We would like to know whether you would prefer either one or both.`,
          note: "The four questions this step is named after. Their Help Centre link answers the same four, so send whichever the client will actually fill in.",
        } },
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
        detail: "Widget on the PDP, bundle landing page, and the line that says their live store is untouched. Only now: a preview before the plans exist invites a reaction to pricing that is not theirs.", blockedBy: "widget-configured",
        message: {
          subject: "Step 2: Timeline & next steps",
          body: `For the next steps:

1. We'll be analysing your store data, and in parallel we will ask you a few brand-related questions so we can get a better understanding of the plans that need to be configured.

2. We'd like to schedule a meet to walk you through the final preview we prepare, and if everything looks good to go, we can initiate the go-live process on the call itself.

Please let us know if you're available for a meeting tomorrow at any convenient time. We can coordinate accordingly.`,
          note: "Ishita's revision of 2026-09-10, for the current flow. The older version promised a placeholder-plan preview up front, which we stopped doing: a preview before the plans exist invites a reaction to pricing that is not theirs.",
        } },
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
        detail: "Check the live theme is still the one we built against.",
        message: {
          subject: "Step 4: Go live \u2014 congratulations",
          body: `Hey <Client Name>,

Congratulations! StackBack is officially live on your store. \u{1F680}

Really excited about the collaboration ahead. Our team will be providing hands-on support throughout the entire pilot, closely monitoring things and jumping in whenever you need us.

Looking forward to growing this together over the pilot and beyond. Here's to a strong launch!`,
        } },
      { id: "first-real-order", title: "First real subscription watched through", owner: "ulabs",
        detail: "Through to delivery one's goods landing on the checkout order, not just the checkout itself.", blockedBy: "published",
        message: {
          subject: "Step 5: First subscription",
          body: `Hey Team,

Great news! You just got your first subscription. \u{1F389}`,
          note: "Send it the day it happens. It is the shortest message in the sequence and the one merchants quote back.",
        } },
      { id: "billing-live", title: "Billing live and charging", owner: "ulabs",
        detail: "A non-dev merchant with no successful charge cycle is not live.", blockedBy: "published" },
    ],
  },
];

export const ALL_STEPS = CHECKLIST.flatMap((p) => p.steps);
export const STEP_BY_ID = new Map(ALL_STEPS.map((s) => [s.id, s]));
export const TOTAL_STEPS = ALL_STEPS.length;
