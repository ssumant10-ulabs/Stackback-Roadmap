"use client";
import { useState } from "react";
import type { WidgetTheme } from "@/lib/help/widget";

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

/** Flat brand tokens to the nested theme this preview draws from.
 *  Brand_Secondary is a light tint in the flat model and the nested model has no field for
 *  it, so it lands on mutedSurface, which is what fills an unselected tab and a section. */
function toTheme(tokens: Token[], corners: string, customPx: number | null, base: WidgetTheme): WidgetTheme {
  const get = (k: string) => tokens.find((t) => t.key === k)?.hex;
  const primary = get("Brand_Primary") || base.colors.primary;
  const accent = get("Brand_Accent") || base.colors.subscriptionAccent;
  const text = get("Product_Tile") || base.text.primary;
  const bg = get("Widget_Background") || base.surfaces.widgetBackground;
  const tint = get("Brand_Secondary") || base.surfaces.mutedSurface;
  const tile = get("Product_Tile_Background") || base.surfaces.inputBackground;

  const RADIUS: Record<string, number> = { Sharp: 0, Semi: 12, Rounded: 20 };
  const raw = corners === "Custom" && customPx != null
    ? Math.max(0, Math.round(customPx))
    : (RADIUS[corners] ?? base.shape.radius);
  /* Snap to the steps the Corner radius control offers, or the theme lands a value the
     dropdown has no option for and the field renders empty. A 38px button radius is a pill. */
  const STEPS = [0, 6, 12, 20, 999];
  const radius = raw >= 28 ? 999 : STEPS.reduce((a, b) => (Math.abs(b - raw) < Math.abs(a - raw) ? b : a), 0);

  return {
    ...base,
    colors: { primary, subscriptionAccent: accent, savings: base.colors.savings },
    surfaces: { widgetBackground: bg, mutedSurface: tint, inputBackground: tile },
    // A border the theme does not publish is derived from the tint rather than left slate.
    borders: { default: mix(tint, text, 0.12), strong: primary },
    text: { primary: text, secondary: mix(text, bg, 0.45), muted: mix(text, bg, 0.62) },
    shape: { radius },
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

export default function BrandFetch({ theme, onTheme }: {
  theme: WidgetTheme;
  onTheme: (next: WidgetTheme) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tokens, setTokens] = useState<Token[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run() {
    const q = url.trim();
    if (!q || busy) return;
    setBusy(true); setMsg(null); setTokens(null); setNote(null);
    try {
      const r = await fetch("/api/brand-colours?url=" + encodeURIComponent(q));
      const d = await r.json();
      if (!d.ok) { setMsg(d.error || "That site could not be read."); return; }
      onTheme(toTheme(d.tokens, d.corners, d.cornersCustomPx, theme));
      setTokens(d.tokens);
      setNote(
        (d.method === "dawn"
          ? "Read from your theme settings."
          : "That theme does not publish its colour settings, so these come from the stylesheet. Worth checking.")
        + (d.fontBody ? " Body font " + String(d.fontBody).split(",")[0].trim() + "." : "")
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
          {busy ? "Reading…" : "Use my colours"}
        </button>
      </div>

      {msg && <p className="hc-bferr">{msg}</p>}

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
          {note && <p className="hc-bfnote">{note}</p>}
        </>
      )}
    </div>
  );
}
