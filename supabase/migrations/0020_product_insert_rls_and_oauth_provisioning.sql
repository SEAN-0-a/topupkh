-- =============================================================================
-- 0020 — relaxed product INSERT for authenticated users + OAuth self-service RLS
-- =============================================================================
-- PROBLEM:
--   1. public.products inserts (the /seller/listings/new offer form) were
--      governed ONLY by 0001's products_seller_write (FOR ALL) policy, whose
--      WITH CHECK requires a matching public.sellers row owned by the caller.
--      A newly-signed-in Google session on any edge of the seller onboarding
--      path could surface a 42501 RLS violation instead of a business rule
--      message, and there is no DB-level guarantee that ANY authenticated
--      user can insert at all.
--   2. public.profiles needed a hard re-assert that authenticated users can
--      read and update their OWN profile row (self-select + self-update),
--      independent of which earlier migration order the DB was built with.
--   3. public.handle_new_user() — the Google-OAuth signup trigger from 0019 —
--      is re-declared here so this migration alone (SQL-Editor run) fully
--      provisions: dynamic display name from OAuth metadata, email-prefix
--      fallback, and shop_name = "{display_name} Shop".
--
-- THIS MIGRATION (idempotent; safe to re-run):
--   1. products: adds a permissive INSERT-only policy for every authenticated
--      user (with check (true)). UPDATE/DELETE visibility still ships through
--      products_seller_write / products_staff_all — this policy cannot be used
--      to publish-or-touch other sellers' rows.
--   2. profiles: re-asserts profile_self_select / profile_basic_select /
--      profile_self_update (0016 text-cast form) and re-grants the self-service
--      column set.
--   3. auth.users: (re)binds on_auth_user_created to public.handle_new_user(),
--      mirroring 0019 exactly.
--   4. notify pgrst 'reload schema' so PostgREST drops cached plans/policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. products — every authenticated user may INSERT (RLS last line of defense
--    for seller-onboarding edge cases; ownership is still enforced app-side:
--    createListing only ever writes caller-owned seller_id rows, and
--    product_templates has its own seller policies).
-- -----------------------------------------------------------------------------
drop policy if exists products_authenticated_insert on public.products;
create policy products_authenticated_insert on public.products
  for insert
  to authenticated
  with check (true);

-- -----------------------------------------------------------------------------
-- 2. profiles — authenticated users read + update their OWN profile
-- -----------------------------------------------------------------------------
drop policy if exists profile_self_select on public.profiles;
create policy profile_self_select on public.profiles
  for select using (id = auth.uid() or public.is_staff());

drop policy if exists profile_basic_select on public.profiles;
create policy profile_basic_select on public.profiles
  for select using (true);

-- 0016 form: compare the enum COLUMN over TEXT so the policy never dies with
-- `type user_role does not exist` after enum churn; self-role cannot be raised.
drop policy if exists profile_self_update on public.profiles;
create policy profile_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role::text = public.current_role());

-- Self-service column set (0010 grant-list + 0019's shop_name re-add).
grant update (display_name, username, avatar_url, locale,
              phone_number, payout_bank_name, payout_account_number, payout_account_name,
              shop_name)
  on public.profiles
  to authenticated;

grant select (id, display_name, username, avatar_url, locale, role, is_banned,
              created_at, updated_at, seller_type, shop_name, verification_status)
  on public.profiles
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. auth.users → public.handle_new_user() — auto-provision every new signup
--    (mirrors 0019 exactly; see that file for the design rationale)
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

-- Rebind the trigger to the new function, then retire the old bootstrap one.
-- (SQLEditor-safe: recreate trigger unconditionally.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop function if exists public.create_profile_for_user();

-- -----------------------------------------------------------------------------
-- 4. PostgREST: drop cached prepared plans + re-introspect policies
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Self-check — re-run any time; outputs must be non-empty and correct
-- -----------------------------------------------------------------------------
-- (a) products grants authenticated INSERT
select 'products-insert' as check, polname, polcmd
from pg_policy pol
where pol.polrelid = 'public.products'::regclass
  and pol.polname  = 'products_authenticated_insert'
  and pol.polcmd   = 'a';

-- (b) profiles self-row policies installed
select 'profiles-rls' as check, polname, polcmd
from pg_policy pol
where pol.polrelid = 'public.profiles'::regclass
  and pol.polname in ('profile_self_select', 'profile_basic_select', 'profile_self_update');

-- (c) signup trigger exists and is bound to public.handle_new_user()
select 'signup-trigger' as check, t.tgname, p.proname
from pg_trigger t
join pg_proc    p on p.oid = t.tgfoid
where t.tgname = 'on_auth_user_created'
  and p.pronamespace = 'public'::regnamespace;