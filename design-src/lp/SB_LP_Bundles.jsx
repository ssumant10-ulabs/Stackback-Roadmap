import { useState, useEffect, useLayoutEffect, useRef, Fragment } from "react";

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
const dashed = (w, col) => (noneMode ? "none" : `${w}px dashed ${col}`);
const MUTED = greyOn(C.bg);
const ACCENT_WASH = mix(C.accent, C.bg, 0.06);
const ACCENT_BORDER = mix(C.accent, GREY_LIGHT, 0.3);
const GREY_LIGHT_TINT = mix(GREY_LIGHT, C.bg, 0.4);

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
// desktop product cards: type, spacing, heights and icons grow together by this much
const CARD_K = 1.1;
const Z = (n) => (DESK ? Math.round(n * CARD_K * 10) / 10 : n);
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
let FREE_LOCKED = false;    // …and the free category is still locked (set by the bundle while it renders)
const isFreeCat = (i) => FREE_LAST && i === LAST;
const freeTitle = () => `Free ${CATS[LAST].title}`;
const SET_DEFAULT = { type: "byob", theme: "festive", festDark: "#7a0f1c", festLight: "#fff3d9", bannerType: "default", bannerPattern: "mandala", giftFlow: "default", giftWall: "on", subWidget: "single", subVariant: "pills", subOneTime: "on", subEndless: "on", subGift: "no", subGiftStyle: "env", flashBanner: 0, flashDays: "on", flashLive: 0, bxBuy: 6, bxFree: 2, offers: 4, byobMode: "tiered", pick: "one", mixMode: "normal", cats: 4, topBanner: true, catHeader: "plain", cards: "grid", flow: "steps", dock: "sticky", pills: "pills", mobNav: "bar", loader: "yes", autoMove: "yes" };
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

const IconLock = ({ size = 14, w = 2.2 }) => <Icon size={size} w={w} d={<><rect x="5" y="11" width="14" height="9" rx="2.2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>} />;
const IconUnlock = ({ size = 14, w = 2.2 }) => <Icon size={size} w={w} d={<><rect x="5" y="11" width="14" height="9" rx="2.2" /><path d="M8 11V8a4 4 0 0 1 7.6-1.8" /></>} />;

const IconX = ({ size = 16 }) => <Icon size={size} d={<path d="M6 6l12 12M18 6L6 18" />} />;

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

const PILL_BOX = { get fontSize() { return DESK ? 10.5 : 8.5; }, fontWeight: 700, get padding() { return DESK ? "0 9px" : "3px 7px"; }, borderRadius: sh.pill, lineHeight: 1, display: "inline-flex", alignItems: "center", get height() { return DESK ? 22 : 17; } };

const TagPill = ({ children, tone }) => <span style={{ ...PILL_BOX, ...(tone === "diwali" ? { background: festGrad(110), color: DIWALI.goldPale, boxShadow: `inset 0 0 0 1px ${DIWALI.gold}` } : { background: C.primary, color: C.onBar }) }}>{children}</span>;

const OffPill = ({ p }) => (FEST
  ? <span data-fest-pill="1" style={{ ...PILL_BOX, ...festPill() }}><span style={{ position: "relative" }}>{productOff(p)}% OFF</span><FestShimmer /></span>
  : <span style={{ ...PILL_BOX, background: C.accent, color: C.onAccent }}>{productOff(p)}% OFF</span>);

function ProductCard({ p, selected, filled, onAdd, onRemove, vals, onVar, m = true, list = false, qty = 1, onQty, fixed = false, freeCat = false, locked = false, onDetails }) {
  // Mix & Match, one per category (and the free category): once a product is picked the others are off — deselect it first to choose another
  const blocked = !fixed && !p.reward && !p.free && filled && !selected && (!MULTI || freeCat) && !BYOB && !BXGY;
  const sel = vals || p.variants.map((v) => v.options[0]);
  const s = m
    ? { name: Z(11.5), price: Z(13), strike: Z(BYOB ? 9.5 : 10.5), ddH: Z(30), ddFs: Z(BYOB ? 10 : 11), cta: Z(32), ctaF: Z(11.5), pad: Z(6), inset: Z(7) }
    : { name: 13, price: 15, strike: 11.5, ddH: 42, ddFs: 11.5, cta: 44, ctaF: 12.5, pad: 10, inset: 10 };
  const qtyBtn = { width: Z(26), height: Z(26), padding: 0, border: "none", borderRadius: sh.round, background: "rgba(255,255,255,.16)", color: C.onBar, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const ctaBase = { height: s.cta, width: "100%", borderRadius: sh.pill, cursor: "pointer", fontSize: FS(s.ctaF), fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 };
  /* list layout (the free gift): a small square image; beside it the name, the chosen variants written out ("500ml • Regular"), and the "Free Diwali Gift" line */
  if (list && p.free) return (
    <div data-product-list="1" className="sb-anim" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, background: FEST ? DIWALI.beige : C.bg, border: FEST ? `1px solid ${DIWALI.goldEdge}` : stroke(0.5, GREY_LIGHT), borderRadius: sh.card, padding: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ width: 72, height: 72, flexShrink: 0, background: FEST ? DIWALI.beigeDeep : C.fill, borderRadius: sh.img }} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: FS(12.5), fontWeight: 500, lineHeight: 1.35, color: C.inkOnBg, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.name}</div>
        <div data-product-variants="1" style={{ fontSize: FS(11.5), color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sel.join(" • ")}</div>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 8px" }}>
          <span style={{ fontSize: FS(13), lineHeight: 1.2 }}>{FEST ? <DiwaliText still pulse origin="left">Free Diwali Gift</DiwaliText> : <span data-price-promise="plain" style={{ fontWeight: 700, color: C.inkOnBg }}>Free Gift</span>}</span>
          <span style={{ fontSize: FS(11), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(p.mrp)}</span>
        </div>
      </div>
      {FEST && <Spark className="plf-twinkle" size={8} color={DIWALI.goldBright} style={{ position: "absolute", top: 8, right: 10 }} />}
      {FEST && <FestShimmer />}
    </div>
  );
  return (
    <div data-reward-card={p.reward ? "1" : undefined} data-free-cat={freeCat ? (locked ? "locked" : "1") : undefined} data-blocked={blocked ? "1" : undefined} className="sb-anim" style={{ opacity: blocked ? 0.45 : 1, filter: blocked ? "grayscale(.6)" : "none", display: "flex", flexDirection: "column", minWidth: 0, background: p.reward || (freeCat && !selected) ? freePal().bg : selected ? GREY_LIGHT_TINT : C.bg,
      border: p.reward || (freeCat && !selected) ? stroke(1, freePal().edge) : selected ? stroke(1, C.primary) : stroke(0.5, GREY_LIGHT), borderRadius: sh.card, padding: s.pad }}>
      <div data-product-image="1" role="button" tabIndex={locked ? -1 : 0} aria-label={`View details of ${p.name}`} onClick={() => { if (!locked && onDetails) onDetails(); }} onKeyDown={(e) => { if (!locked && onDetails && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDetails(); } }}
        style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: C.fill, borderRadius: sh.img, overflow: "hidden", cursor: locked ? "default" : "pointer" }}>
        {p.tag && !FEST && <span style={{ position: "absolute", top: s.inset, left: s.inset, display: "flex" }}><TagPill tone={FEST ? "diwali" : p.tagTone}>{festTag(p.tag)}</TagPill></span>}
        {p.reward || freeCat ? <span style={{ position: "absolute", top: s.inset, right: s.inset, display: "flex" }}><FreePill /></span>
          : !p.free && <span style={{ position: "absolute", top: s.inset, right: s.inset, display: "flex" }}><OffPill p={p} /></span>}
        {locked && (
          <span data-locked="1" aria-hidden="true" className="sb-anim" style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: m ? Z(34) : 46, height: m ? Z(34) : 46, borderRadius: sh.round, background: FEST ? DIWALI.red : C.primary, color: FEST ? DIWALI.goldPale : C.onBar, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px rgba(0,0,0,.35)" }}><IconLock size={m ? Z(15) : 20} /></span>
          </span>
        )}
      </div>
      <div style={{ padding: m ? `${Z(9)}px 3px 0` : "14px 4px 0", display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: FS(s.name), fontWeight: 500, lineHeight: 1.35, color: C.inkOnBg, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: FS(s.name) * 1.35 * 2 }}>{p.name}</div>
        {/* BXGY (a fixed bundle) and the free cards: no variant pickers — the variants are written under the title, like "500ml • Regular" */}
        {(fixed || p.reward) && <div data-variant-line="1" style={{ marginTop: m ? Z(3) : 4, fontSize: FS(s.ddFs), color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.reward ? p.variant : sel.join(" • ")}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: Z(6), marginTop: m ? Z(6) : 10 }}>
          <span style={{ fontSize: FS(s.price), fontWeight: p.free || p.reward || freeCat ? 700 : 600, color: p.reward || freeCat ? freePal().price : p.free ? DIWALI.red : C.priceOnTile, letterSpacing: p.reward || freeCat ? "0.02em" : "-0.01em" }}>{p.reward || freeCat ? "FREE" : p.free ? "Free" : inr(p.price)}</span>
          <span style={{ fontSize: FS(s.strike), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(p.mrp)}</span>
        </div>
        {!(fixed || p.reward) && <div style={{ display: "flex", flexDirection: "column", gap: m ? Z(5) : 8, marginTop: m ? Z(7) : 12 }}>
          {p.reward && [0, 1].map((i) => {
            const part = (p.variant || "").split(" • ")[i];
            return part ? <div key={i} data-reward-field="1" aria-disabled="true" style={{ boxSizing: "border-box", height: s.ddH, width: "100%", padding: `0 ${DM(12)}px`, borderRadius: sh.pill, background: FEST ? rgba(DIWALI.goldDeep, 0.1) : rgba(C.accent, 0.14), border: "1px solid transparent", color: C.inkOnBg, display: "flex", alignItems: "center", fontSize: FS(s.ddFs), fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", pointerEvents: "none", cursor: "default", userSelect: "none" }}>{part}</div> : <div key={i} style={{ height: s.ddH }} />;
          })}
          {p.variants.map((v, i) => (
            <Dropdown key={v.label} full h={s.ddH} fs={s.ddFs} bg={freeCat ? C.white : selected ? C.fieldOnSel : C.fieldOnTile} a11y={v.label} value={sel[i]} options={v.options}
              onChange={(val) => onVar && onVar(i, val)} />
          ))}
        </div>}
        {!(fixed || p.reward) && <div style={{ marginTop: m ? Z(8) : 14 }} key={selected ? "s" : filled ? "f" : "a"} className="sb-in">
          {locked ? (
            /* the free category is locked: the button explains how to open it */
            <button onClick={() => TOAST && TOAST(`Pick from every other category to unlock your ${freeTitle()}`)} aria-disabled="true" data-locked-cta="1" className="sb-anim"
              style={{ ...ctaBase, background: C.white, color: MUTED, border: dashed(1.2, GREY_DARK), fontWeight: 600 }}><IconLock size={Z(12)} /> Locked</button>
          ) : p.free ? (
            <div data-free-included="1" style={{ ...ctaBase, cursor: "default", background: DIWALI.ivory, color: DIWALI.red, border: "1px solid rgba(245,197,66,.7)", fontWeight: 600 }}><GiftIcon size={Z(13)} color={DIWALI.red} /> Included</div>
          ) : BYOB && selected ? (
            /* BYOB: once it is in, the button becomes  − 1 +  — tap + to add another, − to take one away (the last one takes it out) */
            <div data-qty="1" style={{ ...ctaBase, cursor: "default", justifyContent: "space-between", padding: "0 5px", gap: 0, background: C.primary, color: C.onBar, border: "none", fontWeight: 600 }}>
              <button onClick={() => onQty && onQty(qty - 1)} aria-label={qty <= 1 ? "Remove from bundle" : "One less"} data-qty-minus="1" className="sb-anim" style={qtyBtn}><IconMinusB size={Z(12)} /></button>
              <span key={qty} data-qty-value="1" className="sb-pop" aria-live="polite" style={{ minWidth: 18, textAlign: "center", fontSize: FS(s.ctaF + 1) }}>{qty}</span>
              <button onClick={() => onQty && onQty(qty + 1)} disabled={qty >= 9} aria-label="One more" data-qty-plus="1" className="sb-anim" style={{ ...qtyBtn, opacity: qty >= 9 ? 0.4 : 1 }}><IconPlusB size={Z(12)} /></button>
            </div>
          ) : selected ? (
            <button onClick={onRemove} aria-pressed="true" title="Tap to remove" className="fb-cta sb-anim" style={{ ...ctaBase, background: C.primary, color: C.onBar, border: "none" }}>
              <span style={{ color: C.onBarAccent, display: "flex" }}><IconCheck size={Z(12)} w={3} /></span> {!MULTI || freeCat ? "Added · Remove" : "Added"}
            </button>
          ) : blocked ? (
            /* another product is already picked here: no swapping — deselect that one first */
            <button onClick={() => TOAST && TOAST("Deselect your current pick to choose this one")} aria-disabled="true" data-blocked-cta="1" className="sb-anim"
              style={{ ...ctaBase, cursor: "not-allowed", background: C.white, color: MUTED, border: stroke(1, GREY_DARK) }}>
              {freeCat ? "Claim free" : "Select"}
            </button>
          ) : freeCat ? (
            <button onClick={onAdd} className="fb-cta sb-anim" style={{ ...ctaBase, background: C.primary, color: C.onBar, border: "none" }}>
              Claim free
            </button>
          ) : (
            <button onClick={onAdd} className="fb-cta sb-anim" style={{ ...ctaBase, background: C.primary, color: C.onBar, border: "none" }}>
              {MULTI ? "Add" : "Select"}
            </button>
          )}
        </div>}
      </div>
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
const bxgyEyebrow = () => (FIXED ? `${BXGY_CATS[0].products.length}-Product Bundle` : `Buy ${BXGY_CATS[0].products.length} Get ${BXGY_REWARDS.length} Free`);
const bxgySub = () => FIXED ? `Get all ${BXGY_CATS[0].products.length} products together in one bundle, at one price.` : `Buy all ${BXGY_CATS[0].products.length} products and get ${BXGY_REWARDS.length === 1 ? "1 free product" : `${BXGY_REWARDS.length} free products`}, added automatically at checkout.`;
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
const flatFull = (count) => BYOB && BYOB_FLAT && count >= BYOB_FLAT_DEAL.n;
let BYOB_TIERS = BYOB_TIER_SETS[4];                                                   // the active set (chosen in the settings)
let BYOB_MIN = BYOB_TIERS[0].n;                                                       // the bundle can be bought from this many products
const BYOB_CATS = [{ key: "all", label: "All Products", title: "All Products", off: BYOB_TIERS[BYOB_TIERS.length - 1].off, video: "", image: "", sub: "",
  products: [...CATS_ALL[0].products, ...CATS_ALL[1].products] }];
const byobState = (count) => {                                                        // which offer you are on, and what the next one needs
  let reached = -1; BYOB_TIERS.forEach((t, i) => { if (count >= t.n) reached = i; });
  const next = BYOB_TIERS[reached + 1] || null;
  return { reached, off: reached >= 0 ? BYOB_TIERS[reached].off : 0, next, left: next ? next.n - count : 0 };
};
// the line under each category heading — it tells you what to do, and changes with the setting
// the arrows container: one short line about what comes next and how many are left after it
const nextInfo = (cat) => { const rest = LAST - cat; if (rest <= 0) return FREE_LAST ? (FREE_LOCKED ? "Free category · locked" : "Free category · unlocked") : "Last category"; const nx = isFreeCat(cat + 1) ? freeTitle() : CATS[cat + 1].title; return rest === 1 ? `Next: ${nx} · last one` : `Next: ${nx} · +${rest - 1} more`; };
const stepText = (c, i) => (isFreeCat(i) ? (FREE_LOCKED ? (FEST ? "Locked. Pick from every other category to unlock your free Diwali gift." : COPY.stepFreeLocked) : (FEST ? "Unlocked! Choose any 1, it's your free Diwali gift." : COPY.stepFreeOpen))
  : FREE_LAST && MULTI && !BYOB && !BXGY ? "Add as many as you like."
  : TIERED ? (FEST ? "Add as many as you like. The more you add, the bigger your Diwali offer." : "Add as many as you like. The more you add, the more you save.")
  : FREE_LAST && i === LAST - 1 ? "Choose any 1 to unlock your free pick."
  : BXGY ? (FEST ? `All ${c.products.length} products are in your Diwali bundle.` : `All ${c.products.length} products are included in your bundle.`) : BYOB ? (BYOB_FLAT ? (FEST ? flatCopy("Add any {n} products to get {off}% OFF this Diwali.") : flatCopy(COPY.stepByobFlat)) : FEST ? "Add as many as you like. The more you add, the bigger your Diwali offer." : "Add as many as you like. The more you add, the more you save.") : MULTI ? "Add as many as you like." : i === 0 ? "Choose any 1 to start your bundle." : i === LAST ? "Choose any 1 to complete your bundle." : "Choose any 1 to keep building your bundle.");

function useKit() {
  const [items, setItems] = useState(() => CATS.map((c) => (BXGY ? c.products.map((_, i) => i) : [])));   // per category: the indices of the picked products (BXGY: all of them, from the start)
  // pick one → replaces the category's pick · pick many → toggles the product in and out
  // the free category (BXGY setting) holds ONE free pick, and only once every other category has something in it
  const lockedNow = FREE_LAST && items.slice(0, LAST).some((a) => !a.length);
  FREE_LOCKED = lockedNow;
  const fullMsg = () => TOAST && TOAST(`Your bundle is full · ${BYOB_FLAT_DEAL.n} products max`);
  const pick = (c, idx) => BXGY ? undefined : flatFull(count) && !items[c].includes(idx) ? fullMsg() : isFreeCat(c) ? (lockedNow ? undefined : setItems((it) => it.map((a, i) => (i !== c ? a : [idx]))))
    : setItems((it) => it.map((a, i) => (i !== c ? a : MULTI ? (a.includes(idx) ? a.filter((x) => x !== idx) : [...a, idx]) : [idx])));
  // emptying an earlier category locks the free one again, so its pick goes back
  useEffect(() => { if (lockedNow && FREE_LAST && items[LAST] && items[LAST].length) setItems((it) => it.map((a, i) => (i === LAST ? [] : a))); }, [lockedNow]);
  const [qtys, setQtys] = useState({});                                           // BYOB: how many of each product
  const qtyOf = (p) => (BYOB ? qtys[p.id] || 1 : 1);
  const remove = (c, idx) => {
    if (BXGY) return;                                                              // BXGY: the bundle is fixed
    const id = CATS[c].products[idx].id;
    setItems((it) => it.map((a, i) => (i === c ? a.filter((x) => x !== idx) : a)));
    setQtys((o) => { if (!(id in o)) return o; const n = { ...o }; delete n[id]; return n; });
  };
  const setQty = (c, idx, n) => { if (n <= 0) { remove(c, idx); return; } if (n > qtyOf(CATS[c].products[idx]) && flatFull(count)) { fullMsg(); return; } setQtys((o) => ({ ...o, [CATS[c].products[idx].id]: Math.min(9, n) })); };
  const picksBy = items.map((a, c) => a.map((i) => CATS[c].products[i]));
  const picks = picksBy.map((a) => a[0] || null);                                  // first pick per category (the slots)
  const allPicks = [].concat(...picksBy);                                          // every pick, in order (BYOB slots)
  const sel = items.map((a) => (a.length ? a[a.length - 1] : null));               // "has a pick" marker per category (the pills)
  const count = picksBy.reduce((n, a) => n + a.reduce((m, p) => m + qtyOf(p), 0), 0), cats = picksBy.filter((a) => a.length).length;
  const byob = BYOB || TIERED ? byobState(count) : null;                                     // BYOB: which offer the bundle is on
  const catP = picksBy.map((a, c) => (isFreeCat(c) ? 0 : a.reduce((n, p) => n + p.price * qtyOf(p), 0)));            // what each category's picks cost (the free category: nothing)
  const catOff = CATS.map((c, i) => (isFreeCat(i) ? 0 : BYOB || TIERED ? byob.off : MULTI ? c.off : 0));
  const freeVal = FREE_LAST ? picksBy[LAST].reduce((n, p) => n + p.mrp, 0) : 0;   // what the free pick is worth          // the % taken off each category (BYOB: the offer the bundle has reached)
  const catDisc = catP.map((v, c) => Math.round((v * catOff[c]) / 100));
  const p0 = catP.reduce((a, b) => a + b, 0), disc = catDisc.reduce((a, b) => a + b, 0);
  const rewards = BXGY ? BXGY_REWARDS : [];                                       // BXGY: the free products
  const mrp = picksBy.reduce((n, a) => n + a.reduce((m, p) => m + p.mrp * qtyOf(p), 0), 0) + rewards.reduce((n, r) => n + r.mrp, 0);   // their value only adds to what you save
  const total = p0 - disc;
  const complete = BYOB ? count >= BYOB_MIN : BXGY ? true : cats === CATS.length;
  const [seenR, setSeenR] = useState({});                                          // BXGY + Diwali: which free cards have been scratched open
  const rewardSeen = (id) => !FEST || !!seenR[id];                                  // (in the Normal theme the free cards are simply shown)
  const revealReward = (id) => setSeenR((o) => (o[id] ? o : { ...o, [id]: true }));
  const [vars, setVars] = useState({});
  const varsFor = (p) => vars[p.id] || p.variants.map((v) => v.options[0]);
  const setVar = (p, i, val) => setVars((v) => { const n = [...(v[p.id] || p.variants.map((x) => x.options[0]))]; n[i] = val; return { ...v, [p.id]: n }; });
  const [freq, setFreq] = useState("Every 4 weeks");
  const [deliveries, setDeliveries] = useState("8 deliveries");
  const subTotal = Math.round(total * (1 - COPY.subscribeOff / 100));   // price once the subscribe discount is applied
  const progress = BXGY ? (FIXED ? `${count} items` : `${count} items + ${rewards.length} free`) : BYOB ? `${count} added` : MULTI ? `${cats} of ${CATS.length} categories` : `${cats} of ${CATS.length} picked`;
  const caption = complete ? (mrp - total > 0 ? `You save ${inr(mrp - total)}` : "Bundle complete") : BYOB ? `Add ${BYOB_MIN - count} more to continue` : progress;
  return { items, picksBy, picks, allPicks, sel, count, cats, complete, total, mrp, save: mrp - total, savings: mrp - freeVal - p0, pct: mrp - freeVal ? Math.round(((mrp - freeVal - p0) / (mrp - freeVal)) * 100) : 0, freeVal, freeLocked: lockedNow,
    catDisc, catOff, catDiscTotal: disc, byob, rewards, rewardSeen, revealReward, progress, caption, isPicked: (c, i) => items[c].includes(i), qtyOf, setQty,
    subDisc: total - subTotal, price: subTotal, sub: subTotal, freq, setFreq, deliveries, setDeliveries, varsFor, setVar, pick, remove,
    reset: () => { setItems(CATS.map((c) => (BXGY ? c.products.map((_, i) => i) : []))); setQtys({}); } };   // start a fresh bundle
}
/* =====================================================================
   Layout constants (px) — the phone is 393 × 852 (iPhone 15 / 16 screen)
   ===================================================================== */
const PHONE_W = 393, PHONE_H = 852, SIDE = 16, CONT_SIDE = 10;
const DESK_W = 1440, DESK_H = 821;                                         // the desktop frame you see
const DL_W = Math.round(DESK_W / DESK_K), DL_H = Math.round(DESK_H / DESK_K);   // …laid out as a 1067 × 608 canvas, then scaled up by DESK_K
const BYOB_SIDE = 92;                                                      // BYOB desktop: the same page margin as Mix & Match (DESK_SIDE), so both page types line up
const DESK_SIDE = 92;                                                       // desktop page margin → an 883px column: 4 cards of ~208px
const ANN_H = 34;      // announcement bar
const NAV_H = 52;      // nav bar
const SLOT_R = 8;       // corner radius of the overlapping slots in the bottom container
const CAP_H = 14;      // the lip under the pills that keeps the container's top edge in view while the pills are stuck
const LINE = GREY_LIGHT;
const LABEL_C = mix(MUTED, C.white, 0.72);              // lighter grey for small drawer labels
const FREQ_GREEN = C.accent;                           // the one green used everywhere (same as the Subscribe "5% OFF")
// both drawers (bottom "Your Bundle" + "Subscribe & save") share these: side padding, heading + label type, partition lines
const DR = {
  get padX() { return DM(20); },
  get title() { return { fontSize: FS(14), fontWeight: 700, letterSpacing: "-0.02em" }; },
  get sub() { return { fontSize: FS(12), fontWeight: 400 }; },
  get label() { return { fontSize: DESK_MODE ? 12 : 9, fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase" }; },
};
// The category pills are always black / white / grey, whatever the brand colours are
const PILL = { black: "#000000", white: "#ffffff", ink: "#111111", greyLine: "#e3e3e3", greyMid: "#c4c4c4", greyText: "#b3b3b3", dark: "#333333" };
const PAGE_BG = mix(GREY_LIGHT, C.white, 0.5);
// progress bars (offer bar + floating pill): white fill on a dark track — Diwali: deep red · Normal: black. One place to change both.
const progFill = () => (FEST ? DIWALI.red : C.primary);
const progTrack = () => (FEST ? DIWALI.beigeDeep : PILL.greyLine);        // a touch of grey behind everything

/* =====================================================================
   Icons + logo
   ===================================================================== */
const IconMenuB = ({ size = 18 }) => <Icon size={size} w={1.8} d={<path d="M4 7h16M4 12h16M4 17h16" />} />;
const IconBagB = ({ size = 19 }) => <Icon size={size} w={1.7} d={<><path d="M5.6 8.5h12.8a1 1 0 011 1.1l-.9 9.6a1.6 1.6 0 01-1.6 1.4H7.1a1.6 1.6 0 01-1.6-1.4l-.9-9.6a1 1 0 011-1.1z" /><path d="M8.8 8.5V7.4a3.2 3.2 0 016.4 0v1.1" /></>} />;
const BrandLogo = ({ textSize = 18 }) => <span style={{ fontSize: FS(textSize), fontWeight: 700, letterSpacing: "-0.02em", color: C.inkOnBg }}>{COPY.brand}</span>;

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

/* =====================================================================
   2 · Nav bar — hamburger and cart at the ends, logo in the middle. Not sticky.
   ===================================================================== */
function NavBar({ count }) {
  const btn = { position: "relative", width: 34, height: 34, flexShrink: 0, padding: 0, borderRadius: sh.round, border: stroke(1, LINE), background: C.bg, color: C.inkOnBg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
  return (
    <nav style={{ height: NAV_H, display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${SIDE}px`, background: C.bg, borderBottom: stroke(0.5, "rgba(0,0,0,.08)") }}>
      <button aria-label="Menu" className="fb-ghost sb-anim" style={btn}><IconMenuB /></button>
      <BrandLogo />
      <button aria-label={`Cart, ${count} selected`} className="fb-ghost sb-anim" style={btn}>
        <IconBagB />
        {count > 0 && <span key={count} className="sb-pop" style={{ position: "absolute", top: -5, right: -5, minWidth: 12, height: 12, padding: "0 2px", borderRadius: sh.pill, background: C.accent, color: C.onAccent, border: stroke(1.5, C.bg), boxSizing: "content-box", fontSize: 8, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
      </button>
    </nav>
  );
}

/* =====================================================================
   3 · Banner — margin to margin, 2:1. Pills along the top edge, heading +
   sub-text at the bottom. Plain grey for now; artwork goes in COPY.bannerImage.
   ===================================================================== */
/* the top-banner headline: an eyebrow label, then a large display line, then the body text — each with room to breathe.
   (the category headings stay small, so the two never look alike) */
function Headline({ ink, soft, d, center, gold = false, goldLight = false, subInk }) {
  const g = FEST && gold, gl = FEST && goldLight && !g;          // gl: the text-only banner — a deeper gold, for a light page                                          // over the merchant's image: golden text with a shimmer
  const glow = g ? { filter: "drop-shadow(0 1px 3px rgba(0,0,0,.5))" } : {};
  return (
    <div style={{ position: "relative", textAlign: center ? "center" : undefined }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase", lineHeight: 1, color: g ? (subInk || DIWALI.goldPale) : soft, marginBottom: d ? 14 : 12, ...(subInk && subInk !== DIWALI.goldPale ? {} : glow) }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: sh.round, background: C.accent, flexShrink: 0 }} />{heroEyebrow()}
      </div>
      <div data-headline="1" style={{ fontSize: FS(d ? 26 : 25), fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 1.12, color: ink,
        ...(g ? { backgroundImage: `linear-gradient(100deg, ${DIWALI.goldDeep} 0%, ${DIWALI.goldBright} 25%, #fff6cf 50%, ${DIWALI.goldBright} 75%, ${DIWALI.goldDeep} 100%)`, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: DIWALI.goldBright, animation: "festGlint 3.6s linear infinite", ...glow } : gl ? { backgroundImage: "linear-gradient(100deg, #a8760a 0%, #d9a21b 25%, #f2c14e 50%, #d9a21b 75%, #a8760a 100%)", backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "#d9a21b", animation: "festGlint 3.6s linear infinite", filter: "drop-shadow(0 1px 1px rgba(122,80,0,.28))" } : {}) }}>{heroHeading().replace(/\*/g, "")}</div>
      <div style={{ fontSize: FS(d ? 12 : 11.5), lineHeight: 1.45, color: g ? (subInk || DIWALI.goldPale) : soft, textShadow: g && !(subInk && subInk !== DIWALI.goldPale) ? "0 1px 6px rgba(0,0,0,.55)" : undefined, maxWidth: d ? 420 : 270, margin: center ? `${d ? 14 : 12}px auto 0` : `${d ? 14 : 12}px 0 0` }}>{heroSub()}</div>
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
function BannerArt({ d }) {
  const A = festPattern(SET.bannerPattern);   // the top banner's pattern — Settings → Banner → Pattern
  return (
    <>
      <div aria-hidden="true" data-banner-pattern="1" style={{ position: "absolute", inset: 0, backgroundImage: A.url, backgroundSize: `${A.size}px ${A.size}px`, pointerEvents: "none" }} />
      <FestShimmer />
    </>
  );
}

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
/* ---- Flash sale · multi-day offer. Built from the page tokens (Diwali dark / light, gold, the page's own radii and font), so the day tabs
   and the locked / closed popup read as part of this page, not as a separate component. ---- */
const fdPad2 = (n) => String(n).padStart(2, "0");
const fdTone = () => ({ bg: DIWALI.dark, ink: DIWALI.light, soft: rgba(DIWALI.light, 0.72), line: rgba(DIWALI.light, 0.28), wash: rgba(DIWALI.light, 0.1) });
function FlashDayTabs({ d, day, setDay, liveDay }) {
  const T = fdTone(), days = FLASH.days;
  return (
    <div role="tablist" aria-label="Sale days" data-flash-days="1" className="fs-scroll" style={{ display: "flex", gap: d ? 10 : 6, padding: d ? `12px ${DESK_SIDE}px 14px` : "10px 16px 12px", background: T.bg, borderTop: `1px solid ${rgba(DIWALI.light, 0.12)}`, overflowX: "auto", fontFamily: "inherit" }}>
      {days.map((x, i) => {
        const live = i === liveDay, closed = i < liveDay, sel = i === day;
        const st = sel && live ? { bg: DIWALI.ivory, border: DIWALI.ivory, color: DIWALI.dark, sub: DIWALI.dark }
          : sel ? { bg: T.wash, border: T.ink, color: T.ink, sub: T.ink }
          : { bg: "transparent", border: T.line, color: T.ink, sub: T.soft };
        const mark = closed ? <span style={{ display: "flex", color: sel ? st.color : DIWALI.goldBright }}><IconCheck size={13} w={3} /></span>
          : live ? <i className="fs-bulb" style={{ width: 7, height: 7, borderRadius: 9, background: sel ? DIWALI.red : DIWALI.goldBright }} />
          : <span style={{ display: "flex", color: sel ? st.color : DIWALI.goldBright }}><IconLock size={13} /></span>;
        return (
          <button key={x.name} role="tab" aria-selected={sel} onClick={() => setDay(i)} className="fs-press"
            style={{ flex: d ? "0 0 auto" : "1 1 0", minWidth: 0, textAlign: "left", cursor: "pointer", opacity: closed && !sel ? 0.6 : 1, padding: d ? "9px 16px" : "8px 12px", borderRadius: sh.img + 4, fontFamily: "inherit", background: st.bg, border: `1.5px solid ${st.border}` }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", fontSize: d ? 13 : 13.5, fontWeight: 700, color: st.color }}>
              {mark}
              <span style={{ textDecoration: closed ? "line-through" : "none" }}>Day {i + 1}</span>
              {live && d && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", color: sel ? st.color : DIWALI.goldBright, border: `1px solid ${sel ? st.color : DIWALI.goldBright}`, padding: "1px 6px", borderRadius: 5 }}>LIVE</span>}
            </span>
            <span style={{ display: "block", fontSize: d ? 11 : 10.5, color: st.sub, marginTop: 2, whiteSpace: "nowrap" }}>{closed ? (d ? `${x.name}, ended` : "Ended") : d ? `${x.name}, ${x.off}% off` : live ? "Live now" : x.name}</span>
          </button>
        );
      })}
    </div>
  );
}
/* the locked / closed day popup — sits over the WHOLE page (the page behind it is blurred), centred; "x", the backdrop or the button close it */
function FlashDayPopup({ d, day, liveDay, onToday, onClose }) {
  const t = FLASH.useCountdown(), days = FLASH.days, x = days[day], closed = day < liveDay, allOver = liveDay >= days.length, next = days[liveDay];
  const ahead = day - liveDay, h = t.h + (ahead - 1) * 24;
  const T = fdTone();
  const tile = (v, u) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <span style={{ minWidth: 54, height: 50, padding: "0 6px", boxSizing: "border-box", borderRadius: sh.img, background: DIWALI.ivory, color: DIWALI.dark, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}><span key={v} className={u === "SEC" ? "fs-tick" : undefined}>{fdPad2(v)}</span></span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: ".12em", color: T.soft }}>{u}</span>
    </div>
  );
  const cta = { height: 42, padding: "0 20px", borderRadius: sh.pill, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", position: "relative", overflow: "hidden", background: festGrad(110), color: DIWALI.goldPale, boxShadow: `inset 0 0 0 1px ${DIWALI.gold}` };
  return (
    <div onClick={onClose} className="fs-in" data-flash-popup="1" style={{ position: "absolute", inset: 0, zIndex: 90, display: "flex", alignItems: "center", justifyContent: "center", background: rgba(DIWALI.redDeep, 0.5), backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label={closed ? `Day ${day + 1} ended` : `Day ${day + 1} opens in ${h} hours ${t.m} minutes`} onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: d ? 340 : 310, maxWidth: "100%", boxSizing: "border-box", background: festGrad(160), border: stroke(1.5, DIWALI.goldEdge), borderRadius: sh.card, boxShadow: "0 24px 48px rgba(0,0,0,.4)", padding: "20px 18px 18px", textAlign: "center", color: T.ink, fontFamily: "inherit" }}>
        <button onClick={onClose} aria-label="Close" className="fs-press" style={{ position: "absolute", top: 10, right: 10, width: 28, height: 28, padding: 0, borderRadius: sh.round, border: `1px solid ${T.line}`, background: "transparent", color: T.ink, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconX size={14} /></button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: ".12em", color: DIWALI.goldPale, background: T.wash, border: `1px solid ${T.line}`, padding: "4px 10px", borderRadius: 6 }}>{closed ? <IconCheck size={11} w={3} /> : <IconLock size={12} />}{closed ? `DAY ${day + 1} ENDED` : `DAY ${day + 1}`}</span>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.15, marginTop: 10 }}>{closed ? (allOver ? "Sale has ended" : "Offer closed") : "Opens in"}</div>
        {closed ? (
          <>
            <div style={{ fontSize: 12.5, color: T.soft, marginTop: 3 }}>{x.name} ended at midnight</div>
            <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, marginTop: 14, color: T.soft, textDecoration: "line-through", textDecorationThickness: 2, opacity: 0.75 }}>{x.off}% off</div>
            <div style={{ fontSize: 12.5, color: T.soft, marginTop: 6 }}>This offer is no longer available.</div>
            {allOver
              ? <div style={{ fontSize: 13, color: T.ink, marginTop: 14, fontWeight: 600 }}>Thank you for celebrating with us. Shubh Deepavali!</div>
              : <button onClick={onToday} className="fs-press" style={{ ...cta, marginTop: 16 }}>See today's offer: {next.off}% off</button>}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: T.soft, marginTop: 3 }}>{ahead === 1 ? "Tomorrow" : `In ${ahead} days`}, {x.name}</div>
            <div role="timer" style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: 6, marginTop: 14 }}>{tile(h, "HRS")}<b style={{ color: DIWALI.goldBright, fontSize: 18, marginTop: 14 }}>:</b>{tile(t.m, "MIN")}<b style={{ color: DIWALI.goldBright, fontSize: 18, marginTop: 14 }}>:</b>{tile(t.s, "SEC")}</div>
            <div style={{ fontSize: 13, color: T.soft, marginTop: 14 }}><b style={{ color: DIWALI.goldBright }}>{x.off}% off</b> {x.line.replace(`${x.off}% off `, "")}</div>
            <button onClick={onToday} className="fs-press" style={{ ...cta, marginTop: 14 }}>Back to today's offer</button>
          </>
        )}
      </div>
    </div>
  );
}
/* the banner, with the day tabs under it. The day on show + the popup live in the page shell (so the popup can cover the whole page) */
function FlashBanner({ d, multi, day, setDay, liveDay }) {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById("fs-fonts")) return;
    const l = document.createElement("link"); l.id = "fs-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700;800&family=Mukta:wght@400;500;600;700;800&family=Rozha+One&family=Yellowtail&display=swap";
    document.head.appendChild(l);
  }, []);
  FLASH.sync(d, MULTI, CATS.length, { dark: DIWALI.red, deep: DIWALI.redDeep, bright: DIWALI.redBright, soft: mix("#ffffff", DIWALI.red, 0.1), light: DIWALI.light });   // the Diwali colours from Settings
  const v = FLASH.versions[SET.flashBanner] || FLASH.versions[0];
  return (
    <div className="fs-root" data-banner="flash" style={{ position: "relative", fontFamily: FLASH.FB }}>
      <FLASH.StyleTag />
      {v.render({ kit: FLASH.kit, d })}
      {multi && <FlashDayTabs d={d} day={day} setDay={setDay} liveDay={liveDay} />}
    </div>
  );
}

function HeroBanner({ d, side = DESK_SIDE }) {
  const designed = FEST && SET.bannerType === "default";                     // Diwali default banner (designed from the hex) — no image
  const imageOnly = FEST && SET.bannerType === "image";                      // Diwali image banner: just the merchant's picture — no text, no overlay
  const img = designed ? "" : COPY.bannerImage;                              // "Image" banner: empty until the merchant adds the picture
  const ink = img ? "#ffffff" : C.inkOnBg, soft = img ? "rgba(255,255,255,.88)" : MUTED;
  const onDark = contrast("#ffffff", DIWALI.dark) >= contrast("#111111", DIWALI.dark);   // the sub-text colour follows the contrast of the banner's colour
  const subInk = designed ? (onDark ? DIWALI.goldPale : "#2b1a00") : undefined;
  return (
    <div data-banner={designed ? "default" : "image"} role={imageOnly ? "img" : undefined} aria-label={imageOnly ? "Diwali banner" : undefined} style={{ position: "relative", margin: d ? `20px ${side}px 0` : `12px ${CONT_SIDE}px 0`, aspectRatio: d ? "6 / 1" : "2 / 1", borderRadius: sh.card, overflow: "hidden", color: ink,
      background: designed ? `radial-gradient(circle at 88% 16%, rgba(255,214,102,.30), rgba(255,214,102,0) 52%), ${festGrad(135)}` : img ? `url(${JSON.stringify(img)}) center / cover no-repeat` : C.fill, display: "flex", flexDirection: "column", justifyContent: d ? "center" : "flex-end", padding: d ? "0 32px" : 16 }}>
      {designed && <BannerArt d={d} />}
      {img && !imageOnly && <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,.6) 0%, rgba(0,0,0,.18) 55%, rgba(0,0,0,.18) 100%)", pointerEvents: "none" }} />}
      {!imageOnly && <Headline ink={ink} soft={soft} d={d} gold subInk={subInk} />}
    </div>
  );
}

/* =====================================================================
   4 · Category pills — the numbered pills (current = black, done = green tick,
   upcoming = outlined), joined by short connectors, sticky at the top edge.
   A short "lip" under them keeps the container's top edge in view while they
   are stuck, so the container never looks cut off.
   ===================================================================== */
/* V2 desktop: a round arrow at each end of the pills row — previous / next category */
function PillArrow({ dir, on, onClick }) {
  const next = dir > 0;
  return (
    <button onClick={() => on && onClick && onClick()} disabled={!on} aria-label={next ? "Next category" : "Previous category"} data-pill-arrow={next ? "next" : "prev"} className="fb-ghost sb-anim"
      style={{ width: 28, height: 28, flexShrink: 0, padding: 0, borderRadius: sh.round, cursor: on ? "pointer" : "default", opacity: on ? 1 : 0.3, display: "flex", alignItems: "center", justifyContent: "center",
        border: stroke(1, PILL.greyLine), background: PILL.white, color: PILL.ink }}>
      {next ? <IconChevronRight size={14} /> : <IconChevronLeft size={14} />}
    </button>
  );
}
function CategoryPills({ cat, sel, onGo, top, d, wrapRef, kit, hide = false, onPrev, onNext }) {
  const N = CATS.length, GAP = 18, DW = 34;
  const arrowsRow = LAYOUT_V2 && (d || SET.mobNav === "arrows");   // V2: arrows at both ends of the pills row (desktop always; mobile when the setting says so)
  const single = arrowsRow && !d;                                   // …and on mobile only the current category sits between the two arrows
  const scrolls = !d;                                   // on a phone the row scrolls sideways and the chosen pill slides into view
  const rowW = d ? (N > 3 ? 640 : 520) : null;           // desktop: the whole row fits, centred
  const rowRef = useRef(null), capRef = useRef(null), btns = useRef([]);
  const [dashX, setDashX] = useState(0);
  const measure = () => {
    const cap = capRef.current, b = btns.current[cat];
    if (!cap || !b || !cap.getBoundingClientRect) return;
    setDashX(b.getBoundingClientRect().left - cap.getBoundingClientRect().left + b.getBoundingClientRect().width / 2 - DW / 2);
  };
  useEffect(() => {
    if (!scrolls) return;
    const row = rowRef.current, b = btns.current[cat];
    if (row && b && row.scrollTo) row.scrollTo({ left: Math.max(0, b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2), behavior: "smooth" });   // the selected pill comes into view
    measure();
  }, [cat, scrolls]);
  return (
    <div ref={wrapRef} className="fb-motion" style={{ position: "sticky", top, zIndex: 30, backgroundColor: pageBgColor(), padding: `8px ${d ? DESK_SIDE : CONT_SIDE}px 0`, transition: `top .32s ${EASE_COLLAPSE}` }}>
      {/* V2: the pills fold away while you scroll down and come back when you scroll up */}
      <div className="fb-motion" data-pills-hidden={LAYOUT_V2 && hide ? "1" : "0"} style={{ display: "grid", gridTemplateRows: LAYOUT_V2 && hide ? "0fr" : "1fr", opacity: LAYOUT_V2 && hide ? 0 : 1, transition: `grid-template-rows .32s ${EASE_COLLAPSE}, opacity .2s ease` }}><div style={{ minHeight: 0, overflow: "hidden" }}>
      {/* V2 desktop: the category arrows sit on the pills' row, one at each far end */}
      <div style={arrowsRow ? { display: "flex", alignItems: "center", gap: d ? 12 : 6 } : undefined}>
      {arrowsRow && <PillArrow dir={-1} on={!!onPrev} onClick={onPrev} />}
      <div style={arrowsRow ? { flex: 1, minWidth: 0 } : undefined}>
      <div ref={rowRef} role="tablist" aria-label="Categories" onScroll={scrolls ? measure : undefined} className={scrolls ? "sb-scroll" : undefined}
        style={{ display: "flex", alignItems: "center", ...(d ? { maxWidth: rowW, margin: "0 auto" } : {}), ...(scrolls ? { overflowX: "auto", overflowY: "hidden", margin: arrowsRow ? 0 : `0 -${CONT_SIDE}px`, padding: arrowsRow ? 0 : `0 ${CONT_SIDE}px`, scrollPaddingLeft: arrowsRow ? 0 : CONT_SIDE, scrollPaddingRight: arrowsRow ? 0 : CONT_SIDE } : {}) }}>
        {CATS.map((c, i) => {
          if (single && i !== cat) return null;
          const done = sel[i] !== null, current = i === cat, upcoming = !done && !current;
          // mobile "arrow + pill + arrow": the one pill stays outlined until a product is picked, then it turns filled (red in Diwali)
          const filled = single ? done : current, muted = single ? false : upcoming;
          return (
            <Fragment key={c.key}>
              <button ref={(el) => (btns.current[i] = el)} role="tab" aria-selected={current} onClick={() => onGo(i)} className="sb-anim"
                style={{ ...(scrolls && !single ? { flex: "0 0 auto" } : { flex: 1, minWidth: 0 }), ...(single ? { justifyContent: "center" } : {}), height: 46, padding: "0 16px 0 8px", borderRadius: sh.pill, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, overflow: "hidden",
                  ...(FEST && filled ? { position: "relative", background: filled ? festGrad(110) : DIWALI.ivory, border: filled ? stroke(1.5, DIWALI.goldEdge) : stroke(1, done ? DIWALI.goldEdge : DIWALI.goldSoft), color: filled ? DIWALI.goldPale : muted ? mix(DIWALI.red, DIWALI.ivory, 0.6) : DIWALI.red } : FEST ? { background: PILL.white, border: stroke(1, rgba(DIWALI.dark, 0.55)), color: muted ? PILL.greyText : PILL.ink } : { background: filled ? PILL.black : PILL.white, border: filled ? stroke(1.5, PILL.black) : stroke(1, done ? PILL.greyMid : PILL.greyLine), color: filled ? PILL.white : muted ? PILL.greyText : PILL.ink }), fontSize: FS(12), fontWeight: 600, letterSpacing: "-0.005em", whiteSpace: "nowrap" }}>
                <span className="sb-anim" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: sh.round, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FS(11), fontWeight: 700,
                  ...(FEST && filled ? { background: done ? `linear-gradient(135deg, ${DIWALI.goldPale}, ${DIWALI.goldDeep})` : filled ? DIWALI.redDeep : DIWALI.ivory, color: done ? DIWALI.redDeep : filled ? DIWALI.goldPale : mix(DIWALI.red, DIWALI.ivory, 0.6), border: done ? "none" : filled ? stroke(1, DIWALI.goldEdge) : stroke(0.75, DIWALI.goldSoft) } : FEST ? { background: done ? C.accent : PILL.white, color: done ? C.onAccent : DIWALI.dark, border: done ? "none" : stroke(1, rgba(DIWALI.dark, 0.45)) } : { background: done ? C.accent : filled ? PILL.dark : PILL.white, color: done ? C.onAccent : filled ? PILL.white : PILL.greyText, border: done || filled ? "none" : stroke(0.75, PILL.greyLine) }) }}>
                  {done ? <IconCheck size={12} w={2.8} /> : isFreeCat(i) ? <span data-pill-lock={FREE_LOCKED ? "1" : "open"} key={FREE_LOCKED ? "l" : "u"} className="sb-pop" style={{ display: "flex" }}>{FREE_LOCKED ? <IconLock size={12} w={2.4} /> : <IconUnlock size={12} w={2.4} />}</span> : i + 1}
                </span>
                <span style={{ minWidth: 0, position: "relative" }}>{isFreeCat(i) ? freeTitle() : c.label}</span>
                {FEST && filled && <FestShimmer />}
              </button>
              {i < LAST && !single && <span aria-hidden="true" data-link="1" style={{ width: GAP, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><i style={{ display: "block", width: 5, height: 1, background: PILL.black }} /><i style={{ display: "block", width: 5, height: 1, background: PILL.black, marginLeft: 3 }} /></span>}
            </Fragment>
          );
        })}
      </div>
      </div>
      {arrowsRow && <PillArrow dir={1} on={!!onNext && !(kit && kit.complete)} onClick={onNext} />}
      </div>
      </div></div>
      {LAYOUT_V2 && !d && kit && !arrowsRow && <CatNavBar kit={kit} cat={cat} d={d} onPrev={onPrev} onNext={onNext} />}
      <div ref={capRef} aria-hidden="true" style={{ position: "relative", height: CAP_H, background: C.white, borderTop: stroke(1, LINE), borderRadius: "18px 18px 0 0", ...(d ? { marginTop: 10, borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE) } : { margin: `10px -${CONT_SIDE}px 0` }) }}>
        {/* a short dash inside the container, right under the active pill — ties the pills to the container */}
        <div aria-hidden="true" style={{ position: "absolute", top: 5, height: 4, overflow: "hidden", ...(rowW ? { left: `calc(50% - ${rowW / 2}px)`, width: rowW } : { left: 0, right: 0 }) }}>
          {!LAYOUT_V2 && <span data-dash="1" style={{ position: "absolute", top: 0, left: scrolls ? dashX : `calc(${cat} * ((100% - ${(N - 1) * GAP}px) / ${N} + ${GAP}px) + (100% - ${(N - 1) * GAP}px) / ${2 * N} - ${DW / 2}px)`, width: DW, height: 3.5, borderRadius: 2, background: PILL.black, transition: `left .38s ${EASE_COLLAPSE}` }} />}
        </div>
      </div>
      {TIERED && kit && <TierBar kit={kit} d={d} />}
    </div>
  );
}
/* =====================================================================
   5 · Category container — white, soft edge. Heading + one-liner on the left,
   the "Pick One" order in light grey text on the right, then the 2-up grid.
   ===================================================================== */
const IconPlayB = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1l-11-6.8a.6.6 0 0 0-.9.5z" /></svg>;
/* the category's video: a tile the size of one product card, with a play button. Add c.video (and c.image as the poster) and it plays on tap. */
function CategoryMedia({ c, extra }) {
  const vref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const v = vref.current; if (!v) return;
    if (!playing) { if (v.play) v.play(); setPlaying(true); } else { if (v.pause) v.pause(); setPlaying(false); }
  };
  const fit = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" };
  return (
    <div data-catmedia="tile" onClick={c.video ? toggle : undefined} role={c.video ? "button" : undefined} aria-label={c.video ? (playing ? "Pause video" : "Play video") : undefined}
      style={{ position: "relative", overflow: "hidden", minHeight: 190, background: C.fill, borderRadius: sh.card, cursor: c.video ? "pointer" : "default", ...extra }}>
      {c.video ? <video ref={vref} src={c.video} poster={c.image || undefined} muted loop playsInline preload="metadata" style={fit} />
        : c.image ? <img src={c.image} alt="" style={fit} /> : null}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 55%)", pointerEvents: "none" }} />
      {!playing && (
        <span data-play="1" style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 36, height: 36, borderRadius: sh.round, background: "rgba(255,255,255,.94)", color: C.primary, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 22px rgba(0,0,0,.28)", pointerEvents: "none" }}>
          <span style={{ display: "flex" }}><IconPlayB size={14} /></span>
        </span>
      )}
      {/* a thin progress line along the bottom, like a video player */}
      <span aria-hidden="true" style={{ position: "absolute", left: 10, right: 10, bottom: 9, height: 3, borderRadius: 2, background: "rgba(255,255,255,.45)", pointerEvents: "none" }}><span style={{ display: "block", width: "28%", height: "100%", borderRadius: 2, background: "#fff" }} /></span>
    </div>
  );
}

/* a slider row; on desktop it has an arrow at each end that slides it */
/* slider card widths: desktop a little bigger; mobile sized so one card shows in full and 60 % of the next (one width = viewport − left padding − gap, divided by 1.6) */
const SLIDE_W_DESK = 208;
const slideW = (d, padL = 10, gap = 10) => (d ? SLIDE_W_DESK : Math.round((PHONE_W - padL - gap) / 1.6));
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

/* one category: its heading + line (with the pills on the right), then its products */
/* a category's heading, its line and its one offer pill. (BYOB pins it inside the sticky block under the offer bar.) */
function CategoryHeader({ cat, first = true, d }) {
  const c = CATS[cat];
  // this category's offer: its own discount in pick-many mode, otherwise the best discount among its products
  const free = isFreeCat(cat);
  // Diwali: the "Diwali Special" tag lives here instead of on the cards — beside the offer pill on desktop; on mobile the two take turns in one spot
  const [alt, setAlt] = useState(false);
  useEffect(() => { if (!FEST || d) { setAlt(false); return undefined; } const t = setInterval(() => setAlt((v) => !v), 4000); return () => clearInterval(t); }, [d, FEST]);
  const offer = free ? (FEST ? "Free Diwali Gift" : "1 Free") : BXGY ? `${bxgyEyebrow()}` : BYOB ? (BYOB_FLAT ? `${BYOB_FLAT_DEAL.off}% Off on ${BYOB_FLAT_DEAL.n}` : `Up to ${c.off}% Off`) : TIERED ? `Up to ${BYOB_TIERS[BYOB_TIERS.length - 1].off}% Off` : MULTI ? `${c.off}% Off` : `Up to ${Math.max(...c.products.map(productOff))}% Off`;
  const offerPill = <span data-catpills="1" style={{ flexShrink: 0, height: d ? 28 : 22, padding: d ? "0 14px" : "0 10px", borderRadius: sh.pill, ...(FEST ? { position: "relative", overflow: "hidden", background: DIWALI.ivory, border: stroke(1, DIWALI.goldEdge), color: DIWALI.red } : { background: ACCENT_WASH, border: stroke(1, ACCENT_BORDER), color: C.accentSafe }), fontSize: d ? 12 : 10, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>{free && <span style={{ position: "relative", display: "flex" }}>{FREE_LOCKED ? <IconLock size={d ? 12 : 10} w={2.4} /> : <IconUnlock size={d ? 12 : 10} w={2.4} />}</span>}<span style={{ position: "relative" }}>{offer}</span>{FEST && <FestShimmer />}</span>;
  const tagPill = <span data-cattag="1" style={{ flexShrink: 0, height: d ? 28 : 22, padding: d ? "0 14px" : "0 10px", borderRadius: sh.pill, position: "relative", overflow: "hidden", background: festGrad(110), color: DIWALI.goldPale, boxShadow: `inset 0 0 0 1px ${DIWALI.gold}`, fontSize: d ? 12 : 10, fontWeight: 600, display: "inline-flex", alignItems: "center", whiteSpace: "nowrap" }}><span style={{ position: "relative" }}>Diwali Special</span><FestShimmer /></span>;
  return (
    <div key={cat} data-cathead="1" className="sb-in" style={{ padding: first ? "12px 14px 14px" : "16px 14px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: d ? 12 : 10 }}>
          {FEST && <Diya size={d ? 32 : 28} />}
          <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: FS(16), fontWeight: 700, letterSpacing: "-0.015em", lineHeight: 1.25, color: C.inkOnBg }}>{free ? freeTitle() : c.title}</h2>
          <p style={{ margin: "3px 0 0", fontSize: FS(12), color: MUTED, lineHeight: 1.4 }}>{stepText(c, cat)}</p>
          </div>
        </div>
        {/* the offer pill (never wraps) — and, in the Diwali theme, the "Diwali Special" pill: left of it on desktop, taking turns with it every 4s on mobile */}
        {FEST && d ? <div data-cathead-pills="1" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{tagPill}{offerPill}</div>
          : FEST ? <span key={alt ? "t" : "o"} data-cathead-rotate={alt ? "tag" : "offer"} className="sb-in" style={{ display: "inline-flex", flexShrink: 0 }}>{alt ? tagPill : offerPill}</span>
          : offerPill}
    </div>
  );
}

function CategoryBody({ cat, kit, onPicked, first = true, d, cols }) {
  const c = CATS[cat], picked = kit.items[cat].length > 0, style = BYOB ? "grid" : SET.cards, banner = SET.catHeader === "banner" && !BYOB;
  const card = (p, i) => ({ p, selected: kit.isPicked(cat, i), filled: picked, vals: kit.varsFor(p), onVar: (vi, val) => kit.setVar(p, vi, val), freeCat: isFreeCat(cat), locked: isFreeCat(cat) && kit.freeLocked,
    onAdd: () => { kit.pick(cat, i); if (!MULTI) onPicked(cat); }, onRemove: () => kit.remove(cat, i), qty: kit.qtyOf(p), onQty: (n) => kit.setQty(cat, i, n), onDetails: () => OPEN_DETAILS && OPEN_DETAILS({ p, cat, i }) });
  return (
    <>
      <CategoryHeader cat={cat} first={first} d={d} />
      {style === "slider" ? (
        <Slider key={"g" + cat} d={d} data-cards="slider" className="card-refresh sb-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 10px 14px", scrollSnapType: "x proximity", scrollPaddingLeft: 10, scrollPaddingRight: 10 }}>
          {banner && <div style={{ flex: `0 0 ${slideW(d)}px`, alignSelf: "stretch", scrollSnapAlign: "start", display: "flex" }}><CategoryMedia c={c} extra={{ flex: 1 }} /></div>}
          {c.products.map((p, i) => <div key={p.id} style={{ flex: `0 0 ${slideW(d)}px`, scrollSnapAlign: "start" }}><ProductCard {...card(p, i)} m /></div>)}
        </Slider>
      ) : (
        <div key={"g" + cat} data-cards="grid" className="card-refresh" style={{ display: "grid", gridTemplateColumns: d ? `repeat(${cols || 4}, minmax(0, 1fr))` : "repeat(2, minmax(0, 1fr))", gap: "14px 10px", padding: "0 10px 14px" }}>
          {banner && <CategoryMedia c={c} />}
          {c.products.map((p, i) => <ProductCard key={p.id} {...card(p, i)} m />)}
        </div>
      )}
    </>
  );
}
const panelBox = (d, fit = false) => (d
  ? { margin: fit ? 0 : `0 ${DESK_SIDE}px`, background: C.white, boxShadow: fit ? "none" : "0 12px 28px -14px rgba(0,0,0,.14)", overflow: "hidden", borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE), borderBottom: stroke(1, LINE), borderRadius: "0 0 18px 18px" }
  : { margin: 0, background: C.white, overflow: "hidden" });   // mobile: full width, square at the bottom — the top radius is the lip under the pills
function CategoryPanel({ cat, kit, onPicked, d, fit = false, cols }) {
  return <div data-panel="1" style={panelBox(d, fit)}><CategoryBody cat={cat} kit={kit} onPicked={onPicked} d={d} cols={cols} />{FEST && <FestStrip d={d} />}</div>;
}
/* Mix & Match · Tiered: a minimal progress bar at the top of the category container, above the heading. One thin segment per offer, one line that says where you are, "1 of 4" at the end;
   tap it to open the list of offers (unlocked · next · to come). Same offers as BYOB — the more products in the whole bundle, the bigger the offer. */
function TierBar({ kit, d }) {
  const T = BYOB_TIERS, n = kit.count, by = kit.byob, [open, setOpen] = useState(false);
  const prev = useRef(by.reached);
  useEffect(() => { if (by.reached > prev.current) celebrateShow(`${T[by.reached].off}% OFF unlocked`); prev.current = by.reached; }, [by.reached]);
  const segs = T.map((t, i) => { const pn = i === 0 ? 0 : T[i - 1].n, span = t.n - pn, into = Math.max(0, Math.min(span, n - pn)); return { ...t, pct: span ? (into / span) * 100 : 100, reached: n >= t.n }; });
  const hi = { color: FEST ? DIWALI.red : C.inkOnBg, fontWeight: 700 }, dot = <span aria-hidden="true" style={{ width: 3, height: 3, borderRadius: sh.round, background: GREY_DARK, display: "inline-block", margin: "0 7px", verticalAlign: "middle" }} />;
  const line = n === 0 ? <>Add {T[0].n} products to unlock <span style={hi}>{T[0].off}% OFF</span></>
    : by.next ? <>{n} {n === 1 ? "item" : "items"} added{dot}Add {by.left} more to unlock <span style={hi}>{by.next.off}%</span></>
    : <><span style={hi}>All offers unlocked</span>{dot}{T[T.length - 1].off}% off</>;
  const step = by.next ? by.reached + 2 : T.length, fs = FS(d ? 12.5 : 12), tight = !d && T.length > 4;   // 6 offers on a phone: the short "10%" label
  return (
    <div data-tier-bar="1" style={{ background: C.white, boxSizing: "border-box", padding: d ? "12px 16px 12px" : "10px 12px 11px", borderBottom: stroke(1, LINE), ...(d ? { borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE) } : { margin: `0 -${CONT_SIDE}px`, padding: `10px ${12 + CONT_SIDE}px 11px` }) }}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Offers — tap to see them all" className="sb-anim" style={{ display: "block", width: "100%", padding: 0, border: "none", background: "transparent", cursor: "pointer", textAlign: "left", color: C.inkOnBg, fontFamily: "inherit" }}>
        {/* the line comes first, the dashes underneath */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: fs, lineHeight: 1.3 }}>
          <span key={n} className="sb-pop" style={{ minWidth: 0, color: MUTED }}>{line}</span>
          <span style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4, color: MUTED }}>{step} of {T.length}<span className="fb-motion" style={{ display: "flex", transform: open ? "rotate(180deg)" : "none", transition: `transform .24s ${EASE_MICRO}` }}><IconDown size={14} /></span></span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {segs.map((sg) => (
            <div key={sg.n} data-tier-seg={sg.reached ? "reached" : "locked"} style={{ flex: 1, height: 4, borderRadius: 2, background: progTrack(), overflow: "hidden", position: "relative" }}>
              <div className="sb-anim" style={{ position: "absolute", inset: 0, width: `${sg.pct}%`, background: progFill(), transition: `width .35s ${EASE_MICRO}` }} />
            </div>
          ))}
        </div>
      </button>
      {/* opened: just the offers, side by side under their dashes — plain text, no boxes */}
      <Reveal open={open}>
        <div data-tier-list="1" style={{ display: "flex", gap: 6, paddingTop: 12 }}>
          {segs.map((sg, i) => {
            const isNext = !sg.reached && i === by.reached + 1;
            return (
              <div key={sg.n} data-tier-row={sg.reached ? "reached" : isNext ? "next" : "locked"} style={{ flex: 1, minWidth: 0, textAlign: "center", lineHeight: 1.3 }}>
                <div style={{ fontSize: FS(12), fontWeight: sg.reached || isNext ? 700 : 500, color: sg.reached ? (FEST ? DIWALI.red : C.inkOnBg) : isNext ? C.inkOnBg : MUTED, opacity: sg.reached || isNext ? 1 : 0.8 }}>{sg.off}%</div>
                <div style={{ fontSize: FS(10.5), color: MUTED, marginTop: 2, opacity: sg.reached || isNext ? 1 : 0.8 }}>{sg.n} items</div>
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}
/* vertical flow: every category inside ONE container, one after the other */
function VerticalPanel({ kit, onPicked, d, secRefs }) {
  return (
    <div data-panel="1" data-vertical="1" style={panelBox(d)}>
      {CATS.map((c, i) => (
        <div key={c.key} ref={(el) => (secRefs.current[i] = el)} data-section={i} style={i ? { borderTop: stroke(1, LINE), marginTop: 8 } : undefined}>
          <CategoryBody cat={i} first={i === 0} kit={kit} onPicked={onPicked} d={d} />
        </div>
      ))}
      {FEST && <FestStrip d={d} />}
    </div>
  );
}
function Toast({ text, bottom = 100 }) {
  if (!text) return null;
  if (typeof text === "object") {            // Mix & Match toast, three looks: open (outlined, what to do) · filled (category done) · done (bundle complete, solid)
    const st = text.state || "filled", solid = st === "done";
    const bg = solid ? (FEST ? DIWALI.dark : C.primary) : st === "filled" ? (FEST ? DIWALI.ivory : ACCENT_WASH) : pageBgColor();
    const edge = solid ? (FEST ? DIWALI.dark : C.primary) : st === "filled" ? (FEST ? DIWALI.goldEdge : ACCENT_BORDER) : (FEST ? rgba(DIWALI.dark, 0.35) : GREY_DARK);
    const mainC = solid ? (FEST ? "#fff" : C.onBar) : "#000", subC = solid ? (FEST ? DIWALI.goldPale : C.onBar) : (FEST ? DIWALI.dark : C.inkOnBg);
    const icon = st === "open"
      ? <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: sh.round, border: dashed(1.5, GREY_DARK), boxSizing: "border-box", flexShrink: 0 }} />
      : <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: sh.round, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: solid ? (FEST ? DIWALI.gold : C.onBar) : (FEST ? DIWALI.dark : C.accent), color: solid ? (FEST ? DIWALI.dark : C.primary) : (FEST ? "#fff" : C.onAccent) }}><IconCheck size={9} w={3.4} /></span>;
    return (
      <div key={text.main + text.sub + st} role="status" aria-live="polite" className="sb-toast" data-pick-toast={st}
        style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom, zIndex: 120, boxSizing: "border-box", width: "max-content", maxWidth: "calc(100% - 32px)", display: "flex", alignItems: "center", gap: 9, lineHeight: 1.3,
          background: bg, border: stroke(1, edge), padding: "8px 16px 8px 12px", borderRadius: 18, boxShadow: "0 6px 16px -8px rgba(0,0,0,.25)" }}>
        {icon}
        <div style={{ minWidth: 0, textAlign: "left" }}>
          <div style={{ fontSize: FS(12), fontWeight: 800, color: mainC, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{text.main}</div>
          <div style={{ fontSize: FS(11), fontWeight: 500, color: subC, opacity: 0.85, marginTop: 1 }}>{text.sub}</div>
        </div>
      </div>
    );
  }
  return (
    <div key={text} role="status" aria-live="polite" className="sb-toast"
      style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom, zIndex: 120, boxSizing: "border-box", maxWidth: "calc(100% - 32px)", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        background: pageBgColor(), color: FEST ? DIWALI.dark : C.inkOnBg, border: stroke(1, FEST ? rgba(DIWALI.dark, 0.35) : GREY_DARK),
        fontSize: FS(12), fontWeight: 600, padding: "7px 14px", borderRadius: 999, boxShadow: "0 6px 16px -8px rgba(0,0,0,.25)" }}>
      {text}
    </div>
  );
}

/* =====================================================================
   6 · Bottom container — appears only once something is added. Compact row:
   overlapping slots that take the product image, a small chevron that opens the
   list of added products, and the price on the far right. The two CTAs
   (One Time · Subscribe 5% OFF in green) slide in only when every category is picked.
   ===================================================================== */
/* the overlapping slots in the bottom bar. Empty slots show their number in the part that is NOT covered by the next slot; the "2" count of a
   many-per-category pick is drawn on its own layer above every slot, so a slot on top of it can never hide it. */
function Slots({ kit, onJump, size = 34, overlap = 8 }) {
  // normally one slot per category; BYOB has no categories, so it shows the first four products you add (and "+N" when there are more)
  const slots = BYOB || FIXED
    ? [0, 1, 2, 3].map((i) => (i === 3 && kit.allPicks.length > 4
        ? { key: "b3", title: `${kit.allPicks.length - 3} more products`, p: null, more: `+${kit.allPicks.length - 3}`, badge: null }   // more than four: the last block says how many are not shown
        : { key: "b" + i, title: `Product ${i + 1}`, p: kit.allPicks[i] || null, badge: null }))
    : BXGY ? [0, 1, 2].map((i) => ({ key: "x" + i, title: `Product ${i + 1}`, p: kit.allPicks[i] || null, badge: null })).concat([{ key: "xg", title: `${kit.rewards.length} free with this bundle`, p: null, gift: true, badge: null }])
    : CATS.map((c, i) => ({ key: c.key, title: isFreeCat(i) ? freeTitle() : c.title, p: kit.picks[i], badge: kit.picksBy[i].length > 1 ? String(kit.picksBy[i].length) : null, lock: isFreeCat(i) }));
  const N = slots.length, tiny = size < 26;          // tiny: the small slots in the floating pill — smaller numbers and count badges
  return (
    <div data-slots="1" style={{ position: "relative", display: "flex", alignItems: "center", paddingLeft: 3 }}>
      {slots.map((c, i) => {
        const p = c.p, last = i === N - 1, filled = !!p || !!c.more || !!c.gift;
        return (
          <button key={c.key} onClick={() => onJump(i)} aria-label={p ? `${c.title}: ${p.name}` : c.more || c.gift ? c.title : `Pick from ${c.title}`} title={p ? p.name : c.title} className="sb-anim"
            style={{ position: "relative", zIndex: i + 1, boxSizing: "border-box", width: size, height: size, marginLeft: i ? -overlap : 0, padding: 0, paddingRight: !filled && !last ? overlap : 0, flexShrink: 0, cursor: "pointer", borderRadius: SLOT_R, display: "flex", alignItems: "center", justifyContent: "center", fontSize: FS(tiny ? 8.5 : 11), fontWeight: 700, color: GREY_DARK,
              background: p ? (p.image ? `url(${JSON.stringify(p.image)}) center / cover no-repeat` : C.fill) : c.more || c.gift ? C.fill : C.white, border: filled ? stroke(1, GREY_DARK) : dashed(1.5, GREY_DARK), boxShadow: c.gift ? `0 0 0 2px ${C.white}, 0 0 0 3.5px ${C.accent}` : `0 0 0 ${tiny ? 1.5 : 2}px ${C.white}`, ...(tiny ? { borderRadius: 5 } : {}) }}>
            {p ? <span key={p.id} className="sb-pop" style={{ position: "absolute", inset: 0, borderRadius: "inherit" }} /> : c.gift ? <span data-slot-gift="1" style={{ display: "flex", color: C.inkOnBg }}><GiftIcon size={Math.round(size * 0.42)} color={C.inkOnBg} /></span> : c.more ? <span key={c.more} data-slot-more="1" className="sb-pop" style={{ color: C.inkOnBg, fontSize: FS(12), fontWeight: 700, letterSpacing: "-0.01em" }}>{c.more}</span> : c.lock ? <span data-slot-lock={kit.freeLocked ? "1" : "open"} style={{ display: "flex", color: GREY_DARK }}>{kit.freeLocked ? <IconLock size={Math.round(size * 0.38)} /> : <GiftIcon size={Math.round(size * 0.42)} color={GREY_DARK} />}</span> : i + 1}
          </button>
        );
      })}
      {slots.map((c, i) => c.badge && (
        <span key={"n" + c.key} data-slotcount="1" style={{ position: "absolute", top: tiny ? -5 : -7, left: 3 + i * (size - overlap) + size - (tiny ? 7 : 9), zIndex: 20, minWidth: tiny ? 9 : 12, height: tiny ? 9 : 12, padding: tiny ? "0 1.5px" : "0 3px", boxSizing: "content-box", borderRadius: sh.pill, background: C.primary, color: C.onBar, border: stroke(tiny ? 1.5 : 1.5, C.white), fontSize: FS(tiny ? 6.5 : 8), fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>{c.badge}</span>
      ))}
    </div>
  );
}

function BundleList({ kit, onRemove, onClose, bleed = 0, headless = false, maxH }) {
  const groups = CATS.map((c, i) => ({ c, i, rows: kit.picksBy[i] })).filter((g) => g.rows.length);   // picked categories only
  return (
    <div>
      {!headless && (<>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: DM(12) }}>
        <span style={{ ...DR.title, color: C.inkOnBg }}>Your Bundle</span>
        {onClose ? <CircleBtn label="Close" onClick={onClose} size={DM(30)}><IconX size={DM(14)} /></CircleBtn> : <span style={{ ...DR.sub, color: MUTED }}>{plural(kit.count, "item")}{BXGY && kit.rewards.length ? ` + ${kit.rewards.length} free` : ""}</span>}
      </div>
      <div aria-hidden="true" style={{ borderTop: stroke(1, LINE), margin: `0 -${bleed}px` }} />
      </>)}
      <div className={maxH ? "sb-scroll" : undefined} data-list-body="1" style={{ display: "flex", flexDirection: "column", gap: DM(32), padding: headless ? 0 : `${DM(24)}px 0`, ...(maxH ? { maxHeight: maxH, overflowY: "auto" } : {}) }}>
        {BXGY && kit.rewards.length > 0 && (
          <div data-free-rows="1">
            <div style={{ ...DR.label, color: freePal().label, marginBottom: DM(12) }}>{FEST ? "Free Diwali gifts with this bundle" : "Free with this bundle"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: DM(12) }}>
              {kit.rewards.map((r) => (
                <ScratchReveal key={r.id} tap compact hint="Tap to reveal your free gift" radius={sh.card} revealed={kit.rewardSeen(r.id)} onReveal={(el) => { celebrateAt(el, true, "Free gift unlocked"); kit.revealReward(r.id); }}>
                  <div data-free-row-card="1" style={{ display: "flex", alignItems: "center", gap: DM(12), padding: DM(8), background: freePal().bg, border: stroke(1.5, freePal().edgeStrong), borderRadius: sh.card }}>
                    <div style={{ width: DM(48), height: DM(48), flexShrink: 0, borderRadius: sh.img, background: C.fill }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: FS(9), fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: freePal().label }}><GiftIcon size={DM(10)} color={freePal().icon} /> {FEST ? "Diwali gift" : "Free reward"}</div>
                      <div style={{ fontSize: FS(12.5), fontWeight: 600, color: C.inkOnBg, marginTop: DM(3), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ fontSize: FS(11), color: MUTED, marginTop: DM(1), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.variant}</div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right", paddingRight: DM(4) }}>
                      <div style={{ fontSize: FS(10.5), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(r.mrp)}</div>
                      <span style={{ display: "inline-flex", marginTop: DM(3) }}><FreePill /></span>
                    </div>
                  </div>
                </ScratchReveal>
              ))}
            </div>
          </div>
        )}
        {groups.map(({ c, i, rows }) => (
          <div key={c.key}>
            {!BYOB && <div style={{ ...DR.label, color: isFreeCat(i) ? freePal().label : LABEL_C, marginBottom: DM(14), display: "flex", alignItems: "center", gap: 5 }}>{isFreeCat(i) && <GiftIcon size={DM(11)} color={freePal().icon} />}{isFreeCat(i) ? (FEST ? `${c.title} · Free Diwali gift` : freeTitle()) : c.title}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: DM(20) }}>
              {rows.map((p, k) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: DM(10) }}>
                  <div style={{ width: DM(40), height: DM(40), flexShrink: 0, borderRadius: SLOT_R, background: p.image ? `url(${JSON.stringify(p.image)}) center / cover no-repeat` : C.fill }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: FS(12.5), fontWeight: 600, color: C.inkOnBg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: FS(11), color: MUTED, marginTop: DM(2), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{kit.varsFor(p).join(" • ")}</div>
                  </div>
                  {BYOB && (
                    <span data-row-qty="1" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", height: DM(26), borderRadius: sh.pill, border: stroke(0.75, LINE), background: C.white }}>
                      <button onClick={() => kit.setQty(i, kit.items[i][k], kit.qtyOf(p) - 1)} aria-label={kit.qtyOf(p) <= 1 ? `Remove ${p.name}` : "One less"} data-row-minus="1" className="fb-ghost sb-anim" style={{ width: DM(24), height: DM(24), padding: 0, border: "none", background: "transparent", color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconMinusB size={DM(10)} /></button>
                      <span key={kit.qtyOf(p)} className="sb-pop" style={{ minWidth: DM(14), textAlign: "center", fontSize: FS(11.5), fontWeight: 600, color: C.inkOnBg }}>{kit.qtyOf(p)}</span>
                      <button onClick={() => kit.setQty(i, kit.items[i][k], kit.qtyOf(p) + 1)} disabled={kit.qtyOf(p) >= 9} aria-label="One more" data-row-plus="1" className="fb-ghost sb-anim" style={{ width: DM(24), height: DM(24), padding: 0, border: "none", background: "transparent", color: C.inkOnBg, cursor: "pointer", opacity: kit.qtyOf(p) >= 9 ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" }}><IconPlusB size={DM(10)} /></button>
                    </span>
                  )}
                  {isFreeCat(i)
                    ? <div data-row-free="1" style={{ flexShrink: 0, textAlign: "right" }}><div style={{ fontSize: FS(10.5), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(p.mrp)}</div><span style={{ display: "inline-flex", marginTop: DM(2) }}><FreePill /></span></div>
                    : <div style={{ flexShrink: 0, fontSize: FS(12.5), fontWeight: 700, color: C.inkOnBg }}>{inr(p.price * kit.qtyOf(p))}</div>}
                  {onRemove && !BXGY && !BYOB && <button onClick={() => onRemove(i, kit.items[i][k])} aria-label={`Remove ${p.name}`} className="fb-ghost sb-anim"
                    style={{ width: DM(22), height: DM(22), flexShrink: 0, padding: 0, borderRadius: sh.round, border: stroke(0.75, LINE), background: C.white, color: MUTED, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconX size={DM(11)} /></button>}
                </div>
              ))}
            </div>
          </div>
        ))}
        {MULTI && DESK && kit.catDiscTotal > 0 && (
          <div data-catdisc="1" style={{ display: "flex", justifyContent: "space-between", fontSize: FS(11.5), color: MUTED }}>
            <span>{BYOB || TIERED ? "Bundle offer" : "Category discounts"}</span><span style={{ fontWeight: 600, color: C.inkOnBg }}>−{inr(kit.catDiscTotal)}</span>
          </div>
        )}
      </div>
      {!headless && <div aria-hidden="true" style={{ borderTop: stroke(1, LINE), margin: `0 -${bleed}px` }} />}
    </div>
  );
}
function Reveal({ open, children }) {
  return (
    <div className="fb-motion" aria-hidden={!open} style={{ display: "grid", gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden",
      transition: `grid-template-rows .38s ${EASE_COLLAPSE}, opacity .25s ease, visibility 0s linear ${open ? "0s" : ".38s"}` }}>
      <div style={{ minHeight: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
/* Mix & Match sticky bars: small Prev / Next buttons (Next goes away once every category is filled) */
function PrevNext({ kit, onPrev, onNext, h = 30, fs = 11, onGo, prev = true, next = true, iconOnly = false, keepNext = false }) {
  const base = { height: h, flexShrink: 0, borderRadius: sh.pill, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, fontSize: FS(fs), fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer" };
  return (
    <span data-prevnext="1" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
      {prev && <button onClick={() => { if (onPrev) { onGo && onGo(); onPrev(); } }} disabled={!onPrev} aria-label="Previous category" data-dock-prev="1" className="fb-ghost sb-anim"
        style={{ ...base, ...(iconOnly ? { width: h, padding: 0 } : { padding: `0 ${Math.round(h * 0.33)}px 0 ${Math.round(h * 0.2)}px` }), background: C.white, color: C.inkOnBg, border: stroke(1.5, GREY_DARK), opacity: onPrev ? 1 : 0.4, cursor: onPrev ? "pointer" : "default" }}>
        <IconChevronLeft size={Math.round(h * (iconOnly ? 0.55 : 0.42))} />{!iconOnly && " Prev"}
      </button>}
      {next && (!kit.complete || (keepNext && onNext) || (iconOnly && onNext)) && (
        <button onClick={() => { if (onNext) { onGo && onGo(); onNext(); } }} disabled={!onNext} aria-label="Next category" data-dock-next="1" className="fb-cta sb-anim"
          style={{ ...base, ...(iconOnly ? { width: h, padding: 0 } : { padding: `0 ${Math.round(h * 0.2)}px 0 ${Math.round(h * 0.33)}px` }), background: C.primary, color: C.onBar, border: "none", opacity: onNext ? 1 : 0.4, cursor: onNext ? "pointer" : "default" }}>
          {!iconOnly && "Next "}<IconChevronRight size={Math.round(h * (iconOnly ? 0.55 : 0.42))} />
        </button>
      )}
    </span>
  );
}
/* Buy Now + Subscribe & Save — the pair every bar and panel uses.
   Buy Now: the black pill. Subscribe & Save: the important one — Diwali: the festive red with the gold ring and the shimmer; Normal: black with the accent highlight. */
function BuyNowBtn({ onClick, h = 40, fs = 12, flex = "1", disabled, tab }) {
  return <button onClick={onClick} disabled={disabled} tabIndex={tab} data-cta="buy" className="fb-cta sb-anim"
    style={{ flex, minWidth: 0, height: h, borderRadius: sh.pill, border: "none", background: C.primary, color: C.onBar, fontSize: fs, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, whiteSpace: "nowrap", padding: "0 6px" }}>Buy Now</button>;
}
function SubSaveBtn({ onClick, h = 40, fs = 12, subFs = 9.5, flex = "1.25", disabled, tab }) {
  return (
    <button onClick={onClick} disabled={disabled} tabIndex={tab} data-cta="subscribe" className="fb-cta sb-anim"
      style={{ flex, minWidth: 0, height: h, borderRadius: sh.pill, border: "none", position: "relative", overflow: "hidden", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
        background: FEST ? festGrad(110) : C.primary, color: FEST ? DIWALI.goldPale : C.onBar, boxShadow: FEST ? `inset 0 0 0 1px ${DIWALI.gold}` : "none",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, lineHeight: 1.1, padding: "0 6px", whiteSpace: "nowrap" }}>
      {FEST && <FestShimmer />}
      <span style={{ position: "relative", fontSize: fs, fontWeight: 700, letterSpacing: "-0.005em" }}>Subscribe &amp; Save</span>
      <span style={{ position: "relative", fontSize: subFs, fontWeight: 700, letterSpacing: "-0.01em", color: FEST ? DIWALI.goldBright : C.onBarAccent }}>Up to {COPY.subscribeOff}% OFF</span>
    </button>
  );
}
/* Mix & Match: moving on to the next category. The page dims softly, and a small pill in the centre shows the next step:
   a line draws itself clockwise round the whole pill, and when it closes the number lights up. Small on purpose. */
const SAVE_MS = 1600;   // how long the next-category loader shows (everything in it is timed off this)
function SaveLoader({ from = 0, to = 1, d }) {
  const N = CATS.length, next = CATS[to] || CATS[N - 1], prev = CATS[from] || CATS[0];
  const tone = FEST ? DIWALI.red : C.primary, onTone = FEST ? "#fff" : C.onBar;
  const node = d ? 30 : 28, run = SAVE_MS - 460, lightAt = run;   // run: both outlines draw in this time; then the number lights up
  const trace = `sbLdTrace ${run}ms linear both`;                     // the outline drawing round the pill
  const pillRef = useRef(null), [box, setBox] = useState(null);   // the pill's size, for the outline that traces round it
  useLayoutEffect(() => { const el = pillRef.current; if (el) setBox({ w: el.offsetWidth, h: el.offsetHeight }); }, [to]);
  return (
    <div role="status" aria-live="polite" aria-label={`${prev.label} done. Moving to ${next.label}`} data-save-loader="1"
      style={{ position: "absolute", inset: 0, zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        background: FEST ? rgba(DIWALI.ivory, 0.3) : "rgba(255,255,255,0.4)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        animation: `sbFadeIn .16s ease both, sbFadeOut .18s ease ${SAVE_MS - 180}ms forwards` }}>
      <style>{`
        @keyframes sbLdPill { from { opacity: 0; transform: translateY(6px) scale(.94); } to { opacity: 1; transform: none; } }
        @keyframes sbLdLight { 0% { background: transparent; color: ${tone}; } 60% { transform: scale(1.12); } 100% { background: ${tone}; color: ${onTone}; transform: none; } }
        @keyframes sbLdTrace { from { stroke-dashoffset: 100; } to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) { [data-save-loader] *, [data-save-loader] { animation-duration: 1ms !important; animation-iteration-count: 1 !important; } }
      `}</style>
      <div ref={pillRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "8px 16px 8px 8px", background: C.white, borderRadius: sh.pill,
        boxShadow: `0 12px 28px -12px ${rgba(tone, 0.45)}, 0 0 0 1px ${rgba(tone, 0.08)}`, animation: "sbLdPill .34s cubic-bezier(.2,.9,.3,1.2) both" }}>
        {/* the next step's number: lights up once the outline closes */}
        <span aria-hidden="true" style={{ position: "relative", width: node, height: node, flexShrink: 0, borderRadius: "50%", boxSizing: "border-box", border: stroke(1.5, rgba(tone, 0.25)),
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: FS(12), fontWeight: 800,
          animation: `sbLdLight .4s ${lightAt}ms ease both` }}>
          {to + 1}
        </span>
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, whiteSpace: "nowrap" }}>
          <span style={{ fontSize: FS(10), fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: MUTED }}>Up next · {to + 1}/{N}</span>
          <span style={{ fontSize: FS(13.5), fontWeight: 800, letterSpacing: "-0.01em", color: C.inkOnBg }}>{next.label}</span>
        </span>
        {/* the wait: a line drawing itself round the whole pill */}
        {box && box.w > 0 && (
          <svg aria-hidden="true" width={box.w} height={box.h} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}>
            <rect x="0.75" y="0.75" width={box.w - 1.5} height={box.h - 1.5} rx={(box.h - 1.5) / 2} fill="none" stroke={rgba(tone, 0.1)} strokeWidth="1.5" />
            <rect x="0.75" y="0.75" width={box.w - 1.5} height={box.h - 1.5} rx={(box.h - 1.5) / 2} fill="none" stroke={tone} strokeWidth="1.5" strokeLinecap="round"
              pathLength="100" strokeDasharray="100" style={{ animation: trace }} />
          </svg>
        )}
      </div>
    </div>
  );
}
/* A floating note, bottom right, above the sticky bar (the four bundle types only): a rounded rectangle with a gift popping out of its top edge. It appears while a Subscribe button is on screen;
   the cross closes it and it comes back after a while. */
const FREEBIE_COOLDOWN_MS = 30000;
function FreebieGift({ size }) {
  const box = FEST ? [DIWALI.redBright, DIWALI.red] : ["#3a3a3a", "#111111"], rib = FEST ? [DIWALI.goldBright, DIWALI.goldDeep] : [mix(C.accent, "#ffffff", 0.7), C.accent], star = FEST ? DIWALI.gold : "#111111";
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="fg-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={box[0]} /><stop offset="1" stopColor={box[1]} /></linearGradient>
        <linearGradient id="fg-rib" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={rib[0]} /><stop offset="1" stopColor={rib[1]} /></linearGradient>
      </defs>
      <path d="M9 47l2.4 5.6 5.6 2.4-5.6 2.4L9 63l-2.4-5.6L1 55l5.6-2.4z" fill={star} stroke={FEST ? DIWALI.goldDeep : "#555"} strokeWidth="1" strokeLinejoin="round" />
      <path d="M92 66l2.9 6.8 6.8 2.9-6.8 2.9L92 92l-2.9-6.8-6.8-2.9 6.8-2.9z" fill={star} stroke={FEST ? DIWALI.goldDeep : "#555"} strokeWidth="1" strokeLinejoin="round" />
      <g transform="rotate(-7 50 58)">
        <rect x="18" y="44" width="64" height="44" rx="5" fill="url(#fg-box)" />
        <rect x="14" y="36" width="72" height="14" rx="4" fill="url(#fg-box)" stroke="rgba(255,255,255,.22)" strokeWidth="1" />
        <rect x="42" y="36" width="16" height="52" fill="url(#fg-rib)" />
        <rect x="24" y="44" width="6" height="42" fill="rgba(255,255,255,.14)" />
        <path d="M50 36C34 14 14 20 24 33c7 7 20 5 26 3z" fill="url(#fg-rib)" stroke={FEST ? DIWALI.goldDeep : "#6aa62a"} strokeWidth="1" strokeLinejoin="round" />
        <path d="M50 36c16-22 36-16 26-3-7 7-20 5-26 3z" fill="url(#fg-rib)" stroke={FEST ? DIWALI.goldDeep : "#6aa62a"} strokeWidth="1" strokeLinejoin="round" />
        <circle cx="50" cy="36" r="5.5" fill="url(#fg-rib)" stroke={FEST ? DIWALI.goldDeep : "#6aa62a"} strokeWidth="1" />
      </g>
    </svg>
  );
}
function FreebieNudge({ rootRef, sel, bottom, right, zIndex = 58, test, onAction, always = false }) {
  const [seen, setSeen] = useState(false), [gone, setGone] = useState(0), [, bump] = useState(0);
  useEffect(() => {
    const check = () => {
      const root = rootRef.current; if (!root) return;
      const rr = root.getBoundingClientRect();
      const ok = always || [...root.querySelectorAll(sel)].some((el) => {
        if (test && !test(el)) return false;
        const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return false;
        const x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < rr.left || x > rr.right || y < rr.top || y > rr.bottom) return false;
        const hit = document.elementFromPoint(x, y);          // the real test: is the button on top at its own centre (clipping, collapsed panels and off-screen bars all fail it)
        return !!hit && (el === hit || el.contains(hit) || !!(hit.closest && hit.closest("[data-freebie-nudge]")));
      });
      setSeen((v) => (v === ok ? v : ok));
    };
    check(); const t = setInterval(check, 300); return () => clearInterval(t);
  }, [sel, always]);
  useEffect(() => { if (!gone) return undefined; const t = setTimeout(() => bump((n) => n + 1), FREEBIE_COOLDOWN_MS); return () => clearTimeout(t); }, [gone]);
  if (!seen || (gone && Date.now() - gone < FREEBIE_COOLDOWN_MS)) return null;
  const gs = DESK ? 56 : 46, gl = DESK ? 12 : 10;
  return (
    <div role="status" data-freebie-nudge="1" style={{ position: "absolute", right, bottom, zIndex, width: DESK ? 236 : 188, boxSizing: "border-box", transition: `right .45s ${EASE_COLLAPSE}, bottom .3s ease`, animation: "sbFreebieIn .38s cubic-bezier(.22,1,.36,1) both" }}>
      {/* the gift sits on the left, centred on the text's line, a little proud of the box */}
      <div aria-hidden="true" style={{ position: "absolute", top: 0, bottom: 0, left: gl, zIndex: 2, display: "flex", alignItems: "center", pointerEvents: "none", transform: `translateY(-${DESK ? 4 : 3}px)` }}>
        <div style={{ width: gs, height: gs, flexShrink: 0, filter: "drop-shadow(0 8px 10px rgba(0,0,0,.22))" }}><FreebieGift size={gs} /></div>
      </div>
      {/* the text sits on the right, left-aligned and centred vertically */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: sh.card + 2, padding: DESK ? `14px 16px 14px ${gs + gl + 8}px` : `12px 12px 12px ${gs + gl + 6}px`, minHeight: DESK ? 60 : 52, display: "flex", alignItems: "center", textAlign: "left", boxSizing: "border-box",
        background: FEST ? `linear-gradient(135deg, ${DIWALI.ivory}, ${DIWALI.beige})` : mix(C.accent, "#ffffff", 0.13), border: FEST ? stroke(1, DIWALI.goldEdge) : stroke(1, "rgba(0,0,0,.08)"), boxShadow: "0 14px 28px -16px rgba(0,0,0,.4)" }}>
        <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 20% 0%, rgba(255,255,255,.75), rgba(255,255,255,0) 60%)" }} />
        <div style={{ position: "relative", fontSize: FS(12.5), fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25, color: C.inkOnBg }}>Freebie available on <span style={{ color: FEST ? DIWALI.red : C.inkOnBg }}>Subscription</span></div>
      </div>
      {/* the cross overlaps the top-right corner — no space reserved for it */}
      <button aria-label="Dismiss" onClick={() => setGone(Date.now())} className="sb-anim" style={{ position: "absolute", top: -8, right: -8, width: DESK ? 22 : 20, height: DESK ? 22 : 20, padding: 0, borderRadius: "50%", background: C.white, border: FEST ? stroke(1, DIWALI.goldEdge) : stroke(1, LINE), color: "rgba(0,0,0,.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3, boxShadow: "0 4px 10px -4px rgba(0,0,0,.3)" }}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </button>
    </div>
  );
}

/* the product details drawer — opened by tapping a product's image. Image carousel, then: title · description · price · variants · CTA (the card's own variant pickers and CTA, live) */
function DetailsCarousel({ p }) {
  const ref = useRef(null), [idx, setIdx] = useState(0), N = 3;
  const go = (n) => { const el = ref.current; if (!el) return; const k = (n + N) % N; el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" }); setIdx(k); };
  const onScroll = () => { const el = ref.current; if (!el) return; setIdx(Math.round(el.scrollLeft / (el.clientWidth || 1))); };
  const arrow = (dir) => <button aria-label={dir < 0 ? "Previous image" : "Next image"} onClick={() => go(idx + dir)} className="sb-anim" style={{ position: "absolute", top: "50%", marginTop: -14, [dir < 0 ? "left" : "right"]: 8, width: 28, height: 28, padding: 0, border: "none", borderRadius: sh.round, background: "rgba(255,255,255,.92)", color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px -4px rgba(0,0,0,.3)", zIndex: 2 }}>{dir < 0 ? <IconChevronLeft size={15} /> : <IconChevronRight size={15} />}</button>;
  return (
    <div data-details-carousel="1" style={{ position: "relative", borderRadius: sh.img, overflow: "hidden" }}>
      <div ref={ref} onScroll={onScroll} className="sb-scroll" style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory" }}>
        {[0, 1, 2].map((k) => <div key={k} style={{ flex: "0 0 100%", aspectRatio: "1 / 1", scrollSnapAlign: "start", background: k === 0 ? C.fill : k === 1 ? mix(C.fill, "#ffffff", 0.78) : mix(C.fill, "#000000", 0.94) }} />)}
      </div>
      {!p.free && !p.reward && <span style={{ position: "absolute", top: 12, right: 12, display: "flex", zIndex: 2, transform: DESK ? "scale(1.12)" : "scale(1.4)", transformOrigin: "top right" }}><OffPill p={p} /></span>}
      {arrow(-1)}{arrow(1)}
    </div>
  );
}
function ProductDetails({ item, kit, onClose, onPicked }) {
  const [more, setMore] = useState(false);                    // description: one line, READ MORE opens the full text
  const p = item.p, cat = item.cat, i = item.i, hasCat = cat !== undefined && !BXGY;
  const fixed = BXGY && !p.reward ? true : false;
  const selected = hasCat && kit.isPicked(cat, i), filled = hasCat && kit.items[cat].length > 0, freeCat = hasCat && isFreeCat(cat), locked = hasCat && freeCat && kit.freeLocked;
  const sel = hasCat || fixed ? kit.varsFor(p) : (p.variants || []).map((v) => v.options[0]);
  const blocked = hasCat && !p.reward && !p.free && filled && !selected && (!MULTI || freeCat) && !BYOB && !BXGY;
  const qty = hasCat ? kit.qtyOf(p) : 1;
  const hasPickers = hasCat && !p.reward && !p.free, hasCta = hasCat && !p.reward;
  const cta = { height: 46, width: "100%", borderRadius: sh.pill, cursor: "pointer", fontSize: FS(13), fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
  const qbtn = { width: 30, height: 30, padding: 0, border: "none", borderRadius: sh.round, background: "rgba(255,255,255,.16)", color: C.onBar, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
  const add = () => { kit.pick(cat, i); if (!MULTI) { onPicked && onPicked(cat); onClose(); } };
  return (
    <div data-product-details="1" style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", background: C.white }}>
      <div style={{ padding: `18px ${DR.padX}px 14px`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}><div style={{ ...DR.title, color: C.inkOnBg }}>Product details</div></div>
        <CircleBtn label="Close" onClick={onClose}><IconX /></CircleBtn>
      </div>
      <div style={{ borderTop: stroke(1, LINE), flexShrink: 0 }} />
      <div className="sb-scroll" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: `18px ${DR.padX}px 18px` }}>
        <DetailsCarousel p={p} />
        {/* title → description → price → variants */}
        <div style={{ marginTop: 14, fontSize: FS(15), fontWeight: 600, lineHeight: 1.3, color: C.inkOnBg }}>{p.name}</div>
        <div data-details-desc="1" style={{ marginTop: 6, display: "flex", alignItems: more ? "flex-start" : "baseline", gap: 8, fontSize: DESK ? 12 : 11, lineHeight: 1.4, color: MUTED }}>
          <span style={{ flex: "1 1 auto", minWidth: 0, ...(more ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>Made in small batches and shipped fresh. The full description, ingredients and shipping details come from your product page.</span>
          <button onClick={() => setMore((m) => !m)} aria-expanded={more} className="sb-anim" style={{ flexShrink: 0, padding: 0, border: "none", background: "transparent", cursor: "pointer", fontSize: DESK ? 10.5 : 9.5, fontWeight: 700, letterSpacing: 0.6, color: C.inkOnBg, textDecoration: "underline", textUnderlineOffset: 2 }}>{more ? "READ LESS" : "READ MORE"}</button>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: FS(19), fontWeight: 700, color: p.reward || freeCat ? freePal().price : C.priceOnTile }}>{p.reward || freeCat ? "FREE" : p.free ? "Free" : inr(p.price)}</span>
          <span style={{ fontSize: FS(13), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(p.mrp)}</span>
        </div>
        {hasPickers ? (
          <div data-details-variants="1" style={{ marginTop: 16, display: "flex", flexDirection: "row", gap: 10 }}>
            {p.variants.map((v, vi) => (
              <div key={v.label} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: FS(11.5), fontWeight: 600, color: MUTED, marginBottom: 6 }}>{v.label}</div>
                <Dropdown scrollIn full h={42} fs={12} bg={selected ? C.fieldOnSel : C.fieldOnTile} a11y={v.label} value={sel[vi]} options={v.options} onChange={(val) => kit.setVar(p, vi, val)} />
              </div>
            ))}
          </div>
        ) : (p.variants || []).length > 0 ? <div data-variant-line="1" style={{ marginTop: 14, fontSize: FS(12.5), color: MUTED }}>{(p.reward ? p.variant : sel.join(" • "))}</div> : null}
      </div>
      {/* the CTA — pinned at the bottom of the drawer */}
      {hasCta && (
        <div style={{ padding: `12px ${DR.padX}px 16px`, flexShrink: 0, borderTop: stroke(1, LINE) }}>
          {locked ? <button onClick={() => TOAST && TOAST(`Pick from every other category to unlock your ${freeTitle()}`)} aria-disabled="true" className="sb-anim" style={{ ...cta, background: C.white, color: MUTED, border: dashed(1.2, GREY_DARK), fontWeight: 600 }}><IconLock size={14} /> Locked</button>
            : p.free ? <div style={{ ...cta, cursor: "default", background: DIWALI.ivory, color: DIWALI.red, border: "1px solid rgba(245,197,66,.7)", fontWeight: 600 }}><GiftIcon size={14} color={DIWALI.red} /> Included</div>
            : BYOB && selected ? (
              <div style={{ ...cta, cursor: "default", justifyContent: "space-between", padding: "0 8px", gap: 0, background: C.primary, color: C.onBar, border: "none", fontWeight: 600 }}>
                <button onClick={() => kit.setQty(cat, i, qty - 1)} aria-label={qty <= 1 ? "Remove from bundle" : "One less"} className="sb-anim" style={qbtn}><IconMinusB size={13} /></button>
                <span aria-live="polite" style={{ minWidth: 20, textAlign: "center", fontSize: FS(14) }}>{qty}</span>
                <button onClick={() => kit.setQty(cat, i, qty + 1)} disabled={qty >= 9} aria-label="One more" className="sb-anim" style={{ ...qbtn, opacity: qty >= 9 ? 0.4 : 1 }}><IconPlusB size={13} /></button>
              </div>
            ) : selected ? <button onClick={() => kit.remove(cat, i)} aria-pressed="true" className="fb-cta sb-anim" style={{ ...cta, background: C.primary, color: C.onBar, border: "none" }}><span style={{ color: C.onBarAccent, display: "flex" }}><IconCheck size={13} w={3} /></span> {!MULTI || freeCat ? "Added · Remove" : "Added"}</button>
            : blocked ? <button onClick={() => TOAST && TOAST("Deselect your current pick to choose this one")} aria-disabled="true" className="sb-anim" style={{ ...cta, cursor: "not-allowed", background: C.white, color: MUTED, border: stroke(1, GREY_DARK) }}>{freeCat ? "Claim free" : "Select"}</button>
            : <button onClick={add} className="fb-cta sb-anim" style={{ ...cta, background: C.primary, color: C.onBar, border: "none" }}>{freeCat ? "Claim free" : MULTI ? "Add" : "Select"}</button>}
        </div>
      )}
    </div>
  );
}

/* BYOB (desktop): "Subscribe & save" slides in from the right over the side panel — the same size, fully covering it */
function SideDrawer({ open, onClose, label, children }) {
  const [mounted, setMounted] = useState(open), [vis, setVis] = useState(false);
  useEffect(() => {
    if (open) { setMounted(true); let r2; const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVis(true)); }); return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); }; }
    setVis(false); const t = setTimeout(() => setMounted(false), 450); return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return (
    <aside role="dialog" aria-label={label} data-side-drawer="1" className="fb-motion"
      style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", flexDirection: "column", overflow: "hidden", boxSizing: "border-box", background: C.white, border: stroke(0.75, GREY_LIGHT), borderRadius: sh.card, transform: vis ? "translateX(0)" : "translateX(100%)", transition: `transform .45s ${EASE_COLLAPSE}` }}>
      {children}
    </aside>
  );
}

function BundleDock({ kit, cat = 0, onJump, onOne, onSub, onNext, onPrev, dockRef, ordered = false, onAnother }) {
  const [open, setOpen] = useState(false);
  const show = kit.count > 0;
  useEffect(() => { if (!show) setOpen(false); }, [show]);
    return (
    <div ref={dockRef} aria-hidden={!show} className="fb-motion"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 50, background: C.white, borderTop: FEST ? `1px solid ${DIWALI.dark}` : stroke(1, LINE), borderRadius: `${sh.card}px ${sh.card}px 0 0`, boxShadow: "0 -8px 24px rgba(0,0,0,.07)", padding: `10px ${DR.padX}px 12px`,
        opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(105%)", pointerEvents: show ? "auto" : "none", transition: `transform .42s ${EASE_COLLAPSE}, opacity .25s ease` }}>
      {/* shows up with the Subscribe button — once every category has a pick */}
      {FEST && kit.complete && <div className="sb-in" style={{ margin: `-10px -${DR.padX}px 10px` }}><SubLockStrip round flip /></div>}
      {/* the products added so far — the same "Your Bundle" list the subscribe drawer uses */}
      <div style={{ margin: `0 -${DR.padX}px` }}>
        <Reveal open={open}>
          <div style={{ padding: `6px ${DR.padX}px 16px` }}>
            <BundleList maxH={360} bleed={DR.padX} kit={kit} onClose={() => setOpen(false)} onRemove={(c, idx) => kit.remove(c, idx)} onJump={(i) => { setOpen(false); onJump(i); }} />
          </div>
        </Reveal>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: !BYOB && !BXGY ? 8 : 12 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* Mix & Match: Prev sits first, on the left, before the products */}
          {!BYOB && !BXGY && !LAYOUT_V2 && <span style={{ marginRight: 8, display: "flex" }}><PrevNext kit={kit} onPrev={onPrev} next={false} onGo={() => setOpen(false)} h={28} fs={10.5} iconOnly /></span>}
          <Slots kit={kit} onJump={(i) => { setOpen(false); onJump(i); }} size={!BYOB && !BXGY ? 28 : 34} overlap={!BYOB && !BXGY ? 7 : 8} />
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Hide added products" : "Show added products"} className="fb-ghost sb-anim"
            style={{ marginLeft: -2, width: 20, height: 26, padding: 0, border: "none", background: "transparent", color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="fb-motion" style={{ display: "flex", transform: open ? "none" : "rotate(180deg)", transition: `transform .3s ${EASE_MICRO}` }}><IconDown size={14} /></span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div style={{ textAlign: "right", minWidth: 0 }}>
            <div key={kit.total} className="sb-pop" style={{ fontSize: FS(!BYOB && !BXGY ? 17 : 20), fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.05, color: C.inkOnBg }}>{inr(kit.total)}</div>
            {(BYOB || BXGY) && <div style={{ marginTop: 2, display: "flex", justifyContent: "flex-end" }}><PriceNote kit={kit} height={16} style={{ fontSize: FS(13), color: MUTED, fontWeight: 600 }} /></div>}
          </div>
          {/* Mix & Match: small Prev / Next */}
          {!BYOB && !BXGY && !LAYOUT_V2 && <PrevNext kit={kit} onNext={onNext} prev={false} onGo={() => setOpen(false)} h={28} fs={10.5} iconOnly />}
          {BYOB && MULTI && onNext && (
            <button onClick={() => { setOpen(false); onNext(); }} aria-label="Next category" data-dock-next="1" className="fb-cta sb-anim"
              style={{ width: 38, height: 38, flexShrink: 0, padding: 0, borderRadius: sh.round, border: "none", background: C.primary, color: C.onBar, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><IconArrowRightB size={17} /></button>
          )}
        </div>
      </div>

      {/* only once every category has a pick */}
      <Reveal open={kit.complete}>
        <div style={{ paddingTop: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <BuyNowBtn onClick={() => { setOpen(false); onOne(); }} tab={kit.complete ? 0 : -1} h={42} fs={FS(13)} />
            <SubSaveBtn onClick={() => { setOpen(false); onSub(); }} tab={kit.complete ? 0 : -1} h={42} fs={FS(13)} subFs={FS(10)} />
          </div>
          {/* BYOB: once Buy now / Subscribe has been tapped, a quiet secondary CTA to start another bundle — full width, shorter than the two above */}
          {BYOB && ordered && kit.complete && (
            <button onClick={() => { setOpen(false); onAnother && onAnother(); }} data-cta="build-another" className="fb-ghost sb-anim sb-attn"
              style={{ width: "100%", height: 34, marginTop: 8, borderRadius: sh.pill, background: "transparent", color: C.inkOnBg, border: stroke(1, GREY_DARK), fontSize: FS(11.5), fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap" }}>
              <IconPlusB size={13} /> Build another bundle
            </button>
          )}
        </div>
      </Reveal>
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
/* the page background: the light colour as a very, very light tint — no pattern */
const pageBgColor = () => (FEST ? mix(DIWALI.light, "#ffffff", 0.16) : PAGE_BG);
/* ---- the festive kit: everything Diwali shares these tokens (above) and this motion — one pulse (1.8 s), one shimmer sweep (3.6 s),
   one twinkle (2.2 s) — so the price-lock band, "Same Price, All Orders", the freebie scratcher, the offer pills, the tags and the free cards all read as one set.
   The Theme setting (Normal / Diwali) switches the whole kit on and off together. ---- */
const PLF_CSS = `
@keyframes plfBannerIn { from { max-height: 0; opacity: 0; transform: translateY(-6px); } to { max-height: 80px; opacity: 1; transform: none; } }
@keyframes plfShimmer  { 0% { transform: translateX(-120%) skewX(-18deg); } 100% { transform: translateX(430%) skewX(-18deg); } }
@keyframes sbRing { from { stroke-dashoffset: 113.1; } to { stroke-dashoffset: 0; } }
@keyframes sbFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes sbFreebieIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: none; } }
@keyframes sbFadeIn { from { opacity: 0; } to { opacity: 1; } }
.fb-cta[data-cta="subscribe"]:hover:not(:disabled) { filter: brightness(1.1); }
@keyframes plfTextGlint{ 0% { background-position: 0% 50%; } 100% { background-position: -200% 50%; } }
@keyframes plfFadeUp  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes plfTwinkle  { 0%, 100% { opacity: .25; transform: scale(.7) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(45deg); } }
.plf-shimmer   { animation: plfShimmer 3.6s linear infinite; }
.plf-glint     { animation: plfTextGlint 3.2s linear infinite; }
.plf-twinkle   { animation: plfTwinkle 2.2s ease-in-out infinite; }
.plf-fade-in   { animation: plfFadeUp .4s cubic-bezier(.22,1,.36,1) both; }
@keyframes festGlint   { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
@keyframes festFlicker { 0%, 100% { transform: scale(1, 1); opacity: .95; } 35% { transform: scale(.94, 1.08); opacity: 1; } 70% { transform: scale(1.05, .94); opacity: .9; } }
.fest-flicker  { animation: festFlicker 2.4s ease-in-out infinite; }
@keyframes festShake { 0% { transform: translate(0, 0) rotate(0deg); } 20% { transform: translate(2.6px, -1.8px) rotate(.9deg); } 40% { transform: translate(-2.6px, 1.6px) rotate(-.9deg); } 60% { transform: translate(2.2px, 1.8px) rotate(.7deg); } 80% { transform: translate(-2.2px, -1.6px) rotate(-.7deg); } 100% { transform: translate(0, 0) rotate(0deg); } }
.fest-shake    { animation: festShake .16s linear infinite; }
@keyframes festJolt { 0% { transform: none; } 12% { transform: translate(-4px, 1px) rotate(-1.6deg) scale(1.03); } 26% { transform: translate(4px, -1px) rotate(1.6deg) scale(1.03); } 40% { transform: translate(-3px, -1px) rotate(-1.2deg) scale(1.02); } 54% { transform: translate(3px, 1px) rotate(1.2deg) scale(1.02); } 70% { transform: translate(-2px, 0) rotate(-.6deg); } 85% { transform: translate(1px, 0) rotate(.3deg); } 100% { transform: none; } }
.fest-jolt     { animation: festJolt .44s ease-out both; }
@media (prefers-reduced-motion: reduce) { [data-price-lock-banner], [data-headline], .plf-twinkle, .plf-glint, .plf-fade-in, .fest-flicker, .fest-shake, .fest-jolt { animation: none !important; } .plf-shimmer { display: none !important; } }
`;
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
function usePlfStyles() {
  useIsoLayoutEffect(() => {
    if (typeof document === "undefined" || document.getElementById("plf-styles")) return;
    const el = document.createElement("style");
    el.id = "plf-styles";
    el.textContent = PLF_CSS;
    document.head.appendChild(el);
  }, []);
}
const PlfLock = ({ size = 10, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2.2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
const Spark = ({ size = 8, color, style, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, ...style }}><path d="M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12C6.4 11.1 11.1 6.4 12 0z" fill={color} /></svg>
);
const plfShimmerLayer = { position: "absolute", top: -2, bottom: -2, left: 0, width: "24%", pointerEvents: "none", background: "linear-gradient(90deg, rgba(255,236,179,0) 0%, rgba(255,236,179,.12) 38%, rgba(255,255,255,.22) 50%, rgba(255,236,179,.12) 62%, rgba(255,236,179,0) 100%)" };

function DiwaliText({ children, still = false, pulse = false, origin = "center" }) {
  usePlfStyles();
  return (
    <span data-diwali-text={still ? "still" : "1"} data-pulse={pulse ? "1" : "0"} className={pulse ? "pulse-text" : undefined} style={{ transformOrigin: `${origin} center`, display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.005em", whiteSpace: "nowrap" }}>
      <Spark className={still ? undefined : "plf-twinkle"} size={9} color={DIWALI.goldDeep} />
      {still
        ? <span style={{ color: DIWALI.red }}>{children}</span>
        : <span className="plf-glint" style={{ backgroundImage: `linear-gradient(100deg, ${DIWALI.red} 0%, ${DIWALI.redBright} 28%, ${DIWALI.goldDeep} 44%, ${DIWALI.goldBright} 50%, ${DIWALI.goldDeep} 56%, ${DIWALI.redBright} 72%, ${DIWALI.red} 100%)`, backgroundSize: "260% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: DIWALI.red }}>{children}</span>}
    </span>
  );
}

function FestShimmer() { return <span aria-hidden="true" className="plf-shimmer" style={plfShimmerLayer} />; }
const festPill = () => ({ position: "relative", overflow: "hidden", background: `linear-gradient(110deg, ${DIWALI.goldPale}, ${DIWALI.gold})`, color: DIWALI.redDeep, boxShadow: `inset 0 0 0 1px ${DIWALI.goldEdge}` });   // the gold offer pill (shimmers)
const festTag = (t) => (FEST ? ({ Bestseller: "Diwali Special", New: "Festive Offer" }[t] || t) : t);
/* the free cards' colours: Diwali ivory + gold when festive, the green wash otherwise */
const freePal = () => (FEST
  ? { bg: DIWALI.ivory, edge: DIWALI.goldSoft, edgeStrong: DIWALI.goldDeep, label: DIWALI.red, price: DIWALI.red, field: DIWALI.goldSoft, icon: DIWALI.red }
  : { bg: ACCENT_WASH, edge: ACCENT_BORDER, edgeStrong: C.accent, label: C.accentSafe, price: C.accentSafe, field: ACCENT_BORDER, icon: C.accentSafe });
function FreePill() {
  return FEST
    ? <span data-fest-pill="1" style={{ ...PILL_BOX, ...festPill() }}><span style={{ position: "relative" }}>FREE</span><FestShimmer /></span>
    : <span style={{ ...PILL_BOX, background: C.accent, color: C.onAccent }}>FREE</span>;
}
/* "Same Price, All Orders": Diwali text (red, sparkle, pulse) when festive, plain bold text otherwise */
function PromiseText({ origin = "right", kit }) {
  return <span data-saved="1" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{kit && kit.save > 0 ? `Saved ${inr(kit.save)}` : "Bundle complete"}</span>;   // Normal: no price-lock message — just what you saved
}
/* Mix & Match sticky bar: a thin nudge across its top that says what this category needs, how many are left, and when you can proceed.
   It goes away once every category is filled (the Subscribe & save strip takes its place). */
function catNudge(kit, cat) {
  const c = CATS[cat], n = kit.picksBy[cat].length, left = kit.items.filter((a) => a.length === 0).length;
  const cats = (k) => `${k} ${k === 1 ? "category" : "categories"}`;
  const after = left <= 1 ? "then you can proceed" : `${left - 1} more ${left - 1 === 1 ? "category" : "categories"} after this`;     // when this one still needs a pick
  const still = `${cats(left)} left`;                                                         // when this one is done
  if (isFreeCat(cat)) {
    if (FREE_LOCKED) { const k = kit.items.slice(0, LAST).filter((a) => !a.length).length; return { main: `${freeTitle()} is locked`, side: `Complete ${cats(k)} to unlock` }; }
    return n ? { main: `${c.title}: free pick added`, side: `Deselect to change · ${still}` } : { main: `Select 1 free product from ${c.title}`, side: after };
  }
  if (MULTI) return n ? { main: `${c.title}: ${n} added`, side: `Add more or tap Next · ${still}` } : { main: `Add at least 1 from ${c.title}`, side: after };
  return n ? { main: `${c.title}: 1/1 selected`, side: `Deselect to change · ${still}` } : { main: `Select 1 product from ${c.title}`, side: LAYOUT_V2 ? `Limit 1 per category · ${left <= 1 ? "then proceed" : `${left - 1} more after this`}` : after };
}
/* Mix & Match toast — every time a product lands in a category: what you just did, what comes next, how much is left (same message as the beige bar, spelled out per category) */
function pickToast(kit, c, wasN, auto = false) {
  const n = kit.picksBy[c].length, free = isFreeCat(c), label = free ? freeTitle() : CATS[c].title;
  const left = CATS.length - kit.items.filter((a) => a.length).length;
  if (kit.complete) return MULTI && wasN > 0 ? { state: "filled", main: `${label}: ${n} added`, sub: "Add more, or buy now / subscribe" } : { state: "done", main: "Bundle complete", sub: "Buy now or subscribe" };
  const open = kit.items.map((a, i) => (a.length === 0 && !(isFreeCat(i) && kit.freeLocked) ? i : -1)).filter((i) => i >= 0);
  if (!open.length) return { state: "filled", main: `${label}: ${n} added`, sub: "Fill the rest to unlock your free pick" };
  // where the Next button really goes: the next category (from the last one, the first empty one); if that one is still locked, point to the first open category
  const dest = c < LAST ? c + 1 : open[0], locked = isFreeCat(dest) && kit.freeLocked, to = locked ? open[0] : dest;
  const goTxt = locked ? `Go to ${CATS[to].title}` : `Tap Next for ${isFreeCat(to) ? "your free " : ""}${CATS[to].title}`;
  if (TIERED && !free) { const by = kit.byob; return { state: "filled", main: by.off ? `${label}: ${n} added · ${by.off}% off` : `${label}: ${n} added`, sub: `${by.next ? `Add ${by.left} more to unlock ${by.next.off}%` : "All offers unlocked"} · ${left} categor${left === 1 ? "y" : "ies"} left` }; }
  if (MULTI && !free) return { state: "filled", main: `${label}: ${n} added · ${CATS[c].off}% off`, sub: `Add more, or ${goTxt.charAt(0).toLowerCase()}${goTxt.slice(1)} · ${left} left` };   // many per category: each category has its own offer
  const sub = auto && !locked ? `Moving to ${CATS[to].title} · ${left} left` : `${goTxt} · ${left} left`;
  if (wasN === 0) return { state: "filled", main: `${label} done`, sub };
  if (MULTI && n > wasN) return { state: "filled", main: `${label}: ${n} added`, sub };
  return { state: "filled", main: `${label} updated`, sub };
}
/* the first look: a category was just opened and is still empty — outlined, just what to do here */
function openToast(kit, c) {
  const free = isFreeCat(c), t = CATS[c].title;
  if (free && kit.freeLocked) return { state: "open", main: `${freeTitle()} is locked`, sub: "Fill the other categories to unlock it" };
  return { state: "open", main: free ? `Pick your free ${t} item` : MULTI ? `Add at least 1 from ${t}` : `Pick 1 from ${t}`, sub: `Category ${c + 1} of ${CATS.length}` };
}
/* V2: the slim bar under the category pills — Prev · what this category needs (and its limit) · Next */
function CatNavBar({ kit, cat, d, onPrev, onNext, buttons = true }) {
  const t = kit.complete ? { main: "Bundle complete", side: "Buy now or subscribe below" } : catNudge(kit, cat);
  return (
    <div data-catnav="1" style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, height: d ? 46 : 48, padding: "0 6px", boxSizing: "border-box", background: C.white,
      border: FEST ? `1px solid ${DIWALI.dark}` : stroke(1.5, C.accent), borderRadius: sh.pill, ...(d ? { maxWidth: 640, margin: "8px auto 0" } : {}) }}>
      {buttons && <PrevNext kit={kit} onPrev={onPrev} next={false} h={d ? 34 : 32} fs={11} />}
      <div key={t.main + t.side} className="sb-in" role="status" aria-live="polite" data-catnav-text="1" style={{ flex: 1, minWidth: 0, textAlign: "center", lineHeight: 1.25 }}>
        <div style={{ fontSize: FS(d ? 12 : 11.5), fontWeight: 800, color: C.inkOnBg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.main}</div>
        <div style={{ fontSize: FS(d ? 10.5 : 10), fontWeight: 500, color: C.inkOnBg, opacity: 0.72, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.side}</div>
      </div>
      {buttons && (kit.complete ? <span style={{ width: d ? 66 : 62, flexShrink: 0 }} /> : <PrevNext kit={kit} onNext={onNext} prev={false} h={d ? 34 : 32} fs={11} />)}
    </div>
  );
}
/* Diwali: a very thin strip along the top of the bottom bar — three messages, words only.
   Desktop bar: all three side by side, separated by •. Mobile bar + the Proceed drawer (flip): one at a time, flipping like the main announcement bar. */
const subStripMsgs = () => [<>Subscribe &amp; save <span style={{ color: DIWALI.goldBright, fontWeight: 800 }}>{COPY.subscribeOff}%</span></>, "All prices locked", ...(FIXED ? [] : ["Free gift on select plans"])];
function SubLockStrip({ d, round = false, flip = false }) {
  const list = subStripMsgs();
  const [st, setSt] = useState({ cur: 0, prev: -1 });
  useEffect(() => {
    if (!flip) return undefined;
    const t = setInterval(() => setSt((o) => ({ cur: (o.cur + 1) % list.length, prev: o.cur })), COPY.announceEvery);
    return () => clearInterval(t);
  }, [flip, list.length]);
  const text = { fontSize: FS(d ? 10.5 : 9.5), fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap" };
  return (
    <div role="note" data-sub-strip={flip ? "flip" : "row"} className={flip ? "tick-wrap" : undefined} style={{ position: "relative", overflow: "hidden", height: d ? 22 : 20, display: "flex", alignItems: "center", justifyContent: "center", background: festGrad(100), color: DIWALI.goldPale,
      boxShadow: `inset 0 -1px 0 ${DIWALI.gold}`, borderRadius: round ? `${sh.card}px ${sh.card}px 0 0` : 0, ...text }}>
      {flip
        ? list.map((t, i) => <div key={i} data-sub-strip-msg={i} className={"tick-item" + (i === st.cur ? " tick-cur" : i === st.prev ? " tick-prev" : "")} style={text}><span>{t}</span></div>)
        : <span style={{ position: "relative" }}>{list.map((t, i) => <Fragment key={i}>{i > 0 && <span aria-hidden="true" style={{ opacity: 0.55, margin: "0 9px" }}>•</span>}{t}</Fragment>)}</span>}
      <span aria-hidden="true" className="plf-shimmer" style={plfShimmerLayer} />
    </div>
  );
}
/* the words — festive when the theme is on */
const heroEyebrow = () => (FREE_LAST ? (FEST ? `Diwali Special · Buy ${LAST} Get 1 Free` : freeCopy(COPY.eyebrowFree)) : BXGY ? (FEST ? `Diwali Special · ${bxgyEyebrow()}` : bxgyEyebrow()) : BYOB ? (FEST ? "Diwali Special" : COPY.eyebrowByob) : (FEST ? "Diwali Special" : COPY.eyebrow));
const heroHeading = () => (BXGY ? (FEST ? (FIXED ? "The Diwali Bundle" : "The Diwali Gift Bundle") : COPY.bundleName) : (FEST ? "Light up Diwali, your way." : COPY.heading));
const heroSub = () => (FREE_LAST ? (MULTI
    ? (FEST ? `Pick as many as you like from the first ${LAST} categories, then claim 1 product from ${CATS[LAST].title} free this Diwali.` : freeCopy(COPY.subFreeMulti))
    : (FEST ? `Pick one from each of the first ${LAST} categories and get 1 product from ${CATS[LAST].title} free this Diwali.` : freeCopy(COPY.subFree)))
  : BYOB ? (BYOB_FLAT ? (FEST ? flatCopy("Add any {n} products to your bundle and get {off}% OFF this Diwali.") : flatCopy(COPY.subByobFlat)) : FEST ? "Add as many products as you like. The more you add, the more Diwali offers you unlock." : COPY.subByob)
  : BXGY ? (FIXED ? (FEST ? `Get all ${BXGY_CATS[0].products.length} products together this Diwali, at one festive bundle price.` : bxgySub()) : FEST ? `Buy all ${BXGY_CATS[0].products.length} products this Diwali and get ${BXGY_REWARDS.length === 1 ? "1 free gift" : `${BXGY_REWARDS.length} free gifts`}, added automatically at checkout.` : bxgySub())
  : TIERED ? (FEST ? "Pick as many as you like from any category. The more you add, the more Diwali offers you unlock." : COPY.subByob)
  : MULTI ? (FEST ? "Pick as many as you like from each category. Every category has its own Diwali offer." : COPY.subMulti)
  : (FEST ? "Pick one from each category and celebrate Diwali at one fixed festive price." : COPY.sub));
const festAnnouncements = () => (FREE_LAST ? ["Festive Free Shipping on *Every Diwali Order*", `*Diwali Special*: Pick ${LAST}, Get 1 Free`, "Order by 5 PM for *Same-Day Dispatch*"]
  : TIERED ? ["Festive Free Shipping on *Every Diwali Order*", "*The More You Add*, The More Diwali Offers", "Order by 5 PM for *Same-Day Dispatch*"]
  : BYOB ? ["Festive Free Shipping on *Every Diwali Order*", BYOB_FLAT ? flatCopy("*Diwali Special*: Add {n} Products, Get {off}% OFF") : "*The More You Add*, The More Diwali Offers", "Order by 5 PM for *Same-Day Dispatch*"]
  : BXGY ? ["Festive Free Shipping on *Every Diwali Order*", FIXED ? `*Diwali Special: ${BXGY_CATS[0].products.length} Products, One Bundle*` : `*Diwali Special: Buy ${BXGY_CATS[0].products.length}, Get ${BXGY_REWARDS.length} Free*`, "Order by 5 PM for *Same-Day Dispatch*"]
  : MULTI ? ["Festive Free Shipping on *Every Diwali Order*", "*Diwali Special*: Pick As Many As You Like, Save More", "Order by 5 PM for *Same-Day Dispatch*"]
  : ["Festive Free Shipping on *Every Diwali Order*", "*Diwali Special*: Pick 3 Products, Pay One Fixed Price", "Order by 5 PM for *Same-Day Dispatch*"]);
const GiftIcon = ({ size = 22, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="10" width="17" height="10" rx="1.8" /><rect x="2.5" y="6.5" width="19" height="3.5" rx="1.2" /><path d="M12 6.5V20" />
    <path d="M12 6.5C10.6 3.6 7 3.4 7 5.5c0 1.5 2.7 1.3 5 1zM12 6.5c1.4-2.9 5-3.1 5-1 0 1.5-2.7 1.3-5 1z" />
  </svg>
);

/* The foil you scratch: a pale-gold canvas laid over whatever sits under it. Drag across it to scratch it away, or just tap / press Enter.
   Past ~40% scratched it lets go of the rest. Without a canvas (very old browsers) the CSS foil stays and a tap still reveals. */
function ScratchFoil({ onDone, hint, vibrate = false, onDrag }) {
  const ref = useRef(null);
  const st = useRef({ down: false, travelled: 0, last: null, moves: 0, ctx: null, done: false, dragging: false, vt: 0 });
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    cv.width = Math.max(1, Math.round(cv.offsetWidth * dpr));
    cv.height = Math.max(1, Math.round(cv.offsetHeight * dpr));
    const ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return;
    st.current.ctx = ctx;
    const g = ctx.createLinearGradient(0, 0, cv.width, cv.height);
    const fo = FEST ? DIWALI.foil : ["#f3f3f3", "#cfcfcf", "#e8e8e8"];
    g.addColorStop(0, fo[0]); g.addColorStop(0.55, fo[1]); g.addColorStop(1, fo[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = dpr;
    for (let x = -cv.height; x < cv.width; x += 13 * dpr) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + cv.height, cv.height); ctx.stroke(); }
  }, []);
  const endDrag = () => { const s = st.current; if (s.dragging) { s.dragging = false; if (onDrag) onDrag(false); } };
  const finish = () => { if (st.current.done) return; st.current.done = true; endDrag(); onDone(); };
  const pos = (e) => { const cv = ref.current, r = cv.getBoundingClientRect(), w = r.width || cv.offsetWidth || 1, h = r.height || cv.offsetHeight || 1; return [(e.clientX - r.left) * (cv.width / w), (e.clientY - r.top) * (cv.height / h)]; };
  const cleared = () => { const cv = ref.current, d = st.current.ctx.getImageData(0, 0, cv.width, cv.height).data; let n = 0, t = 0; for (let i = 3; i < d.length; i += 48) { t++; if (d[i] < 20) n++; } return t ? n / t : 0; };
  const down = (e) => { const s = st.current; s.down = true; s.travelled = 0; s.last = pos(e); if (e.currentTarget.setPointerCapture && e.pointerId !== undefined) { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } } };
  const move = (e) => {
    const s = st.current; if (!s.down) return;
    const p = pos(e), l = s.last || p; s.travelled += Math.hypot(p[0] - l[0], p[1] - l[1]); s.last = p;
    if (!s.dragging && s.travelled > 6) { s.dragging = true; if (onDrag) onDrag(true); }                 // a real drag has begun
    if (s.dragging && vibrate) { const now = Date.now(); if (now - s.vt > 55) { s.vt = now; try { if (navigator.vibrate) navigator.vibrate(7); } catch (x) { /* no haptics here */ } } }
    if (s.ctx) {
      const cv = ref.current;
      s.ctx.globalCompositeOperation = "destination-out"; s.ctx.lineCap = "round"; s.ctx.lineWidth = 28 * (cv.width / (cv.offsetWidth || 1));
      s.ctx.beginPath(); s.ctx.moveTo(l[0], l[1]); s.ctx.lineTo(p[0], p[1]); s.ctx.stroke();
      if (++s.moves % 5 === 0 && cleared() > 0.4) finish();
    } else if (s.travelled > 40) finish();
  };
  const up = () => { const s = st.current; if (!s.down) return; s.down = false; endDrag(); if (s.travelled < 6) finish(); };   // a tap, not a scratch → reveal
  return (
    <>
      <canvas ref={ref} data-scratch-foil="1" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "pointer", background: FEST ? `linear-gradient(135deg, ${DIWALI.foil[0]}, ${DIWALI.foil[1]} 55%, ${DIWALI.foil[2]})` : "linear-gradient(135deg, #f3f3f3, #cfcfcf 55%, #e8e8e8)" }} />
      <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, pointerEvents: "none", fontSize: 12, fontWeight: 600, color: FEST ? "#7a4b00" : "#555555" }}>{hint}</span>
    </>
  );
}

/* the foil for a TAP-to-open card: a gold sheet with a gift on it and a short invitation (no scratching) */
function TapFoil({ hint, sub, onTap, compact = false }) {
  const ink = FEST ? "#7a4b00" : "#555555";
  return (
    <div data-tap-foil="1" onClick={onTap} style={{ position: "absolute", inset: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: compact ? "0 12px" : 10,
      background: FEST ? `linear-gradient(135deg, ${DIWALI.foil[0]}, ${DIWALI.foil[1]} 55%, ${DIWALI.foil[2]})` : "linear-gradient(135deg, #f3f3f3, #cfcfcf 55%, #e8e8e8)" }}>
      <span className={FEST ? "pulse-text" : undefined} style={{ display: "flex", flexDirection: compact ? "row" : "column", alignItems: "center", gap: compact ? 10 : 6 }}>
        <span style={{ width: compact ? 30 : 40, height: compact ? 30 : 40, flexShrink: 0, borderRadius: 999, background: "rgba(255,255,255,.55)", boxShadow: "0 0 0 1px rgba(154,107,0,.22)", display: "flex", alignItems: "center", justifyContent: "center" }}><GiftIcon size={compact ? 16 : 22} color={FEST ? DIWALI.goldDeep : "#6b6b6b"} /></span>
        <span style={{ fontSize: compact ? 12 : 12.5, fontWeight: 700, letterSpacing: "-0.005em", color: ink }}>{hint}</span>
        {sub && !compact && <span style={{ fontSize: 10.5, fontWeight: 500, lineHeight: 1.3, color: ink, opacity: 0.8 }}>{sub}</span>}
      </span>
    </div>
  );
}
/* =====================================================================
   ScratchReveal — a scratch card laid over anything. It starts sealed under foil; scratch it (or tap / press Enter)
   and the foil lifts to show what is underneath — put a real product card inside and that is what appears.
   props
     children   what is under the foil
     hint       the line on the foil                         default "Scratch to reveal"
     revealed   control it from outside (optional) · onReveal() is called when it opens
     radius     corner radius of the foil, to match the card under it     default 16
   ===================================================================== */
function ScratchReveal({ children, hint = "Scratch to reveal", revealed: revealedProp, onReveal, radius = 16, vibrate = false, tap = false, compact = false, sub, className = "", style }) {
  usePlfStyles();
  const [inner, setInner] = useState(false);
  const revealed = revealedProp !== undefined ? revealedProp : inner;
  const [gone, setGone] = useState(revealed);                  // the foil is taken out of the page once it has faded
  useEffect(() => {
    if (!revealed) { setGone(false); return undefined; }
    const t = setTimeout(() => setGone(true), 520);
    return () => clearTimeout(t);
  }, [revealed]);
  const rootRef = useRef(null);
  const [drag, setDrag] = useState(false), [jolt, setJolt] = useState(false), joltT = useRef(null);
  useEffect(() => () => clearTimeout(joltT.current), []);                  // while it is being dragged the card trembles a little
  const doTap = () => {                                    // tap mode: the card jolts and buzzes, then the foil lifts
    if (revealed || jolt) return;
    setJolt(true); try { if (navigator.vibrate) navigator.vibrate([12, 40, 16]); } catch (x) { /* no haptics here */ }
    joltT.current = setTimeout(() => { setJolt(false); reveal(); }, 430);
  };
  const reveal = () => { if (revealed) return; setInner(true); if (onReveal) onReveal(rootRef.current); };
  return (
    <div ref={rootRef} data-scratch-reveal={revealed ? "revealed" : "sealed"} className={className + (drag ? " fest-shake" : "") + (jolt ? " fest-jolt" : "")} role={revealed ? undefined : "button"} tabIndex={revealed ? undefined : 0} aria-label={revealed ? undefined : tap ? "Tap to reveal your free gift" : "Scratch to reveal your freebie"}
      onKeyDown={(e) => { if (!revealed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); if (tap) doTap(); else reveal(); } }}
      style={{ position: "relative", borderRadius: radius, outline: "none", ...style }}>
      <div inert={revealed ? undefined : ""} aria-hidden={!revealed} className={revealed ? "plf-fade-in" : undefined}>{children}</div>
      {!gone && (
        <div data-foil-wrap="1" style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", opacity: revealed ? 0 : 1, transform: revealed ? "scale(1.03)" : "none", transition: "opacity .5s ease, transform .5s ease", pointerEvents: revealed ? "none" : "auto" }}>
          {tap ? <TapFoil hint={hint} sub={sub} onTap={doTap} compact={compact} /> : <ScratchFoil key={FEST ? "f" : "n"} onDone={reveal} vibrate={vibrate} onDrag={setDrag} hint={<span className={FEST ? "pulse-text" : undefined} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}><GiftIcon size={22} color={FEST ? DIWALI.goldDeep : "#6b6b6b"} /><span>{hint}</span></span>} />}
          {FEST && <><Spark className="plf-twinkle" size={9} color={DIWALI.red} style={{ position: "absolute", top: 8, right: 10, pointerEvents: "none" }} /><Spark className="plf-twinkle" size={6} color={DIWALI.redBright} style={{ position: "absolute", bottom: 9, left: 12, pointerEvents: "none", animationDelay: ".9s" }} /><FestShimmer /></>}
        </div>
      )}
    </div>
  );
}


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
/* the thin Diwali banner under the last products: the merchant's message + the brand logo */
function FestStrip({ d }) {
  const logo = COPY.logo;
  return (
    <div data-fest-strip="1" style={{ position: "relative", overflow: "hidden", margin: d ? "2px 14px 16px" : "2px 12px 14px", minHeight: d ? 46 : 42, borderRadius: sh.card, display: "flex", alignItems: "center", justifyContent: "center", gap: d ? 12 : 8, padding: "0 12px",
      background: `linear-gradient(100deg, ${DIWALI.ivory}, ${DIWALI.beige} 50%, ${DIWALI.ivory})`, border: `1px solid ${DIWALI.goldEdge}` }}>
      <span data-fest-logo="1" style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, position: "relative" }}>
        {logo ? <img src={logo} alt={COPY.brand} style={{ height: d ? 24 : 20, width: "auto", objectFit: "contain", display: "block" }} /> : <BrandLogo textSize={d ? 15 : 13} />}
      </span>
      <span aria-hidden="true" style={{ width: 1, height: d ? 18 : 16, background: DIWALI.goldEdge, flexShrink: 0 }} />
      <span style={{ position: "relative", minWidth: 0, fontSize: FS(d ? 12 : 11.5), fontWeight: 600, color: DIWALI.red, letterSpacing: "-0.005em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{COPY.festMessage}</span>
      <FestShimmer />
    </div>
  );
}
/* =====================================================================
   Diwali celebration (from the uploaded file): a canvas over the whole frame — Diwali theme only, off for reduced motion.
   · the bundle completes → small crackers pop just above the bottom bar, and two confetti cannons fire marigold petals + foil confetti from the edges
   The colours are ours: the chosen dark / light colours and the gold family.
   ===================================================================== */
const festSparkPairs = () => [[DIWALI.goldBright, DIWALI.goldPale], [DIWALI.redBright, DIWALI.gold], [DIWALI.goldDeep, DIWALI.goldBright], [DIWALI.red, DIWALI.goldPale], [DIWALI.gold, DIWALI.redBright]];
const festConfettiCols = () => [DIWALI.gold, DIWALI.goldBright, DIWALI.goldDeep, DIWALI.red, DIWALI.redBright, mix(DIWALI.red, "#ffffff", 0.5), DIWALI.goldPale, mix(DIWALI.light, DIWALI.red, 0.55)];
function makeCelebration(canvas) {
  const ctx = canvas.getContext("2d"); if (!ctx) return null;
  let W = 0, H = 0, raf = 0, last = 0, t = 0;
  const P = [], C2 = [], Q = [];   // sparks, confetti, scheduled events
  const rnd = (a, b) => a + Math.random() * (b - a);
  const fit = () => {
    const r = canvas.parentElement.getBoundingClientRect(), lw = canvas.parentElement.offsetWidth, lh = canvas.parentElement.offsetHeight;
    const k = (r.width / lw) || 1, dpr = Math.min(2, window.devicePixelRatio || 1) * k;
    W = lw; H = lh; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const spark = (o) => P.push({ px: o.x, py: o.y, life: 0, drag: 0.975, g: 0.06, size: 1.8, crackle: false, trail: 0, ...o });
  const confetti = (x, y, n, dir, power = 1) => {
    const cols = festConfettiCols();
    for (let i = 0; i < n; i++) {
      const a = (dir === 0 ? rnd(-Math.PI * 0.75, -Math.PI * 0.25) : dir > 0 ? rnd(-Math.PI * 0.46, -Math.PI * 0.2) : rnd(-Math.PI * 0.8, -Math.PI * 0.54));
      const sp = rnd(6, 12) * power, petal = Math.random() < 0.38;
      C2.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: rnd(0, 6.28), vr: rnd(-0.25, 0.25), flip: rnd(0, 6.28), vf: rnd(0.08, 0.2), sway: rnd(0, 6.28),
        w: petal ? rnd(5, 7) : rnd(4, 7), h: petal ? rnd(7, 10) : rnd(8, 12), shape: petal ? "petal" : Math.random() < 0.2 ? "dot" : "rect",
        color: petal ? (Math.random() < 0.6 ? DIWALI.gold : DIWALI.goldDeep) : cols[(Math.random() * cols.length) | 0], life: 0, max: rnd(150, 210) });
    }
  };
  const mini = (x, y, pal) => {   // a small cracker: a tight pop of sparks with a few crackles
    for (let i = 0; i < 38; i++) { const ang = rnd(0, Math.PI * 2), sp = rnd(1.4, 3.6); spark({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, max: rnd(30, 44), color: i % 3 ? pal[0] : pal[1], size: rnd(2, 2.6), g: 0.05, crackle: i % 5 === 0 }); }
    P.push({ flash: true, x, y, life: 0, max: 8, color: pal[1], small: true });
  };
  const step = (dt) => {
    t += dt;
    for (let i = Q.length - 1; i >= 0; i--) if (Q[i].at <= t) { Q[i].fn(); Q.splice(i, 1); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life++;
      if (!p.flash) { p.px = p.x; p.py = p.y; p.vx *= p.drag; p.vy = p.vy * p.drag + p.g; p.x += p.vx; p.y += p.vy; }
      if (p.life >= p.max) { if (p.crackle) for (let k = 0; k < 3; k++) spark({ x: p.x, y: p.y, vx: rnd(-1.2, 1.2), vy: rnd(-1.2, 1.2), max: rnd(6, 11), color: DIWALI.gold, size: 1.2, g: 0 }); P.splice(i, 1); } }
    for (let i = C2.length - 1; i >= 0; i--) { const c = C2[i]; c.life++; c.vx *= 0.965; c.vy = c.vy * 0.965 + 0.22; c.sway += 0.06;
      c.x += c.vx + Math.sin(c.sway) * 0.6; c.y += Math.min(c.vy, 3.2); c.rot += c.vr; c.flip += c.vf;
      if (c.life > c.max || c.y > H + 20) C2.splice(i, 1); }
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    for (const p of P) { const k = 1 - p.life / p.max, a = p.crackle && p.life > p.max * 0.6 ? (Math.random() < 0.5 ? k : k * 0.2) : k;
      if (p.flash) { const r = p.small ? 2 + p.life * 1.6 : 4 + p.life * 3; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, `rgba(255,255,255,${0.9 * k})`); g.addColorStop(1, rgba(DIWALI.gold, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); continue; }
      ctx.globalAlpha = Math.max(0, a);
      if (p.trail || p.life < 18) { ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.9; ctx.beginPath(); ctx.moveTo(p.px - p.vx * (p.trail ? 3 : 1.5), p.py - p.vy * (p.trail ? 3 : 1.5)); ctx.lineTo(p.x, p.y); ctx.stroke(); }
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.4 * k), 0, 7); ctx.fill();
      ctx.globalAlpha = Math.max(0, a * 0.18); ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.2, 0, 7); ctx.fill(); }
    for (const c of C2) { const fade = Math.min(1, (c.max - c.life) / 30); ctx.globalAlpha = Math.max(0, fade);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.cos(c.flip)); ctx.fillStyle = c.color;
      if (c.shape === "petal") { ctx.beginPath(); ctx.ellipse(0, 0, c.w / 2, c.h / 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.ellipse(-c.w * 0.12, -c.h * 0.12, c.w / 5, c.h / 4, 0, 0, 7); ctx.fill(); }
      else if (c.shape === "dot") { ctx.beginPath(); ctx.arc(0, 0, c.w / 2.4, 0, 7); ctx.fill(); }
      else { ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(-c.w / 2, -c.h / 2, c.w / 3, c.h); }
      ctx.restore(); }
    ctx.globalAlpha = 1;
  };
  const loop = (now) => { const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    step(dt); draw();
    if (P.length || C2.length || Q.length) raf = requestAnimationFrame(loop); else { raf = 0; last = 0; ctx.clearRect(0, 0, W, H); } };
  const run = () => { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } };
  const at = (d, fn) => Q.push({ at: t + d, fn });
  return {
    show(dockH, mobile) {                                   // the bundle is complete
      fit(); const base = H - dockH, pairs = festSparkPairs();
      // desktop: just above the bar. Mobile: the lower half of the screen, a taller area — not a strip at the bottom
      const lo = mobile ? H * 0.42 : base - 150, hi = mobile ? Math.max(lo + 40, Math.min(base - 24, H * 0.84)) : base - 24;
      for (let i = 0; i < (mobile ? 11 : 9); i++) at(i * 0.16, () => mini(W * rnd(0.08, 0.92), rnd(lo, hi), pairs[i % pairs.length]));
      const cy = mobile ? Math.min(base, H * 0.66) : base;      // mobile: the cannons sit in the lower half too, not on the bar
      at(0.05, () => { confetti(6, cy, 55, 1); confetti(W - 6, cy, 55, -1); });
      at(1.0, () => { confetti(6, cy, 30, 1, 0.8); confetti(W - 6, cy, 30, -1, 0.8); });
      run();
    },
    reveal(x, y, lite) {                                    // a free card opened (lite: from the list — one pop and a little confetti)
      if (lite) { fit(); const pr = festSparkPairs(); mini(x, y, pr[(Math.random() * pr.length) | 0]); confetti(x, y, 24, 0, 0.6); run(); return; }
      fit(); const pairs = festSparkPairs();
      [[0, 0, 0], [-38, -16, 0.1], [38, -12, 0.18], [-22, 24, 0.28], [24, 26, 0.36], [0, -34, 0.46]].forEach(([dx, dy, d], i) => at(d, () => mini(x + dx, y + dy, pairs[i % pairs.length])));
      confetti(x, y, 80, 0, 0.8);
      at(0.1, () => confetti(x, y, 45, 0, 0.62));
      at(0.05, () => { confetti(6, y + 50, 26, 1, 0.85); confetti(W - 6, y + 50, 26, -1, 0.85); });
      run();
    },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
}
let OPEN_DETAILS = null;                                   // the product image opens the details drawer (set by the page)
let CELEB = null, CELEB_SHOW = null, TOAST = null;          // TOAST: the page's toast — every confetti moment says why it happened
const celebrateShow = (why) => { if (FEST && CELEB_SHOW) CELEB_SHOW(why); };            // the full show (crackers + cannons) — also used when a BYOB offer unlocks
const celebrateAt = (el, lite, why) => { if (FEST && CELEB) CELEB(el, lite, why); };
function Celebration({ kit, dockH }) {
  const ref = useRef(null), eng = useRef(null), prev = useRef({ complete: kit.complete, count: kit.count });
  const dockRef2 = useRef(dockH); dockRef2.current = dockH;
  useEffect(() => () => { if (eng.current) eng.current.stop(); }, []);
  useEffect(() => {
    CELEB_SHOW = (why) => {
      const cv = ref.current;
      if (!cv || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
      if (!eng.current) eng.current = makeCelebration(cv);
      if (eng.current) { eng.current.show(dockRef2.current, !DESK); if (why && TOAST) TOAST(why); }
    };
    return () => { CELEB_SHOW = null; };
  }, []);
  useEffect(() => {
    CELEB = (el, lite, why) => {
      const cv = ref.current;
      if (!cv || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
      if (!eng.current) eng.current = makeCelebration(cv);
      if (!eng.current) return;
      const par = cv.parentElement, pr = par.getBoundingClientRect(), k = (pr.width / par.offsetWidth) || 1, er = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      eng.current.reveal(er ? (er.left + er.width / 2 - pr.left) / k : par.offsetWidth / 2, er ? (er.top + er.height / 2 - pr.top) / k : par.offsetHeight / 2, lite);
      if (why && TOAST) TOAST(why);
    };
    return () => { CELEB = null; };
  }, []);
  useEffect(() => {
    const p = prev.current; prev.current = { complete: kit.complete, count: kit.count };
    if (!FEST && eng.current) { eng.current.stop(); eng.current = null; }           // switched to Normal: stop at once
    if (!FEST || BYOB || BXGY || !ref.current || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    if (!eng.current) eng.current = makeCelebration(ref.current);
    if (!eng.current) return;
    if (kit.complete && !p.complete) { eng.current.show(dockH, !DESK); if (TOAST) TOAST("Bundle complete"); }          /* only when the last category is filled */
  }, [kit.complete, kit.count, FEST]);
  if (!FEST) return null;
  return <canvas ref={ref} data-celebration="1" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 70, pointerEvents: "none" }} />;
}

/* the line under a price: once the bundle is complete it is the price-lock text — standing still */
function PriceNote({ kit, style, height = 22, align = "right" }) {
  if (kit.complete) return <span data-price-note="lock" style={{ display: "inline-flex", alignItems: "center", height, lineHeight: `${height}px`, ...style }}><PromiseText kit={kit} origin={align === "left" ? "left" : "right"} /></span>;
  return <span style={{ display: "inline-block", whiteSpace: "nowrap", ...style }}>{kit.caption}</span>;
}

/* =====================================================================
   7 · Subscribe sheet — the same mobile bottom sheet as the BYOB page (payment
   options, how often / how many, pincode + CTA, collapsible order summary), with
   the picked products listed above it by category.
   ===================================================================== */
const FREQS = ["Every 2 weeks", "Every 4 weeks", "Every 6 weeks", "Every 8 weeks"];

const DELIVERIES = ["4 deliveries", "8 deliveries", "12 deliveries", "Ongoing"];

const IconArrowRight = ({ size = 15 }) => <Icon size={size} w={2} d={<path d="M5 12h14M13 6l6 6-6 6" />} />;

function CircleBtn({ label, onClick, children, size = DM(32) }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="fb-ghost sb-anim"
      style={{ width: size, height: size, borderRadius: sh.round, border: stroke(0.75, GREY_LIGHT), background: C.bg, color: C.inkOnBg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
      {children}
    </button>
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

function FreqDeliveryRow({ store }) {
  const labelStyle = { fontSize: DESK_MODE ? 12 : 9, fontWeight: 600, color: MUTED, letterSpacing: "0.3px", textTransform: "uppercase", marginBottom: DM(6) };
  return (
    <div style={{ display: "flex", gap: DM(10), width: "100%" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={labelStyle}>How Often?</div>
        <Dropdown full h={DM(40)} fs={12} bg={ACCENT_WASH} value={store.freq} options={FREQS} onChange={store.setFreq} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={labelStyle}>How Many?</div>
        <Dropdown full h={DM(40)} fs={12} bg={ACCENT_WASH} value={store.deliveries} options={DELIVERIES} onChange={store.setDeliveries} />
      </div>
    </div>
  );
}

// delivery address pickers above the pincode: country, and the states of the chosen country
const COUNTRIES = ["India", "United Arab Emirates", "Singapore", "United States", "United Kingdom"];
const STATES = {
  India: ["Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu & Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal"],
  "United Arab Emirates": ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"],
  Singapore: ["Central", "North", "North-East", "East", "West"],
  "United States": ["California", "Florida", "Illinois", "New Jersey", "New York", "Texas", "Washington"],
  "United Kingdom": ["England", "Scotland", "Wales", "Northern Ireland"],
};
function WidgetPincodeAndCTA({ payMode, store }) {
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("Select");
  const [pincode, setPincode] = useState("");
  const [pincodeError, setPincodeError] = useState(false);
  const displayPrice = payMode === "payAsYouGo" ? store.sub : store.price;
  const handleSubscribeClick = () => {
    if (!pincode) { setPincodeError(true); return; }
    setPincodeError(false);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: DM(8), width: "100%" }}>
      {/* a partition across the container, above the address + pincode */}
      <div aria-hidden="true" data-address-divider="1" style={{ borderTop: stroke(1, LINE), margin: `0 -${DM(12)}px ${DM(8)}px` }} />
      {/* country + state, side by side */}
      <div data-address-row="1" style={{ display: "flex", gap: DM(8), width: "100%" }}>
        <div style={{ flex: 1, minWidth: 0 }}><Dropdown full h={DM(36)} fs={12} bg={C.bg} edge={GREY_DARK} label={<span style={{ color: MUTED }}>Country</span>} a11y="Country" value={country} options={COUNTRIES} menuW={DM(190)} onChange={(v) => { setCountry(v); setState("Select"); }} /></div>
        <div style={{ flex: 1, minWidth: 0 }}><Dropdown full h={DM(36)} fs={12} bg={C.bg} edge={GREY_DARK} menuMax={DM(220)} menuW={DM(190)} label={<span style={{ color: MUTED }}>State</span>} a11y="State" value={state} options={STATES[country] || []} onChange={setState} /></div>
      </div>
      <div style={{ width: "100%", height: DM(36), boxSizing: "border-box", background: C.bg, border: stroke(1, pincodeError ? "#e5484d" : GREY_DARK), borderRadius: sh.pill, display: "flex", alignItems: "center", gap: DM(6), padding: `${DM(4)}px ${DM(4)}px ${DM(4)}px ${DM(14)}px` }}>
        <input value={pincode} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 6); setPincode(v); if (v) setPincodeError(false); }}
          inputMode="numeric" placeholder={pincodeError ? "Enter pincode to continue" : "Enter Pincode"}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: FS(12.5), color: C.inkOnBg, flex: 1, minWidth: 0, padding: 0 }} />
        <button onClick={handleSubscribeClick} aria-label="Continue" className="sb-anim" style={{ width: DM(26), height: DM(26), borderRadius: sh.round, background: C.primary, border: "none", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer", color: C.onBar }}>
          <IconArrowRight size={DM(14)} />
        </button>
      </div>
      <button onClick={handleSubscribeClick} className="fb-cta sb-anim"
        style={{ height: DM(46), width: "100%", border: "none", background: C.primary, borderRadius: sh.pill, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `0 ${DM(20)}px` }}>
        <span style={{ fontSize: FS(14), fontWeight: 700, color: C.onBar }}>Subscribe Now</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span key={displayPrice} className="sb-pop" style={{ fontSize: FS(16), fontWeight: 700, color: C.accent, display: "inline-block" }}>{inr(displayPrice)}</span>
          {payMode !== "upfront" && <span style={{ fontSize: FS(10), fontWeight: 500, color: C.subOnBar }}>/Delivery</span>}
        </span>
      </button>
    </div>
  );
}

// which "How often?" plans come with a free gift — each one is a real product (name, variants, MRP). A plan that is not listed has none.
const PLAN_FREEBIES = {
  "Every 6 weeks": { id: "free-mug", name: "Ceramic Brew Mug", festName: "Festive Brew Mug", price: 0, mrp: 399, free: true,
    variants: [{ label: "Colour", options: ["Ruby red", "Antique gold"] }, { label: "Size", options: ["300ml", "400ml"] }] },
  "Every 8 weeks": { id: "free-hamper", name: "Brew Gift Hamper", festName: "Diwali Brew Hamper", price: 0, mrp: 599, free: true,
    variants: [{ label: "Pack", options: ["Sweet box", "Dry fruits"] }, { label: "Size", options: ["Small", "Large"] }] },
};
/* the plan's free gift — the BXGY free card (gift label, name, variants, MRP struck through, FREE pill) at the old freebie card's size */
function FreebieCard({ p, vals }) {
  return (
    <div data-freebie-card="1" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, padding: 8, background: freePal().bg, border: stroke(1.5, freePal().edgeStrong), borderRadius: sh.card }}>
      <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: sh.img, background: C.fill }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: FS(9), fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: freePal().label }}><GiftIcon size={10} color={freePal().icon} /> {FEST ? "Diwali gift" : "Free reward"}</div>
        <div style={{ fontSize: FS(12.5), fontWeight: 600, color: C.inkOnBg, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div style={{ fontSize: FS(11), color: MUTED, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{(vals || p.variants.map((v) => v.options[0])).join(" • ")}</div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right", paddingRight: 4 }}>
        <div style={{ fontSize: FS(10.5), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(p.mrp)}</div>
        <span style={{ display: "inline-flex", marginTop: 3 }}><FreePill /></span>
      </div>
    </div>
  );
}
function SubscriptionWidget({ store }) {
  const [payMode, setPayMode] = useState("upfront");
  const fb = FEST && !FIXED ? PLAN_FREEBIES[store.freq] || null : null;   // the freebie scratcher is a Diwali thing: none in the Normal theme
  const last = useRef(fb); if (fb) last.current = fb;          // keep the last card on screen while it folds away
  const shown = fb || last.current;
  const [seen, setSeen] = useState({});                        // gifts already scratched — they stay open if you come back to that plan
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: DM(16), width: "100%" }}>
      <PayToggle mode={payMode} onChange={setPayMode} />
      <FreqDeliveryRow store={store} />
      {/* the plan has a freebie → a scratch card slides open under the dropdowns; scratch it and the real product card is there */}
      {FEST && !FIXED && <div data-freebie-slot="1" style={{ marginTop: fb ? 0 : -DM(16), transition: `margin .38s ${EASE_COLLAPSE}` }}>
        <Reveal open={!!fb}>
          {shown && (
            <div key={shown.id} data-freebie-row="1" className="plf-fade-in" style={{ padding: "4px 0" }}>
              <div data-freebie-title="1" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: FS(13), fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.25, color: C.inkOnBg }}>
                {FEST && <Spark className="plf-twinkle" size={9} color={DIWALI.goldDeep} />}Freebie available for this plan
              </div>
              <div style={{ height: 8 }} />
              {/* the same free card as BXGY — sealed under foil, tap to open (confetti + toast), same content and colours; the size of the old freebie card */}
              <ScratchReveal tap compact hint="Tap to reveal your free gift" radius={sh.card} revealed={!!seen[shown.id]} onReveal={(el) => { celebrateAt(el, false, "Free gift unlocked"); setSeen((o) => ({ ...o, [shown.id]: true })); }}>
                <FreebieCard p={{ ...shown, name: FEST ? shown.festName : shown.name }} vals={store.varsFor(shown)} />
              </ScratchReveal>
            </div>
          )}
        </Reveal>
      </div>}
      <WidgetPincodeAndCTA payMode={payMode} store={store} />
    </div>
  );
}

/* the price lock, as a thin announcement bar (Diwali red + gold, shimmer) */
function PriceLockStrip({ price }) {
  return (
    <div role="status" data-price-lock="strip" style={{ position: "relative", overflow: "hidden", height: DM(24), display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: festGrad(100), color: DIWALI.goldPale,
      boxShadow: `inset 0 -1px 0 ${DIWALI.gold}`, fontSize: FS(10), fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      <Spark className="plf-twinkle" size={6} color={DIWALI.goldBright} />
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <PlfLock size={DM(10)} color={DIWALI.goldBright} />
        <span>Price locked at <span key={price} className="pulse-text" style={{ display: "inline-block", color: DIWALI.goldBright, fontWeight: 800 }}>{inr(price)}</span> for every order</span>
      </span>
      <Spark className="plf-twinkle" size={6} color={DIWALI.goldBright} style={{ animationDelay: ".9s" }} />
      <span aria-hidden="true" className="plf-shimmer" style={plfShimmerLayer} />
    </div>
  );
}
function SubscribePanel({ store, onClose }) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const pctOff = (n) => <span style={{ color: FREQ_GREEN, fontWeight: 700 }}>{n}% OFF</span>;   // only the % is green
  const row = (k, v) => (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ fontSize: FS(12), color: MUTED }}>{k}</span>
      <span style={{ fontSize: FS(12), fontWeight: 600, color: C.inkOnBg }}>{v}</span>
    </div>
  );
  return (
    <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", background: C.white }}>
      <div style={{ padding: `${DM(18)}px ${DR.padX}px ${DM(14)}px`, display: "flex", alignItems: "center", gap: DM(10), flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...DR.title, color: C.inkOnBg }}>Subscribe & save</div>
          <div style={{ ...DR.sub, color: MUTED, marginTop: DM(3) }}>{plural(store.count, "item")} · <span style={{ color: FREQ_GREEN, fontWeight: 700 }}>{store.freq}</span></div>
        </div>
        <CircleBtn label="Close" onClick={onClose}><IconX size={DM(16)} /></CircleBtn>
      </div>
      <div style={{ borderTop: stroke(1, LINE), flexShrink: 0 }} />

      <div className="sb-scroll" style={{ flex: "0 1 auto", minHeight: 0, overflowY: "auto", padding: `${DM(14)}px ${DM(14)}px ${DM(14)}px` }}>
        {/* the whole widget — price lock, payment, plan, freebie, pincode + CTA — in ONE container. The order summary stays outside it. */}
        <div data-sub-container="1" style={{ boxSizing: "border-box", width: "100%", overflow: "hidden", background: C.white, border: stroke(1, FEST ? DIWALI.goldSoft : GREY_LIGHT), borderRadius: sh.card, boxShadow: "0 8px 22px -16px rgba(0,0,0,.28)" }}>
          {/* Diwali: the price lock as a thin announcement bar across the top of the container */}
          {FEST && <PriceLockStrip price={store.price} />}
          <div style={{ padding: `${DM(16)}px ${DM(12)}px` }}><SubscriptionWidget store={store} /></div>
        </div>

        {/* pricing summary — collapsed by default; the per-delivery price sits at the far right of the heading with a chevron that opens the rows */}
        <div style={{ marginTop: DM(14), paddingTop: DM(12), padding: `${DM(12)}px ${DR.padX - DM(14)}px 0` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ ...DR.title, color: C.inkOnBg }}>Order summary</span>
            <div style={{ display: "flex", alignItems: "center", gap: DM(6) }}>
              <span style={{ fontSize: FS(11), fontWeight: 700, color: C.inkOnBg, ...(FEST ? { background: DIWALI.ivory, border: stroke(1, DIWALI.goldEdge) } : { background: ACCENT_WASH, border: stroke(1, ACCENT_BORDER) }), borderRadius: sh.pill, padding: `${DM(4)}px ${DM(10)}px`, whiteSpace: "nowrap" }}>
                Per delivery <span key={store.sub} className="sb-pop" style={{ color: C.inkOnBg, display: "inline-block" }}>{inr(store.sub)}</span>
              </span>
              <button onClick={() => setSummaryOpen((o) => !o)} aria-label={summaryOpen ? "Collapse pricing summary" : "Expand pricing summary"} aria-expanded={summaryOpen} className="sb-anim"
                style={{ width: DM(24), height: DM(24), borderRadius: sh.round, border: stroke(0.75, GREY_LIGHT), background: C.white, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: C.inkOnBg }}>
                <span className="fb-motion" style={{ display: "flex", transform: summaryOpen ? "rotate(180deg)" : "none", transition: `transform .24s ${EASE_MICRO}` }}><IconDown size={DM(13)} /></span>
              </button>
            </div>
          </div>
          <Reveal open={summaryOpen}>
            <div style={{ display: "flex", flexDirection: "column", gap: DM(8), paddingTop: DM(14) }}>
              {row("Items (MRP)", inr(store.mrp))}
              {row("Bundle savings", <>−{inr(store.savings)} · {pctOff(store.pct)}</>)}
              {FREE_LAST && store.freeVal > 0 && row(freeTitle(), <>−{inr(store.freeVal)} · Free</>)}
              {MULTI && store.catDisc.map((dv, c) => dv > 0 && <Fragment key={c}>{row(BYOB || TIERED ? "Bundle offer" : `${CATS[c].title} discount`, <>−{inr(dv)} · {pctOff(store.catOff[c])}</>)}</Fragment>)}
              {row("Subscribe discount", <>−{inr(store.subDisc)} · {pctOff(COPY.subscribeOff)}</>)}
              {row("Delivery", store.freq)}
              <div style={{ borderTop: stroke(1, LINE), marginTop: DM(4), paddingTop: DM(10), display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ ...DR.title, color: C.inkOnBg }}>Total</span>
                <span style={{ fontSize: FS(16), fontWeight: 700, letterSpacing: "-0.01em", color: C.inkOnBg }}>{inr(store.price)}</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

    </div>
  );
}

function Sheet({ open, onClose, height, maxHeight, label, children, handle = true }) {
  const [mounted, setMounted] = useState(open);
  const [vis, setVis] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef(null);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVis(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setVis(false); setDrag(0);
    const t = setTimeout(() => setMounted(false), 450);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return (
    <>
      <div onClick={onClose} className="sb-backdrop fb-motion"
        style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,.36)", opacity: vis ? Math.max(0, 1 - drag / 400) : 0, transition: drag ? "none" : "opacity .3s ease" }} />
      <div role="dialog" aria-label={label} className="fb-motion"
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height, maxHeight, zIndex: 61, background: C.bg, borderRadius: `${sh.card}px ${sh.card}px 0 0`, overflow: "hidden", display: "flex", flexDirection: "column",
          transform: vis ? `translateY(${drag}px)` : "translateY(100%)", transition: drag ? "none" : `transform .45s ${EASE_COLLAPSE}` }}>
        {handle && (
        <div
          onPointerDown={(e) => { startY.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (startY.current != null) setDrag(Math.max(0, e.clientY - startY.current)); }}
          onPointerUp={() => { const d = drag; startY.current = null; if (d > 110) onClose(); else setDrag(0); }}
          onPointerCancel={() => { startY.current = null; setDrag(0); }}
          style={{ height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab", touchAction: "none", flexShrink: 0 }}>
          <span style={{ width: 36, height: 4, borderRadius: sh.pill, background: GREY_DARK }} />
        </div>
        )}
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>{children}</div>
      </div>
    </>
  );
}

/* desktop right-hand drawer for Subscribe & save */


const IconChevronLeft = ({ size = 18 }) => <Icon size={size} w={1.9} d={<path d="M15 6l-6 6 6 6" />} />;
const IconChevronRight = ({ size = 18 }) => <Icon size={size} w={1.9} d={<path d="M9 6l6 6-6 6" />} />;

/* =====================================================================
   Top banner "off" — the heading and body text stand on their own instead
   ===================================================================== */
function IntroText({ d, side = DESK_SIDE }) {
  return (
    <div data-intro="1" style={{ textAlign: "center", padding: d ? `22px ${side}px 6px` : `20px ${SIDE}px 8px` }}>
      <Headline ink={C.inkOnBg} soft={MUTED} d={d} center goldLight />
    </div>
  );
}

/* =====================================================================
   List card — image on the left, everything else on the right
   ===================================================================== */
/* =====================================================================
   Stepper — a container with arrows at both ends; two lines say where you are
   ("Category 3 of 4" / "Choose 1"). Same sticky block and container lip as the pills.
   ===================================================================== */
function CategoryStepper({ cat, sel, onGo, top, wrapRef, d, kit }) {
  const N = CATS.length, c = CATS[cat], done = sel[cat] !== null;
  const arrow = (dir) => {
    const off = cat + dir < 0 || cat + dir > LAST, next = dir > 0;
    return (
      <button aria-label={next ? "Next category" : "Previous category"} disabled={off} onClick={() => onGo(cat + dir)} className="fb-ghost sb-anim"
        style={{ width: 40, height: 40, flexShrink: 0, padding: 0, borderRadius: sh.round, cursor: off ? "default" : "pointer", opacity: off ? 0.28 : 1, display: "flex", alignItems: "center", justifyContent: "center",
          border: next ? "none" : stroke(1, PILL.greyMid), background: next ? PILL.black : PILL.white, color: next ? PILL.white : PILL.black }}>
        {next ? <IconChevronRight size={18} /> : <IconChevronLeft size={18} />}
      </button>
    );
  };
  return (
    <div ref={wrapRef} className="fb-motion" style={{ position: "sticky", top, zIndex: 30, backgroundColor: pageBgColor(), padding: `8px ${d ? DESK_SIDE : CONT_SIDE}px 0`, transition: `top .32s ${EASE_COLLAPSE}` }}>
      <div role="group" aria-label="Category" data-stepper="1" style={{ display: "flex", alignItems: "center", gap: 10, height: d ? 68 : 76, ...(d ? { maxWidth: 640, margin: "0 auto" } : {}), padding: "0 12px", background: PILL.white, border: FEST ? `1px solid ${DIWALI.dark}` : stroke(1.5, C.accent), borderRadius: sh.card }}>
        {arrow(-1)}
        {/* desktop: the text sits on the left, the progress dashes at the right of it */}
        {d && (
          <div key={cat} className="sb-in" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, padding: "0 6px" }}>
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 5, textAlign: "left" }}>
            <div style={{ fontSize: FS(11), fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase", lineHeight: "14px", color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
              {done && <span data-stepper-tick="1" style={{ width: 12, height: 12, flexShrink: 0, borderRadius: sh.round, background: C.accent, color: C.onAccent, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", top: -0.5 }}><IconCheck size={8} w={3.4} /></span>}
              {isFreeCat(cat) && !done && <span data-stepper-lock="1" style={{ display: "inline-flex", color: PILL.ink }}>{FREE_LOCKED ? <IconLock size={11} w={2.4} /> : <IconUnlock size={11} w={2.4} />}</span>}
              {isFreeCat(cat) ? `Free category · ${cat + 1} of ${N}` : `Category ${cat + 1} of ${N}`}
            </div>
            <div style={{ maxWidth: "100%", fontSize: FS(14), fontWeight: 700, letterSpacing: "-0.01em", lineHeight: "18px", color: PILL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isFreeCat(cat) ? (FREE_LOCKED ? `Unlock 1 free from ${c.title}` : `Pick 1 free from ${c.title}`) : MULTI ? `Pick any from ${c.title}` : `Pick 1 from ${c.title}`}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, flexShrink: 0 }}>
              <span data-next-info="1" style={{ fontSize: FS(10.5), fontWeight: 500, lineHeight: "14px", color: MUTED, whiteSpace: "nowrap" }}>{nextInfo(cat)}</span>
              <div aria-hidden="true" data-dashes="1" style={{ display: "flex", gap: 5 }}>
                {CATS.map((x, i) => <span key={x.key} style={{ width: 22, height: 3, borderRadius: 2, background: i === cat ? PILL.black : sel[i] !== null ? C.accent : PILL.greyLine }} />)}
              </div>
            </div>
          </div>
        )}
        {!d && (
        <div key={cat} className="sb-in" style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-evenly", textAlign: "center" }}>
          <div style={{ fontSize: FS(11), fontWeight: 600, letterSpacing: "0.3px", textTransform: "uppercase", lineHeight: "14px", color: MUTED, display: "flex", alignItems: "center", gap: 6 }}>
            {done && <span data-stepper-tick="1" style={{ width: 12, height: 12, flexShrink: 0, borderRadius: sh.round, background: C.accent, color: C.onAccent, display: "inline-flex", alignItems: "center", justifyContent: "center", position: "relative", top: -0.5 }}><IconCheck size={8} w={3.4} /></span>}
            {isFreeCat(cat) && !done && <span data-stepper-lock="1" style={{ display: "inline-flex", color: PILL.ink }}>{FREE_LOCKED ? <IconLock size={11} w={2.4} /> : <IconUnlock size={11} w={2.4} />}</span>}
            {isFreeCat(cat) ? `Free category · ${cat + 1} of ${N}` : `Category ${cat + 1} of ${N}`}
          </div>
          <div style={{ maxWidth: "100%", fontSize: FS(14), fontWeight: 700, letterSpacing: "-0.01em", lineHeight: "18px", color: PILL.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{isFreeCat(cat) ? (FREE_LOCKED ? `Unlock 1 free from ${c.title}` : `Pick 1 free from ${c.title}`) : MULTI ? `Pick any from ${c.title}` : `Pick 1 from ${c.title}`}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
            <div aria-hidden="true" data-dashes="1" style={{ display: "flex", gap: 3, flexShrink: 0 }}>
              {CATS.map((x, i) => <span key={x.key} style={{ width: 14, height: 3, borderRadius: 2, background: i === cat ? PILL.black : sel[i] !== null ? C.accent : PILL.greyLine }} />)}
            </div>
            <span data-next-info="1" style={{ minWidth: 0, fontSize: FS(10.5), fontWeight: 500, lineHeight: "14px", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nextInfo(cat)}</span>
          </div>
        </div>
        )}
        {arrow(1)}
      </div>
      {LAYOUT_V2 && !d && kit && <CatNavBar kit={kit} cat={cat} d={d} buttons={false} />}
      <div aria-hidden="true" style={{ height: CAP_H, background: C.white, borderTop: stroke(1, LINE), borderRadius: "18px 18px 0 0", ...(d ? { marginTop: 10, borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE) } : { margin: `10px -${CONT_SIDE}px 0` }) }} />
      {TIERED && kit && <TierBar kit={kit} d={d} />}
    </div>
  );
}/* =====================================================================
   Bottom bar option 2 — floating pill. A small pill with the price and a black arrow
   button. The arrow opens a compact popup (not full screen): your products with their
   own scroll, and the two CTAs once every category is picked.
   ===================================================================== */
const IconPlusB = ({ size = 14 }) => <Icon size={size} w={2.2} d={<path d="M12 6v12M6 12h12" />} />;
const IconMinusB = ({ size = 14 }) => <Icon size={size} w={2.2} d={<path d="M6 12h12" />} />;
const IconArrowRightB = ({ size = 16 }) => <Icon size={size} w={2} d={<path d="M5 12h14M13 6l6 6-6 6" />} />;
const IconChevronUp = ({ size = 15 }) => <Icon size={size} w={2} d={<path d="M6 15l6-6 6 6" />} />;
function BundleFloat({ kit, onNext, onPrev, onProceed, onJump, dockRef, d }) {
  const [open, setOpen] = useState(false);          // the compact list popup (opened with the chevron on top of the pill)
  const [cheer, setCheer] = useState(null);         // a short "Whole Beans added" message each time something is added
  const show = kit.count > 0;
  useEffect(() => { if (!show) setOpen(false); }, [show]);
  // each time a product lands in a category, the pill says so for a moment, bumps, and that category's bar fills
  const counts = kit.picksBy.map((a) => a.length).join(",");
  const prev = useRef(counts), seq = useRef(0), timer = useRef(null);
  useEffect(() => {
    const was = prev.current.split(",").map(Number), now = counts.split(",").map(Number);
    prev.current = counts;
    if (was.length !== now.length) return;
    const i = now.findIndex((n, k) => n > was[k]);
    if (i < 0) return;
    const c = CATS[i];
    setCheer({ text: was[i] === 0 ? `${c.title} added` : `+1 ${c.title}`, n: ++seq.current });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCheer(null), 2200);
  }, [counts]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // what happens next, in one short line
  const missing = CATS.filter((c, i) => kit.picksBy[i].length === 0);
  const nudge = kit.complete ? "All set, click to proceed" : FREE_LAST && missing.length === 1 && missing[0] === CATS[LAST] ? `Claim your ${freeTitle()} to proceed` : FREE_LAST && kit.freeLocked && missing.length === 2 ? `Add ${missing[0].title} to unlock your free pick` : missing.length === 1 ? `Add ${missing[0].title} to proceed` : `Add ${missing.length} more to proceed`;
  const giftsWaiting = BXGY ? kit.rewards.filter((r) => !kit.rewardSeen(r.id)).length : 0;   // BXGY: free gifts not opened yet
  const PILL = 68;                                   // a little taller, so the worded Next / Proceed buttons sit comfortably
  const circle = { width: 34, height: 34, flexShrink: 0, padding: 0, borderRadius: sh.round, border: "none", background: C.primary, color: C.onBar, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <>
      {open && <div onClick={() => setOpen(false)} aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 48 }} />}
      {/* the popup: your products, with their own scroll */}
      <div role="dialog" aria-label="Your Bundle" aria-hidden={!open} data-float-popup="1" className="fb-motion"
        style={{ position: "absolute", ...(d ? { left: "50%", width: 380 } : { left: 14, right: 14 }), bottom: 14 + PILL + 10, zIndex: 50, display: "flex", flexDirection: "column", maxHeight: 400, background: C.white, border: stroke(1, LINE), borderRadius: sh.card, boxShadow: "0 14px 36px rgba(0,0,0,.18)", overflow: "hidden",
          opacity: open ? 1 : 0, transform: (d ? "translateX(-50%) " : "") + (open ? "translateY(0) scale(1)" : "translateY(14px) scale(.97)"), transformOrigin: "bottom center", visibility: open ? "visible" : "hidden", pointerEvents: open ? "auto" : "none",
          transition: `transform .35s ${EASE_COLLAPSE}, opacity .22s ease, visibility 0s linear ${open ? "0s" : ".35s"}` }}>
        <div style={{ padding: `${DM(14)}px ${DR.padX}px ${DM(12)}px`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...DR.title, color: C.inkOnBg }}>Your Bundle</div>
            <div style={{ ...DR.sub, color: MUTED, marginTop: 3 }}>{kit.caption}</div>
          </div>
          <CircleBtn label="Close" onClick={() => setOpen(false)} size={30}><IconX size={14} /></CircleBtn>
        </div>
        <div style={{ borderTop: stroke(1, LINE), flexShrink: 0 }} />
        <div className="sb-scroll" data-float-scroll="1" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: `16px ${DR.padX}px` }}>
          <BundleList headless kit={kit} onRemove={(c, idx) => kit.remove(c, idx)} />
        </div>
      </div>
      {/* the pill. Left: a cheer (or what to do next) over the price. Right: Next → category, then Proceed once everything is picked.
          A small up-chevron on top opens the product list. A bar along the bottom fills, one piece per category. */}
      <div ref={dockRef} aria-hidden={!show} data-pill="1" data-ready={kit.complete ? "1" : "0"} className={"fb-motion" + (!kit.complete && !open && !cheer ? " sb-nudge" : "") + (cheer ? (cheer.n % 2 ? " sb-bump-a" : " sb-bump-b") : "")}
        style={{ position: "absolute", left: "50%", width: 370, bottom: 14, zIndex: 50, height: PILL, display: "flex", alignItems: "center", gap: 10, padding: "0 9px 0 20px", boxSizing: "border-box", background: C.white, border: FEST ? `1px solid ${DIWALI.dark}` : stroke(1.5, C.accent), borderRadius: sh.pill, boxShadow: "0 10px 28px rgba(0,0,0,.14)",
          opacity: show ? 1 : 0, transform: "translateX(-50%) " + (show ? "translateY(0)" : "translateY(140%)"), pointerEvents: show ? "auto" : "none", transition: `transform .42s ${EASE_COLLAPSE}, opacity .25s ease` }}>
        {/* two lines, centred as a block: the price with the progress dashes right beside it (centre-aligned), and the message / cheer underneath */}
        <span style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center", height: "100%", minWidth: 0, marginRight: 8 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span key={kit.total} className="sb-pop" data-pill-price="1" style={{ fontSize: FS(17), fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: C.inkOnBg }}>{inr(kit.total)}</span>
            {BXGY && kit.save > 0 && <span data-pill-saved="1" style={{ fontSize: FS(11), fontWeight: 600, color: MUTED, whiteSpace: "nowrap" }}>Saved {inr(kit.save)}</span>}
            {/* Mix & Match: the small overlapping product slots (instead of progress dashes) — BXGY has none, the bundle is already complete */}
            {!BXGY && <span data-pill-slots="1" style={{ display: "flex", flexShrink: 0 }}><Slots kit={kit} onJump={(i) => { setOpen(false); onJump && onJump(i); }} size={20} overlap={5} /></span>}
            {/* drop-up chevron, right after the products: opens the list */}
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Hide your products" : "Show your products"} data-pill-chevron="1" className="fb-ghost sb-anim"
              style={{ width: 16, height: 22, marginLeft: -4, flexShrink: 0, padding: 0, border: "none", background: "transparent", color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="fb-motion" style={{ display: "flex", transform: open ? "rotate(180deg)" : "none", transition: `transform .3s ${EASE_MICRO}` }}><IconChevronUp size={12} /></span>
            </button>
          </span>
          {BXGY && !FIXED ? (
            /* BXGY: the free gifts that come with the bundle — waiting until they are opened, then added */
            <span data-pill-caption="gifts" key={giftsWaiting} className="sb-pop" style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", fontSize: FS(11.5), fontWeight: 700, whiteSpace: "nowrap", color: freePal().label }}>
              <span className={giftsWaiting ? "pulse-badge" : undefined} style={{ display: "inline-flex" }}><GiftIcon size={14} color={freePal().icon} /></span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{giftsWaiting ? `${giftsWaiting} free ${giftsWaiting === 1 ? "gift" : "gifts"} waiting` : `${kit.rewards.length} free ${kit.rewards.length === 1 ? "gift" : "gifts"} added`}</span>
            </span>
          ) : kit.complete && !cheer ? (
            /* all picked: the price-lock text, standing still */
            <span data-pill-caption="ready" style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%", height: 17, fontSize: FS(12), fontWeight: 600, color: C.inkOnBg }}><PromiseText kit={kit} origin="left" /></span>
          ) : (
            <span key={cheer ? "c" + cheer.n : nudge} data-pill-caption={cheer ? "cheer" : "nudge"} className="sb-pop" style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", fontSize: FS(11), fontWeight: 600, whiteSpace: "nowrap", color: C.inkOnBg }}>
            {cheer
              ? <span aria-hidden="true" style={{ width: 13, height: 13, borderRadius: sh.round, background: C.accent, color: C.onAccent, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><IconCheck size={8} w={3.4} /></span>
              : <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: sh.round, background: C.accent, flexShrink: 0 }} />}
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{cheer ? cheer.text : nudge}</span>
            </span>
          )}
        </span>
        {/* Prev + Next (Proceed once everything is picked) — small, side by side */}
        <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {!BXGY && !LAYOUT_V2 && (
            <button onClick={() => { if (onPrev) { setOpen(false); onPrev(); } }} disabled={!onPrev} aria-label="Previous category" data-pill-prev="1" className="fb-ghost sb-anim"
              style={{ ...circle, background: C.white, color: C.inkOnBg, border: stroke(1.5, GREY_DARK), opacity: onPrev ? 1 : 0.4, cursor: onPrev ? "pointer" : "default" }}>
              <IconChevronLeft size={16} />
            </button>
          )}
          {kit.complete && !LAYOUT_V2 && onNext && (
            <button onClick={() => { setOpen(false); onNext(); }} aria-label="Next category" data-pill-next="1" className="fb-cta sb-anim" style={{ ...circle }}>
              <IconArrowRightB size={16} />
            </button>
          )}
          {kit.complete ? (
            <button onClick={() => { setOpen(false); onProceed(); }} data-pill-proceed="1" aria-label="Proceed" className="fb-cta sb-anim"
              style={{ ...circle, width: "auto", padding: "0 9px 0 12px", borderRadius: sh.pill, gap: 4, fontSize: FS(11.5), fontWeight: 600, whiteSpace: "nowrap" }}>
              Proceed <span className="fb-motion sb-wiggle" style={{ display: "flex" }}><IconArrowRightB size={13} /></span>
            </button>
          ) : LAYOUT_V2 ? null : (
            <button onClick={() => { if (onNext) { setOpen(false); onNext(); } else setOpen((o) => !o); }} aria-label={onNext ? "Next category" : "Show your products"} data-pill-next="1" className="fb-cta sb-anim"
              style={{ ...circle }}>
              <span style={{ display: "flex" }}><IconArrowRightB size={16} /></span>
            </button>
          )}
        </span>
      </div>
    </>
  );
}



/* =====================================================================
   Desktop — the same design on a 1.35× scale
   The 1440 × 821 frame is laid out as a 1067 × 608 canvas and scaled up by DESK_K, so type,
   spacing, controls, icons, radii and borders all grow by one factor — nothing is "just a
   bigger font". Only the LAYOUT changes for the wide screen: a thin banner with the pills
   beside the text, a 5-up grid, a centred category switcher, side drawers.
   ===================================================================== */
const IconUserB = ({ size = 18 }) => <Icon size={size} w={1.7} d={<><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3.2-5.6 7-5.6s7 2 7 5.6" /></>} />;

function DesktopNav({ count, onCart }) {
  const circle = { position: "relative", width: 34, height: 34, flexShrink: 0, padding: 0, borderRadius: sh.round, border: stroke(1, LINE), background: C.bg, color: C.inkOnBg, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
  return (
    <nav style={{ height: 56, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "0 28px", background: C.bg, borderBottom: stroke(0.5, "rgba(0,0,0,.08)") }}>
      <div style={{ justifySelf: "start" }}>
        <button className="fb-ghost sb-anim" style={{ height: 34, padding: "0 16px", borderRadius: sh.pill, border: stroke(1.5, GREY_DARK), background: C.bg, color: C.inkOnBg, fontSize: FS(11), fontWeight: 600, cursor: "pointer" }}>Go to Shop</button>
      </div>
      <BrandLogo />
      <div style={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 14 }}>
        <button aria-label="Login" style={{ height: 34, padding: 0, border: "none", background: "transparent", color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: FS(11), fontWeight: 500 }}><IconUserB size={17} />Login</button>
        <button aria-label={`Cart, ${count} selected`} onClick={onCart} className="fb-ghost sb-anim" style={circle}>
          <IconBagB />
          {count > 0 && <span key={count} className="sb-pop" style={{ position: "absolute", top: -5, right: -5, minWidth: 12, height: 12, padding: "0 2px", borderRadius: sh.pill, background: C.accent, color: C.onAccent, border: stroke(1.5, C.bg), boxSizing: "content-box", fontSize: 8, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>}
        </button>
      </div>
    </nav>
  );
}

/* sticky bottom bar on desktop: one row — slots + the arrow that opens "Your Bundle", the price, then the CTAs */
// the desktop bottom bar: not edge to edge — a little wider than the product grid, centred
const DESK_DOCK_PAD = 24, DESK_DOCK_W = DL_W - 2 * DESK_SIDE + 2 * DESK_DOCK_PAD;
function DesktopDock({ kit, cat = 0, onJump, onOne, onSub, onNext, onPrev, dockRef, open, onToggleList }) {
  const show = kit.count > 0;
  return (
    <div ref={dockRef} aria-hidden={!show} className="fb-motion"
      style={{ position: "absolute", left: "50%", width: DESK_DOCK_W, marginLeft: -DESK_DOCK_W / 2, bottom: 0, zIndex: 50, boxSizing: "border-box", background: C.white, overflow: "hidden",
        border: FEST ? `1px solid ${DIWALI.dark}` : stroke(1, LINE), borderBottom: "none", borderRadius: `${sh.card}px ${sh.card}px 0 0`, boxShadow: "0 -8px 24px rgba(0,0,0,.08)",
        opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(105%)", pointerEvents: show ? "auto" : "none", transition: `transform .42s ${EASE_COLLAPSE}, opacity .25s ease` }}>
      {FEST && kit.complete && <div className="sb-in"><SubLockStrip d /></div>}
      <div style={{ margin: "0 auto", padding: `7px ${DESK_DOCK_PAD}px`, display: "flex", alignItems: "center", gap: 14 }}>
        <Slots kit={kit} onJump={onJump} size={!BYOB && !BXGY ? 30 : 36} overlap={!BYOB && !BXGY ? 7 : 8} />
        <button onClick={onToggleList} aria-expanded={open} aria-label={open ? "Hide added products" : "Show added products"} className="fb-ghost sb-anim"
          style={{ width: 20, height: 30, marginLeft: -8, padding: 0, border: "none", background: "transparent", color: C.inkOnBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconChevronRight size={17} />
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ textAlign: "right" }}>
          <div key={kit.total} className="sb-pop" style={{ fontSize: FS(18), fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.05, color: C.inkOnBg }}>{inr(kit.total)}</div>
          <div style={{ marginTop: 2, display: "flex", justifyContent: "flex-end" }}><PriceNote kit={kit} style={{ fontSize: FS(13), color: MUTED, fontWeight: 600 }} /></div>
        </div>
        {/* after the price: a | then ONE "Next →" until every category has a pick; then One Time | Subscribe */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span aria-hidden="true" data-dock-sep="1" style={{ flex: "0 0 1px", height: 32, marginRight: 4, background: GREY_DARK }} />
          {/* Mix & Match: Prev · Next after the vertical line; once the bundle is complete (Buy Now · Subscribe & Save) only Prev stays */}
          {!BYOB && !BXGY && !LAYOUT_V2 && <PrevNext kit={kit} onPrev={onPrev} onNext={onNext} h={30} fs={10.5} />}
          {kit.complete ? (
            <>
              <BuyNowBtn onClick={onOne} flex="0 0 118px" h={38} fs={FS(11.5)} />
              <SubSaveBtn onClick={onSub} flex="0 0 196px" h={38} fs={FS(11.5)} subFs={FS(9.5)} />
            </>
          ) : (
            BYOB ? (
              <button disabled data-dock-need="1" className="sb-anim" style={{ flex: "0 0 150px", height: 40, borderRadius: sh.pill, border: stroke(1.5, GREY_DARK), background: C.white, color: C.inkOnBg, fontSize: FS(11), fontWeight: 600, opacity: 0.55, whiteSpace: "nowrap" }}>Add {BYOB_MIN - kit.count} more</button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

/* side drawers (desktop) — "Your Bundle" and "Subscribe & save" share the same shell */
function FrameDrawer({ open, onClose, label, children }) {
  const [mounted, setMounted] = useState(open);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setVis(true)); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setVis(false);
    const t = setTimeout(() => setMounted(false), 450);
    return () => clearTimeout(t);
  }, [open]);
  if (!mounted) return null;
  return (
    <>
      <div onClick={onClose} className="sb-backdrop fb-motion" style={{ position: "absolute", inset: 0, zIndex: 60, background: "rgba(0,0,0,.36)", opacity: vis ? 1 : 0, transition: "opacity .3s ease" }} />
      <aside role="dialog" aria-label={label} className="fb-motion"
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 340, zIndex: 61, background: C.white, borderLeft: stroke(1, LINE), borderRadius: `${sh.card}px 0 0 ${sh.card}px`, overflow: "hidden", display: "flex", flexDirection: "column",
          transform: vis ? "translateX(0)" : "translateX(100%)", transition: `transform .45s ${EASE_COLLAPSE}` }}>
        {children}
      </aside>
    </>
  );
}
function BundleDrawer({ kit, onClose }) {
  return (
    <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", background: C.white }}>
      <div style={{ padding: `18px ${DR.padX}px 14px`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...DR.title, color: C.inkOnBg }}>Your Bundle</div>
          <div style={{ ...DR.sub, color: MUTED, marginTop: 3 }}>{plural(kit.count, "item")}{BXGY && kit.rewards.length ? ` + ${kit.rewards.length} free` : ""} · {kit.complete ? "Bundle complete" : kit.progress}</div>
        </div>
        <CircleBtn label="Close" onClick={onClose}><IconX /></CircleBtn>
      </div>
      <div style={{ borderTop: stroke(1, LINE), flexShrink: 0 }} />
      <div className="sb-scroll" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: `22px ${DR.padX}px 20px` }}>
        <BundleList headless kit={kit} onRemove={(c, idx) => kit.remove(c, idx)} />
      </div>
    </div>
  );
}

/* =====================================================================
   BYOB — the offer bar. It sticks to the top in the place of the category pills.
   The more you add, the more offers you get: a track with a node for each offer, filling as you add products.
   ===================================================================== */
function OfferBar({ kit, wrapRef, top = 0, d, fit = false }) {
  const T = BYOB_TIERS, n = kit.count, by = kit.byob;
  const scroll = !d && T.length > 4;                              // more than four offers on mobile: they run past the container and swipe sideways
  const [cheer, setCheer] = useState(null);                       // "10% OFF unlocked" for a moment when a new offer is reached
  const prev = useRef(by.reached), timer = useRef(null);
  useEffect(() => {
    if (by.reached > prev.current) { setCheer(by.reached); clearTimeout(timer.current); timer.current = setTimeout(() => setCheer(null), 2400); celebrateShow(`${T[by.reached].off}% OFF unlocked`); }   /* an offer unlocked: the same crackers + confetti as completing the Mix & Match categories, and a toast that says why */
    prev.current = by.reached;
  }, [by.reached]);
  useEffect(() => () => clearTimeout(timer.current), []);
  // one plain bar per offer: each fills from the previous offer's count to its own
  const segs = T.map((t, i) => {
    const prevN = i === 0 ? 0 : T[i - 1].n, span = t.n - prevN, into = Math.max(0, Math.min(span, n - prevN));
    return { ...t, pct: span ? (into / span) * 100 : 100, reached: n >= t.n };
  });
  const sel = by.next ? T.indexOf(by.next) : T.length - 1;       // the selected offer: the one you are working towards (the last one, once all are unlocked)
  const target = T[sel];
  // swipeable mode: bring the selected offer to the middle (instantly the first time, smoothly after that)
  const scRef = useRef(null), cols = useRef([]), placed = useRef(false);
  useEffect(() => {
    const sc = scRef.current, col = cols.current[sel];
    if (!scroll || !sc || !col) return;
    const left = col.offsetLeft - (sc.clientWidth - col.offsetWidth) / 2;
    if (sc.scrollTo) sc.scrollTo({ left: Math.max(0, left), behavior: placed.current ? "smooth" : "auto" });
    placed.current = true;
  }, [sel, scroll, T.length]);
  const hi = { color: FEST ? DIWALI.goldBright : C.accent, fontWeight: 700 };                // the highlighted phrase, as in the announcement bar
  const F = BYOB_FLAT_DEAL, flatLeft = Math.max(0, F.n - n);
  const maxOff = BYOB_FLAT ? F.off : T[T.length - 1].off, empty = n === 0;                  // empty: the bar is already there, as a compact hook line only
  const line = empty
    ? (BYOB_FLAT ? <>Get <span style={hi}>{F.off}% OFF</span> on any {F.n} products</> : <>Build your bundle and save <span style={hi}>up to {maxOff}% OFF</span></>)
    : BYOB_FLAT
    ? (flatLeft > 0
        ? <>{n > 0 ? `${n} of ${F.n} added  •  ` : ""}<span style={hi}>Add {n > 0 ? `${flatLeft} more` : F.n} {flatLeft === 1 ? "product" : "products"}</span> to get {F.off}% OFF</>
        : <><span style={hi}>{F.off}% OFF unlocked</span>  •  bundle full ({F.n} of {F.n})</>)
    : cheer !== null ? <><span style={hi}>{T[cheer].off}% OFF</span> unlocked</>
    : by.next ? <>{n} {n === 1 ? "item" : "items"} added  •  <span style={hi}>Add {by.left} more {by.left === 1 ? "product" : "products"}</span> to unlock</>
    : <span style={hi}>{FEST ? "All Diwali offers unlocked" : "All offers unlocked"}</span>;
  const textKey = empty ? "e" : BYOB_FLAT ? "f" + n : cheer !== null ? "c" + cheer : by.next ? "n" + n : "done";
  const fsP = d ? FS(11) : 10, fsN = d ? FS(10) : 9.5;            // mobile: a size down
  return (
    <div ref={wrapRef} data-offer-bar="1" className="fb-motion" style={{ position: "sticky", top, zIndex: 30, backgroundColor: pageBgColor(), padding: `8px ${fit ? 4 : d ? DESK_SIDE : CONT_SIDE}px 0`, ...(fit ? { margin: "0 -4px" } : {}), transition: `top .32s ${EASE_COLLAPSE}` }}>
      <div data-offer-box="1" style={{ position: "relative", boxSizing: "border-box", background: C.white, border: stroke(1, LINE), borderRadius: sh.card, overflow: "hidden", ...(d && !fit ? { maxWidth: 640, margin: "0 auto" } : {}) }}>
        {/* the band: where you are, and the offer that comes next */}
        <div data-offer-band="1" style={{ background: C.primary, color: C.onBar, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: d ? 34 : 36, padding: d ? "0 16px" : "0 14px", ...(empty ? { justifyContent: "center" } : {}) }}>
          <span key={textKey} data-offer-head="1" className="sb-pop" style={{ minWidth: 0, fontSize: FS(11), fontWeight: 500, lineHeight: 1.3, whiteSpace: "pre", color: "rgba(255,255,255,.78)" }}>{line}</span>
          {!empty && <span className={by.next ? (FEST ? "pulse-text" : "pulse-badge") : undefined} data-offer-flat={BYOB_FLAT ? (by.next ? "pending" : "done") : undefined} style={{ flexShrink: 0, display: "inline-flex" }}>
            <span key={target.off} data-offer-now="1" className="sb-pop" style={{ height: 20, padding: "0 9px", borderRadius: sh.pill, display: "inline-flex", alignItems: "center", fontSize: FS(10.5), fontWeight: 700, whiteSpace: "nowrap", ...(FEST ? festPill() : { background: C.accent, color: C.onAccent }) }}><span style={{ position: "relative" }}>{target.off}% OFF</span>{FEST && <FestShimmer />}</span>
          </span>}
        </div>
        {/* the offers — every one keeps its data, reached or not: the % over its bar, the product count under it.
            A reached offer wears a small dark tick; the next is in ink; the ones after it are quieter */}
        {/* "% OFF" offer: just the line above — no offer steps */}
        {/* empty: the white container says what to do (the black band above talks about the offer) */}
        <Reveal open={empty}>
          <div data-offer-todo="1" style={{ padding: d ? "12px 16px" : "12px 14px", display: "flex", alignItems: "center", justifyContent: d ? "center" : "space-between", gap: 8 }}>
            <span style={{ minWidth: 0, fontSize: d ? FS(12) : 12, fontWeight: 700, letterSpacing: "-0.01em", lineHeight: 1.3, color: PILL.ink, ...(d ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } : { textAlign: "left" }) }}>{BYOB_FLAT ? <>Add any {F.n} products{d ? " " : <br />}to your bundle</> : <>Add any {T[0].n} products{d ? " " : <br />}to unlock <span data-offer-todo-off="1" style={{ color: DIWALI.red }}>{T[0].off}% OFF</span></>}</span>
            <span data-offer-todo-sub="1" style={{ flexShrink: 0, height: d ? 22 : 20, padding: "0 9px", borderRadius: sh.pill, display: "inline-flex", alignItems: "center", background: DIWALI.beige, border: stroke(0.75, DIWALI.goldSoft), color: DIWALI.red, fontSize: fsN + 0.5, fontWeight: 600, whiteSpace: "nowrap" }}>{!BYOB_FLAT && T.length > 1 ? "Add more, save more" : "Variants next"}</span>
          </div>
        </Reveal>
        {!BYOB_FLAT && <Reveal open={!empty}><div ref={scRef} data-offer-scroll={scroll ? "1" : "0"} className="sb-scroll" style={{ display: "flex", gap: scroll ? 14 : d ? 16 : 16, padding: d ? "13px 16px 13px" : scroll ? "16px 14px 15px" : "16px 14px 15px", ...(scroll ? { overflowX: "auto", scrollSnapType: "x proximity", scrollPaddingLeft: 14, scrollPaddingRight: 14 } : {}) }}>
          {segs.map((sg, i) => {
            const isNext = i === sel && !sg.reached;
            const pctColor = sg.reached || isNext ? PILL.ink : MUTED, numColor = sg.reached || isNext ? MUTED : PILL.greyText;
            return (
              <div key={sg.n} ref={(el) => { cols.current[i] = el; }} data-offer-seg={sg.reached ? "reached" : "locked"} data-offer-selected={i === sel ? "1" : "0"} style={{ flex: scroll ? "0 0 84px" : 1, minWidth: 0, textAlign: "center", scrollSnapAlign: "center" }}>
                <div style={{ height: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {sg.reached && <span key="tick" data-offer-dot="1" className="sb-pop" aria-label="unlocked" style={{ width: 12, height: 12, flexShrink: 0, borderRadius: sh.round, background: C.primary, color: C.onBar, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><IconCheck size={8} w={3.2} /></span>}
                  <span data-offer-pct="1" style={{ fontSize: fsP, fontWeight: isNext || sg.reached ? 700 : 600, letterSpacing: "-0.005em", whiteSpace: "nowrap", color: pctColor, opacity: sg.reached || isNext ? 1 : 0.85 }}>{sg.off}% OFF</span>
                </div>
                <div style={{ position: "relative", boxSizing: "border-box", height: 4, marginTop: 9, borderRadius: 2, background: progTrack(), overflow: "hidden" }}>
                  <div data-offer-fill={i} className="sb-anim" style={{ position: "absolute", inset: 0, width: `${sg.pct}%`, background: progFill(), transition: `width .35s ${EASE_MICRO}` }} />
                </div>
                <div data-offer-count="1" style={{ marginTop: 8, fontSize: fsN, fontWeight: 500, lineHeight: "14px", whiteSpace: "nowrap", color: numColor }}>{sg.n} Products</div>
              </div>
            );
          })}
        </div></Reveal>}
      </div>
      {/* the container's top edge, pinned with the bar (the same lip Mix & Match uses): the page scrolls under it, so the container is never cut */}
      <div data-offer-cap="1" aria-hidden="true" style={{ height: CAP_H, background: C.white, borderTop: stroke(1, LINE), borderRadius: "18px 18px 0 0", ...(d ? { marginTop: 10, borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE) } : { margin: `10px -${CONT_SIDE}px 0` }) }} />
    </div>
  );
}

/* =====================================================================
   BXGY — buy X, get Y free. The free products are the first cards (the vertical card, in green); every product is already in the bundle
   (you choose their variants); a black "+" sits on the seam between neighbouring cards. The free cards stay pinned once they scroll away.
   ===================================================================== */
function PlusDot({ size, style }) {
  return (
    <span data-plus="1" aria-hidden="true"
      style={{ position: "absolute", width: size, height: size, borderRadius: sh.round, background: C.primary, color: C.onBarAccent, border: stroke(2, C.white), boxSizing: "content-box", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, ...style }}>
      <IconPlusB size={Math.round(size * 0.55)} />
    </span>
  );
}
/* the products: a grid (or a slider) of selected cards, a "+" on the seam between neighbours */
function BxgyList({ kit, d, freeRef }) {
  const c = CATS[0];
  const all = [...BXGY_REWARDS, ...c.products], n = all.length;      // the free ones first, then the products you buy
  const k = BXGY_REWARDS.length;                                       // how many are free — no "+" between those; the first "+" is after the last of them
  const node = (p) => (p.reward && FEST
    ? <ScratchReveal radius={sh.card} tap hint="Tap to reveal" sub="Your free gift is inside" revealed={kit.rewardSeen(p.id)} onReveal={(el) => { celebrateAt(el, false, "Free gift unlocked"); kit.revealReward(p.id); }}><ProductCard {...card(p)} m /></ScratchReveal>
    : <ProductCard {...card(p)} m />);
  const card = (p) => (p.reward ? { p, selected: false, filled: false, vals: [], onDetails: () => OPEN_DETAILS && OPEN_DETAILS({ p }) } : { p, selected: true, filled: true, fixed: true, vals: kit.varsFor(p), onVar: (vi, val) => kit.setVar(p, vi, val), onDetails: () => OPEN_DETAILS && OPEN_DETAILS({ p }) });
  if (SET.cards === "slider") {
    return (
      <Slider d={d} data-cards="slider" className="card-refresh sb-scroll" style={{ display: "flex", gap: 22, overflowX: "auto", padding: "0 14px 16px", scrollSnapType: "x proximity", scrollPaddingLeft: 14, scrollPaddingRight: 14 }}>
        {all.map((p, i) => (
          <div key={p.id} ref={i === 0 ? freeRef : undefined} style={{ position: "relative", flex: `0 0 ${slideW(d, 14, 22)}px`, scrollSnapAlign: "start" }}>
            {node(p)}
            {i + 1 < n && !(i + 1 < k) && <PlusDot size={22} style={{ top: "50%", right: -11, transform: "translate(50%, -50%)" }} />}
          </div>
        ))}
      </Slider>
    );
  }
  const cols = d ? 4 : 2, G = d ? 14 : 16;                             // desktop: 4 cards in a row · mobile: 2
  return (
    <div data-cards="grid" className="card-refresh" style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: `16px ${G}px`, padding: "0 12px 16px" }}>
      {all.map((p, i) => {
        const hasRight = (i % cols) < cols - 1 && i + 1 < n && !(i + 1 < k);                       // never between two free cards
        return (
          <div key={p.id} ref={i === 0 ? freeRef : undefined} style={{ position: "relative", minWidth: 0 }}>
            {node(p)}
            {hasRight && <PlusDot size={22} style={{ top: "50%", right: -G / 2, transform: "translate(50%, -50%)" }} />}
          </div>
        );
      })}
    </div>
  );
}
function BxgyPanel({ kit, d, freeRef }) {
  return (
    <div data-panel="1" style={panelBox(d)}>
      <CategoryHeader cat={0} d={d} />
      <BxgyList kit={kit} d={d} freeRef={freeRef} />
    </div>
  );
}
/* mobile: the free product(s) as a small list card pinned at the top, in the page (not floating); with two or more it is a slider (it turns by itself every 3 s, swipe or tap the dots) */
const FLOAT_H = 68;
function FreeFloat({ show, kit, onFree }) {
  const rs = BXGY_REWARDS, n = rs.length;
  const [idx, setIdx] = useState(0);
  const drag = useRef(null);
  useEffect(() => {
    if (!show || n < 2) return undefined;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 3000);
    return () => clearInterval(t);                                  // runs again after every change, so a manual turn restarts the 3 s
  }, [show, n, idx]);
  const go = (d) => setIdx((i) => (i + d + n) % n);
  return (
    <>
      <div data-free-float="1" role="region" aria-label="Free with this bundle" aria-hidden={!show}
        onPointerDown={(e) => { drag.current = e.clientX; }}
        onPointerUp={(e) => { if (drag.current != null && n > 1) { const dx = e.clientX - drag.current; if (Math.abs(dx) > 28) go(dx < 0 ? 1 : -1); } drag.current = null; }}
        style={{ position: "relative", height: FLOAT_H, boxSizing: "border-box", background: freePal().bg, border: stroke(1, freePal().edge), borderRadius: sh.card, overflow: "hidden", touchAction: "pan-y",
          opacity: show ? 1 : 0, transition: `opacity .3s ${EASE_MICRO}` }}>
        <div className="fb-motion" style={{ display: "flex", width: `${n * 100}%`, height: "100%", transform: `translateX(-${(idx * 100) / n}%)`, transition: `transform .45s ${EASE_COLLAPSE}` }}>
          {rs.map((r) => { const seen = kit.rewardSeen(r.id); return (
            <div key={r.id} data-free-slide={seen ? "seen" : "sealed"} onClick={seen ? undefined : onFree} style={{ width: `${100 / n}%`, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 12px 0 10px", minWidth: 0, cursor: seen ? "default" : "pointer" }}>
              <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: sh.img, display: "flex", alignItems: "center", justifyContent: "center", background: seen ? C.fill : `linear-gradient(135deg, ${DIWALI.foil[0]}, ${DIWALI.foil[1]})` }}>{!seen && <GiftIcon size={20} color={DIWALI.goldDeep} />}</div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1.1, color: freePal().label }}><GiftIcon size={10} color={freePal().icon} /> {FEST ? "Free Diwali gift" : "Free gift"}</div>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2, letterSpacing: "-0.01em", color: C.inkOnBg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seen ? r.name : "Your free gift is waiting"}</div>
                <div style={{ fontSize: 11, lineHeight: 1.2, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seen ? `${r.variant} · worth ${inr(r.mrp)}` : "Tap the card above to reveal it"}</div>
              </div>
              <FreePill />
            </div>
          ); })}
        </div>
      </div>
      {n > 1 && (
        <div data-free-dots="1" style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 12, marginTop: 3, opacity: show ? 1 : 0, transition: `opacity .3s ${EASE_MICRO}` }}>
          {rs.map((r, i) => (
            <button key={r.id} onClick={() => setIdx(i)} aria-label={`Show free product ${i + 1}`} aria-current={i === idx} tabIndex={show ? 0 : -1}
              style={{ width: 16, height: 14, border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span className="sb-anim" style={{ width: i === idx ? 9 : 5, height: 4, borderRadius: 999, background: i === idx ? C.primary : GREY_DARK }} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
/* the sticky band for BXGY: what you buy, what you get free, and what it saves — with the container's top edge pinned under it (as in BYOB) */
function BxgyBar({ kit, wrapRef, top = 0, d, stuck = false, onFree }) {
  return (
    <div ref={wrapRef} data-bxgy-bar="1" className="fb-motion" style={{ position: "sticky", top, zIndex: 30, backgroundColor: pageBgColor(), padding: `8px ${d ? DESK_SIDE : CONT_SIDE}px 0` }}>
      {/* the freebies are the important part, so they stay: once the free cards scroll away they hang under the container's top edge — a small list card in the page on mobile (the container sits below it), a compact bar on desktop */}
      {!d && !FIXED && (
        <div data-free-collapse="1" style={{ display: "grid", gridTemplateRows: stuck ? "1fr" : "0fr", transition: `grid-template-rows .35s ${EASE_COLLAPSE}` }}>
          <div style={{ minHeight: 0, overflow: "hidden", visibility: stuck ? "visible" : "hidden", transition: `visibility 0s linear ${stuck ? 0 : 0.35}s` }}>
            <FreeFloat show={stuck} kit={kit} onFree={onFree} />
            <div style={{ height: BXGY_REWARDS.length > 1 ? 3 : 8 }} />
          </div>
        </div>
      )}
      <div aria-hidden="true" style={{ height: CAP_H, background: C.white, borderTop: stroke(1, LINE), borderRadius: "18px 18px 0 0", ...(d ? { borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE) } : { margin: `0 -${CONT_SIDE}px` }) }} />
      {d && !FIXED && <div data-free-sticky="1" aria-hidden={!stuck} style={{ position: "absolute", top: "100%", left: d ? DESK_SIDE : 0, right: d ? DESK_SIDE : 0, boxSizing: "border-box", display: "flex", gap: 8, padding: d ? "8px 12px" : "8px 10px", background: freePal().bg, borderBottom: stroke(1, freePal().edge), ...(d ? { borderLeft: stroke(1, LINE), borderRight: stroke(1, LINE) } : {}), boxShadow: "0 10px 16px -12px rgba(0,0,0,.22)",
        opacity: stuck ? 1 : 0, transform: stuck ? "none" : "translateY(-8px)", pointerEvents: stuck ? "auto" : "none", transition: `opacity .25s ${EASE_MICRO}, transform .3s ${EASE_COLLAPSE}` }}>
        {BXGY_REWARDS.map((r) => { const seen = kit.rewardSeen(r.id); return (
          <div key={r.id} data-free-chip={seen ? "seen" : "sealed"} onClick={seen ? undefined : onFree} style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, background: C.white, border: stroke(1, freePal().edge), borderRadius: sh.card, padding: 5, cursor: seen ? "default" : "pointer" }}>
            <div style={{ width: d ? 34 : 32, height: d ? 34 : 32, flexShrink: 0, borderRadius: sh.img, display: "flex", alignItems: "center", justifyContent: "center", background: seen ? C.fill : `linear-gradient(135deg, ${DIWALI.foil[0]}, ${DIWALI.foil[1]})` }}>{!seen && <GiftIcon size={16} color={DIWALI.goldDeep} />}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: FS(11.5), fontWeight: 600, lineHeight: 1.25, color: C.inkOnBg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{seen ? r.name : "Free gift"}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 1 }}>
                {seen ? <><span style={{ fontSize: FS(10.5), fontWeight: 700, letterSpacing: "0.03em", color: freePal().price }}>FREE</span>
                <span style={{ fontSize: FS(9.5), color: C.mutedOnTile, textDecoration: "line-through" }}>{inr(r.mrp)}</span></> : <span style={{ fontSize: FS(10), color: MUTED }}>Tap to reveal</span>}
              </div>
            </div>
          </div>
        ); })}
      </div>}
    </div>
  );
}

/* =====================================================================
   The page — one shell for both frames. D (desktop) only swaps the pieces that need a
   different shape on a wide screen; everything else is the same component.
   ===================================================================== */
/* what "Proceed" opens: the bottom sheet on mobile, the right-hand drawer on desktop */
function ProceedPanel({ kit, onClose, onOne, onSub, side = false, another = false }) {
  const padX = side ? 12 : DR.padX;      // the BYOB side panel: less side padding, so the CTAs get wider
  return (
    <div data-proceed="1" style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", background: C.white }}>
      <div style={{ padding: `18px ${padX}px 14px`, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...DR.title, color: C.inkOnBg }}>Your Bundle</div>
          <div style={{ ...DR.sub, color: MUTED, marginTop: 3 }}>{plural(kit.count, "item")}{BXGY && kit.rewards.length ? ` + ${kit.rewards.length} free` : ""} · {kit.caption}</div>
        </div>
        {onClose && <CircleBtn label="Close" onClick={onClose}><IconX /></CircleBtn>}
      </div>
      <div style={{ borderTop: stroke(1, LINE), flexShrink: 0 }} />
      <div className="sb-scroll" data-proceed-list="1" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: `20px ${padX}px` }}>
        {kit.count === 0 && <div data-panel-empty="1" style={{ fontSize: FS(12.5), color: MUTED, lineHeight: 1.5 }}>Add products to start building your bundle.</div>}
        <BundleList headless kit={kit} onRemove={(c, idx) => kit.remove(c, idx)} />
      </div>
      {/* Diwali: the Subscribe & save · prices locked strip, edge to edge above the total — the same strip as the mobile sticky bar (square corners) */}
      {FEST && kit.complete ? <div className="sb-in" data-proceed-nudge="1" style={{ flexShrink: 0 }}><SubLockStrip d={DESK} flip /></div> : <div style={{ borderTop: stroke(1, LINE), flexShrink: 0 }} />}
      <div style={{ padding: `12px ${padX}px 14px`, flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ ...DR.title, color: C.inkOnBg }}>Total</span>
          <span key={kit.total} className="sb-pop" style={{ fontSize: FS(18), fontWeight: 700, letterSpacing: "-0.02em", color: C.inkOnBg }}>{inr(kit.total)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: side ? 8 : 10 }}>
          <BuyNowBtn onClick={onOne} disabled={!kit.complete} h={44} fs={FS(12.5)} />
          <SubSaveBtn onClick={onSub} disabled={!kit.complete} h={44} fs={FS(12.5)} subFs={FS(9.5)} />
        </div>
        {/* BYOB: after Buy now / Subscribe has been tapped, a quiet secondary CTA to start another one — full width, shorter than the two above */}
        {BYOB && another && kit.complete && (
          <button onClick={() => { kit.reset(); onClose && onClose(); }} data-cta="build-another" className="fb-ghost sb-anim sb-attn"
            style={{ width: "100%", height: 34, marginTop: side ? 8 : 10, borderRadius: sh.pill, background: "transparent", color: C.inkOnBg, border: stroke(1, GREY_DARK), fontSize: FS(11.5), fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap" }}>
            <IconPlusB size={13} /> Build another bundle
          </button>
        )}
      </div>
    </div>
  );
}

function Shell({ kit }) {
  const shellRef = useRef(null);
  usePlfStyles();                                    // the festive animations (shimmer, glint, twinkle, flicker, shake) are always on the page
  const D = DESK;
  const SIDEMODE = D && BYOB;                         // BYOB desktop: a docked side panel instead of the bottom bar + drawers
  useEffect(() => { if (SIDEMODE && kit.count === 0) setCo(false); }, [kit.count, SIDEMODE]);
  const sideOpen = SIDEMODE && kit.count > 0;           // the side panel only exists once there is a product
  // the panel always fits what is visible: it stops at the bottom of the screen, and near the footer it shrinks to end where the grid ends — so its top is never pushed off
  const rowRef = useRef(null);
  const [asideH, setAsideH] = useState(DL_H - 16);
  const [cat, setCat] = useState(0);
  const [toast, setToast] = useState("");
  const [co, setCo] = useState(false);       // Subscribe & save
  const [freeStuck, setFreeStuck] = useState(false);   // BXGY: the first free card has scrolled up under the pinned edge
  const freeRef = useRef(null);
  const [list, setList] = useState(false);   // "Your Bundle" drawer (desktop, sticky bar)
  const [detail, setDetail] = useState(null), [detailOpen, setDetailOpen] = useState(false);      // the product details drawer
  useEffect(() => { OPEN_DETAILS = (it) => { setDetail(it); setDetailOpen(true); }; return () => { OPEN_DETAILS = null; }; }, []);
  const [proceed, setProceed] = useState(false);   // the drawer the floating pill's "Proceed" opens
  // Flash sale · multi-day offer: which day is on show, and whether its popup (locked / closed day) was closed
  const flashOn = FEST && SET.bannerType === "flash" && SET.topBanner, fMulti = flashOn && SET.flashDays !== "off";
  const fLive = Math.max(0, Math.min(FLASH.days.length, SET.flashLive || 0));
  const [fDay, setFDay] = useState(Math.min(fLive, FLASH.days.length - 1)), [fShut, setFShut] = useState(false);
  useEffect(() => { setFDay(Math.min(fLive, FLASH.days.length - 1)); setFShut(false); }, [fLive, fMulti]);
  const pickFDay = (i) => { setFDay(i); setFShut(false); };
  const [ordered, setOrdered] = useState(false);   // BYOB: Buy now or Subscribe has been tapped → "Build another bundle" appears
  useEffect(() => { if (!kit.complete) setOrdered(false); }, [kit.complete]);
  const [dockH, setDockH] = useState(56);
  const dockRef = useRef(null);
  const scrollRef = useRef(null), anchorRef = useRef(null), wrapRef = useRef(null), secRefs = useRef([]), lockUntil = useRef(0), advTimer = useRef(null), toastTimer = useRef(null);
  useEffect(() => {
    if (!SIDEMODE) return undefined;
    const sc = scrollRef.current; if (!sc) return undefined;
    const measure = () => {
      const row = rowRef.current; if (!row) return;
      const fr = sc.getBoundingClientRect(), k = (fr.width / (sc.offsetWidth || 1)) || 1, rr = row.getBoundingClientRect();
      const top = Math.max(8, (rr.top - fr.top) / k + 8), bottom = Math.min(DL_H - 8, (rr.bottom - fr.top) / k);
      setAsideH(Math.max(240, Math.round(bottom - top)));
    };
    measure();
    sc.addEventListener("scroll", measure, { passive: true });
    return () => sc.removeEventListener("scroll", measure);
  }, [SIDEMODE, kit.count]);
  const vertical = SET.flow === "vertical" && !BYOB && !BXGY;
  const floating = SET.dock === "floating" && !BYOB;   // Mix & Match and BXGY
  const extra = floating ? 14 : 0;           // the floating pill sits 14px off the bottom
  useEffect(() => {
    const el = dockRef.current; if (!el) return;
    const f = () => setDockH(el.offsetHeight || 56);
    f();
    let ro; if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(f); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [SET.dock, D]);
  useEffect(() => () => { clearTimeout(advTimer.current); clearTimeout(toastTimer.current); }, []);
  useEffect(() => { if (kit.count === 0) setList(false); }, [kit.count]);
  useEffect(() => { if (!kit.complete) setProceed(false); }, [kit.complete]);
  const showToast = (t, ms = 1800) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), ms); };
  const toastNow = useRef(showToast); toastNow.current = showToast;
  useEffect(() => { TOAST = (t) => toastNow.current(t, 3400); return () => { TOAST = null; }; }, []);
  // the free category opens up: say so
  const wasLocked = useRef(kit.freeLocked);
  useEffect(() => { if (FREE_LAST && wasLocked.current && !kit.freeLocked) showToast(`${freeTitle()} unlocked`, 2600); wasLocked.current = kit.freeLocked; }, [kit.freeLocked]);
  // Mix & Match: every product added (or swapped) pops the toast — what was done, what is next, how much is left
  const itemsSig = kit.items.map((a) => a.join(",")).join("|"), itemsPrev = useRef(kit.items.map((a) => a.slice()));
  useEffect(() => {
    const prev = itemsPrev.current; itemsPrev.current = kit.items.map((a) => a.slice());
    if (BYOB || BXGY) return;
    for (let c = 0; c < kit.items.length; c++) {
      const was = prev[c] || [], now = kit.items[c];
      if (now.length && (now.length > was.length || (now.length === was.length && now.join() !== was.join()))) {
        const auto = (vertical ? SET.loader !== "no" : SET.autoMove !== "no") && SET.pick === "one" && was.length === 0 && !kit.complete && c < LAST && !(isFreeCat(c + 1) && kit.freeLocked);
        const t = pickToast(kit, c, was.length, auto); showToast(t, t.state === "done" ? 4200 : 3200);
        if (auto) autoMove(c + 1);          // the completion toast and the blur arrive together, then it moves on by itself
        break;
      }
    }
  }, [itemsSig]);
  // Mix & Match: opening a category that is still empty → the outlined "what to do here" toast (step flow; not while scrolling a vertical list)
  const openPrev = useRef(cat);
  useEffect(() => {
    if (openPrev.current === cat) return; openPrev.current = cat;
    if (BYOB || BXGY || vertical || kit.items[cat].length) return;
    showToast(openToast(kit, cat), 2600);
  }, [cat]);

  const goTo = (i) => {
    if (i < 0 || i > LAST) return;
    clearTimeout(advTimer.current);
    setCat(i); setList(false);
    lockUntil.current = Date.now() + 800;            // our own scroll shouldn't change the active category
    requestAnimationFrame(() => {
      const sc = scrollRef.current;
      if (!sc || !sc.scrollTo) return;
      if (vertical) {                                // all categories listed: the chosen one comes to the top, under the pills
        const sec = secRefs.current[i], h = wrapRef.current ? wrapRef.current.offsetHeight : 0;
        if (sec) sc.scrollTo({ top: Math.max(0, sec.offsetTop - h + (i === 0 ? 0 : 6)), behavior: "smooth" });
      } else if (anchorRef.current) sc.scrollTo({ top: Math.max(0, anchorRef.current.offsetTop), behavior: "smooth" });
    });
  };
  const saveTimer = useRef(null), [saving, setSaving] = useState(null);   // null, or { from, to } while the next-category loader shows
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  const loaderOn = SET.loader !== "no" && !BYOB && !BXGY;
  // moving on to a LATER category (once this one has a pick): a quick 0.7-second loader first. Going back is instant.
  const goStep = (i) => {
    if (saving) return;
    if (loaderOn && i > cat && kit.items[cat] && kit.items[cat].length) { setSaving({ from: cat, to: i }); clearTimeout(saveTimer.current); saveTimer.current = setTimeout(() => { setSaving(null); goTo(i); }, SAVE_MS); }
    else goTo(i);
  };
  const autoMove = (i) => { clearTimeout(saveTimer.current); setSaving({ from: i - 1, to: i }); saveTimer.current = setTimeout(() => { setSaving(null); goTo(i); }, SAVE_MS); };
  const advance = () => { clearTimeout(advTimer.current); };   /* no auto-move: the shopper goes to the next category with Next / the pills */
  const [pillsHidden, setPillsHidden] = useState(false), lastY = useRef(0);
  const onScroll = (e) => {                          // vertical list: the pill follows whichever category is at the top
    if (LAYOUT_V2 && !D && !BYOB && !BXGY && SET.mobNav !== "arrows") {   // V2 (mobile, bar option): scrolling down tucks the pills away, scrolling up brings them back
      const y = e.currentTarget.scrollTop, dy = y - lastY.current;
      if (Math.abs(dy) > 8) {
        const past = anchorRef.current ? y > anchorRef.current.offsetTop + 60 : y > 200;
        const hide = dy > 0 && past;
        setPillsHidden((h) => (h === hide ? h : hide));
        lastY.current = y;
      }
    }
    if (BXGY) {                                      // BXGY: show the compact free cards once the first free card is out of sight
      const f = freeRef.current, w = wrapRef.current;
      if (f && w && !FIXED) { const st = f.getBoundingClientRect().bottom <= w.getBoundingClientRect().bottom + 2; setFreeStuck((o) => (o === st ? o : st)); }
      return;
    }
    if (!vertical || Date.now() < lockUntil.current) return;
    const sc = e.currentTarget, h = wrapRef.current ? wrapRef.current.offsetHeight : 0, y = sc.scrollTop + h + 24;
    let a = 0; secRefs.current.forEach((el, i) => { if (el && el.offsetTop <= y) a = i; });
    if (a !== cat) setCat(a);
  };
  const Pills = BYOB ? OfferBar : BXGY ? BxgyBar : SET.pills === "stepper" ? CategoryStepper : CategoryPills;
  // "Next": the following category — or, from the last one, the first category that still has no pick
  const nextTarget = cat < LAST ? cat + 1 : kit.items.findIndex((a) => a.length === 0);
  const dockProps = { kit, cat, dockRef, onPrev: cat > 0 ? () => goTo(cat - 1) : null, onProceed: () => { setList(false); setCo(false); setProceed(true); }, onJump: goStep, onNext: nextTarget >= 0 ? () => goStep(nextTarget) : null, onOne: () => { setList(false); setOrdered(true); showToast("Heading to checkout"); }, onSub: () => { setList(false); setOrdered(true); setCo(true); }, ordered, onAnother: () => kit.reset() };

  return (
    <div ref={shellRef} style={{ position: "relative", width: D ? DL_W : PHONE_W, height: D ? DL_H : PHONE_H, flexShrink: 0, overflow: "hidden", borderRadius: sh.card, border: stroke(0.75, GREY_DARK), background: pageBgColor() }}>
      <div ref={scrollRef} onScroll={onScroll} className="sb-scroll" style={{ position: "absolute", inset: 0, overflowY: "auto", backgroundColor: pageBgColor() }}>
        <Announcements />
        {D ? <DesktopNav count={kit.count} /> : <NavBar count={kit.count} />}
        {SET.topBanner ? (FEST && SET.bannerType === "flash" ? <FlashBanner d={D} multi={fMulti} day={fDay} setDay={pickFDay} liveDay={fLive} /> : <HeroBanner d={D} side={SIDEMODE ? BYOB_SIDE : DESK_SIDE} />) : <IntroText d={D} side={SIDEMODE ? BYOB_SIDE : DESK_SIDE} />}
        <div ref={anchorRef} style={{ height: D ? 18 : 14 }} />
        {SIDEMODE ? (
          <div ref={rowRef} data-byob-main="1" style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: `0 ${BYOB_SIDE}px` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* the progress bar sits right above the grid, in the grid's own column, and sticks under the top once something is in the bundle */}
              <OfferBar d={D} kit={kit} wrapRef={wrapRef} top={0} fit />
              <CategoryPanel d={D} cat={0} kit={kit} onPicked={advance} fit cols={sideOpen ? 3 : 4} />
            </div>
            {/* the panel is a DIRECT child of the row, so it can stick to the viewport for the whole length of the grid (a wrapper around it would pin it to its own height and let it scroll away) */}
            {sideOpen && (
              <div data-side-wrap="1" style={{ width: 320, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 8, marginTop: 8, height: asideH, boxSizing: "border-box", zIndex: 45, overflow: "hidden", borderRadius: sh.card }}>
                <aside aria-label="Your bundle" data-side-panel="1" className="sb-in"
                  style={{ position: "absolute", inset: 0, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden", border: stroke(0.75, GREY_LIGHT), borderRadius: sh.card, background: C.white }}>
                  <ProceedPanel kit={kit} side another={ordered} onOne={() => { setOrdered(true); showToast("Heading to checkout"); }} onSub={() => { setOrdered(true); setCo(true); }} />
                </aside>
                {/* Subscribe & save: a drawer that slides in from the right over the panel — same size, the panel is fully covered */}
                <SideDrawer open={co} onClose={() => setCo(false)} label="Subscribe options"><SubscribePanel store={kit} onClose={() => setCo(false)} /></SideDrawer>
              </div>
            )}
          </div>
        ) : (<>
        <Pills d={D} kit={kit} wrapRef={wrapRef} cat={cat} sel={kit.sel} onGo={goStep} top={0} hide={pillsHidden && !D} onPrev={dockProps.onPrev} onNext={dockProps.onNext} stuck={freeStuck} onFree={() => { const sc = scrollRef.current; if (sc && sc.scrollTo && anchorRef.current) sc.scrollTo({ top: Math.max(0, anchorRef.current.offsetTop), behavior: "smooth" }); }} />
        {BXGY ? <BxgyPanel d={D} kit={kit} freeRef={freeRef} />
          : vertical
            ? <VerticalPanel d={D} kit={kit} onPicked={advance} secRefs={secRefs} />
            : <CategoryPanel d={D} cat={cat} kit={kit} onPicked={advance} />}
        </>)}
        <div style={{ height: kit.count > 0 && !SIDEMODE ? Math.max(24, dockH - 26 + 14 + extra) : 24, background: D ? undefined : C.white, transition: `height .4s ${EASE_COLLAPSE}` }} />
        <div style={{ height: 26, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.3px", color: C.subOnBar, textTransform: "uppercase", lineHeight: 1 }}>Powered by: Stackback.Ai</span>
        </div>
      </div>
      {/* a day that is locked or already over: the whole page blurs and the popup sits in the middle of it */}
      {fMulti && fDay !== fLive && !fShut && <FlashDayPopup d={D} day={fDay} liveDay={fLive} onToday={() => pickFDay(Math.min(fLive, FLASH.days.length - 1))} onClose={() => setFShut(true)} />}
      {SIDEMODE ? null : floating ? <BundleFloat {...dockProps} d={D} />
        : D ? <DesktopDock {...dockProps} open={list} onToggleList={() => { setCo(false); setProceed(false); setList((o) => !o); }} />
        : <BundleDock {...dockProps} />}
      <Toast text={toast} bottom={(kit.count > 0 && !SIDEMODE ? dockH + extra : 0) + 10} />
      {saving && <SaveLoader from={saving.from} to={saving.to} d={D} />}
      {/* a small floating note above the sticky bar, bottom right, while a Subscribe button is on screen */}
      <FreebieNudge rootRef={shellRef} always={!BXGY} sel='[data-cta="subscribe"]' bottom={(kit.count > 0 && !SIDEMODE ? dockH + extra : 0) + 14} right={SIDEMODE && sideOpen ? BYOB_SIDE + 320 + 14 : D ? DESK_SIDE - DESK_DOCK_PAD : 12} />
      {D ? <FrameDrawer open={detailOpen} onClose={() => setDetailOpen(false)} label="Product details">{detail && <ProductDetails item={detail} kit={kit} onPicked={advance} onClose={() => setDetailOpen(false)} />}</FrameDrawer>
        : <Sheet open={detailOpen} onClose={() => setDetailOpen(false)} height="auto" maxHeight="90%" label="Product details" handle={false}>{detail && <ProductDetails item={detail} kit={kit} onPicked={advance} onClose={() => setDetailOpen(false)} />}</Sheet>}
      <Celebration kit={kit} dockH={(kit.count > 0 && !SIDEMODE ? dockH + extra : 0)} />
      {SIDEMODE ? null : D ? (
        <>
          <FrameDrawer open={list && kit.count > 0} onClose={() => setList(false)} label="Your Bundle"><BundleDrawer kit={kit} onClose={() => setList(false)} /></FrameDrawer>
          <FrameDrawer open={co && kit.count > 0} onClose={() => setCo(false)} label="Subscribe options"><SubscribePanel store={kit} onClose={() => setCo(false)} /></FrameDrawer>
          <FrameDrawer open={proceed && kit.complete} onClose={() => setProceed(false)} label="Proceed"><ProceedPanel kit={kit} another={ordered} onClose={() => setProceed(false)} onOne={() => { setOrdered(true); setProceed(false); showToast("Heading to checkout"); }} onSub={() => { setOrdered(true); setProceed(false); setCo(true); }} /></FrameDrawer>
        </>
      ) : (
        <>
          <Sheet open={co && kit.count > 0} onClose={() => setCo(false)} height="auto" maxHeight="90%" label="Subscribe options" handle={false}>
            <SubscribePanel store={kit} onClose={() => setCo(false)} />
          </Sheet>
          <Sheet open={proceed && kit.complete} onClose={() => setProceed(false)} height="auto" maxHeight="88%" label="Proceed" handle={false}>
            <ProceedPanel kit={kit} another={ordered} onClose={() => setProceed(false)} onOne={() => { setOrdered(true); setProceed(false); showToast("Heading to checkout"); }} onSub={() => { setOrdered(true); setProceed(false); setCo(true); }} />
          </Sheet>
        </>
      )}
    </div>
  );
}

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

function Body({ view, fit }) {
  const kit = useKit();          // remounted when "Pick" or "Categories" change; kept when you switch Mobile ↔ Desktop
  if (view === "mobile") return <Shell kit={kit} />;
  return (
    <div data-desktop-wrap="1" style={{ width: DESK_W * fit, height: DESK_H * fit, flexShrink: 0 }}>
      <div style={{ width: DL_W, height: DL_H, transform: `scale(${DESK_K * fit})`, transformOrigin: "top left" }}><Shell kit={kit} /></div>
    </div>
  );
}

export default function SBDiwaliBYOB() {
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
        <div style={{ position: "sticky", top: 16, alignSelf: "flex-start", flexShrink: 0 }}>{<Body key={`${s.type}-${s.pick}-${s.cats}-${s.bxBuy}-${s.bxFree}-${s.mixMode}-${s.offers}-${s.byobMode}`} view={view} fit={fit} />}</div>
        <SettingsPanel s={s} set={set} onReset={() => setS(SET_DEFAULT)} view={view} onView={setView} />
      </div>
    </div>
  );
}
