-- =============================================================================
-- Migration 0004 (v2): Games + product_categories + eligibility_rules
-- =============================================================================
-- FIXES: "foreign key constraint eligibility_rules_game_id_fkey cannot be
--         implemented ... bigint and uuid are of incompatible types"
--
-- CAUSE: a `games` table already exists in your project with a UUID primary
-- key (from an earlier attempt), so CREATE TABLE IF NOT EXISTS skipped it and
-- the bigint FK could not bind to it.
--
-- THIS VERSION ADAPTS: it reads the actual type of games.id from the system
-- catalog and creates eligibility_rules.game_id with the SAME type. Nothing
-- is dropped, no data is lost. Also fully idempotent and safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Role enum + safe helpers (same signature as 0001 — no conflicts)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('buyer', 'seller', 'support', 'admin');
  end if;
end;
$$;

create or replace function public.current_role()
returns public.user_role
language plpgsql stable security definer set search_path = public
as $$
declare r public.user_role;
begin
  if to_regclass('public.profiles') is null then return 'buyer'::public.user_role; end if;
  select role into r from public.profiles where id = auth.uid();
  return coalesce(r, 'buyer'::public.user_role);
exception when others then return 'buyer'::public.user_role;
end;
$$;

create or replace function public.is_staff()
returns boolean
language plpgsql stable security definer set search_path = public
as $$
begin
  return public.current_role() in ('admin', 'support');
end;
$$;

-- -----------------------------------------------------------------------------
-- 1. Games (created ONLY if absent; never dropped here)
-- -----------------------------------------------------------------------------
do $$
declare
  game_id_type text;
begin
  if to_regclass('public.games') is null then
    create table public.games (
      id          bigserial primary key,
      slug        text unique not null,
      name        text not null,
      icon_url    text,
      description text,
      is_active   boolean not null default true,
      sort_order  int not null default 0,
      created_at  timestamptz not null default now()
    );
    execute 'create index if not exists games_active_idx on public.games (is_active, sort_order)';
  else
    -- read the EXISTING id column type so we can match it below
    select format_type(a.atttypid, a.atttypmod) into game_id_type
    from pg_attribute a
    where a.attrelid = 'public.games'::regclass
      and a.attname = 'id' and a.attnum > 0 and not a.attisdropped;
    if game_id_type is null then
      raise exception 'games table exists but has no id column';
    end if;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1b. PATCH an existing games table that was created manually and may be
--     missing columns the seed/browsing needs (e.g. slug). Adding columns is
--     non-destructive: existing data and columns are untouched.
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.games') is not null then
    -- the columns the app + seed require
    execute 'alter table public.games add column if not exists slug text unique';
    execute 'alter table public.games add column if not exists name text';
    execute 'alter table public.games add column if not exists icon_url text';
    execute 'alter table public.games add column if not exists description text';
    execute 'alter table public.games add column if not exists is_active boolean not null default true';
    execute 'alter table public.games add column if not exists sort_order int not null default 0';
    execute 'alter table public.games add column if not exists created_at timestamptz not null default now()';

    -- if slug existed WITHOUT a unique constraint, the inline `unique` above
    -- was skipped together with the column — add it explicitly here.
    execute 'create unique index if not exists games_slug_key on public.games (slug)';

    -- backfill slug for any old rows that don't have one (name-based, url-safe)
    execute $f$
      update public.games
      set slug = 'game-' || id
      where slug is null
    $f$;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Product categories (independent of the games id type)
-- -----------------------------------------------------------------------------
create table if not exists public.product_categories (
  id              bigserial primary key,
  slug            text unique not null,
  name            text not null,
  description     text,
  is_active       boolean not null default true,
  default_eligibility text not null default 'needs_review'
                      check (default_eligibility in ('allowed', 'prohibited', 'needs_review')),
  stock_model     text not null default 'finite' check (stock_model in ('finite', 'unlimited')),
  created_at      timestamptz not null default now()
);

-- PATCH if this table also pre-existed manually with missing columns
do $$
begin
  if to_regclass('public.product_categories') is not null then
    execute 'alter table public.product_categories add column if not exists slug text';
    execute 'alter table public.product_categories add column if not exists name text';
    execute 'alter table public.product_categories add column if not exists description text';
    execute 'alter table public.product_categories add column if not exists is_active boolean not null default true';
    execute 'alter table public.product_categories add column if not exists default_eligibility text not null default ''needs_review''';
    execute 'alter table public.product_categories add column if not exists stock_model text not null default ''finite''';
    execute 'alter table public.product_categories add column if not exists created_at timestamptz not null default now()';
    execute 'create unique index if not exists product_categories_slug_key on public.product_categories (slug)';
    execute 'update public.product_categories set slug = ''cat-'' || id where slug is null';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. eligibility_rules — created DYNAMICALLY so game_id always matches
--    games.id exactly (bigint↔bigint or uuid↔uuid).
-- -----------------------------------------------------------------------------
do $$
declare
  game_id_type text;
begin
  if to_regclass('public.eligibility_rules') is not null then
    raise notice 'eligibility_rules already exists — skipping creation';
    return;
  end if;

  select format_type(a.atttypid, a.atttypmod) into game_id_type
  from pg_attribute a
  where a.attrelid = 'public.games'::regclass
    and a.attname = 'id' and a.attnum > 0 and not a.attisdropped;

  execute format('
    create table public.eligibility_rules (
      id           bigserial primary key,
      game_id      %s not null references public.games (id) on delete cascade,
      category_id  bigint not null references public.product_categories (id) on delete cascade,
      status       text not null default ''needs_review''
                   check (status in (''allowed'', ''prohibited'', ''needs_review'')),
      reason       text not null default '''',
      reviewed_by  uuid references auth.users (id),
      reviewed_at  timestamptz,
      unique (game_id, category_id)
    )', game_id_type);

  execute 'create index if not exists eligibility_rules_status_idx on public.eligibility_rules (status)';
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Row Level Security
-- -----------------------------------------------------------------------------
alter table public.games              enable row level security;
alter table public.product_categories enable row level security;
alter table public.eligibility_rules  enable row level security;

drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games
  for select using (is_active or public.is_staff());

drop policy if exists games_staff_write on public.games;
create policy games_staff_write on public.games
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists categories_public_read on public.product_categories;
create policy categories_public_read on public.product_categories
  for select using (is_active or public.is_staff());

drop policy if exists categories_staff_write on public.product_categories;
create policy categories_staff_write on public.product_categories
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists eligibility_read on public.eligibility_rules;
create policy eligibility_read on public.eligibility_rules
  for select using (true);

drop policy if exists eligibility_staff_write on public.eligibility_rules;
create policy eligibility_staff_write on public.eligibility_rules
  for all using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 5. Seed (idempotent; works with either id type)
-- -----------------------------------------------------------------------------
insert into public.games (slug, name, description, sort_order)
values ('roblox', 'Roblox', 'The core supported game platform', 0)
on conflict (slug) do nothing;

insert into public.product_categories (slug, name, description, default_eligibility, stock_model) values
  ('dev-assets',       'Development Assets', 'Models, scripts, UI kits, maps — downloadable creator assets', 'needs_review', 'unlimited'),
  ('creator-services', 'Creator Services',   'Map building, scripting, UI commissions by creators',          'needs_review', 'unlimited'),
  ('gamepasses',       'Game Passes',        'First-party Roblox game passes purchased on buyer''s behalf',  'needs_review', 'finite'),
  ('robux-currency',   'Robux & Currency',   'Third-party Robux transfers — violates Roblox ToS',            'prohibited',   'finite'),
  ('accounts',         'Accounts',           'Full account sales/trades — violates Roblox ToS',              'prohibited',   'finite'),
  ('in-game-items',    'In-Game Items',      'Pets, fruits, knives etc. — usually non-tradeable outside game ToS', 'prohibited', 'finite')
on conflict (slug) do nothing;

insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id, c.id, c.default_eligibility,
       case when c.default_eligibility = 'prohibited'
            then 'Violates Roblox Terms of Use — blocks unauthorized trading outside official systems'
            else 'Requires manual admin verification before this category may go live' end
from public.games g, public.product_categories c
where g.slug = 'roblox'
on conflict (game_id, category_id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. Force the schema cache to reload NOW
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =============================================================================
-- OPTIONAL (read this before ever running it): make games bigint consistently
-- =============================================================================
-- Later migrations (0001) expect games.id bigint for products/experiences FKs.
-- If your existing games.id is uuid AND the table holds nothing important, the
-- SIMPLEST way to keep the whole project type-consistent is to reset it once:
--
--   drop table if exists public.eligibility_rules cascade;
--   drop table if exists public.games cascade;      -- loses game rows only
--   -- then re-run THIS file: games is recreated as bigserial bigint.
--
-- If you keep uuid, future migrations must be adapted to uuid as well.
-- =============================================================================
