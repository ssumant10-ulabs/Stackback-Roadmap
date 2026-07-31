import { useSyncExternalStore } from "react";
import type { Assignee, Filter, Node, Roadmap, Roster, Status, Theme, ViewId, TimelineMode, SimpleMode, TeamGran } from "./types";
import { DEFAULT_ROSTER, STATUS_CYCLE } from "./constants";
import { SEED_VERSION, seed, stampIds } from "./seed";
import { uid, newRoadmapId } from "./id";
import { makeHelpers, pruneTasks, type Helpers } from "./teams";
import { loadRemote, saveRemote, supabaseEnabled } from "./remote";

const ROADMAPS_KEY = "stackback_roadmaps_v3";
const ROSTER_KEY = "stackback_roster_v1";
const THEME_KEY = "stackback_theme";
/** The id of the roadmap that mirrors the roadmap sheet. Any other roadmap is hand-made
 *  by the team and is never touched by a re-seed. */
const SHEET_ROADMAP_ID = "stackback";

interface Data {
  roadmaps: Roadmap[];
  activeId: string;
  roster: Roster;
}
export interface UiState {
  view: ViewId;
  tlMode: TimelineMode;
  simpleMode: SimpleMode;
  teamGran: TeamGran;
  filter: Filter;
  collapsed: Record<string, boolean>;
  simpleOpen: Record<string, boolean>;
  sort: { key: string; dir: "asc" | "desc" } | null;
  theme: Theme;
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
  return { roadmaps: [sheetRoadmap()], activeId: SHEET_ROADMAP_ID, roster: clone(DEFAULT_ROSTER) };
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
    filter: null, collapsed: {}, simpleOpen: {}, sort: null, theme: "auto",
  };
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

  /* ---- persistence ---- */
  async hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try { this.ui.theme = (localStorage.getItem(THEME_KEY) as Theme) || "auto"; } catch {}

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
          if (stale) await saveRemote({ roadmaps: this.data.roadmaps, activeId: this.data.activeId, roster: this.data.roster });
        } else {
          // First run: seed the remote with the default StackBack roadmap.
          await saveRemote({ roadmaps: this.data.roadmaps, activeId: this.data.activeId, roster: this.data.roster });
        }
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
  private persist() {
    if (supabaseEnabled) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        saveRemote({ roadmaps: this.data.roadmaps, activeId: this.data.activeId, roster: this.data.roster });
      }, 400);
      return;
    }
    try {
      localStorage.setItem(ROADMAPS_KEY, JSON.stringify({ activeId: this.data.activeId, roadmaps: this.data.roadmaps }));
      localStorage.setItem(ROSTER_KEY, JSON.stringify(this.data.roster));
    } catch {}
  }
  private commit() {
    this.persist();
    this.notify();
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
    const same = this.tasks.filter((t) => (t.priority || null) === (task.priority || null));
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
      const p = arr[i].priority || null;
      let j = -1;
      if (dir === "up") { for (let k = i - 1; k >= 0; k--) if ((arr[k].priority || null) === p) { j = k; break; } }
      else { for (let k = i + 1; k < arr.length; k++) if ((arr[k].priority || null) === p) { j = k; break; } }
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
    this.ui.collapsed[targetId] = false;
    this.commit();
  }
  cycleStatus(id: string) {
    const e = this.findEntry(id);
    if (!e) return;
    const i = STATUS_CYCLE.indexOf(e.node.status);
    e.node.status = STATUS_CYCLE[(i + 1) % 3];
    this.commit();
  }
  del(id: string) {
    this.detach(id);
    this.commit();
  }
  addChild(pid: string, title = "New subtask"): string | null {
    const pe = this.findEntry(pid);
    if (!pe) return null;
    pe.node.children = pe.node.children || [];
    const child: Node = stampIds({ id: "", title, status: "planned" as Status, assignees: [], children: [] });
    pe.node.children.push(child);
    this.ui.collapsed[pid] = false;
    this.commit();
    return child.id;
  }
  toggleAssignee(nodeId: string, name: string, isTeam: boolean) {
    const e = this.findEntry(nodeId);
    if (!e) return;
    const a = (e.node.assignees = e.node.assignees || []);
    const idx = a.findIndex((x) => x.name === name && !!x.isTeam === !!isTeam);
    if (idx >= 0) a.splice(idx, 1);
    else a.push(isTeam ? { name, isTeam: true } : { name });
    this.commit();
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
    if (eta) task.eta = eta;
    this.tasks.push(task);
    this.commit();
  }

  /* ---- ui ---- */
  toggleCollapse(id: string) { this.ui.collapsed[id] = !(this.ui.collapsed[id] === true); this.notify(); }
  toggleSimpleOpen(id: string) { this.ui.simpleOpen[id] = !this.ui.simpleOpen[id]; this.notify(); }
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
  switchRoadmap(id: string) {
    if (!this.data.roadmaps.some((r) => r.id === id)) return;
    this.data.activeId = id;
    this.ui.filter = null; this.ui.collapsed = {}; this.ui.simpleOpen = {};
    this.commit();
  }
  addRoadmap(name: string): string | null {
    name = (name || "").trim();
    if (!name) return null;
    const id = newRoadmapId();
    this.data.roadmaps.push({ id, name, tasks: [] });
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
    this.data.roadmaps = this.data.roadmaps.filter((r) => r.id !== id);
    if (this.data.activeId === id) this.data.activeId = this.data.roadmaps[0].id;
    this.commit();
  }
  resetActive() {
    const r = this.activeRoadmap();
    if (r.id === SHEET_ROADMAP_ID) { r.tasks = seed().map(stampIds); r.seedVersion = SEED_VERSION; }
    else r.tasks = [];
    this.ui.filter = null; this.ui.collapsed = {}; this.ui.simpleOpen = {};
    this.commit();
  }
}

export const store = new Store();
void uid; // keep import referenced for future use

export function useStore(): Store {
  useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return store;
}
