/** The board's sync rules, asserted.
 *
 *  The spec was written as "column 5 of design is in sync with column 6 of dev", which is a
 *  sentence about two lists staying level. The implementation makes them one stage seen
 *  twice, so the thing worth testing is that each stage surfaces in exactly the columns it
 *  should, and that a drop lands where the spec says.
 *
 *  Run: npx tsx scripts/eval-board.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_KINDS, ALL_STAGES, BOARD_VIEWS, VIEW_BY_ID, defaultStage, fits, placeCard, stageForDrop, stageOf,
  type BoardColumn, type Drop,
  type BoardTeam, type BoardView, type CardKind, type ReviewWith, type Stage,
} from "../lib/board";

let fails = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`);
};

/** The three team lenses. Backlog and Roadmap are re-cuts of the same stages, so they would
 *  match nearly everything and say nothing about whether a handover reaches the right board;
 *  they get their own section below. */
const TEAM_VIEWS = BOARD_VIEWS.filter((v) => ["pm", "design", "dev"].includes(v.id));

/** Which columns a card in this state appears in, as "view.columnKey". */
function where(stage: Stage, team: BoardTeam | null, review: ReviewWith | null, kind: CardKind = "feature"): string[] {
  const out: string[] = [];
  const teams = team ? [team] : [];
  for (const v of TEAM_VIEWS) {
    for (const c of v.columns) if (fits(c, stage, teams, review, kind)) out.push(`${v.id}.${c.key}`);
  }
  return out;
}

/** A card nobody has handed over can name two teams, which is the case that left Design's
 *  board empty: the sheet says Engineering on cards carrying a Design assignee. */
function whereMulti(stage: Stage, teams: BoardTeam[], review: ReviewWith | null, kind: CardKind = "feature"): string[] {
  const out: string[] = [];
  for (const v of TEAM_VIEWS) {
    for (const c of v.columns) if (fits(c, stage, teams, review, kind)) out.push(`${v.id}.${c.key}`);
  }
  return out;
}

console.log("\n# a stage lands in exactly the columns the spec names");
/* PM's board shows what PM has PICKED UP. A card nobody holds is in the backlog, which is a
   different lens; a PM board that repeated the backlog was the backlog with four extra
   columns, which is the thing that made it unusable. */
ok(same(where("bug", null, null, "bug"), []), "a bug nobody holds is on no team board, only in the backlog");
ok(same(where("bug", "PM", null, "bug"), ["pm.asked"]), "once PM takes it, it is in PM's features and bugs");
ok(same(where("feature", "PM", null, "module"), ["pm.built"]), "a module PM holds is in modules and templates");
ok(same(where("feature", "PM", null, "template"), ["pm.built"]), "and so is a template");
ok(same(where("pm_progress", "PM", null), ["pm.pmwip"]), "PM's own work in flight has a column of its own");
/* A team board has to show that team's queue or it reads zero while the sheet has work on
   it, which is exactly what happened to Design. */
ok(same(whereMulti("feature", ["Design"], null), ["design.in"]),
  "a request the sheet puts on design is in Design's queue");
ok(same(whereMulti("bug", ["Engineering"], null, "bug"), ["dev.in"]),
  "a bug the sheet puts on dev is in Dev's queue");

// PM hands out. One team at a time is the whole point: the other team must not see it.
ok(same(where("pm_handover", "Design", null), ["pm.handover", "design.in"]),
  "handed to design shows in PM's handover and Design's PM handover");
ok(same(where("pm_handover", "Engineering", null), ["pm.handover", "dev.in"]),
  "handed to dev shows in PM's handover and Dev's PM handover, not Design's");

ok(same(where("design_progress", "Design", null), ["design.wip"]), "design in progress is Design's alone");

// Design's In review IS PM's Handed for review. Spec: design column 3 pushes to PM column 4.
ok(same(where("design_review", "Design", null), ["pm.review", "design.review"]),
  "a design review is PM's Handed for review and Design's In review, the same card");

// Spec: PM column 5 Approved is in sync with design column 4.
ok(same(where("design_approved", "Design", null), ["pm.approved", "design.approved"]),
  "design approved is PM's Approved and Design's Design approved");

// Spec: design column 5 is in sync with dev column 2.
ok(same(where("design_to_dev", "Design", null), ["design.todev", "dev.fromdesign"]),
  "handed to dev is Design's Handed over to dev and Dev's Design handover");

ok(same(where("dev_progress", "Engineering", null), ["dev.wip"]), "dev in progress is Dev's alone");

// Dev's review splits by who reviews it, which is the reviewWith answer.
ok(same(where("dev_review", "Engineering", "Design"), ["design.qa", "dev.review"]),
  "dev review with design QA is Design's Dev QA handover and Dev's review column");
ok(same(where("dev_review", "Engineering", "PM"), ["pm.review", "dev.review"]),
  "dev review with PM is PM's Handed for review and Dev's review column");

// Spec: design column 7 is in sync with dev column 5.
ok(same(where("dev_approved", "Engineering", null), ["design.devok", "dev.approved"]),
  "dev approved is Design's Dev approved and Dev's Approved");

// Spec: PM column 5 Approved is in sync with dev column 6.
ok(same(where("prod", "Engineering", null), ["pm.approved", "dev.prod"]),
  "pushed to prod is PM's Approved and Dev's Pushed to prod");

console.log("\n# a card is never in two teams' columns at once");
let crossed = 0;
for (const stage of ALL_STAGES) {
  for (const team of ["Design", "Engineering"] as (BoardTeam | null)[]) {
    for (const review of [null, "Design", "PM"] as (ReviewWith | null)[]) {
      /* The two columns that exist to show the OTHER team's work are not a leak: they are
         the fix. What must never happen is a card naming one team turning up in the other
         team's own working columns. */
      const CROSS = ["design.todev", "dev.fromdesign"];
      const at = where(stage, team, review).filter((k) => !CROSS.includes(k));
      const design = at.some((k) => k.startsWith("design."));
      const dev = at.some((k) => k.startsWith("dev."));
      /* Two reasons a card is legitimately on both boards. A handoff stage is on both by
         definition: that is what a handoff is. And a card the sheet names BOTH teams on stays
         visible to both the whole way through, which is the fix for Design's board reading
         zero. What must never happen is a card naming ONE team showing on the other's. */
      const handoff = stage === "design_to_dev" || stage === "dev_approved" || stage === "dev_review";
      const namesBoth = team === null;
      if (design && dev && !handoff && !namesBoth) {
        fails++; crossed++;
        console.log(`  FAIL  ${stage} / ${team} / ${review} is in both design and dev: ${at.join(", ")}`);
      }
    }
  }
}
if (!crossed) console.log("  ok    only the handoff stages appear on both team boards");

console.log("\n# a card naming two teams reaches both, until it is handed to one");
ok(same(whereMulti("pm_handover", ["Engineering", "Design"], null), ["pm.handover", "design.in", "dev.in"]),
  "un-handed work the sheet puts on both teams shows on both PM handover boards");
ok(same(whereMulti("pm_handover", ["Design"], null), ["pm.handover", "design.in"]),
  "handed to design, it is design's alone");
ok(same(whereMulti("design_progress", ["Design"], null), ["design.wip"]),
  "design work naming only design is design's alone");

console.log("\n# what a drop means");
const col = (v: BoardView, k: string) => VIEW_BY_ID[v].columns.find((c) => c.key === k)!;
ok(dropAsk(col("pm", "handover"), "Design") === "team", "PM's handover column asks which team, even when the card has one");
ok(dropAsk(col("dev", "review"), "Engineering") === "review", "Dev's review column asks who reviews it");
ok(dropStage(col("design", "qa"), "Engineering") === "dev_review", "dropping on Design's Dev QA handover needs no question");
ok(dropReview(col("design", "qa"), "Engineering") === "Design", "and records design as the reviewer");
ok(dropStage(col("pm", "review"), "Engineering") === "dev_review", "PM's review column sends a dev card to a dev review");
ok(dropReview(col("pm", "review"), "Engineering") === "PM", "and records PM as the reviewer, because that is the column it was dropped on");
ok(dropStage(col("pm", "review"), "Design") === "design_review", "PM's review column sends a design card to a design review");
ok(dropStage(col("pm", "approved"), "Design") === "design_approved", "PM's Approved is design approved for a design card");
ok(dropStage(col("pm", "approved"), "Engineering") === "prod", "PM's Approved is in production for a dev card");
ok(dropAsk(col("pm", "approved"), null) === "team", "PM's Approved asks for a team when the card has none to resolve it by");

console.log("\n# a card stays visible to every team named on it, all the way through");
ok(whereMulti("dev_progress", ["Engineering", "Design"], null).includes("design.todev"),
  "dev building something that names design is still on Design's board");
ok(!whereMulti("dev_progress", ["Engineering"], null).includes("design.todev"),
  "and dev work that names nobody in design is not");
ok(whereMulti("design_progress", ["Engineering", "Design"], null).includes("dev.fromdesign"),
  "design work in flight that names dev is on Dev's board");
ok(dropStage(col("design", "todev"), "Design") === "design_to_dev",
  "dropping on Handed over to dev is the handover, not the other team's progress");

console.log("\n# the backlog and roadmap lenses are re-cuts, not a fourth place to be");
const inLens = (lens: BoardView, stage: Stage) =>
  VIEW_BY_ID[lens].columns.some((c) => fits(c, stage, ["Design", "Engineering", "PM"], null, "feature"));
for (const st of ALL_STAGES) {
  const onTeamBoard = TEAM_VIEWS.some((v) => v.columns.some((c) => fits(c, st, ["Design", "Engineering", "PM"], null, "feature")));
  if (inLens("roadmap", st) && !onTeamBoard) {
    fails++; console.log(`  FAIL  ${st} is on the roadmap lens and on no team board`);
  }
}
ok(ALL_STAGES.every((st) => inLens("roadmap", st)), "every stage has a roadmap column, so no card is invisible there");
/* The backlog is the INVENTORY, not the queue. It took the two intake stages, so a card
   vanished from the one list meant to hold everything the moment anybody picked it up, and
   with the live data it read empty while 71 cards existed. */
ok(ALL_STAGES.every((st) => inLens("backlog", st)), "the backlog holds every card at every stage");
ok(ALL_KINDS.every((k) => VIEW_BY_ID.backlog.columns.some((c) => fits(c, "feature", [], null, k))),
  "every kind has a backlog column, so no card is invisible there");

console.log("\n# an untouched card sits in its own intake column");
ok(stageOf({ kind: "bug" }) === "bug", "a bug with no stage is a bug");
ok(stageOf({ kind: "feature" }) === "feature", "a request with no stage is a request");
ok(stageOf({ kind: "bug", stage: "prod" }) === "prod", "a stored stage wins over the kind");

live();
roundTrip();
horizons();
roadmap();

console.log(fails ? `\nFAIL: ${fails}` : "\nPASS");
process.exit(fails ? 1 : 0);


function same(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}
function dropAsk(c: Parameters<typeof stageForDrop>[0], team: BoardTeam | null): string | null {
  const r = stageForDrop(c, team);
  return "ask" in r ? r.ask : null;
}
function dropStage(c: Parameters<typeof stageForDrop>[0], team: BoardTeam | null): Stage | null {
  const r = stageForDrop(c, team);
  return "ask" in r || !("stage" in r) ? null : r.stage;
}
function dropReview(c: Parameters<typeof stageForDrop>[0], team: BoardTeam | null): ReviewWith | null | undefined {
  const r = stageForDrop(c, team);
  return "ask" in r || !("stage" in r) ? null : r.review;
}


/** The board against the live cards, rather than against invented ones.
 *
 *  Everything above asserts the rules the board was designed to; this asserts the rules the
 *  USER stated, over the 77 cards actually on the board. The distinction matters: the board
 *  was self-consistent every time it was wrong, and the count in the Roadmap tab was the
 *  only thing that could have caught it.
 *
 *  `scripts/fixtures/board-cards.json` is every distinct card shape in the live data, with
 *  how many cards have it. Shapes rather than rows because 46 shapes cover all 77 cards and
 *  nothing about placement depends on a title.
 *
 *  The rules, in the words they were given in:
 *    "Move the cards to pm/design/dev accordingly as per the teams assigned"
 *    "if it is not assigned then it moves to backlog"
 *    "Roadmap should only have the items that is in the PM/DEV & Design tabs ... roadmap
 *     will be a overview always"
 *    "Backlog should have all the cards" */
function live() {
  const fx = JSON.parse(readFileSync(join(__dirname, "fixtures/board-cards.json"), "utf8"));
  /* `boardStatusOf` turns a roadmap task's rolled-up state into the words the sheet uses.
     Reproduced here so the fixture can stay as the raw `planned`/`progress`/`done` the data
     holds. "In Dev" for progress is the common branch; the one live task in progress carries
     an explicit stage, so the branch it takes cannot change an answer. */
  const asStatus = (s: string) => (s === "done" ? "Done" : s === "progress" ? "In Dev" : s === "planned" ? "Planned" : "");

  type Row = [number, string, string, string, string, string, string, string, string, string];
  const placed = (fx.rows as Row[]).map((r) => {
    const [count, type, kind, team, boardTeam, stage, status, taskTeam, taskStatus, asg] = r;
    const linked = type === "F" && taskStatus !== "-" ? asStatus(taskStatus) : null;
    const p = placeCard({
      kind: (kind || null) as CardKind | null,
      stage: (stage || null) as Stage | null,
      boardTeam: (boardTeam || null) as BoardTeam | null,
      status: type === "T" ? asStatus(taskStatus) : status || null,
      linkedStatus: linked,
      named: [team, taskTeam === "-" ? null : taskTeam, ...(asg ? asg.split("+") : [])],
    });
    return { count, row: r, ...p };
  });

  const seen = (stage: Stage, teams: BoardTeam[], kind: CardKind) =>
    BOARD_VIEWS.filter((v) =>
      (!v.ownedOnly || teams.length > 0)
      && v.columns.some((c) => fits(c, stage, teams, null, kind))).map((v) => v.id);

  const tally: Record<string, number> = {};
  let homeless = 0, ownedOffBoard = 0, unownedOnRoadmap = 0, missingFromBacklog = 0;

  for (const p of placed) {
    const kind = (p.row[2] || "feature") as CardKind;
    const views = seen(p.stage, p.teams, kind);
    for (const v of views) tally[v] = (tally[v] || 0) + p.count;
    tally[p.teams.length ? "owned" : "unowned"] = (tally[p.teams.length ? "owned" : "unowned"] || 0) + p.count;

    const teamBoards = views.filter((v) => v === "pm" || v === "design" || v === "dev");
    if (!views.length) { homeless += p.count; console.log(`  homeless  ${JSON.stringify(p.row)} -> ${p.stage}`); }
    if (p.teams.length && !teamBoards.length) { ownedOffBoard += p.count; console.log(`  owned but on no team board  ${JSON.stringify(p.row)} -> ${p.stage} ${p.teams}`); }
    if (!p.teams.length && views.includes("roadmap")) unownedOnRoadmap += p.count;
    if (!views.includes("backlog")) { missingFromBacklog += p.count; console.log(`  not in the backlog  ${JSON.stringify(p.row)} -> ${p.stage}`); }
  }

  console.log("\nLive cards, by board:");
  for (const k of ["backlog", "roadmap", "pm", "design", "dev", "owned", "unowned"]) {
    console.log(`  ${k.padEnd(8)} ${tally[k] || 0}`);
  }

  console.log("\nThe rules, over the live data:");
  ok(homeless === 0, "every card lands in a column somewhere");
  ok(missingFromBacklog === 0, "the backlog holds every card");
  ok(ownedOffBoard === 0, "every card with a team is on that team's board");
  ok(unownedOnRoadmap === 0, "a card nobody has taken is not on the Roadmap");
  ok((tally.roadmap || 0) === (tally.owned || 0), "the Roadmap is exactly the owned cards");
  /* The complaint, four times: everything sitting in Roadmap / Not started. The board can
     only be right if the cards whose own column names a stage are NOT at intake. */
  const intake = placed.filter((p) => p.stage === "bug" || p.stage === "feature");
  const named = placed.filter((p) => /design|dev|review|planning/i.test(p.row[6]));
  ok(named.every((p) => p.stage !== "bug" && p.stage !== "feature"),
    "a card whose own status names a stage is not at intake");
  ok(intake.reduce((n, p) => n + p.count, 0) < 40,
    `fewer than 40 of the 77 cards are still at intake (${intake.reduce((n, p) => n + p.count, 0)})`);
  ok((tally.design || 0) > 0, `Design's board is not empty (${tally.design || 0})`);
  ok((tally.dev || 0) > 0, `Dev's board is not empty (${tally.dev || 0})`);
  ok((tally.pm || 0) > 0, `PM's board is not empty (${tally.pm || 0})`);
}


/** Dropping a card on a column puts it in that column. Every column, every card.
 *
 *  The one property the board never had, and the one that would have caught all of it: the
 *  backlog's four columns sort by kind and every drop wrote a stage, so dragging a card
 *  there did nothing whatever; Design's and Dev's "To pick up" handed cards over without
 *  naming the team, so they landed in neither queue; and a drop on the Roadmap's Not started
 *  cleared the owner, so the card left the lens it was dropped on.
 *
 *  A drop that asks a question is followed through every answer it offers, because the
 *  answer is where a card actually lands. */
function roundTrip() {
  console.log("\n# dropping a card on a column puts it in that column");
  type Card = { stage: Stage; teams: BoardTeam[]; team: BoardTeam | null; review: ReviewWith | null; kind: CardKind };

  /** The write the board makes, as a card. Mirrors `moveTo` and `answer` in WorkBoard: a
   *  kind is re-filed, a stage is moved to, and a team is only written when one is named. */
  function after(c: Card, d: Exclude<Drop, { ask: string }>): Card {
    const kind = ("kind" in d && d.kind) || c.kind;
    const atIntake = (st: Stage) => st === "bug" || st === "feature";
    const stage = "stage" in d ? d.stage : atIntake(c.stage) ? defaultStage(kind) : c.stage;
    const boardTeam = "stage" in d && "team" in d ? d.team ?? null : c.team;
    let review = "stage" in d && "review" in d ? d.review ?? null : c.review;
    // The store zeroes a review answer outside the stages it can mean anything at.
    if (!["dev_review", "dev_approved", "prod"].includes(stage)) review = null;
    const p = placeCard({ kind, stage, boardTeam, named: c.teams });
    return { ...p, team: boardTeam ?? p.teams[0] ?? null, review, kind };
  }

  /** Every answer a drop can end in. A question is not a landing place. */
  function landings(c: BoardColumn, card: Card): Card[] {
    const r = stageForDrop(c, card.team, card.kind);
    if (!("ask" in r)) return [after(card, r)];
    if (r.ask === "review") {
      // WorkBoard's answer(): a review answer is always a dev review.
      return (["Design", "PM"] as ReviewWith[]).map((review) => after(card, { stage: "dev_review", review }));
    }
    return (["PM", "Design", "Engineering"] as BoardTeam[]).map((team) => {
      const r2 = stageForDrop(c, team, card.kind);
      const stage: Stage = "ask" in r2 || !("stage" in r2) ? "pm_handover" : r2.stage;
      const review = "ask" in r2 || !("stage" in r2) ? undefined : r2.review;
      return after(card, { stage, team, ...(review !== undefined ? { review } : {}) });
    });
  }

  let bad = 0, checked = 0;
  const STAGES: Stage[] = ["feature", "bug", "pm_handover", "design_progress", "dev_review", "prod"];
  for (const v of BOARD_VIEWS) {
    let viewBad = 0;
    for (const col of v.columns) {
      for (const kind of ALL_KINDS) {
        for (const team of [null, "PM", "Design", "Engineering"] as (BoardTeam | null)[]) {
          for (const stage of STAGES) {
            const card: Card = { stage, teams: team ? [team] : [], team, review: null, kind };
            // A card the lens does not show is a card nobody can drag on it.
            if (v.ownedOnly && !card.teams.length) continue;
            for (const l of landings(col, card)) {
              checked++;
              const lands = fits(col, l.stage, l.teams, l.review, l.kind);
              const onLens = !v.ownedOnly || l.teams.length > 0;
              if (lands && onLens) continue;
              bad++; viewBad++;
              if (viewBad <= 3) {
                console.log(`  FAIL  ${v.id}.${col.key}  a ${kind} at ${stage} (${team ?? "no team"})`
                  + ` -> ${l.stage} (${l.teams.join("+") || "no team"})${lands ? " left the lens" : " missed the column"}`);
              }
            }
          }
        }
      }
    }
  }
  ok(bad === 0, `${checked} drops, every one lands in the column it was dropped on`);

  /* The backlog is the one lens whose columns re-file rather than move, and every kind needs
     one or a card dropped there has nowhere to go. */
  const files = VIEW_BY_ID.backlog.columns.filter((c) => c.filesAs).map((c) => c.filesAs);
  ok(VIEW_BY_ID.backlog.columns.every((c) => c.filesAs), "every backlog column re-files rather than moves");
  ok(ALL_KINDS.every((k) => files.includes(k) || k === "landing"),
    "every kind but landing has a backlog column to be dropped into");
}


/** The horizon, as it was asked for: "all cards should have priorities as now, next,
 *  future / Future goes to backlog, now comes to the pm board / in the backlog next comes
 *  first and then future in the sequence." */
function horizons() {
  console.log("\n# the horizon");
  const card = (stage: Stage, teams: BoardTeam[]) => ({ stage, teams, review: null as ReviewWith | null });

  /* Now and Future are a MOVE for a card nobody has started, and a tag for one in flight.
     Asserted against the stages the store calls "in the pile". */
  const pile: Stage[] = ["bug", "feature", "pm_handover"];
  const flight: Stage[] = ["pm_progress", "design_progress", "design_review", "dev_progress", "prod"];
  ok(pile.every((st) => VIEW_BY_ID.pm.columns.some((c) => fits(c, st === "pm_handover" ? st : st, ["PM"], null, "feature"))),
    "a card handed to PM at any pile stage has a column on PM's board");
  ok(flight.every((st) => (["PM", "Design", "Engineering"] as BoardTeam[]).some((t) =>
    BOARD_VIEWS.some((v) => v.id !== "backlog" && v.columns.some((c) => fits(c, st, [t], null, "feature"))))),
    "a card in flight is on a team board whatever its horizon");
  /* Unowned is the backlog and nowhere else, which is what Future does by clearing the team. */
  const un = card("feature", []);
  ok(!VIEW_BY_ID.roadmap.columns.some((c) => fits(c, un.stage, un.teams, null, "feature")) || !VIEW_BY_ID.roadmap.ownedOnly
    ? VIEW_BY_ID.roadmap.ownedOnly === true : true, "the Roadmap lens shows owned work only");
  ok(VIEW_BY_ID.backlog.columns.some((c) => fits(c, "feature", [], null, "feature")),
    "a card with no team is still in the backlog");

  /* "If the status has been changed to Now and the team is assigned then it should move to
     the relevant tab." Two halves, and the second is the one that was wrong: Now used to
     overwrite the owner with PM, which took the card off the very board it belonged on. */
  const pmIntake = VIEW_BY_ID.pm.columns.filter((c) => c.key === "asked" || c.key === "built");
  const onPmIntake = (teams: BoardTeam[], h: 1 | 2 | 3) =>
    pmIntake.some((c) => fits(c, "feature", teams, null, "feature", h));
  ok(onPmIntake([], 1), "a Now card nobody is named on is on PM's intake");
  ok(!onPmIntake([], 2) && !onPmIntake([], 3), "a Next or Future card with no team is not");
  ok(!onPmIntake(["Design"], 1) && !onPmIntake(["Engineering"], 1),
    "a Now card that names a team is NOT dragged into PM's pile");
  for (const [team, view] of [["Design", "design"], ["Engineering", "dev"]] as [BoardTeam, BoardView][]) {
    ok(VIEW_BY_ID[view].columns.some((c) => fits(c, "feature", [team], null, "feature", 1)),
      `a Now card naming ${team} is on that team's own board`);
  }

  /* The order: Now, Next, Future, then position. Same comparator the columns sort by. */
  const h = (p: 1 | 2 | 3, order: number) => ({ priority: p, boardOrder: order });
  const sorted = [h(3, 0), h(1, 5), h(2, 1), h(1, 2)]
    .sort((a, b) => a.priority - b.priority || a.boardOrder - b.boardOrder)
    .map((x) => `${x.priority}:${x.boardOrder}`).join(" ");
  ok(sorted === "1:2 1:5 2:1 3:0", `the horizon orders a column and position orders within it (${sorted})`);
}


/** The Roadmap lens, on its own, because it is the tab that keeps being wrong.
 *
 *  It is the overview: "everything a team has, by where the work is". Four claims follow
 *  from that sentence and none of them was ever asserted — the tab was checked by opening
 *  it and counting, which is how it shipped showing every card in Not started twice over.
 *
 *  1. Its columns PARTITION the stages: every stage lands in exactly one, so the column
 *     counts sum to the tab badge and a card cannot be in two places at once.
 *  2. It covers every stage, so no card in hand can be missing from the overview.
 *  3. It shows owned work only, and the backlog holds the rest.
 *  4. Dropping a card on one of its columns keeps the owner, or the card falls off the lens
 *     it was dropped on. */
function roadmap() {
  console.log("\n# the Roadmap lens");
  const rm = VIEW_BY_ID.roadmap;
  const teams: BoardTeam[] = ["Design"];

  const where = (st: Stage) =>
    rm.columns.filter((c) => fits(c, st, teams, null, "feature", 2)).map((c) => c.key);

  const twice = ALL_STAGES.filter((st) => where(st).length > 1);
  const nowhere = ALL_STAGES.filter((st) => where(st).length === 0);
  ok(twice.length === 0, `no stage lands in two Roadmap columns${twice.length ? ` (${twice.join(", ")})` : ""}`);
  ok(nowhere.length === 0, `every stage has a Roadmap column${nowhere.length ? ` (${nowhere.join(", ")})` : ""}`);
  ok(rm.ownedOnly === true, "the Roadmap shows owned work only");

  /* Every column count sums to the badge, which is only true while the columns partition. */
  ok(ALL_STAGES.every((st) => where(st).length === 1),
    "the column counts sum to the tab badge, because each card is in exactly one column");

  /* A drop on a Roadmap column must not un-own the card: this lens hides unowned work, so
     clearing the team would delete the card from the board it was dropped on. */
  for (const col of rm.columns) {
    for (const team of ["PM", "Design", "Engineering"] as BoardTeam[]) {
      const r = stageForDrop(col, team, "feature");
      if ("ask" in r) continue;
      const clears = "stage" in r && "team" in r && !r.team;
      ok(!clears, `roadmap.${col.key} does not clear the owner when a ${team} card is dropped on it`);
    }
  }

  /* And the five columns are the five the blurb promises, in order. */
  const titles = rm.columns.map((c) => c.title).join(" | ");
  ok(titles === "Not started | In progress | In review | Approved | Pushed to prod",
    `the columns read left to right as the work moves (${titles})`);
}
