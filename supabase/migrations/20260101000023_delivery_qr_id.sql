-- Migration 023 — track Razorpay QR id used for delivery payment

alter table orders add column if not exists delivery_qr_id text;
create index if not exists idx_orders_delivery_qr_id on orders(delivery_qr_id);
