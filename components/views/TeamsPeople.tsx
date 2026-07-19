"use client";
import { CSSProperties } from "react";
import { useStore } from "@/lib/store";
import { FOUNDERS, SIMPLE_LABELS, SIMPLE_SUB, TEAM_ORDER, TEAM_VAR } from "@/lib/constants";
import { effStatus, initials, subtreeCounts } from "@/lib/derive";
import { personWork, teamWork } from "@/lib/teams";
import type { Assignee, Node } from "@/lib/types";
import { Avatar, StatusDot } from "../bits";
import { ViewIcon } from "../icons";

function walkAll(nodes: Node[], cb: (n: Node) => void) {
  nodes.forEach((n) => { cb(n); walkAll(n.children || [], cb); });
}
const simpleName = (t: Node) => (SIMPLE_LABELS[t.title] || { simple: t.title }).simple;

export function TeamsPeople() {
  const s = useStore();
  const g = s.ui.teamGran;
  const notes: Record<string, string> = {
    team: "Each team's milestones and the exact subtasks assigned to them, with only that team's members shown.",
    person: "Each person's own tasks and subtasks with their progress. Share a panel with the person it belongs to.",
    load: "Who is carrying how much. Bars show tasks per person and team, split by status.",
  };
  return (
    <>
      <div className="view-toolbar">
        <div className="gran-toggle">
          <button type="button" className={g === "team" ? "active" : ""} onClick={() => s.setTeamGran("team")}><ViewIcon id="team" />By team</button>
          <button type="button" className={g === "person" ? "active" : ""} onClick={() => s.setTeamGran("person")}><ViewIcon id="person" />By person</button>
          <button type="button" className={g === "load" ? "active" : ""} onClick={() => s.setTeamGran("load")}><ViewIcon id="workload" />Load</button>
        </div>
        <div className="vt-note">{notes[g]}</div>
      </div>
      {g === "person" ? <ByPerson /> : g === "load" ? <Load /> : <ByTeam />}
    </>
  );
}

function TeamAvatarsFor({ list }: { list: Assignee[] }) {
  if (!list.length) return null;
  return <span className="pp-av">{list.map((a, i) => <Avatar key={i} a={a} small />)}</span>;
}

function ByTeam() {
  const s = useStore();
  const h = s.helpers;
  const f = s.ui.filter;
  return (
    <div className="group-grid cols-team">
      {TEAM_ORDER.map((team) => {
        const v = h.teamVar(team);
        const w = teamWork(s.tasks, team, h, f);
        return (
          <div key={team} className={`group-col pp-panel${w.total ? "" : " dim"}`} style={{ "--gc": `var(--team-${v})` } as CSSProperties}>
            <div className="gc-head">
              <div className="gc-title-row"><span className="gc-dot" style={{ background: `var(--team-${v})` }} /><span className="gc-name">{team}</span><span className="gc-count">{w.total}</span></div>
              <div className="gc-prog"><div className="t"><span style={{ width: w.pct + "%" }} /></div><div className="l">{w.done}/{w.total} · {w.pct}%</div></div>
              <div className="gc-tally"><span><i className="d" />{w.done}</span><span><i className="p" />{w.prog}</span><span><i className="l" />{w.total - w.done - w.prog}</span></div>
            </div>
            {w.groups.length ? w.groups.map((grp) => (
              <div className="pp-ms" key={grp.ms.id}>
                <div className="pp-ms-head">{simpleName(grp.ms)}</div>
                {grp.ownsMs && <div className="pp-task owner"><StatusDot status={effStatus(grp.ms)} /><span>Owns this milestone</span><TeamAvatarsFor list={h.teamPeople(grp.ms, team)} /></div>}
                {grp.nodes.map((n) => { const es = effStatus(n); const c = subtreeCounts(n); return (
                  <div key={n.id} className={`pp-task${es === "done" ? " done" : ""}`}><StatusDot status={es} /><span>{n.title}{c.total ? <span className="pp-sub"> ({c.done}/{c.total})</span> : null}</span><TeamAvatarsFor list={h.teamPeople(n, team)} /></div>
                ); })}
              </div>
            )) : <div className="gc-empty">No tasks assigned to {team} yet</div>}
          </div>
        );
      })}
    </div>
  );
}

function ByPerson() {
  const s = useStore();
  const h = s.helpers;
  const f = s.ui.filter;
  const seen: Record<string, 1> = {};
  const people: { name: string; team: string | null }[] = [];
  TEAM_ORDER.forEach((tm) => (s.data.roster[tm] || []).forEach((n) => { if (!seen[n]) { seen[n] = 1; people.push({ name: n, team: tm }); } }));
  const walk = (nodes: Node[]) => nodes.forEach((n) => { (n.assignees || []).forEach((a) => { if (!a.isTeam && !seen[a.name]) { seen[a.name] = 1; people.push({ name: a.name, team: h.teamOf(a.name) }); } }); walk(n.children || []); });
  walk(s.tasks);
  const scrollTo = (name: string) => {
    const sel = window.CSS && CSS.escape ? CSS.escape(name) : name;
    const el = document.querySelector(`[data-scroll="${sel}"]`);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); (el as HTMLElement).style.boxShadow = "0 0 0 3px var(--brand)"; setTimeout(() => ((el as HTMLElement).style.boxShadow = ""), 1200); }
  };
  return (
    <>
      <div className="people-overview">
        {people.map((pp) => {
          const w = personWork(s.tasks, pp.name, h, f);
          const v = h.teamVar(pp.team);
          return (
            <button key={pp.name} type="button" className={`po-chip${w.total ? "" : " empty"}`} onClick={() => scrollTo(pp.name)}>
              <span className={`avatar av-${v}${FOUNDERS[pp.name] ? " founder" : ""}`}>{initials(pp.name)}</span>
              <span className="po-meta">
                <span className="po-name">{pp.name}</span>
                <span className="po-load">{w.total} task{w.total === 1 ? "" : "s"} · {w.pct}%</span>
                <span className="po-bar"><span style={{ width: w.pct + "%" }} /></span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="section-label">Everyone&apos;s tasks</div>
      <div className="group-grid cols-person">
        {people.map((pp) => {
          const w = personWork(s.tasks, pp.name, h, f);
          const v = h.teamVar(pp.team);
          return (
            <div key={pp.name} className={`group-col pp-panel${w.total ? "" : " dim"}`} data-scroll={pp.name} style={{ "--gc": `var(--team-${v})` } as CSSProperties}>
              <div className="gc-head">
                <div className="gc-title-row"><span className={`gc-avatar av-${v}${FOUNDERS[pp.name] ? " founder" : ""}`}>{initials(pp.name)}</span><span className="gc-name">{pp.name}</span><span className="gc-count">{w.total}</span></div>
                <div className="gc-sub">{pp.team || "External"}{FOUNDERS[pp.name] ? " · founder" : ""}{w.total ? "" : " · free"}</div>
                <div className="gc-prog"><div className="t"><span style={{ width: w.pct + "%" }} /></div><div className="l">{w.done}/{w.total} · {w.pct}%</div></div>
                <div className="gc-tally"><span><i className="d" />{w.done}</span><span><i className="p" />{w.prog}</span><span><i className="l" />{w.total - w.done - w.prog}</span></div>
              </div>
              {w.groups.length ? w.groups.map((grp) => (
                <div className="pp-ms" key={grp.ms.id}>
                  <div className="pp-ms-head">{simpleName(grp.ms)}</div>
                  {grp.ownsMs && <div className="pp-task owner"><StatusDot status={effStatus(grp.ms)} /><span>Owns this milestone</span></div>}
                  {grp.nodes.map((n) => { const es = effStatus(n); const c = subtreeCounts(n); return (
                    <div key={n.id} className={`pp-task${es === "done" ? " done" : ""}`}><StatusDot status={es} /><span>{SIMPLE_SUB[n.title] || n.title}{c.total ? <span className="pp-sub"> ({c.done}/{c.total})</span> : null}</span></div>
                  ); })}
                </div>
              )) : <div className="gc-empty">No tasks assigned yet</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

type Load3 = { done: number; prog: number; plan: number; total: number };
function Load() {
  const s = useStore();
  const h = s.helpers;
  const people: Record<string, Load3> = {};
  const teams: Record<string, Load3> = {};
  const bump = (o: Record<string, Load3>, key: string, st: string) => {
    if (!o[key]) o[key] = { done: 0, prog: 0, plan: 0, total: 0 };
    o[key].total++;
    if (st === "done") o[key].done++; else if (st === "progress") o[key].prog++; else o[key].plan++;
  };
  walkAll(s.tasks, (n) => {
    (n.assignees || []).forEach((a) => {
      if (a.isTeam) { if (TEAM_VAR[a.name]) bump(teams, a.name, n.status); }
      else { bump(people, a.name, n.status); const tm = h.teamOf(a.name); if (tm) bump(teams, tm, n.status); }
    });
  });
  const rows = (obj: Record<string, Load3>, order: string[], teamFor: (k: string) => string | null) => {
    let max = 1;
    order.forEach((k) => { if (obj[k] && obj[k].total > max) max = obj[k].total; });
    const scale = (v: number) => (v / max) * 100;
    return order.map((k) => {
      const d = obj[k] || { done: 0, prog: 0, plan: 0, total: 0 };
      const v = h.teamVar(teamFor(k));
      return (
        <div className="wl-row" key={k}>
          <div className="wl-who"><span className={`avatar sm av-${v}`}>{initials(k)}</span><span>{k}</span></div>
          <div className="wl-track" style={{ "--gc": `var(--team-${v})` } as CSSProperties}>
            <i className="done" style={{ width: scale(d.done) + "%" }} />
            <i className="prog" style={{ width: scale(d.prog) + "%" }} />
            <i className="plan" style={{ width: scale(d.plan) + "%" }} />
          </div>
          <div className="wl-total">{d.total}</div>
        </div>
      );
    });
  };
  const peopleOrder = Object.keys(people).sort((a, b) => people[b].total - people[a].total);
  const teamOrder = TEAM_ORDER.filter((t) => teams[t]);
  return (
    <div className="workload">
      <div className="wl-block">
        <h3>Load by person</h3>
        <p className="wl-note">Total tasks (at any depth) assigned to each person, split by status. Bars are scaled to the busiest person.</p>
        <div className="wl-rows">{peopleOrder.length ? rows(people, peopleOrder, (k) => h.teamOf(k)) : <p className="wl-note">No individual assignments yet.</p>}</div>
      </div>
      <div className="wl-block">
        <h3>Load by team</h3>
        <p className="wl-note">Every task touching each team, split by status.</p>
        <div className="wl-rows">{teamOrder.length ? rows(teams, teamOrder, (k) => k) : <p className="wl-note">No team assignments yet.</p>}</div>
      </div>
      <div className="pg-legend" style={{ justifyContent: "center" }}>
        <span><i className="d" />Done</span><span><i className="p" />In progress</span><span><i className="l" />Planned</span>
      </div>
    </div>
  );
}
