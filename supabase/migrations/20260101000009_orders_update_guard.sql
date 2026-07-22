-- Migration 009 — lock down what buyers/sellers can change on `orders`.
--
-- The original "orders_update" policy had a USING clause (who can target a
-- row) but no WITH CHECK, so it didn't constrain what the resulting row
-- could look like — an authenticated buyer or seller could, in principle,
-- push any column to any value on a row they're allowed to touch (pricing,
-- rider_id, delivery_otp, even seller_id/buyer_id), as long as the WHERE
-- clause matched. This splits the single policy into three narrow ones and
-- adds a trigger so RLS *and* column-level protection both hold:
--
--   - buyers   may only flip their own still-pending order to cancelled/failed
--     (mirrors checkout/page.tsx's own cancelUnpaidOrder(), now enforced at
--     the DB layer too)
--   - sellers  may only advance through accepted -> packed -> cancelled
--     (out_for_delivery/delivered are rider-only transitions — previously
--     the seller's own status API technically accepted those values too,
--     even though the UI never sent them)
--   - admins   keep full access, unchanged
--
-- Everything else (rider claim/pickup/deliver, Razorpay verify, the cron
-- sweep, admin tooling) goes through createServiceSupabase() and must stay
-- completely unrestricted — the guard trigger below explicitly exempts
-- auth.role() = 'service_role'.

drop policy if exists "orders_update" on orders;

create policy "orders_update_buyer_cancel" on orders
  for update
  using (buyer_id = auth.uid() and payment_status = 'pending')
  with check (buyer_id = auth.uid() and status = 'cancelled' and payment_status = 'failed');

create policy "orders_update_seller" on orders
  for update
  using (exists (select 1 from sellers s where s.id = orders.seller_id and s.owner_id = auth.uid()))
  with check (
    exists (select 1 from sellers s where s.id = orders.seller_id and s.owner_id = auth.uid())
    and status in ('accepted', 'packed', 'cancelled')
  );

create policy "orders_update_admin" on orders
  for update
  using (is_admin())
  with check (is_admin());

-- Belt-and-braces: WITH CHECK above only constrains `status`/`payment_status`
-- on the resulting row — it doesn't stop the same UPDATE statement from also
-- smuggling in a changed price, rider_id, or owner column. This trigger
-- rejects any change to those fields unless the connection is the
-- service-role client (RLS-bypassing, but triggers still run for it).
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
