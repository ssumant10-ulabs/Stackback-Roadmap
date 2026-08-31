"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Feature, FeatureBand } from "@/lib/types";
import { IcLink, IcPlus, IcTrash } from "../icons";
import { STATES, stateOf, waveWord } from "@/lib/derive";
import { useAppUi } from "../appui";

const BANDS: { id: FeatureBand; label: string; blurb: string }[] = [
  { id: "upcoming", label: "Upcoming", blurb: "Planned and upcoming, block A of the sheet." },
  { id: "merchant", label: "Merchant requested", blurb: "Asked for by pilot stores, block B." },
  { id: "partner", label: "Partner & integrations", blurb: "Third-party and platform, block C." },
];

/** The sheet uses eight status words for what are really three states. The filter buckets
 *  them; the row still shows the precise word, because "In Design" and "In Dev" matter to
 *  whoever owns it even when they filter the same way. */
export const STATUS_BUCKETS: { id: string; label: string; match: (s: string) => boolean }[] = [
  { id: "progress", label: "In progress", match: (x) => ["in dev", "in design", "in review", "planning"].includes(x.toLowerCase()) },
  { id: "done", label: "Done", match: (x) => x.toLowerCase() === "done" },
  { id: "backlog", label: "Backlog", match: (x) => ["backlog", "planned", "not started", ""].includes(x.toLowerCase()) },
];

const STATUS_TONE: Record<string, string> = {
  Done: "ok", "In Dev": "warn", "In Design": "info", "In Review": "info",
  Planning: "neu", Planned: "neu", Backlog: "dash", "Not started": "dash",
};

function Row({ f }: { f: Feature }) {
  const s = useStore();
  const ui = useAppUi();
  const [open, setOpen] = useState(false);
  const task = s.featureTask(f);
  const board = s.featureBoardStatus(f);
  const status = s.featureStatus(f);

  return (
    <div className={`ft-row${open ? " open" : ""}`}>
      <div className="ft-main" onClick={() => setOpen(!open)}>
        <span className="ft-ref">{f.ref || "—"}</span>
        <span className="ft-title">{f.title}</span>
        {/* The sheet's PMFv1 / Phase tags described a release plan nobody tracks any more.
            The board's own horizon and team are the tags actually being followed. */}
        {task && <span className={`ft-wave w-${stateOf(task)}`}>{stateOf(task) === "done" ? "Done" : waveWord(task.priority)}</span>}
        {task && s.helpers.teamSet(task).map((tm) => (
          <span key={tm} className={`ft-team av-${s.helpers.teamVar(tm)}`}>{tm === "Engineering" ? "Eng" : tm === "Design" ? "Dsg" : tm}</span>
        ))}
        {f.kind === "bug" && <span className="ft-bug">Bug</span>}
        <span className={`ft-status t-${STATUS_TONE[status] || "neu"}`}>
          {status}
          {board && <em title="Status comes from the linked roadmap task" className="ft-sync">synced</em>}
        </span>
        {task ? (
          <button type="button" className="ft-task" title={`On the board as "${task.title}"`}
            onClick={(e) => { e.stopPropagation(); ui.jumpToCard(task.id); }}>
            <IcLink />{task.title}
          </button>
        ) : <span className="ft-task none">Not on the board</span>}
      </div>

      {open && (
        <div className="ft-detail">
          {f.objective && <p><span>Objective</span>{f.objective}</p>}
          {f.nextSteps && <p><span>Next steps</span>{f.nextSteps}</p>}
          {f.blockers && <p><span>Blockers</span>{f.blockers}</p>}
          <div className="ft-meta">
            {f.requestedBy && <span>Requested by <b>{f.requestedBy}</b></span>}
            {f.effort && <span>Effort <b>{f.effort}</b></span>}
            {f.urgency && <span>Urgency <b>{f.urgency}</b></span>}
            {f.importance && <span>Importance <b>{f.importance}</b></span>}
            {f.team && <span>Team <b>{f.team}</b></span>}
          </div>
          <div className="ft-actions">
            {!task && (
              <label>
                Move onto the board
                <span className="ft-move">
                  {STATES.filter((w) => w.p).map((w) => (
                    <button type="button" key={w.k}
                      onClick={() => s.moveFeatureToBoard(f.id, w.p as number)}
                      title={`Create this as a ${w.word} milestone and link it`}>{w.word}</button>
                  ))}
                </span>
              </label>
            )}
            <label>
              Link to a roadmap task
              <select value={task ? task.id : ""} onChange={(e) => s.linkFeature(f.id, e.target.value || null)}>
                <option value="">Not linked</option>
                {s.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </label>
            <button type="button" className="icon-btn danger" aria-label="Remove feature"
              onClick={() => { if (confirm(`Remove "${f.title}"?`)) s.delFeature(f.id); }}><IcTrash /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function AddFeature({ band }: { band: FeatureBand }) {
  const s = useStore();
  const [v, setV] = useState("");
  const [ref, setRef] = useState("");
  const add = () => { if (s.addFeature(v, band, ref)) { setV(""); setRef(""); } };
  return (
    <div className="ft-add">
      <input className="ft-add-ref" placeholder="ID" value={ref} onChange={(e) => setRef(e.target.value)} />
      <input placeholder="Add a feature…" value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <button type="button" onClick={add}><IcPlus /> Add</button>
    </div>
  );
}

export function Features() {
  const s = useStore();
  const version = s.getSnapshot();
  const all = s.features;
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fLink, setFLink] = useState("");
  const [fBand, setFBand] = useState("");

  const match = (f: Feature) => {
    if (fStatus) {
      const b = STATUS_BUCKETS.find((x) => x.id === fStatus);
      if (b && !b.match(s.featureStatus(f))) return false;
    }
    if (fLink === "linked" && !s.featureTask(f)) return false;
    if (fLink === "unlinked" && s.featureTask(f)) return false;
    if (fBand && f.band !== fBand) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [f.ref, f.title, f.objective, f.nextSteps, f.requestedBy]
      .some((v) => (v || "").toLowerCase().includes(t));
  };
  const filtered = all.filter(match);
  const anyFilter = !!(q || fStatus || fLink || fBand);

  const stats = useMemo(() => {
    const linked = all.filter((f) => s.featureTask(f)).length;
    const done = all.filter((f) => s.featureStatus(f) === "Done").length;
    return { total: all.length, linked, done };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, version]);

  return (
    <>

      <div className="ft-filters">
        <input className="ft-search" placeholder="Search features, objectives, owners…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS_BUCKETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select value={fBand} onChange={(e) => setFBand(e.target.value)}>
          <option value="">All three blocks</option>
          {BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select value={fLink} onChange={(e) => setFLink(e.target.value)}>
          <option value="">On and off the board</option>
          <option value="linked">On the board</option>
          <option value="unlinked">Not on the board</option>
        </select>
        {anyFilter && (
          <button type="button" className="btn ghost" onClick={() => { setQ(""); setFStatus(""); setFLink(""); setFBand(""); }}>
            Clear · {filtered.length} of {all.length}
          </button>
        )}
      </div>

      <div className="ft-hero">
        <div><b>{stats.total}</b><span>features</span></div>
        <div><b>{stats.linked}</b><span>on the board</span></div>
        <div><b>{stats.done}</b><span>done</span></div>
      </div>

      {anyFilter && !filtered.length && (
        <div className="ft-none">
          <b>No features match those filters.</b>
          <p>Clear them to see all {all.length} again.</p>
          <button type="button" className="btn ghost" onClick={() => { setQ(""); setFStatus(""); setFLink(""); setFBand(""); }}>Clear filters</button>
        </div>
      )}

      {BANDS.map((b) => {
        const rows = filtered.filter((f) => f.band === b.id);
        if (anyFilter && !rows.length) return null;
        return (
          <section className="ft-band" key={b.id}>
            <div className="ft-band-hd">
              <h3>{b.label}</h3><span className="n">{rows.length}</span>
              <p>{b.blurb}</p>
            </div>
            <div className="ft-list">
              {!anyFilter && <AddFeature band={b.id} />}
              {rows.map((f) => <Row key={f.id} f={f} />)}
              {!anyFilter && rows.length > 6 && <AddFeature band={b.id} />}
            </div>
          </section>
        );
      })}
    </>
  );
}
