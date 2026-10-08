"use client";
import { useMemo, useRef, useState } from "react";
import { palette, suggestTokens, type Swatch } from "@/lib/help/shot-palette";
import type { WidgetSettings, WidgetTheme } from "@/lib/help/widget";
import { downloadTokens, tokensText } from "@/lib/help/tokens";
import { canonicalTokens, tokenPasteBlock, type ReadShape, type ReadSources } from "@/lib/help/tokenmap";

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

/** One real product off the storefront, so the preview shows their product rather than a placeholder. */
/** Which theme path each reader token writes to, for applying a screenshot guess. */
const TOKEN_PATH: Record<string, string> = {
  Brand_Primary: "colors.primary",
  Brand_Accent: "colors.subscriptionAccent",
  Brand_Secondary: "surfaces.mutedSurface",
  Widget_Background: "surfaces.widgetBackground",
  Product_Tile: "text.primary",
  Text_Secondary: "text.secondary",
  Product_Tile_Background: "surfaces.inputBackground",
};

/** Every token a sampled colour can be dropped onto, in the order the panel lists them. */
const ASSIGNABLE: { path: string; label: string }[] = [
  { path: "colors.primary", label: "Primary" },
  { path: "colors.subscriptionAccent", label: "Subscription Accent" },
  { path: "colors.savings", label: "Savings Color" },
  { path: "text.primary", label: "Primary Text" },
  { path: "text.secondary", label: "Secondary Text" },
  { path: "text.muted", label: "Muted Text" },
  { path: "surfaces.widgetBackground", label: "Widget Background" },
  { path: "surfaces.mutedSurface", label: "Muted Surface" },
  { path: "surfaces.inputBackground", label: "Input Background" },
  { path: "borders.default", label: "Default Border" },
  { path: "borders.strong", label: "Selected Border" },
];

export interface ReadProduct {
  title: string; handle: string;
  /** Minor units, as Shopify serves them. */
  priceMinor: number | null; compareAtMinor: number | null;
  image: string | null; vendor: string | null;
}

/** Flat brand tokens to the nested theme this preview draws from.
 *  Brand_Secondary is a light tint in the flat model and the nested model has no field for
 *  it, so it lands on mutedSurface, which is what fills an unselected tab and a section. */
/** Set one dotted path on the theme, returning a new one. The token rows carry their own
 *  path, so the panel can write a colour back without a switch statement that has to be kept
 *  in step with the token list. */
/** `<input type=color>` only accepts #rrggbb. A token can legitimately hold `transparent`
 *  or a short hex, and feeding either to the control makes it silently show black. */
/** Two token values are the same colour. Case and the shorthand form both vary across a
 *  theme, and `transparent` must never match itself into a highlight. */
function sameHex(a: string, b: string): boolean {
  const n = (v: string) => {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((v || "").trim());
    if (!m) return null;
    const h = m[1];
    return (h.length === 3 ? h.split("").map((c) => c + c).join("") : h).toUpperCase();
  };
  const x = n(a), y = n(b);
  return Boolean(x && y && x === y);
}

function safeHex(v: string): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return "#000000";
  const h = m[1];
  return "#" + (h.length === 3 ? h.split("").map((c) => c + c).join("") : h).toUpperCase();
}

function setPath(t: WidgetTheme, path: string, value: string): WidgetTheme {
  const [a, b] = path.split(".");
  const branch = (t as unknown as Record<string, Record<string, string>>)[a];
  return { ...t, [a]: { ...branch, [b]: value } } as WidgetTheme;
}

/** Re-derive everything that is derived.
 *
 *  Four tokens are not read from anywhere — the default border, muted text, the savings
 *  colour and the selected border all fall out of the ones that are. `setPath` writes a
 *  single path, so applying a whole new palette left those four holding values computed from
 *  the PREVIOUS one: a screenshot of a page with light blue and grey borders still showed a
 *  green default border, because that green had been mixed out of a canvas read off the URL
 *  minutes earlier and nothing recomputed it.
 *
 *  Run after any bulk change. A single row edit is left alone, so a border set by hand is
 *  not undone by the next tweak. */
function rederive(t: WidgetTheme): WidgetTheme {
  return {
    ...t,
    colors: { ...t.colors, savings: t.colors.subscriptionAccent },
    borders: { default: mix(t.surfaces.mutedSurface, t.text.primary, 0.12), strong: t.colors.primary },
    text: { ...t.text, muted: mix(t.text.secondary, t.surfaces.widgetBackground, 0.4) },
  };
}

function toTheme(tokens: Token[], corners: string, customPx: number | null, base: WidgetTheme, cardPx: number | null, buttonPx: number | null): WidgetTheme {
  /* Nothing predefined. Every colour here comes off the merchant's own site, and a token the
     reader could not find falls back to another token that WAS read — never to the app's
     starting slate, violet and green, which is how a widget ended up wearing colours that
     belong to nobody's brand. `base` is only reached when the site gave us nothing at all. */
  const get = (k: string) => tokens.find((t) => t.key === k)?.hex;
  const any = tokens[0]?.hex;
  const primary = get("Brand_Primary") || any || base.colors.primary;
  const accent = get("Brand_Accent") || primary;
  const text = get("Product_Tile") || base.text.primary;
  /* Read where the site publishes a second ink, derived where it does not. It used to be a
     mix of the primary toward the background on every store, which is a colour off nobody's
     page presented beside colours that are. */
  const textSecondary = get("Text_Secondary");
  const bg = get("Widget_Background") || base.surfaces.widgetBackground;
  const tint = get("Brand_Secondary") || bg;
  const tile = get("Product_Tile_Background") || bg;

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
    /* The savings colour was a fixed green on every store. It is what a discount is printed
       in, so it is the accent unless the site published something greener of its own. */
    /* The savings colour is the ACCENT, not a green hunted out of the stylesheet. It used
       to be "the greenest colour your site publishes", which on a site with no green of its
       own found one anyway — a review widget's success colour, a stock icon, an image
       artefact — and printed every discount in a colour nobody had chosen. The skill names
       a Savings token; it does not say the token must be green. Any merchant who wants
       green now picks it, which is one click on an editable row. */
    colors: { primary, subscriptionAccent: accent, savings: accent },
    surfaces: { widgetBackground: bg, mutedSurface: tint, inputBackground: tile },
    // A border the theme does not publish is derived from the tint rather than left slate.
    borders: { default: mix(tint, text, 0.12), strong: primary },
    text: {
      primary: text,
      secondary: textSecondary || mix(text, bg, 0.45),
      /* Muted stays a derivation, from whichever secondary we ended up with: the skill's own
         rule is that it sits lighter than Secondary and darker than the muted surface. */
      muted: mix(textSecondary || text, bg, textSecondary ? 0.4 : 0.62),
    },
    shape: { radius, buttonRadius: radiusBtn },
  };
}

function mix(a: string, b: string, t: number): string {
  // A surface can legitimately be transparent; there is nothing to blend toward.
  if (a === "transparent" || b === "transparent") return a;
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

export default function BrandFetch({ theme, onTheme, settings, storeName, onProduct, lit = null }: {
  theme: WidgetTheme;
  onTheme: (next: WidgetTheme) => void;
  /** The whole settings object, because the token file hands over the purchase options too. */
  settings: WidgetSettings;
  storeName?: string | null;
  /** A real product off the same store, if it publishes one. The preview showing the
   *  merchant's own product at their own price is the difference between a demo of our
   *  widget and a picture of their page. */
  onProduct?: (p: ReadProduct) => void;
  /** A colour the PREVIEW is reporting the pointer is over, so pointing at the widget lights
   *  the token holding that colour. The panel's own hover still works; whichever is active
   *  wins, and the preview wins a tie because that is the pointer's real position. */
  lit?: string | null;
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
  /** What else the reader managed to find: shape, shadow, button style. */
  const [shape, setShape] = useState<ReadShape | undefined>(undefined);
  /* Colours sampled from a screenshot the merchant uploads. The reader works from the served
     HTML and CSS, and on a page whose colours are painted by JavaScript there is nothing in
     the response to find — blepworld.com declares twelve colour variables and every one
     belongs to Judge.me. A picture of the page has no such problem. */
  const [shot, setShot] = useState<Swatch[] | null>(null);
  const [shotName, setShotName] = useState<string | null>(null);
  /* Which colour the pointer is over, shared between the sampled swatches and the token
     rows. Hovering a swatch lights up every token already holding it, and hovering a token
     lights up the swatch it came from — so "which of these is the button" is answered by
     pointing at it rather than by reading hexes off two lists. */
  const [ownHover, setOwnHover] = useState<string | null>(null);
  const hover = lit ?? ownHover;
  const setHover = setOwnHover;
  /* Every token that currently holds each colour, keyed by normalised hex. Built off the
     same rows the panel lists, so the swatch and the list can never disagree about what a
     colour is being used for. */
  const assigned = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const sec of canonicalTokens(theme)) {
      for (const r of sec.rows) {
        if (!r.swatch || !r.path) continue;
        const k = safeHex(r.value);
        if (k === "#000000" && !/^#0{3,6}$/i.test(r.value.trim())) continue;
        m.set(k, [...(m.get(k) || []), r.label]);
      }
    }
    return m;
  }, [theme]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function readShot(file: File) {
    setMsg(null);
    try {
      const bmp = await createImageBitmap(file);
      /* Scaled down before sampling: a 3000px screenshot is nine million pixels to bucket
         for an answer that does not change, and the browser stalls while it does it. */
      const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) { setMsg("This browser will not let us read the image."); return; }
      ctx.drawImage(bmp, 0, 0, w, h);
      const sw = palette(ctx.getImageData(0, 0, w, h).data);
      if (!sw.length) { setMsg("No colours could be read out of that image."); return; }
      setShot(sw);
      setShotName(file.name);
      /* Offered, not applied. A flat picture knows its colours exactly and knows nothing
         about which one is the button, so the guess goes on screen next to the swatches and
         a person confirms it. */
      const guess = suggestTokens(sw);
      const next = Object.entries(guess).reduce((acc, [k, hex]) => {
        const path = TOKEN_PATH[k];
        return path ? setPath(acc, path, hex) : acc;
      }, theme);
      /* The derived four follow the new palette. Without this they keep values mixed out of
         whatever was read before, which is how a screenshot of a page with grey borders
         still showed a green one. */
      onTheme(rederive(next));
      setNote(`Sampled ${sw.length} colours from ${file.name}. The five biggest were applied as a first guess \u2014 click any swatch to put it on a different token.`);
    } catch {
      setMsg("That file could not be read as an image.");
    }
  }

  async function run() {
    const q = url.trim();
    if (!q || busy) return;
    setBusy(true); setMsg(null); setTokens(null); setNote(null); setProduct(null); setReadFrom(undefined); setShape(undefined);
    try {
      const r = await fetch("/api/brand-colours?url=" + encodeURIComponent(q));
      const d = await r.json();
      if (!d.ok) { setMsg(d.error || "That site could not be read."); return; }
      onTheme({
        ...toTheme(d.tokens, d.corners, d.cornersCustomPx, theme, d.cardRadiusPx ?? null, d.buttonRadiusPx ?? null),
        ...(d.shadow ? { chrome: { ...theme.chrome, shadow: d.shadow } } : {}),
        ...(d.ctaStyle ? { components: { ...theme.components, ctaButton: d.ctaStyle } } : {}),
      });
      setTokens(d.tokens);
      setReadFrom(Object.fromEntries((d.tokens as Token[]).map((t) => [t.key, { source: t.source, confidence: t.confidence }])));
      setShape({
        cardRadiusPx: d.cardRadiusPx ?? null, buttonRadiusPx: d.buttonRadiusPx ?? null,
        shadow: d.shadow ?? null, ctaStyle: d.ctaStyle ?? null, fontRead: Boolean(d.fontBody),
      });
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

      {/* The other way in. A URL read can only see what the server sent; a screenshot is
          what the merchant actually sees, which is the thing we were trying to infer. */}
      <div className="hc-bfshot">
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) readShot(f); e.target.value = ""; }} />
        <button type="button" className="hc-btn ghost" onClick={() => fileRef.current?.click()}>
          {shot ? "Read another screenshot" : "Read a screenshot instead"}
        </button>
        <span>
          Where a theme publishes nothing of its own, or paints its colours with JavaScript,
          the page as you see it is the only honest source. Read in this browser; the image
          is never uploaded.
        </span>
      </div>

      {shot && (
        <div className="hc-shotpal">
          <p className="hc-shotph">
            Colours in {shotName}<em>{shot.length}</em>
          </p>
          <p className="hc-bfp">
            Biggest area first. Pick the token each one belongs to &mdash; the picture knows
            its colours exactly and nothing about which is the button.
          </p>
          <div className="hc-shotrow">
            {shot.map((sw) => {
              /* Which tokens already hold this colour. Hovering told you by lighting rows up
                 a list away; saying it on the swatch answers it without moving the pointer,
                 and the hover still lights the rows for the reverse direction. */
              const holders = assigned.get(sw.hex.toUpperCase()) || [];
              return (
              <label key={sw.hex}
                className={"hc-shotsw" + (hover && sameHex(hover, sw.hex) ? " on" : "") + (holders.length ? " used" : "")}
                onMouseEnter={() => setHover(sw.hex)} onMouseLeave={() => setHover(null)}
                title={`${sw.hex} \u00b7 ${(sw.share * 100).toFixed(1)}% of the image`}>
                <i style={{ background: sw.hex }} />
                <b>{sw.hex}</b>
                <select defaultValue="" aria-label={`Use ${sw.hex} for`}
                  onChange={(e) => { if (e.target.value) { onTheme(setPath(theme, e.target.value, sw.hex)); e.target.value = ""; } }}>
                  <option value="">Use for…</option>
                  {ASSIGNABLE.map((a) => <option key={a.path} value={a.path}>{a.label}</option>)}
                </select>
                {holders.length > 0 && (
                  <span className="hc-shotuse" title={`In use for: ${holders.join(", ")}`}>
                    {holders[0]}{holders.length > 1 && <em>+{holders.length - 1}</em>}
                  </span>
                )}
              </label>
              );
            })}
          </div>
        </div>
      )}

      {msg && <p className="hc-bferr">{msg}</p>}

      {/* Every token this widget actually has, named the way `stackback-color-tokens` names
          it, in its sections and its order. The reader answers six of them; the widget on
          every pilot store today has nineteen plus the portal's five and two fonts, and
          showing six and calling it the token set is why this panel kept reading as wrong. */}
      <LiveTokens theme={theme} onTheme={onTheme} hover={hover} onHover={setHover} read={readFrom} font={font} shape={shape} storeName={storeName || url.trim() || null} />

      {tokens && (
        <>
          {/* The six flat tokens are the READING, and they are named for the new subscription
              widget's schema, which is not what the colour-token spec calls anything. Leading
              with them and hiding the spec's own twenty-seven behind a "Show" is why this
              panel kept reading as not matching the skill: the names on screen were from a
              different model. They are the provenance column of that table now. */}
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
function LiveTokens({ theme, onTheme, hover, onHover, read, font, shape, storeName }: {
  theme: WidgetTheme; onTheme: (t: WidgetTheme) => void;
  hover: string | null; onHover: (hex: string | null) => void;
  read?: ReadSources; font: string | null; shape?: ReadShape; storeName: string | null;
}) {
  /* Open. This is the token set, not an appendix to it. */
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const sections = canonicalTokens(theme, read, font, shape);
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
        <b>Widget tokens ({count})</b>
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
                  <div key={r.label}
                    className={hover && r.swatch && sameHex(hover, r.value) ? "on" : undefined}
                    onMouseEnter={() => r.swatch && onHover(r.value)}
                    onMouseLeave={() => onHover(null)}>
                    <dt>{r.label}</dt>
                    <dd>
                      {/* The swatch is the control. Every read on this panel is a reading of
                          somebody's site and some of them are wrong; correcting one should
                          not mean leaving for the theme editor and coming back. */}
                      {r.swatch && r.path && r.value !== "transparent" ? (
                        <input type="color" className="hc-tokpick" value={safeHex(r.value)}
                          aria-label={`${r.label} colour`} title={`${r.label} \u2014 click to change`}
                          onChange={(e) => onTheme(setPath(theme, r.path!, e.target.value.toUpperCase()))} />
                      ) : r.swatch ? (
                        <i className="hc-tokdot" data-transparent={r.value === "transparent" ? "1" : undefined} style={{ background: r.value }} />
                      ) : null}
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
