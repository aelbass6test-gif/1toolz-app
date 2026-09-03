import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, ShieldCheck, Info, RefreshCw, AlertTriangle, UserCheck, PackageCheck, RotateCcw, Truck } from 'lucide-react';
import { bostaService } from '../utils/bostaService';
import { Order, Settings } from '../types';

interface CustomerDeliveryRateBadgeProps {
  phone?: string;
  orders?: Order[];
  settings?: Settings;
  showDetails?: boolean;
  compact?: boolean;
}

export interface CustomerRateInfo {
  phone: string;
  totalOrders: number;
  deliveredCount: number;
  returnedCount: number;
  pendingCount: number;
  rate: number | null;
  rating: 'excellent' | 'moderate' | 'low' | 'new';
  label: string;
  color: string;
  badgeIcon: string;
  hasBostaData?: boolean;
  hasLocalData?: boolean;
}

export const CustomerDeliveryRateBadge: React.FC<CustomerDeliveryRateBadgeProps> = ({
  phone,
  orders = [],
  settings,
  showDetails = true,
  compact = false,
}) => {
  const [bostaRateData, setBostaRateData] = useState<CustomerRateInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const cleanPhone = useMemo(() => {
    return (phone || '').replace(/\D/g, '');
  }, [phone]);

  // Instant local calculation from orders prop
  const localRateData = useMemo<CustomerRateInfo | null>(() => {
    if (!cleanPhone || cleanPhone.length < 6) return null;
    const last8 = cleanPhone.slice(-8);

    let delivered = 0;
    let returned = 0;
    let pending = 0;

    orders.forEach((o) => {
      const p1 = (o.customerPhone || '').replace(/\D/g, '');
      const p2 = (o.customerPhone2 || '').replace(/\D/g, '');
      if ((p1 && p1.slice(-8) === last8) || (p2 && p2.slice(-8) === last8)) {
        const st = String(o.status || '').toLowerCase();
        if (st.includes('سلم') || st.includes('تسليم') || st.includes('delivered') || st.includes('تم الاستلام')) {
          delivered++;
        } else if (st.includes('مرتجع') || st.includes('ملغي') || st.includes('إلغاء') || st.includes('canceled') || st.includes('returned') || st.includes('مرفوض')) {
          returned++;
        } else {
          pending++;
        }
      }
    });

    const totalCompleted = delivered + returned;
    const totalOrders = totalCompleted + pending;
    let rate: number | null = null;
    let rating: 'excellent' | 'moderate' | 'low' | 'new' = 'new';
    let label = 'عميل جديد (أول أوردر)';
    let color = 'slate';
    let badgeIcon = 'ℹ️';

    if (totalCompleted > 0) {
      rate = Math.round((delivered / totalCompleted) * 1000) / 10;
      if (returned > 0 && rate < 50) {
        rating = 'low';
        label = 'العميل نسبة استلامه منخفضة';
        color = 'rose';
        badgeIcon = '🔴';
      } else if (rate < 50) {
        rating = 'low';
        label = 'العميل نسبة استلامه منخفضة';
        color = 'rose';
        badgeIcon = '🔴';
      } else if (rate >= 50 && rate < 75) {
        rating = 'moderate';
        label = 'العميل نسبة استلامه متوسطة';
        color = 'amber';
        badgeIcon = '🟡';
      } else {
        rating = 'excellent';
        label = 'العميل نسبة استلامه ممتازة';
        color = 'emerald';
        badgeIcon = '🟢';
      }
    }

    return {
      phone: cleanPhone,
      totalOrders,
      deliveredCount: delivered,
      returnedCount: returned,
      pendingCount: pending,
      rate,
      rating,
      label,
      color,
      badgeIcon,
      hasLocalData: totalOrders > 0,
    };
  }, [cleanPhone, orders]);

  // Asynchronous Bosta API call
  useEffect(() => {
    if (!cleanPhone || cleanPhone.length < 6) {
      setBostaRateData(null);
      return;
    }

    let isMounted = true;
    const bConfig = settings?.bostaConfig as any;
    const apiKey = bConfig?.bostaApiKey || bConfig?.apiKey;
    const isStaging = bConfig?.bostaEnvironment === 'staging' || bConfig?.environment === 'staging';

    setIsLoading(true);
    bostaService.getCustomerDeliveryRate(cleanPhone, apiKey, isStaging).then((res) => {
      if (!isMounted) return;
      setIsLoading(false);
      if (res && res.success) {
        setBostaRateData(res);
      }
    }).catch(() => {
      if (isMounted) setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [cleanPhone, (settings?.bostaConfig as any)?.bostaApiKey, (settings?.bostaConfig as any)?.apiKey, (settings?.bostaConfig as any)?.environment]);

  if (!cleanPhone || cleanPhone.length < 6) return null;

  // Use Bosta data if available, or fall back to local computation
  const rateData = bostaRateData || localRateData;
  if (!rateData) return null;

  const { rating, label, rate, deliveredCount, returnedCount, pendingCount, totalOrders } = rateData;

  // Render Compact Version (for Tables and Lists)
  if (compact) {
    if (rating === 'low') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-rose-500 text-rose-300 font-extrabold text-[10px] shadow-sm cursor-help transition-all hover:scale-105"
          title={`العميل نسبة استلامه منخفضة (${rate !== null ? `${rate}%` : 'منخفضة'}) - تم استلام ${deliveredCount} وارتجاع ${returnedCount} طلب`}
        >
          <ShieldAlert size={12} className="text-rose-400 shrink-0" />
          <span>العميل نسبة استلامه منخفضة</span>
          {rate !== null && <span className="font-mono text-rose-200">({rate}%)</span>}
        </span>
      );
    }

    if (rating === 'moderate') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-amber-800 dark:text-amber-200 font-extrabold text-[10px]"
          title={`نسبة استلام متوسطة (${rate}%) - تم استلام ${deliveredCount} من أصل ${deliveredCount + returnedCount}`}
        >
          <AlertTriangle size={11} className="text-amber-500 shrink-0" />
          <span>نسبة استلام متوسطة ({rate}%)</span>
        </span>
      );
    }

    if (rating === 'excellent') {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 font-extrabold text-[10px]"
          title={`نسبة استلام ممتازة (${rate}%) - تم استلام ${deliveredCount} طلب`}
        >
          <ShieldCheck size={11} className="text-emerald-600 shrink-0" />
          <span>نسبة استلام ممتازة ({rate}%)</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
        <Info size={11} /> عميل جديد
      </span>
    );
  }

  // Render Full Detailed Version (for Order Form)
  return (
    <div
      className={`p-4 rounded-2xl border transition-all animate-in fade-in duration-200 ${
        rating === 'low'
          ? 'bg-gradient-to-r from-slate-900 via-rose-950/80 to-slate-900 border-rose-500/80 text-white shadow-lg shadow-rose-950/30'
          : rating === 'moderate'
          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-100'
          : rating === 'excellent'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
          : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Main Title & Indicator */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
              rating === 'low'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/40 animate-pulse'
                : rating === 'moderate'
                ? 'bg-amber-500 text-white'
                : rating === 'excellent'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {rating === 'low' ? (
              <ShieldAlert size={20} />
            ) : rating === 'moderate' ? (
              <AlertTriangle size={20} />
            ) : rating === 'excellent' ? (
              <ShieldCheck size={20} />
            ) : (
              <UserCheck size={20} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight">{label}</span>
              {rate !== null && (
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-mono font-black ${
                    rating === 'low'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                      : rating === 'moderate'
                      ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-100'
                      : 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-100'
                  }`}
                >
                  {rate}%
                </span>
              )}
              {isLoading && <RefreshCw size={12} className="animate-spin text-slate-400" />}
            </div>

            <p className="text-[11px] opacity-80 mt-0.5 font-medium">
              {rating === 'low'
                ? '⚠️ تنبيه رسمـي من بوسطة: هذا العميل لديه طلبات مرتجعة سابقة بكثرة. يُنصح بتأكيد العنوان والجدية قبل شحن الأوردر.'
                : rating === 'moderate'
                ? 'ملاحظة: نسبة الاستلام متوسطة، يُفضل التأكيد مع العميل تلفونياً قبل الشحن.'
                : rating === 'excellent'
                ? 'ممتاز! هذا العميل ملتزم باستلام أوردراته وتسديد قيمتها بنجاح.'
                : 'هذا رقم جديد أو لم تسجل له طلبات مكتملة سابقة على النظام أو بوسطة.'}
            </p>
          </div>
        </div>

        {/* Stats Details Pills */}
        {showDetails && (
          <div className="flex items-center gap-2 flex-wrap shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-700/30">
            <div className="px-2.5 py-1 rounded-xl bg-slate-800/40 dark:bg-slate-900/60 border border-slate-700/50 text-[11px] font-bold flex items-center gap-1.5">
              <PackageCheck size={13} className="text-emerald-400" />
              <span>مستلم: <strong className="font-mono text-emerald-400">{deliveredCount}</strong></span>
            </div>

            <div className="px-2.5 py-1 rounded-xl bg-slate-800/40 dark:bg-slate-900/60 border border-slate-700/50 text-[11px] font-bold flex items-center gap-1.5">
              <RotateCcw size={13} className="text-rose-400" />
              <span>مرتجع: <strong className="font-mono text-rose-400">{returnedCount}</strong></span>
            </div>

            {pendingCount > 0 && (
              <div className="px-2.5 py-1 rounded-xl bg-slate-800/40 dark:bg-slate-900/60 border border-slate-700/50 text-[11px] font-bold flex items-center gap-1.5">
                <Truck size={13} className="text-amber-400" />
                <span>قيد الشحن: <strong className="font-mono text-amber-400">{pendingCount}</strong></span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
