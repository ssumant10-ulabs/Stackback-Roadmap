/** Where an answer sends you when reading it is not the point.
 *
 *  Half the FAQs end in "so set it up like this", and the thing to set it up in is already
 *  in this Help Centre: the widget and the order flow are both in Simulate, the plans are a
 *  form in Setup StackBack, what other stores run is a drawer beside it, and thirteen of the
 *  steps are recorded. A merchant reading an answer about the widget with no way through to
 *  the widget goes and asks us instead, which is the support load the corpus exists to
 *  remove.
 *
 *  Matched on the article's own category first, then on the words of its question, because
 *  the categories are broad: "Plans and pricing" holds both "what frequency should we use"
 *  (the plan form) and "can a discount stack with a sale" (the simulator). One destination
 *  per answer, two at most; a row of five buttons under every FAQ is a second navigation. */
import type { HelpArticle } from "./types";

export interface Destination {
  /** The button, in the merchant's words. Never "see the module". */
  label: string;
  /** The Help Centre route it opens. `#/howto/<id>` opens that recording. */
  hash: string;
}

const WIDGET: Destination = { label: "See it on the widget", hash: "#/sim" };
const ORDERS: Destination = { label: "See what the orders look like", hash: "#/sim" };
const PLANS: Destination = { label: "Set your plans up", hash: "#/queries/1" };
const REFS: Destination = { label: "What other stores run", hash: "#/refs" };

/** A recording, when one covers the same ground. Ids are `Clip.id` in `videos.ts`. */
const clip = (id: string, label: string): Destination => ({ label, hash: `#/howto/${id}` });

/** Question-level rules, in order. The first that matches wins, so the narrow ones are
 *  first. A rule that names a recording is preferred to one that names a screen: watching
 *  somebody do it beats reading about doing it. */
const RULES: { re: RegExp; to: Destination[] }[] = [
  { re: /\bbundle/i, to: [clip("b3c5dbf7", "Watch: building a bundle"), WIDGET] },
  { re: /byob|build your own/i, to: [clip("8fbd5f44", "Watch: build your own bundle"), WIDGET] },
  { re: /\bportal\b|customer can|self serve|self-serve/i, to: [clip("f52c05a7", "Watch: the customer portal")] },
  { re: /pause|resume|reschedul|skip a delivery/i, to: [clip("ccdbe148", "Watch: pause, resume, reschedule")] },
  { re: /\bedit|swap|change the (product|item)/i, to: [clip("9aa15dc3", "Watch: editing a subscription")] },
  { re: /install|collaborator|access/i, to: [clip("430ca588", "Watch: install and setup")] },
  { re: /shipping|tax\b/i, to: [clip("eeea4461", "Watch: payment, shipping and tax")] },
  { re: /child order|parent order|how many orders|fulfil/i, to: [ORDERS] },
  { re: /discount|percentage off|stack/i, to: [PLANS, REFS] },
  { re: /frequenc|cadence|how often|run length|duration|how many deliveries/i, to: [PLANS, REFS] },
  { re: /what do other|other stores|similar stores|benchmark|typical/i, to: [REFS] },
  { re: /widget|product page|theme|colour|color|font/i, to: [WIDGET] },
];

/** Category-level fallback, for an answer whose question matches no rule. */
const BY_CAT: Record<string, Destination[]> = {
  widget: [WIDGET],
  plans: [PLANS, REFS],
  bundles: [clip("b3c5dbf7", "Watch: building a bundle"), WIDGET],
  orders: [ORDERS],
  pay: [ORDERS],
  portal: [clip("f52c05a7", "Watch: the customer portal")],
  cancel: [clip("ccdbe148", "Watch: pause, resume, reschedule")],
  ship: [clip("eeea4461", "Watch: payment, shipping and tax")],
  access: [clip("430ca588", "Watch: install and setup")],
  start: [clip("430ca588", "Watch: install and setup")],
};

export function destinationsFor(a: Pick<HelpArticle, "id" | "cat" | "q">): Destination[] {
  for (const r of RULES) if (r.re.test(a.q)) return r.to.slice(0, 2);
  return (BY_CAT[a.cat] || []).slice(0, 2);
}
