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
  card_shows_option_title: false,
  tag_shows_per_delivery_price: false,
  freebie_label_shows_value: false,
  use_compare_at_price_for_discount_label: false,
  hide_product_row: false,
  bundle_selector_tabs: false,
  group_bundle_variants: false,
  hide_price_decimals: false,
  compare_at_shipping_price: 0,
  summary_expanded_by_default: false,
  hide_free_shipping_line: false,
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
  /** Absent for a boolean. */
  kind?: "select" | "text" | "number";
  options?: { value: string; label: string }[];
  /** The stored field is a `hide_*`, so the row is checked when the field is false. Ten of
   *  the twenty-four settings are phrased as a removal, which is why half of this screen used
   *  to read as a list of things to switch off. The field name stays visible under each row,
   *  because that is what we set on the store. */
  invert?: boolean;
  /** Shown when the setting is real but this preview cannot draw it. */
  note?: string;
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
      { key: "hide_intent_selector", label: "Show the purchase-mode tab bar", path: "hide_intent_selector", touches: "tabs", invert: true,
        help: "Off hides the whole top tab row: the customer sees only the mode above and cannot switch." },
      { key: "hide_onetime_option", label: "Show the One-time tab", path: "hide_onetime_option", touches: "tab-onetime", invert: true,
        help: "Off makes the product subscription-only. Ignored when one-time is the only mode available, so the product can never become unbuyable." },
      { key: "bundle_selector_tabs", label: "Show bundle choices as tabs, not a dropdown", path: "bundle_selector_tabs", touches: "tab-bundle",
        help: "When a variant belongs to several bundles of the same type, they appear as a segmented bar instead of a select." },
    ],
  },
  {
    title: "How it is paid for",
    source: "widget-templates.ts",
    items: [
      { key: "hide_prepaid", label: "Prepaid", path: "hide_prepaid", touches: "mode-prepaid", invert: true,
        help: "Paid in full at checkout. Ignored for a plan whose every schedule is prepaid-only. Set from the payment types you picked in step one; a change here is a preview override." },
      { key: "hide_payg", label: "Pay as you go", path: "hide_payg", touches: "mode-payg", invert: true,
        help: "A payment link before every delivery. Ignored for a plan whose every schedule is pay-as-you-go only. Set from step one, same as prepaid." },
      { key: "hide_auto_debit", label: "Pay per delivery (AutoPay)", path: "hide_auto_debit", touches: "mode-auto", invert: true,
        help: "Charged automatically before every delivery. Already hidden on its own when Razorpay is not connected; this hides it on top of that. Set from step one, same as prepaid." },
      { key: "default_payment_mode", label: "Preselected when both are offered", path: "default_payment_mode", touches: "mode-prepaid", kind: "select",
        options: [{ value: "prepaid", label: "Prepaid" }, { value: "pay_as_you_go", label: "Pay as you go" }],
        help: "Falls back to whichever mode is actually offered. The codebase offers only these two here; AutoPay is never the preselected one." },
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
        ],
        help: "Build-your-own cards ignore cadence, but none hides their line too." },
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
      { key: "tab_discount_format", label: "Discount on the tab reads as", path: "tab_discount_format", touches: "tabs", kind: "select",
        options: [{ value: "percentage", label: "Up to 20% off" }, { value: "amount", label: "Up to \u20b9200 off" }],
        help: "Bundle amounts follow the current selection; before anything is picked the percentage is shown." },
      { key: "tab_badge_shows_plan_discount", label: 'Tab badge reads "Extra 20% off"', path: "tab_badge_shows_plan_discount", touches: "tabs",
        help: "For a store already running a sitewide sale, so the subscription saving reads as on top of it. Only the tab badge changes; the cards keep their own basis." },
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
      { key: "group_bundle_variants", label: "Group bundle products by variant", path: "group_bundle_variants", touches: "tab-bundle",
        help: "Combines variants of one product into a single row with a variant picker.",
        note: "Mix & match bundles only, which this preview does not draw." },
    ],
  },
  {
    title: "Checkout and footer",
    source: "portal-templates.ts / widget-templates.ts",
    items: [
      { key: "direct_checkout", label: "Skip the cart and go straight to checkout", path: "direct_checkout", touches: "cta",
        help: "Theme block only. Fewer steps, and no chance to add anything else. Portal drawers and edit flows are unaffected." },
      { key: "promo_line", label: "Promo line", path: "promo_line", touches: "promo", kind: "text",
        help: "One line above the button. Start it with an emoji if you want an icon. Empty means it does not render." },
      { key: "hide_branding", label: 'Show "Powered by StackBack"', path: "hide_branding", touches: "branding", invert: true,
        help: "Off removes the credit. If the cancellation policy link is hidden too, the whole footer row goes with it." },
    ],
  },
];

export const ALL_TOGGLES = TOGGLE_GROUPS.flatMap((g) => g.items);
