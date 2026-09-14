"use client";
import type { CSSProperties } from "react";
import { useStore } from "@/lib/store";
import { effStatus, inflightLeaves, statusLabel, subtreeCounts, waveWord } from "@/lib/derive";
import type { Node } from "@/lib/types";
import { DateChip, MiniBar, OwnerAvatars, ReorderBtns, StatusDot } from "./bits";
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
      {/* Two rows, not one. The chips and the owners were competing for 257px of card with
          the progress readout, and the owners lost: `flex:1` on a flex-wrap container handed
          them a 30px column, so five avatars stacked vertically and the count fell off the
          edge. Dates get their own line and the owners get the full width of the next one. */}
      <div className="rm-item-foot">
        {(showWave || task.deadline || task.handover || task.start || task.end || task.tat) && (
          <div className="rm-item-chips">
            {showWave && <span className="rm-wave-chip">{waveWord(task.priority)}</span>}
            <DateChip node={task} variant="hide" />
            {task.deadline && <span className="rm-date-chip" title="Deadline">Due {task.deadline}</span>}
            {task.handover && <span className="rm-date-chip" title="Handover timeline">Handover {task.handover}</span>}
          </div>
        )}
        <div className="rm-item-stat">
          <span className="assignees"><OwnerAvatars task={task} /></span>
          <span className="rm-prog"><MiniBar pct={pct} /><span className="rm-mini-lbl">{lbl}</span></span>
        </div>
      </div>
    </div>
  );
}

export function rmRail(s: ReturnType<typeof useStore>, task: Node): string {
  return s.helpers.teamVar(s.helpers.primaryTeam(task)) || "neutral";
}
