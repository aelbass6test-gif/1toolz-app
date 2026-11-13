# Cloudflare-only cutover gate

## Decision

For the fresh-start path, Cloudflare D1/R2 is the only intended source of truth for **new** application data. Firebase and Supabase remain preserved as read-only archives. No delete, cleanup, or destructive migration is authorized.

## Current gate status: BLOCKED

The gate must remain blocked until every application write is routed through the Cloudflare Worker and verified by a fresh-session read-back. The current repository still contains direct legacy writes, including:

- Firebase Firestore writes in `server.ts`, `src/pages/MaintenancePage.tsx`, `services/orderQuotaLedgerService.ts`, `services/reportShareService.ts`, and other runtime paths.
- Supabase writes for `shared_audits`, `chat_messages`, `presence`, `maintenance_requests`, merchant/partner requests, and administrative functions.
- Media endpoints still proxying to the existing external media service instead of the staging R2 bucket.

Changing the source-of-truth flag before closing these paths would either lose writes or create split-brain data. It is therefore not safe to deploy the cutover yet.

## Non-negotiable acceptance checks

1. Static audit reports zero runtime Firebase/Supabase write calls.
2. All writes use authenticated Worker routes and D1/R2 bindings.
3. Each domain has a synthetic create/read-after-refresh/update/delete test.
4. A second session can read the record using only Cloudflare cookies and D1.
5. R2 upload/read/delete is verified with a synthetic object and cleanup.
6. Legacy sources are tested as read-only: no new timestamps, rows, or updates.
7. Staging is isolated from production database IDs, R2 buckets, and secrets.
8. Production cutover requires a separate explicit approval after the staging evidence is reviewed.

## Preservation rule

Nothing in this phase deletes Firebase, Supabase, or their data. The archive sources remain available for recovery and comparison. A future archive retirement, if ever requested, must be a separate reviewed action with an export and restore proof.
