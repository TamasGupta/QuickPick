-- Migration 004 — tracking for auto-fetched product images.
--
-- image_source distinguishes seller-uploaded images (which sellers manage
-- themselves) from ones we auto-fetched from Open Food Facts, so the
-- broken-link recheck job only touches the ones it's responsible for.
-- image_checked_at records the last time we confirmed the URL is reachable.

alter table products add column if not exists image_source text
  check (image_source in ('seller', 'auto'));
alter table products add column if not exists image_checked_at timestamptz;

create index if not exists idx_products_image_source on products(image_source);
