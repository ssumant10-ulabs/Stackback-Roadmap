import type { Assignee, Filter, Node, Roster } from "./types";
import { TEAM_NEUTRAL, TEAM_ORDER, TEAM_VAR } from "./constants";
import { effStatus } from "./derive";

export interface WorkGroup {
  ms: Node;
  ownsMs: boolean;
  nodes: Node[];
}
export interface WorkSummary {
  groups: WorkGroup[];
  total: number;
  done: number;
  prog: number;
  pct: number;
}

export function makeHelpers(roster: Roster) {
  function teamOf(name: string): string | null {
    for (const t of Object.keys(roster)) if ((roster[t] || []).indexOf(name) >= 0) return t;
    return null;
  }
  function assigneeTeam(a: Assignee): string | null {
    if (a.isTeam) return TEAM_VAR[a.name] ? a.name : null;
    if (TEAM_NEUTRAL[a.name]) return null;
    return teamOf(a.name);
  }
  function teamVar(team: string | null): string {
    return team ? TEAM_VAR[team] || "neutral" : "neutral";
  }
  function teamSet(task: Node): string[] {
    const set: Record<string, 1> = {};
    const rec = (n: Node) => {
      for (const a of n.assignees || []) { const t = assigneeTeam(a); if (t) set[t] = 1; }
      for (const c of n.children || []) rec(c);
    };
    rec(task);
    return TEAM_ORDER.filter((t) => set[t]);
  }
  function primaryTeam(task: Node): string | null {
    const counts: Record<string, number> = {};
    const rec = (n: Node) => {
      for (const a of n.assignees || []) { const t = assigneeTeam(a); if (t) counts[t] = (counts[t] || 0) + 1; }
      for (const c of n.children || []) rec(c);
    };
    rec(task);
    let best: string | null = null, bn = 0;
    for (const t of TEAM_ORDER) if ((counts[t] || 0) > bn) { bn = counts[t]; best = t; }
    return best;
  }
  function subtreeHasAssignee(n: Node, match: (a: Assignee) => boolean): boolean {
    if ((n.assignees || []).some(match)) return true;
    return (n.children || []).some((c) => subtreeHasAssignee(c, match));
  }
  function matchFilter(n: Node, filter: Filter): boolean {
    if (!filter) return true;
    if (filter.type === "person") return subtreeHasAssignee(n, (a) => !a.isTeam && a.name === filter.name);
    return subtreeHasAssignee(n, (a) => assigneeTeam(a) === filter.name);
  }
  function teamNodesIn(task: Node, team: string): Node[] {
    const out: Node[] = [];
    const rec = (n: Node) => {
      for (const c of n.children || []) {
        if ((c.assignees || []).some((a) => assigneeTeam(a) === team)) out.push(c);
        rec(c);
      }
    };
    rec(task);
    return out;
  }
  function teamPeople(task: Node, team: string): Assignee[] {
    const seen: Record<string, 1> = {}; const out: Assignee[] = [];
    const rec = (n: Node) => {
      for (const a of n.assignees || []) {
        if (assigneeTeam(a) === team) { const k = (a.isTeam ? "T:" : "P:") + a.name; if (!seen[k]) { seen[k] = 1; out.push(a); } }
      }
      for (const c of n.children || []) rec(c);
    };
    rec(task);
    return out;
  }
  return { teamOf, assigneeTeam, teamVar, teamSet, primaryTeam, subtreeHasAssignee, matchFilter, teamNodesIn, teamPeople };
}

export type Helpers = ReturnType<typeof makeHelpers>;

/** Every node (any depth) directly assigned to a person, grouped by its milestone. */
export function personWork(tasks: Node[], name: string, h: Helpers, filter: Filter): WorkSummary {
  const groups: WorkGroup[] = [];
  let total = 0, done = 0, prog = 0;
  for (const ms of tasks) {
    if (!h.matchFilter(ms, filter)) continue;
    const ownsMs = (ms.assignees || []).some((a) => !a.isTeam && a.name === name);
    const nodes: Node[] = [];
    const rec = (n: Node) => {
      for (const c of n.children || []) {
        if ((c.assignees || []).some((a) => !a.isTeam && a.name === name)) nodes.push(c);
        rec(c);
      }
    };
    rec(ms);
    if (!ownsMs && !nodes.length) continue;
    const counted = ownsMs ? nodes.concat(ms) : nodes;
    for (const n of counted) { const es = effStatus(n); total++; if (es === "done") done++; else if (es === "progress") prog++; }
    groups.push({ ms, ownsMs, nodes });
  }
  return { groups, total, done, prog, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** Nodes whose own assignees resolve to this team, grouped by milestone. */
export function teamWork(tasks: Node[], team: string, h: Helpers, filter: Filter): WorkSummary {
  const groups: WorkGroup[] = [];
  let total = 0, done = 0, prog = 0;
  for (const ms of tasks) {
    if (!h.matchFilter(ms, filter)) continue;
    const ownsMs = (ms.assignees || []).some((a) => h.assigneeTeam(a) === team);
    const nodes: Node[] = [];
    const rec = (n: Node) => {
      for (const c of n.children || []) {
        if ((c.assignees || []).some((a) => h.assigneeTeam(a) === team)) nodes.push(c);
        rec(c);
      }
    };
    rec(ms);
    if (!ownsMs && !nodes.length) continue;
    const counted = ownsMs ? nodes.concat(ms) : nodes;
    for (const n of counted) { const es = effStatus(n); total++; if (es === "done") done++; else if (es === "progress") prog++; }
    groups.push({ ms, ownsMs, nodes });
  }
  return { groups, total, done, prog, pct: total ? Math.round((done / total) * 100) : 0 };
}
