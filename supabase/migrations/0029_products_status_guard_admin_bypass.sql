-- =============================================================================
-- 0029 — products status guard: platform/admin may approve, sellers cannot
-- =============================================================================
-- PROBLEM:
--   0028's products_guard_status_escalation() rejected ANY session where
--   public.is_staff() is false. is_staff() resolves the caller via auth.uid()
--   -> profiles.role. Two broken paths fall out of that:
--     1. MANUAL SQL (Supabase Studio SQL Editor): no JWT -> auth.uid() is null
--        -> current_role() falls back to 'buyer' -> even the `postgres` role
--        is blocked from a plain `update products set status = 'approved'`.
--     2. TRUSTED BACKGROUND JOBS (service_role key: ABA webhook, admin client):
--        auth.uid() is also null there -> the same false 'buyer' verdict.
--   Meanwhile the intended invariant (a non-admin SELLER must never move
--   pending_review -> approved on their own row) must stay hard-enforced.
--
-- THIS MIGRATION (idempotent; safe to re-run):
--   1. New helper public.is_platform_admin() — true when ANY of:
--        a. the executing DB role is postgres / service_role / supabase_admin
--           (covers Studio SQL Editor + direct service connections)
--        b. the session bypass flag app.bypass_status_guard = 'on'
--        c. the JWT claims identify service_role / supabase_admin, or carry an
--           app_metadata/user_metadata role of 'admin'
--        d. public.profiles.role = 'admin' for auth.uid()
--        e. auth.users raw_app/raw_user_meta_data role = 'admin' (fallback
--           when the profiles row is missing or lagging)
--   2. Rebuilds products_guard_status_escalation() on top of the helper:
--        - platform admin / service context -> escalation INTO 'approved' passes
--        - everyone else (incl. auth.uid() = seller_id owners) -> hard block
--   3. Rebinds the trigger idempotently; notify pgrst.
--
-- FORCE-APPROVE (one line, run in Supabase SQL Editor as postgres for testing):
--   update public.products set status = 'approved' where status = 'pending_review';
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. helper — "is this session allowed to approve listings?"
-- -----------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  claims jsonb;
begin
  -- a. direct privileged DB roles: Studio SQL Editor, SQL migrations, jobs
  --    connecting as postgres / service_role / supabase_admins
  if current_user in (
    'postgres',
    'service_role',
    'supabase_admin',
    'supabase_auth_admin',
    'supabase_storage_admin'
  ) then
    return true;
  end if;

  -- b. explicit per-session bypass, e.g.:
  --    set local app.bypass_status_guard = 'on';
  if coalesce(current_setting('app.bypass_status_guard', true), 'off') = 'on' then
    return true;
  end if;

  -- c. JWT claims (PostgREST exposes request.jwt.claims to the trigger path)
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  if claims is not null then
    if claims->>'role' in ('service_role', 'supabase_admin') then
      return true;
    end if;
    if coalesce(
         claims->'app_metadata'->>'role',
         claims->'user_metadata'->>'role'
       ) = 'admin' then
      return true;
    end if;
  end if;

  -- d. profile role
  if exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role::text = 'admin'
  ) then
    return true;
  end if;

  -- e. metadata fallback straight off auth.users
  if exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and coalesce(u.raw_app_meta_data->>'role', u.raw_user_meta_data->>'role') = 'admin'
  ) then
    return true;
  end if;

  return false;
exception when others then
  -- fail CLOSED: an unexpected error must never widen the gate
  return false;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. trigger function — guard escalations INTO 'approved' only
-- -----------------------------------------------------------------------------
create or replace function public.products_guard_status_escalation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'approved'
     and old.status is distinct from new.status then

    -- platform context or admin identity -> allowed
    if public.is_platform_admin() then
      return new;
    end if;

    -- everyone else — including the row's own seller (auth.uid() = seller's
    -- user_id) — is rejected: self-approval is never permitted
    raise exception using
      errcode = 'check_violation',
      message = 'Listing approval denied: only platform admins can move a listing into status ''approved''.',
      detail  = format(
        'status change %s -> approved rejected for actor %s',
        coalesce(old.status::text, '(null)'),
        coalesce(auth.uid()::text, '(no session)')
      ),
      hint    = 'Ask an admin to approve this listing, or run the update from the Supabase SQL Editor.';
  end if;

  return new;
end;
$$;

drop trigger if exists products_status_guard on public.products;

create trigger products_status_guard
  before update on public.products
  for each row execute function public.products_guard_status_escalation();

-- -----------------------------------------------------------------------------
-- 3. plan cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =============================================================================
-- SELF-CHECK — re-run any time; every assertion must PASS
-- =============================================================================
select 'platform-admin-helper' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'is_platform_admin'
  and pg_get_function_result(p.oid) = 'boolean';

select 'status-guard-trigger' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict
from pg_trigger
where tgrelid = 'public.products'::regclass
  and tgname = 'products_status_guard'
  and not tgisinternal;

-- As postgres (Studio), approval must be allowed:
select 'postgres-can-approve' as check,
       public.is_platform_admin() as verdict;

select 'migration 0029 OK' as status;
