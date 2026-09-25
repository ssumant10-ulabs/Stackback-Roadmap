"use client";
import { useRef } from "react";
import { useStore } from "@/lib/store";
import { IcFilter, IcPlus } from "./icons";
import { useAppUi } from "./appui";
import type { ViewId } from "@/lib/types";

/** The board reads the filter itself now, matching a card on who is assigned to it, on the
 *  team it was handed to, or on who raised it. It used to prune the tree, which meant
 *  nothing on this screen, so the control was hidden rather than wrong. */
const FILTERABLE: ViewId[] = ["board"];

export function ViewRow() {
  const s = useStore();
  const ui = useAppUi();
  const filterBtn = useRef<HTMLButtonElement>(null);
  /* Everything that is not the Features backlog renders the board now, including the saved
     "timeline" a browser is still carrying from before the other views came off. Reading the
     stored id literally left the filter and Add card hidden for anyone who had not clicked
     Board since. */
  const onBoard = s.ui.view !== "features";
  const canFilter = onBoard || FILTERABLE.includes(s.ui.view);

  return (
    <div className="view-row">
      {/* No view switcher. There is one view, so a pill that only ever says Board and can
          only ever be on is a control that does nothing. The board's own PM / Design / Dev
          tabs live inside it, next to the columns they change. */}
      <div />
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
