-- ============================================================
-- GrabOn — Database schema (Postgres / Supabase)
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
  create type order_status as enum ('placed', 'accepted', 'packed', 'out_for_delivery', 'delivered', 'cancelled', 'action_required');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'failed', 'cod');
exception when duplicate_object then null; end $$;

do $$ begin
  create type upload_status as enum ('parsing', 'preview', 'importing', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type ledger_party as enum ('admin', 'seller', 'rider');
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
  state text,
  pincode text,
  -- Nullable: orders from sellers without a pinned location aren't blocked
  -- by the 10km delivery-radius check (see /api/orders and lib/geo.ts).
  lat double precision,
  lng double precision,
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
  -- 'seller' = uploaded/set by the seller; 'auto' = fetched from Open Food
  -- Facts during import — only 'auto' images get periodically link-checked.
  image_source text check (image_source in ('seller', 'auto')),
  image_checked_at timestamptz,
  brand text,
  is_active boolean not null default true,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_seller on products(seller_id);
create index if not exists idx_products_image_source on products(image_source);
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
  state text,
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
  other_charges numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  address_id uuid references addresses(id) on delete set null,
  delivery_slot text,
  razorpay_order_id text,
  razorpay_payment_id text,
  rider_id uuid references profiles(id) on delete set null,
  delivery_otp text,
  -- Seller's note when fully cancelling (see migration 013). Per-item stock
  -- issues live on order_items instead (out_of_stock/oos_reason).
  cancel_reason text,
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
  qty integer not null check (qty > 0),
  -- Seller-reported stock issue on this specific item (migration 013) —
  -- flips the parent order to 'action_required' until the buyer resolves it.
  out_of_stock boolean not null default false,
  oos_reason text
);
create index if not exists idx_order_items_order on order_items(order_id);

-- ------------------------------------------------------------
-- ORDER STATUS HISTORY (for the admin lifecycle view — see migration 012)
-- Populated automatically by log_order_status_change(), never written
-- directly by app code.
-- ------------------------------------------------------------
create table if not exists order_status_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_status_events_order on order_status_events(order_id);

create or replace function log_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into order_status_events (order_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$;

drop trigger if exists order_status_events_trg on orders;
create trigger order_status_events_trg
  after insert or update on orders
  for each row execute function log_order_status_change();

-- ------------------------------------------------------------
-- PAYOUT LEDGER
-- Two rows per delivered order, only for money that actually needs to
-- change hands (see migration 011 for the full reasoning):
--   online -> (admin -> seller: subtotal), (admin -> rider: delivery_fee)
--   cod    -> (seller -> rider: delivery_fee), (seller -> admin: other_charges)
-- Inserted by the app (service client) when an order flips to 'delivered'.
-- ------------------------------------------------------------
create table if not exists ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  seller_id uuid not null references sellers(id) on delete cascade,
  rider_id uuid references profiles(id) on delete set null,
  from_party ledger_party not null,
  to_party ledger_party not null,
  amount numeric(10,2) not null,
  label text not null,
  settled boolean not null default false,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_ledger_order on ledger_entries(order_id);
create index if not exists idx_ledger_seller on ledger_entries(seller_id);
create index if not exists idx_ledger_rider on ledger_entries(rider_id);

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
-- PRODUCT IMAGE CACHE (shared brand+name+unit -> image_url lookups, so the
-- same national-brand SKU is only ever looked up via Apify once across the
-- whole app, not once per seller/import). Server-only, see lib/productImage.ts.
-- ------------------------------------------------------------
create table if not exists product_image_cache (
  id uuid primary key default uuid_generate_v4(),
  cache_key text not null unique,
  image_url text,
  checked_at timestamptz not null default now()
);
create index if not exists idx_product_image_cache_key on product_image_cache(cache_key);

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
-- No policies: only the service-role client (bypasses RLS) touches this table.
alter table product_image_cache enable row level security;
alter table ledger_entries enable row level security;
alter table order_status_events enable row level security;

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
-- orders_update is split three ways (buyer/seller/admin), each with its own
-- WITH CHECK constraining what the resulting row can look like — see
-- migration 009 for the full reasoning and the orders_guard_protected_columns
-- trigger that closes the remaining gap (WITH CHECK alone can't stop other
-- columns being smuggled into the same UPDATE statement).
drop policy if exists "orders_update" on orders;
drop policy if exists "orders_update_buyer_cancel" on orders;
create policy "orders_update_buyer_cancel" on orders
  for update
  using (buyer_id = auth.uid() and payment_status = 'pending')
  with check (buyer_id = auth.uid() and status = 'cancelled' and payment_status = 'failed');

drop policy if exists "orders_update_seller" on orders;
create policy "orders_update_seller" on orders
  for update
  using (exists (select 1 from sellers s where s.id = orders.seller_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from sellers s where s.id = orders.seller_id and s.owner_id = auth.uid())
    and status in ('accepted', 'packed', 'cancelled')
  );

drop policy if exists "orders_update_admin" on orders;
create policy "orders_update_admin" on orders
  for update
  using (is_admin())
  with check (is_admin());

create or replace function orders_guard_protected_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.buyer_id is distinct from old.buyer_id
    or new.seller_id is distinct from old.seller_id
    or new.subtotal is distinct from old.subtotal
    or new.delivery_fee is distinct from old.delivery_fee
    or new.total is distinct from old.total
    or new.address_id is distinct from old.address_id
    or new.delivery_slot is distinct from old.delivery_slot
    or new.razorpay_order_id is distinct from old.razorpay_order_id
    or new.razorpay_payment_id is distinct from old.razorpay_payment_id
    or new.rider_id is distinct from old.rider_id
    or new.delivery_otp is distinct from old.delivery_otp
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot modify protected order fields directly';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_protected_columns_trg on orders;
create trigger orders_guard_protected_columns_trg
  before update on orders
  for each row execute function orders_guard_protected_columns();

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

-- ORDER_STATUS_EVENTS: same visibility as the parent order
drop policy if exists "order_status_events_read" on order_status_events;
create policy "order_status_events_read" on order_status_events
  for select using (
    exists (
      select 1 from orders o where o.id = order_status_events.order_id and (
        o.buyer_id = auth.uid()
        or exists (select 1 from sellers s where s.id = o.seller_id and s.owner_id = auth.uid())
        or is_admin()
      )
    )
  );

-- LEDGER_ENTRIES: sellers/riders see their own rows; only the payer (seller,
-- or admin for admin->* rows) can mark an entry settled; service-role client
-- is the only thing that ever inserts a row.
drop policy if exists "ledger_read" on ledger_entries;
create policy "ledger_read" on ledger_entries
  for select using (
    exists (select 1 from sellers s where s.id = ledger_entries.seller_id and s.owner_id = auth.uid())
    or rider_id = auth.uid()
    or is_admin()
  );

drop policy if exists "ledger_settle" on ledger_entries;
create policy "ledger_settle" on ledger_entries
  for update using (
    (from_party = 'seller' and exists (select 1 from sellers s where s.id = ledger_entries.seller_id and s.owner_id = auth.uid()))
    or is_admin()
  )
  with check (
    (from_party = 'seller' and exists (select 1 from sellers s where s.id = ledger_entries.seller_id and s.owner_id = auth.uid()))
    or is_admin()
  );

create or replace function ledger_guard_settle_only()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'service_role' or is_admin() then
    return new;
  end if;

  if new.order_id is distinct from old.order_id
    or new.seller_id is distinct from old.seller_id
    or new.rider_id is distinct from old.rider_id
    or new.from_party is distinct from old.from_party
    or new.to_party is distinct from old.to_party
    or new.amount is distinct from old.amount
    or new.label is distinct from old.label
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Can only update settled/settled_at on a ledger entry';
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_guard_settle_only_trg on ledger_entries;
create trigger ledger_guard_settle_only_trg
  before update on ledger_entries
  for each row execute function ledger_guard_settle_only();

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

-- ------------------------------------------------------------
-- STORAGE: manually-uploaded product photos
-- Public bucket (product photos render in unauthenticated <img> tags on the
-- storefront). Write access is scoped to a seller's own folder
-- (product-images/<seller_id>/...) or to admins for any folder.
-- ------------------------------------------------------------
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
