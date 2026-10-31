import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  getMerchantWalletSnapshot,
  submitMerchantWithdrawal,
  transitionMerchantWithdrawal,
  type D1DatabaseLike,
  type D1RunResult,
  type D1StatementLike,
  type SubmitWithdrawalInput
} from "../cloudflare-worker/wallet-lab/merchant-wallet-ledger";

class SqliteStatement implements D1StatementLike {
  private params: Array<string | number | null> = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string
  ) {}

  bind(...values: Array<string | number | null>): D1StatementLike {
    this.params = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.params);
    return (row as T | undefined) ?? null;
  }

  async run(): Promise<D1RunResult> {
    const result = this.database.prepare(this.sql).run(...this.params);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

class SqliteD1Adapter implements D1DatabaseLike {
  constructor(private readonly database: DatabaseSync) {}

  prepare(query: string): D1StatementLike {
    return new SqliteStatement(this.database, query);
  }
}

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");
  const migration1 = readFileSync(
    resolve(process.cwd(), "cloudflare-worker/wallet-lab/migrations/0001_wallet_ledger.sql"),
    "utf8"
  );
  const migration2 = readFileSync(
    resolve(process.cwd(), "cloudflare-worker/wallet-lab/migrations/0002_withdrawal_actor_audit.sql"),
    "utf8"
  );
  database.exec(migration1);
  database.exec(migration2);

  // Synthetic test-only wallet: EGP 100.00; no customer data is used.
  database.prepare(
    `INSERT INTO merchant_wallets (store_id, merchant_id, balance_minor)
     VALUES (?, ?, ?)`
  ).run("test-store-a", "test-merchant-a", 10_000);
  database.prepare(
    `INSERT INTO merchant_wallet_ledger (
       id, store_id, merchant_id, request_id, reference_key, entry_type,
       amount_minor, balance_before_minor, balance_after_minor
     ) VALUES (?, ?, ?, NULL, ?, 'opening_balance', ?, 0, ?)`
  ).run(
    "ledger-opening-a",
    "test-store-a",
    "test-merchant-a",
    "opening:test-store-a:test-merchant-a",
    10_000,
    10_000
  );

  return { database, d1: new SqliteD1Adapter(database) };
}

function input(overrides: Partial<SubmitWithdrawalInput> = {}): SubmitWithdrawalInput {
  return {
    storeId: "test-store-a",
    merchantId: "test-merchant-a",
    amountMinor: 6_000,
    transferFeeMinor: 200,
    idempotencyKey: "client-op-0001",
    payoutMethod: "instapay",
    payoutAccountRef: "vault-ref-test-001",
    requestedByUserId: "synthetic-user-merchant",
    ...overrides
  };
}

test("request reservation persists across a fresh read and processing keeps the hold", async () => {
  const { database, d1 } = fixture();
  const request = await submitMerchantWithdrawal(d1, input());

  assert.equal(request.status, "pending");
  const afterSubmit = await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a");
  assert.ok(afterSubmit);
  assert.equal(afterSubmit.balance_minor, 10_000);
  assert.equal(afterSubmit.reserved_minor, 6_000);
  assert.equal(afterSubmit.available_minor, 4_000);
  assert.equal(afterSubmit.requests_reserved_minor, 6_000);

  // Simulate a page refresh: a new read still sees the database reservation.
  const afterRefresh = await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a");
  assert.equal(afterRefresh?.reserved_minor, 6_000);
  assert.equal(afterRefresh?.available_minor, 4_000);

  const processing = await transitionMerchantWithdrawal(d1, {
    storeId: "test-store-a",
    merchantId: "test-merchant-a",
    requestId: request.id,
    targetStatus: "processing",
    actorUserId: "synthetic-manager-1"
  });
  assert.equal(processing.status, "processing");

  const whileProcessing = await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a");
  assert.equal(whileProcessing?.reserved_minor, 6_000);
  assert.equal(whileProcessing?.available_minor, 4_000);
  assert.equal(
    Number(database.prepare("SELECT COUNT(*) AS n FROM merchant_wallet_events WHERE request_id = ?").get(request.id)?.n),
    2
  );

  database.close();
});

test("approval consumes the reservation once and writes balanced immutable ledger entries", async () => {
  const { database, d1 } = fixture();
  const request = await submitMerchantWithdrawal(d1, input());

  await transitionMerchantWithdrawal(d1, {
    storeId: "test-store-a",
    merchantId: "test-merchant-a",
    requestId: request.id,
    targetStatus: "processing",
    actorUserId: "synthetic-manager-1"
  });

  const approved = await transitionMerchantWithdrawal(d1, {
    storeId: "test-store-a",
    merchantId: "test-merchant-a",
    requestId: request.id,
    targetStatus: "approved",
    actorUserId: "synthetic-admin-1",
    transferReference: "LAB-TRANSFER-0001"
  });
  assert.equal(approved.status, "approved");

  const snapshot = await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a");
  assert.ok(snapshot);
  assert.equal(snapshot.balance_minor, 4_000);
  assert.equal(snapshot.reserved_minor, 0);
  assert.equal(snapshot.available_minor, 4_000);
  assert.equal(snapshot.requests_reserved_minor, 0);
  assert.equal(snapshot.ledger_balance_minor, 4_000);

  const entries = database.prepare(
    "SELECT entry_type, amount_minor, balance_before_minor, balance_after_minor FROM merchant_wallet_ledger WHERE request_id = ? ORDER BY entry_type"
  ).all(request.id) as Array<Record<string, number | string>>;
  assert.equal(entries.length, 2);
  const payout = entries.find(entry => entry.entry_type === "withdrawal_payout");
  const fee = entries.find(entry => entry.entry_type === "withdrawal_fee");
  assert.equal(payout?.amount_minor, -5_800);
  assert.equal(fee?.amount_minor, -200);
  assert.equal(
    entries.reduce((sum, entry) => sum + Number(entry.amount_minor), 0),
    -6_000
  );

  // A retry after an uncertain HTTP response must not debit the wallet again.
  const replay = await transitionMerchantWithdrawal(d1, {
    storeId: "test-store-a",
    merchantId: "test-merchant-a",
    requestId: request.id,
    targetStatus: "approved",
    actorUserId: "synthetic-admin-1",
    transferReference: "LAB-TRANSFER-0001"
  });
  assert.equal(replay.status, "approved");
  assert.equal((await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a"))?.balance_minor, 4_000);
  assert.equal(Number(database.prepare("SELECT COUNT(*) AS n FROM merchant_wallet_ledger WHERE request_id = ?").get(request.id)?.n), 2);

  assert.throws(
    () => database.prepare("UPDATE merchant_wallet_ledger SET amount_minor = 123 WHERE request_id = ?").run(request.id),
    /wallet_ledger_is_immutable/
  );
  database.close();
});

test("concurrent withdrawals cannot reserve more than the available balance", async () => {
  const { database, d1 } = fixture();
  const outcomes = await Promise.allSettled([
    submitMerchantWithdrawal(d1, input({ amountMinor: 7_000, transferFeeMinor: 0, idempotencyKey: "parallel-a" })),
    submitMerchantWithdrawal(d1, input({ amountMinor: 7_000, transferFeeMinor: 0, idempotencyKey: "parallel-b" }))
  ]);

  assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(result => result.status === "rejected").length, 1);

  const snapshot = await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a");
  assert.ok(snapshot);
  assert.equal(snapshot.balance_minor, 10_000);
  assert.equal(snapshot.reserved_minor, 7_000);
  assert.equal(snapshot.available_minor, 3_000);
  assert.equal(snapshot.requests_reserved_minor, 7_000);
  database.close();
});

test("idempotency replays return one request and reject a changed payload", async () => {
  const { database, d1 } = fixture();
  const first = await submitMerchantWithdrawal(d1, input({ idempotencyKey: "retry-key-1" }));
  const [replayA, replayB] = await Promise.all([
    submitMerchantWithdrawal(d1, input({ idempotencyKey: "retry-key-1" })),
    submitMerchantWithdrawal(d1, input({ idempotencyKey: "retry-key-1" }))
  ]);

  assert.equal(replayA.id, first.id);
  assert.equal(replayB.id, first.id);
  await assert.rejects(
    submitMerchantWithdrawal(d1, input({ idempotencyKey: "retry-key-1", amountMinor: 5_000 })),
    /idempotency_key_reused_with_different_payload/
  );

  assert.equal(Number(database.prepare("SELECT COUNT(*) AS n FROM merchant_withdrawal_requests").get()?.n), 1);
  assert.equal((await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a"))?.reserved_minor, 6_000);
  database.close();
});

test("rejection releases a reservation without debiting the wallet", async () => {
  const { database, d1 } = fixture();
  const request = await submitMerchantWithdrawal(d1, input({ amountMinor: 4_000, transferFeeMinor: 100 }));

  const rejected = await transitionMerchantWithdrawal(d1, {
    storeId: "test-store-a",
    merchantId: "test-merchant-a",
    requestId: request.id,
    targetStatus: "rejected",
    actorUserId: "synthetic-admin-1",
    rejectionReason: "Synthetic test rejection"
  });
  assert.equal(rejected.status, "rejected");

  const snapshot = await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a");
  assert.ok(snapshot);
  assert.equal(snapshot.balance_minor, 10_000);
  assert.equal(snapshot.reserved_minor, 0);
  assert.equal(snapshot.available_minor, 10_000);
  assert.equal(snapshot.ledger_balance_minor, 10_000);

  await assert.rejects(
    transitionMerchantWithdrawal(d1, {
      storeId: "test-store-a",
      merchantId: "test-merchant-a",
      requestId: request.id,
      targetStatus: "approved",
      actorUserId: "synthetic-admin-1"
    }),
    /withdrawal_already_finalized/
  );
  assert.throws(
    () => database.prepare("DELETE FROM merchant_withdrawal_requests WHERE id = ?").run(request.id),
    /withdrawal_requests_are_audit_records/
  );
  database.close();
});

test("store scoping and reservation invariants reject mismatched access", async () => {
  const { database, d1 } = fixture();
  const request = await submitMerchantWithdrawal(d1, input());

  await assert.rejects(
    transitionMerchantWithdrawal(d1, {
      storeId: "different-store",
      merchantId: "test-merchant-a",
      requestId: request.id,
      targetStatus: "approved",
      actorUserId: "synthetic-admin-1"
    }),
    /withdrawal_not_found/
  );
  assert.throws(
    () => database.prepare(
      "UPDATE merchant_wallets SET reserved_minor = 0 WHERE store_id = ? AND merchant_id = ?"
    ).run("test-store-a", "test-merchant-a"),
    /reserved_balance_mismatch/
  );
  assert.equal((await getMerchantWalletSnapshot(d1, "test-store-a", "test-merchant-a"))?.reserved_minor, 6_000);
  database.close();
});
