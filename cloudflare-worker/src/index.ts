import { handleOtpRequest } from "./otp";

type Fetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type R2Object = {
  body: ReadableStream;
  httpEtag?: string;
  httpMetadata?: { contentType?: string };
};
type R2Bucket = {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string | Blob, options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }): Promise<void>;
  get(key: string): Promise<R2Object | null>;
};

export interface Env {
  ASSETS: Fetcher;
  R2_IMAGES?: R2Bucket;
  APP_ORIGIN?: string;
  APP_BACKEND_URL?: string;
  MEDIA_PUBLIC_ORIGIN?: string;
  MEDIA_REQUIRE_AUTH?: string;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  OTP_DB?: any;
  OTP_HASH_SECRET?: string;
  RESEND_API_KEY?: string;
  BREVO_API_KEY?: string;
  OTP_RESEND_FROM?: string;
  OTP_BREVO_FROM?: string;
  OTP_FROM_NAME?: string;
  OTP_RESEND_DAILY_LIMIT?: string;
  OTP_BREVO_DAILY_LIMIT?: string;
  SUPABASE_WHATSAPP_WEBHOOK_URL?: string;
  META_VERIFY_TOKEN?: string;
  BOSTA_API_KEY?: string;
  BOSTA_PRODUCTION_BASE_URL?: string;
  BOSTA_STAGING_BASE_URL?: string;
  TURBO_API_KEY?: string;
  TURBO_BASE_URL?: string;
  TURBO_STAGING_BASE_URL?: string;
  TURBO_MAIN_CLIENT_CODE?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

const SUPABASE_WHATSAPP_WEBHOOK_URL = "https://kwirhppfowzqshltmoga.supabase.co/functions/v1/whatsapp-webhook";
const MAX_MEDIA_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Checks if the incoming origin is allowed.
 * Supports production domains, AI Studio dev/pre domains, localhost, and custom configured origin.
 */
function isOriginAllowed(origin: string, env: Env): boolean {
  if (!origin) return false;
  if (env.APP_ORIGIN && origin === env.APP_ORIGIN) return true;
  if (origin === "https://app.abdomedi.com" || origin === "http://app.abdomedi.com") return true;
  if (origin === "https://abdomedi.com" || origin === "http://abdomedi.com") return true;
  // Match any store subdomain (e.g., https://mystore.abdomedi.com)
  if (origin.match(/^https?:\/\/[a-z0-9-]+\.abdomedi\.com$/i)) return true;
  if (origin.match(/^https?:\/\/localhost(:[0-9]+)?$/)) return true;
  if (origin.match(/^https?:\/\/127\.0\.0\.1(:[0-9]+)?$/)) return true;
  // Match Google AI Studio Cloud Run preview & dev domains
  if (origin.match(/^https:\/\/ais-(dev|pre)-[a-z0-9-]+-[0-9]+\.[a-z0-9-]+\.run\.app$/i)) return true;
  if (origin.includes("run.app") && origin.includes("ais-")) return true;
  return false;
}

function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin") || "";
  const headers = new Headers(jsonHeaders);
  
  if (isOriginAllowed(origin, env)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  } else if (!origin) {
    // Direct requests / server-to-server
    headers.set("access-control-allow-origin", "*");
  }
  
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "Content-Type,Authorization,X-API-Key,X-Requested-With,X-Hub-Signature-256");
  headers.set("vary", "Origin");
  return headers;
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request, env) });
}

async function getSupabaseUserId(request: Request, env: Env): Promise<string | null> {
  const baseUrl = String(env.SUPABASE_URL || '').replace(/\\/$/, '');
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || '');
  const authorization = request.headers.get('Authorization') || '';
  if (!baseUrl || !publishableKey || !/^Bearer\\s+\\S+/i.test(authorization)) return null;

  try {
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: authorization }
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string };
    return user?.id ? String(user.id) : null;
  } catch {
    return null;
  }
}

async function userHasStoreMembership(
  request: Request,
  env: Env,
  userId: string,
  storeId: string
): Promise<boolean> {
  const baseUrl = String(env.SUPABASE_URL || '').replace(/\\/$/, '');
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || '');
  const authorization = request.headers.get('Authorization') || '';
  if (!baseUrl || !publishableKey || !userId || !storeId) return false;

  try {
    const query = new URLSearchParams({
      select: 'store_id',
      user_id: `eq.${userId}`,
      store_id: `eq.${storeId}`,
      limit: '1'
    });
    const response = await fetch(`${baseUrl}/rest/v1/store_memberships?${query.toString()}`, {
      headers: { apikey: publishableKey, Authorization: authorization }
    });
    if (!response.ok) return false;
    const rows = await response.json() as Array<{ store_id?: string }>;
    return Array.isArray(rows) && rows.some(row => row.store_id === storeId);
  } catch {
    return false;
  }
}

function safePathPart(value: unknown, fallback: string): string {
  const cleaned = String(value || fallback).normalize('NFKC').trim().replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
  return cleaned.slice(0, 100) || fallback;
}

function safeFilename(value: unknown): string {
  const raw = String(value || 'image.jpg').normalize('NFKC').trim();
  const ext = (raw.match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1] || 'jpg').toLowerCase().replace('jpeg', 'jpg');
  const stem = safePathPart(raw.replace(/\.[^.]+$/, ''), 'image');
  return `${stem}.${ext}`;
}

async function handleMedia(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (!env.R2_IMAGES) return json(request, env, { success: false, error: 'تخزين صور المنتجات غير مكوّن' }, 503);

  // Direct image path (GET / HEAD / DELETE)
  if (url.pathname.startsWith('/images/')) {
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'DELETE') {
      return json(request, env, { success: false, error: 'طريقة الطلب غير مدعومة' }, 405);
    }
    // Uploaded objects are stored with the "images/" prefix, so keep it in
    // the R2 key when resolving the public /images/... URL.
    const key = decodeURIComponent(url.pathname.slice(1)).replace(/^\/+/, '');
    if (!key || key.includes('..')) return json(request, env, { success: false, error: 'مسار صورة غير صالح' }, 400);

    if (request.method === 'DELETE') {
      if (env.MEDIA_REQUIRE_AUTH === 'true') {
        const userId = await getSupabaseUserId(request, env);
        const storeId = key.split('/')[1] || '';
        if (!userId) return json(request, env, { success: false, error: 'جلسة Supabase غير صالحة' }, 401);
        if (!(await userHasStoreMembership(request, env, userId, storeId))) {
          return json(request, env, { success: false, error: 'لا تملك صلاحية حذف صور هذا المتجر' }, 403);
        }
      }
      try {
        await (env.R2_IMAGES as any).delete(key);
        return json(request, env, { success: true, message: 'تم حذف الصورة من مساحة التخزين بنجاح', key });
      } catch (err: any) {
        return json(request, env, { success: false, error: err?.message || 'فشل حذف الصورة من التخزين' }, 500);
      }
    }

    const object = await env.R2_IMAGES.get(key);
    if (!object) return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
    const headers = new Headers({ 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*' });
    if (object.httpEtag) headers.set('etag', object.httpEtag);
    if (object.httpMetadata?.contentType) headers.set('content-type', object.httpMetadata.contentType);
    return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
  }

  // Deletion API routes: DELETE /api/media/product-images, POST/DELETE /api/media/delete
  const isDeleteApi = 
    (url.pathname === '/api/media/product-images' && request.method === 'DELETE') ||
    (url.pathname === '/api/media/delete' && (request.method === 'DELETE' || request.method === 'POST'));

  if (isDeleteApi) {
    const mediaUserId = env.MEDIA_REQUIRE_AUTH === 'true' ? await getSupabaseUserId(request, env) : null;
    if (env.MEDIA_REQUIRE_AUTH === 'true' && !mediaUserId) {
      return json(request, env, { success: false, error: 'جلسة Supabase غير صالحة' }, 401);
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      try {
        const form = await request.formData();
        body = Object.fromEntries(form.entries());
      } catch {
        body = {};
      }
    }

    const inputKeys: string[] = [];
    if (typeof body.key === 'string') inputKeys.push(body.key);
    if (typeof body.url === 'string') inputKeys.push(body.url);
    if (typeof body.imageUrl === 'string') inputKeys.push(body.imageUrl);
    if (Array.isArray(body.keys)) inputKeys.push(...body.keys);
    if (Array.isArray(body.urls)) inputKeys.push(...body.urls);
    if (Array.isArray(body.images)) inputKeys.push(...body.images);

    const qKey = url.searchParams.get('key');
    if (qKey) inputKeys.push(qKey);
    const qUrl = url.searchParams.get('url');
    if (qUrl) inputKeys.push(qUrl);

    const cleanedKeys = inputKeys
      .map(k => {
        if (!k || typeof k !== 'string') return '';
        let cleaned = k.trim();
        try {
          if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
            const parsed = new URL(cleaned);
            cleaned = parsed.pathname;
          }
        } catch {}
        cleaned = decodeURIComponent(cleaned).replace(/^\/+/, '');
        return cleaned;
      })
      .filter(k => k && k.startsWith('images/') && !k.includes('..'));

    if (!cleanedKeys.length) {
      return json(request, env, { success: false, error: 'لم يتم تحديد مفتاح أو رابط صورة صالح للحذف' }, 400);
    }

    if (env.MEDIA_REQUIRE_AUTH === 'true' && mediaUserId) {
      for (const key of cleanedKeys) {
        const storeId = key.split('/')[1] || '';
        if (!(await userHasStoreMembership(request, env, mediaUserId, storeId))) {
          return json(request, env, { success: false, error: 'لا تملك صلاحية حذف صور أحد المتاجر المحددة' }, 403);
        }
      }
    }

    try {
      if (cleanedKeys.length === 1) {
        await (env.R2_IMAGES as any).delete(cleanedKeys[0]);
      } else {
        await (env.R2_IMAGES as any).delete(cleanedKeys);
      }
      return json(request, env, { 
        success: true, 
        message: `تم حذف ${cleanedKeys.length} صورة من مساحة التخزين بنجاح`, 
        deletedCount: cleanedKeys.length,
        deletedKeys: cleanedKeys 
      });
    } catch (delErr: any) {
      return json(request, env, { success: false, error: delErr?.message || 'فشل حذف الصورة من التخزين' }, 500);
    }
  }

  // Upload route
  if (url.pathname !== '/api/media/product-images' || request.method !== 'POST') {
    return json(request, env, { success: false, error: 'مسار الوسائط غير مدعوم' }, 404);
  }
  const uploadUserId = env.MEDIA_REQUIRE_AUTH === 'true' ? await getSupabaseUserId(request, env) : null;
  if (env.MEDIA_REQUIRE_AUTH === 'true' && !uploadUserId) {
    return json(request, env, { success: false, error: 'جلسة Supabase غير صالحة' }, 401);
  }
  const form = await request.formData();
  const storeId = safePathPart(form.get('storeId'), 'store');
  if (env.MEDIA_REQUIRE_AUTH === 'true' && uploadUserId &&
      !(await userHasStoreMembership(request, env, uploadUserId, storeId))) {
    return json(request, env, { success: false, error: 'لا تملك صلاحية رفع صور لهذا المتجر' }, 403);
  }
  const productId = safePathPart(form.get('productId'), 'product');
  const files = form.getAll('files').filter((item): item is File => item instanceof File);
  if (!files.length) return json(request, env, { success: false, error: 'لم يتم اختيار أي صورة' }, 400);
  if (files.length > 20) return json(request, env, { success: false, error: 'الحد الأقصى 20 صورة في الطلب الواحد' }, 413);

  const images: Array<{ key: string; url: string; filename: string; contentType: string; size: number }> = [];
  for (const file of files) {
    if (!file.type.startsWith('image/')) return json(request, env, { success: false, error: `الملف ${file.name} ليس صورة` }, 415);
    if (file.size > MAX_MEDIA_FILE_SIZE) return json(request, env, { success: false, error: `حجم ${file.name} أكبر من 10 ميجابايت` }, 413);
    const filename = safeFilename(file.name);
    const key = `images/${storeId}/${productId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${filename}`;
    await env.R2_IMAGES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { storeId, productId, originalName: file.name }
    });
    const publicOrigin = (env.MEDIA_PUBLIC_ORIGIN || 'https://abdomedi.com').replace(/\/$/, '');
    images.push({ key, url: `${publicOrigin}/${key}`, filename, contentType: file.type, size: file.size });
  }
  return json(request, env, { success: true, images });
}

function clean(value: unknown): string {
  return String(value || "").replace(/^['"]+|['"]+$/g, "").replace(/^Bearer\s+/i, "").trim();
}

function keyFrom(request: Request, body: any, fallback?: string): string {
  const q = new URL(request.url).searchParams;
  return clean(body?.config?.authenticationKey || body?.config?.apiKey || body?.config?.apiToken || body?.apiKey || q.get("apiKey") || q.get("authenticationKey") || request.headers.get("x-api-key") || request.headers.get("authorization") || fallback);
}

function bostaBase(env: Env, staging: boolean) {
  return (staging ? env.BOSTA_STAGING_BASE_URL : env.BOSTA_PRODUCTION_BASE_URL) || "https://app.bosta.co";
}

function turboBase(env: Env, staging: boolean) {
  return ((staging ? env.TURBO_STAGING_BASE_URL || env.TURBO_BASE_URL : env.TURBO_BASE_URL) || "https://platform.turbo.info").replace(/\/$/, "");
}

async function readBody(request: Request): Promise<any> {
  if (["GET", "HEAD"].includes(request.method)) return {};
  return request.json().catch(() => ({}));
}

async function upstream(request: Request, env: Env, url: string, init: RequestInit, mode: "bosta" | "turbo" | "backend"): Promise<Response> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any;
  try { 
    data = JSON.parse(text); 
  } catch { 
    if (text && (text.includes("<html") || text.includes("<!DOCTYPE") || text.includes("<pre>"))) {
      const preMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      const cleanMsg = preMatch ? preMatch[1].replace(/<[^>]+>/g, '').trim() : (res.status === 404 ? `لم يتم العثور على المسار في خوادم ${mode} (404 Not Found)` : `استجابة غير صالحة من ${mode}`);
      data = { message: cleanMsg, raw: cleanMsg };
    } else {
      data = { raw: text.slice(0, 500) }; 
    }
  }
  if (res.ok) return json(request, env, data, res.status);
  return json(request, env, { success: false, error: data?.message || data?.error || data?.error_msg || `رفضت ${mode} الطلب (HTTP ${res.status})`, data, status: res.status }, res.status);
}

async function proxyBackendRequest(request: Request, env: Env): Promise<Response> {
  const backendUrl = env.APP_BACKEND_URL?.trim();
  if (!backendUrl) {
    return json(request, env, {
      success: false,
      error: "Backend غير مكوّن لهذا المسار",
      code: "BACKEND_NOT_CONFIGURED"
    }, 503);
  }

  const publicUrl = new URL(request.url);
  const backend = new URL(backendUrl);
  const isGoogleAiStudioBackend = backend.hostname.endsWith(".run.app") && backend.hostname.startsWith("ais-");
  if (isGoogleAiStudioBackend) {
    return json(request, env, {
      success: false,
      error: "تم منع Backend تجريبي تابع لـ Google AI Studio",
      code: "BLOCKED_EXTERNAL_BACKEND"
    }, 503);
  }

  const targetUrl = new URL(publicUrl.pathname + publicUrl.search, backend);
  const headers = new Headers(request.headers);
  headers.set("host", backend.host);

  const response = await fetch(new Request(targetUrl.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    redirect: "manual"
  }));
  const responseHeaders = new Headers(response.headers);

  const location = responseHeaders.get("location");
  if (location && /(aistudio\.google\.com|accounts\.google\.com|\.run\.app)/i.test(location)) {
    return json(request, env, {
      success: false,
      error: "تم منع تحويل خارجي من Backend",
      code: "BLOCKED_EXTERNAL_REDIRECT"
    }, 502);
  }

  if (location) {
    const rewritten = new URL(location, backend);
    // Keep browser navigation on the public app domain, including the
    // return_url used by the Google cookie-check page.
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

async function serveAssets(request: Request, env: Env): Promise<Response> {
  // Cloudflare's SPA fallback can return index.html for an unmatched path.
  // Preserve that behavior for client routes, but never disguise a missing
  // static file (especially a stale Vite JS/CSS chunk) as a successful HTML response.
  const response = await env.ASSETS.fetch(request);
  const pathname = new URL(request.url).pathname;
  const looksLikeAsset = pathname.startsWith("/assets/") || /\.(?:m?js|cjs|css|map|json|webmanifest|ico|png|jpe?g|gif|svg|webp|avif|woff2?|ttf|otf|eot|wasm|xml|txt|pdf)$/i.test(pathname);
  if (looksLikeAsset && response.status === 200 && response.headers.get("content-type")?.includes("text/html")) {
    return new Response(request.method === "HEAD" ? null : "Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return response;
}

function bostaHeaders(key: string, content = false): Record<string, string> {
  return { ...(content ? { "content-type": "application/json" } : {}), accept: "application/json", ...(key ? { Authorization: key, "x-api-key": key } : {}) };
}

function turboHeaders() { return { "content-type": "application/json", accept: "application/json" }; }

/* -------------------------------------------------------------------------- */
/* WhatsApp / Meta Cloud API Webhook Edge Handler                              */
/* -------------------------------------------------------------------------- */
async function handleWhatsAppWebhook(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
  const target = env.SUPABASE_WHATSAPP_WEBHOOK_URL || SUPABASE_WHATSAPP_WEBHOOK_URL;
  const targetUrl = new URL(target);
  const incomingUrl = new URL(request.url);
  incomingUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));
  const response = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: {
      "content-type": request.headers.get("content-type") || "application/json",
      "x-hub-signature-256": request.headers.get("x-hub-signature-256") || "",
    },
    body: request.method === "GET" ? undefined : await request.text(),
  });
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}

/* -------------------------------------------------------------------------- */
/* Bosta Carrier Proxy                                                        */
/* -------------------------------------------------------------------------- */
async function bosta(request: Request, env: Env): Promise<Response> {
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
    const headers = { accept: "application/json", Authorization: `Bearer ${bareKey}`, "x-api-key": bareKey };
    let delivered = 0; let returned = 0; let pending = 0; let found = false;
    const candidates = [
      `/api/v2/deliveries/customer-rating?phone=${encodeURIComponent(phone)}`,
      `/api/v2/deliveries/customer-evaluation?phone=${encodeURIComponent(phone)}`,
      `/api/v2/customers/evaluation?phone=${encodeURIComponent(phone)}`,
      `/api/v2/deliveries?dropOffAddress.phone=${encodeURIComponent(phone)}&page=1&limit=50`
    ];
    for (const candidate of candidates) {
      const response = await fetch(`${base}${candidate}`, { headers });
      if (!response.ok) continue;
      const value: any = await response.json().catch(() => null);
      const data: any = value?.data || value;
      const list = Array.isArray(data) ? data : data?.list || data?.deliveries || [];
      if (Array.isArray(list) && list.length) {
        found = true;
        for (const item of list) {
          const state = String(item.state?.value || item.state?.name || item.state || item.status || "").toLowerCase();
          if (state.includes("deliver") || state.includes("تم التسليم") || state.includes("سلم")) delivered++;
          else if (state.includes("return") || state.includes("cancel") || state.includes("مرتجع") || state.includes("ملغي") || state.includes("مرفوض")) returned++;
          else pending++;
        }
        break;
      }
    }
    const completed = delivered + returned; 
    const rate = completed ? Math.round((delivered / completed) * 1000) / 10 : null;
    return json(request, env, { success: true, phone, totalOrders: completed + pending, deliveredCount: delivered, returnedCount: returned, pendingCount: pending, rate, rating: rate === null ? "new" : rate < 50 ? "low" : rate < 75 ? "moderate" : "excellent", hasBostaData: found });
  }

  if (path === "/api/bosta/business-locations") {
    const endpoints = ["/api/v2/pickup-locations/business", "/api/v2/pickup-locations", "/api/v2/business-locations", "/api/v2/users/me"];
    const authValues = [key, key.replace(/^bearer\s+/i, "").trim(), `Bearer ${key.replace(/^bearer\s+/i, "").trim()}`].filter(Boolean);
    for (const endpoint of endpoints) for (const auth of authValues) {
      const response = await fetch(`${base}${endpoint}`, { headers: { accept: "application/json", Authorization: auth, "x-api-key": key } });
      if (!response.ok) continue;
      const value: any = await response.json().catch(() => null);
      const locations = Array.isArray(value) ? value : value?.data?.list || value?.data?.locations || value?.data?.pickupAddress || value?.list || value?.locations || value?.pickupAddress || value?.business?.pickupAddress;
      if (Array.isArray(locations)) return json(request, env, { success: true, data: locations });
    }
    return json(request, env, { success: true, data: [] });
  }

  let target = ""; 
  let method = request.method; 
  let payload: any = body;

  if (path === "/api/bosta/verify") target = "/api/v2/cities?countryId=60e4482c7cb7d4bc4849c4d5";
  else if (path === "/api/bosta/cities") target = "/api/v2/cities?countryId=60e4482c7cb7d4bc4849c4d5";
  else if (path === "/api/bosta/districts") target = "/api/v2/cities/getAllDistricts?countryId=60e4482c7cb7d4bc4849c4d5";
  else if (path.match(/^\/api\/bosta\/cities\/[^/]+\/districts$/)) target = `/api/v2/cities/${encodeURIComponent(path.split("/")[4])}/districts`;
  else if (path.match(/^\/api\/bosta\/cities\/[^/]+\/zones$/)) target = `/api/v2/cities/${encodeURIComponent(path.split("/")[4])}/zones`;
  else if (path === "/api/bosta/deliveries/create") { target = "/api/v2/deliveries?apiVersion=1"; method = "POST"; payload = bostaDelivery(body?.order || {}, body?.config || {}); }
  else if (path === "/api/bosta/deliveries/bulk") { target = "/api/v2/deliveries/bulk"; method = "POST"; payload = body; }
  else if (path === "/api/bosta/deliveries/mass-awb") { target = "/api/v2/deliveries/mass-awb"; method = "POST"; payload = body; }
  else if (path.match(/^\/api\/bosta\/deliveries\/track\/([^/]+)$/)) target = `/api/v2/deliveries/track-shipment?trackingNumber=${encodeURIComponent(path.split("/")[5])}`;
  else if (path.match(/^\/api\/bosta\/deliveries\/([^/]+)\/awb$/)) { target = "/api/v2/deliveries/mass-awb"; method = "POST"; payload = { trackingNumbers: [path.split("/")[4]], requestedAwbType: url.searchParams.get("type") || "A4", lang: url.searchParams.get("lang") || "ar" }; }
  else if (path.match(/^\/api\/bosta\/deliveries\/([^/]+)\/terminate$/)) { target = `/api/v2/deliveries/${encodeURIComponent(path.split("/")[4])}/terminate`; method = "POST"; }
  else if (path.match(/^\/api\/bosta\/deliveries\/([^/]+)$/)) target = `/api/v2/deliveries/${encodeURIComponent(path.split("/")[4])}`;
  else if (path === "/api/bosta/pickups/create") { target = "/api/v2/pickups"; method = "POST"; payload = body; }
  else if (path === "/api/bosta/pickups") target = "/api/v2/pickups?page=" + encodeURIComponent(url.searchParams.get("page") || "1") + "&perPage=" + encodeURIComponent(url.searchParams.get("perPage") || "100");
  else if (path.match(/^\/api\/bosta\/pickups\/([^/]+)$/)) target = `/api/v2/pickups/${encodeURIComponent(path.split("/")[4])}`;
  else if (path === "/api/bosta/pickup-locations") { target = "/api/v2/pickup-locations"; method = "POST"; }
  else if (path === "/api/bosta/business-locations") target = "/api/v2/pickup-locations/business";
  else if (path === "/api/bosta/products") target = "/api/v2/products";
  else if (path === "/api/bosta/pricing/calculator") target = "/api/v2/pricing/calculator" + url.search;
  else if (path === "/api/bosta/pricing/insurance") target = "/api/v2/pricing/insuranceFeeEstimate" + url.search;
  else if (path === "/api/bosta/customer-rate") target = "/api/v2/deliveries" + url.search;
  else if (path.match(/^\/api\/bosta\/businesses\//)) target = "/api/v2" + path.replace(/^\/api\/bosta/, "");
  else if (path === "/api/bosta/users/refresh-token") { target = "/api/v2/users/refresh-token"; method = "POST"; }
  else return json(request, env, { success: false, error: "مسار Bosta غير مدعوم" }, 404);

  if (path === "/api/bosta/verify") return upstream(request, env, `${base}${target}`, { method: "GET", headers: bostaHeaders(key) }, "bosta");
  
  const headers = bostaHeaders(key, !["GET", "HEAD"].includes(method));
  const response = await upstream(request, env, `${base}${target}`, { method, headers, body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(payload) }, "bosta");
  
  if (path === "/api/bosta/cities") { const data: any = await response.clone().json().catch(() => ({})); return json(request, env, { success: true, list: data?.data?.list || data?.data || data?.list || [], data }); }
  if (path === "/api/bosta/districts") { const data: any = await response.clone().json().catch(() => ({})); return json(request, env, { success: true, districts: data?.data || data?.districts || [], data }); }
  return response;
}

function bostaDelivery(order: any, config: any) {
  const names = String(order.customerName || "عميل").trim().split(/\s+/);
  const cod = order.paymentStatus === "مدفوع" ? 0 : Math.max(0, Number(order.totalPrice ?? ((order.productPrice || 0) + (order.shippingFee || 0))) - Number(order.advancePayment || 0));
  const items = Array.isArray(order.items) ? order.items : [];
  return { 
    type: 10, 
    specs: { 
      packageDetails: { 
        itemsCount: items.reduce((n: number, x: any) => n + Number(x.quantity || 1), 0) || 1, 
        description: items.map((x: any) => `${x.name || x.productName || "منتج"} × ${x.quantity || 1}`).join(" + ") || order.productName || "منتجات المتجر" 
      }, 
      packageType: "Parcel" 
    }, 
    dropOffAddress: { 
      firstLine: order.shippingAddress || "عنوان العميل", 
      city: order.city || order.governorate || "Cairo", 
      districtId: order.bostaDistrictId, 
      zoneId: order.bostaZoneId, 
      buildingNumber: order.buildingNumber, 
      floor: order.floor, 
      apartment: order.apartment, 
      phone: String(order.customerPhone || "").replace(/\D/g, "") 
    }, 
    receiver: { 
      firstName: names[0] || "عميل", 
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

/* -------------------------------------------------------------------------- */
/* Turbo Carrier Proxy                                                        */
/* -------------------------------------------------------------------------- */
async function turbo(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url); 
  const path = url.pathname; 
  const body = await readBody(request); 
  const staging = url.searchParams.get("staging") === "true" || body?.config?.environment === "staging"; 
  const key = keyFrom(request, body, env.TURBO_API_KEY); 
  const base = turboBase(env, staging); 
  const client = Number(body?.config?.mainClientCode || url.searchParams.get("clientCode") || env.TURBO_MAIN_CLIENT_CODE || 74068);

  let target = ""; 
  let method = request.method; 
  let payload: any = body;

  if (path === "/api/turbo/verify" || path === "/api/turbo/governorates") { target = "/external-api/get-government"; method = "GET"; }
  else if (path.match(/^\/api\/turbo\/areas\/[^/]+$/)) { target = `/external-api/get-area/${path.split("/")[4]}`; method = "GET"; }
  else if (path === "/api/turbo/login") { target = "/external-api/login"; method = "POST"; payload = { ...body, authentication_key: key }; }
  else if (path === "/api/turbo/shipments/create") { target = "/external-api/add-order"; method = "POST"; payload = turboOrder(body?.order || {}, body?.config || {}, key, client); }
  else if (path.match(/^\/api\/turbo\/shipments\/track\/([^/]+)$/) || path === "/api/shipping/turbo/track") { const tracking = path === "/api/shipping/turbo/track" ? (body.remote_shipment_id || body.search_key || body.trackingNumber) : path.split("/")[5]; target = "/external-api/search-order"; method = "POST"; payload = { authentication_key: key, search_key: tracking, tracking_number: tracking, main_client_code: client }; }
  else if (path === "/api/turbo/shipments/status") { target = "/external-api/search-order"; method = "POST"; payload = { ...body, authentication_key: key, main_client_code: client }; }
  else if (path === "/api/turbo/shipments/cancel") { target = "/external-api/canceled"; method = "POST"; payload = { authentication_key: key, code: body.trackingNumber, main_client_code: client }; }
  else if (path === "/api/turbo/shipments/delete") { target = "/external-api/delete-order"; method = "POST"; payload = { authentication_key: key, search_key: body.trackingNumber, tracking_number: body.trackingNumber, code: body.trackingNumber, id: body.trackingNumber, main_client_code: client }; }
  else if (path === "/api/turbo/shipments/edit") { target = "/external-api/edit-order"; method = "POST"; payload = { ...turboOrder(body.order || {}, body.config || {}, key, client), code: body.trackingNumber }; }
  else if (path === "/api/turbo/shipments/resend") { target = "/external-api/resend-request"; method = "POST"; payload = { authentication_key: key, code: body.trackingNumber, main_client_code: client }; }
  else if (path.startsWith("/api/turbo/tickets/")) { target = "/external-api" + path.replace("/api/turbo/tickets", "/tickets"); method = request.method; payload = { ...body, authentication_key: key, main_client_code: client }; }
  else if (path === "/api/turbo/tickets") { target = "/external-api/tickets"; method = "GET"; }
  else if (path === "/api/turbo/pricing/calculator") return json(request, env, { success: true, governorate: url.searchParams.get("governorate") || "القاهرة", deliveryFee: 83.52, returnFee: 83.52, cod: Number(url.searchParams.get("cod") || 0) });
  else return json(request, env, { success: false, error: "مسار Turbo غير مدعوم" }, 404);

  if (!key) return json(request, env, { success: false, error: "مفتاح Turbo غير متوفر" }, 400);
  const query = new URLSearchParams(url.search); query.delete("apiKey"); query.delete("authenticationKey");
  if (method === "GET") query.set("authentication_key", key);
  const suffix = method === "GET" ? `?${query.toString()}` : "";
  const res = await upstream(request, env, `${base}${target}${suffix}`, { method, headers: turboHeaders(), body: method === "GET" ? undefined : JSON.stringify(payload) }, "turbo");
  if (path === "/api/turbo/governorates") { const data: any = await res.clone().json().catch(() => ({})); return json(request, env, { success: true, governorates: data?.feed || data?.data || data }); }
  if (path.match(/^\/api\/turbo\/shipments\/track\//) || path === "/api/shipping/turbo/track") { const data: any = await res.clone().json().catch(() => ({})); const raw = data?.result || data?.data || data; const item = Array.isArray(raw) ? raw[0] : raw; return json(request, env, { success: !!item && data?.success !== false, trackingInfo: item, data, status: item?.status || item?.state, statusArabic: item?.status || item?.state }); }
  return res;
}

function turboOrder(order: any, config: any, key: string, client: number) { 
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
    order_summary: (order.items || []).map((i: any) => `${i.productName || i.name || "منتج"} (${i.quantity || 1})`).join(" - "), 
    can_open: (config.allowOpenPackage ?? true) ? 1 : 0, 
    weight: Number(order.weight || 1), 
    quantity: (order.items || []).reduce((n: number, i: any) => n + Number(i.quantity || 1), 0) || 1, 
    location_id: order.location_id || order.turboLocationId || order.locationId 
  }; 
}

/* -------------------------------------------------------------------------- */
/* Main Worker Fetch Handler                                                  */
/* -------------------------------------------------------------------------- */
export default { 
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    // Health and status endpoint
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
        message: "بوابة الربط السحابي مع شركات الشحن والواتساب تعمل بنجاح وبسرعة فائقة (Edge Gateway)"
      });
    }

    try { 
      if (url.pathname === "/api/send-otp" || url.pathname === "/api/verify-otp") {
        return env.OTP_DB
          ? await handleOtpRequest(request, env, json)
          : await proxyBackendRequest(request, env);
      }

      // Meta WhatsApp Webhook Route
      if (url.pathname === "/api/webhook/whatsapp" || url.pathname === "/api/webhooks/whatsapp" || url.pathname === "/webhook/whatsapp" || url.pathname === "/wa-webhook-direct") {
        return await handleWhatsAppWebhook(request, env, ctx);
      }

      if (url.pathname.startsWith('/images/') || url.pathname === '/api/media/product-images' || url.pathname === '/api/media/delete') {
        return await handleMedia(request, env);
      }

      // Bosta Carrier Routes
      if (url.pathname.startsWith("/api/bosta/")) {
        return await bosta(request, env);
      }

      // Turbo Carrier Routes
      if (url.pathname.startsWith("/api/turbo/") || url.pathname === "/api/shipping/turbo/track") {
        return await turbo(request, env);
      }

      // Unknown API routes stay protected behind the API gateway and return
      // JSON instead of being mistaken for a client-side SPA route.
      if (url.pathname.startsWith("/api/")) {
        return json(request, env, { success: false, error: `مسار API غير موجود: ${url.pathname}` }, 404);
      }

      // Static files and client-side routes are served by the Worker Assets
      // binding, so the app does not depend on APP_BACKEND_URL.
      return await serveAssets(request, env);
    } catch (error: any) { 
      return json(request, env, { success: false, error: error?.message || "خطأ داخلي في Worker" }, 500); 
    }
  } 
};
