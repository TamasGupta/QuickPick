-- Migration 024 — let riders select orders assigned to them for Realtime updates.
--
-- Migration 020 only allowed riders to read unclaimed orders (rider_id is null).
-- Once a rider claimed an order, they lost RLS SELECT access, which silently blocked
-- Supabase Realtime postgres_changes events for active deliveries (e.g. delivery_payment_status).
-- This policy allows riders to read orders assigned to them.
drop policy if exists "orders_read_assigned_to_rider" on orders;
create policy "orders_read_assigned_to_rider" on orders
  for select using (
    rider_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid() and role = 'rider')
  );
