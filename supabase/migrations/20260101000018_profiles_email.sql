-- Migration 018 — add profiles.email; auth moves from phone+OTP to email+OTP.
--
-- profiles.phone was previously the login identity (mirrored from
-- auth.users.phone by handle_new_user()) and, for buyers/riders, doubled as
-- the only contact number surfaced for delivery calls (rider<->buyer). Auth
-- is moving to email (WhatsApp OTP needs a verified Meta Business account we
-- don't have; phone/SMS OTP was never reliably delivering either), so
-- phone is repurposed as a plain, unverified contact field collected on the
-- registration form — every existing reader of profiles.phone (lib/rider.ts,
-- OrderStatusLive, live-tracking routes) keeps working unchanged, it's just
-- populated by a form field now instead of the auth provider.
alter table profiles add column if not exists email text;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
