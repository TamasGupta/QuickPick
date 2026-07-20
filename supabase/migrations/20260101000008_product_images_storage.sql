-- Migration 008 — Supabase Storage bucket for manually-uploaded product
-- photos, so sellers/admins can upload a file from their device instead of
-- only ever pasting an external image URL.
--
-- Public bucket: product photos are shown directly in <img> tags on the
-- storefront with no auth, so they must be publicly readable — same trust
-- level as the auto-fetched image_url values already stored today.
-- Path convention: product-images/<seller_id>/<uuid>.<ext> — write access is
-- scoped to a seller's own folder (matched against sellers.owner_id), or to
-- admins for any folder.

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_read" on storage.objects;
create policy "product_images_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_images_insert" on storage.objects;
create policy "product_images_insert" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and (
      exists (
        select 1 from sellers s
        where s.owner_id = auth.uid() and s.id::text = (storage.foldername(name))[1]
      )
      or public.is_admin()
    )
  );

drop policy if exists "product_images_update" on storage.objects;
create policy "product_images_update" on storage.objects
  for update using (
    bucket_id = 'product-images'
    and (
      exists (
        select 1 from sellers s
        where s.owner_id = auth.uid() and s.id::text = (storage.foldername(name))[1]
      )
      or public.is_admin()
    )
  );

drop policy if exists "product_images_delete" on storage.objects;
create policy "product_images_delete" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and (
      exists (
        select 1 from sellers s
        where s.owner_id = auth.uid() and s.id::text = (storage.foldername(name))[1]
      )
      or public.is_admin()
    )
  );
