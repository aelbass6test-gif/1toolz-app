import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

const migrationDirectory = resolve(process.cwd(), "cloudflare-worker/d1-core-migrations");
const migrations = readdirSync(migrationDirectory)
  .filter(name => /^\d+_.*\.sql$/.test(name))
  .sort();

function applyMigrations(database: DatabaseSync): void {
  for (const migration of migrations) {
    database.exec(readFileSync(resolve(migrationDirectory, migration), "utf8"));
  }
}

test("core D1 migrations create a repeatable clean schema", () => {
  assert.deepEqual(migrations, [
    "0000_core_schema.sql",
    "0001_whatsapp_webhook_events.sql",
    "0002_seed_legacy_identities_pending.sql"
  ]);

  const database = new DatabaseSync(":memory:");
  database.exec("PRAGMA foreign_keys = ON;");

  applyMigrations(database);
  // A second application must be a no-op. This catches missing IF NOT EXISTS
  // guards and migration ordering assumptions before a staging deployment.
  applyMigrations(database);

  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  assert.deepEqual(tables.map(row => row.name), [
    "app_records",
    "app_settings",
    "app_table_registry",
    "auth_credentials",
    "auth_identities",
    "auth_recovery_tokens",
    "auth_sessions",
    "domain_idempotency",
    "integration_secret_inventory",
    "migration_audit",
    "store_memberships",
    "whatsapp_webhook_events"
  ]);

  const indexes = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as Array<{ name: string }>;
  assert.deepEqual(indexes.map(row => row.name), [
    "idx_app_records_table_key",
    "idx_app_records_tenant_table",
    "idx_auth_identities_email",
    "idx_auth_identities_phone",
    "idx_auth_sessions_identity",
    "idx_migration_audit_table",
    "idx_store_memberships_identity",
    "idx_whatsapp_webhook_events_received"
  ]);

  const foreignKeys = database
    .prepare("PRAGMA foreign_key_list('store_memberships')")
    .all() as Array<{ table: string; from: string; to: string }>;
  assert.deepEqual(
    foreignKeys.map(({ table, from, to }) => ({ table, from, to })),
    [{ table: "auth_identities", from: "identity_id", to: "id" }]
  );

  const seededIdentityCount = database
    .prepare("SELECT COUNT(*) AS count FROM auth_identities")
    .get() as { count: number };
  assert.equal(Number(seededIdentityCount.count), 0);
});
