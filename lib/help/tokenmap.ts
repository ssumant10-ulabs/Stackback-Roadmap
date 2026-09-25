/** The live widget's token set, named the way `stackback-color-tokens` names it.
 *
 *  The brand reader answers six flat questions, which is the shape the NEW subscription
 *  widgets take. The widget on every pilot store today is the older nested one, and its
 *  token set is nineteen fields plus the portal's five and two fonts. Showing six of those
 *  and calling it the tokens is why the panel kept reading as wrong: the numbers were not
 *  incorrect so much as most of them were missing.
 *
 *  So this maps whatever the preview is currently themed with onto the skill's own sections
 *  and its own field names, in its order, and the panel shows all of them. When the token
 *  system moves to the flat schema this file is what changes, and nothing else. */
import type { WidgetTheme } from "./widget";

export interface TokenRow {
  /** The skill's field name, exactly. A merchant reads these beside the app's own labels. */
  label: string;
  value: string;
  /** Where it came from, in the merchant's words. Empty when it is simply what is set. */
  note?: string;
  /** The skill's three: a direct sample, a derivation, or a value another token dictates. */
  how?: "direct" | "derived" | "logic";
  /** Renders as a colour swatch rather than as text. */
  swatch?: boolean;
}

export interface TokenSection { title: string; rows: TokenRow[] }

/** Which of the six the reader actually sampled, by the flat key it reports. */
export type ReadSources = Partial<Record<string, { source: string; confidence: "theme" | "derived" | "guessed" }>>;

const HOW: Record<string, TokenRow["how"]> = { theme: "direct", derived: "derived", guessed: "derived" };

export function canonicalTokens(t: WidgetTheme, read?: ReadSources, fontBody?: string | null): TokenSection[] {
  /** A row whose value the brand reader supplied carries the reader's own words for where it
   *  came from; everything else is what the theme is set to, said plainly. */
  const from = (key: string, fallback: string, how: TokenRow["how"] = "logic"): Pick<TokenRow, "note" | "how"> => {
    const r = read?.[key];
    return r ? { note: r.source, how: HOW[r.confidence] } : { note: fallback, how };
  };

  return [
    {
      title: "Text colours",
      rows: [
        { label: "Primary Text", value: t.text.primary, swatch: true, ...from("Product_Tile", "the widget's body and heading ink", "direct") },
        { label: "Secondary Text", value: t.text.secondary, swatch: true, note: "Primary mixed toward the background", how: "derived" },
        { label: "Muted Text", value: t.text.muted, swatch: true, note: "Primary mixed further toward the background", how: "derived" },
      ],
    },
    {
      title: "Brand colours",
      rows: [
        { label: "Primary", value: t.colors.primary, swatch: true, ...from("Brand_Primary", "the subscribe button fill", "direct") },
        { label: "Subscription Accent", value: t.colors.subscriptionAccent, swatch: true, ...from("Brand_Accent", "the savings and offer highlight", "direct") },
        { label: "Savings Color", value: t.colors.savings, swatch: true, note: "What a discount is printed in", how: "direct" },
      ],
    },
    {
      title: "Surfaces",
      rows: [
        { label: "Widget Background", value: t.surfaces.widgetBackground, swatch: true, ...from("Widget_Background", "the widget's own ground", "direct") },
        { label: "Muted Surface", value: t.surfaces.mutedSurface, swatch: true, ...from("Brand_Secondary", "an unselected tab and a tinted section", "direct") },
        { label: "Input Background", value: t.surfaces.inputBackground, swatch: true, ...from("Product_Tile_Background", "the quantity field and the product tile", "direct") },
      ],
    },
    {
      title: "Borders",
      rows: [
        { label: "Default Border", value: t.borders.default, swatch: true, note: "The tint stepped toward the text colour", how: "derived" },
        { label: "Selected Border", value: t.borders.strong, swatch: true, note: "Mirrors Primary", how: "logic" },
      ],
    },
    {
      title: "Shape",
      rows: [
        { label: "Corner Radius", value: `${t.shape.radius}px`, note: "The container and the plan cards", how: "direct" },
        { label: "Button Radius", value: t.shape.buttonRadius >= 999 ? "pill" : `${t.shape.buttonRadius}px`,
          note: "The subscribe button, which is a different number on most themes", how: "direct" },
      ],
    },
    {
      title: "Widget chrome",
      rows: [
        { label: "Show Outer Border", value: t.chrome.borderVisible ? "true" : "false" },
        { label: "Border Color", value: t.chrome.borderColor, swatch: true, note: "The outer border, when it is shown" },
        { label: "Shadow", value: t.chrome.shadow },
      ],
    },
    {
      title: "Component styles",
      rows: [
        { label: "Tab Style", value: t.components.tabStyle },
        { label: "CTA Button Style", value: t.components.ctaButton },
        { label: "Discount Badge Style", value: t.components.discountBadge },
        { label: "Selected Card State", value: t.components.selectedCardState },
      ],
    },
    {
      title: "Customer portal",
      rows: [
        /* The skill is explicit: the portal's primary MIRRORS the widget's, and a decorative
           colour from the page does not get to win it because it is prominent. */
        { label: "Primary Brand Color", value: t.colors.primary, swatch: true, note: "Mirrors the widget's Primary; the portal must not be a different brand", how: "logic" },
        { label: "Primary Button Color", value: t.colors.primary, swatch: true, note: "Same as Primary Brand", how: "logic" },
        { label: "Primary Button Text Color", value: onColour(t.colors.primary), swatch: true,
          note: "Dark ink on a light primary, never white on light", how: "derived" },
        { label: "Announcement Bar Background", value: t.colors.subscriptionAccent, swatch: true, note: "Falls back to the accent when the site has no bar", how: "logic" },
        { label: "Announcement Bar Text Color", value: onColour(t.colors.subscriptionAccent), swatch: true, how: "derived" },
      ],
    },
    {
      title: "Fonts",
      rows: [
        { label: "Body Font", value: matchFont(fontBody), note: fontBody ? `Read as ${fontBody}` : "No font read; Inter is the default", how: fontBody ? "direct" : "logic" },
        { label: "Header Font", value: matchFont(fontBody), note: "Matched to the body font unless the site sets a second one", how: "logic" },
      ],
    },
  ];
}

/** The seven the app offers. Anything else is matched to the nearest of them rather than
 *  reported as a font the merchant cannot pick. */
const FONTS = ["Inter", "Kumbh Sans", "Roboto", "Poppins", "Open Sans", "Lato", "Montserrat"];
const FONT_NEAR: [RegExp, string][] = [
  [/poppins|urbanist|figtree|outfit/i, "Poppins"],
  [/roboto|arial|helvetica|noto sans/i, "Roboto"],
  [/lato|nunito|source sans/i, "Lato"],
  [/montserrat|raleway|gilroy|futura/i, "Montserrat"],
  [/open sans|pt sans|work sans/i, "Open Sans"],
  [/kumbh/i, "Kumbh Sans"],
];

export function matchFont(name: string | null | undefined): string {
  const n = (name || "").trim();
  if (!n) return "Inter";
  const exact = FONTS.find((f) => f.toLowerCase() === n.toLowerCase());
  if (exact) return exact;
  for (const [re, to] of FONT_NEAR) if (re.test(n)) return to;
  return "Inter";
}

/** Text that will actually read on a fill. The skill's own contrast check: never white on a
 *  light primary, which is the one mistake it tells you to raise as a flag. */
export function onColour(hex: string): string {
  const h = (hex || "").replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  if (!Number.isFinite(n) || f.length !== 6) return "#ffffff";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#1a1a1a" : "#ffffff";
}

/** The whole set as the plain `field: value` block the skill asks every derivation to end
 *  with, so it can be pasted into the app without reading a table. */
export function tokenPasteBlock(sections: TokenSection[]): string {
  return sections
    .map((s) => `# ${s.title}\n` + s.rows.map((r) => `${r.label}: ${r.value}`).join("\n"))
    .join("\n\n");
}
