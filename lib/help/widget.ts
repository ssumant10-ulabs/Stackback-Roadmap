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
  /** The codebase offers only these two. */
  default_payment_mode: "prepaid" | "pay_as_you_go";
  default_intent: "auto" | "subscribe" | "bundle" | "onetime";
  hide_onetime_option: boolean;
  hide_intent_selector: boolean;
  tab_discount_format: "percentage" | "amount";
  /** Codebase enum. "cadence" is "1 delivery every 2 weeks". */
  schedule_text_format: "frequency-deliveries" | "cadence" | "none";
  card_shows_option_title: boolean;
  tag_shows_per_delivery_price: boolean;
  freebie_label_shows_value: boolean;
  use_compare_at_price_for_discount_label: boolean;
  hide_product_row: boolean;
  bundle_selector_tabs: boolean;
  group_bundle_variants: boolean;
  hide_price_decimals: boolean;
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
  schedule_text_format: "frequency-deliveries",
  card_shows_option_title: false,
  tag_shows_per_delivery_price: false,
  freebie_label_shows_value: false,
  use_compare_at_price_for_discount_label: false,
  hide_product_row: false,
  bundle_selector_tabs: false,
  group_bundle_variants: false,
  hide_price_decimals: false,
  summary_expanded_by_default: false,
  hide_free_shipping_line: false,
  direct_checkout: false,
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

/** The toggles worth putting in front of a client on a call. The full settings object has
 *  more, but most of it is either a colour or a thing nobody changes, and a wall of 24
 *  switches is how a call stops being about the plans. */
/** Every widget setting the Purchase Options block actually reads, lifted from
 *  app/constants/widget-templates.ts and portal-templates.ts in stackback-prepaid-main.
 *  Titles, enums and defaults are the codebase's, not paraphrases of them.
 *
 *  Portal-only settings (announcement bar, login, banners, fonts, brand colours) are
 *  deliberately absent: they are configured from the store's brand, not chosen on this call.
 *
 *  The three hide-payment-mode switches and hide_branding are absent too, by request: what a
 *  store accepts is answered in step one, and branding is not a client decision.
 *
 *  `touches` names the preview element a setting changes, so hovering a row highlights it. */
export interface ToggleDef {
  key: keyof WidgetSettings;
  label: string;
  path: string;
  help: string;
  touches: string;
  /** Absent for a boolean. */
  kind?: "select" | "text";
  options?: { value: string; label: string }[];
}

export interface ToggleGroup {
  title: string;
  source: string;
  items: ToggleDef[];
}

export const TOGGLE_GROUPS: ToggleGroup[] = [
  {
    title: "Tabs and defaults",
    source: "app/constants/portal-templates.ts",
    items: [
      { key: "default_intent", label: "Default purchase mode", path: "default_intent", touches: "tabs", kind: "select",
        options: [
          { value: "auto", label: "Auto" }, { value: "subscribe", label: "Subscribe" },
          { value: "bundle", label: "Bundle" }, { value: "onetime", label: "One-time" },
        ],
        help: "Which tab opens selected. Auto picks subscribe when a plan exists." },
      { key: "hide_onetime_option", label: "Hide the One-time tab", path: "hide_onetime_option", touches: "tab-onetime",
        help: "Subscription only. Stops people defaulting to a single purchase." },
      { key: "hide_intent_selector", label: "Hide the purchase-mode selector bar", path: "hide_intent_selector", touches: "tabs",
        help: "Shows the plans directly, with no tab row above them." },
      { key: "bundle_selector_tabs", label: "Show bundle selector as tabs", path: "bundle_selector_tabs", touches: "tab-bundle",
        help: "Adds Bundle and Save beside Subscribe and Save." },
      { key: "hide_product_row", label: "Hide product row", path: "hide_product_row", touches: "product-row",
        help: "Hides the image, title and quantity selector. Quantity is fixed at 1 when hidden." },
    ],
  },
  {
    title: "Plan cards",
    source: "app/constants/widget-templates.ts",
    items: [
      { key: "schedule_text_format", label: "Schedule text format", path: "schedule_text_format", touches: "plan-card", kind: "select",
        options: [
          { value: "frequency-deliveries", label: "Every 2 weeks \u00b7 6 deliveries" },
          { value: "cadence", label: "1 delivery every 2 weeks" },
          { value: "none", label: "No second line" },
        ],
        help: "How the second line of a plan card reads. Build-your-own cards ignore cadence but are hidden by none." },
      { key: "card_shows_option_title", label: "Use the option title as the plan name", path: "card_shows_option_title", touches: "plan-card",
        help: "Useful when plan names mean something to the customer." },
      { key: "tag_shows_per_delivery_price", label: "Show per-delivery price on plan tags", path: "tag_shows_per_delivery_price", touches: "plan-card",
        help: "The card carries the price as well as the saving." },
      { key: "freebie_label_shows_value", label: "Show freebie value instead of count", path: "freebie_label_shows_value", touches: "plan-card",
        help: "\u20b9450 free rather than 2 free items." },
      { key: "group_bundle_variants", label: "Group bundle products by variant", path: "group_bundle_variants", touches: "plan-card",
        help: "One row per product with its variants folded in, rather than one row each." },
    ],
  },
  {
    title: "Prices and discounts",
    source: "app/constants/portal-templates.ts",
    items: [
      { key: "tab_discount_format", label: "Tab discount format", path: "tab_discount_format", touches: "tabs", kind: "select",
        options: [{ value: "percentage", label: "Up to 20% off" }, { value: "amount", label: "Save \u20b9150" }],
        help: "Whether the tab badge reads as a percentage or an amount." },
      { key: "tab_badge_shows_plan_discount", label: 'Tab badge shows the plan discount as "Extra"', path: "tab_badge_shows_plan_discount", touches: "tabs",
        help: "For stores already running a sitewide sale, so the subscription saving reads as on top of it." },
      { key: "use_compare_at_price_for_discount_label", label: "Use compare-at price for discount labels", path: "use_compare_at_price_for_discount_label", touches: "price",
        help: "The saving is calculated against the struck-through price rather than the selling price." },
      { key: "hide_price_decimals", label: "Hide price decimals", path: "hide_price_decimals", touches: "price",
        help: "Rounded prices throughout." },
      { key: "summary_expanded_by_default", label: "Expand pricing summary by default", path: "summary_expanded_by_default", touches: "summary",
        help: "Shows the full breakdown without a click." },
      { key: "hide_free_shipping_line", label: "Hide shipping line when shipping is free", path: "hide_free_shipping_line", touches: "shipping-line",
        help: "Turn on if shipping being free is not something you want to say twice." },
    ],
  },
  {
    title: "Checkout and copy",
    source: "extensions/stackback-widgets/blocks/react-purchase-options-test.liquid",
    items: [
      { key: "direct_checkout", label: "Direct checkout (theme block only)", path: "direct_checkout", touches: "cta",
        help: "Skips the cart. Fewer steps, and no chance to add anything else." },
      { key: "promo_line", label: "Promo line", path: "promo_line", touches: "promo", kind: "text",
        help: "One line under the plans. Left empty it does not render." },
    ],
  },
];

export const ALL_TOGGLES = TOGGLE_GROUPS.flatMap((g) => g.items);
