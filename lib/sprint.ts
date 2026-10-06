import type { Stage } from "./board";
import { parseDay, toIso } from "./dates";

/** A week's sprint, as a record rather than a filter.
 *
 *  The Now horizon on its own answers "what are we doing", which never closes and so never
 *  teaches anything. A sprint is the same set of cards with two extra facts attached: when
 *  the week started, and what we had agreed to before it did. Those two are what make scope
 *  creep visible and what make last week's number mean something this week.
 *
 *  One record per Monday, created the first time the sprint view is opened in that week, so
 *  nobody has to remember to start one. */
export interface Sprint {
  /** `yyyy-mm-dd` of the Monday it starts. The id and the window are the same fact, so a
   *  sprint cannot drift off its dates. */
  id: string;
  /** How many weeks it runs, 1 to 4. Stored on the sprint rather than set globally, because
   *  changing the length must not silently redraw the windows of sprints already closed. */
  weeks?: SprintWeeks;
  /** Card ids on Now the moment it opened. Everything measured about scope is measured
   *  against this, which is why it is a snapshot and never recomputed. */
  committed: string[];
  /** Cards taken out by hand. Recorded, because scope is derived from the board every
   *  render: without this, removing a card put it back on the next tick. */
  dropped?: string[];
  /** Cards put on Now after it opened, recorded as they arrive.
   *
   *  Recorded rather than derived, for the same reason `committed` is. Deriving it as "on
   *  Now and not committed" looks equivalent and is not: the only way to tell work that was
   *  already finished when it landed here from work that landed here and then got finished
   *  is to have written down the moment it joined. Without this, a card pulled in on Tuesday
   *  and shipped on Thursday disappeared from the week it was done in. */
  added?: string[];
  /** ISO timestamp it was closed. Absent means this is the sprint we are in. */
  closedAt?: string | null;
  /** How many of its cards had finished at close, and how many carried. Stored, not derived:
   *  the cards move on afterwards, and a velocity that changes when you edit an old card is
   *  not a measurement. */
  done?: number;
  rolled?: number;
}

export type SprintWeeks = 1 | 2 | 3 | 4;
export const SPRINT_WEEKS: SprintWeeks[] = [1, 2, 3, 4];
export const weeksOf = (sp: Sprint | undefined): SprintWeeks => sp?.weeks ?? 1;

/** Stages that count as finished: the board's own Done bucket. */
export const DONE_STAGES: Stage[] = ["design_approved", "dev_approved", "prod"];

/** Whether a card is finished as far as the week is concerned.
 *
 *  Two ways in, and both are needed. The stage covers work that went out through review and
 *  shipped. The card's own status covers everything that never passes through an approval
 *  stage at all: PM and CS work stops at `pm_progress`, so a stage-only rule would carry
 *  "write the pricing brief" into every sprint for the rest of the year.
 *
 *  This is deliberately looser than the board's Done COLUMN, which stays on the stage alone.
 *  The column answers "has this shipped"; the sprint answers "is this off our plate", and a
 *  checkbox nobody can make move the number is a checkbox nobody ticks. */
export function isFinished(c: { stage: Stage; status?: string | null }): boolean {
  return DONE_STAGES.includes(c.stage) || (c.status || "") === "done";
}

/** Not yet work: PM's two filing piles, and the "To pick up" column a card waits in after
 *  it has been handed to a team. Everything past these is in somebody's hands.
 *
 *  A card waiting to be picked up is not this week's work by default — but a card added
 *  FROM the sprint is put on Now, which is the other way into scope, so assigning something
 *  there still lands it in the week you assigned it for. */
export const INTAKE_STAGES: Stage[] = ["bug", "feature", "pm_handover"];

/** Whether a card belongs to the sprint at all.
 *
 *  Two ways in. The Now horizon is a deliberate commitment — somebody said this week. And
 *  anything that has left intake is in flight whatever its horizon says: a card sitting in
 *  Dev in progress IS this week's work, and a sprint that left it out because nobody had
 *  remembered to tag it Now was a sprint describing a smaller week than the one happening.
 *
 *  The intake piles stay out. A bug nobody has picked up is a thing to triage, not work in
 *  progress, and sweeping thirty of them in would make the week unreadable. */
export const inSprintScope = (c: { stage: Stage; now: boolean }) =>
  c.now || !INTAKE_STAGES.includes(c.stage);

/** Monday of the week `offset` weeks from the one containing `from`. Weeks start Monday
 *  because the team's does; nothing in the data says otherwise. */
export function weekStart(offset = 0, from = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7);
  return d;
}
export const sprintId = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const dayMonth = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const DAY = 86400000;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/** The window a sprint covers: its start Monday, and the Sunday `weeks` weeks later. */
export function windowOf(id: string, weeks: SprintWeeks): { from: Date; to: Date; days: number } {
  const from = new Date(id + "T00:00:00");
  const days = weeks * 7;
  return { from, to: addDays(from, days - 1), days };
}

/** The id of the sprint `dir` windows away, which depends on how long THIS one is: after a
 *  three-week sprint the next one starts three weeks on, not next Monday. */
export const shiftSprintId = (id: string, weeks: SprintWeeks, dir: number) =>
  sprintId(addDays(new Date(id + "T00:00:00"), dir * weeks * 7));

/** Which day of the sprint we are on, 1-indexed, clamped to its length. Shown rather than a
 *  countdown: the useful question on a Thursday is how much is left, not how much has gone. */
export function dayOfSprint(start: Date, weeks: SprintWeeks = 1, now = new Date()): number {
  const ms = new Date(now).setHours(0, 0, 0, 0) - start.getTime();
  return Math.min(weeks * 7, Math.max(1, Math.floor(ms / DAY) + 1));
}

/** Whether a card's own window touches the sprint's at all.
 *
 *  This is what "only the weeks specified should show up" means: a card scheduled 12–16 Oct
 *  is not part of the 5–11 Oct sprint and should not be drawn in it, whatever horizon it
 *  carries. A card with no dates is NOT excluded here — it is unscheduled, which is a
 *  different thing from scheduled elsewhere, and hiding it would hide most of the board. */
export function overlapsWindow(
  range: { start: string; end: string } | null, from: Date, to: Date,
): boolean {
  if (!range) return true;
  const s = new Date(range.start + "T00:00:00").getTime();
  const e = new Date(range.end + "T00:00:00").getTime();
  return e >= from.getTime() && s <= to.getTime();
}

/** What the last `n` closed sprints finished, newest first, and their mean.
 *
 *  Capacity you have measured beats capacity you have estimated, which is the whole reason
 *  this is stored. It stays null until there are two closed sprints to average: one number
 *  is an anecdote and planning against it is worse than planning against nothing. */
export function velocity(sprints: Sprint[], n = 3): { recent: number[]; mean: number | null } {
  const recent = sprints
    .filter((s) => s.closedAt)
    .sort((a, b) => (a.id < b.id ? 1 : -1))
    .slice(0, n)
    .map((s) => s.done ?? 0);
  return { recent, mean: recent.length >= 2 ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null };
}

/** Which cards a sprint is about, as set algebra over ids so it can be asserted without a
 *  browser. The store supplies the live board; `scripts/eval-sprint.ts` supplies a fixture.
 *
 *  A closed sprint is frozen at what it committed to: its cards keep moving on the board
 *  afterwards, and a membership still being derived would quietly rewrite last month every
 *  time somebody ticked something off. The open one is its commitment plus anything since
 *  put on Now — except work that was already finished when it landed there, which was never
 *  part of the week and would otherwise inflate both lines at once. */
export function sprintMembers(sp: Sprint, cards: { id: string }[]): string[] {
  /* Cards deleted since the sprint opened drop out rather than counting as never-done. */
  const alive = new Set(cards.map((c) => c.id));
  const out = new Set(sp.dropped ?? []);
  return [...sp.committed, ...(sp.added ?? [])].filter((id) => alive.has(id) && !out.has(id));
}

/** Bring a sprint record up to date with the board: open the week if it is not open, and
 *  record anything newly put on Now.
 *
 *  Returns a new record when something changed and null when nothing did, so the caller can
 *  skip the write — this runs on every board render.
 *
 *  Work that is already finished when it reaches Now is not picked up at all. It was never
 *  part of the week, and counting it would move both lines at once and say nothing. */
export function syncSprint(
  sp: Sprint | undefined,
  id: string,
  cards: { id: string; stage: Stage; status?: string | null; now: boolean }[],
): Sprint | null {
  const joining = cards.filter((c) => inSprintScope(c) && !isFinished(c)).map((c) => c.id);
  if (!sp) return { id, committed: joining, weeks: 1 };
  if (sp.closedAt) return null;
  const seen = new Set([...sp.committed, ...(sp.added ?? []), ...(sp.dropped ?? [])]);
  const fresh = joining.filter((cid) => !seen.has(cid));
  return fresh.length ? { ...sp, added: [...(sp.added ?? []), ...fresh] } : null;
}

/** One subtask's slice of its parent's window, as dates.
 *
 *  A card with two teams under it is really two pieces of work in sequence — "design the
 *  page" then "build it" — and one bar across the whole window says neither when design
 *  ends nor when dev can start. So the parent's window is cut into one slice per subtask,
 *  in the order they are listed, which is the order they are meant to happen in.
 *
 *  A subtask that carries its own dates uses them and is marked `dated`; the rest take
 *  their slot by position. That keeps the breakdown readable before anybody has dated
 *  anything, and exact the moment they do, rather than being useless until then. */
export interface Slice {
  id: string;
  title: string;
  start: string;
  end: string;
  /** True when these are the subtask's own dates rather than its share of the parent's. */
  dated: boolean;
}

/* `parseDay`/`toIso` from lib/dates, not local-midnight arithmetic. Dividing a local
   timestamp by a day and flooring it yields the UTC day, which east of Greenwich is the day
   before: every slice came out starting on the Sunday. These anchor at UTC noon, which is
   why nothing in this app drifts across a timezone. */
/* floor, not round: `parseDay` anchors at UTC NOON, so the quotient is the day index plus
   a half and rounding it lands on tomorrow. */
const dayNum = (isoDay: string) => Math.floor((parseDay(isoDay) as number) / DAY);
const fromDay = (n: number) => toIso(n * DAY);

/** Days a window covers, inclusive of both ends: Monday to Friday is five, not four. */
export const spanDays = (r: { start: string; end: string }) => Math.max(1, dayNum(r.end) - dayNum(r.start) + 1);

export function subtaskSlices(
  parent: { start: string; end: string },
  kids: { id: string; title: string; range: { start: string; end: string } | null }[],
): Slice[] {
  if (!kids.length) return [];
  const a = dayNum(parent.start);
  const b = dayNum(parent.end);
  const span = spanDays(parent);
  const n = kids.length;
  /* More subtasks than days is not a breakdown anyone can draw. Fifteen of them across one
     week is half a day each: every slice clamps to a minimum of one day, the starts stop
     advancing, and they pile up on the same square centimetre with their labels printed
     over one another. The caller falls back to a single bar, and the checklist underneath
     is where fifteen subtasks are legible anyway. */
  if (n > span) return [];
  const raw = kids.map((k, i) => {
    if (k.range) return { id: k.id, title: k.title, s: dayNum(k.range.start), e: dayNum(k.range.end), dated: true };
    /* Boundaries from the same rounding on both sides, so slices meet exactly and the last
       one always lands on the parent's final day however the division falls. */
    const s = a + Math.floor((i * span) / n);
    const e = a + Math.floor(((i + 1) * span) / n) - 1;
    return { id: k.id, title: k.title, s, e: Math.max(s, e), dated: false };
  });

  /* A SEQUENCE, enforced. Two subtasks dated the same week are honest data — people do work
     in parallel — but drawn on one line they are two absolutely-positioned boxes on the same
     pixels, and their labels interleave character by character into something unreadable.
     That is what was on screen. So each one starts no earlier than the day after the one
     before it, which is what "in sequence" meant all along; a dated subtask keeps its own
     length and gives up only its overlap. If pushing them apart runs past the parent, there
     is no room for a breakdown and the caller falls back to a single bar. */
  let cursor = a - 1;
  const out: Slice[] = [];
  for (const r of raw) {
    const s = Math.max(r.s, cursor + 1);
    const e = Math.max(s, s + (r.e - r.s));
    if (s > b) return [];
    cursor = e;
    out.push({ id: r.id, title: r.title, start: fromDay(s), end: fromDay(Math.min(e, b)), dated: r.dated });
  }
  return out;
}
