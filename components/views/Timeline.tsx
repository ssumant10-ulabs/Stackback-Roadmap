"use client";
import { CSSProperties, Fragment } from "react";
import { useStore } from "@/lib/store";
import { PRIORITIES } from "@/lib/constants";
import { effStatus, statusLabel, subtreeCounts } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { RmItem } from "../RmItem";
import { ViewIcon } from "../icons";
import { Avatar, StatusDot } from "../bits";
import { useAppUi } from "../appui";

function Toolbar() {
  const s = useStore();
  return (
    <div className="view-toolbar">
      <div className="gran-toggle">
        <button type="button" className={s.ui.tlMode === "wave" ? "active" : ""} onClick={() => s.setTlMode("wave")}><ViewIcon id="timeline" />By wave</button>
        <button type="button" className={s.ui.tlMode === "swim" ? "active" : ""} onClick={() => s.setTlMode("swim")}><ViewIcon id="swim" />Swimlanes</button>
      </div>
      <div className="vt-note">
        {s.ui.tlMode === "swim"
          ? "Teams as rows, priority waves as columns. Read across a team to see their Now to Later work; every card names its team."
          : "The whole roadmap top to bottom, Now flowing to Later, grouped into each wave by the owning team."}
      </div>
    </div>
  );
}

export function Timeline() {
  const s = useStore();
  return (
    <>
      <Toolbar />
      {s.ui.tlMode === "swim" ? <TimelineSwim /> : <TimelineWave />}
    </>
  );
}

function TimelineWave() {
  const s = useStore();
  const h = s.helpers;
  const f = s.ui.filter;
  const teamFilter = f && f.type === "team" ? f.name : null;
  const waves = PRIORITIES.map((w) => ({ w, tasks: s.viewTasks.filter((t) => (t.priority || null) === w.p) })).filter((x) => x.tasks.length);
  if (!waves.length) return <div className="roadmap"><p className="rm-intro">No matching items.</p></div>;
  return (
    <div className="roadmap">
      {waves.map(({ w, tasks }) => {
        const byTeam: Record<string, Node[]> = { Engineering: [], Design: [], PM: [] };
        const un: Node[] = [];
        tasks.forEach((t) => {
          if (teamFilter) { byTeam[teamFilter].push(t); return; }
          const ts = h.teamSet(t); if (!ts.length) un.push(t); else ts.forEach((tm) => byTeam[tm].push(t));
        });
        const lanes: { label: string; tv: string; items: Node[] }[] = [];
        const allowed = teamFilter ? [teamFilter] : ["Engineering", "Design", "PM"];
        allowed.forEach((tm) => { if (byTeam[tm] && byTeam[tm].length) lanes.push({ label: tm, tv: h.teamVar(tm), items: byTeam[tm] }); });
        if (un.length && !teamFilter) lanes.push({ label: "Unassigned", tv: "neutral", items: un });
        let tot = 0, dn = 0;
        tasks.forEach((t) => { const c = subtreeCounts(t); tot += c.total + 1; dn += c.done + (t.status === "done" ? 1 : 0); });
        const pct = tot ? Math.round((dn / tot) * 100) : 0;
        return (
          <section className="wave" key={String(w.p)}>
            <span className="wave-marker"><span /></span>
            <div className="wave-head"><h3>{w.word}</h3><span className="pr">{w.p ? `Priority ${w.p}` : "Unscheduled"}</span>
              <span className="wmeta">{tasks.length} item{tasks.length > 1 ? "s" : ""} · {pct}% done</span></div>
            <div className="wave-body">
              {lanes.map((l) => (
                <div className="lane" key={l.label}>
                  <div className="lane-label"><span className="lane-dot" style={{ background: `var(--team-${l.tv})` }} />{l.label}</div>
                  <div className="lane-items">{l.items.map((t) => <RmItem key={t.id} task={t} railVar={h.teamVar(h.primaryTeam(t)) || "neutral"} />)}</div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SwimCard({ task, teamKey, tv }: { task: Node; teamKey: string; tv: string }) {
  const s = useStore();
  const h = s.helpers;
  const ui = useAppUi();
  const c = subtreeCounts(task);
  const es = effStatus(task);
  const pct = c.total ? Math.round((c.done / c.total) * 100) : task.status === "done" ? 100 : task.status === "progress" ? 50 : 0;
  const lbl = c.total ? `${c.done}/${c.total}` : statusLabel(es);
  const isTeam = teamKey !== "__un";
  const subs = isTeam ? h.teamNodesIn(task, teamKey) : [];
  const owners = isTeam ? h.teamPeople(task, teamKey) : task.assignees || [];
  return (
    <div className="swim-card" style={{ "--tc": `var(--team-${tv})` } as CSSProperties}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) ui.jumpToCard(task.id); }}>
      <div className="swim-card-top"><StatusDot status={es} /><span className="swim-title">{task.title}</span></div>
      {subs.length > 0 && (
        <div className="swim-subs">
          {subs.map((n) => { const nes = effStatus(n); return <div key={n.id} className={`swim-sub${nes === "done" ? " done" : ""}`}><StatusDot status={nes} /><span>{n.title}</span></div>; })}
        </div>
      )}
      <div className="swim-card-foot">
        <span className="swim-owners">{owners.map((a, i) => <Avatar key={i} a={a} small />)}</span>
        <span className="swim-mini"><span style={{ width: pct + "%" }} /></span>
        <span className="swim-lbl">{lbl}</span>
      </div>
    </div>
  );
}

function TimelineSwim() {
  const s = useStore();
  const h = s.helpers;
  const f = s.ui.filter;
  const teamFilter = f && f.type === "team" ? f.name : null;
  const vt = s.viewTasks;
  const waves = PRIORITIES.filter((w) => vt.some((t) => (t.priority || null) === w.p));
  if (!waves.length) return <div className="roadmap"><p className="rm-intro">No matching items.</p></div>;
  const tvOf: Record<string, string> = { Engineering: "eng", Design: "dsg", PM: "pm" };
  const rows: { key: string; tv: string }[] = teamFilter
    ? [{ key: teamFilter, tv: tvOf[teamFilter] || "neutral" }]
    : [{ key: "Engineering", tv: "eng" }, { key: "Design", tv: "dsg" }, { key: "PM", tv: "pm" }];
  if (!teamFilter && vt.some((t) => h.teamSet(t).length === 0)) rows.push({ key: "__un", tv: "neutral" });
  const itemsFor = (rowKey: string, wp: number | null) =>
    vt.filter((t) => {
      if ((t.priority || null) !== wp) return false;
      if (teamFilter) return true;
      const ts = h.teamSet(t);
      if (rowKey === "__un") return ts.length === 0;
      return ts.indexOf(rowKey) >= 0;
    });
  return (
    <div className="swim">
      <div className="swim-scroll">
        <div className="swim-grid" style={{ gridTemplateColumns: `132px repeat(${waves.length}, minmax(210px, 1fr))` }}>
          <div className="swim-corner">Team</div>
          {waves.map((w) => <div className="swim-colhead" key={String(w.p)}><span className="word">{w.word}</span><span className="pr">{w.p ? `Priority ${w.p}` : "Backlog"}</span></div>)}
          {rows.map((r) => (
            <Fragment key={r.key}>
              <div className="swim-rowhead" style={{ "--tc": `var(--team-${r.tv})` } as CSSProperties}><span className="dot" />{r.key === "__un" ? "Unassigned" : r.key}</div>
              {waves.map((w) => {
                const items = itemsFor(r.key, w.p);
                return <div className="swim-cell" key={String(w.p)}>{items.length ? items.map((t) => <SwimCard key={t.id} task={t} teamKey={r.key} tv={r.tv} />) : <span className="swim-empty">·</span>}</div>;
              })}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="rm-intro" style={{ marginTop: 12 }}>Each row is a team, each column a priority wave. A task shared by two teams appears under both, each showing only that team&apos;s subtasks.</p>
    </div>
  );
}
