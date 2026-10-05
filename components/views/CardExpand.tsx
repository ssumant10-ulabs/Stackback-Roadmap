"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { Assignees } from "../Assignees";
import { StatusButton } from "../bits";
import { IcPlus, IcTrash } from "../icons";
import type { Node } from "@/lib/types";

/** The brief and the checklist, opened in place under a card.
 *
 *  One component for both the board and the sprint track, because they are the same
 *  question asked in two places and two copies of it drift. The drawer stays the place to
 *  change what a card IS — its type, its labels, its title. This is the place to work it:
 *  read the brief, tick things off, add the step you just thought of, drop the one that
 *  turned out not to be needed.
 *
 *  Removing a subtask lives here as well as in the drawer. It was only in the drawer, which
 *  meant seeing a subtask you did not want and having to open a second surface to delete
 *  it, with the list you were looking at no longer on screen. */
export function CardExpand({ node, onOpen }: { node: Node; onOpen?: () => void }) {
  const s = useStore();
  const desc = (node.desc || "").trim();
  const kids = node.children || [];
  return (
    <div className="cx">
      {desc
        ? <p className="cx-desc">{desc}</p>
        : onOpen && (
          <button type="button" className="cx-nodesc" onClick={onOpen}>
            No description yet &mdash; add one
          </button>
        )}
      {kids.length > 0 && (
        <ul className="cx-subs">
          {kids.map((k) => (
            <li key={k.id}>
              <StatusButton node={k} size={13} />
              <span className={k.status === "done" ? "cx-st done" : "cx-st"}>{k.title}</span>
              <span className="assignees cx-who"><Assignees node={k} small /></span>
              <button type="button" className="cx-del" aria-label={`Remove ${k.title}`}
                title="Remove this subtask"
                onClick={() => { if (confirm(`Remove "${k.title}"?`)) s.del(k.id); }}><IcTrash /></button>
            </li>
          ))}
        </ul>
      )}
      <AddSub parentId={node.id} />
    </div>
  );
}

function AddSub({ parentId }: { parentId: string }) {
  const s = useStore();
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const add = () => {
    const t = v.trim();
    if (!t) return;
    /* Focus is kept so a checklist can be typed in one go rather than one click per line. */
    if (s.addChild(parentId, t)) { setV(""); ref.current?.focus(); }
  };
  return (
    <div className="cx-add">
      <input ref={ref} type="text" value={v} placeholder="Add a subtask"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" onClick={add}><IcPlus /> Add</button>
    </div>
  );
}
