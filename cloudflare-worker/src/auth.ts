/**
 * Cloudflare-native authentication for 1Toolz.
 *
 * Legacy Supabase/Firebase password values are never read or imported.
 * Every imported legacy identity starts with password_reset_required=1 and
 * must complete a verified email-OTP recovery before it can sign in.
 */

export interface AuthStatement {
  bind(...values: unknown[]): AuthStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ success?: boolean; meta?: { changes?: number } }>;
}

import { handleOtpRequest } from "./otp";

export interface AuthDatabase {
  prepare(sql: string): AuthStatement;
}

export interface AuthEnv {
  APP_DB?: AuthDatabase;
  OTP_DB?: AuthDatabase;
  OTP_HASH_SECRET?: string;
  SESSION_HASH_SECRET?: string;
  APP_ORIGIN?: string;
}

export interface AuthIdentity {
  id: string;
  legacy_source: string;
  legacy_user_key: string;
  email: string | null;
  phone: string | null;
  display_name: string | null;
  account_status: "pending_reactivation" | "active" | "disabled" | "banned";
  password_reset_required: number;
}

export interface AuthContext {
  identityId: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  isPlatformAdmin: boolean;
  memberships: Array<{
    store_id: string;
    role: string;
    permissions: string[];
  }>;
}

const SESSION_COOKIE = "__Host-1toolz_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
const PBKDF2_ITERATIONS = 310_000;
const MIN_PASSWORD_LENGTH = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}

function setSessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function normalizePhone(value: unknown): string {
  return typeof value === "string" ? value.replace(/[^0-9+]/g, "").trim() : "";
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeText(value: unknown, maxLength = 120): string {
  return typeof value === "string"
    ? value.replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, maxLength)
    : "";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("invalid_hex_value");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(signature));
}

async function derivePasswordHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000) return false;

  const expectedSalt = hexToBytes(parts[2]);
  const expectedHash = hexToBytes(parts[3]);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: expectedSalt, iterations, hash: "SHA-256" },
    key,
    expectedHash.length * 8
  );
  return constantTimeEqual(new Uint8Array(derived), expectedHash);
}

function isSyntheticEmail(value: string): boolean {
  return /@mystore-auth\.app$/i.test(value) || /@example\.(com|net|org)$/i.test(value);
}

async function lookupIdentity(db: AuthDatabase, login: string): Promise<AuthIdentity | null> {
  return db.prepare(`
    SELECT id, legacy_source, legacy_user_key, email, phone, display_name,
           account_status, password_reset_required
    FROM auth_identities
    WHERE lower(email) = ? OR phone = ?
    ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END
    LIMIT 1
  `).bind(login.toLowerCase(), login).first<AuthIdentity>();
}

async function createSession(
  db: AuthDatabase,
  secret: string,
  identityId: string,
  request: Request
): Promise<string> {
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToHex(tokenBytes);
  const tokenHash = await hmacHex(secret, `session:${token}`);
  const sessionId = crypto.randomUUID();
  const userAgent = request.headers.get("User-Agent") || "";
  const userAgentHash = await hmacHex(secret, `ua:${userAgent.slice(0, 400)}`);

  const result = await db.prepare(`
    INSERT INTO auth_sessions (
      session_id, identity_id, refresh_token_hash, created_at, expires_at,
      last_seen_at, revoked_at, user_agent_hash
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP,
      datetime('now', ?), CURRENT_TIMESTAMP, NULL, ?)
  `).bind(
    sessionId,
    identityId,
    tokenHash,
    `+${SESSION_TTL_SECONDS} seconds`,
    userAgentHash
  ).run();

  if (result.success === false || (result.meta?.changes !== undefined && result.meta.changes !== 1)) {
    throw new Error("session_create_failed");
  }
  return token;
}

export async function getAuthContext(request: Request, env: AuthEnv): Promise<AuthContext | null> {
  if (!env.APP_DB || !env.SESSION_HASH_SECRET) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/i.test(token)) return null;

  const tokenHash = await hmacHex(env.SESSION_HASH_SECRET, `session:${token}`);
  const row = await env.APP_DB.prepare(`
    SELECT a.id, a.email, a.phone, a.display_name, a.legacy_role_claims_json
    FROM auth_sessions s
    JOIN auth_identities a ON a.id = s.identity_id
    JOIN auth_credentials c ON c.identity_id = a.id
    WHERE s.refresh_token_hash = ?
      AND s.revoked_at IS NULL
      AND s.expires_at > CURRENT_TIMESTAMP
      AND a.account_status = 'active'
      AND c.must_change_password = 0
    LIMIT 1
  `).bind(tokenHash).first<{
    id: string;
    email: string | null;
    phone: string | null;
    display_name: string | null;
    legacy_role_claims_json: string;
  }>();

  if (!row) return null;

  let roleClaims: Record<string, unknown> = {};
  try { roleClaims = JSON.parse(row.legacy_role_claims_json || "{}"); } catch { roleClaims = {}; }

  const memberships = await env.APP_DB.prepare(`
    SELECT store_id, role, permissions_json
    FROM store_memberships
    WHERE identity_id = ? AND status = 'active'
    ORDER BY store_id
  `).bind(row.id).all();

  const list = (memberships as unknown as { results?: Array<{ store_id: string; role: string; permissions_json: string }> }).results || [];
  return {
    identityId: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.display_name,
    isPlatformAdmin: roleClaims.platformAdmin === true,
    memberships: list.map(item => {
      let permissions: string[] = [];
      try {
        const parsed = JSON.parse(item.permissions_json || "[]");
        if (Array.isArray(parsed)) permissions = parsed.filter((value): value is string => typeof value === "string");
      } catch {
        permissions = [];
      }
      return { store_id: item.store_id, role: item.role, permissions };
    })
  };
}

export async function handleAuthRequest(
  request: Request,
  env: AuthEnv,
  jsonResponse: (request: Request, env: any, body: unknown, status?: number) => Response
): Promise<Response> {
  const url = new URL(request.url);
  if (!env.APP_DB || !env.SESSION_HASH_SECRET) {
    return json({ success: false, error: "خدمة الدخول غير مهيأة بعد." }, 503);
  }
  if (request.method === "OPTIONS") return json({ success: true }, 204);

  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const login = normalizeEmail(body.login) || normalizePhone(body.login);
    const password = typeof body.password === "string" ? body.password : "";
    if (!login || password.length < 1 || password.length > 256) {
      return json({ success: false, error: "أدخل رقم الهاتف أو البريد وكلمة المرور." }, 400);
    }

    const identity = await lookupIdentity(env.APP_DB, login);
    if (!identity) return json({ success: false, error: "بيانات الدخول غير صحيحة." }, 401);
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "هذا الحساب موقوف. تواصل مع إدارة المنصة." }, 403);
    }
    if (identity.account_status !== "active" || Number(identity.password_reset_required) === 1) {
      return json({
        success: false,
        code: "PASSWORD_RESET_REQUIRED",
        error: "الحساب يحتاج إلى إعادة تفعيل كلمة المرور قبل تسجيل الدخول."
      }, 403);
    }

    const credential = await env.APP_DB.prepare(
      "SELECT password_hash, must_change_password FROM auth_credentials WHERE identity_id = ? LIMIT 1"
    ).bind(identity.id).first<{ password_hash: string | null; must_change_password: number }>();

    if (!credential?.password_hash || Number(credential.must_change_password) === 1) {
      return json({ success: false, code: "PASSWORD_RESET_REQUIRED", error: "أعد تعيين كلمة المرور لتفعيل الحساب." }, 403);
    }
    if (!await verifyPassword(password, credential.password_hash)) {
      return json({ success: false, error: "بيانات الدخول غير صحيحة." }, 401);
    }

    const token = await createSession(env.APP_DB, env.SESSION_HASH_SECRET, identity.id, request);
    const headers = new Headers({ "set-cookie": setSessionCookie(token) });
    return json({
      success: true,
      user: {
        id: identity.id,
        phone: identity.phone,
        email: identity.email,
        fullName: identity.display_name
      }
    }, 200, headers);
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/recovery/request") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const phone = normalizePhone(body.phone);
    if (!phone || phone.length < 8 || phone.length > 20) {
      return json({ success: false, error: "رقم الهاتف غير صالح." }, 400);
    }
    const identity = await env.APP_DB.prepare(`
      SELECT id, email, account_status
      FROM auth_identities
      WHERE phone = ?
      ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END
      LIMIT 1
    `).bind(phone).first<{ id: string; email: string | null; account_status: string }>();

    if (!identity || !identity.email || !EMAIL_RE.test(identity.email) || isSyntheticEmail(identity.email)) {
      // Do not expose whether the phone exists in the migrated directory.
      return json({
        success: true,
        message: "لو الحساب مرتبط ببريد موثق، هيوصله رمز استعادة. بعض الحسابات القديمة تحتاج مراجعة الإدارة."
      });
    }

    const otpUrl = new URL("/api/send-otp", request.url);
    const otpRequest = new Request(otpUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.headers.get("Origin") ? { Origin: request.headers.get("Origin")! } : {}),
        ...(request.headers.get("CF-Connecting-IP") ? { "CF-Connecting-IP": request.headers.get("CF-Connecting-IP")! } : {})
      },
      body: JSON.stringify({ email: identity.email, userName: "1Toolz" })
    });
    const otpResponse = await handleOtpRequest(otpRequest, env as any, jsonResponse);
    const otpBody = await otpResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!otpResponse.ok || otpBody.success !== true) {
      return json({ success: false, error: otpBody.error || "تعذر إرسال رمز الاستعادة." }, otpResponse.status);
    }
    return json({
      success: true,
      message: "تم إرسال رمز الاستعادة إلى البريد المسجل بالحساب.",
      target: otpBody.target,
      expiresInSeconds: otpBody.expiresInSeconds
    });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/recovery/complete") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const phone = normalizePhone(body.phone);
    const otp = String(body.otp ?? "").trim();
    const password = typeof body.newPassword === "string" ? body.newPassword : "";
    if (!phone || !/^\d{6}$/.test(otp) || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return json({ success: false, error: "تأكد من رقم الهاتف ورمز التحقق، واجعل كلمة المرور 10 أحرف على الأقل." }, 400);
    }
    if (!env.OTP_DB || !env.OTP_HASH_SECRET) {
      return json({ success: false, error: "خدمة التحقق غير مهيأة." }, 503);
    }

    const identity = await env.APP_DB.prepare(`
      SELECT id, email, account_status
      FROM auth_identities
      WHERE phone = ?
      ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END
      LIMIT 1
    `).bind(phone).first<{ id: string; email: string | null; account_status: string }>();
    if (!identity || !identity.email || !EMAIL_RE.test(identity.email) || isSyntheticEmail(identity.email)) {
      return json({ success: false, error: "لا يوجد بريد موثق لاستعادة هذا الحساب. تواصل مع الإدارة للتحقق من الملكية." }, 403);
    }
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "هذا الحساب موقوف. تواصل مع إدارة المنصة." }, 403);
    }

    const otpRequest = new Request(new URL("/api/verify-otp", request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(request.headers.get("Origin") ? { Origin: request.headers.get("Origin")! } : {}),
        ...(request.headers.get("CF-Connecting-IP") ? { "CF-Connecting-IP": request.headers.get("CF-Connecting-IP")! } : {})
      },
      body: JSON.stringify({ email: identity.email, otp })
    });
    const otpResponse = await handleOtpRequest(otpRequest, env, jsonResponse);
    const otpBody = await otpResponse.json().catch(() => ({})) as Record<string, unknown>;
    if (!otpResponse.ok || otpBody.valid !== true) {
      return json({ success: false, error: otpBody.message || otpBody.error || "رمز الاستعادة غير صحيح." }, otpResponse.status || 400);
    }

    const encodedHash = await derivePasswordHash(password);
    const update = await env.APP_DB.prepare(`
      INSERT INTO auth_credentials (
        identity_id, password_hash, password_algorithm, password_changed_at, must_change_password
      ) VALUES (?, ?, 'pbkdf2-sha256', CURRENT_TIMESTAMP, 0)
      ON CONFLICT(identity_id) DO UPDATE SET
        password_hash = excluded.password_hash,
        password_algorithm = excluded.password_algorithm,
        password_changed_at = CURRENT_TIMESTAMP,
        must_change_password = 0
    `).bind(identity.id, encodedHash).run();

    if (update.success === false) {
      return json({ success: false, error: "تعذر حفظ كلمة المرور الجديدة. اطلب رمزًا جديدًا وحاول مرة أخرى." }, 500);
    }
    await env.APP_DB.prepare(`
      UPDATE auth_identities
      SET account_status = 'active',
          password_reset_required = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(identity.id).run();

    // Reactivation only restores pre-existing migrated memberships. New roles
    // or stores can never be added by this self-service recovery endpoint.
    await env.APP_DB.prepare(`
      UPDATE store_memberships
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE identity_id = ? AND status = 'pending_verification'
    `).bind(identity.id).run();

    await env.APP_DB.prepare(`
      INSERT INTO migration_audit (
        id, source_system, source_table, record_key, action, detail_json, created_at
      ) VALUES (?, 'manual', 'auth_reactivation', ?, 'verified', ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      identity.id,
      JSON.stringify({ verifiedBy: "email_otp", membershipsActivated: true })
    ).run();

    const token = await createSession(env.APP_DB, env.SESSION_HASH_SECRET, identity.id, request);
    return json({
      success: true,
      message: "تم تفعيل كلمة المرور وتسجيل الدخول بنجاح."
    }, 200, { "set-cookie": setSessionCookie(token) });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/logout") {
    const token = readCookie(request, SESSION_COOKIE);
    if (token && /^[0-9a-f]{64}$/i.test(token)) {
      const tokenHash = await hmacHex(env.SESSION_HASH_SECRET, `session:${token}`);
      await env.APP_DB.prepare(
        "UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = ? AND revoked_at IS NULL"
      ).bind(tokenHash).run();
    }
    return json({ success: true }, 200, { "set-cookie": clearSessionCookie() });
  }

  if (request.method === "GET" && url.pathname === "/api/v1/auth/me") {
    const context = await getAuthContext(request, env);
    if (!context) return json({ success: false, error: "غير مسجل الدخول." }, 401);
    return json({
      success: true,
      user: {
        id: context.identityId,
        email: context.email,
        phone: context.phone,
        fullName: context.displayName
      },
      memberships: context.memberships,
      isPlatformAdmin: context.isPlatformAdmin
    });
  }

  return json({ success: false, error: "مسار المصادقة غير موجود." }, 404);
}
