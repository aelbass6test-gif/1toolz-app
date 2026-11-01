# D1 schema compatibility and fresh-start design status

## Lab bindings in repository

From `cloudflare-worker/wrangler.native-staging.toml`:

| Binding | Database | ID | Status |
|---|---|---|---|
| `DB` | `1toolz-cloudflare-core-lab` | `bd6a0b1f-7d11-4c38-9b6b-810383f5a873` | query blocked by `SQLITE_AUTH` |
| `AUTH_DB` | `1toolz-cutover-otp-lab` | `4e2465f9-a757-4f03-bd89-d429eb3a8f24` | not remotely inspected |
| `WALLET_DB` | `1toolz-wallet-ledger-lab` | `e04873eb-0fbc-44f8-a136-4db82d29013f` | query blocked by `SQLITE_AUTH` |

The configuration also defines the two lab R2 buckets documented in the staging report.

## Repository migrations found

- `cloudflare-worker/d1-core-migrations/0001_whatsapp_webhook_events.sql`
- `cloudflare-worker/d1-core-migrations/0002_seed_legacy_identities_pending.sql`
- `cloudflare-worker/migrations/0001_create_otp_tables.sql`
- `cloudflare-worker/auth-migrations/0001_auth_session_mfa.sql`
- `cloudflare-worker/wallet-lab/migrations/0001_wallet_ledger.sql`
- `cloudflare-worker/wallet-lab/migrations/0002_withdrawal_actor_audit.sql`

The repository therefore contains authentication/OTP, WhatsApp webhook, legacy-identity staging, and wallet-lab schema pieces. It does **not** yet contain a complete clean-start relational schema for the application domains required by the new instruction: users/roles, stores, products, orders/order-items, subscriptions, commissions, notifications, discounts, documents, settings, audit logs, and shipping records.

## Independent remote verification result

A read-only Cloudflare D1 query using `SELECT type, name, tbl_name, sql FROM sqlite_master ...` failed before returning any result:

```text
Cloudflare API HTTP 400
code: 7500
message: not authorized: SQLITE_AUTH
```

No remote schema, indexes, triggers, constraints, or data counts were inferred from this failure. No D1 migration, import, or write operation was executed.

## Required next migration artifact

Before staging deployment, add a fresh-start migration set with deterministic ordering and explicit rollback documentation. The minimum design should include normalized users/roles/sessions, stores/memberships, products/inventory, orders/order-items, subscriptions/commissions, wallets/ledger/deposits/withdrawals, notifications, discounts, documents/R2 references, settings, audit logs, and shipping/delivery records. Each financial transition must be idempotent and transactional.

## Blocker

A Cloudflare API token with D1 read permission, or an equivalent read-only Worker/API path, is required to verify the actual lab schema. The current token can list the account and R2 objects but cannot query D1.
