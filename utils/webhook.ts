import { Order, Settings, WebhookEventType } from '../types';
import { triggerWebhookEvent, formatRealOrderPayload } from '../services/webhookDispatcherService';

export const triggerWebhooks = async (order: Order, settings: Settings, storeId?: string, eventType: WebhookEventType = 'order.completed') => {
    if (!settings) return;
    try {
        const payload = formatRealOrderPayload(order, settings);
        await triggerWebhookEvent(eventType, payload, settings, storeId);
    } catch (err) {
        console.error('[WEBHOOK] Error triggering order webhooks:', err);
    }
};

