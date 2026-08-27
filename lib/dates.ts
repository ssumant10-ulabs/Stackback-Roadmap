import type { Node } from "./types";

/** Every date in the roadmap is a plain ISO `yyyy-mm-dd` day, never a timestamp.
 *  Parsing goes through UTC noon so a browser in any timezone lands on the same day,
 *  which is the bug you get from `new Date("2026-09-01")` in a negative-offset zone. */

const DAY = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isIso(v: string | null | undefined): boolean {
  return !!v && ISO.test(v);
}

export function parseDay(v: string | null | undefined): number | null {
  if (!isIso(v)) return null;
  const [y, m, d] = (v as string).split("-").map(Number);
  const t = Date.UTC(y, m - 1, d, 12);
  return Number.isNaN(t) ? null : t;
}

export function toIso(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

export function addDays(iso: string, n: number): string | null {
  const t = parseDay(iso);
  return t === null ? null : toIso(t + n * DAY);
}

/** Inclusive span: a task that starts and ends on the same day has a TAT of 1. */
export function spanDays(startIso: string, endIso: string): number | null {
  const a = parseDay(startIso), b = parseDay(endIso);
  if (a === null || b === null) return null;
  return Math.round((b - a) / DAY) + 1;
}

/** Resolve the three fields against each other. Whichever two are known define the third;
 *  `edited` says which field the user just touched so it is never the one overwritten. */
export function reconcile(
  input: { start?: string | null; end?: string | null; tat?: number | null },
  edited: "start" | "end" | "tat",
): { start: string | null; end: string | null; tat: number | null } {
  let start = isIso(input.start) ? (input.start as string) : null;
  let end = isIso(input.end) ? (input.end as string) : null;
  let tat = typeof input.tat === "number" && input.tat > 0 ? Math.round(input.tat) : null;

  if (start && end) {
    const s = spanDays(start, end);
    if (s !== null && s < 1) {
      // End before start. Trust the field just edited and push the other one.
      if (edited === "end") start = end;
      else end = start;
    }
  }

  if (edited === "tat" && tat) {
    if (start) end = addDays(start, tat - 1);
    else if (end) start = addDays(end, -(tat - 1));
  } else if (start && end) {
    tat = spanDays(start, end);
  } else if (tat && start) {
    end = addDays(start, tat - 1);
  } else if (tat && end) {
    start = addDays(end, -(tat - 1));
  }

  return { start, end, tat };
}

export interface Range {
  start: string;
  end: string;
  /** true when the window came from the subtree rather than from this node. */
  implied: boolean;
}

/** A node's own window if it has one, otherwise the envelope of every dated descendant.
 *  Returns null when nothing in the subtree carries a date. */
export function effRange(n: Node): Range | null {
  if (isIso(n.start) && isIso(n.end)) return { start: n.start as string, end: n.end as string, implied: false };

  // Held in an object rather than two `let`s: the accumulation happens inside closures,
  // where control-flow narrowing would otherwise keep insisting both are still null.
  const box: { lo: number | null; hi: number | null } = { lo: null, hi: null };
  const own = (v: string | null | undefined) => (isIso(v) ? parseDay(v) : null);
  const consider = (a: number | null, b: number | null) => {
    if (a !== null && (box.lo === null || a < box.lo)) box.lo = a;
    if (b !== null && (box.hi === null || b > box.hi)) box.hi = b;
  };

  // A single-sided window on the node itself still counts.
  consider(own(n.start), own(n.end));

  const walk = (x: Node) => {
    for (const c of x.children || []) {
      const r = effRange(c);
      if (r) consider(parseDay(r.start), parseDay(r.end));
      else walk(c);
    }
  };
  walk(n);

  const { lo, hi } = box;
  if (lo === null && hi === null) return null;
  const s = lo === null ? hi : lo;
  const e = hi === null ? lo : hi;
  if (s === null || e === null) return null;
  return { start: toIso(s), end: toIso(e), implied: !(isIso(n.start) && isIso(n.end)) };
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDay(iso: string, withYear = false): string {
  const t = parseDay(iso);
  if (t === null) return iso;
  const d = new Date(t);
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${withYear ? " " + String(d.getUTCFullYear()).slice(2) : ""}`;
}

/** "12 Sep → 3 Oct", collapsing to a single day when the window is one day long. */
export function fmtRange(start: string, end: string): string {
  if (start === end) return fmtDay(start);
  const a = parseDay(start), b = parseDay(end);
  const crossYear = a !== null && b !== null && new Date(a).getUTCFullYear() !== new Date(b).getUTCFullYear();
  return `${fmtDay(start, crossYear)} → ${fmtDay(end, true)}`;
}

export function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Months spanned by a window, as `{ iso: first-of-month, label, days }`, for a Gantt header. */
export function monthsBetween(startIso: string, endIso: string): { key: string; label: string; days: number }[] {
  const a = parseDay(startIso), b = parseDay(endIso);
  if (a === null || b === null) return [];
  const out: { key: string; label: string; days: number }[] = [];
  const d = new Date(a);
  let y = d.getUTCFullYear(), m = d.getUTCMonth();
  const endD = new Date(b);
  const endY = endD.getUTCFullYear(), endM = endD.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    const first = Date.UTC(y, m, 1, 12);
    const last = Date.UTC(y, m + 1, 0, 12);
    const from = Math.max(first, a);
    const to = Math.min(last, b);
    out.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: `${MON[m]} ${String(y).slice(2)}`,
      days: Math.round((to - from) / DAY) + 1,
    });
    m++;
    if (m > 11) { m = 0; y++; }
  }
  return out;
}

/** Where a day sits inside a window, 0 to 1. Used to place Gantt bars. */
export function frac(dayIso: string, winStart: string, winEnd: string): number {
  const d = parseDay(dayIso), a = parseDay(winStart), b = parseDay(winEnd);
  if (d === null || a === null || b === null || b === a) return 0;
  return Math.min(1, Math.max(0, (d - a) / (b - a)));
}

export function isOverdue(n: Node, ref = todayIso()): boolean {
  const end = isIso(n.end) ? (n.end as string) : null;
  if (!end) return false;
  const a = parseDay(end), b = parseDay(ref);
  return a !== null && b !== null && a < b;
}
