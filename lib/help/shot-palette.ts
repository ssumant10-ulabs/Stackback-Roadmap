/** Colours sampled from a screenshot of the merchant's own page.
 *
 *  The reader fetches a URL and works from the served HTML and CSS, which is the right
 *  default and sometimes the wrong source. blepworld.com is the case: every colour variable
 *  that page declares belongs to Judge.me, the theme publishes none of its own, and the
 *  colours a visitor actually sees are painted by JavaScript after the document arrives. No
 *  amount of reading the response will find them.
 *
 *  A screenshot has no such problem. It is definitionally what the merchant sees, which is
 *  the thing we were trying to infer. So: quantise the image, rank what is there, and let a
 *  person say which colour is which — because a flat picture knows its colours exactly and
 *  knows nothing at all about which one is the button.
 *
 *  Pure over pixel data so it can be asserted without a browser; the component supplies the
 *  bytes from a canvas. */

export interface Swatch {
  hex: string;
  /** Share of sampled pixels, 0 to 1. */
  share: number;
  /** 0 to 1. Grey is 0. */
  sat: number;
  /** 0 to 1. */
  lum: number;
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");
export const toHex = (r: number, g: number, b: number) => `#${hex2(r)}${hex2(g)}${hex2(b)}`.toUpperCase();

export function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function saturation(r: number, g: number, b: number): number {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

/** Rank the colours in an image.
 *
 *  Buckets at 5 bits per channel, which is coarse enough that a gradient or a JPEG artefact
 *  collapses into the colour it is a shade of, and fine enough to keep two brand colours
 *  apart. Each bucket reports the MEAN of the pixels in it rather than the bucket's corner,
 *  so the hex that comes out is a colour that was actually on the page.
 *
 *  `minShare` drops the long tail of anti-aliasing, which is thousands of one-pixel colours
 *  that are not part of anybody's palette.
 */
export function palette(
  data: Uint8ClampedArray, opts: { max?: number; minShare?: number } = {},
): Swatch[] {
  const max = opts.max ?? 12;
  const minShare = opts.minShare ?? 0.004;
  const bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 200) continue; // transparent pixels are not a colour anyone chose
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const e = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    bins.set(key, e);
    total++;
  }
  if (!total) return [];
  return [...bins.values()]
    .map((e) => {
      const r = Math.round(e.r / e.n), g = Math.round(e.g / e.n), b = Math.round(e.b / e.n);
      return { hex: toHex(r, g, b), share: e.n / total, sat: saturation(r, g, b), lum: luminance(r, g, b) };
    })
    .filter((s) => s.share >= minShare)
    .sort((a, b) => b.share - a.share)
    .slice(0, max);
}

/** A first guess at which swatch is which token, offered rather than applied.
 *
 *  Deliberately crude, and deliberately labelled as a guess in the UI: a screenshot knows
 *  its colours exactly and knows nothing about which one is the button. The person looking
 *  at the picture does, and reassigning is one click.
 *
 *  The rules are the only ones a flat image supports: the biggest area is the page, the
 *  darkest ink is the text, and the most saturated colour that is not the page is the brand.
 */
export function suggestTokens(sw: Swatch[]): Record<string, string> {
  if (!sw.length) return {};
  const canvas = sw[0];
  const rest = sw.filter((s) => s.hex !== canvas.hex);
  const text = [...sw].sort((a, b) => a.lum - b.lum)[0];
  const brand = [...rest].sort((a, b) => b.sat * (0.4 + b.share) - a.sat * (0.4 + a.share))[0];
  const accent = [...rest].filter((s) => s.hex !== brand?.hex).sort((a, b) => b.sat - a.sat)[0];
  const out: Record<string, string> = {};
  if (canvas) out.Widget_Background = canvas.hex;
  if (canvas) out.Brand_Secondary = canvas.hex;
  if (text) out.Product_Tile = text.hex;
  if (brand) out.Brand_Primary = brand.hex;
  if (accent) out.Brand_Accent = accent.hex;
  return out;
}
