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

export type BoardView = "pm" | "design" | "dev" | "backlog" | "roadmap";
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
      /* Queued, not just handed. Design's board read zero while the sheet had design work on
         it, because every one of those cards was still `planned` and this column only took a
         handover. A team board that cannot show the team's own queue is a board nobody
         opens. Cards naming that team, at any stage before it has picked them up. */
      { key: "in", title: "To pick up",
        accepts: [
          { stage: "pm_handover", team: "Design" },
          { stage: "feature", team: "Design" },
          { stage: "bug", team: "Design" },
        ] },
      { key: "wip", title: "In progress", accepts: [{ stage: "design_progress" }] },
      { key: "review", title: "In review", accepts: [{ stage: "design_review" }],
        hint: "Also PM's Handed for review." },
      { key: "approved", title: "Design approved", accepts: [{ stage: "design_approved" }],
        hint: "Also PM's Approved." },
      /* Also anything dev is actively building that names design. A card the sheet marks
         Engineering with a Design assignee sits at `dev_progress`, and without this it left
         Design's board the moment dev started: design could see it queued and could not see
         it again until dev approved it. From design's side "dev has it" and "dev is building
         it" are the same column. */
      { key: "todev", title: "Handed over to dev",
        accepts: [{ stage: "design_to_dev" }, { stage: "dev_progress", team: "Design" }],
        hint: "Also Dev's Design handover, and anything dev is building that names design." },
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
      { key: "in", title: "To pick up",
        accepts: [
          { stage: "pm_handover", team: "Engineering" },
          { stage: "feature", team: "Engineering" },
          { stage: "bug", team: "Engineering" },
        ] },
      { key: "fromdesign", title: "Design handover",
        accepts: [{ stage: "design_to_dev" }, { stage: "design_progress", team: "Engineering" }],
        hint: "Also Design's Handed over to dev, and design work in flight that names dev." },
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

/** Two more lenses on the same stages.
 *
 *  Backlog is everything nobody has picked up, which used to be a destination in the top
 *  menu. It is a column set, not a screen: the cards are the same cards and moving one out
 *  of the backlog is the same drag as any other.
 *
 *  Roadmap is the board grouped the way the old board grouped it, by where the work is
 *  rather than by who holds it. It is a READ of the same stages: every card on it is on one
 *  of the three team boards too, and moving it here moves it there. */
BOARD_VIEWS.push(
  {
    id: "backlog",
    label: "Backlog",
    blurb: "Everything nobody has picked up yet. Hand one over and it leaves.",
    columns: [
      { key: "bug", title: "Bugs", accepts: [{ stage: "bug" }] },
      { key: "feature", title: "Feature requests", accepts: [{ stage: "feature" }] },
      { key: "handover", title: "Handed over", accepts: [{ stage: "pm_handover" }],
        hint: "Dropping here asks which team takes it." },
    ],
  },
  {
    id: "roadmap",
    label: "Roadmap",
    blurb: "Every card by where the work is, not by who holds it. The same cards as the three team boards.",
    columns: [
      { key: "todo", title: "Not started",
        accepts: [{ stage: "bug" }, { stage: "feature" }, { stage: "pm_handover" }] },
      { key: "doing", title: "In progress",
        accepts: [{ stage: "design_progress" }, { stage: "design_to_dev" }, { stage: "dev_progress" }] },
      { key: "review", title: "In review",
        accepts: [{ stage: "design_review" }, { stage: "dev_review" }] },
      { key: "approved", title: "Approved",
        accepts: [{ stage: "design_approved" }, { stage: "dev_approved" }] },
      { key: "prod", title: "Pushed to prod", accepts: [{ stage: "prod" }] },
    ],
  },
);

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

export type CardKind = "feature" | "bug" | "landing";

export const KIND_LABEL: Record<CardKind, string> = {
  bug: "Bug", feature: "Feature", landing: "Landing page",
};

/** What the checkbox reads once a card is in a column. A card sitting in In progress while
 *  its own status says planned is the drift the board exists to remove, so the move writes
 *  both. Production is handled separately: it reaches the whole checklist, and starting a
 *  milestone does not finish anything. */
export const STAGE_STATUS: Partial<Record<Stage, "planned" | "progress" | "done">> = {
  bug: "planned",
  feature: "planned",
  pm_handover: "planned",
  design_progress: "progress",
  design_review: "progress",
  design_approved: "progress",
  design_to_dev: "progress",
  dev_progress: "progress",
  dev_review: "progress",
  dev_approved: "progress",
};

/** Where a card sits before anybody has moved it: its own intake column, read off what it
 *  is. Everything that predates the board lands in Bugs or Feature requests, which is where
 *  an untriaged item belongs, and nothing has to be backfilled for the board to be right. */
export function defaultStage(kind: CardKind | undefined | null): Stage {
  return kind === "bug" ? "bug" : "feature";
}
export const stageOf = (f: { stage?: Stage | null; kind?: CardKind | null }): Stage =>
  f.stage || defaultStage(f.kind);

/** Where a ROADMAP task sits before anybody has moved it on the board.
 *
 *  Read off the status and team it already carried, so 149 tasks landed in the right columns
 *  on the first render with nothing written. A shipped milestone is in production, work in
 *  flight is in progress on whichever team owns it, and anything still planned is backlog.
 *  Work in flight with no team is back with PM, because "in progress, owner unknown" is a
 *  handover that has not happened rather than a team's column. */
export function defaultNodeStage(
  effStatus: "planned" | "progress" | "done",
  team: string | null | undefined,
  kind?: CardKind | null,
): Stage {
  if (effStatus === "done") return "prod";
  if (effStatus === "progress") {
    if (team === "Design") return "design_progress";
    if (team === "Engineering") return "dev_progress";
    return "pm_handover";
  }
  /* Planned work is intake, and which intake column depends on what it is. Ignoring the kind
     here sent a card added to the Bugs column straight into Feature requests: it was created
     as a bug, tagged as a bug, and filed as a request. */
  return defaultStage(kind);
}

/** The sheet's Team column mapped onto the two teams a board card can be handed to. PM is
 *  not one of them: PM hands out, it does not hold. */
export function teamToBoard(team: string | null | undefined): BoardTeam | null {
  return team === "Design" ? "Design" : team === "Engineering" ? "Engineering" : null;
}

/** Which stages a view can show at all, so a card handed to the other team does not appear
 *  in a column just because the column's stage matches. */
export function inView(view: BoardView, stage: Stage, teams: BoardTeam[], review: ReviewWith | null): boolean {
  return VIEW_BY_ID[view].columns.some((c) => fits(c, stage, teams, review));
}

/** `teams` is a LIST, not one value, and that is the difference between Design having a
 *  board and Design having an empty one.
 *
 *  A handover is one team: `boardTeam` is set, the list is that one team, and the card shows
 *  on their board and nobody else's. A card nobody has handed over is a different question,
 *  and the honest answer is every team the sheet names on it. The roadmap sheet's Team column
 *  says "Engineering" on cards that carry a Design team assignee, so reading that one column
 *  put every design card on Dev's board and left Design's reading zero. */
export function fits(c: BoardColumn, stage: Stage, teams: BoardTeam[], review: ReviewWith | null): boolean {
  return c.accepts.some((a) =>
    a.stage === stage
    && (!a.team || teams.includes(a.team))
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

  /* A team's queue holds three stages for reading and means one thing for writing: dropping
     a card there is handing it to that team. */
  if (c.key === "in" && c.accepts[0]?.team) return { stage: "pm_handover" };
  /* These two read wider than they write: they SHOW the other team's work in flight, and a
     card dropped on them is the handover itself. */
  if (c.key === "todev" || c.key === "fromdesign") return { stage: "design_to_dev" };

  if (c.accepts.length > 1) {
    /* The Roadmap lens groups by where the work is, so its columns hold several stages that
       are not a junction at all: a card dropped on its "In progress" keeps whichever team
       already had it. Only PM's two ask. */
    if (c.key === "todo" || c.key === "doing" || (c.key === "review" && c.accepts.length > 2)) {
      return { stage: c.accepts[0].stage };
    }
    if (c.key === "approved" && c.accepts.some((a) => a.stage === "dev_approved")) {
      return { stage: team === "Engineering" ? "dev_approved" : "design_approved" };
    }
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
