import { Order, Product, CustomerProfile, Settings, WebhookSubscription, WebhookEventType } from '../types';

export interface WebhookDeliveryLog {
  id: string;
  eventId: string;
  event: WebhookEventType;
  url: string;
  statusCode?: number;
  statusText?: string;
  success: boolean;
  durationMs?: number;
  error?: string;
  timestamp: string;
  payloadSummary: {
    orderNumber?: string;
    customerName?: string;
    customerPhone?: string;
    totalPrice?: number;
    productName?: string;
  };
  fullPayload?: any;
}

const LOCAL_STORAGE_LOGS_KEY = 'store_webhook_delivery_logs';

/**
 * Get recent webhook delivery logs from localStorage
 */
export function getStoredWebhookLogs(): WebhookDeliveryLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

/**
 * Save a webhook delivery log
 */
export function recordWebhookDeliveryLog(log: WebhookDeliveryLog) {
  try {
    const logs = getStoredWebhookLogs();
    const updated = [log, ...logs.slice(0, 49)]; // keep latest 50
    localStorage.setItem(LOCAL_STORAGE_LOGS_KEY, JSON.stringify(updated));
    // Dispatch custom event so listeners in UI update in real-time
    window.dispatchEvent(new CustomEvent('store_webhook_delivered', { detail: log }));
  } catch (e) {
    console.error('Failed to record webhook log:', e);
  }
}

/**
 * Format a real order into a rich, compliant webhook payload suitable for
 * confirmation systems (like Akked), Zapier, Make, Google Sheets, or custom servers.
 */
export function formatRealOrderPayload(order: Order, storeSettings?: Settings) {
  const timestamp = new Date().toISOString();
  const items = (order.items || []).map((item, idx) => ({
    id: item.productId || `item_${idx + 1}`,
    product_id: item.productId,
    name: item.name || (item as any).productName || 'منتج',
    product_name: item.name || (item as any).productName || 'منتج',
    quantity: item.quantity || 1,
    price: item.price || 0,
    cost: item.cost || 0,
    variant: item.variantId || '',
    total: (item.price || 0) * (item.quantity || 1)
  }));

  const customerName = order.customerName || (order as any).customer?.name || '';
  const customerPhone = order.customerPhone || (order as any).customer?.phone || (order as any).phone || '';
  const customerAddress = order.customerAddress || (order as any).customer?.address || (order as any).address || '';
  const governorate = order.governorate || order.shippingArea || '';
  const city = order.city || '';
  const totalPrice = order.totalPrice ?? (order as any).total ?? 0;
  const shippingFee = order.shippingFee || 0;
  const discount = order.discount || 0;

  return {
    order_id: order.id,
    order_number: order.orderNumber || `ORD-${order.id}`,
    code: order.orderNumber || `ORD-${order.id}`,
    customer: {
      name: customerName,
      phone: customerPhone,
      address: customerAddress,
      governorate,
      city
    },
    // Direct top-level fields for Akked, Zapier, Google Sheets
    customer_name: customerName,
    customer_phone: customerPhone,
    phone: customerPhone,
    customer_address: customerAddress,
    address: customerAddress,
    governorate,
    city,
    items,
    items_count: items.length,
    subtotal: items.reduce((sum, it) => sum + it.total, 0),
    shipping_fee: shippingFee,
    discount,
    total_price: totalPrice,
    total: totalPrice,
    status: order.status || 'معلق',
    notes: order.notes || '',
    payment_method: order.paymentMethod || 'الدفع عند الاستلام (COD)',
    shipping_company: order.shippingCompany || '',
    tracking_number: (order as any).trackingNumber || order.trackingUrl || '',
    created_at: (order as any).createdAt || order.date || timestamp,
    updated_at: (order as any).updatedAt || order.date || timestamp,
    source: (order as any).source || 'store'
  };
}

/**
 * Format a real abandoned cart into a rich webhook payload
 */
export function formatRealCartPayload(cart: any, storeSettings?: Settings) {
  const timestamp = new Date().toISOString();
  const items = (cart.items || []).map((it: any) => ({
    product_id: it.productId || it.id,
    name: it.name || it.productName || 'منتج',
    price: it.price || 0,
    quantity: it.quantity || 1,
    variant: it.variant || ''
  }));

  const customerName = cart.customerName || cart.customer?.name || cart.name || '';
  const customerPhone = cart.customerPhone || cart.customer?.phone || cart.phone || '';

  return {
    cart_id: cart.id || `cart_${Date.now()}`,
    customer: {
      name: customerName,
      phone: customerPhone,
      email: cart.customerEmail || cart.email || ''
    },
    customer_name: customerName,
    customer_phone: customerPhone,
    phone: customerPhone,
    items,
    items_count: items.length,
    estimated_total: cart.totalPrice || cart.subtotal || items.reduce((acc: number, cur: any) => acc + (cur.price * cur.quantity), 0),
    currency: 'EGP',
    abandoned_at: cart.abandonedAt || cart.createdAt || timestamp,
    recovery_url: cart.recoveryUrl || `${window.location.origin}/checkout?cartId=${cart.id || ''}`
  };
}

/**
 * Format a real product into a rich webhook payload
 */
export function formatRealProductPayload(product: Product, storeSettings?: Settings) {
  const timestamp = new Date().toISOString();
  return {
    product_id: product.id,
    name: product.name,
    sku: product.sku || '',
    price: product.price,
    cost_price: product.costPrice || 0,
    stock_quantity: product.stockQuantity || 0,
    category: (product as any).category || 'عام',
    images: product.images || (product.thumbnail ? [product.thumbnail] : []),
    updated_at: timestamp
  };
}

/**
 * Format a real customer into a rich webhook payload
 */
export function formatRealCustomerPayload(customer: CustomerProfile, storeSettings?: Settings) {
  const timestamp = new Date().toISOString();
  return {
    customer_id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email || '',
    address: customer.address || '',
    governorate: customer.governorate || '',
    city: customer.city || '',
    total_orders: customer.totalOrders || 0,
    total_spent: customer.totalSpent || 0,
    notes: customer.notes || '',
    created_at: (customer as any).createdAt || timestamp,
    updated_at: timestamp
  };
}

/**
 * Core Real-Time Webhook Dispatcher
 * Dispatches live event data to all subscribed webhook endpoints
 */
export async function triggerWebhookEvent(
  event: WebhookEventType,
  realData: any,
  settings?: Settings,
  storeId?: string
): Promise<{ dispatchedCount: number; results: any[] }> {
  // 1. Resolve subscriptions
  let subscriptions: WebhookSubscription[] = settings?.storeWebhooks || [];
  if (subscriptions.length === 0 && settings?.webhookIntegrations) {
    subscriptions = settings.webhookIntegrations.map(wi => ({
      id: wi.id,
      event: 'order.completed' as WebhookEventType,
      format: 'JSON' as const,
      url: wi.webhookUrl,
      apiVersion: 'v1.0' as const,
      secretKey: wi.secretKey,
      isActive: wi.isActive,
      createdAt: new Date().toISOString()
    }));
  }

  // If no settings provided, attempt to load from localStorage active store
  if (subscriptions.length === 0) {
    try {
      const activeStoreKey = `store_settings_${storeId || 'default'}`;
      const saved = localStorage.getItem(activeStoreKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.storeWebhooks) subscriptions = parsed.storeWebhooks;
      }
    } catch (e) {
      // ignore
    }
  }

  // Filter subscriptions matching the event
  const matching = subscriptions.filter(sub => {
    return sub.isActive && (sub.event === event || sub.event === ('' as any));
  });

  if (matching.length === 0) {
    return { dispatchedCount: 0, results: [] };
  }

  console.log(`[REAL-WEBHOOK] Dispatching event "${event}" to ${matching.length} endpoint(s)...`, realData);

  try {
    const res = await fetch('/api/v1/webhooks/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        storeId,
        data: realData,
        subscriptions: matching,
        apiVersion: matching[0]?.apiVersion || 'v1.0'
      })
    });

    const data = await res.json();

    // Log each dispatch result for real-time monitoring
    if (data.results && Array.isArray(data.results)) {
      data.results.forEach((r: any) => {
        const sub = matching.find(m => m.id === r.id);
        const payloadSummary: any = {};
        if (realData) {
          if (realData.order_number || realData.orderNumber) payloadSummary.orderNumber = realData.order_number || realData.orderNumber;
          if (realData.customer_name || realData.customerName || realData.customer?.name) payloadSummary.customerName = realData.customer_name || realData.customerName || realData.customer?.name;
          if (realData.customer_phone || realData.customerPhone || realData.customer?.phone || realData.phone) payloadSummary.customerPhone = realData.customer_phone || realData.customerPhone || realData.customer?.phone || realData.phone;
          if (realData.total_price !== undefined || realData.totalPrice !== undefined) payloadSummary.totalPrice = realData.total_price ?? realData.totalPrice;
          if (realData.name || realData.product_name) payloadSummary.productName = realData.name || realData.product_name;
        }

        recordWebhookDeliveryLog({
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          eventId: `evt_${Date.now()}`,
          event,
          url: r.url || sub?.url || '',
          statusCode: r.statusCode,
          statusText: r.statusText,
          success: r.success,
          durationMs: r.durationMs,
          error: r.error,
          timestamp: new Date().toISOString(),
          payloadSummary,
          fullPayload: realData
        });
      });
    }

    return {
      dispatchedCount: matching.length,
      results: data.results || []
    };
  } catch (err: any) {
    console.error('[REAL-WEBHOOK] Dispatch error:', err);
    return { dispatchedCount: 0, results: [] };
  }
}
