import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

const auth = await readFile("cloudflare-worker/src/auth.ts", "utf8");
const index = await readFile("cloudflare-worker/src/index.ts", "utf8");
const migration = await readFile("cloudflare-worker/auth-migrations/0001_auth_session_mfa.sql", "utf8");

assert.match(auth, /isSixDigitOtp/);
assert.match(auth, /phoneFromSyntheticLogin/);
assert.match(auth, /send-login-otp/);
assert.match(auth, /verify-login-otp/);
assert.match(auth, /s\.mfa_verified_at IS NOT NULL/);
assert.match(migration, /ALTER TABLE auth_sessions ADD COLUMN mfa_verified_at TEXT/);
assert.match(migration, /idx_auth_sessions_pending_mfa/);
assert.match(index, /TURBO_STAGING_BASE_URL/);
assert.doesNotMatch(index, /TURBO_STAGING_BASE_URL \|\| env\.TURBO_BASE_URL/);

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE auth_sessions (
    session_id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT
  );
`);
db.exec(migration);
const columns = db.prepare("PRAGMA table_info(auth_sessions)").all() as Array<{ name: string }>;
assert.ok(columns.some(column => column.name === "mfa_verified_at"));
db.prepare("INSERT INTO auth_sessions (session_id, identity_id, expires_at, revoked_at, mfa_verified_at) VALUES (?, ?, ?, NULL, NULL)")
  .run("s1", "i1", "2099-01-01T00:00:00Z");
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM auth_sessions WHERE mfa_verified_at IS NULL").get().count, 1);
db.close();

console.log("auth validation passed: OTP shape, synthetic-login boundary, MFA gate, local migration, and staging Turbo guard");
