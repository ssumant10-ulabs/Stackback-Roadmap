"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { mapShopifyProducts, parseCollection, type ShopifyProduct } from "@/lib/help/collection";

/** Landing Page Lab: the real StackBack landing page designs (the SB_LP_* design files, built
 *  by scripts/build-lp-design.mjs into public/lp-design), driven from here.
 *
 *  Page types follow the admin's Landing Pages templates. The settings on the left are the
 *  design's own settings list, posted up by the page itself, so they can never drift from what
 *  the design supports. Products come from the design's sample, a store collection (link or
 *  saved page), or the plan setup's order file. Everything rides in the link (#c=). */

type PageKey = "byob" | "bxgy" | "fixed" | "mix" | "subscription" | "surprise";
type Brand = { primary: string; secondary: string; accent: string; tileText: string; bg: string; tile: string };
type Prod = { name: string; price: number; mrp?: number; image?: string; cat?: string; option?: string; variants?: string[]; handle?: string; available?: boolean };
type SettingDef = { k: string; label: string; options: unknown };
type Meta = { settings: SettingDef[]; sections: [string, string[]][]; labels: Record<string, string>; visible: string[]; s: Record<string, unknown> };
interface LPState {
  page: PageKey;
  settings: Record<string, unknown>;
  brand: Brand;
  products?: Prod[];
  product?: Prod;
  source: "sample" | "collection" | "plans";
  /** Subscription page sections switched off (the admin Content tab's sections). */
  hide?: string[];
  /** Diya dividers: off on the Normal theme and on for Diwali, unless set here. */
  dividers?: boolean;
  /** Payment types offered: upfront, perDelivery, payg. */
  pay?: string[];
  /** Store header: the logo image and the name, from the store or typed in. */
  logo?: string;
  brandName?: string;
  /** Complete your routine (subscription page): the collection's other products. */
  upsell?: { subs: Prod[]; bundles: Prod[] };
}

const PAY_TYPES: { k: string; name: string }[] = [
  { k: "upfront", name: "Pay Upfront (prepaid)" },
  { k: "perDelivery", name: "Pay Per Delivery (AutoPay)" },
  { k: "payg", name: "Pay As You Go" },
];
const DEFAULT_PAY = ["upfront", "perDelivery"];
const KITLIKE = /\b(kit|duo|trio|combo|bundle|box|set|pack of|hamper|starter)\b/i;

/* The Subscription V2 sections the admin's Content tab can switch, in page order. The first
   two sit inside the product form; the rest are the page below it. */
const SECTIONS: { k: string; name: string; festive?: boolean }[] = [
  { k: "trust", name: "Trust cards" },
  { k: "quickq", name: "Quick questions" },
  { k: "payway", name: "Pay your way" },
  { k: "reels", name: "Reels" },
  { k: "upsell", name: "Complete your routine" },
  { k: "marquee", name: "Scrolling text" },
  { k: "banner", name: "Banner carousel" },
  { k: "reviews", name: "Reviews" },
  { k: "faq", name: "FAQ" },
  { k: "wall", name: "Diwali wall", festive: true },
  { k: "ticker", name: "Bottom bar ticker" },
];

const LISTING: { group: string; items: { id: PageKey; name: string; hint: string }[] }[] = [
  { group: "Bundle builder", items: [
    { id: "byob", name: "Build your own box", hint: "Shopper adds anything; offers grow with the box" },
    { id: "bxgy", name: "Buy X Get Y", hint: "A set of products, the free ones added at checkout" },
    { id: "fixed", name: "Fixed bundle", hint: "One curated bundle, one price" },
    { id: "mix", name: "Mix & Match", hint: "One (or many) from each category" },
  ] },
  { group: "Single product subscription", items: [
    { id: "subscription", name: "Subscription V2", hint: "One product: variant, plan picker, reels, FAQ, upsell" },
    { id: "surprise", name: "Surprise box", hint: "A mystery box sold on subscription" },
  ] },
];
const ALL = LISTING.flatMap((g) => g.items);
const isSub = (p: PageKey) => p === "subscription" || p === "surprise";

/* The six tokens of the admin's Widget Settings, as the design names them. */
const TOKENS: { k: keyof Brand; name: string; hint: string }[] = [
  { k: "primary", name: "Brand Primary", hint: "Bars, main CTA, radio icons, selected payment mode" },
  { k: "secondary", name: "Brand Secondary", hint: "Selected tabs and cards, freebie pill, dropdowns" },
  { k: "accent", name: "Brand Accent", hint: "Offer highlights, final price, add-product CTA" },
  { k: "tileText", name: "Product Tile", hint: "Product name and price" },
  { k: "bg", name: "Widget Background", hint: "Widget and popup background" },
  { k: "tile", name: "Product Tile Background", hint: "Product cards" },
];
const PRESETS: { name: string; b: Brand }[] = [
  { name: "StackBack", b: { primary: "#041101", secondary: "#fcfbfc", accent: "#95e534", tileText: "#041101", bg: "#ffffff", tile: "#f6f5f1" } },
  { name: "Coral", b: { primary: "#ff5f60", secondary: "#ffe9e9", accent: "#2dbc6e", tileText: "#333333", bg: "#ffffff", tile: "#f8f8f8" } },
  { name: "Earth", b: { primary: "#a56211", secondary: "#eee5d2", accent: "#a56211", tileText: "#1f1a12", bg: "#ffffff", tile: "#f6f3e7" } },
  { name: "Ink", b: { primary: "#111111", secondary: "#f2f2f2", accent: "#c8102e", tileText: "#111111", bg: "#ffffff", tile: "#ffffff" } },
];
const HEX = /^#[0-9a-f]{6}$/i;
const DESK_W = 1440, DESK_H = 821, PHONE_W = 393, PHONE_H = 852;

const DEFAULT: LPState = { page: "byob", settings: { theme: "normal" }, brand: PRESETS[0].b, source: "sample" };

function encode(s: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(s));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(c: string): Partial<LPState> | null {
  try {
    let b = c.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0))));
  } catch { return null; }
}

/* A saved collection page: Shopify writes its products into `var meta = {...}` for analytics,
   with variant names and prices in paise. Images come from the product cards' own <img>. */
function productsFromSavedPage(html: string): Prod[] {
  const m = /var meta = (\{[\s\S]*?\});\s*\n/.exec(html) || /ShopifyAnalytics\.meta\s*=\s*(\{[\s\S]*?\});/.exec(html);
  let list: { type?: string; variants?: { name?: string; public_title?: string; price?: number }[] }[] = [];
  try { list = m ? (JSON.parse(m[1]).products || []) : []; } catch { list = []; }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const imgs: string[] = Array.from(doc.querySelectorAll('a[href*="/products/"] img')).map((i) => (i as HTMLImageElement).getAttribute("src") || "")
    .map((s) => s.startsWith("//") ? "https:" + s : s).filter((s) => /^https?:|^data:image/.test(s));
  return list.map((p, i) => {
    const v = p.variants || [];
    const first = v[0] || {};
    const pub = String(first.public_title || "");
    const name = String(first.name || "").replace(pub ? new RegExp(`\\s*-\\s*${pub.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) : /$^/, "").trim();
    const prices = v.map((x) => Number(x.price) / 100).filter((n) => n > 0);
    const titles = v.map((x) => String(x.public_title || "")).filter(Boolean);
    return { name, price: prices.length ? Math.min(...prices) : 0, cat: p.type || undefined, image: imgs[i] || undefined,
      variants: titles.length > 1 ? titles.slice(0, 6) : undefined };
  }).filter((p) => p.name && p.price > 0);
}

function readPlanProducts(want: "subscription" | "bundle"): Prod[] {
  try {
    const d = JSON.parse(localStorage.getItem("sb-help-planform") || "null")?.answers;
    const mix: { title: string; role: string; price?: number; variants?: { name: string }[] }[] = d?.product_mix ? JSON.parse(d.product_mix) : [];
    const pick = mix.filter((m) => m.role === want);
    return (pick.length >= 2 ? pick : mix).map((m) => {
      const vs = (m.variants || []).map((v) => v.name).filter((n) => n && n !== "Default");
      return { name: m.title, price: Math.round(m.price || 499), variants: vs.length > 1 ? vs : undefined };
    });
  } catch { return []; }
}

export default function LandingLab() {
  const [s, setS] = useState<LPState>(DEFAULT);
  const [pane, setPane] = useState<"settings" | "products" | "brand">("settings");
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [scale, setScale] = useState(1);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [copied, setCopied] = useState(false);
  const [coll, setColl] = useState<{ url: string; products: Prod[] } | null>(null);
  const [collIn, setCollIn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fileIn = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const m = /[?&]c=([A-Za-z0-9_-]+)/.exec(window.location.hash);
    const got = m ? decode(m[1]) : null;
    if (got) setS((x) => ({ ...x, ...got }));
  }, []);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (el.clientWidth > 0) setScale(Math.min(1, el.clientWidth / DESK_W)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || e.data.sbDesign !== true) return;
      setMeta(e.data as Meta);
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  const set = <K extends keyof LPState>(k: K, v: LPState[K]) => setS((x) => ({ ...x, [k]: v }));
  const setSetting = (k: string, v: unknown) => setS((x) => ({ ...x, settings: { ...x.settings, [k]: v } }));
  const item = ALL.find((t) => t.id === s.page)!;
  const sub = isSub(s.page);

  /* What the page gets: the design's settings with the page type, the brand, and products
     (a list for a bundle page, one product for a subscription page). */
  const theme = String(s.settings.theme ?? meta?.s?.theme ?? "normal");
  const dividersOn = s.dividers ?? theme === "festive";
  const cfg = useMemo(() => {
    const hide = [...(s.hide || []), ...(sub && !dividersOn ? ["divider"] : [])];
    return {
      settings: { ...s.settings, type: s.page },
      brand: s.brand,
      view,
      pay: s.pay || DEFAULT_PAY,
      ...(s.logo ? { logo: s.logo } : {}),
      ...(s.brandName ? { brandName: s.brandName } : {}),
      ...(sub && hide.length ? { hide } : {}),
      ...(sub && s.upsell ? { upsell: s.upsell } : {}),
      ...(sub ? (s.product ? { product: s.product } : {}) : (s.products?.length ? { products: s.products } : {})),
    };
  }, [s, view, sub, dividersOn]);
  const code = useMemo(() => encode(cfg), [cfg]);
  const [frameCode, setFrameCode] = useState(code);
  useEffect(() => { const t = setTimeout(() => setFrameCode(code), 250); return () => clearTimeout(t); }, [code]);
  const page = sub ? "subscription" : "bundles";
  const shareCode = useMemo(() => encode({ ...cfg, view: undefined }), [cfg]);

  /* The browser first: Shopify answers a shopper's browser (and sends CORS on these records)
     where it rate-limits a server. The server route is the fallback, the saved page the last. */
  async function loadCollection() {
    const c = parseCollection(collIn);
    if (!c) { setErr("Paste a collection link, for example yourstore.com/collections/all"); return; }
    setBusy(true); setErr(null);
    const urls = [`${c.origin}/collections/${c.handle}/products.json?limit=250`, ...(c.handle === "all" ? [`${c.origin}/products.json?limit=250`] : [])];
    try {
      for (const u of urls) {
        try {
          const r = await fetch(u, { credentials: "omit" });
          if (!r.ok) continue;
          const list = mapShopifyProducts(((await r.json()) as { products?: ShopifyProduct[] }).products || []);
          if (list.length) { setColl({ url: `${c.origin}/collections/${c.handle}`, products: list }); pickDefault(list, c.origin); return; }
        } catch { /* blocked in the browser: try the next */ }
      }
      const r = await fetch(`/api/lp-lab/collection?url=${encodeURIComponent(`${c.origin}/collections/${c.handle}`)}`);
      const j = await r.json();
      if (!j.ok) { setErr(j.error); return; }
      setColl({ url: j.url, products: j.products });
      pickDefault(j.products, c.origin);
    } catch { setErr("That collection could not be read. Upload the saved collection page instead."); } finally { setBusy(false); }
  }
  async function uploadCollection(f?: File) {
    if (!f) return;
    setErr(null);
    const list = productsFromSavedPage(await f.text());
    if (!list.length) { setErr("No products were found in that page. Save the collection page itself (File › Save Page As)."); return; }
    setColl({ url: f.name, products: list });
    pickDefault(list);
  }
  function pickDefault(list: Prod[], origin?: string) {
    setS((x) => {
      const product = x.product && list.some((p) => (p.handle || p.name) === (x.product!.handle || x.product!.name)) ? x.product : list[0];
      return { ...x, source: "collection",
        products: list.filter((p) => p.available !== false).slice(0, 12),
        product, upsell: upsellFrom(list, product) };
    });
    if (origin) void readStore(origin);
  }
  /* The rest of the collection fills Complete your routine: kits and sets on the Bundles tab,
     everything else on Subscriptions. The page's own product is left out. */
  function upsellFrom(list: Prod[], main?: Prod): LPState["upsell"] {
    const rest = list.filter((p) => p.available !== false && (!main || (p.handle || p.name) !== (main.handle || main.name)));
    const kits = rest.filter((p) => KITLIKE.test(p.name));
    const subsList = rest.filter((p) => !KITLIKE.test(p.name));
    return { subs: subsList.slice(0, 8), bundles: (kits.length ? kits : rest.slice(8)).slice(0, 8) };
  }
  /* The store's own name and logo for the header (only when not typed in by hand). */
  async function readStore(origin: string) {
    try {
      const r = await fetch(`/api/lp-lab/store?url=${encodeURIComponent(origin)}`);
      const j = await r.json();
      if (!j.ok) return;
      setS((x) => ({ ...x, logo: x.logo || j.logo || undefined, brandName: x.brandName || j.name || undefined }));
    } catch { /* the header keeps the store name typed in, or Your Brand */ }
  }
  /* Keyed by handle: a store can carry two products with the same title. */
  const pid = (p: Prod) => p.handle || p.name;
  const picked = (p: Prod) => sub ? !!s.product && pid(s.product) === pid(p) : !!s.products?.some((x) => pid(x) === pid(p));
  function toggle(p: Prod) {
    if (sub) { setS((x) => ({ ...x, product: p, upsell: coll ? upsellFrom(coll.products, p) : x.upsell })); return; }
    const cur = s.products || [];
    set("products", cur.some((x) => pid(x) === pid(p)) ? cur.filter((x) => pid(x) !== pid(p)) : [...cur, p].slice(0, 24));
  }

  const copy = async () => {
    const url = `${window.location.origin}/lp-design/${page}.html#c=${shareCode}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Copy this link", url); }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };

  /* The design's own settings, grouped as the design groups them. */
  const visible = new Set((meta?.visible || []).filter((k) => k !== "type"));
  const defs = new Map((meta?.settings || []).map((d) => [d.k, d]));
  const current = (k: string) => (k in s.settings ? s.settings[k] : meta?.s?.[k]);

  return (
    <section className="hc-lab">
      <header className="hc-pagehead">
        <p className="hc-eyebrow">Landing Page Lab</p>
        <h1 className="hc-h1">The real landing pages, with your settings and products</h1>
        <p className="hc-blurb">
          Every StackBack landing page template, drawn from its design. Set it the way the admin would, pick products
          from a collection, and click through it as a shopper.
        </p>
      </header>

      <div className="hc-labgrid">
        <aside className="hc-labctl">
          <div className="hc-labpanes" role="tablist" aria-label="Landing page controls" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
            {([["settings", "Settings"], ["products", "Products"], ["brand", "Brand"]] as const).map(([k, n]) => (
              <button key={k} type="button" role="tab" aria-selected={pane === k} className={pane === k ? "on" : ""} onClick={() => setPane(k)}>{n}</button>
            ))}
          </div>

          {pane === "settings" && (
            meta ? meta.sections.map(([title, keys]) => {
              const shown = keys.filter((k) => visible.has(k) && defs.has(k));
              if (!shown.length) return null;
              return (
                <fieldset key={title} className="hc-labset">
                  <legend>{title}</legend>
                  {shown.map((k) => {
                    const d = defs.get(k)!;
                    const label = meta.labels[k] || d.label;
                    const v = current(k);
                    if (d.options === "hex") {
                      const hv = String(v || "#000000");
                      return (
                        <label key={k} className="hc-labtok">
                          <input type="color" value={HEX.test(hv) ? hv : "#000000"} onChange={(e) => setSetting(k, e.target.value)} aria-label={label} />
                          <span><b>{label}</b></span>
                        </label>
                      );
                    }
                    const opts = Array.isArray(d.options) ? (d.options as [unknown, string][]) : [];
                    return (
                      <div key={k} className="hc-lpset">
                        <span>{label}</span>
                        {opts.length <= 3 ? (
                          <div className="hc-labseg full">
                            {opts.map(([ov, on]) => (
                              <button key={String(ov)} type="button" className={JSON.stringify(v) === JSON.stringify(ov) ? "on" : ""}
                                onClick={() => setSetting(k, ov)}>{on}</button>
                            ))}
                          </div>
                        ) : (
                          <select className="hc-labin" value={JSON.stringify(v)} onChange={(e) => setSetting(k, JSON.parse(e.target.value))} aria-label={label}>
                            {opts.map(([ov, on]) => <option key={String(ov)} value={JSON.stringify(ov)}>{on}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              );
            }) : <p className="hc-labhint" style={{ padding: "0 16px 16px" }}>Loading the page&rsquo;s settings…</p>
          )}
          {pane === "settings" && (
            <fieldset className="hc-labset">
              <legend>Payment types</legend>
              <div className="hc-labchecks">
                {PAY_TYPES.map((t) => {
                  const cur = s.pay || DEFAULT_PAY;
                  const on = cur.includes(t.k);
                  return (
                    <label key={t.k}>
                      <input type="checkbox" checked={on}
                        onChange={() => set("pay", on ? (cur.length > 1 ? cur.filter((k) => k !== t.k) : cur) : PAY_TYPES.map((x) => x.k).filter((k) => k === t.k || cur.includes(k)))} />
                      {t.name}
                    </label>
                  );
                })}
              </div>
              <p className="hc-labhint">Only these show on the page. At least one stays on.</p>
            </fieldset>
          )}
          {pane === "settings" && sub && (
            <fieldset className="hc-labset">
              <legend>Sections</legend>
              <p className="hc-labhint" style={{ marginTop: 0 }}>Show or hide each section, as in the admin&rsquo;s Content tab.</p>
              <div className="hc-lpsecs">
                {SECTIONS.filter((x) => !x.festive || current("theme") === "festive").map((x) => {
                  const on = !(s.hide || []).includes(x.k);
                  return (
                    <label key={x.k} className={on ? "on" : ""}>
                      <input type="checkbox" checked={on}
                        onChange={() => set("hide", on ? [...(s.hide || []), x.k] : (s.hide || []).filter((k) => k !== x.k))} />
                      <span>{x.name}</span>
                    </label>
                  );
                })}
              </div>
              <label className={"hc-lpdiv" + (dividersOn ? " on" : "")}>
                <input type="checkbox" checked={dividersOn} onChange={() => set("dividers", !dividersOn)} />
                <span>Diya dividers between sections</span>
              </label>
              <div className="hc-labrow">
                <button type="button" className="hc-linkish" onClick={() => set("hide", [])}>Show all</button>
                <button type="button" className="hc-linkish" onClick={() => set("hide", SECTIONS.slice(2).map((x) => x.k))}>Hide all below the product</button>
              </div>
            </fieldset>
          )}
          {pane === "settings" && Object.keys(s.settings).length > 1 && (
            <button type="button" className="hc-linkish" style={{ margin: "0 16px 16px" }} onClick={() => set("settings", { theme: "normal" })}>Reset settings</button>
          )}

          {pane === "products" && (<>
            <fieldset className="hc-labset">
              <legend>Products from</legend>
              <div className="hc-labseg full">
                <button type="button" className={s.source === "sample" ? "on" : ""} onClick={() => setS((x) => ({ ...x, source: "sample", products: undefined, product: undefined }))}>Design sample</button>
                <button type="button" className={s.source === "collection" ? "on" : ""} onClick={() => set("source", "collection")}>Collection</button>
                <button type="button" className={s.source === "plans" ? "on" : ""} onClick={() => {
                  const list = readPlanProducts(sub ? "subscription" : "bundle");
                  setS((x) => ({ ...x, source: "plans", products: list.length ? list : undefined, product: list[0] }));
                }}>Plan setup</button>
              </div>
              {s.source === "plans" && <p className="hc-labhint">{(sub ? s.product : s.products?.length) ? `From your order file: ${sub ? "the refills" : "kits, trials and accessories"}.` : "Read an order file in Subscription plan setup first."}</p>}
            </fieldset>
            {s.source === "collection" && (
              <fieldset className="hc-labset">
                <legend>Collection</legend>
                <form className="hc-labrow" style={{ marginTop: 0 }} onSubmit={(e) => { e.preventDefault(); if (collIn.trim()) void loadCollection(); }}>
                  <input className="hc-labin" value={collIn} onChange={(e) => setCollIn(e.target.value)} placeholder="store.com/collections/all" aria-label="Collection link" />
                  <button type="submit" className="hc-btn primary" disabled={!collIn.trim() || busy}>{busy ? "…" : "Load"}</button>
                </form>
                <div className="hc-labrow">
                  <input ref={fileIn} type="file" accept=".html,.htm,text/html" hidden onChange={(e) => void uploadCollection(e.target.files?.[0])} />
                  <button type="button" className="hc-btn" onClick={() => fileIn.current?.click()}>Upload saved collection page</button>
                </div>
                {err && <p className="hc-labwarn">{err}</p>}
                {coll && (<>
                  <p className="hc-labsub">{sub ? "Pick the product for this page" : `Pick the products (${s.products?.length || 0} of ${coll.products.length})`}</p>
                  {!sub && (
                    <div className="hc-labrow" style={{ marginTop: 0 }}>
                      <button type="button" className="hc-linkish" onClick={() => set("products", coll.products.slice(0, 24))}>Select all</button>
                      <button type="button" className="hc-linkish" onClick={() => set("products", [])}>Clear</button>
                    </div>
                  )}
                  <ul className="hc-lppick">
                    {coll.products.map((p) => (
                      <li key={pid(p)}>
                        <label className={picked(p) ? "on" : ""}>
                          <input type={sub ? "radio" : "checkbox"} name="lp-prod" checked={picked(p)} onChange={() => toggle(p)} />
                          {p.image ? <img src={p.image} alt="" loading="lazy" /> : <i />}
                          <span><b>{p.name}</b><em>₹{Math.round(p.price).toLocaleString("en-IN")}{p.cat ? ` · ${p.cat}` : ""}{p.available === false ? " · sold out" : ""}</em></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>)}
              </fieldset>
            )}
          </>)}

          {pane === "brand" && (<>
            <fieldset className="hc-labset">
              <legend>Store header</legend>
              <label className="hc-labfield"><span>Store name</span>
                <input className="hc-labin" value={s.brandName || ""} maxLength={40} placeholder="Your Brand" onChange={(e) => set("brandName", e.target.value || undefined)} />
              </label>
              <label className="hc-labfield" style={{ marginTop: 8 }}><span>Logo image link</span>
                <input className="hc-labin" value={s.logo || ""} placeholder="Read from the store when a collection loads" spellCheck={false}
                  onChange={(e) => { const v = e.target.value.trim(); set("logo", /^https?:\/\//i.test(v) ? v : undefined); }} />
              </label>
              {s.logo && <div className="hc-lplogo"><img src={s.logo} alt="Store logo" /><button type="button" className="hc-linkish" onClick={() => set("logo", undefined)}>Remove</button></div>}
            </fieldset>
            <fieldset className="hc-labset">
              <legend>Widget settings colours</legend>
              <div className="hc-labpresets">
                {PRESETS.map((p) => (
                  <button key={p.name} type="button" onClick={() => set("brand", p.b)}
                    className={(Object.keys(p.b) as (keyof Brand)[]).every((k) => p.b[k] === s.brand[k]) ? "on" : ""}>
                    <i style={{ background: p.b.primary }} /><i style={{ background: p.b.accent }} /><i style={{ background: p.b.tile }} />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
              <div className="hc-labgrp hc-labtoks">
                {TOKENS.map((f) => {
                  const v = s.brand[f.k];
                  return (
                    <label key={f.k} className="hc-labtok" title={f.hint}>
                      <input type="color" value={HEX.test(v) ? v : "#000000"} onChange={(e) => set("brand", { ...s.brand, [f.k]: e.target.value })} aria-label={f.name} />
                      <span><b>{f.name}</b>
                        <input className="hc-labhex" value={v} maxLength={7} spellCheck={false} aria-label={`${f.name}, hex`} aria-invalid={!HEX.test(v)}
                          onChange={(e) => { const x = e.target.value.trim(); set("brand", { ...s.brand, [f.k]: x.startsWith("#") ? x : "#" + x }); }} />
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="hc-labhint">The Diwali theme draws its own palette; these apply on the Normal theme.</p>
            </fieldset>
          </>)}
        </aside>

        <div className="hc-labview">
          <nav className="hc-labpick" aria-label="Landing page template">
            {LISTING.map((g) => (
              <div key={g.group} className="hc-labpickg">
                <span>{g.group}</span>
                <div>
                  {g.items.map((t) => (
                    <button key={t.id} type="button" className={s.page === t.id ? "on" : ""} aria-pressed={s.page === t.id} title={t.hint}
                      onClick={() => { setMeta(null); set("page", t.id); }}>{t.name}</button>
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
            <a className="hc-btn ghost" href={`/lp-design/${page}.html#c=${shareCode}`} target="_blank" rel="noreferrer">Open</a>
            <button type="button" className="hc-btn primary" onClick={copy}>{copied ? "Link copied" : "Copy share link"}</button>
          </div>

          <div ref={stage} className={"hc-labstage " + view}
            style={view === "desktop" ? { height: DESK_H * scale } : { height: PHONE_H * 0.82 + 36 }}>
            <iframe
              key={`${page}-${view}`}
              title={`${item.name} landing page`}
              src={`/lp-design/${page}.html#c=${frameCode}`}
              className="hc-labframe"
              style={view === "desktop" ? { width: DESK_W, height: DESK_H, zoom: scale } : { width: PHONE_W, height: PHONE_H, zoom: 0.82 }}
            />
          </div>
          <p className="hc-note">
            Drawn from the landing page design files. Click through it as a shopper: add products, open Subscribe, change the plan.
            {sub && !s.product && " Pick a product under Products to put your own on the page."}
          </p>
        </div>
      </div>
    </section>
  );
}
