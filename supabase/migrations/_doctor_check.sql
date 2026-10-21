-- =============================================================================
-- TopUpKH — DATABASE DOCTOR (read-only, safe to run any time)
-- =============================================================================
-- Run this FIRST in the Supabase SQL Editor. It tells you the current state of
-- your database so you know exactly which migrations you still need.
--
-- HOW TO READ THE OUTPUT:
--   * "legacy tables" shows rows → you must run 0001a FIRST.
--   * "core tables" missing rows (e.g. no orders) → run 0001, then 0002.
--   * "order_status values" already containing in_escrow/delivered → 0008 ran.
--   * The RPC table shows which lifecycle functions exist and from which
--     migration (0002 baseline vs 0008 escrow variants).
-- It only ever SELECTs — it cannot modify anything.
-- =============================================================================

select 'legacy tables' as section, t as object
from (values ('listings'), ('orders'), ('seller_wallets'), ('payout_requests'), ('legacy_orders')) as v(t)
where to_regclass(format('public.%I', t)) is not null
union all
select '(legacy?) orders columns', string_agg(column_name, ', ' order by ordinal_position)
from information_schema.columns
where table_schema = 'public' and table_name = 'orders';

select 'core tables' as section, t as object
from (values
  ('profiles'), ('games'), ('experiences'), ('product_categories'),
  ('eligibility_rules'), ('sellers'), ('seller_applications'), ('products'),
  ('orders'), ('payment_attempts'), ('payment_events'), ('transaction_ledger'),
  ('payouts'), ('platform_settings'), ('conversations'), ('messages'),
  ('support_tickets'), ('ticket_messages'), ('disputes'), ('reports'),
  ('reviews'), ('notifications'), ('admin_audit_log')
) as v(t)
where to_regclass(format('public.%I', t)) is not null;

select 'offer tables' as section, t as object
from (values ('product_templates'), ('offers')) as v(t)
where to_regclass(format('public.%I', t)) is not null;

select 'order_status values' as section,
       string_agg(enumlabel, ', ' order by enumsortorder) as values_present
from pg_enum
where enumtypid = 'public.order_status'::regtype;

select 'lifecycle functions' as section,
       p.proname || ' [' || pg_get_function_identity_arguments(p.oid) || ']' as object
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('submit_payment_claim', 'confirm_payment', 'submit_delivery',
                    'complete_order', 'refund_order', 'assert_order_money')
order by p.proname, 2;

-- is a games table present, and is its id the bigint type the marketplace
-- expects? (an earlier hand-made games table used uuid)
select 'games id type' as section,
       data_type from information_schema.columns
where table_schema = 'public' and table_name = 'games' and column_name = 'id';

select 'row counts (0 = empty, error = table missing)' as section;
select 'games' as t, count(*) from public.games
union all select 'product_categories', count(*) from public.product_categories
union all select 'products', count(*) from public.products
union all select 'products (approved)', count(*) from public.products where status = 'approved'
union all select 'orders', count(*) from public.orders
union all select 'profiles', count(*) from public.profiles
union all select 'admins', count(*) from public.profiles where role = 'admin';
