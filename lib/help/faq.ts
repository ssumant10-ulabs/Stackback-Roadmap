import { ARTICLES } from "./corpus";
import type { HelpArticle } from "./types";

/** The questions that actually come up, trimmed to the ones that come up most.
 *
 *  Only StackBack questions. Access, collaborator codes, permissions, preview links and the
 *  go-live checklist are onboarding: they are answered once, by us, on the way in, and they
 *  are not what a merchant opens the Help Centre for six weeks later. They stay in the full
 *  corpus, searchable, and off this list.
 *
 *  This is curation, not a second corpus: every entry names an article, and the answer is
 *  that article's. Two copies of an answer is a coin flip about which one somebody reads.
 *
 *  The split is the useful part. A merchant choosing plans and a merchant running a live
 *  store are asking different questions, and mixing them is why the full 236 reads as a
 *  wall. Pre-live is everything up to the theme being published. Post-live is everything
 *  after, and it is almost entirely about orders, money and the portal.
 *
 *  Sources: the `asked` counts already in the corpus, which are mined from 32 store
 *  conversations, plus the pilot calls from 2026-08-27 to 2026-09-24 (Zoy Care, Glow
 *  Glossary, Rosier, Go Swasthya, Food RX, Local Ferment, Iron Asylum, Blue Tea, The Stack,
 *  G-Shot, Meru, Nice Guys). Where a call raised something the corpus already answered, the
 *  article is listed here rather than rewritten. */

export type FaqPhase = "pre" | "post";

export interface FaqSection {
  phase: FaqPhase;
  title: string;
  blurb: string;
  groups: { title: string; ids: string[] }[];
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    phase: "pre",
    title: "Before you go live",
    blurb: "Deciding what to sell on subscription, and how it looks on your product page.",
    groups: [
      {
        title: "The plans",
        ids: [
          "which-products-or-collections-should-carry-a-subscription",
          "what-payment-options-can-we-offer-and-which-should-we-pick",
          "what-delivery-frequency-and-plan-length-should-we-use",
          "what-discount-should-we-set",
          "will-our-existing-store-discounts-stack-on-top-of-subscription-d",
          "what-is-the-difference-between-a-fixed-bundle-and-build-your-own",
        ],
      },
      {
        title: "The widget",
        ids: [
          "where-can-the-widget-sit-on-the-product-page",
          "can-the-widget-match-our-fonts-and-colours",
          "can-one-time-purchase-be-the-default-selection",
        ],
      },
      {
        title: "Payments and shipping",
        ids: [
          "how-does-upi-autopay-work-and-what-do-you-need-from-us",
          "does-cod-need-to-be-disabled-for-subscriptions",
          "how-is-shipping-handled-on-subscriptions",
        ],
      },
    ],
  },
  {
    phase: "post",
    title: "Once you are live",
    blurb: "Orders, money and the customer portal. Almost every question after launch is one of these.",
    groups: [
      {
        title: "Orders and money",
        ids: [
          "what-does-one-subscription-create-in-shopify",
          "what-happens-the-moment-a-customer-subscribes",
          "how-do-we-identify-subscription-orders-inside-shopify",
          "will-the-checkout-order-inflate-our-revenue-and-inventory-number",
          "how-pay-as-you-go-billing-decides-to-charge-or-pause",
          "can-a-customer-effectively-cancel-by-just-not-paying",
        ],
      },
      {
        title: "What customers can do themselves",
        ids: [
          "what-is-the-customer-portal-and-where-does-it-live",
          "what-do-swap-add-and-reschedule-actually-do-and-who-pays",
          "can-you-pause-a-customer-s-subscription-for-a-month",
          "which-notifications-does-stackback-send",
        ],
      },
      {
        title: "AutoPay in flight",
        ids: [
          "how-do-we-know-who-cancelled-an-autopay-mandate",
          "a-subscription-order-shows-as-cancelled-and-we-did-not-cancel-it",
        ],
      },
    ],
  },
];

const BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));

/** Resolve a section's ids to articles, dropping any the corpus no longer carries.
 *  A regenerated corpus can rename a slug, and a FAQ that silently shows a blank row is
 *  worse than one that is a question short, so `missing` is returned rather than swallowed. */
export function resolveFaq(section: FaqSection): {
  groups: { title: string; articles: HelpArticle[] }[];
  missing: string[];
} {
  const missing: string[] = [];
  const groups = section.groups.map((g) => ({
    title: g.title,
    articles: g.ids.map((id) => {
      const a = BY_ID.get(id);
      if (!a) missing.push(id);
      return a;
    }).filter(Boolean) as HelpArticle[],
  }));
  return { groups, missing };
}

/** Every article the curated FAQ points at. Search reads it as an editorial prior: a question
 *  on this list is one merchants are known to arrive with, which no word count can tell you. */
export const FAQ_IDS = new Set(FAQ_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.ids)));

/** Merchant phrasings that name an answer without sharing a word with it, each one a miss
 *  observed while testing the ranker against how pilot stores actually type.
 *
 *  This is the same discipline as the alias groups in `search.ts` and it exists for the
 *  cases those cannot reach: "two orders" is the order-flow question, and the order-flow
 *  article says "one order" throughout, so no amount of term weighting gets there. A boost,
 *  never an override, so a better lexical match still wins.
 *
 *  Grows only from a real miss. Add the case to `scripts/eval-search.ts` in the same edit,
 *  or nothing stops the next change from undoing it. */
export const INTENTS: { when: RegExp; id: string }[] = [
  { when: /\b(two|second|extra|duplicate|another) orders?\b|\bparent (order|and child)|\bchild order/,
    id: "what-does-one-subscription-create-in-shopify" },
  { when: /\b(change|swap|replace|switch)\b[^?]{0,24}\b(product|item|sku|flavour|flavor)\b/,
    id: "what-do-swap-add-and-reschedule-actually-do-and-who-pays" },
  { when: /\b(wants? to cancel|cancel (a |my |the |their )?subscription|stop (a |the |their )?subscription|how (do|to) .{0,12}cancel)\b/,
    id: "how-does-cancellation-work" },
  { when: /\b(double|inflate|overstate|twice)\b[^?]{0,24}\b(revenue|sales|turnover|inventory)\b/,
    id: "will-the-checkout-order-inflate-our-revenue-and-inventory-number" },
];

export const FAQ_COUNT = FAQ_SECTIONS.reduce(
  (n, s) => n + s.groups.reduce((m, g) => m + g.ids.length, 0), 0,
);

/** The topic rail, grouped. Seventeen flat rows is a list you read rather than scan, and the
 *  grouping is the same one the FAQ uses: what you set up, what runs, what breaks. */
export const NAV_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Start", ids: ["start", "flows", "admin"] },
  { title: "What you sell", ids: ["plans", "bundles", "widget"] },
  { title: "Money and delivery", ids: ["pay", "ship", "orders", "stock"] },
  { title: "Your customers", ids: ["portal", "cancel", "notify"] },
  { title: "Around the app", ids: ["access", "integ", "report", "bill"] },
];

/** Which wizard step answers a question better than prose does. A widget question is really
 *  a question about a screen the merchant can open and change, and sending them to it beats
 *  another paragraph. */
export const FAQ_JUMPS: Record<string, { step: 2 | 3; label: string }> = {
  "where-can-the-widget-sit-on-the-product-page": { step: 2, label: "See it on the widget" },
  "can-the-widget-match-our-fonts-and-colours": { step: 2, label: "See it in your colours" },
  "can-one-time-purchase-be-the-default-selection": { step: 2, label: "Change it on the widget" },
  "what-payment-options-can-we-offer-and-which-should-we-pick": { step: 2, label: "See the payment tabs" },
  "does-cod-need-to-be-disabled-for-subscriptions": { step: 2, label: "See the payment tabs" },
  "what-does-one-subscription-create-in-shopify": { step: 3, label: "See the orders it creates" },
  "what-happens-the-moment-a-customer-subscribes": { step: 3, label: "See the orders it creates" },
  "how-do-we-identify-subscription-orders-inside-shopify": { step: 3, label: "See the tags we write" },
  "will-the-checkout-order-inflate-our-revenue-and-inventory-number": { step: 3, label: "See the orders it creates" },
  "how-pay-as-you-go-billing-decides-to-charge-or-pause": { step: 3, label: "Compare the payment types" },
  "what-do-swap-add-and-reschedule-actually-do-and-who-pays": { step: 3, label: "See Purchase Contracts" },
  "can-you-pause-a-customer-s-subscription-for-a-month": { step: 3, label: "See Purchase Contracts" },
};

/** What answers each FAQ question better than prose: a recording, a module in this app, or
 *  both. A question with neither is a question we answer by typing, every time somebody asks.
 *  `clip` ids that are `p-*` are not recorded yet and show as pending rather than as a link. */
export const FAQ_MEDIA: Record<string, { clip?: string; step?: 1 | 2 | 3 }> = {
  // before you go live
  "which-products-or-collections-should-carry-a-subscription": { step: 1 },
  "what-payment-options-can-we-offer-and-which-should-we-pick": { step: 2 },
  "what-delivery-frequency-and-plan-length-should-we-use": { step: 1 },
  "what-discount-should-we-set": { step: 1 },
  "will-our-existing-store-discounts-stack-on-top-of-subscription-d": { clip: "p-discount-stack" },
  "what-is-the-difference-between-a-fixed-bundle-and-build-your-own": { clip: "b3c5dbf7" },
  "where-can-the-widget-sit-on-the-product-page": { clip: "p-widget-place", step: 2 },
  "can-the-widget-match-our-fonts-and-colours": { step: 2 },
  "can-one-time-purchase-be-the-default-selection": { step: 2 },
  "how-does-upi-autopay-work-and-what-do-you-need-from-us": { clip: "p-autopay" },
  "does-cod-need-to-be-disabled-for-subscriptions": { clip: "p-cod" },
  "how-is-shipping-handled-on-subscriptions": { clip: "eeea4461" },
  // once you are live
  "what-does-one-subscription-create-in-shopify": { clip: "0816f724", step: 3 },
  "what-happens-the-moment-a-customer-subscribes": { clip: "0816f724", step: 3 },
  "how-do-we-identify-subscription-orders-inside-shopify": { step: 3 },
  "will-the-checkout-order-inflate-our-revenue-and-inventory-number": { clip: "p-revenue-filter", step: 3 },
  "how-pay-as-you-go-billing-decides-to-charge-or-pause": { clip: "p-payg-billing", step: 3 },
  "can-a-customer-effectively-cancel-by-just-not-paying": { clip: "p-payg-billing" },
  "what-is-the-customer-portal-and-where-does-it-live": { clip: "f52c05a7" },
  "what-do-swap-add-and-reschedule-actually-do-and-who-pays": { clip: "9aa15dc3" },
  "can-you-pause-a-customer-s-subscription-for-a-month": { clip: "ccdbe148" },
  "which-notifications-does-stackback-send": { clip: "p-notifications" },
  "how-do-we-know-who-cancelled-an-autopay-mandate": { clip: "p-mandates" },
  "a-subscription-order-shows-as-cancelled-and-we-did-not-cancel-it": { clip: "p-cancellations" },
};
