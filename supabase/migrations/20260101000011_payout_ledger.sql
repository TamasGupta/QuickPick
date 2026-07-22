-- Migration 011 — payout ledger.
--
-- The money for an order splits three ways once delivered: the seller keeps
-- the subtotal, the rider keeps the delivery fee, the platform keeps
-- other_charges. WHO IS HOLDING THE CASH depends on payment method:
--
--   - Online (Razorpay): the whole `total` lands with the platform up front.
--     The platform then owes the seller their subtotal and the rider their
--     delivery fee — it already keeps other_charges, so that never needs an
--     entry.
--   - COD: the rider collects the whole `total` in cash and hands it ALL to
--     the seller (per how this app's COD handoff works). The seller then
--     owes the rider their delivery fee and owes the platform its
--     other_charges — the seller already keeps their own subtotal, so that
--     never needs an entry either.
--
-- So exactly two ledger rows get created per delivered order, only for the
-- money that actually needs to change hands:
--   online -> (admin -> seller: subtotal), (admin -> rider: delivery_fee)
--   cod    -> (seller -> rider: delivery_fee), (seller -> admin: other_charges)
--
-- Entries are inserted by the app (src/app/api/rider/[action]/route.ts, the
-- "deliver" action) using the service client, right when an order flips to
-- 'delivered' — that's the moment the cash actually moves. Settling an entry
-- (recording that the payer actually paid the payee, e.g. by bank transfer)
-- is a manual action taken by whoever the ledger says is the payer; there's
-- no real money movement here, just bookkeeping (see ledger_settle below).

do $$ begin
  create type ledger_party as enum ('admin', 'seller', 'rider');
exception when duplicate_object then null; end $$;

create table if not exists ledger_entries (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  -- Denormalized so RLS + "my ledger" queries don't need to join orders.
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

alter table ledger_entries enable row level security;

-- Read: sellers see rows where they're either party; riders see rows where
-- they're the rider; admins see everything.
drop policy if exists "ledger_read" on ledger_entries;
create policy "ledger_read" on ledger_entries
  for select using (
    exists (select 1 from sellers s where s.id = ledger_entries.seller_id and s.owner_id = auth.uid())
    or rider_id = auth.uid()
    or is_admin()
  );

-- Settle: only the party the ledger says OWES the money can mark it settled
-- (the seller for seller->* rows, since sellers are authenticated app users
-- with a direct RLS identity here) — plus admins, who can settle anything
-- (including admin->* rows, which sellers/riders can't touch since they're
-- not the payer). Riders never settle anything; they're only ever a payee.
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

-- No insert/delete policy for authenticated users — entries are only ever
-- created by the service-role client (which bypasses RLS), never by a seller,
-- rider, or admin directly.

-- Belt-and-braces, same pattern as orders_guard_protected_columns: the
-- policy above lets a seller UPDATE a row they owe on, but doesn't stop that
-- same statement from also changing the amount/parties/order_id in the same
-- call. This trigger restricts non-admin, non-service-role updates to only
-- the settled/settled_at columns.
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
