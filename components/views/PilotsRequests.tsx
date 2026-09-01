"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { ISSUE_TYPES } from "@/lib/pilotColumns";
import type { Feature } from "@/lib/types";
import { IcPlus, IcTrash } from "../icons";
import { SHOT_MAX_PER_REQUEST, SHOT_TOTAL_BUDGET, fmtBytes, uploadShot } from "@/lib/shots";
import { firebaseEnabled, storageConfigured } from "@/lib/firebase";

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
        const { src, bytes } = await uploadShot(file, f.id);
        // bytes is 0 for a hosted image, so it costs nothing against the local budget.
        const r = s.addShot(f.id, file.name, src, bytes);
        if (!r.ok) { alert(r.error); break; }
      } catch (e) { alert("Could not attach that image: " + (e as Error).message); break; }
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
          {(!firebaseEnabled || storageConfigured()) && (
            <button type="button" className="sh-add" disabled={busy} title="Upload a screenshot from this machine"
              onClick={() => ref.current?.click()}>{busy ? "…" : "+"}</button>
          )}
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

/** Controlled, with a local draft while focused. An uncontrolled input keeps displaying what
 *  was typed even when the save was dropped or a teammate's edit arrived, so the screen and
 *  the record silently disagree. */
function Field({ value, onSave, className, placeholder }:
  { value: string; onSave: (v: string) => void; className?: string; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft === null ? value : draft;
  return (
    <input className={className} value={shown} title={shown} placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== null && draft !== value) onSave(draft); setDraft(null); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); }
      }} />
  );
}

function Row({ f, promoted, picked, onPick }:
  { f: Feature; promoted?: boolean; picked: boolean; onPick: (id: string, on: boolean) => void }) {
  const s = useStore();
  const own = f.sheetStatus || "Not started";
  return (
    <tr className={`${f.kind === "bug" ? "rq-bug" : ""}${promoted ? " rq-promoted" : ""}${picked ? " rq-picked" : ""}`.trim() || undefined}>
      <td className="rq-pick">
        <input type="checkbox" checked={picked} aria-label={`Select ${f.title}`}
          onChange={(e) => onPick(f.id, e.target.checked)} />
      </td>
      <td>
        <select className="pl-sel" value={f.kind || "feature"}
          onChange={(e) => s.setRequestKind(f.id, e.target.value as "feature" | "bug")}>
          <option value="feature">Feature</option>
          <option value="bug">Bug</option>
        </select>
      </td>
      <td>
        {f.kind === "bug" ? (
          <select className={`pl-sel${f.issueType ? "" : " empty"}`} value={f.issueType || ""}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                const name = window.prompt("New issue type:");
                if (name && s.addColOption("issueType", name)) s.setRequestIssueType(f.id, name.trim());
                return;
              }
              s.setRequestIssueType(f.id, e.target.value);
            }}>
            <option value="">—</option>
            {s.optionsFor("issueType", ISSUE_TYPES).map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__new__">+ Add option…</option>
          </select>
        ) : null}
      </td>
      <td className="rq-title">
        <Field className="pl-in" value={f.title} onSave={(v) => s.setFeatureField(f.id, "title", v)} />
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
            onChange={(e) => {
              if (e.target.value === "__new__") {
                const name = window.prompt("New priority:");
                if (name && s.addColOption("urgency", name)) s.setRequestUrgency(f.id, name.trim());
                return;
              }
              s.setRequestUrgency(f.id, e.target.value);
            }}>
            <option value="">—</option>
            {s.optionsFor("urgency", URGENCY).map((u) => <option key={u} value={u}>{u}</option>)}
            <option value="__new__">+ Add option…</option>
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
      <td><Shots f={f} /></td>
      <td className="wide">
        <Field className="pl-in long" value={f.objective || ""} placeholder="What exactly did they ask for?"
          onSave={(v) => s.setFeatureField(f.id, "objective", v)} />
      </td>
      <td className="rq-actions">
        {promoted ? (
          <span className="rq-moved" title="Moved into the roadmap's feature list">In features</span>
        ) : f.kind === "bug" ? null : (
          <button type="button" className="btn ghost sm" title="We have decided to build this: move it into the roadmap's feature list, keeping the store attached"
            onClick={() => { if (confirm(`Move "${f.title}" into the roadmap features?\n\n${f.storeName || f.requestedBy || "The store"} stays attached, and it remains visible here under "include moved to features".`)) s.moveRequestToFeatures(f.id); }}>
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
  const [sel, setSel] = useState<Set<string>>(new Set());
  const pick = (id: string, on: boolean) =>
    setSel((prev) => { const next = new Set(prev); if (on) next.add(id); else next.delete(id); return next; });

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

  const visibleIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  useEffect(() => {
    setSel((prev) => {
      const kept = [...prev].filter((id) => visibleIds.has(id));
      return kept.length === prev.size ? prev : new Set(kept);
    });
  }, [visibleIds]);
  const picked = [...sel];
  const allPicked = rows.length > 0 && picked.length === rows.length;
  const somePicked = picked.length > 0;
  /** Applies to the selection, then clears it: leaving rows selected after an action invites
   *  a second one nobody meant. */
  const applyBulk = (patch: Parameters<typeof s.bulkRequests>[1]) => {
    if (!picked.length) return;
    s.bulkRequests(picked, patch);
    setSel(new Set());
  };

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

      {somePicked && (
        <div className="rq-bulk">
          <span className="rq-bulk-n"><b>{picked.length}</b> selected</span>
          <select className="pl-sel" value="" onChange={(e) => applyBulk({ status: e.target.value })}>
            <option value="">Set status…</option>
            {STATUS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <select className="pl-sel" value="" onChange={(e) => applyBulk({ urgency: e.target.value === "__clear__" ? "" : e.target.value })}>
            <option value="">Set priority…</option>
            {s.optionsFor("urgency", URGENCY).map((u) => <option key={u} value={u}>{u}</option>)}
            <option value="__clear__">Clear priority</option>
          </select>
          <select className="pl-sel" value="" onChange={(e) => applyBulk({ kind: e.target.value as "feature" | "bug" })}>
            <option value="">Set type…</option>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
          </select>
          <select className="pl-sel" value="" onChange={(e) => applyBulk({ issueType: e.target.value === "__clear__" ? "" : e.target.value })}>
            <option value="">Set issue type…</option>
            {s.optionsFor("issueType", ISSUE_TYPES).map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__clear__">Clear issue type</option>
          </select>
          <button type="button" className="btn ghost sm danger"
            onClick={() => {
              if (!confirm(`Delete ${picked.length} request(s)? This cannot be undone.`)) return;
              s.bulkDeleteRequests(picked);
              setSel(new Set());
            }}>Delete</button>
          <button type="button" className="btn ghost sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      <div className="pl-wrap">
        <table className="pl-table log">
          <thead>
            <tr>
              <th className="rq-pick">
                <input type="checkbox" aria-label="Select every row shown"
                  checked={allPicked} ref={(el) => { if (el) el.indeterminate = somePicked && !allPicked; }}
                  onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} />
              </th>
              <th>Type</th><th>Issue type</th><th>Request</th><th>Store</th><th>Priority</th><th>Status</th><th>Screenshots</th><th className="wide">Detail</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <Row key={f.id} f={f} promoted={f.band !== "merchant"}
                picked={sel.has(f.id)} onPick={pick} />
            ))}
            {!rows.length && (
              <tr><td colSpan={10} className="pl-empty">
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
    </>
  );
}
