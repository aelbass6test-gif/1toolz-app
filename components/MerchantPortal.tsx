import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Partner, StoreData, Order, Treasury, MerchantTransaction } from '../types';
import { 
  History, PieChart, Activity, Building2, Loader2, Shield, AlertCircle, CheckCircle2, Send, ShieldCheck, 
  Coins, RefreshCw, LogOut, DollarSign, Package as PackageIcon, Wallet as WalletIcon, FileText, Key, X,
  Truck, Clock, Sparkles, ChevronDown, ChevronUp, PackageCheck, Mail, Calculator, ExternalLink
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid
} from 'recharts';
import { MerchantTransparencyTab } from './MerchantTransparencyTab';
import { calculateMerchantTransparencyAnalytics } from '../utils/merchantAnalytics';
import { getTrackingNumber, getShippingTrackingUrl } from '../utils/shippingTracking';
import { motion, AnimatePresence } from 'motion/react';
import * as db from '../services/databaseService';
import { 
  isWebAuthnSupported, 
  isPlatformAuthenticatorAvailable, 
  detectBiometricDeviceName,
  registerBiometricCredential, 
  authenticateBiometricCredential,
  getStoredBiometrics,
  saveStoredBiometric,
  removeStoredBiometric
} from '../utils/webAuthnService';

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

const maskEmail = (email?: string) => {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
};

export interface MerchantPortalProps {
  allStoresData: Record<string, StoreData>;
  updateSettings: (settings: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type TabKey = 'overview' | 'orders' | 'transparency' | 'withdrawals' | 'statement' | 'account';

export default function MerchantPortal({ allStoresData, updateSettings, showToast: externalShowToast }: MerchantPortalProps) {
  const { storeId, tab: routeTab } = useParams<{ storeId: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPartnerId = searchParams.get('p') || searchParams.get('merchantId') || searchParams.get('m') || '';
  const urlTab = searchParams.get('tab') || routeTab;

  const validTabs: TabKey[] = ['overview', 'orders', 'transparency', 'withdrawals', 'statement', 'account'];
  const activeTab: TabKey = validTabs.includes(urlTab as TabKey) ? (urlTab as TabKey) : 'overview';

  const [directStoreData, setDirectStoreData] = useState<StoreData | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [merchantRequestsList, setMerchantRequestsList] = useState<db.PartnerPortalRequest[]>([]);

  const effectiveStoreId = useMemo(() => {
    if (storeId) return storeId;
    const fromParam = searchParams.get('storeId') || searchParams.get('s');
    if (fromParam) return fromParam;
    try {
      const activeId = localStorage.getItem('activeStoreId') || localStorage.getItem('last_active_store_id');
      if (activeId && allStoresData[activeId]) return activeId;
    } catch {}
    const keys = Object.keys(allStoresData);
    if (keys.length > 0) return keys[0];
    return '';
  }, [storeId, searchParams, allStoresData]);

  const loadRequests = useCallback(async () => {
    const targetStoreId = storeId || effectiveStoreId;
    if (!targetStoreId) return;
    try {
      const reqs = await db.getPartnerRequests(targetStoreId);
      setMerchantRequestsList(reqs);
    } catch (_) {}
  }, [storeId, effectiveStoreId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Fetch fresh store data on mount
  const fetchFreshData = useCallback(async (isManualRefresh = false) => {
    const targetStoreId = storeId || effectiveStoreId;
    if (!targetStoreId) return;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingStore(true);
    }

    try {
      const fetchedData = await db.getStoreData(targetStoreId, true);
      if (fetchedData) {
        setDirectStoreData(fetchedData);
        if (isManualRefresh) {
          showToast('تم تحديث البيانات المالية للحساب بنجاح', 'success');
        }
      }
      await loadRequests();
    } catch (err) {
      console.error('[MerchantPortal] Error loading store data:', err);
    } finally {
      setIsLoadingStore(false);
      setIsRefreshing(false);
    }
  }, [storeId, effectiveStoreId, loadRequests]);

  useEffect(() => {
    fetchFreshData(false);
  }, [fetchFreshData]);

  const activeStoreData = directStoreData || (storeId && allStoresData[storeId]) || (effectiveStoreId ? allStoresData[effectiveStoreId] : null);
  const settings = (activeStoreData?.settings || { partners: [], suppliers: [], partnerTransactions: [] }) as any;
  const rawOrders: Order[] = activeStoreData?.orders || [];
  
  // Extract strictly Consignment Merchants & Suppliers (NO profit-share partners)
  const merchants: Partner[] = useMemo(() => {
    const rawSuppliers: any[] = settings.suppliers || [];
    const list: Partner[] = [];
    const seen = new Set<string>();

    rawSuppliers.forEach((s: any) => {
      const sId = s.id || s.name;
      if (sId && !seen.has(sId) && !seen.has(s.name)) {
        seen.add(sId);
        seen.add(s.name);
        list.push({
          id: s.id || `sup_${s.name}`,
          name: s.name,
          phone: s.phone || '',
          email: s.email || '',
          balance: s.balance || 0,
          transactions: s.transactions || [],
          profitRatio: 0,
          passcode: s.passcode || '0000',
          role: 'موكل / مورد صاحب بضاعة'
        });
      }
    });

    // Also include unique merchants from orders
    (rawOrders || []).forEach((o: any) => {
      const mName = (o.merchantName || '').trim();
      const mId = (o.merchantId || '').trim();
      if (mName && mId !== 'pending' && !seen.has(mName) && (!mId || !seen.has(mId))) {
        seen.add(mName);
        if (mId) seen.add(mId);
        list.push({
          id: mId || `m_${mName}`,
          name: mName,
          phone: o.merchantBrandPhone || '',
          email: '',
          balance: 0,
          profitRatio: 0,
          passcode: '0000',
          role: 'موكل صاحب بضاعة'
        });
      }
    });

    return list;
  }, [settings.suppliers, rawOrders]);

  const storeName = activeStoreData?.name || (settings as any)?.storeName || 'متجري';

  useEffect(() => {
    document.title = `بوابة الموكلين والموردين | ${storeName}`;
  }, [storeName]);

  // Authentication State
  const [authenticatedMerchant, setAuthenticatedMerchant] = useState<Partner | null>(() => {
    try {
      const saved = sessionStorage.getItem(`merchant_portal_auth_${effectiveStoreId}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const liveMerchant = useMemo(() => {
    if (!authenticatedMerchant) return null;
    const current = merchants.find(m => 
      (m.id && authenticatedMerchant.id && String(m.id).trim() === String(authenticatedMerchant.id).trim()) ||
      (authenticatedMerchant.phone && m.phone && String(m.phone).trim() === String(authenticatedMerchant.phone).trim()) ||
      (m.name && authenticatedMerchant.name && normalizeName(m.name) === normalizeName(authenticatedMerchant.name))
    );
    return current || authenticatedMerchant;
  }, [authenticatedMerchant, merchants]);

  useEffect(() => {
    if (liveMerchant && effectiveStoreId) {
      sessionStorage.setItem(`merchant_portal_auth_${effectiveStoreId}`, JSON.stringify(liveMerchant));
    }
  }, [liveMerchant, effectiveStoreId]);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    if (externalShowToast) externalShowToast(msg, type);
    setTimeout(() => setToast(null), 3500);
  };

  // Auth View Local States
  const [authMode, setAuthMode] = useState<'otp' | 'pin' | 'biometric'>('otp');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(() => merchants.length === 1 ? merchants[0].id : '');
  const [otpCode, setOtpCode] = useState('');
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [pinCode, setPinCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Portal View States
  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<'all' | 'shipping' | 'collected' | 'pending' | 'returned'>('all');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Requests Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'wallet' | 'instapay' | 'bank' | 'cash'>('wallet');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Security / PIN States
  const [newPinInput, setNewPinInput] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  const activeMerchantObj = useMemo(() => {
    if (selectedMerchantId) return merchants.find(m => m.id === selectedMerchantId);
    if (merchants.length === 1) return merchants[0];
    return null;
  }, [selectedMerchantId, merchants]);

  // Handle Send Email OTP
  const handleSendOtp = async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('يرجى إدخال عنوان بريد إلكتروني صالح لربطه بحساب الموكل واستلام الكود');
      return;
    }

    setIsSendingOtp(true);
    setAuthError('');
    setAuthSuccess('');
    setDevOtpCode(null);

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          userName: activeMerchantObj?.name || 'الموكل العزيز',
          storeName,
          phone: activeMerchantObj?.phone
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsOtpSent(true);
        setOtpTargetEmail(cleanEmail);
        if (data.debugCode) setDevOtpCode(data.debugCode);
        const msg = data.message || `تم إرسال رمز التحقق المكون من 6 أرقام إلى بريدك (${maskEmail(cleanEmail)}) بنجاح.`;
        setAuthSuccess(msg);
        showToast(msg, 'success');
      } else {
        setAuthError(data.error || 'تعذر إرسال رمز التحقق. يرجى التأكد من صحة البريد والمحاولة لاحقاً.');
      }
    } catch (err: any) {
      setAuthError('حدث خطأ في الاتصال أثناء إرسال البريد: ' + (err.message || ''));
    } finally {
      setIsSendingOtp(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setAuthError('أدخل كود التحقق المكون من 6 أرقام كاملاً');
      return;
    }

    setIsVerifyingOtp(true);
    setAuthError('');
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: otpTargetEmail.trim().toLowerCase(),
          otp: otpCode.trim()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid) {
        let matched = merchants.find(m => m.id === selectedMerchantId || m.email?.toLowerCase() === otpTargetEmail.toLowerCase());
        if (!matched && merchants.length === 1) matched = merchants[0];
        if (!matched && activeMerchantObj) matched = activeMerchantObj;

        const authenticatedObj: Partner = matched || {
          id: selectedMerchantId || `m_${Date.now()}`,
          name: activeMerchantObj?.name || 'الموكل المعتمد',
          email: otpTargetEmail.trim().toLowerCase(),
          balance: 0,
          profitRatio: 0,
          passcode: '0000',
          role: 'موكل صاحب بضاعة'
        };

        setAuthenticatedMerchant(authenticatedObj);
        sessionStorage.setItem(`merchant_portal_auth_${effectiveStoreId}`, JSON.stringify(authenticatedObj));
        showToast(`أهلاً بك يا ${authenticatedObj.name}! تم التحقق والدخول لبوابة الموكلين بنجاح`, 'success');
      } else {
        setAuthError(data.message || 'رمز التحقق غير صحيح أو منتهي الصلاحية');
      }
    } catch (err: any) {
      setAuthError('خطأ أثناء التحقق: ' + (err.message || ''));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle Quick Test Login
  const handleQuickTestLogin = () => {
    const m = activeMerchantObj || merchants[0];
    if (m) {
      setAuthenticatedMerchant(m);
      sessionStorage.setItem(`merchant_portal_auth_${effectiveStoreId}`, JSON.stringify(m));
      showToast(`🚀 تم الدخول المباشر لحساب الموكل: ${m.name}`, 'success');
    } else {
      setAuthError('لم يتم العثور على حساب موكل مسجل بالمتجر لتنفيذ الدخول السريع');
    }
  };

  // Filter Orders for Live Merchant
  const merchantOrders = useMemo(() => {
    if (!liveMerchant) return [];
    const mName = (liveMerchant.name || '').trim().toLowerCase();
    const mId = (liveMerchant.id || '').trim().toLowerCase();
    const mPhone = (liveMerchant.phone || '').trim().toLowerCase();

    return rawOrders.filter(o => {
      const oMName = (o.merchantName || '').trim().toLowerCase();
      const oMId = (o.merchantId || '').trim().toLowerCase();
      const oMPhone = (o.merchantBrandPhone || '').trim().toLowerCase();

      return (
        (mId && oMId === mId) ||
        (mName && oMName === mName) ||
        (mPhone && oMPhone === mPhone)
      );
    });
  }, [rawOrders, liveMerchant]);

  // Filtered Orders View
  const filteredOrders = useMemo(() => {
    let list = [...merchantOrders];

    if (ordersStatusFilter === 'shipping') {
      list = list.filter(o => ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status));
    } else if (ordersStatusFilter === 'collected') {
      list = list.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status));
    } else if (ordersStatusFilter === 'pending') {
      list = list.filter(o => ['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز'].includes(o.status));
    } else if (ordersStatusFilter === 'returned') {
      list = list.filter(o => ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(o.status));
    }

    if (ordersSearchQuery.trim()) {
      const q = ordersSearchQuery.trim().toLowerCase();
      list = list.filter(o => 
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (o.items || []).some(i => (i.name || i.productName || '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [merchantOrders, ordersStatusFilter, ordersSearchQuery]);

  // Consignment Products & Stock Valuation
  const merchantProducts = useMemo(() => {
    if (!liveMerchant) return [];
    const mName = normalizeName(liveMerchant.name || '');
    const mId = (liveMerchant.id || '').trim().toLowerCase();
    const allProds: any[] = activeStoreData?.settings?.products || settings.products || [];

    return allProds.filter(p => {
      const pMId = (p.merchantId || p.supplierId || '').trim().toLowerCase();
      const pMName = normalizeName(p.merchantName || p.supplierName || '');
      return (mId && pMId === mId) || (mName && pMName === mName) || (mName && pMName.includes(mName));
    });
  }, [activeStoreData, settings, liveMerchant]);

  const inventoryValuation = useMemo(() => {
    return merchantProducts.reduce((sum, p) => {
      const stock = Number(p.stock || p.quantity || p.inventory || 0);
      const cost = Number(p.costPrice || p.cost || p.wholesalePrice || p.supplierPrice || 0);
      return sum + (stock * cost);
    }, 0);
  }, [merchantProducts]);

  const totalStockUnits = useMemo(() => {
    return merchantProducts.reduce((sum, p) => sum + Number(p.stock || p.quantity || p.inventory || 0), 0);
  }, [merchantProducts]);

  // Calculate Merchant Financial Overview Stats
  const overviewStats = useMemo(() => {
    let pendingGoodsValue = 0;
    let deliveredCount = 0;
    let returnCount = 0;

    merchantOrders.forEach(o => {
      const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
      const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(o.status);
      const isShipping = ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status);

      const itemsCost = o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);

      if (isDelivered) {
        deliveredCount++;
      } else if (isReturn) {
        returnCount++;
      } else if (isShipping) {
        pendingGoodsValue += itemsCost;
      }
    });

    const analytics = calculateMerchantTransparencyAnalytics(merchantOrders, settings, liveMerchant?.id || liveMerchant?.name || '');

    const totalDeliveredCollected = analytics.totalCollected;
    const totalGoodsCostCapital = analytics.totalGoodsCostRecovered;
    const totalShippingDeductions = analytics.totalShippingAndCarrier;
    const netPayoutReady = analytics.netPayoutToMerchant;

    const returnRate = merchantOrders.length > 0 ? Math.round((returnCount / merchantOrders.length) * 100) : 0;

    const transactions = liveMerchant?.transactions || [];
    const sortedTxs = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let runningBalance = 0;
    const chartData = sortedTxs.map(t => {
      const amount = Number(t.amount) || 0;
      runningBalance = t.balanceAfter ?? (runningBalance + amount);
      return {
        date: new Date(t.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
        'الرصيد الجاري': runningBalance,
        amount: amount
      };
    });

    return {
      totalOrdersCount: merchantOrders.length,
      deliveredCount,
      returnCount,
      returnRate,
      totalDeliveredCollected,
      totalGoodsCostCapital,
      totalShippingDeductions,
      netPayoutReady,
      persistentBalance: liveMerchant?.balance || 0,
      pendingGoodsValue,
      inventoryValuation,
      totalStockUnits,
      merchantProductsCount: merchantProducts.length,
      chartData
    };
  }, [merchantOrders, settings, liveMerchant, inventoryValuation, totalStockUnits, merchantProducts]);

  // Filter Requests specifically for the active merchant
  const merchantFilteredRequests = useMemo(() => {
    if (!liveMerchant) return [];
    const mId = (liveMerchant.id || '').trim().toLowerCase();
    const mName = normalizeName(liveMerchant.name || '');
    return merchantRequestsList.filter(r => {
      const rId = (r.partnerId || (r as any).merchantId || '').trim().toLowerCase();
      const rName = normalizeName(r.partnerName || (r as any).merchantName || '');
      return (mId && rId === mId) || (mName && rName === mName);
    });
  }, [merchantRequestsList, liveMerchant]);

  // Submit Payout / Withdrawal Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant) return;
    const numAmt = Number(requestAmount);
    if (!numAmt || numAmt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للطلب', 'error');
      return;
    }

    setIsSubmittingRequest(true);
    try {
      const payoutDetails = ` [طريقة الاستلام: ${payoutMethod} ${payoutAccount ? `- الحساب: ${payoutAccount}` : ''}]`;
      const newReq: db.PartnerPortalRequest & { isMerchantRequest?: boolean } = {
        id: `REQ-M-${Date.now()}`,
        storeId: effectiveStoreId,
        partnerId: liveMerchant.id,
        partnerName: liveMerchant.name,
        type: 'withdrawal',
        typeArabic: 'طلب سحب مستحقات الموكل',
        amount: numAmt,
        notes: `${requestNotes || ''}${payoutDetails}`,
        date: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        isMerchantRequest: true
      };

      await db.submitPartnerRequest(effectiveStoreId, newReq);
      setMerchantRequestsList(prev => [newReq, ...prev]);
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestNotes('');
      showToast('تم إرسال طلب سحب المستحقات للإدارة بنجاح', 'success');
    } catch (err: any) {
      showToast('حدث خطأ أثناء إرسال الطلب: ' + (err.message || ''), 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setAuthenticatedMerchant(null);
    sessionStorage.removeItem(`merchant_portal_auth_${effectiveStoreId}`);
    showToast('تم تسجيل الخروج الآمن من بوابة الموكلين', 'success');
  };

  // RENDER 1: Loading
  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-[#008060] flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 mb-4 animate-pulse">
          <Building2 size={28} />
        </div>
        <h2 className="text-xl font-black mb-1">{storeName}</h2>
        <p className="text-xs text-[#008060] font-bold mb-4">جاري تحميل بوابة الموكلين والموردين...</p>
        <Loader2 className="animate-spin text-[#008060]" size={24} />
      </div>
    );
  }

  // RENDER 2: Dedicated Merchant Login View
  if (!liveMerchant) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden" dir="rtl">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-[#008060] to-[#0a664e] flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-3 ring-4 ring-emerald-500/20">
              <Building2 size={32} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">{storeName}</h1>
            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-bold">
              <Shield size={14} />
              <span>بوابة الموكلين والموردين (تسوية الحسابات والبضائع)</span>
            </div>
          </div>

          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && !authError && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-start gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-500 mt-0.5" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Login Steps */}
          {!isOtpSent ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-300 mb-2">
                  اختر حساب الموكل / المورد المسجل ({merchants.length} موكلين):
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {merchants.map(m => {
                    const isSelected = selectedMerchantId === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMerchantId(m.id);
                          if (m.email) {
                            setOtpTargetEmail(m.email);
                            setCustomEmailInput(m.email);
                          }
                          setAuthError('');
                        }}
                        className={`p-3 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-950/50 border-emerald-500 text-white ring-1 ring-emerald-500' 
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${isSelected ? 'bg-[#008060] text-white' : 'bg-slate-700 text-slate-300'}`}>
                            {m.name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-black text-xs text-white">{m.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{m.email ? maskEmail(m.email) : 'لم يتم ربط بريد إلكتروني'}</div>
                          </div>
                        </div>
                        {isSelected && <CheckCircle2 size={16} className="text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeMerchantObj && (
                <div className="space-y-3 pt-1">
                  {activeMerchantObj.email ? (
                    <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-xs">
                      <div className="text-slate-400 font-bold mb-1">سيتم إرسال كود OTP لبريدك المسجل:</div>
                      <div className="font-mono font-black text-emerald-400 flex items-center gap-2">
                        <Mail size={14} />
                        <span>{maskEmail(activeMerchantObj.email)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-xs">
                      <div className="font-black text-amber-300 flex items-center gap-1.5">
                        <AlertCircle size={15} />
                        <span>أدخل بريدك لربطه بحسابك وتفعيل الدخول:</span>
                      </div>
                      <input
                        type="email"
                        value={customEmailInput}
                        onChange={e => {
                          setCustomEmailInput(e.target.value);
                          setOtpTargetEmail(e.target.value);
                        }}
                        placeholder="merchant@example.com"
                        className="w-full bg-slate-900 px-3 py-2 rounded-xl border border-amber-700 text-white font-mono outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleSendOtp(otpTargetEmail || activeMerchantObj.email || customEmailInput)}
                    disabled={isSendingOtp || (!otpTargetEmail && !activeMerchantObj.email && !customEmailInput)}
                    className="w-full py-3.5 bg-[#008060] hover:bg-[#006e52] text-white rounded-2xl font-black text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                    <span>إرسال كود التحقق الأمني (OTP) إيميل</span>
                  </button>
                </div>
              )}

              {/* Developer / Admin Quick Test Button */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleQuickTestLogin}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles size={14} />
                  <span>🚀 دخول سريع للتجربة والمشاهدة</span>
                </button>
              </div>
            </div>
          ) : (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-emerald-950/50 border border-emerald-800 rounded-2xl text-xs text-emerald-300 font-bold">
                أدخل كود التحقق المكون من 6 أرقام المرسل إلى: <span className="font-mono text-white">{maskEmail(otpTargetEmail)}</span>
              </div>

              {devOtpCode && (
                <div className="p-2.5 bg-amber-950/80 border border-amber-700 rounded-xl text-xs text-amber-300 font-mono text-center font-black">
                  🔑 كود المعاينة للتجربة: {devOtpCode}
                </div>
              )}

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full py-3.5 px-4 bg-slate-900 border-2 border-emerald-500 rounded-2xl text-center font-mono font-black text-2xl tracking-[8px] text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsOtpSent(false)}
                  className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  رجوع
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="flex-1 py-3 bg-[#008060] hover:bg-[#006e52] text-white rounded-xl text-xs font-black cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>تأكيد الكود والدخول للبوابة</span>
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    );
  }

  // RENDER 3: Standalone Merchant Dashboard
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans pb-16" dir="rtl">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-xs font-black shadow-xl flex items-center gap-2 border ${
          toast.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'
        }`}>
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#008060] to-[#0a664e] text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
              {liveMerchant.name.slice(0, 1)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900">
                  {liveMerchant.name}
                </h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#008060] border border-emerald-200">
                  موكل معتمد (صاحب بضاعة)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {storeName} • بوابة تسوية حسابات البضائع والمستحقات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5 bg-[#008060] hover:bg-[#0a664e] text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Coins size={14} />
              <span>طلب سحب المستحقات</span>
            </button>

            <button
              onClick={() => fetchFreshData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-[#008060]' : ''} />
              <span className="hidden md:inline">مزامنة</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-200"
            >
              <LogOut size={14} />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
            <button
              onClick={() => setCurrentTab('overview')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentTab === 'overview'
                  ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <DollarSign size={15} />
              <span>المستحقات والأرصدة</span>
            </button>

            <button
              onClick={() => setCurrentTab('orders')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentTab === 'orders'
                  ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <PackageIcon size={15} />
              <span>أوردراتي وشحنات بضاعتي</span>
              {merchantOrders.length > 0 && (
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-bold">
                  {merchantOrders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('transparency')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentTab === 'transparency'
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Sparkles size={15} className="text-indigo-600" />
              <span>حركة البضاعة والمخزن</span>
            </button>

            <button
              onClick={() => setCurrentTab('withdrawals')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentTab === 'withdrawals'
                  ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Coins size={15} />
              <span>طلبات السحب والمصروفات</span>
            </button>

            <button
              onClick={() => setCurrentTab('statement')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentTab === 'statement'
                  ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <WalletIcon size={15} />
              <span>المحفظة وكشف الحساب</span>
            </button>

            <button
              onClick={() => setCurrentTab('account')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-t-xl transition-all cursor-pointer border-b-2 whitespace-nowrap ${
                currentTab === 'account'
                  ? 'border-[#008060] text-[#008060] bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck size={15} />
              <span>بيانات الحساب والأمان</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* TAB 1: Overview (Consignment Supplier Dashboard) */}
        {currentTab === 'overview' && (
          <div className="space-y-6">
            
            {/* System Title Banner */}
            <div className="p-4 bg-emerald-900 text-white rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg shadow-emerald-900/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-800 flex items-center justify-center text-emerald-300 font-black">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">نظام تسوية وتصفية أمانات الموكلين والبضائع</h3>
                  <p className="text-xs text-emerald-200 font-medium">متابعة دقيقة لمبيعات بضاعتك، التحصيلات النقدية، وقيمة المخزون المتبقي بالأمانة</p>
                </div>
              </div>
              <div className="px-3.5 py-1.5 bg-emerald-800/80 rounded-xl text-xs font-mono font-bold text-emerald-200 self-start sm:self-auto border border-emerald-700/50">
                Consignment Ledger System
              </div>
            </div>

            {/* 5 Primary Consignment KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">رصيد المحفظة (المسوى)</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#008060] flex items-center justify-center font-black">
                    <WalletIcon size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600">
                  {overviewStats.persistentBalance.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">الرصيد المودع فعلياً والقابل للسحب الآن</p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">أرباح بانتظار التسوية</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                    <Calculator size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-indigo-600">
                  {overviewStats.netPayoutReady.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">صافي مستحقاتك من المبيعات الجديدة</p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">إجمالي مبيعات تحصيلات بضاعتك</span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-black">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-slate-900">
                  {overviewStats.totalDeliveredCollected.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{overviewStats.deliveredCount} أوردرات تم تسليمها وتحصيلها</p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">قيمة بضاعتك المتبقية بالمخزن</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                    <PackageIcon size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-purple-700">
                  {overviewStats.inventoryValuation.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">{overviewStats.totalStockUnits} قطعة متوفرة أمانة في المخزن</p>
              </div>

              <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold">بضاعة في الطريق وقيد الشحن</span>
                  <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-black">
                    <Truck size={18} />
                  </div>
                </div>
                <div className="text-2xl font-black font-mono text-sky-600">
                  {overviewStats.pendingGoodsValue.toLocaleString()} <span className="text-xs font-bold text-slate-400">ج.م</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">رأس مال الشحنات جاري توصيلها للعملاء</p>
              </div>
            </div>

            {/* Visual Balance Progression Chart */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تطور الرصيد الجاري بالمحفظة
                  </h3>
                  <p className="text-xs text-slate-500">
                    حركة الحساب المالي عبر المعاملات، التسويات، والمسحوبات النقدية
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[#008060]">
                  {liveMerchant?.transactions?.length || 0} حركة مالية مسجلة
                </span>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2" dir="ltr">
                {(!overviewStats.chartData || overviewStats.chartData.length === 0) ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                    لا توجد حركات كافية في كشف الحساب لرسم المنحنى البياني حالياً.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={overviewStats.chartData}>
                      <defs>
                        <linearGradient id="merchantPortalEmerald" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#008060" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#008060" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#ffffff', 
                          borderColor: '#cbd5e1', 
                          borderRadius: '16px',
                          color: '#0f172a',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          direction: 'rtl'
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="الرصيد الجاري" 
                        stroke="#008060" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#merchantPortalEmerald)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Consignment Financial Summary Panel */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Calculator className="w-4 h-4 text-[#008060]" />
                <span>ملخص تصفية الحساب المالي للبضاعة المبيعة</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-bold">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 block text-[11px]">المحصل الإجمالي من العملاء:</span>
                  <span className="text-base font-black font-mono text-slate-900">{overviewStats.totalDeliveredCollected.toLocaleString()} ج.م</span>
                </div>
                <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 space-y-1">
                  <span className="text-sky-700 block text-[11px]">رأس مال البضاعة المبيعة:</span>
                  <span className="text-base font-black font-mono text-sky-900">{overviewStats.totalGoodsCostCapital.toLocaleString()} ج.م</span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                  <span className="text-rose-700 block text-[11px]">خصومات الشحن والتشغيل:</span>
                  <span className="text-base font-black font-mono text-rose-900">-{overviewStats.totalShippingDeductions.toLocaleString()} ج.م</span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 space-y-1">
                  <span className="text-[#008060] block text-[11px]">الصافي المستحق للموكل:</span>
                  <span className="text-base font-black font-mono text-[#008060]">{overviewStats.netPayoutReady.toLocaleString()} ج.م</span>
                </div>
              </div>
            </div>

            {/* Consignment Inventory Table Section */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                  <PackageIcon className="w-4 h-4 text-purple-600" />
                  <span>بضاعة الأمانة المسجلة بحسابك والمتوفرة بالمخزن ({merchantProducts.length} صنف)</span>
                </h4>
                <button
                  onClick={() => setCurrentTab('transparency')}
                  className="text-xs font-black text-[#008060] hover:underline"
                >
                  عرض الحركة التفصيلية للمخزن ←
                </button>
              </div>

              {merchantProducts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-bold text-xs">
                  لا توجد أصناف بضاعة مسجلة بالمخزن باسم الموكل حالياً
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold">
                        <th className="py-3 px-3">اسم المنتج / الصنف</th>
                        <th className="py-3 px-3 text-center">الكمية بالمخزن</th>
                        <th className="py-3 px-3 text-center">سعر توريد الموكل</th>
                        <th className="py-3 px-3 text-center">القيمة الإجمالية للمخزون</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {merchantProducts.map((p, idx) => {
                        const stock = Number(p.stock || p.quantity || p.inventory || 0);
                        const cost = Number(p.costPrice || p.cost || p.wholesalePrice || p.supplierPrice || 0);
                        return (
                          <tr key={p.id || idx} className="hover:bg-slate-50">
                            <td className="py-3 px-3 font-bold text-slate-900">{p.name || p.title || 'منتج أمانة'}</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-purple-700">{stock} قطعة</td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">{cost.toLocaleString()} ج.م</td>
                            <td className="py-3 px-3 text-center font-mono font-black text-emerald-700">{(stock * cost).toLocaleString()} ج.م</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: Orders */}
        {currentTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">متابعة أوردرات وشحنات بضاعتي</h3>
                <p className="text-xs text-slate-500">متابعة لحظية ومباشرة لكافة الشحنات المربوطة بحسابك</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ordersSearchQuery}
                  onChange={e => setOrdersSearchQuery(e.target.value)}
                  placeholder="بحث برقم الطلب، العميل..."
                  className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-600 font-mono"
                />
              </div>
            </div>

            {/* Orders Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">رقم الطلب والتاريخ</th>
                    <th className="py-3 px-3">شركة الشحن</th>
                    <th className="py-3 px-3">العميل والمحافظة</th>
                    <th className="py-3 px-3">الأصناف المشمولة</th>
                    <th className="py-3 px-3 text-center">حالة التوصيل</th>
                    <th className="py-3 px-3 text-center">المحصل من العميل</th>
                    <th className="py-3 px-3 text-center text-sky-800">رأس مال البضاعة</th>
                    <th className="py-3 px-3 text-center text-emerald-700">الصافي للموكل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">لا توجد أوردرات مسجلة باسمك حالياً</td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => {
                      const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
                      const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي'].includes(o.status);
                      const collected = isDelivered ? (o.totalAmountOverride ?? o.totalPrice ?? 0) : 0;
                      const goodsCost = o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);
                      const shipFee = Number(o.shippingFee) || 0;
                      const netForMerchant = isDelivered ? (collected - shipFee) : isReturn ? (-shipFee) : goodsCost;

                      const trackNum = getTrackingNumber(o);
                      const trackUrl = getShippingTrackingUrl(o);

                      return (
                        <tr key={o.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900">#{o.orderNumber || o.id}</td>
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-slate-800 flex items-center gap-1">
                              <Truck size={12} className="text-slate-400 shrink-0" />
                              <span>{o.shippingCompany || 'شركة الشحن'}</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-0.5 items-start">
                              {trackNum ? (
                                <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  بوليصة: {trackNum}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400">قيد إصدار البوليصة</div>
                              )}

                              {trackUrl && (
                                <a
                                  href={trackUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-2 py-0.5 rounded-md transition-all shadow-2xs shrink-0"
                                  title="فتح صفحة تتبع الشحنة المباشرة لدى شركة الشحن"
                                >
                                  <ExternalLink size={10} />
                                  <span>تتبع الشحنة 🚚</span>
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 font-bold text-slate-800">{o.customerName}</td>
                          <td className="py-3.5 px-3 text-slate-700">{(o.items || []).map(i => i.name || i.productName).join('، ')}</td>
                          <td className="py-3.5 px-3 text-center font-bold text-slate-800">{o.status}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-900">{collected > 0 ? `${collected.toLocaleString()} ج.م` : '—'}</td>
                          <td className="py-3.5 px-3 text-center font-mono font-bold text-sky-800">{goodsCost.toLocaleString()} ج.م</td>
                          <td className="py-3.5 px-3 text-center font-mono font-black text-emerald-700">{netForMerchant.toLocaleString()} ج.م</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Transparency */}
        {currentTab === 'transparency' && (
          <MerchantTransparencyTab
            orders={rawOrders}
            settings={settings}
            customers={activeStoreData?.customers || []}
            initialMerchantIdOrName={liveMerchant.id || liveMerchant.name}
          />
        )}

        {/* TAB 4: Withdrawals */}
        {currentTab === 'withdrawals' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-lg font-black text-slate-900">سجل طلبات سحب المستحقات</h3>
              <button
                onClick={() => setShowRequestModal(true)}
                className="px-4 py-2 bg-[#008060] text-white rounded-xl text-xs font-black cursor-pointer"
              >
                + طلب سحب جديد
              </button>
            </div>

            <div className="space-y-3">
              {merchantFilteredRequests.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold">لا توجد طلبات سحب مستحقات مسجلة لهذا الموكل حتى الآن</div>
              ) : (
                merchantFilteredRequests.map(r => {
                  const isPending = r.status === 'pending';
                  const isApproved = r.status === 'approved';

                  const badgeClass = isPending 
                    ? 'bg-amber-100 text-amber-800 border-amber-200' 
                    : isApproved 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                    : 'bg-rose-100 text-rose-800 border-rose-200';

                  const statusLabel = isPending 
                    ? 'قيد المراجعة ⏳' 
                    : isApproved 
                    ? 'تم الاعتماد والتحويل ✅' 
                    : 'تم رفض الطلب ❌';

                  return (
                    <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-mono font-black text-slate-900">{r.amount.toLocaleString()} ج.م</div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {new Date(r.createdAt || r.date).toLocaleDateString('ar-EG')} · {r.typeArabic || 'طلب سحب مستحقات'} {r.notes ? `(${r.notes})` : ''}
                        </div>
                      </div>
                      <span className={`font-black px-3 py-1 rounded-full text-[11px] border ${badgeClass}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB: Statement / Ledger */}
        {currentTab === 'statement' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
             <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                   <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <FileText className="text-[#008060]" size={18} />
                      <span>كشف الحساب التفصيلي والمحفظة</span>
                   </h3>
                   <p className="text-[11px] text-slate-500 font-medium mt-0.5">سجل كامل بجميع العمليات المالية، كشوف التسوية، وطلبات السحب المعتمدة</p>
                </div>
                <div className="px-4 py-2 bg-[#008060] text-white rounded-2xl flex items-center gap-3 shadow-md shadow-emerald-500/10">
                   <div className="text-[10px] font-bold opacity-80 uppercase tracking-wider text-emerald-100">الرصيد المتاح حالياً</div>
                   <div className="text-lg font-black font-mono">{overviewStats.persistentBalance.toLocaleString()} <span className="text-[10px]">ج.م</span></div>
                </div>
             </div>
             
             <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                   <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                      <tr>
                         <th className="py-3 px-4">التاريخ</th>
                         <th className="py-3 px-4">نوع العملية</th>
                         <th className="py-3 px-4 text-right">البيان / الملاحظات</th>
                         <th className="py-3 px-4 text-center">المبلغ</th>
                         <th className="py-3 px-4 text-center">الرصيد بعد العملية</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {(liveMerchant?.transactions || []).length === 0 ? (
                         <tr>
                            <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">لا توجد عمليات مسجلة في كشف الحساب حتى الآن</td>
                         </tr>
                      ) : (
                         (liveMerchant?.transactions || []).map(tx => (
                            <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                               <td className="py-4 px-4 font-mono text-[11px]">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                               <td className="py-4 px-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                     tx.type === 'order_delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                     tx.type === 'withdrawal' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                     'bg-slate-50 text-slate-700 border-slate-100'
                                  }`}>
                                     {tx.type === 'order_delivered' ? 'تسوية مبيعات' : 
                                      tx.type === 'withdrawal' ? 'سحب رصيد' : 
                                      tx.type === 'adjustment' ? 'تعديل رصيد' : tx.type}
                                  </span>
                               </td>
                               <td className="py-4 px-4 text-slate-500 max-w-xs truncate">{tx.notes}</td>
                               <td className={`py-4 px-4 text-center font-black font-mono ${tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                               </td>
                               <td className="py-4 px-4 text-center font-black font-mono text-slate-900">
                                  {tx.balanceAfter.toLocaleString()}
                               </td>
                            </tr>
                         ))
                      )}
                   </tbody>
                </table>
             </div>
          </div>
        )}

        {/* TAB 5: Account & Security */}
        {currentTab === 'account' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#008060] text-white flex items-center justify-center font-black text-xl">
                  {liveMerchant.name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">{liveMerchant.name}</h3>
                  <p className="text-xs text-slate-500">كود الموكل / المورد: {liveMerchant.id}</p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-bold">المتجر التابع له:</span>
                  <span className="font-black text-slate-900">{storeName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-bold">صفة ونوع الحساب:</span>
                  <span className="font-black text-[#008060]">موكل / مورد صاحب بضاعة</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-bold">حالة الحساب:</span>
                  <span className="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    نشط ومفعل بالبوابة
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <Key size={22} className="text-[#008060]" />
                <div>
                  <h3 className="font-black text-base text-slate-900">أمان الحساب ورمز PIN</h3>
                  <p className="text-xs text-slate-500">تغيير رمز المرور الخاص بتسجيل دخولك للبوابة</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                رمز PIN الحالي الخاص بك مؤمن. يمكنك تغييره في أي وقت لضمان خصوصية بياناتك المالية.
              </p>
            </div>
          </div>
        )}

      </main>

      {/* Payout Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-base text-slate-900">طلب سحب مستحقات البضائع</h3>
              <button onClick={() => setShowRequestModal(false)} className="p-1 rounded-lg hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-700 mb-1">المبلغ المطلوب سحبه (ج.م):</label>
                <input
                  type="number"
                  value={requestAmount}
                  onChange={e => setRequestAmount(e.target.value)}
                  placeholder="مثال: 5000"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-black"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1">طريقة التحويل المفضلة:</label>
                <select
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value as any)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="wallet">محفظة فودافون كاش / اتصالات</option>
                  <option value="instapay">انستا باي InstaPay</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="cash">استلام نقدي كاش من الخزينة</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1">رقم المحفظة / الحساب للتحويل:</label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={e => setPayoutAccount(e.target.value)}
                  placeholder="010XXXXXXXX أو اسم المستخدم"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                />
              </div>

              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-[10px] text-indigo-700 leading-relaxed">
                ℹ️ سيصل طلبك فوراً إلى إدارة المتجر في قسم <strong>"تسويات الموكلين"</strong>، وسيتم مراجعته واعتماده مالياً وفقاً لدورة التحصيل المتبعة.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2.5 bg-slate-100 rounded-xl">إلغاء</button>
                <button type="submit" disabled={isSubmittingRequest} className="px-5 py-2.5 bg-[#008060] text-white rounded-xl font-black">
                  {isSubmittingRequest ? 'جاري الإرسال...' : 'إرسال الطلب الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
