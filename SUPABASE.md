# Supabase setup (shared backend)

The app runs on browser `localStorage` by default. Set the two env vars below and it
switches to a shared Supabase backend automatically (no code change): everyone sees the same
roadmaps, and with realtime enabled they see each other's edits without reloading.

## 1. Create the project
1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In **SQL Editor → New query**, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
   It is safe to re-run on an existing project: the `activity` and `updated_by` columns are
   added with `if not exists`, and the last line enables realtime on the table.
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
   (The anon key is safe to expose in the browser: it is the public client key, gated by Row Level Security.)

## 2. Set the env vars

Local (`.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

On Vercel: **Project → Settings → Environment Variables** → add the same two → redeploy.

Restart `npm run dev` (or redeploy) and the app now reads/writes Supabase.

## Verify it worked

Open **Settings → Storage**. It reads `Shared (Supabase)` / `Live` when the env vars are in
place, and `This browser only` / `Local` otherwise. To check realtime, open the app in two
browsers and move a card in one: it should move in the other within a second.

## How it works
- The whole app state (roadmaps tree + active roadmap + roster + activity log) is stored as
  one JSONB row (`app_state`, id = 1), mirroring the client store 1:1.
  See [`lib/remote.ts`](./lib/remote.ts).
- With env vars present, `lib/store.ts` hydrates from and saves to Supabase (debounced 400ms);
  without them it uses `localStorage`. The switch is `supabaseEnabled` in [`lib/supabase.ts`](./lib/supabase.ts).
- **Realtime**: the client subscribes to `postgres_changes` on that row. Every write stamps a
  per-tab `updated_by` id, and the listener drops rows carrying its own id, so your own save
  coming back cannot clobber what you typed in the meantime. Adopting someone else's change
  never re-persists, which is what stops two tabs writing to each other in a loop.
- **What stays local** even with the shared backend on: your display name
  (`stackback_me_v1`) and your theme. Everything else is shared.

## Known limit

Writes are last-write-wins on the whole blob. Two people editing different cards inside the
same 400ms debounce window will have one of the two edits overwritten. Fine for a team of
this size; the fix is normalising into per-node rows, below.

## Roadmap
- **Auth**: add Supabase Auth (magic link / Google), then tighten the RLS policy in
  `schema.sql` from "anon" to authenticated users / a workspace. Until then, anyone with the
  URL can edit, so treat the deployment as internal.
- **Normalize**: split the JSONB into `roadmaps` / `nodes` / `assignees` tables for granular
  realtime and conflict-free concurrent editing, removing the last-write-wins limit above.
