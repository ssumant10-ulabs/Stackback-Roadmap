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
  hide_auto_debit: boolean;
  default_payment_mode: "prepaid" | "payg" | "auto_debit";
  default_intent: "auto" | "onetime" | "subscribe";
  hide_onetime_option: boolean;
  hide_intent_selector: boolean;
  tab_discount_format: "percentage" | "amount" | "none";
  schedule_text_format: "frequency-deliveries" | "frequency-only" | "deliveries-only";
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
export const CLIENT_TOGGLES: { key: keyof WidgetSettings; label: string; help: string }[] = [
  { key: "hide_onetime_option", label: "Hide the one-time option", help: "Subscription only. Converts harder, but stops people defaulting to a single purchase." },
  { key: "hide_prepaid", label: "Hide prepaid", help: "Removes the pay-upfront option entirely." },
  { key: "hide_payg", label: "Hide pay as you go", help: "Removes per-delivery billing." },
  { key: "hide_auto_debit", label: "Hide UPI AutoPay", help: "Removes the mandate option." },
  { key: "hide_intent_selector", label: "Hide the one-time / subscribe tabs", help: "Shows the plans directly, with no tab above them." },
  { key: "tag_shows_per_delivery_price", label: "Show per-delivery price on the tag", help: "The tag carries the price rather than only the saving." },
  { key: "card_shows_option_title", label: "Show the plan name on the card", help: "Useful when plan names mean something to the customer." },
  { key: "summary_expanded_by_default", label: "Expand the price breakdown", help: "Shows the full maths without a click." },
  { key: "hide_free_shipping_line", label: "Hide the free shipping line", help: "Turn off if shipping is not free on subscriptions." },
  { key: "hide_price_decimals", label: "Hide price decimals", help: "Rounded prices throughout." },
  { key: "direct_checkout", label: "Subscribe goes straight to checkout", help: "Skips the cart. Fewer steps, and no chance to add anything else." },
  { key: "hide_branding", label: "Hide StackBack branding", help: "Removes the Powered by line." },
];
