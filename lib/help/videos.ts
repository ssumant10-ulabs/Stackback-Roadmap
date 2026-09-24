/** The how-to library.
 *
 *  Sources are the direct media files on ClickUp's attachment host, not the sharing.clickup
 *  page. The share link in the manual returns an HTML player app, so a <video> pointed at it
 *  fails with a format error, which is why these are the attachment URLs the player itself
 *  fetches. Deriving them is mechanical: same team and clip id, different host.
 *
 *  That matters because the point is to WATCH these here rather than be sent somewhere. A
 *  link out of a help centre is a tab a merchant does not come back from. */

export interface Clip {
  id: string;
  /** Held back from the merchant view. Used for a recording that still shows real
   *  customer or merchant detail: a clip nobody has redacted is not a help article. */
  internalOnly?: boolean;
  title: string;
  src: string;
  /** Set when the file is served from this app rather than ClickUp. */
  local?: boolean;
  note?: string;
}

export interface ClipGroup {
  id: string;
  title: string;
  blurb: string;
  clips: Clip[];
}

export const CLIP_GROUPS: ClipGroup[] = [
  {
    id: "setup", title: "Setting up StackBack", blurb: "Installing the app and setting its payment, shipping and tax rules. Do these once, in order.",
    clips: [
      { id: "430ca588", title: "Install and Setup", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/430ca588-1e8a-4871-8802-3b07ab3888b6/430ca588-1e8a-4871-8802-3b07ab3888b6.webm?filename=Stackback%20-%20Install%20and%20Setup.webm" },
      { id: "eeea4461", title: "Payment, Shipping & Tax", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/eeea4461-8bf2-4a8b-a129-e8693094b86a/eeea4461-8bf2-4a8b-a129-e8693094b86a.webm?filename=Stackback%20-%20Payment%2C%20Shipping%20%26%20Tax.webm" },
    ],
  },
  {
    id: "plans", title: "Building plans", blurb: "The two plan shapes, and when each one fits.",
    clips: [
      { id: "35394521", title: "Fixed Subscription Plan", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/35394521-2858-49f2-ac87-46f72761973b/35394521-2858-49f2-ac87-46f72761973b.webm?filename=Stackback%20-%20Fixed%20Subscription%20Plan.webm" },
      { id: "862f0b21", title: "Custom Subscription Plan", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/862f0b21-0b11-47af-8f25-78c065923e15/862f0b21-0b11-47af-8f25-78c065923e15.webm?filename=Stackback%20-%20Custom%20Subscription%20Plan.webm" },
    ],
  },
  {
    id: "bundles", title: "Building bundles", blurb: "Four bundle types. Pick the one that matches how you want the discount to work.",
    clips: [
      { id: "b3c5dbf7", title: "Fixed BuyXgetY Bundle", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/b3c5dbf7-c2c8-4a2b-bbee-aa4d7565caf2/b3c5dbf7-c2c8-4a2b-bbee-aa4d7565caf2.webm?filename=Stackback%20-%20Fixed%20BuyXgetY%20Bundle.webm" },
      { id: "1b996490", title: "Fixed Static Custom Duration", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/1b996490-77c5-49ae-8a2f-b1cabb6d11dd/1b996490-77c5-49ae-8a2f-b1cabb6d11dd.webm?filename=Stackback%20-%20Fixed%20Static%20Custom%20Duration.webm" },
      { id: "8fbd5f44", title: "BYOB Tiered Fixed Duration Bundle", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/8fbd5f44-e9c9-4e34-bd65-1ded38f5da2f/8fbd5f44-e9c9-4e34-bd65-1ded38f5da2f.webm?filename=Stackback%20-%20BYOB%20Tiered%20Fixed%20Duration%20Bundle.webm" },
      { id: "83ce0370", title: "BYOB Percentage Bundle", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/83ce0370-71ef-4e88-a0df-da1370df6152/83ce0370-71ef-4e88-a0df-da1370df6152.webm?filename=BYOB%20Percentage%20Bundle.webm" },
    ],
  },
  {
    id: "orders", title: "Orders and edits", blurb: "What happens once a customer subscribes, and how to change it afterwards.",
    clips: [
      { id: "0816f724", title: "Placing Subscription Order", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/0816f724-b936-4fd8-b7b9-098aef902e50/0816f724-b936-4fd8-b7b9-098aef902e50.webm?filename=Stackback%20-%20Placing%20Subscription%20Order.webm" },
      { id: "9aa15dc3", title: "Subscription Plan Edits", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/9aa15dc3-86ac-4862-af61-01592ab73233/9aa15dc3-86ac-4862-af61-01592ab73233.webm?filename=Subscription%20Plan%20Edits.webm" },
      { id: "ccdbe148", title: "Subscription Reschedule, Pause, Resume", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/ccdbe148-5b8e-4575-b7eb-6da055401d16/ccdbe148-5b8e-4575-b7eb-6da055401d16.webm?filename=Stackback%20-%20Subscription%20Reschedule%2C%20Pause%2C%20Resume.webm" },
      { id: "77e48ba9", title: "Placing Bundle Subscription", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/77e48ba9-15d1-4348-b74e-c46ffa3aea50/77e48ba9-15d1-4348-b74e-c46ffa3aea50.webm?filename=Stackback%20-%20Placing%20Bundle%20Subscription.webm" },
    ],
  },
  {
    id: "portal", title: "Customer portal", blurb: "What your customers can do for themselves.",
    clips: [
      { id: "f52c05a7", title: "Customer Portal Settings 1", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/f52c05a7-74b7-439c-bcde-61ad5f664096/f52c05a7-74b7-439c-bcde-61ad5f664096.webm?filename=Stackback%20-%20Customer%20Portal%20Settings%201.webm" },
      { id: "fcceb5e3", title: "Customer Portal Settings 2", src: "https://t9016928151.p.clickup-attachments.com/t9016928151/fcceb5e3-9473-42da-820b-9024dc773d07/fcceb5e3-9473-42da-820b-9024dc773d07.webm?filename=Stackback%20-%20Customer%20Portal%20Settings%202.webm" },
    ],
  },  {
    id: "managing",
    title: "Managing subscriptions",
    blurb: "Running a live subscription: what to change, where, and what it does to the deliveries.",
    clips: [
      {
        id: "managing-subs",
        title: "Reschedule, pause and resume a subscription",
        src: "/help/videos/managing-subscriptions.mp4",
        local: true,
      },
    ],
  },
];

export const ALL_CLIPS = CLIP_GROUPS.flatMap((g) => g.clips);
