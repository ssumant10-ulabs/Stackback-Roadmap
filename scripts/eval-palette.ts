/** Sampling colours out of a screenshot, asserted.
 *
 *  The reader works from the served HTML and CSS, and on a page whose colours are painted by
 *  JavaScript — or whose only colour variables belong to a review app — there is nothing in
 *  the response to find. A screenshot is definitionally what the merchant sees. What has to
 *  be right is the quantiser: it must collapse gradients and JPEG noise into the colour they
 *  are a shade of, keep two brand colours apart, and report a hex that was actually there.
 *
 *  Run: npx tsx scripts/eval-palette.ts
 */
import { luminance, palette, saturation, suggestTokens, toHex } from "../lib/help/shot-palette";

let fails = 0;
const ok = (c: boolean, what: string) => { if (!c) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`); };

/** An image as flat pixel data: [[hex, count], ...]. */
function img(parts: [string, number][], alpha = 255): Uint8ClampedArray {
  const px: number[] = [];
  for (const [hex, n] of parts) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < n; i++) px.push(r, g, b, alpha);
  }
  return new Uint8ClampedArray(px);
}

console.log("\nRanking what is in the picture");
const p = palette(img([["#FFFFFF", 700], ["#1A1A1A", 200], ["#D93B1A", 100]]));
ok(p.length === 3, `three colours, got ${p.length}`);
ok(p[0].hex === "#FFFFFF", "the biggest area comes first");
ok(Math.abs(p[0].share - 0.7) < 0.01, "and its share is the share of the image");
ok(p.map((s) => s.hex).includes("#D93B1A"), "a small brand colour still makes the list");

console.log("\nNoise collapses, brands do not");
/* Six near-identical whites are one white: anti-aliasing and JPEG artefacts must not eat
   the list, or the palette is thirty shades of background and no brand colour at all. */
const noisy = palette(img([
  ["#FFFFFF", 200], ["#FEFEFE", 200], ["#FDFDFD", 200], ["#FFFEFF", 200],
  ["#D93B1A", 150], ["#1A1A1A", 150],
]));
ok(noisy.length === 3, `four near-whites collapse to one, got ${noisy.length} colours`);
ok(Math.abs(noisy[0].share - 800 / 1100) < 0.01,
  `and the collapsed bucket carries their combined share, got ${(noisy[0].share * 100).toFixed(1)}%`);
/* But two colours a brand actually chose have to survive as two. */
const two = palette(img([["#D93B1A", 300], ["#1A7F37", 300], ["#FFFFFF", 400]]));
ok(two.length === 3, "a red and a green stay two colours");
ok(two.some((s) => s.hex.startsWith("#D9")) && two.some((s) => s.hex.startsWith("#1A")),
  "and both are reported near the hex that was in the image");

console.log("\nWhat is not a colour anybody chose");
ok(palette(img([["#FFFFFF", 500], ["#123456", 1]])).length === 1,
  "a one-pixel colour is anti-aliasing, not a palette entry");
ok(palette(img([["#FFFFFF", 500]], 0)).length === 0, "fully transparent pixels are not a colour");
ok(palette(new Uint8ClampedArray([])).length === 0, "an empty image is an empty palette");

console.log("\nThe arithmetic the ranking leans on");
ok(saturation(255, 255, 255) === 0 && saturation(128, 128, 128) === 0, "grey has no saturation");
ok(saturation(217, 59, 26) > 0.8, "a brand red is saturated");
ok(luminance(255, 255, 255) > 0.99 && luminance(0, 0, 0) < 0.01, "white and black bracket luminance");
ok(toHex(217, 59, 26) === "#D93B1A", "hex comes back upper case and padded");
ok(toHex(0, 0, 0) === "#000000", "and pads every channel");

console.log("\nThe first guess, which is only a guess");
/* A flat picture knows its colours exactly and knows nothing about which one is the button,
   so these are the only rules an image supports: biggest area is the page, darkest is the
   ink, most saturated is the brand. The UI offers them and the person reassigns. */
const g = suggestTokens(palette(img([["#F6F3EC", 700], ["#1A1A1A", 150], ["#2779B4", 150]])));
ok(g.Widget_Background === "#F6F3EC", "the biggest area is offered as the page");
ok(g.Product_Tile === "#1A1A1A", "the darkest is offered as the text");
ok(g.Brand_Primary === "#2779B4", "the saturated one is offered as the brand");
ok(Object.keys(suggestTokens([])).length === 0, "no picture, no guesses");

console.log(fails ? `\n${fails} FAILED\n` : "\nAll palette assertions pass.\n");
process.exit(fails ? 1 : 0);
