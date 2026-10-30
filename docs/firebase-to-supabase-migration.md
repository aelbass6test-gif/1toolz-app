# Firebase to Supabase migration

## Safety rules
- Keep the existing Supabase business data. No truncation, reset, or bulk overwrite.
- Do not migrate legacy account credentials or copy the legacy `public.users.password` values.
- Existing users must create new credentials through Supabase Auth.
- Keep production Workers and the production app unchanged until the cutover has passed staging tests.

## Current migration sequence
1. Add the Supabase Auth profile foundation (this branch's first additive SQL migration).
2. Implement Supabase Auth sign-up/sign-in and explicit store membership provisioning.
3. Replace Firestore reads/writes/transactions and listeners with Supabase queries and Realtime.
4. Move OTP/API operations to the existing Cloudflare API Worker using server-side secrets only.
5. Apply least-privilege RLS policies table-by-table after all affected app flows use authenticated Supabase sessions.
6. Remove Firebase packages/configuration only after a repository-wide reference scan and build/test pass.

## Important findings
- The connected Supabase project already contains operational records. Treat them as authoritative and preserve them.
- The legacy `public.users` table contains a `password` column. Never select, log, export, or migrate that column. Do not rely on legacy records as authenticated identities.
- Several tables currently have broad `public` policies. Tightening them is required, but must be coordinated with the Auth and data-layer cutover to avoid an unplanned outage.
- Existing membership helper functions are SECURITY DEFINER. The migration pins their search path and restricts execution to authenticated users.
- No production SQL, Worker deployment, or Firebase deletion is performed by this migration file alone.

## Validation checklist before production
- New sign-up creates an Auth user and exactly one private profile.
- A user cannot read or modify another user's profile.
- Membership provisioning cannot grant owner/admin privileges to an arbitrary caller.
- Every business table has store-scoped SELECT/INSERT/UPDATE/DELETE policies as appropriate.
- Cross-store access tests fail for authenticated users without membership.
- Realtime events are only visible to members of the relevant store.
- OTP secrets remain in Worker secrets and never enter client bundles.
- Build, typecheck, unit tests, and end-to-end smoke tests pass in staging.


## Implemented on the migration branch
- Added `services/supabaseAuthService.ts` with a single project-configured Supabase Auth client, PKCE flow, sign-up, sign-in, sign-out, and current-user helpers.
- The client intentionally ignores per-store Supabase URLs and keys from localStorage/store settings.
- Removed plaintext password writes to the legacy Supabase `users` table and Firestore user documents, and stopped returning the legacy Supabase password field from the phone lookup helper.
- Changed user-list, phone-lookup, and migration-overview reads to explicit safe column lists; these queries no longer select the legacy `users.password` column.
- New sign-ups no longer include a password field in the application profile object.
- Disabled the old sign-in fallback that compared a supplied password with the legacy Supabase profile password.
- Removed employee-login fallback paths that read or verify legacy passwords from Supabase `users` or Firestore user documents. Employee login now requires a valid Firebase Auth identity until the full Supabase Auth cutover is implemented.
- Removed the client-side shadow-auth flow that attempted to create Supabase users and grant store memberships during login. Membership provisioning must be performed by a trusted, authorized flow.
- Removed the unauthenticated administrator fast-track buttons/handler from the owner login screen; admin status is no longer inferred from hard-coded phone numbers when reconstructing a missing profile.
- Supabase sign-out is requested when the app logs out, alongside the existing application session cleanup.
- The existing Firebase Auth sign-up/login and Firestore data path remain active pending the complete identity and data cutover.
- The migration branch CI run after the employee-login hardening passed both TypeScript type-check and production build.
- The employee-login change is a security hardening step, not a completed Supabase login migration; existing employees without a Firebase Auth identity will need a separately designed, verified re-enrollment flow.
- These helpers are a foundation only; the existing sign-up/login screens and data listeners are not yet switched over. Do not cut over production until the screens, employee flows, memberships, and data access have been migrated and tested.


## Production schema and access-control inventory (read-only audit, 2026-10-30)

This inventory was collected from the connected production project's catalog and Supabase security advisors. It is documentation only; no production policy or schema was changed.

### Current policy findings

- 23 tables have a permissive `public` policy granting `ALL` with `USING (true)` and `WITH CHECK (true)`. This is not an acceptable final access model:
  `abandoned_carts`, `activity_logs`, `chat_messages`, `collections`, `custom_pages`, `customers`, `discount_codes`, `documents`, `employees`, `global_options`, `orders`, `partner_transactions`, `partners`, `payment_methods`, `products`, `reviews`, `shipping_integrations`, `stores_data`, `suppliers`, `supply_orders`, `transactions`, `users`, `warehouses`.
- 17 tables have RLS enabled but no policies. Authenticated client access is therefore blocked until deliberate policies are added:
  `call_scripts`, `customer_transactions`, `inventory_audits`, `merchant_requests`, `moneyhash_payments`, `moneyhash_webhook_events`, `order_returns`, `partner_requests`, `pos_sales`, `purchase_returns`, `quotations`, `shared_audits`, `stock_audit_requests`, `stock_transfers`, `supplier_transactions`, `whatsapp_templates`, `withdrawal_requests`.
- Finance tables already have authenticated membership-scoped policies: `cash_handovers`, `cash_holders`, `treasury_accounts`, `treasury_transactions`. These policies still need role-level review before the new employee permission model is finalized.
- `store_memberships` currently supports self-read and owner-managed membership writes. A read-only aggregate join confirmed all 4 existing membership rows match an `auth.users` identity (2 distinct Auth users); the actual identifiers were not exposed. Store ownership/role correctness still requires verification before using these rows as authorization grants.
- The security advisor also flags `public.rls_auto_enable()` as callable by anon and authenticated users, and `public.set_updated_at()` as having a mutable search_path. Do not expose or invoke the former as an application RPC. Review its event-trigger dependency before changing grants. Pin the latter's search_path in a separately tested migration.

### Target authorization matrix (design baseline; not yet implemented)

| Data scope | Public storefront | Authenticated store owner | Authenticated employee | Trusted server |
|---|---|---|---|---|
| Published products, collections, public pages, shipping/payment display config | Read published fields only | CRUD within own store | Read; writes only when explicit permission allows | Full scoped operations when required |
| Orders, customers, carts, reviews, discounts | Narrow public create/read flows only; no unrestricted table access | CRUD within own store | Only assigned operational actions | Webhooks and privileged workflows |
| Employees and store memberships | No access | Manage non-owner members of own store; never self-promote to owner | Read own membership/profile only | Invitation acceptance and controlled provisioning |
| Transactions, treasury, cash, payouts, withdrawals | No access | Finance permissions for own store | Explicit finance permission only | Payment processor/webhook reconciliation |
| Suppliers, purchasing, inventory, warehouses, POS, returns | No access | Manage own store | Role/permission-scoped operations | Integrations and scheduled reconciliation |
| WhatsApp, chat, activity logs, shared audits | No access | Own-store access | Only assigned/support permissions | Webhook ingestion and system audit writes |
| Global users, platform options, admin operations, payment secrets/events | No access | No platform-wide access | No platform-wide access | Server-only; explicit platform-admin authorization |

### Required policy implementation rules

1. Every tenant-owned row must be scoped by canonical `store_id` and an authenticated `store_memberships` row. Never trust a client-supplied store ID without membership verification.
2. Separate SELECT, INSERT, UPDATE, and DELETE policies. Avoid broad `FOR ALL` policies where roles have different permissions.
3. Public storefront access must use narrowly scoped published-data views or policies; never grant public access to customer, employee, order, finance, integration-secret, or admin records.
4. Employee access must check both active membership and the explicit permission for the requested operation. A generic membership check is not sufficient for finance, refunds, payouts, employee management, or settings.
5. Membership provisioning and owner/admin assignment must run through a trusted server-side path. A user must never be able to assign themselves a privileged role by editing their own row.
6. Service-role credentials must remain server-side in Cloudflare Worker secrets. Never ship them in Vite variables or browser bundles.
7. Test both positive and negative cases: own-store allowed, other-store denied, inactive membership denied, role-restricted write denied, anonymous sensitive read/write denied.
8. Apply policy changes only after all corresponding app reads/writes have moved off Firestore and the staging tests prove no storefront or back-office outage.

### Data-model caveats found during the audit

- Several operational tables retain both snake_case and camelCase compatibility columns (for example `store_id` and `storeId`). RLS must use the canonical, non-null tenant key and writes must normalize to it; do not build policies that allow either key to be caller-controlled.
- `stores_data` stores broad settings in JSONB while operational entities also have normalized tables. The migration must document a single source of truth per entity and avoid dual-write races.
- The legacy `users` table is not an authentication authority. Do not select its password field, do not authenticate against it, and do not map `is_admin` to Supabase Auth app metadata without a trusted server-side verification step.



## Application and Cloudflare cutover audit (2026-10-30)

### Application data layer

- `services/databaseService.ts` still imports Firebase Auth/Firestore and the Firestore SDK directly. The current scan found roughly 145 Firestore API call sites and 40 Supabase `.from(...)` query sites in this service; it remains a dual-backend service, not a Supabase-only data layer.
- `getStoreData` still contains Firestore collection reads and local-cache fallback paths. `saveStoreData` still contains Firestore document writes, reconciliation and deletion safeguards. Do not replace these with a simple upsert: the current service has hybrid embedded/normalized records, anti-data-loss checks, and offline behavior that must be preserved or deliberately redesigned.
- Owner sign-in and registration in `components/SignUpPage.tsx` still use Firebase Auth. The employee login callback in `App.tsx` also still uses Firebase Auth. The legacy Supabase password comparison fallback has been removed from employee login, but this does not yet constitute a Supabase Auth login cutover.
- `src/hooks/useAuthActions.ts` still uses Firebase password-reset and email-verification functions. Password recovery, account activation, and OTP must be migrated as one identity lifecycle, not only the login form.
- Employee registration and the employee invite/approval lifecycle still rely on Firebase-backed application callbacks and store settings. The Supabase Auth user UUID must be linked to an approved membership before store access is granted.
- The current sign-up flow also contains a legacy Supabase email lookup for account recovery. This lookup is profile metadata only and must never be used as proof of identity or as a password fallback.

### Cloudflare Worker

- The checked-in `cloudflare-worker/src/otp.ts` implements OTP challenge storage, expiry, attempt limits, and provider usage controls using a D1 binding (`OTP_DB`) and Worker secrets such as `OTP_HASH_SECRET` and email provider keys. Keep these secrets server-side.
- The Worker has a configured Supabase WhatsApp webhook endpoint and accepts credentials through Worker environment/configuration paths. Verify the deployed Worker bindings and secret names before changing any integration; do not print or copy secret values into the repository or browser.
- No Supabase service-role key reference was found in the inspected Worker entrypoint. A future privileged Supabase API must be implemented with a server-only secret binding and strict per-operation authorization; do not assume the current OTP Worker already supplies Supabase admin functionality.
- Keep OTP delivery and identity verification behavior working during the migration. Do not replace D1 OTP state with a new backend until equivalent expiry, retry, abuse throttling, provider failover, and replay protections are tested.

### Safe implementation order

1. Introduce a single canonical Supabase session provider and route both owner and employee login through it, while retaining the existing Firebase path until the replacement is feature-complete.
2. Add a trusted account-linking/invitation flow: verify phone/email ownership, create or locate the Auth identity, then attach the correct store membership. Never auto-grant owner based on client metadata or legacy `is_admin`.
3. Move password reset, email verification, OTP completion, logout, and session restoration to the same identity provider.
4. Replace the database service by domain slices (catalog/storefront, orders/customers, inventory/purchasing, finance, messaging), preserving local cache, idempotency, conflict resolution, and explicit deletion semantics.
5. Add and test Realtime subscriptions only after the corresponding RLS policies are in place.
6. Remove Firebase SDK/configuration and Firestore data only after a repository-wide import/API scan shows no live usage and all staging smoke tests pass.



### Follow-up security hardening (branch only; 2026-10-30)

- The policy/grant audit also found broad table-level grants to both `anon` and `authenticated` on many public tables, including sensitive operational tables. RLS policies are not a substitute for least-privilege SQL grants; the final hardening migration must revoke unnecessary privileges and re-grant only the operations required by the app's intended access model. This has not been applied to the connected database.
- A focused review of owner sign-in found an account-takeover flaw: when Firebase sign-in failed but a legacy Firestore profile existed, the browser attempted to create a new Firebase Auth account using the phone-derived email and the password supplied by the unauthenticated visitor, then treated the legacy profile as authenticated. A legacy profile is not proof of account ownership.
- Removed that automatic account-creation fallback from `components/SignUpPage.tsx`. Existing Firebase Auth users can still sign in normally; a legacy profile without a valid Auth identity now receives a message directing them to a verified recovery/re-enrollment path. This is a branch-only code change and does not modify user records.
- Remaining review items: partner/supplier passcode fields are still hydrated from legacy settings, and several non-user data-layer queries still use `select('*')`. These require domain-specific field inventories and should not be changed blindly because they may carry storefront/integration settings. In particular, the generic store settings query and partner portal data require an explicit secret-field allowlist before being narrowed.
- The owner sign-up component no longer imports Firebase account creation for the legacy sign-in fallback; Firebase account creation remains only in the deliberate registration path.
