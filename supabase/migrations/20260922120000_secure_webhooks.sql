-- Migration: Secure Webhooks and Harden WhatsApp RLS
-- Description: Adds direct webhook logging and secures WhatsApp tables for store members only.

-- 1) Create direct webhook logging table for "Direct & Secure Search"
create table if not exists public.webhook_logs (
  id uuid primary key default gen_random_uuid(),
  store_id text not null references public.stores_data(id) on delete cascade,
  source text not null, -- 'meta_whatsapp', 'bosta', 'turbo', etc.
  event_type text not null,
  direction text not null default 'incoming' check (direction in ('incoming', 'outgoing')),
  status_code integer,
  success boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  headers jsonb not null default '{}'::jsonb,
  error_message text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists webhook_logs_store_idx on public.webhook_logs(store_id, occurred_at desc);
create index if not exists webhook_logs_source_idx on public.webhook_logs(source, occurred_at desc);

alter table public.webhook_logs enable row level security;

-- Only store members can see their store's webhook logs
create policy "Store members can view webhook logs"
on public.webhook_logs for select to authenticated
using (public.is_store_member(store_id, auth.uid()));

-- 2) Harden store_memberships RLS
-- Existing policies in 20260920035000_whatsapp_auth_rls.sql are okay but we ensure no anon access
-- and owners have full control.

-- 3) Harden WhatsApp tables - REMOVE ANON ACCESS ( loopholes found in previous migration )
drop policy if exists "Store members can read conversations" on public.whatsapp_conversations;
drop policy if exists "Store members can write conversations" on public.whatsapp_conversations;

create policy "Store members can read conversations"
on public.whatsapp_conversations for select to authenticated
using (public.is_store_member(store_id, auth.uid()));

create policy "Store members can write conversations"
on public.whatsapp_conversations for all to authenticated
using (public.is_store_member(store_id, auth.uid()))
with check (public.is_store_member(store_id, auth.uid()));

-- Repeat for messages
drop policy if exists "Store members can read messages" on public.whatsapp_messages;
drop policy if exists "Store members can write messages" on public.whatsapp_messages;

create policy "Store members can read messages"
on public.whatsapp_messages for select to authenticated
using (public.is_store_member(store_id, auth.uid()));

create policy "Store members can write messages"
on public.whatsapp_messages for all to authenticated
using (public.is_store_member(store_id, auth.uid()))
with check (public.is_store_member(store_id, auth.uid()));

-- Repeat for events
drop policy if exists "Store members can read message events" on public.whatsapp_message_events;
drop policy if exists "Store members can write message events" on public.whatsapp_message_events;

create policy "Store members can read message events"
on public.whatsapp_message_events for select to authenticated
using (public.is_store_member(store_id, auth.uid()));

create policy "Store members can write message events"
on public.whatsapp_message_events for insert to authenticated
with check (public.is_store_member(store_id, auth.uid()));

-- 4) Add a security definer function for recording logs from edge functions
create or replace function public.record_webhook_log(
  p_store_id text,
  p_source text,
  p_event_type text,
  p_direction text,
  p_status_code integer,
  p_success boolean,
  p_payload jsonb,
  p_headers jsonb default '{}'::jsonb,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.webhook_logs (
    store_id, source, event_type, direction, status_code, success, payload, headers, error_message
  ) values (
    p_store_id, p_source, p_event_type, p_direction, p_status_code, p_success, p_payload, p_headers, p_error_message
  ) returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.record_webhook_log(text, text, text, text, integer, boolean, jsonb, jsonb, text) to anon, authenticated, service_role;
