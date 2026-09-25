/** Ranking regression check for the Help Centre search and chat.
 *
 *  Search quality is invisible without this: the box always returns something, so a change
 *  that quietly makes the top hit wrong looks identical to one that fixes it. Every row
 *  below is a question a pilot merchant actually asked, in their words, paired with the
 *  article that answers it. The words are theirs on purpose: "cash on delivery" and
 *  "turn off COD" are the same question, and the corpus says neither.
 *
 *  Run: npx tsx scripts/eval-search.ts
 *  Pass bar: TOP1 >= 0.90, TOP3 >= 0.95, and the chat answering (rather than asking which
 *  one) on at least 0.70 of these, because a chat that asks a clarifying question three
 *  times in four is a search box with extra steps.
 */
import { search } from "../lib/help/search";
import { reply } from "../lib/help/chat";
import { ARTICLES } from "../lib/help/corpus";

/** [what the merchant typed, the id that answers it, acceptable alternates] */
const CASES: [string, string, string[]?][] = [
  ["cod", "does-cod-need-to-be-disabled-for-subscriptions", ["how-do-we-disable-cod-only-on-subscriptions-not-the-whole-store"]],
  ["how do I turn off cash on delivery", "how-do-we-disable-cod-only-on-subscriptions-not-the-whole-store", ["does-cod-need-to-be-disabled-for-subscriptions"]],
  ["autopay", "how-does-upi-autopay-work-and-what-do-you-need-from-us"],
  ["mandate cancelled", "how-do-we-know-who-cancelled-an-autopay-mandate"],
  ["why two orders", "what-does-one-subscription-create-in-shopify", ["what-happens-the-moment-a-customer-subscribes"]],
  ["does the checkout order double my revenue", "will-the-checkout-order-inflate-our-revenue-and-inventory-number"],
  ["how do I know which order is a subscription", "how-do-we-identify-subscription-orders-inside-shopify"],
  ["what does the parent order mean", "what-does-one-subscription-create-in-shopify", ["how-do-we-identify-subscription-orders-inside-shopify"]],
  ["skip a delivery", "can-a-customer-skip-just-one-delivery"],
  ["widget colours", "can-the-widget-match-our-fonts-and-colours"],
  // Shiprocket is only ever a CHECKOUT in this corpus. The first version of this case
  // expected a WMS article, which no article supports; the ranking was right and the case
  // was wrong.
  ["shiprocket", "does-stackback-work-with-our-third-party-checkout", ["which-checkouts-have-you-worked-with"]],
  ["pause subscription", "can-you-pause-a-customer-s-subscription-for-a-month"],
  ["customer wants to cancel", "how-does-cancellation-work"],
  ["byob", "what-is-the-difference-between-a-fixed-bundle-and-build-your-own"],
  ["payg unpaid", "how-pay-as-you-go-billing-decides-to-charge-or-pause"],
  ["notifications", "which-notifications-does-stackback-send"],
  ["what is the customer portal", "what-is-the-customer-portal-and-where-does-it-live"],
  ["can the customer change the product in a delivery", "what-do-swap-add-and-reschedule-actually-do-and-who-pays"],
  ["where can the widget sit", "where-can-the-widget-sit-on-the-product-page"],
  ["what discount should we set", "what-discount-should-we-set"],
];

const BY_ID = new Set(ARTICLES.map((a) => a.id));
let top1 = 0, top3 = 0, answered = 0, bad = 0;
const rows: string[] = [];

for (const [q, want, alts = []] of CASES) {
  const ok = new Set([want, ...alts]);
  for (const id of ok) if (!BY_ID.has(id)) { console.log(`!! case "${q}" names a missing article: ${id}`); bad++; }
  const hits = search(q, 5);
  const at = hits.findIndex((h) => ok.has(h.art.id));
  if (at === 0) top1++;
  if (at >= 0 && at < 3) top3++;
  const r = reply(q);
  if (r.kind === "answer" && r.art && ok.has(r.art.id)) answered++;
  rows.push(
    `${at === 0 ? "  ok" : at > 0 ? ` @${at + 1}` : "MISS"}  ${q.padEnd(46)} ${String(r.kind).padEnd(6)} ${(hits[0]?.art.q ?? "-").slice(0, 60)}`,
  );
}

const n = CASES.length;
const pct = (x: number) => (x / n).toFixed(2);
console.log(rows.join("\n"));
console.log(`\nTOP1 ${top1}/${n} = ${pct(top1)}   TOP3 ${top3}/${n} = ${pct(top3)}   chat answers correctly ${answered}/${n} = ${pct(answered)}`);
const fail = bad > 0 || top1 / n < 0.9 || top3 / n < 0.95 || answered / n < 0.7;
console.log(fail ? "FAIL" : "PASS");
process.exit(fail ? 1 : 0);
