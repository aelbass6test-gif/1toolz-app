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

type Filter = { field: string; op: string; value?: unknown };
const TABLE_NAME_RE = /^[a-z][a-z0-9_]{1,62}$/;
const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const MAX_PAGE_SIZE = 200;
const MAX_WRITE_ROWS = 100;
const DEFAULT_PAGE_SIZE = 50;

const READ_ONLY_TABLES = new Set([
  "users", "store_memberships", "user_profiles", "merchant_requests",
  "partner_requests", "withdrawal_requests", "transactions",
  "treasury_accounts", "treasury_transactions", "cash_holders",
  "cash_handovers", "customer_transactions", "supplier_transactions",
  "partner_transactions", "moneyhash_payments", "moneyhash_webhook_events",
  "integration_secret_inventory", "webhook_logs", "presence"
]);
const NEVER_GENERIC_TABLES = new Set([
  "auth_identities", "auth_credentials", "auth_sessions",
  "auth_recovery_tokens", "store_memberships", "integration_secret_inventory",
  "moneyhash_webhook_events"
]);
const FINANCE_TABLES = new Set([
  "transactions", "merchant_requests", "partner_requests", "withdrawal_requests",
  "treasury_accounts", "treasury_transactions", "cash_holders", "cash_handovers",
  "customer_transactions", "supplier_transactions", "partner_transactions",
  "moneyhash_payments", "pos_sales"
]);
const GLOBAL_ADMIN_TABLES = new Set(["users", "global_options"]);
const PUBLIC_READ_TABLES = new Set(["public_storefronts"]);

function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function stripSensitive(value: unknown, depth = 0): unknown {
  if (depth > 12 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(item => stripSensitive(item, depth + 1));
  if (typeof value !== "object") return value;
  const blocked = /^(password|passcode|secret|token|api[_-]?key|authorization|credentials?|private[_-]?key|service[_-]?role|smtp[_-]?pass|webhook[_-]?secret|otp|code_hash)$/i;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (!blocked.test(key)) output[key] = stripSensitive(nested, depth + 1);
  }
  return output;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), item => item.toString(16).padStart(2, "0")).join("");
}

function toSafeKey(record: Record<string, unknown>): string {
  const value = record.id ?? record.phone ?? record.code ?? record.slug;
  const key = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!key || key.length > 240) throw new Error("record_key_required");
  return key;
}

function canReadFinance(role: string, permissions: string[], isAdmin: boolean): boolean {
  return isAdmin || role === "owner" || role === "manager" ||
    permissions.includes("*") || permissions.includes("finance.read") ||
    permissions.includes("treasury.read");
}
function canWriteTable(role: string, permissions: string[], table: string, action: string, isAdmin: boolean): boolean {
  if (isAdmin || role === "owner" || role === "manager") return true;
  if (role !== "staff") return false;
  return permissions.includes("*") || permissions.includes(`${table}.${action}`) ||
    permissions.includes(`${table}.write`);
}
async function tableIsRegistered(db: DataDatabase, table: string): Promise<boolean> {
  const row = await db.prepare(`
    SELECT 1 AS available FROM app_table_registry
    WHERE source_system='supabase' AND source_table=?
      AND migration_status IN ('copied','verified') LIMIT 1
  `).bind(table).first<{ available: number }>();
  return Boolean(row);
}

function parseFilters(url: URL): Filter[] {
  const raw = url.searchParams.get("filters");
  if (!raw) return [];
  let list: unknown;
  try { list = JSON.parse(raw); } catch { throw new Error("invalid_filters"); }
  if (!Array.isArray(list) || list.length > 20) throw new Error("invalid_filters");
  return list.map(item => {
    if (!item || typeof item !== "object") throw new Error("invalid_filter");
    const value = item as Record<string, unknown>;
    const field = String(value.field || "");
    const op = String(value.op || "eq").toLowerCase();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}(?:->>[A-Za-z_][A-Za-z0-9_]{0,62})?$/.test(field) ||
        !["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"].includes(op)) {
      throw new Error("unsupported_filter");
    }
    if (op === "in" && (!Array.isArray(value.value) || value.value.length > 100)) throw new Error("invalid_in_filter");
    return { field, op, value: value.value };
  });
}

function parseOrFilters(url: URL): Filter[][] {
  const raw = url.searchParams.get("orFilters");
  if (!raw) return [];
  let groups: unknown;
  try { groups = JSON.parse(raw); } catch { throw new Error("invalid_or_filters"); }
  if (!Array.isArray(groups) || groups.length > 10) throw new Error("invalid_or_filters");
  return groups.map(group => {
    if (!Array.isArray(group) || group.length === 0 || group.length > 20) throw new Error("invalid_or_filter_group");
    return group.map(item => {
      if (!item || typeof item !== "object") throw new Error("invalid_or_filter");
      const value = item as Record<string, unknown>;
      const field = String(value.field || "");
      const op = String(value.op || "eq").toLowerCase();
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}(?:->>[A-Za-z_][A-Za-z0-9_]{0,62})?$/.test(field) ||
          !["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"].includes(op)) {
        throw new Error("unsupported_or_filter");
      }
      return { field, op, value: value.value };
    });
  });
}

function filterSql(filter: Filter, params: unknown[]): string {
  const field = filter.field;
  const pathParts = field.split("->>");
  const jsonPath = "$" + pathParts.map(part => `."${part}"`).join("");
  const expression = field === "store_id"
    ? "store_id"
    : field === "storeId" || field === "storeid"
      ? "COALESCE(json_extract(record_json, '$.storeId'), json_extract(record_json, '$.storeid'), store_id)"
      : `json_extract(record_json, '${jsonPath}')`;
  if (filter.op === "in") {
    const values = filter.value as unknown[];
    if (!values.length) return "1=0";
    params.push(...values);
    return `${expression} IN (${values.map(() => "?").join(",")})`;
  }
  if (filter.op === "is" && filter.value === null) return `${expression} IS NULL`;
  if (filter.op === "is" && filter.value === true) return `${expression} = 1`;
  if (filter.op === "is" && filter.value === false) return `(${expression} = 0 OR ${expression} IS NULL)`;
  const operators: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "LIKE" };
  params.push(filter.op === "ilike" ? String(filter.value ?? "").toLowerCase() : (filter.value ?? null));
  return filter.op === "ilike" ? `lower(CAST(${expression} AS TEXT)) LIKE ?` : `${expression} ${operators[filter.op]} ?`;
}

async function listRecords(
  db: DataDatabase,
  table: string,
  storeId: string | null,
  filters: Filter[],
  orGroups: Filter[][],
  limit: number,
  offset: number,
  orderBy: string,
  ascending: boolean,
  cursor: string | null
): Promise<Array<{ record_key: string; record_json: string; source_system: string }>> {
  const params: unknown[] = [table];
  let baseWhere = "source_table = ?";
  if (storeId !== null) {
    baseWhere += " AND store_id = ?";
    params.push(storeId);
  }
  if (cursor) {
    baseWhere += " AND record_key > ?";
    params.push(cursor);
  }
  const filterWhere = filters.map(filter => filterSql(filter, params));
  const orWhere = orGroups.map(group => `(${group.map(filter => filterSql(filter, params)).join(" OR ")})`);
  const orderExpr = orderBy === "record_key"
    ? "record_key"
    : orderBy === "store_id" ? "store_id" : `json_extract(record_json, '$."${orderBy}"')`;
  params.push(limit + 1, offset);

  const result = await db.prepare(`
    WITH ranked AS (
      SELECT record_key, record_json, source_system, migrated_at,
        ROW_NUMBER() OVER (
          PARTITION BY record_key
          ORDER BY CASE source_system WHEN 'manual' THEN 1 ELSE 0 END DESC, migrated_at DESC
        ) AS version_rank
      FROM app_records WHERE ${baseWhere}
    )
    SELECT record_key, record_json, source_system
    FROM ranked
    WHERE version_rank = 1
      ${filterWhere.length ? "AND " + filterWhere.join(" AND ") : ""}
      ${orWhere.length ? "AND (" + orWhere.join(" OR ") + ")" : ""}
    ORDER BY ${orderExpr} ${ascending ? "ASC" : "DESC"}, record_key ASC
    LIMIT ? OFFSET ?
  `).bind(...params).all<{ record_key: string; record_json: string; source_system: string }>();
  return result.results || [];
}

function projectRecord(record: Record<string, unknown>, columns: string): unknown {
  if (!columns || columns.trim() === "*") return stripSensitive(record);
  const keys = columns.split(",").map(item => item.trim()).filter(key => FIELD_NAME_RE.test(key));
  const projected: Record<string, unknown> = {};
  for (const key of keys) if (key in record) projected[key] = record[key];
  return stripSensitive(projected);
}

async function writeRecord(
  db: DataDatabase,
  table: string,
  storeId: string,
  actorId: string,
  record: Record<string, unknown>,
  action: "insert" | "update" | "delete",
  allowUpsert = false
): Promise<{ recordKey: string; data: unknown }> {
  const recordKey = toSafeKey(record);
  const current = await db.prepare(`
    SELECT record_json FROM app_records
    WHERE source_table = ? AND store_id = ? AND record_key = ?
    ORDER BY CASE source_system WHEN 'manual' THEN 1 ELSE 0 END DESC, migrated_at DESC
    LIMIT 1
  `).bind(table, storeId, recordKey).first<{ record_json: string }>();

  if (action === "insert" && current && !allowUpsert) throw new Error("duplicate_record");
  if (action === "update" && !current) throw new Error("record_not_found");

  let merged = record;
  if (action === "update" && current) {
    const existing = JSON.parse(current.record_json) as Record<string, unknown>;
    merged = { ...existing, ...record };
  }
  const cleanRecord = stripSensitive({
    ...merged,
    id: merged.id ?? recordKey,
    store_id: storeId,
    storeId
  }) as Record<string, unknown>;
  if (action === "delete") cleanRecord._deleted = true;
  const recordJson = JSON.stringify(cleanRecord);
  const digest = await sha256(recordJson);

  const upsert = await db.prepare(`
    INSERT INTO app_records (
      source_system, source_table, record_key, store_id, record_json,
      record_sha256, source_updated_at, migrated_at
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
    crypto.randomUUID(), table, recordKey, action === "delete" ? "skipped" : "copied",
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
  if (!TABLE_NAME_RE.test(table) || NEVER_GENERIC_TABLES.has(table)) {
    return json({ success: false, error: "هذا الجدول لا يدعم الوصول العام عبر واجهة البيانات." }, 403);
  }
  if (!await tableIsRegistered(env.APP_DB, table)) {
    return json({ success: false, error: "هذا القسم لم يكتمل ترحيله بعد." }, 409);
  }

  const requestedStore = (url.searchParams.get("storeId") || request.headers.get("x-store-id") || "").trim();
  const isPublicRead = request.method === "GET" && PUBLIC_READ_TABLES.has(table);
  const isAdminTable = GLOBAL_ADMIN_TABLES.has(table);
  let context = null as Awaited<ReturnType<typeof getAuthContext>>;
  let access = { role: "viewer", permissions: [] as string[], isAdmin: false };

  if (!isPublicRead || request.method !== "GET") {
    context = await getAuthContext(request, env);
    if (!context) return json({ success: false, error: "غير مسجل الدخول." }, 401);
  }

  let storeId: string | null = requestedStore || null;
  if (isPublicRead && !storeId) {
    // Public storefront lookup is read-only. Sensitive keys are stripped before return.
  } else if (isAdminTable) {
    if (!context?.isPlatformAdmin) return json({ success: false, error: "يتطلب هذا القسم صلاحية مدير المنصة." }, 403);
    storeId = null;
    access = { role: "owner", permissions: ["*"], isAdmin: true };
  } else {
    if (!storeId || storeId.length > 160) return json({ success: false, error: "معرّف المتجر مطلوب." }, 400);
    const membership = context?.memberships.find(item => item.store_id === storeId);
    if (!membership && !context?.isPlatformAdmin) {
      return json({ success: false, error: "غير مصرح بالوصول إلى بيانات هذا المتجر." }, 403);
    }
    access = membership
      ? { role: membership.role, permissions: membership.permissions, isAdmin: Boolean(context?.isPlatformAdmin) }
      : { role: "owner", permissions: ["*"], isAdmin: true };
  }

  if (FINANCE_TABLES.has(table) && !canReadFinance(access.role, access.permissions, access.isAdmin)) {
    return json({ success: false, error: "لا تملك صلاحية عرض البيانات المالية." }, 403);
  }

  if (request.method === "GET") {
    let filters: Filter[];
    let orGroups: Filter[][];
    try { filters = parseFilters(url); orGroups = parseOrFilters(url); } catch {
      return json({ success: false, error: "فلاتر البحث غير صالحة." }, 400);
    }
    const requestedId = parts[4] || url.searchParams.get("id");
    if (requestedId) filters.push({ field: "id", op: "eq", value: requestedId });

    const parsedLimit = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE);
    const limit = Number.isSafeInteger(parsedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, parsedLimit)) : DEFAULT_PAGE_SIZE;
    const parsedOffset = Number(url.searchParams.get("offset") || 0);
    const offset = Number.isSafeInteger(parsedOffset) ? Math.max(0, Math.min(10_000, parsedOffset)) : 0;
    const orderBy = url.searchParams.get("orderBy") || "record_key";
    if (!FIELD_NAME_RE.test(orderBy) && orderBy !== "record_key") return json({ success: false, error: "ترتيب النتائج غير صالح." }, 400);
    const ascending = url.searchParams.get("ascending") !== "false";
    const columns = url.searchParams.get("select") || "*";
    const cursor = url.searchParams.get("cursor");

    const rows = await listRecords(env.APP_DB, table, isPublicRead && !storeId ? null : storeId,
      filters, orGroups, limit, offset, orderBy, ascending, cursor);
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit).filter(row => {
      try { return JSON.parse(row.record_json)?._deleted !== true; } catch { return false; }
    });
    const items = visible.map(row => {
      try { return projectRecord(JSON.parse(row.record_json) as Record<string, unknown>, columns); } catch { return null; }
    }).filter(Boolean);

    if (url.searchParams.get("single") === "true" || url.searchParams.get("maybeSingle") === "true") {
      if (items.length > 1) return json({ success: false, error: "توجد أكثر من نتيجة واحدة." }, 406);
      if (!items.length && url.searchParams.get("single") === "true") return json({ success: false, error: "السجل غير موجود." }, 404);
      return json({ success: true, item: items[0] || null, items });
    }
    return json({
      success: true, items,
      nextCursor: hasMore ? rows[limit - 1]?.record_key || null : null,
      count: items.length
    });
  }

  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH" || request.method === "DELETE") {
    if (!storeId || !context) return json({ success: false, error: "هذا الإجراء يتطلب متجرًا وجلسة موثقة." }, 400);
    if (READ_ONLY_TABLES.has(table)) return json({ success: false, error: "هذا القسم يحتاج إلى عملية مالية/إدارية متخصصة." }, 403);
    const action = request.method === "POST" ? "insert" : request.method === "DELETE" ? "delete" : "update";
    if (!canWriteTable(access.role, access.permissions, table, action, access.isAdmin)) {
      return json({ success: false, error: "لا تملك صلاحية تعديل هذا القسم." }, 403);
    }

    let filters: Filter[];
    let orGroups: Filter[][];
    try {
      filters = parseFilters(url);
      orGroups = parseOrFilters(url);
    } catch {
      return json({ success: false, error: "فلاتر التحديث غير صالحة." }, 400);
    }
    const allowUpsert = request.headers.get("x-d1-upsert") === "true";
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      const records = Array.isArray(body) ? body : [body];
      if (!records.length || records.length > MAX_WRITE_ROWS || records.some(record => !record || typeof record !== "object" || Array.isArray(record))) {
        return json({ success: false, error: "بيانات السجل غير صالحة أو تتجاوز الحد المسموح." }, 400);
      }
      try {
        const items = [];
        for (const record of records as Array<Record<string, unknown>>) {
          const targetStore = String(record.store_id ?? record.storeId ?? storeId);
          if (targetStore !== storeId) return json({ success: false, error: "لا يمكن نقل سجل إلى متجر آخر." }, 403);
          const result = await writeRecord(env.APP_DB, table, storeId, context.identityId, record, "insert", allowUpsert);
          items.push(result.data);
        }
        return json({ success: true, items, count: items.length }, 201);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        return json({ success: false, error: code === "duplicate_record" ? "السجل موجود بالفعل." : "تعذر حفظ السجل." }, code === "duplicate_record" ? 409 : 500);
      }
    }

    const selected = await listRecords(env.APP_DB, table, storeId, filters, orGroups, MAX_WRITE_ROWS + 1, 0, "record_key", true, null);
    if (selected.length > MAX_WRITE_ROWS) return json({ success: false, error: "حدّث عددًا أقل من السجلات في كل طلب." }, 413);
    let updateBody: Record<string, unknown> = {};
    if (request.method !== "DELETE") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ success: false, error: "بيانات التعديل غير صالحة." }, 400);
      updateBody = body as Record<string, unknown>;
    }
    try {
      const items = [];
      for (const row of selected) {
        const current = JSON.parse(row.record_json) as Record<string, unknown>;
        const merged = request.method === "DELETE" ? current : { ...current, ...updateBody };
        const result = await writeRecord(env.APP_DB, table, storeId, context.identityId, merged, action);
        items.push(result.data);
      }
      return json({ success: true, items, count: items.length });
    } catch {
      return json({ success: false, error: "تعذر حفظ التعديلات." }, 500);
    }
  }

  return json({ success: false, error: "طريقة الطلب غير مدعومة." }, 405, { allow: "GET,POST,PUT,PATCH,DELETE" });
}
