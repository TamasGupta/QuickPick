-- Migration 017 — let riders see packed & unclaimed orders directly via RLS.
--
-- Until now, riders had no orders_read visibility at all (see rider.ts) —
-- the "available" tab and its badge count went through a service-role API
-- route instead, which meant they could only ever be polled, not
-- subscribed to via Realtime. This adds a second, narrowly-scoped
-- permissive policy (combined with the existing orders_read via OR) that
-- exposes exactly the same rows the API route already returns: packed and
-- not yet claimed by anyone. It does not expose a rider's own claimed
-- orders, other buyers' orders, or anything the service-role route wasn't
-- already handing back.
drop policy if exists "orders_read_available_for_riders" on orders;
create policy "orders_read_available_for_riders" on orders
  for select using (
    status = 'packed'
    and rider_id is null
    and exists (select 1 from profiles where id = auth.uid() and role = 'rider')
  );
