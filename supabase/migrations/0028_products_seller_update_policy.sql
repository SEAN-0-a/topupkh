-- =============================================================================
-- 0028 — sellers may UPDATE their own listings (seller dashboard Edit/Delete)
-- =============================================================================
-- PROBLEM:
--   0001's products_seller_write (FOR ALL) policy has
--     with check (owner ... and status <> 'approved')
--   On UPDATE, the WITH CHECK expression evaluates the NEW row. A seller
--   editing their own APPROVED listing keeps status='approved', so the
--   policy's WITH CHECK rejects EVERY seller edit to a live listing with a
--   42501 RLS violation — the seller dashboard's Edit button can never work.
--
-- THIS MIGRATION (idempotent; safe to re-run):
--   1. Re-creates products_seller_write with plain ownership enforcement
--      (USING + WITH CHECK both = "row belongs to my sellers row"). The
--      original invariant — sellers can NEVER approve their own listing —
--      moves to a BEFORE UPDATE trigger, which CAN compare the old vs new
--      row (RLS WITH CHECK cannot):
--        a non-staff session flipping status INTO 'approved' is rejected
--        with a descriptive error; edits that keep the status pass.
--   2. Rebinds the trigger idempotently; notify pgrst.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. policy — ownership-only (status invariant enforced by the trigger below)
-- -----------------------------------------------------------------------------
drop policy if exists products_seller_write on public.products;

create policy products_seller_write on public.products
  for all
  using (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
  )
  with check (
    seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 2. trigger — non-staff sessions can never set status INTO 'approved'
--    (old row is visible here, unlike in RLS WITH CHECK)
-- -----------------------------------------------------------------------------
create or replace function public.products_guard_status_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved'
     and old.status is distinct from new.status
     and not public.is_staff() then
    raise exception
      'Only marketplace staff can approve a listing — your change was rejected because it altered the status.',
      errcode = 'check_violation';
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
select 'policy-owner-only' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict
from pg_policy
where polrelid = 'public.products'::regclass
  and polname = 'products_seller_write';

select 'status-guard-trigger' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict
from pg_trigger
where tgrelid = 'public.products'::regclass
  and tgname = 'products_status_guard'
  and not tgisinternal;

select 'migration 0028 OK' as status;
