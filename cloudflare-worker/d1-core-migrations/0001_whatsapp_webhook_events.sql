CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  event_id TEXT PRIMARY KEY,
  object_name TEXT NOT NULL DEFAULT 'unknown',
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  signature_verified INTEGER NOT NULL DEFAULT 0 CHECK (signature_verified IN (0,1)),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  processing_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_events_received
  ON whatsapp_webhook_events(received_at DESC, processed_at);
