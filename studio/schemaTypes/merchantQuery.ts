import { defineField, defineType } from "sanity";
import { HelpCircleIcon } from "@sanity/icons/HelpCircle";

/** The topics a query can be filed under. Same ids as the Help Centre corpus, so an answered
 *  query can sit beside the FAQs it relates to rather than in a list of its own. */
/** What the query is about. These are the subscription-setup decisions we take with a
 *  client during onboarding and re-cuts, not the Help Centre's reading topics: the queries
 *  logged here are the frequency, discount and product questions that come up while a plan
 *  is being agreed. */
const TOPICS = [
  { title: "Delivery frequency", value: "frequency" },
  { title: "Plan length and deliveries", value: "duration" },
  { title: "Discounts and bands", value: "discount" },
  { title: "Products and variants", value: "products" },
  { title: "Pricing and margins", value: "pricing" },
  { title: "Bundles", value: "bundles" },
  { title: "Payment mode: prepaid, PAYG, AutoPay", value: "payment" },
  { title: "Shipping", value: "shipping" },
  { title: "Something else", value: "other" },
];

export const merchantQuery = defineType({
  name: "merchantQuery",
  title: "Subscription query",
  type: "document",
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: "question",
      title: "The query, in the words it was raised",
      type: "text",
      rows: 2,
      description:
        "Keep the client's phrasing. Search matches what people type, and rewriting it into our vocabulary is how a query stops being findable.",
      validation: (rule) => rule.required().min(8),
    }),
    defineField({
      name: "status",
      type: "string",
      initialValue: "new",
      options: {
        list: [
          { title: "New, needs an answer", value: "new" },
          { title: "Answered and public", value: "answered" },
          { title: "Parked", value: "parked" },
        ],
        layout: "radio",
      },
      description: "Only Answered appears in the client-facing tab.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "answer",
      type: "array",
      of: [{ type: "block", styles: [{ title: "Normal", value: "normal" }], lists: [{ title: "Bullet", value: "bullet" }, { title: "Numbered", value: "number" }] }],
      description: "Written for the client, not for us. Say no plainly when the answer is no.",
      validation: (rule) =>
        rule.custom((value, ctx) => {
          const status = (ctx.document as { status?: string } | undefined)?.status;
          if (status === "answered" && (!value || value.length === 0)) {
            return "An answered query needs an answer. Leave it as New until there is one.";
          }
          return true;
        }),
    }),
    defineField({
      name: "clientAnswers",
      title: "What the client answered",
      type: "array",
      description: "Sent from their Help Centre link. Their words, not ours: read these, then write the public answer above. Sending an answer does not publish anything.",
      readOnly: true,
      of: [{
        type: "object",
        name: "clientAnswer",
        fields: [
          { name: "brand", type: "string" },
          { name: "answer", type: "text", rows: 3 },
          { name: "at", type: "datetime" },
        ],
        preview: {
          select: { title: "brand", subtitle: "answer" },
        },
      }],
    }),
    defineField({
      name: "topic",
      type: "string",
      options: { list: TOPICS },
      description: "Which part of the subscription setup this is about.",
    }),
    defineField({
      name: "raisedCount",
      title: "Clients that raised it",
      type: "number",
      initialValue: 1,
      description: "Bump this each time it comes up again. It orders the public list.",
      validation: (rule) => rule.min(1).integer(),
    }),
    defineField({
      name: "source",
      type: "string",
      initialValue: "team",
      options: {
        list: [
          { title: "Logged by the team", value: "team" },
          { title: "Raised by the client", value: "merchant" },
        ],
        layout: "radio",
      },
      readOnly: ({ document }) => document?.source === "merchant",
    }),
    defineField({
      name: "askedBy",
      title: "Who asked (internal only)",
      type: "string",
      description:
        "Never rendered on the merchant-facing tab. On a free Sanity plan the dataset is public-read, so treat anything typed here as published: no phone numbers, no email addresses, no order ids.",
    }),
    defineField({
      name: "store",
      type: "reference",
      to: [{ type: "store" }],
      description: "Which client raised it. Leave empty for a query that belongs on every store's page.",
    }),
    defineField({
      name: "raisedAt",
      type: "datetime",
      initialValue: () => new Date().toISOString(),
      validation: (rule) => rule.required(),
    }),
  ],
  orderings: [
    { title: "Needs an answer first", name: "todo", by: [{ field: "status", direction: "asc" }, { field: "raisedAt", direction: "desc" }] },
    { title: "Most raised", name: "raised", by: [{ field: "raisedCount", direction: "desc" }] },
  ],
  preview: {
    select: { title: "question", status: "status", count: "raisedCount", topic: "topic" },
    prepare({ title, status, count, topic }) {
      const t = TOPICS.find((x) => x.value === topic)?.title;
      const bits = [status === "answered" ? "Answered" : status === "parked" ? "Parked" : "Needs an answer"];
      if (count && count > 1) bits.push(`${count} clients`);
      if (t) bits.push(t);
      return { title, subtitle: bits.join(" · ") };
    },
  },
});
