-- Migration 015 — enable Realtime replication for the products table.
--
-- Prerequisite for replacing SellerStatsLive's poll with a postgres_changes
-- subscription (product count needs to react to seller product changes, not
-- just order changes already covered by migration 014).
alter publication supabase_realtime add table products;
