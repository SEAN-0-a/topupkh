-- =============================================================================
-- 0021 — auto-provision public.sellers for new users
-- =============================================================================
-- PROBLEM:
--   public.handle_new_user() (0019/0020) created ONLY the public.profiles row,
--   so every new signup still needed the KYC flow to bootstrap a
--   public.sellers record before the offer form could write public.products
--   (createListing hard-fails with "Apply as a seller first" / the page
--   redirects to /seller/verify).
--
-- public.sellers contract (0001, verified):
--     id              bigserial PK            — auto-generated, never supplied
--     user_id         uuid NOT NULL UNIQUE    — FK → public.profiles(id)
--     display_name    text NOT NULL           — mirrors the profile's name
--     about           text                    — nullable
--     status          seller_status NOT NULL default 'pending'
--                     enum: pending|approved|suspended|rejected
--     payout_*        text (nullable; written by KYC, never guessed)
--     rating_sum / rating_count / completed_sales  — NOT NULL with defaults
--     created_at / updated_at                      — NOT NULL with defaults
--   → the ONLY columns a provisioning insert must supply are
--     (user_id, display_name, status). shop_name does NOT exist here; it
--     lives on public.profiles (added by 0010).
--
-- THIS MIGRATION (idempotent; safe to re-run):
--   1. Backfill: creates the missing sellers row for EVERY existing profile.
--   2. Replaces public.handle_new_user() so a new signup provisions BOTH the
--      profiles row AND the sellers row (status = 'approved') with every
--      required column populated.
--   3. notify pgrst 'reload schema' — PostgREST drops cached plans/policies.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Backfill — one sellers row per profile (ran-before-safeness: the UNIQUE
--    constraint on user_id + ON CONFLICT DO NOTHING makes this replayable)
-- -----------------------------------------------------------------------------
insert into public.sellers (user_id, display_name, status)
select p.id,
       p.display_name,
       'approved'
from public.profiles p
where not exists (
  select 1 from public.sellers s where s.user_id = p.id
)
on conflict (user_id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. public.handle_new_user() — provisions profiles + sellers in one trigger
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  meta         jsonb;
  display_name text;
begin
  meta := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  -- 1) Google OAuth metadata (full_name preferred, then plain name)
  display_name := nullif(btrim(coalesce(meta->>'full_name', meta->>'name')), '');

  -- 2) Email username prefix ("sok.dara@gmail.com" -> "sok.dara")
  if display_name is null then
    display_name := nullif(btrim(split_part(coalesce(new.email, ''), '@', 1)), '');
  end if;

  -- Neutral fallback for anonymous signups / metadata-less accounts
  display_name := coalesce(display_name, 'Player');

  -- Collapse runs of whitespace (Google names can be messy), cap at 40 chars —
  -- mirrors the server-side validation in src/app/actions/profile.ts.
  display_name := left(regexp_replace(display_name, '\s+', ' ', 'g'), 40);

  insert into public.profiles (id, display_name, shop_name)
  values (
    new.id,
    display_name,
    left(display_name || ' Shop', 80) -- mirrors the 2..80 shop_name validation in submit_seller_kyc
  )
  on conflict (id) do nothing;

  -- The sellers row rides along with the profile: only (user_id, display_name,
  -- status) are non-default NOT NULL columns; payout/rating fields keep their
  -- column defaults (payout stays NULL until the seller's own KYC fills it).
  insert into public.sellers (user_id, display_name, status)
  values (
    new.id,
    display_name,
    'approved'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- Rebind the trigger to the updated function. (SQLEditor-safe: recreate
-- trigger unconditionally.)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 3. Supabase realtime + PostgREST plan cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Self-check — re-run any time; outputs must be non-empty and correct
-- -----------------------------------------------------------------------------
-- (a) every profile can see its own seller record
select 'missing-sellers' as check, count(*) as orphan_profiles
from public.profiles p
left join public.sellers s on s.user_id = p.id
where s.id is null;

-- (b) the trigger function contains the sellers provisioning insert
select 'trigger-fn' as check, p.proname
from pg_proc p
where p.proname = 'handle_new_user'
  and p.pronamespace = 'public'::regnamespace
  and p.prosrc like '%public.sellers%';

-- (c) trigger is still bound to the function
select 'signup-trigger' as check, t.tgname
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where t.tgname = 'on_auth_user_created'
  and t.tgrelid = 'auth.users'::regclass
  and p.proname = 'handle_new_user'
  and p.pronamespace = 'public'::regnamespace;