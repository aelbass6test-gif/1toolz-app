CREATE TABLE IF NOT EXISTS store_notifications (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  is_read INTEGER NOT NULL DEFAULT 0,
  link TEXT,
  amount REAL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_store_notifications_store
  ON store_notifications(store_id, created_at DESC);

CREATE TABLE IF NOT EXISTS biometric_credentials (
  entity_key TEXT NOT NULL,
  id TEXT NOT NULL,
  raw_id TEXT NOT NULL,
  name TEXT NOT NULL,
  public_key TEXT,
  algorithm TEXT,
  transports_json TEXT NOT NULL DEFAULT '[]',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  data_json TEXT NOT NULL,
  PRIMARY KEY (entity_key, id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_entity
  ON biometric_credentials(entity_key);
