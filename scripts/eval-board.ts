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
  BOARD_VIEWS, VIEW_BY_ID, fits, stageForDrop, stageOf,
  type BoardTeam, type BoardView, type ReviewWith, type Stage,
} from "../lib/board";

let fails = 0;
const ok = (cond: boolean, what: string) => {
  if (!cond) { fails++; console.log(`  FAIL  ${what}`); } else console.log(`  ok    ${what}`);
};

/** Which columns a card in this state appears in, as "view.columnKey". */
function where(stage: Stage, team: BoardTeam | null, review: ReviewWith | null): string[] {
  const out: string[] = [];
  for (const v of BOARD_VIEWS) {
    for (const c of v.columns) if (fits(c, stage, team, review)) out.push(`${v.id}.${c.key}`);
  }
  return out;
}

console.log("\n# a stage lands in exactly the columns the spec names");
ok(same(where("bug", null, null), ["pm.bug"]), "a bug is PM's Bugs and nowhere else");
ok(same(where("feature", null, null), ["pm.feature"]), "a feature request is PM's Feature requests only");

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
for (const stage of ALL_STAGES()) {
  for (const team of [null, "Design", "Engineering"] as (BoardTeam | null)[]) {
    for (const review of [null, "Design", "PM"] as (ReviewWith | null)[]) {
      const at = where(stage, team, review);
      const design = at.some((k) => k.startsWith("design."));
      const dev = at.some((k) => k.startsWith("dev."));
      // The two handoff stages are meant to be on both boards: that is what a handoff is.
      const handoff = stage === "design_to_dev" || stage === "dev_approved" || stage === "dev_review";
      if (design && dev && !handoff) {
        fails++; crossed++;
        console.log(`  FAIL  ${stage} / ${team} / ${review} is in both design and dev: ${at.join(", ")}`);
      }
    }
  }
}
if (!crossed) console.log("  ok    only the handoff stages appear on both team boards");

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

console.log("\n# an untouched card sits in its own intake column");
ok(stageOf({ kind: "bug" }) === "bug", "a bug with no stage is a bug");
ok(stageOf({ kind: "feature" }) === "feature", "a request with no stage is a request");
ok(stageOf({ kind: "bug", stage: "prod" }) === "prod", "a stored stage wins over the kind");

console.log(fails ? `\nFAIL: ${fails}` : "\nPASS");
process.exit(fails ? 1 : 0);

function ALL_STAGES(): Stage[] {
  return ["bug", "feature", "pm_handover", "design_progress", "design_review", "design_approved",
    "design_to_dev", "dev_progress", "dev_review", "dev_approved", "prod"];
}
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
