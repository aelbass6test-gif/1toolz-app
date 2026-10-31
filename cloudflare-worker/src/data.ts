import { getAuthContext, type AuthEnv } from "./auth";

export interface DataStatement {
  bind(...values: unknown[]): DataStatement;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}

export interface DataDatabase {
  prepare(sql: string): DataStatement;
}

export interface DataEnv extends AuthEnv {
  APP_DB?: DataDatabase;
}

type JsonResponder = (request: Request, env: unknown, body: unknown, status?: number) => Response;

const TABLE_NAME_RE = /^[a-z][a-z0-9_]{1,62}$/;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

const READ_ONLY_TABLES = new Set([
  "users",
  "store_memberships",
  "user_profiles",
  "merchant_requests",
  "partner_requests",
  "withdrawal_requests",
  "transactions",
  "treasury_accounts",
  "treasury_transactions",
  "cash_holders",
  "cash_handovers",
  "customer_transactions",
  "supplier_transactions",
  "partner_transactions",
  "moneyhash_payments",
  "moneyhash_webhook_events",
  "integration_secret_inventory",
  "webhook_logs",
  "presence"
]);

const NEVER_GENERIC_TABLES = new Set([
  "auth_identities",
  "auth_credentials",
  "auth_sessions",
  "auth_recovery_tokens",
  "store_memberships",
  "integration_secret_inventory",
  "moneyhash_webhook_events"
]);

const FINANCE_TABLES = new Set([
  "transactions",
  "merchant_requests",
  "partner_requests",
  "withdrawal_requests",
  "treasury_accounts",
  "treasury_transactions",
  "cash_holders",
  "cash_handovers",
  "customer_transactions",
  "supplier_transactions",
  "partner_transactions",
  "moneyhash_payments",
  "pos_sales"
]);

function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function safeIdentifier(value: string): boolean {
  return TABLE_NAME_RE.test(value);
}

function stripSensitive(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(item => stripSensitive(item, depth + 1));
  if (typeof value !== "object") return value;

  const blocked = /^(password|passcode|secret|token|api[_-]?key|authorization|credentials?|private[_-]?key|service[_-]?role|smtp[_-]?pass|webhook[_-]?secret|otp|code_hash)$/i;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (blocked.test(key)) continue;
    output[key] = stripSensitive(nested, depth + 1);
  }
  return output;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), item => item.toString(16).padStart(2, "0")).join("");
}

function toSafeKey(record: Record<string, unknown>): string {
  const candidate = record.id ?? record.phone ?? record.code ?? record.slug;
  const key = typeof candidate === "string" || typeof candidate === "number" ? String(candidate).trim() : "";
  if (!key || key.length > 240) throw new Error("record_key_required");
  return key;
}

function canReadFinance(role: string, permissions: string[]): boolean {
  return role === "owner" || role === "manager" ||
    permissions.includes("*") ||
    permissions.includes("finance.read") ||
    permissions.includes("treasury.read");
}

function canWriteTable(
  role: string,
  permissions: string[],
  table: string,
  action: "insert" | "update" | "delete"
): boolean {
  if (role === "owner" || role === "manager") return true;
  if (role !== "staff") return false;
  return permissions.includes("*") ||
    permissions.includes(`${table}.${action}`) ||
    permissions.includes(`${table}.write`);
}

async function authorizedStoreContext(
  request: Request,
  env: DataEnv,
  storeId: string
): Promise<{ role: string; permissions: string[] } | null> {
  const context = await getAuthContext(request, env);
  if (!context) return null;
  const membership = context.memberships.find(item => item.store_id === storeId);
  if (!membership) return null;
  return { role: membership.role, permissions: membership.permissions };
}

async function tableIsRegistered(db: DataDatabase, table: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 AS available
    FROM app_table_registry
    WHERE source_system = 'supabase'
      AND source_table = ?
      AND migration_status IN ('copied', 'verified')
    LIMIT 1
  `).bind(table).first<{ available: number }>();
  return Boolean(row);
}

async function listStoreRecords(
  db: DataDatabase,
  table: string,
  storeId: string,
  limit: number,
  cursor: string | null
): Promise<Array<{ record_key: string; record_json: string; source_system: string }>> {
  const cursorFilter = cursor ? "AND record_key > ?" : "";
  const params: unknown[] = [table, storeId];
  if (cursor) params.push(cursor);
  params.push(limit + 1);

  const result = await db.prepare(`
    SELECT record_key, record_json, source_system
    FROM (
      SELECT record_key, record_json, source_system,
        ROW_NUMBER() OVER (
          PARTITION BY record_key
          ORDER BY CASE source_system WHEN 'manual' THEN 1 ELSE 0 END DESC, migrated_at DESC
        ) AS version_rank
      FROM app_records
      WHERE source_table = ?
        AND store_id = ?
        ${cursorFilter}
    )
    WHERE version_rank = 1
    ORDER BY record_key
    LIMIT ?
  `).bind(...params).all<{ record_key: string; record_json: string; source_system: string }>();

  return result.results || [];
}

async function writeRecord(
  db: DataDatabase,
  table: string,
  storeId: string,
  actorId: string,
  record: Record<string, unknown>,
  action: "insert" | "update" | "delete"
): Promise<{ recordKey: string; data: unknown }> {
  const recordKey = toSafeKey(record);
  const cleanRecord = stripSensitive({
    ...record,
    id: record.id ?? recordKey,
    store_id: storeId,
    storeId
  }) as Record<string, unknown>;
  if (action === "delete") cleanRecord._deleted = true;
  const recordJson = JSON.stringify(cleanRecord);
  const digest = await sha256(recordJson);

  const upsert = await db.prepare(`
    INSERT INTO app_records (
      source_system, source_table, record_key, store_id,
      record_json, record_sha256, source_updated_at, migrated_at
    ) VALUES ('manual', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(source_system, source_table, record_key) DO UPDATE SET
      store_id = excluded.store_id,
      record_json = excluded.record_json,
      record_sha256 = excluded.record_sha256,
      source_updated_at = CURRENT_TIMESTAMP,
      migrated_at = CURRENT_TIMESTAMP
  `).bind(table, recordKey, storeId, recordJson, digest).run();

  if (upsert.success === false) throw new Error("record_write_failed");

  await db.prepare(`
    INSERT INTO migration_audit (
      id, source_system, source_table, record_key, action, detail_json, created_at
    ) VALUES (?, 'manual', ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).bind(
    crypto.randomUUID(),
    table,
    recordKey,
    action === "delete" ? "skipped" : "copied",
    JSON.stringify({ actorId, storeId, payloadSha256: digest })
  ).run();

  return { recordKey, data: cleanRecord };
}

export async function handleDataRequest(
  request: Request,
  env: DataEnv,
  _jsonResponse: JsonResponder
): Promise<Response> {
  if (!env.APP_DB) return json({ success: false, error: "قاعدة البيانات غير مهيأة." }, 503);
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[0] !== "api" || parts[1] !== "v1" || parts[2] !== "data") {
    return json({ success: false, error: "مسار البيانات غير موجود." }, 404);
  }

  const table = parts[3];
  if (!safeIdentifier(table) || NEVER_GENERIC_TABLES.has(table)) {
    return json({ success: false, error: "هذا الجدول لا يدعم الوصول العام عبر واجهة البيانات." }, 403);
  }
  if (!await tableIsRegistered(env.APP_DB, table)) {
    return json({ success: false, error: "هذا القسم لم يكتمل ترحيله بعد." }, 409);
  }

  const storeId = (url.searchParams.get("storeId") || request.headers.get("x-store-id") || "").trim();
  if (!storeId || storeId.length > 160) {
    return json({ success: false, error: "معرّف المتجر مطلوب." }, 400);
  }
  const access = await authorizedStoreContext(request, env, storeId);
  if (!access) return json({ success: false, error: "غير مصرح بالوصول إلى بيانات هذا المتجر." }, 403);

  if (FINANCE_TABLES.has(table) && !canReadFinance(access.role, access.permissions)) {
    return json({ success: false, error: "لا تملك صلاحية عرض البيانات المالية." }, 403);
  }

  if (request.method === "GET") {
    const requestedId = parts[4] || url.searchParams.get("id");
    if (requestedId) {
      const row = await env.APP_DB.prepare(`
        SELECT record_key, record_json
        FROM app_records
        WHERE source_table = ? AND store_id = ?
          AND record_key = ?
        ORDER BY CASE source_system WHEN 'manual' THEN 1 ELSE 0 END DESC, migrated_at DESC
        LIMIT 1
      `).bind(table, storeId, requestedId).first<{ record_key: string; record_json: string }>();
      if (!row) return json({ success: true, item: null });
      const parsed = JSON.parse(row.record_json) as Record<string, unknown>;
      return json({ success: true, item: parsed._deleted === true ? null : stripSensitive(parsed) });
    }

    const parsedLimit = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE);
    const limit = Number.isSafeInteger(parsedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, parsedLimit)) : DEFAULT_PAGE_SIZE;
    const cursor = url.searchParams.get("cursor");
    const rows = await listStoreRecords(env.APP_DB, table, storeId, limit, cursor);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).filter(row => {
      try {
        return JSON.parse(row.record_json)?._deleted !== true;
      } catch {
        return false;
      }
    });
    return json({
      success: true,
      items: page.map(row => {
        try { return stripSensitive(JSON.parse(row.record_json)); } catch { return null; }
      }).filter(Boolean),
      nextCursor: hasMore ? rows[limit - 1]?.record_key || null : null
    });
  }

  if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
    if (READ_ONLY_TABLES.has(table)) {
      return json({ success: false, error: "هذا القسم يحتاج إلى عملية مالية/إدارية متخصصة." }, 403);
    }
    const body = request.method === "DELETE"
      ? {}
      : await request.json().catch(() => null) as Record<string, unknown> | null;
    if (request.method !== "DELETE" && (!body || typeof body !== "object" || Array.isArray(body))) {
      return json({ success: false, error: "بيانات السجل غير صالحة." }, 400);
    }
    if (!canWriteTable(access.role, access.permissions, table, request.method === "POST" ? "insert" : request.method === "PUT" ? "update" : "delete")) {
      return json({ success: false, error: "لا تملك صلاحية تعديل هذا القسم." }, 403);
    }

    let record: Record<string, unknown>;
    if (request.method === "DELETE") {
      const recordId = parts[4] || url.searchParams.get("id") || "";
      if (!recordId) return json({ success: false, error: "رقم السجل مطلوب للحذف." }, 400);
      const existing = await env.APP_DB.prepare(`
        SELECT record_json FROM app_records
        WHERE source_table = ? AND store_id = ? AND record_key = ?
        ORDER BY CASE source_system WHEN 'manual' THEN 1 ELSE 0 END DESC, migrated_at DESC
        LIMIT 1
      `).bind(table, storeId, recordId).first<{ record_json: string }>();
      if (!existing) return json({ success: false, error: "السجل غير موجود." }, 404);
      record = JSON.parse(existing.record_json);
      record.id = recordId;
    } else {
      record = body!;
      const requestedStore = String(record.store_id ?? record.storeId ?? storeId);
      if (requestedStore !== storeId) return json({ success: false, error: "لا يمكن نقل سجل إلى متجر آخر." }, 403);
      record.store_id = storeId;
      record.storeId = storeId;
    }

    try {
      const result = await writeRecord(
        env.APP_DB, table, storeId, (await getAuthContext(request, env))!.identityId,
        record,
        request.method === "POST" ? "insert" : request.method === "PUT" ? "update" : "delete"
      );
      return json({ success: true, item: result.data, id: result.recordKey }, request.method === "POST" ? 201 : 200);
    } catch (error) {
      console.error("[D1-DATA] Store-scoped record write failed:", error instanceof Error ? error.name : "unknown");
      return json({ success: false, error: "تعذر حفظ السجل. حاول مرة أخرى." }, 500);
    }
  }

  return json({ success: false, error: "طريقة الطلب غير مدعومة." }, 405, {
    allow: "GET,POST,PUT,DELETE"
  });
}
