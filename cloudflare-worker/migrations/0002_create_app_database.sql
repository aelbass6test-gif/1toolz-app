-- Cloudflare D1 Application Schema (Full Replacement for Firestore & Supabase)

CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  email TEXT,
  password_hash TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  is_admin INTEGER NOT NULL DEFAULT 0,
  is_banned INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0,
  stores_json TEXT NOT NULL DEFAULT '[]',
  sites_json TEXT NOT NULL DEFAULT '[]',
  owned_store_ids_json TEXT NOT NULL DEFAULT '[]',
  default_store_id TEXT,
  auto_launch_default_store INTEGER NOT NULL DEFAULT 0,
  join_date TEXT,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_phone TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'owner',
  store_id TEXT,
  role TEXT,
  email TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_phone ON sessions(user_phone);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_action_tokens (
  token TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS stores_data (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  subdomain TEXT,
  custom_domain TEXT,
  custom_app_domain TEXT,
  owner_phone TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  wallet_json TEXT NOT NULL DEFAULT '{"balance":0,"transactions":[]}',
  treasury_json TEXT NOT NULL DEFAULT '{"accounts":[],"transactions":[]}',
  quotations_json TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stores_subdomain ON stores_data(subdomain);
CREATE INDEX IF NOT EXISTS idx_stores_custom_domain ON stores_data(custom_domain);
CREATE INDEX IF NOT EXISTS idx_stores_custom_app_domain ON stores_data(custom_app_domain);

CREATE TABLE IF NOT EXISTS orders (
  store_id TEXT NOT NULL,
  id TEXT NOT NULL,
  order_number TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  merchant_id TEXT,
  merchant_name TEXT,
  status TEXT NOT NULL DEFAULT 'جاري_المراجعة',
  date TEXT,
  total_price REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL,
  PRIMARY KEY (store_id, id)
);

CREATE INDEX IF NOT EXISTS idx_orders_store_updated ON orders(store_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_merchant ON orders(store_id, merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

CREATE TABLE IF NOT EXISTS products (
  store_id TEXT NOT NULL,
  id TEXT NOT NULL,
  merchant_id TEXT,
  merchant_ids_json TEXT NOT NULL DEFAULT '[]',
  name TEXT,
  sku TEXT,
  stock REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (store_id, id)
);

CREATE INDEX IF NOT EXISTS idx_products_store_merchant ON products(store_id, merchant_id);

CREATE TABLE IF NOT EXISTS employees (
  store_id TEXT NOT NULL,
  id TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  password_hash TEXT,
  permissions_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (store_id, id)
);

CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone);

CREATE TABLE IF NOT EXISTS store_collections (
  store_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  PRIMARY KEY (store_id, collection_name, id)
);

CREATE INDEX IF NOT EXISTS idx_store_collections_lookup
  ON store_collections(store_id, collection_name, updated_at);

CREATE TABLE IF NOT EXISTS partner_requests (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  merchant_id TEXT,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  amount REAL NOT NULL DEFAULT 0,
  date TEXT,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_partner_requests_store ON partner_requests(store_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_requests_merchant ON partner_requests(merchant_id);

CREATE TABLE IF NOT EXISTS merchant_requests (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  merchant_id TEXT,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  amount REAL NOT NULL DEFAULT 0,
  date TEXT,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_merchant_requests_store ON merchant_requests(store_id, status);
CREATE INDEX IF NOT EXISTS idx_merchant_requests_merchant ON merchant_requests(merchant_id);

CREATE TABLE IF NOT EXISTS shared_audits (
  id TEXT PRIMARY KEY,
  store_id TEXT,
  status TEXT,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_audits_store ON shared_audits(store_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_file INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_store_created ON chat_messages(store_id, created_at);

CREATE TABLE IF NOT EXISTS employee_presence (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  shift_status TEXT,
  last_seen INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_presence_store ON employee_presence(store_id, last_seen);

CREATE TABLE IF NOT EXISTS shared_reports (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS maintenance_requests (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  order_number TEXT,
  status TEXT,
  received_date TEXT,
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maintenance_store ON maintenance_requests(store_id, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_order_num ON maintenance_requests(order_number);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  order_id TEXT,
  customer_phone TEXT,
  last_message_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  updated_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wa_conv_store ON whatsapp_conversations(store_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conv_order ON whatsapp_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_wa_conv_phone ON whatsapp_conversations(store_id, customer_phone);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  order_id TEXT,
  direction TEXT,
  body TEXT,
  occurred_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wa_msg_conv ON whatsapp_messages(conversation_id, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_wa_msg_store ON whatsapp_messages(store_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  source TEXT,
  event_type TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  status_code INTEGER,
  occurred_at TEXT NOT NULL,
  data_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_store ON webhook_logs(store_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_records (
  key TEXT PRIMARY KEY,
  result_json TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deleted_records (
  store_id TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL,
  PRIMARY KEY (store_id, collection_name, record_id)
);
