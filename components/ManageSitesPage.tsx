import React, { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, ShoppingCart, ExternalLink, Inbox, Eye, UserPlus, 
  Settings as SettingsIcon, XCircle, Send, Filter, ChevronsUpDown, Save, 
  Store as StoreIconLucide, Tag, Globe, Search, Sparkles, CheckCircle2, 
  Copy, Users, ShieldCheck, Layers, Radio, Pin, PinOff, Star, Zap,
  Check, ArrowRight, Package, ShoppingBag, DollarSign, TrendingUp,
  X, ShieldAlert, Award, Compass, RefreshCw, Wallet, ArrowLeftRight,
  Trash2, LogIn, LayoutDashboard, AlertTriangle, Lock, Unlock, Wrench
} from 'lucide-react';
import { User, Store, StoreData, Employee, Transaction } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import * as db from '../services/databaseService';
import { inAppAlert, inAppConfirm } from '../utils/inAppAlert';
import { getStoreVerificationTier, isStoreVerified } from '../utils/commerceEcosystem';
import { VerifiedStoreBadge } from './VerifiedStoreBadge';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
    }
  }
};

const itemVariants = {
  hidden: { y: 15, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3 }
  }
};

interface ManageSitesPageProps {
  ownedStores: Store[];
  collaboratingStores: Store[];
  setActiveStoreId: (id: string) => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  currentUser: User | null;
  setCurrentUser?: React.Dispatch<React.SetStateAction<User | null>>;
  onImpersonate?: (user: User, targetStoreId?: string) => void;
}

const getGreetingByTime = (name?: string): { greeting: string; period: string } => {
  const hour = new Date().getHours();
  const firstName = name?.trim() ? name.split(' ')[0] : 'عزيزنا الشريك';
  
  if (hour >= 4 && hour < 12) {
    return {
      greeting: `صباح الخير والبركة يا ${firstName} ☀️`,
      period: 'بداية يوم موفقة لزيادة مبيعاتك وأرباحك'
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      greeting: `طاب يومك بكل توفيق يا ${firstName} ✨`,
      period: 'متابعة حية لأداء متاجرك وعملياتك التشغيلية'
    };
  }
  if (hour >= 17 && hour < 23) {
    return {
      greeting: `مساء الخير والريادة يا ${firstName} 🌙`,
      period: 'إغلاق يومي متميز ومتابعة لشحنات وطلبات اليوم'
    };
  }
  return {
    greeting: `أهلاً وسهلاً بك يا ${firstName} 🌟`,
    period: 'منصتك تعمل على مدار الساعة لخدمة عملائك'
  };
};

const formatArabicDate = (dateString?: string | Date): string => {
  if (!dateString) return 'حديثاً';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'حديثاً';
    const day = d.getDate();
    const monthsArabic = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const month = monthsArabic[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return 'حديثاً';
  }
};

const sanitizeStoreSubdomain = (raw?: string, storeId?: string): string => {
  const cleaned = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\.abdomedi\.com.*$/i, '')
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!cleaned) {
    const suffix = String(storeId || '').replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase() || '1000';
    return `store-${suffix}`;
  }
  if (/^\d+$/.test(cleaned) || cleaned.length < 3) {
    return `store-${cleaned}`;
  }
  return cleaned.slice(0, 30).replace(/-+$/g, '');
};

const formatDisplayDomain = (store: Store): string => {
  if (store.customDomain && store.customDomain.trim()) {
    return store.customDomain.trim();
  }
  const cleanSub = sanitizeStoreSubdomain(store.subdomain || store.url, store.id);
  if (cleanSub.length > 24) {
    return `...${cleanSub.slice(-18)}.abdomedi.com`;
  }
  return `${cleanSub}.abdomedi.com`;
};

// Only calculate revenue for successfully collected/delivered orders
const isCollectedOrder = (order: any) => {
  return (
    order.collectionProcessed === true ||
    order.paymentStatus === 'مدفوع' ||
    ['تم_التحصيل', 'مدفوعة', 'تم_توصيلها', 'تم_التوصيل'].includes(order.status)
  );
};

// Calculate based on product selling price (excluding shipping/external fees)
const getOrderProductSales = (order: any): number => {
  if (Array.isArray(order.items) && order.items.length > 0) {
    const itemsTotal = order.items.reduce((sum: number, item: any) => {
      const price = Number(item.price ?? 0);
      const qty = Number(item.quantity ?? 1);
      return sum + (price * qty);
    }, 0);
    if (itemsTotal > 0) return itemsTotal;
  }
  const prodPrice = Number(order.productPrice ?? 0);
  if (prodPrice > 0) return prodPrice;
  const totalPrice = Number(order.totalPrice ?? 0);
  const shippingFee = Number(order.shippingFee ?? 0);
  return Math.max(0, totalPrice - shippingFee);
};

// Calculate store metrics
const getStoreStats = (storeId: string, allStoresData: Record<string, StoreData>) => {
  const data = allStoresData[storeId];
  const productsCount = data?.settings?.products?.length || 0;
  const orders = data?.orders || [];
  const ordersCount = orders.length;
  
  const totalRevenue = orders.filter(isCollectedOrder).reduce((acc, order) => {
    const val = getOrderProductSales(order);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return {
    productsCount,
    ordersCount,
    totalRevenue
  };
};

const ManageSitesPage: React.FC<ManageSitesPageProps> = ({ 
  currentUser, 
  setCurrentUser,
  ownedStores = [], 
  collaboratingStores = [], 
  setActiveStoreId, 
  users, 
  setUsers, 
  allStoresData, 
  setAllStoresData,
  onImpersonate
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isWelcomeFromOtp = searchParams.get('welcome') === 'true';

  const [showWelcomeBanner, setShowWelcomeBanner] = useState<boolean>(isWelcomeFromOtp);
  const [storeToEdit, setStoreToEdit] = useState<Store | null>(null);
  const [storeToInvite, setStoreToInvite] = useState<Store | null>(null);
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pinned' | 'collaborating'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Admin Platform Sync & Inline Controls State
  const [isSyncingPlatform, setIsSyncingPlatform] = useState(false);
  const [adjustingStoreWallet, setAdjustingStoreWallet] = useState<{ id: string; name: string } | null>(null);
  const [adjustmentDetails, setAdjustmentDetails] = useState({ amount: '', type: 'deposit' as 'deposit' | 'withdraw', note: '' });
  const [adjustError, setAdjustError] = useState('');
  const [isSavingWallet, setIsSavingWallet] = useState(false);

  const [showAdminCreateStoreModal, setShowAdminCreateStoreModal] = useState(false);
  const [adminNewStore, setAdminNewStore] = useState({ name: '', url: '', ownerPhone: '', specialization: 'عام' });
  const [adminCreateStoreError, setAdminCreateStoreError] = useState('');
  const [isCreatingAdminStore, setIsCreatingAdminStore] = useState(false);

  // Trigger celebratory confetti if arriving from OTP confirmation
  useEffect(() => {
    if (isWelcomeFromOtp) {
      try {
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.35 },
          colors: ['#10b981', '#059669', '#3b82f6', '#6366f1', '#f59e0b']
        });
      } catch (err) {
        console.warn('Confetti effect ignored:', err);
      }
    }
  }, [isWelcomeFromOtp]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const isAdminView = currentUser?.isAdmin;

  // Hydrate all platform users and stores data from Cloudflare D1 when opened in Admin view
  const syncPlatformData = async (showFeedback: boolean = false) => {
    if (!isAdminView) return;
    setIsSyncingPlatform(true);
    try {
      let targetUsers = users;
      const remoteUsers = await db.getAllUsers().catch(() => null);
      if (remoteUsers && remoteUsers.length > 0) {
        targetUsers = remoteUsers;
        setUsers(remoteUsers);
      }

      const storeIds: string[] = [];
      targetUsers.forEach(u => {
        u.stores?.forEach(s => {
          if (s.id && !storeIds.includes(s.id)) {
            storeIds.push(s.id);
          }
        });
      });

      const validSet = new Set(storeIds);
      try {
        const savedLast = localStorage.getItem('lastActiveStoreId');
        if (savedLast && !validSet.has(savedLast)) {
          localStorage.removeItem('lastActiveStoreId');
        }
        const savedDef = localStorage.getItem('defaultStoreId');
        if (savedDef && !validSet.has(savedDef)) {
          localStorage.removeItem('defaultStoreId');
        }
      } catch {}

      if (storeIds.length > 0) {
        const results = await Promise.all(
          storeIds.map(async (id) => {
            try {
              const data = await db.getStoreData(id, true);
              return { id, data };
            } catch {
              return null;
            }
          })
        );
        setAllStoresData(prev => {
          const next: Record<string, StoreData> = {};
          storeIds.forEach(id => {
            if (prev[id]) next[id] = prev[id];
          });
          results.forEach(res => {
            if (res && res.data && validSet.has(res.id)) {
              next[res.id] = res.data;
            }
          });
          return next;
        });
      } else {
        setAllStoresData({});
      }

      if (showFeedback) {
        showToast('تمت مزامنة كافة بيانات المنظومة والمتاجر والمحافظ مع السيرفر السحابي بنجاح ✅');
      }
    } catch (err) {
      console.error('Platform sync error:', err);
      if (showFeedback) {
        showToast('تعذر تحديث بعض بيانات السيرفر، حاول مرة أخرى.');
      }
    } finally {
      setIsSyncingPlatform(false);
    }
  };

  useEffect(() => {
    if (isAdminView) {
      syncPlatformData(false);
    }
  }, [isAdminView]);

  const allPlatformStores = useMemo(() => {
    if (!isAdminView) return [];
    return users.flatMap(user => 
        user.stores?.map(store => ({ store, ownerName: user.fullName, owner: user })) || []
    );
  }, [isAdminView, users]);

  const adminSystemMetrics = useMemo(() => {
    if (!isAdminView) {
      return { totalUsersCount: 0, activeMerchantsCount: 0, totalWalletsBalance: 0, pendingFinancialCount: 0 };
    }
    const nonAdminUsers = users.filter(u => !u.isAdmin);
    let totalWalletsBalance = 0;
    let pendingFinancialCount = 0;

    allPlatformStores.forEach(({ store }) => {
      const data = allStoresData[store.id];
      if (data) {
        totalWalletsBalance += Number(data.wallet?.balance || 0);
        data.wallet?.transactions?.forEach(t => {
          if (t.status === 'pending' && !String(t.id || '').startsWith('WF-')) {
            pendingFinancialCount++;
          }
        });
      }
    });

    return {
      totalUsersCount: nonAdminUsers.length,
      activeMerchantsCount: nonAdminUsers.filter(u => !u.isBanned).length,
      totalWalletsBalance,
      pendingFinancialCount
    };
  }, [isAdminView, users, allPlatformStores, allStoresData]);

  // Actual owned stores from currentUser or props
  const userOwnedStores = useMemo(() => {
    if (currentUser?.stores && currentUser.stores.length > 0) {
      return currentUser.stores;
    }
    return ownedStores;
  }, [currentUser?.stores, ownedStores]);

  // Sort stores so that default pinned store is always first!
  const sortedOwnedStores = useMemo(() => {
    const pinnedId = currentUser?.defaultStoreId;
    if (!pinnedId) return userOwnedStores;
    return [...userOwnedStores].sort((a, b) => {
      if (a.id === pinnedId) return -1;
      if (b.id === pinnedId) return 1;
      return 0;
    });
  }, [userOwnedStores, currentUser?.defaultStoreId]);

  const defaultPinnedStore = useMemo(() => {
    const pinnedId = currentUser?.defaultStoreId;
    if (!pinnedId) return null;
    return [...userOwnedStores, ...collaboratingStores].find(s => s.id === pinnedId) || null;
  }, [currentUser?.defaultStoreId, userOwnedStores, collaboratingStores]);

  // Overall Portfolio Aggregated Metrics
  const portfolioMetrics = useMemo(() => {
    const storesToCount = isAdminView ? allPlatformStores.map(a => a.store) : [...userOwnedStores, ...collaboratingStores];
    let totalProducts = 0;
    let totalOrders = 0;
    let totalRevenue = 0;

    storesToCount.forEach(store => {
      const stats = getStoreStats(store.id, allStoresData);
      totalProducts += stats.productsCount;
      totalOrders += stats.ordersCount;
      totalRevenue += stats.totalRevenue;
    });

    return {
      storesCount: storesToCount.length,
      totalProducts,
      totalOrders,
      totalRevenue
    };
  }, [isAdminView, allPlatformStores, userOwnedStores, collaboratingStores, allStoresData]);

  const allSpecializations = useMemo(() => {
    const storesForSpec = isAdminView ? allPlatformStores.map(item => item.store) : [...userOwnedStores, ...collaboratingStores];
    return [...new Set(storesForSpec.map(s => s.specialization).filter(Boolean))];
  }, [isAdminView, allPlatformStores, userOwnedStores, collaboratingStores]);

  const filterStore = (s: Store, ownerName?: string, ownerPhone?: string) => {
    const matchesSpec = specializationFilter === 'all' || s.specialization === specializationFilter;
    const isPinned = currentUser?.defaultStoreId === s.id;
    
    if (statusFilter === 'pinned' && !isPinned) return false;
    
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesSpec;
    
    const matchesName = s.name.toLowerCase().includes(query);
    const matchesDomain = (s.customDomain || s.subdomain || s.url || '').toLowerCase().includes(query);
    const matchesOwner = ownerName ? ownerName.toLowerCase().includes(query) : false;
    const matchesPhone = ownerPhone ? ownerPhone.includes(query) : false;
    
    return matchesSpec && (matchesName || matchesDomain || matchesOwner || matchesPhone);
  };

  const filteredOwnedStores = useMemo(() => sortedOwnedStores.filter(s => filterStore(s)), [sortedOwnedStores, specializationFilter, statusFilter, searchQuery]);
  const filteredCollaboratingStores = useMemo(() => collaboratingStores.filter(s => filterStore(s)), [collaboratingStores, specializationFilter, statusFilter, searchQuery]);
  const filteredAdminStores = useMemo(() => allPlatformStores.filter(({ store, ownerName, owner }) => filterStore(store, ownerName, owner?.phone)), [allPlatformStores, specializationFilter, statusFilter, searchQuery]);

  // Pin / Unpin handler
  const handleTogglePinStore = (storeId: string, storeName: string) => {
    const isCurrentlyPinned = currentUser?.defaultStoreId === storeId;
    const newDefaultId = isCurrentlyPinned ? undefined : storeId;

    const updatedUser: User = {
      ...currentUser!,
      defaultStoreId: newDefaultId,
      autoLaunchDefaultStore: !!newDefaultId
    };

    if (setCurrentUser) {
      setCurrentUser(updatedUser);
    }

    const updatedUsers = users.map(u => 
      (u.phone === currentUser?.phone || u.email === currentUser?.email)
        ? { ...u, defaultStoreId: newDefaultId, autoLaunchDefaultStore: !!newDefaultId }
        : u
    );
    setUsers(updatedUsers);

    try {
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      localStorage.setItem('user_session_v4', JSON.stringify(updatedUser));
      if (newDefaultId) {
        localStorage.setItem('defaultStoreId', newDefaultId);
        localStorage.setItem('lastActiveStoreId', newDefaultId);
      } else {
        localStorage.removeItem('defaultStoreId');
      }
    } catch (e) {
      console.error(e);
    }

    // Persist directly to user's permanent document in Cloudflare D1
    db.createUserDoc(updatedUser).catch(err => {
      console.warn('Sync user doc with pinned store failed:', err);
    });

    db.saveGlobalData({ users: updatedUsers, loyaltyData: {} }).catch(err => {
      console.warn('Sync pinned store to global failed:', err);
    });

    if (newDefaultId) {
      showToast(`تم تثبيت "${storeName}" كمتجر افتراضي رئيسي وسيتم الدخول عليه تلقائياً 📌⚡`);
    } else {
      showToast(`تم إلغاء تثبيت المتجر الافتراضي`);
    }
  };

  // Auto-launch toggle handler
  const handleToggleAutoLaunch = (enable: boolean) => {
    const updatedUser: User = {
      ...currentUser!,
      autoLaunchDefaultStore: enable
    };

    if (setCurrentUser) {
      setCurrentUser(updatedUser);
    }

    const updatedUsers = users.map(u => 
      (u.phone === currentUser?.phone || u.email === currentUser?.email)
        ? { ...u, autoLaunchDefaultStore: enable }
        : u
    );
    setUsers(updatedUsers);

    try {
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      localStorage.setItem('autoLaunchDefaultStore', enable ? 'true' : 'false');
    } catch (e) {
      console.error(e);
    }

    db.saveGlobalData({ users: updatedUsers, loyaltyData: {} }).catch(console.warn);

    showToast(
      enable 
        ? 'تم تفعيل الدخول التلقائي للمتجر الافتراضي عند تسجيل الدخول ⚡' 
        : 'تم إلغاء الدخول التلقائي (ستظهر شاشة المتاجر دائماً)'
    );
  };

  const handleSelectStore = (storeId: string) => {
    setActiveStoreId(storeId);
    try {
      localStorage.setItem('lastActiveStoreId', storeId);
    } catch {}
    navigate(`/store/${storeId}/dashboard`);
  };

  const handlePreviewStore = (storeId: string) => {
    const store = [...userOwnedStores, ...collaboratingStores].find(s => s.id === storeId);
    const cleanSub = sanitizeStoreSubdomain(store?.subdomain, storeId);
    const isInternal = typeof window !== 'undefined' && (
      window.location.hostname.includes('run.app') ||
      window.location.hostname.includes('pages.dev') ||
      window.location.hostname.includes('localhost') ||
      window.location.hostname.includes('127.0.0.1')
    );
    const linkUrl = store?.customDomain
      ? (store.customDomain.startsWith('http') ? store.customDomain : `https://${store.customDomain}`)
      : (isInternal ? `${window.location.origin}/s/${cleanSub || storeId}` : `https://abdomedi.com/s/${cleanSub || storeId}`);
    
    window.open(linkUrl, '_blank');
  };
  
  const handleSaveSettings = async (updatedStore: Store) => {
    const owner = users.find(u => u.stores?.some(s => s.id === updatedStore.id));
    if (!owner) return;

    const existingStoreData = allStoresData[updatedStore.id];
    const verified = isStoreVerified(existingStoreData?.settings);
    const prevStoreObj = (owner.stores || []).find(s => s.id === updatedStore.id);
    const lockedName =
      existingStoreData?.settings?.commerceState?.verification?.verifiedStoreNameLocked ||
      prevStoreObj?.name;

    if (verified && !currentUser?.isAdmin && lockedName && updatedStore.name.trim() !== lockedName.trim()) {
      await inAppAlert(
        'لا يمكن تعديل الاسم التجاري للمتجر بعد توثيقه بالشارة الخضراء إلا عن طريق مراجعة إدارة المنصة.',
        { title: 'الاسم التجاري محمي بالتوثيق', type: 'warning' }
      );
      return;
    }

    const updatedOwner: User = {
      ...owner,
      stores: (owner.stores || []).map(s => s.id === updatedStore.id ? updatedStore : s)
    };
    const updatedUsers = users.map(u => u.phone === owner.phone ? updatedOwner : u);

    setUsers(updatedUsers);
    if (currentUser?.phone === owner.phone && setCurrentUser) {
      setCurrentUser(updatedOwner);
    }

    if (existingStoreData) {
      const nextCommerceState =
        verified && currentUser?.isAdmin && lockedName && updatedStore.name.trim() !== lockedName.trim() && existingStoreData.settings?.commerceState?.verification
          ? {
              ...existingStoreData.settings.commerceState,
              verification: {
                ...existingStoreData.settings.commerceState.verification,
                verifiedStoreNameLocked: updatedStore.name.trim()
              }
            }
          : existingStoreData.settings?.commerceState;

      const updatedStoreData: StoreData = {
        ...existingStoreData,
        settings: {
          ...existingStoreData.settings,
          storeName: updatedStore.name,
          ...(nextCommerceState ? { commerceState: nextCommerceState } : {})
        }
      };
      setAllStoresData(prev => ({ ...prev, [updatedStore.id]: updatedStoreData }));
      db.saveStoreData(updatedStore, updatedStoreData).catch(console.warn);
    }

    db.createUserDoc(updatedOwner).catch(console.warn);
    db.saveGlobalData({ users: updatedUsers, loyaltyData: {} }).catch(console.warn);

    setStoreToEdit(null);
    showToast(`تم حفظ ومزامنة إعدادات متجر "${updatedStore.name}" سحابياً بنجاح ✅`);
  };

  const handleToggleOwnerBan = async (owner: User) => {
    const nextAction = owner.isBanned ? 'إلغاء حظر' : 'حظر';
    const ok = await inAppConfirm(`هل أنت متأكد من ${nextAction} التاجر "${owner.fullName}" (${owner.phone})؟`, {
      title: `${nextAction} حساب تاجر`,
      type: owner.isBanned ? 'info' : 'warning',
      confirmText: `تأكيد الـ${nextAction}`,
      cancelText: 'إلغاء'
    });
    if (!ok) return;

    const updatedOwner: User = { ...owner, isBanned: !owner.isBanned };
    const updatedUsers = users.map(u => u.phone === owner.phone ? updatedOwner : u);
    setUsers(updatedUsers);

    try {
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      showToast(`تم ${nextAction} حساب "${owner.fullName}" بنجاح.`);
    } catch {
      await inAppAlert('تعذر تحديث حالة الحظر على الخادم السحابي.', { type: 'error' });
    }
  };

  const handleToggleStoreBan = async (owner: User, store: Store) => {
    const nextBanned = !store.isBanned;
    const nextAction = nextBanned ? 'إيقاف وحظر' : 'إعادة تفعيل وفك حظر';
    const ok = await inAppConfirm(`هل أنت متأكد من ${nextAction} متجر "${store.name}"؟`, {
      title: `${nextAction} متجر`,
      type: nextBanned ? 'danger' : 'info',
      confirmText: `نعم، ${nextAction}`,
      cancelText: 'إلغاء'
    });
    if (!ok) return;

    const updatedOwner: User = {
      ...owner,
      stores: (owner.stores || []).map(s => s.id === store.id ? { ...s, isBanned: nextBanned } : s)
    };
    const updatedUsers = users.map(u => u.phone === owner.phone ? updatedOwner : u);
    setUsers(updatedUsers);

    try {
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      showToast(`تم ${nextAction} متجر "${store.name}" بنجاح.`);
    } catch {
      await inAppAlert('تعذر تحديث حالة حظر المتجر على الخادم السحابي.', { type: 'error' });
    }
  };

  const handleAdjustStoreBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError('');
    if (!adjustingStoreWallet) return;

    const amountNum = parseFloat(adjustmentDetails.amount);
    if (!amountNum || amountNum <= 0) {
      setAdjustError('يجب إدخال مبلغ صحيح أكبر من الصفر.');
      return;
    }

    const storeId = adjustingStoreWallet.id;
    let storeInfo = allStoresData[storeId];
    if (!storeInfo) {
      storeInfo = await db.getStoreData(storeId, true).catch(() => undefined as any);
    }
    if (!storeInfo) {
      setAdjustError('بيانات المتجر غير متوفرة للمزامنة حالياً.');
      return;
    }

    const currentBalance = storeInfo.wallet?.balance || 0;
    const isDeposit = adjustmentDetails.type === 'deposit';

    if (!isDeposit && amountNum > currentBalance) {
      setAdjustError(`المبلغ المراد خصمه أكبر من رصيد المحفظة الحالي (${currentBalance.toLocaleString('ar-EG')} ج.م).`);
      return;
    }

    setIsSavingWallet(true);
    const newTx: Transaction = {
      id: `MANUAL-${Math.floor(100000 + Math.random() * 900000)}`,
      amount: amountNum,
      type: isDeposit ? 'إيداع' : 'سحب',
      category: 'wallet_charge',
      status: 'completed',
      date: new Date().toISOString(),
      note: adjustmentDetails.note.trim() || 'تسوية رصيد يدوية بواسطة مدير المنظومة'
    };

    const newBalance = isDeposit ? currentBalance + amountNum : currentBalance - amountNum;
    const updatedPayload: StoreData = {
      ...storeInfo,
      wallet: {
        ...storeInfo.wallet,
        balance: newBalance,
        transactions: [newTx, ...(storeInfo.wallet?.transactions || [])]
      }
    };

    try {
      await db.saveStoreData({ id: storeId, name: adjustingStoreWallet.name } as any, updatedPayload);
      setAllStoresData(prev => ({ ...prev, [storeId]: updatedPayload }));
      const targetName = adjustingStoreWallet.name;
      setAdjustingStoreWallet(null);
      setAdjustmentDetails({ amount: '', type: 'deposit', note: '' });
      showToast(`تمت تسوية محفظة "${targetName}" بنجاح. الرصيد الحالي: ${newBalance.toLocaleString('ar-EG')} ج.م`);
    } catch (err: any) {
      setAdjustError(`فشل حفظ التعديل السحابي: ${err.message}`);
    } finally {
      setIsSavingWallet(false);
    }
  };

  const handleAdminCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCreateStoreError('');
    if (!adminNewStore.name.trim() || !adminNewStore.url.trim() || !adminNewStore.ownerPhone) {
      setAdminCreateStoreError('يرجى تعبئة اسم المتجر والرابط واختيار التاجر المالك.');
      return;
    }

    const selectedOwner = users.find(u => u.phone === adminNewStore.ownerPhone);
    if (!selectedOwner) {
      setAdminCreateStoreError('المالك المحدد غير موجود.');
      return;
    }

    setIsCreatingAdminStore(true);
    const newStoreId = `store-${Math.floor(100000 + Math.random() * 900000)}`;
    const cleanSlug = sanitizeStoreSubdomain(adminNewStore.url, newStoreId);
    const newStoreObj: Store = {
      id: newStoreId,
      name: adminNewStore.name.trim(),
      url: `${cleanSlug}.abdomedi.com`,
      subdomain: cleanSlug,
      creationDate: new Date().toISOString(),
      specialization: adminNewStore.specialization,
      language: 'ar',
      currency: 'ج.م'
    };

    const updatedOwner: User = {
      ...selectedOwner,
      stores: [...(selectedOwner.stores || []), newStoreObj]
    };
    const updatedUsers = users.map(u => u.phone === selectedOwner.phone ? updatedOwner : u);

    const newStorePayload: StoreData = {
      orders: [],
      settings: {
        ...INITIAL_SETTINGS,
        storeName: newStoreObj.name,
        products: []
      },
      wallet: { balance: 0, transactions: [], withdrawRequests: [] },
      cart: [],
      customers: []
    };

    try {
      await db.saveStoreData(newStoreObj, newStorePayload);
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      setUsers(updatedUsers);
      setAllStoresData(prev => ({ ...prev, [newStoreId]: newStorePayload }));
      setShowAdminCreateStoreModal(false);
      setAdminNewStore({ name: '', url: '', ownerPhone: '', specialization: 'عام' });
      showToast(`تم تأسيس متجر "${newStoreObj.name}" وربطه بالتاجر ${selectedOwner.fullName} بنجاح ✅`);
    } catch (err: any) {
      setAdminCreateStoreError(`تعذر إنشاء المتجر: ${err.message}`);
    } finally {
      setIsCreatingAdminStore(false);
    }
  };
  
  const handleInvite = (storeId: string, email: string) => {
    const userToInvite = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!userToInvite) {
      throw new Error('لم يتم العثور على مستخدم بهذا البريد الإلكتروني.');
    }
    const storeData = allStoresData[storeId];
    if (!storeData || storeData.settings?.employees?.some(e => e.id === userToInvite.phone)) {
      throw new Error('هذا المستخدم هو بالفعل عضو في هذا المتجر.');
    }
    const newEmployee: Employee = { id: userToInvite.phone, name: userToInvite.fullName, email: userToInvite.email, permissions: [], status: 'invited' };
    const updatedStoreData: StoreData = {
      ...storeData,
      settings: { ...storeData.settings, employees: [...(storeData.settings?.employees || []), newEmployee] }
    };
    setAllStoresData(prevData => ({
        ...prevData,
        [storeId]: updatedStoreData
    }));
    db.saveStoreData({ id: storeId, name: storeData.settings?.storeName || storeId } as any, updatedStoreData).catch(console.warn);
    setStoreToInvite(null);
    showToast(`تم إرسال الدعوة إلى ${email} بنجاح.`);
  };

  const { greeting, period } = getGreetingByTime(currentUser?.fullName);

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 space-y-8 select-none" dir="rtl">
        
        {/* Floating Notification Toast */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 text-sm font-bold backdrop-blur-md"
            >
              <span className="p-1 rounded-full bg-emerald-500/20 text-emerald-400">
                <Check size={16} />
              </span>
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 🌟 Festive Welcome & Post-OTP Verification Celebration Banner */}
        <AnimatePresence>
          {showWelcomeBanner && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900/90 via-teal-900/80 to-slate-900/90 border border-emerald-500/50 p-6 md:p-8 text-white shadow-2xl backdrop-blur-xl"
            >
              {/* Animated Background Highlights */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black shadow-xs">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span>تم التحقق وتأكيد الرمز بنجاح (2FA Verified)</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-white/90 text-xs font-bold">
                      <Sparkles size={13} className="text-amber-400" />
                      <span>جلسة عمل موثقة ومحمية</span>
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                    🎉 أهلاً بعودتك يا {currentUser?.fullName || 'عزيزنا التاجر'}! مساحة عملك جاهزة
                  </h2>
                  <p className="text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
                    تم توثيق دخولك الأمني بنجاح. أنت الآن في <strong>شاشة تغيير وإدارة المتاجر والمشاريع</strong>، اختر المتجر الذي ترغب في متابعة مبيعاته وإدارته اليوم، أو أضف مشروعاً جديداً بكل سهولة.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0 w-full md:w-auto justify-end">
                  {defaultPinnedStore && (
                    <button
                      type="button"
                      onClick={() => handleSelectStore(defaultPinnedStore.id)}
                      className="w-full sm:w-auto bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black px-6 py-3 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer active:scale-95"
                    >
                      <Zap size={16} className="fill-current" />
                      <span>دخول متجرك الافتراضي ({defaultPinnedStore.name})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowWelcomeBanner(false)}
                    className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                    title="إخفاء التنبيه"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Welcome Hero Banner & Command Stage */}
        <motion.div 
          variants={itemVariants} 
          initial="hidden"
          animate="visible"
          className="relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm p-6 md:p-8 space-y-6"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

          {/* Top Title & Welcome Greeting */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 dark:border-slate-800/80 pb-6 relative z-10">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3">
                <span className="p-3 rounded-2xl bg-[#00c48c]/10 text-[#00c48c] border border-[#00c48c]/20 shadow-xs">
                  <Compass size={24} />
                </span>
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white leading-tight">
                    {greeting}
                  </h1>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {period}
                  </span>
                </div>
              </div>
              <p className="text-xs md:text-sm font-semibold text-slate-500 dark:text-slate-400 pr-12 pt-1">
                مركز التحكم في متاجرك: تصفح إحصائيات كل متجر، تنقّل بسلاسة بين المشاريع، أو ثبّت متجرك الأساسي للوصول المباشر.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              {isAdminView && (
                <>
                  <button
                    type="button"
                    onClick={() => syncPlatformData(true)}
                    disabled={isSyncingPlatform}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold px-4 py-3.5 rounded-2xl shadow-xs transition-all flex items-center gap-2 text-xs md:text-sm cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw size={16} className={isSyncingPlatform ? 'animate-spin text-indigo-500' : 'text-indigo-500'} />
                    <span>{isSyncingPlatform ? 'جاري المزامنة...' : 'تحديث المنظومة'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAdminCreateStoreError(''); setShowAdminCreateStoreModal(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 py-3.5 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-xs md:text-sm active:scale-95 cursor-pointer"
                  >
                    <Plus size={18} />
                    <span>تأسيس متجر لتاجر</span>
                  </button>
                </>
              )}
              <Link 
                to="/create-store" 
                className="bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black px-6 py-3.5 rounded-2xl shadow-lg shadow-[#00c48c]/20 hover:shadow-[#00c48c]/30 transition-all flex items-center gap-2 text-sm active:scale-95 cursor-pointer"
              >
                <Plus size={18} />
                <span>أنشئ متجراً جديداً</span>
              </Link>
            </div>
          </div>

          {/* System-Wide Admin Control Center Hub */}
          {isAdminView && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white border border-indigo-500/30 shadow-xl space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                    <ShieldAlert size={22} />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-black text-white flex items-center gap-2 flex-wrap">
                      مركز التحكم الشامل في المنظومة
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        SUPER ADMIN
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300 mt-0.5">
                      تحكم فوري في التجار، أرصدة المحافظ، الطلبات المالية، العمولات، وصيانة البيانات من مكان واحد.
                    </p>
                  </div>
                </div>

                {/* Live System Financial & User KPIs */}
                <div className="grid grid-cols-3 gap-2.5 shrink-0">
                  <div className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-right">
                    <span className="text-[10px] text-slate-300 font-bold block">التجار المسجلون</span>
                    <span className="text-sm md:text-base font-black tabular-nums text-white">
                      {adminSystemMetrics.totalUsersCount}
                      <span className="text-[10px] font-bold text-emerald-400 mr-1">({adminSystemMetrics.activeMerchantsCount} نشط)</span>
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-right">
                    <span className="text-[10px] text-slate-300 font-bold block">أرصدة محافظ المنصة</span>
                    <span className="text-sm md:text-base font-black tabular-nums text-emerald-400">
                      {adminSystemMetrics.totalWalletsBalance.toLocaleString('ar-EG')} <span className="text-[10px]">ج.م</span>
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-right">
                    <span className="text-[10px] text-slate-300 font-bold block">طلبات مالية معلقة</span>
                    <span className={`text-sm md:text-base font-black tabular-nums ${adminSystemMetrics.pendingFinancialCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                      {adminSystemMetrics.pendingFinancialCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Direct Quick Control Shortcuts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 border-t border-white/10">
                <Link
                  to="/saeed?tab=exclusive_controls"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/50 text-xs font-black text-emerald-200 transition-all shadow-sm"
                >
                  <ShieldCheck size={15} className="text-emerald-300 shrink-0" />
                  <span>الصلاحيات الحصرية والرقابة</span>
                </Link>

                <Link
                  to="/saeed?tab=dashboard"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-xs font-bold text-white transition-all"
                >
                  <LayoutDashboard size={15} className="text-sky-400 shrink-0" />
                  <span>التحليلات العامة</span>
                </Link>

                <Link
                  to="/saeed?tab=users"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-xs font-bold text-white transition-all"
                >
                  <Users size={15} className="text-indigo-400 shrink-0" />
                  <span>التجار والمستخدمين</span>
                </Link>

                <Link
                  to="/saeed?tab=financial"
                  className="relative flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-xs font-bold text-white transition-all"
                >
                  <TrendingUp size={15} className="text-emerald-400 shrink-0" />
                  <span>الطلبات المالية</span>
                  {adminSystemMetrics.pendingFinancialCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black tabular-nums">
                      {adminSystemMetrics.pendingFinancialCount}
                    </span>
                  )}
                </Link>

                <Link
                  to="/saeed?tab=fee_settings"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-xs font-bold text-white transition-all"
                >
                  <SettingsIcon size={15} className="text-amber-400 shrink-0" />
                  <span>الرسوم والعمولات</span>
                </Link>

                <Link
                  to="/saeed?tab=support"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-xs font-black text-amber-200 transition-all"
                >
                  <Wrench size={15} className="text-amber-300 shrink-0" />
                  <span>الدعم الفني وحل المشاكل</span>
                </Link>

                <Link
                  to="/saeed?tab=user_migration"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-xs font-bold text-white transition-all"
                >
                  <ShieldCheck size={15} className="text-teal-400 shrink-0" />
                  <span>ترحيل المستخدمين</span>
                </Link>

                <Link
                  to="/saeed?tab=danger_zone"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-200 transition-all"
                >
                  <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                  <span>صيانة وإبادة البيانات</span>
                </Link>
              </div>
            </div>
          )}

          {/* Pinned Default Store Spotlight Bar */}
          {defaultPinnedStore ? (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 border border-emerald-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                  <Pin size={22} className="transform -rotate-45 fill-current" />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md">
                      المتجر الافتراضي المثبت 📌
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-base truncate">
                      {defaultPinnedStore.name}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono dir-ltr truncate text-right">
                    {formatDisplayDomain(defaultPinnedStore)}
                  </p>
                </div>
              </div>

              {/* Action Buttons for Default Store */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end shrink-0 pt-2 md:pt-0">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors">
                  <input 
                    type="checkbox"
                    checked={!!currentUser?.autoLaunchDefaultStore}
                    onChange={(e) => handleToggleAutoLaunch(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer accent-emerald-500"
                  />
                  <span>دخول تلقائي عند تسجيل الدخول مستقبلاً</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleSelectStore(defaultPinnedStore.id)}
                  className="bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-sm text-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Zap size={15} className="fill-current" />
                  <span>دخول فوري للمتجر ←</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Pin size={15} className="text-amber-500 shrink-0 transform -rotate-45" />
                <span>
                  <strong>نصيحة سريعة:</strong> يمكنك تثبيت متجرك الأساسي عبر النقر على زر <strong>(تثبيت كافتراضي 📌)</strong> داخل كارت المتجر للوصول السريع دائماً.
                </span>
              </div>
            </div>
          )}

          {/* Quick Metrics Bar across entire Portfolio (4 Stats) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            {/* 1. إجمالي المتاجر */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-400 block mb-1">إجمالي المتاجر</span>
                <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{portfolioMetrics.storesCount}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200/60 dark:border-teal-900/40 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <StoreIconLucide size={20} />
              </div>
            </div>

            {/* 2. إجمالي المنتجات المعروضة */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-400 block mb-1">إجمالي المنتجات</span>
                <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{portfolioMetrics.totalProducts}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Package size={20} />
              </div>
            </div>

            {/* 3. إجمالي الطلبات */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-400 block mb-1">إجمالي الطلبات</span>
                <span className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">{portfolioMetrics.totalOrders}</span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShoppingBag size={20} />
              </div>
            </div>

            {/* 4. إجمالي الإيرادات */}
            <div className="p-4 rounded-2xl bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-400 block mb-1">إجمالي المبيعات</span>
                <span className="text-base md:text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {(portfolioMetrics?.totalRevenue ?? 0).toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
                </span>
              </div>
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          {/* Search, Status & Specialty Filters */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input 
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المتجر أو الرابط أو النشاط..."
                className="w-full pr-11 pl-4 py-3 bg-[#f8fafc] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs md:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#00c48c] transition-all text-slate-800 dark:text-white"
              />
            </div>

            {/* Filter by Specialization */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
              <select 
                value={specializationFilter} 
                onChange={e => setSpecializationFilter(e.target.value)} 
                className="appearance-none w-full pr-11 pl-10 py-3 bg-[#f8fafc] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs md:text-sm font-bold outline-none focus:ring-2 focus:ring-[#00c48c] cursor-pointer text-slate-800 dark:text-white"
              >
                <option value="all">جميع التخصصات</option>
                {allSpecializations.map(spec => <option key={spec} value={spec}>{spec}</option>)}
              </select>
              <ChevronsUpDown size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
            </div>

            {/* Filter by Pinned / All */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                الكل ({portfolioMetrics.storesCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pinned')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'pinned'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Pin size={12} className="transform -rotate-45" />
                <span>المثبت</span>
              </button>
            </div>
          </div>
        </motion.div>
        
        {/* Stores Grid Content */}
        <div className="space-y-6">
            {isAdminView ? (
                <div>
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                      <ShieldCheck size={22} className="text-indigo-500" />
                      <span>كافة متاجر المنصة ({filteredAdminStores.length})</span>
                    </h2>
                    {filteredAdminStores.length > 0 ? (
                        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredAdminStores.map(({ store, ownerName, owner }) => 
                                <StoreCard 
                                  key={store.id} 
                                  store={store} 
                                  ownerName={ownerName}
                                  owner={owner}
                                  isAdminView={true}
                                  storeData={allStoresData[store.id]}
                                  isDefaultPinned={currentUser?.defaultStoreId === store.id}
                                  onSelect={handleSelectStore} 
                                  onPreview={handlePreviewStore} 
                                  onInvite={setStoreToInvite} 
                                  onSettings={setStoreToEdit} 
                                  onTogglePin={handleTogglePinStore}
                                  onImpersonate={onImpersonate}
                                  onAdjustWallet={(s) => {
                                    setAdjustError('');
                                    setAdjustmentDetails({ amount: '', type: 'deposit', note: '' });
                                    setAdjustingStoreWallet({ id: s.id, name: s.name });
                                  }}
                                  onMaintenance={(s) => navigate(`/saeed?tab=danger_zone&storeId=${s.id}`)}
                                  onSupport={(s) => navigate(`/saeed?tab=support&storeId=${s.id}`)}
                                  onToggleOwnerBan={handleToggleOwnerBan}
                                  onToggleStoreBan={handleToggleStoreBan}
                                />
                            )}
                            <CreateNewStoreCard />
                        </motion.div>
                    ) : (
                        <EmptyStoresState text="لم يتم العثور على نتائج تطابق البحث الخاص بك." />
                    )}
                </div>
            ) : (
                <>
                    <div>
                        <div className="flex items-center justify-between mb-6">
                          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
                            <span className="p-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <StoreIconLucide size={22} />
                            </span>
                            <span>متاجري ومشاريعي ({filteredOwnedStores.length})</span>
                          </h2>
                        </div>

                        {filteredOwnedStores.length > 0 ? (
                            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredOwnedStores.map(store => 
                                    <StoreCard 
                                      key={store.id} 
                                      store={store} 
                                      storeData={allStoresData[store.id]}
                                      isDefaultPinned={currentUser?.defaultStoreId === store.id}
                                      onSelect={handleSelectStore} 
                                      onPreview={handlePreviewStore} 
                                      onInvite={setStoreToInvite} 
                                      onSettings={setStoreToEdit} 
                                      onTogglePin={handleTogglePinStore}
                                    />
                                )}
                                <CreateNewStoreCard />
                            </motion.div>
                        ) : (
                            <EmptyStoresState text="لا توجد متاجر تطابق بحثك الحالي." />
                        )}
                    </div>

                    {collaboratingStores.length > 0 && (
                        <div className="pt-6">
                            <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                              <Users size={22} className="text-purple-500" />
                              <span>متاجر أعمل بها كموظف/متعاون ({filteredCollaboratingStores.length})</span>
                            </h2>
                            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCollaboratingStores.map(store => 
                                    <StoreCard 
                                      key={store.id} 
                                      store={store} 
                                      storeData={allStoresData[store.id]}
                                      isDefaultPinned={currentUser?.defaultStoreId === store.id}
                                      onSelect={handleSelectStore} 
                                      onPreview={handlePreviewStore} 
                                      onInvite={setStoreToInvite} 
                                      onSettings={setStoreToEdit} 
                                      onTogglePin={handleTogglePinStore}
                                    />
                                )}
                            </motion.div>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
      
      {/* Modals */}
      {storeToEdit && (
        <StoreSettingsModal
          store={storeToEdit}
          isNameLocked={isStoreVerified(allStoresData[storeToEdit.id]?.settings) && !currentUser?.isAdmin}
          onClose={() => setStoreToEdit(null)}
          onSave={handleSaveSettings}
        />
      )}
      {storeToInvite && <InviteEmployeeModal store={storeToInvite} onClose={() => setStoreToInvite(null)} onInvite={handleInvite} users={users} />}

      {/* Admin Inline Wallet Adjustment Modal */}
      {adjustingStoreWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setAdjustingStoreWallet(null)} dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight size={18} className="text-indigo-600" />
                <span>تعديل رصيد محفظة: {adjustingStoreWallet.name}</span>
              </h3>
              <button onClick={() => setAdjustingStoreWallet(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><XCircle size={20} /></button>
            </div>

            <form onSubmit={handleAdjustStoreBalance} className="space-y-4 text-xs">
              <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between">
                <span className="font-bold text-slate-600 dark:text-slate-300">الرصيد الحالي بالمحفظة:</span>
                <span className="font-black text-sm tabular-nums text-indigo-700 dark:text-indigo-300">
                  {(allStoresData[adjustingStoreWallet.id]?.wallet?.balance || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustmentDetails(p => ({ ...p, type: 'deposit' }))}
                  className={`py-2 rounded-lg font-black transition-all cursor-pointer ${adjustmentDetails.type === 'deposit' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
                >
                  إضافة / شحن (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentDetails(p => ({ ...p, type: 'withdraw' }))}
                  className={`py-2 rounded-lg font-black transition-all cursor-pointer ${adjustmentDetails.type === 'withdraw' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500'}`}
                >
                  خصم / تسوية (-)
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">المبلغ (ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={adjustmentDetails.amount}
                  onChange={e => setAdjustmentDetails(p => ({ ...p, amount: e.target.value }))}
                  placeholder="مثال: 500"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">سبب التسوية / ملاحظة</label>
                <input
                  type="text"
                  value={adjustmentDetails.note}
                  onChange={e => setAdjustmentDetails(p => ({ ...p, note: e.target.value }))}
                  placeholder="مثال: شحن رصيد شحن أو تسوية مالية"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {adjustError && (
                <p className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                  {adjustError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingWallet}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all cursor-pointer disabled:opacity-60"
                >
                  {isSavingWallet ? 'جاري الحفظ...' : 'اعتماد التعديل'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustingStoreWallet(null)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Inline Create Store For Merchant Modal */}
      {showAdminCreateStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setShowAdminCreateStoreModal(false)} dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <StoreIconLucide size={18} className="text-emerald-500" />
                <span>تأسيس متجر جديد لتاجر بالمنظومة</span>
              </h3>
              <button onClick={() => setShowAdminCreateStoreModal(false)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><XCircle size={20} /></button>
            </div>

            <form onSubmit={handleAdminCreateStore} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">اسم المتجر</label>
                <input
                  type="text"
                  required
                  value={adminNewStore.name}
                  onChange={e => setAdminNewStore(p => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: متجر النخبة"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">النطاق أو الرابط (Subdomain / URL)</label>
                <input
                  type="text"
                  required
                  value={adminNewStore.url}
                  onChange={e => setAdminNewStore(p => ({ ...p, url: e.target.value }))}
                  placeholder="elite-store"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-mono font-bold dir-ltr text-right outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">التخصص</label>
                <select
                  value={adminNewStore.specialization}
                  onChange={e => setAdminNewStore(p => ({ ...p, specialization: e.target.value }))}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="عام">نشاط عام / متعدد الأقسام</option>
                  <option value="ملابس">ملابس وأزياء</option>
                  <option value="أحذية">أحذية وحقائب</option>
                  <option value="إلكترونيات">إلكترونيات ذكية</option>
                  <option value="مستحضرات تجميل">مستحضرات تجميل وعناية بالبشرة</option>
                  <option value="أدوات منزلية">أدوات منزلية</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">اختر التاجر المالك للمتجر</label>
                <select
                  required
                  value={adminNewStore.ownerPhone}
                  onChange={e => setAdminNewStore(p => ({ ...p, ownerPhone: e.target.value }))}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- اختر مالك المتجر --</option>
                  {users.map(u => (
                    <option key={u.phone} value={u.phone}>
                      {u.fullName} ({u.phone}){u.isAdmin ? ' [مشرف]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {adminCreateStoreError && (
                <p className="text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                  {adminCreateStoreError}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isCreatingAdminStore}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black transition-all cursor-pointer disabled:opacity-60"
                >
                  {isCreatingAdminStore ? 'جاري التأسيس...' : 'إنشاء وربط المتجر'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminCreateStoreModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const StoreCard: React.FC<{ 
  store: Store; 
  ownerName?: string;
  owner?: User;
  isAdminView?: boolean;
  storeData?: StoreData;
  isDefaultPinned: boolean;
  onSelect: (id: string) => void; 
  onPreview: (id: string) => void; 
  onInvite: (store: Store) => void; 
  onSettings: (store: Store) => void; 
  onTogglePin: (id: string, name: string) => void;
  onImpersonate?: (user: User, targetStoreId?: string) => void;
  onAdjustWallet?: (store: Store) => void;
  onMaintenance?: (store: Store) => void;
  onSupport?: (store: Store) => void;
  onToggleOwnerBan?: (owner: User) => void;
  onToggleStoreBan?: (owner: User, store: Store) => void;
}> = ({
  store,
  ownerName,
  owner,
  isAdminView,
  storeData,
  isDefaultPinned,
  onSelect,
  onPreview,
  onInvite,
  onSettings,
  onTogglePin,
  onImpersonate,
  onAdjustWallet,
  onMaintenance,
  onSupport,
  onToggleOwnerBan,
  onToggleStoreBan
}) => {
  const [copied, setCopied] = useState(false);
  const formattedDate = formatArabicDate(store.creationDate);
  const displayUrl = formatDisplayDomain(store);

  const cleanSub = sanitizeStoreSubdomain(store.subdomain, store.id);
  const isInternal = typeof window !== 'undefined' && (
    window.location.hostname.includes('run.app') ||
    window.location.hostname.includes('pages.dev') ||
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('127.0.0.1')
  );
  const linkUrl = store.customDomain 
    ? (store.customDomain.startsWith('http') ? store.customDomain : `https://${store.customDomain}`)
    : (isInternal ? `${window.location.origin}/s/${cleanSub || store.id}` : `https://abdomedi.com/s/${cleanSub || store.id}`);

  const copyStoreUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const productCount = storeData?.settings?.products?.length || 0;
  const orders = storeData?.orders || [];
  const orderCount = orders.length;
  const revenue = orders.filter(isCollectedOrder).reduce((sum, o) => {
    const val = getOrderProductSales(o);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const walletBalance = Number(storeData?.wallet?.balance || 0);

  return (
    <motion.div 
      variants={itemVariants} 
      className={`bg-white dark:bg-slate-900 rounded-3xl border transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 flex flex-col group overflow-hidden relative ${
        isDefaultPinned 
          ? 'border-emerald-500/80 dark:border-emerald-500/70 shadow-lg shadow-emerald-500/10 ring-2 ring-emerald-500/30' 
          : 'border-slate-200/80 dark:border-slate-800 shadow-sm'
      }`}
    >
      {/* Decorative Top Accent Banner Gradient */}
      <div className={`h-2.5 w-full ${
        isDefaultPinned 
          ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400' 
          : 'bg-gradient-to-r from-[#00c48c] via-teal-400 to-indigo-600'
      }`} />
      
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        {/* Top Badges & Pin Action */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Status & Category */}
          <div className="flex items-center gap-2 flex-wrap">
            {store.isBanned || owner?.isBanned ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                <Lock size={11} />
                <span>{owner?.isBanned ? 'حساب المالك محظور' : 'متجر موقوف إدارياً'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800/80">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>نشط أونلاين</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 px-2.5 py-1 rounded-full">
              <ShoppingCart size={12}/> 
              <span>{store.specialization || 'أخرى'}</span>
            </span>
          </div>

          {/* Pin as default button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(store.id, store.name);
            }}
            title={isDefaultPinned ? "المتجر الافتراضي المثبت (انقر للتعطيل)" : "تثبيت كمتجر افتراضي للمنصة"}
            className={`inline-flex items-center gap-1.5 text-xs font-black px-3 py-1 rounded-full transition-all duration-200 cursor-pointer ${
              isDefaultPinned
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-xs'
                : 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 bg-slate-100/80 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-slate-200 dark:border-slate-700 hover:border-amber-300'
            }`}
          >
            <Pin size={13} className={`transform -rotate-45 transition-transform ${isDefaultPinned ? 'fill-current scale-110' : 'group-hover:rotate-0'}`} />
            <span>{isDefaultPinned ? 'المتجر الافتراضي' : 'تثبيت كافتراضي'}</span>
          </button>
        </div>

        {/* Title and Owner */}
        <div className="text-right pt-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-snug line-clamp-1">
              {store.name}
            </h3>
            <VerifiedStoreBadge verified={isStoreVerified(storeData?.settings)} tier={getStoreVerificationTier(storeData?.settings)} size="md" />
            {isDefaultPinned && (
              <span className="p-1 rounded-lg bg-amber-500/10 text-amber-500" title="المتجر المفضل المثبت">
                <Star size={16} className="fill-current" />
              </span>
            )}
          </div>
          {ownerName && (
            <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
              <p className="text-xs font-bold text-slate-400 flex items-center justify-start gap-1">
                <ShieldCheck size={13} className="text-indigo-400" />
                المالك: <span className="text-slate-600 dark:text-slate-300">{ownerName}</span>
                {owner?.phone && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-400 mr-1" dir="ltr">({owner.phone})</span>
                )}
              </p>
              {owner?.isBanned && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50">
                  حساب محظور
                </span>
              )}
            </div>
          )}
        </div>

        {/* Store Micro-Stats (Products, Orders, Revenue, + Wallet for Admin) */}
        <div className={`grid ${isAdminView ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-2 pt-1`}>
          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1 mb-0.5">
              <Package size={12} className="text-teal-500" /> المنتجات
            </span>
            <span className="font-black text-sm tabular-nums text-slate-800 dark:text-slate-100">{productCount}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1 mb-0.5">
              <ShoppingBag size={12} className="text-indigo-500" /> الطلبات
            </span>
            <span className="font-black text-sm tabular-nums text-slate-800 dark:text-slate-100">{orderCount}</span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1 mb-0.5">
              <DollarSign size={12} className="text-emerald-500" /> المبيعات
            </span>
            <span className="font-black text-xs tabular-nums text-emerald-600 dark:text-emerald-400 truncate max-w-full">
              {(revenue ?? 0).toLocaleString('ar-EG')} ج.م
            </span>
          </div>

          {isAdminView && (
            <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] text-indigo-600 dark:text-indigo-300 font-bold flex items-center gap-1 mb-0.5">
                <Wallet size={12} /> المحفظة
              </span>
              <span className={`font-black text-xs tabular-nums truncate max-w-full ${walletBalance >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-400'}`}>
                {walletBalance.toLocaleString('ar-EG')} ج.م
              </span>
            </div>
          )}
        </div>

        {/* Domain Link Box */}
        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-between gap-2">
          {/* Action buttons on the left */}
          <div className="flex items-center gap-1 shrink-0">
            <a 
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="زيارة المتجر المباشر"
              className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              <ExternalLink size={14} />
            </a>
            <button 
              type="button" 
              onClick={copyStoreUrl}
              title="نسخ رابط المتجر"
              className="p-1.5 rounded-xl text-slate-400 hover:text-teal-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Domain name on the right */}
          <div className="flex items-center gap-2 min-w-0 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span className="truncate font-mono dir-ltr">{displayUrl}</span>
            <Globe size={14} className="text-teal-500 shrink-0" />
          </div>
        </div>

        {/* Admin Quick Controls Row inside Card */}
        {isAdminView && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
            {onImpersonate && owner && !owner.isAdmin && (
              <button
                type="button"
                onClick={() => onImpersonate(owner, store.id)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800/50 text-[11px] font-black transition-all cursor-pointer"
                title="الدخول لحساب التاجر وإدارة هذا المتجر مباشرة"
              >
                <LogIn size={12} />
                <span>دخول كتاجر</span>
              </button>
            )}
            {onSupport && (
              <button
                type="button"
                onClick={() => onSupport(store)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800/50 text-[11px] font-black transition-all cursor-pointer"
                title="تشخيص المتجر وحل مشاكل العميل"
              >
                <Wrench size={12} />
                <span>دعم وحل مشاكل</span>
              </button>
            )}
            {onAdjustWallet && (
              <button
                type="button"
                onClick={() => onAdjustWallet(store)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/50 text-[11px] font-black transition-all cursor-pointer"
                title="تعديل رصيد المحفظة"
              >
                <ArrowLeftRight size={12} />
                <span>تعديل الرصيد</span>
              </button>
            )}
            {onToggleOwnerBan && owner && !owner.isAdmin && (
              <button
                type="button"
                onClick={() => onToggleOwnerBan(owner)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                  owner.isBanned
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
                title={owner.isBanned ? 'فك حظر المالك' : 'حظر المالك بالكامل'}
              >
                {owner.isBanned ? <Unlock size={12} /> : <Lock size={12} />}
                <span>{owner.isBanned ? 'فك حظر المالك' : 'حظر المالك'}</span>
              </button>
            )}
            {onToggleStoreBan && owner && (
              <button
                type="button"
                onClick={() => onToggleStoreBan(owner, store)}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl border text-[11px] font-black transition-all cursor-pointer ${
                  store.isBanned
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/50'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50'
                }`}
                title={store.isBanned ? 'إعادة تفعيل المتجر' : 'حظر وإيقاف هذا المتجر فقط'}
              >
                {store.isBanned ? <Unlock size={12} /> : <Lock size={12} />}
                <span>{store.isBanned ? 'تفعيل المتجر' : 'حظر المتجر'}</span>
              </button>
            )}
            {onMaintenance && (
              <button
                type="button"
                onClick={() => onMaintenance(store)}
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800/50 text-[11px] font-black transition-all cursor-pointer"
                title="صيانة وتصفير أو حذف المتجر"
              >
                <Trash2 size={12} />
                <span>صيانة/حذف</span>
              </button>
            )}
          </div>
        )}

        {/* Creation Date */}
        <div className="text-center pt-0.5 text-slate-400 text-xs font-semibold">
          <span>تم الإنشاء: {formattedDate}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-3 bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200/80 dark:border-slate-800 rounded-b-3xl flex items-center justify-between gap-3">
        {/* Secondary Quick Action Icons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onPreview(store.id)} 
            className="p-2 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer" 
            title="معاينة المتجر المباشرة"
          >
            <Eye size={16} />
          </button>

          <button 
            onClick={() => onInvite(store)} 
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer" 
            title="إدارة ودعوة الموظفين"
          >
            <UserPlus size={16}/>
          </button>

          <button 
            onClick={() => onSettings(store)} 
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 cursor-pointer" 
            title="إعدادات وتعديل المتجر"
          >
            <SettingsIcon size={16}/>
          </button>
        </div>

        {/* Primary CTA Button: دخول وإدارة المتجر */}
        <button 
          onClick={() => onSelect(store.id)} 
          className="flex-1 py-2.5 px-4 font-black text-xs md:text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 hover:shadow-md"
        >
          <span>دخول المتجر</span>
          <ArrowLeft size={16}/>
        </button>
      </div>
    </motion.div>
  );
};

// Quick Create New Store Action Card in Grid
const CreateNewStoreCard: React.FC = () => (
  <motion.div
    variants={itemVariants}
    className="h-full min-h-[360px] rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition-all duration-300 bg-slate-50/50 dark:bg-slate-900/40 p-6 flex flex-col items-center justify-center text-center space-y-4 group hover:shadow-lg"
  >
    <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
      <Plus size={32} />
    </div>
    <div className="space-y-1">
      <h3 className="text-lg font-black text-slate-900 dark:text-white">
        إضافة مشروع / متجر جديد
      </h3>
      <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
        أطلق مشروعك التجاري التالي واربطه فوراً بنظام الأوردرات والشحن.
      </p>
    </div>
    <Link
      to="/create-store"
      className="mt-2 bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
    >
      <Plus size={16} />
      <span>أنشئ متجرك الآن</span>
    </Link>
  </motion.div>
);

const EmptyStoresState: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
    <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
      <Inbox size={36} />
    </div>
    <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">{text}</h3>
    <p className="text-xs text-slate-400 max-w-sm">يمكنك إضافة متجر جديد أو تغيير التصفية والبحث للوصول للمتجر المطلوب.</p>
    <Link 
      to="/create-store" 
      className="mt-3 inline-flex items-center gap-2 bg-[#00c48c] text-slate-950 px-5 py-2.5 rounded-xl font-black text-xs hover:bg-[#00b07d] transition-all cursor-pointer"
    >
      <Plus size={16}/> أنشئ متجرك الآن
    </Link>
  </div>
);

const StoreSettingsModal: React.FC<{ store: Store, isNameLocked?: boolean, onClose: () => void, onSave: (s: Store) => void }> = ({ store, isNameLocked = false, onClose, onSave }) => {
    const [formData, setFormData] = useState(store);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
    };
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} dir="rtl">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 md:p-8 shadow-2xl animate-in zoom-in-95 duration-200 space-y-6" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <SettingsIcon size={20} className="text-indigo-500" /> 
                      <span>إعدادات متجر: {store.name}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-xl text-slate-400 hover:text-rose-500 transition-colors cursor-pointer">
                      <XCircle size={22}/>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <StoreIconLucide size={16} className="text-teal-500"/> اسم المتجر
                          {isNameLocked && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              <Lock size={10} />
                              محمي بالتوثيق
                            </span>
                          )}
                        </label>
                        <input 
                          type="text" 
                          value={formData.name}
                          disabled={isNameLocked}
                          onChange={e => setFormData(p => ({...p, name: e.target.value}))} 
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#00c48c] outline-none text-slate-900 dark:text-white disabled:opacity-70 disabled:cursor-not-allowed"
                        />
                        {isNameLocked && (
                          <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mt-1.5">
                            تم توثيق المتجر بالشارة الخضراء بهذا الاسم التجاري — لا يمكن تغييره إلا من خلال مراجعة إدارة المنصة.
                          </p>
                        )}
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <Tag size={16} className="text-indigo-500"/> تخصص المتجر
                        </label>
                         <select 
                          value={formData.specialization} 
                          onChange={e => setFormData(p => ({...p, specialization: e.target.value}))} 
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-[#00c48c] outline-none text-slate-900 dark:text-white cursor-pointer"
                         >
                            <option>الصحة والجمال</option>
                            <option>ملابس وموضة</option>
                            <option>إلكترونيات وأجهزة</option>
                            <option>أدوات منزلية</option>
                            <option>عدد وأدوات يدوية</option>
                            <option>أخرى</option>
                         </select>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <Globe size={16} className="text-emerald-500"/> النطاق الفرعي (Subdomain)
                        </label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={formData.subdomain || ''} 
                            onChange={e => setFormData(p => ({...p, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')}))} 
                            placeholder="my-store"
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#00c48c] outline-none dir-ltr text-right text-slate-900 dark:text-white"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">يُستخدم كرابط افتراضي سريع ومجاني للمتجر.</p>
                     </div>

                     <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 block flex items-center gap-1.5">
                          <Globe size={16} className="text-purple-500"/> النطاق المخصص (Custom Domain)
                        </label>
                        <input 
                          type="text" 
                          value={formData.customDomain || ''} 
                          onChange={e => setFormData(p => ({...p, customDomain: e.target.value}))} 
                          placeholder="مثال: store.com"
                          className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#00c48c] outline-none dir-ltr text-right text-slate-900 dark:text-white"
                        />
                     </div>

                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer">إلغاء</button>
                        <button type="submit" className="px-6 py-2.5 bg-[#00c48c] text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 hover:bg-[#00b07d] transition-colors shadow-sm cursor-pointer"><Save size={16}/> حفظ التغييرات</button>
                     </div>
                </form>
            </div>
        </div>
    );
};

const InviteEmployeeModal: React.FC<{ store: Store, onClose: () => void, onInvite: (storeId: string, email: string) => void, users: User[] }> = ({ store, onClose, onInvite }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        try {
            onInvite(store.id, email);
        } catch(err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md" onClick={onClose} dir="rtl">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <UserPlus size={20} className="text-purple-500" />
                    <span>دعوة موظف لـ {store.name}</span>
                  </h3>
                  <button onClick={onClose} className="text-slate-400 hover:text-rose-500 cursor-pointer"><XCircle size={20}/></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                       <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                         البريد الإلكتروني للموظف المسجل
                       </label>
                       <input 
                        type="email" 
                        value={email} 
                        onChange={e => { setEmail(e.target.value); setError(''); }} 
                        placeholder="example@gmail.com" 
                        required 
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#00c48c] text-slate-900 dark:text-white"
                       />
                     </div>

                     {error && (
                       <p className="text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/50 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800">
                         {error}
                       </p>
                     )}

                     <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                      <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer">إلغاء</button>
                      <button type="submit" className="flex items-center gap-2 bg-[#00c48c] hover:bg-[#00b07d] text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 cursor-pointer">
                        <Send size={15}/> إرسال دعوة
                      </button>
                     </div>
                </form>
            </div>
        </div>
    );
};

export default ManageSitesPage;
