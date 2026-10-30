import { getSupabaseClient } from '../../services/databaseService';

export async function syncMaintenanceStatus(orderNumber: string, orderStatus: string) {
    if (!orderNumber) return;

    const statusMap: Record<string, string> = {
        'تم_الارسال': 'in_repair',
        'جاري_المراجعة': 'received',
        'سحب_للصيانة': 'received',
        'تم_توصيلها': 'delivered'
    };
    const nextStatus = statusMap[orderStatus];
    if (!nextStatus) return;

    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase client is unavailable; maintenance status was not synchronized.');

    const { error } = await client.from('maintenance_requests')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('order_number', orderNumber);
    if (error) throw error;
}
