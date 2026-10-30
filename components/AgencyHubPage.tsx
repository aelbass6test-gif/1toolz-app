import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  Building2, Users2, Receipt, Coins, ShieldCheck, Globe, 
  Settings2, ArrowUpRight, Clock, Calendar, 
  CheckCircle2, AlertTriangle, Sparkles, Filter, 
  Search, ExternalLink, ChevronLeft, Wallet as WalletIcon, TrendingUp,
  DollarSign, Landmark, RefreshCw, X, ArrowDownRight, Check
} from 'lucide-react';
import { Settings, Order, Wallet, Treasury, CustomerProfile, Supplier } from '../types';
import * as db from '../services/databaseService';
import { inAppToast, inAppConfirm } from '../utils/inAppAlert';
import MerchantsPage from './MerchantsPage';
import { MerchantSettlementPage } from './MerchantSettlementPage';
import MerchantPortal from './MerchantPortal';
import MerchantProductReview from './MerchantProductReview';

interface AgencyHubPageProps {
  storeId?: string;
  settings: Settings;
  updateSettings: (updater: Settings | ((prev: Settings) => Settings)) => void;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  treasury?: Treasury;
  setTreasury?: (updater: Treasury | ((prev: Treasury) => Treasury)) => void;
  customers?: CustomerProfile[];
  currentUser?: any;
  allStoresData?: Record<string, any>;
}

type AgencyTab = 'merchants' | 'settlements' | 'requests' | 'policies' | 'portal' | 'product-review';

export const AgencyHubPage: React.FC<AgencyHubPageProps> = ({
  storeId,
  settings,
  updateSettings,
  orders,
  setOrders,
  wallet,
  setWallet,
  treasury,
  setTreasury,
  customers = [],
  currentUser,
  allStoresData = {}
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  // Normalize 'overview' or any unmapped tab to 'merchants'
  const currentTab: AgencyTab = (rawTab === 'settlements' || rawTab === 'requests' || rawTab === 'policies' || rawTab === 'portal' || rawTab === 'product-review')
    ? rawTab 
    : 'merchants';
    
  const activeStoreId = storeId || localStorage.getItem('activeStoreId') || 'default';

  const setTab = (tab: AgencyTab) => {
    setSearchParams({ tab });
  };

  // Cloud Merchant Requests for Payouts
  const [cloudRequests, setCloudRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestFilter, setRequestFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  
  // Direct Payout Modal state
  const [selectedRequestForApproval, setSelectedRequestForApproval] = useState<db.PartnerPortalRequest | null>(null);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [isApproving, setIsApproving] = useState(false);

  const loadRequests = useCallback(async () => {
    if (!activeStoreId) return;
    try {
      setRequestsLoading(true);
      const reqs = await db.getMerchantRequests(activeStoreId, { forceAdmin: true });
      setCloudRequests(reqs);
    } catch (_) {
    } finally {
      setRequestsLoading(false);
    }
  }, [activeStoreId]);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 20000);
    return () => clearInterval(interval);
  }, [loadRequests]);

  const suppliersList: Supplier[] = useMemo(() => {
    const suppliers = Array.isArray(settings.suppliers) ? settings.suppliers : Object.values(settings.suppliers || {});
    const partners = (Array.isArray(settings.partners) ? settings.partners : Object.values(settings.partners || {}))
      .filter((p: any) => p.role?.toLowerCase().includes('merchant') || p.role?.includes('موكل') || p.isMerchant);
    
    const combined = [...suppliers, ...partners];
    const map = new Map();
    combined.forEach((m: any) => {
      const key = (m.id || m.name || '').toLowerCase();
      if (!map.has(key)) map.set(key, m);
    });
    return Array.from(map.values());
  }, [settings.suppliers, settings.partners]);

  // Executive KPI Calculations
  const metrics = useMemo(() => {
    const totalMerchants = suppliersList.length;
    const totalMerchantBalances = suppliersList.reduce((acc, s) => acc + (s.balance || 0), 0);
    
    // Total agency commissions collected from orders
    let totalAgencyOrderFees = 0;
    let totalOrdersUnderHolding = 0;
    let holdingOrdersAmount = 0;
    const nowMs = Date.now();

    orders.forEach(o => {
      if (o.serviceFeePerOrder && Number(o.serviceFeePerOrder) > 0) {
        totalAgencyOrderFees += Number(o.serviceFeePerOrder);
      }
      
      // Check 7-day holding duration
      if (o.settlementStatus === 'settled' && o.settledAt) {
        const settledMs = new Date(o.settledAt).getTime();
        const merchant = suppliersList.find(s => s.id === o.merchantId);
        const holdingDays = merchant?.holdingDaysAfterSettlement ?? settings.holdingDaysAfterSettlement ?? 7;
        const maturityMs = settledMs + (holdingDays * 24 * 60 * 60 * 1000);
        
        if (nowMs < maturityMs && o.payoutStatus !== 'paid') {
          totalOrdersUnderHolding++;
          holdingOrdersAmount += Number(o.merchantItemCost || o.totalPrice || 0);
        }
      }
    });

    const pendingRequests = cloudRequests.filter(r => r.status === 'pending');
    const pendingWithdrawalsAmount = pendingRequests
      .filter(r => r.type === 'withdrawal' || !r.type)
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      totalMerchants,
      totalMerchantBalances,
      totalAgencyOrderFees,
      totalOrdersUnderHolding,
      holdingOrdersAmount,
      pendingRequestsCount: pendingRequests.length,
      pendingWithdrawalsAmount
    };
  }, [suppliersList, orders, cloudRequests, settings.holdingDaysAfterSettlement]);

  const [globalHoldingDays, setGlobalHoldingDays] = useState<number>(settings.holdingDaysAfterSettlement ?? 7);
  const [globalWeeklyPayoutDay, setGlobalWeeklyPayoutDay] = useState<number>(settings.weeklyPayoutDay ?? 1); // Monday default
  const [globalWeeklyPayoutMode, setGlobalWeeklyPayoutMode] = useState<'auto' | 'admin_confirm'>(settings.weeklyPayoutMode ?? 'admin_confirm');
  const [globalMinPayout, setGlobalMinPayout] = useState<number>(settings.minWeeklyPayout ?? 100);
  const [globalMaxPayout, setGlobalMaxPayout] = useState<number>(settings.maxWeeklyPayout ?? 50000);
  const [globalPayoutStrategy, setGlobalPayoutStrategy] = useState<'rolling_hold' | 'batch_weekly' | 'manual_request'>(settings.defaultPayoutStrategy ?? 'rolling_hold');
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  const handleSaveGlobalPolicies = async () => {
    try {
      setIsSavingPolicies(true);
      const updated: Settings = {
        ...settings,
        holdingDaysAfterSettlement: globalHoldingDays,
        weeklyPayoutDay: globalWeeklyPayoutDay,
        weeklyPayoutMode: globalWeeklyPayoutMode,
        minWeeklyPayout: globalMinPayout,
        maxWeeklyPayout: globalMaxPayout,
        defaultPayoutStrategy: globalPayoutStrategy
      };
      
      updateSettings(updated);
      inAppToast('تم حفظ وتطبيق سياسات الوكالة الشاملة بنجاح ✅', 'success');
    } catch (err: any) {
      inAppToast('تعذر حفظ السياسات: ' + (err.message || ''), 'error');
    } finally {
      setIsSavingPolicies(false);
    }
  };

  const handleReleaseAllHoldingBalances = async () => {
    try {
      setIsSavingPolicies(true);
      setGlobalHoldingDays(0);
      setGlobalPayoutStrategy('manual_request');

      const updatedSuppliers = (settings.suppliers || []).map((s: any) => ({
        ...s,
        holdingDaysAfterSettlement: 0,
        payoutStrategy: 'manual_request'
      }));

      const updatedPartners = (settings.partners || []).map((p: any) => ({
        ...p,
        holdingDaysAfterSettlement: 0,
        payoutStrategy: 'manual_request'
      }));

      const updated: Settings = {
        ...settings,
        holdingDaysAfterSettlement: 0,
        defaultPayoutStrategy: 'manual_request',
        suppliers: updatedSuppliers,
        partners: updatedPartners
      };

      await updateSettings(updated);
      inAppToast('⚡ تم الإفراج عن كافة الأرباح المعلقة وإتاحتها للسحب والتحويل المباشر فوراً!', 'success');
    } catch (err: any) {
      inAppToast('تعذر الإفراج عن الرصيد المعلق: ' + (err.message || ''), 'error');
    } finally {
      setIsSavingPolicies(false);
    }
  };

  const handleApproveRequestWithTreasury = async () => {
    if (!selectedRequestForApproval || !activeStoreId) return;
    const req = selectedRequestForApproval;
    const amt = Number(req.amount || 0);
    const merchantId = req.partnerId;
    const normName = (req.partnerName || '').trim();

    try {
      setIsApproving(true);

      // Find supplier and calculate transfer fee
      const supplier = suppliersList.find(s => s.id === merchantId || (normName && s.name.trim() === normName));
      const isDaily = supplier?.payoutFrequency === 'daily';
      const feeRate = isDaily
        ? (typeof supplier?.dailyTransferFee === 'number' ? supplier.dailyTransferFee : (settings.dailyTransferFee ?? 1))
        : (typeof supplier?.weeklyTransferFee === 'number' ? supplier.weeklyTransferFee : (settings.weeklyTransferFee ?? 25));
      const feeType = isDaily
        ? (supplier?.dailyTransferFeeType || settings.dailyTransferFeeType || 'percentage')
        : (supplier?.weeklyTransferFeeType || settings.weeklyTransferFeeType || 'fixed');

      let transferFee = 0;
      if (feeRate > 0) {
        if (feeType === 'percentage') {
          transferFee = Math.round((amt * (feeRate / 100)) * 100) / 100;
        } else {
          transferFee = Math.min(amt, Number(feeRate) || 0);
        }
      }
      const netDisbursed = Math.max(0, Number((amt - transferFee).toFixed(2)));

      // 3. Deduct from merchant balance in settings.suppliers & settings.partners
      const updatedSuppliers = suppliersList.map(s => {
        if (s.id === merchantId || (normName && s.name.trim() === normName)) {
          const currentBal = Number(s.balance || 0);
          const newBal = Number((currentBal - amt).toFixed(2));
          const nowIso = new Date().toISOString();

          const payoutTx: any = {
            id: `mtx-${Date.now()}`,
            merchantId: s.id,
            merchantName: s.name,
            type: 'payout',
            amount: -netDisbursed,
            date: nowIso,
            notes: `صرف أرباح معتمد عبر ${req.payoutMethod || 'التحويل المالي'} (صافي المحول - طلب #${req.id.slice(-6)})`,
            balanceAfter: Number((currentBal - netDisbursed).toFixed(2)),
            referenceId: req.id
          };

          const feeTx: any = transferFee > 0 ? {
            id: `mtx-Transfer_Fees-${Date.now() + 1}`,
            merchantId: s.id,
            merchantName: s.name,
            type: 'expense',
            amount: -transferFee,
            date: nowIso,
            notes: `رسوم التحويل المالي لسحب المستحقات (طلب #${req.id.slice(-6)})`,
            balanceAfter: newBal,
            referenceId: req.id
          } : null;

          const newTxs = feeTx ? [feeTx, payoutTx] : [payoutTx];

          return {
            ...s,
            balance: newBal,
            transactions: [...newTxs, ...(s.transactions || [])]
          };
        }
        return s;
      });

      const updatedPartners = (settings.partners || []).map(p => {
        if (p.id === merchantId || (normName && p.name.trim() === normName)) {
          return {
            ...p,
            balance: Math.max(0, (Number(p.balance) || 0) - amt)
          };
        }
        return p;
      });

      const settingsSaved = await db.updatePartnerSettings(activeStoreId, updatedPartners, updatedSuppliers);
      if (!settingsSaved.success) {
        throw new Error(settingsSaved.error || 'تعذر حفظ رصيد الموكل بعد الصرف');
      }

      const requestApproved = await db.updateMerchantRequestStatus(req.id, activeStoreId, 'approved', {
        approvedBy: currentUser?.name || 'المدير المالي',
        approvedAt: new Date().toISOString()
      });
      if (!requestApproved) {
        await db.updatePartnerSettings(activeStoreId, settings.partners || [], settings.suppliers || []);
        throw new Error('لم يتم اعتماد الطلب في قاعدة البيانات؛ تمت استعادة رصيد الموكل.');
      }

      // Deduct net disbursed from treasury after the request and merchant balance are saved
      if (selectedTreasuryAccountId && treasury && setTreasury && netDisbursed > 0) {
        const acc = (treasury.accounts || []).find(a => a.id === selectedTreasuryAccountId);
        if (acc) {
          const updatedAccounts = (treasury.accounts || []).map(a => 
            a.id === selectedTreasuryAccountId ? { ...a, balance: (a.balance || 0) - netDisbursed } : a
          );
          const newTx = {
            id: `tx-payout-${Date.now()}`,
            date: new Date().toISOString(),
            type: 'withdrawal' as const,
            amount: netDisbursed,
            description: `صرف أرباح للموكل ${req.partnerName} (طلب سحب #${req.id})${transferFee > 0 ? ` [المطلوب: ${amt} ج.م | عمولة التحويل: ${transferFee} ج.م | صافي المنصرف: ${netDisbursed} ج.م]` : ''}`,
            fromAccountId: selectedTreasuryAccountId,
            reference: req.id,
            orderId: req.id
          };
          const updatedTreasury: Treasury = {
            ...treasury,
            accounts: updatedAccounts,
            transactions: [newTx, ...(treasury.transactions || [])]
          };
          setTreasury(updatedTreasury);
        }
      }


      updateSettings(prev => ({
        ...prev,
        suppliers: updatedSuppliers,
        partners: updatedPartners
      }));

      inAppToast(`تم صرف مبلغ ${amt.toLocaleString()} ج.م للموكل ${req.partnerName}${transferFee > 0 ? ` (صافي التحويل: ${netDisbursed.toLocaleString()} ج.م)` : ''} واعتماد الطلب بنجاح ✅`, 'success');
      setSelectedRequestForApproval(null);
      loadRequests();
    } catch (err: any) {
      inAppToast('تعذر اعتماد الصرف: ' + (err.message || ''), 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectRequest = async (req: db.PartnerPortalRequest) => {
    const confirmed = await inAppConfirm(
      `هل أنت متأكد من رفض طلب السحب المقدم من "${req.partnerName}" بمبلغ ${req.amount?.toLocaleString()} ج.م؟`,
      {
        title: 'تأكيد رفض طلب السحب',
        confirmText: 'نعم، رفض الطلب',
        cancelText: 'إلغاء'
      }
    );
    if (!confirmed) return;

    try {
      const rejected = await db.updateMerchantRequestStatus(req.id, activeStoreId, 'rejected');
      if (!rejected) throw new Error('تعذر تسجيل رفض الطلب في قاعدة البيانات.');
      inAppToast('تم رفض طلب السحب وفك حجز المبلغ.', 'info');
      loadRequests();
    } catch (err: any) {
      inAppToast('تعذر تحديث الطلب: ' + (err.message || ''), 'error');
    }
  };

  const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const filteredRequests = useMemo(() => {
    if (requestFilter === 'all') return cloudRequests;
    return cloudRequests.filter(r => r.status === requestFilter);
  }, [cloudRequests, requestFilter]);

  return (
    <div className="space-y-6 text-right font-sans animate-in fade-in duration-300 pb-16" dir="rtl">
      
      {/* ======================================================== */}
      {/* 1. EXECUTIVE HUB TOP BANNER (CLEAN DOMAIN-NATIVE HEADER) */}
      {/* ======================================================== */}
      <div className="relative overflow-hidden bg-slate-900 text-white p-6 sm:p-7 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-400">
              <span>منظومة الوكالة الموحدة</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">إدارة أصحاب البضائع والموكلين</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-white font-mono tabular-nums">{metrics.totalMerchants} موكل مسجل</span>
            </div>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  مركز تحكم الوكالة والموكلين الشامل
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-0.5 max-w-2xl leading-relaxed">
                  منصة مركزية موحدة لمتابعة أصحاب البضائع، محافظ الأمانات، إصدار كشوفات التسوية، وسياسات الصرف المالي والأمان.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center shrink-0">
            <Link
              to={`/store/${activeStoreId}/merchant-portal`}
              target="_blank"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Globe size={15} className="text-teal-400" />
              <span>بوابة الموكل الإلكترونية</span>
              <ExternalLink size={13} className="text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. EXECUTIVE FINANCIAL METRIC CARDS (PINNED ACROSS TABS)  */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Total Agency Revenue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">عمولات وأرباح الوكالة</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {metrics.totalAgencyOrderFees.toLocaleString()} <span className="text-xs font-bold text-slate-400 font-sans">ج.م</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500">
            <span>إجمالي رسوم إدارة الأوردرات والتسويات</span>
          </div>
        </div>

        {/* KPI 2: Total Merchant Custody Balances */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">إجمالي محافظ الموكلين</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {metrics.totalMerchantBalances.toLocaleString()} <span className="text-xs font-bold text-slate-400 font-sans">ج.م</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
              <WalletIcon size={18} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-slate-500">
            <span>أمانات ومستحقات الموكلين المسجلة في النظام</span>
          </div>
        </div>

        {/* KPI 3: Safety Holding Orders (7-day rule) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">أرباح قيد الأمان (7 أيام)</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {metrics.holdingOrdersAmount.toLocaleString()} <span className="text-xs font-bold text-slate-400 font-sans">ج.م</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium text-amber-600 dark:text-amber-400 flex flex-col gap-2">
            <div>
              <span className="font-mono tabular-nums">{metrics.totalOrdersUnderHolding}</span> أوردر قيد فترة الأمان قبل إتاحة الصرف
            </div>
            <button
              type="button"
              onClick={handleReleaseAllHoldingBalances}
              disabled={isSavingPolicies}
              className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-[10px] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              title="إلغاء فترة الأمان وإتاحة كافة المبالغ المعلقة للسحب الفوري الآن"
            >
              <span>⚡ إتاحة جميع المبالغ المعلقة للسحب فوراً</span>
            </button>
          </div>
        </div>

        {/* KPI 4: Pending Payout Requests */}
        <div 
          onClick={() => setTab('requests')}
          className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col justify-between cursor-pointer hover:border-amber-500/40 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">طلبات الصرف المعلقة</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tabular-nums">
                {metrics.pendingRequestsCount} <span className="text-xs font-bold text-slate-400 font-sans">طلب</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/50">
              <Coins size={18} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] font-medium flex items-center justify-between text-slate-500">
            <span>بإجمالي <span className="font-mono tabular-nums font-bold text-slate-800 dark:text-slate-200">{metrics.pendingWithdrawalsAmount.toLocaleString()}</span> ج.م</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">مراجعة ←</span>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* 3. UNIFIED TABS SEGMENTED CONTROLLER                      */}
      {/* ======================================================== */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        <button
          onClick={() => setTab('merchants')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            currentTab === 'merchants'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users2 size={16} />
          <span>حسابات ومحافظ الموكلين</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">
            ({metrics.totalMerchants})
          </span>
        </button>

        <button
          onClick={() => setTab('settlements')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            currentTab === 'settlements'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Receipt size={16} />
          <span>كشوفات وتسويات الأرباح</span>
          <span className="font-mono tabular-nums text-[11px] text-slate-400">
            ({settings.merchantSettlements?.length || 0})
          </span>
        </button>

        <button
          onClick={() => setTab('requests')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            currentTab === 'requests'
              ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Coins size={16} />
          <span>طلبات السحب والتحويلات</span>
          {metrics.pendingRequestsCount > 0 && (
            <span className="font-mono tabular-nums text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded font-bold">
              {metrics.pendingRequestsCount} معلق
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('policies')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            currentTab === 'policies'
              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Settings2 size={16} />
          <span>سياسات الوكالة وفترة الأمان</span>
          <span className="text-[11px] text-slate-400 font-mono">
            {globalHoldingDays}d
          </span>
        </button>

        <button
          onClick={() => setTab('portal')}
          className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            currentTab === 'portal'
              ? 'bg-teal-600 text-white shadow-xs font-black'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe size={16} />
          <span>بوابة الموكل الإلكترونية</span>
        </button>
        <button onClick={() => setTab('product-review')} className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 ${currentTab === 'product-review' ? 'bg-amber-500 text-slate-950' : 'text-slate-600 dark:text-slate-400'}`}>
          <AlertTriangle size={16} />مراجعة ملكية المنتجات ({settings.products.filter(p => !p.ownerType && (p.merchantName || (p as any).supplierName)).length})
        </button>
      </div>

      {/* ======================================================== */}
      {/* 4. TAB VIEWS CONTENT                                      */}
      {/* ======================================================== */}

      {/* TAB 1: MERCHANTS & WALLETS (EMBEDDED, CLEAN, NO DUPLICATES) */}
      {currentTab === 'merchants' && (
        <MerchantsPage
          settings={settings}
          updateSettings={updateSettings}
          wallet={wallet}
          setWallet={setWallet}
          orders={orders}
          treasury={treasury}
          setTreasury={setTreasury}
          embedded={true}
        />
      )}

      {/* TAB 2: SETTLEMENTS (EMBEDDED, NO RECURSIVE HERO) */}
      {currentTab === 'settlements' && (
        <MerchantSettlementPage
          storeId={activeStoreId}
          orders={orders}
          setOrders={setOrders}
          settings={settings}
          updateSettings={updateSettings}
          treasury={treasury}
          setTreasury={setTreasury}
          customers={customers}
          currentUser={currentUser}
          embedded={true}
        />
      )}

      {currentTab === 'product-review' && <MerchantProductReview settings={settings} updateSettings={updateSettings} />}

      {/* TAB 3: PAYOUT REQUESTS & DISBURSEMENTS */}
      {currentTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Coins className="text-amber-500" size={20} />
                  <span>طلبات السحب والتحويلات المالية للموكلين</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  مراجعة واعتماد طلبات السحب النقدية الواردة من الموكلين، والصرف المباشر من الخزينة.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs">
                  <button
                    onClick={() => setRequestFilter('all')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      requestFilter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    الكل ({cloudRequests.length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      requestFilter === 'pending' ? 'bg-white dark:bg-slate-900 text-amber-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    معلق ({cloudRequests.filter(r => r.status === 'pending').length})
                  </button>
                  <button
                    onClick={() => setRequestFilter('approved')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                      requestFilter === 'approved' ? 'bg-white dark:bg-slate-900 text-emerald-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    مصروف ({cloudRequests.filter(r => r.status === 'approved').length})
                  </button>
                </div>

                <button
                  onClick={loadRequests}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  title="تحديث الطلبات"
                >
                  <RefreshCw size={15} className={requestsLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Requests Table / Cards */}
            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Coins size={36} className="mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="font-bold text-sm">لا توجد طلبات سحب في هذا القسم</p>
                  <p className="text-xs text-slate-500">طلبات السحب المقدمة عبر بوابة الموكل الإلكترونية تظهر هنا فوراً.</p>
                </div>
              ) : (
                filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {req.partnerName || 'موكل'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-500">
                          {req.status === 'pending' ? 'بانتظار الصرف' : req.status === 'approved' ? 'تم الصرف بنجاح' : 'مرفوض'}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-xs text-slate-400 font-mono">
                          {req.id}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        طريقة الاستلام: <span className="font-bold">{req.payoutMethod || 'إنستاباي / محفظة'}</span> - {req.payoutAccount || 'غير محدد'}
                      </p>
                      {req.notes && (
                        <p className="text-[11px] text-slate-500 italic">
                          ملاحظات: {req.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 self-end md:self-auto">
                      <div className="text-left font-mono tabular-nums">
                        <span className="text-lg font-black text-slate-900 dark:text-white">
                          {(req.amount || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500 mr-1 font-sans font-bold">ج.م</span>
                      </div>

                      {req.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedRequestForApproval(req);
                              setSelectedTreasuryAccountId(treasury?.accounts?.[0]?.id || '');
                            }}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Check size={14} />
                            <span>صرف من الخزينة</span>
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req)}
                            className="px-3 py-2 bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            رفض
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AGENCY POLICIES & 7-DAY HOLDING CONTROLS */}
      {currentTab === 'policies' && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Settings2 className="text-emerald-500" size={20} />
                <span>سياسات وقواعد الوكالة وفترة الأمان والتحويل الدوري</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                حدد بدقة القواعد العامة التي تحكم علاقة الوكالة بجميع الموكلين، بما فيها فترة تعليق أرباح الأوردرات بعد التسوية، يوم التحويل الأسبوعي، والحدود النقدية.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* 0. Global Payout Strategy */}
              <div className="md:col-span-2 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3">
                <label className="text-xs font-black text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <Coins size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span>استراتيجية الوكالة العامة لصرف وتأجيل أرباح الموكلين:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGlobalPayoutStrategy('rolling_hold')}
                    className={`p-3 rounded-xl border text-right font-bold text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                      globalPayoutStrategy === 'rolling_hold'
                        ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-xs ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-black text-xs">1. تعليق متدحرج (بالأيام) ⏳</span>
                    <span className="text-[10px] text-slate-500 leading-tight">تعليق كل أوردر لمدة X يوم من تاريخ تسويته المباشر.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGlobalPayoutStrategy('batch_weekly')}
                    className={`p-3 rounded-xl border text-right font-bold text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                      globalPayoutStrategy === 'batch_weekly'
                        ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-xs ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-black text-xs">2. تجميع أسبوعي كامل 📅</span>
                    <span className="text-[10px] text-slate-500 leading-tight">أوردرات الأسبوع بالكامل تُتاح في يوم التحويل القادم.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGlobalPayoutStrategy('manual_request')}
                    className={`p-3 rounded-xl border text-right font-bold text-xs transition-all flex flex-col gap-1 cursor-pointer ${
                      globalPayoutStrategy === 'manual_request'
                        ? 'bg-white dark:bg-slate-900 border-emerald-500 shadow-xs ring-1 ring-emerald-500 text-emerald-900 dark:text-emerald-200'
                        : 'bg-white/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="font-black text-xs">3. سحب يدوي حر (بدون تعليق) 🔓</span>
                    <span className="text-[10px] text-slate-500 leading-tight">الأرباح متاحة فوراً والموكل يرسل طلب سحب.</span>
                  </button>
                </div>
              </div>

              {/* 1. Holding Days Duration (7 Days Default) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Clock size={15} className="text-amber-500" />
                  <span>مدة تعليق أرباح الأوردر بعد التسوية المالية (فترة الأمان)</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={globalHoldingDays}
                    onChange={(e) => setGlobalHoldingDays(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-24 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold font-mono tabular-nums text-center text-sm"
                  />
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">أيام بعد تاريخ التسوية</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  القيمة الافتراضية الموصى بها هي <strong>7 أيام</strong> لضمان استقرار الشحنات وعدم وجود مرتجعات أو شكاوى عملاء قبل إتاحة الأرباح في رصيد الموكل القابل للسحب.
                </p>
              </div>

              {/* 2. Weekly Payout Day */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Calendar size={15} className="text-indigo-500" />
                  <span>يوم التحويل الأسبوعي لجميع الموكلين</span>
                </label>
                <select
                  value={globalWeeklyPayoutDay}
                  onChange={(e) => setGlobalWeeklyPayoutDay(parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs"
                >
                  {dayNames.map((day, idx) => (
                    <option key={idx} value={idx}>
                      كل يوم {day}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  اليوم الذي يجمع فيه النظام مستحقات الموكلين الجاهزة (التي انقضت فترة تعليقها) لتحويلها أسبوعياً.
                </p>
              </div>

              {/* 3. Weekly Payout Mode */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <ShieldCheck size={15} className="text-emerald-500" />
                  <span>طريقة صرف التحويل الأسبوعي</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGlobalWeeklyPayoutMode('admin_confirm')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      globalWeeklyPayoutMode === 'admin_confirm'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    بتأكيد الإدارة (1-Click)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalWeeklyPayoutMode('auto')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                      globalWeeklyPayoutMode === 'auto'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    تحويل آلي مباشر
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  نظام "بتأكيد الإدارة" يتيح مراجعة كشف الصرف قبل تفريغ الخزينة بضغطة زر واحدة.
                </p>
              </div>

              {/* 4. Min & Max Payout Thresholds */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <DollarSign size={15} className="text-teal-500" />
                  <span>حدود السحبة الأسبوعية (الحد الأدنى والأقصى)</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">الحد الأدنى (ج.م)</span>
                    <input
                      type="number"
                      value={globalMinPayout}
                      onChange={(e) => setGlobalMinPayout(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono tabular-nums text-xs font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">الحد الأقصى (ج.م)</span>
                    <input
                      type="number"
                      value={globalMaxPayout}
                      onChange={(e) => setGlobalMaxPayout(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono tabular-nums text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={handleSaveGlobalPolicies}
                disabled={isSavingPolicies}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSavingPolicies ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                <span>حفظ وتطبيق سياسات الوكالة</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* TAB 5: CLIENT PORTAL LIVE LAUNCHER */}
      {currentTab === 'portal' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="text-teal-500" size={18} />
                <span>معاينة بوابة الموكل الإلكترونية الحية</span>
              </h3>
              <p className="text-xs text-slate-500">
                هذه هي الواجهة المستقلة المخصصة لأصحاب البضائع لمتابعة أرباحهم، طلباتهم، وحساباتهم دون الحاجة للدخول للوحة الإدارة.
              </p>
            </div>
            <Link
              to={`/store/${activeStoreId}/merchant-portal`}
              target="_blank"
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shrink-0 transition-colors"
            >
              <span>فتح البوابة في نافذة كاملة</span>
              <ExternalLink size={13} />
            </Link>
          </div>

          <MerchantPortal
            allStoresData={allStoresData}
            updateSettings={updateSettings}
            showToast={(msg, type) => inAppToast(msg, type)}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. DIRECT PAYOUT MODAL FROM TREASURY                     */}
      {/* ======================================================== */}
      {selectedRequestForApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="text-emerald-500" size={20} />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  اعتماد صرف طلب السحب من الخزينة
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequestForApproval(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">الموكل:</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedRequestForApproval.partnerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">مبلغ السحب المطلوب:</span>
                <span className="font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 text-sm">
                  {selectedRequestForApproval.amount?.toLocaleString()} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">طريقة التحويل والحساب:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {selectedRequestForApproval.payoutMethod || 'إنستاباي'}: {selectedRequestForApproval.payoutAccount}
                </span>
              </div>
            </div>

            {/* Treasury Account Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                اختر وعاء الصرف من الخزينة:
              </label>
              <select
                value={selectedTreasuryAccountId}
                onChange={(e) => setSelectedTreasuryAccountId(e.target.value)}
                className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs"
              >
                {(treasury?.accounts || []).map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (الرصيد: {acc.balance.toLocaleString()} ج.م)
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRequestForApproval(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isApproving}
                onClick={handleApproveRequestWithTreasury}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isApproving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                <span>تأكيد الصرف وتفريغ الخزينة</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AgencyHubPage;
