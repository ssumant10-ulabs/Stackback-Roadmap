"use client";
import { useStore } from "@/lib/store";
import { SIMPLE_LABELS, SIMPLE_SUB, TEAM_ORDER, TEAM_SHORT, TEAM_VAR } from "@/lib/constants";
import { STATES, effStatus, stateOf, statusLabel, subtreeCounts } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { CommentChip, DateChip, OwnerAvatars, ReorderBtns, StatusDot } from "../bits";
import { CommentsThread } from "../CommentsThread";
import { IcChevron, IcTeam } from "../icons";
import { useAppUi } from "../appui";

function walkAll(nodes: Node[], cb: (n: Node) => void) {
  nodes.forEach((n) => { cb(n); walkAll(n.children || [], cb); });
}

function SimpleCard({ task }: { task: Node }) {
  const s = useStore();
  const h = s.helpers;
  const ui = useAppUi();
  const es = effStatus(task);
  const sl = SIMPLE_LABELS[task.title] || { simple: task.title, sub: "" };
  const c = subtreeCounts(task);
  const m = s.cardMoves(task);
  const pctv = c.total ? Math.round((c.done / c.total) * 100) : task.status === "done" ? 100 : 0;
  const kids = task.children || [];
  const open = s.ui.simpleOpen[task.id] === true;

  const parentTeam = h.primaryTeam(task);
  const groups: Record<string, Node[]> = {};
  const order: string[] = [];
  kids.forEach((k) => { const tm = h.primaryTeam(k) || parentTeam || "Unassigned"; if (!groups[tm]) { groups[tm] = []; order.push(tm); } groups[tm].push(k); });
  const laneOrder = TEAM_ORDER.filter((x) => groups[x]).concat(order.indexOf("Unassigned") >= 0 ? ["Unassigned"] : []);

  return (
    <li className={`simple-card${open ? " open" : ""}`} data-status={es}>
      <div className="sc-main" onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) ui.jumpToCard(task.id); }}>
        <span className="sdot" />
        <div>
          <div className="stitle">{sl.simple}</div>
          {sl.sub && <div className="ssub">{sl.sub}</div>}
          <div className="smeta">
            <span className="sword">{statusLabel(es)}</span>
            {es === "progress" && <span className="sbar"><span style={{ width: pctv + "%" }} /></span>}
            {c.total > 0 && <span>{c.done} of {c.total} done</span>}
            <DateChip node={task} />
            {task.deadline && <span className="rm-date-chip" title="Deadline">Due {task.deadline}</span>}
            {task.handover && <span className="rm-date-chip" title="Handover timeline">Handover {task.handover}</span>}
            <span className="sowners"><OwnerAvatars task={task} /></span>
            <CommentChip node={task} />
          </div>
        </div>
        <ReorderBtns id={task.id} up={m.up} down={m.down} />
      </div>
      {s.ui.commentsOpen[task.id] === true && (
        <div style={{ padding: "0 19px 4px" }}><CommentsThread node={task} /></div>
      )}
      {kids.length > 0 && (
        <button type="button" className="sc-detail-toggle" onClick={() => s.toggleSimpleOpen(task.id)}>
          <IcChevron />{open ? "Hide the breakdown" : `Show what's inside (${kids.length})`}
        </button>
      )}
      {kids.length > 0 && (
        <div className="sc-details">
          {laneOrder.map((tm) => {
            const v = tm === "Unassigned" ? "neutral" : TEAM_VAR[tm];
            return (
              <div className="sc-team-grp" key={tm}>
                <div className="sc-team-head"><span className={`tbadge sm av-${v}`}><IcTeam />{tm === "Unassigned" ? "Unassigned" : TEAM_SHORT[tm] || tm}</span>{tm}</div>
                {groups[tm].map((k) => {
                  const kes = effStatus(k);
                  const kc = subtreeCounts(k);
                  return (
                    <div key={k.id} className={`sc-sub${kes === "done" ? " done" : ""}`}>
                      <StatusDot status={kes} />
                      <span>{SIMPLE_SUB[k.title] || k.title}{kc.total ? <span style={{ color: "var(--ink-3)", fontWeight: 700 }}> ({kc.done}/{kc.total})</span> : null}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}

export function Overview() {
  const s = useStore();
  const all = s.viewTasks;
  let totalNodes = 0, doneNodes = 0;
  walkAll(all, (n) => { totalNodes++; if (n.status === "done") doneNodes++; });
  const overall = totalNodes ? Math.round((doneNodes / totalNodes) * 100) : 0;
  const mode = s.ui.simpleMode;
  const EMPTY: Record<string, string> = {
    now: "Nothing shipping right now.",
    next: "Nothing queued up next.",
    future: "Nothing parked for the future.",
    done: "Nothing fully shipped yet.",
  };
  const groups = mode === "status"
    ? [
        { k: "progress", title: "In progress", empty: "Nothing in flight.", test: (t: Node) => effStatus(t) === "progress" },
        { k: "planned", title: "Planned", empty: "Nothing waiting.", test: (t: Node) => effStatus(t) === "planned" },
        { k: "done", title: "Done", empty: "Nothing shipped yet.", test: (t: Node) => effStatus(t) === "done" },
      ]
    : STATES.map((st) => ({ k: st.k, title: st.word, empty: EMPTY[st.k], test: (t: Node) => stateOf(t) === st.k }));
  return (
    <>
      <div className="view-toolbar">
        <div className="gran-toggle">
          <button type="button" className={mode === "stage" ? "active" : ""} onClick={() => s.setSimpleMode("stage")}>Now / Next / Future / Done</button>
          <button type="button" className={mode === "status" ? "active" : ""} onClick={() => s.setSimpleMode("status")}>By status</button>
        </div>
        <div className="vt-note">
          {mode === "stage"
            ? "Which of the four states each milestone is in. A milestone reaches Done when every subtask under it is checked off. Open a card for the plain-language breakdown."
            : "What is moving, waiting or done, rolled up from every subtask. Open a card for the breakdown."}
        </div>
      </div>
      <div className="simple">
        <div className="simple-hero">
          <div className="line">We are <b>{overall}%</b> of the way there.</div>
          <div className="sub">{all.length} milestones · {totalNodes} tasks</div>
        </div>
        <div className="simple-buckets">
          {groups.map((b) => {
            const items = all.filter(b.test);
            const extra = mode === "stage" ? (() => { const ip = items.filter((t) => effStatus(t) === "progress").length; return ip ? ` · ${ip} in progress` : ""; })() : "";
            return (
              <section className="bucket" data-band={b.k} key={b.k}>
                <div className="bucket__head"><span className="bucket__title">{b.title}</span><span className="bucket__meta">{items.length} item{items.length === 1 ? "" : "s"}{extra}</span></div>
                <ul className="bucket__list">
                  {items.length ? items.map((t) => <SimpleCard key={t.id} task={t} />) : <div className="bucket--empty">{b.empty}</div>}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
