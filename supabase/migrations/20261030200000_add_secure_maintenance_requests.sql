create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  order_number text not null,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_address text not null default '',
  governorate text not null default '',
  city text not null default '',
  item_description text not null default '',
  item_serial text not null default '',
  item_value numeric(14,2) not null default 0,
  initial_problem_description text not null default '',
  status text not null default 'received',
  priority text not null default 'medium',
  received_date date not null default current_date,
  total_cost numeric(14,2) not null default 0,
  internal_notes text not null default '',
  parts jsonb not null default '[]'::jsonb,
  labor_cost numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists maintenance_requests_store_order_idx
  on public.maintenance_requests (store_id, order_number);
create index if not exists maintenance_requests_store_status_idx
  on public.maintenance_requests (store_id, status);

alter table public.maintenance_requests enable row level security;

drop policy if exists maintenance_requests_member_read on public.maintenance_requests;
create policy maintenance_requests_member_read
  on public.maintenance_requests for select to authenticated
  using (public.is_store_member(store_id, auth.uid()));

drop policy if exists maintenance_requests_member_insert on public.maintenance_requests;
create policy maintenance_requests_member_insert
  on public.maintenance_requests for insert to authenticated
  with check (public.is_store_member(store_id, auth.uid()));

drop policy if exists maintenance_requests_member_update on public.maintenance_requests;
create policy maintenance_requests_member_update
  on public.maintenance_requests for update to authenticated
  using (public.is_store_member(store_id, auth.uid()))
  with check (public.is_store_member(store_id, auth.uid()));

drop policy if exists maintenance_requests_member_delete on public.maintenance_requests;
create policy maintenance_requests_member_delete
  on public.maintenance_requests for delete to authenticated
  using (public.is_store_member(store_id, auth.uid()));

grant select, insert, update, delete on public.maintenance_requests to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'maintenance_requests'
  ) then
    alter publication supabase_realtime add table public.maintenance_requests;
  end if;
end $$;
