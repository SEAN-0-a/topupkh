-- =============================================================================
-- Migration 0024: serve game icons LOCALLY from public/image/
-- =============================================================================
-- The storefront seed previously stored remote Google Play artwork URLs in
-- games.icon_url (and 0005 used rbxcdn links that expire in ~180 days).
-- The real PNGs now live in the repo at public/image/<slug>.png, so badges
-- on product cards / game banners render the official logos from local
-- static files — no remote dependency, no 404 fallbacks.
--
-- This only touches rows that exist; it is safe to re-run.
-- =============================================================================

-- PREREQUISITE GUARD
do $$
begin
  if to_regclass('public.games') is null then
    raise exception
      'PREREQUISITE MISSING: public.games does not exist. Run 0001_marketplace_schema.sql (or 0003/0004) first.';
  end if;
end;
$$;

update public.games
set icon_url = '/image/' || slug || '.png'
where slug in ('mobile-legends', 'pubg-mobile', 'free-fire', 'roblox');

-- Roblox game-platform icons from 0005: same local-path treatment applied to
-- any of those rows that exist locally. Their files must be present in
-- public/image/ before this runs — files fetched for the storefront set are
-- committed; fetch the rest or leave these rows on their remote URLs.
-- (Left commented out so this migration never knowingly points at a missing
-- local file, which would show the browser's broken-image fallback.)
--
-- update public.games
-- set icon_url = '/image/' || slug || '.png'
-- where slug in ('brookhaven-rp', 'steal-a-brainrot', 'blox-fruits',
--                'adopt-me', 'grow-a-garden', 'murder-mystery-2')
--   and exists (select 1);

-- verify in the SQL editor: icon_url should be a local path for each row
select slug, name, is_active, icon_url from public.games order by sort_order;

notify pgrst, 'reload schema';
