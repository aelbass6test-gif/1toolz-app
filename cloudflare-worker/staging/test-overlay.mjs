const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function authorized(request, env) {
  const expected = env.SYNTHETIC_TEST_BEARER;
  const actual = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1] || "";
  return Boolean(expected && actual && actual === expected);
}

function safePart(value, max = 96) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, max);
}

function parseMetadata(raw) {
  if (raw == null || raw === "") return {};
  if (typeof raw !== "string" || raw.length > 12_000) throw new Error("invalid_metadata");
  const value = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_metadata");
  return value;
}

async function media(request, env, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 3 && request.method === "POST") {
    if (!env.SYNTHETIC_MEDIA || !env.SYNTHETIC_DB) return json({ error: "staging_storage_not_configured" }, 503);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "file_required" }, 400);
    if (!file.type.startsWith("image/")) return json({ error: "image_file_required" }, 415);
    if (!file.size || file.size > MAX_MEDIA_BYTES) return json({ error: "file_size_out_of_range" }, 413);
    let metadata;
    try { metadata = parseMetadata(form.get("metadata")); }
    catch { return json({ error: "invalid_metadata" }, 400); }

    const id = crypto.randomUUID();
    const filename = safePart(file.name, 120) || "upload.bin";
    const objectKey = `staging/synthetic/${id}/${filename}`;
    const createdAt = new Date().toISOString();
    await env.SYNTHETIC_MEDIA.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { mediaId: id, environment: "staging-synthetic" },
    });
    try {
      await env.SYNTHETIC_DB.prepare(
        "INSERT INTO staging_media (id, object_key, file_name, content_type, size_bytes, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(id, objectKey, filename, file.type, file.size, JSON.stringify(metadata), createdAt).run();
    } catch (error) {
      await env.SYNTHETIC_MEDIA.delete(objectKey).catch(() => {});
      throw error;
    }
    return json({ id, filename, contentType: file.type, size: file.size, metadata, createdAt, contentPath: `/api/staging/media/${id}/content` }, 201);
  }

  if (parts.length >= 4) {
    const id = safePart(parts[3], 64);
    if (!id) return json({ error: "invalid_media_id" }, 400);
    const row = await env.SYNTHETIC_DB.prepare(
      "SELECT id, object_key, file_name, content_type, size_bytes, metadata_json, created_at FROM staging_media WHERE id = ?"
    ).bind(id).first();
    if (!row) return json({ error: "not_found" }, 404);

    if (parts.length === 5 && parts[4] === "content" && (request.method === "GET" || request.method === "HEAD")) {
      const object = await env.SYNTHETIC_MEDIA.get(row.object_key);
      if (!object) return json({ error: "object_not_found" }, 404);
      const headers = new Headers({
        "content-type": row.content_type,
        "content-length": String(row.size_bytes),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      });
      if (object.httpEtag) headers.set("etag", object.httpEtag);
      headers.set("x-staging-media-id", row.id);
      return new Response(request.method === "HEAD" ? null : object.body, { status: 200, headers });
    }
    if (parts.length === 4 && request.method === "GET") {
      let metadata = {};
      try { metadata = JSON.parse(row.metadata_json); } catch {}
      return json({ id: row.id, filename: row.file_name, contentType: row.content_type, size: row.size_bytes, metadata, createdAt: row.created_at, contentPath: `/api/staging/media/${row.id}/content` });
    }
    if (parts.length === 4 && request.method === "DELETE") {
      await env.SYNTHETIC_MEDIA.delete(row.object_key);
      await env.SYNTHETIC_DB.prepare("DELETE FROM staging_media WHERE id = ?").bind(id).run();
      return json({ deleted: true, id: row.id });
    }
  }
  return json({ error: "not_found" }, 404);
}

async function typed(request, env, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const recordType = safePart(decodeURIComponent(parts[3] || ""), 64).toLowerCase();
  const id = safePart(decodeURIComponent(parts[4] || ""), 96);
  if (!env.SYNTHETIC_DB) return json({ error: "staging_database_not_configured" }, 503);
  if (!recordType || !/^[a-z][a-z0-9_-]*$/.test(recordType)) return json({ error: "invalid_record_type" }, 400);

  if (parts.length === 4 && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "json_object_required" }, 400);
    const value = Object.hasOwn(body, "data") ? body.data : body;
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_JSON_BYTES) return json({ error: "record_too_large" }, 413);
    const recordId = safePart(body.id, 96) || crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.SYNTHETIC_DB.prepare(
        "INSERT INTO typed_records (record_type, id, json_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(recordType, recordId, encoded, now, now).run();
    } catch (error) {
      if (String(error?.message || error).toLowerCase().includes("unique")) return json({ error: "already_exists", id: recordId }, 409);
      throw error;
    }
    return json({ type: recordType, id: recordId, data: value, createdAt: now, updatedAt: now }, 201);
  }

  if (parts.length === 4 && request.method === "GET") {
    const result = await env.SYNTHETIC_DB.prepare(
      "SELECT id, json_value, created_at, updated_at FROM typed_records WHERE record_type = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(recordType).all();
    return json({ records: (result.results || []).map(row => ({ type: recordType, id: row.id, data: JSON.parse(row.json_value), createdAt: row.created_at, updatedAt: row.updated_at })) });
  }

  if (parts.length !== 5 || !id) return json({ error: "record_id_required" }, 400);
  if (request.method === "GET") {
    const row = await env.SYNTHETIC_DB.prepare(
      "SELECT id, json_value, created_at, updated_at FROM typed_records WHERE record_type = ? AND id = ?"
    ).bind(recordType, id).first();
    if (!row) return json({ error: "not_found" }, 404);
    return json({ type: recordType, id: row.id, data: JSON.parse(row.json_value), createdAt: row.created_at, updatedAt: row.updated_at });
  }
  if (request.method === "PUT") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "json_object_required" }, 400);
    const value = Object.hasOwn(body, "data") ? body.data : body;
    const encoded = JSON.stringify(value);
    if (encoded.length > MAX_JSON_BYTES) return json({ error: "record_too_large" }, 413);
    const now = new Date().toISOString();
    const result = await env.SYNTHETIC_DB.prepare(
      "UPDATE typed_records SET json_value = ?, updated_at = ? WHERE record_type = ? AND id = ?"
    ).bind(encoded, now, recordType, id).run();
    if (!result.meta?.changes) return json({ error: "not_found" }, 404);
    const row = await env.SYNTHETIC_DB.prepare("SELECT created_at FROM typed_records WHERE record_type = ? AND id = ?").bind(recordType, id).first();
    return json({ type: recordType, id, data: value, createdAt: row?.created_at || now, updatedAt: now });
  }
  if (request.method === "DELETE") {
    const result = await env.SYNTHETIC_DB.prepare("DELETE FROM typed_records WHERE record_type = ? AND id = ?").bind(recordType, id).run();
    return result.meta?.changes ? json({ deleted: true, type: recordType, id }) : json({ error: "not_found" }, 404);
  }
  return json({ error: "method_not_allowed" }, 405);
}

export async function handleStagingTestRoute(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/api/staging/health" && request.method === "GET") {
    try {
      await env.SYNTHETIC_DB.prepare("SELECT 1 AS ok").first();
      return json({ ok: true, service: "1toolz-app-native-staging", environment: "staging", d1: true, r2: Boolean(env.SYNTHETIC_MEDIA), externalWrites: false });
    } catch {
      return json({ ok: false, service: "1toolz-app-native-staging", environment: "staging", d1: false, r2: Boolean(env.SYNTHETIC_MEDIA), externalWrites: false }, 503);
    }
  }
  if (!url.pathname.startsWith("/api/staging/media") && !url.pathname.startsWith("/api/staging/typed")) return null;
  if (!authorized(request, env)) return json({ error: "unauthorized" }, 401);
  try {
    if (url.pathname.startsWith("/api/staging/media")) return await media(request, env, url);
    return await typed(request, env, url);
  } catch {
    return json({ error: "staging_test_operation_failed" }, 500);
  }
}
