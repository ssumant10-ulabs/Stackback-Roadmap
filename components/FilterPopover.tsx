"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { FOUNDERS, TEAM_ORDER, TEAM_SHORT, TEAM_VAR } from "@/lib/constants";
import { initials } from "@/lib/derive";
import { IcClose, IcTeam } from "./icons";
import type { Assignee, Node } from "@/lib/types";

export function FilterPopover({ pos, onClose }: { pos: { left: number; top: number }; onClose: () => void }) {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const { helpers } = s;
  const tasks = s.tasks;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement) && !(e.target as HTMLElement).closest?.("[data-filter-anchor]")) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  const teamCount = (team: string) => tasks.filter((t) => helpers.teamSet(t).indexOf(team) >= 0).length;
  const personCount = (name: string) => tasks.filter((t) => helpers.subtreeHasAssignee(t, (a) => !a.isTeam && a.name === name)).length;

  const seen: Record<string, 1> = {};
  const people: string[] = [];
  TEAM_ORDER.forEach((tm) => (s.data.roster[tm] || []).forEach((n) => { if (!seen[n]) { seen[n] = 1; people.push(n); } }));
  const walk = (nodes: Node[]) => nodes.forEach((n) => { (n.assignees || []).forEach((a: Assignee) => { if (!a.isTeam && !seen[a.name]) { seen[a.name] = 1; people.push(a.name); } }); walk(n.children || []); });
  walk(tasks);

  const setTeam = (t: string) => s.setFilter(s.ui.filter && s.ui.filter.type === "team" && s.ui.filter.name === t ? null : { type: "team", name: t });
  const setPerson = (p: string) => s.setFilter(s.ui.filter && s.ui.filter.type === "person" && s.ui.filter.name === p ? null : { type: "person", name: p });

  return (
    <div className="popover filter-pop open" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <button className="icon-btn pop-close" aria-label="Close" onClick={onClose}><IcClose /></button>
      <h4>Filter roadmap</h4>
      <div>
        <div className="fp-group">
          <div className="fp-lbl">Team</div>
          <div className="fp-chips">
            {TEAM_ORDER.map((t) => {
              const active = s.ui.filter?.type === "team" && s.ui.filter.name === t;
              return (
                <button key={t} type="button" className={`chip${active ? " active" : ""}`} onClick={() => setTeam(t)}>
                  <span className={`tbadge sm av-${TEAM_VAR[t]}`}><IcTeam />{TEAM_SHORT[t]}</span>{t}
                  <span className="count">{teamCount(t)}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="fp-group">
          <div className="fp-lbl">People</div>
          <div className="fp-chips">
            {people.map((p) => {
              const active = s.ui.filter?.type === "person" && s.ui.filter.name === p;
              const v = helpers.teamVar(helpers.teamOf(p));
              return (
                <button key={p} type="button" className={`chip${active ? " active" : ""}`} onClick={() => setPerson(p)}>
                  <span className={`avatar sm av-${v}${FOUNDERS[p] ? " founder" : ""}`}>{initials(p)}</span>{p}
                  <span className="count">{personCount(p)}</span>
                </button>
              );
            })}
          </div>
        </div>
        {s.ui.filter && <button type="button" className="chip clear" onClick={() => s.setFilter(null)}>Clear filter</button>}
      </div>
    </div>
  );
}
