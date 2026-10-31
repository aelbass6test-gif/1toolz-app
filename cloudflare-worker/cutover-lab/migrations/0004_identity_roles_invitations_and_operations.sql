-- Cloudflare-only identity administration, owner claims, and invitation foundation.

ALTER TABLE auth_identities
  ADD COLUMN identity_origin TEXT NOT NULL DEFAULT 'legacy'
  CHECK (identity_origin IN ('legacy','native'));

CREATE TABLE IF NOT EXISTS platform_roles (
  identity_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  granted_by_identity_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  PRIMARY KEY (identity_id, role),
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id),
  FOREIGN KEY(granted_by_identity_id) REFERENCES auth_identities(id)
);


CREATE TABLE IF NOT EXISTS platform_bootstrap_state (
  singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  completed_by_identity_id TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(completed_by_identity_id) REFERENCES auth_identities(id)
);

CREATE TABLE IF NOT EXISTS store_invitations (
  invitation_id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  intended_email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager','staff','viewer','merchant','partner')),
  permissions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(permissions_json)),
  token_hash TEXT NOT NULL UNIQUE,
  created_by_identity_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  accepted_by_identity_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_identity_id) REFERENCES auth_identities(id),
  FOREIGN KEY(accepted_by_identity_id) REFERENCES auth_identities(id)
);

CREATE INDEX IF NOT EXISTS idx_store_invitations_store
  ON store_invitations(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_invitations_email
  ON store_invitations(intended_email, expires_at);

CREATE TABLE IF NOT EXISTS app_write_audit (
  audit_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_key TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('insert','update','delete','approve','reject','claim','invite')),
  request_id TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id)
);

CREATE INDEX IF NOT EXISTS idx_app_write_audit_store_date
  ON app_write_audit(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS backup_manifest (
  backup_id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  database_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  object_size INTEGER,
  checksum_sha256 TEXT,
  schema_version TEXT NOT NULL,
  record_counts_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(record_counts_json)),
  restore_tested_at TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','verified','restore_tested','failed')),
  failure_note TEXT
);

CREATE TABLE IF NOT EXISTS domain_outbox (
  event_id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_domain_outbox_pending
  ON domain_outbox(delivered_at, created_at);

-- Legacy membership/owner records are not automatically activated.
-- Only verified invitation acceptance or an audited ownership approval creates an active row.
