-- Migration 003 — admin-controlled onboarding.
--
-- Sellers and delivery partners are now created by the super admin only
-- (via /api/admin/sellers/create and /api/admin/riders/create using the
-- service-role client). This migration closes the two ways a regular buyer
-- could previously self-promote:
--   1. Directly updating their own profiles.role via the client SDK
--      (the old RiderJoin/SellerOnboard flows did exactly this).
--   2. Directly inserting a row into `sellers` for themselves.
--
-- Run this in the Supabase SQL editor.

-- 1) Role changes require admin privileges. A BEFORE UPDATE trigger is used
--    instead of RLS WITH CHECK because Postgres RLS can't easily compare
--    "old vs new" for a single column without a self-referential subquery.
-- `current_user <> 'service_role'` lets our trusted server-side admin API
-- routes (which connect with the service-role key and have no auth.uid()
-- JWT context at all) set roles; is_admin() covers the RLS-bound client path.
create or replace function protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and current_user <> 'service_role' and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end; $$;

drop trigger if exists trg_protect_profile_role on profiles;
create trigger trg_protect_profile_role before update on profiles
  for each row execute function protect_profile_role();

-- 2) Only admins may insert seller rows directly (the admin API route uses
--    the service-role client, which bypasses RLS entirely, so this only
--    blocks a buyer's own browser from self-inserting one).
drop policy if exists "sellers_insert_own" on sellers;
create policy "sellers_insert_own" on sellers
  for insert with check (is_admin());
