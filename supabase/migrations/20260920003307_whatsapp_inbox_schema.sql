-- WhatsApp Business-style inbox schema for Supabase
-- Project: 1toolz-app
-- Safe to run more than once (idempotent where practical).
--
-- This migration intentionally keeps messages separate from orders.
-- Existing orders.whatsappLogs / orders.whatsapp_logs remain as a backward-compatible cache.
-- The application should use whatsapp_messages as the source of truth for the inbox.

create extension if not exists pgcrypto;

-- 1) One conversation per store + customer phone + optional order.
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores_data(id) on delete cascade,
  order_id text references public.orders(id) on delete set null,
  customer_phone text not null,
  customer_name text,
  status text not null default 'open'
    check (status in ('open', 'pending', 'resolved', 'archived')),
  assigned_to text,
  unread_count integer not null default 0 check (unread_count >= 0),
  last_message_id uuid,
  last_message_preview text,
  last_message_direction text
    check (last_message_direction is null or last_message_direction in ('incoming', 'outgoing', 'system')),
  last_message_at timestamptz,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  is_muted boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A phone can have more than one order, but only one active conversation per order.
create unique index if not exists whatsapp_conversations_store_order_uidx
  on public.whatsapp_conversations(store_id, order_id)
  where order_id is not null;

create index if not exists whatsapp_conversations_inbox_idx
  on public.whatsapp_conversations(store_id, is_archived, last_message_at desc nulls last);

create index if not exists whatsapp_conversations_unread_idx
  on public.whatsapp_conversations(store_id, unread_count desc, last_message_at desc nulls last)
  where unread_count > 0;

create index if not exists whatsapp_conversations_phone_idx
  on public.whatsapp_conversations(store_id, customer_phone);

-- 2) Immutable-ish message records. Updates are used only for delivery/read status.
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  store_id text not null references public.stores_data(id) on delete cascade,
  order_id text references public.orders(id) on delete set null,
  customer_phone text not null,
  provider text not null default 'meta_cloud'
    check (provider in ('meta_cloud', 'ultramsg', 'direct_web', 'system')),
  provider_message_id text,
  direction text not null
    check (direction in ('incoming', 'outgoing', 'system')),
  message_type text not null default 'text'
    check (message_type in ('text', 'interactive', 'template', 'image', 'document', 'audio', 'video', 'location', 'system')),
  body text not null default '',
  sender_name text,
  sender_phone text,
  recipient_phone text,
  status text not null default 'received'
    check (status in ('queued', 'sent', 'delivered', 'read', 'received', 'failed')),
  error_code text,
  error_message text,
  buttons jsonb not null default '[]'::jsonb,
  media jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Provider IDs are the main idempotency key for Meta/UltraMsg webhooks.
create unique index if not exists whatsapp_messages_provider_uidx
  on public.whatsapp_messages(provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages(conversation_id, occurred_at asc, created_at asc);

create index if not exists whatsapp_messages_store_time_idx
  on public.whatsapp_messages(store_id, occurred_at desc);

create index if not exists whatsapp_messages_order_idx
  on public.whatsapp_messages(store_id, order_id, occurred_at asc)
  where order_id is not null;

create index if not exists whatsapp_messages_phone_idx
  on public.whatsapp_messages(store_id, customer_phone, occurred_at desc);

-- 3) Optional status history: useful for Meta delivery/read webhooks and audits.
create table if not exists public.whatsapp_message_events (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.whatsapp_messages(id) on delete cascade,
  store_id text not null references public.stores_data(id) on delete cascade,
  provider text not null default 'meta_cloud',
  provider_event_id text,
  status text not null
    check (status in ('queued', 'sent', 'delivered', 'read', 'failed', 'received')),
  event_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists whatsapp_message_events_provider_uidx
  on public.whatsapp_message_events(provider, provider_event_id)
  where provider_event_id is not null;

create index if not exists whatsapp_message_events_message_idx
  on public.whatsapp_message_events(message_id, event_at asc);

-- 4) Keep updated_at consistent.
create or replace function public.set_whatsapp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_conversations_updated_at on public.whatsapp_conversations;
create trigger trg_whatsapp_conversations_updated_at
before update on public.whatsapp_conversations
for each row execute function public.set_whatsapp_updated_at();

drop trigger if exists trg_whatsapp_messages_updated_at on public.whatsapp_messages;
create trigger trg_whatsapp_messages_updated_at
before update on public.whatsapp_messages
for each row execute function public.set_whatsapp_updated_at();

-- 5) On every inserted message, update the inbox preview and unread counter.
create or replace function public.update_whatsapp_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_conversations
  set
    customer_phone = coalesce(nullif(new.customer_phone, ''), customer_phone),
    order_id = coalesce(new.order_id, order_id),
    last_message_id = new.id,
    last_message_preview = left(coalesce(new.body, ''), 240),
    last_message_direction = new.direction,
    last_message_at = coalesce(new.occurred_at, new.created_at),
    unread_count = case
      when new.direction = 'incoming' then unread_count + 1
      else unread_count
    end,
    updated_at = now()
  where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists trg_whatsapp_message_inbox_update on public.whatsapp_messages;
create trigger trg_whatsapp_message_inbox_update
after insert on public.whatsapp_messages
for each row execute function public.update_whatsapp_conversation_from_message();

-- 6) Convenience function to mark a conversation read from the dashboard.
create or replace function public.mark_whatsapp_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.whatsapp_messages
  set read_at = coalesce(read_at, now()),
      status = case when direction = 'incoming' and status <> 'failed' then 'read' else status end,
      updated_at = now()
  where conversation_id = p_conversation_id
    and direction = 'incoming'
    and read_at is null;

  update public.whatsapp_conversations
  set unread_count = 0, updated_at = now()
  where id = p_conversation_id;
end;
$$;

-- 7) Realtime publication. The DO blocks avoid duplicate-table errors on re-runs.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_conversations'
  ) then
    execute 'alter publication supabase_realtime add table public.whatsapp_conversations';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'whatsapp_messages'
  ) then
    execute 'alter publication supabase_realtime add table public.whatsapp_messages';
  end if;
end;
$$;

-- 8) RLS baseline.
-- The current application uses a custom users/stores model rather than Supabase Auth.
-- Therefore no anon policies are created here: the application should access these
-- tables through the trusted webhook/edge function or after adopting Supabase Auth.
-- Enable RLS now to prevent accidental public exposure. Add store-membership policies
-- when auth.uid() is connected to the application's store membership table.
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_message_events enable row level security;

-- Service-role calls from Edge Functions bypass RLS. For a browser client using the
-- anon key, create explicit membership policies only after the auth model is ready.

comment on table public.whatsapp_conversations is 'WhatsApp inbox conversations, one per store/order/customer context';
comment on table public.whatsapp_messages is 'Canonical WhatsApp message ledger; use this for Realtime inbox rendering';
comment on table public.whatsapp_message_events is 'Delivery/read/failure event history from WhatsApp providers';
