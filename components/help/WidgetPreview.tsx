"use client";
import { useMemo, useState } from "react";
import { TOGGLE_GROUPS, type WidgetSettings } from "@/lib/help/widget";
import { checkWidget } from "@/lib/help/contrast";
import { runLabel } from "@/lib/help/sim";

/** The storefront widget, rendered from the settings object, matching the Purchase Options
 *  (Master) block: the three intent tabs, the product row with its quantity stepper, the
 *  plan group, the payment segmented control, and the schedule cards.
 *
 *  It draws in the STORE's colours and its own type, not this page's, because that is what
 *  the client is judging. It does not follow the light and dark toggle for the same reason.
 *
 *  Hovering a setting highlights what it touches, which is the explorer's affordance and the
 *  only thing that makes twenty switches legible on a call. */
export default function WidgetPreview({ s, onChange, unitPrice, compareAt, everyDays, deliveries, discountPct, productName, variantLine }: {
  s: WidgetSettings;
  onChange: (next: WidgetSettings) => void;
  unitPrice: number; compareAt?: number; everyDays: number; deliveries: number; discountPct: number;
  productName: string; variantLine?: string;
}) {
  const t = s.theme;
  const [hot, setHot] = useState<string | null>(null);
  const [intent, setIntent] = useState<"onetime" | "subscribe" | "bundle">(
    s.default_intent === "onetime" ? "onetime" : "subscribe",
  );
  const [mode, setMode] = useState<string>(s.default_payment_mode);

  const per = unitPrice * (1 - discountPct / 100);
  const base = s.use_compare_at_price_for_discount_label && compareAt ? compareAt : unitPrice;
  const shownDiscount = Math.round((1 - per / base) * 100);
  // Indian grouping either way: 6,750.00, never 6750.00. en-IN gets the lakh grouping right
  // and a plain toFixed does not group at all.
  const money = (n: number) => "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: s.hide_price_decimals ? 0 : 2,
    maximumFractionDigits: s.hide_price_decimals ? 0 : 2,
  });

  const issues = useMemo(() => checkWidget(t), [t]);

  const freqWord = everyDays === 7 ? "Every week" : everyDays === 14 ? "Every 2 weeks"
    : everyDays === 30 ? "Every month" : everyDays === 60 ? "Every 2 months" : `Every ${everyDays} days`;
  const schedule = s.schedule_text_format === "frequency-only" ? freqWord
    : s.schedule_text_format === "deliveries-only" ? `${deliveries} deliveries`
    : `${freqWord} · ${deliveries} deliveries`;

  const modes = [
    !s.hide_prepaid && { id: "prepaid", label: "Prepaid", tag: "mode-prepaid", note: "Paid in full at checkout." },
    !s.hide_payg && { id: "payg", label: "Pay as you go", tag: "mode-payg", note: "Invoiced before each delivery." },
    !s.hide_auto_debit && { id: "auto_debit", label: "Pay Per Delivery", tag: "mode-auto", note: "Charged before every delivery." },
  ].filter(Boolean) as { id: string; label: string; tag: string; note: string }[];
  const activeMode = modes.find((m) => m.id === mode) || modes[0];

  const radius = t.shape.radius;
  const lit = (tag: string) => (hot === tag ? " sb-lit" : "");
  const shadow = t.chrome.shadow === "none" ? "none"
    : t.chrome.shadow === "strong" ? "0 12px 32px rgba(15,23,42,.18)" : "0 1px 3px rgba(15,23,42,.08)";

  return (
    <div className="hc-wgrid">
      <div className="hc-wstage">
        <div
          className="hc-wshell"
          style={{
            background: t.surfaces.widgetBackground,
            border: t.chrome.borderVisible ? `1px solid ${t.chrome.borderColor}` : "1px solid transparent",
            borderRadius: radius, boxShadow: shadow,
            fontSize: `${(t.typography.fontScale / 100) * 14}px`,
            color: t.text.primary,
          }}
        >
          <p className="hc-wcrumb" style={{ color: t.text.muted }}>Home / Shop / {productName}</p>
          <h3 className="hc-wtitle" style={{ color: t.text.primary }}>{productName}</h3>
          <p className={"hc-wprice" + lit("price")}>
            <b style={{ color: t.text.primary }}>{money(unitPrice)}</b>
            {compareAt && compareAt > unitPrice && <s style={{ color: t.text.muted }}>{money(compareAt)}</s>}
          </p>
          {variantLine && <p className="hc-wvariant" style={{ color: t.text.secondary }}>{variantLine}</p>}

          <div className="hc-wthemecta" style={{ borderColor: t.borders.default, color: t.text.muted, borderRadius: radius - 4 }}>
            Theme&rsquo;s own Add to cart
            <em>hidden by sb-hide-on-subscribe when merchants opt in</em>
          </div>

          {!s.hide_intent_selector && (
            <div className={"hc-wtabs" + lit("tabs")} data-style={t.components.tabStyle}
              style={{ background: t.components.tabStyle === "pill" ? t.surfaces.mutedSurface : "transparent", borderRadius: radius }}>
              {!s.hide_onetime_option && (
                <Tab t={t} on={intent === "onetime"} onClick={() => setIntent("onetime")} label="One-time" className={lit("tab-onetime")} />
              )}
              <Tab t={t} on={intent === "subscribe"} onClick={() => setIntent("subscribe")}
                label="Subscribe &" accentWord="Save" sub={`Up to ${shownDiscount}% off`} />
              {s.bundle_selector_tabs && (
                <Tab t={t} on={intent === "bundle"} onClick={() => setIntent("bundle")}
                  label="Bundle & Save" sub={`${discountPct}% OFF`} className={lit("tab-bundle")} />
              )}
            </div>
          )}

          {!s.hide_product_row && (
            <div className={"hc-wprow" + lit("product-row")} style={{ borderColor: t.borders.default, borderRadius: radius - 2 }}>
              <span className="hc-wthumb" style={{ background: t.surfaces.mutedSurface, borderRadius: radius - 6 }} />
              <span className="hc-wprowl">
                <b style={{ color: t.text.primary }}>{productName}</b>
                <em style={{ color: t.text.secondary }}>{variantLine || "Default"} · {money(unitPrice)}</em>
              </span>
              <span className="hc-wqty" style={{ borderColor: t.borders.default, borderRadius: radius - 6, color: t.text.secondary }}>
                <i>&minus;</i><b style={{ color: t.text.primary }}>1</b><i>+</i>
              </span>
            </div>
          )}

          <div className="hc-wgroup" style={{ borderColor: t.borders.default, borderRadius: radius - 2 }}>
            <b style={{ color: t.text.primary }}>Subscription</b>
            <span className="hc-wgbadge" style={{
              background: t.components.discountBadge === "filled" ? t.colors.savings : "transparent",
              color: t.components.discountBadge === "filled" ? "#fff" : t.colors.savings,
              border: `1px solid ${t.colors.savings}`,
            }}>Upto {shownDiscount}% OFF</span>
            <i className="hc-wchev" style={{ borderColor: t.text.secondary }} />
          </div>

          {modes.length > 1 && (
            <>
              <div className="hc-wsegs" style={{ background: t.surfaces.mutedSurface, borderRadius: radius - 2 }}>
                {modes.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMode(m.id)}
                    className={"hc-wseg" + (m.id === activeMode?.id ? " on" : "") + lit(m.tag)}
                    style={{
                      borderRadius: radius - 4,
                      background: m.id === activeMode?.id ? t.colors.primary : "transparent",
                      color: m.id === activeMode?.id ? "#fff" : t.text.secondary,
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
              {activeMode && (
                <p className="hc-wsegnote" style={{ background: t.surfaces.mutedSurface, color: t.colors.savings, borderRadius: radius - 4 }}>
                  <i style={{ background: t.colors.savings }} />{activeMode.note}
                </p>
              )}
            </>
          )}

          <p className="hc-wsection" style={{ color: t.text.muted }}>Pick your schedule</p>
          <div className={"hc-wplan" + lit("plan-card")}
            style={{
              borderRadius: radius - 2,
              border: `1.5px solid ${t.colors.subscriptionAccent}`,
              background: t.components.selectedCardState === "border-and-fill" ? t.surfaces.mutedSurface : t.surfaces.inputBackground,
            }}>
            <span className="hc-wradio" style={{ borderColor: t.colors.subscriptionAccent }}>
              <i style={{ background: t.colors.subscriptionAccent }} />
            </span>
            <span className="hc-wplanl">
              <b style={{ color: t.text.primary }}>
                {s.card_shows_option_title ? "Subscribe and save" : runLabel(everyDays, deliveries)}
              </b>
              <em style={{ color: t.text.secondary }}>{schedule}</em>
              {s.tag_shows_per_delivery_price && (
                <em style={{ color: t.text.secondary }}>{money(per)} per delivery</em>
              )}
            </span>
            <span className="hc-wplanr">
              <i className="hc-wpop" style={{ background: t.colors.savings }}>MOST POPULAR</i>
              <i className="hc-woff" style={{
                background: t.components.discountBadge === "filled" ? t.colors.savings : "transparent",
                color: t.components.discountBadge === "filled" ? "#fff" : t.colors.savings,
                border: `1px solid ${t.colors.savings}`,
              }}>{shownDiscount}% OFF</i>
            </span>
          </div>

          <div className={"hc-wsummary" + lit("summary")} style={{ background: t.surfaces.mutedSurface, borderRadius: radius - 4 }}>
            <div className="hc-wline"><span style={{ color: t.text.secondary }}>{deliveries} deliveries</span><b>{money(per * deliveries)}</b></div>
            {s.summary_expanded_by_default && (
              <>
                <div className="hc-wline"><span style={{ color: t.text.muted }}>Before discount</span><span style={{ color: t.text.muted }}>{money(unitPrice * deliveries)}</span></div>
                <div className="hc-wline"><span style={{ color: t.colors.savings }}>You save</span><span style={{ color: t.colors.savings }}>{money((unitPrice - per) * deliveries)}</span></div>
              </>
            )}
            {!s.hide_free_shipping_line && (
              <div className={"hc-wline" + lit("shipping-line")}><span style={{ color: t.text.secondary }}>Shipping</span><span style={{ color: t.colors.savings }}>Free</span></div>
            )}
          </div>

          {s.promo_line && <p className="hc-wpromo" style={{ color: t.colors.subscriptionAccent }}>{s.promo_line}</p>}

          <button className={"hc-wcta" + lit("cta")} type="button" disabled
            style={{
              borderRadius: radius - 4,
              background: t.components.ctaButton === "solid" ? t.colors.primary : "transparent",
              color: t.components.ctaButton === "solid" ? "#fff" : t.colors.primary,
              border: `1px solid ${t.colors.primary}`,
            }}>
            {s.direct_checkout ? "Subscribe and checkout" : "Add to cart"}
          </button>

          {!s.hide_branding && <p className={"hc-wbrand" + lit("branding")} style={{ color: t.text.muted }}>Powered by StackBack</p>}
        </div>
      </div>

      <div className="hc-wtoggles">
        {issues.length > 0 && (
          <div className="hc-wcontrast">
            <b>{issues.length === 1 ? "One colour pair is hard to read" : `${issues.length} colour pairs are hard to read`}</b>
            <ul>{issues.map((i) => <li key={i.what}>{i.what}: <b>{i.ratio}:1</b>, needs {i.needs}:1</li>)}</ul>
            <p>Measured on your own brand colours. A reading problem for some customers on some screens, and a colour change rather than a code change.</p>
          </div>
        )}
        <p className="hc-wtogglesh">What the customer sees</p>
        <p className="hc-note hc-wtoggleshelp">Hover a setting to see what it changes in the preview.</p>

        {TOGGLE_GROUPS.map((g) => (
          <div key={g.title} className="hc-tgroup">
            <p className="hc-tgrouph">{g.title}<em>{g.items.length}</em></p>
            <p className="hc-tgroups">{g.source}</p>
            {g.items.map((d) => (
              <label key={String(d.key)} className="hc-wtoggle"
                onMouseEnter={() => setHot(d.touches)} onMouseLeave={() => setHot(null)}
                onFocus={() => setHot(d.touches)} onBlur={() => setHot(null)}>
                <input type="checkbox" checked={Boolean(s[d.key])}
                  onChange={(e) => onChange({ ...s, [d.key]: e.target.checked })} />
                <span>
                  {d.label}
                  <code>{d.path}</code>
                  <em>{d.help}</em>
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tab({ t, on, label, sub, onClick, accentWord, className = "" }: {
  t: WidgetSettings["theme"]; on: boolean; label: string; sub?: string;
  onClick: () => void; accentWord?: string; className?: string;
}) {
  const pill = t.components.tabStyle === "pill";
  return (
    <button type="button" onClick={onClick} className={"hc-wtab" + (on ? " on" : "") + " " + className}
      style={{
        background: on && pill ? t.surfaces.widgetBackground : "transparent",
        borderRadius: pill ? t.shape.radius - 4 : 0,
        borderBottom: pill ? "none" : `2px solid ${on ? t.colors.subscriptionAccent : "transparent"}`,
        boxShadow: on && pill ? "0 1px 3px rgba(15,23,42,.12)" : "none",
        color: on ? t.text.primary : t.text.secondary,
      }}>
      <b>{label}{accentWord && <i style={{ color: t.colors.savings }}> {accentWord}</i>}</b>
      {sub && <em style={{ color: on ? t.colors.savings : t.text.muted }}>{sub}</em>}
    </button>
  );
}
