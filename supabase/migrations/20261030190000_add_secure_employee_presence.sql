-- Employee online presence, scoped to authenticated store members.
create table if not exists public.presence (
  store_id text not null,
  user_id text not null,
  user_name text not null default '',
  shift_status text not null default 'working'
    check (shift_status in ('working', 'break', 'stopped')),
  last_seen timestamptz not null default now(),
  primary key (store_id, user_id)
);

alter table public.presence enable row level security;

drop policy if exists presence_store_members_read on public.presence;
create policy presence_store_members_read
  on public.presence for select to authenticated
  using (public.is_store_member(store_id, auth.uid()));

drop policy if exists presence_own_member_insert on public.presence;
create policy presence_own_member_insert
  on public.presence for insert to authenticated
  with check (
    user_id = coalesce(
      (select phone from public.user_profiles where user_id = auth.uid()),
      ''
    )
    and public.is_store_member(store_id, auth.uid())
  );

drop policy if exists presence_own_member_update on public.presence;
create policy presence_own_member_update
  on public.presence for update to authenticated
  using (
    user_id = coalesce(
      (select phone from public.user_profiles where user_id = auth.uid()),
      ''
    )
    and public.is_store_member(store_id, auth.uid())
  )
  with check (
    user_id = coalesce(
      (select phone from public.user_profiles where user_id = auth.uid()),
      ''
    )
    and public.is_store_member(store_id, auth.uid())
  );

drop policy if exists presence_own_member_delete on public.presence;
create policy presence_own_member_delete
  on public.presence for delete to authenticated
  using (
    user_id = coalesce(
      (select phone from public.user_profiles where user_id = auth.uid()),
      ''
    )
    and public.is_store_member(store_id, auth.uid())
  );

grant select, insert, update, delete on public.presence to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'presence'
  ) then
    alter publication supabase_realtime add table public.presence;
  end if;
end $$;
