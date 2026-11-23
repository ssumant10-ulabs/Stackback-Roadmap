/* Builds the real StackBack landing page designs into the Landing Page Lab.
 *
 *   node scripts/build-lp-design.mjs
 *
 * Sources (the design files, unchanged copies): design-src/lp/SB_LP_Bundles.jsx (Mix & Match,
 * BYOB, BXGY, Fixed bundle) and design-src/lp/SB_LP_Subscription.jsx (Subscription V2,
 * Surprise box). Each gets a few strict patches so the lab can drive it:
 *   - brand colours, settings, products and the view come from window.__SB_LAB__ (set by
 *     public/lp-design/boot.js from the link's #c=)
 *   - product cards and the subscription gallery show a product image when one is given
 *   - a LabRoot renders only the page (no design settings panel) and posts the design's own
 *     settings list to the lab, so the lab's controls are always the design's controls
 * A patch that no longer matches its source stops the build: re-check it against the new
 * design file rather than shipping a page that silently ignores a setting. */
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(root, ".lp-build");
const out = join(root, "public", "lp-design");
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

function must(src, find, replace, count = 1, what = find.slice(0, 60)) {
  const n = src.split(find).length - 1;
  if (n !== count) throw new Error(`patch "${what}": expected ${count} match(es), found ${n}`);
  return src.split(find).join(replace);
}

/* `const BRAND = ...;` statements, found by bracket depth, each followed by the lab's colours. */
function patchBrands(src) {
  let i = 0, n = 0, outS = "";
  for (;;) {
    const at = src.indexOf("const BRAND = ", i);
    if (at < 0) break;
    let j = at + 14, depth = 0, q = null;
    for (; j < src.length; j++) {
      const c = src[j];
      if (q) { if (c === "\\") { j++; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === "`") { q = c; continue; }
      if (c === "{" || c === "(" || c === "[") depth++;
      else if (c === "}" || c === ")" || c === "]") depth--;
      else if (c === ";" && depth === 0) break;
    }
    outS += src.slice(i, j + 1) + " Object.assign(BRAND, __LAB.brand || {});";
    i = j + 1; n++;
  }
  if (!n) throw new Error("patch BRAND: none found");
  return outS + src.slice(i);
}

const PRELUDE = `
const __LAB = (typeof window !== "undefined" && window.__SB_LAB__) || {};
/* The lab's products, into the design's own categories: grouped by product type when the
   collection has three or more types, otherwise dealt round the categories in turn. */
function __labProducts(cats) {
  const P = __LAB.products;
  if (!P || !P.length) return;
  const card = (p, i) => ({
    id: "lab-" + i, name: p.name, price: Math.round(p.price), mrp: Math.round(p.mrp && p.mrp > p.price ? p.mrp : p.price),
    tag: i === 0 ? "Bestseller" : undefined, image: p.image || "",
    variants: p.variants && p.variants.length > 1 ? [{ label: p.option || "Option", options: p.variants.slice(0, 4) }] : [],
  });
  const types = [...new Set(P.map((p) => p.cat).filter(Boolean))];
  const n = cats.length;
  if (types.length >= 3) {
    cats.forEach((c, ci) => {
      const t = types[ci % types.length];
      const list = P.map(card).filter((_, i) => P[i].cat === t);
      c.products = list; c.title = t; c.label = "Choose " + t;
    });
  } else {
    cats.forEach((c, ci) => {
      const list = P.map(card).filter((_, i) => i % n === ci);
      c.products = list.length ? list : P.map(card).slice(0, 1);
      c.title = "Step " + (ci + 1); c.label = "Choose " + (ci + 1);
    });
  }
}
function __labPost(s, source) {
  try {
    if (window.parent === window) return;
    const opt = (k, v) => k === "flashBanner" ? FLASH.versions.map((b, i) => [i, b.n]) : Array.isArray(v) ? v : v;
    window.parent.postMessage({
      sbDesign: true, source, s,
      settings: SETTINGS.map(([k, label, o]) => ({ k, label, options: opt(k, o) })),
      sections: SETTING_SECTIONS, labels: SETTING_LABELS,
      visible: SETTINGS.map(([k]) => k).filter((k) => settingVisible(k, s)),
    }, location.origin);
  } catch (e) { /* the lab still works without the settings list */ }
}
`;

function patchCommon(src, file) {
  let s = PRELUDE + patchBrands(src);
  /* the setup line the design's own root runs before rendering */
  const m = /\n {2}SET = s; FEST = [^\n]*\n/.exec(s);
  if (!m) throw new Error(`${file}: settings line not found`);
  return { s, setup: m[0] };
}

/* ---- bundles: Mix & Match, BYOB, BXGY, Fixed ---- */
{
  const file = "SB_LP_Bundles.jsx";
  let { s, setup } = patchCommon(readFileSync(join(root, "design-src/lp", file), "utf8"), file);
  s = must(s, "\nlet CATS = CATS_ALL.slice(0, 3);", "\n__labProducts(CATS_ALL);\nlet CATS = CATS_ALL.slice(0, 3);", 1, "CATS_ALL products");
  s = must(s, 'aspectRatio: "1 / 1", background: C.fill, borderRadius: sh.img, overflow: "hidden", cursor: locked',
    'aspectRatio: "1 / 1", background: p.image ? `url(${JSON.stringify(p.image)}) center / cover no-repeat` : C.fill, borderRadius: sh.img, overflow: "hidden", cursor: locked', 1, "card image");
  s += `
export function LabRoot() {
  const view = __LAB.view === "mobile" ? "mobile" : "desktop";
  const s = { ...SET_DEFAULT, ...(__LAB.settings || {}) };
${setup}
  useEffect(() => { __labPost(s, "bundles"); });
  return (
    <div className="dk-root" style={{ fontFamily: FONT, background: C.canvas, minHeight: "100vh" }}>
      <StyleTag />
      <Body key={\`\${s.type}-\${s.pick}-\${s.cats}-\${s.bxBuy}-\${s.bxFree}-\${s.mixMode}-\${s.offers}-\${s.byobMode}\`} view={view} fit={1} />
    </div>
  );
}
`;
  writeFileSync(join(tmp, "bundles.jsx"), s);
}

/* ---- subscription: Subscription V2, Surprise box ---- */
{
  const file = "SB_LP_Subscription.jsx";
  let { s, setup } = patchCommon(readFileSync(join(root, "design-src/lp", file), "utf8"), file);
  s = must(s, "const VARIANTS = ['Classic', 'Reserve', 'Light', 'Intense'];",
    "const VARIANTS = (__LAB.product && __LAB.product.variants && __LAB.product.variants.length) ? __LAB.product.variants.slice(0, 6) : ['Classic', 'Reserve', 'Light', 'Intense'];", 1, "VARIANTS");
  s = must(s, "\n// Fallback pricing (250g × 1)",
    "\nif (__LAB.product && __LAB.product.price) { const P = __LAB.product; const mrp = Math.round(P.mrp && P.mrp > P.price ? P.mrp : P.price); QUANTITY_OPTIONS.splice(0, QUANTITY_OPTIONS.length, ...[1, 2, 3, 4].map((u) => ({ label: u === 1 ? '1 unit' : u + ' units', price: Math.round(P.price) * u, mrp: mrp * u }))); }\n// Fallback pricing (250g × 1)", 1, "QUANTITY_OPTIONS");
  s = must(s, "(fest ? diwaliBrand() : brandFromSettings(widgetSettings))", "(fest ? diwaliBrand() : { ...brandFromSettings(widgetSettings), ...(__LAB.brand || {}) })", 1, "page brand");
  s = must(s, "useState('Classic');", "useState(VARIANTS[0]);", 1, "first variant");
  s = must(s, "'Signature Collection — Subscription Edition'", "((__LAB.product && __LAB.product.name) || 'Signature Collection — Subscription Edition')", 2, "product title");
  s = must(s, '<div className="img-placeholder gallery-main">',
    '<div className={"img-placeholder gallery-main" + (__LAB.product && __LAB.product.image ? " lab-img" : "")} style={__LAB.product && __LAB.product.image ? { background: `url(${JSON.stringify(__LAB.product.image)}) center / cover no-repeat` } : undefined}>', 1, "gallery image");
  /* Every section the admin's Content tab can switch, tagged so the lab can hide it by CSS
     (boot.js): a tag survives design edits that a rewritten JSX block would not. */
  const SECTIONS = [
    ['<div className="trust-cards">', "trust"],
    ['<div className="faq-accordion mini-faq">', "quickq"],
    ['{!isSB && (<>\n      <section className="section">', "payway"],
    ['<section className="reels-marquee-section">', "reels"],
    ["<section className={`section${fest ? ' dw-upsell' : ''}`}>", "upsell"],
    ['<section className="marquee-section">', "marquee"],
    ['<section className="banner-carousel-section">', "banner"],
    ['{!isSB && (<section className="section">', "reviews"],
    ['<div style={{ padding: P.d ? "28px 0" : "16px 0" }}><GIFT.DiyaDivider d={!!P.d} /></div>\n<section className="section">', "faq"],
    ['<div className="sb-only-d"><GIFT.IllustrationWall d /></div>', "wall"],
    ['<div className="sb-only-m"><GIFT.IllustrationWall d={false} /></div>', "wall"],
    ['<div className="sticky-ticker">', "ticker"],
  ];
  for (const [find, key] of SECTIONS) {
    s = must(s, find, find.replace(/<(section|div)(?=[\s>])/g, `<$1 data-lab-sec="${key}"`), 1, `section ${key}`);
  }
  s += `
export function LabRoot() {
  const view = __LAB.view === "mobile" ? "mobile" : "desktop";
  const s = { ...SET_DEFAULT, ...(__LAB.settings || {}) };
${setup}
  useEffect(() => { __labPost(s, "subscription"); });
  return (
    <div className="dk-root" style={{ fontFamily: FONT, background: C.canvas, minHeight: "100vh" }}>
      <StyleTag />
      <SubFrame key={s.type} view={view} fit={1} kind={s.type === "surprise" ? "surprise" : "normal"} />
    </div>
  );
}
`;
  writeFileSync(join(tmp, "subscription.jsx"), s);
}

/* Only the icons the designs use: \`import * as Lucide\` would ship all of them (about 700 KB). */
{
  const used = new Set();
  for (const f of ["bundles.jsx", "subscription.jsx"]) {
    const src = readFileSync(join(tmp, f), "utf8");
    for (const m of src.matchAll(/const \{([^}]*)\} = Lucide;/g)) m[1].split(",").map((x) => x.trim().split(":")[0].trim()).filter(Boolean).forEach((x) => used.add(x));
    for (const m of src.matchAll(/Lucide\.([A-Z][A-Za-z0-9]*)/g)) used.add(m[1]);
  }
  writeFileSync(join(tmp, "lucide-shim.js"), `export { ${[...used].join(", ")} } from "lucide-react";\n`);
}

for (const name of ["bundles", "subscription"]) {
  writeFileSync(join(tmp, `${name}.entry.jsx`),
    `import { createRoot } from "react-dom/client";\nimport { LabRoot } from "./${name}.jsx";\ncreateRoot(document.getElementById("root")).render(<LabRoot />);\n`);
  await build({
    entryPoints: [join(tmp, `${name}.entry.jsx`)], bundle: true, minify: true, format: "iife",
    outfile: join(out, `${name}.js`), jsx: "automatic", loader: { ".jsx": "jsx" },
    define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning", legalComments: "none",
    nodePaths: [join(root, "node_modules")],
    plugins: [{ name: "lucide-shim", setup(b) { b.onResolve({ filter: /^lucide-react$/ }, (a) => a.importer.endsWith("lucide-shim.js") ? undefined : { path: join(tmp, "lucide-shim.js") }); } }],
  });
  console.log(`built public/lp-design/${name}.js`);
}
