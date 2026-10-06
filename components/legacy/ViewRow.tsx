/** The view switcher as it was before the roadmap screen became one work board.
 *
 *  Frozen on purpose. The live `components/ViewRow.tsx` renders nothing now — the board
 *  carries its own tabs, filter and Add task — so the backup screen needs its own copy or it
 *  has no way to reach Timeline, Teams & People or the old board at all.
 *
 *  Do not fix bugs here. It is a photograph of 2026-09-25, kept so the old screen can be
 *  read; anything wrong with it was wrong then.
 */
"use client";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { VIEWS } from "@/lib/constants";
import { IcBoard, IcCollapseAll, IcExpandAll, IcFilter, IcPlus, ViewIcon } from "../icons";
import { useAppUi } from "../appui";
import type { ViewId } from "@/lib/types";

/** The team/person filter only prunes the tree, which only means anything on the two
 *  views built around who owns what. On Features and the Board it silently hid rows. */
const FILTERABLE: ViewId[] = ["timeline", "teams"];

export function LegacyViewRow() {
  const s = useStore();
  const ui = useAppUi();
  const filterBtn = useRef<HTMLButtonElement>(null);
  const view = s.ui.view;
  const onBoard = view === "board";
  const anyOpen = s.anyBoardOpen();
  const canFilter = FILTERABLE.includes(view);

  return (
    <div className="view-row">
      <nav className="view-switch" aria-label="Roadmap views">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" className={`vpill${view === v.id ? " active" : ""}`}
            aria-current={view === v.id ? "page" : undefined} onClick={() => s.setView(v.id as ViewId)}>
            <ViewIcon id={v.id} /><span>{v.label}</span>
          </button>
        ))}
        <button type="button" className={`vpill${onBoard ? " active" : ""}`}
          aria-current={onBoard ? "page" : undefined} onClick={() => s.setView("board")}>
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
        {onBoard && (
          <>
            <button className="btn ghost" title={anyOpen ? "Hide every checklist" : "Show every checklist"}
              onClick={() => s.setAllBoardOpen(!anyOpen)}>
              {anyOpen ? <IcCollapseAll /> : <IcExpandAll />}<span>{anyOpen ? "Collapse all" : "Expand all"}</span>
            </button>
            {/* Wrapped: the click event would otherwise arrive as the horizon argument. */}
            <button className="btn primary" onClick={() => ui.openAddTask()}><IcPlus /> Add task</button>
          </>
        )}
      </div>
    </div>
  );
}
