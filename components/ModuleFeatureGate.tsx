import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Sparkles, Wallet, ArrowLeft, ShieldAlert } from 'lucide-react';
import {
  CommerceModuleId,
  QuotaWalletTransaction,
  Settings,
  StoreData,
  User
} from '../types';
import {
  computeModulePriceWithBundle,
  creditAffiliateCommission,
  ensureStoreCommerceState,
  evaluateStoreModuleAccess,
  resolveEffectivePlanDefinition,
  usePlatformCommercialCatalog
} from '../utils/commerceEcosystem';
import { inAppToast } from '../utils/inAppAlert';

interface ModuleFeatureGateProps {
  moduleId: CommerceModuleId;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  currentUser?: User | null;
  users?: User[];
  allStoresData?: Record<string, StoreData>;
  setAllStoresData?: React.Dispatch<React.SetStateAction<Record<string, StoreData>>>;
  children: React.ReactNode;
}

const MUTATION_BUTTON_RE =
  /(حفظ|إضافة|أضف|إنشاء|جديد|حذف|مسح|تعديل|تحديث|تأكيد|اعتماد|ترحيل|صرف|تحويل|سحب|إيداع|شحن|دفع|إرسال|ربط|تفعيل|إغلاق|تسوية|فتح|save|add|create|delete|update|submit|send|pay)/i;
const SAFE_READONLY_RE =
  /(بحث|فلتر|تصفية|تصدير|تحميل|طباعة|معاينة|تفاصيل|عرض|إغلاق|إلغاء|رجوع|export|excel|csv|pdf|print|view|filter|close|cancel)/i;

export const ModuleFeatureGate: React.FC<ModuleFeatureGateProps> = ({
  moduleId,
  settings,
  setSettings,
  currentUser,
  users = [],
  allStoresData = {},
  setAllStoresData,
  children
}) => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { catalog } = usePlatformCommercialCatalog();
  const unlockInFlightRef = useRef<boolean>(false);
  const [isUnlocking, setIsUnlocking] = useState<boolean>(false);

  const access = evaluateStoreModuleAccess(
    settings,
    moduleId,
    catalog,
    Boolean(currentUser?.isAdmin)
  );

  if (!access.isReadOnly) {
    return <>{children}</>;
  }

  const state = ensureStoreCommerceState(settings, storeId);
  const { activePlan } = resolveEffectivePlanDefinition(state, catalog);

  const currentActiveAddonCount = Object.values(state.activeModules || {}).filter(lic => {
    if (!lic) return false;
    if (activePlan.includedModules.includes(lic.moduleId)) return false;
    const exp = new Date(lic.expiresAt).getTime();
    return !Number.isFinite(exp) || exp > Date.now();
  }).length;

  const bundlePricing = computeModulePriceWithBundle(
    access.moduleDef.monthlyPrice,
    currentActiveAddonCount + 1,
    catalog
  );
  const canAfford = state.quotaWalletBalance >= bundlePricing.finalPrice;

  const handleQuickUnlock = async () => {
    if (unlockInFlightRef.current) return;
    if (!canAfford) {
      inAppToast(
        `رصيد محفظة الكوتا (${state.quotaWalletBalance.toLocaleString()} ج.م) غير كافٍ. السعر المطلوب ${bundlePricing.finalPrice.toLocaleString()} ج.م.`,
        'warning'
      );
      if (storeId) navigate(`/store/${storeId}/subscription`);
      return;
    }

    unlockInFlightRef.current = true;
    setIsUnlocking(true);
    try {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const expiresAt = new Date(now + 30 * 86400000).toISOString();
      const bonusWa = Number(access.moduleDef.includedWhatsappMessages || 0);
      const bonusAi = Number(access.moduleDef.includedAiCredits || 0);
      const txId = `MOD-${moduleId}-${now}`;
      const expectedCharge = bundlePricing.finalPrice;

      setSettings(prev => {
        const prevState = ensureStoreCommerceState(prev, storeId);
        if (prevState.quotaWalletBalance < expectedCharge) return prev;
        if (prevState.quotaTransactions.some(t => t.id === txId)) return prev;
        const nextBalance = Number((prevState.quotaWalletBalance - expectedCharge).toFixed(2));
        const tx: QuotaWalletTransaction = {
          id: txId,
          date: nowIso,
          type: 'module_charge',
          amount: -expectedCharge,
          balanceAfter: nextBalance,
          whatsappDelta: bonusWa || undefined,
          aiDelta: bonusAi || undefined,
          titleAr: `تفعيل موديول ${access.moduleDef.nameAr} (30 يوم)`,
          notes: bundlePricing.eligible
            ? `تطبيق خصم الباقة المجمّعة (${bundlePricing.discountPercent}%)`
            : 'خصم فوري من محفظة الكوتا التشغيلية',
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
                activatedAt: nowIso,
                expiresAt,
                monthlyPricePaid: expectedCharge,
                autoRenew: true
              }
            },
            quotaTransactions: [tx, ...prevState.quotaTransactions].slice(0, 200)
          }
        };
      });

      if (storeId && state.referredByCode && expectedCharge > 0) {
        await creditAffiliateCommission({
          sourceStoreId: storeId,
          sourceStoreName: settings?.storeName || storeId,
          referredByCode: state.referredByCode,
          paidAmount: expectedCharge,
          purchaseTitleAr: `تفعيل موديول ${access.moduleDef.nameAr}`,
          idempotencyKey: txId,
          catalog,
          users,
          allStoresData,
          setAllStoresData
        });
      }

      inAppToast(`تم تفعيل ${access.moduleDef.nameAr} بنجاح! يعمل الموديول الآن بكامل الصلاحيات.`, 'success');
    } finally {
      unlockInFlightRef.current = false;
      setIsUnlocking(false);
    }
  };

  const interceptMutationCapture = (e: React.SyntheticEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const interactiveEl = target.closest('button, [role="button"], input[type="submit"], form') as HTMLElement | null;
    if (!interactiveEl) return;

    const tag = interactiveEl.tagName.toLowerCase();
    if (tag === 'form') {
      e.preventDefault();
      e.stopPropagation();
      inAppToast(
        `وضع القراءة والتصدير الآمن: موديول "${access.moduleDef.nameAr}" مقفل حالياً. يمكنك التصدير والمشاهدة فقط، أو تفعيله من محفظة الكوتا.`,
        'warning'
      );
      return;
    }

    const label = (interactiveEl.innerText || interactiveEl.getAttribute('title') || interactiveEl.getAttribute('aria-label') || '').trim();
    if (SAFE_READONLY_RE.test(label) && !MUTATION_BUTTON_RE.test(label)) {
      return;
    }

    if (MUTATION_BUTTON_RE.test(label)) {
      e.preventDefault();
      e.stopPropagation();
      inAppToast(
        `وضع القراءة فقط: قم بتفعيل "${access.moduleDef.nameAr}" (${bundlePricing.finalPrice.toLocaleString()} ج.م/شهر) من محفظة الكوتا لإجراء عمليات التعديل والحفظ.`,
        'warning'
      );
    }
  };

  return (
    <div className="space-y-4 font-sans text-right" dir="rtl">
      {/* Compact Read-Only Grace Bar */}
      <div className="bg-white dark:bg-[#0b101b] border border-amber-300/80 dark:border-amber-800/70 rounded-xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Lock size={18} />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {access.moduleDef.nameAr}
              </h3>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                · وضع القراءة والتصدير الآمن (بياناتك التاريخية محفوظة بالكامل)
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {access.moduleDef.descriptionAr} · تكلفة التفعيل الفوري:{' '}
              <span className="font-mono font-black text-slate-900 dark:text-white tabular-nums">
                {bundlePricing.finalPrice.toLocaleString()} ج.م/شهر
              </span>
              {bundlePricing.eligible ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  {' '}
                  (شامل خصم الباقة المجمّعة {bundlePricing.discountPercent}%-)
                </span>
              ) : null}
              {' · '}
              رصيد محفظة الكوتا:{' '}
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {state.quotaWalletBalance.toLocaleString()} ج.م
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isUnlocking}
            onClick={handleQuickUnlock}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
          >
            <Sparkles size={14} />
            <span>
              {canAfford
                ? `تفعيل فوري من محفظة الكوتا (${bundlePricing.finalPrice.toLocaleString()} ج.م)`
                : 'شحن محفظة الكوتا وتفعيل الموديول'}
            </span>
          </button>

          {storeId && (
            <button
              type="button"
              onClick={() => navigate(`/store/${storeId}/subscription`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            >
              <Wallet size={14} />
              <span>الباقات ومحفظة الكوتا</span>
              <ArrowLeft size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Protected Read-Only Workspace */}
      <div
        className="relative rounded-xl border border-dashed border-amber-300/70 dark:border-amber-900/50 bg-slate-50/30 dark:bg-slate-900/20 p-1"
        data-readonly-grace="true"
        onClickCapture={interceptMutationCapture}
        onSubmitCapture={interceptMutationCapture}
      >
        <div className="px-3 py-1.5 mb-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
          <ShieldAlert size={13} />
          <span>يمكنك استعراض جميع السجلات والتصدير والطباعة بحرية — الإضافة والحفظ والتعديل متوقف لحين التفعيل.</span>
        </div>
        {children}
      </div>
    </div>
  );
};

export default ModuleFeatureGate;
