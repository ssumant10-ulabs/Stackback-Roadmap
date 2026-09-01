"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Feature, FeatureBand, Node as TaskNode } from "@/lib/types";
import { IcLink, IcPlus, IcTrash } from "../icons";
import { STATES, effStatus, stateOf, subtreeCounts } from "@/lib/derive";
import { effRange, fmtRange } from "@/lib/dates";
import { useAppUi } from "../appui";

/** Grouped the way the board is, so the two read the same. The sheet's own blocks (upcoming,
 *  merchant requested, partner) are still carried on each feature and still decide where a
 *  promoted request lands, but they described a filing system nobody navigates by. */
const GROUPS: { id: string; label: string; blurb: string }[] = [
  { id: "now", label: "Now", blurb: "Being built" },
  { id: "next", label: "Next", blurb: "Queued behind Now" },
  { id: "future", label: "Future", blurb: "Further out" },
  { id: "done", label: "Done", blurb: "Shipped" },
  { id: "none", label: "Not on the board", blurb: "No roadmap task yet" },
];

/** A feature sits wherever its roadmap task sits. Unlinked features have no horizon of their
 *  own, so they collect in their own group instead of being guessed into one. */
function groupOf(f: Feature, task: TaskNode | null, done: boolean): string {
  // Something shipped belongs under Done even when the milestone that carried it is still
  // open, which is the same precedence featureStatus already applies.
  if (done) return "done";
  return task ? stateOf(task) : "none";
}

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
        {f.kind === "bug" && <span className="ft-bug">Bug</span>}
        {/* A linked feature says everything through its task: the group is its horizon, the
            card carries the team and the status. Repeating all of that per row was five tags
            saying one thing. Unlinked rows still need their own status, since nothing else
            has one to give them. */}
        {task ? (
          <button type="button" className="ft-task" title={`On the board as "${task.title}" · ${board}`}
            onClick={(e) => { e.stopPropagation(); ui.jumpToCard(task.id); }}>
            <IcLink />{task.title}
          </button>
        ) : (
          <span className={`ft-status t-${STATUS_TONE[status] || "neu"}`}>{status}</span>
        )}
      </div>

      {open && (
        <div className="ft-detail">
          {f.objective && <p><span>Objective</span>{f.objective}</p>}
          {f.nextSteps && <p><span>Next steps</span>{f.nextSteps}</p>}
          {f.blockers && <p><span>Blockers</span>{f.blockers}</p>}
          {/* What the board actually holds for this feature. Once a feature is linked, the
              card is where the dates, the owners and the checklist live, and the detail here
              showed none of it, so a feature that had been filled in on the board still read
              as empty. Read-only on purpose: the card stays the one place it is edited. */}
          {task && <BoardSummary task={task} onJump={() => ui.jumpToCard(task.id)} />}
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
          </div>
          {/* Its own row, right of everything else. A bare trash icon sitting against the link
              dropdown put deleting the feature one slip away from choosing a task for it. */}
          <div className="ft-danger">
            <button type="button" className="btn ghost sm danger"
              onClick={() => { if (confirm(`Delete "${f.title}"? This cannot be undone.`)) s.delFeature(f.id); }}>
              <IcTrash /> Delete feature
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A read-only view of the linked card: where it sits, its window, who owns it and how far
 *  its checklist has got. */
function BoardSummary({ task, onJump }: { task: TaskNode; onJump: () => void }) {
  const c = subtreeCounts(task);
  const range = effRange(task);
  const st = effStatus(task);
  const kids = task.children || [];
  const owners = (task.assignees || []).map((a) => a.name);
  return (
    <div className="ft-board">
      <div className="ft-board-hd">
        <span className={`ft-status t-${st === "done" ? "ok" : st === "progress" ? "warn" : "neu"}`}>
          {st === "done" ? "Done" : st === "progress" ? "In progress" : "Planned"}
        </span>
        {range && <span className="ft-board-dates">{fmtRange(range.start, range.end)}</span>}
        {c.total > 0 && <span className="ft-board-prog">{c.done}/{c.total} done</span>}
        {owners.length > 0 && <span className="ft-board-who">{owners.join(", ")}</span>}
        <button type="button" className="btn ghost sm" onClick={onJump}>Open on the board</button>
      </div>
      {kids.length > 0 && (
        <ul className="ft-board-list">
          {kids.map((k) => (
            <li key={k.id} className={effStatus(k) === "done" ? "done" : undefined}>
              <span className={`ft-tick t-${effStatus(k)}`} />{k.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddFeature({ band }: { band: FeatureBand }) {
  const s = useStore();
  const [v, setV] = useState("");
  const [ref, setRef] = useState("");
  /** Where it lands: nowhere, a brand-new milestone in one of the three horizons, or an
   *  existing task. Set at creation, so a new feature does not have to be found again and
   *  reopened just to place it. */
  const [place, setPlace] = useState("");
  const add = () => {
    const id = s.addFeature(v, band, ref);
    if (!id) return;
    if (place.startsWith("new:")) s.moveFeatureToBoard(id, Number(place.slice(4)));
    else if (place) s.linkFeature(id, place);
    setV(""); setRef(""); setPlace("");
  };
  return (
    <div className="ft-add">
      <input className="ft-add-ref" placeholder="ID" value={ref} onChange={(e) => setRef(e.target.value)} />
      <input placeholder="Add a feature…" value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <select className="ft-add-place" value={place} onChange={(e) => setPlace(e.target.value)}
        aria-label="Where this lands on the board">
        <option value="">Not on the board</option>
        {STATES.filter((w) => w.p).map((w) => (
          <option key={w.k} value={`new:${w.p}`}>New {w.word} milestone</option>
        ))}
        {s.tasks.length > 0 && <option disabled>── or link to ──</option>}
        {s.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
      </select>
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

  const match = (f: Feature) => {
    if (fStatus) {
      const b = STATUS_BUCKETS.find((x) => x.id === fStatus);
      if (b && !b.match(s.featureStatus(f))) return false;
    }
    if (fLink === "linked" && !s.featureTask(f)) return false;
    if (fLink === "unlinked" && s.featureTask(f)) return false;
    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [f.ref, f.title, f.objective, f.nextSteps, f.requestedBy]
      .some((v) => (v || "").toLowerCase().includes(t));
  };
  const filtered = all.filter(match);
  const anyFilter = !!(q || fStatus || fLink);

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
        <select value={fLink} onChange={(e) => setFLink(e.target.value)}>
          <option value="">On and off the board</option>
          <option value="linked">On the board</option>
          <option value="unlinked">Not on the board</option>
        </select>
        {anyFilter && (
          <button type="button" className="btn ghost" onClick={() => { setQ(""); setFStatus(""); setFLink(""); }}>
            Clear · {filtered.length} of {all.length}
          </button>
        )}
      </div>

      {!anyFilter && <AddFeature band="upcoming" />}

      <div className="ft-hero">
        <div><b>{stats.total}</b><span>features</span></div>
        <div><b>{stats.linked}</b><span>on the board</span></div>
        <div><b>{stats.done}</b><span>done</span></div>
      </div>

      {anyFilter && !filtered.length && (
        <div className="ft-none">
          <b>No features match those filters.</b>
          <p>Clear them to see all {all.length} again.</p>
          <button type="button" className="btn ghost" onClick={() => { setQ(""); setFStatus(""); setFLink(""); }}>Clear filters</button>
        </div>
      )}

      {GROUPS.map((g) => {
        const rows = filtered.filter((f) => groupOf(f, s.featureTask(f), s.featureStatus(f) === "Done") === g.id);
        if (!rows.length) return null;
        return (
          <section className="ft-band" key={g.id}>
            <div className="ft-band-hd">
              <h3>{g.label}</h3><span className="n">{rows.length}</span>
              <p>{g.blurb}</p>
            </div>
            <div className="ft-list">
              {rows.map((f) => <Row key={f.id} f={f} />)}
            </div>
          </section>
        );
      })}
    </>
  );
}
