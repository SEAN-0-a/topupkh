-- =============================================================================
-- Migration 0003: Games & experiences tables (+ schema-cache reload)
-- =============================================================================
-- Fixes: "Could not find the table public.games in the schema cache"
-- That error means the table does not exist in your database (PostgREST has
-- nothing to serve). Run this file in Supabase SQL Editor.
--
-- IDEMPOTENT: safe on a fresh project AND alongside 0001 (uses
-- IF NOT EXISTS / DROP POLICY IF EXISTS, so no conflicts either way).
-- The final NOTIFY forces PostgREST to refresh its schema cache immediately,
-- which clears the error without needing a Supabase restart.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Games: the top-level game list shown on the homepage and in marketplace filters
-- -----------------------------------------------------------------------------
create table if not exists public.games (
  id          bigserial primary key,
  slug        text unique not null,
  name        text not null,
  icon_url    text,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists games_active_idx on public.games (is_active, sort_order);

-- Experiences: sub-listing under a game (e.g. specific Roblox experiences)
create table if not exists public.experiences (
  id         bigserial primary key,
  game_id    bigint not null references public.games (id) on delete cascade,
  name       text not null,
  slug       text not null,
  is_active  boolean not null default true,
  unique (game_id, slug)
);

-- -----------------------------------------------------------------------------
-- Row Level Security: public read of active games; admin-only writes
-- -----------------------------------------------------------------------------
alter table public.games      enable row level security;
alter table public.experiences enable row level security;

-- (helpers from 0001; recreated defensively in case 0001 was skipped)
-- Same signatures as 0001 (returns user_role enum) so the migrations never
-- conflict no matter which order you run them. NULL-safe: if `profiles`
-- doesn't exist yet, we fall back to 'buyer' instead of erroring — otherwise
-- EVERY public read would crash at policy evaluation.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('buyer', 'seller', 'support', 'admin');
  end if;
end;
$$;

create or replace function public.current_role()
returns public.user_role
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  r public.user_role;
begin
  if to_regclass('public.profiles') is null then
    return 'buyer'::public.user_role;
  end if;
  select role into r from public.profiles where id = auth.uid();
  return coalesce(r, 'buyer'::public.user_role);
exception when others then
  return 'buyer'::public.user_role;
end;
$$;

create or replace function public.is_staff()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return public.current_role() in ('admin', 'support');
end;
$$;

drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games
  for select using (is_active or public.is_staff());

drop policy if exists games_staff_write on public.games;
create policy games_staff_write on public.games
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists experiences_public_read on public.experiences;
create policy experiences_public_read on public.experiences
  for select using (is_active or public.is_staff());

drop policy if exists experiences_staff_write on public.experiences;
create policy experiences_staff_write on public.experiences
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- Seed: Roblox as the launch game (idempotent)
-- -----------------------------------------------------------------------------
insert into public.games (slug, name, description, sort_order)
values ('roblox', 'Roblox', 'The core supported game platform', 0)
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- Force PostgREST/Supabase schema cache to reload NOW (clears the error)
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';
