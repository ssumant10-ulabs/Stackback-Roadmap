/** Answers added after the deliverable was cut, mined from the pilot conversations.
 *
 *  `corpus.ts` is generated from the Help Centre HTML and must not be hand-edited, so
 *  anything learned since it was built lives here and is merged in `articles.ts`. The shape
 *  is identical, they are searched and chatted the same way, and a reader cannot tell which
 *  file an answer came from — which is the point. When the deliverable is re-cut, whatever
 *  has been folded into it comes out of here.
 *
 *  Source: the Orchard Lane, G-Shot Coffee and Nice Guys (84008) WhatsApp threads,
 *  2026-08-19 to 2026-09-29, plus the AutoPay flow note of 2026-09-29. Every question below
 *  was asked in one of those threads in the merchant's own words; nothing here is imagined.
 *  Checked against the existing 236 first: anything already answered was left alone, which
 *  is why the collaborator code, preview expiry, permission breadth and the one-time toggle
 *  are not in this list. */
import type { HelpArticle } from "./types";

export const EXTRA_ARTICLES: HelpArticle[] = [
  {
    id: "what-role-do-i-pick-to-accept-the-collaborator-request",
    cat: "access", status: "m", asked: 2, ord: 901,
    path: "Settings › Users and permissions › Collaborators",
    q: "Accepting your request asks me to pick a role, and there is no Accept button",
    a: "<p>That screen <em>is</em> the accept. Shopify does not show a plain Accept for a collaborator request: you open the request, choose the permissions it gets, and saving that grants it. If you are looking for a button that says Accept you will not find one.</p>"
      + "<p>Two things to check if the screen looks wrong:</p><ul>"
      + "<li><strong>You are in the wrong place.</strong> The request lands under <em>Settings › Users and permissions</em>, in the <strong>Collaborators</strong> section, not under Staff. It is also emailed to the store owner.</li>"
      + "<li><strong>You are not the owner.</strong> Only the store owner, or staff with permission to manage collaborators, can approve one. If the section is read-only for you, forward the email to whoever owns the store.</li>"
      + "</ul><p>Tick the permissions we asked for and save. The request is accepted at that point and we can see the store.</p>",
  },
  {
    id: "can-we-choose-which-theme-you-duplicate",
    cat: "start", status: "w", asked: 2, ord: 902,
    path: "Online Store › Themes",
    q: "Which theme do you work on, and can we choose it?",
    a: "<p>Yes, you choose. By default we duplicate whichever theme is <strong>live</strong> at the time we start and work on the copy, so your live store is untouched from the first minute to go-live. If you would rather we worked from a different theme, say which one and publish it or name it before we begin.</p>"
      + "<p>This matters more than it sounds. A store part-way through a redesign often has the theme it is <em>about</em> to launch sitting unpublished, and a widget built on the outgoing one has to be built again. It also matters where the theme carries a different checkout: a theme with a third party checkout on it behaves differently at the payment step, so tell us which one is going live with StackBack.</p>"
      + "<p>Nothing we build reaches your live theme until you say go.</p>",
  },
  {
    id: "you-updated-the-app-and-lost-access-to-our-store",
    cat: "access", status: "m", asked: 2, ord: 903,
    path: "Apps › StackBack",
    q: "You say you have updated the app and need us to update permissions. What do we do?",
    a: "<p>When a StackBack release asks for a permission the old install did not have, Shopify freezes our access until somebody on your side approves the new scope. Nothing breaks on your storefront and no subscription stops; we simply cannot open the app until it is done.</p>"
      + "<p>Either of these clears it, and it takes a few seconds:</p><ul>"
      + "<li>Go to <strong>Apps › StackBack</strong> in your admin and open it. Shopify shows the new permission request and you approve it there.</li>"
      + "<li>Or approve the updated collaborator request under <em>Settings › Users and permissions</em>, if we have sent one.</li>"
      + "</ul><p>We will always tell you what changed and why before asking.</p>",
  },
  {
    id: "will-powered-by-stackback-be-visible-to-our-customers",
    cat: "widget", status: "l", asked: 1, ord: 904, path: "",
    q: "Will “Powered by StackBack” be visible to our customers?",
    a: "<p>Yes, by default. It sits under the widget on the product page, small and in your own text colour.</p>"
      + "<p>It can be turned off. It is a setting on the widget, not a plan restriction, so if you would rather it was not there, say so and we will switch it off before go-live or at any point after.</p>",
  },
  {
    id: "can-we-edit-the-landing-page-text-and-images-ourselves",
    cat: "widget", status: "r", asked: 2, ord: 905, path: "",
    q: "Can we edit the landing page text and pictures ourselves?",
    a: "<p>Not yet. Today you send us the copy and the images and we make the change, usually the same day. Two pilot stores have asked to do it themselves and it is on the roadmap as merchant-editable landing page content.</p>"
      + "<p>What you can change yourself today is everything that lives in your own theme: the product title, description and images the widget reads, and anything on the page around the widget. The landing page and the widget copy are ours for now.</p>"
      + "<p>If you are waiting on a round of text edits before go-live, send them in one message rather than one at a time. That is the difference between an hour and a week.</p>",
  },
  {
    id: "can-you-match-a-widget-design-we-have-already-drawn",
    cat: "widget", status: "l", asked: 1, ord: 906, path: "",
    q: "We have our own widget design. Can you build exactly that?",
    a: "<p>Close to it, not identically. On the designs merchants have sent us so far we have been able to cover roughly <strong>90%</strong>: the layout, the plan cards, the schedule picker, the savings badge, your colours, your type and your corner radius all follow the design. What does not is the parts that are structural — where the payment toggle sits, what a selected card does, how the widget reflows on a phone — because those are the same component on every store and changing them for one store is a fork we then maintain forever.</p>"
      + "<p>Send the design anyway. We are rolling out widget templates, and a design that matches one of them closely can be fast-tracked onto that template rather than treated as a one-off.</p>",
  },
  {
    id: "when-is-the-autopay-mandate-created",
    cat: "pay", status: "l", asked: 3, ord: 907, path: "",
    q: "When is the AutoPay mandate created — at the first checkout, or later?",
    a: "<p>It depends which of the two flows your checkout can carry. <strong>Both of them run on Razorpay</strong> — that part does not change, and it is the same requirement as anywhere else AutoPay is mentioned. What changes is <em>when</em> the customer approves the mandate.</p>"
      + "<p><strong>At the first checkout.</strong> The mandate is set up as part of the first payment, and every delivery after it is debited against the mandate with nothing for the customer to do. This is the flow to have. It needs your Razorpay credentials and configuration.</p>"
      + "<p><strong>From the second delivery.</strong> Where the checkout is a third party one that cannot carry a mandate, the first order is paid through it as pay as you go. For the second delivery a payment link is sent; paying it creates the e-mandate, and every delivery from then on is debited against it.</p>"
      + "<p>The cost of the second flow is the transition. There is one extra step, at the second invoice, where a customer can drop off — and until they pay that link the subscription behaves as pay as you go, which means it can pause on non-payment the way pay as you go does.</p>"
      + "<p>Neither flow works without a Razorpay account. With no Razorpay at all, prepaid and pay as you go are the two modes open to you.</p>",
  },
  {
    id: "will-your-checkout-use-our-sites-existing-login-session",
    cat: "pay", status: "n", asked: 1, ord: 908, path: "",
    q: "If a customer is already logged in on our site, will your checkout use that session?",
    a: "<p>No, and it cannot. A login session on your Shopify storefront, or inside a third party checkout, is not readable by us, and ours is not readable by them. That is the same reason every other checkout app ships its own login step rather than continuing yours.</p>"
      + "<p>What actually happens for a customer: they sign in <strong>once</strong> on our checkout. From the next visit they are signed in automatically whenever they reach it, so the step is a first-time cost, not a per-order one.</p>"
      + "<p>If a seamless single sign-on matters more than the subscription itself, the answer is to run the subscription through Shopify's own checkout rather than a third party one.</p>",
  },
  {
    id: "why-does-a-signed-in-customer-still-see-the-address-screen",
    cat: "pay", status: "w", asked: 1, ord: 909, path: "",
    q: "Why does a signed-in customer still get shown the address screen?",
    a: "<p>Deliberately. A repeat subscriber is the customer most likely to want a <em>different</em> address — a second delivery going to an office, a parent's house, a new flat — and skipping the screen for them is how a box goes to the wrong place.</p>"
      + "<p>It is not a form to fill in again. Everything we hold is prefilled, so for a customer who wants the same address it is one look and one tap. The option to enter another address is there beside it.</p>"
      + "<p>If a signed-in customer is seeing an <em>empty</em> address screen rather than a prefilled one, that is a fault rather than the design; tell us the order and we will look.</p>",
  },
];
