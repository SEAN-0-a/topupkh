-- =============================================================================
-- 0019 — dynamic user profiles: real names + auto-provisioned shop names
-- =============================================================================
-- PROBLEM:
--   The 0001 trigger create_profile_for_user() inserted ONLY (id) into
--   public.profiles, so every new signup kept the hardcoded column default
--   display_name = 'Cambodian Gamer' and never got a shop_name.
--
-- THIS MIGRATION (idempotent; safe to re-run):
--   1. Replaces the bootstrap trigger with public.handle_new_user(), which
--      pulls a human display name from the auth metadata written by Google
--      OAuth (raw_user_meta_data->>'full_name', then ->>'name'), falls back
--      to the email username prefix, and finally to a neutral 'Player'.
--      shop_name is provisioned as "{display_name} Shop".
--   2. Grants authenticated users UPDATE on public.profiles.shop_name so the
--      /settings page can persist the shop name (0010 revoked blanket UPDATE
--      and its explicit allow-list omitted shop_name).
--   3. One-time backfill: repairs rows created before this migration whose
--      display_name is still the hardcoded 'Cambodian Gamer' default,
--      re-deriving the name from each user's auth metadata.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The new trigger function (naming per spec: public.handle_new_user())
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta         jsonb;
  display_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  -- 1) Google OAuth metadata (full_name preferred, then plain name)
  display_name := nullif(btrim(coalesce(meta->>'full_name', meta->>'name')), '');

  -- 2) Email username prefix ("sok.dara@gmail.com" -> "sok.dara")
  if display_name is null then
    display_name := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
  end if;

  -- Neutral fallback for anonymous signups / metadata-less accounts
  display_name := coalesce(display_name, 'Player');

  -- Collapse runs of whitespace (Google names can be messy), cap at 40 chars —
  -- mirrors the server-side validation in src/app/actions/profile.ts.
  display_name := left(regexp_replace(display_name, '\s+', ' ', 'g'), 40);

  insert into public.profiles (id, display_name, shop_name)
  values (
    new.id,
    display_name,
    left(display_name || ' Shop', 80) -- mirrors the 2..80 shop_name validation in submit_seller_kyc
  )
  on conflict (id) do nothing;

  -- sellers row rides along with the profile (0021): only (user_id,
  -- display_name, status) are non-default NOT NULL columns on public.sellers.
  insert into public.sellers (user_id, display_name, status)
  values (new.id, display_name, 'approved')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Rebind the trigger to the new function, then retire the old one.
-- (SQLEditor-safe: recreate trigger unconditionally.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop function if exists public.create_profile_for_user();

-- -----------------------------------------------------------------------------
-- 2. Allow self-service updates to the shop name
-- -----------------------------------------------------------------------------
-- 0010 revoked UPDATE from anon/authenticated and whitelisted explicit columns;
-- shop_name was missing, so any /settings save touching shop_name failed with
-- `permission denied`. Re-adding just this column keeps the choke-point intact.
--
-- RLS (profile_self_update, rebuilt in 0016) still limits the affected ROWS to
-- the caller's own; the column grant only stops privilege-sensitive columns.
grant update (shop_name)
  on public.profiles
  to authenticated;

-- -----------------------------------------------------------------------------
-- 3. One-time backfill for pre-0019 signups
-- -----------------------------------------------------------------------------
-- Only rows still carrying the hardcoded default get repaired — users who
-- deliberately renamed themselves are left alone.
update public.profiles p
set display_name = clean.name,
    shop_name    = left(clean.name || ' Shop', 80)
from (
  select u.id,
         left(regexp_replace(coalesce(
           nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name')), ''),
           nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''),
           'Player'
         ), '\s+', ' ', 'g'), 40) as name
  from auth.users u
) clean
where p.id = clean.id
  and p.display_name = 'Cambodian Gamer';

-- -----------------------------------------------------------------------------
-- Self-check: the trigger function exists and is bound to on_auth_user_created
-- -----------------------------------------------------------------------------
select t.tgname, p.proname
from pg_trigger t
join pg_proc    p on p.oid = t.tgfoid
where t.tgname = 'on_auth_user_created'
  and p.pronamespace = 'public'::regnamespace;
