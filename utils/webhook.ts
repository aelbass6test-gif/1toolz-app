import { Order, Settings, WebhookEventType } from '../types';
import {
  triggerWebhookEvent,
  formatRealOrderPayload,
  recordWebhookDeliveryLog,
} from '../services/webhookDispatcherService';
import {
  isConfirmItEnabled,
  isOrderPaidOnlineForConfirmIt,
  maskConfirmItTarget,
  buildConfirmItOrderPayload,
} from './confirmit';

const RECENT_WEBHOOK_DEDUP = new Map<string, number>();
const RECENT_CONFIRMIT_DEDUP = new Map<string, number>();
const DEDUP_WINDOW_MS = 10000;

function isRecentlyTriggered(cache: Map<string, number>, key: string): boolean {
  const now = Date.now();
  const prev = cache.get(key);
  if (prev && now - prev < DEDUP_WINDOW_MS) {
    return true;
  }
  cache.set(key, now);
  if (cache.size > 200) {
    for (const [k, ts] of cache.entries()) {
      if (now - ts >= DEDUP_WINDOW_MS) cache.delete(k);
    }
  }
  return false;
}

function resolveStoreIdFallback(storeId?: string, settings?: Settings): string | undefined {
  if (storeId && String(storeId).trim()) return String(storeId).trim();
  if (settings?.id && String(settings.id).trim()) return String(settings.id).trim();
  try {
    return (
      localStorage.getItem('lastActiveStoreId') ||
      localStorage.getItem('activeStoreId') ||
      undefined
    );
  } catch {
    return undefined;
  }
}

export const triggerWebhooks = async (
  order: Order,
  settings: Settings,
  storeId?: string,
  eventType: WebhookEventType = 'order.completed'
) => {
  if (!settings || !order) return;
  const resolvedStoreId = resolveStoreIdFallback(storeId, settings);
  const orderKey = order.id || order.orderNumber || '';

  // 1. Standard Webhooks Dispatch (deduplicated)
  const webhookDedupKey = `${resolvedStoreId || 'default'}:${orderKey}:${eventType}`;
  if (!isRecentlyTriggered(RECENT_WEBHOOK_DEDUP, webhookDedupKey)) {
    try {
      const payload = formatRealOrderPayload(order, settings);
      await triggerWebhookEvent(eventType, payload, settings, resolvedStoreId);
    } catch (err) {
      console.error('[WEBHOOK] Error triggering order webhooks:', err);
    }
  }

  // 2. Confirm It Order API Server-Side Dispatch (for new completed orders)
  if (
    eventType === 'order.completed' &&
    resolvedStoreId &&
    isConfirmItEnabled(settings) &&
    settings.confirmItConfig?.autoSendOnNewOrder !== false &&
    order.confirmItSync?.status !== 'sent' &&
    order.confirmItSync?.status !== 'already_exists'
  ) {
    const skipOnlinePaid =
      !settings.confirmItConfig?.sendOnlinePaidOrders &&
      isOrderPaidOnlineForConfirmIt(order);
    const confirmDedupKey = `${resolvedStoreId}:${orderKey}`;

    if (!skipOnlinePaid && !isRecentlyTriggered(RECENT_CONFIRMIT_DEDUP, confirmDedupKey)) {
      try {
        const res = await fetch('/api/v1/confirmit/send-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeId: resolvedStoreId,
            order,
            manual: false,
            persistOrderStatus: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!data?.skipped) {
          const preview = buildConfirmItOrderPayload(order, {
            includeShippingLines: settings.confirmItConfig?.includeShippingLines !== false,
          });
          recordWebhookDeliveryLog(
            {
              id: `confirmit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              storeId: resolvedStoreId,
              eventId: `confirmit_${orderKey}`,
              event: 'order.completed',
              url: data.maskedUrl || maskConfirmItTarget(),
              statusCode: data.statusCode || res.status,
              statusText: data.success
                ? data.alreadyExists
                  ? 'Confirm It: Order already exists'
                  : 'Confirm It: 201 Created'
                : 'Confirm It: Failed',
              success: Boolean(data.success),
              durationMs: data.durationMs,
              error: data.success ? undefined : data.error || 'Confirm It dispatch failed',
              timestamp: new Date().toISOString(),
              payloadSummary: {
                orderNumber: order.orderNumber || order.id,
                customerName: order.customerName,
                customerPhone: order.customerPhone,
                totalPrice: order.totalPrice ?? order.productPrice,
                productName: order.productName,
              },
              fullPayload: preview.payload || undefined,
            },
            resolvedStoreId
          );
        }
      } catch (err) {
        console.error('[CONFIRMIT] Auto-dispatch error:', err);
      }
    }
  }
};
