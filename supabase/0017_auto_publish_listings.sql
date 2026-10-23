-- SDL v1
-- =============================================================================
-- 0017 — auto-publish seller listings on creation
-- =============================================================================
-- ASKED: new listings must appear on /marketplace IMMEDIATELY after
--        submission (no admin review step).
--
-- WHY A MIGRATION: the app now inserts products with status='approved'
-- (the published status on /marketplace — the product_status enum has no
-- 'active'/'published' label). But migration 0001's eligibility trigger
-- hard-rejects such inserts while a (game, category) rule is 'needs_review'
-- ("Products in review-required categories need explicit admin approval"),
-- and 0014 auto-provisions most categories as exactly that.
--
-- THIS SCRIPT (run in Supabase SQL Editor; idempotent):
--   1. Rewrites public.assert_product_eligible() so it keeps ONLY the
--      legality guardrail: PROHIBITED (or unconfigured) pairs are still
--      rejected at insert time; 'needs_review' no longer blocks a direct
--      'approved' insert.
--   2. Aligns the products.status column default with auto-publish
--      ('approved') so any insert path that omits status publishes too.
--   3. Publishes any stranded pending_review rows (products table is empty
--      in the live DB today, so this is a no-op safety net).
--   4. notify pgrst, 'reload schema' — keeps PostgREST prepared plans fresh.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Eligibility trigger: keep the prohibited-pair guardrail, drop the
--    needs_review admin gate
-- -----------------------------------------------------------------------------
create or replace function public.assert_product_eligible()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  status_of public.eligibility_status;
begin
  select r.status into status_of
  from public.eligibility_rules r
  where r.game_id = new.game_id and r.category_id = new.category_id;

  -- legality guardrail: prohibited categories never list, whatever the app
  -- sends; unconfigured pairs also stay blocked (run 0014 first to provision)
  if status_of is null or status_of = 'prohibited' then
    raise exception 'This product type is prohibited for this game (eligibility=%)',
      coalesce(status_of, 'unconfigured');
  end if;

  -- AUTO-PUBLISH: no admin-approval gate. The seller-side restrictions
  -- (KYC-verified seller, approved seller row, suspended check) live in the
  -- createListing action; category policy lives in eligibility_rules.
  return new;
end;
$$;

-- the trigger itself (products_eligibility_check) already exists and points
-- at this function; re-attach idempotently in case someone dropped it
drop trigger if exists products_eligibility_check on public.products;
create trigger products_eligibility_check
  before insert or update of game_id, category_id, status on public.products
  for each row execute function public.assert_product_eligible();

-- -----------------------------------------------------------------------------
-- 2. Column default = 'approved' (the published status)
-- -----------------------------------------------------------------------------
alter table public.products
  alter column status set default 'approved';

-- -----------------------------------------------------------------------------
-- 3. Publish any stranded pending_review rows (safety net; no-op when empty)
-- -----------------------------------------------------------------------------
update public.products
set status = 'approved'
where status = 'pending_review';

-- -----------------------------------------------------------------------------
-- 4. Refresh PostgREST prepared plans
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Self-check: default status + trigger behavior
-- -----------------------------------------------------------------------------
select
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'status')          as status_default, -- expect 'approved'::product_status
  count(*) filter (where status = 'approved')       as approved_rows,
  count(*) filter (where status = 'pending_review') as stranded_rows
from public.products;
