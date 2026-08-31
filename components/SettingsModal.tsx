"use client";
import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { TEAM_ORDER } from "@/lib/constants";
import { firebaseEnabled } from "@/lib/firebase";
import { PALETTES } from "@/lib/palettes";
import { IcTrash } from "./icons";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const [newName, setNewName] = useState("");
  const [restore, setRestore] = useState("");
  const add = () => { if (s.addRoadmap(newName)) setNewName(""); };
  const sum = s.stateSummary();
  const snaps = s.snapshots();
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([JSON.stringify(s.exportState(), null, 1)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stackback-roadmap-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const upload = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      const ok = s.importState(String(r.result));
      alert(ok ? "Backup restored." : "That file could not be read as a StackBack backup. Nothing was changed.");
    };
    r.readAsText(f);
  };

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
          <div className="ss-head">Appearance</div>
          <div className="ss-desc">Light and dark follow the theme button in the header. Each theme changes the whole surface treatment, not just the accent. The status colours stay put so shipped, in progress and late keep their meaning. Stored in this browser, so everyone can try one.</div>
          <div className="pal-row">
            {PALETTES.map((pl) => (
              <button type="button" key={pl.id}
                className={`pal${s.ui.palette === pl.id ? " on" : ""}`}
                onClick={() => s.setPalette(pl.id)} title={pl.label}>
                <span className="pal-dot" style={{ background: pl.swatch }} />
                {pl.label}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-section">
          <div className="ss-head">Admin UI</div>
          <div className="ss-desc">Where the <b>Admin UI</b> button in the header points, currently the merchant admin module tracker. Shared with the team, so hosting the build somewhere real is a one-time change here.</div>
          <input type="text" className="me-input admin-url-input" spellCheck={false}
            placeholder="/merchant/StackBack_WIP_Prototype.html" defaultValue={s.adminUrl}
            onBlur={(e) => s.setAdminUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        </div>
        <div className="settings-section">
          <div className="ss-head">Backup &amp; restore</div>
          <div className="ss-desc">
            {firebaseEnabled
              ? "Your roadmap lives in Firestore, so this is an export rather than a safety net. Restoring replaces what the whole team sees."
              : "Until the shared backend is on, this browser holds the only copy of your edits. Nothing syncs between browsers or devices."}
          </div>
          <div className="bk-now">
            Currently holding <b>{sum.tasks}</b> tasks ({sum.done} done), <b>{sum.features}</b> features,
            <b> {sum.pilots}</b> pilot stores.
          </div>
          <div className="bk-actions">
            <button type="button" className="btn" onClick={download}>Download backup</button>
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}>Restore from file</button>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0];
                const warn = firebaseEnabled
                  ? "Restore this backup? It replaces the roadmap for everyone on the shared backend, not just you."
                  : "Restore this backup? It replaces everything currently in this browser.";
                if (f && confirm(warn)) upload(f); e.target.value = ""; }} />
          </div>
          {!firebaseEnabled && snaps.length > 0 && (
            <div className="bk-snaps">
              <div className="bk-snaps-h">
                Recovery points, taken before resets and imports
                <button type="button" className="bk-clear"
                  onClick={() => { if (confirm("Clear all recovery points on this browser?")) s.clearSnapshots(); }}>Clear</button>
              </div>
              {snaps.map((sn) => (
                <div className="bk-snap" key={sn.at}>
                  <span>{new Date(sn.at).toLocaleString()}</span>
                  <em>{sn.reason}</em>
                  <button type="button" className="btn ghost sm"
                    onClick={() => { if (confirm(`Restore the snapshot from ${new Date(sn.at).toLocaleString()}? It replaces everything currently in this browser.`)) alert(s.restoreSnapshot(sn.at) ? "Snapshot restored." : "That snapshot could not be read."); }}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="settings-section">
          <div className="ss-head">Storage</div>
          <div className="ss-auth">
            <div className="ss-auth-row">
              <strong>{firebaseEnabled ? "Shared (Firestore)" : "This browser only"}</strong>
              <span className={firebaseEnabled ? "ss-live" : "ss-soon"}>{firebaseEnabled ? "Live" : "Local"}</span>
            </div>
            <p className="ss-desc">
              {firebaseEnabled
                ? "Edits save to the shared backend and appear in everyone else's browser without a reload."
                : "Edits are saved in this browser only, so each teammate sees their own copy. Set the Firebase env vars to switch the whole team onto one shared roadmap behind a login. See FIREBASE.md."}
            </p>
            {firebaseEnabled && (
              <>
                <p className="ss-desc">
                  {s.migrated === "promoted"
                    ? "This browser's saved board was carried up and is now the shared copy."
                    : s.migrated === "seeded"
                      ? "Nothing had been saved yet, so the shared copy started from the default roadmap."
                      : "A shared copy already existed, so this browser is showing that one."}
                </p>
                <button
                  className="btn"
                  onClick={async () => {
                    if (!confirm("Replace the shared board with the copy saved in this browser? Everyone will see this browser's version instead. Use this only if the wrong browser connected first.")) return;
                    const r = await s.restoreLocal();
                    setRestore(r.ok ? `Restored ${r.tasks} tasks from this browser.` : "This browser has no saved copy to restore.");
                  }}
                >
                  Restore this browser's copy
                </button>
                {restore && <p className="ss-desc">{restore}</p>}
              </>
            )}
          </div>
        </div>
        <div className="modal-actions"><button className="btn primary" onClick={onClose}>Done</button></div>
      </div>
    </div>
  );
}
