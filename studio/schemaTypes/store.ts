import { defineArrayMember, defineField, defineType } from "sanity";
import { StoreIcon } from "@sanity/icons/Store";

/** One merchant. The slug is the link we send them, so it is random rather than their name:
 *  on a free Sanity plan the dataset is public-read, and a guessable slug plus a leaked
 *  project id would be two stores' recommendations away from each other. */
export const store = defineType({
  name: "store",
  title: "Store",
  type: "document",
  icon: StoreIcon,
  groups: [
    { name: "brief", title: "Client brief", default: true },
    { name: "plans", title: "Recommended plans" },
    { name: "widget", title: "Widget" },
    { name: "internal", title: "Internal" },
  ],
  fields: [
    defineField({ name: "name", type: "string", group: "brief", validation: (r) => r.required() }),
    defineField({
      name: "slug", type: "slug", group: "brief",
      description: "The link the client opens. Generate it, do not type their name: this is the only thing standing between two clients' recommendations.",
      options: {
        source: () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 8),
        slugify: (input) => input.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24),
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "stage", type: "string", group: "brief", initialValue: "access",
      options: {
        list: [
          { title: "Access", value: "access" },
          { title: "Data and plan queries", value: "data" },
          { title: "Build", value: "build" },
          { title: "Review", value: "review" },
          { title: "Live", value: "live" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "intro", type: "text", rows: 3, group: "brief",
      description: "One paragraph the client reads first. What we found in their data, in their words.",
    }),

    defineField({
      name: "recommendations", title: "Recommended plans", type: "array", group: "plans",
      description: "What we propose, and why. This is what the walkthrough call is built on.",
      of: [defineArrayMember({
        type: "object",
        name: "planRec",
        fields: [
          defineField({ name: "label", type: "string", description: "How we refer to it on the call, e.g. Monthly coffee run.", validation: (r) => r.required() }),
          defineField({
            name: "scope", type: "string", initialValue: "products",
            options: { list: [
              { title: "Named products", value: "products" },
              { title: "A collection", value: "collection" },
              { title: "All products", value: "all" },
            ], layout: "radio" },
          }),
          defineField({ name: "scopeDetail", title: "Which ones", type: "string", description: "The product or collection names, as the client would recognise them." }),
          defineField({ name: "everyDays", title: "Delivery frequency, in days", type: "number", initialValue: 30, validation: (r) => r.min(1) }),
          defineField({ name: "deliveries", title: "Deliveries in the run", type: "number", initialValue: 6, validation: (r) => r.min(1) }),
          defineField({ name: "discountPct", title: "Discount %", type: "number", initialValue: 10, validation: (r) => r.min(0).max(90) }),
          defineField({ name: "unitPrice", title: "One-time price of one delivery", type: "number", description: "Used to show the client the maths, and to seed the simulator." }),
          defineField({
            name: "mode", title: "Payment", type: "string", initialValue: "prepaid",
            options: { list: [
              { title: "Prepaid, paid upfront", value: "prepaid" },
              { title: "Pay as you go", value: "payg" },
              { title: "UPI AutoPay", value: "autopay" },
            ], layout: "radio" },
          }),
          defineField({ name: "rationale", type: "text", rows: 2, description: "Why this, from their data. The repeat gap it came from, the margin it respects." }),
        ],
        preview: {
          select: { title: "label", every: "everyDays", d: "deliveries", pct: "discountPct" },
          prepare: ({ title, every, d, pct }) => ({ title, subtitle: `every ${every} days, ${d} deliveries, ${pct}% off` }),
        },
      })],
    }),

    defineField({
      name: "widgetSettings", title: "Widget settings", type: "text", rows: 10, group: "widget",
      description: "The settings JSON for this store's widget. Paste it from the settings explorer. Invalid JSON is ignored and the preview falls back to the defaults.",
    }),

    defineField({
      name: "progress", title: "Onboarding progress", type: "array", group: "internal",
      description: "Ticked from the Internal tab. The step list itself lives in the code, so every store is measured against the same spine.",
      of: [defineArrayMember({
        type: "object", name: "stepState",
        fields: [
          defineField({ name: "step", type: "string" }),
          defineField({ name: "done", type: "boolean", initialValue: false }),
          defineField({ name: "at", type: "datetime" }),
          defineField({ name: "by", type: "string" }),
          defineField({ name: "note", type: "text", rows: 2 }),
        ],
        preview: { select: { title: "step", done: "done" }, prepare: ({ title, done }) => ({ title, subtitle: done ? "done" : "open" }) },
      })],
    }),
    defineField({
      name: "internalNotes", type: "text", rows: 4, group: "internal",
      description: "Never rendered on any client-facing view. On a free plan the dataset is still public-read, so keep contact details and anything commercially sensitive out of it.",
    }),
  ],
  preview: {
    select: { title: "name", stage: "stage", recs: "recommendations" },
    prepare: ({ title, stage, recs }) => ({
      title,
      subtitle: `${stage || "access"} · ${(recs || []).length} plan${(recs || []).length === 1 ? "" : "s"} proposed`,
    }),
  },
});
