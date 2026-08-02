-- Migration 019 — push_subscriptions table for Web Push notifications.
--
-- One row per subscribed browser/device (a user logged in on two devices
-- gets two rows). `endpoint` is the push service URL the browser vendor
-- assigns per-subscription — globally unique, doubles as the natural
-- upsert key so re-subscribing the same device just refreshes its keys
-- instead of creating a duplicate row. p256dh/auth are the subscription's
-- encryption keys, required by the Web Push protocol to encrypt payloads
-- server-side (see lib/push.ts).
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- Owner only — same pattern as addresses_own. Sending (looking up a
-- target user's subscriptions from a server-side event handler) always
-- goes through the service-role client, which bypasses RLS entirely.
drop policy if exists "push_subscriptions_own" on push_subscriptions;
create policy "push_subscriptions_own" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
