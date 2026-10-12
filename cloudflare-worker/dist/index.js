// cloudflare-worker/src/otp.ts
var OTP_TTL_MS = 5 * 60 * 1e3;
var SEND_COOLDOWN_MS = 60 * 1e3;
var MAX_ATTEMPTS = 3;
var LOCKOUT_MS = 10 * 60 * 1e3;
var IP_WINDOW_MS = 60 * 60 * 1e3;
var IP_SEND_LIMIT = 10;
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
async function handleOtpRequest(request, env, json2) {
  const pathname = new URL(request.url).pathname;
  if (request.method !== "POST") {
    return json2(request, env, { success: false, error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629." }, 405);
  }
  if (!env.OTP_DB || !env.OTP_HASH_SECRET) {
    return json2(request, env, {
      success: false,
      error: "\u062E\u062F\u0645\u0629 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627.",
      code: "OTP_NOT_CONFIGURED"
    }, 503);
  }
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOtpOrigin(origin, env)) {
    return json2(request, env, { success: false, error: "\u0645\u0635\u062F\u0631 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D." }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return json2(request, env, { success: false, error: "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D." }, 400);
  }
  if (pathname === "/api/send-otp") {
    return sendOtp(request, env, json2, email, body.userName);
  }
  if (pathname === "/api/verify-otp") {
    return verifyOtp(request, env, json2, email, body.otp);
  }
  return json2(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 API \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." }, 404);
}
async function sendOtp(request, env, json2, email, requestedName) {
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
    return json2(request, env, {
      success: false,
      error: `\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${minutes} \u062F\u0642\u064A\u0642\u0629.`,
      retryAfterSeconds
    }, 429);
  }
  const cooldownRemaining = current ? current.created_at + SEND_COOLDOWN_MS - now : 0;
  if (cooldownRemaining > 0) {
    return json2(request, env, {
      success: false,
      error: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0645\u0624\u062E\u0631\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0642\u0628\u0644 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F.",
      retryAfterSeconds: Math.ceil(cooldownRemaining / 1e3)
    }, 429);
  }
  if (!env.RESEND_API_KEY && !env.BREVO_API_KEY) {
    return json2(request, env, {
      success: false,
      error: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0647\u064A\u0626\u0629 \u062E\u062F\u0645\u0629 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0628\u0631\u064A\u062F \u0628\u0639\u062F.",
      code: "OTP_EMAIL_NOT_CONFIGURED"
    }, 503);
  }
  const ipLimit = await checkIpSendLimit(request, env, now);
  if (!ipLimit.allowed) {
    return json2(request, env, {
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
    return json2(request, env, {
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
    return json2(request, env, {
      success: false,
      error: "\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0627\u0644\u0622\u0646. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0644\u0627\u062D\u0642\u064B\u0627 \u0623\u0648 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u062F\u0639\u0645."
    }, 503);
  }
  const target = maskEmail(email);
  return json2(request, env, {
    success: true,
    message: `\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u0625\u0644\u0649 \u0628\u0631\u064A\u062F\u0643 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A (${target}). \u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0645\u0632 \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.`,
    target,
    email,
    emailSent: true,
    cooldown: SEND_COOLDOWN_MS / 1e3,
    expiresInSeconds: OTP_TTL_MS / 1e3
  });
}
async function verifyOtp(request, env, json2, email, inputOtp) {
  const otp = String(inputOtp ?? "").trim();
  if (!/^\d{6}$/.test(otp)) {
    return json2(request, env, { valid: false, message: "\u064A\u062C\u0628 \u0625\u062F\u062E\u0627\u0644 \u0631\u0645\u0632 \u062A\u062D\u0642\u0642 \u0645\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u0631\u0642\u0627\u0645." }, 400);
  }
  const db = env.OTP_DB;
  const now = Date.now();
  const row = await db.prepare(
    "SELECT identifier, email, code_hash, created_at, expires_at, attempts, locked_until, verified_at FROM otp_challenges WHERE identifier = ?"
  ).bind(email).first();
  if (row?.locked_until && row.locked_until > now) {
    const retryAfterSeconds = Math.ceil((row.locked_until - now) / 1e3);
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return json2(request, env, {
      valid: false,
      message: `\u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0624\u0642\u062A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 ${minutes} \u062F\u0642\u064A\u0642\u0629.`,
      retryAfterSeconds
    }, 429);
  }
  if (!row || row.expires_at < now || !row.code_hash || row.verified_at) {
    return json2(request, env, {
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
      return json2(request, env, {
        valid: false,
        message: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A (3 \u0645\u062D\u0627\u0648\u0644\u0627\u062A). \u062A\u0645 \u0642\u0641\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0644\u0645\u062F\u0629 10 \u062F\u0642\u0627\u0626\u0642.",
        retryAfterSeconds: LOCKOUT_MS / 1e3
      }, 429);
    }
    const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
    return json2(request, env, {
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
    return json2(request, env, {
      valid: false,
      message: "\u0631\u0645\u0632 \u0627\u0644\u062A\u062D\u0642\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0645\u0646\u062A\u0647\u064A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0629 \u0623\u0648 \u0645\u0633\u062A\u062E\u062F\u0645. \u064A\u0631\u062C\u0649 \u0637\u0644\u0628 \u0631\u0645\u0632 \u062C\u062F\u064A\u062F."
    }, 400);
  }
  return json2(request, env, { valid: true, message: "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0631\u0645\u0632 \u0628\u0646\u062C\u0627\u062D." });
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

// cloudflare-worker/src/index.ts
var jsonHeaders = { "content-type": "application/json; charset=utf-8" };
var SUPABASE_WHATSAPP_WEBHOOK_URL = "https://kwirhppfowzqshltmoga.supabase.co/functions/v1/whatsapp-webhook";
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
  if (isOriginAllowed(origin, env)) {
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
function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request, env) });
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
  if (!env.R2_IMAGES) return json(request, env, { success: false, error: "\u062A\u062E\u0632\u064A\u0646 \u0635\u0648\u0631 \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A \u063A\u064A\u0631 \u0645\u0643\u0648\u0651\u0646" }, 503);
  if (url.pathname.startsWith("/images/")) {
    if (request.method !== "GET" && request.method !== "HEAD") return json(request, env, { success: false, error: "\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645\u0629" }, 405);
    const key = decodeURIComponent(url.pathname.slice("/images/".length)).replace(/^\/+/, "");
    if (!key || key.includes("..")) return json(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 \u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D" }, 400);
    const object = await env.R2_IMAGES.get(key);
    if (!object) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const headers = new Headers({ "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" });
    if (object.httpEtag) headers.set("etag", object.httpEtag);
    if (object.httpMetadata?.contentType) headers.set("content-type", object.httpMetadata.contentType);
    return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
  }
  if (url.pathname !== "/api/media/product-images" || request.method !== "POST") {
    return json(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 \u0627\u0644\u0648\u0633\u0627\u0626\u0637 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" }, 404);
  }
  if (env.MEDIA_REQUIRE_AUTH === "true" && !request.headers.get("authorization")) {
    return json(request, env, { success: false, error: "\u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631" }, 401);
  }
  const form = await request.formData();
  const storeId = safePathPart(form.get("storeId"), "store");
  const productId = safePathPart(form.get("productId"), "product");
  const files = form.getAll("files").filter((item) => item instanceof File);
  if (!files.length) return json(request, env, { success: false, error: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u062E\u062A\u064A\u0627\u0631 \u0623\u064A \u0635\u0648\u0631\u0629" }, 400);
  if (files.length > 20) return json(request, env, { success: false, error: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u0635\u0648\u0631\u0629 \u0641\u064A \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0648\u0627\u062D\u062F" }, 413);
  const images = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) return json(request, env, { success: false, error: `\u0627\u0644\u0645\u0644\u0641 ${file.name} \u0644\u064A\u0633 \u0635\u0648\u0631\u0629` }, 415);
    if (file.size > MAX_MEDIA_FILE_SIZE) return json(request, env, { success: false, error: `\u062D\u062C\u0645 ${file.name} \u0623\u0643\u0628\u0631 \u0645\u0646 10 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A` }, 413);
    const filename = safeFilename(file.name);
    const key = `images/${storeId}/${productId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${filename}`;
    await env.R2_IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
      customMetadata: { storeId, productId, originalName: file.name }
    });
    images.push({ key, url: `https://abdomedi.com/${key}`, filename, contentType: file.type, size: file.size });
  }
  return json(request, env, { success: true, images });
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
  if (res.ok) return json(request, env, data, res.status);
  return json(request, env, { success: false, error: data?.message || data?.error || data?.error_msg || `\u0631\u0641\u0636\u062A ${mode} \u0627\u0644\u0637\u0644\u0628 (HTTP ${res.status})`, data, status: res.status }, res.status);
}
async function proxyBackendRequest(request, env) {
  const backendUrl = env.APP_BACKEND_URL?.trim();
  if (!backendUrl) {
    return json(request, env, {
      success: false,
      error: "Backend \u063A\u064A\u0631 \u0645\u0643\u0648\u0651\u0646 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u0627\u0631",
      code: "BACKEND_NOT_CONFIGURED"
    }, 503);
  }
  const publicUrl = new URL(request.url);
  const backend = new URL(backendUrl);
  const isGoogleAiStudioBackend = backend.hostname.endsWith(".run.app") && backend.hostname.startsWith("ais-");
  if (isGoogleAiStudioBackend) {
    return json(request, env, {
      success: false,
      error: "\u062A\u0645 \u0645\u0646\u0639 Backend \u062A\u062C\u0631\u064A\u0628\u064A \u062A\u0627\u0628\u0639 \u0644\u0640 Google AI Studio",
      code: "BLOCKED_EXTERNAL_BACKEND"
    }, 503);
  }
  const targetUrl = new URL(publicUrl.pathname + publicUrl.search, backend);
  const headers = new Headers(request.headers);
  headers.set("host", backend.host);
  const response = await fetch(new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? void 0 : request.body,
    redirect: "manual"
  }));
  const responseHeaders = new Headers(response.headers);
  const location = responseHeaders.get("location");
  if (location && /(aistudio\.google\.com|accounts\.google\.com|\.run\.app)/i.test(location)) {
    return json(request, env, {
      success: false,
      error: "\u062A\u0645 \u0645\u0646\u0639 \u062A\u062D\u0648\u064A\u0644 \u062E\u0627\u0631\u062C\u064A \u0645\u0646 Backend",
      code: "BLOCKED_EXTERNAL_REDIRECT"
    }, 502);
  }
  if (location) {
    const rewritten = new URL(location, backend);
    rewritten.searchParams.forEach((value, key) => {
      if (value.includes(backend.origin)) {
        rewritten.searchParams.set(key, value.replaceAll(backend.origin, publicUrl.origin));
      }
    });
    if (rewritten.origin === backend.origin) {
      rewritten.protocol = publicUrl.protocol;
      rewritten.host = publicUrl.host;
    }
    responseHeaders.set("location", rewritten.toString());
  }
  const setCookie = responseHeaders.get("set-cookie");
  if (setCookie) {
    responseHeaders.set("set-cookie", setCookie.replaceAll(`Domain=${backend.hostname}`, `Domain=${publicUrl.hostname}`));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
}
async function serveAssets(request, env) {
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;
  const url = new URL(request.url);
  if (request.method === "GET" && !url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  }
  return asset;
}
function bostaHeaders(key, content = false) {
  return { ...content ? { "content-type": "application/json" } : {}, accept: "application/json", ...key ? { Authorization: key, "x-api-key": key } : {} };
}
function turboHeaders() {
  return { "content-type": "application/json", accept: "application/json" };
}
async function handleWhatsAppWebhook(request, env, _ctx) {
  const target = env.SUPABASE_WHATSAPP_WEBHOOK_URL || SUPABASE_WHATSAPP_WEBHOOK_URL;
  const targetUrl = new URL(target);
  const incomingUrl = new URL(request.url);
  incomingUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));
  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: {
      "content-type": request.headers.get("content-type") || "application/json",
      "x-hub-signature-256": request.headers.get("x-hub-signature-256") || ""
    },
    body: request.method === "GET" ? void 0 : await request.text()
  });
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" }
  });
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
    if (phone.length < 6) return json(request, env, { success: true, phone, totalOrders: 0, deliveredCount: 0, returnedCount: 0, pendingCount: 0, rate: null, rating: "new" }, 200);
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
    return json(request, env, { success: true, phone, totalOrders: completed + pending, deliveredCount: delivered, returnedCount: returned, pendingCount: pending, rate, rating: rate === null ? "new" : rate < 50 ? "low" : rate < 75 ? "moderate" : "excellent", hasBostaData: found });
  }
  if (path === "/api/bosta/business-locations") {
    const endpoints = ["/api/v2/pickup-locations/business", "/api/v2/pickup-locations", "/api/v2/business-locations", "/api/v2/users/me"];
    const authValues = [key, key.replace(/^bearer\s+/i, "").trim(), `Bearer ${key.replace(/^bearer\s+/i, "").trim()}`].filter(Boolean);
    for (const endpoint of endpoints) for (const auth of authValues) {
      const response2 = await fetch(`${base}${endpoint}`, { headers: { accept: "application/json", Authorization: auth, "x-api-key": key } });
      if (!response2.ok) continue;
      const value = await response2.json().catch(() => null);
      const locations = Array.isArray(value) ? value : value?.data?.list || value?.data?.locations || value?.data?.pickupAddress || value?.list || value?.locations || value?.pickupAddress || value?.business?.pickupAddress;
      if (Array.isArray(locations)) return json(request, env, { success: true, data: locations });
    }
    return json(request, env, { success: true, data: [] });
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
  } else return json(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 Bosta \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" }, 404);
  if (path === "/api/bosta/verify") return upstream(request, env, `${base}${target}`, { method: "GET", headers: bostaHeaders(key) }, "bosta");
  const headers = bostaHeaders(key, !["GET", "HEAD"].includes(method));
  const response = await upstream(request, env, `${base}${target}`, { method, headers, body: ["GET", "HEAD"].includes(method) ? void 0 : JSON.stringify(payload) }, "bosta");
  if (path === "/api/bosta/cities") {
    const data = await response.clone().json().catch(() => ({}));
    return json(request, env, { success: true, list: data?.data?.list || data?.data || data?.list || [], data });
  }
  if (path === "/api/bosta/districts") {
    const data = await response.clone().json().catch(() => ({}));
    return json(request, env, { success: true, districts: data?.data || data?.districts || [], data });
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
  } else if (path === "/api/turbo/pricing/calculator") return json(request, env, { success: true, governorate: url.searchParams.get("governorate") || "\u0627\u0644\u0642\u0627\u0647\u0631\u0629", deliveryFee: 83.52, returnFee: 83.52, cod: Number(url.searchParams.get("cod") || 0) });
  else return json(request, env, { success: false, error: "\u0645\u0633\u0627\u0631 Turbo \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645" }, 404);
  if (!key) return json(request, env, { success: false, error: "\u0645\u0641\u062A\u0627\u062D Turbo \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631" }, 400);
  const query = new URLSearchParams(url.search);
  query.delete("apiKey");
  query.delete("authenticationKey");
  if (method === "GET") query.set("authentication_key", key);
  const suffix = method === "GET" ? `?${query.toString()}` : "";
  const res = await upstream(request, env, `${base}${target}${suffix}`, { method, headers: turboHeaders(), body: method === "GET" ? void 0 : JSON.stringify(payload) }, "turbo");
  if (path === "/api/turbo/governorates") {
    const data = await res.clone().json().catch(() => ({}));
    return json(request, env, { success: true, governorates: data?.feed || data?.data || data });
  }
  if (path.match(/^\/api\/turbo\/shipments\/track\//) || path === "/api/shipping/turbo/track") {
    const data = await res.clone().json().catch(() => ({}));
    const raw = data?.result || data?.data || data;
    const item = Array.isArray(raw) ? raw[0] : raw;
    return json(request, env, { success: !!item && data?.success !== false, trackingInfo: item, data, status: item?.status || item?.state, statusArabic: item?.status || item?.state });
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
    if (url.pathname === "/health" || url.pathname === "/api") {
      return json(request, env, {
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
        return env.OTP_DB ? await handleOtpRequest(request, env, json) : await proxyBackendRequest(request, env);
      }
      if (url.pathname === "/api/webhook/whatsapp" || url.pathname === "/api/webhooks/whatsapp" || url.pathname === "/webhook/whatsapp" || url.pathname === "/wa-webhook-direct") {
        return await handleWhatsAppWebhook(request, env, ctx);
      }
      if (url.pathname.startsWith("/images/") || url.pathname === "/api/media/product-images") {
        return await handleMedia(request, env);
      }
      if (url.pathname.startsWith("/api/bosta/")) {
        return await bosta(request, env);
      }
      if (url.pathname.startsWith("/api/turbo/") || url.pathname === "/api/shipping/turbo/track") {
        return await turbo(request, env);
      }
      if (url.pathname.startsWith("/api/")) {
        return json(request, env, { success: false, error: `\u0645\u0633\u0627\u0631 API \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F: ${url.pathname}` }, 404);
      }
      return await serveAssets(request, env);
    } catch (error) {
      return json(request, env, { success: false, error: error?.message || "\u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0641\u064A Worker" }, 500);
    }
  }
};
export {
  index_default as default
};
