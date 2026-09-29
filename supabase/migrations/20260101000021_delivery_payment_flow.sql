-- Migration 021 — delivery payment flow (COD UPI + rider settlement)
-- Adds fields to track payment mode and Razorpay orders for delivery payments

alter table orders add column if not exists payment_mode text check (payment_mode in ('cash', 'upi'));
alter table orders add column if not exists razorpay_delivery_order_id text;
alter table orders add column if not exists razorpay_delivery_payment_id text;
alter table orders add column if not exists delivery_payment_status text default 'pending' check (delivery_payment_status in ('pending', 'paid', 'failed'));
alter table orders add column if not exists rider_remittance_due numeric(10, 2) default 0;
alter table orders add column if not exists rider_remittance_status text default 'none' check (rider_remittance_status in ('none', 'pending', 'paid', 'failed'));
alter table orders add column if not exists razorpay_remittance_order_id text;
alter table orders add column if not exists razorpay_remittance_payment_id text;

create index if not exists idx_orders_payment_mode on orders(payment_mode);
create index if not exists idx_orders_delivery_payment_status on orders(delivery_payment_status);
create index if not exists idx_orders_rider_remittance_status on orders(rider_remittance_status);