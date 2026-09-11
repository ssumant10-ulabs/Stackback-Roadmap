/** WCAG contrast, for checking a store's own widget colours.
 *
 *  The preview draws in the store's brand, not this page's, so it can perfectly faithfully
 *  render something a customer cannot read. Better to say so on the call, while somebody is
 *  still choosing, than to ship it and find out from a support ticket. */

interface RGB { r: number; g: number; b: number }

export function hexToRgb(hex: string): RGB | null {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

const luminance = (c: RGB) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

export function contrast(fg: string, bg: string): number | null {
  const a = hexToRgb(fg), b = hexToRgb(bg);
  if (!a || !b) return null;
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface ContrastIssue { what: string; ratio: number; needs: number }

/** Only the pairs a customer actually has to read. Large display text gets the 3:1 bar,
 *  everything else 4.5:1. */
export function checkWidget(t: {
  text: { primary: string; secondary: string; muted: string };
  colors: { primary: string; savings: string; subscriptionAccent: string };
  surfaces: { widgetBackground: string; mutedSurface: string };
}): ContrastIssue[] {
  const pairs: [string, string, string, number][] = [
    ["Body text", t.text.primary, t.surfaces.widgetBackground, 4.5],
    ["Secondary text", t.text.secondary, t.surfaces.widgetBackground, 4.5],
    ["Muted text, the branding and strikethrough prices", t.text.muted, t.surfaces.widgetBackground, 4.5],
    ["Summary text on the shaded panel", t.text.secondary, t.surfaces.mutedSurface, 4.5],
    ["The saving, in green", t.colors.savings, t.surfaces.widgetBackground, 4.5],
    ["White on the discount badge", "#ffffff", t.colors.savings, 4.5],
    ["White on the button", "#ffffff", t.colors.primary, 4.5],
  ];
  const out: ContrastIssue[] = [];
  for (const [what, fg, bg, needs] of pairs) {
    const ratio = contrast(fg, bg);
    if (ratio !== null && ratio < needs) out.push({ what, ratio: Math.round(ratio * 100) / 100, needs });
  }
  return out;
}
