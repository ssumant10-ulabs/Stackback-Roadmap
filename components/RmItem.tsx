"use client";
import type { CSSProperties } from "react";
import { useStore } from "@/lib/store";
import { effStatus, inflightLeaves, statusLabel, subtreeCounts, waveWord } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { MiniBar, OwnerAvatars, ReorderBtns, StatusDot } from "./bits";
import { useAppUi } from "./appui";

export function RmItem({ task, railVar, showWave, inflight }: { task: Node; railVar: string; showWave?: boolean; inflight?: boolean }) {
  const s = useStore();
  const ui = useAppUi();
  const c = subtreeCounts(task);
  const hasKids = c.total > 0;
  const pct = hasKids ? Math.round((c.done / c.total) * 100) : task.status === "done" ? 100 : task.status === "progress" ? 50 : 0;
  const lbl = hasKids ? `${c.done}/${c.total}` : statusLabel(task.status);
  const es = effStatus(task);
  const ts = s.helpers.teamSet(task);
  const cross = ts.length >= 2;
  const style = { "--tc": `var(--team-${railVar})`, ...(cross ? { "--tc2": `var(--team-${s.helpers.teamVar(ts[1])})` } : {}) } as CSSProperties;
  const m = s.cardMoves(task);
  const lv = inflight ? inflightLeaves(task).slice(0, 3) : [];
  return (
    <div className={`rm-item${cross ? " cross" : ""}`} style={style}
      onClick={(e) => { if (!(e.target as HTMLElement).closest("button")) ui.jumpToCard(task.id); }}>
      <div className="rm-item-top">
        <StatusDot status={es} />
        <span className="rm-item-title">{task.title}</span>
        <ReorderBtns id={task.id} up={m.up} down={m.down} />
      </div>
      {lv.length > 0 && <div className="rm-inflight">{lv.map((x, i) => <span key={i}>▸ {x}</span>)}</div>}
      <div className="rm-item-foot">
        {showWave && <span className="rm-wave-chip">{waveWord(task.priority)}</span>}
        <span className="assignees"><OwnerAvatars task={task} /></span>
        <MiniBar pct={pct} />
        <span className="rm-mini-lbl">{lbl}</span>
      </div>
    </div>
  );
}

export function rmRail(s: ReturnType<typeof useStore>, task: Node): string {
  return s.helpers.teamVar(s.helpers.primaryTeam(task)) || "neutral";
}
