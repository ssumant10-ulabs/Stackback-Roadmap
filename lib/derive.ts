import type { Counts, Node, Status } from "./types";
import { PRIORITIES } from "./constants";

export function subtreeCounts(n: Node): Counts {
  let t = 0, d = 0, p = 0;
  for (const c of n.children || []) {
    t++;
    if (c.status === "done") d++;
    else if (c.status === "progress") p++;
    const s = subtreeCounts(c);
    t += s.total; d += s.done; p += s.prog;
  }
  return { total: t, done: d, prog: p };
}

export function effStatus(node: Node): Status {
  const c = subtreeCounts(node);
  if (c.total > 0) {
    if (c.done === c.total) return "done";
    if (c.done > 0 || c.prog > 0 || node.status === "progress") return "progress";
    return "planned";
  }
  return node.status;
}

export function pctOf(node: Node): number {
  const c = subtreeCounts(node);
  if (c.total > 0) return Math.round((c.done / c.total) * 100);
  return node.status === "done" ? 100 : node.status === "progress" ? 50 : 0;
}

export function aggProgress(items: Node[]) {
  let t = 0, d = 0;
  for (const it of items) {
    const c = subtreeCounts(it);
    t += c.total + 1;
    d += c.done + (it.status === "done" ? 1 : 0);
  }
  return { total: t, done: d, pct: t ? Math.round((d / t) * 100) : 0 };
}

export function tally(items: Node[]) {
  const o = { planned: 0, progress: 0, done: 0 };
  for (const it of items) o[effStatus(it)]++;
  return o;
}

export function inflightLeaves(task: Node): string[] {
  const out: string[] = [];
  const rec = (n: Node) => {
    for (const c of n.children || []) {
      if ((c.children || []).length === 0) { if (c.status === "progress") out.push(c.title); }
      else rec(c);
    }
  };
  rec(task);
  return out;
}

export function waveWord(p: number | null | undefined): string {
  const pp = p == null ? null : p;
  for (const w of PRIORITIES) if (w.p === pp) return w.word;
  return "Backlog";
}

export function bucketOf(p: number | null | undefined): "now" | "next" | "later" {
  const pp = p == null ? null : p;
  if (pp === 1) return "now";
  if (pp === 2 || pp === 3) return "next";
  return "later";
}

export function milestoneDone(t: Node): boolean {
  return effStatus(t) === "done";
}

export function statusLabel(s: Status): string {
  return s === "done" ? "Done" : s === "progress" ? "In progress" : "Planned";
}

export function initials(name: string): string {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
