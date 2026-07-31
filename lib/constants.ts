import type { Roster } from "./types";

export const DEFAULT_ROSTER: Roster = {
  Engineering: ["Shubham", "Mansi", "Sachin", "Yogesh"],
  Design: ["Rohan", "Neel", "Anshuman"],
  PM: ["Sumant", "Ishita", "Shreya"],
};

export const TEAM_ORDER = ["Engineering", "Design", "PM"];
export const TEAM_VAR: Record<string, string> = { Engineering: "eng", Design: "dsg", PM: "pm" };
export const TEAM_SHORT: Record<string, string> = { Engineering: "Eng", Design: "Dsg", PM: "PM" };

/** Founders. Rohan is classification-neutral (a Rohan-only task never reads as Design);
 *  Shubham keeps Engineering (he owns real eng work). */
export const FOUNDERS: Record<string, number> = { Shubham: 1, Rohan: 1 };
export const TEAM_NEUTRAL: Record<string, number> = { Rohan: 1 };

/** The roadmap has four states: three schedulable horizons plus Done.
 *  Done is derived, never stored: anything whose work is all checked off leaves its
 *  horizon and shows under Done, so the four states partition the roadmap exactly.
 *  Only these three priorities are ever written to a node. */
export const PRIORITIES: { p: number; word: string }[] = [
  { p: 1, word: "Now" },
  { p: 2, word: "Next" },
  { p: 3, word: "Future" },
];

export const STATUS_CYCLE: ("planned" | "progress" | "done")[] = ["planned", "progress", "done"];

export const VIEWS: { id: string; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "simple", label: "Overview" },
  { id: "teams", label: "Teams & People" },
];

/** Plain-language milestone labels for the Overview view.
 *  Keys must match the milestone titles in the roadmap sheet exactly. */
export const SIMPLE_LABELS: Record<string, { simple: string; sub: string }> = {
  "Billing Plans": { simple: "Billing & Plans", sub: "The subscription plans customers pick and pay for." },
  "Subscription & Bundle Widgets": { simple: "Storefront Widgets", sub: "The widgets customers use to subscribe or build a bundle." },
  "Landing Page & Customer Portal UI": { simple: "Customer Screens", sub: "The landing pages and portal customers actually use." },
  "Self-Serving Merchant Dashboard & Reporting": { simple: "Merchant Dashboard", sub: "One place for merchants to manage and track everything." },
  Autodebit: { simple: "Auto-Pay", sub: "Charge customers automatically so payments are never late." },
  "StackBack's own WhatsApp & WA Meta Account Integration": { simple: "WhatsApp Updates", sub: "Message customers on WhatsApp from our own account." },
  "OTP-based login for customer portal": { simple: "Quick Login", sub: "Sign in with a one-time code, no password needed." },
  "Prepaid & PAYG enhancement": { simple: "Flexible Payments", sub: "Better prepaid and pay-as-you-go options for customers." },
  "Internal Systems": { simple: "Internal Tools", sub: "Behind-the-scenes tools that keep the team moving." },
  "Subscription renewal nudge (mail + payment link + renew button in portal)": { simple: "Renewal Reminders", sub: "Nudge customers to renew with a mail, link, and button." },
  "Event tracking to be set up": { simple: "Usage Tracking", sub: "Measure what customers do so we can keep improving." },
};

/** Plain-language versions of the milestone subtasks (Overview + By person).
 *  Only the subtasks whose sheet wording is long or jargon-heavy are rewritten here;
 *  anything absent falls through and renders exactly as the sheet has it. */
export const SIMPLE_SUB: Record<string, string> = {
  // Billing & Plans
  "Finalize subscription plan prices & configure them in the system": "Set and configure the plan prices",
  "Migrate existing Shopify-managed prices into StackBack pricing": "Move Shopify pricing into StackBack",
  "Configure monthly billing cycle timer": "Set up the monthly billing timer",
  "Add restrictions/consequences for overdue subscription payments": "Add rules for missed payments",
  "Enable internal admin to manage merchant plans via partner APIs": "Manage plans from our internal admin",
  // Storefront widgets
  "4 subscription widgets confirmed & designed; 4 more widget types to be scoped": "The 4 subscription widgets, plus 4 more to scope",
  "5 bundle widget types - Fixed, BXGY, BYOB, Add-on, Mix & Match": "The 5 bundle widget types",
  "Define engineering pipeline to add subscription widgets to storefront": "Ship the widgets into the storefront code",
  "Develop subscription & bundle widgets": "Build the widgets",
  "Handover widgets to QA for review": "Hand the widgets to QA",
  "Get approval & deploy widgets to live store": "Approve and go live with the widgets",
  // Customer screens
  "Customer portal V2 & Minima - tracking-centric redesign": "Redesign the portal around order tracking",
  "Design subscription builder page (Atlas Coffee pilot)": "Design the subscription builder page",
  "Define engineering pipeline to build customer portal": "Ship the customer portal into code",
  // Merchant dashboard
  "Audit & reference existing dashboard modules before redesign": "Review what the dashboard already does",
  "PM scope: wireframe & JSX each dashboard module below": "Wireframe and build each dashboard screen",
  "Define complete information architecture for admin module": "Map out how the admin is organised",
  "Handover entire admin dashboard to engineering": "Hand the dashboard to engineering",
  "Full refactor of admin dashboard": "Rebuild the admin cleanly",
  // Auto-Pay
  "Set up Razorpay partnership & integration for autodebit": "Partner and integrate with Razorpay",
  "Build custom app to bypass Shopify's native payment routes for autodebit": "Build a custom app for auto-pay charges",
  // WhatsApp
  "Partner with Gupshup & set up StackBack's WhatsApp Business account": "Set up our own WhatsApp Business account",
  "Integrate with Gupshup & define billing logic for merchants": "Connect Gupshup and sort merchant billing",
  // Quick login
  "Decide OTP delivery channel (SMS/WhatsApp) & finalize login flow": "Pick the OTP channel and lock the flow",
  "Build OTP generation, verification & session handling on backend": "Build the OTP and session backend",
  "Handle edge cases - resend OTP, rate-limiting, invalid/expired codes": "Handle resends, rate limits and bad codes",
  // Flexible payments
  "PAYG plans: first 2-3 orders prepaid, then switch to PAYG with email reminders": "Start prepaid, then switch to pay-as-you-go",
  "Support continuous PAYG plans with no end date": "Allow pay-as-you-go with no end date",
  "Support partial prepaid plans that convert to PAYG": "Let customers pay part now, rest later",
  // Internal tools
  "Build internal health-reporting system": "Report on account health",
  "Build WhatsApp message delivery report": "Track WhatsApp message delivery",
  "Partner API integration for merchant accounting & subscription sync into StackBack": "Connect partner APIs for our own billing",
  "Build overall business metrics dashboard (internal)": "Track overall business metrics",
  "Migrate internal admin to new system/architecture": "Move the internal admin over",
  // Renewal reminders
  "Build email reminder before subscription expiry with renewal CTA": "Email a renewal nudge before expiry",
  "Generate secure payment link for renewal (mail + portal)": "Generate a secure renewal payment link",
  "Add 'Renew Now' button in customer portal linked to payment": "Add a Renew Now button to the portal",
  // Usage tracking
  "Finalize event-tracking tool": "Pick the tracking tool",
};
