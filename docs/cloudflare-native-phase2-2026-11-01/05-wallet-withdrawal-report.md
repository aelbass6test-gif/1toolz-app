# Wallet and withdrawal end-to-end report — fresh-start phase

## Repository implementation

The wallet laboratory contains:

- `merchant_withdrawal_requests`;
- immutable `merchant_wallet_ledger`;
- reservation and reconciliation triggers;
- approval/rejection transition triggers;
- actor attribution migration;
- idempotency and financial-field protection logic.

Local tests include `tests/d1-wallet-ledger.test.ts`, `tests/concurrency-transactions.test.ts`, `tests/custody-ledger.test.ts`, and related accounting tests. These are valuable synthetic/local checks, but they are not evidence of a remote D1 end-to-end run.

## Remote status

The repository README contains an older statement about a remote wallet smoke test, but it was not independently re-read from D1 in this phase. A fresh D1 query failed with `SQLITE_AUTH`, so this report deliberately does not claim remote success.

## Required fresh-start run

Using only designated synthetic accounts and balances in the isolated Wallet Lab, execute and re-read state after each operation:

1. create withdrawal;
2. reserve funds;
3. reload from D1 and verify request and balances;
4. approve and verify exactly-once ledger entries;
5. reject a second synthetic request and verify reservation release;
6. retry safely with the same idempotency key;
7. test duplicate request/approval prevention;
8. test insufficient balance and simulated transfer failure;
9. test concurrent withdrawals;
10. verify `available + reserved = total` and durable ledger coverage after every transition.

## Current status

**Local invariant logic:** present and testable.
**Remote Wallet Lab E2E proof:** blocked by D1 read authorization.
**Production impact:** none; no production wallet or customer balance was touched.
