-- StackBack Roadmap — Supabase schema
-- Run this in your Supabase project's SQL editor (Dashboard → SQL Editor → New query).
--
-- v1 stores the whole app state as a single JSONB row, mirroring the client store 1:1
-- (roadmaps tree + active roadmap + roster). This is the fastest shared-backend migration.
-- Later we can normalize into per-node rows for granular realtime + concurrent editing.

create table if not exists app_state (
  id         int primary key default 1,
  roadmaps   jsonb not null default '[]'::jsonb,
  active_id  text,
  roster     jsonb,
  updated_at timestamptz not null default now(),
  constraint app_state_singleton check (id = 1)
);

-- Seed the singleton row.
insert into app_state (id, roadmaps) values (1, '[]'::jsonb)
on conflict (id) do nothing;

-- Row Level Security.
alter table app_state enable row level security;

-- v1 (pre-auth): allow the anon key to read/write the single row.
-- TIGHTEN THIS once auth lands (scope to authenticated users / a workspace).
drop policy if exists "anon read app_state"  on app_state;
drop policy if exists "anon write app_state" on app_state;
create policy "anon read app_state"  on app_state for select using (true);
create policy "anon write app_state" on app_state for all    using (true) with check (true);

-- Optional: enable realtime so edits sync live across browsers.
-- Dashboard → Database → Replication → add `app_state`, or:
-- alter publication supabase_realtime add table app_state;
