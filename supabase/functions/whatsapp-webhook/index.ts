import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERIFY_TOKEN = Deno.env.get("META_VERIFY_TOKEN") || "abdomedi_whatsapp_meta_token";
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type AnyRecord = Record<string, any>;

const json = (body: AnyRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function phoneCore(value: unknown): string {
  const digits = normalizePhone(value);
  if (digits.startsWith("20")) return digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function extractMessage(payload: AnyRecord) {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0] || payload.data || payload.messages?.[0];
  if (!msg) return { statusOnly: Boolean(value?.statuses?.length) };

  const phone = msg.from || msg.phone || msg.sender || "";
  const contactName = value?.contacts?.[0]?.profile?.name || msg.name || msg.profile?.name || msg.senderName || "";
  let text = "";

  if (msg.type === "interactive") {
    const reply = msg.interactive?.button_reply || msg.interactive?.list_reply;
    text = [reply?.title, reply?.id].filter(Boolean).join(" ");
  } else if (msg.type === "button") {
    text = [msg.button?.text, msg.button?.payload].filter(Boolean).join(" ");
  } else if (msg.type === "text") {
    text = msg.text?.body || "";
  } else {
    text = [
      msg.body,
      msg.payload,
      msg.selectedButtonId,
      msg.button_reply?.title,
      msg.button_reply?.text,
      msg.button_reply?.id,
      msg.template_button_reply?.title,
      msg.template_button_reply?.text,
      msg.template_button_reply?.id,
      msg.text?.body,
      msg.text,
    ].filter(Boolean).join(" ");
  }

  return {
    statusOnly: false,
    phone: String(phone),
    contactName: String(contactName),
    text: String(text).trim(),
    messageId: msg.id || `wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    referral: msg.referral || value?.messages?.[0]?.referral || null,
  };
}

function actionFor(text: string) {
  const value = text.toLowerCase().trim();
  const cancel = ["إلغاء", "الغاء", "cancel", "btn_3", "btn_cancel", "❌", "مش عاوز", "مش عايز", "رفض"];
  const confirm = ["تأكيد", "تاكيد", "confirm", "btn_1", "btn_confirm", "✅", "موافق", "تمام", "جاهز", "اشحن", "ابعت", "نعم"];
  if (cancel.some((item) => value.includes(item)) || value === "2" || value === "3") return "cancel";
  if (confirm.some((item) => value.includes(item)) || value === "1") return "confirm";
  return "message";
}

function appendUnique<T>(items: T[], item: T) {
  return [...items, item];
}

async function sendReply(config: AnyRecord, to: string, message: string) {
  const phoneNumberId = config?.phoneNumberId || config?.instanceId;
  const accessToken = config?.accessToken || config?.token;
  if (config?.providerType !== "meta_cloud" || !phoneNumberId || !accessToken) {
    return { sent: false, reason: "Meta Cloud credentials are not configured" };
  }

  const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizePhone(to),
      type: "text",
      text: { preview_url: false, body: message },
    }),
  });
  const data = await response.json().catch(() => ({}));
  return { sent: response.ok && Boolean(data?.messages?.length), id: data?.messages?.[0]?.id || null, error: data?.error || null };
}

async function handleMessage(payload: AnyRecord) {
  const extracted = extractMessage(payload);
  if (extracted.statusOnly || !extracted.phone || !extracted.text) return { processed: false, reason: "not an incoming message" };

  const incoming = {
    id: extracted.messageId,
    timestamp: new Date().toISOString(),
    type: actionFor(extracted.text) === "confirm" ? "confirmation" : actionFor(extracted.text) === "cancel" ? "cancellation" : "incoming",
    direction: "incoming",
    message: extracted.text,
    sender: extracted.contactName || extracted.phone,
    recipient: "المتجر",
    status: "received",
    actionTaken: "",
  };

  const { data: stores, error: storesError } = await supabase
    .from("stores_data")
    .select("id, settings")
    .limit(50);
  if (storesError) throw storesError;

  const activeStores = (stores || []).filter((store: AnyRecord) => store.settings?.whatsappConfig?.isActive);
  const storeIds = activeStores.map((store: AnyRecord) => store.id);
  if (!storeIds.length) return { processed: false, reason: "no active WhatsApp store" };

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .in("store_id", storeIds)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (ordersError) throw ordersError;

  const core = phoneCore(extracted.phone);
  const matching = (orders || []).filter((order: AnyRecord) => {
    const customer = phoneCore(order.customer_phone || order.customerPhone);
    return customer && core && (customer === core || customer.endsWith(core) || core.endsWith(customer));
  });
  const order = matching[0];

  if (!order) {
    return { processed: false, reason: "no matching order", phone: extracted.phone };
  }

  const action = actionFor(extracted.text);
  let status = order.status || "جديد";
  let reply = "";
  let actionName = "رسالة واردة من العميل";
  if (action === "confirm") {
    status = "قيد_التنفيذ";
    actionName = "تأكيد الطلب عبر واتساب";
    reply = `أهلاً بك! تم تأكيد طلبك رقم #${order.order_number || order.orderNumber || order.id} بنجاح ✅ جارٍ تجهيز الشحنة.`;
  } else if (action === "cancel") {
    status = "ملغي";
    actionName = "إلغاء الطلب عبر واتساب";
    reply = `تم إلغاء طلبك رقم #${order.order_number || order.orderNumber || order.id} بنجاح ❌`;
  }
  incoming.actionTaken = actionName;

  const existingLogs = Array.isArray(order.whatsapp_logs) && order.whatsapp_logs.length
    ? order.whatsapp_logs
    : (Array.isArray(order.whatsappLogs) ? order.whatsappLogs : []);
  const existingConfirmations = Array.isArray(order.confirmationLogs) ? order.confirmationLogs : [];
  const now = new Date().toISOString();
  const audit = Array.isArray(order.audit_logs) && order.audit_logs.length
    ? order.audit_logs
    : (Array.isArray(order.auditLogs) ? order.auditLogs : []);
  const auditEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now,
    action: actionName,
    details: `العميل أرسل عبر واتساب: "${extracted.text}"` + (action === "message" ? "" : ` وتم تغيير الحالة إلى ${status}`),
    userEmail: "WhatsApp Webhook",
  };

  const update: AnyRecord = {
    status,
    whatsapp_status: "received",
    whatsappStatus: "received",
    whatsapp_logs: appendUnique(existingLogs, incoming),
    whatsappLogs: appendUnique(existingLogs, incoming),
    audit_logs: appendUnique(audit, auditEntry),
    auditLogs: appendUnique(audit, auditEntry),
    updated_at: now,
    updatedAt: now,
  };
  if (action !== "message") {
    update.confirmationLogs = appendUnique(existingConfirmations, {
      id: `confirmation_${Date.now()}`,
      timestamp: now,
      action: action === "confirm" ? "confirmed" : "cancelled",
      source: "whatsapp",
      messageId: extracted.messageId,
      text: extracted.text,
    });
  }

  const { error: updateError } = await supabase.from("orders").update(update).eq("id", order.id);
  if (updateError) throw updateError;

  let replyResult: AnyRecord = { sent: false };
  if (reply) {
    const store = activeStores.find((item: AnyRecord) => item.id === order.store_id) || activeStores[0];
    replyResult = await sendReply(store?.settings?.whatsappConfig || {}, extracted.phone, reply);
    if (replyResult.sent) {
      const outgoing = {
        id: replyResult.id || `wa_out_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: action === "confirm" ? "confirmation" : "cancellation",
        direction: "outgoing",
        message: reply,
        sender: "المتجر (رد تلقائي)",
        recipient: extracted.phone,
        status: "sent",
      };
      const logsAfterReply = [...update.whatsapp_logs, outgoing];
      await supabase.from("orders").update({ whatsapp_logs: logsAfterReply, whatsappLogs: logsAfterReply, whatsapp_status: "sent", whatsappStatus: "sent", updated_at: new Date().toISOString(), updatedAt: new Date().toISOString() }).eq("id", order.id);
    }
  }

  return { processed: true, orderId: order.id, orderNumber: order.order_number || order.orderNumber, status, action, replySent: replyResult.sent };
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
    return json({ ok: true, service: "supabase-whatsapp-webhook" });
  }
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const payload = await request.json();
    const result = await handleMessage(payload);
    return json({ ok: true, ...result });
  } catch (error) {
    console.error("[SUPABASE-WHATSAPP-WEBHOOK]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "webhook_failed" }, 500);
  }
});
