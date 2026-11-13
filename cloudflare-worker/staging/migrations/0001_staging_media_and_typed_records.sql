CREATE TABLE IF NOT EXISTS staging_media (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staging_media_created_at
  ON staging_media(created_at);

CREATE TABLE IF NOT EXISTS typed_records (
  record_type TEXT NOT NULL,
  id TEXT NOT NULL,
  json_value TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (record_type, id)
);
