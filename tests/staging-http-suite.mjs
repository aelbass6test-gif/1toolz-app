import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";

const base = (process.env.STAGING_BASE_URL || "").replace(/\/$/, "");
const token = process.env.STAGING_API_TOKEN || "";
if (!base || !token) throw new Error("Set STAGING_BASE_URL and STAGING_API_TOKEN; no production fallback is allowed.");
const target = new URL(base);
const remoteStaging = target.protocol === "https:" && target.hostname === "1toolz-app-native-staging.app1toolz.workers.dev";
const explicitlyLocal = process.env.STAGING_ALLOW_LOCAL === "1" && target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname);
if (!remoteStaging && !explicitlyLocal) throw new Error("Refusing to run: target must be isolated Staging or explicitly enabled localhost.");

let checks = 0;
async function call(path, { method = "GET", body, headers = {} } = {}) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("authorization", `Bearer ${token}`);
  const response = await fetch(`${base}${path}`, { method, headers: requestHeaders, body, cache: "no-store" });
  checks++;
  return response;
}
async function json(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { throw new Error(`Expected JSON response (HTTP ${response.status}).`); }
}

const healthResponse = await fetch(`${base}/api/staging/health`, { cache: "no-store" });
assert.equal(healthResponse.status, 200, "staging health endpoint");
const health = await json(healthResponse);
assert.equal(health.service, "1toolz-app-native-staging");
assert.equal(health.environment, "staging");
assert.equal(health.d1, true);
assert.equal(health.r2, true);
assert.equal(health.externalWrites, false);
checks++;

const recordType = "synthetic_record";
const recordId = `case-${randomUUID()}`;
const initial = { title: "synthetic-create", quantity: 1, testRun: randomUUID() };
const createResponse = await call(`/api/staging/typed/${recordType}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: recordId, data: initial }),
});
assert.equal(createResponse.status, 201, "typed create");
assert.deepEqual((await json(createResponse)).data, initial);

// Independent HTTP request without cookies/session state verifies durable D1 read-back.
const readResponse = await call(`/api/staging/typed/${recordType}/${recordId}`, { headers: { "x-test-session": "independent-reader" } });
assert.equal(readResponse.status, 200, "second-session typed read-back");
assert.deepEqual((await json(readResponse)).data, initial);

const updated = { title: "synthetic-updated", quantity: 2, testRun: initial.testRun };
const updateResponse = await call(`/api/staging/typed/${recordType}/${recordId}`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ data: updated }),
});
assert.equal(updateResponse.status, 200, "typed update");
assert.deepEqual((await json(updateResponse)).data, updated);

const listResponse = await call(`/api/staging/typed/${recordType}`);
assert.equal(listResponse.status, 200, "typed list");
assert.ok((await json(listResponse)).records.some(record => record.id === recordId));

const deleteResponse = await call(`/api/staging/typed/${recordType}/${recordId}`, { method: "DELETE" });
assert.equal(deleteResponse.status, 200, "typed delete");
const missingRecord = await call(`/api/staging/typed/${recordType}/${recordId}`);
assert.equal(missingRecord.status, 404, "typed record absent after delete");

const unauthorizedResponse = await fetch(`${base}/api/staging/typed/${recordType}/${recordId}`, { cache: "no-store" });
assert.equal(unauthorizedResponse.status, 401, "unauthorized requests are rejected");
checks++;

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S5kAAAAASUVORK5CYII=", "base64");
const metadata = { productId: `test-${randomUUID()}`, storeId: "synthetic", source: "http-suite", label: "fixture-only" };
const form = new FormData();
form.set("file", new Blob([png], { type: "image/png" }), "synthetic.png");
form.set("metadata", JSON.stringify(metadata));
const uploadResponse = await call("/api/staging/media", { method: "POST", body: form });
assert.equal(uploadResponse.status, 201, "media upload with metadata");
const uploaded = await json(uploadResponse);
assert.ok(uploaded.id);
assert.equal(uploaded.contentType, "image/png");
assert.deepEqual(uploaded.metadata, metadata);

// Independent requests verify D1 metadata and the R2 object bytes.
const metadataReadResponse = await call(`/api/staging/media/${uploaded.id}`, { headers: { "x-test-session": "independent-reader" } });
assert.equal(metadataReadResponse.status, 200, "second-session media metadata read-back");
const metadataRead = await json(metadataReadResponse);
assert.deepEqual(metadataRead.metadata, metadata);
assert.equal(metadataRead.size, png.length);

const contentResponse = await call(`/api/staging/media/${uploaded.id}/content`, { headers: { "x-test-session": "independent-reader" } });
assert.equal(contentResponse.status, 200, "R2 media object read-back");
assert.equal(contentResponse.headers.get("content-type"), "image/png");
const content = Buffer.from(await contentResponse.arrayBuffer());
assert.equal(createHash("sha256").update(content).digest("hex"), createHash("sha256").update(png).digest("hex"));

const mediaDelete = await call(`/api/staging/media/${uploaded.id}`, { method: "DELETE" });
assert.equal(mediaDelete.status, 200, "staging media cleanup");
const mediaAbsent = await call(`/api/staging/media/${uploaded.id}`);
assert.equal(mediaAbsent.status, 404, "D1 media metadata absent after cleanup");
const objectAbsent = await call(`/api/staging/media/${uploaded.id}/content`);
assert.equal(objectAbsent.status, 404, "R2 media object absent after cleanup");

console.log(JSON.stringify({
  ok: true,
  service: health.service,
  environment: health.environment,
  checks,
  assertions: ["health", "D1 typed create/read/update/list/delete", "second-request read-back", "media upload", "D1 metadata persistence", "R2 object read-back/hash", "media cleanup", "unauthorized access denied"],
  externalWrites: false,
}));
