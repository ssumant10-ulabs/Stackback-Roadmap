/** Edits layered on top of the generated corpus.
 *
 *  `corpus.ts` is a build product of the v6 deliverable and stays untouched. This file is where
 *  the Help Centre says things more plainly, merges answers that said the same thing twice, and
 *  carries what changed after v6 was cut (the two first-delivery flows). `articles.ts` applies
 *  it once, so search, the chat, the FAQ and the counts all read the edited version. */

/** Topic names a merchant would use, not ours. Same ids, so links keep working. */
export const CATEGORY_TEXT: Record<string, { name: string; blurb: string }> = {
  start: { name: "Getting started", blurb: "From the first call to going live, step by step." },
  access: { name: "Access and install", blurb: "Giving us access to your store and installing the app." },
  plans: { name: "Plans and discounts", blurb: "How often, for how long, and at what discount." },
  bundles: { name: "Bundles", blurb: "Fixed bundles, build your own, and where customers find them." },
  widget: { name: "Product page widget", blurb: "What sits on your product page, where, and in which colours." },
  pay: { name: "Payments and checkout", blurb: "Prepaid, pay as you go, UPI AutoPay, COD and checkout apps." },
  orders: { name: "Orders", blurb: "What a subscription creates in Shopify, and when." },
  ship: { name: "Shipping", blurb: "Rates, pincodes and free shipping." },
  stock: { name: "Stock", blurb: "Inventory, out of stock items and freebies." },
  portal: { name: "Customer portal", blurb: "What customers can change themselves." },
  cancel: { name: "Cancellations and refunds", blurb: "How a cancel request works and what gets refunded." },
  notify: { name: "Emails and messages", blurb: "What we send your customers, and when." },
  flows: { name: "How it works", blurb: "The few rules behind most of the questions." },
  admin: { name: "Using the app", blurb: "The screens in the app and what you can change yourself." },
  integ: { name: "Other apps", blurb: "Checkouts, page builders, warehouses and loyalty apps." },
  report: { name: "Reports", blurb: "Seeing how subscriptions perform." },
  bill: { name: "Our pricing", blurb: "The pilot and the paid plans." },
};

/** Answers that said the same thing as another one. Hidden, and their old links land on the
 *  one that stays. */
export const MERGED: Record<string, string> = {
  "what-happens-the-moment-a-customer-subscribes": "what-does-one-subscription-create-in-shopify",
  "which-checkouts-have-you-worked-with": "does-stackback-work-with-our-third-party-checkout",
  "can-shipping-be-free-above-a-cart-value-in-a-specific-region-onl": "can-free-shipping-kick-in-above-a-cart-value",
};

export interface ArticleEdit {
  q?: string;
  /** The answer in one sentence. Shown first, in bold; the full answer sits under it. */
  short?: string;
  a?: string;
}

const FIRST_DELIVERY_A = `
<p>It depends on one setting: <strong>Settings › First delivery</strong>. Both flows take the money once, at checkout, on one order tagged <code>parent</code>.</p>
<h4>Single order (Add to the original order)</h4>
<ul>
<li>Checkout creates <strong>one order</strong>.</li>
<li>Within minutes we edit that same order and add <strong>delivery 1's product</strong> to it. Your warehouse ships delivery 1 from this order.</li>
<li>The rest of the plan sits on a placeholder line marked <em>shipping not required</em>, so nothing picks it up.</li>
<li>The order gets <code>sb-delivery-1-converted</code>. The old line shows under <em>Removed</em>; that is Shopify keeping history, not a cancellation.</li>
</ul>
<h4>Separate order (Create a separate order)</h4>
<ul>
<li>Checkout creates the <code>parent</code> order. It holds the placeholder only, has no shipping, and is fulfilled automatically.</li>
<li>About 10 seconds later a <strong>second order</strong>, tagged <code>child</code>, appears with delivery 1's real product. Your warehouse ships that one.</li>
<li>Seeing two orders at once is expected. Only the child ships.</li>
</ul>
<p><strong>In both flows</strong>, deliveries 2 onward have no order yet. Each one is created 7 days before its delivery date (your <em>time to delivery</em> setting), and only once it is paid for. A six delivery plan never creates six orders at checkout.</p>
<p><strong>AutoPay</strong> ignores the setting: its first order already carries the real product, so there is nothing to convert and no separate delivery 1 order.</p>`;

export const EDITS: Record<string, ArticleEdit> = {
  /* ---------- before launch ---------- */
  "which-products-or-collections-should-carry-a-subscription": {
    short: "Start with the products people already reorder. You can pick products, a whole collection, or everything, and we suggest a list from your order data.",
  },
  "what-payment-options-can-we-offer-and-which-should-we-pick": {
    short: "Two: Prepaid (the whole plan paid upfront) and Pay per delivery, which is UPI AutoPay (each delivery debited automatically). We recommend offering both.",
    a: `<p>We recommend two, offered side by side:</p><ul><li><strong>Prepaid</strong>: the customer pays for the whole plan upfront. Revenue lands on day one and longer plans earn a bigger discount.</li><li><strong>Pay per delivery (UPI AutoPay)</strong>: the customer approves a Razorpay mandate once and each delivery is debited automatically, until they stop it. It sits just below the longest prepaid plan's discount.</li></ul><p>Pay by link (pay as you go) is not recommended: every delivery waits on the customer paying a link, so plans stall when they forget. AutoPay collects the same way without the chasing.</p>`,
  },
  "what-delivery-frequency-and-plan-length-should-we-use": {
    short: "Whatever matches how often your customers already reorder. We measure that gap from your orders and propose it; you can change it.",
  },
  "what-discount-should-we-set": {
    short: "A little above your usual store discount on the shortest plan, then 3 to 4 points more for each longer plan.",
  },
  "will-our-existing-store-discounts-stack-on-top-of-subscription-d": {
    short: "Automatic cart discounts can stack unless we exclude them, so ask us to before launch. Discount codes do not stack.",
  },
  "what-is-the-difference-between-a-fixed-bundle-and-build-your-own": {
    short: "A fixed bundle is a set you choose. Build your own lets the customer pick from a pool, with the discount growing as they add more.",
  },
  "where-can-the-widget-sit-on-the-product-page": {
    short: "Above or below your Add to cart button. Try both in the Widget lab on your kind of product page before deciding.",
  },
  "can-the-widget-match-our-fonts-and-colours": {
    short: "Yes. It uses your site font, and we set seven colours to match your theme. You can try them yourself in the Widget lab.",
  },
  "can-one-time-purchase-be-the-default-selection": {
    short: "Yes. One time purchase is selected when the page loads, and you can switch the default to Subscribe whenever you like.",
    a: `<p>Yes, and it is the default today: one time purchase is selected when the page loads, and the subscription options sit right under it.</p><p>Subscribe as the default gets more people to notice the plan, but two pilot stores saw conversion dip with it and switched back. If your conversion rate is sensitive, keep one time as the default and test Subscribe once you have a baseline.</p>`,
  },
  "how-does-upi-autopay-work-and-what-do-you-need-from-us": {
    short: "The customer approves a UPI mandate once, and each later delivery is debited automatically. We need your Razorpay account to run it.",
  },
  "does-cod-need-to-be-disabled-for-subscriptions": {
    short: "Yes, before you go live. Otherwise a customer can be asked to pay again at the door for something already paid.",
  },
  "how-is-shipping-handled-on-subscriptions": {
    short: "You set your real rates in StackBack, and shipping is charged only on orders that actually ship. Send us your rate card.",
  },

  /* ---------- after launch ---------- */
  "what-does-one-subscription-create-in-shopify": {
    q: "What does one subscription create in Shopify?",
    short: "One paid order at checkout. Delivery 1 either ships from that same order or from a second order a few seconds later, depending on your First delivery setting. Later deliveries become orders only when they are due and paid.",
    a: FIRST_DELIVERY_A,
  },
  "how-do-we-identify-subscription-orders-inside-shopify": {
    short: "By tag. The checkout order is tagged parent, every delivery order after it is tagged child.",
  },
  "will-the-checkout-order-inflate-our-revenue-and-inventory-number": {
    short: "No. The money is counted once, on the parent order. Leave child orders out of revenue reports, because they are paid for by the parent.",
  },
  "how-pay-as-you-go-billing-decides-to-charge-or-pause": {
    short: "We send a payment link and reminders before each delivery. Paid in time: the order is created. Still unpaid on the delivery date: the subscription pauses.",
  },
  "can-a-customer-effectively-cancel-by-just-not-paying": {
    short: "On pay as you go, yes: not paying pauses the plan. Keep that discount lower, or put a freebie later in the plan.",
  },
  "what-is-the-customer-portal-and-where-does-it-live": {
    short: "A page on your own domain where customers manage their subscription: reschedule, swap, add, pause, pay a pending link or ask to cancel.",
  },
  "what-do-swap-add-and-reschedule-actually-do-and-who-pays": {
    short: "Swap and Add change the next delivery only, and the customer pays any difference first. Reschedule moves dates and costs nothing.",
  },
  "can-you-pause-a-customer-s-subscription-for-a-month": {
    short: "Yes. You can do it in Purchase Contracts, the customer can do it in the portal, or we can do it for you.",
  },
  "which-notifications-does-stackback-send": {
    short: "Nineteen emails across the whole journey: sign up, payment links, delivery reminders, changes and cancellations. You can preview each one in the app.",
  },
  "how-do-we-know-who-cancelled-an-autopay-mandate": {
    short: "Purchase Contracts shows it straight away: the subscription shows as downgraded.",
  },
  "a-subscription-order-shows-as-cancelled-and-we-did-not-cancel-it": {
    short: "Open the order timeline in Shopify: it names who cancelled. Send us the order number if it is unclear.",
  },
  "how-does-cancellation-work": {
    short: "The customer asks to cancel in the portal, you approve or decline, and the app works out the refund for deliveries not yet sent.",
  },
  "does-stackback-work-with-our-third-party-checkout": {
    short: "Yes on the product page: we have gone live with GoKwik, Shopflo, Shiprocket checkout and Razorpay. Landing and bundle pages use Shopify's own checkout.",
    a: `<p>Yes, for the product page widget. Stores have gone live with <strong>GoKwik, Shopflo, Shiprocket checkout and Razorpay</strong>, as well as Shopify's own checkout.</p><p>The exception is <strong>landing pages and bundle pages</strong>. They are hosted on our portal, so they always use Shopify's own checkout. If every order must go through your checkout partner, use the product page widget and we switch the landing pages off.</p><p>Setting it up needs your checkout partner too, so raise it in your first week, not your launch week.</p>`,
  },
};
