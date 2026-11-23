import { useState, useEffect, useRef, useMemo, useContext, createContext, Fragment } from "react";
import * as Lucide from "lucide-react";

/* =====================================================================
   StackBack token engine — same tokens as the other landing pages
   ===================================================================== */
const BRAND = {
  primary: "#000000",
  secondary: "#fcfbfc",
  accent: "#95e534",
  tileText: "#1c401e",
  bg: "#ffffff",
  tile: "#ffffff", // tile = bg (default rule §1a)
};

const GREY_LIGHT = "#e8e8e8";
const GREY_DARK = "#c4c4c4";
const IMG_GREY = "#e6e6e6";
const DROPDOWN_FIELD_GREY = "#f7f7f7";
const GREY_TEXT_ON_LIGHT = "#6b6b6b";
const GREY_TEXT_ON_DARK = "#a3a3a3";

const hexToRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex([0, 1, 2].map((i) => A[i] * t + B[i] * (1 - t))); };
const lum = (h) => { const c = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b)); return (hi + 0.05) / (lo + 0.05); };
const readable = (h) => (contrast("#000000", h) >= contrast("#ffffff", h) ? "#111111" : "#ffffff");
const greyOn = (surface) => (contrast("#000000", surface) >= contrast("#ffffff", surface) ? GREY_TEXT_ON_LIGHT : GREY_TEXT_ON_DARK);

function buildTokens(brand) {
  const { primary, secondary, accent, tileText, bg, tile } = brand;
  const onPrimary = readable(primary);
  const onSecondary = readable(secondary);
  return {
    primary, secondary, accent, tileText, bg, tile,
    inkOnBg: readable(bg),
    inkOnTile: readable(tile),
    onPrimary, onSecondary,
    onAccent: readable(accent),
    subOnPrimary: mix(onPrimary, primary, 0.62),
    selBg: secondary,
    selBorder: secondary,
  };
}

const makeC = (t) => ({
  inkOnBg: t.inkOnBg,
  inkOnTile: t.inkOnTile,
  inkOnSelBg: readable(t.selBg),
  nameOnTile: mix(t.tileText, t.tile, 0.72),
  priceOnTile: t.tileText,
  dropdownText: greyOn(mix(t.bg, t.tile, 0.5)),
  mutedOnTile: greyOn(t.tile),
  accentSafe: contrast(t.accent, t.tile) >= 2.2 ? t.accent : readable(t.tile),
  accentOnSel: contrast(t.accent, t.selBg) >= 2.2 ? t.accent : readable(t.selBg),
  primary: t.primary,
  white: t.tile,
  bg: t.bg,
  onBar: t.onPrimary,
  subOnBar: t.subOnPrimary,
  onSel: readable(t.accent),
  onAccent: t.onAccent,
  muted: mix(t.onPrimary, t.primary, 0.4),
  border: GREY_DARK,
  borderLite: GREY_LIGHT,
  fill: IMG_GREY,
  grayBg: DROPDOWN_FIELD_GREY,
  // variant dropdowns inside a product card: always a step away from the card's own colour so they pop —
  // light card → soft grey field; selected card (grey wash) → white field. Dark cards mirror this.
  fieldOnTile: lum(t.tile) > 0.5 ? mix("#000000", t.tile, 0.07) : mix("#ffffff", t.tile, 0.12),
  fieldOnSel: lum(t.tile) > 0.5 ? "#ffffff" : mix("#ffffff", t.tile, 0.2),
  red: t.secondary,
  accent: t.accent,
  onBarAccent: contrast(t.accent, t.primary) >= 2.5 ? t.accent : t.onPrimary,
  yellowBg: t.selBg,
  yellowBd: mix(t.secondary, t.bg, 0.55),
  canvas: mix(t.inkOnBg, t.bg, 0.16),
  divider: GREY_DARK,
});

const RADII = { sharp: 0, semi: 8, rounded: 16 };
function shapeFor(type, custom) {
  const card = type === "custom" ? Math.max(0, Math.min(16, Number(custom) || 0)) : RADII[type];
  return { card, img: Math.max(0, card - 2), pill: card === 0 ? 0 : 999, round: card === 0 ? card : "50%" };
}
function buildShapeCtx(shape, surface) {
  const sh = shape;
  const shadowMode = surface === "shadow";
  const noneMode = surface === "none";
  const S = {
    pop: shadowMode ? "0 1px 0 rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.09)" : "none",
    sel: shadowMode ? "0 1px 0 rgba(0,0,0,0.09), 0 3px 8px rgba(0,0,0,0.08)" : "none",
    unsel: shadowMode ? "0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.05)" : "none",
  };
  return { sh, shadowMode, noneMode, S };
}

const C = makeC(buildTokens(BRAND));
const { sh, noneMode, S } = buildShapeCtx(shapeFor("rounded"), "stroke");
const stroke = (w, col) => (noneMode ? "none" : `${w}px solid ${col}`);
const MUTED = greyOn(C.bg);

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const EASE_MICRO = "cubic-bezier(.4,0,.2,1)";

const EASE_COLLAPSE = "cubic-bezier(.22,1,.36,1)";

const EASE_BOUNCY = "cubic-bezier(.34,1.4,.64,1)";
// Desktop is the same design on a 1.35× scale (see the desktop section), so type grows with everything else. FS only keeps
// ordinary text at 14px or more on the desktop screen: 14 / 1.35 ≈ 10.4 on the canvas. Small labels, tags and the announcement bar
// use their own sizes and are exempt, as before.
let DESK_MODE = false;   // (the old per-element desktop switches stay off — the scale does that job now)
let DESK = false;
const DESK_K = 1.35;
const FS = (n) => (DESK ? Math.max(n, Math.ceil((14 / DESK_K) * 10) / 10) : n);
// Settings (set by the preview bar): MULTI = pick many per category (with a discount on each category); CATS = the 3 or 4 categories on show.
let MULTI = false;
// Layout version — V1: Prev / Next + the category nudge live in the bottom bar. V2: they sit in a slim bar right under the category pills
// (with the selection limit written in it), and the pills tuck away while you scroll down and come back when you scroll up.
const LAYOUT_V2 = false;
// Mix & Match "BXGY" setting: the last category is free — every product in it costs nothing, and it stays locked until every other category has a pick
let FREE_LAST = false;      // the setting is on (Mix & Match only)
// Mix & Match "Tiered" setting (needs Many per category): the more products in the whole bundle, the bigger the offer — the same offers as BYOB, one progress bar above the category heading
let TIERED = false;
const SET_DEFAULT = { type: "subscription", theme: "festive", festDark: "#7a0f1c", festLight: "#fff3d9", bannerType: "default", bannerPattern: "mandala", giftFlow: "default", giftWall: "on", subWidget: "single", subVariant: "pills", subOneTime: "on", subEndless: "on", subGift: "no", subGiftStyle: "env", flashBanner: 0, flashDays: "on", flashLive: 0, bxBuy: 6, bxFree: 2, offers: 4, byobMode: "tiered", pick: "one", mixMode: "normal", cats: 4, topBanner: true, catHeader: "plain", cards: "grid", flow: "steps", dock: "sticky", pills: "pills", mobNav: "bar", loader: "yes", autoMove: "yes" };
let SET = SET_DEFAULT;   // read by the components while they render (set from the settings panel)
const DM = (n) => (DESK_MODE ? Math.round(n * 1.12) : n);

const productOff = (p) => Math.round((1 - p.price / p.mrp) * 100);

const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;



function StyleTag() {
  useEffect(() => {
    if (document.getElementById("sb-inter")) return;
    const l = document.createElement("link");
    l.id = "sb-inter"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
  return (
    <style>{`
      .dk-root, .dk-root * { box-sizing: border-box; }
      .dk-root { -webkit-font-smoothing: antialiased; }
      .dk-root button, .dk-root input { font-family: inherit; }
      .dk-root button:focus-visible { outline: 2px solid ${C.primary}; outline-offset: 2px; }

      .sb-anim {
        transition:
          background-color .28s ${EASE_MICRO}, border-color .28s ${EASE_MICRO}, box-shadow .28s ${EASE_MICRO},
          color .24s ease, opacity .24s ease, transform .24s ${EASE_MICRO}, outline-color .28s ${EASE_MICRO};
      }
      @keyframes sbMenu { from { opacity:0; transform: translateY(-4px) } to { opacity:1; transform: translateY(0) } }
      .sb-menu { animation: sbMenu .16s ease both; transform-origin: top center; }
      .sb-scroll::-webkit-scrollbar { height: 0; width: 0; display: none; }
      .sb-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      @keyframes cardRefresh { from { opacity: 0.25; transform: scale(.97); } to { opacity: 1; transform: none; } }
      .card-refresh { animation: cardRefresh .32s ease-out; }
      @keyframes sbPop { from { transform: scale(.6); } to { transform: scale(1); } }
      .sb-pop { display: inline-block; animation: sbPop .2s ${EASE_BOUNCY} both; }
      @keyframes pulseBadge { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.07); } }
      .pulse-badge { animation: pulseBadge 1.8s ease-in-out infinite; }
      @keyframes pulseText { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
      .pulse-text { animation: pulseText 1.8s ease-in-out infinite; }
      @keyframes sbIn { from { opacity: 0; } to { opacity: 1; } }
      .sb-in { animation: sbIn .24s ${EASE_MICRO} both; }
      @keyframes sbToastIn { from { opacity:0; transform: translate(-50%, 6px); } to { opacity:1; transform: translate(-50%, 0); } }
      .sb-toast { animation: sbToastIn .22s ${EASE_MICRO} both; }
      /* the floating pill nudges: a soft accent ring while there is more to add, an arrow wiggle when it is ready */
      @keyframes sbRing { 0% { box-shadow: 0 10px 28px rgba(0,0,0,.14), 0 0 0 0 ${rgba(C.accent, 0.55)}; } 70%, 100% { box-shadow: 0 10px 28px rgba(0,0,0,.14), 0 0 0 9px ${rgba(C.accent, 0)}; } }
      .sb-nudge { animation: sbRing 2.2s ease-out infinite; }
      @keyframes sbWiggle { 0%, 55%, 100% { transform: translateX(0); } 18% { transform: translateX(4px); } 36% { transform: translateX(-1px); } }
      .sb-wiggle { animation: sbWiggle 1.6s ease-in-out infinite; }
      @keyframes sbBumpA { 0% { scale: 1; } 35% { scale: 1.06; } 100% { scale: 1; } }
      @keyframes sbBumpB { 0% { scale: 1; } 35% { scale: 1.06; } 100% { scale: 1; } }
      .sb-bump-a { animation: sbBumpA .5s ease-out; }
      .sb-bump-b { animation: sbBumpB .5s ease-out; }   /* two names so the bump restarts when another product is added straight away */

      /* "Build another bundle" arrives with a pop, then a soft ring pulses three times and stops */
      @keyframes sbAttnPop { 0% { opacity: 0; transform: scale(.88) translateY(6px); } 60% { opacity: 1; transform: scale(1.05); } 100% { opacity: 1; transform: none; } }
      @keyframes sbAttnRing { 0% { box-shadow: 0 0 0 0 ${rgba(FEST ? DIWALI.gold : C.accent, 0.7)}; } 80%, 100% { box-shadow: 0 0 0 10px ${rgba(FEST ? DIWALI.gold : C.accent, 0)}; } }
      .sb-attn { animation: sbAttnPop .5s ${EASE_BOUNCY} both, sbAttnRing .9s ease-out .45s 3; }

      .sb-hue { -webkit-appearance: none; appearance: none; width: 100%; height: 14px; margin: 0; border-radius: 999px; outline: none; cursor: pointer; border: 1px solid rgba(0,0,0,.08); }
      .sb-hue::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 2px solid #111; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
      .sb-hue::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid #111; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
      .fb-opt:hover { background: ${C.grayBg}; }
      .fb-step:hover:not(:disabled) { background: ${mix(C.onBar, C.primary, 0.14)}; }
      .fb-cta:hover:not(:disabled) { background: ${mix(C.onBar, C.primary, 0.14)}; }
      .fb-ghost:hover:not(:disabled) { border-color: ${C.primary}; }

      /* announcement flip */
      .tick-wrap { perspective: 500px; }
      .tick-item { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; backface-visibility: hidden; }
      .tick-item.tick-cur { opacity: 1; animation: tickIn .55s ${EASE_COLLAPSE} both; }
      .tick-item.tick-prev { animation: tickOut .55s ${EASE_MICRO} both; }
      @keyframes tickIn { from { opacity: 0; transform: rotateX(-80deg) translateY(40%); } to { opacity: 1; transform: none; } }
      @keyframes tickOut { from { opacity: 1; transform: none; } to { opacity: 0; transform: rotateX(80deg) translateY(-40%); } }

      @media (prefers-reduced-motion: reduce) {
        .sb-anim, .sb-menu, .sb-pop, .sb-in, .sb-backdrop, .card-refresh, .fb-motion, .sb-toast, .tick-item, .sb-nudge, .sb-attn, .sb-wiggle, .sb-bump-a, .sb-bump-b, .pulse-badge, .pulse-text {
          transition: none !important; animation: none !important;
        }
      }
    `}</style>
  );
}

const Icon = ({ d, size = 18, w = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

const IconDown = ({ size = 14 }) => <Icon size={size} w={1.8} d={<path d="M6 9l6 6 6-6" />} />;

const IconCheck = ({ size = 14, w = 2.2 }) => <Icon size={size} w={w} d={<path d="M5 12l5 5L20 7" />} />;

function Dropdown({ value, options, onChange, label, a11y, h = 40, menuW, full, fs = 12.5, bg = C.grayBg, edge, menuMax, scrollIn }) {   // edge: the border colour (default light grey) · menuMax: the list scrolls past this height
  const [open, setOpen] = useState(false);
  const ref = useRef(null), menuRef = useRef(null);
  // scrollIn: when the list opens, scroll the nearest scrolling parent (e.g. the product drawer) so the whole list is in view
  useEffect(() => {
    if (!open || !scrollIn) return;
    const t = setTimeout(() => {
      const wrap = ref.current, menu = menuRef.current; if (!wrap || !menu) return;
      let sc = wrap.parentElement;
      while (sc && sc !== document.body) { const oy = getComputedStyle(sc).overflowY; if ((oy === "auto" || oy === "scroll") && sc.scrollHeight > sc.clientHeight) break; sc = sc.parentElement; }
      if (!sc || sc === document.body) { menu.scrollIntoView({ block: "nearest", behavior: "smooth" }); return; }
      const cr = sc.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      const bottom = wr.top + h + 6 + menu.offsetHeight;          // layout height — unaffected by the open animation
      const over = bottom - (cr.bottom - 12);
      if (over > 0) sc.scrollBy({ top: over, behavior: "smooth" });
    }, 30);
    return () => clearTimeout(t);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative", width: full ? "100%" : "auto" }}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={a11y ? `${a11y}: ${value}` : undefined} className="sb-anim"
        style={{ height: h, width: full ? "100%" : "auto", padding: `0 ${DM(12)}px`, borderRadius: sh.pill, background: bg, border: edge ? stroke(1, edge) : stroke(0.75, GREY_LIGHT), color: C.dropdownText, display: "flex", alignItems: "center", gap: DM(7), cursor: "pointer", fontSize: FS(fs), whiteSpace: "nowrap" }}>
        {label && <span style={{ flexShrink: 0 }}>{label}</span>}
        <span style={{ fontWeight: 600, flex: full ? 1 : "none", textAlign: "left", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        <span className="fb-motion" style={{ display: "flex", flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: `transform .24s ${EASE_MICRO}` }}><IconDown size={DM(14)} /></span>
      </button>
      {open && (
        <div role="listbox" className="sb-menu" ref={menuRef}
          style={{ position: "absolute", top: h + 6, left: 0, width: menuW || "100%", minWidth: DM(150), zIndex: 40, background: C.bg, border: stroke(0.75, GREY_LIGHT), borderRadius: sh.img, padding: 4, boxShadow: S.pop, ...(menuMax ? { maxHeight: menuMax, overflowY: "auto" } : {}) }}>
          {options.map((o) => (
            <button key={o} role="option" aria-selected={o === value} className="fb-opt sb-anim" onClick={() => { onChange(o); setOpen(false); }}
              style={{ width: "100%", height: DM(34), padding: `0 ${DM(10)}px`, border: "none", background: "transparent", borderRadius: Math.max(2, sh.img - 4), display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontSize: FS(12.5), color: C.dropdownText, fontWeight: o === value ? 600 : 400 }}>
              {o}
              {o === value && <IconCheck size={DM(14)} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   PAGE COPY — everything a brand edits lives here
   ===================================================================== */
const COPY = {
  brand: "Your Brand",
  // announcement bar — one line per message; wrap the key phrase in *stars* to highlight it in green. Add as many as you like (this is the "backend setting"):
  // they flip one at a time, every `announceEvery` ms. Single message = no flipping.
  announcements: ["Free Shipping on *Every Single Order*", "*Pick 3 Products*, Pay One Fixed Price", "Order by 5 PM for *Same-Day Dispatch*"],   // *phrase* = shown in green · shown in Title Case
  announceEvery: 3000,
  eyebrow: "Mix & Match",                                    // small label above the heading
  heading: "Build your bundle, your way.",                   // banner heading
  sub: "Pick one product from each category at one fixed price.",   // banner sub-text   [≤ 60 chars, 2 lines]
  pills: ["Free Shipping", "One Fixed Price", "Free Gift"],  // 3 small info pills in the banner [≤ 16 chars each]
  bannerImage: "",                                          // banner artwork URL, 2:1 — recommended 786 × 393 px
  subscribeOff: 5,                                          // % off shown in green on the Subscribe button
  // "pick many" setting — content that changes with it
  announcementsMulti: ["Free Shipping on *Every Single Order*", "*Pick As Many As You Like*, Save More On Each", "Order by 5 PM for *Same-Day Dispatch*"],
  subMulti: "Pick as many as you like from each category. Every category has its own discount.",   // banner sub-text
  festMessage: "Wishing you a joyous Diwali",          // the thin Diwali banner under the products — the merchant's message
  logo: "",                                           // …and the brand logo next to it (image URL; empty = a monogram of the brand name)
  bundleName: "The Signature Bundle",                   // BXGY: the page heading
  // BYOB (build your own bundle)
  announcementsByob: ["Free Shipping on *Every Single Order*", "*The More You Add*, The More You Save", "Order by 5 PM for *Same-Day Dispatch*"],
  subByob: "Add as many products as you like. The more you add, the more offers you unlock.",
  // BYOB with the "% OFF" offer ({n} products, {off}% off)
  subByobFlat: "Add any {n} products to your bundle and get {off}% OFF.",
  announcementByobFlat: "*Add {n} Products*, Get {off}% OFF",
  stepByobFlat: "Add any {n} products to get {off}% OFF.",
  eyebrowByob: "Build your own",
  // Mix & Match with the "BXGY" setting on: the last category is free and locked until the others are picked ({n} = paid categories, {free} = the free category)
  eyebrowFree: "Mix & Match · Buy {n} Get 1 Free",
  subFree: "Pick one from each of the first {n} categories, then claim 1 product from {free} free.",
  subFreeMulti: "Pick as many as you like from the first {n} categories, then claim 1 product from {free} free.",
  announcementFree: "*Pick {n}, Get 1 Free* From {free}",
  stepFreeLocked: "Locked. Pick from every other category to unlock 1 free product.",
  stepFreeOpen: "Unlocked! Choose any 1, it's on us.",
};
const flatCopy = (t) => t.replace(/\{n\}/g, String(BYOB_FLAT_DEAL.n)).replace(/\{off\}/g, String(BYOB_FLAT_DEAL.off));
const freeCopy = (t) => t.replace(/\{n\}/g, String(LAST)).replace(/\{free\}/g, CATS[LAST].title);

/* =====================================================================
   Demo data — three categories, the shopper picks exactly ONE from each
   ===================================================================== */
const mk = (key, v2, rows) => rows.map(([name, price, mrp, a, b], i) => ({
  id: `${key}-${i}`, name, price, mrp, tag: i === 0 ? "Bestseller" : i === 4 ? "New" : undefined,
  variants: [{ label: "Size", options: [a, b] }, v2],
}));
const GRIND = { label: "Grind", options: ["Whole bean", "Filter", "Espresso"] };
// each category can carry a banner (video or image, 2:1) shown under its heading when the "With banner" setting is on:
//   video: "https://…/clip.mp4", image: "https://…/poster.jpg"   — leave both empty for a plain grey container
const CATS_ALL = [
  { key: "beans", label: "Choose Beans", title: "Whole Beans", off: 10, video: "", image: "", sub: "Choose any 1 to start your bundle.",
    products: mk("beans", GRIND, [
      ["Chikmagalur Estate Medium Roast", 549, 649, "250g", "500g"], ["Coorg Bold Dark Roast", 499, 599, "250g", "500g"],
      ["Araku Valley Light Roast", 599, 699, "250g", "500g"], ["Ratnagiri Micro-lot Natural", 749, 899, "250g", "500g"],
      ["Monsooned Malabar", 529, 629, "250g", "500g"], ["Baba Budan Single Origin", 649, 799, "250g", "500g"] ]) },
  { key: "blends", label: "Pick A Blend", title: "Ground Blends", off: 8, video: "", image: "", sub: "Choose any 1 to keep building your bundle.",
    products: mk("blends", GRIND, [
      ["Morning Ritual Filter Blend", 449, 549, "250g", "500g"], ["Classic South Indian Blend", 399, 499, "250g", "500g"],
      ["Espresso House Blend", 479, 579, "250g", "500g"], ["French Roast Chicory Mix", 359, 449, "250g", "500g"],
      ["Mocha Java Blend", 519, 629, "250g", "500g"], ["Decaf Smooth Blend", 489, 599, "250g", "500g"] ]) },
  { key: "cold", label: "Add Cold Brew", title: "Cold Brew", off: 12, video: "", image: "", sub: "Choose any 1 to keep building your bundle.",
    products: mk("cold", { label: "Style", options: ["Regular", "Less sweet"] }, [
      ["Cold Brew Concentrate", 349, 429, "500ml", "1L"], ["Cold Brew Bags", 399, 499, "8 bags", "16 bags"],
      ["Vanilla Cold Brew Bottle", 189, 229, "250ml", "500ml"], ["Hazelnut Cold Brew Bottle", 189, 229, "250ml", "500ml"],
      ["Nitro Cold Brew Can", 119, 149, "1 can", "6 cans"], ["Cold Brew Coffee Cans", 599, 749, "6 cans", "12 cans"] ]) },
  // the 4th category — shown only when the "4 categories" setting is on
  { key: "drip", label: "Add Drip Bags", title: "Drip Bags", off: 15, video: "", image: "", sub: "Choose any 1 to complete your bundle.",
    products: mk("drip", { label: "Roast", options: ["Medium", "Dark"] }, [
      ["Single Serve Drip Bags", 299, 349, "10 bags", "20 bags"], ["Dark Roast Drip Bags", 319, 379, "10 bags", "20 bags"],
      ["Decaf Drip Bags", 329, 389, "10 bags", "20 bags"], ["Estate Reserve Drip Bags", 449, 529, "10 bags", "20 bags"],
      ["Travel Pack Drip Bags", 199, 239, "5 bags", "10 bags"], ["Festive Gift Drip Box", 549, 649, "12 bags", "24 bags"] ]) },
];
let CATS = CATS_ALL.slice(0, 3);   // the categories on show (3 or 4, from the preview bar)
let LAST = CATS.length - 1;
// ---- BXGY (buy X, get Y free): a fixed set of products — all of them already in — and the free product(s) that come with it ----
let FEST = true;                                                                      // the Diwali (festive) theme is on — set from the settings
let BXGY = false;                                                                     // the page type "BXGY" is on (also on for "Fixed": the same page, just no free products)
let FIXED = false;                                                                    // the page type "Fixed bundle": one fixed bundle, nothing free
const BXGY_POOL = [...CATS_ALL[0].products, ...CATS_ALL[1].products];                // the products you buy (the first N are used)
const BXGY_REWARD_POOL = [                                                            // the free ones — shown as the first cards, in green
  { id: "r100", name: "Ceramic Brew Mug", variant: "300ml • Sand", price: 0, mrp: 499, reward: true, variants: [] },
  { id: "r101", name: "Steel Coffee Scoop", variant: "10g • Matte Black", price: 0, mrp: 249, reward: true, variants: [] },
];
let BXGY_REWARDS = BXGY_REWARD_POOL;
const BXGY_CATS = [{ key: "bundle", label: "Your Bundle", title: "Your Bundle", off: 0, video: "", image: "", sub: "", products: BXGY_POOL.slice(0, 6) }];
const bxgyAnnouncements = () => ["Free Shipping on *Every Single Order*", FIXED ? `*${BXGY_CATS[0].products.length} Products, One Bundle*, One Price` : `*Buy ${BXGY_CATS[0].products.length}, Get ${BXGY_REWARDS.length} Free*, Added At Checkout`, "Order by 5 PM for *Same-Day Dispatch*"];
// ---- BYOB (build your own bundle): no categories — one collection of products, and offers that grow with every product added ----
let BYOB = false;                                                                     // the page type "BYOB" is on
const BYOB_TIER_SETS = {                                                              // products in the bundle → % off
  4: [{ n: 2, off: 10 }, { n: 4, off: 15 }, { n: 6, off: 20 }, { n: 8, off: 25 }],
  6: [{ n: 2, off: 10 }, { n: 4, off: 15 }, { n: 6, off: 20 }, { n: 8, off: 25 }, { n: 10, off: 30 }, { n: 12, off: 35 }],   // more than 4 → the bar scrolls sideways on mobile
};
// BYOB offer style (setting): "tiered" = the offers grow as you add · "flat" = one fixed deal — add exactly BYOB_FLAT_DEAL.n products (mandatory, and the most you can add) to get BYOB_FLAT_DEAL.off % off
let BYOB_FLAT = false;
const BYOB_FLAT_DEAL = { n: 6, off: 20 };
let BYOB_TIERS = BYOB_TIER_SETS[4];                                                   // the active set (chosen in the settings)
let BYOB_MIN = BYOB_TIERS[0].n;                                                       // the bundle can be bought from this many products
const BYOB_CATS = [{ key: "all", label: "All Products", title: "All Products", off: BYOB_TIERS[BYOB_TIERS.length - 1].off, video: "", image: "", sub: "",
  products: [...CATS_ALL[0].products, ...CATS_ALL[1].products] }];
/* =====================================================================
   Layout constants (px) — the phone is 393 × 852 (iPhone 15 / 16 screen)
   ===================================================================== */
const PHONE_W = 393, PHONE_H = 852, SIDE = 16, CONT_SIDE = 10;
const DESK_W = 1440, DESK_H = 821;                                         // the desktop frame you see
const DL_W = Math.round(DESK_W / DESK_K), DL_H = Math.round(DESK_H / DESK_K);   // …laid out as a 1067 × 608 canvas, then scaled up by DESK_K
const DESK_SIDE = 92;                                                       // desktop page margin → an 883px column: 4 cards of ~208px
const ANN_H = 34;      // announcement bar
const LINE = GREY_LIGHT;
const PAGE_BG = mix(GREY_LIGHT, C.white, 0.5);

/* =====================================================================
   1 · Announcement bar — same black bar and type as the other pages, not sticky.
   Messages flip one at a time; the *highlighted* phrase is green.
   ===================================================================== */
// Title Case for the announcement bar (small words stay lower-case; words already capitalised, like "PM", are left alone)
const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "up", "via", "with"]);
const titleCase = (str) => String(str).replace(/(^|[\s\-*(])([a-z][a-z']*)/g, (m, pre, w, off) => {
  const first = off === 0 || (off === 1 && str[0] === "*");
  if (w === "am" || w === "pm") return pre + w.toUpperCase();
  return !first && pre !== "-" && SMALL.has(w) ? m : pre + w[0].toUpperCase() + w.slice(1);
});
function Msg({ text }) {
  return <>{titleCase(text).split("*").map((part, i) => (i % 2 ? <span key={i} style={{ color: FEST ? DIWALI.goldBright : C.onBarAccent, fontWeight: 600 }}>{part}</span> : <span key={i}>{part}</span>))}</>;
}
function Announcements() {
  const list = (FEST ? festAnnouncements() : BYOB ? (BYOB_FLAT ? [COPY.announcementsByob[0], flatCopy(COPY.announcementByobFlat), COPY.announcementsByob[2]] : COPY.announcementsByob) : BXGY ? bxgyAnnouncements() : FREE_LAST ? [COPY.announcements[0], freeCopy(COPY.announcementFree), COPY.announcements[2]] : MULTI ? COPY.announcementsMulti : COPY.announcements).filter(Boolean);
  const [st, setSt] = useState({ cur: 0, prev: -1 });
  useEffect(() => {
    if (list.length < 2) return;
    const t = setInterval(() => setSt((s) => ({ cur: (s.cur + 1) % list.length, prev: s.cur })), COPY.announceEvery);
    return () => clearInterval(t);
  }, [list.length]);
  return (
    <div className="tick-wrap" role="status" aria-live="off" style={{ position: "relative", height: DESK_MODE ? 34 : ANN_H, background: C.primary, overflow: "hidden" }}>
      {list.map((t, i) => (
        <div key={i} className={"tick-item" + (i === st.cur ? " tick-cur" : i === st.prev ? " tick-prev" : "")}
          style={{ fontSize: 11.5, letterSpacing: "0.01em", color: FEST ? DIWALI.goldPale : C.subOnBar, padding: "0 12px", textAlign: "center", whiteSpace: "nowrap" }}><span><Msg text={t} /></span></div>
      ))}
      {FEST && <FestShimmer />}
    </div>
  );
}
/* ---- the default Diwali banner: a gradient from the chosen dark colour, the gold pattern, a shimmer ---- */
const festUri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27")}")`;
/* =====================================================================
   DIWALI PATTERN SET — a small reusable set of festive tile patterns (SVG, drawn in code). Every pattern is a thin line drawing in the gold-pale family at a low opacity, so it sits on
   ANY dark colour the two Diwali colour tokens can produce and never fights the text on top. To use one anywhere (a banner, a band, a card):
   const P = festPattern("mandala" | "paisley" | "jali");  →  backgroundImage: P.url, backgroundSize: `${P.size}px ${P.size}px`.
   To add a pattern: add one entry to FEST_PATTERNS ({ id, label, size, draw(c) → svg shapes }) — it then shows in the settings and everywhere festPattern() is used.
   ===================================================================== */
const FEST_PATTERNS = [
  { id: "mandala", label: "Mandala", size: 34, op: 0.16, draw: (sz) => {                       // an eight-petal flower in a ring, quarter circles at the corners
    const c = sz / 2, petals = Array.from({ length: 8 }, (_, i) => `<ellipse cx='${c}' cy='${c - 5.6}' rx='1.5' ry='3.4' transform='rotate(${i * 45} ${c} ${c})'/>`).join("");
    return `<circle cx='${c}' cy='${c}' r='1.6'/>${petals}<circle cx='${c}' cy='${c}' r='11'/><circle cx='0' cy='0' r='5'/><circle cx='${sz}' cy='0' r='5'/><circle cx='0' cy='${sz}' r='5'/><circle cx='${sz}' cy='${sz}' r='5'/>`; } },
  { id: "paisley", label: "Paisley", size: 52, op: 0.22, draw: (sz) => {                         // the classic boteh: two curled teardrops, head to tail, an inner line in each, dots between
    const boteh = "M0,-17 C9,-12 14,-2 11,7 C8,15 -1,18 -7,14 C-12,10 -10,3 -5,2 C-1,1 1,5 -1,8 C3,6 4,0 1,-4 C-2,-8 -2,-13 0,-17 Z";
    const one = (x, y, r) => `<g transform='translate(${x} ${y}) rotate(${r}) scale(.7)'><path d='${boteh}'/><path d='${boteh}' transform='translate(1.5 4) scale(.55)'/></g>`;
    return one(sz * 0.27, sz * 0.3, 18) + one(sz * 0.77, sz * 0.8, 198) + `<circle cx='${sz * 0.8}' cy='${sz * 0.2}' r='1.2'/><circle cx='${sz * 0.22}' cy='${sz * 0.8}' r='1.2'/><circle cx='${sz * 0.52}' cy='${sz * 0.52}' r='.9'/><circle cx='${sz * 0.06}' cy='${sz * 0.52}' r='.8'/><circle cx='${sz * 0.96}' cy='${sz * 0.52}' r='.8'/>`; } },
  { id: "jali", label: "Jali", size: 32, op: 0.18, draw: (sz) => {                               // a lattice screen: eight-point stars that touch, with a dot in every star
    const c = sz / 2, h = sz * 0.34;
    return `<rect x='${c - h}' y='${c - h}' width='${h * 2}' height='${h * 2}'/><rect x='${c - h}' y='${c - h}' width='${h * 2}' height='${h * 2}' transform='rotate(45 ${c} ${c})'/><circle cx='${c}' cy='${c}' r='1.3'/><path d='M0 ${c} H${c - h * 1.41} M${c + h * 1.41} ${c} H${sz} M${c} 0 V${c - h * 1.41} M${c} ${c + h * 1.41} V${sz}'/>`; } },
];
const festPattern = (id = "mandala", color = DIWALI.goldPale) => {
  const P = FEST_PATTERNS.find((p) => p.id === id) || FEST_PATTERNS[0];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${P.size}' height='${P.size}' viewBox='0 0 ${P.size} ${P.size}' fill='none' stroke='${color}' stroke-opacity='${P.op}' stroke-width='.7' stroke-linecap='round' stroke-linejoin='round'>${P.draw(P.size)}</svg>`;
  return { url: festUri(svg), size: P.size, id: P.id, label: P.label };
};

/* =====================================================================
   Flash sale banners — from FlashSale_Banners.jsx, kept in their own scope so their
   names (K, COPY, CATS…) never clash with this page's. Only the top banner changes:
   Settings → "Diwali · banner" → Flash sale, then pick one of the thirteen.
   ===================================================================== */
const FLASH = (() => {

  const K = {
    night: "#24124A", nightDeep: "#170B33", nightSoft: "#33205F", nightLine: "rgba(255,226,170,.16)",
    marigold: "#FFB21E", marigoldDeep: "#E8890C", gold: "#FFD66B", flame: "#FFF4C7",
    kumkum: "#D42A3C", rani: "#CC2471", teal: "#11847E", leaf: "#2E8B57",
    paper: "#FFF1E4", card: "#FFFFFF", field: "#FBF4EC", line: "#EEDFD0", lineDark: "#D9C6B2",
    ink: "#24124A", muted: "#76678A", cream: "#FFF3DE", creamSoft: "rgba(255,243,222,.72)",
  };
  /* the banners take their colours from Settings → Diwali dark / light colour.
     Only the basics follow it: the banner backgrounds (the exact dark colour, never faded) and the cream text. Gold, pink and the other accents stay as they are. */
  let FX = { dark: "#7a0f1c", deep: "#4b0911", bright: "#9b2330", soft: "#8a2530", light: "#fff3d9" };
  const setFx = (p) => {
    FX = p;
    Object.assign(K, { night: p.dark, nightDeep: p.deep, nightSoft: p.soft, ink: p.dark, cream: p.light, creamSoft: rgba(p.light, 0.72), nightLine: rgba(p.light, 0.16) });
    CREAM = p.light; BLUE = p.dark;
    NIGHT_BG = `${STARS}, ${p.dark}`;
    /* every offer banner: the exact dark colour, no fade (the stars stay on top) */
    for (const k of ["o5", "o6", "o7", "o8", "o9", "o10"]) OFFER_LOOKS[k] = k === "o7" ? p.dark : `${STARS}, ${p.dark}`;
  };
  const FD = "'Rozha One', Georgia, 'Times New Roman', serif";
  const FB = "'Mukta', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const EASE = "cubic-bezier(.22,1,.36,1)";
  const EASE_B = "cubic-bezier(.34,1.45,.64,1)";
  const rgba = (h, a) => { const n = parseInt(h.replace("#", ""), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const pad2 = (n) => String(n).padStart(2, "0");
  const R = (m, d) => (DESK ? d : m);      // a mobile value or a desktop (layout-unit) value
  const COPY = {
    brand: "Your Brand",
    // *phrase* = shown in gold. They flip one at a time.
    announcements: ["Diwali Flash Sale *Ends At Midnight*", "Light Every Diya For *Extra Savings*", "Free *Festive Gift Box* With A Full Bundle", "Free Shipping On *Every Order*"],
    announcementsMulti: ["Diwali Flash Sale *Ends At Midnight*", "*Add As Many As You Like*, Save On Each", "Free *Festive Gift Box* With A Full Bundle", "Free Shipping On *Every Order*"],
    announceEvery: 3000,
    edition: "Diwali edition",
    heading: "Flash Sale",
    sub: "Pick one from each category. Every category you fill lights a diya, and every diya takes more off.",
    subMulti: "Add as many as you like. Each category has its own discount, and every diya you light takes more off.",
    subscribeOff: 5,
    gift: "Festive gift box",
    giftWorth: 399,
  };
  const TIER_OFF = [0, 0, 5, 10, 15];
  const STOCK = [7, 18, 4, 11, 23, 9, 14, 5, 19, 8, 3, 16];
  const mk = (key, ci, v2, rows) => rows.map(([name, price, mrp, a, b], i) => ({
    id: `${key}-${i}`, name, price, mrp, ci, i, gift: /gift/i.test(name),
    tag: i === 0 ? "Bestseller" : i === 4 ? "New" : /gift/i.test(name) ? "Festive pick" : undefined,
    stock: STOCK[(i * 5 + ci * 3) % STOCK.length],
    variants: [{ label: "Size", options: [a, b] }, v2],
  }));
  const GRIND = { label: "Grind", options: ["Whole bean", "Filter", "Espresso"] };
  const CATS_ALL = [
    { key: "beans", label: "Choose Beans", title: "Whole Beans", off: 10, kind: "pouch", tint: "#FFE2A6",
      products: mk("beans", 0, GRIND, [
        ["Chikmagalur Estate Medium Roast", 549, 649, "250g", "500g"], ["Coorg Bold Dark Roast", 499, 599, "250g", "500g"],
        ["Araku Valley Light Roast", 599, 699, "250g", "500g"], ["Ratnagiri Micro-lot Natural", 749, 899, "250g", "500g"],
        ["Monsooned Malabar", 529, 629, "250g", "500g"], ["Baba Budan Single Origin", 649, 799, "250g", "500g"] ]) },
    { key: "blends", label: "Pick A Blend", title: "Ground Blends", off: 8, kind: "tin", tint: "#FFD5CF",
      products: mk("blends", 1, GRIND, [
        ["Morning Ritual Filter Blend", 449, 549, "250g", "500g"], ["Classic South Indian Blend", 399, 499, "250g", "500g"],
        ["Espresso House Blend", 479, 579, "250g", "500g"], ["French Roast Chicory Mix", 359, 449, "250g", "500g"],
        ["Mocha Java Blend", 519, 629, "250g", "500g"], ["Decaf Smooth Blend", 489, 599, "250g", "500g"] ]) },
    { key: "cold", label: "Add Cold Brew", title: "Cold Brew", off: 12, kind: "bottle", tint: "#CDEDE8",
      products: mk("cold", 2, { label: "Style", options: ["Regular", "Less sweet"] }, [
        ["Cold Brew Concentrate", 349, 429, "500ml", "1L"], ["Cold Brew Bags", 399, 499, "8 bags", "16 bags"],
        ["Vanilla Cold Brew Bottle", 189, 229, "250ml", "500ml"], ["Hazelnut Cold Brew Bottle", 189, 229, "250ml", "500ml"],
        ["Nitro Cold Brew Can", 119, 149, "1 can", "6 cans"], ["Cold Brew Coffee Cans", 599, 749, "6 cans", "12 cans"] ]) },
    { key: "drip", label: "Add Drip Bags", title: "Drip Bags", off: 15, kind: "box", tint: "#E5DAFF",
      products: mk("drip", 3, { label: "Roast", options: ["Medium", "Dark"] }, [
        ["Single Serve Drip Bags", 299, 349, "10 bags", "20 bags"], ["Dark Roast Drip Bags", 319, 379, "10 bags", "20 bags"],
        ["Decaf Drip Bags", 329, 389, "10 bags", "20 bags"], ["Estate Reserve Drip Bags", 449, 529, "10 bags", "20 bags"],
        ["Travel Pack Drip Bags", 199, 239, "5 bags", "10 bags"], ["Festive Gift Drip Box", 549, 649, "12 bags", "24 bags"] ]) },
  ];
  const productOff = (p) => Math.round(((p.mrp - p.price) / p.mrp) * 100);
  const maxTier = () => TIER_OFF[CATS.length];
  const PHONE_W = 393, PHONE_H = 852, SIDE = 16;
  const DESK_K = 1.35, DESK_W = 1440, DESK_H = 821;
  const DL_W = Math.round(DESK_W / DESK_K);
  let DL_H = Math.round(DESK_H / DESK_K);   // desktop frame height — grows to fill the browser window (set in the app)
  const DESK_SIDE = 92;
  const Icon = ({ size = 16, w = 2, d }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
  const IconCheck = ({ size = 14, w = 2.6 }) => <Icon size={size} w={w} d={<path d="M5 12.5l4.2 4.2L19 7" />} />;
  const IconDown = ({ size = 16 }) => <Icon size={size} d={<path d="M6 9l6 6 6-6" />} />;
  const IconUp = ({ size = 16 }) => <Icon size={size} d={<path d="M6 15l6-6 6 6" />} />;
  const IconChevL = ({ size = 18 }) => <Icon size={size} w={2} d={<path d="M15 6l-6 6 6 6" />} />;
  const IconChevR = ({ size = 18 }) => <Icon size={size} w={2} d={<path d="M9 6l6 6-6 6" />} />;
  const IconGift = ({ size = 16 }) => <Icon size={size} w={1.8} d={<><rect x="3.5" y="9" width="17" height="11" rx="1.5" /><path d="M2.5 9h19M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zm0 0c2-4 6-4 6-1.5S14 9 12 9z" /></>} />;
  const IconBolt = ({ size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4 14h6.5L9.5 22 20 9.5h-6.6z" /></svg>;
  const IconArrow = ({ size = 16 }) => <Icon size={size} d={<path d="M5 12h14M13 6l6 6-6 6" />} />;
  const starPts = (n, R1, r1, cx = 0, cy = 0) => Array.from({ length: n * 2 }, (_, k) => {
    const a = (Math.PI * k) / n - Math.PI / 2, rr = k % 2 ? r1 : R1; return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
  }).join(" ");
  const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  function Diya({ x = 0, y = 0, s = 1, lit = true, dark = true, delay = 0 }) {
    const off = dark ? "rgba(255,240,214,.66)" : "#A8907A";
    return (
      <g transform={`translate(${x} ${y}) scale(${s})`}>
        {lit && <circle cx="0" cy="-9" r="16" fill={K.marigold} opacity=".16" />}
        {lit && <circle cx="0" cy="-9" r="9" fill={K.gold} opacity=".24" />}
        {lit && (
          <g className="flame" style={{ animationDelay: `${delay}s` }}>
            <path d="M0 -20 C6 -12 5 -5 0 -3 C-5 -5 -6 -12 0 -20 Z" fill={K.marigold} />
            <path d="M0 -13 C3 -9 2.6 -5.5 0 -4.5 C-2.6 -5.5 -3 -9 0 -13 Z" fill={K.flame} />
          </g>
        )}
        {!lit && <path d="M0 -4 V-8" stroke={off} strokeWidth="1.4" strokeLinecap="round" />}
        <path d="M-13 -3 H13 Q11.5 7.5 0 8.5 Q-11.5 7.5 -13 -3 Z" fill={lit ? K.kumkum : "none"} stroke={lit ? K.marigold : off} strokeWidth="1.4" strokeLinejoin="round" strokeDasharray={lit ? undefined : "2.4 2"} />
        {lit && <path d="M-8.5 1.5 Q0 4.5 8.5 1.5" stroke={K.gold} strokeWidth="1.3" fill="none" strokeDasharray="0.1 2.6" strokeLinecap="round" />}
      </g>
    );
  }
  function Firework({ x, y, r, color, delay = 0, rays = 14, still }) {
    const rnd = seeded(Math.abs(Math.round(x * 7 + y * 13 + r * 31)) + 7), n = Math.max(16, Math.round(rays * 2.2));
    const streaks = [], stars = [];
    for (let k = 0; k < n; k++) {
      const a = (Math.PI * 2 * k) / n + rnd() * 0.22, r0 = r * (0.16 + rnd() * 0.22), r1 = r * (0.62 + rnd() * 0.38), c = Math.cos(a), s = Math.sin(a);
      streaks.push(<line key={k} x1={x + c * r0} y1={y + s * r0} x2={x + c * r1} y2={y + s * r1 + r1 * 0.04} stroke={k % 4 ? "#FFF7E6" : color} strokeWidth={k % 3 ? 0.7 : 1.1} strokeLinecap="round" opacity={0.5 + rnd() * 0.5} />);
    }
    for (let k = 0; k < Math.round(n * 0.85); k++) {
      const a = rnd() * Math.PI * 2, rr = r * (0.95 + rnd() * 0.55);
      stars.push(<circle key={"s" + k} cx={x + Math.cos(a) * rr} cy={y + Math.sin(a) * rr + rr * 0.07} r={0.55 + rnd() * 0.95} fill={color} opacity={0.45 + rnd() * 0.55} />);
    }
    return (
      <g className={still ? undefined : "fw"} style={still ? undefined : { animationDelay: `${delay}s` }}>
        <circle cx={x} cy={y} r={r * 0.42} fill={color} opacity=".1" />
        {streaks}{stars}
        <circle cx={x} cy={y} r={Math.max(1.4, r * 0.07)} fill="#FFF7E6" />
      </g>
    );
  }
  function Mandala({ cx, cy, r, color = "#fff", op = 0.5 }) {
    return (
      <g opacity={op} fill={color}>
        {Array.from({ length: 10 }, (_, k) => <ellipse key={k} cx={cx} cy={cy - r * 0.62} rx={r * 0.15} ry={r * 0.32} transform={`rotate(${k * 36} ${cx} ${cy})`} />)}
        <circle cx={cx} cy={cy} r={r * 0.24} />
        {Array.from({ length: 20 }, (_, k) => { const a = (Math.PI * 2 * k) / 20; return <circle key={"d" + k} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r} r={r * 0.035} />; })}
      </g>
    );
  }
  function useCountdown() {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    const end = new Date(now); end.setHours(24, 0, 0, 0);
    const left = Math.max(0, end - now), sec = Math.floor(left / 1000);
    const claimed = Math.min(96, Math.round(58 + (1 - left / 86400000) * 37));
    return { h: Math.floor(sec / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60, claimed };
  }
  const timerLabel = (t) => `Sale ends in ${t.h} hours ${t.m} minutes ${t.s} seconds`;
  const clock = (t) => `${pad2(t.h)}:${pad2(t.m)}:${pad2(t.s)}`;
  const FJ = "'Jost', 'Futura', 'Century Gothic', 'Avenir Next', system-ui, sans-serif";
  const FSC = "'Yellowtail', 'Brush Script MT', cursive";
  const REDUCE = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>")`;
  const comboOff = () => { const mp = Math.max(...CATS.flatMap((c) => c.products.map(productOff))); return Math.round(100 * (1 - (1 - mp / 100) * (1 - maxTier() / 100))); };
  function FlipCard({ text, w, h, fs, bg, color, weight = 700, radius = 6, split, ls = 0 }) {
    const [st, setSt] = useState({ cur: text, prev: text, k: 0 });
    useEffect(() => { setSt((o) => (o.cur === text ? o : { cur: text, prev: o.cur, k: o.k + 1 })); }, [text]);
    const half = (val, bottom, extra, key) => (
      <div key={key} style={{ position: "absolute", left: 0, right: 0, top: bottom ? h / 2 : 0, height: h / 2, overflow: "hidden", background: bg, borderRadius: bottom ? `0 0 ${radius}px ${radius}px` : `${radius}px ${radius}px 0 0`, ...extra }}>
        <div style={{ height: h, lineHeight: `${h}px`, marginTop: bottom ? -h / 2 : 0, textAlign: "center", fontFamily: FJ, fontWeight: weight, fontSize: fs, color, letterSpacing: ls, fontVariantNumeric: "tabular-nums", whiteSpace: "pre" }}>{val}</div>
      </div>
    );
    const anim = st.k > 0 && !REDUCE;
    return (
      <div aria-hidden="true" style={{ position: "relative", width: w, height: h, perspective: h * 4, flexShrink: 0 }}>
        {half(st.cur, false, null, "t")}
        {half(anim ? st.prev : st.cur, true, null, "b")}
        {anim && half(st.prev, false, { transformOrigin: "50% 100%", animation: "fsFlapTop .28s ease-in both", backfaceVisibility: "hidden", zIndex: 2 }, "ft" + st.k)}
        {anim && half(st.cur, true, { transformOrigin: "50% 0", animation: "fsFlapBot .28s ease-out .28s both", backfaceVisibility: "hidden", zIndex: 2 }, "fb" + st.k)}
        {split && <div style={{ position: "absolute", left: 0, right: 0, top: h / 2 - 1, height: 2, background: split, zIndex: 3 }} />}
      </div>
    );
  }
  function Marquee({ items, bg, color, h, fs }) {
    const run = items.map((x, i) => <span key={i} style={{ padding: "0 18px", display: "inline-flex", alignItems: "center", gap: 18 }}>{x}<span aria-hidden="true">✦</span></span>);
    return (
      <div style={{ height: h, background: bg, color, overflow: "hidden", display: "flex", alignItems: "center", fontFamily: FJ, fontWeight: 700, fontSize: fs, letterSpacing: ".06em", whiteSpace: "nowrap", ...caps }}>
        <div className="fs-marquee" style={{ display: "inline-flex", flexShrink: 0 }}>{run}{run}{run}{run}</div>
      </div>
    );
  }
  let BLUE = "#2D1B8F", CREAM = "#FFF3C4";
  const STARS = "radial-gradient(1px 1px at 12% 22%, #fff, transparent), radial-gradient(1px 1px at 28% 70%, #fff, transparent), radial-gradient(1.5px 1.5px at 46% 18%, #fff, transparent), radial-gradient(1px 1px at 63% 56%, #fff, transparent), radial-gradient(1px 1px at 78% 26%, #fff, transparent), radial-gradient(1.5px 1.5px at 90% 68%, #fff, transparent), radial-gradient(1px 1px at 36% 42%, #fff, transparent), radial-gradient(1px 1px at 84% 48%, #fff, transparent)";
  function Lights({ w, h = 20, cols = [K.marigold, "#FF5C7A", "#7FE3D8", K.gold] }) {
    const N = Math.max(10, Math.round(w / 24)), waves = w > 600 ? 5 : 3;
    const pt = (t) => ({ x: t * w, y: 3 + (1 - Math.cos(t * Math.PI * 2 * waves)) * 3 });
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: "block", position: "relative", zIndex: 1 }} aria-hidden="true">
        <path d={Array.from({ length: 81 }, (_, k) => { const p = pt(k / 80); return `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }).join(" ")} stroke="rgba(255,240,210,.35)" strokeWidth="1" fill="none" />
        {Array.from({ length: N }, (_, k) => { const p = pt((k + 0.5) / N), c = cols[k % cols.length]; return (
          <g key={k} className="twinkle" style={{ animationDelay: `${(k % 5) * 0.4}s` }}>
            <circle cx={p.x} cy={p.y + 5} r="6" fill={c} opacity=".22" /><circle cx={p.x} cy={p.y + 5} r="2.6" fill={c} />
          </g>); })}
      </svg>
    );
  }
  const Burst = ({ x, y, r, c, dl = 0 }) => (
    <svg aria-hidden="true" width={r * 2.6} height={r * 2.6} viewBox={`${-r * 1.3} ${-r * 1.3} ${r * 2.6} ${r * 2.6}`} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", pointerEvents: "none", overflow: "visible" }}>
      <Firework x={0} y={0} r={r} color={c} delay={dl} rays={14} />
    </svg>
  );
  const frameW = (d) => (d ? DL_W : PHONE_W);
  function Tape2({ style }) {
    return (
      <div aria-hidden="true" style={{ position: "absolute", width: R(28, 34), height: "190%", top: "-45%", background: "#F7E6CE", boxShadow: "0 4px 12px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", ...style }}>
        <span style={{ writingMode: "vertical-rl", fontFamily: FJ, fontWeight: 700, fontSize: R(11, 12), color: K.kumkum, whiteSpace: "nowrap" }}>{"Shubh Deepavali ✦ ".repeat(8)}</span>
      </div>
    );
  }
  function BannerCopy({ tone, title }) {
    const chips = [[<IconBolt size={R(11, 10)} />, "Ends at midnight"], [<svg width={R(14, 12)} height={R(13, 11)} viewBox="-15 -21 30 30" aria-hidden="true"><Diya /></svg>, `Up to ${maxTier()}% extra`], [<IconGift size={R(13, 11)} />, "Free gift box"]];
    return (
      <div style={{ minWidth: 0 }}>
        {title || <h1 style={{ margin: 0, fontFamily: FD, fontWeight: 400, fontSize: R(52, 58), lineHeight: 0.95, color: tone.title || tone.ink }}>{COPY.heading}</h1>}
        <p style={{ margin: "12px 0 0", maxWidth: 380, fontFamily: FB, fontSize: R(14, 12.5), lineHeight: 1.5, color: tone.soft }}>{MULTI ? COPY.subMulti : COPY.sub}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: R(16, 16) }}>
          {chips.map(([ic, l]) => (
            <span key={l} style={{ height: R(28, 24), padding: "0 11px 0 9px", borderRadius: 999, border: `1px solid ${tone.line}`, background: tone.chip, color: tone.ink, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: R(12, 10.5), fontWeight: 600, whiteSpace: "nowrap" }}>
              <span style={{ color: tone.accent, display: "flex" }}>{ic}</span>{l}
            </span>
          ))}
        </div>
      </div>
    );
  }
  function BannerFrame({ d, bg, top, decor, bottom, copy, clock, clockW }) {
    return (
      <section style={{ position: "relative", overflow: "hidden", background: bg }}>
        {top}{decor}
        <div style={{ position: "relative", display: d ? "grid" : "flex", flexDirection: "column", gridTemplateColumns: d ? `1fr ${clockW}px` : undefined, alignItems: d ? "center" : "stretch", gap: d ? 56 : 28, minHeight: d ? 250 : undefined, boxSizing: "border-box", padding: d ? `40px ${DESK_SIDE}px 46px` : `32px ${SIDE}px 36px` }}>
          {copy}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>{clock}</div>
        </div>
        {bottom}
      </section>
    );
  }
  const clockLabel = (txt, col) => <div style={{ alignSelf: "stretch", textAlign: "center", fontFamily: FJ, fontSize: R(13.5, 13), fontWeight: 600, letterSpacing: ".18em", color: col, marginBottom: R(16, 18), textTransform: "uppercase" }}>{txt}</div>;
  const dots = (h, col, size = 5) => <span aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 7, height: h, justifyContent: "center" }}><i style={{ width: size, height: size, borderRadius: 9, background: col }} /><i style={{ width: size, height: size, borderRadius: 9, background: col }} /></span>;
  const darkTone = { ink: "#fff", soft: "rgba(255,255,255,.76)", accent: K.gold, line: "rgba(255,255,255,.3)", chip: "rgba(255,255,255,.07)", track: "rgba(255,255,255,.18)", fill: `linear-gradient(90deg, ${K.marigold}, ${K.gold})` };
  function BannerV1({ d }) {
    const t = useCountdown(), tw = R(84, 86), th = R(88, 88), fs = R(60, 62);
    const tile = (v, l) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <FlipCard text={pad2(v)} w={tw} h={th} fs={fs} bg={FX.deep} color="#fff" weight={300} radius={6} />
        <span style={{ fontFamily: FJ, fontSize: 10.5, fontWeight: 500, letterSpacing: ".12em", color: "rgba(255,255,255,.8)", textTransform: "uppercase" }}>{l}</span>
      </div>
    );
    return (
      <BannerFrame d={d} clockW={320} bg={FX.dark}
        top={<Lights w={frameW(d)} />}
        decor={<><Burst x={d ? "48%" : "86%"} y={d ? "34%" : "18%"} r={R(18, 24)} c={K.gold} /><Burst x={d ? "50%" : "92%"} y={d ? "78%" : "62%"} r={R(14, 18)} c="#FF9FB0" dl={1.3} /><Chakri x={d ? "96%" : "90%"} y={d ? "84%" : "9%"} size={R(14, 18)} /></>}
        copy={<BannerCopy tone={{ ...darkTone, title: "#fff" }} />}
        clock={<>{clockLabel("Sale ends in", "rgba(255,255,255,.8)")}<div role="timer" aria-label={timerLabel(t)} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>{tile(t.h, "Hours")}{dots(th, "#fff")}{tile(t.m, "Mins")}{dots(th, "#fff")}{tile(t.s, "Secs")}</div><Claimed tone={darkTone} /></>} />
    );
  }
  function BannerV2({ kit, d }) {
    const t = useCountdown(), w = R(38, 40), h = R(54, 56), fs = R(40, 42);
    const tone = { ...darkTone, accent: CREAM, title: CREAM, fill: CREAM };
    const grp = (v, l) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", gap: 4 }}>{pad2(v).split("").map((ch, i) => <FlipCard key={i} text={ch} w={w} h={h} fs={fs} bg={CREAM} color={BLUE} weight={800} radius={7} split={BLUE} />)}</div>
        <span style={{ fontFamily: FJ, fontSize: 10.5, fontWeight: 500, letterSpacing: ".12em", color: CREAM, textTransform: "uppercase" }}>{l}</span>
      </div>
    );
    return (
      <BannerFrame d={d} clockW={340} bg={`${STARS}, ${FX.dark}`}
        top={<Lights w={frameW(d)} />}
        decor={d ? <>
            <Firework2 x="51.5%" y="36%" size={54} hue="gold" delay={0} seed={3} />
            <Firework2 x="57%" y="74%" size={30} hue="pink" delay={1.6} seed={7} />
            <Firework2 x="42%" y="16%" size={20} hue="teal" delay={2.7} seed={11} />
            <Firework2 x="95%" y="26%" size={40} hue="pink" delay={0.9} seed={5} />
            <Firework2 x="76%" y="9%" size={16} hue="gold" delay={3.3} seed={13} />
            <Chakri x="97%" y="80%" size={16} />
          </> : <>
            <Chakri x="90%" y="9%" size={14} />
            <Firework2 x="74%" y="50%" size={26} hue="gold" delay={0} seed={3} />
            <Firework2 x="94%" y="72%" size={10} hue="pink" delay={1.5} seed={7} />
            <Firework2 x="6%" y="74%" size={11} hue="teal" delay={2.6} seed={11} />
          </>}
        copy={<BannerCopy tone={tone} title={<h1 style={{ margin: 0, fontFamily: FJ, fontWeight: 800, fontSize: R(46, 52), lineHeight: 0.95, color: CREAM, textTransform: "uppercase", letterSpacing: "-.01em" }}>{COPY.heading}</h1>} />}
        clock={<>{clockLabel("Countdown to midnight prices", CREAM)}<div role="timer" aria-label={timerLabel(t)} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>{grp(t.h, "Hours")}{dots(h, CREAM, 6)}{grp(t.m, "Mins")}{dots(h, CREAM, 6)}{grp(t.s, "Secs")}</div><Claimed tone={tone} /></>}
        bottom={<><DiyaLedge d={d} /><Marquee bg={CREAM} color={BLUE} h={26} fs={12} items={["Sale ends tonight", kit.nudge, `Up to ${comboOff()}% off`]} /></>} />
    );
  }
  function BannerV3({ kit, d }) {
    const t = useCountdown(), N = CATS.length, pink = "#FF4D6D", tube = "#FFFFFF", boxRed = "#4A0710";   // white tube light; the clock box is a deep red
    const tone = { ...darkTone, accent: "#FF8FA3", fill: `linear-gradient(90deg, ${pink}, ${K.gold})` };
    return (
      <BannerFrame d={d} clockW={360} bg={FX.dark}
        decor={d ? <><Burst x="50%" y="30%" r={20} c="#FF9FB0" /><Chakri x="50%" y="80%" size={16} /></> : <><Burst x="88%" y="9%" r={14} c={K.gold} /><Chakri x="92%" y="47%" size={13} /></>}
        top={<Lights w={frameW(d)} cols={[pink, K.gold, "#FFFFFF", "#FF9F1C"]} />}
        copy={<BannerCopy tone={tone} title={<h1 className="fs-neon" style={{ margin: 0, fontFamily: FJ, fontWeight: 300, fontSize: R(46, 54), lineHeight: 1, letterSpacing: ".06em", color: "#FFFFFF", textShadow: `0 0 3px #fff, 0 0 10px ${rgba(tube, 0.85)}, 0 0 22px ${rgba(tube, 0.55)}`, textTransform: "uppercase" }}>{COPY.heading}</h1>} />}
        clock={<>
          <div style={{ alignSelf: "stretch", background: `radial-gradient(ellipse at 50% 0%, #6B0D18, ${boxRed} 75%)`, borderRadius: 14, border: `1.5px solid ${tube}`, boxShadow: `0 0 12px ${rgba(tube, 0.55)}, inset 0 0 10px ${rgba(tube, 0.12)}`, overflow: "hidden" }}>
            <div style={{ padding: "16px 14px 14px", borderBottom: "1px solid rgba(255,255,255,.12)", textAlign: "center", fontFamily: FJ, fontSize: R(12, 12), fontWeight: 600, letterSpacing: ".22em", textTransform: "uppercase", color: "#fff" }}>Sale ends in</div>
            <div role="timer" aria-label={timerLabel(t)} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", padding: R("20px 4px 18px", "22px 4px 20px") }}>
              {[[t.h, "Hours"], [t.m, "Mins"], [t.s, "Secs"]].map(([v, l], k) => (
                <div key={l} style={{ borderLeft: k ? "1px solid rgba(255,255,255,.12)" : "none", textAlign: "center" }}>
                  <div style={{ overflow: "hidden", height: R(46, 50) }}>
                    <span key={v} className={k === 2 ? "fs-tick" : undefined} style={{ display: "inline-block", fontFamily: FJ, fontWeight: 800, fontSize: R(42, 46), lineHeight: R(46, 50) + "px", color: "#FFFFFF", fontVariantNumeric: "tabular-nums", textShadow: `0 0 4px #fff, 0 0 14px ${rgba(tube, 0.6)}` }}>{pad2(v)}</span>
                  </div>
                  <div style={{ fontFamily: FJ, fontWeight: 700, fontSize: R(10.5, 11), letterSpacing: ".12em", color: "rgba(255,255,255,.85)", textTransform: "uppercase", marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <Claimed tone={tone} />
        </>} />
    );
  }
  function BannerV4({ d }) {
    const t = useCountdown();
    const tone = { ...darkTone, title: "#fff", accent: "#FFE7A8" };
    const box = (v, u) => (
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 4, background: "#111", color: "#fff", padding: "10px 12px", borderRadius: 4 }}>
        <span key={v} className="fs-tick" style={{ display: "inline-block", fontFamily: FJ, fontWeight: 700, fontSize: R(34, 34), lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pad2(v)}</span>
        <span style={{ fontFamily: FJ, fontSize: 11, fontWeight: 500, opacity: 0.7 }}>{u}</span>
      </span>
    );
    const tapeH = (rot = -1.5, margin = "8px -10px 0") => (
      <div aria-hidden="true" style={{ height: 22, background: FX.light, overflow: "hidden", display: "flex", alignItems: "center", transform: `rotate(${rot}deg)`, margin, boxShadow: "0 3px 10px rgba(0,0,0,.2)" }}>
        <span style={{ fontFamily: FJ, fontWeight: 700, fontSize: 11, color: K.kumkum, whiteSpace: "nowrap", paddingLeft: 8 }}>{"Shubh Deepavali ✦ ".repeat(10)}</span>
      </div>
    );
    return (
      <BannerFrame d={d} clockW={300} bg={FX.dark}
        top={d ? null : tapeH()}
        bottom={d ? null : tapeH(1.5, "0 -10px 10px")}   /* mobile: the same ribbon along the bottom too */
        decor={d ? <><Tape2 style={{ right: 28, transform: "rotate(-12deg)" }} /><Tape2 style={{ left: 28, transform: "rotate(12deg)" }} /><Burst x="50%" y="30%" r={18} c={K.gold} /><Chakri x="50%" y="80%" size={16} /></> : <><Burst x="88%" y="30%" r={14} c={K.gold} /><Chakri x="90%" y="48%" size={13} /></>}
        copy={<BannerCopy tone={tone} title={<h1 style={{ margin: 0, fontFamily: FJ, fontWeight: 800, fontSize: R(46, 52), lineHeight: 0.95, textTransform: "uppercase", background: "linear-gradient(180deg, #FFF6DC, #F5C46A)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{COPY.heading}</h1>} />}
        clock={<>{clockLabel("Ends at midnight", "rgba(255,255,255,.85)")}<div role="timer" aria-label={timerLabel(t)} style={{ alignSelf: d ? "stretch" : "center", display: "flex", justifyContent: d ? "space-between" : "center", alignItems: "center", gap: d ? 6 : 10 }}>{box(t.h, "h")}<b>:</b>{box(t.m, "m")}<b>:</b>{box(t.s, "s")}</div><Claimed tone={tone} /></>} />
    );
  }
  function Firework2({ x, y, size, hue = "gold", delay = 0, seed = 1 }) {
    const col = { gold: "#FFC34D", pink: "#FF5C8A", teal: "#5FD3C6" }[hue] || "#FFC34D", S = size * 3.4;
    return (
      <svg aria-hidden="true" width={S} height={S} viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", pointerEvents: "none", overflow: "visible" }}>
        <g className="fs-boom" style={{ animationDelay: `${delay}s` }}><Firework x={0} y={0} r={size} color={col} rays={size > 40 ? 18 : 12} still /></g>
      </svg>
    );
  }
  function DiyaLedge({ d }) {
    const w = frameW(d), n = d ? 22 : 9;
    return (
      <svg aria-hidden="true" viewBox={`0 0 ${w} 22`} width={w} height="22" style={{ display: "block", position: "relative" }}>
        {Array.from({ length: n }, (_, k) => <Diya key={k} x={(w / n) * (k + 0.5)} y={18} s={0.62} delay={k * 0.31} />)}
      </svg>
    );
  }
  const Chakri = ({ x, y, size }) => null && (
    <svg aria-hidden="true" width={size * 2.2} height={size * 2.2} viewBox={`${-size * 1.1} ${-size * 1.1} ${size * 2.2} ${size * 2.2}`} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%,-50%)", pointerEvents: "none", overflow: "visible" }}><ChakriG size={size} /></svg>
  );
  function ChakriG({ x = 0, y = 0, size = 40 }) {
    if (size) return null;   // chakri removed from all banners
    const rnd = seeded(Math.round(size * 13) + 3), sparks = [];
    for (let k = 0; k < 84; k++) {
      const arm = k % 3, t = rnd(), ang = arm * 2.094 + t * 2.8 + rnd() * 0.35, rr = size * (0.2 + t * 0.62 + rnd() * 0.08), len = size * (0.05 + t * 0.14);
      const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr, tx = -Math.sin(ang), ty = Math.cos(ang);
      sparks.push(<line key={k} x1={px} y1={py} x2={px + tx * len} y2={py + ty * len} stroke={k % 5 ? "#FFB43A" : "#FFF1C2"} strokeWidth={0.7 + (1 - t) * 0.8} strokeLinecap="round" opacity={0.95 - t * 0.55} />);
    }
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r={size * 0.7} fill="#FFB43A" opacity=".08" />
        <circle r={size * 0.32} fill="#FFB43A" opacity=".16" />
        <g>{sparks}<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="1.1s" repeatCount="indefinite" /></g>
        <g>
          <circle r={size * 0.17} fill={K.kumkum} stroke={K.gold} strokeWidth={size * 0.025} />
          <circle r={size * 0.11} fill="#2B4FA8" />
          <circle r={size * 0.11} fill="none" stroke="#fff" strokeWidth={size * 0.012} strokeDasharray={`${size * 0.02} ${size * 0.03}`} />
          <circle r={size * 0.05} fill={K.marigold} />
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur=".5s" repeatCount="indefinite" />
        </g>
      </g>
    );
  }
  const ChipRow = ({ tone, center }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: center ? "center" : "flex-start" }}>
      {[[<IconBolt size={R(11, 10)} />, "Ends at midnight"], [<svg width={R(14, 12)} height={R(13, 11)} viewBox="-15 -21 30 30" aria-hidden="true"><Diya /></svg>, `Up to ${maxTier()}% extra`], [<IconGift size={R(13, 11)} />, "Free gift box"]].map(([ic, l]) => (
        <span key={l} style={{ height: R(28, 24), padding: "0 11px 0 9px", borderRadius: 999, border: `1px solid ${tone.line}`, background: tone.chip, color: tone.ink, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FB, fontSize: R(12, 10.5), fontWeight: 600, whiteSpace: "nowrap" }}>
          <span style={{ color: tone.accent, display: "flex" }}>{ic}</span>{l}
        </span>
      ))}
    </div>
  );
  const Sub = ({ tone, center, max = 380 }) => <p style={{ margin: 0, maxWidth: max, marginLeft: center ? "auto" : 0, marginRight: center ? "auto" : 0, fontFamily: FB, fontSize: R(14, 12.5), lineHeight: 1.5, color: tone.soft, textAlign: center ? "center" : "left" }}>{MULTI ? COPY.subMulti : COPY.sub}</p>;
  let NIGHT_BG = `${STARS}, radial-gradient(ellipse at 50% 30%, #241046, #120A24 75%)`;
  const capsLabel = (txt, col, center) => <div style={{ fontFamily: FJ, fontSize: R(12.5, 12.5), fontWeight: 600, letterSpacing: ".2em", color: col, textTransform: "uppercase", textAlign: center ? "center" : "left" }}>{txt}</div>;
  const FW = ({ x, y, r, c = K.gold, dl = 0 }) => <Burst x={x} y={y} r={r} c={c} dl={dl} />;
  function Bulbs({ n, vertical, style }) {
    return (
      <div aria-hidden="true" style={{ position: "absolute", display: "flex", flexDirection: vertical ? "column" : "row", justifyContent: "space-between", ...style }}>
        {Array.from({ length: n }, (_, i) => <i key={i} className="fs-bulb" style={{ width: R(10, 11), height: R(10, 11), borderRadius: 99, background: "radial-gradient(circle at 40% 35%, #FFFDF0, #FFE08A 45%, #FFB21E)", boxShadow: "0 0 8px #FFD36B, 0 0 18px rgba(255,190,60,.6)", animationDelay: i % 2 ? ".45s" : "0s" }} />)}
      </div>
    );
  }
  const OFFER_LOOKS = {
    o5: `${STARS}, linear-gradient(180deg, ${K.nightDeep}, ${K.night})`,
    o6: `${STARS}, linear-gradient(180deg, #2A0B3D, #170626)`,
    o7: "radial-gradient(ellipse at 30% 40%, #9E1424, #4E0610 80%)",
    o8: `${STARS}, linear-gradient(180deg, #1B1870, ${BLUE})`,
    o9: `${STARS}, linear-gradient(180deg, #0F2A3A, #0A1824)`,
    o10: `${STARS}, linear-gradient(160deg, ${K.night}, #3A1050)`,
  };
  function OfferHero({ d }) {
    const kind = SET.head;
    const tone = { ...darkTone, accent: K.gold };
    return (
      <BannerFrame d={d} clockW={300} bg={OFFER_LOOKS[kind] || OFFER_LOOKS.o5}
        top={<Lights w={frameW(d)} />}
        decor={d ? <><Burst x="50%" y="30%" r={22} c={K.gold} /><Burst x="58%" y="76%" r={13} c="#FF5C8A" dl={1.4} /><Burst x="95%" y="22%" r={12} c="#5FD3C6" dl={2.5} /></>
          : <><Burst x="86%" y="10%" r={16} c={K.gold} /><Burst x="70%" y="5%" r={9} c="#FF5C8A" dl={1.3} /></>}
        copy={<BannerCopy tone={tone} title={<h1 style={{ margin: 0, fontFamily: FJ, fontWeight: 700, fontSize: R(50, 58), lineHeight: 1, letterSpacing: "-.01em", color: K.cream }}>{COPY.heading}</h1>} />}
        clock={
          <div style={{ alignSelf: "stretch", textAlign: d ? "center" : "left", display: "flex", flexDirection: "column", alignItems: d ? "center" : "flex-start", gap: d ? 0 : 2, borderTop: d ? "none" : `1px solid ${K.nightLine}`, paddingTop: d ? 0 : 16 }}>
            <div style={{ fontFamily: FJ, fontSize: R(12, 12.5), fontWeight: 600, letterSpacing: ".2em", color: K.creamSoft, textTransform: "uppercase" }}>Save up to</div>
            <div style={{ fontFamily: FJ, fontWeight: 800, fontSize: R(56, 88), lineHeight: 1, color: K.gold, letterSpacing: "-.02em" }}>{comboOff()}%</div>
            <div style={{ fontFamily: FB, fontSize: R(12.5, 13), color: K.creamSoft, marginTop: d ? 4 : 0 }}>on your Diwali bundle</div>
          </div>
        } />
    );
  }
  function MiniDigits2({ t, size = 14, dark = true, gap = 3 }) {
    const tile = (v, k) => (
      <span key={k} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: size * 1.7, height: size * 1.6, borderRadius: size * 0.3, background: dark ? "rgba(255,243,222,.1)" : K.field, border: `1px solid ${dark ? rgba(K.marigold, 0.3) : K.line}`, overflow: "hidden" }}>
        <span key={v} className={k === 2 ? "fs-tick" : undefined} style={{ display: "inline-block", fontFamily: FJ, fontWeight: 600, fontSize: size, lineHeight: 1, color: dark ? K.gold : K.ink, fontVariantNumeric: "tabular-nums" }}>{pad2(v)}</span>
      </span>
    );
    const sep = (k) => <span key={"s" + k} aria-hidden="true" style={{ color: dark ? rgba(K.gold, 0.7) : K.muted, fontSize: size * 0.8, fontWeight: 700 }}>:</span>;
    return <span style={{ display: "inline-flex", alignItems: "center", gap }}>{tile(t.h, 0)}{sep(0)}{tile(t.m, 1)}{sep(1)}{tile(t.s, 2)}</span>;
  }
  function TagLetter2({ ch, len, red, delay, w, h, fs }) {
    return (
      <div className="fs-swing" style={{ display: "flex", flexDirection: "column", alignItems: "center", transformOrigin: "50% 0", animationDelay: `${delay}s`, animationDuration: `${3.2 + (delay % 1.1)}s` }}>
        <i style={{ width: 1.5, height: len, background: rgba(K.gold, 0.7) }} />
        <div style={{ width: w, height: h, background: "linear-gradient(180deg, #FFF8EA, #F3E2C4)", clipPath: "polygon(50% 0, 100% 20%, 100% 100%, 0 100%, 0 20%)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", paddingTop: h * 0.16, boxSizing: "border-box" }}>
          <i style={{ position: "absolute", top: h * 0.11, left: "50%", width: 5, height: 5, marginLeft: -2.5, borderRadius: 9, background: K.night }} />
          <span style={{ fontFamily: FJ, fontWeight: 700, fontSize: fs, color: red ? K.kumkum : K.night }}>{ch}</span>
        </div>
      </div>
    );
  }
  function BannerTags2({ d }) {
    const t = useCountdown(), tone = { ...darkTone, accent: K.gold };
    const lens = [16, 30, 20, 36, 24, 0, 18, 34, 22, 38], word = "FLASH SALE".split("");
    const w = R(32, 54), h = R(46, 72), fs = R(22, 34);
    const tile = (v, u) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <span style={{ minWidth: R(56, 60), height: R(50, 54), borderRadius: 10, background: "#FFF8EA", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FJ, fontWeight: 700, fontSize: R(26, 28), color: K.night, fontVariantNumeric: "tabular-nums", overflow: "hidden" }}><span key={v} className={u === "Secs" ? "fs-tick" : undefined}>{pad2(v)}</span></span>
        <span style={{ fontFamily: FJ, fontSize: 10.5, fontWeight: 500, letterSpacing: ".14em", color: K.creamSoft, textTransform: "uppercase" }}>{u}</span>
      </div>
    );
    return (
      <section style={{ position: "relative", overflow: "hidden", background: NIGHT_BG }}>
        <Lights w={frameW(d)} />
        {d && <><FW x="58%" y="26%" r={22} c={K.gold} /><FW x="96%" y="80%" r={13} c="#FF5C8A" dl={1.4} /></>}
        <div style={{ position: "relative", display: d ? "grid" : "flex", flexDirection: "column", gridTemplateColumns: d ? "1fr 310px" : undefined, gap: d ? 48 : 26, padding: d ? `0 ${DESK_SIDE}px 40px` : `0 ${SIDE}px 32px`, alignItems: d ? "center" : "stretch" }}>
          <div>
            <h1 style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{COPY.heading}</h1>
            <div aria-hidden="true" style={{ display: "flex", alignItems: "flex-start", gap: R(3, 6), justifyContent: d ? "flex-start" : "center", marginTop: -4 }}>
              {word.map((ch, k) => ch === " " ? <span key={k} style={{ width: R(8, 18) }} /> : <TagLetter2 key={k} ch={ch} len={R(lens[k] * 0.7, lens[k])} red={k > 5} delay={k * 0.37} w={w} h={h} fs={fs} />)}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: R(18, 22), alignItems: d ? "flex-start" : "center" }}><Sub tone={tone} center={!d} /><ChipRow tone={tone} center={!d} /></div>
          </div>
          <div style={{ textAlign: "center", background: "rgba(255,243,222,.05)", border: `1px solid ${K.nightLine}`, borderRadius: 18, padding: R("18px 14px", "22px 18px"), marginTop: d ? 24 : 0 }}>
            <div style={{ fontFamily: FJ, fontSize: R(12.5, 12.5), fontWeight: 600, letterSpacing: ".2em", color: K.cream, textTransform: "uppercase", marginBottom: 12 }}>Sale ends in</div>
            <div role="timer" aria-label={timerLabel(t)} style={{ display: "flex", justifyContent: "center", gap: 10 }}>{tile(t.h, "Hours")}{tile(t.m, "Mins")}{tile(t.s, "Secs")}</div>
          </div>
        </div>
      </section>
    );
  }
  function BannerFrame2({ d }) {
    const t = useCountdown(), tone = { ...darkTone, accent: K.gold };
    const tile = (v, u) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <FlipCard text={pad2(v)} w={R(62, 70)} h={R(62, 70)} fs={R(34, 40)} bg={FX.soft} color="#fff" weight={600} radius={8} split="rgba(0,0,0,.35)" />
        <span style={{ fontFamily: FJ, fontSize: 10.5, fontWeight: 500, letterSpacing: ".14em", color: K.creamSoft, textTransform: "uppercase" }}>{u}</span>
      </div>
    );
    const bg = FX.dark;
    return (
      <section style={{ position: "relative", overflow: "hidden", background: `repeating-conic-gradient(from 0deg at 50% 50%, ${rgba(K.marigold, 0.045)} 0deg 3deg, transparent 3deg 12deg), ${bg}` }}>
        <FW x={d ? "95%" : "90%"} y={d ? "16%" : "5%"} r={R(11, 15)} c={K.gold} />
        <div style={{ position: "relative", padding: d ? `44px ${DESK_SIDE}px 40px` : `34px ${SIDE}px 30px` }}>
          <div style={{ position: "relative", border: `1.5px solid ${rgba(K.cream, 0.85)}`, borderRadius: 4, padding: d ? "0 36px 30px" : "0 16px 22px" }}>
            <h1 style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 12, transform: `translateY(-50%)`, background: bg, padding: "0 14px", marginLeft: -14, fontFamily: FJ, fontWeight: 700, textTransform: "uppercase", lineHeight: 1 }}>
              <span style={{ fontSize: R(36, 46), color: "#fff", letterSpacing: ".02em" }}>Flash</span>
              <span style={{ fontSize: R(36, 46), color: "#fff", background: K.kumkum, padding: R("4px 12px 2px", "5px 14px 3px"), borderRadius: 4, letterSpacing: ".02em" }}>Sale</span>
            </h1>
            <div style={{ display: d ? "grid" : "flex", flexDirection: "column", gridTemplateColumns: d ? "1fr auto" : undefined, gap: d ? 40 : 22, alignItems: d ? "center" : "stretch", marginTop: R(-8, -14) }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}><Sub tone={tone} /><ChipRow tone={tone} /></div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                {capsLabel("Sale ends in", K.cream, true)}
                <div role="timer" aria-label={timerLabel(t)} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>{tile(t.h, "Hours")}{dots(R(62, 70), "#fff")}{tile(t.m, "Mins")}{dots(R(62, 70), "#fff")}{tile(t.s, "Secs")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }
  function BannerMarquee2({ d }) {
    const t = useCountdown(), tone = { ...darkTone, accent: K.gold, title: K.gold };
    return (
      <section style={{ position: "relative", overflow: "hidden", background: FX.dark, padding: R(16, 18) }}>
        <Bulbs n={d ? 34 : 13} style={{ top: R(4, 5), left: 24, right: 24 }} />
        <Bulbs n={d ? 34 : 13} style={{ bottom: R(4, 5), left: 24, right: 24 }} />
        <Bulbs n={d ? 7 : 16} vertical style={{ left: R(4, 5), top: 24, bottom: 24 }} />
        <Bulbs n={d ? 7 : 16} vertical style={{ right: R(4, 5), top: 24, bottom: 24 }} />
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, border: `1.5px solid ${rgba(K.gold, 0.75)}`, background: FX.dark, minHeight: d ? 230 : undefined, boxSizing: "border-box", padding: d ? `30px ${DESK_SIDE - 18}px 32px` : "26px 16px 28px", display: d ? "grid" : "flex", flexDirection: "column", gridTemplateColumns: d ? "1fr auto" : undefined, gap: d ? 40 : 22, alignItems: "center", textAlign: d ? "left" : "center" }}>
          {d ? <><FW x="52%" y="28%" r={20} c={K.gold} /><FW x="58%" y="78%" r={12} c="#FF9FB0" dl={1.4} /></> : <FW x="88%" y="8%" r={13} c={K.gold} />}
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12, alignItems: d ? "flex-start" : "center" }}>
            <h1 style={{ margin: 0, fontFamily: FD, fontWeight: 400, fontSize: R(50, 60), lineHeight: 0.95, color: K.gold, textShadow: `0 0 18px ${rgba(K.marigold, 0.45)}` }}>{COPY.heading}</h1>
            <Sub tone={tone} center={!d} max={380} /><ChipRow tone={tone} center={!d} />
          </div>
          <div role="timer" aria-label={timerLabel(t)} style={{ position: "relative", textAlign: "center" }}>
            {capsLabel("Sale ends in", K.cream, true)}
            <div style={{ fontFamily: FJ, fontWeight: 700, fontSize: R(46, 56), lineHeight: 1.1, color: "#FFE7A8", textShadow: `0 0 10px ${rgba(K.marigold, 0.8)}, 0 0 26px ${rgba(K.marigold, 0.45)}`, fontVariantNumeric: "tabular-nums", marginTop: 10 }}>{clock(t)}</div>
          </div>
        </div>
      </section>
    );
  }
  const Flame = ({ size = 14 }) => (
    <svg width={size} height={size * 1.2} viewBox="-8 -18 16 19" aria-hidden="true" style={{ flexShrink: 0, overflow: "visible" }}>
      <circle cx="0" cy="-8" r="8" fill={K.marigold} opacity=".18" />
      <g className="flame"><path d="M0 -17 C5 -10 4.4 -3 0 -1 C-4.4 -3 -5 -10 0 -17 Z" fill={K.marigold} /><path d="M0 -10 C2.6 -7 2.2 -3.6 0 -2.8 C-2.2 -3.6 -2.6 -7 0 -10 Z" fill={K.flame} /></g>
    </svg>
  );
  const Hairline = ({ dark = true }) => <div aria-hidden="true" style={{ height: 3, backgroundImage: `radial-gradient(circle, ${K.marigold} 1.2px, transparent 1.6px)`, backgroundSize: "9px 3px", backgroundColor: dark ? "transparent" : "transparent", opacity: 0.85 }} />;
  function TimerLockBar2({ kit, d, onProceed }) {
    const t = useCountdown(), N = CATS.length;
    const msg = kit.count === 0
      ? <>Flash prices end at midnight. <b style={{ color: K.gold }}>Up to {comboOff()}% off</b> today.</>
      : kit.complete ? <>You save <b style={{ color: K.gold }}>{inr(savedNow(kit))}</b> and get a free gift box.</>
      : <>You're saving <b style={{ color: K.gold }}>{inr(savedNow(kit))}</b>. Add {CATS[kit.firstEmpty].title} for {kit.nextOff}% more.</>;
    return (
      <div style={{ position: "sticky", top: 0, zIndex: 36, height: TOPBAR_H(), boxSizing: "border-box", background: K.nightDeep, fontFamily: FB, color: K.cream, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, display: d ? "grid" : "flex", gridTemplateColumns: d ? "1fr auto 1fr" : undefined, alignItems: "center", gap: 14, padding: d ? `0 ${DESK_SIDE}px` : `0 ${SIDE}px`, justifyContent: "space-between" }}>
          <span role="timer" aria-label={timerLabel(t)} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Flame size={11} />
            <span style={{ fontSize: R(11, 10.5), fontWeight: 600, color: K.creamSoft, letterSpacing: ".02em" }}>{d ? "Prices locked for" : "Locked"}</span>
            <MiniDigits2 t={t} size={R(11.5, 10.5)} />
          </span>
          {d ? <span key={kit.nudge + kit.total} className="fs-in" style={{ fontSize: 11.5, whiteSpace: "nowrap", color: K.cream }}>{msg}</span> : null}
          <span style={{ justifySelf: "end", display: "inline-flex", alignItems: "center", gap: 8, fontSize: R(11, 10.5), color: K.creamSoft, whiteSpace: "nowrap" }}>
            {d ? (kit.complete
              ? <button onClick={onProceed} className="fs-press" style={{ height: 20, padding: "0 12px", borderRadius: 999, border: "none", background: K.marigold, color: K.night, fontSize: 10.5, fontWeight: 800, cursor: "pointer", fontFamily: FB }}>Check out</button>
              : <><span style={{ display: "flex", gap: 3 }}>{CATS.map((c, i) => <i key={c.key} style={{ width: 14, height: 3, borderRadius: 2, background: i < kit.cats ? K.marigold : "rgba(255,243,222,.18)" }} />)}</span>{kit.cats} of {N} lit</>)
              : kit.count ? <>Saving <b style={{ color: K.gold }}>{inr(savedNow(kit))}</b></> : <b style={{ color: K.gold }}>Up to {comboOff()}% off</b>}
          </span>
        </div>
        <Hairline />
      </div>
    );
  }
  function TimerSavings2({ kit, d, bottom, hidden }) {
    const t = useCountdown(), [open, setOpen] = useState(true), N = CATS.length;
    const shell = { position: "absolute", right: R(12, 24), bottom, zIndex: 45, opacity: hidden ? 0 : 1, pointerEvents: hidden ? "none" : "auto", transition: `bottom .4s ${EASE}, opacity .25s ease`, fontFamily: FB };
    if (!open) return (
      <button onClick={() => setOpen(true)} aria-label="Show savings and timer" className="fs-press" style={{ ...shell, height: 40, padding: "0 12px 0 10px", borderRadius: 999, border: `1px solid ${rgba(K.marigold, 0.45)}`, cursor: "pointer", background: K.night, display: "flex", alignItems: "center", gap: 8, boxShadow: `0 12px 24px ${rgba(K.nightDeep, 0.4)}` }}>
        <Flame size={11} /><MiniDigits2 t={t} size={11} />
      </button>
    );
    return (
      <div className="fs-pop" style={{ ...shell, width: R(214, 224), background: `linear-gradient(160deg, ${K.nightSoft}, ${K.night} 55%, ${K.nightDeep})`, color: K.cream, borderRadius: 18, overflow: "hidden", boxShadow: `0 18px 38px ${rgba(K.nightDeep, 0.5)}`, border: `1px solid ${rgba(K.marigold, 0.3)}` }}>
        <svg aria-hidden="true" width="120" height="120" viewBox="0 0 120 120" style={{ position: "absolute", right: -40, top: -40, opacity: 0.12 }}><Mandala cx={60} cy={60} r={52} color={K.gold} op={1} /></svg>
        <div style={{ position: "relative", padding: "12px 14px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: K.marigold }}>{kit.count ? "You're saving" : "Today only"}</span>
            <button onClick={() => setOpen(false)} aria-label="Minimise" style={{ width: 22, height: 22, borderRadius: 99, border: "none", background: "rgba(255,243,222,.08)", color: K.cream, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><IconDown size={12} /></button>
          </div>
          <div key={savedNow(kit)} className="fs-pop" style={{ fontFamily: FD, fontSize: 32, lineHeight: 1.05, color: K.gold, marginTop: 2 }}>{kit.count ? inr(savedNow(kit)) : `Up to ${comboOff()}%`}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
            {CATS.map((c, i) => (
              <Fragment key={c.key}>
                {i > 0 && <span aria-hidden="true" style={{ flex: 1, height: 1, background: i < kit.cats ? K.marigold : "rgba(255,243,222,.18)" }} />}
                <svg key={c.key + (i < kit.cats)} className={i < kit.cats ? "fs-light" : undefined} width="18" height="18" viewBox="-15 -21 30 30" aria-hidden="true"><Diya lit={i < kit.cats} /></svg>
              </Fragment>
            ))}
          </div>
          <div key={kit.nudge} className="fs-in" style={{ fontSize: 11, lineHeight: 1.4, color: K.creamSoft, marginTop: 6 }}>
            {kit.complete ? <span style={{ color: K.gold }}>Best price unlocked, gift box added.</span> : kit.count ? <>Add <b style={{ color: K.cream }}>{CATS[kit.firstEmpty].title}</b> for {kit.nextOff}% off everything{kit.cats + 1 === N ? ", plus a gift" : ""}.</> : `Fill all ${N} categories for ${maxTier()}% extra.`}
          </div>
        </div>
        <div role="timer" aria-label={timerLabel(t)} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "rgba(0,0,0,.22)", borderTop: `1px solid ${rgba(K.marigold, 0.18)}` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, color: K.creamSoft }}><Flame size={10} />Ends in</span>
          <MiniDigits2 t={t} size={12} />
        </div>
      </div>
    );
  }
  function TimerPillChip2() {
    const t = useCountdown();
    return (
      <span role="timer" aria-label={timerLabel(t)} style={{ flex: "0 0 auto", height: R(42, 36), padding: R("0 6px 0 12px", "0 5px 0 11px"), borderRadius: 999, background: K.night, display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", boxShadow: `0 0 0 1px ${rgba(K.marigold, 0.35)}, 0 8px 18px ${rgba(K.night, 0.18)}` }}>
        <Flame size={R(12, 11)} />
        <span style={{ fontFamily: FB, fontSize: R(11, 10), fontWeight: 600, color: K.creamSoft }}>Ends in</span>
        <MiniDigits2 t={t} size={R(13, 11.5)} />
      </span>
    );
  }
  function DockAnchor2({ kit, onNext, onProceed, dockRef, progRef, d }) {
    const t = useCountdown(), has = kit.count > 0;
    return (
      <div ref={dockRef} style={dockFrame(true, { background: K.night, borderRadius: d ? 0 : "22px 22px 0 0", boxShadow: `0 -12px 30px ${rgba(K.nightDeep, 0.3)}`, overflow: "hidden" })}>
        <Hairline />
        <div ref={progRef} style={{ minHeight: R(64, 58), display: "flex", alignItems: "center", gap: R(14, 22), padding: d ? `8px ${DESK_SIDE}px` : `10px ${SIDE}px` }}>
          <div role="timer" aria-label={timerLabel(t)} style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 4, paddingRight: R(14, 22), borderRight: `1px solid ${K.nightLine}` }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 600, color: K.creamSoft }}><Flame size={9} />Prices rise in</span>
            <MiniDigits2 t={t} size={R(13, 12.5)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {has ? (
              <div style={{ display: "flex", alignItems: d ? "baseline" : "flex-start", flexDirection: d ? "row" : "column", gap: d ? 18 : 1 }}>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
                  <span key={kit.total} className="fs-pop" style={{ fontFamily: FD, fontSize: R(22, 22), color: K.gold, lineHeight: 1 }}>{inr(kit.total)}</span>
                  <span style={{ fontSize: R(11, 10.5), color: K.creamSoft }}>today</span>
                </span>
                <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6, fontSize: R(11, 10.5), color: K.creamSoft }}>
                  <s style={{ fontFamily: FD, fontSize: R(14, 14), color: rgba(K.cream, 0.55) }}>{inr(kit.mrp)}</s>after midnight
                </span>
                {d && <span key={kit.nudge} className="fs-in" style={{ fontSize: 10.5, color: kit.complete ? K.gold : K.creamSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{kit.nudge}</span>}
              </div>
            ) : (
              <>
                <div style={{ fontFamily: FD, fontSize: R(17, 17), color: K.cream, lineHeight: 1.15 }}>Prices go back up at midnight</div>
                <div style={{ fontSize: R(11, 10.5), color: K.creamSoft, marginTop: 2 }}>Pick a product to see what you save</div>
              </>
            )}
          </div>
          {has && <GoBtn kit={kit} onNext={onNext} onProceed={onProceed} d={d} />}
        </div>
      </div>
    );
  }
  function CatHeadClock2({ off }) {
    const t = useCountdown();
    return (
      <span role="timer" aria-label={`${off}. ${timerLabel(t)}`} style={{ flexShrink: 0, display: "inline-flex", alignItems: "stretch", borderRadius: 10, overflow: "hidden", border: `1px solid ${K.line}`, background: K.card, boxShadow: `0 6px 14px -10px ${rgba(K.night, 0.5)}` }}>
        <span style={{ display: "inline-flex", alignItems: "center", padding: R("0 10px", "0 11px"), background: rgba(K.kumkum, 0.08), color: K.kumkum, fontSize: R(11, 10.5), fontWeight: 800, borderRight: `1px dashed ${K.lineDark}`, whiteSpace: "nowrap" }}>{off}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: R("5px 8px", "5px 9px") }}><Flame size={10} /><MiniDigits2 t={t} size={R(11.5, 11)} dark={false} gap={2} /></span>
      </span>
    );
  }
  function CardClockBadge2({ p }) {
    const t = useCountdown();
    return (
      <span role="timer" aria-label={`Save ${inr(p.mrp - p.price)}. ${timerLabel(t)}`} style={{ position: "absolute", left: R(7, 6), right: R(7, 6), bottom: R(7, 6), display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, padding: R("5px 6px 5px 9px", "4px 5px 4px 8px"), borderRadius: 10, background: rgba(K.nightDeep, 0.82), backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", color: K.cream }}>
        <span style={{ fontSize: R(11, 9.5), fontWeight: 700, whiteSpace: "nowrap" }}>Save <span style={{ color: K.gold }}>{inr(p.mrp - p.price)}</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Flame size={R(9, 8)} /><span style={{ fontFamily: FD, fontSize: R(12.5, 11), color: K.gold, fontVariantNumeric: "tabular-nums" }}>{pad2(t.h)}:{pad2(t.m)}:{pad2(t.s)}</span></span>
      </span>
    );
  }
  const savedNow = (kit) => kit.mrp - kit.total;
  function GoBtn({ kit, onNext, onProceed, d, style }) {
    const go = kit.complete ? onProceed : onNext;
    if (!go) return null;
    return <button onClick={go} className={"fs-press" + (kit.complete ? " fs-shine" : "")} style={{ ...ctaGold(R(42, 36), R(13, 11.5)), flexShrink: 0, ...style }}>{kit.complete ? "Checkout" : d ? "Next category" : "Next"} <IconArrow size={14} /></button>;
  }
  const dockFrame = (show, extra) => ({ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 50, opacity: show ? 1 : 0, transform: show ? "none" : "translateY(115%)", pointerEvents: show ? "auto" : "none", transition: `transform .45s ${EASE}, opacity .25s ease`, ...extra });
  const ctaGold = (h, fs) => ({ height: h, borderRadius: 999, border: "none", background: K.marigold, color: K.night, fontSize: fs, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, whiteSpace: "nowrap", padding: "0 16px" });
  const TOPBAR_H = () => R(38, 34);
  function StyleTag() {
    return (
      <style>{`
        .fs-root button{font-family:inherit}
        .fs-root button:focus-visible,.fs-root select:focus-visible,.fs-root input:focus-visible{outline:2px solid ${K.marigoldDeep};outline-offset:2px}
        .fs-scroll{scrollbar-width:none}.fs-scroll::-webkit-scrollbar{display:none}
        .fs-press{transition:transform .18s ${EASE},background-color .2s ease,color .2s ease,border-color .2s ease,box-shadow .25s ease}
        .fs-press:active{transform:scale(.97)}
        .fs-press:disabled{cursor:default}
        .fs-root .flame{transform-box:fill-box;transform-origin:50% 100%;animation:fsFlick 1.7s ease-in-out infinite}
        @keyframes fsFlick{0%,100%{transform:scale(1,1) skewX(0)}30%{transform:scale(.94,1.06) skewX(3deg)}60%{transform:scale(1.04,.9) skewX(-2deg)}}
        .fs-root .twinkle{animation:fsTw 3.2s ease-in-out infinite}
        @keyframes fsTw{0%,100%{opacity:.25}50%{opacity:1}}
        .fs-root .fw{transform-box:fill-box;transform-origin:center;opacity:0;animation:fsFw 3.4s ${EASE} infinite}
        @keyframes fsFw{0%{opacity:0;transform:scale(.25)}12%{opacity:1}55%{opacity:.85;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.08)}}
        .fs-root .sway{animation:fsSway 4.6s ease-in-out infinite}
        @keyframes fsSway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
        .fs-pop{animation:fsPop .45s ${EASE_B}}
        @keyframes fsPop{0%{transform:scale(.82);opacity:.4}100%{transform:scale(1);opacity:1}}
        .fs-tick{animation:fsTick .42s ${EASE}}
        @keyframes fsTick{0%{transform:translateY(-38%);opacity:0}100%{transform:none;opacity:1}}
        .fs-in{animation:fsIn .36s ${EASE}}
        @keyframes fsIn{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:none}}
        .fs-flip{animation:fsFlip .5s ${EASE}}
        @keyframes fsFlip{0%{opacity:0;transform:translateY(70%)}100%{opacity:1;transform:none}}
        .fs-light{animation:fsLight .7s ${EASE_B}}
        @keyframes fsLight{0%{transform:scale(.7);filter:brightness(2.2)}100%{transform:scale(1);filter:none}}
        .fs-toast{animation:fsToast .45s ${EASE_B} both}
        @keyframes fsToast{0%{opacity:0;transform:translate(-50%,14px) scale(.94)}100%{opacity:1;transform:translate(-50%,0)}}
        .fs-shine{position:relative;overflow:hidden}
        .fs-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%);animation:fsShine 3.6s ease-in-out infinite}
        @keyframes fsShine{0%,60%{transform:translateX(-120%)}85%,100%{transform:translateX(120%)}}
        .fs-select{appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2376678A' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;cursor:pointer;text-overflow:ellipsis}
        .fs-select-dark{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23FFF3DE' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")}
        .fs-select-dark option{color:#24124A;background:#fff}
        .fs-spark{animation:fsSpark .5s ease-in-out infinite alternate}
        @keyframes fsSpark{0%{transform:scale(.8) rotate(0)}100%{transform:scale(1.2) rotate(30deg)}}
        .fs-swing{animation:fsSwing 2.6s ease-in-out infinite}
        @keyframes fsSwing{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(5deg)}}
        @keyframes fsFlapTop{from{transform:rotateX(0)}to{transform:rotateX(-90deg)}}
        @keyframes fsFlapBot{from{transform:rotateX(90deg)}to{transform:rotateX(0)}}
        .fs-marquee{animation:fsMarquee 26s linear infinite}
        @keyframes fsMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .fs-neon{animation:fsNeon 5s linear infinite}
        @keyframes fsNeon{0%,18%,22%,60%,64%,100%{opacity:1}20%,62%{opacity:.6}}
        .fs-fleck{animation:fsFleck 6s ease-in-out infinite}
        @keyframes fsFleck{0%,100%{translate:0 0}50%{translate:0 -8px}}
        .fs-bulb{animation:fsBulb .9s steps(1) infinite}
        @keyframes fsBulb{0%{opacity:1}50%{opacity:.28}}
        .fs-sparks{transform-box:fill-box;transform-origin:center;animation:fsSparks .35s linear infinite}
        @keyframes fsSparks{0%{transform:rotate(0) scale(1)}50%{transform:rotate(12deg) scale(1.12)}100%{transform:rotate(24deg) scale(.95)}}
        .fs-stutter{animation:fsStutter 6s linear infinite}
        @keyframes fsStutter{0%,61%,63%,65%,100%{opacity:1}62%,64%{opacity:.25}}
        .fs-neon-slow{animation:fsNeonSlow 3.2s ease-in-out infinite}
        @keyframes fsNeonSlow{0%,100%{opacity:1}50%{opacity:.86}}
        .fs-boom{transform-box:fill-box;transform-origin:center;opacity:0;animation:fsBoom 4.6s cubic-bezier(.2,.8,.3,1) infinite}
        @keyframes fsBoom{0%{opacity:0;transform:scale(.08)}6%{opacity:1}34%{opacity:1;transform:scale(1)}62%{opacity:.75;transform:scale(1.04) translateY(3px)}82%,100%{opacity:0;transform:scale(1.07) translateY(7px)}}
        .fs-fountain{transform-box:fill-box;transform-origin:50% 100%;animation:fsFountain .5s ease-in-out infinite alternate}
        @keyframes fsFountain{0%{opacity:1;transform:scaleY(1)}100%{opacity:.8;transform:scaleY(1.1)}}
        @media (prefers-reduced-motion: reduce){.fs-root *,.fs-root *::after{animation:none!important;transition:none!important}.fs-root .fw{opacity:.7}.fs-boom{opacity:.85}}
      `}</style>
    );
  }
  function Claimed({ tone }) {
    return null;
    return (
      <div style={{ marginTop: R(14, 14), width: "100%" }}>
        <div style={{ height: 4, borderRadius: 99, background: tone.track, overflow: "hidden" }}><div style={{ width: `${t.claimed}%`, height: "100%", borderRadius: 99, background: tone.fill, transition: `width 1s ${EASE}` }} /></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6, fontFamily: FB, fontSize: R(11.5, 10), color: tone.soft }}>
          <span><b style={{ color: tone.ink, fontWeight: 700 }}>{t.claimed}% claimed</b>, selling fast</span><span>Stock is limited</span>
        </div>
      </div>
    );
  }
  const UI = {
    bg: "var(--bg, #EFE7F5)", panel: "var(--panel, #FFFFFF)", box: "var(--box, #FAF7FC)", line: "var(--line, #E2D6EA)", ink: "var(--ink, #24124A)", muted: "var(--muted, #76678A)",
    seg: "var(--seg, #F3EEF8)", on: "var(--seg-on, #24124A)", onInk: "var(--seg-on-ink, #FFD66B)", accent: "var(--accent, #E8890C)",
  };
  const segBtn = (on) => ({ flex: "1 1 0", minWidth: 0, height: 28, padding: "0 8px", borderRadius: 8, border: "none", cursor: "pointer", background: on ? UI.on : "transparent", color: on ? UI.onInk : UI.ink, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", fontFamily: FB, boxShadow: on ? "0 1px 3px rgba(36,18,74,.25)" : "none" });
  function Dropdown({ label, value, options, onChange, strong }) {
    return (
      <div style={{ position: "relative", width: "100%" }}>
        <select aria-label={label} value={String(value)} onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", height: strong ? 42 : 36, padding: "0 32px 0 12px", borderRadius: 10, border: `1px solid ${strong ? UI.on : UI.line}`, background: strong ? UI.on : UI.panel, color: strong ? UI.onInk : UI.ink, fontSize: strong ? 13.5 : 12.5, fontWeight: 700, fontFamily: FB, cursor: "pointer", appearance: "none", WebkitAppearance: "none", MozAppearance: "none", outline: "none" }}>
          {options.map(([v, l]) => <option key={String(v)} value={String(v)} style={{ color: "#24124A", background: "#fff" }}>{l}</option>)}
        </select>
        <span aria-hidden="true" style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", color: strong ? UI.onInk : UI.muted, display: "flex", pointerEvents: "none" }}><IconDown size={14} /></span>
      </div>
    );
  }
  function Section({ n, title, sub, children }) {
    return (
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: UI.on, color: UI.onInk, fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{n}</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: UI.ink, lineHeight: 1.2 }}>{title}</div>
            {sub && <div style={{ fontSize: 11.5, color: UI.muted, lineHeight: 1.35, marginTop: 1 }}>{sub}</div>}
          </div>
        </div>
        <div style={{ background: UI.box, border: `1px solid ${UI.line}`, borderRadius: 14, overflow: "hidden" }}>{children}</div>
      </section>
    );
  }
  function Row({ label, first, children, stack }) {
    return (
      <div style={{ display: stack ? "block" : "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderTop: first ? "none" : `1px solid ${UI.line}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: UI.muted, width: stack ? "auto" : 84, flexShrink: 0, marginBottom: stack ? 6 : 0, whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      </div>
    );
  }
  const caps = { textTransform: "uppercase" };
  /* =====================================================================
     PREVIEW — the banners on their own, with a few settings
     ===================================================================== */
  const noop = () => {};
  const BANNER_KIT = { count: 0, cats: 0, complete: false, nudge: "Fill every category for extra savings", firstEmpty: 0, nextOff: 5, tierOff: 0, total: 0, mrp: 0 };
  const OTONE = { ...darkTone, accent: K.gold };
  const ojTitle = () => <h1 style={{ margin: 0, fontFamily: FJ, fontWeight: 700, fontSize: R(50, 58), lineHeight: 1, letterSpacing: "-.01em", color: K.cream }}>{COPY.heading}</h1>;
  function SaveBlock({ d }) {
    return (
      <div style={{ alignSelf: "stretch", textAlign: d ? "center" : "left", display: "flex", flexDirection: "column", alignItems: d ? "center" : "flex-start", gap: 2 }}>
        <div style={{ fontFamily: FJ, fontSize: R(12, 12.5), fontWeight: 600, letterSpacing: ".2em", color: K.creamSoft, textTransform: "uppercase" }}>Save up to</div>
        <div style={{ fontFamily: FJ, fontWeight: 800, fontSize: R(56, 80), lineHeight: 1, color: K.gold, letterSpacing: "-.02em" }}>{comboOff()}%</div>
        <div style={{ fontFamily: FB, fontSize: R(12.5, 13), color: K.creamSoft, marginTop: 2 }}>on your Diwali bundle</div>
      </div>
    );
  }
  /* an offer banner with its timer built in */
  function OfferBanner({ d, look, right, top, bottom }) {
    return (
      <BannerFrame d={d} clockW={310} bg={OFFER_LOOKS[look]}
        top={top || <Lights w={frameW(d)} />}
        decor={d ? <><Burst x="50%" y="30%" r={22} c={K.gold} /><Burst x="58%" y="76%" r={13} c="#FF5C8A" dl={1.4} /><Burst x="95%" y="22%" r={12} c="#5FD3C6" dl={2.5} /></>
          : <><Burst x="86%" y="12%" r={16} c={K.gold} /><Burst x="70%" y="6%" r={9} c="#FF5C8A" dl={1.3} /></>}
        copy={<BannerCopy tone={OTONE} title={ojTitle()} />}
        clock={right}
        bottom={bottom} />
    );
  }
  function LockStrip({ d }) {
    const t = useCountdown();
    return (
      <div role="timer" aria-label={timerLabel(t)} style={{ background: K.nightDeep, borderBottom: `1px solid ${rgba(K.marigold, 0.3)}`, display: "flex", alignItems: "center", justifyContent: d ? "space-between" : "center", gap: 12, padding: d ? `9px ${DESK_SIDE}px` : `9px ${SIDE}px`, fontFamily: FB }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: R(12, 11), fontWeight: 600, color: K.creamSoft }}><Flame size={11} />Prices locked for <MiniDigits2 t={t} size={R(12, 11)} /></span>
        {d && <span style={{ fontSize: 11.5, color: K.cream }}>Flash prices end at midnight. <b style={{ color: K.gold }}>Up to {comboOff()}% off</b> today.</span>}
      </div>
    );
  }
  function WidgetCard({ d }) {
    const t = useCountdown();
    return (
      <div role="timer" aria-label={timerLabel(t)} style={{ alignSelf: "stretch", position: "relative", overflow: "hidden", borderRadius: 18, background: `linear-gradient(160deg, ${K.nightSoft}, ${K.night} 55%, ${K.nightDeep})`, border: `1px solid ${rgba(K.marigold, 0.3)}`, boxShadow: `0 18px 38px ${rgba(K.nightDeep, 0.45)}`, fontFamily: FB }}>
        <svg aria-hidden="true" width="140" height="140" viewBox="0 0 120 120" style={{ position: "absolute", right: -46, top: -46, opacity: 0.12 }}><Mandala cx={60} cy={60} r={52} color={K.gold} op={1} /></svg>
        <div style={{ position: "relative", padding: "16px 18px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: K.marigold }}>Today only</div>
          <div style={{ fontFamily: FJ, fontWeight: 800, fontSize: R(40, 44), lineHeight: 1.05, color: K.gold }}>Up to {comboOff()}%</div>
          <div style={{ fontSize: 12, color: K.creamSoft, marginTop: 2 }}>off your Diwali bundle</div>
        </div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "rgba(0,0,0,.22)", borderTop: `1px solid ${rgba(K.marigold, 0.18)}` }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: K.creamSoft }}><Flame size={10} />Ends in</span>
          <MiniDigits2 t={t} size={14} />
        </div>
      </div>
    );
  }
  function CapsuleBand({ d }) {
    const t = useCountdown();
    return (
      <div role="timer" aria-label={timerLabel(t)} style={{ background: "rgba(0,0,0,.28)", borderTop: `1px solid ${rgba(K.marigold, 0.25)}`, display: "flex", alignItems: "center", gap: R(12, 20), padding: d ? `12px ${DESK_SIDE}px` : `12px ${SIDE}px`, fontFamily: FB }}>
        <span style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 600, color: K.creamSoft }}><Flame size={9} />Prices rise in</span>
          <MiniDigits2 t={t} size={R(13, 13)} />
        </span>
        <span style={{ fontSize: R(12, 12), color: K.cream, lineHeight: 1.4, borderLeft: `1px solid ${K.nightLine}`, paddingLeft: R(12, 20) }}>Today's flash prices, <b style={{ color: K.gold }}>up to {comboOff()}% off</b>.{d ? " Back to full price after midnight." : ""}</span>
      </div>
    );
  }
  function TicketClock({ d }) {
    const t = useCountdown();
    return (
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", alignItems: d ? "center" : "flex-start", gap: 12 }}>
        <div style={{ fontFamily: FJ, fontSize: R(12.5, 13), fontWeight: 600, letterSpacing: ".2em", color: K.cream, textTransform: "uppercase" }}>Sale ends in</div>
        <span role="timer" aria-label={timerLabel(t)} style={{ display: "inline-flex", alignItems: "stretch", borderRadius: 12, overflow: "hidden", background: K.card, boxShadow: "0 10px 24px rgba(0,0,0,.3)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", padding: "0 14px", background: rgba(K.kumkum, 0.1), color: K.kumkum, fontFamily: FJ, fontSize: R(14, 15), fontWeight: 800, borderRight: `1.5px dashed ${K.lineDark}`, whiteSpace: "nowrap" }}>Up to {comboOff()}% off</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 12px" }}><Flame size={12} /><MiniDigits2 t={t} size={R(15, 16)} dark={false} /></span>
        </span>
      </div>
    );
  }
  function FrostBand({ d }) {
    const t = useCountdown();
    return (
      <div role="timer" aria-label={timerLabel(t)} style={{ margin: d ? `0 ${DESK_SIDE}px 22px` : `0 ${SIDE}px 18px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderRadius: 14, background: "rgba(255,243,222,.08)", border: `1px solid ${K.nightLine}`, backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", fontFamily: FB, color: K.cream }}>
        <span style={{ fontSize: R(12.5, 13), fontWeight: 600 }}>Flash prices on every product until midnight</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Flame size={11} /><span style={{ fontFamily: FJ, fontWeight: 700, fontSize: R(18, 20), color: K.gold, fontVariantNumeric: "tabular-nums" }}>{clock(t)}</span></span>
      </div>
    );
  }

  const BANNER_VERSIONS = [
    { n: "The countdown begins", desc: "Red grain, a string of lights, three flip tiles.", render: (p) => <BannerV1 {...p} /> },
    { n: "Split-flap night", desc: "Night blue, cream split-flap digits, a scrolling tape and a row of diyas.", render: (p) => <BannerV2 {...p} /> },
    { n: "Neon tiers", desc: "A neon sign and a black box holding the clock.", render: (p) => <BannerV3 {...p} /> },
    { n: "Taped banner", desc: "Shubh Deepavali tapes and black time boxes.", render: (p) => <BannerV4 {...p} /> },
    { n: "Price-lock strip", desc: "Offer banner with a slim price-lock strip across its top.", render: (p) => <OfferBanner d={p.d} look="o5" top={<><LockStrip d={p.d} /><Lights w={frameW(p.d)} /></>} right={<SaveBlock d={p.d} />} /> },
    { n: "Offer card", desc: "Offer banner with a small card holding the saving and the clock.", render: (p) => <OfferBanner d={p.d} look="o6" right={<WidgetCard d={p.d} />} /> },
    { n: "Saving + chip", desc: "Offer banner; the saving on the right with a clock chip under it.", render: (p) => <OfferBanner d={p.d} look="o7" right={<><SaveBlock d={p.d} /><div style={{ marginTop: 14, alignSelf: p.d ? "center" : "flex-start" }}><TimerPillChip2 /></div></>} /> },
    { n: "Price-rise band", desc: "Offer banner with a band along the bottom: prices rise in, then the clock.", render: (p) => <OfferBanner d={p.d} look="o8" right={<SaveBlock d={p.d} />} bottom={<CapsuleBand d={p.d} />} /> },
    { n: "Ticket clock", desc: "Offer banner; a two-part ticket holds the saving and the clock.", render: (p) => <OfferBanner d={p.d} look="o9" right={<TicketClock d={p.d} />} /> },
    { n: "Frosted band", desc: "Offer banner with a frosted glass band at the bottom carrying the clock.", render: (p) => <OfferBanner d={p.d} look="o10" right={<SaveBlock d={p.d} />} bottom={<FrostBand d={p.d} />} /> },
    { n: "Hanging tags", desc: "FLASH SALE on swinging cream tags, the clock on the right.", render: (p) => <BannerTags2 {...p} /> },
    { n: "Frame + rays", desc: "A frame broken by the title block, soft rays, flip tiles.", render: (p) => <BannerFrame2 {...p} /> },
    { n: "Marquee lights", desc: "A red board ringed with warm bulbs, filling the banner.", render: (p) => <BannerMarquee2 {...p} /> },
  ];


  /* ---- multi-day offer: the days. Their look (tabs, locked / closed card) is built from the page tokens, outside this scope ---- */
  const SALE_DAYS = [
    { name: "Dhanteras", off: 15, line: "15% off everything" },
    { name: "Choti Diwali", off: 20, line: "20% off everything" },
    { name: "Diwali", off: 25, line: "25% off everything + a free gift box" },
  ];

  let SET = {}, MULTI = false, DESK = false, CATS = CATS_ALL.slice(0, 3);
  return {
    versions: BANNER_VERSIONS, StyleTag, FB, kit: BANNER_KIT, days: SALE_DAYS, useCountdown,
    sync: (d, multi, nCats, pal) => { DESK = d; MULTI = multi; CATS = CATS_ALL.slice(0, Math.max(3, Math.min(4, nCats))); setFx(pal); },
  };
})();

/* a slider row; on desktop it has an arrow at each end that slides it */
/* slider card widths: desktop a little bigger; mobile sized so one card shows in full and 60 % of the next (one width = viewport − left padding − gap, divided by 1.6) */
const SLIDE_W_DESK = 208;
function Slider({ d, children, ...rest }) {
  const ref = useRef(null);
  const [edge, setEdge] = useState({ l: false, r: true });
  const measure = () => { const el = ref.current; if (!el) return; setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => { measure(); }, []);
  const go = (dir) => { const el = ref.current; if (el && el.scrollBy) el.scrollBy({ left: dir * 2 * (SLIDE_W_DESK + 10), behavior: "smooth" }); };
  const arrow = (dir) => {
    const on = dir < 0 ? edge.l : edge.r;
    return (
      <button key={dir} onClick={() => go(dir)} aria-label={dir < 0 ? "Slide left" : "Slide right"} data-slide-arrow={dir < 0 ? "left" : "right"} tabIndex={on ? 0 : -1} className="fb-ghost sb-anim"
        style={{ position: "absolute", top: "calc(50% - 7px)", [dir < 0 ? "left" : "right"]: 6, transform: "translateY(-50%)", zIndex: 5, width: 36, height: 36, padding: 0, borderRadius: sh.round, border: stroke(1, LINE), background: C.white, color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,.18)", opacity: on ? 1 : 0, pointerEvents: on ? "auto" : "none" }}>
        {dir < 0 ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />}
      </button>
    );
  };
  return (
    <div style={{ position: "relative" }}>
      <div ref={ref} onScroll={measure} {...rest}>{children}</div>
      {d && [-1, 1].map(arrow)}
    </div>
  );
}

/* =====================================================================
   PRICE LOOK FEATURE — from Price_Look_Feature.jsx (the standalone file has the full props + notes)
   · PriceLockBanner  the thin "Price locked at ₹1,583 for every order" strip at the top of Subscribe & save (royal red + gold, shimmer left → right)
   · DiwaliText       plain text, royal red with a travelling gold glint
   ===================================================================== */
const DIWALI = { dark: "#7a0f1c", light: "#fff3d9", redDeep: "#4b0911", red: "#7a0f1c", redBright: "#9b2330", gold: "#f5c542", goldDeep: "#d9a21b", goldBright: "#ffd45c", goldPale: "#ffecb3",
  foil: ["#f6e7b4", "#e6c466", "#f3dc94"], ivory: "#fff3d9", beige: "#faecc8", beigeDeep: "#efdcae", goldEdge: "rgba(217,162,27,.75)", goldSoft: "rgba(245,197,66,.55)" };
/* The merchant picks TWO colours — a dark and a light. Every festive shade, gradient and wash is worked out from them, with gold added. */
const isHex = (h) => /^#[0-9a-fA-F]{6}$/.test(h || "");
/* The two Diwali colours are picked by hue only (rainbow band) + a shade slider held inside a safe bracket:
   dark can't be near-black or washed out, light can't be dark — so the text colours on top always keep their contrast. */
const FEST_TONE = { festDark: { s: 78, lMin: 18, lMax: 34, sMin: 55, sMax: 90 }, festLight: { s: 100, lMin: 88, lMax: 96, sMin: 70, sMax: 100 } };
const hexToHsl = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (mx !== mn) { const d = mx - mn; sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, sat * 100, l * 100];
};
const hslToHex = (h, sat, l) => {
  sat /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0), f(8), f(4)].map((v) => v * 255));
};
const clampFest = (key, hex) => { const T = FEST_TONE[key], [h, sat, l] = hexToHsl(hex); return hslToHex(h, Math.max(T.sMin, Math.min(T.sMax, sat)), Math.max(T.lMin, Math.min(T.lMax, l))); };
function applyFest(dark, light) {
  const dk = clampFest("festDark", isHex(dark) ? dark : "#7a0f1c"), lt = clampFest("festLight", isHex(light) ? light : "#fff3d9");
  Object.assign(DIWALI, { dark: dk, light: lt, red: dk, redDeep: mix("#000000", dk, 0.38), redBright: mix("#ffffff", dk, 0.2), ivory: lt, beige: mix(DIWALI.gold, lt, 0.14), beigeDeep: mix(DIWALI.goldDeep, lt, 0.26) });
}
const festGrad = (ang = 110) => `linear-gradient(${ang}deg, ${DIWALI.redDeep} 0%, ${DIWALI.red} 55%, ${DIWALI.redBright} 100%)`;
const plfShimmerLayer = { position: "absolute", top: -2, bottom: -2, left: 0, width: "24%", pointerEvents: "none", background: "linear-gradient(90deg, rgba(255,236,179,0) 0%, rgba(255,236,179,.12) 38%, rgba(255,255,255,.22) 50%, rgba(255,236,179,.12) 62%, rgba(255,236,179,0) 100%)" };

function FestShimmer() { return <span aria-hidden="true" className="plf-shimmer" style={plfShimmerLayer} />; }
const festPill = () => ({ position: "relative", overflow: "hidden", background: `linear-gradient(110deg, ${DIWALI.goldPale}, ${DIWALI.gold})`, color: DIWALI.redDeep, boxShadow: `inset 0 0 0 1px ${DIWALI.goldEdge}` });   // the gold offer pill (shimmers)
const festAnnouncements = () => (FREE_LAST ? ["Festive Free Shipping on *Every Diwali Order*", `*Diwali Special*: Pick ${LAST}, Get 1 Free`, "Order by 5 PM for *Same-Day Dispatch*"]
  : TIERED ? ["Festive Free Shipping on *Every Diwali Order*", "*The More You Add*, The More Diwali Offers", "Order by 5 PM for *Same-Day Dispatch*"]
  : BYOB ? ["Festive Free Shipping on *Every Diwali Order*", BYOB_FLAT ? flatCopy("*Diwali Special*: Add {n} Products, Get {off}% OFF") : "*The More You Add*, The More Diwali Offers", "Order by 5 PM for *Same-Day Dispatch*"]
  : BXGY ? ["Festive Free Shipping on *Every Diwali Order*", FIXED ? `*Diwali Special: ${BXGY_CATS[0].products.length} Products, One Bundle*` : `*Diwali Special: Buy ${BXGY_CATS[0].products.length}, Get ${BXGY_REWARDS.length} Free*`, "Order by 5 PM for *Same-Day Dispatch*"]
  : MULTI ? ["Festive Free Shipping on *Every Diwali Order*", "*Diwali Special*: Pick As Many As You Like, Save More", "Order by 5 PM for *Same-Day Dispatch*"]
  : ["Festive Free Shipping on *Every Diwali Order*", "*Diwali Special*: Pick 3 Products, Pay One Fixed Price", "Order by 5 PM for *Same-Day Dispatch*"]);


/* ---- Diwali ornaments: line-art, tone-on-tone, drawn in the gold + the chosen hex (never loud) ---- */
function Diya({ size = 26, color, flame }) {
  const c = color || DIWALI.goldDeep, f = flame || DIWALI.goldBright;
  return (
    <svg data-diya="1" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path className="fest-flicker" style={{ transformOrigin: "16px 11px" }} d="M16 3.2c2.3 2.7 3.1 4.7 0 7.9-3.1-3.2-2.3-5.2 0-7.9z" fill={f} stroke={c} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M4 16.5h24c0 5.6-5.4 9.5-12 9.5S4 22.1 4 16.5z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" fill={rgba(c, 0.12)} />
      <path d="M8.6 20.6c2 1.4 4.6 2.2 7.4 2.2s5.4-.8 7.4-2.2" stroke={c} strokeWidth="1" strokeLinecap="round" opacity=".7" />
      <path d="M9.5 28.5h13" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PayToggle({ mode, onChange }) {
  return (
    <div style={{ display: "flex", gap: DM(4), padding: DM(3), background: C.bg, border: stroke(0.75, GREY_DARK), borderRadius: sh.pill, width: "100%" }}>
      {[["upfront", "Pay Upfront"], ["perDelivery", "Per Delivery"], ["payAsYouGo", "Pay As You Go"]].map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} className="sb-anim"
          style={{ flex: 1, height: DM(30), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: sh.pill, cursor: "pointer", border: "none",
            background: mode === id ? C.primary : "transparent", color: mode === id ? C.onBar : MUTED, fontSize: FS(10), fontWeight: 600, whiteSpace: "nowrap", padding: "0 2px" }}>
          {label}
        </button>
      ))}
    </div>
  );
}

/* desktop right-hand drawer for Subscribe & save */


const IconChevronLeft = ({ size = 18 }) => <Icon size={size} w={1.9} d={<path d="M15 6l-6 6 6 6" />} />;
const IconChevronRight = ({ size = 18 }) => <Icon size={size} w={1.9} d={<path d="M9 6l6 6-6 6" />} />;

/* =====================================================================
   Settings — everything you can switch, shown next to the frame.
   Changing "Pick" or "Categories" starts a fresh bundle.
   ===================================================================== */
const SETTINGS = [
  ["type", "Page type", [["mix", "Mix & Match"], ["byob", "BYOB"], ["bxgy", "BXGY"], ["fixed", "Fixed bundle"], ["gift", "Gift subscription"], ["subscription", "Subscription"], ["surprise", "Surprise box"]]],
  ["theme", "Theme", [["normal", "Normal"], ["festive", "Diwali"]]],
  ["festDark", "Diwali · dark colour", "hex"],
  ["festLight", "Diwali · light colour", "hex"],
  ["bannerType", "Diwali · banner", [["default", "Default"], ["image", "Image"], ["flash", "Flash sale"]]],
  ["bannerPattern", "Banner pattern", FEST_PATTERNS.map((p) => [p.id, p.label])],
  ["flashBanner", "Flash sale · banner", "flash"],
  ["flashDays", "Flash sale · multi-day offer", [["on", "On"], ["off", "Off"]]],
  ["flashLive", "Flash sale · live now", [[0, "Day 1"], [1, "Day 2"], [2, "Day 3"], [3, "Ended"]]],
  ["byobMode", "Offer type (BYOB)", [["tiered", "Tiered"], ["flat", "% OFF"]]],
  ["offers", "Offers (BYOB)", [[4, "4 offers"], [6, "6 offers · scrolls"]]],
  ["bxBuy", "Products in bundle (BXGY / Fixed)", [[4, "4"], [6, "6"], [8, "8"]]],
  ["bxFree", "Free products (BXGY)", [[1, "1 free"], [2, "2 free"]]],
  ["pick", "Pick", [["one", "One per category"], ["many", "Many per category"]]],
  ["mixMode", "Mix & Match offer", [["normal", "Normal"], ["bxgy", "BXGY"], ["tiered", "Tiered"]]],
  ["cats", "Categories", [[3, "3"], [4, "4"]]],
  ["topBanner", "Top banner", [[true, "Banner"], [false, "Text only"]]],
  ["catHeader", "Category banner", [["plain", "None"], ["banner", "With banner"]]],
  ["flow", "Category flow", [["steps", "Multi step"], ["vertical", "Vertical"]]],
  ["loader", "Next-step loader (Mix & Match)", [["yes", "Yes"], ["no", "No"]]],
  ["autoMove", "Auto move to next category", [["yes", "Yes"], ["no", "No"]]],
  ["cards", "Product cards", [["grid", "Grid"], ["slider", "Slider"]]],
  ["subWidget", "Widget", [["single", "Single plan"], ["opt1", "Frequency picker"], ["opt2", "Schedule grid"], ["intl", "International"]]],
  ["subVariant", "Variant style", [["pills", "Pills"], ["dropdown", "Dropdown"]]],
  ["subOneTime", "One-time option", [["on", "On"], ["off", "Off"]]],
  ["subEndless", "Endless", [["on", "On"], ["off", "Off"]]],
  ["subGift", "Gift it to someone", [["yes", "Yes"], ["no", "No"]]],
  ["subGiftStyle", "Gift style", [["env", "Envelope"], ["book", "Greeting card"], ["flip", "Flip ticket"], ["ribbon", "Gift ribbon"], ["sleeve", "Card sleeve"], ["voucher", "Gift your loved ones"], ["stub", "Tear-off ticket"]]],
  ["giftFlow", "Build & Mix banners", [["default", "Default"], ["image", "Upload your own"]]],
  ["giftWall", "Illustration wall", [["on", "On"], ["off", "Off"]]],
  ["dock", "Bottom bar", [["sticky", "Sticky"], ["floating", "Floating pill"]]],
  ["pills", "Category pills", [["pills", "Pills"], ["stepper", "Arrows"]]],
  ["mobNav", "Mobile category nav (V2)", [["bar", "Prev · Next bar"], ["arrows", "Arrow + pills + arrow"]]],
];
/* settings row for the flash sale banners: ‹ dropdown › and a line about the one picked */
function FlashPicker({ label, value, onChange }) {
  const n = FLASH.versions.length, cur = FLASH.versions[value] || FLASH.versions[0];
  const step = (dir) => onChange((value + dir + n) % n);
  const arrow = { width: 30, height: 30, flexShrink: 0, padding: 0, borderRadius: sh.pill, border: "none", background: C.bg, color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 0.75px " + GREY_LIGHT };
  return (
    <div role="group" aria-label={label}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 4, background: C.grayBg, border: stroke(0.75, GREY_LIGHT), borderRadius: 14 }}>
        <button onClick={() => step(-1)} aria-label="Previous flash sale banner" className="sb-anim" style={arrow}><IconChevronLeft size={14} /></button>
        <select value={value} onChange={(e) => onChange(+e.target.value)} aria-label={label}
          style={{ flex: 1, minWidth: 0, height: 30, padding: "0 10px", borderRadius: sh.pill, border: "none", background: C.primary, color: C.onBar, fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
          {FLASH.versions.map((b, i) => <option key={i} value={i}>{i + 1}. {b.n}</option>)}
        </select>
        <button onClick={() => step(1)} aria-label="Next flash sale banner" className="sb-anim" style={arrow}><IconChevronRight size={14} /></button>
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.45, color: MUTED, marginTop: 6 }}>{cur.desc}</div>
    </div>
  );
}
/* rainbow band for the colour + a shade slider limited to a safe bracket — no free hex typing */
function HuePicker({ k, label, value, onChange }) {
  const T = FEST_TONE[k], v = clampFest(k, isHex(value) ? value : SET_DEFAULT[k]), [h, , l] = hexToHsl(v);
  const rainbow = `linear-gradient(90deg, ${[0, 60, 120, 180, 240, 300, 360].map((x) => hslToHex(x % 360, T.s, (T.lMin + T.lMax) / 2)).join(", ")})`;
  const shade = `linear-gradient(90deg, ${hslToHex(h, T.s, T.lMin)}, ${hslToHex(h, T.s, T.lMax)})`;
  const lq = Math.round(Math.max(T.lMin, Math.min(T.lMax, l)));
  return (
    <div role="group" aria-label={label}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: MUTED }}>{label}</span>
        <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: sh.round, background: v, border: stroke(0.75, GREY_DARK) }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 12px", background: C.grayBg, border: stroke(0.75, GREY_LIGHT), borderRadius: 14 }}>
        <input type="range" className="sb-hue" aria-label={`${label} colour`} min={0} max={359} step={1} value={Math.round(h) % 360} onChange={(e) => onChange(hslToHex(+e.target.value, T.s, lq))} style={{ background: rainbow }} />
        <input type="range" className="sb-hue" aria-label={`${label} shade`} min={T.lMin} max={T.lMax} step={1} value={lq} onChange={(e) => onChange(hslToHex(h, T.s, +e.target.value))} style={{ background: shade }} />
      </div>
    </div>
  );
}
/* ---- the settings panel: every setting is visible, grouped into clear sections (no tabs, nothing hidden), short labels, a reset ---- */
const SETTING_SECTIONS = [
  ["Pages", ["byobMode", "offers", "bxBuy", "bxFree", "pick", "mixMode", "cats"]],
  ["Diwali", ["theme", "festDark", "festLight"]],
  ["Banner", ["topBanner", "bannerType", "bannerPattern", "flashBanner", "flashDays", "flashLive", "catHeader", "giftFlow"]],
  ["Layout", ["cards", "dock", "giftWall"]],
  ["Category flow", ["flow", "pills", "mobNav", "loader", "autoMove"]],
  ["Subscription", ["subWidget", "subVariant", "subOneTime", "subEndless", "subGift", "subGiftStyle"]],
];
const SETTING_LABELS = {
  type: "Page type", byobMode: "Offer type", offers: "Offers", bxBuy: "Products in bundle", bxFree: "Free products", pick: "Pick", mixMode: "Offer type", cats: "Categories",
  theme: "Theme", festDark: "Dark colour", festLight: "Light colour", bannerType: "Banner style", bannerPattern: "Pattern", flashBanner: "Flash sale banner", flashDays: "Multi-day offer", flashLive: "Live day",
  topBanner: "Top banner", catHeader: "Category banner", cards: "Product cards", giftFlow: "Build & Mix banners", giftWall: "Illustration wall", dock: "Bottom bar", flow: "Flow", pills: "Category pills", mobNav: "Mobile nav", loader: "Next-step loader", autoMove: "Auto-move to next",
};
/* which settings apply right now (the same rules as before, in one place) */
function settingVisible(key, s) {
  const gift = s.type === "gift", festive = s.theme === "festive" || gift;     // the Gift page is a Diwali page
  const sub = s.type === "subscription" || s.type === "surprise";                  // the two subscription pages
  if (["subWidget", "subVariant", "subOneTime", "subEndless", "subGift"].includes(key)) return sub;
  if (key === "subGiftStyle") return sub && s.subGift === "yes";
  if (sub && ["byobMode", "offers", "bxBuy", "bxFree", "pick", "mixMode", "cats", "flow", "loader", "autoMove", "pills", "dock", "catHeader", "mobNav", "topBanner", "bannerType", "bannerPattern", "flashBanner", "flashDays", "flashLive", "cards", "giftFlow", "giftWall"].includes(key)) return false;
  if (key === "giftFlow" || key === "giftWall") return gift;
  if (gift && ["theme", "byobMode", "offers", "bxBuy", "bxFree", "pick", "mixMode", "cats", "flow", "loader", "autoMove", "pills", "dock", "catHeader", "mobNav"].includes(key)) return false;
  if (["festDark", "festLight", "bannerType", "flashBanner", "flashDays", "flashLive"].includes(key) && !(festive && !(key === "bannerType" && !s.topBanner))) return false;
  if (["flashBanner", "flashDays", "flashLive"].includes(key) && !(s.bannerType === "flash" && s.topBanner)) return false;
  if (key === "flashLive" && s.flashDays === "off") return false;
  if (key === "bannerPattern" && !(s.theme === "festive" && s.topBanner && s.bannerType === "default")) return false;   // the pattern belongs to the designed (default) banner
  const hide = s.type === "byob" ? ["pick", "cats", "flow", "loader", "autoMove", "pills", "dock", "catHeader", "cards", "bxBuy", "bxFree", "mixMode"]
    : s.type === "bxgy" || s.type === "fixed" ? ["pick", "cats", "flow", "loader", "autoMove", "pills", "catHeader", "offers", "mixMode", "byobMode", ...(s.type === "fixed" ? ["bxFree"] : [])]
    : ["bxBuy", "bxFree", "byobMode", ...(s.mixMode === "tiered" ? [] : ["offers"])];   // Mix & Match: the Offers (4 / 6) apply to the Tiered offer
  if (hide.includes(key)) return false;
  if (key === "offers" && s.byobMode === "flat") return false;
  if (key === "autoMove" && !(s.type === "mix" && s.pick === "one" && s.flow !== "vertical")) return false;
  if (key === "mobNav" && !(LAYOUT_V2 && s.type === "mix" && s.pills === "pills")) return false;
  return true;
}
function SettingsPanel({ s, set, onReset, view, onView }) {
  const byKey = Object.fromEntries(SETTINGS.map((r) => [r[0], r]));
  const sections = SETTING_SECTIONS.map(([title, keys]) => [title, keys.filter((k) => byKey[k] && settingVisible(k, s))]).filter(([, keys]) => keys.length);
  const control = (key) => {
    const [, , opts] = byKey[key], label = SETTING_LABELS[key] || byKey[key][1];
    if (opts === "flash") return <FlashPicker key={key} label={label} value={s[key]} onChange={(v) => set(key, v)} />;
    if (opts === "hex") return <HuePicker key={key} k={key} label={label} value={s[key]} onChange={(v) => set(key, v)} />;
    if (["type", "subWidget", "subGiftStyle"].includes(key)) return (
      <div key={key} role="group" aria-label={label}>
        {key !== "type" && <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{label}</div>}
        <div style={{ display: "flex", alignItems: "center", padding: 4, background: C.grayBg, border: stroke(0.75, GREY_LIGHT), borderRadius: 14 }}>
          <select value={s[key]} onChange={(e) => set(key, e.target.value)} aria-label={label} style={{ flex: 1, minWidth: 0, height: 34, padding: "0 12px", borderRadius: sh.pill, border: "none", background: C.primary, color: C.onBar, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", outline: "none" }}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
    );
    const needMany = key === "mixMode" && s.pick !== "many";   // Tiered only works with Many per category
    return (
      <div key={key} role="group" aria-label={label}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{label}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, background: C.grayBg, border: stroke(0.75, GREY_LIGHT), borderRadius: 14 }}>
          {opts.map(([v, l, off0]) => {
            const off = off0 || (needMany && v === "tiered");
            const on = s[key] === v;
            return <button key={String(v)} onClick={() => !off && set(key, v)} disabled={!!off} aria-pressed={on} className="sb-anim"
              style={{ flex: "1 1 auto", height: 30, padding: "0 10px", borderRadius: sh.pill, border: "none", cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.4 : 1, background: on ? C.primary : "transparent", color: on ? C.onBar : C.inkOnBg, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{l}</button>;
          })}
        </div>
        {needMany && <div style={{ fontSize: 11, lineHeight: 1.4, color: MUTED, marginTop: 6 }}>Tiered needs “Many per category”.</div>}
      </div>
    );
  };
  const PANEL_BG = "#f4f4f4", card = { display: "flex", flexDirection: "column", gap: 12, background: C.bg, border: stroke(0.75, GREY_LIGHT), borderRadius: 16, padding: "14px 14px 16px" };
  const title = (t) => <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.005em", color: C.inkOnBg }}>{t}</div>;
  return (
    <aside aria-label="Settings" style={{ width: 300, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 16, maxHeight: "calc(100vh - 32px)", overflowY: "auto", boxSizing: "border-box", background: PANEL_BG, border: stroke(0.75, GREY_LIGHT), borderRadius: sh.card, padding: "0 12px 14px", display: "flex", flexDirection: "column", gap: 14, boxShadow: S.pop }}>
      <div style={{ position: "sticky", top: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 2px 10px", background: PANEL_BG }}>
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em", color: C.inkOnBg }}>Settings</div>
        <button onClick={onReset} className="sb-anim" aria-label="Reset all settings" style={{ height: 24, padding: "0 10px", borderRadius: sh.pill, border: stroke(0.75, GREY_DARK), background: C.bg, color: MUTED, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>Reset</button>
      </div>
      <section aria-label="Preview" style={card}>
        {title("Preview")}
        <div role="group" aria-label="Preview size" style={{ display: "flex", gap: 4, padding: 4, background: C.grayBg, border: stroke(0.75, GREY_LIGHT), borderRadius: 14 }}>
          {[["mobile", "Mobile"], ["desktop", "Desktop"]].map(([id, l]) => {
            const on = view === id;
            return <button key={id} onClick={() => onView(id)} aria-pressed={on} className="sb-anim"
              style={{ flex: 1, height: 30, padding: "0 10px", borderRadius: sh.pill, border: "none", cursor: "pointer", background: on ? C.primary : "transparent", color: on ? C.onBar : C.inkOnBg, fontSize: 12, fontWeight: 600 }}>{l}</button>;
          })}
        </div>
      </section>
      {sections.map(([t, keys]) => (
        <section key={t} aria-label={t} style={card}>
          {title(t)}
          {keys.map(control)}
        </section>
      ))}
    </aside>
  );
}

/* =====================================================================
   GIFT A SUBSCRIPTION — the listing page (from SB_Diwali_Gift_Subscription.jsx), kept in its own scope so its names never clash with this page's. It is a Page type:
   Settings → Page type → Gift subscription. It takes the two Diwali colours, the banner settings (top banner · banner style · pattern · flash sale) and the card layout from the panel.
   ===================================================================== */
const GIFT = (() => {

/* =====================================================================
   StackBack token engine — same tokens as the other landing pages
   ===================================================================== */
const BRAND = { primary: "#000000", secondary: "#fcfbfc", accent: "#95e534", tileText: "#1c401e", bg: "#ffffff", tile: "#ffffff" };
const GREY_LIGHT = "#e8e8e8", GREY_DARK = "#c4c4c4", IMG_GREY = "#e6e6e6";

const hexToRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbToHex = (rgb) => "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
const mix = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex([0, 1, 2].map((i) => A[i] * t + B[i] * (1 - t))); };
const lum = (h) => { const c = hexToRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b)); return (hi + 0.05) / (lo + 0.05); };
const readable = (h) => (contrast("#000000", h) >= contrast("#ffffff", h) ? "#000000" : "#ffffff");

const C = {
  primary: BRAND.primary, accent: BRAND.accent, bg: BRAND.bg, white: BRAND.tile,
  onBar: readable(BRAND.primary), subOnBar: mix(readable(BRAND.primary), BRAND.primary, 0.62),
  priceOnTile: BRAND.tileText, fill: IMG_GREY, canvas: mix("#000000", BRAND.bg, 0.16),
};
const INK = "#000000";                    // every text that is not a price: pure black (white on dark), faded = 50%
const FADED = "rgba(0,0,0,0.5)";
const R = { card: 16, img: 14, pill: 999 };      // rounded
const stroke = (w, col) => `${w}px solid ${col}`;
const SIDE = 96;                                              // desktop page margin (mobile: 16)
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const EASE = "cubic-bezier(.4,0,.2,1)", EASE_OUT = "cubic-bezier(.22,1,.36,1)";
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

/* ---- Diwali (festive) kit — the same palette, gradients and motion as the Diwali master page ---- */
const DIWALI = { dark: "#7a0f1c", light: "#fff3d9", redDeep: "#4b0911", red: "#7a0f1c", redBright: "#9b2330", gold: "#f5c542", goldDeep: "#d9a21b", goldBright: "#ffd45c", goldPale: "#ffecb3",
  ivory: "#fff3d9", beige: mix("#f5c542", "#fff3d9", 0.14), beigeDeep: mix("#d9a21b", "#fff3d9", 0.26), goldEdge: "rgba(217,162,27,.75)", goldSoft: "rgba(245,197,66,.55)" };
const festGrad = (ang = 110) => `linear-gradient(${ang}deg, ${DIWALI.redDeep} 0%, ${DIWALI.red} 55%, ${DIWALI.redBright} 100%)`;
let PAGE_BG = mix(DIWALI.light, "#ffffff", 0.16);          // the light colour as a very, very light tint
const FREE = { bg: DIWALI.ivory, edge: DIWALI.goldSoft, edgeStrong: DIWALI.goldDeep };   // the BXGY free card's colours — every product card here wears them
const shimmerLayer = { position: "absolute", top: -2, bottom: -2, left: 0, width: "24%", pointerEvents: "none", background: "linear-gradient(90deg, rgba(255,236,179,0) 0%, rgba(255,236,179,.12) 38%, rgba(255,255,255,.22) 50%, rgba(255,236,179,.12) 62%, rgba(255,236,179,0) 100%)" };
const FestShimmer = () => <span aria-hidden="true" className="plf-shimmer" style={shimmerLayer} />;
const festPill = { position: "relative", overflow: "hidden", background: `linear-gradient(110deg, ${DIWALI.goldPale}, ${DIWALI.gold})`, color: DIWALI.redDeep, boxShadow: `inset 0 0 0 1px ${DIWALI.goldEdge}` };   // the gold pill (shimmers)

/* =====================================================================
   Diwali décor — the pattern tile, the diya, the lantern, the garland, a diya divider and the illustration wall
   ===================================================================== */
const festUri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg).replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/'/g, "%27")}")`;
const FEST_TILE = (() => {
  const sz = 34, c = 17, petals = Array.from({ length: 8 }, (_, i) => `<ellipse cx='${c}' cy='${c - 5.6}' rx='1.5' ry='3.4' transform='rotate(${i * 45} ${c} ${c})'/>`).join("");
  const tile = `<svg xmlns='http://www.w3.org/2000/svg' width='${sz}' height='${sz}' viewBox='0 0 ${sz} ${sz}' fill='none' stroke='${DIWALI.goldPale}' stroke-opacity='.2' stroke-width='.7'><circle cx='${c}' cy='${c}' r='1.6'/>${petals}<circle cx='${c}' cy='${c}' r='11'/><circle cx='0' cy='0' r='5'/><circle cx='${sz}' cy='0' r='5'/><circle cx='0' cy='${sz}' r='5'/><circle cx='${sz}' cy='${sz}' r='5'/></svg>`;
  return { url: festUri(tile), size: sz };
})();
/* The two Diwali colours (dark + light) drive every festive shade here — same engine as the bundle page. They are picked by hue (rainbow band)
   with a shade slider held inside a safe bracket, so the text on top always keeps its contrast. */
const FEST_TONE = { festDark: { s: 78, lMin: 18, lMax: 34, sMin: 55, sMax: 90 }, festLight: { s: 100, lMin: 88, lMax: 96, sMin: 70, sMax: 100 } };
const hexToHsl = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (mx !== mn) { const dd = mx - mn; sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; }
  return [h, sat * 100, l * 100];
};
const hslToHex = (h, sat, l) => {
  sat /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0), f(8), f(4)].map((v) => v * 255));
};
const isHex = (h) => /^#[0-9a-fA-F]{6}$/.test(h || "");
const clampFest = (key, hex) => { const T = FEST_TONE[key], [h, sat, l] = hexToHsl(hex); return hslToHex(h, Math.max(T.sMin, Math.min(T.sMax, sat)), Math.max(T.lMin, Math.min(T.lMax, l))); };
function applyFest(dark, light) {
  const dk = clampFest("festDark", isHex(dark) ? dark : "#7a0f1c"), lt = clampFest("festLight", isHex(light) ? light : "#fff3d9");
  Object.assign(DIWALI, { dark: dk, light: lt, red: dk, redDeep: mix("#000000", dk, 0.38), redBright: mix("#ffffff", dk, 0.2), ivory: lt, beige: mix(DIWALI.gold, lt, 0.14), beigeDeep: mix(DIWALI.goldDeep, lt, 0.26) });
  PAGE_BG = mix(lt, "#ffffff", 0.16);
  Object.assign(FREE, { bg: DIWALI.ivory });
  Object.assign(festPill, { color: DIWALI.redDeep, boxShadow: `inset 0 0 0 1px ${DIWALI.goldEdge}` });
}
/* the page's settings, read while rendering (set by the page component) */
let SET = { hero: "default", flow: "default", cards: "carousel", pattern: "mandala" };
const PAT = () => festPattern(SET.pattern, DIWALI.goldPale);   // the bundle page's pattern set (Settings → Banner → Pattern)
const GOLD_TEXT = mix(DIWALI.goldDeep, "#000000", 0.82);   // gold for text: a shade deeper so it reads on the light page
const DiyaPaths = ({ c, f }) => (
  <>
    <path className="fest-flicker" style={{ transformOrigin: "16px 11px" }} d="M16 3.2c2.3 2.7 3.1 4.7 0 7.9-3.1-3.2-2.3-5.2 0-7.9z" fill={f} stroke={c} strokeWidth="1.1" strokeLinejoin="round" />
    <path d="M4 16.5h24c0 5.6-5.4 9.5-12 9.5S4 22.1 4 16.5z" stroke={c} strokeWidth="1.4" strokeLinejoin="round" fill={rgba(c, 0.12)} />
    <path d="M8.6 20.6c2 1.4 4.6 2.2 7.4 2.2s5.4-.8 7.4-2.2" stroke={c} strokeWidth="1" strokeLinecap="round" opacity=".7" />
    <path d="M9.5 28.5h13" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
  </>
);
function Diya({ size = 26, color, flame }) {
  return <svg data-diya="1" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}><DiyaPaths c={color || DIWALI.goldDeep} f={flame || DIWALI.goldBright} /></svg>;
}
const LanternPaths = () => (
  <>
    <rect x="9" y="3" width="6" height="3" rx="1.2" fill={DIWALI.goldDeep} />
    <rect x="6.5" y="6" width="11" height="3" rx="1.5" fill={DIWALI.gold} />
    <path d="M5 11c0-2 14-2 14 0l2 14c0 6-18 6-18 0z" fill={DIWALI.redBright} stroke={DIWALI.goldDeep} strokeWidth=".9" strokeLinejoin="round" />
    <path d="M12 9.5v22M8.4 10.4C6.6 17 6.6 24 8 30.6M15.6 10.4C17.4 17 17.4 24 16 30.6" fill="none" stroke={DIWALI.goldBright} strokeWidth=".9" opacity=".75" />
    <ellipse cx="12" cy="20" rx="3.2" ry="6.2" fill={DIWALI.goldPale} opacity=".5" />
    <rect x="7.5" y="31" width="9" height="2.6" rx="1.2" fill={DIWALI.gold} />
    <path d="M12 33.6v5.4M10.4 33.8l-.8 5M13.6 33.8l.8 5" stroke={DIWALI.goldDeep} strokeWidth="1" strokeLinecap="round" fill="none" />
    <circle cx="12" cy="40.2" r="1.7" fill={DIWALI.gold} />
  </>
);
function Lantern({ w = 24, glow = true }) {
  return <svg data-lantern="1" width={w} height={w * (43 / 24)} viewBox="0 0 24 43" aria-hidden="true" style={{ display: "block", overflow: "visible", filter: glow ? "drop-shadow(0 0 7px rgba(245,197,66,.55))" : "none" }}><LanternPaths /></svg>;
}
/* a thin divider of diyas between the sections */
function DiyaDivider({ d }) {
  const line = { flex: 1, height: 1, background: `linear-gradient(90deg, rgba(217,162,27,0), ${DIWALI.goldEdge})` };
  return (
    <div aria-hidden="true" data-diya-divider="1" style={{ display: "flex", alignItems: "center", gap: d ? 18 : 10, padding: d ? `0 ${SIDE}px` : "0 16px" }}>
      <span style={line} />
      {[0, 1, 2, 3, 4].map((i) => <Diya key={i} size={i === 2 ? (d ? 36 : 28) : (d ? 26 : 20)} />)}
      <span style={{ ...line, transform: "scaleX(-1)" }} />
    </div>
  );
}
/* the illustration wall above the footer — an illustration with the brand's Diwali wish INSIDE it (the middle of the art is left empty so the wish reads), ending in the footer's own colour so they are one block.
   The brand chooses whether to show it (COPY.wall / the toggle) and can swap the art (COPY.wallImage). */
function IllustrationWall({ d }) {
  const W = d ? 1440 : 600, H = 220, inMid = (x) => d && x > 470 && x < 970;
  const lanterns = d ? Array.from({ length: 13 }, (_, i) => ({ x: 50 + i * 111, len: [22, 64, 38, 88, 30, 56][i % 6], s: [0.9, 1.15, 1, 1.25, 0.95, 1.1][i % 6] })).filter((l) => !inMid(l.x))
    : [];   // phone: no hanging lanterns — the stars, gift boxes and diyas are enough
  const diyas = d ? Array.from({ length: 24 }, (_, i) => ({ x: 30 + i * 60, s: i % 3 === 1 ? 1.45 : 1.2 })).filter((o) => !inMid(o.x))
    : Array.from({ length: 12 }, (_, i) => ({ x: 30 + i * 49, s: i % 3 === 1 ? 1.2 : 1.0 }));
  const stars = d ? [[120, 120, 7], [330, 100, 5], [220, 76, 4], [1190, 98, 6], [1340, 126, 5], [1090, 80, 4], [400, 150, 5], [1020, 140, 5]].filter(([x]) => !inMid(x))
    : [[60, 76, 5], [540, 70, 5], [150, 36, 3.5], [450, 30, 3.5]];
  const boxes = d ? [150, 310, 1110, 1270] : [34, 524];
  const art = COPY.wallImage
    ? <div style={{ height: d ? 220 : 150, background: `url(${JSON.stringify(COPY.wallImage)}) center / cover no-repeat` }} />
    : (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" width="100%" height={d ? 220 : 150} style={{ display: "block" }}>
        {stars.map(([x, y, r], i) => <path key={i} d={`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`} fill={DIWALI.goldBright} opacity=".85" />)}
        {lanterns.map((l, i) => (
          <g key={i}>
            <line x1={l.x} y1="0" x2={l.x} y2={l.len} stroke={DIWALI.goldDeep} strokeWidth="1.4" />
            <g transform={`translate(${l.x - 12 * l.s} ${l.len}) scale(${l.s})`} style={{ filter: "drop-shadow(0 0 8px rgba(245,197,66,.6))" }}><LanternPaths /></g>
          </g>
        ))}
        {boxes.map((x, i) => (
          <g key={i} transform={`translate(${x} ${H - (d ? 56 : 46)}) scale(${d ? 1 : 0.8})`}>
            <rect x="0" y="12" width="44" height="28" rx="3" fill={DIWALI.redBright} stroke={DIWALI.goldDeep} strokeWidth="1.2" />
            <rect x="-3" y="8" width="50" height="9" rx="2.5" fill={DIWALI.red} stroke={DIWALI.goldDeep} strokeWidth="1.2" />
            <rect x="19" y="8" width="6" height="32" fill={DIWALI.gold} />
            <path d="M22 8c-9-12-20-6-14 0 4 4 10 2 14 0zM22 8c9-12 20-6 14 0-4 4-10 2-14 0z" fill={DIWALI.goldBright} stroke={DIWALI.goldDeep} strokeWidth="1" />
          </g>
        ))}
        {diyas.map((dy, i) => (
          <g key={i} transform={`translate(${dy.x - 16 * dy.s} ${H - 32 * dy.s})`} style={{ filter: "drop-shadow(0 0 5px rgba(245,197,66,.5))" }}><g transform={`scale(${dy.s})`} fill="none"><DiyaPaths c={DIWALI.goldBright} f={DIWALI.goldPale} /></g></g>
        ))}
      </svg>
    );
  return (
    <div data-wall="1" style={{ position: "relative", overflow: "hidden", lineHeight: 0, background: `${FEST_TILE.url}, linear-gradient(180deg, ${DIWALI.redDeep} 0%, ${DIWALI.red} 55%, ${DIWALI.redDeep} 100%)`, backgroundSize: `${FEST_TILE.size}px ${FEST_TILE.size}px, auto` }}>
      <div aria-hidden="true">{art}</div>
      {/* the wish — inside the illustration, in the empty middle */}
      <div data-wish="1" style={{ position: "absolute", left: "50%", top: "46%", transform: "translate(-50%, -50%)", width: d ? 520 : "86%", lineHeight: 1.25, display: "flex", flexDirection: d ? "row" : "column", alignItems: "center", justifyContent: "center", flexWrap: d ? "wrap" : "nowrap", gap: d ? 12 : 4, textAlign: "center" }}>
        {d ? (
          <>
            <Diya size={28} color={DIWALI.goldBright} flame={DIWALI.goldPale} />
            {COPY.wishLogo ? <img src={COPY.wishLogo} alt={COPY.brand} style={{ height: 32, width: "auto", display: "block" }} /> : <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: DIWALI.goldBright }}>{COPY.brand}</span>}
            <span style={{ fontSize: 23, fontWeight: 500, letterSpacing: "-0.01em", color: DIWALI.goldPale }}>{COPY.wishText}</span>
            <Diya size={28} color={DIWALI.goldBright} flame={DIWALI.goldPale} />
          </>
        ) : (
          <>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Diya size={18} color={DIWALI.goldBright} flame={DIWALI.goldPale} />
              {COPY.wishLogo ? <img src={COPY.wishLogo} alt={COPY.brand} style={{ height: 22, width: "auto", display: "block" }} /> : <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em", color: DIWALI.goldBright }}>{COPY.brand}</span>}
              <Diya size={18} color={DIWALI.goldBright} flame={DIWALI.goldPale} />
            </span>
            <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em", color: DIWALI.goldPale }}>{COPY.wishText}</span>
          </>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   Content — the merchant's backend settings (demo: BrewCo coffee)
   ===================================================================== */
const COPY = {
  brand: "BrewCo",
  announcements: ["Festive Free Shipping on *Every Diwali Gift*", "*Diwali Special*: Gifts Starting at ₹499", "Order Early for *Delivery Before Diwali*"],   // *phrase* = gold
  announceEvery: 3000,
  heading: "Gift the light of Diwali, all year long.",
  headingGlint: "all year long.",                    // the part of the heading shown in Diwali red
  sub: "A Diwali gift that keeps arriving, with your blessings in every box.",
  bannerImage: "",                       // the hero banner artwork (desktop 1440 × 380, mobile 393 × 270) — empty = a grey block
  byobBanner: "",                        // the Build-your-own banner, given by the merchant (desktop 1248 × 240, mobile 361 × 160) — empty = grey
  mixBanner: "",                         // the Mix & match banner, given by the merchant — empty = grey
  subHex: "#fff3d9",                     // the backend colour for the subscription cards
  bundleHex: "#f7d9d4",                  // the backend colour for the bundle cards
  wishText: "wishes you a happy Diwali",   // the greeting under the wall — the merchant edits it (or sets it as a gift message)
  wishLogo: "",                          // the brand logo for the greeting (empty = the brand name in text)
  defaultBanner: true,                   // the hero's default banner (designed, with the text and pills). Off = the merchant's picture slot, grey until they add the image.
  wall: true,                            // the illustration wall above the footer: the brand chooses to show it or not (the toggle at the top does the same)
  wallImage: "",                         // the brand's own wall artwork (1440 × 240) — empty = the built-in illustration
};

const SINGLES = [
  { id: "s1", name: "Whole Bean Coffee", price: 549, mrp: 649 },
  { id: "s2", name: "Cold Brew Concentrate", price: 699, mrp: 799 },
  { id: "s3", name: "Single-Origin Pour-over Pack", price: 649, mrp: 749 },
  { id: "s4", name: "Masala Chai Blend", price: 449, mrp: 499 },
  { id: "s5", name: "Dark Roast Espresso Beans", price: 899, mrp: 1049 },
  { id: "s6", name: "South Indian Filter Coffee", price: 499, mrp: 549 },
  { id: "s7", name: "Drip Bags Variety Pack", price: 599, mrp: 699 },
  { id: "s8", name: "Decaf Whole Beans", price: 579, mrp: 649 },
];
/* Festive bundles: every bundle type lives here, and the tag on the card says which one it is — fixed · buy X get Y · build your own · mix & match */
const BUNDLES = [
  { id: "b1", type: "fixed", name: "The Starter Box", n: 3, price: 1299, mrp: 1599, glyphs: ["bag", "tin", "tin"] },
  { id: "b2", type: "bxgy", name: "Chai Lover's Pack", buy: 2, free: 1, price: 1098, mrp: 1647, glyphs: ["tin", "tin", "cup"] },
  { id: "b3", type: "byob", name: "Build Your Own Diwali Box", price: 999, mrp: 1299, glyphs: ["bag", "tin", "cup", "box"] },
  { id: "b4", type: "mix", name: "Mix & Match Morning Box", price: 1799, mrp: 2249, glyphs: ["bag", "cup", "scoop", "tin"] },
  { id: "b5", type: "fixed", name: "The Brewer's Kit", n: 4, price: 1899, mrp: 2399, glyphs: ["bag", "bag", "cup", "scoop"] },
  { id: "b6", type: "fixed", name: "The Chai Lover's Box", n: 2, price: 1099, mrp: 1349, glyphs: ["tin", "cup"] },
  { id: "b7", type: "fixed", name: "The Weekend Brunch Box", n: 5, price: 2299, mrp: 2899, glyphs: ["bag", "bottle", "box", "box"] },
  { id: "b8", type: "fixed", name: "The Office Pantry", n: 3, price: 2999, mrp: 3799, glyphs: ["box", "bag", "tin"] },
];
const NOTES = [
  { from: "Riya", to: "Aarav", msg: "Happy Diwali, Aarav! May your mornings glow like this all year.", who: "Aarav", quote: "Opened it on Diwali morning and read the note twice. Best surprise this year." },
  { from: "Kabir", to: "Maa", msg: "Shubh Diwali, Maa. No more running out of your favourite chai. Love you.", who: "Sunita", quote: "Every delivery feels like a little festival. I keep every note." },
  { from: "Neha", to: "Team Orion", msg: "Thank you for a great year. Happy Diwali, the brews are on me!", who: "Team Orion", quote: "The whole office looks forward to Mondays now." },
];
const POINTERS = [
  ["Your wishes", " come first", "They read your note before they see the box."],
  ["Right on time", "", "Pick the date and the first box lands in time for the celebration."],
  ["Made for them", "", "They choose their favourites, so every box feels meant for them."],
];
const FAQS = [
  ["Can it arrive before Diwali?", "Yes. Pick the start date and we time the first delivery to land before the festival. Order early for the best chance."],
  ["Who pays, and when?", "You pay once, up front. They are never charged, and nothing renews on its own."],
  ["Does the person need an account?", "No. They get an email with your wishes and a link to choose their favourites and add an address."],
  ["Can I send it to another city?", "Yes, anywhere we deliver in India. They add their own address, so you never have to ask for it."],
  ["What happens when the gift ends?", "It simply stops. There is no renewal and no charge unless you choose to gift again."],
];

/* =====================================================================
   Styles + icons
   ===================================================================== */
function StyleTag() {
  useEffect(() => {
    if (document.getElementById("sb-inter")) return;
    const l = document.createElement("link");
    l.id = "sb-inter"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
  return (
    <style>{`
.gs-root,.gs-root *{ box-sizing: border-box; }
.gs-root{ -webkit-font-smoothing: antialiased; }
.gs-root button{ font-family: inherit; }
.gs-root button:focus-visible{ outline: 2px solid ${C.primary}; outline-offset: 2px; }
@keyframes gs-plfShimmer{ 0% { transform: translateX(-120%) skewX(-18deg); } 100% { transform: translateX(430%) skewX(-18deg); } }
@keyframes gs-plfTwinkle{ 0%, 100% { opacity: .2; transform: scale(.7) rotate(0deg); } 50% { opacity: .95; transform: scale(1.15) rotate(45deg); } }
.gs-root .plf-shimmer{ animation: gs-plfShimmer 3.6s linear infinite; }
.gs-root .plf-twinkle{ animation: gs-plfTwinkle 2.2s ease-in-out infinite; }
@keyframes gs-gsWiggle{ 0%, 58%, 100% { transform: rotate(0) scale(1); } 66% { transform: rotate(-16deg) scale(1.2); } 74% { transform: rotate(13deg) scale(1.2); } 82% { transform: rotate(-9deg) scale(1.1); } 90% { transform: rotate(5deg); } }
.gs-root .gs-emoji{ display: inline-block; transform-origin: 50% 85%; animation: gs-gsWiggle 3.2s ease-in-out infinite; }
.gs-root .gs-cta:hover .gs-emoji{ animation-duration: 1s; }
.gs-root .sb-anim{ transition: background-color .28s ${EASE}, border-color .28s ${EASE}, color .24s ease, opacity .24s ease, transform .24s ${EASE}, box-shadow .28s ${EASE}; }
.gs-root .sb-hue{ -webkit-appearance: none; appearance: none; width: 100%; height: 14px; margin: 0; border-radius: 999px; outline: none; cursor: pointer; border: 1px solid rgba(0,0,0,.08); }
.gs-root .sb-hue::-webkit-slider-thumb{ -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 2px solid #111; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
.gs-root .sb-hue::-moz-range-thumb{ width: 16px; height: 16px; border-radius: 50%; background: #fff; border: 2px solid #111; box-shadow: 0 1px 4px rgba(0,0,0,.3); }
.gs-root .sb-scroll::-webkit-scrollbar{ height: 0; width: 0; display: none; }
.gs-root .sb-scroll{ scrollbar-width: none; -ms-overflow-style: none; }
.gs-root .fb-cta:hover:not(:disabled){ background: ${mix(C.onBar, C.primary, 0.14)}; }
.gs-root .fb-ghost:hover:not(:disabled){ border-color: ${C.primary}; }
.gs-root .gs-card:hover{ transform: translateY(-3px); border-color: ${DIWALI.goldDeep}; box-shadow: 0 14px 26px -18px ${DIWALI.dark}; }
@keyframes gs-gsScale{ 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
.gs-root .gs-pulse{ animation: gs-gsScale 2.6s ease-in-out infinite; }
@keyframes gs-festFlicker{ 0%, 100% { transform: scale(1, 1) rotate(-1.2deg); } 50% { transform: scale(.94, 1.1) rotate(1.4deg); } }
.gs-root .fest-flicker{ animation: gs-festFlicker 1.7s ease-in-out infinite; }
.gs-root .gs-card:hover .gs-img{ transform: scale(1.04); }
.gs-root .gs-img{ transition: transform .5s ${EASE_OUT}; }
@keyframes gs-sbIn{ from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.gs-root .sb-in{ animation: gs-sbIn .32s ${EASE} both; }
@keyframes gs-sbToastIn{ from { opacity: 0; transform: translate(-50%, 6px); } to { opacity: 1; transform: translate(-50%, 0); } }
.gs-root .sb-toast{ animation: gs-sbToastIn .22s ${EASE} both; }
.gs-root .tick-wrap{ perspective: 500px; }
.gs-root .tick-item{ position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; backface-visibility: hidden; }
.gs-root .tick-item.tick-cur{ opacity: 1; animation: gs-tickIn .55s ${EASE_OUT} both; }
.gs-root .tick-item.tick-prev{ animation: gs-tickOut .55s ${EASE} both; }
@keyframes gs-tickIn{ from { opacity: 0; transform: rotateX(-80deg) translateY(40%); } to { opacity: 1; transform: none; } }
@keyframes gs-tickOut{ from { opacity: 1; transform: none; } to { opacity: 0; transform: rotateX(80deg) translateY(-40%); } }
@media (prefers-reduced-motion: reduce){.gs-root .sb-anim,.gs-root .sb-in,.gs-root .sb-toast,.gs-root .tick-item,.gs-root .gs-img,.gs-root .plf-twinkle,.gs-root .gs-emoji,.gs-root .fest-flicker,.gs-root .gs-pulse{ transition: none !important; animation: none !important; }.gs-root .plf-shimmer{ display: none !important; }}
    `}</style>
  );
}
const Icon = ({ d, size = 18, w = 1.7 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const IconCheck = ({ size = 14, w = 2.2 }) => <Icon size={size} w={w} d={<path d="M5 12l5 5L20 7" />} />;
const IconDown = ({ size = 16 }) => <Icon size={size} w={1.8} d={<path d="M6 9l6 6 6-6" />} />;
const IconLeft = ({ size = 18 }) => <Icon size={size} w={1.9} d={<path d="M15 6l-6 6 6 6" />} />;
const IconRight = ({ size = 18 }) => <Icon size={size} w={1.9} d={<path d="M9 6l6 6-6 6" />} />;
const IconArrow = ({ size = 16 }) => <Icon size={size} w={2} d={<path d="M5 12h14M13 6l6 6-6 6" />} />;
const IconMenu = ({ size = 18 }) => <Icon size={size} w={1.8} d={<path d="M4 7h16M4 12h16M4 17h16" />} />;
const IconUser = ({ size = 18 }) => <Icon size={size} d={<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.2-5.6 7-5.6s7 2 7 5.6" /></>} />;
const IconBag = ({ size = 19 }) => <Icon size={size} d={<><path d="M5.6 8.5h12.8a1 1 0 011 1.1l-.9 9.6a1.6 1.6 0 01-1.6 1.4H7.1a1.6 1.6 0 01-1.6-1.4l-.9-9.6a1 1 0 011-1.1z" /><path d="M8.6 8.5V7a3.4 3.4 0 016.8 0v1.5" /></>} />;
const IconGift = ({ size = 18 }) => <Icon size={size} d={<><rect x="3.5" y="9" width="17" height="11" rx="1.6" /><path d="M2.5 9h19v3.2h-19zM12 9v11M12 9c-2.6 0-4.4-1-4.4-2.6 0-1.3 1.2-2.1 2.4-1.7C11.3 5.1 12 7 12 9zM12 9c2.6 0 4.4-1 4.4-2.6 0-1.3-1.2-2.1-2.4-1.7C12.7 5.1 12 7 12 9z" /></>} />;

/* simple placeholder product art (24 × 24 grid) — grey on the card images, black line-art inside the illustrations */
const GLYPH = {
  bag: <><path d="M8 7h8l1.4 3v9.2a1.3 1.3 0 01-1.3 1.3H7.9a1.3 1.3 0 01-1.3-1.3V10L8 7z" /><path d="M8 7l1-2.5h6L16 7M9.2 13.2h5.6M9.2 16h5.6" /></>,
  bottle: <><path d="M10 3.5h4v3l1.6 2.6V20a1.3 1.3 0 01-1.3 1.3H9.7A1.3 1.3 0 018.4 20V9.1L10 6.5v-3z" /><path d="M8.4 12.5h7.2M8.4 16.5h7.2" /></>,
  tin: <><ellipse cx="12" cy="6.5" rx="5.6" ry="2" /><path d="M6.4 6.5v11c0 1.1 2.5 2 5.6 2s5.6-.9 5.6-2v-11M6.4 11.2c0 1.1 2.5 2 5.6 2s5.6-.9 5.6-2" /></>,
  box: <><path d="M4 8l8-4 8 4v8.6l-8 4-8-4V8z" /><path d="M4 8l8 4 8-4M12 12v8.6" /></>,
  cup: <><path d="M5 8.5h11v5.6a4.4 4.4 0 01-4.4 4.4H9.4A4.4 4.4 0 015 14.1V8.5z" /><path d="M16 10h1.6a2.2 2.2 0 010 4.4H16M8 4.5c0 1 .8 1 .8 2M11.5 4.5c0 1 .8 1 .8 2" /></>,
  scoop: <><ellipse cx="9" cy="8.5" rx="4.6" ry="3.4" /><path d="M12.4 10.8L19.6 19" /></>,
  gift: <><rect x="4" y="9.5" width="16" height="10" rx="1.4" /><path d="M3.2 9.5h17.6V12H3.2zM12 9.5V19.5M12 9.5c-2.4 0-4-.9-4-2.3 0-1.2 1.1-1.9 2.2-1.5.9.4 1.8 1.8 1.8 3.8zM12 9.5c2.4 0 4-.9 4-2.3 0-1.2-1.1-1.9-2.2-1.5-.9.4-1.8 1.8-1.8 3.8z" /></>,
};
const GlyphG = ({ kind, x, y, s, fill = "none" }) => <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill} stroke="#000" strokeWidth={2 / s} strokeLinecap="round" strokeLinejoin="round">{GLYPH[kind]}</g>;

/* =====================================================================
   1 · Announcement bar — the Diwali bar: red-and-gold, shimmering. *highlighted* phrase is gold. Not sticky.
   ===================================================================== */
const SMALL = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "up", "via", "with"]);
const titleCase = (str) => String(str).replace(/(^|[\s\-*(])([a-z][a-z']*)/g, (m, pre, w, off) => {
  const first = off === 0 || (off === 1 && str[0] === "*");
  if (w === "am" || w === "pm") return pre + w.toUpperCase();
  return !first && pre !== "-" && SMALL.has(w) ? m : pre + w[0].toUpperCase() + w.slice(1);
});
const Msg = ({ text }) => <>{titleCase(text).split("*").map((part, i) => (i % 2 ? <span key={i} style={{ color: DIWALI.goldBright, fontWeight: 600 }}>{part}</span> : <span key={i}>{part}</span>))}</>;
function Announcements({ d }) {
  const list = COPY.announcements;
  const [st, setSt] = useState({ cur: 0, prev: -1 });
  useEffect(() => {
    if (list.length < 2) return undefined;
    const t = setInterval(() => setSt((s) => ({ cur: (s.cur + 1) % list.length, prev: s.cur })), COPY.announceEvery);
    return () => clearInterval(t);
  }, [list.length]);
  return (
    <div className="tick-wrap" role="status" aria-live="off" style={{ position: "relative", height: 34, background: C.primary, overflow: "hidden" }}>
      {list.map((t, i) => (
        <div key={i} className={"tick-item" + (i === st.cur ? " tick-cur" : i === st.prev ? " tick-prev" : "")}
          style={{ fontSize: d ? 15 : 11.5, letterSpacing: "0.01em", color: DIWALI.goldPale, padding: "0 12px", textAlign: "center", whiteSpace: "nowrap" }}><span><Msg text={t} /></span></div>
      ))}
      <FestShimmer />
    </div>
  );
}

/* =====================================================================
   2 · Header — mobile: menu · logo · bag. Desktop: Go to Shop · logo · Login · Cart.
   ===================================================================== */
const Logo = ({ d }) => <span style={{ fontSize: d ? 22 : 18, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>{COPY.brand}</span>;
const circleBtn = { position: "relative", width: 36, height: 36, flexShrink: 0, padding: 0, borderRadius: "50%", border: stroke(1, GREY_LIGHT), background: C.bg, color: INK, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
function Header({ d }) {
  if (!d) {
    return (
      <nav style={{ height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", background: C.bg, borderBottom: stroke(0.5, "rgba(0,0,0,.08)") }}>
        <button aria-label="Menu" className="fb-ghost sb-anim" style={circleBtn}><IconMenu /></button>
        <Logo />
        <button aria-label="Cart" className="fb-ghost sb-anim" style={circleBtn}><IconBag /></button>
      </nav>
    );
  }
  return (
    <nav style={{ height: 68, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: `0 ${SIDE}px`, background: C.bg, borderBottom: stroke(0.5, "rgba(0,0,0,.08)") }}>
      <div style={{ justifySelf: "start" }}>
        <button className="fb-ghost sb-anim" style={{ height: 40, padding: "0 20px", borderRadius: R.pill, border: stroke(1.5, GREY_DARK), background: C.bg, color: INK, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Go to Shop</button>
      </div>
      <Logo d />
      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 18 }}>
        <button aria-label="Login" style={{ height: 40, padding: 0, border: "none", background: "transparent", color: INK, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 500 }}><IconUser size={19} />Login</button>
        <button aria-label="Cart" style={{ height: 40, padding: 0, border: "none", background: "transparent", color: INK, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 500 }}><IconBag size={20} />Cart</button>
      </div>
    </nav>
  );
}

/* =====================================================================
   3 · Hero banner — margin to margin. A grey block until the merchant adds the artwork.
   Left: the heading and the three gifting steps (minimal). Right, in the middle: three equal info pills.
   ===================================================================== */
const IconNote = ({ size = 18 }) => <Icon size={size} d={<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />} />;
const IconBox = ({ size = 18 }) => <Icon size={size} d={GLYPH.box} />;
const IconPlus = ({ size = 14 }) => <Icon size={size} w={2.2} d={<path d="M12 5v14M5 12h14" />} />;
const IconGrid = ({ size = 14 }) => <Icon size={size} w={1.9} d={<><rect x="4" y="4" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" /></>} />;
const STEP_PILLS = [[IconGift, "Pick a gift", "A Diwali favourite, bundle or box"], [IconNote, "Add your wishes", "A note, and the day it lands"], [IconBox, "They unwrap it", "Festive boxes, every month"]];
function Hero({ d }) {
  const mode = SET.hero, def = true;
  const bg = COPY.bannerImage ? `url(${JSON.stringify(COPY.bannerImage)}) center / cover no-repeat` : C.fill;
  /* Default banner ON: the designed Diwali banner. OFF: the same heading, subtext and pills on a grey background (the merchant's picture once they add it). */
  const [a, b] = COPY.heading.split(COPY.headingGlint);
  const pill = { width: d ? 320 : 134, height: d ? 70 : 34, padding: d ? "0 22px 0 12px" : "0 9px 0 6px", borderRadius: R.pill, background: C.bg, border: stroke(1, DIWALI.goldEdge), display: "flex", alignItems: "center", gap: d ? 14 : 7 };
  const dot = { ...festPill, width: d ? 46 : 22, height: d ? 46 : 22, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" };
  if (mode === "image") {   // upload your own: just the merchant's picture slot (grey until the artwork is added)
    return <section data-hero="1"><div data-banner="1" data-hero-mode="image" style={{ height: d ? 380 : 270, background: bg, borderBottom: `2px solid ${DIWALI.goldEdge}` }} /></section>;
  }
  if (mode === "none") {    // no banner: just the heading and the line under it, on the page
    return (
      <section data-hero="1" data-hero-mode="none" style={{ padding: d ? `64px ${SIDE}px 40px` : "32px 16px 22px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: d ? 16 : 10 }}>
        <h1 style={{ margin: 0, maxWidth: d ? 760 : "100%", fontSize: d ? 48 : 26, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.03em", color: INK }}>{a.trimEnd()}<span style={{ display: "block", color: DIWALI.red }}>{COPY.headingGlint}</span>{b}</h1>
        <p style={{ margin: 0, maxWidth: d ? 560 : "100%", fontSize: d ? 17 : 13, lineHeight: 1.5, color: FADED }}>{COPY.sub}</p>
      </section>
    );
  }
  return (
    <section data-hero="1">
      <div data-banner="1" style={{ position: "relative", overflow: "hidden", height: d ? 380 : 270, background: def ? `${PAT().url}, ${festGrad(110)}` : bg, backgroundSize: def ? `${PAT().size}px ${PAT().size}px, auto` : undefined, borderBottom: `2px solid ${DIWALI.goldEdge}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: d ? 48 : 10, padding: d ? `0 ${SIDE}px` : "0 16px" }}>
        {def && <FestShimmer />}
        <div data-banner-text="1" style={{ maxWidth: d ? 580 : "58%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: d ? 18 : 10 }}>
          <h1 style={{ margin: 0, fontSize: d ? 48 : 22, lineHeight: 1.1, fontWeight: 700, letterSpacing: "-0.03em", color: def ? "#ffffff" : INK }}>{a}<span style={{ color: def ? DIWALI.goldBright : DIWALI.red }}>{COPY.headingGlint}</span>{b}</h1>
          <p style={{ margin: 0, fontSize: d ? 16 : 10.5, lineHeight: 1.5, color: def ? DIWALI.goldPale : FADED, maxWidth: d ? 500 : 190 }}>{COPY.sub}</p>
        </div>
        <div data-banner-pills="1" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: d ? 14 : 8, flexShrink: 0 }}>
          {STEP_PILLS.map(([I, t, sub]) => (
            <div key={t} style={pill}>
              <span style={dot}><span style={{ position: "relative", display: "flex" }}><I size={d ? 22 : 12} /></span></span>
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: d ? 17 : 10.5, fontWeight: 700, letterSpacing: "-0.01em", color: INK, whiteSpace: "nowrap" }}>{t}</span>
                {d && <span style={{ fontSize: 14, fontWeight: 600, color: DIWALI.red, whiteSpace: "nowrap" }}>{sub}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   4 · Filter tabs — plain words side by side, the selected one has a red dash. Sticky at the top.
   ===================================================================== */
const TAB_LIST = [["single", "Single products"], ["byob", "Build your own"], ["mix", "Mix & match"], ["bundle", "Festive bundles"]];
const TABS_H = (d) => (d ? 60 : 56);
const SIDE_LANTERNS = [["left", 26, 84, 26], ["left", 64, 38, 26], ["right", 30, 66, 26], ["right", 66, 28, 26]];   // side, offset from the edge, string length, lantern width — two on each side: the longer one outside (by the edge), the shorter one inside
/* desktop: two lanterns on each side hang from the top of the subscription section, in the page margins, and scroll away with the page */
const SIDE_LANTERNS_M = [["right", 16, 24, 16], ["right", 46, 8, 16]];   // mobile: two small ones on the right
function SideLanterns({ d }) {
  return (
    <>
      {(d ? SIDE_LANTERNS : SIDE_LANTERNS_M).map(([side, off, len, lw], k) => (
        <div key={k} aria-hidden="true" data-side-lantern={side} style={{ position: "absolute", top: 0, [side]: off, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
          <span style={{ width: 1.5, height: len, background: DIWALI.goldDeep }} /><Lantern w={lw} />
        </div>
      ))}
    </>
  );
}
function Tabs({ d, active, onTab }) {
  const wrap = useRef(null), btns = useRef({});
  const [ind, setInd] = useState({ x: 0, w: 0 });
  useEffect(() => {
    const measure = () => { const el = btns.current[active]; if (el) setInd({ x: el.offsetLeft, w: el.offsetWidth }); };
    measure();
    const el = btns.current[active], w = wrap.current;
    if (el && w && w.scrollWidth > w.clientWidth + 2) w.scrollTo({ left: Math.max(0, el.offsetLeft - 24), behavior: "smooth" });
    const t = setTimeout(measure, 350);                // again once the font has loaded
    return () => clearTimeout(t);
  }, [active, d]);
  return (
    <div data-tabs="1" style={{ position: "sticky", top: 0, zIndex: 30, background: PAGE_BG, borderBottom: stroke(1, GREY_LIGHT) }}>
      <div ref={wrap} className="sb-scroll" role="tablist" aria-label="Gift types" style={{ position: "relative", display: "flex", justifyContent: d ? "center" : "flex-start", gap: d ? 56 : 32, overflowX: "auto", padding: d ? `0 ${SIDE}px` : "0 20px" }}>
        {TAB_LIST.map(([id, label]) => {
          const on = active === id;
          return (
            <button key={id} ref={(el) => { btns.current[id] = el; }} role="tab" aria-selected={on} onClick={() => onTab(id)} className="sb-anim"
              style={{ flexShrink: 0, height: TABS_H(d), padding: 0, background: "transparent", border: "none", cursor: "pointer", fontSize: d ? 17 : 15, fontWeight: on || id === "byob" || id === "mix" ? 700 : 500, whiteSpace: "nowrap", color: id === "byob" || id === "mix" ? GOLD_TEXT : on ? INK : FADED }}>{label}</button>
          );
        })}
        <span aria-hidden="true" data-dash="1" style={{ position: "absolute", left: 0, bottom: 0, height: 3, width: Math.max(16, ind.w - 28), borderRadius: 3, background: DIWALI.redBright, transform: `translateX(${ind.x + 14}px)`, transition: `transform .5s ${EASE_OUT}, width .5s ${EASE_OUT}` }} />
      </div>
    </div>
  );
}

/* =====================================================================
   5 · Product cards — the Final Master's product card (same layout, sizes, offer pill, black CTA), in the BXGY free card's ivory + gold
   ===================================================================== */
const sizes = (d) => (d
  ? { name: 18, price: 18, strike: 14, tag: 13, tagH: 26, cta: 46, ctaF: 15, pad: 9, inset: 10, pillH: 22, pillF: 10.5, pillPad: "0 9px" }
  : { name: 13.5, price: 15, strike: 12, tag: 11, tagH: 22, cta: 40, ctaF: 13, pad: 8, inset: 8, pillH: 19, pillF: 9.5, pillPad: "3px 8px" });
const IconRepeat = ({ size = 12 }) => <Icon size={size} w={2.2} d={<path d="M17 2l3 3-3 3M3 11V9a4 4 0 014-4h13M7 22l-3-3 3-3M21 13v2a4 4 0 01-4 4H4" />} />;

/* what the card is — a small tag sitting between the title and the price */
function KindTag({ d, icon, children, solid = false }) {
  const s = sizes(d);
  return <span data-kind-tag="1" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, height: s.tagH, padding: d ? "0 11px 0 9px" : "0 9px 0 7px", borderRadius: 8, background: solid ? `linear-gradient(110deg, ${DIWALI.goldPale}, ${DIWALI.gold})` : C.bg, border: solid ? "none" : stroke(1, rgba(DIWALI.red, 0.35)), color: DIWALI.red, fontSize: s.tag, fontWeight: 600, whiteSpace: "nowrap" }}>{icon}{children}</span>;
}

function GiftCard({ d, w, name, price, mrp, media, tag, onGift, idx = 0, kind = "sub", from = false, cta = "Gift this", emoji = true, bare = false }) {
  const s = sizes(d), off = Math.round((1 - price / mrp) * 100), bundle = kind === "bundle", hex = bundle ? COPY.bundleHex : DIWALI.ivory;   // subscription cards wear the light colour
  return (
    <article className={(d ? "gs-card sb-anim" : "sb-anim") + (bundle ? " is-bundle" : "")} style={{ width: w, flex: "0 0 auto", scrollSnapAlign: "start", display: "flex", flexDirection: "column", minWidth: 0, background: hex, border: stroke(1, mix("#000000", hex, 0.12)), borderRadius: R.card, padding: s.pad }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: C.fill, borderRadius: R.img, overflow: "hidden" }}>
        {media}
        {!bare && <span data-fest-pill="1" style={{ ...festPill, position: "absolute", zIndex: 3, top: s.inset, right: s.inset, height: s.pillH, padding: s.pillPad, fontSize: s.pillF, fontWeight: 700, borderRadius: R.pill, lineHeight: 1, display: "inline-flex", alignItems: "center" }}><span style={{ position: "relative" }}>{off}% OFF</span><FestShimmer /></span>}
      </div>
      <div style={{ padding: d ? "14px 4px 0" : "10px 3px 0", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ fontSize: s.name, fontWeight: 700, lineHeight: 1.3, letterSpacing: "-0.01em", color: DIWALI.red, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: s.name * 1.3 * 2 }}>{name}</div>
        <div style={{ marginTop: d ? 8 : 6, display: "flex" }}>{tag}</div>
        {!bare && (<>
        <div style={{ display: "flex", alignItems: "center", gap: d ? 8 : 6, marginTop: d ? 14 : 10 }}>
          {from && <span style={{ fontSize: s.strike, fontWeight: 500, color: FADED, marginRight: -2 }}>From</span>}<span style={{ fontSize: s.price, fontWeight: 600, color: C.priceOnTile, letterSpacing: "-0.01em" }}>{inr(price)}</span>
          <span style={{ fontSize: s.strike, color: FADED, textDecoration: "line-through" }}>{inr(mrp)}</span>
        </div>
        <div style={{ marginTop: "auto", paddingTop: d ? 16 : 11 }}>
          <button onClick={() => onGift(name)} className="fb-cta sb-anim gs-cta" style={{ height: s.cta, width: "100%", borderRadius: R.pill, border: "none", background: C.primary, color: C.onBar, cursor: "pointer", fontSize: s.ctaF, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            {emoji && <span className="gs-emoji" aria-hidden="true" style={{ animationDelay: `${idx * 0.45}s`, fontSize: s.ctaF + 2 }}>🎁</span>}{cta}
          </button>
        </div>
        </>)}
      </div>
    </article>
  );
}
const SingleCard = ({ p, i, d, w, onGift }) => <GiftCard d={d} w={w} idx={i} name={p.name} price={p.price} mrp={p.mrp} onGift={onGift} tag={<KindTag d={d} icon={<IconRepeat size={d ? 13 : 11} />}>Subscription</KindTag>} />;

/* a fixed bundle: the one image area is simply divided into 2, 3 or 4 — no boxes inside it */
function BundleImage({ glyphs, gap }) {
  const g = glyphs.slice(0, 4), n = g.length;
  return (
    <div className="gs-img" style={{ position: "absolute", inset: 0, display: "grid", gap: 2, background: gap, gridTemplateColumns: "1fr 1fr", gridTemplateRows: n === 2 ? "1fr" : "1fr 1fr" }}>
      {g.map((k, i) => <div key={i} style={{ background: C.fill, gridRow: n === 3 && i === 0 ? "1 / span 2" : undefined }} />)}
    </div>
  );
}
const BUNDLE_TAG = {
  fixed: (b, d) => [<IconBox size={d ? 13 : 11} />, `Fixed · ${b.n} products`],
  bxgy: (b, d) => [<IconGift size={d ? 13 : 11} />, `Buy ${b.buy} Get ${b.free} Free`],
  byob: (b, d) => [<IconPlus size={d ? 13 : 11} />, "Build your own"],
  mix: (b, d) => [<IconGrid size={d ? 13 : 11} />, "Mix & match"],
};
const BundleCard = ({ b, i, d, w, onGift }) => { const [ic, label] = BUNDLE_TAG[b.type](b, d); return <GiftCard d={d} w={w} idx={i} name={b.name} price={b.price} mrp={b.mrp} onGift={onGift} kind="bundle" from={b.type === "byob"} tag={<KindTag d={d} icon={ic}>{label}</KindTag>} media={<BundleImage glyphs={b.glyphs} gap={COPY.bundleHex} />} />; };

/* a row of cards. Desktop: exactly 4 at once, margin to margin; the round arrows in the margins (centred on the cards) move one card at a time.
   Mobile: swipe — one card and 80% of the next. */
function Slider({ d, children }) {
  const ref = useRef(null), [edge, setEdge] = useState({ l: false, r: true });
  const GAP = d ? 24 : 12;
  const upd = () => { const el = ref.current; if (!el) return; setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => { upd(); const t = setTimeout(upd, 150); return () => clearTimeout(t); }, []);
  const go = (dir) => { const el = ref.current; if (!el || !el.firstElementChild) return; el.scrollBy({ left: dir * (el.firstElementChild.offsetWidth + GAP), behavior: "smooth" }); };
  const arrow = (dir) => (
    <button aria-label={dir < 0 ? "Previous card" : "Next card"} onClick={() => go(dir)} className="fb-ghost sb-anim sb-in"
      style={{ position: "absolute", top: "50%", marginTop: -22, [dir < 0 ? "left" : "right"]: (SIDE - 44) / 2, zIndex: 5, width: 44, height: 44, padding: 0, borderRadius: "50%", background: C.bg, border: stroke(1.5, GREY_DARK), color: INK, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {dir < 0 ? <IconLeft size={20} /> : <IconRight size={20} />}
    </button>
  );
  return (
    <div style={{ position: "relative", padding: d ? `0 ${SIDE}px` : 0 }}>
      {/* the padding + negative margin give the card glow room, so it is never cut at the bottom */}
      <div ref={ref} onScroll={upd} className="sb-scroll" style={{ display: "flex", gap: GAP, overflowX: "auto", scrollSnapType: d ? "x mandatory" : "x proximity", padding: d ? "16px 0 44px" : "12px 16px 36px", margin: d ? "-16px 0 -44px" : "-12px 0 -36px", scrollPaddingLeft: d ? 0 : 16 }}>
        {children}
        {!d && <div style={{ flex: "0 0 4px" }} aria-hidden="true" />}
      </div>
      {d && edge.l && arrow(-1)}
      {d && edge.r && arrow(1)}
    </div>
  );
}

/* the same cards as a plain grid: desktop 4 across, mobile 2 across — the setting "Cards: Carousel / Grid" */
function GridList({ d, children }) {
  return <div data-cards="grid" style={{ display: "grid", gridTemplateColumns: d ? "repeat(4, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: d ? 24 : 12, padding: d ? `0 ${SIDE}px` : "0 16px", alignItems: "stretch" }}>{children}</div>;
}
const Carousel = (p) => (SET.cards === "grid" ? <GridList {...p} /> : <Slider {...p} />);

/* heading + subtext on the left, a small gift tag on the right */
function SectionHead({ d, title, sub, tag }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: d ? `0 ${SIDE}px 28px` : "0 16px 16px" }}>
      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: d ? 14 : 8 }}>
        <div style={{ minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: d ? 28 : 19, fontWeight: 700, letterSpacing: "-0.02em", color: INK, lineHeight: 1.2 }}>{title}</h2>
        <p style={{ margin: d ? "6px 0 0" : "3px 0 0", fontSize: d ? 15 : 12.5, color: FADED, lineHeight: 1.35 }}>{sub}</p>
        </div>
      </div>
      {tag && <span data-head-tag="1" style={{ flexShrink: 0, height: d ? 36 : 24, padding: d ? "0 16px" : "0 9px", borderRadius: R.pill, background: festGrad(110), color: DIWALI.goldPale, boxShadow: `inset 0 0 0 1px ${DIWALI.gold}`, fontSize: d ? 14 : 10, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: d ? 7 : 4, whiteSpace: "nowrap" }}><span style={{ color: DIWALI.goldBright, display: "flex" }}><IconGift size={d ? 16 : 11} /></span>{tag}</span>}
    </div>
  );
}

/* Build your own + Mix & match: the banner is given by the merchant — a grey block until the artwork is added. The text and the CTA stay on it, and it pulses: these are the two main features. */
const FLOW_TEXT = {
  byob: ["Fill a Diwali box with their favourites.", "Add any products you like. The more you add, the more you save.", "Build a Diwali box"],
  mix: ["One pick from every shelf.", "Choose one product from each category, and the last one is a free Diwali gift.", "Mix a Diwali box"],
};
function FlowBanner({ kind, d, onGift }) {
  const mode = SET.flow, byob = kind === "byob", img = byob ? COPY.byobBanner : COPY.mixBanner, [h, sub, cta] = FLOW_TEXT[kind];
  const dark = mode === "default";   // default: the designed Diwali banner, the same look as the top banner (red gradient + pattern, light text), on mobile and desktop
  const ctaBtn = (
    <button onClick={() => onGift(byob ? "Build your own box" : "Mix & match box")} className="fb-cta sb-anim gs-cta" style={{ position: "relative", overflow: "hidden", flexShrink: 0, height: d ? 50 : 36, padding: d ? "0 28px" : "0 14px", borderRadius: R.pill, border: "none", ...(dark ? { background: `linear-gradient(110deg, ${DIWALI.goldPale}, ${DIWALI.gold})`, color: DIWALI.redDeep } : { background: C.primary, color: C.onBar }), fontSize: d ? 15 : 11.5, fontWeight: dark ? 600 : 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}><span className="gs-emoji" aria-hidden="true" style={{ position: "relative" }}>🎁</span><span style={{ position: "relative" }}>{cta}</span></button>
  );
  const text = (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: d ? 12 : 6, maxWidth: d ? 600 : "60%" }}>
      <h3 style={{ margin: 0, fontSize: d ? 34 : 18, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em", color: dark ? "#ffffff" : INK }}>{h}</h3>
      <p style={{ margin: 0, fontSize: d ? 16 : 11.5, lineHeight: 1.5, color: dark ? DIWALI.goldPale : FADED }}>{sub}</p>
    </div>
  );
  const box = { position: "relative", overflow: "hidden", height: d ? 240 : 176, borderRadius: R.card + 4, border: stroke(1.5, DIWALI.goldEdge), display: "flex", alignItems: "center", gap: d ? 32 : 10, padding: d ? "0 56px" : "0 14px 0 18px" };
  if (mode === "image") {   // upload your own: the merchant's artwork (grey until it is added) — only the CTA stays on it
    return <div data-flow-banner={kind} data-flow-mode="image" className="gs-pulse" style={{ ...box, justifyContent: "flex-end", background: img ? `url(${JSON.stringify(img)}) center / cover no-repeat` : C.fill }}>{ctaBtn}</div>;
  }
  return (   // default: the designed Diwali banner, same look as the hero
    <div data-flow-banner={kind} data-flow-mode="default" className="gs-pulse" style={{ ...box, justifyContent: "space-between", background: `${PAT().url}, ${festGrad(110)}`, backgroundSize: `${PAT().size}px ${PAT().size}px, auto` }}>
      <FestShimmer />
      {text}
      {ctaBtn}
    </div>
  );
}

/* the stops the tabs jump to, in page order: single products · the two flow banners (one below the other) · fixed bundles */
function Offerings({ d, onGift, refs }) {
  const w = SET.cards === "grid" ? "100%" : d ? "calc((100% - 72px) / 4)" : "56.2%";   // carousel — desktop: 4 cards · mobile: one card and 80% of the next · grid: the cell
  return (
    <>
      <section ref={refs.single} aria-label="Single products" style={{ position: "relative", padding: d ? "64px 0 0" : "72px 0 0" }}>
        <SideLanterns d={d} />
        <SectionHead d={d} title="Diwali favourites" sub="One festive favourite, delivered on repeat." tag="3, 6 or 12 months" />
        <Carousel d={d}>{SINGLES.map((p, i) => <SingleCard key={p.id} p={p} i={i} d={d} w={w} onGift={onGift} />)}</Carousel>
      </section>
      <section ref={refs.personal} aria-label="Build or mix a box" data-personal="1" style={{ marginTop: d ? 72 : 44, padding: d ? `0 ${SIDE}px` : "0 16px", display: "flex", flexDirection: "column", gap: d ? 24 : 14 }}>
        <div ref={refs.byob}><FlowBanner kind="byob" d={d} onGift={onGift} /></div>
        <div ref={refs.mix}><FlowBanner kind="mix" d={d} onGift={onGift} /></div>
      </section>
      <div style={{ marginTop: d ? 72 : 44 }}><DiyaDivider d={d} /></div>
      <section ref={refs.bundle} aria-label="Festive bundles" style={{ padding: d ? "56px 0 0" : "36px 0 0" }}>
        <SectionHead d={d} title="Festive bundles" sub="Ready-made Diwali boxes at one price." tag="Ready to gift" />
        <Carousel d={d}>{BUNDLES.map((b, i) => <BundleCard key={b.id} b={b} i={i} d={d} w={w} onGift={onGift} />)}</Carousel>
      </section>
    </>
  );
}

/* =====================================================================
   6 · They open it like a gift — a slider of gift notes, each with the recipient's review
   ===================================================================== */
const Stars = ({ size = 14 }) => <span aria-label="5 out of 5" style={{ display: "inline-flex", gap: 2 }}>{[0, 1, 2, 3, 4].map((i) => <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z" fill={DIWALI.goldDeep} /></svg>)}</span>;
function GiftNote({ d }) {
  const [i, setI] = useState(0), [hold, setHold] = useState(false);
  useEffect(() => {
    if (hold) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % NOTES.length), 5600);
    return () => clearInterval(t);
  }, [hold]);
  const [a, b] = ["They open it like a Diwali gift, and ", "read your wishes first."];
  return (
    <section data-highlight="1" aria-label="What they receive" style={{ position: "relative", marginTop: d ? 88 : 52, padding: d ? `104px ${SIDE}px 96px` : "74px 16px 56px", display: "grid", gridTemplateColumns: d ? "minmax(0, 1fr) minmax(0, 1fr)" : "minmax(0, 1fr)", gap: d ? 72 : 36, alignItems: "center", background: `${FEST_TILE.url}, ${festGrad(165)}`, backgroundSize: `${FEST_TILE.size}px ${FEST_TILE.size}px, auto`, borderTop: stroke(2, DIWALI.goldEdge), borderBottom: stroke(2, DIWALI.goldEdge), overflow: "hidden" }}>
      <FestShimmer />
      {/* lanterns hanging from the top edge */}
      {(d ? [[SIDE - 10, 20], [SIDE + 60, 54], [1440 - SIDE - 52, 40], [1440 - SIDE + 8, 14]] : [[14, 16], [66, 38], [393 - 80, 30], [393 - 28, 12]]).map(([x, len], k) => (
        <div key={k} aria-hidden="true" style={{ position: "absolute", left: x, top: 0, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none" }}>
          <span style={{ width: 1.5, height: len, background: DIWALI.goldDeep }} /><Lantern w={d ? 28 : 22} />
        </div>
      ))}
      <div style={{ position: "relative" }}>
        <h2 style={{ margin: 0, fontSize: d ? 46 : 27, lineHeight: 1.12, fontWeight: 700, letterSpacing: "-0.03em", color: "#ffffff", maxWidth: 540 }}>{a}<span style={{ color: DIWALI.goldBright }}>{b}</span></h2>
        <div data-pointers="1" style={{ marginTop: d ? 44 : 30, display: "flex", flexDirection: "column", gap: d ? 28 : 22 }}>
          {POINTERS.map(([key, rest, sub]) => (
            <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: d ? 16 : 12 }}>
              <span data-tick="1" style={{ ...festPill, width: d ? 26 : 22, height: d ? 26 : 22, marginTop: d ? 1 : 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ position: "relative", display: "flex" }}><IconCheck size={d ? 14 : 12} w={3} /></span></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: d ? 18 : 14.5, fontWeight: 600, letterSpacing: "-0.01em", color: "#ffffff", lineHeight: 1.3 }}><span style={{ color: DIWALI.goldBright }}>{key}</span>{rest}</div>
                <div style={{ marginTop: 4, fontSize: d ? 14 : 12, fontWeight: 400, lineHeight: 1.5, color: DIWALI.goldPale, opacity: 0.85 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} style={{ position: "relative", justifySelf: d ? "end" : "stretch", width: "100%", minWidth: 0, maxWidth: d ? 440 : "100%" }}>
        <div data-slider="1" style={{ display: "grid", width: "100%" }}>
          {NOTES.map((n, k) => {
            const on = k === i;
            return (
              <div key={n.from} data-note-card="1" aria-hidden={!on} style={{ gridArea: "1 / 1", background: C.bg, border: stroke(1.5, DIWALI.goldEdge), borderRadius: R.card + 4, padding: d ? 26 : 18, opacity: on ? 1 : 0, transform: on ? "none" : "translateY(14px) scale(.98)", visibility: on ? "visible" : "hidden", pointerEvents: on ? "auto" : "none", boxShadow: `0 18px 34px -20px ${DIWALI.redDeep}`, transition: `opacity .8s ease, transform .9s ${EASE_OUT}, visibility 0s linear ${on ? "0s" : ".8s"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ ...festPill, width: d ? 38 : 32, height: d ? 38 : 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ position: "relative", display: "flex" }}><IconGift size={d ? 19 : 16} /></span></span>
                  <div><div style={{ fontSize: d ? 14 : 11, fontWeight: 500, color: FADED }}>A gift for {n.to}</div><div style={{ fontSize: d ? 16 : 14, fontWeight: 600, color: INK }}>From {n.from}</div></div>
                </div>
                <p style={{ margin: d ? "20px 0" : "16px 0", fontSize: d ? 20 : 15, lineHeight: 1.5, fontWeight: 500, color: DIWALI.red, letterSpacing: "-0.01em", minHeight: d ? 90 : 68 }}>“{n.msg}”</p>
                <div style={{ paddingTop: d ? 18 : 14, borderTop: stroke(1, DIWALI.goldSoft) }}>
                  <Stars size={d ? 15 : 13} />
                  <div style={{ marginTop: 8, fontSize: d ? 15 : 12.5, lineHeight: 1.5, color: INK, minHeight: d ? 46 : 38 }}>“{n.quote}” <span style={{ color: FADED }}>· {n.who}</span></div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: d ? 24 : 18 }}>
          {NOTES.map((n, k) => <button key={n.from} aria-label={`Show note ${k + 1}`} aria-current={k === i} onClick={() => setI(k)} className="sb-anim" style={{ width: k === i ? 16 : 6, height: 6, padding: 0, border: "none", borderRadius: R.pill, cursor: "pointer", background: k === i ? DIWALI.goldBright : "rgba(255,255,255,.4)", transition: `width .4s ${EASE_OUT}, background-color .25s ease` }} />)}
        </div>
      </div>
    </section>
  );
}

/* =====================================================================
   7 · FAQ — a simple accordion, centred, heading on top
   ===================================================================== */
function Faq({ d }) {
  const [open, setOpen] = useState(0);
  return (
    <section aria-label="Questions" style={{ padding: d ? `24px ${SIDE}px 96px` : "16px 16px 52px" }}>
      <h2 style={{ margin: d ? "0 0 32px" : "0 0 18px", textAlign: "center", fontSize: d ? 34 : 22, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>Good to know</h2>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {FAQS.map(([q, a], i) => {
          const on = open === i;
          return (
            <div key={q} style={{ borderTop: i ? stroke(1, GREY_DARK) : "none" }}>
              <button onClick={() => setOpen(on ? -1 : i)} aria-expanded={on} className="sb-anim" style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: d ? "22px 4px" : "17px 2px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, cursor: "pointer", fontSize: d ? 17 : 14, fontWeight: 600, color: INK }}>
                {q}<span style={{ display: "flex", flexShrink: 0, transform: on ? "rotate(180deg)" : "none", transition: `transform .3s ${EASE}` }}><IconDown size={18} /></span>
              </button>
              <div style={{ display: "grid", gridTemplateRows: on ? "1fr" : "0fr", transition: `grid-template-rows .35s ${EASE_OUT}` }}>
                <div style={{ minHeight: 0, overflow: "hidden" }}>
                  <p style={{ margin: 0, padding: d ? "0 4px 24px" : "0 2px 18px", fontSize: d ? 15 : 13, lineHeight: 1.55, color: FADED }}>{a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
const Footer = ({ merged }) => (
  <div style={{ height: 26, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.3px", color: C.subOnBar, textTransform: "uppercase", lineHeight: 1 }}>Powered by: Stackback.Ai</span>
  </div>
);

/* =====================================================================
   The page — one shell for both frames
   ===================================================================== */
function Page({ d, wall = true, heroNode = null }) {
  const [spy, setSpy] = useState("single");
  const [toast, setToast] = useState(""), toastT = useRef(null);
  const scRef = useRef(null), refs = { single: useRef(null), personal: useRef(null), byob: useRef(null), mix: useRef(null), bundle: useRef(null) };
  const showToast = (t) => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2200); };
  useEffect(() => () => clearTimeout(toastT.current), []);
  const th = TABS_H(d);
  /* the dash follows the page: whichever stop is at the top */
  const onScroll = () => {
    const sc = scRef.current; if (!sc) return;
    const y = sc.scrollTop + th + 40;
    const stops = [["single", refs.single], ["byob", refs.byob], ["mix", refs.mix], ["bundle", refs.bundle]];
    let cur = "single";
    stops.forEach(([id, r]) => { if (r.current && r.current.offsetTop <= y) cur = id; });
    setSpy((o) => (o === cur ? o : cur));
  };
  const goTab = (id) => {
    const sc = scRef.current; if (!sc) return;
    const r = refs[id];
    if (r && r.current && sc.scrollTo) sc.scrollTo({ top: Math.max(0, r.current.offsetTop - th - (id === "byob" || id === "mix" ? 16 : 0)), behavior: "smooth" });
  };
  return (
    <div className="gs-root" style={{ position: "relative", width: "100%", height: "100%", fontFamily: FONT, background: PAGE_BG, color: INK }}>
      <div ref={scRef} onScroll={onScroll} className="sb-scroll" style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", background: PAGE_BG }}>
        <div style={{ position: "relative" }}>
          <Announcements d={d} />
          <Header d={d} />
          {heroNode || <Hero d={d} />}
          <Tabs d={d} active={spy} onTab={goTab} />
          <Offerings d={d} refs={refs} onGift={(n) => showToast(`${n}: the gift details page opens here`)} />
          <GiftNote d={d} />
          <div style={{ marginTop: d ? 72 : 44 }}><DiyaDivider d={d} /></div>
          <Faq d={d} />
          {wall && COPY.wall && <IllustrationWall d={d} />}
          <Footer merged={wall && COPY.wall} />
        </div>
      </div>
      {toast && <div key={toast} role="status" aria-live="polite" className="sb-toast" style={{ position: "absolute", left: "50%", bottom: 18, zIndex: 120, maxWidth: "calc(100% - 32px)", background: C.bg, color: INK, border: stroke(1, GREY_DARK), fontSize: d ? 14 : 12, fontWeight: 600, padding: "9px 16px", borderRadius: R.pill, boxShadow: "0 6px 16px -8px rgba(0,0,0,.25)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{toast}</div>}
    </div>
  );
}

  /* the product card the Subscription pages' carousel uses — the Gift page's card (same image, pill, name, tag, price, button) */
  const UpsellCard = ({ item, i, d }) => {
    const num = (t) => Number(String(t).replace(/[^0-9]/g, "")) || 0, bundle = !!item.media && item.media.type !== "single";
    const glyphs = bundle ? ["bag", "tin", "cup", "box"].slice(0, item.media.type === "split2" ? 2 : item.media.type === "split3" ? 3 : 4) : null;
    return <GiftCard d={d} w="100%" idx={i} name={item.name} price={num(item.price)} mrp={num(item.mrp)} kind={bundle ? "bundle" : "sub"} cta={item.cta || "Subscribe"} emoji={false} onGift={() => {}}
      tag={<KindTag d={d} icon={bundle ? <IconBox size={d ? 13 : 11} /> : <IconRepeat size={d ? 13 : 11} />}>{bundle ? "Bundle" : "Subscription"}</KindTag>}
      media={bundle ? <BundleImage glyphs={glyphs} gap={COPY.bundleHex} /> : null} />;
  };
  const ItemCard = ({ name, i, d }) => <GiftCard d={d} w="100%" idx={i} name={name} price={1} mrp={1} kind="sub" bare onGift={() => {}} tag={<KindTag d={d} icon={<IconGift size={d ? 13 : 11} />}>Could be inside</KindTag>} />;
  return { Page, StyleTag, applyFest, UpsellCard, ItemCard, Diya, SideLanterns, IllustrationWall, DiyaDivider, setBrand: (b) => { COPY.brand = b; }, sync: (c) => { SET = { ...SET, ...c }; } };
})();

/* =====================================================================
   SUBSCRIPTION + SURPRISE BOX landing pages — from SB_Diwali_Subscription_Surprise.jsx, kept in their own scope so their names never clash with this page's.
   Page type → Subscription / Surprise box. The pages read the Diwali colours, the theme and the Subscription settings (widget, variant style, one-time option, endless, gift it to someone) from the panel.
   ===================================================================== */
const SUB = (() => {
  const { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowRight, X, MapPin, Check, Plus, Minus, Gift, SlidersHorizontal, CreditCard, RefreshCw, PauseCircle, Wallet, Percent, User, Settings, Zap, Search, Lock, Link2 } = Lucide;

// ---------- content data ----------

const VARIANTS = ['Classic', 'Reserve', 'Light', 'Intense'];

const QUANTITY_OPTIONS = [
  { label: '250g', price: 399, mrp: 549 },
  { label: '500g', price: 749, mrp: 999 },
  { label: '1kg', price: 1399, mrp: 1899 },
  { label: '2kg', price: 2599, mrp: 3499 },
];

// Fallback pricing (250g × 1) so widgets render sensibly if mounted standalone.
// The landing page overrides this via the `pricing` prop, derived from the
// quantity + units selector, so every plan price scales with the selection.
const DEFAULT_PRICING = (() => {
  const q = QUANTITY_OPTIONS[0];
  const perDelivery = q.price, oneTime = q.mrp, term = 4;
  return {
    oneTime, perDelivery, payg: oneTime,
    upfrontTotal: perDelivery * term,
    upfrontSaved: (oneTime - perDelivery) * term,
    perDeliverySaved: oneTime - perDelivery,
    term,
  };
})();

const MINI_FAQ = [
  {
    id: 'autodebit',
    q: 'What is Auto Debit?',
    a: "Your saved payment method is charged automatically before each shipment ships — no manual reordering, and you're notified every time.",
  },
  {
    id: 'subscription',
    q: 'How does the subscription work?',
    a: 'Choose a variant, quantity and delivery frequency once — we prepare and ship it fresh, shipment after shipment, until you decide to stop.',
  },
  {
    id: 'charged',
    q: 'When will I be charged?',
    a: "A few days before each shipment ships, using your saved payment method, so you always know what's coming and when.",
  },
  {
    id: 'flexibility',
    q: 'What is add, swap and pause?',
    a: 'Add extra items to your next order, swap variants anytime, or pause your subscription whenever you like — full control, always.',
  },
];

// "Pay Your Way" — one 4-step flow per payment method. The section follows
// the payment method selected in the widget (one-time falls back to upfront).
const PROCESS_STEPS = {
  upfront: [
    { Icon: Search,            title: 'Choose Your Plan',      body: 'Pick your product, quantity and delivery frequency.' },
    { Icon: Wallet,            title: 'Subscribe',             body: 'Pay in full at checkout and activate your plan.' },
    { Icon: Lock,              title: 'Deliveries Locked In',  body: 'Orders get delivered to you on your schedule.' },
    { Icon: SlidersHorizontal, title: 'Manage Anytime',        body: 'Track, add, swap or reschedule from your customer portal.' },
  ],
  payg: [
    { Icon: Search,            title: 'Choose Your Plan',      body: 'Pick your product, quantity and delivery frequency.' },
    { Icon: Check,             title: 'Subscribe',             body: 'Get charged for the first delivery to activate your plan.' },
    { Icon: Link2,             title: 'Pay As You Go',         body: 'You receive a payment link before every delivery.' },
    { Icon: SlidersHorizontal, title: 'Manage Anytime',        body: 'Track, add, swap or reschedule orders from your customer portal.' },
  ],
  perDelivery: [
    { Icon: Search,            title: 'Choose Your Plan',      body: 'Pick your product, quantity and delivery frequency.' },
    { Icon: Check,             title: 'Subscribe',             body: 'Transaction of your first order approves charges for future deliveries.' },
    { Icon: CreditCard,        title: 'Pay Per Delivery',      body: 'Get notified and charged before each order is due.' },
    { Icon: SlidersHorizontal, title: 'Manage Anytime',        body: 'Track, add, swap or reschedule orders from your customer portal.' },
  ],
};

const FULL_FAQ = [
  {
    id: 'subscribe',
    q: 'How does the subscription work?',
    lead: 'Choose a variant and a delivery frequency, once.',
    rest: 'We prepare and ship it fresh, shipment after shipment, until you say stop.',
  },
  {
    id: 'autodebit',
    q: 'How does auto-pay work?',
    lead: 'Your saved payment method is charged automatically.',
    rest: 'It happens a few days before each shipment — no manual reordering.',
  },
  {
    id: 'flexibility',
    q: 'Can I pause, skip or swap anytime?',
    lead: 'Yes, whenever you like.',
    rest: 'Add extra items, swap variants, or pause your subscription anytime from your account — no calls, no emails.',
  },
  {
    id: 'shipping',
    q: 'Is shipping really free?',
    lead: 'On every order, no minimum.',
    rest: 'Free shipping is built into every subscription plan.',
  },
  {
    id: 'brand',
    q: 'What makes your product different?',
    lead: "It's never sitting on a shelf.",
    rest: 'Made in small batches, to order, and shipped within 48 hours of production.',
  },
  {
    id: 'frequency',
    q: 'Can I change my variant or frequency later?',
    lead: 'Absolutely, anytime your preferences change.',
    rest: 'Swap variants, options, or how often you receive deliveries.',
  },
];

const SUBSCRIPTION_PRODUCTS = [
  {
    name: 'Signature Collection Box',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Subscription', tone: 'subscription' }],
    cta: 'Subscribe',
  },
  {
    name: 'Starter Essentials Set',
    mrp: '\u20b9399', price: '\u20b9319', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Subscription', tone: 'subscription' }],
    cta: 'Subscribe',
  },
  {
    name: 'Premium Selection Pack',
    mrp: '\u20b9499', price: '\u20b9399', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Subscription', tone: 'subscription' }],
    cta: 'Subscribe',
  },
  {
    name: 'Classic Reserve Edition',
    mrp: '\u20b9549', price: '\u20b9439', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Subscription', tone: 'subscription' }],
    cta: 'Subscribe',
  },
  {
    name: 'Everyday Ritual Set',
    mrp: '\u20b9459', price: '\u20b9367', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Subscription', tone: 'subscription' }],
    cta: 'Subscribe',
  },
];

const BUNDLE_PRODUCTS = [
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Fixed Bundle \u2022 3 items', tone: 'bundle' }],
    itemsText: 'Vitamin C \u00b7 HA Moisturizer \u00b7 SP...',
    iconAvatars: true,
    cta: 'Add Bundle',
  },
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'grid4' },
    badges: [{ label: 'Fixed Bundle \u2022 3 items', tone: 'bundle' }],
    itemsText: 'Vitamin C \u00b7 HA Moisturizer \u00b7 SPF 50',
    cta: 'Add Bundle',
  },
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'grid4', moreCount: 3 },
    badges: [{ label: 'Fixed Bundle \u2022 6 items', tone: 'bundle' }],
    itemsText: 'Vitamin C \u00b7 HA Moisturizer \u00b7 SPF 50',
    cta: 'Add Bundle',
  },
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'split3' },
    badges: [{ label: 'Fixed Bundle \u2022 3 items', tone: 'bundle' }],
    itemsText: 'Vitamin C \u00b7 HA Moisturizer \u00b7 SPF 50',
    cta: 'Add Bundle',
  },
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Freebies', tone: 'freebies', icon: true }, { label: 'Buy 2 Get 1', tone: 'buyget' }],
    banner: { lead: 'Buy 2 products \u2192 ', bold: 'Get HA Moisturizer FREE', tone: 'buyget', icon: true },
    cta: 'Add Bundle',
  },
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'grid4', moreCount: 3 },
    badges: [{ label: 'Freebies', tone: 'freebies', icon: true }, { label: 'Build Your Own', tone: 'byo' }],
    banner: { bold: 'Flat 18% off when you pick 2+ items', tone: 'byo', icon: true },
    cta: 'Add Bundle',
  },
  {
    name: 'Daily Essentials Kit',
    mrp: '\u20b9599', price: '\u20b9449', off: '20% OFF',
    media: { type: 'single' },
    badges: [{ label: 'Build Your Own', tone: 'byo' }],
    tiers: ['3 items @ 15% off', '4 items @ 20% off', '6+ items @ 30% off'],
    cta: 'Add Bundle',
  },
];

const REVIEWS = [
  { name: 'Ananya', loc: 'Bengaluru', rating: 5.0, text: "Best subscription I've tried. Simple as that — every delivery arrives right on schedule." },
  { name: 'Kavya', loc: 'Mumbai', rating: 4.2, text: 'Great quality, wish the packaging resealed a little better after opening.' },
  { name: 'Arjun', loc: 'Delhi', rating: 4.9, text: 'Skipping a delivery before my trip took ten seconds — genuinely painless, and support followed up afterward just to check everything went through fine.' },
  { name: 'Devika', loc: 'Kolkata', rating: 4.6, text: "Consistent quality every single delivery. It's now a non-negotiable part of my week, and I've started recommending it to everyone who asks." },
  { name: 'Farhan', loc: 'Hyderabad', rating: 4.4, text: 'Switched variants mid-plan with zero hassle at all.' },
  { name: 'Vikram', loc: 'Ahmedabad', rating: 4.3, text: 'Good product, fair pricing, and the packaging keeps everything fresh for weeks.' },
];

const STICKY_TICKER = [
  <>Trusted By <span className="accent">1,000+ People</span></>,
  <>Rated <span className="accent">4.5★</span> By Customers</>,
  <>Free Shipping On <span className="accent">Every Order</span></>,
  <><span className="accent">Cancel Anytime</span>, No Questions Asked</>,
];

const MARQUEE_ITEMS = [
  'Subscribe and Save 50% More',
  'Free Shipping on All Orders',
  'Hassle Free Auto Debit',
  'Subscribe and Save 50% More',
  'Free Shipping on All Orders',
  'Hassle Free Auto Debit',
];


// ---------- Surprise Box page content (Settings → Page → Surprise Box) ----------
// Same page, same widgets and settings; only the product and its copy change.
const SURPRISE = {
  title: 'Diwali Surprise Gift Box',
  off: 'Upto 25% OFF',
  descShort: 'A festive box of hand-picked surprises, gift-wrapped and ready to give. Open it together and let the Diwali magic begin... ',
  descFull: 'A festive box of hand-picked surprises, gift-wrapped and ready to give. Open it together and let the Diwali magic begin. Every box is worth well above its price, curated for the festival and delivered gift-ready, so all that is left to do is unwrap the surprise. ',
  rating: 4.8,
  oneTime: 1999, perDelivery: 1499,
  announce: {
    normal: [<>Get <span className="accent">25% OFF</span> when you subscribe to the surprise gift box</>, <>Free shipping on <span className="accent">ALL ORDERS</span></>],
    diwali: [<><span className="accent">Diwali Special</span>: Up to 25% Off Surprise Gift Boxes</>, <>Free shipping on <span className="accent">ALL ORDERS</span></>],
  },
  boxItems: ['Hand-painted Diya Set', 'Scented Candle Trio', 'Mithai Box', 'Premium Dry Fruits', 'Rangoli Colour Kit', 'Festive Fairy Lights', 'Brass Pooja Thali', 'Decor Torans', 'Potli Gift Pouch', 'Chocolate Truffle Box'],
  miniFaq: [
    { id: 'what', q: 'What is a surprise gift box?', a: 'A festive box of hand-picked gifts whose contents stay a secret until you open it. One price, wrapped and ready to give.' },
    { id: 'inside', q: 'What could be inside?', a: 'Anything out of the items shown above: festive treats, decor pieces and small luxuries chosen for Diwali. The mix is the surprise.' },
    { id: 'subscribe', q: 'Can I get a new box every month?', a: 'Yes. Pick a subscription plan and a fresh surprise reaches you on your schedule. Or buy a single box with One Time Purchase.' },
    { id: 'arrive', q: 'When will it arrive?', a: 'Most pincodes get it in about 4 days. Add your pincode above to see the exact date before you pay.' },
  ],
  fullFaq: [
    { id: 'what', q: 'What is a Diwali surprise gift box?', lead: 'A festive box of hand-picked gifts, with the contents kept secret.', rest: 'You know the price and the value up front, the reveal is the surprise. Everything arrives gift-wrapped.' },
    { id: 'choose', q: 'Can I choose what goes inside?', lead: 'No, and that is the fun part.', rest: 'Our team curates every box from the items shown on the page, so you and the person you gift it to open it without knowing what is coming.' },
    { id: 'subscribe', q: 'Can I subscribe instead of buying once?', lead: 'Yes, pick a subscription plan.', rest: 'A fresh surprise box reaches you on your schedule. Skip, swap or cancel from your account anytime.' },
    { id: 'worth', q: 'Is it worth the price?', lead: 'Always worth more than you pay.', rest: 'What is inside adds up to well above the box price, which is why the savings are shown before you buy.' },
    { id: 'delivery', q: 'Will it reach me before Diwali?', lead: 'Most pincodes get it in about 4 days.', rest: 'Enter your pincode on the product page to see the exact delivery date, and order early to be sure it arrives in time.' },
    { id: 'gift', q: 'Can I send it straight to someone as a gift?', lead: 'Yes, ship it to any address.', rest: "Add the recipient's address and pincode at checkout and the box goes to them, gift-ready." },
    { id: 'damaged', q: 'What if my box arrives damaged?', lead: 'We will replace it, no questions asked.', rest: 'Message us within 7 days of delivery with a photo and we will arrange a replacement.' },
  ],
  marquee: ['Diwali Special: Up to 25% Off', 'Free Shipping on All Orders', 'Gift-Ready Festive Packaging', 'Worth More Than You Pay', 'Diwali Special: Up to 25% Off', 'Free Shipping on All Orders', 'Gift-Ready Festive Packaging', 'Worth More Than You Pay'],
  ticker: [
    <>Trusted By <span className="accent">10,000+ Gifters</span></>,
    <>Rated <span className="accent">4.8★</span> By Customers</>,
    <>Free Shipping On <span className="accent">Every Order</span></>,
    <><span className="accent">Cancel Anytime</span>, No Questions Asked</>,
  ],
};
const NORMAL_ANNOUNCE = [<>Get <span className="accent">30% OFF</span> when you subscribe to our exclusive collection</>, <>Free shipping on <span className="accent">ALL ORDERS</span></>];

/* "Anything out of these" — the Surprise Box container: a left-to-right marquee of what could be inside.
   On the Diwali theme it sits on the banner's night sky with lights, lanterns, fireworks and diyas. */
const SparkStar = ({ x, y, s = 14, o = 0.85 }) => <svg aria-hidden="true" width={s} height={s} viewBox="0 0 24 24" style={{ position: 'absolute', left: x, top: y, opacity: o, pointerEvents: 'none' }}><path d="M12 1.5l2.4 8.1 8.1 2.4-8.1 2.4L12 22.5l-2.4-8.1-8.1-2.4 8.1-2.4z" fill={K.gold} /></svg>;
function SurpriseCarousel({ fest, items, d }) {
  const pat = festPattern('mandala', K.cream);
  return (
    <div className="sb-any gs-root">
      <GIFT.StyleTag />
      <div className="sb-any-box" style={{ background: `${pat.url}, linear-gradient(135deg, ${K.nightDeep} 0%, ${K.night} 55%, ${K.nightSoft} 100%)`, backgroundSize: `${pat.size}px ${pat.size}px, auto` }}>
        <SparkStar x="5%" y={14} s={13} /><SparkStar x="93%" y={22} s={16} /><SparkStar x="84%" y={10} s={9} o={0.6} /><SparkStar x="13%" y={52} s={9} o={0.6} />
        <div className="sb-any-head"><b>Anything out of these</b><span>Revealed when you open it</span></div>
        <div className="mq-viewport" aria-label="Things that could be in your box">
          <div className="mq-track">
            {[false, true].map((hid) => (
              <div className="mq-group" key={String(hid)} aria-hidden={hid ? 'true' : undefined}>
                {items.map((name, k) => (<div className="mq-cell" key={name}><GIFT.ItemCard name={name} i={k} d={!!d} /></div>))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- small shared pieces ----------

function PlaceholderIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8a8a8a">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  );
}

function StarRow({ rating }) {
  const full = Math.round(rating);
  return (
    <div className="rc-stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i < full ? '#2b2b2b' : '#dedede'}>
          <path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7z" />
        </svg>
      ))}
    </div>
  );
}

function MarqueeGroup({ hidden, items = MARQUEE_ITEMS }) {
  return (
    <div className="marquee-group" aria-hidden={hidden ? 'true' : undefined}>
      {items.map((text, i) => (
        <Fragment key={i}>
          <span className="marquee-item">{text}</span>
          <span className="marquee-dot" />
        </Fragment>
      ))}
    </div>
  );
}

// ---------- StackBack subscription widget (embedded) ----------

/* ------------------------------------------------------------------ *
 * SB Subscription Widget — Add-On Bundle (3 layout variants)
 * ------------------------------------------------------------------ *
 * MERCHANT TOKENS — the only 6 colours a merchant sets.
 * Everything else (muted text, borders, hairlines, selected fills,
 * on-colours) is DERIVED from these so any brand palette holds together.
 * ------------------------------------------------------------------ */
// Merchant-facing schema (widget_settings) — the ONLY inputs to the colour system.
// Keys/defaults mirror the backend schema exactly.
const DEFAULT_WIDGET_SETTINGS = {
  Brand_Accent:            "#95e534", // checkboxes, freebie dot, announcement/offer highlight text, final price text, add-product CTA, offer pill BG
  Product_Tile:            "#041101", // product name (50% opacity) + product price (100%)
  Brand_Primary:           "#041101", // bundle plus icons, announcement bar BG, radio icons, main CTA, offer pills BG, selected payment mode, popup number boxes, One Time / Subscribe outline
  Brand_Secondary:         "#fcfbfc", // selected tabs, selected payment type card, selected rate, freebie pill, main dropdowns
  Widget_Background:       "#ffffff", // widget BG, one-time & buy-single container, popup BG
  Product_Tile_Background: "#f6f5f1", // default + selected product card BG
};
// schema -> internal engine tokens
const brandFromSettings = (ws = {}) => {
  const w = { ...DEFAULT_WIDGET_SETTINGS, ...ws };
  return {
    primary:  w.Brand_Primary,
    secondary: w.Brand_Secondary,
    accent:   w.Brand_Accent,
    tileText: w.Product_Tile,
    bg:       w.Widget_Background,
    tile:     w.Product_Tile_Background,
  };
};
const BRAND = brandFromSettings(DEFAULT_WIDGET_SETTINGS);

// Fixed neutral greys — standard, NOT tied to the merchant palette (won't change with theme)
const GREY_LIGHT = "#e8e8e8";
const GREY_DARK = "#c4c4c4";
const IMG_GREY = "#e6e6e6";
const ERROR_RED = "#e5484d";
const DROPDOWN_FIELD_GREY = "#f7f7f7"; // lighter than GREY_LIGHT — dropdown field fill only, borders/hairlines stay on GREY_LIGHT

/* ---------- colour maths (pure, SSR-safe) ---------- */
const hexToRgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (rgb) =>
  "#" + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([0, 1, 2].map((i) => A[i] * t + B[i] * (1 - t)));
};
const lum = (h) => {
  const c = hexToRgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
};
const readable = (h) => (contrast("#000000", h) >= contrast("#ffffff", h) ? "#111111" : "#ffffff");

const GREY_TEXT_ON_LIGHT = "#6b6b6b";
const GREY_TEXT_ON_DARK = "#a3a3a3";
const greyOn = (surface) =>
  contrast("#000000", surface) >= contrast("#ffffff", surface) ? GREY_TEXT_ON_LIGHT : GREY_TEXT_ON_DARK;

/* ---------- derive the full palette from the 6 tokens ---------- */
const rgba = (h, a) => { const [r, g, b] = hexToRgb(h); return `rgba(${r},${g},${b},${a})`; };
/* Diwali colour palettes — pick one in the Widget Settings panel → Colour.
   "night":  the Flash Sale banner — indigo night sky, marigold, gold, kumkum and rani pink
   "maroon": the original Diwali kit — deep maroon, gold foil and ivory
   Both drive the same artwork (stars, string lights, lanterns, fireworks, diyas, toran). */
const PALETTES = {
  night: {
    label: "Diwali night", swatch: ["#24124A", "#FFB21E", "#D42A3C"],
    K: { night: "#24124A", nightDeep: "#170B33", nightSoft: "#33205F", nightLine: "rgba(255,226,170,.16)",
      marigold: "#FFB21E", marigoldDeep: "#E8890C", gold: "#FFD66B", flame: "#FFF4C7",
      kumkum: "#D42A3C", rani: "#CC2471", lanternA: "#D42A3C", lanternB: "#CC2471", teal: "#11847E", leaf: "#2E8B57",
      paper: "#FFF1E4", cream: "#FFF3DE", creamSoft: "rgba(255,243,222,.72)", muted: "#76678A", line: "#EEDFD0", card: "#FFF8EE" },
    tints: ["#FFE2A6", "#FFD5CF", "#CDEDE8", "#E5DAFF", "#FFE9C9"],
  },
  maroon: {
    label: "Maroon & gold", swatch: ["#7a0f1c", "#f5c542", "#fff3d9"],
    K: { night: "#7a0f1c", nightDeep: "#4b0911", nightSoft: "#9b2330", nightLine: "rgba(255,236,179,.18)",
      marigold: "#f5c542", marigoldDeep: "#d9a21b", gold: "#ffd45c", flame: "#FFF4C7",
      kumkum: "#9b2330", rani: "#FF8A1C", lanternA: "#FF8A1C", lanternB: "#ffd45c", teal: "#7FE3D8", leaf: "#2E8B57",
      paper: "#fff3d9", cream: "#ffecb3", creamSoft: "rgba(255,236,179,.78)", muted: "#8a5a4e", line: "#f0dcb0", card: "#fffaf0" },
    tints: ["#ffe6a8", "#ffd9c7", "#f6e7b4", "#ffdcb8", "#fff0c9"],
  },
};
/* The two Diwali colours (dark + light) — the same two tokens, safe bracket and picker as the bundle page. They are picked by hue (rainbow band) with a
   shade slider held inside a bracket: dark can't be near-black or washed out, light can't be dark, so the text on top keeps its contrast.
   The palettes above are quick starting points: choosing one sets the two colours; the pickers then fine-tune them. */
const FEST_TONE = { festDark: { s: 78, lMin: 18, lMax: 34, sMin: 55, sMax: 90 }, festLight: { s: 100, lMin: 88, lMax: 96, sMin: 70, sMax: 100 } };
const hexToHsl = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (mx !== mn) { const dd = mx - mn; sat = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn); h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; }
  return [h, sat * 100, l * 100];
};
const hslToHex = (h, sat, l) => {
  sat /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex([f(0), f(8), f(4)].map((v) => v * 255));
};
const isHex = (h) => /^#[0-9a-fA-F]{6}$/.test(h || "");
const clampFest = (key, hex) => { const T = FEST_TONE[key], [h, sat, l] = hexToHsl(hex); return hslToHex(h, Math.max(T.sMin, Math.min(T.sMax, sat)), Math.max(T.lMin, Math.min(T.lMax, l))); };
let PALETTE = "night", K, DIWALI, NIGHT_GRAD, PAPER_DOTS, PAGE_BG_FEST, festPill, MQ_TINTS;
function applyPalette(name, dark, light) {
  const P = PALETTES[name] || PALETTES.night; PALETTE = name; K = { ...P.K }; MQ_TINTS = P.tints;
  /* the two colours override the palette's own dark + light only when they were changed (the untouched palettes look exactly as before) */
  if (isHex(dark) && isHex(light) && (dark.toLowerCase() !== P.K.night.toLowerCase() || light.toLowerCase() !== P.K.paper.toLowerCase())) {
    const dk = clampFest("festDark", dark), lt = clampFest("festLight", light);
    Object.assign(K, { night: dk, nightDeep: mix("#000000", dk, 0.38), nightSoft: mix("#ffffff", dk, 0.1), nightLine: rgba(lt, 0.16), paper: lt, cream: lt, creamSoft: rgba(lt, 0.72), card: mix(lt, "#ffffff", 0.5), muted: mix(dk, "#ffffff", 0.75), line: mix("#000000", lt, 0.07) });
  }
  DIWALI = { dark: K.night, light: K.paper, redDeep: K.nightDeep, red: K.night, redBright: K.nightSoft, gold: K.marigold, goldDeep: K.marigoldDeep, goldBright: K.gold, goldPale: K.cream,
    foil: [mix(K.gold, "#ffffff", 0.5), K.marigold, K.gold], ivory: K.card, beige: mix(K.marigold, K.card, 0.16), beigeDeep: mix(K.marigoldDeep, K.card, 0.26), goldEdge: rgba(K.marigoldDeep, 0.6), goldSoft: rgba(K.marigold, 0.42) };
  NIGHT_GRAD = `linear-gradient(180deg, ${K.night}, ${K.nightSoft})`;
  PAPER_DOTS = `radial-gradient(${rgba(K.marigoldDeep, 0.14)} 1px, transparent 1.6px)`;
  PAGE_BG_FEST = K.paper;
  festPill = { position: "relative", overflow: "hidden", background: `linear-gradient(110deg, ${DIWALI.goldPale}, ${DIWALI.gold})`, color: DIWALI.redDeep, boxShadow: `inset 0 0 0 1px ${DIWALI.goldEdge}` };
}
applyPalette("night");

/* =====================================================================
   Diwali night artwork — the Flash Sale banner's pieces: twinkling stars, a string of lights,
   akash kandil lanterns, fireworks, clay diyas and a marigold toran. All drawn in code.
   ===================================================================== */
const starPts = (n, R1, r1, cx = 0, cy = 0) => Array.from({ length: n * 2 }, (_, k) => {
  const a = (Math.PI * k) / n - Math.PI / 2, rr = k % 2 ? r1 : R1; return `${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`;
}).join(" ");
const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
function useBoxSize(ref) {
  const [sz, setSz] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setSz((o) => (o.w === el.offsetWidth && o.h === el.offsetHeight ? o : { w: el.offsetWidth, h: el.offsetHeight })); f();
    let ro; if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(f); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, []);
  return sz;
}
function Diya({ x = 0, y = 0, s = 1, delay = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-9" r="16" fill={K.marigold} opacity=".16" />
      <circle cx="0" cy="-9" r="9" fill={K.gold} opacity=".24" />
      <g className="dw-flame" style={{ animationDelay: `${delay}s` }}>
        <path d="M0 -20 C6 -12 5 -5 0 -3 C-5 -5 -6 -12 0 -20 Z" fill={K.marigold} />
        <path d="M0 -13 C3 -9 2.6 -5.5 0 -4.5 C-2.6 -5.5 -3 -9 0 -13 Z" fill={K.flame} />
      </g>
      <path d="M-13 -3 H13 Q11.5 7.5 0 8.5 Q-11.5 7.5 -13 -3 Z" fill={K.kumkum} stroke={K.marigold} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M-8.5 1.5 Q0 4.5 8.5 1.5" stroke={K.gold} strokeWidth="1.3" fill="none" strokeDasharray="0.1 2.6" strokeLinecap="round" />
    </g>
  );
}
/* an akash kandil — the star lantern hung outside homes */
function Lantern({ x, y, len, color, s = 1, delay = 0, string = "rgba(255,230,190,.5)" }) {
  return (
    <g className="dw-sway" style={{ transformBox: "view-box", transformOrigin: `${x}px ${y}px`, animationDelay: `${delay}s` }}>
      <line x1={x} y1={y} x2={x} y2={y + len} stroke={string} strokeWidth=".9" />
      <g transform={`translate(${x} ${y + len + 14 * s}) scale(${s})`}>
        <circle r="22" fill={color} opacity=".16" />
        <polygon points={starPts(8, 14, 8.5)} fill={color} />
        <polygon points={starPts(8, 9, 5.5)} fill={K.gold} opacity=".9" />
        <circle r="3.2" fill={K.flame} />
        {[-6, 0, 6].map((tx) => <line key={tx} x1={tx} y1={tx ? 11 : 14} x2={tx} y2={tx ? 22 : 26} stroke={K.gold} strokeWidth="1.1" strokeLinecap="round" />)}
      </g>
    </g>
  );
}
function Firework({ x, y, r, color, delay = 0, rays = 14 }) {
  return (
    <g className="dw-fw" style={{ animationDelay: `${delay}s` }}>
      {Array.from({ length: rays }, (_, k) => {
        const a = (Math.PI * 2 * k) / rays, c = Math.cos(a), s = Math.sin(a);
        return (
          <g key={k}>
            <line x1={x + c * r * 0.32} y1={y + s * r * 0.32} x2={x + c * r} y2={y + s * r} stroke={color} strokeWidth="1.3" strokeLinecap="round" />
            <circle cx={x + c * r * 1.16} cy={y + s * r * 1.16} r="1.3" fill={K.flame} />
          </g>
        );
      })}
    </g>
  );
}
/* the banner's night sky at any size. lanterns: [[t along the string, drop, colour, scale], ...] */
function NightSky({ w, h, seed = 7, lights = true, lanterns = [], fireworks = [], diyas = 0, diyaS = 0.62, starDensity = 1300 }) {
  if (!w || !h) return null;
  if (diyas === 'auto') diyas = Math.max(5, Math.round(w / 88));
  const rnd = seeded(seed + Math.round(w));
  const stars = Array.from({ length: Math.round((w * h) / starDensity) }, () => ({ x: rnd() * w, y: rnd() * h * 0.85, r: 0.5 + rnd() * 1.1, d: rnd() * 3 }));
  const top = 4, sag = Math.min(26, h * 0.12);
  const B = (t) => ({ x: 2 * (1 - t) * t * (w / 2) + t * t * w, y: (1 - t) * (1 - t) * top + 2 * (1 - t) * t * (top + sag * 2) + t * t * top });
  const N = Math.max(6, Math.round(w / 22));
  const bulbs = Array.from({ length: N - 1 }, (_, k) => B((k + 1) / N));
  const bulbC = [K.marigold, K.rani, "#7FE3D8", K.gold];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, display: "block", pointerEvents: "none" }}>
      {stars.map((s, k) => <circle key={k} className="dw-twinkle" style={{ animationDelay: `${s.d}s` }} cx={s.x} cy={s.y} r={s.r} fill={K.cream} />)}
      {fireworks.map(([fx, fy, fr, col, dl, rays], k) => <Firework key={"f" + k} x={w * fx} y={h * fy} r={fr} color={col} delay={dl} rays={rays} />)}
      {lights && <path d={`M0 ${top} Q${w / 2} ${top + sag * 2} ${w} ${top}`} stroke="rgba(255,230,190,.38)" strokeWidth="1" fill="none" />}
      {lights && bulbs.map((b, k) => (
        <g key={"b" + k}>
          <circle cx={b.x} cy={b.y + 3} r="5" fill={bulbC[k % 4]} opacity=".2" />
          <circle cx={b.x} cy={b.y + 3} r="2.3" fill={bulbC[k % 4]} className="dw-bulb" style={{ animationDelay: `${(k % 4) * 0.4}s` }} />
        </g>
      ))}
      {lanterns.map(([t, len, col, sc], k) => { const p = B(t); return <Lantern key={"l" + k} x={p.x} y={p.y} len={len} color={col} s={sc} delay={k * 0.8} />; })}
      {diyas > 0 && <rect x="0" y={h - 8} width={w} height="8" fill="rgba(0,0,0,.22)" />}
      {Array.from({ length: diyas }, (_, k) => <Diya key={"d" + k} x={(w / diyas) * (k + 0.5)} y={h - 10} s={diyaS} delay={k * 0.37} />)}
    </svg>
  );
}
/* a box on the night sky: measures itself and lays the sky behind its children */
function NightPanel({ className, style, sky, children, ...rest }) {
  const ref = useRef(null), { w, h } = useBoxSize(ref);
  return (
    <div ref={ref} className={className} style={{ position: "relative", overflow: "hidden", ...style }} {...rest}>
      <NightSky w={w} h={h} {...sky} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
/* a marigold toran — the garland strung across a doorway */
function Toran({ top = K.night, bottom = K.paper }) {
  const ref = useRef(null), { w } = useBoxSize(ref);
  const sp = 28, n = Math.ceil(w / sp) + 1, y = 7;
  return (
    <div ref={ref} aria-hidden="true" style={{ height: 26, background: `linear-gradient(${top} 0 ${y + 2}px, ${bottom} ${y + 2}px)`, overflow: "hidden" }}>
      {w > 0 && (
        <svg width={w} height="26" viewBox={`0 0 ${w} 26`} style={{ display: "block" }}>
          {Array.from({ length: n }, (_, k) => (
            <g key={k}>
              <path d={`M${k * sp} ${y} Q${k * sp + sp / 2} ${y + 13} ${(k + 1) * sp} ${y}`} stroke={K.marigoldDeep} strokeWidth="1" fill="none" />
              {[0.25, 0.5, 0.75].map((t) => { const px = k * sp + t * sp, py = y + 2 * (1 - t) * t * 13; return <circle key={t} cx={px} cy={py} r="2.6" fill={t === 0.5 ? "#FF8A1C" : K.marigold} />; })}
              <ellipse cx={k * sp + sp / 2} cy={y + 13} rx="2.2" ry="4" fill={K.leaf} />
              <circle cx={k * sp} cy={y} r="5.2" fill={k % 2 ? K.marigold : "#FF8A1C"} />
              <circle cx={k * sp} cy={y} r="2" fill={K.marigoldDeep} />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
/* a lantern hanging into the page's side gutter */
function GutterLantern({ side, top, len, color, s = 1, delay = 0 }) {
  const W = 60, H = len + 70 * s;
  return (
    <svg aria-hidden="true" width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top, [side]: 18, pointerEvents: "none", zIndex: 2, overflow: "visible" }}>
      <Lantern x={W / 2} y={0} len={len} color={color} s={s} delay={delay} string={K.marigoldDeep} />
    </svg>
  );
}

/* the Diwali layer for this page — sits on top of the page CSS, only when the Diwali theme is on */
const diwaliCss = () => `
  .dw-flame{ transform-box:fill-box; transform-origin:50% 100%; animation:dwFlick 1.7s ease-in-out infinite; }
  @keyframes dwFlick{ 0%,100%{ transform:scale(1,1) skewX(0); } 30%{ transform:scale(.94,1.06) skewX(3deg); } 60%{ transform:scale(1.04,.9) skewX(-2deg); } }
  .dw-twinkle{ animation:dwTw 3.2s ease-in-out infinite; }
  @keyframes dwTw{ 0%,100%{ opacity:.25; } 50%{ opacity:1; } }
  .dw-bulb{ animation:dwBulb 2.4s ease-in-out infinite; }
  @keyframes dwBulb{ 0%,100%{ opacity:1; } 50%{ opacity:.45; } }
  .dw-fw{ transform-box:fill-box; transform-origin:center; opacity:0; animation:dwFw 3.4s cubic-bezier(.22,1,.36,1) infinite; }
  @keyframes dwFw{ 0%{ opacity:0; transform:scale(.25); } 12%{ opacity:1; } 55%{ opacity:.85; transform:scale(1); } 80%,100%{ opacity:0; transform:scale(1.08); } }
  .dw-sway{ animation:dwSway 4.6s ease-in-out infinite; }
  @keyframes dwSway{ 0%,100%{ transform:rotate(-3deg); } 50%{ transform:rotate(3deg); } }
  .dw-gutter{ display:none; }
  @container sbpage (min-width:1420px){ .dw-gutter{ display:block; } }
  .dw-serif{ font-family:'Rozha One', Georgia, serif; font-weight:400; letter-spacing:0; }

  /* page: warm paper with the banner's marigold dot texture */
  .app-shell.is-diwali{ background-color:${K.paper}; background-image:${PAPER_DOTS}; background-size:18px 18px; }
  .app-shell.is-diwali h1, .app-shell.is-diwali h2, .app-shell.is-diwali h3, .app-shell.is-diwali .process-heading{ color:${K.night}; }
  .app-shell.is-diwali .product-desc-toggle{ color:${K.kumkum}; }
  .app-shell.is-diwali .img-placeholder{ background:linear-gradient(160deg, ${K.card}, ${MQ_TINTS[4]}); border:1px solid ${K.line}; color:${K.muted}; }
  .app-shell.is-diwali .gallery-main{ box-shadow:0 18px 34px -26px ${rgba(K.night, 0.5)}; }
  .app-shell.is-diwali .offer-tab-inline{ background:linear-gradient(110deg, ${K.nightDeep}, ${K.night} 55%, ${K.nightSoft}); color:${K.cream}; box-shadow:inset 0 0 0 1px ${K.marigold}; text-transform:none; letter-spacing:0; }
  .app-shell.is-diwali .price-saved{ background:linear-gradient(110deg, ${K.cream}, ${K.marigold}); box-shadow:inset 0 0 0 1px ${rgba(K.marigoldDeep, 0.6)}; }
  .app-shell.is-diwali .price-saved-amt{ color:${K.nightDeep}; }
  .app-shell.is-diwali .price-perdel{ color:${K.night}; }
  .app-shell.is-diwali .rating-pill{ background:${K.card}; border-color:${K.line}; }
  .app-shell.is-diwali .rating-pill svg{ fill:${K.marigoldDeep}; }
  .app-shell.is-diwali .variant-pill{ background:${K.card}; border-color:${K.line}; }
  .app-shell.is-diwali .variant-pill.selected{ background:${K.night}; border-color:${K.night}; color:${K.cream}; }
  .app-shell.is-diwali .qty-stepper, .app-shell.is-diwali .stepper-btn{ background:${K.card}; border-color:${K.line}; }
  .app-shell.is-diwali .est-value{ color:${K.kumkum}; }
  .app-shell.is-diwali .price-summary .ps-accent{ color:${K.kumkum}; }
  .app-shell.is-diwali .trust-card:first-child{ background:${K.card}; border-color:${rgba(K.marigold, 0.7)}; }
  .app-shell.is-diwali .trust-card:nth-child(2), .app-shell.is-diwali .trust-card:nth-child(3){ background:${K.card}; border-color:${K.line}; }
  .app-shell.is-diwali .trust-icon{ border-color:${K.marigold}; }
  .app-shell.is-diwali .trust-icon svg{ stroke:${K.kumkum}; }
  .app-shell.is-diwali .faq-item-v2, .app-shell.is-diwali .faq-item-v2.mini{ border-color:${K.line}; }
  .app-shell.is-diwali .faq-toggle-icon{ color:${K.kumkum}; }
  .app-shell.is-diwali .faq-heading h2{ font-family:'Rozha One', Georgia, serif; font-weight:400; letter-spacing:0; }
  .app-shell.is-diwali .wp-freebie-free{ color:${K.kumkum}; }

  /* header on the night sky */
  .app-shell.is-diwali .announcement{ background:${K.nightDeep}; color:${K.creamSoft}; }
  .app-shell.is-diwali .announcement .accent{ color:${K.gold}; }
  .app-shell.is-diwali header.site-header{ border-bottom:none; }
  .app-shell.is-diwali .shop-cta{ background:transparent; color:${K.cream}; border-color:${rgba(K.gold, 0.5)}; }
  .app-shell.is-diwali .shop-cta:hover{ background:${K.nightLine}; border-color:${K.gold}; }
  .app-shell.is-diwali .logo-wordmark{ font-family:'Rozha One', Georgia, serif; font-weight:400; color:${K.gold}; font-size:27px; }
  .app-shell.is-diwali .header-link{ color:${K.cream}; }
  .app-shell.is-diwali .header-link svg, .app-shell.is-diwali .menu-btn svg{ stroke:${K.cream}; }
  .app-shell.is-diwali .cart-badge{ background:${K.marigold}; color:${K.nightDeep}; }

  /* pay your way */
  .app-shell.is-diwali .process-circle{ border-color:${K.marigold}; background:${K.card}; color:${K.night}; }
  .app-shell.is-diwali .process-title{ color:${K.kumkum}; }
  .app-shell.is-diwali .process-connector path{ stroke:${K.marigoldDeep}; }

  /* reels on the night sky */
  .app-shell.is-diwali .reels-marquee-section{ background:${NIGHT_GRAD}; padding:0; }
  .app-shell.is-diwali .dw-reels-inner{ padding-top:84px; padding-bottom:64px; }
  .app-shell.is-diwali .reel-grid{ margin-bottom:0; }
  .app-shell.is-diwali .reel-item{ background:linear-gradient(180deg, ${K.nightSoft}, ${K.nightDeep}); border:1.5px solid ${rgba(K.marigold, 0.45)}; }
  .app-shell.is-diwali .reel-item svg{ stroke:${K.gold}; }
  .dw-sky-head{ text-align:center; margin-bottom:26px; }
  .dw-sky-head b{ display:block; font-family:'Rozha One', Georgia, serif; font-weight:400; font-size:32px; color:${K.gold}; line-height:1.15; }
  .dw-sky-head span{ font-size:15px; color:${K.creamSoft}; display:inline-flex; align-items:center; gap:8px; margin-top:4px; }
  .dw-sky-head span::before, .dw-sky-head span::after{ content:""; width:20px; height:1.5px; background:${K.marigold}; opacity:.7; }

  /* THE PRODUCT CAROUSEL — "Complete your routine" on the banner's night sky */
  .app-shell.is-diwali .dw-upsell{ background:${NIGHT_GRAD}; padding:0; }
  .app-shell.is-diwali .dw-upsell-inner{ padding:86px 0 70px; }
  .app-shell.is-diwali .dw-upsell .section-head h2{ font-family:'Rozha One', Georgia, serif; font-weight:400; letter-spacing:0; color:${K.gold}; }
  .app-shell.is-diwali .dw-upsell .section-head p{ color:${K.creamSoft}; }
  .app-shell.is-diwali .dw-upsell .upsell-tabs{ border-color:${rgba(K.gold, 0.4)}; background:${rgba(K.nightDeep, 0.5)}; }
  .app-shell.is-diwali .dw-upsell .upsell-tab{ color:${K.creamSoft}; }
  .app-shell.is-diwali .dw-upsell .upsell-tab.active{ background:${K.marigold}; color:${K.nightDeep}; }
  .app-shell.is-diwali .dw-upsell .upsell-scroll{ padding-top:12px; padding-bottom:14px; }
  .app-shell.is-diwali .dw-upsell .upsell-card{ position:relative; overflow:visible; background:${K.card}; border:1.5px solid ${rgba(K.marigold, 0.7)}; border-radius:14px; box-shadow:0 0 0 3px ${rgba(K.marigold, 0.12)}, 0 14px 26px -16px rgba(0,0,0,.65); margin-top:8px; }
  .app-shell.is-diwali .dw-upsell .upsell-card::before{ content:""; position:absolute; top:-8px; left:50%; width:13px; height:13px; margin-left:-6.5px; border-radius:50%; background:${K.marigold}; box-shadow:0 0 0 2.5px #FF8A1C, 0 0 12px ${rgba(K.gold, 0.9)}; z-index:3; }
  .app-shell.is-diwali .dw-upsell .upsell-card:nth-child(5n+1) .img-placeholder{ background:${MQ_TINTS[0]}; }
  .app-shell.is-diwali .dw-upsell .upsell-card:nth-child(5n+2) .img-placeholder{ background:${MQ_TINTS[1]}; }
  .app-shell.is-diwali .dw-upsell .upsell-card:nth-child(5n+3) .img-placeholder{ background:${MQ_TINTS[2]}; }
  .app-shell.is-diwali .dw-upsell .upsell-card:nth-child(5n+4) .img-placeholder{ background:${MQ_TINTS[3]}; }
  .app-shell.is-diwali .dw-upsell .upsell-card:nth-child(5n+5) .img-placeholder{ background:${MQ_TINTS[4]}; }
  .app-shell.is-diwali .dw-upsell .img-placeholder{ border:none; }
  .app-shell.is-diwali .dw-upsell .img-placeholder svg{ opacity:.35; }
  .app-shell.is-diwali .dw-upsell .r-name{ color:${K.night}; }
  .app-shell.is-diwali .dw-upsell .r-price{ color:${K.night}; font-weight:700; }
  .app-shell.is-diwali .dw-upsell .r-off{ background:linear-gradient(110deg, ${K.cream}, ${K.marigold}); color:${K.nightDeep}; }
  .app-shell.is-diwali .dw-upsell .r-cta{ background:${K.night}; color:${K.gold}; }
  .app-shell.is-diwali .dw-upsell .upsell-banner-buyget, .app-shell.is-diwali .dw-upsell .upsell-badge-buyget{ background:${K.marigold}; border-color:${K.marigold}; color:${K.nightDeep}; }

  /* the Surprise Box container on the night sky */
  .app-shell.is-diwali .bundle-box{ background:${NIGHT_GRAD}; border:1.5px solid ${rgba(K.marigold, 0.55)}; box-shadow:0 22px 40px -26px ${rgba(K.nightDeep, 0.7)}, inset 0 0 0 1px ${K.nightLine}; padding:58px 0 40px; }
  .app-shell.is-diwali .bundle-head{ padding:0 22px 16px; flex-direction:column; align-items:center; gap:4px; text-align:center; }
  .app-shell.is-diwali .bundle-head b{ font-family:'Rozha One', Georgia, serif; font-weight:400; font-size:28px; letter-spacing:0; color:${K.gold}; line-height:1.1; }
  .app-shell.is-diwali .bundle-head span{ color:${K.creamSoft}; display:inline-flex; align-items:center; gap:6px; }
  .app-shell.is-diwali .bundle-head span::before, .app-shell.is-diwali .bundle-head span::after{ content:""; width:18px; height:1.5px; background:${K.marigold}; opacity:.7; }
  .app-shell.is-diwali .mq-viewport{ border-radius:0; padding:8px 0 10px; }
  .app-shell.is-diwali .mq-card{ background:${K.card}; border:1.5px solid ${rgba(K.marigold, 0.7)}; box-shadow:0 0 0 3px ${rgba(K.marigold, 0.12)}, 0 10px 20px -12px rgba(0,0,0,.6); position:relative; }
  .app-shell.is-diwali .mq-card::before{ content:""; position:absolute; top:-7px; left:50%; width:12px; height:12px; margin-left:-6px; border-radius:50%; background:${K.marigold}; box-shadow:0 0 0 2.5px #FF8A1C, 0 0 10px ${rgba(K.gold, 0.9)}; }
  .app-shell.is-diwali .mq-group .mq-card:nth-child(5n+1) .mq-img{ background:${MQ_TINTS[0]}; }
  .app-shell.is-diwali .mq-group .mq-card:nth-child(5n+2) .mq-img{ background:${MQ_TINTS[1]}; }
  .app-shell.is-diwali .mq-group .mq-card:nth-child(5n+3) .mq-img{ background:${MQ_TINTS[2]}; }
  .app-shell.is-diwali .mq-group .mq-card:nth-child(5n+4) .mq-img{ background:${MQ_TINTS[3]}; }
  .app-shell.is-diwali .mq-group .mq-card:nth-child(5n+5) .mq-img{ background:${MQ_TINTS[4]}; }
  .app-shell.is-diwali .mq-name{ color:${K.night}; }
  @container sbpage (max-width:768px){
    .app-shell.is-diwali .bundle-box{ padding:50px 0 32px; }
    .app-shell.is-diwali .bundle-head{ padding:0 14px 12px; }
    .app-shell.is-diwali .bundle-head b{ font-size:21px; }
  }

  /* marquee, banners, reviews */
  .app-shell.is-diwali .marquee-item{ color:${K.night}; }
  .app-shell.is-diwali .marquee-dot{ width:10px; height:10px; background:${K.marigold}; box-shadow:0 0 0 2.5px #FF8A1C; }
  .app-shell.is-diwali .banner-slide:nth-child(1) .banner-img{ background:linear-gradient(120deg, ${MQ_TINTS[0]}, ${K.card}); }
  .app-shell.is-diwali .banner-slide:nth-child(2) .banner-img{ background:linear-gradient(120deg, ${MQ_TINTS[1]}, ${K.card}); }
  .app-shell.is-diwali .banner-slide:nth-child(3) .banner-img{ background:linear-gradient(120deg, ${MQ_TINTS[3]}, ${K.card}); }
  .app-shell.is-diwali .dots .dot.active{ background:${K.night}; }
  .app-shell.is-diwali .review-card-v2{ background:${K.card}; border-color:${K.line}; }
  .app-shell.is-diwali .rc-quote{ color:${K.marigoldDeep}; }

  /* footer + sticky bar */
  .app-shell.is-diwali footer.site-footer{ background:${K.nightDeep}; }
  .app-shell.is-diwali .powered-label{ color:${K.creamSoft}; }
  .app-shell.is-diwali .sticky-ticker{ background:${K.nightDeep}; color:${K.cream}; }
  .app-shell.is-diwali .sticky-ticker .accent{ color:${K.gold}; }
  .app-shell.is-diwali .sticky-bar, .app-shell.is-diwali .sticky-summary{ background:${K.card}; border-color:${K.marigold}; }
  .app-shell.is-diwali .sticky-img{ background:${MQ_TINTS[0]}; }
  .app-shell.is-diwali .sticky-name{ color:${K.night}; }
  .app-shell.is-diwali .sticky-cta{ background:${K.night}; }
  .app-shell.is-diwali .sticky-cta .cta-price{ color:${K.gold}; }
  .app-shell.is-diwali .ss-value.accent{ color:${K.kumkum}; }
  @media (prefers-reduced-motion: reduce){ .dw-flame, .dw-twinkle, .dw-bulb, .dw-sway{ animation:none !important; } .dw-fw{ animation:none !important; opacity:.7; } }
`;
/* wraps children in the night sky only when the Diwali theme is on */
function DwSky({ on, sky, children }) {
  if (!on) return <>{children}</>;
  return <NightPanel sky={sky}><div className="dw-upsell-inner">{children}</div></NightPanel>;
}
/* the widget's six schema colours, set from the Diwali palette */
const diwaliBrand = () => ({ primary: K.night, secondary: K.card, accent: K.kumkum, tileText: K.night, bg: "#ffffff", tile: K.card });


function buildTokens(brand) {
  const { primary, secondary, accent, tileText, bg, tile } = brand;
  const onPrimary = readable(primary);
  const onSecondary = readable(secondary);
  return {
    primary, secondary, accent, tileText, bg, tile,
    inkOnBg: readable(bg),
    inkOnTile: readable(tile),
    onPrimary, onSecondary,
    onAccent: readable(accent),
    subOnPrimary: mix(onPrimary, primary, 0.62),
    selBg: secondary,
    selBorder: secondary,
  };
}

const makeC = (t) => ({
  inkOnBg: t.inkOnBg,
  inkOnTile: t.inkOnTile,
  inkOnSelBg: readable(t.selBg),
  nameOnTile: mix(t.tileText, t.tile, 0.5),
  priceOnTile: t.tileText,
  dropdownText: greyOn(mix(t.bg, t.tile, 0.5)),
  mutedOnTile: greyOn(t.tile),
  accentSafe: contrast(t.accent, t.tile) >= 2.2 ? t.accent : readable(t.tile),
  accentOnSel: contrast(t.accent, t.selBg) >= 2.2 ? t.accent : readable(t.selBg),
  primary: t.primary,
  white: t.tile,
  bg: t.bg,
  onBar: t.onPrimary,
  subOnBar: t.subOnPrimary,
  onSel: readable(t.accent),
  onAccent: t.onAccent,
  muted: mix(t.onPrimary, t.primary, 0.4),
  border: GREY_DARK,
  borderLite: GREY_LIGHT,
  fill: IMG_GREY,
  grayBg: DROPDOWN_FIELD_GREY,
  red: t.secondary,
  accent: t.accent,
  onBarAccent: contrast(t.accent, t.primary) >= 2.5 ? t.accent : t.onPrimary,
  yellowBg: t.selBg,
  yellowBd: mix(t.secondary, t.bg, 0.55),
  canvas: mix(t.inkOnBg, t.bg, 0.16),
  divider: GREY_DARK,
});
const AOBThemeCtx = createContext(makeC(buildTokens(BRAND)));
const useC = () => useContext(AOBThemeCtx);

const AOBShapeCtx = createContext({
  sh: { card: 8, img: 6, pill: 999 },
  shadowMode: false,
  noneMode: false,
  S: { pop: "none", sel: "none", unsel: "none" },
});
const useShape = () => useContext(AOBShapeCtx);
function buildShapeCtx(shape, surface) {
  const sh = shape || { card: 8, img: 6, pill: 999 };
  const shadowMode = surface === "shadow";
  const noneMode = surface === "none";
  const S = {
    pop: shadowMode ? "0 1px 0 rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.09)" : "none",
    sel: shadowMode ? "0 1px 0 rgba(0,0,0,0.09), 0 3px 8px rgba(0,0,0,0.08)" : "none",
    unsel: shadowMode ? "0 1px 0 rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.05)" : "none",
  };
  return { sh, shadowMode, noneMode, S };
}

function AOBStyles() {
  useEffect(() => {
    const id = "addon-font-link";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id; link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }, []);
  return <style>{`
        .sb-anim {
          transition:
            background-color .28s cubic-bezier(.4,0,.2,1),
            border-color .28s cubic-bezier(.4,0,.2,1),
            box-shadow .28s cubic-bezier(.4,0,.2,1),
            color .24s ease, opacity .24s ease,
            transform .24s cubic-bezier(.4,0,.2,1);
        }
        @keyframes sbMenu { from { opacity:0; transform: translateY(-4px) } to { opacity:1; transform: translateY(0) } }
        .sb-menu { animation: sbMenu .16s ease both; transform-origin: top center; }

        /* popup (e.g. Pricing Summary) — smooth ease-in-out open + close */
        @keyframes sbBackdropIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sbBackdropOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes sbPopIn  { from { opacity: 0; transform: translateY(8px) scale(.96) } to { opacity: 1; transform: none } }
        @keyframes sbPopOut { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(8px) scale(.96) } }
        .sb-backdrop { animation: sbBackdropIn .22s cubic-bezier(.4,0,.2,1) both; }
        .sb-backdrop.closing { animation: sbBackdropOut .22s cubic-bezier(.4,0,.2,1) both; }
        .sb-pop { animation: sbPopIn .26s cubic-bezier(.4,0,.2,1) both; transform-origin: center; will-change: opacity; }
        .sb-pop.closing { animation: sbPopOut .22s cubic-bezier(.4,0,.2,1) both; }
        .sb-scroll::-webkit-scrollbar { height: 0; width: 0; display: none; }
        .sb-scroll { scrollbar-width: none; -ms-overflow-style: none; }

        @keyframes cardRefresh { from { opacity: 0.25; transform: scale(.97); } to { opacity: 1; transform: none; } }
        .card-refresh { animation: cardRefresh .32s ease-out; }

        .sb-shimmer { position: relative; overflow: hidden; }
        .sb-shimmer::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          transform: translateX(-100%);
          animation: sbShimmer 3.4s ease-in-out infinite;
          background: linear-gradient(105deg,
            transparent 30%,
            rgba(255,255,255,.10) 44%,
            rgba(255,255,255,.26) 50%,
            rgba(255,255,255,.10) 56%,
            transparent 70%);
        }
        @keyframes sbShimmer {
          0%        { transform: translateX(-100%); }
          55%, 100% { transform: translateX(100%); }
        }

        .sb-shimmer-warm::after {
          background: linear-gradient(105deg,
            transparent 30%,
            rgba(255,255,255,.14) 44%,
            rgba(255,248,235,.34) 50%,
            rgba(255,255,255,.14) 56%,
            transparent 70%);
        }

        @keyframes sbPulseText {
          0%, 100% { transform: scale(1);    opacity: 1;   }
          50%      { transform: scale(1.06); opacity: .86; }
        }
        .sb-pulse-text {
          display: inline-block;
          transform-origin: center;
          animation: sbPulseText 2.1s cubic-bezier(.4,0,.6,1) infinite;
          will-change: transform;
        }

        @media (prefers-reduced-motion: reduce) {
          .sb-anim, .sb-menu, .sb-pop, .sb-backdrop, .card-refresh { transition: none !important; animation: none !important; }
          .sb-shimmer::after { animation: none !important; opacity: 0; }
          .sb-pulse-text { animation: none !important; }
        }
      `}</style>;
}

const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const inr = (n) => "₹" + n.toLocaleString("en-IN");

// Map a frequency label to the number of days until next delivery, and format the date.
const FREQ_DAYS = {
  "Every Week": 7,
  "Every 2 Weeks": 14,
  "Every 4 Days": 4,
  "Every Month": 30,
  "Every 4 Weeks": 28,
  "Every 2 Months": 60,
};
function nextDeliveryDate(frequencyLabel) {
  const days = FREQ_DAYS[frequencyLabel] ?? 28;
  const d = new Date(2026, 8, 11); // base: 11 Sep 2026
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const Chevron = ({ open, size = 12 }) => { const C = useC(); return (
  <span style={{
    display: "inline-flex", flexShrink: 0,
    transition: "transform .25s cubic-bezier(.4,0,.2,1)",
    transform: open ? "rotate(180deg)" : "rotate(0deg)",
  }}>
    <ChevronDown size={size} strokeWidth={2} color={C.dropdownText} />
  </span>
); };

const Dropdown = ({ value, options, onChange, boxStyle, textStyle }) => {
  const C = useC();
  const { sh } = useShape();
  const [open, setOpen] = useState(false);

  const handleOpen = (e) => {
    e.stopPropagation();
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <div style={{ position: "relative", flex: "1 0 0", minWidth: 0 }}>
      <div onClick={handleOpen} className="sb-anim" style={{
        background: C.grayBg, borderRadius: Math.max(2, sh.card - 4), height: 28,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "4px 9px", cursor: "pointer", boxSizing: "border-box", overflow: "hidden",
        ...boxStyle,
      }}>
        <span style={{
          fontSize: 14, fontWeight: 500, color: C.dropdownText,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...textStyle,
        }}>{value}</span>
        <Chevron open={open} size={12} />
      </div>

      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            style={{ position: "fixed", inset: 0, zIndex: 9998 }} />
          <div className="sb-menu" style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, minWidth: 96, zIndex: 9999,
            background: C.white, border: `0.5px solid ${C.border}`, borderRadius: sh.card,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            maxHeight: 180, overflowY: "auto", padding: 4, boxSizing: "border-box",
          }}>
            {options.map((o) => {
              const on = o === value;
              return (
                <div key={o} className="sb-anim"
                  onClick={(e) => { e.stopPropagation(); onChange(o); setOpen(false); }}
                  style={{
                    fontSize: 14, fontWeight: on ? 600 : 500, color: on ? C.inkOnSelBg : C.dropdownText,
                    padding: "7px 9px", borderRadius: Math.max(2, sh.card - 2), cursor: "pointer",
                    background: on ? C.yellowBg : "transparent", whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = C.grayBg; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
                >{o}</div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const Radio = ({ checked, size = 18 }) => { const C = useC(); return (
  <span className="sb-anim" style={{
    width: size, height: size, borderRadius: "50%",
    border: `2px solid ${checked ? C.primary : GREY_DARK}`, background: C.bg,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    boxSizing: "border-box", flexShrink: 0,
  }}>
    <span style={{
      width: size * 0.5, height: size * 0.5, borderRadius: "50%", background: C.primary,
      transform: checked ? "scale(1)" : "scale(0)",
      transition: "transform .2s cubic-bezier(.34,1.4,.64,1)",
    }} />
  </span>
); };

const Backdrop = ({ onClose, children, maxWidth = 390 }) => {
  const [closing, setClosing] = useState(false);
  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 220); // matches the exit animation duration
  };
  return (
    <div onClick={requestClose} className={`sb-backdrop${closing ? " closing" : ""}`} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9990, padding: 16, overflowY: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} className={`sb-pop${closing ? " closing" : ""}`} style={{ width: "100%", maxWidth, overflow: "visible", margin: "auto" }}>
        {typeof children === "function" ? children(requestClose) : children}
      </div>
    </div>
  );
};

const BUTTON_RESET = {
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  margin: 0,
  outline: "none",
  fontFamily: "inherit",
  textAlign: "left",
};

const PAY_MODES = [
  { id: "upfront",     label: "Pay Upfront",      note: "One payment today — all deliveries covered" },
  { id: "perDelivery", label: "Pay Per Delivery", note: "Charged before every delivery." },
  { id: "payg",        label: "Pay As You Go",    note: "Payment link before every delivery" },
];

const PayToggle = ({ mode, onChange, hideUpfront = false }) => {
  const C = useC();
  const modes = hideUpfront ? PAY_MODES.filter((o) => o.id !== "upfront") : PAY_MODES;
  const active = modes.find((o) => o.id === mode) || modes[0];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
      <div className="wp-pay-toggle">
        {modes.map((o, i) => (
          <Fragment key={o.id}>
            {i > 0 && <span className="wp-pay-toggle-divider" aria-hidden="true" />}
            <button
              type="button"
              onClick={() => onChange(o.id)}
              className={`wp-pay-toggle-btn${mode === o.id ? ' active' : ''}`}
            >
              {o.label}
            </button>
          </Fragment>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%" }}>
        <InfoIcon size={14} color={C.mutedOnTile} />
        <span style={{ fontSize: 14, fontWeight: 600, color: C.inkOnTile, textAlign: "center" }}>{active.note}</span>
      </div>
    </div>
  );
};

const WidgetSubscribeCTA = ({ price, suffix, saved, perDelivery, label = "Subscribe Now", blocked = false, onBlocked, style }) => (
  <button
    type="button"
    className="wp-subscribe-cta"
    style={style}
    onClick={() => { if (blocked) { if (onBlocked) onBlocked(); return; } alert(`${label}: ${inr(price)}${suffix || ''}`); }}
  >
    <span className="cta-text">
      <span className="cta-label">{label}</span>
      {(saved != null || perDelivery != null) && (
        <span className="cta-sub">
          {saved != null && <>Saved {inr(saved)}</>}
          {saved != null && perDelivery != null && <span className="cta-sub-dot"> · </span>}
          {perDelivery != null && <>{inr(perDelivery)}/delivery</>}
        </span>
      )}
    </span>
    <span className="cta-price">{inr(price)}{suffix && <span className="cta-suffix">{suffix}</span>}</span>
  </button>
);

const FreebieStrip = ({ items }) => {
  const rowRef = useRef(null);
  const showArrows = false;
  return (
    <div className="wp-freebie-strip">
      <div className="wp-freebie-row-wrap">
        {showArrows && (
          <button type="button" className="wp-freebie-arrow" onClick={() => scrollByCards(-1)} aria-label="Scroll left">
            <ChevronLeft size={16} />
          </button>
        )}
        <div className="wp-freebie-row" ref={rowRef}>
          {items.map((item, i) => (
            <div className="wp-freebie-item" key={i}>
              <span className="wp-freebie-delivery">{item.delivery}</span>
              <div className="wp-freebie-img" />
              <div className="wp-freebie-price">
                <span className="wp-freebie-mrp">{`₹${item.mrp.toLocaleString("en-IN")}`}</span>
                <span className="wp-freebie-free">FREE</span>
              </div>
              <span className="wp-freebie-name">{item.name}</span>
            </div>
          ))}
          <div aria-hidden="true" style={{ flex: "0 0 4px" }} />
        </div>
        {showArrows && (
          <button type="button" className="wp-freebie-arrow" onClick={() => scrollByCards(1)} aria-label="Scroll right">
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * Welcome Gift block — collapsible header pill (gradient fade to yellow
 * + chevron), expanded by default, over a horizontal row of delivery
 * cards (grey image, struck MRP -> red FREE, product name). Renders
 * only when `items` is non-empty; the caller hides it otherwise.
 * ------------------------------------------------------------------ */
const WelcomeGiftBlock = ({ items }) => {
  const C = useC();
  const { sh } = useShape();
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  const totalWorth = items.reduce((sum, it) => sum + (it.mrp || 0), 0);
  return (
    <div className="card-refresh" style={{
      display: "flex", flexDirection: "column", width: "100%", boxSizing: "border-box", fontFamily: FONT,
      border: `1px solid ${C.accent}`, borderRadius: sh.card, background: C.yellowBg, overflow: "hidden",
    }}>
      {/* header row — plain, shares the container BG (no inner pill) */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          ...BUTTON_RESET, cursor: "pointer", width: "100%", boxSizing: "border-box",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          padding: "13px 16px", background: "transparent", border: "none",
        }}
        aria-expanded={open}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🎁</span>
          <span style={{
            fontSize: 16, fontWeight: 700, color: C.inkOnSelBg, minWidth: 0,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            You unlocked {inr(totalWorth)} in free gifts
          </span>
        </span>
        <ChevronDown
          size={18}
          color={C.inkOnSelBg}
          style={{ flexShrink: 0, transition: "transform 0.3s cubic-bezier(.22,1,.36,1)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/* divider + freebie tiles */}
      <SMWCollapse open={open}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingBottom: 20 }}>
          <div style={{ height: 1, width: "auto", background: C.accent, opacity: 0.6, margin: "0 16px" }} />
          <FreebieStrip items={items} />
        </div>
      </SMWCollapse>
    </div>
  );
};

const WELCOME_GIFT_ITEMS = [
  { name: "Sea Buckthorn Concentrate", mrp: 999, delivery: "3rd Delivery" },
  { name: "Sea Buckthorn Concentrate", mrp: 999, delivery: "5th Delivery" },
  { name: "Sea Buckthorn Concentrate", mrp: 999, delivery: "7th Delivery" },
  { name: "Sea Buckthorn Concentrate", mrp: 999, delivery: "9th Delivery" },
  { name: "Sea Buckthorn Concentrate", mrp: 999, delivery: "11th Delivery" },
  { name: "Sea Buckthorn Concentrate", mrp: 999, delivery: "13th Delivery" },
];


/* ================================================================== *
 * SHARED — subscription-widget popup infrastructure
 * (used by Prepaid, PAYG, MultiFreq, and reused for SinglePlan's
 * Freebies popup, which referenced it without defining it)
 * ================================================================== */
function SMWCollapse({ open, gapCompensation = 0, children }) {
  return (
    <div style={{
      display: "grid", gridTemplateRows: open ? "1fr" : "0fr",
      marginTop: open ? 0 : -gapCompensation,
      transition: "grid-template-rows 0.3s cubic-bezier(.22,1,.36,1), margin-top 0.3s cubic-bezier(.22,1,.36,1)",
    }}>
      <div style={{ overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function CheckIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path d="M4 12.5L9.5 18L20 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const HOW_STEPS = [
  { title: "Pick your plan", body: "Choose a one-time purchase or a subscription that fits your routine." },
  { title: "Choose how you pay", body: "Pay upfront for the whole plan, or pay as each delivery goes out." },
  { title: "We deliver on schedule", body: "Your order ships automatically on the frequency you pick." },
  { title: "Skip, swap, or cancel anytime", body: "Full control from your account — no lock-in." },
];

const HowSubscriptionsPopup = ({ onClose }) => { const C = useC(); const { sh } = useShape(); return (
  <div style={{
    width: "100%", border: `1px solid ${C.primary}`, borderRadius: sh.card, background: C.bg,
    display: "flex", flexDirection: "column", gap: 14,
    padding: 16, boxSizing: "border-box", fontFamily: FONT,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: C.inkOnBg }}>How Subscriptions Work?</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
        <X size={12} strokeWidth={2} color={C.inkOnBg} />
      </button>
    </div>
    <div style={{ height: 0.5, background: GREY_DARK, width: "100%" }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {HOW_STEPS.map((s, i) => (
        <div key={s.title} style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%" }}>
          <span style={{
            width: 22, height: 22, borderRadius: Math.max(2, sh.card - 4), flexShrink: 0,
            background: C.primary, color: C.onBar, fontSize: 14, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{i + 1}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.inkOnBg }}>{s.title}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.mutedOnTile, lineHeight: 1.4 }}>{s.body}</span>
          </div>
        </div>
      ))}
    </div>
    <button onClick={onClose} className="sb-anim" style={{
      background: C.primary, border: "none", borderRadius: sh.card,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "11px 12px", width: "100%", cursor: "pointer",
    }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: C.onBar, letterSpacing: "-0.35px" }}>Done</span>
    </button>
  </div>
); };

const FREEBIE_ITEMS = [
  { name: "Sea Buckthorn Concentrate", meta: "500ml • Power X", delivery: "3rd Delivery" },
  { name: "Sea Buckthorn Concentrate", meta: "500ml • Diabetes", delivery: "6th Delivery" },
  { name: "Sea Buckthorn Concentrate", meta: "500ml • Original", delivery: "9th Delivery" },
];

const FreebiesPopup = ({ onClose }) => { const C = useC(); const { sh } = useShape(); return (
  <div style={{
    width: "100%", border: `1px solid ${C.primary}`, borderRadius: sh.card, background: C.bg,
    display: "flex", flexDirection: "column", gap: 14,
    padding: 16, boxSizing: "border-box", fontFamily: FONT,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: C.inkOnBg }}>Freebies</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
        <X size={12} strokeWidth={2} color={C.inkOnBg} />
      </button>
    </div>
    <div style={{ height: 0.5, background: GREY_DARK, width: "100%" }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
      {FREEBIE_ITEMS.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
          <div style={{
            width: 40, height: 40, borderRadius: sh.img, flexShrink: 0,
            background: IMG_GREY, border: `1px solid ${GREY_LIGHT}`, boxSizing: "border-box",
          }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 0 0", minWidth: 0 }}>
            <span style={{
              fontSize: 15, fontWeight: 600, color: C.nameOnTile, whiteSpace: "nowrap",
              overflow: "hidden", textOverflow: "ellipsis",
            }}>{f.name}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.mutedOnTile }}>{f.meta}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.mutedOnTile, whiteSpace: "nowrap", flexShrink: 0 }}>{f.delivery}</span>
        </div>
      ))}
    </div>
    <button onClick={onClose} className="sb-anim" style={{
      background: C.primary, border: "none", borderRadius: sh.card,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "11px 12px", width: "100%", cursor: "pointer",
    }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: C.onBar, letterSpacing: "-0.35px" }}>Done</span>
    </button>
  </div>
); };

/* ------------------------------------------------------------------ *
 * Pincode popup — "Add delivery location": country/state dropdowns,
 * pincode + Get Rates, then shipping-method pills, then Submit.
 * ------------------------------------------------------------------ */
const PIN_COUNTRIES = ["India"];
const PIN_STATES = ["Odisha", "Maharashtra", "Karnataka", "Delhi", "Tamil Nadu", "West Bengal", "Telangana"];
const SHIPPING_TYPES = [
  { id: "priority", label: "Priority", price: "₹260", eta: "arrives in 1–2 days" },
  { id: "express",  label: "Express",  price: "₹160", eta: "arrives in 2–3 days" },
  { id: "standard", label: "Standard", price: "Free", eta: "arrives in 5–7 days" },
];

const PincodeInline = ({ pincode, shipType, onOpen, error = false, shakeKey = 0 }) => {
  const C = useC();
  const [shaking, setShaking] = useState(false);
  useEffect(() => {
    if (shakeKey > 0) { setShaking(true); const t = setTimeout(() => setShaking(false), 450); return () => clearTimeout(t); }
  }, [shakeKey]);
  const valid = /^\d{6}$/.test(pincode);
  const chosen = SHIPPING_TYPES.find((s) => s.id === (shipType || "express"));
  const filled = valid && shipType;
  return (
    <button
      type="button"
      className={`pin-inline${valid ? " valid" : ""}${error ? " error" : ""}${shaking ? " shake" : ""}`}
      onClick={onOpen}
    >
      <span className={`pin-inline-value${!valid ? " placeholder" : ""}`}>
        {valid ? pincode : (error ? "Enter pincode to continue" : "Enter Pincode")}
      </span>
      {filled && chosen && (
        <span className="pin-inline-ship">
          <span className="pin-dot">•</span> {chosen.label} {chosen.price}
          <Check size={15} strokeWidth={2.5} />
        </span>
      )}
      <span className="pin-inline-go" aria-hidden="true">
        <ArrowRight size={15} strokeWidth={2.4} />
      </span>
    </button>
  );
};

const PriceSummaryPopup = ({ pricing, perDelivery, term = 3, onClose }) => {
  const C = useC(); const { sh } = useShape();
  const perDel = perDelivery ?? pricing.perDelivery;
  const mrp = pricing.oneTime;
  const offAmt = mrp - perDel;
  const offPct = mrp > 0 ? Math.round((offAmt / mrp) * 100) : 0;
  const total = perDel * term;
  const fmt = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const Row = ({ l, v, lc, vc, bold, strike }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 16, color: lc || C.mutedOnTile, fontWeight: bold ? 700 : 400 }}>{l}</span>
      <span style={{ fontSize: 16, color: vc || C.mutedOnTile, fontWeight: bold ? 700 : 400, textDecoration: strike ? "line-through" : "none" }}>{v}</span>
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 22, fontFamily: FONT, background: C.bg, border: `1px solid ${GREY_LIGHT}`, borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.16)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.inkOnBg }}>Price summary</div>
        <button onClick={onClose} style={{ ...BUTTON_RESET, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={16} strokeWidth={2} color={C.mutedOnTile} /></button>
      </div>
      <Row l="MRP" v={fmt(mrp)} strike />
      <Row l={`${offPct}% off`} v={`−${fmt(offAmt)}`} vc={C.accent} />
      <Row l="Per delivery" v={fmt(perDel)} lc={C.inkOnBg} vc={C.inkOnBg} bold />
      <div style={{ borderTop: `1px dashed ${C.border || '#ddd'}`, margin: "2px 0" }} />
      <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, color: C.mutedOnTile }}>× {term} deliveries</div>
      <Row l="Shipping (Free Shipping)" v="₹0.00" />
      <Row l="Total" v={fmt(total)} lc={C.inkOnBg} vc={C.inkOnBg} bold />
    </div>
  );
};

const PincodePopup = ({ pincode, shipType, onApply, onClose }) => {
  const C = useC(); const { sh } = useShape();
  const [country, setCountry] = useState(PIN_COUNTRIES[0]);
  const [state, setState] = useState(PIN_STATES[0]);
  const [pin, setPin] = useState(pincode || "");
  const [type, setType] = useState(shipType || null);
  const [rated, setRated] = useState(!!shipType);
  const valid = /^\d{6}$/.test(pin);
  const chosen = SHIPPING_TYPES.find((s) => s.id === type);

  const getRates = () => { if (valid) { setRated(true); if (!type) setType("standard"); } };

  // matches the widget's LabeledDropdown label styling
  const fieldLabel = { fontSize: 13, fontWeight: 500, color: C.inkOnTile, letterSpacing: "0.28px", textTransform: "uppercase", whiteSpace: "nowrap" };

  return (
    <div style={{
      width: "100%", border: `1px solid ${C.borderLite}`, borderRadius: sh.card, background: C.bg,
      display: "flex", flexDirection: "column", gap: 12,
      padding: 16, boxSizing: "border-box", fontFamily: FONT, boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <MapPin size={17} color={C.accent} fill={C.accent} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: C.inkOnBg }}>Add delivery location</span>
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          <X size={14} strokeWidth={2} color={C.inkOnBg} />
        </button>
      </div>
      <div style={{ height: 0.5, background: GREY_DARK, width: "100%" }} />

      {/* country + state */}
      <div style={{ display: "flex", gap: 6, width: "100%" }}>
        <div style={{ flex: "1 0 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>Select Country</span>
          <Dropdown value={country} options={PIN_COUNTRIES} onChange={setCountry}
            boxStyle={{ height: 40, padding: "10px 12px", background: DROPDOWN_FIELD_GREY, border: `1px solid ${C.borderLite}` }}
            textStyle={{ fontSize: 16, fontWeight: 600, color: C.inkOnTile }} />
        </div>
        <div style={{ flex: "1 0 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={fieldLabel}>Select State</span>
          <Dropdown value={state} options={PIN_STATES} onChange={setState}
            boxStyle={{ height: 40, padding: "10px 12px", background: DROPDOWN_FIELD_GREY, border: `1px solid ${C.borderLite}` }}
            textStyle={{ fontSize: 16, fontWeight: 600, color: C.inkOnTile }} />
        </div>
      </div>

      {/* pincode + Get Rates */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        <span style={fieldLabel}>Enter Pincode</span>
        <div style={{ display: "flex", gap: 6, alignItems: "stretch", width: "100%" }}>
          <input
            value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setRated(false); }}
            inputMode="numeric"
            placeholder="Enter 6-digit pincode"
            style={{
              flex: "1 0 0", minWidth: 0, boxSizing: "border-box", height: 40,
              border: `1px solid ${C.borderLite}`, borderRadius: sh.card, padding: "0 12px",
              outline: "none", background: C.bg, fontFamily: FONT, fontSize: 16, fontWeight: 600, color: C.inkOnTile,
            }}
          />
          <button
            onClick={getRates}
            disabled={!valid}
            className="sb-anim"
            style={{
              ...BUTTON_RESET, flexShrink: 0, cursor: valid ? "pointer" : "not-allowed", height: 40,
              background: C.primary, color: C.onBar, border: "none", borderRadius: sh.card,
              padding: "0 16px", fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center",
              opacity: valid ? 1 : 0.5,
            }}
          >
            Get Rates
          </button>
        </div>
      </div>

      {/* shipping method — hidden until Get Rates is tapped */}
      {rated && (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <span style={fieldLabel}>Shipping Method</span>
        <>
            <div style={{ display: "flex", gap: 6, width: "100%", flexWrap: "wrap" }}>
              {SHIPPING_TYPES.map((s) => {
                const on = type === s.id;
                return (
                  <button key={s.id} onClick={() => setType(s.id)} style={{
                    ...BUTTON_RESET, cursor: "pointer", flex: "1 1 0", minWidth: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    border: `${on ? "1.7px" : "1px"} solid ${on ? C.accent : C.borderLite}`,
                    background: on ? C.selBg : DROPDOWN_FIELD_GREY,
                    borderRadius: sh.pill, padding: on ? "9px 12px" : "9.7px 12px", whiteSpace: "nowrap",
                  }}>
                    <span style={{ fontSize: 14.5, fontWeight: 600, color: C.inkOnTile }}>{s.label}</span>
                    {s.price !== null && (
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: C.accent }}>{s.price}</span>
                    )}
                  </button>
                );
              })}
            </div>
            {chosen && (
              <span style={{ fontSize: 13, fontWeight: 500, color: C.mutedOnTile }}>
                {chosen.label} · {chosen.eta}
              </span>
            )}
          </>
      </div>
      )}

      {/* submit — hidden until Get Rates is tapped */}
      {rated && (
      <button
        onClick={() => { if (valid) onApply({ pincode: pin, shipType: type || "standard" }); }}
        disabled={!valid}
        className="sb-anim"
        style={{
          background: C.primary, border: "none", borderRadius: sh.card,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "11px 12px", width: "100%", cursor: valid ? "pointer" : "not-allowed",
          opacity: valid ? 1 : 0.5,
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 700, color: C.onBar, letterSpacing: "-0.35px" }}>Submit</span>
      </button>
      )}
    </div>
  );
};

/* ================================================================== *
 * Single Plan Widget — One Time / Pay Upfront / Pay Per Delivery.
 * Freebie block only on Pay Per Delivery; opens the shared Freebies popup.
 * ================================================================== */
function SubscriptionOptionSingle({ brand = BRAND, shape, surface, onSelectionChange, showOneTime = true, pricing = DEFAULT_PRICING, pinErrorSignal = 0, endless = true }) {
  const C = useMemo(() => makeC(buildTokens(brand)), [brand]);
  const shapeCtx = useMemo(() => buildShapeCtx(shape, surface), [shape, surface]);
  const { sh, shadowMode, noneMode, S } = shapeCtx;
  const [selected, setSelected] = useState("upfront");
  const [hovered, setHovered] = useState(null);
  const [popup, setPopup] = useState(null);
  const [pincode, setPincode] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);   // the gift card is open: the pincode steps aside and the pricing summary takes the full row
  const [pinError, setPinError] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const pinOk = /^\d{6}$/.test(pincode);
  const triggerPinError = () => { setPinError(true); setShakeCount((n) => n + 1); };
  useEffect(() => { if (pinErrorSignal > 0 && !pinOk) triggerPinError(); }, [pinErrorSignal]);
  useEffect(() => { if (endless && selected === "upfront") setSelected("perdelivery"); }, [endless, selected]);
  const [shipType, setShipType] = useState(null);
  const shipTypeLabel = (SHIPPING_TYPES.find((s) => s.id === shipType) || SHIPPING_TYPES[0]).label;

  // Endless ON → plain frequency; OFF → "<freq> for <N> deliveries"
  const SINGLE_PLAN_FREQ = { upfront: { freq: "Every Month", deliveries: 3 }, perdelivery: { freq: "Every Week", deliveries: 12 }, payg: { freq: "Every Week", deliveries: 12 } };
  const deliveredText = (planId) => {
    const p = SINGLE_PLAN_FREQ[planId] || SINGLE_PLAN_FREQ.upfront;
    return endless ? p.freq : `${p.freq} for ${p.deliveries} deliveries`;
  };

  // report the live plan selection to the host page (e.g. sticky CTA)
  useEffect(() => {
    if (!onSelectionChange) return;
    const MAP = {
      onetime:     { label: "Buy",       payType: "onetime",     price: pricing.oneTime, suffix: "", saved: null, estimate: { nextCharge: pricing.oneTime, frequency: "One-time" } },
      upfront:     { label: "Subscribe", payType: "upfront",     price: pricing.upfrontTotal, suffix: "", saved: pricing.upfrontSaved, perDelivery: pricing.perDelivery, estimate: { nextCharge: pricing.upfrontTotal, frequency: "Every 4 weeks" } },
      perdelivery: { label: "Subscribe", payType: "perDelivery", price: pricing.perDelivery, suffix: "/delivery", saved: pricing.perDeliverySaved, estimate: { nextCharge: pricing.perDelivery, frequency: "Every 4 weeks" } },
      payg:        { label: "Subscribe", payType: "payg",        price: pricing.payg, suffix: "/delivery", saved: null, estimate: { nextCharge: pricing.payg, frequency: "Every 4 weeks" } },
    };
    onSelectionChange({ ...(MAP[selected] || MAP.upfront), pinValid: /^\d{6}$/.test(pincode) });
  }, [selected, onSelectionChange, pricing, pincode]);

  const cardStyle = (isSelected, isHovered) => ({
    ...BUTTON_RESET, width: "100%", boxSizing: "border-box", background: isSelected ? C.bg : isHovered ? C.grayBg : C.bg,
    border: shadowMode || noneMode ? "1.5px solid transparent" : `${isSelected ? "1.7px" : "1.5px"} solid ${isSelected ? C.accent : GREY_LIGHT}`,
    boxShadow: shadowMode ? (isSelected ? S.sel : S.unsel) : "none",
    borderRadius: sh.card, padding: isSelected ? "14px 16px" : "12px 14px",
    display: "flex", flexDirection: "column", gap: 0, cursor: "pointer",
    transform: isSelected ? "scale(1.03)" : "scale(1)", transformOrigin: "center",
    transition: "background-color 0.15s ease, padding 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
  });

  return (
    <AOBThemeCtx.Provider value={C}>
    <AOBShapeCtx.Provider value={shapeCtx}>
      <AOBStyles />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT, width: "100%", maxWidth: "100%", boxSizing: "border-box", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {showOneTime && (
            <button
              onClick={() => setSelected("onetime")}
              onMouseEnter={() => setHovered("onetime")}
              onMouseLeave={() => setHovered(null)}
              style={{ ...cardStyle(selected === "onetime", hovered === "onetime"), flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Radio checked={selected === "onetime"} size={18} />
                <span style={{ fontSize: 17, fontWeight: selected === "onetime" ? 600 : 500, color: hovered === "onetime" ? C.inkOnTile : selected === "onetime" ? C.inkOnTile : C.mutedOnTile }}>One Time Purchase</span>
              </span>
              <span style={{ fontSize: 17, fontWeight: 700, color: C.inkOnTile }}>{inr(pricing.oneTime)}</span>
            </button>
          )}

          {!endless && (
          <button
            onClick={() => setSelected("upfront")}
            onMouseEnter={() => setHovered("upfront")}
            onMouseLeave={() => setHovered(null)}
            style={cardStyle(selected === "upfront", hovered === "upfront")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Radio checked={selected === "upfront"} size={18} />
                <span style={{ fontSize: 17, fontWeight: selected === "upfront" ? 600 : 500, color: hovered === "upfront" ? C.inkOnTile : selected === "upfront" ? C.inkOnTile : C.mutedOnTile }}>Subscribe &amp; <span style={{ color: C.accent }}>Pay Upfront</span></span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: C.inkOnTile }}>{inr(pricing.upfrontTotal)}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.accent }}>Save {inr(pricing.upfrontSaved)}</span>
              </span>
            </div>
            <SMWCollapse open={selected === "upfront"} gapCompensation={0}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
                <div style={{ height: 1, width: "100%", background: GREY_LIGHT }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <p style={{ margin: 0, fontSize: 14, color: C.mutedOnTile }}>Delivered <span style={{ fontWeight: 600, color: C.inkOnTile }}>{deliveredText("upfront")}</span></p>
                    <p style={{ margin: 0, fontSize: 13, color: C.mutedOnTile }}>One payment today — all deliveries covered</p>
                  </div>
                  <span className="sb-pulse-text" style={{ background: C.primary, color: C.onBar, borderRadius: sh.pill, padding: "4px 12px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", marginRight: 2 }}><b>{inr(pricing.perDelivery)}</b>/ delivery</span>
                </div>
              </div>
            </SMWCollapse>
          </button>
          )}

          <button
            onClick={() => setSelected("perdelivery")}
            onMouseEnter={() => setHovered("perdelivery")}
            onMouseLeave={() => setHovered(null)}
            style={cardStyle(selected === "perdelivery", hovered === "perdelivery")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <Radio checked={selected === "perdelivery"} size={18} />
                <span style={{ fontSize: 17, fontWeight: selected === "perdelivery" ? 600 : 500, color: hovered === "perdelivery" ? C.inkOnTile : selected === "perdelivery" ? C.inkOnTile : C.mutedOnTile }}>Subscribe &amp; <span style={{ color: C.accent }}>Pay Per Delivery</span></span>
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: C.inkOnTile }}>{inr(pricing.perDelivery)}</span>
                <span style={{ fontSize: 13, color: C.mutedOnTile }}>/ delivery</span>
              </span>
            </div>
            <SMWCollapse open={selected === "perdelivery"} gapCompensation={0}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
                <div style={{ height: 1, width: "100%", background: GREY_LIGHT }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <p style={{ margin: 0, fontSize: 14, color: C.mutedOnTile }}>Delivered <span style={{ fontWeight: 600, color: C.inkOnTile }}>{deliveredText("perdelivery")}</span> <span style={{ fontWeight: 600, color: C.accent }}>Save {inr(pricing.perDeliverySaved)}</span></p>
                    <p style={{ margin: 0, fontSize: 13, color: C.mutedOnTile }}>Charged before every delivery.</p>
                  </div>
                </div>
              </div>
            </SMWCollapse>
          </button>

          <button
            onClick={() => setSelected("payg")}
            onMouseEnter={() => setHovered("payg")}
            onMouseLeave={() => setHovered(null)}
            style={cardStyle(selected === "payg", hovered === "payg")}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <Radio checked={selected === "payg"} size={18} />
                <span style={{ fontSize: 17, fontWeight: selected === "payg" ? 600 : 500, color: hovered === "payg" ? C.inkOnTile : selected === "payg" ? C.inkOnTile : C.mutedOnTile }}>Subscribe &amp; <span style={{ color: C.accent }}>Pay As You Go</span></span>
              </span>
              <span style={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0, whiteSpace: "nowrap" }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: C.inkOnTile }}>{inr(pricing.payg)}</span>
                <span style={{ fontSize: 13, color: C.mutedOnTile }}>/ delivery</span>
              </span>
            </div>
            <SMWCollapse open={selected === "payg"} gapCompensation={0}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>
                <div style={{ height: 1, width: "100%", background: GREY_LIGHT }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <p style={{ margin: 0, fontSize: 14, color: C.mutedOnTile }}>Delivered <span style={{ fontWeight: 600, color: C.inkOnTile }}>{deliveredText("payg")}</span></p>
                    <p style={{ margin: 0, fontSize: 13, color: C.mutedOnTile }}>Payment link before every delivery</p>
                  </div>
                </div>
              </div>
            </SMWCollapse>
          </button>
        </div>

        {(() => {
          const freebieCount = { onetime: 0, upfront: 5, perdelivery: 3, payg: 2 }[selected] || 0;
          return freebieCount > 0 && <WelcomeGiftBlock key={selected} items={WELCOME_GIFT_ITEMS.slice(0, freebieCount)} />;
        })()}

        <GiftSlot onOpenChange={setGiftOpen} />

        <div className="divider-line" />

        <div className="wp-ship-row">
          {!giftOpen && <PincodeInline pincode={pincode} shipType={shipType} error={pinError} shakeKey={shakeCount} onOpen={() => setPopup("pincode")} />}
          <button type="button" className="wp-summary-capsule" style={giftOpen ? { flex: 1, justifyContent: "space-between" } : undefined} onClick={() => setPopup("summary")}>
            Pricing summary <ChevronRight size={13} />
          </button>
        </div>

        <WidgetSubscribeCTA
          price={{ onetime: pricing.oneTime, upfront: pricing.upfrontTotal, perdelivery: pricing.perDelivery, payg: pricing.payg }[selected]}
          suffix={selected === "perdelivery" || selected === "payg" ? "/delivery" : ""}
          saved={selected === "onetime" ? null : selected === "upfront" ? pricing.upfrontSaved : selected === "perdelivery" ? pricing.perDeliverySaved : null}
          perDelivery={null}
          label={selected === "onetime" ? "Buy Now" : "Subscribe Now"}
          blocked={!pinOk}
          onBlocked={triggerPinError}
          style={{ marginTop: -6 }}
        />

        {popup === "pincode" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={440}>
            {(close) => (
              <PincodePopup
                pincode={pincode}
                shipType={shipType}
                onApply={({ pincode: p, shipType: t }) => { setPincode(p); setShipType(t); setPinError(false); close(); }}
                onClose={close}
              />
            )}
          </Backdrop>
        )}
        {popup === "summary" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={380}>
            {(close) => (
              <PriceSummaryPopup pricing={pricing} perDelivery={pricing.perDelivery} term={pricing.term} onClose={close} />
            )}
          </Backdrop>
        )}
      </div>
    </AOBShapeCtx.Provider>
    </AOBThemeCtx.Provider>
  );
}

/* ================================================================== *
 * International Plan — 2 duration cards (90-Day / 30-Day). Selecting a
 * card smoothly scales/highlights it; the Welcome Gift pill expands
 * INLINE into a milestone strip (not a modal).
 * ================================================================== */
const INTL_PLANS = {
  upfront:     { id: "upfront",     payType: "upfront",     duration: "90-Day Supply", payLabel: "Paying Upfront",      valueTag: "BEST VALUE",   discountTag: "10%OFF", total: 5996, save: 860, perDelivery: 1364, freq: "Every Week", deliveries: 12, delivered: "Every Week for 12 Weeks.", note: "One payment today — all deliveries covered." },
  perdelivery: { id: "perdelivery", payType: "perDelivery", duration: "60-Day Supply", payLabel: "Paying Per Delivery", valueTag: "MOST LIKED",   discountTag: "20%OFF", perDelivery: 1364, save: 860, freq: "Every Week", deliveries: 8, delivered: "Every Week for 8 Weeks.", note: "Charged automatically before every delivery." },
  payg:        { id: "payg",        payType: "payg",        duration: "30-Day Supply", payLabel: "Paying As You Go",   valueTag: "FLEXIBLE",     discountTag: "",       perDelivery: 1499, freq: "Every Week", deliveries: 4, delivered: "Every Week for 4 Weeks.", note: "Payment link sent before every delivery — skip anytime." },
};
const INTL_PLAN_ORDER = ["upfront", "perdelivery", "payg"];
const INTL_MILESTONES = ["3rd", "5th", "7th", "9th"];

/* ================================================================== *
 * Prepaid Only — 3 duration-plan cards (horizontal scroll), deliveries
 * dropdown, freebie ticker opens the shared Freebies popup.
 * ================================================================== */
const PREPAID_PLANS = [
  { id: "4m", label: "4 Months", badge: "BEST VALUE", save: 2571, deliveries: 8, cadence: "Every 4 Months" },
  { id: "6m", label: "6 Months", badge: "MOST POPULAR", save: 3400, deliveries: 12, cadence: "Every 6 Months" },
  { id: "2w", label: "2 Weeks", badge: "BEST VALUE", save: 1200, deliveries: 4, cadence: "Every 2 Weeks" },
];
const PREPAID_DELIVERY_COUNTS = ["4 Deliveries", "8 Deliveries", "12 Deliveries", "16 Deliveries"];

/* ================================================================== *
 * Only Pay As You Go — 3-slot frequency rotator (fixed selected slot +
 * 2 rotating slots), deliveries dropdown, gifts pill opens Freebies popup.
 * ================================================================== */
const PAYG_FREQUENCIES = [
  { id: "2w", short: "2 Weeks", hasFreebie: true },
  { id: "2m", short: "2 Months", hasFreebie: true },
  { id: "4d", short: "4 Days", hasFreebie: false },
  { id: "1mo", short: "1 Month", hasFreebie: false },
];
const PAYG_DELIVERY_COUNTS = ["4 Deliveries", "8 Deliveries", "12 Deliveries", "16 Deliveries"];

/* ================================================================== *
 * Multifrequency — Frequency + Payment-type dropdowns (shared Dropdown).
 * ================================================================== */
const MF_FREQUENCY_OPTIONS = ["Every 2 Weeks", "Every 4 Weeks", "Every 2 Months"];
const MF_PAYMENT_OPTIONS = ["Pay Per Delivery", "Pay Upfront"];

const MD_DELIVERY_OPTIONS = [4, 6, 8, 10];

const MdHowPopup = ({ onClose }) => { const C = useC(); const { sh } = useShape(); return (
  <div style={{ width: "100%", border: `1px solid ${C.primary}`, borderRadius: sh.card, background: C.bg, display: "flex", flexDirection: "column", gap: 14, padding: 16, boxSizing: "border-box", fontFamily: FONT }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: C.inkOnBg }}>How Subscriptions Work?</span>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={12} strokeWidth={2} color={C.inkOnBg} /></button>
    </div>
    <div style={{ height: 0.5, background: GREY_DARK, width: "100%" }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {[
        { n: 1, title: "Pick your delivery count", body: "Choose how many deliveries your plan includes." },
        { n: 2, title: "Prepaid or pay as you go.", body: "Upfront: pay once for all deliveries. Per Delivery: pay each time, cancel anytime." },
        { n: 3, title: "Save on every cycle", body: "Your discount applies on every delivery." },
        { n: 4, title: "Pause or cancel anytime.", body: "Manage everything from your account." },
      ].map((s) => (
        <div key={s.n} style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%" }}>
          <span style={{ width: 22, height: 22, borderRadius: Math.max(2, sh.card - 4), flexShrink: 0, background: C.primary, color: C.onBar, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.inkOnBg }}>{s.title}</span>
            <span style={{ fontSize: 14, fontWeight: 500, color: C.mutedOnTile, lineHeight: 1.4 }}>{s.body}</span>
          </div>
        </div>
      ))}
    </div>
    <button onClick={onClose} className="sb-anim" style={{ background: C.primary, border: "none", borderRadius: sh.card, display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 12px", width: "100%", cursor: "pointer" }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: C.onBar, letterSpacing: "-0.35px" }}>Done</span>
    </button>
  </div>
); };


/* ================================================================== *
 * SHARED — re-added for Subscription Master (Labeled dropdown + pricing popup)
 * ================================================================== */
const LabeledDropdown = ({ label, value, options, onChange, dropdownBg }) => { const C = useC(); return (
  <div style={{ flex: "1 0 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{
      fontSize: 13, fontWeight: 500, color: C.inkOnTile,
      letterSpacing: "0.28px", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>{label}</span>
    <Dropdown value={value} options={options} onChange={onChange}
      boxStyle={{ height: 40, padding: "10px 12px", ...(dropdownBg ? { background: dropdownBg } : {}) }}
      textStyle={{ fontSize: 16, fontWeight: 600, color: dropdownBg ? C.inkOnSelBg : C.inkOnTile }}
    />
  </div>
); };

const PricingPopup = ({ rows, onClose }) => { const C = useC(); const { sh } = useShape(); return (
  <div style={{
    width: "100%", border: `1px solid ${C.primary}`, borderRadius: sh.card, background: C.bg,
    display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-end",
    padding: 16, boxSizing: "border-box", fontFamily: FONT,
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: C.inkOnBg }}>Pricing Summary</span>
      <button onClick={onClose} style={{
        background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex",
      }}>
        <X size={12} strokeWidth={2} color={C.inkOnBg} />
      </button>
    </div>
    <div style={{ height: 0.5, background: GREY_DARK, width: "100%" }} />
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {rows.map((r) => (
        <div key={r.l} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
        }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: C.inkOnBg }}>{r.l}</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: r.accent ? C.accent : C.inkOnBg }}>{r.v}</span>
        </div>
      ))}
    </div>
  </div>
); };

/* ================================================================== *
 * Subscription Master (4 schedule-picker variants) — reuses the shared
 * token engine, fixed greys, shape/surface context, Radio, PayToggle,
 * Chevron, Dropdown/LabeledDropdown, PricingPopup, FreebiesPopup,
 * HowSubscriptionsPopup, SMWCollapse, and AOBStyles above (sb-shimmer /
 * sb-pulse-text reused instead of redefining local equivalents). Only
 * its unique parts (banner, schedule pickers, freebies/savings rows,
 * its own dropdown-chip menu) are new.
 * ================================================================== */
function InfoIcon({ size, color }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" />
      <line x1="12" y1="11" x2="12" y2="16.5" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="7.7" r="1.1" fill={color} />
    </svg>
  );
}

/* Flips between the gift icon and a free-product face — purely decorative, no tokens */
function GiftFlipper({ size }) {
  return (
    <span style={{ fontSize: size, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      🎁
    </span>
  );
}

/* ---------------- Schedule data ---------------- */
const SCHEDULES = [
  { id: "3m", title: "3 Months",  sub: "Every Month", deliveries: 3 },
  { id: "4w", title: "4 Weeks",   sub: "Every Week",  deliveries: 10 },
  { id: "6m", title: "6 Months",  sub: "Every Month", deliveries: 6 },
  { id: "4d", title: "4 Days",    sub: "Every 4 Days", deliveries: 8 },
];
const BADGES_GRID = { "4w": "BEST VALUE", "3m": "MOST POPULAR", "6m": null, "4d": "FLEXIBLE" };
const BADGES_LIST = { "4w": "BEST VALUE", "3m": null, "6m": "BEST VALUE", "4d": "FLEXIBLE" };
const GRID_ORDER = ["4w", "3m", "6m", "4d"];
const LIST_ORDER = ["3m", "4w", "6m", "4d"];
const SMW_FREQ_OPTIONS = ["Every Week", "Every 2 Weeks", "Every Month", "Every 2 Months"];
const SMW_DELIVERY_OPTS = ["4 Deliveries", "8 Deliveries", "12 Deliveries", "24 Deliveries"];

/* ---------------- Shared sections reused by all 4 variants ---------------- */
function OneTimeRow({ selected, onClick }) {
  const C = useC(); const { sh, shadowMode, noneMode, S } = useShape();
  return (
    <button onClick={onClick} style={{
      ...BUTTON_RESET, cursor: "pointer", width: "100%", boxSizing: "border-box",
      background: selected ? C.yellowBg : C.bg,
      border: shadowMode ? "1px solid transparent" : noneMode ? `1px solid ${selected ? "transparent" : GREY_LIGHT}` : `${selected ? "1.2px" : "1px"} solid ${selected ? C.accent : GREY_LIGHT}`,
      boxShadow: shadowMode ? (selected ? S.sel : S.unsel) : "none",
      borderRadius: sh.card, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Radio checked={selected} size={18} />
        <span style={{ fontSize: 16, fontWeight: selected ? 600 : 500, color: selected ? C.inkOnTile : C.mutedOnTile }}>One Time Purchase</span>
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: C.inkOnTile }}>{inr(1499)}</span>
    </button>
  );
}


function Banner({ pulse }) {
  const C = useC();
  return (
    <div className="sb-shimmer" style={{ background: C.primary, borderBottom: `0.5px solid ${C.muted}`, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "center", width: "100%", boxSizing: "border-box" }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: C.onBar, whiteSpace: "nowrap" }}>
        Flat <span className={pulse ? "sb-pulse-text" : ""} style={{ display: "inline-flex", fontWeight: 700, color: C.onBarAccent }}>30% OFF</span> on all subscriptions
      </span>
    </div>
  );
}

function SubscribeHeaderRow({ selected, onClick }) {
  const C = useC(); const { sh, noneMode } = useShape();
  return (
    <button onClick={onClick} style={{ ...BUTTON_RESET, cursor: "pointer", width: "100%", boxSizing: "border-box", background: C.bg, border: "none", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <Radio checked={selected} size={18} />
        <span style={{ fontSize: 16, fontWeight: selected ? 600 : 500, color: selected ? C.inkOnTile : C.mutedOnTile }}>Subscribe &amp; Save</span>
      </span>
      <span className="sb-pulse-text" style={{ background: C.primary, color: C.onBar, borderRadius: sh.pill, padding: "6px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>UPTO 10%OFF</span>
    </button>
  );
}

function FreebiesRow({ onOpenFreebies }) {
  const C = useC(); const { sh } = useShape();
  return (
    <button onClick={onOpenFreebies} style={{
      ...BUTTON_RESET, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
      background: C.yellowBg, border: `0.5px solid ${C.yellowBd}`, borderRadius: sh.pill, padding: "5px 11px",
    }}>
      <GiftFlipper size={13} />
      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.inkOnSelBg, whiteSpace: "nowrap" }}>Freebies x2</span>
      <InfoIcon size={12} color={C.inkOnSelBg} />
    </button>
  );
}

const SMW_PRICING_ROWS = [
  { l: "Plan price", v: inr(2356) },
  { l: "Discount", v: "- " + inr(500), accent: true },
  { l: "You pay", v: inr(1856) },
];

function SavingsRow({ onOpenPricing, onOpenFreebies }) {
  const C = useC(); const { sh } = useShape();
  return (
    <div style={{
      width: "100%", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "8px 28px",
      padding: "14px 18px",
      background: C.yellowBg,
      border: `1px solid ${C.accent}`, borderRadius: 16,
    }}>
      <button onClick={onOpenPricing} style={{
        ...BUTTON_RESET, cursor: "pointer", background: "none", border: "none",
        display: "inline-flex", alignItems: "center", gap: 9,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.inkOnSelBg, whiteSpace: "nowrap" }}>Total savings {inr(500)}</span>
        <span style={{ background: C.accent, color: C.onAccent, borderRadius: sh.pill, padding: "2px 8px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>10%OFF</span>
      </button>
      <button onClick={onOpenFreebies} style={{
        ...BUTTON_RESET, cursor: "pointer", background: "none", border: "none",
        display: "inline-flex", alignItems: "center", gap: 9,
      }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.inkOnSelBg, whiteSpace: "nowrap" }}>Freebies x2</span>
        <InfoIcon size={13} color={C.mutedOnTile} />
      </button>
    </div>
  );
}

function SMWFooterCTA({ isSubscribe, perDelivery }) {
  const C = useC(); const { sh, S } = useShape();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <button
        onClick={() => alert(isSubscribe ? "Subscribe Now: ₹19,988" : "Buy Now: ₹1,499")}
        style={{
          ...BUTTON_RESET, cursor: "pointer", boxSizing: "border-box", width: "100%",
          background: C.primary, color: C.onBar, border: "none", borderRadius: sh.card,
          boxShadow: S.pop,
          padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 19, fontWeight: 700, color: C.onBar, letterSpacing: "-0.375px" }}>
            {isSubscribe ? "Subscribe Now" : "Buy Now"}
          </span>
          {isSubscribe && (
            <span style={{ fontSize: 13, fontWeight: 500, color: C.subOnBar, display: "flex", alignItems: "center", gap: 4 }}>
              Total savings {inr(857)} <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.subOnBar }} /> <span style={{ color: C.onBarAccent, fontWeight: 700 }}>30% OFF</span>
            </span>
          )}
        </span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 2, flexShrink: 0 }}>
          <span style={{ fontSize: 23, fontWeight: 700, color: C.onBarAccent, letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>
            {isSubscribe ? inr(19988) : inr(1499)}
          </span>
          {perDelivery && (
            <span style={{ fontSize: 13, fontWeight: 500, color: C.subOnBar, whiteSpace: "nowrap" }}>/delivery</span>
          )}
        </span>
      </button>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase", color: C.mutedOnTile, textAlign: "center", width: "100%" }}>
        Powered by: Stackback.AI
      </p>
    </div>
  );
}

/* ---------------- Schedule pickers (differ per option) ---------------- */

function ScheduleCard({ sched, badge, selected, off, endless = true }) {
  const C = useC(); const { sh, shadowMode, noneMode, S } = useShape();
  const subText = endless ? sched.sub : `${sched.sub} for ${sched.deliveries} deliveries`;
  return (
    <button style={{
      ...BUTTON_RESET, cursor: "pointer", width: "100%", height: "100%", boxSizing: "border-box",
      background: selected ? C.yellowBg : C.bg,
      border: shadowMode || noneMode ? "0.75px solid transparent" : `${selected ? "0.95px" : "0.75px"} solid ${selected ? C.accent : GREY_LIGHT}`,
      boxShadow: shadowMode ? (selected ? S.sel : S.unsel) : "none",
      borderRadius: sh.card, overflow: "hidden", display: "flex", flexDirection: "column",
      transition: "background 0.2s ease, border-color 0.2s ease",
    }}>
      <div style={{ flex: 1, padding: "10px 10px 8px", display: "flex", flexDirection: "column", gap: 6, width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%", gap: 6 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: selected ? C.inkOnSelBg : C.inkOnTile }}>{sched.title}</span>
          <span style={{
            fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", borderRadius: sh.pill, padding: "3px 9px",
            background: selected ? C.accent : "transparent", color: selected ? C.onAccent : C.inkOnTile,
            border: selected ? "none" : `1px solid ${GREY_DARK}`,
          }}>{off}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 500, color: selected ? C.accentOnSel : C.mutedOnTile }}>{subText}</span>
      </div>
      <div style={{
        width: "100%", flexShrink: 0, background: badge ? (selected ? C.primary : GREY_LIGHT) : "transparent",
        padding: "6px 0", display: "flex", alignItems: "center", justifyContent: "center",
        boxSizing: "border-box",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.24px", lineHeight: 1, color: badge ? (selected ? C.onBar : C.mutedOnTile) : "transparent" }}>{badge || "—"}</span>
      </div>
    </button>
  );
}

function ScheduleListRow({ sched, badge, off, selected, onClick }) {
  const C = useC(); const { sh, shadowMode, noneMode, S } = useShape();
  return (
    <button onClick={onClick} style={{
      ...BUTTON_RESET, cursor: "pointer", width: "100%", boxSizing: "border-box",
      background: selected ? C.yellowBg : C.bg,
      border: shadowMode || noneMode ? "1.5px solid transparent" : `${selected ? "1.7px" : "1.5px"} solid ${selected ? C.accent : GREY_LIGHT}`,
      boxShadow: shadowMode ? (selected ? S.sel : S.unsel) : "none",
      borderRadius: sh.card, padding: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
      transition: "background 0.2s ease, border-color 0.2s ease",
    }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: selected ? C.inkOnSelBg : C.inkOnTile }}>{sched.title}</span>
        <span style={{ fontSize: 14, fontWeight: 500, color: selected ? C.accentOnSel : C.mutedOnTile }}>{sched.sub}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {badge && (
          <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", borderRadius: sh.pill, padding: "5px 10px", background: selected ? C.primary : GREY_LIGHT, color: selected ? C.onBar : C.mutedOnTile }}>{badge}</span>
        )}
        <span style={{
          fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", borderRadius: sh.pill, padding: "5px 10px",
          background: selected ? C.accent : "transparent", color: selected ? C.onAccent : C.inkOnTile,
          border: selected ? "none" : `1px solid ${GREY_DARK}`,
        }}>{off}</span>
      </div>
    </button>
  );
}



/* ===== Additional embedded widgets (Option 1 / Option 2 / International) ===== */

function SubscriptionOption1({ brand = BRAND, shape, surface, onSelectionChange, showOneTime = true, pricing = DEFAULT_PRICING, pinErrorSignal = 0 }) {
  const C = useMemo(() => makeC(buildTokens(brand)), [brand]);
  const shapeCtx = useMemo(() => buildShapeCtx(shape, surface), [shape, surface]);

  const [frequency, setFrequency] = useState("Every Month");
  const [deliveries, setDeliveries] = useState("12 Deliveries");
  const [payMode, setPayMode] = useState("upfront");
  const [popup, setPopup] = useState(null);
  const [pincode, setPincode] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);   // the gift card is open: the pincode steps aside and the pricing summary takes the full row
  const [pinError, setPinError] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const pinOk = /^\d{6}$/.test(pincode);
  const triggerPinError = () => { setPinError(true); setShakeCount((n) => n + 1); };
  useEffect(() => { if (pinErrorSignal > 0 && !pinOk) triggerPinError(); }, [pinErrorSignal]);
  const [shipType, setShipType] = useState(null);
  const shipTypeLabel = (SHIPPING_TYPES.find((s) => s.id === shipType) || SHIPPING_TYPES[0]).label;

  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange({ label: "Subscribe", payType: payMode === "upfront" ? "upfront" : payMode, price: payMode === "upfront" ? pricing.upfrontTotal : pricing.perDelivery, suffix: payMode === "upfront" ? "" : "/delivery", saved: payMode === "upfront" ? pricing.upfrontSaved : pricing.perDeliverySaved, ...(payMode === "upfront" ? { perDelivery: pricing.perDelivery } : {}), estimate: { nextCharge: payMode === "upfront" ? pricing.upfrontTotal : pricing.perDelivery, frequency }, pinValid: /^\d{6}$/.test(pincode) });
  }, [payMode, frequency, onSelectionChange, pricing, pincode]);

  return (
    <AOBThemeCtx.Provider value={C}>
    <AOBShapeCtx.Provider value={shapeCtx}>
      <AOBStyles />
      <style>{`
        @keyframes ip-fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ip-freebie-enter { animation: ip-fadeIn 0.22s ease; }
      `}</style>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, fontFamily: FONT, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <div className="variant-dropdown-row freq-picker-row" style={{ marginBottom: 0 }}>
          <div className="variant-block variant-block-half">
            <div className="variant-label">How Often</div>
            <select className="variant-select" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              {SMW_FREQ_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="variant-block variant-block-half">
            <div className="variant-label">How Many</div>
            <select className="variant-select" value={deliveries} onChange={(e) => setDeliveries(e.target.value)}>
              {SMW_DELIVERY_OPTS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <PayToggle mode={payMode} onChange={setPayMode} />

        {(() => {
          const freebieCount = payMode === "upfront" ? 6 : 4;
          return freebieCount > 0 && <WelcomeGiftBlock key={payMode} items={WELCOME_GIFT_ITEMS.slice(0, freebieCount)} />;
        })()}

        <GiftSlot onOpenChange={setGiftOpen} />

        <div className="divider-line" />

        <div className="wp-ship-row">
          {!giftOpen && <PincodeInline pincode={pincode} shipType={shipType} error={pinError} shakeKey={shakeCount} onOpen={() => setPopup("pincode")} />}
          <button type="button" className="wp-summary-capsule" style={giftOpen ? { flex: 1, justifyContent: "space-between" } : undefined} onClick={() => setPopup("summary")}>
            Pricing summary <ChevronRight size={13} />
          </button>
        </div>

        <WidgetSubscribeCTA price={payMode === "upfront" ? pricing.upfrontTotal : pricing.perDelivery} suffix={payMode === "upfront" ? "" : "/delivery"} saved={payMode === "upfront" ? pricing.upfrontSaved : pricing.perDeliverySaved} perDelivery={null} blocked={!pinOk} onBlocked={triggerPinError} style={{ marginTop: -6 }} />

        {popup === "pincode" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={440}>
            {(close) => (
              <PincodePopup pincode={pincode} shipType={shipType} onApply={({ pincode: p, shipType: t }) => { setPincode(p); setShipType(t); setPinError(false); close(); }} onClose={close} />
            )}
          </Backdrop>
        )}
        {popup === "summary" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={380}>
            {(close) => (
              <PriceSummaryPopup pricing={pricing} perDelivery={pricing.perDelivery} term={pricing.term} onClose={close} />
            )}
          </Backdrop>
        )}
        {popup === "how" && (
          <Backdrop onClose={() => setPopup(null)}>{(close) => <HowSubscriptionsPopup onClose={close} />}</Backdrop>
        )}
        {popup === "pricing" && (
          <Backdrop onClose={() => setPopup(null)}>{(close) => <PricingPopup rows={[{ l: "Plan price", v: inr(pricing.upfrontTotal + pricing.upfrontSaved) }, { l: "Discount", v: "- " + inr(pricing.upfrontSaved), accent: true }, { l: "You pay", v: inr(pricing.upfrontTotal) }]} onClose={close} />}</Backdrop>
        )}
      </div>
    </AOBShapeCtx.Provider>
    </AOBThemeCtx.Provider>
  );
}

function SubscriptionOption2({ brand = BRAND, shape, surface, onSelectionChange, showOneTime = true, pricing = DEFAULT_PRICING, pinErrorSignal = 0, endless = true }) {
  const C = useMemo(() => makeC(buildTokens(brand)), [brand]);
  const shapeCtx = useMemo(() => buildShapeCtx(shape, surface), [shape, surface]);

  const [scheduleId, setScheduleId] = useState("4w");
  const [payMode, setPayMode] = useState("upfront");
  const [popup, setPopup] = useState(null);
  const [pincode, setPincode] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);   // the gift card is open: the pincode steps aside and the pricing summary takes the full row
  const [pinError, setPinError] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const pinOk = /^\d{6}$/.test(pincode);
  const triggerPinError = () => { setPinError(true); setShakeCount((n) => n + 1); };
  useEffect(() => { if (pinErrorSignal > 0 && !pinOk) triggerPinError(); }, [pinErrorSignal]);
  useEffect(() => { if (endless && payMode === "upfront") setPayMode("perDelivery"); }, [endless, payMode]);
  const [shipType, setShipType] = useState(null);
  const shipTypeLabel = (SHIPPING_TYPES.find((s) => s.id === shipType) || SHIPPING_TYPES[0]).label;
  useEffect(() => {
    if (!onSelectionChange) return;
    const sched2 = SCHEDULES.find((s) => s.id === scheduleId);
    onSelectionChange({ label: "Subscribe", payType: payMode === "upfront" ? "upfront" : payMode, price: payMode === "upfront" ? pricing.upfrontTotal : pricing.perDelivery, suffix: payMode === "upfront" ? "" : "/delivery", saved: payMode === "upfront" ? pricing.upfrontSaved : pricing.perDeliverySaved, ...(payMode === "upfront" ? { perDelivery: pricing.perDelivery } : {}), estimate: { nextCharge: payMode === "upfront" ? pricing.upfrontTotal : pricing.perDelivery, frequency: sched2 ? sched2.sub : "Every Month" }, pinValid: /^\d{6}$/.test(pincode) });
  }, [payMode, scheduleId, onSelectionChange, pricing, pincode]);

  return (
    <AOBThemeCtx.Provider value={C}>
    <AOBShapeCtx.Provider value={shapeCtx}>
      <AOBStyles />
      <style>{`
        @keyframes ip-fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ip-freebie-enter { animation: ip-fadeIn 0.22s ease; }
      `}</style>
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14, fontFamily: FONT, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
          {GRID_ORDER.map((id) => {
            const sched = SCHEDULES.find((s) => s.id === id);
            return (
              <div key={id} onClick={() => setScheduleId(id)} style={{ display: "flex" }}>
                <ScheduleCard sched={sched} badge={BADGES_GRID[id]} off="30% OFF" selected={scheduleId === id} endless={endless} />
              </div>
            );
          })}
        </div>

        <PayToggle mode={payMode} onChange={setPayMode} hideUpfront={endless} />

        {(() => {
          const freebieCount = { "4w": 1, "3m": 4, "6m": 6, "4d": 0 }[scheduleId] || 0;
          return freebieCount > 0 && <WelcomeGiftBlock key={scheduleId} items={WELCOME_GIFT_ITEMS.slice(0, freebieCount)} />;
        })()}

        <GiftSlot onOpenChange={setGiftOpen} />

        <div className="divider-line" />

        <div className="wp-ship-row">
          {!giftOpen && <PincodeInline pincode={pincode} shipType={shipType} error={pinError} shakeKey={shakeCount} onOpen={() => setPopup("pincode")} />}
          <button type="button" className="wp-summary-capsule" style={giftOpen ? { flex: 1, justifyContent: "space-between" } : undefined} onClick={() => setPopup("summary")}>
            Pricing summary <ChevronRight size={13} />
          </button>
        </div>

        <WidgetSubscribeCTA price={payMode === "upfront" ? pricing.upfrontTotal : pricing.perDelivery} suffix={payMode === "upfront" ? "" : "/delivery"} saved={payMode === "upfront" ? pricing.upfrontSaved : pricing.perDeliverySaved} perDelivery={null} blocked={!pinOk} onBlocked={triggerPinError} style={{ marginTop: -6 }} />

        {popup === "pincode" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={440}>
            {(close) => (
              <PincodePopup pincode={pincode} shipType={shipType} onApply={({ pincode: p, shipType: t }) => { setPincode(p); setShipType(t); setPinError(false); close(); }} onClose={close} />
            )}
          </Backdrop>
        )}
        {popup === "summary" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={380}>
            {(close) => (
              <PriceSummaryPopup pricing={pricing} perDelivery={pricing.perDelivery} term={pricing.term} onClose={close} />
            )}
          </Backdrop>
        )}
        {popup === "how" && (
          <Backdrop onClose={() => setPopup(null)}>{(close) => <HowSubscriptionsPopup onClose={close} />}</Backdrop>
        )}
        {popup === "pricing" && (
          <Backdrop onClose={() => setPopup(null)}>{(close) => <PricingPopup rows={[{ l: "Plan price", v: inr(pricing.upfrontTotal + pricing.upfrontSaved) }, { l: "Discount", v: "- " + inr(pricing.upfrontSaved), accent: true }, { l: "You pay", v: inr(pricing.upfrontTotal) }]} onClose={close} />}</Backdrop>
        )}
      </div>
    </AOBShapeCtx.Provider>
    </AOBThemeCtx.Provider>
  );
}

function SubscriptionOptionIntl({ brand = BRAND, shape, surface, onSelectionChange, showOneTime = true, pricing = DEFAULT_PRICING, pinErrorSignal = 0, endless = true }) {
  const C = useMemo(() => makeC(buildTokens(brand)), [brand]);
  const shapeCtx = useMemo(() => buildShapeCtx(shape, surface), [shape, surface]);
  const { sh, shadowMode, noneMode, S } = shapeCtx;
  const [selected, setSelected] = useState("upfront");
  const [milestonesOpen, setMilestonesOpen] = useState(true);
  const [popup, setPopup] = useState(null);
  const [pincode, setPincode] = useState("");
  const [giftOpen, setGiftOpen] = useState(false);   // the gift card is open: the pincode steps aside and the pricing summary takes the full row
  const [pinError, setPinError] = useState(false);
  const [shakeCount, setShakeCount] = useState(0);
  const pinOk = /^\d{6}$/.test(pincode);
  const triggerPinError = () => { setPinError(true); setShakeCount((n) => n + 1); };
  useEffect(() => { if (pinErrorSignal > 0 && !pinOk) triggerPinError(); }, [pinErrorSignal]);
  useEffect(() => { if (endless && selected === "upfront") setSelected("perdelivery"); }, [endless, selected]);
  const [shipType, setShipType] = useState(null);
  const shipTypeLabel = (SHIPPING_TYPES.find((s) => s.id === shipType) || SHIPPING_TYPES[0]).label;
  // per-plan prices for THIS widget, derived from the quantity-based pricing
  const planPrice = (id) => {
    if (id === "upfront")     return { total: pricing.upfrontTotal, perDelivery: pricing.perDelivery, save: pricing.upfrontSaved };
    if (id === "perdelivery") return { perDelivery: pricing.perDelivery, save: pricing.perDeliverySaved };
    return { perDelivery: pricing.payg }; // payg
  };
  const activePlan = { ...INTL_PLANS[selected], ...planPrice(selected) };
  useEffect(() => {
    if (!onSelectionChange) return;
    const isUpfront = activePlan.payType === "upfront";
    onSelectionChange({
      label: "Subscribe",
      payType: activePlan.payType,
      price: isUpfront ? activePlan.total : activePlan.perDelivery,
      suffix: isUpfront ? "" : "/delivery",
      saved: activePlan.save || null,
      ...(isUpfront ? { perDelivery: activePlan.perDelivery } : {}),
      estimate: { nextCharge: isUpfront ? activePlan.total : activePlan.perDelivery, frequency: "Every Week" },
      pinValid: /^\d{6}$/.test(pincode),
    });
  }, [selected, activePlan, onSelectionChange, pincode]);

  const cardStyle = (isSelected) => ({
    ...BUTTON_RESET, width: "100%", boxSizing: "border-box", background: C.bg,
    border: shadowMode || noneMode ? "1.5px solid transparent" : `${isSelected ? "1.7px" : "1.5px"} solid ${isSelected ? C.accent : GREY_LIGHT}`,
    boxShadow: shadowMode ? (isSelected ? S.sel : S.unsel) : "none",
    borderRadius: sh.card, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
    transform: isSelected ? "scale(1.03)" : "scale(1)", transformOrigin: "center",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
  });

  const renderCard = (planBase) => {
    const plan = { ...planBase, ...planPrice(planBase.id) };
    const isSelected = selected === plan.id;
    const isUpfront = plan.payType === "upfront";
    return (
      <button key={plan.id} onClick={() => { setSelected(plan.id); setMilestonesOpen(true); }} style={cardStyle(isSelected)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Radio checked={isSelected} size={18} />
            <span style={{ fontSize: 16, fontWeight: isSelected ? 600 : 500, color: isSelected ? C.inkOnTile : C.mutedOnTile }}>
              {plan.duration} <span style={{ fontSize: 22, lineHeight: 0, verticalAlign: "middle", color: C.accent, margin: "0 2px" }}>&middot;</span> <span style={{ color: C.accent, fontWeight: 600 }}>{plan.payLabel}</span>
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="sb-pulse-text" style={{ background: C.primary, color: C.onBar, borderRadius: sh.pill, padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{plan.valueTag}</span>
            {plan.discountTag && <span style={{ background: C.accent, color: C.onAccent, borderRadius: sh.pill, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{plan.discountTag}</span>}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: C.inkOnTile }}>{inr(isUpfront ? plan.total : plan.perDelivery)}</span>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.mutedOnTile }}>{isUpfront ? "total" : "/ delivery"}</span>
            {plan.save && <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Save {inr(plan.save)}</span>}
          </span>
        </div>

        {isSelected && (
          <>
            <div style={{ height: 1, width: "100%", background: GREY_LIGHT }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, color: C.mutedOnTile }}>Delivered <span style={{ fontWeight: 600, color: C.inkOnTile }}>{endless ? plan.freq : `${plan.freq} for ${plan.deliveries} deliveries`}</span></p>
                <p style={{ margin: 0, fontSize: 13, color: C.accent, fontWeight: 500 }}>{plan.note}</p>
              </div>
              {isUpfront && (
                <span className="sb-pulse-text" style={{ background: C.primary, color: C.onBar, borderRadius: sh.pill, padding: "4px 12px", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 }}><b>{inr(plan.perDelivery)}</b>/ delivery</span>
              )}
            </div>
          </>
        )}
      </button>
    );
  };

  return (
    <AOBThemeCtx.Provider value={C}>
    <AOBShapeCtx.Provider value={shapeCtx}>
      <AOBStyles />
      <style>{`
        @keyframes ip-fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .ip-freebie-enter { animation: ip-fadeIn 0.25s ease; }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT, width: "100%", maxWidth: "100%", boxSizing: "border-box", position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%" }}>
          {INTL_PLAN_ORDER.filter((id) => !(endless && id === "upfront")).map((id) => renderCard(INTL_PLANS[id]))}
        </div>

        {(() => {
          const freebieCount = { upfront: 5, perdelivery: 3, payg: 2 }[selected] || 0;
          return freebieCount > 0 && <WelcomeGiftBlock key={selected} items={WELCOME_GIFT_ITEMS.slice(0, freebieCount)} />;
        })()}

        <GiftSlot onOpenChange={setGiftOpen} />

        <div className="divider-line" />

        <div className="wp-ship-row">
          {!giftOpen && <PincodeInline pincode={pincode} shipType={shipType} error={pinError} shakeKey={shakeCount} onOpen={() => setPopup("pincode")} />}
          <button type="button" className="wp-summary-capsule" style={giftOpen ? { flex: 1, justifyContent: "space-between" } : undefined} onClick={() => setPopup("summary")}>
            Pricing summary <ChevronRight size={13} />
          </button>
        </div>

        <WidgetSubscribeCTA
          price={activePlan.payType === "upfront" ? activePlan.total : activePlan.perDelivery}
          suffix={activePlan.payType === "upfront" ? "" : "/delivery"}
          saved={activePlan.save || null}
          perDelivery={null}
          blocked={!pinOk}
          onBlocked={triggerPinError}
          style={{ marginTop: -6 }}
        />

        {popup === "pincode" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={440}>
            {(close) => (
              <PincodePopup pincode={pincode} shipType={shipType} onApply={({ pincode: p, shipType: t }) => { setPincode(p); setShipType(t); setPinError(false); close(); }} onClose={close} />
            )}
          </Backdrop>
        )}
        {popup === "summary" && (
          <Backdrop onClose={() => setPopup(null)} maxWidth={380}>
            {(close) => (
              <PriceSummaryPopup pricing={pricing} perDelivery={pricing.perDelivery} term={pricing.term} onClose={close} />
            )}
          </Backdrop>
        )}
      </div>
    </AOBShapeCtx.Provider>
    </AOBThemeCtx.Provider>
  );
}

// ---------- main component ----------

/* =====================================================================
   Gift it to someone — from Diwali_Freebies.jsx (the 7 gift styles). Every class is scoped under .gw, every helper is prefixed Gw, so nothing clashes with this page.
   Set from Settings → Gift it to someone; it sits above the pincode and the main CTA in the widgets. ===================================================================== */
const GW_CSS = `.gw{
  --page:#F6ECE2; --page-text:#3A1530; --page-muted:#7D5A6E;
  --plum:#3B0F2E; --night:#24091C; --rani:#C81F65;
  --marigold:#F7A41D; --saffron:#FF7A1A;
  --brass-1:#F6DB8C; --brass-2:#D9A93E; --brass-3:#9E6A1C;
  --paper:#FFF8EA; --ink:#2B1220; --ink-muted:#7A5B67;
  --display:"Rozha One", "Georgia", serif;
  --body:"Hind", "Segoe UI", system-ui, sans-serif;
  --satin:repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px),
    linear-gradient(118deg,transparent 6%,rgba(255,110,100,.26) 16%,rgba(255,150,140,.12) 22%,transparent 30%,rgba(35,0,4,.48) 42%,transparent 52%,rgba(255,105,95,.22) 63%,transparent 71%,rgba(35,0,4,.38) 83%,transparent 93%),
    radial-gradient(70% 60% at 14% 28%,rgba(232,74,74,.38),transparent 62%),
    radial-gradient(90% 80% at 96% 112%,rgba(30,0,3,.6),transparent 60%),
    linear-gradient(155deg,#A8161F 0%,#8C0F19 35%,#6B0911 65%,#42040A 100%);
}
.gw,.gw *,.gw *::before,.gw *::after{ box-sizing:border-box; }
.gw .spark{ position:absolute; width:8px; height:8px; border-radius:50%; pointer-events:none; z-index:10; animation:gw-spark 1s cubic-bezier(.15,.7,.3,1) forwards; }
.gw .spark.star{ border-radius:0; clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%); width:12px; height:12px; }
@keyframes gw-spark{ 0%{ transform:translate(0,0) scale(1); opacity:1; } 100%{ transform:translate(var(--dx),var(--dy)) scale(.2); opacity:0; } }
.gw{ position:relative; width:100%; max-width:100%; }
.gw-stage{ position:relative; height:208px; border-radius:16px; overflow:hidden;
  box-shadow:0 18px 30px -16px rgba(40,5,25,.6); transform-origin:50% 60%; outline-offset:6px; }
.gw.closed .gw-stage{ cursor:pointer; animation:gw-shake 2.4s ease-in-out infinite; }
.gw.noshake .gw-stage{ animation:none; }
.gw .face-t{ display:block; font-family:var(--display); font-weight:400; font-size:23px; line-height:1.12; }
.gw .face-s{ display:block; font-size:13px; line-height:1.4; opacity:.85; margin-top:4px; }
.gw .chip{ display:inline-block; margin-top:12px; padding:5px 12px; border:1px solid currentColor; border-radius:99px; font-size:12px; font-weight:600; }
.gw-card{ position:absolute; inset:0; z-index:1; visibility:hidden; transition:visibility 0s .7s;
  display:flex; flex-direction:column; padding:14px 18px 16px; border-radius:16px; color:var(--ink); text-align:left;
  font-family:var(--body); background:#FFFCF7; box-shadow:inset 0 0 0 1px rgba(59,15,46,.08); }
.gw.p1 .gw-card{ visibility:visible; transition-delay:0s; }
.gw-head{ display:flex; align-items:center; gap:8px; height:22px; margin-bottom:12px; padding-right:34px; }
.gw-head svg{ flex:none; }
.gw-title{ margin:0; font:600 16px/1 var(--body); letter-spacing:-.005em; color:var(--plum); white-space:nowrap; }
.gw-x{ position:absolute; top:9px; right:10px; z-index:2; width:30px; height:30px; border:0; border-radius:50%; cursor:pointer;
  display:grid; place-items:center; background:transparent; color:rgba(59,15,46,.55); transition:background .15s, color .15s; }
.gw-x:hover{ background:rgba(59,15,46,.06); color:var(--plum); }
.gw-row{ display:grid; grid-template-columns:1fr 1.1fr; gap:8px; margin-bottom:8px; }
.gw-field{ position:relative; display:block; min-width:0; }
.gw-field input{ width:100%; height:40px; padding:0 12px; font:500 14px/1 var(--body); color:var(--ink); background:#F6EFE8;
  border:1px solid transparent; border-radius:10px; outline:none; transition:background .15s, border-color .15s, box-shadow .15s; }
.gw-field input::placeholder{ color:#9C8891; font-weight:400; }
.gw-field input:hover{ background:#F2E9E0; }
.gw-field input:focus{ background:#fff; border-color:rgba(138,28,74,.55); box-shadow:0 0 0 3px rgba(138,28,74,.08); }
.gw-field .pre{ position:absolute; left:12px; top:50%; transform:translateY(-50%); font:500 14px/1 var(--body); color:#7A6570;
  padding-right:9px; border-right:1px solid rgba(59,15,46,.15); pointer-events:none; }
.gw-field .pre + input{ padding-left:52px; }
.gw-field.addr{ margin-bottom:12px; }
.gw-field em{ position:absolute; right:12px; top:50%; transform:translateY(-50%); font:600 11.5px/1 var(--body); font-style:normal;
  color:#B3174F; background:#FFF6F8; padding:3px 0 3px 8px; box-shadow:-6px 0 6px #FFF6F8; pointer-events:none; }
.gw-field em:empty{ display:none; }
.gw-field.err input{ border-color:rgba(179,23,79,.6); background:#FFF6F8; animation:gw-nudge .3s; }
@keyframes gw-nudge{ 25%{ transform:translateX(-3px); } 75%{ transform:translateX(3px); } }
.gw-cta{ width:100%; height:42px; border:0; border-radius:10px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;
  font:600 14.5px/1 var(--body); letter-spacing:.01em; color:#fff;
  background:linear-gradient(118deg,rgba(255,140,130,.18) 0%,transparent 35%,rgba(35,0,4,.2) 70%,transparent 100%), linear-gradient(155deg,#A8161F 0%,#8C0F19 50%,#6B0911 100%);
  box-shadow:inset 0 1px 0 rgba(255,170,160,.3);
  transition:filter .15s, transform .1s; }
.gw-cta svg{ transition:transform .2s; }
.gw-cta:hover{ filter:brightness(.9); }
.gw-cta:hover svg{ transform:translateX(3px); }
.gw-cta:active{ transform:scale(.99); }
.gw-card.sent .gw-head,.gw-card.sent .gw-form{ display:none; }
.gw-done{ flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; min-width:0; }
.gw-done[hidden]{ display:none; }
.gw-medal{ width:42px; height:42px; margin-bottom:10px; border-radius:50%; display:grid; place-items:center;
  background:#F7E7C4; animation:gw-pop2 .45s cubic-bezier(.2,1.5,.4,1); }
@keyframes gw-pop2{ from{ transform:scale(0); } }
.gw-done .gw-title{ font-size:17px; max-width:100%; overflow:hidden; text-overflow:ellipsis; padding:0 30px; line-height:1.2; }
.gw-done p{ margin:6px 0 0; font-size:13px; line-height:1.45; color:var(--ink-muted); }
.gw-done .reset{ margin:0; color:#8A1C4A; font-size:13.5px; }
.gw-done-acts{ display:flex; gap:18px; justify-content:center; margin-top:8px; }
.gw .env-back{ position:absolute; inset:0; background:linear-gradient(180deg,#2A0306,#4A060C); transition:opacity .4s, transform .45s; }
.gw[data-v="env"] .gw-card{ z-index:2; transform:translateY(64%) scale(.84); box-shadow:inset 0 0 0 1px rgba(59,15,46,.08), 0 -6px 16px rgba(30,0,10,.35);
  transition:transform .5s cubic-bezier(.3,.8,.3,1), visibility 0s .7s; }
.gw.p1[data-v="env"] .gw-card{ transition:transform .5s cubic-bezier(.3,.8,.3,1), visibility 0s 0s; }
.gw.p2[data-v="env"] .gw-card{ transform:translateY(7%) scale(.84); }
.gw.p3[data-v="env"] .gw-card{ transform:none; }
.gw .env-pocket{ position:absolute; inset:0; z-index:3; width:100%; height:100%; display:block; transition:opacity .4s, transform .45s; }
.gw .env-flap{ position:absolute; top:0; left:0; width:100%; height:124px; z-index:4; display:block; transform-origin:50% 0;
  filter:drop-shadow(0 4px 5px rgba(30,0,10,.35)); backface-visibility:hidden; -webkit-backface-visibility:hidden;
  transform:perspective(700px) rotateX(0); transition:transform .45s cubic-bezier(.5,0,.4,1); }
.gw.p1 .env-flap{ transform:perspective(700px) rotateX(120deg); }
.gw .env-seal{ position:absolute; left:50%; top:94px; width:44px; height:44px; margin-left:-22px; z-index:5; border-radius:50%;
  display:grid; place-items:center; background:radial-gradient(circle at 35% 30%,#E8B85C,#C9962F 55%,#8E6214);
  box-shadow:0 3px 6px rgba(0,0,0,.35), inset 0 -3px 5px rgba(0,0,0,.25), inset 0 0 0 3px rgba(255,240,200,.25); transition:transform .25s, opacity .25s; }
.gw .env-text{ position:absolute; left:0; right:0; bottom:16px; z-index:5; text-align:center; color:#F6DFC0; transition:opacity .25s; }
.gw .env-text .face-t{ font-size:20px; }
.gw .env-text .face-s{ font-size:12px; margin-top:2px; }
.gw.p1 .env-seal{ transform:scale(.3) rotate(40deg); opacity:0; }
.gw.p1 .env-text{ opacity:0; }
.gw.p3 .env-back,.gw.p3 .env-pocket{ opacity:0; transform:translateY(26px); }
.gw .pk-main,.gw .pk-fold,.gw .fl-shape{ position:absolute; inset:0; background:var(--satin); }
.gw .pk-main{ clip-path:polygon(0 19.2%,50% 50%,100% 19.2%,100% 100%,0 100%); }
.gw .pk-fold{ clip-path:polygon(0 100%,50% 57.7%,100% 100%); background:linear-gradient(180deg,rgba(30,0,3,.28),rgba(30,0,3,.12)), var(--satin); }
.gw .pk-edge{ position:absolute; inset:0; width:100%; height:100%; }
.gw .fl-shape{ clip-path:polygon(0 0,100% 0,100% 35.5%,53.5% 92%,50% 96.8%,46.5% 92%,0 35.5%);
  background:linear-gradient(180deg,rgba(255,130,120,.14),rgba(30,0,3,.18)), var(--satin); }
.gw .book-cover{ position:absolute; inset:0; z-index:3; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;
  color:#F3D27A; padding:0 24px;
  background:var(--satin);
  transform-origin:0 50%; transform:perspective(1200px) rotateY(0); backface-visibility:hidden; -webkit-backface-visibility:hidden;
  transition:transform .8s cubic-bezier(.65,0,.35,1); }
.gw .book-cover::before{ content:""; position:absolute; inset:10px; border:1px solid rgba(243,210,122,.5); border-radius:10px; pointer-events:none; }
.gw .book-cover::after{ content:""; position:absolute; left:0; top:0; bottom:0; width:16px; background:linear-gradient(90deg,rgba(0,0,0,.35),transparent); }
.gw .book-emblem{ width:48px; height:48px; border-radius:50%; display:grid; place-items:center; border:1.5px solid rgba(243,210,122,.7); margin-bottom:10px; }
.gw .orn{ position:relative; width:72px; height:8px; margin:8px auto 0; color:rgba(243,210,122,.7);
  background:linear-gradient(currentColor,currentColor) left center/28px 1px no-repeat, linear-gradient(currentColor,currentColor) right center/28px 1px no-repeat; }
.gw .orn::after{ content:""; position:absolute; left:50%; top:50%; width:6px; height:6px; margin:-3px 0 0 -3px; background:currentColor; transform:rotate(45deg); }
.gw.p1 .book-cover{ transform:perspective(1200px) rotateY(-100deg); }
.gw[data-v="book"] .gw-card{ transform:scale(.96); transition:transform .6s, visibility 0s .7s; }
.gw.p1[data-v="book"] .gw-card{ transform:none; transition:transform .6s .15s, visibility 0s 0s; }
.gw[data-v="flip"] .gw-stage{ overflow:visible; box-shadow:none; }
.gw .flip-inner{ position:absolute; inset:0; transform-style:preserve-3d; transform:perspective(1400px) rotateY(0); transition:transform .82s cubic-bezier(.65,0,.35,1); }
.gw.p1 .flip-inner{ transform:perspective(1400px) rotateY(180deg); }
.gw .flip-front{ position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden; filter:drop-shadow(0 14px 16px rgba(40,5,25,.35)); }
.gw .flip-ticket{ position:relative; height:100%; border-radius:14px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:8px; padding:0 40px; color:#F6E3C2;
  background:var(--satin);
  -webkit-mask:radial-gradient(circle 10px at 0 50%,#0000 97%,#000) 0 0/51% 26px repeat-y, radial-gradient(circle 10px at 100% 50%,#0000 97%,#000) 100% 0/51% 26px repeat-y;
          mask:radial-gradient(circle 10px at 0 50%,#0000 97%,#000) 0 0/51% 26px repeat-y, radial-gradient(circle 10px at 100% 50%,#0000 97%,#000) 100% 0/51% 26px repeat-y; }
.gw .flip-ticket::before{ content:""; position:absolute; inset:14px 26px; border:1.5px dashed rgba(243,210,122,.45); border-radius:8px; pointer-events:none; }
.gw .flip-ticket svg{ flex:none; }
.gw .flip-ticket .face-s{ margin-top:2px; }
.gw .text-cta{ display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-size:13px; font-weight:600; color:#F3D27A;
  text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:4px; }
.gw .text-cta svg{ transition:transform .2s; }
.gw.closed .gw-stage:hover .text-cta svg{ transform:translateX(3px); }
.gw[data-v="flip"] .gw-card{ backface-visibility:hidden; -webkit-backface-visibility:hidden; transform:rotateY(180deg);
  border-radius:14px; padding:26px 40px; box-shadow:none; background:var(--satin);
  -webkit-mask:radial-gradient(circle 10px at 0 50%,#0000 97%,#000) 0 0/51% 26px repeat-y, radial-gradient(circle 10px at 100% 50%,#0000 97%,#000) 100% 0/51% 26px repeat-y;
          mask:radial-gradient(circle 10px at 0 50%,#0000 97%,#000) 0 0/51% 26px repeat-y, radial-gradient(circle 10px at 100% 50%,#0000 97%,#000) 100% 0/51% 26px repeat-y; }
.gw[data-v="flip"] .gw-card::before{ content:""; position:absolute; inset:14px 26px; z-index:-1; border-radius:8px; pointer-events:none;
  background:#FFFCF7; border:1.5px dashed rgba(201,150,47,.75); box-shadow:0 0 0 4px rgba(255,252,247,.08); }
.gw[data-v="flip"] .gw-x{ top:20px; right:32px; width:26px; height:26px; }
.gw[data-v="flip"] .gw-head{ height:20px; margin-bottom:10px; }
.gw[data-v="flip"] .gw-title{ font-size:15px; }
.gw[data-v="flip"] .gw-row{ margin-bottom:6px; }
.gw[data-v="flip"] .gw-field.addr{ margin-bottom:10px; }
.gw[data-v="flip"] .gw-field input{ height:36px; }
.gw[data-v="flip"] .gw-cta{ height:38px; }
.gw[data-v="flip"] .flip-front{ filter:none; }
.gw .rib-cover{ position:absolute; inset:0; z-index:3; display:flex; align-items:flex-end; padding:0 24px 24px 120px; color:#FFE9B5;
  background:
    repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px),
    linear-gradient(118deg,transparent 6%,rgba(255,110,100,.26) 16%,rgba(255,150,140,.12) 22%,transparent 30%,rgba(35,0,4,.48) 42%,transparent 52%,rgba(255,105,95,.22) 63%,transparent 71%,rgba(35,0,4,.38) 83%,transparent 93%),
    radial-gradient(70% 60% at 14% 28%,rgba(232,74,74,.38),transparent 62%),
    radial-gradient(90% 80% at 96% 112%,rgba(30,0,3,.6),transparent 60%),
    linear-gradient(155deg,#A8161F 0%,#8C0F19 35%,#6B0911 65%,#42040A 100%);
  transition:transform .55s cubic-bezier(.6,0,.3,1); }
.gw .rib-v{ position:absolute; top:0; bottom:0; left:64px; width:18px; transform-origin:50% 0; transition:transform .4s;
  background:linear-gradient(180deg,transparent 0%,rgba(255,250,230,.28) 22%,transparent 40%,rgba(70,40,0,.18) 70%,transparent 100%),
    linear-gradient(90deg,#9E6A1C 0%,#D9A93E 16%,#FFF1BF 40%,#F3D27A 52%,#C9962F 74%,#8E6214 100%);
  box-shadow:inset 1px 0 0 #8E6214, inset -1px 0 0 #8E6214, inset 2px 0 0 rgba(255,241,191,.45), inset -2px 0 0 rgba(255,241,191,.22), 2px 0 5px rgba(30,0,3,.4), -2px 0 5px rgba(30,0,3,.3); }
.gw .rib-h{ position:absolute; left:0; right:0; top:44px; height:18px; transform-origin:100% 50%; transition:transform .4s;
  background:linear-gradient(90deg,transparent 0%,rgba(255,250,230,.3) 18%,transparent 34%,rgba(70,40,0,.16) 58%,transparent 72%,rgba(255,250,230,.22) 88%,transparent 100%),
    linear-gradient(180deg,#9E6A1C 0%,#D9A93E 16%,#FFF1BF 40%,#F3D27A 52%,#C9962F 74%,#8E6214 100%);
  box-shadow:inset 0 1px 0 #8E6214, inset 0 -1px 0 #8E6214, inset 0 2px 0 rgba(255,241,191,.45), inset 0 -2px 0 rgba(255,241,191,.22), 0 3px 6px rgba(30,0,3,.45); }
.gw .rib-bow{ position:absolute; left:28px; top:17px; width:90px; height:72px; z-index:2; overflow:visible; filter:drop-shadow(0 5px 5px rgba(30,0,3,.5)) drop-shadow(0 1px 1px rgba(30,0,3,.35)); transition:transform .35s, opacity .3s; }
.gw.p1 .rib-bow{ transform:translateY(-30px) rotate(120deg) scale(.3); opacity:0; }
.gw.p1 .rib-v{ transform:scaleY(0); }
.gw.p1 .rib-h{ transform:scaleX(0); }
.gw.p2 .rib-cover{ transform:translateY(-102%); }
.gw[data-v="voucher"] .gw-stage{ overflow:visible; box-shadow:none; }
.gw .vf-shadow{ position:absolute; left:18px; right:18px; bottom:-8px; height:36px; border-radius:50%; background:rgba(40,5,25,.5); filter:blur(14px); }
.gw .vf-inner{ position:absolute; inset:0; transform-style:preserve-3d; transform:perspective(1300px) rotateX(0);
  transition:transform .9s cubic-bezier(.65,0,.35,1); }
.gw.p2 .vf-inner{ transform:perspective(1300px) rotateX(-180deg); }
.gw .vf-front{ position:absolute; inset:0; border-radius:16px; overflow:hidden; backface-visibility:hidden; -webkit-backface-visibility:hidden;
  background:var(--satin);
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
.gw .vf-front > svg{ position:absolute; inset:0; width:100%; height:100%; }
.gw .vf-line{ fill:none; stroke:#F2B6BE; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round;
  stroke-dasharray:1; stroke-dashoffset:0; transition:stroke-dashoffset .42s cubic-bezier(.55,0,.75,.4);
  animation:gw-draw 1.8s cubic-bezier(.6,0,.3,1) .25s backwards; }
@keyframes gw-draw{ from{ stroke-dashoffset:1; } }
.gw.p1 .vf-line{ stroke-dashoffset:1; }
.gw:not(.p1) .vf-line{ transition-timing-function:cubic-bezier(.3,.6,.45,1); }
.gw .vf-text{ position:absolute; left:34px; top:74px; color:#FFFFFF; }
.gw .vf-text b{ display:block; font:400 36px/1.05 "Italiana", "Didot", "Bodoni 72", Georgia, serif; letter-spacing:.06em; }
.gw .vf-text small{ display:flex; align-items:center; gap:7px; margin-top:12px; font-size:12.5px; color:rgba(255,255,255,.85); }
.gw[data-v="voucher"] .gw-card{ backface-visibility:hidden; -webkit-backface-visibility:hidden; transform:rotateX(180deg); }
.gw.p2 .vf-front{ pointer-events:none; }
.gw[data-v="stub"] .gw-stage{ height:156px; overflow:visible; box-shadow:none; }
.gw.attract:not(.noshake) .gw-stage{ animation:gw-shake 2.4s ease-in-out infinite; }
.gw .tk{ position:absolute; inset:0; display:flex; }
.gw .tk-stub,.gw .tk-main{ position:relative; height:100%; filter:drop-shadow(0 12px 14px rgba(40,5,25,.35));
  transition:transform .7s cubic-bezier(.34,1.35,.5,1); }
.gw .tk-stub{ width:112px; flex:none; transform-origin:0 100%; }
.gw .tk-main{ flex:1; transform-origin:100% 50%; }
.gw .tk-skin{ position:absolute; inset:0; background:var(--satin); }
.gw .tk-stub .tk-skin{ border-radius:12px 0 0 12px;
  -webkit-mask:radial-gradient(circle 8px at 0 50%,#0000 97%,#000) 0 0/100% 26px repeat-y, radial-gradient(circle 12px at 100% 0,#0000 97%,#000) 0 0/100% 100% no-repeat, radial-gradient(circle 12px at 100% 100%,#0000 97%,#000) 0 0/100% 100% no-repeat;
  -webkit-mask-composite:source-in; mask:radial-gradient(circle 8px at 0 50%,#0000 97%,#000) 0 0/100% 26px repeat-y, radial-gradient(circle 12px at 100% 0,#0000 97%,#000) 0 0/100% 100% no-repeat, radial-gradient(circle 12px at 100% 100%,#0000 97%,#000) 0 0/100% 100% no-repeat; mask-composite:intersect; }
.gw .tk-main .tk-skin{ border-radius:0 12px 12px 0;
  -webkit-mask:radial-gradient(circle 8px at 100% 50%,#0000 97%,#000) 0 0/100% 26px repeat-y, radial-gradient(circle 12px at 0 0,#0000 97%,#000) 0 0/100% 100% no-repeat, radial-gradient(circle 12px at 0 100%,#0000 97%,#000) 0 0/100% 100% no-repeat;
  -webkit-mask-composite:source-in; mask:radial-gradient(circle 8px at 100% 50%,#0000 97%,#000) 0 0/100% 26px repeat-y, radial-gradient(circle 12px at 0 0,#0000 97%,#000) 0 0/100% 100% no-repeat, radial-gradient(circle 12px at 0 100%,#0000 97%,#000) 0 0/100% 100% no-repeat; mask-composite:intersect; }
.gw .tk-in{ position:absolute; top:10px; bottom:10px; background:#FFFCF7; border-radius:3px;
  -webkit-mask:radial-gradient(circle 7px at 0 0,#0000 97%,#000), radial-gradient(circle 7px at 100% 0,#0000 97%,#000), radial-gradient(circle 7px at 0 100%,#0000 97%,#000), radial-gradient(circle 7px at 100% 100%,#0000 97%,#000);
  -webkit-mask-composite:source-in; mask:radial-gradient(circle 7px at 0 0,#0000 97%,#000), radial-gradient(circle 7px at 100% 0,#0000 97%,#000), radial-gradient(circle 7px at 0 100%,#0000 97%,#000), radial-gradient(circle 7px at 100% 100%,#0000 97%,#000); mask-composite:intersect; }
.gw .tk-stub .tk-in{ left:16px; right:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; text-align:center; padding:0 6px; }
.gw .tk-main .tk-in{ left:10px; right:16px; }
.gw .tk-vs{ display:grid; }
.gw .tk-v{ grid-area:1/1; transition:opacity .35s; }
.gw .tk-v b{ display:block; font:400 20px/1.05 var(--display); color:#8A1C4A; }
.gw .tk-v span{ display:block; margin-top:4px; font-size:11.5px; line-height:1.3; color:var(--ink-muted); }
.gw .tk-v.b{ opacity:0; }
.gw.torn .tk-v.a{ opacity:0; }
.gw.torn .tk-v.b{ opacity:1; transition-delay:.25s; }
.gw .tk-perf{ position:absolute; left:-1px; top:13px; bottom:13px; z-index:2; border-left:2px dashed rgba(243,210,122,.65); }
.gw.torn .tk-stub{ transform:translate(-18px,10px) rotate(-7deg); }
.gw.torn .tk-main{ transform:translateX(4px) rotate(.6deg); }
.gw[data-v="stub"] .gw-card{ position:absolute; inset:0; visibility:visible; padding:11px 12px; background:transparent; box-shadow:none; border-radius:0; justify-content:center; }
.gw[data-v="stub"] .gw-x{ display:none; }
.gw[data-v="stub"] .gw-head{ display:none; }
.gw[data-v="stub"] .gw-row{ gap:6px; margin-bottom:6px; }
.gw[data-v="stub"] .gw-field input{ height:32px; padding:0 10px; font-size:13.5px; border-radius:8px; }
.gw[data-v="stub"] .gw-field .pre{ left:10px; font-size:13.5px; }
.gw[data-v="stub"] .gw-field .pre + input{ padding-left:46px; }
.gw[data-v="stub"] .gw-field.addr{ margin-bottom:8px; }
.gw[data-v="stub"] .gw-cta{ height:34px; font-size:14px; border-radius:8px; }
.gw[data-v="stub"] .gw-medal{ display:none; }
.gw[data-v="stub"] .gw-done .gw-title{ font-size:16px; padding:0; }
.gw[data-v="stub"] .gw-done p{ font-size:12px; }
.gw[data-v="stub"] .gw-done br{ display:none; }
.gw .face-sent{ display:none; }
.gw.gifted .face-copy{ display:none; }
.gw.gifted .face-sent{ display:block; animation:gw-sentIn .5s cubic-bezier(.3,.8,.3,1); }
@keyframes gw-sentIn{ from{ opacity:0; transform:translateY(6px); } }
.gw.gifted .gw-stage{ animation:none; cursor:default; }
.gw .face-acts{ display:inline-flex; align-items:center; gap:10px; margin-top:10px; font-size:13px; }
.gw .face-acts button{ border:0; background:none; padding:2px 0; cursor:pointer; color:inherit; font:600 13px/1.2 var(--body);
  text-decoration:underline; text-decoration-thickness:1px; text-underline-offset:3px; transition:opacity .15s; }
.gw .face-acts button:hover{ opacity:.75; }
.gw .sent-k{ display:block; font-size:12.5px; letter-spacing:.02em; opacity:.85; margin-bottom:2px; }
.gw .sent-t{ display:block !important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:var(--sent-max,320px); margin:0 auto; font-size:24px !important; line-height:1.15 !important; padding-bottom:2px; }
.gw .env-text .sent-k{ display:inline; font:400 17px/1.2 var(--display); opacity:1; }
.gw .env-text .sent-t{ display:inline-block !important; vertical-align:bottom; font-size:17px !important; line-height:1.2 !important; --sent-max:190px; margin:0; padding:0; }
.gw .env-text .face-acts{ margin-top:6px; }
.gw-done-acts .reset{ white-space:nowrap; }
.gw[data-v="stub"] .gw-done-acts{ gap:14px; }
.gw[data-v="stub"] .gw-done-acts .reset{ font-size:12.5px; }
.gw .rib-cover .sent-t{ --sent-max:250px; margin:0; }
.gw .flip-ticket .sent-t{ --sent-max:290px; }
.gw .vf-text .face-sent{ max-width:262px; }
.gw .vf-text .sent-t{ font:400 32px/1.1 "Italiana", Georgia, serif !important; letter-spacing:.03em; --sent-max:262px; margin:0; }
.gw .slv .face-acts{ color:#F3D27A; }
.gw[data-v="sleeve"] .gw-stage{ box-shadow:none; }
.gw .slv-peek{ position:absolute; top:0; left:28px; right:28px; height:70px; z-index:2; border-radius:10px 10px 0 0; text-align:center;
  background:repeating-linear-gradient(135deg,rgba(217,169,62,.12) 0 6px,transparent 6px 12px), #FFF6E3;
  box-shadow:inset 0 0 0 1.5px rgba(217,169,62,.6); transition:opacity .3s, transform .4s; }
.gw .slv-peek span{ display:block; margin-top:9px; font:600 11px/1 var(--body); letter-spacing:.3em; color:#8A1C4A; }
.gw .slv-wrap{ position:absolute; left:0; right:0; top:28px; bottom:0; z-index:3; filter:drop-shadow(0 14px 16px rgba(40,5,25,.45));
  transition:transform .55s cubic-bezier(.5,0,.3,1); }
.gw .slv{ position:relative; overflow:hidden; height:100%; border-radius:8px 8px 16px 16px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding-top:20px;
  text-align:center; color:#F3D27A;
  background:
    repeating-linear-gradient(118deg,rgba(255,255,255,.018) 0 1px,transparent 1px 4px),
    linear-gradient(118deg,transparent 6%,rgba(255,110,100,.26) 16%,rgba(255,150,140,.12) 22%,transparent 30%,rgba(35,0,4,.48) 42%,transparent 52%,rgba(255,105,95,.22) 63%,transparent 71%,rgba(35,0,4,.38) 83%,transparent 93%),
    radial-gradient(70% 60% at 14% 28%,rgba(232,74,74,.38),transparent 62%),
    radial-gradient(60% 50% at 70% 60%,rgba(214,52,58,.22),transparent 65%),
    radial-gradient(90% 80% at 96% 112%,rgba(30,0,3,.6),transparent 60%),
    linear-gradient(155deg,#A8161F 0%,#8C0F19 35%,#6B0911 65%,#42040A 100%);
  box-shadow:inset 0 1px 0 rgba(255,170,160,.35), inset 0 -14px 26px rgba(30,0,3,.35);
  -webkit-mask:radial-gradient(circle 26px at 50% 0,#0000 97%,#000); mask:radial-gradient(circle 26px at 50% 0,#0000 97%,#000); }
.gw .slv::after{ content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(118deg,transparent 40%,rgba(255,170,160,.2) 48%,rgba(255,215,205,.34) 50%,rgba(255,170,160,.2) 52%,transparent 60%);
  background-size:260% 100%; animation:gw-satinSheen 4.2s ease-in-out infinite; }
@keyframes gw-satinSheen{ 0%{ background-position:140% 0; } 60%,100%{ background-position:-40% 0; } }
.gw .slv > *{ position:relative; z-index:1; }
.gw .slv .face-t{ font-size:22px; margin-top:8px;
  background:linear-gradient(100deg,#C9962F 0%,#FCE7A4 22%,#D9A93E 42%,#FFF4CC 52%,#D9A93E 62%,#F6DB8C 80%,#C9962F 100%);
  background-size:220% 100%; -webkit-background-clip:text; background-clip:text; color:transparent; -webkit-text-fill-color:transparent;
  animation:gw-foil 4.2s ease-in-out infinite; filter:drop-shadow(0 1px 2px rgba(30,0,4,.7)); }
@keyframes gw-foil{ 0%,100%{ background-position:100% 0; } 50%{ background-position:0 0; } }
.gw.p1 .slv-wrap{ transform:translateY(105%); }
.gw[data-v="sleeve"] .gw-card{ visibility:visible; transform-origin:50% 0; transform:scale(.86);
  transition:transform .55s cubic-bezier(.45,0,.25,1) .05s; }
.gw.p1[data-v="sleeve"] .gw-card{ transform:none; transition:transform .55s cubic-bezier(.3,.7,.3,1) .05s; }
.gw[data-v="sleeve"] .gw-card::after{ content:"FOR YOU"; position:absolute; inset:0; z-index:5; border-radius:inherit; pointer-events:none;
  padding-top:9px; text-align:center; font:600 12px/1 var(--body); letter-spacing:.32em; color:#8A1C4A;
  background:repeating-linear-gradient(135deg,rgba(217,169,62,.14) 0 6px,transparent 6px 12px), #FFF6E3;
  box-shadow:inset 0 0 0 1.5px rgba(217,169,62,.65); opacity:1; transition:opacity .22s; }
.gw.p1[data-v="sleeve"] .gw-card::after{ opacity:0; transition:opacity .28s .3s; }
.gw[data-v="sleeve"] .slv-wrap{ transition:transform .55s cubic-bezier(.45,0,.25,1) .12s; }
.gw.p1[data-v="sleeve"] .slv-wrap{ transition:transform .55s cubic-bezier(.5,0,.3,1); }
.gw.p1 .env-flap,.gw.p1 .env-seal,.gw.p1 .env-text,.gw.p3 .env-back,.gw.p3 .env-pocket,.gw.p1 .book-cover,.gw.p1 .flip-front,.gw.p2 .rib-cover,.gw.p1 .slv-wrap,.gw.p1 .slv-peek{ pointer-events:none; }
@media (prefers-reduced-motion: reduce){.gw.closed .gw-stage{ animation:none; }.gw .slv::after,.gw .slv .face-t{ animation:none; }.gw .ticket.shaking,.gw .screen.idle,.gw .fax.printing .fax-body,.gw .screen .flame{ animation:none; }.gw .splash.pop{ animation-duration:.01s; }}
@keyframes gw-shake{
  0%,58%,100%{ transform:rotate(0) translateY(0); }
  61%{ transform:rotate(-3deg) translateY(-2px); } 65%{ transform:rotate(3deg) translateY(-2px); }
  69%{ transform:rotate(-2.5deg); } 73%{ transform:rotate(2deg); } 77%{ transform:rotate(-1.2deg); } 81%{ transform:rotate(.6deg); } 85%{ transform:rotate(0); }
}
/* ===== the gift form, rebuilt for what we ask: name · phone · pincode · city · state · flat · area =====
   The stage is 208px while it is a closed gift; once it opens it grows to --gw-open so every field has room (the closed look and the opening animation of each of the 7 styles are untouched). */
.gw{ --gw-closed:208px; --gw-open:312px; }
.gw[data-v="flip"]{ --gw-open:334px; }
.gw[data-v="stub"]{ --gw-open:276px; }
.gw .gw-stage{ height:var(--gw-closed); transition:height .45s cubic-bezier(.3,.8,.3,1); }
.gw.p1 .gw-stage{ height:var(--gw-open); }
.gw.p1[data-v="env"] .gw-stage, .gw.p2[data-v="env"] .gw-stage{ height:var(--gw-closed); }
.gw.p3[data-v="env"] .gw-stage{ height:var(--gw-open); }
.gw[data-v="stub"] .gw-stage{ height:var(--gw-open); transition:none; }
.gw .gw-form{ display:grid; grid-template-columns:repeat(6, minmax(0, 1fr)); gap:10px 8px; }
.gw .gw-row2, .gw .gw-row3{ display:contents; }
.gw .gw-f-name, .gw .gw-f-phone{ grid-column:span 3; }
.gw .gw-f-pincode, .gw .gw-f-city, .gw .gw-f-state{ grid-column:span 2; }
.gw .gw-f-flat, .gw .gw-f-area{ grid-column:1 / -1; }
.gw .gw-field.gw-fl{ position:relative; display:block; min-width:0; margin:0; }
.gw .gw-field.gw-fl input{ width:100%; height:40px; padding:0 12px; font:500 13.5px/1 var(--body); color:var(--ink); background:transparent; border:1px solid rgba(59,15,46,.24); border-radius:12px; outline:none; transition:border-color .15s, box-shadow .15s; text-overflow:ellipsis; }
.gw .gw-field.gw-fl input::placeholder{ color:transparent; }
.gw .gw-field.gw-fl input:hover{ background:transparent; border-color:rgba(59,15,46,.42); }
.gw .gw-field.gw-fl input:focus{ background:transparent; border-color:#000; box-shadow:0 0 0 1px #000; }
.gw .gw-field.gw-fl > span{ position:absolute; left:12px; top:50%; transform:translateY(-50%); max-width:calc(100% - 24px); padding:0 4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:500 13px/1 var(--body); color:#9C8891; background:#FFFCF7; pointer-events:none; transition:top .14s, font-size .14s, color .14s; }
.gw .gw-field.gw-fl input:focus + span, .gw .gw-field.gw-fl input:not(:placeholder-shown) + span{ top:0; font-size:10.5px; color:#6e5a65; }
.gw .gw-field.gw-fl input:focus + span{ color:#000; }
.gw .gw-field.gw-fl.ro input{ color:#8a7f86; background:rgba(59,15,46,.035); border-color:rgba(59,15,46,.12); pointer-events:none; }
.gw .gw-field.gw-fl.err input{ border-color:rgba(179,23,79,.75); background:transparent; }
.gw .gw-field.gw-fl em{ right:10px; background:#FFFCF7; box-shadow:-6px 0 6px #FFFCF7; font-size:11px; }
.gw .gw-cta{ grid-column:1 / -1; height:42px; margin-top:2px; font-size:14px; }
.gw[data-v="flip"] .gw-card{ padding:22px 40px; }
.gw[data-v="flip"] .gw-head{ height:20px; margin-bottom:10px; }
.gw[data-v="flip"] .gw-cta{ height:40px; }
.gw[data-v="stub"] .gw-card{ padding:8px 10px; justify-content:center; }
.gw[data-v="stub"] .gw-form{ gap:8px 6px; }
.gw[data-v="stub"] .gw-f-pincode, .gw[data-v="stub"] .gw-f-city, .gw[data-v="stub"] .gw-f-state, .gw[data-v="stub"] .gw-f-flat{ grid-column:span 3; }
.gw[data-v="stub"] .gw-f-area{ grid-column:1 / -1; }
.gw[data-v="stub"] .gw-field.gw-fl input{ height:36px; padding:0 9px; font-size:13px; border-radius:9px; }
.gw[data-v="stub"] .gw-field.gw-fl > span{ font-size:12px; left:9px; }
.gw[data-v="stub"] .gw-field.gw-fl input:focus + span, .gw[data-v="stub"] .gw-field.gw-fl input:not(:placeholder-shown) + span{ font-size:10px; }
.gw[data-v="stub"] .gw-cta{ height:38px; font-size:13.5px; border-radius:9px; }
`;
function useGwStyles() {
  useEffect(() => {
    if (document.getElementById('sb-gift-css')) return;
    const el = document.createElement('style'); el.id = 'sb-gift-css'; el.textContent = GW_CSS; document.head.appendChild(el);
    if (!document.getElementById('sb-gift-fonts')) {
      const l = document.createElement('link'); l.id = 'sb-gift-fonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Hind:wght@400;500;600;700&family=Rozha+One&display=swap'; document.head.appendChild(l);
    }
  }, []);
}
const gwReduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const GW_SPARKS = ['#F7A41D', '#FF7A1A', '#C81F65', '#FFE08A', '#ffffff'];

/** Little celebratory spark gwBurst, appended to a positioned host element. */
function gwBurst(host, x, y, count = 26) {
  if (!host || gwReduced()) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'spark' + (i % 3 === 0 ? ' star' : '');
    const a = Math.random() * Math.PI * 2;
    const d = 60 + Math.random() * 110;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    s.style.background = GW_SPARKS[i % GW_SPARKS.length];
    s.style.setProperty('--dx', Math.cos(a) * d + 'px');
    s.style.setProperty('--dy', Math.sin(a) * d - 30 + 'px');
    s.style.animationDelay = Math.random() * 120 + 'ms';
    host.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}

const gwCap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function GwDiya({ size = 30 }) {
  return (
    <svg width={size} height={Math.round(size * 0.85)} viewBox="0 0 26 22" aria-hidden="true">
      <path d="M13 1C16 6 16 9 13 11C10 9 10 6 13 1Z" fill="#FF8A1F" />
      <path d="M1 12C3 20 23 20 25 12L19 13C15 14 11 14 7 13Z" fill="#D9A93E" />
    </svg>
  );
}

const GwArrow = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// steps: [class added in order, ms to wait before the next step]
const GW_STYLES = {
  env: { label: 'Envelope', steps: [420, 520, 480] },
  book: { label: 'Greeting card', steps: [720] },
  flip: { label: 'Flip ticket', steps: [820], lift: 1 },
  ribbon: { label: 'Gift ribbon', steps: [400, 560] },
  sleeve: { label: 'Card sleeve', steps: [720] },
  voucher: { label: 'Gift your loved ones', steps: [420, 900], lift: 2 },
  stub: { label: 'Tear-off ticket', steps: [], static: true },
};

function GwBow() {
  return (
    <svg className="rib-bow" viewBox="-60 -48 120 96" aria-hidden="true">
      <defs>
        <linearGradient id="bwLoop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8E6214" /><stop offset=".25" stopColor="#E9C46A" /><stop offset=".45" stopColor="#FFF1BF" />
          <stop offset=".62" stopColor="#E2B655" /><stop offset=".85" stopColor="#A87B22" /><stop offset="1" stopColor="#7E5410" />
        </linearGradient>
        <linearGradient id="bwIn" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6E470C" /><stop offset=".5" stopColor="#A87B22" /><stop offset="1" stopColor="#D9A93E" />
        </linearGradient>
        <linearGradient id="bwTail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8E6214" /><stop offset=".3" stopColor="#E9C46A" /><stop offset=".5" stopColor="#FFF4CC" />
          <stop offset=".7" stopColor="#D9A93E" /><stop offset="1" stopColor="#7E5410" />
        </linearGradient>
        <linearGradient id="bwKnot" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8E6214" /><stop offset=".35" stopColor="#F3D27A" /><stop offset=".5" stopColor="#FFF4CC" />
          <stop offset=".7" stopColor="#D9A93E" /><stop offset="1" stopColor="#7E5410" />
        </linearGradient>
        <filter id="bwSoft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1" /></filter>
      </defs>
      <g id="bwHalf">
        <path d="M-7 7 C-12 20 -18 32 -30 45 L-19 41 L-13 50 C-4 36 1 22 3 9Z" fill="url(#bwTail)" stroke="#7E5410" strokeOpacity=".55" strokeWidth=".7" />
        <path d="M-5 12 C-9 24 -14 34 -21 42" fill="none" stroke="#FFF7DA" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" filter="url(#bwSoft)" />
        <path d="M-6 -6 C-18 -30 -50 -44 -57 -22 C-61 -8 -48 10 -7 7 Z" fill="url(#bwLoop)" stroke="#7E5410" strokeOpacity=".6" strokeWidth=".8" />
        <path d="M-8 -3 C-20 -18 -39 -24 -44 -14 C-47 -6 -36 2 -9 3 Z" fill="url(#bwIn)" opacity=".85" />
        <path d="M-16 -22 C-28 -34 -46 -38 -52 -24" fill="none" stroke="#FFF7DA" strokeOpacity=".85" strokeWidth="3" strokeLinecap="round" filter="url(#bwSoft)" />
        <path d="M-50 -6 C-40 4 -24 6 -10 5" fill="none" stroke="#FFE9A8" strokeOpacity=".5" strokeWidth="1.6" strokeLinecap="round" filter="url(#bwSoft)" />
      </g>
      <use href="#bwHalf" transform="scale(-1 1)" />
      <rect x="-10" y="-11" width="20" height="22" rx="6" fill="url(#bwKnot)" stroke="#7E5410" strokeOpacity=".6" strokeWidth=".8" />
      <path d="M-3 -8 C-1 -3 -1 3 -3 8" fill="none" stroke="#FFF7DA" strokeOpacity=".8" strokeWidth="2.2" strokeLinecap="round" filter="url(#bwSoft)" />
      <path d="M-10 -5 C-6 -7 6 -7 10 -5 M-10 5 C-6 7 6 7 10 5" fill="none" stroke="#7E5410" strokeOpacity=".35" strokeWidth=".8" />
    </svg>
  );
}

function GwGiftBox() {
  return (
    <svg width="50" height="50" viewBox="0 0 58 58" aria-hidden="true">
      <defs>
        <linearGradient id="gbG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF1BF" /><stop offset=".45" stopColor="#E9C46A" /><stop offset="1" stopColor="#9E6A1C" />
        </linearGradient>
      </defs>
      <rect x="7" y="24" width="44" height="30" rx="4" fill="url(#gbG)" />
      <rect x="4" y="16" width="50" height="11" rx="3" fill="#F6DB8C" />
      <rect x="25" y="16" width="8" height="38" fill="#8C0F19" />
      <path d="M29 16C22 4 10 8 16 14C19 17 29 16 29 16Z" fill="#A8161F" />
      <path d="M29 16C36 4 48 8 42 14C39 17 29 16 29 16Z" fill="#A8161F" />
    </svg>
  );
}

const GW_VOUCHER_LINES = [
  'M0 38 C20 34 30 40 42 38 C50 37 52 30 47 31 C42 32 46 40 60 40 C80 40 100 34 120 38 C132 40 140 46 138 50 C136 54 128 50 132 44 C138 36 160 40 180 40 C200 40 214 34 226 36 C234 37 236 30 231 31 C226 32 230 40 244 40 C270 40 292 36 318 46',
  'M318 46 C300 32 284 16 289 9 C296 1 313 24 318 46',
  'M318 46 C330 22 352 6 360 12 C367 18 342 36 318 46',
  'M318 46 C314 56 309 64 306 74 L311 72 L310 78',
  'M318 46 C322 56 327 62 331 71 L326 70 L329 76',
  'M318 46 C326 70 316 90 322 108 C326 120 335 118 331 110 C327 102 318 112 320 126 C322 150 314 170 318 186 C320 196 329 194 327 188 C325 182 316 190 316 208',
];

/** Confirmation shown on the closed face after submit (styles 1-6). */
function GwSentFace({ name, onEdit, onNew }) {
  return (
    <div className="face-sent">
      <span className="sent-k">Gifting this to </span>
      <span className="face-t sent-t"><span>{name}</span></span>
      <span className="face-acts">
        <button type="button" data-act="edit" onClick={(e) => { e.stopPropagation(); onEdit(); }}>Edit details</button>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={(e) => { e.stopPropagation(); onNew(); }}>Gift someone else</button>
      </span>
    </div>
  );
}

const GW_EMPTY = { name: '', phone: '', pincode: '', city: '', state: '', flat: '', area: '' };
/* the pincode fills the city + state (a small lookup by PIN zone — the city stays editable) */
const GW_CITIES = { '400': 'MUMBAI', '110': 'NEW DELHI', '560': 'BENGALURU', '600': 'CHENNAI', '700': 'KOLKATA', '500': 'HYDERABAD', '411': 'PUNE', '380': 'AHMEDABAD', '302': 'JAIPUR', '226': 'LUCKNOW' };
const GW_STATES = [[11, 'DELHI'], [12, 'HARYANA'], [13, 'HARYANA'], [14, 'PUNJAB'], [15, 'PUNJAB'], [16, 'PUNJAB'], [17, 'HIMACHAL PRADESH'], [18, 'JAMMU & KASHMIR'], [19, 'JAMMU & KASHMIR'], [20, 'UTTAR PRADESH'], [21, 'UTTAR PRADESH'], [22, 'UTTAR PRADESH'], [23, 'UTTAR PRADESH'], [24, 'UTTARAKHAND'], [25, 'UTTAR PRADESH'], [26, 'UTTARAKHAND'], [27, 'UTTAR PRADESH'], [28, 'UTTAR PRADESH'], [30, 'RAJASTHAN'], [31, 'RAJASTHAN'], [32, 'RAJASTHAN'], [33, 'RAJASTHAN'], [34, 'RAJASTHAN'], [36, 'GUJARAT'], [37, 'GUJARAT'], [38, 'GUJARAT'], [39, 'GUJARAT'], [40, 'MAHARASHTRA'], [41, 'MAHARASHTRA'], [42, 'MAHARASHTRA'], [43, 'MAHARASHTRA'], [44, 'MAHARASHTRA'], [45, 'MADHYA PRADESH'], [46, 'MADHYA PRADESH'], [47, 'MADHYA PRADESH'], [48, 'MADHYA PRADESH'], [49, 'CHHATTISGARH'], [50, 'TELANGANA'], [51, 'ANDHRA PRADESH'], [52, 'ANDHRA PRADESH'], [53, 'ANDHRA PRADESH'], [56, 'KARNATAKA'], [57, 'KARNATAKA'], [58, 'KARNATAKA'], [59, 'KARNATAKA'], [60, 'TAMIL NADU'], [61, 'TAMIL NADU'], [62, 'TAMIL NADU'], [63, 'TAMIL NADU'], [64, 'TAMIL NADU'], [67, 'KERALA'], [68, 'KERALA'], [69, 'KERALA'], [70, 'WEST BENGAL'], [71, 'WEST BENGAL'], [72, 'WEST BENGAL'], [73, 'WEST BENGAL'], [74, 'WEST BENGAL'], [75, 'ODISHA'], [76, 'ODISHA'], [77, 'ODISHA'], [78, 'ASSAM'], [80, 'BIHAR'], [81, 'BIHAR'], [82, 'JHARKHAND'], [83, 'JHARKHAND'], [84, 'BIHAR'], [85, 'BIHAR']];
const gwPin = (pin) => { const st = (GW_STATES.find(([z]) => String(z) === pin.slice(0, 2)) || [])[1] || ''; return { state: st, city: GW_CITIES[pin.slice(0, 3)] || '' }; };

function gwValidate(v) {
  const ok = (t) => (t.trim() ? '' : 'Required');
  return {
    name: ok(v.name),
    phone: /^\d{10}$/.test(v.phone) ? '' : v.phone ? '10 digits' : 'Required',
    pincode: /^\d{6}$/.test(v.pincode) ? (v.state ? '' : 'Not found') : v.pincode ? '6 digits' : 'Required',
    city: ok(v.city), flat: ok(v.flat), area: ok(v.area),
  };
}

/**
 * Gift-to-someone widget.
 * @param {'env'|'book'|'flip'|'ribbon'|'sleeve'|'voucher'|'stub'} styleKey
 * @param {boolean} shake  idle shake animation on the closed card
 * @param {(details:{name,phone,address}) => void} onSubmit  called with valid details
 */
function GwWidget({ styleKey = 'env', shake = true, onSubmit, onOpenChange }) {
  useGwStyles();
  const cfg = GW_STYLES[styleKey];
  const isStatic = !!cfg.static;

  const [k, setK] = useState(isStatic ? 1 : 0); // how many step classes (p1..p3) are applied
  const [closed, setClosed] = useState(!isStatic);
  const [cardActive, setCardActive] = useState(isStatic);
  const [gifted, setGifted] = useState(false);
  const [sent, setSent] = useState(false); // tear-off ticket success panel
  const [attract, setAttract] = useState(isStatic);
  const [values, setValues] = useState(GW_EMPTY);
  const [errors, setErrors] = useState(GW_EMPTY);
  const [sentName, setSentName] = useState('');
  const [nudge, setNudge] = useState(0);
  const [expanded, setExpanded] = useState(false); // the form is open (true from the tap that opens it, false the moment it is closed or sent)
  useEffect(() => { onOpenChange?.(expanded); }, [expanded]);
  useEffect(() => () => { onOpenChange?.(false); }, []);   // switching the gift style (or removing the gift) puts the pincode back

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const nameRef = useRef(null);
  const editRef = useRef(null);
  const busy = useRef(false);
  const closedRef = useRef(!isStatic);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (cardRef.current) cardRef.current.inert = !cardActive; }, [cardActive]);

  const wait = (ms) => new Promise((r) => timers.current.push(setTimeout(r, gwReduced() ? Math.min(ms, 60) : ms)));
  const setClosedBoth = (v) => { closedRef.current = v; setClosed(v); };

  const lift = (step, ms) => {
    if (gwReduced() || cfg.lift !== step || !stageRef.current) return;
    const ease = 'cubic-bezier(.45,0,.55,1)';
    stageRef.current.animate(
      [{ transform: 'none' }, { transform: 'translateY(-12px) scale(1.035)', offset: 0.5 }, { transform: 'none' }],
      { duration: ms, easing: ease }
    );
    const sh = rootRef.current?.querySelector('.vf-shadow');
    if (sh) sh.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0.35, transform: 'translateY(14px) scale(.88)', offset: 0.5 }, { opacity: 1, transform: 'none' }],
      { duration: ms, easing: ease }
    );
  };

  const open = async () => {
    if (busy.current || !closedRef.current) return;
    busy.current = true;
    if (!isStatic) setExpanded(true);
    setClosedBoth(false);
    for (let i = 0; i < cfg.steps.length; i++) {
      setK(i + 1);
      lift(i + 1, cfg.steps[i]);
      await wait(cfg.steps[i]);
    }
    setCardActive(true);
    busy.current = false;
    requestAnimationFrame(() => nameRef.current?.focus({ preventScroll: true }));
  };

  const close = async (afterGift = false) => {
    if (isStatic || busy.current || closedRef.current) return;
    busy.current = true;
    setExpanded(false);
    setCardActive(false);
    for (let i = cfg.steps.length - 1; i >= 0; i--) {
      setK(i);
      lift(i + 1, cfg.steps[i]);
      await wait(cfg.steps[i]);
    }
    setClosedBoth(true);
    busy.current = false;
    if (!afterGift) stageRef.current?.focus({ preventScroll: true });
  };

  const reopen = (clear) => {
    if (clear) { setValues(GW_EMPTY); setErrors(GW_EMPTY); }
    setGifted(false);
    open();
  };

  const backToForm = (clear) => {
    if (clear) { setValues(GW_EMPTY); setErrors(GW_EMPTY); }
    setSent(false);
    requestAnimationFrame(() => nameRef.current?.focus());
  };

  const change = (field) => (e) => {
    let v = e.target.value;
    if (field === 'phone') v = v.replace(/\D/g, '').slice(0, 10);
    if (field === 'pincode') {
      v = v.replace(/\D/g, '').slice(0, 6);
      const hit = v.length === 6 ? gwPin(v) : { state: '', city: '' };
      setValues((s) => ({ ...s, pincode: v, state: hit.state, city: v.length === 6 && hit.city ? hit.city : s.city }));
      setErrors((s) => ({ ...s, pincode: '', state: '', city: '' }));
      return;
    }
    setValues((s) => ({ ...s, [field]: v }));
    setErrors((s) => ({ ...s, [field]: '' }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = gwValidate(values);
    setErrors(errs);
    const bad = ['name', 'phone', 'pincode', 'city', 'flat', 'area'].find((f) => errs[f]);
    if (bad) {
      setNudge((n) => n + 1);
      requestAnimationFrame(() => rootRef.current?.querySelector(`input[name="${bad}"]`)?.focus());
      return;
    }
    const details = { name: values.name.trim(), phone: values.phone, pincode: values.pincode, city: values.city.trim(), state: values.state, flat: values.flat.trim(), area: values.area.trim(), address: `${values.flat.trim()}, ${values.area.trim()}, ${values.city.trim()}, ${values.state} ${values.pincode}` };
    onSubmit?.(details);
    const nice = gwCap(details.name.split(' ')[0]);
    setSentName(nice);

    if (!isStatic) {
      setGifted(true);
      await close(true);
      const root = rootRef.current;
      if (root) {
        const g = root.getBoundingClientRect();
        gwBurst(root, g.width / 2, g.height / 2, 30);
        root.querySelector('[data-act="edit"]')?.focus({ preventScroll: true });
      }
      return;
    }
    setSent(true);
    requestAnimationFrame(() => {
      const root = rootRef.current;
      const main = root?.querySelector('.tk-main');
      if (root && main) {
        const m = main.getBoundingClientRect(), g = root.getBoundingClientRect();
        gwBurst(root, m.left - g.left, m.top - g.top + m.height / 2, 18);
      }
      editRef.current?.focus({ preventScroll: true });
    });
  };

  const field = (name, label, extra = {}) => (
    <label className={'gw-field gw-fl gw-f-' + name + (errors[name] ? ' err' : '') + (extra.readOnly ? ' ro' : '')} key={name + nudge}>
      <input
        ref={name === 'name' ? nameRef : undefined}
        name={name}
        value={values[name]}
        onChange={change(name)}
        placeholder=" "
        aria-label={label}
        aria-invalid={errors[name] ? 'true' : 'false'}
        autoComplete="off"
        {...extra}
      />
      <span>{label}</span>
      <em>{errors[name]}</em>
    </label>
  );

  const card = (
    <div ref={cardRef} className={'gw-card' + (sent ? ' sent' : '')}>
      <button className="gw-x" type="button" aria-label="Close" onClick={(e) => { e.stopPropagation(); close(); }}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="gw-head"><GwDiya size={18} /><p className="gw-title">Send it as a Diwali gift</p></div>
      {/* A div, not a <form>: sandboxed previews block form submission, so the submit event never fires. */}
      <div
        className="gw-form"
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); submit(e); } }}
      >
        <div className="gw-row2">
          {field('name', 'Name *')}
          {field('phone', 'Phone *', { inputMode: 'numeric', maxLength: 10 })}
        </div>
        <div className="gw-row3">
          {field('pincode', 'Pincode *', { inputMode: 'numeric', maxLength: 6 })}
          {field('city', 'City *')}
          {field('state', 'State *', { readOnly: true, tabIndex: -1 })}
        </div>
        <div className="gw-row2 last">
          {field('flat', 'Flat, House no. *')}
          {field('area', 'Apartment, Area, Sector, Village *')}
        </div>
        <button className="gw-cta" type="button" onClick={submit}>Send as a gift <GwArrow /></button>
      </div>
      <div className="gw-done" hidden={!sent}>
        <div className="gw-medal">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#8A1C4A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="gw-title">On its way to <span>{sentName}</span></p>
        <p>Packed with a Diwali card. You pay at checkout, <br />and the price never shows on the gift.</p>
        <div className="gw-done-acts">
          <button ref={editRef} className="reset" type="button" onClick={() => backToForm(false)}>Edit details</button>
          <button className="reset" type="button" onClick={() => backToForm(true)}>Gift someone else</button>
        </div>
      </div>
    </div>
  );

  const sentFace = <GwSentFace name={sentName} onEdit={() => reopen(false)} onNew={() => reopen(true)} />;

  let face;
  switch (styleKey) {
    case 'env':
      face = (
        <>
          <div className="env-back" />
          {card}
          <div className="env-pocket" aria-hidden="true">
            <div className="pk-main" /><div className="pk-fold" />
            <svg className="pk-edge" viewBox="0 0 400 208" preserveAspectRatio="none">
              <path d="M0 40 L200 104 L400 40" fill="none" stroke="rgba(255,190,180,.28)" strokeWidth="1.5" />
              <path d="M0 208 L200 120 L400 208" fill="none" stroke="rgba(30,0,3,.35)" strokeWidth="1" />
            </svg>
          </div>
          <div className="env-flap" aria-hidden="true"><div className="fl-shape" /></div>
          <div className="env-seal"><GwDiya size={24} /></div>
          <div className="env-text">
            <div className="face-copy"><span className="face-t">Gift this to someone you love</span><span className="face-s">Tap to open the envelope</span></div>
            {sentFace}
          </div>
        </>
      );
      break;
    case 'book':
      face = (
        <>
          {card}
          <div className="book-cover">
            <div className="book-emblem"><GwDiya size={28} /></div>
            <div className="face-copy">
              <span className="face-t">For someone special</span>
              <span className="face-s">Gift this product with a Diwali card</span>
              <span className="orn" />
              <span className="chip">Tap to open</span>
            </div>
            {sentFace}
          </div>
        </>
      );
      break;
    case 'flip':
      face = (
        <>
          <div className="vf-shadow" />
          <div className="flip-inner">
            <div className="flip-front">
              <div className="flip-ticket">
                <GwGiftBox />
                <div className="face-copy">
                  <span className="face-t">Gift it to a loved one</span>
                  <span className="face-s">Send this product to their door</span>
                  <span className="text-cta">Tap to flip <GwArrow size={14} /></span>
                </div>
                {sentFace}
              </div>
            </div>
            {card}
          </div>
        </>
      );
      break;
    case 'ribbon':
      face = (
        <>
          {card}
          <div className="rib-cover">
            <div className="rib-v" /><div className="rib-h" />
            <GwBow />
            <div className="face-copy">
              <span className="face-t">Wrap it as a gift</span>
              <span className="face-s">Send this product to someone you love.</span>
              <span className="chip">Tap to untie</span>
            </div>
            {sentFace}
          </div>
        </>
      );
      break;
    case 'sleeve':
      face = (
        <>
          {card}
          <div className="slv-wrap">
            <div className="slv">
              <GwDiya size={26} />
              <div className="face-copy"><span className="face-t">Gift it to someone you love</span><span className="face-s">Tap to pull out the card</span></div>
              {sentFace}
            </div>
          </div>
        </>
      );
      break;
    case 'voucher':
      face = (
        <>
          <div className="vf-shadow" />
          <div className="vf-inner">
            <div className="vf-front">
              <svg viewBox="0 0 400 208" preserveAspectRatio="none" aria-hidden="true">
                {GW_VOUCHER_LINES.map((d) => <path key={d} className="vf-line" pathLength="1" d={d} />)}
              </svg>
              <div className="vf-text">
                <div className="face-copy"><b>GIFT YOUR<br />LOVED ONES</b><small><GwDiya size={16} /> Tap to send it to someone you love</small></div>
                {sentFace}
              </div>
            </div>
            {card}
          </div>
        </>
      );
      break;
    case 'stub':
    default:
      face = (
        <div className="tk">
          <div className="tk-stub">
            <div className="tk-skin" />
            <div className="tk-in">
              <GwDiya size={22} />
              <div className="tk-vs">
                <div className="tk-v a"><b>Gift it</b><span>to someone you love</span></div>
                <div className="tk-v b"><b>Sent</b><span>with love, this Diwali</span></div>
              </div>
            </div>
          </div>
          <div className="tk-main">
            <div className="tk-skin" />
            <span className="tk-perf" />
            <div className="tk-in">{card}</div>
          </div>
        </div>
      );
  }

  const classes = ['gw'];
  if (closed) classes.push('closed');
  if (!shake) classes.push('noshake');
  for (let i = 1; i <= k; i++) classes.push('p' + i);
  if (gifted) classes.push('gifted');
  if (isStatic && sent) classes.push('torn');
  if (attract) classes.push('attract');

  const stageIsButton = closed && !gifted;

  return (
    <div
      ref={rootRef}
      className={classes.join(' ')}
      data-v={styleKey}
      onFocus={attract ? () => setAttract(false) : undefined}
      onPointerDown={attract ? () => setAttract(false) : undefined}
    >
      <div
        ref={stageRef}
        className="gw-stage"
        role={stageIsButton ? 'button' : undefined}
        tabIndex={stageIsButton ? 0 : undefined}
        aria-label={stageIsButton ? 'Gift this product to someone. Opens a short form.' : undefined}
        onClick={(e) => {
          if (e.target.closest('[data-act], .face-acts')) return;
          if (closedRef.current && !gifted) open();
        }}
        onKeyDown={(e) => {
          if (e.target.closest('.face-acts')) return;
          if (closedRef.current && !gifted && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); }
          else if (e.key === 'Escape') close();
        }}
      >
        {face}
      </div>
    </div>
  );
}


/* the slot the widgets render above their pincode + main CTA: the chosen gift style, full width of the widget (mobile and desktop) */
let GIFTSET = { on: false, style: 'env' };
function GiftSlot({ onOpenChange }) {
  if (!GIFTSET.on) return null;
  return <div data-gift-slot="1" style={{ width: '100%', margin: '14px 0 2px' }}><GwWidget key={GIFTSET.style} styleKey={GIFTSET.style} onOpenChange={onOpenChange} /></div>;
}
const GIFT_OPTIONS = Object.entries(GW_STYLES).map(([k, v]) => [k, v.label]);

/* the "Complete your routine" row: it runs the full width (the side padding is just empty space the cards scroll through) with a round arrow at each end on desktop — the Gift page's carousel */
function Scroller({ d, k, children }) {
  const ref = useRef(null), [edge, setEdge] = useState({ l: false, r: true });
  const upd = () => { const el = ref.current; if (!el) return; setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => { const el = ref.current; if (el) el.scrollTo({ left: 0 }); upd(); const t = setTimeout(upd, 200); return () => clearTimeout(t); }, [k]);
  const go = (dir) => { const el = ref.current; if (!el || !el.children[1]) return; el.scrollBy({ left: dir * (el.children[1].offsetWidth + 16), behavior: 'smooth' }); };
  const arrow = (dir) => (
    <button type="button" aria-label={dir < 0 ? 'Previous' : 'Next'} onClick={() => go(dir)} style={{ position: 'absolute', top: '50%', marginTop: -22, [dir < 0 ? 'left' : 'right']: 24, zIndex: 5, width: 44, height: 44, padding: 0, borderRadius: '50%', background: '#fff', border: '1.5px solid #c4c4c4', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {dir < 0 ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );
  return (
    <div style={{ position: 'relative' }}>
      <div ref={ref} onScroll={upd} className="upsell-scroll gs-root">{children}</div>
      {d && edge.l && arrow(-1)}{d && edge.r && arrow(1)}
    </div>
  );
}
function SubPage(P) {
  const widgetSettings = undefined;
  // Diwali theme (on by default) and its colour palette — set from the Widget Settings panel
  const fest = !!P.fest;
  const palette = 'maroon';   // the artwork's accents (marigold, kumkum, lanterns…); the two colour sliders set the dark + light
  const fDark = P.dark, fLight = P.light;   // the two Diwali colours come from the bundle's settings
  // which page is shown: the subscription product ('normal') or the Diwali Surprise Box ('surprise').
  // Both read every other setting (theme, colour, widget, one-time, endless, variant style).
  const page = P.page;
  const isSB = page === 'surprise';
  useEffect(() => { setOpenMiniFaq(isSB ? 'what' : 'autodebit'); setOpenFaqIds(isSB ? ['what'] : ['subscribe']); setPackCount(1); }, [isSB]);
  applyPalette(palette, fDark, fLight);
  const SPARK_TILE = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='520' height='520' viewBox='0 0 520 520'><g fill='${K.marigold}'><path opacity='.34' d='M70 90l4 12 12 4-12 4-4 12-4-12-12-4 12-4z'/><path opacity='.26' d='M410 60l3 9 9 3-9 3-3 9-3-9-9-3 9-3z'/><path opacity='.3' d='M300 250l4 12 12 4-12 4-4 12-4-12-12-4 12-4z'/><path opacity='.22' d='M130 400l3 9 9 3-9 3-3 9-3-9-9-3 9-3z'/><path opacity='.28' d='M470 420l4 12 12 4-12 4-4 12-4-12-12-4 12-4z'/><circle opacity='.3' cx='220' cy='140' r='2.2'/><circle opacity='.26' cx='60' cy='300' r='2'/><circle opacity='.3' cx='400' cy='330' r='2.2'/><circle opacity='.24' cx='250' cy='470' r='2'/></g></svg>`)}")`;
  const widgetBrand = useMemo(() => (fest ? diwaliBrand() : brandFromSettings(widgetSettings)), [widgetSettings, fest, palette, fDark, fLight]);
  // page CSS follows the same six schema tokens as the widget — no separate palette
  const pageThemeCss = useMemo(() => {
    const T = buildTokens(widgetBrand);
    const [ar, ag, ab] = hexToRgb(widgetBrand.accent);
    return `.app-shell{
      --accent:${widgetBrand.accent};
      --accent-rgb:${ar}, ${ag}, ${ab};
      --accent-dark:${mix(widgetBrand.primary, widgetBrand.accent, 0.35)};
      --grey-900:${widgetBrand.primary};
      --sb-secondary:${widgetBrand.secondary};
      --sb-bg:${widgetBrand.bg};
      --sb-tile:${widgetBrand.tile};
      --sb-on-accent:${T.onAccent};
      --sb-on-secondary:${T.onSecondary};
    }`;
  }, [widgetBrand]);
  const [selectedVariant, setSelectedVariant] = useState('Classic');
  const [qtyIndex, setQtyIndex] = useState(0);
  const [packCount, setPackCount] = useState(1);
  const [openMiniFaq, setOpenMiniFaq] = useState('autodebit');
  const [openFaqIds, setOpenFaqIds] = useState(['subscribe']);
  const [upsellTab, setUpsellTab] = useState('subscriptions');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [annIdx, setAnnIdx] = useState(0);
  useEffect(() => { const id = setInterval(() => setAnnIdx((i) => i + 1), 3000); return () => clearInterval(id); }, []);   // announcement ticker (mobile)
  const [footerRevealed, setFooterRevealed] = useState(false), [footerInView, setFooterInView] = useState(false);
  // which subscription widget is shown (dev/demo switcher) + the CTA info it reports
  const activeWidget = P.widget || 'single';
  const [ctaInfo, setCtaInfo] = useState({ label: 'Subscribe', payType: 'upfront', price: 1596, suffix: '', saved: 600, perDelivery: 399, pinValid: false, estimate: { nextCharge: 1596, frequency: 'Every 4 weeks' } });
  const [summaryOpen, setSummaryOpen] = useState(false);
  const stickyBarRef = useRef(null);
  useEffect(() => {
    if (!summaryOpen) return;
    function handleOutsideClick(e) {
      if (stickyBarRef.current && !stickyBarRef.current.contains(e.target)) {
        setSummaryOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [summaryOpen]);
  // variant selector style (dev/demo switcher): 'pills' or 'dropdown'
  const variantStyle = P.variantStyle || 'pills';
  // whether the One Time Purchase option/container is shown (dev/demo switcher, applies across all widgets)
  const showOneTime = P.showOneTime !== false;
  // Endless subscription setting: ON = "Every Week" (no delivery count),
  // OFF = "Every Week for N deliveries" (per-plan count) — Widget 3.
  const endless = P.endless !== false;
  // Gift it to someone: on/off + which of the 7 gift styles
  GIFTSET = { on: !!P.giftOn, style: P.giftStyle || 'env' };
  const [descExpanded, setDescExpanded] = useState(false);

  const widgetRef = useRef(null);
  const footerRef = useRef(null);

  const qty = QUANTITY_OPTIONS[qtyIndex];
  const totalPrice = qty.price * packCount;
  const totalMrp = qty.mrp * packCount;
  const saved = totalMrp - totalPrice;

  // Single source of truth for all widget pricing, derived from the selected
  // quantity + units. Everything (capsule, estimate strip, all 4 widgets, both
  // CTAs) scales off these so the numbers stay logical when quantity changes.
  const UPFRONT_TERM = 4; // deliveries covered by an upfront plan
  const pricing = useMemo(() => {
    const perDelivery = (isSB ? SURPRISE.perDelivery : qty.price) * packCount;   // subscription price / delivery
    const oneTime = (isSB ? SURPRISE.oneTime : qty.mrp) * packCount;             // non-subscription price / delivery
    const savedPerDelivery = oneTime - perDelivery;
    return {
      oneTime,                                   // one-time purchase price
      perDelivery,                               // subscribe & pay-per-delivery
      payg: oneTime,                             // pay-as-you-go = no upfront discount
      upfrontTotal: perDelivery * UPFRONT_TERM,  // subscribe & pay upfront (whole term)
      upfrontSaved: savedPerDelivery * UPFRONT_TERM,
      perDeliverySaved: savedPerDelivery,
      term: UPFRONT_TERM,
    };
  }, [qty, packCount, isSB]);

  // Modular widget registry — add/remove entries here to change the switcher + landing page.
  const WIDGETS = {
    single: { label: 'Widget 1 — Single Plan',   Component: SubscriptionOptionSingle },
    opt1:   { label: 'Widget 2 — Frequency Picker', Component: SubscriptionOption1 },
    opt2:   { label: 'Widget 3 — Schedule Grid',  Component: SubscriptionOption2 },
    intl:   { label: 'Widget 4 — International',   Component: SubscriptionOptionIntl },
  };
  const ActiveWidget = (WIDGETS[activeWidget] || WIDGETS.single).Component;

  // footer fades up the first time it scrolls into view
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        setFooterInView(entry.isIntersecting); if (entry.isIntersecting) setFooterRevealed(true);
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // sticky bar trust ticker rotation
  useEffect(() => {
    const id = setInterval(() => setTickerIndex((i) => (i + 1) % STICKY_TICKER.length), 3500);
    return () => clearInterval(id);
  }, []);

  // banner carousel auto-advance
  useEffect(() => {
    const id = setInterval(() => setBannerIndex((i) => (i + 1) % 3), 5000);
    return () => clearInterval(id);
  }, []);

  function toggleFaq(id) {
    setOpenFaqIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function scrollToWidget() {
    widgetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const [pinErrorSignal, setPinErrorSignal] = useState(0);
  function handleStickyCTA() {
    scrollToWidget();
    if (!ctaInfo.pinValid) setPinErrorSignal((n) => n + 1);
  }

  const upsellData = upsellTab === 'bundles' ? BUNDLE_PRODUCTS : SUBSCRIPTION_PRODUCTS;

  return (
    <div className={`app-shell${fest ? ' is-diwali' : ''}${isSB ? ' is-surprise' : ''}`}>
      <style>{`
  .app-shell{ width:100%; max-width:1440px; margin:0 auto; position:relative; background:var(--white); box-shadow:0 0 60px rgba(0,0,0,.12); }
  .mobile-only{ display:none; }
  .app-shell{
    --font-body:'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    --ink:#1a1a1a;
    --accent:#95e534;
    --accent-dark:#4a6a1b;
    --grey-900:#2b2b2b;
    --grey-700:#5c5c5c;
    --grey-500:#8a8a8a;
    --grey-300:#c9c9c9;
    --grey-200:#dedede;
    --grey-100:#ececec;
    --grey-50:#f6f6f6;
    --grey-60:#efefef;
    --line:#cfcfcf;
    --white:#ffffff;
    --radius:10px;
    --radius-sm:6px;
    --maxw:1280px;
  }
  .app-shell, .app-shell *{box-sizing:border-box;}
  .app-shell{ font-family:var(--font-body); color:var(--ink); line-height:1.45; -webkit-font-smoothing:antialiased; }
  .app-shell h1, .app-shell h2, .app-shell h3{ font-family:var(--font-body); font-weight:600; letter-spacing:-0.01em; }
  .wrap{max-width:var(--maxw); margin:0 auto; padding:0 32px;}
  .app-shell a{color:inherit; text-decoration:none;}
  .app-shell button{font-family:inherit; cursor:pointer;}
  .app-shell button:focus-visible, .app-shell a:focus-visible{ outline:2px solid var(--grey-900); outline-offset:2px; }

  .section{ padding:56px 0; }
  .section-grey{ background:var(--grey-50); }
  .section-head{ margin-bottom:26px; max-width:640px; }
  .section-head h2{ font-size:32px; font-weight:600; margin:0 0 10px; line-height:1.2; }
  .section-head p{ margin:0; color:var(--grey-700); font-size:16.5px; }
  .section-head-center{ text-align:center; margin-left:auto; margin-right:auto; }

  .img-placeholder{ background:var(--grey-50); border:1px dashed var(--grey-300); border-radius:var(--radius); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; color:var(--grey-500); }
  .img-placeholder svg{ opacity:.6; }
  .img-placeholder span{ font-size:14px; }

  .widget-placeholder{ border:1.5px solid var(--grey-500); border-radius:var(--radius); background:var(--grey-50); min-height:300px; display:flex; align-items:center; justify-content:center; }
  .widget-placeholder span{ font-size:15px; color:var(--grey-500); }
  .sb-widget-mount{ width:100%; }
  .sb-widget-mount > div{ width:100%; max-width:100%; }

  /* announcement — real sentence copy, accent highlights, one entrance moment */
  .announcement{ background:var(--grey-900); color:rgba(255,255,255,.92); font-size:15px; padding:12px 0; display:flex; align-items:center; justify-content:center; gap:26px; flex-wrap:wrap; animation:chromeIn .5s ease both; }
  .announcement .ann-all{ display:contents; }
  .announcement .ann-ticker{ display:none; }
  .announcement .ann-item{ display:flex; align-items:center; gap:8px; }
  .announcement .ann-item:first-child{ padding-right:26px; border-right:1px solid rgba(255,255,255,.25); }
  .announcement .accent{ color:var(--accent); font-weight:600; }
  @keyframes chromeIn{ from{ opacity:0; transform:translateY(-6px); } to{ opacity:1; transform:translateY(0); } }

  header.site-header{ border-bottom:1px solid var(--grey-100); animation:chromeIn .5s ease .05s both; }
  .header-grid{ position:relative; display:flex; align-items:center; justify-content:space-between; padding:18px 0; }
  .shop-cta{ flex-shrink:0; border:1px solid var(--grey-300); border-radius:999px; padding:10px 22px; font-size:15px; font-weight:600; color:var(--ink); background:var(--white); transition:border-color .15s ease, background-color .15s ease; }
  .shop-cta:hover{ border-color:var(--ink); background:var(--grey-50); }
  .logo-wordmark{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); font-size:23px; font-weight:600; letter-spacing:-.01em; color:var(--ink); white-space:nowrap; }
  .header-icons{ flex-shrink:0; display:flex; gap:28px; align-items:center; padding-right:8px; }
  .header-link{ display:flex; align-items:center; gap:8px; font-size:14.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; color:var(--ink); }
  .header-link svg{ width:21px; height:21px; }
  .cart-icon-wrap{ position:relative; display:flex; }
  .cart-badge{ position:absolute; top:-6px; right:-8px; background:var(--accent); color:var(--sb-on-accent); font-size:11px; border-radius:999px; width:15px; height:15px; display:flex; align-items:center; justify-content:center; }

  /* fold */
  .fold{ display:grid; grid-template-columns:1fr 1fr; gap:48px; padding:32px 0 56px; align-items:start; }

  /* gallery — sticky while right division scrolls */
  .gallery-col{ position:sticky; top:24px; }

  /* gallery — thumbnails below, centered, bigger, plain */
  .gallery-main{ aspect-ratio:1/1; width:100%; }
  .gallery-main svg{ width:40px; height:40px; }
  .thumb-row{ display:flex; align-items:center; justify-content:center; gap:12px; margin-top:16px; }
  .thumb{ width:64px; height:64px; flex-shrink:0; }
  .thumb svg{ width:18px; height:18px; }
  .arrow-btn{ width:30px; height:30px; border-radius:50%; border:1px solid var(--grey-300); background:var(--white); display:flex; align-items:center; justify-content:center; flex-shrink:0; }

  /* right division */
  .rd{ display:flex; flex-direction:column; gap:8px; }

  .name-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
  .product-title{ font-size:29px; font-weight:600; margin:0; line-height:1.35; }
  .rating-pill{ display:inline-flex; align-items:center; gap:4px; vertical-align:middle; border:1px solid var(--grey-300); border-radius:999px; padding:3px 10px; font-size:14px; font-weight:600; color:var(--ink); flex-shrink:0; }
  .category-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin:6px 0 4px; }
  .desc-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin:8px 0 10px; }
  .desc-row .product-desc{ margin-bottom:0; }
  .desc-row .rating-pill{ margin-top:2px; }
  .rating-pill svg{ fill:var(--accent); }
  .offer-tab-inline{ background:var(--grey-900); color:#fff; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:.03em; padding:6px 14px; border-radius:999px; flex-shrink:0; white-space:nowrap; margin-top:5px; }
  .category-subtext{ font-size:15.5px; color:var(--accent); font-weight:600; margin:0; text-transform:uppercase; letter-spacing:.03em; }
  .product-desc{ font-size:15px; font-weight:300; line-height:1.5; color:var(--grey-700); max-width:480px; margin-bottom:10px; }
  .product-desc-toggle{ font-weight:600; color:var(--grey-700); cursor:pointer; text-decoration:underline; }

  .divider-line{ height:1px; background:var(--grey-200); margin:6px 0; }

  .price-row{ display:flex; flex-direction:row; align-items:center; gap:14px; margin-bottom:32px; flex-wrap:wrap; }
  .price-onetime{ display:inline-flex; align-items:center; line-height:1; white-space:nowrap; }
  .price-onetime-val{ font-size:20px; font-weight:600; color:var(--grey-700); letter-spacing:-0.3px; text-decoration:line-through; text-decoration-color:#c4c4c4; }
  .price-perdel{ display:inline-flex; align-items:baseline; font-size:26px; font-weight:700; color:var(--ink); letter-spacing:-0.5px; line-height:1; white-space:nowrap; }
  .price-perdel .price-per{ font-size:16px; font-weight:400; color:var(--grey-700); margin-left:2px; line-height:1; }
  .price-saved{ display:inline-flex; align-items:center; background:var(--accent); color:var(--sb-on-accent); border-radius:999px; padding:5px 11px; white-space:nowrap; }
  .price-saved-amt{ font-size:15px; font-weight:700; color:var(--sb-on-accent); text-transform:uppercase; letter-spacing:.02em; line-height:1; }

  .step-block{ margin-bottom:0; }
  .step-heading{ font-size:13px; font-weight:400; color:var(--grey-500); text-transform:uppercase; letter-spacing:.06em; margin-bottom:18px; }

  .variant-block{ margin-bottom:20px; }
  .variant-label{ font-size:15px; color:var(--grey-700); margin-bottom:10px; }
  .variant-label b{ color:var(--ink); }
  .variant-pills{ display:flex; flex-wrap:wrap; gap:10px; }
  .variant-pill{ border:1px solid var(--grey-300); background:var(--white); border-radius:var(--radius-sm); padding:12px 20px; font-size:17px; color:var(--grey-700); }
  .variant-pill.selected{ background:var(--grey-900); border-color:var(--grey-900); color:#fff; font-weight:600; }
  .variant-select{ appearance:none; -webkit-appearance:none; width:100%; max-width:320px; border:1px solid var(--grey-300); background:var(--white); border-radius:var(--radius-sm); padding:12px 40px 12px 16px; font-size:17px; font-weight:600; color:var(--ink); cursor:pointer; font-family:inherit; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235c5c5c' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 14px center; }
  .variant-select:focus{ outline:none; border-color:var(--grey-900); }
  .variant-dropdown-row{ display:flex; gap:16px; margin-bottom:20px; }
  .variant-block-half{ flex:1; min-width:0; margin-bottom:0; }
  .variant-block-half .variant-select{ width:100%; max-width:none; }
  .freq-picker-row .variant-select{ padding-top:15px; padding-bottom:15px; background-color:var(--sb-secondary); border-color:#e8e8e8; }
  .qty-stepper{ display:inline-flex; align-items:center; border:1px solid var(--grey-300); border-radius:999px; overflow:hidden; }
  .stepper-btn{ width:42px; height:42px; display:flex; align-items:center; justify-content:center; background:var(--white); border:none; font-size:20px; color:var(--grey-700); }
  .stepper-btn:hover{ background:var(--grey-50); }
  .stepper-value{ width:44px; text-align:center; font-size:17px; font-weight:600; color:var(--ink); }

  .estimate-strip{ display:flex; align-items:center; justify-content:center; width:100%; margin:18px 0 34px; }
  .price-summary{ width:100%; box-sizing:border-box; margin:0 0 32px; padding:20px 22px; border:1px solid var(--grey-200); border-radius:14px; background:var(--grey-50); display:flex; flex-direction:column; gap:11px; }
  .price-summary .ps-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .price-summary .ps-label{ font-size:17px; }
  .price-summary .ps-value{ font-size:17px; }
  .price-summary .ps-muted{ color:var(--grey-500); font-weight:400; }
  .price-summary .ps-bold{ color:var(--ink); font-weight:700; }
  .price-summary .ps-accent{ color:var(--accent); font-weight:700; }
  .price-summary .ps-strike{ color:var(--grey-500); text-decoration:line-through; }
  .price-summary .ps-divider{ border-top:1px dashed var(--grey-300); margin:3px 0; }
  .price-summary .ps-multiplier{ text-align:center; font-size:16px; font-weight:600; color:var(--grey-500); padding:2px 0; }
  .price-summary .ps-total-row{ margin-top:2px; }
  .estimate-stats{ display:flex; align-items:center; justify-content:center; gap:0; flex-shrink:0; }
  .est-item{ display:flex; flex-direction:column; align-items:center; text-align:center; padding:0 26px; }
  .est-item + .est-item{ border-left:1px solid var(--grey-300); }
  .est-label{ font-size:13px; letter-spacing:.04em; text-transform:uppercase; color:var(--grey-700); margin-bottom:2px; }
  .est-value{ font-size:18px; font-weight:600; color:var(--accent); }

  /* trust cards */
  .trust-cards{ display:flex; flex-direction:column; gap:10px; margin-bottom:32px; }
  @keyframes trust-shimmer { 0% { transform:translateX(-120%) skewX(-18deg); } 100% { transform:translateX(320%) skewX(-18deg); } }
  .trust-card{ position:relative; overflow:hidden; display:flex; gap:14px; align-items:center; border:1px solid var(--accent); border-radius:var(--radius); padding:14px 18px;
    background:var(--sb-secondary);
    box-shadow:0 1px 3px rgba(0,0,0,.06), inset 0 1px 0 rgba(255,255,255,.65); }
  .trust-card-autopay{ padding:14px 18px; align-items:center; justify-content:space-between; gap:14px; }
  .trust-card-autopay-text{ display:flex; flex-direction:column; gap:2px; }
  .trust-card-autopay .trust-card-title{ margin-bottom:0; }
  .trust-card-autopay .trust-card-sub{ text-align:left; }
  .trust-card:first-child::before{ content:""; position:absolute; top:0; left:0; width:32%; height:100%; pointer-events:none; z-index:1;
    background:linear-gradient(100deg, transparent 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,.55) 50%, rgba(var(--accent-rgb),.14) 58%, rgba(255,255,255,0) 68%, transparent 100%);
    animation:trust-shimmer 5.5s ease-in-out infinite; }
  .trust-card > *{ position:relative; z-index:2; }
  .trust-card:nth-child(2), .trust-card:nth-child(3){ border-color:#e8e8e8; background:none; box-shadow:none; }
  @media (prefers-reduced-motion: reduce){ .trust-card:first-child::before{ animation:none; display:none; } }
  .trust-icon{ width:36px; height:36px; border-radius:50%; border:1.5px solid var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .trust-card-text{ flex:1; }
  .trust-card-title{ font-size:16.5px; font-weight:600; color:var(--grey-700); margin-bottom:4px; }
  .trust-card-sub{ font-size:14.5px; color:var(--grey-700); }
  .payment-logos{ display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .pay-logo{ min-width:48px; height:36px; flex-shrink:0; display:flex; align-items:center; justify-content:center; padding:0 8px; border:1px solid var(--grey-200); border-radius:var(--radius-sm); background:var(--white); box-shadow:0 1px 2px rgba(0,0,0,.04); }

  /* mini faq (fold) — reuses the floating accordion look, more compact */
  .faq-item-v2.mini{ border-bottom:1px solid var(--grey-200); }
  .faq-item-v2.mini:first-child{ border-top:none; }
  .faq-item-v2.mini:last-child{ border-bottom:none; }
  .faq-item-v2.mini .faq-row{ padding:18px 2px; }
  .faq-item-v2.mini .faq-q{ font-size:17px; font-weight:500; color:var(--ink); }
  .faq-item-v2.mini .faq-toggle-icon{ font-size:18px; }
  .faq-item-v2.mini .faq-answer-row.open{ max-height:110px; }
  .faq-item-v2.mini .faq-answer-row p{ font-size:15px; margin:0 2px 16px; }

  /* surprise box container — "Anything out of these" */
  .fold{ grid-template-columns:minmax(0,1fr) minmax(0,1fr); }
  .rd{ min-width:0; }
  .bundle-box{ overflow:hidden; background:var(--grey-50); border:1px solid var(--grey-200); border-radius:16px; padding:20px; margin-bottom:28px; }
  .bundle-head{ display:flex; align-items:baseline; justify-content:space-between; gap:10px; padding:0 2px 14px; }
  .bundle-head b{ font-size:17px; font-weight:700; letter-spacing:-0.01em; color:var(--ink); }
  .bundle-head span{ font-size:14px; color:var(--grey-500); }
  .mq-viewport{ overflow:hidden; border-radius:12px; -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%); mask-image:linear-gradient(90deg, transparent 0, #000 5%, #000 95%, transparent 100%); }
  .mq-track{ display:flex; width:max-content; animation:mqRight 42s linear infinite; }
  .mq-viewport:hover .mq-track{ animation-play-state:paused; }
  @keyframes mqRight{ from{ transform:translateX(-50%); } to{ transform:translateX(0); } }
  .mq-group{ display:flex; gap:10px; padding-right:10px; flex-shrink:0; }
  .mq-card{ flex:0 0 128px; width:128px; display:flex; flex-direction:column; padding:8px; border-radius:16px; border:1px solid var(--grey-200); background:#ffffff; }
  .mq-img{ width:100%; aspect-ratio:1 / 1; border-radius:11px; background:#e6e6e6; }
  .mq-name{ padding:10px 3px 4px; font-size:14px; font-weight:600; line-height:1.25; letter-spacing:-0.01em; min-height:45px; color:var(--ink); }
  @container sbpage (max-width:768px){
    .bundle-box{ padding:12px; }
    .bundle-head b{ font-size:14.5px; } .bundle-head span{ font-size:12px; }
    .mq-card{ flex-basis:104px; width:104px; padding:6px; }
    .mq-name{ font-size:12px; min-height:30px; padding:8px 2px 0; }
  }
  @media (prefers-reduced-motion: reduce){ .mq-track{ animation:none; } .mq-viewport{ overflow-x:auto; -webkit-mask-image:none; mask-image:none; } .mq-group[aria-hidden="true"]{ display:none; } }

  /* reels */
  .reels-marquee-section{ background:var(--grey-50); padding:56px 0 48px; }
  .reel-grid{ display:grid; grid-template-columns:repeat(5,1fr); gap:16px; margin-bottom:40px; }
  .marquee-track-outer{ width:100%; overflow:hidden; }
  .marquee-track{ display:flex; width:max-content; animation:marqueeScroll 45s linear infinite; }

  /* how subscriptions work — centered heading + 3-step process (numbered circles, curved dashed connectors) */
  .process-head{ display:flex; flex-direction:column; align-items:center; text-align:center; max-width:520px; margin:0 auto; }
  .process-mark{ display:flex; align-items:center; justify-content:center; margin-bottom:18px; color:var(--ink); }
  .process-heading{ font-size:32px; font-weight:700; line-height:1.2; margin:0 0 12px; color:var(--ink); letter-spacing:-0.01em; }
  .process-subtext{ font-size:16.5px; color:var(--grey-500); line-height:1.6; margin:0; }
  .process-steps{ display:flex; align-items:flex-start; justify-content:center; gap:0; margin-top:76px; }
  .process-step{ display:flex; flex-direction:column; align-items:center; text-align:center; flex:0 0 160px; max-width:160px; }
  .process-num{ font-size:15px; font-weight:700; color:var(--grey-500); margin-bottom:14px; }
  .process-circle{ width:104px; height:104px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:var(--ink); border:1.5px dashed var(--accent); background:var(--sb-secondary); box-sizing:border-box; }
  .process-circle.filled{ border:none; background:radial-gradient(circle at 50% 42%, #ffffff 0%, #ffffff 55%, #f1f3f2 100%); box-shadow:0 10px 26px rgba(47,143,119,.14), 0 2px 6px rgba(0,0,0,.05); }
  .process-title{ font-size:17px; font-weight:600; color:var(--accent); margin:20px 0 9px; text-transform:uppercase; letter-spacing:0.03em; }
  .process-body{ font-size:14px; color:var(--ink); line-height:1.55; max-width:160px; }
  .process-connector{ flex:1 1 auto; min-width:24px; display:flex; align-items:center; justify-content:center; margin-top:67px; }
  .process-connector svg{ width:100%; max-width:100px; height:36px; }
  @container sbpage (max-width:768px){
    .process-steps{ overflow-x:auto; justify-content:flex-start; scrollbar-width:none; -ms-overflow-style:none; padding-bottom:4px; }
    .process-steps::-webkit-scrollbar{ display:none; }
    .process-connector{ min-width:32px; }
  }
  .reel-item{ width:100%; aspect-ratio:9/16; }
  .reel-item svg{ width:32px; height:32px; }

  /* faq — grey bg, compact, 4:3 image, floating accordion */
  .faq-heading{ margin-bottom:32px; max-width:540px; margin-left:auto; margin-right:auto; text-align:center; }
  .faq-heading h2{ font-size:32px; font-weight:600; margin:0 0 10px; line-height:1.2; }
  .faq-heading p{ font-size:16.5px; color:var(--grey-700); margin:0; }
  .faq-accordion{ display:flex; flex-direction:column; }
  .faq-accordion:not(.mini-faq){ max-width:760px; margin-left:auto; margin-right:auto; }
  .faq-item-v2{ border-bottom:1px solid var(--grey-200); transition:background-color .3s ease; }
  .faq-item-v2:first-child{ border-top:none; }
  .faq-item-v2:last-child{ border-bottom:none; }
  .faq-item-v2.highlight{ background:var(--grey-50); }
  .faq-row{ display:flex; align-items:center; justify-content:space-between; padding:20px 2px; cursor:pointer; }
  .faq-row .faq-q{ font-size:19px; font-weight:600; color:var(--ink); }
  .faq-toggle-icon{ font-size:21px; color:var(--grey-700); width:18px; text-align:center; flex-shrink:0; }
  .faq-answer-row{ max-height:0; overflow:hidden; transition:max-height .2s ease; }
  .faq-answer-row.open{ max-height:140px; }
  .faq-answer-row p{ margin:0 2px 20px; font-size:16.5px; font-weight:400; line-height:1.6; color:var(--grey-700); max-width:680px; }
  .faq-answer-row p b{ color:inherit; font-weight:400; }

  /* upsell — tabs, horizontal scroll (4 + peek of 5th), bundle grids */
  .upsell-head-row{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:18px; }
  .upsell-tabs{ display:flex; gap:4px; border:1px solid var(--grey-300); border-radius:999px; padding:4px; flex-shrink:0; }
  .upsell-tab{ border:none; background:none; padding:8px 18px; font-size:14.5px; font-weight:600; color:var(--grey-700); border-radius:999px; }
  .upsell-tab.active{ background:var(--grey-900); color:#fff; }
  .wp-pay-toggle{ display:flex; gap:4px; border:1px solid var(--grey-300); border-radius:10px; padding:4px; width:100%; box-sizing:border-box; }
  .wp-pay-toggle-btn{ flex:1 0 0; min-width:0; border:none; background:none; padding:8px 0; font-size:14.5px; font-weight:600; color:var(--grey-700); border-radius:7px; cursor:pointer; font-family:inherit; white-space:nowrap; }
  .wp-pay-toggle-divider{ align-self:center; width:1px; height:22px; background:#e8e8e8; flex:0 0 auto; }
  .wp-pay-toggle-btn.active{ background:var(--grey-900); color:#fff; }
  .wp-subscribe-cta{ width:100%; box-sizing:border-box; border:none; background:var(--grey-900); color:#fff; border-radius:10px; padding:11px 14px; font-size:15px; font-weight:600; cursor:pointer; font-family:inherit; display:flex; align-items:center; justify-content:space-between; gap:10px; margin:14px 0; position:relative; overflow:hidden; animation:ctaPulse 1.9s ease-in-out infinite; }
  .wp-subscribe-cta::after{ content:''; position:absolute; top:0; left:-80%; width:65%; height:100%; background:linear-gradient(120deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.85) 50%, rgba(255,255,255,0) 100%); animation:ctaShine 1.9s ease-in-out infinite; pointer-events:none; }
  @keyframes ctaShine{ 0%{ left:-80%; } 50%{ left:130%; } 100%{ left:130%; } }
  @keyframes ctaPulse{ 0%,100%{ box-shadow:0 0 0 0 rgba(var(--accent-rgb),.45); transform:scale(1); } 50%{ box-shadow:0 0 0 9px rgba(var(--accent-rgb),0); transform:scale(1.04); } }
  .wp-subscribe-cta.is-disabled{ background:var(--grey-300); color:var(--grey-500); cursor:not-allowed; animation:none; }
  .wp-subscribe-cta.is-disabled::after{ display:none; }
  .wp-subscribe-cta.is-disabled .cta-price{ color:var(--grey-500); }
  .wp-subscribe-cta .cta-text{ display:flex; flex-direction:column; align-items:flex-start; gap:3px; }
  .wp-subscribe-cta .cta-sub{ font-size:15px; font-weight:400; color:#a8a8a8; text-transform:none; }
  .wp-subscribe-cta .cta-label{ font-size:18px; }
  .wp-ship-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:15px; color:var(--ink); box-sizing:border-box; }
  .wp-ship-row b{ font-weight:700; }
  .pin-inline{ flex:1 1 auto; min-width:0; height:42px; display:flex; align-items:center; gap:10px; border:1px solid var(--grey-300); border-radius:10px; padding:0 4px 0 18px; background:var(--white); box-sizing:border-box; cursor:pointer; font-family:inherit; text-align:left; }
  .pin-inline.error{ border-color:#e5484d; background:var(--white); }
  .pin-inline.error .pin-inline-value{ color:#e5484d; }
  .pin-inline.shake{ animation:pin-shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
  @keyframes pin-shake{ 10%,90%{ transform:translateX(-1px); } 20%,80%{ transform:translateX(2px); } 30%,50%,70%{ transform:translateX(-4px); } 40%,60%{ transform:translateX(4px); } }
  .pin-inline.valid{ border-color:var(--grey-300); }
  .pin-inline-value{ flex:1 1 auto; min-width:0; font-family:inherit; font-size:16px; font-weight:500; color:var(--ink); padding:3px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .pin-inline-value.placeholder{ color:var(--grey-400); font-weight:400; }
  .pin-inline-ship{ display:inline-flex; align-items:center; gap:5px; font-size:14.5px; font-weight:600; color:#7cb342; white-space:nowrap; }
  .pin-inline-ship .pin-dot{ font-size:18px; line-height:0; }
  .pin-inline-go{ flex:0 0 auto; width:34px; height:34px; border-radius:10px; background:var(--grey-900); color:#fff; display:flex; align-items:center; justify-content:center; }
  .wp-ship-pincode{ display:inline-flex; align-items:center; gap:6px; cursor:pointer; color:var(--ink); border:1px solid var(--grey-200); border-radius:10px; padding:11px 16px; box-sizing:border-box; background:var(--white); }
  .wp-summary-capsule{ display:inline-flex; align-items:center; gap:5px; height:42px; box-sizing:border-box; cursor:pointer; font-family:inherit; font-size:14px; font-weight:500; color:var(--ink); background:var(--white); border:1px solid var(--grey-300); border-radius:10px; padding:0 13px; white-space:nowrap; flex:0 0 auto; }
  .wp-summary-capsule:hover{ background:var(--grey-50); }
  .wp-freebie-strip{ display:flex; flex-direction:column; gap:14px; }
  .wp-freebie-head{ display:flex; align-items:center; gap:10px; font-size:13px; letter-spacing:.04em; text-transform:uppercase; color:var(--grey-700); white-space:nowrap; }
  .wp-freebie-head-line{ flex:1; height:1px; background:var(--grey-300); }
  .wp-freebie-row-wrap{ display:flex; align-items:center; gap:8px; }
  .wp-freebie-arrow{ flex-shrink:0; width:26px; height:26px; border-radius:50%; border:1px solid var(--grey-300); background:var(--white); display:flex; align-items:center; justify-content:center; color:var(--ink); cursor:pointer; padding:0; }
  .wp-freebie-row{ display:flex; justify-content:flex-start; gap:16px; overflow-x:auto; scrollbar-width:none; padding:0 16px 6px; flex:1; min-width:0; }
  .wp-freebie-row::-webkit-scrollbar{ display:none; }
  .wp-freebie-item{ flex:0 0 calc((100% - 32px - 4 * 16px) / 5); min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px; text-align:center; }
  .wp-freebie-delivery{ font-size:13px; color:var(--ink); font-weight:700; line-height:1.2; }
  .wp-freebie-img{ width:100%; aspect-ratio:1/1; border-radius:14px; background:#ececec; box-sizing:border-box; }
  .wp-freebie-price{ display:flex; align-items:baseline; justify-content:center; gap:5px; flex-wrap:wrap; }
  .wp-freebie-mrp{ font-size:14px; font-weight:600; color:#9a9a9a; text-decoration:line-through; }
  .wp-freebie-free{ font-size:14px; font-weight:800; color:var(--accent); letter-spacing:.01em; }
  .wp-freebie-name{ width:100%; font-size:12.5px; font-weight:500; color:var(--grey-500); line-height:1.3; text-align:center; }
  .upsell-scroll{ display:flex; gap:20px; overflow-x:auto; max-width:var(--maxw); margin:0 auto; padding:0 32px 6px 32px; transition:opacity .2s ease; scrollbar-width:none; -ms-overflow-style:none; }
  .upsell-scroll::-webkit-scrollbar{ display:none; }
  .upsell-card{ flex:0 0 calc((100% - 60px) / 3.9); display:flex; flex-direction:column; background:#fff; border:1px solid #f3f3f3; border-radius:8px; padding:14px; box-sizing:border-box; }
  .upsell-scroll.fading{ opacity:0; }
  .upsell-media{ position:relative; }
  .upsell-img-wrap .img-placeholder{ aspect-ratio:1/1; width:100%; border-radius:9px; }
  .bundle-img-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
  .bundle-tile{ aspect-ratio:1/1; position:relative; border-radius:8px; }
  .bundle-tile-more{ display:flex; align-items:center; justify-content:center; text-align:center; font-size:14px; font-weight:500; color:#000; background:#fdfdfd; border:1px solid #f3f3f3; }
  .bundle-split3{ display:flex; flex-direction:column; gap:7px; }
  .bundle-split3-top{ display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
  .bundle-split3-bottom{ aspect-ratio:2/1; }
  .bundle-split2{ display:flex; flex-direction:column; gap:7px; }
  .bundle-split2 .bundle-tile{ aspect-ratio:16/10; }
  .upsell-badges{ position:absolute; right:8px; bottom:8px; display:flex; gap:4px; }
  .upsell-badge{ display:inline-flex; align-items:center; gap:2px; border-radius:999px; padding:5px 8px; font-size:13px; font-weight:500; white-space:nowrap; }
  .upsell-badge-subscription{ background:#ffebeb; border:1px solid #ff9d9d; color:#ed3a3a; }
  .upsell-badge-bundle{ background:#f5f3ff; border:1px solid #ddd6fe; color:#7c3aed; }
  .upsell-badge-freebies{ background:#f3e8ff; border:1px solid #7300c0; color:#7300c0; }
  .upsell-badge-buyget{ background:var(--accent); border:1px solid var(--accent); color:var(--sb-on-accent); }
  .upsell-badge-byo{ background:#eefdfa; border:1px solid #00786e; color:#00786e; }
  .r-name{ font-size:16px; font-weight:500; line-height:1.45; margin:12px 0 6px; min-height:2.9em; color:var(--ink); font-family:var(--font-body); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
  .upsell-itemstext{ display:flex; align-items:center; gap:7px; font-size:14px; font-weight:400; color:var(--grey-700); margin-bottom:8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .upsell-extra{ min-height:38px; margin-bottom:4px; display:flex; flex-direction:column; justify-content:center; }
  .upsell-extra .upsell-itemstext,
  .upsell-extra .upsell-banner,
  .upsell-extra .upsell-tiers{ margin-bottom:0; }
  .upsell-avatars{ display:flex; flex-shrink:0; }
  .upsell-avatar{ width:19px; height:19px; border-radius:50%; background:#f3f3f3; border:1px solid #fff; margin-left:-8px; box-shadow:inset 0 0 0 1px rgba(0,0,0,0.08); }
  .upsell-avatar:first-child{ margin-left:0; }
  .upsell-banner{ display:flex; align-items:center; gap:7px; border-radius:2px; padding:7px 9px; font-size:13px; font-weight:500; margin-bottom:8px; }
  .upsell-banner-buyget{ background:var(--accent); color:var(--sb-on-accent); }
  .upsell-banner-byo{ background:#e8fff6; color:#007a55; font-weight:600; }
  .upsell-tiers{ display:flex; align-items:center; justify-content:space-between; background:#e8fff6; border-radius:2px; padding:6px 16px; margin-bottom:8px; }
  .upsell-tier{ font-size:13px; font-weight:600; color:#007a55; text-align:center; }
  .upsell-tier-divider{ width:1px; height:15px; background:#c9c9c9; flex-shrink:0; }
  .r-price-row{ display:flex; align-items:baseline; gap:9px; margin-top:2px; margin-bottom:16px; flex-wrap:wrap; }
  .r-mrp{ font-size:14px; font-weight:600; color:var(--grey-500); text-decoration:line-through; font-family:var(--font-body); }
  .r-price{ font-size:14px; font-weight:600; color:var(--ink); font-family:var(--font-body); }
  .r-off{ font-size:12px; font-weight:700; color:var(--sb-on-accent); background:var(--accent); border-radius:999px; padding:4px 8px; margin-left:auto; text-transform:uppercase; letter-spacing:.02em; }
  .r-cta{ width:100%; border:none; background:var(--grey-900); color:var(--white); border-radius:9px; padding:11px; font-size:16px; font-weight:600; font-family:var(--font-body); }

  /* marquee — continuous right-to-left scroll, no bg */
  .marquee-section{ width:100%; overflow:hidden; padding:32px 0; }
  .marquee-group{ display:flex; align-items:center; flex-shrink:0; }
  .marquee-item{ font-size:28px; font-weight:400; color:var(--grey-700); white-space:nowrap; padding:0 20px; }
  .marquee-dot{ display:inline-block; width:7px; height:7px; border-radius:50%; background:var(--accent); flex-shrink:0; }
  @keyframes marqueeScroll{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }

  .banner-carousel-section{ margin:56px 0; }
  .banner-carousel-viewport{ position:relative; width:100%; overflow:hidden; }
  .banner-slide-track{ display:flex; width:300%; transition:transform .5s ease; }
  .banner-slide{ width:33.3333%; flex-shrink:0; }
  .banner-img{ width:100%; aspect-ratio:21/8; border-radius:0; }
  .dots-overlay{ position:absolute; right:20px; bottom:18px; background:rgba(255,255,255,.85); padding:6px 10px; border-radius:999px; z-index:2; }
  .dots{ display:flex; gap:7px; flex-shrink:0; padding-bottom:4px; }
  .dots .dot{ width:5px; height:5px; border-radius:50%; background:var(--grey-300); cursor:pointer; }
  .dots .dot.active{ background:var(--grey-900); }

  /* reviews */
  /* reviews — horizontal slider, 3 visible, uniform card size, scales past 5+ */
  .reviews-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
  .review-card-v2{ background:var(--grey-50); border:1px solid var(--grey-200); border-radius:var(--radius); padding:28px; min-height:220px; display:flex; flex-direction:column; justify-content:flex-start; }
  .rc-top{ display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; }
  .rc-quote{ opacity:1; display:inline-block; font-family:Georgia,'Times New Roman',serif; font-size:57px; line-height:0.7; font-weight:700; color:var(--accent); height:34px; }
  .rc-rating{ display:flex; align-items:center; gap:6px; flex-shrink:0; }
  .rc-stars{ display:flex; gap:2px; }
  .rc-score{ font-size:14px; font-weight:600; color:var(--ink); border:1px solid var(--grey-300); border-radius:999px; padding:2px 8px; }
  .rc-text{ font-size:20px; line-height:1.6; color:var(--grey-800); }
  .rc-person{ display:flex; align-items:center; gap:10px; margin-top:auto; padding-top:14px; }
  .rc-avatar{ width:34px; height:34px; border-radius:50%; background:var(--white); border:1px solid var(--grey-200); flex-shrink:0; }
  .rc-name{ font-size:15px; font-weight:600; color:var(--ink); }
  .rc-loc{ font-size:13.5px; color:var(--grey-700); }

  /* banners — stacked */

  footer.site-footer{ background:var(--grey-900); padding:12px 0; opacity:0; transform:translateY(8px); transition:opacity .5s ease, transform .5s ease; }
  footer.site-footer.revealed{ opacity:1; transform:translateY(0); }
  .footer-mini-inner{ display:flex; align-items:center; justify-content:flex-end; gap:8px; }
  .powered-label{ font-size:12px; color:var(--grey-300); letter-spacing:.08em; }
  .stackback-mark{ display:flex; align-items:center; gap:6px; font-size:16px; font-weight:600; color:#fff; }
  .sb-icon{ position:relative; width:15px; height:12px; display:inline-block; }
  .sb-bar{ position:absolute; width:10px; height:5px; transform:skewX(-20deg); border-radius:1px; }
  .sb-bar-1{ background:#fff; top:0; left:3px; }
  .sb-bar-2{ background:var(--accent); bottom:0; left:0; }

  /* sticky bar — narrower, name one line, price inside the CTA, always visible */
  .sticky-bar-wrap{ position:fixed; left:50%; bottom:16px; transform:translateX(-50%); width:620px; z-index:60; }
  .sticky-ticker{ width:280px; margin:0 auto; background:var(--grey-900); color:var(--white); text-align:center; font-size:12px; letter-spacing:.05em; padding:7px 14px; border-radius:22px 22px 0 0; box-sizing:border-box; white-space:nowrap; }
  .sticky-ticker .accent{ color:var(--accent); font-weight:600; }
  .sticky-bar{ background:var(--grey-50); border:1px solid var(--accent); border-radius:22px; padding:8px 8px 8px 10px; display:flex; align-items:center; justify-content:space-between; gap:12px; box-shadow:0 6px 18px rgba(0,0,0,.08); }
  .sticky-img{ width:50px; height:50px; border-radius:16px; background:var(--grey-200); flex-shrink:0; }
  .sticky-left{ min-width:0; flex:1; overflow:hidden; }
  .sticky-name{ font-size:15.5px; font-weight:600; color:var(--ink); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sticky-meta{ font-size:13.5px; color:var(--grey-700); margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .sticky-cta{ flex-shrink:0; background:var(--grey-900); color:#fff; border:none; border-radius:16px; padding:10px 16px; font-size:15px; font-weight:600; display:flex; align-items:center; gap:10px; }
  .sticky-cta.is-disabled{ background:var(--grey-300); color:var(--grey-500); cursor:not-allowed; }
  .sticky-cta .cta-label, .wp-subscribe-cta .cta-label{ text-transform:uppercase; }
  .sticky-cta .cta-divider, .wp-subscribe-cta .cta-divider{ opacity:.5; font-weight:400; }
  .sticky-cta .cta-price, .wp-subscribe-cta .cta-price{ font-size:19px; font-weight:700; color:var(--accent); }
  .sticky-cta .cta-suffix, .wp-subscribe-cta .cta-suffix{ font-size:12px; font-weight:500; margin-left:2px; opacity:.85; }
  .sticky-summary-toggle{ flex-shrink:0; width:30px; height:30px; border-radius:50%; border:1px solid var(--grey-300); background:var(--white); display:flex; align-items:center; justify-content:center; color:var(--ink); cursor:pointer; transition:transform .25s ease; }
  .sticky-summary-toggle.open{ transform:rotate(180deg); }
  .sticky-summary{ width:100%; box-sizing:border-box; max-height:0; overflow:hidden; opacity:0; background:var(--grey-50); border:1px solid var(--accent); border-bottom:none; border-radius:22px 22px 0 0; transition:max-height .3s ease, opacity .25s ease, padding .3s ease; padding:0 20px; }
  .sticky-summary.open{ max-height:320px; opacity:1; padding:16px 20px; }
  .sticky-bar-wrap.summary-open .sticky-ticker{ display:none; }
  .sticky-bar-wrap.summary-open .sticky-bar{ border-top:none; border-radius:0 0 22px 22px; box-shadow:none; }
  .sticky-summary-row{ display:flex; align-items:center; justify-content:space-between; padding:7px 0; }
  .sticky-summary-row + .sticky-summary-row{ border-top:1px solid var(--grey-100); }
  .ss-label{ font-size:14.5px; color:var(--ink); font-weight:600; }
  .ss-value{ font-size:15px; font-weight:700; color:var(--ink); }
  .ss-value.accent{ color:var(--accent); }

  /* ============ RESPONSIVE — MOBILE (<= 768px) ============ */
  @container sbpage (max-width:768px){
    .wrap{ padding:0 16px; }
    .section{ padding:36px 0; }
    .section-head h2{ font-size:23px; }
    .section-head p{ font-size:15px; }

    .desktop-only{ display:none !important; }
    .mobile-only{ display:flex; }

    .announcement{ font-size:13px; padding:10px 20px; gap:4px 14px; text-align:center; }
    .announcement .ann-item:first-child{ padding-right:0; border-right:none; }

    .header-grid{ padding:12px 0; gap:10px; }
    .shop-cta{ padding:8px 16px; font-size:14px; }
    .logo-wordmark{ font-size:20px; }
    .menu-btn{ justify-self:end; align-items:center; justify-content:center; background:none; border:none; padding:4px; }

    .fold{ grid-template-columns:minmax(0,1fr); gap:32px; padding:20px 0 32px; }
    .gallery-col{ position:static; }
    .gallery-main{ width:100%; aspect-ratio:1/1; margin:0 auto; align-self:center; background:var(--grey-100); border-style:solid; border-color:var(--grey-200); object-fit:cover; }
    .thumb-row{ gap:8px; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; justify-content:flex-start; }
    .thumb-row::-webkit-scrollbar{ display:none; }
    .thumb{ width:56px; height:56px; }
    .arrow-btn{ width:26px; height:26px; }

    .product-title{ font-size:23px; line-height:1.3; flex:1; min-width:0; }
    .rating-pill{ padding:2px 8px; font-size:13px; }
    .category-row{ gap:8px; }
    .offer-tab-inline{ font-size:12px; padding:5px 11px; }
    .category-subtext{ font-size:14px; }

    .price-onetime-val{ font-size:18px; }
    .price-perdel{ font-size:23px; }
    .price-perdel .price-per{ font-size:15px; }
    .price-saved{ padding:5px 10px; }

    .step-heading{ margin-bottom:14px; }
    .variant-pill{ padding:9px 14px; font-size:15px; }
    .stepper-btn{ width:36px; height:36px; font-size:18px; }
    .stepper-value{ width:36px; font-size:16px; }

    .estimate-strip{ gap:12px; margin:14px 0 26px; }
    .est-item{ padding:0 12px; }
    .est-value{ font-size:16px; }

    .trust-card{ padding:14px; flex-wrap:wrap; }
    .trust-card-title{ font-size:15.5px; }
    .trust-card-sub{ font-size:13.5px; }
    .payment-logos{ margin-top:10px; }

    .faq-item-v2.mini .faq-q{ font-size:17px; }

    .reels-marquee-section{ padding:32px 0 24px; }
    .reel-grid{ display:flex; gap:12px; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; }
    .reel-grid::-webkit-scrollbar{ display:none; }
    .reel-grid .reel-item{ flex:0 0 170px; }

    .variant-dropdown-row{ flex-direction:column; gap:20px; }

    .process-heading{ font-size:24px; }
    .process-subtext{ font-size:15px; }
    .process-steps{ flex-direction:column; align-items:center; gap:32px; margin-top:32px; }
    .process-step{ flex:0 0 auto; max-width:260px; }
    .process-connector{ display:none; }

    .faq-heading h2{ font-size:23px; }
    .faq-heading p{ font-size:15px; }
    .faq-row .faq-q{ font-size:16.5px; }
    .faq-answer-row p{ font-size:16.5px; }

    .upsell-head-row{ flex-direction:column; gap:20px; }
    .upsell-tabs{ width:100%; }
    .upsell-tab{ flex:1; }
    .upsell-scroll{ padding:0 16px 6px 16px; }
    .upsell-card{ flex-basis:78%; }
    .r-name{ font-size:15px; }
    .r-price{ font-size:14.5px; }
    .r-cta{ padding:9px; font-size:14px; }

    .marquee-section{ padding:20px 0; }
    .marquee-item{ font-size:20px; padding:0 14px; }

    .banner-carousel-section{ margin:28px 0; }
    .banner-img{ aspect-ratio:1/1; }

    .reviews-grid{ display:flex; grid-template-columns:none; gap:12px; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; -ms-overflow-style:none; padding-bottom:4px; margin:0 -16px; padding-left:16px; padding-right:16px; }
    .reviews-grid::-webkit-scrollbar{ display:none; }
    .review-card-v2{ padding:20px; min-height:0; flex:0 0 82%; scroll-snap-align:start; box-sizing:border-box; }
    .rc-text{ font-size:14.5px; }

    footer.site-footer{ padding:10px 0; }
    .footer-mini-inner{ gap:6px; justify-content:flex-end; }
    .powered-label{ font-size:11px; }
    .stackback-mark{ font-size:14px; }

    .sticky-bar-wrap{ bottom:12px; width:calc(100% - 24px); max-width:460px; }
    .sticky-ticker{ width:220px; font-size:11px; }
    .sticky-img{ width:42px; height:42px; }
    .sticky-left{ max-width:120px; }
    .sticky-name{ font-size:14px; }
    .sticky-meta{ font-size:12.5px; }
    .sticky-cta{ padding:9px 12px; font-size:14px; }
    .sticky-cta .cta-price{ font-size:17px; }

    .wp-subscribe-cta{ padding:9px 12px; margin:12px 0; }
    .wp-subscribe-cta .cta-label{ font-size:15px; }
    .wp-subscribe-cta .cta-sub{ font-size:12px; }
    .wp-subscribe-cta .cta-price{ font-size:16px; }
    .pin-inline{ height:38px; padding:0 4px 0 14px; gap:8px; }
    .pin-inline-value{ font-size:14px; }
    .pin-inline-go{ width:29px; height:29px; }
    .wp-summary-capsule{ height:38px; font-size:12.5px; padding:0 11px; gap:4px; }
    .sticky-summary-toggle{ width:26px; height:26px; }
    .sticky-summary{ padding:0 14px; }
    .sticky-summary.open{ padding:12px 14px; }
    .ss-label, .ss-value{ font-size:13.5px; }
  }

`}</style>
      <style>{pageThemeCss}</style>
      {fest && <style>{diwaliCss()}</style>}
      <style>{`
  /* ===== THE SAME LOOK AS THE OTHER PAGES — tokens, Inter headings, one grey for empty images, simple sections, even radii ===== */
  .app-shell.app-shell{ --radius:14px; --radius-sm:10px; }
  .app-shell.app-shell.is-diwali{ background-color:${mix(K.paper, "#ffffff", 0.16)}; background-image:none; }
  .app-shell.app-shell.is-diwali h1, .app-shell.app-shell.is-diwali h2, .app-shell.app-shell.is-diwali h3, .app-shell.app-shell.is-diwali .process-heading, .app-shell.app-shell.is-diwali .faq-heading h2{ color:#000000; font-family:var(--font-body); font-weight:700; letter-spacing:-0.02em; }
  .app-shell.app-shell .dw-serif, .app-shell.app-shell.is-diwali .dw-sky-head b{ font-family:var(--font-body); font-weight:700; letter-spacing:-0.02em; }
  .app-shell.app-shell.is-diwali .dw-sky-head b{ font-size:28px; }
  .app-shell.app-shell.is-diwali .img-placeholder, .app-shell.app-shell.is-diwali .gallery-main, .app-shell.app-shell.is-diwali .thumb, .app-shell.app-shell.is-diwali .mq-img, .app-shell.app-shell.is-diwali .sticky-img, .app-shell.app-shell.is-diwali .wp-freebie-img, .app-shell.app-shell.is-diwali .banner-img,
  .app-shell.app-shell.is-diwali .dw-upsell .upsell-card .img-placeholder, .app-shell.app-shell.is-diwali .mq-group .mq-card .mq-img, .app-shell.app-shell.is-diwali .banner-slide .banner-img{ background:#e6e6e6 !important; border:none !important; color:#8a8a8a; }
  .app-shell.app-shell.is-diwali .gallery-main{ box-shadow:none; border-radius:16px; }
  .app-shell.app-shell.is-diwali .dw-upsell{ background:transparent; }
  .app-shell.app-shell.is-diwali .dw-upsell .section-head h2{ font-family:var(--font-body); font-weight:700; letter-spacing:-0.02em; color:#000000; }
  .app-shell.app-shell.is-diwali .dw-upsell .section-head p{ color:var(--grey-700); }
  .app-shell.app-shell.is-diwali .dw-upsell .upsell-tabs{ border-color:#c4c4c4; background:#ffffff; }
  .app-shell.app-shell.is-diwali .dw-upsell .upsell-tab{ color:#6b6b6b; }
  .app-shell.app-shell.is-diwali .dw-upsell .upsell-tab.active{ background:#000000; color:#ffffff; }
  .app-shell.app-shell.is-diwali .dw-upsell .upsell-card, .app-shell.app-shell.is-diwali .mq-card{ background:#ffffff; border:1px solid #e8e8e8; border-radius:16px; box-shadow:none; }
  .app-shell.app-shell.is-diwali .dw-upsell .upsell-card::before, .app-shell.app-shell.is-diwali .mq-card::before{ display:none; }
  .app-shell.app-shell.is-diwali .dw-upsell .r-name, .app-shell.app-shell.is-diwali .dw-upsell .r-price, .app-shell.app-shell.is-diwali .mq-name{ color:#000000; }
  .app-shell.app-shell.is-diwali .dw-upsell .r-cta{ background:#000000; color:#ffffff; }
  .app-shell.app-shell.is-diwali .bundle-box{ background:#ffffff; border:1px solid #e8e8e8; box-shadow:none; border-radius:16px; padding:20px; }
  .app-shell.app-shell.is-diwali .bundle-head{ padding:0 0 14px; flex-direction:row; align-items:center; text-align:left; gap:8px; }
  .app-shell.app-shell.is-diwali .bundle-head b{ font-family:var(--font-body); font-weight:700; letter-spacing:-0.02em; font-size:20px; color:#000000; }
  .app-shell.app-shell.is-diwali .bundle-head span{ color:var(--grey-700); }
  .app-shell.app-shell.is-diwali .bundle-head span::before, .app-shell.app-shell.is-diwali .bundle-head span::after{ display:none; }
  /* the nav: the same logo, the same Go to Shop button, on the night sky */
  .app-shell.app-shell .logo-wordmark{ font-family:var(--font-body); font-weight:700; letter-spacing:-0.02em; font-size:22px; color:#ffffff; }
  .app-shell.app-shell .shop-cta{ background:#ffffff; border:1px solid #c4c4c4; color:#000000; font-weight:600; font-size:13px; padding:9px 20px; border-radius:999px; }
  .app-shell.app-shell.is-diwali header.site-header .header-link{ color:#ffffff; }
  .app-shell.app-shell.is-diwali header.site-header svg[stroke="#1a1a1a"]{ stroke:#ffffff; }
  .sb-only-d{ display:block; } .sb-only-m{ display:none; }
  @container sbpage (max-width:768px){ .sb-only-d{ display:none; } .sb-only-m{ display:block; } .app-shell.app-shell .logo-wordmark{ font-size:18px; } .app-shell.app-shell.is-diwali .dw-upsell .section-head{ text-align:left; } }
  /* ===== ROUND TWO ===== */
  /* the announcement is a ticker (one line at a time) on every size */
  .app-shell.app-shell .announcement{ padding:0 16px; height:36px; gap:0; flex-wrap:nowrap; position:relative; overflow:hidden; font-size:13px; }
  .app-shell.app-shell .announcement .ann-all{ display:none; }
  .app-shell.app-shell .announcement .ann-ticker{ display:block; position:relative; width:100%; height:100%; }
  .app-shell.app-shell .announcement .ann-t{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0; transform:translateY(100%); transition:transform .5s cubic-bezier(.22,1,.36,1), opacity .4s ease; }
  .app-shell.app-shell .announcement .ann-t.on{ opacity:1; transform:none; }
  .app-shell.app-shell .announcement .ann-t.prev{ opacity:0; transform:translateY(-100%); }
  /* the main Subscribe button: the price in gold, like the bottom bar's */
  .app-shell.app-shell.is-diwali .wp-subscribe-cta:not(.is-disabled) .cta-price, .app-shell.app-shell.is-diwali .wp-subscribe-cta:not(.is-disabled) .cta-suffix{ color:${K.gold}; }
  /* the Gift page's diya before every heading */
  .sb-hd-diya{ display:inline-flex; vertical-align:middle; margin-right:8px; position:relative; top:-2px; }
  /* section heads at the Gift page's sizes */
  .app-shell.app-shell .section-head h2, .app-shell.app-shell .process-heading, .app-shell.app-shell .faq-heading h2{ font-size:28px; }
  .app-shell.app-shell .section-head p, .app-shell.app-shell .process-subtext, .app-shell.app-shell .faq-heading p{ font-size:15px; }
  .app-shell.app-shell.is-diwali .dw-upsell{ background:transparent; padding:56px 0 24px; }
  .app-shell.app-shell.is-diwali .dw-sky-head b{ font-size:28px; }
  .app-shell.app-shell.is-diwali .dw-sky-head span{ font-size:15px; }
  .app-shell.app-shell .gx-cell{ flex:0 0 260px; min-width:0; }
  .app-shell.app-shell .sticky-bar-wrap{ transition:opacity .25s ease; }
  .app-shell.app-shell footer.site-footer{ opacity:1; transform:none; transition:none; margin-top:0; }
  @container sbpage (max-width:768px){
    .app-shell.app-shell.app-shell.app-shell .section-head h2, .app-shell.app-shell.app-shell.app-shell .process-heading, .app-shell.app-shell.app-shell.app-shell .faq-heading h2{ font-size:19px; }
    .app-shell.app-shell.app-shell.app-shell .section-head p, .app-shell.app-shell.app-shell.app-shell .process-subtext, .app-shell.app-shell.app-shell.app-shell .faq-heading p{ font-size:12.5px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-sky-head b{ font-size:19px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-sky-head span{ font-size:12.5px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-sky-head{ margin-bottom:16px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-reels-inner{ padding-top:64px; padding-bottom:30px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-upsell{ padding:28px 0 12px; }
    .app-shell.app-shell.app-shell.app-shell .gx-cell{ flex:0 0 58%; }
    .app-shell.app-shell.app-shell.app-shell .sb-widget-mount{ zoom:.86; }
    .app-shell.app-shell.app-shell.app-shell .reel-grid .reel-item{ flex:0 0 156px; }
    .app-shell.app-shell.app-shell.app-shell .reel-grid{ margin:0 -16px; padding:0 16px; scroll-padding-left:16px; background:transparent; }
    .app-shell.app-shell.app-shell.app-shell .reviews-grid{ margin:0 -16px; padding:0 16px 4px; scroll-padding-left:16px; }
    .app-shell.app-shell.app-shell.app-shell .review-card-v2{ scroll-snap-align:start; }
    .sb-hd-diya{ margin-right:6px; }
  }
  /* ===== ROUND FOUR ===== */
  .app-shell.app-shell .upsell-scroll{ margin:0; max-width:none; width:100%; box-sizing:border-box; padding:12px max(32px, calc((100% - 1280px) / 2 + 32px)) 14px; scroll-padding-left:max(32px, calc((100% - 1280px) / 2 + 32px)); background:transparent; }
  @container sbpage (max-width:768px){
    /* one rhythm: 12 between small things, 20 between blocks, 40 between sections */
    .app-shell.app-shell.app-shell.app-shell .section{ padding:40px 0; }
    .app-shell.app-shell.app-shell.app-shell .section-head, .app-shell.app-shell.app-shell.app-shell .faq-heading{ margin-bottom:20px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-upsell{ padding:40px 0 28px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-upsell .section-head, .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-upsell .section-head h2, .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-upsell .section-head p{ text-align:center; }
    .app-shell.app-shell.app-shell.app-shell .upsell-head-row{ gap:20px; align-items:stretch; }
    .app-shell.app-shell.app-shell.app-shell .upsell-scroll{ padding:12px 16px 14px; scroll-padding-left:16px; }
    .app-shell.app-shell.app-shell.app-shell .trust-cards{ gap:12px; margin-bottom:20px; }
    .app-shell.app-shell.app-shell.app-shell .step-block{ margin-bottom:20px; }
    .app-shell.app-shell.app-shell.app-shell .process-steps{ gap:28px; margin-top:28px; }
    .app-shell.app-shell.app-shell.app-shell .marquee-section{ padding:28px 0; }
    .app-shell.app-shell.app-shell.app-shell .banner-carousel-section{ margin:40px 0; }
    .app-shell.app-shell.app-shell.app-shell .reviews-grid{ margin-top:20px; }
    .app-shell.app-shell.app-shell.app-shell.is-diwali .dw-reels-inner{ padding-top:64px; padding-bottom:44px; }
    .app-shell.app-shell.app-shell.app-shell .reel-grid .reel-item{ flex:0 0 calc((100% - 28px) / 1.5); }
    .app-shell.app-shell.app-shell.app-shell .reel-grid{ gap:12px; }
    .app-shell.app-shell.app-shell.app-shell .reels-marquee-section{ padding:0; }
  }
  /* ===== ROUND FIVE ===== */
  .app-shell.app-shell .bag-btn{ background:none; border:none; padding:4px; align-items:center; justify-content:center; }
  .app-shell.app-shell .sticky-ticker{ width:fit-content; max-width:calc(100% - 24px); padding:7px 18px; margin:0 auto; }
  .app-shell.app-shell.app-shell .upsell-scroll{ padding-top:20px; padding-bottom:56px; margin:-20px 0 0; }
  .app-shell.app-shell.is-diwali .dw-upsell{ padding-bottom:0; }
  .app-shell.app-shell .marquee-section{ margin-top:48px; }
  @container sbpage (max-width:768px){
    .app-shell.app-shell.app-shell.app-shell .shop-cta{ display:none; }
    .app-shell.app-shell.app-shell.app-shell .marquee-section{ margin-top:0; }
    .app-shell.app-shell.app-shell.app-shell .menu-btn{ order:-1; justify-self:auto; }
    .app-shell.app-shell.app-shell.app-shell .header-grid{ align-items:center; }
    .app-shell.app-shell.app-shell.app-shell .sticky-ticker{ width:fit-content; padding:5px 14px; }
    .app-shell.app-shell.app-shell.app-shell .upsell-scroll{ gap:12px; padding-top:20px; padding-bottom:48px; margin:-20px 0 -48px; }
  }
  /* ===== ROUND SIX — "Anything out of these", in the Gift page's card style ===== */
  .app-shell.app-shell .sb-any-head{ display:flex; flex-direction:column; gap:4px; }
  .app-shell.app-shell .sb-any-head b{ font-family:var(--font-body); font-size:20px; font-weight:700; letter-spacing:-0.02em; }
  .app-shell.app-shell .sb-any-head span{ font-size:13px; }
  .app-shell.app-shell .sb-any .mq-viewport{ border-radius:0; -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 4%, #000 96%, transparent 100%); mask-image:linear-gradient(90deg, transparent 0, #000 4%, #000 96%, transparent 100%); }
  .app-shell.app-shell .sb-any .mq-group{ gap:12px; padding-right:12px; }
  .app-shell.app-shell .sb-any .mq-cell{ flex:0 0 190px; min-width:0; }
  @container sbpage (max-width:768px){ .app-shell.app-shell.app-shell.app-shell .sb-any .mq-cell{ flex:0 0 150px; } .app-shell.app-shell.app-shell.app-shell .sb-any-head b{ font-size:19px; } .app-shell.app-shell.app-shell.app-shell .sb-any-head span{ font-size:12.5px; } }
  /* ===== ROUND SEVEN — the Surprise Box page: a little lifted, a little more premium ===== */
  .app-shell.app-shell .sb-any{ margin:0 0 24px; }
  .app-shell.app-shell .sb-any-box{ position:relative; overflow:hidden; border-radius:18px; border:1.5px solid ${DIWALI.goldEdge}; padding:22px 0 12px; box-shadow:0 22px 44px -30px ${rgba(K.nightDeep, 0.6)}; }
  .app-shell.app-shell .sb-any-head{ position:relative; padding:0 20px; margin-bottom:14px; }
  .app-shell.app-shell .sb-any-head b{ color:#ffffff; }
  .app-shell.app-shell .sb-any-head span{ color:${K.creamSoft}; }
  .app-shell.app-shell .sb-any .mq-viewport{ padding:8px 0 22px; margin:0; }
  .app-shell.app-shell.is-surprise.is-diwali{ background-image:radial-gradient(ellipse 75% 38% at 50% 0%, ${rgba(K.marigold, 0.18)}, transparent 72%), radial-gradient(circle at 94% 26%, ${rgba(K.marigold, 0.1)}, transparent 34%), radial-gradient(circle at 4% 46%, ${rgba(K.kumkum, 0.07)}, transparent 36%), ${SPARK_TILE}; background-size:auto, auto, auto, 520px 520px; }
  .app-shell.app-shell.is-surprise .gallery-main{ border-radius:20px; box-shadow:0 0 0 1px ${DIWALI.goldSoft}, 0 28px 52px -32px ${rgba(K.nightDeep, 0.55)}; }
  .app-shell.app-shell.is-surprise .thumb{ box-shadow:0 0 0 1px ${rgba(K.marigold, 0.25)}; }
  .app-shell.app-shell.is-surprise .product-title{ letter-spacing:-0.03em; }
  .app-shell.app-shell.is-surprise .offer-tab-inline::before{ content:"✦"; color:${K.gold}; margin-right:6px; }
  .app-shell.app-shell.is-surprise .step-heading{ display:flex; align-items:center; gap:8px; letter-spacing:.08em; }
  .app-shell.app-shell.is-surprise .step-heading::before{ content:"✦"; color:${K.marigoldDeep}; font-size:11px; }
  .app-shell.app-shell.is-surprise .price-saved{ box-shadow:inset 0 0 0 1px ${rgba(K.marigoldDeep, 0.6)}, 0 6px 14px -8px ${rgba(K.marigoldDeep, 0.8)}; }
  .app-shell.app-shell.is-surprise .trust-card:first-child{ box-shadow:0 14px 28px -22px ${rgba(K.marigoldDeep, 0.9)}; }
  /* ===== COMMON UI — the same announcement bar as every other page: a black bar, small type, the highlighted phrase in gold ===== */
  .app-shell.app-shell .announcement{ background:#000000; color:rgba(255,255,255,.92); }
  .app-shell.app-shell .announcement .accent{ color:${K.gold}; font-weight:600; }
`}</style>
      <style>{`
  /* ===== MOBILE POLISH — an ideal phone type scale (14px body, 12–13px secondary, 18–20px headings) + tighter vertical rhythm ===== */
  @container sbpage (max-width:768px){
    .app-shell.app-shell.app-shell { font-size:14px; line-height:1.45; -webkit-text-size-adjust:100%; }
    .app-shell.app-shell.app-shell .wrap{ padding:0 16px; }
    .app-shell.app-shell.app-shell .section{ padding:24px 0; }
    .app-shell.app-shell.app-shell .section-head{ margin-bottom:14px; }
    .app-shell.app-shell.app-shell .section-head h2{ font-size:19px; margin:0 0 4px; }
    .app-shell.app-shell.app-shell .section-head p{ font-size:13px; }

    /* announcement → ticker */
    .app-shell.app-shell.app-shell .announcement{ padding:0 16px; font-size:12px; height:34px; gap:0; flex-wrap:nowrap; position:relative; overflow:hidden; }
    .app-shell.app-shell.app-shell .announcement .ann-all{ display:none; }
    .app-shell.app-shell.app-shell .announcement .ann-ticker{ display:block; position:relative; width:100%; height:100%; }
    .app-shell.app-shell.app-shell .announcement .ann-t{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; opacity:0; transform:translateY(100%); transition:transform .5s cubic-bezier(.22,1,.36,1), opacity .4s ease; }
    .app-shell.app-shell.app-shell .announcement .ann-t.on{ opacity:1; transform:none; }
    .app-shell.app-shell.app-shell .announcement .ann-t.prev{ opacity:0; transform:translateY(-100%); }

    /* header */
    .app-shell.app-shell.app-shell .header-grid{ padding:10px 16px; gap:8px; }
    .app-shell.app-shell.app-shell .shop-cta{ padding:6px 14px; font-size:12.5px; }
    .app-shell.app-shell.app-shell .logo-wordmark{ font-size:18px; }

    /* gallery: the picture sits inside the page padding; the thumbnails are centred with an arrow on each side */
    .app-shell.app-shell.app-shell .fold{ gap:14px; padding:14px 0 18px; }
    .app-shell.app-shell.app-shell .gallery-col{ margin:0; }
    .app-shell.app-shell.app-shell .thumb-row{ margin-top:12px; padding:0; gap:8px; justify-content:center; overflow:visible; }
    .app-shell.app-shell.app-shell .arrow-btn{ display:flex; width:26px; height:26px; }
    .app-shell.app-shell.app-shell .thumb{ width:50px; height:50px; border-radius:10px; }

    /* product block */
    .app-shell.app-shell.app-shell .product-title{ font-size:19px; line-height:1.25; }
    .app-shell.app-shell.app-shell .rating-pill{ padding:2px 7px; font-size:11.5px; }
    .app-shell.app-shell.app-shell .category-row{ margin:4px 0 2px; gap:8px; }
    .app-shell.app-shell.app-shell .offer-tab-inline{ font-size:10.5px; padding:4px 9px; margin-top:0; }
    .app-shell.app-shell.app-shell .category-subtext{ font-size:11.5px; }
    .app-shell.app-shell.app-shell .desc-row{ margin:6px 0 8px; gap:10px; }
    .app-shell.app-shell.app-shell .product-desc{ font-size:13px; line-height:1.45; margin-bottom:6px; }
    .app-shell.app-shell.app-shell .price-row{ margin-bottom:16px; gap:8px 10px; }
    .app-shell.app-shell.app-shell .price-onetime-val{ font-size:15px; }
    .app-shell.app-shell.app-shell .price-perdel{ font-size:21px; }
    .app-shell.app-shell.app-shell .price-perdel .price-per{ font-size:12.5px; }
    .app-shell.app-shell.app-shell .price-saved{ padding:4px 9px; }
    .app-shell.app-shell.app-shell .price-saved-amt{ font-size:11.5px; }
    .app-shell.app-shell.app-shell .step-heading{ font-size:11px; margin-bottom:10px; letter-spacing:.05em; }
    .app-shell.app-shell.app-shell .step-block{ margin-bottom:0; }
    .app-shell.app-shell.app-shell .variant-block{ margin-bottom:12px; }
    .app-shell.app-shell.app-shell .variant-label{ font-size:13px; margin-bottom:7px; }
    .app-shell.app-shell.app-shell .variant-pills{ gap:8px; }
    .app-shell.app-shell.app-shell .variant-pill{ padding:8px 13px; font-size:13px; }
    .app-shell.app-shell.app-shell .variant-select{ padding:10px 34px 10px 14px; font-size:13.5px; }
    .app-shell.app-shell.app-shell .variant-dropdown-row{ gap:12px; margin-bottom:12px; }
    .app-shell.app-shell.app-shell .stepper-btn{ width:32px; height:32px; font-size:16px; }
    .app-shell.app-shell.app-shell .stepper-value{ width:32px; font-size:14px; }
    .app-shell.app-shell.app-shell .sb-widget-mount{ zoom:.9; }
    .app-shell.app-shell.app-shell .estimate-strip{ margin:10px 0 16px; }
    .app-shell.app-shell.app-shell .est-item{ padding:0 10px; }
    .app-shell.app-shell.app-shell .est-label{ font-size:10px; }
    .app-shell.app-shell.app-shell .est-value{ font-size:14px; }
    .app-shell.app-shell.app-shell .trust-cards{ gap:8px; margin-bottom:18px; }
    .app-shell.app-shell.app-shell .trust-card, .app-shell.app-shell.app-shell .trust-card-autopay{ padding:11px 12px; gap:10px; }
    .app-shell.app-shell.app-shell .trust-icon{ width:30px; height:30px; }
    .app-shell.app-shell.app-shell .trust-card-title{ font-size:13.5px; margin-bottom:2px; }
    .app-shell.app-shell.app-shell .trust-card-sub{ font-size:12px; }
    .app-shell.app-shell.app-shell .payment-logos{ margin-top:8px; }
    .app-shell.app-shell.app-shell .price-summary{ padding:14px 16px; margin-bottom:18px; gap:8px; }
    .app-shell.app-shell.app-shell .price-summary .ps-label, .app-shell.app-shell.app-shell .price-summary .ps-value{ font-size:14px; }
    .app-shell.app-shell.app-shell .price-summary .ps-multiplier{ font-size:13px; }
    .app-shell.app-shell.app-shell .faq-item-v2.mini .faq-row{ padding:12px 2px; }
    .app-shell.app-shell.app-shell .faq-item-v2.mini .faq-q{ font-size:14px; }
    .app-shell.app-shell.app-shell .faq-item-v2.mini .faq-answer-row p{ font-size:13px; margin:0 2px 12px; }

    /* sections lower down */
    .app-shell.app-shell.app-shell .marquee-section{ padding:14px 0; }
    .app-shell.app-shell.app-shell .marquee-item{ font-size:15px; padding:0 12px; }
    .app-shell.app-shell.app-shell .reels-marquee-section{ padding:22px 0 18px; }
    .app-shell.app-shell.app-shell .reel-grid .reel-item{ flex:0 0 130px; }
    .app-shell.app-shell.app-shell .process-heading{ font-size:20px; margin-bottom:6px; }
    .app-shell.app-shell.app-shell .process-subtext{ font-size:13px; line-height:1.5; }
    .app-shell.app-shell.app-shell .process-mark{ margin-bottom:10px; }
    .app-shell.app-shell.app-shell .process-steps{ gap:20px; margin-top:20px; }
    .app-shell.app-shell.app-shell .process-step{ max-width:240px; }
    .app-shell.app-shell.app-shell .process-num{ font-size:12px; margin-bottom:8px; }
    .app-shell.app-shell.app-shell .process-circle{ width:76px; height:76px; }
    .app-shell.app-shell.app-shell .process-title{ font-size:14px; margin:12px 0 5px; }
    .app-shell.app-shell.app-shell .process-body{ font-size:12.5px; line-height:1.45; }
    .app-shell.app-shell.app-shell .upsell-head-row{ gap:12px; }
    .app-shell.app-shell.app-shell .upsell-card{ flex-basis:68%; }
    .app-shell.app-shell.app-shell .r-name{ font-size:13.5px; }
    .app-shell.app-shell.app-shell .r-price{ font-size:13px; }
    .app-shell.app-shell.app-shell .r-cta{ padding:8px; font-size:13px; }
    .app-shell.app-shell.app-shell .banner-carousel-section{ margin:20px 0; }
    .app-shell.app-shell.app-shell .review-card-v2{ padding:16px; }
    .app-shell.app-shell.app-shell .rc-text{ font-size:13px; line-height:1.5; }
    .app-shell.app-shell.app-shell .faq-heading{ margin-bottom:16px; }
    .app-shell.app-shell.app-shell .faq-heading h2{ font-size:19px; margin-bottom:4px; }
    .app-shell.app-shell.app-shell .faq-heading p{ font-size:13px; }
    .app-shell.app-shell.app-shell .faq-row .faq-q{ font-size:14.5px; }
    .app-shell.app-shell.app-shell .faq-answer-row p{ font-size:13.5px; }
    .app-shell.app-shell.app-shell footer.site-footer{ padding:8px 0; }

    /* the bottom bar: the product line on top, the CTA stacked full width underneath */
    .app-shell.app-shell.app-shell .sticky-bar-wrap{ bottom:10px; width:calc(100% - 20px); max-width:none; }
    .app-shell.app-shell.app-shell .sticky-ticker{ width:200px; font-size:10.5px; padding:5px 12px; }
    .app-shell.app-shell.app-shell .sticky-bar{ display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:10px; padding:10px; border-radius:18px; }
    .app-shell.app-shell.app-shell .sticky-img{ width:40px; height:40px; border-radius:12px; }
    .app-shell.app-shell.app-shell .sticky-left{ max-width:none; min-width:0; }
    .app-shell.app-shell.app-shell .sticky-name{ font-size:13px; }
    .app-shell.app-shell.app-shell .sticky-meta{ font-size:11.5px; margin-top:2px; }
    .app-shell.app-shell.app-shell .sticky-cta{ grid-column:1 / -1; width:100%; justify-content:space-between; padding:11px 14px; border-radius:12px; font-size:13px; }
    .app-shell.app-shell.app-shell .sticky-cta .cta-price{ font-size:16px; }
    .app-shell.app-shell.app-shell .sticky-cta .cta-suffix{ font-size:11px; }
    .app-shell.app-shell.app-shell .sticky-summary-toggle{ width:24px; height:24px; }
    .app-shell.app-shell.app-shell .sticky-summary{ padding:0 14px; }
    .app-shell.app-shell.app-shell .sticky-summary.open{ padding:10px 14px; }
    .app-shell.app-shell.app-shell .ss-label, .app-shell.app-shell.app-shell .ss-value{ font-size:12.5px; }

    /* Diwali sections that carry their own sizes */
    .app-shell.app-shell.app-shell .bundle-head b{ font-size:17px; }
    .app-shell.app-shell.app-shell .bundle-head span{ font-size:12px; }
    .app-shell.app-shell.app-shell .bundle-box{ padding:34px 0 24px; }
  }
`}</style>

      {(() => {
        const items = isSB ? SURPRISE.announce[fest ? 'diwali' : 'normal'] : NORMAL_ANNOUNCE, cur = annIdx % items.length, prev = (cur - 1 + items.length) % items.length;
        return (
          <div className="announcement">
            <div className="ann-all">{items.map((t, k) => <span className="ann-item" key={k}>{t}</span>)}</div>
            {/* mobile: a ticker — one sentence at a time, sliding up */}
            <div className="ann-ticker" role="status" aria-live="off">
              {items.map((t, k) => <span className={'ann-t' + (k === cur ? ' on' : k === prev && items.length > 1 ? ' prev' : '')} key={k}>{t}</span>)}
            </div>
          </div>
        );
      })()}

      {fest ? (
        <>
          <NightPanel style={{ background: NIGHT_GRAD }} sky={{ seed: 3, lights: false, starDensity: 700, fireworks: P.d ? [[0.3, 0.45, 18, K.rani, 0.6, 12], [0.7, 0.4, 22, K.gold, 1.8, 14]] : [[0.3, 0.5, 8, K.rani, 0.6, 10], [0.7, 0.45, 10, K.gold, 1.8, 10]] }}>
      <header className="site-header">
            <div className="wrap header-grid">
              <button className="shop-cta">Go to Shop</button>
              <div className="logo-wordmark">Your Brand</div>
<button className="bag-btn mobile-only" aria-label="Cart"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6"><path d="M4 6h2l1.5 12h11L20 8H7" /><circle cx="10" cy="21" r="1" /><circle cx="17" cy="21" r="1" /></svg></button>
              <button className="menu-btn mobile-only" aria-label="Menu">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6">
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </svg>
              </button>
              <div className="header-icons desktop-only">
                <a className="header-link" href="#">
                  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c1.8-4 5-6 8-6s6.2 2 8 6" />
                  </svg>
                  Login
                </a>
                <a className="header-link" href="#">
                  <span className="cart-icon-wrap">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6">
                      <path d="M4 6h2l1.5 12h11L20 8H7" />
                      <circle cx="10" cy="21" r="1" />
                      <circle cx="17" cy="21" r="1" />
                    </svg>
                    <span className="cart-badge">2</span>
                  </span>
                  Cart
                </a>
              </div>
            </div>
          </header>
          </NightPanel>
          <div aria-hidden="true" style={{ height: 2, background: DIWALI.goldEdge }} />
          <div aria-hidden="true" style={{ position: 'relative', height: 0, zIndex: 3 }}>
            <div className="sb-only-d"><GIFT.SideLanterns d /></div>
          </div>
        </>
      ) : (
      <header className="site-header">
        <div className="wrap header-grid">
          <button className="shop-cta">Go to Shop</button>
          <div className="logo-wordmark">Your Brand</div>
<button className="bag-btn mobile-only" aria-label="Cart"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6"><path d="M4 6h2l1.5 12h11L20 8H7" /><circle cx="10" cy="21" r="1" /><circle cx="17" cy="21" r="1" /></svg></button>
          <button className="menu-btn mobile-only" aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          <div className="header-icons desktop-only">
            <a className="header-link" href="#">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c1.8-4 5-6 8-6s6.2 2 8 6" />
              </svg>
              Login
            </a>
            <a className="header-link" href="#">
              <span className="cart-icon-wrap">
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="1.6">
                  <path d="M4 6h2l1.5 12h11L20 8H7" />
                  <circle cx="10" cy="21" r="1" />
                  <circle cx="17" cy="21" r="1" />
                </svg>
                <span className="cart-badge">2</span>
              </span>
              Cart
            </a>
          </div>
        </div>
      </header>
      )}

      <div className="wrap">
        <div className="fold">
          {/* LEFT DIVISION — GALLERY */}
          <div className="gallery-col">
            <div className="img-placeholder gallery-main">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.4">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
              <span>Main product image</span>
            </div>
            <div className="thumb-row">
              <button className="arrow-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5c5c5c" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="img-placeholder thumb" key={i}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                  </svg>
                </div>
              ))}
              <button className="arrow-btn">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5c5c5c" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* RIGHT DIVISION */}
          <div className="rd">
            <div className="name-row">
              <h1 className="product-title">
                {isSB ? SURPRISE.title : 'Signature Collection — Subscription Edition'}
              </h1>
              <span className="offer-tab-inline">{isSB ? SURPRISE.off : 'Upto 30% OFF'}</span>
            </div>
            <div className="desc-row">
              <p className="product-desc">
                {isSB ? (descExpanded ? SURPRISE.descFull : SURPRISE.descShort) : (descExpanded
                  ? 'Made in small batches every week, our signature collection brings together premium ingredients with a finish you\u2019ll notice. Sourced directly from trusted partners and shipped within 48 hours of production, so every delivery feels like it was made for this exact moment. '
                  : 'Made in small batches every week, our signature collection brings together premium ingredients with a finish you\u2019ll notice... ')}
                <span className="product-desc-toggle" onClick={() => setDescExpanded((v) => !v)}>
                  {descExpanded ? 'SHOW LESS' : 'READ MORE'}
                </span>
              </p>
              <span className="rating-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" stroke="none">
                  <path d="M12 2l3 7h7l-5.5 4.2L18.5 21 12 16.8 5.5 21l2-7.8L2 9h7z" />
                </svg>
                {isSB ? SURPRISE.rating : 4.3}
              </span>
            </div>

            <div className="price-row">
              <span className="price-onetime">
                <span className="price-onetime-val">₹{pricing.oneTime.toLocaleString('en-IN')}</span>
              </span>
              <span className="price-perdel">₹{pricing.perDelivery.toLocaleString('en-IN')}<span className="price-per">/delivery</span></span>
              <span className="price-saved">
                <span className="price-saved-amt">SAVED ₹{pricing.perDeliverySaved.toLocaleString('en-IN')}</span>
              </span>
            </div>

            {/* STEP 1 — VARIANT & QUANTITY */}
            <div className="step-block">
              <div className="step-heading">{isSB ? '1. Your surprise box' : <>1. Choose variant &amp; quantity</>}</div>

              {isSB ? (
                <SurpriseCarousel fest={fest} items={SURPRISE.boxItems} d={!!P.d} />
              ) : variantStyle === 'dropdown' ? (
                <div className="variant-dropdown-row">
                  <div className="variant-block variant-block-half">
                    <div className="variant-label">
                      Type: <b>{selectedVariant}</b>
                    </div>
                    <select
                      className="variant-select"
                      value={selectedVariant}
                      onChange={(e) => setSelectedVariant(e.target.value)}
                    >
                      {VARIANTS.map((variant) => (
                        <option key={variant} value={variant}>{variant}</option>
                      ))}
                    </select>
                  </div>

                  <div className="variant-block variant-block-half">
                    <div className="variant-label">
                      Quantity: <b>{qty.label}</b>
                    </div>
                    <select
                      className="variant-select"
                      value={qtyIndex}
                      onChange={(e) => setQtyIndex(Number(e.target.value))}
                    >
                      {QUANTITY_OPTIONS.map((opt, i) => (
                        <option key={opt.label} value={i}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <>
                  <div className="variant-block">
                    <div className="variant-label">
                      Type: <b>{selectedVariant}</b>
                    </div>
                    <div className="variant-pills">
                      {VARIANTS.map((variant) => (
                        <button
                          key={variant}
                          className={`variant-pill${selectedVariant === variant ? ' selected' : ''}`}
                          onClick={() => setSelectedVariant(variant)}
                        >
                          {variant}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="variant-block">
                    <div className="variant-label">
                      Quantity: <b>{qty.label}</b>
                    </div>
                    <div className="variant-pills">
                      {QUANTITY_OPTIONS.map((opt, i) => (
                        <button
                          key={opt.label}
                          className={`variant-pill${qtyIndex === i ? ' selected' : ''}`}
                          onClick={() => setQtyIndex(i)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="variant-block">
                <div className="variant-label">
                  {isSB ? 'Boxes' : 'Units'} per Delivery: <b>{packCount}</b>
                </div>
                <div className="qty-stepper">
                  <button className="stepper-btn" onClick={() => setPackCount((p) => Math.max(1, p - 1))}>
                    &minus;
                  </button>
                  <span className="stepper-value">{packCount}</span>
                  <button className="stepper-btn" onClick={() => setPackCount((p) => Math.min(10, p + 1))}>
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* STEP 2 — PLAN */}
            <div className="step-block">
              <div className="step-heading">2. Choose your plan</div>
              <div className="sb-widget-mount" ref={widgetRef}>
                <ActiveWidget key={`${activeWidget}-${page}`} brand={widgetBrand} onSelectionChange={setCtaInfo} showOneTime={showOneTime} pricing={pricing} pinErrorSignal={pinErrorSignal} endless={endless} />
              </div>
            </div>

            {ctaInfo.payType !== 'onetime' && (
            <div className="estimate-strip">
              <div className="estimate-stats">
                <div className="est-item">
                  <span className="est-label">Next delivery</span>
                  <span className="est-value">
                    {(ctaInfo.estimate?.frequency && ctaInfo.estimate.frequency !== 'One-time')
                      ? nextDeliveryDate(ctaInfo.estimate.frequency)
                      : '—'}
                  </span>
                </div>
                <div className="est-item">
                  <span className="est-label">{ctaInfo.payType === 'upfront' && ctaInfo.perDelivery != null ? 'Per Delivery' : 'Next charge'}</span>
                  <span className="est-value">
                    {ctaInfo.payType === 'upfront' && ctaInfo.perDelivery != null
                      ? <>₹{ctaInfo.perDelivery.toLocaleString('en-IN')}</>
                      : <>₹{(ctaInfo.estimate?.nextCharge ?? ctaInfo.price).toLocaleString('en-IN')}</>}
                  </span>
                </div>
                <div className="est-item">
                  <span className="est-label">Total Savings</span>
                  <span className="est-value">₹{(ctaInfo.saved ?? saved).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            )}

            {/* TRUST CARDS */}
            <div className="trust-cards">
              <div className="trust-card trust-card-autopay">
                <div className="trust-card-autopay-text">
                  <div className="trust-card-title">Secure Auto-Pay</div>
                  <div className="trust-card-sub">Powered by Razorpay</div>
                </div>
                <div className="payment-logos">
                  <span className="pay-logo" title="Google Pay">
                    <svg width="32" height="17" viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg">
                      <path fill="#4285F4" d="M23.3 12.3c0-.63-.06-1.24-.16-1.82H12v3.45h6.35a5.43 5.43 0 01-2.36 3.56v2.96h3.82c2.23-2.06 3.5-5.09 3.5-8.15z"/>
                      <path fill="#34A853" d="M12 24c3.19 0 5.87-1.06 7.82-2.86l-3.82-2.96c-1.06.71-2.42 1.13-4 1.13-3.08 0-5.68-2.08-6.62-4.87H1.44v3.06A11.99 11.99 0 0012 24z"/>
                      <path fill="#FBBC04" d="M5.38 14.44a7.2 7.2 0 010-4.59V6.79H1.44a12 12 0 000 10.72l3.94-3.07z"/>
                      <path fill="#EA4335" d="M12 4.98c1.74 0 3.29.6 4.52 1.77l3.38-3.38C17.87 1.44 15.19.36 12 .36A11.99 11.99 0 001.44 6.79l3.94 3.06C6.32 7.06 8.92 4.98 12 4.98z"/>
                      <text x="26" y="17" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="500" fill="#5f6368">Pay</text>
                    </svg>
                  </span>
                  <span className="pay-logo" title="Paytm">
                    <svg width="36" height="14" viewBox="0 0 90 30" xmlns="http://www.w3.org/2000/svg">
                      <text x="0" y="22" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#002970">Pay</text>
                      <text x="40" y="22" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="700" fill="#00BAF2">tm</text>
                    </svg>
                  </span>
                  <span className="pay-logo" title="PhonePe">
                    <svg width="17" height="17" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="12" fill="#5F259F"/>
                      <path fill="#fff" d="M16.8 8.9c0-.4-.34-.72-.75-.72h-1.5l-.88-1.02a.9.9 0 00-.68-.31H10.1c-.24 0-.36.28-.2.45l.86.88H7.35c-.24 0-.43.19-.43.42v.6c0 .24.19.43.43.43h1.12v2.9c0 1.86.98 2.94 2.62 2.94.5 0 .93-.06 1.44-.26v1.78c0 .5.4.9.9.9h.72c.24 0 .43-.19.43-.42V10.5h1.36c.24 0 .43-.19.43-.42v-.6l.01-.58zm-3.32 4.62c-.3.14-.62.2-.93.2-.74 0-1.12-.37-1.12-1.2v-2.6h2.05v3.6z"/>
                    </svg>
                  </span>
                  <span className="pay-logo" title="BHIM UPI">
                    <svg width="34" height="17" viewBox="0 0 60 28" xmlns="http://www.w3.org/2000/svg">
                      <text x="0" y="16" fontFamily="Arial, sans-serif" fontSize="15" fontStyle="italic" fontWeight="700" fill="#5c5c5c">BHIM</text>
                      <path d="M44 5 L54 13 L44 21 Z" fill="#ED752E"/>
                      <path d="M44 8 L50 13 L44 18 Z" fill="#00A651"/>
                      <text x="0" y="25" fontFamily="Arial, sans-serif" fontSize="4.4" fontWeight="600" fill="#8a8a8a" letterSpacing="0.3">UNIFIED PAYMENTS</text>
                    </svg>
                  </span>
                </div>
              </div>
              <div className="trust-card">
                <div className="trust-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                    <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
                    <circle cx="7" cy="18" r="1.5" />
                    <circle cx="18" cy="18" r="1.5" />
                  </svg>
                </div>
                <div className="trust-card-text">
                  <div className="trust-card-title">Free Shipping on Orders Above ₹995</div>
                  <div className="trust-card-sub">Fast &amp; secure delivery across India.</div>
                </div>
              </div>
              <div className="trust-card">
                <div className="trust-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8 12.5l2.5 2.5L16 9.5" />
                  </svg>
                </div>
                <div className="trust-card-text">
                  <div className="trust-card-title">30-Day Taste Challenge</div>
                  <div className="trust-card-sub">Don&apos;t love it? Get your money back. *Applicable only on 2kg.</div>
                </div>
              </div>
            </div>

            {/* MINI FAQ — floating, +/- */}
            <div className="faq-accordion mini-faq">
              {(isSB ? SURPRISE.miniFaq : MINI_FAQ).map((item) => {
                const isOpen = openMiniFaq === item.id;
                return (
                  <div className="faq-item-v2 mini" key={item.id}>
                    <div className="faq-row" onClick={() => setOpenMiniFaq(isOpen ? null : item.id)}>
                      <span className="faq-q">{item.q}</span>
                      <span className="faq-toggle-icon">{isOpen ? '\u2212' : '+'}</span>
                    </div>
                    <div className={`faq-answer-row${isOpen ? ' open' : ''}`}>
                      <p>{item.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* PAY YOUR WAY — centered heading + 4-step process (varies by payment method) with numbered circles and curved dashed connectors */} {/* hidden on the Surprise Box page */}
      {!isSB && (<>
      <section className="section">
        <div className="wrap">
          <div className="process-head">
            <h2 className="process-heading">Pay Your Way</h2>
            <p className="process-subtext">Choose your preferred payment method and native Shopify checkout</p>
          </div>

          <div className="process-steps">
            {(PROCESS_STEPS[ctaInfo.payType] || PROCESS_STEPS.upfront).map((step, i, arr) => {
              const StepIcon = step.Icon;
              return (
                <Fragment key={step.title}>
                  <div className="process-step">
                    <span className="process-num">{i + 1}</span>
                    <span className="process-circle">
                      <StepIcon size={32} strokeWidth={1.6} />
                    </span>
                    <span className="process-title">{step.title}</span>
                    <span className="process-body">{step.body}</span>
                  </div>
                  {i < arr.length - 1 && (
                    <span className="process-connector" aria-hidden="true">
                      <svg width="90" height="40" viewBox="0 0 90 40" fill="none" preserveAspectRatio="none">
                        <path
                          d="M2 20 L88 20"
                          stroke="var(--grey-300)" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      </section>
      </>)}

      {/* REELS */}
      <section className="reels-marquee-section">
        {fest ? (
          <NightPanel sky={{ seed: 21, lights: false, fireworks: [[0.5, 0.1, 18, K.gold, 0.4, 14]] }}>
            <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 0, zIndex: 3 }}><div className="sb-only-d"><GIFT.SideLanterns d /></div><div className="sb-only-m"><GIFT.SideLanterns d={false} /></div></div>
            <div className="wrap dw-reels-inner">
              <div className="dw-sky-head"><b>Unboxed this Diwali</b><span>Real reactions from subscribers</span></div>
              <div className="reel-grid">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div className="img-placeholder reel-item" key={i}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M10 9l6 3-6 3z" /></svg>
                  </div>
                ))}
              </div>
            </div>
          </NightPanel>
        ) : (
        <div className="wrap">
          <div className="reel-grid">
            {Array.from({ length: 5 }).map((_, i) => (
              <div className="img-placeholder reel-item" key={i}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.4">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M10 9l6 3-6 3z" />
                </svg>
              </div>
            ))}
          </div>
        </div>
        )}
      </section>
      {fest && <div style={{ padding: P.d ? "28px 0" : "16px 0" }}><GIFT.DiyaDivider d={!!P.d} /></div>}

      {/* UPSELL — tabs (Subscriptions / Bundles), horizontal scroll */} {/* hidden on the Surprise Box page */}
      {!isSB && (<>
      <section className={`section${fest ? ' dw-upsell' : ''}`}>
        <DwSky on={false} sky={{ seed: 11, lanterns: [[0.05, 22, K.lanternA, 1], [0.95, 36, K.lanternB, 0.9]], fireworks: [[0.62, 0.13, 20, K.gold, 0, 14], [0.86, 0.2, 15, "#7FE3D8", 1.4, 12]], diyas: 'auto', diyaS: 0.66 }}>
        <div className="wrap">
          <div className="upsell-head-row">
            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2>Complete your routine</h2>
              <p>Everything that pairs well with your subscription.</p>
            </div>
            <div className="upsell-tabs">
              <button
                className={`upsell-tab${upsellTab === 'subscriptions' ? ' active' : ''}`}
                onClick={() => setUpsellTab('subscriptions')}
              >
                Subscriptions
              </button>
              <button
                className={`upsell-tab${upsellTab === 'bundles' ? ' active' : ''}`}
                onClick={() => setUpsellTab('bundles')}
              >
                Bundles
              </button>
            </div>
          </div>
        </div>
        <Scroller d={!!P.d} k={upsellTab}>
          <GIFT.StyleTag />
          {upsellData.map((item, idx) => (<div className="gx-cell" key={idx}><GIFT.UpsellCard item={item} i={idx} d={!!P.d} /></div>))}
        </Scroller>
        </DwSky>
      </section>
      </>)}

      {/* MARQUEE — no band/bg */}
      <section className="marquee-section">
        <div className="marquee-track">
          <MarqueeGroup items={isSB ? SURPRISE.marquee : MARQUEE_ITEMS} />
          <MarqueeGroup hidden items={isSB ? SURPRISE.marquee : MARQUEE_ITEMS} />
        </div>
      </section>

      {/* BANNER CAROUSEL — edge to edge, 16:9, 3 slides */} {/* hidden on the Surprise Box page */}
      {!isSB && (<>
      <section className="banner-carousel-section">
        <div className="banner-carousel-viewport">
          <div className="banner-slide-track" style={{ transform: `translateX(-${bannerIndex * (100 / 3)}%)` }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div className="banner-slide" key={i}>
                <div className="img-placeholder banner-img">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8a8a8a" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  <span>Banner image</span>
                </div>
              </div>
            ))}
          </div>
          <div className="dots dots-overlay">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`dot${bannerIndex === i ? ' active' : ''}`}
                onClick={() => setBannerIndex(i)}
              />
            ))}
          </div>
        </div>
      </section>
      </>)}

      {/* REVIEWS — even 3x3 grid, equal card width, height follows content */} {/* hidden on the Surprise Box page */}
      {!isSB && (<section className="section">
        <div className="wrap">
          <div className="section-head section-head-center">
            <h2>Loved by regular subscribers</h2>
            <p>Real feedback from people who've kept their subscription on autopilot.</p>
          </div>
          <div className="reviews-grid">
            {REVIEWS.map((r) => (
              <div className="review-card-v2" key={r.name}>
                <div className="rc-top">
                  <span className="rc-quote" aria-hidden="true">&ldquo;</span>
                  <div className="rc-rating">
                    <StarRow rating={r.rating} />
                    <span className="rc-score">{r.rating.toFixed(1)}</span>
                  </div>
                </div>
                <div className="rc-text">{r.text}</div>
                <div className="rc-person">
                  <div className="rc-avatar" />
                  <div>
                    <div className="rc-name">{r.name}</div>
                    <div className="rc-loc">{r.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>)}

      {/* FAQ — white bg, heading on top, floating accordion */}
      <div style={{ padding: P.d ? "28px 0" : "16px 0" }}><GIFT.DiyaDivider d={!!P.d} /></div>
<section className="section">
        <div className="wrap">
          <div className="faq-heading">
            <h2>Frequently Asked Questions</h2>
          </div>
          <div className="faq-accordion">
            {(isSB ? SURPRISE.fullFaq : FULL_FAQ).map((item) => {
              const isOpen = openFaqIds.includes(item.id);
              return (
                <div className="faq-item-v2" key={item.id}>
                  <div className="faq-row" onClick={() => toggleFaq(item.id)}>
                    <span className="faq-q">{item.q}</span>
                    <span className="faq-toggle-icon">{isOpen ? '\u2212' : '+'}</span>
                  </div>
                  <div className={`faq-answer-row${isOpen ? ' open' : ''}`}>
                    <p>
                      <b>{item.lead}</b> {item.rest}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {fest && (
        <>
          <div className="sb-only-d"><GIFT.IllustrationWall d /></div>
          <div className="sb-only-m"><GIFT.IllustrationWall d={false} /></div>
        </>
      )}
      <footer className={`site-footer${footerRevealed ? ' revealed' : ''}`} ref={footerRef} style={{ padding: 0, background: 'transparent' }}>
        <div style={{ height: 26, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.3px', color: '#9e9e9e', textTransform: 'uppercase', lineHeight: 1 }}>Powered by: Stackback.Ai</span>
        </div>
      </footer>

      {/* STICKY BAR */}
      <div className="sticky-bar-wrap" ref={stickyBarRef} style={footerInView ? { opacity: 0, pointerEvents: 'none' } : undefined}>
        <div className="sticky-ticker">{(isSB ? SURPRISE.ticker : STICKY_TICKER)[tickerIndex % 4]}</div>
        <div className="sticky-bar">
          <div className="sticky-img" />
          <div className="sticky-left">
            <div className="sticky-name">{isSB ? SURPRISE.title : 'Signature Collection — Subscription Edition'}</div>
            <div className="sticky-meta">
              {ctaInfo.estimate?.frequency || 'Every 4 weeks'}
              {ctaInfo.saved != null && <> &middot; Save ₹{ctaInfo.saved.toLocaleString('en-IN')}</>}
              {ctaInfo.perDelivery != null && <> &middot; ₹{ctaInfo.perDelivery.toLocaleString('en-IN')}/delivery</>}
            </div>
          </div>
          <button className="sticky-cta" onClick={handleStickyCTA}>
            <span className="cta-label">{ctaInfo.payType === 'onetime' ? 'Buy Now' : 'Subscribe Now'}</span>
            <span className="cta-price">
              ₹{ctaInfo.price.toLocaleString('en-IN')}
              {ctaInfo.suffix && <span className="cta-suffix">{ctaInfo.suffix}</span>}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

  return { Page: SubPage, giftStyles: GIFT_OPTIONS };
})();

/* Page type → Subscription / Surprise box: the page in the same Mobile / Desktop frame. The page answers to the frame's width (container queries), its fixed bars + popups stay inside the frame. */
function SubFrame({ view, fit, kind }) {
  const mob = view === "mobile", W = mob ? PHONE_W : DESK_W, H = mob ? PHONE_H : DESK_H, k = mob ? 1 : fit, fest = SET.theme === "festive", bg = fest ? mix(DIWALI.light, "#ffffff", 0.16) : "#ffffff";
  GIFT.applyFest(DIWALI.dark, DIWALI.light); GIFT.setBrand("Your Brand");        // the illustration wall + lanterns shared with the Gift page
  return (
    <div data-sub-frame="1" style={{ width: W * k, height: H * k, flexShrink: 0 }}>
      <div style={{ position: "relative", width: W, height: H, transform: mob ? "translateZ(0)" : `scale(${k})`, transformOrigin: "top left", overflow: "hidden", borderRadius: sh.card, border: stroke(0.75, GREY_DARK), background: bg }}>
        <div style={{ position: "absolute", inset: 0, containerType: "inline-size", containerName: "sbpage" }}>
          <div className={"sb-frame-scroll" + (mob ? " sb-hide-sb" : "")} style={{ position: "absolute", inset: 0, overflowY: "auto", overflowX: "hidden", background: bg }}>
            <style>{".sb-hide-sb{scrollbar-width:none;-ms-overflow-style:none}.sb-hide-sb::-webkit-scrollbar{display:none}"}</style>
            <SUB.Page d={!mob} page={kind} fest={fest} dark={DIWALI.dark} light={DIWALI.light} widget={SET.subWidget} variantStyle={SET.subVariant} showOneTime={SET.subOneTime !== "off"} endless={SET.subEndless !== "off"} giftOn={SET.subGift === "yes"} giftStyle={SET.subGiftStyle} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SBDiwaliSubscription() {
  const [view, setView] = useState("desktop");
  const [s, setS] = useState(SET_DEFAULT);
  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1600));
  useEffect(() => { const f = () => setVw(window.innerWidth); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  const set = (k, v) => setS((o) => { const n = { ...o, [k]: v }; if (k === "pick" && v !== "many" && n.mixMode === "tiered") n.mixMode = "normal"; return n; });   // Tiered needs Many per category
  // the settings are read by the components while they render
  SET = s; FEST = s.theme === "festive" || s.type === "gift"; applyFest(s.festDark, s.festLight); BYOB = s.type === "byob"; BYOB_FLAT = s.type === "byob" && s.byobMode === "flat"; BYOB_TIERS = BYOB_FLAT ? [BYOB_FLAT_DEAL] : BYOB_TIER_SETS[s.offers] || BYOB_TIER_SETS[4]; BYOB_MIN = BYOB_TIERS[0].n; BYOB_CATS[0].off = BYOB_TIERS[BYOB_TIERS.length - 1].off; FIXED = s.type === "fixed"; BXGY = s.type === "bxgy" || FIXED; BXGY_CATS[0].products = BXGY_POOL.slice(0, s.bxBuy); BXGY_REWARDS = FIXED ? [] : BXGY_REWARD_POOL.slice(0, s.bxFree); MULTI = BYOB || BXGY || s.pick === "many"; FREE_LAST = s.type === "mix" && s.mixMode === "bxgy"; TIERED = s.type === "mix" && s.pick === "many" && s.mixMode === "tiered"; CATS = BYOB ? BYOB_CATS : BXGY ? BXGY_CATS : s.cats === 4 ? CATS_ALL : CATS_ALL.slice(0, 3); LAST = CATS.length - 1; DESK = view === "desktop";
  const fit = Math.min(1, Math.max(0.3, (vw - 300 - 28 - 32) / DESK_W));   // the 1440 frame shrinks to sit beside the settings
  const btn = (on) => ({ height: 34, padding: "0 22px", borderRadius: sh.pill, border: "none", cursor: "pointer", background: on ? C.primary : "transparent", color: on ? C.onBar : C.inkOnBg, fontSize: 13, fontWeight: 600 });
  return (
    <div className="dk-root" style={{ fontFamily: FONT, background: C.canvas, minHeight: "100vh" }}>
      <StyleTag />
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 28, flexWrap: "wrap", padding: "16px 16px 28px" }}>
        <div style={{ position: "sticky", top: 16, alignSelf: "flex-start", flexShrink: 0 }}>{<SubFrame key="subscription" view={view} fit={fit} kind="normal" />}</div>
        <SettingsPanel s={s} set={set} onReset={() => setS(SET_DEFAULT)} view={view} onView={setView} />
      </div>
    </div>
  );
}
