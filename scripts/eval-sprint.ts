/** The sprint's arithmetic, asserted.
 *
 *  A sprint view is only worth building if its three numbers are right: what we committed
 *  to, what was added to the week after it started, and what carries when it closes. Each
 *  of those is a set operation over card ids, and each has an obvious wrong answer that
 *  still renders plausibly — counting a card twice, carrying a card that shipped, averaging
 *  one sprint and calling it capacity. So they are asserted here rather than eyeballed.
 *
 *  Run: npx tsx scripts/eval-sprint.ts
 */
import {
  dayOfSprint, isFinished, overlapsWindow, shiftSprintId, sprintId, sprintMembers as members,
  inSprintScope, subtaskSlices, syncSprint, velocity, weekStart, windowOf,
  type Sprint,
} from "../lib/sprint";
import type { Stage } from "../lib/board";
import { effStatus } from "../lib/derive";
import type { Node } from "../lib/types";

let fails = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`);
};
const eq = (a: unknown, b: unknown, what: string) =>
  ok(JSON.stringify(a) === JSON.stringify(b), `${what} — got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

/* ---- the window ---------------------------------------------------------------------- */
console.log("\nThe week is the id, and the id is the week");
for (const [day, label] of [["2026-10-05", "a Monday"], ["2026-10-08", "a Thursday"], ["2026-10-11", "a Sunday"]] as const) {
  const d = new Date(day + "T09:30:00");
  eq(sprintId(weekStart(0, d)), "2026-10-05", `${label} belongs to the week of the 5th`);
}
eq(sprintId(weekStart(1, new Date("2026-10-05T00:00:00"))), "2026-10-12", "next week is seven days on");
eq(sprintId(weekStart(-1, new Date("2026-10-05T00:00:00"))), "2026-09-28", "last week is seven days back");
/* A Monday is day 1, not day 0, and nothing is day 8: a sprint read on the following
   Tuesday still says 7, because "day 9 of 7" is not a thing anyone can act on. */
const mon = weekStart(0, new Date("2026-10-05T00:00:00"));
eq(dayOfSprint(mon, 1, new Date("2026-10-05T23:00:00")), 1, "Monday is day 1");
eq(dayOfSprint(mon, 1, new Date("2026-10-09T09:00:00")), 5, "Friday is day 5");
eq(dayOfSprint(mon, 1, new Date("2026-10-20T09:00:00")), 7, "a week later still clamps to 7");

console.log("\nLonger sprints");
/* A three-week sprint is one window, not three. Day 12 of 21 has to be sayable, and the
   next sprint starts three weeks on -- advancing by one week would overlap the one that
   just closed and the carried cards would land inside their own sprint. */
eq(windowOf("2026-10-05", 3).days, 21, "three weeks is 21 days");
eq(sprintId(windowOf("2026-10-05", 3).to), "2026-10-25", "and ends on the Sunday of the third");
eq(dayOfSprint(mon, 3, new Date("2026-10-16T09:00:00")), 12, "day 12 of 21");
eq(dayOfSprint(mon, 3, new Date("2026-11-20T09:00:00")), 21, "and it clamps at 21, not 7");
eq(shiftSprintId("2026-10-05", 3, 1), "2026-10-26", "the next sprint starts after all three weeks");
eq(shiftSprintId("2026-10-05", 3, -1), "2026-09-14", "and the previous one is three weeks back");
eq(shiftSprintId("2026-10-05", 1, 1), "2026-10-12", "a one-week sprint still steps a week");

console.log("\nOnly what is scheduled in the window shows up");
const win = windowOf("2026-10-05", 1);
const wk = (a: string, b: string) => ({ start: a, end: b });
ok(overlapsWindow(wk("2026-10-05", "2026-10-09"), win.from, win.to), "a card inside the week is in");
ok(overlapsWindow(wk("2026-09-28", "2026-10-06"), win.from, win.to), "one that starts before and runs in is in");
ok(overlapsWindow(wk("2026-10-09", "2026-10-20"), win.from, win.to), "one that starts in and runs past is in");
ok(overlapsWindow(wk("2026-10-05", "2026-10-05"), win.from, win.to), "a single day on the first day is in");
ok(overlapsWindow(wk("2026-10-11", "2026-10-11"), win.from, win.to), "and on the last day");
/* The one from the screenshot: scheduled 12-16 Oct, showing in the 5-11 Oct sprint. */
ok(!overlapsWindow(wk("2026-10-12", "2026-10-16"), win.from, win.to), "next week's work is NOT in this week");
ok(!overlapsWindow(wk("2026-09-28", "2026-10-04"), win.from, win.to), "nor last week's");
/* Undated is unscheduled, which is not the same as scheduled elsewhere: hiding it would
   hide most of the board, since 5 of 192 cards carry dates. */
ok(overlapsWindow(null, win.from, win.to), "a card with no dates is not excluded by date");
ok(overlapsWindow(wk("2026-10-12", "2026-10-16"), windowOf("2026-10-05", 3).from, windowOf("2026-10-05", 3).to),
  "and a three-week sprint does take in the week after next");

/* ---- membership, scope and carry ------------------------------------------------------
   `syncSprint` and `sprintMembers` are the two the store calls, handed a fixture instead of
   the live board, so what is asserted here is the code that ships rather than a copy of it. */
type Card = { id: string; stage: Stage; status?: string | null; now: boolean };

console.log("\nWhat counts as finished");
/* A card whose every subtask is ticked IS closed, and the ring on it already said so.
   The sprint read the raw `status` field, which a parent never has written to it, so those
   cards sat in the track as unfinished while the board drew them complete. */
const allDone: Node = {
  id: "p", title: "parent", status: "planned", assignees: [], children: [
    { id: "k1", title: "a", status: "done", assignees: [], children: [] },
    { id: "k2", title: "b", status: "done", assignees: [], children: [] },
  ],
};
const someDone: Node = { ...allDone, children: [allDone.children[0], { ...allDone.children[1], status: "planned" }] };
eq(effStatus(allDone), "done", "every subtask done rolls the parent up to done");
ok(isFinished({ stage: "dev_progress", status: effStatus(allDone) }),
  "so the sprint counts it finished, wherever its stage happens to be");
ok(!isFinished({ stage: "dev_progress", status: effStatus(someDone) }),
  "one subtask left and it is not");
ok(!isFinished({ stage: "dev_progress", status: allDone.status }),
  "and reading the raw field instead would have missed it \u2014 which was the bug");
ok(isFinished({ stage: "prod", status: "planned" }), "shipped is finished whatever the checkbox says");
ok(isFinished({ stage: "pm_progress", status: "done" }),
  "a ticked-off PM card is finished with no approval stage to reach");
ok(!isFinished({ stage: "dev_review", status: "progress" }), "in review is not finished");

console.log("\nWhat the sprint is about");
/* Two ways in. Now is a deliberate commitment; anything past the intake piles is in flight
   whatever its horizon says, because a card sitting in Dev in progress IS this week's work
   and a sprint that left it out described a smaller week than the one happening. */
ok(inSprintScope({ stage: "dev_progress", now: false }), "work in flight is in the sprint without being tagged Now");
ok(inSprintScope({ stage: "design_review", now: false }), "so is anything out for review");
ok(inSprintScope({ stage: "dev_approved", now: false }), "and anything approved");
ok(!inSprintScope({ stage: "bug", now: false }), "a bug nobody has picked up is not");
ok(!inSprintScope({ stage: "feature", now: false }), "nor an unfiled request");
ok(!inSprintScope({ stage: "pm_handover", now: false }),
  "nor one still sitting in a team's To pick up column");
ok(inSprintScope({ stage: "pm_handover", now: true }),
  "unless it was put on Now, which is how adding from the sprint lands it in the week");
ok(inSprintScope({ stage: "bug", now: true }), "unless somebody put it on Now, which is the other way in");

console.log("\nOpening the week");
const cards: Card[] = [
  { id: "a", stage: "dev_progress", now: true },               // still going
  { id: "b", stage: "dev_progress", now: true },               // will ship this week
  { id: "c", stage: "design_review", now: true },              // in review
  { id: "z", stage: "feature", now: true },                    // will be deleted mid-week
  { id: "e", stage: "dev_approved", now: true },               // already shipped before Monday
  { id: "p", stage: "pm_progress", status: "done", now: true },// already ticked off before Monday
  { id: "f", stage: "feature", now: false },                   // on Next, not this sprint
];
const opened = syncSprint(undefined, "2026-10-05", cards)!;
eq(opened.committed, ["a", "b", "c", "z"], "the commitment is what was open on Now on Monday");
ok(!opened.committed.includes("e"), "work already shipped when the week opened is not in it");
ok(!opened.committed.includes("p"), "nor work already ticked off");
ok(!opened.committed.includes("f"), "nor the Next queue");

console.log("\nScope added after it started");
/* Recorded as it arrives, not derived later. Deriving "on Now and not committed" looks
   equivalent until a card pulled in on Tuesday ships on Thursday: it then stops matching
   and disappears out of the week it was actually done in. */
let sp = syncSprint(opened, "2026-10-05", [...cards, { id: "d", stage: "bug", now: true }])!;
eq(sp.added, ["d"], "a card pulled in mid-week is written down");
ok(syncSprint(sp, "2026-10-05", [...cards, { id: "d", stage: "bug", now: true }]) === null,
  "and not written down twice, so an idle render does not write");
const withD: Card[] = [...cards, { id: "d", stage: "bug", now: true }];
eq(members(sp, withD), ["a", "b", "c", "z", "d"],
  "the week is its commitment plus what it took on");
/* The case that was wrong before: d ships on Thursday. */
const shipped: Card[] = [...cards, { id: "d", stage: "prod", now: true }];
eq(members(sp, shipped), ["a", "b", "c", "z", "d"],
  "a card added mid-week and then shipped stays in the week it was done in");
ok(syncSprint(sp, "2026-10-05", shipped) === null, "and is not re-added once it is finished");
eq(members(sp, shipped.filter((c) => c.id !== "z")), ["a", "b", "c", "d"],
  "a card deleted mid-sprint drops out instead of counting as never-done");

console.log("\nTaking a card out by hand");
/* Scope is recomputed from the board every render, so a removal has to be WRITTEN DOWN or
   the card walks straight back in on the next tick. */
const onBoard: Card[] = [
  { id: "a", stage: "dev_progress", now: true },
  { id: "b", stage: "dev_progress", now: true },
  { id: "c", stage: "design_review", now: true },
  { id: "d", stage: "bug", now: true },
];
const withDrop: Sprint = { ...sp, dropped: ["a"] };
ok(!members(withDrop, onBoard).includes("a"), "a dropped card leaves the sprint");
ok(members(withDrop, onBoard).length === members(sp, onBoard).length - 1, "and only that one leaves");
ok(syncSprint(withDrop, "2026-10-05", [{ id: "a", stage: "dev_progress", now: true }]) === null,
  "and the next render does not add it back");

console.log("\nThe two lines, and what carries");
const live: Card[] = [
  { id: "a", stage: "dev_progress", now: true },
  { id: "b", stage: "prod", now: true },
  { id: "c", stage: "design_review", now: true },
  { id: "z", stage: "feature", status: "done", now: true },
  { id: "d", stage: "prod", now: true },
];
const m = members(sp, live);
const done = m.filter((id) => isFinished(live.find((c) => c.id === id)!));
/* Both bars are drawn against the same total. Measuring done against the commitment while
   scope counts the additions is how a view ends up saying 6 of 14 next to a scope of 17. */
eq([done.length, m.length], [3, 5], "done and scope share a denominator");
eq(m.filter((id) => !sp.committed.includes(id)), ["d"], "exactly one card was added after the start");
const carry = m.filter((id) => !isFinished(live.find((c) => c.id === id)!));
eq(carry, ["a", "c"], "everything unfinished carries, by either definition of finished");
eq(m.length - carry.length, 3, "the stored done count is scope minus carry");
eq(Array.from(new Set([...carry, ...carry])), ["a", "c"], "closing twice does not duplicate the carried cards");

/* A closed sprint is frozen. Its cards keep moving on the board afterwards, and a
   membership still being derived would rewrite last month every time one was ticked. */
const shut: Sprint = { ...sp, closedAt: "2026-10-12T04:00:00.000Z", done: 3, rolled: 2 };
ok(syncSprint(shut, "2026-10-05", [...live, { id: "g", stage: "bug", now: true }]) === null,
  "a closed sprint takes on nothing further");
eq(members(shut, live), ["a", "b", "c", "z", "d"], "and keeps exactly what it held");

console.log("\nSubtasks laid out across the card's window");
/* A card two teams share is two pieces of work in sequence. One bar across the whole
   window says neither when design ends nor when dev can start. */
const kid = (id: string, range: { start: string; end: string } | null) => ({ id, title: id, range });
const even = subtaskSlices({ start: "2026-10-05", end: "2026-10-11" },
  [kid("a", null), kid("b", null)]);
eq(even.map((x) => `${x.start}..${x.end}`), ["2026-10-05..2026-10-07", "2026-10-08..2026-10-11"],
  "two undated subtasks split the week in order");
ok(even.every((x) => !x.dated), "and are marked as positional, not as dates anyone gave");
/* Slices must meet exactly and cover the window: a gap reads as idle time nobody planned,
   and the last one has to land on the parent's final day however the division falls. */
const three = subtaskSlices({ start: "2026-10-05", end: "2026-10-11" },
  [kid("a", null), kid("b", null), kid("c", null)]);
eq(three[0].start, "2026-10-05", "the first slice starts when the card does");
eq(three[2].end, "2026-10-11", "and the last ends when the card does, with 7 days over 3");
for (let i = 1; i < three.length; i++) {
  const prevEnd = new Date(three[i - 1].end + "T00:00:00").getTime();
  const thisStart = new Date(three[i].start + "T00:00:00").getTime();
  eq((thisStart - prevEnd) / 86400000, 1, `slice ${i + 1} starts the day after slice ${i} ends`);
}
/* A subtask that has been given its own dates uses them, so the breakdown gets exact the
   moment anyone schedules one rather than staying a guess forever. */
const mixed = subtaskSlices({ start: "2026-10-05", end: "2026-10-11" },
  [kid("a", { start: "2026-10-06", end: "2026-10-06" }), kid("b", null)]);
eq(mixed[0].start, "2026-10-06", "a dated subtask keeps its own window");
ok(mixed[0].dated && !mixed[1].dated, "and only it is marked exact");

/* The pile-up, which is what was actually on screen: four subtasks all dated the same week
   are four absolutely-positioned boxes on the same pixels, and their labels interleave
   character by character. Honest data, unreadable drawing. They are pushed into sequence,
   each keeping its own LENGTH and giving up only its overlap. */
const sameWeek = subtaskSlices({ start: "2026-10-05", end: "2026-10-11" }, [
  kid("a", { start: "2026-10-05", end: "2026-10-06" }),
  kid("b", { start: "2026-10-05", end: "2026-10-06" }),
  kid("c", { start: "2026-10-05", end: "2026-10-06" }),
]);
eq(sameWeek.map((x) => `${x.start}..${x.end}`),
  ["2026-10-05..2026-10-06", "2026-10-07..2026-10-08", "2026-10-09..2026-10-10"],
  "subtasks dated on top of each other are laid end to end, keeping their lengths");
ok(sameWeek.every((x, i) => i === 0 || x.start > sameWeek[i - 1].end),
  "and none of them overlaps the one before it");
ok(sameWeek.every((x) => x.dated), "they are still their own dates, not positional guesses");
/* Pushed far enough and there is no room left, which is a fallback rather than a squeeze. */
eq(subtaskSlices({ start: "2026-10-05", end: "2026-10-08" }, [
  kid("a", { start: "2026-10-05", end: "2026-10-07" }),
  kid("b", { start: "2026-10-05", end: "2026-10-07" }),
  kid("c", { start: "2026-10-05", end: "2026-10-07" }),
]), [], "and when sequencing runs past the card, there is no breakdown rather than a pile");
eq(subtaskSlices({ start: "2026-10-05", end: "2026-10-11" }, []), [], "no subtasks, no breakdown");
/* More subtasks than days cannot be drawn, and saying so is the only honest answer. Each
   slice would clamp to a one-day minimum, the starts would stop advancing, and they would
   pile up on the same spot with their labels printed over one another -- which is exactly
   what a fifteen-subtask card did across one week. */
eq(subtaskSlices({ start: "2026-10-05", end: "2026-10-06" },
  [kid("a", null), kid("b", null), kid("c", null), kid("d", null)]), [],
  "four subtasks over two days is no breakdown at all, not four overlapping ones");
eq(subtaskSlices({ start: "2026-10-05", end: "2026-10-11" }, Array.from({ length: 15 },
  (_, i) => kid("k" + i, null))), [], "nor fifteen across one week");
ok(subtaskSlices({ start: "2026-10-05", end: "2026-10-11" },
  [kid("a", null), kid("b", null), kid("c", null)]).length === 3,
  "three across a week still splits, because three days each is drawable");
/* No two slices may overlap, which is the property the pile-up violated. */
const seq = subtaskSlices({ start: "2026-10-05", end: "2026-10-11" },
  [kid("a", null), kid("b", null), kid("c", null), kid("d", null)]);
ok(seq.every((x, i) => i === 0 || x.start > seq[i - 1].end), "slices never overlap");

console.log("\nCapacity, once there is enough of it");
eq(velocity([]).mean, null, "no history, no number");
eq(velocity([{ id: "2026-09-28", committed: [], closedAt: "x", done: 6 }]).mean, null,
  "one sprint is an anecdote, not a capacity");
const hist: Sprint[] = [
  { id: "2026-09-07", committed: [], closedAt: "x", done: 9 },
  { id: "2026-09-14", committed: [], closedAt: "x", done: 4 },
  { id: "2026-09-21", committed: [], closedAt: "x", done: 6 },
  { id: "2026-09-28", committed: [], closedAt: "x", done: 8 },
  { id: "2026-10-05", committed: [] },
];
eq(velocity(hist).recent, [8, 6, 4], "the last three closed, newest first");
eq(velocity(hist).mean, 6, "and their mean");
ok(!velocity(hist).recent.includes(0), "the open sprint is not counted as having finished nothing");

console.log(fails ? `\n${fails} FAILED\n` : "\nAll sprint assertions pass.\n");
process.exit(fails ? 1 : 0);
