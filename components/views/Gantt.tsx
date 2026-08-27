"use client";
import { CSSProperties, useMemo } from "react";
import { useStore } from "@/lib/store";
import { effStatus, stateOf, subtreeCounts, waveWord } from "@/lib/derive";
import { effRange, fmtRange, frac, monthsBetween, parseDay, todayIso } from "@/lib/dates";
import type { Node } from "@/lib/types";
import { OwnerAvatars, StatusDot } from "../bits";
import { useAppUi } from "../appui";

interface Row {
  node: Node;
  depth: number;
  range: { start: string; end: string; implied: boolean } | null;
}

/** Milestones, plus their dated subtasks one level down. Deeper than that a Gantt turns
 *  into a wall, and the Board is the right surface for leaf-level detail. */
function buildRows(tasks: Node[], openIds: Record<string, boolean>): Row[] {
  const out: Row[] = [];
  tasks.forEach((t) => {
    out.push({ node: t, depth: 0, range: effRange(t) });
    if (openIds[t.id]) {
      (t.children || []).forEach((c) => out.push({ node: c, depth: 1, range: effRange(c) }));
    }
  });
  return out;
}

const DAY_MIN_PX = 3.2;

export function Gantt() {
  const s = useStore();
  const ui = useAppUi();
  const tasks = s.viewTasks;
  const open = s.ui.boardOpen;
  // The store mutates ui.boardOpen in place, so its identity never changes. The version
  // counter is what actually tells us the disclosure set moved.
  const version = s.getSnapshot();

  const rows = useMemo(() => buildRows(tasks, open), [tasks, open, version]);
  const dated = rows.filter((r) => r.range);
  // Milestones with no window at all are listed under the chart instead of taking an empty
  // row in it. Dateless SUBTASKS keep their row, so expanding a milestone still shows all
  // of its parts rather than silently hiding the unscheduled ones.
  const undated = rows.filter((r) => !r.range && r.depth === 0);

  const today = todayIso();

  const win = useMemo(() => {
    if (!dated.length) return null;
    let lo = dated[0].range!.start, hi = dated[0].range!.end;
    dated.forEach((r) => {
      if (r.range!.start < lo) lo = r.range!.start;
      if (r.range!.end > hi) hi = r.range!.end;
    });
    // Pad to whole months so the header reads cleanly, and always include today.
    if (today < lo) lo = today;
    if (today > hi) hi = today;
    const a = parseDay(lo)!, b = parseDay(hi)!;
    const s0 = new Date(a), e0 = new Date(b);
    const start = `${s0.getUTCFullYear()}-${String(s0.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(e0.getUTCFullYear(), e0.getUTCMonth() + 1, 0, 12));
    const end = `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDay.getUTCDate()).padStart(2, "0")}`;
    return { start, end };
  }, [dated, today]);

  if (!tasks.length) return <div className="roadmap"><p className="rm-intro">No matching items.</p></div>;

  if (!win) {
    return (
      <div className="gantt-empty">
        <h3>No dates yet</h3>
        <p>Give a milestone or subtask a start, an end or a TAT and it appears here. Open the Board and click the clock on any card.</p>
        <button type="button" className="btn primary" onClick={() => s.setView("board")}>Go to the Board</button>
      </div>
    );
  }

  const months = monthsBetween(win.start, win.end);
  const totalDays = months.reduce((a, m) => a + m.days, 0);
  const gridWidth = Math.max(640, Math.round(totalDays * DAY_MIN_PX));
  const pos = (iso: string) => frac(iso, win.start, win.end) * 100;
  const todayPct = today >= win.start && today <= win.end ? pos(today) : null;

  return (
    <>
      <div className="view-toolbar">
        <div className="vt-note">
          Real dates, not horizons. A bar is a task&apos;s own window; a hollow bar is rolled up from its
          subtasks. Click a milestone name to show or hide its subtasks, or a bar to jump to that card.
        </div>
      </div>
      <div className="gantt">
        <div className="gantt-scroll">
          <div className="gantt-inner" style={{ "--grid-w": gridWidth + "px" } as CSSProperties}>
            <div className="gantt-head">
              <div className="gh-label">Milestone</div>
              <div className="gh-grid">
                {months.map((m) => (
                  <div className="gh-month" key={m.key} style={{ width: (m.days / totalDays) * 100 + "%" }}>
                    <span>{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="gantt-body">
              {todayPct !== null && (
                <div className="g-today" style={{ left: `calc(var(--label-w) + (100% - var(--label-w)) * ${todayPct / 100})` }}>
                  <span>Today</span>
                </div>
              )}
              {rows.filter((r) => r.range || r.depth > 0).map((r) => {
                const n = r.node;
                const c = subtreeCounts(n);
                const es = effStatus(n);
                const pct = c.total ? Math.round((c.done / c.total) * 100) : es === "done" ? 100 : 0;
                const tv = s.helpers.teamVar(s.helpers.primaryTeam(n)) || "neutral";
                const hasKids = (n.children || []).length > 0;
                const late = r.range && r.range.end < today && es !== "done";
                return (
                  <div className={`g-row d${r.depth}`} key={n.id} data-node-id={n.id}>
                    <div className="g-label">
                      {r.depth === 0 && hasKids ? (
                        <button type="button" className={`g-twist${open[n.id] ? " open" : ""}`}
                          aria-label={open[n.id] ? "Hide subtasks" : "Show subtasks"}
                          onClick={() => s.toggleBoardOpen(n.id)}>▸</button>
                      ) : <span className="g-twist-spacer" />}
                      <StatusDot status={es} />
                      <span className="g-title" onClick={() => ui.jumpToCard(n.id)}>{n.title}</span>
                      {r.depth === 0 && <span className="g-wave">{stateOf(n) === "done" ? "Done" : waveWord(n.priority)}</span>}
                    </div>
                    <div className="g-track">
                      {r.range ? (
                        <div
                          className={`g-bar${r.range.implied ? " implied" : ""}${es === "done" ? " done" : ""}${late ? " late" : ""}`}
                          style={{
                            left: pos(r.range.start) + "%",
                            width: Math.max(1.2, pos(r.range.end) - pos(r.range.start)) + "%",
                            "--tc": `var(--team-${tv})`,
                          } as CSSProperties}
                          title={`${n.title}\n${fmtRange(r.range.start, r.range.end)}${r.range.implied ? " (rolled up)" : ""}${c.total ? `\n${c.done}/${c.total} done` : ""}`}
                          onClick={() => ui.jumpToCard(n.id)}
                        >
                          <span className="g-fill" style={{ width: pct + "%" }} />
                          <span className="g-bar-lbl">{fmtRange(r.range.start, r.range.end)}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {undated.length > 0 && (
          <div className="g-undated">
            <h4>No dates set ({undated.length})</h4>
            <div className="g-undated-list">
              {undated.map((r) => (
                <button type="button" key={r.node.id} className="g-undated-chip" onClick={() => ui.jumpToCard(r.node.id)}>
                  <StatusDot status={effStatus(r.node)} />{r.node.title}
                  <span className="g-owners"><OwnerAvatars task={r.node} /></span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
