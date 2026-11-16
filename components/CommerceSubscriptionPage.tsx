import React, { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Wallet,
  Package,
  ShieldCheck,
  TrendingUp,
  Check,
  Lock,
  Unlock,
  Plus,
  RefreshCw,
  ArrowRightLeft,
  Copy,
  Layers,
  Users,
  Building2,
  Zap,
  MessageSquare,
  Bot,
  History,
  Info,
  X,
  BadgeCheck,
  Upload,
  FileText,
  Clock,
  AlertTriangle,
  Send,
  Crown,
  Eye,
  Award,
  Infinity as InfinityIcon
} from 'lucide-react';
import {
  CommerceBillingCycle,
  CommerceModuleId,
  CommercePlanDefinition,
  CommercePlanId,
  CustomPlanBillingMode,
  CustomPlanRequest,
  Order,
  QuotaWalletTransaction,
  Settings,
  StoreData,
  StoreVerificationDocType,
  StoreVerificationDocument,
  StoreVerificationTrack,
  User,
  Wallet as WalletType
} from '../types';
import {
  BILLING_CYCLE_META,
  PlanSwitchBreakdown,
  VERIFICATION_DOC_LABELS,
  VERIFICATION_FEE_NON_PAID_EGP,
  VERIFICATION_TIER_META,
  compressVerificationFileToDataUrl,
  computeModulePriceWithBundle,
  computePlanCyclePrice,
  computePlanSwitchBreakdown,
  computeStoreQuotaSummary,
  computeStoreVerificationPolicy,
  creditAffiliateCommission,
  ensureStoreCommerceState,
  evaluateStoreModuleAccess,
  getStoreVerificationTier,
  isStoreVerified,
  usePlatformCommercialCatalog
} from '../utils/commerceEcosystem';
import { VerifiedStoreBadge } from './VerifiedStoreBadge';
import { calculateOrderProfitLoss } from '../utils/financials';
import { getStoreOwnedOrders } from '../utils/merchantProducts';
import { inAppToast } from '../utils/inAppAlert';

interface CommerceSubscriptionPageProps {
  storeId: string;
  orders: Order[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  wallet: WalletType;
  setWallet: React.Dispatch<React.SetStateAction<WalletType>>;
  currentUser?: User | null;
  users?: User[];
  allStoresData?: Record<string, StoreData>;
  setAllStoresData?: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
}

type SubTab = 'plans' | 'modules' | 'packs_affiliate' | 'custom_plan' | 'verification' | 'ledger';

export const CommerceSubscriptionPage: React.FC<CommerceSubscriptionPageProps> = ({
  storeId,
  orders,
  settings,
  setSettings,
  wallet,
  setWallet,
  currentUser,
  users = [],
  allStoresData = {},
  setAllStoresData
}) => {
  const { catalog } = usePlatformCommercialCatalog();
  const [activeTab, setActiveTab] = useState<SubTab>('plans');
  const [selectedCycle, setSelectedCycle] = useState<CommerceBillingCycle>(
    () => ensureStoreCommerceState(settings, storeId).billingCycle || 'monthly'
  );
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'financial' | 'orders' | 'rewards'>('all');

  // Top-up & Internal Transfer Modal State
  const [walletModal, setWalletModal] = useState<'none' | 'topup' | 'internal_transfer'>('none');
  const [topupAmount, setTopupAmount] = useState<string>('500');
  const [topupMethod, setTopupMethod] = useState<'card' | 'instapay' | 'vodafone_cash'>('card');
  const [topupRef, setTopupRef] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('500');
  const [referralInput, setReferralInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const inFlightRef = useRef<boolean>(false);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [pendingPlanConfirm, setPendingPlanConfirm] = useState<{
    plan: CommercePlanDefinition;
    breakdown: PlanSwitchBreakdown;
  } | null>(null);

  const runLocked = async (fn: () => Promise<void> | void) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsBusy(true);
    try {
      await fn();
    } finally {
      inFlightRef.current = false;
      setIsBusy(false);
    }
  };

  const summary = useMemo(
    () => computeStoreQuotaSummary(orders, settings, catalog, storeId),
    [orders, settings, catalog, storeId]
  );
  const commerce = summary.state;
  const storeIsVerified = useMemo(() => isStoreVerified(settings), [settings]);
  const verificationPolicy = useMemo(() => computeStoreVerificationPolicy(commerce), [commerce]);

  // Custom Plan Request Form State
  const [cpBusinessType, setCpBusinessType] = useState<string>('');
  const [cpExpectedOrders, setCpExpectedOrders] = useState<string>('500');
  const [cpBillingMode, setCpBillingMode] = useState<CustomPlanBillingMode>('fixed_cycle');
  const [cpCycle, setCpCycle] = useState<CommerceBillingCycle>('monthly');
  const [cpTargetBudget, setCpTargetBudget] = useState<string>('');
  const [cpTargetPerOrder, setCpTargetPerOrder] = useState<string>('');
  const [cpEmployees, setCpEmployees] = useState<string>('5');
  const [cpWarehouses, setCpWarehouses] = useState<string>('2');
  const [cpPoolStores, setCpPoolStores] = useState<string>('1');
  const [cpModules, setCpModules] = useState<CommerceModuleId[]>([]);
  const [cpNotes, setCpNotes] = useState<string>('');

  // Store Verification (KYC) Form State
  const existingVer = commerce.verification;
  const [verTrack, setVerTrack] = useState<StoreVerificationTrack>(existingVer?.track || 'individual');
  const [verLegalName, setVerLegalName] = useState<string>(existingVer?.legalBusinessName || '');
  const [verNationalId, setVerNationalId] = useState<string>(existingVer?.nationalIdNumber || '');
  const [verCommercialReg, setVerCommercialReg] = useState<string>(existingVer?.commercialRegisterNumber || '');
  const [verTaxCard, setVerTaxCard] = useState<string>(existingVer?.taxCardNumber || '');
  const [verOfficialPhone, setVerOfficialPhone] = useState<string>(existingVer?.officialPhone || currentUser?.phone || '');
  const [verBankAccount, setVerBankAccount] = useState<string>(existingVer?.bankOrWalletAccount || '');
  const [verDocs, setVerDocs] = useState<StoreVerificationDocument[]>(existingVer?.documents || []);
  const [previewDoc, setPreviewDoc] = useState<StoreVerificationDocument | null>(null);
  const [uploadingDocType, setUploadingDocType] = useState<StoreVerificationDocType | null>(null);

  React.useEffect(() => {
    const v = commerce.verification;
    if (v) {
      setVerTrack(v.track || 'individual');
      setVerLegalName(v.legalBusinessName || '');
      setVerNationalId(v.nationalIdNumber || '');
      setVerCommercialReg(v.commercialRegisterNumber || '');
      setVerTaxCard(v.taxCardNumber || '');
      setVerOfficialPhone(v.officialPhone || currentUser?.phone || '');
      setVerBankAccount(v.bankOrWalletAccount || '');
      setVerDocs(Array.isArray(v.documents) ? v.documents : []);
    } else {
      setVerTrack('individual');
      setVerLegalName('');
      setVerNationalId('');
      setVerCommercialReg('');
      setVerTaxCard('');
      setVerOfficialPhone(currentUser?.phone || '');
      setVerBankAccount('');
      setVerDocs([]);
    }
  }, [storeId, commerce.verification?.submittedAt, commerce.verification?.status]);

  // Exact available profit balance in main wallet (matches WalletPage accounting logic)
  const availableMainWalletBalance = useMemo(() => {
    const txs = wallet?.transactions || [];
    const liveBalance = txs.reduce((sum, t) => {
      const amount = Number(t.amount) || 0;
      if (t.id && String(t.id).startsWith('WF-')) return sum;
      if (
        t.category?.startsWith('supply_') ||
        t.details?.toAccountId === 'supply_wallet' ||
        t.details?.fromAccountId === 'supply_wallet' ||
        (t.id && String(t.id).endsWith('-out') && t.note?.includes('محفظة التوريد')) ||
        (t.id && String(t.id).endsWith('-in') && t.note?.includes('محفظة التوريد'))
      ) {
        return sum;
      }
      if (t.type === 'إيداع') {
        if (t.status === 'cancelled') return sum;
        if (t.status === 'pending' && (t.category === 'wallet_charge' || t.category === 'charge')) return sum;
        return sum + amount;
      }
      if (t.type === 'سحب') {
        if (t.details?.treasuryAccountId && t.details.treasuryAccountId !== 'main_wallet') return sum;
        return t.status === 'cancelled' ? sum : sum - amount;
      }
      return sum;
    }, 0);

    const storeOwnedOrders = getStoreOwnedOrders(orders || []);
    const autoClosingDiff = settings.enableAutoClosingDifference
      ? Math.abs(
          storeOwnedOrders
            .filter(o => ['تم_توصيلها', 'تم_التوصيل', 'تم_التحصيل', 'مدفوعة', 'مرتجع_جزئي'].includes(o.status))
            .reduce((sum, o) => sum + (calculateOrderProfitLoss(o, settings).closingDifference || 0), 0)
        )
      : settings.hiddenWalletAmount || 0;
    const hidden = settings.enableHiddenWalletAmount ? autoClosingDiff : 0;
    return Math.max(0, Number((liveBalance - hidden).toFixed(2)));
  }, [wallet?.transactions, orders, settings]);

  // ---------------------------------------------------------------------------
  // Handlers: Top-up & Internal Transfer (+10% Cashback)
  // ---------------------------------------------------------------------------
  const handleExternalTopup = (e: React.FormEvent) => {
    e.preventDefault();
    void runLocked(() => {
      const amt = Math.round(Number(topupAmount) * 100) / 100;
      if (!Number.isFinite(amt) || amt < 50) {
        inAppToast('الحد الأدنى للشحن المباشر 50 ج.م.', 'warning');
        return;
      }

      const nowIso = new Date().toISOString();
      const methodName =
        topupMethod === 'card'
          ? 'بطاقة بنكية'
          : topupMethod === 'instapay'
          ? 'إنستاباي InstaPay'
          : 'فودافون كاش';

      const txId = `QTOP-${Date.now()}`;
      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        const nb = Number((prevState.quotaWalletBalance + amt).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'topup',
          amount: amt,
          balanceAfter: nb,
          titleAr: `شحن محفظة الكوتا (${methodName})`,
          notes: topupRef.trim() ? `مرجع العملية: ${topupRef.trim()}` : 'إيداع مباشر لصالح الاشتراك والموديولات',
          status: 'completed'
        };
        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nb,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      setWalletModal('none');
      setTopupRef('');
      inAppToast(`تم شحن ${amt.toLocaleString()} ج.م إلى محفظة الكوتا التشغيلية بنجاح.`, 'success');
    });
  };

  const handleInternalProfitTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    void runLocked(() => {
      const amt = Math.round(Number(transferAmount) * 100) / 100;
      if (!Number.isFinite(amt) || amt <= 0) {
        inAppToast('أدخل مبلغاً صحيحاً أكبر من الصفر.', 'warning');
        return;
      }
      if (amt > availableMainWalletBalance) {
        inAppToast(
          `الرصيد المتاح للسحب في المحفظة الرئيسية (${availableMainWalletBalance.toLocaleString()} ج.م) لا يكفي لتحويل ${amt.toLocaleString()} ج.م.`,
          'error'
        );
        return;
      }

      const cashbackPct = Number(catalog.internalTransferCashbackPercent ?? 10);
      const bonusAmount = Number(((amt * cashbackPct) / 100).toFixed(2));
      const totalCredited = Number((amt + bonusAmount).toFixed(2));
      const nowIso = new Date().toISOString();
      const txId = `INT-Q-${Date.now()}`;

      // 1. Debit Main Sales Wallet via formal withdrawal transaction
      setWallet(prev => ({
        ...prev,
        balance: Number(((prev.balance || 0) - amt).toFixed(2)),
        transactions: [
          {
            id: txId,
            type: 'سحب',
            amount: amt,
            date: nowIso,
            status: 'completed',
            category: 'profit_withdrawal',
            note: `تحويل أرباح داخلي إلى محفظة الكوتا التشغيلية (شامل كاش باك +${cashbackPct}% = ${bonusAmount.toLocaleString()} ج.م)`,
            details: { destinationType: 'quota_wallet' }
          },
          ...(prev.transactions || [])
        ]
      }));

      // 2. Credit Quota Wallet + Bonus Cashback
      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        const afterTransfer = Number((prevState.quotaWalletBalance + amt).toFixed(2));
        const afterBonus = Number((afterTransfer + bonusAmount).toFixed(2));

        const txs: QuotaWalletTransaction[] = [
          ...(bonusAmount > 0
            ? [
                {
                  id: `${txId}-CB`,
                  date: nowIso,
                  type: 'cashback_bonus' as const,
                  amount: bonusAmount,
                  balanceAfter: afterBonus,
                  referenceId: txId,
                  titleAr: `مكافأة تحويل أرباح داخلية (+${cashbackPct}%)`,
                  notes: `تشجيع تحويل الأرباح لتشغيل الباقات والموديولات`,
                  status: 'completed' as const
                }
              ]
            : []),
          {
            id: `${txId}-IN`,
            date: nowIso,
            type: 'internal_transfer',
            amount: amt,
            balanceAfter: afterTransfer,
            referenceId: txId,
            titleAr: 'تحويل فوري من أرباح المحفظة الرئيسية',
            notes: 'رصيد تشغيلي مخصوم من صافي أرباح المبيعات',
            status: 'completed'
          }
        ];

        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: afterBonus,
            quotaTransactions: [...txs, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      setWalletModal('none');
      inAppToast(
        `تم تحويل ${amt.toLocaleString()} ج.م + ${bonusAmount.toLocaleString()} ج.م كاش باك مجاني (الإجمالي ${totalCredited.toLocaleString()} ج.م) لمحفظة الكوتا!`,
        'success'
      );
    });
  };

  // ---------------------------------------------------------------------------
  // Handlers: Plan Activation (with Pro-Rata Credit, Renewal Stacking & Confirmation)
  // ---------------------------------------------------------------------------
  const handleActivatePlan = async (
    plan: CommercePlanDefinition,
    cycle: CommerceBillingCycle,
    confirmed: boolean = false
  ) => {
    if (commerce.adminPlanLock && !currentUser?.isAdmin) {
      inAppToast('باقة هذا المتجر مثبتة حالياً بواسطة إدارة المنصة.', 'warning');
      return;
    }

    const breakdown = computePlanSwitchBreakdown(commerce, plan, cycle, catalog);
    if (breakdown.mode === 'already_active') {
      inAppToast(`باقة ${plan.nameAr} مفعّلة لديك بالفعل.`, 'info');
      return;
    }

    if (breakdown.netDue > commerce.quotaWalletBalance) {
      inAppToast(
        commerce.quotaWalletBalance < 0
          ? `يجب أولاً تسوية الرصيد المستحق في محفظة الكوتا (${commerce.quotaWalletBalance.toLocaleString()} ج.م) قبل تبديل الباقة إلى ${plan.nameAr}.`
          : `رصيد محفظة الكوتا (${commerce.quotaWalletBalance.toLocaleString()} ج.م) لا يكفي لتفعيل ${plan.nameAr} (الصافي المطلوب ${breakdown.netDue.toLocaleString()} ج.م).`,
        'warning'
      );
      setPendingPlanConfirm(null);
      setWalletModal('internal_transfer');
      return;
    }

    // Require explicit user confirmation for any paid charge, renewal stacking, or downgrading an active paid plan
    if (!confirmed && (breakdown.netDue > 0 || breakdown.mode === 'downgrade' || breakdown.mode === 'upgrade' || breakdown.mode === 'renewal_extend')) {
      setPendingPlanConfirm({ plan, breakdown });
      return;
    }

    await runLocked(async () => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const bonusWa = Number(plan.bonusWhatsappMessages || 0);
      const bonusAi = Number(plan.bonusAiCredits || 0);
      const txId = `PLAN-${plan.id}-${now}`;
      const expectedCharge = breakdown.netDue;

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        const liveBreakdown = computePlanSwitchBreakdown(prevState, plan, cycle, catalog, now);
        if (liveBreakdown.mode === 'already_active' || liveBreakdown.netDue > prevState.quotaWalletBalance) {
          return prev;
        }
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;
        const nextBalance = Number((prevState.quotaWalletBalance - liveBreakdown.netDue).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'plan_charge',
          amount: -liveBreakdown.netDue,
          balanceAfter: nextBalance,
          whatsappDelta: bonusWa || undefined,
          aiDelta: bonusAi || undefined,
          titleAr:
            liveBreakdown.mode === 'renewal_extend'
              ? `تمديد ${plan.nameAr} (+${liveBreakdown.pricing.days} يوم)`
              : liveBreakdown.mode === 'upgrade'
              ? `ترقية ذكية إلى ${plan.nameAr} (${liveBreakdown.pricing.labelAr})`
              : `تفعيل ${plan.nameAr} (${liveBreakdown.pricing.labelAr})`,
          notes:
            liveBreakdown.netDue > 0
              ? `صافي الخصم ${liveBreakdown.netDue.toLocaleString()} ج.م${
                  liveBreakdown.unusedCreditApplied > 0
                    ? ` (بعد خصم ${liveBreakdown.unusedCreditApplied.toLocaleString()} ج.م قيمة الأيام المتبقية)`
                    : liveBreakdown.pricing.discountPercent > 0
                    ? ` بعد خصم ${liveBreakdown.pricing.discountPercent}%`
                    : ''
                }`
              : plan.id === 'pay_as_you_sell'
              ? `تفعيل مسار الانطلاق الحر (${plan.perDeliveredOrderFee} ج.م عن كل أوردر مُسلَّم ومحصّل فقط)`
              : liveBreakdown.unusedCreditApplied > 0
              ? `ترقية مغطاة بالكامل برصيد الأيام المتبقية (${liveBreakdown.unusedCreditApplied.toLocaleString()} ج.م)`
              : 'تفعيل الباقة المجانية',
          referenceId: plan.id,
          status: 'completed'
        };

        const rawPool = Array.isArray(prevState.multiStorePoolIds) && prevState.multiStorePoolIds.length > 0
          ? prevState.multiStorePoolIds
          : [storeId];
        const maxPoolAllowed = Math.max(1, plan.maxStoresInPool + (prevState.extraStoreSlotsCount || 0));
        const clampedPool = [
          storeId,
          ...rawPool.filter(id => id && id !== storeId)
        ].slice(0, maxPoolAllowed);

        return {
          ...prev,
          commerceState: {
            ...prevState,
            activePlanId: plan.id,
            billingCycle: liveBreakdown.effectiveCycle,
            planActivatedAt: liveBreakdown.nextActivatedAt,
            planExpiresAt: liveBreakdown.nextExpiresAt,
            planPaidAmount: liveBreakdown.nextPlanPaidAmount,
            quotaWalletBalance: nextBalance,
            whatsappCredits: prevState.whatsappCredits + bonusWa,
            aiCredits: prevState.aiCredits + bonusAi,
            multiStorePoolIds: clampedPool,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      setPendingPlanConfirm(null);

      if (commerce.referredByCode && expectedCharge > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: commerce.referredByCode,
          paidAmount: expectedCharge,
          purchaseTitleAr: `تفعيل ${plan.nameAr} (${breakdown.pricing.labelAr})`,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(
        breakdown.mode === 'renewal_extend'
          ? `تم تمديد صلاحية ${plan.nameAr} دون فقدان أي أيام متبقية!`
          : `تم تفعيل ${plan.nameAr} بنجاح!`,
        'success'
      );
    });
  };

  // ---------------------------------------------------------------------------
  // Handlers: Module Purchase / Auto-Renew Toggle & Capacity Purchase
  // ---------------------------------------------------------------------------
  const handleToggleModulePurchase = async (moduleId: CommerceModuleId) => {
    const access = evaluateStoreModuleAccess(settings, moduleId, catalog, false);
    if (access.source === 'plan' || access.source === 'admin') {
      inAppToast(`موديول ${access.moduleDef.nameAr} مفعّل لك بالفعل.`, 'info');
      return;
    }

    const activeCount = summary.activeAddonEntries.length;
    const isAlreadyActive = access.allowed && access.source === 'addon';
    const nextCount = isAlreadyActive ? activeCount : activeCount + 1;
    const bundlePricing = computeModulePriceWithBundle(access.moduleDef.monthlyPrice, nextCount, catalog);

    if (commerce.quotaWalletBalance < bundlePricing.finalPrice) {
      inAppToast(
        `الرصيد المطلوب ${bundlePricing.finalPrice.toLocaleString()} ج.م — رصيدك الحالي ${commerce.quotaWalletBalance.toLocaleString()} ج.م.`,
        'warning'
      );
      setWalletModal('internal_transfer');
      return;
    }

    await runLocked(async () => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const baseExpMs = isAlreadyActive && access.expiresAt ? Math.max(now, new Date(access.expiresAt).getTime()) : now;
      const expiresAt = new Date(baseExpMs + 30 * 86400000).toISOString();
      const bonusWa = Number(access.moduleDef.includedWhatsappMessages || 0);
      const bonusAi = Number(access.moduleDef.includedAiCredits || 0);
      const txId = `MOD-${moduleId}-${now}`;
      const expectedPrice = bundlePricing.finalPrice;

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        if (prevState.quotaWalletBalance < expectedPrice) return prev;
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;
        const nextBalance = Number((prevState.quotaWalletBalance - expectedPrice).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'module_charge',
          amount: -expectedPrice,
          balanceAfter: nextBalance,
          whatsappDelta: bonusWa || undefined,
          aiDelta: bonusAi || undefined,
          titleAr: `${isAlreadyActive ? 'تمديد' : 'تفعيل'} موديول ${access.moduleDef.nameAr} (+30 يوم)`,
          notes: bundlePricing.eligible
            ? `خصم الباقة المجمّعة ${bundlePricing.discountPercent}% مطبّق`
            : 'دفع من محفظة الكوتا',
          referenceId: moduleId,
          status: 'completed'
        };

        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nextBalance,
            whatsappCredits: prevState.whatsappCredits + bonusWa,
            aiCredits: prevState.aiCredits + bonusAi,
            activeModules: {
              ...prevState.activeModules,
              [moduleId]: {
                moduleId,
                activatedAt: prevState.activeModules?.[moduleId]?.activatedAt || nowIso,
                expiresAt,
                monthlyPricePaid: expectedPrice,
                autoRenew: prevState.activeModules?.[moduleId]?.autoRenew ?? true
              }
            },
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      if (commerce.referredByCode && expectedPrice > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: commerce.referredByCode,
          paidAmount: expectedPrice,
          purchaseTitleAr: `تفعيل موديول ${access.moduleDef.nameAr}`,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(`تم ${isAlreadyActive ? 'تمديد' : 'تفعيل'} ${access.moduleDef.nameAr} بنجاح.`, 'success');
    });
  };

  const handleBuyCapacityAddon = async (kind: 'employee' | 'warehouse' | 'store_slot') => {
    const price =
      kind === 'employee'
        ? catalog.capacityPricing.extraEmployeeMonthly
        : kind === 'warehouse'
        ? catalog.capacityPricing.extraWarehouseMonthly
        : catalog.capacityPricing.extraStoreSlotMonthly;
    const label =
      kind === 'employee'
        ? 'موظف إضافي'
        : kind === 'warehouse'
        ? 'مخزن إضافي'
        : 'مقعد متجر إضافي في المجمّع';

    if (commerce.quotaWalletBalance < price) {
      inAppToast(`الرصيد غير كافٍ. المطلوب ${price.toLocaleString()} ج.م من محفظة الكوتا.`, 'warning');
      setWalletModal('internal_transfer');
      return;
    }

    await runLocked(async () => {
      const nowIso = new Date().toISOString();
      const txId = `CAP-${kind}-${Date.now()}`;

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        if (prevState.quotaWalletBalance < price) return prev;
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;
        const nextBalance = Number((prevState.quotaWalletBalance - price).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'capacity_charge',
          amount: -price,
          balanceAfter: nextBalance,
          titleAr: `ترقية سعة: +1 ${label}`,
          notes: 'توسعة فورية من محفظة الكوتا',
          status: 'completed'
        };
        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nextBalance,
            extraEmployeesCount:
              kind === 'employee' ? prevState.extraEmployeesCount + 1 : prevState.extraEmployeesCount,
            extraWarehousesCount:
              kind === 'warehouse' ? prevState.extraWarehousesCount + 1 : prevState.extraWarehousesCount,
            extraStoreSlotsCount:
              kind === 'store_slot' ? prevState.extraStoreSlotsCount + 1 : prevState.extraStoreSlotsCount,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      if (commerce.referredByCode && price > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: commerce.referredByCode,
          paidAmount: price,
          purchaseTitleAr: `توسعة ${label}`,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(`تم إضافة +1 ${label} لمتجرك بنجاح.`, 'success');
    });
  };

  // ---------------------------------------------------------------------------
  // Handlers: Rollover Packs, Credit Packs, Pool, Referral
  // ---------------------------------------------------------------------------
  const handleBuyRolloverPack = async (packId: string) => {
    const pack = catalog.rolloverOrderPacks.find(p => p.id === packId);
    if (!pack) return;
    if (commerce.quotaWalletBalance < pack.price) {
      inAppToast(`تحتاج إلى ${pack.price.toLocaleString()} ج.م في محفظة الكوتا لشراء ${pack.nameAr}.`, 'warning');
      setWalletModal('internal_transfer');
      return;
    }

    await runLocked(async () => {
      const nowIso = new Date().toISOString();
      const txId = `PACK-${pack.id}-${Date.now()}`;

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        if (prevState.quotaWalletBalance < pack.price) return prev;
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;
        const nextBalance = Number((prevState.quotaWalletBalance - pack.price).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'pack_purchase',
          amount: -pack.price,
          ordersDelta: pack.ordersCount,
          balanceAfter: nextBalance,
          titleAr: `شراء ${pack.nameAr} (رصيد مُرحّل دائم)`,
          notes: 'رصيد أوردرات لا تنتهي صلاحيته بنهاية الشهر',
          referenceId: pack.id,
          status: 'completed'
        };
        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nextBalance,
            rolloverOrdersBalance: prevState.rolloverOrdersBalance + pack.ordersCount,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      if (commerce.referredByCode && pack.price > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: commerce.referredByCode,
          paidAmount: pack.price,
          purchaseTitleAr: pack.nameAr,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(`تم إضافة +${pack.ordersCount.toLocaleString()} أوردر مُرحّل دائم لرصيدك.`, 'success');
    });
  };

  const handleBuyCreditPack = async (packId: string) => {
    const pack = catalog.creditsPacks.find(p => p.id === packId);
    if (!pack) return;
    if (commerce.quotaWalletBalance < pack.price) {
      inAppToast(`رصيد محفظة الكوتا غير كافٍ لشراء ${pack.nameAr}.`, 'warning');
      setWalletModal('internal_transfer');
      return;
    }

    await runLocked(async () => {
      const nowIso = new Date().toISOString();
      const txId = `CRED-${pack.id}-${Date.now()}`;

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        if (prevState.quotaWalletBalance < pack.price) return prev;
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;
        const nextBalance = Number((prevState.quotaWalletBalance - pack.price).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'pack_purchase',
          amount: -pack.price,
          whatsappDelta: pack.kind === 'whatsapp' ? pack.units : undefined,
          aiDelta: pack.kind === 'ai' ? pack.units : undefined,
          balanceAfter: nextBalance,
          titleAr: `شحن ${pack.nameAr}`,
          notes: 'شحن رصيد تشغيلي فوري من محفظة الكوتا',
          referenceId: pack.id,
          status: 'completed'
        };
        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nextBalance,
            whatsappCredits:
              pack.kind === 'whatsapp' ? prevState.whatsappCredits + pack.units : prevState.whatsappCredits,
            aiCredits: pack.kind === 'ai' ? prevState.aiCredits + pack.units : prevState.aiCredits,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      if (commerce.referredByCode && pack.price > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: commerce.referredByCode,
          paidAmount: pack.price,
          purchaseTitleAr: pack.nameAr,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(`تم شحن ${pack.nameAr} بنجاح.`, 'success');
    });
  };

  const handleToggleAutoFallback = () => {
    const nextVal = !commerce.autoFallbackEnabled;
    setSettings(prev => {
      const prevState = ensureStoreCommerceState(prev, storeId);
      return {
        ...prev,
        commerceState: {
          ...prevState,
          autoFallbackEnabled: nextVal
        }
      };
    });
    inAppToast(
      nextVal
        ? `تم تفعيل وضع الأمان التلقائي (${catalog.fallbackPerOrderFee} ج.م/أوردر إضافي من محفظة الكوتا).`
        : 'تم إيقاف السحب التلقائي للأوردرات الإضافية.',
      'info'
    );
  };

  const handleLinkReferralCode = () => {
    const clean = referralInput.trim().toUpperCase();
    if (!clean) return;
    if (clean === commerce.referralCode.toUpperCase()) {
      inAppToast('لا يمكنك إدخال كود الإحالة الخاص بمتجرك.', 'warning');
      return;
    }

    setSettings(prev => {
      const prevState = ensureStoreCommerceState(prev, storeId);
      return {
        ...prev,
        commerceState: {
          ...prevState,
          referredByCode: clean
        }
      };
    });
    setReferralInput('');
    inAppToast(`تم ربط كود الشريك ${clean} بنجاح.`, 'success');
  };

  const handleTogglePoolStore = (targetSid: string) => {
    setSettings(prev => {
      const prevState = ensureStoreCommerceState(prev, storeId);
      const existing = prevState.multiStorePoolIds || [storeId];
      if (targetSid === storeId) return prev;
      const isIncluded = existing.includes(targetSid);
      if (!isIncluded && existing.length >= summary.maxStoresInPool) {
        inAppToast(`الحد الأقصى لمجمع باقتك هو ${summary.maxStoresInPool} متاجر.`, 'warning');
        return prev;
      }
      const nextPool = isIncluded ? existing.filter(id => id !== targetSid) : [...existing, targetSid];
      return {
        ...prev,
        commerceState: {
          ...prevState,
          multiStorePoolIds: nextPool
        }
      };
    });
  };

  // ---------------------------------------------------------------------------
  // Handlers: Custom Plan Requests & Quoted Offer Acceptance
  // ---------------------------------------------------------------------------
  const handleToggleCustomModule = (modId: CommerceModuleId) => {
    setCpModules(prev => (prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]));
  };

  const handleSubmitCustomPlanRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpBusinessType.trim()) {
      inAppToast('يرجى تحديد نوع النشاط التجاري.', 'warning');
      return;
    }
    const existingPending = (commerce.customPlanRequests || []).some(r => r.status === 'pending');
    if (existingPending) {
      inAppToast('لديك طلب باقة مخصصة قيد المراجعة بالفعل؛ يمكنك متابعته أو إلغاؤه أولاً.', 'warning');
      return;
    }

    const reqId = `CPR-${Date.now()}`;
    const newReq: CustomPlanRequest = {
      id: reqId,
      storeId,
      storeName: settings?.storeName || storeId,
      ownerName: currentUser?.fullName || currentUser?.name || settings?.storeName || 'تاجر',
      ownerPhone: currentUser?.phone || settings?.customization?.contactInfo?.phone || '',
      requestedAt: new Date().toISOString(),
      businessType: cpBusinessType.trim(),
      expectedMonthlyOrders: Math.max(10, Math.round(Number(cpExpectedOrders) || 0)),
      preferredBillingMode: cpBillingMode,
      preferredCycle: cpCycle,
      targetMonthlyBudget: Number(cpTargetBudget) > 0 ? Number(cpTargetBudget) : undefined,
      targetPerOrderFee: Number(cpTargetPerOrder) > 0 ? Number(cpTargetPerOrder) : undefined,
      requestedEmployees: cpEmployees.trim() === '' ? null : Math.max(1, Math.round(Number(cpEmployees) || 1)),
      requestedWarehouses: cpWarehouses.trim() === '' ? null : Math.max(1, Math.round(Number(cpWarehouses) || 1)),
      requestedPoolStores: Math.max(1, Math.round(Number(cpPoolStores) || 1)),
      requestedModules: cpModules,
      notes: cpNotes.trim(),
      status: 'pending'
    };

    setSettings(prev => {
      const prevState = ensureStoreCommerceState(prev, storeId);
      return {
        ...prev,
        commerceState: {
          ...prevState,
          customPlanRequests: [newReq, ...(prevState.customPlanRequests || [])].slice(0, 25)
        }
      };
    });

    setCpNotes('');
    inAppToast('تم إرسال طلب الباقة المخصصة لإدارة المنصة وسيتم مراجعته وإرسال العرض المناسب.', 'success');
  };

  const handleCancelCustomPlanRequest = (reqId: string) => {
    setSettings(prev => {
      const prevState = ensureStoreCommerceState(prev, storeId);
      return {
        ...prev,
        commerceState: {
          ...prevState,
          customPlanRequests: (prevState.customPlanRequests || []).filter(r => r.id !== reqId)
        }
      };
    });
    inAppToast('تم إلغاء الطلب المعلّق.', 'info');
  };

  const handleAcceptQuotedCustomPlan = async (req: CustomPlanRequest) => {
    if (!req.offeredPlan || req.status !== 'quoted') return;
    const offered = req.offeredPlan;
    const isFreeGrant = req.offerPaymentMode === 'admin_free_grant';
    const chargeDue = isFreeGrant ? 0 : Math.max(0, Number(offered.cyclePrice || 0));

    if (chargeDue > commerce.quotaWalletBalance) {
      inAppToast(
        `رصيد محفظة الكوتا (${commerce.quotaWalletBalance.toLocaleString()} ج.م) لا يكفي لتفعيل العرض المخصص (${chargeDue.toLocaleString()} ج.م).`,
        'warning'
      );
      setWalletModal('internal_transfer');
      return;
    }

    await runLocked(async () => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const txId = `CPLAN-${req.id}-${now}`;
      const durationMs = Math.max(1, Number(offered.durationDays || 30)) * 86400000;
      const bonusWa = Number(offered.bonusWhatsappMessages || 0);
      const bonusAi = Number(offered.bonusAiCredits || 0);

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        const liveReq = (prevState.customPlanRequests || []).find(r => r.id === req.id);
        if (!liveReq || liveReq.status !== 'quoted' || !liveReq.offeredPlan) return prev;
        if (prevState.quotaWalletBalance < chargeDue) return prev;
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;

        const nextBal = Number((prevState.quotaWalletBalance - chargeDue).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: isFreeGrant ? 'admin_grant' : 'plan_charge',
          amount: -chargeDue,
          balanceAfter: nextBal,
          whatsappDelta: bonusWa || undefined,
          aiDelta: bonusAi || undefined,
          titleAr: `تفعيل باقة مخصصة: ${offered.nameAr}`,
          notes: isFreeGrant
            ? 'منحة باقة مخصصة مجانية معتمدة من إدارة المنصة'
            : `خصم قيمة العرض المخصص (${chargeDue.toLocaleString()} ج.م · ${offered.durationDays} يوم)`,
          referenceId: offered.id,
          status: 'completed'
        };

        const rawPool =
          Array.isArray(prevState.multiStorePoolIds) && prevState.multiStorePoolIds.length > 0
            ? prevState.multiStorePoolIds
            : [storeId];
        const maxPool = Math.max(1, offered.maxStoresInPool + (prevState.extraStoreSlotsCount || 0));
        const clampedPool = [storeId, ...rawPool.filter(id => id && id !== storeId)].slice(0, maxPool);

        return {
          ...prev,
          commerceState: {
            ...prevState,
            activePlanId: 'custom',
            billingCycle: offered.cycle,
            planActivatedAt: nowIso,
            planExpiresAt: new Date(now + durationMs).toISOString(),
            planPaidAmount: chargeDue,
            quotaWalletBalance: nextBal,
            whatsappCredits: prevState.whatsappCredits + bonusWa,
            aiCredits: prevState.aiCredits + bonusAi,
            multiStorePoolIds: clampedPool,
            customPlanOverride: offered,
            adminPlanLock: Boolean(offered.lockPlan),
            customPlanRequests: (prevState.customPlanRequests || []).map(r =>
              r.id === req.id ? { ...r, status: 'accepted_activated' } : r
            ),
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      if (commerce.referredByCode && chargeDue > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: commerce.referredByCode,
          paidAmount: chargeDue,
          purchaseTitleAr: `تفعيل باقة مخصصة: ${offered.nameAr}`,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(`تم تفعيل باقتك المخصصة "${offered.nameAr}" بنجاح!`, 'success');
    });
  };

  // ---------------------------------------------------------------------------
  // Handlers: Store KYC Verification & Green Badge Submission
  // ---------------------------------------------------------------------------
  const requiredVerificationDocs: StoreVerificationDocType[] =
    verTrack === 'company'
      ? ['national_id_front', 'commercial_register', 'tax_card', 'bank_or_wallet_proof']
      : ['national_id_front', 'national_id_back', 'store_activity_proof', 'bank_or_wallet_proof'];

  const handleUploadVerificationDoc = async (docType: StoreVerificationDocType, file: File | null) => {
    if (!file) return;
    setUploadingDocType(docType);
    try {
      const dataUrl = await compressVerificationFileToDataUrl(file);
      const docObj: StoreVerificationDocument = {
        id: `VDOC-${docType}-${Date.now()}`,
        docType,
        labelAr: VERIFICATION_DOC_LABELS[docType],
        fileName: file.name,
        dataUrl,
        uploadedAt: new Date().toISOString()
      };
      setVerDocs(prev => [...prev.filter(d => d.docType !== docType), docObj]);
      inAppToast(`تم إرفاق ${VERIFICATION_DOC_LABELS[docType]} بنجاح.`, 'success');
    } catch (err: any) {
      inAppToast(err?.message || 'تعذر معالجة الملف المرفق.', 'error');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verLegalName.trim() || !verNationalId.trim() || !verOfficialPhone.trim() || !verBankAccount.trim()) {
      inAppToast('يرجى استكمال الاسم القانوني والرقم القومي ورقم الهاتف والحساب البنكي/المحفظة.', 'warning');
      return;
    }
    if (verTrack === 'company' && (!verCommercialReg.trim() || !verTaxCard.trim())) {
      inAppToast('لمسار الشركات: يرجى إدخال رقم السجل التجاري ورقم البطاقة الضريبية.', 'warning');
      return;
    }

    const missingDoc = requiredVerificationDocs.find(dt => !verDocs.some(d => d.docType === dt));
    if (missingDoc) {
      inAppToast(`المستند المطلوب ناقص: ${VERIFICATION_DOC_LABELS[missingDoc]}`, 'warning');
      return;
    }

    const policy = computeStoreVerificationPolicy(commerce);
    if (policy.fee > commerce.quotaWalletBalance) {
      inAppToast(
        `رسوم فحص ومراجعة التوثيق (${policy.fee.toLocaleString()} ج.م) تتجاوز رصيد محفظة الكوتا الحالي (${commerce.quotaWalletBalance.toLocaleString()} ج.م).`,
        'warning'
      );
      setWalletModal('internal_transfer');
      return;
    }

    await runLocked(async () => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const txId = `VER-FEE-${now}`;
      const filteredDocs = verDocs.filter(d => requiredVerificationDocs.includes(d.docType));

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        const livePolicy = computeStoreVerificationPolicy(prevState, now);
        if (livePolicy.fee > prevState.quotaWalletBalance) return prev;

        const nextBal = Number((prevState.quotaWalletBalance - livePolicy.fee).toFixed(2));
        const nextTxs =
          livePolicy.fee > 0 && !prevState.quotaTransactions.some(t => t.id === txId)
            ? [
                {
                  id: txId,
                  date: nowIso,
                  type: 'verification_fee' as const,
                  amount: -livePolicy.fee,
                  balanceAfter: nextBal,
                  titleAr: 'رسوم فحص ومراجعة توثيق المتجر (الشارة الخضراء)',
                  notes: 'تُدفع لمرة واحدة فقط للباقات غير المدفوعة ولا تتكرر عند إعادة الرفع',
                  referenceId: storeId,
                  status: 'completed' as const
                },
                ...prevState.quotaTransactions
              ].slice(0, 200)
            : prevState.quotaTransactions;

        return {
          ...prev,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nextBal,
            quotaTransactions: nextTxs,
            verification: {
              ...(prevState.verification || {}),
              status: 'pending',
              track: verTrack,
              legalBusinessName: verLegalName.trim(),
              nationalIdNumber: verNationalId.trim(),
              commercialRegisterNumber: verTrack === 'company' ? verCommercialReg.trim() : undefined,
              taxCardNumber: verTrack === 'company' ? verTaxCard.trim() : undefined,
              officialPhone: verOfficialPhone.trim(),
              bankOrWalletAccount: verBankAccount.trim(),
              documents: filteredDocs,
              submittedAt: nowIso,
              rejectionOrRevokeReason: undefined,
              verificationFeePaid: (prevState.verification?.verificationFeePaid || 0) + livePolicy.fee,
              priorityReview: livePolicy.priorityReview
            }
          }
        };
      });

      inAppToast(
        policy.priorityReview
          ? 'تم إرسال ملفات التوثيق بميزة الأولوية (مراجعة خلال 24 ساعة)!'
          : 'تم إرسال طلب التوثيق والأوراق للمراجعة الإدارية بنجاح!',
        'success'
      );
    });
  };

  const filteredLedger = useMemo(() => {
    const list = commerce.quotaTransactions || [];
    if (ledgerFilter === 'financial') {
      return list.filter(t =>
        [
          'topup',
          'internal_transfer',
          'plan_charge',
          'module_charge',
          'capacity_charge',
          'pack_purchase',
          'verification_fee',
          'admin_grant'
        ].includes(t.type)
      );
    }
    if (ledgerFilter === 'orders') {
      return list.filter(t =>
        ['order_quota_fallback', 'pay_per_delivered_fee', 'order_quota_refund'].includes(t.type)
      );
    }
    if (ledgerFilter === 'rewards') {
      return list.filter(t => ['cashback_bonus', 'affiliate_commission'].includes(t.type));
    }
    return list;
  }, [commerce.quotaTransactions, ledgerFilter]);

  const chartMaxVal = useMemo(() => {
    const dataMax = Math.max(10, ...summary.monthlySeries.map(m => m.total));
    return summary.planOrdersLimit ? Math.max(dataMax, summary.planOrdersLimit) : dataMax;
  }, [summary.monthlySeries, summary.planOrdersLimit]);

  const ownerStores = currentUser?.stores || [];

  return (
    <div className="min-h-screen bg-[#f7f8f4] dark:bg-[#06090f] p-4 sm:p-6 lg:p-8 font-sans text-right" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>إدارة الاشتراك والقدرات التجارية</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1.5 text-[#008060] dark:text-[#00ab84] font-black">
                <span>{settings?.storeName || storeId}</span>
                {storeIsVerified && (
                  <VerifiedStoreBadge tier={getStoreVerificationTier(settings)} size="sm" showLabel />
                )}
              </span>
              <span>·</span>
              <span className="font-mono tabular-nums">كود متجرك: {commerce.referralCode}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
              الباقات، محفظة الكوتا والموديولات المرنة
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setWalletModal('internal_transfer')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all shadow-xs cursor-pointer"
            >
              <ArrowRightLeft size={15} />
              <span>تحويل من أرباح المبيعات (+{catalog.internalTransferCashbackPercent}% كاش باك)</span>
            </button>
            <button
              type="button"
              onClick={() => setWalletModal('topup')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white dark:bg-[#0b101b] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 text-xs font-black transition-all cursor-pointer"
            >
              <Plus size={15} className="text-[#008060]" />
              <span>شحن محفظة الكوتا</span>
            </button>
          </div>
        </div>

        {/* Executive Top Cards (2 balanced columns matching planned architecture) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card 1: Current Plan & Fair-Quota Progress */}
          <div className="lg:col-span-6 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">الباقة النشطة حالياً</div>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {summary.activePlan.nameAr}
                  </h2>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-black rounded-md border ${
                      summary.planValid
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}
                  >
                    {summary.planValid ? 'نشط' : 'منتهي الصلاحية'}
                  </span>
                  {commerce.adminPlanLock && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-black rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Lock size={11} />
                      <span>مثبّتة إدارياً</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {summary.activePlan.audienceTagAr}
                </p>
              </div>

              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-400">دورة الفوترة</div>
                <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 tabular-nums">
                  {summary.isCustomPlan && summary.customOverride ? (
                    summary.customOverride.billingMode === 'pay_per_delivered' ? (
                      `${summary.customOverride.perDeliveredOrderFee.toLocaleString()} ج.م / أوردر مُسلّم`
                    ) : summary.customOverride.billingMode === 'hybrid' ? (
                      `${summary.customOverride.cyclePrice.toLocaleString()} ج.م + ${summary.customOverride.perDeliveredOrderFee.toLocaleString()} ج.م/تسليم`
                    ) : summary.customOverride.cyclePrice === 0 ? (
                      'منحة مخصصة مجانية'
                    ) : (
                      `${summary.customOverride.cyclePrice.toLocaleString()} ج.م / ${summary.customOverride.durationDays} يوم`
                    )
                  ) : (
                    <>
                      {BILLING_CYCLE_META[commerce.billingCycle].labelAr} ·{' '}
                      {summary.activePlan.id === 'pay_as_you_sell'
                        ? `${summary.activePlan.perDeliveredOrderFee} ج.م/أوردر مسلّم`
                        : summary.activePlan.monthlyPrice === 0
                        ? 'مجاني'
                        : `${computePlanCyclePrice(summary.activePlan, commerce.billingCycle, catalog).discountedMonthly.toLocaleString()} ج.م/شهر`}
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                  التجديد:{' '}
                  {commerce.planExpiresAt
                    ? new Date(commerce.planExpiresAt).toLocaleDateString('ar-EG', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })
                    : 'تلقائي'}
                </div>
              </div>
            </div>

            {/* Quota Bar */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  استهلاك الأوردرات الفعلي (ضمان الكوتا العادلة — الملغي لا يُخصم)
                </span>
                <span className="font-mono font-black text-slate-900 dark:text-white tabular-nums">
                  {summary.usedInCycle.toLocaleString()} /{' '}
                  {summary.planOrdersLimit === null ? 'غير محدود' : summary.planOrdersLimit.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    summary.usagePercent >= 90
                      ? 'bg-rose-600'
                      : summary.usagePercent >= 75
                      ? 'bg-amber-500'
                      : 'bg-[#008060]'
                  }`}
                  style={{ width: `${summary.usagePercent}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <span>
                  الموظفون: {summary.maxEmployeesAllowed === null ? '∞' : summary.maxEmployeesAllowed} · المخازن:{' '}
                  {summary.maxWarehousesAllowed === null ? '∞' : summary.maxWarehousesAllowed} · مجمّع المتاجر:{' '}
                  {commerce.multiStorePoolIds.length}/{summary.maxStoresInPool}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="font-black text-[#008060] dark:text-[#00ab84] hover:underline cursor-pointer"
                >
                  عرض / تغيير الباقة
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Unified Operations Quota Wallet */}
          <div className="lg:col-span-6 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-xs flex flex-col justify-between gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <Wallet size={14} className="text-[#008060]" />
                  <span>محفظة الكوتا التشغيلية الموحدة (معزولة محاسبياً عن المبيعات)</span>
                </div>
                <div
                  className={`text-3xl font-black mt-1.5 font-mono tabular-nums ${
                    commerce.quotaWalletBalance < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {commerce.quotaWalletBalance.toLocaleString()}{' '}
                  <span className="text-sm font-bold text-slate-500">ج.م</span>
                </div>
                {commerce.quotaWalletBalance < 0 && (
                  <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-1">
                    رصيد مستحق السداد (رسوم أوردرات مُسلّمة) — يرجى شحن المحفظة لتسويته
                  </div>
                )}
              </div>

              <div className="text-left">
                <div className="text-[11px] font-bold text-slate-400">المتاح للتحويل من الأرباح</div>
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                  {availableMainWalletBalance.toLocaleString()} ج.م
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                  يمنحك +{catalog.internalTransferCashbackPercent}% كاش باك فوري
                </div>
              </div>
            </div>

            {/* Sub-Balances Strip */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-2.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">أوردرات دائمة (Rollover)</div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {commerce.rolloverOrdersBalance.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">رصيد رسائل واتساب</div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {commerce.whatsappCredits.toLocaleString()}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">رصيد ذكاء اصطناعي AI</div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                  {commerce.aiCredits.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Savings Radar + 6-Month Quota Bar Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Smart Savings Radar */}
          <div className="lg:col-span-5 bg-white dark:bg-[#0b101b] border border-emerald-300/80 dark:border-emerald-800/60 rounded-xl p-5 shadow-xs flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#008060] dark:text-[#00ab84] flex items-center gap-1.5">
                  <Sparkles size={15} />
                  <span>رادار التوفير الذكي (تحليل آخر 3 شهور)</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-500 tabular-nums">
                  المتوسط: {summary.avgMonthlyOrders.toLocaleString()} طلب/شهر
                </span>
              </div>

              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {summary.smartRadar.monthlySavings > 0
                  ? `وفّر ${summary.smartRadar.monthlySavings.toLocaleString()} ج.م شهرياً بالانتقال إلى ${summary.smartRadar.recommendedPlanNameAr}`
                  : 'أنت على المسار التسعيري المتوازن حالياً'}
              </h3>

              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {summary.smartRadar.reasonAr}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
              <div>
                <div className="text-[10px] font-bold text-slate-400">التقدير الحالي</div>
                <div className="text-sm font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  {summary.smartRadar.currentMonthlySpendEstimate.toLocaleString()} ج.م
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">الموديولات المدفوعة</div>
                <div className="text-sm font-black text-slate-900 dark:text-white font-mono tabular-nums">
                  {summary.activeAddonEntries.length} مفعّل
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400">التوفير المتوقع</div>
                <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {summary.smartRadar.monthlySavings.toLocaleString()} ج.م/ش
                </div>
              </div>
            </div>

            {summary.smartRadar.monthlySavings > 0 && (
              <button
                type="button"
                onClick={() => {
                  const rec = catalog.plans.find(p => p.id === summary.smartRadar.recommendedPlanId);
                  if (rec) void handleActivatePlan(rec, summary.smartRadar.recommendedCycle);
                }}
                className="w-full py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all cursor-pointer"
              >
                ترقية فورية إلى {summary.smartRadar.recommendedPlanNameAr} وتوفير{' '}
                {summary.smartRadar.monthlySavings.toLocaleString()} ج.م/شهر
              </button>
            )}
          </div>

          {/* 6-Month Orders vs Limit Bar Chart */}
          <div className="lg:col-span-7 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  أوردرات المتجر خلال آخر 6 أشهر مقابل حد الباقة
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#008060] inline-block" />
                    <span>من كوتا الباقة</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                    <span>كوتا دائمة / طوارئ</span>
                  </span>
                  {summary.planOrdersLimit !== null && (
                    <span className="text-rose-600 dark:text-rose-400 font-bold tabular-nums">
                      · حد الدورة: {summary.planOrdersLimit.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-mono font-black text-slate-700 dark:text-slate-300 tabular-nums">
                المتوسط: {summary.avgMonthlyOrders.toLocaleString()} / شهر
              </span>
            </div>

            <div className="relative h-44 flex items-end justify-between gap-3 pt-6 pb-2 border-b border-slate-200 dark:border-slate-800">
              {/* Plan limit dashed line */}
              {summary.planOrdersLimit !== null && (
                <div
                  className="absolute inset-x-0 border-t border-dashed border-rose-400/80 pointer-events-none flex justify-end"
                  style={{ bottom: `${Math.min(95, Math.round((summary.planOrdersLimit / chartMaxVal) * 100))}%` }}
                >
                  <span className="text-[10px] font-bold text-rose-500 bg-white dark:bg-[#0b101b] px-1.5 -mt-2.5 tabular-nums">
                    حد الباقة ({summary.planOrdersLimit})
                  </span>
                </div>
              )}

              {summary.monthlySeries.map(item => {
                const planH = Math.max(4, Math.round((item.planOrders / chartMaxVal) * 120));
                const extraH = item.extraOrders > 0 ? Math.max(4, Math.round((item.extraOrders / chartMaxVal) * 120)) : 0;
                return (
                  <div key={item.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.total}
                    </span>
                    <div className="w-full max-w-[44px] flex flex-col justify-end items-stretch rounded-t-md overflow-hidden">
                      {extraH > 0 && (
                        <div className="w-full bg-amber-500 transition-all" style={{ height: `${extraH}px` }} />
                      )}
                      <div
                        className={`w-full transition-all ${item.total > 0 ? 'bg-[#008060]' : 'bg-slate-200 dark:bg-slate-800'}`}
                        style={{ height: `${item.total > 0 ? planH : 4}px` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 pt-2">
              {summary.monthlySeries.map(item => (
                <div key={item.key} className="flex-1 text-center text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: 'plans', label: 'الباقات والمسارات (7 خطط)', icon: <Layers size={15} /> },
            { id: 'modules', label: 'سوق الموديولات والتوسعات (8 إضافات)', icon: <Package size={15} /> },
            { id: 'packs_affiliate', label: 'حزم الكوتا الدائمة، المجمع والأفلييت', icon: <Zap size={15} /> },
            {
              id: 'custom_plan',
              label: `باقة خاصة ومخصصة${
                (commerce.customPlanRequests || []).some(r => r.status === 'quoted')
                  ? ' (عرض جاهز!)'
                  : ''
              }`,
              icon: <Crown size={15} />
            },
            {
              id: 'verification',
              label: storeIsVerified ? 'توثيق المتجر (موثّق ✓)' : 'توثيق المتجر والشارة الخضراء',
              icon: <BadgeCheck size={15} />
            },
            { id: 'ledger', label: 'السجل المالي والاستهلاك العادل', icon: <History size={15} /> }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SubTab)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'border-[#008060] text-[#008060] dark:text-[#00ab84]'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: 7 PLANS & CYCLES */}
        {activeTab === 'plans' && (
          <div className="space-y-5">
            {/* Cycle Selector Bar */}
            <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                اختر مدة الاشتراك (تُخصم من محفظة الكوتا التشغيلية مع تطبيق خصم المدة فوراً):
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['monthly', 'quarterly', 'semi_annual', 'annual'] as CommerceBillingCycle[]).map(cycle => {
                  const meta = BILLING_CYCLE_META[cycle];
                  const disc = catalog.cycleDiscounts?.[cycle] ?? 0;
                  return (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setSelectedCycle(cycle)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                        selectedCycle === cycle
                          ? 'bg-[#008060] text-white border-[#008060]'
                          : 'bg-[#f7f8f4] dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[#008060]'
                      }`}
                    >
                      <span>{meta.labelAr}</span>
                      {disc > 0 && <span className="mr-1 font-mono text-[10px]">(-{disc}%)</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 7 Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {catalog.plans.map(plan => {
                const isCurrent = commerce.activePlanId === plan.id && summary.planValid;
                const isZeroFixedPlan = plan.id === 'free' || plan.id === 'pay_as_you_sell';
                const effectiveCycle: CommerceBillingCycle = isZeroFixedPlan ? 'monthly' : selectedCycle;
                const switchInfo = computePlanSwitchBreakdown(commerce, plan, effectiveCycle, catalog);
                const pricing = switchInfo.pricing;
                const totalDue = switchInfo.netDue;
                const canAfford = commerce.quotaWalletBalance >= totalDue;
                const isCurrentSameCycle = isCurrent && (isZeroFixedPlan || commerce.billingCycle === selectedCycle);

                return (
                  <div
                    key={plan.id}
                    className={`bg-white dark:bg-[#0b101b] rounded-xl p-5 border flex flex-col justify-between gap-4 transition-all ${
                      isCurrent
                        ? 'border-[#008060] ring-1 ring-[#008060]/30 shadow-sm'
                        : plan.isPopular
                        ? 'border-emerald-400/70 dark:border-emerald-700 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold text-[#008060] dark:text-[#00ab84]">
                            {plan.audienceTagAr}
                          </div>
                          <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                            {plan.nameAr}
                          </h3>
                        </div>
                        {plan.isPopular && (
                          <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            الأكثر توفيراً
                          </span>
                        )}
                      </div>

                      {/* Price Display */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        {plan.id === 'pay_as_you_sell' ? (
                          <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                              0 <span className="text-xs font-bold text-slate-500">ج.م / اشتراك شهري</span>
                            </div>
                            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                              + {plan.perDeliveredOrderFee} ج.م من محفظة الكوتا فقط عند تحصيل الأوردر
                            </div>
                          </div>
                        ) : plan.monthlyPrice === 0 ? (
                          <div>
                            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                              مجاناً <span className="text-xs font-bold text-slate-500">0 ج.م / شهرياً</span>
                            </div>
                            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                              حد شهري ثابت (لا يتضاعف بالاشتراك السنوي)
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                                {pricing.discountedMonthly.toLocaleString()}
                              </span>
                              <span className="text-xs font-bold text-slate-500">ج.م / شهر</span>
                              {pricing.discountPercent > 0 && (
                                <span className="text-xs text-slate-400 line-through font-mono tabular-nums">
                                  {plan.monthlyPrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                            {pricing.months > 1 && (
                              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                                الإجمالي ({pricing.labelAr}): {switchInfo.grossCyclePrice.toLocaleString()} ج.م (توفير{' '}
                                {pricing.savedAmount.toLocaleString()} ج.م)
                              </div>
                            )}
                            {switchInfo.unusedCreditApplied > 0 && (
                              <div className="text-[11px] font-black text-emerald-700 dark:text-emerald-400 tabular-nums mt-0.5">
                                خصم رصيد أيام باقتك الحالية: -{switchInfo.unusedCreditApplied.toLocaleString()} ج.م
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {plan.descriptionAr}
                      </p>

                      {/* Limits & Included Modules */}
                      <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between gap-2 font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          <span>سعة الأوردرات:</span>
                          <span className="font-mono text-left">
                            {pricing.totalOrdersQuota === null
                              ? plan.id === 'pay_as_you_sell'
                                ? 'غير مقيد (0 ج.م للمرتجع/الملغي)'
                                : 'غير محدود'
                              : plan.id === 'free'
                              ? `${pricing.totalOrdersQuota.toLocaleString()} أوردر / شهرياً (ثابت)`
                              : pricing.months > 1 && plan.monthlyOrdersLimit !== null
                              ? `${pricing.totalOrdersQuota.toLocaleString()} أوردر (${plan.monthlyOrdersLimit.toLocaleString()} × ${pricing.months} شهر)`
                              : `${pricing.totalOrdersQuota.toLocaleString()} أوردر / شهرياً`}
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          <span>الفريق والمخازن:</span>
                          <span className="font-mono">
                            {plan.maxEmployees === null ? '∞' : plan.maxEmployees} موظف ·{' '}
                            {plan.maxWarehouses === null ? '∞' : plan.maxWarehouses} مخزن
                          </span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                          <span>مجمّع المتاجر (Umbrella Pool):</span>
                          <span className="font-mono">{plan.maxStoresInPool} متجر</span>
                        </div>

                        {plan.includedModules.length > 0 && (
                          <div className="pt-2 space-y-1">
                            <div className="text-[11px] font-black text-slate-500">الموديولات المشمولة مجاناً:</div>
                            {plan.includedModules.map(mid => {
                              const mod = catalog.modules.find(m => m.id === mid);
                              return (
                                <div key={mid} className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <Check size={12} />
                                  <span>{mod?.nameAr || mid}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy || (isCurrentSameCycle && isZeroFixedPlan)}
                      onClick={() => void handleActivatePlan(plan, effectiveCycle, false)}
                      className={`w-full py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer disabled:opacity-60 ${
                        isCurrentSameCycle && isZeroFixedPlan
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default'
                          : canAfford
                          ? 'bg-[#008060] hover:bg-[#006e52] text-white'
                          : 'bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white'
                      }`}
                    >
                      {switchInfo.mode === 'already_active'
                        ? 'الباقة النشطة حالياً'
                        : switchInfo.mode === 'renewal_extend'
                        ? `تمديد مبكر +${pricing.days} يوم (${totalDue.toLocaleString()} ج.م)`
                        : totalDue === 0
                        ? switchInfo.unusedCreditApplied > 0
                          ? `ترقية مجانية برصيدك المتبقي`
                          : `تفعيل ${plan.nameAr} مجاناً`
                        : canAfford
                        ? switchInfo.unusedCreditApplied > 0
                          ? `ترقية صافي (${totalDue.toLocaleString()} ج.م بعد التسوية)`
                          : `تفعيل من محفظة الكوتا (${totalDue.toLocaleString()} ج.م)`
                        : `شحن الكوتا وتفعيل (${totalDue.toLocaleString()} ج.م)`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: 8 MODULAR ADD-ONS + BUNDLE + CAPACITY */}
        {activeTab === 'modules' && (
          <div className="space-y-6">
            {/* 20% Bundle Banner */}
            <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles size={18} className="text-[#008060] shrink-0" />
                <div className="text-xs">
                  <span className="font-black text-slate-900 dark:text-white">
                    خصم الباقة المجمّعة ({catalog.bundleDiscountPercent}% تلقائياً)
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 mr-1.5">
                    — عند تفعيل {catalog.bundleDiscountThreshold} موديولات إضافية فأكثر تحصل على خصم{' '}
                    {catalog.bundleDiscountPercent}% على سعر الموديول من محفظة الكوتا.
                  </span>
                </div>
              </div>
              <div className="text-xs font-mono font-black text-[#008060] dark:text-[#00ab84] tabular-nums shrink-0">
                المفعّل كإضافات: {summary.activeAddonEntries.length} / {catalog.bundleDiscountThreshold}
              </div>
            </div>

            {/* 8 Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {catalog.modules.map(mod => {
                const access = evaluateStoreModuleAccess(settings, mod.id, catalog, false);
                const bundlePricing = computeModulePriceWithBundle(
                  mod.monthlyPrice,
                  access.allowed ? summary.activeAddonEntries.length : summary.activeAddonEntries.length + 1,
                  catalog
                );
                const license = commerce.activeModules?.[mod.id];

                return (
                  <div
                    key={mod.id}
                    className={`bg-white dark:bg-[#0b101b] border rounded-xl p-5 flex flex-col justify-between gap-4 ${
                      access.allowed
                        ? 'border-emerald-300 dark:border-emerald-800'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-black ${
                            access.allowed ? 'text-[#008060] dark:text-[#00ab84]' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {access.allowed ? <Unlock size={13} /> : <Lock size={13} />}
                          <span>
                            {access.source === 'plan'
                              ? 'مشمول بالباقة'
                              : access.source === 'admin'
                              ? 'ممنوح من المنصة'
                              : access.source === 'addon'
                              ? 'مفعّل (إضافة)'
                              : 'مقفل (قراءة فقط)'}
                          </span>
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900 dark:text-white tabular-nums">
                          {bundlePricing.finalPrice.toLocaleString()} ج.م/ش
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{mod.nameAr}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{mod.descriptionAr}</p>

                      {access.source === 'addon' && access.expiresAt && (
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums pt-1">
                          صالح حتى: {new Date(access.expiresAt).toLocaleDateString('ar-EG')}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {access.source === 'plan' || access.source === 'admin' ? (
                        <div className="py-2 text-center rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                          مفعّل بالكامل تلقائياً
                        </div>
                      ) : (
                        <>
                          {license && (
                            <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 cursor-pointer">
                              <span>تجديد تلقائي من الكوتا</span>
                              <input
                                type="checkbox"
                                checked={Boolean(license.autoRenew)}
                                onChange={() =>
                                  setSettings(prev => {
                                    const ps = ensureStoreCommerceState(prev, storeId);
                                    const cur = ps.activeModules?.[mod.id];
                                    if (!cur) return prev;
                                    return {
                                      ...prev,
                                      commerceState: {
                                        ...ps,
                                        activeModules: {
                                          ...ps.activeModules,
                                          [mod.id]: { ...cur, autoRenew: !cur.autoRenew }
                                        }
                                      }
                                    };
                                  })
                                }
                                className="accent-[#008060]"
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleToggleModulePurchase(mod.id)}
                            className="w-full py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all cursor-pointer disabled:opacity-60"
                          >
                            {access.source === 'addon'
                              ? `تمديد 30 يوم (${bundlePricing.finalPrice.toLocaleString()} ج.م)`
                              : `تفعيل فوري (${bundlePricing.finalPrice.toLocaleString()} ج.م)`}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Capacity Expansion Cards */}
            <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                توسعات السعة التشغيلية الفردية (حسب الحاجة بدون تغيير الباقة)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Users size={14} className="text-[#008060]" />
                      <span>مقعد موظف إضافي</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      الحالي المضاف: +{commerce.extraEmployeesCount} ·{' '}
                      {catalog.capacityPricing.extraEmployeeMonthly.toLocaleString()} ج.م/ش
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleBuyCapacityAddon('employee')}
                    className="px-3 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    +1 موظف
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Package size={14} className="text-[#008060]" />
                      <span>مخزن / فرع مخزني إضافي</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      الحالي المضاف: +{commerce.extraWarehousesCount} ·{' '}
                      {catalog.capacityPricing.extraWarehouseMonthly.toLocaleString()} ج.م/ش
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleBuyCapacityAddon('warehouse')}
                    className="px-3 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    +1 مخزن
                  </button>
                </div>

                <div className="p-4 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 size={14} className="text-[#008060]" />
                      <span>مقعد متجر إضافي (Pool)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      الحالي المضاف: +{commerce.extraStoreSlotsCount} ·{' '}
                      {catalog.capacityPricing.extraStoreSlotMonthly.toLocaleString()} ج.م/ش
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleBuyCapacityAddon('store_slot')}
                    className="px-3 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    +1 متجر
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ROLLOVER PACKS, AUTO-FALLBACK, CREDITS, MULTI-STORE POOL & AFFILIATE */}
        {activeTab === 'packs_affiliate' && (
          <div className="space-y-6">
            {/* Rollover Packs + Zero-Lost-Order Safety */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    حزم الأوردرات المُرحّلة الدائمة (Rollover Packs)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    رصيد أوردرات دائم لا تنتهي صلاحيته بنهاية الشهر؛ يُستخدم تلقائياً بمجرد انتهاء كوتا باقتك الشهرية.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {catalog.rolloverOrderPacks.map(pack => {
                    const unitCost = (pack.price / Math.max(1, pack.ordersCount)).toFixed(2);
                    return (
                      <div
                        key={pack.id}
                        className="p-4 rounded-xl bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-black text-slate-900 dark:text-white">{pack.nameAr}</div>
                          <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                            {unitCost} ج.م / أوردر · صالح للأبد
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleBuyRolloverPack(pack.id)}
                          className="px-3.5 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black font-mono tabular-nums cursor-pointer shrink-0 disabled:opacity-60"
                        >
                          شراء {pack.price.toLocaleString()} ج.م
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Zero-Lost-Order Fallback & Fair-Quota Guarantee */}
              <div className="lg:col-span-4 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-[#008060]" />
                      <span>وضع الأمان (Zero-Lost-Order)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleToggleAutoFallback}
                      className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer transition-all ${
                        commerce.autoFallbackEnabled
                          ? 'bg-[#008060] text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {commerce.autoFallbackEnabled ? 'مفعّل' : 'مُعطّل'}
                    </button>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    عند نفاد كوتا الباقة ورصيد الـ Rollover، يستمر استقبال أوردرات عملائك مقابل{' '}
                    <span className="font-mono font-black text-slate-900 dark:text-white tabular-nums">
                      {catalog.fallbackPerOrderFee} ج.م/أوردر
                    </span>{' '}
                    تُخصم من محفظة الكوتا دون توقف المتجر.
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 space-y-1">
                  <div className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                    ضمان الكوتا العادلة (Fair-Quota Guarantee)
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                    الطلبات الملغاة قبل الشحن لا تُخصم من كوتا الباقة، وفي حال استخدام كوتا دائمة أو سحب تلقائي يُرد الرصيد تلقائياً عند الإلغاء.
                  </p>
                </div>
              </div>
            </div>

            {/* WhatsApp & AI Credits Packs */}
            <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                حزم شحن رسائل واتساب الأعمال ونقاط الذكاء الاصطناعي
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {catalog.creditsPacks.map(pack => (
                  <div
                    key={pack.id}
                    className="p-4 rounded-xl bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[#008060]">
                        {pack.kind === 'whatsapp' ? <MessageSquare size={16} /> : <Bot size={16} />}
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 dark:text-white">{pack.nameAr}</div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          +{pack.units.toLocaleString()} {pack.kind === 'whatsapp' ? 'رسالة' : 'نقطة AI'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleBuyCreditPack(pack.id)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-black font-mono tabular-nums cursor-pointer shrink-0 disabled:opacity-60"
                    >
                      {pack.price.toLocaleString()} ج.م
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Multi-Store Umbrella Pool & Recurring Affiliate (15%) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Multi-Store Pool */}
              <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 size={16} className="text-[#008060]" />
                    <span>مجمّع تعدد المتاجر (Multi-Store Umbrella Pool)</span>
                  </h3>
                  <span className="text-xs font-mono font-black text-[#008060] tabular-nums">
                    {commerce.multiStorePoolIds.length} / {summary.maxStoresInPool}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  عند الترقية لباقة المحترفين / الشركات / الوكالات أو إضافة مقعد متجر، يمكنك ربط متاجرك الأخرى لتشارك نفس الكوتا والموديولات.
                </p>

                <div className="space-y-2 pt-1 max-h-52 overflow-y-auto">
                  {ownerStores.map(st => {
                    const checked = commerce.multiStorePoolIds.includes(st.id);
                    const isSelf = st.id === storeId;
                    return (
                      <label
                        key={st.id}
                        className={`p-3 rounded-lg border flex items-center justify-between text-xs cursor-pointer ${
                          checked
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-black text-slate-900 dark:text-white">
                            {st.name} {isSelf ? '(المتجر الرئيسي للمجمع)' : ''}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">{st.id}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isSelf}
                          onChange={() => handleTogglePoolStore(st.id)}
                          className="accent-[#008060]"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Recurring Affiliate Program */}
              <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp size={16} className="text-[#008060]" />
                    <span>برنامج الشركاء والأفلييت المستمر ({catalog.affiliateCommissionPercent}%)</span>
                  </h3>
                  <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    مكاسبك: {commerce.affiliateTotalEarned.toLocaleString()} ج.م
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  شارك كود الدعوة الخاص بمتجرك مع التجار الجدد واحصل تلقائياً على{' '}
                  <span className="font-mono font-black text-slate-900 dark:text-white">
                    {catalog.affiliateCommissionPercent}%
                  </span>{' '}
                  (وحتى{' '}
                  <span className="font-mono font-black">
                    {Math.round(catalog.affiliateCommissionPercent * 1.5)}%
                  </span>{' '}
                  لباقة الوكالات) في محفظة الكوتا مع كل تجديد باقة أو موديول لهم.
                </p>

                <div className="p-3.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400">كود الإحالة الخاص بمتجرك</div>
                    <div className="text-base font-mono font-black text-slate-900 dark:text-white tracking-wider">
                      {commerce.referralCode}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(commerce.referralCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 1800);
                      inAppToast('تم نسخ كود الإحالة بنجاح.', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-black text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {copiedCode ? <Check size={14} className="text-[#008060]" /> : <Copy size={14} />}
                    <span>{copiedCode ? 'تم النسخ' : 'نسخ الكود'}</span>
                  </button>
                </div>

                {commerce.referredByCode ? (
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    تم ربط هذا المتجر بالشريك المُحيل:{' '}
                    <span className="font-mono font-black">{commerce.referredByCode}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={referralInput}
                      onChange={e => setReferralInput(e.target.value)}
                      placeholder="هل تمت دعوتك عبر تاجر/وكالة؟ أدخل كود الإحالة..."
                      className="flex-1 bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleLinkReferralCode}
                      className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 text-white text-xs font-black cursor-pointer"
                    >
                      ربط الكود
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3B: CUSTOM PLAN REQUESTS & ADMIN OFFERS */}
        {activeTab === 'custom_plan' && (
          <div className="space-y-6">
            {/* Active Custom Plan Highlight */}
            {summary.isCustomPlan && summary.customOverride && (
              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-xl p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-900 dark:text-emerald-200">
                    <Crown size={18} className="text-[#008060]" />
                    <span>باقتك الخاصة المفعلة حالياً: {summary.customOverride.nameAr}</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {summary.customOverride.billingMode === 'pay_per_delivered'
                      ? `${summary.customOverride.perDeliveredOrderFee} ج.م / أوردر مُسلّم`
                      : summary.customOverride.billingMode === 'hybrid'
                      ? `${summary.customOverride.cyclePrice.toLocaleString()} ج.م + ${summary.customOverride.perDeliveredOrderFee} ج.م/أوردر`
                      : `${summary.customOverride.cyclePrice.toLocaleString()} ج.م / ${summary.customOverride.durationDays} يوم`}
                  </span>
                </div>
                {summary.customOverride.descriptionAr && (
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">{summary.customOverride.descriptionAr}</p>
                )}
              </div>
            )}

            {/* Quoted Offers Waiting for Merchant Acceptance */}
            {(commerce.customPlanRequests || [])
              .filter(r => r.status === 'quoted' && r.offeredPlan)
              .map(req => {
                const offer = req.offeredPlan!;
                const isFreeGrant = req.offerPaymentMode === 'admin_free_grant';
                const due = isFreeGrant ? 0 : Math.max(0, Number(offer.cyclePrice || 0));
                return (
                  <div
                    key={req.id}
                    className="bg-white dark:bg-[#0b101b] border-2 border-[#008060] rounded-xl p-5 shadow-sm space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      <div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          عرض مخصص جاهز للتفعيل
                        </span>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">{offer.nameAr}</h3>
                      </div>
                      <div className="text-left tabular-nums">
                        <div className="text-xs text-slate-500">التكلفة المطلوبة للتفعيل</div>
                        <div className="text-xl font-black font-mono text-[#008060] dark:text-[#00ab84]">
                          {isFreeGrant ? 'منحة مجانية (0 ج.م)' : `${due.toLocaleString()} ج.م`}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-[#f7f8f4] dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 tabular-nums">
                      <div>
                        <div className="text-slate-500">نظام المحاسبة</div>
                        <div className="font-black text-slate-900 dark:text-white">
                          {offer.billingMode === 'fixed_cycle'
                            ? 'اشتراك دوري ثابت'
                            : offer.billingMode === 'pay_per_delivered'
                            ? `بالأوردر المُسلّم (${offer.perDeliveredOrderFee} ج.م)`
                            : `هجين (${offer.cyclePrice.toLocaleString()} ج.م + ${offer.perDeliveredOrderFee} ج.م/أوردر)`}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">المدة وسعة الأوردرات</div>
                        <div className="font-black text-slate-900 dark:text-white font-mono">
                          {offer.durationDays} يوم ·{' '}
                          {offer.monthlyOrdersLimit === null ? 'غير محدود' : `${offer.monthlyOrdersLimit}/شهر`}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">الفريق والمخازن</div>
                        <div className="font-black text-slate-900 dark:text-white font-mono">
                          {offer.maxEmployees ?? '∞'} موظف · {offer.maxWarehouses ?? '∞'} مخزن · {offer.maxStoresInPool} متجر
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">الموديولات المشمولة</div>
                        <div className="font-black text-emerald-700 dark:text-emerald-400">
                          {offer.includedModules.length > 0 ? `${offer.includedModules.length} موديول مجاني` : 'حسب الإضافات'}
                        </div>
                      </div>
                    </div>

                    {req.adminNote && (
                      <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-black">ملاحظة الإدارة:</span> {req.adminNote}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {offer.lockPlan && (
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Lock size={13} />
                          <span>سيتم تثبيت هذه الباقة الخاصة لحسابك طوال مدة الاتفاق.</span>
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleAcceptQuotedCustomPlan(req)}
                        className="mr-auto px-5 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all cursor-pointer disabled:opacity-60"
                      >
                        {isFreeGrant
                          ? 'تفعيل المنحة المخصصة الآن مجاناً'
                          : due <= commerce.quotaWalletBalance
                          ? `قبول وتفعيل العرض (${due.toLocaleString()} ج.م من الكوتا)`
                          : `شحن الكوتا لتفعيل العرض (${due.toLocaleString()} ج.م)`}
                      </button>
                    </div>
                  </div>
                );
              })}

            {/* Request Form + History */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <form
                onSubmit={handleSubmitCustomPlanRequest}
                className="lg:col-span-7 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
              >
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Crown size={17} className="text-[#008060]" />
                    <span>تقديم طلب باقة خاصة / تسعير مخصص لمتجرك</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    إذا كان حجم طلباتك كبيراً أو تحتاج نظام محاسبة خاص (نسبة/رسوم تسليم مخفضة أو باقة شركات مخصصة)، أرسل متطلباتك لإدارة المنصة لتصميم عرض خاص لك.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      نوع النشاط / المجال التجاري *
                    </label>
                    <input
                      type="text"
                      required
                      value={cpBusinessType}
                      onChange={e => setCpBusinessType(e.target.value)}
                      placeholder="مثال: براند ملابس، مستحضرات تجميل، جملة..."
                      className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      متوسط الأوردرات المتوقع شهرياً *
                    </label>
                    <input
                      type="number"
                      min={10}
                      required
                      value={cpExpectedOrders}
                      onChange={e => setCpExpectedOrders(e.target.value)}
                      className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">نظام المحاسبة المفضّل</label>
                    <select
                      value={cpBillingMode}
                      onChange={e => setCpBillingMode(e.target.value as CustomPlanBillingMode)}
                      className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold text-slate-900 dark:text-white"
                    >
                      <option value="fixed_cycle">اشتراك دوري ثابت (بسعر خاص)</option>
                      <option value="pay_per_delivered">دفع مقابل كل أوردر مُسلّم فقط</option>
                      <option value="hybrid">نظام هجين (اشتراك مخفض + رسم تسليم مخفض)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">مدة الدورة المطلوبة</label>
                    <select
                      value={cpCycle}
                      onChange={e => setCpCycle(e.target.value as CommerceBillingCycle)}
                      className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold text-slate-900 dark:text-white"
                    >
                      <option value="monthly">شهري</option>
                      <option value="quarterly">ربع سنوي (3 شهور)</option>
                      <option value="semi_annual">نصف سنوي (6 شهور)</option>
                      <option value="annual">سنوي (12 شهر)</option>
                    </select>
                  </div>

                  {cpBillingMode !== 'pay_per_delivered' && (
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        الميزانية الشهرية المستهدفة (ج.م - اختياري)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={cpTargetBudget}
                        onChange={e => setCpTargetBudget(e.target.value)}
                        placeholder="مثال: 1500"
                        className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                  )}

                  {cpBillingMode !== 'fixed_cycle' && (
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        الرسوم المستهدفة لكل أوردر مُسلّم (ج.م - اختياري)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={cpTargetPerOrder}
                        onChange={e => setCpTargetPerOrder(e.target.value)}
                        placeholder="مثال: 3"
                        className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">عدد الموظفين المطلوب</label>
                    <input
                      type="number"
                      min={1}
                      value={cpEmployees}
                      onChange={e => setCpEmployees(e.target.value)}
                      placeholder="اتركه فارغاً لعدد غير محدود"
                      className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">المخازن ومتاجر المجمع</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={1}
                        value={cpWarehouses}
                        onChange={e => setCpWarehouses(e.target.value)}
                        placeholder="المخازن"
                        className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                      />
                      <input
                        type="number"
                        min={1}
                        value={cpPoolStores}
                        onChange={e => setCpPoolStores(e.target.value)}
                        placeholder="متاجر المجمع"
                        className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <label className="block font-bold text-slate-600 dark:text-slate-400">
                    الموديولات المطلوبة ضمن الباقة الخاصة:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {catalog.modules.map(mod => {
                      const active = cpModules.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                            active
                              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-[#008060] text-emerald-800 dark:text-emerald-300 font-black'
                              : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => handleToggleCustomModule(mod.id)}
                            className="accent-[#008060]"
                          />
                          <span className="truncate">{mod.nameAr}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">ملاحظات وتفاصيل إضافية</label>
                  <textarea
                    rows={3}
                    value={cpNotes}
                    onChange={e => setCpNotes(e.target.value)}
                    placeholder="اكتب أي تفاصيل تساعد الإدارة في إعداد أفضل تسعير مخصص لمتجرك..."
                    className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all cursor-pointer"
                >
                  <Send size={14} />
                  <span>إرسال طلب الباقة المخصصة للإدارة</span>
                </button>
              </form>

              {/* Requests History */}
              <div className="lg:col-span-5 bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">سجل طلبات الباقات المخصصة</h3>
                {(commerce.customPlanRequests || []).length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400">
                    لم ترسل أي طلبات باقة خاصة حتى الآن.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[520px] overflow-y-auto">
                    {(commerce.customPlanRequests || []).map(req => (
                      <div
                        key={req.id}
                        className="p-3.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-slate-900 dark:text-white">{req.businessType}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              req.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : req.status === 'quoted'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                                : req.status === 'accepted_activated'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}
                          >
                            {req.status === 'pending'
                              ? 'قيد المراجعة'
                              : req.status === 'quoted'
                              ? 'تم إرسال العرض'
                              : req.status === 'accepted_activated'
                              ? 'مفعّل'
                              : 'مرفوض'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {new Date(req.requestedAt).toLocaleDateString('ar-EG')} · متوقع{' '}
                          {req.expectedMonthlyOrders.toLocaleString()} أوردر/ش ·{' '}
                          {req.preferredBillingMode === 'fixed_cycle'
                            ? 'ثابت'
                            : req.preferredBillingMode === 'pay_per_delivered'
                            ? 'بالأوردر المسلم'
                            : 'هجين'}
                        </div>
                        {req.adminNote && (
                          <div className="text-[11px] text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                            رد الإدارة: {req.adminNote}
                          </div>
                        )}
                        {req.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleCancelCustomPlanRequest(req.id)}
                            className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                          >
                            إلغاء الطلب المعلق
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3C: STORE KYC VERIFICATION & GREEN CHECKMARK BADGE */}
        {activeTab === 'verification' && (() => {
          const currentVerTier = getStoreVerificationTier(settings);
          const verifiedBannerClass =
            currentVerTier === 'platform_official'
              ? 'bg-gradient-to-l from-slate-950 via-indigo-950 to-slate-900 border-amber-400/70 text-white'
              : currentVerTier === 'vip_gold'
              ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-400 dark:border-amber-700'
              : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800';
          const isOfficialTheme = storeIsVerified && currentVerTier === 'platform_official';
          return (
          <div className="space-y-6">
            {/* Status & Policy Banner */}
            <div
              className={`rounded-xl p-5 border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                storeIsVerified
                  ? verifiedBannerClass
                  : existingVer?.status === 'pending'
                  ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                  : existingVer?.status === 'rejected' || existingVer?.status === 'revoked'
                  ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                  : 'bg-white dark:bg-[#0b101b] border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className={`text-base font-black flex items-center gap-2 ${isOfficialTheme ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                    <BadgeCheck
                      size={19}
                      className={
                        !storeIsVerified
                          ? 'text-slate-500'
                          : currentVerTier === 'platform_official'
                          ? 'text-amber-300'
                          : currentVerTier === 'vip_gold'
                          ? 'text-amber-500'
                          : 'text-[#008060]'
                      }
                    />
                    <span>
                      {storeIsVerified
                        ? currentVerTier === 'platform_official'
                          ? 'متجر رسمي مُعتمد — يحمل ختم إدارة منصة عبده ميديا بريميم'
                          : currentVerTier === 'vip_gold'
                          ? 'متجرك موثّق بالشارة الذهبية VIP (شريك نجاح)'
                          : 'متجرك موثّق رسمياً ويحمل الشارة الخضراء'
                        : existingVer?.status === 'pending'
                        ? 'ملفات التوثيق قيد المراجعة الإدارية'
                        : existingVer?.status === 'rejected'
                        ? 'تم رفض طلب التوثيق — يمكنك تعديل الأوراق وإعادة الرفع مجاناً'
                        : existingVer?.status === 'revoked'
                        ? 'تم تعليق شارة التوثيق مؤقتاً من الإدارة'
                        : 'قدّم مستنداتك للحصول على شارة التوثيق الخضراء لمتجرك'}
                    </span>
                  </h3>
                  {storeIsVerified && <VerifiedStoreBadge tier={currentVerTier} size="md" showLabel />}
                  {existingVer?.grantedByAdmin && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black ${
                      isOfficialTheme
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                    }`}>
                      <Award size={11} />
                      <span>توثيق إداري مباشر من المنصة</span>
                    </span>
                  )}
                  {storeIsVerified && existingVer?.isLifetime && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                      <InfinityIcon size={12} />
                      <span>مدى الحياة</span>
                    </span>
                  )}
                </div>
                <p className={`text-xs ${isOfficialTheme ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'}`}>
                  {storeIsVerified ? VERIFICATION_TIER_META[currentVerTier].titleTextAr : 'تظهر شارة التوثيق في الهيدر، الفوتر، صفحة المتجر للعملاء ولوحة التحكم لرفع ثقة المشتري ومعدلات إتمام الطلبات.'}
                </p>
                {existingVer?.rejectionOrRevokeReason &&
                  (existingVer.status === 'rejected' || existingVer.status === 'revoked') && (
                    <div className="mt-2 p-2.5 rounded-lg bg-white/80 dark:bg-slate-900/70 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle size={14} />
                      <span>السبب: {existingVer.rejectionOrRevokeReason}</span>
                    </div>
                  )}
                {storeIsVerified && existingVer?.verifiedStoreNameLocked && (
                  <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex flex-wrap items-center gap-1.5 pt-1">
                    <Lock size={13} />
                    <span>
                      الاسم التجاري الموثّق والمقفول لحماية العلامة: &quot;{existingVer.verifiedStoreNameLocked}&quot;
                      {existingVer.isLifetime
                        ? ' · صلاحية التوثيق: مدى الحياة (دائم بدون تاريخ انتهاء)'
                        : existingVer.expiresAt
                        ? ` · صالح حتى ${new Date(existingVer.expiresAt).toLocaleDateString('ar-EG')}`
                        : ''}
                    </span>
                  </div>
                )}
                {existingVer?.grantedByAdmin && existingVer?.grantReason && (
                  <div className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1.5">
                    <Award size={13} />
                    <span>ملاحظة الإدارة: {existingVer.grantReason}</span>
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-white/90 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shrink-0 space-y-1 tabular-nums">
                <div className="font-bold text-slate-500">سياسة رسوم الفحص والأولوية</div>
                <div className="font-black text-sm text-[#008060] dark:text-[#00ab84]">
                  {storeIsVerified && existingVer?.grantedByAdmin && (existingVer.verificationFeePaid ?? 0) === 0
                    ? 'معفى إدارياً (0 ج.م — منحة من الإدارة)'
                    : verificationPolicy.fee === 0
                    ? verificationPolicy.isPaidTierFree
                      ? 'مجاناً 0 ج.م (مشمول في باقتك المدفوعة)'
                      : 'مجاناً 0 ج.م (سبق سداد الرسوم)'
                    : `${VERIFICATION_FEE_NON_PAID_EGP} ج.م لمرة واحدة من محفظة الكوتا`}
                </div>
                <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Clock size={12} />
                  <span>
                    {existingVer?.isLifetime
                      ? 'توثيق دائم مدى الحياة بدون تجديد'
                      : verificationPolicy.priorityReview
                      ? 'أولوية مراجعة خلال 24 ساعة'
                      : 'مراجعة قياسية خلال 2-3 أيام عمل'}
                  </span>
                </div>
              </div>
            </div>

            {storeIsVerified && existingVer?.grantedByAdmin && (existingVer?.documents || []).length === 0 && (
              <div className="rounded-xl p-4 bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-800 text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-2.5">
                <Award size={17} className="text-purple-600 shrink-0" />
                <span>
                  تم توثيق متجرك ومنحك الشارة الخضراء مباشرة من إدارة المنصة؛ لا يلزمك رفع مستندات حالياً، ويمكنك مستقبلاً استكمال أي مستندات إضافية من النموذج أدناه إذا رغبت.
                </span>
              </div>
            )}

            {/* KYC Submission Form */}
            <form
              onSubmit={handleSubmitVerification}
              className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5"
            >
              {/* Track Selection */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                  اختر مسار التوثيق المناسب لوضعك القانوني:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      id: 'individual' as StoreVerificationTrack,
                      title: 'مسار الأفراد والأنشطة الناشئة',
                      desc: 'البطاقة الشخصية (وجه + ظهر) + إثبات ملكية النشاط + إثبات حساب بنكي أو محفظة'
                    },
                    {
                      id: 'company' as StoreVerificationTrack,
                      title: 'مسار الشركات والكيانات الرسمية',
                      desc: 'بطاقة المدير/المالك + السجل التجاري الساري + البطاقة الضريبية + حساب بنكي'
                    }
                  ].map(tr => {
                    const lockedEdit = existingVer?.status === 'pending' || storeIsVerified;
                    return (
                      <button
                        key={tr.id}
                        type="button"
                        disabled={lockedEdit}
                        onClick={() => setVerTrack(tr.id)}
                        className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer disabled:opacity-60 ${
                          verTrack === tr.id
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-[#008060] ring-1 ring-[#008060]/30'
                            : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="text-xs font-black text-slate-900 dark:text-white">{tr.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{tr.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Legal Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    {verTrack === 'company' ? 'الاسم التجاري / اسم الشركة بالسجل *' : 'الاسم الرباعي مطابقاً للبطاقة *'}
                  </label>
                  <input
                    type="text"
                    required
                    disabled={existingVer?.status === 'pending' || storeIsVerified}
                    value={verLegalName}
                    onChange={e => setVerLegalName(e.target.value)}
                    className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">الرقم القومي (14 رقم) *</label>
                  <input
                    type="text"
                    required
                    disabled={existingVer?.status === 'pending' || storeIsVerified}
                    value={verNationalId}
                    onChange={e => setVerNationalId(e.target.value)}
                    className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الهاتف الرسمي *</label>
                  <input
                    type="text"
                    required
                    disabled={existingVer?.status === 'pending' || storeIsVerified}
                    value={verOfficialPhone}
                    onChange={e => setVerOfficialPhone(e.target.value)}
                    className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums disabled:opacity-60"
                  />
                </div>

                {verTrack === 'company' && (
                  <>
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">رقم السجل التجاري *</label>
                      <input
                        type="text"
                        required
                        disabled={existingVer?.status === 'pending' || storeIsVerified}
                        value={verCommercialReg}
                        onChange={e => setVerCommercialReg(e.target.value)}
                        className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">رقم التسجيل الضريبي *</label>
                      <input
                        type="text"
                        required
                        disabled={existingVer?.status === 'pending' || storeIsVerified}
                        value={verTaxCard}
                        onChange={e => setVerTaxCard(e.target.value)}
                        className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white tabular-nums disabled:opacity-60"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                    الحساب البنكي / الآيبان أو إنستاباي / المحفظة *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={existingVer?.status === 'pending' || storeIsVerified}
                    value={verBankAccount}
                    onChange={e => setVerBankAccount(e.target.value)}
                    placeholder="IBAN / رقم المحفظة المسجلة"
                    className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold text-slate-900 dark:text-white disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Document Uploaders */}
              <div className="space-y-3">
                <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                  المستندات المطلوبة (صور واضحة أو PDF حتى 1.5 ميجابايت — يتم ضغط الصور تلقائياً):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {requiredVerificationDocs.map(docType => {
                    const uploaded = verDocs.find(d => d.docType === docType);
                    const lockedEdit = existingVer?.status === 'pending' || storeIsVerified;
                    const isPdf = uploaded?.dataUrl?.startsWith('data:application/pdf');
                    return (
                      <div
                        key={docType}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          uploaded
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {uploaded ? (
                            isPdf ? (
                              <div className="w-11 h-11 rounded-lg bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                                <FileText size={20} />
                              </div>
                            ) : (
                              <img
                                src={uploaded.dataUrl}
                                alt={uploaded.labelAr}
                                className="w-11 h-11 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            )
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                              <Upload size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {VERIFICATION_DOC_LABELS[docType]}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {uploaded ? uploaded.fileName : 'مطلوب الإرفاق'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {uploaded && (
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(uploaded)}
                              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-[#008060] cursor-pointer"
                              title="معاينة"
                            >
                              <Eye size={14} />
                            </button>
                          )}
                          {!lockedEdit && (
                            <label className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 text-white text-[11px] font-black cursor-pointer">
                              {uploadingDocType === docType ? 'جاري الضغط...' : uploaded ? 'تغيير' : 'رفع ملف'}
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="hidden"
                                onChange={e => {
                                  void handleUploadVerificationDoc(docType, e.target.files?.[0] || null);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit / Name Lock Notice */}
              {!storeIsVerified && existingVer?.status !== 'pending' && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-[#008060] shrink-0" />
                    <span>
                      بإرسال الطلب، سيتم تثبيت اسم متجرك الحالي ({settings?.storeName || storeId}) عند الاعتماد لمنع تغيير الهوية بدون مراجعة.
                    </span>
                  </div>
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="px-6 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all cursor-pointer shrink-0 disabled:opacity-60"
                  >
                    {verificationPolicy.fee > 0
                      ? `إرسال طلب التوثيق وخصم ${verificationPolicy.fee} ج.م`
                      : 'إرسال أوراق التوثيق للمراجعة (0 ج.م)'}
                  </button>
                </div>
              )}
            </form>
          </div>
          );
        })()}

        {/* TAB 4: FINANCIAL & FAIR-QUOTA LEDGER */}
        {activeTab === 'ledger' && (
          <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                كشف حساب محفظة الكوتا واستهلاك الأوردرات
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'financial', label: 'الشحن والباقات والموديولات' },
                  { id: 'orders', label: 'استهلاك واسترداد الكوتا' },
                  { id: 'rewards', label: 'الكاش باك والأفلييت' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLedgerFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      ledgerFilter === f.id
                        ? 'bg-[#008060] text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredLedger.length === 0 ? (
              <div className="p-12 text-center text-xs font-bold text-slate-400">
                لا توجد حركات مسجلة في محفظة الكوتا ضمن هذا التصنيف بعد.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#f7f8f4] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black">
                      <th className="py-3 px-4">التاريخ والمرجع</th>
                      <th className="py-3 px-4">البيان والتفاصيل</th>
                      <th className="py-3 px-4">أثر الأوردرات / الرصيد</th>
                      <th className="py-3 px-4">المبلغ (ج.م)</th>
                      <th className="py-3 px-4">رصيد الكوتا بعد الحركة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {filteredLedger.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                          <div>{new Date(tx.date).toLocaleDateString('ar-EG')}</div>
                          <div className="text-[10px] text-slate-400">{tx.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-900 dark:text-white">{tx.titleAr}</div>
                          {tx.notes && <div className="text-[11px] text-slate-500 mt-0.5">{tx.notes}</div>}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-[11px]">
                          {tx.ordersDelta ? (
                            <span className={tx.ordersDelta > 0 ? 'text-emerald-600 font-black' : 'text-amber-600 font-black'}>
                              {tx.ordersDelta > 0 ? `+${tx.ordersDelta}` : tx.ordersDelta} أوردر
                            </span>
                          ) : null}
                          {tx.whatsappDelta ? (
                            <span className="text-emerald-600 font-bold mr-2">+{tx.whatsappDelta} WA</span>
                          ) : null}
                          {tx.aiDelta ? (
                            <span className="text-indigo-600 font-bold mr-2">+{tx.aiDelta} AI</span>
                          ) : null}
                          {!tx.ordersDelta && !tx.whatsappDelta && !tx.aiDelta ? '—' : null}
                        </td>
                        <td
                          className={`py-3 px-4 font-mono font-black tabular-nums whitespace-nowrap ${
                            tx.amount > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : tx.amount < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} ج.م
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                          {tx.balanceAfter.toLocaleString()} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: TOPUP QUOTA WALLET */}
      {walletModal === 'topup' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleExternalTopup}
            className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">شحن محفظة الكوتا التشغيلية</h3>
              <button type="button" onClick={() => setWalletModal('none')} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المبلغ (ج.م)</label>
                <input
                  type="number"
                  min={50}
                  step="any"
                  value={topupAmount}
                  onChange={e => setTopupAmount(e.target.value)}
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">وسيلة الدفع</label>
                <select
                  value={topupMethod}
                  onChange={e => setTopupMethod(e.target.value as any)}
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="card">بطاقة بنكية / دفع إلكتروني</option>
                  <option value="instapay">تحويل فوري إنستاباي (InstaPay)</option>
                  <option value="vodafone_cash">محفظة إلكترونية (فودافون كاش)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">مرجع العملية (اختياري)</label>
                <input
                  type="text"
                  value={topupRef}
                  onChange={e => setTopupRef(e.target.value)}
                  placeholder="مثال: رقم مرجع التحويل..."
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer disabled:opacity-60"
              >
                تأكيد شحن المحفظة
              </button>
              <button
                type="button"
                onClick={() => setWalletModal('none')}
                className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: INTERNAL PROFIT TRANSFER (+10% CASHBACK) */}
      {walletModal === 'internal_transfer' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleInternalProfitTransfer}
            className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                تحويل أرباح لمحفظة الكوتا (+{catalog.internalTransferCashbackPercent}% كاش باك)
              </h3>
              <button type="button" onClick={() => setWalletModal('none')} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>رصيد الأرباح المتاح للسحب بالمحفظة الرئيسية:</span>
                <span className="font-mono font-black text-[#008060] tabular-nums">
                  {availableMainWalletBalance.toLocaleString()} ج.م
                </span>
              </div>
              <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                أي مبلغ يتم تحويله يحصل فوراً على +{catalog.internalTransferCashbackPercent}% كاش باك مجاني داخل محفظة الكوتا!
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المبلغ المراد تحويله (ج.م)</label>
              <input
                type="number"
                min={1}
                step="any"
                value={transferAmount}
                onChange={e => setTransferAmount(e.target.value)}
                className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono font-black text-slate-900 dark:text-white"
                required
              />
              {Number(transferAmount) > 0 && (
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mt-1.5 tabular-nums">
                  سيصلك فعلياً في محفظة الكوتا:{' '}
                  <span className="font-mono font-black">
                    {(
                      Number(transferAmount) *
                      (1 + (catalog.internalTransferCashbackPercent || 10) / 100)
                    ).toLocaleString()}{' '}
                    ج.م
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isBusy}
                className="flex-1 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer disabled:opacity-60"
              >
                تحويل فوري واستلام الكاش باك
              </button>
              <button
                type="button"
                onClick={() => setWalletModal('none')}
                className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: PLAN SWITCH / UPGRADE / RENEWAL CONFIRMATION */}
      {pendingPlanConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {pendingPlanConfirm.breakdown.mode === 'renewal_extend'
                  ? 'تأكيد تمديد الباقة الحالية'
                  : pendingPlanConfirm.breakdown.mode === 'upgrade'
                  ? 'تأكيد الترقية مع تسوية الأيام المتبقية'
                  : pendingPlanConfirm.breakdown.mode === 'downgrade'
                  ? 'تنبيه تبديل باقة نشطة'
                  : 'تأكيد تفعيل الباقة من محفظة الكوتا'}
              </h3>
              <button
                type="button"
                onClick={() => setPendingPlanConfirm(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs bg-[#f7f8f4] dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 tabular-nums">
              <div className="flex justify-between font-bold">
                <span className="text-slate-500">الباقة المختارة:</span>
                <span className="font-black text-slate-900 dark:text-white">
                  {pendingPlanConfirm.plan.nameAr} ({pendingPlanConfirm.breakdown.pricing.labelAr})
                </span>
              </div>
              {pendingPlanConfirm.breakdown.mode === 'renewal_extend' && (
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  لن تفقد أيامك المتبقية ({pendingPlanConfirm.breakdown.remainingDaysOnCurrent} يوم) — سيتم إضافة +{pendingPlanConfirm.breakdown.pricing.days} يوم على تاريخ الانتهاء الحالي.
                </div>
              )}
              {pendingPlanConfirm.breakdown.unusedCreditApplied > 0 && (
                <>
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-500">سعر الباقة الجديدة:</span>
                    <span className="font-mono">{pendingPlanConfirm.breakdown.grossCyclePrice.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                    <span>تسوية الأيام المتبقية ({pendingPlanConfirm.breakdown.remainingDaysOnCurrent} يوم):</span>
                    <span className="font-mono">-{pendingPlanConfirm.breakdown.unusedCreditApplied.toLocaleString()} ج.م</span>
                  </div>
                </>
              )}
              {pendingPlanConfirm.breakdown.mode === 'downgrade' && (
                <div className="p-2.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                  تنبيه: باقتك المدفوعة الحالية ما زال متبقياً فيها {pendingPlanConfirm.breakdown.remainingDaysOnCurrent} يوم. الانتقال الآن سيستبدل الباقة الحالية فوراً بالباقة الأقل دون استرداد نقدي.
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>الصافي المخصوم من محفظة الكوتا:</span>
                <span className="font-mono text-[#008060] dark:text-[#00ab84]">
                  {pendingPlanConfirm.breakdown.netDue.toLocaleString()} ج.م
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  void handleActivatePlan(
                    pendingPlanConfirm.plan,
                    pendingPlanConfirm.breakdown.effectiveCycle,
                    true
                  )
                }
                className="flex-1 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer disabled:opacity-60"
              >
                {isBusy ? 'جاري التنفيذ...' : 'تأكيد وتنفيذ التفعيل'}
              </button>
              <button
                type="button"
                onClick={() => setPendingPlanConfirm(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: KYC DOCUMENT PREVIEW */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{previewDoc.labelAr}</h3>
                <div className="text-[11px] text-slate-500">{previewDoc.fileName}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {previewDoc.dataUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDoc.dataUrl}
                  title={previewDoc.labelAr}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800"
                />
              ) : (
                <img
                  src={previewDoc.dataUrl}
                  alt={previewDoc.labelAr}
                  className="max-w-full max-h-[72vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommerceSubscriptionPage;
