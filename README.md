# StackBack Roadmap

Internal team roadmap tool for StackBack. Milestones, owners, and progress across the team, with multiple product roadmaps.

Built with **Next.js 16 (App Router) · React 19 · TypeScript**. Runs on browser `localStorage` out of the box; set two Supabase env vars and the whole team shares one live roadmap (see [SUPABASE.md](./SUPABASE.md)).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

Requires Node 18+ (built and tested on Node 24).

## The four states

`Now`, `Next`, `Future`, `Done`. The three horizons are schedulable and drag-and-droppable;
**Done is derived, never authored**: a milestone reaches it when every subtask under it is
checked off, and leaves its horizon at that point. That makes the four a true partition, so
the header counts always sum to the task total.

## Views

- **Timeline**: the whole roadmap. Three layouts:
  - **Swimlanes** (default): teams as rows × the four states as columns. A task shared by two teams shows under both, each with only that team's subtasks.
  - **By wave**: a vertical Now → Done flow grouped by team.
  - **Dates**: a real Gantt. Bars come from each task's `start`/`end`; a **hollow bar** is a window rolled up from a task's subtasks rather than set on the task itself. Milestones with no dates are listed under the chart instead of taking up an empty row.
- **Overview**: the anyone-can-read screen. Toggle **Now / Next / Future / Done** ↔ **By status**; each milestone has a collapsible, plain-language breakdown grouped by team.
- **Teams & People**: toggle **By team** (each team's milestones + the exact subtasks assigned to it), **By person** (a shareable per-person worklist with progress), and **Load** (capacity bars).
- **Board**: the editing hub. Drag by the grip to move/nest, ▲▼ to reorder, add tasks and subtasks inline, assign owners, set dates, comment, delete. Checklists are **collapsed by default**; `Expand all` opens every one.

## Scheduling

Any node, milestone or subtask, takes a **start**, an **end** and a **TAT** in calendar days
(inclusive of both endpoints). Set any two and the third is derived, so "starts 1 Sep, takes
30 days" and "1 Sep to 30 Sep" are the same statement. A node without its own window inherits
an implied one from its dated descendants, which is what the Gantt draws hollow. A task whose
end date has passed while it is still open renders in the overdue colour.

## Status

A leaf cycles `planned → in progress → done`. A node **with** children shows its rolled-up
status and toggling it applies to the whole subtree: checking a milestone checks off
everything under it, clearing it reopens the subtree (behind a confirm). That is deliberate,
and it is what stops a card reading "done" while its own checklist sits at 3 of 7.

## Sharing, comments and activity

- **Share** copies a URL carrying the current view, timeline layout and filter, so a filtered board opens the same way for whoever you send it to. Back and forward move between those states.
- **Comments** thread on any milestone or subtask. Authorship comes from the name you set in **Settings → You**, stored per browser so each teammate is themselves.
- **Activity** lists recent changes newest-first, with who and when. Repeat edits of the same kind on the same node inside a minute collapse into one entry. It is capped at the most recent 300 entries because it travels inside the shared state blob.

Plus: a global **milestone + task progress** bar, a **Filter** by team/person, **Settings** to manage multiple product roadmaps (create / rename / delete / switch), and a light / dark / auto **theme** toggle.

## Project structure

```
app/
  layout.tsx, page.tsx, globals.css   # shell + full stylesheet (brand tokens, light/dark)
data/
  roadmap_tab.tsv # the roadmap sheet's Roadmap tab, verbatim (source of truth)
  gen_seed.py     # regenerates lib/seed.ts from that TSV (--diff shows what would change)
  roadmap_snapshot.json # last generated tree, so --diff has a baseline (GENERATED)
lib/
  types.ts        # domain types (Node tree, Roadmap, Assignee, Comment, Activity, ...)
  dates.ts        # ISO-day maths: start/end/TAT reconciliation, rolled-up ranges, Gantt months
  constants.ts    # roster, teams, priorities, plain-language label maps
  seed.ts         # the seeded StackBack roadmap (GENERATED, do not hand-edit)
  derive.ts       # pure helpers (subtreeCounts, effStatus, aggProgress, ...)
  teams.ts        # roster-bound helpers (teamOf, teamSet, personWork, teamWork, ...)
  store.ts        # external store (useSyncExternalStore) + all mutations + persistence
components/
  RoadmapApp.tsx  # root: hydration gate, popovers/modals, view routing
  Header, HeroMetrics, ViewRow, FilterPopover, SettingsModal, AddTaskModal,
  AssigneePopover, RosterPicker, bits, icons
  views/          # Timeline, Overview, TeamsPeople, Board, Gantt
```

## Data & persistence

Without Supabase env vars the roadmap tree lives in `localStorage` (`stackback_roadmaps_v3`),
managed by `lib/store.ts`. All views read from the same store, so an edit on the Board reflects
everywhere. Your own display name (`stackback_me_v1`) and theme stay local even with the shared
backend on, so each teammate keeps their own identity.

### Refreshing from the roadmap sheet

`lib/seed.ts` is generated from the **Roadmap tab** of `StackBack_Roadmap_Tasks_Updated.xlsx`
(Drive `1tHa3FtlnUOaCg5kH7zmUgkV2IfiUDmSb`). Never hand-edit it. To pull in sheet changes:

```bash
# 1. update data/roadmap_tab.tsv so it matches the Roadmap tab
python3 data/gen_seed.py --diff     # exactly what would change, per node and per field
python3 data/gen_seed.py --write    # rewrites lib/seed.ts + bumps SEED_VERSION + snapshot
```

Columns are matched by **header name**, not position, so adding or reordering a sheet column
does not silently shift every value. The nine original columns are required; `start`, `end`
and `tat` are optional extras, and dates are accepted as either `yyyy-mm-dd` or `dd/mm/yyyy`.

`--diff` compares against `data/roadmap_snapshot.json` and names each added, removed and
changed node with its old and new value, so a sheet refresh is reviewable before it lands.
Use `--tsv path/to/other.tsv` to diff a fresh export without overwriting the committed TSV.

**Read this before regenerating.** Bumping `SEED_VERSION` throws away every board edit the
team has made: on load, a saved copy stamped with an older version is replaced wholesale by
the fresh seed. So `--write` bumps it **only when the diff shows the sheet actually moved**,
and a no-op regeneration holds the version where it is. Roadmaps the team created by hand in
Settings are never touched, only the sheet-derived `stackback` roadmap.

The sheet's Team column is authoritative for which discipline owns a row. Where it is blank,
the app falls back to inferring the team from who is assigned.

## Shared backend

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` and the app switches from
`localStorage` to a shared Supabase row, with **realtime** on: one person's edit appears in
everyone else's browser without a reload. Full steps in [SUPABASE.md](./SUPABASE.md).
`Settings → Storage` shows which mode you are in.

Still to come: **Auth** (magic link, then tighten the RLS policy from anon to authenticated),
and **normalising** the single JSONB row into `roadmaps` / `nodes` / `assignees` tables for
per-node realtime and conflict-free concurrent editing. Today two people editing at once is
last-write-wins on the whole blob.
