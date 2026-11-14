import type { D1LikeDatabase, D1LikePreparedStatement, JsonResponder } from "./d1Types";
import { normalizeUserRow, upsertUserRecord } from "./auth";

const STORE_COLLECTION_KEYS: Array<{ settingsKey?: string; storeKey?: string; tableCollection: string }> = [
  { settingsKey: "suppliers", tableCollection: "suppliers" },
  { settingsKey: "supplyOrders", tableCollection: "supply_orders" },
  { settingsKey: "partners", tableCollection: "partners" },
  { settingsKey: "partnerTransactions", tableCollection: "partner_transactions" },
  { settingsKey: "warehouses", tableCollection: "warehouses" },
  { settingsKey: "inventoryAudits", tableCollection: "inventory_audits" },
  { settingsKey: "stockTransfers", tableCollection: "stock_transfers" },
  { settingsKey: "orderReturns", tableCollection: "order_returns" },
  { settingsKey: "purchaseReturns", tableCollection: "purchase_returns" },
  { settingsKey: "posSales", tableCollection: "pos_sales" },
  { settingsKey: "cashHolders", tableCollection: "cash_holders" },
  { settingsKey: "cashHandovers", tableCollection: "cash_handovers" },
  { settingsKey: "collections", tableCollection: "collections" },
  { settingsKey: "discountCodes", tableCollection: "discount_codes" },
  { settingsKey: "customPages", tableCollection: "custom_pages" },
  { settingsKey: "paymentMethods", tableCollection: "payment_methods" },
  { settingsKey: "globalOptions", tableCollection: "global_options" },
  { settingsKey: "shippingIntegrations", tableCollection: "shipping_integrations" },
  { settingsKey: "reviews", tableCollection: "reviews" },
  { settingsKey: "abandonedCarts", tableCollection: "abandoned_carts" },
  { settingsKey: "activityLogs", tableCollection: "activity_logs" },
  { settingsKey: "whatsappTemplates", tableCollection: "whatsapp_templates" },
  { settingsKey: "callScripts", tableCollection: "call_scripts" },
  { storeKey: "customers", tableCollection: "customers" }
];

function safeJsonParse<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return raw as T;
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function getItemId(item: any, storeId: string): string {
  const raw = String(item?.id || item?.phone || item?.code || item?.orderNumber || "").trim();
  if (!raw) return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return raw.startsWith(`${storeId}_`) ? raw.slice(storeId.length + 1) : raw;
}

export async function getStoreDataFromD1(db: D1LikeDatabase, storeId: string): Promise<any | null> {
  const storeRow = await db.prepare("SELECT * FROM stores_data WHERE id = ?").bind(storeId).first<any>();
  if (!storeRow) return null;

  const [ordersRes, productsRes, employeesRes, collectionsRes, partnerReqRes, merchantReqRes, deletedRes] =
    await Promise.all([
      db.prepare("SELECT data_json, updated_at, version FROM orders WHERE store_id = ?").bind(storeId).all<any>(),
      db.prepare("SELECT data_json, updated_at FROM products WHERE store_id = ?").bind(storeId).all<any>(),
      db.prepare("SELECT data_json, permissions_json, status, phone, email, name FROM employees WHERE store_id = ?").bind(storeId).all<any>(),
      db.prepare("SELECT collection_name, id, data_json FROM store_collections WHERE store_id = ?").bind(storeId).all<any>(),
      db.prepare("SELECT data_json FROM partner_requests WHERE store_id = ? ORDER BY date DESC").bind(storeId).all<any>(),
      db.prepare("SELECT data_json FROM merchant_requests WHERE store_id = ? ORDER BY date DESC").bind(storeId).all<any>(),
      db.prepare("SELECT collection_name, record_id FROM deleted_records WHERE store_id = ?").bind(storeId).all<any>()
    ]);

  const deletedSet = new Set<string>(
    (deletedRes.results || []).map((r: any) => `${r.collection_name}:${r.record_id}`)
  );

  const settings = safeJsonParse<Record<string, any>>(storeRow.settings_json, {});
  const wallet = safeJsonParse<Record<string, any>>(storeRow.wallet_json, { balance: 0, transactions: [] });
  const treasury = safeJsonParse<Record<string, any>>(storeRow.treasury_json, { accounts: [], transactions: [] });
  const quotations = safeJsonParse<any[]>(storeRow.quotations_json, []);

  // Reconstruct typed collections
  const byCol = new Map<string, any[]>();
  for (const row of collectionsRes.results || []) {
    if (deletedSet.has(`${row.collection_name}:${row.id}`)) continue;
    const item = safeJsonParse<any>(row.data_json, null);
    if (!item) continue;
    const arr = byCol.get(row.collection_name) || [];
    arr.push(item);
    byCol.set(row.collection_name, arr);
  }

  const products = (productsRes.results || [])
    .map((r: any) => safeJsonParse<any>(r.data_json, null))
    .filter((p: any) => p && !deletedSet.has(`products:${p.id}`));

  const employees = (employeesRes.results || [])
    .map((r: any) => safeJsonParse<any>(r.data_json, null))
    .filter((e: any) => e && !deletedSet.has(`employees:${e.id || e.phone}`));

  const orders = (ordersRes.results || [])
    .map((r: any) => safeJsonParse<any>(r.data_json, null))
    .filter((o: any) => o && !deletedSet.has(`orders:${o.id}`) && !deletedSet.has(`orders:${o.orderNumber}`));

  // Hydrate normalized collections into settings and top-level store
  const mergedSettings: Record<string, any> = {
    ...settings,
    storeName: settings.storeName || storeRow.name || storeId,
    subdomain: storeRow.subdomain ?? settings.subdomain,
    customDomain: storeRow.custom_domain ?? settings.customDomain,
    customAppDomain: storeRow.custom_app_domain ?? settings.customAppDomain
  };

  if (products.length > 0 || (settings.products || []).length === 0) {
    mergedSettings.products = products;
  }
  if (employees.length > 0 || (settings.employees || []).length === 0) {
    mergedSettings.employees = employees;
  }

  for (const mapping of STORE_COLLECTION_KEYS) {
    const rows = byCol.get(mapping.tableCollection);
    if (mapping.settingsKey) {
      if (rows && rows.length > 0) mergedSettings[mapping.settingsKey] = rows;
      else if (!Array.isArray(mergedSettings[mapping.settingsKey])) mergedSettings[mapping.settingsKey] = [];
    }
  }

  const txRows = byCol.get("transactions");
  if (txRows && txRows.length > 0) {
    wallet.transactions = txRows;
  }
  const treAccRows = byCol.get("treasury_accounts");
  if (treAccRows && treAccRows.length > 0) {
    treasury.accounts = treAccRows;
  }
  const treTxRows = byCol.get("treasury_transactions");
  if (treTxRows && treTxRows.length > 0) {
    treasury.transactions = treTxRows;
  }
  const quoRows = byCol.get("quotations");
  const finalQuotations = quoRows && quoRows.length > 0 ? quoRows : quotations;

  const partnerRequests = (partnerReqRes.results || []).map((r: any) => safeJsonParse<any>(r.data_json, null)).filter(Boolean);
  const merchantRequests = (merchantReqRes.results || []).map((r: any) => safeJsonParse<any>(r.data_json, null)).filter(Boolean);

  // Merge both request tables cleanly so requests never disappear between portals
  const reqMap = new Map<string, any>();
  for (const r of [...partnerRequests, ...merchantRequests]) {
    if (r?.id) reqMap.set(String(r.id), r);
  }
  const mergedRequests = Array.from(reqMap.values()).sort(
    (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
  );

  return {
    id: storeRow.id,
    name: storeRow.name || mergedSettings.storeName,
    version: storeRow.version || 1,
    updatedAt: storeRow.updated_at,
    settings: mergedSettings,
    orders,
    wallet,
    treasury,
    customers: byCol.get("customers") || [],
    quotations: finalQuotations,
    partnerRequests: mergedRequests,
    merchantRequests: mergedRequests
  };
}

export async function saveStoreDataToD1(
  db: D1LikeDatabase,
  storeId: string,
  data: any,
  storeName?: string
): Promise<{ version: number; updatedAt: string }> {
  const now = new Date().toISOString();
  const existing = await db.prepare("SELECT version, name, settings_json FROM stores_data WHERE id = ?").bind(storeId).first<any>();
  const nextVersion = Number(existing?.version || 0) + 1;

  const rawSettings = data?.settings || {};
  const resolvedName = String(rawSettings.storeName || data?.name || storeName || existing?.name || storeId).trim();
  const subdomain = rawSettings.subdomain ? String(rawSettings.subdomain).trim().toLowerCase() : null;
  const customDomain = rawSettings.customDomain ? String(rawSettings.customDomain).trim().toLowerCase() : null;
  const customAppDomain = rawSettings.customAppDomain ? String(rawSettings.customAppDomain).trim().toLowerCase() : null;

  // Strip heavy duplicated arrays from settings_json to keep store header lean while keeping lightweight copy
  const lightSettings = { ...rawSettings };
  const wallet = data?.wallet || { balance: 0, transactions: [] };
  const treasury = data?.treasury || { accounts: [], transactions: [] };
  const quotations = Array.isArray(data?.quotations) ? data.quotations : [];

  await db
    .prepare(
      `INSERT INTO stores_data (
        id, name, subdomain, custom_domain, custom_app_domain, owner_phone,
        settings_json, wallet_json, treasury_json, quotations_json, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        subdomain = excluded.subdomain,
        custom_domain = excluded.custom_domain,
        custom_app_domain = excluded.custom_app_domain,
        owner_phone = COALESCE(excluded.owner_phone, stores_data.owner_phone),
        settings_json = excluded.settings_json,
        wallet_json = excluded.wallet_json,
        treasury_json = excluded.treasury_json,
        quotations_json = excluded.quotations_json,
        version = excluded.version,
        updated_at = excluded.updated_at`
    )
    .bind(
      storeId,
      resolvedName,
      subdomain,
      customDomain,
      customAppDomain,
      data?.ownerPhone || rawSettings?.ownerPhone || null,
      JSON.stringify(lightSettings),
      JSON.stringify({ balance: Number(wallet.balance || 0), transactions: [] }),
      JSON.stringify({ accounts: [], transactions: [] }),
      JSON.stringify(quotations),
      nextVersion,
      now,
      now
    )
    .run();

  const deletedRows = await db.prepare("SELECT collection_name, record_id FROM deleted_records WHERE store_id = ?").bind(storeId).all<any>();
  const deletedSet = new Set<string>((deletedRows.results || []).map((r: any) => `${r.collection_name}:${r.record_id}`));

  const stmts: D1LikePreparedStatement[] = [];

  // 1. Orders
  if (Array.isArray(data?.orders)) {
    for (const o of data.orders) {
      if (!o || !o.id) continue;
      const oid = getItemId(o, storeId);
      if (deletedSet.has(`orders:${oid}`)) continue;
      const oUpdatedAt = o.updatedAt || o.statusUpdatedAt || o.date || now;
      stmts.push(
        db
          .prepare(
            `INSERT INTO orders (
              store_id, id, order_number, customer_name, customer_phone,
              merchant_id, merchant_name, status, date, total_price, updated_at, version, data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(store_id, id) DO UPDATE SET
              order_number = excluded.order_number,
              customer_name = excluded.customer_name,
              customer_phone = excluded.customer_phone,
              merchant_id = excluded.merchant_id,
              merchant_name = excluded.merchant_name,
              status = excluded.status,
              date = excluded.date,
              total_price = excluded.total_price,
              updated_at = excluded.updated_at,
              version = orders.version + 1,
              data_json = excluded.data_json`
          )
          .bind(
            storeId,
            oid,
            String(o.orderNumber || oid),
            String(o.customerName || ""),
            String(o.customerPhone || ""),
            o.merchantId || null,
            o.merchantName || null,
            String(o.status || "جاري_المراجعة"),
            String(o.date || now),
            Number(o.totalPrice ?? 0),
            String(oUpdatedAt),
            nextVersion,
            JSON.stringify({ ...o, id: oid, storeId })
          )
      );
    }
  }

  // 2. Products
  if (Array.isArray(rawSettings.products)) {
    for (const p of rawSettings.products) {
      if (!p || !p.id) continue;
      const pid = getItemId(p, storeId);
      if (deletedSet.has(`products:${pid}`)) continue;
      stmts.push(
        db
          .prepare(
            `INSERT INTO products (
              store_id, id, merchant_id, merchant_ids_json, name, sku, stock, updated_at, data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(store_id, id) DO UPDATE SET
              merchant_id = excluded.merchant_id,
              merchant_ids_json = excluded.merchant_ids_json,
              name = excluded.name,
              sku = excluded.sku,
              stock = excluded.stock,
              updated_at = excluded.updated_at,
              data_json = excluded.data_json`
          )
          .bind(
            storeId,
            pid,
            p.merchantId || null,
            JSON.stringify(Array.isArray(p.merchantIds) ? p.merchantIds : p.merchantId ? [p.merchantId] : []),
            String(p.name || ""),
            String(p.sku || ""),
            Number(p.stockQuantity ?? p.stock ?? 0),
            String(p.updatedAt || now),
            JSON.stringify({ ...p, id: pid, storeId })
          )
      );
    }
  }

  // 3. Employees
  if (Array.isArray(rawSettings.employees)) {
    for (const e of rawSettings.employees) {
      if (!e || (!e.id && !e.phone)) continue;
      const eid = getItemId(e, storeId);
      if (deletedSet.has(`employees:${eid}`)) continue;
      stmts.push(
        db
          .prepare(
            `INSERT INTO employees (
              store_id, id, phone, email, name, status, permissions_json, updated_at, data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(store_id, id) DO UPDATE SET
              phone = excluded.phone,
              email = excluded.email,
              name = excluded.name,
              status = excluded.status,
              permissions_json = excluded.permissions_json,
              updated_at = excluded.updated_at,
              data_json = excluded.data_json`
          )
          .bind(
            storeId,
            eid,
            String(e.phone || eid),
            e.email || "",
            e.name || "",
            e.status || "active",
            JSON.stringify(e.permissions || []),
            now,
            JSON.stringify({ ...e, id: eid, storeId })
          )
      );
    }
  }

  // 4. Typed Collections (store_collections)
  const upsertCollection = (colName: string, items: any[]) => {
    for (const item of items) {
      if (!item) continue;
      const iid = getItemId(item, storeId);
      if (deletedSet.has(`${colName}:${iid}`)) continue;
      stmts.push(
        db
          .prepare(
            `INSERT INTO store_collections (store_id, collection_name, id, updated_at, data_json)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(store_id, collection_name, id) DO UPDATE SET
               updated_at = excluded.updated_at,
               data_json = excluded.data_json`
          )
          .bind(storeId, colName, iid, String(item.updatedAt || now), JSON.stringify({ ...item, id: iid, storeId }))
      );
    }
  };

  for (const mapping of STORE_COLLECTION_KEYS) {
    const arr = mapping.settingsKey ? rawSettings[mapping.settingsKey] : mapping.storeKey ? data?.[mapping.storeKey] : null;
    if (Array.isArray(arr)) {
      upsertCollection(mapping.tableCollection, arr);
    }
  }
  if (Array.isArray(wallet.transactions)) upsertCollection("transactions", wallet.transactions);
  if (Array.isArray(treasury.accounts)) upsertCollection("treasury_accounts", treasury.accounts);
  if (Array.isArray(treasury.transactions)) upsertCollection("treasury_transactions", treasury.transactions);
  if (Array.isArray(quotations)) upsertCollection("quotations", quotations);

  // Execute in chunks of 50 statements for D1 batch efficiency
  const CHUNK_SIZE = 50;
  for (let i = 0; i < stmts.length; i += CHUNK_SIZE) {
    await db.batch(stmts.slice(i, i + CHUNK_SIZE));
  }

  return { version: nextVersion, updatedAt: now };
}

export async function handleDbRequest(
  request: Request,
  env: any,
  db: D1LikeDatabase,
  json: JsonResponder
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const body = request.method === "GET" || request.method === "HEAD"
    ? {}
    : await request.json().catch(() => ({} as Record<string, any>)) as Record<string, any>;

  // 0. Health / Verification
  if (path === "/api/db/health") {
    const row = await db.prepare("SELECT COUNT(*) as storeCount FROM stores_data").first<{ storeCount: number }>();
    const usersRow = await db.prepare("SELECT COUNT(*) as userCount FROM users").first<{ userCount: number }>();
    return json(request, env, {
      success: true,
      provider: "cloudflare-d1",
      storesCount: Number(row?.storeCount || 0),
      usersCount: Number(usersRow?.userCount || 0),
      timestamp: new Date().toISOString()
    });
  }

  // 1. Users CRUD
  if (path === "/api/db/users" && request.method === "GET") {
    const rows = await db.prepare("SELECT * FROM users ORDER BY join_date DESC").all<any>();
    return json(request, env, { success: true, users: (rows.results || []).map(normalizeUserRow) });
  }

  if (path === "/api/db/users" && (request.method === "POST" || request.method === "PUT")) {
    const u = body.user || body;
    const saved = await upsertUserRecord(db, u, u.password);
    return json(request, env, { success: true, user: saved });
  }

  const userPhoneMatch = path.match(/^\/api\/db\/users\/([^/]+)$/);
  if (userPhoneMatch) {
    const phone = decodeURIComponent(userPhoneMatch[1]);
    if (request.method === "GET") {
      const row = await db.prepare("SELECT * FROM users WHERE phone = ?").bind(phone).first<any>();
      if (!row) return json(request, env, { success: true, user: null });
      return json(request, env, { success: true, user: normalizeUserRow(row) });
    }
    if (request.method === "PUT" || request.method === "PATCH" || request.method === "POST") {
      const u = { ...(body.user || body), phone };
      const saved = await upsertUserRecord(db, u, u.password);
      return json(request, env, { success: true, user: saved });
    }
    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM users WHERE phone = ?").bind(phone).run();
      await db.prepare("DELETE FROM sessions WHERE user_phone = ?").bind(phone).run();
      return json(request, env, { success: true });
    }
  }

  // 2. Global App Data / Settings (loyaltyData, smtp, etc.)
  if (path === "/api/db/global") {
    if (request.method === "GET") {
      const [usersRows, loyaltyRow] = await Promise.all([
        db.prepare("SELECT * FROM users ORDER BY join_date DESC").all<any>(),
        db.prepare("SELECT value_json FROM app_settings WHERE key = 'loyaltyData'").first<{ value_json: string }>()
      ]);
      return json(request, env, {
        success: true,
        users: (usersRows.results || []).map(normalizeUserRow),
        loyaltyData: safeJsonParse(loyaltyRow?.value_json, {})
      });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const now = new Date().toISOString();
      if (Array.isArray(body.users)) {
        for (const u of body.users) {
          if (u?.phone) await upsertUserRecord(db, u, u.password);
        }
      }
      if (body.loyaltyData !== undefined) {
        await db
          .prepare(
            `INSERT INTO app_settings (key, value_json, updated_at) VALUES ('loyaltyData', ?, ?)
             ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
          )
          .bind(JSON.stringify(body.loyaltyData || {}), now)
          .run();
      }
      return json(request, env, { success: true });
    }
  }

  const settingKeyMatch = path.match(/^\/api\/db\/settings\/([^/]+)$/);
  if (settingKeyMatch) {
    const key = decodeURIComponent(settingKeyMatch[1]);
    if (request.method === "GET") {
      const row = await db.prepare("SELECT value_json FROM app_settings WHERE key = ?").bind(key).first<{ value_json: string }>();
      return json(request, env, { success: true, value: safeJsonParse(row?.value_json, null) });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const val = body.value !== undefined ? body.value : body;
      await db
        .prepare(
          `INSERT INTO app_settings (key, value_json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
        )
        .bind(key, JSON.stringify(val), new Date().toISOString())
        .run();
      return json(request, env, { success: true });
    }
  }

  // 3. Stores List & Domain Resolution
  if (path === "/api/db/stores" && request.method === "GET") {
    const rows = await db.prepare("SELECT id, name, subdomain, custom_domain, custom_app_domain, version, updated_at FROM stores_data").all<any>();
    return json(request, env, { success: true, stores: rows.results || [] });
  }

  if (path === "/api/db/all-settings" && request.method === "GET") {
    const rows = await db.prepare("SELECT id, name, settings_json FROM stores_data").all<any>();
    const map: Record<string, any> = {};
    for (const r of rows.results || []) {
      map[r.id] = { id: r.id, name: r.name, settings: safeJsonParse(r.settings_json, {}) };
    }
    return json(request, env, { success: true, stores: map });
  }

  if (path === "/api/db/stores/resolve-domain" && request.method === "GET") {
    const host = String(url.searchParams.get("host") || "").trim().toLowerCase();
    const subdomain = String(url.searchParams.get("subdomain") || "").trim().toLowerCase();
    const hostNoWww = host.replace(/^www\./, "");

    const row = await db
      .prepare(
        `SELECT id, name, settings_json FROM stores_data
         WHERE (? != '' AND LOWER(subdomain) = ?)
            OR (? != '' AND (LOWER(custom_domain) = ? OR LOWER(custom_domain) = ? OR LOWER(custom_app_domain) = ? OR LOWER(custom_app_domain) = ?))
         LIMIT 1`
      )
      .bind(subdomain, subdomain, host, host, hostNoWww, host, hostNoWww)
      .first<any>();

    if (row) {
      return json(request, env, {
        success: true,
        found: true,
        storeId: row.id,
        storeName: row.name,
        settings: safeJsonParse(row.settings_json, {})
      });
    }
    return json(request, env, { success: true, found: false });
  }

  // 4. Customer Quote Lookup across stores
  const quoteLookupMatch = path.match(/^\/api\/db\/orders\/quote-lookup\/([^/]+)$/);
  if (quoteLookupMatch && request.method === "GET") {
    const quoteId = decodeURIComponent(quoteLookupMatch[1]);
    const storeIdHint = url.searchParams.get("storeId");
    if (storeIdHint) {
      const storeRow = await db.prepare("SELECT id, name, settings_json, quotations_json FROM stores_data WHERE id = ?").bind(storeIdHint).first<any>();
      if (storeRow) {
        const quots = safeJsonParse<any[]>(storeRow.quotations_json, []);
        const colRows = await db.prepare("SELECT data_json FROM store_collections WHERE store_id = ? AND collection_name = 'quotations'").bind(storeIdHint).all<any>();
        const allQuots = [...quots, ...(colRows.results || []).map((r: any) => safeJsonParse<any>(r.data_json, null)).filter(Boolean)];
        const matched = allQuots.find((q) => q && (q.id === quoteId || q.quotationNumber === quoteId));
        if (matched) {
          return json(request, env, { success: true, quotation: matched, storeId: storeRow.id, storeName: storeRow.name, settings: safeJsonParse(storeRow.settings_json, {}) });
        }
      }
    }
    const allStores = await db.prepare("SELECT id, name, settings_json, quotations_json FROM stores_data").all<any>();
    for (const s of allStores.results || []) {
      const quots = safeJsonParse<any[]>(s.quotations_json, []);
      const matched = quots.find((q) => q && (q.id === quoteId || q.quotationNumber === quoteId));
      if (matched) {
        return json(request, env, { success: true, quotation: matched, storeId: s.id, storeName: s.name, settings: safeJsonParse(s.settings_json, {}) });
      }
    }
    const colMatches = await db.prepare("SELECT store_id, data_json FROM store_collections WHERE collection_name = 'quotations'").all<any>();
    for (const r of colMatches.results || []) {
      const q = safeJsonParse<any>(r.data_json, null);
      if (q && (q.id === quoteId || q.quotationNumber === quoteId)) {
        const s = await db.prepare("SELECT id, name, settings_json FROM stores_data WHERE id = ?").bind(r.store_id).first<any>();
        return json(request, env, { success: true, quotation: q, storeId: r.store_id, storeName: s?.name || r.store_id, settings: safeJsonParse(s?.settings_json, {}) });
      }
    }
    return json(request, env, { success: false, quotation: null }, 404);
  }

  // 5. Customer Order Lookup across stores
  if (path === "/api/db/orders/customer-lookup" && request.method === "GET") {
    const orderId = url.searchParams.get("orderId") || "";
    const orderNumber = url.searchParams.get("orderNumber") || "";
    const phone = url.searchParams.get("phone") || "";
    let rows: any[] = [];
    if (orderId || orderNumber) {
      const res = await db
        .prepare("SELECT store_id, data_json FROM orders WHERE id = ? OR order_number = ? LIMIT 10")
        .bind(orderId || orderNumber, orderNumber || orderId)
        .all<any>();
      rows = res.results || [];
    } else if (phone) {
      const clean = phone.replace(/\D/g, "");
      const res = await db
        .prepare("SELECT store_id, data_json FROM orders WHERE customer_phone LIKE ? LIMIT 20")
        .bind(`%${clean.slice(-9)}%`)
        .all<any>();
      rows = res.results || [];
    }
    const orders = rows.map((r) => ({ ...safeJsonParse(r.data_json, {}), storeId: r.store_id }));
    return json(request, env, { success: true, orders });
  }

  // 6. Merchant products cross-store lookup
  const merchantProdMatch = path.match(/^\/api\/db\/products\/merchant\/([^/]+)$/);
  if (merchantProdMatch && request.method === "GET") {
    const merchantId = decodeURIComponent(merchantProdMatch[1]).toLowerCase();
    const res = await db.prepare("SELECT store_id, data_json FROM products").all<any>();
    const matched = (res.results || [])
      .map((r: any) => ({ ...safeJsonParse<any>(r.data_json, {}), storeId: r.store_id }))
      .filter((p: any) => {
        const m1 = String(p.merchantId || "").toLowerCase() === merchantId;
        const m2 = Array.isArray(p.merchantIds) && p.merchantIds.some((id: any) => String(id).toLowerCase() === merchantId);
        return m1 || m2;
      });
    return json(request, env, { success: true, products: matched });
  }

  // 7. Single Store Item Upsert/Delete + Clear + Delete + Version Check + Get/Put
  const storeActionMatch = path.match(/^\/api\/db\/stores\/([^/]+)(?:\/(item|clear|delete|incremental|partners|meta))?$/);
  if (storeActionMatch) {
    const storeId = decodeURIComponent(storeActionMatch[1]);
    const subAction = storeActionMatch[2];

    if (subAction === "meta" && request.method === "GET") {
      const row = await db.prepare("SELECT id, name, version, updated_at FROM stores_data WHERE id = ?").bind(storeId).first<any>();
      return json(request, env, { success: true, exists: !!row, version: row?.version || 0, updatedAt: row?.updated_at || null });
    }

    if (subAction === "clear" && request.method === "POST") {
      const tables = [
        "orders",
        "products",
        "employees",
        "store_collections",
        "partner_requests",
        "merchant_requests",
        "chat_messages",
        "employee_presence",
        "maintenance_requests",
        "whatsapp_conversations",
        "whatsapp_messages",
        "webhook_logs",
        "deleted_records"
      ];
      for (const tbl of tables) {
        await db.prepare(`DELETE FROM ${tbl} WHERE store_id = ?`).bind(storeId).run().catch(() => {});
      }
      await db
        .prepare("UPDATE stores_data SET settings_json = '{}', wallet_json = '{\"balance\":0,\"transactions\":[]}', treasury_json = '{\"accounts\":[],\"transactions\":[]}', quotations_json = '[]', version = version + 1, updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), storeId)
        .run();
      return json(request, env, { success: true });
    }

    if (subAction === "delete" && (request.method === "POST" || request.method === "DELETE")) {
      const tables = [
        "orders",
        "products",
        "employees",
        "store_collections",
        "partner_requests",
        "merchant_requests",
        "chat_messages",
        "employee_presence",
        "maintenance_requests",
        "whatsapp_conversations",
        "whatsapp_messages",
        "webhook_logs",
        "deleted_records"
      ];
      for (const tbl of tables) {
        await db.prepare(`DELETE FROM ${tbl} WHERE store_id = ?`).bind(storeId).run().catch(() => {});
      }
      await db.prepare("DELETE FROM stores_data WHERE id = ?").bind(storeId).run();
      return json(request, env, { success: true });
    }

    if (subAction === "item") {
      const collectionName = String(body.collectionName || url.searchParams.get("collectionName") || "").trim();
      const itemIdRaw = String(body.itemId || body.item?.id || url.searchParams.get("itemId") || "").trim();
      const now = new Date().toISOString();
      if (!collectionName || !itemIdRaw) {
        return json(request, env, { success: false, error: "collectionName و itemId مطلوبان" }, 400);
      }
      const itemId = itemIdRaw.startsWith(`${storeId}_`) ? itemIdRaw.slice(storeId.length + 1) : itemIdRaw;

      if (request.method === "DELETE") {
        await db
          .prepare("INSERT OR REPLACE INTO deleted_records (store_id, collection_name, record_id, deleted_at) VALUES (?, ?, ?, ?)")
          .bind(storeId, collectionName, itemId, now)
          .run();
        if (collectionName === "orders") {
          await db.prepare("DELETE FROM orders WHERE store_id = ? AND (id = ? OR order_number = ?)").bind(storeId, itemId, itemId).run();
        } else if (collectionName === "products") {
          await db.prepare("DELETE FROM products WHERE store_id = ? AND id = ?").bind(storeId, itemId).run();
        } else if (collectionName === "employees") {
          await db.prepare("DELETE FROM employees WHERE store_id = ? AND (id = ? OR phone = ?)").bind(storeId, itemId, itemId).run();
        } else {
          await db
            .prepare("DELETE FROM store_collections WHERE store_id = ? AND collection_name = ? AND id = ?")
            .bind(storeId, collectionName, itemId)
            .run();
        }
        await db.prepare("UPDATE stores_data SET version = version + 1, updated_at = ? WHERE id = ?").bind(now, storeId).run();
        return json(request, env, { success: true });
      }

      if (request.method === "PUT" || request.method === "POST") {
        const item = { ...(body.item || body), id: itemId, storeId, updatedAt: now };
        await db
          .prepare("DELETE FROM deleted_records WHERE store_id = ? AND collection_name = ? AND record_id = ?")
          .bind(storeId, collectionName, itemId)
          .run();

        if (collectionName === "orders") {
          await db
            .prepare(
              `INSERT INTO orders (
                store_id, id, order_number, customer_name, customer_phone,
                merchant_id, merchant_name, status, date, total_price, updated_at, version, data_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
              ON CONFLICT(store_id, id) DO UPDATE SET
                order_number = excluded.order_number,
                customer_name = excluded.customer_name,
                customer_phone = excluded.customer_phone,
                merchant_id = excluded.merchant_id,
                merchant_name = excluded.merchant_name,
                status = excluded.status,
                date = excluded.date,
                total_price = excluded.total_price,
                updated_at = excluded.updated_at,
                version = orders.version + 1,
                data_json = excluded.data_json`
            )
            .bind(
              storeId,
              itemId,
              String(item.orderNumber || itemId),
              String(item.customerName || ""),
              String(item.customerPhone || ""),
              item.merchantId || null,
              item.merchantName || null,
              String(item.status || "جاري_المراجعة"),
              String(item.date || now),
              Number(item.totalPrice ?? 0),
              now,
              JSON.stringify(item)
            )
            .run();
        } else if (collectionName === "products") {
          await db
            .prepare(
              `INSERT INTO products (
                store_id, id, merchant_id, merchant_ids_json, name, sku, stock, updated_at, data_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(store_id, id) DO UPDATE SET
                merchant_id = excluded.merchant_id,
                merchant_ids_json = excluded.merchant_ids_json,
                name = excluded.name,
                sku = excluded.sku,
                stock = excluded.stock,
                updated_at = excluded.updated_at,
                data_json = excluded.data_json`
            )
            .bind(
              storeId,
              itemId,
              item.merchantId || null,
              JSON.stringify(Array.isArray(item.merchantIds) ? item.merchantIds : item.merchantId ? [item.merchantId] : []),
              String(item.name || ""),
              String(item.sku || ""),
              Number(item.stockQuantity ?? item.stock ?? 0),
              now,
              JSON.stringify(item)
            )
            .run();
        } else if (collectionName === "employees") {
          await db
            .prepare(
              `INSERT INTO employees (
                store_id, id, phone, email, name, status, permissions_json, updated_at, data_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(store_id, id) DO UPDATE SET
                phone = excluded.phone,
                email = excluded.email,
                name = excluded.name,
                status = excluded.status,
                permissions_json = excluded.permissions_json,
                updated_at = excluded.updated_at,
                data_json = excluded.data_json`
            )
            .bind(
              storeId,
              itemId,
              String(item.phone || itemId),
              item.email || "",
              item.name || "",
              item.status || "active",
              JSON.stringify(item.permissions || []),
              now,
              JSON.stringify(item)
            )
            .run();
        } else {
          await db
            .prepare(
              `INSERT INTO store_collections (store_id, collection_name, id, updated_at, data_json)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(store_id, collection_name, id) DO UPDATE SET
                 updated_at = excluded.updated_at,
                 data_json = excluded.data_json`
            )
            .bind(storeId, collectionName, itemId, now, JSON.stringify(item))
            .run();
        }
        await db.prepare("UPDATE stores_data SET version = version + 1, updated_at = ? WHERE id = ?").bind(now, storeId).run();
        return json(request, env, { success: true, item });
      }
    }

    if (subAction === "partners" && request.method === "POST") {
      const now = new Date().toISOString();
      const partners = Array.isArray(body.partners) ? body.partners : [];
      const transactions = Array.isArray(body.transactions) ? body.transactions : [];
      const stmts: D1LikePreparedStatement[] = [];
      for (const p of partners) {
        const pid = getItemId(p, storeId);
        stmts.push(
          db
            .prepare(
              `INSERT INTO store_collections (store_id, collection_name, id, updated_at, data_json)
               VALUES (?, 'partners', ?, ?, ?)
               ON CONFLICT(store_id, collection_name, id) DO UPDATE SET updated_at = excluded.updated_at, data_json = excluded.data_json`
            )
            .bind(storeId, pid, now, JSON.stringify({ ...p, id: pid, storeId }))
        );
      }
      for (const t of transactions) {
        const tid = getItemId(t, storeId);
        stmts.push(
          db
            .prepare(
              `INSERT INTO store_collections (store_id, collection_name, id, updated_at, data_json)
               VALUES (?, 'partner_transactions', ?, ?, ?)
               ON CONFLICT(store_id, collection_name, id) DO UPDATE SET updated_at = excluded.updated_at, data_json = excluded.data_json`
            )
            .bind(storeId, tid, now, JSON.stringify({ ...t, id: tid, storeId }))
        );
      }
      if (stmts.length > 0) await db.batch(stmts);
      await db.prepare("UPDATE stores_data SET version = version + 1, updated_at = ? WHERE id = ?").bind(now, storeId).run();
      return json(request, env, { success: true });
    }

    // Store GET / PUT / DELETE
    if (!subAction) {
      if (request.method === "GET") {
        const storeData = await getStoreDataFromD1(db, storeId);
        if (!storeData) {
          return json(request, env, { success: true, storeData: null });
        }
        return json(request, env, { success: true, storeData });
      }
      if (request.method === "PUT" || request.method === "POST") {
        const meta = await saveStoreDataToD1(db, storeId, body.storeData || body, body.storeName);
        return json(request, env, { success: true, ...meta });
      }
      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM stores_data WHERE id = ?").bind(storeId).run();
        return json(request, env, { success: true });
      }
    }
  }

  // 8. Partner & Merchant Requests (Withdrawal / Settlement / Supplies)
  const reqMatch = path.match(/^\/api\/db\/requests\/([^/]+)(?:\/([^/]+))?$/);
  if (reqMatch) {
    const storeId = decodeURIComponent(reqMatch[1]);
    const reqId = reqMatch[2] ? decodeURIComponent(reqMatch[2]) : null;
    const now = new Date().toISOString();

    if (request.method === "GET") {
      const [pRows, mRows] = await Promise.all([
        db.prepare("SELECT data_json FROM partner_requests WHERE store_id = ?").bind(storeId).all<any>(),
        db.prepare("SELECT data_json FROM merchant_requests WHERE store_id = ?").bind(storeId).all<any>()
      ]);
      const map = new Map<string, any>();
      for (const r of [...(pRows.results || []), ...(mRows.results || [])]) {
        const parsed = safeJsonParse<any>(r.data_json, null);
        if (parsed?.id) map.set(String(parsed.id), parsed);
      }
      const list = Array.from(map.values()).sort(
        (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
      );
      return json(request, env, { success: true, requests: list });
    }

    if (request.method === "POST" || request.method === "PUT") {
      const reqObj = body.request || body;
      const id = String(reqObj.id || reqId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const payload = { ...reqObj, id, storeId, updatedAt: now };
      const dataStr = JSON.stringify(payload);
      const merchantId = String(payload.merchantId || payload.merchant_id || "");
      const type = String(payload.type || "withdrawal");
      const status = String(payload.status || "pending");
      const amount = Number(payload.amount || 0);
      const date = String(payload.date || now);

      await db.batch([
        db
          .prepare(
            `INSERT INTO partner_requests (id, store_id, merchant_id, type, status, amount, date, updated_at, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               merchant_id = excluded.merchant_id,
               type = excluded.type,
               status = excluded.status,
               amount = excluded.amount,
               date = excluded.date,
               updated_at = excluded.updated_at,
               data_json = excluded.data_json`
          )
          .bind(id, storeId, merchantId, type, status, amount, date, now, dataStr),
        db
          .prepare(
            `INSERT INTO merchant_requests (id, store_id, merchant_id, type, status, amount, date, updated_at, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               merchant_id = excluded.merchant_id,
               type = excluded.type,
               status = excluded.status,
               amount = excluded.amount,
               date = excluded.date,
               updated_at = excluded.updated_at,
               data_json = excluded.data_json`
          )
          .bind(id, storeId, merchantId, type, status, amount, date, now, dataStr),
        db.prepare("UPDATE stores_data SET version = version + 1, updated_at = ? WHERE id = ?").bind(now, storeId)
      ]);

      return json(request, env, { success: true, request: payload });
    }

    if (request.method === "DELETE" && reqId) {
      await db.batch([
        db.prepare("DELETE FROM partner_requests WHERE id = ? AND store_id = ?").bind(reqId, storeId),
        db.prepare("DELETE FROM merchant_requests WHERE id = ? AND store_id = ?").bind(reqId, storeId),
        db.prepare("UPDATE stores_data SET version = version + 1, updated_at = ? WHERE id = ?").bind(now, storeId)
      ]);
      return json(request, env, { success: true });
    }
  }

  // 9. Shared Audits (Inventory Collaboration)
  if (path.startsWith("/api/db/audits/")) {
    const itemMatch = path.match(/^\/api\/db\/audits\/item\/([^/]+)$/);
    if (itemMatch) {
      const auditId = decodeURIComponent(itemMatch[1]);
      if (request.method === "GET") {
        const row = await db.prepare("SELECT data_json FROM shared_audits WHERE id = ?").bind(auditId).first<{ data_json: string }>();
        return json(request, env, { success: true, audit: safeJsonParse(row?.data_json, null) });
      }
      if (request.method === "PATCH" || request.method === "PUT" || request.method === "POST") {
        const row = await db.prepare("SELECT * FROM shared_audits WHERE id = ?").bind(auditId).first<any>();
        const existing = safeJsonParse<any>(row?.data_json, { id: auditId });
        const updates = body.updates || body;
        const merged = { ...existing, ...updates, id: auditId, updatedAt: new Date().toISOString() };
        await db
          .prepare(
            `INSERT INTO shared_audits (id, store_id, status, updated_at, data_json)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               store_id = excluded.store_id,
               status = excluded.status,
               updated_at = excluded.updated_at,
               data_json = excluded.data_json`
          )
          .bind(auditId, merged.storeId || merged.store_id || row?.store_id || "", merged.status || "active", merged.updatedAt, JSON.stringify(merged))
          .run();
        return json(request, env, { success: true, audit: merged });
      }
      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM shared_audits WHERE id = ?").bind(auditId).run();
        return json(request, env, { success: true });
      }
    }

    const storeAuditMatch = path.match(/^\/api\/db\/audits\/([^/]+)$/);
    if (storeAuditMatch) {
      const storeId = decodeURIComponent(storeAuditMatch[1]);
      if (request.method === "GET") {
        const res = await db.prepare("SELECT data_json FROM shared_audits WHERE store_id = ? ORDER BY updated_at DESC").bind(storeId).all<any>();
        const audits = (res.results || []).map((r: any) => safeJsonParse(r.data_json, null)).filter(Boolean);
        return json(request, env, { success: true, audits });
      }
      if (request.method === "POST" || request.method === "PUT") {
        const audit = body.audit || body;
        const id = String(audit.id || `audit_${Date.now()}`);
        const now = new Date().toISOString();
        const payload = { ...audit, id, storeId, updatedAt: now };
        await db
          .prepare(
            `INSERT INTO shared_audits (id, store_id, status, updated_at, data_json)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               status = excluded.status,
               updated_at = excluded.updated_at,
               data_json = excluded.data_json`
          )
          .bind(id, storeId, payload.status || "active", now, JSON.stringify(payload))
          .run();
        return json(request, env, { success: true, audit: payload });
      }
    }
  }

  // 10. Team Chat Messages
  const chatMatch = path.match(/^\/api\/db\/chat\/([^/]+)(?:\/mark-read)?$/);
  if (chatMatch) {
    const storeId = decodeURIComponent(chatMatch[1]);
    if (path.endsWith("/mark-read") && request.method === "POST") {
      const receiverId = String(body.receiverId || "");
      const ids: string[] = Array.isArray(body.messageIds) ? body.messageIds : [];
      if (ids.length > 0) {
        const stmts = ids.map((id) => db.prepare("UPDATE chat_messages SET is_read = 1 WHERE id = ? AND store_id = ?").bind(id, storeId));
        await db.batch(stmts);
      } else if (receiverId) {
        await db.prepare("UPDATE chat_messages SET is_read = 1 WHERE store_id = ? AND receiver_id = ?").bind(storeId, receiverId).run();
      }
      return json(request, env, { success: true });
    }
    if (request.method === "GET") {
      const res = await db
        .prepare("SELECT * FROM chat_messages WHERE store_id = ? ORDER BY created_at ASC")
        .bind(storeId)
        .all<any>();
      const messages = (res.results || []).map((r: any) => ({
        id: r.id,
        store_id: r.store_id,
        sender_id: r.sender_id,
        receiver_id: r.receiver_id,
        content: r.content,
        is_read: Boolean(r.is_read),
        is_file: Boolean(r.is_file),
        created_at: r.created_at
      }));
      return json(request, env, { success: true, messages });
    }
    if (request.method === "POST") {
      const id = String(body.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO chat_messages (id, store_id, sender_id, receiver_id, content, is_read, is_file, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          storeId,
          String(body.senderId || body.sender_id || ""),
          String(body.receiverId || body.receiver_id || "general"),
          String(body.content || ""),
          body.isRead ? 1 : 0,
          body.isFile ? 1 : 0,
          now
        )
        .run();
      return json(request, env, {
        success: true,
        message: {
          id,
          store_id: storeId,
          sender_id: body.senderId || body.sender_id,
          receiver_id: body.receiverId || body.receiver_id || "general",
          content: body.content,
          is_read: Boolean(body.isRead),
          is_file: Boolean(body.isFile),
          created_at: now
        }
      });
    }
  }

  // 11. Employee Presence
  const presenceMatch = path.match(/^\/api\/db\/presence\/([^/]+)(?:\/([^/]+))?$/);
  if (presenceMatch) {
    const storeId = decodeURIComponent(presenceMatch[1]);
    const userId = presenceMatch[2] ? decodeURIComponent(presenceMatch[2]) : null;
    if (request.method === "GET") {
      const cutoff = Date.now() - 300000;
      const res = await db
        .prepare("SELECT * FROM employee_presence WHERE store_id = ? AND last_seen >= ?")
        .bind(storeId, cutoff)
        .all<any>();
      return json(request, env, { success: true, presence: res.results || [] });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const uid = userId || String(body.userId || "");
      const docId = `${storeId}_${uid}`;
      const nowMs = Date.now();
      await db
        .prepare(
          `INSERT INTO employee_presence (id, store_id, user_id, user_name, shift_status, last_seen)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             user_name = excluded.user_name,
             shift_status = excluded.shift_status,
             last_seen = excluded.last_seen`
        )
        .bind(docId, storeId, uid, String(body.userName || ""), String(body.shiftStatus || "working"), nowMs)
        .run();
      return json(request, env, { success: true });
    }
    if (request.method === "DELETE" && userId) {
      await db.prepare("DELETE FROM employee_presence WHERE id = ?").bind(`${storeId}_${userId}`).run();
      return json(request, env, { success: true });
    }
  }

  // 12. Shared Reports
  if (path === "/api/shared-reports" && request.method === "POST") {
    const id = String(body.id || `rep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
    const content = String(body.content || "");
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO shared_reports (id, content, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET content = excluded.content`
      )
      .bind(id, content, now)
      .run();
    return json(request, env, { success: true, id });
  }

  const sharedReportGet = path.match(/^\/api\/shared-reports\/([^/]+)$/);
  if (sharedReportGet && request.method === "GET") {
    const id = decodeURIComponent(sharedReportGet[1]);
    const row = await db.prepare("SELECT id, content, created_at FROM shared_reports WHERE id = ?").bind(id).first<any>();
    if (!row) return json(request, env, { success: false, error: "التقرير غير موجود" }, 404);
    return json(request, env, { success: true, ...row });
  }

  // 13. Maintenance Requests
  if (path === "/api/db/maintenance/sync-order" && request.method === "POST") {
    const orderNumber = String(body.orderNumber || "").trim();
    const orderStatus = String(body.orderStatus || "").trim();
    let maintenanceStatus: string | null = null;
    if (orderStatus === "تم_الارسال") maintenanceStatus = "in_repair";
    else if (orderStatus === "جاري_المراجعة" || orderStatus === "سحب_للصيانة") maintenanceStatus = "received";
    else if (orderStatus === "تم_توصيلها") maintenanceStatus = "delivered";

    if (orderNumber && maintenanceStatus) {
      const rows = await db.prepare("SELECT id, data_json FROM maintenance_requests WHERE order_number = ?").bind(orderNumber).all<any>();
      const stmts: D1LikePreparedStatement[] = [];
      const now = new Date().toISOString();
      for (const r of rows.results || []) {
        const d = safeJsonParse<any>(r.data_json, {});
        d.status = maintenanceStatus;
        d.updatedAt = now;
        stmts.push(
          db.prepare("UPDATE maintenance_requests SET status = ?, updated_at = ?, data_json = ? WHERE id = ?").bind(maintenanceStatus, now, JSON.stringify(d), r.id)
        );
      }
      if (stmts.length > 0) await db.batch(stmts);
    }
    return json(request, env, { success: true });
  }

  if (path === "/api/db/maintenance" && request.method === "GET") {
    const storeId = String(url.searchParams.get("storeId") || "");
    const res = await db
      .prepare("SELECT id, data_json FROM maintenance_requests WHERE store_id = ? ORDER BY received_date DESC")
      .bind(storeId)
      .all<any>();
    const requests = (res.results || []).map((r: any) => ({ id: r.id, ...safeJsonParse(r.data_json, {}) }));
    return json(request, env, { success: true, requests });
  }

  if (path === "/api/db/maintenance" && request.method === "POST") {
    const reqData = body.request || body;
    const id = String(reqData.id || `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const storeId = String(reqData.storeId || body.storeId || "main_store");
    const now = new Date().toISOString();
    const payload = { ...reqData, id, storeId, updatedAt: now };
    await db
      .prepare(
        `INSERT INTO maintenance_requests (id, store_id, order_number, status, received_date, updated_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           order_number = excluded.order_number,
           status = excluded.status,
           received_date = excluded.received_date,
           updated_at = excluded.updated_at,
           data_json = excluded.data_json`
      )
      .bind(id, storeId, payload.orderNumber || null, payload.status || "received", payload.receivedDate || now, now, JSON.stringify(payload))
      .run();
    return json(request, env, { success: true, id, request: payload });
  }

  const mntIdMatch = path.match(/^\/api\/db\/maintenance\/([^/]+)$/);
  if (mntIdMatch) {
    const id = decodeURIComponent(mntIdMatch[1]);
    if (request.method === "PATCH" || request.method === "PUT") {
      const existingRow = await db.prepare("SELECT * FROM maintenance_requests WHERE id = ?").bind(id).first<any>();
      const existing = safeJsonParse<any>(existingRow?.data_json, { id });
      const updates = body.updates || body;
      const merged = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
      await db
        .prepare(
          `INSERT INTO maintenance_requests (id, store_id, order_number, status, received_date, updated_at, data_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             order_number = excluded.order_number,
             status = excluded.status,
             received_date = excluded.received_date,
             updated_at = excluded.updated_at,
             data_json = excluded.data_json`
        )
        .bind(
          id,
          merged.storeId || existingRow?.store_id || "main_store",
          merged.orderNumber || existingRow?.order_number || null,
          merged.status || existingRow?.status || "received",
          merged.receivedDate || existingRow?.received_date || merged.updatedAt,
          merged.updatedAt,
          JSON.stringify(merged)
        )
        .run();
      return json(request, env, { success: true, request: merged });
    }
    if (request.method === "DELETE") {
      await db.prepare("DELETE FROM maintenance_requests WHERE id = ?").bind(id).run();
      return json(request, env, { success: true });
    }
  }

  // 14. WhatsApp Conversations, Messages & Webhook Logs
  const waMatch = path.match(/^\/api\/db\/whatsapp\/([^/]+)(?:\/(conversations|messages|webhook-logs))?$/);
  if (waMatch) {
    const storeId = decodeURIComponent(waMatch[1]);
    const resource = waMatch[2] || "messages";

    if (resource === "conversations") {
      if (request.method === "GET") {
        const orderId = url.searchParams.get("orderId");
        const phone = url.searchParams.get("phone");
        let rows: any[] = [];
        if (orderId) {
          const res = await db.prepare("SELECT data_json FROM whatsapp_conversations WHERE store_id = ? AND order_id = ? LIMIT 10").bind(storeId, orderId).all<any>();
          rows = res.results || [];
        } else if (phone) {
          const res = await db.prepare("SELECT data_json FROM whatsapp_conversations WHERE store_id = ? AND customer_phone LIKE ? LIMIT 10").bind(storeId, `%${phone.replace(/\D/g, "").slice(-9)}%`).all<any>();
          rows = res.results || [];
        } else {
          const res = await db.prepare("SELECT data_json FROM whatsapp_conversations WHERE store_id = ? ORDER BY last_message_at DESC LIMIT 100").bind(storeId).all<any>();
          rows = res.results || [];
        }
        return json(request, env, { success: true, conversations: rows.map((r) => safeJsonParse(r.data_json, null)).filter(Boolean) });
      }
      if (request.method === "POST" || request.method === "PUT") {
        const conv = body.conversation || body;
        const id = String(conv.id || `waconv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const now = new Date().toISOString();
        const payload = { ...conv, id, store_id: storeId, storeId, updated_at: now };
        await db
          .prepare(
            `INSERT INTO whatsapp_conversations (id, store_id, order_id, customer_phone, last_message_at, status, updated_at, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               order_id = excluded.order_id,
               customer_phone = excluded.customer_phone,
               last_message_at = excluded.last_message_at,
               status = excluded.status,
               updated_at = excluded.updated_at,
               data_json = excluded.data_json`
          )
          .bind(
            id,
            storeId,
            payload.order_id || payload.orderId || null,
            payload.customer_phone || payload.customerPhone || null,
            payload.last_message_at || payload.lastMessageAt || now,
            payload.status || "open",
            now,
            JSON.stringify(payload)
          )
          .run();
        return json(request, env, { success: true, conversation: payload });
      }
    }

    if (resource === "messages") {
      if (request.method === "GET") {
        const conversationId = url.searchParams.get("conversationId");
        const orderId = url.searchParams.get("orderId");
        let rows: any[] = [];
        if (conversationId) {
          const res = await db.prepare("SELECT data_json FROM whatsapp_messages WHERE conversation_id = ? ORDER BY occurred_at ASC").bind(conversationId).all<any>();
          rows = res.results || [];
        } else if (orderId) {
          const res = await db.prepare("SELECT data_json FROM whatsapp_messages WHERE store_id = ? AND order_id = ? ORDER BY occurred_at ASC").bind(storeId, orderId).all<any>();
          rows = res.results || [];
        } else {
          const res = await db.prepare("SELECT data_json FROM whatsapp_messages WHERE store_id = ? ORDER BY occurred_at DESC LIMIT 200").bind(storeId).all<any>();
          rows = res.results || [];
        }
        return json(request, env, { success: true, messages: rows.map((r) => safeJsonParse(r.data_json, null)).filter(Boolean) });
      }
      if (request.method === "POST") {
        const msg = body.message || body;
        const id = String(msg.id || `wamsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const now = msg.occurred_at || new Date().toISOString();
        const convId = String(msg.conversation_id || msg.conversationId || `waconv_${storeId}_${msg.order_id || msg.orderId || "general"}`);
        const payload = { ...msg, id, store_id: storeId, conversation_id: convId, occurred_at: now };
        await db
          .prepare(
            `INSERT INTO whatsapp_messages (id, store_id, conversation_id, order_id, direction, body, occurred_at, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, storeId, convId, msg.order_id || msg.orderId || null, msg.direction || "outbound", msg.body || "", now, JSON.stringify(payload))
          .run();
        return json(request, env, { success: true, message: payload });
      }
    }

    if (resource === "webhook-logs") {
      if (request.method === "GET") {
        const res = await db
          .prepare("SELECT data_json FROM webhook_logs WHERE store_id = ? ORDER BY occurred_at DESC LIMIT 200")
          .bind(storeId)
          .all<any>();
        return json(request, env, { success: true, logs: (res.results || []).map((r: any) => safeJsonParse(r.data_json, null)).filter(Boolean) });
      }
      if (request.method === "POST") {
        const log = body.log || body;
        const id = String(log.id || `whlog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const now = log.occurred_at || new Date().toISOString();
        const payload = { ...log, id, store_id: storeId, occurred_at: now };
        await db
          .prepare(
            `INSERT INTO webhook_logs (id, store_id, source, event_type, success, status_code, occurred_at, data_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, storeId, log.source || "webhook", log.event_type || "event", log.success === false ? 0 : 1, Number(log.status_code || 200), now, JSON.stringify(payload))
          .run();
        return json(request, env, { success: true, log: payload });
      }
    }
  }

  // 15. Idempotency Records
  const idempMatch = path.match(/^\/api\/db\/idempotency\/([^/]+)$/);
  if (idempMatch) {
    const key = decodeURIComponent(idempMatch[1]);
    if (request.method === "GET") {
      const row = await db.prepare("SELECT result_json, expires_at FROM idempotency_records WHERE key = ?").bind(key).first<any>();
      if (!row || (row.expires_at && Date.now() > row.expires_at)) {
        return json(request, env, { success: true, found: false, result: null });
      }
      return json(request, env, { success: true, found: true, result: safeJsonParse(row.result_json, null) });
    }
    if (request.method === "PUT" || request.method === "POST") {
      const now = Date.now();
      await db
        .prepare(
          `INSERT INTO idempotency_records (key, result_json, timestamp, expires_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET result_json = excluded.result_json, timestamp = excluded.timestamp, expires_at = excluded.expires_at`
        )
        .bind(key, JSON.stringify(body.result ?? body), now, body.expiresAt || now + 24 * 60 * 60 * 1000)
        .run();
      return json(request, env, { success: true });
    }
  }

  return json(request, env, { success: false, error: `مسار قاعدة البيانات غير معروف: ${path}` }, 404);
}
