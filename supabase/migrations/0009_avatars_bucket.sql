-- =============================================================================
-- 0009: Avatar uploads (public `avatars` storage bucket + RLS policies)
--
-- Run: supabase db execute (or SQL editor) — idempotent.
-- Powers src/app/settings/page.tsx: users upload to avatars/<uid>/... and the
-- public URL is saved to profiles.avatar_url (via updateProfile action).
-- =============================================================================

-- 1. Public bucket (idempotent if slot exists)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'avatars') then
    insert into storage.buckets (id, name, public)
    values ('avatars', 'avatars', true);
  else
    update storage.buckets set public = true where id = 'avatars';
  end if;
end $$;

-- 2. Policies: users fully manage files under their own <uid>/ "folder";
--    anyone (anon included) can read, because the bucket is public.
drop policy if exists avatar_owner_insert on storage.objects;
create policy avatar_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatar_owner_update on storage.objects;
create policy avatar_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatar_owner_delete on storage.objects;
create policy avatar_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public buckets still require an explicit read policy:
drop policy if exists avatar_public_read on storage.objects;
create policy avatar_public_read on storage.objects
  for select using (bucket_id = 'avatars');
