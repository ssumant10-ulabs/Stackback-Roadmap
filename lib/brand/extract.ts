/** Read a storefront's own theme settings and map them to StackBack's six brand tokens.
 *
 *  This does NOT sample pixels. Shopify's Dawn lineage, which is nearly every theme a pilot
 *  store runs, writes the merchant's theme-editor colour settings into a `:root` block and a
 *  `.color-scheme-N` block inside an inline <style> in the page HTML. So a plain server-side
 *  fetch of the homepage gets the merchant's ACTUAL configured palette, with no rendering, no
 *  headless browser and no proxy. Verified against thebasicswoman.com on 2026-09-21:
 *  --color-button 255,95,96 is the real Add-to-cart coral, --font-body-family is Poppins,
 *  --buttons-radius is 38px.
 *
 *  A non-Dawn theme falls back to counting hex literals in the CSS, which is weaker and is
 *  reported as such rather than presented with the same confidence.
 *
 *  Pure and network-free on purpose: the API route does the fetching, this does the reading,
 *  and the pilot-tracking screen and the merchant admin both call the same function. */

export type Confidence = "theme" | "derived" | "guessed";

export interface BrandToken {
  /** The StackBack field this fills, exactly as widget-templates.ts spells it. */
  key:
    | "Brand_Primary" | "Brand_Secondary" | "Brand_Accent"
    | "Product_Tile" | "Widget_Background" | "Product_Tile_Background";
  hex: string;
  /** What it was read from, in the merchant's words, for the "sampled from" chip. */
  source: string;
  confidence: Confidence;
}

export interface BrandResult {
  ok: boolean;
  url: string;
  /** "dawn" when the theme exposes Shopify colour-scheme variables, else "fallback". */
  method: "dawn" | "fallback";
  tokens: BrandToken[];
  /** Shape settings, read the same way. */
  corners: "Sharp" | "Semi" | "Rounded" | "Custom";
  cornersCustomPx: number | null;
  /** The CARD radius, which is what a widget's container and its plan cards are.
   *  `--buttons-radius` is the button and is a different number on most themes: thestack.club
   *  runs 40px pill buttons over 16px cards, and reading the button gave a widget shaped like
   *  nothing on the page. */
  cardRadiusPx: number | null;
  /** The BUTTON radius, for the subscribe button only. */
  buttonRadiusPx: number | null;
  fontBody: string | null;
  fontHeading: string | null;
  /** Every colour scheme found, so a caller can offer "use this one instead". */
  schemes: ThemeScheme[];
  notes: string[];
}

export interface ThemeScheme {
  id: string;
  background: string | null;
  foreground: string | null;
  button: string | null;
  buttonText: string | null;
}

/* ------------------------------------------------------------------ colour utils */

const HEX = /^#[0-9a-f]{6}$/i;

/** Shopify writes colours as a bare "r,g,b" triple so the theme can wrap them in rgba(). */
export function tripleToHex(v: string): string | null {
  const m = v.trim().match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (!m) return null;
  const p = [m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, parseInt(n, 10))));
  return "#" + p.map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function normaliseHex(v: string): string | null {
  const s = v.trim();
  if (HEX.test(s)) return s.toUpperCase();
  const short = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return ("#" + short[1] + short[1] + short[2] + short[2] + short[3] + short[3]).toUpperCase();
  const rgb = s.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const p = rgb[1].split(",").map((x) => parseFloat(x));
    if (p.length >= 3 && (p.length < 4 || p[3] >= 0.5)) {
      return "#" + p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    }
  }
  return tripleToHex(s);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** 0 for a grey, 1 for a fully saturated hue. Used to tell a brand colour from chrome. */
export function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

export function luminance(hex: string): number {
  const c = rgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Degrees on the colour wheel, so a pale pink can be recognised as a tint of a coral. */
export function hue(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Shortest distance between two hues, 0 to 180. */
export function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

const isNeutral = (hex: string) => saturation(hex) < 0.12;
const isLight = (hex: string) => luminance(hex) > 0.65;
/* A SURFACE has to be light AND near-neutral. Luminance alone calls #FFD812 light, because a
   saturated yellow is, and bluetea.co.in came back with its brand yellow offered as "a light
   surface used across the page". The preview then filled every panel with it. */
const isSurface = (hex: string) => isLight(hex) && saturation(hex) < 0.22;

/* ------------------------------------------------------------------ css reading */

/** Every `--name: value` pair inside the first block matching `selector`. */
function varsIn(css: string, selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(selector.source + "\\s*\\{([^}]*)\\}", selector.flags.replace("g", "") + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const body = m[m.length - 1];
    const dre = /--([\w-]+)\s*:\s*([^;]+);/g;
    let d: RegExpExecArray | null;
    while ((d = dre.exec(body))) {
      const k = "--" + d[1];
      if (!(k in out)) out[k] = d[2].trim();
    }
  }
  return out;
}

/** Dawn writes one block per colour scheme. Scheme 1 is the page default. */
export function readSchemes(css: string): ThemeScheme[] {
  const out: ThemeScheme[] = [];
  const re = /\.color-((?:scheme-)?[\w-]+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = re.exec(css))) {
    const id = m[1];
    if (seen.has(id)) continue;
    const body = m[2];
    const pick = (name: string) => {
      const d = body.match(new RegExp("--" + name + "\\s*:\\s*([^;]+);"));
      return d ? tripleToHex(d[1]) || normaliseHex(d[1]) : null;
    };
    const s: ThemeScheme = {
      id,
      background: pick("color-background"),
      foreground: pick("color-foreground"),
      button: pick("color-button"),
      buttonText: pick("color-button-text"),
    };
    if (s.background || s.button) { out.push(s); seen.add(id); }
    if (out.length >= 12) break;
  }
  return out;
}

/** Count hex literals in the CSS, heaviest first. The fallback when a theme is not Dawn. */
function countHexes(css: string): { hex: string; n: number }[] {
  const tally = new Map<string, number>();
  const re = /#[0-9a-f]{6}\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const h = m[0].toUpperCase();
    tally.set(h, (tally.get(h) || 0) + 1);
  }
  return [...tally.entries()].map(([hex, n]) => ({ hex, n })).sort((a, b) => b.n - a.n);
}

/* ------------------------------------------------------- element-grounded fallback

   A theme that does not publish Shopify's colour-scheme variables used to be read by counting
   hex literals, which is how satturmittaikadai.com came back with #6B7280 and #111827: Tailwind's
   grey-500 and grey-900, the most common colours in any utility stylesheet and the brand colour
   of nothing.

   The `stackback-color-tokens` skill says the same thing in one line: sample from a visible
   ELEMENT, never from the palette. So this reads declarations off the rules whose selectors name
   the elements the skill names, in the skill's own order: the canvas, the card interior, the CTA
   fill, the sale or announcement highlight, then the text colours. */

interface Rule { sel: string; decl: string }

/** Flatten the stylesheet into selector/declaration pairs, at-rules included. */
function rules(css: string): Rule[] {
  const out: Rule[] = [];
  const re = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    const sel = m[1].replace(/\s+/g, " ").trim().toLowerCase();
    if (!sel || sel.startsWith("@")) continue;
    out.push({ sel, decl: m[2] });
  }
  return out;
}

const prop = (decl: string, name: string): string | null => {
  const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;!]+)`, "i").exec(decl);
  return m ? m[1].trim() : null;
};

/** Expand `var(--x, fallback)` against the properties a theme declares on :root.
 *  A theme that paints its button `background: var(--g-cta-button)` is telling you the
 *  answer in the clearest way it can, and refusing to follow one hop threw it away. */
function expandVars(v: string, vars: Record<string, string>, depth = 0): string {
  if (depth > 4 || !v.includes("var(")) return v;
  const out = v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*(?:\([^()]*\)[^()]*)*))?\)/g,
    (_, name: string, fb: string | undefined) => (vars[name] ?? (fb ?? "")).trim());
  return out === v ? out : expandVars(out, vars, depth + 1);
}

/** A colour we can use: a hex or an rgb(), not transparent, inherit or an unresolved variable. */
function colourOf(v: string | null, vars?: Record<string, string>): string | null {
  if (!v) return null;
  let t = v.trim().toLowerCase();
  if (vars && t.includes("var(")) t = expandVars(t, vars).trim();
  if (!t || t.startsWith("var(") || t.startsWith("url(") || /transparent|inherit|currentcolor|none|initial/.test(t)) return null;
  const hex = /#[0-9a-f]{3,8}\b/i.exec(t);
  if (hex) return normaliseHex(hex[0]);
  const rgb = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?/i.exec(t);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) < 0.6) return null;   // a wash, not a surface
    const h = [rgb[1], rgb[2], rgb[3]].map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0")).join("");
    return "#" + h.toUpperCase();
  }
  return null;
}

/** Selector patterns for the elements the skill samples, most specific first. */
const ELEMENT: Record<string, RegExp[]> = {
  /* Only rules that NAME the call to action. A generic `button` or `.btn` rule is a reset or
     a disabled state and tells you nothing about the brand: satturmittaikadai.com gave #FFFFFF
     from one and #D5D5D5 from the next. No named CTA means no sample, not a worse one. */
  cta: [
    /add[-_]?to[-_]?cart|addtocart|product-form__submit|shopify-payment-button|buy[-_]?now/,
    /btn--primary|button--primary|btn-primary|\.primary-button|\.cta\b/,
  ],
  canvas: [/^body\b|^html\b|\.page-?(wrapper|container)\b|^main\b/],
  card: [/product-card|\.card__inner|\.card\b|\.tile\b|\.product-item\b/],
  accent: [/sale|discount|badge|announcement|promo|offer/],
  heading: [/^h1\b|\.product__title|\.product-title|\.h1\b/],
  body: [/^body\b|\.rte\b|^p\b/],
  muted: [/\.caption|\.meta\b|\.subtitle|\.text-muted|\.muted\b/],
};

/** First colour found for an element, walking its patterns in order of specificity.
 *
 *  `reject` is what stops a generic `button { background: #fff }` reset being read as the
 *  merchant's Add to cart fill. satturmittaikadai.com returned #FFFFFF as its brand colour
 *  from exactly that rule, and white is the one thing a CTA fill is never. */
function sample(
  rs: Rule[], kind: keyof typeof ELEMENT, which: "background-color" | "color",
  reject?: (hex: string) => boolean,
): string | null {
  for (const pat of ELEMENT[kind]) {
    for (const r of rs) {
      if (!pat.test(r.sel)) continue;
      const c = colourOf(prop(r.decl, which)) || (which === "background-color" ? colourOf(prop(r.decl, "background")) : null);
      if (c && !(reject && reject(c))) return c;
    }
  }
  return null;
}

/** A CTA fill is either a colour or near-black. A mid or light grey is a reset, a disabled
 *  state or a border, and never the thing a merchant chose. */
const notACta = (hex: string) => luminance(hex) > 0.88 || (isNeutral(hex) && luminance(hex) > 0.22);

/** Colours that ship with a CSS framework and belong to nobody. A stylesheet that still
 *  carries them has not been themed, so reporting one as "your brand colour" is the same
 *  mistake as reading Shopify's lock-screen green off a password-protected store. */
const FRAMEWORK_DEFAULTS = new Set([
  "#007BFF", "#0D6EFD", "#6C757D", "#28A745", "#DC3545",         // Bootstrap
  "#F8F9FA", "#E9ECEF", "#DEE2E6", "#CED4DA", "#ADB5BD", "#495057", "#343A40", "#212529",  // Bootstrap greys
  "#6B7280", "#111827", "#374151", "#3B82F6", "#9CA3AF",         // Tailwind
  "#F3F4F6", "#E5E7EB", "#D1D5DB", "#1F2937",                     // Tailwind greys
  "#2196F3", "#4CAF50", "#F44336", "#9E9E9E",                     // Material
]);
const isFrameworkDefault = (hex: string | null) => Boolean(hex && FRAMEWORK_DEFAULTS.has(hex.toUpperCase()));

/** `--buttons-radius: 38px` maps onto the four corner presets the widget offers. */
function cornersFrom(px: number | null): { corners: BrandResult["corners"]; custom: number | null } {
  if (px == null) return { corners: "Semi", custom: null };
  if (px <= 2) return { corners: "Sharp", custom: null };
  if (px <= 14) return { corners: "Semi", custom: null };
  if (px <= 22) return { corners: "Rounded", custom: null };
  // Anything rounder than the Rounded preset is a real merchant choice, so keep the number.
  return { corners: "Custom", custom: Math.round(px) };
}

/* ------------------------------------------------------------------ the mapping */

/**
 * Map a storefront's theme settings onto the six StackBack brand tokens.
 *
 * The rules, in the order they are applied:
 *   Brand_Primary          the default scheme's button colour. This is literally the fill of
 *                          the merchant's Add to cart button, so the widget CTA matches it.
 *   Product_Tile           the default scheme's foreground. Named Product_Tile in the schema
 *                          but titled "Body Text" and wired to --sb-text, so it is body copy.
 *   Widget_Background      the default scheme's background.
 *   Brand_Secondary        the lightest non-white scheme background, which is what Dawn uses
 *                          for its own tinted sections. Falls back to a light mix of primary.
 *   Brand_Accent           the most saturated colour across every scheme that is not already
 *                          the primary. A store with one brand colour gets primary back, and
 *                          that is reported rather than invented.
 *   Product_Tile_Background a light neutral scheme background, else white.
 */
export function mapTokens(css: string, url: string, html?: string): BrandResult {
  const notes: string[] = [];
  const root = varsIn(css, /:root/);
  const schemes = readSchemes(css);
  const dawn = schemes.length > 0 || "--color-button" in root;

  const fontBody = (root["--font-body-family"] || "").replace(/['"]/g, "").trim() || null;
  const fontHeading = (root["--font-heading-family"] || "").replace(/['"]/g, "").trim() || null;
  /* Dawn and its lineage set the document root to 62.5%, so 1rem is 10px there. The
     declaration lives in the theme's stylesheet, not the inline block we read, so it is
     inferred from the theme being Dawn rather than looked for: verified on thestack.club,
     whose computed root font-size is 10px and whose 1.6rem cards render at 16px. Reading
     rem at 16 recommended a 25.6px radius that nothing on the page uses. */
  const remBase = dawn ? 10 : 16;
  const px = (name: string): number | null => {
    const raw = root[name];
    if (!raw) return null;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) return null;
    return /rem\s*$/.test(raw.trim()) ? n * remBase : n;
  };
  const buttonRadiusPx = px("--buttons-radius");
  /* Cards first, in the order a widget most resembles: a product card, then a collection
     card, then the theme's text boxes. The button is the last resort and is usually wrong. */
  const cardRadiusPx =
    px("--product-card-corner-radius") ?? px("--collection-card-corner-radius")
    ?? px("--text-boxes-radius") ?? px("--media-radius") ?? buttonRadiusPx;
  const { corners, custom } = cornersFrom(cardRadiusPx);

  if (!dawn) {
    /* Not a Dawn-lineage theme. Read the elements the colour-tokens skill samples, in its
       order, and fall back to the palette only where an element is genuinely absent. */
    const rs = rules(css);
    const canvas = sample(rs, "canvas", "background-color");
    const card = sample(rs, "card", "background-color");
    /* The element first, the selector guess second. Finding the real button in the HTML and
       reading the rules that apply TO IT is the only thing that resolves a theme whose CTA
       is styled inline or by utility classes with no word like "cart" in them. */
    const ctaEl = html ? ctaFill(html, css) : null;
    const ctaBg = ctaEl?.hex ?? sample(rs, "cta", "background-color", notACta);
    const accent = sample(rs, "accent", "background-color", notACta);
    const heading = sample(rs, "heading", "color");
    const bodyText = sample(rs, "body", "color");
    const muted = sample(rs, "muted", "color");

    const top = countHexes(css);
    const anyBrand = top.filter((t) => !isNeutral(t.hex));
    const anySurface = top.filter((t) => isSurface(t.hex));

    const primary = ctaBg || anyBrand[0]?.hex || "#111111";
    const bg = card || anySurface[0]?.hex || "#FFFFFF";
    /* A Bootstrap grey is not a brand tint. If the canvas sample is one of the stock greys,
       a wash of the store's own primary is both honest and more useful than #DEE2E6. */
    const canvasOwn = canvas && !isFrameworkDefault(canvas) ? canvas : null;
    const tint = canvasOwn && canvasOwn.toUpperCase() !== bg.toUpperCase()
      ? canvasOwn
      : (anySurface.find((t) => t.hex.toUpperCase() !== bg.toUpperCase() && !isFrameworkDefault(t.hex))?.hex
        || mixToward(primary, "#FFFFFF", 0.9));
    const text = heading || bodyText || top.find((x) => luminance(x.hex) < 0.2)?.hex || "#121212";
    /* The theme's own named sale colour first: a setting beats a sample, and a sample of the
       most saturated hex in a Bootstrap-carrying stylesheet is Bootstrap's #007BFF. */
    const accVar = themeAccent(css);
    const acc = accVar && accVar.hex.toUpperCase() !== primary.toUpperCase()
      ? accVar.hex
      : accent && accent.toUpperCase() !== primary.toUpperCase()
      ? accent
      : (anyBrand.find((t) => t.hex.toUpperCase() !== primary.toUpperCase())?.hex || primary);

    const framework = [primary, acc, text].filter(isFrameworkDefault);
    if (framework.length) {
      notes.push(
        `${framework.join(" and ")} ${framework.length === 1 ? "is a stock CSS framework colour" : "are stock CSS framework colours"}, ` +
        "not something anybody chose for this brand. The theme is probably carrying an " +
        "unstyled Bootstrap or Tailwind default, so set that one by hand.",
      );
    }
    if (html && !ctaEl) {
      notes.push(
        "We found no Add to cart button on the page we read, so the button colour below comes " +
        "from a rule that looks like a call to action rather than from the button itself. " +
        "Check it against your product page.",
      );
    }
    const sampled = [ctaBg, canvas, card, accent, heading].filter(Boolean).length;
    notes.push(
      sampled >= 3
        ? "This theme does not publish Shopify colour settings, so these are read off the elements themselves: your Add to cart button, your page canvas, a product card and your headings. Check them before saving."
        : "This theme does not publish Shopify colour settings, and few of the usual elements could be identified in its stylesheet, so some of these are the most common colours in it rather than a sample. Check every one before saving.",
    );
    const conf = (hit: string | null, val?: string): Confidence =>
      isFrameworkDefault(val ?? hit) ? "guessed" : hit ? "theme" : "guessed";
    const t = (key: BrandToken["key"], hex: string, source: string, c: Confidence): BrandToken =>
      ({ key, hex: hex.toUpperCase(), source, confidence: c });
    return {
      ok: true, url, method: "fallback",
      tokens: [
        t("Brand_Primary", primary,
          isFrameworkDefault(primary) ? "a framework default, not a brand colour"
            : ctaEl ? ctaEl.source
            : ctaBg ? "your Add to cart button"
            : "most used brand colour in the stylesheet",
          isFrameworkDefault(primary) ? "guessed" : ctaEl ? ctaEl.confidence : conf(ctaBg, primary)),
        t("Brand_Secondary", tint,
          canvasOwn && tint === canvasOwn ? "your page canvas"
            : tint === mixToward(primary, "#FFFFFF", 0.9) ? "a light wash of your button colour"
            : "a light surface in the stylesheet",
          canvasOwn && tint === canvasOwn ? "theme" : "derived"),
        t("Brand_Accent", acc,
          isFrameworkDefault(acc) ? "a framework default, not a brand colour"
            : accVar && acc === accVar.hex ? `your theme's ${accVar.name} setting`
            : accent ? "your sale or announcement highlight"
            : "second brand colour in the stylesheet",
          isFrameworkDefault(acc) ? "guessed" : accVar && acc === accVar.hex ? "theme" : conf(accent, acc)),
        t("Product_Tile", text, heading ? "your heading colour" : bodyText ? "your body text colour" : "darkest text colour", conf(heading || bodyText)),
        t("Widget_Background", bg, card ? "your product card interior" : "most used light surface", conf(card)),
        t("Product_Tile_Background", card || "#FFFFFF", card ? "your product card interior" : "assumed white card", conf(card)),
      ],
      corners, cornersCustomPx: custom, cardRadiusPx, buttonRadiusPx, fontBody, fontHeading, schemes, notes,
    };
  }

  // Scheme 1 is Dawn's page default. Fall back to the first scheme that carries a button.
  const base = schemes.find((s) => s.id === "scheme-1")
    || schemes.find((s) => s.button && s.background)
    || schemes[0];

  const primary = base?.button || tripleToHex(root["--color-button"] || "") || "#111111";
  const text = base?.foreground || tripleToHex(root["--color-foreground"] || "") || "#121212";
  const bg = base?.background || tripleToHex(root["--color-background"] || "") || "#FFFFFF";

  // Every colour the theme knows about, counted. How OFTEN a theme reaches for a colour is a
  // better signal than how saturated it is: thebasicswoman.com carries a blue in one scheme of
  // eleven and its coral in four, and ranking on saturation alone handed back the blue.
  const tally = new Map<string, { n: number; asButton: boolean }>();
  for (const s of schemes) {
    for (const [role, h] of [["bg", s.background], ["btn", s.button], ["fg", s.foreground]] as const) {
      if (!h) continue;
      const k = h.toUpperCase();
      const e = tally.get(k) || { n: 0, asButton: false };
      e.n += 1;
      if (role === "btn") e.asButton = true;
      tally.set(k, e);
    }
  }
  const uses = (h: string) => tally.get(h.toUpperCase())?.n ?? 0;
  const isButton = (h: string) => tally.get(h.toUpperCase())?.asButton ?? false;
  const palette = [...tally.keys()];

  // The selected-card fill wants a light surface that belongs to the brand, not any pale grey.
  // Closest hue to the button colour wins, so a coral store gets its blush and not its cream.
  const tinted = palette
    .filter((h) => isLight(h) && h !== "#FFFFFF" && h.toUpperCase() !== bg.toUpperCase())
    .sort((a, b) => (hueGap(a, primary) - hueGap(b, primary)) || (saturation(b) - saturation(a)));
  const secondary = tinted[0] || mixToward(primary, "#FFFFFF", 0.86);
  if (!tinted[0]) {
    notes.push("No tinted section colour in the theme, so the selected-card fill is a light mix of your button colour.");
  }

  // A second brand colour has to be one the theme actually leans on: used in more than one
  // scheme, or used as a button somewhere. A single decorative section does not qualify.
  const saturated = palette
    .filter((h) => !isNeutral(h) && h.toUpperCase() !== primary.toUpperCase())
    .filter((h) => uses(h) > 1 || isButton(h))
    .sort((a, b) => (uses(b) - uses(a)) || (saturation(b) - saturation(a)));
  const accent = saturated[0] || primary;
  if (!saturated[0]) {
    notes.push("Your theme uses a single brand colour, so deals and offers reuse it. Pick a different accent if you want offers to stand out.");
  }

  const tileBg = palette.find((h) => isLight(h) && h.toUpperCase() !== bg.toUpperCase() && isNeutral(h)) || "#FFFFFF";

  const tk = (key: BrandToken["key"], hex: string, source: string, confidence: Confidence): BrandToken =>
    ({ key, hex: hex.toUpperCase(), source, confidence });

  return {
    ok: true, url, method: "dawn",
    tokens: [
      tk("Brand_Primary", primary, "your Add to cart button", "theme"),
      tk("Brand_Secondary", secondary, tinted[0] ? "your tinted section background" : "lightened from your button colour", tinted[0] ? "theme" : "derived"),
      tk("Brand_Accent", accent, saturated[0] ? "your second brand colour" : "same as your button colour", saturated[0] ? "theme" : "derived"),
      tk("Product_Tile", text, "your body text colour", "theme"),
      tk("Widget_Background", bg, "your page background", "theme"),
      tk("Product_Tile_Background", tileBg, tileBg === "#FFFFFF" ? "white card surface" : "your card background", tileBg === "#FFFFFF" ? "derived" : "theme"),
    ],
    corners, cornersCustomPx: custom, cardRadiusPx, buttonRadiusPx, fontBody, fontHeading, schemes, notes,
  };
}

function mixToward(hex: string, towards: string, t: number): string {
  const A = rgb(hex), B = rgb(towards);
  return "#" + [0, 1, 2]
    .map((i) => Math.round(A[i] * (1 - t) + B[i] * t).toString(16).padStart(2, "0"))
    .join("").toUpperCase();
}

/** Pull every inline <style> plus any same-host stylesheet href out of a page's HTML. */
export function inlineCss(html: string): string {
  const out: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out.join("\n");
}

/** A store that is still password-protected serves Shopify's own lock screen, whose palette is
 *  Shopify's and not the merchant's. Reading it returns a confident green that belongs to
 *  nobody, which is worse than returning nothing, and it happens at exactly the moment a new
 *  merchant is onboarding. Checked before any colour is mapped. */
export function looksPasswordProtected(html: string): boolean {
  const head = html.slice(0, 60_000);
  return /<body[^>]*class=["'][^"']*\bpassword\b/i.test(head)
    || /name=["']password["'][^>]*>/i.test(head) && /Enter (?:using|store using) password|Opening soon|store is password protected/i.test(head)
    || /shopify\.com\/password|\/password["']/i.test(head) && /Opening soon|coming soon/i.test(head);
}

export function stylesheetHrefs(html: string, base: string): string[] {
  const out: string[] = [];
  const re = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = (m[0].match(/href=["']([^"']+)["']/) || [])[1];
    if (!href) continue;
    try { out.push(new URL(href, base).toString()); } catch { /* skip a malformed href */ }
  }
  return out.slice(0, 4);
}

/* ------------------------------------------------------ the CTA, off the element itself */

/** What a page's real Add to cart button is made of, read from the HTML rather than guessed
 *  from a selector name.
 *
 *  The selector patterns above are a good guess and they have a floor: a theme whose button
 *  is styled inline, or by utility classes with no word like "cart" in them, is invisible to
 *  a stylesheet read. `stackback-color-tokens` says to fall back to a rendered screenshot for
 *  those, and there is no headless browser on this runtime. There does not need to be. The
 *  button is in the HTML with its own class list and its own style attribute, so finding the
 *  element first turns "which rule looks like a CTA" into "which rules apply to THIS
 *  element", which is the question that has a right answer. */
export interface CtaElement {
  tag: string;
  id: string | null;
  classes: string[];
  /** The element's own style attribute, which no stylesheet read can see. */
  style: string | null;
  /** What identified it, for the note the merchant reads. */
  via: string;
}

/** Shopify's product form submit, then the payment button, then anything whose text says it.
 *  Ordered: the form submit is the merchant's themed button, the Shop Pay button is
 *  Shopify's and is the same on every store. */
const CTA_MARKERS: [RegExp, string][] = [
  [/\bname=["']add["']/i, "the product form's submit button"],
  [/\b(?:class|id)=["'][^"']*product-form__submit/i, "the product form's submit button"],
  [/\b(?:class|id)=["'][^"']*\badd-to-cart\b/i, "the Add to cart button"],
  [/\bdata-(?:testid|action)=["'][^"']*add-to-cart/i, "the Add to cart button"],
];

const attr = (tagText: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}=["']([^"']*)["']`, "i").exec(tagText);
  return m ? m[1] : null;
};

/** Every <button>/<input>/<a> opening tag, with the text that follows it up to its close. */
function* controls(html: string): Generator<{ tagText: string; tag: string; text: string }> {
  const re = /<(button|input|a)\b([^>]*)>([\s\S]{0,200}?)(?:<\/\1>|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    yield { tagText: "<" + m[1] + m[2] + ">", tag: m[1].toLowerCase(), text: m[3].replace(/<[^>]+>/g, " ") };
  }
}

export function findCta(html: string): CtaElement | null {
  const body = html.slice(0, 900_000);
  const found: { c: CtaElement; rank: number }[] = [];

  for (const { tagText, tag, text } of controls(body)) {
    let rank = -1;
    let via = "";
    for (let i = 0; i < CTA_MARKERS.length; i++) {
      if (CTA_MARKERS[i][0].test(tagText)) { rank = i; via = CTA_MARKERS[i][1]; break; }
    }
    /* Last resort, and only on a real button: the visible words. Ranked below the markers
       because "Add to cart" also appears on a quick-add tile and in a drawer. */
    if (rank < 0 && /^(button|input)$/.test(tag) && /\badd to (cart|bag)\b|\bbuy now\b|\bsubscribe\b/i.test(text + " " + (attr(tagText, "value") || ""))) {
      rank = CTA_MARKERS.length; via = "the button that says Add to cart";
    }
    if (rank < 0) continue;
    // Shopify's own accelerated-checkout button is Shopify's colour, never the merchant's.
    if (/shopify-payment-button|shop-pay|dynamic-checkout/i.test(tagText)) continue;
    found.push({
      rank,
      c: {
        tag, via,
        id: attr(tagText, "id"),
        classes: (attr(tagText, "class") || "").split(/\s+/).filter(Boolean),
        style: attr(tagText, "style"),
      },
    });
  }
  if (!found.length) return null;
  found.sort((a, b) => a.rank - b.rank);
  return found[0].c;
}

/** Does this selector target the element we found?
 *
 *  Only SINGLE compounds: `.btn-theme`, `button.add`, `#AddToCart`. A descendant selector
 *  names ancestors, and all we hold is the button's own tag, id and classes, so we cannot
 *  tell whether they apply. Checking only its last part is how
 *  `.product-card--style9 .product-card-cart .btn-theme` came back as satturmittaikadai's
 *  Add to cart colour: a rule for a product card in a style the page does not use, matched
 *  because the button happened to carry `.btn-theme` too. The answer it produced looked
 *  entirely plausible, which is why this is a refusal and not a lower score. */
function selectorHits(sel: string, cta: CtaElement): { hit: boolean; spec: number } {
  let best = -1;
  for (const part of sel.split(",")) {
    const one = part.trim();
    if (!one || /[\s>+~]/.test(one.replace(/\([^)]*\)/g, ""))) continue;   // has a combinator
    const last = one;
    // Strip pseudo states. :hover and :disabled are not the resting colour.
    if (/:(hover|focus|active|disabled|visited|before|after)/.test(last)) continue;
    const bare = last.replace(/::?[a-z-]+(\([^)]*\))?/g, "");
    const pieces = bare.match(/^[a-z][a-z0-9]*|[.#][^.#\[]+|\[[^\]]+\]/g);
    if (!pieces || !pieces.length) continue;
    let all = true;
    let spec = 0;
    for (const piece of pieces) {
      if (piece.startsWith(".")) { if (!cta.classes.includes(piece.slice(1))) { all = false; break; } spec += 10; }
      else if (piece.startsWith("#")) { if (cta.id !== piece.slice(1)) { all = false; break; } spec += 100; }
      else if (piece.startsWith("[")) { all = false; break; }   // attribute selectors: not resolved
      else if (piece !== cta.tag) { all = false; break; } else spec += 1;
    }
    if (all && spec > best) best = spec;
  }
  return { hit: best >= 0, spec: best };
}

/** The CTA fill, read off the element. Inline style first, because it beats every stylesheet
 *  and is the case a selector read cannot see at all. Then the rules that actually apply. */
/** Custom properties whose NAME says they are the call to action, in the order a theme
 *  means them. A theme that writes `--g-cta-button: #000000` on :root has configured its
 *  button colour as plainly as Dawn writes `--color-button`, and the only reason the old
 *  read missed it is that it was looking for selectors rather than for settings. */
const CTA_VAR = [
  /^--[\w-]*cta[\w-]*(button|btn|bg|background)?$/,
  /^--[\w-]*(button|btn)[\w-]*(bg|background|color)?$/,
  /^--[\w-]*(primary|brand|main|accent)[\w-]*$/,
];

/** A theme's own named setting for the sale or highlight colour. Same evidence class as the
 *  CTA one: `--g-label-sale: #ffa800` is a decision somebody made, and it beats the most
 *  saturated hex in a stylesheet, which on a Bootstrap-carrying theme is Bootstrap's blue. */
const ACCENT_VAR = [
  /^--[\w-]*(sale|offer|promo|deal|discount)[\w-]*$/,
  /^--[\w-]*(accent|highlight|secondary)[\w-]*$/,
];

function namedVar(
  vars: Record<string, string>, pats: RegExp[], reject: (hex: string) => boolean,
): { hex: string; name: string } | null {
  for (const pat of pats) {
    for (const [name, raw] of Object.entries(vars)) {
      if (!pat.test(name)) continue;
      if (/text|ink|fg|foreground|hover|border|radius|size|width|font|shadow|gap|space/.test(name)) continue;
      const hex = colourOf(raw, vars);
      if (hex && !reject(hex)) return { hex, name };
    }
  }
  return null;
}

const namedCtaVar = (vars: Record<string, string>) => namedVar(vars, CTA_VAR, notACta);

/** The theme's declared accent, for the fallback path. Exported because `mapTokens` reads it
 *  beside the element samples rather than after them. */
export function themeAccent(css: string): { hex: string; name: string } | null {
  return namedVar(varsIn(css, /:root/), ACCENT_VAR, (hex) => isNeutral(hex) || isFrameworkDefault(hex));
}

export function ctaFill(html: string, css: string): { hex: string; source: string; confidence: Confidence } | null {
  const vars = varsIn(css, /:root/);
  const cta = findCta(html);

  if (cta?.style) {
    const inline = colourOf(prop(cta.style, "background-color"), vars) || colourOf(prop(cta.style, "background"), vars);
    if (inline && !notACta(inline)) {
      return { hex: inline, source: `${cta.via}, styled on the element`, confidence: "theme" };
    }
  }

  if (cta) {
    /* The cascade, as far as it can honestly be resolved here: !important first, then
       specificity, then source order. Taking the last applicable rule was wrong, and wrong
       in the direction that produces a confident answer. */
    let win: { hex: string; rank: number } | null = null;
    rules(css).forEach((r, i) => {
      const { hit, spec } = selectorHits(r.sel, cta);
      if (!hit) return;
      const decl = r.decl;
      const raw = prop(decl, "background-color") ?? prop(decl, "background");
      const hex = colourOf(raw, vars);
      if (!hex || notACta(hex)) return;
      const important = /background(-color)?\s*:[^;]*!\s*important/i.test(decl) ? 100000 : 0;
      const rank = important + spec * 1000 + i;
      if (!win || rank > win.rank) win = { hex, rank };
    });
    if (win) {
      const hex = (win as { hex: string }).hex;
      return { hex, source: cta.via, confidence: isFrameworkDefault(hex) ? "guessed" : "theme" };
    }
  }

  /* No rule we can stand behind applies to the button. The theme's own named setting is the
     next best thing and is a setting, not a sample: same class of evidence as Dawn's. */
  const named = namedCtaVar(vars);
  if (named) {
    return {
      hex: named.hex,
      source: `your theme's ${named.name} setting`,
      confidence: isFrameworkDefault(named.hex) ? "guessed" : "theme",
    };
  }
  return null;
}
