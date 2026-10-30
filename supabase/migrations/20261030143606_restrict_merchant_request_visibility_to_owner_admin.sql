drop policy if exists merchant_requests_member_insert on public.merchant_requests;
drop policy if exists merchant_requests_member_select on public.merchant_requests;
drop policy if exists merchant_requests_admin_select on public.merchant_requests;
create policy merchant_requests_admin_select on public.merchant_requests
for select to authenticated
using (public.is_store_owner("storeId") or public.is_trusted_admin());
