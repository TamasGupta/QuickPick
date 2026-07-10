-- Migration 002 — delivery partner (rider) assignment + delivery OTP.
--
-- Adds:
--   orders.rider_id     -> the delivery partner assigned to the order
--   orders.delivery_otp -> 4-digit code the buyer shares to confirm delivery
--
-- All rider-facing reads/writes go through server API routes using the service
-- role (with explicit auth checks), so no broad RLS changes are required here.
-- Run this in the Supabase SQL editor.

alter table orders add column if not exists rider_id uuid references profiles(id) on delete set null;
alter table orders add column if not exists delivery_otp text;

create index if not exists idx_orders_rider on orders(rider_id);
