type Env = {
  R2_IMAGES: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

type R2Bucket = {
  put(key: string, value: ReadableStream, options?: { httpMetadata?: Record<string, string>; customMetadata?: Record<string, string> }): Promise<void>;
  get(key: string): Promise<{ body: ReadableStream; httpEtag?: string; httpMetadata?: { contentType?: string } } | null>;
  delete(keys: string | string[]): Promise<void>;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;
const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,HEAD,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "Content-Type,Authorization",
  "vary": "Origin"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" }
  });
}

function cleanPathPart(value: unknown, fallback: string): string {
  return String(value || fallback)
    .normalize("NFKC")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100) || fallback;
}

function safeKey(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let raw = value.trim();
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) raw = new URL(raw).pathname;
  } catch {
    return null;
  }
  try {
    raw = decodeURIComponent(raw).replace(/^\/+/, "");
  } catch {
    return null;
  }
  if (!raw.startsWith("images/") || raw.includes("..")) return null;
  const parts = raw.split("/");
  if (parts.length < 3 || !parts[1]) return null;
  return raw;
}

async function authenticate(request: Request, env: Env): Promise<{ userId: string; token: string } | null> {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.toLowerCase().startsWith("bearer ") || !authorization.slice(7).trim()) return null;

  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || "");
  if (!baseUrl || !publishableKey) return null;

  try {
    const response = await fetch(`${baseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: authorization }
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string };
    return user?.id ? { userId: String(user.id), token: authorization } : null;
  } catch {
    return null;
  }
}

async function hasStoreAccess(auth: { userId: string; token: string }, env: Env, storeId: string): Promise<boolean> {
  if (!storeId) return false;
  const baseUrl = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const query = new URLSearchParams({
    select: "store_id",
    user_id: `eq.${auth.userId}`,
    store_id: `eq.${storeId}`,
    limit: "1"
  });

  try {
    const response = await fetch(`${baseUrl}/rest/v1/store_memberships?${query.toString()}`, {
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: auth.token
      }
    });
    if (!response.ok) return false;
    const rows = await response.json() as Array<{ store_id?: string }>;
    return Array.isArray(rows) && rows.some(row => row.store_id === storeId);
  } catch {
    return false;
  }
}

function storeIdFromKey(key: string): string {
  return key.split("/")[1] || "";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

    if (url.pathname.startsWith("/images/")) {
      const key = safeKey(url.pathname);
      if (!key) return json({ success: false, error: "Invalid image path" }, 400);

      if (request.method === "GET" || request.method === "HEAD") {
        const object = await env.R2_IMAGES.get(key);
        if (!object) return new Response("Not found", { status: 404, headers: corsHeaders });
        const headers = new Headers({
          ...corsHeaders,
          "cache-control": "public, max-age=31536000, immutable"
        });
        if (object.httpEtag) headers.set("etag", object.httpEtag);
        if (object.httpMetadata?.contentType) headers.set("content-type", object.httpMetadata.contentType);
        return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
      }

      if (request.method === "DELETE") {
        const auth = await authenticate(request, env);
        if (!auth) return json({ success: false, error: "Invalid Supabase session" }, 401);
        if (!(await hasStoreAccess(auth, env, storeIdFromKey(key)))) {
          return json({ success: false, error: "You do not have access to this store's media" }, 403);
        }
        await env.R2_IMAGES.delete(key);
        return json({ success: true, deletedCount: 1, key });
      }

      return json({ success: false, error: "Method not allowed" }, 405);
    }

    if (url.pathname !== "/api/media/product-images" && url.pathname !== "/api/media/delete") {
      return json({ success: false, error: "Media route not found" }, 404);
    }

    if (request.method === "POST" && url.pathname === "/api/media/product-images") {
      const auth = await authenticate(request, env);
      if (!auth) return json({ success: false, error: "Invalid Supabase session" }, 401);

      const form = await request.formData();
      const storeId = cleanPathPart(form.get("storeId"), "store");
      const productId = cleanPathPart(form.get("productId"), "product");
      if (!(await hasStoreAccess(auth, env, storeId))) {
        return json({ success: false, error: "You do not have upload access to this store" }, 403);
      }

      const files = form.getAll("files").filter((item): item is File => item instanceof File);
      if (!files.length) return json({ success: false, error: "No images selected" }, 400);
      if (files.length > MAX_FILES) return json({ success: false, error: "Maximum 20 images per request" }, 413);

      const images: Array<{ key: string; url: string; filename: string; contentType: string; size: number }> = [];
      for (const file of files) {
        if (!file.type.startsWith("image/")) return json({ success: false, error: `${file.name} is not an image` }, 415);
        if (file.size > MAX_FILE_SIZE) return json({ success: false, error: `${file.name} exceeds 10 MB` }, 413);

        const filename = String(file.name || "image.jpg").normalize("NFKC").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 120) || "image.jpg";
        const key = `images/${storeId}/${productId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${filename}`;
        await env.R2_IMAGES.put(key, file.stream(), {
          httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" },
          customMetadata: { storeId, productId, originalName: file.name }
        });
        images.push({
          key,
          url: `https://abdomedi.com/${key}`,
          filename,
          contentType: file.type,
          size: file.size
        });
      }
      return json({ success: true, images });
    }

    if (request.method === "DELETE") {
      const auth = await authenticate(request, env);
      if (!auth) return json({ success: false, error: "Invalid Supabase session" }, 401);

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const values: unknown[] = [
        body.key, body.url, body.imageUrl,
        ...(Array.isArray(body.keys) ? body.keys : []),
        ...(Array.isArray(body.urls) ? body.urls : []),
        ...(Array.isArray(body.images) ? body.images : [])
      ];
      const keys = [...new Set(values.map(safeKey).filter((key): key is string => Boolean(key)))];
      if (!keys.length) return json({ success: false, error: "No valid image keys provided" }, 400);

      for (const key of keys) {
        if (!(await hasStoreAccess(auth, env, storeIdFromKey(key)))) {
          return json({ success: false, error: "You do not have delete access to one or more stores" }, 403);
        }
      }
      await env.R2_IMAGES.delete(keys);
      return json({ success: true, deletedCount: keys.length, deletedKeys: keys });
    }

    return json({ success: false, error: "Method not allowed" }, 405);
  }
};
