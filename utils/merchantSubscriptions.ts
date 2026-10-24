import {
  BillingCycleType,
  SelfServicePlanId,
  DedicatedManagerPlanId,
  MerchantSubscriptionConfig,
  MerchantManagerConfig,
  Order
} from '../types';

export interface BillingCycleOption {
  id: BillingCycleType;
  labelAr: string;
  months: number;
  days: number;
  discountPercent: number;
  badgeText?: string;
  discountLabelAr?: string;
  isHighlightBadge?: boolean;
}

export const BILLING_CYCLES: BillingCycleOption[] = [
  {
    id: 'monthly',
    labelAr: 'شهريًا',
    months: 1,
    days: 30,
    discountPercent: 0
  },
  {
    id: 'quarterly',
    labelAr: '3 شهور',
    months: 3,
    days: 90,
    discountPercent: 10,
    badgeText: 'وفر 10%',
    discountLabelAr: 'وفر 10%'
  },
  {
    id: 'semi_annual',
    labelAr: '6 شهور',
    months: 6,
    days: 180,
    discountPercent: 20,
    badgeText: 'وفر 20%',
    discountLabelAr: 'وفر 20%'
  },
  {
    id: 'annual',
    labelAr: 'سنويًا',
    months: 12,
    days: 365,
    discountPercent: 30,
    badgeText: 'وفر 30%',
    discountLabelAr: 'وفر 30%',
    isHighlightBadge: true
  }
];

export interface SelfServicePlanDefinition {
  id: SelfServicePlanId;
  nameAr: string;
  nameEn: string;
  baseMonthlyPrice: number;
  monthlyBasePrice: number;
  monthlyOrdersLimit: number | null; // null = unlimited
  ordersLimit: number | null;
  ordersLimitLabelAr: string;
  unlimitedOrders?: boolean;
  isPopular?: boolean;
  description: string;
  features: string[];
}

export const SELF_SERVICE_PLANS: SelfServicePlanDefinition[] = [
  {
    id: 'free',
    nameAr: 'المجانية',
    nameEn: 'Free',
    baseMonthlyPrice: 0,
    monthlyBasePrice: 0,
    monthlyOrdersLimit: 30,
    ordersLimit: 30,
    ordersLimitLabelAr: '30 طلب',
    description: 'ابدأ مجاناً وأدر متجرك وطلباتك بنفسك حتى 30 طلباً شهرياً',
    features: [
      'حتى 30 طلباً شهرياً',
      'لوحة تحكم كاملة لإدارة الطلبات والمخزون',
      'كشف حساب وتقارير شفافية فورية'
    ]
  },
  {
    id: 'basic',
    nameAr: 'الأساسية',
    nameEn: 'Basic',
    baseMonthlyPrice: 600,
    monthlyBasePrice: 600,
    monthlyOrdersLimit: 100,
    ordersLimit: 100,
    ordersLimitLabelAr: '100 طلب',
    description: 'مثالية للمتاجر الناشئة بحجم طلبات متنامٍ',
    features: [
      'حتى 100 طلب شهرياً',
      'ربط مباشر مع شركات الشحن والـ Webhook',
      'تنبيهات واتساب وإدارة المرتجعات'
    ]
  },
  {
    id: 'pro',
    nameAr: 'المميزة',
    nameEn: 'Pro',
    baseMonthlyPrice: 1250,
    monthlyBasePrice: 1250,
    monthlyOrdersLimit: 250,
    ordersLimit: 250,
    ordersLimitLabelAr: '250 طلب',
    description: 'للمتاجر النشطة التي تحتاج سعة طلبات أعلى وتقارير متقدمة',
    features: [
      'حتى 250 طلباً شهرياً (750 طلباً كل 3 شهور)',
      'تحليلات مالية متقدمة وتقارير ربحية المنتجات',
      'دعم فني سريع وأولوية في المزامنة'
    ]
  },
  {
    id: 'business',
    nameAr: 'الاحترافية',
    nameEn: 'Business',
    baseMonthlyPrice: 2500,
    monthlyBasePrice: 2500,
    monthlyOrdersLimit: 600,
    ordersLimit: 600,
    ordersLimitLabelAr: '600 طلب',
    isPopular: true,
    description: 'الباقة الأشهر للمتاجر ذات المبيعات اليومية العالية',
    features: [
      'حتى 600 طلب شهرياً (1,800 طلب كل 3 شهور)',
      'أتمتة كاملة لدورة التأكيد والشحن والتحصيل',
      'تقارير محاسبية تفصيلية وصلاحيات متقدمة'
    ]
  },
  {
    id: 'ultimate',
    nameAr: 'الشاملة',
    nameEn: 'Ultimate',
    baseMonthlyPrice: 4000,
    monthlyBasePrice: 4000,
    monthlyOrdersLimit: null,
    ordersLimit: null,
    ordersLimitLabelAr: 'غير محدود',
    description: 'سعة غير محدودة للعلامات التجارية الكبرى بدون أي قيود',
    features: [
      'عدد طلبات غير محدود شهرياً وسنوياً',
      'كافة المميزات والربط البرمجي المفتوح API',
      'أعلى مستوى أداء وأولوية قصوى في الخوادم'
    ]
  }
];

export interface DedicatedManagerPlanDefinition {
  id: DedicatedManagerPlanId;
  nameAr: string;
  badgeText: string;
  priceLabelAr: string;
  baseMonthlyPrice: number;
  defaultOrderFee: number;
  includedOrdersQuota?: number;
  extraOrderFee?: number;
  isFeaturedExpert?: boolean;
  isCustomizable?: boolean;
  description: string;
  features: string[];
}

export const DEDICATED_MANAGER_PLANS: DedicatedManagerPlanDefinition[] = [
  {
    id: 'monthly_1000',
    nameAr: 'باقة المدير المخصص لمتجرك (1000 ج.م + 20 ج.م / أوردر)',
    badgeText: 'الباقة المعتمدة',
    priceLabelAr: '1,000 ج.م / شهريًا',
    baseMonthlyPrice: 1000,
    defaultOrderFee: 20,
    includedOrdersQuota: 0,
    extraOrderFee: 20,
    isFeaturedExpert: true,
    description: 'مدير حسابات وأوردرات مخصص لمتجرك باشتراك شهري 1,000 ج.م، وخصم 20 ج.م رسم تشغيل عن كل أوردر مؤكد.',
    features: [
      'اشتراك شهري 1,000 ج.م لوحة وتحليلات وإشراف كامل',
      'خصم 20 ج.م فقط رسم تشغيل عن كل أوردر يتم تأكيده أو إرساله للشحن',
      'يتولى المدير المخصص إنشاء وتأكيد وشحن ومتابعة الأوردرات بالكامل',
      'كشف حساب مالي دقيق وحماية كاملة من تكرار الخصم'
    ]
  },
  {
    id: 'per_order_20',
    nameAr: 'باقة المدير المخصص (20 ج.م / أوردر)',
    badgeText: 'دفع بالطلب',
    priceLabelAr: '20 ج.م / أوردر',
    baseMonthlyPrice: 0,
    defaultOrderFee: 20,
    description: 'مدير مخصص يدير ويؤكد ويشحن أوردراتك مقابل 20 ج.م فقط لكل أوردر يتم تأكيده أو إرساله للشحن بدون أي التزام شهري ثابت.',
    features: [
      '20 ج.م فقط على كل أوردر عند التأكيد أو الإرسال للشحن',
      'صفر رسوم شهرية ثابتة — ادفع فقط على الأوردرات الفعلية',
      'متابعة كاملة للتأكيد مع العملاء والتنسيق مع شركات الشحن'
    ]
  },
  {
    id: 'monthly_700',
    nameAr: 'المدير المخصص لمتجرك (باقة سابقة)',
    badgeText: 'باقة سابقة',
    priceLabelAr: '700 ج.م / شهريًا',
    baseMonthlyPrice: 700,
    defaultOrderFee: 20,
    includedOrdersQuota: 0,
    extraOrderFee: 20,
    description: 'باقة سابقة لمدير الحسابات المخصص.',
    features: [
      'أولوية الدعم حين تحتاج إليه',
      'جهة اتصال واحدة لكل ما تحتاجه في متجرك'
    ]
  },
  {
    id: 'custom_manager',
    nameAr: 'باقة المدير المخصصة (تسعير خاص من الإدارة)',
    badgeText: 'باقة مخصصة',
    priceLabelAr: 'يُحدد السعر من الإدارة',
    baseMonthlyPrice: 0,
    defaultOrderFee: 20,
    isCustomizable: true,
    description: 'حدد عدد الأوردرات المستهدف ونظام السداد المفضل، وستقوم الإدارة بتحديد سعر الأوردر المخصص لك وإرسال العرض للموافقة والتفعيل من المحفظة.',
    features: [
      'تحديد عدد الأوردرات المستهدف وإرسال طلب تسعير للإدارة',
      'الإدارة تحدد سعر الأوردر المخصص لك وتفعل الباقة بموافقتك',
      'خيار الدفع المسبق لحصة الأوردرات أو الخصم التلقائي مع كل أوردر'
    ]
  }
];

export function computeSelfServicePlanPricing(
  planOrId: SelfServicePlanDefinition | SelfServicePlanId,
  cycleId: BillingCycleType
) {
  const plan =
    typeof planOrId === 'string'
      ? SELF_SERVICE_PLANS.find(p => p.id === planOrId) || SELF_SERVICE_PLANS[0]
      : planOrId || SELF_SERVICE_PLANS[0];
  const cycle = BILLING_CYCLES.find(c => c.id === cycleId) || BILLING_CYCLES[0];
  const discountFactor = (100 - cycle.discountPercent) / 100;
  const discountedMonthlyPrice = Math.round(plan.baseMonthlyPrice * discountFactor);
  const totalCyclePrice = discountedMonthlyPrice * cycle.months;
  const originalCyclePrice = plan.baseMonthlyPrice * cycle.months;
  const totalSaved = Math.max(0, originalCyclePrice - totalCyclePrice);
  const totalOrdersQuota = plan.monthlyOrdersLimit !== null
    ? plan.monthlyOrdersLimit * cycle.months
    : null;

  return {
    cycle,
    durationDays: cycle.days,
    baseMonthlyPrice: plan.baseMonthlyPrice,
    discountedMonthlyPrice,
    monthlyEquivalent: discountedMonthlyPrice,
    totalCyclePrice,
    totalPrice: totalCyclePrice,
    originalCyclePrice,
    totalSaved,
    totalOrdersQuota
  };
}

export function computeManagerPlanPricing(
  plan: DedicatedManagerPlanDefinition,
  cycleId: BillingCycleType,
  customOrderFee = 20,
  customOrdersCount = 100,
  customPrepaidQuota = false
) {
  const cycle = BILLING_CYCLES.find(c => c.id === cycleId) || BILLING_CYCLES[0];
  if (plan.id === 'per_order_20') {
    return {
      cycle,
      discountedMonthlyPrice: 0,
      totalCyclePrice: 0,
      orderFee: 20,
      isPerOrder: true
    };
  }
  if (plan.id === 'custom_manager') {
    const cleanFee = Math.max(1, Number(customOrderFee) || 20);
    const cleanCount = Math.max(1, Number(customOrdersCount) || 100);
    const bundleTotal = customPrepaidQuota ? cleanFee * cleanCount : 0;
    return {
      cycle,
      discountedMonthlyPrice: customPrepaidQuota ? Math.round(bundleTotal / cycle.months) : 0,
      totalCyclePrice: bundleTotal,
      orderFee: cleanFee,
      customOrdersCount: cleanCount,
      isPerOrder: !customPrepaidQuota
    };
  }
  // monthly_1000 or legacy monthly_700
  const discountFactor = (100 - cycle.discountPercent) / 100;
  const discountedMonthlyPrice = Math.round(plan.baseMonthlyPrice * discountFactor);
  const totalCyclePrice = discountedMonthlyPrice * cycle.months;
  const totalQuota = (plan.includedOrdersQuota ?? 50) * cycle.months;
  return {
    cycle,
    discountedMonthlyPrice,
    totalCyclePrice,
    orderFee: 0,
    includedOrdersQuota: totalQuota,
    extraOrderFee: plan.extraOrderFee ?? 20,
    isPerOrder: false
  };
}

export interface RefundCalculationResult {
  isEligible: boolean;
  reasonIfIneligible?: string;
  paidAmount: number;
  totalCycleDays: number;
  daysElapsed: number;
  daysRemainingInGuarantee: number;
  chargeFor14Days: number;
  chargeForActualDays: number;
  refundableAfter14DaysCharge: number;
  refundableAfterActualDays: number;
}

/**
 * Calculates the 14-day refund breakdown from total package price (monthly, 3m, 6m, or annual).
 * Policy: Maximum 14 days refund window. The merchant is charged for the 14 days (or actual days)
 * out of the total package duration, and the remaining unused balance is refunded to their wallet.
 */
export function calculate14DaySubscriptionRefund(
  startDateIso?: string,
  paidAmount = 0,
  billingCycle: BillingCycleType = 'monthly',
  currentStatus?: string
): RefundCalculationResult {
  const cycle = BILLING_CYCLES.find(c => c.id === billingCycle) || BILLING_CYCLES[0];
  const totalCycleDays = cycle.days;

  if (!paidAmount || paidAmount <= 0) {
    return {
      isEligible: false,
      reasonIfIneligible: 'الباقة الحالية مجانية أو بنظام الدفع لكل أوردر بدون مبلغ اشتراك مدفوع مسبقاً.',
      paidAmount: 0,
      totalCycleDays,
      daysElapsed: 0,
      daysRemainingInGuarantee: 0,
      chargeFor14Days: 0,
      chargeForActualDays: 0,
      refundableAfter14DaysCharge: 0,
      refundableAfterActualDays: 0
    };
  }

  if (currentStatus === 'pending_refund') {
    return {
      isEligible: false,
      reasonIfIneligible: 'يوجد طلب استرداد معلق قيد المراجعة لدى الإدارة حالياً.',
      paidAmount,
      totalCycleDays,
      daysElapsed: 0,
      daysRemainingInGuarantee: 0,
      chargeFor14Days: 0,
      chargeForActualDays: 0,
      refundableAfter14DaysCharge: 0,
      refundableAfterActualDays: 0
    };
  }

  const parsedStart = startDateIso ? new Date(startDateIso).getTime() : Date.now();
  const startMs = Number.isFinite(parsedStart) ? parsedStart : Date.now();
  const nowMs = Date.now();
  const diffDaysRaw = Math.floor(Math.max(0, nowMs - startMs) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.max(1, diffDaysRaw + 1); // Day 1 on first day of subscription
  const daysRemainingInGuarantee = Math.max(0, 14 - diffDaysRaw);

  // Prorated 14-day charge out of total package duration (30, 90, 180, or 365 days)
  const chargeFor14Days = Math.round((14 / totalCycleDays) * paidAmount);
  const chargeForActualDays = Math.round((Math.min(daysElapsed, 14) / totalCycleDays) * paidAmount);

  const refundableAfter14DaysCharge = Math.max(0, paidAmount - chargeFor14Days);
  const refundableAfterActualDays = Math.max(0, paidAmount - chargeForActualDays);

  if (diffDaysRaw > 14) {
    return {
      isEligible: false,
      reasonIfIneligible: `انتهت فترة ضمان الاسترداد (14 يوماً كحد أقصى). مضى على الاشتراك ${daysElapsed} يوماً.`,
      paidAmount,
      totalCycleDays,
      daysElapsed,
      daysRemainingInGuarantee: 0,
      chargeFor14Days,
      chargeForActualDays,
      refundableAfter14DaysCharge,
      refundableAfterActualDays
    };
  }

  return {
    isEligible: true,
    paidAmount,
    totalCycleDays,
    daysElapsed,
    daysRemainingInGuarantee,
    chargeFor14Days,
    chargeForActualDays,
    refundableAfter14DaysCharge,
    refundableAfterActualDays
  };
}

/**
 * Checks whether a subscription or manager plan cycle is currently active AND has not passed its `endDate` / `expiresAt`.
 * Fixes Audit Issue #6: Prevents an expired plan whose status flag remained 'active' from granting free quota or manager mode.
 */
export function isPlanCycleCurrentlyActive(
  plan?: { status?: string; endDate?: string; expiresAt?: string; planId?: string } | null,
  nowMs: number = Date.now()
): boolean {
  if (!plan || !plan.planId || plan.planId === 'none' || plan.status !== 'active') {
    return false;
  }
  const rawEnd = plan.endDate || (plan as any).expiresAt;
  if (rawEnd) {
    const endMs = new Date(rawEnd).getTime();
    if (Number.isFinite(endMs) && endMs <= nowMs) {
      return false;
    }
  }
  return true;
}

/**
 * Stamps an order at creation time with the exact active plan cycle & pricing rules
 * so future plan switches never alter the financial accounting of previously created orders.
 */
export function buildOrderPlanSnapshot(
  merchant?: {
    subscriptionPlan?: MerchantSubscriptionConfig;
    managerPlan?: MerchantManagerConfig;
  } | null,
  currentOrdersCount: number = 0,
  nowMs: number = Date.now()
) {
  const mgr = merchant?.managerPlan;
  const sub = merchant?.subscriptionPlan;
  const managerPlanActive = isPlanCycleCurrentlyActive(mgr, nowMs);
  const nowIso = new Date(nowMs).toISOString();

  if (managerPlanActive && mgr) {
    const mgrDef = DEDICATED_MANAGER_PLANS.find(p => p.id === mgr.planId) || DEDICATED_MANAGER_PLANS[0];
    
    let lockedFee = 0;
    let isQuotaCovered = false;
    if (mgr.planId === 'per_order_20') {
      lockedFee = Number(mgr.orderFee || 20);
    } else if (mgr.planId === 'custom_manager') {
      const unitFee = Number(mgr.customOrderFee ?? mgr.orderFee ?? 20);
      const customQuota = Number(mgr.customOrderQuota ?? mgr.customOrdersTarget ?? 0);
      if (mgr.customPrepaidQuota && customQuota > 0 && currentOrdersCount < customQuota) {
        lockedFee = 0;
        isQuotaCovered = true;
      } else {
        lockedFee = unitFee;
      }
    } else if (mgr.planId === 'monthly_1000' || mgr.planId === 'monthly_700') {
      const quota = mgr.includedOrdersQuota ?? 50;
      if (currentOrdersCount < quota) {
        lockedFee = 0;
        isQuotaCovered = true;
      } else {
        lockedFee = mgr.extraOrderFee ?? 20;
      }
    }

    return {
      planCycleId: mgr.cycleId || `MGR-${mgr.planId}-${mgr.startDate || mgr.activatedAt || 'init'}`,
      planModeAtCreation: 'manager' as const,
      planIdAtCreation: mgr.planId,
      planNameAtCreation: mgr.planName || mgr.planNameAr || mgrDef.nameAr,
      lockedManagerFee: lockedFee,
      isQuotaCovered,
      quotaIncludedOrder: isQuotaCovered,
      cycleOrderNumber: currentOrdersCount + 1,
      planSnapshotAt: nowIso,
      shouldDeductPerOrderNow: false 
    };
  }

  const subActive = isPlanCycleCurrentlyActive(sub, nowMs);
  const planId = subActive && sub?.planId ? sub.planId : 'free';
  const def = SELF_SERVICE_PLANS.find(p => p.id === planId) || SELF_SERVICE_PLANS[0];
  return {
    planCycleId: subActive && sub?.cycleId ? sub.cycleId : `SELF-${planId}-${(subActive && (sub?.startDate || sub?.activatedAt)) || 'init'}`,
    planModeAtCreation: 'self_service' as const,
    planIdAtCreation: planId,
    planNameAtCreation: (subActive && (sub?.planName || sub?.planNameAr)) || `باقة ${def.nameAr}`,
    lockedManagerFee: 0,
    isQuotaCovered: true,
    quotaIncludedOrder: true,
    cycleOrderNumber: currentOrdersCount + 1,
    planSnapshotAt: nowIso,
    shouldDeductPerOrderNow: false
  };
}

/**
 * Resolves the immutable plan snapshot for an order so that later plan changes
 * never retroactively charge fees or mix accounting across different plan cycles.
 */
export function getOrderEffectivePlanSnapshot(
  order: Order,
  merchant?: {
    subscriptionPlan?: MerchantSubscriptionConfig;
    managerPlan?: MerchantManagerConfig;
    planCyclesHistory?: Array<{
      cycleId: string;
      mode: 'self_service' | 'manager';
      planId: string;
      planName?: string;
      planNameAr?: string;
      orderFee?: number;
      startDate?: string;
      activatedAt?: string;
      endedAt: string;
    }>;
  } | null
) {
  // 1. If the order already carries a creation snapshot, always trust the locked snapshot
  if (order.planCycleId || order.planModeAtCreation || order.planNameAtCreation) {
    const mode = order.planModeAtCreation || (order.planCycleId?.startsWith('MGR') ? 'manager' : 'self_service');
    const lockedFee = Number(order.managerFeeAmount ?? order.lockedManagerFee ?? 0);
    const isQuotaCovered = Boolean(
      order.isQuotaCovered ||
      order.quotaIncludedOrder ||
      (mode === 'self_service' && lockedFee === 0) ||
      (mode === 'manager' && lockedFee === 0)
    );
    return {
      cycleId: order.planCycleId || 'SNAPSHOT-LOCKED',
      mode,
      planNameAr: order.planNameAtCreation || (mode === 'manager' ? 'باقة المدير المخصص' : 'باقة الإدارة الذاتية'),
      lockedFee,
      isQuotaCovered,
      cycleOrderNumber: order.cycleOrderNumber,
      isSnapshotLocked: true
    };
  }

  // 2. For legacy orders without explicit snapshot fields, match against archived cycles by timestamp
  const orderTime = new Date(order.createdAt || order.date || 0).getTime();
  const history = Array.isArray(merchant?.planCyclesHistory) ? merchant!.planCyclesHistory : [];
  if (Number.isFinite(orderTime) && orderTime > 0 && history.length > 0) {
    const matchedCycle = history.find(c => {
      const start = new Date(c.activatedAt || c.startDate || 0).getTime();
      const end = new Date(c.endedAt || 0).getTime();
      return start > 0 && end > 0 && orderTime >= start && orderTime <= end;
    });
    if (matchedCycle) {
      const lockedFee = Number(order.managerFeeAmount ?? (matchedCycle.mode === 'manager' ? (matchedCycle.orderFee || 0) : 0));
      return {
        cycleId: matchedCycle.cycleId,
        mode: matchedCycle.mode,
        planNameAr: matchedCycle.planNameAr || matchedCycle.planName || (matchedCycle.mode === 'manager' ? 'دورة مدير مخصص سابقة' : 'دورة إدارة ذاتية سابقة'),
        lockedFee,
        isQuotaCovered: lockedFee === 0,
        cycleOrderNumber: undefined,
        isSnapshotLocked: true
      };
    }
  }

  // 3. Default to self-service 0-fee for legacy orders created before the current manager plan started
  const mgrStartIso = merchant?.managerPlan?.activatedAt || merchant?.managerPlan?.startDate;
  const mgrStartMs = mgrStartIso ? new Date(mgrStartIso).getTime() : 0;
  if (mgrStartMs > 0 && orderTime > 0 && orderTime < mgrStartMs) {
    return {
      cycleId: 'PRE-SWITCH-CYCLE',
      mode: 'self_service' as const,
      planNameAr: 'دورة سابقة (معزولة قبل الترقية)',
      lockedFee: 0,
      isQuotaCovered: true,
      cycleOrderNumber: undefined,
      isSnapshotLocked: true
    };
  }

  const fallbackFee = Number(order.managerFeeAmount ?? order.lockedManagerFee ?? 0);
  return {
    cycleId: order.planCycleId || 'DEFAULT-CYCLE',
    mode: (fallbackFee > 0 ? 'manager' : 'self_service') as 'self_service' | 'manager',
    planNameAr: fallbackFee > 0 ? 'باقة المدير المخصص' : 'الباقة المجانية / الذاتية',
    lockedFee: fallbackFee,
    isQuotaCovered: fallbackFee === 0,
    cycleOrderNumber: order.cycleOrderNumber,
    isSnapshotLocked: false
  };
}

export function computeMerchantPlanUsage(
  merchantOrders: Order[],
  subscription?: MerchantSubscriptionConfig,
  managerPlan?: MerchantManagerConfig,
  nowMs: number = Date.now(),
  planCyclesHistory?: Array<{ cycleId?: string }>
) {
  const safeOrders = Array.isArray(merchantOrders) ? merchantOrders : [];
  const archivedCycleIds = new Set(
    (Array.isArray(planCyclesHistory) ? planCyclesHistory : [])
      .map(c => c?.cycleId)
      .filter(Boolean) as string[]
  );
  const managerPlanActive = isPlanCycleCurrentlyActive(managerPlan, nowMs);

  if (managerPlanActive && managerPlan) {
    const mgrDef =
      DEDICATED_MANAGER_PLANS.find(p => p.id === managerPlan.planId) || DEDICATED_MANAGER_PLANS[0];
    const cycle =
      BILLING_CYCLES.find(c => c.id === (managerPlan.billingCycle || 'monthly')) || BILLING_CYCLES[0];

    const startIso = managerPlan.activatedAt || managerPlan.startDate || (managerPlan as any)?.startedAt;
    const parsedStart = startIso ? new Date(startIso).getTime() : 0;
    const startMs = Number.isFinite(parsedStart) ? parsedStart : 0;
    const activeCycleId = managerPlan.cycleId;

    const ordersInCycle = safeOrders.filter(o => {
      if (o.status === 'ملغي') return false;
      if (o.planCycleId && archivedCycleIds.has(o.planCycleId)) return false;
      if (activeCycleId && o.planCycleId) {
        return o.planCycleId === activeCycleId;
      }
      if (o.planCycleId && !activeCycleId) {
        return o.planModeAtCreation === 'manager';
      }
      if (startMs > 0) {
        const oDate = new Date(o.createdAt || o.date || 0).getTime();
        return oDate >= startMs;
      }
      return true;
    });

    const usedOrdersCount = ordersInCycle.length;
    const isMonthly1000 = managerPlan.planId === 'monthly_1000' || managerPlan.planId === 'monthly_700';
    const customTargetNum = Number(managerPlan.customOrderQuota ?? managerPlan.customOrdersTarget ?? 0);
    const isCustomWithTarget =
      managerPlan.planId === 'custom_manager' && customTargetNum > 0;

    const ordersLimit: number | null = isMonthly1000
      ? (managerPlan.includedOrdersQuota || 50) * cycle.months
      : isCustomWithTarget
      ? customTargetNum
      : null;

    const remainingQuota: number | null =
      ordersLimit !== null ? Math.max(0, ordersLimit - usedOrdersCount) : null;

    const usagePercent =
      ordersLimit === null
        ? Math.min(100, usedOrdersCount > 0 ? Math.min(100, usedOrdersCount * 5) : 10)
        : ordersLimit > 0
        ? Math.min(100, Math.round((usedOrdersCount / ordersLimit) * 100))
        : 100;

    const planNameAr = managerPlan.planName || managerPlan.planNameAr || mgrDef.nameAr;
    const effectiveOrderFee =
      managerPlan.planId === 'per_order_20'
        ? Number(managerPlan.orderFee || 20)
        : managerPlan.planId === 'custom_manager'
        ? Number((managerPlan as any).customOrderFee ?? managerPlan.orderFee ?? 20)
        : isMonthly1000
        ? (ordersLimit !== null && usedOrdersCount > ordersLimit ? 20 : 0)
        : 0;

    const quotaTextAr =
      isMonthly1000 && ordersLimit !== null
        ? usedOrdersCount <= ordersLimit
          ? `${usedOrdersCount}/${ordersLimit} طلب (متبقي ${remainingQuota} مجاناً)`
          : `${ordersLimit}/${ordersLimit} مجاناً + ${usedOrdersCount - ordersLimit} بـ 20 ج/طلب`
        : ordersLimit === null
        ? effectiveOrderFee > 0
          ? `${usedOrdersCount} طلب (${effectiveOrderFee} ج/طلب)`
          : `${usedOrdersCount} طلب (غير محدود)`
        : `${usedOrdersCount}/${ordersLimit} طلب (متبقي ${remainingQuota})`;

    const topBannerTextAr =
      managerPlan.planId === 'per_order_20'
        ? `👑 نظام حسابك الحالي: ${planNameAr} — يتولى مديرك المخصص إنشاء وتأكيد وشحن أوردراتك بالكامل (${effectiveOrderFee} ج.م لكل أوردر) · المنفذ بالدورة الحالية: ${usedOrdersCount} طلب.`
        : managerPlan.planId === 'custom_manager'
        ? `👑 نظام حسابك الحالي: ${planNameAr} (${effectiveOrderFee} ج.م/أوردر معتمد من الإدارة) — تم تنفيذ ${usedOrdersCount} من ${ordersLimit ?? '∞'} طلب عبر مديرك المخصص.`
        : isMonthly1000
        ? `👑 نظام حسابك الحالي: ${planNameAr} (${cycle.labelAr}) — يتولى مديرك المخصص إدارة وتأكيد وشحن أوردراتك (أول ${ordersLimit} طلب مشمولة بالاشتراك الشهري مجاناً، وما زاد يُحسب بـ 20 ج.م/طلب) · المنفذ بالدورة الحالية: ${usedOrdersCount} طلب.`
        : `👑 نظام حسابك الحالي: ${planNameAr} (${cycle.labelAr}) — يتولى مديرك المخصص إنشاء وتأكيد وشحن جميع أوردراتك · المنفذ بالدورة الحالية: ${usedOrdersCount} طلب.`;

    return {
      mode: 'manager' as const,
      cycleId: activeCycleId || `MGR-${managerPlan.planId}-${startIso || 'init'}`,
      planId: managerPlan.planId,
      planNameAr,
      planLabelAr: planNameAr,
      planNameEn: mgrDef.badgeText,
      badgeText: mgrDef.badgeText,
      billingCycle: cycle,
      usedOrdersCount,
      usedOrders: usedOrdersCount,
      ordersLimit,
      limitOrders: ordersLimit,
      remainingQuota,
      usagePercent,
      quotaTextAr,
      topBannerTextAr,
      effectiveOrderFee,
      isUnlimited: ordersLimit === null,
      isLimitReached: ordersLimit !== null && usedOrdersCount >= ordersLimit,
      managerPlanActive: true,
      managerPlan
    };
  }

  const planId = subscription?.planId || 'free';
  const def = SELF_SERVICE_PLANS.find(p => p.id === planId) || SELF_SERVICE_PLANS[0];
  const cycle =
    BILLING_CYCLES.find(c => c.id === (subscription?.billingCycle || 'monthly')) || BILLING_CYCLES[0];

  const startIso = subscription?.activatedAt || subscription?.startDate || (subscription as any)?.startedAt;
  const parsedStart = startIso ? new Date(startIso).getTime() : 0;
  const startMs = Number.isFinite(parsedStart) ? parsedStart : 0;
  const activeCycleId = subscription?.cycleId;

  const ordersInCycle = safeOrders.filter(o => {
    if (o.status === 'ملغي') return false;
    if (o.planCycleId && archivedCycleIds.has(o.planCycleId)) return false;
    if (activeCycleId && o.planCycleId) {
      return o.planCycleId === activeCycleId;
    }
    if (o.planCycleId && !activeCycleId) {
      return o.planModeAtCreation !== 'manager';
    }
    if (startMs > 0) {
      const oDate = new Date(o.createdAt || o.date || 0).getTime();
      return oDate >= startMs;
    }
    return true;
  });

  const usedOrdersCount = ordersInCycle.length;
  const ordersLimit: number | null =
    subscription?.ordersLimit !== undefined
      ? subscription.ordersLimit
      : subscription?.monthlyOrderLimit !== undefined
      ? subscription.monthlyOrderLimit
      : def.monthlyOrdersLimit !== null
      ? def.monthlyOrdersLimit * cycle.months
      : null;

  const remainingQuota: number | null =
    ordersLimit !== null ? Math.max(0, ordersLimit - usedOrdersCount) : null;

  const usagePercent =
    ordersLimit === null
      ? Math.min(100, usedOrdersCount > 0 ? 15 : 5)
      : ordersLimit > 0
      ? Math.min(100, Math.round((usedOrdersCount / ordersLimit) * 100))
      : 0;

  const rawPlanName = subscription?.planName || subscription?.planNameAr || def.nameAr;
  const planLabelAr = rawPlanName.startsWith('الباقة') ? rawPlanName : `الباقة ${rawPlanName}`;
  const quotaTextAr =
    ordersLimit === null
      ? `${usedOrdersCount} / غير محدود`
      : `${usedOrdersCount}/${ordersLimit} طلب (متبقي ${remainingQuota})`;

  const topBannerTextAr =
    ordersLimit === null
      ? `🚀 باقتك الحالية: ${planLabelAr} (${cycle.labelAr}) — أنشأت ${usedOrdersCount} طلب في دورتك الحالية بسعة طلبات غير محدودة.`
      : `🚀 باقتك الحالية: ${planLabelAr} (${cycle.labelAr}) — أنشأت ${usedOrdersCount} من ${ordersLimit} طلب في دورتك الحالية (${usagePercent}%).`;

  return {
    mode: 'self_service' as const,
    cycleId: activeCycleId || `SELF-${planId}-${startIso || 'init'}`,
    planId,
    planNameAr: rawPlanName,
    planLabelAr,
    planNameEn: def.nameEn,
    badgeText: def.nameAr,
    billingCycle: cycle,
    usedOrdersCount,
    usedOrders: usedOrdersCount,
    ordersLimit,
    limitOrders: ordersLimit,
    remainingQuota,
    usagePercent,
    quotaTextAr,
    topBannerTextAr,
    effectiveOrderFee: 0,
    isUnlimited: ordersLimit === null,
    isLimitReached: ordersLimit !== null && usedOrdersCount >= ordersLimit,
    managerPlanActive: false,
    managerPlan
  };
}


