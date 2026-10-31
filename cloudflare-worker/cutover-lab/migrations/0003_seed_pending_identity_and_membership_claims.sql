-- Seed reactivation-only identities from the sanitized Supabase public user directory.
-- No password/hash is copied. No role or admin claim is trusted or activated.
-- Existing Firestore-only identities are added only after a current export is imported.

INSERT OR IGNORE INTO auth_identities (
  id,
  legacy_source,
  legacy_user_key,
  email,
  phone,
  display_name,
  account_status,
  password_reset_required,
  legacy_role_claims_json,
  created_at,
  updated_at
)
SELECT
  'legacy-directory-' || lower(hex(randomblob(16))),
  'legacy_directory',
  r.record_key,
  NULLIF(lower(trim(json_extract(r.record_json, '$.email'))), ''),
  COALESCE(
    NULLIF(trim(json_extract(r.record_json, '$.phone')), ''),
    r.record_key
  ),
  COALESCE(
    NULLIF(trim(json_extract(r.record_json, '$.fullName')), ''),
    NULLIF(trim(json_extract(r.record_json, '$.full_name')), ''),
    ''
  ),
  'pending_reactivation',
  1,
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM app_records r
WHERE r.source_system = 'supabase'
  AND r.source_table = 'users'
  AND length(trim(r.record_key)) > 0
ON CONFLICT(legacy_source, legacy_user_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS pending_membership_claims (
  claim_id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  legacy_user_key TEXT NOT NULL,
  legacy_role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'verified', 'rejected', 'linked')),
  claimed_identity_id TEXT,
  verified_by_identity_id TEXT,
  verified_at TEXT,
  resolution_note TEXT,
  source_record_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, legacy_user_key),
  FOREIGN KEY(claimed_identity_id) REFERENCES auth_identities(id),
  FOREIGN KEY(verified_by_identity_id) REFERENCES auth_identities(id)
);

CREATE INDEX IF NOT EXISTS idx_pending_membership_claims_store_status
  ON pending_membership_claims(store_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_membership_claims_legacy_user
  ON pending_membership_claims(legacy_user_key);

INSERT OR IGNORE INTO pending_membership_claims (
  claim_id,
  store_id,
  legacy_user_key,
  legacy_role,
  status,
  source_record_key,
  created_at,
  updated_at
)
SELECT
  'claim-' || lower(hex(randomblob(16))),
  json_extract(r.record_json, '$.store_id'),
  json_extract(r.record_json, '$.user_id'),
  json_extract(r.record_json, '$.role'),
  'pending_verification',
  r.record_key,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM app_records r
WHERE r.source_system = 'supabase'
  AND r.source_table = 'store_memberships'
  AND NULLIF(json_extract(r.record_json, '$.store_id'), '') IS NOT NULL
  AND NULLIF(json_extract(r.record_json, '$.user_id'), '') IS NOT NULL
  AND NULLIF(json_extract(r.record_json, '$.role'), '') IS NOT NULL
ON CONFLICT(store_id, legacy_user_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS pending_store_ownership_claims (
  store_id TEXT PRIMARY KEY,
  source_record_key TEXT NOT NULL,
  store_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'verified', 'rejected', 'linked')),
  claimed_identity_id TEXT,
  verified_by_identity_id TEXT,
  verified_at TEXT,
  resolution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(claimed_identity_id) REFERENCES auth_identities(id),
  FOREIGN KEY(verified_by_identity_id) REFERENCES auth_identities(id)
);

INSERT OR IGNORE INTO pending_store_ownership_claims (
  store_id,
  source_record_key,
  store_name
)
SELECT
  r.record_key,
  r.record_key,
  COALESCE(NULLIF(trim(json_extract(r.record_json, '$.name')), ''), '')
FROM app_records r
WHERE r.source_system = 'supabase'
  AND r.source_table = 'stores_data'
  AND length(trim(r.record_key)) > 0;

INSERT OR IGNORE INTO migration_audit (
  id, source_system, source_table, record_key, action, detail_json
) VALUES
(
  'cutover-seed-pending-identities-20261031',
  'supabase', 'users', NULL, 'copied',
  '{"status":"pending_reactivation","passwords_imported":false,"admin_claims_trusted":false,"identity_reactivation_requires_verified_otp":true}'
),
(
  'cutover-seed-pending-membership-claims-20261031',
  'supabase', 'store_memberships', NULL, 'copied',
  '{"status":"pending_verification","roles_granted":false,"identity_linking_requires_review":true}'
),
(
  'cutover-seed-pending-store-ownership-20261031',
  'supabase', 'stores_data', NULL, 'copied',
  '{"status":"pending_verification","owner_roles_granted":false,"ownership_requires_manual_verification":true}'
);
