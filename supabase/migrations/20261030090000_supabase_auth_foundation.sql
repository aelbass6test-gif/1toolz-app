-- Supabase Auth foundation for the Firebase retirement.
-- This migration is additive: it does not alter, delete, or copy legacy users,
-- passwords, stores, orders, products, or financial records.
-- Existing accounts must sign up again through Supabase Auth.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_phone_unique
  on public.user_profiles (phone)
  where phone is not null and phone <> '';

alter table public.user_profiles enable row level security;

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.user_profiles from anon, public;
grant select, insert, update on table public.user_profiles to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, display_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- These membership helpers are used by existing RLS policies. Pin their
-- search_path and fully qualify referenced objects to avoid object shadowing.
create or replace function public.is_store_member(p_store_id text, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_memberships m
    where m.store_id = p_store_id
      and m.user_id = p_user_id
      and p_user_id = (select auth.uid())
  );
$;

create or replace function public.is_store_owner(p_store_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.store_memberships m
    where m.store_id = p_store_id
      and m.user_id = (select auth.uid())
      and m.role = 'owner'
  );
$$;

revoke all on function public.is_store_member(text, uuid) from public, anon;
revoke all on function public.is_store_owner(text) from public, anon;
grant execute on function public.is_store_member(text, uuid) to authenticated;
grant execute on function public.is_store_owner(text) to authenticated;

-- The event trigger is privileged infrastructure, not an application RPC.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
