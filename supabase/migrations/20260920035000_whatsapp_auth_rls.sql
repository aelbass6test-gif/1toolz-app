-- Supabase Auth membership and RLS hardening for the WhatsApp inbox.
create table if not exists public.store_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id text not null references public.stores_data(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'manager', 'staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, store_id)
);

alter table public.store_memberships enable row level security;

drop policy if exists "Public Access WhatsApp Conversations" on public.whatsapp_conversations;
drop policy if exists "Public Access WhatsApp Messages" on public.whatsapp_messages;
drop policy if exists "Public Access WhatsApp Events" on public.whatsapp_message_events;

create policy "Members can manage own memberships"
on public.store_memberships for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Store members can read conversations"
on public.whatsapp_conversations for select to authenticated
using (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_conversations.store_id));

create policy "Store members can write conversations"
on public.whatsapp_conversations for all to authenticated
using (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_conversations.store_id))
with check (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_conversations.store_id));

create policy "Store members can read messages"
on public.whatsapp_messages for select to authenticated
using (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_messages.store_id));

create policy "Store members can write messages"
on public.whatsapp_messages for all to authenticated
using (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_messages.store_id))
with check (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_messages.store_id));

create policy "Store members can read message events"
on public.whatsapp_message_events for select to authenticated
using (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_message_events.store_id));

create policy "Store members can write message events"
on public.whatsapp_message_events for insert to authenticated
with check (exists (select 1 from public.store_memberships m where m.user_id = auth.uid() and m.store_id = whatsapp_message_events.store_id));

alter function public.set_whatsapp_updated_at() set search_path = public;
alter function public.mark_whatsapp_conversation_read(uuid) security invoker;
revoke execute on function public.update_whatsapp_conversation_from_message() from public, anon, authenticated;
revoke execute on function public.set_whatsapp_updated_at() from public, anon, authenticated;
revoke execute on function public.mark_whatsapp_conversation_read(uuid) from anon;
grant execute on function public.mark_whatsapp_conversation_read(uuid) to authenticated;
