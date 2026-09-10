import { defineField, defineType } from "sanity";
import { HelpCircleIcon } from "@sanity/icons/HelpCircle";

/** The topics a query can be filed under. Same ids as the Help Centre corpus, so an answered
 *  query can sit beside the FAQs it relates to rather than in a list of its own. */
const TOPICS = [
  { title: "Start here", value: "start" },
  { title: "How it works", value: "flows" },
  { title: "Using the app", value: "admin" },
  { title: "Access and install", value: "access" },
  { title: "Plans and pricing", value: "plans" },
  { title: "Bundles", value: "bundles" },
  { title: "Widget and theme", value: "widget" },
  { title: "Payments and checkout", value: "pay" },
  { title: "Orders and fulfilment", value: "orders" },
  { title: "Customer portal", value: "portal" },
  { title: "Cancellations", value: "cancel" },
  { title: "Notifications", value: "notify" },
  { title: "Shipping", value: "ship" },
  { title: "Inventory", value: "stock" },
  { title: "Integrations", value: "integ" },
  { title: "Reporting", value: "report" },
  { title: "App plans and billing", value: "bill" },
];

export const merchantQuery = defineType({
  name: "merchantQuery",
  title: "Merchant query",
  type: "document",
  icon: HelpCircleIcon,
  fields: [
    defineField({
      name: "question",
      title: "The question, in the words it was asked",
      type: "text",
      rows: 2,
      description:
        "Keep the merchant's phrasing. Search matches what people type, and rewriting it into our vocabulary is how a question stops being findable.",
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
      description: "Only Answered appears in the merchant-facing tab.",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "answer",
      type: "array",
      of: [{ type: "block", styles: [{ title: "Normal", value: "normal" }], lists: [{ title: "Bullet", value: "bullet" }, { title: "Numbered", value: "number" }] }],
      description: "Written for the merchant, not for us. Say no plainly when the answer is no.",
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
      name: "topic",
      type: "string",
      options: { list: TOPICS },
      description: "Files the answer beside the FAQs it belongs with.",
    }),
    defineField({
      name: "raisedCount",
      title: "Stores that raised it",
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
          { title: "Submitted by a merchant", value: "merchant" },
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
      if (count && count > 1) bits.push(`${count} stores`);
      if (t) bits.push(t);
      return { title, subtitle: bits.join(" · ") };
    },
  },
});
