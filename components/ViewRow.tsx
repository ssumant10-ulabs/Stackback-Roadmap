"use client";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { VIEWS } from "@/lib/constants";
import { IcBoard, IcFilter, IcPlus, ViewIcon } from "./icons";
import { useAppUi } from "./appui";
import type { ViewId } from "@/lib/types";

export function ViewRow() {
  const s = useStore();
  const ui = useAppUi();
  const filterBtn = useRef<HTMLButtonElement>(null);
  const filterLabel = s.ui.filter ? s.ui.filter.name : "Filter";
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
        <button ref={filterBtn} className={`btn ghost${s.ui.filter ? " active-filter" : ""}`} aria-haspopup="true"
          onClick={() => filterBtn.current && ui.openFilter(filterBtn.current)}>
          <IcFilter /><span>{filterLabel}</span>
        </button>
        <button className={`btn ghost${s.ui.view === "board" ? " on" : ""}`} title="Open the editing board"
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
