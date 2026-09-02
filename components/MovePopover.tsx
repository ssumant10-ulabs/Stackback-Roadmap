"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { PRIORITIES } from "@/lib/constants";
import { IcClose } from "./icons";

/** Send a card or a checklist item somewhere else on this board: under a different card, or
 *  out to a horizon of its own. Dragging covers the move to whatever is next door, but only
 *  while source and destination are both on screen, which on this board they usually are
 *  not. This is the move that does not depend on being able to see both ends of it. */
export function MovePopover({ pos, nodeId, onClose }: { pos: { left: number; top: number }; nodeId: string; onClose: () => void }) {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const { cards, isTopLevel, currentPriority } = s.moveTargets(nodeId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement) && !(e.target as HTMLElement).closest?.("[data-move-anchor]")) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [onClose]);

  const needle = q.trim().toLowerCase();
  const groups = useMemo(() => PRIORITIES.map((w) => ({
    ...w,
    items: cards.filter((c) => c.priority === w.p && (!needle || c.title.toLowerCase().includes(needle))),
  })), [cards, needle]);

  const toCard = (cardId: string) => { s.moveNode(nodeId, cardId, "", null); onClose(); };
  const toTop = (p: number) => { s.moveNode(nodeId, "root", "", p); onClose(); };

  return (
    <div className="popover open move-pop" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <button className="icon-btn pop-close" aria-label="Close" onClick={onClose}><IcClose /></button>
      <h4>Move to</h4>
      <input className="mv-search" placeholder="Find a card" value={q} autoFocus
        onChange={(e) => setQ(e.target.value)} aria-label="Find a card" />
      <div className="mv-scroll">
        <div className="mv-group">
          <div className="mv-head">{isTopLevel ? "Horizon" : "Make it a card of its own"}</div>
          {PRIORITIES.map((w) => (
            <button type="button" key={w.p} className="mv-row" disabled={w.p === currentPriority}
              onClick={() => toTop(w.p)}>
              <span className="mv-title">{isTopLevel ? w.word : `Top level, ${w.word}`}</span>
              {w.p === currentPriority && <span className="mv-current">here</span>}
            </button>
          ))}
        </div>
        {groups.map((g) => (
          g.items.length ? (
            <div className="mv-group" key={g.p}>
              <div className="mv-head">{g.word}</div>
              {g.items.map((c) => (
                <button type="button" key={c.id} className="mv-row" disabled={c.current}
                  title={c.current ? "Already here" : `Move under ${c.title}`} onClick={() => toCard(c.id)}>
                  <span className="mv-title">{c.title}</span>
                  {c.current && <span className="mv-current">here</span>}
                </button>
              ))}
            </div>
          ) : null
        ))}
        {needle && groups.every((g) => !g.items.length) && <div className="mv-empty">No card matches that.</div>}
      </div>
    </div>
  );
}
