import type { Roadmap, Roster } from "./types";
import { supabase, supabaseEnabled } from "./supabase";

/** The whole app state is stored as a single JSONB row (id = 1) in `app_state`.
 *  This mirrors the localStorage blob 1:1, so it's a drop-in shared backend.
 *  Normalizing into per-node rows (for granular realtime) is a later optimization. */
export interface RemoteState {
  roadmaps: Roadmap[];
  activeId: string;
  roster: Roster;
}

export { supabaseEnabled };

export async function loadRemote(): Promise<RemoteState | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("app_state").select("roadmaps, active_id, roster").eq("id", 1).maybeSingle();
  if (error) { console.warn("Supabase load failed:", error.message); return null; }
  if (!data || !Array.isArray(data.roadmaps) || !data.roadmaps.length) return null;
  return { roadmaps: data.roadmaps as Roadmap[], activeId: data.active_id as string, roster: data.roster as Roster };
}

export async function saveRemote(state: RemoteState): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("app_state")
    .upsert({ id: 1, roadmaps: state.roadmaps, active_id: state.activeId, roster: state.roster, updated_at: new Date().toISOString() });
  if (error) console.warn("Supabase save failed:", error.message);
}
