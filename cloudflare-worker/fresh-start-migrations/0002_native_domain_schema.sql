-- Native fresh-start domain schema. Additive only; never imports legacy data.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  public_slug TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS store_settings (
  store_id TEXT PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json)),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sku TEXT,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  price_minor INTEGER NOT NULL DEFAULT 0 CHECK (price_minor >= 0),
  cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (cost_minor >= 0),
  attributes_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_products_store_status ON products(store_id, status, updated_at);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  phone TEXT,
  name TEXT,
  profile_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(profile_json)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_customers_store_updated ON customers(store_id, updated_at);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  totals_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(totals_json)),
  address_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(address_json)),
  idempotency_key TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(store_id, order_number),
  UNIQUE(store_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status, updated_at);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL CHECK (unit_price_minor >= 0),
  unit_cost_minor INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_minor >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(order_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id, order_id);

CREATE TABLE IF NOT EXISTS inventory_balances (
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(store_id, product_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_store_time ON inventory_movements(store_id, created_at);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  order_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  request_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(request_json)),
  idempotency_key TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_maintenance_store_status ON maintenance_requests(store_id, status, updated_at);

CREATE TABLE IF NOT EXISTS shipping_deliveries (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  carrier TEXT NOT NULL,
  external_id TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(delivery_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(carrier, external_id)
);
CREATE INDEX IF NOT EXISTS idx_shipping_store_status ON shipping_deliveries(store_id, status, updated_at);

CREATE TABLE IF NOT EXISTS carrier_webhook_events (
  id TEXT PRIMARY KEY,
  carrier TEXT NOT NULL,
  event_key TEXT NOT NULL,
  store_id TEXT,
  payload_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  signature_verified INTEGER NOT NULL DEFAULT 0 CHECK (signature_verified IN (0,1)),
  processed_at TEXT,
  processing_error TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(carrier, event_key)
);

CREATE TABLE IF NOT EXISTS shared_audits (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(data_json)),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shared_audits_store_status ON shared_audits(store_id, status, updated_at);

CREATE TABLE IF NOT EXISTS shared_audit_events (
  id TEXT PRIMARY KEY,
  audit_id TEXT NOT NULL REFERENCES shared_audits(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(audit_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'general' CHECK (kind IN ('general','direct')),
  participant_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(participant_ids_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  content_text TEXT,
  attachment_key TEXT,
  attachment_content_type TEXT,
  attachment_size INTEGER,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  read_at TEXT,
  client_idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(store_id, client_idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_time ON chat_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS presence (
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  identity_id TEXT NOT NULL REFERENCES auth_identities(id) ON DELETE CASCADE,
  display_name TEXT,
  shift_status TEXT NOT NULL DEFAULT 'active',
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(store_id, identity_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  recipient_identity_id TEXT NOT NULL REFERENCES auth_identities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(payload_json)),
  dedupe_key TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(recipient_identity_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_identity_id, read_at, created_at);

CREATE TABLE IF NOT EXISTS operational_audit_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT,
  actor_id TEXT,
  operation TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  result TEXT NOT NULL,
  request_id TEXT,
  detail_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail_json)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_operational_audit_store_time ON operational_audit_logs(store_id, created_at);

CREATE TABLE IF NOT EXISTS file_metadata (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  owner_id TEXT,
  bucket TEXT NOT NULL,
  object_key TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  checksum TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bucket, object_key)
);
CREATE INDEX IF NOT EXISTS idx_file_metadata_store_entity ON file_metadata(store_id, entity_type, entity_id);

-- Make the new domains visible to the generic read path only after their typed schema exists.
INSERT OR IGNORE INTO app_table_registry(source_system, source_table, primary_key_strategy, migration_status)
VALUES
 ('manual','stores','record_key','verified'),
 ('manual','store_settings','record_key','verified'),
 ('manual','products','record_key','verified'),
 ('manual','customers','record_key','verified'),
 ('manual','orders','record_key','verified'),
 ('manual','order_items','record_key','verified'),
 ('manual','inventory_balances','record_key','verified'),
 ('manual','inventory_movements','record_key','verified'),
 ('manual','maintenance_requests','record_key','verified'),
 ('manual','shipping_deliveries','record_key','verified'),
 ('manual','carrier_webhook_events','record_key','verified'),
 ('manual','shared_audits','record_key','verified'),
 ('manual','shared_audit_events','record_key','verified'),
 ('manual','chat_threads','record_key','verified'),
 ('manual','chat_messages','record_key','verified'),
 ('manual','presence','record_key','verified'),
 ('manual','notifications','record_key','verified'),
 ('manual','operational_audit_logs','record_key','verified'),
 ('manual','file_metadata','record_key','verified');
