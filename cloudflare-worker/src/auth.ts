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
  const syntheticAlias = login.match(/^(.+)@mystore-auth\\.app$/i);
  const phoneLogin = normalizePhone(syntheticAlias ? syntheticAlias[1] : login);
  const emailLogin = normalizeEmail(login);
  const rows = await db.prepare(`
    SELECT id, legacy_source, legacy_user_key, email, phone, display_name,
           account_status, password_reset_required
    FROM auth_identities
    WHERE lower(email) = ? OR (? <> '' AND phone = ?)
    ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 3
  `).bind(emailLogin, phoneLogin, phoneLogin).all<AuthIdentity>();
  const matches = rows.results || [];
  if (matches.length !== 1) return null;
  return matches[0];
}

async function verifyEmailOtp(
  request: Request,
  env: AuthEnv,
  jsonResponse: (request: Request, env: any, body: unknown, status?: number) => Response,
  email: string,
  otp: string
): Promise<{ valid: boolean; error?: string; status?: number }> {
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) return { valid: false, error: "خدمة التحقق غير مهيأة.", status: 503 };
  const headers = new Headers({ "content-type": "application/json" });
  const origin = request.headers.get("Origin");
  const ip = request.headers.get("CF-Connecting-IP");
  if (origin) headers.set("Origin", origin);
  if (ip) headers.set("CF-Connecting-IP", ip);
  const otpRequest = new Request(new URL("/api/verify-otp", request.url), {
    method: "POST", headers, body: JSON.stringify({ email, otp })
  });
  const response = await handleOtpRequest(otpRequest, env as any, jsonResponse);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  return response.ok && result.valid === true
    ? { valid: true }
    : { valid: false, error: String(result.message || result.error || "رمز التحقق غير صحيح."), status: response.status || 400 };
}

async function sendEmailOtp(
  request: Request,
  env: AuthEnv,
  jsonResponse: (request: Request, env: any, body: unknown, status?: number) => Response,
  email: string,
  userName: string
): Promise<{ success: boolean; target?: string; expiresInSeconds?: number; error?: string; status?: number }> {
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) return { success: false, error: "خدمة التحقق غير مهيأة.", status: 503 };
  const headers = new Headers({ "content-type": "application/json" });
  const origin = request.headers.get("Origin");
  const ip = request.headers.get("CF-Connecting-IP");
  if (origin) headers.set("Origin", origin);
  if (ip) headers.set("CF-Connecting-IP", ip);
  const otpRequest = new Request(new URL("/api/send-otp", request.url), {
    method: "POST", headers, body: JSON.stringify({ email, userName })
  });
  const response = await handleOtpRequest(otpRequest, env as any, jsonResponse);
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || result.success !== true) {
    return { success: false, error: String(result.error || "تعذر إرسال رمز التحقق."), status: response.status || 503 };
  }
  return {
    success: true,
    target: typeof result.target === "string" ? result.target : undefined,
    expiresInSeconds: typeof result.expiresInSeconds === "number" ? result.expiresInSeconds : undefined
  };
}

function toSafeUserProfile(identityId: string, fullName: string, phone: string, email: string): Record<string, unknown> {
  return {
    id: phone,
    full_name: fullName,
    fullName,
    phone,
    email,
    stores: [],
    sites: [],
    join_date: new Date().toISOString(),
    is_admin: false,
    is_banned: false,
    default_store_id: null,
    auto_launch_default_store: false,
    identity_id: identityId
  };
}

async function persistUserProfile(
  db: AuthDatabase,
  identityId: string,
  fullName: string,
  phone: string,
  email: string
): Promise<void> {
  const profile = toSafeUserProfile(identityId, fullName, phone, email);
  const recordJson = JSON.stringify(profile);
  const digestBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(recordJson));
  const digest = bytesToHex(new Uint8Array(digestBytes));
  await db.prepare(`
    INSERT INTO app_records (
      source_system, source_table, record_key, store_id,
      record_json, record_sha256, source_updated_at, migrated_at
    ) VALUES ('manual', 'users', ?, NULL, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(source_system, source_table, record_key) DO UPDATE SET
      record_json = excluded.record_json,
      record_sha256 = excluded.record_sha256,
      source_updated_at = CURRENT_TIMESTAMP,
      migrated_at = CURRENT_TIMESTAMP
  `).bind(phone, recordJson, digest).run();
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

  if (request.method === "POST" && url.pathname === "/api/v1/auth/register") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const displayName = safeText(body.displayName, 100);
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL_RE.test(email) || email.length > 254 || isSyntheticEmail(email)) {
      return json({ success: false, error: "أدخل بريدًا إلكترونيًا حقيقيًا وصالحًا لاستلام رمز التفعيل." }, 400);
    }
    if (phone.length < 8 || phone.length > 20 || !displayName || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return json({ success: false, error: "أدخل الاسم ورقم الهاتف وكلمة مرور لا تقل عن 10 أحرف." }, 400);
    }

    const duplicate = await env.APP_DB.prepare(`
      SELECT id FROM auth_identities
      WHERE lower(email) = ? OR phone = ? LIMIT 1
    `).bind(email, phone).first<{ id: string }>();
    if (duplicate) return json({ success: false, error: "رقم الهاتف أو البريد مسجل بالفعل. استخدم تسجيل الدخول أو استعادة الحساب." }, 409);

    const identityId = `new:${crypto.randomUUID()}`;
    const encodedHash = await derivePasswordHash(password);
    const idResult = await env.APP_DB.prepare(`
      INSERT INTO auth_identities (
        id, legacy_source, legacy_user_key, email, phone, display_name,
        account_status, password_reset_required, legacy_role_claims_json,
        created_at, updated_at
      ) VALUES (?, 'manual', ?, ?, ?, ?, 'pending_reactivation', 1, '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(identityId, identityId, email, phone, displayName).run();
    if (idResult.success === false || idResult.meta?.changes === 0) {
      return json({ success: false, error: "تعذر إنشاء الهوية." }, 500);
    }

    const credentialResult = await env.APP_DB.prepare(`
      INSERT INTO auth_credentials (
        identity_id, password_hash, password_algorithm,
        password_changed_at, must_change_password
      ) VALUES (?, ?, 'pbkdf2-sha256', CURRENT_TIMESTAMP, 1)
    `).bind(identityId, encodedHash).run();
    if (credentialResult.success === false) {
      return json({ success: false, error: "تعذر حفظ بيانات الدخول." }, 500);
    }

    await persistUserProfile(env.APP_DB, identityId, displayName, phone, email);
    await env.APP_DB.prepare(`
      INSERT INTO migration_audit (
        id, source_system, source_table, record_key, action, detail_json, created_at
      ) VALUES (?, 'manual', 'auth_registration', ?, 'copied', ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(),
      identityId,
      JSON.stringify({ emailVerified: false, roleGranted: false, credential: "user_supplied_password_hash" })
    ).run();

    return json({
      success: true,
      requiresEmailVerification: true,
      user: { id: identityId, email, phone, fullName: displayName }
    }, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/send-account-activation") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    if (!EMAIL_RE.test(email) || phone.length < 8) {
      return json({ success: false, error: "بيانات الحساب غير مكتملة." }, 400);
    }
    const identity = await env.APP_DB.prepare(`
      SELECT id, email, phone, display_name, account_status
      FROM auth_identities
      WHERE phone = ? AND lower(email) = ?
      LIMIT 1
    `).bind(phone, email).first<AuthIdentity>();
    if (!identity) return json({ success: false, error: "بيانات الحساب غير متطابقة." }, 404);
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "هذا الحساب موقوف." }, 403);
    }
    const sent = await sendEmailOtp(request, env, jsonResponse, email, (safeText(body.userName, 100) || identity.display_name || "1Toolz"));
    if (!sent.success) return json({ success: false, error: sent.error }, sent.status || 503);
    return json({ success: true, emailSent: true, target: sent.target, expiresInSeconds: sent.expiresInSeconds });
  }

  if (request.method === "POST" && url.pathname === "/api/verify-account-activation") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const otp = String(body.code ?? "").trim();
    if (!EMAIL_RE.test(email) || phone.length < 8 || !/^\\d{6}$/.test(otp)) {
      return json({ success: false, error: "رقم الهاتف والبريد وكود التفعيل مطلوبون." }, 400);
    }
    const identity = await env.APP_DB.prepare(`
      SELECT id, email, phone, display_name, account_status
      FROM auth_identities WHERE phone = ? AND lower(email) = ? LIMIT 1
    `).bind(phone, email).first<AuthIdentity>();
    if (!identity) return json({ success: false, error: "الحساب غير موجود أو بياناته غير متطابقة." }, 404);
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "هذا الحساب موقوف." }, 403);
    }

    const verification = await verifyEmailOtp(request, env, jsonResponse, email, otp);
    if (!verification.valid) return json({ success: false, error: verification.error }, verification.status || 400);

    await env.APP_DB.prepare(`
      UPDATE auth_credentials
      SET must_change_password = 0, password_changed_at = CURRENT_TIMESTAMP
      WHERE identity_id = ?
    `).bind(identity.id).run();
    await env.APP_DB.prepare(`
      UPDATE auth_identities
      SET account_status = 'active', password_reset_required = 0,
          verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(identity.id).run();
    await env.APP_DB.prepare(`
      UPDATE store_memberships SET status='active', updated_at=CURRENT_TIMESTAMP
      WHERE identity_id=? AND status='pending_verification'
    `).bind(identity.id).run();
    await env.APP_DB.prepare(`
      INSERT INTO migration_audit (
        id, source_system, source_table, record_key, action, detail_json, created_at
      ) VALUES (?, 'manual', 'auth_activation', ?, 'verified', ?, CURRENT_TIMESTAMP)
    `).bind(
      crypto.randomUUID(), identity.id,
      JSON.stringify({ verifiedBy: "email_otp", newIdentityActivation: true })
    ).run();

    const token = await createSession(env.APP_DB, env.SESSION_HASH_SECRET, identity.id, request);
    return json({
      success: true,
      message: "تم تفعيل الحساب بنجاح.",
      user: { id: identity.id, email: identity.email, phone: identity.phone, fullName: identity.display_name }
    }, 200, { "set-cookie": setSessionCookie(token) });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/password/change") {
    const context = await getAuthContext(request, env);
    if (!context) return json({ success: false, error: "يجب تسجيل الدخول أولًا." }, 401);
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.password === "string" ? body.password : typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 128) {
      return json({ success: false, error: "كلمة المرور الجديدة يجب ألا تقل عن 10 أحرف." }, 400);
    }
    const current = await env.APP_DB.prepare(
      "SELECT password_hash FROM auth_credentials WHERE identity_id = ? LIMIT 1"
    ).bind(context.identityId).first<{ password_hash: string | null }>();
    if (!current?.password_hash || (currentPassword && !await verifyPassword(currentPassword, current.password_hash))) {
      return json({ success: false, error: "كلمة المرور الحالية غير صحيحة." }, 403);
    }
    const passwordHash = await derivePasswordHash(newPassword);
    await env.APP_DB.prepare(`
      UPDATE auth_credentials SET password_hash=?, password_algorithm='pbkdf2-sha256',
        password_changed_at=CURRENT_TIMESTAMP, must_change_password=0
      WHERE identity_id=?
    `).bind(passwordHash, context.identityId).run();
    await env.APP_DB.prepare(`
      UPDATE auth_identities SET password_reset_required=0, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).bind(context.identityId).run();
    await env.APP_DB.prepare(`
      UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP
      WHERE identity_id=? AND revoked_at IS NULL
    `).bind(context.identityId).run();
    const token = await createSession(env.APP_DB, env.SESSION_HASH_SECRET, context.identityId, request);
    return json({ success: true, message: "تم تغيير كلمة المرور بنجاح." }, 200, { "set-cookie": setSessionCookie(token) });
  }

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
    const identifier = safeText(body.phoneOrEmail || body.phone || body.email, 254);
    const emailInput = normalizeEmail(identifier);
    const phoneInput = normalizePhone(identifier);
    if (!identifier || (!EMAIL_RE.test(emailInput) && (phoneInput.length < 8 || phoneInput.length > 20))) {
      return json({ success: false, error: "رقم الهاتف أو البريد غير صالح." }, 400);
    }
    const byEmail = EMAIL_RE.test(emailInput);
    const identity = await env.APP_DB.prepare("SELECT id, email, phone, display_name, account_status FROM auth_identities WHERE (? <> '' AND lower(email) = ?) OR (? <> '' AND phone = ?) ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END, created_at DESC LIMIT 2")
      .bind(byEmail ? emailInput : "", byEmail ? emailInput : "", byEmail ? "" : phoneInput, byEmail ? "" : phoneInput)
      .first<{ id: string; email: string | null; phone: string | null; display_name: string | null; account_status: string }>();
    if (!identity || !identity.email || !EMAIL_RE.test(identity.email) || isSyntheticEmail(identity.email)) {
      return json({ success: true, message: "لو الحساب مرتبط ببريد موثق، هيوصله رمز استعادة. بعض الحسابات القديمة تحتاج مراجعة الإدارة." });
    }
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: true, message: "لو الحساب مؤهل للاستعادة، هيوصله رمز التحقق." });
    }
    const sent = await sendEmailOtp(request, env, jsonResponse, identity.email, identity.display_name || "1Toolz");
    if (!sent.success) return json({ success: false, error: sent.error }, sent.status || 503);
    return json({ success: true, message: "تم إرسال رمز الاستعادة إلى البريد المسجل بالحساب.", target: sent.target, expiresInSeconds: sent.expiresInSeconds });
  }

  if (request.method === "POST" && url.pathname === "/api/v1/auth/recovery/complete") {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const identifier = safeText(body.phoneOrEmail || body.phone || body.email, 254);
    const emailInput = normalizeEmail(identifier);
    const phone = normalizePhone(identifier);
    const otp = String(body.otp ?? "").trim();
    const password = typeof body.newPassword === "string" ? body.newPassword : "";
    const byEmail = EMAIL_RE.test(emailInput);
    if ((!byEmail && phone.length < 8) || !/^\\d{6}$/.test(otp) || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return json({ success: false, error: "تأكد من رقم الهاتف أو البريد ورمز التحقق، واجعل كلمة المرور 10 أحرف على الأقل." }, 400);
    }
    const identity = await env.APP_DB.prepare("SELECT id, email, account_status FROM auth_identities WHERE (? <> '' AND phone = ?) OR (? <> '' AND lower(email) = ?) ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END LIMIT 1")
      .bind(byEmail ? "" : phone, byEmail ? "" : phone, byEmail ? emailInput : "", byEmail ? emailInput : "")
      .first<{ id: string; email: string | null; account_status: string }>();
    if (!identity || !identity.email || !EMAIL_RE.test(identity.email) || isSyntheticEmail(identity.email)) {
      return json({ success: false, error: "لا يوجد بريد موثق لاستعادة هذا الحساب. تواصل مع الإدارة للتحقق من الملكية." }, 403);
    }
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "هذا الحساب موقوف. تواصل مع إدارة المنصة." }, 403);
    }
    const verification = await verifyEmailOtp(request, env, jsonResponse, identity.email, otp);
    if (!verification.valid) return json({ success: false, error: verification.error || "رمز الاستعادة غير صحيح." }, verification.status || 400);
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
