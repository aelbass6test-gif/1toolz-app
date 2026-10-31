-- Seed a safe reactivation directory from the already-sanitized Supabase snapshot.
-- No legacy passwords, passcodes, tokens, or secret values are read or copied.

INSERT OR IGNORE INTO auth_identities (
  id, legacy_source, legacy_user_key, email, phone, display_name,
  account_status, password_reset_required, legacy_role_claims_json,
  created_at, updated_at
)
SELECT
  'directory:' || a.record_key,
  'legacy_directory',
  a.record_key,
  NULLIF(trim(json_extract(a.record_json, '$.email')), ''),
  NULLIF(trim(json_extract(a.record_json, '$.phone')), ''),
  COALESCE(
    NULLIF(trim(json_extract(a.record_json, '$.full_name')), ''),
    NULLIF(trim(json_extract(a.record_json, '$.fullName')), ''),
    NULLIF(trim(json_extract(a.record_json, '$.name')), '')
  ),
  'pending_reactivation',
  1,
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM app_records a
WHERE a.source_system = 'supabase'
  AND a.source_table = 'users'
  AND NOT EXISTS (
    SELECT 1 FROM auth_identities i
    WHERE (NULLIF(trim(json_extract(a.record_json, '$.phone')), '') IS NOT NULL
           AND i.phone = NULLIF(trim(json_extract(a.record_json, '$.phone')), ''))
       OR (NULLIF(trim(json_extract(a.record_json, '$.email')), '') IS NOT NULL
           AND lower(i.email) = lower(NULLIF(trim(json_extract(a.record_json, '$.email')), '')))
  );

INSERT OR IGNORE INTO auth_identities (
  id, legacy_source, legacy_user_key, email, phone, display_name,
  account_status, password_reset_required, legacy_role_claims_json,
  created_at, updated_at
)
SELECT
  'employee:' || replace(a.store_id, ':', '_') || ':' || a.record_key,
  'legacy_directory',
  'employee:' || a.store_id || ':' || a.record_key,
  NULLIF(trim(json_extract(a.record_json, '$.email')), ''),
  NULLIF(trim(json_extract(a.record_json, '$.phone')), ''),
  COALESCE(
    NULLIF(trim(json_extract(a.record_json, '$.full_name')), ''),
    NULLIF(trim(json_extract(a.record_json, '$.fullName')), ''),
    NULLIF(trim(json_extract(a.record_json, '$.name')), '')
  ),
  'pending_reactivation',
  1,
  '{}',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM app_records a
WHERE a.source_system = 'supabase'
  AND a.source_table = 'employees'
  AND a.store_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth_identities i
    WHERE (NULLIF(trim(json_extract(a.record_json, '$.phone')), '') IS NOT NULL
           AND i.phone = NULLIF(trim(json_extract(a.record_json, '$.phone')), ''))
       OR (NULLIF(trim(json_extract(a.record_json, '$.email')), '') IS NOT NULL
           AND lower(i.email) = lower(NULLIF(trim(json_extract(a.record_json, '$.email')), '')))
  );

-- Copy existing Auth UUID -> store membership relationships, but keep them
-- pending until the person has reactivated their account and store ownership
-- has been reviewed. Permissions are intentionally empty until re-provisioned.
INSERT OR IGNORE INTO store_memberships (
  store_id, identity_id, role, permissions_json, status,
  source_membership_key, created_at, updated_at
)
SELECT
  json_extract(a.record_json, '$.store_id'),
  i.id,
  CASE lower(json_extract(a.record_json, '$.role'))
    WHEN 'store_owner' THEN 'owner'
    WHEN 'manager' THEN 'manager'
    WHEN 'staff' THEN 'staff'
    ELSE 'viewer'
  END,
  '[]',
  'pending_verification',
  a.record_key,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM app_records a
JOIN auth_identities i
  ON i.legacy_source = 'supabase_auth'
 AND i.legacy_user_key = json_extract(a.record_json, '$.user_id')
WHERE a.source_system = 'supabase'
  AND a.source_table = 'store_memberships'
  AND json_extract(a.record_json, '$.store_id') IS NOT NULL
  AND lower(COALESCE(json_extract(a.record_json, '$.role'), '')) IN
    ('owner', 'store_owner', 'manager', 'staff');

-- Employee links are also pending: no legacy PIN/password is accepted.
INSERT OR IGNORE INTO store_memberships (
  store_id, identity_id, role, permissions_json, status,
  source_membership_key, created_at, updated_at
)
SELECT
  a.store_id,
  i.id,
  'staff',
  '[]',
  'pending_verification',
  a.record_key,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM app_records a
JOIN auth_identities i
  ON (i.phone IS NOT NULL AND i.phone = json_extract(a.record_json, '$.phone'))
  OR (i.email IS NOT NULL AND lower(i.email) = lower(json_extract(a.record_json, '$.email')))
WHERE a.source_system = 'supabase'
  AND a.source_table = 'employees'
  AND a.store_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM store_memberships m
    WHERE m.store_id = a.store_id AND m.identity_id = i.id
  );

INSERT OR IGNORE INTO migration_audit (
  id, source_system, source_table, record_key, action, detail_json, created_at
)
SELECT
  'identity-seed-' || id,
  'supabase',
  CASE legacy_source WHEN 'supabase_auth' THEN 'auth.users' ELSE 'users' END,
  legacy_user_key,
  'sanitized',
  '{"passwordImported":false,"status":"pending_reactivation","roleClaims":"not_granted"}',
  CURRENT_TIMESTAMP
FROM auth_identities
WHERE legacy_source IN ('supabase_auth', 'legacy_directory');
