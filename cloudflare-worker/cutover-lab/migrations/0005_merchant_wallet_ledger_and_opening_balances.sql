-- Install normalized merchant wallet ledger into the Cloudflare core database.
-- This is a D1 migration; do not execute against the independent wallet-lab DB.
-- 1Toolz isolated D1 wallet-ledger laboratory.
-- All amounts are integer piastres (100 piastres = EGP 1).
-- This schema is intentionally separate from the live application database.

CREATE TABLE IF NOT EXISTS merchant_wallets (
  store_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'EGP' CHECK (currency_code = 'EGP'),
  balance_minor INTEGER NOT NULL DEFAULT 0 CHECK (typeof(balance_minor) = 'integer' AND balance_minor >= 0),
  reserved_minor INTEGER NOT NULL DEFAULT 0 CHECK (typeof(reserved_minor) = 'integer' AND reserved_minor >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, merchant_id),
  CHECK (reserved_minor <= balance_minor)
);

CREATE TABLE IF NOT EXISTS merchant_withdrawal_requests (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer' AND amount_minor > 0),
  transfer_fee_minor INTEGER NOT NULL DEFAULT 0
    CHECK (typeof(transfer_fee_minor) = 'integer' AND transfer_fee_minor >= 0 AND transfer_fee_minor < amount_minor),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'approved', 'rejected')),
  idempotency_key TEXT NOT NULL CHECK (length(trim(idempotency_key)) > 0),
  payout_method TEXT NOT NULL CHECK (payout_method IN ('bank', 'instapay', 'wallet')),
  payout_account_ref TEXT,
  requested_by_user_id TEXT NOT NULL,
  approved_by_user_id TEXT,
  transfer_reference TEXT,
  rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE (store_id, merchant_id, idempotency_key),
  FOREIGN KEY (store_id, merchant_id)
    REFERENCES merchant_wallets(store_id, merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_withdrawals_store_status
  ON merchant_withdrawal_requests(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_withdrawals_merchant_status
  ON merchant_withdrawal_requests(store_id, merchant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS merchant_wallet_ledger (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  request_id TEXT,
  reference_key TEXT NOT NULL UNIQUE,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('opening_balance', 'withdrawal_payout', 'withdrawal_fee')),
  amount_minor INTEGER NOT NULL CHECK (typeof(amount_minor) = 'integer'),
  balance_before_minor INTEGER NOT NULL CHECK (typeof(balance_before_minor) = 'integer' AND balance_before_minor >= 0),
  balance_after_minor INTEGER NOT NULL CHECK (typeof(balance_after_minor) = 'integer' AND balance_after_minor >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (balance_after_minor = balance_before_minor + amount_minor),
  UNIQUE (request_id, entry_type),
  FOREIGN KEY (store_id, merchant_id)
    REFERENCES merchant_wallets(store_id, merchant_id),
  FOREIGN KEY (request_id)
    REFERENCES merchant_withdrawal_requests(id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_merchant_date
  ON merchant_wallet_ledger(store_id, merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS merchant_wallet_events (
  event_id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('requested', 'processing', 'approved', 'rejected')),
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_user_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES merchant_withdrawal_requests(id),
  FOREIGN KEY (store_id, merchant_id)
    REFERENCES merchant_wallets(store_id, merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_wallet_events_request_date
  ON merchant_wallet_events(request_id, created_at);

-- Reservations are derived from the persisted request state, not browser memory.
CREATE TRIGGER IF NOT EXISTS trg_withdrawal_validate_insert
BEFORE INSERT ON merchant_withdrawal_requests
BEGIN
  SELECT CASE
    WHEN NEW.status <> 'pending' THEN RAISE(ABORT, 'withdrawal_must_start_pending')
    WHEN NOT EXISTS (
      SELECT 1 FROM merchant_wallets
      WHERE store_id = NEW.store_id AND merchant_id = NEW.merchant_id
    ) THEN RAISE(ABORT, 'merchant_wallet_not_found')
    WHEN NEW.amount_minor >
      (SELECT balance_minor - reserved_minor FROM merchant_wallets
       WHERE store_id = NEW.store_id AND merchant_id = NEW.merchant_id)
      THEN RAISE(ABORT, 'insufficient_available_balance')
  END;
END;

CREATE TRIGGER IF NOT EXISTS trg_withdrawal_reserve_after_insert
AFTER INSERT ON merchant_withdrawal_requests
BEGIN
  UPDATE merchant_wallets
  SET reserved_minor = reserved_minor + NEW.amount_minor,
      updated_at = CURRENT_TIMESTAMP
  WHERE store_id = NEW.store_id AND merchant_id = NEW.merchant_id;

  INSERT INTO merchant_wallet_events (
    event_id, store_id, merchant_id, request_id, event_type, from_status, to_status,
    actor_user_id, created_at
  ) VALUES (
    'evt-' || NEW.id || '-requested', NEW.store_id, NEW.merchant_id, NEW.id,
    'requested', NULL, 'pending', NEW.requested_by_user_id, CURRENT_TIMESTAMP
  );
END;

-- The reserved total must always equal all pending + processing withdrawals.
CREATE TRIGGER IF NOT EXISTS trg_wallet_reserved_matches_requests
BEFORE UPDATE OF reserved_minor ON merchant_wallets
BEGIN
  SELECT CASE WHEN NEW.reserved_minor <> (
    SELECT COALESCE(SUM(amount_minor), 0)
    FROM merchant_withdrawal_requests
    WHERE store_id = NEW.store_id
      AND merchant_id = NEW.merchant_id
      AND status IN ('pending', 'processing')
  ) THEN RAISE(ABORT, 'reserved_balance_mismatch') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_withdrawal_protect_identity
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

  SELECT CASE WHEN
    OLD.status IN ('approved', 'rejected') AND NEW.status <> OLD.status
    THEN RAISE(ABORT, 'withdrawal_already_finalized') END;

  SELECT CASE WHEN
    NEW.status = 'approved' AND OLD.status <> 'approved' AND NOT EXISTS (
      SELECT 1 FROM merchant_wallets
      WHERE store_id = OLD.store_id AND merchant_id = OLD.merchant_id
        AND reserved_minor >= OLD.amount_minor
        AND balance_minor >= OLD.amount_minor
    )
    THEN RAISE(ABORT, 'withdrawal_reservation_missing') END;

  SELECT CASE WHEN
    NEW.status = 'rejected' AND OLD.status <> 'rejected' AND NOT EXISTS (
      SELECT 1 FROM merchant_wallets
      WHERE store_id = OLD.store_id AND merchant_id = OLD.merchant_id
        AND reserved_minor >= OLD.amount_minor
    )
    THEN RAISE(ABORT, 'withdrawal_reservation_missing') END;

  SELECT CASE WHEN
    NEW.status = OLD.status AND (
      NEW.approved_by_user_id IS NOT OLD.approved_by_user_id OR
      NEW.transfer_reference IS NOT OLD.transfer_reference OR
      NEW.rejection_reason IS NOT OLD.rejection_reason OR
      NEW.processed_at IS NOT OLD.processed_at OR
      NEW.updated_at IS NOT OLD.updated_at
    )
    THEN RAISE(ABORT, 'withdrawal_metadata_requires_status_transition') END;

  SELECT CASE WHEN NEW.status <> 'approved' AND NEW.approved_by_user_id IS NOT OLD.approved_by_user_id
    THEN RAISE(ABORT, 'approval_metadata_only_on_approval') END;
  SELECT CASE WHEN NEW.status <> 'approved' AND NEW.transfer_reference IS NOT OLD.transfer_reference
    THEN RAISE(ABORT, 'transfer_reference_only_on_approval') END;
  SELECT CASE WHEN NEW.status <> 'rejected' AND NEW.rejection_reason IS NOT OLD.rejection_reason
    THEN RAISE(ABORT, 'rejection_reason_only_on_rejection') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_withdrawal_processing_event
AFTER UPDATE OF status ON merchant_withdrawal_requests
WHEN NEW.status = 'processing' AND OLD.status <> NEW.status
BEGIN
  INSERT INTO merchant_wallet_events (
    event_id, store_id, merchant_id, request_id, event_type, from_status, to_status,
    actor_user_id, created_at
  ) VALUES (
    'evt-' || NEW.id || '-processing', NEW.store_id, NEW.merchant_id, NEW.id,
    'processing', OLD.status, NEW.status, NEW.approved_by_user_id, CURRENT_TIMESTAMP
  );
END;

-- Approving converts the reservation into one debit and two balanced ledger entries.
CREATE TRIGGER IF NOT EXISTS trg_withdrawal_approve
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
    'approved', OLD.status, NEW.status, NEW.approved_by_user_id,
    NEW.transfer_reference, CURRENT_TIMESTAMP
  );
END;

-- Rejecting releases the hold without changing the wallet balance.
CREATE TRIGGER IF NOT EXISTS trg_withdrawal_reject
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
    'rejected', OLD.status, NEW.status, NEW.approved_by_user_id,
    NEW.rejection_reason, CURRENT_TIMESTAMP
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_withdrawal_no_delete
BEFORE DELETE ON merchant_withdrawal_requests
BEGIN
  SELECT RAISE(ABORT, 'withdrawal_requests_are_audit_records');
END;

CREATE TRIGGER IF NOT EXISTS trg_ledger_no_update
BEFORE UPDATE ON merchant_wallet_ledger
BEGIN
  SELECT RAISE(ABORT, 'wallet_ledger_is_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_ledger_no_delete
BEFORE DELETE ON merchant_wallet_ledger
BEGIN
  SELECT RAISE(ABORT, 'wallet_ledger_is_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_no_update
BEFORE UPDATE ON merchant_wallet_events
BEGIN
  SELECT RAISE(ABORT, 'wallet_events_are_immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_events_no_delete
BEFORE DELETE ON merchant_wallet_events
BEGIN
  SELECT RAISE(ABORT, 'wallet_events_are_immutable');
END;

CREATE VIEW IF NOT EXISTS merchant_wallet_reconciliation AS
SELECT
  w.store_id,
  w.merchant_id,
  w.currency_code,
  w.balance_minor,
  w.reserved_minor,
  w.balance_minor - w.reserved_minor AS available_minor,
  COALESCE((
    SELECT SUM(r.amount_minor)
    FROM merchant_withdrawal_requests r
    WHERE r.store_id = w.store_id AND r.merchant_id = w.merchant_id
      AND r.status IN ('pending', 'processing')
  ), 0) AS requests_reserved_minor,
  COALESCE((
    SELECT SUM(l.amount_minor)
    FROM merchant_wallet_ledger l
    WHERE l.store_id = w.store_id AND l.merchant_id = w.merchant_id
  ), 0) AS ledger_balance_minor
FROM merchant_wallets w;

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



-- Opening wallet balances from the sanitized store settings.
-- Monetary values are converted to integer piastres. Ambiguous identities,
-- negative balances, and non-numeric balance fields are quarantined.
CREATE TABLE IF NOT EXISTS merchant_account_links (
  store_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification','active','revoked')),
  verified_by_identity_id TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, merchant_id, identity_id),
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id),
  FOREIGN KEY(verified_by_identity_id) REFERENCES auth_identities(id)
);
CREATE INDEX IF NOT EXISTS idx_merchant_account_links_identity
  ON merchant_account_links(identity_id, store_id, status);

CREATE TABLE IF NOT EXISTS merchant_wallet_seed_conflicts (
  store_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('duplicate_source_identity','negative_balance','invalid_balance_type')),
  source_occurrences INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, merchant_id, reason)
);

WITH wallet_candidates AS (
  SELECT
    r.record_key AS store_id,
    CAST(json_extract(item.value, '$.id') AS TEXT) AS merchant_id,
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER) AS balance_minor,
    json_type(item.value, '$.balance') AS balance_type
  FROM app_records r, json_each(r.record_json, '$.settings.suppliers') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL

  UNION ALL

  SELECT
    r.record_key AS store_id,
    CAST(json_extract(item.value, '$.id') AS TEXT) AS merchant_id,
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER) AS balance_minor,
    json_type(item.value, '$.balance') AS balance_type
  FROM app_records r, json_each(r.record_json, '$.settings.partners') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
),
wallet_groups AS (
  SELECT
    store_id,
    merchant_id,
    COUNT(*) AS source_occurrences,
    MIN(COALESCE(balance_minor, 0)) AS min_balance_minor,
    SUM(CASE WHEN balance_type NOT IN ('integer','real') AND balance_type IS NOT NULL THEN 1 ELSE 0 END) AS invalid_balance_types
  FROM wallet_candidates
  GROUP BY store_id, merchant_id
)
INSERT OR IGNORE INTO merchant_wallet_seed_conflicts (
  store_id, merchant_id, reason, source_occurrences
)
SELECT store_id, merchant_id, 'duplicate_source_identity', source_occurrences
FROM wallet_groups
WHERE source_occurrences > 1;

WITH wallet_candidates AS (
  SELECT
    r.record_key AS store_id,
    CAST(json_extract(item.value, '$.id') AS TEXT) AS merchant_id,
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER) AS balance_minor,
    json_type(item.value, '$.balance') AS balance_type
  FROM app_records r, json_each(r.record_json, '$.settings.suppliers') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
  UNION ALL
  SELECT
    r.record_key,
    CAST(json_extract(item.value, '$.id') AS TEXT),
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER),
    json_type(item.value, '$.balance')
  FROM app_records r, json_each(r.record_json, '$.settings.partners') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
),
wallet_groups AS (
  SELECT
    store_id,
    merchant_id,
    COUNT(*) AS source_occurrences,
    MIN(COALESCE(balance_minor, 0)) AS min_balance_minor,
    SUM(CASE WHEN balance_type NOT IN ('integer','real') AND balance_type IS NOT NULL THEN 1 ELSE 0 END) AS invalid_balance_types
  FROM wallet_candidates
  GROUP BY store_id, merchant_id
)
INSERT OR IGNORE INTO merchant_wallet_seed_conflicts (
  store_id, merchant_id, reason, source_occurrences
)
SELECT store_id, merchant_id, 'negative_balance', source_occurrences
FROM wallet_groups
WHERE source_occurrences = 1 AND min_balance_minor < 0;

WITH wallet_candidates AS (
  SELECT
    r.record_key AS store_id,
    CAST(json_extract(item.value, '$.id') AS TEXT) AS merchant_id,
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER) AS balance_minor,
    json_type(item.value, '$.balance') AS balance_type
  FROM app_records r, json_each(r.record_json, '$.settings.suppliers') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
  UNION ALL
  SELECT
    r.record_key,
    CAST(json_extract(item.value, '$.id') AS TEXT),
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER),
    json_type(item.value, '$.balance')
  FROM app_records r, json_each(r.record_json, '$.settings.partners') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
),
wallet_groups AS (
  SELECT
    store_id,
    merchant_id,
    COUNT(*) AS source_occurrences,
    SUM(CASE WHEN balance_type NOT IN ('integer','real') AND balance_type IS NOT NULL THEN 1 ELSE 0 END) AS invalid_balance_types
  FROM wallet_candidates
  GROUP BY store_id, merchant_id
)
INSERT OR IGNORE INTO merchant_wallet_seed_conflicts (
  store_id, merchant_id, reason, source_occurrences
)
SELECT store_id, merchant_id, 'invalid_balance_type', source_occurrences
FROM wallet_groups
WHERE source_occurrences = 1 AND invalid_balance_types > 0;

WITH wallet_candidates AS (
  SELECT
    r.record_key AS store_id,
    CAST(json_extract(item.value, '$.id') AS TEXT) AS merchant_id,
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER) AS balance_minor,
    json_type(item.value, '$.balance') AS balance_type
  FROM app_records r, json_each(r.record_json, '$.settings.suppliers') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
  UNION ALL
  SELECT
    r.record_key,
    CAST(json_extract(item.value, '$.id') AS TEXT),
    CAST(ROUND(CAST(json_extract(item.value, '$.balance') AS REAL) * 100) AS INTEGER),
    json_type(item.value, '$.balance')
  FROM app_records r, json_each(r.record_json, '$.settings.partners') item
  WHERE r.source_system = 'supabase' AND r.source_table = 'stores_data'
    AND NULLIF(CAST(json_extract(item.value, '$.id') AS TEXT), '') IS NOT NULL
),
valid_wallets AS (
  SELECT
    c.store_id,
    c.merchant_id,
    MAX(0, COALESCE(c.balance_minor, 0)) AS balance_minor
  FROM wallet_candidates c
  JOIN (
    SELECT store_id, merchant_id
    FROM wallet_candidates
    GROUP BY store_id, merchant_id
    HAVING COUNT(*) = 1
       AND MIN(COALESCE(balance_minor, 0)) >= 0
       AND SUM(CASE WHEN balance_type NOT IN ('integer','real') AND balance_type IS NOT NULL THEN 1 ELSE 0 END) = 0
  ) ok USING (store_id, merchant_id)
)
INSERT OR IGNORE INTO merchant_wallets (
  store_id, merchant_id, currency_code, balance_minor, reserved_minor
)
SELECT store_id, merchant_id, 'EGP', balance_minor, 0
FROM valid_wallets;

INSERT OR IGNORE INTO merchant_wallet_ledger (
  id, store_id, merchant_id, request_id, reference_key, entry_type,
  amount_minor, balance_before_minor, balance_after_minor, created_at
)
SELECT
  'opening-' || lower(hex(randomblob(16))),
  w.store_id,
  w.merchant_id,
  NULL,
  'opening:' || w.store_id || ':' || w.merchant_id,
  'opening_balance',
  w.balance_minor,
  0,
  w.balance_minor,
  CURRENT_TIMESTAMP
FROM merchant_wallets w
WHERE w.balance_minor > 0
  AND NOT EXISTS (
    SELECT 1 FROM merchant_wallet_ledger l
    WHERE l.store_id = w.store_id AND l.merchant_id = w.merchant_id
  );

INSERT OR IGNORE INTO migration_audit (
  id, source_system, source_table, record_key, action, detail_json
)
SELECT
  'wallet-opening-seed-' || lower(hex(randomblob(16))),
  'supabase',
  'stores_data',
  NULL,
  'copied',
  json_object(
    'wallet_count', COUNT(*),
    'amount_unit', 'piastres',
    'opening_ledger', 'created',
    'source', 'settings.suppliers+settings.partners'
  )
FROM merchant_wallets;

INSERT OR IGNORE INTO migration_audit (
  id, source_system, source_table, record_key, action, detail_json
)
SELECT
  'wallet-seed-conflicts-' || lower(hex(randomblob(16))),
  'supabase',
  'stores_data',
  NULL,
  'conflict',
  json_object(
    'conflict_count', COUNT(*),
    'action', 'excluded_from_wallet_import_pending_manual_review'
  )
FROM merchant_wallet_seed_conflicts
HAVING COUNT(*) > 0;
