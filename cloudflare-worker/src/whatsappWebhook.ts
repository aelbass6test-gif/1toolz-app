import type { D1LikeDatabase, JsonResponder } from "./d1Types";
import { ensureMissingAppTables } from "./dbApi";

function safeParseJson<T>(raw: any, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== "string") return raw as T;
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function handleNativeWhatsAppWebhook(
  request: Request,
  env: any,
  db: D1LikeDatabase | null,
  json: JsonResponder
): Promise<Response> {
  const url = new URL(request.url);

  // 1. Meta WhatsApp Verification Challenge (GET)
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expectedToken = env?.META_VERIFY_TOKEN || "abdomedi_whatsapp_meta_token";

    if (mode === "subscribe" && token === expectedToken && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
    return new Response("Forbidden", { status: 403 });
  }

  if (request.method !== "POST") {
    return json(request, env, { success: false, error: "Method not allowed" }, 405);
  }

  const rawBody = await request.text();
  const payload = safeParseJson<any>(rawBody, {});

  if (!db) {
    return json(request, env, { success: true, received: true, note: "DB binding unavailable" });
  }

  const now = new Date().toISOString();
  const storeIdHint = url.searchParams.get("storeId") || "main_store";

  // Persist webhook audit log immediately (auto-heal missing D1 tables if needed)
  const logId = `whlog_wa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const logPayload = JSON.stringify({
    id: logId,
    store_id: storeIdHint,
    source: "meta_whatsapp",
    event_type: payload?.object || "message",
    occurred_at: now,
    success: true,
    status_code: 200,
    payload
  });
  try {
    await db
      .prepare(
        `INSERT INTO webhook_logs (id, store_id, source, event_type, success, status_code, occurred_at, data_json)
         VALUES (?, ?, 'meta_whatsapp', ?, 1, 200, ?, ?)`
      )
      .bind(logId, storeIdHint, payload?.object || payload?.event_type || "whatsapp.webhook", now, logPayload)
      .run();
  } catch (err: any) {
    if (/no such table/i.test(String(err?.message || err))) {
      await ensureMissingAppTables(db).catch(() => {});
      await db
        .prepare(
          `INSERT INTO webhook_logs (id, store_id, source, event_type, success, status_code, occurred_at, data_json)
           VALUES (?, ?, 'meta_whatsapp', ?, 1, 200, ?, ?)`
        )
        .bind(logId, storeIdHint, payload?.object || payload?.event_type || "whatsapp.webhook", now, logPayload)
        .run()
        .catch(() => {});
    } else {
      console.warn("[CF-WA-WEBHOOK] Failed saving webhook log:", err);
    }
  }

  // Parse Meta Cloud API messages
  try {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const phoneNumberId = value?.metadata?.phone_number_id || "";
        const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
        const contactMap = new Map<string, string>();
        for (const c of contacts) {
          if (c?.wa_id) contactMap.set(String(c.wa_id), c?.profile?.name || "");
        }

        // Resolve storeId by whatsappConfig.phoneNumberId
        let targetStoreId = storeIdHint;
        if (phoneNumberId) {
          const stores = await db.prepare("SELECT id, settings_json FROM stores_data").all<any>();
          for (const st of stores.results || []) {
            const s = safeParseJson<any>(st.settings_json, {});
            if (s?.whatsappConfig?.phoneNumberId === phoneNumberId || s?.whatsappConfig?.instanceId === phoneNumberId) {
              targetStoreId = st.id;
              break;
            }
          }
        }

        const messages = Array.isArray(value?.messages) ? value.messages : [];
        for (const m of messages) {
          const senderPhone = String(m?.from || "");
          const textBody = m?.text?.body || m?.button?.text || m?.interactive?.button_reply?.title || m?.caption || `[${m?.type || "message"}]`;
          const customerName = contactMap.get(senderPhone) || senderPhone;
          const cleanLast9 = senderPhone.replace(/\D/g, "").slice(-9);

          // Find matching order by customer phone
          let matchedOrderId: string | null = null;
          if (cleanLast9.length >= 7) {
            const ordRow = await db
              .prepare("SELECT id FROM orders WHERE store_id = ? AND customer_phone LIKE ? ORDER BY date DESC LIMIT 1")
              .bind(targetStoreId, `%${cleanLast9}%`)
              .first<{ id: string }>();
            matchedOrderId = ordRow?.id || null;
          }

          // Upsert conversation
          let convRow = await db
            .prepare("SELECT id, data_json FROM whatsapp_conversations WHERE store_id = ? AND customer_phone LIKE ? LIMIT 1")
            .bind(targetStoreId, `%${cleanLast9 || senderPhone}%`)
            .first<{ id: string; data_json: string }>();

          const convId = convRow?.id || `waconv_${targetStoreId}_${senderPhone || Date.now()}`;
          const convData = {
            ...(convRow ? safeParseJson<any>(convRow.data_json, {}) : {}),
            id: convId,
            store_id: targetStoreId,
            order_id: matchedOrderId,
            customer_phone: senderPhone,
            customer_name: customerName,
            last_message_at: now,
            last_message_preview: textBody.slice(0, 200),
            status: "open",
            updated_at: now
          };

          await db
            .prepare(
              `INSERT INTO whatsapp_conversations (id, store_id, order_id, customer_phone, last_message_at, status, updated_at, data_json)
               VALUES (?, ?, ?, ?, ?, 'open', ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 order_id = COALESCE(excluded.order_id, whatsapp_conversations.order_id),
                 last_message_at = excluded.last_message_at,
                 updated_at = excluded.updated_at,
                 data_json = excluded.data_json`
            )
            .bind(convId, targetStoreId, matchedOrderId, senderPhone, now, now, JSON.stringify(convData))
            .run();

          // Insert inbound message
          const msgId = String(m?.id || `wamsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
          const msgPayload = {
            id: msgId,
            store_id: targetStoreId,
            conversation_id: convId,
            order_id: matchedOrderId,
            direction: "inbound",
            sender_phone: senderPhone,
            customer_name: customerName,
            body: textBody,
            type: m?.type || "text",
            occurred_at: now
          };

          await db
            .prepare(
              `INSERT OR IGNORE INTO whatsapp_messages (id, store_id, conversation_id, order_id, direction, body, occurred_at, data_json)
               VALUES (?, ?, ?, ?, 'inbound', ?, ?, ?)`
            )
            .bind(msgId, targetStoreId, convId, matchedOrderId, textBody, now, JSON.stringify(msgPayload))
            .run();
        }
      }
    }
  } catch (err) {
    console.warn("[CF-WA-WEBHOOK] Parse/insert error:", err);
  }

  return json(request, env, { success: true, processed: true, provider: "cloudflare-d1" });
}
