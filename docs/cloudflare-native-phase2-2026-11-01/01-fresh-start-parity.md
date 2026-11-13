# 1Toolz — Fresh-start data scope and parity status

**Date:** 2026-11-01
**Branch:** `audit/cloudflare-native-completion`
**Commit baseline:** `c7dad5c5f16a4b783ff836ad97413e8590a7ed98`

## Authoritative scope change

The attached instruction explicitly confirms that historical Firebase and Supabase data does not need to be migrated or preserved. The target is a clean Cloudflare-native deployment with newly created accounts, synthetic test data, and no import of customer records, historical orders, balances, transactions, or old credentials.

Accordingly, source-to-D1 record parity, historical checksums, and reconciliation are **not acceptance criteria** for this fresh-start path. They must not be reported as complete or incomplete migration work; they are intentionally out of scope.

## What was independently observed

- Supabase project discovery returned one active project, `Wuilt-Platform`; no data export or row-level extraction was performed after the fresh-start instruction.
- Cloudflare account discovery returned one account: `64217a6dccdfa87e475703a57a695fea`.
- The isolated R2 lab buckets were listed and were empty before the synthetic test.
- D1 database query attempts against the configured lab database IDs failed with Cloudflare `SQLITE_AUTH`; no D1 rows or schema were read.

## Clean-start acceptance condition

The fresh D1 schema must be created from reproducible repository migrations, seeded only with explicitly designated synthetic/system accounts, and verified through the Worker/API or a credential with D1 read permission. No old customer data is required and no Firebase/Supabase record should be used as a runtime dependency.

## Not claimed

This report does not claim that a clean D1 schema exists remotely, that D1 migrations were applied, or that the application is already independent of Firebase/Supabase. Those claims remain blocked by the implementation and access findings in the companion reports.
