/** The pilot sheet's dates were typed by hand into free-text cells, so the same day arrives
 *  as "11 Aug", "19 August", "13 Aug" or "12 Jul 2026". Nothing can sort that, compute days
 *  since, or drive a reminder off it. These parse the shapes actually present in the data
 *  into ISO, once, so the columns can become real date inputs. */

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

/** The pilot ran through 2026. A bare "19 May" means 2026 unless a year is written out. */
export const DEFAULT_YEAR = 2026;

const pad = (n: number) => String(n).padStart(2, "0");

/** Returns ISO `yyyy-mm-dd`, or null when the text is not a date we recognise. Never
 *  guesses beyond the missing year: a value it cannot read is left alone rather than
 *  silently turned into the wrong day. */
export function parseLoose(raw: string | null | undefined): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // 19 May / 19 May 2026 / 19th August
  let m = v.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\.?(?:\s+(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3] || DEFAULT_YEAR}-${pad(mo)}-${pad(Number(m[1]))}`;
  }
  // May 19 / August 19 2026
  m = v.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) return `${m[3] || DEFAULT_YEAR}-${pad(mo)}-${pad(Number(m[2]))}`;
  }
  // 12/07/2026 and 12-07-2026, read day-first as the sheet does
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;

  return null;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86400000);
}

/** "19 May" for the current year, "19 May 25" when it is not, so a column of dates reads
 *  as quickly as the hand-typed ones did without losing the year when it matters. */
export function fmtShort(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const thisYear = new Date().getFullYear();
  return `${d} ${MON[m - 1]}${y === thisYear ? "" : " " + String(y).slice(2)}`;
}
