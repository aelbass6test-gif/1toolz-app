-- Defense in depth: anonymous clients can read only dedicated storefront views.
revoke all on public.stores_data,
  public.abandoned_carts, public.activity_logs, public.collections,
  public.custom_pages, public.customers, public.discount_codes,
  public.documents, public.employees, public.global_options,
  public.orders, public.partner_transactions, public.partners,
  public.payment_methods, public.products, public.reviews,
  public.shipping_integrations, public.suppliers, public.supply_orders,
  public.transactions, public.warehouses
from anon;

grant select on public.public_storefronts,
  public.public_storefront_products,
  public.public_storefront_collections,
  public.public_storefront_pages,
  public.public_storefront_payment_methods,
  public.public_storefront_reviews,
  public.public_storefront_discount_codes
to anon;
