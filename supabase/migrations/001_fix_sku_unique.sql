-- Migration 001 — fix product SKU uniqueness so bulk-import upserts work.
--
-- The original schema created a PARTIAL unique index:
--   create unique index ... on products(seller_id, sku) where sku is not null;
-- Postgres cannot use a partial index as an `ON CONFLICT` target, so
-- `upsert(..., { onConflict: 'seller_id,sku' })` failed with:
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- Replace it with a full unique index (NULL skus remain distinct/allowed).
--
-- Run this in the Supabase SQL editor if you applied schema.sql before this fix.

drop index if exists idx_products_seller_sku;
create unique index if not exists idx_products_seller_sku on products(seller_id, sku);
