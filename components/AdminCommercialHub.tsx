import React, { useMemo, useState, useEffect } from 'react';
import {
  Save,
  RotateCcw,
  Store as StoreIcon,
  Layers,
  ShieldCheck,
  Check,
  X,
  Gift,
  Lock,
  Unlock,
  Search,
  Wallet,
  Crown,
  BadgeCheck,
  Eye,
  FileText,
  Clock,
  AlertTriangle,
  Infinity as InfinityIcon,
  Award
} from 'lucide-react';
import {
  CommerceBillingCycle,
  CommerceModuleId,
  CommercePlanId,
  CustomPlanBillingMode,
  CustomPlanOverride,
  CustomPlanRequest,
  GovernanceCorrectionRequest,
  PlatformCommercialCatalog,
  QuotaWalletTransaction,
  StoreData,
  StoreVerificationDocument,
  StoreVerificationProfile,
  StoreVerificationTrack,
  TreasuryTransaction,
  User,
  VerificationBadgeTier
} from '../types';
import {
  BILLING_CYCLE_META,
  DEFAULT_PLATFORM_COMMERCIAL_CATALOG,
  VERIFICATION_DOC_LABELS,
  VERIFICATION_TIER_META,
  ensureStoreCommerceState,
  getStoreVerificationTier,
  isStoreVerified,
  savePlatformCommercialCatalog,
  usePlatformCommercialCatalog
} from '../utils/commerceEcosystem';
import { VerifiedStoreBadge } from './VerifiedStoreBadge';
import * as db from '../services/databaseService';
import { inAppToast } from '../utils/inAppAlert';

interface AdminCommercialHubProps {
  users: User[];
  allStoresData: Record<string, StoreData>;
  setAllStoresData: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  currentUser?: User | null;
  initialSubTab?: HubSubTab;
  initialVerifyStoreId?: string;
  onClearVerifyStoreId?: () => void;
}

export type HubSubTab = 'pricing' | 'stores' | 'custom_plans' | 'verification' | 'governance';

export const AdminCommercialHub: React.FC<AdminCommercialHubProps> = ({
  users,
  allStoresData,
  setAllStoresData,
  currentUser,
  initialSubTab,
  initialVerifyStoreId,
  onClearVerifyStoreId
}) => {
  const { catalog } = usePlatformCommercialCatalog();
  const [subTab, setSubTab] = useState<HubSubTab>(initialSubTab || 'pricing');
  const [draft, setDraft] = useState<PlatformCommercialCatalog>(catalog);
  const [savingCatalog, setSavingCatalog] = useState(false);

  // Store management modal states
  const [storeSearch, setStoreSearch] = useState('');
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [grantEgp, setGrantEgp] = useState<string>('200');
  const [grantOrders, setGrantOrders] = useState<string>('50');
  const [grantNote, setGrantNote] = useState<string>('منحة تشجيعية من إدارة المنصة');
  const [overridePlanId, setOverridePlanId] = useState<CommercePlanId>('free');

  // Custom Plan Builder Modal states
  const [cpModal, setCpModal] = useState<{ storeId: string; storeName: string; requestId?: string } | null>(null);
  const [cpNameAr, setCpNameAr] = useState('باقة مخصصة للشركاء');
  const [cpDescriptionAr, setCpDescriptionAr] = useState('');
  const [cpBillingMode, setCpBillingMode] = useState<CustomPlanBillingMode>('fixed_cycle');
  const [cpCycle, setCpCycle] = useState<CommerceBillingCycle>('monthly');
  const [cpDurationDays, setCpDurationDays] = useState('30');
  const [cpCyclePrice, setCpCyclePrice] = useState('1200');
  const [cpPerOrderFee, setCpPerOrderFee] = useState('0');
  const [cpOrdersLimit, setCpOrdersLimit] = useState('1000');
  const [cpMaxEmployees, setCpMaxEmployees] = useState('10');
  const [cpMaxWarehouses, setCpMaxWarehouses] = useState('3');
  const [cpMaxStoresInPool, setCpMaxStoresInPool] = useState('2');
  const [cpModules, setCpModules] = useState<CommerceModuleId[]>([]);
  const [cpBonusWa, setCpBonusWa] = useState('0');
  const [cpBonusAi, setCpBonusAi] = useState('0');
  const [cpLockPlan, setCpLockPlan] = useState(true);
  const [cpPaymentMode, setCpPaymentMode] = useState<'merchant_pays' | 'admin_free_grant'>('merchant_pays');
  const [cpAdminNote, setCpAdminNote] = useState('');
  const [cpRejectModal, setCpRejectModal] = useState<{ storeId: string; reqId: string } | null>(null);
  const [cpRejectReason, setCpRejectReason] = useState('');

  // Store Verification Review states
  const [verFilter, setVerFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [adminPreviewDoc, setAdminPreviewDoc] = useState<StoreVerificationDocument | null>(null);
  const [verActionModal, setVerActionModal] = useState<{
    storeId: string;
    storeName: string;
    action: 'rejected' | 'revoked';
  } | null>(null);
  const [verReasonInput, setVerReasonInput] = useState('');
  const [directVerModal, setDirectVerModal] = useState<{
    storeId: string;
    verifiedName: string;
    track: StoreVerificationTrack;
    badgeTier: VerificationBadgeTier;
    duration: 'lifetime' | '2_years' | '1_year' | '6_months';
    reason: string;
    waiveFee: boolean;
  } | null>(null);

  useEffect(() => {
    setDraft(catalog);
  }, [catalog]);

  useEffect(() => {
    if (initialSubTab) {
      setSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  // All valid stores joined with owner info
  const validStores = useMemo(() => {
    const rows: Array<{
      storeId: string;
      storeMeta: any;
      owner: User;
      data: StoreData;
      commerce: ReturnType<typeof ensureStoreCommerceState>;
    }> = [];
    users.forEach(u => {
      (u.stores || []).forEach(st => {
        if (!st?.id) return;
        const sdata = allStoresData[st.id];
        if (!sdata) return;
        rows.push({
          storeId: st.id,
          storeMeta: st,
          owner: u,
          data: sdata,
          commerce: ensureStoreCommerceState(sdata.settings, st.id)
        });
      });
    });
    return rows;
  }, [users, allStoresData]);

  // Governance Maker-Checker requests across all stores
  const allGovernanceRequests = useMemo(() => {
    const items: Array<{ storeId: string; storeMeta: any; req: GovernanceCorrectionRequest }> = [];
    validStores.forEach(vs => {
      const reqs = vs.data.settings?.governanceRequests || [];
      reqs.forEach(req => {
        items.push({ storeId: vs.storeId, storeMeta: vs.storeMeta, req });
      });
    });
    return items.sort((a, b) => {
      if (a.req.status === 'pending' && b.req.status !== 'pending') return -1;
      if (a.req.status !== 'pending' && b.req.status === 'pending') return 1;
      return new Date(b.req.requestedAt).getTime() - new Date(a.req.requestedAt).getTime();
    });
  }, [validStores]);

  const pendingGovernanceCount = useMemo(
    () => allGovernanceRequests.filter(i => i.req.status === 'pending').length,
    [allGovernanceRequests]
  );

  // Custom plan requests across all stores
  const allCustomPlanRequests = useMemo(() => {
    const list: Array<{ storeId: string; storeMeta: any; owner: User; req: CustomPlanRequest }> = [];
    validStores.forEach(vs => {
      (vs.commerce.customPlanRequests || []).forEach(req => {
        list.push({ storeId: vs.storeId, storeMeta: vs.storeMeta, owner: vs.owner, req });
      });
    });
    return list.sort((a, b) => {
      if (a.req.status === 'pending' && b.req.status !== 'pending') return -1;
      if (a.req.status !== 'pending' && b.req.status === 'pending') return 1;
      return new Date(b.req.requestedAt).getTime() - new Date(a.req.requestedAt).getTime();
    });
  }, [validStores]);

  const pendingCustomPlansCount = useMemo(
    () => allCustomPlanRequests.filter(i => i.req.status === 'pending').length,
    [allCustomPlanRequests]
  );

  // Store KYC verification applications across all stores
  const verificationApplications = useMemo(() => {
    return validStores
      .filter(vs => vs.commerce.verification && vs.commerce.verification.status !== 'unverified')
      .sort((a, b) => {
        const av = a.commerce.verification!;
        const bv = b.commerce.verification!;
        if (av.status === 'pending' && bv.status !== 'pending') return -1;
        if (av.status !== 'pending' && bv.status === 'pending') return 1;
        if (av.status === 'pending' && bv.status === 'pending') {
          if (av.priorityReview && !bv.priorityReview) return -1;
          if (!av.priorityReview && bv.priorityReview) return 1;
        }
        return new Date(bv.submittedAt || 0).getTime() - new Date(av.submittedAt || 0).getTime();
      });
  }, [validStores]);

  const pendingVerificationCount = useMemo(
    () => verificationApplications.filter(v => v.commerce.verification?.status === 'pending').length,
    [verificationApplications]
  );

  const filteredVerifications = useMemo(() => {
    if (verFilter === 'all') return verificationApplications;
    if (verFilter === 'rejected') {
      return verificationApplications.filter(
        v => v.commerce.verification?.status === 'rejected' || v.commerce.verification?.status === 'revoked'
      );
    }
    return verificationApplications.filter(v => v.commerce.verification?.status === verFilter);
  }, [verificationApplications, verFilter]);

  // KPI metrics
  const kpis = useMemo(() => {
    let totalQuotaBalance = 0;
    let totalSubscriptionSpend = 0;
    let paidStores = 0;
    validStores.forEach(({ commerce }) => {
      totalQuotaBalance += commerce.quotaWalletBalance;
      if (commerce.activePlanId !== 'free' && commerce.activePlanId !== 'pay_as_you_sell') {
        paidStores += 1;
      }
      commerce.quotaTransactions.forEach(tx => {
        if (['plan_charge', 'module_charge', 'capacity_charge', 'pack_purchase', 'pay_per_delivered_fee', 'order_quota_fallback'].includes(tx.type)) {
          totalSubscriptionSpend += Math.abs(Number(tx.amount || 0));
        }
      });
    });
    return {
      totalStores: validStores.length,
      paidStores,
      totalQuotaBalance: Math.round(totalQuotaBalance),
      totalSubscriptionSpend: Math.round(totalSubscriptionSpend)
    };
  }, [validStores]);

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return validStores;
    return validStores.filter(
      vs =>
        vs.storeMeta.name?.toLowerCase().includes(q) ||
        vs.storeId.toLowerCase().includes(q) ||
        vs.owner.fullName?.toLowerCase().includes(q) ||
        vs.owner.phone?.includes(q)
    );
  }, [validStores, storeSearch]);

  const selectedStoreRow = useMemo(
    () => validStores.find(vs => vs.storeId === selectedStoreId) || null,
    [validStores, selectedStoreId]
  );

  // ---------------------------------------------------------------------------
  // Catalog Save
  // ---------------------------------------------------------------------------
  const handleSaveCatalog = async () => {
    setSavingCatalog(true);
    try {
      await savePlatformCommercialCatalog(draft);
      inAppToast('تم حفظ وتعميم تسعير الباقات والموديولات على جميع المتاجر فوراً.', 'success');
    } finally {
      setSavingCatalog(false);
    }
  };

  const handleResetCatalog = async () => {
    setDraft(DEFAULT_PLATFORM_COMMERCIAL_CATALOG);
    await savePlatformCommercialCatalog(DEFAULT_PLATFORM_COMMERCIAL_CATALOG);
    inAppToast('تمت استعادة التسعير الافتراضي وتعميمه.', 'info');
  };

  // ---------------------------------------------------------------------------
  // Store Grant / VIP / Plan Actions
  // ---------------------------------------------------------------------------
  const persistStoreUpdate = async (
    targetStoreId: string,
    updater: (sdata: StoreData) => StoreData
  ) => {
    const existing = allStoresData[targetStoreId];
    const meta =
      users.flatMap(u => u.stores || []).find(s => s.id === targetStoreId) ||
      ({ id: targetStoreId, name: existing?.settings?.storeName || targetStoreId } as any);
    if (!existing) return;

    const updated = updater(existing);
    setAllStoresData(prev => ({ ...prev, [targetStoreId]: updated }));
    await db.saveStoreData(meta, updated).catch(() => {});
  };

  const handleGrantQuotaOrOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStoreRow) return;
    const egp = Math.max(0, Number(grantEgp) || 0);
    const ord = Math.max(0, Math.round(Number(grantOrders) || 0));
    if (egp <= 0 && ord <= 0) {
      inAppToast('أدخل رصيد ج.م أو عدد أوردرات للمنح.', 'warning');
      return;
    }

    const nowIso = new Date().toISOString();
    await persistStoreUpdate(selectedStoreRow.storeId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, selectedStoreRow.storeId);
      const nextBal = Number((prevState.quotaWalletBalance + egp).toFixed(2));
      const nextRollover = prevState.rolloverOrdersBalance + ord;
      const tx: QuotaWalletTransaction = {
        id: `ADM-GR-${Date.now()}`,
        date: nowIso,
        type: 'admin_grant',
        amount: egp,
        ordersDelta: ord || undefined,
        balanceAfter: nextBal,
        titleAr: grantNote.trim() || 'منحة رصيد من إدارة المنصة',
        notes: `بواسطة المشرف العام (${currentUser?.fullName || 'Admin'})`,
        status: 'completed'
      };
      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            quotaWalletBalance: nextBal,
            rolloverOrdersBalance: nextRollover,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        }
      };
    });

    inAppToast(`تم شحن محفظة الكوتا للمتجر [${selectedStoreRow.storeMeta.name}] بنجاح.`, 'success');
  };

  const handleAdminSwitchStorePlan = async (targetStoreId: string, nextPlanId: CommercePlanId) => {
    const nowIso = new Date().toISOString();
    const nextExp = new Date(Date.now() + 30 * 86400000).toISOString();
    const planDef = draft.plans.find(p => p.id === nextPlanId);

    await persistStoreUpdate(targetStoreId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, targetStoreId);
      const maxPool = Math.max(1, (planDef?.maxStoresInPool || 1) + (prevState.extraStoreSlotsCount || 0));
      const rawPool = Array.isArray(prevState.multiStorePoolIds) && prevState.multiStorePoolIds.length > 0
        ? prevState.multiStorePoolIds
        : [targetStoreId];
      const clampedPool = [targetStoreId, ...rawPool.filter(id => id && id !== targetStoreId)].slice(0, maxPool);

      const tx: QuotaWalletTransaction = {
        id: `ADM-PLAN-${Date.now()}`,
        date: nowIso,
        type: 'admin_grant',
        amount: 0,
        balanceAfter: prevState.quotaWalletBalance,
        titleAr: `تعديل إداري للباقة إلى: ${planDef?.nameAr || nextPlanId}`,
        notes: 'تفعيل مباشر من لوحة إدارة المنصة',
        status: 'completed'
      };
      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            activePlanId: nextPlanId,
            billingCycle: 'monthly',
            planActivatedAt: nowIso,
            planExpiresAt: nextExp,
            planPaidAmount: 0,
            multiStorePoolIds: clampedPool,
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        }
      };
    });
    inAppToast(`تم تحديث باقة المتجر إلى ${planDef?.nameAr || nextPlanId}.`, 'success');
  };

  const handleToggleVipModule = async (targetStoreId: string, moduleId: CommerceModuleId) => {
    await persistStoreUpdate(targetStoreId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, targetStoreId);
      const existing = prevState.adminUnlockedModules || [];
      const hasMod = existing.includes(moduleId);
      const nextList = hasMod ? existing.filter(m => m !== moduleId) : [...existing, moduleId];
      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            adminUnlockedModules: nextList
          }
        }
      };
    });
  };

  const handleToggleAdminPlanLock = async (targetStoreId: string) => {
    let nextLock = false;
    await persistStoreUpdate(targetStoreId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, targetStoreId);
      nextLock = !prevState.adminPlanLock;
      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            adminPlanLock: nextLock
          }
        }
      };
    });
    inAppToast(nextLock ? 'تم تثبيت باقة المتجر إدارياً.' : 'تم إلغاء التثبيت الإداري للباقة.', 'info');
  };

  // ---------------------------------------------------------------------------
  // Custom Plan Builder / Quote / Direct Grant Handlers
  // ---------------------------------------------------------------------------
  const openCustomPlanBuilder = (storeId: string, storeName: string, prefillReq?: CustomPlanRequest) => {
    const storeRow = validStores.find(vs => vs.storeId === storeId);
    const existingOverride = storeRow?.commerce.customPlanOverride;

    setCpModal({ storeId, storeName, requestId: prefillReq?.id });
    if (prefillReq) {
      setCpNameAr(`باقة مخصصة — ${prefillReq.businessType}`);
      setCpDescriptionAr(prefillReq.notes || '');
      setCpBillingMode(prefillReq.preferredBillingMode);
      setCpCycle(prefillReq.preferredCycle);
      setCpDurationDays(String(BILLING_CYCLE_META[prefillReq.preferredCycle]?.days || 30));
      setCpCyclePrice(String(prefillReq.targetMonthlyBudget || 1000));
      setCpPerOrderFee(String(prefillReq.targetPerOrderFee || 0));
      setCpOrdersLimit(String(prefillReq.expectedMonthlyOrders || 500));
      setCpMaxEmployees(prefillReq.requestedEmployees === null ? '' : String(prefillReq.requestedEmployees || 5));
      setCpMaxWarehouses(prefillReq.requestedWarehouses === null ? '' : String(prefillReq.requestedWarehouses || 2));
      setCpMaxStoresInPool(String(prefillReq.requestedPoolStores || 1));
      setCpModules(prefillReq.requestedModules || []);
      setCpBonusWa('0');
      setCpBonusAi('0');
      setCpLockPlan(true);
      setCpPaymentMode('merchant_pays');
      setCpAdminNote('');
    } else if (existingOverride) {
      setCpNameAr(existingOverride.nameAr);
      setCpDescriptionAr(existingOverride.descriptionAr || '');
      setCpBillingMode(existingOverride.billingMode);
      setCpCycle(existingOverride.cycle);
      setCpDurationDays(String(existingOverride.durationDays || 30));
      setCpCyclePrice(String(existingOverride.cyclePrice || 0));
      setCpPerOrderFee(String(existingOverride.perDeliveredOrderFee || 0));
      setCpOrdersLimit(existingOverride.monthlyOrdersLimit === null ? '' : String(existingOverride.monthlyOrdersLimit));
      setCpMaxEmployees(existingOverride.maxEmployees === null ? '' : String(existingOverride.maxEmployees));
      setCpMaxWarehouses(existingOverride.maxWarehouses === null ? '' : String(existingOverride.maxWarehouses));
      setCpMaxStoresInPool(String(existingOverride.maxStoresInPool || 1));
      setCpModules(existingOverride.includedModules || []);
      setCpBonusWa(String(existingOverride.bonusWhatsappMessages || 0));
      setCpBonusAi(String(existingOverride.bonusAiCredits || 0));
      setCpLockPlan(Boolean(existingOverride.lockPlan));
      setCpPaymentMode('admin_free_grant');
      setCpAdminNote('');
    } else {
      setCpNameAr(`باقة VIP مخصصة — ${storeName}`);
      setCpDescriptionAr('باقة تجارية مخصصة بصلاحيات وتسعير خاص من إدارة المنصة');
      setCpBillingMode('fixed_cycle');
      setCpCycle('monthly');
      setCpDurationDays('30');
      setCpCyclePrice('0');
      setCpPerOrderFee('0');
      setCpOrdersLimit('2000');
      setCpMaxEmployees('10');
      setCpMaxWarehouses('3');
      setCpMaxStoresInPool('2');
      setCpModules([]);
      setCpBonusWa('0');
      setCpBonusAi('0');
      setCpLockPlan(true);
      setCpPaymentMode('admin_free_grant');
      setCpAdminNote('');
    }
  };

  const handleSubmitCustomPlanBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpModal) return;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const durationDays = Math.max(1, Math.round(Number(cpDurationDays) || 30));
    const override: CustomPlanOverride = {
      id: `CP-${now}`,
      nameAr: cpNameAr.trim() || 'باقة مخصصة',
      descriptionAr: cpDescriptionAr.trim() || undefined,
      billingMode: cpBillingMode,
      cycle: cpCycle,
      durationDays,
      cyclePrice: cpBillingMode === 'pay_per_delivered' ? 0 : Math.max(0, Number(cpCyclePrice) || 0),
      perDeliveredOrderFee: cpBillingMode === 'fixed_cycle' ? 0 : Math.max(0, Number(cpPerOrderFee) || 0),
      monthlyOrdersLimit: cpOrdersLimit.trim() === '' ? null : Math.max(0, Math.round(Number(cpOrdersLimit) || 0)),
      maxEmployees: cpMaxEmployees.trim() === '' ? null : Math.max(1, Math.round(Number(cpMaxEmployees) || 1)),
      maxWarehouses: cpMaxWarehouses.trim() === '' ? null : Math.max(1, Math.round(Number(cpMaxWarehouses) || 1)),
      maxStoresInPool: Math.max(1, Math.round(Number(cpMaxStoresInPool) || 1)),
      includedModules: cpModules,
      bonusWhatsappMessages: Math.max(0, Math.round(Number(cpBonusWa) || 0)) || undefined,
      bonusAiCredits: Math.max(0, Math.round(Number(cpBonusAi) || 0)) || undefined,
      lockPlan: cpLockPlan,
      grantedBy: currentUser?.fullName || 'مشرف المنصة',
      grantedAt: nowIso
    };

    const isInstantFreeGrant = cpPaymentMode === 'admin_free_grant';

    await persistStoreUpdate(cpModal.storeId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, cpModal.storeId);
      const existingReqs = prevState.customPlanRequests || [];

      if (isInstantFreeGrant) {
        const bonusWa = Number(override.bonusWhatsappMessages || 0);
        const bonusAi = Number(override.bonusAiCredits || 0);
        const rawPool =
          Array.isArray(prevState.multiStorePoolIds) && prevState.multiStorePoolIds.length > 0
            ? prevState.multiStorePoolIds
            : [cpModal.storeId];
        const maxPool = Math.max(1, override.maxStoresInPool + (prevState.extraStoreSlotsCount || 0));
        const clampedPool = [cpModal.storeId, ...rawPool.filter(id => id && id !== cpModal.storeId)].slice(0, maxPool);

        const tx: QuotaWalletTransaction = {
          id: `ADM-CP-${now}`,
          date: nowIso,
          type: 'admin_grant',
          amount: 0,
          balanceAfter: prevState.quotaWalletBalance,
          whatsappDelta: bonusWa || undefined,
          aiDelta: bonusAi || undefined,
          titleAr: `تفعيل باقة خاصة من الإدارة: ${override.nameAr}`,
          notes: cpAdminNote.trim() || `منحة مخصصة لمدة ${override.durationDays} يوم`,
          referenceId: override.id,
          status: 'completed'
        };

        const updatedReqs = cpModal.requestId
          ? existingReqs.map(r =>
              r.id === cpModal.requestId
                ? {
                    ...r,
                    status: 'accepted_activated' as const,
                    offeredPlan: override,
                    offerPaymentMode: 'admin_free_grant' as const,
                    adminNote: cpAdminNote.trim() || 'تم التفعيل المباشر كمنحة مخصصة من الإدارة',
                    reviewedBy: currentUser?.fullName || 'مشرف المنصة',
                    reviewedAt: nowIso
                  }
                : r
            )
          : existingReqs;

        return {
          ...prevData,
          settings: {
            ...prevData.settings,
            commerceState: {
              ...prevState,
              activePlanId: 'custom',
              billingCycle: override.cycle,
              planActivatedAt: nowIso,
              planExpiresAt: new Date(now + override.durationDays * 86400000).toISOString(),
              planPaidAmount: 0,
              whatsappCredits: prevState.whatsappCredits + bonusWa,
              aiCredits: prevState.aiCredits + bonusAi,
              multiStorePoolIds: clampedPool,
              customPlanOverride: override,
              adminPlanLock: Boolean(override.lockPlan),
              customPlanRequests: updatedReqs,
              quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
            }
          }
        };
      }

      // Merchant pays -> attach quote to request (or create an admin-initiated quote request)
      const updatedReqs: CustomPlanRequest[] = cpModal.requestId
        ? existingReqs.map(r =>
            r.id === cpModal.requestId
              ? {
                  ...r,
                  status: 'quoted' as const,
                  offeredPlan: override,
                  offerPaymentMode: 'merchant_pays' as const,
                  adminNote: cpAdminNote.trim() || undefined,
                  reviewedBy: currentUser?.fullName || 'مشرف المنصة',
                  reviewedAt: nowIso
                }
              : r
          )
        : [
            {
              id: `CPR-ADM-${now}`,
              storeId: cpModal.storeId,
              storeName: cpModal.storeName,
              ownerName: prevData.settings?.storeName || cpModal.storeName,
              requestedAt: nowIso,
              businessType: override.nameAr,
              expectedMonthlyOrders: override.monthlyOrdersLimit || 1000,
              preferredBillingMode: override.billingMode,
              preferredCycle: override.cycle,
              requestedModules: override.includedModules,
              notes: override.descriptionAr || 'عرض باقة خاصة مرسل من إدارة المنصة',
              status: 'quoted' as const,
              offeredPlan: override,
              offerPaymentMode: 'merchant_pays' as const,
              adminNote: cpAdminNote.trim() || undefined,
              reviewedBy: currentUser?.fullName || 'مشرف المنصة',
              reviewedAt: nowIso
            },
            ...existingReqs
          ].slice(0, 25);

      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            customPlanRequests: updatedReqs
          }
        }
      };
    });

    inAppToast(
      isInstantFreeGrant
        ? `تم تفعيل الباقة المخصصة "${override.nameAr}" للمتجر [${cpModal.storeName}] فوراً!`
        : `تم إرسال عرض الباقة المخصصة للمتجر [${cpModal.storeName}] ليقوم بتفعيله من محفظة الكوتا.`,
      'success'
    );
    setCpModal(null);
  };

  const handleConfirmRejectCustomPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cpRejectModal) return;
    const nowIso = new Date().toISOString();
    await persistStoreUpdate(cpRejectModal.storeId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, cpRejectModal.storeId);
      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            customPlanRequests: (prevState.customPlanRequests || []).map(r =>
              r.id === cpRejectModal.reqId
                ? {
                    ...r,
                    status: 'rejected',
                    adminNote: cpRejectReason.trim() || 'تم الاعتذار عن الطلب بعد المراجعة',
                    reviewedBy: currentUser?.fullName || 'مشرف المنصة',
                    reviewedAt: nowIso
                  }
                : r
            )
          }
        }
      };
    });
    inAppToast('تم رفض طلب الباقة المخصصة وإبلاغ المتجر.', 'info');
    setCpRejectModal(null);
    setCpRejectReason('');
  };

  // ---------------------------------------------------------------------------
  // Store KYC Verification Approval / Rejection / Revocation / Direct Lifetime Grant
  // ---------------------------------------------------------------------------
  const computeExpiryFromDuration = (
    duration: 'lifetime' | '2_years' | '1_year' | '6_months',
    nowMs: number
  ): string | undefined => {
    if (duration === 'lifetime') return undefined;
    const days = duration === '2_years' ? 730 : duration === '6_months' ? 180 : 365;
    return new Date(nowMs + days * 86400000).toISOString();
  };

  const handleVerifyDecision = async (
    targetStoreId: string,
    storeName: string,
    decision: 'verified' | 'rejected' | 'revoked',
    reason?: string,
    options?: {
      duration?: 'lifetime' | '2_years' | '1_year' | '6_months';
      badgeTier?: VerificationBadgeTier;
      grantReason?: string;
      grantedByAdmin?: boolean;
    }
  ) => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    await persistStoreUpdate(targetStoreId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, targetStoreId);
      if (!prevState.verification) return prevData;
      const lockedName = prevData.settings?.storeName || storeName;
      const chosenDuration =
        options?.duration || prevState.verification.durationPreset || (prevState.verification.isLifetime ? 'lifetime' : '1_year');
      const nextIsLifetime = decision === 'verified' ? chosenDuration === 'lifetime' : prevState.verification.isLifetime;
      const nextBadgeTier: VerificationBadgeTier =
        options?.badgeTier || prevState.verification.badgeTier || 'standard';

      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            verification: {
              ...prevState.verification,
              status: decision,
              badgeTier: nextBadgeTier,
              reviewedAt: nowIso,
              reviewedBy: currentUser?.fullName || 'مشرف المنصة',
              verifiedAt: decision === 'verified' ? (prevState.verification.verifiedAt || nowIso) : prevState.verification.verifiedAt,
              expiresAt:
                decision === 'verified'
                  ? computeExpiryFromDuration(chosenDuration, now)
                  : prevState.verification.expiresAt,
              isLifetime: nextIsLifetime,
              durationPreset: decision === 'verified' ? chosenDuration : prevState.verification.durationPreset,
              grantedByAdmin:
                options?.grantedByAdmin !== undefined
                  ? options.grantedByAdmin
                  : prevState.verification.grantedByAdmin,
              grantReason: options?.grantReason?.trim() || prevState.verification.grantReason,
              verifiedStoreNameLocked:
                decision === 'verified' ? lockedName : prevState.verification.verifiedStoreNameLocked,
              rejectionOrRevokeReason: decision === 'verified' ? undefined : reason?.trim() || 'لم تستوفِ الشروط المطلوبة'
            }
          }
        }
      };
    });

    inAppToast(
      decision === 'verified'
        ? options?.badgeTier === 'platform_official'
          ? `تم منح متجر [${storeName}] ختم إدارة المنصة الرسمية بنجاح!`
          : options?.badgeTier === 'vip_gold'
          ? `تم توثيق متجر [${storeName}] بالشارة الذهبية VIP بنجاح!`
          : options?.duration === 'lifetime'
          ? `تم توثيق متجر [${storeName}] مدى الحياة بنجاح!`
          : `تم توثيق متجر [${storeName}] ومنحه شارة التوثيق بنجاح!`
        : decision === 'rejected'
        ? `تم رفض طلب توثيق [${storeName}].`
        : `تم تعليق شارة التوثيق لمتجر [${storeName}].`,
      decision === 'verified' ? 'success' : 'info'
    );
  };

  const openDirectVerificationModal = (preferredStoreId?: string) => {
    const target =
      (preferredStoreId ? validStores.find(vs => vs.storeId === preferredStoreId) : null) || validStores[0];
    if (!target) {
      inAppToast('لا توجد متاجر متاحة لمنح التوثيق حالياً.', 'warning');
      return;
    }
    const existingVer = target.commerce.verification;
    setDirectVerModal({
      storeId: target.storeId,
      verifiedName: existingVer?.verifiedStoreNameLocked || target.data.settings?.storeName || target.storeMeta.name || '',
      track: existingVer?.track || 'individual',
      badgeTier: existingVer?.badgeTier || 'vip_gold',
      duration: existingVer?.isLifetime ? 'lifetime' : existingVer?.durationPreset || 'lifetime',
      reason: existingVer?.grantReason || 'توثيق خاص من إدارة المنصة (شريك نجاح / شخصية معروفة)',
      waiveFee: true
    });
  };

  useEffect(() => {
    if (!initialVerifyStoreId || validStores.length === 0) return;
    const match = validStores.find(vs => vs.storeId === initialVerifyStoreId);
    if (!match) return;
    setSubTab('verification');
    openDirectVerificationModal(match.storeId);
    onClearVerifyStoreId?.();
  }, [initialVerifyStoreId, validStores.length]);

  const handleSubmitDirectVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directVerModal?.storeId) return;
    const row = validStores.find(vs => vs.storeId === directVerModal.storeId);
    if (!row) return;

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const lockedName = directVerModal.verifiedName.trim() || row.data.settings?.storeName || row.storeMeta.name;
    const isLifetime = directVerModal.duration === 'lifetime';
    const chosenTier = directVerModal.badgeTier || 'standard';

    await persistStoreUpdate(row.storeId, prevData => {
      const prevState = ensureStoreCommerceState(prevData.settings, row.storeId);
      const prevVer: Partial<StoreVerificationProfile> = prevState.verification || {};
      const nextVerification: StoreVerificationProfile = {
        ...prevVer,
        status: 'verified',
        track: directVerModal.track,
        badgeTier: chosenTier,
        verifiedStoreNameLocked: lockedName,
        legalBusinessName: prevVer.legalBusinessName || lockedName,
        documents: prevVer.documents || [],
        submittedAt: prevVer.submittedAt || nowIso,
        reviewedAt: nowIso,
        reviewedBy: currentUser?.fullName || 'مشرف المنصة',
        verifiedAt: prevVer.verifiedAt || nowIso,
        expiresAt: computeExpiryFromDuration(directVerModal.duration, now),
        isLifetime,
        durationPreset: directVerModal.duration,
        grantedByAdmin: true,
        grantReason:
          directVerModal.reason.trim() ||
          (chosenTier === 'platform_official'
            ? 'متجر رسمي تابع لإدارة منصة عبده ميديا بريميم'
            : chosenTier === 'vip_gold'
            ? 'شريك نجاح / شخصية عامة موثقة بالشارة الذهبية'
            : 'منح مباشر من إدارة المنصة'),
        verificationFeePaid: directVerModal.waiveFee ? 0 : prevVer.verificationFeePaid ?? 0,
        rejectionOrRevokeReason: undefined
      };

      return {
        ...prevData,
        settings: {
          ...prevData.settings,
          commerceState: {
            ...prevState,
            verification: nextVerification
          }
        }
      };
    });

    const tierTitle = VERIFICATION_TIER_META[chosenTier].shortLabelAr;
    inAppToast(
      isLifetime
        ? `تم توثيق متجر [${row.storeMeta.name}] بوسام (${tierTitle}) مدى الحياة مباشرة!`
        : `تم توثيق متجر [${row.storeMeta.name}] بوسام (${tierTitle}) بنجاح!`,
      'success'
    );
    setDirectVerModal(null);
    setVerFilter('verified');
  };

  // ---------------------------------------------------------------------------
  // Governance Maker-Checker Approval / Rejection
  // ---------------------------------------------------------------------------
  const handleResolveGovernanceRequest = async (
    targetStoreId: string,
    req: GovernanceCorrectionRequest,
    decision: 'approved' | 'rejected'
  ) => {
    const nowIso = new Date().toISOString();

    await persistStoreUpdate(targetStoreId, prevData => {
      const updatedReqs = (prevData.settings?.governanceRequests || []).map(r =>
        r.id === req.id
          ? {
              ...r,
              status: decision,
              reviewedBy: currentUser?.fullName || 'مشرف المنصة',
              reviewedAt: nowIso,
              adminNote:
                decision === 'approved'
                  ? 'تم الاعتماد وتنفيذ العكس/الإقفال المحاسبي تلقائياً'
                  : 'تم الرفض بعد المراجعة الإدارية'
            }
          : r
      );

      if (decision === 'rejected') {
        return {
          ...prevData,
          settings: {
            ...prevData.settings,
            governanceRequests: updatedReqs
          }
        };
      }

      // Execute actual financial reversal / period closing on approval
      let nextWallet = prevData.wallet;
      let nextTreasury = prevData.treasury;
      let nextSettings = {
        ...prevData.settings,
        governanceRequests: updatedReqs
      };

      if (req.kind === 'wallet_correction' && req.targetTxId && prevData.wallet) {
        const orig = (prevData.wallet.transactions || []).find(t => t.id === req.targetTxId);
        if (orig && !orig.note?.includes('[معكوس')) {
          const revType = orig.type === 'إيداع' ? 'سحب' : 'إيداع';
          const amt = Number(orig.amount || req.targetAmount || 0);
          const revTx = {
            id: `REV-${orig.id}-${Date.now().toString().slice(-4)}`,
            type: revType as any,
            amount: amt,
            date: nowIso,
            status: 'completed' as const,
            category: 'wallet_charge' as any,
            note: `قيد عكسي معتمد (${req.id}) لـ: ${orig.note || orig.id} — السبب: ${req.reason}`
          };
          const balDelta = revType === 'إيداع' ? amt : -amt;
          nextWallet = {
            ...prevData.wallet,
            balance: Number(((prevData.wallet.balance || 0) + balDelta).toFixed(2)),
            transactions: [revTx, ...(prevData.wallet.transactions || [])]
          };
        }
      } else if (req.kind === 'treasury_correction' && req.targetTxId && prevData.treasury) {
        const orig = (prevData.treasury.transactions || []).find(t => t.id === req.targetTxId);
        if (orig) {
          const amt = Number(orig.amount || 0);
          // Reversing: swap fromAccountId & toAccountId and flip deposit/withdrawal
          const revType: TreasuryTransaction['type'] =
            orig.type === 'deposit' ? 'withdrawal' : orig.type === 'withdrawal' ? 'deposit' : 'transfer';
          const revTx: TreasuryTransaction = {
            id: `TREV-${orig.id}-${Date.now().toString().slice(-4)}`,
            date: nowIso,
            type: revType,
            amount: amt,
            description: `قيد عكسي معتمد (${req.id}) لـ: ${orig.description} — السبب: ${req.reason}`,
            fromAccountId: orig.toAccountId,
            toAccountId: orig.fromAccountId,
            operatorName: currentUser?.fullName || 'مشرف المنصة',
            reference: req.id
          };
          const nextAccounts = (prevData.treasury.accounts || []).map(acc => {
            let bal = Number(acc.balance || 0);
            if (orig.fromAccountId === acc.id) bal += amt;
            if (orig.toAccountId === acc.id) bal -= amt;
            return { ...acc, balance: Number(bal.toFixed(2)) };
          });
          nextTreasury = {
            ...prevData.treasury,
            accounts: nextAccounts,
            transactions: [revTx, ...(prevData.treasury.transactions || [])]
          };
        }
      } else if (req.kind === 'period_closing') {
        nextSettings = {
          ...nextSettings,
          // Stamp latest closed date in activity log note
          activityLogs: [
            {
              id: `CLOSE-${Date.now()}`,
              action: 'اعتماد إقفال الفترة المحاسبية',
              details: `تم اعتماد طلب إقفال الفترة (${req.reason}) بواسطة ${currentUser?.fullName || 'المشرف العام'}`,
              timestamp: nowIso,
              user: currentUser?.fullName || 'Admin'
            },
            ...(prevData.settings?.activityLogs || [])
          ].slice(0, 200)
        } as any;
      }

      return {
        ...prevData,
        wallet: nextWallet,
        treasury: nextTreasury,
        settings: nextSettings
      };
    });

    inAppToast(
      decision === 'approved'
        ? 'تم اعتماد الطلب وتنفيذ القيد العكسي/الإقفال المحاسبي بأمان.'
        : 'تم رفض طلب التصحيح.',
      decision === 'approved' ? 'success' : 'info'
    );
  };

  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">
      {/* Header & Executive KPIs */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers size={20} className="text-[#008060]" />
            <span>منظومة التجارة المركزية · تسعير الباقات والموديولات وكوتا المتاجر</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            التحكم المباشر في تسعير الـ 7 باقات، الـ 8 موديولات، حزم الـ Rollover، منح الكوتا، واعتماد طلبات التصحيح المحاسبي (Maker-Checker).
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
          <div className="px-3.5 py-2.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold text-slate-500">المتاجر المسجلة</div>
            <div className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {kpis.totalStores}
            </div>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">باقات مدفوعة</div>
            <div className="text-base font-black text-[#008060] dark:text-emerald-400 font-mono tabular-nums">
              {kpis.paidStores}
            </div>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-bold text-slate-500">أرصدة محافظ الكوتا</div>
            <div className="text-base font-black text-slate-900 dark:text-white font-mono tabular-nums">
              {kpis.totalQuotaBalance.toLocaleString()} ج.م
            </div>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800">
            <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">باقات خاصة معلقة</div>
            <div className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
              {pendingCustomPlansCount}
            </div>
          </div>
          <div className="px-3.5 py-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300">توثيق وتصحيحات</div>
            <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
              {pendingVerificationCount + pendingGovernanceCount}
            </div>
          </div>
        </div>
      </div>

      {/* Subtabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {[
          { id: 'pricing', label: 'مصفوفة تسعير الباقات والموديولات' },
          { id: 'stores', label: `اشتراكات وكوتا المتاجر (${validStores.length})` },
          { id: 'custom_plans', label: `طلبات الباقات المخصصة (${pendingCustomPlansCount})` },
          { id: 'verification', label: `توثيق المتاجر والشارة الخضراء (${pendingVerificationCount})` },
          { id: 'governance', label: `طلبات التصحيح المحاسبي (${pendingGovernanceCount})` }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as HubSubTab)}
            className={`px-4 py-2 rounded-lg text-xs font-black cursor-pointer transition-all ${
              subTab === t.id
                ? 'bg-[#008060] text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: PRICING MATRIX EDITOR */}
      {subTab === 'pricing' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              تعديل أي سعر أو حد هنا يتم تعميمه فوراً عبر Cloudflare D1 على كل المتاجر.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleResetCatalog()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>الافتراضي</span>
              </button>
              <button
                type="button"
                disabled={savingCatalog}
                onClick={() => void handleSaveCatalog()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer disabled:opacity-60"
              >
                <Save size={14} />
                <span>{savingCatalog ? 'جاري الحفظ...' : 'حفظ وتعميم التسعير'}</span>
              </button>
            </div>
          </div>

          {/* 7 Plans Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#f7f8f4] dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-3">الباقة</th>
                  <th className="py-3 px-3">الاشتراك الشهري (ج.م)</th>
                  <th className="py-3 px-3">حد الأوردرات/ش (فارغ = ∞)</th>
                  <th className="py-3 px-3">رسم التسليم/أوردر</th>
                  <th className="py-3 px-3">أقصى موظفين</th>
                  <th className="py-3 px-3">أقصى مخازن</th>
                  <th className="py-3 px-3">متاجر بالمجمّع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {draft.plans.map((plan, idx) => (
                  <tr key={plan.id}>
                    <td className="py-2.5 px-3 font-black text-slate-900 dark:text-white">{plan.nameAr}</td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={plan.monthlyPrice}
                        onChange={e => {
                          const v = Number(e.target.value) || 0;
                          setDraft(prev => ({
                            ...prev,
                            plans: prev.plans.map((p, i) => (i === idx ? { ...p, monthlyPrice: v } : p))
                          }));
                        }}
                        className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-mono font-bold tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={plan.monthlyOrdersLimit ?? ''}
                        placeholder="∞"
                        onChange={e => {
                          const raw = e.target.value.trim();
                          const v = raw === '' ? null : Math.max(0, Number(raw) || 0);
                          setDraft(prev => ({
                            ...prev,
                            plans: prev.plans.map((p, i) => (i === idx ? { ...p, monthlyOrdersLimit: v } : p))
                          }));
                        }}
                        className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-mono font-bold tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={plan.perDeliveredOrderFee}
                        onChange={e => {
                          const v = Number(e.target.value) || 0;
                          setDraft(prev => ({
                            ...prev,
                            plans: prev.plans.map((p, i) => (i === idx ? { ...p, perDeliveredOrderFee: v } : p))
                          }));
                        }}
                        className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-mono font-bold tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={plan.maxEmployees ?? ''}
                        placeholder="∞"
                        onChange={e => {
                          const raw = e.target.value.trim();
                          const v = raw === '' ? null : Math.max(1, Number(raw) || 1);
                          setDraft(prev => ({
                            ...prev,
                            plans: prev.plans.map((p, i) => (i === idx ? { ...p, maxEmployees: v } : p))
                          }));
                        }}
                        className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-mono font-bold tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        value={plan.maxWarehouses ?? ''}
                        placeholder="∞"
                        onChange={e => {
                          const raw = e.target.value.trim();
                          const v = raw === '' ? null : Math.max(1, Number(raw) || 1);
                          setDraft(prev => ({
                            ...prev,
                            plans: prev.plans.map((p, i) => (i === idx ? { ...p, maxWarehouses: v } : p))
                          }));
                        }}
                        className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-mono font-bold tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={1}
                        value={plan.maxStoresInPool}
                        onChange={e => {
                          const v = Math.max(1, Number(e.target.value) || 1);
                          setDraft(prev => ({
                            ...prev,
                            plans: prev.plans.map((p, i) => (i === idx ? { ...p, maxStoresInPool: v } : p))
                          }));
                        }}
                        className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1 font-mono font-bold tabular-nums"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 8 Modules + Global Policies */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">أسعار الـ 8 موديولات الشهرية (ج.م)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {draft.modules.map((mod, idx) => (
                  <div
                    key={mod.id}
                    className="p-2.5 rounded-lg bg-[#f7f8f4] dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{mod.nameAr}</span>
                    <input
                      type="number"
                      value={mod.monthlyPrice}
                      onChange={e => {
                        const v = Number(e.target.value) || 0;
                        setDraft(prev => ({
                          ...prev,
                          modules: prev.modules.map((m, i) => (i === idx ? { ...m, monthlyPrice: v } : m))
                        }));
                      }}
                      className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 font-mono font-bold tabular-nums"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">سياسات الخصم، الكاش باك، الأفلييت والأمان</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">كاش باك التحويل الداخلي (%)</label>
                  <input
                    type="number"
                    value={draft.internalTransferCashbackPercent}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, internalTransferCashbackPercent: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">عمولة الأفلييت (%)</label>
                  <input
                    type="number"
                    value={draft.affiliateCommissionPercent}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, affiliateCommissionPercent: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">خصم الباقة المجمّعة (%)</label>
                  <input
                    type="number"
                    value={draft.bundleDiscountPercent}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, bundleDiscountPercent: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">رسم الأمان التلقائي/أوردر (ج.م)</label>
                  <input
                    type="number"
                    value={draft.fallbackPerOrderFee}
                    onChange={e =>
                      setDraft(prev => ({ ...prev, fallbackPerOrderFee: Number(e.target.value) || 0 }))
                    }
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 font-mono font-bold"
                  />
                </div>
                {(['quarterly', 'semi_annual', 'annual'] as CommerceBillingCycle[]).map(c => (
                  <div key={c}>
                    <label className="block font-bold text-slate-500 mb-1">
                      خصم {c === 'quarterly' ? '3 شهور' : c === 'semi_annual' ? '6 شهور' : 'سنوي'} (%)
                    </label>
                    <input
                      type="number"
                      value={draft.cycleDiscounts[c]}
                      onChange={e =>
                        setDraft(prev => ({
                          ...prev,
                          cycleDiscounts: { ...prev.cycleDiscounts, [c]: Number(e.target.value) || 0 }
                        }))
                      }
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2.5 py-1.5 font-mono font-bold"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: PER-STORE QUOTA, GRANT & VIP MODULE OVERRIDE */}
      {subTab === 'stores' && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={storeSearch}
              onChange={e => setStoreSearch(e.target.value)}
              placeholder="بحث باسم المتجر أو المالك أو الهاتف..."
              className="w-full pr-9 pl-3 py-2 bg-[#f7f8f4] dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="bg-[#f7f8f4] dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4">المتجر والمالك</th>
                  <th className="py-3 px-4">الباقة الحالية</th>
                  <th className="py-3 px-4">محفظة الكوتا</th>
                  <th className="py-3 px-4">أوردرات Rollover</th>
                  <th className="py-3 px-4">منح VIP</th>
                  <th className="py-3 px-4 text-center">التحكم المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStores.map(row => {
                  const pDef = draft.plans.find(p => p.id === row.commerce.activePlanId);
                  const planLabel =
                    row.commerce.activePlanId === 'custom'
                      ? row.commerce.customPlanOverride?.nameAr || 'باقة مخصصة'
                      : pDef?.nameAr || row.commerce.activePlanId;
                  const verified = isStoreVerified(row.data.settings);
                  return (
                    <tr key={row.storeId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{row.storeMeta.name}</span>
                          {verified && <VerifiedStoreBadge tier={getStoreVerificationTier(row.data.settings)} size="xs" />}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {row.owner.fullName} · {row.owner.phone}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                        <span>{planLabel}</span>
                        {row.commerce.adminPlanLock && (
                          <span className="mr-1.5 inline-flex items-center text-amber-600" title="مثبتة إدارياً">
                            <Lock size={11} />
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-[#008060] dark:text-emerald-400 tabular-nums">
                        {row.commerce.quotaWalletBalance.toLocaleString()} ج.م
                      </td>
                      <td className="py-3 px-4 font-mono font-bold tabular-nums">
                        {row.commerce.rolloverOrdersBalance.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {(row.commerce.adminUnlockedModules || []).length} موديول
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStoreId(row.storeId);
                            setOverridePlanId(row.commerce.activePlanId);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
                        >
                          إدارة الكوتا والباقة
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: MAKER-CHECKER GOVERNANCE REQUESTS */}
      {subTab === 'governance' && (
        <div className="space-y-4">
          {allGovernanceRequests.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400">
              لا توجد طلبات تصحيح مالي أو إقفال فترات محاسبية مسجلة من المتاجر حتى الآن.
            </div>
          ) : (
            <div className="space-y-3">
              {allGovernanceRequests.map(({ storeId, storeMeta, req }) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f7f8f4] dark:bg-slate-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-black text-slate-900 dark:text-white">
                        {req.kind === 'wallet_correction'
                          ? 'طلب تصحيح / عكس حركة محفظة'
                          : req.kind === 'treasury_correction'
                          ? 'طلب تصحيح / عكس قيد خزينة'
                          : 'طلب إقفال فترة محاسبية'}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-bold text-[#008060]">{storeMeta?.name || storeId}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {new Date(req.requestedAt).toLocaleString('ar-EG')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          req.status === 'pending'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                        }`}
                      >
                        {req.status === 'pending' ? 'قيد المراجعة' : req.status === 'approved' ? 'معتمد ومنفّذ' : 'مرفوض'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 font-bold">
                      مقدم الطلب: {req.requestedBy}
                      {req.targetTxSummary ? ` · القيد المستهدف: ${req.targetTxSummary}` : ''}
                      {req.targetAmount ? ` · المبلغ: ${req.targetAmount.toLocaleString()} ج.م` : ''}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">السبب: {req.reason}</div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleResolveGovernanceRequest(storeId, req, 'approved')}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
                      >
                        <Check size={14} />
                        <span>اعتماد وتنفيذ العكس</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleResolveGovernanceRequest(storeId, req, 'rejected')}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                      >
                        <X size={14} />
                        <span>رفض</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2B: CUSTOM PLAN REQUESTS & ADMIN OFFERS */}
      {subTab === 'custom_plans' && (
        <div className="space-y-4">
          {allCustomPlanRequests.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400">
              لا توجد طلبات باقات مخصصة من التجار حتى الآن. يمكنك أيضاً منح أو تصميم باقة خاصة لأي متجر مباشرة من تبويب المتاجر.
            </div>
          ) : (
            <div className="space-y-3">
              {allCustomPlanRequests.map(({ storeId, storeMeta, owner, req }) => (
                <div
                  key={req.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f7f8f4] dark:bg-slate-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Crown size={15} className="text-[#008060]" />
                      <span className="font-black text-slate-900 dark:text-white">{storeMeta?.name || storeId}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{req.businessType}</span>
                      <span className="text-slate-400">·</span>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {owner.fullName} ({owner.phone})
                      </span>
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
                          ? 'طلب جديد بانتظار العرض'
                          : req.status === 'quoted'
                          ? 'تم إرسال العرض للتاجر'
                          : req.status === 'accepted_activated'
                          ? 'مفعّل'
                          : 'مرفوض'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 dark:text-slate-300 font-bold tabular-nums">
                      الأوردرات المتوقعة: {req.expectedMonthlyOrders.toLocaleString()}/شهر · النظام المطلوب:{' '}
                      {req.preferredBillingMode === 'fixed_cycle'
                        ? 'اشتراك ثابت'
                        : req.preferredBillingMode === 'pay_per_delivered'
                        ? 'بالأوردر المُسلّم'
                        : 'هجين'}{' '}
                      ({BILLING_CYCLE_META[req.preferredCycle]?.labelAr})
                      {req.targetMonthlyBudget ? ` · ميزانية مستهدفة: ${req.targetMonthlyBudget.toLocaleString()} ج.م` : ''}
                      {req.targetPerOrderFee ? ` · رسم مستهدف/أوردر: ${req.targetPerOrderFee} ج.م` : ''}
                    </div>

                    {req.requestedModules.length > 0 && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                        الموديولات المطلوبة:{' '}
                        {req.requestedModules
                          .map(mid => draft.modules.find(m => m.id === mid)?.nameAr || mid)
                          .join('، ')}
                      </div>
                    )}
                    {req.notes && <div className="text-xs text-slate-500">ملاحظات التاجر: {req.notes}</div>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {(req.status === 'pending' || req.status === 'quoted') && (
                      <button
                        type="button"
                        onClick={() => openCustomPlanBuilder(storeId, storeMeta?.name || storeId, req)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
                      >
                        <Crown size={14} />
                        <span>{req.status === 'quoted' ? 'تعديل العرض / تفعيل مباشر' : 'تصميم عرض مخصص / تفعيل'}</span>
                      </button>
                    )}
                    {req.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() => {
                          setCpRejectModal({ storeId, reqId: req.id });
                          setCpRejectReason('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                      >
                        <X size={14} />
                        <span>رفض</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2C: STORE KYC VERIFICATION & GREEN CHECKMARK BADGE */}
      {subTab === 'verification' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'pending', label: `بانتظار المراجعة (${pendingVerificationCount})` },
                {
                  id: 'verified',
                  label: `المتاجر الموثقة (${verificationApplications.filter(v => v.commerce.verification?.status === 'verified').length})`
                },
                {
                  id: 'rejected',
                  label: `المرفوضة / الموقوفة (${
                    verificationApplications.filter(
                      v => v.commerce.verification?.status === 'rejected' || v.commerce.verification?.status === 'revoked'
                    ).length
                  })`
                },
                { id: 'all', label: `الكل (${verificationApplications.length})` }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setVerFilter(f.id as any)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black cursor-pointer transition-all ${
                    verFilter === f.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => openDirectVerificationModal()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-[#008060] to-emerald-600 hover:from-[#006e52] hover:to-emerald-500 text-white text-xs font-black shadow-sm cursor-pointer transition-all"
            >
              <Award size={15} />
              <span>منح توثيق إداري مباشر / مدى الحياة</span>
            </button>
          </div>

          {filteredVerifications.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 space-y-3">
              <div>لا توجد طلبات توثيق ضمن هذا التصنيف حالياً.</div>
              <button
                type="button"
                onClick={() => openDirectVerificationModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
              >
                <BadgeCheck size={14} />
                <span>منح شارة التوثيق مباشرة لمتجر (مدى الحياة / بدون أوراق)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVerifications.map(row => {
                const ver = row.commerce.verification!;
                const ordersCount = (row.data.orders || []).length;
                const planDef = draft.plans.find(p => p.id === row.commerce.activePlanId);
                return (
                  <div
                    key={row.storeId}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-[#f7f8f4] dark:bg-slate-800/40 space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{row.storeMeta.name}</span>
                            {isStoreVerified(row.data.settings) && (
                              <VerifiedStoreBadge tier={getStoreVerificationTier(row.data.settings)} size="sm" showLabel />
                            )}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black">
                            {ver.track === 'company' ? 'شركات وسجل تجاري' : 'أفراد ونشاط ناشئ'}
                          </span>
                          {ver.badgeTier && ver.badgeTier !== 'standard' && (
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                ver.badgeTier === 'platform_official'
                                  ? 'bg-slate-900 text-amber-300 border border-amber-400/60'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {VERIFICATION_TIER_META[ver.badgeTier].labelAr}
                            </span>
                          )}
                          {ver.grantedByAdmin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 text-[10px] font-black">
                              <Award size={11} />
                              <span>منح إداري مباشر</span>
                            </span>
                          )}
                          {ver.status === 'verified' && ver.isLifetime ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">
                              <InfinityIcon size={12} />
                              <span>موثق مدى الحياة</span>
                            </span>
                          ) : ver.status === 'verified' && ver.expiresAt ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px] font-black tabular-nums">
                              ساري حتى {new Date(ver.expiresAt).toLocaleDateString('ar-EG')}
                            </span>
                          ) : null}
                          {ver.priorityReview && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-black">
                              <Clock size={11} />
                              <span>أولوية 24 ساعة</span>
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              ver.status === 'pending'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                : ver.status === 'verified'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}
                          >
                            {ver.status === 'pending'
                              ? 'قيد المراجعة'
                              : ver.status === 'verified'
                              ? 'موثّق'
                              : ver.status === 'rejected'
                              ? 'مرفوض'
                              : 'موقوف مؤقتاً'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          المالك: {row.owner.fullName} · {row.owner.phone} · الباقة:{' '}
                          {row.commerce.activePlanId === 'custom'
                            ? row.commerce.customPlanOverride?.nameAr || 'باقة مخصصة'
                            : planDef?.nameAr}{' '}
                          · إجمالي أوردرات المتجر: {ordersCount.toLocaleString()}
                          {ver.grantReason ? ` · السبب: ${ver.grantReason}` : ''}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {ver.status !== 'verified' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                void handleVerifyDecision(row.storeId, row.storeMeta.name, 'verified', undefined, {
                                  duration: '1_year'
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
                            >
                              <BadgeCheck size={15} />
                              <span>اعتماد (سنة)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void handleVerifyDecision(row.storeId, row.storeMeta.name, 'verified', undefined, {
                                  duration: 'lifetime',
                                  grantedByAdmin: true,
                                  grantReason: ver.grantReason || 'اعتماد مدى الحياة من إدارة المنصة'
                                })
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer shadow-xs"
                            >
                              <InfinityIcon size={15} />
                              <span>اعتماد مدى الحياة</span>
                            </button>
                          </>
                        )}
                        {ver.status === 'verified' && !ver.isLifetime && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleVerifyDecision(row.storeId, row.storeMeta.name, 'verified', undefined, {
                                duration: 'lifetime',
                                grantedByAdmin: true,
                                grantReason: ver.grantReason || 'ترقية إلى التوثيق الدائم مدى الحياة'
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer"
                          >
                            <InfinityIcon size={14} />
                            <span>ترقية لمدى الحياة</span>
                          </button>
                        )}
                        {ver.status === 'verified' && (
                          <button
                            type="button"
                            onClick={() => openDirectVerificationModal(row.storeId)}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-black cursor-pointer hover:border-[#008060]"
                          >
                            <Clock size={13} />
                            <span>تعديل المدة/السبب</span>
                          </button>
                        )}
                        {ver.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => {
                              setVerActionModal({
                                storeId: row.storeId,
                                storeName: row.storeMeta.name,
                                action: 'rejected'
                              });
                              setVerReasonInput('');
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                          >
                            <X size={14} />
                            <span>رفض</span>
                          </button>
                        )}
                        {ver.status === 'verified' && (
                          <button
                            type="button"
                            onClick={() => {
                              setVerActionModal({
                                storeId: row.storeId,
                                storeName: row.storeMeta.name,
                                action: 'revoked'
                              });
                              setVerReasonInput('');
                            }}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer"
                          >
                            <AlertTriangle size={14} />
                            <span>تعليق الشارة مؤقتاً</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Legal Metadata */}
                    {(ver.legalBusinessName || ver.nationalIdNumber || ver.officialPhone || ver.bankOrWalletAccount) ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700 tabular-nums">
                        <div>
                          <div className="text-[10px] text-slate-400">الاسم القانوني</div>
                          <div className="font-black text-slate-900 dark:text-white truncate">{ver.legalBusinessName || '—'}</div>
                        </div>
                        {ver.nationalIdNumber && (
                          <div>
                            <div className="text-[10px] text-slate-400">الرقم القومي</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{ver.nationalIdNumber}</div>
                          </div>
                        )}
                        {ver.officialPhone && (
                          <div>
                            <div className="text-[10px] text-slate-400">الهاتف الرسمي</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{ver.officialPhone}</div>
                          </div>
                        )}
                        {ver.bankOrWalletAccount && (
                          <div>
                            <div className="text-[10px] text-slate-400">الحساب البنكي / المحفظة</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200 truncate">
                              {ver.bankOrWalletAccount}
                            </div>
                          </div>
                        )}
                        {ver.commercialRegisterNumber && (
                          <div>
                            <div className="text-[10px] text-slate-400">السجل التجاري</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {ver.commercialRegisterNumber}
                            </div>
                          </div>
                        )}
                        {ver.taxCardNumber && (
                          <div>
                            <div className="text-[10px] text-slate-400">البطاقة الضريبية</div>
                            <div className="font-mono font-bold text-slate-800 dark:text-slate-200">{ver.taxCardNumber}</div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Documents Strip */}
                    {(ver.documents || []).length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {(ver.documents || []).map(doc => {
                          const isPdf = doc.dataUrl.startsWith('data:application/pdf');
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => setAdminPreviewDoc(doc)}
                              className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-[#008060] flex items-center gap-2.5 text-right cursor-pointer transition-all"
                            >
                              {isPdf ? (
                                <div className="w-10 h-10 rounded bg-rose-100 dark:bg-rose-950/50 text-rose-700 flex items-center justify-center shrink-0">
                                  <FileText size={18} />
                                </div>
                              ) : (
                                <img
                                  src={doc.dataUrl}
                                  alt={doc.labelAr}
                                  className="w-10 h-10 rounded object-cover border border-slate-200 shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                                  {doc.labelAr || VERIFICATION_DOC_LABELS[doc.docType]}
                                </div>
                                <div className="text-[10px] text-[#008060] font-bold flex items-center gap-1 mt-0.5">
                                  <Eye size={11} />
                                  <span>عرض المستند بالحجم الكامل</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 p-2.5 rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-2">
                        <Award size={14} />
                        <span>توثيق إداري مباشر من إدارة المنصة بدون اشتراط رفع مستندات مسبقة.</span>
                      </div>
                    )}

                    {ver.rejectionOrRevokeReason && (
                      <div className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800">
                        سبب الرفض / التعليق: {ver.rejectionOrRevokeReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: MANAGE SINGLE STORE QUOTA / PLAN / VIP MODULES */}
      {selectedStoreRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>تحكم الإدارة في المتجر: {selectedStoreRow.storeMeta.name}</span>
                  {isStoreVerified(selectedStoreRow.data.settings) && (
                    <VerifiedStoreBadge tier={getStoreVerificationTier(selectedStoreRow.data.settings)} size="sm" showLabel />
                  )}
                </h3>
                <div className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                  الكوتا: {selectedStoreRow.commerce.quotaWalletBalance.toLocaleString()} ج.م · Rollover:{' '}
                  {selectedStoreRow.commerce.rolloverOrdersBalance.toLocaleString()} أوردر
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStoreId(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 0. Custom Plan & Lock Quick Bar */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <div className="font-black text-emerald-900 dark:text-emerald-200">باقة خاصة أو تثبيت الباقة</div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  أنشئ باقة مخصصة بسعر/نظام خاص أو امنع التاجر من تغيير باقته الحالية.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleToggleAdminPlanLock(selectedStoreRow.storeId)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black cursor-pointer ${
                    selectedStoreRow.commerce.adminPlanLock
                      ? 'bg-amber-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {selectedStoreRow.commerce.adminPlanLock ? <Lock size={13} /> : <Unlock size={13} />}
                  <span>{selectedStoreRow.commerce.adminPlanLock ? 'الباقة مثبّتة' : 'تثبيت الباقة'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openCustomPlanBuilder(selectedStoreRow.storeId, selectedStoreRow.storeMeta.name)
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
                >
                  <Crown size={14} />
                  <span>منح / تصميم باقة خاصة</span>
                </button>
              </div>
            </div>

            {/* 0B. Direct Verification & Lifetime Badge Control */}
            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <div className="font-black text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <BadgeCheck size={14} className="text-[#008060]" />
                  <span>شارة التوثيق الخضراء للمتجر</span>
                  {selectedStoreRow.commerce.verification?.isLifetime && isStoreVerified(selectedStoreRow.data.settings) && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-black">مدى الحياة</span>
                  )}
                </div>
                <div className="text-[11px] text-purple-700 dark:text-purple-300">
                  {isStoreVerified(selectedStoreRow.data.settings)
                    ? selectedStoreRow.commerce.verification?.isLifetime
                      ? 'المتجر موثّق حالياً مدى الحياة بدون تاريخ انتهاء.'
                      : `المتجر موثّق حالياً حتى ${
                          selectedStoreRow.commerce.verification?.expiresAt
                            ? new Date(selectedStoreRow.commerce.verification.expiresAt).toLocaleDateString('ar-EG')
                            : 'إشعار آخر'
                        }.`
                    : 'يمكنك توثيق هذا المتجر مباشرة بدون أوراق (لمدة محددة أو مدى الحياة للشخصيات العامة وشركاء النجاح).'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openDirectVerificationModal(selectedStoreRow.storeId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-black cursor-pointer"
              >
                <Award size={14} />
                <span>{isStoreVerified(selectedStoreRow.data.settings) ? 'تعديل مدة التوثيق / ترقية' : 'توثيق مباشر / مدى الحياة'}</span>
              </button>
            </div>

            {/* 1. Grant Free EGP / Rollover */}
            <form
              onSubmit={handleGrantQuotaOrOrders}
              className="p-4 rounded-xl bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Gift size={15} className="text-[#008060]" />
                <span>منح رصيد كوتا تشجيعي أو أوردرات Rollover</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-500 mb-1">رصيد كوتا (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    value={grantEgp}
                    onChange={e => setGrantEgp(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">أوردرات Rollover</label>
                  <input
                    type="number"
                    min={0}
                    value={grantOrders}
                    onChange={e => setGrantOrders(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-500 mb-1">ملاحظة</label>
                  <input
                    type="text"
                    value={grantNote}
                    onChange={e => setGrantNote(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-bold"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
              >
                إضافة المنحة فوراً
              </button>
            </form>

            {/* 2. Switch Plan */}
            <div className="p-4 rounded-xl bg-[#f7f8f4] dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-black text-slate-900 dark:text-white">تبديل باقة المتجر مباشرة:</div>
              <div className="flex items-center gap-2">
                <select
                  value={overridePlanId === 'custom' ? 'free' : overridePlanId}
                  onChange={e => setOverridePlanId(e.target.value as CommercePlanId)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold"
                >
                  {draft.plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleAdminSwitchStorePlan(selectedStoreRow.storeId, overridePlanId === 'custom' ? 'free' : overridePlanId)}
                  className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-black cursor-pointer"
                >
                  تطبيق الباقة
                </button>
              </div>
            </div>

            {/* 3. VIP Module Unlocks */}
            <div className="space-y-2.5">
              <div className="text-xs font-black text-slate-900 dark:text-white">
                منح أو سحب صلاحية VIP للموديولات الثمانية (مستقلة عن الباقة):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {draft.modules.map(mod => {
                  const unlocked = (selectedStoreRow.commerce.adminUnlockedModules || []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => void handleToggleVipModule(selectedStoreRow.storeId, mod.id)}
                      className={`p-2.5 rounded-lg border text-right text-xs font-bold flex items-center justify-between cursor-pointer ${
                        unlocked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 text-emerald-800 dark:text-emerald-300'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{mod.nameAr}</span>
                      {unlocked ? <Unlock size={14} className="text-[#008060]" /> : <Lock size={14} className="text-slate-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOM PLAN BUILDER & GRANT/QUOTE */}
      {cpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitCustomPlanBuilder}
            className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Crown size={17} className="text-[#008060]" />
                  <span>تصميم باقة مخصصة لمتجر: {cpModal.storeName}</span>
                </h3>
              </div>
              <button type="button" onClick={() => setCpModal(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-500 mb-1">اسم الباقة الخاصة *</label>
                <input
                  type="text"
                  required
                  value={cpNameAr}
                  onChange={e => setCpNameAr(e.target.value)}
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">نظام المحاسبة</label>
                <select
                  value={cpBillingMode}
                  onChange={e => setCpBillingMode(e.target.value as CustomPlanBillingMode)}
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                >
                  <option value="fixed_cycle">اشتراك دوري ثابت</option>
                  <option value="pay_per_delivered">دفع مقابل كل أوردر مُسلّم فقط</option>
                  <option value="hybrid">هجين (اشتراك دوري + رسم تسليم/أوردر)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">دورة الفوترة وعدد الأيام</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={cpCycle}
                    onChange={e => {
                      const c = e.target.value as CommerceBillingCycle;
                      setCpCycle(c);
                      setCpDurationDays(String(BILLING_CYCLE_META[c]?.days || 30));
                    }}
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 font-bold"
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">3 شهور</option>
                    <option value="semi_annual">6 شهور</option>
                    <option value="annual">سنوي</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={cpDurationDays}
                    onChange={e => setCpDurationDays(e.target.value)}
                    placeholder="الأيام"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">سعر الدورة (ج.م) / رسم الأوردر المسلم</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    disabled={cpBillingMode === 'pay_per_delivered'}
                    value={cpCyclePrice}
                    onChange={e => setCpCyclePrice(e.target.value)}
                    placeholder="سعر الدورة"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums disabled:opacity-50"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    disabled={cpBillingMode === 'fixed_cycle'}
                    value={cpPerOrderFee}
                    onChange={e => setCpPerOrderFee(e.target.value)}
                    placeholder="رسم التسليم"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums disabled:opacity-50"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">حد الأوردرات شهرياً (فارغ = ∞)</label>
                <input
                  type="number"
                  min={0}
                  value={cpOrdersLimit}
                  onChange={e => setCpOrdersLimit(e.target.value)}
                  placeholder="∞"
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-mono font-bold tabular-nums"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">موظفون · مخازن · متاجر المجمع</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <input
                    type="number"
                    min={1}
                    value={cpMaxEmployees}
                    onChange={e => setCpMaxEmployees(e.target.value)}
                    placeholder="موظفين ∞"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 font-mono font-bold tabular-nums"
                  />
                  <input
                    type="number"
                    min={1}
                    value={cpMaxWarehouses}
                    onChange={e => setCpMaxWarehouses(e.target.value)}
                    placeholder="مخازن ∞"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 font-mono font-bold tabular-nums"
                  />
                  <input
                    type="number"
                    min={1}
                    value={cpMaxStoresInPool}
                    onChange={e => setCpMaxStoresInPool(e.target.value)}
                    placeholder="المجمع"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-2 font-mono font-bold tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">رصيد هدية WA / AI (اختياري)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={0}
                    value={cpBonusWa}
                    onChange={e => setCpBonusWa(e.target.value)}
                    placeholder="رسائل WA"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums"
                  />
                  <input
                    type="number"
                    min={0}
                    value={cpBonusAi}
                    onChange={e => setCpBonusAi(e.target.value)}
                    placeholder="نقاط AI"
                    className="bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 font-mono font-bold tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-500 mb-1">طريقة التنفيذ والتسليم</label>
                <select
                  value={cpPaymentMode}
                  onChange={e => setCpPaymentMode(e.target.value as 'merchant_pays' | 'admin_free_grant')}
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                >
                  <option value="merchant_pays">إرسال عرض للتاجر (يدفع من محفظة الكوتا ويفعّل)</option>
                  <option value="admin_free_grant">منح وتفعيل فوري مجاناً من الإدارة</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-slate-500">الموديولات المشمولة مجاناً داخل الباقة الخاصة:</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {draft.modules.map(mod => {
                  const checked = cpModules.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={`p-2 rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                        checked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-[#008060] text-emerald-800 dark:text-emerald-300 font-black'
                          : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setCpModules(prev => (prev.includes(mod.id) ? prev.filter(m => m !== mod.id) : [...prev, mod.id]))
                        }
                        className="accent-[#008060]"
                      />
                      <span className="truncate">{mod.nameAr}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <input
                type="text"
                value={cpAdminNote}
                onChange={e => setCpAdminNote(e.target.value)}
                placeholder="ملاحظة إدارية تظهر للتاجر مع العرض / التفعيل (اختياري)..."
                className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
              />
              <label className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cpLockPlan}
                  onChange={e => setCpLockPlan(e.target.checked)}
                  className="accent-[#008060]"
                />
                <span>تثبيت الباقة إدارياً (منع التاجر من تبديلها يدوياً بدون مراجعة)</span>
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
              >
                {cpPaymentMode === 'admin_free_grant' ? 'منح وتفعيل الباقة المخصصة الآن' : 'إرسال العرض المخصص للتاجر'}
              </button>
              <button
                type="button"
                onClick={() => setCpModal(null)}
                className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REJECT CUSTOM PLAN REQUEST */}
      {cpRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRejectCustomPlan}
            className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-black text-slate-900 dark:text-white">رفض طلب الباقة المخصصة</h3>
            <textarea
              rows={3}
              required
              value={cpRejectReason}
              onChange={e => setCpRejectReason(e.target.value)}
              placeholder="اكتب سبب الرفض أو التوصية البديلة للتاجر..."
              className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-black cursor-pointer">
                تأكيد الرفض
              </button>
              <button
                type="button"
                onClick={() => setCpRejectModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: REJECT OR REVOKE STORE VERIFICATION */}
      {verActionModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={e => {
              e.preventDefault();
              void handleVerifyDecision(
                verActionModal.storeId,
                verActionModal.storeName,
                verActionModal.action,
                verReasonInput
              );
              setVerActionModal(null);
            }}
            className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              {verActionModal.action === 'rejected'
                ? `رفض توثيق متجر: ${verActionModal.storeName}`
                : `تعليق شارة التوثيق: ${verActionModal.storeName}`}
            </h3>
            <textarea
              rows={3}
              required
              value={verReasonInput}
              onChange={e => setVerReasonInput(e.target.value)}
              placeholder="اكتب السبب بوضوح ليظهر للتاجر ويتمكن من تصحيحه..."
              className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-bold"
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 py-2 rounded-lg bg-rose-600 text-white text-xs font-black cursor-pointer">
                تأكيد الإجراء
              </button>
              <button
                type="button"
                onClick={() => setVerActionModal(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: ADMIN VERIFICATION DOCUMENT PREVIEW */}
      {adminPreviewDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{adminPreviewDoc.labelAr}</h3>
                <div className="text-[11px] text-slate-500">{adminPreviewDoc.fileName}</div>
              </div>
              <button
                type="button"
                onClick={() => setAdminPreviewDoc(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-950">
              {adminPreviewDoc.dataUrl.startsWith('data:application/pdf') ? (
                <iframe
                  src={adminPreviewDoc.dataUrl}
                  title={adminPreviewDoc.labelAr}
                  className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800"
                />
              ) : (
                <img
                  src={adminPreviewDoc.dataUrl}
                  alt={adminPreviewDoc.labelAr}
                  className="max-w-full max-h-[72vh] object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADMIN DIRECT VERIFICATION GRANT (NO DOCUMENTS / LIFETIME) */}
      {directVerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitDirectVerification}
            className="bg-white dark:bg-[#0b101b] border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <VerifiedStoreBadge verified tier={directVerModal.badgeTier} size="md" />
                  <span>منح توثيق إداري مباشر واختيار فئة الشارة</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  اختر مستوى التوثيق المناسب: الشارة الخضراء التجارية، الشارة الذهبية VIP، أو الختم الرسمي الحصري لإدارة المنصة.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDirectVerModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">المتجر المستهدف</label>
                <select
                  value={directVerModal.storeId}
                  onChange={e => {
                    const nextStore = validStores.find(vs => vs.storeId === e.target.value);
                    setDirectVerModal(prev =>
                      prev
                        ? {
                            ...prev,
                            storeId: e.target.value,
                            badgeTier: nextStore?.commerce.verification?.badgeTier || prev.badgeTier,
                            verifiedName:
                              nextStore?.commerce.verification?.verifiedStoreNameLocked ||
                              nextStore?.data.settings?.storeName ||
                              nextStore?.storeMeta.name ||
                              ''
                          }
                        : prev
                    );
                  }}
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                >
                  {validStores.map(vs => (
                    <option key={vs.storeId} value={vs.storeId}>
                      {vs.storeMeta.name} — {vs.owner.fullName} ({vs.owner.phone})
                      {isStoreVerified(vs.data.settings)
                        ? ` [${VERIFICATION_TIER_META[getStoreVerificationTier(vs.data.settings)].shortLabelAr}${
                            vs.commerce.verification?.isLifetime ? ' · مدى الحياة' : ''
                          }]`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick 1-click Smart Presets */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="text-[10px] font-black text-slate-500">قوالب منح سريعة بنقرة واحدة:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setDirectVerModal(prev =>
                        prev
                          ? {
                              ...prev,
                              badgeTier: 'platform_official',
                              duration: 'lifetime',
                              track: 'company',
                              reason: 'متجر رسمي تابع لإدارة منصة عبده ميديا بريميم'
                            }
                          : prev
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-300 border border-amber-400/50 text-[10px] font-black cursor-pointer hover:bg-slate-800"
                  >
                    + ختم إدارة المنصة الرسمي + مدى الحياة
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDirectVerModal(prev =>
                        prev
                          ? {
                              ...prev,
                              badgeTier: 'vip_gold',
                              duration: 'lifetime',
                              track: 'individual',
                              reason: 'شخصية معروفة / شريك نجاح بالمنصة (شارة VIP ذهبية)'
                            }
                          : prev
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black cursor-pointer hover:bg-amber-200"
                  >
                    + شريك VIP ذهبي + مدى الحياة
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDirectVerModal(prev =>
                        prev
                          ? {
                              ...prev,
                              badgeTier: 'standard',
                              duration: '1_year',
                              reason: 'توثيق تجاري قياسي معتمد من الإدارة'
                            }
                          : prev
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black cursor-pointer hover:bg-emerald-200"
                  >
                    + توثيق قياسي أخضر (سنة)
                  </button>
                </div>
              </div>

              {/* 3-Tier Verification Badge Selector */}
              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  مستوى ونوع شارة التوثيق
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['platform_official', 'vip_gold', 'standard'] as VerificationBadgeTier[]).map(tierId => {
                    const meta = VERIFICATION_TIER_META[tierId];
                    const active = directVerModal.badgeTier === tierId;
                    const activeClass =
                      tierId === 'platform_official'
                        ? 'bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 border-amber-400 text-white ring-1 ring-amber-400'
                        : tierId === 'vip_gold'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-500 text-amber-950 dark:text-amber-200 ring-1 ring-amber-400'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-950 dark:text-emerald-200 ring-1 ring-emerald-500';
                    return (
                      <button
                        key={tierId}
                        type="button"
                        onClick={() =>
                          setDirectVerModal(prev => (prev ? { ...prev, badgeTier: tierId } : prev))
                        }
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          active
                            ? activeClass
                            : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <VerifiedStoreBadge verified tier={tierId} size="sm" showLabel />
                        </div>
                        <div className="text-[10px] opacity-85 leading-snug font-bold">{meta.descriptionAr}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">
                  الاسم التجاري الموثّق والمقفول للشارة
                </label>
                <input
                  type="text"
                  required
                  value={directVerModal.verifiedName}
                  onChange={e => setDirectVerModal(prev => (prev ? { ...prev, verifiedName: e.target.value } : prev))}
                  placeholder="مثال: براند النجاح الرسمي"
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                />
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1.5">مدة صلاحية الشارة</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'lifetime' as const, label: 'مدى الحياة', sub: 'دائم بدون انتهاء', highlight: true },
                    { id: '2_years' as const, label: 'سنتان', sub: '24 شهراً', highlight: false },
                    { id: '1_year' as const, label: 'سنة واحدة', sub: '12 شهراً', highlight: false },
                    { id: '6_months' as const, label: '6 شهور', sub: 'تجريبي مميز', highlight: false }
                  ].map(opt => {
                    const active = directVerModal.duration === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDirectVerModal(prev => (prev ? { ...prev, duration: opt.id } : prev))}
                        className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                          active
                            ? opt.highlight
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                              : 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                            : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                        }`}
                      >
                        <div className="font-black flex items-center gap-1">
                          {opt.highlight && <InfinityIcon size={13} className={active ? 'text-emerald-600' : 'text-slate-400'} />}
                          <span>{opt.label}</span>
                        </div>
                        <div className="text-[10px] opacity-75 mt-0.5">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1.5">تصنيف النشاط</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'individual' as const, label: 'شخصية معروفة / فردي' },
                    { id: 'company' as const, label: 'شركة / علامة تجارية' }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDirectVerModal(prev => (prev ? { ...prev, track: t.id } : prev))}
                      className={`py-2 px-3 rounded-lg border font-black cursor-pointer ${
                        directVerModal.track === t.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-800 dark:text-emerald-300'
                          : 'bg-[#f7f8f4] dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-black text-slate-700 dark:text-slate-300 mb-1">سبب / مرجع المنح الإداري</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'متجر رسمي تابع لإدارة المنصة',
                    'شخصية عامة ومؤثر معروف',
                    'شريك نجاح ومبيعات متميزة بالمنصة',
                    'علامة تجارية كبرى موثوقة'
                  ].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDirectVerModal(prev => (prev ? { ...prev, reason: preset } : prev))}
                      className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/40 text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={directVerModal.reason}
                  onChange={e => setDirectVerModal(prev => (prev ? { ...prev, reason: e.target.value } : prev))}
                  placeholder="مثال: شخصية معروفة / شريك نجاح بالمنصة"
                  className="w-full bg-[#f7f8f4] dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-bold"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={directVerModal.waiveFee}
                  onChange={e => setDirectVerModal(prev => (prev ? { ...prev, waiveFee: e.target.checked } : prev))}
                  className="rounded text-[#008060]"
                />
                <span className="font-bold text-emerald-900 dark:text-emerald-200">
                  إعفاء كامل من رسوم الفحص (0 ج.م منحة من الإدارة)
                </span>
              </label>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
              >
                <VerifiedStoreBadge verified tier={directVerModal.badgeTier} size="xs" />
                <span>
                  {directVerModal.duration === 'lifetime'
                    ? `اعتماد ومنح (${VERIFICATION_TIER_META[directVerModal.badgeTier].shortLabelAr}) مدى الحياة`
                    : `اعتماد ومنح (${VERIFICATION_TIER_META[directVerModal.badgeTier].shortLabelAr}) فوراً`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDirectVerModal(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminCommercialHub;
