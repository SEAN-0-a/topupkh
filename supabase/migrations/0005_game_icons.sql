-- =============================================================================
-- Migration 0005: Roblox game icons (verified fresh URLs, Oct 2026)
-- =============================================================================
-- The URLs originally supplied were DEAD (all returned HTTP 404 — rbxcdn
-- "180DAY-" links expire). These were fetched fresh from Roblox's thumbnail
-- API on 2026-10-21 and verified HTTP 200 before being written here.
--
-- Uses UPSERT so it works whether or not the game rows exist, and is safe to
-- re-run. rbxcdn links expire again in ~180 days — re-run with fresh URLs
-- when icons go blank.
-- =============================================================================

-- PREREQUISITE GUARD — 0005 upserts into the games table created by 0001.
do $$
begin
  if to_regclass('public.games') is null then
    raise exception
      'PREREQUISITE MISSING: public.games does not exist. Run 0001_marketplace_schema.sql (or 0003/0004) first.';
  end if;
end;
$$;

insert into public.games (slug, name, sort_order, is_active, icon_url) values
  ('brookhaven-rp',    'Brookhaven RP',    10, true, 'https://tr.rbxcdn.com/180DAY-245d78e6940e8cce07af3874cb58f021/512/512/Image/Png/noFilter'),
  ('steal-a-brainrot', 'Steal a Brainrot', 20, true, 'https://tr.rbxcdn.com/180DAY-09aa780a140d0d38e45b6e5b8b85317d/512/512/Image/Png/noFilter'),
  ('blox-fruits',      'Blox Fruits',      30, true, 'https://tr.rbxcdn.com/180DAY-774ec14539b264f85fdb6e8a34dfa344/512/512/Image/Png/noFilter'),
  ('adopt-me',         'Adopt Me!',        40, true, 'https://tr.rbxcdn.com/180DAY-b8643902ddd894dc03f124cffc7d69af/512/512/Image/Png/noFilter'),
  ('grow-a-garden',    'Grow a Garden',    50, true, 'https://tr.rbxcdn.com/180DAY-bb1bfb0a4a017068b255d6dd515aec2c/512/512/Image/Png/noFilter'),
  ('murder-mystery-2', 'Murder Mystery 2', 60, true, 'https://tr.rbxcdn.com/180DAY-ab1484ff8063476d413da09dd25df93f/512/512/Image/Png/noFilter')
on conflict (slug) do update
  set icon_url  = excluded.icon_url,
      is_active = true;

-- verify right in the SQL editor:
select slug, name, is_active, icon_url from public.games order by sort_order;

notify pgrst, 'reload schema';
