-- SDL v1
-- =============================================================================
-- 0016 — stabilize role type plumbing (final fix for the 42704 INSERT error)
-- =============================================================================
-- SYMPTOM (verified via REST probes):
--   Inserts to products / product_templates return 400 42704
--   'type "user_role" does not exist'
--   while SELECTs over the same tables return 200 and the request payloads
--   contain no role value at all.
--
-- ROOT CAUSE: PostgREST captured prepared INSERT plans while the
-- public.user_role enum (and/or public.current_role()) was being
-- drop/recreated by migration churn. A prepared plan that references the OLD
-- type object keeps erroring 42704 even though a same-named type exists now;
-- PostgREST never auto-invalidates 42704 plans, so inserting kept failing
-- until an explicit reload. Related casts live ONLY in SQL:
--   - public.current_role() returns user_role and casts 'buyer'::user_role
--   - policies compare profile.role against it
--   - on_profile_created / on_auth_user_created trigger functions only set
--     the enum column from a string literal (implicit literal cast — safe)
--
-- THIS MIGRATION (run in Supabase SQL Editor; safe to re-run):
--   1. Guarantees public.user_role exists — CREATE TYPE inside the schema
--      init path exactly as requested (as-shipped labels: buyer, seller,
--      support, admin — 'support' must stay or is_staff()/admin areas break).
--   2. Rotates public.current_role() to return standard TEXT ('buyer',
--      'seller', …) instead of the enum — the enum-cast leaves the RLS hot
--      path entirely; legacy policies keep working via OID binding.
--   3. Rebuilds public.is_staff() on top of the text helper.
--   4. Patches the single policy that compared an enum column straight to the
--      helper (profile_self_update) after the return type no longer matches.
--   5. notify pgrst, 'reload schema' — drops the poisoned prepared plans.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The type must exist (matches the shipped schema; do not narrow labels)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('buyer', 'seller', 'support', 'admin');
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. current_role() -> returns TEXT (no ::user_role casts left in usage path)
--    Rename the enum-returning original first (policies keep binding by OID,
--    so nothing breaks mid-flight), then create the text version in its place.
-- -----------------------------------------------------------------------------
do $$
declare
  any_current_role boolean;
  text_current_role boolean;
begin
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_role'
  ) into any_current_role;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'current_role'
      and pg_get_function_result(p.oid) = 'text'
  ) into text_current_role;

  if any_current_role and not text_current_role then
    execute 'alter function public.current_role() rename to current_role_by_enum';
  end if;

  if not text_current_role then
    execute $fn$
      create function public.current_role()
      returns text
      language plpgsql
      stable
      security definer
      set search_path = public, pg_temp
      as $body$
      declare
        r text;
      begin
        if to_regclass('public.profiles') is null then
          return 'buyer';
        end if;
        select role::text into r from public.profiles where id = auth.uid();
        return coalesce(r, 'buyer');
      exception when others then
        return 'buyer';
      end;
      $body$;
    $fn$;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. is_staff() rebuilt so its body binds the TEXT helper
-- -----------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return public.current_role() in ('admin', 'support');
exception when others then
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. profile_self_update: compare the enum COLUMN over text
--    (0001 wrote `role = public.current_role()` — enum vs text needs a cast)
-- -----------------------------------------------------------------------------
drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role::text = public.current_role()); -- can't promote self

-- -----------------------------------------------------------------------------
-- 5. Tell PostgREST to drop every prepared plan + re-introspect (THE fix for
--    the 42704). After this run: re-submitting the offer form succeeds with
--    no code or payload change.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Self-check: run again later if in doubt. Old calls must still enumerate roles.
-- -----------------------------------------------------------------------------
select 'text-returning current_role' as check,
       public.current_role()                                   as me,
       public.is_staff()                                       as is_staff,
       (select count(*) from public.profiles
         where role::text in ('buyer','seller','support','admin')) as profile_rows;
