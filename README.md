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
lib/
  types.ts        # domain types (Node tree, Roadmap, Assignee, ...)
  constants.ts    # roster, teams, priorities, plain-language label maps
  seed.ts         # the seeded StackBack roadmap
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

## Next: shared backend + auth

Planned migration (see `Settings → Account`):

1. **Supabase** for Postgres + Auth + Realtime (matches StackBack's existing Supabase usage).
2. Replace the `localStorage` calls in `lib/store.ts` with a data layer that reads/writes Supabase; the store's shape (`roadmaps → nodes(tree) → assignees`) maps directly to tables.
3. Scope roadmaps to a workspace/account; enable sharing.
4. Deploy on Vercel.

Copy `.env.example` to `.env.local` and fill in credentials when wiring Supabase.
