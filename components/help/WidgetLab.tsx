"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { readUpload, saveUpload } from "@/lib/help/labstore";

/** Widget lab: every StackBack storefront widget, placed on a real product form, in the
 *  store's colours, with a link that shows exactly that to anybody.
 *
 *  The widgets are the same renderer the stackback-widget-preview skill uses (copied to
 *  public/widget-lab/sbw), so what a merchant sees here is what a mock of their own page shows.
 *  The page they sit on is a neutral sample product page: it belongs to no brand, which is
 *  what makes it safe to share as a link. Settings travel in the link itself, so nothing is
 *  stored and a link never changes after it is copied. */

type WidgetType =
  | "purchase-options" | "subscription-dropdown" | "subscription-grid" | "subscription-list" | "subscription-collapsible"
  | "single-plan" | "multi-delivery" | "multi-frequency" | "payg-only" | "prepaid-only" | "international-plan"
  | "fixed-bundle" | "byob" | "bxgy-list" | "bxgy-grid" | "addon-1" | "addon-2" | "addon-3";

const GROUPS: { title: string; items: { id: WidgetType; name: string; hint: string }[] }[] = [
  { title: "Subscription", items: [
    { id: "purchase-options", name: "Purchase Options", hint: "The live default. Payment type first, then plan" },
    { id: "subscription-dropdown", name: "Subscription Dropdown", hint: "Most compact. Frequency and length in dropdowns" },
    { id: "subscription-grid", name: "Subscription Grid", hint: "Plans as tiles, side by side" },
    { id: "subscription-list", name: "Subscription List", hint: "Plans as rows" },
    { id: "subscription-collapsible", name: "Subscription Collapsible", hint: "Closed until the shopper opens it" },
    { id: "single-plan", name: "Single Plan", hint: "One plan, one card per payment type" },
    { id: "multi-delivery", name: "Multi-Delivery", hint: "Same frequency, pick how many deliveries" },
    { id: "multi-frequency", name: "Multi-Frequency", hint: "Same length, pick how often" },
    { id: "payg-only", name: "Pay per delivery only", hint: "For stores running AutoPay alone" },
    { id: "prepaid-only", name: "Prepaid only", hint: "Upfront total, for prepaid-only stores" },
    { id: "international-plan", name: "International", hint: "Supplies priced in another currency" },
  ] },
  { title: "Bundles", items: [
    { id: "fixed-bundle", name: "Fixed Bundle", hint: "Sets you choose" },
    { id: "byob", name: "Build Your Own Box", hint: "Shopper picks, discount grows" },
    { id: "bxgy-list", name: "Buy X Get Y, list", hint: "Offer as rows" },
    { id: "bxgy-grid", name: "Buy X Get Y, grid", hint: "Offer as tiles" },
  ] },
  { title: "Add-ons", items: [
    { id: "addon-1", name: "Add-On, carousel", hint: "Add-ons in a scrolling row" },
    { id: "addon-2", name: "Add-On, single carousel", hint: "One add-on at a time" },
    { id: "addon-3", name: "Add-On, list", hint: "Add-ons as a list" },
  ] },
];

const ALL = GROUPS.flatMap((g) => g.items);

type Colours = { primary: string; secondary: string; accent: string; tileText: string; tile: string; bg: string; line: string };
type ColourKey = keyof Colours | "onPrimary" | "ok" | "mute" | "chrome";
/** The admin's Widget Theme settings, as far as the preview can draw them. Colours are the
 *  seven core tokens plus the optional ones; the rest is shape, frame and font. */
type Tokens = Colours & Partial<{
  onPrimary: string; ok: string; okBg: string; mute: string; chrome: string;
  radius: number; font: string; shadow: "none" | "subtle" | "strong"; outer: boolean;
}>;

/** Grouped and named the way the admin's Widget Theme screen is, with the default each
 *  optional colour falls back to when it is not set. */
const SETTING_GROUPS: { title: string; fields: { k: ColourKey; name: string; hint: string; def?: string }[] }[] = [
  { title: "Brand colours", fields: [
    { k: "primary", name: "Primary", hint: "Buttons, bars, selected outline" },
    { k: "onPrimary", name: "Text on primary", hint: "Button and bar text", def: "#ffffff" },
    { k: "accent", name: "Subscription accent", hint: "Offer text and badges" },
    { k: "ok", name: "Savings colour", hint: "Savings lines and ticks", def: "#2e7d32" },
  ] },
  { title: "Text colours", fields: [
    { k: "tileText", name: "Primary text", hint: "Titles and prices" },
    { k: "mute", name: "Secondary text", hint: "Sub-labels and hints", def: "#6b6b6b" },
  ] },
  { title: "Surfaces", fields: [
    { k: "bg", name: "Widget background", hint: "Behind the whole widget" },
    { k: "tile", name: "Tile background", hint: "Cards and inputs" },
    { k: "secondary", name: "Selected fill", hint: "Background of the picked option" },
  ] },
  { title: "Borders", fields: [
    { k: "line", name: "Default border", hint: "Strokes. #968a74 or darker reads best" },
  ] },
];

const FONTS = ["Inter", "Kumbh Sans", "Roboto", "Poppins", "Open Sans", "Lato", "Montserrat"];

/** a moved toward b by t (0..1), for tints that follow a colour. */
function mix(a: string, b: string, t: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, "0")).join("");
}

const PRESETS: { name: string; t: Colours }[] = [
  { name: "StackBack", t: { primary: "#2a431c", secondary: "#d7f5d1", accent: "#f5b400", tileText: "#282828", tile: "#fcfaf8", bg: "#ffffff", line: "#968a74" } },
  { name: "Ink", t: { primary: "#111111", secondary: "#ededed", accent: "#c8102e", tileText: "#111111", tile: "#ffffff", bg: "#ffffff", line: "#8a8a8a" } },
  { name: "Berry", t: { primary: "#7a1f4b", secondary: "#f7e1ec", accent: "#e8a33d", tileText: "#2b1320", tile: "#fffafc", bg: "#ffffff", line: "#9a7a88" } },
  { name: "Ocean", t: { primary: "#0b4f6c", secondary: "#dff1f7", accent: "#ff8a3d", tileText: "#10242c", tile: "#f8fcfd", bg: "#ffffff", line: "#7b939c" } },
];

/* Pay per delivery IS AutoPay (charged automatically each delivery). Pay by link is no
   longer offered, so the lab shows only the two payment types a store should run. */
const PAY: { id: "prepaid" | "ppd"; name: string }[] = [
  { id: "prepaid", name: "Prepaid" },
  { id: "ppd", name: "Pay per delivery (AutoPay)" },
];

/** Where the product page under the widget comes from. `u`: a merchant's product link, fetched
 *  by the server. `up`: a saved page uploaded in this tab (a timestamp, so a new file reloads). */
type Source = { u?: string; up?: number; name?: string };

interface LabState {
  src?: Source;
  /** % off by number of deliveries. Used by the Subscription Dropdown, where the discount
   *  belongs to HOW MANY rather than HOW OFTEN. */
  co: { "3": number; "6": number; "12": number };
  /** Advanced: place the widget next to this element of the merchant's page instead. */
  sel?: string;
  /** Advanced: CSS for theme quirks, sent with the link. */
  css?: string;
  w: WidgetType;
  t: Tokens;
  pm: string[];
  d: { "2w": number; "1m": number; "2m": number };
  pos: "above" | "below" | "variants";
  def: "otp" | "sub";
  p: { title: string; price: number; compare: number };
  /** Widget settings beyond the theme, by the admin's own names. Absent = the defaults. */
  ws?: WidgetOpts;
}

interface WidgetOpts {
  cta?: "solid" | "outline";
  badge?: "filled" | "outline" | "minimal";
  selected?: "border-and-fill" | "border-only";
  promo?: string;
  /** The tag on the best plan; "" hides it. */
  badgeText?: string;
  freebies?: boolean;
  noOneTime?: boolean;
  noHow?: boolean;
  noShipLine?: boolean;
  noBrand?: boolean;
  /** Font size, % of the default. */
  fontScale?: number;
}

/** The component-style lines of the stackback-color-tokens copy block. */
function parseOpts(text: string): WidgetOpts {
  const out: WidgetOpts = {};
  for (const line of text.split(/\n/)) {
    const m = line.match(/^\s*([a-z ]+?)\s*[:=]\s*([a-z-]+)\s*$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].toLowerCase();
    if (k === "cta button style" && (v === "solid" || v === "outline")) out.cta = v;
    if (k === "discount badge style") out.badge = v === "pill-outline" || v === "outline" ? "outline" : v === "minimal" ? "minimal" : "filled";
    if (k === "selected card state" && (v === "border-only" || v === "border-and-fill")) out.selected = v;
  }
  return out;
}

const DEFAULT: LabState = {
  w: "purchase-options",
  t: PRESETS[0].t,
  pm: ["prepaid", "ppd"],
  d: { "2w": 5, "1m": 10, "2m": 15 },
  co: { "3": 5, "6": 10, "12": 15 },
  pos: "above",
  def: "otp",
  p: { title: "Daily Greens Superfood Powder", price: 899, compare: 1099 },
};

/** UTF-8 safe base64url, so a product name in any script survives the link. */
function encode(s: LabState): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(c: string): Partial<LabState> | null {
  try {
    let b = c.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const bin = atob(b);
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
  } catch { return null; }
}

const HEX = /^#[0-9a-f]{6}$/i;
const MOBILE_SCALE = 0.82;

/** Pulls `name: #hex` pairs out of whatever was pasted: the stackback-color-tokens output, a
 *  settings screenshot transcribed by hand, a JSON block. Unknown names are ignored. */
function parseTokens(text: string): Partial<Tokens> {
  const alias: Record<string, ColourKey> = {
    primary: "primary", secondary: "secondary", selected: "secondary", "selected fill": "secondary", accent: "accent",
    tiletext: "tileText", "tile text": "tileText", text: "tileText", tile: "tile", "tile background": "tile",
    bg: "bg", background: "bg", line: "line", border: "line", stroke: "line",
    "brand primary": "primary", "primary brand": "primary", "subscription accent": "accent", "savings": "ok",
    "primary text": "tileText", "secondary text": "mute", "muted text": "mute", "widget background": "bg",
    "input background": "tile", "default border": "line", "border color": "chrome", "primary button text": "onPrimary",
  };
  const out: Partial<Tokens> = {};
  for (const m of text.matchAll(/["']?([a-z][a-z ]{1,24}?)["']?\s*[:=]\s*["']?(#[0-9a-f]{6})\b/gi)) {
    const k = alias[m[1].trim().toLowerCase().replace(/\s+color$/, "")];
    if (k) out[k] = m[2].toLowerCase();
  }
  const r = text.match(/corner radius[^0-9]{0,6}(\d{1,2})/i);
  if (r) out.radius = Math.min(32, +r[1]);
  const f = text.match(/(?:body )?font\s*[:=]\s*["']?([A-Za-z ]+?)["']?\s*$/im);
  if (f && FONTS.includes(f[1].trim())) out.font = f[1].trim();
  const sh = text.match(/shadow\s*[:=]\s*(none|subtle|strong)/i);
  if (sh) out.shadow = sh[1].toLowerCase() as Tokens["shadow"];
  const ob = text.match(/outer border\s*[:=]\s*(true|false)/i);
  if (ob) out.outer = ob[1].toLowerCase() === "true";
  if (out.ok) out.okBg = mix(out.ok, "#ffffff", 0.88);
  return out;
}

/** Relative luminance contrast, for the one check a colour picker cannot do by eye. */
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  if (!HEX.test(a) || !HEX.test(b)) return 21;
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

interface PdpStatus {
  ok: boolean; error?: string; title?: string; variants?: number; price?: number; currency?: string; buy?: boolean;
  partial?: boolean; live?: number; url?: string;
  /** Widget settings read from the merchant's own page, by the stackback-color-tokens rules. */
  brand?: Partial<Tokens>; font?: string;
}

/** The colour reader's field names, mapped onto the widget's seven tokens. */
const BRAND_KEY: Record<string, keyof Colours> = {
  Brand_Primary: "primary", Brand_Secondary: "secondary", Brand_Accent: "accent",
  Product_Tile: "tileText", Product_Tile_Background: "tile", Widget_Background: "bg",
};

interface Fit { h: number; top: number; ctaBottom: number | null; overflow: number; vw: number; vh: number; subscribed: boolean }

export default function WidgetLab() {
  const [s, setS] = useState<LabState>(DEFAULT);
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [paste, setPaste] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [fit, setFit] = useState<Fit | null>(null);
  const [scale, setScale] = useState(1);
  const [pdp, setPdp] = useState<PdpStatus | null>(null);
  const [linkIn, setLinkIn] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pane, setPane] = useState<"setup" | "plan" | "theme" | "settings">("setup");
  const stage = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  /* A lab link opens the lab on those settings: #/widgets/<c>. */
  useEffect(() => {
    const m = window.location.hash.match(/^#\/widgets\/([A-Za-z0-9_-]+)/);
    const got = m && decode(m[1]);
    if (got) {
      setS({ ...DEFAULT, ...got, t: { ...DEFAULT.t, ...(got.t || {}) }, d: { ...DEFAULT.d, ...(got.d || {}) },
        co: { ...DEFAULT.co, ...(got.co || {}) }, p: { ...DEFAULT.p, ...(got.p || {}) } });
      if (got.src?.u) setLinkIn(got.src.u);
    }
  }, []);

  const code = useMemo(() => encode(s), [s]);
  /* The frame reloads on every change, so it follows the settings a beat behind the typing. */
  const [frameCode, setFrameCode] = useState(code);
  useEffect(() => { const t = setTimeout(() => setFrameCode(code), 280); return () => clearTimeout(t); }, [code]);
  useEffect(() => { setFit(null); }, [frameCode, view]);
  const srcKey = JSON.stringify(s.src || null);
  useEffect(() => { setPdp(null); }, [srcKey]);
  /* The page the reader just brought in, whose colours apply as soon as it is read. Only a
     fresh upload or link sets it: a shared lab link carries its own colours, and a frame
     reload after a manual tweak must not put the page's back. */
  const autoFor = useRef<string | null>(null);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data?.sbwLab) return;
      if (e.data.kind === "pdp") setPdp(e.data as PdpStatus);
      else setFit(e.data as Fit);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  /* The desktop page is drawn at 1280 wide and scaled to the column, so it is the real
     two-column layout and not a squeezed one. */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (el.clientWidth > 0) setScale(Math.min(1, el.clientWidth / 1280)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const set = <K extends keyof LabState>(k: K, v: LabState[K]) => setS((x) => ({ ...x, [k]: v }));
  const setTok = <K extends keyof Tokens>(k: K, v: Tokens[K]) => setS((x) => ({ ...x, t: { ...x.t, [k]: v,
    ...(k === "ok" && HEX.test(String(v)) ? { okBg: mix(String(v), "#ffffff", 0.88) } : {}) } }));

  const shareUrl = () => `${window.location.origin}/widget-lab/pdp.html#c=${code}`;
  const labUrl = () => `${window.location.origin}${window.location.pathname}${window.location.search}#/widgets/${code}`;
  const copy = async (what: "share" | "lab") => {
    const url = what === "share" ? shareUrl() : labUrl();
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this link", url); }
    setCopied(what); setTimeout(() => setCopied(null), 1800);
  };

  const loadLink = () => {
    const v = linkIn.trim();
    if (!v) return;
    const src = { u: /^https?:\/\//i.test(v) ? v : "https://" + v };
    autoFor.current = JSON.stringify(src);
    set("src", src);
  };

  /* A saved page goes to this tab's sessionStorage, which the preview frame shares. Scripts
     are cut first: they are most of a saved page's weight and none of them will run. */
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy("upload");
    try {
      const raw = await f.text();
      /* Product data blocks stay (JSON, and Shopify's analytics `var meta`, which names the
         page's own variants); the preview reads them as text and never runs them. */
      const html = raw.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, attrs: string, body: string) =>
        /application\/(ld\+)?json/i.test(attrs) || /var meta =|Shopify\.theme\s*=|Shopify\.currency\s*=/.test(body) ? m : "");
      await saveUpload({ html });
      const src = { up: Date.now(), name: f.name };
      autoFor.current = JSON.stringify(src);
      set("src", src);
    } catch {
      setPdp({ ok: false, error: "The browser would not store that file. Try again, or save the page as HTML only." });
    } finally { setBusy(null); if (fileIn.current) fileIn.current.value = ""; }
  };

  /* Settings read from the page itself (upload or link), else the admin's Branding reader. */
  const storeColours = async () => {
    if (pdp?.brand) { setS((x) => ({ ...x, t: { ...x.t, ...pdp.brand } })); return; }
    if (!s.src?.u) return;
    setBusy("colours");
    try {
      const r = await fetch("/api/brand-colours?url=" + encodeURIComponent(new URL(s.src.u).origin));
      const j = await r.json();
      const next: Partial<Colours> = {};
      for (const t of (j.tokens || []) as { key: string; hex: string }[]) if (BRAND_KEY[t.key] && HEX.test(t.hex)) next[BRAND_KEY[t.key]] = t.hex.toLowerCase();
      if (Object.keys(next).length) setS((x) => ({ ...x, t: { ...x.t, ...next } }));
      else setPdp((p) => ({ ...(p || { ok: true }), error: j.error || "No colours could be read from that store." }));
    } catch { /* leave the colours as they are */ }
    finally { setBusy(null); }
  };

  useEffect(() => {
    if (!pdp?.ok || autoFor.current !== srcKey) return;
    autoFor.current = null;
    void storeColours();
    // storeColours reads the pdp and src this effect is keyed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdp, srcKey]);

  /* Prices for every variant, when the saved page only had the selected one's. */
  const [record, setRecord] = useState("");
  const applyRecord = async () => {
    try {
      const p = JSON.parse(record);
      if (!Array.isArray(p?.variants)) throw new Error("no variants");
      const u = await readUpload();
      if (!u) throw new Error("no upload");
      await saveUpload({ ...u, product: p });
      setRecord("");
      set("src", { ...s.src, up: Date.now() });
    } catch {
      setPdp((x) => ({ ...(x || { ok: true }), error: "That is not the product record. Open the link, select all, copy, and paste it here." }));
    }
  };

  const mode: "sample" | "link" | "upload" = s.src?.u ? "link" : s.src?.up ? "upload" : "sample";
  const [srcTab, setSrcTab] = useState<"sample" | "link" | "upload">("sample");
  useEffect(() => { setSrcTab(mode); }, [mode]);
  const isDropdown = s.w === "subscription-dropdown";

  const pickedTokens = parseTokens(paste);
  const pickedOpts = parseOpts(paste);
  const nPicked = Object.keys(pickedTokens).length + Object.keys(pickedOpts).length;
  const ws: WidgetOpts = s.ws || {};
  const setWs = <K extends keyof WidgetOpts>(k: K, v: WidgetOpts[K]) => setS((x) => ({ ...x, ws: { ...(x.ws || {}), [k]: v } }));
  const item = ALL.find((i) => i.id === s.w)!;
  const isBundle = /bundle|byob|bxgy|addon/.test(s.w);
  const lowText = contrast(s.t.tileText, s.t.tile) < 4.5;
  const lowCta = contrast(s.t.onPrimary || "#ffffff", s.t.primary) < 3;
  const frameH = view === "desktop" ? 860 : 780;

  return (
    <section className="hc-lab">
      <header className="hc-pagehead">
        <p className="hc-eyebrow">Widget lab</p>
        <h1 className="hc-h1">See any widget on a product page</h1>
        <p className="hc-blurb">
          Pick a widget, set the colours and the plan, and check it fits the product form before it goes on
          a store. Copy the link to show anyone exactly this.
        </p>
      </header>

      <div className="hc-labgrid">
        <aside className="hc-labctl">
          {/* Three panes instead of one 2,400px column: the page and the plan, the theme, and
              the widget's own settings. Each is one screen of controls. */}
          <div className="hc-labpanes" role="tablist" aria-label="Lab controls">
            {([["setup", "Page"], ["plan", "Plan"], ["theme", "Theme"], ["settings", "Settings"]] as const).map(([k, n]) => (
              <button key={k} type="button" role="tab" aria-selected={pane === k} className={pane === k ? "on" : ""}
                onClick={() => setPane(k)}>{n}</button>
            ))}
          </div>
          {pane === "setup" && (<>
          <fieldset className="hc-labset">
            <legend>Product page</legend>
            <div className="hc-labseg full">
              {([["sample", "Sample"], ["upload", "Upload page"], ["link", "Product link"]] as const).map(([v, n]) => (
                <button key={v} type="button" className={srcTab === v ? "on" : ""}
                  onClick={() => { setSrcTab(v); if (v === "sample") set("src", undefined); }}>{n}</button>
              ))}
            </div>
            {srcTab === "link" && (
              <form className="hc-labrow" onSubmit={(e) => { e.preventDefault(); loadLink(); }}>
                <input className="hc-labin" value={linkIn} onChange={(e) => setLinkIn(e.target.value)}
                  placeholder="store.com/products/handle" aria-label="Product page link" />
                <button type="submit" className="hc-btn primary" disabled={!linkIn.trim()}>Load</button>
              </form>
            )}
            {srcTab === "upload" && (
              <div className="hc-labrow">
                <input ref={fileIn} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => upload(e.target.files?.[0])} />
                <button type="button" className="hc-btn" onClick={() => fileIn.current?.click()} disabled={busy === "upload"}>
                  {s.src?.name ? "Replace file" : "Choose saved page"}
                </button>
                {s.src?.name && <span className="hc-labfile">{s.src.name}</span>}
              </div>
            )}
            {srcTab === "upload" && !s.src?.up && (
              <p className="hc-labhint">
                Open the product page in your browser and save it: File › Save Page As, or the SingleFile
                extension. Any size works.
              </p>
            )}
            {mode !== "sample" && (
              pdp == null ? <p className="hc-labhint">Reading the page…</p>
              : pdp.ok ? (
                <p className="hc-labok"><b>{pdp.title}</b> · {pdp.variants} variant{pdp.variants === 1 ? "" : "s"}. Only the product section is shown.
                  {pdp.buy === false && <span className="hc-labwarn"> No buy button was found, so the widget sits under the title. Set a spot under Advanced placement.</span>}
                  {!!pdp.live && <span> The store&rsquo;s live StackBack widget was taken out of this preview.</span>}</p>
              ) : <p className="hc-labwarn">{pdp.error}</p>
            )}
            {mode === "upload" && pdp?.ok && pdp.partial && (
              <div className="hc-labrec">
                <p className="hc-labwarn">
                  The saved page only shows the selected variant&rsquo;s price, so every variant uses it for now.
                </p>
                <p className="hc-labhint">
                  For real prices, open{" "}
                  {pdp.url
                    ? <a href={`${pdp.url.replace(/\/$/, "")}.js`} target="_blank" rel="noreferrer">{pdp.url.replace(/^https?:\/\//, "")}.js</a>
                    : "the product link with .js on the end"}{" "}
                  in your browser, copy everything, and paste it here.
                </p>
                <textarea className="hc-labin mono" rows={3} value={record} onChange={(e) => setRecord(e.target.value)}
                  placeholder='{"id":…,"title":…,"variants":[…]}' spellCheck={false} />
                <button type="button" className="hc-btn" disabled={!record.trim()} onClick={applyRecord}>Use these prices</button>
              </div>
            )}
            {mode === "link" && (
              <p className="hc-labhint">Most Shopify stores refuse page reads from a server. If this fails, use Upload page.</p>
            )}
          </fieldset>

          <fieldset className="hc-labset">
            <legend>Where it sits</legend>
            <div className="hc-labseg">
              {([["above", "Above buy button"], ["below", "Below buy button"], ["variants", "Under options"]] as const).map(([v, n]) => (
                <button key={v} type="button" className={s.pos === v ? "on" : ""} onClick={() => set("pos", v)}>{n}</button>
              ))}
            </div>
            <p className="hc-labsub">Opens on</p>
            <div className="hc-labseg">
              {([["otp", isBundle ? "Buy single" : "One-time"], ["sub", isBundle ? "Bundle" : "Subscribe"]] as const).map(([v, n]) => (
                <button key={v} type="button" className={s.def === v ? "on" : ""} onClick={() => set("def", v)}>{n}</button>
              ))}
            </div>
          </fieldset>

          </>)}
          {pane === "plan" && (<>
          <fieldset className="hc-labset">
            <legend>Plan</legend>
            <p className="hc-labsub">Payment types offered</p>
            <div className="hc-labchecks">
              {PAY.map((p) => (
                <label key={p.id}>
                  <input type="checkbox" checked={s.pm.includes(p.id)}
                    onChange={(e) => set("pm", e.target.checked ? [...s.pm, p.id].filter((x, i, a) => a.indexOf(x) === i)
                      : s.pm.length > 1 ? s.pm.filter((x) => x !== p.id) : s.pm)} />
                  {p.name}
                </label>
              ))}
            </div>
            {s.pm.length === 1 && <p className="hc-labhint">One payment type: the widget shows no payment toggle, only its explainer line.</p>}
            {isDropdown ? (
              <>
                <p className="hc-labsub">Discount by number of deliveries, %</p>
                <div className="hc-labnums">
                  {(["3", "6", "12"] as const).map((k) => (
                    <label key={k}><span>{k} deliveries</span>
                      <input type="number" min={0} max={60} value={s.co[k]}
                        onChange={(e) => set("co", { ...s.co, [k]: Math.min(60, Math.max(0, +e.target.value || 0)) })} />
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="hc-labsub">Discount by delivery frequency, %</p>
                <div className="hc-labnums">
                  {([["2w", "2 weeks"], ["1m", "1 month"], ["2m", "2 months"]] as const).map(([k, n]) => (
                    <label key={k}><span>{n}</span>
                      <input type="number" min={0} max={60} value={s.d[k]}
                        onChange={(e) => set("d", { ...s.d, [k]: Math.min(60, Math.max(0, +e.target.value || 0)) })} />
                    </label>
                  ))}
                </div>
              </>
            )}
          </fieldset>

          {mode === "sample" && <fieldset className="hc-labset">
            <legend>Product</legend>
            <label className="hc-labfield"><span>Name</span>
              <input value={s.p.title} maxLength={60} onChange={(e) => set("p", { ...s.p, title: e.target.value })} />
            </label>
            <div className="hc-labnums two">
              <label><span>Price, ₹</span>
                <input type="number" min={1} value={s.p.price} onChange={(e) => set("p", { ...s.p, price: Math.max(1, +e.target.value || 1) })} />
              </label>
              <label><span>Compare at, ₹</span>
                <input type="number" min={0} value={s.p.compare} onChange={(e) => set("p", { ...s.p, compare: Math.max(0, +e.target.value || 0) })} />
              </label>
            </div>
          </fieldset>}

          </>)}
          {pane === "theme" && (<>
          <fieldset className="hc-labset">
            <legend>Theme</legend>
            {mode !== "sample" && pdp?.ok && (pdp.brand || mode === "link") && (
              <div className="hc-labfrom">
                <button type="button" className="hc-btn" onClick={storeColours} disabled={busy === "colours"}>
                  {busy === "colours" ? "Reading colours…" : "Use this page's colours and font"}
                </button>
                {pdp.brand && <span>Read from the page{pdp.font ? `. Its font is ${pdp.font}` : ""}{pdp.brand.font && pdp.font && !pdp.font.toLowerCase().includes(pdp.brand.font.toLowerCase()) ? `, closest: ${pdp.brand.font}` : ""}.</span>}
              </div>
            )}
            <div className="hc-labpresets">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => set("t", { ...s.t, ...p.t })} title={p.name}
                  className={(Object.keys(p.t) as (keyof Colours)[]).every((k) => p.t[k] === s.t[k]) ? "on" : ""}>
                  <i style={{ background: p.t.primary }} /><i style={{ background: p.t.secondary }} /><i style={{ background: p.t.accent }} />
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
            {SETTING_GROUPS.map((g) => (
              <div key={g.title} className="hc-labgrp hc-labtoks">
                <p className="hc-labgh">{g.title}</p>
                {g.fields.map((f) => {
                  const v = (s.t[f.k] as string | undefined) ?? f.def ?? "";
                  return (
                    <label key={f.k} className="hc-labtok" title={f.hint}>
                      <input type="color" value={HEX.test(v) ? v : "#000000"} onChange={(e) => setTok(f.k, e.target.value)} aria-label={f.name} />
                      <span><b>{f.name}</b>
                        <input className="hc-labhex" value={v} maxLength={7} spellCheck={false} aria-label={`${f.name}, hex`}
                          onChange={(e) => { const x = e.target.value.trim(); setTok(f.k, x.startsWith("#") ? x : "#" + x); }}
                          aria-invalid={!HEX.test(v)} />
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
            <div className="hc-labgrp">
              <p className="hc-labgh">Shape and frame</p>
              <label className="hc-labrange">
                <span><b>Corner radius</b><em>{s.t.radius ?? 10}px</em></span>
                <input type="range" min={0} max={24} value={s.t.radius ?? 10} onChange={(e) => setTok("radius", +e.target.value)} />
              </label>
              <div className="hc-labrow">
                <span><b>Shadow</b></span>
                <div className="hc-labseg">
                  {(["none", "subtle", "strong"] as const).map((v) => (
                    <button key={v} type="button" className={(s.t.shadow || "none") === v ? "on" : ""} onClick={() => setTok("shadow", v)}>
                      {v[0].toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="hc-labcheck">
                <input type="checkbox" checked={!!s.t.outer} onChange={(e) => setTok("outer", e.target.checked)} />
                <span>Show outer border</span>
              </label>
              {s.t.outer && (() => {
                const v = s.t.chrome || s.t.line;
                return (
                  <label className="hc-labtok">
                    <input type="color" value={HEX.test(v) ? v : "#000000"} onChange={(e) => setTok("chrome", e.target.value)} aria-label="Outer border colour" />
                    <span><b>Outer border colour</b><em>The frame around the widget</em></span>
                    <input className="hc-labhex" value={v} maxLength={7} spellCheck={false}
                      onChange={(e) => { const x = e.target.value.trim(); setTok("chrome", x.startsWith("#") ? x : "#" + x); }} />
                  </label>
                );
              })()}
            </div>
            <div className="hc-labgrp">
              <p className="hc-labgh">Font</p>
              <select className="hc-labin" value={s.t.font || "Inter"} onChange={(e) => setTok("font", e.target.value)} aria-label="Widget font">
                {FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            {(lowText || lowCta) && (
              <p className="hc-labwarn">
                {lowText && "Text on tiles is hard to read (contrast under 4.5). "}
                {lowCta && "Text on primary is hard to read (contrast under 3)."}
              </p>
            )}
            <details className="hc-labpaste">
              <summary>Paste tokens</summary>
              <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)}
                placeholder={"Paste the stackback-color-tokens copy block, or\nprimary: #2a431c\nsavings color: #2dbc6e\ncorner radius: 12"} />
              <button type="button" className="hc-btn" disabled={!nPicked}
                onClick={() => { setS((x) => ({ ...x, t: { ...x.t, ...pickedTokens }, ws: { ...(x.ws || {}), ...pickedOpts } })); setPaste(""); }}>
                {nPicked ? `Apply ${nPicked} setting${nPicked === 1 ? "" : "s"}` : "Nothing recognised yet"}
              </button>
            </details>
          </fieldset>

          </>)}
          {pane === "settings" && (<>
          <fieldset className="hc-labset">
            <legend>Widget settings</legend>
            <div className="hc-labgrp">
              <p className="hc-labgh">Component styles</p>
              {([
                ["cta", "Buy button", [["solid", "Solid"], ["outline", "Outline"]], "solid"],
                ["badge", "Discount badge", [["filled", "Filled"], ["outline", "Outline"], ["minimal", "Minimal"]], "filled"],
                ["selected", "Selected plan", [["border-and-fill", "Border and fill"], ["border-only", "Border only"]], "border-and-fill"],
              ] as const).map(([k, name, opts, dflt]) => (
                <div key={k} className="hc-labrow">
                  <span><b>{name}</b></span>
                  <div className="hc-labseg">
                    {opts.map(([v, n]) => (
                      <button key={v} type="button" className={(ws[k] || dflt) === v ? "on" : ""}
                        onClick={() => setWs(k, v as never)}>{n}</button>
                    ))}
                  </div>
                </div>
              ))}
              <label className="hc-labrange">
                <span><b>Text size</b><em>{ws.fontScale ?? 100}%</em></span>
                <input type="range" min={85} max={120} step={5} value={ws.fontScale ?? 100} onChange={(e) => setWs("fontScale", +e.target.value)} />
              </label>
            </div>
            <div className="hc-labgrp">
              <p className="hc-labgh">Text</p>
              <label className="hc-labfield"><span>Promo line</span>
                <input className="hc-labin" value={ws.promo || ""} maxLength={80} placeholder="Save up to 15% OFF on all subscriptions"
                  onChange={(e) => setWs("promo", e.target.value)} />
              </label>
              <label className="hc-labfield"><span>Tag on the best plan</span>
                <input className="hc-labin" value={ws.badgeText ?? "Best Value"} maxLength={24} placeholder="Leave empty for no tag"
                  onChange={(e) => setWs("badgeText", e.target.value)} />
              </label>
            </div>
            <div className="hc-labgrp">
              <p className="hc-labgh">Show</p>
              {([
                ["freebies", "Freebies", true],
                ["noOneTime", "One-time purchase option", false],
                ["noHow", "\u201cHow subscriptions work\u201d link", false],
                ["noShipLine", "Free shipping line", false],
                ["noBrand", "Powered by StackBack", false],
              ] as const).map(([k, name, positive]) => {
                const on = positive ? ws[k] !== false : !ws[k];
                return (
                  <label key={k} className="hc-labcheck">
                    <input type="checkbox" checked={on}
                      onChange={(e) => setWs(k, (positive ? e.target.checked : !e.target.checked) as never)} />
                    <span>{name}</span>
                  </label>
                );
              })}
            </div>
            {s.ws && (
              <button type="button" className="hc-linkish" onClick={() => set("ws", undefined)}>Reset widget settings</button>
            )}
          </fieldset>

          </>)}
          {pane === "setup" && mode !== "sample" && (
            <details className="hc-labset hc-labadv">
              <summary>Advanced placement</summary>
              <label className="hc-labfield"><span>Place next to this element (CSS selector)</span>
                <input className="hc-labin" value={s.sel || ""} placeholder=".product-form__buttons" spellCheck={false}
                  onChange={(e) => set("sel", e.target.value || undefined)} />
              </label>
              <label className="hc-labfield"><span>Extra CSS for theme quirks</span>
                <textarea rows={3} className="hc-labin mono" value={s.css || ""} spellCheck={false}
                  placeholder=".product__media-list { display: block }" onChange={(e) => set("css", e.target.value || undefined)} />
              </label>
            </details>
          )}
        </aside>

        <div className="hc-labview">
          <nav className="hc-labpick" aria-label="Widget">
            {GROUPS.map((g) => (
              <div key={g.title} className="hc-labpickg">
                <span>{g.title}</span>
                <div>
                  {g.items.map((it) => (
                    <button key={it.id} type="button" className={s.w === it.id ? "on" : ""} aria-pressed={s.w === it.id}
                      title={it.hint} onClick={() => set("w", it.id)}>{it.name}</button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="hc-labbar">
            <div className="hc-labseg">
              <button type="button" className={view === "desktop" ? "on" : ""} onClick={() => setView("desktop")}>Desktop</button>
              <button type="button" className={view === "mobile" ? "on" : ""} onClick={() => setView("mobile")}>Mobile</button>
            </div>
            <p className="hc-labname"><b>{item.name}</b><span>{item.hint}</span></p>
            <a className="hc-btn ghost" href={`/widget-lab/pdp.html#c=${code}`} target="_blank" rel="noreferrer">Open</a>
            <button type="button" className="hc-btn primary" onClick={() => copy("share")} disabled={mode === "upload"}
              title={mode === "upload" ? "An uploaded page stays in this browser. Use a product link to share." : undefined}>
              {copied === "share" ? "Link copied" : "Copy share link"}
            </button>
          </div>

          <FitCheck fit={fit} view={view} />

          {/* Both views drawn smaller than life, so a phone does not read as zoomed in next to
              a desktop page scaled to the column. CSS zoom, not a scale transform: zoom carries
              into the frame as its pixel ratio, so the page is laid out at full width but
              painted at screen resolution. A transform shrank a finished bitmap and blurred the
              text. */}
          <div ref={stage} className={"hc-labstage " + view}
            style={view === "desktop" ? { height: frameH * scale } : { height: frameH * MOBILE_SCALE + 36 }}>
            <iframe
              key={view}
              title={`${item.name} on a sample product page`}
              src={`/widget-lab/pdp.html#c=${frameCode}`}
              className="hc-labframe"
              style={view === "desktop"
                ? { width: 1280, height: frameH, zoom: scale }
                : { width: 390, height: frameH, zoom: MOBILE_SCALE }}
            />
          </div>

          <p className="hc-note">
            {mode === "upload"
              ? "An uploaded page stays in this browser tab, so it has no share link. Load the product link instead to share it. "
              : mode === "link"
              ? "The share link reloads the store's product page each time it opens, keeps only the product section and adds the widget. Nothing on the store changes. "
              : "The share link opens this sample page with these settings, for anyone. "}
            On a live theme the widget needs an app block slot in the product form.{" "}
            <button type="button" className="hc-linkish" onClick={() => copy("lab")}>
              {copied === "lab" ? "Copied" : "Copy a link to these lab settings"}</button>.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Will this widget work on this product form? Read from the page itself after it renders,
 *  not estimated: the widget's height, whether it is wider than the column, and whether the
 *  buy button is still on screen without scrolling. */
function FitCheck({ fit, view }: { fit: Fit | null; view: "desktop" | "mobile" }) {
  if (!fit) return <div className="hc-labfit wait">Measuring the widget on the page…</div>;
  /* On a phone the buy box always sits under the gallery, so the useful question is whether
     the widget and its buy button fit on one screen once the shopper scrolls to them. */
  const mobile = view === "mobile";
  const span = fit.ctaBottom != null ? fit.ctaBottom - fit.top : 0;
  const below = fit.ctaBottom == null ? 0 : mobile ? span - fit.vh : fit.ctaBottom - fit.vh;
  const rows: { tone: "ok" | "warn" | "bad"; text: string }[] = [
    fit.overflow > 2
      ? { tone: "bad", text: `Wider than the product column by ${fit.overflow}px at this width` }
      : { tone: "ok", text: "Fits the product column" },
    below > 0
      ? { tone: "warn", text: mobile
          ? `Widget and buy button need ${span}px, more than one phone screen. A compact widget (Dropdown, Collapsible) keeps them together`
          : `The buy button sits ${below}px below the first screen. Try Below Add to cart, or a compact widget (Dropdown, Collapsible)` }
      : { tone: "ok", text: mobile ? "Widget and buy button fit on one phone screen" : "The buy button is on the first screen" },
    fit.h > fit.vh * 0.9
      ? { tone: "warn", text: `${fit.h}px tall: more than a ${view === "mobile" ? "phone" : "laptop"} screen` }
      : { tone: "ok", text: `${fit.h}px tall` },
  ];
  const worst = rows.some((r) => r.tone === "bad") ? "bad" : rows.some((r) => r.tone === "warn") ? "warn" : "ok";
  return (
    <div className={"hc-labfit " + worst}>
      <b>{worst === "ok" ? "Fits this product page" : worst === "warn" ? "Fits, with a catch" : "Does not fit as placed"}</b>
      <ul>{rows.map((r) => <li key={r.text} className={r.tone}>{r.text}</li>)}</ul>
    </div>
  );
}
