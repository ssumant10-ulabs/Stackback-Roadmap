import type { Activity, CustomCol, Feature, PilotStore, Roadmap, Roster } from "./types";
import { fbDb, firebaseEnabled } from "./firebase";
import {
  doc, getDoc, onSnapshot, runTransaction, type Unsubscribe,
} from "firebase/firestore";
import { mergeField, mergeList, mergeLog, mergeMap } from "./merge";
import type { Node } from "./types";

/** Shared state lives in Firestore under `app/{roadmap|features|pilots}`.
 *
 *  Three documents rather than one, because Firestore caps a document at 1 MB and a single
 *  blob would eventually hit it as the activity log and the two lists grow. Splitting also
 *  means a pilot edit does not rewrite the whole roadmap on every keystroke.
 *
 *  Screenshots do NOT live here: they go to Firebase Storage and only their URL is stored. */
export interface RemoteState {
  roadmaps: Roadmap[];
  activeId: string;
  roster: Roster;
  activity: Activity[];
  features: Feature[];
  pilots: PilotStore[];
  seeded?: { features?: boolean; pilots?: boolean; dates?: boolean };
  pilotCategories?: string[];
  colOptions?: Record<string, string[]>;
  colOrder?: Record<string, string[]>;
  colRemoved?: Record<string, string[]>;
  colColors?: Record<string, Record<string, string>>;
  customCols?: CustomCol[];
  adminUrl?: string;
  uiuxUrl?: string;
  /** When the server copy was last written. Used to decide whether an edit recovered from
   *  this browser is newer than what the team has since saved. */
  updatedAt?: string | null;
  /** Revision of each document as of this copy. A write carries the revision it was based
   *  on; the server rejects nothing, but a mismatch means somebody else wrote in between and
   *  the incoming change is merged onto theirs rather than over them. */
  revs?: Record<string, number>;
}

export const ACTIVITY_CAP = 300;

/** Identifies this tab for the lifetime of the page. Written with every save so the live
 *  listener can ignore the echo of our own write, which would otherwise clobber whatever was
 *  typed in the moment since. */
export const CLIENT_ID = "c_" + Math.random().toString(36).slice(2, 10);

export { firebaseEnabled };

const COL = "app";
const DOCS = { roadmap: "roadmap", features: "features", pilots: "pilots" } as const;

type Bag = Record<string, unknown>;
const ref = (name: string) => { const db = fbDb(); return db ? doc(db, COL, name) : null; };

/** Split the client's single state object across the three documents. */
export function split(s: RemoteState): Record<string, Bag> {
  return {
    [DOCS.roadmap]: {
      roadmaps: s.roadmaps, activeId: s.activeId, roster: s.roster, activity: s.activity,
      adminUrl: s.adminUrl ?? null, uiuxUrl: s.uiuxUrl ?? null,
    },
    [DOCS.features]: { features: s.features, seeded: s.seeded ?? {} },
    [DOCS.pilots]: {
      pilots: s.pilots, pilotCategories: s.pilotCategories ?? [],
      colOptions: s.colOptions ?? {}, colOrder: s.colOrder ?? {}, colRemoved: s.colRemoved ?? {},
      colColors: s.colColors ?? {},
      customCols: s.customCols ?? [],
    },
  };
}

function merge(r: Bag, f: Bag, p: Bag): RemoteState | null {
  const roadmaps = (r.roadmaps as Roadmap[]) || [];
  if (!Array.isArray(roadmaps) || !roadmaps.length) return null;
  return {
    roadmaps,
    activeId: (r.activeId as string) || roadmaps[0].id,
    roster: r.roster as Roster,
    activity: (r.activity as Activity[]) || [],
    adminUrl: (r.adminUrl as string) || undefined,
    uiuxUrl: (r.uiuxUrl as string) || undefined,
    features: (f.features as Feature[]) || [],
    pilots: (p.pilots as PilotStore[]) || [],
    updatedAt: (r.updatedAt as string) || null,
    seeded: (f.seeded as RemoteState["seeded"]) || {},
    pilotCategories: (p.pilotCategories as string[]) || [],
    colOptions: (p.colOptions as Record<string, string[]>) || {},
    colOrder: (p.colOrder as Record<string, string[]>) || {},
    colRemoved: (p.colRemoved as Record<string, string[]>) || {},
    colColors: (p.colColors as Record<string, Record<string, string>>) || {},
    customCols: (p.customCols as CustomCol[]) || [],
    revs: {
      [DOCS.roadmap]: (r.rev as number) || 0,
      [DOCS.features]: (f.rev as number) || 0,
      [DOCS.pilots]: (p.rev as number) || 0,
    },
  };
}

/* ---- three-way merge, one shape per document ---------------------------------------- */

/** Roadmaps merge at the card level, not the board level: two people working different cards
 *  on the same board both keep their work. Inside one card the whole card is taken from
 *  whoever touched it, which is where this stops. */
function mergeRoadmaps(server: Roadmap[], base: Roadmap[], mine: Roadmap[]): Roadmap[] {
  const bmap = new Map(base.map((r) => [r.id, r]));
  const smap = new Map(server.map((r) => [r.id, r]));
  const mmap = new Map(mine.map((r) => [r.id, r]));
  return mergeList(server, base, mine).map((r) => {
    const b = bmap.get(r.id), sv = smap.get(r.id), m = mmap.get(r.id);
    if (!b || !sv || !m) return r;
    return { ...r, tasks: mergeList<Node>(sv.tasks || [], b.tasks || [], m.tasks || []) };
  });
}

export function mergeDoc(name: string, server: Bag, base: Bag, mine: Bag): Bag {
  const L = <T,>(k: string) => [(server[k] as T[]) || [], (base[k] as T[]) || [], (mine[k] as T[]) || []] as const;
  if (name === DOCS.roadmap) {
    const [sr, br, mr] = L<Roadmap>("roadmaps");
    return {
      roadmaps: mergeRoadmaps(sr, br, mr),
      activeId: mergeField(server.activeId, base.activeId, mine.activeId),
      roster: mergeField(server.roster, base.roster, mine.roster),
      activity: mergeLog<Activity>(
        (server.activity as Activity[]) || [], (mine.activity as Activity[]) || [],
        (e) => e.at, ACTIVITY_CAP,
      ),
      adminUrl: mergeField(server.adminUrl, base.adminUrl, mine.adminUrl) ?? null,
      uiuxUrl: mergeField(server.uiuxUrl, base.uiuxUrl, mine.uiuxUrl) ?? null,
    };
  }
  if (name === DOCS.features) {
    const [sf, bf, mf] = L<Feature>("features");
    return {
      features: mergeList(sf, bf, mf),
      seeded: mergeField(server.seeded, base.seeded, mine.seeded) ?? {},
    };
  }
  const [sp, bp, mp] = L<PilotStore>("pilots");
  const [sc, bc, mc] = L<CustomCol>("customCols");
  const M = (k: string) => mergeMap(
    server[k] as Record<string, never>, base[k] as Record<string, never>, mine[k] as Record<string, never>,
  );
  return {
    pilots: mergeList(sp, bp, mp),
    customCols: mergeList(sc.map((c) => ({ ...c, id: c.key })), bc.map((c) => ({ ...c, id: c.key })),
      mc.map((c) => ({ ...c, id: c.key }))).map(({ id: _id, ...c }) => c),
    pilotCategories: mergeField(server.pilotCategories, base.pilotCategories, mine.pilotCategories) ?? [],
    colOptions: M("colOptions"), colOrder: M("colOrder"),
    colRemoved: M("colRemoved"), colColors: M("colColors"),
  };
}

export async function loadRemote(): Promise<RemoteState | null> {
  if (!firebaseEnabled) return null;
  try {
    const [r, f, p] = await Promise.all(
      [DOCS.roadmap, DOCS.features, DOCS.pilots].map(async (n) => {
        const d = ref(n);
        if (!d) return {};
        const snap = await getDoc(d);
        return snap.exists() ? (snap.data() as Bag) : {};
      }),
    );
    return merge(r, f, p);
  } catch (e) {
    console.warn("Firestore load failed:", (e as Error).message);
    return null;
  }
}

/** Writes this client's changes and returns what the server now holds.
 *
 *  `base` is the copy this client last agreed with the server on. Everything is decided by
 *  comparing against it: the write carries only the difference, replayed inside a
 *  transaction onto whatever is there at that moment. That is the whole fix. The old version
 *  sent the client's entire state with setDoc, so a tab holding a stale copy rewrote the
 *  server back to it, and a deploy is precisely when stale tabs are everywhere.
 *
 *  Each write is isolated. setDoc validates its argument synchronously and throws rather
 *  than rejecting, so calling all three from one map() meant a bad first document aborted
 *  the loop and the other two were never sent.
 *
 *  Returns false rather than throwing, so a failure here cannot abort a caller mid-hydrate.
 *  The caller keeps its unflushed marker on false, which is what makes the edit recoverable. */
export async function saveRemote(
  state: RemoteState, base: RemoteState | null,
): Promise<{ ok: boolean; state: RemoteState | null }> {
  if (!firebaseEnabled) return { ok: true, state: null };
  const db = fbDb();
  if (!db) return { ok: true, state: null };
  const mineParts = split(state);
  const baseParts = base ? split(base) : null;
  const written: Record<string, Bag> = {};
  const revs: Record<string, number> = {};
  const failed: string[] = [];

  await Promise.all(Object.entries(mineParts).map(async ([name, mine]) => {
    const d = ref(name);
    if (!d) return;
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(d);
        const server = (snap.exists() ? snap.data() : null) as Bag | null;
        const serverRev = (server?.rev as number) || 0;
        const baseRev = base?.revs?.[name];
        /* Same revision means nothing happened since we last agreed, so our copy is already
           built on the server's. Otherwise somebody wrote in between and only our own
           differences go on top of theirs. */
        const body = !server || (baseRev !== undefined && serverRev === baseRev)
          ? mine
          : mergeDoc(name, server, baseParts?.[name] || {}, mine);
        tx.set(d, {
          ...body, rev: serverRev + 1, updatedBy: CLIENT_ID, updatedAt: new Date().toISOString(),
        }, { merge: true });
        written[name] = body;
        revs[name] = serverRev + 1;
      });
    } catch (e) {
      failed.push(name);
      console.warn(`Firestore save failed (${name}):`, (e as Error).message);
    }
  }));

  if (failed.length) return { ok: false, state: null };
  const out = merge(written[DOCS.roadmap] || {}, written[DOCS.features] || {}, written[DOCS.pilots] || {});
  if (out) out.revs = revs;
  return { ok: true, state: out };
}

/** Live updates. Fires when any of the three documents changes elsewhere; our own writes are
 *  filtered by client id so adopting a remote change never echoes back into a save loop.
 *
 *  A dropped listener used to be a console warning and nothing else. That tab then sat on a
 *  copy that stopped moving while everyone else edited, and its next save wrote that copy
 *  back over them. The merge above makes that survivable; resubscribing makes it rare. */
export function subscribeRemote(onChange: (s: RemoteState) => void): (() => void) | null {
  if (!firebaseEnabled) return null;
  const latest: Record<string, Bag> = {};
  const unsubs = new Map<string, Unsubscribe>();
  let closed = false;

  const listen = (name: string, attempt = 0) => {
    if (closed) return;
    const d = ref(name);
    if (!d) return;
    unsubs.set(name, onSnapshot(d, (snap) => {
      attempt = 0;
      const data = snap.exists() ? (snap.data() as Bag) : {};
      latest[name] = data;
      if (data.updatedBy === CLIENT_ID) return;       // our own write coming back
      if (snap.metadata.hasPendingWrites) return;     // not yet acknowledged by the server
      const merged = merge(latest[DOCS.roadmap] || {}, latest[DOCS.features] || {}, latest[DOCS.pilots] || {});
      if (merged) onChange(merged);
    }, (e) => {
      console.warn(`Firestore listen failed (${name}), reconnecting:`, e.message);
      unsubs.delete(name);
      const wait = Math.min(30_000, 1000 * 2 ** attempt);
      setTimeout(() => listen(name, attempt + 1), wait);
    }));
  };

  for (const name of [DOCS.roadmap, DOCS.features, DOCS.pilots]) listen(name);
  return () => { closed = true; unsubs.forEach((u) => u()); unsubs.clear(); };
}
