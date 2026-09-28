/** The board's sync rules, asserted.
 *
 *  The spec was written as "column 5 of design is in sync with column 6 of dev", which is a
 *  sentence about two lists staying level. The implementation makes them one stage seen
 *  twice, so the thing worth testing is that each stage surfaces in exactly the columns it
 *  should, and that a drop lands where the spec says.
 *
 *  Run: npx tsx scripts/eval-board.ts
 */
import {
  ALL_KINDS, ALL_STAGES, BOARD_VIEWS, VIEW_BY_ID, fits, stageForDrop, stageOf,
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
  return "ask" in r ? null : r.stage;
}
function dropReview(c: Parameters<typeof stageForDrop>[0], team: BoardTeam | null): ReviewWith | null | undefined {
  const r = stageForDrop(c, team);
  return "ask" in r ? null : r.review;
}
