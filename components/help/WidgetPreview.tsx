"use client";
import { useEffect, useMemo, useState } from "react";
import { TOGGLE_GROUPS, type WidgetSettings } from "@/lib/help/widget";
import type { PlanOption } from "@/lib/help/sim";

/** The storefront widget, rendered from the settings object.
 *
 *  It draws in the STORE's colours and its own type, deliberately outside this page's
 *  palette, because it is the thing being judged. It does not follow the light and dark
 *  toggle for the same reason.
 *
 *  Hovering a setting highlights what it touches. That is the explorer's affordance, and
 *  the only thing that makes twenty switches legible on a call. */
export default function WidgetPreview({
  s, onChange, unitPrice, compareAt, plans, productName, variantLine, currency = "₹", onSubscribe,
  rates, shippingRate = 0, freebieRuns = [],
}: {
  s: WidgetSettings;
  onChange: (next: WidgetSettings) => void;
  unitPrice: number; compareAt?: number;
  plans: PlanOption[];
  productName: string; variantLine?: string; currency?: string;
  /** Subscribe Now advances the wizard: it is the only real action on this page. */
  onSubscribe?: () => void;
  /** Discount by payment type: prepaid the most, pay as you go the least. The card shows the
   *  rate for whatever the customer has selected, because that is what they would be charged. */
  rates?: Record<string, number>;
  /** Charged per delivery below the threshold. Zero means shipping is free. */
  shippingRate?: number;
  freebieRuns?: number[];
}) {
  const t = s.theme;
  const [hot, setHot] = useState<string | null>(null);
  const [intent, setIntent] = useState<"onetime" | "subscribe" | "bundle">(
    s.default_intent === "onetime" ? "onetime" : "subscribe",
  );
  const [mode, setMode] = useState<string>(s.default_payment_mode);
  const [picked, setPicked] = useState(0);
  const [open, setOpen] = useState(s.summary_expanded_by_default);

  useEffect(() => { setOpen(s.summary_expanded_by_default); }, [s.summary_expanded_by_default]);
  useEffect(() => { if (picked >= plans.length) setPicked(0); }, [plans.length, picked]);

  /* Indian grouping either way: 1,058.00, never 1058.00. */
  const money = (n: number) => currency + n.toLocaleString("en-IN", {
    minimumFractionDigits: s.hide_price_decimals ? 0 : 2,
    maximumFractionDigits: s.hide_price_decimals ? 0 : 2,
  });

  const modeList = [
    !s.hide_prepaid && { id: "prepaid", label: "Prepaid", tag: "mode-prepaid", note: "Paid in full at checkout." },
    !s.hide_payg && { id: "payg", label: "Pay as you go", tag: "mode-payg", note: "Payment link before every delivery" },
    !s.hide_auto_debit && { id: "auto_debit", label: "Pay Per Delivery", tag: "mode-auto", note: "Charged before every delivery." },
  ].filter(Boolean) as { id: string; label: string; tag: string; note: string }[];
  const modes = modeList;
  const activeMode = modes.find((m) => m.id === mode) || modes[0];
  const activeModeId = activeMode?.id;

  /* A plan's headline rate is the prepaid one. Selecting another payment type scales every
   * card by the ratio between that type's rate and prepaid's, so the numbers on the cards
   * and the number in the bar can never disagree with the tab that is selected. */
  const shift = rates && rates.prepaid > 0 && activeModeId
    ? (rates[activeModeId] ?? rates.prepaid) / rates.prepaid : 1;
  /* Pay per delivery runs until the customer stops it, so it is one plan with no run length
   * rather than a set of commitments. Offering "12 deliveries of a thing that never ends" is
   * the kind of detail that makes a widget look like it was built by somebody who had not
   * used the product. */
  const endless = activeModeId === "auto_debit";
  const source = endless ? plans.slice(0, 1) : plans;
  const shown = source.map((p) => {
    const pct = Math.round(p.discountPct * shift);
    const per = unitPrice * (1 - pct / 100);
    return {
      ...p,
      discountPct: pct, perDelivery: per,
      total: per * p.deliveries,
      endless,
      freebie: !endless && freebieRuns.includes(p.deliveries),
    };
  });
  const chosen = shown[picked] ?? shown[0];
  const best = shown.reduce((m, p) => Math.max(m, p.discountPct), 0);

  /* What the customer reads as the "was" price. Compare-at when the store sets one and the
   * setting says to use it, otherwise the one-time price. */
  const listPrice = s.use_compare_at_price_for_discount_label && compareAt ? compareAt : unitPrice;

  const radius = t.shape.radius;
  const lit = (tag: string) => (hot === tag ? " sb-lit" : "");
  const shadow = t.chrome.shadow === "none" ? "none"
    : t.chrome.shadow === "strong" ? "0 12px 32px rgba(15,23,42,.18)" : "0 1px 3px rgba(15,23,42,.08)";

  return (
    <div className="hc-wgrid">
      <div className="hc-wstage">
        <div className="hc-wshell" style={{
          background: t.surfaces.widgetBackground,
          border: t.chrome.borderVisible ? `1px solid ${t.chrome.borderColor}` : "1px solid transparent",
          borderRadius: radius, boxShadow: shadow,
          fontSize: `${(t.typography.fontScale / 100) * 14}px`,
          color: t.text.primary,
        }}>
          {!s.hide_intent_selector && (
            <div className={"hc-wtabs" + lit("tabs")} data-style={t.components.tabStyle}
              style={{ background: t.components.tabStyle === "pill" ? t.surfaces.mutedSurface : "transparent", borderRadius: radius }}>
              {!s.hide_onetime_option && (
                <Tab t={t} on={intent === "onetime"} onClick={() => setIntent("onetime")} label="One-time" className={lit("tab-onetime")} />
              )}
              <Tab t={t} on={intent === "subscribe"} onClick={() => setIntent("subscribe")}
                label="Subscribe &" accentWord="Save" sub={
                  s.tab_discount_format === "amount"
                    ? `SAVE ${money(unitPrice * (best / 100))}`
                    : `${s.tab_badge_shows_plan_discount ? "EXTRA " : "UP TO "}${best}% OFF`
                } />
              {s.bundle_selector_tabs && (
                <Tab t={t} on={intent === "bundle"} onClick={() => setIntent("bundle")}
                  label="Bundle & Save" sub={`${best}% OFF`} className={lit("tab-bundle")} />
              )}
            </div>
          )}

          {!s.hide_product_row && (
            <div className={"hc-wprow" + lit("product-row")}>
              <span className="hc-wthumb" style={{ background: t.surfaces.mutedSurface, borderRadius: radius - 6 }} />
              <span className="hc-wprowl">
                <b style={{ color: t.text.primary }}>{productName}</b>
                <em className={lit("price")} style={{ color: t.text.secondary }}>
                  {variantLine ? `${variantLine} · ` : ""}{money(unitPrice)}
                  {compareAt && compareAt > unitPrice && <s style={{ color: t.text.muted }}>{money(compareAt)}</s>}
                </em>
              </span>
              <span className="hc-wqty" style={{ borderColor: t.borders.default, borderRadius: radius - 6, color: t.text.secondary }}>
                <i>&minus;</i><b style={{ color: t.text.primary }}>1</b><i>+</i>
              </span>
            </div>
          )}

          {modes.length > 1 && (
            <div className="hc-wmodewrap" style={{ borderColor: t.borders.default, borderRadius: radius - 2 }}>
              <div className="hc-wsegs" style={{ background: t.surfaces.mutedSurface }}>
                {modes.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMode(m.id)}
                    className={"hc-wseg" + (m.id === activeMode?.id ? " on" : "") + lit(m.tag)}
                    style={{
                      background: m.id === activeMode?.id ? t.colors.subscriptionAccent : "transparent",
                      color: m.id === activeMode?.id ? "#fff" : t.text.secondary,
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
              {activeMode && (
                <p className="hc-wsegnote" style={{ background: withAlpha(t.colors.subscriptionAccent, .07), color: t.colors.subscriptionAccent }}>
                  <i style={{ background: t.colors.subscriptionAccent }} />{activeMode.note}
                </p>
              )}
            </div>
          )}

          {intent === "onetime" ? (
            <div className="hc-wonetime" style={{ background: t.surfaces.mutedSurface, borderRadius: radius - 4 }}>
              <p style={{ color: t.text.secondary }}>
                No schedule on a one-time purchase. The quantity above is the whole order.
              </p>
              <div className="hc-wline"><span style={{ color: t.text.secondary }}>1 x {productName}</span><b style={{ color: t.text.primary }}>{money(unitPrice)}</b></div>
              {compareAt && compareAt > unitPrice && (
                <div className="hc-wline"><span style={{ color: t.text.muted }}>Before discount</span><span style={{ color: t.text.muted }}>{money(compareAt)}</span></div>
              )}
              {!s.hide_free_shipping_line && (
                <div className="hc-wline"><span style={{ color: t.text.secondary }}>Shipping</span><span style={{ color: t.colors.savings }}>Free</span></div>
              )}
            </div>
          ) : (<>
          <p className="hc-wsection" style={{ color: t.text.muted }}>Pick your schedule</p>
          <div className={"hc-wplans" + lit("plan-card")}>
            {shown.map((plan, i) => {
              const on = i === picked;
              return (
                <button key={plan.title + i} type="button" onClick={() => setPicked(i)} className="hc-wplan"
                  style={{
                    borderRadius: radius - 2,
                    border: `${on ? 1.5 : 1}px solid ${on ? t.colors.subscriptionAccent : t.borders.default}`,
                    background: on && t.components.selectedCardState === "border-and-fill" ? t.surfaces.mutedSurface : t.surfaces.inputBackground,
                  }}>
                  <span className="hc-wradio" style={{ borderColor: on ? t.colors.subscriptionAccent : t.borders.default }}>
                    {on && <i style={{ background: t.colors.subscriptionAccent }} />}
                  </span>
                  <span className="hc-wplanl">
                    <b style={{ color: t.text.primary }}>
                      {s.card_shows_option_title ? "Subscribe and save"
                        : plan.endless ? `Delivered ${freqPhrase(plan.everyDays)}` : plan.title}
                    </b>
                    <em style={{ color: t.text.secondary }}>
                      {plan.endless ? "Runs until you stop it" : plan.schedule}
                    </em>
                    {plan.freebie && (
                      <em style={{ color: t.colors.savings, fontWeight: 600 }}>Includes a free gift</em>
                    )}
                  </span>
                  <span className="hc-wplanr">
                    {s.tag_shows_per_delivery_price && (
                      <i className="hc-wper" style={{ background: t.colors.primary, color: "#fff", borderRadius: radius - 6 }}>
                        {money(plan.perDelivery)}/delivery
                      </i>
                    )}
                    <i className="hc-woff" style={{
                      background: t.components.discountBadge === "filled" ? withAlpha(t.colors.savings, .14) : "transparent",
                      color: t.colors.savings,
                      border: t.components.discountBadge === "filled" ? "1px solid transparent" : `1px solid ${t.colors.savings}`,
                    }}>{plan.discountPct}% OFF</i>
                  </span>
                </button>
              );
            })}
          </div>

          {/* The line only ever announces free shipping. When it is charged, the summary
              carries the figure and there is nothing to announce. */}
          {!s.hide_free_shipping_line && shippingRate === 0 && (
            <p className={"hc-wship" + lit("shipping-line")} style={{ color: t.colors.savings }}>
              <i style={{ background: t.colors.savings }} />Free Shipping
            </p>
          )}
          </>)}

          <div className="hc-wfootline" style={{ borderColor: t.borders.default }}>
            <span className="hc-wpolicy" style={{ color: t.text.secondary }}>
              <i style={{ borderColor: t.text.muted, color: t.text.muted }}>i</i>Cancellation Policy
            </span>
            {!s.hide_branding && (
              <span className={"hc-wbrand" + lit("branding")} style={{ color: t.text.muted }}>
                Powered by <b style={{ color: t.text.secondary }}>StackBack</b>
              </span>
            )}
          </div>

          {s.promo_line && (
            <p className={"hc-wpromo" + lit("promo")} style={{ background: withAlpha(t.colors.savings, .1), color: t.colors.savings, borderRadius: radius - 4 }}>
              {s.promo_line}
            </p>
          )}


        </div>

        <div className="hc-wbar" style={{
          background: t.surfaces.widgetBackground, borderColor: t.borders.default,
          borderRadius: radius, fontSize: `${(t.typography.fontScale / 100) * 14}px`,
        }}>
          <span className={"hc-wbarl" + lit("summary")}>
            <em style={{ color: t.text.secondary }}>{chosen?.schedule}</em>
            <button type="button" className="hc-wtotalbtn" onClick={() => setOpen((v) => !v)}
              style={{ color: t.text.primary }} aria-expanded={open}>
              {chosen?.endless || s.tag_shows_per_delivery_price
                ? `${money((chosen?.perDelivery ?? 0) + shippingRate)}/delivery`
                : `${money((chosen?.total ?? 0) + shippingRate * (chosen?.deliveries ?? 0))} total`}
              <i className="hc-wcaret" style={{ borderBottomColor: t.text.muted, transform: open ? "rotate(180deg)" : "none" }} />
            </button>
            {open && chosen && (
              <span className="hc-wbreak">
                {/* The reference order: what it lists at, what comes off, what the item is,
                    what shipping costs, and only then the number they pay. */}
                <span style={{ color: t.text.secondary }}>
                  MRP<s style={{ color: t.text.muted }}>{money(listPrice * (chosen.endless ? 1 : chosen.deliveries))}</s>
                </span>
                <span style={{ color: t.colors.savings }}>
                  {chosen.discountPct}% OFF
                  <b>&minus;{money((listPrice - chosen.perDelivery) * (chosen.endless ? 1 : chosen.deliveries))}</b>
                </span>
                <span style={{ color: t.text.primary, fontWeight: 600 }}>
                  {chosen.endless ? productName : `${chosen.deliveries} x ${productName}`}
                  <b>{money(chosen.endless ? chosen.perDelivery : chosen.total)}</b>
                </span>
                <span style={{ color: t.text.secondary }}>
                  Shipping
                  <b style={{ color: shippingRate > 0 ? t.text.primary : t.colors.savings }}>
                    {shippingRate > 0 ? `${money(shippingRate)}/delivery` : "Free"}
                  </b>
                </span>
                <span className="hc-wtotalrow" style={{ color: t.text.primary, borderColor: t.borders.default }}>
                  {chosen.endless ? "Total per delivery" : "Total"}
                  <b>{money(chosen.endless
                    ? chosen.perDelivery + shippingRate
                    : chosen.total + shippingRate * chosen.deliveries)}</b>
                </span>
              </span>
            )}
          </span>
          <button className={"hc-wcta" + lit("cta")} type="button" onClick={onSubscribe}
            style={{
              borderRadius: radius - 4,
              background: t.components.ctaButton === "solid" ? t.colors.primary : "transparent",
              color: t.components.ctaButton === "solid" ? "#fff" : t.colors.primary,
              border: `1px solid ${t.colors.primary}`,
            }}>
            Subscribe Now
          </button>
        </div>

        <p className="hc-wtax" style={{ color: t.text.muted }}>Prices inclusive of all taxes</p>
      </div>

      <div className="hc-wtoggles">
        <p className="hc-brandnote">Colours are set from your brand colours when we build.</p>
        <p className="hc-wtogglesh">What the customer sees</p>
        <p className="hc-note hc-wtoggleshelp">Hover a setting to see what it changes in the preview.</p>

        {TOGGLE_GROUPS.map((g) => (
          <div key={g.title} className="hc-tgroup">
            <p className="hc-tgrouph">{g.title}<em>{g.items.length}</em></p>
            <p className="hc-tgroups">{g.source}</p>
            {g.items.map((d) => (
              <label key={String(d.key)} className={"hc-wtoggle" + (d.kind ? " wide" : "")}
                onMouseOver={() => setHot(d.touches)} onMouseOut={() => setHot(null)}
                onFocus={() => setHot(d.touches)} onBlur={() => setHot(null)}>
                {!d.kind && (
                  <input type="checkbox" checked={Boolean(s[d.key])}
                    onChange={(e) => onChange({ ...s, [d.key]: e.target.checked })} />
                )}
                <span>
                  {d.label}
                  <code>{d.path}</code>
                  {d.kind === "select" && (
                    <select value={String(s[d.key] ?? "")}
                      onChange={(e) => onChange({ ...s, [d.key]: e.target.value })}>
                      {d.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  )}
                  {d.kind === "text" && (
                    <input type="text" value={String(s[d.key] ?? "")} maxLength={120}
                      placeholder="Leave empty to hide it"
                      onChange={(e) => onChange({ ...s, [d.key]: e.target.value })} />
                  )}
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

/** Tint a brand hex without asking the caller for a second colour. */
function withAlpha(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return hex;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
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
        boxShadow: on && pill ? "0 1px 3px rgba(15,23,42,.14)" : "none",
        color: on ? t.text.primary : t.text.secondary,
      }}>
      <b>{label}{accentWord && <i style={{ color: t.colors.savings }}> {accentWord}</i>}</b>
      {sub && <em style={{ color: on ? t.colors.savings : t.text.muted }}>{sub}</em>}
    </button>
  );
}


const freqPhrase = (d: number) =>
  d === 7 ? "Every Week" : d === 14 ? "Every 2 Weeks" : d === 30 ? "Every Month"
  : d === 60 ? "Every 2 Months" : `Every ${d} Days`;
