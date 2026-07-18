-- Migration 006 — add `state` alongside city/pincode on sellers and
-- addresses, so reverse-geocoded location data (from GPS or a pasted Google
-- Maps link) has somewhere to land. Nullable/additive — safe on top of
-- already-provisioned databases.

alter table sellers add column if not exists state text;
alter table addresses add column if not exists state text;
