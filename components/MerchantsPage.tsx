import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as db from '../services/databaseService';
import { Link, useParams } from 'react-router-dom';
import {
  Settings,
  Order,
  Wallet,
  Treasury,
  MerchantTransaction,
  SelfServicePlanId,
  DedicatedManagerPlanId,
  BillingCycleType,
  MerchantSubscriptionConfig,
  MerchantManagerConfig,
  MerchantPlanChangeRequest,
  MerchantPlanCycleRecord
} from '../types';
import { 
  Handshake, Plus, Search, Filter, ArrowUpRight, ArrowDownLeft, 
  Trash2, Wallet as WalletIcon, TrendingUp, PieChart, History, 
  Activity, Info, AlertCircle, Package as PackageIcon, Truck, 
  Coins, Calculator, Sparkles, Building2, Eye, ExternalLink,
  Mail, Phone, MessageSquare, Share2, Copy, CheckCircle2, Users2,
  Crown, UserCheck, Settings2, PlusCircle, X, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip as ReTooltip, BarChart, Bar, Legend, Cell
} from 'recharts';
import { generateSafeId } from '../utils/idUtils';
import {
  SELF_SERVICE_PLANS,
  DEDICATED_MANAGER_PLANS,
  BILLING_CYCLES,
  computeSelfServicePlanPricing
} from '../utils/merchantSubscriptions';
import { safeIsoDate } from '../utils/orderQuotaPolicy';

interface MerchantsPageProps {
  settings: Settings;
  updateSettings: (newSettings: Settings) => void;
  wallet: Wallet;
  setWallet: React.Dispatch<React.SetStateAction<Wallet>>;
  orders: Order[];
  treasury?: Treasury;
  setTreasury?: (updater: any) => void;
  embedded?: boolean;
}

const normalizeName = (name: string): string => {
  if (!name) return '';
  let normalized = name.trim().replace(/\s+/g, ' ');
  normalized = normalized.replace(/\s*\((موكل|مورد|صاحب بضاعة|تاجر|partner|employee|admin)\)/gi, '');
  return normalized
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .trim();
};

const MerchantsPage: React.FC<MerchantsPageProps> = ({ 
  settings, 
  updateSettings, 
  wallet, 
  setWallet, 
  orders, 
  treasury, 
  setTreasury,
  embedded = false 
}) => {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<'overview' | 'merchants_list' | 'requests' | 'analytics'>(embedded ? 'merchants_list' : 'overview');
  const [cloudRequests, setCloudRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Admin Modals State: Wallet Top-Up & Plan/Manager Configuration
  const [topUpModalMerchant, setTopUpModalMerchant] = useState<any | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [topUpNotes, setTopUpNotes] = useState<string>('شحن محفظة التاجر من الإدارة');

  const [planModalMerchant, setPlanModalMerchant] = useState<any | null>(null);
  const [adminPlanMode, setAdminPlanMode] = useState<'self_service' | 'manager'>('self_service');
  const [adminSelfPlanId, setAdminSelfPlanId] = useState<SelfServicePlanId>('free');
  const [adminBillingCycle, setAdminBillingCycle] = useState<BillingCycleType>('monthly');
  const [adminManagerPlanId, setAdminManagerPlanId] = useState<DedicatedManagerPlanId>('per_order_20');
  const [adminCustomOrderFee, setAdminCustomOrderFee] = useState<number>(20);
  const [adminCustomOrderQuota, setAdminCustomOrderQuota] = useState<number>(100);
  const [adminCustomPrepaid, setAdminCustomPrepaid] = useState<boolean>(false);
  const [adminDeductFromWallet, setAdminDeductFromWallet] = useState<boolean>(true);
  const [adminHoldingDays, setAdminHoldingDays] = useState<number>(7);
  const [adminMinWeeklyPayout, setAdminMinWeeklyPayout] = useState<number>(100);
  const [adminMaxWeeklyPayout, setAdminMaxWeeklyPayout] = useState<number>(50000);
  const [adminWeeklyPayoutMode, setAdminWeeklyPayoutMode] = useState<'auto' | 'admin_confirm'>('admin_confirm');
  const [adminWeeklyPayoutDay, setAdminWeeklyPayoutDay] = useState<number>(1);
  const [adminPayoutFrequency, setAdminPayoutFrequency] = useState<'weekly' | 'daily'>('weekly');
  const [adminWeeklyTransferFee, setAdminWeeklyTransferFee] = useState<number>(25);
  const [adminWeeklyTransferFeeType, setAdminWeeklyTransferFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [adminDailyTransferFee, setAdminDailyTransferFee] = useState<number>(1);
  const [adminDailyTransferFeeType, setAdminDailyTransferFeeType] = useState<'fixed' | 'percentage'>('percentage');
  const [customQuoteFeeMap, setCustomQuoteFeeMap] = useState<Record<string, number>>({});

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({message, type});
      setTimeout(() => setToast(null), 3500);
  };

  const loadCloudRequests = useCallback(async () => {
    if (!storeId) return;
    try {
      const reqs = await db.getMerchantRequests(storeId);
      setCloudRequests(reqs);
    } catch (_) {}
  }, [storeId]);

  useEffect(() => {
    loadCloudRequests();
    const interval = setInterval(loadCloudRequests, 10000);
    return () => clearInterval(interval);
  }, [loadCloudRequests]);

  const merchants = useMemo(() => {
    const supplierList = Array.isArray(settings.suppliers) ? settings.suppliers : Object.values(settings.suppliers || {});
    const partnerList = Array.isArray(settings.partners) ? settings.partners : Object.values(settings.partners || {});

    const relevantPartners = partnerList.filter((p: any) => 
      p.role?.toLowerCase().includes('merchant') || 
      p.role?.includes('موكل') || 
      p.role?.includes('مورد') ||
      p.isMerchant === true
    );

    const combined = [...supplierList, ...relevantPartners];
    
    // De-duplicate by ID or normalized name
    const map = new Map<string, any>();
    combined.forEach((m: any) => {
      const key = (m.id || normalizeName(m.name || '')).toLowerCase();
      if (!map.has(key)) {
        map.set(key, m);
      } else {
        // Merge data if duplicate (keep the one with more fields)
        const existing = map.get(key);
        if (existing && typeof existing === 'object' && typeof m === 'object') {
          map.set(key, { ...existing, ...m });
        }
      }
    });

    const list = Array.from(map.values());
    if (!searchQuery) return list;
    const q = normalizeName(searchQuery);
    return list.filter(m => normalizeName(m.name).includes(q) || (m.email && m.email.toLowerCase().includes(q.toLowerCase())));
  }, [settings.suppliers, settings.partners, searchQuery]);

  const merchantRequests = useMemo(() => {
    const supplierIds = new Set(Object.values(settings.suppliers || {}).map((s: any) => String(s.id || '').toLowerCase()));
    const supplierNames = new Set(Object.values(settings.suppliers || {}).map((s: any) => normalizeName(s.name || '')));
    return cloudRequests.filter((r: any) => {
      const rPid = String(r.partnerId || '').toLowerCase();
      const rPName = normalizeName(r.partnerName || '');
      const isMerchant =
        r.id?.startsWith('REQ-M-') ||
        r.isMerchantRequest === true ||
        r.type === 'subscription_refund' ||
        r.type === 'wallet_topup' ||
        r.type === 'plan_change_request' ||
        r.type === 'custom_plan_quote' ||
        (r.typeArabic && r.typeArabic.includes('الموكل')) ||
        (r.partnerId && (r.partnerId.startsWith('m_') || r.partnerId.startsWith('sup_') || supplierIds.has(rPid))) ||
        (rPName && supplierNames.has(rPName));
      return isMerchant;
    }).sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [cloudRequests, settings.suppliers]);

  const pendingRequestsCount = useMemo(() => merchantRequests.filter((r: any) => r.status === 'pending').length, [merchantRequests]);

  const stats = useMemo(() => {
    const totalBalance = merchants.reduce((sum, m) => sum + (m.balance || 0), 0);
    const totalSettlements = (settings.merchantSettlements || [])
      .filter(s => s.status === 'paid' && !s.reversedAt)
      .reduce((sum, s) => sum + (s.netPayoutToMerchant || 0), 0);
    const activeMerchants = merchants.filter(m => (m.balance || 0) !== 0).length;
    
    return {
      totalBalance,
      totalSettlements,
      activeMerchants,
      count: merchants.length
    };
  }, [merchants, settings.merchantSettlements]);

  const topMerchantsChartData = useMemo(
    () => [...merchants].sort((a, b) => (b.balance || 0) - (a.balance || 0)).slice(0, 5),
    [merchants]
  );

  // Helper to sync both suppliers and partners in settings & cloud
  const syncMerchantUpdates = async (
    targetMerchantId: string,
    targetMerchantName: string,
    updater: (m: any) => any,
    newTx?: MerchantTransaction,
    logAction?: { action: string; details: string }
  ) => {
    const normTarget = normalizeName(targetMerchantName || '');
    const supplierList = Array.isArray(settings.suppliers)
      ? [...settings.suppliers]
      : (Object.values(settings.suppliers || {}) as any[]);
    const partnerList = Array.isArray(settings.partners)
      ? [...settings.partners]
      : (Object.values(settings.partners || {}) as any[]);

    let foundInSuppliers = false;
    const updatedSuppliers = supplierList.map(m => {
      if (m.id === targetMerchantId || (normTarget && normalizeName(m.name || '') === normTarget)) {
        foundInSuppliers = true;
        return updater(m);
      }
      return m;
    });

    let foundInPartners = false;
    const updatedPartners = partnerList.map(p => {
      if (p.id === targetMerchantId || (normTarget && normalizeName(p.name || '') === normTarget)) {
        foundInPartners = true;
        return updater(p);
      }
      return p;
    });

    // Bidirectional sync: If found in partners but not in suppliers, create/mirror in suppliers
    if (!foundInSuppliers) {
      const partnerObj = partnerList.find(p => p.id === targetMerchantId || (normTarget && normalizeName(p.name || '') === normTarget));
      if (partnerObj) {
        const mirroredSupplier = updater({
          ...partnerObj,
          id: targetMerchantId || partnerObj.id,
          name: targetMerchantName || partnerObj.name,
          phone: partnerObj.phone || '',
          balance: partnerObj.balance || 0
        });
        updatedSuppliers.push(mirroredSupplier);
      }
    }

    // Bidirectional sync: If found in suppliers but not in partners, create/mirror in partners
    if (!foundInPartners) {
      const supplierObj = supplierList.find(s => s.id === targetMerchantId || (normTarget && normalizeName(s.name || '') === normTarget));
      if (supplierObj) {
        const mirroredPartner = updater({
          ...supplierObj,
          id: targetMerchantId || supplierObj.id,
          name: targetMerchantName || supplierObj.name,
          role: 'موكل / مورد',
          isMerchant: true,
          balance: supplierObj.balance || 0
        });
        updatedPartners.push(mirroredPartner);
      }
    }

    const updatedSettings = {
      ...settings,
      suppliers: updatedSuppliers,
      partners: updatedPartners,
      ...(newTx ? { merchantTransactions: [newTx, ...(settings.merchantTransactions || [])] } : {}),
      ...(logAction
        ? {
            activityLogs: [
              {
                id: generateSafeId('log'),
                user: 'الإدارة',
                action: logAction.action,
                details: logAction.details,
                date: new Date().toISOString(),
                timestamp: Date.now()
              },
              ...(settings.activityLogs || [])
            ]
          }
        : {})
    };

    updateSettings(updatedSettings);
    if (storeId) {
      await db.updatePartnerSettings(storeId, updatedPartners, updatedSuppliers).catch(() => {});
    }
  };

  // Helper to archive a merchant's current active plan cycle before switching plans
  const archiveCurrentPlanCycle = (m: any, reason: MerchantPlanCycleRecord['endReason'] = 'switched_mode'): MerchantPlanCycleRecord[] => {
    const history: MerchantPlanCycleRecord[] = Array.isArray(m.planCyclesHistory) ? [...m.planCyclesHistory] : [];
    const nowIso = new Date().toISOString();
    if (m.managerPlan && m.managerPlan.planId && m.managerPlan.planId !== 'none' && m.managerPlan.status === 'active') {
      history.unshift({
        cycleId: m.managerPlan.cycleId || `CYC-MGR-OLD-${Date.now()}`,
        mode: 'manager',
        planId: m.managerPlan.planId,
        planNameAr: m.managerPlan.planNameAr || m.managerPlan.planName || 'باقة المدير المخصص',
        orderFee: Number(m.managerPlan.customOrderFee ?? m.managerPlan.orderFee ?? 20),
        quotaOrders: Number(m.managerPlan.customOrderQuota ?? m.managerPlan.customOrdersTarget ?? 0),
        usedOrders: Number(m.managerPlan.usedOrdersInCycle || 0),
        paidAmount: Number(m.managerPlan.totalPrepaidAmount ?? m.managerPlan.totalPaidAmount ?? 0),
        activatedAt: m.managerPlan.activatedAt || m.managerPlan.startDate || nowIso,
        endedAt: nowIso,
        endReason: reason
      });
    } else if (m.subscriptionPlan && m.subscriptionPlan.status === 'active') {
      history.unshift({
        cycleId: m.subscriptionPlan.cycleId || `CYC-SELF-OLD-${Date.now()}`,
        mode: 'self_service',
        planId: m.subscriptionPlan.planId,
        planNameAr: m.subscriptionPlan.planNameAr || m.subscriptionPlan.planName || 'باقة العمل بنفسه',
        billingCycle: m.subscriptionPlan.billingCycle,
        quotaOrders: Number(m.subscriptionPlan.monthlyOrderLimit ?? m.subscriptionPlan.ordersLimit ?? 0),
        usedOrders: 0,
        paidAmount: Number(m.subscriptionPlan.paidAmount ?? m.subscriptionPlan.totalPaidAmount ?? 0),
        activatedAt: m.subscriptionPlan.activatedAt || m.subscriptionPlan.startDate || nowIso,
        endedAt: nowIso,
        endReason: reason
      });
    }
    return history;
  };

  // Send Custom Manager Pricing Quote to Merchant (so Merchant approves & activates from wallet)
  const handleSendCustomQuoteToMerchant = async (req: any, customFeeInput?: number) => {
    const quotedFee = Math.max(1, Number(customFeeInput ?? customQuoteFeeMap[req.id] ?? 20));
    const supplierId = req.partnerId;
    const normReqName = normalizeName(req.partnerName || '');
    const supplierList = Array.isArray(settings.suppliers)
      ? settings.suppliers
      : (Object.values(settings.suppliers || {}) as any[]);
    const supplier = supplierList.find(m => m.id === supplierId || (normReqName && normalizeName(m.name || '') === normReqName));

    if (!storeId || !supplier) {
      showToast('تعذر العثور على الموكل المرتبط بطلب التسعير', 'error');
      return;
    }

    await db.updateMerchantRequestStatus(req.id, storeId, 'approved');
    setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

    const baseReqMeta: MerchantPlanChangeRequest = req.planRequestMeta || supplier.pendingPlanRequest || {
      id: req.id || `PLAN-REQ-${Date.now()}`,
      requestedAt: req.createdAt || new Date().toISOString(),
      targetMode: 'manager',
      targetPlanId: 'custom_manager',
      targetPlanNameAr: 'باقة المدير المخصصة',
      requestedCustomQuota: 500,
      requestedOrdersTarget: 500,
      requestedCustomBillingPreference: 'per_order',
      requestedPrepaidQuota: false,
      status: 'quoted_waiting_merchant'
    };

    const targetOrders = Number(
      baseReqMeta.requestedCustomQuota ||
        baseReqMeta.requestedOrdersTarget ||
        baseReqMeta.ordersLimit ||
        500
    );
    const isPrepaid = Boolean(
      baseReqMeta.requestedPrepaidQuota ??
        (baseReqMeta.requestedCustomBillingPreference === 'prepaid_quota')
    );

    const updatedPendingQuote: MerchantPlanChangeRequest = {
      ...baseReqMeta,
      status: 'quoted_waiting_merchant',
      quotedOrderFee: quotedFee,
      quotedOrdersTarget: targetOrders,
      requestedCustomQuota: targetOrders,
      requestedOrdersTarget: targetOrders,
      requestedPrepaidQuota: isPrepaid,
      requestedCustomBillingPreference: isPrepaid ? 'prepaid_quota' : 'per_order',
      quotedTotalUpfront: isPrepaid ? Number((quotedFee * targetOrders).toFixed(2)) : 0,
      quotedAt: new Date().toISOString(),
      adminNotes: `تم تحديد سعر الأوردر المخصص بـ ${quotedFee} ج.م من الإدارة (${isPrepaid ? 'دفع مسبق للحصة' : 'خصم مع كل أوردر بدون رصيد مقدم'}) — بانتظار موافقة الموكل`
    };

    await syncMerchantUpdates(
      supplier.id,
      supplier.name,
      (m) => ({
        ...m,
        pendingPlanRequest: updatedPendingQuote
      }),
      undefined,
      {
        action: 'إرسال عرض تسعير باقة مدير مخصصة للموكل',
        details: `تم تحديد سعر ${quotedFee} ج.م لكل أوردر للموكل ${supplier.name} وبانتظار موافقته للتفعيل`
      }
    );

    showToast(`تم إرسال عرض السعر (${quotedFee} ج.م / أوردر) إلى ${supplier.name} بنجاح`);
  };

  // Directly Activate Custom Manager Quote for Merchant (0 EGP required when per-order)
  const handleDirectActivateCustomQuote = async (req: any, customFeeInput?: number) => {
    const quotedFee = Math.max(1, Number(customFeeInput ?? customQuoteFeeMap[req.id] ?? 20));
    const supplierId = req.partnerId;
    const normReqName = normalizeName(req.partnerName || '');
    const supplierList = Array.isArray(settings.suppliers)
      ? settings.suppliers
      : (Object.values(settings.suppliers || {}) as any[]);
    const supplier = supplierList.find(m => m.id === supplierId || (normReqName && normalizeName(m.name || '') === normReqName));

    if (!storeId || !supplier) {
      showToast('تعذر العثور على الموكل المرتبط بطلب التسعير', 'error');
      return;
    }

    const baseReqMeta: MerchantPlanChangeRequest | undefined = req.planRequestMeta || supplier.pendingPlanRequest;
    const targetOrders = Number(
      baseReqMeta?.requestedCustomQuota ||
        baseReqMeta?.requestedOrdersTarget ||
        baseReqMeta?.ordersLimit ||
        500
    );
    const isPrepaid = Boolean(
      baseReqMeta?.requestedPrepaidQuota ??
        (baseReqMeta?.requestedCustomBillingPreference === 'prepaid_quota')
    );
    const isQuotaIncrease = Boolean(
      supplier.managerPlan?.enabled &&
      supplier.managerPlan?.status === 'active' &&
      supplier.managerPlan?.planId === 'custom_manager'
    );
    const oldQuota = Number(supplier.managerPlan?.customOrderQuota || supplier.managerPlan?.customOrdersTarget || 0);
    const incrementalOrders = isQuotaIncrease ? Math.max(0, targetOrders - oldQuota) : targetOrders;
    const upfrontCharge = isPrepaid ? Number((quotedFee * incrementalOrders).toFixed(2)) : 0;
    const currentBal = Number(supplier.balance || 0);

    if (isPrepaid && upfrontCharge > currentBal) {
      showToast(`رصيد محفظة الموكل (${currentBal.toLocaleString()} ج.م) غير كافٍ للدفع المقدم (${upfrontCharge.toLocaleString()} ج.م). اشحن المحفظة أو أرسل عرض السعر للموكل.`, 'error');
      return;
    }

    await db.updateMerchantRequestStatus(req.id, storeId, 'approved');
    setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

    const nowIso = new Date().toISOString();
    const expIso = new Date(Date.now() + 30 * 86400000).toISOString();
    const activeCycleId = (isQuotaIncrease && supplier.managerPlan?.cycleId) ? supplier.managerPlan.cycleId : `CYC-MGR-CUSTOM-${Date.now()}`;
    const nextBalance = Number((currentBal - upfrontCharge).toFixed(2));

    const nextSubscriptionPlan: MerchantSubscriptionConfig = {
      planId: 'free',
      planName: 'None',
      planNameAr: 'موقوفة (يعمل بنظام المدير المخصص)',
      cycleId: activeCycleId,
      billingCycle: 'monthly',
      monthlyPrice: 0,
      totalPaidAmount: 0,
      pricePerMonth: 0,
      paidAmount: 0,
      ordersLimit: 0,
      monthlyOrderLimit: 0,
      unlimitedOrders: false,
      startDate: nowIso,
      endDate: expIso,
      activatedAt: (isQuotaIncrease && supplier.managerPlan?.activatedAt) ? supplier.managerPlan.activatedAt : nowIso,
      expiresAt: expIso,
      status: 'cancelled'
    };

    const nextManagerPlan: MerchantManagerConfig = {
      ...(isQuotaIncrease && supplier.managerPlan ? supplier.managerPlan : {}),
      enabled: true,
      planId: 'custom_manager',
      planName: `باقة المدير المخصصة (${quotedFee} ج.م / أوردر)`,
      planNameAr: `باقة المدير المخصصة (${quotedFee} ج.م / أوردر)`,
      cycleId: activeCycleId,
      billingCycle: 'monthly',
      orderFee: quotedFee,
      customOrderFee: quotedFee,
      customOrdersTarget: targetOrders,
      customOrderQuota: targetOrders,
      customPrepaidQuota: isPrepaid,
      monthlyFee: isPrepaid ? upfrontCharge : 0,
      totalPaidAmount: ((supplier.managerPlan?.totalPaidAmount || 0) + upfrontCharge),
      totalPrepaidAmount: ((supplier.managerPlan?.totalPrepaidAmount || 0) + upfrontCharge),
      usedOrdersInCycle: isQuotaIncrease ? (supplier.managerPlan?.usedOrdersInCycle || 0) : 0,
      startDate: (isQuotaIncrease && supplier.managerPlan?.startDate) ? supplier.managerPlan.startDate : nowIso,
      endDate: expIso,
      activatedAt: (isQuotaIncrease && supplier.managerPlan?.activatedAt) ? supplier.managerPlan.activatedAt : nowIso,
      expiresAt: expIso,
      status: 'active',
      notes: isQuotaIncrease
        ? `تمت زيادة كوتة الأوردرات من (${oldQuota}) إلى (${targetOrders}) أوردر مع الحفاظ على الأوردرات المنفذة سابقاً`
        : `تم تفعيل التسعير المخصص (${quotedFee} ج.م لكل أوردر — ${isPrepaid ? 'دفع مسبق' : 'خصم تلقائي مع كل أوردر'})`
    };

    const newTx: MerchantTransaction | undefined = upfrontCharge > 0 ? {
      id: generateSafeId('mtx'),
      merchantId: supplier.id,
      merchantName: supplier.name,
      type: 'subscription_charge',
      amount: -upfrontCharge,
      date: nowIso,
      notes: isQuotaIncrease
        ? `ترقية وزيادة كوتة باقة المدير المخصص (+${incrementalOrders} أوردر إضافي بسعر ${quotedFee} ج.م/أوردر)`
        : `تفعيل باقة المدير المخصصة (${quotedFee} ج.م/أوردر - ${targetOrders} أوردر)`,
      balanceAfter: nextBalance
    } : undefined;

    await syncMerchantUpdates(
      supplier.id,
      supplier.name,
      (m) => ({
        ...m,
        subscriptionPlan: nextSubscriptionPlan,
        managerPlan: nextManagerPlan,
        pendingPlanRequest: null,
        planCyclesHistory: isQuotaIncrease ? (m.planCyclesHistory || []) : archiveCurrentPlanCycle(m, 'switched_mode'),
        ...(upfrontCharge > 0 ? { balance: nextBalance } : {}),
        ...(newTx ? { transactions: [newTx, ...(m.transactions || [])] } : {})
      }),
      newTx,
      {
        action: isQuotaIncrease ? 'ترقية وزيادة كوتة باقة المدير المخصص' : 'تفعيل باقة مدير مخصصة بتسعير لكل أوردر',
        details: `${supplier.name}: ${quotedFee} ج.م لكل أوردر (${targetOrders} أوردر إجمالي)`
      }
    );

    showToast(`تم ${isQuotaIncrease ? 'زيادة كوتة' : 'تفعيل'} الباقة المخصصة للموكل ${supplier.name} (${targetOrders} أوردر) بنجاح ✅`);
  };

  // Approve Standard Governed Plan Change Request
  const handleApprovePlanChangeRequest = async (req: any) => {
    const supplierId = req.partnerId;
    const normReqName = normalizeName(req.partnerName || '');
    const supplierList = Array.isArray(settings.suppliers)
      ? settings.suppliers
      : (Object.values(settings.suppliers || {}) as any[]);
    const supplier = supplierList.find(m => m.id === supplierId || (normReqName && normalizeName(m.name || '') === normReqName));

    if (!storeId || !supplier) {
      showToast('تعذر العثور على الموكل المرتبط بالطلب', 'error');
      return;
    }

    const meta: MerchantPlanChangeRequest | undefined = req.planRequestMeta || supplier.pendingPlanRequest;
    const chargeAmt = Math.max(0, Number(meta?.calculatedAmount ?? req.amount ?? 0));
    const currentBalance = Number(supplier.balance || 0);

    if (chargeAmt > currentBalance) {
      showToast(`رصيد محفظة الموكل (${currentBalance.toLocaleString()} ج.م) أقل من تكلفة الباقة (${chargeAmt.toLocaleString()} ج.م). اشحن المحفظة أولاً.`, 'error');
      return;
    }

    await db.updateMerchantRequestStatus(req.id, storeId, 'approved');
    setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

    const nowIso = new Date().toISOString();
    const billingCycle: BillingCycleType = meta?.billingCycle || 'monthly';
    const cycleObj = BILLING_CYCLES.find(c => c.id === billingCycle) || BILLING_CYCLES[0];
    const expIso = new Date(Date.now() + (cycleObj.days || 30) * 86400000).toISOString();
    const newCycleId = `CYC-${Date.now()}`;

    const isTargetManager = meta?.targetMode === 'manager';
    const targetPlanId = meta?.targetPlanId || 'free';

    const nextSubscriptionPlan: MerchantSubscriptionConfig = isTargetManager
      ? {
          planId: 'free',
          planName: 'None',
          planNameAr: 'موقوفة (يعمل بنظام المدير المخصص)',
          cycleId: newCycleId,
          billingCycle,
          monthlyPrice: 0,
          totalPaidAmount: 0,
          pricePerMonth: 0,
          paidAmount: 0,
          ordersLimit: 0,
          monthlyOrderLimit: 0,
          unlimitedOrders: false,
          startDate: nowIso,
          endDate: expIso,
          activatedAt: nowIso,
          expiresAt: expIso,
          status: 'cancelled'
        }
      : (() => {
          const selfDef = SELF_SERVICE_PLANS.find(p => p.id === targetPlanId) || SELF_SERVICE_PLANS[0];
          const pricing = computeSelfServicePlanPricing(selfDef.id, billingCycle);
          return {
            planId: selfDef.id,
            planName: selfDef.nameEn,
            planNameAr: selfDef.nameAr,
            cycleId: newCycleId,
            billingCycle,
            monthlyPrice: pricing.discountedMonthlyPrice,
            totalPaidAmount: chargeAmt,
            pricePerMonth: pricing.discountedMonthlyPrice,
            paidAmount: chargeAmt,
            ordersLimit: pricing.totalOrdersQuota,
            monthlyOrderLimit: pricing.totalOrdersQuota,
            unlimitedOrders: selfDef.unlimitedOrders,
            startDate: nowIso,
            endDate: expIso,
            activatedAt: nowIso,
            expiresAt: expIso,
            status: 'active'
          };
        })();

    const nextManagerPlan: MerchantManagerConfig = isTargetManager
      ? {
          enabled: true,
          planId: targetPlanId as DedicatedManagerPlanId,
          planName: 'Dedicated Manager',
          planNameAr: meta?.targetPlanNameAr || 'باقة المدير المخصص',
          cycleId: newCycleId,
          billingCycle,
          orderFee: targetPlanId === 'per_order_20' ? 20 : 0,
          monthlyFee: (targetPlanId === 'monthly_1000' || targetPlanId === 'monthly_700') ? chargeAmt : 0,
          totalPaidAmount: chargeAmt,
          totalPrepaidAmount: chargeAmt,
          includedOrdersQuota: (targetPlanId === 'monthly_1000' || targetPlanId === 'monthly_700') ? 50 : undefined,
          extraOrderFee: (targetPlanId === 'monthly_1000' || targetPlanId === 'monthly_700') ? 20 : undefined,
          usedOrdersInCycle: 0,
          startDate: nowIso,
          endDate: expIso,
          activatedAt: nowIso,
          expiresAt: expIso,
          status: 'active'
        }
      : {
          enabled: false,
          planId: 'none',
          planNameAr: 'بدون مدير مخصص (إدارة ذاتية)',
          orderFee: 0,
          monthlyFee: 0,
          status: 'cancelled'
        };

    const nextBalance = Number((currentBalance - chargeAmt).toFixed(2));
    const newTx: MerchantTransaction | undefined = chargeAmt > 0 ? {
      id: generateSafeId('mtx'),
      merchantId: supplier.id,
      merchantName: supplier.name,
      type: 'subscription_charge',
      amount: -chargeAmt,
      date: nowIso,
      notes: `اعتماد الإدارة لتفعيل (${meta?.targetPlanNameAr || req.payoutAccount}) وأرشفة دورة الأوردرات السابقة`,
      balanceAfter: nextBalance,
      referenceId: req.id
    } : undefined;

    await syncMerchantUpdates(
      supplier.id,
      supplier.name,
      (m) => {
        const nextHistory = archiveCurrentPlanCycle(m, 'upgraded');
        return {
          ...m,
          subscriptionPlan: nextSubscriptionPlan,
          managerPlan: nextManagerPlan,
          pendingPlanRequest: null,
          planCyclesHistory: nextHistory,
          ...(chargeAmt > 0 ? { balance: nextBalance } : {}),
          ...(newTx ? { transactions: [newTx, ...(m.transactions || [])] } : {})
        };
      },
      newTx,
      {
        action: 'اعتماد طلب تغيير باقة موكل',
        details: `تم اعتماد انتقال ${supplier.name} إلى (${meta?.targetPlanNameAr || req.payoutAccount}) مع حفظ تسعير الأوردرات السابقة`
      }
    );

    showToast(`تم اعتماد وتفعيل باقة (${meta?.targetPlanNameAr || req.payoutAccount}) للموكل ${supplier.name} بنجاح`);
  };

  const handleApproveRequest = async (req: any) => {
    const amt = Number(req.amount || 0);
    const supplierId = req.partnerId;
    const normReqName = normalizeName(req.partnerName || '');
    const supplierList = Array.isArray(settings.suppliers)
      ? settings.suppliers
      : Object.values(settings.suppliers || {}) as any[];
    const supplier = supplierList.find(m => m.id === supplierId || (normReqName && normalizeName(m.name || '') === normReqName));

    if (req.status !== 'pending') {
      showToast('تمت معالجة هذا الطلب مسبقاً أو لم يعد معلقاً', 'error');
      return;
    }
    if (!storeId || !Number.isFinite(amt) || amt <= 0) {
      showToast('بيانات الطلب غير مكتملة أو المبلغ غير صالح', 'error');
      return;
    }
    if (!supplier) {
      showToast('فشل العثور على الموكل المرتبط بالطلب', 'error');
      return;
    }

    const isRefundRequest = req.type === 'subscription_refund';
    const isTopUpRequest = req.type === 'wallet_topup';
    const isCreditToWallet = isRefundRequest || isTopUpRequest;

    if (!isCreditToWallet && amt > (supplier.balance || 0)) {
      showToast(
        `رصيد المحفظة المسوّى للموكل (${(supplier.balance || 0).toLocaleString()} ج.م) أقل من مبلغ السحب (${amt.toLocaleString()} ج.م). قم بتسوية الأوردرات المسلمة أولاً من تبويب التسويات أو ارفض الطلب المعلق.`,
        'error'
      );
      return;
    }

    const statusUpdated = await db.updateMerchantRequestStatus(req.id, storeId, 'approved');
    if (!statusUpdated) {
      showToast('تعذر اعتماد الطلب؛ ربما تمت معالجته من شاشة أخرى. حدّث القائمة وحاول مجدداً.', 'error');
      return;
    }
    setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));

    const currentBalance = Number(supplier.balance || 0);
    const newBalance = isCreditToWallet
      ? Number((currentBalance + amt).toFixed(2))
      : Number((currentBalance - amt).toFixed(2));

    const newTx: MerchantTransaction = {
      id: generateSafeId('mtx'),
      merchantId: supplier.id,
      merchantName: supplier.name,
      type: isRefundRequest ? 'subscription_refund' : isTopUpRequest ? 'wallet_topup' : 'withdrawal',
      amount: isCreditToWallet ? amt : -amt,
      date: new Date().toISOString(),
      notes: isRefundRequest
        ? `إيداع استرداد باقة (سياسة 14 يوم) بعد مراجعة الإدارة: ${req.notes || ''}`
        : isTopUpRequest
        ? `اعتماد شحن محفظة التاجر: ${req.notes || ''}`
        : `اعتماد طلب سحب من البوابة: ${req.notes || ''}`,
      balanceAfter: newBalance,
      referenceId: req.id
    };

    await syncMerchantUpdates(
      supplier.id,
      supplier.name,
      (m) => {
        const nextObj: any = {
          ...m,
          balance: newBalance,
          transactions: [newTx, ...(m.transactions || [])]
        };
        if (isRefundRequest) {
          const targetType = req.refundMeta?.targetType;
          if (targetType === 'manager' && m.managerPlan) {
            nextObj.managerPlan = {
              ...m.managerPlan,
              planId: 'none',
              status: 'refunded',
              refundedAmount: amt
            };
          } else if (m.subscriptionPlan) {
            nextObj.subscriptionPlan = {
              ...m.subscriptionPlan,
              planId: 'free',
              ordersLimit: 30,
              status: 'refunded',
              refundedAmount: amt
            };
          }
        }
        return nextObj;
      },
      newTx,
      {
        action: isRefundRequest ? 'اعتماد استرداد باقة (14 يوم)' : isTopUpRequest ? 'اعتماد شحن محفظة موكل' : 'اعتماد طلب سحب موكل',
        details: isCreditToWallet
          ? `تم إيداع ${amt.toLocaleString()} ج.م في محفظة الموكل ${supplier.name}`
          : `تم اعتماد طلب سحب للموكل ${supplier.name} بمبلغ ${amt.toLocaleString()} ج.م`
      }
    );

    showToast(
      isRefundRequest
        ? `تم اعتماد الاسترداد وإيداع ${amt.toLocaleString()} ج.م في محفظة ${supplier.name}`
        : isTopUpRequest
        ? `تم شحن محفظة ${supplier.name} بمبلغ ${amt.toLocaleString()} ج.م بنجاح`
        : `تم اعتماد طلب السحب للموكل ${supplier.name} بنجاح`
    );
  };

  // Direct Admin Wallet Recharge Handler
  const handleAdminDirectTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topUpModalMerchant) return;
    const amt = Number(topUpAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('يرجى إدخال مبلغ شحن صحيح أكبر من صفر', 'error');
      return;
    }

    const currentBalance = Number(topUpModalMerchant.balance || 0);
    const newBalance = Number((currentBalance + amt).toFixed(2));
    const newTx: MerchantTransaction = {
      id: generateSafeId('mtx'),
      merchantId: topUpModalMerchant.id,
      merchantName: topUpModalMerchant.name,
      type: 'wallet_topup',
      amount: amt,
      date: new Date().toISOString(),
      notes: topUpNotes.trim() || 'شحن محفظة التاجر مباشرة من الإدارة',
      balanceAfter: newBalance
    };

    await syncMerchantUpdates(
      topUpModalMerchant.id,
      topUpModalMerchant.name,
      (m) => ({
        ...m,
        balance: newBalance,
        transactions: [newTx, ...(m.transactions || [])]
      }),
      newTx,
      {
        action: 'شحن محفظة موكل من الإدارة',
        details: `تم شحن محفظة ${topUpModalMerchant.name} بمبلغ ${amt.toLocaleString()} ج.م`
      }
    );

    showToast(`تم شحن محفظة ${topUpModalMerchant.name} بمبلغ ${amt.toLocaleString()} ج.م بنجاح`);
    setTopUpModalMerchant(null);
    setTopUpAmount('');
  };

  // Open Admin Plan Editor Modal
  const openAdminPlanEditor = (merchant: any) => {
    setPlanModalMerchant(merchant);
    const hasActiveMgr = Boolean(
      merchant.managerPlan &&
      merchant.managerPlan.planId &&
      merchant.managerPlan.planId !== 'none' &&
      merchant.managerPlan.status === 'active'
    );
    setAdminPlanMode(hasActiveMgr ? 'manager' : 'self_service');
    setAdminSelfPlanId(merchant.subscriptionPlan?.planId || 'free');
    setAdminBillingCycle(merchant.subscriptionPlan?.billingCycle || merchant.managerPlan?.billingCycle || 'monthly');
    setAdminManagerPlanId(
      hasActiveMgr ? merchant.managerPlan.planId : 'per_order_20'
    );
    setAdminCustomOrderFee(Number((merchant.managerPlan as any)?.customOrderFee ?? merchant.managerPlan?.orderFee ?? 20));
    setAdminCustomOrderQuota(Number(merchant.managerPlan?.customOrdersTarget ?? (merchant.managerPlan as any)?.customOrderQuota ?? 100));
    setAdminCustomPrepaid(Boolean(merchant.managerPlan?.customPrepaidQuota));
    setAdminDeductFromWallet(false);
    setAdminHoldingDays(Number(merchant.holdingDaysAfterSettlement ?? 7));
    setAdminMinWeeklyPayout(Number(merchant.minWeeklyPayout ?? 100));
    setAdminMaxWeeklyPayout(Number(merchant.maxWeeklyPayout ?? 50000));
    setAdminWeeklyPayoutMode(merchant.weeklyPayoutMode || 'admin_confirm');
    setAdminWeeklyPayoutDay(typeof merchant.weeklyPayoutDay === 'number' ? merchant.weeklyPayoutDay : 1);
    setAdminPayoutFrequency(merchant.payoutFrequency === 'daily' ? 'daily' : 'weekly');
    setAdminWeeklyTransferFee(typeof merchant.weeklyTransferFee === 'number' ? merchant.weeklyTransferFee : 25);
    setAdminWeeklyTransferFeeType(merchant.weeklyTransferFeeType === 'percentage' ? 'percentage' : 'fixed');
    setAdminDailyTransferFee(typeof merchant.dailyTransferFee === 'number' ? merchant.dailyTransferFee : 1);
    setAdminDailyTransferFeeType(merchant.dailyTransferFeeType === 'fixed' ? 'fixed' : 'percentage');
  };

  // Save Admin Plan & Custom Order Price (Mutually Exclusive: Self-Service OR Dedicated Manager)
  const handleSaveAdminPlanConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planModalMerchant) return;

    const nowIso = new Date().toISOString();
    const selfDef = SELF_SERVICE_PLANS.find(p => p.id === adminSelfPlanId) || SELF_SERVICE_PLANS[0];
    const selfPricing = computeSelfServicePlanPricing(selfDef, adminBillingCycle);
    const durationDays = Number(selfPricing.durationDays || selfPricing.cycle?.days || 30);
    const endIso = new Date(Date.now() + durationDays * 86400000).toISOString();

    const isManagerMode = adminPlanMode === 'manager';
    const effectiveMgrPlanId: DedicatedManagerPlanId = isManagerMode
      ? (adminManagerPlanId === 'none' ? 'per_order_20' : adminManagerPlanId)
      : 'none';

    const nextSubscriptionPlan: MerchantSubscriptionConfig = isManagerMode
      ? {
          planId: 'free',
          planName: 'موقوفة (يعمل بنظام المدير المخصص)',
          billingCycle: adminBillingCycle,
          monthlyPrice: 0,
          totalPaidAmount: 0,
          ordersLimit: 0,
          startDate: nowIso,
          endDate: endIso,
          status: 'inactive'
        }
      : {
          planId: adminSelfPlanId,
          planName: selfDef.nameAr,
          billingCycle: adminBillingCycle,
          monthlyPrice: selfPricing.discountedMonthlyPrice,
          totalPaidAmount: selfPricing.totalCyclePrice,
          ordersLimit: selfPricing.totalOrdersQuota,
          startDate: nowIso,
          endDate: endIso,
          status: 'active'
        };

    const mgrDef = DEDICATED_MANAGER_PLANS.find(m => m.id === effectiveMgrPlanId);
    const mgrPaidAmount = !isManagerMode
      ? 0
      : (effectiveMgrPlanId === 'monthly_1000' || effectiveMgrPlanId === 'monthly_700')
      ? Math.round((effectiveMgrPlanId === 'monthly_1000' ? 1000 : 700) * ((100 - selfPricing.cycle.discountPercent) / 100)) * selfPricing.cycle.months
      : effectiveMgrPlanId === 'custom_manager' && adminCustomPrepaid
      ? Math.max(0, adminCustomOrderFee * adminCustomOrderQuota)
      : 0;

    const isQuotaIncrease = Boolean(
      isManagerMode &&
      effectiveMgrPlanId === 'custom_manager' &&
      planModalMerchant.managerPlan?.planId === 'custom_manager' &&
      planModalMerchant.managerPlan?.status === 'active'
    );

    const nextManagerPlan: MerchantManagerConfig = isManagerMode
      ? {
          ...(isQuotaIncrease && planModalMerchant.managerPlan ? planModalMerchant.managerPlan : {}),
          planId: effectiveMgrPlanId,
          planName: mgrDef?.nameAr || 'باقة المدير المخصص',
          billingCycle: adminBillingCycle,
          orderFee:
            effectiveMgrPlanId === 'per_order_20'
              ? 20
              : effectiveMgrPlanId === 'custom_manager'
              ? adminCustomOrderFee
              : 0,
          customOrderFee: effectiveMgrPlanId === 'custom_manager' ? adminCustomOrderFee : undefined,
          monthlyFee:
            (effectiveMgrPlanId === 'monthly_1000' || effectiveMgrPlanId === 'monthly_700')
              ? Math.round((effectiveMgrPlanId === 'monthly_1000' ? 1000 : 700) * ((100 - selfPricing.cycle.discountPercent) / 100))
              : 0,
          includedOrdersQuota: (effectiveMgrPlanId === 'monthly_1000' || effectiveMgrPlanId === 'monthly_700') ? 50 : undefined,
          extraOrderFee: (effectiveMgrPlanId === 'monthly_1000' || effectiveMgrPlanId === 'monthly_700') ? 20 : undefined,
          totalPaidAmount: isQuotaIncrease ? ((planModalMerchant.managerPlan?.totalPaidAmount || 0) + mgrPaidAmount) : mgrPaidAmount,
          customOrdersTarget: effectiveMgrPlanId === 'custom_manager' ? adminCustomOrderQuota : undefined,
          customOrderQuota: effectiveMgrPlanId === 'custom_manager' ? adminCustomOrderQuota : undefined,
          customPrepaidQuota: effectiveMgrPlanId === 'custom_manager' ? adminCustomPrepaid : undefined,
          usedOrdersInCycle: isQuotaIncrease ? (planModalMerchant.managerPlan?.usedOrdersInCycle || 0) : 0,
          startDate: (isQuotaIncrease && planModalMerchant.managerPlan?.startDate) ? planModalMerchant.managerPlan.startDate : nowIso,
          endDate: endIso,
          activatedAt: (isQuotaIncrease && planModalMerchant.managerPlan?.activatedAt) ? planModalMerchant.managerPlan.activatedAt : nowIso,
          status: 'active'
        }
      : {
          planId: 'none',
          planName: 'بدون مدير مخصص (إدارة ذاتية)',
          billingCycle: adminBillingCycle,
          orderFee: 0,
          monthlyFee: 0,
          totalPaidAmount: 0,
          startDate: nowIso,
          endDate: endIso,
          status: 'inactive'
        };

    const activePlanCost = isManagerMode ? mgrPaidAmount : selfPricing.totalCyclePrice;
    const totalToDeduct = adminDeductFromWallet ? activePlanCost : 0;
    const currentBal = Number(planModalMerchant.balance || 0);
    if (adminDeductFromWallet && totalToDeduct > currentBal) {
      showToast('رصيد محفظة التاجر غير كافٍ للخصم؛ اشحن المحفظة أولاً أو ألغِ خيار الخصم الفوري', 'error');
      return;
    }

    const nextBalance = Number((currentBal - totalToDeduct).toFixed(2));
    const summaryText = isManagerMode
      ? `تفعيل باقة المدير المخصص من الإدارة: (${mgrDef?.nameAr || 'مدير مخصص'}${
          effectiveMgrPlanId === 'custom_manager' ? ` - ${adminCustomOrderFee} ج.م/أوردر` : ''
        })`
      : `تفعيل باقة العمل بنفسه من الإدارة: (${selfDef.nameAr})`;

    const newTx: MerchantTransaction | undefined = totalToDeduct > 0 ? {
      id: generateSafeId('mtx'),
      merchantId: planModalMerchant.id,
      merchantName: planModalMerchant.name,
      type: 'subscription_charge',
      amount: -totalToDeduct,
      date: nowIso,
      notes: summaryText,
      balanceAfter: nextBalance
    } : undefined;

    const newCycleId = (isQuotaIncrease && planModalMerchant.managerPlan?.cycleId) ? planModalMerchant.managerPlan.cycleId : `CYC-ADM-${Date.now()}`;
    nextSubscriptionPlan.cycleId = newCycleId;
    nextManagerPlan.cycleId = newCycleId;
    nextManagerPlan.enabled = isManagerMode;

    await syncMerchantUpdates(
      planModalMerchant.id,
      planModalMerchant.name,
      (m) => ({
        ...m,
        subscriptionPlan: nextSubscriptionPlan,
        managerPlan: nextManagerPlan,
        pendingPlanRequest: null,
        planCyclesHistory: isQuotaIncrease ? (m.planCyclesHistory || []) : archiveCurrentPlanCycle(m, 'switched_mode'),
        holdingDaysAfterSettlement: Math.max(0, Number(adminHoldingDays)),
        minWeeklyPayout: Math.max(0, Number(adminMinWeeklyPayout)),
        maxWeeklyPayout: Math.max(0, Number(adminMaxWeeklyPayout)),
        weeklyPayoutMode: adminWeeklyPayoutMode,
        weeklyPayoutDay: adminWeeklyPayoutDay,
        payoutFrequency: adminPayoutFrequency,
        weeklyTransferFee: Math.max(0, Number(adminWeeklyTransferFee)),
        weeklyTransferFeeType: adminWeeklyTransferFeeType,
        dailyTransferFee: Math.max(0, Number(adminDailyTransferFee)),
        dailyTransferFeeType: adminDailyTransferFeeType,
        ...(totalToDeduct > 0 ? { balance: nextBalance } : {}),
        ...(newTx ? { transactions: [newTx, ...(m.transactions || [])] } : {})
      }),
      newTx,
      {
        action: 'تعديل باقة وإعدادات التحويل الأسبوعي والعمولة لموكل',
        details: `${planModalMerchant.name}: ${summaryText} | نظام السحب: ${adminPayoutFrequency === 'daily' ? 'يومي' : 'أسبوعي'} | فترة التعليق: ${adminHoldingDays} أيام | السحبة: (${adminMinWeeklyPayout} - ${adminMaxWeeklyPayout} ج.م)`
      }
    );

    showToast(`تم حفظ إعدادات الباقة والمدير المخصص لـ ${planModalMerchant.name} بنجاح`);
    setPlanModalMerchant(null);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.4 } }
  };

  return (
    <div className={embedded ? "space-y-6" : "min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-8 space-y-8 pb-24"}>
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 font-black text-xs ${
              toast.type === 'success' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-rose-500 text-white border-rose-400'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {embedded ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="بحث في أسماء الموكلين أو الهواتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSection('merchants_list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'merchants_list' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              قائمة الموكلين ({merchants.length})
            </button>
            <button
              onClick={() => setActiveSection('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeSection === 'analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              التحليلات والمقارنة
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                 <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                    <Handshake size={24} />
                 </div>
                 <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">إدارة محافظ وباقات الموكلين</h1>
                    <p className="text-sm font-bold text-slate-400">نظام تصفية الأمانات، شحن المحافظ، وتخصيص الباقات والمدير المخصص للأوردرات</p>
                 </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <Link
                to={`/store/${storeId || 'default'}/agency-hub`}
                className="px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-700 hover:text-white rounded-2xl text-xs font-black transition-all border border-emerald-500/20 flex items-center gap-2 shrink-0 shadow-sm"
              >
                <Building2 size={16} />
                <span>مركز تحكم الوكالة 🏢</span>
              </Link>
              <div className="relative flex-1 md:w-64">
                 <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input
                   type="text"
                   placeholder="بحث عن موكل..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full pr-10 pl-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-sm"
                 />
              </div>
            </div>
          </div>

          {/* Modern Navigation Tabs */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 w-fit">
            {[
              { id: 'overview', label: 'نظرة عامة', icon: <PieChart size={14} /> },
              { id: 'merchants_list', label: 'كافة الموكلين والباقات', icon: <Users2 size={14} /> },
              { 
                id: 'requests', 
                label: 'طلبات الموكلين والاسترداد', 
                icon: <Activity size={14} />,
                badge: pendingRequestsCount > 0 ? pendingRequestsCount : null
              },
              { id: 'analytics', label: 'التحليلات المالية', icon: <TrendingUp size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-6 py-2.5 rounded-[1.5rem] text-xs font-black transition-all duration-300 flex items-center gap-2 relative ${
                  activeSection === tab.id 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md scale-105' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge && (
                  <span className="absolute -top-1 -left-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <AnimatePresence mode="wait">
        {activeSection === 'overview' && (
          <motion.div
            key="overview"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="space-y-8"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                        <Coins size={20} />
                     </div>
                     <span className="text-[10px] font-black text-emerald-600 px-2 py-1 bg-emerald-50 rounded-full">إجمالي الأمانات</span>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">إجمالي أرصدة الموكلين</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {stats.totalBalance.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
                     </h3>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                        <Calculator size={20} />
                     </div>
                     <span className="text-[10px] font-black text-indigo-600 px-2 py-1 bg-indigo-50 rounded-full">التحصيلات والتسويات</span>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">إجمالي ما تم تصفيته</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {stats.totalSettlements.toLocaleString()} <span className="text-xs font-bold text-slate-400 ml-1">ج.م</span>
                     </h3>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl">
                        <AlertCircle size={20} />
                     </div>
                     <span className="text-[10px] font-black text-rose-600 px-2 py-1 bg-rose-50 rounded-full">الطلبات المعلقة</span>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">طلبات بانتظار الاعتماد</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {pendingRequestsCount} <span className="text-xs font-bold text-slate-400 ml-1">طلب</span>
                     </h3>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                     <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl">
                        <Users2 size={20} />
                     </div>
                  </div>
                  <div>
                     <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">عدد الموكلين النشطين</p>
                     <h3 className="text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
                        {stats.activeMerchants} <span className="text-xs font-bold text-slate-400 ml-1">موكل</span>
                     </h3>
                  </div>
               </motion.div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <motion.div variants={itemVariants} className="lg:col-span-2 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white mb-6">أعلى 5 موكلين من حيث الأرصدة</h3>
                  <div className="h-64 w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topMerchantsChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                            <ReTooltip 
                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="balance" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40}>
                                {topMerchantsChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                  </div>
               </motion.div>

               <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center items-center text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                    <Sparkles size={40} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">نظام التسوية التلقائي</h3>
                  <p className="text-xs font-bold text-slate-400 leading-relaxed">
                    يمكنك تصفية حسابات بضاعة الأمانة لكل موكل بضغطة زر واحدة. النظام يحسب مبيعاته، مديونية الشحن، ورأس ماله المتاح للسحب.
                  </p>
                  <Link
                    to={`/store/${storeId}/merchant-settlement`}
                    className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
                  >
                    فتح نظام التسوية الآن
                  </Link>
               </motion.div>
            </div>
          </motion.div>
        )}

        {activeSection === 'merchants_list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                    <th className="p-6">بيانات الموكل</th>
                    <th className="p-6 text-center">الرصيد الجاري</th>
                    <th className="p-6 text-center">الباقة والمدير المخصص</th>
                    <th className="p-6 text-center">بوابة الموكل</th>
                    <th className="p-6 text-center">الإجراءات والتحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {merchants.length > 0 ? (
                    merchants.map((merchant: any, idx) => {
                      const selfPlan = SELF_SERVICE_PLANS.find(p => p.id === (merchant.subscriptionPlan?.planId || 'free')) || SELF_SERVICE_PLANS[0];
                      const mgrPlan = DEDICATED_MANAGER_PLANS.find(m => m.id === (merchant.managerPlan?.planId || 'none')) || DEDICATED_MANAGER_PLANS[0];
                      const customFee = merchant.managerPlan?.customOrderFee ?? merchant.managerPlan?.orderFee ?? 20;

                      return (
                        <motion.tr 
                          key={merchant.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group"
                        >
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black text-lg">
                                {merchant.name.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800 dark:text-white mb-1">{merchant.name}</span>
                                <span className="text-[10px] font-bold text-slate-400">{merchant.phone || 'بدون رقم هاتف'}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-6 text-center">
                            <span className={`text-base font-black tabular-nums ${
                              (merchant.balance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}>
                              {(merchant.balance || 0).toLocaleString()} <span className="text-[10px]">ج.م</span>
                            </span>
                          </td>
                          <td className="p-6 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-[#008060] dark:text-emerald-400 text-[11px] font-black border border-emerald-200 dark:border-emerald-800/60">
                                <Crown size={12} />
                                <span>باقة {selfPlan.nameAr}</span>
                              </span>
                              {merchant.managerPlan && merchant.managerPlan.planId !== 'none' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-200 dark:border-amber-800/50">
                                  <UserCheck size={11} />
                                  <span>
                                    {merchant.managerPlan.planId === 'per_order_20'
                                      ? 'مدير مخصص (20 ج/أوردر)'
                                      : merchant.managerPlan.planId === 'monthly_1000'
                                      ? 'مدير مخصص (1000 ج/شهر - 50 أوردر مجاناً)'
                                      : merchant.managerPlan.planId === 'monthly_700'
                                      ? 'مدير مخصص شامل (700 ج/شهر)'
                                      : `باقة مخصصة (${customFee} ج/أوردر)`}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400">إدارة ذاتية (بدون مدير مخصص)</span>
                              )}
                              {merchant.pendingPlanRequest && (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${
                                  merchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300 animate-pulse'
                                }`}>
                                  <span>
                                    {merchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                                      ? `عرض مرسل للموكل (${merchant.pendingPlanRequest.quotedOrderFee} ج/أوردر)`
                                      : `طلب تسعير/باقة معلق: ${merchant.pendingPlanRequest.targetPlanNameAr || merchant.pendingPlanRequest.planNameAr || 'باقة المدير المخصصة'}`}
                                  </span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                               <button
                                 onClick={() => {
                                   const link = `${window.location.origin}/store/${storeId}/merchant-portal?p=${merchant.id}`;
                                   navigator.clipboard.writeText(link);
                                   showToast(`تم نسخ رابط البوابة لـ ${merchant.name}`);
                                 }}
                                 className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors shadow-sm cursor-pointer"
                                 title="نسخ رابط الدخول"
                               >
                                 <Copy size={16} />
                               </button>
                               <Link
                                 to={`/store/${storeId}/merchant-portal?p=${merchant.id}`}
                                 target="_blank"
                                 className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
                                 title="معاينة البوابة"
                               >
                                 <ExternalLink size={16} />
                               </Link>
                            </div>
                          </td>
                          <td className="p-6 text-center">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setTopUpModalMerchant(merchant);
                                  setTopUpAmount('');
                                  setTopUpNotes('شحن محفظة التاجر من الإدارة');
                                }}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <PlusCircle size={13} />
                                <span>شحن المحفظة</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openAdminPlanEditor(merchant)}
                                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black shadow-sm flex items-center gap-1.5 cursor-pointer transition-all"
                              >
                                <Settings2 size={13} />
                                <span>تعديل الباقة والمدير</span>
                              </button>
                              <Link
                                to={`/store/${storeId}/suppliers/${merchant.id}`}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-black shadow-sm transition-all inline-block"
                              >
                                عرض المحفظة
                              </Link>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-20 text-center text-slate-400 font-bold italic">
                        لا يوجد موكلين يطابقون بحثك حالياً...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeSection === 'requests' && (
          <motion.div
            key="requests"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {merchantRequests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {merchantRequests.map((req: any, idx) => {
                  const isRefund = req.type === 'subscription_refund';
                  const isTopUp = req.type === 'wallet_topup';
                  const isCustomQuote = req.type === 'custom_plan_quote';
                  const isPlanChange = req.type === 'plan_change_request';
                  const quoteFeeVal = customQuoteFeeMap[req.id] ?? 20;

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                            isCustomQuote
                              ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600'
                              : isPlanChange
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                              : isRefund
                              ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'
                              : isTopUp
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-indigo-600'
                          }`}>
                            {req.partnerName?.charAt(0) || 'M'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white">{req.partnerName}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                isCustomQuote
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                                  : isPlanChange
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : isRefund
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : isTopUp
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                              }`}>
                                {isCustomQuote
                                  ? 'طلب تسعير باقة مخصصة'
                                  : isPlanChange
                                  ? 'طلب تغيير باقة (مؤمّن)'
                                  : isRefund
                                  ? 'استرداد باقة (14 يوم)'
                                  : isTopUp
                                  ? 'شحن محفظة'
                                  : 'سحب رصيد'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold">{new Date(req.date || req.createdAt).toLocaleDateString('ar-EG')}</span>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          req.status === 'pending' ? 'bg-amber-50 text-amber-600 animate-pulse' :
                          req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {req.status === 'pending' ? 'بانتظار الموافقة' : req.status === 'approved' ? 'تم الاعتماد' : 'مرفوض'}
                        </span>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl space-y-2">
                        <p className="text-[10px] font-bold text-slate-400">
                          {isCustomQuote
                            ? 'حجم الأوردرات المستهدف وآلية السداد المطلوبة من الموكل'
                            : isPlanChange
                            ? `الباقة المطلوبة: ${req.planRequestMeta?.targetPlanNameAr || req.planRequestMeta?.planNameAr || (req.payoutAccount && req.payoutAccount !== 'undefined' ? req.payoutAccount : 'باقة المدير المخصصة')}`
                            : isRefund
                            ? 'المبلغ المطلوب إيداعه بالمحفظة (بعد خصم حصة 14 يوم)'
                            : isTopUp
                            ? 'المبلغ المطلوب شحنه في المحفظة'
                            : 'المبلغ المطلوب سحبه'}
                        </p>
                        {isCustomQuote ? (
                          <div className="space-y-1">
                            <h5 className="text-base font-black text-slate-900 dark:text-white">
                              {req.planRequestMeta?.requestedCustomQuota || req.planRequestMeta?.requestedOrdersTarget || 200} أوردر شهرياً
                              <span className="text-xs font-bold text-amber-600 mr-2">
                                ({req.planRequestMeta?.requestedCustomBillingPreference === 'prepaid_quota' || req.planRequestMeta?.requestedPrepaidQuota ? 'دفع مسبق من المحفظة' : 'خصم مع كل أوردر'})
                              </span>
                            </h5>
                          </div>
                        ) : (
                          <h5 className="text-xl font-black text-slate-900 dark:text-white tabular-nums">
                            {(req.amount || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                          </h5>
                        )}
                        {isRefund && req.refundMeta && (
                          <div className="pt-2 mt-2 border-t border-slate-200/70 dark:border-slate-700/60 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                            <span>الباقة: {req.refundMeta.planNameAr}</span>
                            <span>خصم الـ 14 يوم: {Number(req.refundMeta.charged14DaysAmount || 0).toLocaleString()} ج.م</span>
                          </div>
                        )}
                      </div>

                      {/* Admin Custom Quote Price Input Box */}
                      {isCustomQuote && req.status === 'pending' && (
                        <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
                          <label className="block text-[11px] font-black text-amber-900 dark:text-amber-300">
                            تحديد سعر إدارة الأوردر الواحد للموكل (ج.م):
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={quoteFeeVal}
                              onChange={e => setCustomQuoteFeeMap(prev => ({ ...prev, [req.id]: Math.max(1, Number(e.target.value) || 0) }))}
                              className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-black font-mono"
                            />
                            <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 shrink-0">
                              ج.م / أوردر
                            </span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-500">
                            سيصل هذا السعر للموكل ليضغط (موافقة وتفعيل من المحفظة).
                          </div>
                        </div>
                      )}

                      {req.notes && (
                        <p className="text-[10px] font-bold text-slate-500 leading-relaxed bg-indigo-50/30 dark:bg-indigo-500/5 p-3 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
                          "{String(req.notes).replace(/\(undefined\)/g, '(باقة المدير المخصصة)')}"
                        </p>
                      )}

                      {req.status === 'pending' && (
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                if (isCustomQuote) {
                                  handleSendCustomQuoteToMerchant(req, quoteFeeVal);
                                } else if (isPlanChange) {
                                  handleApprovePlanChangeRequest(req);
                                } else {
                                  handleApproveRequest(req);
                                }
                              }}
                              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black shadow-lg shadow-emerald-500/20 hover:scale-[1.02] transition-all cursor-pointer"
                            >
                              {isCustomQuote
                                ? `إرسال عرض السعر (${quoteFeeVal} ج/أوردر) للموكل 📤`
                                : isPlanChange
                                ? 'اعتماد تغيير الباقة وأرشفة الدورة السابقة'
                                : isRefund
                                ? 'اعتماد وإيداع الباقي بالمحفظة'
                                : isTopUp
                                ? 'اعتماد وشحن المحفظة'
                                : 'موافقة وصرف'}
                            </button>
                            <button
                              onClick={async () => {
                                if (storeId) {
                                    const rejected = await db.updateMerchantRequestStatus(req.id, storeId, 'rejected');
                                    if (!rejected) {
                                      showToast('لم يتم رفض الطلب؛ ربما تمت معالجته مسبقاً. حدّث القائمة.', 'error');
                                      return;
                                    }
                                    setCloudRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
                                    showToast('تم رفض طلب الموكل', 'error');
                                }
                              }}
                              className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-all cursor-pointer"
                            >
                              رفض
                            </button>
                          </div>
                          {isCustomQuote && (
                            <button
                              type="button"
                              onClick={() => handleDirectActivateCustomQuote(req, quoteFeeVal)}
                              className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black shadow-md transition-all cursor-pointer"
                            >
                              تفعيل الباقة المخصصة فوراً للموكل بسعر ({quoteFeeVal} ج/أوردر) بدون رصيد مقدم ⚡
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="p-20 text-center bg-white dark:bg-slate-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 font-bold italic">
                لا توجد طلبات حالية من الموكلين...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          ADMIN MODAL 1: DIRECT WALLET TOP-UP (شحن محفظة التاجر مباشرة)
         ===================================================================== */}
      <AnimatePresence>
        {topUpModalMerchant && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            dir="rtl"
            onClick={() => setTopUpModalMerchant(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <WalletIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      شحن محفظة التاجر ({topUpModalMerchant.name})
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      الرصيد الحالي: {(topUpModalMerchant.balance || 0).toLocaleString()} ج.م
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTopUpModalMerchant(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAdminDirectTopUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                    مبلغ الشحن (ج.م)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(e.target.value)}
                    placeholder="مثال: 1500"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-black outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                    بيان العملية / ملاحظات الإيداع
                  </label>
                  <input
                    type="text"
                    value={topUpNotes}
                    onChange={e => setTopUpNotes(e.target.value)}
                    placeholder="شحن محفظة لتفعيل الباقة أو رسوم المدير المخصص"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    إيداع وشحن المحفظة الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopUpModalMerchant(null)}
                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          ADMIN MODAL 2: PLAN & DEDICATED MANAGER CONFIG (تعديل الباقة وسعر الأوردر المخصص)
         ===================================================================== */}
      <AnimatePresence>
        {planModalMerchant && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            dir="rtl"
            onClick={() => setPlanModalMerchant(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Crown size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      تعديل باقة التاجر والمدير المخصص ({planModalMerchant.name})
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      رصيد المحفظة: {(planModalMerchant.balance || 0).toLocaleString()} ج.م
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlanModalMerchant(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSaveAdminPlanConfig} className="space-y-4">
                {/* Mode Switcher: Self-Service OR Dedicated Manager */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    اختر نظام تشغيل حساب التاجر (أحدهما فقط)
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setAdminPlanMode('self_service')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        adminPlanMode === 'self_service'
                          ? 'bg-[#008060] text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/50'
                      }`}
                    >
                      ١. باقات يشتغل بنفسه (إدارة ذاتية)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminPlanMode('manager');
                        if (adminManagerPlanId === 'none') setAdminManagerPlanId('per_order_20');
                      }}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        adminPlanMode === 'manager'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/50'
                      }`}
                    >
                      ٢. باقات المدير المخصص لأوردراته
                    </button>
                  </div>
                </div>

                {/* Billing Cycle */}
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    دورة الفوترة والخصم
                  </label>
                  <select
                    value={adminBillingCycle}
                    onChange={e => setAdminBillingCycle(e.target.value as BillingCycleType)}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black outline-none"
                  >
                    {BILLING_CYCLES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.labelAr} {c.discountLabelAr ? `(${c.discountLabelAr})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {adminPlanMode === 'self_service' ? (
                  /* 1. Self-Service Plan */
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      باقة العمل بنفسه (إدارة المتجر وإنشاء الأوردرات ذاتياً)
                    </label>
                    <select
                      value={adminSelfPlanId}
                      onChange={e => setAdminSelfPlanId(e.target.value as SelfServicePlanId)}
                      className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black outline-none"
                    >
                      {SELF_SERVICE_PLANS.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nameAr} ({p.monthlyBasePrice === 0 ? 'مجانية' : `${p.monthlyBasePrice} ج/شهر`} - {p.ordersLimitLabelAr})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  /* 2. Dedicated Order Manager Plan */
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                        نظام المدير المخصص لأوردرات التاجر (يمنع إنشاء الأوردرات الذاتي للتاجر)
                      </label>
                      <select
                        value={adminManagerPlanId === 'none' ? 'per_order_20' : adminManagerPlanId}
                        onChange={e => setAdminManagerPlanId(e.target.value as DedicatedManagerPlanId)}
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-slate-800 text-xs font-black outline-none"
                      >
                        {DEDICATED_MANAGER_PLANS.filter(m => m.id !== 'none').map(m => (
                          <option key={m.id} value={m.id}>
                            {m.nameAr} ({m.priceLabelAr})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Custom Manager Fee & Quota Controls */}
                    {adminManagerPlanId === 'custom_manager' && (
                      <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3">
                        <div className="text-xs font-black text-amber-800 dark:text-amber-300">
                          إعدادات الباقة المخصصة وسعر كل أوردر للتاجر
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              سعر إدارة الأوردر الواحد (ج.م)
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={adminCustomOrderFee}
                              onChange={e => setAdminCustomOrderFee(Math.max(1, Number(e.target.value) || 0))}
                              className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-black"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              عدد الأوردرات المستهدف بالباقة
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={adminCustomOrderQuota}
                              onChange={e => setAdminCustomOrderQuota(Math.max(1, Number(e.target.value) || 1))}
                              className="w-full px-3 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-black"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={adminCustomPrepaid}
                            onChange={e => setAdminCustomPrepaid(e.target.checked)}
                            className="rounded text-emerald-600"
                          />
                          <span>
                            دفع مقدم لإجمالي الكوتة ({(adminCustomOrderFee * adminCustomOrderQuota).toLocaleString()} ج.م) بدلاً من خصم ({adminCustomOrderFee} ج.م) تلقائياً مع كل أوردر
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Optional Immediate Wallet Deduction */}
                {adminPlanMode === 'manager' && (adminManagerPlanId === 'per_order_20' || (adminManagerPlanId === 'custom_manager' && !adminCustomPrepaid)) ? (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>
                      نظام خصم تلقائي مع كل أوردر ({adminManagerPlanId === 'custom_manager' ? adminCustomOrderFee : 20} ج.م/أوردر) — لا يتطلب رصيد مسبق بالمحفظة للتفعيل (٠ ج.م الآن)
                    </span>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs font-black text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={adminDeductFromWallet}
                      onChange={e => setAdminDeductFromWallet(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>خصم قيمة الاشتراك المحددة من محفظة التاجر الآن</span>
                  </label>
                )}

                {/* 5. Weekly Payout & 7-Day Post-Settlement Holding Controls (إعدادات التحويل الأسبوعي وفترة التعليق) */}
                <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-teal-800 dark:text-teal-300">
                      إعدادات التحويل الأسبوعي وفترة تعليق الأوردرات بعد التسوية
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-black">
                      تحكم الإدارة
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        تكرار السحب النقدي للموكل (يومي / أسبوعي)
                      </label>
                      <select
                        value={adminPayoutFrequency}
                        onChange={e => setAdminPayoutFrequency(e.target.value as 'weekly' | 'daily')}
                        className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black"
                      >
                        <option value="weekly">سحب أسبوعي (تحديد يوم في الأسبوع)</option>
                        <option value="daily">سحب يومي (يوم العمل التالي)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        يوم التحويل الأسبوعي للموكل
                      </label>
                      <select
                        value={adminWeeklyPayoutDay}
                        onChange={e => setAdminWeeklyPayoutDay(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black"
                      >
                        <option value={0}>كل يوم أحد</option>
                        <option value={1}>كل يوم إثنين</option>
                        <option value={2}>كل يوم ثلاثاء</option>
                        <option value={3}>كل يوم أربعاء</option>
                        <option value={4}>كل يوم خميس</option>
                        <option value={5}>كل يوم جمعة</option>
                        <option value={6}>كل يوم سبت</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        عمولة الإدارة للسحب الأسبوعي
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={adminWeeklyTransferFee}
                          onChange={e => setAdminWeeklyTransferFee(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black font-mono"
                        />
                        <select
                          value={adminWeeklyTransferFeeType}
                          onChange={e => setAdminWeeklyTransferFeeType(e.target.value as 'fixed' | 'percentage')}
                          className="px-2.5 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black shrink-0"
                        >
                          <option value="fixed">ج.م ثابت</option>
                          <option value="percentage">% نسبة</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        عمولة الإدارة للسحب اليومي
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          step="0.25"
                          value={adminDailyTransferFee}
                          onChange={e => setAdminDailyTransferFee(Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black font-mono"
                        />
                        <select
                          value={adminDailyTransferFeeType}
                          onChange={e => setAdminDailyTransferFeeType(e.target.value as 'fixed' | 'percentage')}
                          className="px-2.5 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black shrink-0"
                        >
                          <option value="percentage">% نسبة</option>
                          <option value="fixed">ج.م ثابت</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        فترة تعليق رصيد الأوردر بعد التسوية (بالأيام)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={60}
                        value={adminHoldingDays}
                        onChange={e => setAdminHoldingDays(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">الافتراضي 7 أيام (تسوية الأسبوع تُرحّل للأسبوع القادم)</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        آلية تنفيذ التحويل عند حلول يوم السحب
                      </label>
                      <select
                        value={adminWeeklyPayoutMode}
                        onChange={e => setAdminWeeklyPayoutMode(e.target.value as 'auto' | 'admin_confirm')}
                        className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black"
                      >
                        <option value="admin_confirm">تأكيد بضغطة زر من مدير المتجر (موصى به)</option>
                        <option value="auto">تحويل آلي كامل في يوم التحويل</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        الحد الأدنى لكل سحبة (ج.م)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={adminMinWeeklyPayout}
                        onChange={e => setAdminMinWeeklyPayout(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        الحد الأقصى لكل سحبة (ج.م)
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={adminMaxWeeklyPayout}
                        onChange={e => setAdminMaxWeeklyPayout(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full px-3 py-2 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-black"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {adminPlanMode === 'manager' && adminManagerPlanId === 'custom_manager' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!planModalMerchant) return;
                        const quotedRequest: MerchantPlanChangeRequest = {
                          id: planModalMerchant.pendingPlanRequest?.id || `QUOTE-${Date.now()}`,
                          requestedAt: planModalMerchant.pendingPlanRequest?.requestedAt || new Date().toISOString(),
                          targetMode: 'manager',
                          targetPlanId: 'custom_manager',
                          targetManagerPlanId: 'custom_manager',
                          targetPlanNameAr: 'باقة المدير المخصصة',
                          planNameAr: 'باقة المدير المخصصة',
                          billingCycle: adminBillingCycle || 'monthly',
                          requestedCustomQuota: adminCustomOrderQuota,
                          requestedOrdersTarget: adminCustomOrderQuota,
                          quotedOrdersTarget: adminCustomOrderQuota,
                          requestedPrepaidQuota: adminCustomPrepaid,
                          requestedCustomBillingPreference: adminCustomPrepaid ? 'prepaid_quota' : 'per_order',
                          quotedOrderFee: adminCustomOrderFee,
                          quotedTotalUpfront: adminCustomPrepaid ? Number((adminCustomOrderFee * adminCustomOrderQuota).toFixed(2)) : 0,
                          quotedAt: new Date().toISOString(),
                          status: 'quoted_waiting_merchant',
                          adminNotes: `عرض تسعير من الإدارة: ${adminCustomOrderFee} ج.م لكل أوردر (${adminCustomOrderQuota} أوردر)`
                        };
                        await syncMerchantUpdates(
                          planModalMerchant.id,
                          planModalMerchant.name,
                          (m) => ({
                            ...m,
                            pendingPlanRequest: quotedRequest
                          }),
                          undefined,
                          {
                            action: 'إرسال عرض سعر باقة مخصصة للموكل',
                            details: `تم إرسال عرض سعر (${adminCustomOrderFee} ج.م/أوردر) للموكل ${planModalMerchant.name} للموافقة والتفعيل`
                          }
                        );
                        showToast(`تم إرسال عرض السعر (${adminCustomOrderFee} ج.م/أوردر) لبوابة الموكل بنجاح`);
                        setPlanModalMerchant(null);
                      }}
                      className="flex-1 py-3 px-4 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-lg shadow-amber-600/20 cursor-pointer"
                    >
                      إرسال عرض السعر للموكل للموافقة 📤
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-2xl bg-[#008060] hover:bg-[#00694f] text-white text-xs font-black shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    تفعيل فوري من الإدارة وأرشفة الدورة السابقة
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanModalMerchant(null)}
                    className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-black cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MerchantsPage;
