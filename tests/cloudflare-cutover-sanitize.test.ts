import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

const migrations = [
  "cloudflare-worker/cutover-lab/migrations/0001_cloudflare_core.sql",
  "cloudflare-worker/cutover-lab/migrations/0002_sanitize_credentials_and_register_missing_sources.sql",
  "cloudflare-worker/cutover-lab/migrations/0003_seed_pending_identity_and_membership_claims.sql",
  "cloudflare-worker/cutover-lab/migrations/0004_identity_roles_invitations_and_operations.sql"
];

function loadSql(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(loadSql(migrations[0]));

  const insert = db.prepare(`
    INSERT INTO app_records (
      source_system, source_table, record_key, store_id,
      record_json, record_sha256, source_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);

  insert.run(
    "supabase", "partners", "partner-01", "store-01",
    JSON.stringify({ id: "partner-01", name: "Synthetic Partner", password: "legacy-password-placeholder", passcode: "1234" }),
    "source-hash-partner"
  );
  insert.run(
    "supabase", "shipping_integrations", "shipping-01", "store-01",
    JSON.stringify({ id: "shipping-01", api_key: "provider-key-placeholder", api_secret: "provider-secret-placeholder", apiKey: "provider-key-2", apiSecret: "provider-secret-2" }),
    "source-hash-shipping"
  );
  insert.run(
    "supabase", "stores_data", "store-01", null,
    JSON.stringify({
      id: "store-01",
      name: "Synthetic Store",
      settings: {
        integration: { apiKey: "integration-secret-placeholder" },
        moneyHashConfig: { apiKey: "payment-secret-placeholder", publicApiKey: "public-key-remains-classified" , webhookSecret: "webhook-secret-placeholder" },
        adminAlerts: { telegramBotToken: "telegram-secret-placeholder" },
        whatsappConfig: { token: "whatsapp-secret-placeholder" },
        partners: [{ id: "partner-01", password: "embedded-password", passcode: "embedded-pin" }],
        suppliers: [{ id: "supplier-01", passcode: "supplier-pin" }]
      }
    }),
    "source-hash-store"
  );
  insert.run(
    "supabase", "users", "+201000000001", null,
    JSON.stringify({ phone: "+201000000001", email: "owner@example.test", fullName: "Synthetic Owner", isAdmin: true }),
    "source-hash-user-1"
  );
  insert.run(
    "supabase", "users", "+201000000002", null,
    JSON.stringify({ phone: "+201000000002", email: "+201000000002@mystore-auth.app", full_name: "Synthetic Employee", is_admin: true }),
    "source-hash-user-2"
  );
  insert.run(
    "supabase", "store_memberships", "membership-01", "store-01",
    JSON.stringify({ store_id: "store-01", user_id: "legacy-auth-uuid-01", role: "owner" }),
    "source-hash-membership"
  );

  const reg = db.prepare(`
    INSERT INTO app_table_registry (
      source_system, source_table, primary_key_strategy, migration_status,
      source_rows, copied_rows, source_checksum, target_checksum
    ) VALUES ('supabase', ?, 'id', 'copied', 1, 1, 'source-checksum', 'target-checksum')
  `);
  reg.run("partners");
  reg.run("shipping_integrations");
  reg.run("stores_data");

  return db;
}

test("sanitization removes secret-bearing JSON fields while preserving public storefront keys", () => {
  const db = fixture();
  db.exec(loadSql(migrations[1]));

  const partner = db.prepare(
    "SELECT record_json, record_sha256 FROM app_records WHERE source_table='partners'"
  ).get() as { record_json: string; record_sha256: string };
  const partnerJson = JSON.parse(partner.record_json);
  assert.equal("password" in partnerJson, false);
  assert.equal("passcode" in partnerJson, false);
  assert.equal(partner.record_sha256, "REHASH_REQUIRED");

  const shipping = db.prepare(
    "SELECT record_json FROM app_records WHERE source_table='shipping_integrations'"
  ).get() as { record_json: string };
  const shippingJson = JSON.parse(shipping.record_json);
  for (const key of ["api_key", "api_secret", "apiKey", "apiSecret"]) {
    assert.equal(key in shippingJson, false);
  }

  const store = db.prepare(
    "SELECT record_json FROM app_records WHERE source_table='stores_data'"
  ).get() as { record_json: string };
  const storeJson = JSON.parse(store.record_json);
  assert.equal(storeJson.settings.integration.apiKey, undefined);
  assert.equal(storeJson.settings.moneyHashConfig.apiKey, undefined);
  assert.equal(storeJson.settings.moneyHashConfig.webhookSecret, undefined);
  assert.equal(storeJson.settings.adminAlerts.telegramBotToken, undefined);
  assert.equal(storeJson.settings.whatsappConfig.token, undefined);
  assert.equal(storeJson.settings.partners[0].password, undefined);
  assert.equal(storeJson.settings.partners[0].passcode, undefined);
  assert.equal(storeJson.settings.suppliers[0].passcode, undefined);
  assert.equal(storeJson.settings.moneyHashConfig.publicApiKey, "public-key-remains-classified");

  const blocked = db.prepare(
    "SELECT COUNT(*) AS n FROM app_table_registry WHERE source_system='supabase' AND source_table IN ('partners','shipping_integrations','stores_data') AND migration_status='blocked' AND target_checksum IS NULL"
  ).get() as { n: number };
  assert.equal(blocked.n, 3);

  const auditInvalid = db.prepare(
    "SELECT COUNT(*) AS n FROM migration_audit WHERE action NOT IN ('copied','sanitized','skipped','conflict','verified','error')"
  ).get() as { n: number };
  assert.equal(auditInvalid.n, 0);

  db.close();
});

test("identity seeding never imports legacy passwords or trusts administrator claims", () => {
  const db = fixture();
  db.exec(loadSql(migrations[1]));
  db.exec(loadSql(migrations[2]));
  db.exec(loadSql(migrations[3]));

  const identities = db.prepare(
    "SELECT legacy_user_key, email, phone, display_name, account_status, password_reset_required, legacy_role_claims_json FROM auth_identities ORDER BY legacy_user_key"
  ).all() as Array<Record<string, unknown>>;
  assert.equal(identities.length, 2);
  assert.equal(identities[0].account_status, "pending_reactivation");
  assert.equal(identities[1].account_status, "pending_reactivation");
  assert.equal(identities[0].password_reset_required, 1);
  assert.equal(identities[1].password_reset_required, 1);
  assert.equal(identities[0].legacy_role_claims_json, "{}");
  assert.equal(identities[1].legacy_role_claims_json, "{}");
  assert.equal(identities.some(row => row.email === "+201000000002@mystore-auth.app"), false);

  const credentialCount = db.prepare("SELECT COUNT(*) AS n FROM auth_credentials").get() as { n: number };
  assert.equal(credentialCount.n, 0);

  const membershipClaims = db.prepare(
    "SELECT store_id, legacy_user_key, legacy_role, status FROM pending_membership_claims"
  ).all() as Array<Record<string, unknown>>;
  assert.equal(membershipClaims.length, 1);
  assert.equal(membershipClaims[0].status, "pending_verification");
  assert.equal(membershipClaims[0].legacy_role, "owner");

  const activeMemberships = db.prepare(
    "SELECT COUNT(*) AS n FROM store_memberships WHERE status='active'"
  ).get() as { n: number };
  assert.equal(activeMemberships.n, 0);

  const storeClaims = db.prepare(
    "SELECT store_id,status FROM pending_store_ownership_claims"
  ).all() as Array<Record<string, unknown>>;
  assert.equal(storeClaims.length, 1);
  assert.equal(storeClaims[0].status, "pending_verification");

  const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type = ?").all("table") as Array<{ name: string }>;
  const names = new Set(tableNames.map(row => row.name));
  for (const requiredTable of ["platform_roles", "platform_bootstrap_state", "store_invitations", "app_write_audit", "backup_manifest", "domain_outbox"]) {
    assert.equal(names.has(requiredTable), true, `missing table: ${requiredTable}`);
  }

  const usersRegistry = db.prepare(
    "SELECT source_rows,copied_rows,migration_status FROM app_table_registry WHERE source_system='supabase' AND source_table='users'"
  ).get() as { source_rows: number; copied_rows: number; migration_status: string };
  assert.equal(usersRegistry.source_rows, 2);
  assert.equal(usersRegistry.copied_rows, 2);
  assert.equal(usersRegistry.migration_status, "blocked");

  const firestoreRegistry = db.prepare(
    "SELECT COUNT(*) AS n FROM app_table_registry WHERE source_system='firebase' AND migration_status='blocked'"
  ).get() as { n: number };
  assert.equal(firestoreRegistry.n, 14);

  db.close();
});
