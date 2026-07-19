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

export const PRIORITIES: { p: number | null; word: string }[] = [
  { p: 1, word: "Now" },
  { p: 2, word: "Next" },
  { p: 3, word: "Then" },
  { p: 4, word: "Later" },
  { p: 5, word: "Future" },
  { p: null, word: "Backlog" },
];

export const STATUS_CYCLE: ("planned" | "progress" | "done")[] = ["planned", "progress", "done"];

export const VIEWS: { id: string; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "simple", label: "Overview" },
  { id: "teams", label: "Teams & People" },
];

/** Plain-language milestone labels for the Overview view. */
export const SIMPLE_LABELS: Record<string, { simple: string; sub: string }> = {
  "Billing Plans": { simple: "Billing & Plans", sub: "The subscription plans customers pick and pay for." },
  "Self-Serving Merchant Dashboard & Reporting": { simple: "Merchant Dashboard", sub: "One place for merchants to manage and track everything." },
  Autodebit: { simple: "Auto-Pay", sub: "Charge customers automatically so payments are never late." },
  "Widgets, Landing Page & Customer Portal UI": { simple: "Customer Screens", sub: "The pages and widgets customers actually see and use." },
  "StackBack's own WhatsApp & WA Meta Account Integration": { simple: "WhatsApp Updates", sub: "Message customers on WhatsApp from our own account." },
  "OTP-based login for customer portal": { simple: "Quick Login", sub: "Sign in with a one-time code, no password needed." },
  "Prepaid & PAYG enhancement": { simple: "Flexible Payments", sub: "Better prepaid and pay-as-you-go options for customers." },
  "Internal Systems": { simple: "Internal Tools", sub: "Behind-the-scenes tools that keep the team moving." },
  "Subscription renewal nudge (mail + payment link + renew button in portal)": { simple: "Renewal Reminders", sub: "Nudge customers to renew with a mail, link, and button." },
  "Event tracking to be set up": { simple: "Usage Tracking", sub: "Measure what customers do so we can keep improving." },
};

/** Plain-language versions of the milestone subtasks (Overview + By person). */
export const SIMPLE_SUB: Record<string, string> = {
  "Prices finalized & configuration": "Set and configure the plan prices",
  "Shopify-managed price to be migrated": "Move pricing over to Shopify",
  "Configure monthly timer": "Set up the monthly billing timer",
  "Overdue consequences / restriction to be added": "Add rules for missed payments",
  "Internal admin plan management via partner APIs": "Manage plans from our internal admin",
  "Wireframing logic & information architecture": "Design the layout and structure",
  "PM-level scope": "Plan the product scope",
  "Admin module - complete architecture for entire dashboard": "Build the full dashboard architecture",
  "Tech handover of the entire admin dashboard": "Hand the dashboard to engineering",
  "Full refactor of admin": "Rebuild the admin cleanly",
  "Razorpay integration & partnership": "Partner and integrate with Razorpay",
  "Custom-app implementation to circumvent Shopify routes": "Build a custom app for payments",
  "4 subscription widgets confirmed & designed": "Design the 4 subscription widgets",
  "4 bundle widgets - Fixed / BXGY / BYOB / Add-on / Mix & Match": "Design the 4 bundle widgets",
  "Customer portal - tracking-centric V2": "Build the new customer portal",
  "Engineering pipeline to add subscription widgets": "Ship the subscription widgets to code",
  "Engineering pipeline to add customer portal": "Ship the customer portal to code",
  "Partner with Gupshup & set up our account": "Set up our WhatsApp account with Gupshup",
  "Integrate with Gupshup & figure billing logic with merchants": "Connect Gupshup and sort merchant billing",
  "PAYG: first 2-3 orders prepaid, then PAYG email reminders": "Start prepaid, then switch to pay-as-you-go",
  "PAYG without an end timeline (continuous)": "Allow pay-as-you-go with no end date",
  "Partial prepaid & convert to PAYG": "Let customers pay part now, rest later",
  "Health reporting": "Report on account health",
  "WhatsApp delivery report": "Track WhatsApp message delivery",
  "Partner API integration for merchant accounting / subscriptions to our app": "Connect partner APIs for our own billing",
  "Overall business metrics": "Track overall business metrics",
  "Internal admin migration": "Move the internal admin over",
  "Finalize the tool": "Pick the tracking tool",
};
