-- MoneyHash payment records and webhook inbox. Service-role writes these rows.
create table if not exists public.moneyhash_payments (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores_data(id) on delete cascade,
  order_id text not null,
  intent_id text,
  transaction_id text,
  idempotency_key uuid not null,
  status text not null default 'PENDING',
  amount numeric(18,2) not null check (amount > 0),
  currency text not null,
  raw_intent jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, idempotency_key),
  unique (store_id, intent_id)
);
create index if not exists moneyhash_payments_store_order_idx on public.moneyhash_payments(store_id, order_id);
create table if not exists public.moneyhash_webhook_events (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores_data(id) on delete cascade,
  event_key text not null,
  intent_id text,
  status text not null default 'processing' check (status in ('processing','completed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (store_id, event_key)
);
create index if not exists moneyhash_webhook_events_store_idx on public.moneyhash_webhook_events(store_id, created_at desc);
alter table public.moneyhash_payments enable row level security;
alter table public.moneyhash_webhook_events enable row level security;
revoke all on public.moneyhash_payments from anon, authenticated;
revoke all on public.moneyhash_webhook_events from anon, authenticated;
