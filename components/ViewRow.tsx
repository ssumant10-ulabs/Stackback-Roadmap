"use client";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { IcBoard, IcFilter, IcPlus } from "./icons";
import { useAppUi } from "./appui";
import type { ViewId } from "@/lib/types";

/** The team/person filter only prunes the tree, which only means anything on the two
 *  views built around who owns what. On Features and the Board it silently hid rows. */
const FILTERABLE: ViewId[] = ["timeline", "teams"];

export function ViewRow() {
  const s = useStore();
  const ui = useAppUi();
  const filterBtn = useRef<HTMLButtonElement>(null);
  const view = s.ui.view;
  const onBoard = view === "board";
  const canFilter = FILTERABLE.includes(view);

  return (
    <div className="view-row">
      {/* One view. Timeline, Teams & People and By wave / Swimlanes / Dates all read the
          same tree, and five ways of reading it is what made the screen hard to use. The
          board's own PM / Design / Dev tabs are inside it, next to the columns they change. */}
      <nav className="view-switch" aria-label="Roadmap views">
        <button type="button" className="vpill active" aria-current="page">
          <IcBoard /><span>Board</span>
        </button>
      </nav>
      <div className="view-actions">
        {canFilter && (
          <button ref={filterBtn} className={`btn ghost${s.ui.filter ? " active-filter" : ""}`} aria-haspopup="true"
            onClick={() => filterBtn.current && ui.openFilter(filterBtn.current)}>
            <IcFilter /><span>{s.ui.filter ? s.ui.filter.name : "Filter"}</span>
          </button>
        )}
        {onBoard && <button className="btn primary" onClick={ui.openAddTask}><IcPlus /> Add task</button>}
      </div>
    </div>
  );
}
