# Supabase identity and membership cutover design

Status: design specification only. This document is not an executable migration and does not authorize production changes.

## Goals

- Replace Firebase Auth as the credential provider for owners and employees.
- Make Supabase Auth the only identity authority.
- Keep business profile data separate from credentials.
- Grant access to a store only through a server-verified membership.
- Preserve current store data and employee permission behavior during phased migration.
- Avoid account takeover caused by phone-number reuse, synthetic email aliases, client-selected store IDs, or client-selected roles.

## Current constraints verified on 2026-10-30

- Owner and employee login in App.tsx still authenticates through Firebase using phone-derived @mystore-auth.app aliases.
- Employee registration currently creates a Firebase Auth identity and writes an employee request into the store's embedded settings.
- The app currently loads store data before it can complete the employee identity flow. A future authorization boundary must not depend on that pre-authenticated browser data.
- Production public.store_memberships contains four rows across four stores and two Supabase Auth identities. Six stores exist, so two stores currently have no membership row.
- Production does not yet contain public.user_profiles; the additive profile migration is branch-only.
- Membership rows currently contain only user_id, store_id, role, and created_at. There is no membership status, invitation record, or normalized permission model.
- Existing store settings contain employee records and permission arrays. These are business data, not proof that a person has authenticated or been approved.
- The legacy public.users.password field must never be selected, copied, logged, or used for authentication.

## Non-negotiable identity rules

1. A Supabase Auth UUID is the canonical user identity. Never derive identity from a phone number, store code, browser storage, profile row, or client-supplied UUID.
2. An email or phone stored in user metadata is unverified until Supabase Auth or a trusted verification flow confirms ownership.
3. A client must never create its own owner, manager, or staff membership. It must never choose the role it receives.
4. A store ID supplied by the browser is only a requested resource. The server and RLS must verify that the authenticated user is an active member with the required permission.
5. Do not auto-link a legacy profile to a new Auth identity merely because the phone or email strings match. Require a verified challenge plus an authorized claim workflow.
6. Do not copy legacy passwords or create new Auth users from legacy password fields.
7. Do not ship a service-role key, invitation signing secret, or provider credential to browser code.

## Proposed data model (design; not yet deployed)

### public.user_profiles

One private profile per auth.users.id:
- user_id uuid primary key references auth.users(id) on delete cascade
- display_name text
- phone text (display/contact metadata only)
- phone_verified_at timestamptz null
- created_at, updated_at

RLS: authenticated users may read/update their own profile only. Profile writes must not alter identity, verification timestamps, platform roles, or memberships.

### public.store_invitations

One-time invitation issued by a trusted store owner or trusted bootstrap process:
- opaque UUID primary key
- canonical store_id
- normalized intended email (or verified phone, only if phone challenge is supported)
- fixed role selected by the inviter from an allowlist (manager, staff; never owner through the ordinary employee invite route)
- permission payload or reference to a normalized permission set
- token_hash only (never store the raw bearer token)
- expires_at, accepted_at, revoked_at
- created_by Auth UUID and timestamps

No direct browser INSERT/UPDATE/DELETE. Creation and acceptance run through a server-side Edge Function or Worker endpoint using a transaction/RPC with tightly restricted execution. The raw invitation token is random, single-use, short-lived, delivered only to the intended verified contact, and never logged.

### public.store_memberships

Extend the existing membership table only after staging review:
- keep user_id, store_id, and role
- add explicit status (active, suspended, revoked) with a safe default for new records
- add permissions only if the existing employee permission model cannot be represented cleanly in a normalized child table
- add timestamps/audit fields as needed

Do not assume every legacy membership is correct merely because it exists. Reconcile each owner and staff row against the store owner and employee records before activating it. Preserve the two stores that currently have no membership by using an audited owner-claim workflow, not by guessing their owner identity.

### Owner bootstrap

The first owner of each existing store is a special migration operation:
- An operator verifies ownership using an out-of-band business verification process.
- A trusted server-side bootstrap function creates or claims the owner membership for the verified Auth UUID.
- The function is one-time per store, idempotent, writes an audit record, and cannot be called by an arbitrary authenticated user.
- Ordinary employee invitation endpoints cannot issue the owner role.
- No hard-coded phone, email string, client flag, or legacy isAdmin field grants platform-admin privileges.

## Target flows

### New owner

1. Owner signs up directly through Supabase Auth with a verified email.
2. Supabase creates the private profile through the Auth trigger.
3. The owner creates a new store or claims an existing store through the trusted bootstrap process.
4. The server creates the owner membership and audit record.
5. The app loads only stores returned by the authenticated membership query.
6. Store data access is governed by RLS and exact role/permission checks.

### Existing owner migration

1. Owner completes a fresh Supabase Auth sign-up or password reset; legacy credentials are not imported.
2. The app verifies the email challenge.
3. A trusted account-claim operation checks the verified contact against independently established store ownership evidence.
4. The server links the Auth UUID to the store as owner, with an audit trail.
5. The owner confirms access to the expected store data in staging before the old login path is retired.

### Employee invitation

1. An active owner/authorized manager creates an invitation for a specific email and chooses an allowed role and permission set.
2. The server stores only a hash of a high-entropy, expiring, single-use token.
3. The employee signs in or signs up through Supabase Auth and verifies the same email address.
4. The server validates token hash, expiry, revocation, email match, store status, and inviter authority.
5. In one database transaction, the server consumes the invitation and creates/activates the membership with the server-selected role and permissions.
6. The app refreshes the session and membership list. A pending request in embedded store settings alone never grants access.

### Employee login

1. Employee authenticates through Supabase Auth using the email associated with the invited identity.
2. The app obtains the current Supabase session and verifies the user with Supabase Auth.
3. The app queries only that user's active memberships.
4. The employee selects among authorized stores; the selected store ID is checked again by RLS for every data operation.
5. Permission checks distinguish routine operations from finance, refunds, employee management, settings, and other sensitive actions.
6. Logout clears Supabase Auth session and all app-level cached identity/store state.

Phone-based sign-in may be added later only with a verified phone-auth flow. Do not recreate synthetic Firebase email aliases as a substitute.

## Authorization and RLS rollout

- Replace each broad public FOR ALL USING (true) policy with separate SELECT/INSERT/UPDATE/DELETE policies after the matching app domain is migrated.
- Use canonical store_id only. Do not allow caller-controlled fallback between store_id and storeId.
- Membership predicates must use auth.uid(), require active membership, and be safe against arbitrary UUID probing.
- Sensitive operations need permission-level checks, not merely a generic membership check.
- Keep storefront reads narrowly public through published-data views or explicit safe policies. Never make orders, customer records, employees, finance, partner credentials, or integration secrets public.
- Use server-only functions for invitations, first-owner bootstrap, payment webhooks, integration secrets, and other privileged actions.
- Realtime subscriptions must be tested against the same store and role boundaries as table reads.

## Migration sequence

1. Confirm a dedicated non-production Supabase project is explicitly designated for staging. Do not assume the currently empty second project is staging.
2. Apply the profile foundation and proposed invitation/membership schema only to staging.
3. Implement and test trusted owner bootstrap and invitation acceptance, including concurrency and replay protection.
4. Implement Supabase Auth session bootstrap and owner sign-in behind a feature flag; do not remove Firebase fallback until staging tests pass.
5. Implement employee invite/accept/login and permission mapping.
6. Migrate one low-risk data domain from Firestore to Supabase and compare read/write results, offline behavior, and reconciliation.
7. Migrate remaining domains incrementally, with rollback and data-integrity checks for each.
8. Apply table-specific RLS after the corresponding domain uses Supabase Auth and passes cross-store negative tests.
9. Gate Worker carrier/media routes on verified Supabase sessions and store permissions after the app sends the new session consistently.
10. Remove Firebase Auth/Firestore SDKs, config, and code only after repository-wide reference scans and production rollback criteria are satisfied.

## Required automated tests

- Unauthenticated user cannot read profiles, memberships, invitations, or private store data.
- User A cannot read/update User B's profile or memberships.
- A user cannot create or promote their own membership.
- An employee invitation cannot grant owner or platform-admin.
- Invitation fails for wrong email, expired token, revoked token, replay, wrong store, inactive inviter, or mismatched role.
- Concurrent acceptance of the same token creates at most one membership.
- A user with membership in Store A cannot read or mutate Store B.
- Suspended/revoked membership immediately loses access, including Realtime.
- Staff cannot perform finance, payout, employee-management, or settings operations without the explicit permission.
- Public storefront can read only published fields; anonymous clients cannot read orders, customers, employees, partners, finance, or secrets.
- First-owner bootstrap can run only through the trusted process and only once per store.
- Existing stores without membership remain inaccessible to unverified identities until owner claim is completed; no silent lockout or guessed ownership is allowed.

## Rollback and release gates

- Do not merge or activate the new auth path until the full staging test matrix passes.
- Keep Firebase available as a temporary fallback until the new login and data paths have proven parity; do not dual-write credentials.
- Keep production schema, RLS, Worker routes, and Firebase configuration unchanged during the design phase.
- Record the identity mapping and store ownership reconciliation before production cutover.
- Have a tested rollback path for app version, Worker version, and database policy changes independently.
