create or replace function public.is_trusted_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.user_profiles p
      where p.user_id = auth.uid()
        and (
          p.is_admin = true
          or exists (
            select 1 from public.users u
            where u.phone = p.phone and u.is_admin = true
          )
        )
    );
$$;
revoke all on function public.is_trusted_admin() from public, anon;
grant execute on function public.is_trusted_admin() to authenticated;

drop policy if exists stores_data_admin_select on public.stores_data;
create policy stores_data_admin_select on public.stores_data
for select to authenticated
using (public.is_trusted_admin());

drop policy if exists stores_data_admin_update on public.stores_data;
create policy stores_data_admin_update on public.stores_data
for update to authenticated
using (public.is_trusted_admin())
with check (public.is_trusted_admin());
