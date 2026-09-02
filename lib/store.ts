import { useSyncExternalStore } from "react";
import type { Activity, ActivityKind, Assignee, Comment, CustomCol, Feature, FeatureBand, Filter, Node, PilotStore, Roadmap, Roster, Shot, SimpleMode, Status, TeamGran, Theme, TimelineMode, ViewId } from "./types";
import { DEFAULT_ROSTER, STATUS_CYCLE } from "./constants";
import { SEED_VERSION, seed, stampIds } from "./seed";
import { uid, newRoadmapId } from "./id";
import { makeHelpers, pruneTasks, type Helpers } from "./teams";
import { effStatus, normPriority, subtreeCounts, waveWord } from "./derive";
import { reconcile } from "./dates";
import { featureSeed } from "./featureSeed";
import { pilotSeed } from "./pilotSeed";
import { autoLink, boardStatusOf, isDrifted, matchTask } from "./featureLink";
import { SHOT_MAX_PER_REQUEST, SHOT_TOTAL_BUDGET, fmtBytes } from "./shots";
import { parseLoose } from "./pilotDates";
import { CLIENT_ID, firebaseEnabled, loadRemote, saveRemote, subscribeRemote } from "./remote";

const ROADMAPS_KEY = "stackback_roadmaps_v3";
/** Set while a Firestore write is owed, cleared once it lands. Its presence on load means the
 *  last session ended with an edit that never reached the server. */
const PENDING_KEY = "stackback_pending_since";
const ROSTER_KEY = "stackback_roster_v1";
const THEME_KEY = "stackback_theme";
/** Per-person, never shared: on a shared backend, everyone must keep their own identity. */
const ME_KEY = "stackback_me_v1";
/** Colour ramp, per browser like the theme. */
const PALETTE_KEY = "stackback_palette_v1";
/** The id of the roadmap that mirrors the roadmap sheet. Any other roadmap is hand-made
 *  by the team and is never touched by a re-seed. */
const SHEET_ROADMAP_ID = "stackback";
/** Two surfaces hang off the roadmap header.
 *  UI/UX work: the hosted admin UI where prototypes are reviewed.
 *  Merchant UI: the WIP prototype, the approved state of every screen, now served from
 *  this app's own public/merchant folder rather than a localhost static server. It is the
 *  front door: its top-right link opens the module tracker, which holds the work in
 *  progress, the site map and every file and backlog item. Editing those files here and
 *  pushing redeploys them with the roadmap, so the two can never fall out of step. */
const DEFAULT_UIUX_URL = "https://stackback-admin-ui-iota.vercel.app/";
const DEFAULT_ADMIN_URL = "/merchant/StackBack_WIP_Prototype.html";
/** The activity log lives in the shared blob, so it has to stay bounded. */
const ACTIVITY_CAP = 300;
/** Rolling local snapshots, taken only before something destructive: resetting or deleting
 *  a roadmap, or importing over the top. They were also taken on every page load, which
 *  cost 5.7x the live state in duplicate copies and filled the list with identical entries
 *  from mere reloads. Loading a page is not a risk worth spending quota on; Download backup
 *  covers the deliberate case. */
const SNAP_KEY = "stackback_snapshots_v1";
const SNAP_MAX = 3;

interface Data {
  roadmaps: Roadmap[];
  activeId: string;
  roster: Roster;
  activity: Activity[];
  /** Everything StackBack, tracked in one place: the pilot sheet's feature list and its
   *  store list, alongside the roadmap itself. */
  features: Feature[];
  pilots: PilotStore[];
  seeded?: { features?: boolean; pilots?: boolean; dates?: boolean };
  /** Categories added by the team on top of the ones the sheet arrived with. */
  pilotCategories?: string[];
  /** Dropdown values the team added, keyed by column. Kept with the data so extending a
   *  vocabulary is a UI action, not a deploy. */
  colOptions?: Record<string, string[]>;
  /** Columns the team added to the activation log. */
  customCols?: CustomCol[];
  /** Where the two admin surfaces live. Shared, so hosting them somewhere real is a
   *  one-time change for the whole team rather than a per-browser setting. */
  adminUrl?: string;
  uiuxUrl?: string;
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
  palette: string;
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
  return {
    roadmaps: [sheetRoadmap()], activeId: SHEET_ROADMAP_ID, roster: clone(DEFAULT_ROSTER),
    activity: [], features: [], pilots: [], seeded: {}, pilotCategories: [],
    adminUrl: DEFAULT_ADMIN_URL, uiuxUrl: DEFAULT_UIUX_URL,
  };
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
    theme: "auto", palette: "lime", activityOpen: false,
  };
  /** Display name used for authorship on comments and activity. Local to this browser. */
  me = "";
  helpers: Helpers = makeHelpers(this.data.roster);
  private listeners = new Set<() => void>();
  private version = 0;
  hydrated = false;
  /** How this browser met the shared backend, for the banner that reports the switchover.
   *  "promoted" means it carried the local board up; "seeded" means it found nothing to
   *  carry and the defaults were written; "adopted" means the shared copy already existed. */
  migrated: "promoted" | "seeded" | "adopted" | null = null;
  /** True when this load found an edit that never reached the server and put it back. */
  recovered = false;
  /** Where the shared copy stands, for the topbar chip. A save that fails quietly reads
   *  exactly like a save that worked until the page reloads, and a save in flight reads the
   *  same as both, so all three states are shown rather than only the bad one. */
  saveState: "idle" | "saving" | "saved" | "failed" = "idle";
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private setSaveState(v: Store["saveState"]) {
    if (this.savedTimer) { clearTimeout(this.savedTimer); this.savedTimer = null; }
    /* "Saved" is a confirmation, not a status: it earns a couple of seconds and then gets out
       of the way, so the chip is not a permanent fixture in a header that is already full. */
    if (v === "saved") this.savedTimer = setTimeout(() => { this.saveState = "idle"; this.notify(); }, 2200);
    if (this.saveState === v) return;
    this.saveState = v;
    this.notify();
  }

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
    try { this.ui.palette = localStorage.getItem(PALETTE_KEY) || "lime"; } catch {}

    if (firebaseEnabled) {
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
          this.data.adminUrl = r.adminUrl || DEFAULT_ADMIN_URL;
          this.data.uiuxUrl = r.uiuxUrl || DEFAULT_UIUX_URL;
          this.data.features = Array.isArray(r.features) ? r.features : [];
          this.data.pilots = Array.isArray(r.pilots) ? r.pilots : [];
          this.data.seeded = r.seeded || {};
          this.data.pilotCategories = r.pilotCategories || [];
          this.data.colOptions = r.colOptions || {};
          this.data.customCols = r.customCols || [];
          if (stale) await saveRemote(this.remoteState());
          this.migrated = "adopted";
          /* An edit from the last session may never have reached the server. Recover it, but
             only when this browser's unflushed copy is newer than what the team has saved
             since, so recovering one person's lost keystroke cannot roll back someone else. */
          let pending: string | null = null;
          try { pending = localStorage.getItem(PENDING_KEY); } catch {}
          if (pending) {
            const remoteAt = r.updatedAt || "";
            if (pending > remoteAt) {
              const local = this.adoptLocal();
              if (local.found) {
                this.recovered = true;
                await saveRemote(this.remoteState());
              }
            }
            try { localStorage.removeItem(PENDING_KEY); } catch {}
          }
        } else {
          /* Nothing shared yet. This is the one moment the local board can be promoted, so
             adopt it before writing: seeding the default here would silently discard whatever
             this browser has been the only copy of. */
          const local = this.adoptLocal();
          await saveRemote(this.remoteState());
          this.migrated = local.found ? "promoted" : "seeded";
        }
        // Live updates from other browsers. Our own echo is filtered by client id.
        this.unsubRemote = subscribeRemote((incoming) => {
          incoming.roadmaps.forEach((rm) => (rm.tasks = (rm.tasks || []).map(stampIds)));
          this.data.roadmaps = incoming.roadmaps;
          this.data.activeId = incoming.activeId || incoming.roadmaps[0].id;
          if (incoming.roster && incoming.roster.Engineering) this.data.roster = incoming.roster;
          this.data.activity = Array.isArray(incoming.activity) ? incoming.activity : [];
          this.data.adminUrl = incoming.adminUrl || DEFAULT_ADMIN_URL;
          this.data.uiuxUrl = incoming.uiuxUrl || DEFAULT_UIUX_URL;
          this.data.features = Array.isArray(incoming.features) ? incoming.features : [];
          this.data.pilots = Array.isArray(incoming.pilots) ? incoming.pilots : [];
          this.data.seeded = incoming.seeded || {};
          this.data.pilotCategories = incoming.pilotCategories || [];
          this.data.colOptions = incoming.colOptions || {};
          this.data.customCols = incoming.customCols || [];
          this.rebuildHelpers();
          this.notify(); // no persist: adopting someone else's write must not echo back
        });
      } catch (e) {
        console.warn("Firestore hydrate failed, using defaults:", e);
      }
    } else {
      const local = this.adoptLocal();
      if (local.stale) this.persist();
    }

    this.watchUnload();
    this.seedModulesOnce();
    this.rebuildHelpers();
    this.applyTheme();
    this.notify();
  }
  /** Read this browser's saved board into state. Used both offline, where localStorage is
   *  the store, and once on the way to Firestore, where it is the migration: the local copy
   *  is the only record of everything logged before the shared backend existed.
   *
   *  Reads only. The local copy is deliberately left in place as a fallback. */
  private adoptLocal(): { found: boolean; stale: boolean } {
    let found = false, stale = false;
    try {
      const raw = localStorage.getItem(ROADMAPS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.roadmaps && p.roadmaps.length) {
          p.roadmaps.forEach((r: Roadmap) => (r.tasks = (r.tasks || []).map(stampIds)));
          stale = reseedIfStale(p.roadmaps);
          this.data.roadmaps = p.roadmaps;
          this.data.activeId = p.activeId || p.roadmaps[0].id;
          this.data.activity = Array.isArray(p.activity) ? p.activity : [];
          this.data.adminUrl = p.adminUrl || DEFAULT_ADMIN_URL;
          this.data.uiuxUrl = p.uiuxUrl || DEFAULT_UIUX_URL;
          this.data.features = Array.isArray(p.features) ? p.features : [];
          this.data.pilots = Array.isArray(p.pilots) ? p.pilots : [];
          this.data.seeded = p.seeded || {};
          this.data.pilotCategories = p.pilotCategories || [];
          this.data.colOptions = p.colOptions || {};
          this.data.customCols = p.customCols || [];
          found = true;
        }
      }
    } catch {}
    try {
      const r = JSON.parse(localStorage.getItem(ROSTER_KEY) || "null");
      if (r && r.Engineering && r.Design && r.PM) this.data.roster = r;
    } catch {}
    return { found, stale };
  }

  /** First run only: load the pilot sheet's feature and store lists, and auto-link each
   *  feature to the roadmap task that delivers it where the titles clearly agree. */
  private seedModulesOnce() {
    const sd = (this.data.seeded = this.data.seeded || {});
    let changed = false;
    if (!sd.features && !(this.data.features || []).length) {
      const rows = featureSeed().map((f) => ({ ...f, id: uid("f_"), updatedAt: new Date().toISOString() }));
      autoLink(rows, this.tasks);
      this.data.features = rows;
      sd.features = true; changed = true;
    }
    if (!sd.pilots && !(this.data.pilots || []).length) {
      this.data.pilots = pilotSeed().map((r) => ({ ...r, id: uid("p_") }));
      sd.pilots = true; changed = true;
    }
    if (changed) this.persist();
    this.linkRequestStoresOnce();
    this.migrateDatesOnce();
  }
  /** The date columns were free text. Convert what is already stored to ISO so they can
   *  become real date fields. Anything unrecognised is left exactly as typed rather than
   *  guessed at, and the migration runs once. */
  private migrateDatesOnce() {
    const sd = (this.data.seeded = this.data.seeded || {});
    if (sd.dates) return;
    let n = 0;
    const FIELDS: (keyof PilotStore)[] = ["groupCreated", "pilotStart", "pilotEnd", "lastTouch"];
    this.pilots.forEach((p) => {
      FIELDS.forEach((f) => {
        const raw = p[f] as string | null | undefined;
        const iso = parseLoose(raw);
        if (iso && iso !== raw) { (p as unknown as Record<string, string>)[f as string] = iso; n++; }
      });
    });
    sd.dates = true;
    this.persist();
    if (n) this.log("roadmap", "Pilot dates", `${n} converted to real dates`);
  }
  /** Categories are a list the team extends, not a fixed vocabulary. */
  get pilotCategories(): string[] {
    const set = new Set<string>(this.data.pilotCategories || []);
    this.pilots.forEach((p) => { if (p.category) set.add(p.category); });
    return [...set].sort();
  }
  addPilotCategory(name: string): boolean {
    name = (name || "").trim();
    if (!name) return false;
    const list = (this.data.pilotCategories = this.data.pilotCategories || []);
    if (list.some((x) => x.toLowerCase() === name.toLowerCase())) return false;
    list.push(name);
    this.commit();
    return true;
  }
  /** Push this browser's saved copy up as the shared one, replacing what is there.
   *
   *  Needed because the automatic promotion only fires when Firestore is empty. If a browser
   *  with nothing in it connects first, it writes the defaults and every other browser then
   *  adopts them. Nothing is lost when that happens, because the local copy is only ever
   *  read, so this puts it back. Destructive to the shared copy by design: it is the
   *  recovery, and it says so before it runs. */
  async restoreLocal(): Promise<{ ok: boolean; tasks: number }> {
    if (!firebaseEnabled) return { ok: false, tasks: 0 };
    const local = this.adoptLocal();
    if (!local.found) return { ok: false, tasks: 0 };
    const tasks = this.data.roadmaps.reduce((n, r) => n + (r.tasks || []).length, 0);
    await saveRemote(this.remoteState());
    this.rebuildHelpers();
    this.log("roadmap", "Board restored", `this browser's copy is now the shared one, ${tasks} tasks`);
    this.notify();
    return { ok: true, tasks };
  }

  /** Every value a dropdown should offer: what the code ships, what the team has added, and
   *  anything already sitting in the data so a free-typed value never disappears from its own
   *  list. */
  optionsFor(key: string, base: string[]): string[] {
    const set = new Set<string>(base);
    if (key === "category") (this.data.pilotCategories || []).forEach((v) => set.add(v));
    (this.data.colOptions?.[key] || []).forEach((v) => set.add(v));
    return [...set];
  }
  addColOption(key: string, name: string): boolean {
    name = (name || "").trim();
    if (!name) return false;
    if (key === "category") return this.addPilotCategory(name);
    const bag = (this.data.colOptions = this.data.colOptions || {});
    const list = (bag[key] = bag[key] || []);
    if (list.some((x) => x.toLowerCase() === name.toLowerCase())) return false;
    list.push(name);
    this.commit();
    return true;
  }
  get customCols(): CustomCol[] { return this.data.customCols || []; }
  /** Adds a column to the activation log. The key is derived from the label but prefixed and
   *  uniquified, so two columns named the same do not overwrite each other's values. */
  addCustomCol(label: string, kind: CustomCol["kind"]): string | null {
    label = (label || "").trim();
    if (!label) return null;
    const list = (this.data.customCols = this.data.customCols || []);
    if (list.some((c) => c.label.toLowerCase() === label.toLowerCase())) return null;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "col";
    let key = `c_${slug}`;
    for (let i = 2; list.some((c) => c.key === key); i++) key = `c_${slug}_${i}`;
    list.push({ key, label, kind });
    this.log("roadmap", "Column added", `${label} (${kind})`);
    this.commit();
    return key;
  }
  /** Drops the column and the values under it. Confirmed in the UI, because the values go too. */
  removeCustomCol(key: string) {
    this.data.customCols = this.customCols.filter((c) => c.key !== key);
    this.pilots.forEach((p) => { if (p.custom) delete p.custom[key]; });
    this.commit();
  }
  /** Bugs carry which layer the fault is in; features do not. */
  setRequestIssueType(id: string, value: string) {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    f.issueType = (value || "").trim() || null;
    f.updatedAt = new Date().toISOString();
    this.commit();
  }

  private remoteState() {
    return {
      roadmaps: this.data.roadmaps,
      activeId: this.data.activeId,
      roster: this.data.roster,
      activity: this.data.activity,
      adminUrl: this.data.adminUrl,
      uiuxUrl: this.data.uiuxUrl,
      features: this.data.features,
      pilots: this.data.pilots,
      seeded: this.data.seeded,
      pilotCategories: this.data.pilotCategories,
      colOptions: this.data.colOptions,
      customCols: this.data.customCols,
    };
  }
  private persist() {
    if (firebaseEnabled) {
      /* Firestore writes are async and debounced, so between an edit and the flush there is a
         window where the only record of it is in memory. Every nav link here is a plain <a>,
         which tears that window down: the edit was lost and the older server copy loaded back.
         So mirror to localStorage synchronously first. It costs nothing and it is what makes
         the outbox below able to recover the edit on the next load. */
      try { this.writeLocal(); localStorage.setItem(PENDING_KEY, new Date().toISOString()); } catch {}
      this.setSaveState("saving");
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => { this.flush(); }, 400);
      return;
    }
    try {
      this.writeLocal();
    } catch { /* handled by persistStrict for writes that can legitimately be too big */ }
  }
  /** Send the pending state to Firestore and clear the unflushed marker. */
  private flush() {
    if (!firebaseEnabled) return;
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    saveRemote(this.remoteState())
      .then((ok) => {
        /* Only a save that actually landed clears the marker. Clearing it on a refused write
           threw away the one record that the edit had not reached the server. */
        if (ok) { try { localStorage.removeItem(PENDING_KEY); } catch {} }
        this.setSaveState(ok ? "saved" : "failed");
      })
      .catch(() => this.setSaveState("failed"));
  }
  /** Flush on the way out. `pagehide` is the one event that fires reliably for a normal
   *  navigation, a back/forward and a tab close; `visibilitychange` covers switching away on
   *  mobile, where pagehide can be skipped entirely. */
  private watchUnload() {
    if (typeof window === "undefined" || !firebaseEnabled) return;
    const out = () => { if (this.saveTimer) this.flush(); };
    window.addEventListener("pagehide", out);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") out(); });
  }
  private writeLocal() {
    {
      localStorage.setItem(ROADMAPS_KEY, JSON.stringify({
        activeId: this.data.activeId, roadmaps: this.data.roadmaps, activity: this.data.activity,
        adminUrl: this.data.adminUrl, uiuxUrl: this.data.uiuxUrl,
        features: this.data.features, pilots: this.data.pilots, seeded: this.data.seeded,
        pilotCategories: this.data.pilotCategories,
        colOptions: this.data.colOptions, customCols: this.data.customCols,
      }));
      localStorage.setItem(ROSTER_KEY, JSON.stringify(this.data.roster));
    }
  }
  /** Writes and tells you whether it worked. Everything that can legitimately overflow the
   *  quota (screenshots) goes through this so it can undo itself instead of failing quietly. */
  private persistStrict(): boolean {
    if (firebaseEnabled) { this.persist(); return true; }
    try { this.writeLocal(); return true; } catch { return false; }
  }
  private commit() {
    this.persist();
    this.notify();
  }

  /* ---- local snapshots ---- */
  /** Keeps the last few whole-state copies under their own key, so a reset, a bad import or
   *  a re-seed is recoverable. Silent by design: it must never interrupt an edit. */
  snapshot(reason: string) {
    if (typeof window === "undefined") return;
    try {
      const list = this.snapshots();
      const state = JSON.stringify(this.exportState());
      // Nothing changed since the last one: a second identical copy buys nothing.
      if (list[0] && list[0].state === state) return;
      list.unshift({ at: new Date().toISOString(), reason, state });
      localStorage.setItem(SNAP_KEY, JSON.stringify(list.slice(0, SNAP_MAX)));
    } catch { /* quota or private mode: a missing snapshot must not block the edit */ }
  }
  snapshots(): { at: string; reason: string; state: string }[] {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || "[]"); } catch { return []; }
  }
  clearSnapshots() {
    try { localStorage.removeItem(SNAP_KEY); } catch {}
    this.notify();
  }
  restoreSnapshot(at: string): boolean {
    const hit = this.snapshots().find((x) => x.at === at);
    if (!hit) return false;
    this.snapshot("before restoring a snapshot");
    return this.importState(hit.state, true);
  }

  /* ---- backup ---- */
  exportState() {
    return {
      kind: "stackback-roadmap-backup", version: 1, at: new Date().toISOString(),
      activeId: this.data.activeId, roadmaps: this.data.roadmaps, roster: this.data.roster,
      activity: this.data.activity, features: this.data.features, pilots: this.data.pilots,
      seeded: this.data.seeded, adminUrl: this.data.adminUrl, uiuxUrl: this.data.uiuxUrl,
    };
  }
  /** Replaces everything. Validates first: a malformed file must fail loudly rather than
   *  half-apply and leave the board in a state nobody can explain. */
  importState(json: string, skipSnapshot = false): boolean {
    let p: Record<string, unknown>;
    try { p = JSON.parse(json); } catch { return false; }
    const roadmaps = p.roadmaps as Roadmap[] | undefined;
    if (!Array.isArray(roadmaps) || !roadmaps.length || !roadmaps[0] || !Array.isArray(roadmaps[0].tasks)) return false;
    if (!skipSnapshot) this.snapshot("before importing a backup");
    roadmaps.forEach((r) => (r.tasks = (r.tasks || []).map(stampIds)));
    this.data.roadmaps = roadmaps;
    this.data.activeId = (p.activeId as string) || roadmaps[0].id;
    if (p.roster && (p.roster as Roster).Engineering) this.data.roster = p.roster as Roster;
    this.data.activity = Array.isArray(p.activity) ? (p.activity as Activity[]) : [];
    this.data.features = Array.isArray(p.features) ? (p.features as Feature[]) : [];
    this.data.pilots = Array.isArray(p.pilots) ? (p.pilots as PilotStore[]) : [];
    this.data.seeded = (p.seeded as { features?: boolean; pilots?: boolean }) || {};
    if (p.adminUrl) this.data.adminUrl = p.adminUrl as string;
    if (p.uiuxUrl) this.data.uiuxUrl = p.uiuxUrl as string;
    this.resetUiScopes();
    this.rebuildHelpers();
    this.commit();
    return true;
  }
  /** Counts for the Settings readout, so "is my data here" is answerable without a console. */
  stateSummary() {
    const count = (ns: Node[]): number => ns.reduce((a, n) => a + 1 + count(n.children || []), 0);
    const done = (ns: Node[]): number => ns.reduce((a, n) => a + (n.status === "done" ? 1 : 0) + done(n.children || []), 0);
    const t = this.tasks;
    return { tasks: count(t), done: done(t), features: this.features.length, pilots: this.pilots.length };
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

  /* ---- admin UI ---- */
  get adminUrl(): string {
    const v = this.data.adminUrl;
    // Browsers that saved the old localhost address would keep a dead link forever.
    if (!v || /localhost:4340/.test(v)) return DEFAULT_ADMIN_URL;
    return v;
  }
  setAdminUrl(url: string) {
    this.data.adminUrl = (url || "").trim() || DEFAULT_ADMIN_URL;
    this.commit();
  }
  get uiuxUrl(): string {
    return this.data.uiuxUrl || DEFAULT_UIUX_URL;
  }
  setUiuxUrl(url: string) {
    this.data.uiuxUrl = (url || "").trim() || DEFAULT_UIUX_URL;
    this.commit();
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
      if (detail === undefined) delete head.detail; else head.detail = detail;
      return;
    }
    /* Keys are omitted rather than set to undefined. Firestore refuses a document holding an
       undefined value and throws out of setDoc synchronously, which took the whole save with
       it: one logged add and nothing saved again for the rest of the session. */
    const entry: Activity = { id: uid("a_"), at: now, who: this.who, kind, title };
    if (detail !== undefined) entry.detail = detail;
    if (nodeId !== undefined) entry.nodeId = nodeId;
    this.data.activity.unshift(entry);
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


  /* ---- features ---- */
  get features(): Feature[] {
    return this.data.features || [];
  }
  featuresIn(band: FeatureBand): Feature[] {
    return this.features.filter((f) => f.band === band);
  }
  /** The roadmap task delivering a feature, repairing a stale id in passing. */
  featureTask(f: Feature): Node | null {
    if (f.taskId) {
      const byId = this.find(f.taskId);
      if (byId) return byId;
    }
    if (f.taskTitle) {
      const byTitle = this.findByTitle(f.taskTitle);
      if (byTitle) { f.taskId = byTitle.id; return byTitle; }
    }
    return null;
  }
  /** Board status when linked, otherwise null. This is the sync: a linked feature reports
   *  where the work actually is, not what the sheet last said. */
  featureBoardStatus(f: Feature): string | null {
    const t = this.featureTask(f);
    return t ? boardStatusOf(t) : null;
  }
  featureStatus(f: Feature): string {
    /* A feature the sheet records as Done stays Done. Most features map to a milestone
       broader than themselves (Flash sale sits under the widgets milestone), so taking the
       milestone's rolled-up status would un-ship things that actually shipped. The board
       is the authority for work in flight, not for work already delivered. */
    if ((f.sheetStatus || "").toLowerCase() === "done") return "Done";
    return this.featureBoardStatus(f) || f.sheetStatus || "Not started";
  }
  featureDrifted(f: Feature): boolean {
    if ((f.sheetStatus || "").toLowerCase() === "done") return false;
    return isDrifted(f, this.featureBoardStatus(f));
  }
  /** Merchant requests logged from the Pilots module. Same records as the Features
   *  module's merchant block, so CS and PM read one list rather than two. */
  get requests(): Feature[] {
    return this.features.filter((f) => f.band === "merchant");
  }
  addRequest(storeId: string, title: string, kind: "feature" | "bug", urgency: string): string | null {
    title = (title || "").trim();
    if (!title) return null;
    const store = this.pilots.find((p) => p.id === storeId);
    const f: Feature = {
      id: uid("f_"), ref: "", band: "merchant", title,
      priority: null, sheetStatus: "Not started", requestedBy: store ? store.name : this.me || null,
      effort: null, urgency: urgency || null, importance: null, team: null,
      objective: null, nextSteps: null, blockers: null,
      taskId: null, taskTitle: null,
      storeId: store ? store.id : null, storeName: store ? store.name : null,
      kind, updatedAt: new Date().toISOString(),
    };
    this.data.features.push(f);
    this.log("add", title, store ? `${kind} from ${store.name}` : kind, undefined);
    this.commit();
    return f.id;
  }
  /** A merchant ask we have decided to build becomes planned work: it leaves the merchant
   *  block for Upcoming, keeping the store attached so you can still see who asked and tell
   *  them when it ships. It stays reachable in Requests behind the "moved to features"
   *  toggle rather than vanishing on whoever logged it. */
  moveRequestToFeatures(id: string): boolean {
    const f = this.features.find((x) => x.id === id);
    if (!f || f.band !== "merchant") return false;
    f.band = "upcoming";
    f.updatedAt = new Date().toISOString();
    this.log("status", f.title, `moved to features${f.storeName ? ` (asked for by ${f.storeName})` : ""}`, undefined);
    this.commit();
    return true;
  }
  /** Requests that were promoted: no longer merchant-band, but still carrying their store. */
  get promotedRequests(): Feature[] {
    return this.features.filter((f) => f.band !== "merchant" && !!f.storeId);
  }
  setRequestStore(id: string, storeId: string | null) {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    const store = storeId ? this.pilots.find((p) => p.id === storeId) : null;
    f.storeId = store ? store.id : null;
    f.storeName = store ? store.name : null;
    if (store) f.requestedBy = store.name;
    f.updatedAt = new Date().toISOString();
    this.commit();
  }
  /** One pass over a selection, one write, one activity row. Doing it per row would fire a
   *  save and a log line each time, which is both slower and unreadable in the log. */
  bulkRequests(ids: string[], patch: { kind?: "feature" | "bug"; status?: string; urgency?: string; issueType?: string }): number {
    const set = new Set(ids);
    let n = 0;
    this.features.forEach((f) => {
      if (!set.has(f.id)) return;
      if (patch.kind) f.kind = patch.kind;
      if (patch.status) f.sheetStatus = patch.status;
      if (patch.urgency !== undefined) f.urgency = patch.urgency || null;
      if (patch.issueType !== undefined) f.issueType = patch.issueType || null;
      f.updatedAt = new Date().toISOString();
      n++;
    });
    if (!n) return 0;
    const what = Object.entries(patch).map(([k, v]) => `${k} ${v || "cleared"}`).join(", ");
    this.log("status", `${n} request(s)`, what);
    this.commit();
    return n;
  }
  /** Deletes a selection. Confirmed by the caller, since there is no undo. */
  bulkDeleteRequests(ids: string[]): number {
    const set = new Set(ids);
    const before = this.data.features.length;
    this.data.features = this.data.features.filter((f) => !set.has(f.id));
    const n = before - this.data.features.length;
    if (n) { this.log("delete", `${n} request(s)`, "deleted together"); this.commit(); }
    return n;
  }
  setRequestKind(id: string, kind: "feature" | "bug") {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    f.kind = kind;
    f.updatedAt = new Date().toISOString();
    this.commit();
  }
  /** The Requests tab owns a plain three-value status. It answers "have we picked this up",
   *  which is a different question from how far the delivery has got on the board, and the
   *  board answer still shows beside it. */
  setRequestStatus(id: string, status: string) {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    f.sheetStatus = status || null;
    f.updatedAt = new Date().toISOString();
    this.log("status", f.title, status || "cleared", undefined);
    this.commit();
  }
  setRequestUrgency(id: string, urgency: string) {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    f.urgency = urgency || null;
    f.updatedAt = new Date().toISOString();
    this.commit();
  }
  /** Attach seeded merchant rows to a store record. The sheet's "requested by" column mixes
   *  store names, abbreviations and internal people, so match on the store name first, then
   *  known abbreviations, then a containment check. Anything left is an internal request and
   *  correctly stays unattached rather than being guessed at. */
  linkRequestStoresOnce() {
    const ALIAS: Record<string, string> = { tbw: "The Basics Woman", arusha: "Arusha Foods", milld: "MillD" };
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    let n = 0;
    this.requests.forEach((f) => {
      if (f.storeId) return;
      const raw = (f.storeName || f.requestedBy || "").trim();
      if (!raw) return;
      const key = norm(raw);
      let hit = this.pilots.find((p) => norm(p.name) === key);
      if (!hit && ALIAS[key]) hit = this.pilots.find((p) => p.name === ALIAS[key]);
      if (!hit && key.length > 3) {
        hit = this.pilots.find((p) => norm(p.name).startsWith(key) || key.startsWith(norm(p.name)));
      }
      if (hit) { f.storeId = hit.id; f.storeName = hit.name; n++; }
    });
    if (n) this.persist();
    return n;
  }

  /* ---- screenshots ---- */
  shotBytesUsed(): number {
    return this.features.reduce((a, f) => a + (f.shots || []).reduce((b, s2) => b + (s2.bytes || 0), 0), 0);
  }
  /** Adds a screenshot, or explains exactly why it could not. Rolls the image back out of
   *  state if the write is refused, so a rejected upload never costs the surrounding edits. */
  addShot(featureId: string, name: string, src: string, bytes: number): { ok: boolean; error?: string } {
    const f = this.features.find((x) => x.id === featureId);
    if (!f) return { ok: false, error: "That request no longer exists." };
    f.shots = f.shots || [];
    if (f.shots.length >= SHOT_MAX_PER_REQUEST) {
      return { ok: false, error: `Up to ${SHOT_MAX_PER_REQUEST} screenshots per request.` };
    }
    const projected = this.shotBytesUsed() + bytes;
    if (projected > SHOT_TOTAL_BUDGET) {
      return { ok: false, error: `That would take screenshots to ${fmtBytes(projected)}, past the ${fmtBytes(SHOT_TOTAL_BUDGET)} budget for this browser. Delete a few first, or wait for the shared backend.` };
    }
    const shot: Shot = { id: uid("s_"), name: name.slice(0, 80), src, at: new Date().toISOString(), bytes };
    f.shots.push(shot);
    if (!this.persistStrict()) {
      f.shots = f.shots.filter((x) => x.id !== shot.id);
      this.persist();
      return { ok: false, error: "This browser's storage is full, so the screenshot was not saved. Nothing else was lost. Download a backup and clear some screenshots." };
    }
    f.updatedAt = new Date().toISOString();
    this.log("comment", f.title, `screenshot: ${shot.name}`, undefined);
    this.notify();
    return { ok: true };
  }
  /** A hosted image, pasted as a URL. Costs nothing against the storage budget, which is
   *  why it is the better default once a team has somewhere to put images. */
  addShotLink(featureId: string, url: string): { ok: boolean; error?: string } {
    const f = this.features.find((x) => x.id === featureId);
    if (!f) return { ok: false, error: "That request no longer exists." };
    const clean = (url || "").trim();
    if (!/^https?:\/\//i.test(clean)) return { ok: false, error: "Paste a full link starting with http:// or https://" };
    f.shots = f.shots || [];
    if (f.shots.length >= SHOT_MAX_PER_REQUEST) {
      return { ok: false, error: `Up to ${SHOT_MAX_PER_REQUEST} images per request.` };
    }
    let name = clean;
    try { name = decodeURIComponent(new URL(clean).pathname.split("/").pop() || clean); } catch {}
    f.shots.push({ id: uid("s_"), name: name.slice(0, 80), src: clean, at: new Date().toISOString(), bytes: 0 });
    f.updatedAt = new Date().toISOString();
    this.log("comment", f.title, `image link: ${name}`, undefined);
    this.commit();
    return { ok: true };
  }
  delShot(featureId: string, shotId: string) {
    const f = this.features.find((x) => x.id === featureId);
    if (!f || !f.shots) return;
    f.shots = f.shots.filter((x) => x.id !== shotId);
    f.updatedAt = new Date().toISOString();
    this.commit();
  }

  addFeature(title: string, band: FeatureBand, ref = ""): string | null {
    title = (title || "").trim();
    if (!title) return null;
    const f: Feature = {
      id: uid("f_"), ref: ref.trim(), band, title,
      priority: null, sheetStatus: "Not started", requestedBy: this.me || null,
      effort: null, urgency: null, importance: null, team: null,
      objective: null, nextSteps: null, blockers: null,
      taskId: null, taskTitle: null, updatedAt: new Date().toISOString(),
    };
    const hit = matchTask(f, this.tasks);
    if (hit) { f.taskId = hit.id; f.taskTitle = hit.title; }
    this.data.features.push(f);
    this.log("add", title, "feature", undefined);
    this.commit();
    return f.id;
  }
  setFeatureField(id: string, field: "title" | "ref" | "priority" | "sheetStatus" | "requestedBy" | "effort" | "objective" | "nextSteps" | "blockers", value: string) {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    const v = (value || "").trim();
    if (field === "title") { if (!v) return; f.title = v; }
    else (f as unknown as Record<string, string | null>)[field] = v || null;
    f.updatedAt = new Date().toISOString();
    this.commit();
  }
  linkFeature(id: string, taskId: string | null) {
    const f = this.features.find((x) => x.id === id);
    if (!f) return;
    const t = taskId ? this.find(taskId) : null;
    f.taskId = t ? t.id : null;
    f.taskTitle = t ? t.title : null;
    f.updatedAt = new Date().toISOString();
    this.log("status", f.title, t ? `linked to ${t.title}` : "unlinked", t ? t.id : undefined);
    this.commit();
  }
  delFeature(id: string) {
    const f = this.features.find((x) => x.id === id);
    if (f) this.log("delete", f.title, "feature", undefined);
    this.data.features = this.features.filter((x) => x.id !== id);
    this.commit();
  }
  /** Promote a feature straight onto the roadmap: creates the milestone in the chosen
   *  horizon, carries the feature's objective across as its first subtask when there is
   *  one, and links the two so the feature's status starts following the board. */
  moveFeatureToBoard(id: string, priority: number): boolean {
    const f = this.features.find((x) => x.id === id);
    if (!f || this.featureTask(f)) return false;
    const kids = f.objective ? [stampIds({ id: "", title: f.objective.slice(0, 160), status: "planned" as Status, assignees: [], children: [] })] : [];
    const task: Node = stampIds({
      id: "", title: f.title, status: "planned", assignees: [], children: kids, priority,
    });
    if (f.band === "merchant") task.note = `Asked for by ${f.storeName || f.requestedBy || "a merchant"}`;
    this.tasks.push(task);
    f.taskId = task.id;
    f.taskTitle = task.title;
    f.updatedAt = new Date().toISOString();
    this.log("add", task.title, `moved to ${waveWord(priority)} from features`, task.id);
    this.commit();
    return true;
  }
  relinkAllFeatures(): number {
    const n = autoLink(this.features, this.tasks);
    if (n) this.commit();
    return n;
  }
  findByTitle(title: string): Node | null {
    let hit: Node | null = null;
    const walk = (ns: Node[]) => ns.forEach((n) => { if (!hit && n.title === title) hit = n; walk(n.children || []); });
    walk(this.tasks);
    return hit;
  }

  /* ---- pilots ---- */
  get pilots(): PilotStore[] {
    return this.data.pilots || [];
  }
  setPilotField(id: string, field: keyof PilotStore | string, value: string) {
    const p = this.pilots.find((x) => x.id === id);
    if (!p) return;
    if (String(field).startsWith("c_")) {
      const bag = (p.custom = p.custom || {});
      bag[String(field)] = (value || "").trim() || null;
      this.commit();
      return;
    }
    const numeric = ["totalSubs", "activeSubs", "oneTimeBundles", "prepaidSubs", "openBugs"];
    const v = (value || "").trim();
    if (numeric.includes(field as string)) {
      (p as unknown as Record<string, number | null>)[field as string] = v ? Number(v) : null;
    } else {
      (p as unknown as Record<string, string | null>)[field as string] = v || null;
    }
    this.commit();
  }
  addPilot(name: string): string | null {
    name = (name || "").trim();
    if (!name) return null;
    const n = this.pilots.reduce((a, p) => Math.max(a, p.n), 0) + 1;
    this.data.pilots.push({ id: uid("p_"), n, name });
    this.log("add", name, "pilot store", undefined);
    this.commit();
    return name;
  }
  delPilot(id: string) {
    const p = this.pilots.find((x) => x.id === id);
    if (p) this.log("delete", p.name, "pilot store", undefined);
    this.data.pilots = this.pilots.filter((x) => x.id !== id);
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
    if (["timeline","simple","teams","board","features","pilots"].includes(v || "")) this.ui.view = v as ViewId;
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
    const el = document.documentElement;
    if (this.ui.theme === "auto") el.removeAttribute("data-theme");
    else el.setAttribute("data-theme", this.ui.theme);
    if (this.ui.palette && this.ui.palette !== "lime") el.setAttribute("data-palette", this.ui.palette);
    else el.removeAttribute("data-palette");
    try {
      localStorage.setItem(THEME_KEY, this.ui.theme);
      localStorage.setItem(PALETTE_KEY, this.ui.palette);
    } catch {}
  }
  setPalette(id: string) {
    this.ui.palette = id || "lime";
    this.applyTheme();
    this.notify();
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
    this.snapshot("before deleting a roadmap");
    const r = this.data.roadmaps.find((x) => x.id === id);
    if (r) this.log("roadmap", r.name, "deleted");
    this.data.roadmaps = this.data.roadmaps.filter((x) => x.id !== id);
    if (this.data.activeId === id) this.data.activeId = this.data.roadmaps[0].id;
    this.commit();
  }
  resetActive() {
    this.snapshot("before resetting the roadmap");
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
