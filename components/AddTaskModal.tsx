"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { ALL_KINDS, KIND_LABEL, type CardKind } from "@/lib/board";
import { ERROR_TYPES, SURFACES, subModulesFor } from "@/lib/qa-labels";
import { RosterPicker } from "./RosterPicker";
import type { Assignee } from "@/lib/types";

/** Add a card, with the same fields the card drawer has.
 *
 *  This form predated the board. It asked for a title, a horizon, owners and subtasks, and
 *  nothing else — so every card created here arrived with no type, no surface and no brief,
 *  and the only way to supply them was to find the card afterwards and open it. That is why
 *  not one card on the live board has a surface set.
 *
 *  So the rule is: whatever the drawer can hold, this can set. Same fields, same option
 *  lists, same wording — both read from `lib/board.ts` and `lib/qa-labels.ts` rather than
 *  keeping their own copies, which is the only way two forms stay matched after an edit. */

/** What each option means, shared with the drawer's tooltips. */
const HORIZON_NOTE: Record<1 | 2 | 3, string> = {
  1: "This sprint. Unclaimed cards set to Now are handed to PM.",
  2: "Queued behind the current sprint. The default for anything untagged.",
  3: "Parked. A Future card sits in the backlog and off every team board.",
};
const KIND_NOTE: Record<CardKind, string> = {
  bug: "Something broken that a merchant or we reported",
  feature: "Something asked for that does not exist yet",
  module: "A thing we are building, rather than a thing somebody reported",
  template: "A reusable page or layout, including landing pages",
  landing: "A landing page. Folded into Template; kept so old cards still read.",
};

export function AddTaskModal({ onClose, defaultHorizon = 2 }:
  { onClose: () => void; defaultHorizon?: 1 | 2 | 3 }) {
  const s = useStore();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  /* Next everywhere except the sprint, where adding a card means adding it to THIS week:
     the view you are looking at is the commitment you are making. */
  const [priority, setPriority] = useState<1 | 2 | 3>(defaultHorizon);
  const [kind, setKind] = useState<CardKind>("feature");
  const [surface, setSurface] = useState("");
  const [subModule, setSubModule] = useState("");
  const [errorType, setErrorType] = useState("");
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
    s.addTask(title.trim(), priority, eta.trim() || null,
      subs.split("\n").map((x) => x.trim()).filter(Boolean), pending,
      { desc: desc.trim() || null, kind, surface: surface || null, subModule: subModule || null, errorType: errorType || null });
    onClose();
  };

  /* The sub-module list belongs to the surface above it, so changing the surface has to drop
     a stale choice. The store does the same on an existing card. */
  const subs2 = subModulesFor(surface);

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Add a card</h3>
        <div className="modal-sub">The same fields the card itself carries, so nothing has to be filled in twice.</div>

        <div className="field"><label>Title</label>
          <input type="text" value={title} placeholder="e.g. Shipping rate intelligence"
            onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="field"><label>Description <span className="opt">(optional)</span></label>
          <textarea value={desc} rows={3}
            placeholder="What is this, and what does done look like? Anyone picking the card up reads this first."
            onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="modal-grid">
          <div className="field"><label>Horizon</label>
            <select value={priority} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}>
              <option value={1} title={HORIZON_NOTE[1]}>Now</option>
              <option value={2} title={HORIZON_NOTE[2]}>Next</option>
              <option value={3} title={HORIZON_NOTE[3]}>Future</option>
            </select>
            <div className="field-hint">{HORIZON_NOTE[priority]}</div>
          </div>
          <div className="field"><label>Type</label>
            {/* Landing page is filtered out here for the same reason it is in the drawer:
                it is a template with a narrower name, and two words for one thing is how a
                pile stops being searchable. */}
            <select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}>
              {ALL_KINDS.filter((k) => k !== "landing").map((k) => (
                <option key={k} value={k} title={KIND_NOTE[k]}>{KIND_LABEL[k]}</option>
              ))}
            </select>
            <div className="field-hint">{KIND_NOTE[kind]}</div>
          </div>
        </div>

        <div className="modal-grid">
          <div className="field"><label>Surface <span className="opt">(optional)</span></label>
            <select value={surface} onChange={(e) => { setSurface(e.target.value); setSubModule(""); }}>
              <option value="">Not set</option>
              {["Customer Zone", "Merchant Zone"].map((zone) => (
                <optgroup key={zone} label={zone}>
                  {SURFACES.filter((x) => x.zone === zone).map((x) => (
                    <option key={x.id} value={x.id} title={`${x.zone} · ${x.label}`}>{x.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {subs2.length > 1 && (
            <div className="field"><label>Sub-module <span className="opt">(optional)</span></label>
              <select value={subModule} onChange={(e) => setSubModule(e.target.value)}>
                <option value="">Not set</option>
                {subs2.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
          )}
          <div className="field"><label>Error type <span className="opt">(optional)</span></label>
            <select value={errorType} onChange={(e) => setErrorType(e.target.value)}>
              <option value="">Not set</option>
              {ERROR_TYPES.map((x) => <option key={x.id} value={x.id} title={x.note}>{x.label}</option>)}
            </select>
          </div>
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

        <div className="field"><label>Target / note <span className="opt">(optional)</span></label>
          <input type="text" value={eta} placeholder="e.g. August" onChange={(e) => setEta(e.target.value)} />
        </div>
        <div className="field"><label>Subtasks <span className="opt">(optional, one per line)</span></label>
          <textarea value={subs} placeholder={"Research vendors\nConfirm pricing\nShip v1"} onChange={(e) => setSubs(e.target.value)} />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Add card</button>
        </div>
      </div>
    </div>
  );
}
