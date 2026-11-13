# Staging remote results — 2026-11-13

## Safety boundary

All remote writes in this checkpoint targeted only the lab resources declared in `cloudflare-worker/wrangler.native-staging.toml`: `1toolz-cloudflare-core-lab`, `1toolz-cutover-otp-lab`, `1toolz-wallet-ledger-lab`, `1toolz-product-images-lab`, and `1toolz-cloudflare-backups-lab`. Production Worker `1toolz-app`, production routes, Firebase, and Supabase were not modified.

## D1 remote evidence

The Cloudflare MCP read-only probe returned `SELECT 1` successfully for all three lab D1 databases. The APP_DB schema initially contained the fresh-start core tables but not the new typed domain tables.

The additive domain schema was then applied to APP_DB only. A subsequent read-only schema query confirmed all 19 domain tables: `stores`, `store_settings`, `products`, `customers`, `orders`, `order_items`, `inventory_balances`, `inventory_movements`, `maintenance_requests`, `shipping_deliveries`, `carrier_webhook_events`, `shared_audits`, `shared_audit_events`, `chat_threads`, `chat_messages`, `presence`, `notifications`, `operational_audit_logs`, and `file_metadata`.

A synthetic D1 lifecycle created a store, product, inventory balance, order, and order item; read-back returned the expected joined record; an order update read back as `confirmed`; cleanup completed; and the final store count was zero. The first attempt used `BEGIN` and was rejected by Cloudflare's D1 API because the HTTP API does not accept SQL transaction statements. No synthetic data remained after the retry and cleanup.

## R2 remote evidence

The lab bucket `1toolz-product-images-lab` passed a direct synthetic object round-trip: PUT succeeded with a 36-byte object, GET returned the exact payload, DELETE succeeded, and a final GET returned Cloudflare error `10007` (key does not exist). This validates the bucket itself, not the application Worker media route.

## Worker deployment status

The isolated Worker name `1toolz-app-native-staging` exists and is separate from production. The Wrangler CLI could identify the account but its token failed Cloudflare API authentication with error `9106` on `d1 list`. The Cloudflare MCP account channel was authorized and was used for the D1/R2 operations above.

An attempt to upload the locally built Worker bundle through the MCP upload endpoint was not completed: the temporary artifact URL is blocked from Cloudflare's fetch environment with HTTP 403, so Cloudflare parsed the blocked response instead of the JavaScript bundle and rejected the upload with syntax error `10021`. No Worker version was changed by that failed request.

Therefore no application-level Worker E2E test was run. In particular, the following remain unproven: authenticated media upload with D1 metadata, second-session read-back, typed Worker CRUD routes, webhook side-effect isolation, and the absence of Firebase/Supabase writes while exercising the real staging application.

## Current gate

The cutover gate remains `BLOCKED`. The remote D1/R2 infrastructure evidence is positive, but it is not evidence that the application writes exclusively through Cloudflare. The next safe action is to restore a valid deployment channel for the isolated staging Worker, then run the HTTP synthetic suite against that Worker before changing any legacy write path or considering production cutover.
