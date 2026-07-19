"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { RosterPicker } from "./RosterPicker";
import type { Assignee } from "@/lib/types";

export function AddTaskModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("1");
  const [eta, setEta] = useState("");
  const [subs, setSubs] = useState("");
  const [pending, setPending] = useState<Assignee[]>([]);
  const [custom, setCustom] = useState("");
  const [type, setType] = useState<"person" | "team">("person");
  const [err, setErr] = useState(false);

  const toggle = (name: string, isTeam: boolean) => {
    setPending((p) => {
      const idx = p.findIndex((a) => a.name === name && !!a.isTeam === isTeam);
      if (idx >= 0) return p.filter((_, i) => i !== idx);
      return [...p, isTeam ? { name, isTeam: true } : { name }];
    });
    setErr(false);
  };
  const addCustom = () => { const v = custom.trim(); if (!v) return; toggle(v, type === "team"); setCustom(""); };
  const save = () => {
    if (!title.trim()) return;
    if (pending.length === 0) { setErr(true); return; }
    const subArr = subs.split("\n").map((x) => x.trim()).filter(Boolean);
    s.addTask(title.trim(), priority ? parseInt(priority, 10) : null, eta.trim() || null, subArr, pending);
    onClose();
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Add a roadmap task</h3>
        <div className="modal-sub">Give it a title, a priority column and assign owners.</div>
        <div className="field"><label>Title</label>
          <input type="text" value={title} placeholder="e.g. Shipping rate intelligence" onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="field"><label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="1">Now · Priority 1</option>
            <option value="2">Next · Priority 2</option>
            <option value="3">Then · Priority 3</option>
            <option value="4">Later · Priority 4</option>
            <option value="5">Future · Priority 5</option>
            <option value="">Backlog · Unscheduled</option>
          </select>
        </div>
        <div className="field"><label>Assign owners</label>
          <RosterPicker assignees={pending} onToggle={toggle} />
          <div className="assignee-custom">
            <input type="text" placeholder="Add someone not listed" value={custom} onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
            <div className="type-toggle">
              <button type="button" className={type === "person" ? "active" : ""} onClick={() => setType("person")}>Person</button>
              <button type="button" className={type === "team" ? "active" : ""} onClick={() => setType("team")}>Team</button>
            </div>
            <button className="btn" type="button" onClick={addCustom}>Add</button>
          </div>
          <div className={`field-error${err ? " show" : ""}`}>Assign at least one owner.</div>
        </div>
        <div className="field"><label>Target / note <span style={{ textTransform: "none", fontWeight: 600 }}>(optional)</span></label>
          <input type="text" value={eta} placeholder="e.g. August" onChange={(e) => setEta(e.target.value)} />
        </div>
        <div className="field"><label>Subtasks <span style={{ textTransform: "none", fontWeight: 600 }}>(optional, one per line)</span></label>
          <textarea value={subs} placeholder={"Research vendors\nConfirm pricing\nShip v1"} onChange={(e) => setSubs(e.target.value)} />
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Add task</button>
        </div>
      </div>
    </div>
  );
}
