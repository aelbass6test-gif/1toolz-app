-- Cloudflare-only cutover: sanitize credential-bearing fields in the D1 landing copy.
-- Apply only to the isolated cutover lab after reviewing this migration.
-- This changes ONLY copied app_records JSON. It does not delete source records.
-- Do not expose the sanitized landing data to the app until target checksums are recomputed.

PRAGMA foreign_keys = ON;

-- Partner passwords / PIN values are not imported into the Cloudflare auth system.
UPDATE app_records
SET record_json = json_remove(record_json, '$.password', '$.passcode'),
    record_sha256 = 'REHASH_REQUIRED'
WHERE source_system = 'supabase'
  AND source_table = 'partners'
  AND (
    json_type(record_json, '$.password') IS NOT NULL OR
    json_type(record_json, '$.passcode') IS NOT NULL
  );

-- Provider credentials must be re-provisioned as Cloudflare Worker secrets.
UPDATE app_records
SET record_json = json_remove(
      record_json,
      '$."api_key"',
      '$."api_secret"',
      '$.apiKey',
      '$.apiSecret'
    ),
    record_sha256 = 'REHASH_REQUIRED'
WHERE source_system = 'supabase'
  AND source_table = 'shipping_integrations'
  AND (
    json_type(record_json, '$."api_key"') IS NOT NULL OR
    json_type(record_json, '$."api_secret"') IS NOT NULL OR
    json_type(record_json, '$.apiKey') IS NOT NULL OR
    json_type(record_json, '$.apiSecret') IS NOT NULL
  );

-- Remove embedded integration/account credentials from copied store settings.
-- publicApiKey is intentionally not stripped here; classify it separately before use.
UPDATE app_records
SET record_json = json_remove(
      record_json,
      '$.settings.adminAlerts.telegramBotToken',
      '$.settings.integration.apiKey',
      '$.settings.moneyHashConfig.apiKey',
      '$.settings.moneyHashConfig.webhookSecret',
      '$.settings.partners[0].passcode',
      '$.settings.partners[0].password',
      '$.settings.partners[1].passcode',
      '$.settings.partners[1].password',
      '$.settings.partners[2].passcode',
      '$.settings.partners[2].password',
      '$.settings.partners[3].passcode',
      '$.settings.partners[3].password',
      '$.settings.suppliers[0].passcode',
      '$.settings.whatsappConfig.token'
    ),
    record_sha256 = 'REHASH_REQUIRED'
WHERE source_system = 'supabase'
  AND source_table = 'stores_data';

-- The original source checksum is retained for audit. The target hash is cleared
-- because sanitized target bytes must be re-hashed by the Worker using Web Crypto.
UPDATE app_table_registry
SET target_checksum = NULL,
    migration_status = 'blocked',
    last_error = 'Credential sanitization applied/required; recompute canonical target checksum and verify secret reprovision before release',
    updated_at = CURRENT_TIMESTAMP
WHERE source_system = 'supabase'
  AND source_table IN ('partners', 'shipping_integrations', 'stores_data');

-- The legacy public directory has 13 records in app_records but was missing from
-- the table registry. Keep it blocked until identity reactivation and checksums pass.
INSERT INTO app_table_registry (
  source_system, source_table, primary_key_strategy, migration_status,
  source_rows, copied_rows, sanitized_rows, source_checksum, target_checksum,
  last_error, updated_at
)
SELECT
  'supabase', 'users', 'phone', 'blocked',
  COUNT(*), COUNT(*), COUNT(*), NULL, NULL,
  'Legacy directory records are present but are not an authentication authority; reactivation, role reconciliation, and checksums are required',
  CURRENT_TIMESTAMP
FROM app_records
WHERE source_system = 'supabase' AND source_table = 'users'
HAVING COUNT(*) > 0;

-- Firebase/Firestore export is not present in the current landing copy.
INSERT OR IGNORE INTO app_table_registry (
  source_system, source_table, primary_key_strategy, migration_status,
  source_rows, copied_rows, sanitized_rows, last_error, updated_at
) VALUES
  ('firebase','stores_data','document_path','blocked',NULL,0,0,'Awaiting a current full Firestore export; the repository backup is historical and not accepted as final source',CURRENT_TIMESTAMP),
  ('firebase','orders','document_path','blocked',NULL,0,0,'Awaiting a current full Firestore export and domain reconciliation',CURRENT_TIMESTAMP),
  ('firebase','products','document_path','blocked',NULL,0,0,'Awaiting a current full Firestore export and domain reconciliation',CURRENT_TIMESTAMP),
  ('firebase','customers','document_path','blocked',NULL,0,0,'Awaiting a current full Firestore export and domain reconciliation',CURRENT_TIMESTAMP),
  ('firebase','employees','document_path','blocked',NULL,0,0,'Awaiting verified identity and store membership mapping',CURRENT_TIMESTAMP),
  ('firebase','transactions','document_path','blocked',NULL,0,0,'Awaiting finance export and ledger reconciliation',CURRENT_TIMESTAMP),
  ('firebase','treasury_accounts','document_path','blocked',NULL,0,0,'Awaiting finance export and balance reconciliation',CURRENT_TIMESTAMP),
  ('firebase','treasury_transactions','document_path','blocked',NULL,0,0,'Awaiting finance export and ledger reconciliation',CURRENT_TIMESTAMP),
  ('firebase','partners','document_path','blocked',NULL,0,0,'Awaiting partner identity and secret sanitization review',CURRENT_TIMESTAMP),
  ('firebase','partner_transactions','document_path','blocked',NULL,0,0,'Awaiting financial transaction reconciliation',CURRENT_TIMESTAMP),
  ('firebase','merchant_requests','document_path','blocked',NULL,0,0,'Awaiting withdrawal request state and reservation reconciliation',CURRENT_TIMESTAMP),
  ('firebase','partner_requests','document_path','blocked',NULL,0,0,'Awaiting request state reconciliation',CURRENT_TIMESTAMP),
  ('firebase','chat_messages','document_path','blocked',NULL,0,0,'Awaiting current Firestore export and participant authorization mapping',CURRENT_TIMESTAMP),
  ('firebase','shared_audits','document_path','blocked',NULL,0,0,'Awaiting current Firestore export and access-control review',CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO migration_audit (
  id, source_system, source_table, record_key, action, detail_json
) VALUES
  ('cutover-sanitize-partners-20261031','supabase','partners',NULL,'sanitized',
   '{"fields_removed":["password","passcode"],"values_read":false,"target_checksum":"recompute"}'),
  ('cutover-sanitize-shipping-integrations-20261031','supabase','shipping_integrations',NULL,'sanitized',
   '{"fields_removed":["api_key","api_secret","apiKey","apiSecret"],"values_read":false,"reprovision":"Worker secrets"}'),
  ('cutover-sanitize-store-settings-20261031','supabase','stores_data',NULL,'sanitized',
   '{"credential_paths_removed":["integration.apiKey","moneyHashConfig.apiKey","moneyHashConfig.webhookSecret","adminAlerts.telegramBotToken","whatsappConfig.token","legacy partner/supplier passwords and passcodes"],"values_read":false}'),
  ('cutover-register-legacy-users-20261031','supabase','users',NULL,'skipped',
   '{"reason":"directory records are not an authentication authority; reactivation and membership reconciliation required"}'),
  ('cutover-firestore-export-required-20261031','firebase','firestore_collections',NULL,'skipped',
   '{"reason":"current full Firestore export not present in D1 landing copy; stale repository backup is not sufficient"}');
