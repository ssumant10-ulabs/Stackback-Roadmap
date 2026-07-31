# StackBack Roadmap

Internal team roadmap tool for StackBack. Milestones, owners, and progress across the team, with multiple product roadmaps.

Built with **Next.js 16 (App Router) · React 19 · TypeScript**. Fully client-side today (state persists in the browser) with a clean data seam so a shared backend + auth can be added next.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve the production build
```

Requires Node 18+ (built and tested on Node 24).

## Views

- **Timeline** — the whole roadmap. Two layouts:
  - **Swimlanes** (default): teams as rows × priority waves as columns. A task shared by two teams shows under both, each with only that team's subtasks.
  - **By wave**: a vertical Now → Later flow grouped by team.
- **Overview** — the anyone-can-read screen. Toggle **Now / Next / Later** ↔ **By status**; each milestone has a collapsible, plain-language breakdown grouped by team.
- **Teams & People** — toggle **By team** (each team's milestones + the exact subtasks assigned to it), **By person** (a shareable per-person worklist with progress), and **Load** (capacity bars).
- **Board** — the editing hub. Drag by the grip to move/nest, ▲▼ to reorder, click status rings to cycle, add tasks and subtasks inline, assign owners, delete.

Plus: a global **milestone + task progress** bar, a **Filter** by team/person, **Settings** to manage multiple product roadmaps (create / rename / delete / switch), and a light / dark / auto **theme** toggle.

## Project structure

```
app/
  layout.tsx, page.tsx, globals.css   # shell + full stylesheet (brand tokens, light/dark)
data/
  roadmap_tab.tsv # the roadmap sheet's Roadmap tab, verbatim (source of truth)
  gen_seed.py     # regenerates lib/seed.ts from that TSV
lib/
  types.ts        # domain types (Node tree, Roadmap, Assignee, ...)
  constants.ts    # roster, teams, priorities, plain-language label maps
  seed.ts         # the seeded StackBack roadmap (GENERATED, do not hand-edit)
  derive.ts       # pure helpers (subtreeCounts, effStatus, aggProgress, ...)
  teams.ts        # roster-bound helpers (teamOf, teamSet, personWork, teamWork, ...)
  store.ts        # external store (useSyncExternalStore) + all mutations + persistence
components/
  RoadmapApp.tsx  # root: hydration gate, popovers/modals, view routing
  Header, HeroMetrics, ViewRow, FilterPopover, SettingsModal, AddTaskModal,
  AssigneePopover, RosterPicker, bits, icons
  views/          # Timeline, Overview, TeamsPeople, Board
```

## Data & persistence

Today the roadmap tree lives in `localStorage` (`stackback_roadmaps_v3`), managed by `lib/store.ts`. All views read from the same store, so an edit on the Board reflects everywhere.

### Refreshing from the roadmap sheet

`lib/seed.ts` is generated from the **Roadmap tab** of `StackBack_Roadmap_Tasks_Updated.xlsx`
(Drive `1tHa3FtlnUOaCg5kH7zmUgkV2IfiUDmSb`). Never hand-edit it. To pull in sheet changes:

```bash
# 1. update data/roadmap_tab.tsv so it matches the Roadmap tab (9 tab-separated columns)
python3 data/gen_seed.py            # dry run, prints milestone/task/horizon/team counts
python3 data/gen_seed.py --write    # rewrites lib/seed.ts
# 2. bump SEED_VERSION in lib/seed.ts
```

The `SEED_VERSION` bump matters. Everyone's browser (and the shared Supabase row, when it is
switched on) holds a saved copy of the tree; on load, a copy stamped with an older
`SEED_VERSION` is replaced by the fresh seed. Roadmaps the team created by hand in Settings
are never touched, only the sheet-derived `stackback` roadmap.

The sheet's Team column is authoritative for which discipline owns a row. Where it is blank,
the app falls back to inferring the team from who is assigned.

## Next: shared backend + auth

Planned migration (see `Settings → Account`):

1. **Supabase** for Postgres + Auth + Realtime (matches StackBack's existing Supabase usage).
2. Replace the `localStorage` calls in `lib/store.ts` with a data layer that reads/writes Supabase; the store's shape (`roadmaps → nodes(tree) → assignees`) maps directly to tables.
3. Scope roadmaps to a workspace/account; enable sharing.
4. Deploy on Vercel.

Copy `.env.example` to `.env.local` and fill in credentials when wiring Supabase.
