-- Public store snapshot is physically sanitized; public product-related views use invoker rights.
drop view if exists public.public_storefronts;
create table if not exists public.public_storefronts (
  id text primary key, name text, specialization text, language text, currency text,
  url text, creation_date text, settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.public_storefronts enable row level security;
drop policy if exists public_storefront_read_anon on public.public_storefronts;
create policy public_storefront_read_anon on public.public_storefronts for select to anon using (true);
revoke all on public.public_storefronts from anon, authenticated;
grant select on public.public_storefronts to anon;

create or replace function public.sync_public_storefront_snapshot()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    delete from public.public_storefronts where id = old.id;
    return old;
  end if;
  insert into public.public_storefronts
    (id, name, specialization, language, currency, url, creation_date, settings, updated_at)
  values
    (new.id, new.name, new.specialization, new.language, new.currency, new.url, new.creation_date,
     jsonb_strip_nulls(jsonb_build_object(
       'customization', new.settings->'customization',
       'subdomain', new.settings->'subdomain',
       'customDomain', new.settings->'customDomain',
       'isSubdomainFixed', new.settings->'isSubdomainFixed',
       'shippingOptions', new.settings->'shippingOptions'
     )), now())
  on conflict (id) do update set
    name=excluded.name, specialization=excluded.specialization, language=excluded.language,
    currency=excluded.currency, url=excluded.url, creation_date=excluded.creation_date,
    settings=excluded.settings, updated_at=now();
  return new;
end;
$$;
revoke all on function public.sync_public_storefront_snapshot() from public, anon, authenticated;
drop trigger if exists sync_public_storefront_snapshot_trigger on public.stores_data;
create trigger sync_public_storefront_snapshot_trigger after insert or update or delete
on public.stores_data for each row execute function public.sync_public_storefront_snapshot();

insert into public.public_storefronts
  (id, name, specialization, language, currency, url, creation_date, settings, updated_at)
select s.id, s.name, s.specialization, s.language, s.currency, s.url, s.creation_date,
  jsonb_strip_nulls(jsonb_build_object(
    'customization', s.settings->'customization',
    'subdomain', s.settings->'subdomain',
    'customDomain', s.settings->'customDomain',
    'isSubdomainFixed', s.settings->'isSubdomainFixed',
    'shippingOptions', s.settings->'shippingOptions'
  )), now()
from public.stores_data s
on conflict (id) do update set name=excluded.name, specialization=excluded.specialization,
  language=excluded.language, currency=excluded.currency, url=excluded.url,
  creation_date=excluded.creation_date, settings=excluded.settings, updated_at=now();

create or replace view public.public_storefront_products
with (security_barrier = true, security_invoker = true) as
select id, store_id, name, sku, price, description, weight, thumbnail, images,
       "inStock", "collectionId", "hasVariants", options, "updatedAt", "createdAt"
from public.products;

create or replace view public.public_storefront_collections
with (security_barrier = true, security_invoker = true) as
select id, store_id, name, description, image, created_at, "storeId", "updatedAt", updated_at, "createdAt"
from public.collections;

create or replace view public.public_storefront_pages
with (security_barrier = true, security_invoker = true) as
select id, store_id, title, slug, content, is_active, created_at, "storeId", "updatedAt", updated_at, "createdAt"
from public.custom_pages where is_active = true;

create or replace view public.public_storefront_payment_methods
with (security_barrier = true, security_invoker = true) as
select id, store_id, name, instructions, type, active, logo_url, created_at, "storeId", "updatedAt", updated_at, "createdAt"
from public.payment_methods where active = true;

create or replace view public.public_storefront_reviews
with (security_barrier = true, security_invoker = true) as
select id, store_id, product_id, customer_name, rating, comment, status, date, created_at, "storeId", "productId", "updatedAt", updated_at, "createdAt"
from public.reviews where lower(coalesce(status, '')) in ('approved', 'published', 'active');

create or replace view public.public_storefront_discount_codes
with (security_barrier = true, security_invoker = true) as
select id, store_id, code, type, value, active, "storeId", "updatedAt", updated_at, "createdAt"
from public.discount_codes where active = true;

drop policy if exists products_public_storefront_select on public.products;
create policy products_public_storefront_select on public.products for select to anon using (true);
grant select (id, store_id, name, sku, price, description, weight, thumbnail, images, "inStock", "collectionId", "hasVariants", options, "updatedAt", "createdAt") on public.products to anon;

drop policy if exists collections_public_storefront_select on public.collections;
create policy collections_public_storefront_select on public.collections for select to anon using (true);
grant select (id, store_id, name, description, image, created_at, "storeId", "updatedAt", updated_at, "createdAt") on public.collections to anon;

drop policy if exists custom_pages_public_storefront_select on public.custom_pages;
create policy custom_pages_public_storefront_select on public.custom_pages for select to anon using (is_active = true);
grant select (id, store_id, title, slug, content, is_active, created_at, "storeId", "updatedAt", updated_at, "createdAt") on public.custom_pages to anon;

drop policy if exists payment_methods_public_storefront_select on public.payment_methods;
create policy payment_methods_public_storefront_select on public.payment_methods for select to anon using (active = true);
grant select (id, store_id, name, instructions, type, active, logo_url, created_at, "storeId", "updatedAt", updated_at, "createdAt") on public.payment_methods to anon;

drop policy if exists reviews_public_storefront_select on public.reviews;
create policy reviews_public_storefront_select on public.reviews for select to anon using (lower(coalesce(status, '')) in ('approved', 'published', 'active'));
grant select (id, store_id, product_id, customer_name, rating, comment, status, date, created_at, "storeId", "productId", "updatedAt", updated_at, "createdAt") on public.reviews to anon;

drop policy if exists discount_codes_public_storefront_select on public.discount_codes;
create policy discount_codes_public_storefront_select on public.discount_codes for select to anon using (active = true);
grant select (id, store_id, code, type, value, active, "storeId", "updatedAt", updated_at, "createdAt") on public.discount_codes to anon;

revoke all on public.public_storefront_products, public.public_storefront_collections,
  public.public_storefront_pages, public.public_storefront_payment_methods,
  public.public_storefront_reviews, public.public_storefront_discount_codes
from anon, authenticated;
grant select on public.public_storefront_products, public.public_storefront_collections,
  public.public_storefront_pages, public.public_storefront_payment_methods,
  public.public_storefront_reviews, public.public_storefront_discount_codes to anon;
