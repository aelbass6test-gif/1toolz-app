# Cloudflare-only migration laboratory

Target architecture: Cloudflare Workers + D1 + R2. Supabase and Firebase are migration sources only; they are not configured as dependencies in this lab.

## Isolated resources

- Git branch: `experiment/cloudflare-only-cutover`
- D1: `1toolz-cloudflare-core-lab`
- D1 UUID: `bd6a0b1f-7d11-4c38-9b6b-810383f5a873`
- R2 backup bucket: `1toolz-cloudflare-backups-lab`
- EU region (EEUR); no app Worker binding and no production route.

## Migration landing model

`app_records` stores source records as validated JSON keyed by source system/table/record key. It preserves legacy payloads while normalizing domain tables in safe phases. The schema also separates identity reactivation, memberships, auth sessions, recovery tokens, integration-secret inventory, idempotency, and migration audit.

No legacy password hash or plaintext password is imported. No integration secret is placed in cleartext in the landing database. Imported accounts start `pending_reactivation`; current user credentials must be re-established through a verified recovery flow. Legacy admin and store-role claims remain untrusted until identity reconciliation.

## Source inventory

Supabase project currently reports 51 public tables. Approximate/listed row counts show data in 22 tables, including 6 stores, 250 orders, 262 products, 1,153 transactions, 216 customers, 142 activity logs, 50 WhatsApp messages, 9 conversations, 9 partners, and 27 partner transactions. The Auth schema reports 2 users. These source counts must be rechecked and reconciled against exact row counts during export.

Firebase/Firestore is still an active dependency in source. No complete Firestore export has been supplied or connected in this lab yet, so this branch must not claim Firebase data is migrated.

## Cutover gates

1. Complete export/import from Supabase with row counts and deterministic checksums for all 51 tables, excluding legacy passwords and sanitizing secret values.
2. Complete Firestore export/import for all collections, with document IDs, tenant ownership, and offline/cache parity.
3. Reconcile store ownership and identities (including six stores, four known memberships, and two Supabase Auth identities). No unverified user is granted an administrator role.
4. Re-provision all integration credentials through encrypted Cloudflare secrets; do not carry plaintext keys inside browser-readable settings.
5. Integrate domain services and authentication with Cloudflare Workers + D1, including realtime updates, order/inventory workflows, notifications, payments, uploads, and all admin screens.
6. Test financial concurrency, exact balances, idempotency, restore, access isolation, and rollback.
7. Only then change the production Worker routes, disable old backends, and remove Firebase/Supabase SDKs/configuration.

Never delete, pause, or revoke the old production sources before these gates pass.
