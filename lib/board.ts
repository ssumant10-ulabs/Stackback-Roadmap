/** The work board: one state machine, three lenses on it.
 *
 *  PM, Design and Dev each asked for their own columns, and their lists overlap: PM's "Handed
 *  for review" is Design's "In review", Design's "Handed over to dev" is Dev's "Design
 *  handover", Dev's "Approved" is Design's "Dev approved". Modelling those as separate
 *  columns per view means keeping them in step, and "in sync with column 5" is a sentence,
 *  not a mechanism. So there is ONE stage on a card, and a view is a choice of which stages
 *  to show and what to call them. Two columns that are "in sync" are the same stage read
 *  twice, and cannot drift.
 *
 *  Two fields decide where a card surfaces:
 *    `boardTeam`   who it was handed to, Design or Engineering, one at a time.
 *    `reviewWith`  who is reviewing the dev work, Design QA or PM.
 *  Both are asked for at the moment of handover rather than inferred, because inferring them
 *  from who is assigned is how a card ends up in two teams' columns at once.
 */

export type Stage =
  | "bug" | "feature"
  | "pm_handover"
  | "design_progress" | "design_review" | "design_approved" | "design_to_dev"
  | "dev_progress" | "dev_review" | "dev_approved"
  | "prod";

export type BoardView = "pm" | "design" | "dev";
/** The two teams a card can be handed to. PM hands out; it never holds the card as a team. */
export type BoardTeam = "Design" | "Engineering";
export type ReviewWith = "Design" | "PM";

/** One thing a column takes. The qualifiers are per stage, not per column: PM's "Handed for
 *  review" takes ANY design review but only a dev review that PM itself is reviewing, and a
 *  column-level filter cannot say that. Getting this wrong put a card that dev had sent to
 *  design QA into PM's review column as well. */
export interface StageSpec {
  stage: Stage;
  /** Only cards handed to this team. */
  team?: BoardTeam;
  /** Only cards whose dev review went this way. */
  review?: ReviewWith;
}

export interface BoardColumn {
  key: string;
  title: string;
  accepts: StageSpec[];
  /** Where a card dropped here lands, when the answer depends on the card rather than the
   *  column. Shown under the heading, because "Approved" meaning two things is the part a
   *  reader cannot infer. */
  hint?: string;
}

export interface BoardViewDef {
  id: BoardView;
  label: string;
  /** What this lens is for, one line, shown under the tabs. */
  blurb: string;
  columns: BoardColumn[];
}

/** PM and CS share a lens: the two intake columns are CS's, the rest is PM's. */
export const BOARD_VIEWS: BoardViewDef[] = [
  {
    id: "pm",
    label: "PM / CS",
    blurb: "What came in, what went out to a team, and what came back approved.",
    columns: [
      { key: "bug", title: "Bugs", accepts: [{ stage: "bug" }] },
      { key: "feature", title: "Feature requests", accepts: [{ stage: "feature" }] },
      { key: "handover", title: "Handed to design or dev", accepts: [{ stage: "pm_handover" }],
        hint: "Dropping here asks which team takes it." },
      { key: "review", title: "Handed for review",
        // Any design review, but only a dev review that PM is the one reviewing. A dev card
        // sent to design QA belongs on Design's board, not back here.
        accepts: [{ stage: "design_review" }, { stage: "dev_review", review: "PM" }],
        hint: "A design review, or dev work sent to PM rather than to design QA." },
      { key: "approved", title: "Approved",
        accepts: [{ stage: "design_approved" }, { stage: "prod" }],
        hint: "Design work is approved; dev work is approved once it is in production." },
    ],
  },
  {
    id: "design",
    label: "Design",
    blurb: "Handed in by PM, out to dev, and back again for QA.",
    columns: [
      { key: "in", title: "PM handover", accepts: [{ stage: "pm_handover", team: "Design" }] },
      { key: "wip", title: "In progress", accepts: [{ stage: "design_progress" }] },
      { key: "review", title: "In review", accepts: [{ stage: "design_review" }],
        hint: "Also PM's Handed for review." },
      { key: "approved", title: "Design approved", accepts: [{ stage: "design_approved" }],
        hint: "Also PM's Approved." },
      { key: "todev", title: "Handed over to dev", accepts: [{ stage: "design_to_dev" }],
        hint: "Also Dev's Design handover." },
      { key: "qa", title: "Dev QA handover", accepts: [{ stage: "dev_review", review: "Design" }],
        hint: "Dev sent this back for design QA." },
      { key: "devok", title: "Dev approved", accepts: [{ stage: "dev_approved" }],
        hint: "Also Dev's Approved." },
    ],
  },
  {
    id: "dev",
    label: "Dev",
    blurb: "Handed in by PM or design, out for review, and shipped.",
    columns: [
      { key: "in", title: "PM handover", accepts: [{ stage: "pm_handover", team: "Engineering" }] },
      { key: "fromdesign", title: "Design handover", accepts: [{ stage: "design_to_dev" }],
        hint: "Also Design's Handed over to dev." },
      { key: "wip", title: "In progress", accepts: [{ stage: "dev_progress" }] },
      { key: "review", title: "Handover to design QA or PM review", accepts: [{ stage: "dev_review" }],
        hint: "Dropping here asks which." },
      { key: "approved", title: "Approved", accepts: [{ stage: "dev_approved" }],
        hint: "Also Design's Dev approved." },
      { key: "prod", title: "Pushed to prod", accepts: [{ stage: "prod" }],
        hint: "Also PM's Approved." },
    ],
  },
];

export const VIEW_BY_ID = Object.fromEntries(BOARD_VIEWS.map((v) => [v.id, v])) as Record<BoardView, BoardViewDef>;

/** What a stage is called when it has to be named outside its own column. */
export const STAGE_LABEL: Record<Stage, string> = {
  bug: "Bug",
  feature: "Feature request",
  pm_handover: "PM handover",
  design_progress: "Design in progress",
  design_review: "Design in review",
  design_approved: "Design approved",
  design_to_dev: "Handed to dev",
  dev_progress: "Dev in progress",
  dev_review: "Dev in review",
  dev_approved: "Dev approved",
  prod: "Pushed to prod",
};

/** Where a card sits before anybody has moved it: its own intake column, read off what it
 *  is. Everything that predates the board lands in Bugs or Feature requests, which is where
 *  an untriaged item belongs, and nothing has to be backfilled for the board to be right. */
export function defaultStage(kind: "feature" | "bug" | undefined | null): Stage {
  return kind === "bug" ? "bug" : "feature";
}
export const stageOf = (f: { stage?: Stage | null; kind?: "feature" | "bug" | null }): Stage =>
  f.stage || defaultStage(f.kind);

/** Which stages a view can show at all, so a card handed to the other team does not appear
 *  in a column just because the column's stage matches. */
export function inView(view: BoardView, stage: Stage, team: BoardTeam | null, review: ReviewWith | null): boolean {
  return VIEW_BY_ID[view].columns.some((c) => fits(c, stage, team, review));
}

export function fits(c: BoardColumn, stage: Stage, team: BoardTeam | null, review: ReviewWith | null): boolean {
  return c.accepts.some((a) =>
    a.stage === stage
    && (!a.team || a.team === team)
    && (!a.review || a.review === review));
}

/** What dropping a card on a column means.
 *
 *  A column holding one stage is unambiguous. The rest resolve from the card, which is the
 *  whole of "in sync with column 4 of design and column 6 of dev": PM's review column sends
 *  a design card to a design review and a dev card to a dev review, and PM's approved column
 *  is design-approved for one and in-production for the other.
 *
 *  Two drops ask instead of guessing. The handover column always asks which team, even when
 *  the card already carries one, because re-handing a card is exactly when the old answer is
 *  the wrong one. Dev's review column asks who reviews it. Where the answer IS the column,
 *  it is not asked: dropping on Design's Dev QA handover means design QA, and dropping on
 *  PM's Handed for review means PM. */
export type Drop = { stage: Stage; review?: ReviewWith | null } | { ask: "team" } | { ask: "review" };

export function stageForDrop(c: BoardColumn, team: BoardTeam | null): Drop {
  // Always asks. Re-handing a card is the moment the previous answer stops being right.
  if (c.key === "handover") return { ask: "team" };

  if (c.accepts.length > 1) {
    // PM's junctions. Without a team there is nothing to resolve them by, so ask for one.
    if (!team) return { ask: "team" };
    if (c.key === "review") {
      return team === "Engineering"
        // Dropped on PM's own review column, so PM is the reviewer. No second question.
        ? { stage: "dev_review", review: "PM" }
        : { stage: "design_review", review: null };
    }
    if (c.key === "approved") return { stage: team === "Engineering" ? "prod" : "design_approved" };
  }

  const only = c.accepts[0];
  // Dev's own review column is the one that does not know who is reviewing.
  if (only.stage === "dev_review") return only.review ? { stage: only.stage, review: only.review } : { ask: "review" };
  return { stage: only.stage };
}

/** The nudge copy. Asked at the moment of handover, because a card that reaches two teams'
 *  columns is worse than one question. */
export const ASK_TEAM = {
  title: "Who takes this?",
  body: "One team at a time. It shows in that team's PM handover column and nowhere else.",
  options: [
    { value: "Design" as BoardTeam, label: "Design" },
    { value: "Engineering" as BoardTeam, label: "Dev" },
  ],
};

export const ASK_REVIEW = {
  title: "Who reviews it?",
  body: "Design QA puts it in Design's Dev QA handover column. PM review puts it in PM's Handed for review.",
  options: [
    { value: "Design" as ReviewWith, label: "Design QA" },
    { value: "PM" as ReviewWith, label: "PM review" },
  ],
};
