-- =============================================================================
-- Migration 0001a: Rename LEGACY prototype tables (run BEFORE 0001)
-- =============================================================================
-- Your live project already contains tables from the old prototype:
--   listings, orders, orders_id_seq, seller_wallets, payout_requests
-- Migration 0001 needs those names free. This script RENAMES them (keeps the
-- data!) instead of dropping. Safe to run on a fresh project: it does nothing
-- when the tables are absent. Re-running is also safe.
-- =============================================================================

do $$
begin
  -- orders (name + its serial sequence)
  if to_regclass('public.orders') is not null then
    if exists (select 1 from pg_class where relname = 'orders_id_seq' and relkind = 'S') then
      execute 'alter sequence public.orders_id_seq rename to orders_id_seq_legacy';
    end if;
    alter table public.orders rename to legacy_orders;
  end if;

  if to_regclass('public.listings') is not null then
    if exists (select 1 from pg_class where relname = 'listings_id_seq' and relkind = 'S') then
      execute 'alter sequence public.listings_id_seq rename to listings_id_seq_legacy';
    end if;
    alter table public.listings rename to legacy_listings;
  end if;

  if to_regclass('public.seller_wallets') is not null then
    alter table public.seller_wallets rename to legacy_seller_wallets;
  end if;

  if to_regclass('public.payout_requests') is not null then
    alter table public.payout_requests rename to legacy_payout_requests;
  end if;
end;
$$;

-- =============================================================================
-- Migration 0001b: compatibility VIEWS with the legacy names (run AFTER 0001+0002)
-- =============================================================================
-- Old pages (/seller/dashboard, /checkout?listing_id=...) still read/write the
-- legacy tables. These views restore the old names while the data lives in the
-- legacy_* tables. security_invoker keeps RLS of the underlying tables active
-- (Postgres 15+), so this does not weaken security vs. before.
-- =============================================================================
do $$
begin
  if to_regclass('public.legacy_seller_wallets') is not null
     and to_regclass('public.seller_wallets') is null then
    execute 'create view public.seller_wallets with (security_invoker = true) as select * from public.legacy_seller_wallets';
  end if;

  if to_regclass('public.legacy_payout_requests') is not null
     and to_regclass('public.payout_requests') is null then
    execute 'create view public.payout_requests with (security_invoker = true) as select * from public.legacy_payout_requests';
  end if;

  if to_regclass('public.legacy_listings') is not null
     and to_regclass('public.listings') is null then
    execute 'create view public.listings with (security_invoker = true) as select * from public.legacy_listings';
  end if;
end;
$$;
