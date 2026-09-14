/** Draw the plan sheet straight onto a canvas.
 *
 *  The obvious route, html-to-image, serialises the DOM into an SVG <foreignObject> and
 *  loads it through an <img>. That image never fires onload in every browser, and when it
 *  does not there is no error to catch: the promise simply never settles, which is a button
 *  that says "making the image" forever. It timed out here on a subtree of forty nodes.
 *
 *  So this draws the sheet itself. More code, but it cannot hang, it needs no dependency,
 *  and the output is identical everywhere because nothing is inherited from the page. */
import { parseBands, parseFreebies, parseList, type Answers } from "./questions";
import { DEFAULT_CONFIG } from "./sim";
import type { WidgetSettings } from "./widget";
import { ALL_TOGGLES } from "./widget";
import { CATEGORY_BY_ID, SCALE_BY_ID, freqWord } from "./categories";

const W = 880;
const PAD = 44;
const INK = "#16200f";
const MUTED = "#6b7563";
const SOFT = "#59634f";
const RULE = "#e2e4de";
const PANEL = "#f3f5ef";
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const money = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const MODE_NAME: Record<string, string> = {
  prepaid: "Prepaid", payg: "Pay as you go", auto_debit: "Pay per delivery",
};

interface Ctx { c: CanvasRenderingContext2D; y: number }

function font(c: CanvasRenderingContext2D, size: number, weight = 400, spacing = 0) {
  c.font = `${weight} ${size}px ${FONT}`;
  c.letterSpacing = `${spacing}px`;
}

function text(t: Ctx, s: string, x: number, size: number, weight: number, color: string, align: CanvasTextAlign = "left") {
  font(t.c, size, weight);
  t.c.fillStyle = color;
  t.c.textAlign = align;
  t.c.fillText(s, x, t.y);
}

/** Word-wrap, returning the height used, so a long rationale cannot run off the sheet. */
function wrap(t: Ctx, s: string, x: number, max: number, size: number, color: string, lh = 1.6): number {
  font(t.c, size, 400);
  t.c.fillStyle = color;
  t.c.textAlign = "left";
  const words = s.split(" ");
  let line = "";
  let used = 0;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (t.c.measureText(next).width > max && line) {
      t.c.fillText(line, x, t.y + used);
      used += size * lh;
      line = w;
    } else line = next;
  }
  if (line) { t.c.fillText(line, x, t.y + used); used += size * lh; }
  return used;
}

function rule(t: Ctx, color = RULE, weight = 1) {
  t.c.fillStyle = color;
  t.c.fillRect(PAD, t.y, W - PAD * 2, weight);
}

function label(t: Ctx, s: string, x = PAD) {
  font(t.c, 11, 700, 1);
  t.c.fillStyle = MUTED;
  t.c.textAlign = "left";
  t.c.fillText(s.toUpperCase(), x, t.y);
  t.c.letterSpacing = "0px";
}

/** Two passes: measure with a throwaway context to size the canvas, then draw. Guessing a
 *  height and cropping the rationale is how an export loses the half that matters. */
export function drawPlanSheet(answers: Answers, settings?: WidgetSettings): HTMLCanvasElement {
  const measure = document.createElement("canvas").getContext("2d");
  if (!measure) throw new Error("no canvas");
  const height = render({ c: measure, y: 0 }, answers, true, settings);

  const canvas = document.createElement("canvas");
  const ratio = 2;
  canvas.width = W * ratio;
  canvas.height = Math.ceil(height) * ratio;
  const c = canvas.getContext("2d");
  if (!c) throw new Error("no canvas");
  c.scale(ratio, ratio);
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, W, height);
  render({ c, y: 0 }, answers, false, settings);
  return canvas;
}

function render(t: Ctx, a: Answers, dry: boolean, settings?: WidgetSettings): number {
  const draw = !dry;
  const cat = CATEGORY_BY_ID.get(String(a.category || ""));
  const scale = SCALE_BY_ID.get(String(a.scale || ""));
  const runs = parseList(a.deliveries);
  const bands = parseBands(a.bands);
  const tiered = a.tiered === "yes";
  const flat = Number(a.discount_pct) || 0;
  /* The form stopped asking for a price: the preview is of a dummy product, and a real one
   * invited a figure nobody could check. The sheet quotes the same illustrative price the
   * widget does, and says so. */
  const price = DEFAULT_CONFIG.unitPrice;
  const freqs = (Array.isArray(a.every_days) ? a.every_days : []).map((d) => freqWord(Number(d)));
  const modes = (Array.isArray(a.modes) ? a.modes : []).map((m) => MODE_NAME[m] || m);
  const shipping = a.shipping_charged !== "yes" ? "Free on every delivery"
    : `${money(Number(a.shipping_rate) || 0)} per delivery on orders below ${money(Number(a.shipping_threshold) || 0)}`;
  const scopeLine = a.scope_kind === "products" ? "Named products"
    : a.scope_kind === "collection" ? "A collection" : "All products";

  /* ---------- header ---------- */
  t.y = 56;
  if (draw) label(t, "StackBack subscription plans");
  t.y += 24;
  if (draw) text(t, String(a.brand_name || "Your brand"), PAD, 30, 800, INK);
  t.y += 22;
  const sub = [cat?.label, scale?.label].filter(Boolean).join("   ·   ");
  if (draw && sub) text(t, sub, PAD, 14, 400, SOFT);
  if (draw) {
    font(t.c, 12.5, 400);
    t.c.fillStyle = MUTED; t.c.textAlign = "right";
    t.c.fillText(new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }), W - PAD, t.y - 22);
  }
  t.y += 18;
  if (draw) rule(t, INK, 2);
  t.y += 34;

  /* ---------- plans ---------- */
  if (draw) label(t, "The plans");
  t.y += 22;
  const cols = [PAD, PAD + 170, PAD + 330, W - PAD - 150, W - PAD];
  if (draw) {
    label(t, "Plan", cols[0]); label(t, "Frequency", cols[1]); label(t, "Discount", cols[2]);
    font(t.c, 11, 700, 1); t.c.fillStyle = MUTED; t.c.textAlign = "right";
    t.c.fillText("PER DELIVERY", cols[3], t.y); t.c.fillText("RUN TOTAL", cols[4], t.y);
    t.c.letterSpacing = "0px";
  }
  t.y += 10;
  for (const r of runs) {
    if (draw) rule(t);
    t.y += 22;
    const pct = tiered ? (bands[r] ?? flat) : flat;
    const per = price * (1 - pct / 100);
    if (draw) {
      text(t, `${r} deliveries`, cols[0], 14, 700, INK);
      text(t, freqs[0] || "Not set", cols[1], 14, 400, INK);
      text(t, `${pct}% off`, cols[2], 14, 400, INK);
      text(t, money(per), cols[3], 14, 400, INK, "right");
      text(t, money(per * r), cols[4], 14, 700, INK, "right");
    }
    t.y += 14;
  }
  if (draw) rule(t);
  t.y += 20;
  const gifts = parseFreebies(a.freebies);
  const note = `Priced against an illustrative ${money(price)} per delivery.` +
    (gifts.length ? ` Freebies: ${gifts.map((g) => `${g.product || "a gift"} on delivery ${g.delivery} of the ${g.run}-run`).join("; ")}.` : "") +
    (freqs.length > 1 ? ` Customers can also pick ${freqs.slice(1).join(" or ").toLowerCase()}.` : "");
  t.y += draw ? wrap(t, note, PAD, W - PAD * 2, 12.5, MUTED) : 20;
  t.y += 22;

  /* ---------- facts, two columns ---------- */
  const facts: [string, string, string?][] = [
    ["Scope", scopeLine, String(a.scope_detail || "")],
    ["Variants", a.variants === "all" ? "Every variant" : "Selected only", a.variants === "some" ? String(a.variants_detail || "") : ""],
    ["Payment", modes.join(", ") || "Not set"],
    ["Shipping", shipping],

  ];
  const colW = (W - PAD * 2 - 26) / 2;
  for (let i = 0; i < facts.length; i += 2) {
    const rowTop = t.y;
    let tallest = 0;
    for (const [ci, f] of [facts[i], facts[i + 1]].entries()) {
      if (!f) continue;
      const x = PAD + ci * (colW + 26);
      t.y = rowTop;
      if (draw) { t.c.fillStyle = RULE; t.c.fillRect(x, t.y, colW, 1); }
      t.y += 16;
      if (draw) label(t, f[0], x);
      t.y += 19;
      if (draw) text(t, f[1], x, 14.5, 600, INK);
      let used = 0;
      if (f[2]) { t.y += 18; used = draw ? wrap(t, f[2], x, colW, 13, SOFT) : 18; }
      tallest = Math.max(tallest, t.y - rowTop + used);
    }
    t.y = rowTop + tallest + 16;
  }

  /* ---------- suggester ---------- */
  if (cat || scale) {
    t.y += 8;
    const panelTop = t.y;
    let inner = t.y + 26;
    const ix = PAD + 20;
    const iw = W - PAD * 2 - 40;
    const blocks: [string, string, string][] = [];
    if (cat) blocks.push([cat.label,
      `${cat.everyDays.map(freqWord).join(", ").toLowerCase()}  ·  ${cat.deliveries.join(", ")} deliveries  ·  ${cat.deliveries.map((d, i) => `${cat.discounts[i]}% at ${d}`).join(", ")}`,
      cat.why]);
    if (scale) blocks.push([scale.hint, scale.modes.map((m) => MODE_NAME[m]).join(", "), scale.why]);

    // Measure the panel before painting it, so the background sits behind the text.
    const probe = { c: t.c, y: inner };
    let h = 0;
    for (const [, line, why] of blocks) {
      h += 20 + 18;
      font(probe.c, 12.5, 400);
      h += measureWrap(probe.c, line, iw, 13) + measureWrap(probe.c, why, iw, 12.5) + 22;
    }
    if (draw) {
      t.c.fillStyle = PANEL;
      roundRect(t.c, PAD, panelTop, W - PAD * 2, h + 34, 12);
      t.c.fill();
      t.y = inner;
      label(t, "What similar stores run", ix);
      inner = t.y + 22;
    }
    t.y = inner;
    for (const [head, line, why] of blocks) {
      if (draw) text(t, head, ix, 15, 700, INK);
      t.y += 20;
      t.y += draw ? wrap(t, line, ix, iw, 13, "#40483a") : measureWrap(t.c, line, iw, 13);
      t.y += 6;
      t.y += draw ? wrap(t, why, ix, iw, 12.5, SOFT) : measureWrap(t.c, why, iw, 12.5);
      t.y += 16;
    }
    t.y = panelTop + h + 34 + 8;
  }

  /* ---------- widget settings snapshot ---------- */
  if (settings) {
    // Only what was changed from the default. A list of twenty rows all reading "off" tells
    // the reader nothing; the three that are on are the decisions somebody made.
    const changed = ALL_TOGGLES
      .map((d) => ({ d, v: settings[d.key] }))
      .filter(({ d, v }) => {
        if (d.kind === "text") return Boolean(String(v || "").trim());
        if (d.kind === "select") return true;
        return v === true;
      });
    t.y += 10;
    if (draw) label(t, "Widget settings");
    t.y += 20;
    if (changed.length === 0) {
      t.y += draw ? wrap(t, "Everything left at its default.", PAD, W - PAD * 2, 12.5, MUTED) : 20;
    } else {
      for (const { d, v } of changed) {
        if (draw) rule(t);
        t.y += 19;
        if (draw) {
          text(t, d.label, PAD, 13, 600, INK);
          const val = d.kind === "select"
            ? (d.options?.find((o) => o.value === v)?.label ?? String(v))
            : d.kind === "text" ? String(v) : "On";
          text(t, val, W - PAD, 13, 400, SOFT, "right");
        }
        t.y += 13;
      }
      if (draw) rule(t);
    }
    t.y += 16;
  }

  /* ---------- footer ---------- */
  t.y += 12;
  if (draw) rule(t);
  t.y += 22;
  const foot = "A starting point, not a final answer. Once we have read your order history we propose numbers from your own repeat gap, and those beat a category average every time.";
  t.y += draw ? wrap(t, foot, PAD, W - PAD * 2 - 160, 12, MUTED) : measureWrap(t.c, foot, W - PAD * 2 - 160, 12);
  t.y += 32;
  return t.y;
}

function measureWrap(c: CanvasRenderingContext2D, s: string, max: number, size: number, lh = 1.6): number {
  font(c, size, 400);
  const words = s.split(" ");
  let line = "", lines = 0;
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (c.measureText(next).width > max && line) { lines++; line = w; } else line = next;
  }
  if (line) lines++;
  return lines * size * lh;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
