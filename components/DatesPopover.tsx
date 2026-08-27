"use client";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { effRange, fmtRange, spanDays } from "@/lib/dates";
import { IcClose } from "./icons";

export function DatesPopover({ pos, nodeId, onClose }: { pos: { left: number; top: number }; nodeId: string; onClose: () => void }) {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const node = s.find(nodeId);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement) && !(e.target as HTMLElement).closest?.("[data-dates-anchor]")) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onEsc); };
  }, [onClose]);

  if (!node) return null;

  const start = node.start || "";
  const end = node.end || "";
  const tat = node.tat ?? (start && end ? spanDays(start, end) : null);
  const implied = effRange(node);
  const hasOwn = !!(node.start && node.end);

  return (
    <div className="popover dates-pop open" ref={ref} style={{ left: pos.left, top: pos.top }}>
      <button className="icon-btn pop-close" aria-label="Close" onClick={onClose}><IcClose /></button>
      <h4>Timeline</h4>
      <div className="dp-grid">
        <label>
          <span>Start</span>
          <input type="date" value={start} onChange={(e) => s.setDates(nodeId, { start: e.target.value || null, end, tat }, "start")} />
        </label>
        <label>
          <span>End</span>
          <input type="date" value={end} onChange={(e) => s.setDates(nodeId, { start, end: e.target.value || null, tat }, "end")} />
        </label>
        <label>
          <span>TAT (days)</span>
          <input type="number" min={1} step={1} value={tat ?? ""} placeholder="auto"
            onChange={(e) => s.setDates(nodeId, { start, end, tat: e.target.value ? Number(e.target.value) : null }, "tat")} />
        </label>
      </div>
      <p className="dp-note">
        {hasOwn
          ? `Set to ${fmtRange(node.start as string, node.end as string)}.`
          : implied
            ? `No window of its own. Rolls up as ${fmtRange(implied.start, implied.end)} from its subtasks.`
            : "Set any two of the three and the third fills itself in."}
      </p>
      {(node.start || node.end || node.tat) && (
        <button type="button" className="btn ghost dp-clear" onClick={() => { s.clearDates(nodeId); onClose(); }}>Clear</button>
      )}
    </div>
  );
}
