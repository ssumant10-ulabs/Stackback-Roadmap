"use client";
import { useState } from "react";
import type { WidgetSettings, WidgetTheme } from "@/lib/help/widget";
import { downloadTokens, tokensText } from "@/lib/help/tokens";
import { canonicalTokens, tokenPasteBlock, type ReadSources } from "@/lib/help/tokenmap";

/** Read a store's own theme settings and drop them into the widget preview.
 *
 *  This replaces the line that used to sit here, "Colours are set from your brand colours
 *  when we build", which was true and was also the reason a client could not see their own
 *  widget on the call. They type their domain and the preview turns their colours.
 *
 *  It calls the same GET /api/brand-colours the merchant admin uses, so there is one
 *  extractor and one set of rules. The API returns the FLAT six-token shape the subscription
 *  widgets use; this page's preview is the older nested `theme.*` object, so the mapping
 *  happens here rather than in the API, which has no business knowing about either. */

type Token = { key: string; hex: string; source: string; confidence: "theme" | "derived" | "guessed" };

/** One real product off the storefront, so the preview stops saying "Dummy product". */
export interface ReadProduct {
  title: string; handle: string;
  /** Minor units, as Shopify serves them. */
  priceMinor: number | null; compareAtMinor: number | null;
  image: string | null; vendor: string | null;
}

/** Flat brand tokens to the nested theme this preview draws from.
 *  Brand_Secondary is a light tint in the flat model and the nested model has no field for
 *  it, so it lands on mutedSurface, which is what fills an unselected tab and a section. */
function toTheme(tokens: Token[], corners: string, customPx: number | null, base: WidgetTheme, cardPx: number | null, buttonPx: number | null): WidgetTheme {
  const get = (k: string) => tokens.find((t) => t.key === k)?.hex;
  const primary = get("Brand_Primary") || base.colors.primary;
  const accent = get("Brand_Accent") || base.colors.subscriptionAccent;
  const text = get("Product_Tile") || base.text.primary;
  const bg = get("Widget_Background") || base.surfaces.widgetBackground;
  const tint = get("Brand_Secondary") || base.surfaces.mutedSurface;
  const tile = get("Product_Tile_Background") || base.surfaces.inputBackground;

  /* The CARD radius drives the container, never the button radius. thestack.club runs 40px
     pill buttons over 16px cards, and reading the button recommended a widget shaped like
     nothing on that page. Both are snapped to the steps their controls offer, or the theme
     lands a value the dropdown has no option for and the field renders empty. */
  const CARD_STEPS = [0, 6, 12, 16, 24];
  const BTN_STEPS = [0, 6, 10, 999];
  const snap = (v: number, steps: number[]) =>
    steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), steps[0]);

  const RADIUS: Record<string, number> = { Sharp: 0, Semi: 12, Rounded: 16 };
  const rawCard = cardPx != null ? Math.max(0, Math.round(cardPx))
    : corners === "Custom" && customPx != null ? Math.max(0, Math.round(customPx))
    : (RADIUS[corners] ?? base.shape.radius);
  const radius = snap(Math.min(24, rawCard), CARD_STEPS);
  const radiusBtn = buttonPx == null ? base.shape.buttonRadius
    : buttonPx >= 24 ? 999 : snap(buttonPx, BTN_STEPS);

  return {
    ...base,
    colors: { primary, subscriptionAccent: accent, savings: base.colors.savings },
    surfaces: { widgetBackground: bg, mutedSurface: tint, inputBackground: tile },
    // A border the theme does not publish is derived from the tint rather than left slate.
    borders: { default: mix(tint, text, 0.12), strong: primary },
    text: { primary: text, secondary: mix(text, bg, 0.45), muted: mix(text, bg, 0.62) },
    shape: { radius, buttonRadius: radiusBtn },
  };
}

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const x = h.replace("#", "");
    const f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x;
    const n = parseInt(f, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  if (!/^#[0-9a-f]{3,6}$/i.test(a) || !/^#[0-9a-f]{3,6}$/i.test(b)) return a;
  const A = p(a), B = p(b);
  return "#" + [0, 1, 2]
    .map((i) => Math.round(A[i] * (1 - t) + B[i] * t).toString(16).padStart(2, "0"))
    .join("");
}

export default function BrandFetch({ theme, onTheme, settings, storeName, onProduct }: {
  theme: WidgetTheme;
  onTheme: (next: WidgetTheme) => void;
  /** The whole settings object, because the token file hands over the purchase options too. */
  settings: WidgetSettings;
  storeName?: string | null;
  /** A real product off the same store, if it publishes one. The preview showing the
   *  merchant's own product at their own price is the difference between a demo of our
   *  widget and a picture of their page. */
  onProduct?: (p: ReadProduct) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [font, setFont] = useState<string | null>(null);
  const [product, setProduct] = useState<ReadProduct | null>(null);
  /** Which of the six the last read actually supplied, so the table can say so per row. */
  const [readFrom, setReadFrom] = useState<ReadSources | undefined>(undefined);

  async function run() {
    const q = url.trim();
    if (!q || busy) return;
    setBusy(true); setMsg(null); setTokens(null); setNote(null); setProduct(null); setReadFrom(undefined);
    try {
      const r = await fetch("/api/brand-colours?url=" + encodeURIComponent(q));
      const d = await r.json();
      if (!d.ok) { setMsg(d.error || "That site could not be read."); return; }
      onTheme(toTheme(d.tokens, d.corners, d.cornersCustomPx, theme, d.cardRadiusPx ?? null, d.buttonRadiusPx ?? null));
      setTokens(d.tokens);
      setReadFrom(Object.fromEntries((d.tokens as Token[]).map((t) => [t.key, { source: t.source, confidence: t.confidence }])));
      if (d.product?.title) { setProduct(d.product); onProduct?.(d.product); }
      setFont(d.fontBody ? String(d.fontBody).split(",")[0].trim() : null);
      setNote(
        (d.method === "dawn"
          ? "Read from your theme settings."
          : "That theme does not publish its colour settings, so these come from the stylesheet. Worth checking.")
        + (d.fontBody ? " Body font " + String(d.fontBody).split(",")[0].trim() + "." : "")
        + (d.readFrom === "product" ? " Read off your product page." : "")
        + (d.notes?.length ? " " + d.notes.join(" ") : ""),
      );
    } catch {
      setMsg("Could not reach the colour reader just now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hc-brandfetch">
      <p className="hc-bfh">See it in your colours</p>
      <p className="hc-bfp">
        Type your store address and we read the colour settings out of your live theme, the same
        ones you set in the Shopify theme editor. Nothing is saved: this only changes the preview.
      </p>
      <div className="hc-bfrow">
        <input
          type="text" value={url} placeholder="yourstore.com" spellCheck={false}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") run(); }}
        />
        <button type="button" className="hc-btn" onClick={run} disabled={busy || !url.trim()}>
          {busy ? "Reading\u2026" : "Use my colours"}
        </button>
        {/* The six tokens on screen are a reading of the storefront. The widget takes the
            nested theme, which is what this writes out, in the format dev already builds from. */}
        <button type="button" className="hc-btn ghost" onClick={() => downloadTokens(
          tokensText(settings, { store: storeName || url.trim() || null, source: url.trim() || null, font, notes: note ? [note] : [] }),
          storeName || url.trim(),
        )}>
          Download tokens
        </button>
      </div>

      {msg && <p className="hc-bferr">{msg}</p>}

      {/* Every token this widget actually has, named the way `stackback-color-tokens` names
          it, in its sections and its order. The reader answers six of them; the widget on
          every pilot store today has nineteen plus the portal's five and two fonts, and
          showing six and calling it the token set is why this panel kept reading as wrong. */}
      <LiveTokens theme={theme} read={readFrom} font={font} storeName={storeName || url.trim() || null} />

      {tokens && (
        <>
          <div className="hc-bfchips">
            {tokens.map((t) => (
              <span key={t.key} className="hc-bfchip">
                <i style={{ background: t.hex }} />
                <b>{t.hex}</b> {t.source}
              </span>
            ))}
          </div>
          {product && (
            <p className="hc-bfnote">
              Showing <b>{product.title}</b>
              {product.priceMinor != null && <> at ₹{(product.priceMinor / 100).toLocaleString("en-IN")}</>}
              , read from your storefront.
            </p>
          )}
          {note && <p className="hc-bfnote">{note}</p>}
        </>
      )}
    </div>
  );
}

/** The widget's whole token set, in the skill's sections and its order.
 *
 *  Collapsed by default because it is a reference, not a control: a merchant on a call wants
 *  the six chips and the preview, and dev wants all twenty-six to paste into the app. The
 *  copy block at the bottom is the `field: value` shape the skill asks every derivation to
 *  end with, so nobody has to read a table to enter them. */
function LiveTokens({ theme, read, font, storeName }: {
  theme: WidgetTheme; read?: ReadSources; font: string | null; storeName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sections = canonicalTokens(theme, read, font);
  const count = sections.reduce((n, s) => n + s.rows.length, 0);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `# StackBack widget tokens${storeName ? ` — ${storeName}` : ""}\n\n` + tokenPasteBlock(sections),
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* a blocked clipboard is not an error worth a dialog */ }
  };

  return (
    <div className="hc-tok">
      <button type="button" className="hc-tokh" onClick={() => setOpen(!open)} aria-expanded={open}>
        <b>All {count} widget tokens</b>
        <span>{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <>
          <p className="hc-toknote">
            The token set this widget actually has, named as the colour-token spec names it.
            The reader answers six of them; the rest are what the theme is set to.
          </p>
          {sections.map((sec) => (
            <div key={sec.title} className="hc-toksec">
              <p className="hc-toksech">{sec.title}</p>
              <dl className="hc-tokrows">
                {sec.rows.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>
                      {r.swatch && <i className="hc-tokdot" style={{ background: r.value }} />}
                      <b>{r.value}</b>
                      {r.how && <em className={"hc-tokhow h-" + r.how}>{r.how}</em>}
                      {r.note && <span>{r.note}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
          <button type="button" className="hc-btn ghost hc-tokcopy" onClick={copy}>
            {copied ? "Copied" : "Copy all as field: value"}
          </button>
        </>
      )}
    </div>
  );
}
