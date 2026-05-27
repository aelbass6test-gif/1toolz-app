import { Order, Settings } from '../types';

export const triggerWebhooks = async (order: Order, settings: Settings) => {
    if (!settings.webhookIntegrations || settings.webhookIntegrations.length === 0) return;

    const activeIntegrations = settings.webhookIntegrations.filter(w => w.isActive);
    
    for (const integration of activeIntegrations) {
        try {
            console.log(`[WEBHOOK] Triggering webhook for integration: ${integration.storeUrl || integration.id} (${integration.webhookUrl})`);
            const response = await fetch(integration.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(integration.secretKey ? { 'Authorization': `Bearer ${integration.secretKey}` } : {})
                },
                body: JSON.stringify(order)
            });

            if (!response.ok) {
                console.warn(`[WEBHOOK] Failed for ${integration.storeUrl || integration.id}: ${response.statusText}`);
            } else {
                console.log(`[WEBHOOK] Success for ${integration.storeUrl || integration.id}`);
            }
        } catch (error) {
            console.error(`[WEBHOOK] Error triggering webhook for ${integration.storeUrl || integration.id}:`, error);
        }
    }
};
