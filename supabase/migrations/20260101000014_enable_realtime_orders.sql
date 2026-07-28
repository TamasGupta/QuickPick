-- Migration 014 — enable Realtime replication for order-related tables.
--
-- Prerequisite for replacing client-side polling (setInterval) with
-- postgres_changes subscriptions (see BuyerOrdersList, SellerOrdersList,
-- OrderStatusLive). Supabase does not stream a table's changes over
-- Realtime until it's added to the supabase_realtime publication — existing
-- RLS policies still fully apply to what a subscribed client actually
-- receives, this only turns on the replication feed itself.
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table order_items;
