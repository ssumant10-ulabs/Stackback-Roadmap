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
}

export interface Roadmap {
  id: string;
  name: string;
  tasks: Node[];
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
