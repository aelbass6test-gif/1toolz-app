-- Replace broad public store data policies with membership-scoped access.
-- Public storefronts use explicit views that expose only customer-facing fields.

create or replace view public.public_storefronts
with (security_barrier = true, security_invoker = false) as
select
  s.id, s.name, s.specialization, s.language, s.currency, s.url, s.creation_date,
  jsonb_strip_nulls(jsonb_build_object(
    'customization', s.settings->'customization',
    'subdomain', s.settings->'subdomain',
    'customDomain', s.settings->'customDomain',
    'isSubdomainFixed', s.settings->'isSubdomainFixed',
    'shippingOptions', s.settings->'shippingOptions'
  )) as settings
from public.stores_data s;

create or replace view public.public_storefront_products
with (security_barrier = true, security_invoker = false) as
select id, store_id, name, sku, price, description, weight, thumbnail, images,
       "inStock", "collectionId", "hasVariants", options, "updatedAt", "createdAt"
from public.products;

create or replace view public.public_storefront_collections
with (security_barrier = true, security_invoker = false) as
select id, store_id, name, description, image, created_at, "storeId", "updatedAt", updated_at, "createdAt"
from public.collections;

create or replace view public.public_storefront_pages
with (security_barrier = true, security_invoker = false) as
select id, store_id, title, slug, content, is_active, created_at, "storeId", "updatedAt", updated_at, "createdAt"
from public.custom_pages
where is_active = true;

create or replace view public.public_storefront_payment_methods
with (security_barrier = true, security_invoker = false) as
select id, store_id, name, instructions, type, active, logo_url, created_at, "storeId", "updatedAt", updated_at, "createdAt"
from public.payment_methods
where active = true;

create or replace view public.public_storefront_reviews
with (security_barrier = true, security_invoker = false) as
select id, store_id, product_id, customer_name, rating, comment, status, date, created_at, "storeId", "productId", "updatedAt", updated_at, "createdAt"
from public.reviews
where lower(coalesce(status, '')) in ('approved', 'published', 'active');

create or replace view public.public_storefront_discount_codes
with (security_barrier = true, security_invoker = false) as
select id, store_id, code, type, value, active, "storeId", "updatedAt", updated_at, "createdAt"
from public.discount_codes
where active = true;

do $$
declare
  t text;
  policy_row record;
  member_tables text[] := array[
    'abandoned_carts','activity_logs','collections','custom_pages','customers',
    'discount_codes','employees','global_options','orders','payment_methods',
    'products','reviews','warehouses'
  ];
  owner_tables text[] := array[
    'documents','partner_transactions','partners','shipping_integrations',
    'suppliers','supply_orders','transactions'
  ];
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and 'public' = any(roles::text::text[])
      and cmd='ALL'
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;

  foreach t in array member_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_store_members_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_store_member(coalesce(store_id, "storeId"))) with check (public.is_store_member(coalesce(store_id, "storeId")))',
      t || '_store_members_manage', t
    );
  end loop;

  foreach t in array owner_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_store_owners_manage', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_store_owner(coalesce(store_id, "storeId"))) with check (public.is_store_owner(coalesce(store_id, "storeId")))',
      t || '_store_owners_manage', t
    );
  end loop;
end $$;

drop policy if exists "Public read stores compatibility" on public.stores_data;

revoke all on public.public_storefronts,
  public.public_storefront_products,
  public.public_storefront_collections,
  public.public_storefront_pages,
  public.public_storefront_payment_methods,
  public.public_storefront_reviews,
  public.public_storefront_discount_codes
from anon, authenticated;

grant select on public.public_storefronts,
  public.public_storefront_products,
  public.public_storefront_collections,
  public.public_storefront_pages,
  public.public_storefront_payment_methods,
  public.public_storefront_reviews,
  public.public_storefront_discount_codes
to anon, authenticated;
