"use client";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { STAGE_LABEL, teamForStage, type BoardTeam, type Stage } from "@/lib/board";
import {
  DAY, SPRINT_WEEKS, addDays, dayMonth, dayOfSprint, isFinished, overlapsWindow, shiftSprintId,
  inSprintScope, sprintId, subtaskSlices, velocity, weekStart, weeksOf, windowOf, type SprintWeeks,
} from "@/lib/sprint";
import { effRange } from "@/lib/dates";
import { cardPriority, effStatus, subtreeCounts } from "@/lib/derive";
import { Assignees } from "../Assignees";
import { DateChip, StatusButton } from "../bits";
import { CardExpand } from "./CardExpand";
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
/** `effStatus`, not the raw field: a card with every subtask ticked off IS done, and the
 *  ring on it already says so. Reading `node.status` left those cards counted as unfinished
 *  here while the board drew them complete. */
const finished = (c: BoardCard) => isFinished({ stage: c.stage, status: effStatus(nodeOf(c)) });
/** Finished answers first, whichever way it finished, so the row colour and the Done meter
 *  can never disagree. */
function bucketOf(c: BoardCard): string {
  if (finished(c)) return "done";
  return BUCKETS.find((b) => b.stages.includes(c.stage))?.key ?? "todo";
}

/** Teams down the side. One lane per card, never one per team it names: PM is on most
 *  cards through an assignee, so listing a card under every team it touches put Dev work
 *  under PM as well. The stage answers first — a card at `dev_progress` is Dev's — and a
 *  card nobody has started falls to the most specific team on it. PM is last because PM
 *  triages everything. */
const LANES: { team: BoardTeam | null; label: string }[] = [
  { team: "PM", label: "PM / CS" },
  { team: "Design", label: "Design" },
  { team: "Engineering", label: "Dev" },
  { team: null, label: "Unassigned" },
];
function laneOf(c: BoardCard): BoardTeam | null {
  const byStage = teamForStage(c.stage);
  if (byStage && c.teams.includes(byStage)) return byStage;
  return c.teams.find((t) => t !== "PM") ?? c.teams[0] ?? null;
}

const TEAM_LABEL: Record<BoardTeam, string> = { PM: "PM / CS", Design: "Design", Engineering: "Dev" };

/** Which team a subtask belongs to: its own Team column if the sheet gave it one, else
 *  whoever is assigned to it. The split between two teams on a card lives at this level —
 *  "design the page" is Design's and "build it" is Dev's — so this is what colours a
 *  segment. */
function teamOfNode(n: Node, s: ReturnType<typeof useStore>): BoardTeam | null {
  const named = [n.team, ...(n.assignees || []).map((a) => s.helpers.assigneeTeam(a))];
  return (named.find(Boolean) as BoardTeam) ?? null;
}

const nodeOf = (c: BoardCard): Node => c.node ?? (c.feature as unknown as Node);
const titleOf = (c: BoardCard) => nodeOf(c).title;
const teamsOf = (c: BoardCard) => c.teams.map((t) => (t === "Engineering" ? "Dev" : t)).join(" · ");
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function SprintBoard({ cards, onOpen }: { cards: BoardCard[]; onOpen: (id: string) => void }) {
  const s = useStore();
  const [offset, setOffset] = useState(0);
  /* Full screen, because a three-week track with four lanes under it does not fit beside
     the rest of the page and a sprint is a thing you stand in front of, not glance at. */
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [full]);

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
  /* A window with no record is not empty, it is UNOPENED. Only the current sprint opens
     itself, so stepping forward used to show "no sprint recorded" over a board with
     thirty-odd cards in flight — technically true and useless for planning. A future
     window previews what would be in it: everything in scope now, drawn where its dates
     fall. Nothing is written, and it is labelled a preview rather than a commitment. */
  const preview = !sprint && offset > 0;
  /* The sprint's own members, then narrowed to the window. Both filters matter and they are
     different questions: membership is what we took on, the window is when it is happening.
     `cards` arrives already filtered by Who and Work, so those apply here too. */
  const members = useMemo(() => {
    const ids = sprint
      ? s.sprintMembers(sprint)
      : preview
        /* A preview is about THESE dates, so it is dated work only. Undated cards pass the
           window test by definition — they are unscheduled, not scheduled-for-now — which
           meant every future window previewed the same thirty-one cards and no two windows
           ever looked different. A card with no dates is not forecast into any week. */
        ? cards.filter((c) => {
          const h = cardPriority(c.node ?? c.feature);
          return inSprintScope({ owned: c.teams.length > 0, now: h === 1, parked: h === 3 })
            && !finished(c) && effRange(nodeOf(c));
        }).map((c) => c.id)
        : [];
    return ids
      .map((cid) => byId.get(cid))
      .filter(Boolean)
      .filter((c) => overlapsWindow(effRange(nodeOf(c as BoardCard)), from, to)) as BoardCard[];
  }, [sprint, preview, cards, byId, s, from, to]);

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
    <div className={"sp" + (full ? " full" : "")}>
      <header className="sp-head">
        <div className="sp-week">
          <button type="button" className="sp-nav" onClick={() => setOffset(offset - 1)} aria-label="Previous sprint">&#8592;</button>
          <b>{dayMonth(from)} &ndash; {dayMonth(to)}</b>
          <button type="button" className="sp-nav" onClick={() => setOffset(offset + 1)} aria-label="Next sprint">&#8594;</button>
          <span className="sp-day">
            {closed ? "Closed" : thisWeek ? `Day ${day} of ${days}` : offset > 0 ? "Not started" : "Never closed"}
          </span>
          {!thisWeek && <button type="button" className="btn ghost sp-sm" onClick={() => setOffset(0)}>This sprint</button>}
        </div>
        <div className="sp-acts">
          <button type="button" className="btn ghost sp-sm" onClick={() => setFull(!full)}
            title={full ? "Back to the page (Esc)" : "Fill the screen"}>
            {full ? "Exit full screen" : "Full screen"}
          </button>
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
            <button type="button" className="btn ghost sp-sm" onClick={copy}
              title="Copy a plain-text summary to paste into WhatsApp">Copy the update</button>
          )}
          {sprint && !closed && offset <= 0 && (
            <button type="button" className="btn primary sp-sm"
              onClick={() => {
                const carry = members.length - done.length;
                /* Closing does not transport anything: unfinished work is still held by a
                   team, so it is in next week by the same rule it was in this one. What
                   closing does is shut the window and write down the slip, which is the
                   number velocity is built from. */
                if (!confirm(`Close this sprint?\n\n${done.length} done, ${carry} unfinished.\n\n`
                  + `The ${carry} stay on the board and carry into the next sprint. This week's `
                  + `numbers are recorded and cannot be edited afterwards.`)) return;
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

      {!sprint && !preview && (
        <p className="sp-empty">
          No sprint was recorded for this window. Only the current one opens on its own, so
          what a past sprint committed to is never guessed at after the fact.
        </p>
      )}
      {preview && (
        <p className="sp-preview">
          <b>Preview.</b> This sprint has not opened yet, so nothing here is committed to.
          It shows the {members.length} card{members.length === 1 ? "" : "s"}{" "}
          already scheduled into these dates. Unscheduled work is not forecast into a week
          nobody has put it in.
        </p>
      )}
      {sprint && !members.length && (
        <p className="sp-empty">
          Nothing is on Now inside these dates. Pull work in from the queue below, or step to
          another sprint.
        </p>
      )}

      {/* The legend carries what the lane labels used to, in one line instead of one band
          per team: which colour is whose, and how that team's sprint is going. */}
      {scheduled.length > 0 && (
        <div className="sp-legend">
          {LANES.map(({ team, label }) => {
            const mine = scheduled.filter((c) => laneOf(c) === team);
            if (!mine.length) return null;
            const laneDone = mine.filter(finished).length;
            return (
              <span className={"sp-key t-" + (team ?? "none")} key={label}
                title={`${label}: ${laneDone} of ${mine.length} done in this sprint`}>
                <i aria-hidden />{label}<b>{laneDone}/{mine.length}</b>
              </span>
            );
          })}
        </div>
      )}

      {/* The track. One row per card, drawn where it falls in the window. */}
      {scheduled.length > 0 && (
        <div className="sp-time" style={{ ["--cols" as string]: cols.length }}>
          {/* The axis is what this view IS, so it is drawn like a heading rather than like
              another row of grey metadata. Today's column is marked on the ruler too, not
              only by the line down the track. */}
          <div className="sp-ruler">
            <span className="sp-rulerpad" />
            <div className="sp-rulercols">
              {cols.map((d, i) => {
                const isToday = byDay && d.getTime() === today.getTime();
                const weekend = byDay && (d.getDay() === 0 || d.getDay() === 6);
                return (
                  <span key={i} className={"sp-rc" + (weekend ? " off" : "") + (isToday ? " today" : "")}>
                    <b>{byDay ? d.toLocaleDateString("en-IN", { weekday: "short" }) : `Week ${i + 1}`}</b>
                    <em>{dayMonth(d)}</em>
                  </span>
                );
              })}
            </div>
          </div>
          {/* Teams down, dates across. Still one view — one date axis, one ruler, every
              lane measured against it — rather than the three separate mini-boards this
              replaced. The lane says whose it is without a card having to repeat it. */}
          {LANES.map(({ team, label }) => {
            const mine = scheduled.filter((c) => laneOf(c) === team);
            if (!mine.length) return null;
            return (
              <div className={"sp-lane t-" + (team ?? "none")} key={label}>
                {/* No label down the side. The team is the colour, named on hover and in
                    the legend above, and three words of uppercase per group was a third of
                    the vertical space going to something the colour already said. */}
                {mine.map((c) => (
                  <TrackRow key={c.id} card={c} from={from} to={to} pct={pct} todayPct={todayPct}
                    onOpen={() => onOpen(c.id)}
                    onDrop={closed ? undefined : () => s.dropFromSprint(id, c.id)} />
                ))}
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
                {!closed && (
                  <button type="button" className="sp-drop" aria-label={`Take ${titleOf(c)} out of this sprint`}
                    title="Take it out of this sprint (it stays on the board)"
                    onClick={() => s.dropFromSprint(id, c.id)}>&times;</button>
                )}
                <button type="button" className="btn ghost sp-sm sp-fit"
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
              <button type="button" className="btn ghost sp-ic" onClick={() => s.setPriority(c.id, 1)}
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

/** One card on the track, and the brief and checklist underneath when you open it.
 *
 *  A bar says when; it cannot say what is left inside it. Opening the row is how you check
 *  that without leaving the week, and it is the same component the board card opens, so the
 *  two cannot drift. */
function TrackRow({ card, from, to, pct, todayPct, onOpen, onDrop }: {
  card: BoardCard; from: Date; to: Date;
  pct: (d: Date) => number; todayPct: number | null; onOpen: () => void;
  onDrop?: () => void;
}) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const node = nodeOf(card);
  const counts = subtreeCounts(node);
  const kids = node.children || [];
  const kidById = useMemo(() => new Map(kids.map((k) => [k.id, k])), [kids]);
  const hasMore = counts.total > 0 || !!(node.desc || "").trim();
  const r = effRange(node)!;
  const cs = new Date(r.start + "T00:00:00");
  const ce = new Date(r.end + "T00:00:00");
  /* Clipped to the window, with a square end on whichever edge it runs past: a bar that
     stopped neatly at Sunday would say the work ends on Sunday. */
  const left = Math.max(0, pct(cs));
  const right = Math.min(100, pct(addDays(ce, 1)));
  const slices = subtaskSlices(r, kids.map((k) => ({ id: k.id, title: k.title, range: effRange(k) })));
  return (
    <>
      <div className="sp-row">
        {/* The status button is a button, so the title beside it is its own and the two are
            siblings. Wrapping one in the other is invalid HTML and React will not hydrate it. */}
        <span className="sp-rowtitle">
          <StatusButton node={node} size={13} />
          {hasMore && (
            <button type="button" className={"sp-caret" + (open ? " on" : "")} aria-expanded={open}
              title={open ? "Hide the brief and the checklist" : "Show the brief and the checklist"}
              onClick={() => setOpen(!open)}>
              {counts.total > 0 ? `${counts.done}/${counts.total}` : "\u2026"}
            </button>
          )}
          <button type="button" className="sp-rowname" onClick={onOpen}>{titleOf(card)}</button>
        </span>
        <div className="sp-track">
          {todayPct !== null && <span className="sp-now" style={{ left: `${todayPct}%` }} aria-hidden />}
          {/* More than one subtask and the bar is a breakdown: one segment each, in the
              order they are listed, coloured by the team that holds it. A single bar across
              a card two teams share says neither when design ends nor when dev can start. */}
          {slices.length > 1
            ? slices.map((sl) => {
              const ss = new Date(sl.start + "T00:00:00");
              const se = new Date(sl.end + "T00:00:00");
              const l = Math.max(0, pct(ss));
              const w = Math.min(100, pct(addDays(se, 1))) - l;
              if (w <= 0) return null;
              const kid = kidById.get(sl.id);
              const team = kid ? teamOfNode(kid, s) : null;
              return (
                <i key={sl.id} className={`sp-seg t-${team ?? "none"}` + (kid && effStatus(kid) === "done" ? " done" : "")
                  + (sl.dated ? " exact" : "")}
                  style={{ left: `${l}%`, width: `${Math.max(1.5, w)}%` }}
                  title={`${sl.title} \u2014 ${team ? TEAM_LABEL[team] : "unassigned"} \u00b7 ${sl.start} \u2192 ${sl.end}`
                    + (sl.dated ? "" : " (its share of the card's window; give it dates to pin it)")}>
                  {/* Only where there is room to read it. A card with fifteen subtasks over
                      one week gives each about half a centimetre, and a label in that space
                      is not shortened text, it is two overlapping words. The colour still
                      says whose it is and the tooltip still says what it is. */}
                  {w >= 9 && <span>{sl.title}</span>}
                </i>
              );
            })
            : (
              <i className={`sp-bar t-${laneOf(card) ?? "none"} b-${bucketOf(card)}`
                + (cs < from ? " runs-in" : "") + (ce > to ? " runs-out" : "")}
                style={{ left: `${left}%`, width: `${Math.max(2, right - left)}%` }}
                title={`${teamsOf(card) || "Unassigned"} \u00b7 ${STAGE_LABEL[card.stage]}`
                  + ` \u00b7 ${r.start} \u2192 ${r.end}${r.implied ? " (from its subtasks)" : ""}`}>
                {/* The stage in words. Colour says whose it is; it cannot also say what is
                    happening to it without becoming two colour systems fighting. */}
                {right - left >= 16 && <span className="sp-barstage">{STAGE_LABEL[card.stage]}</span>}
                <span className="assignees"><Assignees node={node} small /></span>
              </i>
            )}
        </div>
        <span className="sp-rowend">
          <span className="sp-rowteam" title={STAGE_LABEL[card.stage]}>{teamsOf(card) || "Unassigned"}</span>
          {/* Out of this sprint, not off the board. The card keeps its stage, its team and
              its dates; it simply stops being part of this week's commitment. */}
          {onDrop && (
            <button type="button" className="sp-drop" aria-label={`Take ${titleOf(card)} out of this sprint`}
              title="Take it out of this sprint (it stays on the board)"
              onClick={onDrop}>&times;</button>
          )}
        </span>
      </div>
      {open && <div className="sp-rowx"><CardExpand node={node} onOpen={onOpen} /></div>}
    </>
  );
}
