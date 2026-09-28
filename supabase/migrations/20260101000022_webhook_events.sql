-- Migration 022 — webhook events table for idempotency
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  created_at timestamptz default now()
);

create index if not exists idx_webhook_events_event_id on webhook_events(event_id);