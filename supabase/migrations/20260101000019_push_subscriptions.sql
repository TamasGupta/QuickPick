-- Migration 019 — web push subscriptions.
--
-- The app already keeps the UI live with Realtime while it's open, but there
-- was nothing to reach the seller/rider when the tab or app is closed. This
-- stores the browser's Web Push subscription (one row per device/endpoint) so
-- server-side routes can wake the PWA with a push. Sent via the web-push npm
-- package in src/lib/push.ts, driven from /api/push/subscribe (register) and
-- the order/status API routes (trigger).
--
-- Endpoints are keyed by the browser-generated endpoint URL: if the same
-- browser re-subscribes (or a new user logs in on it), the upsert on `endpoint`
-- just replaces the owning row instead of accumulating dead ones.
-- `role` is denormalized ('seller' | 'rider') so a broadcast to all riders can
-- be one indexed query instead of a join through profiles on every send.

create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('seller', 'rider')),
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_push_subscriptions_user on push_subscriptions(user_id);
create index if not exists idx_push_subscriptions_role on push_subscriptions(role);

alter table push_subscriptions enable row level security;

-- A user manages only their own subscriptions. The subscribe route writes via
-- the logged-in user's cookie client (RLS-bound), so auth.uid() is the user
-- who owns the browser endpoint. The service-role client (which sendPush uses
-- to read and to sweep stale 410 rows) bypasses RLS entirely.
drop policy if exists "push_subscriptions_own" on push_subscriptions;
create policy "push_subscriptions_own" on push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
