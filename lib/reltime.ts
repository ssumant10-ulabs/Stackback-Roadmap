/** "just now", "12m", "3h", "2d", then a plain date. Kept short: these render inside
 *  comment headers and activity rows where a full timestamp would dominate the line. */
export function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.round(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.round(h / 24);
  if (d < 8) return d + "d ago";
  const dt = new Date(t);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dt.getDate()} ${MON[dt.getMonth()]}`;
}
