create or replace function public.is_trusted_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.user_profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    );
$$;
revoke all on function public.is_trusted_admin() from public, anon;
grant execute on function public.is_trusted_admin() to authenticated;

drop policy if exists merchant_requests_member_select on public.merchant_requests;
create policy merchant_requests_member_select on public.merchant_requests
for select to authenticated
using (public.is_store_member("storeId") or public.is_trusted_admin());

drop policy if exists merchant_requests_member_insert on public.merchant_requests;
create policy merchant_requests_member_insert on public.merchant_requests
for insert to authenticated
with check (public.is_store_member("storeId"));

drop policy if exists merchant_requests_admin_update on public.merchant_requests;
create policy merchant_requests_admin_update on public.merchant_requests
for update to authenticated
using (public.is_store_owner("storeId") or public.is_trusted_admin())
with check (public.is_store_owner("storeId") or public.is_trusted_admin());

drop policy if exists partner_requests_member_select on public.partner_requests;
create policy partner_requests_member_select on public.partner_requests
for select to authenticated
using (public.is_store_member("storeId") or public.is_trusted_admin());

drop policy if exists partner_requests_member_insert on public.partner_requests;
create policy partner_requests_member_insert on public.partner_requests
for insert to authenticated
with check (public.is_store_member("storeId"));

drop policy if exists partner_requests_admin_update on public.partner_requests;
create policy partner_requests_admin_update on public.partner_requests
for update to authenticated
using (public.is_store_owner("storeId") or public.is_trusted_admin())
with check (public.is_store_owner("storeId") or public.is_trusted_admin());
