export interface Env {
  APP_ORIGIN?: string;
  BOSTA_API_KEY?: string;
  BOSTA_PRODUCTION_BASE_URL?: string;
  BOSTA_STAGING_BASE_URL?: string;
  TURBO_API_KEY?: string;
  TURBO_BASE_URL?: string;
  TURBO_MAIN_CLIENT_CODE?: string;
}

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin") || "";
  const allowed = new Set([env.APP_ORIGIN || "https://app.abdomedi.com"]);
  const headers = new Headers(jsonHeaders);
  if (allowed.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  }
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type, Authorization, X-API-Key");
  headers.set("vary", "Origin");
  return headers;
}

function response(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request, env) });
}

function cleanSecret(value: unknown): string {
  return String(value || "").replace(/^['"]+|['"]+$/g, "").replace(/^Bearer\s+/i, "").trim();
}

function bostaBase(env: Env, staging: boolean): string {
  const base = staging
    ? (env.BOSTA_STAGING_BASE_URL || "https://stg-app.bosta.co")
    : (env.BOSTA_PRODUCTION_BASE_URL || "https://app.bosta.co");
  return base.replace(/\/$/, "");
}

async function parseUpstream(res: Response): Promise<{ data: any; text: string }> {
  const text = await res.text();
  try { return { data: JSON.parse(text), text }; } catch { return { data: null, text }; }
}

async function bostaVerify(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { apiKey?: string; environment?: string };
  const key = cleanSecret(body.apiKey || env.BOSTA_API_KEY);
  if (!key) return response(request, env, { success: false, error: "مفتاح Bosta غير متوفر" }, 400);

  const base = bostaBase(env, body.environment === "staging");
  const upstream = await fetch(`${base}/api/v2/deliveries?page=1&perPage=1`, {
    headers: { Authorization: key, "x-api-key": key, Accept: "application/json" }
  });
  const parsed = await parseUpstream(upstream);
  if (!upstream.ok) {
    return response(request, env, {
      success: false,
      error: `رفضت Bosta الطلب (HTTP ${upstream.status})`,
      rawError: parsed.data?.message || parsed.data?.error || parsed.text.slice(0, 300),
      lastStatus: upstream.status
    });
  }
  return response(request, env, {
    success: true,
    detectedEnvironment: body.environment === "staging" ? "staging" : "production",
    verifiedVia: "/api/v2/deliveries?page=1&perPage=1",
    data: parsed.data
  });
}

async function turboRequest(env: Env, path: string, key: string, method = "POST"): Promise<{ res: Response; data: any; text: string }> {
  const base = (env.TURBO_BASE_URL || "https://platform.turbo.info").replace(/\/$/, "");
  const form = new URLSearchParams({ authentication_key: key });
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: method === "GET" ? undefined : form.toString()
  });
  const parsed = await parseUpstream(res);
  return { res, ...parsed };
}

async function turboVerify(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { apiKey?: string };
  const key = cleanSecret(body.apiKey || env.TURBO_API_KEY);
  if (!key) return response(request, env, { success: false, error: "مفتاح Turbo غير متوفر" }, 400);

  const result = await turboRequest(env, "/external-api/get-government", key);
  if (!result.res.ok) {
    return response(request, env, {
      success: false,
      error: `رفضت Turbo الطلب (HTTP ${result.res.status})`,
      rawError: result.data?.message || result.data?.error || result.text.slice(0, 300),
      lastStatus: result.res.status
    });
  }
  return response(request, env, { success: true, data: result.data });
}

async function turboGovernorates(request: Request, env: Env): Promise<Response> {
  const key = cleanSecret(request.headers.get("x-api-key") || env.TURBO_API_KEY);
  if (!key) return response(request, env, { success: false, error: "مفتاح Turbo غير متوفر" }, 400);
  const result = await turboRequest(env, "/external-api/get-government", key);
  return response(request, env, result.data || { success: false, error: result.text.slice(0, 300) }, result.res.ok ? 200 : result.res.status);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (url.pathname === "/health") return response(request, env, { ok: true, service: "abdomedi-carrier-api" });
    if (url.pathname === "/api/bosta/verify" && request.method === "POST") return bostaVerify(request, env);
    if (url.pathname === "/api/bosta/cities" && request.method === "GET") {
      const upstream = await fetch(`${bostaBase(env, false)}/api/v2/cities`, { headers: { Accept: "application/json" } });
      const parsed = await parseUpstream(upstream);
      return response(request, env, parsed.data || { success: false, error: parsed.text.slice(0, 300) }, upstream.ok ? 200 : upstream.status);
    }
    if (url.pathname === "/api/turbo/verify" && request.method === "POST") return turboVerify(request, env);
    if (url.pathname === "/api/turbo/governorates" && request.method === "GET") return turboGovernorates(request, env);
    if (url.pathname === "/api/webhooks/bosta" || url.pathname.startsWith("/api/webhooks/turbo")) {
      return response(request, env, { success: false, error: "Webhook route is reserved for the database-bound migration phase" }, 501);
    }
    return response(request, env, { success: false, error: "المسار غير موجود" }, 404);
  }
};
