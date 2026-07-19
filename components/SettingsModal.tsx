"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { IcTrash } from "./icons";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [newName, setNewName] = useState("");
  const add = () => { if (s.addRoadmap(newName)) setNewName(""); };
  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Settings</h3>
        <div className="modal-sub">Manage your product roadmaps and account.</div>
        <div className="settings-section">
          <div className="ss-head">Product roadmaps</div>
          <div className="ss-desc">Each product gets its own roadmap. Switch between them or create a new one.</div>
          <div>
            {s.data.roadmaps.map((r) => (
              <div key={r.id} className={`rm-item2${r.id === s.data.activeId ? " active" : ""}`}>
                <button type="button" className="rm-radio" aria-label={`Switch to ${r.name}`} onClick={() => s.switchRoadmap(r.id)}>
                  {r.id === s.data.activeId && <span className="dot" />}
                </button>
                <input type="text" className="rm-name" defaultValue={r.name} spellCheck={false}
                  onBlur={(e) => s.renameRoadmap(r.id, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { s.renameRoadmap(r.id, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur(); } }} />
                <span className="rm-count">{r.tasks.length} item{r.tasks.length === 1 ? "" : "s"}</span>
                {s.data.roadmaps.length > 1 && (
                  <button type="button" className="icon-btn danger" aria-label="Delete roadmap"
                    onClick={() => { if (confirm(`Delete “${r.name}” and all its tasks?`)) s.deleteRoadmap(r.id); }}><IcTrash /></button>
                )}
              </div>
            ))}
          </div>
          <div className="roster-add" style={{ marginTop: 10 }}>
            <input type="text" placeholder="New roadmap name, e.g. Milld" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
            <button type="button" onClick={add}>Create</button>
          </div>
        </div>
        <div className="settings-section">
          <div className="ss-head">Account</div>
          <div className="ss-auth">
            <div className="ss-auth-row"><strong>Sign in</strong><span className="ss-soon">Coming soon</span></div>
            <p className="ss-desc">Accounts and login are on the way. Once added, your roadmaps sync to your account and you can share them with your team.</p>
          </div>
        </div>
        <div className="modal-actions"><button className="btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
