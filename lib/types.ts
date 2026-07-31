export type Status = "planned" | "progress" | "done";

export interface Assignee {
  name: string;
  isTeam?: boolean;
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

export type Roster = Record<string, string[]>;

export type Theme = "auto" | "light" | "dark";

export type ViewId = "timeline" | "simple" | "teams" | "board";
export type TimelineMode = "wave" | "swim";
export type SimpleMode = "stage" | "status";
export type TeamGran = "team" | "person" | "load";

export type Filter = { type: "team" | "person"; name: string } | null;

export interface Counts {
  total: number;
  done: number;
  prog: number;
}
