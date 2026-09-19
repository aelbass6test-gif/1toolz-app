// cloudflare-worker/src/index.ts
var jsonHeaders = { "content-type": "application/json; charset=utf-8" };
var SUPABASE_WHATSAPP_WEBHOOK_URL = "https://kwirhppfowzqshltmoga.supabase.co/functions/v1/whatsapp-webhook";
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
  if (origin.startsWith("http://") || origin.startsWith("https://")) return true;
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
      if (url.pathname === "/api/webhook/whatsapp" || url.pathname === "/api/webhooks/whatsapp" || url.pathname === "/webhook/whatsapp" || url.pathname === "/wa-webhook-direct") {
        return await handleWhatsAppWebhook(request, env, ctx);
      }
      if (url.pathname.startsWith("/api/bosta/")) {
        return await bosta(request, env);
      }
      if (url.pathname.startsWith("/api/turbo/") || url.pathname === "/api/shipping/turbo/track") {
        return await turbo(request, env);
      }
      return await proxyBackendRequest(request, env);
    } catch (error) {
      return json(request, env, { success: false, error: error?.message || "\u062E\u0637\u0623 \u062F\u0627\u062E\u0644\u064A \u0641\u064A Worker" }, 500);
    }
  }
};
export {
  index_default as default
};
