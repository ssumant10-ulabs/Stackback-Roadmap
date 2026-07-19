import type { Assignee, Node, Status } from "./types";
import { uid } from "./id";

function N(
  title: string,
  status: Status,
  assignees: Assignee[] = [],
  children: Node[] = [],
  extra: Partial<Node> = {},
): Node {
  return { id: uid("n_"), title, status, assignees, children, ...extra };
}
const P = (name: string): Assignee => ({ name });
const T = (name: string): Assignee => ({ name, isTeam: true });

export function stampIds(node: Node): Node {
  if (!node.id) node.id = uid("n_");
  if (!node.children) node.children = [];
  if (!node.assignees) node.assignees = [];
  node.children.forEach(stampIds);
  return node;
}

export function seed(): Node[] {
  return [
    N("Billing Plans", "planned", [P("Shubham"), P("Rohan")], [
      N("Prices finalized & configuration", "progress", [P("Shubham")], [], { note: "almost done" }),
      N("Shopify-managed price to be migrated", "planned", [P("Shubham")]),
      N("Configure monthly timer", "planned", []),
      N("Overdue consequences / restriction to be added", "planned", []),
      N("Internal admin plan management via partner APIs", "planned", [P("Shubham")]),
    ], { priority: 1 }),

    N("Self-Serving Merchant Dashboard & Reporting", "progress", [T("PM"), T("Engineering")], [
      N("Wireframing logic & information architecture", "planned", [T("PM")]),
      N("PM-level scope", "planned", [T("PM")], [
        N("Inventory", "planned", []),
        N("Onboarding (multistep)", "planned", []),
        N("Cleaned-up payment config", "planned", []),
        N("Cleaned-up payment reminder", "planned", []),
        N("Order management / reporting", "planned", []),
        N("Inventory management", "planned", []),
        N("Business metrics", "planned", []),
        N("Issues nudge (resync) on dashboard & widget", "planned", []),
        N("WhatsApp management", "planned", []),
        N("Plan/product view in Purchase Options w/ landing page & widget", "progress", []),
      ]),
      N("Admin module - complete architecture for entire dashboard", "progress", [T("Engineering")]),
      N("Tech handover of the entire admin dashboard", "planned", [T("Engineering")]),
      N("Full refactor of admin", "planned", [T("Engineering")]),
    ], { priority: 1 }),

    N("Autodebit", "planned", [P("Shubham")], [
      N("Razorpay integration & partnership", "planned", [P("Shubham")]),
      N("Custom-app implementation to circumvent Shopify routes", "planned", [P("Shubham")], [
        N("Figure out Razorpay implementation", "planned", []),
        N("Serve both existing & new clients", "planned", []),
        N("Razorpay onboarding flow (required)", "planned", []),
        N("Autodebit design implication", "planned", []),
        N("Autodebit reminder settings", "planned", []),
        N("Autodebit logs", "planned", []),
      ]),
    ], { priority: 2 }),

    N("Widgets, Landing Page & Customer Portal UI", "progress", [T("Design")], [
      N("4 subscription widgets confirmed & designed", "done", [T("Design")]),
      N("4 bundle widgets - Fixed / BXGY / BYOB / Add-on / Mix & Match", "planned", [T("Design")]),
      N("Customer portal - tracking-centric V2", "planned", [T("Design")], [
        N("Subscription builder page (Atlas Coffee)", "planned", []),
      ]),
      N("Engineering pipeline to add subscription widgets", "planned", [T("Engineering")]),
      N("Engineering pipeline to add customer portal", "planned", [T("Engineering")]),
    ], { priority: 2 }),

    N("StackBack's own WhatsApp & WA Meta Account Integration", "planned", [P("Shubham")], [
      N("Partner with Gupshup & set up our account", "planned", [P("Shubham")]),
      N("Integrate with Gupshup & figure billing logic with merchants", "planned", [P("Shubham")], [
        N("Figure out tool-level integration with WhatsApp tool", "planned", []),
      ]),
    ], { priority: 2 }),

    N("OTP-based login for customer portal", "planned", [P("Shubham")], [], { priority: 3 }),

    N("Prepaid & PAYG enhancement", "planned", [P("Shubham")], [
      N("PAYG: first 2-3 orders prepaid, then PAYG email reminders", "planned", []),
      N("PAYG without an end timeline (continuous)", "planned", []),
      N("Partial prepaid & convert to PAYG", "planned", []),
    ], { priority: 4 }),

    N("Internal Systems", "planned", [P("Shubham")], [
      N("Health reporting", "planned", [P("Shubham")], [
        N("Background jobs to detect drifts", "planned", []),
        N("Merchant actions that changed settings", "planned", []),
      ]),
      N("WhatsApp delivery report", "planned", []),
      N("Partner API integration for merchant accounting / subscriptions to our app", "planned", []),
      N("Overall business metrics", "planned", []),
      N("Internal admin migration", "planned", []),
    ], { priority: 5 }),

    N("Subscription renewal nudge (mail + payment link + renew button in portal)", "planned", [P("Shubham")], [], { priority: null }),

    N("Event tracking to be set up", "planned", [P("Mansi")], [
      N("Finalize the tool", "planned", [P("Mansi")], [
        N("Research the tools", "planned", []),
        N("Cost analysis", "planned", []),
        N("Check & figure implementation", "planned", []),
        N("Check event configurations", "planned", []),
        N("Figure user tracking", "planned", []),
        N("Analytics warehouse implementation", "planned", []),
      ]),
    ], { priority: null, eta: "August" }),
  ];
}
