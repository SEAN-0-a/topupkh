-- =============================================================================
-- seed_topup_storefront.sql — clean gaming top-up storefront for ABA review
-- =============================================================================
-- WHY: ABA PayWay compliance / demo review needs the homepage to look like a
-- real KHQR gaming top-up store. This script:
--   1. HIDES all previously seeded/test listings (soft-delete + paused —
--      hard DELETE is unsafe because orders/conversations/reviews hold FK
--      references without ON DELETE CASCADE),
--   2. Ensures the 4 storefront games exist with REAL, verified artwork
--      (official Google Play assets — hotlink-stable, all HTTP 200),
--   3. Allow-lists the (game, category) eligibility pairs the listings need,
--   4. Seeds 8 clean, realistic top-up listings owned by the first APPROVED
--      seller (one is auto-provisioned if none exists).
--
-- HOW TO RUN: Supabase Dashboard -> SQL Editor -> paste -> Run.
--
-- SAFE TO RE-RUN: the reset step deliberately SKIPS products whose title is
-- one of the storefront listings below, and every insert is guarded
-- (not exists on title), so re-running converges to the same state.
--
-- RELATED: the older `seed_demo_products.sql` Roblox demo rows are hidden by
-- the reset; re-run that file afterwards if you want them back.
-- =============================================================================

do $$
declare
  v_seller   bigint;
  v_user     uuid;
  v_category_topups bigint;
  v_category_cards  bigint;
begin

-- -----------------------------------------------------------------------------
-- 0. Prerequisite guard
-- -----------------------------------------------------------------------------
if to_regclass('public.products') is null
   or to_regclass('public.games') is null
   or to_regclass('public.product_categories') is null
   or to_regclass('public.eligibility_rules') is null then
  raise exception
    'PREREQUISITE MISSING: run 0001_marketplace_schema.sql (and 0003_games_table.sql) first.';
end if;

-- -----------------------------------------------------------------------------
-- 1. Games: the 4 storefront games with icons served LOCALLY from public/image/
--    (each PNG was fetched from the official Google Play listing and committed —
--     remote URLs are a single point of failure, local files never 404)
-- -----------------------------------------------------------------------------
insert into public.games (slug, name, description, icon_url, sort_order)
values
  ('mobile-legends', 'Mobile Legends: Bang Bang',
   'Mobile MOBA by Moonton — diamonds and passes delivered to the buyer''s game ID.',
   '/image/mobile-legends.png',
   10),
  ('pubg-mobile', 'PUBG MOBILE',
   'Battle royale by Tencent/KRAFTON — UC credited to the buyer''s account.',
   '/image/pubg-mobile.png',
   20),
  ('free-fire', 'Free Fire',
   'Battle royale by Garena — diamonds and memberships delivered quickly.',
   '/image/free-fire.png',
   30),
  ('roblox', 'Roblox',
   'The core supported game platform.',
   '/image/roblox.png',
   40)
on conflict (slug) do update
  set name        = excluded.name,
      description = excluded.description,
      icon_url    = excluded.icon_url,
      is_active   = true;

-- -----------------------------------------------------------------------------
-- 2. Categories: Top Ups + Gift Cards (self-contained even if 0006 never ran)
-- -----------------------------------------------------------------------------
insert into public.product_categories (slug, name, description, default_eligibility, stock_model)
values
  ('top-ups',    'Top Ups',    'Direct top-up services delivered to the buyer''s account or game', 'needs_review', 'unlimited'),
  ('gift-cards', 'Gift Cards', 'Official digital gift card codes',                                 'needs_review', 'finite')
on conflict (slug) do nothing;

select c.id into v_category_topups from public.product_categories c where c.slug = 'top-ups';
select c.id into v_category_cards  from public.product_categories c where c.slug = 'gift-cards';

-- -----------------------------------------------------------------------------
-- 3. Allow-list the (game, category) pairs the storefront sells
--    (the products_eligibility_check trigger requires rule status 'allowed'
--     before a listing may be published)
-- -----------------------------------------------------------------------------
-- top-ups × MLBB / PUBG / Free Fire
insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id, v_category_topups, 'allowed',
       'Storefront seed: top-up service reviewed and allow-listed for demo'
from public.games g
where g.slug in ('mobile-legends', 'pubg-mobile', 'free-fire')
on conflict (game_id, category_id) do update
  set status = 'allowed',
      reason = excluded.reason;

-- gift-cards × Roblox (official game card)
insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id, v_category_cards, 'allowed',
       'Storefront seed: official gift card resale reviewed and allow-listed'
from public.games g
where g.slug = 'roblox'
on conflict (game_id, category_id) do update
  set status = 'allowed',
      reason = excluded.reason;

-- -----------------------------------------------------------------------------
-- 4. RESET — hide previous test / demo listings (soft-delete, never hard-delete:
--    orders, conversations and reviews reference products without CASCADE).
--    Skips our own storefront titles so this script is idempotent.
-- -----------------------------------------------------------------------------
update public.products
set is_deleted      = true,
    status          = 'paused',
    moderation_note = coalesce(moderation_note, '') || ' — hidden by seed_topup_storefront.sql reset'
where not is_deleted
  and status <> 'paused'
  and title not in (
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
-- 5. Attach to the first APPROVED seller (auto-provision one if none exists)
-- -----------------------------------------------------------------------------
select s.id into v_seller
from public.sellers s
where s.status = 'approved'
order by s.id
limit 1;

if v_seller is null then
  select u.id into v_user from auth.users u order by u.created_at asc, u.id asc limit 1;
  if v_user is null then
    raise exception 'No approved seller AND no auth user — cannot attach storefront listings.';
  end if;

  -- profile may be missing for legacy accounts; provision defensively
  insert into public.profiles (id, display_name, role)
  values (v_user, 'TopUpKH Official Store', 'seller')
  on conflict (id) do nothing;

  insert into public.sellers (user_id, display_name, status, about)
  values (v_user,
          'TopUpKH Official Store',
          'approved',
          'Official TopUpKH storefront — gaming top-ups delivered to in-game accounts.')
  returning id into v_seller;
end if;

-- -----------------------------------------------------------------------------
-- 6. The 8 storefront listings — approved, in stock, real art, standard prices
--
-- COLUMN COMPATIBILITY NOTE (schema drift, see error 42703 on delivery_time):
-- `delivery_time` and `game_name` exist on products ONLY via migration 0013
-- (not in the 0001 core schema). They are nullable metadata that the app never
-- requires from seed rows — `delivery_details` prose already carries the timing
-- estimate, and the game label is redundant with the `games` join below. The
-- seed therefore writes ONLY columns guaranteed by 0001 (+ `images`), so it
-- runs cleanly on any project state. The VALUES rows and their `v(...)`
-- aliases below still carry `delivery_time`/`game_name` fields (positional —
-- do NOT shift them); they are simply unconsumed here. To restore them,
-- `select` them back into the column list after running 0013.
-- -----------------------------------------------------------------------------
insert into public.products (
  seller_id, game_id, category_id, title, description, image_url, images,
  price_usd, original_price_usd, delivery_method, delivery_details,
  stock, stock_is_unlimited, estimated_minutes,
  ownership_note, status, sold_count, rating_sum, rating_count
)
select
  sv.seller_id, g.id, c.id, v.title, v.description, v.image_url, v.images,
  v.price_usd, v.original_price_usd, v.delivery_method::delivery_method, v.delivery_details,
  v.stock, v.stock_is_unlimited, v.estimated_minutes,
  v.ownership_note,
  'approved'::product_status, v.sold_count, v.rating_sum, v.rating_count
from (values

  -- Mobile Legends -----------------------------------------------------------
  ('mobile-legends', 'top-ups',
   'Mobile Legends: Bang Bang — 86 Diamonds',
   'Instant top-up of 86 diamonds delivered directly to your Mobile Legends account using your User ID and Server ID. No login, no code to redeem.',
   'https://play-lh.googleusercontent.com/hrpZdffP0Mt4nSZnr6FUk0OyeEm_GyXZ3TxCoQb7cSFoNOeF0KGEQoXgSR-PKqk1rlOyImJFvIPvZyXuoG3eXA=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/hrpZdffP0Mt4nSZnr6FUk0OyeEm_GyXZ3TxCoQb7cSFoNOeF0KGEQoXgSR-PKqk1rlOyImJFvIPvZyXuoG3eXA=w1052-h592',
     'https://play-lh.googleusercontent.com/f4LkAVMiT4fqebZ3ylDD_Vwmhnm2rxiW49WXei5PQo82lhZJFcvjpl-YwQoO2MZOeRInCEjeDGLjl9vQ-eXwhQ=w1052-h592',
     'https://play-lh.googleusercontent.com/MztmLpB1-_eFbHnqNzzvzl5zjiOH2BEb0D71uBxZYf_4BEmW3QEPWODhRtyqY7Qz4wRLwQ--Rg1RAjOFqtHSs-o=s256'],
   1.19, 1.49::numeric, 'instructions',
   'Enter your Mobile Legends User ID and Zone ID (Server) at checkout. Diamonds are credited to the specified in-game account within 5 minutes of payment.',
   'Instant (~5 min)', 'Mobile Legends: Bang Bang', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   214, 952::numeric, 198),
  ('mobile-legends', 'top-ups',
   'Mobile Legends: Bang Bang — 257 Diamonds',
   'Top-up of 257 diamonds delivered straight to your Mobile Legends account with just your User ID and Zone ID — the fastest way to skin up.',
   'https://play-lh.googleusercontent.com/f4LkAVMiT4fqebZ3ylDD_Vwmhnm2rxiW49WXei5PQo82lhZJFcvjpl-YwQoO2MZOeRInCEjeDGLjl9vQ-eXwhQ=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/f4LkAVMiT4fqebZ3ylDD_Vwmhnm2rxiW49WXei5PQo82lhZJFcvjpl-YwQoO2MZOeRInCEjeDGLjl9vQ-eXwhQ=w1052-h592',
     'https://play-lh.googleusercontent.com/hrpZdffP0Mt4nSZnr6FUk0OyeEm_GyXZ3TxCoQb7cSFoNOeF0KGEQoXgSR-PKqk1rlOyImJFvIPvZyXuoG3eXA=w1052-h592'],
   3.49, 3.99::numeric, 'instructions',
   'Enter your Mobile Legends User ID and Zone ID (Server) at checkout. Diamonds are credited within 5 minutes of payment.',
   'Instant (~5 min)', 'Mobile Legends: Bang Bang', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   178, 801::numeric, 166),
  ('mobile-legends', 'top-ups',
   'Mobile Legends: Bang Bang — Weekly Diamond Pass',
   'Weekly Diamond Pass with 80 diamonds + exclusive rewards, activated on your Mobile Legends account. One-time payment, no subscription.',
   'https://play-lh.googleusercontent.com/MztmLpB1-_eFbHnqNzzvzl5zjiOH2BEb0D71uBxZYf_4BEmW3QEPWODhRtyqY7Qz4wRLwQ--Rg1RAjOFqtHSs-o=s256',
   array[
     'https://play-lh.googleusercontent.com/MztmLpB1-_eFbHnqNzzvzl5zjiOH2BEb0D71uBxZYf_4BEmW3QEPWODhRtyqY7Qz4wRLwQ--Rg1RAjOFqtHSs-o=s256',
     'https://play-lh.googleusercontent.com/hrpZdffP0Mt4nSZnr6FUk0OyeEm_GyXZ3TxCoQb7cSFoNOeF0KGEQoXgSR-PKqk1rlOyImJFvIPvZyXuoG3eXA=w1052-h592'],
   1.89, null::numeric, 'instructions',
   'Enter your Mobile Legends User ID and Zone ID (Server) at checkout. The pass activates on your account within 5 minutes.',
   'Instant (~5 min)', 'Mobile Legends: Bang Bang', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   96, 442::numeric, 91),

  -- PUBG Mobile ---------------------------------------------------------------
  ('pubg-mobile', 'top-ups',
   'PUBG MOBILE — 120 UC',
   '120 Unknown Cash (UC) credited to your PUBG MOBILE account. Just provide your UC ID (character ID) at checkout — no login required.',
   'https://play-lh.googleusercontent.com/xRj26dOD5JhpfQ54rOXl8WNwij9p5dOYoaKGbyEjsEhRu35ogBp08qYS7HFHfHjlahSWEPs8VJRmqbjw8Q4SsQ=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/xRj26dOD5JhpfQ54rOXl8WNwij9p5dOYoaKGbyEjsEhRu35ogBp08qYS7HFHfHjlahSWEPs8VJRmqbjw8Q4SsQ=w1052-h592',
     'https://play-lh.googleusercontent.com/xRbPWmQg9wImDgp2rU4Wzu46Hx01QGaT3Ggtobacg7w42Hq0UvX_jQSPVHB8C6VsNy_fq58-w4LaBkHCeaWh=w1052-h592',
     'https://play-lh.googleusercontent.com/Se7jR6A5R0Mk9ClaIguf46yi2K3k32JsqKb3gAtrktIh3JwnFfxrQRmG9GLvdMpbxbMrReUOxzDkStxGxNo-5Q=s256'],
   1.09, 1.29::numeric, 'instructions',
   'Enter your PUBG MOBILE UC ID (open Profile tab in game) at checkout. UC is credited within 5 minutes of payment.',
   'Instant (~5 min)', 'PUBG MOBILE', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   143, 648::numeric, 135),
  ('pubg-mobile', 'top-ups',
   'PUBG MOBILE — 660 UC',
   '660 Unknown Cash (UC) delivered directly to your account. Best value for crate openings and Royale Pass upgrades.',
   'https://play-lh.googleusercontent.com/xRbPWmQg9wImDgp2rU4Wzu46Hx01QGaT3Ggtobacg7w42Hq0UvX_jQSPVHB8C6VsNy_fq58-w4LaBkHCeaWh=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/xRbPWmQg9wImDgp2rU4Wzu46Hx01QGaT3Ggtobacg7w42Hq0UvX_jQSPVHB8C6VsNy_fq58-w4LaBkHCeaWh=w1052-h592',
     'https://play-lh.googleusercontent.com/xRj26dOD5JhpfQ54rOXl8WNwij9p5dOYoaKGbyEjsEhRu35ogBp08qYS7HFHfHjlahSWEPs8VJRmqbjw8Q4SsQ=w1052-h592'],
   5.29, 5.99::numeric, 'instructions',
   'Enter your PUBG MOBILE UC ID (open Profile tab in game) at checkout. UC is credited within 5 minutes of payment.',
   'Instant (~5 min)', 'PUBG MOBILE', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   87, 407::numeric, 84),

  -- Free Fire ------------------------------------------------------------------
  ('free-fire', 'top-ups',
   'Free Fire — 106 Diamonds',
   '106 Garena Free Fire diamonds credited to your player ID. The starter top-up for bundles, events and character unlocks.',
   'https://play-lh.googleusercontent.com/LsawRbqk_iyOjjY_NkmKv62sTH9U4WqaF9juPzT0nhN4u9v52SHAfQliNaKpYZgo4KPN2j-cLVI44PhKpuAGJQ=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/LsawRbqk_iyOjjY_NkmKv62sTH9U4WqaF9juPzT0nhN4u9v52SHAfQliNaKpYZgo4KPN2j-cLVI44PhKpuAGJQ=w1052-h592',
     'https://play-lh.googleusercontent.com/8wCWhv0r5MAwGGIlL_H-wyQaiKDr4DlNdw3zKlCRu1YfT44aW_sq9ZWeIwku5aNpPTgZSZmp5_s1dgh4OnRT=w1052-h592',
     'https://play-lh.googleusercontent.com/cK-U0_B9GrnSy26SNISDuvU_hL4VggyqJ1J5V2oiuyVEfiGo7fzegdBjk0ejXPg3PKK5sPwumdLBbWv8KkBKLQ=s256'],
   0.99, 1.29::numeric, 'instructions',
   'Enter your Free Fire player ID at checkout. Diamonds are credited within 5 minutes of payment.',
   'Instant (~5 min)', 'Free Fire', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   302, 1406::numeric, 292),
  ('free-fire', 'top-ups',
   'Free Fire — 566 Diamonds',
   '566 Garena Free Fire diamonds delivered to your account — perfect for the Booyah Pass and event skins.',
   'https://play-lh.googleusercontent.com/8wCWhv0r5MAwGGIlL_H-wyQaiKDr4DlNdw3zKlCRu1YfT44aW_sq9ZWeIwku5aNpPTgZSZmp5_s1dgh4OnRT=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/8wCWhv0r5MAwGGIlL_H-wyQaiKDr4DlNdw3zKlCRu1YfT44aW_sq9ZWeIwku5aNpPTgZSZmp5_s1dgh4OnRT=w1052-h592',
     'https://play-lh.googleusercontent.com/LsawRbqk_iyOjjY_NkmKv62sTH9U4WqaF9juPzT0nhN4u9v52SHAfQliNaKpYZgo4KPN2j-cLVI44PhKpuAGJQ=w1052-h592'],
   4.49, null::numeric, 'instructions',
   'Enter your Free Fire player ID at checkout. Diamonds are credited within 5 minutes of payment.',
   'Instant (~5 min)', 'Free Fire', 0, true, 5::int,
   'Top-up service executed by our licensed recharge partner after payment. No buyer account credentials are ever requested.',
   118, 551::numeric, 114),

  -- Roblox ------------------------------------------------------------------------
  ('roblox', 'gift-cards',
   'Roblox Official Game Card — $10 (Digital Code)',
   'Official Roblox game card code worth $10 in Robux credit — redeem at roblox.com/redeem. Digital code delivered right after checkout.',
   'https://play-lh.googleusercontent.com/bHynJCCjTZyc9Lqqx45O5GLX3sWAupY9mSqYn7wndPkwuB4A28txE7NKIpteQ_4t1kGvsRWKRuYiToYTYLtVSg=w1052-h592',
   array[
     'https://play-lh.googleusercontent.com/bHynJCCjTZyc9Lqqx45O5GLX3sWAupY9mSqYn7wndPkwuB4A28txE7NKIpteQ_4t1kGvsRWKRuYiToYTYLtVSg=w1052-h592',
     'https://play-lh.googleusercontent.com/QqZj22aXblAyYDxLQw-Gg0ycW0QkKhrDnwqgERZU9BMRXZnMlgXfq-94sikG5mEpt_I0lzZxcUzfLblmQgwYzUE=s256'],
   10.99, 12.49::numeric, 'instructions',
   'The official card code is shown in your order page immediately after payment confirmation. Redeem at roblox.com/redeem.',
   'Instant', 'Roblox', 50, false, 5::int,
   'Codes sourced through authorized retail distribution. Unused codes are replaced within 48 hours if invalid.'
  , 64, 305::numeric, 62)

) as v(game_slug, cat_slug, title, description, image_url, images,
       price_usd, original_price_usd, delivery_method, delivery_details,
       -- positional aliases: delivery_time + game_name stay here ONLY to keep
       -- the row literals below untouched — the products INSERT above no longer
       -- consumes them (see schema-compatibility note above the insert)
       delivery_time, game_name, stock, stock_is_unlimited, estimated_minutes,
       ownership_note, sold_count, rating_sum, rating_count)
join public.games g              on g.slug = v.game_slug
join public.product_categories c on c.slug = v.cat_slug
cross join lateral (select v_seller as seller_id) sv
where not exists (select 1 from public.products p where p.title = v.title);

-- -----------------------------------------------------------------------------
-- 7. Reload PostgREST's schema cache so new games/categories appear immediately
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

end;
$$;

-- -----------------------------------------------------------------------------
-- Self-check — run outputs should look like a real storefront:
--   8 approved products, 4 active games, allowed rules, zero stale rows hidden
-- -----------------------------------------------------------------------------
select
  count(*) filter (where status = 'approved')                                    as approved_products,
  count(*) filter (where status = 'approved' and image_url is not null)          as approved_with_cover,
  count(*) filter (where status = 'approved' and is_deleted = false)             as visible_on_storefront
from public.products;

select g.name as game, count(p.id) as storefront_listings, min(p.price_usd) as min_price, max(p.price_usd) as max_price
from public.products p
join public.games g on g.id = p.game_id
where p.status = 'approved' and p.is_deleted = false
group by g.name
order by g.name;
