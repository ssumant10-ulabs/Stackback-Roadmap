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

  /* People under the team they are on, rather than one flat list beneath all three. A flat
     list makes you know the roster to use the filter: picking "the design team's work" and
     "Neel's work" are the same question at two scopes, and they were two unrelated rows. */
  const seen: Record<string, 1> = {};
  const byTeam: Record<string, string[]> = {};
  const loose: string[] = [];
  TEAM_ORDER.forEach((tm) => {
    byTeam[tm] = [];
    (s.data.roster[tm] || []).forEach((n) => { if (!seen[n]) { seen[n] = 1; byTeam[tm].push(n); } });
  });
  const walk = (nodes: Node[]) => nodes.forEach((n) => {
    (n.assignees || []).forEach((a: Assignee) => {
      if (a.isTeam || seen[a.name]) return;
      seen[a.name] = 1;
      const tm = helpers.teamOf(a.name);
      if (tm && byTeam[tm]) byTeam[tm].push(a.name); else loose.push(a.name);
    });
    walk(n.children || []);
  });
  walk(tasks);

  const setTeam = (t: string) => s.setFilter(s.ui.filter && s.ui.filter.type === "team" && s.ui.filter.name === t ? null : { type: "team", name: t });
  const setPerson = (p: string) => s.setFilter(s.ui.filter && s.ui.filter.type === "person" && s.ui.filter.name === p ? null : { type: "person", name: p });

  return (
    <div className="popover filter-pop open" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <button className="icon-btn pop-close" aria-label="Close" onClick={onClose}><IcClose /></button>
      <h4>Filter roadmap</h4>
      <div>
        {TEAM_ORDER.map((t) => {
          const teamActive = s.ui.filter?.type === "team" && s.ui.filter.name === t;
          return (
            <div className="fp-group" key={t}>
              <button type="button" className={`chip fp-team${teamActive ? " active" : ""}`} onClick={() => setTeam(t)}>
                <span className={`tbadge sm av-${TEAM_VAR[t]}`}><IcTeam />{TEAM_SHORT[t]}</span>{t}
                <span className="count">{teamCount(t)}</span>
              </button>
              <div className="fp-chips fp-people">
                {(byTeam[t] || []).map((p) => {
                  const active = s.ui.filter?.type === "person" && s.ui.filter.name === p;
                  return (
                    <button key={p} type="button" className={`chip${active ? " active" : ""}`} onClick={() => setPerson(p)}>
                      <span className={`avatar sm av-${TEAM_VAR[t]}${FOUNDERS[p] ? " founder" : ""}`}>{initials(p)}</span>{p}
                      <span className="count">{personCount(p)}</span>
                    </button>
                  );
                })}
                {!(byTeam[t] || []).length && <span className="fp-none">Nobody on the roster</span>}
              </div>
            </div>
          );
        })}
        {loose.length > 0 && (
          <div className="fp-group">
            <div className="fp-lbl">Assigned, not on a team roster</div>
            <div className="fp-chips fp-people">
              {loose.map((p) => {
                const active = s.ui.filter?.type === "person" && s.ui.filter.name === p;
                return (
                  <button key={p} type="button" className={`chip${active ? " active" : ""}`} onClick={() => setPerson(p)}>
                    <span className="avatar sm av-neutral">{initials(p)}</span>{p}
                    <span className="count">{personCount(p)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {s.ui.filter && <button type="button" className="chip clear" onClick={() => s.setFilter(null)}>Clear filter</button>}
      </div>
    </div>
  );
}
