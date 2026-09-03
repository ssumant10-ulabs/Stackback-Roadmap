"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";

/** Per-browser column choice for the activation log. */
const COLS_KEY = "stackback_pilot_cols_v1";
import { DEFAULT_ORDER, DEFAULT_VISIBLE, POCS, allColumns, cellValue, isCustomKey, toCsv, type PilotCol } from "@/lib/pilotColumns";
import { daysSince, fmtShort, parseLoose } from "@/lib/pilotDates";
import type { PilotStore } from "@/lib/types";
import { IcCaretDown, IcCaretUp, IcPlus, IcTrash } from "../icons";

const TONE: Record<string, string> = { Activated: "ok", Active: "info", Inactive: "dash" };

/** The tones a status may be given. Token names rather than hex, so each one flips with the
 *  theme; every colour here is already defined for both. */
/** A status is free text, so it cannot go into a class name as it stands: "Final Updates"
 *  emitted `g-Final Updates`, which is two classes, and a status called "row" would have
 *  emitted a class the table already styles. */
const slug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "none";

const TONES: { id: string; label: string }[] = [
  { id: "ok", label: "Lime" }, { id: "info", label: "Blue" }, { id: "pink", label: "Pink" },
  { id: "orange", label: "Orange" }, { id: "gold", label: "Gold" }, { id: "red", label: "Red" },
  { id: "dash", label: "Grey" },
];

/** Stores are read in status blocks, not one flat list: the question is almost always
 *  "what is still inactive", so the rows cluster and carry the status as row colour
 *  rather than only as a pill you have to scan for. */
const GROUPS: { id: string; label: string; blurb: string }[] = [
  { id: "Activated", label: "Activated", blurb: "Live and running" },
  { id: "Active", label: "In conversation", blurb: "Being worked right now" },
  { id: "Inactive", label: "Inactive", blurb: "Stalled or unresponsive" },
  { id: "", label: "No status set", blurb: "Needs triaging" },
];

/** Same initials chip the roadmap uses for owners, so a person reads as a person in both
 *  places rather than as a name here and an avatar there. */
function Who({ name }: { name: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return <span className="pl-who" style={{ background: `hsl(${h} 45% 30%)`, color: `hsl(${h} 80% 85%)` }}>{initials}</span>;
}

function Cell({ p, col }: { p: PilotStore; col: PilotCol }) {
  const s = useStore();
  const key = col.key as string;
  const value = cellValue(p, key);

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
    const base = s.optionsFor(key, col.options || []);
    // Free-typed values already in the data must not vanish from their own dropdown.
    const opts = value && !base.includes(value) ? [value, ...base] : base;
    return (
      <div className="pl-selwrap">
        {col.key === "poc" && value && <Who name={value} />}
        <select className={`pl-sel${value ? "" : " empty"}`} value={value}
          onChange={(e) => s.setPilotField(p.id, key, e.target.value)}>
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {col.key === "activationStatus" && <span className={`pl-dot t-${s.colColor("activationStatus", value) || TONE[value] || "dash"}`} />}
      </div>
    );
  }
  return <TextCell p={p} col={col} value={value} />;
}

/** Controlled by state, not by the DOM. It used to use defaultValue, which meant the box kept
 *  showing what was typed even after a save was dropped or a teammate's edit arrived, so the
 *  screen and the record disagreed with nothing to show it. Local draft while focused, so
 *  typing is never fought by a re-render. */
function TextCell({ p, col, value }: { p: PilotStore; col: PilotCol; value: string }) {
  const s = useStore();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft === null ? value : draft;
  const save = () => {
    if (draft !== null && draft !== value) s.setPilotField(p.id, col.key as string, draft);
    setDraft(null);
  };
  /* Notes are sentences, so they wrap. A single-line input clipped them and left the whole
     note readable only through a native tooltip that covered the next row. Two lines at rest,
     the full note on hover or focus. */
  if (col.kind === "long") {
    return (
      <textarea className="pl-in long" value={shown} rows={2} spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") { setDraft(null); (e.target as HTMLTextAreaElement).blur(); }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur();
        }} />
    );
  }
  return (
    <input className="pl-in" value={shown} title={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); }
      }} />
  );
}

/** Manage what each dropdown is allowed to contain. Kept out of the cells on purpose: adding
 *  an option from inside a row also set that row, which is how two stores ended up under a
 *  brand-new status. Here, adding a value changes no store at all. */
/** The list a dropdown offers, in the order it will offer it. Was a dot-joined string, which
 *  said what the values were and gave no way to change which came first or to take one out.
 *
 *  A value some store already holds is not removable. Dropping it from the list would not
 *  drop it from the rows carrying it, and those cells would then show a value their own
 *  dropdown denies, so the count is shown instead and the control is disabled. */
function OptionRows({ col }: { col: PilotCol }) {
  const s = useStore();
  const [palette, setPalette] = useState<string | null>(null);
  const key = col.key as string;
  const base = col.options || [];
  const list = s.optionsFor(key, base);
  /* Colour is offered only where the table shows one. Status drives the group heading, the
     row edge and the dot; the other dropdowns have nowhere to put it yet. */
  const colourable = key === "activationStatus";
  if (!list.length) return <span className="pl-optlist">none yet</span>;
  return (
    <span className="pl-optrows">
      {list.map((v, i) => {
        const uses = s.colOptionUses(key, v);
        const tone = s.colColor(key, v) || TONE[v] || "dash";
        return (
          <Fragment key={v}>
          <span className="pl-optrow">
            <span className="pl-optmv">
              <button type="button" disabled={i === 0} aria-label={`Move ${v} up`} title="Move up"
                onClick={() => s.moveColOption(key, base, v, "up")}><IcCaretUp /></button>
              <button type="button" disabled={i === list.length - 1} aria-label={`Move ${v} down`} title="Move down"
                onClick={() => s.moveColOption(key, base, v, "down")}><IcCaretDown /></button>
            </span>
            <span className="pl-optname">{v}</span>
            {uses > 0 && <span className="pl-optuse" title={`${uses} store${uses === 1 ? "" : "s"} set to this`}>{uses}</span>}
            {colourable && (
              <button type="button" className={`pl-optswatch t-${tone}`}
                aria-label={`Colour for ${v}`} aria-expanded={palette === v} title="Colour"
                onClick={() => setPalette(palette === v ? null : v)}><i /></button>
            )}
            <button type="button" className="pl-optdel" disabled={uses > 0}
              aria-label={`Remove ${v}`}
              title={uses > 0
                ? `${uses} store${uses === 1 ? " is" : "s are"} set to this, so it cannot be removed`
                : `Remove ${v}`}
              onClick={() => s.removeColOption(key, v)}><IcTrash /></button>
          </span>
          {colourable && palette === v && (
            <span className="pl-optpalette" role="group" aria-label={`Colour for ${v}`}>
              {TONES.map((t) => (
                <button type="button" key={t.id} className={`t-${t.id}`} title={t.label}
                  aria-label={t.label} aria-pressed={tone === t.id}
                  onClick={() => { s.setColColor(key, v, t.id); setPalette(null); }} />
              ))}
              <button type="button" className="pl-optclear" title="Back to the default colour"
                onClick={() => { s.setColColor(key, v, ""); setPalette(null); }}>Default</button>
            </span>
          )}
          </Fragment>
        );
      })}
    </span>
  );
}

function OptionEditor({ cols }: { cols: PilotCol[] }) {
  const s = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const selects = cols.filter((c) => c.kind === "select");
  if (!selects.length) return null;
  const openCol = selects.find((c) => (c.key as string) === open) || null;
  return (
    <div className="pl-opts">
      <span className="pl-opts-hd">Dropdown values</span>
      <span className="pl-optpills">
        {selects.map((c) => {
          const key = c.key as string;
          const n = s.optionsFor(key, c.options || []).length;
          return (
            <span key={key} className={`pl-optgrp${open === key ? " open" : ""}`}>
              <button type="button" onClick={() => { setOpen(open === key ? null : key); setDraft(""); }}>
                {c.label} <em>{n}</em>
              </button>
            </span>
          );
        })}
      </span>
      {openCol && (
        <span className="pl-optbody">
          <OptionRows col={openCol} />
          <input placeholder={`New ${openCol.label.toLowerCase()} value…`} value={draft} autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (s.addColOption(openCol.key as string, draft)) setDraft("");
            }} />
          <button type="button"
            onClick={() => { if (s.addColOption(openCol.key as string, draft)) setDraft(""); }}>Add</button>
        </span>
      )}
    </div>
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
  const [colsReady, setColsReady] = useState(false);
  /* Which columns you chose is a per-person view preference, so it belongs in this browser
     rather than in the shared record. It used to live only in component state, which meant
     every reload threw the choice away. */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLS_KEY);
      if (!raw) return;
      const p = JSON.parse(raw);
      if (Array.isArray(p.order) && p.order.length) setOrder(p.order);
      if (Array.isArray(p.visible)) setVisible(p.visible);
    } catch {}
    setColsReady(true);
  }, []);
  useEffect(() => {
    if (!colsReady) return;
    try { localStorage.setItem(COLS_KEY, JSON.stringify({ order, visible })); } catch {}
  }, [order, visible, colsReady]);
  const [picker, setPicker] = useState(false);
  const [dragCol, setDragCol] = useState<string | null>(null);

  const [newCol, setNewCol] = useState("");
  const [newColKind, setNewColKind] = useState<"text" | "select" | "long" | "date">("text");
  const every = allColumns(s.customCols);
  const byKey = (k: string) => every.find((c) => (c.key as string) === k);
  // A column added since this browser saved its order would otherwise never appear.
  const added = every.map((c) => c.key as string).filter((k) => !order.includes(k));
  const fullOrder = [...order, ...added];
  // Custom columns are visible until explicitly unticked: a column nobody can see is not a
  // column. `added` are the ones this browser has not recorded a choice for yet.
  const shown = (k: string) => visible.includes(k) || added.includes(k);
  const cols = fullOrder.filter(shown).map(byKey).filter(Boolean) as PilotCol[];

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

  /* Every row must land in a group. The four in GROUPS are the ones with a meaning worth
     spelling out; a status the team adds gets a group of its own rather than falling through
     the gaps. Adding a status used to make its stores vanish from the table entirely, which
     read as data loss even though the records were intact.
     
     Group order follows the dropdown, so reordering a status in the values panel moves its
     rows here too. It used to be GROUPS then the team's own statuses sorted alphabetically
     after them, which pinned a team-added status to the bottom whatever the panel said. */
  const grouped = useMemo(() => {
    const meta = new Map(GROUPS.map((g) => [g.id, g]));
    const listed = s.optionsFor("activationStatus", ["Activated", "Active", "Inactive"]);
    const inData = [...new Set(rows.map((p) => p.activationStatus || ""))];
    // A status still on rows but no longer offered (removed from the panel) sorts last, so
    // its stores stay visible instead of dropping out of the table.
    const stray = inData.filter((v) => v !== "" && !listed.includes(v)).sort();
    const ids = [...new Set([...listed, "", ...stray])];
    return ids
      .map((id) => meta.get(id) || { id, label: id, blurb: "Added by the team" })
      .map((g) => ({ g, items: rows.filter((p) => (p.activationStatus || "") === g.id) }))
      .filter((x) => x.items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, s, version]);

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

  /** A new column starts visible: the team just asked for it, so hiding it would be perverse. */
  const addCol = () => {
    const key = s.addCustomCol(newCol, newColKind);
    if (!key) return;
    setVisible([...visible, key]);
    setOrder([...order, key]);
    setNewCol("");
  };
  const exportCsv = () => {
    const csv = toCsv(rows, fullOrder.filter(shown), s.customCols);
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
          {s.optionsFor("activationStatus", ["Activated", "Active", "Inactive"])
            .map((a) => <option key={a} value={a}>{a}</option>)}
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
          {fullOrder.map((k) => {
            const c = byKey(k);
            if (!c || c.kind === "readonly") return null;
            const on = shown(k);
            return (
              <label key={k} className={on ? "on" : ""}>
                <input type="checkbox" checked={on}
                  onChange={() => setVisible(on ? visible.filter((x) => x !== k) : [...visible, k])} />
                {c.label}
                {isCustomKey(k) && (
                  <button type="button" className="pl-colx" title={`Delete the ${c.label} column and its values`}
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation();
                      if (confirm(`Delete the "${c.label}" column? The values stored under it go too.`)) {
                        s.removeCustomCol(k);
                        setVisible(visible.filter((x) => x !== k));
                        setOrder(order.filter((x) => x !== k));
                      }
                    }}>×</button>
                )}
              </label>
            );
          })}
          <span className="pl-newcol">
            <input placeholder="New column…" value={newCol} onChange={(e) => setNewCol(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCol(); } }} />
            <select value={newColKind} onChange={(e) => setNewColKind(e.target.value as "text" | "select" | "long" | "date")}>
              <option value="text">Text</option>
              <option value="select">Dropdown</option>
              <option value="long">Long text</option>
              <option value="date">Date</option>
            </select>
            <button type="button" onClick={addCol}>Add</button>
          </span>
          <button type="button" className="btn ghost sm" onClick={() => { setVisible(DEFAULT_VISIBLE); setOrder(DEFAULT_ORDER); }}>Reset</button>
        </div>
      )}

      {picker && <OptionEditor cols={fullOrder.map(byKey).filter(Boolean) as PilotCol[]} />}

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
                <tr className={`pl-group g-${slug(g.id)} t-${s.colColor("activationStatus", g.id) || TONE[g.id] || "dash"}`}>
                  <td colSpan={cols.length + 2}>
                    <span className="pl-dot" />
                    <b>{g.label}</b>
                    <span className="pl-group-n">{items.length}</span>
                    <em>{g.blurb}</em>
                  </td>
                </tr>
                {items.map((p) => (
                  <tr key={p.id} className={`pl-row s-${slug(g.id)} t-${s.colColor("activationStatus", g.id) || TONE[g.id] || "dash"}`}>
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
