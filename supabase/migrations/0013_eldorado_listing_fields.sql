-- =============================================================================
-- Migration 0013: Eldorado-style listing fields on offers/products
-- =============================================================================
-- Adds the full Eldorado-style listing vocabulary to `public.products`
-- (`offers` is a VIEW over products, so extending products + the view gives
-- both tables their columns):
--
--   game_name           text          seller-facing game label (region/server…)
--   original_email      boolean       account sale: original email included
--   open_email_access   boolean       account sale: buyer gets open email access
--   warranty_days       integer       after-sale warranty window (days)
--   delivery_time       text          human estimate ("Instant", "1 day"…)
--   inventory_value     text          free-form inventory/stock valuation note
--   images              text[]        gallery of y-article photo URLs
--
-- `title` and `description` already exist on products (0001) and are already
-- markdown/plain-text friendly — nothing to add for those two.
--
-- Idempotent; safe to re-run. Requires 0001 (+0007/0008 for the offers view).
-- =============================================================================

do $$
begin
  if to_regclass('public.products') is null then
    raise exception
      'PREREQUISITE MISSING: public.products does not exist. Run 0001_marketplace_schema.sql first.';
  end if;
end;
$$;

alter table public.products add column if not exists game_name         text;
alter table public.products add column if not exists original_email    boolean not null default true;
alter table public.products add column if not exists open_email_access boolean not null default true;
alter table public.products add column if not exists warranty_days     integer not null default 5
  check (warranty_days between 0 and 365);
alter table public.products add column if not exists delivery_time     text;
alter table public.products add column if not exists inventory_value   text;
alter table public.products add column if not exists images            text[] not null default '{}'
  check (array_length(images, 1) is null or array_length(images, 1) <= 8);

-- -----------------------------------------------------------------------------
-- Re-expose the full field set on the public `offers` view (0008 definition +
-- the new columns). security_invoker keeps products RLS fully in force.
-- -----------------------------------------------------------------------------
create or replace view public.offers
with (security_invoker = true) as
select
  p.id,
  p.seller_id,
  p.game_id,
  p.category_id,
  p.template_id,
  p.title,
  p.game_name,
  p.description,
  p.images,
  p.price_usd,
  p.original_price_usd,
  p.stock,
  p.stock_is_unlimited,
  p.inventory_value,
  p.original_email,
  p.open_email_access,
  p.warranty_days,
  p.delivery_time,
  p.estimated_minutes               as delivery_time_minutes,
  p.delivery_method,
  (not p.is_deleted)                as is_active,
  p.status,
  p.sold_count,
  p.rating_sum,
  p.rating_count,
  p.image_url,
  p.created_at
from public.products p;

notify pgrst, 'reload schema';

select 'migration 0013 OK' as status,
       count(*) filter (where column_name in (
         'game_name', 'original_email', 'open_email_access', 'warranty_days',
         'delivery_time', 'inventory_value', 'images'
       )) as new_columns_present
from information_schema.columns
where table_schema = 'public' and table_name = 'products';
