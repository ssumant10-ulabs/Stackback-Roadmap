"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { relTime } from "@/lib/reltime";
import { initials } from "@/lib/derive";
import type { ActivityKind } from "@/lib/types";
import { IcClose } from "./icons";
import { useAppUi } from "./appui";

const VERB: Record<ActivityKind, string> = {
  status: "set",
  done: "checked off",
  undone: "reopened",
  move: "moved",
  nest: "nested",
  add: "added",
  delete: "deleted",
  dates: "scheduled",
  assign: "changed owners on",
  comment: "commented on",
  roadmap: "roadmap",
};

export function ActivityDrawer({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const ui = useAppUi();
  const list = s.activity;

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Activity">
        <div className="drawer-head">
          <h3>Activity</h3>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><IcClose /></button>
        </div>
        {!list.length ? (
          <p className="drawer-empty">Nothing yet. Edits to the roadmap show up here, newest first.</p>
        ) : (
          <ul className="act-list">
            {list.map((a) => (
              <li className={`act k-${a.kind}`} key={a.id}>
                <span className="act-av" title={a.who}>{initials(a.who)}</span>
                <div className="act-main">
                  <div className="act-line">
                    <b>{a.who}</b> {VERB[a.kind] || a.kind}{" "}
                    {a.nodeId ? (
                      <button type="button" className="act-link" onClick={() => { ui.jumpToCard(a.nodeId as string); onClose(); }}>{a.title}</button>
                    ) : <i>{a.title}</i>}
                    {a.detail ? <span className="act-detail"> · {a.detail}</span> : null}
                  </div>
                  <div className="act-when">{relTime(a.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {list.length > 0 && (
          <div className="drawer-foot">
            <span>{list.length} entr{list.length === 1 ? "y" : "ies"}, newest first</span>
            <button type="button" className="btn ghost" onClick={() => { if (confirm("Clear the activity log for everyone?")) s.clearActivity(); }}>Clear</button>
          </div>
        )}
      </aside>
    </>
  );
}
