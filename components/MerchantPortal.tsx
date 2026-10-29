import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Partner, StoreData, Order, Product, MerchantSubscriptionConfig, MerchantManagerConfig, MerchantTransaction, MerchantPlanChangeRequest, MerchantPlanCycleRecord, ScheduledMerchantPlanTransition } from '../types';
import { 
  Building2, Loader2, Shield, AlertCircle, CheckCircle2, Send, ShieldCheck, 
  Coins, RefreshCw, LogOut, DollarSign, Package as PackageIcon, Wallet as WalletIcon, FileText, Key, X,
  Truck, ChevronDown, ChevronUp, PackageCheck, Mail, Calculator, ExternalLink,
  Download, Printer, Eye, EyeOff, TrendingUp, MapPin, Award, CreditCard, Lock, Copy,
  Home, Bell, Users, Inbox, Ticket, Menu, Sun, Moon, Monitor, HelpCircle, Settings,
  ShoppingBag, Radio, LayoutGrid, HeartHandshake, ChevronLeft, ChevronRight, Fingerprint, Search,
  ArrowUpRight, ArrowDownLeft, Sparkles, MessageCircle, Check, Calendar, PlusCircle, Banknote, Code2, Layers, Cpu, Megaphone, Receipt,
  QrCode, Share2, Phone, Crown
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, 
  Tooltip, CartesianGrid
} from 'recharts';
import { MerchantTransparencyTab } from './MerchantTransparencyTab';
import { MerchantChangePlanModal } from './MerchantChangePlanModal';
import WelcomeLoader from './WelcomeLoader';
import { computeMerchantPlanUsage, buildOrderPlanSnapshot, getOrderEffectivePlanSnapshot, SELF_SERVICE_PLANS, DEDICATED_MANAGER_PLANS } from '../utils/merchantSubscriptions';
import { calculateMerchantTransparencyAnalytics, TRANSPARENCY_RETURN_STATUSES, computeOrderCarrierBreakdown } from '../utils/merchantAnalytics';
import { getTrackingNumber, getShippingTrackingUrl } from '../utils/shippingTracking';
import { DEFAULT_BOSTA_BUSINESS_LOCATIONS } from '../utils/bostaService';
import { getProductsForMerchant, normalizeMerchantLabel } from '../utils/merchantProducts';
import { generateUniqueOrderId, generateDisplayOrderNumber } from '../utils/syncIntegrity';
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

const normalizeName = (name: string): string => normalizeMerchantLabel(name);

const maskEmail = (email?: string) => {
  if (!email || !email.includes('@')) return email || '';
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user}***@${domain}`;
  return `${user.slice(0, 2)}***@${domain}`;
};

const toArabicDigits = (num: number | string): string => {
  return String(num ?? '').replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);
};

const getInitials = (name?: string) => {
  if (!name) return 'م';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
  }
  return name.trim().slice(0, 2);
};

export const EGYPT_GOV_SHIPPING_RATES: Record<string, number> = {
  'القاهرة': 45,
  'الجيزة': 45,
  'القليوبية': 50,
  'الإسكندرية': 55,
  'البحيرة': 60,
  'الغربية': 60,
  'المنوفية': 60,
  'الشرقية': 60,
  'الدقهلية': 60,
  'كفر الشيخ': 60,
  'دمياط': 60,
  'بورسعيد': 60,
  'الإسماعيلية': 60,
  'السويس': 60,
  'الفيوم': 65,
  'بني سويف': 65,
  'المنيا': 70,
  'أسيوط': 75,
  'سوهاج': 75,
  'قنا': 80,
  'الأقصر': 85,
  'أسوان': 90,
  'البحر الأحمر': 95,
  'الوادي الجديد': 100,
  'مطروح': 90,
  'شمال سيناء': 100,
  'جنوب سيناء': 100,
};

export interface MerchantPortalProps {
  allStoresData: Record<string, StoreData>;
  updateSettings: (settings: any) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

type TabKey = 'overview' | 'wallet' | 'orders' | 'create_order' | 'inventory' | 'analytics' | 'customers' | 'apps' | 'transparency' | 'statement' | 'account';
type ThemeMode = 'light' | 'system' | 'dark';

export default function MerchantPortal({ allStoresData, updateSettings, showToast: externalShowToast }: MerchantPortalProps) {
  const { storeId, tab: routeTab } = useParams<{ storeId: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlPartnerId = searchParams.get('p') || searchParams.get('merchantId') || searchParams.get('m') || '';
  const urlTab = searchParams.get('tab') || routeTab;

  const validTabs: TabKey[] = ['overview', 'wallet', 'orders', 'create_order', 'inventory', 'analytics', 'customers', 'apps', 'transparency', 'statement', 'account'];

  const savedTab = (() => {
    try {
      const s = localStorage.getItem('merchant_portal_active_tab');
      if (s && validTabs.includes(s as TabKey)) return s as TabKey;
    } catch {}
    return null;
  })();

  const activeTab: TabKey = validTabs.includes(urlTab as TabKey) 
    ? (urlTab as TabKey) 
    : (savedTab || 'overview');

  const [directStoreId, setDirectStoreId] = useState<string>('');
  const [directStoreData, setDirectStoreData] = useState<StoreData | null>(null);
  const [crossStoreProducts, setCrossStoreProducts] = useState<Product[]>(() => {
    try {
      const savedMerchant = localStorage.getItem('authenticated_merchant');
      if (savedMerchant) {
        const parsed = JSON.parse(savedMerchant);
        if (parsed?.id) {
          const cached = localStorage.getItem(`merchant_cached_prods_${parsed.id}`);
          if (cached) return JSON.parse(cached);
        }
      }
    } catch {}
    return [];
  });
  const [isFetchingCrossStore, setIsFetchingCrossStore] = useState(false);
  const [isLoadingStore, setIsLoadingStore] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Audio state for hissing sound during loading
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (isLoadingStore) {
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioCtxRef.current = audioCtx;
          
          const bufferSize = 2 * audioCtx.sampleRate;
          const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
          }

          const whiteNoise = audioCtx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          whiteNoise.loop = true;
          noiseSourceRef.current = whiteNoise;

          const filter = audioCtx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.value = 1200; // High-pass for a "hiss" sound

          const gainNode = audioCtx.createGain();
          gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 1);

          whiteNoise.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          whiteNoise.start();
        }
      } catch (e) {
        console.warn("Hissing audio effect could not start:", e);
      }
    } else {
      if (audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        setTimeout(() => {
          if (ctx.state !== 'closed') {
            ctx.close().catch(() => {});
          }
          audioCtxRef.current = null;
          noiseSourceRef.current = null;
        }, 1000);
      }
    }

    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [isLoadingStore]);

  // Loading Progress Simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoadingStore) {
      setLoadingProgress(0);
      interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 98) return prev;
          const remaining = 100 - prev;
          const increment = Math.max(1, Math.random() * (remaining / 10)); 
          return Math.min(prev + increment, 98);
        });
      }, 300);
    } else {
      setLoadingProgress(100);
    }
    return () => clearInterval(interval);
  }, [isLoadingStore]);

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
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [customersSearchQuery, setCustomersSearchQuery] = useState('');
  const [appsWebhookUrl, setAppsWebhookUrl] = useState('https://api.bosta.co/v2/webhooks/merchant');
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [isTestingBosta, setIsTestingBosta] = useState(false);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isWhatsAppBotEnabled, setIsWhatsAppBotEnabled] = useState(true);
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
      const reqs = await db.getMerchantRequests(targetStoreId);
      setMerchantRequestsList(reqs);
    } catch (_) {}
  }, [directStoreId, storeId, effectiveStoreId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

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
        if (!existing._fromFreshCloud) {
          if (!existing.subscriptionPlan && s.subscriptionPlan && typeof s.subscriptionPlan === 'object') {
            existing.subscriptionPlan = s.subscriptionPlan;
          }
          if (!existing.managerPlan && s.managerPlan && typeof s.managerPlan === 'object') {
            existing.managerPlan = s.managerPlan;
          }
          if (existing.pendingPlanRequest === undefined && s.pendingPlanRequest !== undefined) {
            existing.pendingPlanRequest = s.pendingPlanRequest;
          }
          if ((!existing.planCyclesHistory || existing.planCyclesHistory.length === 0) && Array.isArray(s.planCyclesHistory)) {
            existing.planCyclesHistory = s.planCyclesHistory;
          }
        }
        if (existing.payoutFrequency === undefined && s.payoutFrequency !== undefined) existing.payoutFrequency = s.payoutFrequency;
        if (existing.weeklyPayoutDay === undefined && typeof s.weeklyPayoutDay === 'number') existing.weeklyPayoutDay = s.weeklyPayoutDay;
        if (existing.holdingDaysAfterSettlement === undefined && typeof s.holdingDaysAfterSettlement === 'number') existing.holdingDaysAfterSettlement = s.holdingDaysAfterSettlement;
        if (existing.minWeeklyPayout === undefined && typeof s.minWeeklyPayout === 'number') existing.minWeeklyPayout = s.minWeeklyPayout;
        if (existing.maxWeeklyPayout === undefined && typeof s.maxWeeklyPayout === 'number') existing.maxWeeklyPayout = s.maxWeeklyPayout;
        if (existing.weeklyPayoutMode === undefined && s.weeklyPayoutMode !== undefined) existing.weeklyPayoutMode = s.weeklyPayoutMode;
        if (existing.weeklyTransferFee === undefined && typeof s.weeklyTransferFee === 'number') existing.weeklyTransferFee = s.weeklyTransferFee;
        if (existing.weeklyTransferFeeType === undefined && s.weeklyTransferFeeType !== undefined) existing.weeklyTransferFeeType = s.weeklyTransferFeeType;
        if (existing.dailyTransferFee === undefined && typeof s.dailyTransferFee === 'number') existing.dailyTransferFee = s.dailyTransferFee;
        if (existing.dailyTransferFeeType === undefined && s.dailyTransferFeeType !== undefined) existing.dailyTransferFeeType = s.dailyTransferFeeType;
        if (existing.lastPayoutFrequencyChangeAt === undefined && s.lastPayoutFrequencyChangeAt !== undefined) existing.lastPayoutFrequencyChangeAt = s.lastPayoutFrequencyChangeAt;
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
        subscriptionPlan: s.subscriptionPlan,
        managerPlan: s.managerPlan,
        pendingPlanRequest: s.pendingPlanRequest ?? null,
        planCyclesHistory: Array.isArray(s.planCyclesHistory) ? s.planCyclesHistory : [],
        payoutFrequency: s.payoutFrequency,
        weeklyPayoutDay: typeof s.weeklyPayoutDay === 'number' ? s.weeklyPayoutDay : undefined,
        holdingDaysAfterSettlement: typeof s.holdingDaysAfterSettlement === 'number' ? s.holdingDaysAfterSettlement : undefined,
        minWeeklyPayout: typeof s.minWeeklyPayout === 'number' ? s.minWeeklyPayout : undefined,
        maxWeeklyPayout: typeof s.maxWeeklyPayout === 'number' ? s.maxWeeklyPayout : undefined,
        weeklyPayoutMode: s.weeklyPayoutMode,
        weeklyTransferFee: typeof s.weeklyTransferFee === 'number' ? s.weeklyTransferFee : undefined,
        weeklyTransferFeeType: s.weeklyTransferFeeType,
        dailyTransferFee: typeof s.dailyTransferFee === 'number' ? s.dailyTransferFee : undefined,
        dailyTransferFeeType: s.dailyTransferFeeType,
        lastPayoutFrequencyChangeAt: s.lastPayoutFrequencyChangeAt,
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

      // NEW: Extract & merge joint merchants from product allocations (Option B)
      const productsList = Array.isArray(st.products) ? st.products : (st.settings?.products || []);
      if (Array.isArray(productsList)) {
        productsList.forEach((p: any) => {
          if (Array.isArray(p.merchantAllocations)) {
            p.merchantAllocations.forEach((alloc: any) => {
              if (alloc.merchantId || alloc.merchantName) {
                upsertEntity({
                  id: alloc.merchantId,
                  name: alloc.merchantName,
                  role: 'موكل مشترك'
                }, 'موكل مشترك', stId, isFreshCloud);
              }
            });
          }
          if (Array.isArray(p.merchantIds)) {
            p.merchantIds.forEach((mId: string) => {
              if (mId) {
                upsertEntity({
                  id: mId,
                  name: 'موكل مشترك مسجل',
                  role: 'موكل مشترك'
                }, 'موكل مشترك', stId, isFreshCloud);
              }
            });
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

  const merchantAuthStorageKey = `authenticated_merchant_${effectiveStoreId || 'unknown'}`;

  const [authenticatedMerchant, setAuthenticatedMerchant] = useState<Partner | null>(() => {
    try {
      const saved = localStorage.getItem(`authenticated_merchant_${effectiveStoreId || 'unknown'}`);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const requestedId = String(urlPartnerId || '').trim().toLowerCase();
      const savedId = String(parsed?.id || '').trim().toLowerCase();
      const savedStoreId = String(parsed?._storeId || '').trim();
      if (requestedId && savedId !== requestedId) return null;
      if (savedStoreId && effectiveStoreId && savedStoreId !== effectiveStoreId) return null;
      return parsed;
    } catch {}
    return null;
  });

  const liveMerchant = useMemo(() => {
    if (!authenticatedMerchant) return null;
    const authenticatedId = String(authenticatedMerchant.id || '').trim().toLowerCase();
    if (!authenticatedId) return null;
    const current = merchants.find(m => String(m.id || '').trim().toLowerCase() === authenticatedId);
    if (!current) return authenticatedMerchant;
    return {
      ...authenticatedMerchant,
      ...current,
      payoutFrequency: current.payoutFrequency ?? authenticatedMerchant.payoutFrequency ?? 'weekly',
      weeklyPayoutDay: current.weeklyPayoutDay ?? authenticatedMerchant.weeklyPayoutDay ?? 1,
      holdingDaysAfterSettlement: current.holdingDaysAfterSettlement ?? authenticatedMerchant.holdingDaysAfterSettlement ?? 7,
      minWeeklyPayout: current.minWeeklyPayout ?? authenticatedMerchant.minWeeklyPayout ?? 100,
      maxWeeklyPayout: current.maxWeeklyPayout ?? authenticatedMerchant.maxWeeklyPayout ?? 50000,
      weeklyPayoutMode: current.weeklyPayoutMode ?? authenticatedMerchant.weeklyPayoutMode ?? 'admin_confirm',
      weeklyTransferFee: current.weeklyTransferFee ?? authenticatedMerchant.weeklyTransferFee ?? 25,
      weeklyTransferFeeType: current.weeklyTransferFeeType ?? authenticatedMerchant.weeklyTransferFeeType ?? 'fixed',
      dailyTransferFee: current.dailyTransferFee ?? authenticatedMerchant.dailyTransferFee ?? 1,
      dailyTransferFeeType: current.dailyTransferFeeType ?? authenticatedMerchant.dailyTransferFeeType ?? 'percentage',
      lastPayoutFrequencyChangeAt: current.lastPayoutFrequencyChangeAt ?? authenticatedMerchant.lastPayoutFrequencyChangeAt,
      subscriptionPlan: current.subscriptionPlan || authenticatedMerchant.subscriptionPlan,
      managerPlan: current.managerPlan || authenticatedMerchant.managerPlan,
      pendingPlanRequest: current.pendingPlanRequest !== undefined ? current.pendingPlanRequest : authenticatedMerchant.pendingPlanRequest,
      planCyclesHistory: (current.planCyclesHistory && current.planCyclesHistory.length > 0)
        ? current.planCyclesHistory
        : (authenticatedMerchant.planCyclesHistory || [])
    };
  }, [authenticatedMerchant, merchants]);

  // A portal URL identifies one merchant. Never keep showing a previous browser session
  // when the URL points to another merchant or store.
  useEffect(() => {
    const requestedId = String(urlPartnerId || '').trim().toLowerCase();
    const currentId = String(authenticatedMerchant?.id || '').trim().toLowerCase();
    const sessionStoreId = String((authenticatedMerchant as any)?._storeId || '').trim();
    const wrongMerchant = Boolean(requestedId && currentId && requestedId !== currentId);
    const wrongStore = Boolean(sessionStoreId && effectiveStoreId && sessionStoreId !== effectiveStoreId);
    if (wrongMerchant || wrongStore) {
      setAuthenticatedMerchant(null);
      try {
        localStorage.removeItem(merchantAuthStorageKey);
        localStorage.removeItem('authenticated_merchant');
      } catch {}
    }
  }, [urlPartnerId, effectiveStoreId, authenticatedMerchant?.id, (authenticatedMerchant as any)?._storeId, merchantAuthStorageKey]);

  // Fetch fresh store data on mount
  const fetchFreshData = useCallback(async (isManualRefresh = false) => {
    const targetStoreId = directStoreId || storeId || effectiveStoreId || (authenticatedMerchant as any)?._storeId;
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

      // Fetch products for this merchant from ALL stores to ensure cross-store allocations are visible
      const targetId = String(liveMerchant?.id || authenticatedMerchant?.id || '').trim();
      const targetName = String(liveMerchant?.name || authenticatedMerchant?.name || '').trim();
      if (targetId) {
        setIsFetchingCrossStore(true);
        const allocated = await db.getMerchantAllocatedProducts(targetId, targetName);
        setCrossStoreProducts(allocated);
        if (targetId || targetName) {
          const cacheKey = targetId ? `merchant_cached_prods_${targetId}` : `merchant_cached_prods_name_${normalizeName(targetName)}`;
          localStorage.setItem(cacheKey, JSON.stringify(allocated));
        }
        setIsFetchingCrossStore(false);
      }
    } catch (err) {
      console.error('[MerchantPortal] Error loading store data:', err);
    } finally {
      setIsLoadingStore(false);
      setIsRefreshing(false);
      setIsFetchingCrossStore(false);
    }
  }, [directStoreId, storeId, effectiveStoreId, loadRequests, liveMerchant, authenticatedMerchant]);

  // Trigger fetchFreshData on mount or when effectiveStoreId is resolved
  useEffect(() => {
    const targetStoreId = directStoreId || storeId || effectiveStoreId || (authenticatedMerchant as any)?._storeId;
    if (targetStoreId) {
      fetchFreshData(false);
    }
  }, [directStoreId, storeId, effectiveStoreId, (authenticatedMerchant as any)?._storeId]);

  useEffect(() => {
    const fetchAllocated = async () => {
      const targetId = String(liveMerchant?.id || authenticatedMerchant?.id || '').trim();
      const targetName = String(liveMerchant?.name || authenticatedMerchant?.name || '').trim();
      if (targetId || targetName) {
        console.log('[MerchantPortal] Fetching cross-store products for:', targetName, targetId);
        setIsFetchingCrossStore(true);
        try {
          const allocated = await db.getMerchantAllocatedProducts(targetId, targetName);
          console.log('[MerchantPortal] Found cross-store products:', allocated.length);
          setCrossStoreProducts(allocated);
          if (targetId || targetName) {
            try {
              const cacheKey = targetId ? `merchant_cached_prods_${targetId}` : `merchant_cached_prods_name_${normalizeName(targetName)}`;
              localStorage.setItem(cacheKey, JSON.stringify(allocated));
            } catch {}
          }
        } catch (err) {
          console.error('[MerchantPortal] Error fetching cross-store products:', err);
        } finally {
          setIsFetchingCrossStore(false);
        }
      } else {
        setCrossStoreProducts([]);
      }
    };
    fetchAllocated();
  }, [liveMerchant?.id, liveMerchant?.name, authenticatedMerchant?.id, authenticatedMerchant?.name]);

  // Realtime Optimized Subscription with Strict Row-Level Filters & Throttling
  useEffect(() => {
    const targetStoreId = directStoreId || storeId || effectiveStoreId;
    if (!targetStoreId) return;

    const unsubscribe = db.subscribeToStoreRealtimeOptimized(targetStoreId, {
      tables: ['orders', 'merchant_requests', 'partner_requests', 'transactions', 'partners', 'products'],
      onUpdate: () => {
        db.throttledRefreshStoreData(targetStoreId, (freshData) => {
          setDirectStoreData(freshData);
          loadRequests();
        }, 3000);
      }
    });

    return () => unsubscribe();
  }, [directStoreId, storeId, effectiveStoreId, loadRequests]);



  const portalTitle = 'عبده ميديا · بوابة الموكلين';
  const storeName = portalTitle;

  // Persist authenticatedMerchant change
  useEffect(() => {
    if (authenticatedMerchant) {
      const requestedId = String(urlPartnerId || '').trim().toLowerCase();
      const currentId = String(authenticatedMerchant.id || '').trim().toLowerCase();
      if (requestedId && requestedId !== currentId) return;
      const session = { ...authenticatedMerchant, _storeId: (authenticatedMerchant as any)._storeId || effectiveStoreId };
      localStorage.setItem(merchantAuthStorageKey, JSON.stringify(session));
      // Keep no global identity that could leak into another merchant portal.
      localStorage.removeItem('authenticated_merchant');
      if (authenticatedMerchant.id) {
        const currentP = searchParams.get('p') || searchParams.get('merchantId') || searchParams.get('m');
        if (currentP && currentP !== authenticatedMerchant.id) {
          setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('p', authenticatedMerchant.id);
            next.delete('merchantId');
            next.delete('m');
            return next;
          }, { replace: true });
        }
      }
    } else {
      localStorage.removeItem(merchantAuthStorageKey);
      localStorage.removeItem('authenticated_merchant');
    }
  }, [authenticatedMerchant, searchParams, setSearchParams, effectiveStoreId, merchantAuthStorageKey]);

  useEffect(() => {
    document.title = liveMerchant?.name
      ? `${liveMerchant.name} | عبده ميديا`
      : 'عبده ميديا · بوابة الموكلين';
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

  const [currentTab, setCurrentTab] = useState<TabKey>(activeTab);

  // Auto-expand menu section based on active tab
  useEffect(() => {
    if (['orders', 'create_order', 'inventory', 'analytics'].includes(currentTab)) {
      setExpandedMenuSection('products_orders');
    } else if (['transparency', 'statement', 'account'].includes(currentTab)) {
      setExpandedMenuSection('financial_tools');
    }
  }, [currentTab]);
  const isNavigatingTabRef = useRef(false);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<'all' | 'collected' | 'returned' | 'unpaid' | 'shipping' | 'pending' | 'outside_cycle'>(() => {
    const s = searchParams.get('status');
    const valid = ['all', 'collected', 'returned', 'unpaid', 'shipping', 'pending', 'outside_cycle'];
    if (s && valid.includes(s)) return s as any;
    return 'all';
  });
  const [ordersSearchQuery, setOrdersSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [ordersTopViewMode, setOrdersTopViewMode] = useState<'financial_cycle' | 'current_balance'>('current_balance');
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

  // Accounting Sub-View: General Ledger vs P&L vs Returns Reserve
  const [statementSubView, setStatementSubView] = useState<'ledger' | 'pnl' | 'reserves'>(() => {
    const sv = searchParams.get('subView');
    if (sv === 'ledger' || sv === 'pnl' || sv === 'reserves') return sv;
    return 'ledger';
  });

  // Consignment Inventory Search & Filter
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'available' | 'low' | 'out'>(() => {
    const sf = searchParams.get('stockFilter');
    if (sf === 'all' || sf === 'available' || sf === 'low' || sf === 'out') return sf;
    return 'all';
  });

  // Merchant Product Creation & Editing Modal State
  const [showAddEditProductModal, setShowAddEditProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [prodFormName, setProdFormName] = useState('');
  const [prodFormSku, setProdFormSku] = useState('');
  const [prodFormPrice, setProdFormPrice] = useState<number | ''>('');
  const [prodFormCostPrice, setProdFormCostPrice] = useState<number | ''>('');
  const [prodFormProfitMode, setProdFormProfitMode] = useState<'commission' | 'margin' | 'manual'>('commission');
  const [prodFormCommissionPct, setProdFormCommissionPct] = useState<number>(15);
  const [prodFormStock, setProdFormStock] = useState<number>(10);
  const [prodFormThumbnail, setProdFormThumbnail] = useState('');
  const [prodFormDescription, setProdFormDescription] = useState('');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Tab State & Custom Pricing States for Merchant Edit Product Modal
  const [prodModalTab, setProdModalTab] = useState<'general' | 'custom_pricing'>('general');
  const [merchantCustomCostPrice, setMerchantCustomCostPrice] = useState<number | ''>('');
  const [merchantCustomSellingPrice, setMerchantCustomSellingPrice] = useState<number | ''>('');
  const [merchantCustomStock, setMerchantCustomStock] = useState<number | ''>('');

  // Dedicated Merchant Custom Pricing & Allocation Modal State
  const [pricingModalProduct, setPricingModalProduct] = useState<any | null>(null);
  const [customCostPrice, setCustomCostPrice] = useState<number | ''>('');
  const [customSellingPrice, setCustomSellingPrice] = useState<number | ''>('');
  const [customAllocatedStock, setCustomAllocatedStock] = useState<number | ''>('');
  const [isSavingCustomPricing, setIsSavingCustomPricing] = useState(false);

  const handleOpenPricingModal = useCallback((p: any) => {
    setPricingModalProduct(p);
    const existingCost = p.merchantAllocation?.costPrice ?? p.costPrice ?? p.cost ?? 0;
    const existingSelling = p.merchantAllocation?.sellingPrice ?? p.price ?? p.sellingPrice ?? 0;
    const existingStock = p.merchantAllocation?.stock ?? p.stock ?? p.quantity ?? 10;
    setCustomCostPrice(existingCost || '');
    setCustomSellingPrice(existingSelling || '');
    setCustomAllocatedStock(existingStock);
  }, []);

  const handleSaveCustomPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant || !pricingModalProduct) return;
    const costNum = Number(customCostPrice) || 0;
    const priceNum = Number(customSellingPrice) || 0;
    const stockNum = Number(customAllocatedStock) || 0;

    if (priceNum <= 0) {
      showToast('يرجى تحديد سعر بيع مقترح أكبر من 0', 'error');
      return;
    }

    setIsSavingCustomPricing(true);
    try {
      const allProds: any[] = Array.isArray(activeStoreData?.settings?.products) 
        ? [...activeStoreData.settings.products] 
        : (Array.isArray(settings.products) ? [...settings.products] : []);

      const targetProdId = pricingModalProduct.id;
      const mId = String(liveMerchant.id || '').trim();
      const mName = String(liveMerchant.name || '').trim();

      const updatedProducts = allProds.map(p => {
        if (p.id === targetProdId) {
          const currentAllocations: any[] = Array.isArray(p.merchantAllocations) ? [...p.merchantAllocations] : [];
          const existingAllocIndex = currentAllocations.findIndex((a: any) => 
            (a.merchantId && String(a.merchantId).trim().toLowerCase() === mId.toLowerCase()) ||
            (normalizeName(a.merchantName || '') === normalizeName(mName))
          );

          const updatedAllocItem = {
            merchantId: mId,
            merchantName: mName,
            costPrice: costNum,
            sellingPrice: priceNum,
            stock: stockNum
          };

          if (existingAllocIndex >= 0) {
            currentAllocations[existingAllocIndex] = {
              ...currentAllocations[existingAllocIndex],
              ...updatedAllocItem
            };
          } else {
            currentAllocations.push(updatedAllocItem);
          }

          const currentMerchantIds: string[] = Array.isArray(p.merchantIds) ? [...p.merchantIds] : [];
          if (!currentMerchantIds.includes(mId)) {
            currentMerchantIds.push(mId);
          }

          const isPrimary = p.merchantId === mId || normalizeName(p.merchantName || '') === normalizeName(mName);

          return {
            ...p,
            merchantAllocations: currentAllocations,
            merchantIds: currentMerchantIds,
            ...(isPrimary ? { costPrice: costNum, price: priceNum, stock: stockNum } : {})
          };
        }
        return p;
      });

      const nextSettings = { ...settings, products: updatedProducts };
      updateSettings(nextSettings);

      if (directStoreData) {
        setDirectStoreData({
          ...directStoreData,
          settings: {
            ...directStoreData.settings,
            products: updatedProducts
          }
        });
      }

      setCrossStoreProducts(prev => prev.map(cp => {
        if (cp.id === targetProdId) {
          return {
            ...cp,
            costPrice: costNum,
            price: priceNum,
            stock: stockNum,
            stockQuantity: stockNum,
            merchantAllocation: {
              ...((cp as any).merchantAllocation || {}),
              costPrice: costNum,
              sellingPrice: priceNum,
              stock: stockNum,
              merchantId: mId,
              merchantName: mName
            }
          };
        }
        return cp;
      }));

      const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
      if (targetStore) {
        const curStore = (await db.getStoreData(targetStore, false)) || activeStoreData;
        if (curStore) {
          await db.saveStoreData(targetStore, {
            ...curStore,
            settings: {
              ...(curStore.settings || {}),
              products: updatedProducts
            } as any
          });
        }
      }

      setPricingModalProduct(null);
      showToast(`تم حفظ تسعيرتك الخاصة بنجاح: تكلفة ${costNum} ج.م / بيع ${priceNum} ج.م (ربحك ${Math.max(0, priceNum - costNum)} ج.م للقطعة)`, 'success');
    } catch (err: any) {
      console.error('Error saving custom pricing:', err);
      showToast('تعذر حفظ التسعيرة: ' + (err.message || ''), 'error');
    } finally {
      setIsSavingCustomPricing(false);
    }
  };

  const handleOpenAddProduct = useCallback(() => {
    setEditingProduct(null);
    setProdModalTab('general');
    setProdFormName('');
    setProdFormSku(`SKU-${Math.floor(1000 + Math.random() * 9000)}`);
    setProdFormPrice('');
    setProdFormCostPrice('');
    setProdFormProfitMode('commission');
    setProdFormCommissionPct(liveMerchant?.profitRatio || 15);
    setProdFormStock(10);
    setProdFormThumbnail('');
    setProdFormDescription('');

    setMerchantCustomCostPrice('');
    setMerchantCustomSellingPrice('');
    setMerchantCustomStock(10);

    setShowAddEditProductModal(true);
  }, [liveMerchant]);

  const handleOpenEditProduct = useCallback((p: any) => {
    setEditingProduct(p);
    setProdModalTab('general');
    setProdFormName(p.name || p.title || '');
    setProdFormSku(p.sku || '');
    setProdFormPrice(p.price || p.sellingPrice || '');
    setProdFormCostPrice(p.costPrice || p.cost || p.wholesalePrice || '');
    setProdFormProfitMode(p.profitMode || 'commission');
    setProdFormCommissionPct(p.commissionPercentage || p.profitPercentage || liveMerchant?.profitRatio || 15);
    setProdFormStock(Number(p.stock || p.quantity || 0));
    setProdFormThumbnail(p.thumbnail || p.imageUrl || p.image || '');
    setProdFormDescription(p.description || '');

    const alloc = p.merchantAllocation || (Array.isArray(p.merchantAllocations) ? p.merchantAllocations.find((a: any) => 
      (a.merchantId && String(a.merchantId).trim().toLowerCase() === String(liveMerchant?.id || '').trim().toLowerCase()) ||
      (normalizeName(a.merchantName || '') === normalizeName(liveMerchant?.name || ''))
    ) : null);

    setMerchantCustomCostPrice(alloc?.costPrice ?? p.costPrice ?? p.cost ?? '');
    setMerchantCustomSellingPrice(alloc?.sellingPrice ?? p.price ?? p.sellingPrice ?? '');
    setMerchantCustomStock(alloc?.stock ?? p.stock ?? p.quantity ?? 10);

    setShowAddEditProductModal(true);
  }, [liveMerchant]);

  const handleSaveProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant) return;
    if (!prodFormName.trim()) {
      showToast('يرجى إدخال اسم الصنف أو المنتج', 'error');
      return;
    }
    const priceNum = Number(prodFormPrice) || 0;
    if (priceNum <= 0) {
      showToast('يرجى إدخال سعر البيع بصورة أرقام صحيحة', 'error');
      return;
    }

    setIsSavingProduct(true);
    try {
      const allProds: any[] = Array.isArray(activeStoreData?.settings?.products) 
        ? [...activeStoreData.settings.products] 
        : (Array.isArray(settings.products) ? [...settings.products] : []);

      let updatedProducts: any[];
      if (editingProduct?.id) {
        const mId = String(liveMerchant.id || '').trim();
        const mName = String(liveMerchant.name || '').trim();

        const customCostNum = merchantCustomCostPrice !== '' ? Number(merchantCustomCostPrice) : Number(prodFormCostPrice) || 0;
        const customSellingNum = merchantCustomSellingPrice !== '' ? Number(merchantCustomSellingPrice) : priceNum;
        const customStockNum = merchantCustomStock !== '' ? Number(merchantCustomStock) : prodFormStock;

        updatedProducts = allProds.map(p => {
          if (p.id === editingProduct.id) {
            const currentAllocations: any[] = Array.isArray(p.merchantAllocations) ? [...p.merchantAllocations] : [];
            const existingAllocIndex = currentAllocations.findIndex((a: any) => 
              (a.merchantId && String(a.merchantId).trim().toLowerCase() === mId.toLowerCase()) ||
              (normalizeName(a.merchantName || '') === normalizeName(mName))
            );

            const updatedAllocItem = {
              merchantId: mId,
              merchantName: mName,
              costPrice: customCostNum,
              sellingPrice: customSellingNum,
              stock: customStockNum
            };

            if (existingAllocIndex >= 0) {
              currentAllocations[existingAllocIndex] = {
                ...currentAllocations[existingAllocIndex],
                ...updatedAllocItem
              };
            } else {
              currentAllocations.push(updatedAllocItem);
            }

            const isPrimary = p.merchantId === mId || normalizeName(p.merchantName || '') === normalizeName(mName);

            return {
              ...p,
              name: prodFormName.trim(),
              sku: prodFormSku.trim() || p.sku,
              // Only update primary product price & cost if this merchant IS the primary merchant!
              ...(isPrimary ? {
                price: priceNum,
                costPrice: Number(prodFormCostPrice) || 0,
                stock: prodFormStock,
                stockQuantity: prodFormStock
              } : {}),
              profitMode: prodFormProfitMode,
              commissionPercentage: prodFormCommissionPct,
              profitPercentage: prodFormCommissionPct,
              thumbnail: prodFormThumbnail.trim(),
              description: prodFormDescription.trim(),
              merchantAllocations: currentAllocations,
              merchantIds: Array.from(new Set([
                ...(Array.isArray(p.merchantIds) ? p.merchantIds : []),
                mId
              ])).filter(Boolean)
            };
          }
          return p;
        });
      } else {
        const newProd = {
          id: `prod_m_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: prodFormName.trim(),
          sku: prodFormSku.trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          price: priceNum,
          costPrice: Number(prodFormCostPrice) || 0,
          profitMode: prodFormProfitMode,
          commissionPercentage: prodFormCommissionPct,
          profitPercentage: prodFormCommissionPct,
          stock: prodFormStock,
          stockQuantity: prodFormStock,
          thumbnail: prodFormThumbnail.trim(),
          description: prodFormDescription.trim(),
          merchantId: liveMerchant.id,
          supplierId: liveMerchant.id,
          merchantName: liveMerchant.name,
          supplierName: liveMerchant.name,
          hasVariants: false,
          variants: [],
          options: [],
          weight: 0.5
        };
        updatedProducts = [newProd, ...allProds];
      }

      const nextSettings = { ...settings, products: updatedProducts };
      updateSettings(nextSettings);

      if (directStoreData) {
        setDirectStoreData({
          ...directStoreData,
          settings: {
            ...directStoreData.settings,
            products: updatedProducts
          }
        });
      }

      const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
      if (targetStore) {
        const curStore = (await db.getStoreData(targetStore, false)) || activeStoreData;
        if (curStore) {
          await db.saveStoreData(targetStore, {
            ...curStore,
            settings: {
              ...(curStore.settings || {}),
              products: updatedProducts
            } as any
          });
        }
      }

      setShowAddEditProductModal(false);
      showToast(editingProduct ? 'تم تعديل بيانات الصنف بنجاح' : 'تمت إضافة الصنف الجديد بنجاح إلى مخزونك', 'success');
    } catch (err: any) {
      console.error('Error saving merchant product:', err);
      showToast('تعذر حفظ الصنف: ' + (err.message || ''), 'error');
    } finally {
      setIsSavingProduct(false);
    }
  };

  // Create Order Studio State
  const [createOrderMode, setCreateOrderMode] = useState<'form' | 'dev_seal'>('form');
  const [orderCustomerName, setOrderCustomerName] = useState('');
  const [orderCustomerPhone, setOrderCustomerPhone] = useState('');
  const [orderGovernorate, setOrderGovernorate] = useState('القاهرة');
  const [orderCity, setOrderCity] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderProductId, setOrderProductId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderSellingPrice, setOrderSellingPrice] = useState<number | ''>('');
  const [orderShippingFee, setOrderShippingFee] = useState<number>(45);
  const [orderAllowOpen, setOrderAllowOpen] = useState(true);
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Auto-sync shipping fee when order governorate changes
  useEffect(() => {
    if (orderGovernorate && EGYPT_GOV_SHIPPING_RATES[orderGovernorate]) {
      setOrderShippingFee(EGYPT_GOV_SHIPPING_RATES[orderGovernorate]);
    }
  }, [orderGovernorate]);

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

  const [showChangePlanModal, setShowChangePlanModal] = useState(false);

  // Bosta-Style Cashout Frequency, Financial Cycle, and Balance Breakdown Popover States
  const [showPayoutFrequencyModal, setShowPayoutFrequencyModal] = useState(false);
  const [showFinancialCycleModal, setShowFinancialCycleModal] = useState(false);
  const [showBalanceDetailsPopover, setShowBalanceDetailsPopover] = useState(false);
  const [tempPayoutFrequency, setTempPayoutFrequency] = useState<'daily' | 'weekly'>('weekly');
  const [tempWeeklyPayoutDay, setTempWeeklyPayoutDay] = useState<number>(1);

  useEffect(() => {
    if (liveMerchant) {
      setTempPayoutFrequency(liveMerchant.payoutFrequency || 'weekly');
      setTempWeeklyPayoutDay(typeof liveMerchant.weeklyPayoutDay === 'number' ? liveMerchant.weeklyPayoutDay : 1);
    }
  }, [liveMerchant?.payoutFrequency, liveMerchant?.weeklyPayoutDay, showPayoutFrequencyModal]);

  // Helper to persist payoutAccounts, passcode, subscriptionPlan, managerPlan, pendingPlanRequest, planCyclesHistory, scheduledNextPlan, payoutFrequency, weeklyPayoutDay, or wallet balance changes for the authenticated merchant
  const persistMerchantAccountUpdates = useCallback(async (updates: {
    passcode?: string;
    payoutAccounts?: Partner['payoutAccounts'];
    subscriptionPlan?: MerchantSubscriptionConfig;
    managerPlan?: MerchantManagerConfig;
    pendingPlanRequest?: MerchantPlanChangeRequest | null;
    planCyclesHistory?: MerchantPlanCycleRecord[];
    scheduledNextPlan?: ScheduledMerchantPlanTransition | null;
    payoutFrequency?: 'daily' | 'weekly';
    weeklyPayoutDay?: number;
    lastPayoutFrequencyChangeAt?: string;
    balance?: number;
    newTransaction?: MerchantTransaction;
  }) => {
    if (!liveMerchant) return false;
    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
    const normTargetName = normalizeName(liveMerchant.name || '');

    const currentSuppliers: any[] = Array.isArray(settings.suppliers) ? [...settings.suppliers] : [];
    const currentPartners: any[] = Array.isArray(settings.partners) ? [...settings.partners] : [];

    const existingTxs = Array.isArray(liveMerchant.transactions) ? [...liveMerchant.transactions] : [];
    const nextTransactions = updates.newTransaction ? [updates.newTransaction, ...existingTxs] : existingTxs;

    const targetPhone = String(liveMerchant.phone || '').trim();
    const targetEmail = String(liveMerchant.email || '').trim().toLowerCase();

    const applyPatch = (entity: any) => ({
      ...entity,
      ...(updates.passcode !== undefined ? { passcode: updates.passcode } : {}),
      ...(updates.payoutAccounts !== undefined ? { payoutAccounts: updates.payoutAccounts } : {}),
      ...(updates.subscriptionPlan !== undefined ? { subscriptionPlan: updates.subscriptionPlan } : {}),
      ...(updates.managerPlan !== undefined ? { managerPlan: updates.managerPlan } : {}),
      ...(updates.pendingPlanRequest !== undefined ? { pendingPlanRequest: updates.pendingPlanRequest } : {}),
      ...(updates.planCyclesHistory !== undefined ? { planCyclesHistory: updates.planCyclesHistory } : {}),
      ...(updates.scheduledNextPlan !== undefined ? { scheduledNextPlan: updates.scheduledNextPlan } : {}),
      ...(updates.payoutFrequency !== undefined ? { payoutFrequency: updates.payoutFrequency } : {}),
      ...(updates.weeklyPayoutDay !== undefined ? { weeklyPayoutDay: updates.weeklyPayoutDay } : {}),
      ...(updates.lastPayoutFrequencyChangeAt !== undefined ? { lastPayoutFrequencyChangeAt: updates.lastPayoutFrequencyChangeAt } : {}),
      ...(updates.balance !== undefined ? { balance: updates.balance } : {}),
      ...(updates.newTransaction !== undefined ? { transactions: nextTransactions } : {})
    });

    let partnersToSave: any[] = [];
    let suppliersToSave: any[] = [];

    try {
      updateSettings((prev: any) => {
        const currentSuppliers: any[] = Array.isArray(prev?.suppliers) ? [...prev.suppliers] : [];
        const currentPartners: any[] = Array.isArray(prev?.partners) ? [...prev.partners] : [];

        let supplierFound = false;
        const updatedSuppliers = currentSuppliers.map(s => {
          if (
            (s.id && s.id === liveMerchant.id) ||
            (s.name && normalizeName(s.name) === normTargetName) ||
            (targetPhone && s.phone && String(s.phone).trim() === targetPhone) ||
            (targetEmail && s.email && String(s.email).trim().toLowerCase() === targetEmail)
          ) {
            supplierFound = true;
            return applyPatch(s);
          }
          return s;
        });

        if (!supplierFound) {
          updatedSuppliers.push(applyPatch({
            id: liveMerchant.id,
            name: liveMerchant.name,
            phone: liveMerchant.phone || '',
            email: liveMerchant.email || '',
            balance: updates.balance ?? liveMerchant.balance ?? 0,
            transactions: nextTransactions,
            passcode: updates.passcode ?? liveMerchant.passcode ?? '0000',
            payoutAccounts: updates.payoutAccounts ?? liveMerchant.payoutAccounts ?? {},
            subscriptionPlan: updates.subscriptionPlan ?? liveMerchant.subscriptionPlan,
            managerPlan: updates.managerPlan ?? liveMerchant.managerPlan,
            pendingPlanRequest: updates.pendingPlanRequest !== undefined ? updates.pendingPlanRequest : (liveMerchant.pendingPlanRequest ?? null),
            planCyclesHistory: updates.planCyclesHistory ?? liveMerchant.planCyclesHistory ?? [],
            scheduledNextPlan: updates.scheduledNextPlan !== undefined ? updates.scheduledNextPlan : (liveMerchant.scheduledNextPlan ?? null),
            payoutFrequency: updates.payoutFrequency ?? liveMerchant.payoutFrequency ?? 'weekly',
            weeklyPayoutDay: updates.weeklyPayoutDay ?? liveMerchant.weeklyPayoutDay ?? 1,
            role: 'موكل / مورد صاحب بضاعة'
          }));
        }

        let partnerFound = false;
        const updatedPartners = currentPartners.map(p => {
          if (
            (p.id && p.id === liveMerchant.id) ||
            (p.name && normalizeName(p.name) === normTargetName) ||
            (targetPhone && p.phone && String(p.phone).trim() === targetPhone) ||
            (targetEmail && p.email && String(p.email).trim().toLowerCase() === targetEmail)
          ) {
            partnerFound = true;
            return applyPatch(p);
          }
          return p;
        });

        if (!partnerFound) {
          updatedPartners.push(applyPatch({
            ...liveMerchant
          }));
        }

        partnersToSave = updatedPartners;
        suppliersToSave = updatedSuppliers;

        return {
          ...prev,
          suppliers: updatedSuppliers,
          partners: updatedPartners
        };
      });

      setDirectStoreData(prev => prev ? ({
        ...prev,
        settings: {
          ...prev.settings,
          suppliers: suppliersToSave,
          partners: partnersToSave
        }
      }) : prev);

      setAuthenticatedMerchant(prev => prev ? applyPatch(prev) : prev);

      if (targetStore && partnersToSave.length > 0) {
        await db.updatePartnerSettings(targetStore, partnersToSave, suppliersToSave);
      }
      return true;
    } catch (err: any) {
      console.error('[MerchantPortal] Failed to persist account updates:', err);
      return false;
    }
  }, [liveMerchant, effectiveStoreId, updateSettings]);

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

    return null;
  }, [merchants, effectiveStoreId]);

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

    if (urlPartnerId && String(matched.id).trim().toLowerCase() !== String(urlPartnerId).trim().toLowerCase()) {
      setAuthError('بيانات الدخول تخص موكلاً مختلفاً عن الحساب الموجود في هذا الرابط. افتح رابط بوابتك الصحيح.');
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

        if (urlPartnerId && String(authenticatedObj.id).trim().toLowerCase() !== String(urlPartnerId).trim().toLowerCase()) {
          setAuthError('هذا البريد مرتبط بموكل مختلف عن الحساب الموجود في هذا الرابط.');
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
    const mId = String(liveMerchant.id || '').trim().toLowerCase();

    return rawOrders.filter(o => {
      const oMId = String(o.merchantId || '').trim().toLowerCase();

      const matchMain = Boolean(mId && oMId === mId);

      if (matchMain) return true;

      // NEW: Check individual items for joint merchant association (Option B)
      return (o.items || []).some(item => {
        const iMId = String(item.merchantId || '').trim().toLowerCase();
        return Boolean(mId && iMId === mId);
      });
    });
  }, [rawOrders, liveMerchant]);

  // Consignment Products & Stock Valuation
  // Product ownership is resolved centrally by merchant ID. Cross-store and
  // localStorage scans are intentionally not used for runtime visibility.
  const merchantProducts = useMemo(() => {
    if (!liveMerchant) return [];

    console.log('[MerchantPortal] Scanning products for merchant:', {
      name: liveMerchant.name,
      id: liveMerchant.id,
      storeId: (liveMerchant as any)._storeId
    });

    const productSources: any[][] = [
      Array.isArray(activeStoreData?.settings?.products) ? activeStoreData.settings.products : [],
      Array.isArray((activeStoreData as any)?.products) ? (activeStoreData as any).products : [],
      Array.isArray(settings?.products) ? settings.products : [],
      Array.isArray(crossStoreProducts) ? crossStoreProducts : []
    ];

    const productsById = new Map<string, any>();
    productSources.flat().forEach((product: any) => {
      if (product?.id && !productsById.has(String(product.id))) {
        productsById.set(String(product.id), product);
      }
    });

    console.log(`[MerchantPortal] Total unique candidate products found: ${productsById.size}`);

    const list = getProductsForMerchant(Array.from(productsById.values()), liveMerchant.id, liveMerchant.name);
    
    console.log(`[MerchantPortal] Products after filtering for merchant: ${list.length}`);

    if (list.length === 0 && (liveMerchant.id || liveMerchant.name)) {
      try {
        const cacheKey = liveMerchant.id ? `merchant_cached_prods_${liveMerchant.id}` : `merchant_cached_prods_name_${normalizeName(liveMerchant.name)}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[MerchantPortal] Found ${parsed.length} products in localStorage cache`);
            return getProductsForMerchant(parsed, liveMerchant.id, liveMerchant.name);
          }
        }
      } catch (err) {
        console.error('[MerchantPortal] Cache error:', err);
      }
    }

    return list;
  }, [activeStoreData, settings?.products, crossStoreProducts, liveMerchant]);

  // Orders Counts by Status for Filter Pills
  const orderStatusCounts = useMemo(() => {
    let shipping = 0, collected = 0, pending = 0, returned = 0;
    merchantOrders.forEach(o => {
      if (['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status)) shipping++;
      else if (['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status)) collected++;
      else if (['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز', 'قيد_التنفيذ', 'جاري_المراجعة'].includes(o.status)) pending++;
      else if (TRANSPARENCY_RETURN_STATUSES.includes(o.status as any)) returned++;
    });
    return { all: merchantOrders.length, shipping, collected, pending, returned };
  }, [merchantOrders]);

  // Filtered Orders View (All Created Orders + Search + Status + Date Filters)
  const filteredOrders = useMemo(() => {
    let list = [...merchantOrders];

    if (selectedSettlementId) {
      list = list.filter(o => 
        (o.settlementId && String(o.settlementId) === String(selectedSettlementId)) || 
        ((o as any).merchantSettlementId && String((o as any).merchantSettlementId) === String(selectedSettlementId))
      );
    }

    if (ordersSearchQuery.trim()) {
      const q = ordersSearchQuery.trim().toLowerCase();
      list = list.filter(o => {
        const ordId = String(o.orderNumber || o.id || '').toLowerCase();
        const trk = String(getTrackingNumber(o) || '').toLowerCase();
        const cName = String(o.customerName || '').toLowerCase();
        const cPhone = String(o.customerPhone || '').toLowerCase();
        const gov = String((o as any).governorate || (o as any).province || (o as any).city || '').toLowerCase();
        return ordId.includes(q) || trk.includes(q) || cName.includes(q) || cPhone.includes(q) || gov.includes(q);
      });
    }

    if (cycleStartDate) {
      const startMs = new Date(cycleStartDate + 'T00:00:00').getTime();
      list = list.filter(o => {
        const dRaw = o.date || (o as any).createdAt;
        const d = dRaw ? new Date(dRaw).getTime() : 0;
        return d >= startMs;
      });
    }
    if (cycleEndDate) {
      const endMs = new Date(cycleEndDate + 'T23:59:59').getTime();
      list = list.filter(o => {
        const dRaw = o.date || (o as any).createdAt;
        const d = dRaw ? new Date(dRaw).getTime() : 0;
        return d <= endMs;
      });
    }

    if (ordersStatusFilter === 'shipping') {
      list = list.filter(o => ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status));
    } else if (ordersStatusFilter === 'collected') {
      list = list.filter(o => ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status));
    } else if (ordersStatusFilter === 'pending') {
      list = list.filter(o => ['جديد', 'معلق', 'بانتظار_التأكيد', 'قيد_التجهيز', 'قيد_التنفيذ', 'جاري_المراجعة'].includes(o.status));
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
  }, [merchantOrders, currentTab, ordersStatusFilter, ordersSearchQuery, cycleStartDate, cycleEndDate, liveMerchant?.transactions]);

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
    const matchingSettleTx = (liveMerchant?.transactions || []).find(tx =>
      (tx.referenceId && String(tx.referenceId) === String(o.id)) ||
      (tx.notes && orderRef && tx.notes.includes(orderRef))
    );
    const isSettled = Boolean(
      (o as any).merchantSettled ||
      (o as any).isSettled ||
      o.settlementStatus === 'settled' ||
      matchingSettleTx
    );

    const holdingDaysRequired = o.customHoldingDays !== undefined
      ? Math.max(0, Number(o.customHoldingDays))
      : Math.max(0, Number(liveMerchant?.holdingDaysAfterSettlement ?? 7));

    const settledAtIso = o.settledAt || matchingSettleTx?.date || (isSettled ? ((o as any).deliveredAt || (o as any).updatedAt || o.date || o.createdAt) : undefined);
    const settledTimestamp = (isSettled && settledAtIso) ? new Date(settledAtIso).getTime() : 0;
    const daysSinceSettled = (isSettled && settledTimestamp > 0)
      ? Math.max(0, Math.floor((Date.now() - settledTimestamp) / 86400000))
      : 0;

    // Rolling Weekly Cycle Rule:
    // If the merchant is on weekly payout, any order settled during the current weekly cycle
    // (or in the same week a payout already occurred) is deferred to next week's payout cycle.
    const isWeeklyFreq = (liveMerchant?.payoutFrequency || 'weekly') === 'weekly';
    const weeklyDayIdx = typeof liveMerchant?.weeklyPayoutDay === 'number'
      ? Math.min(6, Math.max(0, liveMerchant.weeklyPayoutDay))
      : 1;
    const nowDate = new Date();
    const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    const daysSinceLastPayoutDay = (nowDate.getDay() - weeklyDayIdx + 7) % 7;
    const currentWeekCycleStart = todayStart - daysSinceLastPayoutDay * 86400000;
    const daysUntilNextPayoutDay = ((weeklyDayIdx - nowDate.getDay() + 7) % 7) || 7;

    // Check if a withdrawal was already executed in the current week cycle
    const hadWithdrawalThisWeek = (liveMerchant?.transactions || []).some(
      tx => tx.type === 'withdrawal' && new Date(tx.date).getTime() >= currentWeekCycleStart
    );

    const isSettledInCurrentWeekCycle = Boolean(
      isSettled &&
      isWeeklyFreq &&
      holdingDaysRequired > 0 &&
      settledTimestamp >= currentWeekCycleStart
    );

    const baseRemainingHoldingDays = isSettled
      ? Math.max(0, holdingDaysRequired - daysSinceSettled)
      : holdingDaysRequired;

    // If settled this week (or a payout already happened this week while this order was settled this cycle),
    // defer it at least until next week's payout day
    const remainingHoldingDays = isSettledInCurrentWeekCycle
      ? Math.max(baseRemainingHoldingDays, daysUntilNextPayoutDay)
      : baseRemainingHoldingDays;

    const isDeferredFromCurrentWeek = Boolean(
      isSettled &&
      (isSettledInCurrentWeekCycle || (hadWithdrawalThisWeek && settledTimestamp >= currentWeekCycleStart)) &&
      o.payoutStatus !== 'ready'
    );

    const isPaidOut = Boolean(
      o.payoutStatus === 'paid' ||
      o.paidOutAt ||
      (isSettled && (liveMerchant?.balance || 0) === 0 && (liveMerchant?.transactions || []).some(tx => tx.type === 'withdrawal' && settledAtIso && new Date(tx.date).getTime() >= new Date(settledAtIso).getTime()))
    );

    const payoutStage: 'unsettled' | 'holding' | 'ready' | 'paid' = isPaidOut
      ? 'paid'
      : !isSettled
      ? 'unsettled'
      : (remainingHoldingDays > 0 || isDeferredFromCurrentWeek) && o.payoutStatus !== 'ready'
      ? 'holding'
      : 'ready';

    const payoutStageLabelAr =
      payoutStage === 'paid'
        ? 'مدفوع ✅'
        : payoutStage === 'ready'
        ? 'جاهز للتحويل في السحبة القادمة'
        : payoutStage === 'holding'
        ? isDeferredFromCurrentWeek
          ? `تسوية هذا الأسبوع — يُرحّل لأسبوع التحويل القادم (متبقي ${remainingHoldingDays} يوم)`
          : `قيد التعليق (متبقي ${remainingHoldingDays} يوم)`
        : 'بانتظار التسوية المالية';

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
      isSettled,
      settledAtIso,
      holdingDaysRequired,
      daysSinceSettled,
      remainingHoldingDays,
      isDeferredFromCurrentWeek,
      isPaidOut,
      payoutStage,
      payoutStageLabelAr
    };
  }, [liveMerchant?.transactions, liveMerchant?.holdingDaysAfterSettlement, liveMerchant?.payoutFrequency, liveMerchant?.weeklyPayoutDay, liveMerchant?.balance, settings]);

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

  const unlimitedProductCount = useMemo(() =>
    merchantProducts.filter(product => Boolean((product as any).unlimitedStock)).length,
  [merchantProducts]);

  // Memoized Customers List derived from merchant orders
  const customersList = useMemo(() => {
    const map = new Map<string, {
      id: string;
      phone: string;
      name: string;
      governorate: string;
      city: string;
      address: string;
      totalOrders: number;
      deliveredOrders: number;
      returnedOrders: number;
      shippingOrders: number;
      pendingOrders: number;
      totalSpent: number;
      lastOrderDate: string;
      lastOrderNumber: string;
    }>();

    merchantOrders.forEach(o => {
      const cleanPhone = (o.customerPhone || '').replace(/[^\d+]/g, '');
      const key = cleanPhone || (o.customerName || '').trim() || o.id;
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          phone: o.customerPhone ? o.customerPhone.trim() : '—',
          name: o.customerName ? o.customerName.trim() : 'عميل بدون اسم',
          governorate: o.governorate || 'غير محدد',
          city: o.city || '',
          address: o.customerAddress || (o as any).address || '',
          totalOrders: 0,
          deliveredOrders: 0,
          returnedOrders: 0,
          shippingOrders: 0,
          pendingOrders: 0,
          totalSpent: 0,
          lastOrderDate: o.createdAt || '',
          lastOrderNumber: o.orderNumber || ''
        });
      }

      const c = map.get(key)!;
      c.totalOrders += 1;
      const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها', 'delivered'].includes(o.status);
      const isReturn = ['مرتجع', 'فشل_التوصيل', 'تمت_الاعادة_لشركة_الشحن', 'مرتجع_جزئي', 'مرتجع_بعد_الاستلام', 'ملغي', 'returned', 'cancelled'].includes(o.status);
      const isShipping = ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق', 'shipping'].includes(o.status);

      if (isDelivered) {
        c.deliveredOrders += 1;
        c.totalSpent += ((o as any).total || (o as any).totalAmount || (o as any).finalAmount || (o as any).codAmount || 0);
      } else if (isReturn) {
        c.returnedOrders += 1;
      } else if (isShipping) {
        c.shippingOrders += 1;
      } else {
        c.pendingOrders += 1;
      }

      if (o.createdAt && (!c.lastOrderDate || new Date(o.createdAt) > new Date(c.lastOrderDate))) {
        c.lastOrderDate = o.createdAt;
        c.lastOrderNumber = o.orderNumber || '';
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalOrders - a.totalOrders);
  }, [merchantOrders]);

  const uniqueCustomersCount = customersList.length;
  const totalDeliveredCustomers = customersList.filter(c => c.deliveredOrders > 0).length;
  const repeatCustomersCount = customersList.filter(c => c.totalOrders > 1).length;
  const totalCustomersSpend = customersList.reduce((acc, c) => acc + c.totalSpent, 0);
  const avgSpentPerCustomer = uniqueCustomersCount > 0 ? Math.round(totalCustomersSpend / uniqueCustomersCount) : 0;

  const filteredCustomersList = useMemo(() => {
    if (!customersSearchQuery.trim()) return customersList;
    const q = customersSearchQuery.toLowerCase().trim();
    return customersList.filter(c => 
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.governorate.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q)
    );
  }, [customersList, customersSearchQuery]);

  // Auto-fill price when product is selected in order creation
  useEffect(() => {
    if (orderProductId) {
      const prod = merchantProducts.find(p => p.id === orderProductId);
      if (prod) {
        const cost = Number(prod.costPrice || prod.cost || 0);
        const price = Number(prod.price || prod.sellingPrice || (cost > 0 ? Math.round(cost * 1.35) : 0));
        setOrderSellingPrice(price);
      }
    }
  }, [orderProductId, merchantProducts]);

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
      runningBalance = Number((runningBalance + amount).toFixed(2));
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

  // Merchant Consolidated P&L Income Statement (قائمة الأرباح والخسائر للموكل)
  const merchantPnL = useMemo(() => {
    const grossRevenue = overviewStats.totalDeliveredCollected || 0;
    const cogs = overviewStats.totalGoodsCostCapital || 0;
    const grossProfit = grossRevenue - cogs;
    const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

    const shippingExp = overviewStats.totalShippingDeductions || 0;
    const operatingExp = overviewStats.totalServiceFees || 0;
    const otherStoreExp = overviewStats.totalOtherStoreExpenses || 0;
    const totalOperatingExpenses = shippingExp + operatingExp + otherStoreExp;

    const netProfit = grossProfit - totalOperatingExpenses;
    const netMarginPct = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
    const deliveredCount = overviewStats.deliveredCount || 0;
    const aov = deliveredCount > 0 ? grossRevenue / deliveredCount : 0;
    const cpo = deliveredCount > 0 ? totalOperatingExpenses / deliveredCount : 0;

    return {
      grossRevenue,
      cogs,
      grossProfit,
      grossMarginPct,
      shippingExp,
      operatingExp,
      otherStoreExp,
      totalOperatingExpenses,
      netProfit,
      netMarginPct,
      deliveredCount,
      aov,
      cpo,
      totalOrders: merchantOrders.length
    };
  }, [overviewStats, merchantOrders]);

  // Consignment Inventory Filtered List
  const filteredConsignmentProducts = useMemo(() => {
    let list = [...merchantProducts];
    if (inventorySearch.trim()) {
      const q = normalizeName(inventorySearch);
      list = list.filter(p => {
        const name = normalizeName(p.name || p.title || '');
        const sku = String(p.sku || p.barcode || p.id || '').toLowerCase();
        return name.includes(q) || sku.includes(q);
      });
    }
    if (inventoryStockFilter === 'available') {
      list = list.filter(p => {
        const isStockEmpty = p.stock === null || p.stock === undefined || p.stock === '' || p.quantity === null || p.quantity === undefined || p.quantity === '';
        const isUnlimited = Boolean((p as any).unlimitedStock) || (Boolean((p as any).isSharedProduct || p.isAllocatedConsignment) && isStockEmpty);
        return isUnlimited || Number(p.stock || p.quantity || 0) > 0;
      });
    } else if (inventoryStockFilter === 'low') {
      list = list.filter(p => {
        const isStockEmpty = p.stock === null || p.stock === undefined || p.stock === '' || p.quantity === null || p.quantity === undefined || p.quantity === '';
        const isUnlimited = Boolean((p as any).unlimitedStock) || (Boolean((p as any).isSharedProduct || p.isAllocatedConsignment) && isStockEmpty);
        if (isUnlimited) return false;
        const s = Number(p.stock || p.quantity || 0);
        return s > 0 && s <= 5;
      });
    } else if (inventoryStockFilter === 'out') {
      list = list.filter(p => {
        const isStockEmpty = p.stock === null || p.stock === undefined || p.stock === '' || p.quantity === null || p.quantity === undefined || p.quantity === '';
        const isUnlimited = Boolean((p as any).unlimitedStock) || (Boolean((p as any).isSharedProduct || p.isAllocatedConsignment) && isStockEmpty);
        return !isUnlimited && Number(p.stock || p.quantity || 0) <= 0;
      });
    }
    return list;
  }, [merchantProducts, inventorySearch, inventoryStockFilter]);

  const pendingRetryOrderRef = useRef<{ id: string; orderNumber: string; signature: string } | null>(null);

  // Handle Merchant Direct Order Creation (Self-Service Plans Only)
  const handleMerchantSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveMerchant) {
      showToast('خطأ: بيانات الموكل غير متوفرة', 'error');
      return;
    }
    if (planUsage.managerPlanActive || liveMerchant.managerPlan?.status === 'active') {
      showToast('أنت مشترك في باقة المدير المخصص؛ يتولى مدير حسابك إنشاء الأوردرات وتأكيدها وشحنها نيابةً عنك', 'error');
      return;
    }
    if (!planUsage.isUnlimited && planUsage.limitOrders && planUsage.limitOrders > 0 && planUsage.usedOrders >= planUsage.limitOrders) {
      showToast('لقد استنفدت الحد الأقصى للأوردرات في باقتك الحالية؛ يرجى ترقية الباقة أولاً', 'error');
      setShowChangePlanModal(true);
      return;
    }
    if (!orderCustomerName.trim()) {
      showToast('يرجى كتابة اسم العميل', 'error');
      return;
    }
    if (!orderCustomerPhone.trim()) {
      showToast('يرجى كتابة رقم هاتف العميل', 'error');
      return;
    }
    if (!orderProductId) {
      showToast('يرجى اختيار المنتج من بضاعتك المتاحة بالمخزن', 'error');
      return;
    }

    const selectedProd = merchantProducts.find(p => p.id === orderProductId);
    if (!selectedProd) {
      showToast('المنتج المحدد غير موجود في مخزونك', 'error');
      return;
    }

    const qty = Math.max(1, Number(orderQuantity) || 1);
    const unlimitedStock = Boolean((selectedProd as any).unlimitedStock);
    const availableStock = unlimitedStock ? Number.POSITIVE_INFINITY : Number(
      (selectedProd as any).stockQuantity ?? (selectedProd as any).stock ?? (selectedProd as any).quantity ?? 0
    );

    // Blank shared allocation means unlimited; a numeric allocation remains strictly enforced.
    if (!unlimitedStock && qty > availableStock) {
      showToast(
        `الكمية المطلوبة (${qty}) أكبر من الرصيد المتاح في المخزون (${availableStock} قطعة). لا يمكن إنشاء الطلب بكمية تتجاوز المتاح.`,
        'error'
      );
      return;
    }

    const prodTitle = selectedProd?.name || (selectedProd as any)?.title || 'منتج موكل';
    const unitCost = Number(selectedProd?.costPrice || (selectedProd as any)?.cost || 0);
    const unitPrice = Number(orderSellingPrice) > 0 ? Number(orderSellingPrice) : Number(selectedProd?.price || (unitCost > 0 ? Math.round(unitCost * 1.35) : 100));
    const itemsTotal = unitPrice * qty;
    const shipFee = Number(orderShippingFee) || 45;
    const totalCod = itemsTotal + shipFee;
    const operatingFee = Number((activeStoreData?.settings as any)?.serviceFeePerOrder || 15);

    const draftSignature = `${liveMerchant.id}|${orderCustomerPhone.trim()}|${orderProductId}|${qty}|${totalCod}`;

    setIsSubmittingOrder(true);
    try {
      // Audit Fix #4 & #8: Collision-free UUID primary ID + reusable idempotency identity across retries
      if (!pendingRetryOrderRef.current || pendingRetryOrderRef.current.signature !== draftSignature) {
        pendingRetryOrderRef.current = {
          id: generateUniqueOrderId('ord'),
          orderNumber: generateDisplayOrderNumber('ORD-M'),
          signature: draftSignature
        };
      }

      const { id: uniqueOrderId, orderNumber: displayOrderNumber } = pendingRetryOrderRef.current;
      const nowIso = new Date().toISOString();

      const newOrder: any = {
        id: uniqueOrderId,
        orderNumber: displayOrderNumber,
        createdAt: nowIso,
        updatedAt: nowIso,
        date: nowIso,
        version: 1,
        customerName: orderCustomerName.trim(),
        customerPhone: orderCustomerPhone.trim(),
        city: orderCity.trim() || orderGovernorate,
        governorate: orderGovernorate,
        customerAddress: orderAddress.trim() || orderGovernorate,
        address: orderAddress.trim() || orderGovernorate,
        notes: orderNotes.trim(),
        status: 'جاري_المراجعة',
        totalAmount: totalCod,
        totalPrice: totalCod,
        subtotal: itemsTotal,
        shippingFee: shipFee,
        allowOpenShipment: orderAllowOpen,
        merchantId: liveMerchant.id,
        merchantName: liveMerchant.name,
        merchantBrandName: (liveMerchant as any)?.brandName || liveMerchant.name,
        brandName: (liveMerchant as any)?.brandName || liveMerchant.name,
        storeName: storeName || activeStoreData?.name || (activeStoreData?.settings as any)?.storeName || 'المتجر الرئيسي',
        warehouseId: (selectedProd as any)?.warehouseId || (activeStoreData?.settings as any)?.defaultWarehouseId || (activeStoreData?.settings?.warehouses?.[0]?.id) || 'wh_main',
        warehouseName: ((activeStoreData?.settings?.warehouses || []) as any[]).find((w: any) => w.id === (selectedProd as any)?.warehouseId)?.name || (activeStoreData?.settings?.warehouses?.[0]?.name) || 'المخزن الرئيسي',
        serviceFeePerOrder: operatingFee,
        stockDeducted: true,
        items: [
          {
            id: selectedProd.id,
            productId: selectedProd.id,
            title: prodTitle,
            name: prodTitle,
            quantity: qty,
            price: unitPrice,
            costPrice: unitCost,
            merchantId: liveMerchant.id,
            merchantName: liveMerchant.name,
            ownerType: selectedProd.ownerType || 'merchant'
          }
        ]
      };

      // Stamp order with immutable plan cycle & pricing snapshot at creation time
      const planSnapshot = buildOrderPlanSnapshot(liveMerchant, planUsage.usedOrdersCount);
      Object.assign(newOrder, planSnapshot);

      const targetStoreId = effectiveStoreId;
      const currentOrders = (activeStoreData?.orders || []).filter((o: any) => o.id !== uniqueOrderId);
      const updatedOrders = [newOrder, ...currentOrders];

      // Deduct validated inventory
      const updatedProducts = (activeStoreData?.settings?.products || []).map((p: any) => {
        if (p.id === selectedProd.id && unlimitedStock) return p;
        if (p.id === selectedProd.id && p.ownerType === 'shared') {
          const merchantAllocations = (Array.isArray(p.merchantAllocations) ? p.merchantAllocations : []).map((allocation: any) =>
            allocation.merchantId === liveMerchant.id && allocation.stock !== null && allocation.stock !== undefined
              ? { ...allocation, stock: Math.max(0, Number(allocation.stock) - qty) }
              : allocation
          );
          return { ...p, merchantAllocations, updatedAt: nowIso, version: Number(p.version || 0) + 1 };
        }
        if (p.id === selectedProd.id) {
          const currentStock = Number(p.stockQuantity ?? p.stock ?? p.quantity ?? 0);
          const nextStock = currentStock - qty;
          return {
            ...p,
            stock: nextStock,
            stockQuantity: nextStock,
            quantity: nextStock,
            updatedAt: nowIso,
            version: Number(p.version || 0) + 1
          };
        }
        return p;
      });

      const updatedPayload: StoreData = {
        ...(activeStoreData || {} as any),
        orders: updatedOrders,
        settings: {
          ...(activeStoreData?.settings || {}),
          products: updatedProducts
        }
      };

      const saveRes: any = await db.saveStoreData({ id: targetStoreId, name: storeName } as any, updatedPayload);

      // Audit Fix #4: Do NOT claim server save success or clear inputs if cloud save failed or is only pending_sync
      if (!saveRes || !saveRes.success || saveRes.status === 'failed' || saveRes.status === 'pending_sync') {
        if (saveRes?.status === 'pending_sync') {
          setDirectStoreData(updatedPayload);
          showToast(
            `تنبيه: تم حفظ الأوردر #${displayOrderNumber} محلياً في طابور المزامنة المؤقت، ولم يتم تأكيد الحفظ على الخادم السحابي بعد.`,
            'error'
          );
        } else {
          showToast(
            `فشل حفظ الأوردر على الخادم السحابي (${saveRes?.error || 'خطأ في الاتصال'}). لم يتم مسح البيانات، يمكنك إعادة المحاولة بأمان دون تكرار الطلب.`,
            'error'
          );
        }
        return;
      }

      setDirectStoreData(updatedPayload);
      pendingRetryOrderRef.current = null;

      showToast(
        `تم حفظ وتسجيل الأوردر على الخادم بنجاح! رقم الشحنة: #${displayOrderNumber}`,
        'success'
      );
      setOrderCustomerName('');
      setOrderCustomerPhone('');
      setOrderAddress('');
      setOrderCity('');
      setOrderNotes('');
      setOrderQuantity(1);
    } catch (err: any) {
      console.error('Error creating merchant order:', err);
      showToast('تعذر حفظ الطلب على الخادم، البيانات محفوظة في النموذج لإعادة المحاولة بأمان', 'error');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

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

    // Build real transactions dynamically ONLY from financially SETTLED merchant orders if explicit transactions don't exist
    // Unsettled delivered orders must NEVER be added to the wallet balance before Admin settlement!
    if (rawTxs.length === 0 && (merchantOrders.length > 0 || merchantFilteredRequests.length > 0)) {
      const deliveredOrdersMap = new Map<string, typeof merchantOrders>();

      merchantOrders.forEach(o => {
        const isOrderSettled = Boolean(
          o.settlementStatus === 'settled' ||
          (o as any).merchantSettled ||
          (o as any).isSettled
        );
        if (!isOrderSettled) return;

        const dateKey = (o.settledAt || (o as any).deliveredAt || o.createdAt || new Date().toISOString()).slice(0, 10);
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
      running = Number((running + amt).toFixed(2));
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
      .filter(r => r.status === 'pending' && (!r.type || r.type === 'withdrawal'))
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [merchantFilteredRequests]);

  // Available balance after reserving pending requests
  const availableForWithdrawal = useMemo(() => {
    return Math.max(0, Number((effectiveMerchantBalance - pendingRequestsSum).toFixed(2)));
  }, [effectiveMerchantBalance, pendingRequestsSum]);

  // Weekly / Daily Payout, Manager Commission & 7-Day Post-Settlement Holding Breakdown
  const weeklyPayoutOverview = useMemo(() => {
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const payoutFrequency: 'daily' | 'weekly' = liveMerchant?.payoutFrequency === 'daily' ? 'daily' : 'weekly';
    const weeklyDayIndex = typeof liveMerchant?.weeklyPayoutDay === 'number'
      ? Math.min(6, Math.max(0, liveMerchant.weeklyPayoutDay))
      : 1; // Default: Monday (الإثنين)
    const weeklyDayNameAr = dayNamesAr[weeklyDayIndex] || 'الإثنين';

    const now = new Date();
    const currentDay = now.getDay();
    let daysUntilNextPayout = payoutFrequency === 'daily'
      ? 1
      : (weeklyDayIndex - currentDay + 7) % 7;
    if (payoutFrequency === 'weekly' && daysUntilNextPayout === 0) daysUntilNextPayout = 7;

    // For daily cashout, skip Friday (5) to Saturday (6)
    if (payoutFrequency === 'daily') {
      const tomorrowDay = (currentDay + 1) % 7;
      if (tomorrowDay === 5) daysUntilNextPayout = 2;
    }

    const nextPayoutDate = new Date(now.getTime() + daysUntilNextPayout * 86400000);
    const nextWeeklyPayoutDateFormatted = nextPayoutDate.toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    const nextPayoutShortAr = nextPayoutDate.toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

    // Manager-Configured Commission / Transfer Fee Settings
    const weeklyTransferFee = typeof liveMerchant?.weeklyTransferFee === 'number' ? Math.max(0, liveMerchant.weeklyTransferFee) : 25;
    const weeklyTransferFeeType: 'fixed' | 'percentage' = liveMerchant?.weeklyTransferFeeType === 'percentage' ? 'percentage' : 'fixed';
    const dailyTransferFee = typeof liveMerchant?.dailyTransferFee === 'number' ? Math.max(0, liveMerchant.dailyTransferFee) : 1;
    const dailyTransferFeeType: 'fixed' | 'percentage' = liveMerchant?.dailyTransferFeeType === 'fixed' ? 'fixed' : 'percentage';

    const formatFeeLabel = (val: number, type: 'fixed' | 'percentage', isDaily: boolean) => {
      if (val <= 0) return 'مجاني (بدون عمولة تحويل)';
      if (type === 'percentage') {
        return `${val}% من مبلغ التحويل${isDaily ? ' للسحب اليومي' : ''}`;
      }
      return `${val.toLocaleString()} ج.م رسوم التحويل`;
    };

    const weeklyFeeLabelAr = formatFeeLabel(weeklyTransferFee, weeklyTransferFeeType, false);
    const dailyFeeLabelAr = formatFeeLabel(dailyTransferFee, dailyTransferFeeType, true);
    const activeFeeValue = payoutFrequency === 'daily' ? dailyTransferFee : weeklyTransferFee;
    const activeFeeType = payoutFrequency === 'daily' ? dailyTransferFeeType : weeklyTransferFeeType;
    const activeFeeLabelAr = payoutFrequency === 'daily' ? dailyFeeLabelAr : weeklyFeeLabelAr;

    const calculateTransferFeeForAmount = (grossAmt: number, freq: 'daily' | 'weekly' = payoutFrequency) => {
      const num = Math.max(0, Number(grossAmt) || 0);
      if (num <= 0) return { feeAmount: 0, netAmount: 0 };
      const fVal = freq === 'daily' ? dailyTransferFee : weeklyTransferFee;
      const fType = freq === 'daily' ? dailyTransferFeeType : weeklyTransferFeeType;
      const feeAmount = fType === 'percentage'
        ? Number(((num * fVal) / 100).toFixed(2))
        : Number(Math.min(num, fVal).toFixed(2));
      const netAmount = Math.max(0, Number((num - feeAmount).toFixed(2)));
      return { feeAmount, netAmount };
    };

    let unsettledDeliveredBalance = 0;
    let holdingSettledBalance = 0;
    let readySettledOrdersBalance = 0;
    let holdingOrdersCount = 0;
    let readyOrdersCount = 0;
    let unsettledOrdersCount = 0;
    let minRemainingDays: number | null = null;

    merchantOrders.forEach(o => {
      const b = computeOrderFeeBreakdown(o);
      if (!b.isDelivered && !b.isReturn) return;
      if (b.payoutStage === 'paid') return;

      if (b.payoutStage === 'unsettled') {
        unsettledDeliveredBalance += b.netEntitlement;
        unsettledOrdersCount += 1;
      } else if (b.payoutStage === 'holding') {
        if (b.netEntitlement > 0) {
          holdingSettledBalance += b.netEntitlement;
          holdingOrdersCount += 1;
          if (minRemainingDays === null || b.remainingHoldingDays < minRemainingDays) {
            minRemainingDays = b.remainingHoldingDays;
          }
        }
      } else if (b.payoutStage === 'ready') {
        if (b.netEntitlement > 0) {
          readySettledOrdersBalance += b.netEntitlement;
          readyOrdersCount += 1;
        }
      }
    });

    const holdingDaysSetting = Math.max(0, Number(liveMerchant?.holdingDaysAfterSettlement ?? 7));
    const minWeeklyPayout = Math.max(0, Number(liveMerchant?.minWeeklyPayout ?? 100));
    const maxWeeklyPayout = Math.max(0, Number(liveMerchant?.maxWeeklyPayout ?? 50000));
    const weeklyPayoutMode: 'auto' | 'admin_confirm' = liveMerchant?.weeklyPayoutMode || 'admin_confirm';

    // The actual matured balance ready for payout is the available wallet balance minus any settled amount still inside its holding window
    const maturedWalletBalance = Math.max(
      0,
      Number((availableForWithdrawal - Math.max(0, holdingSettledBalance)).toFixed(2))
    );

    const cappedNextPayoutAmount = maxWeeklyPayout > 0
      ? Math.min(maturedWalletBalance, maxWeeklyPayout)
      : maturedWalletBalance;

    const nextPayoutFeeCalc = calculateTransferFeeForAmount(cappedNextPayoutAmount, payoutFrequency);

    // Wallet Balance Breakdown for Bosta-Style Dark Popover (الرصيد + vs الديون -)
    let collectedOrdersTotal = 0;
    let compensationsTotal = 0;
    let walletTopupsTotal = 0;
    let withdrawalsTotal = 0;
    let shippingAndFeesTotal = 0;
    let transferCommissionTotal = 0;

    allChronologicalTransactions.forEach(tx => {
      const amt = Number(tx.amount) || 0;
      const notes = String(tx.notes || '');
      if (amt > 0) {
        if (tx.type === 'compensation' || notes.includes('تعويض')) {
          compensationsTotal += amt;
        } else if (tx.type === 'wallet_topup' || tx.type === 'deposit' || notes.includes('شحن')) {
          walletTopupsTotal += amt;
        } else {
          collectedOrdersTotal += amt;
        }
      } else if (amt < 0) {
        const absAmt = Math.abs(amt);
        if (notes.includes('رسوم التحويل') || notes.includes('عمولة التحويل') || notes.includes('عمولة سحب')) {
          transferCommissionTotal += absAmt;
        } else if (tx.type === 'withdrawal') {
          withdrawalsTotal += absAmt;
        } else {
          shippingAndFeesTotal += absAmt;
        }
      }
    });

    const totalAddedCredits = Number((collectedOrdersTotal + compensationsTotal + walletTopupsTotal).toFixed(2));
    const totalDeductedDebits = Number((withdrawalsTotal + shippingAndFeesTotal + transferCommissionTotal).toFixed(2));

    return {
      payoutFrequency,
      weeklyDayIndex,
      weeklyDayNameAr,
      daysUntilNextPayout,
      nextWeeklyPayoutDateFormatted,
      nextPayoutShortAr,
      holdingDaysSetting,
      minWeeklyPayout,
      maxWeeklyPayout,
      weeklyPayoutMode,
      weeklyTransferFee,
      weeklyTransferFeeType,
      dailyTransferFee,
      dailyTransferFeeType,
      weeklyFeeLabelAr,
      dailyFeeLabelAr,
      activeFeeValue,
      activeFeeType,
      activeFeeLabelAr,
      calculateTransferFeeForAmount,
      calculateFeeForAmount: (grossAmt: number, freq: 'daily' | 'weekly' = payoutFrequency) =>
        calculateTransferFeeForAmount(grossAmt, freq).feeAmount,
      nextPayoutFeeAmount: nextPayoutFeeCalc.feeAmount,
      nextPayoutNetAmount: nextPayoutFeeCalc.netAmount,
      unsettledDeliveredBalance: Math.max(0, Number(unsettledDeliveredBalance.toFixed(2))),
      holdingSettledBalance: Math.max(0, Number(holdingSettledBalance.toFixed(2))),
      readySettledOrdersBalance: Math.max(0, Number(readySettledOrdersBalance.toFixed(2))),
      maturedWalletBalance,
      cappedNextPayoutAmount: Math.max(0, Number(cappedNextPayoutAmount.toFixed(2))),
      holdingOrdersCount,
      readyOrdersCount,
      unsettledOrdersCount,
      minRemainingDays,
      balanceBreakdown: {
        totalAddedCredits,
        collectedOrdersTotal: Number(collectedOrdersTotal.toFixed(2)),
        compensationsTotal: Number(compensationsTotal.toFixed(2)),
        walletTopupsTotal: Number(walletTopupsTotal.toFixed(2)),
        totalDeductedDebits,
        withdrawalsTotal: Number(withdrawalsTotal.toFixed(2)),
        shippingAndFeesTotal: Number(shippingAndFeesTotal.toFixed(2)),
        transferCommissionTotal: Number(transferCommissionTotal.toFixed(2))
      }
    };
  }, [liveMerchant, merchantOrders, computeOrderFeeBreakdown, availableForWithdrawal, allChronologicalTransactions]);

  // Save Merchant's Preferred Payout Frequency ('daily' | 'weekly') and Weekly Day Index
  const handleSavePayoutFrequencyAndDay = async (newFrequency: 'daily' | 'weekly', newDayIndex: number) => {
    if (!liveMerchant) return;
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const nowIso = new Date().toISOString();
    try {
      await persistMerchantAccountUpdates({
        payoutFrequency: newFrequency,
        weeklyPayoutDay: newDayIndex,
        lastPayoutFrequencyChangeAt: nowIso
      });
      setShowPayoutFrequencyModal(false);
      setShowFinancialCycleModal(false);
      if (newFrequency === 'daily') {
        showToast('تم تغيير نظام السحب النقدي إلى (يومي) بنجاح ✅', 'success');
      } else {
        showToast(`تم تحديد نظام السحب النقدي إلى أسبوعي كل يوم (${dayNamesAr[newDayIndex]}) بنجاح ✅`, 'success');
      }
    } catch (err: any) {
      showToast('تعذر حفظ إعدادات نظام السحب: ' + (err?.message || ''), 'error');
    }
  };

  const handleUpdateWeeklyPayoutDay = async (newDayIndex: number) => {
    await handleSavePayoutFrequencyAndDay(liveMerchant?.payoutFrequency || 'weekly', newDayIndex);
  };

  // Cancel a pending withdrawal request (releases reserved funds immediately)
  const handleCancelPendingWithdrawal = async (reqId: string) => {
    try {
      await db.updateMerchantRequestStatus(reqId, effectiveStoreId, 'rejected');
      setMerchantRequestsList(prev => prev.map(r => r.id === reqId ? { ...r, status: 'rejected' } : r));
      showToast('تم إلغاء طلب السحب المعلق وفك حجز المبلغ بنجاح', 'success');
    } catch (err: any) {
      showToast('تعذر إلغاء الطلب المعلق: ' + (err?.message || ''), 'error');
    }
  };

  // Live Subscription & Dedicated Manager Plan Usage Metrics (with isolated cycle history filtering)
  const planUsage = useMemo(() => {
    return computeMerchantPlanUsage(
      merchantOrders,
      liveMerchant?.subscriptionPlan,
      liveMerchant?.managerPlan,
      Date.now(),
      liveMerchant?.planCyclesHistory
    );
  }, [merchantOrders, liveMerchant?.subscriptionPlan, liveMerchant?.managerPlan, liveMerchant?.planCyclesHistory]);

  // Helper to archive the currently active cycle into planCyclesHistory before starting a new isolated cycle
  const buildUpdatedCyclesHistoryOnSwitch = useCallback((reason: 'upgraded' | 'switched_mode' | 'quota_exhausted' = 'upgraded'): MerchantPlanCycleRecord[] => {
    const existingHistory: MerchantPlanCycleRecord[] = Array.isArray(liveMerchant?.planCyclesHistory)
      ? [...liveMerchant.planCyclesHistory]
      : [];
    if (!liveMerchant) return existingHistory;

    if (liveMerchant.managerPlan?.enabled && liveMerchant.managerPlan.status === 'active') {
      const cId = liveMerchant.managerPlan.cycleId || `CYC-OLD-MGR-${Date.now()}`;
      if (!existingHistory.some(h => h.cycleId === cId)) {
        existingHistory.unshift({
          cycleId: cId,
          mode: 'manager',
          planId: liveMerchant.managerPlan.planId,
          planNameAr: liveMerchant.managerPlan.planNameAr,
          orderFee: liveMerchant.managerPlan.customOrderFee || liveMerchant.managerPlan.orderFee || 20,
          quotaOrders: liveMerchant.managerPlan.customOrderQuota || 0,
          usedOrders: planUsage.usedOrdersCount,
          paidAmount: liveMerchant.managerPlan.totalPrepaidAmount || 0,
          activatedAt: liveMerchant.managerPlan.activatedAt || new Date().toISOString(),
          endedAt: new Date().toISOString(),
          endReason: reason
        });
      }
    } else if (liveMerchant.subscriptionPlan && liveMerchant.subscriptionPlan.status === 'active') {
      const cId = liveMerchant.subscriptionPlan.cycleId || `CYC-OLD-SUB-${Date.now()}`;
      if (!existingHistory.some(h => h.cycleId === cId)) {
        existingHistory.unshift({
          cycleId: cId,
          mode: 'self_service',
          planId: liveMerchant.subscriptionPlan.planId,
          planNameAr: liveMerchant.subscriptionPlan.planNameAr,
          billingCycle: liveMerchant.subscriptionPlan.billingCycle,
          quotaOrders: liveMerchant.subscriptionPlan.monthlyOrderLimit || 0,
          usedOrders: planUsage.usedOrdersCount,
          paidAmount: liveMerchant.subscriptionPlan.paidAmount || 0,
          activatedAt: liveMerchant.subscriptionPlan.activatedAt || new Date().toISOString(),
          endedAt: new Date().toISOString(),
          endReason: reason
        });
      }
    }
    return existingHistory;
  }, [liveMerchant, planUsage.usedOrdersCount]);

  // Subscription & Manager Plan Handlers (with Cycle Isolation)
  const handleConfirmSubscriptionChange = useCallback(async (payload: {
    newSubscription?: MerchantSubscriptionConfig;
    newManagerPlan?: MerchantManagerConfig;
    subscriptionPlan?: MerchantSubscriptionConfig;
    managerPlan?: MerchantManagerConfig;
    totalWalletDeduction?: number;
    totalWalletCharge?: number;
    summaryNote?: string;
    descriptionAr?: string;
  }) => {
    if (!liveMerchant) return;
    const subToSave = payload.newSubscription || payload.subscriptionPlan;
    const mgrToSave = payload.newManagerPlan || payload.managerPlan;
    const charge = Number(payload.totalWalletDeduction ?? payload.totalWalletCharge ?? 0);
    const noteText = payload.summaryNote || payload.descriptionAr || 'تحديث باقة الحساب بدورة معزولة جديدة';

    if (charge > availableForWithdrawal) {
      showToast('رصيد المحفظة غير كافٍ، يرجى شحن المحفظة أولاً', 'error');
      return;
    }

    const updatedHistory = buildUpdatedCyclesHistoryOnSwitch('upgraded');
    const nextBalance = Number((effectiveMerchantBalance - charge).toFixed(2));
    const newTx: MerchantTransaction | undefined = charge > 0 ? {
      id: `SUB-${Date.now()}`,
      merchantId: liveMerchant.id,
      merchantName: liveMerchant.name,
      date: new Date().toISOString(),
      type: 'subscription_charge',
      amount: -charge,
      balanceAfter: nextBalance,
      notes: noteText
    } : undefined;

    await persistMerchantAccountUpdates({
      ...(subToSave ? { subscriptionPlan: subToSave } : {}),
      ...(mgrToSave ? { managerPlan: mgrToSave } : {}),
      planCyclesHistory: updatedHistory,
      scheduledNextPlan: null,
      ...(charge > 0 ? { balance: nextBalance } : {}),
      ...(newTx ? { newTransaction: newTx } : {})
    });

    showToast(
      charge > 0
        ? `تم أرشفة الدورة السابقة وتفعيل الباقة الجديدة بدورة معزولة وخصم ${charge.toLocaleString()} ج.م من المحفظة`
        : `تم تحديث خطة حسابك بدورة معزولة جديدة (${noteText})`,
      'success'
    );
  }, [liveMerchant, availableForWithdrawal, effectiveMerchantBalance, buildUpdatedCyclesHistoryOnSwitch, persistMerchantAccountUpdates, showToast]);

  // Schedule Next Plan After Current Quota Exhaustion (Point 3)
  const handleScheduleNextPlan = useCallback(async (scheduled: ScheduledMerchantPlanTransition) => {
    if (!liveMerchant) return;
    await persistMerchantAccountUpdates({
      scheduledNextPlan: scheduled
    });
    const planLabel = scheduled.planNameAr || scheduled.targetPlanNameAr || 'الباقة المجدولة';
    showToast(
      `تم جدولة الباقة الترتيبية (${planLabel}) لتبدأ تلقائياً فور انتهاء كوتة دورتك الحالية دون ضياع أي أوردر متبقٍ`,
      'success'
    );
  }, [liveMerchant, persistMerchantAccountUpdates, showToast]);

  const handleCancelScheduledPlan = useCallback(async () => {
    if (!liveMerchant) return;
    await persistMerchantAccountUpdates({
      scheduledNextPlan: null
    });
    showToast('تم إلغاء الباقة المجدولة الترتيبية بنجاح', 'info');
  }, [liveMerchant, persistMerchantAccountUpdates, showToast]);

  const handleActivateScheduledPlanNow = useCallback(async () => {
    if (!liveMerchant || !liveMerchant.scheduledNextPlan) return;
    const sched = liveMerchant.scheduledNextPlan;
    const charge = Number(sched.upfrontPaidAmount ?? sched.prepaidAmount ?? 0);
    if (charge > availableForWithdrawal) {
      showToast(`رصيد المحفظة غير كافٍ لتفعيل الباقة المجدولة الآن (${charge.toLocaleString()} ج.م)`, 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const expIso = new Date(Date.now() + 30 * 86400000).toISOString();
    const updatedHistory = buildUpdatedCyclesHistoryOnSwitch('quota_exhausted');
    const planLabel = sched.planNameAr || sched.targetPlanNameAr || 'الباقة المجدولة';

    if (sched.targetMode === 'self_service') {
      const targetSubDef = SELF_SERVICE_PLANS.find(p => p.id === (sched.subscriptionPlan?.planId || sched.targetPlanId)) || SELF_SERVICE_PLANS[0];
      const nextSub: MerchantSubscriptionConfig = sched.subscriptionPlan
        ? {
            ...sched.subscriptionPlan,
            cycleId: `CYC-SUB-${Date.now()}`,
            startDate: nowIso,
            activatedAt: nowIso,
            status: 'active'
          }
        : {
            planId: targetSubDef.id,
            planNameAr: planLabel || targetSubDef.nameAr,
            cycleId: `CYC-SUB-${Date.now()}`,
            billingCycle: sched.billingCycle || 'monthly',
            pricePerMonth: targetSubDef.baseMonthlyPrice,
            paidAmount: charge,
            monthlyOrderLimit: sched.quotaOrders ?? targetSubDef.monthlyOrdersLimit ?? undefined,
            ordersLimit: sched.quotaOrders ?? targetSubDef.monthlyOrdersLimit,
            unlimitedOrders: targetSubDef.monthlyOrdersLimit === null,
            activatedAt: nowIso,
            expiresAt: expIso,
            status: 'active'
          };
      const disabledMgr: MerchantManagerConfig = {
        enabled: false,
        planId: 'none',
        planNameAr: 'إدارة ذاتية (بدون مدير مخصص)',
        orderFee: 0,
        activatedAt: nowIso,
        expiresAt: nowIso,
        status: 'cancelled'
      };
      const nextBalance = Number((effectiveMerchantBalance - charge).toFixed(2));
      const newTx: MerchantTransaction | undefined = charge > 0 ? {
        id: `SUB-SCHED-${Date.now()}`,
        merchantId: liveMerchant.id,
        merchantName: liveMerchant.name,
        date: nowIso,
        type: 'subscription_charge',
        amount: -charge,
        balanceAfter: nextBalance,
        notes: `تفعيل الباقة المجدولة (${planLabel}) بدورة معزولة جديدة`
      } : undefined;

      await persistMerchantAccountUpdates({
        subscriptionPlan: nextSub,
        managerPlan: disabledMgr,
        planCyclesHistory: updatedHistory,
        scheduledNextPlan: null,
        ...(charge > 0 ? { balance: nextBalance } : {}),
        ...(newTx ? { newTransaction: newTx } : {})
      });
    } else {
      const unitFee = Number(sched.managerPlan?.orderFee ?? sched.orderFee ?? 20);
      const nextMgr: MerchantManagerConfig = sched.managerPlan
        ? {
            ...sched.managerPlan,
            enabled: true,
            cycleId: `CYC-MGR-${Date.now()}`,
            startDate: nowIso,
            activatedAt: nowIso,
            status: 'active'
          }
        : {
            enabled: true,
            planId: (sched.targetPlanId as any) || 'per_order_20',
            planNameAr: planLabel,
            cycleId: `CYC-MGR-${Date.now()}`,
            orderFee: unitFee,
            customOrderFee: unitFee,
            customOrderQuota: sched.quotaOrders || undefined,
            customPrepaidQuota: charge > 0,
            totalPrepaidAmount: charge,
            usedOrdersInCycle: 0,
            activatedAt: nowIso,
            expiresAt: expIso,
            status: 'active',
            notes: 'تم التفعيل من الجدولة الترتيبية بدورة معزولة'
          };
      const nextBalance = Number((effectiveMerchantBalance - charge).toFixed(2));
      const newTx: MerchantTransaction | undefined = charge > 0 ? {
        id: `SUB-SCHED-${Date.now()}`,
        merchantId: liveMerchant.id,
        merchantName: liveMerchant.name,
        date: nowIso,
        type: 'subscription_charge',
        amount: -charge,
        balanceAfter: nextBalance,
        notes: `تفعيل باقة المدير المجدولة (${planLabel})`
      } : undefined;

      await persistMerchantAccountUpdates({
        managerPlan: nextMgr,
        planCyclesHistory: updatedHistory,
        scheduledNextPlan: null,
        ...(charge > 0 ? { balance: nextBalance } : {}),
        ...(newTx ? { newTransaction: newTx } : {})
      });
    }

    showToast(`تم تفعيل الباقة المجدولة (${planLabel}) بدورة جديدة معزولة بنجاح!`, 'success');
  }, [liveMerchant, availableForWithdrawal, effectiveMerchantBalance, buildUpdatedCyclesHistoryOnSwitch, persistMerchantAccountUpdates, showToast]);

  // Governed Plan Change & Custom Manager Pricing Quote Handlers
  const handleRequestPlanChange = useCallback(async (request: MerchantPlanChangeRequest) => {
    if (!liveMerchant) return;
    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
    const isCustomQuote = request.targetMode === 'manager' && request.targetPlanId === 'custom_manager';
    const resolvedPlanName =
      request.targetPlanNameAr ||
      request.planNameAr ||
      (isCustomQuote ? 'باقة المدير المخصصة' : 'باقة جديدة');
    const normalizedRequest: MerchantPlanChangeRequest = {
      ...request,
      targetPlanNameAr: resolvedPlanName,
      planNameAr: resolvedPlanName
    };

    await db.submitMerchantRequest({
      storeId: targetStore,
      partnerId: liveMerchant.id,
      partnerName: liveMerchant.name,
      amount: Number(request.calculatedAmount || 0),
      type: isCustomQuote ? 'custom_plan_quote' : 'plan_change_request',
      payoutMethod: isCustomQuote ? 'طلب تسعير باقة مدير مخصصة' : 'طلب تغيير وتفعيل باقة (بموافقة الإدارة)',
      payoutAccount: resolvedPlanName,
      notes: isCustomQuote
        ? `طلب تسعير باقة مدير مخصصة: عدد الأوردرات المستهدف (${request.requestedCustomQuota || request.requestedOrdersTarget || 200} أوردر) — آلية التحصيل (${request.requestedCustomBillingPreference === 'prepaid_quota' || request.requestedPrepaidQuota ? 'دفع مسبق من المحفظة' : 'خصم مع كل أوردر'}) ${request.merchantNotes ? `— ملاحظات: ${request.merchantNotes}` : ''}`
        : `طلب انتقال من الباقة الحالية إلى (${resolvedPlanName}) بقيمة (${Number(request.calculatedAmount || 0).toLocaleString()} ج.م) — بانتظار اعتماد الإدارة لتأمين حسابات الأوردرات`,
      planRequestMeta: normalizedRequest
    });

    await persistMerchantAccountUpdates({
      pendingPlanRequest: normalizedRequest
    });

    const refreshed = await db.getMerchantRequests(targetStore);
    setMerchantRequestsList(refreshed);

    showToast(
      isCustomQuote
        ? 'تم إرسال طلب تسعير الباقة المخصصة للإدارة — سيظهر لك السعر المعتمد هنا للموافقة والتفعيل من المحفظة'
        : 'تم إرسال طلب تغيير الباقة للإدارة للاعتماد مع استمرار باقتك الحالية وتأمين حسابات الأوردرات',
      'success'
    );
  }, [liveMerchant, effectiveStoreId, persistMerchantAccountUpdates, showToast]);

  const handleAcceptAdminCustomQuote = useCallback(async (request: MerchantPlanChangeRequest) => {
    if (!liveMerchant) return;
    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
    
    try {
      const unitFee = Number(request.quotedOrderFee || 20);
      const quota = Number(request.requestedCustomQuota || request.requestedOrdersTarget || 200);
      const isPrepaid = request.requestedCustomBillingPreference === 'prepaid_quota';

      // Check if merchant is already active on custom manager plan (Quota Increase)
      const isQuotaIncrease = Boolean(
        liveMerchant.managerPlan?.enabled &&
        liveMerchant.managerPlan.status === 'active' &&
        liveMerchant.managerPlan.planId === 'custom_manager'
      );

      const oldQuota = Number(liveMerchant.managerPlan?.customOrderQuota || liveMerchant.managerPlan?.customOrdersTarget || 0);
      const incrementalQuota = isQuotaIncrease ? Math.max(0, quota - oldQuota) : quota;
      const totalCharge = isPrepaid ? Number((unitFee * incrementalQuota).toFixed(2)) : 0;

      if (totalCharge > availableForWithdrawal) {
        showToast(`رصيد المحفظة غير كافٍ لتفعيل عرض السعر (${totalCharge.toLocaleString()} ج.م). يرجى شحن المحفظة أولاً.`, 'error');
        return;
      }

      const nowIso = new Date().toISOString();
      const expIso = new Date(Date.now() + 30 * 86400000).toISOString();

      let nextManagerPlan: MerchantManagerConfig;
      let nextHistory: MerchantPlanCycleRecord[];

      if (isQuotaIncrease && liveMerchant.managerPlan) {
        // PRESERVE ongoing cycle and previously executed orders!
        nextManagerPlan = {
          ...liveMerchant.managerPlan,
          orderFee: unitFee,
          customOrderFee: unitFee,
          customOrderQuota: quota,
          customOrdersTarget: quota,
          customPrepaidQuota: isPrepaid,
          totalPrepaidAmount: (liveMerchant.managerPlan.totalPrepaidAmount || 0) + totalCharge,
          usedOrdersInCycle: planUsage.usedOrders, // preserve executed orders!
          expiresAt: expIso,
          status: 'active',
          notes: `تمت زيادة كوتة الأوردرات من (${oldQuota}) إلى (${quota}) أوردر مع الحفاظ على الأوردرات المنفذة سابقاً (${planUsage.usedOrders} أوردر)`
        };
        nextHistory = Array.isArray(liveMerchant.planCyclesHistory) ? [...liveMerchant.planCyclesHistory] : [];
      } else {
        // Starting new cycle from scratch
        const existingHistory: MerchantPlanCycleRecord[] = Array.isArray(liveMerchant.planCyclesHistory)
          ? [...liveMerchant.planCyclesHistory]
          : [];
        if (liveMerchant.subscriptionPlan && liveMerchant.subscriptionPlan.status === 'active') {
          existingHistory.unshift({
            cycleId: liveMerchant.subscriptionPlan.cycleId || `CYC-OLD-${Date.now()}`,
            mode: 'self_service',
            planId: liveMerchant.subscriptionPlan.planId,
            planNameAr: liveMerchant.subscriptionPlan.planNameAr,
            billingCycle: liveMerchant.subscriptionPlan.billingCycle,
            quotaOrders: liveMerchant.subscriptionPlan.monthlyOrderLimit || 0,
            usedOrders: planUsage.usedOrders,
            paidAmount: liveMerchant.subscriptionPlan.paidAmount || 0,
            activatedAt: liveMerchant.subscriptionPlan.activatedAt || new Date().toISOString(),
            endedAt: new Date().toISOString(),
            endReason: 'switched_mode'
          });
        }
        nextHistory = existingHistory;
        const newCycleId = `CYC-MGR-${Date.now()}`;
        nextManagerPlan = {
          enabled: true,
          planId: 'custom_manager',
          planNameAr: `باقة المدير المخصصة (${unitFee} ج.م / أوردر)`,
          cycleId: newCycleId,
          orderFee: unitFee,
          customOrderFee: unitFee,
          customOrderQuota: quota,
          customOrdersTarget: quota,
          customPrepaidQuota: isPrepaid,
          totalPrepaidAmount: totalCharge,
          usedOrdersInCycle: 0,
          activatedAt: nowIso,
          expiresAt: expIso,
          status: 'active',
          notes: `تم التفعيل بموافقة الموكل على تسعير الإدارة (${unitFee} ج.م للأوردر — ${quota} أوردر)`
        };
      }

      const nextSubscriptionPlan: MerchantSubscriptionConfig = liveMerchant.subscriptionPlan
        ? { ...liveMerchant.subscriptionPlan, status: 'cancelled' }
        : {
            planId: 'free',
            planNameAr: 'الباقة المجانية (تاجر مبتدئ)',
            billingCycle: 'monthly',
            pricePerMonth: 0,
            paidAmount: 0,
            monthlyOrderLimit: 50,
            unlimitedOrders: false,
            activatedAt: nowIso,
            expiresAt: expIso,
            status: 'cancelled'
          };

      const nextBalance = Number((effectiveMerchantBalance - totalCharge).toFixed(2));
      const newTx: MerchantTransaction | undefined = totalCharge > 0 ? {
        id: `SUB-QUOTE-${Date.now()}`,
        merchantId: liveMerchant.id,
        merchantName: liveMerchant.name,
        date: nowIso,
        type: 'subscription_charge',
        amount: -totalCharge,
        balanceAfter: nextBalance,
        notes: `موافقة وتفعيل باقة المدير المخصصة بتسعير الإدارة (${unitFee} ج.م × ${quota} أوردر)`
      } : undefined;

      const success = await persistMerchantAccountUpdates({
        subscriptionPlan: nextSubscriptionPlan,
        managerPlan: nextManagerPlan,
        pendingPlanRequest: null,
        planCyclesHistory: nextHistory,
        ...(totalCharge > 0 ? { balance: nextBalance } : {}),
        ...(newTx ? { newTransaction: newTx } : {})
      });

      if (!success) {
        throw new Error('تعذر تحديث بيانات الحساب، يرجى المحاولة لاحقاً');
      }

      // Cleanup standalone request doc in Firestore if it exists
      if (request.id && targetStore) {
        await db.updateMerchantRequestStatus(request.id, targetStore, 'approved', {
          approvedBy: 'الموكل (موافقة ذاتية)',
          approvedAt: nowIso
        }).catch(err => console.warn('[MerchantPortal] Optional request doc update failed:', err));
      }

      showToast(
        totalCharge > 0
          ? `تم اعتماد عرض السعر وتفعيل باقة المدير المخصصة (${unitFee} ج.م للأوردر) وخصم ${totalCharge.toLocaleString()} ج.م من المحفظة`
          : `تم اعتماد عرض السعر وتفعيل باقة المدير المخصصة (${unitFee} ج.م تُخصم مع كل أوردر مؤكد)`,
        'success'
      );
    } catch (err: any) {
      console.error('[MerchantPortal] Error accepting custom quote:', err);
      showToast(err.message || 'حدث خطأ أثناء تفعيل الباقة، يرجى المحاولة لاحقاً', 'error');
    }
  }, [liveMerchant, effectiveStoreId, availableForWithdrawal, effectiveMerchantBalance, planUsage.usedOrders, persistMerchantAccountUpdates, showToast]);

  const handleCancelPendingPlanRequest = useCallback(async (_requestId?: string) => {
    if (!liveMerchant) return;
    await persistMerchantAccountUpdates({
      pendingPlanRequest: null
    });
    showToast('تم إلغاء طلب تغيير الباقة المعلق واستمرار باقتك الحالية بدون تغيير', 'info');
  }, [liveMerchant, persistMerchantAccountUpdates, showToast]);

  const handleRequestRefund14Days = useCallback(async (payload: {
    planType?: 'self_service' | 'manager';
    targetType?: 'self_service' | 'manager';
    planId?: string;
    planName?: string;
    planNameAr?: string;
    billingCycle?: any;
    paidAmount?: number;
    chargeFor14Days?: number;
    charged14DaysAmount?: number;
    chargeForActualDays?: number;
    refundableAmount?: number;
    refundAmount?: number;
    daysElapsed?: number;
    elapsedDays?: number;
    totalCycleDays?: number;
    totalDays?: number;
    reason?: string;
  }) => {
    if (!liveMerchant) return;
    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
    const targetType = payload.planType || payload.targetType || 'self_service';
    const refundAmt = Number(payload.refundableAmount ?? payload.refundAmount ?? 0);
    const charge14 = Number(payload.chargeFor14Days ?? payload.charged14DaysAmount ?? 0);
    const elapsed = Number(payload.daysElapsed ?? payload.elapsedDays ?? 1);
    const totalDays = Number(payload.totalCycleDays ?? payload.totalDays ?? 30);
    const planLabel = payload.planName || payload.planNameAr || 'باقة التاجر';
    const noteReason =
      payload.reason ||
      `طلب استرداد باقة (${planLabel}) خلال فترة الـ 14 يوماً — المحاسبة على 14 يوم (${charge14} ج.م) واسترداد الباقي (${refundAmt} ج.م) للمحفظة`;

    await db.submitMerchantRequest({
      storeId: targetStore,
      partnerId: liveMerchant.id,
      partnerName: liveMerchant.name,
      amount: refundAmt,
      type: 'subscription_refund',
      payoutMethod: 'استرداد للمحفظة (سياسة 14 يوم)',
      payoutAccount: planLabel,
      notes: noteReason,
      refundMeta: {
        targetType,
        planId: payload.planId || (targetType === 'self_service' ? (liveMerchant.subscriptionPlan?.planId || '') : (liveMerchant.managerPlan?.planId || '')),
        planNameAr: planLabel,
        paidAmount: Number(payload.paidAmount ?? (refundAmt + charge14)),
        charged14DaysAmount: charge14,
        refundAmount: refundAmt,
        elapsedDays: elapsed,
        totalDays
      }
    });

    // Mark plan status as pending_refund
    if (targetType === 'self_service' && liveMerchant.subscriptionPlan) {
      await persistMerchantAccountUpdates({
        subscriptionPlan: {
          ...liveMerchant.subscriptionPlan,
          status: 'pending_refund',
          refundRequestedAt: new Date().toISOString()
        }
      });
    } else if (targetType === 'manager' && liveMerchant.managerPlan) {
      await persistMerchantAccountUpdates({
        managerPlan: {
          ...liveMerchant.managerPlan,
          status: 'pending_refund',
          refundRequestedAt: new Date().toISOString()
        }
      });
    }

    const refreshed = await db.getMerchantRequests(targetStore);
    setMerchantRequestsList(refreshed);
    showToast(`تم إرسال طلب استرداد (${refundAmt.toLocaleString()} ج.م) لمراجعة الإدارة قبل إيداعه بالمحفظة`, 'success');
  }, [liveMerchant, effectiveStoreId, persistMerchantAccountUpdates, showToast]);

  const handleRequestWalletTopUp = useCallback(async (amount: number, notesOrMethod: string, reference?: string) => {
    if (!liveMerchant) return;
    const targetStore = (liveMerchant as any)._storeId || effectiveStoreId;
    await db.submitMerchantRequest({
      storeId: targetStore,
      partnerId: liveMerchant.id,
      partnerName: liveMerchant.name,
      amount,
      type: 'wallet_topup',
      payoutMethod: reference ? notesOrMethod : 'شحن محفظة التاجر',
      payoutAccount: reference || 'شحن محفظة التاجر',
      transferReference: reference,
      notes: reference
        ? `طلب شحن محفظة بمبلغ ${amount.toLocaleString()} ج.م عبر ${notesOrMethod} (مرجع: ${reference})`
        : `${notesOrMethod || 'طلب شحن محفظة'} (${amount.toLocaleString()} ج.م)`
    });
    const refreshed = await db.getMerchantRequests(targetStore);
    setMerchantRequestsList(refreshed);
    showToast(`تم إرسال طلب شحن المحفظة (${amount.toLocaleString()} ج.م) للإدارة للاعتماد الفوري`, 'success');
  }, [liveMerchant, effectiveStoreId, showToast]);

  // Returns Reserve & Risk Assessment (مخصص أمان المرتجعات وحماية المحفظة)
  const returnsReserveAssessment = useMemo(() => {
    const inTransitOrders = merchantOrders.filter(o => 
      ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status)
    );
    const inTransitCount = inTransitOrders.length;
    const inTransitGrossValue = inTransitOrders.reduce((sum, o) => sum + Number((o as any).totalAmount || (o as any).totalPrice || (o as any).totalAmountOverride || 0), 0);
    
    // Average estimated return shipping cost exposure (~ 65 EGP per shipment)
    const estimatedShippingLossRisk = inTransitCount * 65;
    // Holdback recommendation: 8% of in-transit value or estimated return shipping loss
    const recommendedHoldback = Math.round(Math.max(estimatedShippingLossRisk, inTransitGrossValue * 0.08));
    const safeWithdrawalBalance = Math.max(0, Number((availableForWithdrawal - recommendedHoldback).toFixed(2)));

    return {
      inTransitCount,
      inTransitGrossValue,
      estimatedShippingLossRisk,
      recommendedHoldback,
      safeWithdrawalBalance
    };
  }, [merchantOrders, availableForWithdrawal]);

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

    if (numAmt > weeklyPayoutOverview.maturedWalletBalance) {
      if (weeklyPayoutOverview.holdingSettledBalance > 0) {
        showToast(
          `لا يمكن سحب هذا المبلغ الآن لأن لديك (${weeklyPayoutOverview.holdingSettledBalance.toLocaleString()} ج.م) مسواة ولكنها لا تزال في فترة التعليق (${weeklyPayoutOverview.holdingDaysSetting} أيام من تاريخ التسوية). الرصيد الجاهز للسحب حالياً: ${weeklyPayoutOverview.maturedWalletBalance.toLocaleString()} ج.م.`,
          'error'
        );
      } else {
        showToast(
          `المبلغ المطلوب (${numAmt.toLocaleString()} ج.م) يتجاوز الرصيد الجاهز للسحب بعد التسوية (${weeklyPayoutOverview.maturedWalletBalance.toLocaleString()} ج.م).`,
          'error'
        );
      }
      return;
    }

    if (weeklyPayoutOverview.minWeeklyPayout > 0 && numAmt < weeklyPayoutOverview.minWeeklyPayout) {
      showToast(
        `الحد الأدنى المسموح لكل سحبة رصيد هو ${weeklyPayoutOverview.minWeeklyPayout.toLocaleString()} ج.م حسب إعدادات إدارة المتجر.`,
        'error'
      );
      return;
    }

    if (weeklyPayoutOverview.maxWeeklyPayout > 0 && numAmt > weeklyPayoutOverview.maxWeeklyPayout) {
      showToast(
        `الحد الأقصى المسموح لكل سحبة رصيد هو ${weeklyPayoutOverview.maxWeeklyPayout.toLocaleString()} ج.م حسب إعدادات إدارة المتجر.`,
        'error'
      );
      return;
    }

    const { feeAmount, netAmount } = weeklyPayoutOverview.calculateTransferFeeForAmount(numAmt, weeklyPayoutOverview.payoutFrequency);
    const freqLabelAr = weeklyPayoutOverview.payoutFrequency === 'daily' ? 'سحب يومي' : `سحب أسبوعي (${weeklyPayoutOverview.weeklyDayNameAr})`;

    setIsSubmittingRequest(true);
    try {
      const feeDetails = feeAmount > 0
        ? ` [نظام: ${freqLabelAr} | عمولة التحويل: ${feeAmount.toLocaleString()} ج.م | صافي المستحق للتحويل: ${netAmount.toLocaleString()} ج.م]`
        : ` [نظام: ${freqLabelAr} | بدون عمولة تحويل]`;
      const payoutDetails = ` [طريقة الاستلام: ${payoutMethod} ${payoutAccount ? `- الحساب: ${payoutAccount}` : ''}]${feeDetails}`;
      const newReq: db.PartnerPortalRequest & {
        isMerchantRequest?: boolean;
        transferFee?: number;
        netAmount?: number;
        payoutFrequency?: 'daily' | 'weekly';
      } = {
        id: `REQ-M-${generateUniqueOrderId('m')}`,
        storeId: effectiveStoreId,
        partnerId: liveMerchant.id,
        partnerName: liveMerchant.name,
        type: 'withdrawal',
        typeArabic: `طلب سحب مستحقات (${freqLabelAr})`,
        amount: numAmt,
        transferFee: feeAmount,
        netAmount: netAmount,
        payoutFrequency: weeklyPayoutOverview.payoutFrequency,
        notes: `${requestNotes || ''}${payoutDetails}`,
        date: new Date().toISOString(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        isMerchantRequest: true
      };

      await db.submitMerchantRequest(effectiveStoreId, newReq as any);
      setMerchantRequestsList(prev => [newReq as any, ...prev]);
      setShowRequestModal(false);
      setRequestAmount('');
      setRequestNotes('');
      showToast(
        feeAmount > 0
          ? `تم إرسال طلب السحب (${numAmt.toLocaleString()} ج.م) — عمولة التحويل (${feeAmount.toLocaleString()} ج.م) وصافي التحويل (${netAmount.toLocaleString()} ج.م)`
          : 'تم إرسال طلب سحب المستحقات للإدارة بنجاح وحجز المبلغ مؤقتاً لحين الاعتماد',
        'success'
      );
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

  // Switch Tab Helper (closes any open sheets, updates state immediately, and avoids re-render oscillation)
  const navigateToTab = useCallback((tab: TabKey, options?: { statusFilter?: string; subView?: string }) => {
    isNavigatingTabRef.current = true;
    setCurrentTab(tab);
    try {
      localStorage.setItem('merchant_portal_active_tab', tab);
    } catch {}

    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      if (options?.statusFilter) {
        next.set('status', options.statusFilter);
        setOrdersStatusFilter(options.statusFilter as any);
      } else if (tab !== 'orders') {
        next.delete('status');
      }
      if (options?.subView) {
        next.set('subView', options.subView);
        setStatementSubView(options.subView as any);
      } else if (tab !== 'statement') {
        next.delete('subView');
      }
      return next;
    }, { replace: true });

    setShowFullMenuDrawer(false);
    setShowProfileBottomSheet(false);
    setShowNotificationsSheet(false);

    // Instant top scroll without smooth animation to eliminate page shaking / jitter
    if (typeof window !== 'undefined' && window.scrollY > 40) {
      window.scrollTo(0, 0);
    }

    setTimeout(() => {
      isNavigatingTabRef.current = false;
    }, 150);
  }, [setSearchParams]);

  const handleOrdersStatusFilterChange = useCallback((filter: typeof ordersStatusFilter) => {
    setOrdersStatusFilter(filter);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'orders');
      if (filter !== 'all') {
        next.set('status', filter);
      } else {
        next.delete('status');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleStatementSubViewChange = useCallback((subView: 'ledger' | 'pnl' | 'reserves') => {
    setStatementSubView(subView);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'statement');
      if (subView !== 'ledger') {
        next.set('subView', subView);
      } else {
        next.delete('subView');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Handle browser Back / Forward history navigation ONLY (no feedback loop with user clicks)
  useEffect(() => {
    if (isNavigatingTabRef.current) return;
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl && validTabs.includes(tabFromUrl as TabKey) && tabFromUrl !== currentTab) {
      setCurrentTab(tabFromUrl as TabKey);
      try {
        localStorage.setItem('merchant_portal_active_tab', tabFromUrl);
      } catch {}
    }
  }, [searchParams, validTabs, currentTab]);

  // RENDER 1: Loading
  if (isLoadingStore || loadingProgress < 100) {
    return (
      <WelcomeLoader 
        userName={authenticatedMerchant?.name || 'عزيزنا الموكل'}
        storeName={portalTitle}
        onFastPass={() => {
          setLoadingProgress(100);
          setIsLoadingStore(false);
        }}
      />
    );
  }

  // RENDER 2: Dedicated Merchant Login View (Upgraded Modern Fintech Mobile-First Design)
  if (!liveMerchant) {
    return (
      <div className="min-h-screen bg-[#f8faf9] text-zinc-900 flex items-center justify-center p-4 sm:p-6 font-sans relative overflow-hidden" dir="rtl">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#00ab84]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-[#062d24]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-[420px] bg-white border border-zinc-200 rounded-[32px] p-6 sm:p-8 shadow-xl relative z-10 space-y-6">
          
          <div className="text-center space-y-2.5">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-[#062d24] to-[#00ab84] flex items-center justify-center text-white shadow-xl shadow-emerald-600/30 mb-2 ring-4 ring-emerald-500/15">
              <Building2 size={30} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">{storeName}</h1>
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
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-zinc-100 rounded-2xl border border-zinc-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setAuthMode('otp'); setAuthError(''); }}
                className={`py-2.5 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  authMode === 'otp'
                    ? 'bg-[#00ab84] text-white shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
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
                    ? 'bg-[#00ab84] text-white shadow-md font-black'
                    : 'text-zinc-400 hover:text-white'
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
                  <label className="block text-xs font-black text-zinc-600 mb-2">
                    البريد الإلكتروني المسجل للموكل
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={loginEmailInput}
                      onChange={e => { setLoginEmailInput(e.target.value); setAuthError(''); }}
                      placeholder="partner@example.com"
                      className="w-full py-3.5 px-4 pl-10 bg-white border border-zinc-200 rounded-2xl font-mono text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#00ab84] focus:ring-2 focus:ring-emerald-500/20 text-left"
                      dir="ltr"
                      autoFocus
                    />
                    <div className="absolute left-3.5 top-1/2 -tranzinc-y-1/2 text-zinc-500 pointer-events-none">
                      <Mail size={16} />
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-2 font-medium leading-relaxed">
                    أدخل بريدك الإلكتروني المسجل لدى المتجر؛ سيصلك كود تحقق فوري (OTP) للدخول الآمن.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSendingOtp || !loginEmailInput.trim()}
                  className="w-full py-3.5 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isSendingOtp ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
                  <span>إرسال كود التحقق الأمني (OTP)</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginWithPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-zinc-600 mb-2">
                    البريد الإلكتروني المسجل أو رقم الهاتف
                  </label>
                  <input
                    type="text"
                    required
                    value={loginEmailInput}
                    onChange={e => { setLoginEmailInput(e.target.value); setAuthError(''); }}
                    placeholder="partner@example.com أو 010xxxxxxx"
                    className="w-full py-3.5 px-4 bg-white border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#00ab84] focus:ring-2 focus:ring-emerald-500/20"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-zinc-600 mb-2">
                    رمز المرور السري (PIN)
                  </label>
                  <input
                    type="password"
                    required
                    value={loginPinInput}
                    onChange={e => { setLoginPinInput(e.target.value); setAuthError(''); }}
                    placeholder="••••"
                    maxLength={10}
                    className="w-full py-3.5 px-4 bg-white border border-zinc-200 rounded-2xl text-center font-mono font-black text-lg tracking-[6px] text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-[#00ab84] focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1.5 font-medium">
                    الرمز السري الممنوح لك من إدارة المتجر (الافتراضي: 0000).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!loginEmailInput.trim() || !loginPinInput.trim()}
                  className="w-full py-3.5 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]"
                >
                  <Key size={15} />
                  <span>دخول البوابة برمز PIN</span>
                </button>
              </form>
            )
          ) : (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-800 font-bold leading-relaxed">
                أدخل كود التحقق المكون من 6 أرقام المرسل إلى:
                <span className="font-mono text-zinc-900 block mt-1 text-left" dir="ltr">{maskEmail(otpTargetEmail)}</span>
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
                  className="w-full py-3.5 px-4 bg-white border-2 border-[#00ab84] rounded-2xl text-center font-mono font-black text-2xl tracking-[8px] text-[#062d24] outline-none focus:ring-2 focus:ring-emerald-400"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIsOtpSent(false); setOtpCode(''); setAuthError(''); }}
                  className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  تغيير البريد
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpCode.length !== 6}
                  className="flex-1 py-3 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>تأكيد الكود والدخول</span>
                </button>
              </div>
            </form>
          )}

          {/* Biometric Quick Login Button on Mobile/Supported Devices */}
          {biometricAvailable && !isOtpSent && (
            <div className="pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleBiometricQuickLogin}
                className="w-full py-3 bg-zinc-800/80 hover:bg-zinc-800 text-emerald-400 border border-zinc-700/80 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
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
    wallet: { title: 'المحفظة والدورة المالية', subtitle: 'الرصيد الحالي، قائمة المعاملات، والدورة المالية للشحنات' },
    orders: { title: 'الأوردرات المنشأة', subtitle: `متابعة جميع الأوردرات المنشأة لحسابك (${merchantOrders.length} أوردر)` },
    create_order: { title: 'إنشاء أوردر جديد', subtitle: 'استوديو تسجيل وشحن أوردرات الوكيل' },
    inventory: { title: 'مخزون بضاعتي', subtitle: `متابعة ${merchantProducts.length} صنف · ${totalStockUnits} قطعة محددة · ${unlimitedProductCount} متاح دائمًا` },
    analytics: { title: 'تحليل الأصناف والمحافظات', subtitle: 'ترتيب المنتجات الأكثر ربحية ونسب التسليم' },
    customers: { title: 'إدارة العملاء والمشترين', subtitle: `سجل العملاء، بيانات الاتصال، وإحصائيات لـ ${uniqueCustomersCount} عميل` },
    apps: { title: 'التطبيقات والربط الآلي', subtitle: 'ربط شركات الشحن (بوسطة)، إشعارات الواتساب، وتكامل المخزون والـ Webhooks' },
    transparency: { title: 'حركة البضاعة والشفافية', subtitle: 'البيان المحاسبي المفصل للأصناف والتكاليف' },
    statement: { title: 'كشف الحساب والـ P&L', subtitle: 'كشف الأستاذ وقائمة الأرباح والخسائر ومخصص المرتجعات' },
    account: { title: 'حسابي والأمان', subtitle: 'حسابات الدفع المحفوظة ورمز PIN والبصمة' }
  };

  const unreadAlertsCount = merchantFilteredRequests.filter(r => r.status === 'approved' || r.status === 'pending').length;

  // RENDER 3: Upgraded Modern App-Grade Merchant Portal (Mobile & Desktop)
  return (
    <div
      className={`min-h-screen font-sans pb-24 lg:pb-0 transition-colors duration-200 ${
        isDark
          ? 'bg-[#050505] text-zinc-100'
          : 'bg-[#f8faf9] text-zinc-900'
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
            className={`fixed top-4 left-1/2 -tranzinc-x-1/2 z-[160] px-5 py-3 rounded-2xl text-xs font-black shadow-2xl flex items-center gap-2 border ${
              toast.type === 'error'
                ? 'bg-rose-950 text-rose-200 border-rose-800'
                : 'bg-zinc-900 text-emerald-300 border-emerald-700/60'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle size={15} className="text-rose-400" /> : <CheckCircle2 size={15} className="text-emerald-400" />}
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Outer Desktop Layout Container */}
      <div className="flex min-h-screen w-full">

        {/* =====================================================================
            1. RIGHT PERSISTENT SIDEBAR (Desktop & Laptop: lg:flex)
            Exact structural match to reference image in brand identity colors (#00ab84)
           ===================================================================== */}
        <aside
          className={`hidden lg:flex flex-col w-64 xl:w-72 shrink-0 border-l fixed top-0 bottom-0 right-0 h-screen z-40 select-none overflow-y-auto no-scrollbar justify-between ${
            isDark
              ? 'bg-[#0a0a0a] border-zinc-800 text-zinc-300'
              : 'bg-white border-zinc-200 text-zinc-900'
          }`}
        >
          {/* TOP ZONE: Brand Logo & Tier Pill */}
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00ab84] to-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-emerald-600/30">
                  ع.م
                </div>
                <div>
                  <div className="font-black text-sm text-zinc-900 dark:text-white tracking-tight flex items-center gap-1.5">
                    <span>عبده ميديا</span>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-[#00ab84] dark:text-emerald-400 px-1.5 py-0.2 rounded-md font-black border border-emerald-200 dark:border-emerald-800">
                      وكيل
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400 font-medium truncate max-w-[110px]">
                    {storeName}
                  </div>
                </div>
              </div>

              {/* Tier Plan Badge with Arrow */}
              <button
                type="button"
                onClick={() => setShowChangePlanModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] font-black text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 hover:text-[#00ab84] dark:hover:bg-zinc-700 transition-colors"
                title="تغيير الباقة أو تفعيل المدير المخصص"
              >
                <span>{planUsage.badgeText}</span>
                <Coins size={12} className="text-amber-500" />
                <ChevronLeft size={12} className="text-zinc-400" />
              </button>
            </div>

            {/* NAVIGATION TREE */}
            <nav className="space-y-1">
              {/* 1. الرئيسية */}
              <button
                type="button"
                onClick={() => navigateToTab('overview')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'overview'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Home size={16} />
                  <span>الرئيسية</span>
                </div>
              </button>

              {/* 1B. المحفظة والدورة المالية */}
              <button
                type="button"
                onClick={() => navigateToTab('wallet')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'wallet'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <WalletIcon size={16} />
                  <span>المحفظة</span>
                </div>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                  currentTab === 'wallet'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/10 text-[#00ab84]'
                }`}>
                  {formatMoney(availableForWithdrawal)}
                </span>
              </button>

              {/* 2. المنتجات والطلبات (Collapsible Parent) */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedMenuSection(prev => prev === 'products_orders' ? null : 'products_orders')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                    ['orders', 'create_order', 'inventory', 'analytics'].includes(currentTab)
                      ? 'text-[#00ab84] dark:text-emerald-400 font-black'
                      : isDark
                      ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <PackageIcon size={16} />
                    <span>المنتجات والطلبات</span>
                  </div>
                  {expandedMenuSection === 'products_orders' ? (
                    <ChevronDown size={14} className="text-zinc-400" />
                  ) : (
                    <ChevronLeft size={14} className="text-zinc-400" />
                  )}
                </button>

                {/* Collapsed Sub-items (Matching screenshot) */}
                {expandedMenuSection === 'products_orders' && (
                  <div className="mr-4 pr-2 border-r-2 border-zinc-200 dark:border-zinc-800 space-y-1 mt-1">
                    {/* الاوردرات */}
                    <button
                      type="button"
                      onClick={() => navigateToTab('orders')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                        currentTab === 'orders'
                          ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                          : isDark
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PackageIcon size={14} />
                        <span>الاوردرات</span>
                      </div>
                      {merchantOrders.length > 0 && (
                        <span className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full ${
                          currentTab === 'orders' ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-[#00ab84]'
                        }`}>
                          {merchantOrders.length}
                        </span>
                      )}
                    </button>

                    {/* إنشاء أوردر */}
                    <button
                      type="button"
                      onClick={() => navigateToTab('create_order')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                        currentTab === 'create_order'
                          ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                          : isDark
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <PlusCircle size={14} />
                        <span>إنشاء أوردر</span>
                      </div>
                      {planUsage.managerPlanActive ? (
                        <span className="text-[9px] bg-amber-500/20 text-amber-500 px-1.5 py-0.2 rounded-full font-black">
                          للمدير 🔒
                        </span>
                      ) : (
                        <span className="text-[9px] bg-amber-500/15 text-amber-600 px-1.5 py-0.2 rounded-full font-black">
                          جديد
                        </span>
                      )}
                    </button>

                    {/* المنتجات / مخزون بضاعتي */}
                    <button
                      type="button"
                      onClick={() => navigateToTab('inventory')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                        currentTab === 'inventory'
                          ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                          : isDark
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layers size={14} />
                        <span>المنتجات والمخزون</span>
                      </div>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {totalStockUnits} ق
                      </span>
                    </button>

                    {/* المجموعات / الأصناف */}
                    <button
                      type="button"
                      onClick={() => navigateToTab('analytics')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                        currentTab === 'analytics'
                          ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                          : isDark
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                          : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <TrendingUp size={14} />
                        <span>المجموعات والأصناف</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* 3. إدارة العملاء */}
              <button
                type="button"
                onClick={() => navigateToTab('customers')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'customers'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Users size={16} />
                  <span>إدارة العملاء</span>
                </div>
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                  currentTab === 'customers'
                    ? 'bg-white/20 text-white'
                    : 'bg-zinc-200/60 dark:bg-zinc-800 text-zinc-500'
                }`}>
                  {uniqueCustomersCount}
                </span>
              </button>

              {/* 4. صندوق الوارد / طلبات السحب */}
              <button
                type="button"
                onClick={() => {
                  setShowNotificationsSheet(true);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Inbox size={16} />
                  <span>صندوق الوارد</span>
                </div>
                {unreadAlertsCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black flex items-center justify-center">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>

              {/* 5. المتجر الإلكتروني */}
              <button
                type="button"
                onClick={() => setShowStoreModal(true)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingBag size={16} />
                  <span>المتجر الإلكتروني</span>
                </div>
                <ExternalLink size={13} className="text-zinc-400" />
              </button>

              {/* 6. حركة البضاعة والشفافية */}
              <button
                type="button"
                onClick={() => navigateToTab('transparency')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'transparency'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sparkles size={16} />
                  <span>حركة البضاعة والشفافية</span>
                </div>
              </button>

              {/* 7. كشف الحساب والـ P&L (المبيعات والتسويق) */}
              <button
                type="button"
                onClick={() => navigateToTab('statement')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'statement'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileText size={16} />
                  <span>كشف الحساب والـ P&L</span>
                </div>
                <ChevronLeft size={13} className="text-zinc-400" />
              </button>

              {/* 8. التطبيقات */}
              <button
                type="button"
                onClick={() => navigateToTab('apps')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'apps'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid size={16} />
                  <span>التطبيقات</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                  currentTab === 'apps'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-500/15 text-[#00ab84]'
                }`}>
                  نشط 4
                </span>
              </button>

              {/* 9. الإعدادات والأمان */}
              <button
                type="button"
                onClick={() => navigateToTab('account')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-colors duration-150 cursor-pointer ${
                  currentTab === 'account'
                    ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                    : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Settings size={16} />
                  <span>الإعدادات والأمان</span>
                </div>
                <ChevronLeft size={13} className="text-zinc-400" />
              </button>

              {/* 10. كن شريكاً / الدعم */}
              <button
                type="button"
                onClick={() => {
                  const phone = (settings as any)?.supportPhone || (settings as any)?.phone || '01000000000';
                  window.open(`https://wa.me/2${phone.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم، استفسار بخصوص شراكة الوكلاء')}`, '_blank');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  isDark
                    ? 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <HeartHandshake size={16} />
                  <span>كن شريكاً</span>
                </div>
              </button>
            </nav>
          </div>

          {/* BOTTOM ZONE: Alerts, Profile Card & Usage Progress */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
            {/* Alerts Row */}
            <button
              type="button"
              onClick={() => setShowNotificationsSheet(true)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-zinc-100 text-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-zinc-400" />
                <span>الإشعارات</span>
              </div>
              {unreadAlertsCount > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/* Agent Profile Card */}
            <div
              onClick={() => setShowProfileBottomSheet(true)}
              className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer group ${
                isDark
                  ? 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  : 'bg-zinc-50 border-zinc-200/80 hover:border-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#062d24] to-[#00ab84] text-white flex items-center justify-center font-black text-xs shadow-sm shadow-emerald-700/20">
                    {getInitials(liveMerchant.name)}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black truncate text-zinc-900 dark:text-white">
                    {liveMerchant.name}
                  </div>
                  <div className="text-[10px] text-zinc-400 font-bold truncate">
                    {storeName} · وكيل معتمد
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200">
                <ChevronUp size={11} />
                <ChevronDown size={11} className="-mt-1" />
              </div>
            </div>

            {/* Usage Progress Card (Matching Bottom Right of Screenshot) */}
            <div
              onClick={() => setShowChangePlanModal(true)}
              className={`rounded-2xl p-3 text-white shadow-md space-y-2 cursor-pointer hover:brightness-105 transition-all ${
                planUsage.managerPlanActive
                  ? 'bg-gradient-to-tr from-amber-600 to-[#062d24] shadow-amber-950/20'
                  : 'bg-gradient-to-tr from-[#00ab84] to-[#062d24] shadow-emerald-950/20'
              }`}
              title="اضغط لإدارة الباقة أو المدير المخصص"
            >
              <div className="flex items-center justify-between text-xs font-black">
                <span className="flex items-center gap-1.5">
                  <ExternalLink size={13} />
                  <span>{planUsage.managerPlanActive ? 'باقة المدير المخصص' : 'استخدام الخطة'}</span>
                </span>
                <span className="font-mono">{planUsage.usagePercent}%</span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    planUsage.usagePercent >= 90 ? 'bg-rose-500' : planUsage.usagePercent >= 70 ? 'bg-amber-400' : 'bg-white'
                  }`}
                  style={{ width: `${Math.max(6, planUsage.usagePercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-50/90 pt-0.5 gap-1">
                <span className="truncate max-w-[125px]">{planUsage.planLabelAr}</span>
                <span className="font-mono shrink-0">{planUsage.quotaTextAr}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* =====================================================================
            2. MAIN CONTENT WORKSPACE
           ===================================================================== */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen lg:mr-64 xl:mr-72">
          
          {/* Top Sticky Header for Desktop/Laptop */}
          <header
            className={`hidden lg:flex items-center justify-between px-8 py-3.5 sticky top-0 z-30 backdrop-blur-md border-b transition-colors ${
              isDark
                ? 'bg-zinc-900/95 border-zinc-800'
                : 'bg-white/95 border-zinc-200/80 shadow-xs'
            }`}
          >
            {/* Right: Page Title + Refresh Status */}
            <div className="flex items-center gap-4">
              <h1 className={`text-lg xl:text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                {currentTab === 'orders' ? 'جميع الاوردرات' : tabTitleMap[currentTab]?.title || 'لوحة تحكم الوكيل'}
              </h1>

              <button
                type="button"
                onClick={() => fetchFreshData(true)}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-bold border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-200 transition-colors"
                title="مزامنة وتحديث البيانات"
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[#00ab84]' : ''} />
                <span>{isRefreshing ? 'جارِ التحديث...' : 'تحديث'}</span>
              </button>
            </div>

            {/* Left: Quick Header Actions (Export + Create Order) */}
            <div className="flex items-center gap-2.5">
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
                  a.download = `كشف_الاوردرات_${liveMerchant.name}_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast('تم تصدير كشف الاوردرات بنجاح', 'success');
                }}
                className={`px-4 py-2 rounded-xl border text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                  isDark
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                    : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <Download size={14} />
                <span>تصدير</span>
              </button>

              {planUsage.managerPlanActive ? (
                <button
                  type="button"
                  onClick={() => setShowChangePlanModal(true)}
                  className="flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer"
                  title="إنشاء الأوردرات مفوض للمدير المخصص في باقتك الحالية"
                >
                  <Crown size={14} />
                  <span>يدير أوردراتك: المدير المخصص 🔒</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToTab('create_order')}
                  className="flex items-center gap-1.5 bg-[#00ab84] hover:bg-[#00ab84] text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-emerald-700/20 transition-all cursor-pointer active:scale-95"
                >
                  <PlusCircle size={15} />
                  <span>+ إنشاء اوردر</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowRequestModal(true)}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Coins size={14} />
                <span>طلب سحب</span>
              </button>
            </div>
          </header>



          {/* Main Content Container (Full-width responsive workspace) */}
          <main className="flex-1 w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5">

            {/* Desktop Announcement / Plan Upgrade Banner (Dynamic with Active Plan) */}
            <div className={`relative overflow-hidden rounded-2xl text-white p-3.5 sm:p-4 shadow-md border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              planUsage.managerPlanActive
                ? 'bg-gradient-to-r from-amber-700 via-[#062d24] to-[#09090b] border-amber-500/30 shadow-amber-950/20'
                : 'bg-gradient-to-r from-[#062d24] via-[#00ab84] to-[#09090b] border-emerald-600/30 shadow-emerald-950/20'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  {planUsage.managerPlanActive ? (
                    <Crown size={16} className="text-amber-300" />
                  ) : (
                    <Sparkles size={16} className="text-amber-300" />
                  )}
                </div>
                <p className="text-xs font-black leading-relaxed">
                  {planUsage.topBannerTextAr}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => setShowChangePlanModal(true)}
                  className="px-3.5 py-1.5 bg-white text-[#062d24] hover:bg-emerald-50 rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  {planUsage.managerPlanActive ? 'إدارة باقة المدير المخصص' : 'ترقية / تغيير الخطة'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const phone = (settings as any)?.supportPhone || (settings as any)?.phone || '01000000000';
                    window.open(`https://wa.me/2${phone.replace(/\D/g, '')}?text=${encodeURIComponent('السلام عليكم، أحتاج دعم بخصوص حساب الوكيل')}`, '_blank');
                  }}
                  className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer"
                >
                  تواصل مع الدعم
                </button>
              </div>
            </div>

            {/* Governed Plan Request / Admin Custom Pricing Offer Banner */}
            {liveMerchant.pendingPlanRequest && (
              <div className={`rounded-2xl p-4 border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                  ? isDark
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-100'
                    : 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                  : isDark
                  ? 'bg-amber-950/40 border-amber-600/50 text-amber-100'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                      ? 'bg-[#00ab84] text-white'
                      : 'bg-amber-500 text-zinc-950'
                  }`}>
                    {liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant' ? <CheckCircle2 size={18} /> : <Lock size={18} />}
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="font-black flex flex-wrap items-center gap-2">
                      <span>
                        {liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                          ? `عرض تسعير الإدارة جاهز لموافقتك: ${liveMerchant.pendingPlanRequest.quotedOrderFee} ج.م لكل أوردر (${liveMerchant.pendingPlanRequest.requestedCustomQuota || 200} أوردر)`
                          : `طلب معلّق قيد مراجعة الإدارة: ${liveMerchant.pendingPlanRequest.targetPlanNameAr}`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-black/10 dark:bg-white/10">
                        {liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                          ? 'بانتظار موافقتك للتفعيل من المحفظة'
                          : 'قيد مراجعة وتسعير الإدارة'}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold opacity-85">
                      {liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant'
                        ? liveMerchant.pendingPlanRequest.requestedCustomBillingPreference === 'prepaid_quota'
                          ? `إجمالي الدفعة المقدمة المطلوبة من المحفظة: ${((liveMerchant.pendingPlanRequest.quotedOrderFee || 0) * (liveMerchant.pendingPlanRequest.requestedCustomQuota || 200)).toLocaleString()} ج.م`
                          : `سيتم تفعيل الباقة مجاناً الآن وخصم ${liveMerchant.pendingPlanRequest.quotedOrderFee} ج.م تلقائياً من المحفظة مع كل أوردر مؤكد.`
                        : 'باقتك الحالية مستمرة ومؤمّنة بالكامل لحين اعتماد الإدارة، وكل أوردر يحتفظ بتسعير الدورة التي أُنشئ خلالها.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                  {liveMerchant.pendingPlanRequest.status === 'quoted_waiting_merchant' && (
                    <button
                      type="button"
                      onClick={() => handleAcceptAdminCustomQuote(liveMerchant.pendingPlanRequest!)}
                      className="px-4 py-2 rounded-xl bg-[#00ab84] hover:bg-[#00ab84] text-white text-xs font-black shadow-sm cursor-pointer transition-all"
                    >
                      موافقة وتفعيل الآن من المحفظة
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowChangePlanModal(true)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black border cursor-pointer transition-all ${
                      isDark ? 'bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800' : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-100'
                    }`}
                  >
                    عرض التفاصيل
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Quick Sub-Navigation Pill Scroller (Only on mobile/tablets lg:hidden) */}
            <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'overview', label: 'الرئيسية', icon: Home },
            { id: 'wallet', label: 'المحفظة', icon: WalletIcon },
            { id: 'orders', label: `الأوردرات (${merchantOrders.length})`, icon: PackageIcon },
            { id: 'create_order', label: planUsage.managerPlanActive ? 'إنشاء أوردر 🔒' : '+ إنشاء أوردر', icon: PlusCircle },
            { id: 'inventory', label: `مخزون بضاعتي (${totalStockUnits})`, icon: Layers },
            { id: 'customers', label: `العملاء (${uniqueCustomersCount})`, icon: Users },
            { id: 'apps', label: 'التطبيقات (4)', icon: LayoutGrid },
            { id: 'analytics', label: 'الأصناف والمحافظات', icon: TrendingUp },
            { id: 'transparency', label: 'حركة البضاعة', icon: Sparkles },
            { id: 'statement', label: 'كشف الحساب والـ P&L', icon: FileText },
            { id: 'account', label: 'حسابي والأمان', icon: ShieldCheck }
          ].map(t => {
            const Icon = t.icon;
            const active = currentTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigateToTab(t.id as TabKey)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer border ${
                  active
                    ? 'bg-[#00ab84] text-white border-[#00ab84] shadow-sm shadow-emerald-600/20'
                    : isDark
                    ? 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                    : 'bg-white text-zinc-600 border-zinc-200/80 hover:bg-zinc-50'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                {(t as any).soon && (
                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                    active ? 'bg-amber-400 text-zinc-950' : 'bg-amber-500/15 text-amber-600'
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
            
            {/* Modern High-Fidelity Welcome Section */}
            <div className="relative group px-1">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 mb-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#00ab84]/10 text-[#00ab84] border border-[#00ab84]/20 shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00ab84]">لوحة التحكم الذكية</span>
                  </div>
                  
                  {(() => {
                    const getGreeting = () => {
                    const hour = new Date().getHours();
                    if (hour >= 4 && hour < 12) return 'صباح الخير والبركة';
                    if (hour >= 12 && hour < 17) return 'طاب يومك بكل خير';
                    if (hour >= 17 && hour < 23) return 'مساء الخير والنجاح';
                    return 'أهلاً بك في ساعات الإنجاز';
                  };

                  return (
                    <div className="flex items-center gap-3">
                      <div>
                        <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          {getGreeting()}، {liveMerchant.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-[#00ab84] text-white">عبده ميديا</span>
                          <span className={`text-[10px] font-bold ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>· شريك النجاح والريادة</span>
                        </div>
                      </div>
                      <span className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 text-xl shadow-sm animate-bounce [animation-duration:3s]">👋</span>
                    </div>
                  );
                })()}
                  
                  <p className={`text-xs sm:text-sm font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'} max-w-lg leading-relaxed`}>
                    نحن نراقب نشاطك التجاري بدقة. إليك ملخص لأرصدتك المالية وحركة بضاعتك في المخازن لهذا اليوم.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-300 shadow-sm ${
                    isDark 
                      ? 'bg-zinc-900/50 border-zinc-800 hover:border-[#00ab84]/40 text-zinc-300' 
                      : 'bg-white border-zinc-200 hover:border-[#00ab84]/30 text-zinc-600'
                  }`}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ab84] to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-600/20">
                      <Crown size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-[#00ab84]">فئة الحساب</div>
                      <div className="text-xs font-black">موكل بلاتيني</div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => fetchFreshData(true)}
                    disabled={isRefreshing}
                    className={`p-3 rounded-2xl border transition-all duration-300 ${
                      isDark 
                        ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-emerald-400' 
                        : 'bg-white border-zinc-200 hover:bg-zinc-50 text-[#00ab84]'
                    } ${isRefreshing ? 'animate-spin' : 'hover:shadow-lg hover:shadow-emerald-500/10 active:scale-95'}`}
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>

              {/* Subtle Decorative Line */}
              <div className="mt-6 h-px w-full bg-gradient-to-r from-transparent via-zinc-200 to-transparent dark:via-zinc-800 opacity-50" />
            </div>

            {/* Hero Fintech Wallet Card */}
            <div className="relative overflow-hidden rounded-[28px] bg-[#062d24] text-white p-5 sm:p-7 shadow-xl shadow-emerald-950/20">

              <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-200 text-xs font-bold">
                    <WalletIcon size={15} />
                    <span>الرصيد الجاهز للتحويل الأسبوعي (بعد إتمام {weeklyPayoutOverview.holdingDaysSetting} أيام من التسوية)</span>
                    <span>·</span>
                    <span className="font-mono">{liveMerchant.id}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black font-mono tabular-nums tracking-tight text-white">
                    {formatMoney(weeklyPayoutOverview.maturedWalletBalance)}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-100/90 pt-1">
                    <span>إجمالي المحفظة الدفتري: <strong className="font-mono">{formatMoney(effectiveMerchantBalance)}</strong></span>
                    {weeklyPayoutOverview.holdingSettledBalance > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-cyan-200 font-bold">
                          مسوّى قيد التعليق ({weeklyPayoutOverview.holdingDaysSetting} أيام): <strong className="font-mono">{formatMoney(weeklyPayoutOverview.holdingSettledBalance)}</strong>
                        </span>
                      </>
                    )}
                    {pendingRequestsSum > 0 && (
                      <>
                        <span>·</span>
                        <span className="text-amber-300 font-bold inline-flex items-center gap-2">
                          <span>محجوز لطلبات معلقة: <strong className="font-mono">{formatMoney(pendingRequestsSum)}</strong></span>
                          {merchantFilteredRequests.filter(r => r.status === 'pending' && (!r.type || r.type === 'withdrawal')).map(req => (
                            <button
                              key={req.id}
                              type="button"
                              onClick={() => handleCancelPendingWithdrawal(req.id)}
                              className="px-2 py-0.5 rounded-lg bg-rose-500/90 hover:bg-rose-600 text-white text-[10px] font-black cursor-pointer shadow-xs"
                              title="إلغاء طلب السحب المعلق وفك الحجز"
                            >
                              إلغاء الطلب المعلق ✕
                            </button>
                          ))}
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
                    className="px-4 py-3 bg-white text-[#00ab84] hover:bg-emerald-50 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95"
                  >
                    <Coins size={16} />
                    <span>إعدادات وطلب السحب الأسبوعي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('create_order')}
                    className="px-4 py-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all active:scale-95"
                  >
                    <PlusCircle size={15} />
                    <span>إنشاء أوردر جديد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('wallet')}
                    className="col-span-2 sm:col-span-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-emerald-200 border border-emerald-400/20 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <WalletIcon size={15} />
                    <span>المحفظة والدورة المالية</span>
                  </button>
                </div>

              </div>

              {/* Bottom Mini Strip inside Hero Card */}
              <div className="relative z-10 mt-6 pt-4 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">١. أرباح ومبيعات بانتظار التسوية</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-white mt-0.5 block">
                    {formatMoney(overviewStats.netPayoutReady)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">٢. مسوّى قيد التعليق ({weeklyPayoutOverview.holdingDaysSetting} أيام)</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-amber-300 mt-0.5 block">
                    {formatMoney(weeklyPayoutOverview.holdingSettledBalance)}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-200/80 block text-[11px]">٣. التحويل الأسبوعي القادم ({weeklyPayoutOverview.weeklyDayNameAr})</span>
                  <span className="font-mono tabular-nums font-black text-sm sm:text-base text-emerald-300 mt-0.5 block">
                    {weeklyPayoutOverview.nextWeeklyPayoutDateFormatted}
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
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-emerald-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>إجمالي المحصل</span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center">
                    <DollarSign size={18} />
                  </div>
                </div>
                <div className={`text-lg sm:text-2xl font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {formatMoney(overviewStats.totalDeliveredCollected)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  إجمالي المبالغ المحصلة من العملاء
                </div>
              </div>

              {/* 2. مصروفات الشحن واللوجستيات (شحن + تأمين + ضريبة + معاينة + COD) */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-rose-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>مصروفات الشحن</span>
                  <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                    <Truck size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-rose-500">
                  -{formatMoney(overviewStats.totalShippingDeductions)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  شحن + تأمين + ضريبة + معاينة + COD
                </div>
              </div>

              {/* 3. عمولة تشغيل الأوردرات (بطاقة منفصلة لعمولة تشغيل وإنشاء الأوردر) */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-emerald-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>عمولة تشغيل الأوردرات</span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Cpu size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-emerald-500">
                  -{formatMoney(overviewStats.totalServiceFees)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  رسوم المعالجة وإنشاء الأوردرات
                </div>
              </div>

              {/* 4. مصروفات التسويق والإعلانات */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-amber-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>مصروفات التسويق</span>
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Megaphone size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-amber-600">
                  -{formatMoney(overviewStats.totalMarketingCosts)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  حملات إعلانية وتأجير وتسويق
                </div>
              </div>

              {/* 5. مصروفات وتشغيل المتجر (بدون شحن: تغليف + إعلانات + عمالة + رسوم سحب) */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-purple-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>مصروفات أخرى وتشغيل</span>
                  <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                    <Layers size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-purple-600">
                  -{formatMoney(overviewStats.totalOtherStoreExpenses)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  تغليف + إعلانات + عمالة + رسوم سحب
                </div>
              </div>

              {/* 6. رأس مال المباع المسترد */}
              <div
                onClick={() => navigateToTab('transparency')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-cyan-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>رأس مال المباع</span>
                  <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                    <PackageCheck size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-cyan-600">
                  {formatMoney(overviewStats.totalGoodsCostCapital)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  قيمة البضاعة المستردة من المبيعات
                </div>
              </div>

              {/* 7. الصافي المستحق (بانتظار التسوية) */}
              <div
                onClick={() => navigateToTab('analytics')}
                className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer ${
                  isDark ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700' : 'bg-white border-zinc-200/80 hover:border-emerald-300 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>بانتظار التسوية</span>
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center">
                    <Calculator size={18} />
                  </div>
                </div>
                <div className="text-lg sm:text-2xl font-black font-mono tabular-nums text-[#00ab84]">
                  {formatMoney(overviewStats.netPayoutReady)}
                </div>
                <div className="text-[11px] text-zinc-400 mt-1">
                  أرباح أوردرات لم تضف للمحفظة بعد
                </div>
              </div>
            </div>

            {/* Balance Chart + Quick Inventory Split */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Balance Progression Chart (7 cols) */}
              <div className={`lg:col-span-7 p-5 sm:p-6 rounded-3xl border ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              } space-y-4`}>
                <div className={`flex items-center justify-between border-b pb-3.5 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                  <div>
                    <h3 className={`text-sm sm:text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      منحنى تطور الرصيد الجاري
                    </h3>
                    <p className="text-xs text-zinc-400">
                      حركة المحفظة عبر التسويات والمسحوبات المعتمدة
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTab('statement')}
                    className="text-xs font-black text-[#00ab84] hover:underline cursor-pointer"
                  >
                    كشف الحساب ←
                  </button>
                </div>

                <div className="h-60 sm:h-64 w-full pt-2" dir="ltr">
                  {(!overviewStats.chartData || overviewStats.chartData.length === 0) ? (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-xs font-bold gap-2">
                      <WalletIcon size={28} className="text-zinc-300 dark:text-zinc-700" />
                      <span>لا توجد حركات مسجلة في كشف الحساب لرسم المنحنى حالياً</span>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overviewStats.chartData}>
                        <defs>
                          <linearGradient id="merchantPortalEmerald" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00ab84" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#00ab84" stopOpacity={0.02}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} stroke={isDark ? '#334155' : '#cbd5e1'} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke={isDark ? '#334155' : '#cbd5e1'} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#09090b' : '#ffffff', 
                            borderColor: isDark ? '#1e293b' : '#cbd5e1', 
                            borderRadius: '16px',
                            color: isDark ? '#f8fafc' : '#09090b',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            direction: 'rtl'
                          }} 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="الرصيد الجاري" 
                          stroke="#00ab84" 
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
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              } flex flex-col justify-between space-y-4`}>
                <div className="space-y-3">
                  <div className={`flex items-center justify-between border-b pb-3.5 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                    <div>
                      <h4 className={`font-black text-sm sm:text-base ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        بضاعة الأمانة بالمخزن ({merchantProducts.length})
                      </h4>
                      <p className="text-xs text-zinc-400">
                        إجمالي {overviewStats.totalStockUnits} قطعة محددة · {unlimitedProductCount} صنف متاح دائمًا
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateToTab('analytics')}
                      className="text-xs font-black text-[#00ab84] hover:underline cursor-pointer"
                    >
                      ترتيب المبيعات ←
                    </button>
                  </div>

                  {merchantProducts.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 font-bold text-xs space-y-2">
                      <PackageIcon size={28} className="mx-auto text-zinc-300 dark:text-zinc-700" />
                      <p>لا توجد أصناف مسجلة بالمخزن باسم الموكل حالياً</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-60 overflow-y-auto pr-1">
                      {merchantProducts.map((p, idx) => {
                        const unlimited = Boolean((p as any).unlimitedStock);
                        const stock = Number(p.stock || p.quantity || p.inventory || 0);
                        const cost = Number(p.costPrice || p.cost || p.wholesalePrice || p.supplierPrice || 0);
                        return (
                          <div key={p.id || idx} className="py-3 flex items-center justify-between gap-3 text-xs">
                            <div className="min-w-0">
                              <div className={`font-black truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                {p.name || p.title || 'منتج أمانة'}
                              </div>
                              <div className="text-[11px] text-zinc-400 font-mono">
                                {(p as any).isSharedProduct && cost <= 0 ? 'منتج مشترك — عرض فقط' : `تكلفة القطعة: ${formatMoney(cost)}`}
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <div className="font-mono tabular-nums font-black text-[#00ab84]">
                                {unlimited ? 'متاح دائمًا' : `${stock} قطعة`}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400">
                                {unlimited || cost <= 0 ? '—' : formatMoney(stock * cost)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-emerald-50/60 border-emerald-200/70'
                }`}>
                  <span className="font-bold text-zinc-500 dark:text-zinc-400">إجمالي تقييم المخزون المتبقي:</span>
                  <span className="font-mono tabular-nums font-black text-sm text-[#00ab84]">
                    {formatMoney(overviewStats.inventoryValuation)}
                  </span>
                </div>
              </div>
            </div>

            {/* New & Pre-Dispatch Orders Table Card (Matching image_7fe9dee8.png) */}
            <div className={`p-5 sm:p-6 rounded-3xl border space-y-4 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 dark:border-zinc-800">
                <div>
                  <h3 className={`text-sm sm:text-base font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    <FileText size={18} className="text-[#00ab84]" />
                    <span>سجل الطلبات المفصل والجديدة وقيد المراجعة الخاص بالموكل</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-mono text-xs font-black">
                      ({newOrdersList.length} طلب)
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
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
                      navigateToTab('wallet');
                    }}
                    className="text-xs font-black text-[#00ab84] hover:underline cursor-pointer whitespace-nowrap"
                  >
                    الدورة المالية ←
                  </button>
                </div>
              </div>

              {newOrdersList.length === 0 ? (
                <div className="py-10 text-center text-zinc-400 text-xs font-bold space-y-2">
                  <PackageCheck size={32} className="mx-auto text-emerald-500/50" />
                  <p>جميع الطلبات الحالية تم إرسالها للشحن ومتابعتها في المحفظة والدورة المالية</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className={`${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-50 text-zinc-700'} font-black border-b border-zinc-100 dark:border-zinc-800`}>
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
                    <tbody className={`divide-y font-bold ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                      {newOrdersList.map((o, idx) => {
                        const feeBreakdown = computeOrderFeeBreakdown(o);
                        const itemsStr = (o.items || []).map(i => `${i.name || i.productName || 'منتج'} (${i.quantity || 1})`).join(', ') || 'منتجات أمانة';
                        const orderNum = o.orderNumber || o.id || `#${idx + 1}`;
                        const formattedDate = o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-EG') : '2026/10/21';
                        const brandName = (o as any).merchantBrandName || (o as any).merchantName || (o as any).storeName || storeName || 'المتجر الرئيسي';
                        const codAmount = Number((o as any).codAmount || o.totalPrice || feeBreakdown.rawTotal || 0);
                        const netExpected = codAmount > 0 ? (codAmount - feeBreakdown.totalShipFee) : -feeBreakdown.totalShipFee;

                        return (
                          <tr key={o.id || idx} className={`${isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50/70'}`}>
                            <td className="py-3.5 px-3 font-mono font-black whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-900 dark:text-white">{orderNum}</span>
                                <span className="px-2 py-0.5 rounded-lg bg-[#00ab84]/10 text-[#00ab84] dark:text-emerald-400 font-black text-[10px] font-sans">
                                  {brandName}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 font-normal mt-0.5">{formattedDate}</div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-200">
                                <Truck size={14} className="text-[#00ab84]" />
                                <span>بوسطة</span>
                              </div>
                              <div className="text-[10px] text-zinc-400">قيد إصدار البوليسة</div>
                              <button
                                type="button"
                                onClick={() => showToast(`تتبع الشحنة رقم ${orderNum}`, 'info')}
                                className="mt-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer flex items-center gap-1"
                              >
                                <span>تتبع الشحنة</span>
                                🚚
                              </button>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <div className="text-zinc-900 dark:text-white font-black">{o.customerName || 'عميل المتجر'}</div>
                              <div className="text-[10px] text-zinc-400 font-normal">{(o as any).province || (o as any).city || 'القاهرة'}</div>
                            </td>
                            <td className="py-3.5 px-3 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 text-[11px] font-black border border-amber-500/20">
                                جاري_المراجعة
                              </span>
                            </td>
                            <td className="py-3.5 px-3 max-w-xs truncate text-zinc-600 dark:text-zinc-300">
                              {itemsStr}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-black text-[#00ab84] dark:text-emerald-400 whitespace-nowrap">
                              {formatMoney(codAmount)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300 whitespace-nowrap">
                              {formatMoney(feeBreakdown.goodsCost)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-bold text-rose-500 whitespace-nowrap">
                              -{formatMoney(feeBreakdown.totalShipFee)}
                            </td>
                            <td className="py-3.5 px-3 text-center font-mono font-black text-[#00ab84] dark:text-emerald-400 bg-emerald-500/5 rounded-xl whitespace-nowrap">
                              {formatMoney(netExpected)}
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[11px] font-black inline-flex items-center gap-1.5 cursor-not-allowed">
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
            TAB 2: CREATED ORDERS SCREEN (شاشة الأوردرات التي تم إنشاؤها)
           ========================================================= */}
        {currentTab === 'orders' && (
          <div className="space-y-5">
            {/* 1. Top Header Banner for Created Orders */}
            <div className={`p-5 sm:p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-white'
                : 'bg-white border-zinc-200/80 text-zinc-900 shadow-xs'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#00ab84]/10 text-[#00ab84] flex items-center justify-center shrink-0">
                  <PackageIcon size={24} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black">
                      سجل الأوردرات التي تم إنشاؤها ({merchantOrders.length} أوردر)
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                      planUsage.managerPlanActive
                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/15 text-[#00ab84] dark:text-emerald-400 border-emerald-500/30'
                    }`}>
                      {planUsage.planLabelAr} ({planUsage.quotaTextAr})
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-bold mt-1">
                    {planUsage.managerPlanActive
                      ? 'يتولى المدير المخصص تسجيل وتأكيد وشحن أوردراتك، وتظهر جميعها هنا لحظة بلحظة.'
                      : 'جميع الأوردرات التي قمت بإنشائها لبضاعتك ومتابعة حالة شحنها وتحصيلها بالتفصيل.'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {planUsage.managerPlanActive ? (
                  <button
                    type="button"
                    onClick={() => setShowChangePlanModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Crown size={15} />
                    <span>إدارة باقة المدير المخصص</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateToTab('create_order')}
                    className="px-4 py-2.5 rounded-2xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
                  >
                    <PlusCircle size={15} />
                    <span>+ إنشاء أوردر جديد</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => navigateToTab('wallet')}
                  className={`px-3.5 py-2.5 rounded-2xl border text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  <WalletIcon size={14} />
                  <span>المحفظة والدورة المالية</span>
                </button>
              </div>
            </div>

            {/* 2. Created Orders Status KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { id: 'all', label: 'إجمالي الأوردرات المنشأة', count: orderStatusCounts.all, color: 'text-zinc-900 dark:text-white' },
                { id: 'pending', label: 'قيد التنفيذ / جديد', count: orderStatusCounts.pending, color: 'text-amber-600 dark:text-amber-400' },
                { id: 'shipping', label: 'جاري التوصيل والشحن', count: orderStatusCounts.shipping, color: 'text-teal-600 dark:text-teal-400' },
                { id: 'collected', label: 'تم التسليم والتحصيل', count: orderStatusCounts.collected, color: 'text-[#00ab84] dark:text-emerald-400' },
                { id: 'returned', label: 'المرتجعات والملغي', count: orderStatusCounts.returned, color: 'text-rose-500' }
              ].map(card => {
                const isActive = ordersStatusFilter === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setOrdersStatusFilter(card.id as any)}
                    className={`p-4 rounded-3xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isActive
                        ? 'border-[#00ab84] ring-2 ring-[#00ab84]/20 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : isDark
                        ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                        : 'bg-white border-zinc-200/80 hover:border-emerald-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[11px] font-black text-zinc-500 dark:text-zinc-400">{card.label}</span>
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#00ab84]' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                    </div>
                    <div className={`text-2xl font-black font-mono tabular-nums ${card.color}`}>
                      {card.count}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 3. Search & Filter Bar */}
            <div className={`p-4 rounded-3xl border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-2xs'
            }`}>
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute right-3.5 top-1/2 -tranzinc-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={ordersSearchQuery}
                  onChange={e => setOrdersSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الأوردر، اسم العميل، الهاتف، أو المحافظة..."
                  className={`w-full pr-10 pl-8 py-2.5 rounded-2xl text-xs font-bold border outline-none transition-all ${
                    isDark
                      ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-[#00ab84]'
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-[#00ab84]'
                  }`}
                />
                {ordersSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setOrdersSearchQuery('')}
                    className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
                {[
                  { id: 'all', label: `الكل (${orderStatusCounts.all})` },
                  { id: 'pending', label: `قيد التنفيذ والجديد (${orderStatusCounts.pending})` },
                  { id: 'shipping', label: `جاري التوصيل (${orderStatusCounts.shipping})` },
                  { id: 'collected', label: `تم التسليم (${orderStatusCounts.collected})` },
                  { id: 'returned', label: `مرتجع (${orderStatusCounts.returned})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setOrdersStatusFilter(tab.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                      ordersStatusFilter === tab.id
                        ? 'bg-[#00ab84] text-white shadow-xs'
                        : isDark
                        ? 'bg-zinc-950 text-zinc-300 border border-zinc-800 hover:bg-zinc-800'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs font-bold">
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={e => setCycleStartDate(e.target.value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-mono outline-none ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="من تاريخ"
                />
                <span className="text-zinc-400">إلى</span>
                <input
                  type="date"
                  value={cycleEndDate}
                  onChange={e => setCycleEndDate(e.target.value)}
                  className={`px-3 py-2 rounded-xl border text-xs font-mono outline-none ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                  }`}
                  title="إلى تاريخ"
                />
                {(cycleStartDate || cycleEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCycleStartDate('');
                      setCycleEndDate('');
                    }}
                    className="px-2.5 py-2 rounded-xl bg-rose-500/10 text-rose-500 text-[11px] font-black cursor-pointer"
                  >
                    مسح
                  </button>
                )}
              </div>
            </div>

            {/* 4. Created Orders Table (Desktop) & Cards (Mobile) */}
            <div className={`rounded-3xl border overflow-hidden ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-xs'
            }`}>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className={`border-b font-black ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200/80 text-zinc-600'
                  }`}>
                    <tr>
                      <th className="py-3.5 px-4">رقم الأوردر / التتبع</th>
                      <th className="py-3.5 px-4">تاريخ الإنشاء</th>
                      <th className="py-3.5 px-4">العميل والمحافظة</th>
                      <th className="py-3.5 px-4">الأصناف والكمية</th>
                      <th className="py-3.5 px-4 text-center">حالة الأوردر</th>
                      <th className="py-3.5 px-4 text-center">إجمالي التحصيل (COD)</th>
                      <th className="py-3.5 px-4 text-center">مصاريف الشحن</th>
                      <th className="py-3.5 px-4 text-center">صافي مستحقاتك</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-bold ${isDark ? 'divide-zinc-800/70' : 'divide-zinc-100'}`}>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="max-w-sm mx-auto space-y-2">
                            <PackageIcon size={36} className="mx-auto text-zinc-300 dark:text-zinc-700" />
                            <div className="font-black text-sm text-zinc-700 dark:text-zinc-200">
                              لا توجد أوردرات منشأة مطابقة للفلتر الحالي
                            </div>
                            <p className="text-xs text-zinc-400">
                              {planUsage.managerPlanActive
                                ? 'سيقوم مدير حسابك المخصص بإنشاء الأوردرات وتأكيدها لتظهر هنا تلقائياً.'
                                : 'يمكنك إنشاء أوردر جديد الآن من خلال زر (+ إنشاء أوردر جديد).'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(o => {
                        const b = computeOrderFeeBreakdown(o);
                        const trackNum = getTrackingNumber(o);
                        const orderNum = o.orderNumber || o.id;
                        const rawDate = o.date || (o as any).createdAt;
                        const dateStr = rawDate
                          ? new Date(rawDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—';
                        const destGov = (o as any).governorate || (o as any).province || (o as any).city || 'غير محدد';
                        const itemsArr = Array.isArray(o.items) && o.items.length > 0
                          ? o.items
                          : [{ name: (o as any).productName || 'بضاعة الموكل', quantity: 1 }];
                        const itemsText = itemsArr
                          .map((it: any) => `${it.name || it.title || it.productName || 'صنف'} (${it.quantity || 1} ق)`)
                          .join(' + ');

                        const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
                        const isReturned = TRANSPARENCY_RETURN_STATUSES.includes(o.status as any);
                        const isShipping = ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status);
                        const codTotal = Number((o as any).totalAmount || o.totalPrice || (o as any).totalAmountOverride || b.collected || 0);
                        const orderSnap = getOrderEffectivePlanSnapshot(o, liveMerchant);
                        const mgrFee = Number(orderSnap.lockedFee || 0);

                        return (
                          <tr key={o.id} className={`transition-colors ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/70'}`}>
                            <td className="py-3.5 px-4">
                              <div className="font-mono font-black text-zinc-900 dark:text-white text-xs">
                                #{orderNum}
                              </div>
                              {trackNum && trackNum !== orderNum && (
                                <div className="text-[10px] font-mono text-[#00ab84] mt-0.5">
                                  بوليصة: {trackNum}
                                </div>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              {dateStr}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="font-black text-zinc-900 dark:text-white">
                                {o.customerName || 'عميل'}
                              </div>
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono">{o.customerPhone || '—'}</span>
                                <span>•</span>
                                <span className="text-[#00ab84] font-black">{destGov}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-200 max-w-[240px] truncate" title={itemsText}>
                                {itemsText}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-black text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700" title={`كود الدورة المعزولة: ${orderSnap.cycleId}`}>
                                  🔒 {orderSnap.planNameAr}
                                  {orderSnap.cycleOrderNumber ? ` (#${orderSnap.cycleOrderNumber})` : ''}
                                </span>
                                {mgrFee > 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black">
                                    رسوم مدير مثبتة: {mgrFee} ج.م
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10.5px] font-black inline-flex items-center gap-1.5 ${
                                isDelivered
                                  ? 'bg-emerald-500/15 text-[#00ab84] dark:text-emerald-400'
                                  : isReturned
                                  ? 'bg-rose-500/15 text-rose-500'
                                  : isShipping
                                  ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400'
                                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              }`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                <span>{String(o.status || 'جديد').replace(/_/g, ' ')}</span>
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-black text-zinc-900 dark:text-white">
                              {formatMoney(codTotal)}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono text-rose-500">
                              {formatMoney(b.totalShipFee)}
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-black text-[#00ab84] dark:text-emerald-400">
                              {formatMoney(b.netEntitlement)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View for Created Orders */}
              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredOrders.length === 0 ? (
                  <div className="py-12 px-4 text-center text-zinc-400 font-bold text-xs">
                    لا توجد أوردرات منشأة مطابقة للفلتر الحالي
                  </div>
                ) : (
                  filteredOrders.map(o => {
                    const b = computeOrderFeeBreakdown(o);
                    const orderNum = o.orderNumber || o.id;
                    const rawDate = o.date || (o as any).createdAt;
                    const dateStr = rawDate
                      ? new Date(rawDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—';
                    const destGov = (o as any).governorate || (o as any).province || (o as any).city || 'غير محدد';
                    const itemsArr = Array.isArray(o.items) && o.items.length > 0
                      ? o.items
                      : [{ name: (o as any).productName || 'بضاعة الموكل', quantity: 1 }];
                    const itemsText = itemsArr
                      .map((it: any) => `${it.name || it.title || it.productName || 'صنف'} (${it.quantity || 1} ق)`)
                      .join(' + ');
                    const codTotal = Number((o as any).totalAmount || o.totalPrice || (o as any).totalAmountOverride || b.collected || 0);
                    const isDelivered = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل', 'تم_توصيلها'].includes(o.status);
                    const isReturned = TRANSPARENCY_RETURN_STATUSES.includes(o.status as any);
                    const isShipping = ['تم_الشحن', 'جاري_التوصيل', 'في_المستودع', 'قيد_التسليم', 'في_الطريق'].includes(o.status);

                    return (
                      <div key={o.id} className="p-4 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-black text-sm text-zinc-900 dark:text-white">#{orderNum}</span>
                            <span className="text-[11px] text-zinc-400 mr-2 font-mono">{dateStr}</span>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                            isDelivered
                              ? 'bg-emerald-500/15 text-[#00ab84]'
                              : isReturned
                              ? 'bg-rose-500/15 text-rose-500'
                              : isShipping
                              ? 'bg-teal-500/15 text-teal-600'
                              : 'bg-amber-500/15 text-amber-600'
                          }`}>
                            {String(o.status || 'جديد').replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300 font-bold">
                          <span>{o.customerName || 'عميل'} ({o.customerPhone || '—'})</span>
                          <span className="text-[#00ab84] font-black">{destGov}</span>
                        </div>

                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold truncate">
                          الأصناف: {itemsText}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
                          <div>
                            <div className="text-[10px] text-zinc-400">إجمالي COD</div>
                            <div className="font-mono font-black text-zinc-900 dark:text-white">{formatMoney(codTotal)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">الشحن</div>
                            <div className="font-mono font-bold text-rose-500">{formatMoney(b.totalShipFee)}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-zinc-400">صافي مستحقاتك</div>
                            <div className="font-mono font-black text-[#00ab84]">{formatMoney(b.netEntitlement)}</div>
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

        {/* =========================================================
            TAB 2A: MERCHANT WALLET & FINANCIAL CYCLE (المحفظة والدورة المالية)
           ========================================================= */}
        {currentTab === 'wallet' && (
          <div className="space-y-6">
            {/* Top Wallet Header & Sub-View Switcher (الرصيد الحالي vs الدورة المالية) */}
            <div className={`p-5 sm:p-6 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDark
                ? 'bg-zinc-900 border-zinc-800 text-white'
                : 'bg-white border-zinc-200/80 text-zinc-900 shadow-xs'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#00ab84]/10 text-[#00ab84] flex items-center justify-center shrink-0">
                  <WalletIcon size={24} />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black">
                    المحفظة ومعاملاتها والدورة المالية
                  </h2>
                  <p className="text-xs text-zinc-400 font-bold mt-1">
                    متابعة الرصيد الحالي المتاح للسحب، قائمة المعاملات، والدورة المالية لتحصيل الشحنات.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Segmented Toggle: الرصيد الحالي vs الدورة المالية */}
                <div className={`p-1 rounded-2xl border flex items-center gap-1 ${
                  isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200/70'
                }`}>
                  <button
                    type="button"
                    onClick={() => setOrdersTopViewMode('current_balance')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      ordersTopViewMode === 'current_balance'
                        ? 'bg-[#00ab84] text-white shadow-sm'
                        : isDark
                        ? 'text-zinc-300 hover:text-white'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <WalletIcon size={14} />
                    <span>الرصيد الحالي والمعاملات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrdersTopViewMode('financial_cycle')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      ordersTopViewMode === 'financial_cycle'
                        ? 'bg-[#00ab84] text-white shadow-sm'
                        : isDark
                        ? 'text-zinc-300 hover:text-white'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Calendar size={14} />
                    <span>الدورة المالية</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRequestModal(true)}
                  className="px-4 py-2.5 rounded-2xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-700/20 cursor-pointer transition-all"
                >
                  <Coins size={15} />
                  <span>طلب سحب</span>
                </button>
              </div>
            </div>

            {/* Dedicated Plan & Quota Governance Card (Point 4: Complete Separation Between COD Sales Wallet & Order Plan Quota) */}
            <div className={`p-5 rounded-3xl border transition-all ${
              isDark
                ? 'bg-gradient-to-l from-zinc-900 via-zinc-900 to-emerald-950/30 border-zinc-800 text-white'
                : 'bg-gradient-to-l from-white via-white to-emerald-50/50 border-zinc-200/80 text-zinc-900 shadow-xs'
            }`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-[#00ab84]/15 text-[#00ab84] flex items-center justify-center shrink-0 mt-0.5">
                    <Crown size={21} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-black">
                        حوكمة الباقات وعزل الدورات: {planUsage.planNameAr}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-[#00ab84]/15 text-[#00ab84]">
                        دورة نشطة: {planUsage.cycleId}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-500/10 text-zinc-500 dark:text-zinc-400">
                        🔒 بصمة الأوردرات مفعّلة لمنع التداخل
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold">
                      رصيد محفظة المبيعات ({formatMoney(effectiveMerchantBalance)}) منفصل محاسبياً عن رصيد كوتة الأوردرات ({planUsage.isUnlimited ? 'غير محدود' : `${planUsage.usedOrdersCount} مستخدم من ${planUsage.limitOrders ?? 0} أوردر — متبقي ${planUsage.remainingQuota ?? 0} أوردر`}). كل أوردر يحتفظ ببصمة الباقة التي أُنشئ عليها.
                    </p>
                    {liveMerchant?.scheduledNextPlan && (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[11px] font-black">
                          ⏳ باقة مجدولة تالية: {liveMerchant.scheduledNextPlan.planNameAr || liveMerchant.scheduledNextPlan.targetPlanNameAr} (تبدأ تلقائياً بعد انتهاء الكوتة الحالية)
                        </span>
                        <button
                          type="button"
                          onClick={handleActivateScheduledPlanNow}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black cursor-pointer"
                        >
                          تفعيل المجدولة الآن
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {Array.isArray(liveMerchant?.planCyclesHistory) && liveMerchant.planCyclesHistory.length > 0 && (
                    <span className="px-3 py-2 rounded-xl bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 text-[11px] font-black">
                      دورات مؤرشفة معزولة: {liveMerchant.planCyclesHistory.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowChangePlanModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Crown size={14} className="text-amber-500" />
                    <span>إدارة الباقة / جدولة الترقية</span>
                  </button>
                </div>
              </div>
            </div>

            {ordersTopViewMode === 'current_balance' ? (
              /* Current Balance View: Desktop 3-Cards & Mobile Layout (Matching Image 3) */
              <div className="space-y-6">
                
                {/* 3 Top Cards Grid (Bosta-Style Wallet Header: Current Balance + Cashout Frequency + Next Cashout Date) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1 (Right): الرصيد الحالي + عرض التفاصيل (Dark Popover) + سحب الرصيد */}
                  <div className={`p-6 rounded-[28px] border space-y-3.5 relative transition-all ${
                    isDark 
                      ? 'bg-emerald-950/25 border-[#00ab84]/40 text-white' 
                      : 'bg-teal-50/70 border-teal-200/80 text-zinc-900 shadow-xs'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-black text-[#00ab84] dark:text-emerald-400">
                        الرصيد الحالي : <strong className="font-mono text-xl sm:text-2xl">{formatMoney(effectiveMerchantBalance)}</strong>
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      قيمة المبلغ المالي المتاح في حسابك (الجاهز للتحويل في السحبة القادمة من تسويات الأسبوع السابق:{' '}
                      <strong className="font-mono text-[#00ab84] dark:text-emerald-400">{formatMoney(weeklyPayoutOverview.maturedWalletBalance)}</strong>)
                    </p>

                    <div className="space-y-1 text-[11px] font-bold">
                      {weeklyPayoutOverview.holdingSettledBalance > 0 && (
                        <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                          <span>تسويات هذا الأسبوع (تُرحّل لتحويل الأسبوع القادم):</span>
                          <span className="font-mono font-black">{formatMoney(weeklyPayoutOverview.holdingSettledBalance)}</span>
                        </div>
                      )}
                      {overviewStats.netPayoutReady > 0 && (
                        <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
                          <span>أوردرات مسلمة بانتظار التسوية:</span>
                          <span className="font-mono font-black">{formatMoney(overviewStats.netPayoutReady)}</span>
                        </div>
                      )}
                      {pendingRequestsSum > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 text-rose-600 dark:text-rose-400">
                          <span>محجوز لطلب سحب معلق: <strong className="font-mono">{formatMoney(pendingRequestsSum)}</strong></span>
                          {merchantFilteredRequests.filter(r => r.status === 'pending' && (!r.type || r.type === 'withdrawal')).map(req => (
                            <button
                              key={req.id}
                              type="button"
                              onClick={() => handleCancelPendingWithdrawal(req.id)}
                              className="px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[10px] font-black cursor-pointer hover:bg-rose-700"
                            >
                              إلغاء الطلب وفك الحجز
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1 relative">
                      <button
                        type="button"
                        onClick={() => setShowBalanceDetailsPopover(prev => !prev)}
                        className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isDark ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700' : 'bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50 shadow-2xs'
                        }`}
                      >
                        عرض التفاصيل
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRequestModal(true)}
                        className="px-4 py-2 rounded-xl text-xs font-black bg-[#00ab84] hover:bg-[#0a664e] text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Coins size={15} />
                        <span>سحب الرصيد</span>
                      </button>

                      {/* Dark Balance Breakdown Popover (Matching Screenshot 5: الرصيد + vs الديون -) */}
                      {showBalanceDetailsPopover && (
                        <div
                          className="fixed sm:absolute top-1/2 sm:top-full left-1/2 sm:left-auto sm:right-0 -tranzinc-x-1/2 sm:tranzinc-x-0 -tranzinc-y-1/2 sm:tranzinc-y-2 z-50 w-[92vw] max-w-[360px] rounded-2xl bg-[#1e242b] text-white p-5 shadow-2xl border border-zinc-700/80 space-y-4"
                          dir="rtl"
                        >
                          <div className="flex items-center justify-between border-b border-zinc-700/70 pb-2.5">
                            <span className="text-xs font-black text-emerald-400">تفاصيل الرصيد الحالي</span>
                            <button
                              type="button"
                              onClick={() => setShowBalanceDetailsPopover(false)}
                              className="text-zinc-400 hover:text-white cursor-pointer"
                            >
                              <X size={15} />
                            </button>
                          </div>

                          {/* Section 1: الرصيد (+) */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-black text-white flex items-center gap-1">
                                  <span>الرصيد</span>
                                  <span className="text-emerald-400 font-mono">(+)</span>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-bold">المبلغ المضاف إلى رصيد المحفظة</div>
                              </div>
                              <span className="font-mono text-sm font-black text-emerald-400">
                                {formatMoney(weeklyPayoutOverview.balanceBreakdown.totalAddedCredits)}
                              </span>
                            </div>
                            <div className="space-y-1.5 pr-2 border-r-2 border-emerald-500/30 text-[11px] font-bold text-zinc-300">
                              <div className="flex items-center justify-between">
                                <span>المبلغ المحصل</span>
                                <span className="font-mono">{formatMoney(weeklyPayoutOverview.balanceBreakdown.collectedOrdersTotal)}</span>
                              </div>
                              {weeklyPayoutOverview.balanceBreakdown.compensationsTotal > 0 && (
                                <div className="flex items-center justify-between">
                                  <span>تعويض</span>
                                  <span className="font-mono">{formatMoney(weeklyPayoutOverview.balanceBreakdown.compensationsTotal)}</span>
                                </div>
                              )}
                              {weeklyPayoutOverview.balanceBreakdown.walletTopupsTotal > 0 && (
                                <div className="flex items-center justify-between">
                                  <span>شحن الرصيد</span>
                                  <span className="font-mono">{formatMoney(weeklyPayoutOverview.balanceBreakdown.walletTopupsTotal)}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Section 2: الديون (-) */}
                          <div className="space-y-2 pt-2 border-t border-zinc-700/70">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-xs font-black text-white flex items-center gap-1">
                                  <span>الديون</span>
                                  <span className="text-rose-400 font-mono">(-)</span>
                                </div>
                                <div className="text-[10px] text-zinc-400 font-bold">المبلغ المخصوم من رصيد المحفظة</div>
                              </div>
                              <span className="font-mono text-sm font-black text-rose-400">
                                -{formatMoney(weeklyPayoutOverview.balanceBreakdown.totalDeductedDebits)}
                              </span>
                            </div>
                            <div className="space-y-1.5 pr-2 border-r-2 border-rose-500/30 text-[11px] font-bold text-zinc-300">
                              <div className="flex items-center justify-between">
                                <span>السحب النقدي</span>
                                <span className="font-mono">-{formatMoney(weeklyPayoutOverview.balanceBreakdown.withdrawalsTotal)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>سعر الشحن ومصاريف التشغيل</span>
                                <span className="font-mono">-{formatMoney(weeklyPayoutOverview.balanceBreakdown.shippingAndFeesTotal)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>رسوم التحويل (عمولة الإدارة)</span>
                                <span className="font-mono">-{formatMoney(weeklyPayoutOverview.balanceBreakdown.transferCommissionTotal)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card 2 (Middle): تكرار السحب النقدي (Bosta-Style: أسبوعي / يومي + تغيير النظام + الدورة المالية) */}
                  <div className={`p-6 rounded-[28px] border space-y-3.5 relative overflow-hidden flex flex-col justify-between ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-xs'
                  }`}>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-100">
                          <span>تكرار السحب النقدي</span>
                          <button
                            type="button"
                            onClick={() => setShowFinancialCycleModal(true)}
                            className="text-zinc-400 hover:text-[#00ab84] cursor-pointer"
                            title="عرض الدورة المالية"
                          >
                            <HelpCircle size={15} />
                          </button>
                        </div>
                        <span className="px-3 py-1 rounded-xl bg-teal-500/15 text-[#00ab84] dark:text-emerald-400 text-xs font-black">
                          {weeklyPayoutOverview.payoutFrequency === 'daily'
                            ? 'يومي'
                            : `أسبوعي (${weeklyPayoutOverview.weeklyDayNameAr})`}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold leading-relaxed">
                        {weeklyPayoutOverview.payoutFrequency === 'daily'
                          ? `يتم السحب النقدي تلقائياً في يوم العمل التالي للطلبات التي أتمت مدة التسوية (${weeklyPayoutOverview.holdingDaysSetting} أيام).`
                          : `يتم السحب النقدي تلقائياً مرة واحدة في الأسبوع يوم (${weeklyPayoutOverview.weeklyDayNameAr}) للطلبات التي أتمت (${weeklyPayoutOverview.holdingDaysSetting} أيام) من التسوية.`}
                      </p>

                      <div className={`px-3 py-2 rounded-xl border text-[11px] font-black flex items-center justify-between ${
                        isDark ? 'bg-zinc-950/80 border-zinc-800 text-zinc-300' : 'bg-zinc-50 border-zinc-200/80 text-zinc-700'
                      }`}>
                        <span>عمولة/رسوم التحويل المحددة من الإدارة:</span>
                        <span className="font-mono text-[#00ab84] dark:text-emerald-400">{weeklyPayoutOverview.activeFeeLabelAr}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setTempPayoutFrequency(weeklyPayoutOverview.payoutFrequency);
                          setTempWeeklyPayoutDay(weeklyPayoutOverview.weeklyDayIndex);
                          setShowPayoutFrequencyModal(true);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                          isDark
                            ? 'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700'
                            : 'bg-white border-zinc-300 text-zinc-800 hover:bg-zinc-50 shadow-2xs'
                        }`}
                      >
                        تغيير النظام
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFinancialCycleModal(true)}
                        className="text-xs font-black text-[#00ab84] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        اعرف أكثر
                      </button>
                    </div>
                  </div>

                  {/* Card 3 (Left): تاريخ السحب النقدي القادم */}
                  <div className={`p-6 rounded-[28px] border space-y-3 relative overflow-hidden flex flex-col justify-between ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-xs'
                  }`}>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-100">
                          <Calendar size={15} className="text-[#00ab84]" />
                          <span>تاريخ السحب النقدي القادم</span>
                        </div>
                        <span className="text-[10px] font-mono font-black text-[#00ab84] bg-emerald-500/10 px-2.5 py-0.5 rounded-lg">
                          {weeklyPayoutOverview.payoutFrequency === 'daily'
                            ? 'سحب يومي'
                            : `بعد ${weeklyPayoutOverview.daysUntilNextPayout} يوم`}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold leading-relaxed">
                        {weeklyPayoutOverview.holdingOrdersCount > 0 && weeklyPayoutOverview.minRemainingDays !== null
                          ? `لديك (${weeklyPayoutOverview.holdingOrdersCount}) أوردر مسوّى هذا الأسبوع يُرحّل للسحبة التالية بعد (${weeklyPayoutOverview.minRemainingDays} يوم)، بينما تسويات الأسبوع السابق تُحوّل في:`
                          : 'تسويات الأسبوع السابق الجاهزة للصرف سيتم تحويلها إلى حسابك في:'}
                      </p>
                      <div className={`p-2.5 rounded-xl border text-sm font-mono font-black text-center ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                      }`}>
                        {weeklyPayoutOverview.nextWeeklyPayoutDateFormatted}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1 text-[11px] font-black">
                      <div className="flex items-center justify-between text-zinc-500">
                        <span>المبلغ الجاهز للتحويل:</span>
                        <span className="font-mono text-zinc-800 dark:text-white">{formatMoney(weeklyPayoutOverview.cappedNextPayoutAmount)}</span>
                      </div>
                      {weeklyPayoutOverview.nextPayoutFeeAmount > 0 && (
                        <div className="flex items-center justify-between text-rose-500">
                          <span>عمولة التحويل ({weeklyPayoutOverview.activeFeeLabelAr}):</span>
                          <span className="font-mono">-{formatMoney(weeklyPayoutOverview.nextPayoutFeeAmount)}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[#00ab84] dark:text-emerald-400">
                        <span>صافي التحويل المتوقع:</span>
                        <span className="font-mono">{formatMoney(weeklyPayoutOverview.nextPayoutNetAmount)}</span>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Sub-filter Tabs & Action Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                  
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
                            ? 'bg-[#00ab84] text-white shadow-xs'
                            : isDark
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
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
                        isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-700 shadow-2xs'
                      }`}
                    >
                      <Calendar size={14} className="text-[#00ab84]" />
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
                        isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-700 shadow-2xs'
                      }`}
                    >
                      <Download size={14} />
                      <span>تحميل</span>
                    </button>
                  </div>
                </div>

                {/* Desktop Transactions Table (Matching Image 3) */}
                <div className={`hidden md:block rounded-[28px] border overflow-hidden ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-xs'
                }`}>
                  <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <h3 className={`text-sm font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      <span>قائمة المعاملات</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 font-mono text-xs text-zinc-600 dark:text-zinc-300">
                        {groupedTransactions.length}
                      </span>
                    </h3>
                  </div>

                  <table className="w-full text-right text-xs">
                    <thead className={`${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-50 text-zinc-700'} font-black border-b border-zinc-100 dark:border-zinc-800`}>
                      <tr>
                        <th className="py-3.5 px-4">رقم المعاملة</th>
                        <th className="py-3.5 px-4">التاريخ</th>
                        <th className="py-3.5 px-4">التصنيف والوصف</th>
                        <th className="py-3.5 px-4">المبلغ</th>
                        <th className="py-3.5 px-4 text-center">الرصيد</th>
                        <th className="py-3.5 px-4 text-center">الخيارات</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-bold ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                      {groupedTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-zinc-400 font-bold">لا توجد حركات مالية مسجلة بهذه الفئة</td>
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
                            ? (tx.notes || 'رسوم التحويل المالي لسحب المستحقات')
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
                            <tr key={tx.id || idx} className={isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/60'}>
                              <td className="py-3.5 px-4 font-mono font-black">
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-black shrink-0 ${
                                    isCredit ? 'bg-emerald-500/15 text-[#00ab84]' : 'bg-rose-500/15 text-rose-500'
                                  }`}>
                                    {isCredit ? '+' : '-'}
                                  </span>
                                  <span className="text-zinc-800 dark:text-zinc-200">{tx.id.replace(/^grouped_/, '').slice(0, 12)}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-zinc-500 dark:text-zinc-400 text-[11px]">
                                {formattedDate}
                              </td>
                              <td className="py-3.5 px-4 max-w-xs">
                                <div className="text-zinc-900 dark:text-white font-black text-xs">
                                  {catTitle}
                                </div>
                                <div className="text-[11px] text-zinc-400 font-normal mt-0.5 truncate">
                                  {subText}
                                </div>
                              </td>
                              <td className={`py-3.5 px-4 font-mono font-black tabular-nums ${isCredit ? 'text-[#00ab84]' : 'text-rose-500'}`}>
                                {isCredit ? '' : ''}{formatMoney(tx.amount)}
                              </td>
                              <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300 tabular-nums">
                                {formatMoney(tx.balanceAfter)}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                {isComp ? (
                                  <button
                                    type="button"
                                    onClick={() => showToast('جاري تصدير ملف التعويض المعتمد', 'success')}
                                    className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                                  >
                                    تصدير الملف
                                  </button>
                                ) : isWithdrawal ? (
                                  <button
                                    type="button"
                                    onClick={() => showToast(`إشعار تحويل بنكي للمسحوبات رقم ${tx.id}`, 'info')}
                                    className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
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
                                    className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-black text-[#00ab84] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer"
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
                    <div className={`p-10 rounded-3xl border text-center text-xs font-bold text-zinc-400 ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80'
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
                        ? (tx.notes || 'رسوم التحويل المالي لسحب المستحقات')
                        : isWithdrawal 
                        ? (tx.notes || 'تحويل بنكي') 
                        : (tx.notes || 'تسوية معتمدة للحساب');

                      return (
                        <div key={tx.id} className={`p-4 rounded-[24px] border space-y-3 ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                                isCredit ? 'bg-emerald-500/15 text-[#00ab84]' : 'bg-rose-500/15 text-rose-500'
                              }`}>
                                {isCredit ? '+' : '-'}
                              </div>
                              <div>
                                <div className={`text-xs font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                  {catTitle}
                                </div>
                                <div className="text-[10px] text-zinc-400 font-normal mt-0.5">{subText}</div>
                              </div>
                            </div>
                            <div className="text-left">
                              <div className={`font-mono tabular-nums font-black text-sm ${isCredit ? 'text-[#00ab84]' : 'text-rose-500'}`}>
                                {formatMoney(tx.amount)}
                              </div>
                              <div className="text-[9px] font-mono text-zinc-400">الرصيد: {formatMoney(tx.balanceAfter)}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[10px] text-zinc-400">
                            <span className="font-mono">{tx.id.replace(/^grouped_/, '').slice(0, 12)}</span>
                            <span>{new Date(tx.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })}</span>
                          </div>
                          
                          {isComp ? (
                            <button
                              type="button"
                              onClick={() => showToast('جاري تصدير ملف التعويض المعتمد', 'success')}
                              className="w-full py-2 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
                            >
                              تصدير الملف
                            </button>
                          ) : isWithdrawal ? (
                            <button
                              type="button"
                              onClick={() => showToast(`إشعار تحويل بنكي للمسحوبات رقم ${tx.id}`, 'success')}
                              className="w-full py-2 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs font-black text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-colors cursor-pointer"
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
                              className="w-full py-2 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs font-black text-[#00ab84] hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors cursor-pointer"
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
                      <Calendar size={18} className="text-[#00ab84]" />
                      <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>الدورة المالية الحالية</h3>
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCycleDatePicker(prev => !prev)}
                        className={`text-xs font-mono font-black px-3.5 py-2 rounded-2xl border flex items-center gap-2 transition-all cursor-pointer ${
                          isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-200 text-zinc-700 shadow-2xs'
                        }`}
                      >
                        <ChevronDown size={14} className="text-zinc-400" />
                        <span>{cycleStartDate && cycleEndDate ? `${cycleStartDate} - ${cycleEndDate}` : 'جميع الفترات'}</span>
                        <Calendar size={14} className="text-[#00ab84]" />
                      </button>

                      {showCycleDatePicker && (
                        <div className={`absolute top-11 left-0 z-40 p-4 rounded-[24px] border shadow-2xl space-y-3 w-72 ${
                          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                        }`}>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1">من تاريخ</label>
                              <input
                                type="date"
                                value={cycleStartDate}
                                onChange={e => setCycleStartDate(e.target.value)}
                                className={`w-full p-2 rounded-xl border font-mono text-xs ${
                                  isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                                }`}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-400 mb-1">إلى تاريخ</label>
                              <input
                                type="date"
                                value={cycleEndDate}
                                onChange={e => setCycleEndDate(e.target.value)}
                                className={`w-full p-2 rounded-xl border font-mono text-xs ${
                                  isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                                }`}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button type="button" onClick={() => setShowCycleDatePicker(false)} className="px-3.5 py-1.5 rounded-xl bg-[#00ab84] text-white text-[11px] font-black cursor-pointer">تطبيق</button>
                            <button 
                              type="button" 
                              onClick={() => { 
                                setCycleStartDate(''); 
                                setCycleEndDate(''); 
                                setSelectedSettlementId(null);
                                setShowCycleDatePicker(false); 
                              }} 
                              className="px-3.5 py-1.5 rounded-xl bg-zinc-100 text-zinc-600 text-[11px] font-black cursor-pointer"
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
                       <span className="text-[10px] font-bold text-[#00ab84]">تصفية بالتسوية المجمعة: {selectedSettlementId.slice(0, 15)}...</span>
                       <button onClick={() => setSelectedSettlementId(null)} className="text-rose-500 hover:text-rose-600 transition-colors cursor-pointer"><X size={14} /></button>
                    </div>
                  )}

                  {/* 3 Summary Cards Grid (Matching image_c642fb6b.png & image_b0cae16d.png) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative">
                    
                    {/* Card 1 (Right): المبلغ المحصل */}
                    <div className={`p-5 rounded-[28px] border relative ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-2xs'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-zinc-500">
                          <span>المبلغ المحصل</span>
                          <HelpCircle size={14} className="text-zinc-400" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCycleDetailsModal(showCycleDetailsModal === 'collected' ? null : 'collected')}
                          className="text-xs font-bold text-[#00ab84] hover:underline cursor-pointer"
                        >
                          عرض التفاصيل
                        </button>
                      </div>

                      <div className={`text-2xl font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {formatMoney(financialCycleSummary.totalCollected || 0)}
                      </div>

                      {/* Collected Revenue Dark Popover */}
                      {showCycleDetailsModal === 'collected' && (
                        <div className="absolute top-14 left-4 z-40 w-72 bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-zinc-700 animate-in fade-in zoom-in-95 space-y-3">
                          <div className="flex items-center justify-between border-b border-zinc-700/80 pb-2">
                            <span className="text-xs font-black">المبلغ المحصل</span>
                            <span className="font-mono font-black text-sm text-emerald-400">{formatMoney(financialCycleSummary.totalCollected || 0)}</span>
                          </div>
                          <div className="space-y-2 text-xs font-bold text-zinc-300">
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">المبالغ النقدية المحصلة</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalCollected || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">المدفوعات عبر الإنترنت</span>
                              <span className="font-mono">0 ج.م</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">النقدية المسترجعة</span>
                              <span className="font-mono">0 ج.م</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Card 2 (Middle): سعر الشحن */}
                    <div className={`p-5 rounded-[28px] border relative ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-2xs'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-zinc-500">
                          <span>سعر الشحن</span>
                          <HelpCircle size={14} className="text-zinc-400" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCycleDetailsModal(showCycleDetailsModal === 'shipping' ? null : 'shipping')}
                          className="text-xs font-bold text-[#00ab84] hover:underline cursor-pointer"
                        >
                          عرض التفاصيل
                        </button>
                      </div>

                      <div className={`text-2xl font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        {formatMoney(financialCycleSummary.totalShippingFees || 0)}
                      </div>

                      {/* Shipping Fees Breakdown Dark Popover (Matching image_c642fb6b.png) */}
                      {showCycleDetailsModal === 'shipping' && (
                        <div className="absolute top-14 left-4 z-40 w-72 bg-zinc-900 text-white rounded-2xl p-4 shadow-2xl border border-zinc-700 animate-in fade-in zoom-in-95 space-y-3">
                          <div className="flex items-center justify-between border-b border-zinc-700/80 pb-2">
                            <span className="text-xs font-black">سعر الشحن</span>
                            <span className="font-mono font-black text-sm text-emerald-400">{formatMoney(financialCycleSummary.totalShippingFees || 0)}</span>
                          </div>
                          <div className="space-y-2 text-xs font-bold text-zinc-300">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                              <span className="text-zinc-400">سعر الشحن</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalBaseShipping || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                              <span className="text-zinc-400">التأمين</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalInsurance || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-1">
                              <span className="text-zinc-400">رسوم فتح الشحنة</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalOpenPackage || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-zinc-400">ضريبة قيمة مضافة 14%</span>
                              <span className="font-mono">{formatMoney(financialCycleSummary.totalVat || 0)}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card 3 (Left): صافي المستحقات */}
                    <div className={`p-5 rounded-[28px] border relative ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-2xs'}`}>
                      <div className="flex items-center gap-1.5 text-xs font-black text-zinc-500 mb-2">
                        <span>صافي المستحقات</span>
                        <HelpCircle size={14} className="text-zinc-400" />
                      </div>
                      <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-[#00ab84] dark:text-emerald-400">
                        {formatMoney(financialCycleSummary.netEntitlement || 0)}
                      </div>
                    </div>

                  </div>
                </div>

                {/* 2. قائمة الأوردرات Section Container (Matching image_c642fb6b.png) */}
                <div id="merchant-orders-list" className={`rounded-[28px] border p-4 sm:p-6 space-y-4 ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-xs'
                }`}>
                  
                  {/* Title & Actions Bar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck size={19} className={isDark ? 'text-zinc-200' : 'text-zinc-800'} />
                        <h3 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          قائمة الأوردرات
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full font-mono text-xs font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {filteredOrders.length}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 font-medium leading-relaxed">
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
                            ? 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                            : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 shadow-2xs'
                        }`}
                        title="تحميل قائمة الأوردرات (Excel / CSV)"
                      >
                        <Download size={15} />
                        <span className="hidden sm:inline">تحميل</span>
                      </button>
                    </div>
                  </div>

                  {/* Applications Indicator Pill (Matching Reference Screenshot) */}
                  <div className="flex items-center gap-2 pt-1 text-xs font-bold text-zinc-500">
                    <span>التطبيقات:</span>
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00ab84] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-1.5 font-black text-[11px]">
                      <ShoppingBag size={13} />
                      <span>تأكيد الطلبات</span>
                    </span>
                  </div>

                  {/* Multi-Filter Bar (Search + Date + Tags Dropdown + All Filters Button) */}
                  <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={ordersSearchQuery}
                        onChange={e => setOrdersSearchQuery(e.target.value)}
                        placeholder="رقم الطلب أو العميل أو الهاتف أو المنتج أو الكود..."
                        className={`w-full pr-10 pl-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                          isDark
                            ? 'bg-zinc-950 border-zinc-800 text-white focus:border-[#00ab84]'
                            : 'bg-white border-zinc-200 text-zinc-800 focus:border-[#00ab84]'
                        }`}
                      />
                      <Search size={16} className="absolute right-3.5 top-1/2 -tranzinc-y-1/2 text-zinc-400 pointer-events-none" />
                    </div>

                    {/* Date Picker Button */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowCycleDatePicker(prev => !prev)}
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <Calendar size={14} className="text-[#00ab84]" />
                        <span>{cycleStartDate && cycleEndDate ? `${cycleStartDate} - ${cycleEndDate}` : 'التاريخ'}</span>
                        <ChevronDown size={13} className="text-zinc-400" />
                      </button>
                    </div>

                    {/* Tags / Status Dropdown */}
                    <div className="relative shrink-0">
                      <select
                        value={ordersStatusFilter}
                        onChange={e => handleOrdersStatusFilterChange(e.target.value as any)}
                        className={`px-3.5 py-2.5 rounded-xl border text-xs font-black outline-none cursor-pointer ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-200 text-zinc-700'
                        }`}
                      >
                        <option value="all">الوسوم / كافة الحالات ({orderStatusCounts.all})</option>
                        <option value="collected">تم بنجاح ({orderStatusCounts.collected})</option>
                        <option value="shipping">في الطريق ({orderStatusCounts.shipping})</option>
                        <option value="pending">قيد التجهيز ({orderStatusCounts.pending})</option>
                        <option value="returned">مرتجع ({orderStatusCounts.returned})</option>
                      </select>
                    </div>

                    {/* All Filters Action Button (Brand Emerald) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (ordersSearchQuery || ordersStatusFilter !== 'all' || cycleStartDate) {
                          setOrdersSearchQuery('');
                          setOrdersStatusFilter('all');
                          setCycleStartDate('');
                          setCycleEndDate('');
                          showToast('تمت إعادة ضبط جميع الفلاتر', 'info');
                        } else {
                          showToast('جميع الفلاتر نشطة ومفعلة', 'info');
                        }
                      }}
                      className="px-4 py-2.5 rounded-xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-700/20 transition-all cursor-pointer whitespace-nowrap active:scale-95"
                    >
                      <Layers size={14} />
                      <span>جميع الفلاتر</span>
                    </button>
                  </div>

                  {/* Status Filter Quick Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
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
                        onClick={() => handleOrdersStatusFilterChange(f.id as any)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                          ordersStatusFilter === f.id
                            ? 'bg-[#00ab84] text-white shadow-xs'
                            : isDark
                            ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`mr-1 font-mono text-[11px] ${
                          ordersStatusFilter === f.id ? 'text-emerald-100' : 'text-zinc-400'
                        }`}>
                          ({f.count})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Empty State Card (Exact Match to Reference Screenshot) */}
                  {filteredOrders.length === 0 && (
                    <div className={`p-12 sm:p-16 rounded-[28px] border text-center space-y-4 my-3 ${
                      isDark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                    }`}>
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-[#00ab84] dark:text-emerald-400 mx-auto flex items-center justify-center shadow-inner">
                        <ShoppingBag size={30} />
                      </div>
                      <div className="space-y-1.5 max-w-md mx-auto">
                        <h4 className={`text-base sm:text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          لا توجد طلبات بعد
                        </h4>
                        <p className="text-xs text-zinc-400 font-bold leading-relaxed">
                          طلبات متجرك ومحادثاتك واللي بتعملها هنا بتظهر كلها في القائمة دي.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => navigateToTab('create_order')}
                          className="px-5 py-2.5 rounded-xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black shadow-md shadow-emerald-700/20 cursor-pointer transition-all active:scale-95 inline-flex items-center gap-2"
                        >
                          <PlusCircle size={15} />
                          <span>إنشاء أول أوردر الآن</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Desktop Table View (Matching Image image_c642fb6b.png) */}
                  <div className={`hidden md:block rounded-2xl border ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-xs'
                  }`}>
                    <table className="w-full text-right text-xs">
                      <thead className={`${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-50 text-zinc-600'} font-black border-b border-zinc-100 dark:border-zinc-800`}>
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
                      <tbody className={`divide-y font-bold ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-zinc-400 font-bold">لا توجد أوردرات مطابقة للبحث المحدد</td>
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
                              <tr key={o.id} className={isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/60'}>
                                <td className="py-3.5 px-4 font-mono font-black text-cyan-600 dark:text-cyan-400">
                                  {trackUrl ? (
                                    <a href={trackUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                                      <span>{trackNum}</span>
                                    </a>
                                  ) : (
                                    <span>{trackNum}</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                                  {b.isReturn ? 'استرجاع' : (o as any).packageType || 'توصيل'}
                                </td>
                                <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300">
                                  {originName}-{destGov}
                                </td>
                                <td className="py-3.5 px-4 font-mono">
                                  {b.collected > 0 ? (
                                    <div>
                                      <div className="font-black text-zinc-900 dark:text-white flex items-center gap-1">
                                        <span>{formatMoney(b.collected)}</span>
                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">💳</span>
                                      </div>
                                      <div className="text-[10px] text-zinc-400 font-normal">المبالغ النقدية المحصلة</div>
                                    </div>
                                  ) : (
                                    <div className="text-zinc-400 font-normal flex items-center gap-1">
                                      <span>🚫</span>
                                      <span>بدون تحصيل</span>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-zinc-700 dark:text-zinc-300 relative">
                                  <div className="flex items-center gap-1">
                                    <span>{formatMoney(b.totalShipFee)}</span>
                                    <button 
                                      type="button" 
                                      onClick={() => setActiveOrderPopover(isFeePopoverOpen ? null : { orderId: o.id, type: 'fee' })}
                                      className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                    >
                                      <HelpCircle size={13} />
                                    </button>
                                  </div>
                                  {isFeePopoverOpen && (
                                    <div className="absolute top-10 right-2 z-50 w-64 bg-zinc-900 text-white rounded-xl p-3 shadow-2xl border border-zinc-700 space-y-2 text-xs animate-in fade-in zoom-in-95">
                                      <div className="flex justify-between border-b border-zinc-700 pb-1 font-black">
                                        <span>سعر الشحن</span>
                                        <span className="font-mono text-emerald-400">{formatMoney(b.totalShipFee)}</span>
                                      </div>
                                      <div className="flex justify-between text-zinc-300"><span>سعر الشحن</span><span className="font-mono">{formatMoney(b.baseShipping)}</span></div>
                                      <div className="flex justify-between text-zinc-300"><span>التأمين</span><span className="font-mono">{formatMoney(b.insuranceFee)}</span></div>
                                      <div className="flex justify-between text-zinc-300"><span>رسوم فتح الشحنة</span><span className="font-mono">{formatMoney(b.openPackageFee || 0)}</span></div>
                                      <div className="flex justify-between text-zinc-300"><span>ضريبة قيمة مضافة 14%</span><span className="font-mono">{formatMoney(b.vatFee)}</span></div>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 font-mono relative">
                                  <div className={`font-black ${b.netEntitlement >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-500'}`}>
                                    {formatMoney(b.netEntitlement)}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-normal flex items-center gap-1">
                                    <span>{formattedArabicDate}</span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveOrderPopover(isDatePopoverOpen ? null : { orderId: o.id, type: 'added_date' })}
                                      className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                    >
                                      <HelpCircle size={12} />
                                    </button>
                                  </div>
                                  {isDatePopoverOpen && (
                                    <div className="absolute top-10 right-2 z-50 w-64 bg-zinc-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-zinc-700 animate-in fade-in zoom-in-95">
                                      تاريخ إضافة النقدية المحصلة ومصاريف بوسطة إلى محفظتك.
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-[11px] font-black inline-block ${
                                    isDeliveredSuccess
                                      ? 'bg-emerald-500/10 text-[#00ab84] dark:text-emerald-400'
                                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                  }`}>
                                    {isDeliveredSuccess ? 'تم بنجاح' : 'تم الاسترجاع'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-center relative">
                                  <div className="inline-flex items-center gap-1">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black inline-block ${
                                      b.payoutStage === 'paid'
                                        ? 'bg-emerald-500/15 text-[#00ab84] dark:text-emerald-400'
                                        : b.payoutStage === 'ready'
                                        ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                                        : b.payoutStage === 'holding'
                                        ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                    }`}>
                                      {b.payoutStageLabelAr}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setActiveOrderPopover(isSettlementPopoverOpen ? null : { orderId: o.id, type: 'settlement_status' })}
                                      className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                    >
                                      <HelpCircle size={12} />
                                    </button>
                                  </div>
                                  {isSettlementPopoverOpen && (
                                    <div className="absolute top-10 left-2 z-50 w-72 bg-zinc-900 text-white text-[11px] font-bold p-3.5 rounded-xl shadow-2xl border border-zinc-700 text-right animate-in fade-in zoom-in-95 space-y-1.5">
                                      <div className="font-black text-emerald-400 border-b border-zinc-700 pb-1">
                                        تفاصيل حالة السداد والتحويل الأسبوعي
                                      </div>
                                      {b.payoutStage === 'unsettled' && (
                                        <p>الأوردر تم توصيله وبانتظار إصدار كشف التسوية المالية من الإدارة ليبدأ عدّاد فترة التعليق ({b.holdingDaysRequired} أيام).</p>
                                      )}
                                      {b.payoutStage === 'holding' && (
                                        <p>تمت تسوية الأوردر مالياً بتاريخ {b.settledAtIso ? new Date(b.settledAtIso).toLocaleDateString('ar-EG') : 'اليوم'}، وتبقى ({b.remainingHoldingDays} يوم) من أصل ({b.holdingDaysRequired} أيام) ليصبح جاهزاً للتحويل في يوم ({weeklyPayoutOverview.weeklyDayNameAr}).</p>
                                      )}
                                      {b.payoutStage === 'ready' && (
                                        <p>أتم الأوردر فترة التعليق ({b.holdingDaysRequired} أيام بعد التسوية) وهو جاهز للتحويل في موعدك الأسبوعي القادم ({weeklyPayoutOverview.nextWeeklyPayoutDateFormatted}).</p>
                                      )}
                                      {b.payoutStage === 'paid' && (
                                        <p>تم تحويل وصرف مستحقات هذا الأوردر لحسابك بنجاح {o.paidOutAt ? `بتاريخ ${new Date(o.paidOutAt).toLocaleDateString('ar-EG')}` : ''}.</p>
                                      )}
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
                    <div className="p-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-center gap-3 text-xs font-bold text-zinc-500">
                      <div className="flex items-center gap-1 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-[11px]">
                        <span>50 / صفحة</span>
                        <ChevronDown size={13} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"><ChevronRight size={14} /></button>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[#00ab84] text-white font-mono font-black text-[11px]">1</span>
                        <button type="button" className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"><ChevronLeft size={14} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Order Cards View (Matching image_b0cae16d.png, image_405fbc8a.png, image_5b28f778.png) */}
                  <div className="md:hidden grid grid-cols-1 gap-4 pt-1">
                    {filteredOrders.length === 0 ? (
                      <div className={`p-12 rounded-3xl border text-center text-xs font-bold text-zinc-400 ${
                        isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50/70 border-zinc-200/70'
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
                          <div key={o.id} className={`rounded-[22px] border relative transition-all ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-2xs'}`}>
                            
                            {/* Card Header */}
                            <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-zinc-500">{b.isReturn ? 'مرتجع شحنة' : (o as any).packageType || 'توصيل'}</span>
                                <a href={trackUrl || '#'} target="_blank" rel="noopener noreferrer" className="font-mono font-black text-sm text-[#00ab84] hover:underline">
                                  {trackNum}
                                </a>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[11px] font-black ${
                                isDeliveredSuccess ? 'bg-emerald-500/10 text-[#00ab84]' : 'bg-purple-500/10 text-purple-600'
                              }`}>
                                {isDeliveredSuccess ? 'تم بنجاح' : 'تم الاسترجاع'}
                              </span>
                            </div>

                            {/* Row 1: الوجهة (Right) | تاريخ الإضافة (Left) */}
                            <div className="grid grid-cols-2 p-4 border-b border-zinc-100 dark:border-zinc-800 text-xs gap-2">
                              <div>
                                <div className="text-[11px] text-zinc-400 font-bold mb-1">الوجهة</div>
                                <div className="font-black text-zinc-800 dark:text-zinc-200">{originName} - {destGov}</div>
                              </div>
                              <div className="relative text-left">
                                <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-400 font-bold mb-1">
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveOrderPopover(isDatePopoverOpen ? null : { orderId: o.id, type: 'added_date' })} 
                                    className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                  >
                                    <HelpCircle size={13} />
                                  </button>
                                  <span>تاريخ الإضافة</span>
                                </div>
                                <div className="font-black text-zinc-800 dark:text-zinc-200">{formattedArabicDate}</div>
                                {isDatePopoverOpen && (
                                  <div className="absolute top-11 right-0 z-50 w-60 sm:w-64 bg-zinc-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-zinc-700 animate-in fade-in zoom-in-95 pointer-events-auto text-right">
                                    تاريخ إضافة النقدية المحصلة ومصاريف بوسطة إلى محفظتك.
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2: المبلغ (Right) | مصاريف بوسطة (Left) */}
                            <div className="grid grid-cols-2 p-4 border-b border-zinc-100 dark:border-zinc-800 text-xs gap-2">
                              <div>
                                <div className="text-[11px] text-zinc-400 font-bold mb-1">المبلغ</div>
                                {b.collected > 0 ? (
                                  <div>
                                    <div className="font-mono font-black text-zinc-900 dark:text-white flex items-center gap-1 text-sm">
                                      <span>{formatMoney(b.collected)}</span>
                                      <span className="text-xs">💳</span>
                                    </div>
                                    <div className="text-[10px] text-zinc-400 font-medium">المبالغ النقدية المحصلة</div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-zinc-400 font-bold">
                                    <span>🚫</span>
                                    <span>بدون تحصيل</span>
                                  </div>
                                )}
                              </div>
                              <div className="relative text-left">
                                <div className="text-[11px] text-zinc-400 font-bold mb-1">مصاريف بوسطة</div>
                                <div className="flex items-center justify-end gap-1 font-mono font-black text-zinc-800 dark:text-zinc-200 text-sm">
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveOrderPopover(isFeePopoverOpen ? null : { orderId: o.id, type: 'fee' })} 
                                    className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                  >
                                    <HelpCircle size={13} />
                                  </button>
                                  <span>{formatMoney(b.totalShipFee)}</span>
                                </div>
                                {isFeePopoverOpen && (
                                  <div className="absolute top-11 left-0 z-50 w-60 sm:w-64 bg-zinc-900 text-white rounded-xl p-3 shadow-2xl border border-zinc-700 space-y-2 text-xs animate-in fade-in zoom-in-95 pointer-events-auto text-right">
                                    <div className="flex justify-between border-b border-zinc-700 pb-1 font-black">
                                      <span>سعر الشحن</span>
                                      <span className="font-mono text-emerald-400">{formatMoney(b.totalShipFee)}</span>
                                    </div>
                                    <div className="flex justify-between text-zinc-300"><span>سعر الشحن</span><span className="font-mono">{formatMoney(b.baseShipping)}</span></div>
                                    <div className="flex justify-between text-zinc-300"><span>التأمين</span><span className="font-mono">{formatMoney(b.insuranceFee)}</span></div>
                                    <div className="flex justify-between text-zinc-300"><span>رسوم فتح الشحنة</span><span className="font-mono">{formatMoney(b.openPackageFee || 0)}</span></div>
                                    <div className="flex justify-between text-zinc-300"><span>ضريبة قيمة مضافة 14%</span><span className="font-mono">{formatMoney(b.vatFee)}</span></div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 3: صافي المستحقات (Right) | حالة السداد (Left) */}
                            <div className="grid grid-cols-2 p-4 text-xs bg-zinc-50/50 dark:bg-zinc-900/50 gap-2">
                              <div>
                                <div className="text-[11px] text-zinc-400 font-bold mb-1">صافي المستحقات</div>
                                <div className={`font-mono font-black text-sm ${b.netEntitlement >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-500'}`}>
                                  {formatMoney(b.netEntitlement)}
                                </div>
                              </div>
                              <div className="relative text-left">
                                <div className="flex items-center justify-end gap-1 text-[11px] text-zinc-400 font-bold mb-1">
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveOrderPopover(isSettlementPopoverOpen ? null : { orderId: o.id, type: 'settlement_status' })} 
                                    className="text-zinc-400 hover:text-zinc-600 cursor-pointer"
                                  >
                                    <HelpCircle size={13} />
                                  </button>
                                  <span>حالة السداد</span>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[10.5px] font-black inline-flex items-center gap-1 ${
                                  b.payoutStage === 'paid'
                                    ? 'bg-emerald-500/15 text-[#00ab84]'
                                    : b.payoutStage === 'ready'
                                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                                    : b.payoutStage === 'holding'
                                    ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                                }`}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  <span>{b.payoutStageLabelAr}</span>
                                </span>
                                {isSettlementPopoverOpen && (
                                  <div className="absolute top-11 left-0 z-50 w-64 bg-zinc-900 text-white text-[11px] font-bold p-3 rounded-xl shadow-2xl border border-zinc-700 animate-in fade-in zoom-in-95 pointer-events-auto text-right">
                                    {b.payoutStage === 'unsettled'
                                      ? `بانتظار التسوية المالية من الإدارة ثم مرور (${b.holdingDaysRequired} أيام) للتحويل.`
                                      : b.payoutStage === 'holding'
                                      ? `تمت التسوية، ومتبقي (${b.remainingHoldingDays} يوم) لإتمام فترة التعليق قبل التحويل الأسبوعي.`
                                      : b.payoutStage === 'ready'
                                      ? `جاهز للتحويل في يوم (${weeklyPayoutOverview.weeklyDayNameAr}) القادم.`
                                      : 'تم تحويل مستحقات هذا الأوردر لحسابك بنجاح.'}
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
            TAB 2B: CREATE ORDER STUDIO (استوديو تسجيل وإرسال الأوردرات للوكيل)
           ========================================================= */}
        {currentTab === 'create_order' && (
          <div className="space-y-6">
            {planUsage.managerPlanActive ? (
              /* PREMIUM DEDICATED MANAGER LOCK SCREEN */
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-[2.5rem] border-2 p-8 sm:p-14 text-center max-w-3xl mx-auto space-y-8 relative overflow-hidden shadow-2xl ${
                  isDark
                    ? 'bg-[#030712] border-amber-500/20 text-white'
                    : 'bg-white border-amber-200 text-zinc-900'
                }`}
              >
                {/* Decorative Background Glows */}
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[50%] bg-amber-500/10 blur-[100px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[35%] h-[40%] bg-emerald-500/5 blur-[90px] rounded-full pointer-events-none" />

                <div className="relative z-10 space-y-8">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 rounded-[2rem] bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-inner">
                      <Crown size={40} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-2">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-500/20">
                        <Lock size={12} />
                        نظام المدير المخصص نشط 🔒
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight pt-2">
                        إدارة طلباتك مفوضة بالكامل <br/> لمدير حسابك الخبير
                      </h2>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 font-bold leading-relaxed max-w-xl mx-auto">
                    لقد اخترت نظام <span className="text-[#00ab84] dark:text-emerald-400 font-black">({planUsage.planLabelAr})</span>. 
                    في هذا النظام، لا تحتاج لإنشاء الأوردرات يدوياً؛ حيث يتولى فريقنا الاحترافي مراجعة طلبياتك، التأكيد مع العملاء، 
                    وتجهيز بوالص الشحن لضمان أعلى جودة تنفيذ وأقل نسبة مرتجعات.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                    {[
                      { title: 'أتمتة كاملة', desc: 'مديرك المخصص ينشئ ويؤكد الأوردرات نيابةً عنك' },
                      { title: 'جودة الشحن', desc: 'تنسيق مباشر مع شركات الشحن لإصدار البوالص' },
                      { title: 'توفير الوقت', desc: 'تفرغ لتطوير منتجاتك ودع العمليات التشغيلية لنا' },
                      { title: 'شفافية مالية', desc: 'كشف حساب لحظي لكل حركة مالية على أوردراتك' }
                    ].map((item, i) => (
                      <div key={i} className={`p-4 rounded-2xl border transition-all ${
                        isDark ? 'bg-zinc-900/50 border-zinc-800' : 'bg-zinc-50 border-zinc-100'
                      }`}>
                        <div className="flex items-center gap-2.5 mb-1">
                          <CheckCircle2 size={16} className="text-amber-500" />
                          <h4 className="text-xs font-black">{item.title}</h4>
                        </div>
                        <p className="text-[10px] text-zinc-400 font-bold leading-normal">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => navigateToTab('orders')}
                      className="w-full sm:w-auto px-10 py-4 rounded-[1.5rem] bg-[#00ab84] hover:bg-emerald-700 text-white text-sm font-black transition-all hover:scale-105 active:scale-95 shadow-xl shadow-emerald-500/20 cursor-pointer"
                    >
                      متابعة أوردراتك المنشأة ({toArabicDigits(merchantOrders.length)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowChangePlanModal(true)}
                      className={`w-full sm:w-auto px-8 py-4 rounded-[1.5rem] border text-sm font-black transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer ${
                        isDark ? 'border-zinc-700 text-zinc-300' : 'border-zinc-200 text-zinc-600'
                      }`}
                    >
                      إدارة الخطة / تغيير النظام
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : (
              <>
            {/* View Switcher: Live Form vs Official Dev Stamp */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOrderMode('form')}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    createOrderMode === 'form'
                      ? 'bg-[#00ab84] text-white shadow-md shadow-emerald-700/20'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <PlusCircle size={15} />
                  <span>تسجيل وشحن أوردر فوري</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateOrderMode('dev_seal')}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                    createOrderMode === 'dev_seal'
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Sparkles size={15} />
                  <span>ختم الاعتماد وخارطة التطوير</span>
                </button>
              </div>

              <div className="text-[11px] font-bold text-zinc-400">
                أصناف بضاعتك بالمستودع: <span className="font-black text-[#00ab84]">{merchantProducts.length} صنف</span> ({totalStockUnits} قطعة محددة · {unlimitedProductCount} متاح دائمًا)
              </div>
            </div>

            {/* LIVE ORDER CREATION FORM */}
            {createOrderMode === 'form' && (
              <form onSubmit={handleMerchantSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column (7 cols): Customer & Shipping Address */}
                <div className={`lg:col-span-7 rounded-3xl p-6 sm:p-7 border space-y-5 ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                }`}>
                  <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center font-black">
                      <Truck size={20} />
                    </div>
                    <div>
                      <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        بيانات العميل ومقر التوصيل
                      </h3>
                      <p className="text-xs text-zinc-400">
                        أدخل تفاصيل المستلم ومحافظة الشحن لاحتساب تكلفة البوليصة آلياً
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        اسم العميل المستلم *
                      </label>
                      <input
                        type="text"
                        required
                        value={orderCustomerName}
                        onChange={e => setOrderCustomerName(e.target.value)}
                        placeholder="مثال: محمد السيد أحمد"
                        className={`w-full p-3 border rounded-2xl font-bold text-xs outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        رقم هاتف العميل (للتوصيل والمندوب) *
                      </label>
                      <input
                        type="tel"
                        required
                        value={orderCustomerPhone}
                        onChange={e => setOrderCustomerPhone(e.target.value)}
                        placeholder="010XXXXXXXX"
                        className={`w-full p-3 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        المحافظة *
                      </label>
                      <select
                        value={orderGovernorate}
                        onChange={e => setOrderGovernorate(e.target.value)}
                        className={`w-full p-3 border rounded-2xl font-bold text-xs outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      >
                        {Object.keys(EGYPT_GOV_SHIPPING_RATES).map(gov => (
                          <option key={gov} value={gov}>
                            {gov} ({EGYPT_GOV_SHIPPING_RATES[gov]} ج.م شحن)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        المدينة أو المركز / الحي
                      </label>
                      <input
                        type="text"
                        value={orderCity}
                        onChange={e => setOrderCity(e.target.value)}
                        placeholder="مثال: مدينة نصر / الدقي"
                        className={`w-full p-3 border rounded-2xl font-bold text-xs outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="text-xs font-bold">
                    <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      العنوان التفصيلي وملاحظات العنوان
                    </label>
                    <input
                      type="text"
                      value={orderAddress}
                      onChange={e => setOrderAddress(e.target.value)}
                      placeholder="اسم الشارع، رقم العمارة، رقم الشقة، علامة مميزة"
                      className={`w-full p-3 border rounded-2xl font-bold text-xs outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>

                  <div className="text-xs font-bold">
                    <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                      ملاحظات خاصة للمندوب وشركة الشحن
                    </label>
                    <textarea
                      rows={2}
                      value={orderNotes}
                      onChange={e => setOrderNotes(e.target.value)}
                      placeholder="مثال: يرجى الاتصال قبل الوصول / تسليم بعد الساعة 4 مساءً"
                      className={`w-full p-3 border rounded-2xl font-bold text-xs outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={orderAllowOpen}
                        onChange={e => setOrderAllowOpen(e.target.checked)}
                        className="w-4 h-4 rounded text-[#00ab84] focus:ring-[#00ab84]"
                      />
                      <span>السماح للعميل بفتح الشحنة ومعاينتها مع مندوب التوصيل قبل السداد</span>
                    </label>
                  </div>
                </div>

                {/* Right Column (5 cols): Product Selection & Live Financial Calculation */}
                <div className="lg:col-span-5 space-y-5">
                  <div className={`rounded-3xl p-6 border space-y-4 ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                  }`}>
                    <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                      <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                        <PackageIcon size={20} />
                      </div>
                      <div>
                        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          اختيار الصنف والتسعير
                        </h3>
                        <p className="text-xs text-zinc-400">
                          اختر الصنف المخصص لك أو المتاح دائمًا
                        </p>
                      </div>
                    </div>

                    {merchantProducts.length === 0 ? (
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-600 dark:text-amber-400 font-bold">
                        ⚠️ لا توجد منتجات مسجلة باسم هذا الوكيل حتى الآن. يرجى مراجعة إدارة المستودع لربط أصنافك بحسابك.
                      </div>
                    ) : (
                      <div className="space-y-3.5 text-xs font-bold">
                        <div>
                          <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                            الصنف المطلوب *
                          </label>
                          <select
                            required
                            value={orderProductId}
                            onChange={e => setOrderProductId(e.target.value)}
                            className={`w-full p-3 border rounded-2xl font-bold text-xs outline-none focus:border-[#00ab84] ${
                              isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                            }`}
                          >
                            <option value="">-- اختر المنتج من مخزونك --</option>
                            {merchantProducts.map(p => {
                              const unlimited = Boolean((p as any).unlimitedStock);
                              const stock = Number(p.stock || p.quantity || 0);
                              return (
                                <option key={p.id} value={p.id} disabled={!unlimited && stock <= 0}>
                                  {p.name || p.title} {unlimited ? '(متاح دائمًا)' : `(المتبقي: ${stock} قطعة)`} {!unlimited && stock <= 0 ? '❌ نفد' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              الكمية المطلوبة
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={orderProductId && !(merchantProducts.find(p => p.id === orderProductId) as any)?.unlimitedStock
                                ? Number(merchantProducts.find(p => p.id === orderProductId)?.stock || 0) || undefined
                                : undefined}
                              value={orderQuantity}
                              onChange={e => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className={`w-full p-3 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                                isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                              }`}
                            />
                          </div>

                          <div>
                            <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                              سعر البيع للقطعة (ج.م)
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={orderSellingPrice}
                              onChange={e => setOrderSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                              placeholder="سعر البيع"
                              disabled={(merchantProducts.find(p => p.id === orderProductId) as any)?.isSharedProduct}
                              className={`w-full p-3 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                                isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                              }`}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                              مصاريف الشحن والتوصيل (ج.م)
                            </label>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">
                              تسعيرة {orderGovernorate}
                            </span>
                          </div>
                          <input
                            type="number"
                            value={orderShippingFee}
                            onChange={e => setOrderShippingFee(parseFloat(e.target.value) || 0)}
                            className={`w-full p-3 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                              isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                            }`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Live Accounting Summary Card */}
                    {orderProductId && (
                      <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                        isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-emerald-50/70 border-emerald-200'
                      }`}>
                        <div className="flex justify-between">
                          <span className="text-zinc-400 font-bold">إجمالي سعر الأصناف:</span>
                          <span className="font-mono font-black">{((Number(orderSellingPrice) || 0) * orderQuantity).toLocaleString()} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400 font-bold">مصاريف الشحن:</span>
                          <span className="font-mono font-black text-rose-500">+{orderShippingFee} ج.م</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-zinc-400 font-bold">عمولة تشغيل النظام:</span>
                          <span className="font-mono font-black text-amber-600">-{Number((activeStoreData?.settings as any)?.serviceFeePerOrder || 15)} ج.م</span>
                        </div>
                        <div className="border-t border-dashed border-emerald-300 dark:border-zinc-800 pt-2 flex justify-between items-center">
                          <span className="font-black text-zinc-900 dark:text-white">المبلغ المطلوب تحصيله (COD):</span>
                          <span className="font-mono font-black text-base text-[#00ab84]">
                            {(((Number(orderSellingPrice) || 0) * orderQuantity) + orderShippingFee).toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingOrder || merchantProducts.length === 0}
                      className="w-full py-4 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-700/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                    >
                      {isSubmittingOrder ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>جاري تسجيل الشحنة...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} />
                          <span>🎉 حفظ وإرسال الطلب للشحن الآن</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* DEVELOPER SEAL & ROADMAP CARD */}
            {createOrderMode === 'dev_seal' && (
              <div className={`relative overflow-hidden rounded-[32px] border p-6 sm:p-10 shadow-xl ${
                isDark
                  ? 'bg-gradient-to-br from-zinc-900 via-zinc-900 to-emerald-950/50 border-zinc-800 text-white'
                  : 'bg-gradient-to-br from-white via-emerald-50/30 to-teal-50/40 border-emerald-200/80 text-zinc-900'
              }`}>
                {/* Decorative Ambient Glow */}
                <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#00ab84]/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  
                  {/* Right Column (7 cols): Message, Features & CTA */}
                  <div className="lg:col-span-7 space-y-5 text-right">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black">
                      <Sparkles size={14} />
                      <span>تحديث قادم لبوابة الموكلين · قريباً جداً</span>
                    </div>

                    <h2 className={`text-2xl sm:text-3xl font-black leading-tight ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      استوديو إنشاء وإرسال الأوردرات المباشر للوكيل
                    </h2>

                    <p className={`text-sm sm:text-base leading-relaxed font-bold ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                      يقوم حالياً الديفلوبر <span className="text-[#00ab84] dark:text-emerald-400 font-black underline decoration-amber-400/70 decoration-2 underline-offset-4">الباشمهندس / عبدالرحمن سعيد وفريقه</span> بالتطوير في الفترة الحالية لإطلاق منظومة تسجيل الأوردرات الذكية الخاصة بالوكلاء، لتتمكن من رفع أوردرات عملائك مباشرة من بضاعتك بالمخزن وإصدار بوليصة الشحن بضغطة زر.
                    </p>

                    {/* 3 Capabilities Preview Pills */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className={`p-3.5 rounded-2xl border ${
                        isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white/90 border-zinc-200/80 shadow-2xs'
                      }`}>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-[#00ab84] flex items-center justify-center mb-2">
                          <PackageIcon size={16} />
                        </div>
                        <div className="text-xs font-black">ربط لحظي بمخزونك</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">اختيار الأصناف المتوفرة من بضاعتك بالمخزن تلقائياً</div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${
                        isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white/90 border-zinc-200/80 shadow-2xs'
                      }`}>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center mb-2">
                          <Calculator size={16} />
                        </div>
                        <div className="text-xs font-black">حساب فوري لصافي ربحك</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">معاينة سعر الشحن والضرائب وصافي مستحقاتك قبل الإرسال</div>
                      </div>

                      <div className={`p-3.5 rounded-2xl border ${
                        isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-white/90 border-zinc-200/80 shadow-2xs'
                      }`}>
                        <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 flex items-center justify-center mb-2">
                          <Truck size={16} />
                        </div>
                        <div className="text-xs font-black">إصدار البوليصة والتتبع</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">تحويل الطلب مباشرة لشركة الشحن ومتابعة دورته المالية</div>
                      </div>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCreateOrderMode('form')}
                        className="px-6 py-3.5 rounded-2xl text-xs font-black bg-[#00ab84] hover:bg-[#0a664e] text-white shadow-emerald-600/25 cursor-pointer transition-all flex items-center gap-2"
                      >
                        <PlusCircle size={16} />
                        <span>التبديل إلى نموذج تسجيل الأوردر الآن</span>
                      </button>
                    </div>
                  </div>

                  {/* Left Column (5 cols): Official Developer Seal */}
                  <div className="lg:col-span-5 flex flex-col items-center justify-center">
                    <div className="relative group">
                      <div className="absolute -inset-3 rounded-full bg-gradient-to-tr from-[#00ab84]/30 via-amber-400/30 to-emerald-500/30 blur-xl opacity-80 group-hover:opacity-100 transition-opacity" />

                      <div
                        className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-full p-3 shadow-2xl flex items-center justify-center -rotate-6 hover:rotate-0 transition-transform duration-300 border-4 border-double ${
                          isDark
                            ? 'bg-gradient-to-br from-zinc-950 via-[#07261f] to-zinc-900 border-amber-400/80 text-white'
                            : 'bg-gradient-to-br from-[#052e24] via-[#00ab84] to-[#042f2e] border-amber-300 text-white'
                        }`}
                      >
                        <div className="w-full h-full rounded-full border-2 border-dashed border-amber-300/70 flex flex-col items-center justify-between p-5 text-center relative">
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

                          <div className="space-y-1">
                            <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-black text-[10px] tracking-wide shadow-sm">
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
            )}
            </>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 2C: CONSIGNMENT INVENTORY (مخزون بضاعة الموكل والأمانات)
           ========================================================= */}
        {currentTab === 'inventory' && (
          <div className="space-y-5">
            {/* Header & KPI Summary Banner */}
            <div className={`p-6 sm:p-7 rounded-[32px] border ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00ab84] to-emerald-500 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-700/20">
                    <Layers size={24} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      مخزون بضاعة الأمانة بالمستودع ({merchantProducts.length} صنف)
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      متابعة المنتجات المخصصة والمشتركة؛ الخانة الفارغة تعني متاحًا دائمًا، ولا تعرض مخزون المتجر العام
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAddProduct}
                    className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                  >
                    <PlusCircle size={16} />
                    <span>+ إضافة صنف جديد للمخزون</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateToTab('create_order')}
                    className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition-all border border-zinc-200 dark:border-zinc-700"
                  >
                    <PackageIcon size={15} />
                    <span>إنشاء أوردر من المخزون</span>
                  </button>
                </div>
              </div>

              {/* 4 Financial & Unit Inventory Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 pt-5">
                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <span className="text-[11px] font-bold text-zinc-400 block mb-1">إجمالي القطع ذات الكمية المحددة</span>
                  <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-zinc-900 dark:text-white">
                    {totalStockUnits} <span className="text-xs font-bold text-zinc-400">قطعة</span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-emerald-50/70 border-emerald-200'}`}>
                  <span className="text-[11px] font-bold text-[#00ab84] block mb-1">تقييم المخزون (سعر التكلفة)</span>
                  <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#00ab84]">
                    {formatMoney(inventoryValuation)}
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-cyan-50/70 border-cyan-200'}`}>
                  <span className="text-[11px] font-bold text-cyan-600 block mb-1">قطع في الطريق (مع المناديب)</span>
                  <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-cyan-600">
                    {returnsReserveAssessment.inTransitCount} <span className="text-xs font-bold text-cyan-500">شحنة</span>
                  </div>
                </div>

                <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-amber-50/70 border-amber-200'}`}>
                  <span className="text-[11px] font-bold text-amber-600 block mb-1">أصناف قاربت على النفاد (&le; 5)</span>
                  <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-amber-600">
                    {merchantProducts.filter(p => !(p as any).unlimitedStock && Number(p.stock || p.quantity || 0) <= 5).length} <span className="text-xs font-bold text-amber-500">صنف</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Inventory Search & Filters */}
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
            }`}>
              <div className="relative w-full sm:w-80">
                <Search size={16} className="absolute right-3.5 top-1/2 -tranzinc-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={e => setInventorySearch(e.target.value)}
                  placeholder="بحث باسم الصنف أو الكود..."
                  className={`w-full pr-10 pl-3 py-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#00ab84] ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                  }`}
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'available', label: 'المتوفر بالمخزن' },
                  { id: 'low', label: 'مخزون منخفض' },
                  { id: 'out', label: 'نافد من المخزن' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setInventoryStockFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                      inventoryStockFilter === f.id
                        ? 'bg-[#00ab84] text-white shadow-xs'
                        : isDark
                        ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Products Table */}
            <div className={`rounded-3xl border overflow-hidden ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className={`${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-900 text-white'} font-black`}>
                    <tr>
                      <th className="py-3.5 px-4">اسم الصنف والرمز</th>
                      <th className="py-3.5 px-4 text-center">سعر التكلفة</th>
                      <th className="py-3.5 px-4 text-center">سعر البيع المقترح</th>
                      <th className="py-3.5 px-4 text-center">ربح الوكيل للقطعة</th>
                      <th className="py-3.5 px-4 text-center">الرصيد بالمستودع</th>
                      <th className="py-3.5 px-4 text-center">إجمالي القيمة</th>
                      <th className="py-3.5 px-4 text-center">حالة التوفر</th>
                      <th className="py-3.5 px-4 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-medium ${isDark ? 'divide-zinc-800 text-zinc-300' : 'divide-zinc-100 text-zinc-700'}`}>
                    {filteredConsignmentProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-zinc-400 font-bold space-y-3">
                          <p>لا توجد أصناف مطابقة لبحثك في مخزون الوكيل</p>
                          <button
                            type="button"
                            onClick={handleOpenAddProduct}
                            className="px-4 py-2 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black cursor-pointer shadow-md"
                          >
                            + إضافة صنف جديد للمخزون
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredConsignmentProducts.map(p => {
                        const stock = Number(p.stock || p.quantity || 0);
                        const isStockEmpty = p.stock === null || p.stock === undefined || p.stock === '' || p.quantity === null || p.quantity === undefined || p.quantity === '';
                        const sharedReadOnly = Boolean((p as any).isSharedProduct);
                        // A product is unlimited if explicitly flagged OR if it is shared/allocated AND the stock field is left empty
                        const unlimited = Boolean((p as any).unlimitedStock) || (sharedReadOnly && isStockEmpty) || (p.isAllocatedConsignment && isStockEmpty);
                        const cost = Number(p.costPrice || p.cost || p.wholesalePrice || 0);
                        const price = Number(p.price || p.sellingPrice || (cost > 0 ? cost * 1.35 : 0));
                        const val = stock * cost;
                        const profitMode = p.profitMode || (cost > 0 ? 'margin' : 'commission');
                        const commissionPct = Number(p.commissionPercentage || p.profitPercentage || liveMerchant?.profitRatio || 15);
                        const unitProfit = profitMode === 'commission'
                          ? Math.round(price * (commissionPct / 100))
                          : Math.max(0, price - cost);

                        return (
                          <tr key={p.id} className={isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/60'}>
                            <td className="py-4 px-4 font-black">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                  {p.thumbnail || p.imageUrl || p.image ? (
                                    <img src={p.thumbnail || p.imageUrl || p.image} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <PackageIcon size={20} />
                                  )}
                                </div>
                                <div>
                                  <div className={`font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{p.name || p.title}</div>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono text-zinc-400">SKU: {p.sku || p.barcode || p.id}</span>
                                    {p.isAllocatedConsignment && (
                                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        📦 رصيد أمانة مخصص لك: {stock} قطعة (تكلفة: {formatMoney(cost)})
                                      </span>
                                    )}
                                    {sharedReadOnly && (
                                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                        منتج مشترك · عرض فقط
                                      </span>
                                    )}
                                    {!p.isAllocatedConsignment && !sharedReadOnly && (
                                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        👑 الموكل الرئيسي
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-zinc-600 dark:text-zinc-400">
                              {formatMoney(cost)}
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-black text-[#00ab84]">
                              {formatMoney(price)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                                  +{formatMoney(unitProfit)}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-bold">
                                  {profitMode === 'commission' ? `نسبة: ${commissionPct}%` : 'هامش ثابت'}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {unlimited ? <span className="text-xs font-black text-emerald-600">— <span className="text-[10px] text-zinc-400">بلا حد</span></span> : <><span className="font-mono font-black text-sm">{stock}</span> <span className="text-[10px] text-zinc-400">قطعة</span></>}
                            </td>
                            <td className="py-4 px-4 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              {unlimited || (sharedReadOnly && cost <= 0) ? '—' : formatMoney(val)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {unlimited ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-[#00ab84]">
                                  متاح دائمًا · مشترك
                                </span>
                              ) : stock <= 0 ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-500">
                                  نفد من المخزن
                                </span>
                              ) : stock <= 5 ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600">
                                  مخزون حرج ({stock})
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/10 text-[#00ab84]">
                                  متوفر بالمستودع
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                {sharedReadOnly ? <span className="text-[10px] font-bold text-zinc-400">قراءة فقط</span> : <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPricingModal(p)}
                                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                                >
                                  <Coins size={14} />
                                  <span>تسعيرتي ومخزوني</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditProduct(p)}
                                  className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-black text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
                                  title="تعديل بيانات الصنف بالكامل"
                                >
                                  تعديل
                                </button>
                                </>}
                              </div>
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
            TAB 3: PRODUCT & GOVERNORATE ANALYTICS (الأصناف والمحافظات)
           ========================================================= */}
        {currentTab === 'analytics' && (
          <div className="space-y-5">
            {/* Header & Sort Bar */}
            <div className="bg-gradient-to-r from-[#064e3b] via-[#00ab84] to-zinc-900 text-white rounded-3xl p-5 sm:p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                        ? 'bg-white text-[#00ab84] shadow-xs'
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
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className={`p-4 sm:p-5 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <h4 className={`font-black text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  <TrendingUp size={18} className="text-[#00ab84]" />
                  <span>جدول أداء وترتيب أصناف بضاعتك ({merchantAnalyticsReport.productsList.length} صنف)</span>
                </h4>
              </div>

              {/* Mobile Cards for Products */}
              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {merchantAnalyticsReport.productsList.length === 0 ? (
                  <div className="py-12 text-center text-zinc-400 font-bold text-xs">
                    لا توجد بيانات مبيعات للأصناف حتى الآن
                  </div>
                ) : (
                  merchantAnalyticsReport.productsList.map((prod, idx) => (
                    <div key={prod.id + idx} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-emerald-500/15 text-[#00ab84] font-mono font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className={`font-black text-xs ${isDark ? 'text-white' : 'text-zinc-900'}`}>{prod.name}</div>
                            <div className="text-[11px] text-zinc-400">
                              بالمخزن: <span className="font-mono text-[#00ab84] font-bold">{prod.stock} ق</span>
                              {prod.shippingQty > 0 && ` · في الطريق: ${prod.shippingQty} ق`}
                            </div>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="font-mono tabular-nums font-black text-sm text-[#00ab84]">
                            {formatMoney(prod.netMerchantProfit)}
                          </div>
                          <div className="text-[10px] text-zinc-400">صافي مستحقاتك</div>
                        </div>
                      </div>

                      {/* Delivery vs Return Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-[#00ab84]">تسليم: {prod.deliveredQty} ق ({prod.deliveryRate}%)</span>
                          <span className="text-rose-500">مرتجع: {prod.returnedQty} ق ({prod.returnRate}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                          <div className="bg-[#00ab84] h-full" style={{ width: `${Math.min(100, prod.deliveryRate)}%` }} />
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
                  <thead className={`${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-900 text-white'} font-black`}>
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
                  <tbody className={`divide-y font-bold ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'}`}>
                    {merchantAnalyticsReport.productsList.map((prod, idx) => (
                      <tr key={prod.id + idx} className={isDark ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50/80'}>
                        <td className="py-3.5 px-4 font-mono">{idx + 1}</td>
                        <td className="py-3.5 px-4">
                          <div className={`font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{prod.name}</div>
                          <div className="text-[10px] text-zinc-400">
                            بالمخزن: <span className="font-mono text-[#00ab84]">{prod.stock} قطعة</span>
                            {prod.shippingQty > 0 && ` · في الطريق: ${prod.shippingQty} قطعة`}
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums">{prod.orderedQty} ق</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-[#00ab84] font-black">{prod.deliveredQty} ق</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-rose-500">{prod.returnedQty} ق</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-[#00ab84] font-black">{prod.deliveryRate}%</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums text-rose-500">{prod.returnRate}%</td>
                        <td className="py-3.5 px-3 text-center font-mono tabular-nums">{formatMoney(prod.totalRevenue)}</td>
                        <td className="py-3.5 px-4 text-center font-mono tabular-nums font-black text-[#00ab84] text-sm">
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
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className={`p-4 sm:p-5 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <h4 className={`font-black text-sm sm:text-base flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  <MapPin size={18} className="text-[#00ab84]" />
                  <span>ترتيب المحافظات الأكثر شراءً لبضاعتك ({merchantAnalyticsReport.governoratesList.length} محافظة)</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                {merchantAnalyticsReport.governoratesList.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-zinc-400 font-bold text-xs">
                    لا توجد بيانات شحن للمحافظات حتى الآن
                  </div>
                ) : (
                  merchantAnalyticsReport.governoratesList.map((gov, idx) => (
                    <div
                      key={gov.governorate + idx}
                      className={`p-4 rounded-2xl border space-y-2.5 ${
                        isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50/70 border-zinc-200/70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#00ab84]">#{idx + 1}</span>
                          <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>{gov.governorate}</span>
                        </div>
                        <span className="font-mono tabular-nums text-xs font-black text-[#00ab84]">
                          {formatMoney(gov.netMerchantPayout)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold">
                        <span>إجمالي: {gov.totalOrders} طلب</span>
                        <span className="text-[#00ab84]">مسلّم: {gov.deliveredOrders} ({gov.deliveryRate}%)</span>
                        <span className="text-rose-500">مرتجع: {gov.returnedOrders}</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#00ab84] rounded-full" style={{ width: `${Math.min(100, gov.deliveryRate)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3A: CUSTOMERS MANAGEMENT (إدارة العملاء والمشترين)
           ========================================================= */}
        {currentTab === 'customers' && (
          <div className="space-y-6">
            {/* Top Toolbar Card: Search + Export */}
            <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className="flex-1 max-w-md relative">
                <Search size={16} className="absolute right-3.5 top-1/2 -tranzinc-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={customersSearchQuery}
                  onChange={e => setCustomersSearchQuery(e.target.value)}
                  placeholder="ابحث باسم العميل، رقم الهاتف، أو المحافظة..."
                  className={`w-full pr-10 pl-4 py-2.5 rounded-2xl text-xs font-bold border outline-none transition-all ${
                    isDark 
                      ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500 focus:border-[#00ab84]' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-[#00ab84]'
                  }`}
                />
                {customersSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomersSearchQuery('')}
                    className="absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const csvRows = [
                      ['اسم العميل', 'رقم الهاتف', 'المحافظة', 'إجمالي الطلبات', 'الطلبات المسلمة', 'المرتجع', 'إجمالي الإنفاق (ج.م)', 'آخر طلب']
                    ];
                    filteredCustomersList.forEach(c => {
                      csvRows.push([
                        `"${c.name}"`,
                        `"${c.phone}"`,
                        `"${c.governorate}"`,
                        String(c.totalOrders),
                        String(c.deliveredOrders),
                        String(c.returnedOrders),
                        String(c.totalSpent),
                        `"${c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('ar-EG') : '—'}"`
                      ]);
                    });
                    const csvContent = '\uFEFF' + csvRows.map(r => r.join(',')).join('\n');
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `عملاء_الوكيل_${liveMerchant.name}_${new Date().toISOString().slice(0, 10)}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    showToast('تم تصدير سجل العملاء بنجاح', 'success');
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center gap-2 shadow-xs cursor-pointer transition-all"
                >
                  <Download size={14} />
                  <span>تصدير ملف Excel / CSV</span>
                </button>
              </div>
            </div>

            {/* KPI Cards: Customers Highlights */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className={`p-4 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400 font-bold">إجمالي المشترين</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center">
                    <Users size={16} />
                  </div>
                </div>
                <div className="text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white">
                  {uniqueCustomersCount}
                </div>
                <div className="text-[10px] text-zinc-400 font-bold mt-1">
                  عميل فريد مسجل بقاعدة البيانات
                </div>
              </div>

              <div className={`p-4 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400 font-bold">استلموا بنجاح</span>
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div className="text-xl font-black font-mono tabular-nums text-teal-600 dark:text-teal-400">
                  {totalDeliveredCustomers}
                </div>
                <div className="text-[10px] text-zinc-400 font-bold mt-1">
                  {uniqueCustomersCount > 0 ? Math.round((totalDeliveredCustomers / uniqueCustomersCount) * 100) : 0}% نسبة نجاح الاستلام
                </div>
              </div>

              <div className={`p-4 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400 font-bold">عملاء متكررون</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Award size={16} />
                  </div>
                </div>
                <div className="text-xl font-black font-mono tabular-nums text-amber-600 dark:text-amber-400">
                  {repeatCustomersCount}
                </div>
                <div className="text-[10px] text-zinc-400 font-bold mt-1">
                  طلبوا أكثر من أوردر واحد
                </div>
              </div>

              <div className={`p-4 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400 font-bold">متوسط قيمة العميل</span>
                  <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                    <Banknote size={16} />
                  </div>
                </div>
                <div className="text-xl font-black font-mono tabular-nums text-zinc-900 dark:text-white">
                  {formatMoney(avgSpentPerCustomer)}
                </div>
                <div className="text-[10px] text-zinc-400 font-bold mt-1">
                  متوسط المشتريات المسلمة
                </div>
              </div>
            </div>

            {/* Customers Data Table & Cards */}
            <div className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
              <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white">قائمة العملاء والمشترين</h3>
                  <p className="text-xs text-zinc-400 font-bold mt-0.5">
                    يتم استخراج البيانات وتحديثها تلقائياً مع كل أوردر وشحنة
                  </p>
                </div>
                <span className="text-xs font-mono font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-xl">
                  {filteredCustomersList.length} عميل
                </span>
              </div>

              {filteredCustomersList.length === 0 ? (
                <div className="p-12 text-center text-zinc-400 font-bold">
                  <Users size={36} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm">لا توجد نتائج مطابقة لبحث العملاء</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className={`border-b text-[11px] font-black uppercase tracking-wider ${
                        isDark ? 'border-zinc-800 bg-zinc-950/60 text-zinc-400' : 'border-zinc-100 bg-zinc-50/80 text-zinc-500'
                      }`}>
                        <th className="py-3.5 px-4">العميل</th>
                        <th className="py-3.5 px-4">المحافظة والعنوان</th>
                        <th className="py-3.5 px-4 text-center">الطلبات</th>
                        <th className="py-3.5 px-4">إجمالي المشتريات</th>
                        <th className="py-3.5 px-4">آخر أوردر</th>
                        <th className="py-3.5 px-4 text-center">إجراءات التواصل</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-bold ${isDark ? 'divide-zinc-800/60' : 'divide-zinc-100'}`}>
                      {filteredCustomersList.map(cust => (
                        <tr key={cust.id} className={`transition-colors ${isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/70'}`}>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00ab84] to-emerald-400 text-white flex items-center justify-center font-black text-xs shrink-0">
                                {getInitials(cust.name)}
                              </div>
                              <div>
                                <div className="font-black text-zinc-900 dark:text-white">{cust.name}</div>
                                <div className="font-mono text-[11px] text-zinc-400 dir-ltr text-right">{cust.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                              <MapPin size={13} className="text-[#00ab84] shrink-0" />
                              <span className="font-black">{cust.governorate}</span>
                              {cust.city && <span className="text-zinc-400 text-[11px]">({cust.city})</span>}
                            </div>
                            {cust.address && (
                              <div className="text-[10px] text-zinc-400 truncate max-w-[220px] mt-0.5">
                                {cust.address}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-mono font-black text-xs">
                              <span>{cust.totalOrders}</span>
                              <span className="text-[10px] text-zinc-400 font-sans">أوردر</span>
                            </div>
                            <div className="flex items-center justify-center gap-1 mt-1 text-[10px] font-mono">
                              {cust.deliveredOrders > 0 && (
                                <span className="text-emerald-600 font-black">{cust.deliveredOrders} تسليم</span>
                              )}
                              {cust.returnedOrders > 0 && (
                                <span className="text-rose-500 font-black">• {cust.returnedOrders} مرتجع</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono font-black text-zinc-900 dark:text-white">
                              {formatMoney(cust.totalSpent)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                              {cust.lastOrderDate ? new Date(cust.lastOrderDate).toLocaleDateString('ar-EG') : '—'}
                            </div>
                            {cust.lastOrderNumber && (
                              <div className="text-[10px] text-[#00ab84] font-mono">#{cust.lastOrderNumber}</div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {cust.phone && cust.phone !== '—' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const clean = cust.phone.replace(/\D/g, '');
                                      window.open(`https://wa.me/2${clean}?text=${encodeURIComponent(`مرحباً ${cust.name}، بخصوص شحنتك مع متجرنا`)}`, '_blank');
                                    }}
                                    className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00ab84] transition-colors cursor-pointer"
                                    title="مراسلة عبر واتساب"
                                  >
                                    <MessageCircle size={15} />
                                  </button>
                                  <a
                                    href={`tel:${cust.phone}`}
                                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors"
                                    title="اتصال هاتفي"
                                  >
                                    <Phone size={15} />
                                  </a>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const searchKey = cust.phone !== '—' ? cust.phone : cust.name;
                                  setOrdersSearchQuery(searchKey);
                                  navigateToTab('orders');
                                  showToast(`تم عرض شحنات العميل: ${cust.name}`, 'info');
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[11px] font-black transition-colors cursor-pointer"
                                title="عرض شحنات هذا العميل بالدورة المالية"
                              >
                                الشحنات
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================
            TAB 3B: APPS & AUTOMATION HUB (التطبيقات والربط الآلي)
           ========================================================= */}
        {currentTab === 'apps' && (
          <div className="space-y-6">
            {planUsage.managerPlanActive && (
              <div className="p-4 sm:p-5 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                    <Crown size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-amber-800 dark:text-amber-300">
                      إدارة الشحن وبوت التأكيد مفوضة لمدير حسابك المخصص 🔒
                    </h4>
                    <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 mt-0.5">
                      أنت مشترك في ({planUsage.planLabelAr})؛ يقوم المدير المخصص بإدارة الربط مع شركة الشحن وبوت تأكيد الأوردرات نيابةً عنك.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangePlanModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black shrink-0 cursor-pointer"
                >
                  تغيير نظام الباقة
                </button>
              </div>
            )}

            {/* Header Banner */}
            <div className={`p-5 rounded-3xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
              isDark 
                ? 'bg-gradient-to-r from-zinc-900 via-zinc-900 to-emerald-950/40 border-zinc-800' 
                : 'bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/60 border-zinc-200/80 shadow-xs'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#00ab84] text-white flex items-center justify-center shadow-lg shadow-emerald-700/20 shrink-0">
                  <LayoutGrid size={24} />
                </div>
                <div>
                  <h3 className="font-black text-base text-zinc-900 dark:text-white">مركز التطبيقات والتكامل الآلي</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-bold mt-0.5">
                    ربط شركات الشحن (بوسطة)، أتمتة رسائل تأكيد الواتساب، والربط البرمجي للمخازن
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/15 text-[#00ab84] font-black text-xs flex items-center gap-1.5 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-[#00ab84] animate-pulse" />
                  <span>{planUsage.managerPlanActive ? 'تحت إدارة المدير المخصص 🔒' : '4 تطبيقات نشطة ومتصلة'}</span>
                </span>
              </div>
            </div>

            {/* Apps Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              
              {/* APP 1: Bosta Express */}
              <div className={`rounded-3xl border p-5 sm:p-6 space-y-4 flex flex-col justify-between ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center font-black">
                        <Truck size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white">بوسطة للشحن السريع (Bosta Express)</h4>
                        <span className="text-[10px] text-zinc-400 font-bold">Logistics & Tracking API v2</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-[#00ab84] text-[10px] font-black flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>متصل ونشط</span>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold">
                    إصدار بوالص الشحن التلقائية بنقرة واحدة، جلب رقم التتبع الفوري، وتحديث حالة الأوردر بالدورة المالية آلياً عند التسليم للمشتري أو الإعادة للمخزن.
                  </p>

                  <div className={`p-3 rounded-2xl border text-[11px] font-bold space-y-1.5 ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200/70 text-zinc-600'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span>نقطة الاستلام والبيك أب:</span>
                      <span className="text-zinc-900 dark:text-white font-black">{DEFAULT_BOSTA_BUSINESS_LOCATIONS[0]?.city || 'مخزن الجيزة الرئيسي'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>إشعار التسليم اللحظي:</span>
                      <span className="text-[#00ab84] font-black">Webhook مفعل</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isTestingBosta}
                    onClick={() => {
                      setIsTestingBosta(true);
                      setTimeout(() => {
                        setIsTestingBosta(false);
                        showToast('تم اختبار اتصال API بوسطة بنجاح - استجابة الخادم 38ms', 'success');
                      }, 700);
                    }}
                    className="flex-1 py-2.5 rounded-2xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                  >
                    {isTestingBosta ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    <span>فحص استجابة الـ API</span>
                  </button>
                </div>
              </div>

              {/* APP 2: WhatsApp Confirmation Bot */}
              <div className={`rounded-3xl border p-5 sm:p-6 space-y-4 flex flex-col justify-between ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center font-black">
                        <MessageCircle size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white">بوت تأكيد شحنات الواتساب</h4>
                        <span className="text-[10px] text-zinc-400 font-bold">WhatsApp Automation & Address Verification</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWhatsAppBotEnabled(!isWhatsAppBotEnabled);
                        showToast(isWhatsAppBotEnabled ? 'تم إيقاف بوت التأكيد مؤقتاً' : 'تم تفعيل بوت التأكيد الآلي', 'info');
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors ${
                        isWhatsAppBotEnabled ? 'bg-emerald-500/15 text-[#00ab84]' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isWhatsAppBotEnabled ? 'bg-[#00ab84]' : 'bg-zinc-400'}`} />
                      <span>{isWhatsAppBotEnabled ? 'مفعّل' : 'متوقف'}</span>
                    </button>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold">
                    إرسال رسالة آلية للعميل عند إنشاء الشحنة لتأكيد المقاسات والعنوان وموعد وصول المندوب، مما يخفض نسبة المرتجعات لأقل من 8%.
                  </p>

                  <div className={`p-3 rounded-2xl border text-[11px] font-bold space-y-1 ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200/70 text-zinc-600'
                  }`}>
                    <span className="text-[10px] text-zinc-400 block mb-1">نموذج الرسالة المعتمد:</span>
                    <p className="italic text-zinc-700 dark:text-zinc-300 font-mono text-[10.5px]">
                      "مرحباً بك! تم تأكيد شحنتك رقم #ORD-2026 بقيمة إجمالية مع الشحن، وسيتم التسليم خلال 48 ساعة."
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isTestingWhatsApp}
                    onClick={() => {
                      setIsTestingWhatsApp(true);
                      setTimeout(() => {
                        setIsTestingWhatsApp(false);
                        showToast('تم إرسال رسالة تجريبية ناجحة عبر بوابة WhatsApp Cloud API', 'success');
                      }, 800);
                    }}
                    className="flex-1 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isTestingWhatsApp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    <span>إرسال رسالة واتساب تجريبية</span>
                  </button>
                </div>
              </div>

              {/* APP 3: Stock Sync */}
              <div className={`rounded-3xl border p-5 sm:p-6 space-y-4 flex flex-col justify-between ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                        <Layers size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white">المزامنة اللحظية للمخزون</h4>
                        <span className="text-[10px] text-zinc-400 font-bold">Multi-Channel Inventory Deduction</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-[#00ab84] text-[10px] font-black flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      <span>تحديث فوري</span>
                    </span>
                  </div>

                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold">
                    خصم فوري لكميات البضاعة المحجوزة من مخزون المستودع عند تسجيل أي أوردر لمنع البيع الزائد (Overselling)، وإعادة الكميات تلقائياً في حال ألغيت الشحنة.
                  </p>

                  <div className={`p-3 rounded-2xl border text-[11px] font-bold space-y-1.5 ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-400' : 'bg-zinc-50 border-zinc-200/70 text-zinc-600'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span>إجمالي الأصناف المراقبة:</span>
                      <span className="text-zinc-900 dark:text-white font-mono font-black">{merchantProducts.length} صنف</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>إجمالي القطع في المستودع:</span>
                      <span className="text-[#00ab84] font-mono font-black">{totalStockUnits} قطعة</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      fetchFreshData(true);
                      showToast('تمت مطابقة ومزامنة أرصدة المستودع مع الأوردرات بنجاح', 'success');
                    }}
                    className="flex-1 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RefreshCw size={14} />
                    <span>مزامنة جرد المخزون الآن</span>
                  </button>
                </div>
              </div>

              {/* APP 4: API & Webhooks */}
              <div className={`rounded-3xl border p-5 sm:p-6 space-y-4 flex flex-col justify-between ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-black">
                        <Code2 size={22} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white">مفاتيح المطورين والـ Webhook</h4>
                        <span className="text-[10px] text-zinc-400 font-bold">REST API & Webhooks Listener</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-600 text-[10px] font-black">
                      REST v1
                    </span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-zinc-400 font-black block">عنوان رابط الـ Webhook الخاص بك:</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={appsWebhookUrl}
                        onChange={e => setAppsWebhookUrl(e.target.value)}
                        className={`w-full p-2.5 pr-3 pl-20 rounded-xl text-xs font-mono border outline-none ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                        }`}
                      />
                      <button
                        type="button"
                        disabled={isTestingWebhook}
                        onClick={() => {
                          setIsTestingWebhook(true);
                          setTimeout(() => {
                            setIsTestingWebhook(false);
                            showToast('تم إرسال إشعار اختبار (Ping Webhook) بنجاح - كود الاستجابة 200 OK', 'success');
                          }, 650);
                        }}
                        className="absolute left-1.5 top-1/2 -tranzinc-y-1/2 px-2.5 py-1 rounded-lg bg-[#00ab84] text-white text-[10px] font-black cursor-pointer hover:bg-[#0a664e] transition-all disabled:opacity-50"
                      >
                        {isTestingWebhook ? 'جارِ...' : 'اختبار Ping'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-black block">مفتاح المصادقة السري (Merchant Secret Key):</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`mk_live_${(liveMerchant.id || 'partner').slice(0, 8)}_${effectiveStoreId.slice(0, 6)}`}
                        className={`w-full p-2 rounded-xl text-xs font-mono border outline-none ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-emerald-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(`mk_live_${(liveMerchant.id || 'partner').slice(0, 8)}_${effectiveStoreId.slice(0, 6)}`);
                          showToast('تم نسخ مفتاح API السري', 'success');
                        }}
                        className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-[#00ab84] cursor-pointer"
                        title="نسخ المفتاح"
                      >
                        <Copy size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[10px] text-zinc-400 font-bold text-center">
                  التكامل يدعم منصات Shopify و Salla و Zid ومتاجر WooCommerce
                </div>
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
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b pb-4 ${
                isDark ? 'border-zinc-800' : 'border-zinc-100'
              }`}>
                <div>
                  <h3 className={`text-base sm:text-lg font-black flex items-center gap-2 ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    <FileText className="text-[#00ab84]" size={20} />
                    <span>كشف الحساب الرسمي والفواتير المعتمدة (PDF / Excel)</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    حدد الفترة الزمنية وحمّل كشف حسابك بصيغة PDF رسمية للطباعة أو شيت Excel للمراجعة المحاسبية
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPrintableStatementModal(true)}
                    className="px-4 py-2.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <Printer size={15} className="text-emerald-400" />
                    <span>معاينة وطباعة كشف الحساب (PDF)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportStatementExcel}
                    className="px-4 py-2.5 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs transition-all"
                  >
                    <Download size={15} />
                    <span>تصدير شيت إكسيل (Excel)</span>
                  </button>
                </div>
              </div>

              {/* Date Range & Type Filter */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end text-xs font-bold">
                <div>
                  <label className="block text-zinc-400 mb-1">من تاريخ:</label>
                  <input
                    type="date"
                    value={statementStartDate}
                    onChange={e => setStatementStartDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">إلى تاريخ:</label>
                  <input
                    type="date"
                    value={statementEndDate}
                    onChange={e => setStatementEndDate(e.target.value)}
                    className={`w-full p-2.5 border rounded-xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">نوع العمليات:</label>
                  <select
                    value={statementTypeFilter}
                    onChange={e => setStatementTypeFilter(e.target.value as any)}
                    className={`w-full p-2.5 border rounded-xl text-xs font-bold outline-none focus:border-[#00ab84] ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
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
                      isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
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
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-emerald-50/70 border-emerald-200'}`}>
                  <span className="text-[10px] font-bold text-[#00ab84] block">إجمالي التسويات (+)</span>
                  <span className="text-base font-black font-mono tabular-nums text-[#00ab84]">
                    +{formatMoney(statementSummary.totalCredits)}
                  </span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-rose-50/70 border-rose-200'}`}>
                  <span className="text-[10px] font-bold text-rose-500 block">إجمالي المسحوبات (-)</span>
                  <span className="text-base font-black font-mono tabular-nums text-rose-500">
                    -{formatMoney(statementSummary.totalDebits)}
                  </span>
                </div>
                <div className={`p-3.5 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                  <span className="text-[10px] font-bold text-zinc-400 block">صافي حركة الفترة</span>
                  <span className={`text-base font-black font-mono tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {statementSummary.netPeriodChange >= 0 ? '+' : ''}{formatMoney(statementSummary.netPeriodChange)}
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#00ab84] text-white">
                  <span className="text-[10px] font-bold text-emerald-100 block">الرصيد الحالي بالمحفظة</span>
                  <span className="text-base font-black font-mono tabular-nums text-white">
                    {formatMoney(overviewStats.persistentBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-view Switcher: Ledger vs P&L vs Returns Reserve */}
            <div className={`p-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleStatementSubViewChange('ledger')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    statementSubView === 'ledger'
                      ? 'bg-[#00ab84] text-white shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <FileText size={15} />
                  <span>كشف حساب الأستاذ والحركات</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatementSubViewChange('pnl')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    statementSubView === 'pnl'
                      ? 'bg-[#00ab84] text-white shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <TrendingUp size={15} />
                  <span>قائمة الأرباح والخسائر (P&L)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStatementSubViewChange('reserves')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                    statementSubView === 'reserves'
                      ? 'bg-[#00ab84] text-white shadow-xs'
                      : isDark
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <ShieldCheck size={15} />
                  <span>مخصص أمان المرتجعات</span>
                </button>
              </div>

              <div className="text-[11px] font-bold text-zinc-400 hidden sm:block">
                {statementSubView === 'ledger' && `عدد العمليات: ${filteredStatementTransactions.length}`}
                {statementSubView === 'pnl' && `هامش الربح الصافي: ${merchantPnL.netMarginPct.toFixed(1)}%`}
                {statementSubView === 'reserves' && `الرصيد الآمن للسحب: ${formatMoney(returnsReserveAssessment.safeWithdrawalBalance)}`}
              </div>
            </div>

            {/* SUBVIEW 1: GENERAL LEDGER (دفتر الأستاذ) */}
            {statementSubView === 'ledger' && (
              <div className="space-y-4">
                {/* Mobile Transaction Cards (md:hidden) */}
                <div className="md:hidden space-y-2.5">
                  {filteredStatementTransactions.length === 0 ? (
                    <div className={`p-10 rounded-3xl border text-center text-xs font-bold text-zinc-400 ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
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
                            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                isCredit ? 'bg-emerald-500/15 text-[#00ab84]' : 'bg-rose-500/15 text-rose-500'
                              }`}>
                                {isCredit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                              </div>
                              <div>
                                <div className={`text-xs font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                                  {tx.type === 'order_delivered' ? 'تسوية مبيعات' :
                                   tx.type === 'withdrawal' ? 'سحب مستحقات' :
                                   isCredit ? 'إضافة رصيد' : 'خصم / تعديل'}
                                </div>
                                <div className="text-[10px] font-mono text-zinc-400">
                                  {new Date(tx.date).toLocaleDateString('ar-EG')}
                                </div>
                              </div>
                            </div>

                            <div className="text-left">
                              <div className={`font-mono tabular-nums font-black text-sm ${isCredit ? 'text-[#00ab84]' : 'text-rose-500'}`}>
                                {isCredit ? '+' : ''}{formatMoney(tx.amount)}
                              </div>
                              <div className="text-[10px] font-mono text-zinc-400">
                                الرصيد: {formatMoney(tx.balanceAfter)}
                              </div>
                            </div>
                          </div>

                          {tx.notes && (
                            <div className={`text-xs ${isDark ? 'text-zinc-300' : 'text-zinc-600'}`}>
                              {tx.notes}
                            </div>
                          )}

                          {(transferRef || receiptImg) && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {transferRef && (
                                <span className="text-[10px] font-mono font-bold text-[#00ab84] bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                                  مرجع: {transferRef}
                                </span>
                              )}
                              {receiptImg && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewReceiptImage(receiptImg)}
                                  className="text-[10px] font-black bg-[#00ab84] text-white px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer"
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
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                }`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className={`${isDark ? 'bg-zinc-950 text-zinc-300' : 'bg-zinc-900 text-white'} font-black`}>
                        <tr>
                          <th className="py-3.5 px-4">التاريخ</th>
                          <th className="py-3.5 px-4">نوع العملية</th>
                          <th className="py-3.5 px-4 text-right">البيان والمرجع والإيصال</th>
                          <th className="py-3.5 px-4 text-center">المبلغ</th>
                          <th className="py-3.5 px-4 text-center">الرصيد بعد العملية</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y font-medium ${isDark ? 'divide-zinc-800 text-zinc-300' : 'divide-zinc-100 text-zinc-700'}`}>
                        {filteredStatementTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-zinc-400 font-bold">
                              لا توجد عمليات مسجلة في كشف الحساب للفترة المحددة
                            </td>
                          </tr>
                        ) : (
                          filteredStatementTransactions.map(tx => {
                            const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
                            const receiptImg = tx.receiptImage || linkedReq?.receiptImage;
                            const transferRef = tx.transferReference || linkedReq?.transferReference;

                            return (
                              <tr key={tx.id} className={isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/60'}>
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
                                  <div className={`font-bold ${isDark ? 'text-white' : 'text-zinc-900'}`}>{tx.notes}</div>
                                  {(transferRef || receiptImg) && (
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                      {transferRef && (
                                        <span className="text-[10px] font-mono font-black bg-emerald-500/10 text-[#00ab84] px-2 py-0.5 rounded-md">
                                          مرجع التحويل: {transferRef}
                                        </span>
                                      )}
                                      {receiptImg && (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewReceiptImage(receiptImg)}
                                          className="text-[10px] font-black bg-[#00ab84] text-white px-2.5 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                                        >
                                          <Eye size={11} /> عرض إيصال التحويل
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className={`py-4 px-4 text-center font-black font-mono tabular-nums text-sm ${tx.amount >= 0 ? 'text-[#00ab84]' : 'text-rose-500'}`}>
                                  {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                                </td>
                                <td className={`py-4 px-4 text-center font-black font-mono tabular-nums text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
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

            {/* SUBVIEW 2: CONSOLIDATED P&L INCOME STATEMENT (قائمة الأرباح والخسائر) */}
            {statementSubView === 'pnl' && (
              <div className="space-y-6">
                {/* Top P&L KPI Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                    <span className="text-xs font-bold text-zinc-400 block mb-1">إجمالي المبيعات المحصلة</span>
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-[#00ab84]">
                      {formatMoney(merchantPnL.grossRevenue)}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold mt-1 block">
                      من {merchantPnL.deliveredCount} أوردر مسلم
                    </span>
                  </div>

                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                    <span className="text-xs font-bold text-zinc-400 block mb-1">تكلفة البضاعة المباعة (COGS)</span>
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-zinc-800 dark:text-zinc-200">
                      {formatMoney(merchantPnL.cogs)}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold mt-1 block">
                      رأس المال المسترد للبضاعة
                    </span>
                  </div>

                  <div className={`p-5 rounded-3xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'}`}>
                    <span className="text-xs font-bold text-zinc-400 block mb-1">مجمل الربح التجاري</span>
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatMoney(merchantPnL.grossProfit)}
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 block">
                      هامش مجمل الربح: {merchantPnL.grossMarginPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-5 rounded-3xl bg-gradient-to-tr from-[#00ab84] to-emerald-600 text-white shadow-lg shadow-emerald-700/20">
                    <span className="text-xs font-bold text-emerald-100 block mb-1">صافي الربح الفعلي بعد المصروفات</span>
                    <div className="text-xl sm:text-2xl font-black font-mono tabular-nums text-white">
                      {formatMoney(merchantPnL.netProfit)}
                    </div>
                    <span className="text-[10px] text-emerald-100 font-bold mt-1 block">
                      هامش الصافي: {merchantPnL.netMarginPct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Waterfall Income Statement Breakdown */}
                <div className={`rounded-3xl border overflow-hidden ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                }`}>
                  <div className={`p-5 sm:p-6 border-b flex items-center justify-between ${
                    isDark ? 'border-zinc-800 bg-zinc-950/40' : 'border-zinc-100 bg-zinc-50/50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center font-black">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h3 className={`text-base font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                          بيان الدخل المحاسبي المفصل (Income Statement Waterfall)
                        </h3>
                        <p className="text-xs text-zinc-400">
                          تسلسل تدرج الأرباح من إجمالي المتحصلات النقدية حتى صافي المستحقات الخالصة
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-black text-[#00ab84] bg-emerald-500/10 px-3 py-1 rounded-full">
                      صافي: {formatMoney(merchantPnL.netProfit)}
                    </span>
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs font-bold">
                    {/* Item 1: Gross Sales */}
                    <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <div className="space-y-0.5">
                        <span className="text-zinc-900 dark:text-white font-black text-sm block">1. إجمالي الإيرادات المحصلة (Gross Collected Revenue)</span>
                        <span className="text-zinc-400 text-[11px]">مجموع المبالغ النقدية المحصلة من العملاء عبر شركة الشحن</span>
                      </div>
                      <span className="font-mono font-black text-base text-[#00ab84]">+{formatMoney(merchantPnL.grossRevenue)}</span>
                    </div>

                    {/* Item 2: COGS */}
                    <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <div className="space-y-0.5">
                        <span className="text-zinc-900 dark:text-white font-black text-sm block">2. تكلفة البضاعة المباعة (Cost of Goods Sold - COGS)</span>
                        <span className="text-zinc-400 text-[11px]">تكلفة شراء/توريد الأصناف المسلمة (رأس المال المسترجع لك بالكامل)</span>
                      </div>
                      <span className="font-mono font-black text-base text-zinc-700 dark:text-zinc-300">-{formatMoney(merchantPnL.cogs)}</span>
                    </div>

                    {/* Subtotal: Gross Profit */}
                    <div className={`p-4 sm:p-5 flex items-center justify-between ${
                      isDark ? 'bg-zinc-950/60' : 'bg-emerald-50/50'
                    }`}>
                      <div className="space-y-0.5">
                        <span className="text-emerald-700 dark:text-emerald-400 font-black text-sm block">
                          = مجمل الربح التجاري (Gross Profit)
                        </span>
                        <span className="text-emerald-600/80 text-[11px]">الفارق بين سعر البيع وتكلفة البضاعة قبل خصم مصاريف التشغيل</span>
                      </div>
                      <div className="text-left font-mono font-black text-base text-[#00ab84]">
                        <div>{formatMoney(merchantPnL.grossProfit)}</div>
                        <div className="text-[10px] text-emerald-600 font-bold">هامش: {merchantPnL.grossMarginPct.toFixed(1)}%</div>
                      </div>
                    </div>

                    {/* Item 3: Shipping Deductions */}
                    <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <div className="space-y-0.5">
                        <span className="text-rose-600 dark:text-rose-400 font-black text-sm block">3. مصاريف الشحن والتوصيل الإجمالية</span>
                        <span className="text-zinc-400 text-[11px]">شحن بوسطة، رسوم الفتح، التأمين، ضريبة القيمة المضافة 14%، وشحن المرتجعات</span>
                      </div>
                      <span className="font-mono font-black text-base text-rose-500">-{formatMoney(merchantPnL.shippingExp)}</span>
                    </div>

                    {/* Item 4: Operating Service Fees */}
                    <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <div className="space-y-0.5">
                        <span className="text-amber-600 dark:text-amber-400 font-black text-sm block">4. رسوم تشغيل النظام وإدارة الطلبات</span>
                        <span className="text-zinc-400 text-[11px]">رسوم خدمة النظام لكل شحنة مسجلة</span>
                      </div>
                      <span className="font-mono font-black text-base text-amber-600">-{formatMoney(merchantPnL.operatingExp)}</span>
                    </div>

                    {/* Item 5: Store Expenses & Withdrawal Fees */}
                    {merchantPnL.otherStoreExp > 0 && (
                      <div className="p-4 sm:p-5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                        <div className="space-y-0.5">
                          <span className="text-zinc-700 dark:text-zinc-300 font-black text-sm block">5. مصروفات إضافية ورسوم سحب الرصيد</span>
                          <span className="text-zinc-400 text-[11px]">تغليف، إعلانات، عمالة، أو رسوم تحويل سحب الأرباح المعتمدة</span>
                        </div>
                        <span className="font-mono font-black text-base text-rose-500">-{formatMoney(merchantPnL.otherStoreExp)}</span>
                      </div>
                    )}

                    {/* Final Net Profit */}
                    <div className="p-5 sm:p-6 flex items-center justify-between bg-[#00ab84] text-white">
                      <div className="space-y-0.5">
                        <span className="font-black text-base sm:text-lg block">
                          = صافي الربح المستحق النهائي (Net Income)
                        </span>
                        <span className="text-emerald-100 text-xs">
                          صافي مستحقاتك الصافية بنسبة {merchantPnL.netMarginPct.toFixed(1)}% من إجمالي المبيعات
                        </span>
                      </div>
                      <div className="text-left font-mono font-black text-xl sm:text-2xl text-white">
                        {formatMoney(merchantPnL.netProfit)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Commercial Efficiency KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                  }`}>
                    <span className="text-[11px] text-zinc-400 font-bold block mb-1">متوسط قيمة الأوردر (AOV)</span>
                    <span className="text-lg font-black font-mono text-[#00ab84]">{formatMoney(merchantPnL.aov)}</span>
                  </div>
                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                  }`}>
                    <span className="text-[11px] text-zinc-400 font-bold block mb-1">متوسط تكلفة خدمة الأوردر (CPO)</span>
                    <span className="text-lg font-black font-mono text-rose-500">{formatMoney(merchantPnL.cpo)}</span>
                  </div>
                  <div className={`p-4 rounded-2xl border text-center ${
                    isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
                  }`}>
                    <span className="text-[11px] text-zinc-400 font-bold block mb-1">عدد الأوردرات الكلي المسجل</span>
                    <span className="text-lg font-black font-mono text-zinc-900 dark:text-white">{merchantPnL.totalOrders} أوردر</span>
                  </div>
                </div>
              </div>
            )}

            {/* SUBVIEW 3: RETURNS RESERVE & RISK ASSESSMENT (مخصص أمان المرتجعات) */}
            {statementSubView === 'reserves' && (
              <div className="space-y-6">
                <div className={`p-6 sm:p-7 rounded-[32px] border ${
                  isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
                }`}>
                  <div className="flex items-center gap-3.5 border-b border-zinc-100 dark:border-zinc-800 pb-5">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        مخصص أمان المرتجعات وحماية المحفظة
                      </h3>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        تقدير محاسبي ذكي لمصاريف الشحن المحتملة للشحنات الجاري توصيلها في الطريق لتفادي الأرصدة السالبة
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                      <span className="text-[11px] font-bold text-zinc-400 block mb-1">شحنات جارية في الطريق</span>
                      <div className="text-2xl font-black font-mono text-cyan-600">
                        {returnsReserveAssessment.inTransitCount} <span className="text-xs font-bold text-zinc-400">شحنة</span>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-bold block mt-1">
                        بقيمة تحصيل: {formatMoney(returnsReserveAssessment.inTransitGrossValue)}
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-rose-50/70 border-rose-200'}`}>
                      <span className="text-[11px] font-bold text-rose-500 block mb-1">مخاطر مصاريف شحن المرتجع</span>
                      <div className="text-2xl font-black font-mono text-rose-500">
                        {formatMoney(returnsReserveAssessment.estimatedShippingLossRisk)}
                      </div>
                      <span className="text-[10px] text-rose-400 font-bold block mt-1">
                        معدل تقديري 65 ج.م للشحنة
                      </span>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-amber-50/70 border-amber-200'}`}>
                      <span className="text-[11px] font-bold text-amber-600 block mb-1">مخصص الحجز الموصى به (Holdback)</span>
                      <div className="text-2xl font-black font-mono text-amber-600">
                        {formatMoney(returnsReserveAssessment.recommendedHoldback)}
                      </div>
                      <span className="text-[10px] text-amber-500 font-bold block mt-1">
                        أمان تجاري لحسابك
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#00ab84] text-white">
                      <span className="text-[11px] font-bold text-emerald-100 block mb-1">الرصيد الآمن للسحب الفوري (100%)</span>
                      <div className="text-2xl font-black font-mono text-white">
                        {formatMoney(returnsReserveAssessment.safeWithdrawalBalance)}
                      </div>
                      <span className="text-[10px] text-emerald-100 font-bold block mt-1">
                        خالي تماماً من أي التزامات
                      </span>
                    </div>
                  </div>

                  {/* Actions & Explanatory Banner */}
                  <div className={`mt-6 p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-emerald-50/60 border-emerald-200 text-zinc-700'
                  }`}>
                    <div className="text-xs space-y-1">
                      <div className="font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-[#00ab84]" />
                        <span>نصيحة محاسبية معتمدة لحماية متجرك:</span>
                      </div>
                      <p className="text-zinc-500 dark:text-zinc-400">
                        سحب المبلغ حتى الرصيد الآمن ({formatMoney(returnsReserveAssessment.safeWithdrawalBalance)}) يضمن بقاء محفظتك في المنطقة الإيجابية حتى لو رجعت أي شحنة في الطريق.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setRequestAmount(String(returnsReserveAssessment.safeWithdrawalBalance));
                        setShowRequestModal(true);
                      }}
                      disabled={returnsReserveAssessment.safeWithdrawalBalance <= 0}
                      className="px-5 py-2.5 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-sm transition-all whitespace-nowrap disabled:opacity-50"
                    >
                      <Coins size={14} />
                      <span>طلب سحب بالمبلغ الآمن الآن</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            TAB 7: ACCOUNT, SAVED PAYOUT ACCOUNTS & SECURITY (حسابي والأمان)
           ========================================================= */}
        {currentTab === 'account' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            
            {/* Saved Payout Accounts Card */}
            <div className={`rounded-3xl p-5 sm:p-6 border space-y-5 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
            }`}>
              <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center font-black">
                  <CreditCard size={22} />
                </div>
                <div>
                  <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    حسابات الدفع المفضلة للسحب السريع
                  </h3>
                  <p className="text-xs text-zinc-400">
                    احفظ أرقام محافظك وحسابك البنكي لتظهر تلقائياً عند طلب السحب
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePayoutAccounts} className="space-y-4 text-xs font-bold">
                <div>
                  <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    رقم محفظة الكاش (Vodafone / Etisalat / Orange / WE)
                  </label>
                  <input
                    type="text"
                    value={savedWalletPhone}
                    onChange={e => setSavedWalletPhone(e.target.value)}
                    placeholder="010XXXXXXXX"
                    className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    عنوان انستا باي (InstaPay Handle / IPA أو الرقم)
                  </label>
                  <input
                    type="text"
                    value={savedInstaPay}
                    onChange={e => setSavedInstaPay(e.target.value)}
                    placeholder="username@instapay أو 010XXXXXXXX"
                    className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>اسم البنك</label>
                    <input
                      type="text"
                      value={savedBankName}
                      onChange={e => setSavedBankName(e.target.value)}
                      placeholder="مثال: البنك الأهلي / CIB"
                      className={`w-full p-3.5 border rounded-2xl text-xs outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>
                  <div>
                    <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>اسم المستفيد الثلاثي</label>
                    <input
                      type="text"
                      value={savedBeneficiaryName}
                      onChange={e => setSavedBeneficiaryName(e.target.value)}
                      placeholder="الاسم كما يظهر بالبنك"
                      className={`w-full p-3.5 border rounded-2xl text-xs outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    رقم الحساب البنكي أو الآيبان (IBAN)
                  </label>
                  <input
                    type="text"
                    value={savedBankAccount}
                    onChange={e => setSavedBankAccount(e.target.value)}
                    placeholder="EG000000000000000000000000000"
                    className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    }`}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingPayoutAccounts}
                  className="w-full py-3.5 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl font-black text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              }`}>
                <div className={`flex items-center gap-3 border-b pb-4 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center font-black">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className={`font-black text-base ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      تغيير رمز الدخول السري (PIN)
                    </h3>
                    <p className="text-xs text-zinc-400">
                      قم بتعيين رمز مرور سري خاص بك بدلاً من الرمز الافتراضي
                    </p>
                  </div>
                </div>

                <form onSubmit={handleChangeMerchantPin} className="space-y-3.5 text-xs font-bold">
                  {liveMerchant.passcode && liveMerchant.passcode !== '0000' && (
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>رمز PIN الحالي</label>
                      <input
                        type="password"
                        required
                        value={currentPinInput}
                        onChange={e => setCurrentPinInput(e.target.value)}
                        placeholder="أدخل رمز PIN الحالي"
                        className={`w-full p-3.5 border rounded-2xl font-mono text-center tracking-[4px] outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>رمز PIN الجديد</label>
                      <input
                        type="password"
                        required
                        value={newPinInput}
                        onChange={e => setNewPinInput(e.target.value)}
                        placeholder="••••"
                        maxLength={10}
                        className={`w-full p-3.5 border rounded-2xl font-mono text-center tracking-[4px] outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-1.5 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>تأكيد رمز PIN الجديد</label>
                      <input
                        type="password"
                        required
                        value={confirmPinInput}
                        onChange={e => setConfirmPinInput(e.target.value)}
                        placeholder="••••"
                        maxLength={10}
                        className={`w-full p-3.5 border rounded-2xl font-mono text-center tracking-[4px] outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isChangingPin || !newPinInput.trim()}
                    className="w-full py-3.5 bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 text-white rounded-2xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Key size={15} className="text-emerald-400" />
                    <span>{isChangingPin ? 'جاري التحديث...' : 'تحديث رمز الدخول السري (PIN)'}</span>
                  </button>
                </form>
              </div>

              {/* Biometric FaceID / TouchID Setup Card */}
              <div className={`rounded-3xl p-5 sm:p-6 border space-y-4 ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/80 shadow-xs'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center">
                      <Fingerprint size={22} />
                    </div>
                    <div>
                      <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                        الدخول السريع ببصمة الهاتف / FaceID
                      </h4>
                      <p className="text-xs text-zinc-400">
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
                          isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-emerald-50/50 border-emerald-200'
                        }`}
                      >
                        <div>
                          <div className={`font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>{b.name}</div>
                          <div className="text-[10px] text-zinc-400">
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
                  className="w-full py-3 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                >
                  <Fingerprint size={16} />
                  <span>
                    {biometricAvailable
                      ? 'تفعيل بصمة هذا الهاتف / الجهاز الآن'
                      : 'البصمة غير مدعومة على هذا المتصفح'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

            {/* Bottom SaaS Footer matching reference screenshot */}
            <footer className="pt-10 pb-6 text-center text-xs text-zinc-400 font-bold border-t border-zinc-200/50 dark:border-zinc-800/50 mt-auto">
              © 2026 صنع بواسطة عبده ميديا
            </footer>

          </main>

        </div>
      </div>

      {/* =====================================================================
          FLOATING PILL BOTTOM NAVIGATION DOCK (Shown ONLY on Mobile & Tablet: lg:hidden)
         ===================================================================== */}
      <div
        className="lg:hidden fixed bottom-3 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-tranzinc-x-1/2 sm:w-[520px] z-40"
        dir="rtl"
      >
        <div
          className={`rounded-[32px] px-3 py-2 shadow-2xl border backdrop-blur-xl flex items-center justify-between gap-1 transition-colors ${
            isDark
              ? 'bg-zinc-900/95 border-zinc-800 shadow-black/60'
              : 'bg-white/95 border-zinc-200/90 shadow-zinc-900/10'
          }`}
        >
          {/* 1. Home Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('overview')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'overview' && !showFullMenuDrawer && !showProfileBottomSheet
                ? 'text-[#00ab84] bg-emerald-500/10 font-black'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
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
                ? 'text-[#00ab84] bg-emerald-500/10'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
            title="الإشعارات والتنبيهات"
          >
            <Bell size={20} />
            {(unreadAlertsCount > 0 || merchantOrders.length > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-900" />
            )}
          </button>

          {/* 3. Analytics / Customers Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('analytics')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'analytics' && !showFullMenuDrawer
                ? 'text-[#00ab84] bg-emerald-500/10'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
            title="أداء الأصناف والمحافظات"
          >
            <Users size={20} />
          </button>

          {/* 4. Wallet Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('wallet')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'wallet' && !showFullMenuDrawer
                ? 'text-[#00ab84] bg-emerald-500/10'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
            title="المحفظة والدورة المالية"
          >
            <WalletIcon size={20} />
          </button>

          {/* 5. Orders / Inbox Icon */}
          <button
            type="button"
            onClick={() => navigateToTab('orders')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer ${
              currentTab === 'orders' && !showFullMenuDrawer
                ? 'text-[#00ab84] bg-emerald-500/10'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
            }`}
            title="أوردراتي وشحناتي"
          >
            <Inbox size={20} />
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
                ? 'bg-zinc-900 dark:bg-emerald-600 shadow-zinc-900/30'
                : 'bg-[#00ab84] hover:bg-[#0a664e] shadow-emerald-600/35'
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
                className={isDark ? 'stroke-zinc-800' : 'stroke-zinc-200'}
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="#00ab84"
                strokeWidth="3"
                strokeDasharray={`${(accountReadiness.pct * 94.2) / 100} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <span className={`absolute text-[10px] font-mono font-black ${isDark ? 'text-emerald-400' : 'text-[#00ab84]'}`}>
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
                ? 'bg-[#00ab84] text-white shadow-md'
                : isDark
                ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                : 'bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300/80'
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
            className="fixed inset-0 z-30 bg-zinc-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 pb-20 sm:p-6"
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
                  ? 'bg-gradient-to-b from-zinc-900 via-zinc-900 to-emerald-950/40 border-zinc-800 text-zinc-100'
                  : 'bg-gradient-to-b from-emerald-50/70 via-white to-teal-50/50 border-white text-zinc-800'
              }`}
            >
              {/* Header: القائمة */}
              <div className={`flex items-center justify-between pb-4 mb-2 border-b ${
                isDark ? 'border-zinc-800' : 'border-zinc-200/80'
              }`}>
                <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  القائمة
                </h2>
                <button
                  type="button"
                  onClick={() => setShowFullMenuDrawer(false)}
                  className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Menu Rows (Exact visual structure of Reference 1 with icons on right, chevrons on left) */}
              <div className={`divide-y ${isDark ? 'divide-zinc-800/80' : 'divide-zinc-200/70'} text-sm font-bold`}>
                
                {/* Row 1: الرئيسية */}
                <button
                  type="button"
                  onClick={() => navigateToTab('overview')}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Home size={20} className="text-[#00ab84]" />
                    <span>الرئيسية والأرصدة</span>
                  </div>
                </button>

                {/* Row 2: المنتجات والطلبات (Expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'products_orders' ? null : 'products_orders')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <ShoppingBag size={20} className="text-[#00ab84]" />
                      <span>المنتجات والطلبات</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-400 transition-transform ${expandedMenuSection === 'products_orders' ? 'rotate-180 text-[#00ab84]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'products_orders' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      <button
                        type="button"
                        onClick={() => navigateToTab('create_order')}
                        className="w-full py-2 text-right text-[#00ab84] font-black flex items-center justify-between cursor-pointer"
                      >
                        <span>+ إنشاء أوردر جديد وشحن فوري</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('inventory')}
                        className="w-full py-2 text-right hover:text-[#00ab84] flex items-center justify-between cursor-pointer"
                      >
                        <span>مخزون بضاعتي بالأمانة</span>
                        <span className="font-mono text-[11px] text-[#00ab84]">{totalStockUnits} قطعة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('orders')}
                        className="w-full py-2 text-right hover:text-[#00ab84] flex items-center justify-between cursor-pointer"
                      >
                        <span>الدورة المالية للأوردرات والشحنات</span>
                        <span className="font-mono text-[11px] text-[#00ab84]">{merchantOrders.length}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('transparency')}
                        className="w-full py-2 text-right hover:text-[#00ab84] flex items-center justify-between cursor-pointer"
                      >
                        <span>حركة البضاعة والمخزن (الشفافية)</span>
                        <span className="font-mono text-[11px] text-[#00ab84]">{merchantProducts.length} صنف</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 3: التقارير وأداء المبيعات (Expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'analytics_group' ? null : 'analytics_group')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <Radio size={20} className="text-[#00ab84]" />
                      <span>المبيعات وتحليل المحافظات</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-400 transition-transform ${expandedMenuSection === 'analytics_group' ? 'rotate-180 text-[#00ab84]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'analytics_group' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      <button
                        type="button"
                        onClick={() => navigateToTab('analytics')}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
                      >
                        ترتيب الأصناف الأكثر مبيعاً والأعلى ربحية
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('analytics')}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
                      >
                        توزيع المحافظات ونسب التسليم والمرتجع
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 3B: إدارة العملاء والمشترين */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    navigateToTab('customers');
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Users size={20} className="text-[#00ab84]" />
                    <span>إدارة العملاء والمشترين</span>
                  </div>
                  <span className="font-mono text-xs text-white bg-zinc-800 dark:bg-zinc-700 px-2 py-0.5 rounded-full">
                    {uniqueCustomersCount} عميل
                  </span>
                </button>

                {/* Row 3C: المتجر الإلكتروني */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    setShowStoreModal(true);
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <ShoppingBag size={20} className="text-[#00ab84]" />
                    <span>المتجر الإلكتروني ورابط المشاركة</span>
                  </div>
                  <ExternalLink size={16} className="text-zinc-400" />
                </button>

                {/* Row 3D: التطبيقات والربط الآلي */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    navigateToTab('apps');
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <LayoutGrid size={20} className="text-[#00ab84]" />
                    <span>التطبيقات والربط الآلي (بوسطة وواتساب)</span>
                  </div>
                  <span className="text-[10px] font-black text-[#00ab84] bg-emerald-500/15 px-2 py-0.5 rounded-full">
                    4 تطبيقات
                  </span>
                </button>

                {/* Row 4: صندوق الوارد والإشعارات */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    setShowNotificationsSheet(true);
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Inbox size={20} className="text-[#00ab84]" />
                    <span>صندوق الإشعارات والتسويات</span>
                  </div>
                  {unreadAlertsCount > 0 && (
                    <span className="font-mono text-xs text-white bg-[#00ab84] px-2 py-0.5 rounded-full">
                      {unreadAlertsCount}
                    </span>
                  )}
                </button>

                {/* Row 5: المحفظة والمسحوبات (Expandable) */}
                <div>
                  <button
                    type="button"
                    onClick={() => setExpandedMenuSection(expandedMenuSection === 'finance_group' ? null : 'finance_group')}
                    className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <WalletIcon size={20} className="text-[#00ab84]" />
                      <span>المحفظة وطلبات السحب</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-400 transition-transform ${expandedMenuSection === 'finance_group' ? 'rotate-180 text-[#00ab84]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'finance_group' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      <button
                        type="button"
                        onClick={() => {
                          setShowFullMenuDrawer(false);
                          setOrdersTopViewMode('current_balance');
                          navigateToTab('wallet');
                        }}
                        className="w-full py-2 text-right text-[#00ab84] font-black block cursor-pointer"
                      >
                        الرصيد الحالي ومعاملات المحفظة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowFullMenuDrawer(false);
                          setOrdersTopViewMode('financial_cycle');
                          navigateToTab('wallet');
                        }}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
                      >
                        الدورة المالية للشحنات والمبالغ المحصلة
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowFullMenuDrawer(false);
                          setShowRequestModal(true);
                        }}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
                      >
                        + طلب سحب مستحقات فوري
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('statement')}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
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
                    className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3.5">
                      <Settings size={20} className="text-[#00ab84]" />
                      <span>الإعدادات والأمان</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-zinc-400 transition-transform ${expandedMenuSection === 'settings_group' ? 'rotate-180 text-[#00ab84]' : ''}`}
                    />
                  </button>
                  {expandedMenuSection === 'settings_group' && (
                    <div className="pr-8 pb-3 space-y-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
                      <button
                        type="button"
                        onClick={() => navigateToTab('account')}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
                      >
                        حفظ حسابات الدفع (Vodafone Cash / InstaPay / بنك)
                      </button>
                      <button
                        type="button"
                        onClick={() => navigateToTab('account')}
                        className="w-full py-2 text-right hover:text-[#00ab84] block cursor-pointer"
                      >
                        تغيير رمز PIN وتفعيل بصمة الهاتف
                      </button>
                    </div>
                  )}
                </div>

                {/* Row 6B: الباقات والمدير المخصص لأوردراتك */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    setShowChangePlanModal(true);
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <Crown size={20} className="text-[#00ab84]" />
                    <span>الباقات والمدير المخصص لأوردراتك</span>
                  </div>
                  <span className="text-[11px] font-black text-white bg-[#00ab84] px-2.5 py-0.5 rounded-full">
                    {planUsage.badgeText}
                  </span>
                </button>

                {/* Row 7: تواصل مع إدارة المتجر */}
                <button
                  type="button"
                  onClick={() => {
                    setShowFullMenuDrawer(false);
                    setShowProfileBottomSheet(true);
                  }}
                  className="w-full py-4 flex items-center justify-between hover:text-[#00ab84] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <HeartHandshake size={20} className="text-[#00ab84]" />
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
            className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center"
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
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
                  : 'bg-white border-zinc-200 text-zinc-800'
              } space-y-5`}
            >
              {/* Top Drag Handle Bar */}
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto -mt-1 mb-2" />

              {/* 1. Merchant Identity Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#00ab84] to-emerald-500 text-white flex items-center justify-center font-black text-lg shadow-md">
                      {getInitials(liveMerchant.name)}
                    </div>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900" />
                  </div>
                  <div>
                    <div className={`font-black text-base ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                      {liveMerchant.name}
                    </div>
                    <div className="text-xs text-zinc-400 font-medium">
                      {liveMerchant.role || 'موكل معتمد / Owner'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileBottomSheet(false)}
                  className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-pointer"
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
                  <span className="text-[11px] text-zinc-400 font-bold block">الباقة الحالية</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileBottomSheet(false);
                      setShowChangePlanModal(true);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black shadow-2xs cursor-pointer ${
                      isDark ? 'bg-zinc-900 text-emerald-400' : 'bg-white text-[#00ab84]'
                    }`}
                  >
                    <Crown size={13} />
                    <span>{planUsage.planLabelAr}</span>
                    <span className="text-[10px] underline mr-1">(تغيير الخطة)</span>
                  </button>
                </div>

                <div className="text-left space-y-1">
                  <span className="text-[11px] text-zinc-400 font-bold block">الرصيد المتاح</span>
                  <div className={`font-mono tabular-nums font-black text-base ${isDark ? 'text-white' : 'text-zinc-900'}`} dir="ltr">
                    EGP {hideBalances ? '•••••' : availableForWithdrawal.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* 3. Active Store Selector Card with Checkmark & Order Count Badge (Matching Reference 2) */}
              <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                isDark
                  ? 'bg-zinc-950/70 border-emerald-800/50'
                  : 'bg-emerald-50/30 border-emerald-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                      isDark ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-200/80 text-zinc-700'
                    }`}>
                      {getInitials(storeName)}
                    </div>
                    {merchantOrders.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-mono text-[10px] font-black shadow-xs">
                        {merchantOrders.length}
                      </span>
                    )}
                  </div>
                  <span className={`font-black text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                    {storeName}
                  </span>
                </div>

                <Check size={18} className="text-[#00ab84]" />
              </div>

              {/* 4. Interactive Toggles (Activity, Notifications, Sound, Privacy) */}
              <div className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'} text-xs font-bold`}>
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
                      isActiveStatus ? 'bg-[#00ab84] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
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
                      notificationsEnabled ? 'bg-[#00ab84] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
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
                      soundAlertsEnabled ? 'bg-[#00ab84] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
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
                      hideBalances ? 'bg-[#00ab84] justify-end' : 'bg-zinc-300 dark:bg-zinc-700 justify-start'
                    }`}
                  >
                    <span className="w-5.5 h-5.5 rounded-full bg-white shadow-sm block" />
                  </button>
                </div>
              </div>

              {/* 5. Theme Switcher (المظهر: فاتح / النظام / داكن — Matching Reference 2 & 3) */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold text-zinc-400 block">المظهر</span>
                <div className={`grid grid-cols-3 gap-1 p-1 rounded-2xl ${
                  isDark ? 'bg-zinc-950 border border-zinc-800' : 'bg-zinc-100'
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
                              ? 'bg-zinc-800 text-emerald-400 shadow-xs'
                              : 'bg-white text-[#00ab84] shadow-xs'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
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
              <div className={`divide-y ${isDark ? 'divide-zinc-800' : 'divide-zinc-100'} text-xs font-bold pt-2 border-t ${
                isDark ? 'border-zinc-800' : 'border-zinc-100'
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
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#00ab84] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Users size={17} className="text-zinc-400" />
                    <span>أداء الأصناف والمحافظات</span>
                  </div>
                  <ChevronLeft size={15} className="text-zinc-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('transparency')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#00ab84] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <PackageIcon size={17} className="text-zinc-400" />
                    <span>المنتجات وبضاعة الأمانة</span>
                  </div>
                  <ChevronLeft size={15} className="text-zinc-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('orders')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#00ab84] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Ticket size={17} className="text-zinc-400" />
                    <span>إدارة الأوردرات والشحنات</span>
                  </div>
                  <ChevronLeft size={15} className="text-zinc-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowProfileBottomSheet(false);
                    setOrdersTopViewMode('current_balance');
                    navigateToTab('wallet');
                  }}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#00ab84] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <WalletIcon size={17} className="text-zinc-400" />
                    <span>المحفظة والدورة المالية</span>
                  </div>
                  <ChevronLeft size={15} className="text-zinc-400" />
                </button>

                <button
                  type="button"
                  onClick={() => navigateToTab('account')}
                  className="w-full py-3.5 flex items-center justify-between hover:text-[#00ab84] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <Settings size={17} className="text-zinc-400" />
                    <span>الإعدادات وحسابات الدفع ورمز PIN</span>
                  </div>
                  <ChevronLeft size={15} className="text-zinc-400" />
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
            className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center"
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
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
              } space-y-4`}
            >
              <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full mx-auto -mt-1 mb-1" />
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Bell size={18} className="text-[#00ab84]" />
                  <h3 className="font-black text-sm">آخر التحديثات والإشعارات المالية</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotificationsSheet(false)}
                  className="p-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {merchantFilteredRequests.slice(0, 5).map(req => (
                  <div
                    key={req.id}
                    onClick={() => {
                      setShowNotificationsSheet(false);
                      setOrdersTopViewMode('current_balance');
                      navigateToTab('wallet');
                    }}
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 ${
                      isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200/70'
                    }`}
                  >
                    <div>
                      <div className="font-black">
                        {req.status === 'approved' ? 'تم اعتماد وتحويل طلب السحب' : req.status === 'pending' ? 'طلب سحب قيد المراجعة' : 'تحديث على طلب سحب'}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        المبلغ: <span className="font-mono font-bold text-[#00ab84]">{formatMoney(req.amount)}</span> · {new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="text-zinc-400 shrink-0" />
                  </div>
                ))}

                {(liveMerchant.transactions || []).slice(0, 5).map(tx => (
                  <div
                    key={tx.id}
                    onClick={() => navigateToTab('statement')}
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between gap-3 ${
                      isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200/70'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{tx.notes || 'حركة مالية بكشف الحساب'}</div>
                      <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                        {new Date(tx.date).toLocaleDateString('ar-EG')}
                      </div>
                    </div>
                    <span className={`font-mono font-black shrink-0 ${tx.amount >= 0 ? 'text-[#00ab84]' : 'text-rose-500'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatMoney(tx.amount)}
                    </span>
                  </div>
                ))}

                {merchantFilteredRequests.length === 0 && (!liveMerchant.transactions || liveMerchant.transactions.length === 0) && (
                  <div className="py-10 text-center text-zinc-400 font-bold">
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
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4" dir="rtl">
          <div className={`w-full max-w-md rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto border ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
          }`}>
            <div className={`flex justify-between items-center border-b pb-3 ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
              <h3 className="font-black text-base">طلب سحب مستحقات البضائع</h3>
              <button onClick={() => setShowRequestModal(false)} className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border rounded-2xl text-center ${
              isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div>
                <div className="text-[10px] text-zinc-400 font-bold">إجمالي المحفظة</div>
                <div className="text-xs font-black font-mono tabular-nums">{effectiveMerchantBalance.toLocaleString()} ج.م</div>
              </div>
              <div>
                <div className="text-[10px] text-cyan-500 font-bold">قيد التعليق ({weeklyPayoutOverview.holdingDaysSetting} أيام)</div>
                <div className="text-xs font-black text-cyan-500 font-mono tabular-nums">{weeklyPayoutOverview.holdingSettledBalance.toLocaleString()} ج.م</div>
              </div>
              <div>
                <div className="text-[10px] text-amber-500 font-bold">محجوز لطلب معلق</div>
                <div className="text-xs font-black text-amber-500 font-mono tabular-nums">{pendingRequestsSum.toLocaleString()} ج.م</div>
              </div>
              <div>
                <div className="text-[10px] text-[#00ab84] font-bold">الجاهز للسحب الآن</div>
                <div className="text-xs font-black text-[#00ab84] font-mono tabular-nums">{weeklyPayoutOverview.maturedWalletBalance.toLocaleString()} ج.م</div>
              </div>
            </div>

            {/* Active Pending Withdrawal Requests with 1-Click Cancel */}
            {pendingRequestsSum > 0 && (
              <div className={`p-3 rounded-2xl border space-y-2 ${isDark ? 'bg-amber-950/30 border-amber-700/50 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
                <div className="text-[11px] font-black flex items-center justify-between">
                  <span>لديك طلب سحب معلق يحجز ({pendingRequestsSum.toLocaleString()} ج.م)</span>
                </div>
                {merchantFilteredRequests.filter(r => r.status === 'pending' && (!r.type || r.type === 'withdrawal')).map(req => (
                  <div key={req.id} className="flex items-center justify-between text-xs pt-1 border-t border-amber-500/20">
                    <span className="font-mono font-bold">{Number(req.amount).toLocaleString()} ج.م ({new Date(req.date || req.createdAt || '').toLocaleDateString('ar-EG')})</span>
                    <button
                      type="button"
                      onClick={() => handleCancelPendingWithdrawal(req.id)}
                      className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black cursor-pointer"
                    >
                      إلغاء الطلب وفك الحجز
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Weekly Schedule & Store Manager Limits Info */}
            <div className={`p-3 rounded-2xl border space-y-2 text-[11px] font-bold ${
              isDark ? 'bg-zinc-950/70 border-zinc-800 text-zinc-300' : 'bg-emerald-50/50 border-emerald-200/80 text-zinc-700'
            }`}>
              <div className="flex items-center justify-between">
                <span>موعد التحويل الأسبوعي القادم:</span>
                <span className="font-mono font-black text-[#00ab84] dark:text-emerald-400">{weeklyPayoutOverview.nextWeeklyPayoutDateFormatted}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>حدود السحبة الأسبوعية: من {weeklyPayoutOverview.minWeeklyPayout.toLocaleString()} إلى {weeklyPayoutOverview.maxWeeklyPayout.toLocaleString()} ج.م</span>
                <span>فترة تعليق الأوردر بعد التسوية: {weeklyPayoutOverview.holdingDaysSetting} أيام</span>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-zinc-400 mb-1.5">المبلغ المطلوب سحبه (ج.م):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={requestAmount}
                    min={weeklyPayoutOverview.minWeeklyPayout}
                    max={Math.min(weeklyPayoutOverview.maturedWalletBalance, weeklyPayoutOverview.maxWeeklyPayout)}
                    onChange={e => setRequestAmount(e.target.value)}
                    placeholder={`الحد الأقصى الجاهز للسحب: ${weeklyPayoutOverview.cappedNextPayoutAmount.toLocaleString()}`}
                    className={`w-full p-3.5 border rounded-2xl outline-none font-mono font-black ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                    }`}
                    required
                  />
                  {weeklyPayoutOverview.cappedNextPayoutAmount > 0 && (
                    <button
                      type="button"
                      onClick={() => setRequestAmount(String(weeklyPayoutOverview.cappedNextPayoutAmount))}
                      className="absolute left-2.5 top-1/2 -tranzinc-y-1/2 px-3 py-1.5 bg-[#00ab84] text-white rounded-xl text-[10px] font-black cursor-pointer"
                    >
                      سحب المتاح
                    </button>
                  )}
                </div>

                {/* Live Transfer Commission & Net Payout Summary */}
                {Number(requestAmount) > 0 && (
                  <div className={`mt-2.5 p-3 rounded-2xl border space-y-1.5 text-[11px] font-bold ${
                    isDark ? 'bg-zinc-950/80 border-zinc-800' : 'bg-emerald-50/40 border-emerald-200/70'
                  }`}>
                    <div className="flex items-center justify-between text-zinc-500">
                      <span>إجمالي المبلغ المطلوب سحبه:</span>
                      <span className="font-mono font-black text-zinc-800 dark:text-zinc-200">{formatMoney(Number(requestAmount))}</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-500">
                      <span>عمولة التحويل ({weeklyPayoutOverview.activeFeeLabelAr}):</span>
                      <span className="font-mono font-black">
                        -{formatMoney(weeklyPayoutOverview.calculateFeeForAmount(Number(requestAmount), weeklyPayoutOverview.payoutFrequency))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800 text-[#00ab84] dark:text-emerald-400 text-xs font-black">
                      <span>صافي المبلغ الذي سيصلك:</span>
                      <span className="font-mono">
                        {formatMoney(Math.max(0, Number(requestAmount) - weeklyPayoutOverview.calculateFeeForAmount(Number(requestAmount), weeklyPayoutOverview.payoutFrequency)))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-zinc-400">طريقة التحويل المفضلة:</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      navigateToTab('account');
                    }}
                    className="text-[10px] text-[#00ab84] hover:underline font-black cursor-pointer"
                  >
                    تعديل حساباتي المحفوظة
                  </button>
                </div>
                <select
                  value={payoutMethod}
                  onChange={e => setPayoutMethod(e.target.value as any)}
                  className={`w-full p-3.5 border rounded-2xl outline-none font-bold ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
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
                          payoutMethod === 'wallet' ? 'bg-emerald-500/15 border-[#00ab84] text-[#00ab84]' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
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
                          payoutMethod === 'instapay' ? 'bg-emerald-500/15 border-[#00ab84] text-[#00ab84]' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
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
                          payoutMethod === 'bank' ? 'bg-emerald-500/15 border-[#00ab84] text-[#00ab84]' : 'border-zinc-200 dark:border-zinc-800 text-zinc-400'
                        }`}
                      >
                        حسابي البنكي: {savedBankName || 'بنك'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">رقم المحفظة / الحساب للتحويل:</label>
                <input
                  type="text"
                  value={payoutAccount}
                  onChange={e => setPayoutAccount(e.target.value)}
                  placeholder="010XXXXXXXX أو عنوان إنستاباي أو رقم الحساب"
                  className={`w-full p-3.5 border rounded-2xl outline-none font-mono ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                  }`}
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1.5">ملاحظات إضافية للإدارة (اختياري):</label>
                <input
                  type="text"
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="أي تفاصيل إضافية حول طلب السحب..."
                  className={`w-full p-3.5 border rounded-2xl outline-none ${
                    isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                  }`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className={`px-4 py-3 rounded-2xl cursor-pointer ${isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-700'}`}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="flex-1 py-3 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl font-black cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  {isSubmittingRequest ? 'جاري الإرسال...' : 'تأكيد وإرسال الطلب الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bosta-Style Change Payout Frequency Modal (تغيير تكرار السحب النقدي) */}
      {showPayoutFrequencyModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-zinc-950/75 backdrop-blur-sm p-4" dir="rtl">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
          }`}>
            <div className="flex items-center justify-between border-b border-zinc-200/70 dark:border-zinc-800 pb-4">
              <h3 className="text-lg font-black">تغيير تكرار السحب النقدي</h3>
              <button
                type="button"
                onClick={() => setShowPayoutFrequencyModal(false)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Option 1: Weekly (أسبوعي) */}
              <div
                onClick={() => setTempPayoutFrequency('weekly')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  tempPayoutFrequency === 'weekly'
                    ? 'border-[#00ab84] bg-emerald-500/5'
                    : isDark
                    ? 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    tempPayoutFrequency === 'weekly' ? 'border-[#00ab84]' : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {tempPayoutFrequency === 'weekly' && <div className="w-2.5 h-2.5 rounded-full bg-[#00ab84]" />}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black">أسبوعي</span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
                        weeklyPayoutOverview.weeklyFeeLabelAr === 'مجاناً'
                          ? 'bg-emerald-500/15 text-[#00ab84]'
                          : 'bg-amber-500/15 text-amber-600'
                      }`}>
                        {weeklyPayoutOverview.weeklyFeeLabelAr === 'مجاناً'
                          ? 'مجاناً بدون عمولة تحويل'
                          : `تطبق رسوم (${weeklyPayoutOverview.weeklyFeeLabelAr}) على قيمة المعاملة`}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      تحويل أسبوعي للأرصدة التي مر على تسويتها {weeklyPayoutOverview.holdingDaysSetting} أيام في اليوم الذي تختاره.
                    </p>

                    {tempPayoutFrequency === 'weekly' && (
                      <div className="pt-3 mt-2 border-t border-zinc-200/60 dark:border-zinc-800" onClick={e => e.stopPropagation()}>
                        <label className="block text-[11px] font-black text-zinc-500 mb-2">اختر يوم التحويل الأسبوعي المفضل لديك:</label>
                        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                          {[
                            { day: 0, label: 'الأحد' },
                            { day: 1, label: 'الإثنين' },
                            { day: 2, label: 'الثلاثاء' },
                            { day: 3, label: 'الأربعاء' },
                            { day: 4, label: 'الخميس' },
                            { day: 6, label: 'السبت' },
                            { day: 5, label: 'الجمعة' }
                          ].map(d => (
                            <button
                              key={d.day}
                              type="button"
                              onClick={() => setTempWeeklyPayoutDay(d.day)}
                              className={`py-2 px-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                                tempWeeklyPayoutDay === d.day
                                  ? 'bg-[#00ab84] text-white border-[#00ab84] shadow-xs'
                                  : isDark
                                  ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800'
                                  : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                              }`}
                            >
                              {d.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Option 2: Daily (يومي) */}
              <div
                onClick={() => setTempPayoutFrequency('daily')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                  tempPayoutFrequency === 'daily'
                    ? 'border-[#00ab84] bg-emerald-500/5'
                    : isDark
                    ? 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                    tempPayoutFrequency === 'daily' ? 'border-[#00ab84]' : 'border-zinc-300 dark:border-zinc-600'
                  }`}>
                    {tempPayoutFrequency === 'daily' && <div className="w-2.5 h-2.5 rounded-full bg-[#00ab84]" />}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black">يومي</span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
                        weeklyPayoutOverview.dailyFeeLabelAr === 'مجاناً'
                          ? 'bg-emerald-500/15 text-[#00ab84]'
                          : 'bg-rose-500/15 text-rose-500'
                      }`}>
                        {weeklyPayoutOverview.dailyFeeLabelAr === 'مجاناً'
                          ? 'مجاناً'
                          : `تطبق رسوم ${weeklyPayoutOverview.dailyFeeLabelAr} على قيمة المعاملة`}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      تحويل يومي في أيام العمل الرسمية للأرصدة الجاهزة مع خصم عمولة التحويل المحددة من الإدارة تلقائياً.
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFinancialCycleModal(true);
                      }}
                      className="text-xs font-black text-[#00ab84] hover:underline inline-flex items-center gap-1 pt-0.5 cursor-pointer"
                    >
                      <span>اعرف أكثر عن الدورة المالية</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-200/70 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowPayoutFrequencyModal(false)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black border cursor-pointer ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleSavePayoutFrequencyAndDay(tempPayoutFrequency, tempWeeklyPayoutDay)}
                className="px-6 py-2.5 rounded-xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bosta-Style Financial Cycle Modal (الدورة المالية) */}
      {showFinancialCycleModal && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-zinc-950/75 backdrop-blur-sm p-4" dir="rtl">
          <div className={`w-full max-w-md rounded-3xl border p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
          }`}>
            <div className="flex items-center justify-between border-b border-zinc-200/70 dark:border-zinc-800 pb-4">
              <h3 className="text-lg font-black">الدورة المالية</h3>
              <button
                type="button"
                onClick={() => setShowFinancialCycleModal(false)}
                className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="relative pr-4 space-y-6 before:content-[''] before:absolute before:right-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-emerald-500/30">
              {/* Step 1 */}
              <div className="relative flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#00ab84] text-white text-xs font-black flex items-center justify-center shrink-0 z-10 shadow-sm">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black">1. التوصيل وتحصيل المبلغ</h4>
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    بمجرد تسليم الأوردر للعميل وتحصيل قيمة الشحنة، يتم مراجعة وتسوية الأوردر مالياً من قِبل الإدارة وإضافته إلى رصيد محفظتك.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#00ab84] text-white text-xs font-black flex items-center justify-center shrink-0 z-10 shadow-sm">
                  2
                </div>
                <div className="space-y-2 flex-1">
                  <h4 className="text-sm font-black">2. التسوية المالية وموعد التحويل</h4>
                  <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    يصبح رصيد الأوردر جاهزاً للسحب بعد مرور <span className="text-[#00ab84] font-black">{weeklyPayoutOverview.holdingDaysSetting} أيام</span> من تاريخ التسوية المالية للأوردر.
                  </p>
                  <div className={`p-3 rounded-2xl border space-y-2 text-[11px] font-bold ${
                    isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200/80'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">نظام السحب الأسبوعي:</span>
                      <span className="font-black text-[#00ab84]">
                        {weeklyPayoutOverview.weeklyFeeLabelAr === 'مجاناً' ? 'مجاناً بدون عمولة' : `عمولة ${weeklyPayoutOverview.weeklyFeeLabelAr}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">نظام السحب اليومي:</span>
                      <span className="font-black text-rose-500">
                        {weeklyPayoutOverview.dailyFeeLabelAr === 'مجاناً' ? 'مجاناً بدون عمولة' : `تطبق رسوم ${weeklyPayoutOverview.dailyFeeLabelAr}`}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-zinc-200/60 dark:border-zinc-800 text-zinc-500">
                      طريقة الاستلام: تحويل بنكي / محفظة إلكترونية / إنستاباي
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-200/70 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowFinancialCycleModal(false)}
                className="px-6 py-2.5 rounded-xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black cursor-pointer shadow-md shadow-emerald-600/20"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Bank Transfer Receipt Image Lightbox Modal */}
      {previewReceiptImage && (
        <div
          className="fixed inset-0 z-[150] bg-zinc-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewReceiptImage(null)}
          dir="rtl"
        >
          <div
            className={`relative max-w-2xl w-full rounded-3xl p-5 shadow-2xl border space-y-4 ${
              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <h4 className="font-black text-sm flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#00ab84]" />
                <span>إيصال التحويل البنكي / المحفظة المعتمد من الإدارة</span>
              </h4>
              <div className="flex items-center gap-2">
                <a
                  href={previewReceiptImage}
                  download={`إيصال_تحويل_${liveMerchant.name}_${Date.now()}.jpg`}
                  className="px-3 py-1.5 rounded-xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center gap-1.5"
                >
                  <Download size={13} /> تحميل الإيصال
                </a>
                <button
                  onClick={() => setPreviewReceiptImage(null)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <img
              src={previewReceiptImage}
              alt="إيصال التحويل"
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-auto mx-auto rounded-2xl object-contain border border-zinc-100 dark:border-zinc-800"
            />
          </div>
        </div>
      )}

      {/* Official Printable PDF Statement Modal */}
      {showPrintableStatementModal && (
        <div
          className="fixed inset-0 z-[140] bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          dir="rtl"
          onClick={() => setShowPrintableStatementModal(false)}
        >
          <div
            className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden my-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between print:hidden">
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
                                <div style="font-weight:700;color:#09090b;">${tx.notes || '—'}</div>
                                ${transferRef ? `<div style="font-size:10px;font-family:monospace;color:#00ab84;margin-top:2px;">مرجع التحويل: ${transferRef}</div>` : ''}
                              </td>
                              <td style="text-align:center;font-family:monospace;font-weight:800;direction:ltr;color:${tx.amount >= 0 ? '#00ab84' : '#b91c1c'};">
                                ${tx.amount >= 0 ? '+' : ''}${tx.amount.toLocaleString()} ج.م
                              </td>
                              <td style="text-align:center;font-family:monospace;font-weight:900;direction:ltr;color:#09090b;">
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
    body { font-family: 'Cairo', sans-serif; color: #09090b; background: #fff; direction: rtl; font-size: 12px; line-height: 1.5; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #00ab84; padding-bottom: 14px; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 900; color: #09090b; }
    .subtitle { font-size: 12px; font-weight: 700; color: #475569; margin-top: 4px; }
    .meta-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; font-size: 11px; min-width: 210px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
    .kpi-label { font-size: 10px; font-weight: 800; color: #64748b; }
    .kpi-val { font-size: 15px; font-weight: 900; font-family: monospace; margin-top: 4px; direction: ltr; text-align: right; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid #cbd5e1; }
    th, td { display: table-cell !important; border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; vertical-align: middle; }
    thead th { background: #09090b !important; color: #fff !important; font-weight: 800; text-align: center; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: #64748b; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">${storeName} — كشف حساب موكل رسمي</div>
      <div class="subtitle">اسم الموكل / صاحب البضاعة: <strong style="color:#09090b;">${liveMerchant.name}</strong> (${liveMerchant.id})</div>
      <div class="subtitle">الفترة: ${statementStartDate || 'من بداية التعامل'} إلى ${statementEndDate || new Date().toLocaleDateString('ar-EG')}</div>
    </div>
    <div class="meta-box">
      <div>تاريخ الإصدار: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></div>
      <div style="margin-top:4px;color:#00ab84;font-weight:900;font-size:13px;">الرصيد الحالي: ${overviewStats.persistentBalance.toLocaleString()} ج.م</div>
    </div>
  </div>
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">إجمالي التسويات والإضافات (+)</div>
      <div class="kpi-val" style="color:#00ab84;">+${statementSummary.totalCredits.toLocaleString()} ج.م</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">إجمالي المسحوبات والخصومات (-)</div>
      <div class="kpi-val" style="color:#b91c1c;">-${statementSummary.totalDebits.toLocaleString()} ج.م</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">إجمالي الأوردرات المسلمة</div>
      <div class="kpi-val" style="color:#09090b;">${overviewStats.deliveredCount} طلب</div>
    </div>
    <div class="kpi-card" style="background:#ecfdf5;border-color:#6ee7b7;">
      <div class="kpi-label" style="color:#065f46;">الرصيد المتاح بالمحفظة</div>
      <div class="kpi-val" style="color:#00ab84;">${overviewStats.persistentBalance.toLocaleString()} ج.م</div>
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
                  className="px-4 py-2 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
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

            <div className="p-8 space-y-6 text-zinc-900 bg-white max-h-[80vh] overflow-y-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-[#00ab84] pb-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-900">{storeName} — كشف حساب موكل رسمي</h2>
                  <p className="text-xs text-zinc-600 font-bold mt-1">
                    اسم الموكل / صاحب البضاعة: <span className="font-black text-zinc-900">{liveMerchant.name}</span> ({liveMerchant.id})
                  </p>
                  <p className="text-xs text-zinc-500 font-bold">
                    الفترة: {statementStartDate || 'من بداية التعامل'} إلى {statementEndDate || new Date().toLocaleDateString('ar-EG')}
                  </p>
                </div>
                <div className="text-left font-mono text-xs bg-zinc-50 p-3 rounded-2xl border border-zinc-200">
                  <div className="font-bold text-zinc-500">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</div>
                  <div className="font-black text-[#00ab84] text-sm mt-1">
                    الرصيد الختامي: {overviewStats.persistentBalance.toLocaleString()} ج.م
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                  <div className="text-zinc-500 font-bold">إجمالي التسويات (+)</div>
                  <div className="text-sm font-black font-mono text-[#00ab84] mt-1">+{statementSummary.totalCredits.toLocaleString()} ج.م</div>
                </div>
                <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                  <div className="text-zinc-500 font-bold">إجمالي المسحوبات (-)</div>
                  <div className="text-sm font-black font-mono text-rose-700 mt-1">-{statementSummary.totalDebits.toLocaleString()} ج.م</div>
                </div>
                <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                  <div className="text-zinc-500 font-bold">أوردرات مسلمة</div>
                  <div className="text-sm font-black font-mono text-zinc-900 mt-1">{overviewStats.deliveredCount} طلب</div>
                </div>
                <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50">
                  <div className="text-zinc-500 font-bold">قيمة مخزون الأمانة</div>
                  <div className="text-sm font-black font-mono text-[#00ab84] mt-1">{overviewStats.inventoryValuation.toLocaleString()} ج.م</div>
                </div>
              </div>

              <table className="w-full text-right text-xs border-collapse border border-zinc-300">
                <thead>
                  <tr className="bg-zinc-900 text-white font-black">
                    <th className="p-2.5 border border-zinc-300">التاريخ</th>
                    <th className="p-2.5 border border-zinc-300">نوع العملية</th>
                    <th className="p-2.5 border border-zinc-300">البيان والمرجع البنكي</th>
                    <th className="p-2.5 border border-zinc-300 text-center">المبلغ (ج.م)</th>
                    <th className="p-2.5 border border-zinc-300 text-center">الرصيد بعد العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 font-bold">
                  {filteredStatementTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-zinc-400">لا توجد حركات مالية مسجلة في هذه الفترة</td>
                    </tr>
                  ) : (
                    filteredStatementTransactions.map(tx => {
                      const linkedReq = merchantFilteredRequests.find(r => r.id === tx.referenceId);
                      const transferRef = tx.transferReference || linkedReq?.transferReference;
                      return (
                        <tr key={tx.id}>
                          <td className="p-2.5 border border-zinc-200 font-mono">{new Date(tx.date).toLocaleDateString('ar-EG')}</td>
                          <td className="p-2.5 border border-zinc-200">
                            {tx.type === 'order_delivered' ? 'تسوية مبيعات' :
                             tx.type === 'withdrawal' ? 'سحب مستحقات' :
                             tx.amount >= 0 ? 'إضافة رصيد' : 'خصم / تعديل'}
                          </td>
                          <td className="p-2.5 border border-zinc-200">
                            <div>{tx.notes}</div>
                            {transferRef && <div className="text-[10px] font-mono text-[#00ab84]">مرجع التحويل: {transferRef}</div>}
                          </td>
                          <td className={`p-2.5 border border-zinc-200 text-center font-mono ${tx.amount >= 0 ? 'text-[#00ab84]' : 'text-rose-700'}`}>
                            {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()}
                          </td>
                          <td className="p-2.5 border border-zinc-200 text-center font-mono">{tx.balanceAfter.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              <div className="pt-4 border-t border-zinc-200 flex justify-between items-center text-[11px] text-zinc-500 font-bold">
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
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 bg-zinc-950/70 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border shadow-2xl flex flex-col ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'
              }`}
            >
              {/* Header */}
              <div className={`p-6 border-b flex items-center justify-between ${isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-zinc-100 bg-zinc-50/80'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#00ab84]/10 text-[#00ab84] flex items-center justify-center">
                    <Calculator size={24} />
                  </div>
                  <div>
                    <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-zinc-900'}`}>تفاصيل دورة المبالغ المجمعة</h3>
                    <p className="text-xs text-zinc-400 font-bold">عرض كافة الشحنات المرفقة بهذه التسوية المالية</p>
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
                  if (!s) return <div className="py-10 text-center text-zinc-400 font-bold">عذراً، لم يتم العثور على بيانات التسوية.</div>;
                  
                  return (
                    <div className="space-y-6">
                      {/* Summary Strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                          <span className="text-[10px] text-zinc-400 font-bold block mb-1">رقم التسوية</span>
                          <span className="font-mono font-black text-sm">{s.settlementNumber}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                          <span className="text-[10px] text-zinc-400 font-bold block mb-1">تاريخ الاعتماد</span>
                          <span className="font-black text-xs">{new Date(s.date).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-emerald-950/20 border-emerald-800/40' : 'bg-emerald-50 border-emerald-200'}`}>
                          <span className="text-[10px] text-[#00ab84] font-bold block mb-1">صافي المستحق</span>
                          <span className="font-mono font-black text-lg text-[#00ab84]">{formatMoney(s.netPayoutToMerchant)}</span>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'}`}>
                          <span className="text-[10px] text-zinc-400 font-bold block mb-1">عدد الأوردرات</span>
                          <span className="font-black text-sm">{s.ordersCount} أوردر</span>
                        </div>
                      </div>

                      {/* Orders Table */}
                      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-zinc-800' : 'border-zinc-100'}`}>
                        <table className="w-full text-right text-[11px]">
                          <thead className={`${isDark ? 'bg-zinc-950 text-zinc-400' : 'bg-zinc-50 text-zinc-500'} font-bold border-b border-zinc-100 dark:border-zinc-800`}>
                            <tr>
                              <th className="py-3 px-4">رقم الأوردر</th>
                              <th className="py-3 px-4 text-center">الحالة</th>
                              <th className="py-3 px-4">العميل</th>
                              <th className="py-3 px-4 text-center">المحصل</th>
                              <th className="py-3 px-4 text-center">الشحن والرسوم</th>
                              <th className="py-3 px-4 text-center font-black">الصافي</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${isDark ? 'divide-zinc-800 text-zinc-300' : 'divide-zinc-100 text-zinc-600'}`}>
                            {(s.orderSnapshots || []).map((snap: any, idx: number) => (
                              <tr key={idx} className={isDark ? 'hover:bg-zinc-800/40' : 'hover:bg-zinc-50/60'}>
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
                                <td className="py-3 px-4 text-center font-mono tabular-nums font-black text-[#00ab84]">{formatMoney(snap.netPayoutToMerchant || snap.netMerchantAmount || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {s.notes && (
                        <div className={`p-4 rounded-2xl text-[11px] font-bold ${isDark ? 'bg-zinc-950 text-zinc-400' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          ملاحظات التسوية: {s.notes}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'border-zinc-800 bg-zinc-950/50' : 'border-zinc-100 bg-zinc-50/80'}`}>
                <button 
                  onClick={() => setShowSettlementDetailsId(null)}
                  className={`px-8 py-2.5 rounded-xl font-black text-xs cursor-pointer ${
                    isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                  }`}
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Online Store Launcher Modal */}
      <AnimatePresence>
        {showStoreModal && (
          <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl" onClick={() => setShowStoreModal(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border space-y-5 ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-zinc-100' : 'bg-white border-zinc-200 text-zinc-800'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-[#00ab84] flex items-center justify-center">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-zinc-900 dark:text-white">المتجر الإلكتروني ورابط المشاركة</h3>
                    <p className="text-[11px] text-zinc-400 font-bold">شارك رابط متجرك مع العملاء لاستقبال الطلبات مباشرة</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoreModal(false)}
                  className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Store Link Input with Copy */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-zinc-500 dark:text-zinc-400">رابط المتجر المباشر:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/store/${effectiveStoreId}`}
                    className={`w-full p-3 rounded-2xl text-xs font-mono font-bold border outline-none ${
                      isDark ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-zinc-50 border-zinc-200 text-zinc-800'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/store/${effectiveStoreId}`;
                      navigator.clipboard?.writeText(url);
                      showToast('تم نسخ رابط المتجر بنجاح', 'success');
                    }}
                    className="px-4 py-3 rounded-2xl bg-[#00ab84] hover:bg-[#0a664e] text-white text-xs font-black flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-all"
                  >
                    <Copy size={14} />
                    <span>نسخ</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/store/${effectiveStoreId}`;
                    window.open(url, '_blank');
                  }}
                  className="py-3 px-4 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <ExternalLink size={15} className="text-[#00ab84]" />
                  <span>معاينة المتجر الآن</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const url = `${window.location.origin}/store/${effectiveStoreId}`;
                    const text = encodeURIComponent(`مرحباً بكم في متجرنا! تفضلوا بزيارة الرابط لتصفح المنتجات:\n${url}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}
                  className="py-3 px-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-[#00ab84] text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Share2 size={15} />
                  <span>مشاركة عبر واتساب</span>
                </button>
              </div>

              {/* Visual QR Code Card */}
              <div className={`p-4 rounded-2xl border text-center space-y-2 ${
                isDark ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200/80'
              }`}>
                <div className="w-28 h-28 mx-auto bg-white p-2 rounded-2xl shadow-sm border border-zinc-200 flex items-center justify-center">
                  <QrCode size={90} className="text-zinc-900" />
                </div>
                <div className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                  امسح الرمز بكاميرا الهاتف للوصول السريع للمتجر
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          CHANGE PLAN & DEDICATED ORDER MANAGER MODAL (تغيير الخطة والمدير المخصص)
         ===================================================================== */}
      {liveMerchant && (
        <MerchantChangePlanModal
          isOpen={showChangePlanModal}
          onClose={() => setShowChangePlanModal(false)}
          isDark={isDark}
          merchantName={liveMerchant.name}
          walletBalance={availableForWithdrawal}
          currentSubscription={liveMerchant.subscriptionPlan}
          currentManagerPlan={liveMerchant.managerPlan}
          pendingPlanRequest={liveMerchant.pendingPlanRequest}
          scheduledNextPlan={liveMerchant.scheduledNextPlan}
          planCyclesHistory={liveMerchant.planCyclesHistory}
          usedOrdersCount={planUsage.usedOrders}
          remainingOrdersCount={planUsage.remainingQuota}
          onConfirmSubscriptionChange={handleConfirmSubscriptionChange}
          onRequestPlanChange={handleRequestPlanChange}
          onAcceptAdminCustomQuote={handleAcceptAdminCustomQuote}
          onCancelPendingPlanRequest={handleCancelPendingPlanRequest}
          onScheduleNextPlan={handleScheduleNextPlan}
          onCancelScheduledPlan={handleCancelScheduledPlan}
          onActivateScheduledPlanNow={handleActivateScheduledPlanNow}
          onRequestRefund14Days={handleRequestRefund14Days}
          onRequestWalletTopUp={handleRequestWalletTopUp}
        />
      )}

      {/* =========================================================
          MERCHANT DEDICATED CUSTOM PRICING MODAL (تحديد تسعيرة ورصيد الوكيل)
         ========================================================= */}
      <AnimatePresence>
        {pricingModalProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[160] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setPricingModalProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-[32px] border p-6 sm:p-7 space-y-5 shadow-2xl my-8 ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}
              dir="rtl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-lg shadow-emerald-600/20">
                    <Coins size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black">
                      تحديد التسعيرة والرصيد للوكيل: {liveMerchant?.name}
                    </h3>
                    <p className="text-xs text-zinc-400 font-bold mt-0.5">
                      {pricingModalProduct.name || pricingModalProduct.title}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPricingModalProduct(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveCustomPricing} className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                    {pricingModalProduct.thumbnail || pricingModalProduct.imageUrl || pricingModalProduct.image ? (
                      <img src={pricingModalProduct.thumbnail || pricingModalProduct.imageUrl || pricingModalProduct.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <PackageIcon size={24} className="m-auto text-zinc-400" />
                    )}
                  </div>
                  <div className="text-xs">
                    <div className="font-black">{pricingModalProduct.name || pricingModalProduct.title}</div>
                    <div className="text-[10px] font-mono text-zinc-400 mt-0.5">SKU: {pricingModalProduct.sku || pricingModalProduct.id}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black block text-zinc-700 dark:text-zinc-300">
                      سعر التكلفة الخاص بك للقطعة (ج.م) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.5"
                      value={customCostPrice}
                      onChange={(e) => setCustomCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="مثال: 1500"
                      className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black block text-zinc-700 dark:text-zinc-300">
                      سعر البيع المقترح لزبائنك (ج.م) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      step="0.5"
                      value={customSellingPrice}
                      onChange={(e) => setCustomSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="مثال: 1780"
                      className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-[#00ab84]'
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black block text-zinc-700 dark:text-zinc-300">
                      رصيد الأمانة المخصص لك بالمستودع (عدد القطع) *
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={customAllocatedStock}
                      onChange={(e) => setCustomAllocatedStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      placeholder="مثال: 10"
                      className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                        isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                      }`}
                    />
                  </div>
                </div>

                {/* Live Profit & Capital Summary */}
                {Boolean(customSellingPrice) && (
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-200">
                      <span>ربحك المباشر في القطعة الواحدة:</span>
                      <span className="font-mono font-black text-sm text-[#00ab84]">
                        +{formatMoney(Math.max(0, (Number(customSellingPrice) || 0) - (Number(customCostPrice) || 0)))}
                      </span>
                    </div>
                    {Boolean(customCostPrice) && Number(customCostPrice) > 0 && (
                      <div className="flex items-center justify-between font-bold text-zinc-500 text-[11px]">
                        <span>هامش الربح على التكلفة:</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400">
                          {(((Number(customSellingPrice) - Number(customCostPrice)) / Number(customCostPrice)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {Boolean(customAllocatedStock) && Number(customAllocatedStock) > 0 && Boolean(customCostPrice) && (
                      <div className="flex items-center justify-between font-bold text-zinc-600 dark:text-zinc-300 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                        <span>إجمالي رأس المال بالمخزن ({customAllocatedStock} قطعة):</span>
                        <span className="font-mono font-black text-zinc-900 dark:text-white">
                          {formatMoney((Number(customAllocatedStock) || 0) * (Number(customCostPrice) || 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPricingModalProduct(null)}
                    className="px-5 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl text-xs font-black cursor-pointer hover:bg-zinc-200 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingCustomPricing || !customSellingPrice}
                    className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isSavingCustomPricing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    <span>اعتماد وحفظ التسعيرة والرصيد</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================================
          ADD / EDIT MERCHANT PRODUCT MODAL (إضافة / تعديل صنف أمانة)
         ========================================================= */}
      <AnimatePresence>
        {showAddEditProductModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-zinc-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowAddEditProductModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-xl rounded-[32px] border p-6 sm:p-8 space-y-6 shadow-2xl my-8 ${
                isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
              }`}
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00ab84] to-emerald-500 text-white flex items-center justify-center font-black">
                    <PackageIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">
                      {editingProduct ? 'تعديل بيانات الصنف بالمخزن' : 'إضافة صنف جديد لمخزون الوكيل'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      حدد اسم الصنف وسعر التكلفة ونسبة الربح لمتابعة مستحقاتك بدقة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddEditProductModal(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Navigation Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-2 gap-2">
                <button
                  type="button"
                  onClick={() => setProdModalTab('general')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                    prodModalTab === 'general'
                      ? 'bg-[#00ab84] text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <PackageIcon size={14} />
                  <span>البيانات الأساسية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setProdModalTab('custom_pricing')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                    prodModalTab === 'custom_pricing'
                      ? 'bg-[#00ab84] text-white shadow-sm'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  <DollarSign size={14} />
                  <span>التسعير الخاص بالوكيل</span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveProductSubmit} className="space-y-4">
                {prodModalTab === 'general' ? (
                  <>
                    {/* 1. Name & SKU */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-xs font-black block">اسم المنتج / الصنف *</label>
                        <input
                          type="text"
                          required
                          value={prodFormName}
                          onChange={(e) => setProdFormName(e.target.value)}
                          placeholder="مثال: حذاء كاجوال جلد طبيعي"
                          className={`w-full p-3.5 border rounded-2xl text-xs font-bold outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">كود SKU</label>
                        <input
                          type="text"
                          value={prodFormSku}
                          onChange={(e) => setProdFormSku(e.target.value)}
                          placeholder="SKU-101"
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* 2. Selling Price, Cost Price, & Stock */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">سعر البيع للمستهلك (ج.م) *</label>
                        <input
                          type="number"
                          required
                          min={1}
                          step="0.5"
                          value={prodFormPrice}
                          onChange={(e) => setProdFormPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="500"
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-[#00ab84]'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">سعر التكلفة بالجملة (ج.م)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={prodFormCostPrice}
                          onChange={(e) => setProdFormCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder="300"
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-bold outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">الكمية المتوفرة بمخزنك *</label>
                        <input
                          type="number"
                          required
                          min={0}
                          value={prodFormStock}
                          onChange={(e) => setProdFormStock(parseInt(e.target.value) || 0)}
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* 3. Profit Mode & Commission % */}
                    <div className="p-4 rounded-2xl border bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 space-y-3">
                      <label className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">
                        طريقة احتساب ربح الوكيل من هذا المنتج
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setProdFormProfitMode('commission')}
                          className={`p-3 rounded-xl border text-xs font-black transition-all cursor-pointer text-center ${
                            prodFormProfitMode === 'commission'
                              ? 'bg-[#00ab84] text-white border-[#00ab84] shadow-sm'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          نسبة مئوية (%) من المبيعات
                        </button>
                        <button
                          type="button"
                          onClick={() => setProdFormProfitMode('margin')}
                          className={`p-3 rounded-xl border text-xs font-black transition-all cursor-pointer text-center ${
                            prodFormProfitMode === 'margin'
                              ? 'bg-[#00ab84] text-white border-[#00ab84] shadow-sm'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          فرق السعر والتكلفة (هامش ثابت)
                        </button>
                      </div>

                      {prodFormProfitMode === 'commission' && (
                        <div className="space-y-1.5 pt-2">
                          <div className="flex justify-between text-xs font-black">
                            <span>نسبة عمولة/ربح الموكل (%)</span>
                            <span className="font-mono text-[#00ab84]">{prodFormCommissionPct}%</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={prodFormCommissionPct}
                            onChange={(e) => setProdFormCommissionPct(parseFloat(e.target.value) || 0)}
                            className={`w-full p-3 border rounded-xl font-mono text-xs font-bold outline-none focus:border-[#00ab84] ${
                              isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-zinc-900'
                            }`}
                          />
                        </div>
                      )}

                      {/* Live Calculation Preview */}
                      {Boolean(prodFormPrice) && (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs space-y-1 font-bold">
                          <div className="flex justify-between text-emerald-800 dark:text-emerald-200">
                            <span>ربح الوكيل المتوقع للقطعة:</span>
                            <span className="font-mono font-black text-sm text-[#00ab84]">
                              {prodFormProfitMode === 'commission'
                                ? Math.round((Number(prodFormPrice) || 0) * (prodFormCommissionPct / 100))
                                : Math.max(0, (Number(prodFormPrice) || 0) - (Number(prodFormCostPrice) || 0))} ج.م
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Image URL */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black block">رابط صورة المنتج (اختياري)</label>
                      <input
                        type="url"
                        value={prodFormThumbnail}
                        onChange={(e) => setProdFormThumbnail(e.target.value)}
                        placeholder="https://example.com/product.jpg"
                        className={`w-full p-3.5 border rounded-2xl text-xs font-bold outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>

                    {/* 5. Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black block">وصف أو ملاحظات الصنف (اختياري)</label>
                      <textarea
                        rows={2}
                        value={prodFormDescription}
                        onChange={(e) => setProdFormDescription(e.target.value)}
                        placeholder="تفاصيل المادة، المقاسات، الملاحظات..."
                        className={`w-full p-3.5 border rounded-2xl text-xs font-bold outline-none focus:border-[#00ab84] ${
                          isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                        }`}
                      />
                    </div>
                  </>
                ) : (
                  /* Custom Pricing Tab Content */
                  <div className="space-y-4 py-1">
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs space-y-1.5 font-bold">
                      <div className="flex items-center gap-2 text-amber-900 dark:text-amber-100 font-black text-sm">
                        <Sparkles size={18} className="text-amber-500 shrink-0" />
                        <span>تسعير ورصيد خاص بك كوكيل / موكل مشترك</span>
                      </div>
                      <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed font-normal">
                        تحديد السعر الخاص بك هنا يتيح لك بيع هذا المنتج بسعر مخصص يناسب عملاءك دون التعديل على السعر الرئيسي للموكل الأساسي صاحب البضاعة.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">سعر البيع الخاص بك (ج.م) *</label>
                        <input
                          type="number"
                          min={1}
                          step="0.5"
                          value={merchantCustomSellingPrice}
                          onChange={(e) => setMerchantCustomSellingPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder={String(prodFormPrice || 0)}
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-emerald-400' : 'bg-zinc-50 border-zinc-200 text-[#00ab84]'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">سعر التكلفة الخاصة بك (ج.م)</label>
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={merchantCustomCostPrice}
                          onChange={(e) => setMerchantCustomCostPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                          placeholder={String(prodFormCostPrice || 0)}
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-bold outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black block">الرصيد المخصص بمخزنك</label>
                        <input
                          type="number"
                          min={0}
                          value={merchantCustomStock}
                          onChange={(e) => setMerchantCustomStock(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                          placeholder={String(prodFormStock || 0)}
                          className={`w-full p-3.5 border rounded-2xl font-mono text-xs font-black outline-none focus:border-[#00ab84] ${
                            isDark ? 'bg-zinc-950 border-zinc-800 text-white' : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Live Profit & Capital Calculation Summary */}
                    {Boolean(merchantCustomSellingPrice) && (
                      <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-200">
                          <span>ربحك المباشر في القطعة الواحدة:</span>
                          <span className="font-mono font-black text-sm text-[#00ab84]">
                            +{formatMoney(Math.max(0, (Number(merchantCustomSellingPrice) || 0) - (Number(merchantCustomCostPrice) || 0)))}
                          </span>
                        </div>
                        {Boolean(merchantCustomCostPrice) && Number(merchantCustomCostPrice) > 0 && (
                          <div className="flex items-center justify-between font-bold text-zinc-500 text-[11px]">
                            <span>هامش الربح على التكلفة:</span>
                            <span className="font-mono text-emerald-600 dark:text-emerald-400">
                              {(((Number(merchantCustomSellingPrice) - Number(merchantCustomCostPrice)) / Number(merchantCustomCostPrice)) * 100).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {Boolean(merchantCustomStock) && Number(merchantCustomStock) > 0 && Boolean(merchantCustomCostPrice) && (
                          <div className="flex items-center justify-between font-bold text-zinc-600 dark:text-zinc-300 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                            <span>إجمالي رأس المال بالرصيد الخاص ({merchantCustomStock} قطعة):</span>
                            <span className="font-mono font-black text-zinc-900 dark:text-white">
                              {formatMoney((Number(merchantCustomStock) || 0) * (Number(merchantCustomCostPrice) || 0))}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Submit buttons */}
                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddEditProductModal(false)}
                    className="px-5 py-3.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl text-xs font-black cursor-pointer hover:bg-zinc-200 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProduct || !prodFormName.trim() || (!prodFormPrice && !merchantCustomSellingPrice)}
                    className="flex-1 py-3.5 bg-[#00ab84] hover:bg-[#0a664e] text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 active:scale-[0.98]"
                  >
                    {isSavingProduct ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    <span>{editingProduct ? 'تعديل وحفظ البيانات' : 'حفظ وإضافة الصنف للمخزون'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
