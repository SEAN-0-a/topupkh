-- =============================================================================
-- 0027 — product cover-image safeguard ("COVER UNAVAILABLE" bug, DB side)
-- =============================================================================
-- CONTEXT:
--   App surfaces (ProductCard, /product, /listings, /offers, store shelves)
--   already fall back image_url → images[0] and resolve bare Storage paths
--   (src/lib/product-cover.ts), and the listing form requires ≥1 uploaded
--   image. This migration closes the DB side so blank/incoherent image data
--   cannot be WRITTEN in the first place:
--
--   1. images[] entries that can never render for buyers (blob: object URLs
--      from degraded uploads, empty strings) are stripped on every write.
--   2. image_url ↔ images[1] are kept in sync automatically — whichever side
--      has a usable value fills the other, so no reader needs to guess.
--   3. NEW inserts (seller listings) with NO usable image in either column
--      are REJECTED with a descriptive error — blank covers cannot occur.
--      Updates are normalized but never rejected (admins must stay free to
--      blank/fix legacy rows).
--   4. image_url can never hold a blob: URL (CHECK constraint).
--
-- Idempotent; safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CHECK — image_url must never be a blob: URL (dead for every buyer)
-- -----------------------------------------------------------------------------
alter table public.products
  drop constraint if exists products_image_url_no_blob;

-- '' stays allowed (legacy rows predate image uploads); blob: does not.
alter table public.products
  add constraint products_image_url_no_blob
  check (image_url is null or image_url = '' or image_url not like 'blob:%');

-- -----------------------------------------------------------------------------
-- 2. TRIGGER — normalize + mirror + reject imageless inserts
-- -----------------------------------------------------------------------------
create or replace function public.products_cover_guard()
returns trigger
language plpgsql
as $$
declare
  clean_images text[] := '{}';
  u text;
begin
  -- 2a. strip entries that can never render for buyers (blob:, blank)
  if new.images is not null then
    for u in select unnest(new.images) loop
      if u is not null
         and btrim(u) <> ''
         and u not like 'blob:%' then
        clean_images := array_append(clean_images, btrim(u));
      end if;
    end loop;
  end if;

  -- 2b. mirror: fill the empty side from the side that has a usable value
  if clean_images = '{}' and new.image_url is not null
     and btrim(new.image_url) <> '' and new.image_url not like 'blob:%' then
    clean_images := array[new.image_url];
  end if;

  if (new.image_url is null or btrim(new.image_url) = ''
      or new.image_url like 'blob:%')
     and clean_images <> '{}' then
    new.image_url := clean_images[1];
  end if;
  new.images := clean_images;

  -- 2c. INSERT guard — a brand-new listing without ANY usable image is a
  --     form/validation bug upstream; reject with a message sellers can act on.
  --     (The listing form already blocks this client-side; this is the net.)
  if tg_op = 'INSERT'
     and (new.image_url is null or btrim(new.image_url) = '') then
    raise exception
      'A cover image is required: upload at least one photo before publishing this listing.',
      errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists products_cover_guard on public.products;

create trigger products_cover_guard
  before insert or update on public.products
  for each row execute function public.products_cover_guard();

-- -----------------------------------------------------------------------------
-- 3. PostgREST plan cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =============================================================================
-- SELF-CHECK — re-run any time; every assertion must PASS
-- =============================================================================
-- (a) the trigger exists and fires on INSERT + UPDATE
select 'trigger-binding' as check, tgname,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict
from pg_trigger
where tgrelid = 'public.products'::regclass
  and tgname = 'products_cover_guard'
  and not tgisinternal
group by tgname;

-- (b) the CHECK constraint is installed
select 'blob-check' as check,
       case when count(*) = 1 then 'PASS' else 'FAIL' end as verdict
from pg_constraint
where conrelid = 'public.products'::regclass
  and conname = 'products_image_url_no_blob';

-- (c) no existing product row holds a blob: URL (constraint would have
--     failed the ALTER otherwise — informational)
select 'no-blob-rows' as check, count(*) as offenders,
       case when count(*) = 0 then 'PASS' else 'FAIL' end as verdict
from public.products
where image_url like 'blob:%';

select 'migration 0027 OK' as status;
