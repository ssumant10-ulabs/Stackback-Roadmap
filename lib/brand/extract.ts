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
export function mapTokens(css: string, url: string): BrandResult {
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
    // Not a Dawn-lineage theme. Rank hex literals and take the best guesses available.
    const top = countHexes(css);
    const brand = top.filter((t) => !isNeutral(t.hex)).slice(0, 4);
    const lights = top.filter((t) => isLight(t.hex)).slice(0, 4);
    notes.push(
      "This theme does not expose Shopify colour-scheme variables, so these are read from how often each colour appears in the stylesheet rather than from the theme settings. Check them before saving.",
    );
    const t = (key: BrandToken["key"], hex: string, source: string): BrandToken =>
      ({ key, hex, source, confidence: "guessed" });
    return {
      ok: true, url, method: "fallback",
      tokens: [
        t("Brand_Primary", brand[0]?.hex || "#111111", "most used brand colour in the stylesheet"),
        t("Brand_Secondary", lights[1]?.hex || "#F3F3F3", "a light surface used across the page"),
        t("Brand_Accent", brand[1]?.hex || brand[0]?.hex || "#111111", "second brand colour in the stylesheet"),
        t("Product_Tile", top.find((x) => luminance(x.hex) < 0.2)?.hex || "#121212", "darkest text colour"),
        t("Widget_Background", lights[0]?.hex || "#FFFFFF", "most used light surface"),
        t("Product_Tile_Background", "#FFFFFF", "assumed white card"),
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
