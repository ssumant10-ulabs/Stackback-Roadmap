"use client";
import { useRef } from "react";
import type { Assignee, Node } from "@/lib/types";
import { useStore } from "@/lib/store";
import { effStatus, initials, statusLabel, subtreeCounts } from "@/lib/derive";
import { effRange, fmtRange, isOverdue } from "@/lib/dates";
import { FOUNDERS, TEAM_SHORT } from "@/lib/constants";
import { IcCaretDown, IcCaretUp, IcCheck, IcClock, IcComment, IcTeam } from "./icons";
import { useAppUi } from "./appui";

export function Avatar({ a, small }: { a: Assignee; small?: boolean }) {
  const { helpers } = useStore();
  if (a.isTeam) {
    const tv = helpers.teamVar(a.name);
    return (
      <span className={`tbadge ${small ? "sm " : ""}av-${tv}`} title={`${a.name} (team)`}>
        <IcTeam />{TEAM_SHORT[a.name] || a.name}
      </span>
    );
  }
  const team = helpers.teamOf(a.name);
  const v = helpers.teamVar(team);
  const founder = !!FOUNDERS[a.name];
  return (
    <span className={`avatar ${small ? "sm " : ""}av-${v}${founder ? " founder" : ""}`}
      title={`${a.name}${founder ? " · founder" : team ? " · " + team : ""}`}>
      {initials(a.name)}
    </span>
  );
}

export function OwnerAvatars({ task }: { task: Node }) {
  const seen: Record<string, 1> = {};
  const out: Assignee[] = [];
  (task.assignees || []).forEach((a) => {
    const k = (a.isTeam ? "T:" : "P:") + a.name;
    if (!seen[k]) { seen[k] = 1; out.push(a); }
  });
  return <>{out.map((a, i) => <Avatar key={i} a={a} small />)}</>;
}

export function TeamAvatars({ list }: { list: Assignee[] }) {
  return <>{list.map((a, i) => <Avatar key={i} a={a} small />)}</>;
}

export function StatusDot({ status }: { status: string }) {
  return <span className={`status-dot s-${status}`} />;
}

/** The one place a status is changed, so the Board and the subtask rows cannot drift apart.
 *
 *  A leaf cycles planned to in progress to done. A node WITH children shows its rolled-up
 *  status and toggles the whole subtree, because "done" on a parent is a statement about
 *  the work underneath it: that is what keeps a card from reading done at 3 of 7. */
export function StatusButton({ node, size }: { node: Node; size?: number }) {
  const s = useStore();
  const c = subtreeCounts(node);
  const hasKids = c.total > 0;
  const es = hasKids ? effStatus(node) : node.status;

  const click = () => {
    if (!hasKids) { s.cycleStatus(node.id); return; }
    if (es === "done" && c.total > 1 && !confirm(`Reopen "${node.title}"? All ${c.total} items under it go back to planned.`)) return;
    s.toggleDone(node.id);
  };

  const label = hasKids
    ? es === "done"
      ? `Done. Click to reopen all ${c.total} items.`
      : `${c.done} of ${c.total} done. Click to check off every item.`
    : `Status: ${statusLabel(es)}. Click to change.`;

  return (
    <button type="button" className="status-btn" aria-label={label} title={label} onClick={click}>
      <span className={`status-ring ${es}`} style={size ? { width: size, height: size } : undefined}>
        {es === "done" && <IcCheck />}
      </span>
    </button>
  );
}

/** Shows the window and opens the editor.
 *
 *  `variant` decides what an undated node looks like, which matters because the chip is
 *  both a readout and the only way to schedule something:
 *    full  always shows a label, so the affordance is obvious (milestone cards)
 *    icon  clock only when undated, keeping dense rows tight (Board subtasks)
 *    hide  renders nothing when undated (read-only surfaces, where it would be noise) */
export function DateChip({ node, variant = "full" }: { node: Node; variant?: "full" | "icon" | "hide" }) {
  const ui = useAppUi();
  const ref = useRef<HTMLButtonElement>(null);
  const own = !!(node.start && node.end);
  const r = effRange(node);
  const late = isOverdue(node);

  if (!own && !r && variant === "hide") return null;

  const text = own
    ? fmtRange(node.start as string, node.end as string)
    : r
      ? fmtRange(r.start, r.end)
      : variant === "full" ? "Dates" : "";
  const cls = `date-chip${own ? "" : r ? " implied" : " empty"}${late ? " late" : ""}${text ? "" : " icon-only"}`;
  const title = own
    ? `${fmtRange(node.start as string, node.end as string)}${node.tat ? ` · ${node.tat} day TAT` : ""}${late ? " · past its end date" : ""}`
    : r ? `Rolled up from subtasks: ${fmtRange(r.start, r.end)}` : "Set a start, end or TAT";

  return (
    <button ref={ref} type="button" className={cls} data-dates-anchor title={title}
      aria-label={text ? undefined : "Set dates"}
      onClick={(e) => { e.stopPropagation(); if (ref.current) ui.openDates(node.id, ref.current); }}>
      <IcClock />{text}
    </button>
  );
}

export function CommentChip({ node }: { node: Node }) {
  const s = useStore();
  const n = (node.comments || []).length;
  const open = s.ui.commentsOpen[node.id] === true;
  return (
    <button type="button" className={`cmt-chip${n ? " has" : ""}${open ? " on" : ""}`}
      title={n ? `${n} comment${n === 1 ? "" : "s"}` : "Add a comment"}
      onClick={(e) => { e.stopPropagation(); s.toggleComments(node.id); }}>
      <IcComment />{n || ""}
    </button>
  );
}

export function ReorderBtns({ id, up, down }: { id: string; up: boolean; down: boolean }) {
  const s = useStore();
  return (
    <span className="reorder">
      <button type="button" className="rbtn" disabled={!up} aria-label="Move up" title="Move up"
        onClick={() => s.reorder(id, "up")}><IcCaretUp /></button>
      <button type="button" className="rbtn" disabled={!down} aria-label="Move down" title="Move down"
        onClick={() => s.reorder(id, "down")}><IcCaretDown /></button>
    </span>
  );
}

export function MiniBar({ pct }: { pct: number }) {
  return <span className="rm-mini"><span style={{ width: pct + "%" }} /></span>;
}
