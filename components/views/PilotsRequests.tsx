"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Feature } from "@/lib/types";
import { IcPlus, IcTrash } from "../icons";

/** What merchants have asked for, logged against the store that asked. These are the same
 *  records as the Features module's merchant block: CS logs it here, PM sees it there,
 *  with one list underneath so the two can never disagree. */

const URGENCY = ["High", "Medium", "Low"];
const U_TONE: Record<string, string> = { High: "crit", Medium: "warn", Low: "neu" };

function Row({ f }: { f: Feature }) {
  const s = useStore();
  const status = s.featureStatus(f);
  const task = s.featureTask(f);
  return (
    <tr className={f.kind === "bug" ? "rq-bug" : undefined}>
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
      <td><span className="rq-status">{status}</span></td>
      <td>{task ? <span className="rq-task" title={task.title}>{task.title}</span> : <span className="rq-none">Not on the board</span>}</td>
      <td className="wide">
        <input className="pl-in long" defaultValue={f.objective || ""} placeholder="What exactly did they ask for?"
          onBlur={(e) => s.setFeatureField(f.id, "objective", e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      </td>
      <td className="row-del">
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
  const [nt, setNt] = useState({ store: "", title: "", kind: "feature" as "feature" | "bug", urgency: "Medium" });

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return s.requests.filter((f) => {
      if (store && f.storeId !== store) return false;
      if (kind && (f.kind || "feature") !== kind) return false;
      if (urg && (f.urgency || "") !== urg) return false;
      if (!t) return true;
      return [f.title, f.objective, f.storeName, f.requestedBy].some((v) => (v || "").toLowerCase().includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.requests, q, store, kind, urg, version]);

  const stats = useMemo(() => ({
    total: s.requests.length,
    bugs: s.requests.filter((f) => f.kind === "bug").length,
    high: s.requests.filter((f) => f.urgency === "High").length,
    onBoard: s.requests.filter((f) => s.featureTask(f)).length,
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
        </select>
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
            <tr><th>Type</th><th>Request</th><th>Store</th><th>Priority</th><th>Status</th><th>On the roadmap</th><th className="wide">Detail</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((f) => <Row key={f.id} f={f} />)}
            {!rows.length && <tr><td colSpan={8} className="pl-empty">Nothing logged yet. Add the first one above.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="pl-src">These are the same records as the Features module&apos;s merchant block, so PM sees anything you log here. Status follows the roadmap once a request is picked up.</p>
    </>
  );
}
