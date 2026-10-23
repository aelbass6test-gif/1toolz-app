import React, { useState, useMemo } from 'react';
import {
  X,
  ShoppingCart,
  Check,
  Wallet as WalletIcon,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  PlusCircle,
  Sliders,
  UserCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  Send,
  History,
  ChevronLeft,
  Infinity as InfinityIcon,
  Zap,
  Star,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BillingCycleType,
  SelfServicePlanId,
  DedicatedManagerPlanId,
  MerchantSubscriptionConfig,
  MerchantManagerConfig,
  MerchantPlanChangeRequest,
  MerchantPlanCycleRecord,
  ScheduledMerchantPlanTransition
} from '../types';
import {
  BILLING_CYCLES,
  SELF_SERVICE_PLANS,
  DEDICATED_MANAGER_PLANS,
  computeSelfServicePlanPricing,
  computeManagerPlanPricing,
  calculate14DaySubscriptionRefund
} from '../utils/merchantSubscriptions';

interface MerchantChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
  merchantName: string;
  walletBalance: number;
  currentSubscription?: MerchantSubscriptionConfig;
  currentManagerPlan?: MerchantManagerConfig;
  pendingPlanRequest?: MerchantPlanChangeRequest | null;
  scheduledNextPlan?: ScheduledMerchantPlanTransition | null;
  planCyclesHistory?: MerchantPlanCycleRecord[];
  usedOrdersCount?: number;
  remainingOrdersCount?: number | null;
  onConfirmSubscriptionChange: (payload: {
    newSubscription: MerchantSubscriptionConfig;
    newManagerPlan: MerchantManagerConfig;
    totalWalletDeduction: number;
    summaryNote: string;
    activationTiming?: 'immediate' | 'after_current_quota';
  }) => Promise<void>;
  onScheduleNextPlan?: (scheduled: ScheduledMerchantPlanTransition) => Promise<void>;
  onCancelScheduledPlan?: () => Promise<void>;
  onActivateScheduledPlanNow?: () => Promise<void>;
  onRequestPlanChange?: (request: MerchantPlanChangeRequest) => Promise<void>;
  onAcceptAdminCustomQuote?: (request: MerchantPlanChangeRequest) => Promise<void>;
  onCancelPendingPlanRequest?: () => Promise<void>;
  onRequestRefund14Days: (payload: {
    planType: 'self_service' | 'manager';
    planId: string;
    planName: string;
    billingCycle: BillingCycleType;
    paidAmount: number;
    chargeFor14Days: number;
    chargeForActualDays: number;
    refundableAmount: number;
    daysElapsed: number;
    totalCycleDays: number;
  }) => Promise<void>;
  onRequestWalletTopUp: (amount: number, notes: string) => Promise<void>;
}

const toArabicDigits = (num: number | string): string => {
  const str = typeof num === 'number' ? num.toLocaleString('en-US') : String(num);
  const map: Record<string, string> = {
    '0': '٠',
    '1': '١',
    '2': '٢',
    '3': '٣',
    '4': '٤',
    '5': '٥',
    '6': '٦',
    '7': '٧',
    '8': '٨',
    '9': '٩',
    ',': '٬'
  };
  return str.replace(/[0-9,]/g, ch => map[ch] || ch);
};

export const MerchantChangePlanModal: React.FC<MerchantChangePlanModalProps> = ({
  isOpen,
  onClose,
  isDark = false,
  merchantName,
  walletBalance,
  currentSubscription,
  currentManagerPlan,
  pendingPlanRequest,
  scheduledNextPlan,
  planCyclesHistory = [],
  usedOrdersCount = 0,
  remainingOrdersCount = null,
  onConfirmSubscriptionChange,
  onScheduleNextPlan,
  onCancelScheduledPlan,
  onActivateScheduledPlanNow,
  onRequestPlanChange,
  onAcceptAdminCustomQuote,
  onCancelPendingPlanRequest,
  onRequestRefund14Days,
  onRequestWalletTopUp
}) => {
  const isCurrentlyManagerMode = Boolean(
    currentManagerPlan &&
      currentManagerPlan.planId &&
      currentManagerPlan.planId !== 'none' &&
      currentManagerPlan.status === 'active'
  );
  const activeSelfPlanId: SelfServicePlanId = currentSubscription?.planId || 'free';
  const activeCycleId: BillingCycleType =
    (isCurrentlyManagerMode ? currentManagerPlan?.billingCycle : currentSubscription?.billingCycle) ||
    'monthly';
  const activeManagerId: DedicatedManagerPlanId = isCurrentlyManagerMode
    ? currentManagerPlan!.planId
    : 'none';

  const [selectedMode, setSelectedMode] = useState<'self_service' | 'manager'>(
    isCurrentlyManagerMode ? 'manager' : 'self_service'
  );
  const [selectedCycle, setSelectedCycle] = useState<BillingCycleType>(activeCycleId);
  const [selectedSelfPlan, setSelectedSelfPlan] = useState<SelfServicePlanId>(activeSelfPlanId);
  const [selectedManagerPlan, setSelectedManagerPlan] = useState<DedicatedManagerPlanId>(
    isCurrentlyManagerMode ? activeManagerId : 'none'
  );
  const [activationTiming, setActivationTiming] = useState<'immediate' | 'after_current_quota'>('immediate');

  // Sync modal state when opened or when merchant's active plan changes
  React.useEffect(() => {
    if (!isOpen) return;
    const mgrActive = Boolean(
      currentManagerPlan &&
        currentManagerPlan.planId &&
        currentManagerPlan.planId !== 'none' &&
        currentManagerPlan.status === 'active'
    );
    setSelectedMode(mgrActive ? 'manager' : 'self_service');
    setSelectedSelfPlan(currentSubscription?.planId || 'free');
    setSelectedManagerPlan(mgrActive ? currentManagerPlan!.planId : 'none');
    setSelectedCycle(
      (mgrActive ? currentManagerPlan?.billingCycle : currentSubscription?.billingCycle) ||
        'monthly'
    );
    setIsEditingActiveCustomPlan(false);
    setCustomOrdersTarget(
      pendingPlanRequest?.requestedOrdersTarget ||
        currentManagerPlan?.customOrdersTarget ||
        (currentManagerPlan as any)?.customOrderQuota ||
        100
    );
    setCustomPrepaidQuota(
      pendingPlanRequest?.requestedPrepaidQuota ??
        currentManagerPlan?.customPrepaidQuota ??
        false
    );
  }, [isOpen, currentSubscription, currentManagerPlan, pendingPlanRequest]);

  // Custom Manager Plan controls
  const [isEditingActiveCustomPlan, setIsEditingActiveCustomPlan] = useState<boolean>(false);
  const adminApprovedCustomFee = Number(
    currentManagerPlan?.customOrderFee ??
      currentManagerPlan?.orderFee ??
      pendingPlanRequest?.quotedOrderFee ??
      0
  );
  const [customOrdersTarget, setCustomOrdersTarget] = useState<number>(
    pendingPlanRequest?.requestedOrdersTarget ||
      currentManagerPlan?.customOrdersTarget ||
      (currentManagerPlan as any)?.customOrderQuota ||
      100
  );
  const [customPrepaidQuota, setCustomPrepaidQuota] = useState<boolean>(
    pendingPlanRequest?.requestedPrepaidQuota ?? currentManagerPlan?.customPrepaidQuota ?? false
  );
  const [customMerchantNotes, setCustomMerchantNotes] = useState<string>(
    pendingPlanRequest?.merchantNotes || ''
  );

  // Wallet Top-Up controls
  const [showTopUpBox, setShowTopUpBox] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [topUpNotes, setTopUpNotes] = useState('شحن رصيد المحفظة لتفعيل باقة المتجر أو المدير المخصص');
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);

  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Compute selected self-service pricing
  const selectedSelfPlanDef = useMemo(
    () => SELF_SERVICE_PLANS.find(p => p.id === selectedSelfPlan) || SELF_SERVICE_PLANS[0],
    [selectedSelfPlan]
  );
  const selfPlanPricing = useMemo(
    () => computeSelfServicePlanPricing(selectedSelfPlanDef, selectedCycle),
    [selectedSelfPlanDef, selectedCycle]
  );

  // Compute selected manager pricing
  const selectedManagerDef = useMemo(
    () => DEDICATED_MANAGER_PLANS.find(p => p.id === selectedManagerPlan) || null,
    [selectedManagerPlan]
  );
  const managerPricing = useMemo(() => {
    if (!selectedManagerDef || selectedMode !== 'manager') {
      return {
        cycle: BILLING_CYCLES.find(c => c.id === selectedCycle) || BILLING_CYCLES[0],
        discountedMonthlyPrice: 0,
        totalCyclePrice: 0,
        orderFee: 0,
        isPerOrder: false
      };
    }
    return computeManagerPlanPricing(
      selectedManagerDef,
      selectedCycle,
      adminApprovedCustomFee > 0 ? adminApprovedCustomFee : 20,
      customOrdersTarget,
      customPrepaidQuota
    );
  }, [selectedManagerDef, selectedMode, selectedCycle, adminApprovedCustomFee, customOrdersTarget, customPrepaidQuota]);

  // Determine if changes were made
  const isSelfPlanChanged =
    selectedMode === 'self_service' &&
    (isCurrentlyManagerMode ||
      selectedSelfPlan !== activeSelfPlanId ||
      (selectedSelfPlan !== 'free' && selectedCycle !== activeCycleId));

  const isCustomPlanCurrentlyActive =
    isCurrentlyManagerMode && activeManagerId === 'custom_manager';

  const isManagerPlanChanged =
    selectedMode === 'manager' &&
    selectedManagerPlan !== 'none' &&
    (!isCurrentlyManagerMode ||
      selectedManagerPlan !== activeManagerId ||
      ((selectedManagerPlan === 'monthly_1000' || selectedManagerPlan === 'monthly_700') &&
        selectedCycle !== (currentManagerPlan?.billingCycle || 'monthly')) ||
      (selectedManagerPlan === 'custom_manager' &&
        (!isCustomPlanCurrentlyActive ||
          (isEditingActiveCustomPlan &&
            (customOrdersTarget !== (currentManagerPlan?.customOrdersTarget || (currentManagerPlan as any)?.customOrderQuota || 100) ||
              customPrepaidQuota !== Boolean(currentManagerPlan?.customPrepaidQuota) ||
              Boolean(customMerchantNotes.trim()))))));

  const isCustomPlanRequestSelected =
    selectedMode === 'manager' &&
    selectedManagerPlan === 'custom_manager' &&
    (!isCustomPlanCurrentlyActive || isEditingActiveCustomPlan);

  const hasAnyChange = isSelfPlanChanged || isManagerPlanChanged || isCustomPlanRequestSelected;

  const hasActivePendingRequest = Boolean(
    pendingPlanRequest &&
      (pendingPlanRequest.status === 'pending_admin_approval' ||
        pendingPlanRequest.status === 'pending_admin_quote' ||
        pendingPlanRequest.status === 'quoted_waiting_merchant')
  );

  const totalDeductionNow = isCustomPlanRequestSelected
    ? 0
    : selectedMode === 'manager'
    ? isManagerPlanChanged
      ? managerPricing.totalCyclePrice
      : 0
    : isSelfPlanChanged
    ? selfPlanPricing.totalCyclePrice
    : 0;

  const isBalanceSufficient = walletBalance >= totalDeductionNow;

  const subPaidAmount = Number(currentSubscription?.totalPaidAmount ?? (currentSubscription as any)?.paidAmount ?? 0);
  const mgrPaidAmount = Number(currentManagerPlan?.totalPaidAmount ?? (currentManagerPlan as any)?.paidAmount ?? 0);

  // 14-Day Refund Calculation
  const selfRefundCalc = useMemo(
    () =>
      calculate14DaySubscriptionRefund(
        currentSubscription?.startDate || (currentSubscription as any)?.startedAt,
        subPaidAmount,
        currentSubscription?.billingCycle || 'monthly',
        currentSubscription?.status
      ),
    [currentSubscription, subPaidAmount]
  );

  const managerRefundCalc = useMemo(
    () =>
      calculate14DaySubscriptionRefund(
        currentManagerPlan?.startDate || (currentManagerPlan as any)?.startedAt,
        mgrPaidAmount,
        currentManagerPlan?.billingCycle || 'monthly',
        currentManagerPlan?.status
      ),
    [currentManagerPlan, mgrPaidAmount]
  );

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (!hasAnyChange || (!isCustomPlanRequestSelected && !isBalanceSufficient) || isSubmittingPlan) return;
    setIsSubmittingPlan(true);
    try {
      const nowIso = new Date().toISOString();
      const durationMs =
        (selectedMode === 'manager' ? managerPricing.cycle.days : selfPlanPricing.cycle.days) * 86400000;
      const expIso = new Date(Date.now() + durationMs).toISOString();

      // 1. Custom Manager Pricing Quote -> goes to Admin for custom pricing
      if (isCustomPlanRequestSelected && onRequestPlanChange) {
        const reqPayload: MerchantPlanChangeRequest = {
          id: `PLAN-REQ-${Date.now()}`,
          requestedAt: nowIso,
          targetMode: 'manager',
          targetManagerPlanId: 'custom_manager',
          targetPlanId: 'custom_manager',
          billingCycle: selectedCycle,
          planNameAr: 'باقة المدير المخصصة (تسعير خاص من الإدارة)',
          targetPlanNameAr: 'باقة المدير المخصصة (تسعير خاص من الإدارة)',
          upfrontCost: 0,
          calculatedAmount: 0,
          ordersLimit: customOrdersTarget,
          requestedOrdersTarget: customOrdersTarget,
          requestedCustomQuota: customOrdersTarget,
          requestedPrepaidQuota: customPrepaidQuota,
          requestedCustomBillingPreference: customPrepaidQuota ? 'prepaid_quota' : 'per_order',
          merchantNotes: customMerchantNotes.trim() || undefined,
          activationTiming,
          status: 'pending_admin_quote'
        };
        await onRequestPlanChange(reqPayload);
        onClose();
        return;
      }

      // Build new subscription & manager plan configs with isolated cycleId
      const newCycleId =
        selectedMode === 'manager'
          ? `CYC-MGR-${selectedManagerPlan}-${Date.now()}`
          : `CYC-SELF-${selectedSelfPlan}-${Date.now()}`;

      const nextSubscription: MerchantSubscriptionConfig =
        selectedMode === 'self_service'
          ? {
              cycleId: newCycleId,
              planId: selectedSelfPlan,
              planName: `الباقة ${selectedSelfPlanDef.nameAr}`,
              planNameAr: `الباقة ${selectedSelfPlanDef.nameAr}`,
              billingCycle: selectedCycle,
              monthlyPrice: selfPlanPricing.discountedMonthlyPrice,
              pricePerMonth: selfPlanPricing.discountedMonthlyPrice,
              totalPaidAmount: selfPlanPricing.totalCyclePrice,
              paidAmount: selfPlanPricing.totalCyclePrice,
              ordersLimit: selfPlanPricing.totalOrdersQuota,
              monthlyOrderLimit: selfPlanPricing.totalOrdersQuota ?? undefined,
              unlimitedOrders: selfPlanPricing.totalOrdersQuota === null,
              startDate: nowIso,
              activatedAt: nowIso,
              endDate: expIso,
              expiresAt: expIso,
              status: 'active'
            }
          : {
              ...(currentSubscription || {
                planId: 'free',
                planNameAr: 'الباقة المجانية',
                billingCycle: 'monthly',
                status: 'cancelled'
              }),
              status: 'cancelled'
            };

      const nextManagerPlan: MerchantManagerConfig =
        selectedMode === 'manager' && selectedManagerPlan !== 'none'
          ? {
              cycleId: newCycleId,
              enabled: true,
              planId: selectedManagerPlan,
              planName: selectedManagerDef?.nameAr || 'باقة المدير المخصص',
              planNameAr: selectedManagerDef?.nameAr || 'باقة المدير المخصص',
              billingCycle: selectedCycle,
              orderFee:
                selectedManagerPlan === 'per_order_20'
                  ? 20
                  : 0,
              monthlyFee: managerPricing.discountedMonthlyPrice,
              includedOrdersQuota:
                selectedManagerPlan === 'monthly_1000' || selectedManagerPlan === 'monthly_700'
                  ? 50 * managerPricing.cycle.months
                  : undefined,
              extraOrderFee: 20,
              totalPaidAmount: managerPricing.totalCyclePrice,
              totalPrepaidAmount: managerPricing.totalCyclePrice,
              usedOrdersInCycle: 0,
              startDate: nowIso,
              activatedAt: nowIso,
              endDate: expIso,
              expiresAt: expIso,
              status: 'active'
            }
          : {
              ...(currentManagerPlan || { planId: 'none', status: 'inactive' }),
              enabled: false,
              status: 'inactive'
            };

      const summaryNote =
        selectedMode === 'manager'
          ? `تفعيل ${nextManagerPlan.planNameAr} (${managerPricing.cycle.labelAr}) — دورة مستقلة #${newCycleId.slice(-6)}`
          : `تفعيل ${nextSubscription.planNameAr} (${selfPlanPricing.cycle.labelAr}) — دورة مستقلة #${newCycleId.slice(-6)}`;

      // 2. If user chose "after_current_quota" (Schedule after current quota finishes)
      if (activationTiming === 'after_current_quota' && onScheduleNextPlan) {
        await onScheduleNextPlan({
          id: `SCHED-${Date.now()}`,
          scheduledAt: nowIso,
          targetMode: selectedMode,
          planNameAr: selectedMode === 'manager' ? (nextManagerPlan.planNameAr || '') : (nextSubscription.planNameAr || ''),
          billingCycle: selectedCycle,
          upfrontPaidAmount: totalDeductionNow,
          trigger: 'after_current_quota',
          subscriptionPlan: nextSubscription,
          managerPlan: nextManagerPlan
        });
        onClose();
        return;
      }

      // 3. Immediate activation with automatic archiving of the previous cycle
      await onConfirmSubscriptionChange({
        newSubscription: nextSubscription,
        newManagerPlan: nextManagerPlan,
        totalWalletDeduction: totalDeductionNow,
        summaryNote,
        activationTiming: 'immediate'
      });
      onClose();
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(topUpAmount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setIsSubmittingTopUp(true);
    try {
      await onRequestWalletTopUp(amt, topUpNotes);
      setShowTopUpBox(false);
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 overflow-hidden" dir="rtl">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          onClick={onClose}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`relative w-full max-w-6xl rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col max-h-[94vh] z-10 ${
            isDark ? 'bg-[#030712] border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-8 py-6 border-b shrink-0 ${
            isDark ? 'border-slate-800 bg-[#030712]' : 'border-slate-100 bg-white'
          }`}>
            <div className="flex items-center gap-6">
              <div>
                <h2 className="text-2xl font-black tracking-tight leading-none mb-1">اختيار الباقة التشغيلية</h2>
                <p className="text-[11px] font-bold text-slate-500">حدد نظام إدارة متجرك المفضل</p>
              </div>
              
              <div className="h-10 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

              <div className="hidden sm:flex items-center gap-4">
                <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border text-sm font-black tabular-nums transition-all ${
                  isDark
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-emerald-50 border-emerald-200 text-[#008060]'
                }`}>
                  <WalletIcon size={16} />
                  <span>رصيد المحفظة: {walletBalance.toLocaleString()} ج.م</span>
                </div>
                
                <button
                  type="button"
                  onClick={() => setShowTopUpBox(prev => !prev)}
                  className="group flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#008060] hover:bg-emerald-700 text-white text-sm font-black transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  <PlusCircle size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                  <span>شحن المحفظة</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className={`p-3 rounded-2xl transition-all cursor-pointer hover:rotate-90 duration-300 ${
                isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X size={24} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 no-scrollbar space-y-10 bg-slate-50/30 dark:bg-slate-950/20">
            {/* Top-Up Box */}
            <AnimatePresence>
              {showTopUpBox && (
                <motion.form
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  onSubmit={handleTopUpSubmit}
                  className={`overflow-hidden rounded-3xl border mb-6 ${
                    isDark ? 'bg-slate-900 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                          <WalletIcon size={20} />
                        </div>
                        <h4 className="font-black text-lg">طلب شحن فوري للمحفظة</h4>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-4">
                        <label className="block text-xs font-black mb-1.5 text-slate-500 mr-1">المبلغ المطلوب (ج.م)</label>
                        <input
                          type="number"
                          min={50}
                          required
                          value={topUpAmount}
                          onChange={e => setTopUpAmount(e.target.value)}
                          className={`w-full px-4 py-3 rounded-2xl border text-base font-black tabular-nums outline-none transition-all ${
                            isDark ? 'bg-slate-950 border-slate-800 focus:border-emerald-500' : 'bg-white border-slate-200 focus:border-emerald-500'
                          }`}
                        />
                      </div>
                      <div className="md:col-span-8 flex flex-col">
                        <label className="block text-xs font-black mb-1.5 text-slate-500 mr-1">ملاحظات التحويل (مثلاً: إنستا باي / فودافون كاش)</label>
                        <div className="flex gap-2 h-full">
                          <input
                            type="text"
                            value={topUpNotes}
                            onChange={e => setTopUpNotes(e.target.value)}
                            className={`flex-1 px-4 py-3 rounded-2xl border text-sm font-bold outline-none transition-all ${
                              isDark ? 'bg-slate-950 border-slate-800 focus:border-emerald-500' : 'bg-white border-slate-200 focus:border-emerald-500'
                            }`}
                          />
                          <button
                            type="submit"
                            disabled={isSubmittingTopUp}
                            className="px-8 rounded-2xl bg-[#008060] hover:bg-emerald-700 text-white text-sm font-black transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50"
                          >
                            {isSubmittingTopUp ? <Clock className="animate-spin" size={20} /> : 'إرسال الطلب'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Mode Selector */}
            <div className="text-center space-y-8">
              <div className="space-y-2 max-w-2xl mx-auto">
                <h3 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">اختر قوة تشغيل متجرك</h3>
                <p className="text-base font-bold text-slate-500">
                  هل تفضل إدارة تفاصيلك بنفسك؟ أم تريد مديراً مخصصاً يتولى دورة العمليات بالكامل؟
                </p>
              </div>

              <div className="flex justify-center">
                <div className={`p-1.5 rounded-[2rem] border flex w-full max-w-2xl ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}>
                  <button
                    onClick={() => { setSelectedMode('self_service'); setSelectedManagerPlan('none'); }}
                    className={`relative flex-1 py-4 px-6 rounded-[1.75rem] text-sm font-black transition-all flex items-center justify-center gap-3 overflow-hidden cursor-pointer ${
                      selectedMode === 'self_service' ? 'text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {selectedMode === 'self_service' && (
                      <motion.div layoutId="mode-bg" className="absolute inset-0 bg-[#008060] shadow-xl shadow-emerald-500/20" />
                    )}
                    <ShoppingCart className="relative z-10" size={18} />
                    <span className="relative z-10">١. نظام الإدارة الذاتية</span>
                  </button>
                  <button
                    onClick={() => { setSelectedMode('manager'); if (selectedManagerPlan === 'none') setSelectedManagerPlan('per_order_20'); }}
                    className={`relative flex-1 py-4 px-6 rounded-[1.75rem] text-sm font-black transition-all flex items-center justify-center gap-3 overflow-hidden cursor-pointer ${
                      selectedMode === 'manager' ? 'text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {selectedMode === 'manager' && (
                      <motion.div layoutId="mode-bg" className="absolute inset-0 bg-[#008060] shadow-xl shadow-emerald-500/20" />
                    )}
                    <UserCheck className="relative z-10" size={18} />
                    <span className="relative z-10">٢. نظام المدير المخصص</span>
                  </button>
                </div>
              </div>

              {/* Billing Cycle Selector */}
              <div className="flex justify-center pt-2">
                <div className={`p-1.5 rounded-2xl border flex gap-1 w-full max-w-lg ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  {BILLING_CYCLES.map(cycle => {
                    const isActive = selectedCycle === cycle.id;
                    return (
                      <button
                        key={cycle.id}
                        onClick={() => setSelectedCycle(cycle.id)}
                        className={`relative flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                          isActive
                            ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-lg'
                            : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        {cycle.badgeText && (
                          <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md text-[9px] font-black shadow-xs ${
                            cycle.isHighlightBadge ? 'bg-orange-500 text-white' : 'bg-[#008060] text-white'
                          }`}>
                            {cycle.badgeText}
                          </span>
                        )}
                        {cycle.labelAr}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Content Sections */}
            <div className="relative">
              {/* Section A: Self Service */}
              {selectedMode === 'self_service' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <Zap size={20} />
                      </div>
                      <h4 className="text-xl font-black">باقات العمل بنفسك (إدارة ذاتية بالكامل)</h4>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {SELF_SERVICE_PLANS.map((plan) => {
                      const pricing = computeSelfServicePlanPricing(plan, selectedCycle);
                      const isSelected = selectedSelfPlan === plan.id;
                      const isCurrent = !isCurrentlyManagerMode && activeSelfPlanId === plan.id;
                      const isUltimate = plan.id === 'ultimate';

                      return (
                        <motion.div
                          key={plan.id}
                          whileHover={{ y: -5 }}
                          onClick={() => setSelectedSelfPlan(plan.id)}
                          className={`relative group rounded-[2rem] p-7 border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden ${
                            isSelected
                              ? 'border-[#008060] bg-emerald-50/30 dark:bg-emerald-500/5 shadow-2xl shadow-emerald-500/10'
                              : isDark ? 'border-slate-800 bg-slate-900/40 hover:border-slate-700' : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
                          }`}
                        >
                          {plan.isPopular && (
                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#008060] text-white text-[10px] font-black rounded-bl-2xl uppercase tracking-widest">
                              الأكثر طلباً
                            </div>
                          )}

                          <div className="space-y-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <h5 className="text-xl font-black text-slate-900 dark:text-white">{plan.nameAr}</h5>
                                <p className="text-xs font-bold text-slate-400 line-clamp-2 leading-relaxed">{plan.description}</p>
                              </div>
                              {isCurrent && (
                                <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-200 dark:border-emerald-800 shrink-0">باقتك الحالية</span>
                              )}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-baseline gap-2">
                                {plan.baseMonthlyPrice === 0 ? (
                                  <span className="text-3xl font-black text-slate-400">مجانية</span>
                                ) : (
                                  <>
                                    <span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">{toArabicDigits(pricing.discountedMonthlyPrice)}</span>
                                    <span className="text-sm font-bold text-slate-400">ج.م / شهر</span>
                                  </>
                                )}
                              </div>
                              {pricing.totalSaved > 0 && (
                                <p className="text-[11px] font-black text-[#008060] dark:text-emerald-400">وفرت {toArabicDigits(pricing.totalSaved)} ج.م مع الدورة الحالية</p>
                              )}
                            </div>

                            <ul className="space-y-3 pt-2">
                              {plan.features.map((feature, idx) => (
                                <li key={idx} className="flex items-center gap-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                                  <div className="p-0.5 rounded-full bg-emerald-500/10 text-emerald-500 shrink-0">
                                    <Check size={12} strokeWidth={4} />
                                  </div>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className={`mt-8 p-4 rounded-2xl flex items-center justify-between border-t transition-colors ${
                            isSelected ? 'bg-[#008060] text-white border-emerald-600' : isDark ? 'bg-slate-800/50 text-slate-300 border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-100'
                          }`}>
                            <div className="flex items-center gap-2.5">
                              {isUltimate ? <InfinityIcon size={18} /> : <ShoppingCart size={18} />}
                              <span className="text-xs font-black">سعة الأوردرات: {isUltimate ? 'غير محدود' : toArabicDigits(pricing.totalOrdersQuota || 0)}</span>
                            </div>
                            {isSelected && <CheckCircle size={18} className="animate-pulse" />}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Section B: Dedicated Manager */}
              {selectedMode === 'manager' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                        <UserCheck size={20} />
                      </div>
                      <h4 className="text-xl font-black">باقات المدير المخصص (راحة بال تامة)</h4>
                    </div>
                  </div>

                  <div className="rounded-[2.5rem] bg-slate-900 text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[60%] bg-emerald-500/20 blur-[100px] rounded-full pointer-events-none" />
                    <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
                    
                    <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                      <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-widest">
                          <Star size={14} />
                          <span>الخيار الأكثر راحة</span>
                        </div>
                        <h5 className="text-3xl sm:text-4xl font-black leading-tight">تفرغ لتجارتك.. ودع فريق العمليات يدير أوردراتك</h5>
                        <p className="text-slate-400 font-bold leading-relaxed">
                          عند اختيار نظام المدير المخصص، يتم تعيين مسؤول عمليات خبير يتولى إنشاء الأوردرات، التواصل مع العملاء لتأكيد البيانات، والتنسيق مع شركات الشحن نيابةً عنك. لن تحتاج للدخول وإنشاء أي أوردر يدوياً بعد الآن.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { icon: <CheckCircle2 size={16} />, text: 'تأكيد أوردراتك هاتفياً' },
                            { icon: <Send size={16} />, text: 'شحن ومتابعة لحظية' },
                            { icon: <ShieldCheck size={16} />, text: 'أمان مالي ومحاسبي' },
                            { icon: <History size={16} />, text: 'تقارير دورية شاملة' }
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2.5 text-xs font-black text-slate-300">
                              <span className="text-emerald-400">{item.icon}</span>
                              <span>{item.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {DEDICATED_MANAGER_PLANS.filter(p => p.id !== 'monthly_700').map((plan) => {
                          const isSelected = selectedManagerPlan === plan.id;
                          const isCurrent = isCurrentlyManagerMode && activeManagerId === plan.id;
                          const pricing = computeManagerPlanPricing(plan, selectedCycle, adminApprovedCustomFee, customOrdersTarget, customPrepaidQuota);

                          return (
                            <motion.div
                              key={plan.id}
                              whileHover={{ scale: 1.02 }}
                              onClick={() => setSelectedManagerPlan(plan.id)}
                              className={`p-6 rounded-[2rem] border-2 transition-all cursor-pointer relative overflow-hidden group ${
                                isSelected
                                  ? 'bg-white text-slate-900 border-white shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)]'
                                  : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h6 className="text-lg font-black">{plan.nameAr}</h6>
                                    {isCurrent && (
                                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-500 text-white">نشطة حالياً</span>
                                    )}
                                  </div>
                                  <p className={`text-[10px] font-bold ${isSelected ? 'text-slate-500' : 'text-slate-400'}`}>{plan.description}</p>
                                </div>
                                <div className="text-left shrink-0">
                                  <div className={`text-xl font-black tabular-nums ${isSelected ? 'text-[#008060]' : 'text-white'}`}>
                                    {plan.id === 'custom_manager'
                                      ? isCurrent || adminApprovedCustomFee > 0
                                        ? `${toArabicDigits(adminApprovedCustomFee || 20)} ج.م`
                                        : 'بالتخصيص'
                                      : toArabicDigits(pricing.totalCyclePrice || pricing.orderFee || 0)}
                                  </div>
                                  <div className={`text-[10px] font-black ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                                    {plan.id === 'per_order_20'
                                      ? 'ج.م / أوردر'
                                      : plan.id === 'custom_manager'
                                      ? isCurrent || adminApprovedCustomFee > 0
                                        ? 'لكل أوردر (تسعير الإدارة المعتمد)'
                                        : 'يحدده الأدمن'
                                      : `ج.م / ${pricing.cycle.labelAr}`}
                                  </div>
                                </div>
                              </div>
                              
                              {isSelected && plan.id === 'custom_manager' && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  onClick={e => e.stopPropagation()}
                                  className="mt-6 pt-6 border-t border-slate-100 space-y-4"
                                >
                                  {isCurrent && !isEditingActiveCustomPlan ? (
                                    <>
                                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-600">
                                        <div className="flex items-center gap-2 text-[11px] font-black">
                                          <Lock size={14} className="text-slate-500 shrink-0" />
                                          <span>إعدادات وتسعيرة الإدارة المعتمدة (مقفلة أثناء التفعيل لمنع التعديل)</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[9px] font-black shrink-0">
                                          معتمدة من الإدارة 🔒
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-400 mb-1.5">
                                            سعر الأوردر المعتمد (من الإدارة)
                                          </label>
                                          <input
                                            type="text"
                                            disabled
                                            readOnly
                                            value={`${toArabicDigits(adminApprovedCustomFee || 20)} ج.م / أوردر`}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-black cursor-not-allowed select-none opacity-85"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-400 mb-1.5">
                                            العدد المستهدف (شهرياً)
                                          </label>
                                          <input
                                            type="text"
                                            disabled
                                            readOnly
                                            value={`${toArabicDigits(currentManagerPlan?.customOrdersTarget || (currentManagerPlan as any)?.customOrderQuota || customOrdersTarget)} أوردر`}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-black cursor-not-allowed select-none opacity-85"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-400 mb-1.5">
                                            نظام المحاسبة المعتمد
                                          </label>
                                          <input
                                            type="text"
                                            disabled
                                            readOnly
                                            value={currentManagerPlan?.customPrepaidQuota ? 'دفع مسبق للحصة' : 'خصم مع كل أوردر'}
                                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs font-black cursor-not-allowed select-none opacity-85"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex items-center justify-between gap-3 pt-1">
                                        <p className="text-[10px] text-slate-500 font-bold">
                                          هذه الباقة مفعّلة حالياً بتسعير خاص من الإدارة ولا يمكن تغيير شروطها إلا بطلب جديد للإدارة.
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => setIsEditingActiveCustomPlan(true)}
                                          className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 text-[10px] font-black shrink-0 cursor-pointer transition-colors"
                                        >
                                          طلب تعديل شروط التسعير
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      {adminApprovedCustomFee > 0 && (
                                        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-black">
                                          <span className="flex items-center gap-1.5">
                                            <Lock size={13} className="text-slate-500" />
                                            <span>تسعير الإدارة الحالي للأوردر:</span>
                                          </span>
                                          <span className="font-mono text-[#008060]">
                                            {toArabicDigits(adminApprovedCustomFee)} ج.م / أوردر
                                          </span>
                                        </div>
                                      )}
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-400 mb-1.5">العدد المستهدف (شهرياً)</label>
                                          <input
                                            type="number"
                                            value={customOrdersTarget}
                                            onChange={e => setCustomOrdersTarget(Number(e.target.value))}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black outline-none focus:border-[#008060]"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[10px] font-black text-slate-400 mb-1.5">نظام المحاسبة</label>
                                          <select
                                            value={String(customPrepaidQuota)}
                                            onChange={e => setCustomPrepaidQuota(e.target.value === 'true')}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-black outline-none focus:border-[#008060]"
                                          >
                                            <option value="false">خصم مع كل أوردر</option>
                                            <option value="true">دفع مسبق للحصة</option>
                                          </select>
                                        </div>
                                      </div>
                                      <input
                                        type="text"
                                        placeholder="أي ملاحظات إضافية للإدارة..."
                                        value={customMerchantNotes}
                                        onChange={e => setCustomMerchantNotes(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:border-[#008060]"
                                      />
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[10px] text-amber-600 font-bold bg-amber-50 p-2 rounded-lg flex-1">
                                          سيتم إرسال الطلب للإدارة لتحديد السعر الأنسب وإعادة العرض عليك للموافقة.
                                        </p>
                                        {isCurrent && isEditingActiveCustomPlan && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIsEditingActiveCustomPlan(false);
                                              setCustomOrdersTarget(
                                                currentManagerPlan?.customOrdersTarget ||
                                                  (currentManagerPlan as any)?.customOrderQuota ||
                                                  100
                                              );
                                              setCustomPrepaidQuota(Boolean(currentManagerPlan?.customPrepaidQuota));
                                              setCustomMerchantNotes('');
                                            }}
                                            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-black shrink-0 cursor-pointer"
                                          >
                                            إلغاء التعديل 🔒
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </motion.div>
                              )}

                              {isSelected && plan.id !== 'custom_manager' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 text-[10px] font-black text-emerald-600">
                                  <Check size={14} strokeWidth={4} />
                                  تم اختيار باقة {plan.nameAr}
                                </motion.div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
            
            {/* Transition Timing Selector (Immediate Archive vs Scheduled After Quota) */}
            {hasAnyChange && !isCustomPlanRequestSelected && (
              <div className={`p-6 rounded-3xl border-2 space-y-4 ${
                isDark ? 'bg-slate-900/90 border-emerald-500/30' : 'bg-emerald-50/40 border-emerald-200'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-[#008060] text-white">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h5 className="text-sm font-black text-slate-900 dark:text-white">
                        آلية الانتقال بين الباقات (منع التداخل المحاسبي)
                      </h5>
                      <p className="text-xs font-bold text-slate-500">
                        اختر متى تبدأ الباقة الجديدة لضمان عدم تداخل كوتة الأوردرات القديمة مع الجديدة:
                      </p>
                    </div>
                  </div>
                  {remainingOrdersCount !== null && remainingOrdersCount > 0 && (
                    <span className="text-xs font-black text-[#008060] bg-white dark:bg-slate-950 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      متبقي في دورتك الحالية: {toArabicDigits(remainingOrdersCount)} أوردر
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActivationTiming('immediate')}
                    className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-start gap-3 ${
                      activationTiming === 'immediate'
                        ? 'border-[#008060] bg-white dark:bg-slate-950 shadow-md'
                        : isDark
                        ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                        : 'border-slate-200/80 bg-white/60 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                      activationTiming === 'immediate' ? 'border-[#008060] bg-[#008060] text-white' : 'border-slate-400'
                    }`}>
                      {activationTiming === 'immediate' && <Check size={12} strokeWidth={4} />}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        ١. تفعيل فوري الآن (مع أرشفة الدورة الحالية)
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        يتم إغلاق وأرشفة دورتك الحالية ({toArabicDigits(usedOrdersCount)} أوردر منفذ) في سجل الدورات، وتبدأ الباقة الجديدة فوراً برقم دورة مستقل وعداد يبدأ من الصفر (٠).
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivationTiming('after_current_quota')}
                    className={`p-4 rounded-2xl border-2 text-right transition-all cursor-pointer flex items-start gap-3 ${
                      activationTiming === 'after_current_quota'
                        ? 'border-[#008060] bg-white dark:bg-slate-950 shadow-md'
                        : isDark
                        ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                        : 'border-slate-200/80 bg-white/60 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                      activationTiming === 'after_current_quota' ? 'border-[#008060] bg-[#008060] text-white' : 'border-slate-400'
                    }`}>
                      {activationTiming === 'after_current_quota' && <Check size={12} strokeWidth={4} />}
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-black text-slate-900 dark:text-white">
                        ٢. جدولة التفعيل تلقائياً بعد انتهاء الكوتة الحالية
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                        تستمر باقتك الحالية حتى استنفاد كامل الأوردرات المتبقية فيها، ثم تتفعل الباقة الجديدة تلقائياً بدون ضياع أي أوردر من باقتك الحالية.
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Scheduled Next Plan Banner (if exists) */}
            {scheduledNextPlan && (
              <div className={`p-5 rounded-3xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isDark ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-indigo-50/70 border-indigo-200'
              }`}>
                <div className="flex items-center gap-3.5">
                  <div className="p-3 rounded-2xl bg-indigo-600 text-white shrink-0">
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                      باقة مجدولة للتفعيل التلقائي فور انتهاء الكوتة الحالية
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {scheduledNextPlan.planNameAr}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onActivateScheduledPlanNow && (
                    <button
                      type="button"
                      onClick={async () => {
                        await onActivateScheduledPlanNow();
                        onClose();
                      }}
                      className="px-4 py-2 rounded-xl bg-[#008060] hover:bg-emerald-700 text-white text-xs font-black cursor-pointer"
                    >
                      تفعيل الآن فوراً
                    </button>
                  )}
                  {onCancelScheduledPlan && (
                    <button
                      type="button"
                      onClick={onCancelScheduledPlan}
                      className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-xs font-black cursor-pointer"
                    >
                      إلغاء الجدولة
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Governance Info Section & Archived Cycles History */}
            <div className={`p-6 rounded-3xl border space-y-4 ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}>
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h6 className="text-sm font-black mb-0.5">حوكمة الحسابات المالية وعزل الدورات</h6>
                    <p className="text-xs font-bold text-slate-500">
                      يُختم كل أوردر لحظة إنشائه ببصمة الباقة النشطة وقتها (Cycle Snapshot)، وتُؤرشف الدورات السابقة تلقائياً لمنع أي تداخل.
                    </p>
                  </div>
                </div>
                <div className={`px-5 py-2.5 rounded-2xl border text-sm font-black tabular-nums shrink-0 ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200 shadow-sm'
                }`}>
                  أوردرات الدورة النشطة فقط: <span className="text-[#008060]">{toArabicDigits(usedOrdersCount)}</span>
                </div>
              </div>

              {planCyclesHistory.length > 0 && (
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-600 dark:text-slate-300">
                    <History size={15} className="text-[#008060]" />
                    <span>سجل دورات الباقات السابقة المؤرشفة والمعزولة ({toArabicDigits(planCyclesHistory.length)} دورة):</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {planCyclesHistory.slice(0, 6).map((cyc, idx) => (
                      <div
                        key={cyc.cycleId || idx}
                        className={`p-3 rounded-2xl border text-xs space-y-1 ${
                          isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900 dark:text-white truncate">
                            {cyc.planNameAr || cyc.planName || cyc.planId}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            #{String(cyc.cycleId || '').slice(-6)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold">
                          <span>الأوردرات المنفذة بالدورة: <strong className="text-[#008060] font-mono">{cyc.usedOrders ?? cyc.ordersUsedCount ?? 0}</strong></span>
                          <span>{cyc.endedAt ? new Date(cyc.endedAt).toLocaleDateString('ar-EG') : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pending Request / Admin Quote Banner moved into body flow for better visibility */}
            {hasActivePendingRequest && pendingPlanRequest && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`p-8 rounded-[2.5rem] border-2 shadow-xl space-y-6 ${
                  pendingPlanRequest.status === 'quoted_waiting_merchant'
                    ? 'border-[#008060] bg-emerald-50/50 dark:bg-emerald-500/5'
                    : 'border-amber-400 bg-amber-50/50 dark:bg-amber-500/5'
                }`}
              >
                {pendingPlanRequest.status === 'quoted_waiting_merchant' ? (() => {
                  const isPrepaidQuote = Boolean(
                    pendingPlanRequest.requestedPrepaidQuota ??
                      (pendingPlanRequest.requestedCustomBillingPreference === 'prepaid_quota')
                  );
                  const quoteTargetOrders = Number(
                    pendingPlanRequest.quotedOrdersTarget ||
                      pendingPlanRequest.requestedCustomQuota ||
                      pendingPlanRequest.requestedOrdersTarget ||
                      200
                  );
                  const quoteUpfrontCost = isPrepaidQuote
                    ? Number(
                        pendingPlanRequest.quotedTotalUpfront ??
                          Number(pendingPlanRequest.quotedOrderFee || 0) * quoteTargetOrders
                      )
                    : 0;
                  return (
                    <>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="p-3 rounded-2xl bg-[#008060] text-white shadow-lg shadow-emerald-500/30">
                            <Sparkles size={24} />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-xl font-black">عرض سعر مخصص متاح الآن من الإدارة!</h4>
                            <p className="text-sm font-bold text-slate-500">
                              قامت الإدارة بتسعير الباقة المخصصة لك — اضغط (موافقة وتفعيل فوري) لبدء العمل بها.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={onCancelPendingPlanRequest}
                            className="px-6 py-3 rounded-2xl border border-rose-200 text-rose-600 font-black text-xs hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            رفض وإلغاء
                          </button>
                          <button
                            disabled={isPrepaidQuote && walletBalance < quoteUpfrontCost}
                            onClick={async () => {
                              await onAcceptAdminCustomQuote?.(pendingPlanRequest);
                              onClose();
                            }}
                            className="px-8 py-3 rounded-2xl bg-[#008060] hover:bg-emerald-700 text-white font-black text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            موافقة وتفعيل فوري {isPrepaidQuote ? `(${toArabicDigits(quoteUpfrontCost)} ج.م)` : '(٠ ج.م مقدم)'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="space-y-1 text-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">سعر الأوردر المعتمد</span>
                          <div className="text-2xl font-black text-[#008060] tabular-nums">
                            {toArabicDigits(pendingPlanRequest.quotedOrderFee || 0)} ج.م / أوردر
                          </div>
                        </div>
                        <div className="space-y-1 text-center border-x border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">عدد الأوردرات المستهدف</span>
                          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                            {toArabicDigits(quoteTargetOrders)} طلب
                          </div>
                        </div>
                        <div className="space-y-1 text-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">طريقة التحصيل</span>
                          <div className="text-sm font-black text-slate-900 dark:text-white pt-1">
                            {isPrepaidQuote
                              ? `دفع مسبق لكامل الحصة (${toArabicDigits(quoteUpfrontCost)} ج.م)`
                              : 'خصم تلقائي مع كل أوردر (لا يتطلب رصيد مقدم)'}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })() : (
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-2xl bg-amber-500 text-white">
                        <Clock size={24} />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-lg font-black">طلبك قيد المراجعة</h4>
                        <p className="text-xs font-bold text-slate-500">جاري مراجعة طلب الانتقال لباقة <strong className="text-slate-900 dark:text-white">{pendingPlanRequest.planNameAr}</strong> من قبل الإدارة.</p>
                      </div>
                    </div>
                    <button
                      onClick={onCancelPendingPlanRequest}
                      className="px-6 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white text-xs font-black transition-all cursor-pointer"
                    >
                      إلغاء الطلب
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className={`p-6 sm:px-10 py-8 border-t shrink-0 flex flex-col sm:flex-row items-center justify-between gap-6 ${
            isDark ? 'border-slate-800 bg-[#030712]' : 'border-slate-100 bg-white'
          }`}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center sm:text-right">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">المبلغ المطلوب سداده</div>
                <div className="text-3xl font-black text-[#008060] tabular-nums">
                  {toArabicDigits(totalDeductionNow)} <span className="text-sm font-bold">ج.م</span>
                </div>
              </div>
              
              <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800" />

              <div className="flex flex-col gap-1">
                <div className={`text-xs font-black flex items-center gap-2 ${isCustomPlanRequestSelected || isBalanceSufficient ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isCustomPlanRequestSelected || isBalanceSufficient ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  <span>
                    {isCustomPlanRequestSelected
                      ? customPrepaidQuota
                        ? 'طلب تسعير مخصص — سيتم إرسال عرض السعر من الإدارة أولاً دون خصم الآن'
                        : 'تسعير مخصص لكل أوردر — لا يتطلب رصيد مسبق بالمحفظة للتقديم أو التفعيل'
                      : totalDeductionNow === 0
                      ? 'لا يتطلب سداد مقدم — يُخصم تلقائياً مع كل أوردر'
                      : isBalanceSufficient
                      ? 'رصيد المحفظة كافٍ لإتمام التبديل'
                      : 'عذراً.. رصيد المحفظة لا يكفي حالياً'}
                  </span>
                </div>
                {!isCustomPlanRequestSelected && !isBalanceSufficient && (
                  <p className="text-[10px] font-bold text-slate-400">يرجى شحن المحفظة بمبلغ لا يقل عن {toArabicDigits(totalDeductionNow - walletBalance)} ج.م</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={onClose}
                className={`flex-1 sm:flex-none px-10 py-4 rounded-2xl font-black text-sm transition-all cursor-pointer ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'
                }`}
              >
                تراجع
              </button>
              <button
                onClick={handleConfirm}
                disabled={!hasAnyChange || (!isCustomPlanRequestSelected && !isBalanceSufficient) || isSubmittingPlan}
                className={`flex-1 sm:flex-none px-12 py-4 rounded-2xl font-black text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:grayscale ${
                  hasAnyChange ? 'bg-[#008060] hover:bg-emerald-700 text-white shadow-emerald-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isSubmittingPlan ? (
                  <Clock className="animate-spin" size={20} />
                ) : isCustomPlanRequestSelected ? (
                  'إرسال طلب التسعير'
                ) : activationTiming === 'after_current_quota' ? (
                  'جدولة الباقة بعد انتهاء الكوتة الحالية'
                ) : (
                  'تفعيل الباقة الآن (بدورة مستقلة)'
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
