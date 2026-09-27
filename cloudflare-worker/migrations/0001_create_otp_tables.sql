CREATE TABLE IF NOT EXISTS otp_challenges (
  identifier TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  verified_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_created_at
  ON otp_challenges(created_at);

CREATE TABLE IF NOT EXISTS otp_send_limits (
  ip_hash TEXT PRIMARY KEY,
  window_started INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_otp_send_limits_window_started
  ON otp_send_limits(window_started);

CREATE TABLE IF NOT EXISTS otp_provider_state (
  provider TEXT PRIMARY KEY,
  disabled_until INTEGER NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_provider_usage (
  provider TEXT NOT NULL,
  day_utc TEXT NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider, day_utc)
);
