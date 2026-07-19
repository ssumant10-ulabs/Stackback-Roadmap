"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { FOUNDERS, TEAM_ORDER, TEAM_VAR } from "@/lib/constants";
import { initials } from "@/lib/derive";
import type { Assignee } from "@/lib/types";

export function RosterPicker({
  assignees,
  onToggle,
}: {
  assignees: Assignee[];
  onToggle: (name: string, isTeam: boolean) => void;
}) {
  const s = useStore();
  const roster = s.data.roster;
  const [adds, setAdds] = useState<Record<string, string>>({});
  const sel = (name: string, isTeam: boolean) => assignees.some((a) => a.name === name && !!a.isTeam === isTeam);
  const doAdd = (team: string) => {
    if (s.addPersonToTeam(team, adds[team] || "")) setAdds((a) => ({ ...a, [team]: "" }));
  };
  return (
    <>
      {TEAM_ORDER.map((team) => {
        const v = TEAM_VAR[team];
        return (
          <div className="roster-group" key={team}>
            <div className="rg-head">
              {team}
              <button type="button" className={`add-team${sel(team, true) ? " sel" : ""}`} onClick={() => onToggle(team, true)}>
                {sel(team, true) ? "✓ team" : "+ team"}
              </button>
            </div>
            <div className="roster-people">
              {(roster[team] || []).map((name) => (
                <button type="button" key={name} className={`person-chip${sel(name, false) ? " sel" : ""}`} onClick={() => onToggle(name, false)}>
                  <span className={`avatar sm av-${v}${FOUNDERS[name] ? " founder" : ""}`}>{initials(name)}</span>
                  {name}
                </button>
              ))}
            </div>
            <div className="roster-add">
              <input
                type="text"
                placeholder={`Add a person to ${team}`}
                value={adds[team] || ""}
                onChange={(e) => setAdds((a) => ({ ...a, [team]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doAdd(team); } }}
              />
              <button type="button" onClick={() => doAdd(team)}>Add</button>
            </div>
          </div>
        );
      })}
    </>
  );
}
