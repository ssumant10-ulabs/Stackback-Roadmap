"use client";
import type { Assignee, Node } from "@/lib/types";
import { useStore } from "@/lib/store";
import { initials } from "@/lib/derive";
import { FOUNDERS, TEAM_SHORT } from "@/lib/constants";
import { IcCaretDown, IcCaretUp, IcTeam } from "./icons";

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
