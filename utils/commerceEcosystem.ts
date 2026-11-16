import { useState, useEffect, useCallback } from 'react';
import {
  CommerceBillingCycle,
  CommerceModuleDefinition,
  CommerceModuleId,
  CommercePlanDefinition,
  CommercePlanId,
  CustomPlanOverride,
  Order,
  PlatformCommercialCatalog,
  QuotaWalletTransaction,
  Settings,
  StoreCommerceState,
  StoreData,
  StoreVerificationDocType,
  User,
  VerificationBadgeTier
} from '../types';
import { cfFetch } from '../services/cloudflareClient';
import * as db from '../services/databaseService';

export const COMMERCE_CATALOG_STORAGE_KEY = 'platform_commerce_catalog_v1';
export const COMMERCE_CATALOG_EVENT = 'platform-commerce-catalog-updated';

export const BILLING_CYCLE_META: Record<
  CommerceBillingCycle,
  { labelAr: string; months: number; days: number }
> = {
  monthly: { labelAr: 'شهري', months: 1, days: 30 },
  quarterly: { labelAr: '3 شهور', months: 3, days: 90 },
  semi_annual: { labelAr: '6 شهور', months: 6, days: 180 },
  annual: { labelAr: 'سنوي', months: 12, days: 365 }
};

export const DEFAULT_PLATFORM_COMMERCIAL_CATALOG: PlatformCommercialCatalog = {
  plans: [
    {
      id: 'pay_as_you_sell',
      nameAr: 'الانطلاق الحر (ادفع عند التسليم)',
      audienceTagAr: 'للمبتدئين وتجربة السوق بدون مخاطرة',
      descriptionAr:
        'اشتراك شهري 0 ج.م — لا تدفع على الطلبات الجديدة أو الملغاة أو المرتجعة؛ يُخصم 5 ج.م من محفظة الكوتا فقط عند تسليم وتحصيل الأوردر بنجاح.',
      monthlyPrice: 0,
      monthlyOrdersLimit: null,
      perDeliveredOrderFee: 5,
      maxEmployees: 2,
      maxWarehouses: 1,
      maxStoresInPool: 1,
      includedModules: [],
      isPopular: false
    },
    {
      id: 'free',
      nameAr: 'الباقة المجانية',
      audienceTagAr: 'للمتاجر الناشئة والاختبار الأولي',
      descriptionAr:
        'ابدأ متجرك الإلكتروني مجاناً مع إدارة المنتجات والطلبات الأساسية وكشف الحساب حتى 30 أوردر مؤكد شهرياً.',
      monthlyPrice: 0,
      monthlyOrdersLimit: 30,
      perDeliveredOrderFee: 0,
      maxEmployees: 1,
      maxWarehouses: 1,
      maxStoresInPool: 1,
      includedModules: []
    },
    {
      id: 'growth',
      nameAr: 'باقة النمو (Growth)',
      audienceTagAr: 'للمتاجر الصاعدة ذات المبيعات اليومية',
      descriptionAr:
        'سعة أوردرات مريحة حتى 250 أوردر مؤكد شهرياً مع دومين مخصص مجاني وفريق عمل أوسع وتقارير مالية متكاملة.',
      monthlyPrice: 590,
      monthlyOrdersLimit: 250,
      perDeliveredOrderFee: 0,
      maxEmployees: 5,
      maxWarehouses: 2,
      maxStoresInPool: 1,
      includedModules: ['custom_domain']
    },
    {
      id: 'pro_business',
      nameAr: 'باقة المحترفين (Pro Business)',
      audienceTagAr: 'للعلامات التجارية والمحلات النشطة',
      descriptionAr:
        'تشمل الكاشير POS والمحاسبة المتقدمة والواتساب والربط البرمجي API/Webhooks مجاناً حتى 1,000 أوردر شهرياً.',
      monthlyPrice: 1490,
      monthlyOrdersLimit: 1000,
      perDeliveredOrderFee: 0,
      maxEmployees: 15,
      maxWarehouses: 5,
      maxStoresInPool: 2,
      includedModules: ['pos', 'advanced_finance', 'whatsapp_api', 'api_webhooks', 'custom_domain'],
      bonusWhatsappMessages: 200,
      isPopular: true
    },
    {
      id: 'enterprise',
      nameAr: 'باقة الشركات (Enterprise)',
      audienceTagAr: 'للمتاجر الكبرى والبراندات المتعددة',
      descriptionAr:
        'أوردرات وموظفون ومخازن غير محدودة + مجمّع حتى 5 متاجر في كوتا واحدة + جميع الموديولات مفعّلة مع رصيد رسائل وAI شهري.',
      monthlyPrice: 2990,
      monthlyOrdersLimit: null,
      perDeliveredOrderFee: 0,
      maxEmployees: null,
      maxWarehouses: null,
      maxStoresInPool: 5,
      includedModules: [
        'pos',
        'agency_hub',
        'advanced_finance',
        'whatsapp_api',
        'ai_assistant',
        'api_webhooks',
        'dropshipping',
        'custom_domain'
      ],
      bonusWhatsappMessages: 300,
      bonusAiCredits: 150
    },
    {
      id: 'agency_os',
      nameAr: 'باقة الوكالات (Agency OS)',
      audienceTagAr: 'لشركات التسويق وإدارة حسابات التجار',
      descriptionAr:
        'إدارة حتى 10 متاجر لعملائك من لوحة واحدة مع منظومة الموكلين والربط البرمجي وعمولة إحالة مضاعفة.',
      monthlyPrice: 1990,
      monthlyOrdersLimit: 1500,
      perDeliveredOrderFee: 0,
      maxEmployees: null,
      maxWarehouses: null,
      maxStoresInPool: 10,
      includedModules: ['agency_hub', 'advanced_finance', 'whatsapp_api', 'api_webhooks', 'custom_domain'],
      bonusWhatsappMessages: 250,
      affiliateMultiplier: 1.5
    },
    {
      id: 'wholesale_hub',
      nameAr: 'باقة الموردين (Wholesale Hub)',
      audienceTagAr: 'للمصانع وتجار الجملة والدروبشيبينغ',
      descriptionAr:
        'اعرض منتجاتك لشبكة التجار وأدر طلبات التوريد ومحفظة التوريد والتسويات مع الموزعين في مكان واحد.',
      monthlyPrice: 490,
      monthlyOrdersLimit: 500,
      perDeliveredOrderFee: 0,
      maxEmployees: 5,
      maxWarehouses: 5,
      maxStoresInPool: 1,
      includedModules: ['dropshipping', 'agency_hub']
    }
  ],
  modules: [
    {
      id: 'pos',
      nameAr: 'نقطة البيع والكاشير (POS)',
      descriptionAr: 'كاشير البيع المباشر، فواتير نقاط البيع، وربط التحصيل بالخزائن والمخزون.',
      monthlyPrice: 200,
      routePaths: ['/pos']
    },
    {
      id: 'agency_hub',
      nameAr: 'منظومة الموكلين والشركاء',
      descriptionAr: 'بوابة التجار الموكلين، كشوف التسوية الآلية، وإدارة أرباح الشركاء والمسوقين.',
      monthlyPrice: 350,
      routePaths: ['/agency-hub', '/partners']
    },
    {
      id: 'advanced_finance',
      nameAr: 'المحاسبة المتقدمة والخزائن',
      descriptionAr: 'تعدد الخزائن، كشوف المرتبات والأجور، العهد النقدية، ومطابقة إكسيل لشركات الشحن.',
      monthlyPrice: 300,
      routePaths: ['/treasury', '/employees-payroll', '/reconciliation', '/cash-management']
    },
    {
      id: 'whatsapp_api',
      nameAr: 'واتساب الأعمال والأتمتة',
      descriptionAr: 'شات العملاء المباشر، إشعارات الحالة الآلية، وقوالب التأكيد (يشمل 200 رسالة شهرياً).',
      monthlyPrice: 250,
      includedWhatsappMessages: 200,
      routePaths: ['/whatsapp']
    },
    {
      id: 'ai_assistant',
      nameAr: 'مستشار الذكاء الاصطناعي (AI)',
      descriptionAr: 'تحليل المبيعات والربحية، واقتراح تحسينات المتجر والمنتجات (يشمل 100 نقطة شهرياً).',
      monthlyPrice: 150,
      includedAiCredits: 100,
      routePaths: ['/ai-assistant']
    },
    {
      id: 'api_webhooks',
      nameAr: 'الربط البرمجي والمطورين (API & Apps)',
      descriptionAr: 'مفاتيح API، مراقب Webhooks، ومزامنة المتاجر الخارجية (سلة / زد / شوبيفاي / ويلت).',
      monthlyPrice: 250,
      routePaths: ['/apps', '/settings/developer', '/webhook-monitor', '/api-docs']
    },
    {
      id: 'dropshipping',
      nameAr: 'الدروبشيبينغ وشبكة الموردين',
      descriptionAr: 'إدارة الموردين والمخازن المباشرة وطلبات الدروبشيبينغ ومرتجعات المشتريات.',
      monthlyPrice: 200,
      routePaths: ['/dropshipping', '/suppliers', '/purchase-returns']
    },
    {
      id: 'custom_domain',
      nameAr: 'النطاق المخصص والدومين (Domain)',
      descriptionAr: 'ربط دومينك المستقل مع شهادة SSL تلقائية وهوية متجر احترافية.',
      monthlyPrice: 100,
      routePaths: ['/domain']
    }
  ],
  capacityPricing: {
    extraEmployeeMonthly: 50,
    extraWarehouseMonthly: 75,
    extraStoreSlotMonthly: 150
  },
  rolloverOrderPacks: [
    { id: 'pack_100', nameAr: 'حزمة البداية (+100 أوردر)', ordersCount: 100, price: 250 },
    { id: 'pack_300', nameAr: 'حزمة النمو (+300 أوردر)', ordersCount: 300, price: 600 },
    { id: 'pack_1000', nameAr: 'حزمة المواسم (+1,000 أوردر)', ordersCount: 1000, price: 1500 },
    { id: 'pack_3000', nameAr: 'حزمة البراندات (+3,000 أوردر)', ordersCount: 3000, price: 3600 }
  ],
  creditsPacks: [
    { id: 'wa_500', kind: 'whatsapp', nameAr: 'حزمة 500 رسالة واتساب', units: 500, price: 150 },
    { id: 'wa_2000', kind: 'whatsapp', nameAr: 'حزمة 2,000 رسالة واتساب', units: 2000, price: 500 },
    { id: 'wa_10000', kind: 'whatsapp', nameAr: 'حزمة 10,000 رسالة واتساب', units: 10000, price: 2000 },
    { id: 'ai_100', kind: 'ai', nameAr: 'حزمة 100 نقطة ذكاء اصطناعي', units: 100, price: 100 },
    { id: 'ai_500', kind: 'ai', nameAr: 'حزمة 500 نقطة ذكاء اصطناعي', units: 500, price: 350 }
  ],
  cycleDiscounts: {
    monthly: 0,
    quarterly: 10,
    semi_annual: 20,
    annual: 30
  },
  internalTransferCashbackPercent: 10,
  bundleDiscountThreshold: 3,
  bundleDiscountPercent: 20,
  affiliateCommissionPercent: 15,
  fallbackPerOrderFee: 3
};

export const normalizeCommercialCatalog = (raw?: Partial<PlatformCommercialCatalog> | null): PlatformCommercialCatalog => {
  if (!raw || typeof raw !== 'object') return DEFAULT_PLATFORM_COMMERCIAL_CATALOG;
  return {
    plans: Array.isArray(raw.plans) && raw.plans.length > 0 ? raw.plans : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.plans,
    modules: Array.isArray(raw.modules) && raw.modules.length > 0 ? raw.modules : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.modules,
    capacityPricing: {
      ...DEFAULT_PLATFORM_COMMERCIAL_CATALOG.capacityPricing,
      ...(raw.capacityPricing || {})
    },
    rolloverOrderPacks:
      Array.isArray(raw.rolloverOrderPacks) && raw.rolloverOrderPacks.length > 0
        ? raw.rolloverOrderPacks
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.rolloverOrderPacks,
    creditsPacks:
      Array.isArray(raw.creditsPacks) && raw.creditsPacks.length > 0
        ? raw.creditsPacks
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.creditsPacks,
    cycleDiscounts: {
      ...DEFAULT_PLATFORM_COMMERCIAL_CATALOG.cycleDiscounts,
      ...(raw.cycleDiscounts || {})
    },
    internalTransferCashbackPercent:
      typeof raw.internalTransferCashbackPercent === 'number'
        ? raw.internalTransferCashbackPercent
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.internalTransferCashbackPercent,
    bundleDiscountThreshold:
      typeof raw.bundleDiscountThreshold === 'number'
        ? raw.bundleDiscountThreshold
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.bundleDiscountThreshold,
    bundleDiscountPercent:
      typeof raw.bundleDiscountPercent === 'number'
        ? raw.bundleDiscountPercent
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.bundleDiscountPercent,
    affiliateCommissionPercent:
      typeof raw.affiliateCommissionPercent === 'number'
        ? raw.affiliateCommissionPercent
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.affiliateCommissionPercent,
    fallbackPerOrderFee:
      typeof raw.fallbackPerOrderFee === 'number'
        ? raw.fallbackPerOrderFee
        : DEFAULT_PLATFORM_COMMERCIAL_CATALOG.fallbackPerOrderFee,
    updatedAt: raw.updatedAt
  };
};

export const getCachedPlatformCommercialCatalog = (): PlatformCommercialCatalog => {
  try {
    const raw = localStorage.getItem(COMMERCE_CATALOG_STORAGE_KEY);
    if (raw) {
      return normalizeCommercialCatalog(JSON.parse(raw));
    }
  } catch {}
  return DEFAULT_PLATFORM_COMMERCIAL_CATALOG;
};

export const fetchPlatformCommercialCatalog = async (): Promise<PlatformCommercialCatalog> => {
  try {
    const res = await cfFetch<any>('/api/db/settings/platform_commerce_catalog');
    const val = res?.value || res;
    if (val && typeof val === 'object' && Array.isArray(val.plans)) {
      const normalized = normalizeCommercialCatalog(val);
      try {
        localStorage.setItem(COMMERCE_CATALOG_STORAGE_KEY, JSON.stringify(normalized));
      } catch {}
      return normalized;
    }
  } catch {}
  return getCachedPlatformCommercialCatalog();
};

export const savePlatformCommercialCatalog = async (catalog: PlatformCommercialCatalog): Promise<PlatformCommercialCatalog> => {
  const payload: PlatformCommercialCatalog = {
    ...normalizeCommercialCatalog(catalog),
    updatedAt: new Date().toISOString()
  };
  try {
    localStorage.setItem(COMMERCE_CATALOG_STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent(COMMERCE_CATALOG_EVENT, { detail: payload }));
  } catch {}

  try {
    await cfFetch('/api/db/settings/platform_commerce_catalog', {
      method: 'PUT',
      body: JSON.stringify({ value: payload })
    });
  } catch (e) {
    console.warn('Could not persist commerce catalog to remote D1, saved locally:', e);
  }
  return payload;
};

export const usePlatformCommercialCatalog = () => {
  const [catalog, setCatalog] = useState<PlatformCommercialCatalog>(() => getCachedPlatformCommercialCatalog());

  const refresh = useCallback(async () => {
    const remote = await fetchPlatformCommercialCatalog();
    setCatalog(remote);
  }, []);

  useEffect(() => {
    void refresh();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail) {
        setCatalog(normalizeCommercialCatalog(detail));
      } else {
        setCatalog(getCachedPlatformCommercialCatalog());
      }
    };
    window.addEventListener(COMMERCE_CATALOG_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(COMMERCE_CATALOG_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, [refresh]);

  return { catalog, refresh };
};

export const generateStoreReferralCode = (storeId?: string): string => {
  const cleaned = String(storeId || 'STORE')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(-5);
  return `ABDO-${cleaned || 'PRIME'}`;
};

export const ensureStoreCommerceState = (
  settings?: Partial<Settings> | null,
  storeId?: string
): StoreCommerceState => {
  const existing = settings?.commerceState;
  const nowIso = new Date().toISOString();
  const nextMonthIso = new Date(Date.now() + 30 * 86400000).toISOString();

  if (existing && typeof existing === 'object') {
    return {
      activePlanId: existing.activePlanId || 'free',
      billingCycle: existing.billingCycle || 'monthly',
      planActivatedAt: existing.planActivatedAt || nowIso,
      planExpiresAt: existing.planExpiresAt || nextMonthIso,
      planPaidAmount: Number(existing.planPaidAmount || 0),
      quotaWalletBalance: Number(existing.quotaWalletBalance || 0),
      rolloverOrdersBalance: Number(existing.rolloverOrdersBalance || 0),
      whatsappCredits: Number(existing.whatsappCredits || 0),
      aiCredits: Number(existing.aiCredits || 0),
      autoFallbackEnabled: Boolean(existing.autoFallbackEnabled),
      activeModules: existing.activeModules || {},
      extraEmployeesCount: Number(existing.extraEmployeesCount || 0),
      extraWarehousesCount: Number(existing.extraWarehousesCount || 0),
      extraStoreSlotsCount: Number(existing.extraStoreSlotsCount || 0),
      multiStorePoolIds: Array.isArray(existing.multiStorePoolIds)
        ? existing.multiStorePoolIds
        : storeId
        ? [storeId]
        : [],
      referralCode: existing.referralCode || generateStoreReferralCode(storeId),
      referredByCode: existing.referredByCode,
      referredByStoreId: existing.referredByStoreId,
      affiliateTotalEarned: Number(existing.affiliateTotalEarned || 0),
      adminUnlockedModules: Array.isArray(existing.adminUnlockedModules) ? existing.adminUnlockedModules : [],
      adminPlanLock: Boolean(existing.adminPlanLock),
      customPlanOverride: existing.customPlanOverride || null,
      customPlanRequests: Array.isArray(existing.customPlanRequests) ? existing.customPlanRequests : [],
      verification: existing.verification,
      quotaTransactions: Array.isArray(existing.quotaTransactions) ? existing.quotaTransactions : []
    };
  }

  return {
    activePlanId: 'free',
    billingCycle: 'monthly',
    planActivatedAt: nowIso,
    planExpiresAt: nextMonthIso,
    planPaidAmount: 0,
    quotaWalletBalance: 0,
    rolloverOrdersBalance: 0,
    whatsappCredits: 0,
    aiCredits: 0,
    autoFallbackEnabled: false,
    activeModules: {},
    extraEmployeesCount: 0,
    extraWarehousesCount: 0,
    extraStoreSlotsCount: 0,
    multiStorePoolIds: storeId ? [storeId] : [],
    referralCode: generateStoreReferralCode(storeId),
    affiliateTotalEarned: 0,
    adminUnlockedModules: [],
    adminPlanLock: false,
    customPlanOverride: null,
    customPlanRequests: [],
    quotaTransactions: []
  };
};

export const computePlanCyclePrice = (
  plan: CommercePlanDefinition,
  cycle: CommerceBillingCycle,
  catalog: PlatformCommercialCatalog
) => {
  const isFixedZeroPlan = plan.id === 'free' || plan.id === 'pay_as_you_sell';
  const effectiveCycle: CommerceBillingCycle = isFixedZeroPlan ? 'monthly' : cycle;
  const meta = BILLING_CYCLE_META[effectiveCycle] || BILLING_CYCLE_META.monthly;
  const discountPercent = isFixedZeroPlan ? 0 : (catalog.cycleDiscounts?.[effectiveCycle] ?? 0);
  const factor = (100 - discountPercent) / 100;
  const discountedMonthly = Math.round(plan.monthlyPrice * factor);
  const totalCyclePrice = discountedMonthly * meta.months;
  const originalPrice = plan.monthlyPrice * meta.months;
  const savedAmount = Math.max(0, originalPrice - totalCyclePrice);
  const totalOrdersQuota =
    plan.monthlyOrdersLimit !== null
      ? plan.monthlyOrdersLimit * (plan.id === 'free' ? 1 : meta.months)
      : null;

  return {
    months: meta.months,
    days: meta.days,
    labelAr: meta.labelAr,
    discountPercent,
    discountedMonthly,
    totalCyclePrice,
    originalPrice,
    savedAmount,
    totalOrdersQuota
  };
};

export const isCommercePlanActive = (
  state: StoreCommerceState,
  nowMs: number = Date.now()
): boolean => {
  if (state.activePlanId === 'free' || state.activePlanId === 'pay_as_you_sell') return true;
  if (!state.planExpiresAt) return true;
  const exp = new Date(state.planExpiresAt).getTime();
  return !Number.isFinite(exp) || exp > nowMs;
};

export const buildCustomPlanDefinition = (
  override: CustomPlanOverride
): CommercePlanDefinition => {
  const approxMonths = Math.max(1, Math.round((override.durationDays || 30) / 30));
  const derivedMonthly =
    override.billingMode === 'pay_per_delivered'
      ? 0
      : Math.round((Number(override.cyclePrice || 0) / approxMonths) * 100) / 100;
  return {
    id: 'custom',
    nameAr: override.nameAr || 'باقة مخصصة (Custom Plan)',
    audienceTagAr: 'اتفاقية مخصصة من إدارة المنصة',
    descriptionAr:
      override.descriptionAr ||
      'باقة تفصيلية بشروط وحدود وأسعار متفق عليها خصيصاً لهذا المتجر مع إدارة المنصة.',
    monthlyPrice: derivedMonthly,
    monthlyOrdersLimit: override.monthlyOrdersLimit,
    perDeliveredOrderFee: Number(override.perDeliveredOrderFee || 0),
    maxEmployees: override.maxEmployees,
    maxWarehouses: override.maxWarehouses,
    maxStoresInPool: Math.max(1, Number(override.maxStoresInPool || 1)),
    includedModules: Array.isArray(override.includedModules) ? override.includedModules : [],
    bonusWhatsappMessages: override.bonusWhatsappMessages,
    bonusAiCredits: override.bonusAiCredits,
    affiliateMultiplier: override.affiliateMultiplier
  };
};

export const resolveEffectivePlanDefinition = (
  state: StoreCommerceState,
  catalog: PlatformCommercialCatalog = getCachedPlatformCommercialCatalog(),
  nowMs: number = Date.now()
): {
  activePlan: CommercePlanDefinition;
  planValid: boolean;
  effectivePlanId: CommercePlanId;
  isCustomPlan: boolean;
  customOverride: CustomPlanOverride | null;
} => {
  const planValid = isCommercePlanActive(state, nowMs);
  if (planValid && state.activePlanId === 'custom' && state.customPlanOverride) {
    return {
      activePlan: buildCustomPlanDefinition(state.customPlanOverride),
      planValid: true,
      effectivePlanId: 'custom',
      isCustomPlan: true,
      customOverride: state.customPlanOverride
    };
  }
  const effectivePlanId: CommercePlanId =
    planValid && state.activePlanId !== 'custom' ? state.activePlanId : 'free';
  const activePlan =
    catalog.plans.find(p => p.id === effectivePlanId) ||
    catalog.plans.find(p => p.id === 'free') ||
    catalog.plans[0];
  return {
    activePlan,
    planValid,
    effectivePlanId,
    isCustomPlan: false,
    customOverride: null
  };
};

export const isStoreVerified = (
  settingsOrState?: Partial<Settings> | StoreCommerceState | null,
  nowMs: number = Date.now()
): boolean => {
  if (!settingsOrState) return false;
  const ver =
    'verification' in settingsOrState
      ? (settingsOrState as StoreCommerceState).verification
      : (settingsOrState as Partial<Settings>).commerceState?.verification;
  if (!ver || ver.status !== 'verified') return false;
  if (ver.isLifetime) return true;
  if (ver.expiresAt) {
    const expMs = new Date(ver.expiresAt).getTime();
    if (Number.isFinite(expMs) && expMs <= nowMs) return false;
  }
  return true;
};

export const getStoreVerificationTier = (
  settingsOrState?: Partial<Settings> | StoreCommerceState | null
): VerificationBadgeTier => {
  if (!settingsOrState) return 'standard';
  const ver =
    'verification' in settingsOrState
      ? (settingsOrState as StoreCommerceState).verification
      : (settingsOrState as Partial<Settings>).commerceState?.verification;
  return ver?.badgeTier || 'standard';
};

export const VERIFICATION_TIER_META: Record<
  VerificationBadgeTier,
  {
    id: VerificationBadgeTier;
    labelAr: string;
    shortLabelAr: string;
    titleTextAr: string;
    authorityAr: string;
    descriptionAr: string;
  }
> = {
  standard: {
    id: 'standard',
    labelAr: 'توثيق تجاري قياسي (الشارة الخضراء)',
    shortLabelAr: 'متجر موثق',
    titleTextAr: 'متجر موثق بالشارة الخضراء — تم التحقق من الهوية والمستندات الرسمية بواسطة منصة عبده ميديا بريميم',
    authorityAr: 'منصة عبده ميديا بريميم',
    descriptionAr: 'شارة التوثيق الرسمية للتجار والشركات بعد التحقق من البيانات.'
  },
  vip_gold: {
    id: 'vip_gold',
    labelAr: 'توثيق VIP ذهبي (مشاهير وشركاء نجاح)',
    shortLabelAr: 'شريك موثق VIP',
    titleTextAr: 'حساب VIP موثق بالشارة الذهبية — شريك نجاح وموثوقية فائقة بواسطة منصة عبده ميديا بريميم',
    authorityAr: 'إدارة الشراكات — منصة عبده ميديا بريميم',
    descriptionAr: 'توثيق ذهبي مخصص للشخصيات العامة، المؤثرين، وشركاء النجاح.'
  },
  platform_official: {
    id: 'platform_official',
    labelAr: 'ختم إدارة المنصة الرسمية (حصري للإدارة)',
    shortLabelAr: 'إدارة المنصة الرسمية',
    titleTextAr: 'حساب ومتجر رسمي مُعتمد لإدارة منصة عبده ميديا بريميم — موثق بالختم الملكي الحصري',
    authorityAr: 'الإدارة العليا — منصة عبده ميديا بريميم',
    descriptionAr: 'ختم حصري لمتاجر وحسابات الإدارة الرسمية ولا يظهر في طلبات التجار.'
  }
};

export const VERIFICATION_FEE_NON_PAID_EGP = 100;

export const VERIFICATION_DOC_LABELS: Record<StoreVerificationDocType, string> = {
  national_id_front: 'صورة البطاقة الشخصية (الوجه الأمامي)',
  national_id_back: 'صورة البطاقة الشخصية (الوجه الخلفي)',
  commercial_register: 'صورة السجل التجاري الساري',
  tax_card: 'صورة البطاقة الضريبية',
  bank_or_wallet_proof: 'إثبات الحساب البنكي أو المحفظة الرسمية',
  store_activity_proof: 'إثبات ملكية النشاط / الصفحة / الفواتير'
};

export const computeStoreVerificationPolicy = (
  state: StoreCommerceState,
  nowMs: number = Date.now()
): { fee: number; isPaidTierFree: boolean; priorityReview: boolean } => {
  const valid = isCommercePlanActive(state, nowMs);
  const isPaidTier =
    valid &&
    state.activePlanId !== 'free' &&
    state.activePlanId !== 'pay_as_you_sell';
  const alreadyPaidFee = Number(state.verification?.verificationFeePaid || 0) > 0;
  return {
    fee: isPaidTier || alreadyPaidFee ? 0 : VERIFICATION_FEE_NON_PAID_EGP,
    isPaidTierFree: isPaidTier,
    priorityReview: isPaidTier
  };
};

export const compressVerificationFileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      if (file.size > 1.5 * 1024 * 1024) {
        reject(new Error('حجم ملف الـ PDF يجب ألا يتجاوز 1.5 ميجابايت'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(String(reader.result || ''));
      img.onload = () => {
        const maxDim = 1100;
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const w = Math.max(1, Math.round((img.width || maxDim) * scale));
        const h = Math.max(1, Math.round((img.height || maxDim) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
};

export const evaluateStoreModuleAccess = (
  settings: Partial<Settings> | null | undefined,
  moduleId: CommerceModuleId,
  catalog: PlatformCommercialCatalog = getCachedPlatformCommercialCatalog(),
  isAdmin: boolean = false,
  nowMs: number = Date.now()
): {
  allowed: boolean;
  isReadOnly: boolean;
  source: 'admin' | 'plan' | 'addon' | 'locked';
  moduleDef: CommerceModuleDefinition;
  expiresAt?: string;
} => {
  const moduleDef =
    catalog.modules.find(m => m.id === moduleId) ||
    DEFAULT_PLATFORM_COMMERCIAL_CATALOG.modules.find(m => m.id === moduleId)!;

  if (isAdmin) {
    return { allowed: true, isReadOnly: false, source: 'admin', moduleDef };
  }

  const state = ensureStoreCommerceState(settings);
  if (state.adminUnlockedModules?.includes(moduleId)) {
    return { allowed: true, isReadOnly: false, source: 'admin', moduleDef };
  }

  const { activePlan, planValid } = resolveEffectivePlanDefinition(state, catalog, nowMs);
  if (planValid && activePlan.includedModules.includes(moduleId)) {
    return {
      allowed: true,
      isReadOnly: false,
      source: 'plan',
      moduleDef,
      expiresAt: state.planExpiresAt
    };
  }

  const addonLicense = state.activeModules?.[moduleId];
  if (addonLicense) {
    const expMs = new Date(addonLicense.expiresAt).getTime();
    if (!Number.isFinite(expMs) || expMs > nowMs) {
      return {
        allowed: true,
        isReadOnly: false,
        source: 'addon',
        moduleDef,
        expiresAt: addonLicense.expiresAt
      };
    }
  }

  return {
    allowed: false,
    isReadOnly: true,
    source: 'locked',
    moduleDef
  };
};

export const getRouteModuleId = (pathname: string): CommerceModuleId | null => {
  const p = String(pathname || '').toLowerCase();
  if (p.includes('/pos')) return 'pos';
  if (p.includes('/agency-hub') || p.includes('/partners')) return 'agency_hub';
  if (
    p.includes('/treasury') ||
    p.includes('/employees-payroll') ||
    p.includes('/reconciliation') ||
    p.includes('/cash-management')
  ) {
    return 'advanced_finance';
  }
  if (p.includes('/whatsapp')) return 'whatsapp_api';
  if (p.includes('/ai-assistant')) return 'ai_assistant';
  if (
    p.includes('/apps') ||
    p.includes('/settings/developer') ||
    p.includes('/webhook-monitor') ||
    p.includes('/api-docs')
  ) {
    return 'api_webhooks';
  }
  if (p.includes('/dropshipping') || p.includes('/suppliers') || p.includes('/purchase-returns')) {
    return 'dropshipping';
  }
  if (p.includes('/domain')) return 'custom_domain';
  return null;
};

export const computeModulePriceWithBundle = (
  baseMonthlyPrice: number,
  activeAddonCountAfterPurchase: number,
  catalog: PlatformCommercialCatalog
) => {
  const eligible = activeAddonCountAfterPurchase >= (catalog.bundleDiscountThreshold || 3);
  const discountPercent = eligible ? catalog.bundleDiscountPercent || 20 : 0;
  const finalPrice = Math.round(baseMonthlyPrice * ((100 - discountPercent) / 100));
  return { eligible, discountPercent, finalPrice };
};

export interface SmartSavingsRecommendation {
  recommendedPlanId: CommercePlanId;
  recommendedPlanNameAr: string;
  recommendedCycle: CommerceBillingCycle;
  currentMonthlySpendEstimate: number;
  recommendedMonthlyCost: number;
  monthlySavings: number;
  avgMonthlyOrders: number;
  reasonAr: string;
}

const parseOrderTimestampMs = (order: Order): number | null => {
  const candidates = [order.createdAt, order.commerceQuotaConsumedAt, order.date];
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return null;
};

const getEffectiveCycleStartMs = (
  state: StoreCommerceState,
  effectivePlanId: CommercePlanId,
  nowMs: number = Date.now()
): number => {
  const rawStart = new Date(state.planActivatedAt || 0).getTime();
  const baseStart = Number.isFinite(rawStart) && rawStart > 0 ? rawStart : nowMs - 30 * 86400000;
  if (effectivePlanId === 'free') {
    const monthMs = 30 * 86400000;
    if (nowMs <= baseStart) return baseStart;
    const elapsedMonths = Math.floor((nowMs - baseStart) / monthMs);
    return baseStart + elapsedMonths * monthMs;
  }
  return baseStart;
};

export interface PlanSwitchBreakdown {
  mode: 'already_active' | 'renewal_extend' | 'upgrade' | 'downgrade' | 'new_activation';
  effectiveCycle: CommerceBillingCycle;
  grossCyclePrice: number;
  unusedCreditApplied: number;
  netDue: number;
  remainingDaysOnCurrent: number;
  nextActivatedAt: string;
  nextExpiresAt: string;
  nextPlanPaidAmount: number;
  pricing: ReturnType<typeof computePlanCyclePrice>;
}

export const computePlanSwitchBreakdown = (
  currentState: StoreCommerceState,
  targetPlan: CommercePlanDefinition,
  requestedCycle: CommerceBillingCycle,
  catalog: PlatformCommercialCatalog,
  nowMs: number = Date.now()
): PlanSwitchBreakdown => {
  const isFixedZero = targetPlan.id === 'free' || targetPlan.id === 'pay_as_you_sell';
  const effectiveCycle: CommerceBillingCycle = isFixedZero ? 'monthly' : requestedCycle;
  const pricing = computePlanCyclePrice(targetPlan, effectiveCycle, catalog);
  const grossCyclePrice = isFixedZero ? 0 : pricing.totalCyclePrice;

  const resolvedCurrent = resolveEffectivePlanDefinition(currentState, catalog, nowMs);
  const currentPlan = resolvedCurrent.activePlan;
  const currentValid = resolvedCurrent.planValid;
  const isCurrentPaidActive =
    currentValid &&
    (currentPlan.monthlyPrice > 0 || resolvedCurrent.isCustomPlan) &&
    currentState.activePlanId !== 'free' &&
    currentState.activePlanId !== 'pay_as_you_sell';

  const currentExpMs = new Date(currentState.planExpiresAt || 0).getTime();
  const currentActMs = new Date(currentState.planActivatedAt || 0).getTime();
  const remainingMs =
    isCurrentPaidActive && Number.isFinite(currentExpMs) && currentExpMs > nowMs
      ? currentExpMs - nowMs
      : 0;
  const remainingDaysOnCurrent = Math.ceil(remainingMs / 86400000);
  const nowIso = new Date(nowMs).toISOString();

  if (
    currentValid &&
    currentState.activePlanId === targetPlan.id &&
    (isFixedZero || currentState.billingCycle === effectiveCycle)
  ) {
    if (isFixedZero) {
      return {
        mode: 'already_active',
        effectiveCycle,
        grossCyclePrice: 0,
        unusedCreditApplied: 0,
        netDue: 0,
        remainingDaysOnCurrent,
        nextActivatedAt: currentState.planActivatedAt || nowIso,
        nextExpiresAt: new Date(nowMs + pricing.days * 86400000).toISOString(),
        nextPlanPaidAmount: 0,
        pricing
      };
    }
    const stackedExpiresAt = new Date(
      Math.max(nowMs, Number.isFinite(currentExpMs) ? currentExpMs : nowMs) + pricing.days * 86400000
    ).toISOString();
    return {
      mode: 'renewal_extend',
      effectiveCycle,
      grossCyclePrice,
      unusedCreditApplied: 0,
      netDue: grossCyclePrice,
      remainingDaysOnCurrent,
      nextActivatedAt: currentState.planActivatedAt || nowIso,
      nextExpiresAt: stackedExpiresAt,
      nextPlanPaidAmount: Number(((currentState.planPaidAmount || 0) + grossCyclePrice).toFixed(2)),
      pricing
    };
  }

  // Same paid plan but different cycle -> extend remaining days cleanly
  if (isCurrentPaidActive && currentState.activePlanId === targetPlan.id && !isFixedZero) {
    const stackedExpiresAt = new Date(
      Math.max(nowMs, Number.isFinite(currentExpMs) ? currentExpMs : nowMs) + pricing.days * 86400000
    ).toISOString();
    return {
      mode: 'renewal_extend',
      effectiveCycle,
      grossCyclePrice,
      unusedCreditApplied: 0,
      netDue: grossCyclePrice,
      remainingDaysOnCurrent,
      nextActivatedAt: currentState.planActivatedAt || nowIso,
      nextExpiresAt: stackedExpiresAt,
      nextPlanPaidAmount: Number(((currentState.planPaidAmount || 0) + grossCyclePrice).toFixed(2)),
      pricing
    };
  }

  // Switching to a higher-tier paid plan while current paid plan still has days remaining -> apply Pro-Rata credit
  if (isCurrentPaidActive && !isFixedZero && targetPlan.monthlyPrice >= currentPlan.monthlyPrice && remainingMs > 0) {
    const totalCycleMs =
      Number.isFinite(currentExpMs) && Number.isFinite(currentActMs) && currentExpMs > currentActMs
        ? currentExpMs - currentActMs
        : 30 * 86400000;
    const paidBase = Math.max(0, Number(currentState.planPaidAmount || 0));
    const rawUnusedValue = Math.round(paidBase * Math.min(1, remainingMs / totalCycleMs));
    const unusedCreditApplied = Math.min(grossCyclePrice, Math.max(0, rawUnusedValue));
    const netDue = Math.max(0, Number((grossCyclePrice - unusedCreditApplied).toFixed(2)));

    return {
      mode: 'upgrade',
      effectiveCycle,
      grossCyclePrice,
      unusedCreditApplied,
      netDue,
      remainingDaysOnCurrent,
      nextActivatedAt: nowIso,
      nextExpiresAt: new Date(nowMs + pricing.days * 86400000).toISOString(),
      nextPlanPaidAmount: netDue,
      pricing
    };
  }

  if (isCurrentPaidActive && remainingDaysOnCurrent > 0) {
    return {
      mode: 'downgrade',
      effectiveCycle,
      grossCyclePrice,
      unusedCreditApplied: 0,
      netDue: grossCyclePrice,
      remainingDaysOnCurrent,
      nextActivatedAt: nowIso,
      nextExpiresAt: new Date(nowMs + pricing.days * 86400000).toISOString(),
      nextPlanPaidAmount: grossCyclePrice,
      pricing
    };
  }

  return {
    mode: 'new_activation',
    effectiveCycle,
    grossCyclePrice,
    unusedCreditApplied: 0,
    netDue: grossCyclePrice,
    remainingDaysOnCurrent: 0,
    nextActivatedAt: nowIso,
    nextExpiresAt: new Date(nowMs + pricing.days * 86400000).toISOString(),
    nextPlanPaidAmount: grossCyclePrice,
    pricing
  };
};

export const computeStoreQuotaSummary = (
  orders: Order[],
  settings: Partial<Settings> | null | undefined,
  catalog: PlatformCommercialCatalog = getCachedPlatformCommercialCatalog(),
  storeId?: string
) => {
  const state = ensureStoreCommerceState(settings, storeId);
  const nowMs = Date.now();
  const { activePlan, planValid, effectivePlanId, isCustomPlan, customOverride } =
    resolveEffectivePlanDefinition(state, catalog, nowMs);

  const safeOrders = Array.isArray(orders) ? orders : [];
  const cycleStartMs = getEffectiveCycleStartMs(state, effectivePlanId, nowMs);

  // Fair-Quota Guarantee: cancelled orders before shipping & rollover/wallet-fallback orders are NOT counted against plan cycle quota
  const validCycleOrders = safeOrders.filter(o => {
    if (!o || o.status === 'ملغي') return false;
    if (o.commerceQuotaSource && o.commerceQuotaSource !== 'plan_monthly' && o.commerceQuotaSource !== 'unlimited' && o.commerceQuotaSource !== 'pay_per_delivered') {
      return false;
    }
    const t = parseOrderTimestampMs(o);
    return t !== null ? t >= cycleStartMs : false;
  });

  const cycleMeta = BILLING_CYCLE_META[state.billingCycle] || BILLING_CYCLE_META.monthly;
  const planOrdersLimit =
    isCustomPlan && customOverride
      ? customOverride.monthlyOrdersLimit !== null
        ? customOverride.monthlyOrdersLimit * (BILLING_CYCLE_META[customOverride.cycle]?.months || 1)
        : null
      : activePlan.monthlyOrdersLimit !== null
      ? activePlan.monthlyOrdersLimit * (effectivePlanId === 'free' ? 1 : cycleMeta.months)
      : null;

  const usedInCycle = validCycleOrders.length;
  const remainingPlanOrders =
    planOrdersLimit !== null ? Math.max(0, planOrdersLimit - usedInCycle) : null;
  const usagePercent =
    planOrdersLimit === null
      ? Math.min(100, usedInCycle > 0 ? 15 : 5)
      : planOrdersLimit > 0
      ? Math.min(100, Math.round((usedInCycle / planOrdersLimit) * 100))
      : 100;

  // Count active paid add-on modules (not already covered by plan)
  const activeAddonEntries = Object.values(state.activeModules || {}).filter(lic => {
    if (!lic) return false;
    if (activePlan.includedModules.includes(lic.moduleId)) return false;
    const exp = new Date(lic.expiresAt).getTime();
    return !Number.isFinite(exp) || exp > nowMs;
  });

  const activeAddonsMonthlyCost = activeAddonEntries.reduce((sum, lic) => {
    const def = catalog.modules.find(m => m.id === lic!.moduleId);
    return sum + Number(def?.monthlyPrice || lic!.monthlyPricePaid || 0);
  }, 0);

  const bundleEligible = activeAddonEntries.length >= (catalog.bundleDiscountThreshold || 3);

  // Build last 6 months chart series + 3-month average for Smart Savings Radar
  const now = new Date();
  const monthlySeries: Array<{
    key: string;
    label: string;
    planOrders: number;
    extraOrders: number;
    total: number;
  }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('ar-EG', { month: 'short' });
    const monthOrders = safeOrders.filter(o => {
      if (!o || o.status === 'ملغي') return false;
      const od = new Date(o.createdAt || o.date || 0);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
    });
    const extraCount = monthOrders.filter(
      o => o.commerceQuotaSource === 'rollover_pack' || o.commerceQuotaSource === 'wallet_fallback'
    ).length;
    const planCount = Math.max(0, monthOrders.length - extraCount);
    monthlySeries.push({
      key,
      label,
      planOrders: planCount,
      extraOrders: extraCount,
      total: monthOrders.length
    });
  }

  const last3Months = monthlySeries.slice(-3);
  const avgMonthlyOrders = Math.round(
    last3Months.reduce((s, m) => s + m.total, 0) / Math.max(1, last3Months.length)
  );

  // Smart Savings Radar calculation
  const effectivePlanPricing = computePlanCyclePrice(activePlan, state.billingCycle, catalog);
  const currentMonthlySpendEstimate =
    activePlan.id === 'pay_as_you_sell' ||
    (isCustomPlan && customOverride?.billingMode === 'pay_per_delivered')
      ? avgMonthlyOrders * activePlan.perDeliveredOrderFee + activeAddonsMonthlyCost
      : isCustomPlan && customOverride?.billingMode === 'hybrid'
      ? activePlan.monthlyPrice + avgMonthlyOrders * activePlan.perDeliveredOrderFee + activeAddonsMonthlyCost
      : effectivePlanPricing.discountedMonthly + activeAddonsMonthlyCost;

  let smartRadar: SmartSavingsRecommendation = {
    recommendedPlanId: activePlan.id,
    recommendedPlanNameAr: activePlan.nameAr,
    recommendedCycle: state.billingCycle,
    currentMonthlySpendEstimate,
    recommendedMonthlyCost: currentMonthlySpendEstimate,
    monthlySavings: 0,
    avgMonthlyOrders,
    reasonAr:
      avgMonthlyOrders === 0
        ? 'باقتك الحالية مناسبة لبداية نشاطك؛ رادار التوفير سيقترح الترقية الأوفر بمجرد تزايد مبيعاتك.'
        : `معدل طلباتك الشهري (${avgMonthlyOrders} طلب) متوازن تماماً مع باقتك الحالية.`
  };

  // Compare against Growth, Pro, Enterprise across Monthly & Semi-Annual/Annual
  const candidatePlanIds: CommercePlanId[] = ['growth', 'pro_business', 'enterprise'];
  for (const cid of candidatePlanIds) {
    const candidate = catalog.plans.find(p => p.id === cid);
    if (!candidate) continue;
    if (candidate.monthlyOrdersLimit !== null && avgMonthlyOrders > candidate.monthlyOrdersLimit) {
      continue;
    }
    // Subtract addons covered by candidate
    const uncoveredAddonsCost = activeAddonEntries.reduce((sum, lic) => {
      if (candidate.includedModules.includes(lic!.moduleId)) return sum;
      const def = catalog.modules.find(m => m.id === lic!.moduleId);
      return sum + Number(def?.monthlyPrice || 0);
    }, 0);

    const semiPricing = computePlanCyclePrice(candidate, 'semi_annual', catalog);
    const candidateMonthly = semiPricing.discountedMonthly + uncoveredAddonsCost;
    const savings = currentMonthlySpendEstimate - candidateMonthly;
    if (savings > smartRadar.monthlySavings && savings >= 50) {
      smartRadar = {
        recommendedPlanId: candidate.id,
        recommendedPlanNameAr: candidate.nameAr,
        recommendedCycle: 'semi_annual',
        currentMonthlySpendEstimate,
        recommendedMonthlyCost: candidateMonthly,
        monthlySavings: savings,
        avgMonthlyOrders,
        reasonAr: `تفعيل ${candidate.nameAr} (نصف سنوي بخصم ${catalog.cycleDiscounts.semi_annual}%) سيغطي موديولاتك النشطة ومتوسط ${avgMonthlyOrders} طلب مع توفير ${savings.toLocaleString()} ج.م شهرياً.`
      };
    }
  }

  return {
    state,
    activePlan,
    planValid,
    isCustomPlan,
    customOverride,
    planOrdersLimit,
    usedInCycle,
    remainingPlanOrders,
    usagePercent,
    activeAddonEntries,
    activeAddonsMonthlyCost,
    bundleEligible,
    monthlySeries,
    avgMonthlyOrders,
    smartRadar,
    maxEmployeesAllowed:
      activePlan.maxEmployees === null ? null : activePlan.maxEmployees + state.extraEmployeesCount,
    maxWarehousesAllowed:
      activePlan.maxWarehouses === null ? null : activePlan.maxWarehouses + state.extraWarehousesCount,
    maxStoresInPool: activePlan.maxStoresInPool + state.extraStoreSlotsCount
  };
};

const DELIVERED_STATUSES = [
  'تم التحصيل',
  'مكتمل',
  'تم التسليم',
  'تم التوصيل',
  'تم_التحصيل',
  'تم_التوصيل',
  'تم_توصيلها',
  'مدفوعة'
];
const SHIPPED_STATUSES = [
  'قيد_الشحن',
  'تم_الارسال',
  'قيد الشحن',
  'تم الإرسال',
  'تم_الشحن',
  'خرج_للتوصيل',
  'في_الطريق',
  'مرتجع',
  'مرتجع_جزئي',
  'فشل_التوصيل',
  'مرتجع_بعد_الاستلام',
  'تم_الاستبدال',
  'تمت_الاعادة_لشركة_الشحن',
  ...DELIVERED_STATUSES
];

export const processOrdersCommerceLifecycle = (
  prevOrders: Order[],
  nextOrders: Order[],
  settings: Settings,
  catalog: PlatformCommercialCatalog = getCachedPlatformCommercialCatalog(),
  storeId?: string
): { orders: Order[]; settings: Settings; changed: boolean } => {
  if (!Array.isArray(nextOrders)) {
    return { orders: nextOrders, settings, changed: false };
  }

  let commerce = ensureStoreCommerceState(settings, storeId);
  let commerceDirty = false;
  let ordersDirty = false;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const prevById = new Map<string, Order>();
  (prevOrders || []).forEach(o => {
    if (o?.id) prevById.set(o.id, o);
  });

  const { activePlan: effectivePlan, isCustomPlan, customOverride } = resolveEffectivePlanDefinition(
    commerce,
    catalog,
    nowMs
  );

  const cycleMeta = BILLING_CYCLE_META[commerce.billingCycle] || BILLING_CYCLE_META.monthly;
  const planLimit =
    isCustomPlan && customOverride
      ? customOverride.monthlyOrdersLimit !== null
        ? customOverride.monthlyOrdersLimit * (BILLING_CYCLE_META[customOverride.cycle]?.months || 1)
        : null
      : effectivePlan.monthlyOrdersLimit !== null
      ? effectivePlan.monthlyOrdersLimit * (effectivePlan.id === 'free' ? 1 : cycleMeta.months)
      : null;

  const cycleStartMs = getEffectiveCycleStartMs(commerce, effectivePlan.id, nowMs);

  let planUsedSoFar = nextOrders.filter(o => {
    if (!o || o.status === 'ملغي') return false;
    if (o.commerceQuotaSource && o.commerceQuotaSource !== 'plan_monthly') return false;
    if (!o.commerceQuotaConsumedAt) return false;
    const t = parseOrderTimestampMs(o);
    return t !== null ? t >= cycleStartMs : false;
  }).length;

  const processed = nextOrders.map(order => {
    if (!order) return order;
    let updated = order;
    const prevOrder = order.id ? prevById.get(order.id) : undefined;

    // 1. Fair-Quota Refund: If order transitions to 'ملغي' before shipment after quota/fallback was consumed
    const refundTxId = `QUOTA-REF-${order.id}`;
    if (
      order.status === 'ملغي' &&
      order.commerceQuotaConsumedAt &&
      !order.commerceQuotaRefundedAt &&
      !commerce.quotaTransactions.some(tx => tx.id === refundTxId) &&
      (!prevOrder || !SHIPPED_STATUSES.includes(prevOrder.status))
    ) {
      ordersDirty = true;
      commerceDirty = true;
      const refundTxBase = {
        id: refundTxId,
        date: nowIso,
        referenceId: String(order.id),
        status: 'completed' as const
      };

      if (order.commerceQuotaSource === 'rollover_pack') {
        commerce = {
          ...commerce,
          rolloverOrdersBalance: commerce.rolloverOrdersBalance + 1,
          quotaTransactions: [
            {
              ...refundTxBase,
              type: 'order_quota_refund' as const,
              amount: 0,
              ordersDelta: 1,
              balanceAfter: commerce.quotaWalletBalance,
              titleAr: `استرداد كوتا أوردر ملغي #${order.orderNumber || order.id}`,
              notes: 'قاعدة الكوتا العادلة: إعادة 1 أوردر للرصيد الدائم لعدم الشحن'
            },
            ...commerce.quotaTransactions
          ].slice(0, 200)
        };
      } else if (order.commerceQuotaSource === 'wallet_fallback') {
        const fee = Number(catalog.fallbackPerOrderFee || 3);
        const nextBal = Number((commerce.quotaWalletBalance + fee).toFixed(2));
        commerce = {
          ...commerce,
          quotaWalletBalance: nextBal,
          quotaTransactions: [
            {
              ...refundTxBase,
              type: 'order_quota_refund' as const,
              amount: fee,
              ordersDelta: 1,
              balanceAfter: nextBal,
              titleAr: `استرداد رسم أوردر ملغي #${order.orderNumber || order.id}`,
              notes: `إرجاع ${fee} ج.م لمحفظة الكوتا حسب قاعدة الكوتا العادلة`
            },
            ...commerce.quotaTransactions
          ].slice(0, 200)
        };
      } else {
        commerce = {
          ...commerce,
          quotaTransactions: [
            {
              ...refundTxBase,
              type: 'order_quota_refund' as const,
              amount: 0,
              ordersDelta: 1,
              balanceAfter: commerce.quotaWalletBalance,
              titleAr: `إعفاء أوردر ملغي #${order.orderNumber || order.id} من الكوتا`,
              notes: 'قاعدة الكوتا العادلة: الطلب الملغي لا يُخصم من باقتك'
            },
            ...commerce.quotaTransactions
          ].slice(0, 200)
        };
      }

      updated = {
        ...updated,
        commerceQuotaRefundedAt: nowIso
      };
      return updated;
    }

    // 2. Fair-Quota Consumption on active (non-cancelled) order
    if (order.status !== 'ملغي' && !order.commerceQuotaConsumedAt) {
      let source: Order['commerceQuotaSource'] = 'plan_monthly';
      const fallbackTxId = `QUOTA-FB-${order.id}`;

      if (
        effectivePlan.id === 'pay_as_you_sell' ||
        (effectivePlan.id === 'custom' && customOverride?.billingMode === 'pay_per_delivered')
      ) {
        source = 'pay_per_delivered';
      } else if (planLimit === null) {
        source = 'unlimited';
      } else if (planUsedSoFar < planLimit) {
        source = 'plan_monthly';
        planUsedSoFar += 1;
      } else if (commerce.rolloverOrdersBalance > 0) {
        source = 'rollover_pack';
        commerceDirty = true;
        commerce = {
          ...commerce,
          rolloverOrdersBalance: commerce.rolloverOrdersBalance - 1
        };
      } else if (
        commerce.autoFallbackEnabled &&
        commerce.quotaWalletBalance >= catalog.fallbackPerOrderFee &&
        !commerce.quotaTransactions.some(tx => tx.id === fallbackTxId)
      ) {
        source = 'wallet_fallback';
        const fee = Number(catalog.fallbackPerOrderFee || 3);
        const nextBal = Number((commerce.quotaWalletBalance - fee).toFixed(2));
        commerceDirty = true;
        commerce = {
          ...commerce,
          quotaWalletBalance: nextBal,
          quotaTransactions: [
            {
              id: fallbackTxId,
              date: nowIso,
              type: 'order_quota_fallback' as const,
              amount: -fee,
              ordersDelta: -1,
              balanceAfter: nextBal,
              referenceId: String(order.id),
              titleAr: `تغطية تلقائية لأوردر إضافي #${order.orderNumber || order.id}`,
              notes: 'استخدام وضع الأمان التلقائي بعد نفاد كوتا الباقة',
              status: 'completed' as const
            },
            ...commerce.quotaTransactions
          ].slice(0, 200)
        };
      } else {
        source = 'plan_monthly';
        planUsedSoFar += 1;
      }

      ordersDirty = true;
      updated = {
        ...updated,
        commerceQuotaConsumedAt: nowIso,
        commerceQuotaSource: source
      };
    }

    // 3. Pay-Per-Delivered billing (0 EGP monthly plan or Custom Pay-Per-Delivered/Hybrid plan -> fee only when delivered & collected)
    if (
      (effectivePlan.id === 'pay_as_you_sell' || effectivePlan.id === 'custom') &&
      DELIVERED_STATUSES.includes(updated.status) &&
      !updated.deliveredCommissionBilledAt &&
      effectivePlan.perDeliveredOrderFee > 0
    ) {
      const txId = `PPD-FEE-${updated.id}`;
      const alreadyBilled = commerce.quotaTransactions.some(tx => tx.id === txId);
      if (!alreadyBilled) {
        const fee = Number(effectivePlan.perDeliveredOrderFee || 5);
        const nextBal = Number((commerce.quotaWalletBalance - fee).toFixed(2));
        commerceDirty = true;
        ordersDirty = true;
        commerce = {
          ...commerce,
          quotaWalletBalance: nextBal,
          quotaTransactions: [
            {
              id: txId,
              date: nowIso,
              type: 'pay_per_delivered_fee' as const,
              amount: -fee,
              balanceAfter: nextBal,
              referenceId: String(updated.id),
              titleAr: `رسم أوردر مُسلَّم ومحصّل #${updated.orderNumber || updated.id}`,
              notes: `${effectivePlan.nameAr}: ${fee} ج.م عن التسليم الفعلي الناجح فقط`,
              status: 'completed' as const
            },
            ...commerce.quotaTransactions
          ].slice(0, 200)
        };
        updated = {
          ...updated,
          deliveredCommissionBilledAt: nowIso,
          deliveredCommissionAmount: fee
        };
      }
    }

    return updated;
  });

  if (!commerceDirty && !ordersDirty) {
    return { orders: nextOrders, settings, changed: false };
  }

  return {
    orders: processed,
    settings: commerceDirty ? { ...settings, commerceState: commerce } : settings,
    changed: true
  };
};

export const creditAffiliateCommission = async (params: {
  sourceStoreId: string;
  sourceStoreName: string;
  referredByCode?: string;
  paidAmount: number;
  purchaseTitleAr: string;
  idempotencyKey?: string;
  catalog: PlatformCommercialCatalog;
  users: User[];
  allStoresData: Record<string, StoreData>;
  setAllStoresData?: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
}): Promise<number> => {
  const {
    sourceStoreId,
    sourceStoreName,
    referredByCode,
    paidAmount,
    purchaseTitleAr,
    idempotencyKey,
    catalog,
    users,
    allStoresData,
    setAllStoresData
  } = params;

  if (!referredByCode || paidAmount <= 0) return 0;
  const cleanCode = referredByCode.trim().toUpperCase();

  // Locate referrer store matching code
  let targetStoreId: string | null = null;
  let targetStoreData: StoreData | null = null;

  for (const [sid, sdata] of Object.entries(allStoresData || {})) {
    if (!sdata || sid === sourceStoreId) continue;
    const cState = ensureStoreCommerceState(sdata.settings, sid);
    if (cState.referralCode.toUpperCase() === cleanCode) {
      targetStoreId = sid;
      targetStoreData = sdata;
      break;
    }
  }

  if (!targetStoreId || !targetStoreData) return 0;

  const refState = ensureStoreCommerceState(targetStoreData.settings, targetStoreId);
  const txId = idempotencyKey ? `AFF-${idempotencyKey}` : `AFF-${sourceStoreId}-${Date.now()}`;
  if (refState.quotaTransactions.some(t => t.id === txId)) {
    return 0;
  }

  const refResolved = resolveEffectivePlanDefinition(refState, catalog);
  const multiplier = Number(refResolved.activePlan?.affiliateMultiplier || 1);
  const pct = Number(catalog.affiliateCommissionPercent || 15) * multiplier;
  const commission = Number(((paidAmount * pct) / 100).toFixed(2));
  if (commission <= 0) return 0;

  const nextBal = Number((refState.quotaWalletBalance + commission).toFixed(2));
  const tx: QuotaWalletTransaction = {
    id: txId,
    date: new Date().toISOString(),
    type: 'affiliate_commission',
    amount: commission,
    balanceAfter: nextBal,
    referenceId: sourceStoreId,
    titleAr: `عمولة إحالة (${pct}%) من ${sourceStoreName}`,
    notes: `${purchaseTitleAr} بقيمة ${paidAmount.toLocaleString()} ج.م`,
    status: 'completed'
  };

  const nextStoreData: StoreData = {
    ...targetStoreData,
    settings: {
      ...targetStoreData.settings,
      commerceState: {
        ...refState,
        quotaWalletBalance: nextBal,
        affiliateTotalEarned: Number((refState.affiliateTotalEarned + commission).toFixed(2)),
        quotaTransactions: [tx, ...refState.quotaTransactions].slice(0, 200)
      }
    }
  };

  if (setAllStoresData) {
    setAllStoresData(prev => ({ ...prev, [targetStoreId!]: nextStoreData }));
  }

  const meta =
    users.flatMap(u => u.stores || []).find(s => s.id === targetStoreId) ||
    ({ id: targetStoreId, name: nextStoreData.settings?.storeName || targetStoreId } as any);
  await db.saveStoreData(meta, nextStoreData).catch(() => {});

  return commission;
};
