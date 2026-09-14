/** Article status, carried straight from the Help Centre deliverable's own vocabulary.
 *  These are answers to "can I do this", not workflow states, so they never change on a
 *  merchant's screen: they change when the product changes and the deliverable is re-cut. */
export type HelpStatus = "w" | "l" | "m" | "r" | "n" | "x";

export interface HelpArticle {
  /** Slug from the question. Stable across regeneration, so a shared link keeps working. */
  id: string;
  cat: string;
  status: HelpStatus;
  /** How many pilot stores raised this. The corpus is mined from real merchant conversations,
   *  so this is a frequency count, not an estimate. Drives default ordering. */
  asked: number;
  q: string;
  /** Answer body as HTML, authored in the deliverable. */
  a: string;
  /** Where in the Shopify admin to go, when the answer has a place. */
  path: string;
  /** Position in the deliverable, which is a deliberate reading order within a category. */
  ord: number;
}

export interface HelpCategory {
  id: string;
  name: string;
  blurb: string;
  /** Key into FLOWS when the category opens with a diagram. */
  flow: string;
}

export const STATUS_LABEL: Record<HelpStatus, string> = {
  w: "Supported",
  l: "With limits",
  m: "Your action",
  r: "Roadmap",
  n: "Not supported",
  x: "Warning",
};

/** Answers that generate support load: a merchant who reads one of these often writes in
 *  anyway. The internal layer counts these; the merchant view just shows the badge. */
export const RISK_STATUSES: HelpStatus[] = ["n", "r", "x"];


/** The app's name, stated wherever a path or a screen is referenced. A merchant runs a
 *  dozen Shopify apps and "go to Orders" is ambiguous across most of them. */
export const APP_NAME = "StackBack";
/** Where the app sits in their admin, for the same reason. */
export const APP_LOCATION = "Shopify admin › Apps › StackBack";
