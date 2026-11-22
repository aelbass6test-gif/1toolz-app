import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  User,
  Store,
  StoreData,
  Employee,
  Order,
  OrderStatus,
  Permission,
  PERMISSIONS,
  Product,
  Transaction,
  Warehouse
} from '../types';
import { INITIAL_SETTINGS } from '../constants';
import * as db from '../services/databaseService';
import { cfFetch, cfAuthUpdatePassword } from '../services/cloudflareClient';
import { inAppAlert, inAppConfirm } from '../utils/inAppAlert';
import {
  Wrench,
  Search,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  LogIn,
  Globe,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  UserCog,
  UserPlus,
  Users,
  ArrowLeftRight,
  Trash2,
  Package,
  ShoppingCart,
  Wallet as WalletIcon,
  PlugZap,
  FileJson,
  Lock,
  Unlock,
  Server,
  Clock,
  Check,
  X,
  Save,
  RotateCcw,
  Activity,
  Webhook,
  MessageSquare,
  ShieldAlert,
  Sparkles,
  Copy
} from 'lucide-react';

type SupportSubTab =
  | 'diagnostics'
  | 'account_employees'
  | 'orders_finance'
  | 'integrations_logs'
  | 'backup_restore';

const VALID_ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'في_انتظار_المكالمة', label: 'في انتظار المكالمة' },
  { value: 'جاري_المراجعة', label: 'جاري المراجعة' },
  { value: 'مؤكد', label: 'مؤكد' },
  { value: 'قيد_التنفيذ', label: 'قيد التنفيذ' },
  { value: 'تم_الارسال', label: 'تم الإرسال' },
  { value: 'قيد_الشحن', label: 'قيد الشحن' },
  { value: 'تم_توصيلها', label: 'تم توصيلها' },
  { value: 'تم_التوصيل', label: 'تم التوصيل' },
  { value: 'تم_التحصيل', label: 'تم التحصيل' },
  { value: 'مدفوعة', label: 'مدفوعة' },
  { value: 'مؤجل', label: 'مؤجل' },
  { value: 'مجدول', label: 'مجدول' },
  { value: 'تم_الاستبدال', label: 'تم الاستبدال' },
  { value: 'مرتجع', label: 'مرتجع' },
  { value: 'مرتجع_جزئي', label: 'مرتجع جزئي' },
  { value: 'مرتجع_بعد_الاستلام', label: 'مرتجع بعد الاستلام' },
  { value: 'فشل_التوصيل', label: 'فشل التوصيل' },
  { value: 'تمت_الاعادة_لشركة_الشحن', label: 'تمت الإعادة لشركة الشحن' },
  { value: 'ملغي', label: 'ملغي' },
  { value: 'مؤرشف', label: 'مؤرشف' }
];

const QUICK_PERMISSION_KEYS: { key: Permission; label: string }[] = [
  { key: 'DASHBOARD_VIEW', label: 'لوحة التحكم' },
  { key: 'REPORTS_VIEW', label: 'التقارير' },
  { key: 'ORDERS_VIEW', label: 'عرض الطلبات' },
  { key: 'ORDERS_MANAGE', label: 'إدارة الطلبات' },
  { key: 'RETURNS_MANAGE', label: 'المرتجعات' },
  { key: 'POS_VIEW', label: 'نقاط البيع' },
  { key: 'POS_MANAGE', label: 'إدارة نقاط البيع' },
  { key: 'PRODUCTS_VIEW', label: 'عرض المنتجات' },
  { key: 'PRODUCTS_MANAGE', label: 'إدارة المنتجات' },
  { key: 'INVENTORY_MANAGE', label: 'إدارة المخزون' },
  { key: 'CUSTOMERS_VIEW', label: 'عرض العملاء' },
  { key: 'CUSTOMERS_MANAGE', label: 'إدارة العملاء' },
  { key: 'WALLET_VIEW', label: 'عرض المحفظة' },
  { key: 'WALLET_MANAGE', label: 'إدارة المحفظة' },
  { key: 'CASH_MANAGE', label: 'إدارة الخزينة' },
  { key: 'SETTINGS_VIEW', label: 'عرض الإعدادات' },
  { key: 'SETTINGS_MANAGE', label: 'تعديل الإعدادات' },
  { key: 'TEAM_MANAGE', label: 'إدارة الفريق' }
];

interface AdminSupportCenterProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  initialStoreId?: string;
  initialSubTab?: SupportSubTab;
  onImpersonate: (user: User, targetStoreId?: string) => void;
}

const AdminSupportCenter: React.FC<AdminSupportCenterProps> = ({
  users,
  setUsers,
  allStoresData,
  setAllStoresData,
  initialStoreId,
  initialSubTab = 'diagnostics',
  onImpersonate
}) => {
  // Flatten all stores with their owner metadata
  const allStoreEntries = useMemo(() => {
    const entries: { store: Store; owner: User }[] = [];
    users.forEach(u => {
      (u.stores || []).forEach(s => {
        entries.push({ store: s, owner: u });
      });
    });
    return entries;
  }, [users]);

  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string>(() => {
    if (initialStoreId) return initialStoreId;
    return allStoreEntries[0]?.store.id || '';
  });
  const [subTab, setSubTab] = useState<SupportSubTab>(initialSubTab);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  useEffect(() => {
    if (initialStoreId && allStoreEntries.some(e => e.store.id === initialStoreId)) {
      setSelectedStoreId(initialStoreId);
    } else if (!selectedStoreId && allStoreEntries[0]?.store.id) {
      setSelectedStoreId(allStoreEntries[0].store.id);
    }
  }, [initialStoreId, allStoreEntries, selectedStoreId]);

  const filteredStoreEntries = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return allStoreEntries;
    return allStoreEntries.filter(({ store, owner }) =>
      store.name.toLowerCase().includes(q) ||
      store.id.toLowerCase().includes(q) ||
      (store.subdomain || '').toLowerCase().includes(q) ||
      (store.customDomain || '').toLowerCase().includes(q) ||
      owner.fullName.toLowerCase().includes(q) ||
      owner.phone.includes(q) ||
      (owner.email || '').toLowerCase().includes(q)
    );
  }, [allStoreEntries, storeSearch]);

  const currentEntry = useMemo(
    () => allStoreEntries.find(e => e.store.id === selectedStoreId) || allStoreEntries[0] || null,
    [allStoreEntries, selectedStoreId]
  );

  const selectedStore = currentEntry?.store || null;
  const selectedOwner = currentEntry?.owner || null;
  const storeData: StoreData | undefined = selectedStore ? allStoresData[selectedStore.id] : undefined;

  const notify = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setStatusNotice({ type, message });
    setTimeout(() => {
      setStatusNotice(prev => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  // ---------- Cloud Meta & Sync State ----------
  const [d1Meta, setD1Meta] = useState<{ exists: boolean; version?: number; updatedAt?: string } | null>(null);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  const fetchStoreMeta = useCallback(async (storeId: string) => {
    if (!storeId) return;
    setIsLoadingMeta(true);
    try {
      const res = await cfFetch<any>(`/api/db/stores/${encodeURIComponent(storeId)}/meta`);
      setD1Meta({
        exists: Boolean(res?.exists),
        version: typeof res?.version === 'number' ? res.version : undefined,
        updatedAt: res?.updatedAt || res?.updated_at
      });
    } catch {
      setD1Meta(null);
    } finally {
      setIsLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStore?.id) {
      void fetchStoreMeta(selectedStore.id);
    }
  }, [selectedStore?.id, fetchStoreMeta]);

  const persistUpdatedStoreData = async (store: Store, nextData: StoreData, successMsg: string) => {
    setBusyAction('saving_store');
    try {
      const result = await db.saveStoreData(store, nextData);
      if (!result.success) {
        throw new Error(result.error || 'تعذر حفظ التغييرات في Cloudflare D1');
      }
      setAllStoresData(prev => ({ ...prev, [store.id]: nextData }));
      await fetchStoreMeta(store.id);
      notify('success', successMsg);
      return true;
    } catch (err: any) {
      notify('error', err?.message || 'حدث خطأ أثناء الحفظ السحابي.');
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  // ---------- Domain Editor State ----------
  const [domainForm, setDomainForm] = useState({
    subdomain: '',
    customDomain: '',
    customAppDomain: '',
    url: ''
  });

  useEffect(() => {
    if (selectedStore) {
      setDomainForm({
        subdomain: storeData?.settings?.subdomain || selectedStore.subdomain || '',
        customDomain: selectedStore.customDomain || storeData?.settings?.customDomain || '',
        customAppDomain: storeData?.settings?.customAppDomain || '',
        url: selectedStore.url || ''
      });
    }
  }, [selectedStore?.id, selectedStore?.subdomain, selectedStore?.customDomain, selectedStore?.url, storeData?.settings?.subdomain, storeData?.settings?.customAppDomain]);

  // ---------- Diagnostics Computation ----------
  const diagnostics = useMemo(() => {
    if (!storeData || !selectedStore) {
      return {
        missingStoreData: true,
        noWarehouses: false,
        brokenProductsCount: 0,
        warehouseMismatchCount: 0,
        corruptOrdersCount: 0,
        duplicateOrderNumbers: [] as string[],
        walletExpectedBalance: 0,
        walletActualBalance: 0,
        walletMismatch: false,
        stalePendingTxCount: 0,
        negativeTreasuryCount: 0,
        noActiveShippingCount: 0,
        noActivePaymentsCount: 0,
        domainIssues: [] as string[]
      };
    }

    const settings = storeData.settings || INITIAL_SETTINGS;
    const warehouses = settings.warehouses || [];
    const products = settings.products || [];
    const orders = storeData.orders || [];
    const walletTxs = storeData.wallet?.transactions || [];
    const treasuryAccs = storeData.treasury?.accounts || [];

    const noWarehouses = warehouses.length === 0;
    const warehouseIds = new Set(warehouses.map(w => w.id));

    let brokenProductsCount = 0;
    let warehouseMismatchCount = 0;

    products.forEach(p => {
      const priceBad = isNaN(Number(p.price)) || Number(p.price) < 0;
      const costBad = isNaN(Number(p.costPrice)) || Number(p.costPrice) < 0;
      const stockBad = !p.hasVariants && (isNaN(Number(p.stockQuantity ?? p.stock ?? 0)) || Number(p.stockQuantity ?? p.stock ?? 0) < 0);
      if (priceBad || costBad || stockBad) brokenProductsCount++;

      if (warehouses.length > 0) {
        if (p.hasVariants && Array.isArray(p.variants)) {
          const hasVarMismatch = p.variants.some(v => {
            const whEntries = Object.entries(v.warehouseStock || {});
            const unknownWh = whEntries.some(([k]) => !warehouseIds.has(k));
            const sum = whEntries.reduce((s, [, val]) => s + (Number(val) || 0), 0);
            const target = Number(v.stockQuantity ?? v.stock ?? 0);
            return unknownWh || sum !== target;
          });
          if (hasVarMismatch) warehouseMismatchCount++;
        } else {
          const whEntries = Object.entries(p.warehouseStock || {});
          const unknownWh = whEntries.some(([k]) => !warehouseIds.has(k));
          const sum = whEntries.reduce((s, [, val]) => s + (Number(val) || 0), 0);
          const target = Number(p.stockQuantity ?? p.stock ?? 0);
          if (unknownWh || sum !== target || whEntries.length === 0) warehouseMismatchCount++;
        }
      }
    });

    let corruptOrdersCount = 0;
    const orderNumCounts = new Map<string, number>();
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    orders.forEach(o => {
      const missingKey = !o?.id || !o?.orderNumber;
      const badDate = !o?.date || !isoRegex.test(o.date) || isNaN(new Date(o.date).getTime()) || /[٠-٩]/.test(o.date);
      const badMoney =
        isNaN(Number(o?.productPrice ?? 0)) ||
        isNaN(Number(o?.shippingFee ?? 0)) ||
        isNaN(Number(o?.discount ?? 0));
      if (missingKey || badDate || badMoney) corruptOrdersCount++;

      const num = String(o?.orderNumber || '').trim();
      if (num) orderNumCounts.set(num, (orderNumCounts.get(num) || 0) + 1);
    });

    const duplicateOrderNumbers = Array.from(orderNumCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([num]) => num);

    const walletActualBalance = Number(storeData.wallet?.balance || 0);
    const walletExpectedBalance = walletTxs.reduce((sum, tx) => {
      if (tx.status !== 'completed') return sum;
      const amt = Number(tx.amount || 0);
      return tx.type === 'إيداع' ? sum + amt : sum - amt;
    }, 0);
    const walletMismatch = Math.abs(walletActualBalance - walletExpectedBalance) > 0.01;

    const twoDaysAgo = Date.now() - 48 * 3600 * 1000;
    const stalePendingTxCount = walletTxs.filter(
      tx => tx.status === 'pending' && new Date(tx.date).getTime() < twoDaysAgo
    ).length;

    const negativeTreasuryCount = treasuryAccs.filter(a => Number(a.balance || 0) < 0).length;
    const activeShippingCompanies = Object.values(settings.activeCompanies || {}).filter(Boolean).length;
    const activePayments = (settings.paymentMethods || []).filter(m => m.active).length;

    const domainIssues: string[] = [];
    if (!selectedStore.subdomain && !storeData.settings?.subdomain) {
      domainIssues.push('المتجر لا يملك Subdomain مسجل');
    }
    if (selectedStore.subdomain && storeData.settings?.subdomain && selectedStore.subdomain !== storeData.settings.subdomain) {
      domainIssues.push('اختلاف بين Subdomain ملف المستخدم وبيانات المتجر');
    }

    return {
      missingStoreData: false,
      noWarehouses,
      brokenProductsCount,
      warehouseMismatchCount,
      corruptOrdersCount,
      duplicateOrderNumbers,
      walletExpectedBalance,
      walletActualBalance,
      walletMismatch,
      stalePendingTxCount,
      negativeTreasuryCount,
      noActiveShippingCount: activeShippingCompanies === 0 ? 1 : 0,
      noActivePaymentsCount: activePayments === 0 ? 1 : 0,
      domainIssues
    };
  }, [storeData, selectedStore]);

  // ---------- 1-Click Auto-Fix Actions ----------
  const handleForcePull = async () => {
    if (!selectedStore) return;
    setBusyAction('pull');
    try {
      const fresh = await db.getStoreData(selectedStore.id, true);
      if (fresh) {
        setAllStoresData(prev => ({ ...prev, [selectedStore.id]: fresh }));
        await fetchStoreMeta(selectedStore.id);
        notify('success', `تم سحب أحدث نسخة من متجر "${selectedStore.name}" من Cloudflare D1.`);
      } else {
        notify('error', 'لم يتم العثور على بيانات محفوظة للمتجر على D1.');
      }
    } catch (err: any) {
      notify('error', `فشل السحب السحابي: ${err?.message || err}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleForcePush = async () => {
    if (!selectedStore) return;
    const payload: StoreData = storeData || {
      orders: [],
      settings: { ...INITIAL_SETTINGS, storeName: selectedStore.name, products: [] },
      wallet: { balance: 0, transactions: [], withdrawRequests: [] },
      cart: [],
      customers: []
    };
    await persistUpdatedStoreData(selectedStore, payload, `تم دفع ومزامنة بيانات متجر "${selectedStore.name}" إلى Cloudflare D1.`);
  };

  const handleClearLocalTombstones = async () => {
    if (!selectedStore) return;
    const ok = await inAppConfirm(
      'سيتم مسح قائمة الحذف المعلقة محلياً (Tombstones) وإعادة سحب بيانات المتجر من السيرفر. هل تريد المتابعة؟',
      { title: 'تنظيف كاش الحذف المحلي', type: 'warning', confirmText: 'تنظيف وإعادة المزامنة', cancelText: 'إلغاء' }
    );
    if (!ok) return;
    try {
      const raw = localStorage.getItem('explicit_deleted_cloud_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter((id: string) => !String(id).startsWith(`${selectedStore.id}_`));
          localStorage.setItem('explicit_deleted_cloud_ids_v1', JSON.stringify(cleaned));
        }
      }
    } catch {
      // ignore storage errors
    }
    await handleForcePull();
  };

  const handleSaveDomains = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !selectedOwner) return;

    const reservedSubdomains = ['app', 'api', 'www', 'fallback', 'shipping'];
    const cleanSub = domainForm.subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const cleanCustom = domainForm.customDomain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '').toLowerCase();
    const cleanAppCustom = domainForm.customAppDomain.trim().replace(/\/$/, '');

    if (cleanSub && reservedSubdomains.includes(cleanSub)) {
      notify(
        'error',
        cleanSub === 'shipping'
          ? 'اسم shipping محجوز لنظام الشحن المنفصل ولا يمكن تعيينه لمتجر.'
          : `الاسم "${cleanSub}" محجوز للنظام ولا يمكن تعيينه كرابط متجر.`
      );
      return;
    }

    const extractHost = (val: string) =>
      val.replace(/^https?:\/\//i, '').split('/')[0].trim().toLowerCase().replace(/^www\./, '');
    const reservedHosts = new Set(reservedSubdomains.map(s => `${s}.abdomedi.com`).concat('abdomedi.com'));
    if (
      (cleanCustom && reservedHosts.has(extractHost(cleanCustom))) ||
      (cleanAppCustom && reservedHosts.has(extractHost(cleanAppCustom)))
    ) {
      notify('error', 'لا يمكن ربط نطاق نظام محجوز (مثل shipping.abdomedi.com أو app.abdomedi.com) كدومين مخصص لمتجر.');
      return;
    }

    const computedUrl =
      domainForm.url.trim() ||
      (cleanCustom ? cleanCustom : cleanSub ? `${cleanSub}.abdomedi.com` : selectedStore.url);

    const updatedStore: Store = {
      ...selectedStore,
      subdomain: cleanSub || undefined,
      customDomain: cleanCustom || undefined,
      url: computedUrl
    };

    const updatedOwner: User = {
      ...selectedOwner,
      stores: (selectedOwner.stores || []).map(s => (s.id === selectedStore.id ? updatedStore : s))
    };
    const updatedUsers = users.map(u => (u.phone === selectedOwner.phone ? updatedOwner : u));

    setBusyAction('saving_domain');
    try {
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      setUsers(updatedUsers);

      if (storeData) {
        const updatedData: StoreData = {
          ...storeData,
          settings: {
            ...storeData.settings,
            subdomain: cleanSub || undefined,
            isSubdomainFixed: Boolean(cleanSub),
            customDomain: cleanCustom || undefined,
            customAppDomain: cleanAppCustom || undefined
          }
        };
        await db.saveStoreData(updatedStore, updatedData);
        setAllStoresData(prev => ({ ...prev, [selectedStore.id]: updatedData }));
      }
      notify('success', 'تم تحديث وحفظ إعدادات الدومين والروابط في حساب التاجر وبيانات المتجر.');
    } catch (err: any) {
      notify('error', `تعذر حفظ الدومين: ${err?.message || err}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleFixInventoryAndWarehouses = async () => {
    if (!selectedStore || !storeData) return;
    const settings = storeData.settings || INITIAL_SETTINGS;
    let warehouses: Warehouse[] = [...(settings.warehouses || [])];

    if (warehouses.length === 0) {
      warehouses = [
        {
          id: 'wh_default',
          name: 'المستودع الرئيسي',
          isDefault: true,
          type: 'central',
          location: 'الفرع الرئيسي'
        }
      ];
    }

    const whIds = warehouses.map(w => w.id);
    const defaultWhId = warehouses.find(w => w.isDefault)?.id || whIds[0];

    const fixedProducts: Product[] = (settings.products || []).map(p => {
      const safePrice = isNaN(Number(p.price)) || Number(p.price) < 0 ? 0 : Number(p.price);
      const safeCost = isNaN(Number(p.costPrice)) || Number(p.costPrice) < 0 ? 0 : Number(p.costPrice);

      if (p.hasVariants && Array.isArray(p.variants)) {
        const fixedVariants = p.variants.map(v => {
          const whStock: Record<string, number> = {};
          Object.entries(v.warehouseStock || {}).forEach(([k, val]) => {
            if (whIds.includes(k)) {
              whStock[k] = Math.max(0, Number(val) || 0);
            }
          });
          const target = Math.max(0, Number(v.stockQuantity ?? v.stock ?? 0) || 0);
          const dist = Object.values(whStock).reduce((s, val) => s + val, 0);
          if (Object.keys(whStock).length === 0 || dist !== target) {
            whStock[defaultWhId] = Math.max(0, (whStock[defaultWhId] || 0) + (target - dist));
          }
          const finalStock = Object.values(whStock).reduce((s, val) => s + val, 0);
          return {
            ...v,
            price: isNaN(Number(v.price)) ? safePrice : Math.max(0, Number(v.price)),
            costPrice: isNaN(Number(v.costPrice)) ? safeCost : Math.max(0, Number(v.costPrice || 0)),
            warehouseStock: whStock,
            stockQuantity: finalStock,
            stock: finalStock
          };
        });
        const total = fixedVariants.reduce((s, v) => s + (v.stockQuantity || 0), 0);
        return {
          ...p,
          price: safePrice,
          costPrice: safeCost,
          variants: fixedVariants,
          stockQuantity: total,
          stock: total,
          inStock: total > 0
        };
      }

      const whStock: Record<string, number> = {};
      Object.entries(p.warehouseStock || {}).forEach(([k, val]) => {
        if (whIds.includes(k)) {
          whStock[k] = Math.max(0, Number(val) || 0);
        }
      });
      const target = Math.max(0, Number(p.stockQuantity ?? p.stock ?? 0) || 0);
      const dist = Object.values(whStock).reduce((s, val) => s + val, 0);
      if (Object.keys(whStock).length === 0 || dist !== target) {
        whStock[defaultWhId] = Math.max(0, (whStock[defaultWhId] || 0) + (target - dist));
      }
      const finalStock = Object.values(whStock).reduce((s, val) => s + val, 0);
      return {
        ...p,
        price: safePrice,
        costPrice: safeCost,
        warehouseStock: whStock,
        stockQuantity: finalStock,
        stock: finalStock,
        inStock: finalStock > 0
      };
    });

    const nextData: StoreData = {
      ...storeData,
      settings: {
        ...settings,
        defaultWarehouseId: settings.defaultWarehouseId || defaultWhId,
        warehouses,
        products: fixedProducts
      }
    };

    await persistUpdatedStoreData(selectedStore, nextData, 'تم إصلاح المستودعات وتصحيح أرصدة المنتجات ومطابقتها سحابياً.');
  };

  const handleCleanAndFixOrders = async () => {
    if (!selectedStore || !storeData) return;
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    const seenIds = new Set<string>();
    const cleanedOrders: Order[] = [];

    (storeData.orders || []).forEach((o, index) => {
      if (!o) return;
      let orderId = String(o.id || '').trim() || `ord-fix-${Date.now()}-${index}`;
      if (seenIds.has(orderId)) {
        orderId = `${orderId}-dup-${index}`;
      }
      seenIds.add(orderId);

      const orderNumber = String(o.orderNumber || '').trim() || `ORD-${String(index + 1).padStart(4, '0')}`;
      let safeDate = o.date;
      if (!safeDate || !isoRegex.test(safeDate) || isNaN(new Date(safeDate).getTime()) || /[٠-٩]/.test(safeDate)) {
        const parsed = safeDate ? new Date(safeDate) : new Date();
        safeDate = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      }

      cleanedOrders.push({
        ...o,
        id: orderId,
        orderNumber,
        date: safeDate,
        productPrice: isNaN(Number(o.productPrice)) ? 0 : Number(o.productPrice),
        productCost: isNaN(Number(o.productCost)) ? 0 : Number(o.productCost),
        shippingFee: isNaN(Number(o.shippingFee)) ? 0 : Number(o.shippingFee),
        discount: isNaN(Number(o.discount)) ? 0 : Number(o.discount),
        weight: isNaN(Number(o.weight)) ? 1 : Number(o.weight)
      });
    });

    await persistUpdatedStoreData(
      selectedStore,
      { ...storeData, orders: cleanedOrders },
      `تم فحص وإصلاح (${cleanedOrders.length}) طلب وحفظهم في قاعدة البيانات.`
    );
  };

  const handleRecalculateWallet = async () => {
    if (!selectedStore || !storeData) return;
    const ok = await inAppConfirm(
      `سيتم إعادة احتساب رصيد المحفظة من الحركات المكتملة (${diagnostics.walletExpectedBalance.toLocaleString('ar-EG')} ج.م بدلاً من ${diagnostics.walletActualBalance.toLocaleString('ar-EG')} ج.م). هل تريد التأكيد؟`,
      { title: 'مراجعة وإصلاح رصيد المحفظة', type: 'warning', confirmText: 'إعادة الاحتساب', cancelText: 'إلغاء' }
    );
    if (!ok) return;

    const nextData: StoreData = {
      ...storeData,
      wallet: {
        ...(storeData.wallet || { balance: 0, transactions: [] }),
        balance: Math.round(diagnostics.walletExpectedBalance * 100) / 100
      }
    };
    await persistUpdatedStoreData(selectedStore, nextData, 'تمت إعادة مطابقة رصيد المحفظة مع سجل المعاملات المكتملة.');
  };

  // ---------- Account & Employees State ----------
  const [ownerForm, setOwnerForm] = useState({
    fullName: '',
    email: '',
    isBanned: false,
    defaultStoreId: '',
    autoLaunchDefaultStore: false
  });
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [transferPhone, setTransferPhone] = useState('');

  useEffect(() => {
    if (selectedOwner) {
      setOwnerForm({
        fullName: selectedOwner.fullName || '',
        email: selectedOwner.email || '',
        isBanned: Boolean(selectedOwner.isBanned),
        defaultStoreId: selectedOwner.defaultStoreId || '',
        autoLaunchDefaultStore: Boolean(selectedOwner.autoLaunchDefaultStore)
      });
      setNewOwnerPassword('');
      setTransferPhone('');
    }
  }, [selectedOwner?.phone, selectedOwner?.fullName, selectedOwner?.email, selectedOwner?.isBanned, selectedOwner?.defaultStoreId]);

  const handleSaveOwnerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwner) return;
    if (!ownerForm.fullName.trim()) {
      notify('error', 'الاسم الكامل للتاجر مطلوب.');
      return;
    }

    const updatedOwner: User = {
      ...selectedOwner,
      fullName: ownerForm.fullName.trim(),
      email: ownerForm.email.trim(),
      isBanned: ownerForm.isBanned,
      defaultStoreId: ownerForm.defaultStoreId || undefined,
      autoLaunchDefaultStore: ownerForm.defaultStoreId ? ownerForm.autoLaunchDefaultStore : false
    };

    const updatedUsers = users.map(u => (u.phone === selectedOwner.phone ? updatedOwner : u));
    setBusyAction('saving_owner');
    try {
      await db.createUserDoc(updatedOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      setUsers(updatedUsers);
      notify('success', `تم حفظ بيانات التاجر "${updatedOwner.fullName}" في قاعدة البيانات.`);
    } catch (err: any) {
      notify('error', `تعذر حفظ بيانات التاجر: ${err?.message || err}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetOwnerPassword = async () => {
    if (!selectedOwner) return;
    if (newOwnerPassword.trim().length < 6) {
      notify('error', 'كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف أو أرقام.');
      return;
    }
    setBusyAction('reset_owner_pw');
    try {
      await cfAuthUpdatePassword({
        phone: selectedOwner.phone,
        newPassword: newOwnerPassword.trim(),
        adminOverride: true
      });
      setNewOwnerPassword('');
      notify('success', `تم تغيير كلمة مرور التاجر (${selectedOwner.phone}) بنجاح على Cloudflare Auth.`);
    } catch (err: any) {
      notify('error', `فشل تحديث كلمة المرور: ${err?.message || err}`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedOwner || !selectedStore) return;
    const cleanTargetPhone = transferPhone.trim();
    if (!cleanTargetPhone) {
      notify('error', 'اختر التاجر المستهدف أو أدخل رقم هاتفه.');
      return;
    }
    if (cleanTargetPhone === selectedOwner.phone) {
      notify('error', 'هذا التاجر هو المالك الحالي بالفعل.');
      return;
    }
    const targetUser = users.find(u => u.phone === cleanTargetPhone);
    if (!targetUser) {
      notify('error', 'لم يتم العثور على مستخدم مسجل بهذا الرقم.');
      return;
    }

    const ok = await inAppConfirm(
      `سيتم نقل ملكية متجر "${selectedStore.name}" من "${selectedOwner.fullName}" إلى "${targetUser.fullName}" (${targetUser.phone}). هل أنت متأكد؟`,
      { title: 'نقل ملكية المتجر', type: 'warning', confirmText: 'تأكيد النقل', cancelText: 'إلغاء' }
    );
    if (!ok) return;

    const updatedOldOwner: User = {
      ...selectedOwner,
      stores: (selectedOwner.stores || []).filter(s => s.id !== selectedStore.id),
      defaultStoreId: selectedOwner.defaultStoreId === selectedStore.id ? undefined : selectedOwner.defaultStoreId
    };
    const updatedNewOwner: User = {
      ...targetUser,
      stores: [...(targetUser.stores || []).filter(s => s.id !== selectedStore.id), selectedStore]
    };

    const updatedUsers = users.map(u => {
      if (u.phone === updatedOldOwner.phone) return updatedOldOwner;
      if (u.phone === updatedNewOwner.phone) return updatedNewOwner;
      return u;
    });

    setBusyAction('transfer_owner');
    try {
      await db.createUserDoc(updatedOldOwner);
      await db.createUserDoc(updatedNewOwner);
      await db.saveGlobalData({ users: updatedUsers, loyaltyData: {} });
      setUsers(updatedUsers);
      setTransferPhone('');
      notify('success', `تم نقل ملكية "${selectedStore.name}" إلى ${targetUser.fullName} بنجاح.`);
    } catch (err: any) {
      notify('error', `فشل نقل الملكية: ${err?.message || err}`);
    } finally {
      setBusyAction(null);
    }
  };

  // ---------- Employees Troubleshooter State ----------
  const [newEmpForm, setNewEmpForm] = useState({ name: '', phone: '', email: '', password: '', role: 'موظف متابعة' });
  const [empResetTarget, setEmpResetTarget] = useState<{ id: string; pw: string }>({ id: '', pw: '' });
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);

  const handleAddSupportEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore || !storeData) return;
    const phone = newEmpForm.phone.trim();
    const name = newEmpForm.name.trim();
    if (!phone || !name) {
      notify('error', 'اسم الموظف ورقم الهاتف مطلوبان.');
      return;
    }
    const existingList = storeData.settings?.employees || [];
    if (existingList.some(emp => emp.id === phone || emp.phone === phone)) {
      notify('error', 'هذا الموظف مسجل بالفعل في هذا المتجر.');
      return;
    }

    const newEmployee: Employee = {
      id: phone,
      phone,
      name,
      email: newEmpForm.email.trim() || `${phone}@abdomedi.com`,
      role: newEmpForm.role || 'موظف',
      status: 'active',
      permissions: ['DASHBOARD_VIEW', 'ORDERS_VIEW', 'ORDERS_MANAGE', 'PRODUCTS_VIEW']
    };

    const nextData: StoreData = {
      ...storeData,
      settings: {
        ...storeData.settings,
        employees: [...existingList, newEmployee]
      }
    };

    const saved = await persistUpdatedStoreData(selectedStore, nextData, `تمت إضافة الموظف "${name}" وتفعيله في المتجر.`);
    if (saved) {
      if (newEmpForm.password.trim().length >= 6) {
        await cfAuthUpdatePassword({
          phone,
          storeId: selectedStore.id,
          newPassword: newEmpForm.password.trim(),
          adminOverride: true
        }).catch(() => {});
      }
      setNewEmpForm({ name: '', phone: '', email: '', password: '', role: 'موظف متابعة' });
    }
  };

  const handleUpdateEmployee = async (empId: string, updater: (emp: Employee) => Employee, msg: string) => {
    if (!selectedStore || !storeData) return;
    const updatedEmployees = (storeData.settings?.employees || []).map(emp =>
      emp.id === empId ? updater(emp) : emp
    );
    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        settings: {
          ...storeData.settings,
          employees: updatedEmployees
        }
      },
      msg
    );
  };

  const handleRemoveEmployee = async (emp: Employee) => {
    if (!selectedStore || !storeData) return;
    const ok = await inAppConfirm(`سيتم إزالة الموظف "${emp.name}" (${emp.phone || emp.id}) من صلاحيات المتجر. هل تريد المتابعة؟`, {
      title: 'حذف موظف من المتجر',
      type: 'danger',
      confirmText: 'حذف الموظف',
      cancelText: 'إلغاء'
    });
    if (!ok) return;
    const nextEmployees = (storeData.settings?.employees || []).filter(e => e.id !== emp.id);
    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        settings: {
          ...storeData.settings,
          employees: nextEmployees
        }
      },
      `تم حذف الموظف "${emp.name}" من المتجر.`
    );
  };

  const handleResetEmployeePassword = async (emp: Employee) => {
    if (!selectedStore) return;
    if (empResetTarget.pw.trim().length < 6) {
      notify('error', 'كلمة مرور الموظف يجب أن لا تقل عن 6 أحرف.');
      return;
    }
    setBusyAction(`emp_pw_${emp.id}`);
    try {
      await cfAuthUpdatePassword({
        phone: emp.phone || emp.id,
        storeId: selectedStore.id,
        newPassword: empResetTarget.pw.trim(),
        adminOverride: true
      });
      setEmpResetTarget({ id: '', pw: '' });
      notify('success', `تم تعيين كلمة مرور جديدة للموظف "${emp.name}" بنجاح.`);
    } catch (err: any) {
      notify('error', `تعذر تغيير كلمة مرور الموظف: ${err?.message || err}`);
    } finally {
      setBusyAction(null);
    }
  };

  // ---------- Orders & Finance Troubleshooter State ----------
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  const filteredOrders = useMemo(() => {
    const orders = storeData?.orders || [];
    const q = orderSearch.trim().toLowerCase();
    return orders
      .filter(o => {
        if (orderStatusFilter !== 'all' && o.status !== orderStatusFilter) return false;
        if (!q) return true;
        return (
          String(o.orderNumber || '').toLowerCase().includes(q) ||
          String(o.id || '').toLowerCase().includes(q) ||
          String(o.customerName || '').toLowerCase().includes(q) ||
          String(o.customerPhone || '').includes(q)
        );
      })
      .slice(0, 40);
  }, [storeData?.orders, orderSearch, orderStatusFilter]);

  const handlePatchOrder = async (orderId: string, patch: Partial<Order>, msg: string) => {
    if (!selectedStore || !storeData) return;
    const nextOrders = (storeData.orders || []).map(o => (o.id === orderId ? { ...o, ...patch } : o));
    await persistUpdatedStoreData(selectedStore, { ...storeData, orders: nextOrders }, msg);
  };

  const handleDeleteOrderSupport = async (order: Order) => {
    if (!selectedStore || !storeData) return;
    const ok = await inAppConfirm(
      `حذف الطلب رقم #${order.orderNumber || order.id} نهائياً؟ استخدم هذا الإجراء للطلبات المكررة أو التالفة فقط.`,
      { title: 'حذف طلب تالف/مكرر', type: 'danger', confirmText: 'حذف الطلب', cancelText: 'إلغاء' }
    );
    if (!ok) return;
    await db.deleteStoreItem(selectedStore.id, 'orders', order.id).catch(() => {});
    const nextOrders = (storeData.orders || []).filter(o => o.id !== order.id);
    await persistUpdatedStoreData(selectedStore, { ...storeData, orders: nextOrders }, `تم حذف الطلب #${order.orderNumber} من المتجر.`);
  };

  const handleRemoveDuplicateOrders = async () => {
    if (!selectedStore || !storeData) return;
    const orders = storeData.orders || [];
    const seenNumbers = new Set<string>();
    const deduped: Order[] = [];
    let removedCount = 0;

    orders.forEach(o => {
      const key = String(o.orderNumber || '').trim();
      if (key && seenNumbers.has(key)) {
        removedCount++;
        return;
      }
      if (key) seenNumbers.add(key);
      deduped.push(o);
    });

    if (removedCount === 0) {
      notify('info', 'لا توجد طلبات مكررة بنفس الرقم.');
      return;
    }

    const ok = await inAppConfirm(
      `تم رصد (${removedCount}) طلب مكرر بنفس رقم الطلب. سيتم الإبقاء على النسخة الأولى وحذف التكرار. متابعة؟`,
      { title: 'حذف الطلبات المكررة', type: 'warning', confirmText: 'إزالة التكرار', cancelText: 'إلغاء' }
    );
    if (!ok) return;
    await persistUpdatedStoreData(selectedStore, { ...storeData, orders: deduped }, `تمت إزالة (${removedCount}) طلب مكرر بنجاح.`);
  };

  const handleUpdateWalletTxStatus = async (txId: string, nextStatus: Transaction['status']) => {
    if (!selectedStore || !storeData) return;
    const nextTxs = (storeData.wallet?.transactions || []).map(tx =>
      tx.id === txId ? { ...tx, status: nextStatus } : tx
    );
    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        wallet: {
          ...(storeData.wallet || { balance: 0, transactions: [] }),
          transactions: nextTxs
        }
      },
      `تم تحديث حالة الحركة المالية ${txId} إلى "${nextStatus}".`
    );
  };

  const handleDeleteWalletTx = async (tx: Transaction) => {
    if (!selectedStore || !storeData) return;
    const isCompleted = !tx.status || tx.status === 'completed';
    const isDeposit = String(tx.type) === 'إيداع' || String(tx.type) === 'deposit';
    const balanceDelta = isCompleted ? (isDeposit ? -Number(tx.amount || 0) : Number(tx.amount || 0)) : 0;
    const ok = await inAppConfirm(
      `حذف المعاملة المالية (${tx.id}) بقيمة ${tx.amount} ج.م نهائياً؟\n${
        isCompleted
          ? `تنبيه محاسبي: هذه العملية مكتملة وسيتم تعديل رصيد المحفظة تلقائياً بمقدار (${balanceDelta >= 0 ? '+' : ''}${balanceDelta.toLocaleString('ar-EG')} ج.م).`
          : 'هذه العملية غير مكتملة ولن تؤثر على الرصيد المتاح.'
      }`,
      { title: 'حذف معاملة محفظة وتصحيح الرصيد (مدير المنصة)', type: 'danger', confirmText: 'حذف وتصحيح الرصيد', cancelText: 'إلغاء' }
    );
    if (!ok) return;
    const currentBalance = Number(storeData.wallet?.balance || 0);
    const nextBalance = currentBalance + balanceDelta;
    const nextTxs = (storeData.wallet?.transactions || []).filter(t => t.id !== tx.id);
    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        wallet: {
          ...(storeData.wallet || { balance: 0, transactions: [] }),
          balance: nextBalance,
          transactions: nextTxs
        }
      },
      `تم حذف الحركة المالية ${tx.id} وتحديث الرصيد إلى ${nextBalance.toLocaleString('ar-EG')} ج.م.`
    );
  };

  const handleDeleteTreasuryTx = async (tx: any) => {
    if (!selectedStore || !storeData?.treasury) return;
    const ok = await inAppConfirm(
      `هل أنت متأكد من حذف القيد المحاسبي (${tx.id}) بقيمة ${Number(tx.amount || 0).toLocaleString('ar-EG')} ج.م وعكس أثره المالي على الخزائن؟`,
      { title: 'حذف قيد دفتر الأستاذ وعكس الرصيد (مدير المنصة)', type: 'danger', confirmText: 'حذف وعكس الأثر المالي', cancelText: 'إلغاء' }
    );
    if (!ok) return;

    const currentTreasury = storeData.treasury;
    const updatedTransactions = (currentTreasury.transactions || []).filter((t: any) => t.id !== tx.id);
    let updatedAccounts = [...(currentTreasury.accounts || [])];
    let updatedWallet = storeData.wallet ? { ...storeData.wallet, transactions: [...(storeData.wallet.transactions || [])] } : { balance: 0, transactions: [] };

    const adjustAccountOrWallet = (accId: string | undefined, delta: number) => {
      if (!accId) return;
      if (accId === 'central_wallet') {
        updatedWallet.balance = Number(updatedWallet.balance || 0) + delta;
      } else {
        updatedAccounts = updatedAccounts.map(acc =>
          acc.id === accId ? { ...acc, balance: Number(acc.balance || 0) + delta } : acc
        );
      }
    };

    if (tx.type === 'in') {
      adjustAccountOrWallet(tx.accountId, -Number(tx.amount || 0));
    } else if (tx.type === 'out') {
      adjustAccountOrWallet(tx.accountId, Number(tx.amount || 0));
    } else if (tx.type === 'transfer') {
      const totalDeducted = Number(tx.amount || 0) + Number(tx.transferFee || 0);
      adjustAccountOrWallet(tx.fromAccountId, totalDeducted);
      adjustAccountOrWallet(tx.toAccountId, -Number(tx.amount || 0));
    }

    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        wallet: updatedWallet,
        treasury: {
          ...currentTreasury,
          accounts: updatedAccounts,
          transactions: updatedTransactions
        }
      },
      `تم حذف القيد المحاسبي (${tx.id}) وعكس أثره المالي بنجاح.`
    );
  };

  const handleUpdateHiddenWalletSettings = async (patch: Record<string, any>) => {
    if (!selectedStore || !storeData) return;
    const nextSettings = {
      ...storeData.settings,
      ...patch
    };
    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        settings: nextSettings
      },
      'تم تحديث إعدادات المبلغ المخفي / فرق التقفيل للمتجر بنجاح.'
    );
  };

  // ---------- Integrations & Logs State ----------
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const loadIntegrationLogs = useCallback(async (storeId: string) => {
    if (!storeId) return;
    setIsLoadingLogs(true);
    try {
      const [waLogsRes, cloudWhRes, maintRes] = await Promise.all([
        cfFetch<any>(`/api/db/whatsapp/${encodeURIComponent(storeId)}/webhook-logs`).catch(() => ({ logs: [] })),
        cfFetch<any>(`/api/db/webhook-logs?storeId=${encodeURIComponent(storeId)}&limit=50`).catch(() => ({ logs: [] })),
        cfFetch<any>(`/api/db/maintenance?storeId=${encodeURIComponent(storeId)}`).catch(() => ({ requests: [], items: [] }))
      ]);

      const remoteWaLogs = Array.isArray(waLogsRes?.logs) ? waLogsRes.logs : [];
      const cloudWhLogs = Array.isArray(cloudWhRes?.logs) ? cloudWhRes.logs : [];
      const seenIds = new Set<string>();
      const merged: any[] = [];
      for (const l of [...cloudWhLogs, ...remoteWaLogs]) {
        if (l?.id && seenIds.has(l.id)) continue;
        if (l?.id) seenIds.add(l.id);
        merged.push(l);
      }
      setWebhookLogs(merged.slice(0, 40));

      const tickets = Array.isArray(maintRes?.requests)
        ? maintRes.requests
        : Array.isArray(maintRes?.items)
          ? maintRes.items
          : [];
      setMaintenanceTickets(tickets.slice(0, 20));
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  const handleSimulateStoreWebhook = async () => {
    if (!selectedStore) return;
    try {
      await cfFetch(`/api/db/webhook-logs`, {
        method: 'POST',
        body: JSON.stringify({
          id: `sim-admin-${Date.now()}`,
          storeId: selectedStore.id,
          direction: 'inbound',
          provider: 'bosta',
          event: 'order.delivery_status.updated (محاكاة مدير المنصة)',
          status: 'success',
          statusCode: 200,
          orderId: `ORD-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
          waybill: `WB-${Math.floor(10000000 + Math.random() * 90000000)}`,
          message: 'تم استلام إشعار webhook اختباري من لوحة مدير المنصة بنجاح',
          payload: { state: 'Delivered', simulatedBy: 'PlatformAdmin', storeId: selectedStore.id },
          timestamp: new Date().toISOString()
        })
      });
      notify('success', 'تم إرسال حدث Webhook اختباري إلى سجل المتجر السحابي.');
      await loadIntegrationLogs(selectedStore.id);
    } catch {
      notify('error', 'تعذر إرسال حدث المحاكاة إلى السجل السحابي.');
    }
  };

  const handleClearStoreWebhookLogs = async () => {
    if (!selectedStore) return;
    const ok = await inAppConfirm(
      `هل أنت متأكد من تفريغ وحذف جميع سجلات الـ Webhook السحابية الخاصة بمتجر "${selectedStore.name}"؟`,
      { title: 'تفريغ سجل الـ Webhooks السحابي (مدير المنصة)', type: 'danger', confirmText: 'تفريغ السجل نهائياً', cancelText: 'إلغاء' }
    );
    if (!ok) return;
    try {
      await cfFetch(`/api/db/webhook-logs?storeId=${encodeURIComponent(selectedStore.id)}`, { method: 'DELETE' });
      localStorage.removeItem(`store_webhook_delivery_logs_${selectedStore.id}`);
      setWebhookLogs([]);
      notify('success', 'تم تفريغ سجل الـ Webhooks السحابي للمتجر بنجاح.');
    } catch {
      notify('error', 'حدث خطأ أثناء تفريغ السجل السحابي.');
    }
  };

  useEffect(() => {
    if (subTab === 'integrations_logs' && selectedStore?.id) {
      void loadIntegrationLogs(selectedStore.id);
    }
  }, [subTab, selectedStore?.id, loadIntegrationLogs]);

  const handleToggleWebhookSubscription = async (subId: string) => {
    if (!selectedStore || !storeData) return;
    const nextWebhooks = (storeData.settings?.storeWebhooks || []).map(w =>
      w.id === subId ? { ...w, isActive: !w.isActive, failedAttempts: 0 } : w
    );
    await persistUpdatedStoreData(
      selectedStore,
      { ...storeData, settings: { ...storeData.settings, storeWebhooks: nextWebhooks } },
      'تم تحديث حالة الـ Webhook وتصفير عداد الأخطاء.'
    );
  };

  const handleToggleShippingCarrier = async (carrierId: string) => {
    if (!selectedStore || !storeData) return;
    const nextCarriers = (storeData.settings?.shippingIntegrations || []).map(c =>
      c.id === carrierId ? { ...c, isConnected: !c.isConnected } : c
    );
    await persistUpdatedStoreData(
      selectedStore,
      { ...storeData, settings: { ...storeData.settings, shippingIntegrations: nextCarriers } },
      'تم تحديث حالة ربط شركة الشحن.'
    );
  };

  const handleResetWhatsAppIntegration = async () => {
    if (!selectedStore || !storeData) return;
    const ok = await inAppConfirm(
      'سيتم إعادة ضبط حالة اتصال الواتساب لهذا المتجر (isActive=false, isConnected=false) ليتمكن العميل من إعادة الربط من جديد بدون أخطاء.',
      { title: 'إعادة ضبط ربط الواتساب', type: 'warning', confirmText: 'إعادة الضبط', cancelText: 'إلغاء' }
    );
    if (!ok) return;
    const currentWa = storeData.settings?.whatsappConfig;
    if (!currentWa) return;
    await persistUpdatedStoreData(
      selectedStore,
      {
        ...storeData,
        settings: {
          ...storeData.settings,
          whatsappConfig: {
            ...currentWa,
            isActive: false,
            isConnected: false,
            token: '',
            accessToken: ''
          }
        }
      },
      'تمت إعادة ضبط إعدادات الواتساب للمتجر بنجاح.'
    );
  };

  // ---------- Backup & Restore ----------
  const handleDownloadBackup = () => {
    if (!selectedStore || !storeData) return;
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      store: selectedStore,
      ownerPhone: selectedOwner?.phone,
      storeData
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${selectedStore.id}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notify('success', `تم تحميل النسخة الاحتياطية لمتجر "${selectedStore.name}".`);
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedStore) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const candidateData: StoreData | undefined = parsed?.storeData || (parsed?.settings && parsed?.orders ? parsed : undefined);
      if (!candidateData || !candidateData.settings) {
        notify('error', 'ملف النسخة الاحتياطية غير صالح أو لا يحتوي على بنية متجر صحيحة.');
        return;
      }

      const ok = await inAppConfirm(
        `سيتم استبدال بيانات متجر "${selectedStore.name}" بالنسخة الاحتياطية (${candidateData.orders?.length || 0} طلب، ${candidateData.settings?.products?.length || 0} منتج) وحفظها سحابياً على D1. هل أنت متأكد؟`,
        { title: 'استعادة نسخة احتياطية للمتجر', type: 'warning', confirmText: 'نعم، استعادة وحفظ', cancelText: 'إلغاء' }
      );
      if (!ok) return;

      await persistUpdatedStoreData(selectedStore, candidateData, 'تمت استعادة النسخة الاحتياطية ومزامنتها على Cloudflare D1 بنجاح.');
    } catch (err: any) {
      notify('error', `فشل قراءة ملف الاستعادة: ${err?.message || err}`);
    }
  };

  if (allStoreEntries.length === 0) {
    return (
      <div className="p-10 text-center bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
        <Wrench className="mx-auto text-slate-400" size={40} />
        <p className="font-black text-slate-700 dark:text-slate-200">لا توجد متاجر مسجلة في المنظومة بعد لفحصها.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-right" dir="rtl">
      {/* Header & Store Selector */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 md:p-6 border border-indigo-500/30 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <Wrench size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black flex items-center gap-2 flex-wrap">
                مركز الدعم الفني وحل المشاكل المتقدم
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  TECH SUPPORT
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                تشخيص وإصلاح جميع مشاكل العميل والمتجر (المخزون، الطلبات، المحفظة، الدومين، الموظفين وكلمات المرور، التكاملات) دون فقدان جلسة الإدارة.
              </p>
            </div>
          </div>

          {selectedStore && selectedOwner && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleForcePull}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all disabled:opacity-50"
              >
                <DownloadCloud size={14} className={busyAction === 'pull' ? 'animate-bounce' : ''} />
                <span>سحب من D1</span>
              </button>
              <button
                type="button"
                onClick={handleForcePush}
                disabled={busyAction !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all disabled:opacity-50"
              >
                <UploadCloud size={14} />
                <span>دفع إلى D1</span>
              </button>
              <button
                type="button"
                onClick={() => onImpersonate(selectedOwner, selectedStore.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg transition-all active:scale-95"
              >
                <LogIn size={15} />
                <span>دخول دعم فني للمتجر</span>
              </button>
            </div>
          )}
        </div>

        {/* Store Picker Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-4 border-t border-white/10">
          <div className="lg:col-span-5 relative">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={storeSearch}
              onChange={e => setStoreSearch(e.target.value)}
              placeholder="ابحث باسم المتجر، الدومين، اسم التاجر أو رقم الموبايل..."
              className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white placeholder:text-slate-400 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-400/50"
            />
          </div>

          <div className="lg:col-span-7 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            <select
              value={selectedStore?.id || ''}
              onChange={e => setSelectedStoreId(e.target.value)}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-400/50"
            >
              {filteredStoreEntries.map(({ store, owner }) => (
                <option key={store.id} value={store.id}>
                  {store.name} — ({owner.fullName} | {owner.phone}) [{store.id}]
                </option>
              ))}
            </select>

            {selectedStore && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] shrink-0">
                <Server size={14} className={d1Meta?.exists ? 'text-emerald-400' : 'text-amber-400'} />
                <span className="font-mono tabular-nums text-slate-200">
                  {isLoadingMeta
                    ? 'جاري الفحص...'
                    : d1Meta?.exists
                      ? `D1 v${d1Meta.version ?? 1}`
                      : 'غير متزامن على D1'}
                </span>
                {selectedOwner?.isBanned && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black">محظور</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Toast Notification */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in duration-200 ${
            statusNotice.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : statusNotice.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusNotice.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusNotice.message}</span>
          </div>
          <button type="button" onClick={() => setStatusNotice(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Support Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'diagnostics', label: 'التشخيص التلقائي وإصلاح المتجر', icon: <Activity size={15} /> },
          { id: 'account_employees', label: 'التاجر والموظفين وكلمات المرور', icon: <Users size={15} /> },
          { id: 'orders_finance', label: 'فحص الطلبات والمعاملات المالية', icon: <ShoppingCart size={15} /> },
          { id: 'integrations_logs', label: 'التكاملات، الـ Webhooks والواتساب', icon: <PlugZap size={15} /> },
          { id: 'backup_restore', label: 'النسخ الاحتياطي والاستعادة', icon: <FileJson size={15} /> }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as SupportSubTab)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black whitespace-nowrap shrink-0 transition-all border ${
              subTab === tab.id
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: Diagnostics & Auto-Fix */}
      {subTab === 'diagnostics' && selectedStore && (
        <div className="space-y-6">
          {/* Health Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Inventory & Warehouses Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <Package size={17} className="text-indigo-500" />
                    المخزون والمستودعات
                  </span>
                  {diagnostics.noWarehouses || diagnostics.brokenProductsCount > 0 || diagnostics.warehouseMismatchCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      يحتاج إصلاح
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      سليم
                    </span>
                  )}
                </div>
                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                  <li className="flex justify-between">
                    <span>عدد المنتجات:</span>
                    <span className="font-black tabular-nums">{storeData?.settings?.products?.length || 0}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>المستودعات المعرفة:</span>
                    <span className={`font-black tabular-nums ${diagnostics.noWarehouses ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {storeData?.settings?.warehouses?.length || 0}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>منتجات بأرقام/أسعار تالفة:</span>
                    <span className={`font-black tabular-nums ${diagnostics.brokenProductsCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {diagnostics.brokenProductsCount}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>عدم تطابق توزيع المخزون:</span>
                    <span className={`font-black tabular-nums ${diagnostics.warehouseMismatchCount > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {diagnostics.warehouseMismatchCount}
                    </span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={handleFixInventoryAndWarehouses}
                disabled={busyAction !== null || !storeData}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Sparkles size={14} />
                <span>إصلاح المخزون والمستودعات تلقائياً</span>
              </button>
            </div>

            {/* Orders Integrity Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <ShoppingCart size={17} className="text-sky-500" />
                    سلامة الطلبات والتواريخ
                  </span>
                  {diagnostics.corruptOrdersCount > 0 || diagnostics.duplicateOrderNumbers.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      ملاحظات ({diagnostics.corruptOrdersCount + diagnostics.duplicateOrderNumbers.length})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      سليم
                    </span>
                  )}
                </div>
                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                  <li className="flex justify-between">
                    <span>إجمالي الطلبات:</span>
                    <span className="font-black tabular-nums">{storeData?.orders?.length || 0}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>طلبات بتواريخ/أرقام غير قياسية:</span>
                    <span className={`font-black tabular-nums ${diagnostics.corruptOrdersCount > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {diagnostics.corruptOrdersCount}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>أرقام طلبات مكررة:</span>
                    <span className={`font-black tabular-nums ${diagnostics.duplicateOrderNumbers.length > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {diagnostics.duplicateOrderNumbers.length}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCleanAndFixOrders}
                  disabled={busyAction !== null || !storeData}
                  className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  <span>تنظيف وإصلاح الطلبات</span>
                </button>
                {diagnostics.duplicateOrderNumbers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveDuplicateOrders}
                    disabled={busyAction !== null}
                    className="px-3 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition-all"
                    title="حذف الطلبات المكررة"
                  >
                    إزالة التكرار
                  </button>
                )}
              </div>
            </div>

            {/* Wallet & Treasury Card */}
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm text-slate-800 dark:text-white flex items-center gap-2">
                    <WalletIcon size={17} className="text-emerald-500" />
                    تطابق المحفظة والخزينة
                  </span>
                  {diagnostics.walletMismatch || diagnostics.negativeTreasuryCount > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                      عدم تطابق
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      متطابق
                    </span>
                  )}
                </div>
                <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                  <li className="flex justify-between">
                    <span>الرصيد المسجل بالمحفظة:</span>
                    <span className="font-black tabular-nums">{diagnostics.walletActualBalance.toLocaleString('ar-EG')} ج.م</span>
                  </li>
                  <li className="flex justify-between">
                    <span>المحتسب من السجل المكتمل:</span>
                    <span className={`font-black tabular-nums ${diagnostics.walletMismatch ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {diagnostics.walletExpectedBalance.toLocaleString('ar-EG')} ج.م
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>حركات معلقة أكثر من ٤٨ ساعة:</span>
                    <span className={`font-black tabular-nums ${diagnostics.stalePendingTxCount > 0 ? 'text-amber-500' : 'text-slate-600 dark:text-slate-300'}`}>
                      {diagnostics.stalePendingTxCount}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>خزائن برصيد سالب:</span>
                    <span className={`font-black tabular-nums ${diagnostics.negativeTreasuryCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {diagnostics.negativeTreasuryCount}
                    </span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={handleRecalculateWallet}
                disabled={busyAction !== null || !storeData}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <ArrowLeftRight size={14} />
                <span>إعادة احتساب رصيد المحفظة من السجل</span>
              </button>
            </div>
          </div>

          {/* Domain & URL Troubleshooter + Cache Fixer */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <form
              onSubmit={handleSaveDomains}
              className="lg:col-span-7 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <Globe size={18} className="text-emerald-500" />
                  ضبط وإصلاح الدومين والرابط (Cloudflare D1 Domain Resolver)
                </h3>
                {diagnostics.domainIssues.length > 0 && (
                  <span className="text-[11px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-lg">
                    {diagnostics.domainIssues[0]}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">النطاق الفرعي (Subdomain):</label>
                  <input
                    type="text"
                    value={domainForm.subdomain}
                    onChange={e => setDomainForm(p => ({ ...p, subdomain: e.target.value }))}
                    placeholder="my-store"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-left dir-ltr outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">الدومين المخصص (Custom Domain):</label>
                  <input
                    type="text"
                    value={domainForm.customDomain}
                    onChange={e => setDomainForm(p => ({ ...p, customDomain: e.target.value }))}
                    placeholder="shop.example.com"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-left dir-ltr outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">رابط التطبيق المخصص (customAppDomain):</label>
                  <input
                    type="text"
                    value={domainForm.customAppDomain}
                    onChange={e => setDomainForm(p => ({ ...p, customAppDomain: e.target.value }))}
                    placeholder="https://shop.example.com"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-left dir-ltr outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">الرابط المحفوظ في ملف المتجر (URL):</label>
                  <input
                    type="text"
                    value={domainForm.url}
                    onChange={e => setDomainForm(p => ({ ...p, url: e.target.value }))}
                    placeholder="my-store.abdomedi.com"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-left dir-ltr outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>حفظ ومزامنة الدومين</span>
                </button>
              </div>
            </form>

            <div className="lg:col-span-5 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <Server size={18} className="text-indigo-500" />
                  فحص المزامنة وكاش المتصفح
                </h3>
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">معرف المتجر (Store ID):</span>
                    <span className="font-mono font-bold select-all">{selectedStore.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">نسخة قاعدة البيانات D1:</span>
                    <span className="font-mono font-black tabular-nums">
                      {d1Meta?.exists ? `v${d1Meta.version ?? 1}` : 'غير موجود'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">آخر تحديث سحابي:</span>
                    <span className="font-mono text-[11px] tabular-nums">
                      {d1Meta?.updatedAt ? new Date(d1Meta.updatedAt).toLocaleString('ar-EG') : 'غير متوفر'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">شركات شحن مفعلة / طرق دفع:</span>
                    <span className="font-bold tabular-nums">
                      {Object.values(storeData?.settings?.activeCompanies || {}).filter(Boolean).length} شحن / {(storeData?.settings?.paymentMethods || []).filter(m => m.active).length} دفع
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleClearLocalTombstones}
                  disabled={busyAction !== null}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-black flex items-center justify-center gap-2 transition-all"
                >
                  <RotateCcw size={14} />
                  <span>مسح قائمة الحذف العالقة محلياً وسحب البيانات من جديد</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Merchant Account, Passwords, Ownership Transfer & Employees */}
      {subTab === 'account_employees' && selectedStore && selectedOwner && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Merchant Account Edit & Password Reset */}
            <div className="lg:col-span-6 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
              <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                <UserCog size={18} className="text-indigo-500" />
                بيانات حساب التاجر المالك ({selectedOwner.phone})
              </h3>

              <form onSubmit={handleSaveOwnerAccount} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">الاسم الكامل:</label>
                  <input
                    type="text"
                    value={ownerForm.fullName}
                    onChange={e => setOwnerForm(p => ({ ...p, fullName: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">البريد الإلكتروني (لاستلام رموز OTP):</label>
                  <input
                    type="email"
                    value={ownerForm.email}
                    onChange={e => setOwnerForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-left dir-ltr outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-300 block">المتجر الافتراضي عند الدخول:</label>
                  <select
                    value={ownerForm.defaultStoreId}
                    onChange={e => setOwnerForm(p => ({ ...p, defaultStoreId: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">-- بدون متجر افتراضي (يفتح قائمة المتاجر) --</option>
                    {(selectedOwner.stores || []).map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={ownerForm.autoLaunchDefaultStore}
                      onChange={e => setOwnerForm(p => ({ ...p, autoLaunchDefaultStore: e.target.checked }))}
                      className="rounded text-indigo-600"
                    />
                    <span>دخول تلقائي للمتجر الافتراضي</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-rose-600 dark:text-rose-400">
                    <input
                      type="checkbox"
                      checked={ownerForm.isBanned}
                      onChange={e => setOwnerForm(p => ({ ...p, isBanned: e.target.checked }))}
                      className="rounded text-rose-600"
                    />
                    <span>تجميد / حظر الحساب</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Save size={15} />
                  <span>حفظ بيانات الحساب</span>
                </button>
              </form>
            </div>

            {/* Password Reset & Ownership Transfer */}
            <div className="lg:col-span-6 space-y-5">
              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <KeyRound size={18} className="text-amber-500" />
                  إعادة تعيين كلمة مرور المالك مباشرة (Admin Override)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  يُحدث كلمة المرور مباشرة في قاعدة بيانات Cloudflare D1 Auth برقم الهاتف <span className="font-mono font-bold">{selectedOwner.phone}</span> دون الحاجة لكلمة المرور القديمة.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOwnerPassword}
                    onChange={e => setNewOwnerPassword(e.target.value)}
                    placeholder="أدخل كلمة المرور الجديدة (6 أحرف على الأقل)"
                    className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={handleResetOwnerPassword}
                    disabled={busyAction !== null}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shrink-0 transition-all disabled:opacity-50"
                  >
                    تغيير كلمة المرور
                  </button>
                </div>
              </div>

              <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <ArrowLeftRight size={18} className="text-purple-500" />
                  نقل ملكية المتجر إلى تاجر آخر
                </h3>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={transferPhone}
                    onChange={e => setTransferPhone(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">-- اختر الحساب المالك الجديد --</option>
                    {users
                      .filter(u => !u.isAdmin && u.phone !== selectedOwner.phone)
                      .map(u => (
                        <option key={u.phone} value={u.phone}>
                          {u.fullName} ({u.phone})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTransferOwnership}
                    disabled={busyAction !== null || !transferPhone}
                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shrink-0 transition-all disabled:opacity-50"
                  >
                    نقل الملكية
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Store Employees Troubleshooter */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-indigo-500" />
                موظفو المتجر وصلاحيات الدخول ({storeData?.settings?.employees?.length || 0})
              </h3>
            </div>

            {/* Quick Add Active Employee */}
            <form
              onSubmit={handleAddSupportEmployee}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end text-xs"
            >
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">اسم الموظف</label>
                <input
                  type="text"
                  value={newEmpForm.name}
                  onChange={e => setNewEmpForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="الاسم"
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">رقم الهاتف (المعرف)</label>
                <input
                  type="tel"
                  value={newEmpForm.phone}
                  onChange={e => setNewEmpForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="010..."
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={newEmpForm.email}
                  onChange={e => setNewEmpForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="اختياري"
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">كلمة المرور (اختياري)</label>
                <input
                  type="text"
                  value={newEmpForm.password}
                  onChange={e => setNewEmpForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="6+ أحرف"
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">الدور</label>
                <input
                  type="text"
                  value={newEmpForm.role}
                  onChange={e => setNewEmpForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>
              <button
                type="submit"
                disabled={busyAction !== null}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-1.5 transition-all"
              >
                <UserPlus size={14} />
                <span>إضافة وتفعيل</span>
              </button>
            </form>

            {/* Employees List */}
            {(storeData?.settings?.employees || []).length === 0 ? (
              <p className="text-center py-6 text-xs font-bold text-slate-400">لا يوجد موظفون مضافون في هذا المتجر.</p>
            ) : (
              <div className="space-y-3">
                {(storeData?.settings?.employees || []).map(emp => {
                  const isExpanded = expandedEmpId === emp.id;
                  return (
                    <div key={emp.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 space-y-3">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-xs shrink-0">
                            {(emp.name || 'EM').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-800 dark:text-white">{emp.name}</p>
                            <p className="text-[11px] font-mono text-slate-500">
                              {emp.phone || emp.id} {emp.email ? `| ${emp.email}` : ''} ({emp.permissions?.length || 0} صلاحية)
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <select
                            value={emp.status || 'active'}
                            onChange={e =>
                              handleUpdateEmployee(
                                emp.id,
                                cur => ({ ...cur, status: e.target.value as Employee['status'] }),
                                `تم تحديث حالة الموظف "${emp.name}".`
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                          >
                            <option value="active">نشط (active)</option>
                            <option value="pending">معلق (pending)</option>
                            <option value="invited">مدعو (invited)</option>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateEmployee(
                                emp.id,
                                cur => ({ ...cur, permissions: Object.keys(PERMISSIONS) as Permission[] }),
                                `تم منح كافة الصلاحيات للموظف "${emp.name}".`
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black"
                          >
                            منح كل الصلاحيات
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold"
                          >
                            {isExpanded ? 'إخفاء التفاصيل' : 'الصلاحيات وكلمة المرور'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveEmployee(emp)}
                            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50"
                            title="حذف الموظف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-4">
                          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            <input
                              type="text"
                              value={empResetTarget.id === emp.id ? empResetTarget.pw : ''}
                              onChange={e => setEmpResetTarget({ id: emp.id, pw: e.target.value })}
                              placeholder="كلمة مرور جديدة للموظف (6+ أحرف)"
                              className="flex-1 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono"
                            />
                            <button
                              type="button"
                              onClick={() => handleResetEmployeePassword(emp)}
                              disabled={busyAction !== null || empResetTarget.id !== emp.id}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black shrink-0 disabled:opacity-50"
                            >
                              تعيين كلمة مرور الموظف
                            </button>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                            {QUICK_PERMISSION_KEYS.map(perm => {
                              const checked = (emp.permissions || []).includes(perm.key);
                              return (
                                <label
                                  key={perm.key}
                                  className={`flex items-center gap-1.5 p-2 rounded-xl border text-[11px] font-bold cursor-pointer ${
                                    checked
                                      ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={e =>
                                      handleUpdateEmployee(
                                        emp.id,
                                        cur => ({
                                          ...cur,
                                          permissions: e.target.checked
                                            ? Array.from(new Set([...(cur.permissions || []), perm.key]))
                                            : (cur.permissions || []).filter(p => p !== perm.key)
                                        }),
                                        `تم تحديث صلاحيات الموظف "${emp.name}".`
                                      )
                                    }
                                    className="rounded text-indigo-600"
                                  />
                                  <span className="truncate">{perm.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Orders & Finance Troubleshooter */}
      {subTab === 'orders_finance' && selectedStore && (
        <div className="space-y-6">
          {/* Orders Search & Force Edit */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                <ShoppingCart size={18} className="text-sky-500" />
                إصلاح حالة الطلبات والعلامات المحاسبية ({storeData?.orders?.length || 0} إجمالي)
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="بحث برقم الطلب، العميل، الهاتف..."
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                />
                <select
                  value={orderStatusFilter}
                  onChange={e => setOrderStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none"
                >
                  <option value="all">كل الحالات</option>
                  {VALID_ORDER_STATUSES.map(st => (
                    <option key={st.value} value={st.value}>
                      {st.label}
                    </option>
                  ))}
                </select>
                {diagnostics.duplicateOrderNumbers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRemoveDuplicateOrders}
                    className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black"
                  >
                    حذف المكرر ({diagnostics.duplicateOrderNumbers.length})
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">رقم الطلب</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">تغيير قسري للحالة</th>
                    <th className="p-3">العلامات المحاسبية والمخزون</th>
                    <th className="p-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد طلبات مطابقة للبحث الحالي.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(order => {
                      const netTotal = (Number(order.productPrice) || 0) + (Number(order.shippingFee) || 0) - (Number(order.discount) || 0);
                      return (
                        <tr key={order.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-mono font-black tabular-nums">
                            #{order.orderNumber}
                            <div className="text-[10px] text-slate-400 font-normal">{order.id}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-800 dark:text-white">{order.customerName}</div>
                            <div className="text-[10px] font-mono tabular-nums text-slate-400">{order.customerPhone}</div>
                          </td>
                          <td className="p-3 font-black tabular-nums text-emerald-600 dark:text-emerald-400">
                            {netTotal.toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="p-3">
                            <select
                              value={order.status}
                              onChange={e =>
                                handlePatchOrder(
                                  order.id,
                                  { status: e.target.value as OrderStatus, updatedAt: new Date().toISOString() },
                                  `تم تغيير حالة الطلب #${order.orderNumber} إلى "${e.target.value}".`
                                )
                              }
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                            >
                              {VALID_ORDER_STATUSES.map(st => (
                                <option key={st.value} value={st.value}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { field: 'stockDeducted' as const, label: 'خصم مخزون' },
                                { field: 'collectionProcessed' as const, label: 'تحصيل مالي' },
                                { field: 'shippingAndInsuranceDeducted' as const, label: 'خصم شحن' },
                                { field: 'returnFeeDeducted' as const, label: 'خصم مرتجع' }
                              ].map(flag => {
                                const active = Boolean(order[flag.field]);
                                return (
                                  <button
                                    key={flag.field}
                                    type="button"
                                    onClick={() =>
                                      handlePatchOrder(
                                        order.id,
                                        { [flag.field]: !active },
                                        `تم تعديل علامة "${flag.label}" للطلب #${order.orderNumber}.`
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${
                                      active
                                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                                    }`}
                                  >
                                    {flag.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteOrderSupport(order)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50"
                              title="حذف الطلب"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Wallet Transactions Troubleshooter */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                <WalletIcon size={18} className="text-emerald-500" />
                سجل حركات المحفظة العالقة (آخر ٢٥ حركة)
              </h3>
              <span className="text-xs font-black tabular-nums text-indigo-600 dark:text-indigo-400">
                الرصيد الحالي: {(storeData?.wallet?.balance || 0).toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold">
                  <tr>
                    <th className="p-3">المعرف</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الملاحظة</th>
                    <th className="p-3">تعديل الحالة</th>
                    <th className="p-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(storeData?.wallet?.transactions || []).slice(0, 25).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد معاملات مسجلة في محفظة المتجر.
                      </td>
                    </tr>
                  ) : (
                    (storeData?.wallet?.transactions || []).slice(0, 25).map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-bold tabular-nums">{tx.id}</td>
                        <td className="p-3">
                          <span className={`font-black ${tx.type === 'إيداع' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-3 font-black tabular-nums">{Number(tx.amount || 0).toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 max-w-xs truncate" title={tx.note}>
                          {tx.note || '—'}
                        </td>
                        <td className="p-3">
                          <select
                            value={tx.status}
                            onChange={e => handleUpdateWalletTxStatus(tx.id, e.target.value as Transaction['status'])}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                          >
                            <option value="completed">مكتملة (completed)</option>
                            <option value="pending">معلقة (pending)</option>
                            <option value="cancelled">ملغاة (cancelled)</option>
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteWalletTx(tx)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin-Only: Hidden Wallet Amount & Apparent Closing Difference Controls */}
          <div className="p-6 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-amber-600" />
                  تحكم مدير المنصة: المبلغ المخفي بالمحفظة وفرق التقفيل التلقائي
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  تم إخفاء هذه الإعدادات من لوحة التاجر لمنع التلاعب بالرصيد الظاهري للمحفظة — التحكم متاح هنا لمدير المنصة فقط.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[11px] font-black">
                صلاحية حصرية لمدير المنصة
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <label className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-white">تفعيل خصم مبلغ مخفي</p>
                  <p className="text-[10px] text-slate-500">يخصم ظاهرياً من الرصيد المعروض للتاجر</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(storeData?.settings?.enableHiddenWalletAmount)}
                  onChange={e => handleUpdateHiddenWalletSettings({ enableHiddenWalletAmount: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>

              <label className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-white">فرق التقفيل التلقائي</p>
                  <p className="text-[10px] text-slate-500">مطابقة الفارق مع إجمالي تحصيلات الأوردرات</p>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(storeData?.settings?.enableAutoClosingDifference)}
                  onChange={e => handleUpdateHiddenWalletSettings({ enableAutoClosingDifference: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600"
                />
              </label>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-black text-slate-500 mb-1">قيمة المبلغ المخفي اليدوي (ج.م)</label>
                <input
                  type="number"
                  defaultValue={Number(storeData?.settings?.hiddenWalletAmount || 0)}
                  onBlur={e => handleUpdateHiddenWalletSettings({ hiddenWalletAmount: Number(e.target.value || 0) })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-black tabular-nums"
                />
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <label className="block text-[11px] font-black text-slate-500 mb-1">مسمى البند (يظهر بالتسوية)</label>
                <input
                  type="text"
                  defaultValue={storeData?.settings?.hiddenWalletAmountLabel || 'مبلغ مخفي / فرق تقفيل'}
                  onBlur={e => handleUpdateHiddenWalletSettings({ hiddenWalletAmountLabel: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
            </div>
          </div>

          {/* Admin-Only: Treasury Ledger Transactions & Reversal */}
          <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div>
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <ShieldAlert size={18} className="text-emerald-600" />
                  دفتر الأستاذ العام والخزينة (حذف القيود وعكس الأرصدة — مدير المنصة)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  قيود الخزينة محمية من الحذف في واجهة التاجر. يمكنك من هنا حذف أي قيد خاطئ مع عكس أثره المالي تلقائياً على الخزائن والمحفظة.
                </p>
              </div>
              <span className="text-xs font-black text-slate-500 tabular-nums">
                إجمالي القيود: {(storeData?.treasury?.transactions || []).length}
              </span>
            </div>

            <div className="overflow-x-auto max-h-80 border border-slate-100 dark:border-slate-800 rounded-xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-black sticky top-0">
                  <tr>
                    <th className="p-3">رقم القيد</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">البيان / الوصف</th>
                    <th className="p-3 text-center">حذف وعكس الأثر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(storeData?.treasury?.transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                        لا توجد قيود مسجلة في دفتر الأستاذ لهذا المتجر.
                      </td>
                    </tr>
                  ) : (
                    (storeData?.treasury?.transactions || []).slice(0, 40).map((tx: any) => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-bold tabular-nums">{tx.id}</td>
                        <td className="p-3 text-slate-500 tabular-nums">
                          {tx.date ? new Date(tx.date).toLocaleDateString('ar-EG') : '—'}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold ${
                              tx.type === 'in'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                : tx.type === 'out'
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                            }`}
                          >
                            {tx.type === 'in' ? 'قبض / إيداع' : tx.type === 'out' ? 'صرف / سحب' : 'تحويل داخلي'}
                          </span>
                        </td>
                        <td className="p-3 font-black tabular-nums">
                          {Number(tx.amount || 0).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3 max-w-xs truncate" title={tx.description}>
                          {tx.description || '—'}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteTreasuryTx(tx)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 transition-all"
                            title="حذف القيد وعكس الأثر المالي"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Integrations, Webhooks, WhatsApp & Logs */}
      {subTab === 'integrations_logs' && selectedStore && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Integrations Status & Emergency Resets */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <PlugZap size={18} className="text-indigo-500" />
                  حالة التكاملات والربط البرمجي
                </h3>
                <button
                  type="button"
                  onClick={() => loadIntegrationLogs(selectedStore.id)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCw size={13} className={isLoadingLogs ? 'animate-spin' : ''} />
                  <span>تحديث السجلات</span>
                </button>
              </div>

              {/* WhatsApp Status Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-black text-sm flex items-center gap-2">
                    <MessageSquare size={15} className="text-emerald-500" />
                    ربط الواتساب ({storeData?.settings?.whatsappConfig?.providerType || 'غير مفعل'})
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    الحالة: {storeData?.settings?.whatsappConfig?.isActive ? 'نشط' : 'متوقف'} | متصل:{' '}
                    {storeData?.settings?.whatsappConfig?.isConnected ? 'نعم' : 'لا'}
                  </p>
                </div>
                {storeData?.settings?.whatsappConfig && (
                  <button
                    type="button"
                    onClick={handleResetWhatsAppIntegration}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-black"
                  >
                    إعادة ضبط الربط والتوكن
                  </button>
                )}
              </div>

              {/* Shipping Integrations */}
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-500">ربط شركات الشحن API:</p>
                {(storeData?.settings?.shippingIntegrations || []).length === 0 ? (
                  <p className="text-xs text-slate-400">لا توجد شركات شحن مربوطة عبر API.</p>
                ) : (
                  (storeData?.settings?.shippingIntegrations || []).map(carrier => (
                    <div
                      key={carrier.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-black uppercase">{carrier.provider}</span>
                        <span className="text-slate-400 mr-2 font-mono">{carrier.accountNumber || carrier.id}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleShippingCarrier(carrier.id)}
                        className={`px-3 py-1 rounded-lg font-black ${
                          carrier.isConnected
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {carrier.isConnected ? 'متصل — إيقاف' : 'متوقف — تفعيل'}
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Webhooks */}
              <div className="space-y-2">
                <p className="text-xs font-black text-slate-500">اشتراكات الـ Webhooks:</p>
                {(storeData?.settings?.storeWebhooks || []).length === 0 ? (
                  <p className="text-xs text-slate-400">لا توجد Webhooks مضافة.</p>
                ) : (
                  (storeData?.settings?.storeWebhooks || []).map(wh => (
                    <div
                      key={wh.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-black truncate">{wh.name || wh.event}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate dir-ltr">{wh.url}</p>
                        {wh.failedAttempts ? (
                          <span className="text-[10px] text-rose-500 font-bold">محاولات فاشلة: {wh.failedAttempts}</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleWebhookSubscription(wh.id)}
                        className={`px-3 py-1 rounded-lg font-black shrink-0 ${
                          wh.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        }`}
                      >
                        {wh.isActive ? 'نشط' : 'معطل — إعادة تفعيل'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Activity & Webhook Logs Viewer */}
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                  <Webhook size={18} className="text-purple-500" />
                  سجلات الأخطاء والـ Webhook وآخر الأنشطة
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSimulateStoreWebhook}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black transition-all"
                  >
                    محاكاة Webhook اختباري
                  </button>
                  <button
                    type="button"
                    onClick={handleClearStoreWebhookLogs}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-black transition-all"
                  >
                    تفريغ السجل السحابي
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                <p className="text-xs font-black text-slate-500">سجل إرسال الـ Webhooks والواتساب ({webhookLogs.length}):</p>
                {webhookLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                    لا توجد سجلات أخطاء حديثة مسجلة على الخادم أو المتصفح.
                  </p>
                ) : (
                  webhookLogs.map((log, i) => (
                    <div key={log.id || i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1">
                      <div className="flex justify-between font-bold">
                        <span>{log.event || log.type || 'Webhook'}</span>
                        <span className={log.success === false || (log.statusCode && log.statusCode >= 400) ? 'text-rose-600' : 'text-emerald-600'}>
                          {log.statusCode || log.status || (log.success === false ? 'FAILED' : 'OK')}
                        </span>
                      </div>
                      <p className="text-slate-500 truncate">{log.message || log.error || log.payloadPreview || JSON.stringify(log)}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                <p className="text-xs font-black text-slate-500">
                  سجل نشاط المتجر ({storeData?.settings?.activityLogs?.length || 0}) | تذاكر الصيانة ({maintenanceTickets.length}):
                </p>
                {(storeData?.settings?.activityLogs || []).slice(0, 15).map((act, idx) => (
                  <div key={act.id || idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-[11px] flex justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-black text-slate-700 dark:text-slate-200">{act.action}</span>
                      <span className="text-slate-500 mr-1.5">{act.details}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">{act.date}</span>
                  </div>
                ))}
                {(storeData?.settings?.activityLogs || []).length === 0 && (
                  <p className="text-xs text-slate-400 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30">
                    لا توجد سجلات نشاط مسجلة داخل المتجر.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Full Store Backup & Restore */}
      {subTab === 'backup_restore' && selectedStore && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-black text-base text-slate-800 dark:text-white flex items-center gap-2">
                <FileJson size={18} className="text-indigo-500" />
                النسخ الاحتياطي والاستعادة الكاملة لمتجر: {selectedStore.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                احفظ نسخة كاملة قبل أي تدخل جراحي في البيانات، أو استعد نسخة JSON سابقة وارفعها مباشرة إلى Cloudflare D1.
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleDownloadBackup}
                disabled={!storeData}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <DownloadCloud size={15} />
                <span>تحميل نسخة احتياطية (JSON)</span>
              </button>
              <label className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-2 transition-all cursor-pointer">
                <UploadCloud size={15} />
                <span>استعادة من ملف JSON</span>
                <input type="file" accept=".json,application/json" onChange={handleRestoreBackupFile} className="hidden" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'الطلبات', count: storeData?.orders?.length || 0 },
              { label: 'المنتجات', count: storeData?.settings?.products?.length || 0 },
              { label: 'العملاء', count: storeData?.customers?.length || 0 },
              { label: 'الموظفين', count: storeData?.settings?.employees?.length || 0 },
              { label: 'الموردين / الموكلين', count: storeData?.settings?.suppliers?.length || 0 },
              { label: 'حسابات الخزينة', count: storeData?.treasury?.accounts?.length || 0 },
              { label: 'حركات المحفظة', count: storeData?.wallet?.transactions?.length || 0 },
              { label: 'السلات المتروكة', count: storeData?.settings?.abandonedCarts?.length || 0 },
              { label: 'التقييمات', count: storeData?.settings?.reviews?.length || 0 },
              { label: 'الشركاء', count: storeData?.settings?.partners?.length || 0 }
            ].map(item => (
              <div
                key={item.label}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-center"
              >
                <span className="text-[11px] font-bold text-slate-500 block">{item.label}</span>
                <span className="text-xl font-black tabular-nums text-slate-900 dark:text-white mt-1 block">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSupportCenter;
