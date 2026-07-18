-- 0029_family_media_storage
--
-- Durable, family-isolated cloud storage for milestone evidence (photos, audio,
-- video, PDFs, written work). Files live in Supabase Storage; the database keeps
-- only the path (public.milestone_evidence.file_path). Replaces the base64-in-
-- localStorage stopgap — which capped files at ~2.5 MB and never left the browser.
--
-- ISOLATION MODEL — the whole point:
--   Every object's path is  {family_id}/{child_or_family}/{uuid.ext}
--   The first path segment IS the family_id, and every storage operation is gated
--   by is_family_member() on that segment. So a member of family A can only read,
--   upload, change or delete files under family A's folder — never another family's.
--   The 50 MB ceiling is enforced server-side on the bucket, not just in the client.

-- Private bucket, 50 MB per file, evidence-appropriate mime types.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media', 'family-media', false, 52428800,   -- 50 * 1024 * 1024
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
    'audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/webm','audio/x-m4a',
    'video/mp4','video/quicktime','video/webm','video/x-matroska','video/3gpp',
    'application/pdf','text/plain','text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Row-level security on the objects in THIS bucket. The first folder of the path
-- is the family_id; the caller must be an active member of that family. A path
-- whose first segment isn't a valid family uuid fails the cast and is denied
-- (fails closed). Mirrors the family_id RLS used everywhere else in the schema.
drop policy if exists "family_media_select" on storage.objects;
drop policy if exists "family_media_insert" on storage.objects;
drop policy if exists "family_media_update" on storage.objects;
drop policy if exists "family_media_delete" on storage.objects;

create policy "family_media_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'family-media'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "family_media_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'family-media'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "family_media_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'family-media'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'family-media'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );

create policy "family_media_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'family-media'
    and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );
