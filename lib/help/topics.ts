/** Subscription-setup topics. These are the decisions taken with a client while a plan is
 *  being agreed, which is what the Queries tab logs. Kept in step with the same list in
 *  studio/schemaTypes/merchantQuery.ts by hand: two values, one meaning. */
export const QUERY_TOPICS: { id: string; name: string }[] = [
  { id: "frequency", name: "Delivery frequency" },
  { id: "duration", name: "Plan length and deliveries" },
  { id: "discount", name: "Discounts and bands" },
  { id: "products", name: "Products and variants" },
  { id: "pricing", name: "Pricing and margins" },
  { id: "bundles", name: "Bundles" },
  { id: "payment", name: "Payment mode: prepaid, PAYG, AutoPay" },
  { id: "shipping", name: "Shipping" },
  { id: "other", name: "Something else" },
];

export const QUERY_TOPIC_NAME = new Map(QUERY_TOPICS.map((t) => [t.id, t.name]));
