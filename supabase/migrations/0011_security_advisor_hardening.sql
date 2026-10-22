-- =============================================================================
-- TopUpKH — Migration 0011: Supabase Security Advisor hardening (idempotent)
-- =============================================================================
-- Fixes the two advisor findings:
--
--  1) `function_search_path_mutable`
--     Every public function gets a FIXED search_path (`public, pg_temp`),
--     executed through a guarded DO block — no function body/trigger/signature
--     is touched, so ownership, grants and trigger bindings are all preserved.
--     (The definitions in migrations 0001–0010 were hardened too; this block
--      exists so running this file alone fixes an already-installed database.)
--
--  2) `RLS Policy Always True` (constant-true USING/WITH CHECK clauses)
--     · public.profiles            — public read-all drop (owner/staff only)
--     · public.eligibility_rules   — explicit `status = 'allowed'` public read
--     · public.platform_settings   — tightened to staff-only read
--     · public.reviews             — tightened to participants
--     · public.product_templates   — explicit `game is active` condition
--     · public.orders / disputes   — staff `with check (true)` → real checks
--     · public.legacy_* prototype tables — every policy dropped, RLS enabled,
--       privileges revoked (deny-all; data is preserved)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FUNCTION SEARCH PATH — public, pg_temp (advisor linter 0011)
-- -----------------------------------------------------------------------------
-- Portable hardening of every catalogued function. Plain
-- `ALTER FUNCTION IF EXISTS …` is NOT valid PostgreSQL syntax, so each
-- statement is pre-checked with to_regprocedure() on a plain TEXT name
-- (NULL without raising when the function is absent) and only then executed.
-- All 24 function signatures listed here cover every public function defined
-- by migrations 0001–0010.
do $$
declare
  fn_names text[] := array[
    -- migration 0001 ------------------------------------------------------
    'public.promote_first_user_admin()',
    'public.create_profile_for_user()',
    'public.current_role()',
    'public.is_staff()',
    'public.touch_updated_at()',
    'public.assert_product_eligible()',
    'public.get_platform_commission_rate()',
    'public.assert_message_rate()',
    'public.assert_message_safe()',
    -- migrations 0002/0008 ------------------------------------------------
    'public.assert_order_money()',
    'public.decrement_stock_on_order()',
    'public.submit_payment_claim(bigint)',
    'public.confirm_payment(bigint, text, numeric)',
    'public.submit_delivery(bigint, text)',
    'public.complete_order(bigint)',
    'public.refund_order(bigint, text)',
    -- migration 0010 ------------------------------------------------------
    'public.move_escrow_on_order_status()',
    'public.get_my_seller_profile()',
    'public.submit_seller_kyc(public.seller_type_enum, text, text, text, text, text, text, text)',
    'public.review_seller_kyc(uuid, boolean, text)',
    'public.request_payout(numeric)',
    'public.review_payout(uuid, boolean, text)',
    'public.admin_list_kyc_applications()',
    'public.admin_list_payouts()'
  ];
  fn_name text;
begin
  foreach fn_name in array fn_names loop
    if to_regprocedure(fn_name) is not null then
      -- quoted string value: the GUC list form that ALTER FUNCTION accepts
      execute format('alter function %s set search_path = ''public, pg_temp''', fn_name);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 2. RLS — remove every constant-true policy
-- -----------------------------------------------------------------------------
-- 2.1 profiles: the blanket public read goes away. Owners + staff keep access
-- via profile_self_select; other users are reachable only through the definer
-- RPCs / granted column views. Anonymous site visitors read seller identity
-- from public.sellers, never from profiles.
drop policy if exists profile_basic_select on public.profiles;

-- 2.2 eligibility_rules: anon visitors still see the public catalog facts
-- (the 'allowed' rules that power /marketplace), while app server actions run
-- as the signed-in user and can read needs_review/prohibited rows.
-- (No `to authenticated` clause: the 'allowed' arm must stay reachable by anon.)
drop policy if exists eligibility_read on public.eligibility_rules;
create policy eligibility_read on public.eligibility_rules
  for select
  using (status = 'allowed' or auth.uid() is not null);

-- 2.3 platform_settings: internal configuration — staff-only, never public.
drop policy if exists settings_public_read on public.platform_settings;
create policy settings_staff_read on public.platform_settings
  for select to authenticated
  using (public.is_staff());
-- (get_platform_commission_rate() is SECURITY DEFINER, so checkout commission
--  math keeps working for everyone.)

-- 2.4 reviews: only the buyer who wrote it, the seller it was written about,
-- or staff. The app never renders reviews on public pages.
drop policy if exists reviews_read on public.reviews;
create policy reviews_read on public.reviews
  for select using (
    buyer_id = auth.uid()
    or seller_id in (select s.id from public.sellers s where s.user_id = auth.uid())
    or public.is_staff()
  );

-- 2.5 product_templates: keep the canonical catalog publicly browsable but
-- scoped to ACTIVE games instead of `using (true)`.
drop policy if exists templates_public_read on public.product_templates;
create policy templates_public_read on public.product_templates
  for select using (
    exists (select 1 from public.games g where g.id = game_id and g.is_active)
  );

-- 2.6 staff UPDATE policies: `with check (true)` is advisory-flagged; the
-- WITH CHECK side must carry the same staff condition as USING.
drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update using (public.is_staff())
  with check (public.is_staff());

drop policy if exists disputes_staff_write on public.disputes;
create policy disputes_staff_write on public.disputes
  for update using (public.current_role() = 'admin')
  with check (public.current_role() = 'admin');

-- -----------------------------------------------------------------------------
-- 3. LEGACY prototype tables — deny-all (advisor flagged legacy_orders)
-- -----------------------------------------------------------------------------
-- legacy_orders / legacy_listings / legacy_seller_wallets /
-- legacy_payout_requests came from the old prototype with wide-open policies.
-- No part of the current app reads them (checked across src/), so we drop ALL
-- of their policies, enable RLS and revoke the API roles entirely. Data is
-- preserved; re-expose with an explicit owner/staff policy if ever needed.
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['legacy_orders', 'legacy_listings',
                             'legacy_seller_wallets', 'legacy_payout_requests'] loop
    if to_regclass(format('public.%I', tbl)) is not null then
      for pol in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = tbl
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
      end loop;

      execute format('alter table public.%I enable row level security', tbl);
      execute format('revoke all on public.%I from anon, authenticated', tbl);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Verification: both advisor findings should now return 0 problems.
select
  'security advisor hardening applied' as status,
  (select count(*) = 0 from pg_policies
    where schemaname = 'public' and policyname = 'profile_basic_select')
    as profile_basic_select_removed,
  (select count(*) from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proconfig is null
      and p.prokind = 'f'
  ) as functions_still_missing_search_path;
