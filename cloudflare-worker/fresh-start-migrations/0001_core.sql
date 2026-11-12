-- 1Toolz clean fresh-start Cloudflare core schema.
-- No historical Firebase/Supabase data is imported by this migration.
-- Generic records preserve the existing UI contract while domain APIs are completed.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_table_registry (
  source_system TEXT NOT NULL CHECK (source_system IN ('manual', 'supabase', 'firebase')),
  source_table TEXT NOT NULL,
  primary_key_strategy TEXT NOT NULL,
  migration_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (migration_status IN ('pending', 'exporting', 'copied', 'verified', 'blocked')),
  source_rows INTEGER,
  copied_rows INTEGER NOT NULL DEFAULT 0,
  sanitized_rows INTEGER NOT NULL DEFAULT 0,
  source_checksum TEXT,
  target_checksum TEXT,
  last_cursor TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_system, source_table)
);

CREATE TABLE IF NOT EXISTS app_records (
  source_system TEXT NOT NULL CHECK (source_system IN ('supabase', 'firebase', 'manual')),
  source_table TEXT NOT NULL,
  record_key TEXT NOT NULL,
  store_id TEXT,
  record_json TEXT NOT NULL CHECK (json_valid(record_json)),
  record_sha256 TEXT NOT NULL,
  source_updated_at TEXT,
  migrated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_system, source_table, record_key)
);
CREATE INDEX IF NOT EXISTS idx_app_records_tenant_table ON app_records(store_id, source_table, migrated_at);
CREATE INDEX IF NOT EXISTS idx_app_records_table_key ON app_records(source_table, record_key);

CREATE TABLE IF NOT EXISTS auth_identities (
  id TEXT PRIMARY KEY,
  legacy_source TEXT NOT NULL CHECK (legacy_source IN ('manual', 'supabase_auth', 'firebase_auth', 'legacy_directory')),
  legacy_user_key TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  display_name TEXT,
  account_status TEXT NOT NULL DEFAULT 'pending_reactivation'
    CHECK (account_status IN ('pending_reactivation', 'active', 'disabled', 'banned')),
  password_reset_required INTEGER NOT NULL DEFAULT 1 CHECK (password_reset_required IN (0,1)),
  legacy_role_claims_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(legacy_role_claims_json)),
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  identity_origin TEXT NOT NULL DEFAULT 'native' CHECK (identity_origin IN ('native','legacy')),
  UNIQUE (legacy_source, legacy_user_key)
);
CREATE INDEX IF NOT EXISTS idx_auth_identities_email ON auth_identities(email);
CREATE INDEX IF NOT EXISTS idx_auth_identities_phone ON auth_identities(phone);

CREATE TABLE IF NOT EXISTS auth_credentials (
  identity_id TEXT PRIMARY KEY,
  password_hash TEXT,
  password_algorithm TEXT,
  password_changed_at TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0,1)),
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT,
  user_agent_hash TEXT,
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_identity ON auth_sessions(identity_id, expires_at);

CREATE TABLE IF NOT EXISTS auth_recovery_tokens (
  token_hash TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS store_memberships (
  store_id TEXT NOT NULL,
  identity_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'viewer', 'partner', 'merchant')),
  permissions_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(permissions_json)),
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'active', 'revoked')),
  source_membership_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, identity_id),
  FOREIGN KEY(identity_id) REFERENCES auth_identities(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_store_memberships_identity ON store_memberships(identity_id, status);

CREATE TABLE IF NOT EXISTS integration_secret_inventory (
  id TEXT PRIMARY KEY,
  store_id TEXT,
  integration_name TEXT NOT NULL,
  secret_path TEXT NOT NULL,
  ciphertext TEXT,
  key_version TEXT,
  migration_status TEXT NOT NULL DEFAULT 'requires_secure_reprovision'
    CHECK (migration_status IN ('requires_secure_reprovision', 'encrypted_and_verified', 'disabled')),
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, integration_name, secret_path)
);

CREATE TABLE IF NOT EXISTS domain_idempotency (
  scope_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  PRIMARY KEY(scope_key, idempotency_key)
);

CREATE TABLE IF NOT EXISTS migration_audit (
  id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_table TEXT NOT NULL,
  record_key TEXT,
  action TEXT NOT NULL CHECK (action IN ('copied', 'sanitized', 'skipped', 'conflict', 'verified', 'error')),
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_migration_audit_table ON migration_audit(source_system, source_table, action);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_json TEXT NOT NULL CHECK (json_valid(setting_json)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Native/manual registry only: this does not import, copy, or reconcile old data.
INSERT OR IGNORE INTO app_table_registry
  (source_system, source_table, primary_key_strategy, migration_status, copied_rows, sanitized_rows)
VALUES
  ('manual','users','record_key','verified',0,0),
  ('manual','stores_data','record_key','verified',0,0),
  ('manual','products','record_key','verified',0,0),
  ('manual','orders','record_key','verified',0,0),
  ('manual','order_items','record_key','verified',0,0),
  ('manual','customers','record_key','verified',0,0),
  ('manual','employees','record_key','verified',0,0),
  ('manual','suppliers','record_key','verified',0,0),
  ('manual','warehouses','record_key','verified',0,0),
  ('manual','inventory_audits','record_key','verified',0,0),
  ('manual','stock_transfers','record_key','verified',0,0),
  ('manual','transactions','record_key','verified',0,0),
  ('manual','treasury_accounts','record_key','verified',0,0),
  ('manual','treasury_transactions','record_key','verified',0,0),
  ('manual','cash_holders','record_key','verified',0,0),
  ('manual','cash_handovers','record_key','verified',0,0),
  ('manual','pos_sales','record_key','verified',0,0),
  ('manual','subscriptions','record_key','verified',0,0),
  ('manual','commissions','record_key','verified',0,0),
  ('manual','deposits','record_key','verified',0,0),
  ('manual','withdrawal_requests','record_key','verified',0,0),
  ('manual','merchant_requests','record_key','verified',0,0),
  ('manual','partner_requests','record_key','verified',0,0),
  ('manual','partners','record_key','verified',0,0),
  ('manual','partner_transactions','record_key','verified',0,0),
  ('manual','customer_transactions','record_key','verified',0,0),
  ('manual','supplier_transactions','record_key','verified',0,0),
  ('manual','quotations','record_key','verified',0,0),
  ('manual','discount_codes','record_key','verified',0,0),
  ('manual','collections','record_key','verified',0,0),
  ('manual','custom_pages','record_key','verified',0,0),
  ('manual','payment_methods','record_key','verified',0,0),
  ('manual','settings','record_key','verified',0,0),
  ('manual','global_options','record_key','verified',0,0),
  ('manual','shipping_integrations','record_key','verified',0,0),
  ('manual','shipping_deliveries','record_key','verified',0,0),
  ('manual','notifications','record_key','verified',0,0),
  ('manual','activity_logs','record_key','verified',0,0),
  ('manual','documents','record_key','verified',0,0),
  ('manual','chat_messages','record_key','verified',0,0),
  ('manual','whatsapp_conversations','record_key','verified',0,0),
  ('manual','whatsapp_messages','record_key','verified',0,0),
  ('manual','webhook_logs','record_key','verified',0,0),
  ('manual','maintenance_requests','record_key','verified',0,0),
  ('manual','public_storefronts','record_key','verified',0,0),
  ('manual','presence','record_key','verified',0,0),
  ('manual','user_profiles','record_key','verified',0,0);

CREATE INDEX IF NOT EXISTS idx_app_table_registry_status
  ON app_table_registry(source_system, migration_status, source_table);
