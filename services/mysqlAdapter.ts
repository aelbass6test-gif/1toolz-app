import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export const getMysqlPool = () => {
  if (pool) return pool;

  const host = process.env.MYSQL_HOST;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  const port = Number(process.env.MYSQL_PORT || 3306);

  if (!host || !user || !database) {
    console.warn('[MYSQL] Missing configuration. MySQL operations will be disabled.');
    return null;
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  return pool;
};

export const query = async (sql: string, params?: any[]) => {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL not configured');
  const [results] = await p.execute(sql, params);
  return results;
};

// Unified Table Schema Creator for Hostinger MySQL
export const ensureMysqlTables = async () => {
  try {
    const p = getMysqlPool();
    if (!p) return;

    console.log('[MYSQL] Initializing tables...');

    // 1. STORES_DATA
    await query(`
      CREATE TABLE IF NOT EXISTS stores_data (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 2. USERS
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        phone VARCHAR(50) PRIMARY KEY,
        full_name VARCHAR(255) NOT NULL,
        password TEXT NOT NULL,
        email VARCHAR(255),
        stores JSON,
        sites JSON,
        is_admin BOOLEAN DEFAULT FALSE,
        is_banned BOOLEAN DEFAULT FALSE,
        join_date VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 3. PRODUCTS
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255),
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        description TEXT,
        price DECIMAL(15,2) DEFAULT 0,
        cost_price DECIMAL(15,2) DEFAULT 0,
        stock_quantity DECIMAL(15,2) DEFAULT 0,
        thumbnail TEXT,
        images JSON,
        options JSON,
        variants JSON,
        details JSON,
        is_archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store (store_id)
      )
    `);

    // 4. ORDERS
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255),
        order_number VARCHAR(100) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'قيد_المراجعة',
        date VARCHAR(100) NOT NULL,
        total_price DECIMAL(15,2) DEFAULT 0,
        shipping_fee DECIMAL(15,2) DEFAULT 0,
        items JSON,
        details JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store (store_id),
        INDEX idx_status (status)
      )
    `);

    // 5. MERCHANT_REQUESTS (Crucial for the Quota issue)
    await query(`
      CREATE TABLE IF NOT EXISTS merchant_requests (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255),
        merchant_id VARCHAR(255),
        merchant_name VARCHAR(255),
        type VARCHAR(50),
        type_arabic VARCHAR(100),
        amount DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        date VARCHAR(100),
        status VARCHAR(50) DEFAULT 'pending',
        payout_method VARCHAR(50),
        payout_account VARCHAR(255),
        transfer_reference VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store (store_id),
        INDEX idx_merchant (merchant_id)
      )
    `);

    // 6. PARTNER_TRANSACTIONS
    await query(`
      CREATE TABLE IF NOT EXISTS partner_transactions (
        id VARCHAR(255) PRIMARY KEY,
        store_id VARCHAR(255),
        merchant_id VARCHAR(255),
        merchant_name VARCHAR(255),
        date VARCHAR(100),
        type VARCHAR(50),
        amount DECIMAL(15,2) DEFAULT 0,
        balance_after DECIMAL(15,2) DEFAULT 0,
        notes TEXT,
        reference_id VARCHAR(255),
        performed_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_store (store_id),
        INDEX idx_merchant (merchant_id)
      )
    `);

    console.log('[MYSQL] All tables verified.');
  } catch (err) {
    console.error('[MYSQL] Error creating tables:', err);
  }
};
