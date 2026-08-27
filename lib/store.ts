import { useSyncExternalStore } from "react";
import type {
  Activity, ActivityKind, Assignee, Comment, Filter, Node, Roadmap, Roster, Status,
  Theme, ViewId, TimelineMode, SimpleMode, TeamGran,
} from "./types";
import { DEFAULT_ROSTER, STATUS_CYCLE } from "./constants";
import { SEED_VERSION, seed, stampIds } from "./seed";
import { uid, newRoadmapId } from "./id";
import { makeHelpers, pruneTasks, type Helpers } from "./teams";
import { effStatus, normPriority, subtreeCounts, waveWord } from "./derive";
import { reconcile } from "./dates";
import { CLIENT_ID, loadRemote, saveRemote, subscribeRemote, supabaseEnabled } from "./remote";

const ROADMAPS_KEY = "stackback_roadmaps_v3";
const ROSTER_KEY = "stackback_roster_v1";
const THEME_KEY = "stackback_theme";
/** Per-person, never shared: with Supabase on, everyone must keep their own identity. */
const ME_KEY = "stackback_me_v1";
/** The id of the roadmap that mirrors the roadmap sheet. Any other roadmap is hand-made
 *  by the team and is never touched by a re-seed. */
const SHEET_ROADMAP_ID = "stackback";
/** The activity log lives in the shared blob, so it has to stay bounded. */
const ACTIVITY_CAP = 300;

interface Data {
  roadmaps: Roadmap[];
  activeId: string;
  roster: Roster;
  activity: Activity[];
}
export interface UiState {
  view: ViewId;
  tlMode: TimelineMode;
  simpleMode: SimpleMode;
  teamGran: TeamGran;
  filter: Filter;
  /** Board checklist disclosure. Opt-in: a card is closed unless its id is true here,
   *  so a fresh board opens quiet no matter how many subtasks a milestone carries. */
  boardOpen: Record<string, boolean>;
  simpleOpen: Record<string, boolean>;
  /** Which cards have their comment thread showing. */
  commentsOpen: Record<string, boolean>;
  sort: { key: string; dir: "asc" | "desc" } | null;
  theme: Theme;
  activityOpen: boolean;
}

interface Entry {
  node: Node;
  arr: Node[];
  index: number;
  parentId: string;
}

function sheetRoadmap(): Roadmap {
  return { id: SHEET_ROADMAP_ID, name: "StackBack", tasks: seed().map(stampIds), seedVersion: SEED_VERSION };
}
function defaultData(): Data {
  return { roadmaps: [sheetRoadmap()], activeId: SHEET_ROADMAP_ID, roster: clone(DEFAULT_ROSTER), activity: [] };
}
/** Replace a stored copy of the sheet roadmap that predates the current SEED_VERSION.
 *  Returns true when something was re-seeded, so the caller can persist the fresh copy. */
function reseedIfStale(roadmaps: Roadmap[]): boolean {
  const i = roadmaps.findIndex((r) => r.id === SHEET_ROADMAP_ID);
  if (i < 0) { roadmaps.unshift(sheetRoadmap()); return true; }
  if ((roadmaps[i].seedVersion || 1) >= SEED_VERSION) return false;
  roadmaps[i] = { ...sheetRoadmap(), name: roadmaps[i].name };
  return true;
}
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

class Store {
  data: Data = defaultData();
  ui: UiState = {
    view: "timeline", tlMode: "swim", simpleMode: "stage", teamGran: "team",
    filter: null, boardOpen: {}, simpleOpen: {}, commentsOpen: {}, sort: null,
    theme: "auto", activityOpen: false,
  };
  /** Display name used for authorship on comments and activity. Local to this browser. */
  me = "";
  helpers: Helpers = makeHelpers(this.data.roster);
  private listeners = new Set<() => void>();
  private version = 0;
  hydrated = false;

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getSnapshot = () => this.version;
  private notify() {
    this.version++;
    this.listeners.forEach((l) => l());
  }
  private rebuildHelpers() {
    this.helpers = makeHelpers(this.data.roster);
  }

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubRemote: (() => void) | null = null;

  /* ---- persistence ---- */
  async hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try { this.ui.theme = (localStorage.getItem(THEME_KEY) as Theme) || "auto"; } catch {}
    try { this.me = localStorage.getItem(ME_KEY) || ""; } catch {}

    if (supabaseEnabled) {
      // Shared backend. Falls back to the seeded default on any error.
      try {
        const r = await loadRemote();
        if (r) {
          r.roadmaps.forEach((rm) => (rm.tasks = (rm.tasks || []).map(stampIds)));
          const stale = reseedIfStale(r.roadmaps);
          this.data.roadmaps = r.roadmaps;
          this.data.activeId = r.activeId || r.roadmaps[0].id;
          if (r.roster && r.roster.Engineering) this.data.roster = r.roster;
          this.data.activity = Array.isArray(r.activity) ? r.activity : [];
          if (stale) await saveRemote(this.remoteState());
        } else {
          // First run: seed the remote with the default StackBack roadmap.
          await saveRemote(this.remoteState());
        }
        // Live updates from other browsers. Our own echo is filtered by client id.
        this.unsubRemote = subscribeRemote((incoming) => {
          incoming.roadmaps.forEach((rm) => (rm.tasks = (rm.tasks || []).map(stampIds)));
          this.data.roadmaps = incoming.roadmaps;
          this.data.activeId = incoming.activeId || incoming.roadmaps[0].id;
          if (incoming.roster && incoming.roster.Engineering) this.data.roster = incoming.roster;
          this.data.activity = Array.isArray(incoming.activity) ? incoming.activity : [];
          this.rebuildHelpers();
          this.notify(); // no persist: adopting someone else's write must not echo back
        });
      } catch (e) {
        console.warn("Supabase hydrate failed, using defaults:", e);
      }
    } else {
      try {
        const raw = localStorage.getItem(ROADMAPS_KEY);
        if (raw) {
          const p = JSON.parse(raw);
          if (p && p.roadmaps && p.roadmaps.length) {
            p.roadmaps.forEach((r: Roadmap) => (r.tasks = (r.tasks || []).map(stampIds)));
            const stale = reseedIfStale(p.roadmaps);
            this.data.roadmaps = p.roadmaps;
            this.data.activeId = p.activeId || p.roadmaps[0].id;
            this.data.activity = Array.isArray(p.activity) ? p.activity : [];
            if (stale) this.persist();
          }
        }
      } catch {}
      try {
        const r = JSON.parse(localStorage.getItem(ROSTER_KEY) || "null");
        if (r && r.Engineering && r.Design && r.PM) this.data.roster = r;
      } catch {}
    }

    this.rebuildHelpers();
    this.applyTheme();
    this.notify();
  }
  private remoteState() {
    return {
      roadmaps: this.data.roadmaps,
      activeId: this.data.activeId,
      roster: this.data.roster,
      activity: this.data.activity,
    };
  }
  private persist() {
    if (supabaseEnabled) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { saveRemote(this.remoteState()); }, 400);
      return;
    }
    try {
      localStorage.setItem(ROADMAPS_KEY, JSON.stringify({
        activeId: this.data.activeId, roadmaps: this.data.roadmaps, activity: this.data.activity,
      }));
      localStorage.setItem(ROSTER_KEY, JSON.stringify(this.data.roster));
    } catch {}
  }
  private commit() {
    this.persist();
    this.notify();
  }
  dispose() {
    if (this.unsubRemote) { this.unsubRemote(); this.unsubRemote = null; }
  }

  /* ---- identity ---- */
  setMe(name: string) {
    this.me = (name || "").trim();
    try { localStorage.setItem(ME_KEY, this.me); } catch {}
    this.notify();
  }
  get who(): string {
    return this.me || "Someone";
  }

  /* ---- activity ---- */
  private log(kind: ActivityKind, title: string, detail?: string, nodeId?: string) {
    const now = new Date().toISOString();
    // Editing a start and then an end is one act of scheduling, not two, and cycling a
    // status past the value you wanted is not two decisions either. Collapse a repeat of
    // the same kind, by the same person, on the same node inside a minute into one entry
    // carrying the latest detail, so the log reads like intent rather than keystrokes.
    const head = this.data.activity[0];
    if (
      head && head.kind === kind && head.who === this.who && head.nodeId === nodeId &&
      nodeId !== undefined && kind !== "comment" &&
      Date.parse(now) - Date.parse(head.at) < 60_000
    ) {
      head.at = now;
      head.title = title;
      head.detail = detail;
      return;
    }
    this.data.activity.unshift({ id: uid("a_"), at: now, who: this.who, kind, title, detail, nodeId });
    if (this.data.activity.length > ACTIVITY_CAP) this.data.activity.length = ACTIVITY_CAP;
  }
  get activity(): Activity[] {
    return this.data.activity;
  }
  clearActivity() {
    this.data.activity = [];
    this.commit();
  }

  /* ---- getters ---- */
  activeRoadmap(): Roadmap {
    return this.data.roadmaps.find((r) => r.id === this.data.activeId) || this.data.roadmaps[0];
  }
  get tasks(): Node[] {
    return this.activeRoadmap().tasks;
  }
  /** Tasks after the active filter is applied (pruned to only relevant nodes). Read views use this. */
  get viewTasks(): Node[] {
    return this.ui.filter ? pruneTasks(this.tasks, this.ui.filter, this.helpers) : this.tasks;
  }

  /* ---- tree helpers ---- */
  private findEntry(id: string): Entry | null {
    let res: Entry | null = null;
    const walk = (nodes: Node[], parentId: string) => {
      nodes.forEach((n, i) => {
        if (n.id === id) res = { node: n, arr: nodes, index: i, parentId };
        walk(n.children || [], n.id);
      });
    };
    walk(this.tasks, "root");
    return res;
  }
  find(id: string): Node | null {
    const e = this.findEntry(id);
    return e ? e.node : null;
  }
  isDesc(ancestorId: string, id: string): boolean {
    const e = this.findEntry(ancestorId);
    if (!e) return false;
    let found = false;
    const rec = (n: Node) => (n.children || []).forEach((c) => { if (c.id === id) found = true; rec(c); });
    rec(e.node);
    return found;
  }
  private detach(id: string): Node | null {
    const e = this.findEntry(id);
    if (!e) return null;
    return e.arr.splice(e.index, 1)[0];
  }
  cardMoves(task: Node): { up: boolean; down: boolean } {
    const same = this.tasks.filter((t) => normPriority(t.priority) === normPriority(task.priority));
    const idx = same.findIndex((t) => t.id === task.id);
    return { up: idx > 0, down: idx >= 0 && idx < same.length - 1 };
  }

  /* ---- mutations ---- */
  reorder(id: string, dir: "up" | "down") {
    const e = this.findEntry(id);
    if (!e) return;
    if (e.parentId === "root") {
      const arr = this.tasks;
      const i = arr.indexOf(e.node);
      const p = normPriority(arr[i].priority);
      let j = -1;
      if (dir === "up") { for (let k = i - 1; k >= 0; k--) if (normPriority(arr[k].priority) === p) { j = k; break; } }
      else { for (let k = i + 1; k < arr.length; k++) if (normPriority(arr[k].priority) === p) { j = k; break; } }
      if (j < 0) return;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    } else {
      const a = e.arr; const i = e.index; const j = i + (dir === "up" ? -1 : 1);
      if (j < 0 || j >= a.length) return;
      [a[i], a[j]] = [a[j], a[i]];
    }
    this.commit();
  }
  moveNode(dragId: string, parent: string, beforeId: string, priority: number | null) {
    if (!dragId || dragId === parent) return;
    if (parent !== "root" && this.isDesc(dragId, parent)) return;
    const before = this.findEntry(dragId);
    const wasPriority = before ? normPriority(before.node.priority) : null;
    const node = this.detach(dragId);
    if (!node) return;
    let arr: Node[];
    if (parent === "root") { node.priority = priority; arr = this.tasks; }
    else {
      delete node.priority;
      const pe = this.findEntry(parent);
      if (!pe) { this.tasks.push(node); this.commit(); return; }
      pe.node.children = pe.node.children || [];
      arr = pe.node.children;
    }
    let idx = arr.length;
    if (beforeId) { const bi = arr.findIndex((x) => x.id === beforeId); if (bi >= 0) idx = bi; }
    arr.splice(idx, 0, node);
    if (parent === "root" && priority !== null && wasPriority !== normPriority(priority)) {
      this.log("move", node.title, `to ${waveWord(priority)}`, node.id);
    }
    this.commit();
  }
  nestNode(dragId: string, targetId: string) {
    if (!dragId || dragId === targetId || this.isDesc(dragId, targetId)) return;
    const node = this.detach(dragId);
    if (!node) return;
    const te = this.findEntry(targetId);
    if (!te) { this.tasks.push(node); this.commit(); return; }
    delete node.priority;
    te.node.children = te.node.children || [];
    te.node.children.push(node);
    this.ui.boardOpen[targetId] = true;
    this.log("nest", node.title, `under ${te.node.title}`, node.id);
    this.commit();
  }

  /** Leaf status cycling: planned to in progress to done. */
  cycleStatus(id: string) {
    const e = this.findEntry(id);
    if (!e) return;
    const i = STATUS_CYCLE.indexOf(e.node.status);
    const next = STATUS_CYCLE[(i + 1) % 3];
    e.node.status = next;
    this.log("status", e.node.title, next, e.node.id);
    this.commit();
  }
  /** Done is a whole-subtree fact, so authoring it on a parent has to reach the children.
   *  Marking a parent done checks off everything under it; clearing it resets the subtree
   *  to planned. Combined with the roll-up in `effStatus`, the two directions now agree,
   *  which is what stops a card reading "done" while its checklist sits at 3 of 7. */
  private setDeep(n: Node, status: Status) {
    n.status = status;
    (n.children || []).forEach((c) => this.setDeep(c, status));
  }
  toggleDone(id: string) {
    const e = this.findEntry(id);
    if (!e) return;
    const wasDone = effStatus(e.node) === "done";
    const target: Status = wasDone ? "planned" : "done";
    const c = subtreeCounts(e.node);
    this.setDeep(e.node, target);
    this.log(wasDone ? "undone" : "done", e.node.title,
      c.total ? `${c.total} subtask${c.total === 1 ? "" : "s"}` : undefined, e.node.id);
    this.commit();
  }
  del(id: string) {
    const e = this.findEntry(id);
    if (e) this.log("delete", e.node.title, undefined, undefined);
    this.detach(id);
    this.commit();
  }
  addChild(pid: string, title = "New subtask"): string | null {
    const pe = this.findEntry(pid);
    if (!pe) return null;
    pe.node.children = pe.node.children || [];
    const child: Node = stampIds({ id: "", title, status: "planned" as Status, assignees: [], children: [] });
    pe.node.children.push(child);
    this.ui.boardOpen[pid] = true;
    this.log("add", title, `under ${pe.node.title}`, child.id);
    this.commit();
    return child.id;
  }
  rename(id: string, title: string) {
    title = (title || "").trim();
    if (!title) return;
    const e = this.findEntry(id);
    if (!e || e.node.title === title) return;
    e.node.title = title;
    this.commit();
  }
  toggleAssignee(nodeId: string, name: string, isTeam: boolean) {
    const e = this.findEntry(nodeId);
    if (!e) return;
    const a = (e.node.assignees = e.node.assignees || []);
    const idx = a.findIndex((x) => x.name === name && !!x.isTeam === !!isTeam);
    if (idx >= 0) a.splice(idx, 1);
    else a.push(isTeam ? { name, isTeam: true } : { name });
    this.log("assign", e.node.title, `${idx >= 0 ? "removed" : "added"} ${name}`, e.node.id);
    this.commit();
  }

  /* ---- dates ---- */
  setDates(id: string, input: { start?: string | null; end?: string | null; tat?: number | null }, edited: "start" | "end" | "tat") {
    const e = this.findEntry(id);
    if (!e) return;
    const r = reconcile(input, edited);
    e.node.start = r.start;
    e.node.end = r.end;
    e.node.tat = r.tat;
    this.log("dates", e.node.title,
      r.start && r.end ? `${r.start} to ${r.end}` : r.start || r.end || "cleared", e.node.id);
    this.commit();
  }
  clearDates(id: string) {
    const e = this.findEntry(id);
    if (!e) return;
    e.node.start = null; e.node.end = null; e.node.tat = null;
    this.log("dates", e.node.title, "cleared", e.node.id);
    this.commit();
  }

  /* ---- comments ---- */
  addComment(nodeId: string, body: string): boolean {
    body = (body || "").trim();
    if (!body) return false;
    const e = this.findEntry(nodeId);
    if (!e) return false;
    const c: Comment = { id: uid("c_"), who: this.who, body, at: new Date().toISOString() };
    e.node.comments = e.node.comments || [];
    e.node.comments.push(c);
    this.ui.commentsOpen[nodeId] = true;
    this.log("comment", e.node.title, body.slice(0, 80), e.node.id);
    this.commit();
    return true;
  }
  delComment(nodeId: string, commentId: string) {
    const e = this.findEntry(nodeId);
    if (!e || !e.node.comments) return;
    e.node.comments = e.node.comments.filter((c) => c.id !== commentId);
    this.commit();
  }
  commentCount(n: Node): number {
    let total = (n.comments || []).length;
    (n.children || []).forEach((c) => { total += this.commentCount(c); });
    return total;
  }

  addPersonToTeam(team: string, name: string): boolean {
    name = (name || "").trim();
    if (!name) return false;
    if (!this.data.roster[team]) this.data.roster[team] = [];
    if (this.data.roster[team].indexOf(name) < 0) this.data.roster[team].push(name);
    this.rebuildHelpers();
    this.commit();
    return true;
  }
  addTask(title: string, priority: number | null, eta: string | null, subs: string[], assignees: Assignee[]) {
    const task: Node = stampIds({
      id: "", title, status: "planned", assignees: assignees.slice(),
      children: subs.map((s) => stampIds({ id: "", title: s, status: "planned", assignees: [], children: [] })),
      priority,
    });
    if (eta) { task.end = eta; task.eta = eta; }
    this.tasks.push(task);
    this.log("add", title, waveWord(priority), task.id);
    this.commit();
  }

  /* ---- ui ---- */
  toggleBoardOpen(id: string) { this.ui.boardOpen[id] = !(this.ui.boardOpen[id] === true); this.notify(); }
  isBoardOpen(id: string) { return this.ui.boardOpen[id] === true; }
  setAllBoardOpen(open: boolean) {
    if (!open) { this.ui.boardOpen = {}; this.notify(); return; }
    const map: Record<string, boolean> = {};
    const walk = (nodes: Node[]) => nodes.forEach((n) => {
      if ((n.children || []).length) { map[n.id] = true; walk(n.children); }
    });
    walk(this.tasks);
    this.ui.boardOpen = map;
    this.notify();
  }
  anyBoardOpen(): boolean { return Object.values(this.ui.boardOpen).some(Boolean); }
  toggleComments(id: string) { this.ui.commentsOpen[id] = !this.ui.commentsOpen[id]; this.notify(); }
  toggleSimpleOpen(id: string) { this.ui.simpleOpen[id] = !this.ui.simpleOpen[id]; this.notify(); }
  setActivityOpen(v: boolean) { this.ui.activityOpen = v; this.notify(); }
  setView(v: ViewId) { this.ui.view = v; this.ui.sort = null; this.notify(); }
  setTlMode(m: TimelineMode) { this.ui.tlMode = m; this.notify(); }
  setSimpleMode(m: SimpleMode) { this.ui.simpleMode = m; this.notify(); }
  setTeamGran(g: TeamGran) { this.ui.teamGran = g; this.notify(); }
  setFilter(f: Filter) { this.ui.filter = f; this.notify(); }
  setSort(key: string) {
    if (this.ui.sort && this.ui.sort.key === key) this.ui.sort.dir = this.ui.sort.dir === "asc" ? "desc" : "asc";
    else this.ui.sort = { key, dir: "asc" };
    this.notify();
  }

  /* ---- shareable view state ----
   *  The view and the active filter live in the URL so a filtered board can be sent to
   *  someone and open the same way for them. Nothing else is encoded: everything else is
   *  either shared data or a personal preference. */
  applyUrl(qs: string) {
    const p = new URLSearchParams(qs);
    const v = p.get("view");
    if (v === "timeline" || v === "simple" || v === "teams" || v === "board") this.ui.view = v;
    const tl = p.get("tl");
    if (tl === "wave" || tl === "swim" || tl === "gantt") this.ui.tlMode = tl;
    const team = p.get("team");
    const person = p.get("person");
    if (team) this.ui.filter = { type: "team", name: team };
    else if (person) this.ui.filter = { type: "person", name: person };
    this.notify();
  }
  toQuery(): string {
    const p = new URLSearchParams();
    if (this.ui.view !== "timeline") p.set("view", this.ui.view);
    if (this.ui.view === "timeline" && this.ui.tlMode !== "swim") p.set("tl", this.ui.tlMode);
    if (this.ui.filter) p.set(this.ui.filter.type, this.ui.filter.name);
    const s = p.toString();
    return s ? "?" + s : "";
  }

  /* ---- theme ---- */
  applyTheme() {
    if (typeof document === "undefined") return;
    if (this.ui.theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", this.ui.theme);
    try { localStorage.setItem(THEME_KEY, this.ui.theme); } catch {}
  }
  cycleTheme() {
    this.ui.theme = this.ui.theme === "auto" ? "light" : this.ui.theme === "light" ? "dark" : "auto";
    this.applyTheme();
    this.notify();
  }

  /* ---- roadmaps ---- */
  private resetUiScopes() {
    this.ui.filter = null;
    this.ui.boardOpen = {};
    this.ui.simpleOpen = {};
    this.ui.commentsOpen = {};
  }
  switchRoadmap(id: string) {
    if (!this.data.roadmaps.some((r) => r.id === id)) return;
    this.data.activeId = id;
    this.resetUiScopes();
    this.commit();
  }
  addRoadmap(name: string): string | null {
    name = (name || "").trim();
    if (!name) return null;
    const id = newRoadmapId();
    this.data.roadmaps.push({ id, name, tasks: [] });
    this.log("roadmap", name, "created");
    this.switchRoadmap(id);
    return id;
  }
  renameRoadmap(id: string, name: string) {
    name = (name || "").trim();
    if (!name) return;
    const r = this.data.roadmaps.find((x) => x.id === id);
    if (r) { r.name = name; this.commit(); }
  }
  deleteRoadmap(id: string) {
    if (this.data.roadmaps.length <= 1) return;
    const r = this.data.roadmaps.find((x) => x.id === id);
    if (r) this.log("roadmap", r.name, "deleted");
    this.data.roadmaps = this.data.roadmaps.filter((x) => x.id !== id);
    if (this.data.activeId === id) this.data.activeId = this.data.roadmaps[0].id;
    this.commit();
  }
  resetActive() {
    const r = this.activeRoadmap();
    if (r.id === SHEET_ROADMAP_ID) { r.tasks = seed().map(stampIds); r.seedVersion = SEED_VERSION; }
    else r.tasks = [];
    this.resetUiScopes();
    this.log("roadmap", r.name, "reset");
    this.commit();
  }
}

export const store = new Store();
export { CLIENT_ID };

export function useStore(): Store {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return store;
}
