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
- These helpers are a foundation only; the existing sign-up/login screens and data listeners are not yet switched over. Do not cut over production until the screens, employee flows, memberships, and data access have been migrated and tested.
