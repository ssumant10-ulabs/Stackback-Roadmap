"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { TEAM_ORDER } from "@/lib/constants";
import { supabaseEnabled } from "@/lib/remote";
import { IcTrash } from "./icons";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [newName, setNewName] = useState("");
  const add = () => { if (s.addRoadmap(newName)) setNewName(""); };
  const seen: Record<string, 1> = {};
  const people: string[] = [];
  TEAM_ORDER.forEach((t) => (s.data.roster[t] || []).forEach((n) => { if (!seen[n]) { seen[n] = 1; people.push(n); } }));
  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h3>Settings</h3>
        <div className="modal-sub">Manage your product roadmaps and account.</div>
        <div className="settings-section">
          <div className="ss-head">You</div>
          <div className="ss-desc">Your name is stamped on comments and on anything you change. Stored in this browser only, so everyone picks their own.</div>
          <div className="me-row">
            <input type="text" className="me-input" placeholder="Your name" value={s.me}
              onChange={(e) => s.setMe(e.target.value)} spellCheck={false} />
            <div className="me-chips">
              {people.map((n) => (
                <button type="button" key={n} className={`chip${s.me === n ? " active" : ""}`} onClick={() => s.setMe(n)}>{n}</button>
              ))}
            </div>
          </div>
        </div>
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
          <div className="ss-head">Admin UI</div>
          <div className="ss-desc">Where the <b>Admin UI</b> button in the header points, currently the merchant admin module tracker. Shared with the team, so hosting the build somewhere real is a one-time change here.</div>
          <input type="text" className="me-input admin-url-input" spellCheck={false}
            placeholder="http://localhost:4340/Design/Wireframes/StackBack_WIP_Prototype.html" defaultValue={s.adminUrl}
            onBlur={(e) => s.setAdminUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </div>
        <div className="settings-section">
          <div className="ss-head">Storage</div>
          <div className="ss-auth">
            <div className="ss-auth-row">
              <strong>{supabaseEnabled ? "Shared (Supabase)" : "This browser only"}</strong>
              <span className={supabaseEnabled ? "ss-live" : "ss-soon"}>{supabaseEnabled ? "Live" : "Local"}</span>
            </div>
            <p className="ss-desc">
              {supabaseEnabled
                ? "Edits save to the shared backend and appear in everyone else's browser without a reload."
                : "Edits are saved in this browser only, so each teammate sees their own copy. Set the two Supabase env vars to switch the whole team onto one shared roadmap. See SUPABASE.md."}
            </p>
          </div>
        </div>
        <div className="modal-actions"><button className="btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
