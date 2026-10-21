-- =============================================================================
-- Migration 0006: Eldorado-style category tabs
-- =============================================================================
-- Adds the categories behind the new nav tabs:
--   Currency | Accounts | Top Ups | Items | Boosting | Gift Cards
--
-- COMPLIANCE DEFAULTS (per marketplace policy — spec §5):
--   robux-currency, accounts, in-game-items  -> PROHIBITED (Roblox ToS)
--   top-ups, boosting, gift-cards            -> NEEDS_REVIEW (admin must
--                                               verify before enabling)
-- Admins can flip status in eligibility_rules AFTER verifying rights.
-- Idempotent; safe to re-run.
-- =============================================================================

-- PREREQUISITE GUARD — 0006 inserts into the catalogue tables created by 0001.
do $$
begin
  if to_regclass('public.product_categories') is null
     or to_regclass('public.eligibility_rules') is null then
    raise exception
      'PREREQUISITE MISSING: product_categories/eligibility_rules do not exist. Run 0001_marketplace_schema.sql first.';
  end if;
end;
$$;

insert into public.product_categories (slug, name, description, default_eligibility, stock_model) values
  ('top-ups',    'Top Ups',    'Direct top-up services delivered to the buyer''s account or game', 'needs_review', 'unlimited'),
  ('boosting',   'Boosting',   'Rank / progress boosting services',                                'needs_review', 'unlimited'),
  ('gift-cards', 'Gift Cards', 'Official digital gift card codes',                                 'needs_review', 'finite')
on conflict (slug) do nothing;

-- currency / accounts / items reuse the prohibited categories seeded in 0001/0004
-- (robux-currency, accounts, in-game-items). Re-assert the prohibition here so
-- the tabs can never silently become purchasable without an explicit admin flip:
update public.product_categories
set default_eligibility = 'prohibited', is_active = false
where slug in ('robux-currency', 'accounts', 'in-game-items');

-- extend eligibility rules to any Roblox x new-category pair (idempotent)
insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id, c.id, c.default_eligibility,
       case when c.default_eligibility = 'prohibited'
            then 'Violates Roblox Terms of Use — blocks unauthorized trading outside official systems'
            else 'Requires manual admin verification before this category may go live' end
from public.games g, public.product_categories c
where g.slug = 'roblox'
on conflict (game_id, category_id) do nothing;

notify pgrst, 'reload schema';

-- check the tab categories:
select slug, name, default_eligibility from public.product_categories order by slug;
