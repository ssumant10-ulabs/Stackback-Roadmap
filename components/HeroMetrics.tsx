"use client";
import { useStore } from "@/lib/store";
import { STATES, effStatus, nodeState, type RoadmapState } from "@/lib/derive";
import { TEAM_ORDER } from "@/lib/constants";
import type { Node } from "@/lib/types";

function walkAll(nodes: Node[], cb: (n: Node) => void) {
  nodes.forEach((n) => { cb(n); walkAll(n.children || [], cb); });
}

export function HeroMetrics() {
  const s = useStore();
  const tasks = s.tasks;
  let total = 0, done = 0, prog = 0;
  walkAll(tasks, (n) => { total++; if (n.status === "done") done++; else if (n.status === "progress") prog++; });
  const planned = total - done - prog;
  /** Every task and subtask placed in exactly one of the four states: Done if it is
   *  checked off, otherwise the state of the milestone it belongs to. The four numbers
   *  add up to the task total. */
  const perState: Record<RoadmapState, number> = { now: 0, next: 0, future: 0, done: 0 };
  tasks.forEach((ms) => walkAll([ms], (n) => { perState[nodeState(n, ms)]++; }));
  const horizons = STATES.map((st) => ({ key: st.k, word: st.word, n: perState[st.k] }));
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
      <div className="hm-horizons" title="Every task and subtask, split across the four states">
        {horizons.map((h) => (
          <div className="hm-horizon" key={h.key} data-word={h.word}><b>{h.n}</b><span>{h.word}</span></div>
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
