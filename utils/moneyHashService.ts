import { MoneyHashConfig, MoneyHashMethodConfig, Order } from '../types';

export const MONEYHASH_DEFAULT_METHODS: MoneyHashMethodConfig[] = [
  { id: 'cards', name: 'بطاقات البنك والائتمان (Visa / MasterCard)', category: 'card', enabled: true, description: 'دفع مباشر آمن بواسطة البطاقات.', icon: '💳' },
  { id: 'vodafone_cash', name: 'المحافظ الإلكترونية', category: 'wallet', enabled: true, description: 'دفع من المحافظ الإلكترونية.', icon: '📱' },
  { id: 'instapay', name: 'InstaPay / IPN', category: 'instant_transfer', enabled: true, description: 'تحويل لحظي.', icon: '⚡' },
  { id: 'valu', name: 'ValU', category: 'bnpl', enabled: true, description: 'دفع بالتقسيط.', icon: '🛍️' },
  { id: 'fawry', name: 'Fawry Code', category: 'kiosk', enabled: true, description: 'سداد نقدي عبر فوري.', icon: '🏪' },
  { id: 'tabby', name: 'Tabby', category: 'bnpl', enabled: true, description: 'دفع بالتقسيط.', icon: '📦' },
  { id: 'tamara', name: 'Tamara', category: 'bnpl', enabled: true, description: 'دفع بالتقسيط.', icon: '✨' },
  { id: 'meeza', name: 'Meeza Card', category: 'card', enabled: true, description: 'بطاقات ميزة.', icon: '🇪🇬' },
  { id: 'apple_pay', name: 'Apple Pay', category: 'card', enabled: true, description: 'دفع سريع.', icon: '🍏' }
];

export const DEFAULT_MONEYHASH_CONFIG: MoneyHashConfig = {
  isActive: false, mode: 'test', accountKey: '', currency: 'EGP',
  selectedMethods: Object.fromEntries(MONEYHASH_DEFAULT_METHODS.map(method => [method.id, method.enabled])),
  methodsConfig: MONEYHASH_DEFAULT_METHODS, autoRedirectOnSuccess: true,
  testModeNotes: 'وضع الاختبار مُمكّن.'
};

export function isAllowedMoneyHashEmbedUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['embed.moneyhash.io', 'checkout.moneyhash.io', 'sandbox.moneyhash.io'].includes(url.hostname.toLowerCase()) && url.pathname.startsWith('/embed/');
  } catch { return false; }
}

export async function createMoneyHashIntent(params: {
  storeId: string; orderId: string; items: Array<{ productId: string; quantity: number; variantId?: string }>;
  shippingArea?: string; discountCode?: string; customerName: string; customerPhone: string; customerEmail?: string;
  selectedMethodId?: string; config: MoneyHashConfig;
}): Promise<{ success: boolean; intentId?: string; embedUrl?: string; payUrl?: string; message?: string; raw?: any }> {
  try {
    const response = await fetch('/api/moneyhash/create-intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId: params.storeId, orderId: params.orderId, items: params.items,
        shippingArea: params.shippingArea, discountCode: params.discountCode, customerName: params.customerName,
        customerPhone: params.customerPhone, customerEmail: params.customerEmail, selectedMethodId: params.selectedMethodId })
    });
    const data = await response.json().catch(() => ({}));
    const url = data.embedUrl || data.payUrl;
    if (response.ok && data.success && data.intentId && isAllowedMoneyHashEmbedUrl(url)) {
      return { success: true, intentId: data.intentId, embedUrl: url, payUrl: url, raw: data.data };
    }
    return { success: false, message: data.error || data.message || 'تعذر إنشاء نية الدفع عبر MoneyHash' };
  } catch (err: any) {
    console.error('[MONEYHASH-CREATE-INTENT-ERROR]', err?.message || 'request failed');
    return { success: false, message: 'خطأ في الاتصال بخادم الدفع' };
  }
}

export async function fetchMoneyHashIntentStatus(intentId: string): Promise<{ success: boolean; status?: string; isPaid?: boolean; raw?: any }> {
  try {
    const response = await fetch(`/api/moneyhash/status/${encodeURIComponent(intentId)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) return { success: false, status: 'UNKNOWN' };
    const status = String(data.status || '').toUpperCase();
    return { success: true, status, isPaid: ['SUCCESSFUL', 'PAID', 'COMPLETED', 'CAPTURED'].includes(status), raw: data.data };
  } catch { return { success: false, status: 'ERROR' }; }
}

export async function createMoneyHashAccount(params: { name: string; email?: string; phone?: string; country?: string; currency?: string; config: MoneyHashConfig }) {
  try {
    const response = await fetch('/api/moneyhash/accounts/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: params.name, email: params.email, phone: params.phone, country: params.country, currency: params.currency, mode: params.config.mode }) });
    const data = await response.json().catch(() => ({}));
    return response.ok && data.success ? { success: true, accountId: data.accountId, accountKey: data.accountKey, message: data.message, raw: data.data } : { success: false, message: data.error || 'تعذر إنشاء الحساب على MoneyHash' };
  } catch (err: any) { return { success: false, message: err?.message || 'خطأ في الاتصال بالسيرفر' }; }
}

export async function createMoneyHashAccountPaymentMethod(params: { accountId: string; provider: string; credentials?: Record<string, any>; config: MoneyHashConfig }) {
  const response = await fetch('/api/moneyhash/accounts/payment-methods/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: params.accountId, provider: params.provider, credentials: params.credentials, mode: params.config.mode }) });
  const data = await response.json().catch(() => ({}));
  return response.ok && data.success ? { success: true, message: data.message, raw: data.data } : { success: false, message: data.error || 'تعذر إضافة وسيلة الدفع للحساب' };
}

export function buildMoneyHashWhatsAppMessage(order: Partial<Order>, payUrl: string, storeName: string): string {
  return `مرحباً ${order.customerName || 'عميلنا العزيز'} 👋\n\nرابط السداد الإلكتروني لطلبك #${order.orderNumber || ''} من متجر ${storeName}:\n\n${payUrl}\n\nالمبلغ المطلوب: ${order.totalPrice || order.productPrice || 0} ج.م`;
}
