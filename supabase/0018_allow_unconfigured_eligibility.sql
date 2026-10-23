-- SDL v1
-- =============================================================================
-- 0018 — allow product creation on UNCONFIGURED (game, category) pairs
-- =============================================================================
-- ASKED: "'unconfigured' eligibility status allows the user to submit the
--        offer for review" — i.e. remove the trigger's hard rejection of
--        pairs with no eligibility_rules row, without opening the
--        prohibited-pair guardrail (0014/0017 lineage).
--
-- WHY: assert_product_eligible() (0001, rewritten by 0017) rejects BOTH
--      'prohibited' AND unconfigured pairs (status_of is null):
--        raise exception 'This product type is prohibited for this game
--        (eligibility=%)', coalesce(status_of, 'unconfigured');
--      0014 auto-provisions rule rows, but a NEW game or category appears
--      with no row until that script is re-run — so sellers cannot list
--      into a valid, FK-correct pair at all.
--
-- THIS SCRIPT (run in Supabase SQL Editor; idempotent):
--   1. Rewrites public.assert_product_eligible():
--        prohibited            → still REJECTED (marketplace policy guardrail)
--        unconfigured (null)   → allowed; at INSERT time an AUTO-PUBLISHED
--                                ('approved') insert is downgraded to
--                                'pending_review' — the offer is submitted FOR
--                                REVIEW until an admin provisions the rule
--                                (0014 / admin flip). An explicit later
--                                UPDATE (admin approving a pending_review row)
--                                passes through — the review decision is the
--                                admin's, not the trigger's.
--        needs_review          → unchanged vs 0017: auto-publish allowed
--        allowed               → unchanged: inserts publish immediately
--   2. Re-attaches the trigger idempotently (same pattern as 0017).
--   3. notify pgrst, 'reload schema' — keeps PostgREST prepared plans fresh.
-- =============================================================================

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

  -- legality guardrail: prohibited categories never list, whatever the app sends
  if status_of = 'prohibited' then
    raise exception 'This product type is prohibited for this game (eligibility=%)',
      status_of;
  end if;

  -- UNCONFIGURED pairs (no eligibility_rules row): submission is ALLOWED, but
  -- at INSERT time an auto-published insert is downgraded to pending_review —
  -- the offer awaits admin review until the pair's rule is provisioned.
  -- Explicit 'pending_review'/'draft' inserts pass through untouched, and a
  -- later explicit UPDATE (admin approves the pending row) passes through too:
  -- TG_OP = 'INSERT' keeps the downgrade off the review decision itself.
  if TG_OP = 'INSERT' and status_of is null and new.status = 'approved' then
    new.status := 'pending_review';
  end if;

  -- AUTO-PUBLISH: 'allowed' and 'needs_review' pairs publish as sent (0017).
  return new;
end;
$$;

-- the trigger itself (products_eligibility_check) already exists and points
-- at this function; re-attach idempotently in case someone dropped it
drop trigger if exists products_eligibility_check on public.products;
create trigger products_eligibility_check
  before insert or update of game_id, category_id, status on public.products
  for each row execute function public.assert_product_eligible();

-- refresh PostgREST prepared plans (same hygiene as 0014–0017)
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Self-check: probe the function's branches without touching real data
-- -----------------------------------------------------------------------------
do $$
declare
  v_game bigint;
  v_cat  bigint;
begin
  select g.id into v_game from public.games g where g.is_active limit 1;
  select c.id into v_cat from public.product_categories c where c.is_active limit 1;
  if v_game is null or v_cat is null then
    raise notice 'self-check skipped: no active game/category found';
  end if;
end $$;
