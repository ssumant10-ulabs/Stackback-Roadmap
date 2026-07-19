"use client";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { RosterPicker } from "./RosterPicker";
import { IcClose } from "./icons";
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
  const addCustom = () => { const v = custom.trim(); if (!v) return; s.toggleAssignee(nodeId, v, type === "team"); setCustom(""); };

  return (
    <div className="popover open" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <button className="icon-btn pop-close" aria-label="Close" onClick={onClose}><IcClose /></button>
      <h4>Assign owners</h4>
      <RosterPicker assignees={node.assignees} onToggle={(name, isTeam) => s.toggleAssignee(nodeId, name, isTeam)} />
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
  );
}
