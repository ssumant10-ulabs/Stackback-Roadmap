import type { Stage } from "./board";

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
  return [...sp.committed, ...(sp.added ?? [])].filter((id) => alive.has(id));
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
  const joining = cards.filter((c) => c.now && !isFinished(c)).map((c) => c.id);
  if (!sp) return { id, committed: joining, weeks: 1 };
  if (sp.closedAt) return null;
  const seen = new Set([...sp.committed, ...(sp.added ?? [])]);
  const fresh = joining.filter((cid) => !seen.has(cid));
  return fresh.length ? { ...sp, added: [...(sp.added ?? []), ...fresh] } : null;
}
