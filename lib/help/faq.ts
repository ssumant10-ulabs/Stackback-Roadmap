import { ARTICLES } from "./corpus";
import type { HelpArticle } from "./types";

/** The questions that actually come up, in the order they come up in.
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
    blurb: "Setting up, deciding the plans, and seeing it before anything touches your store.",
    groups: [
      {
        title: "Getting started",
        ids: [
          "what-do-you-need-from-us-to-get-started",
          "where-do-i-find-the-collaborator-code",
          "which-permissions-do-you-need-and-which-can-i-withhold",
          "i-approved-the-request-is-anything-still-pending",
          "what-happens-after-we-give-access-and-install-the-app",
        ],
      },
      {
        title: "Deciding the plans",
        ids: [
          "what-do-you-need-us-to-decide-before-you-build-anything",
          "which-products-or-collections-should-carry-a-subscription",
          "what-payment-options-can-we-offer-and-which-should-we-pick",
          "what-delivery-frequency-and-plan-length-should-we-use",
          "what-discount-should-we-set",
          "can-different-products-have-different-discounts-and-durations",
          "will-our-existing-store-discounts-stack-on-top-of-subscription-d",
          "can-we-add-freebies-to-a-plan",
          "what-is-the-difference-between-a-fixed-bundle-and-build-your-own",
        ],
      },
      {
        title: "The widget on your store",
        ids: [
          "where-can-the-widget-sit-on-the-product-page",
          "can-the-widget-match-our-fonts-and-colours",
          "can-we-change-the-widget-copy",
          "how-much-of-the-widget-layout-can-we-change",
          "can-one-time-purchase-be-the-default-selection",
          "where-do-customers-find-the-bundles",
        ],
      },
      {
        title: "Payments, checkout and shipping",
        ids: [
          "does-cod-need-to-be-disabled-for-subscriptions",
          "does-stackback-work-with-our-third-party-checkout",
          "how-does-upi-autopay-work-and-what-do-you-need-from-us",
          "how-is-shipping-handled-on-subscriptions",
          "can-reminders-go-by-whatsapp-instead-of-email",
        ],
      },
      {
        title: "Preview and go-live",
        ids: [
          "will-anything-go-live-on-our-store-without-our-approval",
          "why-has-my-preview-link-expired",
          "can-we-test-the-whole-flow-ourselves-before-going-live",
          "can-we-hold-go-live-until-our-new-theme-site-or-checkout-is-read",
          "pre-go-live-checklist",
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
        title: "What a checkout creates",
        ids: [
          "what-happens-the-moment-a-customer-subscribes",
          "why-does-one-subscription-create-two-orders-it-does-not-any-more",
          "how-do-we-identify-subscription-orders-inside-shopify",
          "how-do-we-test-that-the-second-and-third-orders-actually-get-cre",
          "a-one-time-item-in-the-same-cart-as-a-subscription-was-auto-fulf",
        ],
      },
      {
        title: "Money and reporting",
        ids: [
          "will-the-checkout-order-inflate-our-revenue-and-inventory-number",
          "will-the-checkout-orders-distort-our-analytics",
          "our-gst-report-and-our-sales-dashboard-do-not-agree",
          "how-pay-as-you-go-billing-decides-to-charge-or-pause",
          "can-a-customer-effectively-cancel-by-just-not-paying",
        ],
      },
      {
        title: "AutoPay once it is running",
        ids: [
          "how-do-we-know-who-cancelled-an-autopay-mandate",
          "why-does-the-mandate-screen-show-a-bigger-amount-and-a-date-in-2",
        ],
      },
      {
        title: "What customers can do themselves",
        ids: [
          "what-is-the-customer-portal-and-where-does-it-live",
          "what-do-swap-add-and-reschedule-actually-do-and-who-pays",
          "can-you-pause-a-customer-s-subscription-for-a-month",
          "can-we-turn-off-a-portal-action-we-do-not-want-customers-using",
          "which-notifications-does-stackback-send",
        ],
      },
      {
        title: "When something looks wrong",
        ids: [
          "a-subscription-order-shows-as-cancelled-and-we-did-not-cancel-it",
          "a-customer-was-told-their-subscription-was-paused-with-no-warnin",
          "will-future-orders-be-created-if-the-first-one-was-cancelled",
          "we-published-a-new-theme-does-the-widget-need-setting-up-again",
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

export const FAQ_COUNT = FAQ_SECTIONS.reduce(
  (n, s) => n + s.groups.reduce((m, g) => m + g.ids.length, 0), 0,
);
