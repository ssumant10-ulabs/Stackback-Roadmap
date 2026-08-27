import type { Activity, Roadmap, Roster } from "./types";
import { supabase, supabaseEnabled } from "./supabase";

/** The whole app state is stored as a single JSONB row (id = 1) in `app_state`.
 *  This mirrors the localStorage blob 1:1, so it's a drop-in shared backend.
 *  Normalizing into per-node rows (for granular realtime) is a later optimization. */
export interface RemoteState {
  roadmaps: Roadmap[];
  activeId: string;
  roster: Roster;
  activity: Activity[];
}

/** Identifies this browser tab for the lifetime of the page. Written alongside every
 *  save so the realtime listener can ignore the echo of our own write, which would
 *  otherwise clobber whatever the user typed in the 400ms since. */
export const CLIENT_ID = "c_" + Math.random().toString(36).slice(2, 10);

export { supabaseEnabled };

export async function loadRemote(): Promise<RemoteState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("app_state").select("roadmaps, active_id, roster, activity").eq("id", 1).maybeSingle();
  if (error) { console.warn("Supabase load failed:", error.message); return null; }
  if (!data || !Array.isArray(data.roadmaps) || !data.roadmaps.length) return null;
  return {
    roadmaps: data.roadmaps as Roadmap[],
    activeId: data.active_id as string,
    roster: data.roster as Roster,
    activity: (data.activity as Activity[]) || [],
  };
}

export async function saveRemote(state: RemoteState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("app_state").upsert({
    id: 1,
    roadmaps: state.roadmaps,
    active_id: state.activeId,
    roster: state.roster,
    activity: state.activity,
    updated_at: new Date().toISOString(),
    updated_by: CLIENT_ID,
  });
  if (error) console.warn("Supabase save failed:", error.message);
}

/** Live updates. Needs `app_state` added to the `supabase_realtime` publication
 *  (Dashboard, Database, Replication). Without that this is simply never called and the
 *  app behaves as it did before: shared on load, not live. Returns an unsubscribe fn. */
export function subscribeRemote(onChange: (s: RemoteState) => void): (() => void) | null {
  const sb = supabase;
  if (!sb) return null;
  const ch = sb
    .channel("app_state_live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "app_state", filter: "id=eq.1" },
      (payload) => {
        const row = payload.new as Record<string, unknown> | null;
        if (!row) return;
        if (row.updated_by === CLIENT_ID) return; // our own write coming back
        if (!Array.isArray(row.roadmaps) || !row.roadmaps.length) return;
        onChange({
          roadmaps: row.roadmaps as Roadmap[],
          activeId: row.active_id as string,
          roster: row.roster as Roster,
          activity: (row.activity as Activity[]) || [],
        });
      },
    )
    .subscribe();
  return () => { sb.removeChannel(ch); };
}
