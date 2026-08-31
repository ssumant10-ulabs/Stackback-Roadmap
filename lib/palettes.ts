/** Preset colour ramps. Each swaps only the brand and accent tokens: surfaces, ink and
 *  the status colours are untouched, so contrast holds and green/amber/red keep meaning
 *  whichever is chosen. Stored per browser like the theme, since it is a preference. */
export const PALETTES: { id: string; label: string; swatch: string }[] = [
  { id: "lime", label: "Lime", swatch: "#C8F980" },
  { id: "indigo", label: "Indigo", swatch: "#B9C8FF" },
  { id: "amber", label: "Amber", swatch: "#FFD27A" },
  { id: "teal", label: "Teal", swatch: "#8FE3D8" },
  { id: "rose", label: "Rose", swatch: "#FFB3C7" },
  { id: "slate", label: "Slate", swatch: "#C9D2DC" },
];

export type PaletteId = (typeof PALETTES)[number]["id"];
