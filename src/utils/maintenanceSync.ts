import { cfFetch } from '../../services/cloudflareClient';

export async function syncMaintenanceStatus(orderNumber: string, orderStatus: string) {
    if (!orderNumber) return;

    try {
        await cfFetch('/api/db/maintenance/sync-order', {
            method: 'POST',
            body: JSON.stringify({ orderNumber, orderStatus })
        });
    } catch (e) {
        console.warn('[MAINTENANCE-SYNC] Sync error:', e);
    }
}
