import type { Assignee, Node, Status } from "./types";
import { uid } from "./id";

/** Bumped whenever the seed data below is regenerated from the roadmap sheet.
 *  A bump invalidates saved browser/Supabase state so everyone picks up the new tree. */
export const SEED_VERSION = 3;

/** Source of truth: the `Roadmap` tab of StackBack_Roadmap_Tasks_Updated.xlsx
 *  (Google Drive 1tHa3FtlnUOaCg5kH7zmUgkV2IfiUDmSb, last modified 2026-07-31).
 *  Generated, do not hand-edit: re-run the generator when the sheet changes. */
export const SEED_SOURCE = "Roadmap tab, StackBack_Roadmap_Tasks_Updated.xlsx (2026-07-31)";

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
    N("Billing Plans", "progress", [P("Shubham"), P("Rohan")], [
      N("Finalize subscription plan prices & configure them in the system", "progress", [P("Shubham")], [], { team: "Engineering" }),
      N("Migrate existing Shopify-managed prices into StackBack pricing", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Configure monthly billing cycle timer", "planned", [P("Shubham"), P("Rohan")], [], { team: "Engineering" }),
      N("Add restrictions/consequences for overdue subscription payments", "planned", [P("Shubham"), P("Rohan")], [], { team: "Engineering" }),
      N("Enable internal admin to manage merchant plans via partner APIs", "planned", [P("Shubham")], [], { team: "Engineering" })
    ], { priority: 1, team: "Engineering" }),

    N("Subscription & Bundle Widgets", "planned", [T("Engineering"), T("Design")], [
      N("4 subscription widgets confirmed & designed; 4 more widget types to be scoped", "planned", [T("Design")], [
        N("Plan bundle widget requirements & scope", "done", [P("Shubham"), P("Rohan")], [], { team: "Design" }),
        N("Plan Bundle widget design brief", "done", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Widget ideation - low-fidelity wireframes & HTML mockups", "done", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Internal review of bundle widget designs", "done", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Build bundle widget JSX (high-fidelity prototype)", "progress", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Get final prototype approval from stakeholders", "planned", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Prepare developer handover file for bundle widgets", "planned", [P("Neel"), P("Anshuman")], [], { team: "Design" })
      ], { team: "Design" }),
      N("5 bundle widget types - Fixed, BXGY, BYOB, Add-on, Mix & Match", "planned", [T("Design")], [
        N("Plan bundle widget requirements & scope", "done", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Plan Bundle widget design brief", "done", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Widget ideation - low-fidelity wireframes & HTML mockups", "done", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Internal review of bundle widget designs", "done", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Build bundle widget JSX (high-fidelity prototype)", "progress", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Get final prototype approval from stakeholders", "progress", [P("Neel"), P("Anshuman")], [], { team: "Design" }),
        N("Prepare developer handover file for bundle widgets", "progress", [P("Neel"), P("Anshuman")], [], { team: "Design" })
      ], { team: "Design" }),
      N("Define engineering pipeline to add subscription widgets to storefront", "planned", [T("Engineering")], [
        N("Technical approach still to be finalized", "planned", [P("Sachin"), P("Mansi"), P("Yogesh")], [], { team: "Engineering" })
      ], { team: "Engineering" }),
      N("Develop subscription & bundle widgets", "planned", [P("Sachin"), P("Yogesh")], [], { team: "Engineering" }),
      N("Handover widgets to QA for review", "planned", [P("Sachin"), P("Yogesh"), P("Sumant")], [], { team: "Engineering" }),
      N("Get approval & deploy widgets to live store", "planned", [P("Sachin"), P("Yogesh")], [], { team: "Engineering" })
    ], { priority: 1, team: "Engineering" }),

    N("Landing Page & Customer Portal UI", "planned", [T("Engineering"), T("Design")], [
      N("Customer portal V2 & Minima - tracking-centric redesign", "planned", [T("Design")], [
        N("Plan customer portal V2/ Minima scope & requirements", "progress", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Plan customer portal design brief", "progress", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Portal ideation - low-fidelity wireframes & HTML mockups", "progress", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Internal review of customer portal designs", "planned", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Build customer portal JSX (high-fidelity prototype)", "planned", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Get final prototype approval from stakeholders", "planned", [P("Rohan"), P("Sumant")], [], { team: "Design" }),
        N("Prepare developer handover file for customer portal", "planned", [P("Rohan"), P("Sumant")], [], { team: "Design" })
      ], { team: "Design" }),
      N("Design subscription builder page (Atlas Coffee pilot)", "planned", [P("Neel")], [], { team: "Design" }),
      N("Define engineering pipeline to build customer portal", "planned", [T("Engineering")], [
        N("Technical approach still to be finalized", "planned", [], [], { team: "Engineering" })
      ], { team: "Engineering" }),
      N("Develop customer portal", "planned", [T("Engineering")], [
        N("Frontend & backend build", "planned", [], [], { team: "Engineering" })
      ], { team: "Engineering" }),
      N("QA testing & review of customer portal", "planned", [], [], { team: "Engineering" }),
      N("Deploy customer portal to live store", "planned", [], [], { team: "Engineering" })
    ], { priority: 1, team: "Engineering" }),

    N("Self-Serving Merchant Dashboard & Reporting", "planned", [T("Engineering"), T("PM")], [
      N("Audit & reference existing dashboard modules before redesign", "planned", [T("PM")], [
        N("Dashboard overview module (ongoing)", "planned", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Onboarding module (ongoing)", "planned", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Orders module (ongoing)", "progress", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Subscription listing module (ongoing)", "done", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Subscription Plan Creation Screen", "done", [P("Sumant"), P("Ishita")]),
        N("Bundle Creation Screen", "done", [P("Sumant"), P("Ishita")]),
        N("Inventory route module (ongoing)", "done", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Analytics module (ongoing)", "progress", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Payment configuration - cleaned-up reference version", "progress", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Payment reminder - cleaned-up reference version", "progress", [P("Sumant"), P("Ishita")], [], { team: "PM" }),
        N("Order management & reporting module (reference)", "done", [P("Sumant"), P("Ishita")], [], { team: "PM" })
      ], { team: "PM" }),
      N("PM scope: wireframe & JSX each dashboard module below", "planned", [P("Sumant")], [
        N("Wireframe - Inventory route", "progress", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & - Onboarding (multistep flow)", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Payment configuration", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Payment reminder", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Order management & reporting", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Inventory management (reference, ongoing)", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Business metrics & analytics", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Issue/resync nudges on dashboard & widget (ongoing)", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - WhatsApp management", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Wireframe & JSX - Plan/product view in Purchase Options, incl. landing page & widget (ongoing)", "progress", [P("Sumant")], [], { team: "PM" }),
        N("Compile JSX for all dashboard handover files", "planned", [P("Sumant")], [], { team: "PM" })
      ], { team: "PM" }),
      N("Define complete information architecture for admin module", "planned", [T("PM")], [
        N("Information architecture brief", "done", [P("Sumant"), P("Shubham")], [], { team: "PM" }),
        N("Create v1 of the information architecture", "planned", [P("Sumant")], [], { team: "PM" }),
        N("Get approval & update remaining modules & routes", "planned", [P("Sumant")], [], { team: "PM" })
      ], { team: "PM" }),
      N("Handover entire admin dashboard to engineering", "planned", [T("Engineering"), P("Sumant")], [], { team: "Engineering" }),
      N("Full refactor of admin dashboard", "planned", [T("Engineering"), P("Sumant")], [], { team: "Engineering" })
    ], { priority: 1, team: "PM" }),

    N("Autodebit", "planned", [T("Engineering")], [
      N("Set up Razorpay partnership & integration for autodebit", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Build custom app to bypass Shopify's native payment routes for autodebit", "planned", [P("Shubham")], [
        N("Finalize Razorpay implementation approach", "planned", [P("Shubham")], [], { team: "Engineering" }),
        N("Support autodebit for both existing & new merchants", "planned", [P("Shubham")], [], { team: "Engineering" }),
        N("Build required Razorpay onboarding flow", "planned", [P("Shubham")], [], { team: "Engineering" }),
        N("Assess design implications of autodebit flow", "planned", [P("Shubham")], [], { team: "Engineering" }),
        N("Configure autodebit reminder settings", "planned", [P("Shubham")], [], { team: "Engineering" }),
        N("Build autodebit transaction logs", "planned", [P("Shubham")], [], { team: "Engineering" })
      ], { team: "Engineering" })
    ], { priority: 2, team: "Engineering" }),

    N("StackBack's own WhatsApp & WA Meta Account Integration", "planned", [T("Engineering")], [
      N("Partner with Gupshup & set up StackBack's WhatsApp Business account", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Integrate with Gupshup & define billing logic for merchants", "planned", [P("Shubham")], [
        N("Finalize tool-level integration with WhatsApp Business tool", "planned", [P("Shubham")], [], { team: "Engineering" })
      ], { team: "Engineering" })
    ], { priority: 2, team: "Engineering" }),

    N("OTP-based login for customer portal", "planned", [P("Shubham")], [
      N("Decide OTP delivery channel (SMS/WhatsApp) & finalize login flow", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Build OTP generation, verification & session handling on backend", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Handle edge cases - resend OTP, rate-limiting, invalid/expired codes", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("QA testing & deploy to live", "planned", [P("Shubham")], [], { team: "Engineering" })
    ], { priority: 2, team: "Engineering" }),

    N("Prepaid & PAYG enhancement", "planned", [T("Engineering")], [
      N("PAYG plans: first 2-3 orders prepaid, then switch to PAYG with email reminders", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Support continuous PAYG plans with no end date", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Support partial prepaid plans that convert to PAYG", "planned", [P("Shubham")], [], { team: "Engineering" })
    ], { priority: 3, team: "Engineering" }),

    N("Internal Systems", "planned", [T("Engineering")], [
      N("Build internal health-reporting system", "planned", [T("Engineering")], [
        N("Background jobs to detect data/config drifts", "planned", [P("Shubham")], [], { team: "Engineering" }),
        N("Track merchant actions that changed settings", "planned", [P("Shubham")], [], { team: "Engineering" })
      ], { team: "Engineering" }),
      N("Build WhatsApp message delivery report", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Partner API integration for merchant accounting & subscription sync into StackBack", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Build overall business metrics dashboard (internal)", "planned", [P("Shubham"), P("Ishita")], [], { team: "Engineering" }),
      N("Migrate internal admin to new system/architecture", "planned", [P("Shubham")], [], { team: "Engineering" })
    ], { priority: 3, team: "Engineering" }),

    N("Subscription renewal nudge (mail + payment link + renew button in portal)", "planned", [P("Shubham")], [
      N("Build email reminder before subscription expiry with renewal CTA", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Generate secure payment link for renewal (mail + portal)", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("Add 'Renew Now' button in customer portal linked to payment", "planned", [P("Shubham")], [], { team: "Engineering" }),
      N("QA testing & deploy to live", "planned", [P("Shubham")], [], { team: "Engineering" })
    ], { priority: 3, team: "Engineering" }),

    N("Event tracking to be set up", "planned", [T("Engineering")], [
      N("Finalize event-tracking tool", "planned", [P("Mansi")], [
        N("Research available event-tracking tools", "planned", [P("Mansi")], [], { team: "Engineering" }),
        N("Cost analysis of shortlisted tools", "planned", [P("Mansi")], [], { team: "Engineering" }),
        N("Assess implementation approach", "planned", [P("Mansi")], [], { team: "Engineering" }),
        N("Define event configurations to track", "planned", [P("Mansi")], [], { team: "Engineering" }),
        N("Define user-level tracking requirements", "planned", [P("Mansi")], [], { team: "Engineering" }),
        N("Check tool-level integration with WhatsApp tool", "planned", [P("Mansi")], [], { team: "Engineering" })
      ], { team: "Engineering" })
    ], { priority: 3, team: "Engineering" }),
  ];
}
