# Staging foundation results — 2026-11-13

## Scope

This checkpoint covers only local, isolated validation of the fresh-start foundation. No Worker was deployed, no remote D1 migration was applied, no R2 object was copied, and no Firebase/Supabase data was modified.

## Implemented

- Added `0002_native_domain_schema.sql` with typed D1 tables for stores, settings, products, customers, orders, order items, inventory balances/movements, maintenance, shipping deliveries, carrier events, shared audits/events, chat threads/messages, presence, notifications, operational audit logs, and R2 file metadata.
- Added uniqueness, foreign keys, tenant indexes, non-negative quantity/amount checks, and idempotency keys for the initial domains.
- Changed the native R2 image upload route so an upload is accepted only after a `file_metadata` row is written to `APP_DB`; if D1 is unavailable or metadata registration fails, the R2 object is deleted and the request fails.
- Changed image deletion to mark `file_metadata.deleted_at` after the R2 deletion.

## Local evidence

- Fresh-start core + domain + auth MFA + OTP + WhatsApp + wallet migrations apply to an in-memory SQLite database.
- Synthetic store/product/inventory/order/order-item lifecycle passed.
- Duplicate product SKU constraint rejected as expected.
- `npm run lint` passed.
- `npm run test:auth-validation` passed.
- `npm run test:d1-wallet-ledger` passed: 6/6.
- `npm run test:shipping` passed.
- `git diff --check` passed.

## Still blocked

This does **not** prove Cloudflare-only operation. The runtime still contains direct Firebase/Supabase writes and missing typed Worker routes for several domains. No remote D1/R2 acceptance, second-session read-back, R2 application round-trip, or legacy read-only observation has been run. The cutover gate remains BLOCKED.

The next implementation batches must convert callers to Worker routes, add route-level authorization/idempotency tests, and run them against the isolated native-staging resources only after the exact target and deployment command are separately approved.
