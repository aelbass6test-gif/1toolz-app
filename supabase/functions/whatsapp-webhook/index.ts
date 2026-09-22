import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
const verifyToken = Deno.env.get('META_VERIFY_TOKEN') || '';
const metaAppSecret = Deno.env.get('META_APP_SECRET') || Deno.env.get('WHATSAPP_APP_SECRET') || '';
type R = Record<string, any>;

const response = (body: R, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const core = (value: any) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('20')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};

const phoneVariants = (value: any) => {
  const normalized = core(value);
  if (!normalized) return [];
  return [...new Set([normalized, `0${normalized}`, `20${normalized}`, `+20${normalized}`])];
};

const action = (value: string) => {
  const text = value.toLowerCase();
  if (['إلغاء', 'الغاء', 'cancel', 'btn_3', '❌', 'رفض'].some((item) => text.includes(item)) || text === '2' || text === '3') return 'cancel';
  if (['تأكيد', 'تاكيد', 'confirm', 'btn_1', '✅', 'موافق', 'تمام', 'اشحن', 'نعم'].some((item) => text.includes(item)) || text === '1') return 'confirm';
  return 'message';
};

function extract(payload: R) {
  const value = payload.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0] || payload.data || payload.messages?.[0];
  if (!message) return { statusOnly: Boolean(value?.statuses?.length) };
  const phone = message.from || message.phone || message.sender || '';
  const name = value?.contacts?.[0]?.profile?.name || message.name || message.senderName || '';
  let text = '';
  if (message.type === 'interactive') {
    const reply = message.interactive?.button_reply || message.interactive?.list_reply;
    text = [reply?.title, reply?.id].filter(Boolean).join(' ');
  } else if (message.type === 'button') {
    text = [message.button?.text, message.button?.payload].filter(Boolean).join(' ');
  } else if (message.type === 'text') {
    text = message.text?.body || '';
  } else {
    text = [message.body, message.payload, message.selectedButtonId, message.button_reply?.title, message.button_reply?.text, message.button_reply?.id, message.text?.body, message.text].filter(Boolean).join(' ');
  }
  return {
    statusOnly: false,
    phone: String(phone),
    name: String(name),
    text: String(text).trim(),
    id: message.id || `wa_${Date.now()}`,
    kind: message.type === 'interactive' || message.type === 'button' ? 'interactive' : message.type || 'text',
  };
}

async function getConversation(order: R, phone: string, name: string) {
  const existing = await supabase.from('whatsapp_conversations').select('id').eq('store_id', order.store_id).eq('order_id', order.id).limit(1).maybeSingle();
  if (existing.data?.id) return existing.data.id;
  const created = await supabase.from('whatsapp_conversations').insert({
    store_id: order.store_id,
    order_id: order.id,
    customer_phone: phone,
    customer_name: name || order.customer_name || order.customerName || '',
  }).select('id').single();
  if (created.data?.id) return created.data.id;
  const retry = await supabase.from('whatsapp_conversations').select('id').eq('store_id', order.store_id).eq('order_id', order.id).limit(1).maybeSingle();
  if (retry.data?.id) return retry.data.id;
  throw created.error || new Error('conversation_create_failed');
}

async function addMessage(message: R) {
  if (message.provider_message_id) {
    const existing = await supabase.from('whatsapp_messages').select('id').eq('provider', message.provider).eq('provider_message_id', message.provider_message_id).limit(1).maybeSingle();
    if (existing.data?.id) return existing.data.id;
  }
  const inserted = await supabase.from('whatsapp_messages').insert(message).select('id').single();
  if (inserted.error?.code === '23505') return message.provider_message_id || null;
  if (inserted.error) throw inserted.error;
  return inserted.data?.id;
}

async function findOrder(storeIds: string[], phone: string) {
  const variants = phoneVariants(phone);
  const candidates: R[] = [];
  for (const storeId of storeIds) {
    for (const variant of variants) {
      const result = await supabase.from('orders').select('*').eq('store_id', storeId)
        .or(`customer_phone.eq.${variant},customerPhone.eq.${variant}`)
        .order('updated_at', { ascending: false }).limit(20);
      if (result.error) throw result.error;
      candidates.push(...(result.data || []));
    }
  }
  const unique = [...new Map(candidates.map((order) => [String(order.id), order])).values()];
  const closedStatuses = ['ملغي', 'مكتمل', 'تم التسليم', 'مرتجع', 'cancelled', 'completed', 'delivered', 'returned'];
  unique.sort((a, b) => {
    const aClosed = closedStatuses.includes(String(a.status || '').toLowerCase()) ? 1 : 0;
    const bClosed = closedStatuses.includes(String(b.status || '').toLowerCase()) ? 1 : 0;
    if (aClosed !== bClosed) return aClosed - bClosed;
    return new Date(b.updated_at || b.updatedAt || 0).getTime() - new Date(a.updated_at || a.updatedAt || 0).getTime();
  });
  return unique[0] || null;
}

async function sendReply(config: R, to: string, body: string) {
  const phoneNumberId = config?.phoneNumberId;
  const token = config?.accessToken;
  if (config?.providerType !== 'meta_cloud' || !phoneNumberId || !token) return { sent: false, id: null };
  const result = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: String(to).replace(/\D/g, ''),
      type: 'text',
      text: { preview_url: false, body },
    }),
  });
  const data = await result.json().catch(() => ({}));
  return { sent: result.ok && Boolean(data?.messages?.length), id: data?.messages?.[0]?.id || null };
}

async function handle(payload: R) {
  const message = extract(payload);
  if (message.statusOnly || !message.phone || !message.text) return { processed: false, reason: 'not_an_incoming_message' };
  const storesResult = await supabase.from('stores_data').select('id,settings').limit(1000);
  if (storesResult.error) throw storesResult.error;
  const stores = (storesResult.data || []).filter((store: R) => store.settings?.whatsappConfig?.isActive);
  const storeIds = stores.map((store: R) => store.id);
  if (!storeIds.length) return { processed: false, reason: 'no_active_whatsapp_store' };
  const order = await findOrder(storeIds, message.phone);
  if (!order) return { processed: false, reason: 'no_matching_order', phone: message.phone };

  const duplicate = await supabase.from('whatsapp_messages').select('id').eq('provider', 'meta_cloud').eq('provider_message_id', message.id).limit(1).maybeSingle();
  if (duplicate.data?.id) return { processed: false, reason: 'duplicate_message', messageId: message.id };

  const conversationId = await getConversation(order, message.phone, message.name);
  const selectedAction = action(message.text);
  const now = new Date().toISOString();
  let status = order.status || 'جديد';
  let reply = '';
  if (selectedAction === 'confirm') reply = `أهلاً بك! تم تأكيد طلبك رقم #${order.order_number || order.orderNumber || order.id} بنجاح ✅ جارٍ تجهيز الشحنة.`;
  if (selectedAction === 'cancel') {
    status = 'ملغي';
    reply = `تم إلغاء طلبك رقم #${order.order_number || order.orderNumber || order.id} بنجاح ❌`;
  }
  if (selectedAction === 'confirm') status = 'قيد_التنفيذ';

  await addMessage({
    conversation_id: conversationId,
    store_id: order.store_id,
    order_id: order.id,
    customer_phone: message.phone,
    provider: 'meta_cloud',
    provider_message_id: message.id,
    direction: 'incoming',
    message_type: message.kind,
    body: message.text,
    sender_name: message.name || order.customer_name || order.customerName || 'العميل',
    sender_phone: message.phone,
    recipient_phone: 'store',
    status: 'received',
    occurred_at: now,
    metadata: { action: selectedAction, source: 'meta_webhook' },
  });

  const update = await supabase.from('orders').update({
    status,
    whatsapp_status: 'received',
    whatsappStatus: 'received',
    updated_at: now,
    updatedAt: now,
  }).eq('id', order.id);
  if (update.error) throw update.error;

  let sent = false;
  if (reply) {
    const store = stores.find((item: R) => item.id === order.store_id);
    const result = await sendReply(store?.settings?.whatsappConfig || {}, message.phone, reply);
    sent = result.sent;
    await addMessage({
      conversation_id: conversationId,
      store_id: order.store_id,
      order_id: order.id,
      customer_phone: message.phone,
      provider: 'meta_cloud',
      provider_message_id: result.id,
      direction: 'outgoing',
      message_type: 'text',
      body: reply,
      sender_name: 'المتجر (رد تلقائي)',
      recipient_phone: message.phone,
      status: result.sent ? 'sent' : 'failed',
      occurred_at: new Date().toISOString(),
      sent_at: result.sent ? new Date().toISOString() : null,
      metadata: { source: 'webhook_auto_reply', action: selectedAction },
    });
  }
  return { processed: true, orderId: order.id, status, action: selectedAction, replySent: sent };
}

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifySignature(rawBody: string, header: string | null) {
  if (!metaAppSecret || !header?.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(metaAppSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const received = header.slice('sha256='.length).toLowerCase();
  return digest.length === received.length && [...digest].every((char, index) => char === received[index]);
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (verifyToken && mode === 'subscribe' && token === verifyToken && challenge) return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
    return response({ ok: true, service: 'supabase-whatsapp-webhook' });
  }
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const rawBody = await request.text();
  if (!(await verifySignature(rawBody, request.headers.get('x-hub-signature-256')))) return response({ ok: false, error: 'invalid_webhook_signature' }, 401);
  try {
    return response({ ok: true, ...await handle(JSON.parse(rawBody)) });
  } catch (error) {
    console.error(error);
    return response({ ok: false, error: error instanceof Error ? error.message : 'webhook_failed' }, 500);
  }
});
