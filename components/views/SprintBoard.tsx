"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGE_LABEL, teamForStage, type BoardTeam, type Stage } from "@/lib/board";
import { dayMonth, dayOfSprint, isFinished, sprintId, velocity, weekStart } from "@/lib/sprint";
import { cardPriority, subtreeCounts } from "@/lib/derive";
import { Assignees } from "../Assignees";
import { StatusButton } from "../bits";
import type { BoardCard } from "./WorkBoard";
import type { Node } from "@/lib/types";

/** A week's sprint, as an overview you can plan against.
 *
 *  The board answers "where is this card". A sprint answers a different question: what did
 *  we commit to this week, how far through is it, and what carries. So this is not a sixth
 *  column set — it is the Now horizon read as a commitment, laid out by team and by how far
 *  along each card is, with the Next queue underneath to pull from.
 *
 *  Four things make it a sprint rather than a filter, and they are the four that pay:
 *    1. The week is a record, opened the first time anyone looks. Nobody starts a sprint.
 *    2. Scope and done are two lines, not one bar. One bar cannot show scope creep, which is
 *       the failure this team actually has.
 *    3. Closing carries the unfinished work forward and counts it. Without that, Now only
 *       ever grows.
 *    4. Capacity comes from the last three closed sprints, which beats estimating.
 *
 *  Dates on individual cards are shown where they exist and never required. Most cards do
 *  not have them, and a sprint view that reads empty until somebody dates forty cards is a
 *  view nobody opens twice. */

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
  { key: "done", label: "Done", stages: [] },
];

/** Which bucket a card sits in. Finished answers first, whichever way it finished, so the
 *  four bucket counts always add up to the lane and always agree with the Done meter. A card
 *  ticked off but still sitting at `dev_review` was showing under In review while the meter
 *  counted it done, which reads as the view disagreeing with itself. */
function bucketOf(c: BoardCard): string {
  if (finished(c)) return "done";
  return BUCKETS.find((b) => b.stages.includes(c.stage))?.key ?? "todo";
}
const finished = (c: BoardCard) =>
  isFinished({ stage: c.stage, status: (c.node ?? c.feature)?.status ?? null });

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

const titleOf = (c: BoardCard) => (c.node ?? (c.feature as unknown as Node)).title;
const teamsOf = (c: BoardCard) => c.teams.map((t) => (t === "Engineering" ? "Dev" : t)).join(" · ");

export default function SprintBoard({ cards, onOpen }: { cards: BoardCard[]; onOpen: (id: string) => void }) {
  const s = useStore();
  const [offset, setOffset] = useState(0);
  const from = weekStart(offset);
  const to = new Date(from); to.setDate(to.getDate() + 6);
  const id = sprintId(from);
  const sprint = s.sprintFor(id);
  const thisWeek = offset === 0;

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const members = useMemo(
    () => (sprint ? s.sprintMembers(sprint).map((cid) => byId.get(cid)).filter(Boolean) as BoardCard[] : []),
    [sprint, byId, s],
  );
  const committed = new Set(sprint?.committed ?? []);
  const added = members.filter((c) => !committed.has(c.id));
  const done = members.filter(finished);
  const queued = cards.filter((c) => cardPriority(c.node ?? c.feature) === 2);

  const vel = velocity(s.sprints);
  const day = dayOfSprint(from);
  const closed = !!sprint?.closedAt;
  const scopePct = members.length ? Math.round((committed.size / members.length) * 100) : 100;
  const donePct = members.length ? Math.round((done.length / members.length) * 100) : 0;

  const copy = () => {
    const lines = [
      `*Sprint ${dayMonth(from)} – ${dayMonth(to)}*`,
      `${done.length} of ${members.length} done${added.length ? ` · ${added.length} added after we started` : ""}`,
    ];
    for (const { team, label } of LANES) {
      const mine = members.filter((c) => laneOf(c) === team);
      if (!mine.length) continue;
      lines.push("", `*${label}*`);
      for (const c of mine) {
        const b = bucketOf(c);
        const mark = b === "done" ? "✅" : b === "todo" ? "⬜" : "🔄";
        const who = (c.node ?? (c.feature as unknown as Node)).assignees?.map((a) => a.name).join(", ");
        lines.push(`${mark} ${titleOf(c)}${who ? ` — ${who}` : ""}`);
      }
    }
    const carry = members.length - done.length;
    if (carry) lines.push("", `Carrying into next week: ${carry}`);
    navigator.clipboard?.writeText(lines.join("\n"));
  };

  return (
    <div className="sp">
      <header className="sp-head">
        <div className="sp-week">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous week">&#8592;</button>
          <b>{dayMonth(from)} &ndash; {dayMonth(to)}</b>
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next week">&#8594;</button>
          <span className="sp-day">
            {closed ? "Closed" : thisWeek ? `Day ${day} of 7` : offset > 0 ? "Not started" : "Never closed"}
          </span>
          {!thisWeek && <button type="button" className="sp-today" onClick={() => setOffset(0)}>This week</button>}
        </div>
        <div className="sp-acts">
          {members.length > 0 && (
            <button type="button" className="sp-today" onClick={copy}
              title="Copy a plain-text summary to paste into WhatsApp">Copy the update</button>
          )}
          {sprint && !closed && offset <= 0 && (
            <button type="button" className="sp-close"
              onClick={() => {
                const carry = members.length - done.length;
                if (!confirm(`Close this sprint?\n\n${done.length} done, ${carry} unfinished.\nThe ${carry} carry into next week and stay on Now.`)) return;
                s.closeSprint(id);
                setOffset(offset + 1);
              }}>Close &amp; roll over</button>
          )}
        </div>
      </header>

      {/* Two lines, not one bar. The top one is the week's scope — what we agreed to, plus
          what landed on it since, which is the number that quietly grows. The bottom one is
          what is actually finished, measured against that same total so the gap is the
          answer. */}
      {sprint && members.length > 0 && (
        <div className="sp-meters">
          <div className="sp-meter">
            <span className="sp-mlbl">Scope</span>
            <span className="sp-mbar sp-scope">
              <i style={{ width: `${scopePct}%` }} />
              {added.length > 0 && <u style={{ width: `${100 - scopePct}%` }} />}
            </span>
            <span className="sp-mn">
              {committed.size} committed{added.length > 0 && <b> + {added.length} added</b>}
            </span>
          </div>
          <div className="sp-meter">
            <span className="sp-mlbl">Done</span>
            <span className="sp-mbar"><i style={{ width: `${donePct}%` }} /></span>
            <span className="sp-mn">{done.length} of {members.length}</span>
          </div>
        </div>
      )}

      {/* Capacity you have measured, not capacity you have guessed. Silent until there are
          two closed sprints behind it, because one number is an anecdote. */}
      {vel.mean !== null && (
        <p className="sp-vel">
          Last {vel.recent.length} sprints finished <b>{vel.recent.join(", ")}</b> &mdash; about{" "}
          <b>{vel.mean} a week</b>.
          {members.length > vel.mean * 1.5 && !closed && (
            <em> This one has {members.length} on it, which is more than this team has ever finished in a week.</em>
          )}
        </p>
      )}

      <p className="sp-lede">
        Everything on the <b>Now</b>{" "}
        horizon is this sprint. Pull a card in from the queue below
        or push one out, and the board moves with it &mdash; the horizon is the same field
        everywhere. Closing the week carries whatever is unfinished into the next one.
      </p>

      {sprint && !members.length && (
        <p className="sp-empty">
          Nothing is on Now, so the sprint is empty. Pull work in from the queue below.
        </p>
      )}
      {!sprint && (
        <p className="sp-empty">
          No sprint was recorded for this week. Only the current week opens one on its own, so
          what a past week committed to is never guessed at after the fact.
        </p>
      )}

      <div className="sp-lanes">
        {LANES.map(({ team, label }) => {
          const mine = members.filter((c) => laneOf(c) === team);
          if (!mine.length) return null;
          return (
            <section className="sp-lane" key={team}>
              <h3>{label}<em>{mine.length}</em></h3>
              <div className="sp-buckets">
                {BUCKETS.map((b) => {
                  const list = mine.filter((c) => bucketOf(c) === b.key);
                  return (
                    <div className={"sp-bucket" + (list.length ? "" : " empty")} key={b.key}>
                      <h4>{b.label}<em>{list.length}</em></h4>
                      {list.map((c) => (
                        <SprintCard key={c.id} card={c} isAdded={!committed.has(c.id)}
                          onOpen={() => onOpen(c.id)} onPush={() => s.setPriority(c.id, 2)} />
                      ))}
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
              <span className="sp-qtitle">{titleOf(c)}</span>
              <span className="sp-qteam">{teamsOf(c) || "Unassigned"}</span>
            </article>
          ))}
          {queued.length > 40 && <p className="sp-qmore">{queued.length - 40} more on Next.</p>}
        </div>
      </section>
    </div>
  );
}

function SprintCard({ card, isAdded, onOpen, onPush }:
  { card: BoardCard; isAdded: boolean; onOpen: () => void; onPush: () => void }) {
  const node: Node = card.node ?? (card.feature as unknown as Node);
  const counts = subtreeCounts(node);
  const [open, setOpen] = useState(false);
  const desc = (node.desc || "").trim();
  return (
    <article className={"sp-card" + (isAdded ? " added" : "")}>
      <div className="sp-cardtop">
        <StatusButton node={node} size={14} />
        {/* The same panel the board opens. A sprint is where the question "what IS this
            one" comes up most, and sending people back to the board to ask it is how a
            planning view becomes a view you read and leave. */}
        <button type="button" className="sp-cardtitle" onClick={onOpen}>{node.title}</button>
        <button type="button" className="sp-push" onClick={onPush} title="Push out to the next sprint">&minus;</button>
      </div>
      {/* Scope added mid-week is marked on the card, not only in the total. The total tells
          you it happened; this tells you which three. */}
      {isAdded && <span className="sp-added">Added after the start</span>}
      <div className="sp-cardfoot">
        <span className="assignees"><Assignees node={node} small /></span>
        {(counts.total > 0 || desc) && (
          <button type="button" className="sp-cardn" onClick={() => setOpen(!open)}
            aria-expanded={open} title={open ? "Hide the detail" : "Show the detail"}>
            {counts.total > 0 ? `${counts.done}/${counts.total}` : "Brief"}
          </button>
        )}
        <span className="sp-cardstage">{STAGE_LABEL[card.stage]}</span>
      </div>
      {/* The sprint is where you check what is actually left, so the brief and the checklist
          open here too rather than only on the board. */}
      {open && desc && <p className="sp-desc">{desc}</p>}
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
