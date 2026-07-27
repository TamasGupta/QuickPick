-- Migration 013 — seller-reported stock issues on an order.
--
-- Previously a seller could only flat-out cancel an order — no way to say
-- "this ONE item is out of stock, everything else is fine" and let the
-- buyer decide whether to continue without it. Adds:
--
--   orders.cancel_reason        — seller's note when fully cancelling
--   order_items.out_of_stock    — per-item flag the seller sets
--   order_items.oos_reason      — seller's note for that specific item
--   order_status 'action_required' — order is paused, waiting on the buyer
--     to either continue (drop the flagged items, optionally add more to
--     stay above the minimum order value) or cancel outright
--
-- All the actual status/total mutations for this flow go through dedicated
-- API routes (report-issue, resolve-issue) using the service-role client,
-- the same pattern already used for rider actions and payment verification
-- — so no RLS policy changes are needed here; the existing orders_read /
-- order_items_read policies already cover the new columns since they're
-- plain SELECT * policies.

alter type order_status add value if not exists 'action_required';

alter table orders add column if not exists cancel_reason text;

alter table order_items add column if not exists out_of_stock boolean not null default false;
alter table order_items add column if not exists oos_reason text;
