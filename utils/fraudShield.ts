import { cfFetch } from '../services/cloudflareClient';

/**
 * Fraud & Fake Orders Shield Service
 * Identifies abusive, fake, and high-return phone numbers to protect profit margins
 * Persisted in Cloudflare D1 (`store_collections` -> `fraud_blacklist`) with local offline cache.
 */

export interface BlacklistEntry {
  phone: string;
  customerName?: string;
  reason: string;
  severity: 'high' | 'medium';
  addedAt: string;
  addedBy?: string;
  orderNumber?: string;
  tags?: string[];
}

const LOCAL_STORAGE_BLACKLIST_KEY = 'store_fraud_shield_blacklist';

let activeFraudStoreId: string | null = null;
const memoryBlacklistByStore = new Map<string, BlacklistEntry[]>();

function resolveStoreId(storeId?: string | null): string {
  if (storeId && String(storeId).trim()) return String(storeId).trim();
  if (activeFraudStoreId) return activeFraudStoreId;
  try {
    return localStorage.getItem('lastActiveStoreId') || localStorage.getItem('activeStoreId') || 'main_store';
  } catch {
    return 'main_store';
  }
}

function getLocalCacheKey(storeId: string): string {
  return `${LOCAL_STORAGE_BLACKLIST_KEY}_${storeId}`;
}

function writeCache(storeId: string, list: BlacklistEntry[]) {
  memoryBlacklistByStore.set(storeId, list);
  try {
    localStorage.setItem(getLocalCacheKey(storeId), JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

export function setFraudShieldStoreContext(storeId: string | null | undefined, initialEntries?: BlacklistEntry[]) {
  if (!storeId) {
    activeFraudStoreId = null;
    return;
  }
  activeFraudStoreId = storeId;
  if (Array.isArray(initialEntries)) {
    writeCache(storeId, initialEntries);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fraud_shield_updated', { detail: initialEntries }));
    }
  }
}

export async function fetchCloudBlacklist(storeId?: string): Promise<BlacklistEntry[]> {
  const sid = resolveStoreId(storeId);
  try {
    const res = await cfFetch<{ success?: boolean; entries?: BlacklistEntry[] }>(
      `/api/db/fraud-blacklist/${encodeURIComponent(sid)}`
    );
    if (Array.isArray(res?.entries)) {
      const localCached = getStoredBlacklist(sid);
      // Merge any offline-only local entries that have not been pushed yet
      const cloudPhones = new Set(res.entries.map((e) => String(e.phone || '').replace(/\D/g, '').slice(-10)));
      const localOnly = localCached.filter((e) => {
        const p = String(e.phone || '').replace(/\D/g, '').slice(-10);
        return p && !cloudPhones.has(p);
      });
      const merged = [...res.entries, ...localOnly];
      writeCache(sid, merged);
      for (const orphan of localOnly) {
        void cfFetch(`/api/db/fraud-blacklist/${encodeURIComponent(sid)}`, {
          method: 'POST',
          body: JSON.stringify({ entry: orphan })
        }).catch(() => {});
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fraud_shield_updated', { detail: merged }));
      }
      return merged;
    }
  } catch {
    // fallback to cache when offline
  }
  return getStoredBlacklist(sid);
}

export function getStoredBlacklist(storeId?: string): BlacklistEntry[] {
  const sid = resolveStoreId(storeId);
  const mem = memoryBlacklistByStore.get(sid);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(getLocalCacheKey(sid)) || localStorage.getItem(LOCAL_STORAGE_BLACKLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      memoryBlacklistByStore.set(sid, parsed);
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveBlacklistEntry(entry: BlacklistEntry, storeId?: string): BlacklistEntry[] {
  const sid = resolveStoreId(storeId);
  try {
    const current = getStoredBlacklist(sid);
    const cleanPhone = entry.phone.replace(/\D/g, '').slice(-10); // match last 10 digits
    const filtered = current.filter(item => item.phone.replace(/\D/g, '').slice(-10) !== cleanPhone);
    const updated = [entry, ...filtered];
    writeCache(sid, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fraud_shield_updated', { detail: updated }));
    }
    if (cleanPhone) {
      void cfFetch(`/api/db/fraud-blacklist/${encodeURIComponent(sid)}`, {
        method: 'POST',
        body: JSON.stringify({ entry })
      }).catch((err) => console.warn('[FraudShield] Cloud save failed:', err?.message || err));
    }
    return updated;
  } catch (e) {
    console.error('Failed to save blacklist entry', e);
    return getStoredBlacklist(sid);
  }
}

export function removeBlacklistEntry(phone: string, storeId?: string): BlacklistEntry[] {
  const sid = resolveStoreId(storeId);
  try {
    const current = getStoredBlacklist(sid);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const updated = current.filter(item => item.phone.replace(/\D/g, '').slice(-10) !== cleanPhone);
    writeCache(sid, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fraud_shield_updated', { detail: updated }));
    }
    if (cleanPhone) {
      void cfFetch(`/api/db/fraud-blacklist/${encodeURIComponent(sid)}/${encodeURIComponent(cleanPhone)}`, {
        method: 'DELETE'
      }).catch((err) => console.warn('[FraudShield] Cloud delete failed:', err?.message || err));
    }
    return updated;
  } catch (e) {
    console.error('Failed to remove blacklist entry', e);
    return getStoredBlacklist(sid);
  }
}

export interface FraudCheckResult {
  isBlacklisted: boolean;
  blacklistInfo?: BlacklistEntry;
  riskLevel: 'safe' | 'warning' | 'high_risk';
  riskScore: number; // 0 (safest) to 100 (highest risk)
  reasons: string[];
  recommendation: string;
  stats: {
    totalOrders: number;
    deliveredCount: number;
    returnedCount: number;
    canceledCount: number;
    successRate: number | null;
  };
}

export function evaluateCustomerRisk(
  phone: string,
  orders: any[] = [],
  customBlacklist?: BlacklistEntry[]
): FraudCheckResult {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (!cleanPhone || cleanPhone.length < 6) {
    return {
      isBlacklisted: false,
      riskLevel: 'safe',
      riskScore: 0,
      reasons: [],
      recommendation: 'بيانات غير كافية لتقييم العميل',
      stats: { totalOrders: 0, deliveredCount: 0, returnedCount: 0, canceledCount: 0, successRate: null }
    };
  }

  const last10 = cleanPhone.slice(-10);
  const blacklist = customBlacklist || getStoredBlacklist();
  const matchedBlacklist = blacklist.find(item => item.phone.replace(/\D/g, '').slice(-10) === last10);

  let delivered = 0;
  let returned = 0;
  let canceled = 0;
  let total = 0;

  orders.forEach(o => {
    const p1 = (o.customerPhone || '').replace(/\D/g, '').slice(-10);
    const p2 = (o.customerPhone2 || '').replace(/\D/g, '').slice(-10);
    if (p1 === last10 || p2 === last10) {
      total++;
      const st = String(o.status || '').toLowerCase();
      if (st.includes('سلم') || st.includes('تسليم') || st.includes('delivered') || st.includes('تم الاستلام')) {
        delivered++;
      } else if (st.includes('مرتجع') || st.includes('returned') || st.includes('مرفوض') || st.includes('فشل التوصيل')) {
        returned++;
      } else if (st.includes('ملغي') || st.includes('canceled') || st.includes('إلغاء')) {
        canceled++;
      }
    }
  });

  const reasons: string[] = [];
  let riskScore = 0;

  if (matchedBlacklist) {
    riskScore = 100;
    reasons.push(`الرقم مسجل في القائمة التحذيرية يدوياً: ${matchedBlacklist.reason}`);
  }

  if (returned >= 2 && delivered === 0) {
    riskScore = Math.max(riskScore, 85);
    reasons.push(`تكرر رفض واسترجاع ${returned} شحنات سابقة دون أي استلام ناجح`);
  } else if (returned > 0 && delivered === 0) {
    riskScore = Math.max(riskScore, 65);
    reasons.push(`لديه شحنة سابقة مرتجعة/مرفوضة على الباب`);
  } else if (returned > delivered) {
    riskScore = Math.max(riskScore, 70);
    reasons.push(`نسبة المرتجعات لديه أعلى من الاستلام (${returned} مرتجع مقابل ${delivered} مستلم)`);
  }

  if (canceled >= 3 && delivered === 0) {
    riskScore = Math.max(riskScore, 75);
    reasons.push(`قام بإلغاء ${canceled} طلبات سابقة بصورة متكررة`);
  }

  let riskLevel: FraudCheckResult['riskLevel'] = 'safe';
  let recommendation = 'عميل موثوق، يمكن الشحن مباشرة';

  if (riskScore >= 75) {
    riskLevel = 'high_risk';
    recommendation = '🚨 عالي الخطورة! نوصي بطلب عربون مسبق عبر فودافون كاش أو إنستاباي لتغطية مصاريف الشحن';
  } else if (riskScore >= 50) {
    riskLevel = 'warning';
    recommendation = '⚠️ تنبيه: يرجى الاتصال والتأكيد المسبق على العنوان والجاهزية قبل شحن الطرد';
  } else if (delivered > 0) {
    recommendation = `✅ عميل ممتاز ومستلم (${delivered} طلبات ناجحة)`;
  }

  const completed = delivered + returned;
  const successRate = completed > 0 ? Math.round((delivered / completed) * 100) : null;

  return {
    isBlacklisted: Boolean(matchedBlacklist),
    blacklistInfo: matchedBlacklist,
    riskLevel,
    riskScore,
    reasons,
    recommendation,
    stats: {
      totalOrders: total,
      deliveredCount: delivered,
      returnedCount: returned,
      canceledCount: canceled,
      successRate
    }
  };
}
