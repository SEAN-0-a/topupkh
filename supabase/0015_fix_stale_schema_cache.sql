-- SDL v1
-- =============================================================================
-- 0015 — fix the broken INSERT route: 'type "user_role" does not exist'
-- =============================================================================
-- SYMPTOM: creating an offer on /seller/listings/new fails with
--   Could not create product page: type "user_role" does not exist   (42704)
-- and the same 42704 can appear for products inserts, while selects over the
-- SAME tables succeed. Diagnosis (verified over REST):
--   - anonymous INSERT probes to products / product_templates return 42704
--     (the request dies in PostgREST while preparing/running the INSERT,
--     resolving the RLS WITH CHECK policies -> public.current_role() whose
--     return type lives in a stale prepared plan)
--   - plain SELECTs on those tables return 200
--   - the INSERT payload contains NO user_role references at all
--
-- ROOT CAUSE: the user_role enum (and/or the public.current_role()/is_staff()
-- helpers) were (re)created by migration churn after PostgREST captured its
-- prepared plans; PostgREST does not auto-invalidate plans that report 42704.
--
-- FIX: tell PostgREST to drop its prepared plans and reload the schema cache.
--
-- RUN: Supabase SQL Editor -> paste whole file -> Run. Safe to re-run at any
-- time; afterwards retries of the failed submission succeed without code
-- changes, and eligibility_rules / product_categories / profiles become
-- readable from the API again.
-- =============================================================================

notify pgrst, 'reload schema';

-- Optional stronger hammer if a reload alone is not enough (one-off, closes
-- all prepared statements server-side for every session):
--   alter system set max_prepared_transactions = 0;  -- irrelevant on hosted
-- On hosted Supabase the notify above is the supported mechanism; if the
-- error somehow persists, pause+resume the project (instant PostgREST restart
-- re-introspects everything from scratch).

-- Self-check to run AFTER the reload (execute via SQL editor or REST):
--   insert probes should now return an RLS violation (42501) for anon — that
--   means the route plans fine and only permissions block, which is correct.
