/** The storefront widget's settings, as the app stores them. Shape taken from the settings
 *  explorer payload, so a JSON pasted out of there drops straight into the preview.
 *
 *  This is a preview of the SETTINGS, not a copy of the widget's production code. It exists
 *  so a client can see what a toggle does before we build, and so the person on the call can
 *  change one and point at the result. Where the real widget and this disagree, the real
 *  widget is right. */

export interface WidgetTheme {
  colors: { primary: string; subscriptionAccent: string; savings: string };
  surfaces: { widgetBackground: string; mutedSurface: string; inputBackground: string };
  borders: { default: string; strong: string };
  text: { primary: string; secondary: string; muted: string };
  shape: { radius: number };
  chrome: { borderVisible: boolean; borderColor: string; shadow: "none" | "subtle" | "strong" };
  components: {
    ctaButton: "solid" | "outline";
    discountBadge: "filled" | "outline";
    selectedCardState: "border-and-fill" | "border-only";
    tabStyle: "pill" | "underline";
  };
  typography: { fontScale: number };
}

export interface WidgetSettings {
  theme: WidgetTheme;
  hide_prepaid: boolean;
  hide_payg: boolean;
  /** The explorer calls this "pay per delivery", not AutoPay. Same field. */
  hide_auto_debit: boolean;
  /** `auto_debit` is OURS, not the product's: the stored enum is prepaid | pay_as_you_go.
   *  Asked for on 2026-09-17, so the field has to grow before this can be set on a store. */
  default_payment_mode: "prepaid" | "pay_as_you_go" | "auto_debit";
  default_intent: "auto" | "subscribe" | "bundle" | "onetime";
  hide_onetime_option: boolean;
  hide_intent_selector: boolean;
  tab_discount_format: "percentage" | "amount";
  /** Codebase enum plus "custom". "cadence" is "1 delivery every 2 weeks"; "custom" takes the
   *  line below and is ours, not the product's, same as `auto_debit` above. */
  schedule_text_format: "frequency-deliveries" | "cadence" | "none" | "custom";
  schedule_text_custom: string;
  card_shows_option_title: boolean;
  tag_shows_per_delivery_price: boolean;
  freebie_label_shows_value: boolean;
  use_compare_at_price_for_discount_label: boolean;
  hide_product_row: boolean;
  bundle_selector_tabs: boolean;
  group_bundle_variants: boolean;
  hide_price_decimals: boolean;
  /** Store currency, not cents. 0 hides it. Display only. */
  compare_at_shipping_price: number;
  summary_expanded_by_default: boolean;
  hide_free_shipping_line: boolean;
  direct_checkout: boolean;
  promo_line: string;
  hide_branding: boolean;
  /** For a store already running a sitewide sale. */
  tab_badge_shows_plan_discount: boolean;
}

export const DEFAULT_WIDGET: WidgetSettings = {
  theme: {
    colors: { primary: "#0f172a", subscriptionAccent: "#7c3aed", savings: "#16a34a" },
    surfaces: { widgetBackground: "#ffffff", mutedSurface: "#f8fafc", inputBackground: "#ffffff" },
    borders: { default: "#e2e8f0", strong: "#0f172a" },
    text: { primary: "#0f172a", secondary: "#64748b", muted: "#94a3b8" },
    shape: { radius: 12 },
    chrome: { borderVisible: true, borderColor: "#e2e8f0", shadow: "subtle" },
    components: { ctaButton: "solid", discountBadge: "filled", selectedCardState: "border-and-fill", tabStyle: "pill" },
    typography: { fontScale: 100 },
  },
  hide_prepaid: false,
  hide_payg: false,
  hide_auto_debit: false,
  default_payment_mode: "prepaid",
  default_intent: "auto",
  hide_onetime_option: false,
  hide_intent_selector: false,
  tab_discount_format: "percentage",
  schedule_text_format: "cadence",
  schedule_text_custom: "",
  card_shows_option_title: false,
  tag_shows_per_delivery_price: false,
  freebie_label_shows_value: false,
  use_compare_at_price_for_discount_label: false,
  hide_product_row: false,
  bundle_selector_tabs: false,
  group_bundle_variants: false,
  hide_price_decimals: true,
  compare_at_shipping_price: 0,
  summary_expanded_by_default: false,
  hide_free_shipping_line: true,
  direct_checkout: true,
  promo_line: "",
  hide_branding: false,
  tab_badge_shows_plan_discount: false,
};

/** Deep-merges a pasted settings blob over the defaults, so a partial paste still renders.
 *  Anything unparseable falls back silently: this is a preview, and a client should not meet
 *  a stack trace because somebody pasted half an object. */
export function parseSettings(raw: string | null | undefined): WidgetSettings {
  if (!raw) return DEFAULT_WIDGET;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const body = (parsed.widget_settings ?? parsed) as Partial<WidgetSettings>;
    return {
      ...DEFAULT_WIDGET, ...body,
      theme: {
        ...DEFAULT_WIDGET.theme, ...(body.theme || {}),
        colors: { ...DEFAULT_WIDGET.theme.colors, ...(body.theme?.colors || {}) },
        surfaces: { ...DEFAULT_WIDGET.theme.surfaces, ...(body.theme?.surfaces || {}) },
        borders: { ...DEFAULT_WIDGET.theme.borders, ...(body.theme?.borders || {}) },
        text: { ...DEFAULT_WIDGET.theme.text, ...(body.theme?.text || {}) },
        shape: { ...DEFAULT_WIDGET.theme.shape, ...(body.theme?.shape || {}) },
        chrome: { ...DEFAULT_WIDGET.theme.chrome, ...(body.theme?.chrome || {}) },
        components: { ...DEFAULT_WIDGET.theme.components, ...(body.theme?.components || {}) },
        typography: { ...DEFAULT_WIDGET.theme.typography, ...(body.theme?.typography || {}) },
      },
    };
  } catch { return DEFAULT_WIDGET; }
}

/** Every widget setting the Purchase Options block reads, all twenty-four, lifted from
 *  `app/constants/widget-templates.ts` and the Widget Settings section of
 *  `app/constants/portal-templates.ts` in stackback-prepaid-main. Titles, enums and defaults
 *  are the codebase's, and the help text is its description shortened, never invented.
 *
 *  Portal-only settings (announcement bar, login, navigation, banners, fonts, brand colours)
 *  are not here: they belong to the customer portal, not to this block, and they are set from
 *  the store's brand rather than chosen on a call.
 *
 *  Ordering is by what a merchant decides first, not by which file the setting lives in:
 *  what can be bought, how it is paid for, then how the cards, prices and footer read.
 *
 *  `touches` names the preview element a setting changes, so hovering a row highlights it.
 */
export interface ToggleDef {
  key: keyof WidgetSettings;
  label: string;
  path: string;
  help: string;
  touches: string;
  /** Absent for a plain boolean. */
  kind?: "select" | "text" | "number" | "checks" | "matrix";
  options?: { value: string; label: string }[];
  /** kind "checks": several switches that answer ONE question, on one row under one
   *  explanation. Three rows each saying "ignored when it is the only mode offered" is
   *  three readings of the same sentence. */
  checks?: { key: keyof WidgetSettings; path: string; label: string; invert?: boolean }[];
  /** kind "matrix": one dropdown over the real combinations of two fields, labelled with
   *  what the customer actually reads. A format select plus a wording checkbox is a 2x2 the
   *  merchant has to hold in their head; the four strings are the thing being chosen. */
  matrix?: { value: string; label: string; set: Partial<WidgetSettings> }[];
  /** The stored field is a `hide_*`, so the row is checked when the field is false. Ten of
   *  the twenty-four settings are phrased as a removal, which is why half of this screen used
   *  to read as a list of things to switch off. The field name stays visible under each row,
   *  because that is what we set on the store. */
  invert?: boolean;
  /** Shown when the setting is real but this preview cannot draw it. */
  note?: string;
  /** A plan entitlement rather than a preference: the row is locked below this scale band. */
  gatedFromScale?: string;
  /** Only rendered while another setting holds a given value. */
  showWhen?: { key: keyof WidgetSettings; is: string };
}

/** Whether the row's checkbox is ticked, which is not the stored value for an inverted one. */
export function toggleOn(s: WidgetSettings, d: ToggleDef): boolean {
  return d.invert ? !s[d.key] : Boolean(s[d.key]);
}

export function setToggle(s: WidgetSettings, d: ToggleDef, on: boolean): WidgetSettings {
  return { ...s, [d.key]: d.invert ? !on : on };
}

/** The settings stored as a removal. Named so the screen can say so once instead of per row,
 *  and so the list is checkable against the product if these are ever renamed. */
export const INVERTED_FIELDS = [
  "hide_prepaid", "hide_payg", "hide_auto_debit", "hide_onetime_option", "hide_intent_selector",
  "hide_product_row", "hide_price_decimals", "hide_free_shipping_line", "hide_branding",
] as const;

export interface ToggleGroup {
  title: string;
  source: string;
  items: ToggleDef[];
}

export const TOGGLE_GROUPS: ToggleGroup[] = [
  {
    title: "What can be bought",
    source: "portal-templates.ts",
    items: [
      { key: "default_intent", label: "Opens on", path: "default_intent", touches: "tabs", kind: "select",
        options: [
          { value: "auto", label: "Auto: first mode offered" }, { value: "subscribe", label: "Subscribe & Save" },
          { value: "bundle", label: "Bundle & Save" }, { value: "onetime", label: "One-time" },
        ],
        help: "Which tab is pre-selected when the widget loads. Auto takes subscribe, then bundle, then one-time. A mode the product does not offer falls back to auto." },
      { key: "hide_intent_selector", label: "Tabs the customer sees", path: "hide_intent_selector", touches: "tabs", kind: "checks",
        checks: [
          { key: "hide_intent_selector", path: "hide_intent_selector", label: "The tab bar itself", invert: true },
          { key: "hide_onetime_option", path: "hide_onetime_option", label: "One-time", invert: true },
        ],
        help: "Without the bar the customer sees only the mode above and cannot switch. Without One-time the product is subscription-only, and that is ignored when one-time is the only mode there is, so it can never become unbuyable." },
    ],
  },
  {
    title: "How it is paid for",
    source: "widget-templates.ts",
    items: [
      { key: "hide_prepaid", label: "Methods on the widget", path: "hide_prepaid", touches: "mode-prepaid", kind: "checks",
        checks: [
          { key: "hide_prepaid", path: "hide_prepaid", label: "Prepaid", invert: true },
          { key: "hide_payg", path: "hide_payg", label: "Pay as you go", invert: true },
          { key: "hide_auto_debit", path: "hide_auto_debit", label: "Pay per delivery (AutoPay)", invert: true },
        ],
        help: "Prepaid is paid in full at checkout, pay as you go sends a link before every delivery, pay per delivery charges automatically. Each is ignored for a plan whose every schedule is that one mode, and AutoPay is already hidden on its own when Razorpay is not connected. These come from the payment types you picked in step one; a change here is a preview override." },
      { key: "default_payment_mode", label: "Preselected when several are offered", path: "default_payment_mode", touches: "mode-prepaid", kind: "select",
        options: [
          { value: "prepaid", label: "Prepaid" },
          { value: "pay_as_you_go", label: "Pay as you go" },
          { value: "auto_debit", label: "Pay per delivery (AutoPay)" },
        ],
        help: "Falls back to whichever mode is actually offered.",
        note: "AutoPay is not in the stored enum yet: the field takes prepaid or pay_as_you_go, so this needs a product change before we can set it on a store." },
    ],
  },
  {
    title: "The plan cards",
    source: "widget-templates.ts / portal-templates.ts",
    items: [
      { key: "schedule_text_format", label: "Second line on a card", path: "schedule_text_format", touches: "plan-card", kind: "select",
        options: [
          { value: "frequency-deliveries", label: "Every 2 weeks \u00b7 6 deliveries" },
          { value: "cadence", label: "1 delivery every 2 weeks" },
          { value: "none", label: "No second line" },
          { value: "custom", label: "Something you write" },
        ],
        help: "Build-your-own cards ignore cadence, but none hides their line too.",
        note: "Your own line is not in the stored enum yet, so it needs a product change before we can set it on a store." },
      { key: "schedule_text_custom", label: "Your second line", path: "schedule_text_custom", touches: "plan-card", kind: "text",
        showWhen: { key: "schedule_text_format", is: "custom" },
        help: "The same line on every card. Leave it empty and the card falls back to the cadence." },
      { key: "card_shows_option_title", label: "Use the option title as the plan name", path: "card_shows_option_title", touches: "plan-card",
        help: "Worth it when your plan names mean something to the customer." },
      { key: "tag_shows_per_delivery_price", label: "Show the per-delivery price on the tag", path: "tag_shows_per_delivery_price", touches: "plan-card",
        help: "Replaces your tag label with that option's discounted per-delivery price, on every subscription option including untagged ones. Bundle cards are unaffected." },
      { key: "freebie_label_shows_value", label: "Advertise freebies by value, not count", path: "freebie_label_shows_value", touches: "plan-card",
        help: "Worth \u20b91,200 rather than 3 free gifts, summed across every delivery. Falls back to the count when a gift price cannot be read." },
    ],
  },
  {
    title: "Prices and discounts",
    source: "widget-templates.ts / portal-templates.ts",
    items: [
      { key: "tab_discount_format", label: "The badge on the Subscribe tab reads", path: "tab_discount_format / tab_badge_shows_plan_discount",
        touches: "tabs", kind: "matrix",
        matrix: [
          { value: "up-pct", label: "Up to 20% off", set: { tab_discount_format: "percentage", tab_badge_shows_plan_discount: false } },
          { value: "up-amt", label: "Up to \u20b9200 off", set: { tab_discount_format: "amount", tab_badge_shows_plan_discount: false } },
          { value: "extra-pct", label: "Extra 20% off", set: { tab_discount_format: "percentage", tab_badge_shows_plan_discount: true } },
          { value: "extra-amt", label: "Extra \u20b9200 off", set: { tab_discount_format: "amount", tab_badge_shows_plan_discount: true } },
        ],
        help: "Extra is for a store already running a sitewide sale, so the subscription saving reads as on top of it. Only this badge changes; the cards keep their own basis. Bundle amounts follow the current selection, and before anything is picked the percentage shows." },
      { key: "use_compare_at_price_for_discount_label", label: "Calculate savings off the compare-at price", path: "use_compare_at_price_for_discount_label", touches: "price",
        help: "Widens the displayed saving. Single-product subscriptions only, and it falls back to the selling price when compare-at is missing or lower." },
      { key: "hide_price_decimals", label: "Show price decimals", path: "hide_price_decimals", touches: "price", invert: true,
        help: "Off truncates rather than rounds, so 1,399.99 shows as 1,399. Leave decimals on unless your prices are whole numbers." },
      { key: "summary_expanded_by_default", label: "Open the price breakdown by default", path: "summary_expanded_by_default", touches: "summary",
        help: "Shows the full breakdown without a click." },
    ],
  },
  {
    title: "Product row, shipping and bundles",
    source: "widget-templates.ts / portal-templates.ts",
    items: [
      { key: "hide_product_row", label: "Show the product row", path: "hide_product_row", touches: "product-row", invert: true,
        help: "The image, title and quantity selector. Off fixes quantity at 1." },
      { key: "hide_free_shipping_line", label: "Say so when shipping is free", path: "hide_free_shipping_line", touches: "shipping-line", invert: true,
        help: "Turn off if free shipping is already said elsewhere on the page. A plan whose shipping actually costs something still shows its line either way." },
      { key: "compare_at_shipping_price", label: "Compare-at shipping price", path: "compare_at_shipping_price", touches: "shipping-line", kind: "number",
        help: "What shipping would normally cost, struck through beside what you charge. Store currency, not cents. Display only, and 0 hides it.",
        note: "Only renders where shipping is charged. Your plans are free-shipping, so the preview will not show it." },
      { key: "bundle_selector_tabs", label: "Bundles", path: "bundle_selector_tabs", touches: "tab-bundle", kind: "checks",
        checks: [
          { key: "bundle_selector_tabs", path: "bundle_selector_tabs", label: "Show the bundle choice as tabs, not a dropdown" },
          { key: "group_bundle_variants", path: "group_bundle_variants", label: "Group products by variant" },
        ],
        help: "Tabs apply when a variant belongs to several bundles of the same type. Grouping combines variants of one product into a single row with a variant picker.",
        note: "Mix & match bundles only, which this preview does not draw." },
    ],
  },
  {
    title: "Checkout and footer",
    source: "portal-templates.ts / widget-templates.ts",
    items: [
      { key: "direct_checkout", label: "Skip the cart and go straight to Shopify checkout", path: "direct_checkout", touches: "cta",
        help: "Theme block only. Fewer steps, and no chance to add anything else. Portal drawers and edit flows are unaffected." },
      { key: "promo_line", label: "Promo line", path: "promo_line", touches: "promo", kind: "text",
        help: "One line above the button. Start it with an emoji if you want an icon. Empty means it does not render." },
      { key: "hide_branding", label: 'Show "Powered by StackBack"', path: "hide_branding", touches: "branding", invert: true,
        gatedFromScale: "large",
        help: "Off removes the credit. If the cancellation policy link is hidden too, the whole footer row goes with it.",
        note: "Removing it is a plan entitlement, so it is only available from 5,000 orders a month up." },
    ],
  },
];

export const ALL_TOGGLES = TOGGLE_GROUPS.flatMap((g) => g.items);

/** Settings, not rows. Four rows carry more than one switch, and a group header that counted
 *  rows would say four where the store has six fields set. */
export const settingCount = (g: ToggleGroup) =>
  g.items.reduce((n, d) => n + (d.kind === "checks" ? (d.checks?.length ?? 1) : d.kind === "matrix" ? Object.keys(d.matrix?.[0]?.set || {}).length : 1), 0);

/** Which option of a matrix row the settings currently sit on. */
export function matrixValue(s: WidgetSettings, d: ToggleDef): string {
  const hit = d.matrix?.find((o) => Object.entries(o.set).every(([k, v]) => s[k as keyof WidgetSettings] === v));
  return hit?.value ?? d.matrix?.[0]?.value ?? "";
}

export function applyMatrix(s: WidgetSettings, d: ToggleDef, value: string): WidgetSettings {
  const hit = d.matrix?.find((o) => o.value === value);
  return hit ? { ...s, ...hit.set } : s;
}

/** One row per stored field, for the exported sheet. A screen can put three switches on a
 *  line because they are one question; a document that lists what we set on the store cannot,
 *  or the reader has to work out which of the three a value belongs to. */
export const EXPORT_ROWS: ToggleDef[] = ALL_TOGGLES.flatMap((d): ToggleDef[] =>
  d.kind === "checks"
    ? (d.checks || []).map((c) => ({
        ...d, kind: undefined, checks: undefined,
        key: c.key, path: c.path, label: `${d.label}: ${c.label}`, invert: c.invert,
      }))
    : [d]);
