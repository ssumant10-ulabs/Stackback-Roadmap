# Supabase setup (shared backend)

The app runs on browser `localStorage` by default. Set the two env vars below and it
switches to a shared Supabase backend automatically (no code change) — everyone sees the
same roadmaps.

## 1. Create the project
1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In **SQL Editor → New query**, paste and run [`supabase/schema.sql`](./supabase/schema.sql).
3. In **Project Settings → API**, copy the **Project URL** and the **anon public** key.
   (The anon key is safe to expose in the browser — it's the public client key, gated by Row Level Security.)

## 2. Set the env vars

Local (`.env.local`):
```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

On Vercel: **Project → Settings → Environment Variables** → add the same two → redeploy.

Restart `npm run dev` (or redeploy) and the app now reads/writes Supabase.

## How it works
- The whole app state (roadmaps tree + active roadmap + roster) is stored as one JSONB row
  (`app_state`, id = 1), mirroring the client store 1:1. See [`lib/remote.ts`](./lib/remote.ts).
- With env vars present, `lib/store.ts` hydrates from and saves to Supabase (debounced);
  without them it uses `localStorage`. The switch is `supabaseEnabled` in [`lib/supabase.ts`](./lib/supabase.ts).

## Roadmap
- **Auth**: add Supabase Auth (magic link / Google), then tighten the RLS policy in
  `schema.sql` from "anon" to authenticated users / a workspace.
- **Realtime**: enable replication on `app_state` and subscribe to reload on external changes.
- **Normalize**: split the JSONB into `roadmaps` / `nodes` / `assignees` tables for granular
  realtime and conflict-free concurrent editing.
