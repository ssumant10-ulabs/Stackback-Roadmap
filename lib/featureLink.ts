import type { Feature, Node } from "./types";
import { effStatus, subtreeCounts } from "./derive";
import { FEATURE_TASK_MAP, FEATURE_TITLE_MAP } from "./featureMap";

/** Board status expressed in the sheet's own vocabulary, so a synced row reads the same
 *  way as an unsynced one. */
export function boardStatusOf(task: Node): string {
  const es = effStatus(task);
  if (es === "done") return "Done";
  if (es === "progress") {
    const c = subtreeCounts(task);
    return c.total && c.done === 0 ? "In Design" : "In Dev";
  }
  return "Planned";
}

const norm = (s: string) =>
  (s || "").toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Match a feature to the roadmap task that delivers it. Exact normalised title first,
 *  then containment either way, which is what catches "Autodebit" against "Autodebit" and
 *  "Event tracking to be setup" against "Event tracking to be set up". Deliberately
 *  conservative: a wrong link is worse than no link, because it would show a status the
 *  feature does not actually have. */
export function matchTask(feature: Feature, tasks: Node[]): Node | null {
  /* The hand-map wins. An explicit null there means "not on the roadmap yet" and must not
     fall through to fuzzy matching, or it would attach to something merely similar. */
  const mapped = feature.ref && feature.ref in FEATURE_TASK_MAP
    ? FEATURE_TASK_MAP[feature.ref]
    : (feature.title in FEATURE_TITLE_MAP ? FEATURE_TITLE_MAP[feature.title] : undefined);
  if (mapped === null) return null;
  if (typeof mapped === "string") {
    const flatAll: Node[] = [];
    const w = (ns: Node[]) => ns.forEach((n) => { flatAll.push(n); w(n.children || []); });
    w(tasks);
    const hit = flatAll.find((n) => n.title === mapped);
    if (hit) return hit;
  }

  const target = norm(feature.title);
  if (target.length < 6) return null;
  const flat: Node[] = [];
  const walk = (ns: Node[]) => ns.forEach((n) => { flat.push(n); walk(n.children || []); });
  walk(tasks);

  const exact = flat.find((n) => norm(n.title) === target);
  if (exact) return exact;

  const contains = flat
    .filter((n) => {
      const t = norm(n.title);
      return t.length > 8 && (t.includes(target) || target.includes(t));
    })
    .sort((a, b) => Math.abs(norm(a.title).length - target.length) - Math.abs(norm(b.title).length - target.length));
  if (contains[0]) return contains[0];

  /* Containment misses near-misses that are obviously the same thing, like
     "Event tracking to be setup" against "Event tracking to be set up". Fall back to
     token overlap, ignoring filler words, and only accept a strong match: a loose
     threshold here would attach a feature to the wrong task and report a status that
     is not its own. */
  const STOP = new Set(["the","a","an","to","of","for","and","in","on","with","be","is","its","by","or","from","as","at"]);
  const toks = (v: string) => new Set(norm(v).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
  const want = toks(feature.title);
  if (want.size < 2) return null;

  let best: { node: Node; score: number } | null = null;
  for (const n of flat) {
    const have = toks(n.title);
    if (have.size < 2) continue;
    let shared = 0;
    want.forEach((w) => { if (have.has(w)) shared++; });
    if (!shared) continue;
    const score = shared / Math.max(want.size, have.size);
    if (!best || score > best.score) best = { node: n, score };
  }
  return best && best.score >= 0.65 ? best.node : null;
}

export function autoLink(features: Feature[], tasks: Node[]): number {
  let n = 0;
  features.forEach((f) => {
    if (f.taskId) return;
    const hit = matchTask(f, tasks);
    if (hit) { f.taskId = hit.id; f.taskTitle = hit.title; n++; }
  });
  return n;
}

/** True when the sheet and the board disagree about where a feature has got to. */
export function isDrifted(f: Feature, boardStatus: string | null): boolean {
  if (!boardStatus || !f.sheetStatus) return false;
  return f.sheetStatus.toLowerCase() !== boardStatus.toLowerCase();
}
