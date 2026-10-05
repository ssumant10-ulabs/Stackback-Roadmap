"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGE_LABEL, type Stage } from "@/lib/board";
import {
  DAY, SPRINT_WEEKS, addDays, dayMonth, dayOfSprint, isFinished, overlapsWindow, shiftSprintId,
  sprintId, velocity, weekStart, weeksOf, windowOf, type SprintWeeks,
} from "@/lib/sprint";
import { effRange } from "@/lib/dates";
import { cardPriority } from "@/lib/derive";
import { Assignees } from "../Assignees";
import { DateChip, StatusButton } from "../bits";
import type { BoardCard } from "./WorkBoard";
import type { Node } from "@/lib/types";

/** A sprint, as time rather than as another board.
 *
 *  The board already answers "where is this card", and a second set of status columns only
 *  answered it again in a smaller space. The question a sprint actually asks is about
 *  time: what is in this window, how much of the window is left, and what is going to run
 *  past the end of it. So this is a dated track — one row per card, drawn where it falls —
 *  for a window of one to four weeks, with the Next queue underneath to pull from.
 *
 *  One view, not one per team. A card stuck in review is the week's problem whoever's
 *  review it is; the team is on the row, where it identifies the work rather than
 *  partitioning it, and the team boards are one tab away.
 *
 *  What makes it a sprint rather than a filter, and all four of these pay:
 *    1. The window is a record, opened the first time anyone loads the board that week.
 *    2. Scope and done are two lines. One bar cannot show scope creep.
 *    3. Closing carries the unfinished work forward, by the window's own length.
 *    4. Capacity comes from the last three closed sprints, not from estimating.
 *
 *  UNSCHEDULED WORK IS NOT HIDDEN. Only 5 of 192 cards on the live board carry dates, so a
 *  track that showed dated cards alone would be a blank page with eighteen cards missing.
 *  A card scheduled outside the window is genuinely not in this sprint and is dropped; a
 *  card with no dates is a different thing — it is in the sprint and simply cannot be
 *  placed, so it sits underneath with one click to drop it onto the window. That is the
 *  path from the board we have to the board this view wants. */

/** How far along, used for the colour of a bar and the mark in the pasted update. Every
 *  stage lands in exactly one, so the counts always add up to the sprint. */
const BUCKETS: { key: string; label: string; stages: Stage[] }[] = [
  { key: "todo", label: "To start", stages: ["bug", "feature", "pm_handover"] },
  { key: "doing", label: "In progress", stages: ["pm_progress", "design_progress", "design_to_dev", "dev_progress"] },
  { key: "review", label: "In review", stages: ["design_review", "dev_review"] },
  { key: "done", label: "Done", stages: [] },
];
const finished = (c: BoardCard) =>
  isFinished({ stage: c.stage, status: (c.node ?? c.feature)?.status ?? null });
/** Finished answers first, whichever way it finished, so the row colour and the Done meter
 *  can never disagree. */
function bucketOf(c: BoardCard): string {
  if (finished(c)) return "done";
  return BUCKETS.find((b) => b.stages.includes(c.stage))?.key ?? "todo";
}

const nodeOf = (c: BoardCard): Node => c.node ?? (c.feature as unknown as Node);
const titleOf = (c: BoardCard) => nodeOf(c).title;
const teamsOf = (c: BoardCard) => c.teams.map((t) => (t === "Engineering" ? "Dev" : t)).join(" · ");
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function SprintBoard({ cards, onOpen }: { cards: BoardCard[]; onOpen: (id: string) => void }) {
  const s = useStore();
  const [offset, setOffset] = useState(0);

  /* Stepping is by whole sprints, so with a fortnightly cadence the arrows move a
     fortnight. Walked from this week rather than multiplied, because the length can differ
     between one sprint and the next and only the records know which. */
  const id = useMemo(() => {
    let cur = sprintId(weekStart(0));
    for (let i = 0; i < Math.abs(offset); i++) {
      cur = shiftSprintId(cur, weeksOf(s.sprintFor(cur)), offset > 0 ? 1 : -1);
    }
    return cur;
  }, [offset, s]);

  const sprint = s.sprintFor(id);
  const weeks = weeksOf(sprint);
  const { from, to, days } = windowOf(id, weeks);
  const thisWeek = offset === 0;
  const closed = !!sprint?.closedAt;

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  /* The sprint's own members, then narrowed to the window. Both filters matter and they are
     different questions: membership is what we took on, the window is when it is happening.
     `cards` arrives already filtered by Who and Work, so those apply here too. */
  const members = useMemo(() => {
    if (!sprint) return [];
    return s.sprintMembers(sprint)
      .map((cid) => byId.get(cid))
      .filter(Boolean)
      .filter((c) => overlapsWindow(effRange(nodeOf(c as BoardCard)), from, to)) as BoardCard[];
  }, [sprint, byId, s, from, to]);

  const scheduled = members.filter((c) => effRange(nodeOf(c)));
  const undated = members.filter((c) => !effRange(nodeOf(c)));
  const committed = new Set(sprint?.committed ?? []);
  /* Counted over what is on screen, not over the whole commitment. Cards committed to but
     scheduled outside this window are not in this window, and reading the raw list gave
     "12 committed" above "0 of 10" -- two bars that cannot be compared. */
  const inScope = members.filter((c) => committed.has(c.id)).length;
  const added = members.filter((c) => !committed.has(c.id));
  const done = members.filter(finished);
  const queued = cards.filter((c) => cardPriority(c.node ?? c.feature) === 2);

  const vel = velocity(s.sprints);
  const day = dayOfSprint(from, weeks);
  const scopePct = members.length ? Math.round((inScope / members.length) * 100) : 100;
  const donePct = members.length ? Math.round((done.length / members.length) * 100) : 0;

  /* Day columns up to a fortnight; past that they are 2mm wide and unreadable, so a
     four-week sprint is ruled by week. */
  const byDay = days <= 14;
  const cols = byDay
    ? Array.from({ length: days }, (_, i) => addDays(from, i))
    : Array.from({ length: weeks }, (_, i) => addDays(from, i * 7));

  const pct = (d: Date) => ((d.getTime() - from.getTime()) / (days * DAY)) * 100;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayPct = today >= from && today <= to ? pct(today) : null;

  const copy = () => {
    const lines = [
      `*Sprint ${dayMonth(from)} – ${dayMonth(to)}*${weeks > 1 ? ` (${weeks} weeks)` : ""}`,
      `${done.length} of ${members.length} done${added.length ? ` · ${added.length} added after we started` : ""}`,
    ];
    const MARK: Record<string, string> = { done: "✅", todo: "⬜", doing: "🔄", review: "👀" };
    for (const b of BUCKETS) {
      const list = members.filter((c) => bucketOf(c) === b.key);
      if (!list.length) continue;
      lines.push("", `*${b.label}* (${list.length})`);
      for (const c of list) {
        const who = nodeOf(c).assignees?.map((a) => a.name).join(", ");
        const r = effRange(nodeOf(c));
        lines.push(`${MARK[b.key]} ${titleOf(c)}${who ? ` — ${who}` : ""}${r ? ` (${dayMonth(new Date(r.end + "T00:00:00"))})` : ""}`);
      }
    }
    const carry = members.length - done.length;
    if (carry) lines.push("", `Carrying into the next sprint: ${carry}`);
    navigator.clipboard?.writeText(lines.join("\n"));
  };

  return (
    <div className="sp">
      <header className="sp-head">
        <div className="sp-week">
          <button type="button" onClick={() => setOffset(offset - 1)} aria-label="Previous sprint">&#8592;</button>
          <b>{dayMonth(from)} &ndash; {dayMonth(to)}</b>
          <button type="button" onClick={() => setOffset(offset + 1)} aria-label="Next sprint">&#8594;</button>
          <span className="sp-day">
            {closed ? "Closed" : thisWeek ? `Day ${day} of ${days}` : offset > 0 ? "Not started" : "Never closed"}
          </span>
          {!thisWeek && <button type="button" className="sp-today" onClick={() => setOffset(0)}>This sprint</button>}
        </div>
        <div className="sp-acts">
          {/* Length lives on the sprint, not in settings: a team trying a fortnight should
              not have to change a global to see what it looks like. Locked once closed,
              because redrawing a finished window changes what it is on record as. */}
          {sprint && !closed && (
            <label className="sp-len">
              <span>Length</span>
              <select value={weeks} onChange={(e) => s.setSprintWeeks(id, Number(e.target.value) as SprintWeeks)}>
                {SPRINT_WEEKS.map((w) => <option key={w} value={w}>{w} week{w === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          )}
          {members.length > 0 && (
            <button type="button" className="sp-today" onClick={copy}
              title="Copy a plain-text summary to paste into WhatsApp">Copy the update</button>
          )}
          {sprint && !closed && offset <= 0 && (
            <button type="button" className="sp-close"
              onClick={() => {
                const carry = members.length - done.length;
                if (!confirm(`Close this sprint?\n\n${done.length} done, ${carry} unfinished.\nThe ${carry} carry into the next one and stay on Now.`)) return;
                s.closeSprint(id);
                setOffset(offset + 1);
              }}>Close &amp; roll over</button>
          )}
        </div>
      </header>

      {sprint && members.length > 0 && (
        <div className="sp-meters">
          <div className="sp-meter">
            <span className="sp-mlbl">Scope</span>
            <span className="sp-mbar sp-scope">
              <i style={{ width: `${scopePct}%` }} />
              {added.length > 0 && <u style={{ width: `${100 - scopePct}%` }} />}
            </span>
            <span className="sp-mn">
              {inScope} committed{added.length > 0 && <b> + {added.length} added</b>}
            </span>
          </div>
          <div className="sp-meter">
            <span className="sp-mlbl">Done</span>
            <span className="sp-mbar"><i style={{ width: `${donePct}%` }} /></span>
            <span className="sp-mn">{done.length} of {members.length}</span>
          </div>
        </div>
      )}

      {vel.mean !== null && (
        <p className="sp-vel">
          Last {vel.recent.length} sprints finished <b>{vel.recent.join(", ")}</b> &mdash; about{" "}
          <b>{vel.mean} a sprint</b>.
          {members.length > vel.mean * 1.5 && !closed && (
            <em> This one has {members.length} on it, which is more than this team has ever finished in one.</em>
          )}
        </p>
      )}

      {!sprint && (
        <p className="sp-empty">
          No sprint was recorded for this window. Only the current one opens on its own, so
          what a past sprint committed to is never guessed at after the fact.
        </p>
      )}
      {sprint && !members.length && (
        <p className="sp-empty">
          Nothing is on Now inside these dates. Pull work in from the queue below, or step to
          another sprint.
        </p>
      )}

      {/* The track. One row per card, drawn where it falls in the window. */}
      {scheduled.length > 0 && (
        <div className="sp-time" style={{ ["--cols" as string]: cols.length }}>
          <div className="sp-ruler">
            <span className="sp-rulerpad" />
            <div className="sp-rulercols">
              {cols.map((d, i) => (
                <span key={i} className={"sp-rc" + (byDay && (d.getDay() === 0 || d.getDay() === 6) ? " off" : "")}>
                  {byDay ? d.toLocaleDateString("en-IN", { weekday: "narrow" }) : `W${i + 1}`}
                  <em>{dayMonth(d)}</em>
                </span>
              ))}
            </div>
          </div>
          {scheduled.map((c) => {
            const r = effRange(nodeOf(c))!;
            const cs = new Date(r.start + "T00:00:00");
            const ce = new Date(r.end + "T00:00:00");
            /* Clipped to the window, with a nub on whichever edge it runs past: a bar that
               stopped neatly at Sunday would say the work ends on Sunday. */
            const left = Math.max(0, pct(cs));
            const right = Math.min(100, pct(addDays(ce, 1)));
            return (
              <div className="sp-row" key={c.id}>
                {/* The status button is a button, so the title beside it is its own and the
                    two are siblings. Wrapping one in the other is invalid HTML and React
                    refuses to hydrate it. */}
                <span className="sp-rowtitle">
                  <StatusButton node={nodeOf(c)} size={13} />
                  <button type="button" className="sp-rowname" onClick={() => onOpen(c.id)}>{titleOf(c)}</button>
                </span>
                <div className="sp-track">
                  {todayPct !== null && <span className="sp-now" style={{ left: `${todayPct}%` }} aria-hidden />}
                  <i className={`sp-bar b-${bucketOf(c)}` + (cs < from ? " runs-in" : "") + (ce > to ? " runs-out" : "")}
                    style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
                    title={`${r.start} → ${r.end}${r.implied ? " (from its subtasks)" : ""} · ${STAGE_LABEL[c.stage]}`}>
                    <span className="assignees"><Assignees node={nodeOf(c)} small /></span>
                  </i>
                </div>
                <span className="sp-rowteam" title={STAGE_LABEL[c.stage]}>{teamsOf(c) || "Unassigned"}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Unscheduled, and therefore unplaceable. Kept in the sprint because it IS in the
          sprint, and given the one button that turns it into something this view can draw. */}
      {undated.length > 0 && (
        <section className="sp-undated">
          <h3>Not scheduled yet<em>{undated.length}</em></h3>
          <p className="sp-qlede">
            In this sprint, but with no dates, so there is nowhere to draw them. Give one a
            window and it joins the track above.
          </p>
          <div className="sp-ulist">
            {undated.map((c) => (
              <article className="sp-ucard" key={c.id}>
                <StatusButton node={nodeOf(c)} size={13} />
                <button type="button" className="sp-utitle" onClick={() => onOpen(c.id)}>{titleOf(c)}</button>
                <span className="assignees"><Assignees node={nodeOf(c)} small /></span>
                <span className="sp-rowteam">{teamsOf(c) || "Unassigned"}</span>
                <DateChip node={nodeOf(c)} variant="icon" />
                <button type="button" className="sp-fit"
                  title={`Schedule it across this sprint, ${dayMonth(from)} to ${dayMonth(to)}`}
                  onClick={() => s.setDates(c.id, { start: iso(from), end: iso(to) }, "end")}>
                  Fit to sprint
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

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

