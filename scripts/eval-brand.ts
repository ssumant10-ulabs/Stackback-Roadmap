/** What the brand reader returns for a set of real storefronts, side by side.
 *
 *  Colour extraction has no unit test that means anything: the only truth is what the page
 *  actually renders, and that lives in a browser. So this prints the six tokens and their
 *  confidence per store, and the EXPECT rows below are values checked against the rendered
 *  DOM by hand, on the date in the comment. A run that still matches them has not regressed.
 *
 *  Needs the dev server up: npx tsx scripts/eval-brand.ts
 */
const API = process.env.BRAND_API || "http://localhost:4342/api/brand-colours";

/** Verified in the browser against the computed style on the store's own product page. */
const EXPECT: Record<string, Partial<Record<string, string>>> = {
  // 2026-09-25: h1.product-single__title computes rgb(55,31,34); the Add to cart button
  // the page actually paints is rgb(0,0,0); --g-label-sale is #ffa800.
  "satturmittaikadai.com": { Brand_Primary: "#000000", Product_Tile: "#371F22", Brand_Accent: "#FFA800" },
  // 2026-09-24: Dawn theme settings, --color-button #FF5F60, --color-foreground #121212.
  "thebasicswoman.com": { Brand_Primary: "#FF5F60", Product_Tile: "#121212", Widget_Background: "#FFFFFF" },
  // 2026-09-24: Dawn, 16px card radius over 40px pill buttons.
  "thestack.club": { Brand_Primary: "#272727", Widget_Background: "#FFFFFF" },
};

async function main() {
  let bad = 0;
  for (const store of Object.keys(EXPECT)) {
    const r = await fetch(`${API}?url=${encodeURIComponent(store)}`);
    const d = await r.json();
    console.log(`\n## ${store}  ${d.ok ? `${d.method}, read from the ${d.readFrom} page` : d.code || d.error}`);
    if (!d.ok) { bad++; continue; }
    if (d.product) console.log(`   product: ${d.product.title} at ${d.product.priceMinor != null ? d.product.priceMinor / 100 : "?"}`);
    for (const t of d.tokens as { key: string; hex: string; confidence: string; source: string }[]) {
      const want = EXPECT[store][t.key];
      const mark = want ? (want.toUpperCase() === t.hex.toUpperCase() ? "ok  " : "WRONG") : "    ";
      if (want && want.toUpperCase() !== t.hex.toUpperCase()) bad++;
      console.log(`   ${mark} ${t.key.padEnd(24)} ${t.hex}  ${t.confidence.padEnd(8)} ${t.source}${want && mark === "WRONG" ? `   (verified: ${want})` : ""}`);
    }
    for (const n of d.notes || []) console.log(`   note: ${n}`);
  }
  console.log(bad ? `\nFAIL: ${bad} token(s) differ from what the browser shows` : "\nPASS");
  process.exit(bad ? 1 : 0);
}
main();
