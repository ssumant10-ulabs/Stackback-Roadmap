-- StackBack Roadmap: Supabase schema
-- Run this in your Supabase project's SQL editor (Dashboard → SQL Editor → New query).
--
-- v1 stores the whole app state as a single JSONB row, mirroring the client store 1:1
-- (roadmaps tree + active roadmap + roster + activity log). This is the fastest shared
-- backend migration. Later we can normalize into per-node rows for granular realtime
-- and concurrent editing.

create table if not exists app_state (
  id         int primary key default 1,
  roadmaps   jsonb not null default '[]'::jsonb,
  active_id  text,
  roster     jsonb,
  activity   jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  admin_url  text,
  uiux_url   text,
  features   jsonb not null default '[]'::jsonb,
  pilots     jsonb not null default '[]'::jsonb,
  seeded     jsonb not null default '{}'::jsonb,
  pilot_categories jsonb not null default '[]'::jsonb,
  constraint app_state_singleton check (id = 1)
);

-- Upgrading an app_state table created before the activity log and client id existed.
alter table app_state add column if not exists activity   jsonb not null default '[]'::jsonb;
alter table app_state add column if not exists updated_by text;
alter table app_state add column if not exists admin_url  text;
alter table app_state add column if not exists uiux_url   text;
alter table app_state add column if not exists features   jsonb not null default '[]'::jsonb;
alter table app_state add column if not exists pilots     jsonb not null default '[]'::jsonb;
alter table app_state add column if not exists seeded     jsonb not null default '{}'::jsonb;
alter table app_state add column if not exists pilot_categories jsonb not null default '[]'::jsonb;

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

-- Realtime, so one person's edit shows up in everyone else's browser without a reload.
-- The app subscribes to this table; without the publication it stays shared-on-load only.
alter publication supabase_realtime add table app_state;
