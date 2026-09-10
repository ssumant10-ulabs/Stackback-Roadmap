/** Screenshots of the approved merchant admin, captured from the locked prototype screens in
 *  public/merchant, not from production. That is a deliberate trade and it is stated on the
 *  page: the prototypes are the approved design of record and are current, while a
 *  production capture would need a merchant's live store and would go stale the same week.
 *
 *  `source` is the file each shot came from. When a screen is re-cut to a new version, the
 *  stale shot is findable by grepping this map rather than by eye. */
import type { Shot } from "./types";

export const SHOTS: Record<string, Shot[]> = {
  plans: [{
    file: "plan-setup.png",
    caption: "Creating a subscription plan. Each step stays collapsed until you open it, and the summary line under a closed step is what you set.",
    source: "merchant/Polaris/PlanSetup_Polaris_v2.html",
  }],
  bundles: [{
    file: "bundle-setup.png",
    caption: "Creating a bundle. The format you pick at step 1 changes what steps 2 and 3 ask you.",
    source: "merchant/Polaris/BundleSetup_Polaris_v2.html",
  }],
  orders: [{
    file: "orders.png",
    caption: "Orders. Tabs split what is still to be placed from what Shopify already has, so a push that failed is never mixed in with deliveries that worked.",
    source: "merchant/Polaris/Orders_Polaris_v5.html",
  }],
  stock: [{
    file: "inventory.png",
    caption: "Inventory. Upcoming deliveries are counted against stock on hand, so a shortfall shows before the delivery date rather than on it.",
    source: "merchant/Polaris/Inventory_Polaris_v4.html",
  }],
  notify: [{
    file: "payment-reminders.png",
    caption: "Payment reminders, ordered by how close each customer is to an automatic pause. The pips are reminders sent against your own retry cap.",
    source: "merchant/Polaris/PaymentReminders_Polaris_v6.html",
  }],
  widget: [{
    file: "purchase-options.png",
    caption: "Purchase options. Every plan and bundle attached to a product, and what the customer sees on the product page.",
    source: "merchant/PurchaseOptions_Listing_v12.html",
  }],
  admin: [{
    file: "subscriptions.png",
    caption: "Subscriptions. One row per contract, with the delivery timeline behind it.",
    source: "merchant/Polaris/Subscriptions_Polaris_v1.html",
  }],
  start: [{
    file: "admin-home.png",
    caption: "The StackBack admin as it appears inside your Shopify admin.",
    source: "merchant/StackBack_WIP_Prototype.html",
  }],
};

export const SHOT_NOTE =
  "Captured from the approved design of record, not a live store, so no merchant's data appears in them.";
