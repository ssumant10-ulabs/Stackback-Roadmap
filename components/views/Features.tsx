"use client";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { Feature, FeatureBand, Node as TaskNode } from "@/lib/types";
import { IcCaretDown, IcLink, IcPlus, IcTrash } from "../icons";
import { TEAM_ORDER } from "@/lib/constants";
import { STATES, effStatus, pctOf, stateOf, subtreeCounts } from "@/lib/derive";
import { effRange, fmtRange, isOverdue } from "@/lib/dates";
import { Assignees } from "../Assignees";
import { useAppUi } from "../appui";

/** Two columns, because the only question this screen is asked is "is it on the roadmap or
 *  not", and the old five stacked bands made you scroll to answer it. On the board is split
 *  by horizon inside its own column so the priority still reads as a group AND as a tag on
 *  every card; not on the board is one flat list you can promote straight from. */
const HORIZONS: { id: string; label: string; blurb: string }[] = [
  { id: "now", label: "Now", blurb: "Being built" },
  { id: "next", label: "Next", blurb: "Queued behind Now" },
  { id: "future", label: "Future", blurb: "Further out" },
  { id: "done", label: "Done", blurb: "Shipped" },
];

/** A feature sits wherever its roadmap task sits. Something shipped belongs under Done even
 *  when the milestone carrying it is still open, which is the precedence featureStatus
 *  already applies. */
function horizonOf(task: TaskNode, done: boolean): string {
  return done ? "done" : stateOf(task);
}

/** The sheet uses eight status words for what are really three states. The filter buckets
 *  them; the card still shows the precise word, because "In Design" and "In Dev" matter to
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

/* ---------------------------------------------------------------- shared card internals */

function Tag({ h }: { h: string }) {
  const label = h.charAt(0).toUpperCase() + h.slice(1);
  return <span className={`fb-tag h-${h}`}>{label}</span>;
}

function Detail({ f, task }: { f: Feature; task: TaskNode | null }) {
  const s = useStore();
  const ui = useAppUi();
  return (
    <div className="fb-detail">
      {f.objective && <p><span>Objective</span>{f.objective}</p>}
      {f.nextSteps && <p><span>Next steps</span>{f.nextSteps}</p>}
      {f.blockers && <p><span>Blockers</span>{f.blockers}</p>}

      {/* The checklist under the linked card. Read-only on purpose: the Board stays the one
          place a subtask is edited, so the two surfaces cannot disagree. */}
      {task && (task.children || []).length > 0 && (
        <ul className="fb-subs">
          {(task.children || []).map((k) => (
            <li key={k.id} className={effStatus(k) === "done" ? "done" : undefined}>
              <span className={`fb-tick t-${effStatus(k)}`} />{k.title}
            </li>
          ))}
        </ul>
      )}

      {(f.requestedBy || f.effort || f.urgency || f.importance || f.team) && (
        <div className="fb-meta">
          {f.requestedBy && <span>Requested by <b>{f.requestedBy}</b></span>}
          {f.effort && <span>Effort <b>{f.effort}</b></span>}
          {f.urgency && <span>Urgency <b>{f.urgency}</b></span>}
          {f.importance && <span>Importance <b>{f.importance}</b></span>}
          {f.team && <span>Team <b>{f.team}</b></span>}
        </div>
      )}

      <div className="fb-actions">
        {task && (
          <button type="button" className="btn ghost sm" onClick={() => ui.jumpToCard(task.id)}>
            Open on the board
          </button>
        )}
        <label>
          Linked roadmap task
          <select value={task ? task.id : ""} onChange={(e) => s.linkFeature(f.id, e.target.value || null)}>
            <option value="">Not linked</option>
            {s.tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        {/* Its own end of the row, away from the link dropdown, so deleting the feature is
            never one slip away from choosing a task for it. */}
        <button type="button" className="btn ghost sm danger fb-del"
          onClick={() => { if (confirm(`Delete "${f.title}"? This cannot be undone.`)) s.delFeature(f.id); }}>
          <IcTrash /> Delete
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- on the board card */

function BoardCard({ f, task }: { f: Feature; task: TaskNode }) {
  const s = useStore();
  const ui = useAppUi();
  const [open, setOpen] = useState(false);
  const status = s.featureStatus(f);
  const c = subtreeCounts(task);
  const pct = pctOf(task);
  const range = effRange(task);
  const late = isOverdue(task);
  const h = horizonOf(task, status === "Done");
  /* Only a top-level milestone can be sent to another horizon. A feature linked to a task
     nested under a card would be yanked out of that card by the same move, so it is not
     offered one. */
  const topLevel = s.moveTargets(task.id).isTopLevel;

  return (
    <article className={`fb-card${open ? " open" : ""}`}>
      <div className="fb-head" onClick={() => setOpen(!open)}>
        <div className="fb-line1">
          {f.ref && <span className="fb-ref">{f.ref}</span>}
          <Tag h={h} />
          <span className={`fb-status t-${STATUS_TONE[status] || "neu"}`}>{status}</span>
          {f.kind === "bug" && <span className="fb-bug">Bug</span>}
        </div>
        <h4 className="fb-title">{f.title}</h4>
        <div className="fb-line2">
          {c.total > 0 ? (
            <span className="fb-prog" title={`${c.done} of ${c.total} subtasks done`}>
              <span className="fb-bar"><span style={{ width: pct + "%" }} /></span>
              {c.done}/{c.total}
            </span>
          ) : (
            <span className="fb-prog empty">No subtasks</span>
          )}
          {range && <span className={`fb-dates${late ? " late" : ""}`}>{fmtRange(range.start, range.end)}</span>}
        </div>
      </div>

      <div className="fb-foot">
        <button type="button" className="fb-task" title={`On the board as "${task.title}"`}
          onClick={() => ui.jumpToCard(task.id)}><IcLink />{task.title}</button>
        <span className="fb-owners"><Assignees node={task} small /></span>
      </div>

      {open && (
        <>
          {topLevel && (
            <div className="fb-move">
              <span>Move to</span>
              {STATES.filter((w) => w.p).map((w) => (
                <button type="button" key={w.k} disabled={h === w.k}
                  onClick={() => s.moveNode(task.id, "root", "", w.p as number)}>{w.word}</button>
              ))}
            </div>
          )}
          <Detail f={f} task={task} />
        </>
      )}
    </article>
  );
}

/* ---------------------------------------------------------------- not on the board card */

function OffCard({ f }: { f: Feature }) {
  const s = useStore();
  const ui = useAppUi();
  const [open, setOpen] = useState(false);
  const status = s.featureStatus(f);
  const row = useRef<HTMLDivElement>(null);

  /* Promote and assign in one gesture. Once it is on the board the card leaves this column,
     so an owner picker that only appears over there would mean finding the thing again just
     to say whose it is. */
  const put = (p: number) => {
    if (!s.moveFeatureToBoard(f.id, p)) return;
    const t = s.featureTask(f);
    if (t && row.current) ui.openAssignee(t.id, row.current);
  };

  return (
    <article className={`fb-card off${open ? " open" : ""}`}>
      <div className="fb-head" onClick={() => setOpen(!open)}>
        <div className="fb-line1">
          {f.ref && <span className="fb-ref">{f.ref}</span>}
          <span className={`fb-status t-${STATUS_TONE[status] || "neu"}`}>{status}</span>
          {f.kind === "bug" && <span className="fb-bug">Bug</span>}
          {f.storeName && <span className="fb-from">{f.storeName}</span>}
        </div>
        <h4 className="fb-title">{f.title}</h4>
      </div>

      <div className="fb-put" ref={row}>
        <span>Put on the board</span>
        {STATES.filter((w) => w.p).map((w) => (
          <button type="button" key={w.k} onClick={() => put(w.p as number)}
            title={`Create this as a ${w.word} milestone, then pick its owners`}>{w.word}</button>
        ))}
      </div>

      {open && <Detail f={f} task={null} />}
    </article>
  );
}

/* ------------------------------------------------------------------------------- add row */

function AddFeature({ band }: { band: FeatureBand }) {
  const s = useStore();
  const [v, setV] = useState("");
  /** Where it lands: nowhere, a brand-new milestone in one of the three horizons, or an
   *  existing task. Set at creation, so a new feature does not have to be found again and
   *  reopened just to place it. */
  const [place, setPlace] = useState("");
  /* The id it is about to get, shown rather than asked for. Typing one was the only field
     here that could collide with an existing row, and nobody could tell which number was
     next without reading the whole list. */
  const nextRef = s.nextFeatureRef(band);
  const add = () => {
    const id = s.addFeature(v, band);
    if (!id) return;
    if (place.startsWith("new:")) s.moveFeatureToBoard(id, Number(place.slice(4)));
    else if (place) s.linkFeature(id, place);
    setV(""); setPlace("");
  };
  return (
    <div className="ft-add">
      <span className="ft-add-id" title="Issued automatically when you add it">{nextRef}</span>
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

/* ------------------------------------------------------------------------------ the view */

export function Features() {
  const s = useStore();
  const version = s.getSnapshot();
  const all = s.features;
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fHorizon, setFHorizon] = useState("");
  const [fTeam, setFTeam] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fType, setFType] = useState("");
  /* Done starts folded. It is 14 of the 60 and it is history, not work, so open by default
     it was a third of the scroll for the one group nobody is looking for. */
  const [shut, setShut] = useState<Record<string, boolean>>({ done: true });

  /* The header's own team/person filter is deliberately off on this view (it prunes the
     task tree, which is not what a feature list needs), so the dimensions live here where
     they can be applied to a feature that has no task at all. */
  const owners = useMemo(() => {
    const seen: Record<string, 1> = {};
    const out: string[] = [];
    TEAM_ORDER.forEach((t) => (s.data.roster[t] || []).forEach((n) => { if (!seen[n]) { seen[n] = 1; out.push(n); } }));
    const walk = (ns: TaskNode[]) => ns.forEach((n) => {
      (n.assignees || []).forEach((a) => { if (!a.isTeam && !seen[a.name]) { seen[a.name] = 1; out.push(a.name); } });
      walk(n.children || []);
    });
    walk(s.tasks);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, version]);

  const teamsOf = (f: Feature, task: TaskNode | null): string[] => {
    const set: Record<string, 1> = {};
    if (f.team && TEAM_ORDER.includes(f.team)) set[f.team] = 1;
    if (task) s.helpers.teamSet(task).forEach((t) => { set[t] = 1; });
    return TEAM_ORDER.filter((t) => set[t]);
  };

  const match = (f: Feature) => {
    const task = s.featureTask(f);

    if (fType && (f.kind || "feature") !== fType) return false;

    if (fStatus) {
      const b = STATUS_BUCKETS.find((x) => x.id === fStatus);
      if (b && !b.match(s.featureStatus(f))) return false;
    }
    /* Horizon is a property only a board item has, so an unlinked feature never matches
       one. That empties the left column rather than pretending the filter does not apply
       to it, which is why every column header carries a "showing x of y". */
    if (fHorizon && (!task || horizonOf(task, s.featureStatus(f) === "Done") !== fHorizon)) return false;

    if (fTeam) {
      const ts = teamsOf(f, task);
      if (fTeam === "none" ? ts.length > 0 : !ts.includes(fTeam)) return false;
    }
    if (fOwner) {
      const has = !!task && s.helpers.subtreeHasAssignee(task, (a) => !a.isTeam && a.name === fOwner);
      const any = !!task && s.helpers.subtreeHasAssignee(task, (a) => !a.isTeam);
      if (fOwner === "none" ? any : !has) return false;
    }

    const t = q.trim().toLowerCase();
    if (!t) return true;
    return [f.ref, f.title, f.objective, f.nextSteps, f.requestedBy]
      .some((v) => (v || "").toLowerCase().includes(t));
  };

  const anyFilter = !!(q || fStatus || fHorizon || fTeam || fOwner || fType);
  const clear = () => { setQ(""); setFStatus(""); setFHorizon(""); setFTeam(""); setFOwner(""); setFType(""); };
  const filtered = all.filter(match);

  /* Split once, then group the board side. Recomputed against the store version so a
     promote or a status change on the board moves a card across without a reload. */
  const { on, off, onAll, offAll } = useMemo(() => {
    const on: { f: Feature; task: TaskNode }[] = [];
    const off: Feature[] = [];
    filtered.forEach((f) => {
      const t = s.featureTask(f);
      if (t) on.push({ f, task: t }); else off.push(f);
    });
    let onAll = 0, offAll = 0;
    all.forEach((f) => { if (s.featureTask(f)) onAll++; else offAll++; });
    return { on, off, onAll, offAll };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, all, version]);

  const groups = HORIZONS.map((g) => ({
    ...g,
    items: on.filter(({ f, task }) => horizonOf(task, s.featureStatus(f) === "Done") === g.id),
  }));
  /* A filter that matched something inside a folded group would look like it matched
     nothing, so filtering opens every group. */
  const folded = (id: string) => !anyFilter && shut[id];

  return (
    <>
      <div className="ft-filters">
        <input className="ft-search" placeholder="Search features, objectives, owners…" value={q}
          onChange={(e) => setQ(e.target.value)} />
        <select value={fHorizon} onChange={(e) => setFHorizon(e.target.value)} aria-label="Horizon">
          <option value="">Any horizon</option>
          {HORIZONS.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUS_BUCKETS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
        <select value={fTeam} onChange={(e) => setFTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {TEAM_ORDER.map((t) => <option key={t} value={t}>{t}</option>)}
          <option value="none">No team yet</option>
        </select>
        <select value={fOwner} onChange={(e) => setFOwner(e.target.value)} aria-label="Owner">
          <option value="">Anyone</option>
          {owners.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value="none">Unassigned</option>
        </select>
        <select value={fType} onChange={(e) => setFType(e.target.value)} aria-label="Type">
          <option value="">Features and bugs</option>
          <option value="feature">Features</option>
          <option value="bug">Bugs</option>
        </select>
        {anyFilter
          ? <button type="button" className="btn ghost fb-clear" onClick={clear}>Clear · {filtered.length} of {all.length}</button>
          : <span className="fb-count">{all.length} features</span>}
      </div>

      {!anyFilter && <AddFeature band="upcoming" />}

      {anyFilter && !filtered.length && (
        <div className="ft-none">
          <b>No features match those filters.</b>
          <p>Clear them to see all {all.length} again.</p>
          <button type="button" className="btn ghost" onClick={clear}>Clear filters</button>
        </div>
      )}

      <div className="fb-cols">
        {/* Not on the board sits left: it is the queue you are working through, and the
            board side is where things end up. */}
        <section className="fb-col">
          <header className="fb-colhd">
            <h3>Not on the board</h3>
            <span className="n">{anyFilter ? `${off.length} of ${offAll}` : off.length}</span>
            <p>No roadmap milestone yet</p>
          </header>
          {!off.length && <p className="fb-empty">{anyFilter ? "Nothing here matches the filters." : "Everything is on the board."}</p>}
          <div className="fb-grid">
            {off.map((f) => <OffCard key={f.id} f={f} />)}
          </div>
        </section>

        <section className="fb-col">
          <header className="fb-colhd">
            <h3>On the board</h3>
            <span className="n">{anyFilter ? `${on.length} of ${onAll}` : on.length}</span>
            <p>Linked to a roadmap milestone</p>
          </header>
          {!on.length && <p className="fb-empty">{anyFilter ? "Nothing here matches the filters." : "Nothing here yet. Promote something from the left."}</p>}
          {groups.map((g) => (
            g.items.length ? (
              <div className="fb-group" key={g.id}>
                {/* A plain heading, not a second pill: the tag on every card already carries
                    the colour, and two of them touching read as one thing said twice. */}
                <button type="button" className={`fb-grouphd h-${g.id}${folded(g.id) ? " shut" : ""}`}
                  aria-expanded={!folded(g.id)}
                  onClick={() => setShut({ ...shut, [g.id]: !shut[g.id] })}>
                  <IcCaretDown />
                  <h5>{g.label}</h5>
                  <span className="n">{g.items.length}</span>
                  <em>{g.blurb}</em>
                </button>
                {!folded(g.id) && (
                  <div className="fb-grid">
                    {g.items.map(({ f, task }) => <BoardCard key={f.id} f={f} task={task} />)}
                  </div>
                )}
              </div>
            ) : null
          ))}
        </section>
      </div>
    </>
  );
}
