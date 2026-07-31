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

/** The four roadmap states. `done` carries no priority: it is derived from the work. */
export type RoadmapState = "now" | "next" | "future" | "done";

export const STATES: { k: RoadmapState; word: string; p: number | null }[] = [
  { k: "now", word: "Now", p: 1 },
  { k: "next", word: "Next", p: 2 },
  { k: "future", word: "Future", p: 3 },
  { k: "done", word: "Done", p: null },
];

/** Clamp a stored priority onto the three live horizons: 1 Now, 2 Next, 3 Future.
 *  Anything else, including the 4 / 5 / null that older data used for Later, Future and
 *  Backlog, lands on Future, which is where all three of those belonged anyway.
 *  The sheet's five words are folded down at generation time, not here: see
 *  data/gen_seed.py, where Then folds into Next and Later folds into Future. */
export function normPriority(p: number | null | undefined): 1 | 2 | 3 {
  return p === 1 ? 1 : p === 2 ? 2 : 3;
}

/** Which of the four states a milestone sits in. Done wins over the horizon: once every
 *  subtask is checked off, a milestone has shipped and no longer belongs on a horizon. */
export function stateOf(t: Node): RoadmapState {
  if (effStatus(t) === "done") return "done";
  const p = normPriority(t.priority);
  return p === 1 ? "now" : p === 2 ? "next" : "future";
}

/** Same rule one level down: a task counts as Done if it is checked off, or if the whole
 *  milestone it belongs to has shipped. Otherwise it counts under that milestone's horizon.
 *  Partitions every task exactly once, and keeps the header counts agreeing with the
 *  columns, where a milestone is placed by its rolled-up status. */
export function nodeState(n: Node, milestone: Node): RoadmapState {
  if (n.status === "done") return "done";
  const ms = stateOf(milestone);
  return ms === "done" ? "done" : ms;
}

export function waveWord(p: number | null | undefined): string {
  const pp = normPriority(p);
  for (const w of PRIORITIES) if (w.p === pp) return w.word;
  return "Future";
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
