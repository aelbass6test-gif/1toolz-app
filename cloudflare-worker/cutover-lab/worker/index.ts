import { handleOtpRequest } from "../../src/otp";
import {
  getMerchantWalletSnapshot,
  submitMerchantWithdrawal,
  transitionMerchantWithdrawal,
  type D1DatabaseLike as WalletD1DatabaseLike,
  type D1StatementLike as WalletD1StatementLike,
  type SubmitWithdrawalInput
} from "../../wallet-lab/merchant-wallet-ledger";

interface D1MetaLike {
  changes?: number;
  rows_read?: number;
  rows_written?: number;
}

interface D1RunResultLike {
  success?: boolean;
  meta?: D1MetaLike;
}

interface D1AllResultLike<T> {
  success: boolean;
  results: T[];
  meta?: D1MetaLike;
}

interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1AllResultLike<T>>;
  run(): Promise<D1RunResultLike>;
}

interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<D1RunResultLike[]>;
}

interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob,
    options?: {
      httpMetadata?: Record<string, string>;
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size?: number } | null>;
}

interface Env {
  CORE_DB: D1DatabaseLike;
  OTP_DB: D1DatabaseLike;
  BACKUPS: R2BucketLike;
  APP_ORIGIN?: string;
  APP_ENV?: string;
  OTP_HASH_SECRET?: string;
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
  OTP_FROM_NAME?: string;
  OTP_RESEND_FROM?: string;
  OTP_BREVO_FROM?: string;
  OTP_RESEND_DAILY_LIMIT?: string;
  OTP_BREVO_DAILY_LIMIT?: string;
  MAIL_FROM?: string;
  PLATFORM_BOOTSTRAP_TOKEN?: string;
  BACKUP_ENCRYPTION_KEY?: string;
}

interface AuthIdentity {
  id: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  account_status: string;
  verified_at: string | null;
}

interface SessionIdentity extends AuthIdentity {
  session_id: string;
}

interface MembershipRow {
  store_id: string;
  role: string;
  permissions_json: string;
  status: string;
}

interface StoreRecordRow {
  record_key: string;
  record_json: string;
  source_updated_at: string | null;
  migrated_at: string;
}

interface InvitationRow {
  invitation_id: string;
  store_id: string;
  intended_email: string;
  role: string;
  permissions_json: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

interface StoreClaimRow {
  store_id: string;
  source_record_key: string;
  status: string;
}

interface MembershipClaimRow {
  claim_id: string;
  store_id: string;
  legacy_user_key: string;
  legacy_role: string;
  status: string;
}

interface JsonObject {
  [key: string]: unknown;
}

const SESSION_COOKIE = "__Host-1toolz_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_JSON_BODY_BYTES = 16 * 1024;
const MAX_PAGE_SIZE = 200;

const READ_TABLES = new Set([
  "products", "orders", "customers", "employees", "transactions",
  "suppliers", "supply_orders", "reviews", "abandoned_carts",
  "activity_logs", "payment_methods", "global_options", "shipping_integrations",
  "partners", "partner_transactions", "warehouses", "inventory_audits",
  "stock_transfers", "order_returns", "purchase_returns", "pos_sales",
  "cash_holders", "cash_handovers", "whatsapp_templates",
  "whatsapp_conversations", "whatsapp_messages", "quotations",
  "custom_pages", "collections", "merchant_requests", "partner_requests",
  "shared_audits", "maintenance_requests", "treasury_accounts",
  "treasury_transactions", "supplier_transactions", "customer_transactions",
  "presence"
]);

const FINANCE_TABLES = new Set([
  "transactions", "merchant_requests", "partner_requests", "partner_transactions",
  "supplier_transactions", "customer_transactions", "treasury_accounts",
  "treasury_transactions", "cash_holders", "cash_handovers", "pos_sales"
]);

function originAllowed(origin: string, env: Env): boolean {
  if (!origin) return false;
  if (env.APP_ORIGIN && origin === env.APP_ORIGIN) return true;
  if (env.APP_ENV === "lab" && (
    /^https?:\/\/localhost(?::\d+)?$/i.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)
  )) return true;
  return false;
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin"
  });
  const origin = request.headers.get("Origin") || "";
  if (originAllowed(origin, env)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  }
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type,Authorization,Idempotency-Key,X-Requested-With");
  headers.set("access-control-max-age", "600");
  return headers;
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request, env)
  });
}

function jsonWithCookie(
  request: Request,
  env: Env,
  body: unknown,
  cookie: string,
  status = 200
): Response {
  const response = json(request, env, body, status);
  const headers = new Headers(response.headers);
  headers.append("set-cookie", cookie);
  return new Response(response.body, { status: response.status, headers });
}

function cookieHeader(token: string, expiresSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${expiresSeconds}`;
}

function clearCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) {
      const value = part.slice(index + 1).trim();
      try { return decodeURIComponent(value); } catch { return null; }
    }
  }
  return null;
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}

async function constantTimeTextEqual(left: string, right: string): Promise<boolean> {
  const [leftHash, rightHash] = await Promise.all([sha256Hex(left), sha256Hex(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index++) {
    difference |= leftHash.charCodeAt(index) ^ rightHash.charCodeAt(index);
  }
  return difference === 0;
}

function cleanEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function readJson(request: Request): Promise<JsonObject | null> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_JSON_BODY_BYTES) return null;
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BODY_BYTES) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isJsonObject(value) ? value : null;
  } catch {
    return null;
  }
}

function sanitizeForClient(value: unknown, depth = 0): unknown {
  if (depth > 20) return null;
  if (Array.isArray(value)) return value.map(item => sanitizeForClient(item, depth + 1));
  if (!isJsonObject(value)) return value;

  const safe: JsonObject = {};
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (
      normalized.includes("password") ||
      normalized.includes("passcode") ||
      normalized.includes("secret") ||
      normalized.includes("token") ||
      normalized.includes("apikey") ||
      normalized.includes("privatekey") ||
      normalized.includes("credential") ||
      normalized.includes("authorization")
    ) continue;
    safe[key] = sanitizeForClient(item, depth + 1);
  }
  return safe;
}

async function validateSession(request: Request, env: Env): Promise<SessionIdentity | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token || token.length < 32 || token.length > 256) return null;
  const tokenHash = await sha256Hex(token);
  const now = new Date().toISOString();
  const identity = await env.CORE_DB.prepare(`
    SELECT
      i.id, i.email, i.phone, i.display_name, i.account_status, i.verified_at,
      s.session_id
    FROM auth_sessions s
    JOIN auth_identities i ON i.id = s.identity_id
    WHERE s.refresh_token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > ?
      AND i.account_status = 'active'
      AND i.verified_at IS NOT NULL
    LIMIT 1
  `).bind(tokenHash, now).first<SessionIdentity>();
  if (!identity) return null;

  await env.CORE_DB.prepare(
    "UPDATE auth_sessions SET last_seen_at = ? WHERE session_id = ? AND revoked_at IS NULL AND last_seen_at < ?"
  ).bind(now, identity.session_id, new Date(Date.now() - 5 * 60 * 1000).toISOString()).run();

  return identity;
}

async function getActiveMembership(
  env: Env,
  identityId: string,
  storeId: string
): Promise<MembershipRow | null> {
  return env.CORE_DB.prepare(`
    SELECT store_id, role, permissions_json, status
    FROM store_memberships
    WHERE identity_id = ? AND store_id = ? AND status = 'active'
    LIMIT 1
  `).bind(identityId, storeId).first<MembershipRow>();
}

async function getActivePlatformAdmin(env: Env, identityId: string): Promise<boolean> {
  const row = await env.CORE_DB.prepare(`
    SELECT identity_id
    FROM platform_roles
    WHERE identity_id = ? AND role = 'platform_admin' AND status = 'active'
    LIMIT 1
  `).bind(identityId).first<{ identity_id: string }>();
  return !!row;
}

async function listMemberships(env: Env, identityId: string): Promise<Array<{
  storeId: string;
  role: string;
  permissions: unknown[];
  name: string;
}>> {
  const result = await env.CORE_DB.prepare(`
    SELECT
      m.store_id,
      m.role,
      m.permissions_json,
      r.record_json
    FROM store_memberships m
    LEFT JOIN app_records r
      ON r.source_table = 'stores_data'
      AND r.record_key = m.store_id
      AND r.source_system IN ('supabase','firebase','manual')
    WHERE m.identity_id = ? AND m.status = 'active'
    ORDER BY m.created_at ASC
  `).bind(identityId).all<{
    store_id: string;
    role: string;
    permissions_json: string;
    record_json: string | null;
  }>();

  return (result.results || []).map(row => {
    let name = row.store_id;
    let permissions: unknown[] = [];
    try {
      const parsed: unknown = JSON.parse(row.permissions_json);
      if (Array.isArray(parsed)) permissions = parsed;
    } catch { /* keep empty permissions */ }
    try {
      const record: unknown = row.record_json ? JSON.parse(row.record_json) : null;
      if (isJsonObject(record) && typeof record.name === "string") name = record.name;
    } catch { /* use store id */ }
    return { storeId: row.store_id, role: row.role, permissions, name };
  });
}

async function requestOtp(request: Request, env: Env, endpoint: "send" | "verify"): Promise<Response> {
  const body = await readJson(request);
  if (!body) return json(request, env, { success: false, error: "بيانات الطلب غير صالحة أو أكبر من المسموح." }, 400);
  const email = cleanEmail(body.email);
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(request, env, { success: false, error: "البريد الإلكتروني غير صالح." }, 400);
  }

  const target = new URL(request.url);
  target.pathname = endpoint === "send" ? "/api/send-otp" : "/api/verify-otp";
  const otpBody = endpoint === "send"
    ? { email, userName: String(body.userName || "").slice(0, 100) }
    : { email, otp: String(body.otp || "") };
  const otpRequest = new Request(target.toString(), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(otpBody)
  });

  const otpResponse = await handleOtpRequest(otpRequest, env, json);
  if (endpoint === "send" || !otpResponse.ok) return otpResponse;

  const otpResult = await otpResponse.clone().json() as { valid?: boolean };
  if (otpResult.valid !== true) return otpResponse;

  const identityRows = await env.CORE_DB.prepare(`
    SELECT id, email, phone, display_name, account_status, verified_at
    FROM auth_identities
    WHERE lower(email) = ?
    ORDER BY created_at ASC
    LIMIT 2
  `).bind(email).all<AuthIdentity>();

  let identity = identityRows.results[0] || null;
  if (identityRows.results.length > 1) {
    return json(request, env, {
      success: true,
      valid: true,
      reactivationRequired: true,
      code: "IDENTITY_REVIEW_REQUIRED",
      message: "تم التحقق من البريد، لكن ربط الحساب يحتاج مراجعة الإدارة."
    }, 200);
  }

  const inviteToken = String(body.inviteToken || "").trim();
  let invitation: InvitationRow | null = null;
  if (inviteToken) {
    if (inviteToken.length < 32 || inviteToken.length > 256) {
      return json(request, env, { success: false, error: "رابط الدعوة غير صالح." }, 400);
    }
    invitation = await env.CORE_DB.prepare(`
      SELECT invitation_id, store_id, intended_email, role, permissions_json,
             expires_at, accepted_at, revoked_at
      FROM store_invitations
      WHERE token_hash = ? AND lower(intended_email) = ?
        AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > ?
      LIMIT 1
    `).bind(await sha256Hex(inviteToken), email, new Date().toISOString()).first<InvitationRow>();
    if (!invitation) {
      return json(request, env, { success: false, error: "الدعوة منتهية أو مستخدمة أو لا تخص هذا البريد." }, 403);
    }
  }

  if (!identity && !invitation) {
    return json(request, env, {
      success: true,
      valid: true,
      reactivationRequired: true,
      code: "ACCOUNT_REVIEW_REQUIRED",
      message: "تم التحقق من البريد. يلزم مراجعة الحساب أو الحصول على دعوة من مدير المتجر."
    }, 200);
  }

  if (!identity && invitation) {
    await env.CORE_DB.prepare(`
      INSERT OR IGNORE INTO auth_identities (
        id, legacy_source, legacy_user_key, email, display_name, account_status,
        password_reset_required, legacy_role_claims_json, verified_at, identity_origin
      ) VALUES (?, 'legacy_directory', ?, ?, '', 'active', 0, '{}', ?, 'native')
    `).bind(
      `native-${crypto.randomUUID()}`,
      `native:${email}`,
      email,
      new Date().toISOString()
    ).run();

    const createdIdentity = await env.CORE_DB.prepare(`
      SELECT id, email, phone, display_name, account_status, verified_at
      FROM auth_identities
      WHERE lower(email) = ? AND identity_origin = 'native'
      LIMIT 1
    `).bind(email).first<AuthIdentity>();
    if (!createdIdentity) {
      return json(request, env, { success: false, error: "تعذر إنشاء الحساب من الدعوة." }, 500);
    }
    identity = createdIdentity;
  }

  if (!identity) {
    return json(request, env, { success: false, error: "تعذر تهيئة الحساب." }, 500);
  }
  if (identity.account_status === "banned" || identity.account_status === "disabled") {
    return json(request, env, { success: false, error: "الحساب غير متاح. تواصل مع الإدارة." }, 403);
  }

  const now = new Date().toISOString();
  if (invitation) {
    const inviteHash = await sha256Hex(inviteToken);
    const results = await env.CORE_DB.batch([
      env.CORE_DB.prepare(`
        UPDATE auth_identities
        SET account_status = 'active',
            verified_at = COALESCE(verified_at, ?),
            updated_at = ?
        WHERE id = ? AND account_status IN ('pending_reactivation','active')
      `).bind(now, now, identity.id),
      env.CORE_DB.prepare(`
        INSERT INTO store_memberships (
          store_id, identity_id, role, permissions_json, status, created_at, updated_at
        )
        SELECT inv.store_id, ident.id, inv.role, inv.permissions_json, 'active', ?, ?
        FROM store_invitations inv
        JOIN auth_identities ident ON lower(ident.email) = lower(inv.intended_email)
        WHERE inv.token_hash = ? AND inv.accepted_at IS NULL
          AND inv.revoked_at IS NULL AND inv.expires_at > ?
        ON CONFLICT(store_id, identity_id) DO UPDATE SET
          role = excluded.role,
          permissions_json = excluded.permissions_json,
          status = 'active',
          updated_at = excluded.updated_at
      `).bind(now, now, inviteHash, now),
      env.CORE_DB.prepare(`
        UPDATE store_invitations
        SET accepted_at = ?, accepted_by_identity_id = ?
        WHERE token_hash = ? AND accepted_at IS NULL
          AND revoked_at IS NULL AND expires_at > ?
      `).bind(now, identity.id, inviteHash, now)
    ]);

    if ((results[1]?.meta?.changes || 0) !== 1 || (results[2]?.meta?.changes || 0) !== 1) {
      return json(request, env, { success: false, error: "تعذر قبول الدعوة؛ ربما استُخدمت بالفعل." }, 409);
    }
  } else {
    await env.CORE_DB.prepare(`
      UPDATE auth_identities
      SET account_status = 'active',
          verified_at = COALESCE(verified_at, ?),
          updated_at = ?
      WHERE id = ? AND account_status = 'pending_reactivation'
    `).bind(now, now, identity.id).run();
  }

  const sessionToken = randomToken(32);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.CORE_DB.prepare(`
    INSERT INTO auth_sessions (
      session_id, identity_id, refresh_token_hash, expires_at, last_seen_at
    ) VALUES (?, ?, ?, ?, ?)
  `).bind(sessionId, identity.id, await sha256Hex(sessionToken), expiresAt, now).run();

  const memberships = await listMemberships(env, identity.id);
  return jsonWithCookie(request, env, {
    success: true,
    valid: true,
    user: {
      id: identity.id,
      email: identity.email,
      phone: identity.phone,
      displayName: identity.display_name
    },
    stores: memberships,
    message: memberships.length
      ? "تم تسجيل الدخول بنجاح."
      : "تم التحقق من الحساب. في انتظار اعتماد صلاحية دخول المتجر."
  }, cookieHeader(sessionToken, Math.floor(SESSION_TTL_MS / 1000)));
}

async function logout(request: Request, env: Env): Promise<Response> {
  const token = getCookie(request, SESSION_COOKIE);
  if (token) {
    await env.CORE_DB.prepare(`
      UPDATE auth_sessions SET revoked_at = ?
      WHERE refresh_token_hash = ? AND revoked_at IS NULL
    `).bind(new Date().toISOString(), await sha256Hex(token)).run();
  }
  const response = json(request, env, { success: true });
  const headers = new Headers(response.headers);
  headers.append("set-cookie", clearCookieHeader());
  return new Response(response.body, { status: response.status, headers });
}

async function currentUser(request: Request, env: Env): Promise<Response> {
  const identity = await validateSession(request, env);
  if (!identity) return json(request, env, { success: false, error: "يلزم تسجيل الدخول." }, 401);
  const memberships = await listMemberships(env, identity.id);
  const isPlatformAdmin = await getActivePlatformAdmin(env, identity.id);
  return json(request, env, {
    success: true,
    user: {
      id: identity.id,
      email: identity.email,
      phone: identity.phone,
      displayName: identity.display_name
    },
    isPlatformAdmin,
    stores: memberships
  });
}

async function storesForUser(request: Request, env: Env): Promise<Response> {
  const identity = await validateSession(request, env);
  if (!identity) return json(request, env, { success: false, error: "يلزم تسجيل الدخول." }, 401);
  const stores = await listMemberships(env, identity.id);
  return json(request, env, { success: true, stores });
}

async function getStoreRecords(
  request: Request,
  env: Env,
  identity: SessionIdentity,
  storeId: string,
  table: string
): Promise<Response> {
  if (!READ_TABLES.has(table)) {
    return json(request, env, { success: false, error: "الجدول غير متاح عبر واجهة القراءة العامة." }, 404);
  }
  const membership = await getActiveMembership(env, identity.id, storeId);
  if (!membership) return json(request, env, { success: false, error: "لا تملك عضوية نشطة في هذا المتجر." }, 403);
  if (FINANCE_TABLES.has(table) && !["owner","manager"].includes(membership.role)) {
    return json(request, env, { success: false, error: "لا تملك صلاحية عرض السجلات المالية." }, 403);
  }

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") || 100);
  const requestedOffset = Number(url.searchParams.get("offset") || 0);
  const limit = Number.isFinite(requestedLimit) ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(requestedLimit))) : 100;
  const offset = Number.isFinite(requestedOffset) ? Math.min(10000, Math.max(0, Math.floor(requestedOffset))) : 0;

  const result = await env.CORE_DB.prepare(`
    SELECT record_key, record_json, source_updated_at, migrated_at
    FROM app_records
    WHERE source_table = ?
      AND source_system IN ('supabase','firebase','manual')
      AND (
        store_id = ?
        OR json_extract(record_json, '$.store_id') = ?
        OR json_extract(record_json, '$.storeId') = ?
      )
    ORDER BY COALESCE(source_updated_at, migrated_at) DESC, record_key ASC
    LIMIT ? OFFSET ?
  `).bind(table, storeId, storeId, storeId, limit, offset).all<StoreRecordRow>();

  const records = (result.results || []).map(row => {
    let parsed: unknown;
    try { parsed = JSON.parse(row.record_json); } catch { parsed = null; }
    return {
      id: row.record_key,
      data: sanitizeForClient(parsed),
      updatedAt: row.source_updated_at || row.migrated_at
    };
  });
  return json(request, env, {
    success: true,
    storeId,
    table,
    limit,
    offset,
    records
  });
}

async function getStore(request: Request, env: Env, identity: SessionIdentity, storeId: string): Promise<Response> {
  const membership = await getActiveMembership(env, identity.id, storeId);
  if (!membership) return json(request, env, { success: false, error: "لا تملك عضوية نشطة في هذا المتجر." }, 403);

  const row = await env.CORE_DB.prepare(`
    SELECT record_json, migrated_at
    FROM app_records
    WHERE source_table = 'stores_data'
      AND record_key = ?
      AND source_system IN ('supabase','firebase','manual')
    LIMIT 1
  `).bind(storeId).first<{ record_json: string; migrated_at: string }>();
  if (!row) return json(request, env, { success: false, error: "المتجر غير موجود." }, 404);

  let record: unknown;
  try { record = JSON.parse(row.record_json); } catch { record = null; }
  return json(request, env, {
    success: true,
    store: sanitizeForClient(record),
    membership: {
      role: membership.role,
      permissions: JSON.parse(membership.permissions_json)
    }
  });
}

async function migrationStatus(request: Request, env: Env, identity: SessionIdentity): Promise<Response> {
  if (!await getActivePlatformAdmin(env, identity.id)) {
    return json(request, env, { success: false, error: "صلاحية مدير المنصة مطلوبة." }, 403);
  }
  const registry = await env.CORE_DB.prepare(`
    SELECT source_system, COUNT(*) AS tables,
           SUM(COALESCE(source_rows,0)) AS source_rows,
           SUM(copied_rows) AS copied_rows,
           SUM(sanitized_rows) AS sanitized_rows,
           SUM(CASE WHEN migration_status = 'verified' THEN 1 ELSE 0 END) AS verified_tables,
           SUM(CASE WHEN migration_status = 'blocked' THEN 1 ELSE 0 END) AS blocked_tables,
           SUM(CASE WHEN source_checksum IS NULL OR source_checksum = '' THEN 1 ELSE 0 END) AS missing_source_checksums,
           SUM(CASE WHEN target_checksum IS NULL OR target_checksum = '' THEN 1 ELSE 0 END) AS missing_target_checksums
    FROM app_table_registry
    GROUP BY source_system
    ORDER BY source_system
  `).all<Record<string, unknown>>();
  return json(request, env, { success: true, sources: registry.results || [] });
}

async function bootstrapPlatformAdmin(
  request: Request,
  env: Env,
  identity: SessionIdentity
): Promise<Response> {
  if (!env.PLATFORM_BOOTSTRAP_TOKEN) {
    return json(request, env, { success: false, error: "مسار تأسيس مدير المنصة غير مهيأ." }, 503);
  }
  const body = await readJson(request);
  const supplied = String(body?.bootstrapToken || "");
  if (!supplied || !await constantTimeTextEqual(supplied, env.PLATFORM_BOOTSTRAP_TOKEN)) {
    return json(request, env, { success: false, error: "غير مصرح." }, 403);
  }

  const now = new Date().toISOString();
  const result = await env.CORE_DB.batch([
    env.CORE_DB.prepare(`
      INSERT OR IGNORE INTO platform_bootstrap_state (singleton_id, completed_by_identity_id, completed_at)
      SELECT 1, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM platform_roles WHERE role = 'platform_admin' AND status = 'active'
      )
    `).bind(identity.id, now),
    env.CORE_DB.prepare(`
      INSERT OR IGNORE INTO platform_roles (identity_id, role, status, granted_by_identity_id, created_at)
      SELECT completed_by_identity_id, 'platform_admin', 'active',
             completed_by_identity_id, completed_at
      FROM platform_bootstrap_state
      WHERE singleton_id = 1
        AND completed_by_identity_id = ?
        AND NOT EXISTS (
          SELECT 1 FROM platform_roles WHERE role = 'platform_admin' AND status = 'active'
        )
    `).bind(identity.id)
  ]);
  if ((result[0]?.meta?.changes || 0) !== 1 || (result[1]?.meta?.changes || 0) !== 1) {
    return json(request, env, { success: false, error: "تم تأسيس مدير المنصة بالفعل أو حدث تعارض." }, 409);
  }
  return json(request, env, { success: true, message: "تم تأسيس مدير المنصة الأول." });
}

async function approveStoreOwner(
  request: Request,
  env: Env,
  admin: SessionIdentity,
  storeId: string
): Promise<Response> {
  if (!await getActivePlatformAdmin(env, admin.id)) {
    return json(request, env, { success: false, error: "صلاحية مدير المنصة مطلوبة." }, 403);
  }
  const body = await readJson(request);
  const identityId = String(body?.identityId || "").trim();
  const note = String(body?.resolutionNote || "").trim().slice(0, 500);
  if (!identityId) return json(request, env, { success: false, error: "يجب تحديد الحساب المطلوب اعتماده." }, 400);

  const now = new Date().toISOString();
  const identity = await env.CORE_DB.prepare(`
    SELECT id FROM auth_identities
    WHERE id = ? AND account_status = 'active' AND verified_at IS NOT NULL
    LIMIT 1
  `).bind(identityId).first<{ id: string }>();
  if (!identity) return json(request, env, { success: false, error: "الحساب لم يتم التحقق منه بعد." }, 409);

  const results = await env.CORE_DB.batch([
    env.CORE_DB.prepare(`
      UPDATE pending_store_ownership_claims
      SET status = 'linked', claimed_identity_id = ?,
          verified_by_identity_id = ?, verified_at = ?,
          resolution_note = ?, updated_at = ?
      WHERE store_id = ? AND status = 'pending_verification'
    `).bind(identityId, admin.id, now, note, now, storeId),
    env.CORE_DB.prepare(`
      INSERT INTO store_memberships (
        store_id, identity_id, role, permissions_json, status, created_at, updated_at
      )
      SELECT store_id, ?, 'owner', '[]', 'active', ?, ?
      FROM pending_store_ownership_claims
      WHERE store_id = ? AND status = 'linked'
        AND claimed_identity_id = ? AND verified_by_identity_id = ?
      ON CONFLICT(store_id, identity_id) DO UPDATE SET
        role = 'owner', permissions_json = '[]',
        status = 'active', updated_at = excluded.updated_at
    `).bind(identityId, now, now, storeId, identityId, admin.id),
    env.CORE_DB.prepare(`
      INSERT INTO app_write_audit (
        audit_id, identity_id, store_id, table_name, record_key,
        operation, request_id, request_hash, created_at
      )
      SELECT ?, ?, ?, 'store_memberships', ?, 'approve', ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM pending_store_ownership_claims
        WHERE store_id = ? AND status = 'linked'
          AND claimed_identity_id = ? AND verified_by_identity_id = ?
      )
    `).bind(crypto.randomUUID(), admin.id, storeId, identityId, crypto.randomUUID(), await sha256Hex(`${storeId}:${identityId}:owner`), now, storeId, identityId, admin.id)
  ]);

  if ((results[0]?.meta?.changes || 0) !== 1 || (results[1]?.meta?.changes || 0) !== 1) {
    return json(request, env, { success: false, error: "لم يتم اعتماد المتجر؛ راجع طلب الملكية وحالة الحساب." }, 409);
  }
  return json(request, env, { success: true, storeId, identityId, role: "owner" });
}

async function approveMembershipClaim(
  request: Request,
  env: Env,
  admin: SessionIdentity,
  storeId: string
): Promise<Response> {
  if (!await getActivePlatformAdmin(env, admin.id)) {
    return json(request, env, { success: false, error: "صلاحية مدير المنصة مطلوبة." }, 403);
  }
  const body = await readJson(request);
  const claimId = String(body?.claimId || "").trim();
  const identityId = String(body?.identityId || "").trim();
  const assignedRole = String(body?.assignedRole || "").trim();
  const validRoles = new Set(["owner","manager","staff","viewer","merchant","partner"]);
  if (!claimId || !identityId || !validRoles.has(assignedRole)) {
    return json(request, env, { success: false, error: "بيانات ربط العضوية غير مكتملة." }, 400);
  }

  const identity = await env.CORE_DB.prepare(`
    SELECT id FROM auth_identities
    WHERE id = ? AND account_status = 'active' AND verified_at IS NOT NULL
    LIMIT 1
  `).bind(identityId).first<{ id: string }>();
  if (!identity) return json(request, env, { success: false, error: "الحساب لم يتم التحقق منه بعد." }, 409);

  const now = new Date().toISOString();
  const results = await env.CORE_DB.batch([
    env.CORE_DB.prepare(`
      UPDATE pending_membership_claims
      SET status = 'linked', claimed_identity_id = ?,
          verified_by_identity_id = ?, verified_at = ?,
          resolution_note = ?, updated_at = ?
      WHERE claim_id = ? AND store_id = ? AND status = 'pending_verification'
    `).bind(identityId, admin.id, now, String(body?.resolutionNote || "").slice(0,500), now, claimId, storeId),
    env.CORE_DB.prepare(`
      INSERT INTO store_memberships (
        store_id, identity_id, role, permissions_json, status, created_at, updated_at
      )
      SELECT store_id, ?, ?, '[]', 'active', ?, ?
      FROM pending_membership_claims
      WHERE claim_id = ? AND store_id = ? AND status = 'linked'
        AND claimed_identity_id = ? AND verified_by_identity_id = ?
      ON CONFLICT(store_id, identity_id) DO UPDATE SET
        role = excluded.role,
        permissions_json = '[]',
        status = 'active',
        updated_at = excluded.updated_at
    `).bind(identityId, assignedRole, now, now, claimId, storeId, identityId, admin.id),
    env.CORE_DB.prepare(`
      INSERT INTO app_write_audit (
        audit_id, identity_id, store_id, table_name, record_key,
        operation, request_id, request_hash, created_at
      )
      SELECT ?, ?, ?, 'store_memberships', ?, 'approve', ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM pending_membership_claims
        WHERE claim_id = ? AND store_id = ? AND status = 'linked'
          AND claimed_identity_id = ? AND verified_by_identity_id = ?
      )
    `).bind(crypto.randomUUID(), admin.id, storeId, identityId, crypto.randomUUID(), await sha256Hex(`${claimId}:${identityId}:${assignedRole}`), now, claimId, storeId, identityId, admin.id)
  ]);
  if ((results[0]?.meta?.changes || 0) !== 1 || (results[1]?.meta?.changes || 0) !== 1) {
    return json(request, env, { success: false, error: "تعذر تفعيل العضوية؛ ربما تمت معالجتها مسبقًا." }, 409);
  }
  return json(request, env, { success: true, storeId, identityId, role: assignedRole });
}

async function createInvitation(
  request: Request,
  env: Env,
  identity: SessionIdentity,
  storeId: string
): Promise<Response> {
  const membership = await getActiveMembership(env, identity.id, storeId);
  if (!membership || !["owner","manager"].includes(membership.role)) {
    return json(request, env, { success: false, error: "إدارة دعوات الموظفين متاحة للمالك أو المدير فقط." }, 403);
  }
  const body = await readJson(request);
  const email = cleanEmail(body?.email);
  const role = String(body?.role || "").trim();
  const allowedRoles = membership.role === "owner"
    ? new Set(["manager","staff","viewer","merchant","partner"])
    : new Set(["staff","viewer","merchant","partner"]);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !allowedRoles.has(role)) {
    return json(request, env, { success: false, error: "البريد أو الدور غير صالح." }, 400);
  }
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    return json(request, env, { success: false, error: "خدمة إرسال الدعوات غير مهيأة." }, 503);
  }

  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const invitationId = crypto.randomUUID();
  const now = new Date();
  const hours = Number(body?.expiresInHours || 72);
  const safeHours = Number.isFinite(hours) ? Math.min(168, Math.max(1, Math.floor(hours))) : 72;
  const expires = new Date(now.getTime() + safeHours * 60 * 60 * 1000).toISOString();
  const permissions = Array.isArray(body?.permissions) ? body.permissions.filter(value => typeof value === "string").slice(0, 50) : [];
  await env.CORE_DB.prepare(`
    INSERT INTO store_invitations (
      invitation_id, store_id, intended_email, role, permissions_json,
      token_hash, created_by_identity_id, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(invitationId, storeId, email, role, JSON.stringify(permissions), tokenHash, identity.id, expires).run();

  const acceptUrl = new URL("/accept-invitation", env.APP_ORIGIN || "https://app.abdomedi.com");
  acceptUrl.searchParams.set("token", token);
  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [email],
      subject: "دعوة للانضمام إلى متجرك على 1Toolz",
      html: `<div dir="rtl" style="font-family:Arial,sans-serif"><h2>تمت دعوتك للانضمام إلى متجر</h2><p>الدور: ${role}</p><p><a href="${acceptUrl.toString()}">قبول الدعوة</a></p><p>تنتهي صلاحية الدعوة في ${expires}</p></div>`
    })
  }).catch(() => null);

  if (!mail || !mail.ok) {
    await env.CORE_DB.prepare(
      "UPDATE store_invitations SET revoked_at = ? WHERE invitation_id = ?"
    ).bind(new Date().toISOString(), invitationId).run();
    return json(request, env, { success: false, error: "تعذر إرسال الدعوة؛ تم إلغاؤها تلقائيًا." }, 502);
  }

  return json(request, env, { success: true, invitationId, email, role, expiresAt: expires });
}


interface MerchantLinkRow {
  merchant_id: string;
  status: string;
}

interface MerchantWithdrawalRow {
  id: string;
  store_id: string;
  merchant_id: string;
  amount_minor: number;
  transfer_fee_minor: number;
  status: string;
  idempotency_key: string;
  payout_method: string;
  payout_account_ref: string | null;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  transfer_reference: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

function walletDatabase(db: D1DatabaseLike): WalletD1DatabaseLike {
  const adapt = (statement: D1StatementLike): WalletD1StatementLike => ({
    bind(...values: Array<string | number | null>): WalletD1StatementLike {
      return adapt(statement.bind(...values));
    },
    first<T = Record<string, unknown>>(): Promise<T | null> {
      return statement.first<T>();
    },
    async run() {
      const result = await statement.run();
      return { success: result.success === true, meta: result.meta };
    }
  });
  return { prepare: (sql: string) => adapt(db.prepare(sql)) };
}

function egpToMinor(value: unknown, field: string): number {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`invalid_${field}`);
  const major = Number(match[1]);
  const minor = Number((match[2] || "").padEnd(2, "0") || "0");
  const valueMinor = major * 100 + minor;
  if (!Number.isSafeInteger(valueMinor)) throw new Error(`invalid_${field}`);
  return valueMinor;
}

async function activeMerchantLink(
  env: Env,
  storeId: string,
  identityId: string
): Promise<string | null> {
  const row = await env.CORE_DB.prepare(`
    SELECT merchant_id
    FROM merchant_account_links
    WHERE store_id = ? AND identity_id = ? AND status = 'active'
    LIMIT 1
  `).bind(storeId, identityId).first<MerchantLinkRow>();
  return row?.merchant_id || null;
}

async function merchantWalletSnapshot(
  request: Request,
  env: Env,
  storeId: string,
  merchantId: string
): Promise<Response> {
  const snapshot = await getMerchantWalletSnapshot(walletDatabase(env.CORE_DB), storeId, merchantId);
  if (!snapshot) return json(request, env, { success: false, error: "محفظة الموكل غير موجودة في قاعدة Cloudflare." }, 404);
  return json(request, env, { success: true, wallet: snapshot });
}

async function merchantWithdrawalList(
  request: Request,
  env: Env,
  identity: SessionIdentity,
  storeId: string
): Promise<Response> {
  const membership = await getActiveMembership(env, identity.id, storeId);
  if (!membership) return json(request, env, { success: false, error: "لا تملك عضوية نشطة في هذا المتجر." }, 403);

  let query = env.CORE_DB.prepare(`
    SELECT id, store_id, merchant_id, amount_minor, transfer_fee_minor, status,
           idempotency_key, payout_method, payout_account_ref, requested_by_user_id,
           approved_by_user_id, transfer_reference, rejection_reason,
           created_at, updated_at, processed_at
    FROM merchant_withdrawal_requests
    WHERE store_id = ?
    ORDER BY created_at DESC
    LIMIT 200
  `);
  if (["merchant","partner"].includes(membership.role)) {
    const merchantId = await activeMerchantLink(env, storeId, identity.id);
    if (!merchantId) return json(request, env, { success: false, error: "حساب الموكل غير مربوط بمحفظة بعد." }, 403);
    query = env.CORE_DB.prepare(`
      SELECT id, store_id, merchant_id, amount_minor, transfer_fee_minor, status,
             idempotency_key, payout_method, payout_account_ref, requested_by_user_id,
             approved_by_user_id, transfer_reference, rejection_reason,
             created_at, updated_at, processed_at
      FROM merchant_withdrawal_requests
      WHERE store_id = ? AND merchant_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `).bind(storeId, merchantId) as unknown as typeof query;
  } else if (!["owner","manager"].includes(membership.role)) {
    return json(request, env, { success: false, error: "لا تملك صلاحية عرض طلبات السحب." }, 403);
  } else {
    query = query.bind(storeId) as unknown as typeof query;
  }

  const result = await query.all<MerchantWithdrawalRow>();
  return json(request, env, { success: true, requests: result.results || [] });
}

async function submitWithdrawal(
  request: Request,
  env: Env,
  identity: SessionIdentity,
  storeId: string
): Promise<Response> {
  const membership = await getActiveMembership(env, identity.id, storeId);
  if (!membership || !["merchant","partner"].includes(membership.role)) {
    return json(request, env, { success: false, error: "طلب السحب متاح لحساب الموكل المرتبط فقط." }, 403);
  }
  const merchantId = await activeMerchantLink(env, storeId, identity.id);
  if (!merchantId) return json(request, env, { success: false, error: "حساب الموكل لم يتم ربطه بمحفظة بعد." }, 403);

  const body = await readJson(request);
  if (!body) return json(request, env, { success: false, error: "بيانات طلب السحب غير صالحة." }, 400);
  const payoutMethod = String(body.payoutMethod || "");
  if (!["bank","instapay","wallet"].includes(payoutMethod)) {
    return json(request, env, { success: false, error: "طريقة التحويل غير صحيحة." }, 400);
  }

  const idempotencyKey = request.headers.get("Idempotency-Key") || String(body.idempotencyKey || "");
  if (!idempotencyKey.trim()) {
    return json(request, env, { success: false, error: "مفتاح منع التكرار مطلوب." }, 400);
  }

  try {
    const input: SubmitWithdrawalInput = {
      storeId,
      merchantId,
      amountMinor: typeof body.amountMinor === "number" && Number.isSafeInteger(body.amountMinor)
        ? body.amountMinor
        : egpToMinor(body.amount, "amount"),
      transferFeeMinor: typeof body.transferFeeMinor === "number"
        ? body.transferFeeMinor
        : body.transferFee !== undefined ? egpToMinor(body.transferFee, "transfer_fee") : 0,
      idempotencyKey: idempotencyKey.trim(),
      payoutMethod: payoutMethod as SubmitWithdrawalInput["payoutMethod"],
      payoutAccountRef: body.payoutAccountRef ? String(body.payoutAccountRef) : null,
      requestedByUserId: identity.id
    };
    const created = await submitMerchantWithdrawal(walletDatabase(env.CORE_DB), input);
    const wallet = await getMerchantWalletSnapshot(walletDatabase(env.CORE_DB), storeId, merchantId);
    return json(request, env, { success: true, request: created, wallet }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "withdrawal_failed";
    const status = message.includes("insufficient_available_balance") ? 409
      : message.includes("idempotency_key") ? 409
      : message.startsWith("invalid_") ? 400 : 500;
    return json(request, env, {
      success: false,
      error: status === 409 ? "الرصيد غير كافٍ أو الطلب مكرر بمحتوى مختلف."
        : status === 400 ? "بيانات السحب غير صالحة."
        : "تعذر إنشاء طلب السحب."
    }, status);
  }
}

async function transitionWithdrawal(
  request: Request,
  env: Env,
  identity: SessionIdentity,
  storeId: string,
  requestId: string,
  transition: "processing" | "approved" | "rejected"
): Promise<Response> {
  const membership = await getActiveMembership(env, identity.id, storeId);
  if (!membership || !["owner","manager"].includes(membership.role)) {
    return json(request, env, { success: false, error: "صلاحية المالك أو المدير مطلوبة لمعالجة طلب السحب." }, 403);
  }
  const existing = await env.CORE_DB.prepare(`
    SELECT merchant_id
    FROM merchant_withdrawal_requests
    WHERE id = ? AND store_id = ?
    LIMIT 1
  `).bind(requestId, storeId).first<{ merchant_id: string }>();
  if (!existing) return json(request, env, { success: false, error: "طلب السحب غير موجود." }, 404);

  const body = transition === "processing" ? {} : await readJson(request);
  if (!body) return json(request, env, { success: false, error: "بيانات معالجة الطلب غير صالحة." }, 400);
  try {
    const updated = await transitionMerchantWithdrawal(walletDatabase(env.CORE_DB), {
      storeId,
      merchantId: existing.merchant_id,
      requestId,
      targetStatus: transition,
      actorUserId: identity.id,
      transferReference: transition === "approved" ? String(body.transferReference || "").trim() : undefined,
      rejectionReason: transition === "rejected" ? String(body.rejectionReason || "").trim() : undefined
    });
    const wallet = await getMerchantWalletSnapshot(walletDatabase(env.CORE_DB), storeId, existing.merchant_id);
    return json(request, env, { success: true, request: updated, wallet });
  } catch {
    return json(request, env, { success: false, error: "تعذر معالجة الطلب؛ ربما تمت معالجته من قبل." }, 409);
  }
}

async function createMerchantAccountLink(
  request: Request,
  env: Env,
  actor: SessionIdentity,
  storeId: string
): Promise<Response> {
  const ownerMembership = await getActiveMembership(env, actor.id, storeId);
  if (!ownerMembership || ownerMembership.role !== "owner") {
    return json(request, env, { success: false, error: "صلاحية مالك المتجر مطلوبة لربط حساب الموكل." }, 403);
  }
  const body = await readJson(request);
  const merchantId = String(body?.merchantId || "").trim();
  const identityId = String(body?.identityId || "").trim();
  const role = String(body?.role || "merchant");
  if (!merchantId || !identityId || !["merchant","partner"].includes(role)) {
    return json(request, env, { success: false, error: "بيانات ربط الموكل غير مكتملة." }, 400);
  }

  const [wallet, identity] = await Promise.all([
    env.CORE_DB.prepare(
      "SELECT merchant_id FROM merchant_wallets WHERE store_id = ? AND merchant_id = ? LIMIT 1"
    ).bind(storeId, merchantId).first<{merchant_id:string}>(),
    env.CORE_DB.prepare(
      "SELECT id FROM auth_identities WHERE id = ? AND account_status = 'active' AND verified_at IS NOT NULL LIMIT 1"
    ).bind(identityId).first<{id:string}>()
  ]);
  if (!wallet || !identity) {
    return json(request, env, { success: false, error: "المحفظة أو هوية الحساب غير موجودة أو غير متحققة." }, 409);
  }

  const existingMembership = await env.CORE_DB.prepare(`
    SELECT role, status
    FROM store_memberships
    WHERE store_id = ? AND identity_id = ?
    LIMIT 1
  `).bind(storeId, identityId).first<{role:string;status:string}>();
  if (existingMembership && !["merchant","partner"].includes(existingMembership.role)) {
    return json(request, env, { success: false, error: "الحساب مرتبط بالفعل بدور مختلف داخل هذا المتجر." }, 409);
  }

  const now = new Date().toISOString();
  const results = await env.CORE_DB.batch([
    env.CORE_DB.prepare(`
      INSERT INTO store_memberships (
        store_id, identity_id, role, permissions_json, status, created_at, updated_at
      ) VALUES (?, ?, ?, '[]', 'active', ?, ?)
      ON CONFLICT(store_id, identity_id) DO UPDATE SET
        status = 'active',
        updated_at = excluded.updated_at
      WHERE store_memberships.role IN ('merchant','partner')
    `).bind(storeId, identityId, role, now, now),
    env.CORE_DB.prepare(`
      INSERT INTO merchant_account_links (
        store_id, merchant_id, identity_id, status, verified_by_identity_id,
        verified_at, created_at, updated_at
      ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
      ON CONFLICT(store_id, merchant_id, identity_id) DO UPDATE SET
        status = 'active',
        verified_by_identity_id = excluded.verified_by_identity_id,
        verified_at = excluded.verified_at,
        updated_at = excluded.updated_at
    `).bind(storeId, merchantId, identityId, actor.id, now, now, now)
  ]);

  if ((results[0]?.meta?.changes || 0) !== 1 || (results[1]?.meta?.changes || 0) !== 1) {
    return json(request, env, { success: false, error: "تعذر ربط محفظة الموكل." }, 409);
  }
  return json(request, env, { success: true, storeId, merchantId, identityId, role });
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = request.headers.get("Origin") || "";
  if (origin && !originAllowed(origin, env)) {
    return json(request, env, { success: false, error: "مصدر الطلب غير مسموح." }, 403);
  }

  if (request.method === "OPTIONS") {
    const headers = corsHeaders(request, env);
    return new Response(null, { status: 204, headers });
  }

  if (path === "/health" && request.method === "GET") {
    return json(request, env, { success: true, service: "1toolz-cloudflare-cutover-lab", environment: env.APP_ENV || "unknown" });
  }

  if (path === "/api/core/v1/auth/request-otp" && request.method === "POST") {
    return requestOtp(request, env, "send");
  }
  if (path === "/api/core/v1/auth/verify-otp" && request.method === "POST") {
    return requestOtp(request, env, "verify");
  }
  if (path === "/api/core/v1/auth/logout" && request.method === "POST") {
    return logout(request, env);
  }
  if (path === "/api/core/v1/auth/me" && request.method === "GET") {
    return currentUser(request, env);
  }
  if (path === "/api/core/v1/stores" && request.method === "GET") {
    return storesForUser(request, env);
  }

  const identity = await validateSession(request, env);
  if (!identity) return json(request, env, { success: false, error: "يلزم تسجيل الدخول." }, 401);

  if (path === "/api/core/v1/bootstrap/platform-admin" && request.method === "POST") {
    return bootstrapPlatformAdmin(request, env, identity);
  }
  if (path === "/api/core/v1/admin/migration-status" && request.method === "GET") {
    return migrationStatus(request, env, identity);
  }

  const ownerMatch = path.match(/^\/api\/core\/v1\/admin\/stores\/([^/]+)\/approve-owner$/);
  if (ownerMatch && request.method === "POST") {
    return approveStoreOwner(request, env, identity, decodeURIComponent(ownerMatch[1]));
  }
  const membershipMatch = path.match(/^\/api\/core\/v1\/admin\/stores\/([^/]+)\/approve-membership$/);
  if (membershipMatch && request.method === "POST") {
    return approveMembershipClaim(request, env, identity, decodeURIComponent(membershipMatch[1]));
  }
  const inviteMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)\/invitations$/);
  if (inviteMatch && request.method === "POST") {
    return createInvitation(request, env, identity, decodeURIComponent(inviteMatch[1]));
  }
  const merchantLinkMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)\/merchant-account-links$/);
  if (merchantLinkMatch && request.method === "POST") {
    return createMerchantAccountLink(request, env, identity, decodeURIComponent(merchantLinkMatch[1]));
  }
  const merchantWalletMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)\/merchant-wallet\/([^/]+)$/);
  if (merchantWalletMatch && request.method === "GET") {
    const storeId = decodeURIComponent(merchantWalletMatch[1]);
    const merchantId = decodeURIComponent(merchantWalletMatch[2]);
    const membership = await getActiveMembership(env, identity.id, storeId);
    if (!membership) return json(request, env, { success: false, error: "لا تملك عضوية نشطة في هذا المتجر." }, 403);
    const linkedMerchant = await activeMerchantLink(env, storeId, identity.id);
    if (!["owner","manager"].includes(membership.role) && linkedMerchant !== merchantId) {
      return json(request, env, { success: false, error: "لا تملك صلاحية عرض هذه المحفظة." }, 403);
    }
    return merchantWalletSnapshot(request, env, storeId, merchantId);
  }
  const merchantWithdrawalListMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)\/merchant-withdrawals$/);
  if (merchantWithdrawalListMatch) {
    const storeId = decodeURIComponent(merchantWithdrawalListMatch[1]);
    if (request.method === "GET") return merchantWithdrawalList(request, env, identity, storeId);
    if (request.method === "POST") return submitWithdrawal(request, env, identity, storeId);
    return json(request, env, { success: false, error: "طريقة الطلب غير مدعومة." }, 405);
  }
  const merchantWithdrawalActionMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)\/merchant-withdrawals\/([^/]+)\/(processing|approve|reject)$/);
  if (merchantWithdrawalActionMatch && request.method === "POST") {
    const state = merchantWithdrawalActionMatch[3] === "approve"
      ? "approved"
      : merchantWithdrawalActionMatch[3] === "reject" ? "rejected" : "processing";
    return transitionWithdrawal(
      request,
      env,
      identity,
      decodeURIComponent(merchantWithdrawalActionMatch[1]),
      decodeURIComponent(merchantWithdrawalActionMatch[2]),
      state
    );
  }

  const storeMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)$/);
  if (storeMatch && request.method === "GET") {
    return getStore(request, env, identity, decodeURIComponent(storeMatch[1]));
  }
  const recordMatch = path.match(/^\/api\/core\/v1\/stores\/([^/]+)\/records\/([a-z_]+)$/);
  if (recordMatch && request.method === "GET") {
    return getStoreRecords(
      request,
      env,
      identity,
      decodeURIComponent(recordMatch[1]),
      recordMatch[2]
    );
  }
  if (recordMatch && request.method !== "GET") {
    return json(request, env, {
      success: false,
      error: "الكتابة المباشرة للبيانات العامة متوقفة؛ يجب استخدام عملية متخصصة لضمان سلامة المخزون والحسابات."
    }, 405);
  }

  return json(request, env, { success: false, error: "مسار API غير موجود." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: "cutover_worker_request_failed",
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : "unknown_error"
      }));
      return json(request, env, { success: false, error: "حدث خطأ داخلي. حاول مرة أخرى." }, 500);
    }
  }
};
