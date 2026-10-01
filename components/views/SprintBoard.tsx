"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGE_LABEL, teamForStage, type BoardTeam, type Stage } from "@/lib/board";
import { cardPriority, subtreeCounts } from "@/lib/derive";
import { Assignees } from "../Assignees";
import { StatusButton } from "../bits";
import type { BoardCard } from "./WorkBoard";
import type { Node } from "@/lib/types";

/** A week's sprint, as an overview you can plan against.
 *
 *  The board answers "where is this card". A sprint answers a different question: what did
 *  we commit to this week, how far through is it, and what do we pull in next. So this is
 *  not a sixth column set — it is the Now horizon read as a commitment, laid out by team and
 *  by how far along each card is, with the Next queue underneath to pull from.
 *
 *  The horizon IS the sprint. Now means this week; Next means the queue behind it. That
 *  avoids inventing a sprint field nobody would maintain, and it means planning a sprint is
 *  the same two clicks as everything else on the board: pull a card in, push one out.
 *
 *  Dates are shown where a card has them and never required. Most cards do not have them,
 *  and a sprint view that reads empty until somebody dates forty cards is a view nobody
 *  opens twice. */

const LANES: { team: BoardTeam; label: string }[] = [
  { team: "PM", label: "PM / CS" },
  { team: "Design", label: "Design" },
  { team: "Engineering", label: "Dev" },
];

/** Four buckets, which is how far along a card is rather than which team holds it. Every
 *  stage lands in exactly one, so the lane counts add up to the lane. */
const BUCKETS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "todo", label: "To start", stages: ["bug", "feature", "pm_handover"] },
  { key: "doing", label: "In progress", stages: ["pm_progress", "design_progress", "design_to_dev", "dev_progress"] },
  { key: "review", label: "In review", stages: ["design_review", "dev_review"] },
  { key: "done", label: "Done", stages: ["design_approved", "dev_approved", "prod"] },
];

/** Monday of the week `offset` weeks from this one. Sprints start on a Monday here because
 *  that is when the team's own week starts; nothing in the data says otherwise. */
function weekStart(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}
const dayMonth = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** One lane per card, not one per team it names.
 *
 *  Listing a card under every team on it put work tagged Dev under PM as well, because PM is
 *  on most cards through an assignee. The stage already says whose hands it is in — a card at
 *  `dev_progress` is Dev's — so that answers first, and a card nobody has started falls to
 *  the most specific team named on it. PM is last because PM triages everything. */
function laneOf(c: BoardCard): BoardTeam | null {
  const byStage = teamForStage(c.stage);
  if (byStage && c.teams.includes(byStage)) return byStage;
  return c.teams.find((t) => t !== "PM") ?? c.teams[0] ?? null;
}

export default function SprintBoard({ cards }: { cards: BoardCard[] }) {
  const s = useStore();
  const [offset, setOffset] = useState(0);
  const from = weekStart(offset);
  const to = new Date(from); to.setDate(to.getDate() + 6);

  const { inSprint, queued } = useMemo(() => {
    const h = (c: BoardCard) => cardPriority(c.node ?? c.feature);
    return {
      inSprint: cards.filter((c) => h(c) === 1),
      queued: cards.filter((c) => h(c) === 2),
    };
  }, [cards]);

  const doneStages = BUCKETS.find((b) => b.key === "done")!.stages;
  const done = inSprint.filter((c) => doneStages.includes(c.stage)).length;
  const pct = inSprint.length ? Math.round((done / inSprint.length) * 100) : 0;

  return (
    <div className="sp">
      <header className="sp-head">
        <div className="sp-week">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous week">&#8592;</button>
          <b>{dayMonth(from)} &ndash; {dayMonth(to)}</b>
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next week">&#8594;</button>
          {offset !== 0 && <button type="button" className="sp-today" onClick={() => setOffset(0)}>This week</button>}
        </div>
        <div className="sp-prog">
          <span className="sp-progbar"><i style={{ width: `${pct}%` }} /></span>
          <span className="sp-progn">{done} of {inSprint.length} done</span>
        </div>
      </header>

      <p className="sp-lede">
        Everything on the <b>Now</b> horizon is this sprint. Pull a card in from the queue below
        or push one out, and the board moves with it &mdash; the horizon is the same field
        everywhere.
      </p>

      {!inSprint.length && (
        <p className="sp-empty">
          Nothing is on Now, so the sprint is empty. Pull work in from the queue below.
        </p>
      )}

      <div className="sp-lanes">
        {LANES.map(({ team, label }) => {
          const mine = inSprint.filter((c) => laneOf(c) === team);
          if (!mine.length) return null;
          return (
            <section className="sp-lane" key={team}>
              <h3>{label}<em>{mine.length}</em></h3>
              <div className="sp-buckets">
                {BUCKETS.map((b) => {
                  const list = mine.filter((c) => b.stages.includes(c.stage));
                  return (
                    <div className={"sp-bucket" + (list.length ? "" : " empty")} key={b.key}>
                      <h4>{b.label}<em>{list.length}</em></h4>
                      {list.map((c) => <SprintCard key={c.id} card={c} onPush={() => s.setPriority(c.id, 2)} />)}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="sp-queue">
        <h3>Queued for the next sprint<em>{queued.length}</em></h3>
        <p className="sp-qlede">On <b>Next</b>. Pull one in and it joins the sprint above.</p>
        <div className="sp-qlist">
          {queued.slice(0, 40).map((c) => (
            <article className="sp-qcard" key={c.id}>
              <button type="button" className="sp-pull" onClick={() => s.setPriority(c.id, 1)}
                title="Pull into this sprint">+</button>
              <span className="sp-qtitle">{(c.node ?? (c.feature as unknown as Node)).title}</span>
              <span className="sp-qteam">{c.teams.map((t) => (t === "Engineering" ? "Dev" : t)).join(" · ") || "Unassigned"}</span>
            </article>
          ))}
          {queued.length > 40 && <p className="sp-qmore">{queued.length - 40} more on Next.</p>}
        </div>
      </section>
    </div>
  );
}

function SprintCard({ card, onPush }: { card: BoardCard; onPush: () => void }) {
  const node: Node = card.node ?? (card.feature as unknown as Node);
  const counts = subtreeCounts(node);
  const [open, setOpen] = useState(false);
  return (
    <article className="sp-card">
      <div className="sp-cardtop">
        <StatusButton node={node} size={14} />
        <span className="sp-cardtitle">{node.title}</span>
        <button type="button" className="sp-push" onClick={onPush} title="Push out to the next sprint">&minus;</button>
      </div>
      <div className="sp-cardfoot">
        <span className="assignees"><Assignees node={node} small /></span>
        {counts.total > 0 && (
          <button type="button" className="sp-cardn" onClick={() => setOpen(!open)}
            aria-expanded={open} title={open ? "Hide the subtasks" : "Show the subtasks"}>
            {counts.done}/{counts.total}
          </button>
        )}
        <span className="sp-cardstage">{STAGE_LABEL[card.stage]}</span>
      </div>
      {/* The sprint is where you check what is actually left, so the checklist opens here
          too rather than only on the board. */}
      {open && counts.total > 0 && (
        <ul className="sp-subs">
          {node.children.map((k) => (
            <li key={k.id}>
              <StatusButton node={k} size={13} />
              <span className={k.status === "done" ? "done" : ""}>{k.title}</span>
              <span className="assignees"><Assignees node={k} small /></span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
