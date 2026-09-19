export interface Env {
  ASSETS?: any;
  APP_ORIGIN?: string;
  APP_BACKEND_URL?: string;
  META_VERIFY_TOKEN?: string;
  BOSTA_API_KEY?: string;
  BOSTA_PRODUCTION_BASE_URL?: string;
  BOSTA_STAGING_BASE_URL?: string;
  TURBO_API_KEY?: string;
  TURBO_BASE_URL?: string;
  TURBO_STAGING_BASE_URL?: string;
  TURBO_MAIN_CLIENT_CODE?: string;
  FIREBASE_API_KEY?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_DATABASE_ID?: string;
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

async function getFirestoreToken(env: Env) {
  if (!env.FIREBASE_API_KEY) return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true })
    });
    const data: any = await res.json();
    return data.idToken;
  } catch (e) {
    console.error("Firestore Auth Error:", e);
    return null;
  }
}

async function writeToFirestore(payload: any, env: Env) {
  // Always log raw payload first for debugging
  await logWebhook(payload, env);

  const token = await getFirestoreToken(env);
  if (!token || !env.FIREBASE_PROJECT_ID) return false;

  const dbId = env.FIREBASE_DATABASE_ID || "(default)";
  
  // Extract info from WhatsApp payload
  let phone = "";
  let text = "";
  let isStatusUpdate = false;
  let referral: any = null;
  let contactName = "";
  
  try {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    
    if (value?.statuses) {
      isStatusUpdate = true;
    }

    const contact = value?.contacts?.[0];
    if (contact) {
      contactName = contact.profile?.name || "";
    }

    const message = value?.messages?.[0];
    if (message) {
      phone = message.from;
      referral = message.referral || null;
      
      if (message.type === 'text') {
        text = message.text?.body || "";
      } else if (message.type === 'interactive') {
        if (message.interactive?.button_reply) {
          text = `${message.interactive.button_reply.title || ""} ${message.interactive.button_reply.id || ""}`.trim();
        } else if (message.interactive?.list_reply) {
          text = `${message.interactive.list_reply.title || ""} ${message.interactive.list_reply.id || ""}`.trim();
        } else if (message.interactive?.nfm_reply) {
          text = `${message.interactive.nfm_reply.response_json || ""}`.trim();
        }
      } else if (message.type === 'button') {
        text = `${message.button?.text || ""} ${message.button?.payload || ""}`.trim();
      } else if (message.type === 'button_reply' || message.button_reply) {
        text = `${message.button_reply?.title || message.button_reply?.text || ""} ${message.button_reply?.id || message.button_reply?.payload || ""}`.trim();
      } else if (message.type === 'template_button_reply' || message.template_button_reply) {
        text = `${message.template_button_reply?.title || message.template_button_reply?.text || ""} ${message.template_button_reply?.id || message.template_button_reply?.payload || ""}`.trim();
      } else if (message.type === 'reaction') {
        text = message.reaction?.emoji || "";
      } else if (message.type === 'location') {
        text = `${message.location?.name || ""} ${message.location?.address || ""} (${message.location?.latitude || ""}, ${message.location?.longitude || ""})`.trim();
      } else if (message.type === 'contacts') {
        text = message.contacts?.[0]?.name?.formatted_name || message.contacts?.[0]?.phones?.[0]?.phone || "[جهة اتصال]";
      } else if (message.type === 'order') {
        text = `[طلب منتجات: ${message.order?.product_items?.length || 0}]`;
      } else if (message.type === 'system') {
        text = message.system?.body || "";
      } else if (message.type === 'image') {
        text = message.image?.caption || "[صورة]";
      } else if (message.type === 'video') {
        text = message.video?.caption || "[فيديو]";
      } else if (message.type === 'audio' || message.type === 'voice') {
        text = "[رسالة صوتية]";
      } else if (message.type === 'document') {
        text = message.document?.filename || "[ملف]";
      } else if (message.type === 'sticker') {
        text = "[ملصق]";
      } else {
        text = message.text?.body || message.body || message.button?.text || message.button_reply?.title || `[${message.type}]`;
      }
    }
  } catch (e) {}

  // Don't create leads for status updates or empty messages
  if (isStatusUpdate || !phone || !text) return false;

  const normalizedText = text.toLowerCase();
  const isCancel = normalizedText.includes("إلغاء") || 
                   normalizedText.includes("الغاء") || 
                   normalizedText.includes("الغي") || 
                   normalizedText.includes("إلغى") || 
                   normalizedText.includes("cancel") || 
                   normalizedText.includes("btn_3") || 
                   normalizedText.includes("btn_cancel") || 
                   normalizedText.includes("btn_3️⃣") || 
                   normalizedText.includes("❌") || 
                   normalizedText === "2" || 
                   normalizedText === "3" || 
                   normalizedText === "3️⃣" || 
                   normalizedText.includes("مش عاوز") || 
                   normalizedText.includes("مش عايز") || 
                   normalizedText.includes("مش هقدر") || 
                   normalizedText.includes("كنسل") || 
                   normalizedText.includes("رفض") || 
                   normalizedText.includes("لا اريد") || 
                   normalizedText.includes("غير موافق") || 
                   normalizedText.includes("مش محتاجه");

  const isConfirm = normalizedText.includes("تأكيد") || 
                    normalizedText.includes("تاكيد") || 
                    normalizedText.includes("اكيد") || 
                    normalizedText.includes("أكيد") || 
                    normalizedText.includes("confirm") || 
                    normalizedText.includes("btn_1") || 
                    normalizedText.includes("btn_confirm") || 
                    normalizedText.includes("👍") || 
                    normalizedText.includes("✅") || 
                    normalizedText === "1" || 
                    normalizedText === "1️⃣" || 
                    normalizedText.includes("موافق") || 
                    normalizedText.includes("تمام") || 
                    normalizedText.includes("جاهز") || 
                    normalizedText.includes("اشحن") || 
                    normalizedText.includes("ابعت") || 
                    normalizedText.includes("ايوة") || 
                    normalizedText.includes("إيوة") || 
                    normalizedText.includes("نعم") || 
                    normalizedText.includes("متاكد") || 
                    normalizedText.includes("متأكد");

  try {
    // 1. Search for existing order by phone number
    const queryUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${dbId}/documents:runQuery`;
    
    const cleanPhone = phone.replace(/\D/g, "");
    const basePhone = cleanPhone.startsWith("20") ? cleanPhone.substring(2) : (cleanPhone.startsWith("0") ? cleanPhone.substring(1) : cleanPhone);
    const phoneCandidates = [phone, cleanPhone, basePhone, "0" + basePhone, "20" + basePhone];

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: "orders" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "customerPhone" },
            op: "IN",
            value: {
              arrayValue: {
                values: phoneCandidates.map(p => ({ stringValue: p }))
              }
            }
          }
        },
        orderBy: [{ field: { fieldPath: "createdAt" }, direction: "DESC" }],
        limit: 1
      }
    };

    const queryRes = await fetch(queryUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(queryBody)
    });

    const queryResults: any = await queryRes.json();
    const existingDoc = Array.isArray(queryResults) && queryResults[0]?.document ? queryResults[0].document : null;

    if (existingDoc) {
      // 2. Update existing order
      const docPath = existingDoc.name; 
      const fields = existingDoc.fields || {};
      
      const existingLogs = fields.whatsappLogs?.arrayValue?.values || [];
      const newLog = {
        mapValue: {
          fields: {
            id: { stringValue: "wa_" + Math.random().toString(36).substr(2, 9) },
            timestamp: { stringValue: new Date().toISOString() },
            type: { stringValue: isCancel ? "cancellation" : (isConfirm ? "confirmation" : "incoming") },
            direction: { stringValue: "incoming" },
            message: { stringValue: text },
            sender: { stringValue: contactName || phone },
            status: { stringValue: "received" }
          }
        }
      };

      const updatedLogs = [...existingLogs, newLog];
      
      let updatedStatus = fields.status?.stringValue || "جديد";
      let updatedNotes = fields.notes?.stringValue || "";
      let existingAuditLogs = fields.auditLogs?.arrayValue?.values || [];

      let replyMessage = "";
      let actionName = "رسالة واردة";
      if (isCancel) {
        updatedStatus = "ملغي";
        actionName = "إلغاء الطلب عبر واتساب";
        updatedNotes += `\n[تنبيه إيدج] تم الإلغاء عبر الواتساب: ${text}`;
        replyMessage = "تم الإلغاء بنجاح ❌";
      } else if (isConfirm) {
        updatedStatus = "قيد_التنفيذ";
        actionName = "تأكيد الطلب عبر واتساب";
        updatedNotes += `\n[تنبيه إيدج] تم التأكيد عبر الواتساب: ${text}`;
        replyMessage = "تم التأكيد، شكراً لتعاملك معنا! ✅";
      } else {
        updatedNotes += `\n[تنبيه إيدج] رسالة جديدة: ${text}`;
      }

      const newAuditLog = {
        mapValue: {
          fields: {
            id: { stringValue: Math.random().toString(36).substr(2, 9) },
            timestamp: { stringValue: new Date().toISOString() },
            action: { stringValue: actionName },
            details: { stringValue: `العميل أرسل: "${text}"` },
            userEmail: { stringValue: "WhatsApp Edge Worker" }
          }
        }
      };
      const updatedAuditLogs = [...existingAuditLogs, newAuditLog];

      const patchUrl = `https://firestore.googleapis.com/v1/${docPath}?updateMask.fieldPaths=whatsappLogs&updateMask.fieldPaths=status&updateMask.fieldPaths=notes&updateMask.fieldPaths=updatedAt&updateMask.fieldPaths=auditLogs`;
      
      const patchDoc = {
        fields: {
          whatsappLogs: { arrayValue: { values: updatedLogs } },
          status: { stringValue: updatedStatus },
          notes: { stringValue: updatedNotes },
          auditLogs: { arrayValue: { values: updatedAuditLogs } },
          updatedAt: { timestampValue: new Date().toISOString() }
        }
      };

      await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(patchDoc)
      });

      // Send auto-reply if needed
      if (replyMessage) {
        const storeId = fields.storeId?.stringValue || fields.store_id?.stringValue || await getFirstStoreId(token, env);
        await sendWhatsAppReply(phone, replyMessage, storeId, token, env);
      }

      return true;
    } else {
      // 3. Create new lead if no existing order found
      // We need a storeId. Let's try to find the first one.
      const storeId = await getFirstStoreId(token, env);
      
      const createUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${dbId}/documents/orders`;
      
      let notesText = `[تنبيه إيدج] عميل جديد أرسل: ${text}`;
      if (referral) {
        notesText += `\n\n📌 [بيانات الإعلان الممول]:` +
          `\n- معرف الإعلان (Ad ID): ${referral.source_id || "غير معروف"}` +
          `\n- عنوان الإعلان (Headline): ${referral.headline || "لا يوجد"}` +
          `\n- وصف الإعلان (Body): ${referral.body || "لا يوجد"}` +
          `\n- رابط المصدر (URL): ${referral.source_url || "لا يوجد"}`;
      }

      const newDoc = {
        fields: {
          storeId: { stringValue: storeId },
          store_id: { stringValue: storeId },
          customerPhone: { stringValue: phone },
          customer_phone: { stringValue: phone },
          customerName: { stringValue: contactName || "عميل واتساب (جديد)" },
          customer_name: { stringValue: contactName || "عميل واتساب (جديد)" },
          totalPrice: { integerValue: "0" },
          status: { stringValue: "جديد" },
          notes: { stringValue: notesText },
          createdAt: { timestampValue: new Date().toISOString() },
          updatedAt: { timestampValue: new Date().toISOString() },
          items: { arrayValue: { values: [] } },
          source: { stringValue: referral ? "meta_ad" : "whatsapp_edge_lead" },
          auditLogs: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      id: { stringValue: Math.random().toString(36).substr(2, 9) },
                      timestamp: { stringValue: new Date().toISOString() },
                      action: { stringValue: "إنشاء عميل محتمل جديد" },
                      details: { stringValue: `رسالة الواتساب: "${text}"` },
                      userEmail: { stringValue: "WhatsApp Edge Worker" }
                    }
                  }
                }
              ]
            }
          },
          whatsappLogs: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      id: { stringValue: "wa_" + Math.random().toString(36).substr(2, 9) },
                      timestamp: { stringValue: new Date().toISOString() },
                      type: { stringValue: "incoming" },
                      direction: { stringValue: "incoming" },
                      message: { stringValue: text },
                      sender: { stringValue: contactName || phone },
                      status: { stringValue: "received" }
                    }
                  }
                }
              ]
            }
          }
        }
      };

      if (referral) {
        (newDoc.fields as any).referral = {
          mapValue: {
            fields: {
              source_id: { stringValue: referral.source_id || "" },
              source_type: { stringValue: referral.source_type || "" },
              source_url: { stringValue: referral.source_url || "" },
              headline: { stringValue: referral.headline || "" },
              body: { stringValue: referral.body || "" }
            }
          }
        };
      }

      const res = await fetch(createUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newDoc)
      });
      return res.ok;
    }
  } catch (e) {
    console.error("Firestore Write Error:", e);
    return false;
  }
}

async function getFirstStoreId(token: string, env: Env) {
  const dbId = env.FIREBASE_DATABASE_ID || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${dbId}/documents/stores_data?pageSize=1`;
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data: any = await res.json();
    if (data.documents && data.documents.length > 0) {
      const name = data.documents[0].name;
      return name.split('/').pop() || "default";
    }
  } catch (e) {}
  return "default";
}

async function sendWhatsAppReply(phone: string, message: string, storeId: string, token: string, env: Env) {
  const dbId = env.FIREBASE_DATABASE_ID || "(default)";
  const storeUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${dbId}/documents/stores_data/${storeId}`;
  
  try {
    const storeRes = await fetch(storeUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storeData: any = await storeRes.json();
    const config = storeData.fields?.settings?.mapValue?.fields?.whatsappConfig?.mapValue?.fields;
    
    if (!config || config.isActive?.booleanValue === false) return;

    let cleanTo = phone.replace(/\D/g, "");
    if (cleanTo.startsWith("0") && cleanTo.length === 11) {
      cleanTo = "2" + cleanTo;
    }

    const providerType = config.providerType?.stringValue || "meta_cloud";

    if (providerType === "meta_cloud") {
      const phoneNumberId = config.phoneNumberId?.stringValue || config.instanceId?.stringValue;
      const accessToken = config.accessToken?.stringValue || config.token?.stringValue;

      if (phoneNumberId && accessToken) {
        await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanTo,
            type: "text",
            text: { body: message }
          })
        });
      }
    } else if (providerType === "ultramsg") {
      const instanceId = config.instanceId?.stringValue;
      const tokenMsg = config.token?.stringValue;
      let apiUrl = config.apiUrl?.stringValue || "";
      
      if (instanceId && tokenMsg) {
        if (!apiUrl) apiUrl = `https://api.ultramsg.com/${instanceId}/messages/chat`;
        if (apiUrl.includes("api.ultramsg.com") && !apiUrl.includes("/messages/chat")) {
          apiUrl = apiUrl.split('/messages/')[0] + '/messages/chat';
        }

        await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: tokenMsg,
            to: cleanTo,
            body: message,
            priority: 10
          })
        });
      }
    }
  } catch (e) {
    console.error("Error sending WhatsApp reply from worker:", e);
  }
}

async function logWebhook(payload: any, env: Env) {
  const token = await getFirestoreToken(env);
  if (!token || !env.FIREBASE_PROJECT_ID) return;

  const dbId = env.FIREBASE_DATABASE_ID || "(default)";
  const url = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/${dbId}/documents/webhook_logs`;

  const doc = {
    fields: {
      timestamp: { timestampValue: new Date().toISOString() },
      payload: { stringValue: JSON.stringify(payload) },
      source: { stringValue: "whatsapp_edge" }
    }
  };

  await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(doc)
  }).catch(() => {});
}

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
  // Match general Cloud Run domains for this deployment
  if (origin.includes("run.app") && origin.includes("ais-")) return true;
  // Support custom domains linked by store owners (any valid https origin if requested)
  if (origin.startsWith("http://") || origin.startsWith("https://")) return true;
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

function bostaHeaders(key: string, content = false): Record<string, string> {
  return { ...(content ? { "content-type": "application/json" } : {}), accept: "application/json", ...(key ? { Authorization: key, "x-api-key": key } : {}) };
}

function turboHeaders() { return { "content-type": "application/json", accept: "application/json" }; }

/* -------------------------------------------------------------------------- */
/* WhatsApp / Meta Cloud API Webhook Edge Handler                              */
/* -------------------------------------------------------------------------- */
async function handleWhatsAppWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);

  // Meta Webhook Verification (GET hub.mode=subscribe & hub.challenge)
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const expectedTokens = [
      env.META_VERIFY_TOKEN,
      "abdomedi_whatsapp_meta_token",
      "meta_verify_token_flexship_2026",
      "flexship_meta_token"
    ].filter(Boolean);

    if (mode === "subscribe" && token && expectedTokens.includes(token)) {
      console.log(`[Edge Webhook] Verified Meta challenge successfully: ${challenge}`);
      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    return new Response("Forbidden: Verification Token Mismatch", { status: 403 });
  }

  // Meta Webhook Event Notification (POST)
  if (request.method === "POST") {
    const rawBody = await request.text();
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    console.log(`[Edge Webhook] Processing WhatsApp notification for: ${payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from}`);

    // Robust Strategy: 
    // 1. Write directly to Firestore via REST API (bypasses Google Frontend cookie wall entirely)
    // 2. ALSO attempt to forward to backend asynchronously
    const firestorePromise = writeToFirestore(payload, env);

    // Forward to app backend asynchronously if configured
    // We favor APP_BACKEND_URL if present as it typically points to the actual running instance
    const directBackendUrl = env.APP_BACKEND_URL || env.APP_ORIGIN || "https://app.abdomedi.com";
    if (directBackendUrl) {
      const targetEndpoint = `${directBackendUrl.replace(/\/$/, "")}/wa-webhook-direct`;
      
      console.log(`[Edge Webhook] Forwarding to backend: ${targetEndpoint}`);
      
      // We use a non-blocking fetch for the backend forward to ensure Meta gets a fast 200 OK
      ctx.waitUntil(
        fetch(targetEndpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-hub-signature-256": request.headers.get("x-hub-signature-256") || "",
            "x-whatsapp-source": "cloudflare-edge"
          },
          body: rawBody
        }).then(async res => {
          console.log(`[Edge Webhook] Backend forward status: ${res.status}`);
          if (res.status === 302 || res.status === 403) {
             console.warn(`[Edge Webhook] Backend returned ${res.status} (Likely Cookie Wall or Forbidden).`);
          }
        }).catch(err => {
          console.error(`[Edge Webhook] Backend forward failed: ${err.message}`);
        })
      );
    }

    // Wait for Firestore write to at least start/finish if it's our primary channel
    await firestorePromise;

    // Immediately respond 200 OK to Meta edge (< 50ms) to prevent timeout retries
    return json(request, env, {
      received: true,
      status: "processed_at_edge_and_firestore",
      timestamp: new Date().toISOString()
    }, 200);
  }

  return json(request, env, { error: "Method not allowed" }, 405);
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

    // Health and status endpoint (Only for /api/health or /health)
    if (url.pathname === "/api/health" || url.pathname === "/health") {
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
      // Meta WhatsApp Webhook Route
      if (url.pathname === "/api/webhook/whatsapp" || url.pathname === "/webhook/whatsapp" || url.pathname === "/api/webhooks/whatsapp" || url.pathname === "/wa-webhook-direct") {
        return await handleWhatsAppWebhook(request, env, ctx);
      }

      // Bosta Carrier Routes
      if (url.pathname.startsWith("/api/bosta/")) {
        return await bosta(request, env);
      }

      // Turbo Carrier Routes
      if (url.pathname.startsWith("/api/turbo/") || url.pathname === "/api/shipping/turbo/track") {
        return await turbo(request, env);
      }

      // For unmatched /api/ routes, return JSON 404
      if (url.pathname.startsWith("/api/")) {
        return json(request, env, { success: false, error: "المسار غير موجود" }, 404);
      }

      // Pass non-API requests (frontend UI, assets, page routes) to env.ASSETS or origin
      if (env.ASSETS) {
        try {
          const assetRes = await env.ASSETS.fetch(request);
          if (assetRes.status !== 404) {
            return assetRes;
          }
          // For SPA client-side routing, fallback to /index.html
          const indexReq = new Request(new URL("/index.html", request.url).toString(), request);
          const indexRes = await env.ASSETS.fetch(indexReq);
          if (indexRes.status === 200) {
            return indexRes;
          }
        } catch (e) {
          console.error("ASSETS fetch error:", e);
        }
      }

      if (env.APP_BACKEND_URL && !env.APP_BACKEND_URL.includes(url.hostname)) {
        try {
          const backendUrl = new URL(url.pathname + url.search, env.APP_BACKEND_URL);
          const newHeaders = new Headers(request.headers);
          newHeaders.set("Host", backendUrl.hostname);
          const proxyReq = new Request(backendUrl.toString(), {
            method: request.method,
            headers: newHeaders,
            body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined,
            redirect: "follow"
          });
          return await fetch(proxyReq);
        } catch (e) {}
      }
      return await fetch(request);
    } catch (error: any) { 
      if (!url.pathname.startsWith("/api/")) {
        return await fetch(request);
      }
      return json(request, env, { success: false, error: error?.message || "خطأ داخلي في Worker" }, 500); 
    }
  } 
};

