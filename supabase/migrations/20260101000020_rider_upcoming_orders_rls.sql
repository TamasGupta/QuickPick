-- Migration 020 — riders now see unclaimed orders from the beginning of the
-- pipeline (placed/accepted/packed), not just once packed. The "Available"
-- tab shows the full order but only lets the rider claim it once it's
-- actually packed — this widens the same RLS policy from migration 017 so
-- Realtime keeps working for the earlier statuses too, instead of only
-- picking up the transition into 'packed'.
drop policy if exists "orders_read_available_for_riders" on orders;
create policy "orders_read_available_for_riders" on orders
  for select using (
    status in ('placed', 'accepted', 'packed')
    and rider_id is null
    and exists (select 1 from profiles where id = auth.uid() and role = 'rider')
  );
