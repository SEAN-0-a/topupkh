-- =============================================================================
-- 0031 — public `products` storage bucket (simplified seller listing covers)
-- =============================================================================
-- CONTEXT:
--   The simplified seller listing form (src/components/SimpleCreateListingForm.tsx)
--   uploads the cover photo DIRECTLY from the browser to a public Storage
--   bucket named `products` and saves the returned public URL into
--   public.products.image_url (migration 0027's cover guard then guarantees
--   the column can never be blank/blob on INSERT).
--
--   The bucket previously existed only as a manual-setup step (docs/SETUP.md
--   documents `product-images` as the manual public bucket), so any upload to
--   `products` failed with "bucket not found" — one of the root causes of
--   listings landing with empty image_url and rendering the storefront's
--   "COVER UNAVAILABLE" placeholder. This migration makes the bucket and its
--   policies a first-class, idempotent part of the schema.
--
-- THE MIGRATION (idempotent; safe to re-run):
--   1. Public `products` bucket — image mime types only, 5 MiB per file.
--   2. Storage policies (same shape as 0009 avatars):
--        - anyone (anon included) can READ — the bucket is public
--        - authenticated users can INSERT/UPDATE/DELETE only under their own
--          `<auth.uid()>/` folder (the form uploads to `${userId}/...`)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. the bucket (idempotent; also normalizes an existing manual bucket)
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'products') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('products', 'products', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  else
    update storage.buckets
    set public = true,
        file_size_limit = 5242880,
        allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    where id = 'products';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. policies — public read; authenticated sellers manage their own folder
-- -----------------------------------------------------------------------------
drop policy if exists products_bucket_public_read on storage.objects;
create policy products_bucket_public_read on storage.objects
  for select using (bucket_id = 'products');

drop policy if exists products_bucket_owner_insert on storage.objects;
create policy products_bucket_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists products_bucket_owner_update on storage.objects;
create policy products_bucket_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists products_bucket_owner_delete on storage.objects;
create policy products_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 3. plan cache
-- -----------------------------------------------------------------------------
notify pgrst, 'reload schema';

-- =============================================================================
-- SELF-CHECK — re-run any time; every assertion must PASS
-- =============================================================================
select 'products-bucket' as check,
       case when count(*) = 1 and bool_or(public) then 'PASS' else 'FAIL' end as verdict
from storage.buckets
where id = 'products';

select 'storage-policies' as check,
       count(*) as policy_count,
       case when count(*) = 4 then 'PASS' else 'FAIL' end as verdict
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'products_bucket%';

select 'migration 0031 OK' as status;
