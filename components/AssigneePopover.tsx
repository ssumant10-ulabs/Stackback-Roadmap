"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { RosterPicker } from "./RosterPicker";
import { IcCheck, IcClose } from "./icons";
import type { Node } from "@/lib/types";

function findNode(nodes: Node[], id: string): Node | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const c = findNode(n.children || [], id);
    if (c) return c;
  }
  return null;
}

export function AssigneePopover({ pos, nodeId, onClose }: { pos: { left: number; top: number }; nodeId: string; onClose: () => void }) {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [custom, setCustom] = useState("");
  const [type, setType] = useState<"person" | "team">("person");
  /* Every toggle here is already saved the moment it is made, which is exactly the problem:
     nothing on screen said so, so promoting a feature and picking an owner ended with no
     sign the owner had stuck. The chip below confirms the write and Done closes it. */
  const [saved, setSaved] = useState(0);
  const node = findNode(s.tasks, nodeId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement) && !(e.target as HTMLElement).closest?.("[data-assign-anchor]")) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [onClose]);

  if (!node) return null;
  const mark = () => setSaved((n) => n + 1);
  const toggle = (name: string, isTeam: boolean) => { s.toggleAssignee(nodeId, name, isTeam); mark(); };
  const addCustom = () => { const v = custom.trim(); if (!v) return; toggle(v, type === "team"); setCustom(""); };
  const owners = node.assignees || [];

  return (
    <div className="popover assign-pop open" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <button className="icon-btn pop-close" aria-label="Close" onClick={onClose}><IcClose /></button>
      {/* Named, not just "Assign owners". The picker can be opened from a card that has
          since moved out of view, most obviously right after a feature is promoted onto the
          board, and an unnamed popover then looks like it belongs to whatever is underneath it. */}
      <h4 className="pop-title">Assign owners<span>{node.title}</span></h4>
      {/* The roster scrolls; the confirm bar below does not. Without that the picker grew
          past the bottom of the window on a card low down the page and Done went with it. */}
      <div className="ap-body">
      <RosterPicker assignees={node.assignees} onToggle={toggle} />
      <div className="assignee-custom">
        <input type="text" placeholder="Add someone" value={custom} onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <div className="type-toggle">
          <button type="button" className={type === "person" ? "active" : ""} onClick={() => setType("person")}>Person</button>
          <button type="button" className={type === "team" ? "active" : ""} onClick={() => setType("team")}>Team</button>
        </div>
        <button className="btn" type="button" onClick={addCustom}>Add</button>
      </div>
      </div>
      <div className="assignee-done">
        <span className={`assignee-saved${saved ? " on" : ""}`} aria-live="polite">
          {saved
            ? <><IcCheck />Saved · {owners.length} assigned</>
            : owners.length === 0 ? "Nobody assigned yet" : `${owners.length} assigned`}
        </span>
        <button className="btn primary sm" type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
