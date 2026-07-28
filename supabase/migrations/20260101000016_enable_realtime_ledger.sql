-- Migration 016 — enable Realtime replication for ledger_entries.
--
-- Prerequisite for replacing RiderEarnings' poll (in RiderDashboard.tsx)
-- with a postgres_changes subscription. Unlike orders (no rider-facing RLS
-- policy — see migration comments in rider.ts), ledger_entries already has
-- `ledger_read` allowing rider_id = auth.uid() directly, so this one is
-- safe to subscribe to client-side with no policy changes.
alter publication supabase_realtime add table ledger_entries;
