-- Add explicit actor attribution for every withdrawal state transition.
ALTER TABLE merchant_withdrawal_requests
  ADD COLUMN transitioned_by_user_id TEXT;

DROP TRIGGER IF EXISTS trg_withdrawal_protect_identity;
CREATE TRIGGER trg_withdrawal_protect_identity
BEFORE UPDATE ON merchant_withdrawal_requests
BEGIN
  SELECT CASE WHEN
    NEW.id IS NOT OLD.id OR
    NEW.store_id IS NOT OLD.store_id OR
    NEW.merchant_id IS NOT OLD.merchant_id OR
    NEW.amount_minor IS NOT OLD.amount_minor OR
    NEW.transfer_fee_minor IS NOT OLD.transfer_fee_minor OR
    NEW.idempotency_key IS NOT OLD.idempotency_key OR
    NEW.payout_method IS NOT OLD.payout_method OR
    NEW.payout_account_ref IS NOT OLD.payout_account_ref OR
    NEW.requested_by_user_id IS NOT OLD.requested_by_user_id OR
    NEW.created_at IS NOT OLD.created_at
    THEN RAISE(ABORT, 'withdrawal_financial_fields_are_immutable') END;

  SELECT CASE WHEN
    NEW.status <> OLD.status AND NOT (
      (OLD.status = 'pending' AND NEW.status IN ('processing', 'approved', 'rejected')) OR
      (OLD.status = 'processing' AND NEW.status IN ('approved', 'rejected'))
    )
    THEN RAISE(ABORT, 'invalid_withdrawal_status_transition') END;

  SELECT CASE WHEN OLD.status IN ('approved', 'rejected') AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'withdrawal_already_finalized') END;

  SELECT CASE WHEN NEW.status <> OLD.status AND
    (NEW.transitioned_by_user_id IS NULL OR length(trim(NEW.transitioned_by_user_id)) = 0)
    THEN RAISE(ABORT, 'withdrawal_transition_actor_required') END;

  SELECT CASE WHEN NEW.status = 'approved' AND OLD.status <> 'approved' AND (
    NEW.approved_by_user_id IS NULL OR
    NEW.approved_by_user_id <> NEW.transitioned_by_user_id OR
    NOT EXISTS (
      SELECT 1 FROM merchant_wallets
      WHERE store_id = OLD.store_id AND merchant_id = OLD.merchant_id
        AND reserved_minor >= OLD.amount_minor
        AND balance_minor >= OLD.amount_minor
    )
  ) THEN RAISE(ABORT, 'withdrawal_reservation_or_approver_missing') END;

  SELECT CASE WHEN NEW.status = 'rejected' AND OLD.status <> 'rejected' AND (
    NOT EXISTS (
      SELECT 1 FROM merchant_wallets
      WHERE store_id = OLD.store_id AND merchant_id = OLD.merchant_id
        AND reserved_minor >= OLD.amount_minor
    )
  ) THEN RAISE(ABORT, 'withdrawal_reservation_missing') END;

  SELECT CASE WHEN NEW.status = OLD.status AND (
    NEW.approved_by_user_id IS NOT OLD.approved_by_user_id OR
    NEW.transfer_reference IS NOT OLD.transfer_reference OR
    NEW.rejection_reason IS NOT OLD.rejection_reason OR
    NEW.transitioned_by_user_id IS NOT OLD.transitioned_by_user_id OR
    NEW.processed_at IS NOT OLD.processed_at OR
    NEW.updated_at IS NOT OLD.updated_at
  ) THEN RAISE(ABORT, 'withdrawal_metadata_requires_status_transition') END;

  SELECT CASE WHEN NEW.status <> 'approved' AND
    (NEW.approved_by_user_id IS NOT OLD.approved_by_user_id OR
     NEW.transfer_reference IS NOT OLD.transfer_reference)
    THEN RAISE(ABORT, 'approval_metadata_only_on_approval') END;

  SELECT CASE WHEN NEW.status <> 'rejected' AND
    NEW.rejection_reason IS NOT OLD.rejection_reason
    THEN RAISE(ABORT, 'rejection_reason_only_on_rejection') END;
END;

DROP TRIGGER IF EXISTS trg_withdrawal_processing_event;
CREATE TRIGGER trg_withdrawal_processing_event
AFTER UPDATE OF status ON merchant_withdrawal_requests
WHEN NEW.status = 'processing' AND OLD.status <> NEW.status
BEGIN
  INSERT INTO merchant_wallet_events (
    event_id, store_id, merchant_id, request_id, event_type, from_status, to_status,
    actor_user_id, created_at
  ) VALUES (
    'evt-' || NEW.id || '-processing', NEW.store_id, NEW.merchant_id, NEW.id,
    'processing', OLD.status, NEW.status, NEW.transitioned_by_user_id, CURRENT_TIMESTAMP
  );
END;

DROP TRIGGER IF EXISTS trg_withdrawal_approve;
CREATE TRIGGER trg_withdrawal_approve
AFTER UPDATE OF status ON merchant_withdrawal_requests
WHEN NEW.status = 'approved' AND OLD.status <> NEW.status
BEGIN
  UPDATE merchant_wallets
  SET balance_minor = balance_minor - NEW.amount_minor,
      reserved_minor = reserved_minor - NEW.amount_minor,
      updated_at = CURRENT_TIMESTAMP
  WHERE store_id = NEW.store_id
    AND merchant_id = NEW.merchant_id
    AND balance_minor >= NEW.amount_minor
    AND reserved_minor >= NEW.amount_minor;

  INSERT INTO merchant_wallet_ledger (
    id, store_id, merchant_id, request_id, reference_key, entry_type,
    amount_minor, balance_before_minor, balance_after_minor, created_at
  )
  SELECT
    'led-' || NEW.id || '-payout', NEW.store_id, NEW.merchant_id, NEW.id,
    NEW.id || ':payout', 'withdrawal_payout',
    -(NEW.amount_minor - NEW.transfer_fee_minor),
    balance_minor + NEW.amount_minor,
    balance_minor + NEW.transfer_fee_minor,
    CURRENT_TIMESTAMP
  FROM merchant_wallets
  WHERE store_id = NEW.store_id AND merchant_id = NEW.merchant_id;

  INSERT INTO merchant_wallet_ledger (
    id, store_id, merchant_id, request_id, reference_key, entry_type,
    amount_minor, balance_before_minor, balance_after_minor, created_at
  )
  SELECT
    'led-' || NEW.id || '-fee', NEW.store_id, NEW.merchant_id, NEW.id,
    NEW.id || ':fee', 'withdrawal_fee',
    -NEW.transfer_fee_minor,
    balance_minor + NEW.transfer_fee_minor,
    balance_minor,
    CURRENT_TIMESTAMP
  FROM merchant_wallets
  WHERE store_id = NEW.store_id AND merchant_id = NEW.merchant_id;

  INSERT INTO merchant_wallet_events (
    event_id, store_id, merchant_id, request_id, event_type, from_status, to_status,
    actor_user_id, note, created_at
  ) VALUES (
    'evt-' || NEW.id || '-approved', NEW.store_id, NEW.merchant_id, NEW.id,
    'approved', OLD.status, NEW.status, NEW.transitioned_by_user_id,
    NEW.transfer_reference, CURRENT_TIMESTAMP
  );
END;

DROP TRIGGER IF EXISTS trg_withdrawal_reject;
CREATE TRIGGER trg_withdrawal_reject
AFTER UPDATE OF status ON merchant_withdrawal_requests
WHEN NEW.status = 'rejected' AND OLD.status <> NEW.status
BEGIN
  UPDATE merchant_wallets
  SET reserved_minor = reserved_minor - NEW.amount_minor,
      updated_at = CURRENT_TIMESTAMP
  WHERE store_id = NEW.store_id
    AND merchant_id = NEW.merchant_id
    AND reserved_minor >= NEW.amount_minor;

  INSERT INTO merchant_wallet_events (
    event_id, store_id, merchant_id, request_id, event_type, from_status, to_status,
    actor_user_id, note, created_at
  ) VALUES (
    'evt-' || NEW.id || '-rejected', NEW.store_id, NEW.merchant_id, NEW.id,
    'rejected', OLD.status, NEW.status, NEW.transitioned_by_user_id,
    NEW.rejection_reason, CURRENT_TIMESTAMP
  );
END;
