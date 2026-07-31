"use client";
import { useStore } from "@/lib/store";
import { effStatus } from "@/lib/derive";
import { PRIORITIES, TEAM_ORDER } from "@/lib/constants";
import type { Node } from "@/lib/types";

function walkAll(nodes: Node[], cb: (n: Node) => void) {
  nodes.forEach((n) => { cb(n); walkAll(n.children || [], cb); });
}
function countIn(nodes: Node[]): number {
  let n = 0;
  walkAll(nodes, () => n++);
  return n;
}

export function HeroMetrics() {
  const s = useStore();
  const tasks = s.tasks;
  let total = 0, done = 0, prog = 0;
  walkAll(tasks, (n) => { total++; if (n.status === "done") done++; else if (n.status === "progress") prog++; });
  const planned = total - done - prog;
  /** Items per horizon, counted the same way the roadmap sheet counts them: every
   *  task and subtask under the milestones sitting in that horizon. */
  const horizons = PRIORITIES
    .map((w) => ({ word: w.word, n: countIn(tasks.filter((t) => (t.priority || null) === w.p)) }))
    .filter((h) => h.n > 0);
  const pd = total ? (done / total) * 100 : 0;
  const pp = total ? (prog / total) * 100 : 0;
  const pl = total ? (planned / total) * 100 : 0;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const msTotal = tasks.length;
  const msDone = tasks.filter((t) => effStatus(t) === "done").length;

  return (
    <div className="hero-metrics">
      <div className="hm-lead"><span className="hm-pct">{pct}%</span><span className="lbl">complete</span></div>
      <div className="hm-mid">
        <div className="hm-bar">
          <span className="hm-seg done" style={{ width: pd + "%" }} />
          <span className="hm-seg prog" style={{ width: pp + "%" }} />
          <span className="hm-seg plan" style={{ width: pl + "%" }} />
        </div>
        <div className="hm-sub">
          <span><i className="d" />Done {done}</span>
          <span><i className="p" />In progress {prog}</span>
          <span><i className="l" />Planned {planned}</span>
          <span className="hm-pips" title="One marker per milestone">
            {tasks.map((t) => <span key={t.id} className={`hm-pip ${effStatus(t)}`} title={t.title} />)}
          </span>
        </div>
      </div>
      <div className="hm-horizons" title="Tasks and subtasks per horizon">
        {horizons.map((h) => (
          <div className="hm-horizon" key={h.word} data-word={h.word}><b>{h.n}</b><span>{h.word}</span></div>
        ))}
      </div>
      <div className="hm-stats">
        <div className="hm-stat"><b>{msDone}/{msTotal}</b><span>Milestones</span></div>
        <div className="hm-stat"><b>{total}</b><span>Tasks</span></div>
        <div className="hm-stat"><b>{TEAM_ORDER.length}</b><span>Teams</span></div>
      </div>
    </div>
  );
}
