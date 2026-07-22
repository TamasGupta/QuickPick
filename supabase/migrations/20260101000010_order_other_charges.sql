-- Migration 010 — a separate "other charges" line item on orders (packaging/
-- handling/gateway fees), distinct from the delivery fee. Stored per-order
-- (like delivery_fee already is) rather than computed on the fly, so past
-- orders keep showing whatever the fee actually was when they were placed
-- even if NEXT_PUBLIC_OTHER_CHARGES changes later.

alter table orders add column if not exists other_charges numeric(10,2) not null default 0;
