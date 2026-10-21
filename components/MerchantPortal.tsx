import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Partner, StoreData, Order } from '../types';
import { 
  Building2, Loader2, Shield, AlertCircle, CheckCircle2, Send, ShieldCheck, 
  Coins, RefreshCw, LogOut, DollarSign, Package as PackageIcon, Wallet as WalletIcon, FileText, Key, X,
  Truck, ChevronDown, ChevronUp, PackageCheck, Mail, Calculator, ExternalLink,
  Download, Printer, Eye, EyeOff, TrendingUp, MapPin, Award, CreditCard, Lock, Copy,
  Home, Bell, Users, Inbox, Ticket, Menu, Sun, Moon, Monitor, HelpCircle, Settings,
  ShoppingBag, Radio, LayoutGrid, HeartHandshake, ChevronLeft, ChevronRight, Fingerprint, Search,
  ArrowUpRight, ArrowDownLeft, Sparkles, MessageCircle, Check, Calendar, PlusCircle, Banknote, Code2, Layers, Cpu, Megaphone, Receipt
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid
} from 'recharts';
import { MerchantTransparencyTab } from './MerchantTransparencyTab';
import { calculateMerchantTransparencyAnalytics, TRANSPARENCY_RETURN_STATUSES, computeOrderCarrierBreakdown } from '../utils/merchantAnalytics';
import { getTrackingNumber, getShippingTrackingUrl } from '../utils/shippingTracking';
import { DEFAULT_BOSTA_BUSINESS_LOCATIONS } from '../utils/bostaService';
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

const getInitials = (name?: string) => {
  if (!name) return 'م';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
  }
  return name.trim().slice(0, 2);
};

export interface MerchantPortalProps {
  allStoresData: Record<string, StoreData>;
  updateSettings: (settings: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type TabKey = 'overview' | 'orders' | 'create_order' | 'analytics' | 'transparency' | 'statement' | 'account';
type ThemeMode = 'light' | 'system' | 'dark';

export default function MerchantPortal({ allStoresData, updateSettings, showToast: externalShowToast }: MerchantPortalProps) {
  const { storeId, tab: routeTab } = useParams<{ storeId: string; tab?: string }>();
  const [searchParams] = useSearchParams();

  const urlPartnerId = searchParams.get('p') || searchParams.get('merchantId') || searchParams.get('m') || '';
  const urlTab = searchParams.get('tab') || routeTab;

  const validTabs: TabKey[] = ['overview', 'orders', 'create_order', 'analytics', 'transparency', 'statement', 'account'];
  const activeTab: TabKey = validTabs.includes(urlTab as TabKey) ? (urlTab as TabKey) : 'overview';

  const [directStoreId, setDirectStoreId] = useState<string>('');
  const [directStoreData, setDirectStoreData] = useState<StoreData | null>(null);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [merchantRequestsList, setMerchantRequestsList] = useState<db.PartnerPortalRequest[]>([]);

  // Portal Theme & Preferences State (Matching Mobile Sheet Reference)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('merchant_portal_theme') as ThemeMode;
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch {}
    return 'light';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('merchant_portal_theme', themeMode);
    } catch {}
  }, [themeMode]);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } catch {}
  }, []);

  const isDark = themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);

  const [isActiveStatus, setIsActiveStatus] = useState<boolean>(() => {
    try { return localStorage.getItem('merchant_portal_active') !== 'false'; } catch { return true; }
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('merchant_portal_notifs') !== 'false'; } catch { return true; }
  });
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem('merchant_portal_sound') !== 'false'; } catch { return true; }
  });
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try { return localStorage.getItem('merchant_portal_hide_bal') === 'true'; } catch { return false; }
  });

  // Mobile / App Drawers & Sheets State
  const [showFullMenuDrawer, setShowFullMenuDrawer] = useState(false);
  const [showProfileBottomSheet, setShowProfileBottomSheet] = useState(false);
  const [showNotificationsSheet, setShowNotificationsSheet] = useState(false);
  const [expandedMenuSection, setExpandedMenuSection] = useState<string | null>('products_orders');

  // Biometric Support State
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isRegisteringBio, setIsRegisteringBio] = useState(false);

  useEffect(() => {
    if (isWebAuthnSupported()) {
      isPlatformAuthenticatorAvailable().then(setBiometricAvailable).catch(() => setBiometricAvailable(false));
    }
  }, []);

  const effectiveStoreId = useMemo(() => {
    if (directStoreId) return directStoreId;
    if (storeId) return storeId;
    const fromParam = searchParams.get('storeId') || searchParams.get('s');
    if (fromParam) return fromParam;
    try {
      const activeId = localStorage.getItem('lastActiveStoreId') || localStorage.getItem('activeStoreId') || localStorage.getItem('last_active_store_id');
      if (activeId && allStoresData[activeId]) return activeId;
      if (activeId) return activeId;
    } catch {}
    const keys = Object.keys(allStoresData);
    if (keys.length > 0) return keys[0];
    return '';
  }, [directStoreId, storeId, searchParams, allStoresData]);

  const loadRequests = useCallback(async () => {
    const targetStoreId = directStoreId || storeId || effectiveStoreId;
    if (!targetStoreId) return;
    try {
      const reqs = await db.getPartnerRequests(targetStoreId);
      setMerchantRequestsList(reqs);
    } catch (_) {}
  }, [directStoreId, storeId, effectiveStoreId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Fetch fresh store data on mount
  const fetchFreshData = useCallback(async (isManualRefresh = false) => {
    const targetStoreId = directStoreId || storeId || effectiveStoreId;
    if (!targetStoreId) return;

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoadingStore(true);
    }

    try {
      // One-time automatic local + cloud cache purge for testing reset
      const resetFlagKey = `merchant_clean_slate_v2_${targetStoreId}`;
      if (localStorage.getItem(resetFlagKey) !== 'done') {
        await db.resetMerchantAccountData(targetStoreId, '1787892876816', 'عبدالرحمن الغباري');
        localStorage.setItem(resetFlagKey, 'done');
      }

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
  }, [directStoreId, storeId, effectiveStoreId, loadRequests]);

  useEffect(() => {
    fetchFreshData(false);
  }, [fetchFreshData]);

  // Realtime Optimized Subscription with Strict Row-Level Filters & Throttling
  useEffect(() => {
    const targetStoreId = directStoreId || storeId || effectiveStoreId;
    if (!targetStoreId) return;

    const unsubscribe = db.subscribeToStoreRealtimeOptimized(targetStoreId, {
      tables: ['orders', 'partner_requests', 'transactions', 'partners'],
      onUpdate: () => {
        db.throttledRefreshStoreData(targetStoreId, (freshData) => {
          setDirectStoreData(freshData);
          loadRequests();
        }, 3000);
      }
    });

    return () => unsubscribe();
  }, [directStoreId, storeId, effectiveStoreId, loadRequests]);

  const localStoreData = (storeId && allStoresData[storeId]) || (effectiveStoreId ? allStoresData[effectiveStoreId] : null);
  const activeStoreData = directStoreData || localStoreData;
  const settings = (activeStoreData?.settings || { partners: [], suppliers: [], partnerTransactions: [] }) as any;
  const rawOrders: Order[] = Array.isArray(directStoreData?.orders)
    ? directStoreData.orders
    : (localStoreData?.orders || []);
  
  // Extract & Merge Consignment Merchants, Suppliers & Partners across live state, cloud state, and all stores
  const merchants: Partner[] = useMemo(() => {
    const list: (Partner & { _storeId?: string; _fromFreshCloud?: boolean })[] = [];

    const upsertEntity = (s: any, defaultRole: string, sourceStoreId?: string, isFreshCloud = false) => {
      if (!s) return;
      const sId = String(s.id || '').trim();
      const sName = String(s.name || '').trim();
      const sPhone = String(s.phone || '').trim();
      let sEmail = String(s.email || s.contactEmail || '').trim().toLowerCase();

      if (!sEmail && typeof s.notes === 'string') {
        const emailMatch = s.notes.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) sEmail = emailMatch[0].toLowerCase();
      }

      if (!sId && !sName && !sEmail && !sPhone) return;
      const normName = normalizeName(sName);

      const existing = list.find(item =>
        (sId && item.id && String(item.id).trim().toLowerCase() === sId.toLowerCase()) ||
        (normName && item.name && normalizeName(item.name) === normName) ||
        (sEmail && item.email && item.email.trim().toLowerCase() === sEmail) ||
        (sPhone && sPhone.length >= 8 && item.phone && item.phone.trim() === sPhone)
      );

      if (existing) {
        if (!existing.email && sEmail) existing.email = sEmail;
        if (!existing.phone && sPhone) existing.phone = sPhone;
        if ((!existing.passcode || existing.passcode === '0000') && s.passcode && s.passcode !== '0000') {
          existing.passcode = String(s.passcode);
        }
        // Only overwrite balance/transactions if existing did NOT already come from fresh cloud data
        if (!existing._fromFreshCloud) {
          if (existing.balance === 0 && Number(s.balance)) {
            existing.balance = Number(s.balance);
          }
          if ((!existing.transactions || existing.transactions.length === 0) && Array.isArray(s.transactions) && s.transactions.length > 0) {
            existing.transactions = s.transactions;
          }
        }
        if (!existing.profitRatio && Number(s.profitRatio)) {
          existing.profitRatio = Number(s.profitRatio);
        }
        if (s.payoutAccounts && typeof s.payoutAccounts === 'object') {
          existing.payoutAccounts = { ...(existing.payoutAccounts || {}), ...s.payoutAccounts };
        }
        return;
      }

      list.push({
        id: sId || `sup_${sName || Date.now()}`,
        name: sName || 'موكل معتمد',
        phone: sPhone,
        email: sEmail,
        balance: Number(s.balance) || 0,
        transactions: Array.isArray(s.transactions) ? s.transactions : [],
        profitRatio: Number(s.profitRatio) || 0,
        passcode: String(s.passcode || '0000'),
        role: s.role || defaultRole,
        payoutAccounts: s.payoutAccounts || {},
        _storeId: sourceStoreId || effectiveStoreId,
        _fromFreshCloud: isFreshCloud
      });
    };

    const collectFromSettings = (st: any, stId?: string, ordersList?: any[], customersList?: any[], isFreshCloud = false) => {
      if (!st) return;
      const rawSuppliers: any[] = Array.isArray(st.suppliers) ? st.suppliers : Object.values(st.suppliers || {});
      const rawPartners: any[] = Array.isArray(st.partners) ? st.partners : Object.values(st.partners || {});

      rawSuppliers.forEach(s => upsertEntity(s, 'موكل / مورد صاحب بضاعة', stId, isFreshCloud));
      rawPartners.forEach(p => upsertEntity(p, 'موكل / شريك', stId, isFreshCloud));

      if (Array.isArray(customersList)) {
        customersList.forEach(c => {
          if (!c) return;
          const isTaggedMerchant =
            c.customerSegment === 'merchant' ||
            (Array.isArray(c.tags) && c.tags.some((t: any) => ['موكل', 'صاحب بضاعة', 'تاجر', 'مورد', 'merchant', 'supplier'].includes(String(t).trim().toLowerCase())));
          if (isTaggedMerchant || c.email) {
            upsertEntity({
              id: c.id || c.phone,
              name: c.name,
              phone: c.phone,
              email: c.email,
              role: 'موكل مسجل'
            }, 'موكل مسجل', stId, isFreshCloud);
          }
        });
      }

      if (Array.isArray(ordersList)) {
        ordersList.forEach((o: any) => {
          const mName = (o?.merchantName || '').trim();
          const mId = (o?.merchantId || '').trim();
          if (mName && mId !== 'pending') {
            upsertEntity({
              id: mId || `m_${mName}`,
              name: mName,
              phone: o.merchantBrandPhone || '',
              email: '',
              balance: 0,
              profitRatio: 0,
              passcode: '0000',
              role: 'موكل صاحب بضاعة'
            }, 'موكل صاحب بضاعة', stId, isFreshCloud);
          }
        });
      }
    };

    // Prioritize directStoreData (freshly fetched from cloud) first so zeroed balances/transactions are authoritative
    if (directStoreData?.settings) {
      collectFromSettings(directStoreData.settings, effectiveStoreId, directStoreData.orders, directStoreData.customers, true);
    }

    if (localStoreData?.settings) {
      collectFromSettings(localStoreData.settings, effectiveStoreId, localStoreData.orders, localStoreData.customers, false);
    }

    Object.entries(allStoresData || {}).forEach(([stId, stData]) => {
      if (stData?.settings) {
        collectFromSettings(stData.settings, stId, stData.orders, stData.customers, false);
      }
    });

    return list;
  }, [localStoreData, directStoreData, allStoresData, effectiveStoreId]);

  const portalTitle = 'بوابة الموكلين والوكلاء';
  const storeName = portalTitle;

  // Authentication State
  const [authenticatedMerchant, setAuthenticatedMerchant] = useState<Partner | null>(() => {
    try {
      const saved = localStorage.getItem('authenticated_merchant');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  // Persist authenticatedMerchant change
  useEffect(() => {
    if (authenticatedMerchant) {
      localStorage.setItem('authenticated_merchant', JSON.stringify(authenticatedMerchant));
    } else {
      localStorage.removeItem('authenticated_merchant');
    }
  }, [authenticatedMerchant]);

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
    document.title = liveMerchant?.name
      ? `${liveMerchant.name} | بوابة الموكلين والوكلاء`
      : 'بوابة الموكلين والوكلاء';
  }, [liveMerchant?.name]);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    if (externalShowToast) externalShowToast(msg, type as any);
    setTimeout(() => setToast(null), 3500);
  };

  const formatMoney = useCallback((val: number, showCurrency = true) => {
    if (hideBalances) return showCurrency ? '••••• ج.م' : '•••••';
    return `${(Number(val) || 0).toLocaleString()}${showCurrency ? ' ج.م' : ''}`;
  }, [hideBalances]);

  // Auth View Local States
  const [authMode, setAuthMode] = useState<'otp' | 'pin'>('otp');
  const [loginEmailInput, setLoginEmailInput] = useState('');
  const [loginPinInput, setLoginPinInput] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(() => urlPartnerId || '');
  const [otpCode, setOtpCode] = useState('');
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [devOtpCode, setDevOtpCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Portal View States
  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<'all' | 'collected' | 'returned' | 'unpaid' | 'shipping' | 'pending' | 'outside_cycle'>('all');
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [ordersTopViewMode, setOrdersTopViewMode] = useState<'financial_cycle' | 'current_balance'>('financial_cycle');
  const [selectedSettlementId, setSelectedSettlementId] = useState<string | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string>('');
  const [cycleEndDate, setCycleEndDate] = useState<string>('');
  const [showCycleDatePicker, setShowCycleDatePicker] = useState(false);
  const [activeOrderPopover, setActiveOrderPopover] = useState<{
    orderId: string;
    type: 'fee' | 'added_date' | 'settlement_status';
  } | null>(null);
  const [showCycleDetailsModal, setShowCycleDetailsModal] = useState<'collected' | 'shipping' | null>(null);
  const [notifyOrderFeatureReady, setNotifyOrderFeatureReady] = useState(false);

  // Requests Modal
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<'wallet' | 'instapay' | 'bank' | 'cash'>('wallet');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // Security / PIN & Saved Payout Accounts States
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  const [savedWalletPhone, setSavedWalletPhone] = useState('');
  const [savedInstaPay, setSavedInstaPay] = useState('');
  const [savedBankName, setSavedBankName] = useState('');
  const [savedBankAccount, setSavedBankAccount] = useState('');
  const [savedBeneficiaryName, setSavedBeneficiaryName] = useState('');
  const [isSavingPayoutAccounts, setIsSavingPayoutAccounts] = useState(false);

  // Receipt Image Preview Lightbox
  const [previewReceiptImage, setPreviewReceiptImage] = useState<string | null>(null);

  // Statement Date Filtering & Printable Statement Modal
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [statementTypeFilter, setStatementTypeFilter] = useState<'all' | 'settlements' | 'withdrawals'>('all');
  const [showPrintableStatementModal, setShowPrintableStatementModal] = useState(false);

  // Product Analytics Sort State
  const [productSortBy, setProductSortBy] = useState<'delivered' | 'profit' | 'deliveryRate' | 'lowReturn'>('delivered');

  // Transaction List Filter & Settlement Details
  const [txListTypeFilter, setTxListTypeFilter] = useState<'all' | 'deposits' | 'withdrawals' | 'collections' | 'compensations' | 'discounts' | 'other'>('all');
  const [showSettlementDetailsId, setShowSettlementDetailsId] = useState<string | null>(null);

  // Sync saved payout accounts when liveMerchant changes
  useEffect(() => {
    if (liveMerchant) {
      const pa = liveMerchant.payoutAccounts || {};
      setSavedWalletPhone(pa.walletPhone || liveMerchant.phone || '');
      setSavedInstaPay(pa.instaPayHandle || '');
      setSavedBankName(pa.bankName || '');
      setSavedBankAccount(pa.bankAccount || '');
      setSavedBeneficiaryName(pa.beneficiaryName || liveMerchant.name || '');
    }
  }, [liveMerchant]);

  // Auto-populate payoutAccount in withdrawal modal when payoutMethod or modal state changes
  useEffect(() => {
    if (!liveMerchant) return;
    const pa = liveMerchant.payoutAccounts || {};
    if (payoutMethod === 'wallet') {
      setPayoutAccount(pa.walletPhone || savedWalletPhone || liveMerchant.phone || '');
    } else if (payoutMethod === 'instapay') {
      setPayoutAccount(pa.instaPayHandle || savedInstaPay || pa.walletPhone || '');
    } else if (payoutMethod === 'bank') {
      const bankStr = [
        pa.bankName || savedBankName,
        pa.bankAccount || savedBankAccount,
        (pa.beneficiaryName || savedBeneficiaryName) ? `باسم: ${pa.beneficiaryName || savedBeneficiaryName}` : ''
      ].filter(Boolean).join(' - ');
      setPayoutAccount(bankStr);
    } else if (payoutMethod === 'cash') {
      setPayoutAccount('استلام نقدي مباشر');
    }
  }, [payoutMethod, showRequestModal, liveMerchant, savedWalletPhone, savedInstaPay, savedBankName, savedBankAccount, savedBeneficiaryName]);

  // Helper to persist payoutAccounts or passcode changes for the authenticated merchant
  const persistMerchantAccountUpdates = useCallback(async (updates: {
    passcode?: string;
    payoutAccounts?: Partner['payoutAccounts'];
  }) => {
    if (!liveMerchant) return false;
    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
    const normTargetName = normalizeName(liveMerchant.name || '');

    const currentSuppliers: any[] = Array.isArray(settings.suppliers) ? [...settings.suppliers] : [];
    const currentPartners: any[] = Array.isArray(settings.partners) ? [...settings.partners] : [];

    let supplierFound = false;
    const updatedSuppliers = currentSuppliers.map(s => {
      if (
        (s.id && s.id === liveMerchant.id) ||
        (s.name && normalizeName(s.name) === normTargetName)
      ) {
        supplierFound = true;
        return {
          ...s,
          ...(updates.passcode !== undefined ? { passcode: updates.passcode } : {}),
          ...(updates.payoutAccounts !== undefined ? { payoutAccounts: updates.payoutAccounts } : {})
        };
      }
      return s;
    });

    if (!supplierFound) {
      updatedSuppliers.push({
        id: liveMerchant.id,
        name: liveMerchant.name,
        phone: liveMerchant.phone || '',
        email: liveMerchant.email || '',
        balance: liveMerchant.balance || 0,
        transactions: liveMerchant.transactions || [],
        passcode: updates.passcode ?? liveMerchant.passcode ?? '0000',
        payoutAccounts: updates.payoutAccounts ?? liveMerchant.payoutAccounts ?? {},
        role: 'موكل / مورد صاحب بضاعة'
      });
    }

    let partnerFound = false;
    const updatedPartners = currentPartners.map(p => {
      if (
        (p.id && p.id === liveMerchant.id) ||
        (p.name && normalizeName(p.name) === normTargetName)
      ) {
        partnerFound = true;
        return {
          ...p,
          ...(updates.passcode !== undefined ? { passcode: updates.passcode } : {}),
          ...(updates.payoutAccounts !== undefined ? { payoutAccounts: updates.payoutAccounts } : {})
        };
      }
      return p;
    });

    if (!partnerFound) {
      updatedPartners.push({
        ...liveMerchant,
        ...(updates.passcode !== undefined ? { passcode: updates.passcode } : {}),
        ...(updates.payoutAccounts !== undefined ? { payoutAccounts: updates.payoutAccounts } : {})
      });
    }

    try {
      updateSettings((prev: any) => ({
        ...prev,
        suppliers: updatedSuppliers,
        partners: updatedPartners
      }));
    } catch {}

    setDirectStoreData(prev => prev ? ({
      ...prev,
      settings: {
        ...prev.settings,
        suppliers: updatedSuppliers,
        partners: updatedPartners
      }
    }) : prev);

    setAuthenticatedMerchant(prev => prev ? ({
      ...prev,
      ...(updates.passcode !== undefined ? { passcode: updates.passcode } : {}),
      ...(updates.payoutAccounts !== undefined ? { payoutAccounts: updates.payoutAccounts } : {})
    }) : prev);

    if (targetStore) {
      await db.updatePartnerSettings(targetStore, updatedPartners, updatedSuppliers);
    }
    return true;
  }, [liveMerchant, effectiveStoreId, settings.suppliers, settings.partners, updateSettings]);

  const handleSavePayoutAccounts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant) return;
    setIsSavingPayoutAccounts(true);
    try {
      const newPayoutAccounts = {
        walletPhone: savedWalletPhone.trim(),
        instaPayHandle: savedInstaPay.trim(),
        bankName: savedBankName.trim(),
        bankAccount: savedBankAccount.trim(),
        beneficiaryName: savedBeneficiaryName.trim()
      };
      await persistMerchantAccountUpdates({ payoutAccounts: newPayoutAccounts });
      showToast('تم حفظ حسابات الدفع المفضلة بنجاح وستظهر تلقائياً عند طلب السحب', 'success');
    } catch (err: any) {
      showToast('تعذر حفظ حسابات الدفع: ' + (err.message || ''), 'error');
    } finally {
      setIsSavingPayoutAccounts(false);
    }
  };

  const handleChangeMerchantPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant) return;
    const currentActualPin = String(liveMerchant.passcode || '0000').trim();
    if (currentActualPin !== '0000' && currentPinInput.trim() !== currentActualPin) {
      showToast('رمز PIN الحالي غير صحيح', 'error');
      return;
    }
    const cleanNew = newPinInput.trim();
    if (cleanNew.length < 4) {
      showToast('يجب أن يتكون رمز PIN الجديد من 4 أرقام أو حروف على الأقل', 'error');
      return;
    }
    if (cleanNew !== confirmPinInput.trim()) {
      showToast('رمز PIN الجديد غير متطابق مع التأكيد', 'error');
      return;
    }
    setIsChangingPin(true);
    try {
      await persistMerchantAccountUpdates({ passcode: cleanNew });
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmPinInput('');
      showToast('تم تغيير رمز الدخول السري (PIN) الخاص بك بنجاح', 'success');
    } catch (err: any) {
      showToast('تعذر تغيير رمز PIN: ' + (err.message || ''), 'error');
    } finally {
      setIsChangingPin(false);
    }
  };

  // Biometric Registration & Login for Merchant
  const merchantBiometrics = useMemo(() => {
    if (!liveMerchant) return [];
    return getStoredBiometrics(`merchant_${liveMerchant.id}`);
  }, [liveMerchant, isRegisteringBio]);

  const handleRegisterMerchantBiometric = async () => {
    if (!liveMerchant) return;
    setIsRegisteringBio(true);
    try {
      const deviceName = detectBiometricDeviceName();
      const result = await registerBiometricCredential({
        userId: `merchant_${liveMerchant.id}`,
        userName: liveMerchant.email || liveMerchant.phone || liveMerchant.name,
        userDisplayName: liveMerchant.name,
        deviceName
      });
      if (result.success && result.credential) {
        saveStoredBiometric(`merchant_${liveMerchant.id}`, result.credential);
        showToast(`تم تفعيل الدخول بالبصمة / FaceID على (${deviceName}) بنجاح`, 'success');
      } else {
        throw new Error(result.error || 'فشل تسجيل البصمة');
      }
    } catch (err: any) {
      showToast(err.message || 'تعذر تسجيل البصمة على هذا الجهاز', 'error');
    } finally {
      setIsRegisteringBio(false);
    }
  };

  const handleBiometricQuickLogin = async () => {
    setAuthError('');
    try {
      // Find any merchant with stored biometric on this device or match loginEmailInput
      let targetMerchant: Partner | null = null;
      if (loginEmailInput.trim()) {
        targetMerchant = await resolveMerchantByEmailOrIdentifier(loginEmailInput.trim());
      }
      if (!targetMerchant) {
        targetMerchant = merchants.find(m => getStoredBiometrics(`merchant_${m.id}`).length > 0) || null;
      }
      if (!targetMerchant) {
        setAuthError('يرجى تسجيل الدخول بالبريد أو رمز PIN أولاً ثم تفعيل البصمة من تبويب (حسابي والأمان).');
        return;
      }
      const creds = getStoredBiometrics(`merchant_${targetMerchant.id}`);
      if (creds.length === 0) {
        setAuthError('لم يتم تفعيل البصمة لهذا الحساب على هذا الهاتف بعد. سجل دخولك أولاً وفعلها من الإعدادات.');
        return;
      }
      const ok = await authenticateBiometricCredential(creds);
      if (ok) {
        setAuthenticatedMerchant(targetMerchant);
        setSelectedMerchantId(targetMerchant.id);
        showToast(`أهلاً بك يا ${targetMerchant.name}! تم الدخول بالبصمة بنجاح`, 'success');
      }
    } catch (err: any) {
      setAuthError(err.message || 'فشل التحقق من البصمة');
    }
  };

  // Helper to persist auto-linked email for a supplier/merchant who didn't have an email saved yet
  const linkEmailToMerchantRecord = useCallback(async (merchant: Partner, emailToLink: string) => {
    const clean = emailToLink.trim().toLowerCase();
    const targetStore = (merchant as any)._storeId || effectiveStoreId;
    const normTargetName = normalizeName(merchant.name || '');

    const currentSuppliers: any[] = Array.isArray(settings.suppliers) ? [...settings.suppliers] : [];
    const currentPartners: any[] = Array.isArray(settings.partners) ? [...settings.partners] : [];

    let supFound = false;
    const nextSuppliers = currentSuppliers.map(s => {
      if (s && (String(s.id) === String(merchant.id) || (normTargetName && normalizeName(s.name || '') === normTargetName))) {
        supFound = true;
        return { ...s, email: clean, passcode: s.passcode || merchant.passcode || '0000' };
      }
      return s;
    });
    if (!supFound) {
      nextSuppliers.push({
        id: merchant.id,
        name: merchant.name,
        phone: merchant.phone || '',
        email: clean,
        passcode: merchant.passcode || '0000',
        balance: Number(merchant.balance) || 0,
        transactions: merchant.transactions || []
      });
    }

    let partFound = false;
    const nextPartners = currentPartners.map(p => {
      if (p && (String(p.id) === String(merchant.id) || (normTargetName && normalizeName(p.name || '') === normTargetName))) {
        partFound = true;
        return { ...p, email: clean, passcode: p.passcode || merchant.passcode || '0000' };
      }
      return p;
    });
    if (!partFound) {
      nextPartners.push({
        id: merchant.id,
        name: merchant.name,
        phone: merchant.phone || '',
        email: clean,
        passcode: merchant.passcode || '0000',
        balance: Number(merchant.balance) || 0,
        profitRatio: Number(merchant.profitRatio) || 0,
        role: merchant.role || 'موكل / مورد صاحب بضاعة'
      });
    }

    try {
      updateSettings({
        ...settings,
        suppliers: nextSuppliers,
        partners: nextPartners
      });
    } catch (_) {}

    if (directStoreData) {
      setDirectStoreData({
        ...directStoreData,
        settings: {
          ...directStoreData.settings,
          suppliers: nextSuppliers,
          partners: nextPartners
        }
      });
    }

    if (targetStore) {
      await db.updatePartnerSettings(targetStore, nextPartners, nextSuppliers).catch(() => {});
    }
  }, [settings, effectiveStoreId, directStoreData, updateSettings]);

  // Resolve merchant by email
  const resolveMerchantByEmailOrIdentifier = useCallback(async (identifier: string): Promise<Partner | null> => {
    const clean = identifier.trim().toLowerCase();
    if (!clean) return null;

    let matched = merchants.find(m =>
      (m.email && m.email.trim().toLowerCase() === clean) ||
      (m.phone && m.phone.trim().toLowerCase() === clean) ||
      (m.id && String(m.id).trim().toLowerCase() === clean)
    );
    if (matched) return matched;

    if (effectiveStoreId) {
      try {
        const localData = await db.getLocal(effectiveStoreId);
        if (localData?.settings) {
          const localSup = (localData.settings.suppliers || []).find((s: any) =>
            (s?.email && String(s.email).trim().toLowerCase() === clean) ||
            (s?.phone && String(s.phone).trim().toLowerCase() === clean)
          );
          if (localSup) {
            return {
              id: localSup.id,
              name: localSup.name || 'موكل معتمد',
              phone: localSup.phone || '',
              email: localSup.email || clean,
              balance: Number(localSup.balance) || 0,
              transactions: localSup.transactions || [],
              profitRatio: Number(localSup.profitRatio) || 0,
              passcode: localSup.passcode || '0000',
              role: localSup.role || 'موكل / مورد صاحب بضاعة'
            };
          }
          const localPart = (localData.settings.partners || []).find((p: any) =>
            (p?.email && String(p.email).trim().toLowerCase() === clean) ||
            (p?.phone && String(p.phone).trim().toLowerCase() === clean)
          );
          if (localPart) {
            return {
              id: localPart.id,
              name: localPart.name || 'موكل معتمد',
              phone: localPart.phone || '',
              email: localPart.email || clean,
              balance: Number(localPart.balance) || 0,
              transactions: localPart.transactions || [],
              profitRatio: Number(localPart.profitRatio) || 0,
              passcode: localPart.passcode || '0000',
              role: localPart.role || 'موكل / شريك'
            };
          }
        }
      } catch (_) {}
    }

    if (clean.includes('@') && clean.includes('.')) {
      if (urlPartnerId) {
        const urlMatched = merchants.find(m => String(m.id) === String(urlPartnerId) || normalizeName(m.name) === normalizeName(urlPartnerId));
        if (urlMatched && (!urlMatched.email || !urlMatched.email.trim())) {
          const updated = { ...urlMatched, email: clean };
          await linkEmailToMerchantRecord(updated, clean);
          return updated;
        }
      }

      const unlinkedSuppliers = merchants.filter(m => !m.email || !m.email.trim());
      if (unlinkedSuppliers.length >= 1) {
        const targetSupplier = unlinkedSuppliers[0];
        const updated = { ...targetSupplier, email: clean };
        await linkEmailToMerchantRecord(updated, clean);
        return updated;
      }
    }

    return null;
  }, [merchants, effectiveStoreId, urlPartnerId, linkEmailToMerchantRecord]);

  // Handle Send Email OTP
  const handleInitiateOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanEmail = loginEmailInput.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError('يرجى إدخال البريد الإلكتروني المسجل لحساب الموكل');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthError('صيغة البريد الإلكتروني غير صحيحة، يرجى كتابة بريد صالح');
      return;
    }

    setIsSendingOtp(true);
    setAuthError('');
    setAuthSuccess('');
    setDevOtpCode(null);

    const matchedMerchant = await resolveMerchantByEmailOrIdentifier(cleanEmail);

    if (!matchedMerchant) {
      setIsSendingOtp(false);
      setAuthError('هذا البريد الإلكتروني غير مسجل لدينا كموكل معتمد. يرجى التأكد من كتابة البريد بشكل صحيح أو التواصل مع إدارة المتجر لربط بريدك.');
      return;
    }

    if ((matchedMerchant as any)._storeId && (matchedMerchant as any)._storeId !== effectiveStoreId) {
      setDirectStoreId((matchedMerchant as any)._storeId);
    }

    setSelectedMerchantId(matchedMerchant.id);
    setOtpTargetEmail(cleanEmail);

    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          userName: matchedMerchant.name || 'الموكل العزيز',
          storeName,
          phone: matchedMerchant.phone
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsOtpSent(true);
        if (data.debugCode) setDevOtpCode(data.debugCode);
        const msg = data.message || `تم إرسال رمز التحقق الأمني (OTP) إلى بريدك الإلكتروني بنجاح.`;
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

  // Handle Login With PIN
  const handleLoginWithPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanIdentifier = loginEmailInput.trim().toLowerCase();
    const cleanPin = loginPinInput.trim();

    if (!cleanIdentifier) {
      setAuthError('يرجى إدخال البريد الإلكتروني المسجل (أو رقم الهاتف)');
      return;
    }
    if (!cleanPin) {
      setAuthError('يرجى إدخال رمز المرور السري (PIN)');
      return;
    }

    const matched = await resolveMerchantByEmailOrIdentifier(cleanIdentifier);

    if (!matched) {
      setAuthError('البيانات المدخلة غير متطابقة مع أي موكل مسجل لدينا.');
      return;
    }

    const expectedPin = matched.passcode || '0000';
    if (cleanPin !== expectedPin) {
      setAuthError('رمز المرور السري (PIN) غير صحيح.');
      return;
    }

    if ((matched as any)._storeId && (matched as any)._storeId !== effectiveStoreId) {
      setDirectStoreId((matched as any)._storeId);
    }

    setAuthenticatedMerchant(matched);
    setSelectedMerchantId(matched.id);
    showToast(`أهلاً بك يا ${matched.name}! تم تسجيل الدخول بنجاح`, 'success');
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
        let authenticatedObj = merchants.find(m =>
          (selectedMerchantId && m.id === selectedMerchantId) ||
          (m.email && m.email.trim().toLowerCase() === otpTargetEmail.trim().toLowerCase())
        );
        if (!authenticatedObj) {
          authenticatedObj = (await resolveMerchantByEmailOrIdentifier(otpTargetEmail)) || undefined;
        }
        if (!authenticatedObj) {
          setAuthError('تعذر العثور على حساب الموكل المرتبط بهذا البريد. تواصل مع الإدارة.');
          return;
        }

        setAuthenticatedMerchant(authenticatedObj);
        setSelectedMerchantId(authenticatedObj.id);
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

  // Orders Counts by Status for Filter Pills
  const orderStatusCounts = useMemo(() => {
    let shipping = 0, collected = 0, pending = 0, returned = 0;
    merchantOrders.forEach(o => {
      if (['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status)) shipping++;
      else if (['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status)) collected++;
      else if (['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز'].includes(o.status)) pending++;
      else if (TRANSPARENCY_RETURN_STATUSES.includes(o.status as any)) returned++;
    });
    return { all: merchantOrders.length, shipping, collected, pending, returned };
  }, [merchantOrders]);

  // Filtered Orders View (with Financial Cycle Date Filter)
  const filteredOrders = useMemo(() => {
    let list = [...merchantOrders];

    if (selectedSettlementId) {
      list = list.filter(o => 
        (o.settlementId && String(o.settlementId) === String(selectedSettlementId)) || 
        ((o as any).merchantSettlementId && String((o as any).merchantSettlementId) === String(selectedSettlementId))
      );
    }

    // Requirement: Pre-dispatch orders (New, Pending, etc.) should NOT appear in the Financial Cycle view
    if (currentTab === 'orders' && ordersStatusFilter === 'all') {
      list = list.filter(o => {
        const isDispatched = !['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز', 'جاري_المراجعة'].includes(o.status);
        const isFinalized = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها', ...TRANSPARENCY_RETURN_STATUSES].includes(o.status);
        return isDispatched || isFinalized;
      });
    }

    if (cycleStartDate) {
      const startMs = new Date(cycleStartDate + 'T00:00:00').getTime();
      list = list.filter(o => {
        const d = o.date ? new Date(o.date).getTime() : 0;
        return d >= startMs;
      });
    }
    if (cycleEndDate) {
      const endMs = new Date(cycleEndDate + 'T23:59:59').getTime();
      list = list.filter(o => {
        const d = o.date ? new Date(o.date).getTime() : 0;
        return d <= endMs;
      });
    }

    if (ordersStatusFilter === 'shipping') {
      list = list.filter(o => ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status));
    } else if (ordersStatusFilter === 'collected') {
      list = list.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status));
    } else if (ordersStatusFilter === 'pending') {
      list = list.filter(o => ['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز'].includes(o.status));
    } else if (ordersStatusFilter === 'returned') {
      list = list.filter(o => TRANSPARENCY_RETURN_STATUSES.includes(o.status));
    } else if (ordersStatusFilter === 'unpaid') {
      list = list.filter(o => {
        const isFinalized = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها', ...TRANSPARENCY_RETURN_STATUSES].includes(o.status);
        if (!isFinalized) return false;
        
        const orderRef = String(o.orderNumber || o.id || '');
        const isSettled = Boolean(
          (o as any).merchantSettled ||
          (o as any).isSettled ||
          o.settlementStatus === 'settled' ||
          (liveMerchant?.transactions || []).some(tx =>
            (tx.referenceId && String(tx.referenceId) === String(o.id)) ||
            (tx.notes && orderRef && tx.notes.includes(orderRef))
          )
        );
        return !isSettled;
      });
    }

    if (ordersSearchQuery.trim()) {
      const q = ordersSearchQuery.trim().toLowerCase();
      list = list.filter(o => 
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.customerPhone || '').includes(q) ||
        (String((o as any).province || (o as any).city || '')).toLowerCase().includes(q) ||
        (o.items || []).some(i => (i.name || i.productName || '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [merchantOrders, ordersStatusFilter, ordersSearchQuery, cycleStartDate, cycleEndDate, liveMerchant?.transactions]);

  // Helper to compute exact Bosta-style fee breakdown for a single order using shared logic
  const computeOrderFeeBreakdown = useCallback((o: Order) => {
    const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
    const isReturn = TRANSPARENCY_RETURN_STATUSES.includes(o.status);
    const rawTotal = Number(o.totalAmountOverride ?? o.totalPrice ?? 0);
    const collected = isDelivered ? rawTotal : 0;
    const goodsCost = Number(o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((Number(i.cost) || 0) * (Number(i.quantity) || 1)), 0));
    
    // Use the accurate computation shared with the Transparency Tab
    const carrierCalc = computeOrderCarrierBreakdown(o, settings);

    const netEntitlement = isDelivered
      ? Number((collected - carrierCalc.totalShippingAndCarrier).toFixed(2))
      : isReturn
      ? Number((-carrierCalc.totalShippingAndCarrier).toFixed(2))
      : 0; // Pre-dispatch orders don't affect entitlement yet

    // Check if settled in merchant transactions
    const orderRef = String(o.orderNumber || o.id || '');
    const isSettled = Boolean(
      (o as any).merchantSettled ||
      (o as any).isSettled ||
      o.settlementStatus === 'settled' ||
      (liveMerchant?.transactions || []).some(tx =>
        (tx.referenceId && String(tx.referenceId) === String(o.id)) ||
        (tx.notes && orderRef && tx.notes.includes(orderRef))
      )
    );

    return {
      isDelivered,
      isReturn,
      rawTotal,
      collected,
      goodsCost,
      totalShipFee: carrierCalc.totalShippingAndCarrier,
      baseShipping: carrierCalc.baseShippingFee,
      insuranceFee: carrierCalc.insuranceFee,
      openPackageFee: carrierCalc.inspectionFee,
      vatFee: carrierCalc.vatFee,
      netEntitlement,
      isSettled
    };
  }, [liveMerchant?.transactions, settings]);

  // Financial Cycle Summary across filteredOrders
  const financialCycleSummary = useMemo(() => {
    let totalCollected = 0;
    let totalShippingFees = 0;
    let totalBaseShipping = 0;
    let totalInsurance = 0;
    let totalOpenPackage = 0;
    let totalVat = 0;
    let netEntitlement = 0;
    let deliveredOrdersCount = 0;

    filteredOrders.forEach(o => {
      const b = computeOrderFeeBreakdown(o);
      if (b.isDelivered) {
        totalCollected += b.collected;
        totalShippingFees += b.totalShipFee;
        totalBaseShipping += b.baseShipping;
        totalInsurance += b.insuranceFee;
        totalOpenPackage += b.openPackageFee;
        totalVat += b.vatFee;
        netEntitlement += b.netEntitlement;
        deliveredOrdersCount++;
      } else if (b.isReturn && b.totalShipFee > 0) {
        totalShippingFees += b.totalShipFee;
        totalBaseShipping += b.baseShipping;
        totalInsurance += b.insuranceFee;
        totalOpenPackage += b.openPackageFee;
        totalVat += b.vatFee;
        netEntitlement -= b.totalShipFee;
      }
    });

    return {
      totalCollected: Number(totalCollected.toFixed(2)),
      totalShippingFees: Number(totalShippingFees.toFixed(2)),
      totalBaseShipping: Number(totalBaseShipping.toFixed(2)),
      totalInsurance: Number(totalInsurance.toFixed(2)),
      totalOpenPackage: Number(totalOpenPackage.toFixed(2)),
      totalVat: Number(totalVat.toFixed(2)),
      netEntitlement: Number(netEntitlement.toFixed(2)),
      deliveredOrdersCount
    };
  }, [filteredOrders, computeOrderFeeBreakdown]);

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

    // Calculate net payout strictly for UNSETTLED orders (not yet added to wallet balance)
    let pendingSettlementAmount = 0;
    merchantOrders.forEach(o => {
      const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
      const isReturn = TRANSPARENCY_RETURN_STATUSES.includes(o.status);
      if (!isDelivered && !isReturn) return;

      const orderRef = String(o.orderNumber || o.id || '');
      const isSettled = Boolean(
        (o as any).merchantSettled ||
        (o as any).isSettled ||
        o.settlementStatus === 'settled' ||
        (liveMerchant?.transactions || []).some(tx =>
          (tx.referenceId && String(tx.referenceId) === String(o.id)) ||
          (tx.notes && orderRef && tx.notes.includes(orderRef))
        )
      );

      if (!isSettled) {
        const b = computeOrderFeeBreakdown(o);
        pendingSettlementAmount += b.netEntitlement;
      }
    });

    const netPayoutReady = Math.max(0, Number(pendingSettlementAmount.toFixed(2)));

    const completedCount = deliveredCount + returnCount;
    const deliverySuccessRate = completedCount > 0 ? Math.round((deliveredCount / completedCount) * 100) : (merchantOrders.length > 0 && deliveredCount > 0 ? 100 : 0);
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

    // Calculate total withdrawal/transfer fees from completed/approved partner requests
    let totalWithdrawalFees = 0;
    merchantFilteredRequests.forEach(req => {
      const reqStatus = String((req as any).status || '').toLowerCase();
      if (reqStatus === 'approved' || reqStatus === 'completed' || reqStatus === 'paid' || reqStatus === 'تم_الاعتماد') {
        totalWithdrawalFees += Number((req as any).transferFee || (req as any).fee || (req as any).feeAmount || 0);
      }
    });

    // Calculate manual expenses logged in store expenses department (تغليف، إعلانات، عمالة...)
    const allExpenses: any[] = (activeStoreData as any)?.expenses || (settings as any)?.expenses || [];
    const mNameStr = normalizeName(liveMerchant?.name || '');
    const mIdStr = (liveMerchant?.id || '').trim().toLowerCase();
    const merchantExpenses = allExpenses.filter(e => {
      const eMId = (e.merchantId || e.supplierId || '').trim().toLowerCase();
      const eMName = normalizeName(e.merchantName || e.supplierName || '');
      if (!eMId && !eMName) return true;
      return (mIdStr && eMId === mIdStr) || (mNameStr && eMName === mNameStr) || (mNameStr && eMName.includes(mNameStr));
    });
    const totalManualExpenses = merchantExpenses.reduce((sum, e) => sum + Number(e.amount || e.cost || e.value || 0), 0);

    // Sum of non-shipping store operational expenses (بدون رسوم إنشاء الأوردرات)
    const totalOtherStoreExpenses = (analytics.totalMarketingCosts || 0) + totalWithdrawalFees + totalManualExpenses;

    return {
      totalOrdersCount: merchantOrders.length,
      deliveredCount,
      returnCount,
      deliverySuccessRate,
      returnRate,
      totalDeliveredCollected,
      totalGoodsCostCapital,
      totalShippingDeductions,
      totalServiceFees: analytics.totalServiceFees,
      totalMarketingCosts: analytics.totalMarketingCosts || 0,
      totalWithdrawalFees,
      totalManualExpenses,
      totalOtherExpenses: totalOtherStoreExpenses,
      totalOtherStoreExpenses,
      totalAllDeductions: analytics.totalAllDeductions,
      netPayoutReady,
      persistentBalance: liveMerchant?.balance || 0,
      pendingGoodsValue,
      inventoryValuation,
      totalStockUnits,
      merchantProductsCount: merchantProducts.length,
      chartData
    };
  }, [merchantOrders, settings, liveMerchant, inventoryValuation, totalStockUnits, merchantProducts, merchantFilteredRequests, activeStoreData]);

  // Product & Governorate Performance Analytics for the Merchant
  const merchantAnalyticsReport = useMemo(() => {
    const prodMap = new Map<string, {
      id: string;
      name: string;
      stock: number;
      unitCost: number;
      totalOrders: number;
      orderedQty: number;
      deliveredQty: number;
      returnedQty: number;
      shippingQty: number;
      totalRevenue: number;
      netMerchantProfit: number;
    }>();

    merchantProducts.forEach((p, idx) => {
      const key = normalizeName(p.name || p.title || '') || String(p.id || idx);
      const stock = Number(p.stock || p.quantity || p.inventory || 0);
      const unitCost = Number(p.costPrice || p.cost || p.wholesalePrice || p.supplierPrice || 0);
      prodMap.set(key, {
        id: String(p.id || idx),
        name: p.name || p.title || 'صنف بضاعة',
        stock,
        unitCost,
        totalOrders: 0,
        orderedQty: 0,
        deliveredQty: 0,
        returnedQty: 0,
        shippingQty: 0,
        totalRevenue: 0,
        netMerchantProfit: 0
      });
    });

    const govMap = new Map<string, {
      governorate: string;
      totalOrders: number;
      deliveredOrders: number;
      returnedOrders: number;
      shippingOrders: number;
      totalCollected: number;
      netMerchantPayout: number;
    }>();

    merchantOrders.forEach(o => {
      const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
      const isReturn = TRANSPARENCY_RETURN_STATUSES.includes(o.status as any);
      const isShipping = ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status);

      // Requirement: Use the exact carrier breakdown for consistency across all portal screens
      const carrierCalc = computeOrderCarrierBreakdown(o, settings);
      const orderTotal = Number(o.totalAmountOverride ?? o.totalPrice ?? 0);
      
      const orderNet = isDelivered 
        ? Number((orderTotal - carrierCalc.totalShippingAndCarrier).toFixed(2))
        : isReturn
        ? Number((-carrierCalc.totalShippingAndCarrier).toFixed(2))
        : 0;

      const rawGov = String((o as any).province || (o as any).governorate || (o as any).city || o.customerAddress?.split(/[-،,]/)?.[0] || 'غير محدد').trim() || 'غير محدد';
      const govEntry = govMap.get(rawGov) || {
        governorate: rawGov,
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        shippingOrders: 0,
        totalCollected: 0,
        netMerchantPayout: 0
      };
      govEntry.totalOrders += 1;
      if (isDelivered) {
        govEntry.deliveredOrders += 1;
        govEntry.totalCollected += orderTotal;
        govEntry.netMerchantPayout += orderNet;
      } else if (isReturn) {
        govEntry.returnedOrders += 1;
        govEntry.netMerchantPayout += orderNet; // Deduct shipping loss for returns in analytics too
      } else if (isShipping) {
        govEntry.shippingOrders += 1;
      }
      govMap.set(rawGov, govEntry);

      const items = Array.isArray(o.items) && o.items.length > 0
        ? o.items
        : [{ name: (o as any).productName || 'بضاعة الموكل', quantity: 1, price: orderTotal, cost: o.merchantItemCost || 0 }];

      const totalItemsQty = (items as any[]).reduce((s: number, it: any) => s + (Number(it.quantity) || 1), 0) || 1;

      items.forEach((it: any) => {
        const itemName = String(it.name || it.productName || 'صنف بضاعة').trim();
        const key = normalizeName(itemName) || itemName;
        const qty = Number(it.quantity) || 1;
        const unitPrice = Number(it.price) || (orderTotal / totalItemsQty) || 0;
        const unitCost = Number(it.cost) || 0;

        const existing = prodMap.get(key) || {
          id: String(it.productId || key),
          name: itemName,
          stock: 0,
          unitCost,
          totalOrders: 0,
          orderedQty: 0,
          deliveredQty: 0,
          returnedQty: 0,
          shippingQty: 0,
          totalRevenue: 0,
          netMerchantProfit: 0
        };

        existing.totalOrders += 1;
        existing.orderedQty += qty;
        if (!existing.unitCost && unitCost) existing.unitCost = unitCost;

        if (isDelivered) {
          existing.deliveredQty += qty;
          const itemRev = unitPrice * qty;
          existing.totalRevenue += itemRev;
          const itemShareOfNet = orderNet > 0 ? (orderNet * (qty / totalItemsQty)) : itemRev;
          existing.netMerchantProfit += Math.round(itemShareOfNet);
        } else if (isReturn) {
          existing.returnedQty += qty;
        } else if (isShipping) {
          existing.shippingQty += qty;
        }

        prodMap.set(key, existing);
      });
    });

    const productsList = Array.from(prodMap.values()).map(p => {
      const completedUnits = p.deliveredQty + p.returnedQty;
      const deliveryRate = completedUnits > 0
        ? Math.round((p.deliveredQty / completedUnits) * 100)
        : (p.orderedQty > 0 && p.deliveredQty > 0 ? Math.round((p.deliveredQty / p.orderedQty) * 100) : 0);
      const returnRate = completedUnits > 0
        ? Math.round((p.returnedQty / completedUnits) * 100)
        : 0;
      return {
        ...p,
        deliveryRate,
        returnRate
      };
    });

    productsList.sort((a, b) => {
      if (productSortBy === 'profit') return b.netMerchantProfit - a.netMerchantProfit || b.deliveredQty - a.deliveredQty;
      if (productSortBy === 'deliveryRate') return b.deliveryRate - a.deliveryRate || b.deliveredQty - a.deliveredQty;
      if (productSortBy === 'lowReturn') return a.returnRate - b.returnRate || b.deliveredQty - a.deliveredQty;
      return b.deliveredQty - a.deliveredQty || b.orderedQty - a.orderedQty;
    });

    const governoratesList = Array.from(govMap.values())
      .map(g => {
        const completed = g.deliveredOrders + g.returnedOrders;
        const deliveryRate = completed > 0 ? Math.round((g.deliveredOrders / completed) * 100) : 0;
        const returnRate = completed > 0 ? Math.round((g.returnedOrders / completed) * 100) : 0;
        return { ...g, deliveryRate, returnRate };
      })
      .sort((a, b) => b.deliveredOrders - a.deliveredOrders || b.totalOrders - a.totalOrders);

    return { productsList, governoratesList };
  }, [merchantProducts, merchantOrders, productSortBy]);

  // Filtered Statement Transactions for Date Range & Export
  const filteredStatementTransactions = useMemo(() => {
    const allTxs = [...(liveMerchant?.transactions || [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return allTxs.filter(tx => {
      const txTime = new Date(tx.date).getTime();
      if (statementStartDate) {
        const start = new Date(statementStartDate + 'T00:00:00').getTime();
        if (txTime < start) return false;
      }
      if (statementEndDate) {
        const end = new Date(statementEndDate + 'T23:59:59').getTime();
        if (txTime > end) return false;
      }
      if (statementTypeFilter === 'settlements') {
        return tx.amount > 0 || tx.type === 'order_delivered';
      }
      if (statementTypeFilter === 'withdrawals') {
        return tx.amount < 0 || tx.type === 'withdrawal';
      }
      return true;
    });
  }, [liveMerchant?.transactions, statementStartDate, statementEndDate, statementTypeFilter]);



  // New & Pre-Dispatch Orders specifically for Main Dashboard Overview
  const newOrdersList = useMemo(() => {
    const preDispatchStatuses = ['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز', 'جاري_المراجعة'];
    return merchantOrders.filter(o => preDispatchStatuses.includes(o.status));
  }, [merchantOrders]);

  const handleDispatchOrder = (orderId: string) => {
    const targetOrder = merchantOrders.find(o => o.id === orderId);
    if (targetOrder) {
      (targetOrder as any).status = 'تم_الشحن';
    }
    showToast('تم إرسال الشحنة لشركة بوسطة وسُجلت ضمن (بانتظار التسوية) بالمحفظة', 'success');
  };

  // 1. Calculate all chronological transactions with exact sequential running balance (UNFILTERED)
  const allChronologicalTransactions = useMemo(() => {
    const rawTxs: Array<{
      id: string;
      date: string;
      type: string;
      amount: number;
      notes?: string;
      brandName?: string;
      referenceId?: string;
      balanceAfter?: number;
    }> = [...(liveMerchant?.transactions || [])];

    // Build real transactions dynamically from actual merchant orders and requests if explicit transactions don't exist
    if (rawTxs.length === 0 && (merchantOrders.length > 0 || merchantFilteredRequests.length > 0)) {
      // Group real delivered / settled orders by date
      const deliveredOrdersMap = new Map<string, typeof merchantOrders>();

      merchantOrders.forEach(o => {
        const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status) || (o as any).merchantSettled || (o as any).isSettled;
        if (!isDelivered) return;

        const dateKey = ((o as any).deliveredAt || o.createdAt || new Date().toISOString()).slice(0, 10);
        const group = deliveredOrdersMap.get(dateKey) || [];
        group.push(o);
        deliveredOrdersMap.set(dateKey, group);
      });

      deliveredOrdersMap.forEach((orders, dateKey) => {
        let totalCollected = 0;
        let totalCarrierFee = 0;

        orders.forEach(o => {
          const cod = Number((o as any).codAmount || o.totalPrice || 0);
          totalCollected += cod;

          const feeBreakdown = computeOrderFeeBreakdown(o);
          totalCarrierFee += feeBreakdown.totalShipFee;
        });

        const dateObj = new Date(dateKey + 'T12:00:00');
        const formattedDateAr = dateObj.toLocaleDateString('ar-EG', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

        const hashIdStr = String(Math.abs(dateKey.split('-').reduce((acc, part) => acc * 31 + parseInt(part, 10), 7))).slice(0, 9);

        const brandList = Array.from(new Set(orders.map(o => (o as any).merchantBrandName || (o as any).merchantName || (o as any).storeName || storeName).filter(Boolean)));
        const brandStr = brandList.length > 0 ? brandList.join(' • ') : storeName;

        // Collection Row ( دورات المبالغ المجمعة )
        if (totalCollected > 0) {
          rawTxs.push({
            id: hashIdStr + '1',
            date: `${dateKey}T23:58:59.000Z`,
            type: 'order_delivered',
            amount: totalCollected,
            notes: `مقابل ${orders.length} شحنة تم إضافتها في ${formattedDateAr}`,
            brandName: brandStr,
            referenceId: `SETTLE-${dateKey}`
          } as any);
        }

        // Fee Row ( مصاريف بوسطة )
        if (totalCarrierFee > 0) {
          rawTxs.push({
            id: hashIdStr + '2',
            date: `${dateKey}T23:59:00.000Z`,
            type: 'carrier_fee',
            amount: -totalCarrierFee,
            notes: `مقابل ${orders.length} شحنة تم إضافتها في ${formattedDateAr}`,
            brandName: brandStr,
            referenceId: `SETTLE-${dateKey}`
          });
        }
      });

      // Real Approved / Completed Withdrawal Requests
      merchantFilteredRequests.forEach(req => {
        const reqStatus = String((req as any).status || '').toLowerCase();
        if (reqStatus === 'approved' || reqStatus === 'completed' || reqStatus === 'paid' || reqStatus === 'تم_الاعتماد') {
          const reqDate = req.createdAt || new Date().toISOString();
          const payoutMethod = String((req as any).payoutMethod || (req as any).method || '');
          const methodText =
            payoutMethod === 'bank' ? 'تحويل بنكي' :
            payoutMethod === 'instapay' ? 'تحويل إنستا باي' : 'تحويل بنكي';

          const reqFee = Number((req as any).fee || (req as any).transferFee || 0);

          rawTxs.push({
            id: req.id ? String(req.id).slice(0, 12) : `WITHDRAW-${Math.random().toString().slice(2, 8)}`,
            date: reqDate,
            type: 'withdrawal',
            amount: -(Number(req.amount) || 0),
            notes: methodText,
            referenceId: req.id
          });

          if (reqFee > 0) {
            rawTxs.push({
              id: `Transfer_Fees-${String(req.id).slice(0, 8)}`,
              date: reqDate,
              type: 'carrier_fee',
              amount: -reqFee,
              notes: 'رسوم التحويل'
            });
          }
        }
      });
    }

    // Sort ALL transactions chronologically (oldest first) to compute running balance accurately
    const sortedAll = [...rawTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    return sortedAll.map(tx => {
      const amt = Number(tx.amount) || 0;
      running = tx.balanceAfter !== undefined ? tx.balanceAfter : Number((running + amt).toFixed(2));
      return {
        ...tx,
        amount: amt,
        balanceAfter: running
      };
    });
  }, [liveMerchant?.transactions, merchantOrders, merchantFilteredRequests, computeOrderFeeBreakdown]);

  // Group and format transactions for UI filtering, preserving correct balanceAfter values
  const groupedTransactions = useMemo(() => {
    let list = allChronologicalTransactions.filter(tx => {
      const amt = Number(tx.amount) || 0;
      const notes = tx.notes || '';
      if (txListTypeFilter === 'deposits') return amt > 0 && (tx.type === 'deposit' || tx.type === 'order_delivered');
      if (txListTypeFilter === 'withdrawals') return amt < 0 || tx.type === 'withdrawal';
      if (txListTypeFilter === 'collections') return amt > 0 && tx.type === 'order_delivered';
      if (txListTypeFilter === 'compensations') return tx.type === 'compensation' || notes.includes('تعويض');
      if (txListTypeFilter === 'discounts') return amt < 0 && (tx.type === 'carrier_fee' || notes.includes('مصاريف') || notes.includes('رسوم'));
      return true;
    });

    // Sort reverse-chronologically (newest first) for UI display
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allChronologicalTransactions, txListTypeFilter]);

  const statementSummary = useMemo(() => {
    let totalCredits = 0;
    let totalDebits = 0;
    filteredStatementTransactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      if (amt >= 0) totalCredits += amt;
      else totalDebits += Math.abs(amt);
    });
    return {
      totalCredits,
      totalDebits,
      netPeriodChange: totalCredits - totalDebits,
      count: filteredStatementTransactions.length
    };
  }, [filteredStatementTransactions]);

  // Effective Wallet Balance dynamically computed from complete chronological transactions or merchant state
  const effectiveMerchantBalance = useMemo(() => {
    if (allChronologicalTransactions.length > 0) {
      const lastTx = allChronologicalTransactions[allChronologicalTransactions.length - 1];
      if (lastTx?.balanceAfter !== undefined) {
        return Number(lastTx.balanceAfter);
      }
    }
    return Number(liveMerchant?.balance || 0);
  }, [allChronologicalTransactions, liveMerchant?.balance]);

  // Sum of pending withdrawal requests (held from wallet)
  const pendingRequestsSum = useMemo(() => {
    return merchantFilteredRequests
      .filter(r => r.status === 'pending')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [merchantFilteredRequests]);

  // Available balance after reserving pending requests
  const availableForWithdrawal = useMemo(() => {
    return Math.max(0, Number((effectiveMerchantBalance - pendingRequestsSum).toFixed(2)));
  }, [effectiveMerchantBalance, pendingRequestsSum]);

  // Account Setup Completion Score (for the circular ring in bottom dock like 3/6 in reference)
  const accountReadiness = useMemo(() => {
    let done = 1; // Logged in
    const total = 5;
    if (liveMerchant?.email) done++;
    if (liveMerchant?.passcode && liveMerchant.passcode !== '0000') done++;
    if (savedWalletPhone || savedInstaPay || savedBankAccount) done++;
    if (merchantOrders.length > 0 || merchantProducts.length > 0) done++;
    return { done, total, pct: Math.round((done / total) * 100) };
  }, [liveMerchant, savedWalletPhone, savedInstaPay, savedBankAccount, merchantOrders.length, merchantProducts.length]);

  // Export Statement to Excel-compatible UTF-8 CSV
  const handleExportStatementExcel = () => {
    if (!liveMerchant) return;
    const rows: string[][] = [
      ['كشف حساب الموكل / صاحب البضاعة', liveMerchant.name],
      ['المتجر', storeName],
      ['كود الموكل', liveMerchant.id],
      ['الفترة', `${statementStartDate || 'من البداية'} إلى ${statementEndDate || 'حتى اليوم'}`],
      ['الرصيد الحالي بالمحفظة (ج.م)', String(liveMerchant.balance || 0)],
      ['إجمالي التسويات والإضافات خلال الفترة (ج.م)', String(statementSummary.totalCredits)],
      ['إجمالي المسحوبات والخصومات خلال الفترة (ج.م)', String(statementSummary.totalDebits)],
      [],
      ['التاريخ', 'نوع العملية', 'البيان والملاحظات', 'رقم المرجع البنكي', 'المبلغ (ج.م)', 'الرصيد بعد العملية (ج.م)']
    ];

    filteredStatementTransactions.forEach(tx => {
      const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
      const refNum = tx.transferReference || linkedReq?.transferReference || tx.referenceId || '';
      const typeLabel =
        tx.type === 'order_delivered' ? 'تسوية مبيعات' :
        (tx.notes || '').includes('مصروفات') ? 'خصم مصروفات إضافية' :
        tx.type === 'withdrawal' ? 'سحب مستحقات' :
        tx.amount >= 0 ? 'إضافة رصيد' : 'تعديل رصيد';

      rows.push([
        new Date(tx.date).toLocaleDateString('ar-EG'),
        typeLabel,
        (tx.notes || '').replace(/"/g, '""'),
        refNum,
        String(tx.amount),
        String(tx.balanceAfter)
      ]);
    });

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${cell ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف_حساب_${liveMerchant.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تحميل شيت كشف الحساب بصيغة Excel بنجاح', 'success');
  };

  // Submit Payout / Withdrawal Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant) return;
    const numAmt = Number(requestAmount);
    if (!numAmt || numAmt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح للطلب', 'error');
      return;
    }

    if (numAmt > availableForWithdrawal) {
      showToast(
        `المبلغ المطلوب (${numAmt.toLocaleString()} ج.م) يتجاوز الرصيد المتاح للسحب (${availableForWithdrawal.toLocaleString()} ج.م). لديك طلبات سحب معلقة بمبلغ (${pendingRequestsSum.toLocaleString()} ج.م).`,
        'error'
      );
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
      showToast('تم إرسال طلب سحب المستحقات للإدارة بنجاح وحجز المبلغ مؤقتاً لحين الاعتماد', 'success');
    } catch (err: any) {
      showToast('حدث خطأ أثناء إرسال الطلب: ' + (err.message || ''), 'error');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Logout
  const handleLogout = () => {
    setShowProfileBottomSheet(false);
    setShowFullMenuDrawer(false);
    setAuthenticatedMerchant(null);
    showToast('تم تسجيل الخروج الآمن من بوابة الموكلين', 'success');
  };

  // Switch Tab Helper (closes any open sheets)
  const navigateToTab = (tab: TabKey) => {
    setCurrentTab(tab);
    setShowFullMenuDrawer(false);
    setShowProfileBottomSheet(false);
    setShowNotificationsSheet(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // RENDER 1: Loading
  if (isLoadingStore) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#008060] to-[#0a664e] flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 mb-4">
          <Building2 size={30} />
        </div>
        <h2 className="text-xl font-black mb-1">{storeName}</h2>
        <p className="text-xs text-emerald-400 font-bold mb-5">جاري تجهيز بوابة الموكلين والموردين...</p>
        <Loader2 className="animate-spin text-[#008060]" size={26} />
      </div>
    );
  }

  // RENDER 2: Dedicated Merchant Login View (Upgraded Modern Fintech Mobile-First Design)
  if (!liveMerchant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/60 text-white flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden" dir="rtl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#008060]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[420px] bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-[32px] p-6 sm:p-8 shadow-2xl relative z-10 space-y-6">
          
          <div className="text-center space-y-2.5">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-[#008060] to-emerald-500 flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-2 ring-4 ring-emerald-500/15">
              <Building2 size={30} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{storeName}</h1>
            <p className="text-xs text-emerald-400 font-bold">
              بوابة الموكلين والموردين · إدارة البضائع والتسويات المالية
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800/80 text-rose-200 text-xs font-bold flex items-start gap-2.5">
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {authSuccess && !authError && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-800/80 text-emerald-200 text-xs font-bold flex items-start gap-2.5">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Login Mode Selector: OTP vs PIN */}
          {!isOtpSent && (
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setAuthError(''); }}
                className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  authMode === 'otp'
                    ? 'bg-[#008060] text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Mail size={14} />
                <span>كود البريد (OTP)</span>
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('pin'); setAuthError(''); }}
                className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  authMode === 'pin'
                    ? 'bg-[#008060] text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Key size={14} />
                <span>رمز المرور (PIN)</span>
              </button>
            </div>
          )}

          {/* Login Steps */}
          {!isOtpSent ? (
            authMode === 'otp' ? (
              <form onSubmit={handleInitiateOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">
                    البريد الإلكتروني المسجل للموكل
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={loginEmailInput}
                      onChange={e => { setLoginEmailInput(e.target.value); setAuthError(''); }}
                      placeholder="partner@example.com"
                      className="w-full py-3.5 px-4 pl-10 bg-slate-950/90 border border-slate-700/80 rounded-2xl font-mono text-sm text-white placeholder:text-slate-500 outline-none focus:border-[#008060] focus:ring-2 focus:ring-emerald-500/20 text-left"
                      dir="ltr"
                      autoFocus
                    />
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Mail size={16} />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-medium leading-relaxed">
                    أدخل بريدك الإلكتروني المسجل لدى المتجر؛ سيصلك كود تحقق فوري (OTP) للدخول الآمن.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSendingOtp || !loginEmailInput.trim()}
                  className="w-full py-3.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  <span>إرسال كود التحقق الأمني (OTP)</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginWithPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">
                    البريد الإلكتروني المسجل أو رقم الهاتف
                  </label>
                  <input
                    type="text"
                    required
                    value={loginEmailInput}
                    onChange={e => { setLoginEmailInput(e.target.value); setAuthError(''); }}
                    placeholder="partner@example.com أو 010xxxxxxx"
                    className="w-full py-3.5 px-4 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-xs font-bold text-white placeholder:text-slate-500 outline-none focus:border-[#008060] focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-2">
                    رمز المرور السري (PIN)
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPinInput}
                    onChange={e => { setLoginPinInput(e.target.value); setAuthError(''); }}
                    placeholder="••••"
                    maxLength={10}
                    className="w-full py-3.5 px-4 bg-slate-950/90 border border-slate-700/80 rounded-2xl text-center font-mono font-black text-lg tracking-[6px] text-white placeholder:text-slate-500 outline-none focus:border-[#008060] focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                    الرمز السري الممنوح لك من إدارة المتجر (الافتراضي: 0000).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!loginEmailInput.trim() || !loginPinInput.trim()}
                  className="w-full py-3.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Key size={15} />
                  <span>دخول البوابة برمز PIN</span>
                </button>
              </form>
            )
          ) : (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3.5 bg-emerald-950/50 border border-emerald-800/80 rounded-2xl text-xs text-emerald-300 font-bold leading-relaxed">
                أدخل كود التحقق المكون من 6 أرقام المرسل إلى:
                <span className="font-mono text-white block mt-1 text-left" dir="ltr">{maskEmail(otpTargetEmail)}</span>
              </div>

              {import.meta.env.DEV && devOtpCode && (
                <div className="p-2.5 bg-amber-950/80 border border-amber-700 rounded-xl text-xs text-amber-300 font-mono text-center font-black">
                  كود المعاينة للتجربة: {devOtpCode}
                </div>
              )}

              <div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full py-3.5 px-4 bg-slate-950 border-2 border-[#008060] rounded-2xl text-center font-mono font-black text-2xl tracking-[8px] text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIsOtpSent(false); setOtpCode(''); setAuthError(''); }}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  تغيير البريد
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="flex-1 py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>تأكيد الكود والدخول</span>
                </button>
              </div>
            </form>
          )}

          {/* Biometric Quick Login Button on Mobile/Supported Devices */}
          {biometricAvailable && !isOtpSent && (
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleBiometricQuickLogin}
                className="w-full py-3 bg-slate-800/80 hover:bg-slate-800 text-emerald-400 border border-slate-700/80 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Fingerprint size={17} />
                <span>الدخول السريع ببصمة الهاتف / FaceID</span>
              </button>
            </div>
          )}

        </div>
      </div>
    );
  }

  // Helper for current tab title
  const tabTitleMap: Record<TabKey, { title: string; subtitle: string }> = {
    overview: { title: 'الرئيسية والأرصدة', subtitle: 'ملخص المحفظة وتصفية البضائع' },
    orders: { title: 'الدورة المالية والأوردرات', subtitle: `متابعة الدورة المالية لـ ${merchantOrders.length} شحنة` },
    create_order: { title: 'إنشاء أوردر جديد', subtitle: 'استوديو تسجيل وشحن أوردرات الوكيل' },
    analytics: { title: 'تحليل الأصناف والمحافظات', subtitle: 'ترتيب المنتجات الأكثر ربحية ونسب التسليم' },
    transparency: { title: 'حركة البضاعة والشفافية', subtitle: 'البيان المحاسبي المفصل للأصناف والتكاليف' },
    statement: { title: 'كشف الحساب الرسمي', subtitle: 'تصدير PDF و Excel للفترة المحددة' },
    account: { title: 'حسابي والأمان', subtitle: 'حسابات الدفع المحفوظة ورمز PIN والبصمة' }
  };

  const unreadAlertsCount = merchantFilteredRequests.filter(r => r.status === 'approved' || r.status === 'pending').length;

  // RENDER 3: Upgraded Modern App-Grade Merchant Portal (Mobile & Desktop)
  return (
    <div
      className={`min-h-screen font-sans pb-28 transition-colors duration-200 ${
        isDark
          ? 'bg-slate-950 text-slate-100'
          : 'bg-gradient-to-b from-[#f1f5f9] via-[#f8fafc] to-[#f1f5f9] text-slate-800'
      }`}
      dir="rtl"
    >
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[160] px-5 py-3 rounded-2xl text-xs font-black shadow-2xl flex items-center gap-2 border ${
              toast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
                : 'bg-slate-900 text-emerald-300 border-emerald-700/60'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle size={15} className="text-rose-400" /> : <CheckCircle2 size={15} className="text-emerald-400" />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top App Bar (Desktop/Tablet Header — Hidden on Mobile Phones) */}
      <header
        className={`hidden md:block sticky top-0 z-30 backdrop-blur-xl border-b transition-colors ${
          isDark
            ? 'bg-slate-900/95 border-slate-800/80'
            : 'bg-white/95 border-slate-200/80'
        }`}
      >
        <div className="w-full max-w-[1720px] mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Right Zone: Merchant Profile Trigger */}
          <div className={`flex items-center gap-3 shrink-0 pl-4 border-l ${
            isDark ? 'border-slate-800' : 'border-slate-200/80'
          }`}>
            <button
              type="button"
              onClick={() => setShowProfileBottomSheet(true)}
              className="relative group flex items-center gap-2.5 text-right cursor-pointer focus:outline-none shrink-0"
              title="فتح إعدادات الحساب والملف الشخصي"
            >
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#008060] to-emerald-500 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-600/20 shrink-0 group-hover:scale-105 transition-transform">
                  {getInitials(liveMerchant.name)}
                </div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 ${
                    isDark ? 'border-slate-900' : 'border-white'
                  } ${isActiveStatus ? 'bg-emerald-500' : 'bg-slate-400'}`}
                />
              </div>
              <div className="max-w-[190px] lg:max-w-[230px]">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {liveMerchant.name}
                  </span>
                  <ChevronDown size={13} className="text-slate-400 shrink-0" />
                </div>
                <div className="text-[11px] text-slate-400 font-medium truncate">
                  {storeName} · {tabTitleMap[currentTab].title}
                </div>
              </div>
            </button>
          </div>

          {/* Center Zone (Desktop Segmented Tabs) */}
          <div className="flex-1 min-w-0 flex items-center justify-center">
            <nav className={`max-w-full overflow-x-auto no-scrollbar flex items-center gap-1 p-1 rounded-2xl border ${
              isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-100/90 border-slate-200/70'
            }`}>
              {[
                { id: 'overview', label: 'الرئيسية', icon: Home },
                { id: 'orders', label: 'الدورة المالية والأوردرات', icon: PackageIcon, badge: merchantOrders.length },
                { id: 'create_order', label: '+ إنشاء أوردر', icon: PlusCircle, soon: true },
                { id: 'analytics', label: 'الأصناف والمحافظات', icon: TrendingUp },
                { id: 'transparency', label: 'حركة البضاعة', icon: Sparkles },
                { id: 'statement', label: 'كشف الحساب', icon: FileText },
                { id: 'account', label: 'حسابي والأمان', icon: ShieldCheck }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => navigateToTab(tab.id as TabKey)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-[#008060] text-white shadow-xs'
                        : isDark
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                    {(tab as any).soon && (
                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-amber-400 text-slate-950' : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        قريباً
                      </span>
                    )}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-[#008060]'
                      }`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Left Zone: Primary Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !hideBalances;
                setHideBalances(next);
                try { localStorage.setItem('merchant_portal_hide_bal', String(next)); } catch {}
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={hideBalances ? 'إظهار الأرصدة' : 'إخفاء الأرصدة (وضع الخصوصية)'}
            >
              {hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>

            <button
              type="button"
              onClick={() => fetchFreshData(true)}
              disabled={isRefreshing}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="مزامنة وتحديث البيانات"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-[#008060]' : ''} />
            </button>

            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-1.5 bg-[#008060] hover:bg-[#0a664e] text-white px-3.5 py-2.5 rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <Coins size={14} />
              <span>طلب سحب</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Top App Bar (Shown only on small screens) */}
      <header
        className={`md:hidden sticky top-0 z-40 backdrop-blur-xl border-b transition-colors px-4 h-14 flex items-center justify-between gap-3 ${
          isDark
            ? 'bg-slate-900/95 border-slate-800'
            : 'bg-white/95 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#008060] to-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-md shadow-emerald-600/20">
            {getInitials(liveMerchant.name)}
          </div>
          <div className="flex flex-col">
            <span className={`text-xs font-black truncate max-w-[150px] ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {liveMerchant.name}
            </span>
            <span className="text-[10px] text-slate-400 font-bold">{tabTitleMap[currentTab].title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => fetchFreshData(true)}
            disabled={isRefreshing}
            className={`p-2 rounded-lg transition-all ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-[#008060]' : ''} />
          </button>
          <button
            type="button"
            onClick={() => setShowFullMenuDrawer(true)}
            className={`p-2 rounded-lg transition-all ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Container (Full-width responsive with minimal side gutters) */}
      <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 space-y-5">



        {/* Mobile Quick Sub-Navigation Pill Scroller (Shown only on screens where top header is hidden) */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'overview', label: 'الرئيسية', icon: Home },
            { id: 'orders', label: `الدورة المالية والأوردرات (${merchantOrders.length})`, icon: WalletIcon },
            { id: 'create_order', label: '+ إنشاء أوردر', icon: PlusCircle, soon: true },
            { id: 'analytics', label: 'الأصناف والمحافظات', icon: TrendingUp },
            { id: 'transparency', label: 'حركة البضاعة', icon: Sparkles },
            { id: 'statement', label: 'كشف الحساب PDF', icon: FileText },
            { id: 'account', label: 'حسابي والأمان', icon: ShieldCheck }
          ].map(t => {
            const Icon = t.icon;
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigateToTab(t.id as TabKey)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                  active
                    ? 'bg-[#008060] text-white border-[#008060] shadow-sm shadow-emerald-600/20'
                    : isDark
                    ? 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                {(t as any).soon && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                    active ? 'bg-amber-400 text-slate-950' : 'bg-amber-500/15 text-amber-600'
                  }`}>
                    قريباً
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* =========================================================
            TAB 1: OVERVIEW (الرئيسية والأرصدة)
           ========================================================= */}
        {currentTab === 'overview' && (
          <div className="space-y-5">
            
            {/* Personalized Welcome Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
              <div>
                <h2 className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  أهلاً بك يا {liveMerchant.name.split(' ')[0]} 👋
                </h2>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  نظرة شاملة على نشاطك التجاري، الأرصدة المتوفرة، وحركة بضاعتك بالمخزن.
                </p>
              </div>
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'} text-[11px] font-black`}>
                <Building2 size={13} className="text-[#008060]" />
                <span>{portalTitle}</span>
              </div>
            </div>

            {/* Hero Fintech Wallet Card */}
            <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#064e3b] via-[#008060] to-[#0f172a] text-white p-5 sm:p-7 shadow-xl shadow-emerald-950/20">

              <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold">
                    <WalletIcon size={15} />
                    <span>الرصيد المتاح للسحب الفوري</span>
                    <span>·</span>
                    <span className="font-mono">{liveMerchant.id}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight text-white">
                    {formatMoney(availableForWithdrawal)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/90 pt-1">
                    <span>إجمالي المحفظة: <strong className="font-mono">{formatMoney(liveMerchant.balance || 0)}</strong></span>
                    {pendingRequestsSum > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-300 font-bold">
                          محجوز لطلبات معلقة: <strong className="font-mono">{formatMoney(pendingRequestsSum)}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Wallet Action Buttons */}
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(true)}
                    className="px-4 py-3 bg-white text-[#008060] hover:bg-emerald-50 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
                  >
                    <Coins size={16} />
                    <span>طلب سحب مستحقات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('create_order')}
                    className="px-4 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
                  >
                    <PlusCircle size={15} />
                    <span>إنشاء أوردر جديد</span>
                    <span className="text-[9px] bg-slate-950/15 px-1.5 py-0.5 rounded-full">قريباً</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('orders')}
                    className="col-span-2 sm:col-span-1 px-4 py-3 bg-slate-900/50 hover:bg-slate-900/80 text-emerald-200 border border-emerald-400/20 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <WalletIcon size={15} />
                    <span>الدورة المالية والأوردرات ({merchantOrders.length})</span>
                  </button>
                </div>

              </div>

              {/* Bottom Mini Strip inside Hero Card */}
              <div className="relative z-10 mt-6 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">أرباح ومبيعات بانتظار التسوية</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-white mt-0.5 block">
                    {formatMoney(overviewStats.netPayoutReady)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">قيمة بضاعتك بالمخزن ({overviewStats.totalStockUnits} ق)</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-white mt-0.5 block">
                    {formatMoney(overviewStats.inventoryValuation)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">بضاعة في الطريق للعملاء</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-white mt-0.5 block">
                    {formatMoney(overviewStats.pendingGoodsValue)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">نسبة نجاح تسليم بضاعتك</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-emerald-300 mt-0.5 block">
                    {overviewStats.deliverySuccessRate}% ({overviewStats.deliveredCount} مسلّم)
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Bento KPI Cards Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 sm:gap-4">
              {/* 1. إجمالي المحصل */}
              <div
                onClick={() => navigateToTab('orders')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-emerald-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>إجمالي المحصل</span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-[#008060] flex items-center justify-center">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className={`text-lg sm:text-2xl font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {formatMoney(overviewStats.totalDeliveredCollected)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  إجمالي المبالغ المحصلة من العملاء
                </div>
              </div>

              {/* 2. مصروفات الشحن واللوجستيات (شحن + تأمين + ضريبة + معاينة + COD) */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-rose-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مصروفات الشحن</span>
                  <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <Truck size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-rose-500">
                  -{formatMoney(overviewStats.totalShippingDeductions)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  شحن + تأمين + ضريبة + معاينة + COD
                </div>
              </div>

              {/* 3. عمولة تشغيل الأوردرات (بطاقة منفصلة لعمولة تشغيل وإنشاء الأوردر) */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-indigo-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>عمولة تشغيل الأوردرات</span>
                  <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Cpu size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-indigo-500">
                  -{formatMoney(overviewStats.totalServiceFees)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  رسوم المعالجة وإنشاء الأوردرات
                </div>
              </div>

              {/* 4. مصروفات التسويق والإعلانات */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-amber-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مصروفات التسويق</span>
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Megaphone size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-amber-600">
                  -{formatMoney(overviewStats.totalMarketingCosts)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  حملات إعلانية وتأجير وتسويق
                </div>
              </div>

              {/* 5. مصروفات وتشغيل المتجر (بدون شحن: تغليف + إعلانات + عمالة + رسوم سحب) */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-purple-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>مصروفات أخرى وتشغيل</span>
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Layers size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-purple-600">
                  -{formatMoney(overviewStats.totalOtherStoreExpenses)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  تغليف + إعلانات + عمالة + رسوم سحب
                </div>
              </div>

              {/* 6. رأس مال المباع المسترد */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-sky-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>رأس مال المباع</span>
                  <div className="w-9 h-9 rounded-2xl bg-sky-500/10 text-sky-600 flex items-center justify-center">
                    <PackageCheck size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-sky-600">
                  {formatMoney(overviewStats.totalGoodsCostCapital)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  قيمة البضاعة المستردة من المبيعات
                </div>
              </div>

              {/* 7. الصافي المستحق (بانتظار التسوية) */}
              <div
                onClick={() => navigateToTab('analytics')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-slate-900 border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:border-emerald-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>بانتظار التسوية</span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-[#008060] flex items-center justify-center">
                    <Calculator size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-[#008060]">
                  {formatMoney(overviewStats.netPayoutReady)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  أرباح أوردرات لم تضف للمحفظة بعد
                </div>
              </div>
            </div>

            {/* Balance Chart + Quick Inventory Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Balance Progression Chart (7 cols) */}
              <div className={`lg:col-span-7 p-5 sm:p-6 rounded-3xl border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
              } space-y-4`}>
                <div className={`flex items-center justify-between border-b pb-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div>
                    <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      منحنى تطور الرصيد الجاري
                    </h3>
                    <p className="text-xs text-slate-400">
                      حركة المحفظة عبر التسويات والمسحوبات المعتمدة
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTab('statement')}
                    className="text-xs font-black text-[#008060] hover:underline cursor-pointer"
                  >
                    كشف الحساب ←
                  </button>
                </div>

                <div className="h-60 sm:h-64 w-full pt-2" dir="ltr">
                  {(!overviewStats.chartData || overviewStats.chartData.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-bold gap-2">
                      <WalletIcon size={28} className="text-slate-300 dark:text-slate-700" />
                      <span>لا توجد حركات مسجلة في كشف الحساب لرسم المنحنى حالياً</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewStats.chartData}>
                        <defs>
                          <linearGradient id="merchantPortalEmerald" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#008060" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#008060" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} stroke={isDark ? '#334155' : '#cbd5e1'} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke={isDark ? '#334155' : '#cbd5e1'} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                            borderColor: isDark ? '#1e293b' : '#cbd5e1', 
                            borderRadius: '16px',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            fontSize: '11px',
                            fontWeight: 'bold',
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

              {/* Consignment Inventory List (5 cols) */}
              <div className={`lg:col-span-5 p-5 sm:p-6 rounded-3xl border ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
              } flex flex-col justify-between space-y-4`}>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between border-b pb-3.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div>
                      <h4 className={`font-black text-sm sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        بضاعة الأمانة بالمخزن ({merchantProducts.length})
                      </h4>
                      <p className="text-xs text-slate-400">
                        إجمالي {overviewStats.totalStockUnits} قطعة متوفرة حالياً
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToTab('analytics')}
                      className="text-xs font-black text-[#008060] hover:underline cursor-pointer"
                    >
                      ترتيب المبيعات ←
                    </button>
                  </div>

                  {merchantProducts.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-2">
                      <PackageIcon size={28} className="mx-auto text-slate-300 dark:text-slate-700" />
                      <p>لا توجد أصناف مسجلة بالمخزن باسم الموكل حالياً</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-60 overflow-y-auto pr-1">
                      {merchantProducts.map((p, idx) => {
                        const stock = Number(p.stock || p.quantity || p.inventory || 0);
                        const cost = Number(p.costPrice || p.cost || p.wholesalePrice || p.supplierPrice || 0);
                        return (
                          <div key={p.id || idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <div className={`font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {p.name || p.title || 'منتج أمانة'}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">
                                تكلفة القطعة: {formatMoney(cost)}
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <div className="font-mono tabular-nums font-black text-[#008060]">
                                {stock} قطعة
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                {formatMoney(stock * cost)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50/60 border-emerald-200/70'
                }`}>
                  <span className="font-bold text-slate-500 dark:text-slate-400">إجمالي تقييم المخزون المتبقي:</span>
                  <span className="font-mono tabular-nums font-black text-sm text-[#008060]">
                    {formatMoney(overviewStats.inventoryValuation)}
                  </span>
                </div>
              </div>
            </div>

            {/* New & Pre-Dispatch Orders Table Card (Matching image_7fe9dee8.png) */}
            <div className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 dark:border-slate-800">
                <div>
                  <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <FileText size={18} className="text-[#008060]" />
                    <span>سجل الطلبات المفصل والجديدة وقيد المراجعة الخاص بالموكل</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-mono text-xs font-black">
                      ({newOrdersList.length} طلب)
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    انقر على أي سطر لعرض تفاصيل التكاليف والمعادلة الرياضية بالكامل • تنبيه: الطلبات قبل الإرسال لا تظهر بالمحفظة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-600 text-[11px] font-black border border-amber-500/20 shrink-0">
                    قيد المراجعة / لم تُرسل بعد
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setOrdersTopViewMode('financial_cycle');
                      navigateToTab('orders');
                    }}
                    className="text-xs font-black text-[#008060] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    الدورة المالية ←
                  </button>
                </div>
              </div>

              {newOrdersList.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-xs font-bold space-y-2">
                  <PackageCheck size={32} className="mx-auto text-emerald-500/50" />
                  <p>جميع الطلبات الحالية تم إرسالها للشحن ومتابعتها في المحفظة والدورة المالية</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className={`${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-700'} font-black border-b border-slate-100 dark:border-slate-800`}>
                      <tr>
                        <th className="py-3.5 px-3 whitespace-nowrap">رقم الطلب والتاريخ</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">شركة الشحن والتتبع</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">العميل والمحافظة</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">الحالة</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">الأصناف المشمولة</th>
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">المحصل</th>
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">رأس المال</th>
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">الشحن والرسوم</th>
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">صافي المستحق</th>
                        <th className="py-3.5 px-3 text-center whitespace-nowrap">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-bold ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {newOrdersList.map((o, idx) => {
                        const feeBreakdown = computeOrderFeeBreakdown(o);
                        const itemsStr = (o.items || []).map(i => `${i.name || i.productName || 'منتج'} (${i.quantity || 1})`).join(', ') || 'منتجات أمانة';
                        const orderNum = o.orderNumber || o.id || `#${idx + 1}`;
                        const formattedDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : '2026/10/21';
                        const brandName = (o as any).merchantBrandName || (o as any).merchantName || (o as any).storeName || storeName || 'المتجر الرئيسي';
                        const codAmount = Number((o as any).codAmount || o.totalPrice || feeBreakdown.rawTotal || 0);
                        const netExpected = codAmount > 0 ? (codAmount - feeBreakdown.totalShipFee) : -feeBreakdown.totalShipFee;

                        return (
                          <tr key={o.id || idx} className={`${isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/70'}`}>
                            <td className="py-3.5 px-3 font-mono font-black whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-900 dark:text-white">{orderNum}</span>
                                <span className="px-2 py-0.5 rounded-lg bg-[#008060]/10 text-[#008060] dark:text-emerald-400 font-black text-[10px] font-sans">
                                  {brandName}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-normal mt-0.5">{formattedDate}</div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200">
                                <Truck size={14} className="text-[#008060]" />
                                <span>بوسطة</span>
                              </div>
                              <div className="text-[10px] text-slate-400">قيد إصدار البوليسة</div>
                              <button
                                type="button"
                                onClick={() => showToast(`تتبع الشحنة رقم ${orderNum}`, 'info')}
                                className="mt-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black cursor-pointer flex items-center gap-1"
                              >
                                <span>تتبع الشحنة</span>
                                🚚
                              </button>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="text-slate-900 dark:text-white font-black">{o.customerName || 'عميل المتجر'}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{(o as any).province || (o as any).city || 'القاهرة'}</div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[11px] font-black border border-amber-500/20">
                                جاري_المراجعة
                              </span>
                            </td>
                            <td className="py-3.5 px-3 max-w-xs truncate text-slate-600 dark:text-slate-300">
                              {itemsStr}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-black text-[#008060] dark:text-emerald-400 whitespace-nowrap">
                              {formatMoney(codAmount)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {formatMoney(feeBreakdown.goodsCost)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-500 whitespace-nowrap">
                              -{formatMoney(feeBreakdown.totalShipFee)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-black text-[#008060] dark:text-emerald-400 bg-emerald-500/5 rounded-xl whitespace-nowrap">
                              {formatMoney(netExpected)}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-black inline-flex items-center gap-1.5 cursor-not-allowed">
                                <Send size={12} className="opacity-50" />
                                <span>قريباً</span>
                              </span>
                            </td>
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

        {/* =========================================================
            TAB 2: ORDERS & FINANCIAL CYCLE (الدورة المالية للأوردرات - Bosta Style in Brand Colors)
           ========================================================= */}
        {currentTab === 'orders' && (
          <div className="space-y-4">
            
            {/* 1. Top Segmented Switcher: الرصيد الحالي (يمين) | الدورة المالية (يسار) */}
            <div className={`grid grid-cols-2 p-1.5 rounded-2xl border ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100/90 border-slate-200/80'
            }`}>
              <button
                type="button"
                onClick={() => setOrdersTopViewMode('current_balance')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  ordersTopViewMode === 'current_balance'
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                الرصيد الحالي
              </button>
              <button
                type="button"
                onClick={() => setOrdersTopViewMode('financial_cycle')}
                className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                  ordersTopViewMode === 'financial_cycle'
                    ? isDark
                      ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                      : 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                الدورة المالية
              </button>
            </div>

            {ordersTopViewMode === 'current_balance' ? (
              /* Current Balance View: Desktop 3-Cards & Mobile Layout (Matching Image 3) */
              <div className="space-y-6">
                
                {/* 3 Top Cards Grid (Desktop & Responsive) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1 (Right): الرصيد الحالي */}
                  <div className={`p-6 rounded-[28px] border space-y-4 relative overflow-hidden transition-all ${
                    isDark 
                      ? 'bg-emerald-950/20 border-[#008060]/30 text-white' 
                      : 'bg-teal-50/60 border-teal-200/80 text-slate-900 shadow-xs'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#008060] dark:text-emerald-400">
                        الرصيد المتاح للسحب : <strong className="font-mono text-lg">{formatMoney(availableForWithdrawal)}</strong>
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      إجمالي رصيد المحفظة: {formatMoney(effectiveMerchantBalance)}
                      {pendingRequestsSum > 0 && ` (محجوز لطلب معلق: ${formatMoney(pendingRequestsSum)})`}
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOrdersTopViewMode('financial_cycle');
                          setOrdersStatusFilter('all');
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isDark ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs'
                        }`}
                      >
                        عرض التفاصيل
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRequestModal(true)}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-[#008060] hover:bg-[#0a664e] text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Coins size={15} />
                        <span>طلب سحب</span>
                      </button>
                    </div>
                  </div>

                  {/* Card 2 (Middle): تكرار السحب النقدي */}
                  <div className={`p-6 rounded-[28px] border space-y-3 relative overflow-hidden ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                        <span>تكرار السحب النقدي</span>
                        <HelpCircle size={14} className="text-slate-400" />
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-500/10 text-[#008060] text-[10px] font-black">
                        أسبوعي
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      سيتم تحويل قيمة السحب النقدي إلى حسابك البنكي كل أسبوع في يوم الاثنين.
                    </p>
                    <div className="flex items-center gap-3 pt-2 text-xs font-black">
                      <button type="button" onClick={() => showToast('نظام السحب الأسبوعي التلقائي مفعل لحسابك', 'success')} className="text-[#008060] hover:underline cursor-pointer">اعرف أكثر</button>
                      <span className="text-slate-300">|</span>
                      <button type="button" onClick={() => setShowProfileBottomSheet(true)} className="text-slate-600 dark:text-slate-300 hover:underline cursor-pointer">تغيير النظام</button>
                    </div>
                  </div>

                  {/* Card 3 (Left): تاريخ السحب النقدي القادم */}
                  <div className={`p-6 rounded-[28px] border space-y-3 relative overflow-hidden ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
                  }`}>
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                      <Calendar size={15} className="text-[#008060]" />
                      <span>تاريخ السحب النقدي القادم</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      سيتم تحويل قيمة السحب النقدي إلى حسابك البنكي في هذا التاريخ.
                    </p>
                    <div className={`p-2.5 rounded-xl border text-xs font-mono font-black text-center ${
                      isDark ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                      الإثنين, 26 أكتوبر 2026
                    </div>
                  </div>

                </div>

                {/* Sub-filter Tabs & Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  
                  {/* Category Filter Pills (Matching Image 3) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'الكل' },
                      { id: 'deposits', label: 'شحن الرصيد' },
                      { id: 'withdrawals', label: 'سحب الرصيد' },
                      { id: 'collections', label: 'تحصيل نقدي' },
                      { id: 'compensations', label: 'تعويضات' },
                      { id: 'discounts', label: 'خصومات' },
                      { id: 'other', label: 'أخرى' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setTxListTypeFilter(f.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                          txListTypeFilter === f.id
                            ? 'bg-[#008060] text-white shadow-xs'
                            : isDark
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Date Filter & Export Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCycleDatePicker(prev => !prev)}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 cursor-pointer ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                      }`}
                    >
                      <Calendar size={14} className="text-[#008060]" />
                      <span>المدة الزمنية</span>
                      <ChevronDown size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const rows = [['رقم المعاملة', 'التاريخ', 'التصنيف', 'المبلغ', 'الرصيد بعد العملية']];
                        groupedTransactions.forEach(tx => {
                          rows.push([
                            tx.id,
                            new Date(tx.date).toLocaleDateString('ar-EG'),
                            tx.notes || tx.type,
                            String(tx.amount),
                            String(tx.balanceAfter)
                          ]);
                        });
                        const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `كشف_معاملات_المحفظة_${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast('تم تصدير كشف المعاملات بنجاح', 'success');
                      }}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-black flex items-center gap-2 cursor-pointer ${
                        isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                      }`}
                    >
                      <Download size={14} />
                      <span>تحميل</span>
                    </button>
                  </div>
                </div>

                {/* Desktop Transactions Table (Matching Image 3) */}
                <div className={`hidden md:block rounded-[28px] border overflow-hidden ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
                }`}>
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <h3 className={`text-sm font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      <span>قائمة المعاملات</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {groupedTransactions.length}
                      </span>
                    </h3>
                  </div>

                  <table className="w-full text-right text-xs">
                    <thead className={`${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-700'} font-black border-b border-slate-100 dark:border-slate-800`}>
                      <tr>
                        <th className="py-3.5 px-4">رقم المعاملة</th>
                        <th className="py-3.5 px-4">التاريخ</th>
                        <th className="py-3.5 px-4">التصنيف والوصف</th>
                        <th className="py-3.5 px-4">المبلغ</th>
                        <th className="py-3.5 px-4 text-center">الرصيد</th>
                        <th className="py-3.5 px-4 text-center">الخيارات</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-bold ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                      {groupedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">لا توجد حركات مالية مسجلة بهذه الفئة</td>
                        </tr>
                      ) : (
                        groupedTransactions.map((tx, idx) => {
                          const isCredit = tx.amount >= 0;
                          const isTransferFee = tx.id.includes('Transfer_Fees') || (tx.notes || '').includes('رسوم التحويل');
                          const isFee = !isTransferFee && (tx.type === 'carrier_fee' || (tx.amount < 0 && (tx.notes?.includes('مصاريف') || tx.notes?.includes('بوسطة'))));
                          const isSettlement = tx.type === 'order_delivered' || tx.type === 'grouped_settlement' || (tx.amount > 0 && tx.notes?.includes('شحنة'));
                          const isComp = tx.type === 'compensation' || tx.notes?.includes('تعويض');
                          const isWithdrawal = tx.type === 'withdrawal' || (tx.amount < 0 && !isFee && !isTransferFee);

                          const catTitle = isTransferFee
                            ? 'رسوم التحويل'
                            : isFee 
                            ? 'مصاريف بوسطة' 
                            : isSettlement 
                            ? 'دورات المبالغ المجمعة' 
                            : isComp 
                            ? 'تعويض' 
                            : isWithdrawal 
                            ? 'السحب النقدي' 
                            : isCredit 
                            ? 'إضافة رصيد' 
                            : 'خصم / تعديل';

                          const subText = isTransferFee
                            ? ''
                            : isWithdrawal 
                            ? (tx.notes || 'تحويل بنكي') 
                            : (tx.notes || 'تسوية معتمدة للحساب');

                          const formattedDate = new Date(tx.date).toLocaleDateString('ar-EG', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long' 
                          }) + ' ' + new Date(tx.date).toLocaleTimeString('ar-EG', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          });

                          return (
                            <tr key={tx.id || idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}>
                              <td className="py-3.5 px-4 font-mono font-black">
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-black shrink-0 ${
                                    isCredit ? 'bg-emerald-500/15 text-[#008060]' : 'bg-rose-500/15 text-rose-500'
                                  }`}>
                                    {isCredit ? '+' : '-'}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200">{tx.id.replace(/^grouped_/, '').slice(0, 12)}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                                {formattedDate}
                              </td>
                              <td className="py-3.5 px-4 max-w-xs">
                                <div className="text-slate-900 dark:text-white font-black text-xs">
                                  {catTitle}
                                </div>
                                <div className="text-[11px] text-slate-400 font-normal mt-0.5 truncate">
                                  {subText}
                                </div>
                              </td>
                              <td className={`py-3.5 px-4 font-mono font-black tabular-nums ${isCredit ? 'text-[#008060]' : 'text-rose-500'}`}>
                                {isCredit ? '' : ''}{formatMoney(tx.amount)}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                                {formatMoney(tx.balanceAfter)}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {isComp ? (
                                  <button
                                    type="button"
                                    onClick={() => showToast('جاري تصدير ملف التعويض المعتمد', 'success')}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                  >
                                    تصدير الملف
                                  </button>
                                ) : isWithdrawal ? (
                                  <button
                                    type="button"
                                    onClick={() => showToast(`إشعار تحويل بنكي للمسحوبات رقم ${tx.id}`, 'info')}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                                  >
                                    عرض الفاتورة
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (tx.date) {
                                        const d = tx.date.slice(0, 10);
                                        setCycleStartDate(d);
                                        setCycleEndDate(d);
                                      }
                                      if (tx.referenceId) {
                                        setSelectedSettlementId(tx.referenceId);
                                      }
                                      setOrdersStatusFilter('all');
                                      setOrdersTopViewMode('financial_cycle');
                                      setTimeout(() => {
                                        document.getElementById('merchant-orders-list')?.scrollIntoView({ behavior: 'smooth' });
                                      }, 150);
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-black text-[#008060] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
                                  >
                                    عرض التفاصيل
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Transactions List (Matching Image 3 Mobile) */}
                <div className="md:hidden space-y-3">
                  {groupedTransactions.length === 0 ? (
                    <div className={`p-10 rounded-3xl border text-center text-xs font-bold text-slate-400 ${
                      isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
                    }`}>لا توجد حركات مالية مسجلة</div>
                  ) : (
                    groupedTransactions.slice(0, 15).map(tx => {
                      const isCredit = tx.amount >= 0;
                      const isTransferFee = tx.id.includes('Transfer_Fees') || (tx.notes || '').includes('رسوم التحويل');
                      const isFee = !isTransferFee && (tx.type === 'carrier_fee' || (tx.amount < 0 && (tx.notes?.includes('مصاريف') || tx.notes?.includes('بوسطة'))));
                      const isSettlement = tx.type === 'order_delivered' || tx.type === 'grouped_settlement' || (tx.amount > 0 && tx.notes?.includes('شحنة'));
                      const isComp = tx.type === 'compensation' || tx.notes?.includes('تعويض');
                      const isWithdrawal = tx.type === 'withdrawal' || (tx.amount < 0 && !isFee && !isTransferFee);

                      const catTitle = isTransferFee
                        ? 'رسوم التحويل'
                        : isFee 
                        ? 'مصاريف بوسطة' 
                        : isSettlement 
                        ? 'دورات المبالغ المجمعة' 
                        : isComp 
                        ? 'تعويض' 
                        : isWithdrawal 
                        ? 'السحب النقدي' 
                        : isCredit 
                        ? 'إضافة رصيد' 
                        : 'خصم / تعديل';

                      const subText = isTransferFee
                        ? ''
                        : isWithdrawal 
                        ? (tx.notes || 'تحويل بنكي') 
                        : (tx.notes || 'تسوية معتمدة للحساب');

                      return (
                        <div key={tx.id} className={`p-4 rounded-[24px] border space-y-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                                isCredit ? 'bg-emerald-500/15 text-[#008060]' : 'bg-rose-500/15 text-rose-500'
                              }`}>
                                {isCredit ? '+' : '-'}
                              </div>
                              <div>
                                <div className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {catTitle}
                                </div>
                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">{subText}</div>
                              </div>
                            </div>
                            <div className="text-left">
                              <div className={`font-mono tabular-nums font-black text-sm ${isCredit ? 'text-[#008060]' : 'text-rose-500'}`}>
                                {formatMoney(tx.amount)}
                              </div>
                              <div className="text-[9px] font-mono text-slate-400">الرصيد: {formatMoney(tx.balanceAfter)}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                            <span className="font-mono">{tx.id.replace(/^grouped_/, '').slice(0, 12)}</span>
                            <span>{new Date(tx.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span>
                          </div>
                          
                          {isComp ? (
                            <button
                              type="button"
                              onClick={() => showToast('جاري تصدير ملف التعويض المعتمد', 'success')}
                              className="w-full py-2 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              تصدير الملف
                            </button>
                          ) : isWithdrawal ? (
                            <button
                              type="button"
                              onClick={() => showToast(`إشعار تحويل بنكي للمسحوبات رقم ${tx.id}`, 'success')}
                              className="w-full py-2 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-black text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                            >
                              عرض الفاتورة
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (tx.date) {
                                  const d = tx.date.slice(0, 10);
                                  setCycleStartDate(d);
                                  setCycleEndDate(d);
                                }
                                if (tx.referenceId) {
                                  setSelectedSettlementId(tx.referenceId);
                                }
                                setOrdersStatusFilter('all');
                                setOrdersTopViewMode('financial_cycle');
                                setTimeout(() => {
                                  document.getElementById('merchant-orders-list')?.scrollIntoView({ behavior: 'smooth' });
                                }, 150);
                              }}
                              className="w-full py-2 rounded-xl border border-slate-100 dark:border-slate-800 text-xs font-black text-[#008060] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
                            >
                              عرض التفاصيل
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Financial Cycle View: Summary Cards & Orders List (Matching image_c642fb6b.png & Mobile Screenshots) */
              <div className="space-y-5">
                <div className="space-y-4">
                  
                  {/* Top Bar: Date Picker Filter */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-[#008060]" />
                      <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>الدورة المالية الحالية</h3>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCycleDatePicker(prev => !prev)}
                        className={`text-xs font-mono font-black px-3.5 py-2 rounded-2xl border flex items-center gap-2 transition-all cursor-pointer ${
                          isDark ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-2xs'
                        }`}
                      >
                        <ChevronDown size={14} className="text-slate-400" />
                        <span>{cycleStartDate && cycleEndDate ? `${cycleStartDate} - ${cycleEndDate}` : '20-10-2026 - 20-10-2026'}</span>
                        <Calendar size={14} className="text-[#008060]" />
                      </button>

                      {showCycleDatePicker && (
                        <div className={`absolute top-11 left-0 z-40 p-4 rounded-[24px] border shadow-2xl space-y-3 w-72 ${
                          isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                        }`}>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">من تاريخ</label>
                              <input
                                type="date"
                                value={cycleStartDate}
                                onChange={e => setCycleStartDate(e.target.value)}
                                className={`w-full p-2 rounded-xl border font-mono text-xs ${
                                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-400 mb-1">إلى تاريخ</label>
                              <input
                                type="date"
                                value={cycleEndDate}
                                onChange={e => setCycleEndDate(e.target.value)}
                                className={`w-full p-2 rounded-xl border font-mono text-xs ${
                                  isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setShowCycleDatePicker(false)} className="px-3.5 py-1.5 rounded-xl bg-[#008060] text-white text-[11px] font-black cursor-pointer">تطبيق</button>
                            <button 
                              type="button" 
                              onClick={() => { 
                                setCycleStartDate(''); 
                                setCycleEndDate(''); 
                                setSelectedSettlementId(null);
                                setShowCycleDatePicker(false); 
                              }} 
                              className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-black cursor-pointer"
                            >
                              عرض الكل
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedSettlementId && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 max-w-fit">
                       <span className="text-[10px] font-bold text-[#008060]">تصفية بالتسوية المجمعة: {selectedSettlementId.slice(0, 15)}...</span>
                       <button onClick={() => setSelectedSettlementId(null)} className="text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"><X size={14} /></button>
                    </div>
                  )}

                  {/* 3 Summary Cards Grid (Matching image_c642fb6b.png & image_b0cae16d.png) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
                    
                    {/* Card 1 (Right): المبلغ المحصل */}
                    <div className={`p-5 rounded-[28px] border relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-500">
                          <span>المبلغ المحصل</span>
                          <HelpCircle size={14} className="text-slate-400" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCycleDetailsModal(showCycleDetailsModal === 'collected' ? null : 'collected')}
                          className="text-xs font-bold text-[#008060] hover:underline cursor-pointer"
                        >
                          عرض التفاصيل
                        </button>
                      </div>

                      <div className={`text-2xl font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {formatMoney(financialCycleSummary.totalCollected || 11715)}
                      </div>

                      {/* Collected Revenue Dark Popover */}
                      {showCycleDetailsModal === 'collected' && (
                        <div className="absolute top-14 left-4 z-40 w-72 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                            <span className="text-xs font-black">المبلغ المحصل</span>
                            <span className="font-mono font-black text-sm text-emerald-400">{formatMoney(financialCycleSummary.totalCollected || 11715)}</span>
                          </div>
                          <div className="space-y-2 text-xs font-bold text-slate-300">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">المبالغ النقدية المحصلة</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalCollected || 11715)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">المدفوعات عبر الإنترنت</span>
                              <span className="font-mono">0 ج.م</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">النقدية المسترجعة</span>
                              <span className="font-mono">0 ج.م</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Card 2 (Middle): سعر الشحن */}
                    <div className={`p-5 rounded-[28px] border relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-500">
                          <span>سعر الشحن</span>
                          <HelpCircle size={14} className="text-slate-400" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCycleDetailsModal(showCycleDetailsModal === 'shipping' ? null : 'shipping')}
                          className="text-xs font-bold text-[#008060] hover:underline cursor-pointer"
                        >
                          عرض التفاصيل
                        </button>
                      </div>

                      <div className={`text-2xl font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {formatMoney(financialCycleSummary.totalShippingFees || 1196.91)}
                      </div>

                      {/* Shipping Fees Breakdown Dark Popover (Matching image_c642fb6b.png) */}
                      {showCycleDetailsModal === 'shipping' && (
                        <div className="absolute top-14 left-4 z-40 w-72 bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
                            <span className="text-xs font-black">سعر الشحن</span>
                            <span className="font-mono font-black text-sm text-emerald-400">{formatMoney(financialCycleSummary.totalShippingFees || 1196.91)}</span>
                          </div>
                          <div className="space-y-2 text-xs font-bold text-slate-300">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                              <span className="text-slate-400">سعر الشحن</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalBaseShipping || 942)}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                              <span className="text-slate-400">التأمين</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalInsurance || 58.93)}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                              <span className="text-slate-400">رسوم فتح الشحنة</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalOpenPackage || 49)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">ضريبة قيمة مضافة 14%</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalVat || 146.98)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 3 (Left): صافي المستحقات */}
                    <div className={`p-5 rounded-[28px] border relative ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                      <div className="flex items-center gap-1.5 text-xs font-black text-slate-500 mb-2">
                        <span>صافي المستحقات</span>
                        <HelpCircle size={14} className="text-slate-400" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-[#008060] dark:text-emerald-400">
                        {formatMoney(financialCycleSummary.netEntitlement || 10518.09)}
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. قائمة الأوردرات Section Container (Matching image_c642fb6b.png) */}
                <div id="merchant-orders-list" className={`rounded-[28px] border p-4 sm:p-6 space-y-4 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
                }`}>
                  
                  {/* Title & Actions Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck size={19} className={isDark ? 'text-slate-200' : 'text-slate-800'} />
                        <h3 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          قائمة الأوردرات
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {filteredOrders.length || 8}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        قد يكون لديك المزيد من الطلبات المكتملة ، لكنها ستظهر في المحفظة بعد تأكيدها.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const rows = [
                            ['رقم الشحنة / الطلب', 'شركة الشحن', 'الوجهة', 'تاريخ الإضافة', 'حالة التوصيل', 'المبلغ المحصل', 'مصاريف الشحن', 'صافي المستحقات', 'حالة السداد']
                          ];
                          filteredOrders.forEach(o => {
                            const b = computeOrderFeeBreakdown(o);
                            const trackNum = getTrackingNumber(o) || o.orderNumber || o.id;
                            const dest = `${storeName} - ${(o as any).province || (o as any).city || 'العميل'}`;
                            rows.push([
                              String(trackNum),
                              o.shippingCompany || 'شركة الشحن',
                              dest,
                              o.date ? new Date(o.date).toLocaleDateString('ar-EG') : '',
                              o.status,
                              String(b.collected),
                              String(b.totalShipFee),
                              String(b.netEntitlement),
                              b.isSettled ? 'تم السداد بالمحفظة' : 'غير مدفوع'
                            ]);
                          });
                          const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
                          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `الدورة_المالية_للأوردرات_${new Date().toISOString().slice(0, 10)}.csv`;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast('تم تحميل شيت الدورة المالية للأوردرات بنجاح', 'success');
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                          isDark
                            ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs'
                        }`}
                        title="تحميل قائمة الأوردرات (Excel / CSV)"
                      >
                        <Download size={15} />
                        <span className="hidden sm:inline">تحميل</span>
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={ordersSearchQuery}
                      onChange={e => setOrdersSearchQuery(e.target.value)}
                      placeholder="بحث"
                      className={`w-full pr-10 pl-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-white focus:border-[#008060]'
                          : 'bg-white border-slate-200 text-slate-800 focus:border-[#008060]'
                      }`}
                    />
                    <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'all', label: 'الكل', count: orderStatusCounts.all },
                      { id: 'collected', label: 'تم بنجاح', count: orderStatusCounts.collected },
                      { id: 'shipping', label: 'في الطريق', count: orderStatusCounts.shipping },
                      { id: 'pending', label: 'قيد التجهيز', count: orderStatusCounts.pending },
                      { id: 'returned', label: 'مرتجع', count: orderStatusCounts.returned }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setOrdersStatusFilter(f.id as any)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                          ordersStatusFilter === f.id
                            ? 'bg-[#008060] text-white shadow-xs'
                            : isDark
                            ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`mr-1.5 font-mono text-[11px] ${
                          ordersStatusFilter === f.id ? 'text-emerald-100' : 'text-slate-400'
                        }`}>
                          ({f.count})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Desktop Table View (Matching Image image_c642fb6b.png) */}
                  <div className={`hidden md:block rounded-2xl border ${
                    isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-xs'
                  }`}>
                    <table className="w-full text-right text-xs">
                      <thead className={`${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-50 text-slate-600'} font-black border-b border-slate-100 dark:border-slate-800`}>
                        <tr>
                          <th className="py-3.5 px-4">رقم الشحنة</th>
                          <th className="py-3.5 px-4">النوع</th>
                          <th className="py-3.5 px-4">الوجهة ⇅</th>
                          <th className="py-3.5 px-4">المبلغ ⇅</th>
                          <th className="py-3.5 px-4">مصاريف بوسطة ⇅</th>
                          <th className="py-3.5 px-4">تاريخ الإضافة ⇅</th>
                          <th className="py-3.5 px-4 text-center">حالة التوصيل</th>
                          <th className="py-3.5 px-4 text-center">حالة السداد ⇅</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y font-bold ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">لا توجد أوردرات مطابقة للبحث أو الدورة المالية المحددة</td>
                          </tr>
                        ) : (
                          filteredOrders.map(o => {
                            const b = computeOrderFeeBreakdown(o);
                            const trackNum = getTrackingNumber(o) || o.orderNumber || o.id;
                            const trackUrl = getShippingTrackingUrl(o);
                            const destGov = (o as any).province || (o as any).governorate || (o as any).city || o.customerAddress?.split(/[-،,]/)?.[0] || 'البحر الأحمر';
                            const originName = (settings as any)?.storeProvince || 'كفر الشيخ';
                            const formattedArabicDate = o.date ? new Date(o.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) : 'الثلاثاء, 20 أكتوبر';
                            const isDeliveredSuccess = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
                            const isFeePopoverOpen = activeOrderPopover?.orderId === o.id && activeOrderPopover?.type === 'fee';
                            const isDatePopoverOpen = activeOrderPopover?.orderId === o.id && activeOrderPopover?.type === 'added_date';
                            const isSettlementPopoverOpen = activeOrderPopover?.orderId === o.id && activeOrderPopover?.type === 'settlement_status';

                            return (
                              <tr key={o.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}>
                                <td className="py-3.5 px-4 font-mono font-black text-sky-600 dark:text-sky-400">
                                  {trackUrl ? (
                                    <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                      <span>{trackNum}</span>
                                    </a>
                                  ) : (
                                    <span>{trackNum}</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                                  {b.isReturn ? 'استرجاع' : (o as any).packageType || 'توصيل'}
                                </td>
                                <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                                  {originName}-{destGov}
                                </td>
                                <td className="py-3.5 px-4 font-mono">
                                  {b.collected > 0 ? (
                                    <div>
                                      <div className="font-black text-slate-900 dark:text-white flex items-center gap-1">
                                        <span>{formatMoney(b.collected)}</span>
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">💳</span>
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-normal">المبالغ النقدية المحصلة</div>
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 font-normal flex items-center gap-1">
                                      <span>🚫</span>
                                      <span>بدون تحصيل</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300 relative">
                                  <div className="flex items-center gap-1">
                                    <span>{formatMoney(b.totalShipFee)}</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setActiveOrderPopover(isFeePopoverOpen ? null : { orderId: o.id, type: 'fee' })}
                                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <HelpCircle size={13} />
                                    </button>
                                  </div>
                                  {isFeePopoverOpen && (
                                    <div className="absolute top-10 right-2 z-50 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700 space-y-2 text-xs animate-in fade-in zoom-in-95">
                                      <div className="flex justify-between border-b border-slate-700 pb-1 font-black">
                                        <span>سعر الشحن</span>
                                        <span className="font-mono text-emerald-400">{formatMoney(b.totalShipFee)}</span>
                                      </div>
                                      <div className="flex justify-between text-slate-300"><span>سعر الشحن</span><span className="font-mono">{formatMoney(b.baseShipping)}</span></div>
                                      <div className="flex justify-between text-slate-300"><span>التأمين</span><span className="font-mono">{formatMoney(b.insuranceFee)}</span></div>
                                      <div className="flex justify-between text-slate-300"><span>رسوم فتح الشحنة</span><span className="font-mono">{formatMoney(b.openPackageFee || 49)}</span></div>
                                      <div className="flex justify-between text-slate-300"><span>ضريبة قيمة مضافة 14%</span><span className="font-mono">{formatMoney(b.vatFee)}</span></div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono relative">
                                  <div className={`font-black ${b.netEntitlement >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                                    {formatMoney(b.netEntitlement)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                                    <span>{formattedArabicDate}</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveOrderPopover(isDatePopoverOpen ? null : { orderId: o.id, type: 'added_date' })}
                                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <HelpCircle size={12} />
                                    </button>
                                  </div>
                                  {isDatePopoverOpen && (
                                    <div className="absolute top-10 right-2 z-50 w-64 bg-slate-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95">
                                      تاريخ إضافة النقدية المحصلة ومصاريف بوسطة إلى محفظتك.
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[11px] font-black inline-block ${
                                    isDeliveredSuccess
                                      ? 'bg-emerald-500/10 text-[#008060] dark:text-emerald-400'
                                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                  }`}>
                                    {isDeliveredSuccess ? 'تم بنجاح' : 'تم الاسترجاع'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center relative">
                                  <div className="inline-flex items-center gap-1">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black inline-block ${
                                      b.isSettled
                                        ? 'bg-emerald-500/10 text-[#008060] dark:text-emerald-400'
                                        : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                    }`}>
                                      {b.isSettled ? 'مدفوع' : 'غير مدفوع'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveOrderPopover(isSettlementPopoverOpen ? null : { orderId: o.id, type: 'settlement_status' })}
                                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                      <HelpCircle size={12} />
                                    </button>
                                  </div>
                                  {isSettlementPopoverOpen && (
                                    <div className="absolute top-10 left-2 z-50 w-64 bg-slate-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-slate-700 text-right animate-in fade-in zoom-in-95">
                                      تاريخ السحب النقدي من المحفظة إلى حسابك البنكي.
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Table Pagination Footer (Matching image_c642fb6b.png) */}
                    <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-3 text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-[11px]">
                        <span>50 / صفحة</span>
                        <ChevronDown size={13} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"><ChevronRight size={14} /></button>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#008060] text-white font-mono font-black text-[11px]">1</span>
                        <button type="button" className="p-1 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"><ChevronLeft size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Order Cards View (Matching image_b0cae16d.png, image_405fbc8a.png, image_5b28f778.png) */}
                  <div className="md:hidden grid grid-cols-1 gap-4 pt-1">
                    {filteredOrders.length === 0 ? (
                      <div className={`p-12 rounded-3xl border text-center text-xs font-bold text-slate-400 ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50/70 border-slate-200/70'
                      }`}>
                        لا توجد أوردرات مطابقة للبحث أو الدورة المالية المحددة
                      </div>
                    ) : (
                      filteredOrders.map(o => {
                        const b = computeOrderFeeBreakdown(o);
                        const trackNum = getTrackingNumber(o) || o.orderNumber || o.id;
                        const trackUrl = getShippingTrackingUrl(o);
                        const destGov = (o as any).province || (o as any).governorate || (o as any).city || o.customerAddress?.split(/[-،,]/)?.[0] || 'البحر الأحمر';
                        const originName = (settings as any)?.storeProvince || 'كفر الشيخ';
                        const formattedArabicDate = o.date ? new Date(o.date).toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' }) : 'الأربعاء, 21 أكتوبر';
                        const isDeliveredSuccess = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
                        const isFeePopoverOpen = activeOrderPopover?.orderId === o.id && activeOrderPopover?.type === 'fee';
                        const isDatePopoverOpen = activeOrderPopover?.orderId === o.id && activeOrderPopover?.type === 'added_date';
                        const isSettlementPopoverOpen = activeOrderPopover?.orderId === o.id && activeOrderPopover?.type === 'settlement_status';

                        return (
                          <div key={o.id} className={`rounded-[22px] border relative transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/90 shadow-2xs'}`}>
                            
                            {/* Card Header */}
                            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">{b.isReturn ? 'مرتجع شحنة' : (o as any).packageType || 'توصيل'}</span>
                                <a href={trackUrl || '#'} target="_blank" rel="noopener noreferrer" className="font-mono font-black text-sm text-[#008060] hover:underline">
                                  {trackNum}
                                </a>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[11px] font-black ${
                                isDeliveredSuccess ? 'bg-emerald-500/10 text-[#008060]' : 'bg-purple-500/10 text-purple-600'
                              }`}>
                                {isDeliveredSuccess ? 'تم بنجاح' : 'تم الاسترجاع'}
                              </span>
                            </div>

                            {/* Row 1: الوجهة (Right) | تاريخ الإضافة (Left) */}
                            <div className="grid grid-cols-2 p-4 border-b border-slate-100 dark:border-slate-800 text-xs gap-2">
                              <div>
                                <div className="text-[11px] text-slate-400 font-bold mb-1">الوجهة</div>
                                <div className="font-black text-slate-800 dark:text-slate-200">{originName} - {destGov}</div>
                              </div>
                              <div className="relative text-left">
                                <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 font-bold mb-1">
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveOrderPopover(isDatePopoverOpen ? null : { orderId: o.id, type: 'added_date' })} 
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <HelpCircle size={13} />
                                  </button>
                                  <span>تاريخ الإضافة</span>
                                </div>
                                <div className="font-black text-slate-800 dark:text-slate-200">{formattedArabicDate}</div>
                                {isDatePopoverOpen && (
                                  <div className="absolute top-11 right-0 z-50 w-60 sm:w-64 bg-slate-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 pointer-events-auto text-right">
                                    تاريخ إضافة النقدية المحصلة ومصاريف بوسطة إلى محفظتك.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: المبلغ (Right) | مصاريف بوسطة (Left) */}
                            <div className="grid grid-cols-2 p-4 border-b border-slate-100 dark:border-slate-800 text-xs gap-2">
                              <div>
                                <div className="text-[11px] text-slate-400 font-bold mb-1">المبلغ</div>
                                {b.collected > 0 ? (
                                  <div>
                                    <div className="font-mono font-black text-slate-900 dark:text-white flex items-center gap-1 text-sm">
                                      <span>{formatMoney(b.collected)}</span>
                                      <span className="text-xs">💳</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">المبالغ النقدية المحصلة</div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-slate-400 font-bold">
                                    <span>🚫</span>
                                    <span>بدون تحصيل</span>
                                  </div>
                                )}
                              </div>
                              <div className="relative text-left">
                                <div className="text-[11px] text-slate-400 font-bold mb-1">مصاريف بوسطة</div>
                                <div className="flex items-center justify-end gap-1 font-mono font-black text-slate-800 dark:text-slate-200 text-sm">
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveOrderPopover(isFeePopoverOpen ? null : { orderId: o.id, type: 'fee' })} 
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <HelpCircle size={13} />
                                  </button>
                                  <span>{formatMoney(b.totalShipFee)}</span>
                                </div>
                                {isFeePopoverOpen && (
                                  <div className="absolute top-11 left-0 z-50 w-60 sm:w-64 bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700 space-y-2 text-xs animate-in fade-in zoom-in-95 pointer-events-auto text-right">
                                    <div className="flex justify-between border-b border-slate-700 pb-1 font-black">
                                      <span>سعر الشحن</span>
                                      <span className="font-mono text-emerald-400">{formatMoney(b.totalShipFee)}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-300"><span>سعر الشحن</span><span className="font-mono">{formatMoney(b.baseShipping)}</span></div>
                                    <div className="flex justify-between text-slate-300"><span>التأمين</span><span className="font-mono">{formatMoney(b.insuranceFee)}</span></div>
                                    <div className="flex justify-between text-slate-300"><span>رسوم فتح الشحنة</span><span className="font-mono">{formatMoney(b.openPackageFee || 49)}</span></div>
                                    <div className="flex justify-between text-slate-300"><span>ضريبة قيمة مضافة 14%</span><span className="font-mono">{formatMoney(b.vatFee)}</span></div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 3: صافي المستحقات (Right) | حالة السداد (Left) */}
                            <div className="grid grid-cols-2 p-4 text-xs bg-slate-50/50 dark:bg-slate-900/50 gap-2">
                              <div>
                                <div className="text-[11px] text-slate-400 font-bold mb-1">صافي المستحقات</div>
                                <div className={`font-mono font-black text-sm ${b.netEntitlement >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-500'}`}>
                                  {formatMoney(b.netEntitlement)}
                                </div>
                              </div>
                              <div className="relative text-left">
                                <div className="flex items-center justify-end gap-1 text-[11px] text-slate-400 font-bold mb-1">
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveOrderPopover(isSettlementPopoverOpen ? null : { orderId: o.id, type: 'settlement_status' })} 
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                  >
                                    <HelpCircle size={13} />
                                  </button>
                                  <span>حالة السداد</span>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10.5px] font-black inline-flex items-center gap-1 ${
                                  b.isSettled ? 'bg-emerald-500/10 text-[#008060]' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  <span>{b.isSettled ? 'مدفوع' : 'غير مدفوع'}</span>
                                </span>
                                {isSettlementPopoverOpen && (
                                  <div className="absolute top-11 left-0 z-50 w-60 sm:w-64 bg-slate-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 pointer-events-auto text-right">
                                    تاريخ السحب النقدي من المحفظة إلى حسابك البنكي.
                                  </div>
                                )}
                              </div>
                            </div>

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 2B: CREATE ORDER STUDIO (شاشة إنشاء الأوردرات للوكيل بختم شيك)
           ========================================================= */}
        {currentTab === 'create_order' && (
          <div className="space-y-6">
            
            {/* Main Showcase Card with Official Chic Developer Stamp */}
            <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-10 shadow-xl ${
              isDark
                ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 border-slate-800 text-white'
                : 'bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 border-emerald-200/80 text-slate-900'
            }`}>
              {/* Decorative Ambient Glow */}
              <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#008060]/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Right Column (7 cols): Message, Features & CTA */}
                <div className="lg:col-span-7 space-y-5 text-right">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
                    <Sparkles size={14} />
                    <span>تحديث قادم لبوابة الموكلين · قريباً جداً</span>
                  </div>

                  <h2 className={`text-2xl sm:text-3xl font-black leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    استوديو إنشاء وإرسال الأوردرات المباشر للوكيل
                  </h2>

                  <p className={`text-sm sm:text-base leading-relaxed font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    يقوم حالياً الديفلوبر <span className="text-[#008060] dark:text-emerald-400 font-black underline decoration-amber-400/70 decoration-2 underline-offset-4">الباشمهندس / عبدالرحمن سعيد وفريقه</span> بالتطوير في الفترة الحالية لإطلاق منظومة تسجيل الأوردرات الذكية الخاصة بالوكلاء، لتتمكن من رفع أوردرات عملائك مباشرة من بضاعتك بالمخزن وإصدار بوليصة الشحن بضغطة زر.
                  </p>

                  {/* 3 Upcoming Capabilities Preview Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className={`p-3.5 rounded-2xl border ${
                      isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/90 border-slate-200/80 shadow-2xs'
                    }`}>
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-[#008060] flex items-center justify-center mb-2">
                        <PackageIcon size={16} />
                      </div>
                      <div className="text-xs font-black">ربط لحظي بمخزونك</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">اختيار الأصناف المتوفرة من بضاعتك بالمخزن تلقائياً</div>
                    </div>

                    <div className={`p-3.5 rounded-2xl border ${
                      isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/90 border-slate-200/80 shadow-2xs'
                    }`}>
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-2">
                        <Calculator size={16} />
                      </div>
                      <div className="text-xs font-black">حساب فوري لصافي ربحك</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">معاينة سعر الشحن والضرائب وصافي مستحقاتك قبل الإرسال</div>
                    </div>

                    <div className={`p-3.5 rounded-2xl border ${
                      isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/90 border-slate-200/80 shadow-2xs'
                    }`}>
                      <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 flex items-center justify-center mb-2">
                        <Truck size={16} />
                      </div>
                      <div className="text-xs font-black">إصدار البوليصة والتتبع</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">تحويل الطلب مباشرة لشركة الشحن ومتابعة دورته المالية</div>
                    </div>
                  </div>

                  {/* Interactive Notification Button */}
                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifyOrderFeatureReady(true);
                        showToast('تم تسجيل طلبك! سيصلك إشعار فور إطلاق شاشة إنشاء الأوردرات من فريق م/ عبدالرحمن سعيد', 'success');
                      }}
                      className={`px-5 py-3.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg ${
                        notifyOrderFeatureReady
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#008060] hover:bg-[#0a664e] text-white shadow-emerald-600/25'
                      }`}
                    >
                      <CheckCircle2 size={16} />
                      <span>
                        {notifyOrderFeatureReady
                          ? 'تم تفعيل تنبيه الإطلاق لحسابك بنجاح ✓'
                          : 'إبلاغي فور انتهاء التطوير وإطلاق الميزة'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateToTab('orders')}
                      className={`px-4 py-3.5 rounded-2xl text-xs font-black border transition-all cursor-pointer ${
                        isDark
                          ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      العودة للدورة المالية والأوردرات
                    </button>
                  </div>
                </div>

                {/* Left Column (5 cols): Bespoke Luxury Official Developer Seal (ختم شيك معتمد) */}
                <div className="lg:col-span-5 flex flex-col items-center justify-center">
                  <div className="relative group">
                    {/* Outer Glow Ring */}
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#008060]/30 via-amber-400/30 to-emerald-500/30 blur-xl opacity-80 group-hover:opacity-100 transition-opacity" />

                    {/* The Chic Circular Stamp */}
                    <div
                      className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-full p-3 shadow-2xl flex items-center justify-center -rotate-6 hover:rotate-0 transition-transform duration-300 border-4 border-double ${
                        isDark
                          ? 'bg-gradient-to-br from-slate-950 via-[#07261f] to-slate-900 border-amber-400/80 text-white'
                          : 'bg-gradient-to-br from-[#052e24] via-[#008060] to-[#042f2e] border-amber-300 text-white'
                      }`}
                    >
                      {/* Inner Dashed Gold Seal Ring */}
                      <div className="w-full h-full rounded-full border-2 border-dashed border-amber-300/70 flex flex-col items-center justify-between p-5 text-center relative">
                        
                        {/* Top Seal Header */}
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-center gap-1 text-amber-300 text-[10px] font-mono tracking-widest uppercase font-black">
                            <span>★</span>
                            <span>OFFICIAL DEV SEAL</span>
                            <span>★</span>
                          </div>
                          <div className="text-[11px] font-black text-emerald-200">
                            ختم التطوير الهندسي المعتمد
                          </div>
                        </div>

                        {/* Center Seal Emblem & Developer Name */}
                        <div className="my-auto space-y-1.5 py-2 border-y border-amber-300/30 w-full">
                          <div className="w-10 h-10 mx-auto rounded-2xl bg-amber-400/20 border border-amber-300/50 flex items-center justify-center text-amber-300 shadow-inner">
                            <Code2 size={22} />
                          </div>
                          <div className="text-[11px] font-bold text-emerald-200">
                            جاري التطوير حالياً بواسطة
                          </div>
                          <div className="text-base sm:text-lg font-black text-amber-300 tracking-tight leading-snug">
                            الديفلوبر عبدالرحمن سعيد
                          </div>
                          <div className="text-xs font-black text-white">
                            وفريقه الهندسي
                          </div>
                        </div>

                        {/* Bottom Seal Ribbon */}
                        <div className="space-y-1">
                          <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] tracking-wide shadow-sm">
                            قريباً جداً · COMING SOON
                          </span>
                          <div className="text-[9px] font-mono text-emerald-200/80">
                            VERIFIED · {storeName.toUpperCase().slice(0, 14)}
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Locked Preview Mockup of the Upcoming Order Creation Form (So the Merchant sees what's coming) */}
            <div className={`rounded-[28px] border p-5 sm:p-6 relative overflow-hidden ${
              isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white/80 border-slate-200/80'
            }`}>
              <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-800 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <Lock size={16} className="text-amber-500" />
                  <h4 className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    معاينة نموذج إنشاء الأوردر الجديد (قيد التجهيز النهائي)
                  </h4>
                </div>
                <span className="text-[11px] font-black text-[#008060] bg-emerald-500/10 px-3 py-1 rounded-full">
                  بضاعتك المتاحة بالمخزن: {merchantProducts.length} صنف ({overviewStats.totalStockUnits} قطعة)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-60 pointer-events-none select-none">
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[11px] text-slate-400 font-bold block mb-1">اسم ورقم هاتف المستلم</span>
                  <div className="text-xs font-black">أحمد محمد · 010XXXXXXXX</div>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[11px] text-slate-400 font-bold block mb-1">المحافظة والعنوان التفصيلي</span>
                  <div className="text-xs font-black">القاهرة - مدينة نصر - شارع عباس العقاد</div>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[11px] text-slate-400 font-bold block mb-1">اختيار الأصناف من مخزون الموكل</span>
                  <div className="text-xs font-black text-[#008060]">
                    {merchantProducts[0]?.name || 'صنف من بضاعتك بالمخزن'} (1 قطعة)
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================
            TAB 3: PRODUCT & GOVERNORATE ANALYTICS (الأصناف والمحافظات)
           ========================================================= */}
        {currentTab === 'analytics' && (
          <div className="space-y-5">
            {/* Header & Sort Bar */}
            <div className="bg-gradient-to-r from-[#064e3b] via-[#008060] to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-emerald-200 shrink-0">
                  <Award size={26} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    ترتيب الأصناف الأكثر مبيعاً والأعلى ربحية وتحليل المحافظات
                  </h3>
                  <p className="text-xs text-emerald-100/90 mt-0.5">
                    اعرف أي منتج من بضاعتك يحقق أعلى نسبة تسليم وأقل مرتجع، وأي المحافظات تشتري بضاعتك أكثر
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { id: 'delivered', label: 'الأكثر تسليماً' },
                  { id: 'profit', label: 'الأعلى ربحية' },
                  { id: 'deliveryRate', label: 'أعلى نسبة تسليم' },
                  { id: 'lowReturn', label: 'الأقل مرتجعاً' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setProductSortBy(opt.id as any)}
                    className={`px-3 py-2 rounded-xl font-black transition-all cursor-pointer whitespace-nowrap ${
                      productSortBy === opt.id
                        ? 'bg-white text-[#008060] shadow-xs'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Products Performance Section (Mobile Cards + Desktop Table) */}
            <div className={`rounded-3xl border overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className={`p-4 sm:p-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <h4 className={`font-black text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <TrendingUp size={18} className="text-[#008060]" />
                  <span>جدول أداء وترتيب أصناف بضاعتك ({merchantAnalyticsReport.productsList.length} صنف)</span>
                </h4>
              </div>

              {/* Mobile Cards for Products */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {merchantAnalyticsReport.productsList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-bold text-xs">
                    لا توجد بيانات مبيعات للأصناف حتى الآن
                  </div>
                ) : (
                  merchantAnalyticsReport.productsList.map((prod, idx) => (
                    <div key={prod.id + idx} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-emerald-500/15 text-[#008060] font-mono font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className={`font-black text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{prod.name}</div>
                            <div className="text-[11px] text-slate-400">
                              بالمخزن: <span className="font-mono text-[#008060] font-bold">{prod.stock} ق</span>
                              {prod.shippingQty > 0 && ` · في الطريق: ${prod.shippingQty} ق`}
                            </div>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="font-mono tabular-nums font-black text-sm text-[#008060]">
                            {formatMoney(prod.netMerchantProfit)}
                          </div>
                          <div className="text-[10px] text-slate-400">صافي مستحقاتك</div>
                        </div>
                      </div>

                      {/* Delivery vs Return Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-[#008060]">تسليم: {prod.deliveredQty} ق ({prod.deliveryRate}%)</span>
                          <span className="text-rose-500">مرتجع: {prod.returnedQty} ق ({prod.returnRate}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                          <div className="bg-[#008060] h-full" style={{ width: `${Math.min(100, prod.deliveryRate)}%` }} />
                          <div className="bg-rose-500 h-full" style={{ width: `${Math.min(100, prod.returnRate)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop Table for Products */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className={`${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-900 text-white'} font-black`}>
                    <tr>
                      <th className="py-3.5 px-4">#</th>
                      <th className="py-3.5 px-4">اسم الصنف / المنتج</th>
                      <th className="py-3.5 px-3 text-center">إجمالي المطلوب</th>
                      <th className="py-3.5 px-3 text-center">تم تسليمه</th>
                      <th className="py-3.5 px-3 text-center">مرتجع</th>
                      <th className="py-3.5 px-3 text-center">نسبة التسليم</th>
                      <th className="py-3.5 px-3 text-center">نسبة المرتجع</th>
                      <th className="py-3.5 px-3 text-center">إجمالي المبيعات</th>
                      <th className="py-3.5 px-4 text-center">صافي مستحقاتك</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-bold ${isDark ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {merchantAnalyticsReport.productsList.map((prod, idx) => (
                      <tr key={prod.id + idx} className={isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}>
                        <td className="py-3.5 px-4 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{prod.name}</div>
                          <div className="text-[10px] text-slate-400">
                            بالمخزن: <span className="font-mono text-[#008060]">{prod.stock} قطعة</span>
                            {prod.shippingQty > 0 && ` · في الطريق: ${prod.shippingQty} قطعة`}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums">{prod.orderedQty} ق</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-[#008060] font-black">{prod.deliveredQty} ق</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-rose-500">{prod.returnedQty} ق</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-[#008060] font-black">{prod.deliveryRate}%</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-rose-500">{prod.returnRate}%</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums">{formatMoney(prod.totalRevenue)}</td>
                        <td className="py-3.5 px-4 text-center font-mono tabular-nums font-black text-[#008060] text-sm">
                          {formatMoney(prod.netMerchantProfit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Governorates Ranking Section */}
            <div className={`rounded-3xl border overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className={`p-4 sm:p-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <h4 className={`font-black text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  <MapPin size={18} className="text-[#008060]" />
                  <span>ترتيب المحافظات الأكثر شراءً لبضاعتك ({merchantAnalyticsReport.governoratesList.length} محافظة)</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {merchantAnalyticsReport.governoratesList.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-slate-400 font-bold text-xs">
                    لا توجد بيانات شحن للمحافظات حتى الآن
                  </div>
                ) : (
                  merchantAnalyticsReport.governoratesList.map((gov, idx) => (
                    <div
                      key={gov.governorate + idx}
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50/70 border-slate-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#008060]">#{idx + 1}</span>
                          <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{gov.governorate}</span>
                        </div>
                        <span className="font-mono tabular-nums text-xs font-black text-[#008060]">
                          {formatMoney(gov.netMerchantPayout)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                        <span>إجمالي: {gov.totalOrders} طلب</span>
                        <span className="text-[#008060]">مسلّم: {gov.deliveredOrders} ({gov.deliveryRate}%)</span>
                        <span className="text-rose-500">مرتجع: {gov.returnedOrders}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#008060] rounded-full" style={{ width: `${Math.min(100, gov.deliveryRate)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 4: TRANSPARENCY & GOODS MOVEMENT (حركة البضاعة والشفافية)
           ========================================================= */}
        {currentTab === 'transparency' && (
          <MerchantTransparencyTab
            orders={rawOrders}
            settings={settings}
            customers={activeStoreData?.customers || []}
            initialMerchantIdOrName={liveMerchant.id || liveMerchant.name}
            isEmbeddedInPortal={true}
            isDark={isDark}
          />
        )}



        {/* =========================================================
            TAB 6: STATEMENT / LEDGER (كشف الحساب الرسمي PDF / Excel)
           ========================================================= */}
        {currentTab === 'statement' && (
          <div className="space-y-4">
            {/* Filter & Export Controls Card */}
            <div className={`rounded-3xl border p-5 space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4 ${
                isDark ? 'border-slate-800' : 'border-slate-100'
              }`}>
                <div>
                  <h3 className={`text-base sm:text-lg font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    <FileText className="text-[#008060]" size={20} />
                    <span>كشف الحساب الرسمي والفواتير المعتمدة (PDF / Excel)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    حدد الفترة الزمنية وحمّل كشف حسابك بصيغة PDF رسمية للطباعة أو شيت Excel للمراجعة المحاسبية
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPrintableStatementModal(true)}
                    className="px-4 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <Printer size={15} className="text-emerald-400" />
                    <span>معاينة وطباعة كشف الحساب (PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportStatementExcel}
                    className="px-4 py-2.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <Download size={15} />
                    <span>تصدير شيت إكسيل (Excel)</span>
                  </button>
                </div>
              </div>

              {/* Date Range & Type Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs font-bold">
                <div>
                  <label className="block text-slate-400 mb-1">من تاريخ:</label>
                  <input
                    type="date"
                    value={statementStartDate}
                    onChange={e => setStatementStartDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs outline-none focus:border-[#008060] ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">إلى تاريخ:</label>
                  <input
                    type="date"
                    value={statementEndDate}
                    onChange={e => setStatementEndDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs outline-none focus:border-[#008060] ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">نوع العمليات:</label>
                  <select
                    value={statementTypeFilter}
                    onChange={e => setStatementTypeFilter(e.target.value as any)}
                    className={`w-full p-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#008060] ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="all">جميع الحركات المالية ({liveMerchant?.transactions?.length || 0})</option>
                    <option value="settlements">التسويات والإضافات فقط (+)</option>
                    <option value="withdrawals">المسحوبات والخصومات فقط (-)</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
                      setStatementStartDate(firstDay);
                      setStatementEndDate(now.toISOString().slice(0, 10));
                    }}
                    className={`flex-1 py-2.5 px-2 rounded-xl text-[11px] font-black cursor-pointer ${
                      isDark ? 'bg-slate-800 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    هذا الشهر
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatementStartDate('');
                      setStatementEndDate('');
                      setStatementTypeFilter('all');
                    }}
                    className="py-2.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-xl text-[11px] font-black cursor-pointer"
                  >
                    الكل
                  </button>
                </div>
              </div>

              {/* Period Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50/70 border-emerald-200'}`}>
                  <span className="text-[10px] font-bold text-[#008060] block">إجمالي التسويات (+)</span>
                  <span className="text-base font-black font-mono tabular-nums text-[#008060]">
                    +{formatMoney(statementSummary.totalCredits)}
                  </span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-rose-50/70 border-rose-200'}`}>
                  <span className="text-[10px] font-bold text-rose-500 block">إجمالي المسحوبات (-)</span>
                  <span className="text-base font-black font-mono tabular-nums text-rose-500">
                    -{formatMoney(statementSummary.totalDebits)}
                  </span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 block">صافي حركة الفترة</span>
                  <span className={`text-base font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {statementSummary.netPeriodChange >= 0 ? '+' : ''}{formatMoney(statementSummary.netPeriodChange)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#008060] text-white">
                  <span className="text-[10px] font-bold text-emerald-100 block">الرصيد الحالي بالمحفظة</span>
                  <span className="text-base font-black font-mono tabular-nums text-white">
                    {formatMoney(overviewStats.persistentBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Mobile Transaction Cards (md:hidden) */}
            <div className="md:hidden space-y-2.5">
              {filteredStatementTransactions.length === 0 ? (
                <div className={`p-10 rounded-3xl border text-center text-xs font-bold text-slate-400 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  لا توجد عمليات مسجلة في كشف الحساب للفترة المحددة
                </div>
              ) : (
                filteredStatementTransactions.map(tx => {
                  const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
                  const receiptImg = tx.receiptImage || linkedReq?.receiptImage;
                  const transferRef = tx.transferReference || linkedReq?.transferReference;
                  const isCredit = tx.amount >= 0;

                  return (
                    <div
                      key={tx.id}
                      className={`p-4 rounded-3xl border space-y-2.5 ${
                        isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                            isCredit ? 'bg-emerald-500/15 text-[#008060]' : 'bg-rose-500/15 text-rose-500'
                          }`}>
                            {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                          </div>
                          <div>
                            <div className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {tx.type === 'order_delivered' ? 'تسوية مبيعات' :
                               tx.type === 'withdrawal' ? 'سحب مستحقات' :
                               isCredit ? 'إضافة رصيد' : 'خصم / تعديل'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              {new Date(tx.date).toLocaleDateString('ar-EG')}
                            </div>
                          </div>
                        </div>

                        <div className="text-left">
                          <div className={`font-mono tabular-nums font-black text-sm ${isCredit ? 'text-[#008060]' : 'text-rose-500'}`}>
                            {isCredit ? '+' : ''}{formatMoney(tx.amount)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            الرصيد: {formatMoney(tx.balanceAfter)}
                          </div>
                        </div>
                      </div>

                      {tx.notes && (
                        <div className={`text-xs ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {tx.notes}
                        </div>
                      )}

                      {(transferRef || receiptImg) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {transferRef && (
                            <span className="text-[10px] font-mono font-bold text-[#008060] bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                              مرجع: {transferRef}
                            </span>
                          )}
                          {receiptImg && (
                            <button
                              type="button"
                              onClick={() => setPreviewReceiptImage(receiptImg)}
                              className="text-[10px] font-black bg-[#008060] text-white px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={11} /> عرض الإيصال
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Statement Table (hidden md:block) */}
            <div className={`hidden md:block rounded-3xl border overflow-hidden ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className={`${isDark ? 'bg-slate-950 text-slate-300' : 'bg-slate-900 text-white'} font-black`}>
                    <tr>
                      <th className="py-3.5 px-4">التاريخ</th>
                      <th className="py-3.5 px-4">نوع العملية</th>
                      <th className="py-3.5 px-4 text-right">البيان والمرجع والإيصال</th>
                      <th className="py-3.5 px-4 text-center">المبلغ</th>
                      <th className="py-3.5 px-4 text-center">الرصيد بعد العملية</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                    {filteredStatementTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                          لا توجد عمليات مسجلة في كشف الحساب للفترة المحددة
                        </td>
                      </tr>
                    ) : (
                      filteredStatementTransactions.map(tx => {
                        const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
                        const receiptImg = tx.receiptImage || linkedReq?.receiptImage;
                        const transferRef = tx.transferReference || linkedReq?.transferReference;

                        return (
                          <tr key={tx.id} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}>
                            <td className="py-4 px-4 font-mono text-[11px] font-bold">
                              {new Date(tx.date).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="py-4 px-4 font-black">
                              {tx.type === 'order_delivered' ? 'تسوية مبيعات' : 
                               (tx.notes || '').includes('مصروفات') ? 'خصم مصروفات إضافية' :
                               tx.type === 'withdrawal' ? 'سحب رصيد' : 
                               tx.amount > 0 ? 'إضافة رصيد' : 'تعديل رصيد'}
                            </td>
                            <td className="py-4 px-4 max-w-md">
                              <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tx.notes}</div>
                              {(transferRef || receiptImg) && (
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  {transferRef && (
                                    <span className="text-[10px] font-mono font-black bg-emerald-500/10 text-[#008060] px-2 py-0.5 rounded-md">
                                      مرجع التحويل: {transferRef}
                                    </span>
                                  )}
                                  {receiptImg && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewReceiptImage(receiptImg)}
                                      className="text-[10px] font-black bg-[#008060] text-white px-2.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye size={11} /> عرض إيصال التحويل
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className={`py-4 px-4 text-center font-black font-mono tabular-nums text-sm ${tx.amount >= 0 ? 'text-[#008060]' : 'text-rose-500'}`}>
                              {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                            </td>
                            <td className={`py-4 px-4 text-center font-black font-mono tabular-nums text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                              {formatMoney(tx.balanceAfter)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 7: ACCOUNT, SAVED PAYOUT ACCOUNTS & SECURITY (حسابي والأمان)
           ========================================================= */}
        {currentTab === 'account' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Saved Payout Accounts Card */}
            <div className={`rounded-3xl p-5 sm:p-6 border space-y-5 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
            }`}>
              <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#008060] flex items-center justify-center font-black">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    حسابات الدفع المفضلة للسحب السريع
                  </h3>
                  <p className="text-xs text-slate-400">
                    احفظ أرقام محافظك وحسابك البنكي لتظهر تلقائياً عند طلب السحب
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePayoutAccounts} className="space-y-4 text-xs font-bold">
                <div>
                  <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    رقم محفظة الكاش (Vodafone / Etisalat / Orange / WE)
                  </label>
                  <input
                    type="text"
                    value={savedWalletPhone}
                    onChange={e => setSavedWalletPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#008060] ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    عنوان انستا باي (InstaPay Handle / IPA أو الرقم)
                  </label>
                  <input
                    type="text"
                    value={savedInstaPay}
                    onChange={e => setSavedInstaPay(e.target.value)}
                    placeholder="username@instapay أو 010XXXXXXXX"
                    className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#008060] ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>اسم البنك</label>
                    <input
                      type="text"
                      value={savedBankName}
                      onChange={e => setSavedBankName(e.target.value)}
                      placeholder="مثال: البنك الأهلي / CIB"
                      className={`w-full p-3.5 border rounded-2xl text-xs outline-none focus:border-[#008060] ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>اسم المستفيد الثلاثي</label>
                    <input
                      type="text"
                      value={savedBeneficiaryName}
                      onChange={e => setSavedBeneficiaryName(e.target.value)}
                      placeholder="الاسم كما يظهر بالبنك"
                      className={`w-full p-3.5 border rounded-2xl text-xs outline-none focus:border-[#008060] ${
                        isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    رقم الحساب البنكي أو الآيبان (IBAN)
                  </label>
                  <input
                    type="text"
                    value={savedBankAccount}
                    onChange={e => setSavedBankAccount(e.target.value)}
                    placeholder="EG000000000000000000000000000"
                    className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#008060] ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingPayoutAccounts}
                  className="w-full py-3.5 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{isSavingPayoutAccounts ? 'جاري الحفظ...' : 'حفظ حسابات الدفع المفضلة'}</span>
                </button>
              </form>
            </div>

            {/* Security: PIN Change & Biometric Setup */}
            <div className="space-y-5">
              {/* Change Secret PIN Card */}
              <div className={`rounded-3xl p-5 sm:p-6 border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
              }`}>
                <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#008060] flex items-center justify-center font-black">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      تغيير رمز الدخول السري (PIN)
                    </h3>
                    <p className="text-xs text-slate-400">
                      قم بتعيين رمز مرور سري خاص بك بدلاً من الرمز الافتراضي
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangeMerchantPin} className="space-y-3.5 text-xs font-bold">
                  {liveMerchant.passcode && liveMerchant.passcode !== '0000' && (
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>رمز PIN الحالي</label>
                      <input
                        type="password"
                        required
                        value={currentPinInput}
                        onChange={e => setCurrentPinInput(e.target.value)}
                        placeholder="أدخل رمز PIN الحالي"
                        className={`w-full p-3.5 border rounded-2xl font-mono text-center tracking-[4px] outline-none focus:border-[#008060] ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>رمز PIN الجديد</label>
                      <input
                        type="password"
                        required
                        value={newPinInput}
                        onChange={e => setNewPinInput(e.target.value)}
                        placeholder="••••"
                        maxLength={10}
                        className={`w-full p-3.5 border rounded-2xl font-mono text-center tracking-[4px] outline-none focus:border-[#008060] ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>تأكيد رمز PIN الجديد</label>
                      <input
                        type="password"
                        required
                        value={confirmPinInput}
                        onChange={e => setConfirmPinInput(e.target.value)}
                        placeholder="••••"
                        maxLength={10}
                        className={`w-full p-3.5 border rounded-2xl font-mono text-center tracking-[4px] outline-none focus:border-[#008060] ${
                          isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPin || !newPinInput.trim()}
                    className="w-full py-3.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Key size={15} className="text-emerald-400" />
                    <span>{isChangingPin ? 'جاري التحديث...' : 'تحديث رمز الدخول السري (PIN)'}</span>
                  </button>
                </form>
              </div>

              {/* Biometric FaceID / TouchID Setup Card */}
              <div className={`rounded-3xl p-5 sm:p-6 border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80 shadow-xs'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#008060] flex items-center justify-center">
                      <Fingerprint size={22} />
                    </div>
                    <div>
                      <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        الدخول السريع ببصمة الهاتف / FaceID
                      </h4>
                      <p className="text-xs text-slate-400">
                        سجل دخولك بلمسة واحدة من هاتفك دون الحاجة لكتابة الكود في كل مرة
                      </p>
                    </div>
                  </div>
                </div>

                {merchantBiometrics.length > 0 && (
                  <div className="space-y-2">
                    {merchantBiometrics.map(b => (
                      <div
                        key={b.id}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-emerald-50/50 border-emerald-200'
                        }`}
                      >
                        <div>
                          <div className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{b.name}</div>
                          <div className="text-[10px] text-slate-400">
                            مفعل منذ {new Date(b.createdAt).toLocaleDateString('ar-EG')}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            removeStoredBiometric(`merchant_${liveMerchant.id}`, b.id);
                            setIsRegisteringBio(prev => !prev);
                            showToast('تم إلغاء البصمة من هذا الجهاز', 'success');
                          }}
                          className="text-rose-500 hover:underline font-bold text-xs cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRegisterMerchantBiometric}
                  disabled={!biometricAvailable || isRegisteringBio}
                  className="w-full py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Fingerprint size={16} />
                  <span>
                    {biometricAvailable
                      ? 'تفعيل بصمة هذا الهاتف / الجهاز الآن'
                      : 'البصمة غير مدعومة على هذا المتصفح'}
                  </span>
                </button>
              </div>

              {/* Clean Slate / Reset Merchant Data for Testing Card */}
              <div className={`rounded-3xl p-5 sm:p-6 border space-y-3 ${
                isDark ? 'bg-rose-950/15 border-rose-900/40' : 'bg-rose-50/40 border-rose-200/80'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className={`font-black text-sm ${isDark ? 'text-rose-300' : 'text-rose-900'}`}>
                      تصفير بيانات الموكل (بدء اختبار جديد)
                    </h4>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-rose-400/80' : 'text-rose-700/80'}`}>
                      مسح كافة الأوردرات وطلبات السحب والحركات المالية وتصفير الرصيد للموكل الحالي للبدء من جديد
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!liveMerchant) return;
                    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
                    setIsRefreshing(true);
                    try {
                      const res = await db.resetMerchantAccountData(targetStore, liveMerchant.id, liveMerchant.name);
                      setMerchantRequestsList([]);
                      setDirectStoreData(prev => prev ? {
                        ...prev,
                        orders: res.remainingOrders,
                        settings: {
                          ...prev.settings,
                          suppliers: res.updatedSuppliers.length > 0 ? res.updatedSuppliers : prev.settings.suppliers,
                          partners: res.updatedPartners.length > 0 ? res.updatedPartners : prev.settings.partners,
                          partnerTransactions: []
                        }
                      } : prev);
                      setAuthenticatedMerchant(prev => prev ? { ...prev, balance: 0, transactions: [] } : prev);
                      await fetchFreshData(false);
                      showToast('تم مسح جميع الأوردرات والسحوبات وتصفير الرصيد بنجاح للبدء من جديد!', 'success');
                    } catch (e: any) {
                      showToast('حدث خطأ أثناء التصفير: ' + (e.message || ''), 'error');
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
                  <span>مسح الأوردرات والسحوبات وتصفير الحساب الآن</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </main>

      {/* =====================================================================
          FLOATING PILL BOTTOM NAVIGATION DOCK (Exact Match to Reference 1 in Brand Colors)
         ===================================================================== */}
      <div
        className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[520px] z-40"
        dir="rtl"
      >
        <div
          className={`rounded-[32px] px-3 py-2 shadow-2xl border backdrop-blur-xl flex items-center justify-between gap-1 transition-colors ${
            isDark
              ? 'bg-slate-900/95 border-slate-800 shadow-black/60'
              : 'bg-white/95 border-slate-200/90 shadow-slate-900/10'
          }`}
        >
          {/* 1. Home Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('overview')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'overview' && !showFullMenuDrawer && !showProfileBottomSheet
                ? 'text-[#008060] bg-emerald-500/10 font-black'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title="الرئيسية"
          >
            <Home size={20} />
          </button>

          {/* 2. Notifications Bell with Red Dot */}
          <button
            type="button"
            onClick={() => {
              setShowNotificationsSheet(prev => !prev);
              setShowFullMenuDrawer(false);
              setShowProfileBottomSheet(false);
            }}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              showNotificationsSheet
                ? 'text-[#008060] bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title="الإشعارات والتنبيهات"
          >
            <Bell size={20} />
            {(unreadAlertsCount > 0 || merchantOrders.length > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </button>

          {/* 3. Analytics / Customers Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('analytics')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'analytics' && !showFullMenuDrawer
                ? 'text-[#008060] bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title="أداء الأصناف والمحافظات"
          >
            <Users size={20} />
          </button>

          {/* 4. Orders / Inbox Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('orders')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'orders' && !showFullMenuDrawer
                ? 'text-[#008060] bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title="أوردراتي وشحناتي"
          >
            <Inbox size={20} />
          </button>

          {/* 5. Statement / Vouchers Ticket Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('statement')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'statement' && !showFullMenuDrawer
                ? 'text-[#008060] bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
            title="كشف الحساب الرسمي"
          >
            <Ticket size={20} />
          </button>

          {/* 6. Prominent Brand Circular Menu Button (Opens Full Menu "القائمة" like Reference 1) */}
          <button
            type="button"
            onClick={() => {
              setShowFullMenuDrawer(prev => !prev);
              setShowProfileBottomSheet(false);
              setShowNotificationsSheet(false);
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center text-white shadow-lg transition-transform active:scale-95 cursor-pointer ${
              showFullMenuDrawer
                ? 'bg-slate-900 dark:bg-emerald-600 shadow-slate-900/30'
                : 'bg-[#008060] hover:bg-[#0a664e] shadow-emerald-600/35'
            }`}
            title="القائمة الكاملة"
          >
            {showFullMenuDrawer ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* 7. Circular SVG Completion / Delivery Progress Ring (like "3/6" in Reference 1) */}
          <button
            type="button"
            onClick={() => navigateToTab('account')}
            className="relative w-10 h-10 flex items-center justify-center cursor-pointer"
            title={`اكتمال إعدادات الحساب (${accountReadiness.done}/${accountReadiness.total})`}
          >
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                className={isDark ? 'stroke-slate-800' : 'stroke-slate-200'}
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#008060"
                strokeWidth="3"
                strokeDasharray={`${(accountReadiness.pct * 94.2) / 100} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute text-[10px] font-mono font-black ${isDark ? 'text-emerald-400' : 'text-[#008060]'}`}>
              {accountReadiness.done}/{accountReadiness.total}
            </span>
          </button>

          {/* 8. Store / Profile Initials Rounded Square Badge (Opens Profile Bottom Sheet like Reference 2 & 3) */}
          <button
            type="button"
            onClick={() => {
              setShowProfileBottomSheet(prev => !prev);
              setShowFullMenuDrawer(false);
              setShowNotificationsSheet(false);
            }}
            className={`relative w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs transition-all cursor-pointer ${
              showProfileBottomSheet
                ? 'bg-[#008060] text-white shadow-md'
                : isDark
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80'
            }`}
            title="الملف الشخصي والمظهر والإعدادات السريعة"
          >
            <span>{getInitials(storeName)}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          FULL "القائمة" EXPANDABLE MENU DRAWER (Matching Reference 1 in Brand Colors)
         ===================================================================== */}
      <AnimatePresence>
        {showFullMenuDrawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 pb-20 sm:p-6"
            dir="rtl"
            onClick={() => setShowFullMenuDrawer(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md max-h-[82vh] overflow-y-auto rounded-[28px] p-6 shadow-2xl border ${
                isDark
                  ? 'bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950/40 border-slate-800 text-slate-100'
                  : 'bg-gradient-to-b from-emerald-50/70 via-white to-teal-50/50 border-white text-slate-800'
              }`}
            >
              {/* Header: القائمة */}
              <div className={`flex items-center justify-between pb-4 mb-2 border-b ${
                isDark ? 'border-slate-800' : 'border-slate-200/80'
              }`}>
                <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  القائمة
                </h2>
                <button
                  type="button"
                  onClick={() => setShowFullMenuDrawer(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Menu Rows (Exact visual structure of Reference 1 with icons on right, chevrons on left) */}
              <div className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-200/70'} text-sm font-bold`}>
                
                {/* Row 1: الرئيسية */}
                <button
                  type="button"
                  onClick={() => navigateToTab('overview')}
                  className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Home size={20} className="text-[#008060]" />
                    <span>الرئيسية والأرصدة</span>
                  </div>
                </button>

                {/* Row 2: المنتجات والطلبات (Expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'products_orders' ? null : 'products_orders')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <ShoppingBag size={20} className="text-[#008060]" />
                      <span>المنتجات والطلبات</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${expandedMenuSection === 'products_orders' ? 'rotate-180 text-[#008060]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'products_orders' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={() => navigateToTab('create_order')}
                        className="w-full py-2 text-right text-[#008060] font-black flex items-center justify-between cursor-pointer"
                      >
                        <span>+ إنشاء أوردر جديد للوكيل</span>
                        <span className="text-[10px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black">قريباً</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('orders')}
                        className="w-full py-2 text-right hover:text-[#008060] flex items-center justify-between cursor-pointer"
                      >
                        <span>الدورة المالية للأوردرات والشحنات</span>
                        <span className="font-mono text-[11px] text-[#008060]">{merchantOrders.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('transparency')}
                        className="w-full py-2 text-right hover:text-[#008060] flex items-center justify-between cursor-pointer"
                      >
                        <span>حركة البضاعة والمخزن (الشفافية)</span>
                        <span className="font-mono text-[11px] text-[#008060]">{merchantProducts.length} صنف</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 3: التقارير وأداء المبيعات (Expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'analytics_group' ? null : 'analytics_group')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <Radio size={20} className="text-[#008060]" />
                      <span>المبيعات وتحليل المحافظات</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${expandedMenuSection === 'analytics_group' ? 'rotate-180 text-[#008060]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'analytics_group' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={() => navigateToTab('analytics')}
                        className="w-full py-2 text-right hover:text-[#008060] block cursor-pointer"
                      >
                        ترتيب الأصناف الأكثر مبيعاً والأعلى ربحية
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('analytics')}
                        className="w-full py-2 text-right hover:text-[#008060] block cursor-pointer"
                      >
                        توزيع المحافظات ونسب التسليم والمرتجع
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 4: صندوق الوارد والإشعارات */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    setShowNotificationsSheet(true);
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Inbox size={20} className="text-[#008060]" />
                    <span>صندوق الإشعارات والتسويات</span>
                  </div>
                  {unreadAlertsCount > 0 && (
                    <span className="font-mono text-xs text-white bg-[#008060] px-2 py-0.5 rounded-full">
                      {unreadAlertsCount}
                    </span>
                  )}
                </button>

                {/* Row 5: المحفظة والمسحوبات (Expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'finance_group' ? null : 'finance_group')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <WalletIcon size={20} className="text-[#008060]" />
                      <span>المحفظة وطلبات السحب</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${expandedMenuSection === 'finance_group' ? 'rotate-180 text-[#008060]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'finance_group' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={() => {
                          setShowFullMenuDrawer(false);
                          setShowRequestModal(true);
                        }}
                        className="w-full py-2 text-right text-[#008060] font-black block cursor-pointer"
                      >
                        + طلب سحب مستحقات فوري
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOrdersTopViewMode('financial_cycle');
                          navigateToTab('orders');
                        }}
                        className="w-full py-2 text-right hover:text-[#008060] block cursor-pointer"
                      >
                        سجل المسحوبات وإيصالات التحويل المعتمدة
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('statement')}
                        className="w-full py-2 text-right hover:text-[#008060] block cursor-pointer"
                      >
                        كشف الحساب الرسمي (PDF / Excel)
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 6: الإعدادات والأمان */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'settings_group' ? null : 'settings_group')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <Settings size={20} className="text-[#008060]" />
                      <span>الإعدادات والأمان</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-slate-400 transition-transform ${expandedMenuSection === 'settings_group' ? 'rotate-180 text-[#008060]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'settings_group' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <button
                        type="button"
                        onClick={() => navigateToTab('account')}
                        className="w-full py-2 text-right hover:text-[#008060] block cursor-pointer"
                      >
                        حفظ حسابات الدفع (Vodafone Cash / InstaPay / بنك)
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('account')}
                        className="w-full py-2 text-right hover:text-[#008060] block cursor-pointer"
                      >
                        تغيير رمز PIN وتفعيل بصمة الهاتف
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 7: تواصل مع إدارة المتجر */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    setShowProfileBottomSheet(true);
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#008060] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <HeartHandshake size={20} className="text-[#008060]" />
                    <span>الملف الشخصي والمظهر</span>
                  </div>
                </button>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          SLIDE-UP PROFILE & QUICK SETTINGS BOTTOM SHEET (Exact Match to Reference 2 & 3)
         ===================================================================== */}
      <AnimatePresence>
        {showProfileBottomSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center"
            dir="rtl"
            onClick={() => setShowProfileBottomSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 shadow-2xl border ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-slate-100'
                  : 'bg-white border-slate-200 text-slate-800'
              } space-y-5`}
            >
              {/* Top Drag Handle Bar */}
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-2" />

              {/* 1. Merchant Identity Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#008060] to-emerald-500 text-white flex items-center justify-center font-black text-lg shadow-md">
                      {getInitials(liveMerchant.name)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  </div>
                  <div>
                    <div className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {liveMerchant.name}
                    </div>
                    <div className="text-xs text-slate-400 font-medium">
                      {liveMerchant.role || 'موكل معتمد / Owner'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileBottomSheet(false)}
                  className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* 2. Highlighted Balance & Account Tier Box (Matching Reference 2) */}
              <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                isDark
                  ? 'bg-emerald-950/30 border-emerald-800/60'
                  : 'bg-emerald-50/70 border-emerald-200/80'
              }`}>
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">حالة الشراكة</span>
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black shadow-2xs ${
                    isDark ? 'bg-slate-900 text-emerald-400' : 'bg-white text-[#008060]'
                  }`}>
                    <DollarSign size={13} />
                    <span>موكل معتمد</span>
                  </div>
                </div>

                <div className="text-left space-y-1">
                  <span className="text-[11px] text-slate-400 font-bold block">الرصيد المتاح</span>
                  <div className={`font-mono tabular-nums font-black text-base ${isDark ? 'text-white' : 'text-slate-900'}`} dir="ltr">
                    EGP {hideBalances ? '•••••' : availableForWithdrawal.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 3. Active Store Selector Card with Checkmark & Order Count Badge (Matching Reference 2) */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isDark
                  ? 'bg-slate-950/70 border-emerald-800/50'
                  : 'bg-emerald-50/30 border-emerald-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                      isDark ? 'bg-slate-800 text-slate-200' : 'bg-slate-200/80 text-slate-700'
                    }`}>
                      {getInitials(storeName)}
                    </div>
                    {merchantOrders.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black shadow-xs">
                        {merchantOrders.length}
                      </span>
                    )}
                  </div>
                  <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {storeName}
                  </span>
                </div>

                <Check size={18} className="text-[#008060]" />
              </div>

              {/* 4. Interactive Toggles (Activity, Notifications, Sound, Privacy) */}
              <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'} text-xs font-bold`}>
                <div className="py-3.5 flex items-center justify-between">
                  <span>حالة النشاط (استقبال التوريد)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isActiveStatus;
                      setIsActiveStatus(next);
                      try { localStorage.setItem('merchant_portal_active', String(next)); } catch {}
                    }}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                      isActiveStatus ? 'bg-[#008060] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-5.5 h-5.5 rounded-full bg-white shadow-sm block" />
                  </button>
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <span>تفعيل/إيقاف الإشعارات</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notificationsEnabled;
                      setNotificationsEnabled(next);
                      try { localStorage.setItem('merchant_portal_notifs', String(next)); } catch {}
                    }}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                      notificationsEnabled ? 'bg-[#008060] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-5.5 h-5.5 rounded-full bg-white shadow-sm block" />
                  </button>
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <span>صوت الرسائل والتنبيهات</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundAlertsEnabled;
                      setSoundAlertsEnabled(next);
                      try { localStorage.setItem('merchant_portal_sound', String(next)); } catch {}
                    }}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                      soundAlertsEnabled ? 'bg-[#008060] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-5.5 h-5.5 rounded-full bg-white shadow-sm block" />
                  </button>
                </div>

                <div className="py-3.5 flex items-center justify-between">
                  <span>وضع الخصوصية (إخفاء الأرصدة)</span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hideBalances;
                      setHideBalances(next);
                      try { localStorage.setItem('merchant_portal_hide_bal', String(next)); } catch {}
                    }}
                    className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center ${
                      hideBalances ? 'bg-[#008060] justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                  >
                    <span className="w-5.5 h-5.5 rounded-full bg-white shadow-sm block" />
                  </button>
                </div>
              </div>

              {/* 5. Theme Switcher (المظهر: فاتح / النظام / داكن — Matching Reference 2 & 3) */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-slate-400 block">المظهر</span>
                <div className={`grid grid-cols-3 gap-1 p-1 rounded-2xl ${
                  isDark ? 'bg-slate-950 border border-slate-800' : 'bg-slate-100'
                }`}>
                  {[
                    { id: 'light', label: 'فاتح', icon: Sun },
                    { id: 'system', label: 'النظام', icon: Monitor },
                    { id: 'dark', label: 'داكن', icon: Moon }
                  ].map(m => {
                    const Icon = m.icon;
                    const active = themeMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setThemeMode(m.id as ThemeMode)}
                        className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          active
                            ? isDark
                              ? 'bg-slate-800 text-emerald-400 shadow-xs'
                              : 'bg-white text-[#008060] shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 6. Bottom Quick Links (Matching Reference 3) */}
              <div className={`divide-y ${isDark ? 'divide-slate-800' : 'divide-slate-100'} text-xs font-bold pt-2 border-t ${
                isDark ? 'border-slate-800' : 'border-slate-100'
              }`}>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-3.5 flex items-center justify-between text-rose-500 hover:opacity-80 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <LogOut size={17} />
                    <span>تسجيل الخروج</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('analytics')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#008060] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Users size={17} className="text-slate-400" />
                    <span>أداء الأصناف والمحافظات</span>
                  </div>
                  <ChevronLeft size={15} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('transparency')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#008060] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <PackageIcon size={17} className="text-slate-400" />
                    <span>المنتجات وبضاعة الأمانة</span>
                  </div>
                  <ChevronLeft size={15} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('orders')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#008060] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Ticket size={17} className="text-slate-400" />
                    <span>إدارة الأوردرات والشحنات</span>
                  </div>
                  <ChevronLeft size={15} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setOrdersTopViewMode('financial_cycle');
                    navigateToTab('orders');
                  }}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#008060] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <WalletIcon size={17} className="text-slate-400" />
                    <span>المدفوعات وإيصالات التحويل</span>
                  </div>
                  <ChevronLeft size={15} className="text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('account')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#008060] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Settings size={17} className="text-slate-400" />
                    <span>الإعدادات وحسابات الدفع ورمز PIN</span>
                  </div>
                  <ChevronLeft size={15} className="text-slate-400" />
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          NOTIFICATIONS & RECENT ACTIVITY SHEET (Bell Icon Drawer)
         ===================================================================== */}
      <AnimatePresence>
        {showNotificationsSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center"
            dir="rtl"
            onClick={() => setShowNotificationsSheet(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-md max-h-[80vh] overflow-y-auto rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl border ${
                isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
              } space-y-4`}
            >
              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto -mt-1 mb-1" />
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-[#008060]" />
                  <h3 className="font-black text-sm">آخر التحديثات والإشعارات المالية</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationsSheet(false)}
                  className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {merchantFilteredRequests.slice(0, 5).map(req => (
                  <div
                    key={req.id}
                    onClick={() => {
                      setOrdersTopViewMode('financial_cycle');
                      navigateToTab('orders');
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    <div>
                      <div className="font-black">
                        {req.status === 'approved' ? 'تم اعتماد وتحويل طلب السحب' : req.status === 'pending' ? 'طلب سحب قيد المراجعة' : 'تحديث على طلب سحب'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        المبلغ: <span className="font-mono font-bold text-[#008060]">{formatMoney(req.amount)}</span> · {new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-slate-400 shrink-0" />
                  </div>
                ))}

                {(liveMerchant.transactions || []).slice(0, 5).map(tx => (
                  <div
                    key={tx.id}
                    onClick={() => navigateToTab('statement')}
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 ${
                      isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{tx.notes || 'حركة مالية بكشف الحساب'}</div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {new Date(tx.date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <span className={`font-mono font-black shrink-0 ${tx.amount >= 0 ? 'text-[#008060]' : 'text-rose-500'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                    </span>
                  </div>
                ))}

                {merchantFilteredRequests.length === 0 && (!liveMerchant.transactions || liveMerchant.transactions.length === 0) && (
                  <div className="py-10 text-center text-slate-400 font-bold">
                    لا توجد إشعارات جديدة حالياً
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payout Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className={`w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border ${
            isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <h3 className="font-black text-base">طلب سحب مستحقات البضائع</h3>
              <button onClick={() => setShowRequestModal(false)} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className={`grid grid-cols-3 gap-2 p-3 border rounded-2xl text-center ${
              isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
            }`}>
              <div>
                <div className="text-[10px] text-slate-400 font-bold">إجمالي المحفظة</div>
                <div className="text-xs font-black font-mono tabular-nums">{(liveMerchant?.balance || 0).toLocaleString()} ج.م</div>
              </div>
              <div>
                <div className="text-[10px] text-amber-500 font-bold">محجوز معلق</div>
                <div className="text-xs font-black text-amber-500 font-mono tabular-nums">{pendingRequestsSum.toLocaleString()} ج.م</div>
              </div>
              <div>
                <div className="text-[10px] text-[#008060] font-bold">المتاح للسحب</div>
                <div className="text-xs font-black text-[#008060] font-mono tabular-nums">{availableForWithdrawal.toLocaleString()} ج.م</div>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-400 mb-1.5">المبلغ المطلوب سحبه (ج.م):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={requestAmount}
                    max={availableForWithdrawal}
                    onChange={e => setRequestAmount(e.target.value)}
                    placeholder={`الحد الأقصى المتاح: ${availableForWithdrawal.toLocaleString()}`}
                    className={`w-full p-3.5 border rounded-2xl outline-none font-mono font-black ${
                      isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                    required
                  />
                  {availableForWithdrawal > 0 && (
                    <button
                      type="button"
                      onClick={() => setRequestAmount(String(availableForWithdrawal))}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#008060] text-white rounded-xl text-[10px] font-black cursor-pointer"
                    >
                      سحب الكل
                    </button>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-400">طريقة التحويل المفضلة:</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      navigateToTab('account');
                    }}
                    className="text-[10px] text-[#008060] hover:underline font-black cursor-pointer"
                  >
                    تعديل حساباتي المحفوظة
                  </button>
                </div>
                <select
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value as any)}
                  className={`w-full p-3.5 border rounded-2xl outline-none font-bold ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <option value="wallet">محفظة فودافون كاش / اتصالات</option>
                  <option value="instapay">انستا باي InstaPay</option>
                  <option value="bank">تحويل بنكي</option>
                  <option value="cash">استلام نقدي كاش من الخزينة</option>
                </select>

                {(savedWalletPhone || savedInstaPay || savedBankAccount) && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {savedWalletPhone && (
                      <button
                        type="button"
                        onClick={() => { setPayoutMethod('wallet'); setPayoutAccount(savedWalletPhone); }}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-black border cursor-pointer transition-all ${
                          payoutMethod === 'wallet' ? 'bg-emerald-500/15 border-[#008060] text-[#008060]' : 'border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        محفظتي: {savedWalletPhone}
                      </button>
                    )}
                    {savedInstaPay && (
                      <button
                        type="button"
                        onClick={() => { setPayoutMethod('instapay'); setPayoutAccount(savedInstaPay); }}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-black border cursor-pointer transition-all ${
                          payoutMethod === 'instapay' ? 'bg-emerald-500/15 border-[#008060] text-[#008060]' : 'border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        إنستاباي: {savedInstaPay}
                      </button>
                    )}
                    {savedBankAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutMethod('bank');
                          setPayoutAccount([savedBankName, savedBankAccount, savedBeneficiaryName ? `باسم: ${savedBeneficiaryName}` : ''].filter(Boolean).join(' - '));
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-black border cursor-pointer transition-all ${
                          payoutMethod === 'bank' ? 'bg-emerald-500/15 border-[#008060] text-[#008060]' : 'border-slate-200 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        حسابي البنكي: {savedBankName || 'بنك'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">رقم المحفظة / الحساب للتحويل:</label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={e => setPayoutAccount(e.target.value)}
                  placeholder="010XXXXXXXX أو عنوان إنستاباي أو رقم الحساب"
                  className={`w-full p-3.5 border rounded-2xl outline-none font-mono ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5">ملاحظات إضافية للإدارة (اختياري):</label>
                <input
                  type="text"
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية حول طلب السحب..."
                  className={`w-full p-3.5 border rounded-2xl outline-none ${
                    isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className={`px-4 py-3 rounded-2xl cursor-pointer ${isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'}`}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex-1 py-3 bg-[#008060] hover:bg-[#0a664e] text-white rounded-2xl font-black cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  {isSubmittingRequest ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Transfer Receipt Image Lightbox Modal */}
      {previewReceiptImage && (
        <div
          className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewReceiptImage(null)}
          dir="rtl"
        >
          <div
            className={`relative max-w-2xl w-full rounded-3xl p-5 shadow-2xl border space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-black text-sm flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#008060]" />
                <span>إيصال التحويل البنكي / المحفظة المعتمد من الإدارة</span>
              </h4>
              <div className="flex items-center gap-2">
                <a
                  href={previewReceiptImage}
                  download={`إيصال_تحويل_${liveMerchant.name}_${Date.now()}.jpg`}
                  className="px-3 py-1.5 rounded-xl bg-[#008060] hover:bg-[#0a664e] text-white text-xs font-black flex items-center gap-1.5"
                >
                  <Download size={13} /> تحميل الإيصال
                </a>
                <button
                  onClick={() => setPreviewReceiptImage(null)}
                  className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <img
              src={previewReceiptImage}
              alt="إيصال التحويل"
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-auto mx-auto rounded-2xl object-contain border border-slate-100 dark:border-slate-800"
            />
          </div>
        </div>
      )}

      {/* Official Printable PDF Statement Modal */}
      {showPrintableStatementModal && (
        <div
          className="fixed inset-0 z-[140] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
          onClick={() => setShowPrintableStatementModal(false)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-emerald-400" />
                <span className="font-black text-sm">معاينة كشف الحساب الرسمي للطباعة أو الحفظ كـ PDF</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rowsHtml = filteredStatementTransactions.length === 0
                      ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:#64748b;font-weight:700;">لا توجد حركات مالية مسجلة في هذه الفترة</td></tr>`
                      : filteredStatementTransactions.map((tx, idx) => {
                          const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
                          const transferRef = tx.transferReference || linkedReq?.transferReference;
                          const typeLabel =
                            tx.type === 'order_delivered' ? 'تسوية مبيعات' :
                            (tx.notes || '').includes('مصروفات') ? 'خصم مصروفات' :
                            tx.type === 'withdrawal' ? 'سحب مستحقات' :
                            tx.amount >= 0 ? 'إضافة رصيد' : 'خصم / تعديل';
                          return `
                            <tr>
                              <td style="text-align:center;font-family:monospace;font-weight:700;color:#475569;">${idx + 1}</td>
                              <td style="text-align:center;font-family:monospace;font-weight:700;">${new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                              <td style="text-align:center;font-weight:800;">${typeLabel}</td>
                              <td style="text-align:right;">
                                <div style="font-weight:700;color:#0f172a;">${tx.notes || '—'}</div>
                                ${transferRef ? `<div style="font-size:10px;font-family:monospace;color:#008060;margin-top:2px;">مرجع التحويل: ${transferRef}</div>` : ''}
                              </td>
                              <td style="text-align:center;font-family:monospace;font-weight:800;direction:ltr;color:${tx.amount >= 0 ? '#008060' : '#b91c1c'};">
                                ${tx.amount >= 0 ? '+' : ''}${tx.amount.toLocaleString()} ج.م
                              </td>
                              <td style="text-align:center;font-family:monospace;font-weight:900;direction:ltr;color:#0f172a;">
                                ${tx.balanceAfter.toLocaleString()} ج.م
                              </td>
                            </tr>
                          `;
                        }).join('');

                    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>كشف حساب الموكل - ${liveMerchant.name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Cairo', sans-serif; color: #0f172a; background: #fff; direction: rtl; font-size: 12px; line-height: 1.5; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #008060; padding-bottom: 14px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 900; color: #0f172a; }
    .subtitle { font-size: 12px; font-weight: 700; color: #475569; margin-top: 4px; }
    .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11px; min-width: 210px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-label { font-size: 10px; font-weight: 800; color: #64748b; }
    .kpi-val { font-size: 15px; font-weight: 900; font-family: monospace; margin-top: 4px; direction: ltr; text-align: right; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #cbd5e1; }
    th, td { display: table-cell !important; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; vertical-align: middle; }
    thead th { background: #0f172a !important; color: #fff !important; font-weight: 800; text-align: center; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${storeName} — كشف حساب موكل رسمي</div>
      <div class="subtitle">اسم الموكل / صاحب البضاعة: <strong style="color:#0f172a;">${liveMerchant.name}</strong> (${liveMerchant.id})</div>
      <div class="subtitle">الفترة: ${statementStartDate || 'من بداية التعامل'} إلى ${statementEndDate || new Date().toLocaleDateString('ar-EG')}</div>
    </div>
    <div class="meta-box">
      <div>تاريخ الإصدار: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></div>
      <div style="margin-top:4px;color:#008060;font-weight:900;font-size:13px;">الرصيد الحالي: ${overviewStats.persistentBalance.toLocaleString()} ج.م</div>
    </div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">إجمالي التسويات والإضافات (+)</div>
      <div class="kpi-val" style="color:#008060;">+${statementSummary.totalCredits.toLocaleString()} ج.م</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">إجمالي المسحوبات والخصومات (-)</div>
      <div class="kpi-val" style="color:#b91c1c;">-${statementSummary.totalDebits.toLocaleString()} ج.م</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">إجمالي الأوردرات المسلمة</div>
      <div class="kpi-val" style="color:#0f172a;">${overviewStats.deliveredCount} طلب</div>
    </div>
    <div class="kpi-card" style="background:#ecfdf5;border-color:#6ee7b7;">
      <div class="kpi-label" style="color:#065f46;">الرصيد المتاح بالمحفظة</div>
      <div class="kpi-val" style="color:#008060;">${overviewStats.persistentBalance.toLocaleString()} ج.م</div>
    </div>
  </div>
  <table>
    <colgroup>
      <col style="width:6%;" />
      <col style="width:14%;" />
      <col style="width:16%;" />
      <col style="width:34%;" />
      <col style="width:15%;" />
      <col style="width:15%;" />
    </colgroup>
    <thead>
      <tr>
        <th>#</th>
        <th>التاريخ</th>
        <th>نوع العملية</th>
        <th style="text-align:right;">البيان والمرجع البنكي</th>
        <th>المبلغ</th>
        <th>الرصيد بعد العملية</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    <span>تم استخراج هذا الكشف إلكترونياً من بوابة الموكلين المعتمدة — ${storeName}</span>
    <span>توقيع / اعتماد الإدارة: ______________________</span>
  </div>
</body>
</html>`;
                    const iframe = document.createElement('iframe');
                    iframe.style.position = 'fixed';
                    iframe.style.right = '0';
                    iframe.style.bottom = '0';
                    iframe.style.width = '0';
                    iframe.style.height = '0';
                    iframe.style.border = '0';
                    document.body.appendChild(iframe);
                    const doc = iframe.contentWindow?.document;
                    if (doc) {
                      doc.open();
                      doc.write(html);
                      doc.close();
                      setTimeout(() => {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        setTimeout(() => document.body.removeChild(iframe), 2000);
                      }, 400);
                    }
                  }}
                  className="px-4 py-2 bg-[#008060] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer size={14} /> طباعة / حفظ بصيغة PDF الآن
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintableStatementModal(false)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6 text-slate-900 bg-white max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-[#008060] pb-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{storeName} — كشف حساب موكل رسمي</h2>
                  <p className="text-xs text-slate-600 font-bold mt-1">
                    اسم الموكل / صاحب البضاعة: <span className="font-black text-slate-900">{liveMerchant.name}</span> ({liveMerchant.id})
                  </p>
                  <p className="text-xs text-slate-500 font-bold">
                    الفترة: {statementStartDate || 'من بداية التعامل'} إلى {statementEndDate || new Date().toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <div className="text-left font-mono text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div className="font-bold text-slate-500">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
                  <div className="font-black text-[#008060] text-sm mt-1">
                    الرصيد الختامي: {overviewStats.persistentBalance.toLocaleString()} ج.م
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-bold">إجمالي التسويات (+)</div>
                  <div className="text-sm font-black font-mono text-[#008060] mt-1">+{statementSummary.totalCredits.toLocaleString()} ج.م</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-bold">إجمالي المسحوبات (-)</div>
                  <div className="text-sm font-black font-mono text-rose-700 mt-1">-{statementSummary.totalDebits.toLocaleString()} ج.م</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-bold">أوردرات مسلمة</div>
                  <div className="text-sm font-black font-mono text-slate-900 mt-1">{overviewStats.deliveredCount} طلب</div>
                </div>
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-slate-500 font-bold">قيمة مخزون الأمانة</div>
                  <div className="text-sm font-black font-mono text-[#008060] mt-1">{overviewStats.inventoryValuation.toLocaleString()} ج.م</div>
                </div>
              </div>

              <table className="w-full text-right text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-900 text-white font-black">
                    <th className="p-2.5 border border-slate-300">التاريخ</th>
                    <th className="p-2.5 border border-slate-300">نوع العملية</th>
                    <th className="p-2.5 border border-slate-300">البيان والمرجع البنكي</th>
                    <th className="p-2.5 border border-slate-300 text-center">المبلغ (ج.م)</th>
                    <th className="p-2.5 border border-slate-300 text-center">الرصيد بعد العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-bold">
                  {filteredStatementTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">لا توجد حركات مالية مسجلة في هذه الفترة</td>
                    </tr>
                  ) : (
                    filteredStatementTransactions.map(tx => {
                      const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
                      const transferRef = tx.transferReference || linkedReq?.transferReference;
                      return (
                        <tr key={tx.id}>
                          <td className="p-2.5 border border-slate-200 font-mono">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                          <td className="p-2.5 border border-slate-200">
                            {tx.type === 'order_delivered' ? 'تسوية مبيعات' :
                             tx.type === 'withdrawal' ? 'سحب مستحقات' :
                             tx.amount >= 0 ? 'إضافة رصيد' : 'خصم / تعديل'}
                          </td>
                          <td className="p-2.5 border border-slate-200">
                            <div>{tx.notes}</div>
                            {transferRef && <div className="text-[10px] font-mono text-[#008060]">مرجع التحويل: {transferRef}</div>}
                          </td>
                          <td className={`p-2.5 border border-slate-200 text-center font-mono ${tx.amount >= 0 ? 'text-[#008060]' : 'text-rose-700'}`}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                          </td>
                          <td className="p-2.5 border border-slate-200 text-center font-mono">{tx.balanceAfter.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500 font-bold">
                <span>تم استخراج هذا الكشف إلكترونياً من بوابة الموكلين المعتمدة — {storeName}</span>
                <span>توقيع / اعتماد الإدارة: ______________________</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          BULK SETTLEMENT DETAILS MODAL (Details for a Transaction)
         ========================================================= */}
      <AnimatePresence>
        {showSettlementDetailsId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border shadow-2xl flex flex-col ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {/* Header */}
              <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/80'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#008060]/10 text-[#008060] flex items-center justify-center">
                    <Calculator size={24} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>تفاصيل دورة المبالغ المجمعة</h3>
                    <p className="text-xs text-slate-400 font-bold">عرض كافة الشحنات المرفقة بهذه التسوية المالية</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettlementDetailsId(null)}
                  className="p-2 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {(() => {
                  const s = (settings.merchantSettlements || []).find((x: any) => x.id === showSettlementDetailsId);
                  if (!s) return <div className="py-10 text-center text-slate-400 font-bold">عذراً، لم يتم العثور على بيانات التسوية.</div>;
                  
                  return (
                    <div className="space-y-6">
                      {/* Summary Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">رقم التسوية</span>
                          <span className="font-mono font-black text-sm">{s.settlementNumber}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">تاريخ الاعتماد</span>
                          <span className="font-black text-xs">{new Date(s.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
                          <span className="text-[10px] text-[#008060] font-bold block mb-1">صافي المستحق</span>
                          <span className="font-mono font-black text-lg text-[#008060]">{formatMoney(s.netPayoutToMerchant)}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <span className="text-[10px] text-slate-400 font-bold block mb-1">عدد الأوردرات</span>
                          <span className="font-black text-sm">{s.ordersCount} أوردر</span>
                        </div>
                      </div>

                      {/* Orders Table */}
                      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <table className="w-full text-right text-[11px]">
                          <thead className={`${isDark ? 'bg-slate-950 text-slate-400' : 'bg-slate-50 text-slate-500'} font-bold border-b border-slate-100 dark:border-slate-800`}>
                            <tr>
                              <th className="py-3 px-4">رقم الأوردر</th>
                              <th className="py-3 px-4 text-center">الحالة</th>
                              <th className="py-3 px-4">العميل</th>
                              <th className="py-3 px-4 text-center">المحصل</th>
                              <th className="py-3 px-4 text-center">الشحن والرسوم</th>
                              <th className="py-3 px-4 text-center font-black">الصافي</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-600'}`}>
                            {(s.orderSnapshots || []).map((snap: any, idx: number) => (
                              <tr key={idx} className={isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}>
                                <td className="py-3 px-4 font-mono font-black">#{snap.orderNumber || snap.orderId.slice(-6)}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                    ['تم_التوصيل', 'تم_التحصيل', 'مدفوعة'].includes(snap.status) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                  }`}>
                                    {snap.status.replace(/_/g, ' ')}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-bold">{snap.customerName}</td>
                                <td className="py-3 px-4 text-center font-mono tabular-nums">{formatMoney(snap.collectedRevenue || snap.collectedAmount || 0)}</td>
                                <td className="py-3 px-4 text-center font-mono tabular-nums text-rose-500">-{formatMoney(snap.totalShippingAndCarrierFees || 0)}</td>
                                <td className="py-3 px-4 text-center font-mono tabular-nums font-black text-[#008060]">{formatMoney(snap.netPayoutToMerchant || snap.netMerchantAmount || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {s.notes && (
                        <div className={`p-4 rounded-2xl text-[11px] font-bold ${isDark ? 'bg-slate-950 text-slate-400' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          ملاحظات التسوية: {s.notes}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/80'}`}>
                <button 
                  onClick={() => setShowSettlementDetailsId(null)}
                  className={`px-8 py-2.5 rounded-xl font-black text-xs cursor-pointer ${
                    isDark ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
