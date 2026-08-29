export type Status = "planned" | "progress" | "done";

export interface Assignee {
  name: string;
  isTeam?: boolean;
}

export interface Comment {
  id: string;
  /** Display name of whoever wrote it, from the local "who am I" setting. */
  who: string;
  body: string;
  /** ISO timestamp. */
  at: string;
}

export interface Node {
  id: string;
  title: string;
  status: Status;
  assignees: Assignee[];
  children: Node[];
  /** only meaningful on top-level milestone nodes */
  priority?: number | null;
  eta?: string | null;
  note?: string;
  /** Owning discipline as declared in the roadmap sheet's Team column. When set it wins
   *  over guessing the team from who is assigned (the sheet is the source of truth). */
  team?: string | null;
  /** Roadmap sheet: Handover Timeline column. */
  handover?: string | null;
  /** Roadmap sheet: Deadline column. */
  deadline?: string | null;
  /** Scheduled window, ISO `yyyy-mm-dd`. Settable on a milestone or any subtask.
   *  A node with no window of its own inherits an implied one from its subtree:
   *  see `effRange` in lib/dates.ts. */
  start?: string | null;
  end?: string | null;
  /** Turnaround in calendar days, inclusive of both endpoints. Kept in step with
   *  start/end whenever two of the three are known. */
  tat?: number | null;
  comments?: Comment[];
}

export interface Roadmap {
  id: string;
  name: string;
  tasks: Node[];
  /** Only on the sheet-derived "stackback" roadmap: which SEED_VERSION these tasks came from.
   *  A stored value behind the current one is re-seeded on load so a saved browser (or the
   *  shared Supabase row) never pins the team to a superseded copy of the roadmap sheet. */
  seedVersion?: number;
}

export type ActivityKind =
  | "status" | "done" | "undone" | "move" | "nest" | "add" | "delete"
  | "dates" | "assign" | "comment" | "roadmap";

export interface Activity {
  id: string;
  /** ISO timestamp. */
  at: string;
  who: string;
  kind: ActivityKind;
  /** Title of the node it happened to, captured at the time, so the entry still reads
   *  correctly after that node is renamed or deleted. */
  title: string;
  nodeId?: string;
  detail?: string;
}

/** A row from the pilot sheet's Priority Features tab. `sheetStatus` is what the sheet
 *  says; once a feature is linked to a roadmap task the board becomes the authority and
 *  the two are shown side by side so drift between them is visible rather than silent. */
export type FeatureBand = "upcoming" | "merchant" | "partner";

export interface Feature {
  id: string;
  /** Sheet id, INT-01 / MR-04 / PT-02. Blank for the unnumbered rows and for new ones. */
  ref: string;
  band: FeatureBand;
  title: string;
  priority?: string | null;
  sheetStatus?: string | null;
  requestedBy?: string | null;
  effort?: string | null;
  urgency?: string | null;
  importance?: string | null;
  team?: string | null;
  objective?: string | null;
  nextSteps?: string | null;
  blockers?: string | null;
  /** Roadmap task delivering this feature. Resolved by id, falling back to title. */
  taskId?: string | null;
  taskTitle?: string | null;
  /** Which pilot store asked for it. Set when CS logs it from the Pilots module, so a
   *  request carries its origin rather than a name in a free-text "requested by" cell. */
  storeId?: string | null;
  storeName?: string | null;
  /** A merchant raises both. Bugs are the gap the pilot sheet never covered: it counts
   *  open bugs per store but never says what they are. */
  kind?: "feature" | "bug";
  updatedAt: string;
}

/** One pilot store, merging the sheet's Overview and Activation Pointers tabs, which are
 *  the same 44 stores described twice. */
export interface PilotStore {
  id: string;
  n: number;
  name: string;
  url?: string | null;
  /** Overview tab */
  status?: string | null;
  pilotStart?: string | null;
  groupCreated?: string | null;
  pilotEnd?: string | null;
  appStatus?: string | null;
  primaryDev?: string | null;
  totalSubs?: number | null;
  activeSubs?: number | null;
  oneTimeBundles?: number | null;
  prepaidSubs?: number | null;
  openBugs?: number | null;
  sentiment?: string | null;
  overviewNotes?: string | null;
  /** Activation Pointers tab, every column it carries. */
  category?: string | null;
  poc?: string | null;
  activationStatus?: string | null;
  paymentType?: string | null;
  discountMargin?: string | null;
  shipping?: string | null;
  frequency?: string | null;
  bundles?: string | null;
  themeNotes?: string | null;
  email?: string | null;
  lastTouch?: string | null;
  activationNotes?: string | null;
  onboardingNotes?: string | null;
}

export type Roster = Record<string, string[]>;

export type Theme = "auto" | "light" | "dark";

export type ViewId = "timeline" | "simple" | "teams" | "board" | "features" | "pilots";
export type TimelineMode = "wave" | "swim" | "gantt";
export type SimpleMode = "stage" | "status";
export type TeamGran = "team" | "person" | "load";

export type Filter = { type: "team" | "person"; name: string } | null;

export interface Counts {
  total: number;
  done: number;
  prog: number;
}
