"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { VIEWS } from "@/lib/constants";
import { IcActivity, IcBoard, IcCollapseAll, IcExpandAll, IcFilter, IcLink, IcPlus, ViewIcon } from "./icons";
import { useAppUi } from "./appui";
import type { ViewId } from "@/lib/types";

export function ViewRow() {
  const s = useStore();
  const ui = useAppUi();
  const filterBtn = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);
  const filterLabel = s.ui.filter ? s.ui.filter.name : "Filter";
  const onBoard = s.ui.view === "board";
  const anyOpen = s.anyBoardOpen();

  const share = async () => {
    const url = window.location.origin + window.location.pathname + s.toQuery();
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { window.prompt("Copy this link", url); }
  };

  return (
    <div className="view-row">
      <nav className="view-switch" aria-label="Roadmap views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={`vpill${s.ui.view === v.id ? " active" : ""}`}
            aria-current={s.ui.view === v.id ? "page" : undefined} onClick={() => s.setView(v.id as ViewId)}>
            <ViewIcon id={v.id} /><span>{v.label}</span>
          </button>
        ))}
      </nav>
      <div className="view-actions">
        {onBoard && (
          <button className="btn ghost" title={anyOpen ? "Hide every checklist" : "Show every checklist"}
            onClick={() => s.setAllBoardOpen(!anyOpen)}>
            {anyOpen ? <IcCollapseAll /> : <IcExpandAll />}<span>{anyOpen ? "Collapse all" : "Expand all"}</span>
          </button>
        )}
        <button ref={filterBtn} className={`btn ghost${s.ui.filter ? " active-filter" : ""}`} aria-haspopup="true"
          onClick={() => filterBtn.current && ui.openFilter(filterBtn.current)}>
          <IcFilter /><span>{filterLabel}</span>
        </button>
        <button className="btn ghost" title="Copy a link to this view and filter" onClick={share}>
          <IcLink /><span>{copied ? "Copied" : "Share"}</span>
        </button>
        <button className="btn ghost" title="Recent changes" onClick={() => s.setActivityOpen(true)}>
          <IcActivity /><span>Activity</span>
        </button>
        <button className={`btn ghost${onBoard ? " on" : ""}`} title="Open the editing board"
          onClick={() => s.setView("board")}>
          <IcBoard /> Board
        </button>
        <button className="btn primary" onClick={ui.openAddTask}>
          <IcPlus /> Add task
        </button>
      </div>
    </div>
  );
}
