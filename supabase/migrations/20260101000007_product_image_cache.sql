-- Migration 007 — shared product image cache.
--
-- Apify's Google Images Scraper is slow (10-30s per call) and billed
-- per-use, but many sellers list the exact same national-brand SKUs
-- ("Amul Gold Full Cream Milk 500 ml" shows up in catalog after catalog).
-- This table caches brand+name+unit -> image_url lookups so the same
-- product is only ever looked up once across the whole app, not once per
-- seller/import. Server-only: RLS is enabled with no policies, so only the
-- service-role client (which bypasses RLS) can read/write it — there's no
-- legitimate anon/authenticated use case for this table.

create table if not exists product_image_cache (
  id uuid primary key default uuid_generate_v4(),
  cache_key text not null unique,
  image_url text,
  checked_at timestamptz not null default now()
);
create index if not exists idx_product_image_cache_key on product_image_cache(cache_key);

alter table product_image_cache enable row level security;
