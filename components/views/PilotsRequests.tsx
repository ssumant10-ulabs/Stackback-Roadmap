"use client";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Feature } from "@/lib/types";
import { IcPlus, IcTrash } from "../icons";
import { SHOT_MAX_PER_REQUEST, SHOT_TOTAL_BUDGET, downscale, fmtBytes } from "@/lib/shots";

/** What merchants have asked for, logged against the store that asked. These are the same
 *  records as the Features module's merchant block: CS logs it here, PM sees it there,
 *  with one list underneath so the two can never disagree. */

const URGENCY = ["High", "Medium", "Low"];
/** CS tracks three states. Anything richer belongs on the board, which this row also shows. */
const STATUS = ["Not started", "In progress", "Done"];
const S_TONE: Record<string, string> = { "Not started": "dash", "In progress": "warn", Done: "ok" };
const U_TONE: Record<string, string> = { High: "crit", Medium: "warn", Low: "neu" };

function Shots({ f }: { f: Feature }) {
  const s = useStore();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const shots = f.shots || [];

  const pick = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        const { src, bytes } = await downscale(file);
        const r = s.addShot(f.id, file.name, src, bytes);
        if (!r.ok) { alert(r.error); break; }
      } catch (e) { alert((e as Error).message); break; }
    }
    setBusy(false);
  };

  return (
    <div className="sh-cell">
      {shots.map((sh) => (
        <span className="sh-thumb" key={sh.id}>
          <img src={sh.src} alt={sh.name}
            title={`${sh.name} · ${sh.bytes ? fmtBytes(sh.bytes) : "linked, costs no storage"}`}
            onClick={() => { const w = window.open(); if (w) w.document.write(`<title>${sh.name}</title><img src="${sh.src}" style="max-width:100%">`); }} />
          <button type="button" aria-label={`Remove ${sh.name}`}
            onClick={() => { if (confirm(`Remove ${sh.name}?`)) s.delShot(f.id, sh.id); }}>×</button>
        </span>
      ))}
      {shots.length < SHOT_MAX_PER_REQUEST && (
        <>
          <button type="button" className="sh-add" disabled={busy} title="Upload a screenshot from this machine"
            onClick={() => ref.current?.click()}>{busy ? "…" : "+"}</button>
          <button type="button" className="sh-add link" title="Paste a link to a hosted image"
            onClick={() => {
              const u = window.prompt("Paste the image link (Drive, Imgur, S3, anywhere public):");
              if (!u) return;
              const r = s.addShotLink(f.id, u);
              if (!r.ok) alert(r.error);
            }}>🔗</button>
        </>
      )}
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

function Row({ f, promoted }: { f: Feature; promoted?: boolean }) {
  const s = useStore();
  const own = f.sheetStatus || "Not started";
  const board = s.featureBoardStatus(f);
  const task = s.featureTask(f);
  return (
    <tr className={`${f.kind === "bug" ? "rq-bug" : ""}${promoted ? " rq-promoted" : ""}`.trim() || undefined}>
      <td>
        <select className="pl-sel" value={f.kind || "feature"}
          onChange={(e) => s.setRequestKind(f.id, e.target.value as "feature" | "bug")}>
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
        </select>
      </td>
      <td className="rq-title">
        <input className="pl-in" defaultValue={f.title} title={f.title}
          onBlur={(e) => s.setFeatureField(f.id, "title", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </td>
      <td>
        <select className="pl-sel" value={f.storeId || ""}
          onChange={(e) => s.setRequestStore(f.id, e.target.value || null)}>
          <option value="">{f.requestedBy && !f.storeId ? f.requestedBy : "—"}</option>
          {s.pilots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </td>
      <td>
        <div className="pl-selwrap">
          <select className="pl-sel" value={f.urgency || ""}
            onChange={(e) => s.setRequestUrgency(f.id, e.target.value)}>
            <option value="">—</option>
            {URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          {f.urgency && <span className={`rq-dot t-${U_TONE[f.urgency] || "neu"}`} />}
        </div>
      </td>
      <td>
        <div className="pl-selwrap">
          <select className="pl-sel" value={STATUS.includes(own) ? own : "Not started"}
            onChange={(e) => s.setRequestStatus(f.id, e.target.value)}>
            {STATUS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <span className={`rq-dot t-${S_TONE[own] || "dash"}`} />
        </div>
      </td>
      <td className="rq-board">
        {task ? (
          <span className="rq-task" title={`${task.title} · board says ${board}`}>
            {task.title}<em>{board}</em>
            <button type="button" className="rq-unlink" title="Detach from this task"
              onClick={() => s.linkFeature(f.id, null)}>×</button>
          </span>
        ) : (
          <select className="pl-sel rq-link" value=""
            title="Attach this request to a milestone already on the board"
            onChange={(e) => { if (e.target.value) s.linkFeature(f.id, e.target.value); }}>
            <option value="">Not on the board</option>
            {s.tasks.map((t2) => <option key={t2.id} value={t2.id}>{t2.title}</option>)}
          </select>
        )}
      </td>
      <td><Shots f={f} /></td>
      <td className="wide">
        <input className="pl-in long" defaultValue={f.objective || ""} placeholder="What exactly did they ask for?"
          onBlur={(e) => s.setFeatureField(f.id, "objective", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </td>
      <td className="rq-actions">
        {promoted ? (
          <span className="rq-moved" title="Moved to the roadmap features list">In features</span>
        ) : (
          <button type="button" className="btn ghost sm" title="We have decided to build this: move it into the roadmap's feature list, keeping the store attached"
            onClick={() => { if (confirm(`Move "${f.title}" into the roadmap features?\n\nIt leaves this list as a merchant ask and becomes planned work. ${f.storeName || f.requestedBy || "The store"} stays attached so you can still see who asked.`)) s.moveRequestToFeatures(f.id); }}>
            To features
          </button>
        )}
        <button type="button" className="icon-btn danger" aria-label="Remove request"
          onClick={() => { if (confirm(`Remove "${f.title}"?`)) s.delFeature(f.id); }}><IcTrash /></button>
      </td>
    </tr>
  );
}

export function PilotsRequests() {
  const s = useStore();
  const version = s.getSnapshot();
  const [q, setQ] = useState("");
  const [store, setStore] = useState("");
  const [kind, setKind] = useState("");
  const [urg, setUrg] = useState("");
  const [showMoved, setShowMoved] = useState(false);
  const [nt, setNt] = useState({ store: "", title: "", kind: "feature" as "feature" | "bug", urgency: "Medium" });

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const base = showMoved ? [...s.requests, ...s.promotedRequests] : s.requests;
    return base.filter((f) => {
      if (store && f.storeId !== store) return false;
      if (kind && (f.kind || "feature") !== kind) return false;
      if (urg === "__none__") { if (f.urgency) return false; }
      else if (urg && (f.urgency || "") !== urg) return false;
      if (!t) return true;
      return [f.title, f.objective, f.storeName, f.requestedBy].some((v) => (v || "").toLowerCase().includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.requests, q, store, kind, urg, showMoved, version]);

  const anyFilter = !!(q || store || kind || urg);

  const stats = useMemo(() => ({
    total: s.requests.length,
    bugs: s.requests.filter((f) => f.kind === "bug").length,
    high: s.requests.filter((f) => f.urgency === "High").length,
    onBoard: s.requests.filter((f) => s.featureTask(f)).length,
    done: s.requests.filter((f) => (f.sheetStatus || "") === "Done").length,
    unattached: s.requests.filter((f) => !f.storeId).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [s.requests, version]);

  const add = () => {
    if (!nt.title.trim()) return;
    s.addRequest(nt.store, nt.title, nt.kind, nt.urgency);
    setNt({ ...nt, title: "" });
  };

  return (
    <>
      <div className="pl-statbar">
        <span><b>{rows.length}</b>{rows.length !== stats.total && <em> of {stats.total}</em>} requests</span>
        <span className="warn"><b>{stats.bugs}</b> bugs</span>
        <span className="warn"><b>{stats.high}</b> high priority</span>
        <span className="ok"><b>{stats.done}</b> done</span>
        <span className="info"><b>{stats.onBoard}</b> on the roadmap</span>
        <span className={stats.unattached ? "warn" : "dim"}><b>{stats.unattached}</b> no store attached</span>
      </div>

      <div className="pl-tools">
        <input className="pl-search" placeholder="Search requests…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="pl-sel big" value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="">All stores</option>
          {s.pilots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="pl-sel big" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Features & bugs</option>
          <option value="feature">Features</option>
          <option value="bug">Bugs</option>
        </select>
        <select className="pl-sel big" value={urg} onChange={(e) => setUrg(e.target.value)}>
          <option value="">All priorities</option>
          {URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
          <option value="__none__">No priority set</option>
        </select>
        <label className="rq-toggle">
          <input type="checkbox" checked={showMoved} onChange={(e) => setShowMoved(e.target.checked)} />
          Include moved to features
        </label>
      </div>

      <div className="rq-add">
        <select className="pl-sel big" value={nt.store} onChange={(e) => setNt({ ...nt, store: e.target.value })}>
          <option value="">Which store?</option>
          {s.pilots.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="pl-sel big" value={nt.kind} onChange={(e) => setNt({ ...nt, kind: e.target.value as "feature" | "bug" })}>
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
        </select>
        <select className="pl-sel big" value={nt.urgency} onChange={(e) => setNt({ ...nt, urgency: e.target.value })}>
          {URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <input placeholder="What did they ask for?" value={nt.title}
          onChange={(e) => setNt({ ...nt, title: e.target.value })}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn primary" onClick={add}><IcPlus /> Log it</button>
      </div>

      <div className="pl-wrap">
        <table className="pl-table log">
          <thead>
            <tr><th>Type</th><th>Request</th><th>Store</th><th>Priority</th><th>Status</th><th>On the roadmap</th><th>Screenshots</th><th className="wide">Detail</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((f) => <Row key={f.id} f={f} promoted={f.band !== "merchant"} />)}
            {!rows.length && (
              <tr><td colSpan={9} className="pl-empty">
                {anyFilter ? (
                  <>
                    No requests match those filters.
                    <button type="button" className="btn ghost sm" style={{ marginLeft: 10 }}
                      onClick={() => { setQ(""); setStore(""); setKind(""); setUrg(""); }}>Clear filters</button>
                  </>
                ) : "Nothing logged yet. Add the first one above."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="pl-src">
        Same records as the Features module&apos;s merchant block, so PM sees anything you log here.
        <b> Status</b> is yours; the roadmap column shows how far delivery has actually got.
        <b> Images</b>: upload with <b>+</b> (downscaled and stored in this browser, up to
        {" "}{fmtBytes(SHOT_TOTAL_BUDGET)} across everything, {fmtBytes(s.shotBytesUsed())} used) or paste a
        link with the chain icon, which costs no storage at all and is the better option for anything
        you already host. {SHOT_MAX_PER_REQUEST} images per request either way.
      </p>
    </>
  );
}
