-- SDL v1
-- =============================================================================
-- seed_demo_products.sql — demo / mock approved listings for /marketplace
-- =============================================================================
-- WHY: a fresh project has ZERO approved products, so /marketplace always
-- renders the empty state. This script creates a handful of realistic demo
-- listings (Roblox creator assets, services, game passes) owned by the first
-- APPROVED seller, plus the database allow-listing the demo categories need
-- so the eligibility trigger lets them through.
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.
-- No service-role key is needed; everything here is plain SQL.
--
-- SAFE TO RE-RUN: every statement is idempotent (on conflict / not exists).
-- =============================================================================

do $$
declare
  demo_seller bigint;
begin

-- -----------------------------------------------------------------------------
-- 1. Core catalog rows (same seeds as migrations 0001/0004, but self-contained
--    so this script works even on a partially-migrated project).
-- -----------------------------------------------------------------------------
insert into public.games (slug, name, description, sort_order)
values ('roblox', 'Roblox', 'The core supported game platform', 0)
on conflict (slug) do nothing;

insert into public.product_categories (slug, name, description, default_eligibility, stock_model) values
  ('dev-assets',       'Development Assets', 'Models, scripts, UI kits, maps — downloadable creator assets', 'needs_review', 'unlimited'),
  ('creator-services', 'Creator Services',   'Map building, scripting, UI commissions by creators',           'needs_review', 'unlimited'),
  ('gamepasses',       'Game Passes',        'First-party Roblox game passes purchased on buyer''s behalf',   'needs_review', 'finite')
on conflict (slug) do nothing;

insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id, c.id, 'needs_review',
       'Requires manual admin verification before this category may go live'
from public.games g, public.product_categories c
where g.slug = 'roblox'
  and c.slug in ('dev-assets', 'creator-services', 'gamepasses')
on conflict (game_id, category_id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Allow-list the demo categories (the admin action, mirrored in SQL).
--    The products_eligibility_check trigger REQUIRES rule status 'allowed'
--    before a listing may be approved/published.
-- -----------------------------------------------------------------------------
update public.eligibility_rules r
set status        = 'allowed',
    reviewed_at   = coalesce(r.reviewed_at, now()),
    reviewed_by   = coalesce(r.reviewed_by, (select id from auth.users limit 1))
from public.games g, public.product_categories c
where r.game_id    = g.id
  and r.category_id = c.id
  and g.slug = 'roblox'
  and c.slug in ('dev-assets', 'creator-services', 'gamepasses');

-- -----------------------------------------------------------------------------
-- 3. Attach the demo listings to the first APPROVED seller.
-- -----------------------------------------------------------------------------
select s.id into demo_seller
from public.sellers s
where s.status = 'approved'
order by s.id
limit 1;

if demo_seller is null then
  raise exception 'No approved seller found — approve a seller (admin area or sellers table) before running this seed.';
end if;

-- -----------------------------------------------------------------------------
-- 4. The demo listings (8 approved products, mixed categories/prices).
-- -----------------------------------------------------------------------------
insert into public.products (
  seller_id, game_id, category_id, title, description,
  price_usd, original_price_usd, delivery_method, delivery_details,
  stock, stock_is_unlimited, estimated_minutes, ownership_note,
  status, sold_count, rating_sum, rating_count
)
select
  v.seller_id, g.id, c.id, v.title, v.description,
  v.price_usd, v.original_price_usd, v.delivery_method::delivery_method, v.delivery_details,
  v.stock, v.stock_is_unlimited, v.estimated_minutes,
  'Original work owned by the selling creator — no third-party assets.',
  'approved'::product_status, v.sold_count, v.rating_sum, v.rating_count
from (values
  (demo_seller::bigint, 'roblox', 'dev-assets',       'Neon City Roleplay Map Bundle (24 maps)',
   '24 original Neon-City-style maps with interior lighting, spawn logic and optimized parts. Instant download after checkout.',
   14.99, 19.99, 'digital_file', 'Public download link delivered in the order page.', 0, true, null::int,
   42, 134, 30),
  (demo_seller::bigint, 'roblox', 'dev-assets',       'Custom Obby Kit - 40 stages + checkpoint scripts',
   'Complete obby kit: 40 hand-built stages, checkpoints, kill bricks and leaderstats. Modify freely inside your games.',
   9.50, 12.00, 'digital_file', 'Public download link delivered in the order page.', 0, true, null::int,
   17, 51, 12),
  (demo_seller::bigint, 'roblox', 'dev-assets',       'Modern Lobby UI Kit with HUD + settings panels',
   'Clean modern lobby UI kit: HUD, shop, settings and profile panels, fully scripted screen-size responsive.',
   6.00, null, 'digital_file', 'Public download link delivered in the order page.', 0, true, null::int,
   8, 0, 0),
  (demo_seller::bigint, 'roblox', 'creator-services', 'Map building commission by the hour',
   'I build your map or world section by the hour — send a reference, get progress updates, revisions included.',
   12.00, null, 'creator_services', 'We agree the tasks in buyer-seller chat first, then I build.', 0, true, 120,
   4, 0, 0),
  (demo_seller::bigint, 'roblox', 'creator-services', 'Bug fix and scripting service (per task)',
   'One small task per order: fix a broken script, add a small system, or patch an exploit. Sent within 24 hours.',
   5.00, null, 'creator_services', 'Send the .rbxl or details in chat; I deliver the patched file.', 0, true, 30,
   25, 55, 11),
  (demo_seller::bigint, 'roblox', 'dev-assets',       'Anti-cheat module for server-sided games',
   'Battle-tested anti-cheat module: anti-teleport, anti-fly, speed watchdogs and admin reports. Works on any game.',
   18.00, 22.00, 'digital_file', 'Public download link delivered in the order page.', 0, true, null::int,
   61, 190, 39),
  (demo_seller::bigint, 'roblox', 'gamepasses',       'Roblox VIP game pass activation on your behalf',
   'I purchase the gamepass you choose on your behalf after checkout. Give me the game + pass link in chat.',
   3.99, null, 'instructions', 'After payment, send the gamepass link in chat. Delivery in ~15 min.', 25, false, 15,
   12, 24, 8),
  (demo_seller::bigint, 'roblox', 'gamepasses',       '2x Speed game pass purchase (your game)',
   'I buy your requested 2x-speed game pass in your own game on your behalf. Provide game link and pass name.',
   2.50, null, 'instructions', 'After payment, send the game link + pass name in chat.', 40, false, 15,
   5, 0, 0)
) as v(seller_id, game_slug, cat_slug, title, description, price_usd,
       original_price_usd, delivery_method, delivery_details, stock,
       stock_is_unlimited, estimated_minutes, sold_count, rating_sum, rating_count)
join public.games g              on g.slug = v.game_slug
join public.product_categories c on c.slug = v.cat_slug
where not exists (select 1 from public.products p where p.title = v.title);

-- -----------------------------------------------------------------------------
-- 5. Reload PostgREST's schema cache.
--    ALSO FIXES: the "type 'user_role' does not exist" (42704) error that the
--    anon/public API returns for games / product_categories / eligibility_rules /
--    profiles after heavy migration churn. If /marketplace still shows games
--    or categories missing, re-run this line once.
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

end;
$$;

-- Self-check: how many approved demo rows are visible now?
select
  (select count(*) from public.products where status = 'approved' and is_deleted = false) as approved_products,
  (select count(*) from public.games)                                                    as games,
  (select count(*) from public.product_categories)                                       as categories,
  (select count(*) from public.eligibility_rules where status = 'allowed')               as allowed_rules;
