-- Harden store membership administration.
-- Memberships are provisioned by a trusted admin/Edge Function. A normal user
-- may not add themselves to an arbitrary store by knowing its ID.

alter table public.store_memberships enable row level security;

create or replace function public.is_store_owner(p_store_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_memberships
    where user_id = auth.uid()
      and store_id = p_store_id
      and role = 'owner'
  );
$$;
revoke all on function public.is_store_owner(text) from public, anon;
grant execute on function public.is_store_owner(text) to authenticated;

drop policy if exists "Members can manage own memberships" on public.store_memberships;
drop policy if exists "Users can read own memberships" on public.store_memberships;
drop policy if exists "Store owners can manage memberships" on public.store_memberships;

create policy "Users can read own memberships"
on public.store_memberships for select
to authenticated
using (user_id = auth.uid());

create policy "Store owners can manage memberships"
on public.store_memberships for all
to authenticated
using (
  public.is_store_owner(store_memberships.store_id)
)
with check (
  public.is_store_owner(store_memberships.store_id)
);

-- Members can read and create inbox records for stores they belong to, but
-- destructive membership or message deletion must stay out of the browser.
drop policy if exists "Store members can write conversations" on public.whatsapp_conversations;
drop policy if exists "Store members can insert conversations" on public.whatsapp_conversations;
create policy "Store members can insert conversations"
on public.whatsapp_conversations for insert
to authenticated
with check (exists (
  select 1 from public.store_memberships m
  where m.user_id = auth.uid() and m.store_id = whatsapp_conversations.store_id
));

 drop policy if exists "Store members can write messages" on public.whatsapp_messages;
drop policy if exists "Store members can insert messages" on public.whatsapp_messages;
create policy "Store members can insert messages"
on public.whatsapp_messages for insert
to authenticated
with check (exists (
  select 1 from public.store_memberships m
  where m.user_id = auth.uid() and m.store_id = whatsapp_messages.store_id
));

drop policy if exists "Store members can write message events" on public.whatsapp_message_events;
drop policy if exists "Store members can insert message events" on public.whatsapp_message_events;
create policy "Store members can insert message events"
on public.whatsapp_message_events for insert
to authenticated
with check (exists (
  select 1 from public.store_memberships m
  where m.user_id = auth.uid() and m.store_id = whatsapp_message_events.store_id
));
