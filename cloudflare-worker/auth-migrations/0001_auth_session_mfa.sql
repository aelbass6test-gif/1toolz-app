-- Additive only; intentionally not applied by this audit.
ALTER TABLE auth_sessions ADD COLUMN mfa_verified_at TEXT;
CREATE INDEX IF NOT EXISTS idx_auth_sessions_pending_mfa
  ON auth_sessions (identity_id, expires_at)
  WHERE revoked_at IS NULL AND mfa_verified_at IS NULL;
