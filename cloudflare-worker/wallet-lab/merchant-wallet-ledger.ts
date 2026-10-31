/**
 * Internal D1 wallet-ledger operations for the isolated migration lab.
 *
 * SECURITY: this module is not an HTTP route. Callers must authenticate the
 * Supabase/Cloudflare identity and enforce store ownership/manager roles before
 * invoking it. Never bind this database directly to browser code.
 *
 * Monetary values are integer piastres. Never use floating point for ledger math.
 */

export type WithdrawalStatus = "pending" | "processing" | "approved" | "rejected";
export type PayoutMethod = "bank" | "instapay" | "wallet";

export interface D1Meta {
  changes?: number;
  rows_read?: number;
  rows_written?: number;
}

export interface D1RunResult {
  success: boolean;
  meta?: D1Meta;
}

export interface D1StatementLike {
  bind(...values: Array<string | number | null>): D1StatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1StatementLike;
}

export interface WithdrawalRow {
  id: string;
  store_id: string;
  merchant_id: string;
  amount_minor: number;
  transfer_fee_minor: number;
  status: WithdrawalStatus;
  idempotency_key: string;
  payout_method: PayoutMethod;
  payout_account_ref: string | null;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  transfer_reference: string | null;
  rejection_reason: string | null;
  transitioned_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

export interface SubmitWithdrawalInput {
  storeId: string;
  merchantId: string;
  amountMinor: number;
  transferFeeMinor: number;
  idempotencyKey: string;
  payoutMethod: PayoutMethod;
  /** An opaque vault/reference id only; never pass a raw bank or wallet number. */
  payoutAccountRef?: string | null;
  requestedByUserId: string;
}

export interface TransitionWithdrawalInput {
  storeId: string;
  merchantId: string;
  requestId: string;
  targetStatus: "processing" | "approved" | "rejected";
  actorUserId: string;
  transferReference?: string | null;
  rejectionReason?: string | null;
  occurredAt?: string;
}

export interface WalletSnapshot {
  store_id: string;
  merchant_id: string;
  currency_code: string;
  balance_minor: number;
  reserved_minor: number;
  available_minor: number;
  requests_reserved_minor: number;
  ledger_balance_minor: number;
}

function requiredText(value: string, field: string, maxLength = 200): string {
  const cleaned = String(value ?? "").trim();
  if (!cleaned || cleaned.length > maxLength) {
    throw new Error(`invalid_${field}`);
  }
  return cleaned;
}

function assertMinorUnits(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`invalid_${field}_minor_units`);
  }
}

function assertSameIdempotentPayload(
  existing: WithdrawalRow,
  input: SubmitWithdrawalInput
): void {
  const same =
    Number(existing.amount_minor) === input.amountMinor &&
    Number(existing.transfer_fee_minor) === input.transferFeeMinor &&
    existing.payout_method === input.payoutMethod &&
    (existing.payout_account_ref ?? null) === (input.payoutAccountRef ?? null);

  if (!same) {
    throw new Error("idempotency_key_reused_with_different_payload");
  }
}

async function findByIdempotencyKey(
  db: D1DatabaseLike,
  storeId: string,
  merchantId: string,
  idempotencyKey: string
): Promise<WithdrawalRow | null> {
  return db.prepare(
    `SELECT * FROM merchant_withdrawal_requests
     WHERE store_id = ? AND merchant_id = ? AND idempotency_key = ?
     LIMIT 1`
  ).bind(storeId, merchantId, idempotencyKey).first<WithdrawalRow>();
}

async function findById(
  db: D1DatabaseLike,
  storeId: string,
  merchantId: string,
  requestId: string
): Promise<WithdrawalRow | null> {
  return db.prepare(
    `SELECT * FROM merchant_withdrawal_requests
     WHERE store_id = ? AND merchant_id = ? AND id = ?
     LIMIT 1`
  ).bind(storeId, merchantId, requestId).first<WithdrawalRow>();
}

/**
 * Creates a durable withdrawal request. The SQLite trigger reserves funds
 * inside the same INSERT statement, so a refresh cannot release the hold.
 * A replay with the same idempotency key returns the original request.
 */
export async function submitMerchantWithdrawal(
  db: D1DatabaseLike,
  input: SubmitWithdrawalInput
): Promise<WithdrawalRow> {
  const storeId = requiredText(input.storeId, "store_id");
  const merchantId = requiredText(input.merchantId, "merchant_id");
  const idempotencyKey = requiredText(input.idempotencyKey, "idempotency_key", 180);
  const requestedByUserId = requiredText(input.requestedByUserId, "requesting_user_id");
  assertMinorUnits(input.amountMinor, "amount");
  assertMinorUnits(input.transferFeeMinor, "transfer_fee");

  if (input.amountMinor <= 0 || input.transferFeeMinor >= input.amountMinor) {
    throw new Error("invalid_withdrawal_amount_or_fee");
  }
  if (!["bank", "instapay", "wallet"].includes(input.payoutMethod)) {
    throw new Error("invalid_payout_method");
  }

  const payoutAccountRef = input.payoutAccountRef
    ? requiredText(input.payoutAccountRef, "payout_account_reference")
    : null;

  const existing = await findByIdempotencyKey(db, storeId, merchantId, idempotencyKey);
  if (existing) {
    assertSameIdempotentPayload(existing, input);
    return existing;
  }

  const requestId = `mwr-${crypto.randomUUID()}`;
  try {
    const result = await db.prepare(
      `INSERT INTO merchant_withdrawal_requests (
        id, store_id, merchant_id, amount_minor, transfer_fee_minor,
        status, idempotency_key, payout_method, payout_account_ref,
        requested_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(
      requestId,
      storeId,
      merchantId,
      input.amountMinor,
      input.transferFeeMinor,
      idempotencyKey,
      input.payoutMethod,
      payoutAccountRef,
      requestedByUserId
    ).run();

    if (!result.success) throw new Error("withdrawal_insert_failed");
  } catch (error) {
    // A concurrent replay may win the unique idempotency constraint. Resolve
    // by re-reading, never by retrying the money-moving INSERT blindly.
    const raced = await findByIdempotencyKey(db, storeId, merchantId, idempotencyKey);
    if (raced) {
      assertSameIdempotentPayload(raced, input);
      return raced;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("insufficient_available_balance")) {
      throw new Error("insufficient_available_balance");
    }
    throw error;
  }

  const created = await findByIdempotencyKey(db, storeId, merchantId, idempotencyKey);
  if (!created) throw new Error("withdrawal_created_but_not_readable");
  return created;
}

/**
 * Transitions a request. The database triggers atomically release or consume
 * the reservation and append the immutable ledger entries / audit event.
 */
export async function transitionMerchantWithdrawal(
  db: D1DatabaseLike,
  input: TransitionWithdrawalInput
): Promise<WithdrawalRow> {
  const storeId = requiredText(input.storeId, "store_id");
  const merchantId = requiredText(input.merchantId, "merchant_id");
  const requestId = requiredText(input.requestId, "request_id");
  const actorUserId = requiredText(input.actorUserId, "transition_actor");
  const current = await findById(db, storeId, merchantId, requestId);

  if (!current) throw new Error("withdrawal_not_found");
  if (current.status === input.targetStatus) return current;
  if (current.status === "approved" || current.status === "rejected") {
    throw new Error("withdrawal_already_finalized");
  }
  if (input.targetStatus === "processing" && current.status !== "pending") {
    throw new Error("invalid_withdrawal_status_transition");
  }

  const occurredAt = input.occurredAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(occurredAt))) throw new Error("invalid_transition_timestamp");

  if (input.targetStatus === "approved" && !actorUserId) {
    throw new Error("approval_actor_required");
  }
  if (input.transferReference && input.transferReference.length > 180) {
    throw new Error("transfer_reference_too_long");
  }
  if (input.rejectionReason && input.rejectionReason.length > 500) {
    throw new Error("rejection_reason_too_long");
  }

  const result = await db.prepare(
    `UPDATE merchant_withdrawal_requests
     SET status = ?,
         transitioned_by_user_id = ?,
         approved_by_user_id = CASE WHEN ? = 'approved' THEN ? ELSE approved_by_user_id END,
         transfer_reference = CASE WHEN ? = 'approved' THEN ? ELSE transfer_reference END,
         rejection_reason = CASE WHEN ? = 'rejected' THEN ? ELSE rejection_reason END,
         processed_at = CASE WHEN ? IN ('approved', 'rejected') THEN ? ELSE processed_at END,
         updated_at = ?
     WHERE id = ? AND store_id = ? AND merchant_id = ?
       AND status IN ('pending', 'processing')`
  ).bind(
    input.targetStatus,
    actorUserId,
    input.targetStatus,
    actorUserId,
    input.targetStatus,
    input.transferReference ?? null,
    input.targetStatus,
    input.rejectionReason ?? null,
    input.targetStatus,
    occurredAt,
    occurredAt,
    requestId,
    storeId,
    merchantId
  ).run();

  if (!result.success) throw new Error("withdrawal_transition_failed");
  const updated = await findById(db, storeId, merchantId, requestId);
  if (!updated) throw new Error("withdrawal_missing_after_transition");

  // If a concurrent identical transition won, return its durable outcome.
  if ((result.meta?.changes ?? 0) === 0 && updated.status !== input.targetStatus) {
    throw new Error("withdrawal_transition_conflict");
  }
  return updated;
}

export async function getMerchantWalletSnapshot(
  db: D1DatabaseLike,
  storeIdInput: string,
  merchantIdInput: string
): Promise<WalletSnapshot | null> {
  const storeId = requiredText(storeIdInput, "store_id");
  const merchantId = requiredText(merchantIdInput, "merchant_id");
  return db.prepare(
    `SELECT store_id, merchant_id, currency_code, balance_minor,
            reserved_minor, available_minor, requests_reserved_minor,
            ledger_balance_minor
     FROM merchant_wallet_reconciliation
     WHERE store_id = ? AND merchant_id = ?
     LIMIT 1`
  ).bind(storeId, merchantId).first<WalletSnapshot>();
}
