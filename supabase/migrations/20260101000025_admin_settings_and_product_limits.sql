-- Migration 025: Platform settings and product cart restrictions
-- Allows admin to configure delivery charges, other charges, cart limits, and product-level purchase restrictions.

-- 1. App settings table (single row 'default')
create table if not exists app_settings (
  id text primary key default 'default',
  delivery_fee numeric(10,2) not null default 25 check (delivery_fee >= 0),
  other_charges numeric(10,2) not null default 15 check (other_charges >= 0),
  min_order_amount numeric(10,2) not null default 99 check (min_order_amount >= 0),
  max_cart_items integer not null default 20 check (max_cart_items > 0),
  max_qty_per_product integer not null default 10 check (max_qty_per_product > 0),
  updated_at timestamptz not null default now()
);

-- Seed default settings row if not present
insert into app_settings (id, delivery_fee, other_charges, min_order_amount, max_cart_items, max_qty_per_product)
values ('default', 25, 15, 99, 20, 10)
on conflict (id) do nothing;

-- 2. Product-specific cart restrictions table
create table if not exists product_restrictions (
  product_id uuid primary key references products(id) on delete cascade,
  max_qty integer not null check (max_qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Optional direct column on products table
alter table products add column if not exists max_order_qty integer check (max_order_qty is null or max_order_qty > 0);

-- 4. Enable RLS
alter table app_settings enable row level security;
alter table product_restrictions enable row level security;

-- RLS Policies for app_settings:
-- Anyone (buyers, sellers, riders) can read platform settings
drop policy if exists "app_settings_read" on app_settings;
create policy "app_settings_read" on app_settings for select using (true);

-- Only admins can modify platform settings
drop policy if exists "app_settings_admin_write" on app_settings;
create policy "app_settings_admin_write" on app_settings for all using (is_admin()) with check (is_admin());

-- RLS Policies for product_restrictions:
-- Anyone can read restrictions (needed for cart/checkout enforcement)
drop policy if exists "product_restrictions_read" on product_restrictions;
create policy "product_restrictions_read" on product_restrictions for select using (true);

-- Only admins can insert/update/delete restrictions
drop policy if exists "product_restrictions_admin_write" on product_restrictions;
create policy "product_restrictions_admin_write" on product_restrictions for all using (is_admin()) with check (is_admin());
