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
- Added `services/supabaseAuthService.ts` with a single project-configured Supabase Auth client, PKCE flow, sign-up/sign-in/sign-out, current-user/session lookup, auth-state subscription, password-reset request, password update, and PKCE email-token verification helpers. The UI and route cutover still needs to be wired and tested.
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


### Trigger helper hardening migration added (branch only; 2026-10-30)

- Added `20261030120000_harden_trigger_helpers.sql`.
- Pins `public.set_updated_at()` to an empty search path and revokes direct execution from `PUBLIC`, `anon`, and `authenticated`. Existing table triggers continue to invoke it; the function only updates `NEW.updated_at`.
- Pins `public.rls_auto_enable()` to `pg_catalog` and revokes direct execution from application roles. The existing `ensure_rls` DDL event trigger remains attached to this function and is not dropped or disabled.
- Read-only catalog inspection confirmed `ensure_rls` is the event trigger that invokes `rls_auto_enable()`, while 35 ordinary table triggers use `set_updated_at()`. No trigger attachments or database data were changed during this inspection.
- This SQL is committed to the migration branch only. It has not been applied to the connected Supabase project; apply only after staging validation and a reviewed deployment window.


### Partner credential exposure review (branch only; 2026-10-30)

- The store hydration mapper no longer copies the legacy `partners.password` field or `details.password` into the in-memory partner object; fallback objects are sanitized as well.
- Partner portal code currently authenticates a partner by comparing a PIN in the browser, so the legacy `passcode` remains part of the client model for compatibility. This is not an acceptable final authentication design.
- Important limitation: the current generic Supabase `partners.select('*')` still retrieves the database row (including its password column and the JSON details column) before the mapper strips the legacy password fields. Therefore this change reduces accidental propagation through application state but does **not** yet prevent those fields crossing the network to the browser.
- Before enabling the Supabase read path in production, replace the generic query with a database-side safe projection that excludes password material, and move partner PIN verification to a server-side/Supabase Auth flow. Do not expose the service-role key in the browser.


### Partner portal URL-login hardening (branch only; 2026-10-30)

- Removed the effect that authenticated a partner from `pin`/`code` URL parameters or the `auto=1`/`direct=1` flags, including the implicit default-PIN path.
- Updated the failed-PIN message so it no longer advertises `0000` as a default credential.
- The normal partner login is still a client-side PIN comparison and its session is still stored in browser session storage. This is **not** a secure final authentication boundary; do not treat the portal as production-secure until server-side verification, authenticated sessions, and per-request authorization are implemented.
- A read-only aggregate check of the live `public.partners` table found 9 rows and no populated legacy `password`, `passcode`, or `details.password` fields. This check returned counts only; no credential values were selected. No data was changed.


### Partner default-PIN removal (branch only; 2026-10-30)

- Removed the implicit `0000` PIN from synthesized supplier/merchant partner entries and from database hydration.
- Partner login now fails closed when no PIN is configured and tells the user to ask the store administrator to provision one. A missing PIN is no longer treated as a valid shared credential.
- This can require an administrator to configure PINs for legacy supplier/merchant portal accounts before those accounts can sign in. This is intentional rather than preserving a universal default credential.
- Normal PIN comparison remains client-side and is only an interim compatibility path. Server-side authentication is still required before production cutover.


### Employee recovery and activation-code exposure hardening (branch only; 2026-10-30)

- Removed activation codes from server logs and from the `/api/send-account-activation` JSON response. The code is delivered only through the configured email channel; the UI already accepts the code entered by the user.
- Removed employee password-reset codes from server logs. If the email provider does not confirm delivery, the reset request now fails closed with HTTP 503 and the temporary reset records are cleared; the API no longer returns the code in an error message.
- Added a maximum of five wrong employee reset-code attempts per issued code; after the limit the record is invalidated and the user must request a new code.
- The current reset-code storage and cooldown are process-local in-memory maps, so they are not durable/shared across multiple Worker instances or restarts. A production-grade recovery flow still needs durable, rate-limited storage (or Supabase Auth recovery) and consistent identity linking.
- This branch still has legacy Firebase employee recovery paths; this hardening does not complete the Firebase-to-Supabase identity migration.

### Connected production security snapshot (read-only; 2026-10-30)

Project: `kwirhppfowzqshltmoga` (`Wuilt-Platform`).

- 48 public tables were inspected; RLS is enabled on all 48.
- 17 tables have no RLS policies. These are fail-closed for row access, but their application flows will fail until purpose-specific policies are added.
- The security advisor also reports broad public policies on `public.users`, `public.partners`, and `public.stores_data` with `USING (true)` and `WITH CHECK (true)`. These policies expose broad read/write paths and must be replaced with table-specific rules.
- A catalog check found 168 table privileges granted to `anon`. Grants and RLS policies must be reviewed together; RLS alone does not remove table-level privileges.
- The connected production project currently has 2 Auth users and 4 store-membership rows linked to those identities. Only aggregate counts were inspected; no identity values were read.
- The production security advisor also reports the leaked-password protection setting is disabled.
- No production schema, policy, grant, user, membership, or business data was changed during this audit.

The empty project `lhlcwtxbmxipcesuymnr` (`Wuilt-Platform2`) was inspected and contains no public tables or migrations. It has not been designated or modified as a staging environment.

### Supabase Auth action-flow cutover (branch only; 2026-10-30)

- Replaced the Firebase-backed password-reset and email-verification hook with Supabase Auth APIs.
- Added a Supabase signup-confirmation resend helper.
- Reworked the legacy action-page route to consume Supabase PKCE callback sessions or Supabase token-hash links, and to update passwords through Supabase Auth. Recovery and signup callbacks carry explicit `type=recovery` / `type=signup` intent so the shared callback page renders the correct flow.
- Updated the owner password-reset UI to rely on the explicit boolean result of the reset request instead of checking stale React state.
- This is an Auth-action slice only. The owner login, owner signup, employee login/registration, session bootstrap, and OTP/session handoff in `App.tsx` and the sign-up/employee screens still contain Firebase Auth calls.
- The current owner sign-up path still writes user profile records through the legacy `createUserDoc` implementation. Do not switch that path to Supabase Auth until the profile/tenant membership flow is moved to the new `user_profiles` and `store_memberships` model with appropriate authorization.
- The production `public.users` table contains a legacy `password` column. Do not select, expose, copy, or use this field for authentication. Authentication must be delegated to Supabase Auth.
- GitHub Actions validation for commit `9c5df6e8cf7ee00d0d4c6d9ae00f318f1b1fdef8` was queued at the time of this update; earlier baseline commit `d06325f590b2f0b63d7162e773fe5f15b463f983` passed both type-check and production build.
- No production database schema, RLS policy, grant, user, membership, or business data was changed in this slice.

### Auth schema deployment gate (live project inspection; 2026-10-30)

- The connected production project has a `public.store_memberships` table with `user_id`, `store_id`, `role`, and `created_at`; the read-only check found 4 rows earlier in this session.
- The connected production project does **not** currently have `public.user_profiles`. The additive Auth foundation migration in this branch has not been applied to production.
- Therefore the current Supabase Auth helper code is groundwork only. New owner/employee onboarding must not be switched to Supabase until the profile table, owner bootstrap flow, membership linking, and safe store-scoped policies have been deployed and tested in a non-production environment.
- The legacy `public.users` table contains a nullable `password` column. Application code must never select or use it for authentication. New credentials belong exclusively in `auth.users`.
- The available empty Supabase project `lhlcwtxbmxipcesuymnr` has not been designated as staging. No schema or data was written to either connected Supabase project during this inspection.


### Membership and legacy identity revalidation (read-only; 2026-10-30)

A second read-only catalog pass was run against the connected project after the Auth action-flow changes. It confirms the following:

- `public.store_memberships` currently has exactly the columns `user_id uuid NOT NULL`, `store_id text NOT NULL`, `role text NOT NULL`, and `created_at timestamptz NOT NULL`. There is no active/invitation/permission column in this table yet; employee permission enforcement therefore cannot be inferred from membership role alone.
- The live membership policies are named `Staging users read own memberships`, `Staging owners insert non-owner memberships`, `Staging owners update non-owner memberships`, and `Staging owners delete non-owner memberships`. They allow a user to read their own rows and an existing owner to manage another user's `manager` / `staff` membership. They do not provide a safe first-owner bootstrap path, invitation acceptance, or a verified identity-linking path.
- The live `public.stores_data` policy remains `Public Access Stores` with `FOR ALL`, `USING (true)`, and `WITH CHECK (true)`. The live `public.users` policy remains `Public Access Users` with the same unrestricted shape. These must not be mistaken for tenant isolation.
- `public.users` has legacy profile columns including `phone`, `full_name`, `email`, `stores`, and `sites`, plus a nullable legacy `password` column. It has no `auth_user_id` link column in the inspected schema. Never read or use the password column.
- `public.user_profiles` is still absent from the live project. The profile trigger and policies in the branch migration are not live.
- The latest PR workflow run for HEAD `567f90c92ab8ed4e6aacd25fbea43abb935e616c` completed successfully: dependency installation, TypeScript type-check, and production build all passed. This validates compilation/build only; it does not validate runtime authentication, RLS, or data migration.
- No production schema, policy, grant, user, membership, business data, or Cloudflare deployment was changed by this revalidation.

Implementation consequence: do not wire the current employee registration UI directly to `store_memberships`. First add a reviewed, non-production invitation/claim model with verified contact ownership, an explicit membership status and permissions model, and a one-time owner bootstrap path that cannot be called by arbitrary authenticated users. The client must not be able to select its own role or attach itself to an arbitrary store. Until that is tested, keep the existing Firebase-backed flows in place and continue the migration in isolated code slices.


### Authentication log privacy cleanup (branch only; 2026-10-30)

- Removed browser-console messages that printed employee/owner phone numbers during employee-portal sign-in, and removed the success log that repeated the authenticated phone number.
- This is a privacy hardening change only; Firebase remains the active credential provider for this login path until the Supabase Auth identity-linking and membership cutover is complete.
- No account data or production configuration was changed.


### Security advisor recheck (read-only; 2026-10-30 04:22 UTC)

A fresh security/performance advisor pass confirms the production warnings are still present; the branch-only SQL hardening has not been deployed:

- Security advisor still reports 17 RLS-enabled tables with no policies, a mutable search path on `public.set_updated_at()`, and public/anonymous execution of the SECURITY DEFINER event-trigger helper `public.rls_auto_enable()`.
- The two membership helper functions, `is_store_member(text, uuid)` and `is_store_owner(text)`, are SECURITY DEFINER and executable by authenticated users because they are used by RLS expressions. Keep their implementation narrowly scoped and pinned to an empty search path; do not add any privileged provisioning behavior to them.
- Supabase Auth leaked-password protection is still disabled. Enable it in the Auth security settings as a separate reviewed configuration change before broad user onboarding.
- Performance advisor reports 10 foreign keys without covering indexes, including the `store_memberships.store_id` foreign key. These should be reviewed with query plans and table size before adding indexes; do not make speculative production index changes during the authentication cutover.
- The branch migration `20261030120000_harden_trigger_helpers.sql` addresses the two trigger-helper warnings but remains unapplied. It does not address the 17 missing-policy tables or the Auth leaked-password setting.
- No production changes were made during this advisor recheck.

Reference guidance: [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [mutable function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [SECURITY DEFINER function exposure](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), and [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).


### Migration CI regression coverage (branch only; 2026-10-30)

The migration branch workflow now runs the two existing regression suites before type-check/build:

- `npm run test:merchant-accounting`
- `npm run test:shipping`

This extends the gate beyond compilation and protects the existing settlement and shipping-status logic while the persistence layer is migrated. These are existing tests; no product behavior or production data was changed by this CI-only update.

Cloudflare build routing was also inspected read-only: commits on branches other than `main` match the `Deploy non-production branches` trigger, whose command is `wrangler versions upload`; only `main` matches the production trigger using `wrangler deploy`. The in-flight build for commit `6725d7c` was using the non-production trigger, and the latest production deployment timestamp remained `2026-10-30T00:51:17Z` at the time of inspection. Thus the observed migration-branch build is a non-production version upload, not a production deployment.


### Partner portal authentication hardening (branch only; 2026-10-30)

The legacy partner portal had several browser-side authentication bypasses. The migration branch now applies these containment changes:

- OTP sending is accepted only when the destination exactly matches the email already stored on the selected partner record. A visitor can no longer select a partner and supply a different email to receive the code.
- OTP verification resolves the partner only by the selected partner ID plus exact normalized email match. It no longer falls back to the selected ID alone or to the only partner in the store.
- The login screen no longer offers self-service email linking for accounts with no registered email; the store administrator must provision the email through the administrative workflow.
- Removed the one-click “preview as admin” partner login bypass.
- Removed browser `sessionStorage` as a source of authenticated partner identity. The portal now keeps the post-OTP selection in component memory and requires a fresh verification after reload.
- Disabled the client-only PIN and biometric login choices in the partner login screen until server-side account-bound authentication is available; removed the development OTP display from the UI.

Important limitations remain: the OTP verification endpoint currently returns a generic `valid` result rather than a signed partner/store session, partner/store data is still fetched into the browser before authentication, and the legacy partner credential fields/data model still need a server-owned replacement. Therefore this is a containment improvement, not a complete authorization boundary. Do not expose this portal as secure for production financial data until partner identity, store scope, permission checks, and data projection are enforced server-side with Supabase Auth/RLS or a verified Worker session.

No production database, Worker deployment, or live partner record was changed.


Additional partner portal containment:
- The PIN/password handler now fails closed rather than checking partner secrets delivered to the browser.
- The browser-only biometric handler now fails closed; it cannot establish a partner session.
- The legacy partner PIN reset handler no longer writes a plaintext password/PIN into the partner record.
- The only reachable login mode is email OTP sent to the partner's pre-registered address. These changes reduce client-side bypasses but do not replace server-side session issuance or protect store data already loaded into the browser.


### Membership helper hardening (branch-only SQL; not applied)

Read-only review of the live helper definitions found that `is_store_member(store_id, user_id)` accepted an arbitrary user UUID, so an authenticated caller could probe membership for another identity. The migration `20261030140000_harden_membership_helpers.sql` now:
- makes the membership predicate return true only when the supplied UUID equals the current `auth.uid()`;
- pins both SECURITY DEFINER helpers to an empty search path and schema-qualifies table references;
- revokes anonymous/public function execution and grants execution to authenticated/service-role callers for RLS and trusted backend use.

The connected project currently has four membership rows (one owner, three staff), with no duplicate or null membership keys. The current membership policies still do not provide a secure owner bootstrap or invitation-acceptance flow. This migration is committed to the branch only and must be exercised in a dedicated staging project before production use.


### Additional live secret exposure findings (aggregate-only; 2026-10-30)

A recursive key-name/count scan of `stores_data.settings` (values were not selected or returned) found non-empty sensitive-key entries:
- `passcode`: 9 occurrences across 3 stores.
- `telegramBotToken`: 1 occurrence in 1 store.
- `apiKeyError`: 1 key name (not treated as a credential; likely an error/status field).

A separate aggregate of `shipping_integrations` found one integration row with a populated `api_key`; no populated `api_secret` or account-number fields were counted. The table's current RLS policy is still public `FOR ALL` with unrestricted predicates, so its API key must be treated as exposed to anyone able to call the public Data API.

No secret values were read or copied. No production data was changed. The store owner should rotate the exposed Telegram bot token and shipping provider API key through their respective providers, then re-enter replacement credentials only after the integration secrets are moved behind server-side Worker/Edge Function calls. Do not merely delete or blank these values from `stores_data.settings` before confirming the app's integration flows no longer depend on them.
