-- =============================================================================
-- 0021-fix — stop "Database error saving new user (unexpected_failure)" on
--            Google OAuth sign-in  (supersedes 0021_auto_provision_sellers.sql)
-- =============================================================================
-- DIAGNOSIS (why sign-in crashes):
--   Google OAuth signup inserts the user into auth.users, and Supabase runs
--   the `on_auth_user_created` trigger INSIDE that transaction. If any
--   trigger errors, GoTrue cannot commit the user row and returns
--   `unexpected_failure`. Four failure modes exist in this schema:
--
--   1. DRIFTED TRIGGER BINDING. 0001, 0019, 0020 and the old 0021 each redefine
--      handle_new_user() / create_profile_for_user() and re-bind
--      `on_auth_user_created`. If the files ran in a different order (or 0001
--      was re-run later), the binding can point back at the DEAD 0001
--      bootstrap function — or several ad-hoc triggers from manual
--      SQL-Editor attempts can all fire at once.
--   2. NO EXCEPTION GUARD. Any single error inside the trigger aborts the
--      whole signup: e.g. `sellers.display_name` is NOT NULL with no default,
--      `seller_status` is an enum (typmod churn history here — 0016), or any
--      schema drift. Nothing between the Google redirect and the crash.
--   3. ORPHAN ACCOUNTS. Users created during the failing period have
--      auth.users rows with NO profiles / sellers row — nothing repairs them,
--      so the app keeps misbehaving after sign-in "succeeds".
--   4. Hangovers from the old `create_profile_for_user()` function that 0019
--      dropped but a re-run of 0001 silently re-created.
--
-- COLUMN CONTRACT (verified against 0001 + 0010, nothing is guessed):
--   public.profiles (id uuid PK → auth.users(id) on delete cascade)
--       id             uuid NOT NULL            — = NEW.id
--       display_name   text NOT NULL default 'Cambodian Gamer'  — we override
--       username       text unique, nullable    — left NULL
--       locale         text NOT NULL default 'km' CHECK (km, en) — default OK
--       role           user_role NOT NULL default 'buyer'        — default OK
--       seller_type    seller_type_enum NOT NULL default 'individual'
--       shop_name      text nullable            — "{display} Shop"
--       verification_status NOT NULL default 'unverified'
--   public.sellers (id bigserial PK — AUTO, never supplied)
--       user_id        uuid NOT NULL UNIQUE → profiles(id) — = NEW.id
--       display_name   text NOT NULL (NO DEFAULT)             — we override
--       status         seller_status NOT NULL default 'pending' — we set
--       payout_*, about, ratings, timestamps — NOT NULL-with-default or NULL
--   ⇒ provisioning insert must supply exactly (user_id, display_name, status).
--
-- THIS MIGRATION (idempotent; safe to re-run):
--   1. Sweeps EVERY non-internal trigger off auth.users (no name guessing).
--   2. Drops the legacy create_profile_for_user() function.
--   3. Installs a bulletproof public.handle_new_user(): every write is wrapped
--      in BEGIN…EXCEPTION WHEN others THEN RAISE WARNING, with a retry using
--      column defaults. Auth sign-in can NEVER be blocked by provisioning.
--   4. Rebinds exactly ONE trigger on auth.users.
--   5. Guarantees EXECUTE on the trigger function for supabase_auth_admin.
--   6. Backfills/repairs orphaned auth users (missing profiles/sellers rows).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SWEEP — remove EVERY user-visible trigger on auth.users
-- -----------------------------------------------------------------------------
-- Trigger names are unique per table, but manual SQL-Editor attempts may have
-- created differently-named triggers (e.g. `on_user_created`, `auth_user_ins`).
-- We drop everything not flagged internal, then install exactly one below.
do $$
declare
  trg record;
  dropped int := 0;
begin
  for trg in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trg.tgname);
    dropped := dropped + 1;
    raise notice 'swept trigger %.% on auth.users', 'auth', trg.tgname;
  end loop;
  raise notice 'auth.users trigger sweep complete (% removed)', dropped;
end $$;

-- The legacy 0001 bootstrap function must not linger — if `on_auth_user_created`
-- was ever re-bound to it by a re-run of 0001, any INSERT into auth.users would
-- try to execute it while the profiles-read functions may have drifted.
drop function if exists public.create_profile_for_user();

-- -----------------------------------------------------------------------------
-- 2. BULLETPROOF handle_new_user() — provisioning can never fail a signup
-- -----------------------------------------------------------------------------
-- Structure: preferred insert first (rich columns), and if ANYTHING fails the
-- EXCEPTION block logs a WARNING and retries with the schema's own column
-- defaults; even if that retry fails, the function still returns NEW so the
-- auth transaction commits. A missing profile row is inconvenient for the
-- marketplace UI but recoverable — a failed Google sign-in is not.
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

  -- 3) Neutral fallback for anonymous signups / metadata-less accounts
  display_name := coalesce(display_name, 'Player');

  -- Collapse runs of whitespace (Google names can be messy), cap at 40 chars —
  -- mirrors the server-side validation in src/app/actions/profile.ts.
  display_name := left(regexp_replace(display_name, '\s+', ' ', 'g'), 40);

  -- --------------------------------------------------------------------------
  -- 2a. profiles row — required by the app, wrapped so ANY error (missing
  --     enum, drift, permissions) degrades to a WARNING, not a signup crash.
  -- --------------------------------------------------------------------------
  begin
    insert into public.profiles (id, display_name, shop_name)
    values (
      new.id,
      display_name,
      left(display_name || ' Shop', 80) -- mirrors the 2..80 shop_name validation
    )
    on conflict (id) do nothing;
  exception
    when others then
      raise warning 'handle_new_user: profiles rich insert failed for % : % (SQLSTATE %)',
        new.id, sqlerrm, sqlstate;
      -- retry with NOTHING but the id: every other column has a schema default
      begin
        insert into public.profiles (id)
        values (new.id)
        on conflict (id) do nothing;
      exception
        when others then
          -- even now, do NOT re-raise: sign-in must proceed
          raise warning 'handle_new_user: profiles fallback insert failed for % : % (SQLSTATE %)',
            new.id, sqlerrm, sqlstate;
      end;
  end;

  -- --------------------------------------------------------------------------
  -- 2b. sellers row — rides along with the profile (0021 contract). The FK is
  --     user_id → profiles(id), and the profile insert above is committed
  --     inside this same transaction, so the constraint is satisfied. If the
  --     retry path in 2a degraded the profile insert, this can fail too —
  --     delete-cascade keeps integrity either way.
  -- --------------------------------------------------------------------------
  begin
    insert into public.sellers (user_id, display_name, status)
    values (
      new.id,
      display_name,
      'approved'
    )
    on conflict (user_id) do nothing;
  exception
    when others then
      raise warning 'handle_new_user: sellers rich insert failed for % : % (SQLSTATE %)',
        new.id, sqlerrm, sqlstate;
      -- retry supplying only the NOT NULL columns:
      --   user_id + display_name (status falls back to its 'pending' default)
      begin
        insert into public.sellers (user_id, display_name)
        values (new.id, display_name)
        on conflict (user_id) do nothing;
      exception
        when others then
          -- one last resort: display_name has NO default on public.sellers,
          -- so fall back to the exact hardcoded default the profiles column
          -- carries — better a provisioned row than a crashed signup
          begin
            insert into public.sellers (user_id, display_name)
            values (new.id, 'Cambodian Gamer')
            on conflict (user_id) do nothing;
          exception
            when others then
              raise warning 'handle_new_user: sellers fallback insert failed for % : % (SQLSTATE %)',
                new.id, sqlerrm, sqlstate;
          end;
      end;
  end;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. EXACTLY ONE trigger on auth.users, bound to the robust function
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- 4. EXECUTE privilege — the trigger fires as supabase_auth_admin; CREATE
--    FUNCTION grants EXECUTE to PUBLIC by default, but an earlier revoke of
--    blanket privileges must not be able to break OAuth. Guarded because the
--    role name differs on a few self-hosted setups.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant execute on function public.handle_new_user() to supabase_auth_admin';
  end if;
  grant execute on function public.handle_new_user() to anon, authenticated;
end $$;

-- -----------------------------------------------------------------------------
-- 5. ORPHAN REPAIR — backfill every auth user whose provisioning trigger
--    crashed or silently degraded. Per-row guarded so one bad legacy row
--    cannot abort the repair sweep itself.
-- -----------------------------------------------------------------------------
do $$
declare
  u   record;
  nm  text;
begin
  for u in
    select u.id,
           left(regexp_replace(coalesce(
             nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name',
                                        u.raw_user_meta_data->>'name')), ''),
             nullif(btrim(split_part(coalesce(u.email, ''), '@', 1)), ''),
             'Player'
           ), '\s+', ' ', 'g'), 40) as name
    from auth.users u
  loop
    nm := u.name;

    begin
      insert into public.profiles (id, display_name, shop_name)
      values (u.id, nm, left(nm || ' Shop', 80))
      on conflict (id) do nothing;
    exception
      when unique_violation then null;  -- raced another writer: fine
      when others then
        raise warning 'orphan-backfill: profiles repair skipped for % : % (SQLSTATE %)',
          u.id, sqlerrm, sqlstate;
    end;

    begin
      insert into public.sellers (user_id, display_name, status)
      values (u.id, nm, 'approved')
      on conflict (user_id) do nothing;
    exception
      when unique_violation then null;
      when others then
        raise warning 'orphan-backfill: sellers repair skipped for % : % (SQLSTATE %)',
          u.id, sqlerrm, sqlstate;
    end;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 6. PostgREST — drop cached prepared plans / re-introspect schema
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =============================================================================
-- SELF-CHECK — re-run any time; every assertion must PASS
-- =============================================================================
-- (a) EXACTLY one user-visible trigger remains on auth.users …
select 'triggers-count' as check, count(*) as user_triggers,
       case when count(*) = 1 then 'PASS' else 'FAIL — sweep again' end as verdict
from pg_trigger
where tgrelid = 'auth.users'::regclass and not tgisinternal;

-- (b) … and it executes public.handle_new_user()
select 'trigger-binding' as check, t.tgname, p.proname,
       case when p.proname = 'handle_new_user' then 'PASS' else 'FAIL' end as verdict
from pg_trigger t
join pg_proc    p on p.oid = t.tgfoid
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

-- (c) the function is security definer with a pinned search_path
select 'function-hardening' as check, p.prosecdef as is_security_definer,
       p.proconfig::text     as settings,
       case when p.prosecdef then 'PASS' else 'FAIL' end as verdict
from pg_proc p
where p.proname = 'handle_new_user'
  and p.pronamespace = 'public'::regnamespace;

-- (d) no orphaned auth users remain (both counts must be 0)
select 'orphan-profiles' as check, count(*) as orphans,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as verdict
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

select 'orphan-sellers' as check, count(*) as orphans,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as verdict
from public.profiles p
left join public.sellers s on s.user_id = p.id
where s.id is null;

-- (e) the legacy bootstrap function is gone
select 'legacy-fn-removed' as check, count(*) as remaining,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as verdict
from pg_proc p
where p.proname = 'create_profile_for_user'
  and p.pronamespace = 'public'::regnamespace;

select 'migration 0021-fix OK' as status;
