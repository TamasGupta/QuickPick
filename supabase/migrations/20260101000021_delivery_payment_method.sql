-- Migration 021 — payment now resolved at the door, not at checkout.
--
-- Checkout becomes COD-only (Razorpay checkout.js commented out — see
-- checkout/page.tsx and /api/payment/create|verify). When the rider reaches
-- the buyer, the buyer chooses cash or a QR scan (Razorpay, platform
-- account) right there. `delivery_payment_method` records which; a QR
-- payment still flips `payment_status` to 'paid' via the Razorpay webhook
-- (see /api/webhooks/razorpay), same as the old checkout-time online flow —
-- cash leaves `payment_status` at 'cod' through delivery, which
-- /api/rider/[action]'s deliver handler uses to pick the right ledger split.
alter table orders add column if not exists delivery_payment_method text
  check (delivery_payment_method in ('cash', 'online'));
alter table orders add column if not exists razorpay_qr_id text;

-- Extend the protected-columns guard to cover the two new columns (defense
-- in depth — these are only ever written by service-role rider/webhook
-- routes, which already bypass this trigger, but a direct RLS-bound client
-- call should still be rejected same as the other order-lifecycle columns).
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
    or new.delivery_payment_method is distinct from old.delivery_payment_method
    or new.razorpay_qr_id is distinct from old.razorpay_qr_id
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Cannot modify protected order fields directly';
  end if;

  return new;
end;
$$;
