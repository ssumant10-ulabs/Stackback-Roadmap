"use client";
import { Fragment, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { DEFAULT_ORDER, DEFAULT_VISIBLE, POCS, colByKey, toCsv, type PilotCol } from "@/lib/pilotColumns";
import { daysSince, fmtShort, parseLoose } from "@/lib/pilotDates";
import type { PilotStore } from "@/lib/types";
import { IcPlus, IcTrash } from "../icons";

const TONE: Record<string, string> = { Activated: "ok", Active: "info", Inactive: "dash" };

/** Stores are read in status blocks, not one flat list: the question is almost always
 *  "what is still inactive", so the rows cluster and carry the status as row colour
 *  rather than only as a pill you have to scan for. */
const GROUPS: { id: string; label: string; blurb: string }[] = [
  { id: "Activated", label: "Activated", blurb: "Live and running" },
  { id: "Active", label: "In conversation", blurb: "Being worked right now" },
  { id: "Inactive", label: "Inactive", blurb: "Stalled or unresponsive" },
  { id: "", label: "No status set", blurb: "Needs triaging" },
];

function Cell({ p, col }: { p: PilotStore; col: PilotCol }) {
  const s = useStore();
  const raw = p[col.key];
  const value = raw === null || raw === undefined ? "" : String(raw);

  if (col.kind === "readonly") {
    return (
      <span className="pl-store">
        {p.url
          ? <a href={p.url.startsWith("http") ? p.url : `https://${p.url}`} target="_blank" rel="noreferrer">{p.name}</a>
          : p.name}
      </span>
    );
  }
  if (col.kind === "date") {
    // Real date input, so the native picker opens and every entry lands in one format.
    // Anything the migration could not read stays visible as text rather than vanishing.
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
    const age = col.key === "lastTouch" ? daysSince(iso) : null;
    if (!iso && value) {
      return (
        <span className="pl-unparsed" title="Not recognised as a date. Pick one to replace it.">
          {value}
          <input type="date" onChange={(e) => s.setPilotField(p.id, col.key, e.target.value)} />
        </span>
      );
    }
    return (
      <span className="pl-datewrap">
        <input className={`pl-in pl-date${iso ? "" : " empty"}`} type="date" value={iso || ""}
          title={iso ? fmtShort(iso) : "Pick a date"}
          onChange={(e) => s.setPilotField(p.id, col.key, e.target.value)} />
        {age !== null && age > 14 && <span className="pl-stale2" title={`Last touched ${age} days ago`}>{age}d</span>}
      </span>
    );
  }
  if (col.kind === "select") {
    const isCategory = col.key === "category";
    const base = isCategory ? s.pilotCategories : (col.options || []);
    // Free-typed values already in the data must not vanish from their own dropdown.
    const opts = value && !base.includes(value) ? [value, ...base] : base;
    return (
      <div className="pl-selwrap">
        <select className={`pl-sel${value ? "" : " empty"}`} value={value}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              const name = window.prompt("New category name:");
              if (name && s.addPilotCategory(name)) s.setPilotField(p.id, col.key, name.trim());
              return;
            }
            s.setPilotField(p.id, col.key, e.target.value);
          }}>
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
          {isCategory && <option value="__new__">+ New category…</option>}
        </select>
        {col.key === "activationStatus" && <span className={`pl-dot t-${TONE[value] || "dash"}`} />}
      </div>
    );
  }
  return (
    <input className={`pl-in${col.kind === "long" ? " long" : ""}`} defaultValue={value} title={value}
      onBlur={(e) => s.setPilotField(p.id, col.key, e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
  );
}

export function PilotsLog() {
  const s = useStore();
  const version = s.getSnapshot();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [poc, setPoc] = useState("");
  const [category, setCategory] = useState("");
  const [adding, setAdding] = useState("");
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [visible, setVisible] = useState<string[]>(DEFAULT_VISIBLE);
  const [picker, setPicker] = useState(false);
  const [dragCol, setDragCol] = useState<string | null>(null);

  const cols = order.filter((k) => visible.includes(k)).map(colByKey).filter(Boolean) as PilotCol[];

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return s.pilots.filter((p) => {
      if (status && (p.activationStatus || "") !== status) return false;
      if (poc && (p.poc || "") !== poc) return false;
      if (category && (p.category || "") !== category) return false;
      if (!t) return true;
      return [p.name, p.url, p.category, p.poc, p.activationNotes, p.onboardingNotes, p.email, p.themeNotes]
        .some((v) => (v || "").toLowerCase().includes(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.pilots, q, status, poc, category, version]);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ g, items: rows.filter((p) => (p.activationStatus || "") === g.id) }))
      .filter((x) => x.items.length),
    [rows]);

  const stats = useMemo(() => {
    const c = (f: (p: PilotStore) => boolean) => rows.filter(f).length;
    return {
      shown: rows.length, all: s.pilots.length,
      activated: c((p) => p.activationStatus === "Activated"),
      active: c((p) => p.activationStatus === "Active"),
      inactive: c((p) => p.activationStatus === "Inactive"),
      noOwner: c((p) => !p.poc),
      noNext: c((p) => !p.activationNotes),
    };
  }, [rows, s.pilots.length]);

  const moveCol = (from: string, to: string) => {
    if (from === to) return;
    const next = order.filter((k) => k !== from);
    next.splice(next.indexOf(to), 0, from);
    setOrder(next);
  };

  const exportCsv = () => {
    const csv = toCsv(rows, order.filter((k) => visible.includes(k)));
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "stackback-pilot-stores.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <div className="pl-statbar">
        <span><b>{stats.shown}</b>{stats.shown !== stats.all && <em> of {stats.all}</em>} stores</span>
        <span className="ok"><b>{stats.activated}</b> activated</span>
        <span className="info"><b>{stats.active}</b> in conversation</span>
        <span className="dim"><b>{stats.inactive}</b> inactive</span>
        <span className={stats.noOwner ? "warn" : "dim"}><b>{stats.noOwner}</b> no owner</span>
        <span className={stats.noNext ? "warn" : "dim"}><b>{stats.noNext}</b> no next step</span>
      </div>

      <div className="pl-tools">
        <input className="pl-search" placeholder="Search stores, owners, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="pl-sel big" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {["Activated", "Active", "Inactive"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="pl-sel big" value={poc} onChange={(e) => setPoc(e.target.value)}>
          <option value="">All owners</option>
          {POCS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select className="pl-sel big" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {[...new Set(s.pilots.map((p) => p.category).filter(Boolean))].map((a) => <option key={a as string} value={a as string}>{a}</option>)}
        </select>
        <div className="pl-right">
          <button type="button" className="btn ghost sm" onClick={() => setPicker(!picker)}>Columns</button>
          <button type="button" className="btn ghost sm" onClick={exportCsv}>Export CSV</button>
          <div className="pl-add">
            <input placeholder="Add a store…" value={adding} onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (s.addPilot(adding)) setAdding(""); } }} />
            <button type="button" onClick={() => { if (s.addPilot(adding)) setAdding(""); }}><IcPlus /></button>
          </div>
        </div>
      </div>

      {picker && (
        <div className="pl-picker">
          {order.map((k) => {
            const c = colByKey(k);
            if (!c || c.kind === "readonly") return null;
            const on = visible.includes(k);
            return (
              <label key={k} className={on ? "on" : ""}>
                <input type="checkbox" checked={on}
                  onChange={() => setVisible(on ? visible.filter((x) => x !== k) : [...visible, k])} />
                {c.label}
              </label>
            );
          })}
          <button type="button" className="btn ghost sm" onClick={() => { setVisible(DEFAULT_VISIBLE); setOrder(DEFAULT_ORDER); }}>Reset</button>
        </div>
      )}

      <div className="pl-wrap">
        <table className="pl-table log">
          <thead>
            <tr>
              <th className="thin">#</th>
              {cols.map((c) => (
                <th key={c.key as string} style={{ minWidth: c.width }}
                  draggable={c.kind !== "readonly"}
                  className={`${dragCol === c.key ? "dragging" : ""}${c.kind !== "readonly" ? " draggable" : ""}`}
                  onDragStart={() => setDragCol(c.key as string)}
                  onDragEnd={() => setDragCol(null)}
                  onDragOver={(e) => { if (dragCol) e.preventDefault(); }}
                  onDrop={() => { if (dragCol) moveCol(dragCol, c.key as string); setDragCol(null); }}
                  title={c.kind !== "readonly" ? "Drag to reorder" : undefined}>
                  {c.label}
                </th>
              ))}
              <th className="thin" />
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ g, items }) => (
              <Fragment key={g.id || "none"}>
                <tr className={`pl-group g-${g.id || "none"}`}>
                  <td colSpan={cols.length + 2}>
                    <span className={`pl-dot t-${TONE[g.id] || "dash"}`} />
                    <b>{g.label}</b>
                    <span className="pl-group-n">{items.length}</span>
                    <em>{g.blurb}</em>
                  </td>
                </tr>
                {items.map((p) => (
                  <tr key={p.id} className={`pl-row s-${g.id || "none"}`}>
                    <td className="num">{p.n}</td>
                    {cols.map((c) => <td key={c.key as string} className={c.kind === "long" ? "wide" : undefined}><Cell p={p} col={c} /></td>)}
                    <td className="row-del">
                      <button type="button" className="icon-btn danger" aria-label={`Remove ${p.name}`}
                        onClick={() => { if (confirm(`Remove ${p.name}?`)) s.delPilot(p.id); }}><IcTrash /></button>
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {!rows.length && <tr><td colSpan={cols.length + 2} className="pl-empty">No stores match those filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="pl-src">Drag a column heading to reorder. Every cell saves as you leave it.</p>
    </>
  );
}
