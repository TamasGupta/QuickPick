-- Migration 005 — seller location + delivery radius enforcement.
--
-- Sellers previously had no coordinates at all (only free-text city/pincode),
-- making a "buyer must be within N km" rule impossible to compute. Adds
-- lat/lng so /api/orders can enforce a 10km delivery radius server-side.
-- Nullable — orders from sellers without a pinned location aren't blocked
-- (can't enforce a rule we have no data for), so this rolls out safely on
-- top of already-existing sellers until an admin sets their location.

alter table sellers add column if not exists lat double precision;
alter table sellers add column if not exists lng double precision;
