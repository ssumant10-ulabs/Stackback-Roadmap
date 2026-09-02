import type { Activity, CustomCol, Feature, PilotStore, Roadmap, Roster } from "./types";
import { fbDb, firebaseEnabled } from "./firebase";
import {
  doc, getDoc, onSnapshot, setDoc, type Unsubscribe,
} from "firebase/firestore";

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
  customCols?: CustomCol[];
  adminUrl?: string;
  uiuxUrl?: string;
  /** When the server copy was last written. Used to decide whether an edit recovered from
   *  this browser is newer than what the team has since saved. */
  updatedAt?: string | null;
}

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
function split(s: RemoteState): Record<string, Bag> {
  return {
    [DOCS.roadmap]: {
      roadmaps: s.roadmaps, activeId: s.activeId, roster: s.roster, activity: s.activity,
      adminUrl: s.adminUrl ?? null, uiuxUrl: s.uiuxUrl ?? null, updatedBy: CLIENT_ID,
      updatedAt: new Date().toISOString(),
    },
    [DOCS.features]: { features: s.features, seeded: s.seeded ?? {}, updatedBy: CLIENT_ID },
    [DOCS.pilots]: {
      pilots: s.pilots, pilotCategories: s.pilotCategories ?? [],
      colOptions: s.colOptions ?? {}, customCols: s.customCols ?? [], updatedBy: CLIENT_ID,
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
    customCols: (p.customCols as CustomCol[]) || [],
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

/** Writes the three documents and reports whether every one of them landed.
 *
 *  Each write is isolated. setDoc validates its argument synchronously and throws rather
 *  than rejecting, so calling all three from one map() meant a bad first document aborted
 *  the loop and the other two were never sent: a stray undefined in the activity log stopped
 *  pilots and requests saving at all, silently. Wrapping each in its own async function turns
 *  that throw into one rejected promise, and allSettled keeps the other two going.
 *
 *  Returns false rather than throwing, so a failure here cannot abort a caller mid-hydrate.
 *  The caller keeps its unflushed marker on false, which is what makes the edit recoverable. */
export async function saveRemote(state: RemoteState): Promise<boolean> {
  if (!firebaseEnabled) return true;
  const parts = split(state);
  const results = await Promise.allSettled(
    Object.entries(parts).map(async ([name, body]) => {
      const d = ref(name);
      if (d) await setDoc(d, body);
    }),
  );
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.warn("Firestore save failed:", (r as PromiseRejectedResult).reason?.message));
  return failed.length === 0;
}

/** Live updates. Fires when any of the three documents changes elsewhere; our own writes are
 *  filtered by client id so adopting a remote change never echoes back into a save loop. */
export function subscribeRemote(onChange: (s: RemoteState) => void): (() => void) | null {
  if (!firebaseEnabled) return null;
  const latest: Record<string, Bag> = {};
  const unsubs: Unsubscribe[] = [];

  for (const name of [DOCS.roadmap, DOCS.features, DOCS.pilots]) {
    const d = ref(name);
    if (!d) continue;
    unsubs.push(onSnapshot(d, (snap) => {
      const data = snap.exists() ? (snap.data() as Bag) : {};
      latest[name] = data;
      if (data.updatedBy === CLIENT_ID) return;       // our own write coming back
      if (snap.metadata.hasPendingWrites) return;     // not yet acknowledged by the server
      const merged = merge(latest[DOCS.roadmap] || {}, latest[DOCS.features] || {}, latest[DOCS.pilots] || {});
      if (merged) onChange(merged);
    }, (e) => console.warn("Firestore listen failed:", e.message)));
  }
  return () => unsubs.forEach((u) => u());
}
