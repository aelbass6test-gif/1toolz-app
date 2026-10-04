export interface OtpEnv {
  APP_ORIGIN?: string;
  OTP_DB?: OtpDatabase;
  OTP_HASH_SECRET?: string;
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
  OTP_RESEND_FROM?: string;
  OTP_BREVO_FROM?: string;
  OTP_FROM_NAME?: string;
  OTP_RESEND_DAILY_LIMIT?: string;
  OTP_BREVO_DAILY_LIMIT?: string;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface OtpDatabase {
  prepare(query: string): D1PreparedStatement;
}

type JsonResponse = (request: Request, env: any, body: unknown, status?: number) => Response;

type ProviderName = "resend" | "brevo";

const OTP_TTL_MS = 5 * 60 * 1000;
const SEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 10 * 60 * 1000;
const IP_WINDOW_MS = 60 * 60 * 1000;
const IP_SEND_LIMIT = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface OtpRow {
  identifier: string;
  email: string;
  code_hash: string;
  created_at: number;
  expires_at: number;
  attempts: number;
  locked_until: number;
  verified_at: number | null;
}

interface AttemptRow {
  attempts: number;
  locked_until: number;
}

interface SendLimitRow {
  window_started: number;
  count: number;
}

interface ProviderStateRow {
  disabled_until: number;
}

export async function handleOtpRequest(
  request: Request,
  env: OtpEnv,
  json: JsonResponse
): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  if (request.method !== "POST") {
    return json(request, env, { success: false, error: "طريقة الطلب غير مدعومة." }, 405);
  }
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) {
    return json(request, env, {
      success: false,
      error: "خدمة التحقق غير مهيأة حاليًا. يرجى المحاولة لاحقًا.",
      code: "OTP_NOT_CONFIGURED"
    }, 503);
  }

  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOtpOrigin(origin, env)) {
    return json(request, env, { success: false, error: "مصدر الطلب غير مسموح." }, 403);
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return json(request, env, { success: false, error: "عنوان البريد الإلكتروني غير صالح." }, 400);
  }

  if (pathname === "/api/send-otp") {
    return sendOtp(request, env, json, email, body.userName);
  }
  if (pathname === "/api/verify-otp") {
    return verifyOtp(request, env, json, email, body.otp);
  }
  return json(request, env, { success: false, error: "مسار API غير موجود." }, 404);
}

async function sendOtp(
  request: Request,
  env: OtpEnv,
  json: JsonResponse,
  email: string,
  requestedName: unknown
): Promise<Response> {
  const db = env.OTP_DB!;
  const now = Date.now();

  await db.prepare(
    "DELETE FROM otp_challenges WHERE expires_at < ? OR (verified_at IS NOT NULL AND verified_at < ?)"
  ).bind(now, now - 24 * 60 * 60 * 1000).run();
  await db.prepare("DELETE FROM otp_send_limits WHERE window_started < ?")
    .bind(now - 24 * 60 * 60 * 1000).run();
  await db.prepare("DELETE FROM otp_provider_state WHERE disabled_until <= ?")
    .bind(now).run();
  await db.prepare("DELETE FROM otp_provider_usage WHERE day_utc < ?")
    .bind(new Date(now - 35 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)).run();

  const current = await db.prepare(
    "SELECT identifier, email, code_hash, created_at, expires_at, attempts, locked_until, verified_at FROM otp_challenges WHERE identifier = ?"
  ).bind(email).first<OtpRow>();

  if (current?.locked_until && current.locked_until > now) {
    const retryAfterSeconds = Math.ceil((current.locked_until - now) / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return json(request, env, {
      success: false,
      error: `تم قفل المحاولات مؤقتًا. يرجى الانتظار ${minutes} دقيقة.`,
      retryAfterSeconds
    }, 429);
  }

  const cooldownRemaining = current ? current.created_at + SEND_COOLDOWN_MS - now : 0;
  if (cooldownRemaining > 0) {
    return json(request, env, {
      success: false,
      error: "تم إرسال رمز مؤخرًا. يرجى الانتظار قبل طلب رمز جديد.",
      retryAfterSeconds: Math.ceil(cooldownRemaining / 1000)
    }, 429);
  }

  if (!env.RESEND_API_KEY && !env.BREVO_API_KEY) {
    return json(request, env, {
      success: false,
      error: "لم يتم تهيئة خدمة إرسال البريد بعد.",
      code: "OTP_EMAIL_NOT_CONFIGURED"
    }, 503);
  }

  const ipLimit = await checkIpSendLimit(request, env, now);
  if (!ipLimit.allowed) {
    return json(request, env, {
      success: false,
      error: "تم تجاوز عدد طلبات الرموز المسموح به من هذا الاتصال. يرجى المحاولة لاحقًا.",
      retryAfterSeconds: ipLimit.retryAfterSeconds
    }, 429);
  }

  const code = generateOtp();
  const codeHash = await hashValue(env.OTP_HASH_SECRET!, `otp:${email}:${code}`);
  const reserved = await db.prepare(`
    INSERT INTO otp_challenges
      (identifier, email, code_hash, created_at, expires_at, attempts, locked_until, verified_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, NULL)
    ON CONFLICT(identifier) DO UPDATE SET
      email = excluded.email,
      code_hash = excluded.code_hash,
      created_at = excluded.created_at,
      expires_at = excluded.expires_at,
      attempts = 0,
      locked_until = 0,
      verified_at = NULL
    WHERE otp_challenges.locked_until <= ?
      AND otp_challenges.created_at <= ?
    RETURNING identifier
  `).bind(email, email, codeHash, now, now + OTP_TTL_MS, now, now - SEND_COOLDOWN_MS)
    .first<{ identifier: string }>();

  if (!reserved) {
    const latest = await db.prepare(
      "SELECT created_at, locked_until FROM otp_challenges WHERE identifier = ?"
    ).bind(email).first<{ created_at: number; locked_until: number }>();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(Math.max((latest?.locked_until || 0) - now, (latest?.created_at || now) + SEND_COOLDOWN_MS - now) / 1000)
    );
    return json(request, env, {
      success: false,
      error: "تم طلب رمز مؤخرًا. يرجى الانتظار قليلًا ثم المحاولة مجددًا.",
      retryAfterSeconds
    }, 429);
  }

  const userName = safeText(requestedName, "المستخدم العزيز", 80);
  const delivery = await sendWithFailover(env, email, userName, code, now);
  if (!delivery.success) {
    await db.prepare("DELETE FROM otp_challenges WHERE identifier = ? AND code_hash = ?")
      .bind(email, codeHash).run();
    console.error("[OTP] No configured email provider accepted the message.");
    return json(request, env, {
      success: false,
      error: "تعذر إرسال رمز التحقق الآن. يرجى المحاولة لاحقًا أو التواصل مع الدعم."
    }, 503);
  }

  const target = maskEmail(email);
  return json(request, env, {
    success: true,
    message: `تم إرسال رمز التحقق إلى بريدك الإلكتروني (${target}). يرجى إدخال الرمز لتسجيل الدخول.`,
    target,
    email,
    emailSent: true,
    cooldown: SEND_COOLDOWN_MS / 1000,
    expiresInSeconds: OTP_TTL_MS / 1000
  });
}

async function verifyOtp(
  request: Request,
  env: OtpEnv,
  json: JsonResponse,
  email: string,
  inputOtp: unknown
): Promise<Response> {
  const otp = String(inputOtp ?? "").trim();
  if (!/^\d{6}$/.test(otp)) {
    return json(request, env, { valid: false, message: "يجب إدخال رمز تحقق مكون من 6 أرقام." }, 400);
  }

  const db = env.OTP_DB!;
  const now = Date.now();
  const row = await db.prepare(
    "SELECT identifier, email, code_hash, created_at, expires_at, attempts, locked_until, verified_at FROM otp_challenges WHERE identifier = ?"
  ).bind(email).first<OtpRow>();

  if (row?.locked_until && row.locked_until > now) {
    const retryAfterSeconds = Math.ceil((row.locked_until - now) / 1000);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return json(request, env, {
      valid: false,
      message: `تم قفل الحساب مؤقتًا. يرجى الانتظار ${minutes} دقيقة.`,
      retryAfterSeconds
    }, 429);
  }

  if (!row || row.expires_at < now || !row.code_hash || row.verified_at) {
    return json(request, env, {
      valid: false,
      message: "رمز التحقق غير موجود أو منتهي الصلاحية أو مستخدم. يرجى طلب رمز جديد."
    }, 400);
  }

  const submittedHash = await hashValue(env.OTP_HASH_SECRET!, `otp:${email}:${otp}`);
  if (!constantTimeEqual(row.code_hash, submittedHash)) {
    const updated = await db.prepare(`
      UPDATE otp_challenges
      SET attempts = attempts + 1,
          locked_until = CASE WHEN attempts + 1 >= ? THEN ? ELSE locked_until END,
          code_hash = CASE WHEN attempts + 1 >= ? THEN '' ELSE code_hash END
      WHERE identifier = ? AND code_hash = ? AND expires_at >= ? AND locked_until <= ?
      RETURNING attempts, locked_until
    `).bind(MAX_ATTEMPTS, now + LOCKOUT_MS, MAX_ATTEMPTS, email, row.code_hash, now, now)
      .first<AttemptRow>();

    const attempts = updated?.attempts ?? row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      return json(request, env, {
        valid: false,
        message: "تم تجاوز الحد الأقصى للمحاولات (3 محاولات). تم قفل المحاولات لمدة 10 دقائق.",
        retryAfterSeconds: LOCKOUT_MS / 1000
      }, 429);
    }
    const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
    return json(request, env, {
      valid: false,
      message: `رمز التحقق غير صحيح. متبقي ${remaining} ${remaining === 1 ? "محاولة واحدة" : "محاولات"}.`
    }, 400);
  }

  const verified = await db.prepare(`
    UPDATE otp_challenges
    SET code_hash = '', verified_at = ?
    WHERE identifier = ? AND code_hash = ? AND expires_at >= ? AND locked_until <= ? AND verified_at IS NULL
    RETURNING identifier
  `).bind(now, email, row.code_hash, now, now).first<{ identifier: string }>();

  if (!verified) {
    return json(request, env, {
      valid: false,
      message: "رمز التحقق غير موجود أو منتهي الصلاحية أو مستخدم. يرجى طلب رمز جديد."
    }, 400);
  }

  return json(request, env, { valid: true, message: "تم التحقق من الرمز بنجاح." });
}

async function checkIpSendLimit(
  request: Request,
  env: OtpEnv,
  now: number
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (!ip) return { allowed: false, retryAfterSeconds: Math.ceil(IP_WINDOW_MS / 1000) };

  const key = await hashValue(env.OTP_HASH_SECRET!, `ip:${ip}`);
  const row = await env.OTP_DB!.prepare(`
    INSERT INTO otp_send_limits (ip_hash, window_started, count)
    VALUES (?, ?, 1)
    ON CONFLICT(ip_hash) DO UPDATE SET
      count = CASE
        WHEN otp_send_limits.window_started + ? <= ? THEN 1
        WHEN otp_send_limits.count <= ? THEN otp_send_limits.count + 1
        ELSE otp_send_limits.count
      END,
      window_started = CASE WHEN otp_send_limits.window_started + ? <= ? THEN ? ELSE otp_send_limits.window_started END
    RETURNING window_started, count
  `).bind(key, now, IP_WINDOW_MS, now, IP_SEND_LIMIT, IP_WINDOW_MS, now, now).first<SendLimitRow>();

  if (!row || row.count <= IP_SEND_LIMIT) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((row.window_started + IP_WINDOW_MS - now) / 1000))
  };
}

async function sendWithFailover(
  env: OtpEnv,
  email: string,
  userName: string,
  code: string,
  now: number
): Promise<{ success: boolean }> {
  const providers: ProviderName[] = [];
  if (env.RESEND_API_KEY) providers.push("resend");
  if (env.BREVO_API_KEY) providers.push("brevo");

  for (const provider of providers) {
    const state = await env.OTP_DB!.prepare(
      "SELECT disabled_until FROM otp_provider_state WHERE provider = ?"
    ).bind(provider).first<ProviderStateRow>();
    if (state?.disabled_until && state.disabled_until > now) continue;

    if (!await reserveProviderDailySend(env, provider, now)) {
      await disableProviderUntilNextUtcDay(env, provider, now, "daily_app_limit");
      console.warn(`[OTP] ${provider} reached the configured daily send cap; trying the next provider.`);
      continue;
    }

    const result = await trySendWithProvider(env, provider, email, userName, code);
    if (result.accepted) return { success: true };

    const quotaError = result.status === 429 || /quota|daily|monthly|credit|volume/i.test(result.errorType || "");
    if (quotaError) {
      if (result.status !== 429 || result.errorType !== "daily_quota_exceeded" && result.errorType !== "monthly_quota_exceeded") {
        // A failed request is not counted as an email in the provider's daily cap.
        await releaseProviderDailySend(env, provider, now);
      }
      const disabledUntil = quotaResetTime(provider, result.headers, result.errorType, now);
      await env.OTP_DB!.prepare(`
        INSERT INTO otp_provider_state (provider, disabled_until, reason)
        VALUES (?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET
          disabled_until = excluded.disabled_until,
          reason = excluded.reason
      `).bind(provider, disabledUntil, result.errorType || "rate_limit").run();
      console.warn(`[OTP] ${provider} reported an exhausted quota or request limit; disabled until reset, trying the next provider.`);
      continue;
    }

    if (result.status !== undefined && result.status >= 400 && result.status < 500) {
      // A definitive provider rejection cannot have delivered the email, so trying the backup is safe.
      await releaseProviderDailySend(env, provider, now);
      console.warn(`[OTP] ${provider} rejected the request with HTTP ${result.status}; trying the next provider.`);
      continue;
    }

    // For timeouts and server errors the first provider may have accepted the message before failing;
    // avoid sending a duplicate code through the backup provider.
    console.warn(`[OTP] ${provider} outcome is uncertain; not attempting a second send.`);
    return { success: false };
  }

  return { success: false };
}

async function reserveProviderDailySend(env: OtpEnv, provider: ProviderName, now: number): Promise<boolean> {
  const configuredLimit = Number(provider === "resend" ? env.OTP_RESEND_DAILY_LIMIT : env.OTP_BREVO_DAILY_LIMIT);
  const dailyLimit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : provider === "resend" ? 100 : 300;
  const day = new Date(now).toISOString().slice(0, 10);
  const reservation = await env.OTP_DB!.prepare(`
    INSERT INTO otp_provider_usage (provider, day_utc, send_count)
    VALUES (?, ?, 1)
    ON CONFLICT(provider, day_utc) DO UPDATE SET
      send_count = otp_provider_usage.send_count + 1
    WHERE otp_provider_usage.send_count < ?
    RETURNING send_count
  `).bind(provider, day, dailyLimit).first<{ send_count: number }>();
  return !!reservation;
}

async function releaseProviderDailySend(env: OtpEnv, provider: ProviderName, now: number): Promise<void> {
  await env.OTP_DB!.prepare(`
    UPDATE otp_provider_usage
    SET send_count = CASE WHEN send_count > 0 THEN send_count - 1 ELSE 0 END
    WHERE provider = ? AND day_utc = ?
  `).bind(provider, new Date(now).toISOString().slice(0, 10)).run();
}

async function disableProviderUntilNextUtcDay(env: OtpEnv, provider: ProviderName, now: number, reason: string): Promise<void> {
  const date = new Date(now);
  const resetAt = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  await env.OTP_DB!.prepare(`
    INSERT INTO otp_provider_state (provider, disabled_until, reason)
    VALUES (?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET disabled_until = excluded.disabled_until, reason = excluded.reason
  `).bind(provider, resetAt, reason).run();
}

async function trySendWithProvider(
  env: OtpEnv,
  provider: ProviderName,
  email: string,
  userName: string,
  code: string
): Promise<{ accepted: boolean; status?: number; headers?: Headers; errorType?: string }> {
  const fromName = safeText(env.OTP_FROM_NAME, "AbdoMedia Prime", 80);
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#172033"><h2>رمز التحقق لتسجيل الدخول</h2><p>مرحبًا ${escapeHtml(userName)}،</p><p>رمز التحقق الخاص بك:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0;color:#0f9f83">${code}</div><p>ينتهي هذا الرمز خلال 5 دقائق. لا تشاركه مع أي شخص.</p></div>`;
  const text = `رمز التحقق الخاص بك: ${code}. ينتهي خلال 5 دقائق. لا تشاركه مع أي شخص.`;

  try {
    let response: Response;
    if (provider === "resend") {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: formatResendFrom(env.OTP_RESEND_FROM, fromName),
          to: [email],
          subject: "رمز التحقق لتسجيل الدخول",
          html,
          text
        }),
        signal: AbortSignal.timeout(8000)
      });
    } else {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY!,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          sender: { name: fromName, email: normalizeSenderEmail(env.OTP_BREVO_FROM || "") },
          to: [{ email, name: userName }],
          subject: "رمز التحقق لتسجيل الدخول",
          htmlContent: html,
          textContent: text
        }),
        signal: AbortSignal.timeout(8000)
      });
    }

    if (response.ok) return { accepted: true };
    const payload = await response.json().catch(() => ({} as Record<string, unknown>)) as Record<string, unknown>;
    const errorType = provider === "resend"
      ? safeText(payload?.name || payload?.type || payload?.code, "", 80)
      : safeText(payload?.code || payload?.message, "", 80);
    return { accepted: false, status: response.status, headers: response.headers, errorType };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.warn(`[OTP] ${provider} request failed (${name}).`);
    return { accepted: false };
  }
}

function quotaResetTime(provider: ProviderName, headers: Headers | undefined, errorType: string | undefined, now: number): number {
  const retryAfter = Number(headers?.get("retry-after"));
  const brevoReset = Number(headers?.get("x-sib-ratelimit-reset"));
  const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : brevoReset;
  if (Number.isFinite(seconds) && seconds > 0) return now + seconds * 1000;

  if (provider === "resend" && errorType === "monthly_quota_exceeded") {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  if (/rate.?limit|too_many_requests/i.test(errorType || "")) return now + 60 * 1000;
  if (provider === "resend" && errorType === "daily_quota_exceeded") {
    const date = new Date(now);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  }
  if (provider === "brevo") return now + 60 * 1000;
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}

async function hashValue(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signed), value => value.toString(16).padStart(2, "0")).join("");
}

function generateOtp(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

function normalizeSenderEmail(value: string): string {
  const sender = value.trim();
  const match = sender.match(/<([^>]+)>/);
  return (match?.[1] || sender).trim().toLowerCase();
}

function formatResendFrom(value: string | undefined, name: string): string {
  const sender = (value || "").trim();
  const match = sender.match(/<([^>]+)>/);
  const email = (match?.[1] || sender).trim();
  return email ? `${name} <${email}>` : "";
}

function safeText(value: unknown, fallback: string, maxLength: number): string {
  const text = typeof value === "string" ? value.replace(/[\r\n\u0000-\u001f]/g, " ").trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]!);
}

function isAllowedOtpOrigin(origin: string, env?: OtpEnv): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();

    // 1. Explicitly configured production APP_ORIGIN in Cloudflare Worker env (e.g. https://app.abdomedi.com)
    if (env?.APP_ORIGIN) {
      try {
        const appUrl = new URL(env.APP_ORIGIN);
        if (appUrl.hostname.toLowerCase() === hostname) return true;
      } catch {
        if (env.APP_ORIGIN.toLowerCase() === origin.toLowerCase()) return true;
      }
    }

    // 2. Production domains and all store subdomains (*.abdomedi.com)
    if (hostname === "abdomedi.com" || hostname.endsWith(".abdomedi.com")) {
      return true;
    }

    // 3. Staging and development environments (Google AI Studio Cloud Run preview & localhost)
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    if (hostname.endsWith(".run.app") && hostname.includes("ais-")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
