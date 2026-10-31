# D1 merchant wallet ledger laboratory

This is an isolated prototype for evaluating Cloudflare D1 for 1Toolz merchant withdrawals.

## Isolation

- Git branch: `experiment/d1-merchant-wallet`
- D1 database: `1toolz-wallet-ledger-lab` (EU jurisdiction / EEUR primary)
- Database UUID: `e04873eb-0fbc-44f8-a136-4db82d29013f`
- This database is separate from the app Worker and the existing `abdomedi-otp` database.
- Only synthetic lab records are present. No customer data, production wallet data, live payout, production binding, or production Worker route is used.
- Supabase remains the live application backend. Nothing here retires, migrates, or changes the production Supabase wallet.

## Design

All money is stored as integer piastres. The relational model has:

- `merchant_wallets`: current balance and reserved amount, per store and merchant.
- `merchant_withdrawal_requests`: durable request and idempotency key.
- `merchant_wallet_ledger`: immutable debit/credit entries.
- `merchant_wallet_events`: immutable status-transition audit events.

SQLite triggers make the request insert and reservation one atomic statement. Pending and processing withdrawals remain reserved. Approval consumes the gross amount from the wallet and writes separate payout-net and transfer-fee ledger entries. Rejection releases the reservation without debiting the wallet. The reconciliation view checks the reserved total against open requests and the ledger total against the wallet balance.

## Validation so far

Run locally in CI with:

```sh
npm run test:d1-wallet-ledger
```

The suite covers:
- reservation survival after a fresh read (refresh simulation);
- pending to processing without releasing the hold;
- approval exactly once, with payout and fee ledger entries;
- concurrent over-reservation prevention on SQLite;
- idempotent request replay and payload mismatch rejection;
- rejection release with no debit;
- store-scoped reads, request/ledger immutability, and reservation consistency.

The same schema migrations have also been applied to the isolated remote D1 database. A synthetic EGP 100.00 wallet and one EGP 70.00 pending withdrawal were inserted through the Cloudflare D1 API; a fresh remote read showed balance 10000, reserved 7000, available 3000, open-request reservation 7000, and ledger total 10000 (all amounts are piastres). This is a schema/trigger smoke test, not a full remote concurrency or payout proof.

## Not production-ready

Do not route customer traffic or real withdrawals to this prototype. Before any integration or cutover, all of the following remain mandatory:

1. Implement and test server-side identity authentication and per-store authorization (merchant submit, manager claim, trusted admin approve/reject); this module is not an HTTP route and must only be called behind those checks.
2. Replace legacy embedded passcodes with a verified identity/session flow. Never copy the old `0000` fallback into this design.
3. Build a reconciled, repeatable importer from Supabase's embedded merchant balances and withdrawal requests, with opening ledger entries and duplicate detection.
4. Test actual D1 behavior under parallel requests, retry/timeout uncertainty, worker restarts, and high concurrency. The SQLite CI adapter is not a substitute for remote D1 load testing.
5. Create encrypted independent backups in a separate R2 bucket or another provider, then restore into a separate database and reconcile checksums. D1 export / Time Travel alone is not the independent backup test.
6. Add operational monitoring, alerting, scheduled reconciliation, access logging, retention policy, and tested rollback to Supabase.
7. Confirm the application's existing withdrawal and merchant settlement screens are integrated end-to-end before any release.

No production deployment, Supabase mutation, customer migration, or Firebase removal is authorized by this experiment.
