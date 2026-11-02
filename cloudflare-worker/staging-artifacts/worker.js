// src/otp.ts
var OTP_TTL_MS = 5 * 60 * 1e3;
var SEND_COOLDOWN_MS = 60 * 1e3;
var MAX_ATTEMPTS = 3;
var LOCKOUT_MS = 10 * 60 * 1e3;
var IP_WINDOW_MS = 60 * 60 * 1e3;
var IP_SEND_LIMIT = 10;
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function handleOtpRequest(request, env, json4) {
  const pathname = new URL(request.url).pathname;
  if (request.method !== "POST") {
    return json4(request, env, { success: false, error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." }, 405);
  }
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) {
    return json4(request, env, {
      success: false,
      error: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.",
      code: "OTP_NOT_CONFIGURED"
    }, 503);
  }
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOtpOrigin(origin, env)) {
    return json4(request, env, { success: false, error: "\u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D." }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return json4(request, env, { success: false, error: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 400);
  }
  if (pathname === "/api/send-otp") {
    return sendOtp(request, env, json4, email, body.userName);
  }
  if (pathname === "/api/verify-otp") {
    return verifyOtp(request, env, json4, email, body.otp);
  }
  return json4(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 API \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." }, 404);
}
async function sendOtp(request, env, json4, email, requestedName) {
  const db = env.OTP_DB;
  const now = Date.now();
  await db.prepare(
    "DELETE FROM otp_challenges WHERE expires_at < ? OR (verified_at IS NOT NULL AND verified_at < ?)"
  ).bind(now, now - 24 * 60 * 60 * 1e3).run();
  await db.prepare("DELETE FROM otp_send_limits WHERE window_started < ?").bind(now - 24 * 60 * 60 * 1e3).run();
  await db.prepare("DELETE FROM otp_provider_state WHERE disabled_until <= ?").bind(now).run();
  await db.prepare("DELETE FROM otp_provider_usage WHERE day_utc < ?").bind(new Date(now - 35 * 24 * 60 * 60 * 1e3).toISOString().slice(0, 10)).run();
  const current = await db.prepare(
    "SELECT identifier, email, code_hash, created_at, expires_at, attempts, locked_until, verified_at FROM otp_challenges WHERE identifier = ?"
  ).bind(email).first();
  if (current?.locked_until && current.locked_until > now) {
    const retryAfterSeconds = Math.ceil((current.locked_until - now) / 1e3);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return json4(request, env, {
      success: false,
      error: `\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${minutes} \u062F\u0642\u064A\u0642\u0629.`,
      retryAfterSeconds
    }, 429);
  }
  const cooldownRemaining = current ? current.created_at + SEND_COOLDOWN_MS - now : 0;
  if (cooldownRemaining > 0) {
    return json4(request, env, {
      success: false,
      error: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0645\u0624\u062E\u0631\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.",
      retryAfterSeconds: Math.ceil(cooldownRemaining / 1e3)
    }, 429);
  }
  if (!env.RESEND_API_KEY && !env.BREVO_API_KEY) {
    return json4(request, env, {
      success: false,
      error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0647\u064A\u0626\u0629 \u062E\u062F\u0645\u0629 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0628\u0639\u062F.",
      code: "OTP_EMAIL_NOT_CONFIGURED"
    }, 503);
  }
  const ipLimit = await checkIpSendLimit(request, env, now);
  if (!ipLimit.allowed) {
    return json4(request, env, {
      success: false,
      error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0631\u0645\u0648\u0632 \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647 \u0645\u0646 \u0647\u0630\u0627 \u0627\u0644\u0627\u062A\u0635\u0627\u0644. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.",
      retryAfterSeconds: ipLimit.retryAfterSeconds
    }, 429);
  }
  const code = generateOtp();
  const codeHash = await hashValue(env.OTP_HASH_SECRET, `otp:${email}:${code}`);
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
  `).bind(email, email, codeHash, now, now + OTP_TTL_MS, now, now - SEND_COOLDOWN_MS).first();
  if (!reserved) {
    const latest = await db.prepare(
      "SELECT created_at, locked_until FROM otp_challenges WHERE identifier = ?"
    ).bind(email).first();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(Math.max((latest?.locked_until || 0) - now, (latest?.created_at || now) + SEND_COOLDOWN_MS - now) / 1e3)
    );
    return json4(request, env, {
      success: false,
      error: "\u062A\u0645 \u0637\u0644\u0628 \u0631\u0645\u0632 \u0645\u0624\u062E\u0631\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u062B\u0645 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u064B\u0627.",
      retryAfterSeconds
    }, 429);
  }
  const userName = safeText(requestedName, "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u0639\u0632\u064A\u0632", 80);
  const delivery = await sendWithFailover(env, email, userName, code, now);
  if (!delivery.success) {
    await db.prepare("DELETE FROM otp_challenges WHERE identifier = ? AND code_hash = ?").bind(email, codeHash).run();
    console.error("[OTP] No configured email provider accepted the message.");
    return json4(request, env, {
      success: false,
      error: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0622\u0646. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627 \u0623\u0648 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645."
    }, 503);
  }
  const target = maskEmail(email);
  return json4(request, env, {
    success: true,
    message: `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0625\u0644\u0649 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A (${target}). \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0645\u0632 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.`,
    target,
    email,
    emailSent: true,
    cooldown: SEND_COOLDOWN_MS / 1e3,
    expiresInSeconds: OTP_TTL_MS / 1e3
  });
}
async function verifyOtp(request, env, json4, email, inputOtp) {
  const otp = String(inputOtp ?? "").trim();
  if (!/^\d{6}$/.test(otp)) {
    return json4(request, env, { valid: false, message: "\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645." }, 400);
  }
  const db = env.OTP_DB;
  const now = Date.now();
  const row = await db.prepare(
    "SELECT identifier, email, code_hash, created_at, expires_at, attempts, locked_until, verified_at FROM otp_challenges WHERE identifier = ?"
  ).bind(email).first();
  if (row?.locked_until && row.locked_until > now) {
    const retryAfterSeconds = Math.ceil((row.locked_until - now) / 1e3);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return json4(request, env, {
      valid: false,
      message: `\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0642\u062A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${minutes} \u062F\u0642\u064A\u0642\u0629.`,
      retryAfterSeconds
    }, 429);
  }
  if (!row || row.expires_at < now || !row.code_hash || row.verified_at) {
    return json4(request, env, {
      valid: false,
      message: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0623\u0648 \u0645\u0633\u062A\u062E\u062F\u0645. \u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F."
    }, 400);
  }
  const submittedHash = await hashValue(env.OTP_HASH_SECRET, `otp:${email}:${otp}`);
  if (!constantTimeEqual(row.code_hash, submittedHash)) {
    const updated = await db.prepare(`
      UPDATE otp_challenges
      SET attempts = attempts + 1,
          locked_until = CASE WHEN attempts + 1 >= ? THEN ? ELSE locked_until END,
          code_hash = CASE WHEN attempts + 1 >= ? THEN '' ELSE code_hash END
      WHERE identifier = ? AND code_hash = ? AND expires_at >= ? AND locked_until <= ?
      RETURNING attempts, locked_until
    `).bind(MAX_ATTEMPTS, now + LOCKOUT_MS, MAX_ATTEMPTS, email, row.code_hash, now, now).first();
    const attempts = updated?.attempts ?? row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      return json4(request, env, {
        valid: false,
        message: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A (3 \u0645\u062D\u0627\u0648\u0644\u0627\u062A). \u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0644\u0645\u062F\u0629 10 \u062F\u0642\u0627\u0626\u0642.",
        retryAfterSeconds: LOCKOUT_MS / 1e3
      }, 429);
    }
    const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
    return json4(request, env, {
      valid: false,
      message: `\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D. \u0645\u062A\u0628\u0642\u064A ${remaining} ${remaining === 1 ? "\u0645\u062D\u0627\u0648\u0644\u0629 \u0648\u0627\u062D\u062F\u0629" : "\u0645\u062D\u0627\u0648\u0644\u0627\u062A"}.`
    }, 400);
  }
  const verified = await db.prepare(`
    UPDATE otp_challenges
    SET code_hash = '', verified_at = ?
    WHERE identifier = ? AND code_hash = ? AND expires_at >= ? AND locked_until <= ? AND verified_at IS NULL
    RETURNING identifier
  `).bind(now, email, row.code_hash, now, now).first();
  if (!verified) {
    return json4(request, env, {
      valid: false,
      message: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0623\u0648 \u0645\u0633\u062A\u062E\u062F\u0645. \u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F."
    }, 400);
  }
  return json4(request, env, { valid: true, message: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0628\u0646\u062C\u0627\u062D." });
}
async function checkIpSendLimit(request, env, now) {
  const ip = request.headers.get("CF-Connecting-IP")?.trim();
  if (!ip) return { allowed: false, retryAfterSeconds: Math.ceil(IP_WINDOW_MS / 1e3) };
  const key = await hashValue(env.OTP_HASH_SECRET, `ip:${ip}`);
  const row = await env.OTP_DB.prepare(`
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
  `).bind(key, now, IP_WINDOW_MS, now, IP_SEND_LIMIT, IP_WINDOW_MS, now, now).first();
  if (!row || row.count <= IP_SEND_LIMIT) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((row.window_started + IP_WINDOW_MS - now) / 1e3))
  };
}
async function sendWithFailover(env, email, userName, code, now) {
  const providers = [];
  if (env.RESEND_API_KEY) providers.push("resend");
  if (env.BREVO_API_KEY) providers.push("brevo");
  for (const provider of providers) {
    const state = await env.OTP_DB.prepare(
      "SELECT disabled_until FROM otp_provider_state WHERE provider = ?"
    ).bind(provider).first();
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
        await releaseProviderDailySend(env, provider, now);
      }
      const disabledUntil = quotaResetTime(provider, result.headers, result.errorType, now);
      await env.OTP_DB.prepare(`
        INSERT INTO otp_provider_state (provider, disabled_until, reason)
        VALUES (?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET
          disabled_until = excluded.disabled_until,
          reason = excluded.reason
      `).bind(provider, disabledUntil, result.errorType || "rate_limit").run();
      console.warn(`[OTP] ${provider} reported an exhausted quota or request limit; disabled until reset, trying the next provider.`);
      continue;
    }
    if (result.status !== void 0 && result.status >= 400 && result.status < 500) {
      await releaseProviderDailySend(env, provider, now);
      console.warn(`[OTP] ${provider} rejected the request with HTTP ${result.status}; trying the next provider.`);
      continue;
    }
    console.warn(`[OTP] ${provider} outcome is uncertain; not attempting a second send.`);
    return { success: false };
  }
  return { success: false };
}
async function reserveProviderDailySend(env, provider, now) {
  const configuredLimit = Number(provider === "resend" ? env.OTP_RESEND_DAILY_LIMIT : env.OTP_BREVO_DAILY_LIMIT);
  const dailyLimit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : provider === "resend" ? 100 : 300;
  const day = new Date(now).toISOString().slice(0, 10);
  const reservation = await env.OTP_DB.prepare(`
    INSERT INTO otp_provider_usage (provider, day_utc, send_count)
    VALUES (?, ?, 1)
    ON CONFLICT(provider, day_utc) DO UPDATE SET
      send_count = otp_provider_usage.send_count + 1
    WHERE otp_provider_usage.send_count < ?
    RETURNING send_count
  `).bind(provider, day, dailyLimit).first();
  return !!reservation;
}
async function releaseProviderDailySend(env, provider, now) {
  await env.OTP_DB.prepare(`
    UPDATE otp_provider_usage
    SET send_count = CASE WHEN send_count > 0 THEN send_count - 1 ELSE 0 END
    WHERE provider = ? AND day_utc = ?
  `).bind(provider, new Date(now).toISOString().slice(0, 10)).run();
}
async function disableProviderUntilNextUtcDay(env, provider, now, reason) {
  const date = new Date(now);
  const resetAt = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  await env.OTP_DB.prepare(`
    INSERT INTO otp_provider_state (provider, disabled_until, reason)
    VALUES (?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET disabled_until = excluded.disabled_until, reason = excluded.reason
  `).bind(provider, resetAt, reason).run();
}
async function trySendWithProvider(env, provider, email, userName, code) {
  const fromName = safeText(env.OTP_FROM_NAME, "AbdoMedia Prime", 80);
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#172033"><h2>\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644</h2><p>\u0645\u0631\u062D\u0628\u064B\u0627 ${escapeHtml(userName)}\u060C</p><p>\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 0;color:#0f9f83">${code}</div><p>\u064A\u0646\u062A\u0647\u064A \u0647\u0630\u0627 \u0627\u0644\u0631\u0645\u0632 \u062E\u0644\u0627\u0644 5 \u062F\u0642\u0627\u0626\u0642. \u0644\u0627 \u062A\u0634\u0627\u0631\u0643\u0647 \u0645\u0639 \u0623\u064A \u0634\u062E\u0635.</p></div>`;
  const text = `\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u062E\u0627\u0635 \u0628\u0643: ${code}. \u064A\u0646\u062A\u0647\u064A \u062E\u0644\u0627\u0644 5 \u062F\u0642\u0627\u0626\u0642. \u0644\u0627 \u062A\u0634\u0627\u0631\u0643\u0647 \u0645\u0639 \u0623\u064A \u0634\u062E\u0635.`;
  try {
    let response;
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
          subject: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
          html,
          text
        }),
        signal: AbortSignal.timeout(8e3)
      });
    } else {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": env.BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          sender: { name: fromName, email: normalizeSenderEmail(env.OTP_BREVO_FROM || "") },
          to: [{ email, name: userName }],
          subject: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
          htmlContent: html,
          textContent: text
        }),
        signal: AbortSignal.timeout(8e3)
      });
    }
    if (response.ok) return { accepted: true };
    const payload = await response.json().catch(() => ({}));
    const errorType = provider === "resend" ? safeText(payload?.name || payload?.type || payload?.code, "", 80) : safeText(payload?.code || payload?.message, "", 80);
    return { accepted: false, status: response.status, headers: response.headers, errorType };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    console.warn(`[OTP] ${provider} request failed (${name}).`);
    return { accepted: false };
  }
}
function quotaResetTime(provider, headers, errorType, now) {
  const retryAfter = Number(headers?.get("retry-after"));
  const brevoReset = Number(headers?.get("x-sib-ratelimit-reset"));
  const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : brevoReset;
  if (Number.isFinite(seconds) && seconds > 0) return now + seconds * 1e3;
  if (provider === "resend" && errorType === "monthly_quota_exceeded") {
    const date2 = new Date(now);
    return Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth() + 1, 1);
  }
  if (/rate.?limit|too_many_requests/i.test(errorType || "")) return now + 60 * 1e3;
  if (provider === "resend" && errorType === "daily_quota_exceeded") {
    const date2 = new Date(now);
    return Date.UTC(date2.getUTCFullYear(), date2.getUTCMonth(), date2.getUTCDate() + 1);
  }
  if (provider === "brevo") return now + 60 * 1e3;
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
}
async function hashValue(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signed), (value2) => value2.toString(16).padStart(2, "0")).join("");
}
function generateOtp() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1e6).padStart(6, "0");
}
function constantTimeEqual(left, right) {
  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function maskEmail(email) {
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}
function normalizeSenderEmail(value) {
  const sender = value.trim();
  const match = sender.match(/<([^>]+)>/);
  return (match?.[1] || sender).trim().toLowerCase();
}
function formatResendFrom(value, name) {
  const sender = (value || "").trim();
  const match = sender.match(/<([^>]+)>/);
  const email = (match?.[1] || sender).trim();
  return email ? `${name} <${email}>` : "";
}
function safeText(value, fallback, maxLength) {
  const text = typeof value === "string" ? value.replace(/[\r\n\u0000-\u001f]/g, " ").trim() : "";
  return (text || fallback).slice(0, maxLength);
}
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}
function isAllowedOtpOrigin(origin, env) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname.toLowerCase();
    if (env?.APP_ORIGIN) {
      try {
        const appUrl = new URL(env.APP_ORIGIN);
        if (appUrl.hostname.toLowerCase() === hostname) return true;
      } catch {
        if (env.APP_ORIGIN.toLowerCase() === origin.toLowerCase()) return true;
      }
    }
    if (hostname === "abdomedi.com" || hostname.endsWith(".abdomedi.com")) {
      return true;
    }
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

// src/auth.ts
var SESSION_COOKIE = "__Host-1toolz_session";
var SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;
var PBKDF2_ITERATIONS = 31e4;
var MIN_PASSWORD_LENGTH = 10;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function json(body, status = 200, extraHeaders) {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}
function readCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=") || null;
  }
  return null;
}
function setSessionCookie(token) {
  return `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}
function normalizePhone(value) {
  return typeof value === "string" ? value.replace(/[^0-9+]/g, "").trim() : "";
}
function normalizeEmail2(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
function safeText2(value, maxLength = 120) {
  return typeof value === "string" ? value.replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, maxLength) : "";
}
function bytesToHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(value) {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) throw new Error("invalid_hex_value");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
function constantTimeEqual2(left, right) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left[index] || 0) ^ (right[index] || 0);
  }
  return mismatch === 0;
}
async function hmacHex(secret, value) {
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
async function derivePasswordHash(password) {
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
async function verifyPassword(password, encoded) {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 1e5 || iterations > 1e6) return false;
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
  return constantTimeEqual2(new Uint8Array(derived), expectedHash);
}
function isSyntheticEmail(value) {
  return /@mystore-auth\.app$/i.test(value) || /@example\.(com|net|org)$/i.test(value);
}
async function lookupIdentity(db, login) {
  const syntheticAlias = login.match(/^(.+)@mystore-auth\\.app$/i);
  const phoneLogin = normalizePhone(syntheticAlias ? syntheticAlias[1] : login);
  const emailLogin = normalizeEmail2(login);
  const rows = await db.prepare(`
    SELECT id, legacy_source, legacy_user_key, email, phone, display_name,
           account_status, password_reset_required
    FROM auth_identities
    WHERE lower(email) = ? OR (? <> '' AND phone = ?)
    ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END, created_at DESC
    LIMIT 3
  `).bind(emailLogin, phoneLogin, phoneLogin).all();
  const matches = rows.results || [];
  if (matches.length !== 1) return null;
  return matches[0];
}
async function verifyEmailOtp(request, env, jsonResponse, email, otp) {
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) return { valid: false, error: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629.", status: 503 };
  const headers = new Headers({ "content-type": "application/json" });
  const origin = request.headers.get("Origin");
  const ip = request.headers.get("CF-Connecting-IP");
  if (origin) headers.set("Origin", origin);
  if (ip) headers.set("CF-Connecting-IP", ip);
  const otpRequest = new Request(new URL("/api/verify-otp", request.url), {
    method: "POST",
    headers,
    body: JSON.stringify({ email, otp })
  });
  const response = await handleOtpRequest(otpRequest, env, jsonResponse);
  const result = await response.json().catch(() => ({}));
  return response.ok && result.valid === true ? { valid: true } : { valid: false, error: String(result.message || result.error || "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D."), status: response.status || 400 };
}
async function sendEmailOtp(request, env, jsonResponse, email, userName) {
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) return { success: false, error: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629.", status: 503 };
  const headers = new Headers({ "content-type": "application/json" });
  const origin = request.headers.get("Origin");
  const ip = request.headers.get("CF-Connecting-IP");
  if (origin) headers.set("Origin", origin);
  if (ip) headers.set("CF-Connecting-IP", ip);
  const otpRequest = new Request(new URL("/api/send-otp", request.url), {
    method: "POST",
    headers,
    body: JSON.stringify({ email, userName })
  });
  const response = await handleOtpRequest(otpRequest, env, jsonResponse);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.success !== true) {
    return { success: false, error: String(result.error || "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642."), status: response.status || 503 };
  }
  return {
    success: true,
    target: typeof result.target === "string" ? result.target : void 0,
    expiresInSeconds: typeof result.expiresInSeconds === "number" ? result.expiresInSeconds : void 0
  };
}
function toSafeUserProfile(identityId, fullName, phone, email) {
  return {
    id: phone,
    full_name: fullName,
    fullName,
    phone,
    email,
    stores: [],
    sites: [],
    join_date: (/* @__PURE__ */ new Date()).toISOString(),
    is_admin: false,
    is_banned: false,
    default_store_id: null,
    auto_launch_default_store: false,
    identity_id: identityId
  };
}
async function persistUserProfile(db, identityId, fullName, phone, email) {
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
async function createSession(db, secret, identityId, request) {
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
  if (result.success === false || result.meta?.changes !== void 0 && result.meta.changes !== 1) {
    throw new Error("session_create_failed");
  }
  return token;
}
async function getAuthContext(request, env) {
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
  `).bind(tokenHash).first();
  if (!row) return null;
  let roleClaims = {};
  try {
    roleClaims = JSON.parse(row.legacy_role_claims_json || "{}");
  } catch {
    roleClaims = {};
  }
  const memberships = await env.APP_DB.prepare(`
    SELECT store_id, role, permissions_json
    FROM store_memberships
    WHERE identity_id = ? AND status = 'active'
    ORDER BY store_id
  `).bind(row.id).all();
  const list = memberships.results || [];
  return {
    identityId: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.display_name,
    isPlatformAdmin: roleClaims.platformAdmin === true,
    memberships: list.map((item) => {
      let permissions = [];
      try {
        const parsed = JSON.parse(item.permissions_json || "[]");
        if (Array.isArray(parsed)) permissions = parsed.filter((value) => typeof value === "string");
      } catch {
        permissions = [];
      }
      return { store_id: item.store_id, role: item.role, permissions };
    })
  };
}
async function handleAuthRequest(request, env, jsonResponse) {
  const url = new URL(request.url);
  if (!env.APP_DB || !env.SESSION_HASH_SECRET) {
    return json({ success: false, error: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u0628\u0639\u062F." }, 503);
  }
  if (request.method === "OPTIONS") return json({ success: true }, 204);
  if (request.method === "POST" && url.pathname === "/api/v1/auth/register") {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail2(body.email);
    const phone = normalizePhone(body.phone);
    const displayName = safeText2(body.displayName, 100);
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL_RE.test(email) || email.length > 254 || isSyntheticEmail(email)) {
      return json({ success: false, error: "\u0623\u062F\u062E\u0644 \u0628\u0631\u064A\u062F\u064B\u0627 \u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A\u064B\u0627 \u062D\u0642\u064A\u0642\u064A\u064B\u0627 \u0648\u0635\u0627\u0644\u062D\u064B\u0627 \u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0631\u0645\u0632 \u0627\u0644\u062A\u0641\u0639\u064A\u0644." }, 400);
    }
    if (phone.length < 8 || phone.length > 20 || !displayName || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return json({ success: false, error: "\u0623\u062F\u062E\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 10 \u0623\u062D\u0631\u0641." }, 400);
    }
    const duplicate = await env.APP_DB.prepare(`
      SELECT id FROM auth_identities
      WHERE lower(email) = ? OR phone = ? LIMIT 1
    `).bind(email, phone).first();
    if (duplicate) return json({ success: false, error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644. \u0627\u0633\u062A\u062E\u062F\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u062D\u0633\u0627\u0628." }, 409);
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
      return json({ success: false, error: "\u062A\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0647\u0648\u064A\u0629." }, 500);
    }
    const credentialResult = await env.APP_DB.prepare(`
      INSERT INTO auth_credentials (
        identity_id, password_hash, password_algorithm,
        password_changed_at, must_change_password
      ) VALUES (?, ?, 'pbkdf2-sha256', CURRENT_TIMESTAMP, 1)
    `).bind(identityId, encodedHash).run();
    if (credentialResult.success === false) {
      return json({ success: false, error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644." }, 500);
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
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail2(body.email);
    const phone = normalizePhone(body.phone);
    if (!EMAIL_RE.test(email) || phone.length < 8) {
      return json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629." }, 400);
    }
    const identity = await env.APP_DB.prepare(`
      SELECT id, email, phone, display_name, account_status
      FROM auth_identities
      WHERE phone = ? AND lower(email) = ?
      LIMIT 1
    `).bind(phone, email).first();
    if (!identity) return json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629." }, 404);
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0648\u0642\u0648\u0641." }, 403);
    }
    const sent = await sendEmailOtp(request, env, jsonResponse, email, safeText2(body.userName, 100) || identity.display_name || "1Toolz");
    if (!sent.success) return json({ success: false, error: sent.error }, sent.status || 503);
    return json({ success: true, emailSent: true, target: sent.target, expiresInSeconds: sent.expiresInSeconds });
  }
  if (request.method === "POST" && url.pathname === "/api/verify-account-activation") {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail2(body.email);
    const phone = normalizePhone(body.phone);
    const otp = String(body.code ?? "").trim();
    if (!EMAIL_RE.test(email) || phone.length < 8 || !/^\\d{6}$/.test(otp)) {
      return json({ success: false, error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0648\u0627\u0644\u0628\u0631\u064A\u062F \u0648\u0643\u0648\u062F \u0627\u0644\u062A\u0641\u0639\u064A\u0644 \u0645\u0637\u0644\u0648\u0628\u0648\u0646." }, 400);
    }
    const identity = await env.APP_DB.prepare(`
      SELECT id, email, phone, display_name, account_status
      FROM auth_identities WHERE phone = ? AND lower(email) = ? LIMIT 1
    `).bind(phone, email).first();
    if (!identity) return json({ success: false, error: "\u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0628\u064A\u0627\u0646\u0627\u062A\u0647 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642\u0629." }, 404);
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0648\u0642\u0648\u0641." }, 403);
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
      crypto.randomUUID(),
      identity.id,
      JSON.stringify({ verifiedBy: "email_otp", newIdentityActivation: true })
    ).run();
    const token = await createSession(env.APP_DB, env.SESSION_HASH_SECRET, identity.id, request);
    return json({
      success: true,
      message: "\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0628\u0646\u062C\u0627\u062D.",
      user: { id: identity.id, email: identity.email, phone: identity.phone, fullName: identity.display_name }
    }, 200, { "set-cookie": setSessionCookie(token) });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/auth/password/change") {
    const context = await getAuthContext(request, env);
    if (!context) return json({ success: false, error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u0648\u0644\u064B\u0627." }, 401);
    const body = await request.json().catch(() => ({}));
    const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.password === "string" ? body.password : typeof body.newPassword === "string" ? body.newPassword : "";
    if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length > 128) {
      return json({ success: false, error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 10 \u0623\u062D\u0631\u0641." }, 400);
    }
    const current = await env.APP_DB.prepare(
      "SELECT password_hash FROM auth_credentials WHERE identity_id = ? LIMIT 1"
    ).bind(context.identityId).first();
    if (!current?.password_hash || currentPassword && !await verifyPassword(currentPassword, current.password_hash)) {
      return json({ success: false, error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." }, 403);
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
    return json({ success: true, message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0628\u0646\u062C\u0627\u062D." }, 200, { "set-cookie": setSessionCookie(token) });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/auth/login") {
    const body = await request.json().catch(() => ({}));
    const login = normalizeEmail2(body.login) || normalizePhone(body.login);
    const password = typeof body.password === "string" ? body.password : "";
    if (!login || password.length < 1 || password.length > 256) {
      return json({ success: false, error: "\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631." }, 400);
    }
    const identity = await lookupIdentity(env.APP_DB, login);
    if (!identity) return json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." }, 401);
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0648\u0642\u0648\u0641. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629." }, 403);
    }
    if (identity.account_status !== "active" || Number(identity.password_reset_required) === 1) {
      return json({
        success: false,
        code: "PASSWORD_RESET_REQUIRED",
        error: "\u0627\u0644\u062D\u0633\u0627\u0628 \u064A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0642\u0628\u0644 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644."
      }, 403);
    }
    const credential = await env.APP_DB.prepare(
      "SELECT password_hash, must_change_password FROM auth_credentials WHERE identity_id = ? LIMIT 1"
    ).bind(identity.id).first();
    if (!credential?.password_hash || Number(credential.must_change_password) === 1) {
      return json({ success: false, code: "PASSWORD_RESET_REQUIRED", error: "\u0623\u0639\u062F \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628." }, 403);
    }
    if (!await verifyPassword(password, credential.password_hash)) {
      return json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629." }, 401);
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
    const body = await request.json().catch(() => ({}));
    const identifier = safeText2(body.phoneOrEmail || body.phone || body.email, 254);
    const emailInput = normalizeEmail2(identifier);
    const phoneInput = normalizePhone(identifier);
    if (!identifier || !EMAIL_RE.test(emailInput) && (phoneInput.length < 8 || phoneInput.length > 20)) {
      return json({ success: false, error: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 400);
    }
    const byEmail = EMAIL_RE.test(emailInput);
    const identity = await env.APP_DB.prepare("SELECT id, email, phone, display_name, account_status FROM auth_identities WHERE (? <> '' AND lower(email) = ?) OR (? <> '' AND phone = ?) ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END, created_at DESC LIMIT 2").bind(byEmail ? emailInput : "", byEmail ? emailInput : "", byEmail ? "" : phoneInput, byEmail ? "" : phoneInput).first();
    if (!identity || !identity.email || !EMAIL_RE.test(identity.email) || isSyntheticEmail(identity.email)) {
      return json({ success: true, message: "\u0644\u0648 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0631\u062A\u0628\u0637 \u0628\u0628\u0631\u064A\u062F \u0645\u0648\u062B\u0642\u060C \u0647\u064A\u0648\u0635\u0644\u0647 \u0631\u0645\u0632 \u0627\u0633\u062A\u0639\u0627\u062F\u0629. \u0628\u0639\u0636 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629 \u062A\u062D\u062A\u0627\u062C \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
    }
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: true, message: "\u0644\u0648 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0647\u0644 \u0644\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629\u060C \u0647\u064A\u0648\u0635\u0644\u0647 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642." });
    }
    const sent = await sendEmailOtp(request, env, jsonResponse, identity.email, identity.display_name || "1Toolz");
    if (!sent.success) return json({ success: false, error: sent.error }, sent.status || 503);
    return json({ success: true, message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0625\u0644\u0649 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u062D\u0633\u0627\u0628.", target: sent.target, expiresInSeconds: sent.expiresInSeconds });
  }
  if (request.method === "POST" && url.pathname === "/api/v1/auth/recovery/complete") {
    const body = await request.json().catch(() => ({}));
    const identifier = safeText2(body.phoneOrEmail || body.phone || body.email, 254);
    const emailInput = normalizeEmail2(identifier);
    const phone = normalizePhone(identifier);
    const otp = String(body.otp ?? "").trim();
    const password = typeof body.newPassword === "string" ? body.newPassword : "";
    const byEmail = EMAIL_RE.test(emailInput);
    if (!byEmail && phone.length < 8 || !/^\\d{6}$/.test(otp) || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
      return json({ success: false, error: "\u062A\u0623\u0643\u062F \u0645\u0646 \u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0628\u0631\u064A\u062F \u0648\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642\u060C \u0648\u0627\u062C\u0639\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 10 \u0623\u062D\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644." }, 400);
    }
    const identity = await env.APP_DB.prepare("SELECT id, email, account_status FROM auth_identities WHERE (? <> '' AND phone = ?) OR (? <> '' AND lower(email) = ?) ORDER BY CASE WHEN account_status = 'active' THEN 0 ELSE 1 END LIMIT 1").bind(byEmail ? "" : phone, byEmail ? "" : phone, byEmail ? emailInput : "", byEmail ? emailInput : "").first();
    if (!identity || !identity.email || !EMAIL_RE.test(identity.email) || isSyntheticEmail(identity.email)) {
      return json({ success: false, error: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0628\u0631\u064A\u062F \u0645\u0648\u062B\u0642 \u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0645\u0644\u0643\u064A\u0629." }, 403);
    }
    if (identity.account_status === "banned" || identity.account_status === "disabled") {
      return json({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0648\u0642\u0648\u0641. \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u0635\u0629." }, 403);
    }
    const verification = await verifyEmailOtp(request, env, jsonResponse, identity.email, otp);
    if (!verification.valid) return json({ success: false, error: verification.error || "\u0631\u0645\u0632 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." }, verification.status || 400);
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
      return json({ success: false, error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629. \u0627\u0637\u0644\u0628 \u0631\u0645\u0632\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627 \u0648\u062D\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649." }, 500);
    }
    await env.APP_DB.prepare(`
      UPDATE auth_identities
      SET account_status = 'active',
          password_reset_required = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(identity.id).run();
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
      message: "\u062A\u0645 \u062A\u0641\u0639\u064A\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0648\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D."
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
    if (!context) return json({ success: false, error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." }, 401);
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
  return json({ success: false, error: "\u0645\u0633\u0627\u0631 \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." }, 404);
}

// src/data.ts
var TABLE_NAME_RE = /^[a-z][a-z0-9_]{1,62}$/;
var FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
var MAX_PAGE_SIZE = 200;
var MAX_WRITE_ROWS = 100;
var DEFAULT_PAGE_SIZE = 50;
var READ_ONLY_TABLES = /* @__PURE__ */ new Set([
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
var NEVER_GENERIC_TABLES = /* @__PURE__ */ new Set([
  "auth_identities",
  "auth_credentials",
  "auth_sessions",
  "auth_recovery_tokens",
  "store_memberships",
  "integration_secret_inventory",
  "moneyhash_webhook_events"
]);
var FINANCE_TABLES = /* @__PURE__ */ new Set([
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
var GLOBAL_ADMIN_TABLES = /* @__PURE__ */ new Set(["users", "global_options"]);
var PUBLIC_READ_TABLES = /* @__PURE__ */ new Set(["public_storefronts"]);
function json2(body, status = 200, extra) {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}
function stripSensitive(value, depth = 0) {
  if (depth > 12 || value === null || value === void 0) return value ?? null;
  if (Array.isArray(value)) return value.map((item) => stripSensitive(item, depth + 1));
  if (typeof value !== "object") return value;
  const blocked = /^(password|passcode|secret|token|api[_-]?key|authorization|credentials?|private[_-]?key|service[_-]?role|smtp[_-]?pass|webhook[_-]?secret|otp|code_hash)$/i;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!blocked.test(key)) output[key] = stripSensitive(nested, depth + 1);
  }
  return output;
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}
function toSafeKey(record) {
  const value = record.id ?? record.phone ?? record.code ?? record.slug;
  const key = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  if (!key || key.length > 240) throw new Error("record_key_required");
  return key;
}
function canReadFinance(role, permissions, isAdmin) {
  return isAdmin || role === "owner" || role === "manager" || permissions.includes("*") || permissions.includes("finance.read") || permissions.includes("treasury.read");
}
function canWriteTable(role, permissions, table, action, isAdmin) {
  if (isAdmin || role === "owner" || role === "manager") return true;
  if (role !== "staff") return false;
  return permissions.includes("*") || permissions.includes(`${table}.${action}`) || permissions.includes(`${table}.write`);
}
async function tableIsRegistered(db, table) {
  const row = await db.prepare(`
    SELECT 1 AS available FROM app_table_registry
    WHERE source_system='supabase' AND source_table=?
      AND migration_status IN ('copied','verified') LIMIT 1
  `).bind(table).first();
  return Boolean(row);
}
function parseFilters(url) {
  const raw = url.searchParams.get("filters");
  if (!raw) return [];
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    throw new Error("invalid_filters");
  }
  if (!Array.isArray(list) || list.length > 20) throw new Error("invalid_filters");
  return list.map((item) => {
    if (!item || typeof item !== "object") throw new Error("invalid_filter");
    const value = item;
    const field = String(value.field || "");
    const op = String(value.op || "eq").toLowerCase();
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}(?:->>[A-Za-z_][A-Za-z0-9_]{0,62})?$/.test(field) || !["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"].includes(op)) {
      throw new Error("unsupported_filter");
    }
    if (op === "in" && (!Array.isArray(value.value) || value.value.length > 100)) throw new Error("invalid_in_filter");
    return { field, op, value: value.value };
  });
}
function parseOrFilters(url) {
  const raw = url.searchParams.get("orFilters");
  if (!raw) return [];
  let groups;
  try {
    groups = JSON.parse(raw);
  } catch {
    throw new Error("invalid_or_filters");
  }
  if (!Array.isArray(groups) || groups.length > 10) throw new Error("invalid_or_filters");
  return groups.map((group) => {
    if (!Array.isArray(group) || group.length === 0 || group.length > 20) throw new Error("invalid_or_filter_group");
    return group.map((item) => {
      if (!item || typeof item !== "object") throw new Error("invalid_or_filter");
      const value = item;
      const field = String(value.field || "");
      const op = String(value.op || "eq").toLowerCase();
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}(?:->>[A-Za-z_][A-Za-z0-9_]{0,62})?$/.test(field) || !["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"].includes(op)) {
        throw new Error("unsupported_or_filter");
      }
      return { field, op, value: value.value };
    });
  });
}
function filterSql(filter, params) {
  const field = filter.field;
  const pathParts = field.split("->>");
  const jsonPath = "$" + pathParts.map((part) => `."${part}"`).join("");
  const expression = field === "store_id" ? "store_id" : field === "storeId" || field === "storeid" ? "COALESCE(json_extract(record_json, '$.storeId'), json_extract(record_json, '$.storeid'), store_id)" : `json_extract(record_json, '${jsonPath}')`;
  if (filter.op === "in") {
    const values = filter.value;
    if (!values.length) return "1=0";
    params.push(...values);
    return `${expression} IN (${values.map(() => "?").join(",")})`;
  }
  if (filter.op === "is" && filter.value === null) return `${expression} IS NULL`;
  if (filter.op === "is" && filter.value === true) return `${expression} = 1`;
  if (filter.op === "is" && filter.value === false) return `(${expression} = 0 OR ${expression} IS NULL)`;
  const operators = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "LIKE" };
  params.push(filter.op === "ilike" ? String(filter.value ?? "").toLowerCase() : filter.value ?? null);
  return filter.op === "ilike" ? `lower(CAST(${expression} AS TEXT)) LIKE ?` : `${expression} ${operators[filter.op]} ?`;
}
async function listRecords(db, table, storeId, filters, orGroups, limit, offset, orderBy, ascending, cursor) {
  const params = [table];
  let baseWhere = "source_table = ?";
  if (storeId !== null) {
    baseWhere += " AND store_id = ?";
    params.push(storeId);
  }
  if (cursor) {
    baseWhere += " AND record_key > ?";
    params.push(cursor);
  }
  const filterWhere = filters.map((filter) => filterSql(filter, params));
  const orWhere = orGroups.map((group) => `(${group.map((filter) => filterSql(filter, params)).join(" OR ")})`);
  const orderExpr = orderBy === "record_key" ? "record_key" : orderBy === "store_id" ? "store_id" : `json_extract(record_json, '$."${orderBy}"')`;
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
  `).bind(...params).all();
  return result.results || [];
}
function projectRecord(record, columns) {
  if (!columns || columns.trim() === "*") return stripSensitive(record);
  const keys = columns.split(",").map((item) => item.trim()).filter((key) => FIELD_NAME_RE.test(key));
  const projected = {};
  for (const key of keys) if (key in record) projected[key] = record[key];
  return stripSensitive(projected);
}
async function writeRecord(db, table, storeId, actorId, record, action, allowUpsert = false) {
  const recordKey = toSafeKey(record);
  const current = await db.prepare(`
    SELECT record_json FROM app_records
    WHERE source_table = ? AND store_id = ? AND record_key = ?
    ORDER BY CASE source_system WHEN 'manual' THEN 1 ELSE 0 END DESC, migrated_at DESC
    LIMIT 1
  `).bind(table, storeId, recordKey).first();
  if (action === "insert" && current && !allowUpsert) throw new Error("duplicate_record");
  if (action === "update" && !current) throw new Error("record_not_found");
  let merged = record;
  if (action === "update" && current) {
    const existing = JSON.parse(current.record_json);
    merged = { ...existing, ...record };
  }
  const cleanRecord = stripSensitive({
    ...merged,
    id: merged.id ?? recordKey,
    store_id: storeId,
    storeId
  });
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
    crypto.randomUUID(),
    table,
    recordKey,
    action === "delete" ? "skipped" : "copied",
    JSON.stringify({ actorId, storeId, payloadSha256: digest })
  ).run();
  return { recordKey, data: cleanRecord };
}
async function handleDataRequest(request, env, _jsonResponse) {
  if (!env.APP_DB) return json2({ success: false, error: "\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629." }, 503);
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[0] !== "api" || parts[1] !== "v1" || parts[2] !== "data") {
    return json2({ success: false, error: "\u0645\u0633\u0627\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." }, 404);
  }
  const table = parts[3];
  if (!TABLE_NAME_RE.test(table) || NEVER_GENERIC_TABLES.has(table)) {
    return json2({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u062C\u062F\u0648\u0644 \u0644\u0627 \u064A\u062F\u0639\u0645 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0639\u0627\u0645 \u0639\u0628\u0631 \u0648\u0627\u062C\u0647\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." }, 403);
  }
  if (!await tableIsRegistered(env.APP_DB, table)) {
    return json2({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0644\u0645 \u064A\u0643\u062A\u0645\u0644 \u062A\u0631\u062D\u064A\u0644\u0647 \u0628\u0639\u062F." }, 409);
  }
  const requestedStore = (url.searchParams.get("storeId") || request.headers.get("x-store-id") || "").trim();
  const isPublicRead = request.method === "GET" && PUBLIC_READ_TABLES.has(table);
  const isAdminTable = GLOBAL_ADMIN_TABLES.has(table);
  let context = null;
  let access = { role: "viewer", permissions: [], isAdmin: false };
  if (!isPublicRead || request.method !== "GET") {
    context = await getAuthContext(request, env);
    if (!context) return json2({ success: false, error: "\u063A\u064A\u0631 \u0645\u0633\u062C\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." }, 401);
  }
  let storeId = requestedStore || null;
  if (isPublicRead && !storeId) {
  } else if (isAdminTable) {
    if (!context?.isPlatformAdmin) return json2({ success: false, error: "\u064A\u062A\u0637\u0644\u0628 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u062F\u064A\u0631 \u0627\u0644\u0645\u0646\u0635\u0629." }, 403);
    storeId = null;
    access = { role: "owner", permissions: ["*"], isAdmin: true };
  } else {
    if (!storeId || storeId.length > 160) return json2({ success: false, error: "\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u0645\u062A\u062C\u0631 \u0645\u0637\u0644\u0648\u0628." }, 400);
    const membership = context?.memberships.find((item) => item.store_id === storeId);
    if (!membership && !context?.isPlatformAdmin) {
      return json2({ success: false, error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631." }, 403);
    }
    access = membership ? { role: membership.role, permissions: membership.permissions, isAdmin: Boolean(context?.isPlatformAdmin) } : { role: "owner", permissions: ["*"], isAdmin: true };
  }
  if (FINANCE_TABLES.has(table) && !canReadFinance(access.role, access.permissions, access.isAdmin)) {
    return json2({ success: false, error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0639\u0631\u0636 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u064A\u0629." }, 403);
  }
  if (request.method === "GET") {
    let filters;
    let orGroups;
    try {
      filters = parseFilters(url);
      orGroups = parseOrFilters(url);
    } catch {
      return json2({ success: false, error: "\u0641\u0644\u0627\u062A\u0631 \u0627\u0644\u0628\u062D\u062B \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." }, 400);
    }
    const requestedId = parts[4] || url.searchParams.get("id");
    if (requestedId) filters.push({ field: "id", op: "eq", value: requestedId });
    const parsedLimit = Number(url.searchParams.get("limit") || DEFAULT_PAGE_SIZE);
    const limit = Number.isSafeInteger(parsedLimit) ? Math.max(1, Math.min(MAX_PAGE_SIZE, parsedLimit)) : DEFAULT_PAGE_SIZE;
    const parsedOffset = Number(url.searchParams.get("offset") || 0);
    const offset = Number.isSafeInteger(parsedOffset) ? Math.max(0, Math.min(1e4, parsedOffset)) : 0;
    const orderBy = url.searchParams.get("orderBy") || "record_key";
    if (!FIELD_NAME_RE.test(orderBy) && orderBy !== "record_key") return json2({ success: false, error: "\u062A\u0631\u062A\u064A\u0628 \u0627\u0644\u0646\u062A\u0627\u0626\u062C \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 400);
    const ascending = url.searchParams.get("ascending") !== "false";
    const columns = url.searchParams.get("select") || "*";
    const cursor = url.searchParams.get("cursor");
    const rows = await listRecords(
      env.APP_DB,
      table,
      isPublicRead && !storeId ? null : storeId,
      filters,
      orGroups,
      limit,
      offset,
      orderBy,
      ascending,
      cursor
    );
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit).filter((row) => {
      try {
        return JSON.parse(row.record_json)?._deleted !== true;
      } catch {
        return false;
      }
    });
    const items = visible.map((row) => {
      try {
        return projectRecord(JSON.parse(row.record_json), columns);
      } catch {
        return null;
      }
    }).filter(Boolean);
    if (url.searchParams.get("single") === "true" || url.searchParams.get("maybeSingle") === "true") {
      if (items.length > 1) return json2({ success: false, error: "\u062A\u0648\u062C\u062F \u0623\u0643\u062B\u0631 \u0645\u0646 \u0646\u062A\u064A\u062C\u0629 \u0648\u0627\u062D\u062F\u0629." }, 406);
      if (!items.length && url.searchParams.get("single") === "true") return json2({ success: false, error: "\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." }, 404);
      return json2({ success: true, item: items[0] || null, items });
    }
    return json2({
      success: true,
      items,
      nextCursor: hasMore ? rows[limit - 1]?.record_key || null : null,
      count: items.length
    });
  }
  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH" || request.method === "DELETE") {
    if (!storeId || !context) return json2({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u0625\u062C\u0631\u0627\u0621 \u064A\u062A\u0637\u0644\u0628 \u0645\u062A\u062C\u0631\u064B\u0627 \u0648\u062C\u0644\u0633\u0629 \u0645\u0648\u062B\u0642\u0629." }, 400);
    if (READ_ONLY_TABLES.has(table)) return json2({ success: false, error: "\u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645 \u064A\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u0639\u0645\u0644\u064A\u0629 \u0645\u0627\u0644\u064A\u0629/\u0625\u062F\u0627\u0631\u064A\u0629 \u0645\u062A\u062E\u0635\u0635\u0629." }, 403);
    const action = request.method === "POST" ? "insert" : request.method === "DELETE" ? "delete" : "update";
    if (!canWriteTable(access.role, access.permissions, table, action, access.isAdmin)) {
      return json2({ success: false, error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0642\u0633\u0645." }, 403);
    }
    let filters;
    let orGroups;
    try {
      filters = parseFilters(url);
      orGroups = parseOrFilters(url);
    } catch {
      return json2({ success: false, error: "\u0641\u0644\u0627\u062A\u0631 \u0627\u0644\u062A\u062D\u062F\u064A\u062B \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." }, 400);
    }
    const allowUpsert = request.headers.get("x-d1-upsert") === "true";
    if (request.method === "POST") {
      const body = await request.json().catch(() => null);
      const records = Array.isArray(body) ? body : [body];
      if (!records.length || records.length > MAX_WRITE_ROWS || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) {
        return json2({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0623\u0648 \u062A\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D." }, 400);
      }
      try {
        const items = [];
        for (const record of records) {
          const targetStore = String(record.store_id ?? record.storeId ?? storeId);
          if (targetStore !== storeId) return json2({ success: false, error: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0646\u0642\u0644 \u0633\u062C\u0644 \u0625\u0644\u0649 \u0645\u062A\u062C\u0631 \u0622\u062E\u0631." }, 403);
          const result = await writeRecord(env.APP_DB, table, storeId, context.identityId, record, "insert", allowUpsert);
          items.push(result.data);
        }
        return json2({ success: true, items, count: items.length }, 201);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        return json2({ success: false, error: code === "duplicate_record" ? "\u0627\u0644\u0633\u062C\u0644 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644." : "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0633\u062C\u0644." }, code === "duplicate_record" ? 409 : 500);
      }
    }
    const selected = await listRecords(env.APP_DB, table, storeId, filters, orGroups, MAX_WRITE_ROWS + 1, 0, "record_key", true, null);
    if (selected.length > MAX_WRITE_ROWS) return json2({ success: false, error: "\u062D\u062F\u0651\u062B \u0639\u062F\u062F\u064B\u0627 \u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0641\u064A \u0643\u0644 \u0637\u0644\u0628." }, 413);
    let updateBody = {};
    if (request.method !== "DELETE") {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json2({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." }, 400);
      updateBody = body;
    }
    try {
      const items = [];
      for (const row of selected) {
        const current = JSON.parse(row.record_json);
        const merged = request.method === "DELETE" ? current : { ...current, ...updateBody };
        const result = await writeRecord(env.APP_DB, table, storeId, context.identityId, merged, action);
        items.push(result.data);
      }
      return json2({ success: true, items, count: items.length });
    } catch {
      return json2({ success: false, error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u0627\u062A." }, 500);
    }
  }
  return json2({ success: false, error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." }, 405, { allow: "GET,POST,PUT,PATCH,DELETE" });
}

// src/index.ts
var jsonHeaders = { "content-type": "application/json; charset=utf-8" };
var MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024;
function isOriginAllowed(origin, env) {
  if (!origin) return false;
  if (env.APP_ORIGIN && origin === env.APP_ORIGIN) return true;
  if (origin === "https://app.abdomedi.com" || origin === "http://app.abdomedi.com") return true;
  if (origin === "https://abdomedi.com" || origin === "http://abdomedi.com") return true;
  if (origin.match(/^https?:\/\/[a-z0-9-]+\.abdomedi\.com$/i)) return true;
  if (origin.match(/^https?:\/\/localhost(:[0-9]+)?$/)) return true;
  if (origin.match(/^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/)) return true;
  if (origin.match(/^https:\/\/ais-(dev|pre)-[a-z0-9-]+-[0-9]+\.[a-z0-9-]+\.run\.app$/i)) return true;
  if (origin.includes("run.app") && origin.includes("ais-")) return true;
  return false;
}
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const headers = new Headers(jsonHeaders);
  let isSameOrigin = false;
  try {
    isSameOrigin = origin === new URL(request.url).origin;
  } catch {
    isSameOrigin = false;
  }
  if (isOriginAllowed(origin, env) || isSameOrigin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  } else if (!origin) {
    headers.set("access-control-allow-origin", "*");
  }
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type,Authorization,X-API-Key,X-Requested-With,X-Hub-Signature-256");
  headers.set("vary", "Origin");
  return headers;
}
function json3(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request, env) });
}
async function getAuthenticatedIdentity(request, env) {
  return getAuthContext(request, env);
}
async function userHasStoreMembership(request, env, storeId) {
  if (!storeId) return false;
  const context = await getAuthenticatedIdentity(request, env);
  return Boolean(context?.memberships.some((membership) => membership.store_id === storeId));
}
function safePathPart(value, fallback) {
  const cleaned = String(value || fallback).normalize("NFKC").trim().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 100) || fallback;
}
function safeFilename(value) {
  const raw = String(value || "image.jpg").normalize("NFKC").trim();
  const ext = (raw.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] || "jpg").toLowerCase().replace("jpeg", "jpg");
  const stem = safePathPart(raw.replace(/\.[^.]+$/, ""), "image");
  return `${stem}.${ext}`;
}
async function handleMedia(request, env) {
  const url = new URL(request.url);
  if (!env.R2_IMAGES) return json3(request, env, { success: false, error: "\u062A\u062E\u0632\u064A\u0646 \u0635\u0648\u0631 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u063A\u064A\u0631 \u0645\u0643\u0648\u0651\u0646" }, 503);
  if (url.pathname.startsWith("/images/")) {
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "DELETE") {
      return json3(request, env, { success: false, error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629" }, 405);
    }
    const key = decodeURIComponent(url.pathname.slice(1)).replace(/^\/+/, "");
    if (!key || key.includes("..")) return json3(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 \u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" }, 400);
    if (request.method === "DELETE") {
      if (env.MEDIA_REQUIRE_AUTH === "true") {
        const authContext = await getAuthenticatedIdentity(request, env);
        const storeId2 = key.split("/")[1] || "";
        if (!authContext) return json3(request, env, { success: false, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" }, 401);
        if (!await userHasStoreMembership(request, env, storeId2)) {
          return json3(request, env, { success: false, error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0635\u0648\u0631 \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631" }, 403);
        }
      }
      try {
        await env.R2_IMAGES.delete(key);
        return json3(request, env, { success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0628\u0646\u062C\u0627\u062D", key });
      } catch (err) {
        return json3(request, env, { success: false, error: err?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0645\u0646 \u0627\u0644\u062A\u062E\u0632\u064A\u0646" }, 500);
      }
    }
    const object = await env.R2_IMAGES.get(key);
    if (!object) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const headers = new Headers({ "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" });
    if (object.httpEtag) headers.set("etag", object.httpEtag);
    if (object.httpMetadata?.contentType) headers.set("content-type", object.httpMetadata.contentType);
    return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
  }
  const isDeleteApi = url.pathname === "/api/media/product-images" && request.method === "DELETE" || url.pathname === "/api/media/delete" && (request.method === "DELETE" || request.method === "POST");
  if (isDeleteApi) {
    const mediaIdentity = env.MEDIA_REQUIRE_AUTH === "true" ? await getAuthenticatedIdentity(request, env) : null;
    if (env.MEDIA_REQUIRE_AUTH === "true" && !mediaIdentity) {
      return json3(request, env, { success: false, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" }, 401);
    }
    let body = {};
    try {
      body = await request.json();
    } catch {
      try {
        const form2 = await request.formData();
        body = Object.fromEntries(form2.entries());
      } catch {
        body = {};
      }
    }
    const inputKeys = [];
    if (typeof body.key === "string") inputKeys.push(body.key);
    if (typeof body.url === "string") inputKeys.push(body.url);
    if (typeof body.imageUrl === "string") inputKeys.push(body.imageUrl);
    if (Array.isArray(body.keys)) inputKeys.push(...body.keys);
    if (Array.isArray(body.urls)) inputKeys.push(...body.urls);
    if (Array.isArray(body.images)) inputKeys.push(...body.images);
    const qKey = url.searchParams.get("key");
    if (qKey) inputKeys.push(qKey);
    const qUrl = url.searchParams.get("url");
    if (qUrl) inputKeys.push(qUrl);
    const cleanedKeys = inputKeys.map((k) => {
      if (!k || typeof k !== "string") return "";
      let cleaned = k.trim();
      try {
        if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
          const parsed = new URL(cleaned);
          cleaned = parsed.pathname;
        }
      } catch {
      }
      cleaned = decodeURIComponent(cleaned).replace(/^\/+/, "");
      return cleaned;
    }).filter((k) => k && k.startsWith("images/") && !k.includes(".."));
    if (!cleanedKeys.length) {
      return json3(request, env, { success: false, error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u062D\u062F\u064A\u062F \u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0631\u0627\u0628\u0637 \u0635\u0648\u0631\u0629 \u0635\u0627\u0644\u062D \u0644\u0644\u062D\u0630\u0641" }, 400);
    }
    if (env.MEDIA_REQUIRE_AUTH === "true" && mediaIdentity) {
      for (const key of cleanedKeys) {
        const storeId2 = key.split("/")[1] || "";
        if (!await userHasStoreMembership(request, env, storeId2)) {
          return json3(request, env, { success: false, error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0635\u0648\u0631 \u0623\u062D\u062F \u0627\u0644\u0645\u062A\u0627\u062C\u0631 \u0627\u0644\u0645\u062D\u062F\u062F\u0629" }, 403);
        }
      }
    }
    try {
      if (cleanedKeys.length === 1) {
        await env.R2_IMAGES.delete(cleanedKeys[0]);
      } else {
        await env.R2_IMAGES.delete(cleanedKeys);
      }
      return json3(request, env, {
        success: true,
        message: `\u062A\u0645 \u062D\u0630\u0641 ${cleanedKeys.length} \u0635\u0648\u0631\u0629 \u0645\u0646 \u0645\u0633\u0627\u062D\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0628\u0646\u062C\u0627\u062D`,
        deletedCount: cleanedKeys.length,
        deletedKeys: cleanedKeys
      });
    } catch (delErr) {
      return json3(request, env, { success: false, error: delErr?.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0645\u0646 \u0627\u0644\u062A\u062E\u0632\u064A\u0646" }, 500);
    }
  }
  if (url.pathname !== "/api/media/product-images" || request.method !== "POST") {
    return json3(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 \u0627\u0644\u0648\u0633\u0627\u0626\u0637 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" }, 404);
  }
  const uploadIdentity = env.MEDIA_REQUIRE_AUTH === "true" ? await getAuthenticatedIdentity(request, env) : null;
  if (env.MEDIA_REQUIRE_AUTH === "true" && !uploadIdentity) {
    return json3(request, env, { success: false, error: "\u062C\u0644\u0633\u0629 \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" }, 401);
  }
  const form = await request.formData();
  const storeId = safePathPart(form.get("storeId"), "store");
  if (env.MEDIA_REQUIRE_AUTH === "true" && uploadIdentity && !await userHasStoreMembership(request, env, storeId)) {
    return json3(request, env, { success: false, error: "\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0631\u0641\u0639 \u0635\u0648\u0631 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u062C\u0631" }, 403);
  }
  const productId = safePathPart(form.get("productId"), "product");
  const files = form.getAll("files").filter((item) => item instanceof File);
  if (!files.length) return json3(request, env, { success: false, error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631 \u0623\u064A \u0635\u0648\u0631\u0629" }, 400);
  if (files.length > 20) return json3(request, env, { success: false, error: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u0635\u0648\u0631\u0629 \u0641\u064A \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0648\u0627\u062D\u062F" }, 413);
  const images = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) return json3(request, env, { success: false, error: `\u0627\u0644\u0645\u0644\u0641 ${file.name} \u0644\u064A\u0633 \u0635\u0648\u0631\u0629` }, 415);
    if (file.size > MAX_MEDIA_FILE_SIZE) return json3(request, env, { success: false, error: `\u062D\u062C\u0645 ${file.name} \u0623\u0643\u0628\u0631 \u0645\u0646 10 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A` }, 413);
    const filename = safeFilename(file.name);
    const key = `images/${storeId}/${productId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${filename}`;
    await env.R2_IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { storeId, productId, originalName: file.name }
    });
    const publicOrigin = (env.MEDIA_PUBLIC_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
    images.push({ key, url: `${publicOrigin}/${key}`, filename, contentType: file.type, size: file.size });
  }
  return json3(request, env, { success: true, images });
}
function clean(value) {
  return String(value || "").replace(/^['"]+|['"]+$/g, "").replace(/^Bearer\s+/i, "").trim();
}
function keyFrom(request, body, fallback) {
  const q = new URL(request.url).searchParams;
  return clean(body?.config?.authenticationKey || body?.config?.apiKey || body?.config?.apiToken || body?.apiKey || q.get("apiKey") || q.get("authenticationKey") || request.headers.get("x-api-key") || request.headers.get("authorization") || fallback);
}
function bostaBase(env, staging) {
  return (staging ? env.BOSTA_STAGING_BASE_URL : env.BOSTA_PRODUCTION_BASE_URL) || "https://app.bosta.co";
}
function turboBase(env, staging) {
  return ((staging ? env.TURBO_STAGING_BASE_URL || env.TURBO_BASE_URL : env.TURBO_BASE_URL) || "https://platform.turbo.info").replace(/\/$/, "");
}
async function readBody(request) {
  if (["GET", "HEAD"].includes(request.method)) return {};
  return request.json().catch(() => ({}));
}
async function upstream(request, env, url, init, mode) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (text && (text.includes("<html") || text.includes("<!DOCTYPE") || text.includes("<pre>"))) {
      const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      const cleanMsg = preMatch ? preMatch[1].replace(/<[^>]+>/g, "").trim() : res.status === 404 ? `\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0645\u0633\u0627\u0631 \u0641\u064A \u062E\u0648\u0627\u062F\u0645 ${mode} (404 Not Found)` : `\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0645\u0646 ${mode}`;
      data = { message: cleanMsg, raw: cleanMsg };
    } else {
      data = { raw: text.slice(0, 500) };
    }
  }
  if (res.ok) return json3(request, env, data, res.status);
  return json3(request, env, { success: false, error: data?.message || data?.error || data?.error_msg || `\u0631\u0641\u0636\u062A ${mode} \u0627\u0644\u0637\u0644\u0628 (HTTP ${res.status})`, data, status: res.status }, res.status);
}
async function serveAssets(request, env) {
  const response = await env.ASSETS.fetch(request);
  const pathname = new URL(request.url).pathname;
  const looksLikeAsset = pathname.startsWith("/assets/") || /\.(?:m?js|cjs|css|map|json|webmanifest|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|wasm|xml|txt|pdf)$/i.test(pathname);
  if (looksLikeAsset && response.status === 200 && response.headers.get("content-type")?.includes("text/html")) {
    return new Response(request.method === "HEAD" ? null : "Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
  return response;
}
function bostaHeaders(key, content = false) {
  return { ...content ? { "content-type": "application/json" } : {}, accept: "application/json", ...key ? { Authorization: key, "x-api-key": key } : {} };
}
function turboHeaders() {
  return { "content-type": "application/json", accept: "application/json" };
}
async function handleWhatsAppWebhook(request, env, _ctx) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode !== "subscribe" || !challenge || !env.META_VERIFY_TOKEN || !constantTimeStringEqual(token, env.META_VERIFY_TOKEN)) {
      return json3(request, env, { success: false, error: "\u0637\u0644\u0628 \u062A\u062D\u0642\u0642 Meta \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 403);
    }
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (request.method !== "POST") {
    return json3(request, env, { success: false, error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." }, 405);
  }
  if (!env.APP_DB || !env.META_APP_SECRET) {
    return json3(request, env, { success: false, error: "\u062A\u0643\u0627\u0645\u0644 \u0648\u0627\u062A\u0633\u0627\u0628 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623 \u0639\u0644\u0649 Cloudflare." }, 503);
  }
  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 1e6) {
    return json3(request, env, { success: false, error: "\u062D\u062C\u0645 \u0625\u0634\u0639\u0627\u0631 \u0648\u0627\u062A\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 413);
  }
  const signature = request.headers.get("x-hub-signature-256") || "";
  const expected = await hmacSha256Hex(env.META_APP_SECRET, rawBody);
  const supplied = signature.startsWith("sha256=") ? signature.slice(7).toLowerCase() : "";
  if (!supplied || !constantTimeStringEqual(supplied, expected)) {
    return json3(request, env, { success: false, error: "\u062A\u0648\u0642\u064A\u0639 \u0625\u0634\u0639\u0627\u0631 Meta \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 401);
  }
  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json3(request, env, { success: false, error: "\u0635\u064A\u063A\u0629 \u0625\u0634\u0639\u0627\u0631 \u0648\u0627\u062A\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629." }, 400);
  }
  const eventId = await hmacSha256Hex(env.META_APP_SECRET, rawBody);
  try {
    const result = await env.APP_DB.prepare(`
      INSERT OR IGNORE INTO whatsapp_webhook_events (
        event_id, object_name, payload_json, signature_verified, received_at
      ) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    `).bind(
      eventId,
      typeof payload.object === "string" ? payload.object.slice(0, 80) : "unknown",
      rawBody
    ).run();
    return json3(request, env, {
      success: true,
      accepted: true,
      duplicate: (result.meta?.changes ?? 0) === 0
    });
  } catch {
    console.error("[WHATSAPP-WEBHOOK] Failed to persist verified Meta event.");
    return json3(request, env, { success: false, error: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0625\u0634\u0639\u0627\u0631 \u0648\u0627\u062A\u0633\u0627\u0628." }, 503);
  }
}
async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (item) => item.toString(16).padStart(2, "0")).join("");
}
function constantTimeStringEqual(left, right) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
async function bosta(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const body = await readBody(request);
  const staging = url.searchParams.get("staging") === "true" || body?.config?.environment === "staging";
  const key = keyFrom(request, body, env.BOSTA_API_KEY);
  const base = bostaBase(env, staging);
  if (path === "/api/bosta/customer-rate") {
    const phone = (url.searchParams.get("phone") || "").replace(/\D/g, "");
    if (phone.length < 6) return json3(request, env, { success: true, phone, totalOrders: 0, deliveredCount: 0, returnedCount: 0, pendingCount: 0, rate: null, rating: "new" }, 200);
    const bareKey = key.replace(/^bearer\s+/i, "").trim();
    const headers2 = { accept: "application/json", Authorization: `Bearer ${bareKey}`, "x-api-key": bareKey };
    let delivered = 0;
    let returned = 0;
    let pending = 0;
    let found = false;
    const candidates = [
      `/api/v2/deliveries/customer-rating?phone=${encodeURIComponent(phone)}`,
      `/api/v2/deliveries/customer-evaluation?phone=${encodeURIComponent(phone)}`,
      `/api/v2/customers/evaluation?phone=${encodeURIComponent(phone)}`,
      `/api/v2/deliveries?dropOffAddress.phone=${encodeURIComponent(phone)}&page=1&limit=50`
    ];
    for (const candidate of candidates) {
      const response2 = await fetch(`${base}${candidate}`, { headers: headers2 });
      if (!response2.ok) continue;
      const value = await response2.json().catch(() => null);
      const data = value?.data || value;
      const list = Array.isArray(data) ? data : data?.list || data?.deliveries || [];
      if (Array.isArray(list) && list.length) {
        found = true;
        for (const item of list) {
          const state = String(item.state?.value || item.state?.name || item.state || item.status || "").toLowerCase();
          if (state.includes("deliver") || state.includes("\u062A\u0645 \u0627\u0644\u062A\u0633\u0644\u064A\u0645") || state.includes("\u0633\u0644\u0645")) delivered++;
          else if (state.includes("return") || state.includes("cancel") || state.includes("\u0645\u0631\u062A\u062C\u0639") || state.includes("\u0645\u0644\u063A\u064A") || state.includes("\u0645\u0631\u0641\u0648\u0636")) returned++;
          else pending++;
        }
        break;
      }
    }
    const completed = delivered + returned;
    const rate = completed ? Math.round(delivered / completed * 1e3) / 10 : null;
    return json3(request, env, { success: true, phone, totalOrders: completed + pending, deliveredCount: delivered, returnedCount: returned, pendingCount: pending, rate, rating: rate === null ? "new" : rate < 50 ? "low" : rate < 75 ? "moderate" : "excellent", hasBostaData: found });
  }
  if (path === "/api/bosta/business-locations") {
    const endpoints = ["/api/v2/pickup-locations/business", "/api/v2/pickup-locations", "/api/v2/business-locations", "/api/v2/users/me"];
    const authValues = [key, key.replace(/^bearer\s+/i, "").trim(), `Bearer ${key.replace(/^bearer\s+/i, "").trim()}`].filter(Boolean);
    for (const endpoint of endpoints) for (const auth of authValues) {
      const response2 = await fetch(`${base}${endpoint}`, { headers: { accept: "application/json", Authorization: auth, "x-api-key": key } });
      if (!response2.ok) continue;
      const value = await response2.json().catch(() => null);
      const locations = Array.isArray(value) ? value : value?.data?.list || value?.data?.locations || value?.data?.pickupAddress || value?.list || value?.locations || value?.pickupAddress || value?.business?.pickupAddress;
      if (Array.isArray(locations)) return json3(request, env, { success: true, data: locations });
    }
    return json3(request, env, { success: true, data: [] });
  }
  let target = "";
  let method = request.method;
  let payload = body;
  if (path === "/api/bosta/verify") target = "/api/v2/cities?countryId=60e4482c7cb7d4bc4849c4d5";
  else if (path === "/api/bosta/cities") target = "/api/v2/cities?countryId=60e4482c7cb7d4bc4849c4d5";
  else if (path === "/api/bosta/districts") target = "/api/v2/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5";
  else if (path.match(/^\/api\/bosta\/cities\/[^/]+\/districts$/)) target = `/api/v2/cities/${encodeURIComponent(path.split("/")[4])}/districts`;
  else if (path.match(/^\/api\/bosta\/cities\/[^/]+\/zones$/)) target = `/api/v2/cities/${encodeURIComponent(path.split("/")[4])}/zones`;
  else if (path === "/api/bosta/deliveries/create") {
    target = "/api/v2/deliveries?apiVersion=1";
    method = "POST";
    payload = bostaDelivery(body?.order || {}, body?.config || {});
  } else if (path === "/api/bosta/deliveries/bulk") {
    target = "/api/v2/deliveries/bulk";
    method = "POST";
    payload = body;
  } else if (path === "/api/bosta/deliveries/mass-awb") {
    target = "/api/v2/deliveries/mass-awb";
    method = "POST";
    payload = body;
  } else if (path.match(/^\/api\/bosta\/deliveries\/track\/([^/]+)$/)) target = `/api/v2/deliveries/track-shipment?trackingNumber=${encodeURIComponent(path.split("/")[5])}`;
  else if (path.match(/^\/api\/bosta\/deliveries\/([^/]+)\/awb$/)) {
    target = "/api/v2/deliveries/mass-awb";
    method = "POST";
    payload = { trackingNumbers: [path.split("/")[4]], requestedAwbType: url.searchParams.get("type") || "A4", lang: url.searchParams.get("lang") || "ar" };
  } else if (path.match(/^\/api\/bosta\/deliveries\/([^/]+)\/terminate$/)) {
    target = `/api/v2/deliveries/${encodeURIComponent(path.split("/")[4])}/terminate`;
    method = "POST";
  } else if (path.match(/^\/api\/bosta\/deliveries\/([^/]+)$/)) target = `/api/v2/deliveries/${encodeURIComponent(path.split("/")[4])}`;
  else if (path === "/api/bosta/pickups/create") {
    target = "/api/v2/pickups";
    method = "POST";
    payload = body;
  } else if (path === "/api/bosta/pickups") target = "/api/v2/pickups?page=" + encodeURIComponent(url.searchParams.get("page") || "1") + "&perPage=" + encodeURIComponent(url.searchParams.get("perPage") || "100");
  else if (path.match(/^\/api\/bosta\/pickups\/([^/]+)$/)) target = `/api/v2/pickups/${encodeURIComponent(path.split("/")[4])}`;
  else if (path === "/api/bosta/pickup-locations") {
    target = "/api/v2/pickup-locations";
    method = "POST";
  } else if (path === "/api/bosta/business-locations") target = "/api/v2/pickup-locations/business";
  else if (path === "/api/bosta/products") target = "/api/v2/products";
  else if (path === "/api/bosta/pricing/calculator") target = "/api/v2/pricing/calculator" + url.search;
  else if (path === "/api/bosta/pricing/insurance") target = "/api/v2/pricing/insuranceFeeEstimate" + url.search;
  else if (path === "/api/bosta/customer-rate") target = "/api/v2/deliveries" + url.search;
  else if (path.match(/^\/api\/bosta\/businesses\//)) target = "/api/v2" + path.replace(/^\/api\/bosta/, "");
  else if (path === "/api/bosta/users/refresh-token") {
    target = "/api/v2/users/refresh-token";
    method = "POST";
  } else return json3(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 Bosta \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" }, 404);
  if (path === "/api/bosta/verify") return upstream(request, env, `${base}${target}`, { method: "GET", headers: bostaHeaders(key) }, "bosta");
  const headers = bostaHeaders(key, !["GET", "HEAD"].includes(method));
  const response = await upstream(request, env, `${base}${target}`, { method, headers, body: ["GET", "HEAD"].includes(method) ? void 0 : JSON.stringify(payload) }, "bosta");
  if (path === "/api/bosta/cities") {
    const data = await response.clone().json().catch(() => ({}));
    return json3(request, env, { success: true, list: data?.data?.list || data?.data || data?.list || [], data });
  }
  if (path === "/api/bosta/districts") {
    const data = await response.clone().json().catch(() => ({}));
    return json3(request, env, { success: true, districts: data?.data || data?.districts || [], data });
  }
  return response;
}
function bostaDelivery(order, config) {
  const names = String(order.customerName || "\u0639\u0645\u064A\u0644").trim().split(/\s+/);
  const cod = order.paymentStatus === "\u0645\u062F\u0641\u0648\u0639" ? 0 : Math.max(0, Number(order.totalPrice ?? (order.productPrice || 0) + (order.shippingFee || 0)) - Number(order.advancePayment || 0));
  const items = Array.isArray(order.items) ? order.items : [];
  return {
    type: 10,
    specs: {
      packageDetails: {
        itemsCount: items.reduce((n, x) => n + Number(x.quantity || 1), 0) || 1,
        description: items.map((x) => `${x.name || x.productName || "\u0645\u0646\u062A\u062C"} \xD7 ${x.quantity || 1}`).join(" + ") || order.productName || "\u0645\u0646\u062A\u062C\u0627\u062A \u0627\u0644\u0645\u062A\u062C\u0631"
      },
      packageType: "Parcel"
    },
    dropOffAddress: {
      firstLine: order.shippingAddress || "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0639\u0645\u064A\u0644",
      city: order.city || order.governorate || "Cairo",
      districtId: order.bostaDistrictId,
      zoneId: order.bostaZoneId,
      buildingNumber: order.buildingNumber,
      floor: order.floor,
      apartment: order.apartment,
      phone: String(order.customerPhone || "").replace(/\D/g, "")
    },
    receiver: {
      firstName: names[0] || "\u0639\u0645\u064A\u0644",
      lastName: names.slice(1).join(" ") || ".",
      phone: String(order.customerPhone || "").replace(/\D/g, ""),
      secondPhone: order.customerPhone2 || ""
    },
    cod,
    businessReference: order.orderNumber || order.id,
    notes: order.notes || "",
    businessLocationId: config.defaultBusinessLocationId || order.businessLocationId
  };
}
async function turbo(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const body = await readBody(request);
  const staging = url.searchParams.get("staging") === "true" || body?.config?.environment === "staging";
  const key = keyFrom(request, body, env.TURBO_API_KEY);
  const base = turboBase(env, staging);
  const client = Number(body?.config?.mainClientCode || url.searchParams.get("clientCode") || env.TURBO_MAIN_CLIENT_CODE || 74068);
  let target = "";
  let method = request.method;
  let payload = body;
  if (path === "/api/turbo/verify" || path === "/api/turbo/governorates") {
    target = "/external-api/get-government";
    method = "GET";
  } else if (path.match(/^\/api\/turbo\/areas\/[^/]+$/)) {
    target = `/external-api/get-area/${path.split("/")[4]}`;
    method = "GET";
  } else if (path === "/api/turbo/login") {
    target = "/external-api/login";
    method = "POST";
    payload = { ...body, authentication_key: key };
  } else if (path === "/api/turbo/shipments/create") {
    target = "/external-api/add-order";
    method = "POST";
    payload = turboOrder(body?.order || {}, body?.config || {}, key, client);
  } else if (path.match(/^\/api\/turbo\/shipments\/track\/([^/]+)$/) || path === "/api/shipping/turbo/track") {
    const tracking = path === "/api/shipping/turbo/track" ? body.remote_shipment_id || body.search_key || body.trackingNumber : path.split("/")[5];
    target = "/external-api/search-order";
    method = "POST";
    payload = { authentication_key: key, search_key: tracking, tracking_number: tracking, main_client_code: client };
  } else if (path === "/api/turbo/shipments/status") {
    target = "/external-api/search-order";
    method = "POST";
    payload = { ...body, authentication_key: key, main_client_code: client };
  } else if (path === "/api/turbo/shipments/cancel") {
    target = "/external-api/canceled";
    method = "POST";
    payload = { authentication_key: key, code: body.trackingNumber, main_client_code: client };
  } else if (path === "/api/turbo/shipments/delete") {
    target = "/external-api/delete-order";
    method = "POST";
    payload = { authentication_key: key, search_key: body.trackingNumber, tracking_number: body.trackingNumber, code: body.trackingNumber, id: body.trackingNumber, main_client_code: client };
  } else if (path === "/api/turbo/shipments/edit") {
    target = "/external-api/edit-order";
    method = "POST";
    payload = { ...turboOrder(body.order || {}, body.config || {}, key, client), code: body.trackingNumber };
  } else if (path === "/api/turbo/shipments/resend") {
    target = "/external-api/resend-request";
    method = "POST";
    payload = { authentication_key: key, code: body.trackingNumber, main_client_code: client };
  } else if (path.startsWith("/api/turbo/tickets/")) {
    target = "/external-api" + path.replace("/api/turbo/tickets", "/tickets");
    method = request.method;
    payload = { ...body, authentication_key: key, main_client_code: client };
  } else if (path === "/api/turbo/tickets") {
    target = "/external-api/tickets";
    method = "GET";
  } else if (path === "/api/turbo/pricing/calculator") return json3(request, env, { success: true, governorate: url.searchParams.get("governorate") || "\u0627\u0644\u0642\u0627\u0647\u0631\u0629", deliveryFee: 83.52, returnFee: 83.52, cod: Number(url.searchParams.get("cod") || 0) });
  else return json3(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 Turbo \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" }, 404);
  if (!key) return json3(request, env, { success: false, error: "\u0645\u0641\u062A\u0627\u062D Turbo \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631" }, 400);
  const query = new URLSearchParams(url.search);
  query.delete("apiKey");
  query.delete("authenticationKey");
  if (method === "GET") query.set("authentication_key", key);
  const suffix = method === "GET" ? `?${query.toString()}` : "";
  const res = await upstream(request, env, `${base}${target}${suffix}`, { method, headers: turboHeaders(), body: method === "GET" ? void 0 : JSON.stringify(payload) }, "turbo");
  if (path === "/api/turbo/governorates") {
    const data = await res.clone().json().catch(() => ({}));
    return json3(request, env, { success: true, governorates: data?.feed || data?.data || data });
  }
  if (path.match(/^\/api\/turbo\/shipments\/track\//) || path === "/api/shipping/turbo/track") {
    const data = await res.clone().json().catch(() => ({}));
    const raw = data?.result || data?.data || data;
    const item = Array.isArray(raw) ? raw[0] : raw;
    return json3(request, env, { success: !!item && data?.success !== false, trackingInfo: item, data, status: item?.status || item?.state, statusArabic: item?.status || item?.state });
  }
  return res;
}
function turboOrder(order, config, key, client) {
  return {
    authentication_key: key,
    main_client_code: client,
    remote_order_id: order.orderNumber || order.id,
    receiver: order.customerName,
    phone1: order.customerPhone,
    phone2: order.customerPhone2 || "",
    government: order.governorate,
    area: order.city || order.area,
    address: order.shippingAddress,
    notes: order.notes || "",
    amount_to_be_collected: Number(order.totalPrice || 0),
    order_summary: (order.items || []).map((i) => `${i.productName || i.name || "\u0645\u0646\u062A\u062C"} (${i.quantity || 1})`).join(" - "),
    can_open: config.allowOpenPackage ?? true ? 1 : 0,
    weight: Number(order.weight || 1),
    quantity: (order.items || []).reduce((n, i) => n + Number(i.quantity || 1), 0) || 1,
    location_id: order.location_id || order.turboLocationId || order.locationId
  };
}
var index_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }
    if (url.pathname === "/api/health") {
      try {
        const dbReady = Boolean(env.APP_DB && await env.APP_DB.prepare("SELECT 1 AS ok").first());
        return json3(request, env, {
          success: dbReady,
          service: "1toolz-cloudflare-native",
          database: dbReady ? "ready" : "unavailable",
          environment: "cloudflare-native"
        }, dbReady ? 200 : 503);
      } catch {
        return json3(request, env, { success: false, service: "1toolz-cloudflare-native", database: "unavailable" }, 503);
      }
    }
    if (url.pathname === "/health" || url.pathname === "/api") {
      return json3(request, env, {
        ok: true,
        service: "abdomedi-carrier-api",
        version: "2.1.0",
        status: "online",
        features: [
          "Dynamic CORS Origin Matching",
          "Bosta Shipping API v2 (Deliveries, Bulk, Tracking, Customer Rating, AWB, Cities)",
          "Turbo Express API (Orders, Search, Tracking, Cancellation)",
          "Meta WhatsApp Edge Webhook Verification & Forwarding (<50ms)"
        ],
        message: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u0645\u0639 \u0634\u0631\u0643\u0627\u062A \u0627\u0644\u0634\u062D\u0646 \u0648\u0627\u0644\u0648\u0627\u062A\u0633\u0627\u0628 \u062A\u0639\u0645\u0644 \u0628\u0646\u062C\u0627\u062D \u0648\u0628\u0633\u0631\u0639\u0629 \u0641\u0627\u0626\u0642\u0629 (Edge Gateway)"
      });
    }
    try {
      if (url.pathname === "/api/send-otp" || url.pathname === "/api/verify-otp") {
        return env.OTP_DB ? await handleOtpRequest(request, env, json3) : json3(request, env, { success: false, error: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629." }, 503);
      }
      if (url.pathname.startsWith("/api/v1/auth/") || url.pathname === "/api/send-account-activation" || url.pathname === "/api/verify-account-activation") {
        return await handleAuthRequest(request, env, json3);
      }
      if (url.pathname.startsWith("/api/v1/data/")) {
        return await handleDataRequest(request, env, json3);
      }
      if (url.pathname === "/api/webhook/whatsapp" || url.pathname === "/api/webhooks/whatsapp" || url.pathname === "/webhook/whatsapp" || url.pathname === "/wa-webhook-direct") {
        return await handleWhatsAppWebhook(request, env, ctx);
      }
      if (url.pathname.startsWith("/images/") || url.pathname === "/api/media/product-images" || url.pathname === "/api/media/delete") {
        return await handleMedia(request, env);
      }
      if (url.pathname.startsWith("/api/bosta/")) {
        return await bosta(request, env);
      }
      if (url.pathname.startsWith("/api/turbo/") || url.pathname === "/api/shipping/turbo/track") {
        return await turbo(request, env);
      }
      if (url.pathname.startsWith("/api/")) {
        return json3(request, env, { success: false, error: `\u0645\u0633\u0627\u0631 API \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F: ${url.pathname}` }, 404);
      }
      return await serveAssets(request, env);
    } catch (error) {
      return json3(request, env, { success: false, error: error?.message || "\u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0641\u064A Worker" }, 500);
    }
  }
};
export {
  index_default as default
};
