/** Hand-mapped feature to roadmap milestone. The fuzzy matcher in featureLink only catches
 *  near-identical wording; most of the sheet's features are worded nothing like the
 *  milestone that carries them ("Flash sale" belongs to the widgets milestone, "Analytics
 *  v1" to the merchant dashboard). Those judgements are made here, once, explicitly.
 *
 *  A ref absent from this map falls through to the fuzzy matcher, and an explicit null
 *  means "deliberately not on the roadmap yet", so it never gets auto-linked to something
 *  approximate. */
export const FEATURE_TASK_MAP: Record<string, string | null> = {
  "INT-01": "Billing Plans",
  "INT-02": "Self-Serving Merchant Dashboard & Reporting",
  "INT-03": "Design subscription builder page (Atlas Coffee pilot)",
  "INT-04": "Autodebit",
  "INT-05": "StackBack's own WhatsApp & WA Meta Account Integration",
  "INT-06": null,
  "INT-07": "Internal Systems",
  "INT-08": "Self-Serving Merchant Dashboard & Reporting",
  "INT-09": "Self-Serving Merchant Dashboard & Reporting",
  "INT-10": "Subscription renewal nudge (mail + payment link + renew button in portal)",
  "INT-11": "Subscription & Bundle Widgets",
  "INT-12": "StackBack's own WhatsApp & WA Meta Account Integration",
  "INT-13": "Event tracking to be set up",
  "INT-14": "Prepaid & PAYG enhancement",
  "INT-15": "Subscription & Bundle Widgets",
  "INT-16": "PAYG plans: first 2-3 orders prepaid, then switch to PAYG with email reminders",
  "INT-17": "Subscription & Bundle Widgets",
  "INT-18": "Design subscription builder page (Atlas Coffee pilot)",
  "INT-19": "Subscription & Bundle Widgets",
  "INT-20": "Internal Systems",
  "INT-21": "OTP-based login for customer portal",
  "INT-22": "Billing Plans",
  "INT-23": null,
  "INT-24": "Subscription & Bundle Widgets",
  "INT-25": "Subscription & Bundle Widgets",
  "INT-26": null,
  "INT-27": "Landing Page & Customer Portal UI",
  "INT-28": "Subscription & Bundle Widgets",
  "INT-29": "Subscription & Bundle Widgets",
  "INT-30": "Subscription & Bundle Widgets",
  "INT-31": "Prepaid & PAYG enhancement",
  "INT-32": "Landing Page & Customer Portal UI",
  "INT-33": "Self-Serving Merchant Dashboard & Reporting",
  "INT-34": null,
  "INT-35": "Landing Page & Customer Portal UI",
  "INT-36": null,
  "INT-37": null,
  "INT-38": "Internal Systems",
  "INT-39": "Subscription & Bundle Widgets",
  "MR-01": null,
  "MR-02": null,
  "MR-03": "Subscription & Bundle Widgets",
  "MR-04": "PAYG plans: first 2-3 orders prepaid, then switch to PAYG with email reminders",
  "MR-05": "Design subscription builder page (Atlas Coffee pilot)",
  "MR-06": "Subscription & Bundle Widgets",
  "MR-07": "Billing Plans",
  "MR-07b": null,
  "MR-08": "Subscription & Bundle Widgets",
  "MR-09": null,
  "PT-01": "StackBack's own WhatsApp & WA Meta Account Integration",
  "PT-02": null,
  "PT-03": null,
};

/** Unnumbered rows at the foot of block A, matched on their wording instead of an id. */
export const FEATURE_TITLE_MAP: Record<string, string | null> = {
  "Manual Bundle Order creation": "Self-Serving Merchant Dashboard & Reporting",
  "Inventory - Hold - Auto customer notification for swap/reschedule": "Self-Serving Merchant Dashboard & Reporting",
  "Subscription & Bundle section": "Subscription & Bundle Widgets",
  "Sticky Subscription & Bundle button": "Subscription & Bundle Widgets",
  "To add a delivery estimator (shows the date of the scheduled deliveries)": "Subscription & Bundle Widgets",
  "Landing Page: rich text formatting and a Read More option on the description": "Landing Page & Customer Portal UI",
  "Add/remove/Swap on CP to open the customer drawer (instead of toast)": "Landing Page & Customer Portal UI",
  "Figure out meal plan widget flow & fields": "Subscription & Bundle Widgets",
};
