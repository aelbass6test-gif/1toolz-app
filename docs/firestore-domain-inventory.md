# Firestore domain inventory and phased data cutover

Status: source-code inventory for the migration branch, reviewed 2026-10-30. This is planning evidence, not a production migration script.

## Why this inventory exists

Firebase is still a live application dependency. Replacing the Firebase client or deleting its SDK before moving each read/write/listener path would break application workflows. The current app also has IndexedDB/local backup behavior and partial Supabase support, so the migration must preserve cache semantics, realtime updates, and write integrity.

## Observed Firebase responsibilities

### Authentication and identity
- Firebase Auth state listener remains in App.tsx.
- Owner sign-in still uses a phone-derived synthetic email alias ending in @mystore-auth.app.
- Owner account creation still creates Firebase Auth credentials in App.tsx.
- Sign-up page still has Firebase sign-in/create-user calls.
- Employee login/registration must be audited independently; do not infer its identity flow from the component name.
- Supabase Auth now handles password reset and signup confirmation, but this does not mean owner/employee login has been cut over.

### Core store and commerce data
Observed Firestore collections and paths include:
- stores_data — store configuration and embedded settings; store documents are also listened to in real time.
- orders — store-scoped order collection; legacy reads also try store_id after storeId.
- products — store-scoped product collection.
- users — global user directory and legacy account/profile synchronization. Do not select, copy, log, or authenticate with the legacy password field.
- employees — store-scoped employee records.
- customers and quotation data also exist in the local IndexedDB layer; Firestore ownership and all writers need a full-repository reference scan before cutover.

### Finance, inventory, and fulfillment
Observed Firestore collection reads include:
- transactions
- treasury_accounts
- treasury_transactions
- cash_holders
- cash_handovers
- purchase_returns
- order_returns
- pos_sales
- suppliers
- supply_orders
- warehouses
- inventory_audits
- stock_transfers
- shipping_integrations

### Partners, customer experience, and communications
Observed Firestore collections include:
- partners
- partner_transactions
- partner_requests
- merchant_requests
- reviews
- abandoned_carts
- activity_logs
- discount_codes
- collections
- custom_pages
- payment_methods
- global_options
- whatsapp_templates
- shared_audits
- chat_messages

This list is based on direct references found in App.tsx and services/databaseService.ts. It is not a claim that every repository collection has been discovered; component-level queries and server-side routes still require a full scan.

## Important implementation details discovered

1. App.tsx has direct Firestore onSnapshot listeners for the store document, orders, products, employees, returns, cash/treasury, partners, partner transactions, users, shared audits, chat messages, partner requests, and merchant requests.
2. services/databaseService.ts loads a large group of Firestore collections and performs Firestore upserts/deletes and legacy user sync.
3. Some order and generic collection reads fall back from storeId to store_id. This must be normalized with a data audit before new RLS policies depend on a single canonical key.
4. stores_data embeds operational settings and records. Migrating only normalized tables without preserving the embedded settings readers/writers will cause partial or stale screens.
5. The database layer also uses Dexie/IndexedDB and localStorage emergency backups. Offline/cache behavior is part of the app contract and must be regression-tested, not deleted as cleanup.
6. There is currently no proof of complete dual-write parity. Do not add naive Firebase+Supabase dual writes: partial failures can create divergent orders, finance entries, or inventory balances.

## Suggested migration order

### Phase 0 — map and baseline
- Inventory every Firestore collection, direct query, transaction, listener, and Cloud Function/server writer across the full repository.
- Capture representative record counts and per-store ownership in read-only exports that exclude secrets and password fields.
- Record existing IDs, timestamp formats, status enums, and both storeId / store_id conventions.
- Add domain-level fixtures and parity checks before changing production reads.

### Phase 1 — identity and store boundary
- Complete verified Supabase Auth owner bootstrap and employee invitation acceptance.
- Establish the canonical Auth UUID to store membership mapping.
- Resolve all six production stores, including the two without memberships, through an audited owner-claim process.
- Do not migrate private data reads to membership-only RLS before all legitimate identities are reconciled.

### Phase 2 — low-risk reference/configuration domains
- Start with published catalog/configuration data such as public product/category/page reads, while keeping private store settings and credentials server-only.
- Separate public storefront projection from private management data.
- Validate cache invalidation and storefront behavior.

### Phase 3 — customer and order operations
- Migrate customer records, orders, order status, reviews, abandoned carts, and discounts as a coherent workflow.
- Preserve atomic order creation, inventory reservation, payment state, and idempotency.
- Keep a reconciliation report for record IDs and totals.

### Phase 4 — inventory and fulfillment
- Migrate products, suppliers, supply orders, warehouses, stock transfers, inventory audits, and returns.
- Preserve transaction boundaries and stock-ledger invariants.
- Migrate carrier credentials only after all provider calls are server-side and authenticated.

### Phase 5 — finance
- Migrate cash holders/handovers, treasury accounts/transactions, POS sales, partner settlements, and general transactions.
- Require exact balance reconciliation and immutable audit trails.
- Do not run old and new financial writers concurrently without a tested idempotency/ledger strategy.

### Phase 6 — collaboration and remaining modules
- Migrate chat, shared audits, activity logs, WhatsApp templates, custom pages, payment methods, global options, and the remaining request queues.
- Validate Realtime channel authorization and store-scoped visibility.

### Phase 7 — retirement
- Remove Firebase collection listeners and writers only after the corresponding domain has passed production parity and rollback gates.
- Remove Firebase Auth, Firestore, config, and package dependency only after repository-wide reference scans return no active use.
- Keep a documented export/restore route for the agreed retention period.

## Required release gates per domain

- No missing, duplicate, or cross-store records after migration.
- Read parity for representative records and aggregate counts.
- Write parity for create/update/delete, retries, offline recovery, and concurrent edits.
- Realtime parity for inserts, updates, deletes, reconnects, and revoked membership.
- Negative tests prove a user in Store A cannot read or mutate Store B.
- Financial and inventory domains reconcile totals, balances, and stock movements exactly.
- No secrets, legacy passwords, or provider credentials are copied into public tables or browser bundles.
- Rollback can restore the old domain path without losing writes accepted by the new path.

## Explicit non-goals

- Do not disable Firebase globally in this phase.
- Do not remove or loosen production RLS policies to make migration tests pass.
- Do not copy public.users.password or any equivalent legacy password value.
- Do not expose Supabase service-role credentials in browser code.
- Do not migrate embedded secrets from stores_data.settings into browser-readable normalized tables.
- Do not claim a collection is migrated merely because a similarly named Supabase table exists.


## Additional repository scan findings (selected high-risk modules)

A follow-up source scan beyond App.tsx and databaseService.ts found these additional active Firebase dependencies:

- server.ts imports Firebase Auth/Firestore and contains server-side Firestore reads/writes for user records, stores_data, report sharing, SMTP settings, and other backend operations. Server routes and background handlers must be included in the data cutover; replacing only browser SDK calls is insufficient.
- components/TeamChatPage.tsx independently reads and writes chat_messages using Firestore, in addition to the listeners already present in App.tsx.
- components/InventoryAudit.tsx independently reads, subscribes to, creates, and updates shared_audits. Its audit workflow is not fully contained in App.tsx or the central data service.
- services/userMigrationService.ts still reads the Firestore users collection and writes Firestore user documents. Keep it disabled or tightly controlled during cutover; never migrate legacy password values.
- src/hooks/useLiveCollaboration.ts and services/mediaUploadService.ts still import the Firebase client for authentication-related behavior, so their Firebase Auth assumptions need an explicit Supabase-session replacement review.

This was a targeted scan of high-risk files, not an exhaustive proof that all 311 TypeScript/JavaScript source files are free of Firebase references. Before retiring Firebase, run a complete repository-wide import and SDK-call scan on the final release commit, including server routes, scripts, Cloudflare code, and lazily loaded components.


## Automated Firebase retirement gate

A read-only repository scanner is available as `npm run audit:firebase` in [scripts/audit_firebase_references.mjs](../scripts/audit_firebase_references.mjs). It reports source-file paths, line numbers, and reference categories only; it does not print source lines, inspect environment files, read credentials, or inspect backup records.

- The migration CI workflow runs the scanner in informational mode on every branch/PR validation.
- Informational mode is expected to report remaining Firebase dependencies during migration and does not fail CI.
- The `--strict` mode exits non-zero while any detected Firebase reference remains. Enable this as a release gate only after the final domain cutovers are complete.
- The scanner is a safety net, not proof by itself. Review generated code, package/config files, server routes, scripts, Cloudflare Worker code, and dynamic imports manually before Firebase retirement.


## Implemented cutover progress (2026-10-30)

The following changes are committed on `migration/firebase-to-supabase` and the SQL migrations listed below have been applied to project `kwirhppfowzqshltmoga`:

- Owner sign-in and owner registration in `components/SignUpPage.tsx` now call Supabase Auth.
- Employee sign-in and employee registration in `App.tsx` now call Supabase Auth.
- Password-authentication imports were removed from the app shell and owner sign-in page. Employee password reset in `server.ts` now uses Supabase Auth Admin API and no longer calls Firebase Identity Toolkit; the server-only `SUPABASE_SERVICE_ROLE_KEY` must be configured in that backend environment before reset is considered live. Firestore remains in use for non-auth application domains.
- `getUserByPhone` no longer queries Firestore when the deployment Supabase client is active.
- `createUserDoc` now persists the user directory profile to Supabase only; it no longer writes a duplicate Firebase user document.
- `saveGlobalData` now saves only the signed-in user's own profile through Supabase Auth/RLS; admin changes to other accounts and privileged flags must go through a trusted server-side workflow.
- `useLiveCollaboration` now uses the Supabase Auth UUID and listens for Supabase session changes instead of reading Firebase Auth state.
- Product-image upload and deletion now use the Supabase access token instead of Firebase ID tokens. The live Cloudflare `abdomedi-media` Worker was updated and deployed to validate the Supabase JWT and verify store membership before upload/delete; public image reads remain public.
- `public.users` no longer has an anonymous/public all-access policy. RLS limits reads and writes to the authenticated user's phone profile (or a trusted admin profile).
- API roles cannot select the legacy `users.password` column and cannot set admin/ban flags. The app-side profile writer omits those privileged flags.
- Added the missing `default_store_id` and `auto_launch_default_store` columns expected by the app's profile mapper.
- Added store-membership RLS policies for operational audit, return, transaction, quotation, stock-transfer, template and request tables. MoneyHash payment rows are owner-readable only; webhook event rows remain server-only with no client policy.
- Removed anonymous write privileges from `stores_data`; authenticated writes now require a store membership. New store creation uses a SECURITY DEFINER RPC that creates the store and its first owner membership atomically, and refuses to claim an already-existing store.

Applied migration versions:
- `20261030060149_supabase_auth_foundation`
- `20261030060205_revoke_public_rls_event_trigger`
- `20261030060212_harden_store_membership_helpers`
- `20261030060634_secure_supabase_user_directory`
- `20261030060714_prevent_user_self_promotion`
- `20261030060720_lock_legacy_admin_flags`
- `20261030060949_store_scoped_operational_rls`
- `20261030061244_restrict_store_record_writes_and_bootstrap_membership`

### Current verification and release blockers

- Verified: `public.users` has RLS enabled and four scoped policies; there are no public-role policies.
- Verified: neither `anon` nor `authenticated` can select the legacy password column; authenticated users cannot update admin flags.
- Verified: the Supabase security advisor now reports no RLS-enabled/no-policy tables except `moneyhash_webhook_events`, which is intentionally server-only.
- Remaining advisor warnings: the two `SECURITY DEFINER` membership predicates are callable by authenticated users because RLS policies depend on them; leaked-password protection is disabled and must be enabled in Supabase Auth settings.
- The Supabase Auth signup flow currently uses the existing phone-derived alias (`phone@mystore-auth.app`) while the app sends its separate activation email. Supabase Auth email confirmation must be disabled for this alias-based password flow, or replaced with a server-side Admin API bootstrap after verified activation. Do not assume this dashboard setting is configured until tested.
- Store membership data currently covers only four of six existing stores. Do not remove the public `stores_data` compatibility policy or claim the dashboard cutover is complete until owner claims/memberships are reconciled and storefront public data is separated from private store settings.
- Firestore is still an active dependency for stores_data, orders, products, employees, finance, inventory, chat, storefront domain lookup, server routes, and other modules. Firebase SDK/config removal is explicitly not complete.
- A full production build/typecheck and browser end-to-end test for the latest media/chat changes are still running in GitHub Actions. The branch must pass `npm run lint`, `npm run build`, `npm run test:supabase-membership`, and the relevant owner/employee/storefront workflows before deployment.
