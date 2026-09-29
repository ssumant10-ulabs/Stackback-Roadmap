import type { WidgetSettings, WidgetTheme } from "./widget";

/** Write the preview's theme out in the token format we already hand to dev.
 *
 *  The six flat brand tokens the extractor returns are a READING of a storefront. They are not
 *  what the widget consumes: the widget takes the nested theme below, which is why a flat
 *  palette cannot be pasted into it and why the handover has always been this shape. So the
 *  reading fills the preview, and the preview writes this file. One direction, no translation
 *  layer for anyone to get wrong.
 *
 *  Format follows `Project Deliverables/stackback/Operations/TBW_StackBack_Tokens.md`, which is
 *  the file dev has been implementing from since May. */
export function tokensText(s: WidgetSettings, opts: {
  store?: string | null;
  source?: string | null;
  font?: string | null;
  notes?: string[];
}): string {
  const t: WidgetTheme = s.theme;
  const L: string[] = [];
  const line = (k: string, v: string | number, why?: string) =>
    L.push(`- ${k}: \`${v}\`${why ? ` — ${why}` : ""}`);

  L.push(`# StackBack Color & Font Tokens${opts.store ? ` — ${opts.store}` : ""}`);
  L.push(`generated: ${new Date().toISOString().slice(0, 10)}`);
  L.push(`source: ${opts.source || "set by hand in the Help Centre preview"}`);
  L.push("method: read from the store's own theme settings, then adjusted in the preview");
  L.push("");
  L.push("---");
  L.push("");
  L.push(`## Widget Settings${opts.store ? ` — ${opts.store}` : ""}`);
  L.push("");

  L.push("### Text Colors");
  line("Primary Text", t.text.primary);
  line("Secondary Text", t.text.secondary);
  line("Muted Text", t.text.muted);
  L.push("");

  L.push("### Shape");
  line("Corner Radius", t.shape.radius, "container and plan cards");
  line("Button Radius", t.shape.buttonRadius, "the subscribe button only");
  L.push("");

  L.push("### Widget Chrome");
  line("Shadow", t.chrome.shadow);
  line("Border Color", t.chrome.borderColor);
  line("Show Outer Border", String(t.chrome.borderVisible));
  L.push("");

  L.push("### Brand Colors");
  line("Primary", t.colors.primary);
  line("Subscription Accent", t.colors.subscriptionAccent);
  line("Savings Color", t.colors.savings);
  L.push("");

  L.push("### Borders");
  line("Default Border", t.borders.default);
  line("Selected Border", t.borders.strong);
  L.push("");

  L.push("### Surfaces");
  line("Widget Background", t.surfaces.widgetBackground);
  line("Muted Surface", t.surfaces.mutedSurface);
  line("Input Background", t.surfaces.inputBackground);
  L.push("");

  L.push("### Component Styles");
  line("Tab Style", t.components.tabStyle);
  line("CTA Button Style", t.components.ctaButton);
  line("Discount Badge Style", t.components.discountBadge);
  line("Selected Card State", t.components.selectedCardState);
  line("Font Scale", `${t.typography.fontScale}%`);
  if (opts.font) line("Body Font", opts.font, "read from the theme; the widget inherits the page font");
  L.push("");

  L.push("### Purchase Options");
  line("Default purchase mode", s.default_intent);
  line("Preselected payment mode", s.default_payment_mode);
  line("Schedule text format", s.schedule_text_format);
  if (s.schedule_text_format === "custom") line("Custom second line", s.schedule_text_custom || "(empty)");
  line("Tab discount format", s.tab_discount_format);
  line("Payment modes offered", [
    !s.hide_prepaid && "prepaid",
    !s.hide_payg && "pay as you go",
    !s.hide_auto_debit && "pay per delivery",
  ].filter(Boolean).join(", ") || "none");
  L.push("");

  if (opts.notes?.length) {
    L.push("### Notes from the read");
    for (const n of opts.notes) L.push(`- ${n}`);
    L.push("");
  }

  L.push("---");
  L.push("");
  L.push("Every value above is what the widget consumes directly. The six-token brand palette the");
  L.push("reader shows on screen is a reading of the storefront, not a widget input: it fills these");
  L.push("fields and is then thrown away.");
  return L.join("\n");
}

/** Save it as a file, named after the store. */
export function downloadTokens(text: string, store?: string | null) {
  const slug = String(store || "store").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "store";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = `stackback-tokens-${slug}-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
