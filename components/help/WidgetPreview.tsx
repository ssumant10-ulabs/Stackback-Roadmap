"use client";
import { useMemo } from "react";
import { CLIENT_TOGGLES, type WidgetSettings } from "@/lib/help/widget";
import { money } from "@/lib/help/sim";
import { checkWidget } from "@/lib/help/contrast";

/** The storefront widget, rendered from the settings object. Every toggle the client flips
 *  redraws this, which is the point: on a call you change one thing and point at the
 *  result, rather than describing it and hoping.
 *
 *  It draws in the STORE's colours, not this page's, because that is what the client is
 *  judging. So it sets its own explicit values from the settings rather than inheriting the
 *  Help Centre palette, and does not respond to the light and dark toggle. */
export default function WidgetPreview({ s, onChange, unitPrice, everyDays, deliveries, discountPct, productName }: {
  s: WidgetSettings;
  onChange: (next: WidgetSettings) => void;
  unitPrice: number; everyDays: number; deliveries: number; discountPct: number; productName: string;
}) {
  const t = s.theme;
  const per = unitPrice * (1 - discountPct / 100);
  const fmt = (n: number) => (s.hide_price_decimals ? money(n) : "₹" + n.toFixed(2));

  const freq = useMemo(() => {
    const f = everyDays === 7 ? "Weekly" : everyDays === 15 ? "Every 15 days"
      : everyDays === 30 ? "Monthly" : `Every ${everyDays} days`;
    if (s.schedule_text_format === "frequency-only") return f;
    if (s.schedule_text_format === "deliveries-only") return `${deliveries} deliveries`;
    return `${f}, ${deliveries} deliveries`;
  }, [everyDays, deliveries, s.schedule_text_format]);

  const modes = [
    !s.hide_prepaid && { id: "prepaid", label: "Pay upfront" },
    !s.hide_payg && { id: "payg", label: "Pay per delivery" },
    !s.hide_auto_debit && { id: "auto_debit", label: "UPI AutoPay" },
  ].filter(Boolean) as { id: string; label: string }[];

  const activeMode = modes.find((m) => m.id === s.default_payment_mode)?.id ?? modes[0]?.id;
  const subscribeFirst = s.default_intent !== "onetime";

  const issues = useMemo(() => checkWidget(t), [t]);

  const shadow = t.chrome.shadow === "none" ? "none"
    : t.chrome.shadow === "strong" ? "0 12px 32px rgba(15,23,42,.18)" : "0 1px 2px rgba(15,23,42,.06)";

  const badge = t.components.discountBadge === "filled"
    ? { background: t.colors.savings, color: "#fff", border: "1px solid transparent" }
    : { background: "transparent", color: t.colors.savings, border: `1px solid ${t.colors.savings}` };

  const discountLabel = s.tab_discount_format === "amount" ? `Save ${money(unitPrice - per)}`
    : s.tab_discount_format === "none" ? "" : `Save ${discountPct}%`;

  return (
    <div className="hc-wgrid">
      <div
        className="hc-wshell"
        style={{
          background: t.surfaces.widgetBackground,
          border: t.chrome.borderVisible ? `1px solid ${t.chrome.borderColor}` : "1px solid transparent",
          borderRadius: t.shape.radius,
          boxShadow: shadow,
          fontSize: `${(t.typography.fontScale / 100) * 14}px`,
          color: t.text.primary,
        }}
      >
        {!s.hide_product_row && (
          <div className="hc-wrow" style={{ borderBottom: `1px solid ${t.borders.default}` }}>
            <div className="hc-wthumb" style={{ background: t.surfaces.mutedSurface, borderRadius: t.shape.radius - 4 }} />
            <div>
              <p className="hc-wname" style={{ color: t.text.primary }}>{productName}</p>
              <p className="hc-wsub" style={{ color: t.text.secondary }}>{fmt(unitPrice)}</p>
            </div>
          </div>
        )}

        {!s.hide_intent_selector && !s.hide_onetime_option && (
          <div className="hc-wtabs" data-style={t.components.tabStyle}
            style={{ background: t.components.tabStyle === "pill" ? t.surfaces.mutedSurface : "transparent",
                     borderRadius: t.components.tabStyle === "pill" ? t.shape.radius : 0 }}>
            {["One time", "Subscribe"].map((label, i) => {
              const on = (i === 1) === subscribeFirst;
              return (
                <span key={label} className="hc-wtab"
                  style={{
                    color: on ? (t.components.tabStyle === "pill" ? t.text.primary : t.colors.subscriptionAccent) : t.text.secondary,
                    background: on && t.components.tabStyle === "pill" ? t.surfaces.widgetBackground : "transparent",
                    borderRadius: t.shape.radius - 4,
                    borderBottom: t.components.tabStyle === "underline" ? `2px solid ${on ? t.colors.subscriptionAccent : "transparent"}` : "none",
                    fontWeight: on ? 650 : 500,
                  }}>
                  {label}
                </span>
              );
            })}
          </div>
        )}

        {!s.hide_onetime_option && !subscribeFirst && (
          <Option t={t} selected={false} title="One time purchase" price={fmt(unitPrice)} />
        )}

        <Option
          t={t} selected
          title={s.card_shows_option_title ? "Subscribe and save" : freq}
          sub={s.card_shows_option_title ? freq : undefined}
          price={fmt(per)} strike={fmt(unitPrice)}
          tag={discountLabel}
          tagStyle={badge}
          perDelivery={s.tag_shows_per_delivery_price ? `${fmt(per)} per delivery` : undefined}
        />

        {modes.length > 1 && (
          <div className="hc-wmodes">
            {modes.map((m) => (
              <span key={m.id} className="hc-wmode"
                style={{
                  borderRadius: t.shape.radius - 4,
                  border: `1px solid ${m.id === activeMode ? t.borders.strong : t.borders.default}`,
                  background: m.id === activeMode ? t.surfaces.mutedSurface : t.surfaces.inputBackground,
                  color: m.id === activeMode ? t.text.primary : t.text.secondary,
                  fontWeight: m.id === activeMode ? 640 : 500,
                }}>
                {m.label}
              </span>
            ))}
          </div>
        )}

        <div className="hc-wsummary" style={{ background: t.surfaces.mutedSurface, borderRadius: t.shape.radius - 4 }}>
          <div className="hc-wline"><span style={{ color: t.text.secondary }}>{deliveries} deliveries</span><b>{fmt(per * deliveries)}</b></div>
          {s.summary_expanded_by_default && (
            <>
              <div className="hc-wline"><span style={{ color: t.text.muted }}>Before discount</span><span style={{ color: t.text.muted }}>{fmt(unitPrice * deliveries)}</span></div>
              <div className="hc-wline"><span style={{ color: t.colors.savings }}>You save</span><span style={{ color: t.colors.savings }}>{fmt((unitPrice - per) * deliveries)}</span></div>
            </>
          )}
          {!s.hide_free_shipping_line && (
            <div className="hc-wline"><span style={{ color: t.text.secondary }}>Shipping</span><span style={{ color: t.colors.savings }}>Free</span></div>
          )}
        </div>

        {s.promo_line && <p className="hc-wpromo" style={{ color: t.colors.subscriptionAccent }}>{s.promo_line}</p>}

        <button className="hc-wcta" type="button" disabled
          style={{
            borderRadius: t.shape.radius - 4,
            background: t.components.ctaButton === "solid" ? t.colors.primary : "transparent",
            color: t.components.ctaButton === "solid" ? "#fff" : t.colors.primary,
            border: `1px solid ${t.colors.primary}`,
          }}>
          {s.direct_checkout ? "Subscribe and checkout" : "Add to cart"}
        </button>

        {!s.hide_branding && <p className="hc-wbrand" style={{ color: t.text.muted }}>Powered by StackBack</p>}
      </div>

      <div className="hc-wtoggles">
        {issues.length > 0 && (
          <div className="hc-wcontrast">
            <b>{issues.length === 1 ? "One colour pair is hard to read" : `${issues.length} colour pairs are hard to read`}</b>
            <ul>
              {issues.map((i) => (
                <li key={i.what}>{i.what}: <b>{i.ratio}:1</b>, needs {i.needs}:1</li>
              ))}
            </ul>
            <p>
              Measured on your own brand colours, not ours. It is a real reading problem for some
              customers on some screens, and it is a colour change, not a code change.
            </p>
          </div>
        )}
        <p className="hc-wtogglesh">What the customer sees</p>
        <p className="hc-note hc-wtoggleshelp">
          Flip anything here and the preview redraws. These are the choices worth making on the call;
          colours and the rest we set from your brand.
        </p>
        {CLIENT_TOGGLES.map(({ key, label, help }) => (
          <label key={String(key)} className="hc-wtoggle">
            <input type="checkbox" checked={Boolean(s[key])}
              onChange={(e) => onChange({ ...s, [key]: e.target.checked })} />
            <span>
              {label}
              <em>{help}</em>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Option({ t, selected, title, sub, price, strike, tag, tagStyle, perDelivery }: {
  t: WidgetSettings["theme"]; selected: boolean; title: string; sub?: string;
  price: string; strike?: string; tag?: string;
  tagStyle?: React.CSSProperties; perDelivery?: string;
}) {
  return (
    <div className="hc-wcard"
      style={{
        borderRadius: t.shape.radius - 2,
        border: `${selected ? 1.5 : 1}px solid ${selected ? t.colors.subscriptionAccent : t.borders.default}`,
        background: selected && t.components.selectedCardState === "border-and-fill" ? t.surfaces.mutedSurface : t.surfaces.inputBackground,
      }}>
      <span className="hc-wdot" style={{ borderColor: selected ? t.colors.subscriptionAccent : t.borders.default,
        background: selected ? t.colors.subscriptionAccent : "transparent" }} />
      <span className="hc-wcardl">
        <b style={{ color: t.text.primary }}>{title}</b>
        {sub && <em style={{ color: t.text.secondary }}>{sub}</em>}
        {perDelivery && <em style={{ color: t.text.secondary }}>{perDelivery}</em>}
      </span>
      <span className="hc-wcardp">
        {tag && <i className="hc-wtag" style={tagStyle}>{tag}</i>}
        <b style={{ color: t.text.primary }}>{price}</b>
        {strike && strike !== price && <s style={{ color: t.text.muted }}>{strike}</s>}
      </span>
    </div>
  );
}
