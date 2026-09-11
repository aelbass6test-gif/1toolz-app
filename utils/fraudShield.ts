/**
 * Fraud & Fake Orders Shield Service
 * Identifies abusive, fake, and high-return phone numbers to protect profit margins
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

export function getStoredBlacklist(): BlacklistEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_BLACKLIST_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveBlacklistEntry(entry: BlacklistEntry): BlacklistEntry[] {
  try {
    const current = getStoredBlacklist();
    const cleanPhone = entry.phone.replace(/\D/g, '').slice(-10); // match last 10 digits
    const filtered = current.filter(item => item.phone.replace(/\D/g, '').slice(-10) !== cleanPhone);
    const updated = [entry, ...filtered];
    localStorage.setItem(LOCAL_STORAGE_BLACKLIST_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('fraud_shield_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to save blacklist entry', e);
    return getStoredBlacklist();
  }
}

export function removeBlacklistEntry(phone: string): BlacklistEntry[] {
  try {
    const current = getStoredBlacklist();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const updated = current.filter(item => item.phone.replace(/\D/g, '').slice(-10) !== cleanPhone);
    localStorage.setItem(LOCAL_STORAGE_BLACKLIST_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('fraud_shield_updated', { detail: updated }));
    return updated;
  } catch (e) {
    console.error('Failed to remove blacklist entry', e);
    return getStoredBlacklist();
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
