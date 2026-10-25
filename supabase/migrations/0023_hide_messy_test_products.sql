-- =============================================================================
-- Migration 0023 - Hide messy test products from the storefront
-- =============================================================================

-- Purpose: the early prototype seeded throwaway rows (gibberish titles such as
-- 'mengnnn', 'xxxtentaction', 'cdvcdv', 'sdvsdv', and unrealistic test prices
-- below $0.50). Buyers must never see them on the live marketplace.
--
-- Strategy: SOFT-DELETE only (is_deleted = true + status = 'paused').
-- Orders, conversations and reviews reference products WITHOUT ON DELETE
-- CASCADE, so hard-deleting rows would either fail or orphan history.
-- Soft-deleted rows are already excluded by every catalog query in
-- src/lib/catalog.ts (`is_deleted = false` + `status = 'approved'`), and the
-- offer-group queries as well.
--
-- Idempotent: the WHERE clauses only ever touch rows that are still visible
-- (not is_deleted), and the storefront seed titles are explicitly protected.
-- Safe to re-run; run once via the Supabase SQL editor or `supabase db push`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. public.products - soft-hide the messy rows
-- -----------------------------------------------------------------------------
update public.products
set is_deleted      = true,
    status          = 'paused',
    moderation_note = coalesce(moderation_note, '')
                      || ' - auto-hidden by 0023 (messy test data)',
    updated_at      = now()
where not is_deleted
  and status <> 'paused'
  and (
        -- 1a. unrealistically low test prices (real top-ups start ~ $0.50)
        price_usd < 0.50

        -- 1b. missing / blank titles
        or title is null
        or btrim(title) = ''

        -- 1c. known gibberish titles and throwaway markers
        or lower(btrim(title)) in (
             'mengnnn', 'xxxtentaction', 'cdvcdv', 'sdvsdv', 'test', 'tests',
             'testing', 'demo', 'asdf', 'asdfgh', 'qwer', 'qwerty', 'zxcv',
             'dummy', 'mock', 'lorem', 'ipsum', 'placeholder', 'abc', 'abcd',
             'xxx', 'aaaa'
           )
        or lower(btrim(title)) ~ '(asdf|qwer|zxcv|sdvsdv|test product|test item|dummy|lorem ipsum)'

        -- 1d. keyboard-mash heuristics:
        --     3+ identical characters in a row            -> 'mengnnn', 'aaaa'
        or btrim(title) ~ '(.)\1{2,}'
        --     a short single lowercase token repeated twice -> 'cdvcdv', 'sdvsdv'
        or btrim(title) ~* '^([a-z0-9]{2,8})\1$'
        --     extremely short single-word lowercase titles -> 'qwe', 'asd'
        or btrim(title) ~ '^[a-z]{1,4}$'
      )
  -- never touch the official storefront seed rows (belt-and-braces: their
  -- titles/prices would not match the patterns above anyway).
  -- coalesce() so NULL titles are NOT silently skipped by the NOT IN guard.
  and coalesce(title, '') not in (
    'Mobile Legends: Bang Bang — 86 Diamonds',
    'Mobile Legends: Bang Bang — 257 Diamonds',
    'Mobile Legends: Bang Bang — Weekly Diamond Pass',
    'PUBG MOBILE — 120 UC',
    'PUBG MOBILE — 660 UC',
    'Free Fire — 106 Diamonds',
    'Free Fire — 566 Diamonds',
    'Roblox Official Game Card — $10 (Digital Code)'
  );

-- -----------------------------------------------------------------------------
-- 2. legacy_listings - the compat-table rows surfaced by the legacy bridge in
--    src/lib/catalog.ts. All done in a DO block: this table predates the
--    managed migrations, so column presence is verified before touching it.
--    Setting status <> 'approved' is enough - the bridge only surfaces rows
--    whose status is 'approved' (or NULL).
-- -----------------------------------------------------------------------------
do $$
declare
  has_title    boolean;
  has_price    boolean;
begin
  if to_regclass('public.legacy_listings') is null then
    raise notice 'legacy_listings does not exist - skipping legacy cleanup';
    return;
  end if;

  select count(*) > 0 into has_title
    from information_schema.columns
   where table_schema = 'public' and table_name = 'legacy_listings' and column_name = 'title';
  select count(*) > 0 into has_price
    from information_schema.columns
   where table_schema = 'public' and table_name = 'legacy_listings' and column_name = 'price';

  if not has_title then
    raise notice 'legacy_listings has no title column - skipping legacy cleanup';
    return;
  end if;

  update public.legacy_listings
     set status = 'hidden'
   where coalesce(status, 'approved') in ('approved', 'pending')
     and (
           (has_price and price is not null and price < 0.50)
           or title is null
           or btrim(title) = ''
           or lower(btrim(title)) in (
                'mengnnn', 'xxxtentaction', 'cdvcdv', 'sdvsdv', 'test', 'tests',
                'testing', 'demo', 'asdf', 'asdfgh', 'qwer', 'qwerty', 'zxcv',
                'dummy', 'mock', 'lorem', 'ipsum', 'placeholder', 'abc', 'abcd',
                'xxx', 'aaaa'
              )
           or lower(btrim(title)) ~ '(asdf|qwer|zxcv|sdvsdv|test product|test item|dummy|lorem ipsum)'
           or btrim(title) ~ '(.)\1{2,}'
           or btrim(title) ~* '^([a-z0-9]{2,8})\1$'
           or btrim(title) ~ '^[a-z]{1,4}$'
         );

  raise notice 'legacy_listings messy rows set to status=hidden';
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Self-check - after running, the storefront must show ONLY quality rows.
--    Expected output: zero messy rows; the 8 seeded storefront titles intact.
-- -----------------------------------------------------------------------------
select
  count(*) filter (
    where not is_deleted and status = 'approved' and (
      price_usd < 0.50
      or title is null
      or btrim(title) = ''
      or btrim(title) ~ '(.)\1{2,}'
    )
  ) as remaining_messy_products,
  count(*) filter (
    where not is_deleted and status = 'approved'
  ) as visible_products;

-- PostgREST: reload the schema cache so paused/deleted rows disappear
-- from every REST client immediately.
notify pgrst, 'reload schema';
