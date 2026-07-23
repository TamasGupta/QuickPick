-- Migration 012 — order status history, for the admin lifecycle view.
--
-- `orders.status` only ever holds the CURRENT status — there was no record of
-- when each transition (placed -> accepted -> packed -> out_for_delivery ->
-- delivered) actually happened, so no way to show durations between stages.
--
-- Rather than adding an insert call at every one of the ~5 places that change
-- orders.status (checkout cancel, seller accept/pack, rider pickup/deliver,
-- the cron sweep), a trigger logs every transition automatically — including
-- the initial 'placed' on insert — so it can never drift out of sync with
-- reality no matter what code path changes the status later.

create table if not exists order_status_events (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_status_events_order on order_status_events(order_id);

alter table order_status_events enable row level security;

-- Same visibility as the parent order.
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
-- No insert/update/delete policy — only the trigger below (running as the
-- table owner) ever writes to this table.

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
