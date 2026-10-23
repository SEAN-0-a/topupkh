-- SDL v1
-- =============================================================================
-- 0014 — dynamically provision eligibility_rules for every active
--        (game x category) pair, so /seller/listings/new can submit ANY valid
--        combination without "This game/category combination is not
--        configured." (action) or "…prohibited for this game (eligibility=
--        unconfigured)" (products_eligibility_check trigger).
--
-- WHY: rules are seeded per-pair; any (game, category) pair without a row is
-- rejected by the products_eligibility_check trigger at INSERT time — even
-- before admin review. To "allow all categories for active games" the policy
-- rows must exist. This script derives them from the categories' own
-- default_eligibility, so KNOWN prohibited/compliance categories
-- (Accounts, Robux & Currency, In-Game Items) stay prohibited and others
-- default to needs_review (an admin should flip to allowed after review).
--
-- HOW: Supabase SQL Editor -> paste -> Run. Idempotent (on conflict do nothing).
-- =============================================================================

insert into public.eligibility_rules (game_id, category_id, status, reason)
select g.id,
       c.id,
       case c.default_eligibility
         when 'prohibited' then 'prohibited'::eligibility_status
         else 'needs_review'::eligibility_status
       end,
       case c.default_eligibility
         when 'prohibited' then
           coalesce(c.description, 'Prohibited category — violates marketplace policy')
         else
           coalesce(c.description, 'Auto-provisioned when the pair was first used; review to allow publishing')
       end
from public.games g
join public.product_categories c
  on true
where g.is_active
  and c.is_active
on conflict (game_id, category_id) do nothing;

-- Reload PostgREST's schema cache: this also repairs the API-side
-- "type 'user_role' does not exist" (42704) that made
-- eligibility_rules / product_categories / profiles unreadable from REST
-- (which is what forced the form into its static fallback dropdowns in the
-- first place). If the dashboard docs still look stale, re-run this line.
notify pgrst, 'reload schema';

-- Self-check: uncounted pairs remaining (active-only) should be ZERO.
select g.id as game_id, c.id as category_id, g.slug as game, c.slug as category
from public.games g
join public.product_categories c on true
left join public.eligibility_rules r
  on r.game_id = g.id and r.category_id = c.id
where g.is_active and c.is_active and r.id is null;
