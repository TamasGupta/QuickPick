-- ============================================================
-- QuickPick — Database schema (Postgres / Supabase)
-- Run in Supabase SQL editor (or `supabase db push`).
-- Includes tables, indexes, Row-Level Security (RLS) policies,
-- and helper functions for atomic stock decrement.
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
do $$ begin
  create type user_role as enum ('buyer', 'seller', 'admin', 'rider');
exception when duplicate_object then null; end $$;

do $$ begin
  create type seller_status as enum ('pending', 'approved', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum ('placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'failed', 'cod');
exception when duplicate_object then null; end $$;

do $$ begin
  create type upload_status as enum ('parsing', 'preview', 'importing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- PROFILES  (1:1 with auth.users)
-- ------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'buyer',
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row when a new auth user signs up.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.phone)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Convenience: is the current user an admin?
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

-- ------------------------------------------------------------
-- SELLERS
-- ------------------------------------------------------------
create table if not exists sellers (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  store_name text not null,
  status seller_status not null default 'pending',
  phone text,
  address_line text,
  city text,
  pincode text,
  created_at timestamptz not null default now(),
  unique(owner_id)
);
create index if not exists idx_sellers_status on sellers(status);

-- ------------------------------------------------------------
-- CATEGORIES
-- ------------------------------------------------------------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  icon text
);

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references sellers(id) on delete cascade,
  name text not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  price numeric(10,2) not null check (price >= 0),
  mrp numeric(10,2),
  unit text default 'unit',
  stock integer not null default 0 check (stock >= 0),
  sku text,
  image_url text,
  brand text,
  is_active boolean not null default true,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_seller on products(seller_id);
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_products_active on products(is_active);
create index if not exists idx_products_search on products using gin(search_tsv);
-- Full (non-partial) unique index so `ON CONFLICT (seller_id, sku)` works for
-- upserts. NULL skus are treated as distinct in Postgres, so products without a
-- SKU are still allowed.
drop index if exists idx_products_seller_sku;
create unique index if not exists idx_products_seller_sku on products(seller_id, sku);

-- Full-text search vector maintenance
create or replace function products_tsv_update()
returns trigger language plpgsql as $$
begin
  new.search_tsv :=
    setweight(to_tsvector('simple', coalesce(new.name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.brand,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.description,'')), 'C');
  new.updated_at := now();
  return new;
end; $$;

drop trigger if exists trg_products_tsv on products;
create trigger trg_products_tsv before insert or update on products
  for each row execute function products_tsv_update();

-- ------------------------------------------------------------
-- ADDRESSES
-- ------------------------------------------------------------
create table if not exists addresses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text default 'Home',
  line1 text not null,
  line2 text,
  city text,
  pincode text not null,
  lat double precision,
  lng double precision,
  is_default boolean default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_addresses_user on addresses(user_id);

-- ------------------------------------------------------------
-- ORDERS + ORDER ITEMS
-- ------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  status order_status not null default 'placed',
  payment_status payment_status not null default 'pending',
  subtotal numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  address_id uuid references addresses(id) on delete set null,
  delivery_slot text,
  razorpay_order_id text,
  razorpay_payment_id text,
  rider_id uuid references profiles(id) on delete set null,
  delivery_otp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_orders_buyer on orders(buyer_id);
create index if not exists idx_orders_seller on orders(seller_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_rider on orders(rider_id);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  qty integer not null check (qty > 0)
);
create index if not exists idx_order_items_order on order_items(order_id);

-- ------------------------------------------------------------
-- UPLOAD JOBS (bulk import audit trail)
-- ------------------------------------------------------------
create table if not exists upload_jobs (
  id uuid primary key default uuid_generate_v4(),
  seller_id uuid not null references sellers(id) on delete cascade,
  file_name text,
  file_type text,        -- csv | xlsx | pdf
  status upload_status not null default 'parsing',
  total_rows integer default 0,
  imported integer default 0,
  errors jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_upload_jobs_seller on upload_jobs(seller_id);

-- ------------------------------------------------------------
-- ATOMIC STOCK DECREMENT (called on payment success / COD accept)
-- Decrements stock for each item; raises if insufficient.
-- ------------------------------------------------------------
create or replace function decrement_stock(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  item record;
begin
  for item in select product_id, qty from order_items where order_id = p_order_id and product_id is not null loop
    update products
      set stock = stock - item.qty
      where id = item.product_id and stock >= item.qty;
    if not found then
      raise exception 'Insufficient stock for product %', item.product_id;
    end if;
  end loop;
end; $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles     enable row level security;
alter table sellers      enable row level security;
alter table categories   enable row level security;
alter table products     enable row level security;
alter table addresses    enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;
alter table upload_jobs  enable row level security;

-- PROFILES: user sees/edits own; admin sees all
drop policy if exists "profiles_self" on profiles;
create policy "profiles_self" on profiles
  for select using (id = auth.uid() or is_admin());
drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update using (id = auth.uid());

-- Sellers and delivery partners are onboarded by the super admin only — a
-- BEFORE UPDATE trigger (not RLS) blocks a user from self-promoting their
-- own role, since RLS can't cleanly compare old vs new column values.
-- `current_user <> 'service_role'` lets our trusted server-side admin API
-- routes (which connect with the service-role key and have no auth.uid()
-- JWT context at all) set roles; is_admin() covers the RLS-bound client path.
create or replace function protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and current_user <> 'service_role' and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_profile_role on profiles;
create trigger trg_protect_profile_role before update on profiles
  for each row execute function protect_profile_role();

-- SELLERS: public can read approved; owner reads/writes own; admin all
drop policy if exists "sellers_read" on sellers;
create policy "sellers_read" on sellers
  for select using (status = 'approved' or owner_id = auth.uid() or is_admin());
-- Only admins create sellers (via the service-role admin API route).
drop policy if exists "sellers_insert_own" on sellers;
create policy "sellers_insert_own" on sellers
  for insert with check (is_admin());
drop policy if exists "sellers_update_own" on sellers;
create policy "sellers_update_own" on sellers
  for update using (owner_id = auth.uid() or is_admin());

-- CATEGORIES: readable by everyone; only admin writes
drop policy if exists "categories_read" on categories;
create policy "categories_read" on categories for select using (true);
drop policy if exists "categories_admin_write" on categories;
create policy "categories_admin_write" on categories for all using (is_admin()) with check (is_admin());

-- PRODUCTS: public reads active products; seller manages own; admin all
drop policy if exists "products_read" on products;
create policy "products_read" on products
  for select using (
    is_active = true
    or exists (select 1 from sellers s where s.id = products.seller_id and s.owner_id = auth.uid())
    or is_admin()
  );
drop policy if exists "products_seller_write" on products;
create policy "products_seller_write" on products
  for all using (
    exists (select 1 from sellers s where s.id = products.seller_id and s.owner_id = auth.uid())
    or is_admin()
  ) with check (
    exists (select 1 from sellers s where s.id = products.seller_id and s.owner_id = auth.uid())
    or is_admin()
  );

-- ADDRESSES: owner only
drop policy if exists "addresses_own" on addresses;
create policy "addresses_own" on addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ORDERS: buyer sees own; seller sees orders for their store; admin all
drop policy if exists "orders_read" on orders;
create policy "orders_read" on orders
  for select using (
    buyer_id = auth.uid()
    or exists (select 1 from sellers s where s.id = orders.seller_id and s.owner_id = auth.uid())
    or is_admin()
  );
drop policy if exists "orders_buyer_insert" on orders;
create policy "orders_buyer_insert" on orders
  for insert with check (buyer_id = auth.uid());
drop policy if exists "orders_update" on orders;
create policy "orders_update" on orders
  for update using (
    buyer_id = auth.uid()
    or exists (select 1 from sellers s where s.id = orders.seller_id and s.owner_id = auth.uid())
    or is_admin()
  );

-- ORDER_ITEMS: visible if parent order is visible
drop policy if exists "order_items_read" on order_items;
create policy "order_items_read" on order_items
  for select using (
    exists (
      select 1 from orders o where o.id = order_items.order_id and (
        o.buyer_id = auth.uid()
        or exists (select 1 from sellers s where s.id = o.seller_id and s.owner_id = auth.uid())
        or is_admin()
      )
    )
  );
drop policy if exists "order_items_insert" on order_items;
create policy "order_items_insert" on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_items.order_id and o.buyer_id = auth.uid())
  );

-- UPLOAD_JOBS: seller owner only
drop policy if exists "upload_jobs_own" on upload_jobs;
create policy "upload_jobs_own" on upload_jobs
  for all using (
    exists (select 1 from sellers s where s.id = upload_jobs.seller_id and s.owner_id = auth.uid())
    or is_admin()
  ) with check (
    exists (select 1 from sellers s where s.id = upload_jobs.seller_id and s.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- SEED: default categories
-- ------------------------------------------------------------
insert into categories (name, slug, icon) values
  ('Fruits & Vegetables', 'fruits-vegetables', '🥦'),
  ('Dairy & Bread',       'dairy-bread',       '🥛'),
  ('Snacks & Munchies',   'snacks',            '🍿'),
  ('Beverages',           'beverages',         '🥤'),
  ('Staples & Grains',    'staples',           '🌾'),
  ('Personal Care',       'personal-care',     '🧴'),
  ('Household',           'household',         '🧽'),
  ('Instant Food',        'instant-food',      '🍜')
on conflict (slug) do nothing;
