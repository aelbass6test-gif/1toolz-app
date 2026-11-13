# Cloudflare-native remediation audit — 2026-11-01

## Scope and safety boundary

This commit is an audit/remediation checkpoint on `audit/cloudflare-native-completion`, based on `origin/migration/cloudflare-native` at `81311ae`. It does not perform cutover, publish a Worker, apply a D1 migration, copy R2 objects, delete Firebase or Supabase, or modify a production database or bucket. Firebase/Supabase SDKs and configuration remain present.

## Confirmed in source

- Password login creates a pending session; the server sends and verifies login OTP using the email from that session, not an email or phone supplied by the browser.
- `getAuthContext` requires a non-null `mfa_verified_at` in addition to revocation, expiry, active-account, and password-change checks.
- Account activation, password recovery, and password change create MFA-complete sessions after their verification/context checks.
- The OTP screen cancellation calls `/api/v1/auth/logout` to revoke a pending session.
- `isSixDigitOtp` accepts exactly six decimal digits, and `phoneFromSyntheticLogin` accepts only the literal `@mystore-auth.app` suffix.
- Native staging binds to `1toolz-cloudflare-core-lab`, `1toolz-cutover-otp-lab`, `1toolz-wallet-ledger-lab`, `1toolz-product-images-lab`, and `1toolz-cloudflare-backups-lab`. Production image origin and production Bosta/Turbo variables are not configured.
- Staging image URLs fall back to the request origin. Turbo staging returns 503 until an independent `TURBO_STAGING_BASE_URL` is configured.

## Verification completed

- `npm run lint` — passed.
- `npm run build` — passed. The existing Supabase dynamic/static import warning was emitted; it is not treated as migration proof.
- `npm run test:auth-validation` — passed, including applying the additive migration to an in-memory SQLite database only.
- `npm run test:d1-wallet-ledger` — passed, 6/6 tests. Node emitted its known experimental SQLite warning.
- `npm run test:merchant-accounting` — passed.
- `npm run test:shipping` — passed.
- `npm run audit:firebase` — read-only result: 182 reference matches in 20 of 317 scanned source files. Firebase remains referenced and must not be removed.
- `npx --yes wrangler@4.33.0 deploy --dry-run --config cloudflare-worker/wrangler.native-staging.toml` — passed. The output showed only the five lab resources and `BOSTA_STAGING_BASE_URL`; it did not show `BOSTA_PRODUCTION_BASE_URL` or `TURBO_BASE_URL`. This is package/binding validation, not deployment.
- `git diff --check` and `git diff --cached --check` are required again immediately before commit.

## Migration and data-parity boundary

`cloudflare-worker/auth-migrations/0001_auth_session_mfa.sql` is additive and was not applied to D1. The local test proves SQL applicability to a minimal in-memory SQLite table; it does not prove that any remote D1 schema or data is compatible.

No independent Firebase or Supabase source comparison was performed in this checkpoint. Internal migration logs, build success, Wrangler dry-run, or test success are not evidence of source/data parity. No customer rows, credentials, OTPs, or individual identity records are included here.

## Remaining gates

Before any staging migration or deployment: obtain an independent, read-only metadata/count/checksum comparison against the source, review the complete D1 schema, approve the exact staging action, run synthetic-data operational tests, and document rollback. Production cutover remains out of scope. Firebase/Supabase dependencies and configuration remain intentionally intact.
