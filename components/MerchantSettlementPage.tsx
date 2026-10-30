import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { Settings, Order, MerchantSettlement, MerchantSettlementOrderSnapshot, Treasury, CustomerProfile, MerchantTransaction } from '../types';
import { 
  Building2, DollarSign, Calculator, FileText, CheckCircle2, 
  Printer, Download, Plus, Search, Filter, Calendar, User, 
  ArrowUpRight, ArrowDownLeft, Wallet, ShieldAlert, Sparkles, X, Paperclip, ChevronDown, Check, Speaker,
  Landmark, TrendingUp, TrendingDown, RefreshCw, MessageSquare, RotateCcw, Eye, SlidersHorizontal,
  Layers, Percent, PackageCheck, AlertTriangle, Trash2, ExternalLink, FileSpreadsheet, Info, Globe, Mail, Loader2,
  Coins, Clock, XCircle, Settings as SettingsIcon
} from 'lucide-react';
import * as db from '../services/databaseService';
import { printHTMLDirectly } from '../utils/printHelper';
import { InvoiceAttachmentUploader } from './InvoiceAttachmentUploader';
import { MerchantTransparencyTab } from './MerchantTransparencyTab';
import MerchantPortal from './MerchantPortal';
import * as XLSX from 'xlsx';
import { calculateCodFee, calculateOrderShippingAndFees, getStandardShippingFee, getCompanySpecificFees, calculateInsuranceFee, calculateBostaVat } from '../utils/financials';
import { inAppAlert, inAppConfirm, inAppToast } from '../utils/inAppAlert';
import { allocateMerchantWithdrawal, calculateMerchantBalance, calculateMerchantOpeningBalance, getMerchantOrderGroups, splitSettlementByOrder, transitionMerchantSettlement, upsertOrderSettlements } from '../utils/merchantAccounting';

const SETTLEMENT_ELIGIBLE_STATUSES = [
  'تم_التحصيل',
  'مدفوعة',
  'تم_التوصيل',
  'مرتجع',
  'فشل_التوصيل',
  'تمت_الاعادة_لشركة_الشحن',
  'مرتجع_جزئي',
  'مرتجع_بعد_الاستلام',
  'ملغي'
];

const DELIVERED_STATUSES = ['تم_التحصيل', 'مدفوعة', 'تم_التوصيل'];

const RETURN_STATUSES = [
  'مرتجع',
  'فشل_التوصيل',
  'تمت_الاعادة_لشركة_الشحن',
  'مرتجع_جزئي',
  'مرتجع_بعد_الاستلام',
  'ملغي'
];

/**
 * حساب تفاصيل الشحن والرسوم المحملة على الطلب:
 * - في حالة الطلب المسلم:
 *   مصاريف الشحن الفعلية + الرسوم الإضافية (تأمين + ضريبة 14% + معاينة + COD)
 * - في حالة المرتجع:
 *   مصاريف شحن المرتجع + الرسوم الإضافية
 */
const calculateMerchantShippingBreakdown = (
  order: Order,
  settings: Settings,
  ov?: OrderCustomOverride
) => {
  const isDelivered = DELIVERED_STATUSES.includes(order.status);
  const compFees = getCompanySpecificFees(settings, order.shippingCompany);
  const useCustom = compFees?.useCustomFees ?? false;

  // 1. Base Shipping Fee (actual shipping fee on the order or overridden)
  const baseShippingFee = ov?.shippingFee !== undefined
    ? ov.shippingFee
    : (Number(order.shippingFee) > 0 ? Number(order.shippingFee) : Math.max(0, getStandardShippingFee(order, settings)));

  // 2. Insurance Fee
  const insuranceRate = useCustom ? (compFees?.insuranceFeePercent ?? 0) : (settings.enableInsurance ? settings.insuranceFeePercent : 0);
  const isInsured = order.isInsured ?? true;
  const calculatedInsurance = isInsured ? calculateInsuranceFee(order, insuranceRate, settings) : 0;
  const rawInsurance = (order.insuranceFee !== undefined && order.insuranceFee !== null && Number(order.insuranceFee) > 0)
    ? Number(order.insuranceFee)
    : calculatedInsurance;
  const insuranceFee = ov?.insuranceFee !== undefined ? ov.insuranceFee : rawInsurance;

  // 3. Inspection Fee (Only charged to merchant if explicitly included and not paid by customer)
  const inspectionCost = useCustom ? (compFees?.inspectionFee ?? 0) : (settings.enableInspection ? settings.inspectionFee : 0);
  const isInspectionExplicitlyCharged = (order.includeInspectionFee === true || order.allowOpenShipment === true) && order.inspectionFeePaidByCustomer !== true;
  const rawInspection = (order.inspectionFee !== undefined && order.inspectionFee !== null && Number(order.inspectionFee) > 0 && order.inspectionFeePaidByCustomer !== true)
    ? Number(order.inspectionFee)
    : (isInspectionExplicitlyCharged ? inspectionCost : 0);
  const inspectionFee = ov?.inspectionFee !== undefined ? ov.inspectionFee : rawInspection;

  // 4. VAT Fee (14% VAT on shipping + inspection + insurance)
  const rawVat = (order.vatValue !== undefined && order.vatValue !== null && Number(order.vatValue) > 0)
    ? Number(order.vatValue)
    : calculateBostaVat({ ...order, shippingFee: baseShippingFee }, insuranceFee, settings);
  const vatFee = ov?.vatFee !== undefined ? ov.vatFee : rawVat;

  // 5. COD Fee
  const calculatedCod = isDelivered && order.status !== 'مدفوعة' ? calculateCodFee(order, settings) : 0;
  const codFee = ov?.codFee !== undefined ? ov.codFee : calculatedCod;

  // Additional carrier fees: insurance + vat + inspection
  const carrierAdditionalFees = Math.round((insuranceFee + vatFee + inspectionFee) * 100) / 100;

  if (!isDelivered) {
    const totalFees = ov?.returnFee !== undefined 
      ? ov.returnFee 
      : calculateOrderShippingAndFees(order, settings);
    
    // Determine if calculateOrderShippingAndFees added a return fee
    const isReturnStatus = RETURN_STATUSES.includes(order.status);
    const applyReturnFee = useCustom ? (compFees?.enableFixedReturn ?? false) : settings.enableReturnShipping;
    const returnFeeInTotal = isReturnStatus && applyReturnFee ? (useCustom ? (compFees?.returnShippingFee ?? 0) : settings.returnShippingFee) : 0;

    // Use total WITHOUT return fee for the 'total' field here, 
    // because computeOrderFinancials will add its own returnFee variable from the UI state.
    const cleanTotal = ov?.returnFee !== undefined ? totalFees : Math.max(0, totalFees - returnFeeInTotal);

    return {
      baseShippingFee,
      insuranceFee,
      vatFee,
      inspectionFee,
      codFee,
      carrierAdditionalFees,
      total: cleanTotal,
      returnFee: returnFeeInTotal,
      customerPaidShipping: 0,
      officialShippingFee: baseShippingFee,
      shippingDiscountDifference: 0
    };
  }

  const total = Math.round((baseShippingFee + carrierAdditionalFees + codFee) * 100) / 100;

  return {
    baseShippingFee,
    insuranceFee,
    vatFee,
    inspectionFee,
    codFee,
    carrierAdditionalFees,
    total,
    customerPaidShipping: baseShippingFee,
    officialShippingFee: baseShippingFee,
    shippingDiscountDifference: 0
  };
};

interface OrderCustomOverride {
  goodsCost?: number;
  marketingFee?: number;
  serviceFee?: number;
  mode?: 'fixed_fee' | 'profit_share' | 'wholesale';
  sharePercent?: number;
  shippingFee?: number;
  insuranceFee?: number;
  vatFee?: number;
  inspectionFee?: number;
  codFee?: number;
  returnFee?: number;
  customHoldingDays?: number;
}

interface MerchantSettlementPageProps {
  storeId?: string;
  orders: Order[];
  settings: Settings;
  updateSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  treasury?: Treasury;
  setTreasury?: React.Dispatch<React.SetStateAction<Treasury | undefined>>;
  customers?: CustomerProfile[];
  currentUser?: any;
  embedded?: boolean;
}

export const MerchantSettlementPage: React.FC<MerchantSettlementPageProps> = ({
  storeId: propStoreId,
  orders,
  settings,
  updateSettings,
  setOrders,
  treasury,
  setTreasury,
  customers = [],
  currentUser,
  embedded = false
}) => {
  const [activeTab, setActiveTab] = useState<'settlements' | 'create' | 'requests' | 'merchants' | 'transparency' | 'portal'>('settlements');
  const [transparencyMerchantId, setTransparencyMerchantId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('');
  
  // Merchant Incoming Payout Requests
  const [rawRequests, setRawRequests] = useState<db.PartnerPortalRequest[]>([]);
  const [requestsFilterStatus, setRequestsFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const activeStoreId = useMemo(() => {
    if (propStoreId) return propStoreId;
    try {
      return localStorage.getItem('activeStoreId') || 'default';
    } catch {
      return 'default';
    }
  }, [propStoreId]);

  const loadMerchantRequests = useCallback(async () => {
    try {
      const reqs = await db.getMerchantRequests(activeStoreId, { forceAdmin: true });
      setRawRequests(reqs);
    } catch (_) {}
  }, [activeStoreId]);

  useEffect(() => {
    void loadMerchantRequests();
    const interval = setInterval(() => void loadMerchantRequests(), 10000);
    return () => clearInterval(interval);
  }, [loadMerchantRequests]);

  const merchantRequests = useMemo(() => {
    const fromSettings = [ ...((settings as any).merchantRequests || []), ...((settings as any).partnerRequests || []) ];
    const map = new Map<string, any>();
    rawRequests.forEach(r => map.set(r.id, r));
    fromSettings.forEach((r: any) => {
      if (!map.has(r.id)) map.set(r.id, r);
    });
    const list = Array.from(map.values()).filter((r: any) => {
      const isMerchant = r.id?.startsWith('REQ-M-') || 
                         r.isMerchantRequest === true || 
                         (r.typeArabic && r.typeArabic.includes('الموكل')) ||
                         (r.partnerId && (r.partnerId.startsWith('m_') || r.partnerId.startsWith('sup_')));
      return isMerchant;
    });
    list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    return list;
  }, [rawRequests, settings]);

  const pendingMerchantRequestsCount = useMemo(() => {
    return merchantRequests.filter(r => r.status === 'pending').length;
  }, [merchantRequests]);

  const [selectedReqForApproval, setSelectedReqForApproval] = useState<db.PartnerPortalRequest | null>(null);
  const [approvalTreasuryAccountId, setApprovalTreasuryAccountId] = useState<string>('');
  const [approvalTransferRef, setApprovalTransferRef] = useState<string>('');
  const [approvalReceiptImage, setApprovalReceiptImage] = useState<string>('');
  const [previewReceiptImage, setPreviewReceiptImage] = useState<string | null>(null);
  const [customQuoteFeeMap, setCustomQuoteFeeMap] = useState<Record<string, number>>({});

  const handleReceiptFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 900;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setApprovalReceiptImage(canvas.toDataURL('image/jpeg', 0.78));
        } else {
          setApprovalReceiptImage(dataUrl);
        }
      };
      img.onerror = () => setApprovalReceiptImage(dataUrl);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCustomQuoteAction = async (
    req: db.PartnerPortalRequest,
    mode: 'send_quote' | 'activate_now',
    customFeeInput?: number
  ) => {
    try {
      const quotedFee = Math.max(1, Number(customFeeInput ?? customQuoteFeeMap[req.id] ?? 20));
      const supplier = (settings.suppliers || []).find(s => s.id === req.partnerId);
      if (!supplier) {
        inAppToast('تعذر العثور على حساب الموكل المرتبط بطلب التسعير.', 'error');
        return;
      }

      const baseReqMeta = req.planRequestMeta || supplier.pendingPlanRequest || {};
      const targetOrders = Number(
        baseReqMeta.requestedCustomQuota ||
          baseReqMeta.requestedOrdersTarget ||
          baseReqMeta.ordersLimit ||
          500
      );
      const isPrepaid = Boolean(
        baseReqMeta.requestedPrepaidQuota ??
          (baseReqMeta.requestedCustomBillingPreference === 'prepaid_quota')
      );
      const upfrontCharge = isPrepaid ? Number((quotedFee * targetOrders).toFixed(2)) : 0;
      const currentBal = Number(supplier.balance || 0);

      if (mode === 'activate_now' && isPrepaid && upfrontCharge > currentBal) {
        inAppToast(
          `رصيد محفظة الموكل (${currentBal.toLocaleString()} ج.م) أقل من قيمة الدفع المقدم (${upfrontCharge.toLocaleString()} ج.م). يمكنك إرسال عرض السعر للموكل أولاً.`,
          'error'
        );
        return;
      }

      await db.updateMerchantRequestStatus(req.id, activeStoreId, 'approved');
      setRawRequests(prev => prev.map(r => (r.id === req.id ? { ...r, status: 'approved' } : r)));

      const nowIso = new Date().toISOString();
      const expIso = new Date(Date.now() + 30 * 86400000).toISOString();
      const newCycleId = `CYC-MGR-CUSTOM-${Date.now()}`;

      updateSettings(currentSettings => {
        const updateItem = (m: any) => {
          if (String(m.id || '') !== String(supplier.id || '')) return m;
          if (mode === 'send_quote') {
            return {
              ...m,
              pendingPlanRequest: {
                ...baseReqMeta,
                id: baseReqMeta.id || req.id || `PLAN-REQ-${Date.now()}`,
                requestedAt: baseReqMeta.requestedAt || req.createdAt || nowIso,
                targetMode: 'manager',
                targetPlanId: 'custom_manager',
                targetManagerPlanId: 'custom_manager',
                targetPlanNameAr: 'باقة المدير المخصصة',
                planNameAr: 'باقة المدير المخصصة',
                status: 'quoted_waiting_merchant',
                quotedOrderFee: quotedFee,
                quotedOrdersTarget: targetOrders,
                requestedCustomQuota: targetOrders,
                requestedOrdersTarget: targetOrders,
                requestedPrepaidQuota: isPrepaid,
                requestedCustomBillingPreference: isPrepaid ? 'prepaid_quota' : 'per_order',
                quotedTotalUpfront: upfrontCharge,
                quotedAt: nowIso,
                adminNotes: `تم تحديد سعر الأوردر المخصص بـ ${quotedFee} ج.م من الإدارة (${isPrepaid ? 'دفع مسبق' : 'خصم مع كل أوردر بدون رصيد مقدم'})`
              }
            };
          }

          const nextBal = Number((Number(m.balance || 0) - upfrontCharge).toFixed(2));
          const newTx: MerchantTransaction | undefined =
            upfrontCharge > 0
              ? {
                  id: `mtx-custom-${Date.now()}`,
                  merchantId: m.id,
                  merchantName: m.name,
                  date: nowIso,
                  type: 'subscription_charge',
                  amount: -upfrontCharge,
                  balanceAfter: nextBal,
                  notes: `تفعيل باقة المدير المخصصة (${quotedFee} ج.م/أوردر - ${targetOrders} أوردر)`
                }
              : undefined;

          return {
            ...m,
            subscriptionPlan: {
              ...(m.subscriptionPlan || {}),
              planId: 'free',
              planName: 'None',
              planNameAr: 'موقوفة (يعمل بنظام المدير المخصص)',
              cycleId: newCycleId,
              billingCycle: 'monthly',
              monthlyPrice: 0,
              totalPaidAmount: 0,
              pricePerMonth: 0,
              paidAmount: 0,
              ordersLimit: 0,
              monthlyOrderLimit: 0,
              unlimitedOrders: false,
              startDate: nowIso,
              endDate: expIso,
              activatedAt: nowIso,
              expiresAt: expIso,
              status: 'cancelled'
            },
            managerPlan: {
              enabled: true,
              planId: 'custom_manager',
              planName: `باقة المدير المخصصة (${quotedFee} ج.م / أوردر)`,
              planNameAr: `باقة المدير المخصصة (${quotedFee} ج.م / أوردر)`,
              cycleId: newCycleId,
              billingCycle: 'monthly',
              orderFee: quotedFee,
              customOrderFee: quotedFee,
              customOrdersTarget: targetOrders,
              customOrderQuota: targetOrders,
              customPrepaidQuota: isPrepaid,
              monthlyFee: upfrontCharge,
              totalPaidAmount: upfrontCharge,
              totalPrepaidAmount: upfrontCharge,
              usedOrdersInCycle: 0,
              startDate: nowIso,
              endDate: expIso,
              activatedAt: nowIso,
              expiresAt: expIso,
              status: 'active',
              notes: `تم تفعيل التسعير المخصص (${quotedFee} ج.م لكل أوردر — ${isPrepaid ? 'دفع مسبق' : 'خصم تلقائي مع كل أوردر'})`
            },
            pendingPlanRequest: null,
            ...(upfrontCharge > 0 ? { balance: nextBal } : {}),
            ...(newTx ? { transactions: [newTx, ...(m.transactions || [])] } : {})
          };
        };

        const updatedSuppliers = (currentSettings.suppliers || []).map(updateItem);
        if (activeStoreId) {
          db.updatePartnerSettings(activeStoreId, currentSettings.partners || [], updatedSuppliers).catch(() => {});
        }
        return {
          ...currentSettings,
          suppliers: updatedSuppliers,
        };
      });

      setSelectedReqForApproval(null);
      inAppToast(
        mode === 'send_quote'
          ? `تم إرسال عرض السعر (${quotedFee} ج.م / أوردر) إلى بوابة الموكل ${supplier.name} بنجاح 📤`
          : `تم تفعيل الباقة المخصصة للموكل ${supplier.name} بسعر (${quotedFee} ج.م / أوردر) فوراً بدون اشتراط رصيد مقدم ⚡`,
        'success'
      );
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء معالجة طلب التسعير: ' + (err.message || ''), 'error');
    }
  };

  const handleApproveMerchantRequest = async (req: db.PartnerPortalRequest, treasuryAccountId?: string) => {
    try {
      if (req.type === 'custom_plan_quote') {
        await handleCustomQuoteAction(req, 'activate_now');
        return;
      }
      const amount = Number(req.amount);
      const supplier = (settings.suppliers || []).find(s => s.id === req.partnerId);
      const isCreditToWallet = req.type === 'wallet_topup' || req.type === 'subscription_refund';
      if (
        req.status !== 'pending' ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        !supplier ||
        (!isCreditToWallet && req.type !== 'plan_change_request' && (amount <= 0 || amount > (supplier.balance || 0)))
      ) {
        if (supplier && !isCreditToWallet && amount > (supplier.balance || 0)) {
          inAppToast(
            `رصيد المحفظة المسوّى للموكل (${(supplier.balance || 0).toLocaleString()} ج.م) أقل من مبلغ السحب المطلوب (${amount.toLocaleString()} ج.م). قم بتسوية الأوردرات المسلمة أولاً من تبويب (إصدار تسوية) أو ارفض الطلب المعلق.`,
            'error'
          );
        } else {
          inAppToast('تعذر اعتماد الطلب: تحقق من حالته والمبلغ والرصيد المرتبط بحساب الموكل.', 'error');
        }
        return;
      }

      // Calculate configured transfer fee (weekly / daily)
      const isDaily = supplier.payoutFrequency === 'daily';
      const feeRate = isDaily
        ? (typeof supplier.dailyTransferFee === 'number' ? supplier.dailyTransferFee : (settings.dailyTransferFee ?? 1))
        : (typeof supplier.weeklyTransferFee === 'number' ? supplier.weeklyTransferFee : (settings.weeklyTransferFee ?? 25));
      const feeType = isDaily
        ? (supplier.dailyTransferFeeType || settings.dailyTransferFeeType || 'percentage')
        : (supplier.weeklyTransferFeeType || settings.weeklyTransferFeeType || 'fixed');

      let transferFee = 0;
      if (!isCreditToWallet && req.type !== 'plan_change_request' && feeRate > 0) {
        if (feeType === 'percentage') {
          transferFee = Math.round((amount * (feeRate / 100)) * 100) / 100;
        } else {
          transferFee = Math.min(amount, Number(feeRate) || 0);
        }
      }
      const netDisbursed = Math.max(0, Number((amount - transferFee).toFixed(2)));

      const selectedAcc = (treasury?.accounts || []).find(a => a.id === treasuryAccountId);
      if (selectedAcc && selectedAcc.balance < netDisbursed) {
        inAppToast(`رصيد حساب الخزينة (${selectedAcc.name}) غير كافٍ لصرف هذا الطلب (${selectedAcc.balance.toLocaleString()} ج.م - المطلوب: ${netDisbursed.toLocaleString()} ج.م)`, 'error');
        return;
      }

      const cleanRef = approvalTransferRef.trim() || undefined;
      const cleanImg = approvalReceiptImage || undefined;
      const paidNowIso = new Date().toISOString();
      const withdrawalAllocation = allocateMerchantWithdrawal(
        settings.merchantSettlements || [], req.partnerId, amount, req.id, paidNowIso
      );

      const statusUpdated = await db.updateMerchantRequestStatus(req.id, activeStoreId, 'approved', {
        receiptImage: cleanImg,
        transferReference: cleanRef
      });
      if (!statusUpdated) {
        inAppToast('لم يتم اعتماد الطلب؛ ربما عولج بالفعل من شاشة أخرى. حدّث القائمة.', 'error');
        return;
      }
      setRawRequests(prev => prev.map(r => r.id === req.id ? {
        ...r,
        status: 'approved',
        ...(cleanImg ? { receiptImage: cleanImg } : {}),
        ...(cleanRef ? { transferReference: cleanRef } : {})
      } : r));

      // Update only the merchant ledger; merchant withdrawals affect merchant balance directly.
      updateSettings(currentSettings => {
        const currentAllocation = allocateMerchantWithdrawal(
          currentSettings.merchantSettlements || [], req.partnerId, amount, req.id, paidNowIso
        );
        const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
          if (s.id === req.partnerId) {
            const currentBalance = Number(s.balance || 0);
            const nextBal = Number((currentBalance - amount).toFixed(2));
            const nowIso = new Date().toISOString();

            const withdrawalTx: MerchantTransaction = {
              id: `mtx-w-${Date.now()}`,
              merchantId: s.id,
              merchantName: s.name,
              date: nowIso,
              type: 'withdrawal',
              amount: -netDisbursed,
              balanceAfter: Number((currentBalance - netDisbursed).toFixed(2)),
              notes: `سحب مستحقات (صافي المحول - طلب #${req.id.slice(-6)}) ${selectedAcc ? `- صرف من خزينة: ${selectedAcc.name}` : ''}${cleanRef ? ` - مرجع: ${cleanRef}` : ''} - ${req.notes || ''}`,
              referenceId: req.id,
              receiptImage: cleanImg,
              transferReference: cleanRef,
              performedBy: currentUser?.fullName || 'الإدارة'
            };

            const feeTx: MerchantTransaction | null = transferFee > 0 ? {
              id: `mtx-Transfer_Fees-${Date.now() + 1}`,
              merchantId: s.id,
              merchantName: s.name,
              date: nowIso,
              type: 'expense',
              amount: -transferFee,
              balanceAfter: nextBal,
              notes: `رسوم التحويل المالي لسحب المستحقات (طلب #${req.id.slice(-6)})`,
              referenceId: req.id,
              performedBy: currentUser?.fullName || 'الإدارة'
            } : null;

            const newTxs = feeTx ? [feeTx, withdrawalTx] : [withdrawalTx];

            return {
              ...s,
              balance: nextBal,
              transactions: [...newTxs, ...(s.transactions || [])]
            };
          }
          return s;
        });

        const addedTxs = updatedSuppliers.find(s => s.id === req.partnerId)?.transactions?.slice(0, transferFee > 0 ? 2 : 1) || [];
        if (activeStoreId) {
          db.updatePartnerSettings(activeStoreId, currentSettings.partners || [], updatedSuppliers).catch(() => {});
        }
        return {
          ...currentSettings,
          suppliers: updatedSuppliers,
          merchantSettlements: currentAllocation.settlements,
          ...(addedTxs.length > 0 ? { merchantTransactions: [...addedTxs, ...(currentSettings.merchantTransactions || [])] } : {})
        };
      });

      // Link this withdrawal to approved per-order settlements first. Fully covered rows
      // become paid; partial rows retain approved status and their cumulative paidAmount.
      if (!isCreditToWallet && req.type !== 'plan_change_request') {
        const paidSettlementIds = new Set(withdrawalAllocation.paidSettlementIds);
        let remainingToCover = Math.max(0, amount - withdrawalAllocation.allocatedAmount);
        setOrders(currentOrders => currentOrders.map(o => {
          const orderGroups = getMerchantOrderGroups(o);
          const linkedSettlements = (o.merchantSettlementRefs || []).filter(ref => ref.merchantId === req.partnerId);
          const linkedPaidSettlement = linkedSettlements.some(ref => paidSettlementIds.has(ref.settlementId));
          if (linkedPaidSettlement) return { ...o, payoutStatus: 'paid' as const, paidOutAt: paidNowIso, payoutReferenceId: cleanRef || req.id };
          const isForThisMerchant = orderGroups.size === 1 && orderGroups.has(req.partnerId) && linkedSettlements.length === 0;
          if (isForThisMerchant && o.settlementStatus === 'settled' && o.payoutStatus !== 'paid') {
            if (remainingToCover > 0) {
              let orderNet = 0;
              if (o.settlementId) {
                const st = (settings.merchantSettlements || []).find(x => x.id === o.settlementId);
                const snap = st?.orderSnapshots?.find(sn => sn.orderId === o.id);
                if (snap) orderNet = Math.max(0, snap.netMerchantAmount);
              }
              if (orderNet <= 0) {
                orderNet = Number(o.merchantItemCost || o.totalPrice || 0);
              }

              // Proportional FIFO: If remaining amount is sufficient to cover this order, mark paid
              if (remainingToCover >= orderNet || remainingToCover >= amount * 0.95) {
                remainingToCover -= orderNet;
                return {
                  ...o,
                  payoutStatus: 'paid' as const,
                  paidOutAt: paidNowIso,
                  payoutReferenceId: cleanRef || req.id
                };
              }
            }
          }
          return o;
        }));
      }

      setSelectedReqForApproval(null);
      setApprovalTreasuryAccountId('');
      setApprovalTransferRef('');
      setApprovalReceiptImage('');
      inAppToast(`تم اعتماد وصرف طلب السحب للموكل ${req.partnerName} بمبلغ ${amount.toLocaleString()} ج.م${transferFee > 0 ? ` (صافي بعد عمولة التحويل: ${netDisbursed.toLocaleString()} ج.م)` : ''} بنجاح ✅`, 'success');
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء اعتماد الطلب: ' + (err.message || ''), 'error');
    }
  };

  const handleRejectMerchantRequest = async (req: db.PartnerPortalRequest) => {
    try {
      const confirmed = await inAppConfirm(
        `هل أنت متأكد من رفض طلب السحب بمبلغ (${req.amount.toLocaleString()} ج.م) للموكل "${req.partnerName}"؟ سيتم إلغاء الحجز المؤقت وإتاحة المبلغ فوراً في محفظته.`,
        {
          title: 'تأكيد رفض طلب السحب',
          confirmText: 'نعم، رفض الطلب',
          cancelText: 'تراجع',
          type: 'danger'
        }
      );
      if (!confirmed) return;

      const updated = await db.updateMerchantRequestStatus(req.id, activeStoreId, 'rejected');
      if (!updated) {
        inAppToast('لم يتم رفض الطلب؛ ربما عولج مسبقاً. حدّث القائمة.', 'error');
        return;
      }
      setRawRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
      inAppToast('تم رفض طلب السحب للموكل وأصبح المبلغ متاحاً بالكامل في محفظته', 'info');
    } catch (err: any) {
      inAppToast('حدث خطأ أثناء رفض الطلب', 'error');
    }
  };

  // ========================================================
  // WEEKLY SCHEDULED PAYOUTS & 7-DAY HOLDING ADMIN CONTROLS
  // ========================================================
  const [editingPayoutPolicyMerchant, setEditingPayoutPolicyMerchant] = useState<any | null>(null);
  const [policyHoldingDays, setPolicyHoldingDays] = useState<number>(7);
  const [policyWeeklyDay, setPolicyWeeklyDay] = useState<number>(1);
  const [policyMinPayout, setPolicyMinPayout] = useState<number>(100);
  const [policyMaxPayout, setPolicyMaxPayout] = useState<number>(50000);
  const [policyPayoutMode, setPolicyPayoutMode] = useState<'auto' | 'admin_confirm'>('admin_confirm');
  const [policyPayoutFrequency, setPolicyPayoutFrequency] = useState<'weekly' | 'daily'>('weekly');
  const [policyWeeklyTransferFee, setPolicyWeeklyTransferFee] = useState<number>(25);
  const [policyWeeklyTransferFeeType, setPolicyWeeklyTransferFeeType] = useState<'fixed' | 'percentage'>('fixed');
  const [policyDailyTransferFee, setPolicyDailyTransferFee] = useState<number>(1);
  const [policyDailyTransferFeeType, setPolicyDailyTransferFeeType] = useState<'fixed' | 'percentage'>('percentage');
  const [policyPayoutStrategy, setPolicyPayoutStrategy] = useState<'rolling_hold' | 'batch_weekly' | 'manual_request'>('rolling_hold');


  const openMerchantPayoutPolicyModal = (supplier: any) => {
    setEditingPayoutPolicyMerchant(supplier);
    setPolicyHoldingDays(typeof supplier.holdingDaysAfterSettlement === 'number' ? supplier.holdingDaysAfterSettlement : 7);
    setPolicyWeeklyDay(typeof supplier.weeklyPayoutDay === 'number' ? supplier.weeklyPayoutDay : 1);
    setPolicyMinPayout(typeof supplier.minWeeklyPayout === 'number' ? supplier.minWeeklyPayout : 100);
    setPolicyMaxPayout(typeof supplier.maxWeeklyPayout === 'number' ? supplier.maxWeeklyPayout : 50000);
    setPolicyPayoutMode(supplier.weeklyPayoutMode || 'admin_confirm');
    setPolicyPayoutFrequency(supplier.payoutFrequency === 'daily' ? 'daily' : 'weekly');
    setPolicyWeeklyTransferFee(typeof supplier.weeklyTransferFee === 'number' ? supplier.weeklyTransferFee : 25);
    setPolicyWeeklyTransferFeeType(supplier.weeklyTransferFeeType === 'percentage' ? 'percentage' : 'fixed');
    setPolicyDailyTransferFee(typeof supplier.dailyTransferFee === 'number' ? supplier.dailyTransferFee : 1);
    setPolicyDailyTransferFeeType(supplier.dailyTransferFeeType === 'fixed' ? 'fixed' : 'percentage');
    setPolicyPayoutStrategy(supplier.payoutStrategy || 'rolling_hold');
  };

  const handleSaveMerchantPayoutPolicy = () => {
    if (!editingPayoutPolicyMerchant) return;
    const targetId = editingPayoutPolicyMerchant.id;

    updateSettings(prev => {
      const patchFn = (item: any) => {
        if (item.id === targetId) {
          return {
            ...item,
            holdingDaysAfterSettlement: Math.max(0, Number(policyHoldingDays)),
            weeklyPayoutDay: Number(policyWeeklyDay),
            minWeeklyPayout: Math.max(0, Number(policyMinPayout)),
            maxWeeklyPayout: Math.max(0, Number(policyMaxPayout)),
            weeklyPayoutMode: policyPayoutMode,
            payoutFrequency: policyPayoutFrequency,
            weeklyTransferFee: Math.max(0, Number(policyWeeklyTransferFee)),
            weeklyTransferFeeType: policyWeeklyTransferFeeType,
            dailyTransferFee: Math.max(0, Number(policyDailyTransferFee)),
            dailyTransferFeeType: policyDailyTransferFeeType,
            payoutStrategy: policyPayoutStrategy
          };
        }
        return item;
      };
      const updatedSuppliers = (prev.suppliers || []).map(patchFn);
      if (activeStoreId) {
        db.updatePartnerSettings(activeStoreId, prev.partners || [], updatedSuppliers).catch(() => {});
      }
      return {
        ...prev,
        suppliers: updatedSuppliers
      };
    });

    inAppToast(`تم حفظ سياسة التحويل والعمولة وفترة تعليق الأوردرات للموكل "${editingPayoutPolicyMerchant.name}" بنجاح ✅`, 'success');
    setEditingPayoutPolicyMerchant(null);
  };

  // Release 7-day hold for a single settled order immediately
  const handleReleaseOrderHold = (orderId: string) => {
    setOrders(currentOrders =>
      currentOrders.map(o =>
        o.id === orderId && getMerchantOrderGroups(o).size === 1 && !(o.merchantSettlementRefs || []).length
          ? {
              ...o,
              customHoldingDays: 0,
              payoutStatus: o.payoutStatus === 'paid' ? 'paid' : 'ready'
            }
          : o
      )
    );
    inAppToast('تم فك تعليق الأوردر فوراً وأصبح جاهزاً للتحويل الأسبوعي ⚡', 'success');
  };

  // Release 7-day hold for ALL settled orders belonging to a merchant
  const handleReleaseAllMerchantHoldOrders = (merchantId: string, merchantName: string) => {
    setOrders(currentOrders =>
      currentOrders.map(o => {
        const orderGroups = getMerchantOrderGroups(o);
        const isMatch = orderGroups.size === 1 && orderGroups.has(merchantId) && !(o.merchantSettlementRefs || []).some(ref => ref.merchantId === merchantId);
        if (isMatch && o.settlementStatus === 'settled' && o.payoutStatus !== 'paid') {
          return {
            ...o,
            customHoldingDays: 0,
            payoutStatus: 'ready' as const
          };
        }
        return o;
      })
    );
    inAppToast(`تم فك تعليق كافة الأوردرات المسواة للموكل "${merchantName}" وأصبحت جاهزة للتحويل فوراً ⚡`, 'success');
  };

  // Execute Weekly Scheduled Payout for a Merchant
  const handleExecuteWeeklyScheduledPayout = async (merchantRow: {
    supplier: any;
    payoutAmount: number;
    readyOrdersIds: string[];
  }) => {
    const { supplier, payoutAmount, readyOrdersIds } = merchantRow;
    if (!supplier || payoutAmount <= 0) {
      inAppToast('لا يوجد رصيد جاهز للتحويل الأسبوعي حالياً لهذا الموكل', 'warning');
      return;
    }
    if (payoutAmount > (supplier.balance || 0)) {
      inAppToast('المبلغ المطلوب تحويله يتجاوز الرصيد المسوّى الفعلي في محفظة الموكل', 'error');
      return;
    }

    // Calculate configured transfer fee (weekly / daily)
    const isDaily = supplier.payoutFrequency === 'daily';
    const feeRate = isDaily
      ? (typeof supplier.dailyTransferFee === 'number' ? supplier.dailyTransferFee : (settings.dailyTransferFee ?? 1))
      : (typeof supplier.weeklyTransferFee === 'number' ? supplier.weeklyTransferFee : (settings.weeklyTransferFee ?? 25));
    const feeType = isDaily
      ? (supplier.dailyTransferFeeType || settings.dailyTransferFeeType || 'percentage')
      : (supplier.weeklyTransferFeeType || settings.weeklyTransferFeeType || 'fixed');

    let transferFee = 0;
    if (feeRate > 0) {
      if (feeType === 'percentage') {
        transferFee = Math.round((payoutAmount * (feeRate / 100)) * 100) / 100;
      } else {
        transferFee = Math.min(payoutAmount, Number(feeRate) || 0);
      }
    }
    const netPayoutDisbursed = Math.max(0, Number((payoutAmount - transferFee).toFixed(2)));

    const confirmed = await inAppConfirm(
      `هل ترغب في اعتماد وصرف التحويل ${isDaily ? 'اليومي' : 'الأسبوعي'} للموكل "${supplier.name}" بمبلغ إجمالي (${payoutAmount.toLocaleString()} ج.م)${transferFee > 0 ? ` (عمولة التحويل: ${transferFee} ج.م | صافي المحول: ${netPayoutDisbursed.toLocaleString()} ج.م)` : ''} وتحديث حالة الأوردرات المستحقة إلى (مدفوع ✅)؟`,
      {
        title: `تأكيد صرف الدفعة ${isDaily ? 'اليومية' : 'الأسبوعية'} للموكل`,
        confirmText: `نعم، تأكيد وصرف التحويل ${isDaily ? 'اليومي' : 'الأسبوعي'}`,
        cancelText: 'تراجع',
        type: 'info'
      }
    );
    if (!confirmed) return;

    const nowIso = new Date().toISOString();
    const refId = `WK-PAY-${Date.now().toString().slice(-6)}`;

    updateSettings(currentSettings => {
      const updatedSuppliers = (currentSettings.suppliers || []).map(s => {
        if (s.id === supplier.id) {
          const currentBalance = Number(s.balance || 0);
          const nextBalance = Number((currentBalance - payoutAmount).toFixed(2));
          const newTx: MerchantTransaction = {
            id: `mtx-wk-${Date.now()}`,
            merchantId: s.id,
            merchantName: s.name,
            date: nowIso,
            type: 'withdrawal',
            amount: -payoutAmount,
            balanceAfter: nextBalance,
            notes: `صرف التحويل ${isDaily ? 'اليومي' : 'الأسبوعي'} المجدول (مرجع #${refId}) بعد إتمام فترة تعليق التسوية${transferFee > 0 ? ` [إجمالي المستحق: ${payoutAmount} ج.م | عمولة التحويل: ${transferFee} ج.م | صافي المحول: ${netPayoutDisbursed} ج.م]` : ''}`,
            referenceId: refId,
            performedBy: currentUser?.fullName || 'الإدارة'
          };
          return {
            ...s,
            balance: nextBalance,
            transactions: [newTx, ...(s.transactions || [])]
          };
        }
        return s;
      });

      const addedTx = updatedSuppliers.find(s => s.id === supplier.id)?.transactions?.[0];
      if (activeStoreId) {
        db.updatePartnerSettings(activeStoreId, currentSettings.partners || [], updatedSuppliers).catch(() => {});
      }
      return {
        ...currentSettings,
        suppliers: updatedSuppliers,
        ...(addedTx ? { merchantTransactions: [addedTx, ...(currentSettings.merchantTransactions || [])] } : {})
      };
    });

    const readySet = new Set(readyOrdersIds);
    setOrders(currentOrders =>
      currentOrders.map(o => {
        const orderGroups = getMerchantOrderGroups(o);
        const isForMerchant = orderGroups.size === 1 && orderGroups.has(supplier.id) && !(o.merchantSettlementRefs || []).some(ref => ref.merchantId === supplier.id);
        if (isForMerchant && o.settlementStatus === 'settled' && o.payoutStatus !== 'paid' && (readySet.size === 0 || readySet.has(o.id))) {
          return {
            ...o,
            payoutStatus: 'paid' as const,
            paidOutAt: nowIso,
            payoutReferenceId: refId
          };
        }
        return o;
      })
    );

    inAppToast(`تم صرف التحويل ${isDaily ? 'اليومي' : 'الأسبوعي'} للموكل "${supplier.name}" بمبلغ ${payoutAmount.toLocaleString()} ج.م${transferFee > 0 ? ` (صافي بعد العمولة: ${netPayoutDisbursed.toLocaleString()} ج.م)` : ''} بنجاح ✅`, 'success');
  };
  
  // History Filters
  const [historyMerchantFilter, setHistoryMerchantFilter] = useState<string>('');
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'pending' | 'approved' | 'paid' | 'cancelled' | 'draft'>('all');

  // New Settlement Form States
  const [flatServiceFee, setFlatServiceFee] = useState<number>(10); // عمولة الأوردر الافتراضية
  const [chargeServiceFeeOnReturns, setChargeServiceFeeOnReturns] = useState<boolean>(false); // احتساب عمولة الخدمة حتى على المرتجع
  const [deductReturnsFee, setDeductReturnsFee] = useState<boolean>(true); // خصم مصاريف شحن المرتجع
  const [returnShippingFeeAmount, setReturnShippingFeeAmount] = useState<number>(35); // رسوم شحن المرتجع
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedTreasuryAccountId, setSelectedTreasuryAccountId] = useState<string>('');
  const [payoutChannel, setPayoutChannel] = useState<'treasury_cash' | 'bank_transfer' | 'instapay' | 'mobile_wallet' | 'ledger_only'>('instapay');
  const [transferReference, setTransferReference] = useState<string>('');
  const [settlementNotes, setSettlementNotes] = useState<string>('');
  const [settlementAttachments, setSettlementAttachments] = useState<string[]>([]);
  const [viewingSettlement, setViewingSettlement] = useState<MerchantSettlement | null>(null);
  
  // Bulk Accounting Mode & Overrides
  const [batchAccountingMode, setBatchAccountingMode] = useState<'order_default' | 'fixed_fee' | 'profit_share' | 'wholesale'>('order_default');
  const [batchProfitSharePercent, setBatchProfitSharePercent] = useState<number>(50);
  const [orderOverrides, setOrderOverrides] = useState<Record<string, OrderCustomOverride>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Step 2 Table Filtering
  const [orderTableFilter, setOrderTableFilter] = useState<'all' | 'delivered' | 'returns'>('all');
  const [orderTableSearch, setOrderTableSearch] = useState<string>('');

  // Lump Sum Ad Spend for Agency Model
  const [lumpSumAdSpend, setLumpSumAdSpend] = useState<number>(0);
  const [batchMarketingFee, setBatchMarketingFee] = useState<number>(0); // مصاريف تسويق لكل أوردر في الكشف
  const [isLumpSumShared, setIsLumpSumShared] = useState<boolean>(true); // هل يتم تقاسم الإعلانات الكلية؟

  // Quick Add Partner Modal States
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');
  const [newPartnerEmail, setNewPartnerEmail] = useState('');
  const [newPartnerDefaultMarketing, setNewPartnerDefaultMarketing] = useState<number>(0);

  // Edit / Link Partner Email Modal States
  const [editingPartnerForEmail, setEditingPartnerForEmail] = useState<{ id: string; name: string; currentEmail?: string } | null>(null);
  const [partnerEmailInput, setPartnerEmailInput] = useState('');
  const [isSavingPartnerEmail, setIsSavingPartnerEmail] = useState(false);

  // Quick SMTP Setup Modal States
  const [showSmtpSetupModal, setShowSmtpSetupModal] = useState(false);
  const [smtpProvider, setSmtpProvider] = useState<'gmail' | 'smtp' | 'resend' | 'brevo'>('gmail');
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpResendKey, setSmtpResendKey] = useState('');
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [testMailRecipient, setTestMailRecipient] = useState('');
  const [isTestingMail, setIsTestingMail] = useState(false);

  // The active merchant directory is based on explicitly enabled merchant profiles.
  // Order names and old settlement snapshots remain historical evidence, never new accounts.
  const merchantsList = useMemo(() => {
    const list: Array<{ id: string; name: string; phone?: string; email?: string; sourceLabel?: string }> = [];
    const seen = new Set<string>();
    (settings.suppliers || []).forEach(s => {
      const id = String(s.id || '').trim();
      if (!id || !s.name || seen.has(id)) return;
      const hasActiveManagerPlan = s.managerPlan?.status === 'active' && s.managerPlan?.planId !== 'none';
      const hasSettledMerchantHistory = (settings.merchantSettlements || []).some(row =>
        row.merchantId === id && ['approved', 'paid'].includes(row.status) && !row.reversedAt
      );
      if (!(s.merchantDirectoryEnabled || s.isMerchantPortalActive || hasActiveManagerPlan || hasSettledMerchantHistory)) return;
      seen.add(id);
      list.push({
        id,
        name: s.name.trim(),
        phone: s.phone,
        email: s.email || '',
        sourceLabel: hasActiveManagerPlan ? 'باقة مدير مخصصة نشطة' : 'ملف وكيل مسجل'
      });
    });

    return list;
  }, [settings.suppliers, settings.merchantSettlements]);

  // Helper to check if an order belongs to a merchant (never matching buyer customerPhone/customerName)
  const doesOrderBelongToMerchant = (o: Order, merchantId: string) => {
    const targetId = String(merchantId || '').trim().toLowerCase();
    if (!targetId || targetId === 'all' || targetId === 'pending') return false;
    return getMerchantOrderGroups(o).has(targetId);
  };

  const isOrderUnsettledForMerchant = (order: Order, merchantId: string) => {
    if ((order.merchantSettlementRefs || []).some(ref => ref.merchantId === merchantId)) return false;
    // Legacy orders have only one global settlement marker; preserve that protection until explicitly migrated.
    if (order.settlementStatus === 'settled' && !(order.merchantSettlementRefs || []).length) return false;
    return true;
  };

  const isOrderEligibleForAnyMerchantSettlement = (order: Order) =>
    SETTLEMENT_ELIGIBLE_STATUSES.includes(order.status) &&
    [...getMerchantOrderGroups(order).keys()].some(merchantId => isOrderUnsettledForMerchant(order, merchantId));

  // Handle adding a new Partner / Goods Owner directly into settings.suppliers
  const handleAddNewPartner = () => {
    if (!newPartnerName.trim()) {
      inAppToast('يرجى إدخال اسم الموكل / صاحب البضاعة', 'warning');
      return;
    }
    const newId = `SUP-PARTNER-${Date.now()}`;
    const cleanEmail = newPartnerEmail.trim().toLowerCase();
    const newPartner = {
      id: newId,
      name: newPartnerName.trim(),
      phone: newPartnerPhone.trim(),
      email: cleanEmail,
      passcode: '0000',
      address: '',
      notes: 'موكل / صاحب بضاعة (تمت إضافته من شاشة التسويات)',
      merchantDirectoryEnabled: true,
      defaultMarketingFeePerOrder: newPartnerDefaultMarketing > 0 ? newPartnerDefaultMarketing : undefined
    };

    updateSettings(prev => {
      const nextSuppliers = [newPartner, ...(prev.suppliers || [])];
      if (activeStoreId) {
        db.updatePartnerSettings(activeStoreId, prev.partners || [], nextSuppliers).catch(() => {});
      }
      return {
        ...prev,
        suppliers: nextSuppliers,
      };
    });

    setSelectedMerchantId(newId);
    setNewPartnerName('');
    setNewPartnerPhone('');
    setNewPartnerEmail('');
    setNewPartnerDefaultMarketing(0);
    setShowAddPartnerModal(false);
    inAppToast(`تم تسجيل الموكل "${newPartner.name}" بنجاح${cleanEmail ? ` وربط بريده (${cleanEmail})` : ''}.`, 'success');
  };

  // Save or Update Partner Email
  const handleSavePartnerEmail = () => {
    if (!editingPartnerForEmail) return;
    const cleanEmail = partnerEmailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      inAppToast('يرجى إدخال عنوان بريد إلكتروني صحيح (مثال: name@gmail.com)', 'warning');
      return;
    }

    setIsSavingPartnerEmail(true);
    try {
      updateSettings(prev => {
        const targetId = editingPartnerForEmail.id;

        let supplierMatched = false;
        const updatedSuppliers = (prev.suppliers || []).map(s => {
          if (s.id === targetId) {
            supplierMatched = true;
            return { ...s, email: cleanEmail, passcode: s.passcode || '0000' };
          }
          return s;
        });

        if (!supplierMatched) {
          updatedSuppliers.push({
            id: targetId,
            name: editingPartnerForEmail.name,
            phone: '',
            email: cleanEmail,
            passcode: '0000',
            address: '',
            notes: 'موكل / مورد معتمد'
          });
        }

        if (activeStoreId) {
          db.updatePartnerSettings(activeStoreId, prev.partners || [], updatedSuppliers).catch(() => {});
        }
        return {
          ...prev,
          suppliers: updatedSuppliers
        };
      });

      inAppToast(`تم ربط وتفعيل البريد الإلكتروني (${cleanEmail}) للموكل "${editingPartnerForEmail.name}" بنجاح! يمكنه الآن تسجيل الدخول للبوابة باستخدامه.`, 'success');
      setEditingPartnerForEmail(null);
      setPartnerEmailInput('');
    } catch (err: any) {
      inAppToast(`تعذر حفظ البريد: ${err.message}`, 'error');
    } finally {
      setIsSavingPartnerEmail(false);
    }
  };

  // Save SMTP Mail Server Settings
  const handleSaveSmtp = async () => {
    setIsSavingSmtp(true);
    try {
      const payload: any = {
        provider: smtpProvider,
        from: smtpFrom.trim()
      };

      if (smtpProvider === 'resend') {
        payload.resendApiKey = smtpResendKey.trim();
      } else if (smtpProvider === 'gmail') {
        payload.host = 'smtp.gmail.com';
        payload.port = 587;
        payload.user = smtpUser.trim();
        payload.pass = smtpPass.trim();
      } else {
        payload.host = smtpHost.trim();
        payload.port = Number(smtpPort) || 587;
        payload.user = smtpUser.trim();
        payload.pass = smtpPass.trim();
      }

      const res = await fetch('/api/save-smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        inAppToast('تم حفظ وتفعيل خادم إرسال البريد بنجاح! سيتم إرسال أكواد الدخول الفعلية للموكلين.', 'success');
      } else {
        inAppToast(data.error || 'تعذر حفظ إعدادات البريد', 'error');
      }
    } catch (err: any) {
      inAppToast(`خطأ أثناء الحفظ: ${err.message}`, 'error');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  // Test Real Mail Dispatch
  const handleSendTestMail = async () => {
    if (!testMailRecipient || !testMailRecipient.includes('@')) {
      inAppToast('يرجى إدخال بريد إلكتروني لاستلام الرسالة التجريبية', 'warning');
      return;
    }
    setIsTestingMail(true);
    try {
      const res = await fetch('/api/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: testMailRecipient.trim().toLowerCase(),
          userName: 'المسؤول العزيز',
          storeName: settings.storeName || 'بوابة الموكلين'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        inAppToast(data.message || `تم إرسال بريد الاختبار بنجاح إلى (${testMailRecipient})! تفقد صندوق الوارد والبريد غير الهام (Spam).`, 'success');
      } else {
        inAppToast(data.error || 'تعذر إرسال البريد. تحقق من إعدادات الخادم أو كلمة مرور التطبيق.', 'error');
      }
    } catch (err: any) {
      inAppToast(`خطأ في الإرسال: ${err.message}`, 'error');
    } finally {
      setIsTestingMail(false);
    }
  };

  // Partner Analytics & Directory Summary
  const partnersSummary = useMemo(() => {
    return merchantsList.map(m => {
      const mOrders = orders.filter(o => doesOrderBelongToMerchant(o, m.id));
      const unsettledEligible = mOrders.filter(o => isOrderUnsettledForMerchant(o, m.id) && SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status));
      const settledOrders = mOrders.filter(o => !isOrderUnsettledForMerchant(o, m.id));
      const deliveredCount = mOrders.filter(o => DELIVERED_STATUSES.includes(o.status)).length;
      const returnCount = mOrders.filter(o => RETURN_STATUSES.includes(o.status)).length;
      const pendingCollection = unsettledEligible.reduce((sum, o) => {
        if (!DELIVERED_STATUSES.includes(o.status)) return sum;
        const ownerLines = getMerchantOrderGroups(o).get(m.id) || [];
        const ownerValue = ownerLines.reduce((n, item) => n + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
        const allValue = [...getMerchantOrderGroups(o).values()].flat().reduce((n, item) => n + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
        return sum + (Number(o.totalPrice) || 0) * (allValue > 0 ? ownerValue / allValue : 0);
      }, 0);
      const pendingGoodsCost = unsettledEligible.reduce((sum, o) => {
        const gc = (getMerchantOrderGroups(o).get(m.id) || []).reduce((s, i) => s + ((Number(i.cost) || 0) * (Number(i.quantity) || 1)), 0);
        return sum + (DELIVERED_STATUSES.includes(o.status) ? gc : 0);
      }, 0);

      const mSettlements = (settings.merchantSettlements || []).filter(st => st.status === 'paid' && !st.reversedAt && st.merchantId === m.id);
      const totalPaidOut = mSettlements.reduce((sum, st) => sum + (st.netPayoutToMerchant || 0), 0);
      const totalAgencyEarned = mSettlements.reduce((sum, st) => sum + (st.totalOperatorEarnings ?? st.totalServiceFees ?? 0), 0);
      const supplierAccount = (settings.suppliers || []).find(supplier => supplier.id === m.id);
      const merchantLedgerTransactions = [...new Map([
        ...(settings.merchantTransactions || []),
        ...(supplierAccount?.transactions || [])
      ].map(tx => [tx.id, tx])).values()];
      const hasOpeningBalance = typeof supplierAccount?.merchantSettlementOpeningBalance === 'number' && Boolean(supplierAccount?.merchantSettlementOpeningAt);
      const currentBalance = hasOpeningBalance
        ? calculateMerchantBalance(settings.merchantSettlements || [], merchantLedgerTransactions, m.id, supplierAccount!.merchantSettlementOpeningBalance)
        : Number(supplierAccount?.balance) || 0;

      return {
        ...m,
        totalOrdersCount: mOrders.length,
        unsettledCount: unsettledEligible.length,
        settledCount: settledOrders.length,
        deliveredCount,
        returnCount,
        returnRate: mOrders.length > 0 ? Math.round((returnCount / mOrders.length) * 100) : 0,
        pendingCollection,
        pendingGoodsCost,
        settlementsCount: mSettlements.length,
        totalPaidOut,
        totalAgencyEarned,
        currentBalance
      };
    }).sort((a, b) => b.unsettledCount - a.unsettledCount || b.totalOrdersCount - a.totalOrdersCount);
  }, [merchantsList, orders, settings.merchantSettlements, settings.merchantTransactions, settings.suppliers]);

  // Weekly Scheduled Payouts & 7-Day Holding Summary per Supplier
  const weeklyScheduledPayoutsSummary = useMemo(() => {
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    const todayDayIndex = now.getDay();

    return (settings.suppliers || []).map(s => {
      const weeklyDayIndex = typeof s.weeklyPayoutDay === 'number' ? s.weeklyPayoutDay : 1;
      const holdingDaysSetting = typeof s.holdingDaysAfterSettlement === 'number' ? s.holdingDaysAfterSettlement : 7;
      const minWeeklyPayout = typeof s.minWeeklyPayout === 'number' ? s.minWeeklyPayout : 100;
      const maxWeeklyPayout = typeof s.maxWeeklyPayout === 'number' ? s.maxWeeklyPayout : 50000;
      const weeklyPayoutMode: 'auto' | 'admin_confirm' = s.weeklyPayoutMode || 'admin_confirm';

      let daysUntilNext = (weeklyDayIndex - todayDayIndex + 7) % 7;
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + daysUntilNext);
      const nextDateFormatted = nextDate.toLocaleDateString('ar-EG', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
      });

      const mOrders = orders.filter(o => doesOrderBelongToMerchant(o, s.id));
      const settledUnpaidOrders = mOrders.filter(o => o.settlementStatus === 'settled' && o.payoutStatus !== 'paid' && getMerchantOrderGroups(o).size === 1 && !(o.merchantSettlementRefs || []).some(ref => ref.merchantId === s.id));

      let holdingAmount = 0;
      let holdingOrdersCount = 0;
      const readyOrdersIds: string[] = [];

      const isWeeklyFreq = (s.payoutFrequency || 'weekly') === 'weekly';
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const daysSinceLastPayoutDay = (todayDayIndex - weeklyDayIndex + 7) % 7;
      const currentWeekCycleStart = todayStart - daysSinceLastPayoutDay * 86400000;
      const daysUntilNextPayoutDay = ((weeklyDayIndex - todayDayIndex + 7) % 7) || 7;

      settledUnpaidOrders.forEach(o => {
        const strategy = s.payoutStrategy || 'rolling_hold';
        const orderHoldDays = typeof o.customHoldingDays === 'number' ? o.customHoldingDays : holdingDaysSetting;
        const settledAtTime = o.settledAt ? new Date(o.settledAt).getTime() : new Date(o.date || Date.now()).getTime();
        const elapsedDays = Math.max(0, (Date.now() - settledAtTime) / 86400000);
        
        let remDays = 0;
        
        if (o.payoutStatus === 'ready') {
          remDays = 0;
        } else if (strategy === 'manual_request') {
          remDays = 0;
        } else if (strategy === 'batch_weekly') {
          const isSettledInCurrentCycle = settledAtTime >= currentWeekCycleStart;
          remDays = isSettledInCurrentCycle ? daysUntilNextPayoutDay : 0;
        } else {
          // rolling_hold (default)
          const baseRemDays = Math.max(0, Math.ceil(orderHoldDays - elapsedDays));
          const isSettledThisWeekCycle = isWeeklyFreq && orderHoldDays > 0 && settledAtTime >= currentWeekCycleStart;
          remDays = isSettledThisWeekCycle
            ? Math.max(baseRemDays, daysUntilNextPayoutDay)
            : baseRemDays;
        }

        // Find net amount from settlement snapshot if available
        let orderNet = 0;
        if (o.settlementId) {
          const st = (settings.merchantSettlements || []).find(x => x.id === o.settlementId);
          const snap = st?.orderSnapshots?.find(sn => sn.orderId === o.id);
          if (snap) orderNet = snap.netMerchantAmount;
        }
        if (remDays > 0) {
          holdingOrdersCount++;
          holdingAmount += Math.max(0, orderNet);
        } else {
          readyOrdersIds.push(o.id);
        }
      });

      const currentWalletBalance = Math.max(0, Number(s.balance || 0));
      const maturedReadyBalance = Math.max(0, Number((currentWalletBalance - holdingAmount).toFixed(2)));
      const nextScheduledPayoutAmount = maxWeeklyPayout > 0
        ? Math.min(maturedReadyBalance, maxWeeklyPayout)
        : maturedReadyBalance;

      return {
        supplier: s,
        weeklyDayIndex,
        weeklyDayNameAr: dayNamesAr[weeklyDayIndex] || 'الإثنين',
        daysUntilNext,
        nextDateFormatted,
        holdingDaysSetting,
        minWeeklyPayout,
        maxWeeklyPayout,
        weeklyPayoutMode,
        currentWalletBalance,
        holdingAmount: Math.round(holdingAmount * 100) / 100,
        holdingOrdersCount,
        readyOrdersCount: readyOrdersIds.length,
        readyOrdersIds,
        maturedReadyBalance,
        nextScheduledPayoutAmount: Math.round(nextScheduledPayoutAmount * 100) / 100,
        isEligibleForPayout: nextScheduledPayoutAmount >= minWeeklyPayout && nextScheduledPayoutAmount > 0
      };
    });
  }, [settings.suppliers, settings.merchantSettlements, orders]);

  // Global Executive KPIs
  const executiveMetrics = useMemo(() => {
    const allSettlements = settings.merchantSettlements || [];
    const activeSettlements = allSettlements.filter(s => !s.reversedAt);
    const totalNetPaid = activeSettlements
      .filter(s => s.status !== 'draft')
      .reduce((sum, s) => sum + (s.netPayoutToMerchant || 0), 0);
    const totalOperatorRevenue = activeSettlements
      .reduce((sum, s) => sum + (s.totalOperatorEarnings ?? s.totalServiceFees ?? 0), 0);
    const totalRecoveredDeductions = activeSettlements
      .reduce((sum, s) => sum + (s.totalShippingCosts || 0) + (s.totalReturnFees || 0) + (s.totalMarketingCosts || 0), 0);

    const totalUnsettledOrders = partnersSummary.reduce((sum, p) => sum + p.unsettledCount, 0);
    const totalPendingCollectionValue = partnersSummary.reduce((sum, p) => sum + p.pendingCollection, 0);
    const partnersWithPendingCount = partnersSummary.filter(p => p.unsettledCount > 0).length;

    return {
      settlementsCount: allSettlements.length,
      totalNetPaid,
      totalOperatorRevenue,
      totalRecoveredDeductions,
      totalUnsettledOrders,
      totalPendingCollectionValue,
      partnersWithPendingCount
    };
  }, [settings.merchantSettlements, partnersSummary]);

  // Unsettled Orders for the Selected Merchant or All Merchants
  const eligibleOrders = useMemo(() => {
    if (!selectedMerchantId) return [];
    if (selectedMerchantId === 'all') {
      return orders.filter(o => {
        const isEligibleStatus = SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
        const groupIds = [...getMerchantOrderGroups(o).keys()];
        return isEligibleStatus && groupIds.some(id => isOrderUnsettledForMerchant(o, id));
      });
    }
    return orders.filter(o => {
      const isMatch = doesOrderBelongToMerchant(o, selectedMerchantId);
      const isUnsettled = isOrderUnsettledForMerchant(o, selectedMerchantId);
      const isEligibleStatus = SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
      return isMatch && isUnsettled && isEligibleStatus;
    });
  }, [orders, selectedMerchantId, merchantsList]);

  // Filtered Eligible Orders for Step 2 Table display
  const displayedEligibleOrders = useMemo(() => {
    return eligibleOrders.filter(o => {
      const isDelivered = DELIVERED_STATUSES.includes(o.status);
      const isReturn = RETURN_STATUSES.includes(o.status);
      if (orderTableFilter === 'delivered' && !isDelivered) return false;
      if (orderTableFilter === 'returns' && !isReturn) return false;

      if (orderTableSearch.trim()) {
        const q = orderTableSearch.toLowerCase();
        const numMatch = String(o.orderNumber || o.id).toLowerCase().includes(q);
        const custMatch = String(o.customerName || '').toLowerCase().includes(q);
        const phoneMatch = String(o.customerPhone || '').toLowerCase().includes(q);
        const merchantMatch = String(o.merchantName || '').toLowerCase().includes(q);
        return numMatch || custMatch || phoneMatch || merchantMatch;
      }
      return true;
    });
  }, [eligibleOrders, orderTableFilter, orderTableSearch]);

  // Auto-select all eligible orders when merchant changes
  const handleSelectMerchant = (mId: string) => {
    setSelectedMerchantId(mId);
    if (mId === 'all') {
      const allOrders = orders.filter(o => {
        const isEligibleStatus = SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
        const groupIds = [...getMerchantOrderGroups(o).keys()];
        return isEligibleStatus && groupIds.some(id => isOrderUnsettledForMerchant(o, id));
      });
      setSelectedOrderIds(allOrders.map(o => o.id));
      setExpandedOrderId(null);
      return;
    }
    const mOrders = orders.filter(o => {
      const isMatch = doesOrderBelongToMerchant(o, mId);
      return isMatch && isOrderUnsettledForMerchant(o, mId) && SETTLEMENT_ELIGIBLE_STATUSES.includes(o.status);
    });
    setSelectedOrderIds(mOrders.map(o => o.id));
    setExpandedOrderId(null);
  };

  // Toggle Order Selection
  const toggleOrderSelection = (id: string) => {
    setSelectedOrderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Update per-order custom override
  const updateOrderOverride = (orderId: string, patch: Partial<OrderCustomOverride>) => {
    setOrderOverrides(prev => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        ...patch
      }
    }));
  };

  const resetOrderOverride = (orderId: string) => {
    setOrderOverrides(prev => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  };

  // Helper to compute single order financial breakdown with overrides & batch settings
  const computeOrderFinancials = (o: Order, merchantIdOverride?: string) => {
    const ov = orderOverrides[o.id] || {};
    const targetMerchantId = merchantIdOverride || (selectedMerchantId !== 'all' ? selectedMerchantId : '');
    const lines = targetMerchantId ? getMerchantOrderGroups(o).get(targetMerchantId) || [] : [];
    const allItems = o.items || [];
    const allGross = allItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    const lineGross = lines.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    const allQty = allItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const lineQty = lines.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const lineRatio = lines.length && lines.length < allItems.length
      ? (allGross > 0 ? lineGross / allGross : allQty > 0 ? lineQty / allQty : 0)
      : 1;
    const scaledFields = ['totalPrice', 'totalAmountOverride', 'shippingFee', 'insuranceFee', 'vatValue', 'inspectionFee', 'codFee', 'serviceFeePerOrder', 'marketingFeePerOrder'];
    const financialOrder = lines.length && lines.length < allItems.length
      ? {
          ...o,
          items: lines,
          merchantItemCost: lines.reduce((sum, item) => sum + (Number(item.cost) || 0) * (Number(item.quantity) || 0), 0),
          ...Object.fromEntries(scaledFields.map(field => [field, (o as any)[field] == null ? (o as any)[field] : Math.round(Number((o as any)[field]) * lineRatio * 100) / 100]))
        } as Order
      : o;
    const scaledOverride = lineRatio < 1 ? {
      ...ov,
      ...(ov.shippingFee !== undefined ? { shippingFee: ov.shippingFee * lineRatio } : {}),
      ...(ov.insuranceFee !== undefined ? { insuranceFee: ov.insuranceFee * lineRatio } : {}),
      ...(ov.vatFee !== undefined ? { vatFee: ov.vatFee * lineRatio } : {}),
      ...(ov.inspectionFee !== undefined ? { inspectionFee: ov.inspectionFee * lineRatio } : {}),
      ...(ov.codFee !== undefined ? { codFee: ov.codFee * lineRatio } : {}),
      ...(ov.serviceFee !== undefined ? { serviceFee: ov.serviceFee * lineRatio } : {}),
      ...(ov.marketingFee !== undefined ? { marketingFee: ov.marketingFee * lineRatio } : {})
    } : ov;
    const isDelivered = DELIVERED_STATUSES.includes(o.status);
    const isReturn = RETURN_STATUSES.includes(o.status);

    // Accounting Mode resolution: Per-Order Override -> Batch Override -> Order Default
    const effectiveMode: 'fixed_fee' | 'profit_share' | 'wholesale' = ov.mode
      ? ov.mode
      : batchAccountingMode !== 'order_default'
      ? batchAccountingMode
      : financialOrder.merchantSettlementMode === 'profit_share'
      ? 'profit_share'
      : financialOrder.merchantSettlementMode === 'wholesale'
      ? 'wholesale'
      : 'fixed_fee';

    const effectiveSharePercent = ov.sharePercent !== undefined
      ? ov.sharePercent
      : batchAccountingMode === 'profit_share'
      ? batchProfitSharePercent
      : (financialOrder.merchantProfitSharePercent || 50);

    // 1. Goods Cost
    const defaultGoodsCost = financialOrder.merchantItemCost || (financialOrder.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0);
    const goodsCost = scaledOverride.goodsCost !== undefined ? scaledOverride.goodsCost * (lineRatio < 1 ? lineRatio : 1) : defaultGoodsCost;

    // 2. Shipping & Carrier Fees Breakdown
    const shippingBreakdown = calculateMerchantShippingBreakdown(financialOrder, settings, scaledOverride);
    const shippingAndFees = shippingBreakdown.total;

    // 3. Collection Fees (COD fees)
    const codFee = isDelivered ? shippingBreakdown.codFee : 0;

    // 4. Marketing Cost
    const defaultMarketing = financialOrder.marketingFeePerOrder !== undefined && financialOrder.marketingFeePerOrder > 0 ? financialOrder.marketingFeePerOrder : batchMarketingFee * (lineRatio < 1 ? lineRatio : 1);
    const marketingCost = scaledOverride.marketingFee !== undefined ? scaledOverride.marketingFee * (lineRatio < 1 ? lineRatio : 1) : defaultMarketing;

    // 5. Service Fee (عمولة الخدمة والتشغيل)
    // منع الخصم المزدوج: إذا كان الأوردر مشمولاً في كوتة باقة شهرية/مدفوعة، أو تم خصم رسوم المدير مسبقاً
    const isCoveredByPlanOrPrepaid = Boolean(
      (financialOrder as any).quotaIncludedOrder || 
      (financialOrder as any).isQuotaCovered ||
      (financialOrder as any).managerFeeDeducted
    );
    const defaultServiceFee = isCoveredByPlanOrPrepaid
      ? 0
      : (financialOrder.serviceFeePerOrder !== undefined ? financialOrder.serviceFeePerOrder : flatServiceFee * (lineRatio < 1 ? lineRatio : 1));
    const serviceFee = ((isDelivered || chargeServiceFeeOnReturns) && effectiveMode !== 'profit_share')
      ? (scaledOverride.serviceFee !== undefined ? scaledOverride.serviceFee * (lineRatio < 1 ? lineRatio : 1) : defaultServiceFee)
      : 0;

    // 6. Return Fee
    // Use the component-level state if enabled, otherwise 0.
    // If there's an override on the order, use that.
    const returnFee = isReturn && deductReturnsFee 
      ? (scaledOverride.returnFee !== undefined ? scaledOverride.returnFee * (lineRatio < 1 ? lineRatio : 1) : returnShippingFeeAmount * (lineRatio < 1 ? lineRatio : 1))
      : 0;

    // 7. Collected Cash Revenue from Customer
    const orderRevenue = isDelivered 
      ? (financialOrder.totalAmountOverride !== undefined && financialOrder.totalAmountOverride !== null && Number(financialOrder.totalAmountOverride) > 0
          ? Number(financialOrder.totalAmountOverride)
          : (Number(financialOrder.totalPrice) || 0))
      : 0;

    let orderPayout = 0;
    let operatorOrderEarning = serviceFee;

    if (effectiveMode === 'profit_share') {
      const merchantShareRatio = effectiveSharePercent / 100;
      const totalOutofPocketExpenses = shippingAndFees + marketingCost + returnFee;
      const goodsValueDeduction = isDelivered ? goodsCost : 0;
      const netProfitOrLoss = orderRevenue - goodsValueDeduction - totalOutofPocketExpenses;
      const merchantProfitShare = netProfitOrLoss * merchantShareRatio;
      orderPayout = (isDelivered ? goodsCost : 0) + merchantProfitShare;
      operatorOrderEarning = Math.max(0, netProfitOrLoss * (1 - merchantShareRatio));
    } else if (effectiveMode === 'wholesale') {
      // WHOLESALE MODE
      // صافي مستحق الموكل = سعر الجملة - المصاريف (إذا كان الموكل يتحملها)
      const totalDeductions = serviceFee + shippingAndFees + marketingCost + returnFee;
      orderPayout = isDelivered ? (goodsCost - totalDeductions) : (-totalDeductions);
      operatorOrderEarning = isDelivered ? (orderRevenue - goodsCost + serviceFee) : 0;
    } else {
      // FIXED FEE / COMMISSION MODE
      // صافي مستحق الموكل = إجمالي التحصيل - مصاريف الشحن - رسوم شركة الشحن (تأمين + ضريبة + معاينة + COD) - عمولة المنصة - مصاريف التسويق
      const totalDeductions = serviceFee + shippingAndFees + marketingCost + returnFee;
      orderPayout = isDelivered ? (orderRevenue - totalDeductions) : (-totalDeductions);
    }

    const returnLoss = isReturn ? (shippingAndFees + marketingCost + returnFee) : 0;
    const merchantNetProfitOverCost = isDelivered ? (orderPayout - goodsCost) : (-returnLoss);

    return {
      isDelivered,
      isReturn,
      effectiveMode,
      effectiveSharePercent,
      goodsCost,
      defaultGoodsCost,
      shippingBreakdown,
      shippingAndFees,
      codFee,
      marketingCost,
      serviceFee,
      returnFee,
      orderRevenue,
      orderPayout: Math.round(orderPayout * 100) / 100,
      operatorOrderEarning: Math.round(operatorOrderEarning * 100) / 100,
      returnLoss: Math.round(returnLoss * 100) / 100,
      merchantNetProfitOverCost: Math.round(merchantNetProfitOverCost * 100) / 100,
      hasCustomOverride: Object.keys(ov).length > 0
    };
  };

  // Calculations for New Settlement
  const settlementCalculation = useMemo(() => {
    const ordersToProcess = eligibleOrders.filter(o => selectedOrderIds.includes(o.id));
    
    let totalCollected = 0;
    let totalMerchantGoodsCost = 0;
    let totalServiceFees = 0;
    let totalShippingCosts = 0;
    let totalMarketingCosts = 0;
    let totalReturnFees = 0;
    let totalCollectionFees = 0;
    let totalShippingDiscountDifference = 0;
    let totalCarrierAdditionalFees = 0;
    let totalReturnLosses = 0;
    let totalOperatorEarnings = 0;
    let deliveredOrdersCount = 0;
    let returnOrdersCount = 0;
    const orderSnapshots: MerchantSettlementOrderSnapshot[] = [];

    let netPayoutToMerchant = 0;

    // Lump sum ad spend deduction
    let sharedLumpSumDeduction = lumpSumAdSpend;
    if (isLumpSumShared && ordersToProcess.length > 0) {
      const profitShareOrders = ordersToProcess.filter(o => {
        const mode = orderOverrides[o.id]?.mode || (batchAccountingMode !== 'order_default' ? batchAccountingMode : o.merchantSettlementMode);
        return mode === 'profit_share';
      });
      if (profitShareOrders.length > 0) {
        const avgShare = profitShareOrders.reduce((sum, o) => {
          const pct = orderOverrides[o.id]?.sharePercent ?? (batchAccountingMode === 'profit_share' ? batchProfitSharePercent : (o.merchantProfitSharePercent || 50));
          return sum + pct;
        }, 0) / profitShareOrders.length;
        sharedLumpSumDeduction = lumpSumAdSpend * (avgShare / 100);
      } else {
        sharedLumpSumDeduction = lumpSumAdSpend;
      }
    }

    const adSharePerOrder = ordersToProcess.length > 0 ? Math.round((sharedLumpSumDeduction / ordersToProcess.length) * 100) / 100 : 0;

    ordersToProcess.forEach(o => {
      const calc = computeOrderFinancials(o);

      if (calc.isDelivered) deliveredOrdersCount++;
      if (calc.isReturn) returnOrdersCount++;

      totalServiceFees += calc.serviceFee;
      totalOperatorEarnings += calc.operatorOrderEarning;
      totalCollectionFees += calc.codFee;
      totalShippingCosts += calc.shippingBreakdown.baseShippingFee;
      totalShippingDiscountDifference += calc.shippingBreakdown.shippingDiscountDifference;
      totalCarrierAdditionalFees += calc.shippingBreakdown.carrierAdditionalFees;
      totalMarketingCosts += calc.marketingCost;
      totalReturnFees += calc.returnFee;
      totalCollected += calc.orderRevenue;

      if (calc.isDelivered) {
        totalMerchantGoodsCost += calc.goodsCost;
      }

      netPayoutToMerchant += calc.orderPayout;
      totalReturnLosses += calc.returnLoss;

      orderSnapshots.push({
        orderId: o.id,
        orderNumber: o.orderNumber,
        date: o.date,
        status: o.status,
        customerName: o.customerName,
        shippingCompany: o.shippingCompany,
        collectedAmount: calc.orderRevenue,
        merchantGoodsCost: calc.isDelivered ? calc.goodsCost : 0,
        customerPaidShipping: calc.shippingBreakdown.customerPaidShipping,
        officialShippingFee: calc.shippingBreakdown.officialShippingFee,
        shippingDiscountDifference: calc.shippingBreakdown.shippingDiscountDifference,
        carrierAdditionalFees: calc.shippingBreakdown.carrierAdditionalFees,
        collectionFee: calc.codFee,
        marketingCost: Math.round((calc.marketingCost + adSharePerOrder) * 100) / 100,
        serviceFee: calc.serviceFee,
        returnLoss: calc.returnLoss,
        insuranceFee: calc.shippingBreakdown.insuranceFee,
        inspectionFee: calc.shippingBreakdown.inspectionFee,
        vatFee: calc.shippingBreakdown.vatFee,
        mode: calc.effectiveMode,
        sharePercent: calc.effectiveSharePercent,
        netMerchantAmount: Math.round((calc.orderPayout - adSharePerOrder) * 100) / 100
      });
    });

    netPayoutToMerchant -= sharedLumpSumDeduction;

    const totalAllDeductions =
      totalServiceFees +
      totalShippingCosts +
      totalCarrierAdditionalFees +
      totalCollectionFees +
      totalMarketingCosts +
      sharedLumpSumDeduction +
      totalReturnFees;

    return {
      ordersCount: ordersToProcess.length,
      deliveredOrdersCount,
      returnOrdersCount,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalMerchantGoodsCost: Math.round(totalMerchantGoodsCost * 100) / 100,
      totalServiceFees: Math.round(totalServiceFees * 100) / 100,
      totalShippingCosts: Math.round(totalShippingCosts * 100) / 100,
      totalMarketingCosts: Math.round((totalMarketingCosts + sharedLumpSumDeduction) * 100) / 100,
      sharedLumpSumDeduction: Math.round(sharedLumpSumDeduction * 100) / 100,
      totalReturnFees: Math.round(totalReturnFees * 100) / 100,
      totalCollectionFees: Math.round(totalCollectionFees * 100) / 100,
      totalShippingDiscountDifference: Math.round(totalShippingDiscountDifference * 100) / 100,
      totalCarrierAdditionalFees: Math.round(totalCarrierAdditionalFees * 100) / 100,
      totalReturnLosses: Math.round(totalReturnLosses * 100) / 100,
      totalOperatorEarnings: Math.round(totalOperatorEarnings * 100) / 100,
      totalAllDeductions: Math.round(totalAllDeductions * 100) / 100,
      orderSnapshots,
      netPayoutToMerchant: Math.round(netPayoutToMerchant * 100) / 100
    };
  }, [
    eligibleOrders,
    selectedOrderIds,
    flatServiceFee,
    deductReturnsFee,
    returnShippingFeeAmount,
    lumpSumAdSpend,
    isLumpSumShared,
    batchMarketingFee,
    batchAccountingMode,
    batchProfitSharePercent,
    orderOverrides,
    settings
  ]);

  // Build Draft Settlement Object (for previewing / printing / exporting before saving)
  const buildDraftSettlement = (status: 'draft' | 'approved' | 'paid' = 'paid'): MerchantSettlement => {
    const merchant = merchantsList.find(m => m.id === selectedMerchantId);
    const mName = merchant ? merchant.name : selectedMerchantId || 'موكل غير محدد';
    const settlementId = `SETT-${Date.now()}`;
    const settlementNumber = `ST-${String((settings.merchantSettlements || []).length + 1).padStart(5, '0')}`;
    const treasuryAccount = (treasury?.accounts || []).find(a => a.id === selectedTreasuryAccountId);

    const channelLabels: Record<string, string> = {
      treasury_cash: 'صرف نقدي مباشر',
      bank_transfer: 'تحويل بنكي',
      instapay: 'إنستاباي (InstaPay)',
      mobile_wallet: 'محفظة إلكترونية',
      ledger_only: 'تسوية دفترية'
    };

    const fullNotes = [
      channelLabels[payoutChannel] ? `طريقة الدفع: ${channelLabels[payoutChannel]}` : '',
      transferReference.trim() ? `مرجع التحويل: ${transferReference.trim()}` : '',
      settlementNotes.trim()
    ].filter(Boolean).join(' | ');

    return {
      id: settlementId,
      settlementNumber,
      merchantId: selectedMerchantId,
      merchantName: mName,
      date: new Date().toISOString(),
      ordersCount: settlementCalculation.ordersCount,
      totalCollected: settlementCalculation.totalCollected,
      totalMerchantGoodsCost: settlementCalculation.totalMerchantGoodsCost,
      totalServiceFees: settlementCalculation.totalServiceFees,
      totalShippingCosts: settlementCalculation.totalShippingCosts,
      totalMarketingCosts: settlementCalculation.totalMarketingCosts,
      totalReturnFees: settlementCalculation.totalReturnFees,
      totalCollectionFees: settlementCalculation.totalCollectionFees,
      netPayoutToMerchant: settlementCalculation.netPayoutToMerchant,
      status,
      paidFromTreasuryAccountId: status === 'paid' && payoutChannel !== 'ledger_only' ? selectedTreasuryAccountId || undefined : undefined,
      paidFromTreasuryAccountName: status === 'paid' && payoutChannel !== 'ledger_only'
        ? treasuryAccount?.name || channelLabels[payoutChannel] || undefined
        : channelLabels[payoutChannel] || undefined,
      notes: fullNotes,
      performedBy: currentUser?.fullName || currentUser?.email || 'النظام',
      attachments: settlementAttachments.length > 0 ? settlementAttachments : undefined,
      totalShippingDiscountDifference: settlementCalculation.totalShippingDiscountDifference,
      totalCarrierAdditionalFees: settlementCalculation.totalCarrierAdditionalFees,
      totalReturnLosses: settlementCalculation.totalReturnLosses,
      totalOperatorEarnings: settlementCalculation.totalOperatorEarnings,
      orderSnapshots: settlementCalculation.orderSnapshots
    };
  };

  // Execute Settlement
  const handleExecuteSettlement = async (saveAsStatus: 'paid' | 'approved' | 'draft' = 'paid') => {
    if (!selectedMerchantId) {
      await inAppAlert('يرجى اختيار العميل / صاحب البضاعة أولاً من القائمة.', { title: 'بيانات ناقصة', type: 'warning' });
      return;
    }
    if (selectedOrderIds.length === 0 || settlementCalculation.ordersCount === 0) {
      await inAppAlert('يرجى تحديد أوردر واحد على الأقل من جدول الأوردرات الجاهزة للتسوية.', { title: 'لا توجد أوردرات محددة', type: 'warning' });
      return;
    }

    // MULTI-MERCHANT BATCH SETTLEMENT
    if (selectedMerchantId === 'all') {
      if (saveAsStatus === 'paid') {
        await inAppAlert('الصرف النقدي المجمّع لأكثر من وكيل غير متاح بأمان. اعتمد المستحقات أولًا، ثم افتح كل وكيل على حدة واختر حساب الخزينة للصرف.', { title: 'الصرف يتطلب وكيلًا واحدًا', type: 'warning' });
        return;
      }
      const ordersToProcess = eligibleOrders.filter(o => selectedOrderIds.includes(o.id));
      const merchantGroups = new Map<string, { merchantId: string; merchantName: string; orders: Order[] }>();

      ordersToProcess.forEach(o => {
        for (const [mId, lines] of getMerchantOrderGroups(o)) {
          const groupKey = `${mId}:${o.id}`;
          const mName = String(lines.find(line => line.merchantName)?.merchantName || o.merchantName || mId);
          if (!merchantGroups.has(groupKey)) merchantGroups.set(groupKey, { merchantId: mId, merchantName: mName, orders: [] });
          merchantGroups.get(groupKey)!.orders.push(o);
        }
      });

      if (merchantGroups.size === 0) {
        await inAppAlert('لا توجد أصناف مرتبطة بمعرّف وكيل صريح ضمن الاختيار. راجع ملكية المنتجات أولاً.', { title: 'الوكيل غير محدد', type: 'warning' });
        return;
      }
      const missingMerchantAccounts = [...new Set([...merchantGroups.values()].map(group => group.merchantId))]
        .filter(id => !(settings.suppliers || []).some(supplier => supplier.id === id));
      if (missingMerchantAccounts.length) {
        await inAppAlert(`أنشئ حسابات الوكلاء التالية أولًا قبل الاعتماد: ${missingMerchantAccounts.join('، ')}`, { title: 'حسابات وكلاء غير مسجلة', type: 'warning' });
        return;
      }

      const confirmed = await inAppConfirm(
        `هل ترغب في اعتماد (${merchantGroups.size}) تسوية مستقلة لكل زوج وكيل/أوردر من أصل (${ordersToProcess.length}) أوردر؟`,
        {
          title: 'تأكيد التسوية المجمعة لكافة الموكلين',
          confirmText: 'نعم، اعتماد وتسوية الجميع',
          cancelText: 'تراجع',
          type: 'info'
        }
      );
      if (!confirmed) return;

      const now = new Date().toISOString();
      const generatedSettlements: MerchantSettlement[] = [];
      const updatedOrderIdsMap = new Map<string, string>();
      const supplierBalanceAdditions = new Map<string, number>();
      const newLedgerTxs: MerchantTransaction[] = [];

      let groupIndex = 0;
      for (const group of merchantGroups.values()) {
        groupIndex++;
        const sId = `SETT-${Date.now()}-${groupIndex}`;
        const sNum = `ST-${String((settings.merchantSettlements || []).length + groupIndex).padStart(5, '0')}`;

        let totalCollected = 0;
        let totalGoodsCost = 0;
        let totalServiceFees = 0;
        let totalShippingCosts = 0;
        let netPayout = 0;

        const snapshots: MerchantSettlementOrderSnapshot[] = group.orders.map(o => {
          const calc = computeOrderFinancials(o, group.merchantId);
          totalCollected += calc.orderRevenue;
          totalGoodsCost += calc.goodsCost;
          totalServiceFees += calc.serviceFee;
          totalShippingCosts += calc.shippingAndFees;
          netPayout += calc.orderPayout;

          return {
            orderId: o.id,
            orderNumber: o.orderNumber || o.id,
            date: o.date,
            customerName: o.customerName || 'عميل',
            status: o.status,
            shippingCompany: o.shippingCompany,
            accountingMode: calc.effectiveMode,
            mode: calc.effectiveMode,
            sharePercent: calc.effectiveSharePercent,
            goodsCost: calc.goodsCost,
            merchantGoodsCost: calc.isDelivered ? calc.goodsCost : 0,
            shippingFee: calc.shippingBreakdown.baseShippingFee,
            officialShippingFee: calc.shippingBreakdown.officialShippingFee,
            customerPaidShipping: calc.shippingBreakdown.customerPaidShipping,
            shippingDiscountDifference: calc.shippingBreakdown.shippingDiscountDifference,
            insuranceFee: calc.shippingBreakdown.insuranceFee,
            vatFee: calc.shippingBreakdown.vatFee,
            inspectionFee: calc.shippingBreakdown.inspectionFee,
            codFee: calc.shippingBreakdown.codFee,
            collectionFee: calc.codFee,
            carrierAdditionalFees: calc.shippingBreakdown.carrierAdditionalFees,
            totalShippingAndCarrierFees: calc.shippingAndFees,
            serviceFee: calc.serviceFee,
            marketingFee: calc.marketingCost,
            marketingCost: calc.marketingCost,
            returnFee: calc.returnFee,
            returnLoss: calc.returnLoss,
            collectedRevenue: calc.orderRevenue,
            collectedAmount: calc.orderRevenue,
            netPayoutToMerchant: calc.orderPayout,
            netMerchantAmount: calc.orderPayout,
            operatorEarnings: calc.operatorOrderEarning
          };
        });

        const settleRecord: MerchantSettlement = {
          id: sId,
          settlementNumber: sNum,
          merchantId: group.merchantId,
          merchantName: group.merchantName,
          date: now,
          ordersCount: group.orders.length,
          totalCollected,
          totalMerchantGoodsCost: totalGoodsCost,
          totalServiceFees,
          totalShippingCosts,
          totalMarketingCosts: 0,
          totalReturnFees: 0,
          totalCollectionFees: 0,
          netPayoutToMerchant: Math.round(netPayout * 100) / 100,
          status: saveAsStatus,
          notes: `تسوية مجمعة (${group.orders.length} أوردر) - طريقة الصرف: ${payoutChannel === 'ledger_only' ? 'تسوية دفترية' : payoutChannel}`,
          performedBy: currentUser?.fullName || 'الإدارة',
          orderSnapshots: snapshots
        };

        const perOrderRows = splitSettlementByOrder(settleRecord, activeStoreId);
        generatedSettlements.push(...perOrderRows);
        perOrderRows.forEach(row => {
          if (row.orderId) updatedOrderIdsMap.set(`${row.orderId}:${row.merchantId}`, row.id);
        });

        const shouldCreditWallet = saveAsStatus === 'approved';
        if (shouldCreditWallet) {
          supplierBalanceAdditions.set(group.merchantId, (supplierBalanceAdditions.get(group.merchantId) || 0) + settleRecord.netPayoutToMerchant);

          newLedgerTxs.push({
            id: `mtx-${Date.now()}-${groupIndex}`,
            merchantId: group.merchantId,
            merchantName: group.merchantName,
            date: now,
            type: 'order_delivered',
            amount: settleRecord.netPayoutToMerchant,
            balanceAfter: 0,
            notes: `كشف تسوية أوردرات رقم ${sNum} - (${group.orders.length} أوردر)`,
            referenceId: sId,
            performedBy: currentUser?.fullName || 'الإدارة'
          });
        }
      }

      if (saveAsStatus !== 'draft') {
        const settledNowIso = new Date().toISOString();
        setOrders(currentOrders => currentOrders.map(o => {
          const refsForOrder = [...updatedOrderIdsMap.entries()]
            .filter(([key]) => key.startsWith(`${o.id}:`))
            .map(([key, settlementId]) => ({ merchantId: key.slice(o.id.length + 1), settlementId }));
          if (refsForOrder.length === 0) return o;
          const ov = orderOverrides[o.id];
          const holdDays = ov?.customHoldingDays !== undefined ? ov.customHoldingDays : o.customHoldingDays;
          return {
            ...o,
            settlementStatus: 'settled' as const,
            settlementId: refsForOrder[0].settlementId,
            merchantSettlementRefs: [...(o.merchantSettlementRefs || []).filter(ref => !refsForOrder.some(next => next.merchantId === ref.merchantId)), ...refsForOrder],
            settledAt: o.settledAt || settledNowIso,
            payoutStatus: (holdDays === 0 ? 'ready' : 'holding') as 'ready' | 'holding',
            ...(ov?.customHoldingDays !== undefined ? { customHoldingDays: ov.customHoldingDays } : {}),
            ...(ov?.goodsCost !== undefined ? { merchantItemCost: ov.goodsCost } : {}),
            ...(ov?.marketingFee !== undefined ? { marketingFeePerOrder: ov.marketingFee } : {}),
            ...(ov?.serviceFee !== undefined ? { serviceFeePerOrder: ov.serviceFee } : {}),
            ...(ov?.shippingFee !== undefined ? { shippingFee: ov.shippingFee, isManualShippingOverride: true } : {}),
            ...(ov?.insuranceFee !== undefined ? { insuranceFee: ov.insuranceFee } : {}),
            ...(ov?.vatFee !== undefined ? { vatValue: ov.vatFee } : {}),
            ...(ov?.inspectionFee !== undefined ? { inspectionFee: ov.inspectionFee } : {}),
            ...(ov?.mode !== undefined ? { merchantSettlementMode: ov.mode } : {}),
            ...(ov?.sharePercent !== undefined ? { merchantProfitSharePercent: ov.sharePercent } : {})
          };
        }));
      }

      updateSettings(currentSettings => {
        const updateList = (list: any[]) => (list || []).map(s => {
          const addition = supplierBalanceAdditions.get(s.id);
          if (addition !== undefined) {
            const currentBal = Number(s.balance) || 0;
            const newBal = Number((currentBal + addition).toFixed(2));
            const txsForThisSupplier = newLedgerTxs
              .filter(tx => tx.merchantId === s.id)
              .map(tx => ({ ...tx, balanceAfter: newBal }));

            return {
              ...s,
              balance: newBal,
              merchantSettlementOpeningBalance: typeof s.merchantSettlementOpeningBalance === 'number' ? s.merchantSettlementOpeningBalance : calculateMerchantOpeningBalance(currentBal, currentSettings.merchantSettlements || [], [...new Map([...(currentSettings.merchantTransactions || []), ...(s.transactions || [])].map(tx => [tx.id, tx])).values()], s.id),
              merchantSettlementOpeningAt: s.merchantSettlementOpeningAt || now,
              transactions: [...txsForThisSupplier, ...(s.transactions || [])]
            };
          }
          return s;
        });

        const updatedSuppliers = updateList(currentSettings.suppliers || []);
        const updatedPartners = updateList(currentSettings.partners || []);

        return {
          ...currentSettings,
          suppliers: updatedSuppliers,
          partners: updatedPartners,
          merchantTransactions: [...newLedgerTxs, ...(currentSettings.merchantTransactions || [])],
          merchantSettlements: upsertOrderSettlements(currentSettings.merchantSettlements || [], generatedSettlements)
        };
      });

      setSelectedMerchantId('');
      setSelectedOrderIds([]);
      setOrderOverrides({});
      setActiveTab('settlements');

      inAppToast(`تم إصدار ${generatedSettlements.length} سجل تسوية مستقل لأوردرات الوكلاء المختارة.`, 'success', 5000);
      return;
    }

    if (saveAsStatus !== 'draft' && !(settings.suppliers || []).some(s => s.id === selectedMerchantId)) {
      await inAppAlert('لا يمكن ترحيل التسوية قبل ربط الموكل بحساب مورد مسجل. احفظها كمسودة أو أنشئ الحساب أولاً.', { title: 'حساب الموكل غير مكتمل', type: 'warning' });
      return;
    }

    if (saveAsStatus !== 'draft' && settlementCalculation.netPayoutToMerchant < 0) {
      const proceedNegative = await inAppConfirm(
        `صافي المستحق للموكل بالسالب (${settlementCalculation.netPayoutToMerchant.toLocaleString()} ج.م) نتيجة مصروفات الشحن أو المرتجعات. هل ترغب في اعتماد الكشف كمديونية دفترية على الموكل بدون صرف نقدي من الخزينة؟`,
        {
          title: 'صافي مستحق سالب (مديونية على الموكل)',
          confirmText: 'نعم، اعتماد كمديونية دفترية',
          cancelText: 'مراجعة الحسابات',
          type: 'warning'
        }
      );
      if (!proceedNegative) return;
    }

    if (saveAsStatus === 'paid' && payoutChannel !== 'ledger_only' && settlementCalculation.netPayoutToMerchant > 0 && !selectedTreasuryAccountId) {
      await inAppAlert('اختر حساب الخزينة للصرف الفعلي، أو استخدم «اعتماد المستحق دون صرف» لحفظ المبلغ كمستحق.', { title: 'حساب الخزينة مطلوب', type: 'warning' });
      return;
    }
    const actualSettlementStatus = saveAsStatus === 'paid' && payoutChannel === 'ledger_only'
      ? 'approved'
      : saveAsStatus === 'paid' && settlementCalculation.netPayoutToMerchant <= 0
      ? 'approved'
      : saveAsStatus;
    const newSettlement = buildDraftSettlement(actualSettlementStatus);
    const perOrderSettlements = splitSettlementByOrder(newSettlement, activeStoreId);
    if (perOrderSettlements.length !== selectedOrderIds.length) {
      await inAppAlert('تعذر تكوين تسوية مستقلة لبعض الأوردرات. تأكد من وجود معرّف وكيل على كل صنف تابع له.', { title: 'مراجعة ملكية الأصناف', type: 'warning' });
      return;
    }
    const settlementIdByOrder = new Map(perOrderSettlements.map(row => [String(row.orderId), row.id]));

    if (saveAsStatus === 'paid' && payoutChannel !== 'ledger_only' && selectedTreasuryAccountId && settlementCalculation.netPayoutToMerchant > 0) {
      const account = treasury?.accounts.find(acc => acc.id === selectedTreasuryAccountId);
      if (!account || !setTreasury) {
        await inAppAlert('حساب الخزينة المحدد غير متاح. حدّث الصفحة أو اختر حساباً آخر.', { title: 'حساب خزينة غير صالح', type: 'warning' });
        return;
      }
      if (account.balance < settlementCalculation.netPayoutToMerchant) {
        await inAppAlert('رصيد حساب الخزينة غير كافٍ لصرف صافي التسوية.', { title: 'رصيد غير كافٍ', type: 'warning' });
        return;
      }
    }

    // Deduct Net Payout from Treasury Account if selected and status is paid and netPayout > 0
    if (saveAsStatus === 'paid' && payoutChannel !== 'ledger_only' && selectedTreasuryAccountId && settlementCalculation.netPayoutToMerchant > 0 && setTreasury && treasury) {
      const newTx = {
        id: `tx-${Date.now()}`,
        date: new Date().toISOString(),
        amount: settlementCalculation.netPayoutToMerchant,
        type: 'withdrawal' as const,
        description: `تسوية حساب الموكل/صاحب البضاعة: ${newSettlement.merchantName} (كشف ${newSettlement.settlementNumber})`,
        fromAccountId: selectedTreasuryAccountId,
        operatorName: currentUser?.fullName || 'النظام',
        reference: newSettlement.settlementNumber,
        attachments: settlementAttachments
      };

      setTreasury(currentTreasury => currentTreasury ? ({
        ...currentTreasury,
        accounts: currentTreasury.accounts.map(acc => acc.id === selectedTreasuryAccountId
          ? { ...acc, balance: acc.balance - settlementCalculation.netPayoutToMerchant }
          : acc),
        transactions: [newTx, ...(currentTreasury.transactions || [])]
      }) : currentTreasury);
    }

    if (saveAsStatus !== 'draft') {
      const settledNowIso = new Date().toISOString();
      // Drafts save a calculation only; they must not lock orders or persist overrides.
      setOrders(currentOrders => currentOrders.map(o => {
        if (!selectedOrderIds.includes(o.id)) return o;
        const ov = orderOverrides[o.id];
        const holdDays = ov?.customHoldingDays !== undefined ? ov.customHoldingDays : o.customHoldingDays;
        const isImmediatePaid = saveAsStatus === 'paid' && payoutChannel !== 'ledger_only' && Boolean(selectedTreasuryAccountId) && settlementCalculation.netPayoutToMerchant > 0;
        const orderSettlementId = settlementIdByOrder.get(o.id);
        return {
          ...o,
          settlementStatus: 'settled' as const,
          settlementId: orderSettlementId || newSettlement.id,
          merchantSettlementRefs: [...(o.merchantSettlementRefs || []).filter(ref => ref.merchantId !== selectedMerchantId), { merchantId: selectedMerchantId, settlementId: orderSettlementId || newSettlement.id }],
          settledAt: o.settledAt || settledNowIso,
          payoutStatus: (isImmediatePaid ? 'paid' : holdDays === 0 ? 'ready' : 'holding') as 'paid' | 'ready' | 'holding',
          ...(isImmediatePaid ? { paidOutAt: settledNowIso, payoutReferenceId: newSettlement.settlementNumber } : {}),
          ...(ov?.customHoldingDays !== undefined ? { customHoldingDays: ov.customHoldingDays } : {}),
          ...(ov?.goodsCost !== undefined ? { merchantItemCost: ov.goodsCost } : {}),
          ...(ov?.marketingFee !== undefined ? { marketingFeePerOrder: ov.marketingFee } : {}),
          ...(ov?.serviceFee !== undefined ? { serviceFeePerOrder: ov.serviceFee } : {}),
          ...(ov?.shippingFee !== undefined ? { shippingFee: ov.shippingFee, isManualShippingOverride: true } : {}),
          ...(ov?.insuranceFee !== undefined ? { insuranceFee: ov.insuranceFee } : {}),
          ...(ov?.vatFee !== undefined ? { vatValue: ov.vatFee } : {}),
          ...(ov?.inspectionFee !== undefined ? { inspectionFee: ov.inspectionFee } : {}),
          ...(ov?.mode !== undefined ? { merchantSettlementMode: ov.mode } : {}),
          ...(ov?.sharePercent !== undefined ? { merchantProfitSharePercent: ov.sharePercent } : {})
        };
      }));
    }

    // Update Settlement, Merchant Balance and Ledger
    updateSettings(currentSettings => {
      const shouldCreditWallet = actualSettlementStatus === 'approved';
      const now = new Date().toISOString();
      let runningBal = Number(
        (currentSettings.suppliers || []).find(s => s.id === selectedMerchantId)?.balance ||
        (currentSettings.partners || []).find(p => p.id === selectedMerchantId)?.balance ||
        0
      );
      const walletTxs: MerchantTransaction[] = perOrderSettlements.flatMap(row => {
        const net = Number(row.netPayoutToMerchant) || 0;
        if (actualSettlementStatus === 'paid' && net > 0) {
          const creditBal = Number((runningBal + net).toFixed(2));
          const payoutBal = Number((creditBal - net).toFixed(2));
          runningBal = payoutBal;
          return [
            { id: `mtx-${row.id}-credit`, merchantId: row.merchantId, merchantName: row.merchantName, date: now, type: 'order_delivered', amount: net, balanceAfter: creditBal, notes: `اعتماد مستحق ${row.settlementNumber}`, referenceId: row.id, performedBy: currentUser?.fullName || 'الإدارة' },
            { id: `mtx-${row.id}-payment`, merchantId: row.merchantId, merchantName: row.merchantName, date: now, type: 'withdrawal', amount: -net, balanceAfter: payoutBal, notes: `صرف فعلي ${row.settlementNumber}`, referenceId: row.id, performedBy: currentUser?.fullName || 'الإدارة' }
          ];
        }
        if (shouldCreditWallet) {
          runningBal = Number((runningBal + net).toFixed(2));
          return [{ id: `mtx-${row.id}-credit`, merchantId: row.merchantId, merchantName: row.merchantName, date: now, type: 'order_delivered', amount: net, balanceAfter: runningBal, notes: `اعتماد مستحق ${row.settlementNumber}`, referenceId: row.id, performedBy: currentUser?.fullName || 'الإدارة' }];
        }
        return [];
      });
      const walletDelta = walletTxs.reduce((sum, tx) => sum + tx.amount, 0);

      const updateMerchantList = (list: any[]) => (list || []).map(s => {
        if (s.id !== selectedMerchantId) return s;
        const currentBalance = Number(s.balance) || 0;
        const newBal = Number((currentBalance + walletDelta).toFixed(2));
        return {
          ...s,
          balance: newBal,
          merchantSettlementOpeningBalance: typeof s.merchantSettlementOpeningBalance === 'number' ? s.merchantSettlementOpeningBalance : calculateMerchantOpeningBalance(currentBalance, currentSettings.merchantSettlements || [], [...new Map([...(currentSettings.merchantTransactions || []), ...(s.transactions || [])].map(tx => [tx.id, tx])).values()], s.id),
          merchantSettlementOpeningAt: s.merchantSettlementOpeningAt || now,
          transactions: [...walletTxs.filter(tx => tx.merchantId === s.id), ...(s.transactions || [])]
        };
      });

      const updatedSuppliers = walletTxs.length ? updateMerchantList(currentSettings.suppliers || []) : (currentSettings.suppliers || []);
      const updatedPartners = walletTxs.length ? updateMerchantList(currentSettings.partners || []) : (currentSettings.partners || []);

      return {
        ...currentSettings,
        suppliers: updatedSuppliers,
        partners: updatedPartners,
        ...(walletTxs.length ? { merchantTransactions: [...walletTxs, ...(currentSettings.merchantTransactions || [])] } : {}),
        merchantSettlements: upsertOrderSettlements(currentSettings.merchantSettlements || [], perOrderSettlements)
      };
    });

    // Reset Form
    setSelectedMerchantId('');
    setSelectedOrderIds([]);
    setSettlementNotes('');
    setTransferReference('');
    setSettlementAttachments([]);
    setLumpSumAdSpend(0);
    setOrderOverrides({});
    setActiveTab('settlements');

    inAppToast(
      `تم إصدار كشف التسوية المالية رقم (${newSettlement.settlementNumber}) للموكل ${newSettlement.merchantName} بنجاح!`,
      'success',
      4500
    );
  };

  // Reverse / Delete Settlement
  const handleSettlementLifecycle = async (settlement: MerchantSettlement, nextStatus: 'approved' | 'paid' | 'cancelled') => {
    if (settlement.status === 'paid' || settlement.status === 'cancelled') {
      inAppToast('هذه التسوية نهائية ولا يمكن تغيير حالتها.', 'warning');
      return;
    }
    if (nextStatus === 'paid' && settlement.status !== 'approved') {
      inAppToast('اعتمد التسوية أولًا قبل تسجيل الصرف.', 'warning');
      return;
    }
    if (nextStatus === 'approved' && settlement.calculationComplete === false) {
      await inAppAlert('هذا سجل أولي أنشئ مع الطلب ولم تُحتسب عليه الرسوم والاستقطاعات بعد. افتح «حساب التسوية» أولًا ثم اعتمد الكشف الناتج.', { title: 'التسوية غير محسوبة', type: 'warning' });
      return;
    }
    const amount = Math.max(0, Number(settlement.netPayoutToMerchant) || 0);
    const selectedAccount = treasury?.accounts.find(account => account.id === selectedTreasuryAccountId);
    if (nextStatus === 'paid') {
      if (!selectedAccount || !setTreasury || payoutChannel === 'ledger_only') {
        await inAppAlert('اختر حساب خزينة وطريقة صرف فعلية من شاشة إنشاء التسوية قبل تسجيل الدفع.', { title: 'بيانات الصرف ناقصة', type: 'warning' });
        return;
      }
      if (amount <= 0 || selectedAccount.balance < amount) {
        await inAppAlert('صافي التسوية يجب أن يكون موجبًا ورصيد الخزينة كافيًا للصرف.', { title: 'لا يمكن الصرف', type: 'warning' });
        return;
      }
    }
    const actionLabel = nextStatus === 'approved' ? 'اعتماد المستحق' : nextStatus === 'paid' ? 'تسجيل صرف المستحق' : 'إلغاء التسوية';
    const confirmed = await inAppConfirm(`${actionLabel} بقيمة ${amount.toLocaleString()} ج.م للتسوية ${settlement.settlementNumber}؟`, {
      title: actionLabel,
      confirmText: 'تأكيد',
      cancelText: 'رجوع',
      type: nextStatus === 'cancelled' ? 'danger' : 'info'
    });
    if (!confirmed) return;

    const now = new Date().toISOString();
    const supplier = (settings.suppliers || []).find(item => item.id === settlement.merchantId);
    const currentBalance = Number(supplier?.balance) || 0;
    let walletTx: MerchantTransaction | undefined;
    if (nextStatus === 'approved' && !((settings.merchantTransactions || []).some(tx => tx.referenceId === settlement.id && tx.type === 'order_delivered'))) {
      walletTx = { id: `mtx-${settlement.id}-approved`, merchantId: settlement.merchantId, merchantName: settlement.merchantName, date: now, type: 'order_delivered', amount, balanceAfter: currentBalance + amount, notes: `اعتماد مستحق التسوية ${settlement.settlementNumber}`, referenceId: settlement.id, performedBy: currentUser?.fullName || 'الإدارة' };
    } else if (nextStatus === 'paid') {
      walletTx = { id: `mtx-${settlement.id}-paid`, merchantId: settlement.merchantId, merchantName: settlement.merchantName, date: now, type: 'withdrawal', amount: -amount, balanceAfter: currentBalance - amount, notes: `صرف التسوية ${settlement.settlementNumber}`, referenceId: settlement.id, transferReference: transferReference || undefined, performedBy: currentUser?.fullName || 'الإدارة' };
    } else if (nextStatus === 'cancelled' && settlement.status === 'approved' && (settings.merchantTransactions || []).some(tx => tx.referenceId === settlement.id && tx.type === 'order_delivered')) {
      walletTx = { id: `mtx-${settlement.id}-cancelled`, merchantId: settlement.merchantId, merchantName: settlement.merchantName, date: now, type: 'adjustment', amount: -amount, balanceAfter: currentBalance - amount, notes: `قيد عكسي لإلغاء التسوية ${settlement.settlementNumber}`, referenceId: `${settlement.id}:cancel`, performedBy: currentUser?.fullName || 'الإدارة' };
    }

    if (nextStatus === 'paid' && selectedAccount && setTreasury) {
      const tx = { id: `tx-${settlement.id}-paid`, date: now, amount, type: 'withdrawal' as const, description: `صرف تسوية الوكيل ${settlement.merchantName} (${settlement.settlementNumber})`, fromAccountId: selectedAccount.id, operatorName: currentUser?.fullName || 'الإدارة', reference: settlement.settlementNumber };
      setTreasury(current => current ? ({ ...current, accounts: current.accounts.map(account => account.id === selectedAccount.id ? { ...account, balance: account.balance - amount } : account), transactions: [tx, ...(current.transactions || [])] }) : current);
    }

    updateSettings(current => {
      const updatedSettlement = transitionMerchantSettlement(settlement, nextStatus, {
        ...(nextStatus === 'paid' ? { paidFromTreasuryAccountId: selectedAccount?.id, paidFromTreasuryAccountName: selectedAccount?.name } : {}),
        notes: [settlement.notes, `${actionLabel} بتاريخ ${now}`].filter(Boolean).join('\n')
      });
      const updateList = (list: any[]) => (list || []).map(item => {
        if (item.id !== settlement.merchantId) return item;
        const beforeBalance = Number(item.balance) || 0;
        const balanceDelta = walletTx?.amount || 0;
        const newBal = Number((beforeBalance + balanceDelta).toFixed(2));
        if (walletTx) walletTx.balanceAfter = newBal;
        const openingBalance = typeof item.merchantSettlementOpeningBalance === 'number'
          ? item.merchantSettlementOpeningBalance
          : calculateMerchantOpeningBalance(beforeBalance, current.merchantSettlements || [], [...new Map([...(current.merchantTransactions || []), ...(item.transactions || [])].map(tx => [tx.id, tx])).values()], item.id);
        return {
          ...item,
          balance: newBal,
          merchantSettlementOpeningBalance: openingBalance,
          merchantSettlementOpeningAt: item.merchantSettlementOpeningAt || now,
          ...(walletTx ? { transactions: [walletTx, ...(item.transactions || [])] } : {})
        };
      });

      const updatedSuppliers = updateList(current.suppliers || []);
      const updatedPartners = updateList(current.partners || []);

      return {
        ...current,
        suppliers: updatedSuppliers,
        partners: updatedPartners,
        ...(walletTx ? { merchantTransactions: [walletTx, ...(current.merchantTransactions || [])] } : {}),
        merchantSettlements: (current.merchantSettlements || []).map(row => row.id === settlement.id ? updatedSettlement : row)
      };
    });

    if (settlement.orderId) {
      setOrders(currentOrders => currentOrders.map(order => {
        if (order.id !== settlement.orderId) return order;
        const refs = (order.merchantSettlementRefs || []).filter(ref => !(ref.merchantId === settlement.merchantId && ref.settlementId === settlement.id));
        if (nextStatus !== 'cancelled') refs.push({ merchantId: settlement.merchantId, settlementId: settlement.id });
        return {
          ...order,
          merchantSettlementRefs: refs,
          settlementId: refs[0]?.settlementId,
          settlementStatus: refs.length ? 'settled' : 'unsettled',
          ...(nextStatus === 'paid' ? { payoutStatus: 'paid' as const, paidOutAt: now, payoutReferenceId: settlement.settlementNumber } : {})
        };
      }));
    }
    inAppToast(nextStatus === 'approved' ? 'تم اعتماد المستحق دون صرف نقدي.' : nextStatus === 'paid' ? 'تم تسجيل الصرف وتحديث الخزينة ومحفظة الوكيل.' : 'أُلغيت التسوية بقيد محفوظ، دون حذف السجل.', 'success');
  };

  const handleReverseSettlement = async (settlement: MerchantSettlement) => {
    const linkedOrderIds = new Set((settlement.orderSnapshots || []).map(s => s.orderId));
    const hasPaidOrders = (orders || []).some(o =>
      (o.settlementId === settlement.id || (!o.settlementId && linkedOrderIds.has(o.id))) &&
      (o.payoutStatus === 'paid' || !!o.paidOutAt)
    );
    if (settlement.status === 'paid' || hasPaidOrders) {
      inAppToast('لا يمكن عكس كشف معتمد أو تم صرفه من هذه الشاشة. سجّل الاسترداد بقيد محاسبي موثق؛ لم تتغير أي بيانات.', 'error', 6000);
      return;
    }
    if (settlement.reversedAt) {
      inAppToast('تم عكس هذا الكشف مسبقاً.', 'warning');
      return;
    }
    const confirmed = await inAppConfirm(
      `هل أنت متأكد من إلغاء كشف التسوية (${settlement.settlementNumber}) للموكل "${settlement.merchantName}"؟ سيتم إعادة فتح (${settlement.ordersCount}) أوردر لتصبح قابلة للتسوية مرة أخرى${settlement.paidFromTreasuryAccountId ? ' (لن يُسترد رصيد الخزينة تلقائياً)' : ''}.`,
      {
        title: 'عكس كشف غير مصروف',
        confirmText: 'تأكيد عكس الكشف',
        cancelText: 'تراجع',
        type: 'danger'
      }
    );
    if (!confirmed) return;
    const reversedAt = new Date().toISOString();

    // 1. Re-open settled orders
    const snapshotIds = new Set((settlement.orderSnapshots || []).map(s => s.orderId));
    setOrders(currentOrders => currentOrders.map(o => {
      if (o.settlementId === settlement.id || (!o.settlementId && o.settlementStatus === 'settled' && snapshotIds.has(o.id))) {
        return {
          ...o,
          settlementStatus: 'unsettled' as const,
          settlementId: undefined
        };
      }
      return o;
    }));

    // Paid settlements are blocked above. Only reverse the merchant ledger for an unpaid/draft settlement.
    updateSettings(currentSettings => {
      const updateList = (list: any[]) => (list || []).map(s => {
        if (s.id !== settlement.merchantId) return s;
        const originalTx = (s.transactions || []).find(tx => tx.referenceId === settlement.id && tx.type === 'order_delivered');
        if (!originalTx) return s;
        const currentBalance = Number(s.balance) || 0;
        const newBal = Number((currentBalance - originalTx.amount).toFixed(2));
        const reversalTx: MerchantTransaction = {
          id: `mtx-reversal-${settlement.id}`,
          merchantId: s.id,
          merchantName: s.name,
          date: reversedAt,
          type: 'adjustment',
          amount: -originalTx.amount,
          balanceAfter: newBal,
          notes: `قيد عكس كشف التسوية ${settlement.settlementNumber}`,
          referenceId: `${settlement.id}:reversal`,
          performedBy: currentUser?.fullName || 'الإدارة'
        };
        return {
          ...s,
          balance: newBal,
          transactions: [reversalTx, ...(s.transactions || [])]
        };
      });

      const updatedSuppliers = updateList(currentSettings.suppliers || []);
      const updatedPartners = updateList(currentSettings.partners || []);
      const reversalTx = updatedSuppliers.find(s => s.id === settlement.merchantId)?.transactions?.find(tx => tx.referenceId === `${settlement.id}:reversal`);

      return {
        ...currentSettings,
        suppliers: updatedSuppliers,
        partners: updatedPartners,
        ...(reversalTx ? { merchantTransactions: [reversalTx, ...(currentSettings.merchantTransactions || [])] } : {}),
        merchantSettlements: (currentSettings.merchantSettlements || []).map(s => s.id === settlement.id
          ? { ...s, reversedAt, reversedBy: currentUser?.fullName || currentUser?.email || 'الإدارة', reversalNote: 'تم عكس الكشف بقيد محاسبي مقابل' }
          : s)
      };
    });

    if (viewingSettlement?.id === settlement.id) {
      setViewingSettlement(null);
    }

    inAppToast(`تم إلغاء الكشف ${settlement.settlementNumber} وإعادة فتح الأوردرات بنجاح.`, 'info');
  };

  // Share via WhatsApp
  const handleShareWhatsApp = (settlement: MerchantSettlement) => {
    const partner = merchantsList.find(m => m.id === settlement.merchantId);
    const partnerNetProfitOrLoss = Math.round((settlement.netPayoutToMerchant - settlement.totalMerchantGoodsCost) * 100) / 100;
    const roiPercent = settlement.totalMerchantGoodsCost > 0
      ? Math.round((partnerNetProfitOrLoss / settlement.totalMerchantGoodsCost) * 1000) / 10
      : 0;
    const profitStatusLine =
      partnerNetProfitOrLoss > 0
        ? `✅ *صافي ربحك فوق تكلفة البضاعة: +${partnerNetProfitOrLoss.toLocaleString()} ج.م (عائد +${roiPercent}%)*`
        : partnerNetProfitOrLoss < 0
        ? `⚠️ *صافي خسارة من تكلفة البضاعة: ${partnerNetProfitOrLoss.toLocaleString()} ج.م (${roiPercent}%)*`
        : `⚖️ *نقطة تعادل (استرداد تكلفة البضاعة بالكامل بدون ربح أو خسارة)*`;

    const lines = [
      `*كشف تسوية مالية - ${settings.storeName || 'AbdoMedia Prime'}*`,
      `رقم الكشف: *${settlement.settlementNumber}*`,
      `التاريخ: ${new Date(settlement.date).toLocaleDateString('ar-EG')}`,
      `الموكل / صاحب البضاعة: *${settlement.merchantName}*`,
      `────────────────────`,
      `• إجمالي الأوردرات بالكشف: ${settlement.ordersCount} أوردر`,
      `• إجمالي التحصيل الفعلي: ${settlement.totalCollected.toLocaleString()} ج.م`,
      `• رأس مال البضاعة المباعة: ${settlement.totalMerchantGoodsCost.toLocaleString()} ج.م`,
      `• مصاريف الشحن الأساسية: -${settlement.totalShippingCosts.toLocaleString()} ج.م`,
      ...(settlement.totalCarrierAdditionalFees ? [`• رسوم إضافية وتأمين وضريبة: -${settlement.totalCarrierAdditionalFees.toLocaleString()} ج.م`] : []),
      `• عمولات التحصيل (COD): -${settlement.totalCollectionFees.toLocaleString()} ج.م`,
      `• عمولة التشغيل والخدمة: -${settlement.totalServiceFees.toLocaleString()} ج.م`,
      ...(settlement.totalMarketingCosts > 0 ? [`• مصاريف الإعلانات والتسويق: -${settlement.totalMarketingCosts.toLocaleString()} ج.م`] : []),
      ...(settlement.totalReturnFees > 0 ? [`• رسوم شحن المرتجعات: -${settlement.totalReturnFees.toLocaleString()} ج.م`] : []),
      `────────────────────`,
      `*بيان الربح والخسارة للموكل:*`,
      `• استرداد رأس مال البضاعة: ${settlement.totalMerchantGoodsCost.toLocaleString()} ج.م`,
      profitStatusLine,
      `────────────────────`,
      `*💰 الصافي النهائي المستحق للتحويل لك: ${settlement.netPayoutToMerchant.toLocaleString()} ج.م*`,
      `_(شامل رأس مال البضاعة ${partnerNetProfitOrLoss >= 0 ? '+ صافي الربح' : '- صافي الخسارة'})_`,
      settlement.notes ? `ملاحظات: ${settlement.notes}` : ''
    ].filter(Boolean).join('\n');

    const cleanPhone = (partner?.phone || '').replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
    const encoded = encodeURIComponent(lines);
    const waUrl = intlPhone
      ? `https://wa.me/${intlPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    const a = document.createElement('a');
    a.href = waUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Print Official Brand Statement
  const handlePrintSettlement = (settlement: MerchantSettlement) => {
    const snapshots = settlement.orderSnapshots || [];
    const partnerNetProfitOrLoss = Math.round((settlement.netPayoutToMerchant - settlement.totalMerchantGoodsCost) * 100) / 100;
    const roiPercent = settlement.totalMerchantGoodsCost > 0
      ? Math.round((partnerNetProfitOrLoss / settlement.totalMerchantGoodsCost) * 1000) / 10
      : 0;
    const isProfitable = partnerNetProfitOrLoss >= 0;

    const rowsHtml = snapshots.length > 0
      ? snapshots.map((s, idx) => `
          <tr>
            <td class="num">${idx + 1}</td>
            <td class="num">#${s.orderNumber || s.orderId.slice(0, 8)}</td>
            <td>${s.customerName || '-'}</td>
            <td>${s.status.replace(/_/g, ' ')}</td>
            <td class="num">${s.collectedAmount.toLocaleString()}</td>
            <td class="num" style="color:#008060;">${s.merchantGoodsCost.toLocaleString()}</td>
            <td class="num" style="color:#b45309;">-${(s.officialShippingFee || 0).toLocaleString()}</td>
            <td class="num" style="color:#b45309;">-${(s.carrierAdditionalFees + s.collectionFee).toLocaleString()}</td>
            <td class="num" style="color:#e11d48;">-${(s.serviceFee + s.marketingCost + s.returnLoss).toLocaleString()}</td>
            <td class="num" style="font-weight:900;color:#0f172a;">${s.netMerchantAmount.toLocaleString()} ج.م</td>
          </tr>
        `).join('')
      : '';

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كشف تسوية موكل - ${settlement.settlementNumber}</title>
        <style>
          body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; padding: 28px; color: #0f172a; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #008060; padding-bottom: 16px; margin-bottom: 22px; }
          .title { font-size: 22px; font-weight: 900; color: #008060; margin: 0; }
          .brand-badge { background: #0d1b2a; color: #10b981; padding: 8px 16px; border-radius: 10px; font-weight: 800; font-size: 13px; }
          .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; background: #f8fafc; padding: 16px; border-radius: 14px; margin-bottom: 20px; border: 1px solid #cbd5e1; font-size: 13px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 9px 10px; text-align: right; }
          th { background-color: #0d1b2a; color: #ffffff; font-weight: bold; text-align: center; }
          .sub-th th { background-color: #008060; color: #ffffff; }
          .num { font-family: monospace, sans-serif; text-align: center; font-weight: bold; }
          .pnl-card { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 18px; padding: 14px; border-radius: 14px; background: ${isProfitable ? '#f0fdf4' : '#fff1f2'}; border: 2px solid ${isProfitable ? '#10b981' : '#f43f5e'}; }
          .pnl-item { text-align: center; padding: 8px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; }
          .pnl-label { font-size: 11px; color: #64748b; font-weight: 700; margin-bottom: 4px; }
          .pnl-val { font-size: 15px; font-weight: 900; font-family: monospace, sans-serif; }
          .summary-box { display: flex; justify-content: space-between; align-items: center; background: #0d1b2a; color: #ffffff; border: 2px solid #008060; padding: 18px 22px; border-radius: 14px; margin-top: 18px; font-weight: 900; font-size: 17px; }
          .section-label { font-size: 14px; font-weight: 900; margin-top: 22px; margin-bottom: 6px; color: #0d1b2a; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">كشف تسوية ومحاسبة صاحب البضاعة / الموكل</h1>
            <div style="font-size: 12px; color: #475569; margin-top: 6px; font-weight: 700;">
              رقم الكشف: ${settlement.settlementNumber} · تاريخ الإصدار: ${new Date(settlement.date).toLocaleDateString('ar-EG')} · الحالة: ${settlement.status === 'draft' ? 'مسودة مراجعة' : 'معتمد ومدفوع'}
            </div>
          </div>
          <div class="brand-badge">${settings.storeName || 'AbdoMedia Prime'}</div>
        </div>

        <div class="info-grid">
          <div>اسم الموكل: <span style="color:#008060;">${settlement.merchantName}</span></div>
          <div>إجمالي الأوردرات المسواة: <span class="num">${settlement.ordersCount} أوردر</span></div>
          <div>وعاء الصرف / التسوية: <span>${settlement.paidFromTreasuryAccountName || 'تسوية دفترية'}</span></div>
        </div>

        <div class="section-label">أولاً: الملخص المالي الإجمالي للكشف</div>
        <table>
          <thead>
            <tr>
              <th>إجمالي التحصيل الفعلي</th>
              <th>رأس مال البضاعة المباعة</th>
              <th>عمولة الخدمة والتشغيل</th>
              <th>مصاريف الشحن الأساسية</th>
              <th>رسوم إضافية وتأمين وضريبة</th>
              <th>عمولات التحصيل COD</th>
              <th>رسوم المرتجعات</th>
              <th>مصاريف الإعلانات</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="num">${settlement.totalCollected.toLocaleString()} ج.م</td>
              <td class="num" style="color: #008060;">${settlement.totalMerchantGoodsCost.toLocaleString()} ج.م</td>
              <td class="num" style="color: #e11d48;">-${settlement.totalServiceFees.toLocaleString()} ج.م</td>
              <td class="num" style="color: #b45309;">-${settlement.totalShippingCosts.toLocaleString()} ج.م</td>
              <td class="num" style="color: #b45309;">-${(settlement.totalCarrierAdditionalFees || 0).toLocaleString()} ج.م</td>
              <td class="num" style="color: #b45309;">-${settlement.totalCollectionFees.toLocaleString()} ج.م</td>
              <td class="num" style="color: #e11d48;">-${settlement.totalReturnFees.toLocaleString()} ج.م</td>
              <td class="num" style="color: #4f46e5;">-${settlement.totalMarketingCosts.toLocaleString()} ج.م</td>
            </tr>
          </tbody>
        </table>

        <div class="section-label">ثانياً: موقف الربح والخسارة الفعلي لصاحب البضاعة</div>
        <div class="pnl-card">
          <div class="pnl-item">
            <div class="pnl-label">1. استرداد رأس مال البضاعة المباعة</div>
            <div class="pnl-val" style="color:#0f172a;">${settlement.totalMerchantGoodsCost.toLocaleString()} ج.م</div>
          </div>
          <div class="pnl-item">
            <div class="pnl-label">2. ${isProfitable ? 'صافي ربح الموكل فوق رأس المال' : 'صافي خسارة الموكل من رأس المال'}</div>
            <div class="pnl-val" style="color:${isProfitable ? '#008060' : '#e11d48'};">
              ${partnerNetProfitOrLoss > 0 ? '+' : ''}${partnerNetProfitOrLoss.toLocaleString()} ج.م (${roiPercent > 0 ? '+' : ''}${roiPercent}%)
            </div>
          </div>
          <div class="pnl-item">
            <div class="pnl-label">3. إجمالي الصافي المستحق (رأس المال ${isProfitable ? '+ الربح' : '- الخسارة'})</div>
            <div class="pnl-val" style="color:#008060;">${settlement.netPayoutToMerchant.toLocaleString()} ج.م</div>
          </div>
        </div>

        ${rowsHtml ? `
          <div class="section-label">ثالثاً: بيان تفصيلي بالأوردرات المشمولة في الكشف (${snapshots.length} أوردر)</div>
          <table>
            <thead class="sub-th">
              <tr>
                <th>#</th>
                <th>رقم الطلب</th>
                <th>العميل</th>
                <th>الحالة</th>
                <th>المحصل</th>
                <th>تكلفة البضاعة</th>
                <th>الشحن</th>
                <th>رسوم إضافية وCOD</th>
                <th>العمولة والإعلانات</th>
                <th>صافي الموكل</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        ` : ''}

        ${settlement.notes ? `<div style="margin-top: 14px; font-size: 12px; color: #334155;"><strong>ملاحظات التسوية:</strong> ${settlement.notes}</div>` : ''}

        <div class="summary-box">
          <div>
            <div>الصافي النهائي المستحق للتحويل لصاحب البضاعة:</div>
            <div style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 3px;">
              المعادلة: رأس مال البضاعة (${settlement.totalMerchantGoodsCost.toLocaleString()} ج.م) ${isProfitable ? `+ صافي الربح (${partnerNetProfitOrLoss.toLocaleString()} ج.م)` : `- صافي الخسارة (${Math.abs(partnerNetProfitOrLoss).toLocaleString()} ج.م)`}
            </div>
          </div>
          <span class="num" style="color: #10b981; font-size: 22px;">${settlement.netPayoutToMerchant.toLocaleString()} ج.م</span>
        </div>
      </body>
      </html>
    `;
    printHTMLDirectly(html);
  };
  
  // Export Single Settlement to Excel
  const handleExportSettlementToExcel = (settlement: MerchantSettlement) => {
    const settlementOrders = orders.filter(o => o.settlementId === settlement.id);
    const partnerNetProfitOrLoss = Math.round((settlement.netPayoutToMerchant - settlement.totalMerchantGoodsCost) * 100) / 100;
    const data = settlement.orderSnapshots?.length
      ? settlement.orderSnapshots.map(snapshot => ({
        'رقم الطلب': snapshot.orderNumber || snapshot.orderId,
        'التاريخ': new Date(snapshot.date).toLocaleDateString('ar-EG'),
        'العميل': snapshot.customerName || '',
        'الحالة': snapshot.status,
        'المحصل': snapshot.collectedAmount,
        'مستحقات البضاعة': snapshot.merchantGoodsCost,
        'الشحن المدفوع من العميل': snapshot.customerPaidShipping,
        'السعر الرسمي للشحن': snapshot.officialShippingFee,
        'فرق خصم الشحن': snapshot.shippingDiscountDifference,
        'رسوم شركة الشحن الإضافية': snapshot.carrierAdditionalFees,
        'رسوم التأمين': snapshot.insuranceFee ?? 0,
        'رسوم المعاينة': snapshot.inspectionFee ?? 0,
        'ضريبة القيمة المضافة': snapshot.vatFee ?? 0,
        'عمولة التحصيل COD': snapshot.collectionFee,
        'مصاريف الإعلانات': snapshot.marketingCost,
        'عمولة التشغيل': snapshot.serviceFee,
        'خسارة المرتجع': snapshot.returnLoss,
        'الصافي للموكل': snapshot.netMerchantAmount
      }))
      : settlementOrders.map(o => ({
        'رقم الطلب': o.orderNumber || o.id,
        'التاريخ': new Date(o.date).toLocaleDateString('ar-EG'),
        'العميل': o.customerName,
        'الحالة': o.status,
        'إجمالي الأوردر': o.totalPrice || 0,
        'مستحقات البضاعة': o.merchantItemCost || (o.items || []).reduce((s, i) => s + ((i.cost || 0) * (i.quantity || 1)), 0),
        'عمولة الخدمة': o.serviceFeePerOrder || 0,
        'مصاريف الشحن': o.shippingFee || 0,
        'مصاريف إعلانات': o.marketingFeePerOrder || 0,
        'صافي التحصيل': (o.totalPrice || 0) - (o.shippingFee || 0)
      }));
    
    const summary = [
      {},
      { 'رقم الطلب': 'ملخص الكشف المالي' },
      { 'رقم الطلب': 'رقم الكشف', 'التاريخ': settlement.settlementNumber },
      { 'رقم الطلب': 'اسم الموكل', 'التاريخ': settlement.merchantName },
      { 'رقم الطلب': 'إجمالي التحصيل', 'التاريخ': settlement.totalCollected },
      { 'رقم الطلب': 'رأس مال البضاعة المباعة (المسترد)', 'التاريخ': settlement.totalMerchantGoodsCost },
      { 'رقم الطلب': 'صافي ربح / خسارة الموكل فوق رأس المال', 'التاريخ': partnerNetProfitOrLoss },
      { 'رقم الطلب': 'نتيجة الكشف للموكل', 'التاريخ': partnerNetProfitOrLoss > 0 ? 'ربح صافي' : partnerNetProfitOrLoss < 0 ? 'خسارة' : 'تعادل' },
      { 'رقم الطلب': 'إجمالي عمولة الخدمة', 'التاريخ': settlement.totalServiceFees },
      { 'رقم الطلب': 'إجمالي مصاريف الشحن', 'التاريخ': settlement.totalShippingCosts },
      { 'رقم الطلب': 'عمولات التحصيل COD', 'التاريخ': settlement.totalCollectionFees },
      { 'رقم الطلب': 'فرق خصم الشحن', 'التاريخ': settlement.totalShippingDiscountDifference || 0 },
      { 'رقم الطلب': 'رسوم شركة الشحن الإضافية', 'التاريخ': settlement.totalCarrierAdditionalFees || 0 },
      { 'رقم الطلب': 'إجمالي مصاريف الإعلانات', 'التاريخ': settlement.totalMarketingCosts },
      { 'رقم الطلب': 'إجمالي رسوم المرتجعات', 'التاريخ': settlement.totalReturnFees },
      { 'رقم الطلب': 'إجمالي خسائر المرتجع والفشل', 'التاريخ': settlement.totalReturnLosses || 0 },
      { 'رقم الطلب': 'عمولتي كمقدم خدمة', 'التاريخ': settlement.totalOperatorEarnings ?? settlement.totalServiceFees },
      { 'رقم الطلب': 'الصافي النهائي المحول للموكل', 'التاريخ': settlement.netPayoutToMerchant }
    ];

    const ws = XLSX.utils.json_to_sheet([...data, ...summary]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "تفاصيل التسوية");
    XLSX.writeFile(wb, `تسوية_${settlement.settlementNumber}_${settlement.merchantName}.xlsx`);
    inAppToast(`تم تصدير ملف الإكسيل للكشف ${settlement.settlementNumber} بنجاح.`, 'success');
  };

  // Filtered History Settlements
  const filteredSettlements = useMemo(() => {
    const now = new Date();
    return (settings.merchantSettlements || []).filter(st => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        st.settlementNumber.toLowerCase().includes(q) ||
        st.merchantName.toLowerCase().includes(q) ||
        (st.notes || '').toLowerCase().includes(q);
      const matchMerchant = !historyMerchantFilter || st.merchantId === historyMerchantFilter;
      const matchStatus = historyStatusFilter === 'all' || (!st.reversedAt && st.status === historyStatusFilter);

      let matchDate = true;
      if (historyDateFilter !== 'all') {
        const stDate = new Date(st.date);
        const diffDays = (now.getTime() - stDate.getTime()) / (1000 * 3600 * 24);
        if (historyDateFilter === 'today') matchDate = stDate.toDateString() === now.toDateString();
        else if (historyDateFilter === 'week') matchDate = diffDays <= 7;
        else if (historyDateFilter === 'month') matchDate = diffDays <= 30;
      }

      return matchSearch && matchMerchant && matchStatus && matchDate;
    });
  }, [settings.merchantSettlements, searchQuery, historyMerchantFilter, historyStatusFilter, historyDateFilter]);

  // Export All Filtered Settlements Summary to Excel
  const handleExportAllHistoryExcel = () => {
    if (filteredSettlements.length === 0) {
      inAppToast('لا توجد كشوف تسوية مطابقة للفلتر لتصديرها.', 'warning');
      return;
    }
    const rows = filteredSettlements.map((st, idx) => ({
      '#': idx + 1,
      'رقم الكشف': st.settlementNumber,
      'التاريخ': new Date(st.date).toLocaleDateString('ar-EG'),
      'الموكل': st.merchantName,
      'عدد الأوردرات': st.ordersCount,
      'إجمالي التحصيل (ج.م)': st.totalCollected,
      'مستحقات البضاعة (ج.م)': st.totalMerchantGoodsCost,
      'فروق ورسوم الشحن (ج.م)': st.totalShippingCosts,
      'عمولات COD (ج.م)': st.totalCollectionFees,
      'مصاريف الإعلانات (ج.م)': st.totalMarketingCosts,
      'رسوم المرتجعات (ج.م)': st.totalReturnFees,
      'عمولة الوكالة والتشغيل (ج.م)': st.totalOperatorEarnings ?? st.totalServiceFees,
      'الصافي المحول للموكل (ج.م)': st.netPayoutToMerchant,
      'وعاء الصرف': st.paidFromTreasuryAccountName || 'تسوية دفترية',
      'الحالة': st.reversedAt ? 'معكوس' : st.status === 'draft' ? 'مسودة' : 'مدفوع',
      'ملاحظات': st.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل تسويات الموكلين');
    XLSX.writeFile(wb, `سجل_كشوف_تسوية_الموكلين_${new Date().toISOString().slice(0, 10)}.xlsx`);
    inAppToast('تم تصدير سجل كشوف التسوية بالكامل إلى Excel.', 'success');
  };

  // Selected Treasury Account Live Balance Preview
  const selectedTreasuryAccount = useMemo(() => {
    if (!selectedTreasuryAccountId) return null;
    return (treasury?.accounts || []).find(a => a.id === selectedTreasuryAccountId) || null;
  }, [treasury?.accounts, selectedTreasuryAccountId]);

  return (
    <div className="space-y-6 sm:space-y-7 text-right font-sans animate-in fade-in duration-300" dir="rtl">
      
      {/* ======================================================== */}
      {/* 1. EMBEDDED TOOLBAR VS STANDALONE HERO BANNER            */}
      {/* ======================================================== */}
      {embedded ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
            <button
              onClick={() => setActiveTab('settlements')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'settlements' 
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={15} />
              <span>سجل الكشوفات</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                ({settings.merchantSettlements?.length || 0})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'create' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Plus size={15} />
              <span>إصدار كشف تسوية جديد</span>
              {executiveMetrics.totalUnsettledOrders > 0 && (
                <span className="font-mono tabular-nums text-[11px] bg-white/20 px-1.5 py-0.2 rounded text-white">
                  {executiveMetrics.totalUnsettledOrders}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('transparency')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'transparency' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Sparkles size={15} />
              <span>تقرير الشفافية</span>
            </button>

            <button
              onClick={() => setActiveTab('merchants')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'merchants' 
                  ? 'bg-slate-800 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <User size={15} />
              <span>إدارة الموكلين</span>
              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                ({merchantsList.length})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('requests')}
              className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
                activeTab === 'requests' 
                  ? 'bg-amber-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Coins size={15} />
              <span>جدول التحويلات وسياسات الصرف</span>
              {pendingMerchantRequestsCount > 0 && (
                <span className="font-mono tabular-nums text-[11px] bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black animate-pulse">
                  {pendingMerchantRequestsCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {activeTab === 'settlements' && (settings.merchantSettlements?.length || 0) > 0 && (
              <button
                onClick={handleExportAllHistoryExcel}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span>تصدير Excel</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d1b2a] to-emerald-950 text-white p-6 sm:p-8 rounded-[2.25rem] shadow-2xl border border-slate-800/90">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-emerald-300/90">
                <span>منظومة الإدارة المالية</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-slate-300">تسوية حسابات أصحاب البضائع والموكلين</span>
                <span aria-hidden="true" className="text-slate-500">·</span>
                <span className="text-emerald-400 font-mono tabular-nums">{merchantsList.length} موكل مسجل</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    كشوف تسوية أصحاب البضائع والمنتجات
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl leading-relaxed">
                    محاسبة دقيقة وشفافة للموكلين بنظامي العمولة الثابتة ومشاركة الأرباح، مع خصم آلي لفروق الشحن والـ COD والمرتجعات.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-slate-950/50 p-1.5 rounded-2xl border border-white/10 self-start lg:self-center">
              <Link
                to={`/store/${activeStoreId}/agency-hub`}
                className="px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500 hover:text-slate-950"
              >
                <Building2 size={15} />
                <span>مركز تحكم الوكالة 🏢</span>
              </Link>

              <button
                onClick={() => setActiveTab('settlements')}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'settlements' 
                    ? 'bg-white text-slate-900 shadow-lg' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <FileText size={15} />
                <span>سجل الكشوف</span>
                <span className={`font-mono text-[11px] ${activeTab === 'settlements' ? 'text-emerald-700' : 'text-slate-400'}`}>
                  ({settings.merchantSettlements?.length || 0})
                </span>
              </button>

              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'create' 
                    ? 'bg-[#008060] text-white shadow-lg shadow-emerald-900/50' 
                    : 'text-emerald-300 hover:bg-emerald-500/15'
                }`}
              >
                <Plus size={15} />
                <span>إصدار كشف تسوية جديد</span>
                {executiveMetrics.totalUnsettledOrders > 0 && (
                  <span className="font-mono text-[11px] bg-white/20 px-1.5 py-0.2 rounded-md text-white">
                    {executiveMetrics.totalUnsettledOrders}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('merchants')}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'merchants' 
                    ? 'bg-white text-slate-900 shadow-lg' 
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <User size={15} />
                <span>إدارة الموكلين</span>
              </button>

              <button
                onClick={() => setActiveTab('requests')}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'requests' 
                    ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-900/50' 
                    : 'text-amber-300 hover:bg-amber-500/15'
                }`}
              >
                <Coins size={15} />
                <span>جدول التحويلات وسياسات الصرف</span>
                {pendingMerchantRequestsCount > 0 && (
                  <span className="font-mono text-[11px] bg-slate-950 text-amber-300 px-1.5 py-0.2 rounded-md">
                    {pendingMerchantRequestsCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('transparency')}
                className={`px-4 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'transparency' 
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-900/50' 
                    : 'text-indigo-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Sparkles size={15} />
                <span>تقرير الشفافية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner for Pending Merchant Withdrawal Requests (Standalone only) */}
      {!embedded && pendingMerchantRequestsCount > 0 && activeTab !== 'requests' && (
        <div 
          onClick={() => setActiveTab('requests')}
          className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 text-amber-200 flex items-center justify-between gap-3 cursor-pointer hover:bg-amber-500/25 transition-all shadow-lg"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Coins size={20} />
            </div>
            <div>
              <h4 className="font-black text-sm text-amber-300">يوجد {pendingMerchantRequestsCount} طلب سحب مستحقات معلق وارد من الموكلين!</h4>
              <p className="text-xs text-amber-200/80">انقر هنا لمراجعة طلبات سحب المستحقات واعتمادها أو رفضها مباشرة لحسابات الموكلين.</p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs whitespace-nowrap shadow-sm">
            عرض الطلبات ({pendingMerchantRequestsCount}) ←
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. EXECUTIVE FINANCIAL KPI STRIP                         */}
      {/* ======================================================== */}
      {activeTab !== 'transparency' && activeTab !== 'portal' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Paid Out to Partners */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                إجمالي الصافي المحول للموكلين
              </span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums">
                {executiveMetrics.totalNetPaid.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/50">
              <Wallet size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>عبر {executiveMetrics.settlementsCount} كشف تسوية معتمد</span>
            <span className="text-emerald-600 dark:text-emerald-400">محول ومغلق</span>
          </div>
        </div>

        {/* KPI 2: Unsettled Eligible Orders */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                أوردرات جاهزة للتسوية الآن
              </span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono tabular-nums">
                {executiveMetrics.totalUnsettledOrders}{' '}
                <span className="text-xs font-bold text-slate-400">أوردر</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
              <PackageCheck size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>تحصيل معلق: {executiveMetrics.totalPendingCollectionValue.toLocaleString()} ج.م</span>
            {executiveMetrics.totalUnsettledOrders > 0 && activeTab !== 'create' && (
              <button
                onClick={() => setActiveTab('create')}
                className="text-emerald-600 dark:text-emerald-400 hover:underline font-black cursor-pointer"
              >
                تسوية الآن ←
              </button>
            )}
          </div>
        </div>

        {/* KPI 3: Operator / Agency Earnings */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                عوائد وعمولات التشغيل المحققة
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                {executiveMetrics.totalOperatorRevenue.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/50">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>صافي عمولات الخدمة وحصص الشراكة</span>
            <span className="text-teal-600 dark:text-teal-400">إيراد محقق</span>
          </div>
        </div>

        {/* KPI 4: Recovered Deductions (Shipping, Returns, Ads) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block">
                مستردات الشحن والإعلانات والمرتجع
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                {executiveMetrics.totalRecoveredDeductions.toLocaleString()}{' '}
                <span className="text-xs font-bold text-slate-400">ج.م</span>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/50">
              <Calculator size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-bold text-slate-500">
            <span>مستقطعة من كشوف الموكلين</span>
            <span>حماية السيولة</span>
          </div>
        </div>
      </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: SETTLEMENTS HISTORY LEDGER                        */}
      {/* ======================================================== */}
      {activeTab === 'settlements' && (
        <div className="space-y-4">
          {/* Filter & Search Command Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="بحث برقم الكشف (ST-00001)، اسم الموكل، أو ملاحظات التحويل..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600 transition-all"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Range Segmented Control */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'today', label: 'اليوم' },
                  { id: 'week', label: 'أسبوع' },
                  { id: 'month', label: 'شهر' }
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => setHistoryDateFilter(item.id as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      historyDateFilter === item.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <select
                value={historyMerchantFilter}
                onChange={e => setHistoryMerchantFilter(e.target.value)}
                className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600 transition-all"
              >
                <option value="">جميع الموكلين ({merchantsList.length})</option>
                {merchantsList.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>

              <button
                onClick={handleExportAllHistoryExcel}
                className="px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 hover:text-white text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
                title="تصدير السجل المفلتر بالكامل إلى Excel"
              >
                <FileSpreadsheet size={15} />
                <span>تصدير السجل Excel</span>
              </button>
            </div>
          </div>

          {filteredSettlements.length === 0 ? (
            <div className="p-14 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <Building2 size={28} />
              </div>
              <div className="text-base font-black text-slate-800 dark:text-slate-100">
                لا توجد كشوف تسوية مطابقة للبحث الحالي
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يمكنك البدء بإصدار كشف تسوية جديد لأي موكل وتحديد الأوردرات المسلمة والمرتجعة لحساب الصافي تلقائياً.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-5 py-2.5 bg-[#008060] hover:bg-[#006e52] text-white rounded-xl text-xs font-black inline-flex items-center gap-2 mt-2 cursor-pointer shadow-md"
              >
                <Plus size={15} />
                <span>إصدار كشف تسوية جديد</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
              {filteredSettlements.map(st => {
                const totalDeductions =
                  (st.totalServiceFees || 0) +
                  (st.totalShippingCosts || 0) +
                  (st.totalCollectionFees || 0) +
                  (st.totalMarketingCosts || 0) +
                  (st.totalReturnFees || 0);

                return (
                  <div
                    key={st.id}
                    className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-base">
                          {st.settlementNumber}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {st.merchantName}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-xs text-slate-500 font-mono">
                          {new Date(st.date).toLocaleDateString('ar-EG')}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span className={`text-xs font-black ${
                          st.reversedAt || st.status === 'cancelled' ? 'text-rose-600 dark:text-rose-400' : st.status === 'pending' || st.status === 'draft'
                            ? 'text-amber-600 dark:text-amber-400'
                            : st.status === 'approved' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {st.reversedAt ? 'تم عكس الكشف' : st.status === 'pending' || st.status === 'draft' ? 'بانتظار الاعتماد' : st.status === 'approved' ? 'معتمد — بانتظار الصرف' : st.status === 'cancelled' ? 'ملغي مع حفظ السجل' : 'مدفوع'}
                        </span>
                      </div>

                      {/* Unboxed clean financial metadata row */}
                      <div className="text-xs text-slate-600 dark:text-slate-400 font-bold flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>الأوردرات: <strong className="font-mono text-slate-900 dark:text-white">{st.ordersCount}</strong></span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span>التحصيل: <strong className="font-mono text-slate-900 dark:text-white">{st.totalCollected.toLocaleString()} ج.م</strong></span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span>مستحق البضاعة: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{st.totalMerchantGoodsCost.toLocaleString()} ج.م</strong></span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span>إجمالي الاستقطاعات: <strong className="font-mono text-rose-600 dark:text-rose-400">-{totalDeductions.toLocaleString()} ج.م</strong></span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span>عائد التشغيل: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{(st.totalOperatorEarnings ?? st.totalServiceFees).toLocaleString()} ج.م</strong></span>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                        <span>الوعاء: <strong className="text-slate-700 dark:text-slate-300">{st.paidFromTreasuryAccountName || 'تسوية دفترية'}</strong></span>
                      </div>

                      {st.notes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          ملاحظات: {st.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 self-end lg:self-center shrink-0">
                      <div className="text-left pl-3 border-l border-slate-200 dark:border-slate-800">
                        <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                          {st.netPayoutToMerchant.toLocaleString()}{' '}
                          <span className="text-xs text-slate-400 font-sans">ج.م</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold">الصافي المستحق للموكل</div>
                      </div>

                      <button
                        onClick={() => {
                          if (!st.merchantId) {
                            inAppToast('هذا الكشف التاريخي لا يحمل merchantId؛ لا يمكن إسناده تلقائيًا بالاسم.', 'warning');
                            return;
                          }
                          setTransparencyMerchantId(st.merchantId);
                          setActiveTab('transparency');
                        }}
                        className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-600 hover:text-white rounded-xl text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                        title="عرض كشف الشفافية وحركة البضاعة للموكل"
                      >
                        <Sparkles size={16} />
                      </button>

                      <button
                        onClick={() => setViewingSettlement(st)}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-900 hover:text-white dark:hover:bg-emerald-600 rounded-xl text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="فحص تفاصيل ولقطة الكشف"
                      >
                        <Eye size={16} />
                      </button>

                      <button
                        onClick={() => handleShareWhatsApp(st)}
                        className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-[#008060] hover:text-white rounded-xl text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer"
                        title="إرسال ملخص الكشف للموكل عبر واتساب"
                      >
                        <MessageSquare size={16} />
                      </button>

                      <button
                        onClick={() => handlePrintSettlement(st)}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-[#008060] hover:text-white rounded-xl text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="طباعة الكشف الرسمي"
                      >
                        <Printer size={16} />
                      </button>
                      
                      <button
                        onClick={() => handleExportSettlementToExcel(st)}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-xl text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        title="تصدير الكشف إلى Excel"
                      >
                        <Download size={16} />
                      </button>

                      {(st.status === 'pending' || st.status === 'draft') && st.calculationComplete === false && st.orderId && <button onClick={() => { setSelectedMerchantId(st.merchantId); setSelectedOrderIds([st.orderId!]); setActiveTab('create'); }} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-black text-slate-950" title="احتساب الرسوم والصافي لهذا الأوردر">احسب التسوية</button>}
                      {(st.status === 'pending' || st.status === 'draft') && st.calculationComplete !== false && <button onClick={() => handleSettlementLifecycle(st, 'approved')} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white" title="اعتماد المستحق دون صرف">اعتماد</button>}
                      {st.status === 'approved' && <button onClick={() => handleSettlementLifecycle(st, 'paid')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white" title="صرف من حساب الخزينة المحدد">صرف</button>}
                      {(st.status === 'pending' || st.status === 'draft' || st.status === 'approved') && <button onClick={() => handleSettlementLifecycle(st, 'cancelled')} className="rounded-lg bg-rose-50 px-2.5 py-2 text-xs font-black text-rose-600 dark:bg-rose-950/30" title="إلغاء بقيد محفوظ">إلغاء</button>}
                      {st.status === 'paid' && <button onClick={() => handleReverseSettlement(st)} disabled title="التسوية مدفوعة؛ يلزم قيد استرداد منفصل" className="p-2.5 rounded-xl text-slate-400 disabled:cursor-not-allowed"><RotateCcw size={16} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: CREATE NEW SETTLEMENT (3-STEP ENGINE)             */}
      {/* ======================================================== */}
      {activeTab === 'create' && (
        <div className="space-y-6">
          
          {/* STEP 1: Select Merchant & Accounting Rules */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-[#008060] text-white font-mono text-xs flex items-center justify-center">01</span>
                <span>تحديد الموكل / صاحب البضاعة ومعايير المحاسبة</span>
              </h3>
              <span className="text-xs font-bold text-slate-500">
                اختر الموكل واضبط قواعد احتساب العمولة والشحن والمرتجعات
              </span>
            </div>

            {/* Quick Partner Selector Strip for Partners with Unsettled Orders */}
            {partnersSummary.some(p => p.unsettledCount > 0) && (
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600 dark:text-slate-400">
                  وصول سريع للموكلين الذين لديهم أوردرات جاهزة للتسوية:
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => handleSelectMerchant('all')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                      selectedMerchantId === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:border-emerald-500'
                    }`}
                  >
                    <span>🌟 تسوية مجمعة لكافة الموكلين</span>
                    <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md ${
                      selectedMerchantId === 'all' ? 'bg-white/20 text-white' : 'bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                    }`}>
                      {orders.filter(isOrderEligibleForAnyMerchantSettlement).length} أوردر
                    </span>
                  </button>
                  {partnersSummary.filter(p => p.unsettledCount > 0).map(p => {
                    const isActive = selectedMerchantId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectMerchant(p.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                          isActive
                            ? 'bg-[#008060] text-white border-[#008060] shadow-md'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        <span>{p.name}</span>
                        <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md ${
                          isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {p.unsettledCount} أوردر
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Partner Select */}
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                  اختر العميل / صاحب البضاعة
                </label>
                <select
                  value={selectedMerchantId}
                  onChange={e => handleSelectMerchant(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="">-- اختر صاحب البضاعة من القائمة --</option>
                  <option value="all" className="font-black text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60">
                    🌟 تسوية مجمعة لكافة الموكلين ({orders.filter(isOrderEligibleForAnyMerchantSettlement).length} أوردر متاح)
                  </option>
                  {partnersSummary.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.phone ? `(${m.phone})` : ''} — [{m.unsettledCount} أوردر جاهز]
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Accounting Mode */}
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                  نظام المحاسبة المطبق على الكشف
                </label>
                <div className="flex gap-2">
                  <select
                    value={batchAccountingMode}
                    onChange={e => setBatchAccountingMode(e.target.value as any)}
                    className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="order_default">حسب إعداد كل أوردر (الافتراضي)</option>
                    <option value="fixed_fee">تعميم نظام العمولة الثابتة</option>
                    <option value="profit_share">تعميم نظام مشاركة الأرباح (%)</option>
                  </select>
                  {batchAccountingMode === 'profit_share' && (
                    <div className="relative w-24">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={batchProfitSharePercent}
                        onChange={e => setBatchProfitSharePercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-full p-3 pl-6 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl font-black text-xs text-center font-mono text-indigo-700 dark:text-indigo-300 outline-none"
                        title="نسبة حصة الموكل من صافي الربح %"
                      />
                      <span className="absolute left-2.5 top-3 text-xs font-black text-indigo-500">%</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Service Fee per Delivered Order */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                    عمولة الخدمة للطلب المسلم (ج.م)
                  </label>
                  <input
                    type="number"
                    value={flatServiceFee}
                    onChange={e => setFlatServiceFee(Number(e.target.value) || 0)}
                    placeholder="10"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs text-center font-mono outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                
                <button
                  type="button"
                  onClick={() => setChargeServiceFeeOnReturns(!chargeServiceFeeOnReturns)}
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    chargeServiceFeeOnReturns 
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${chargeServiceFeeOnReturns ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {chargeServiceFeeOnReturns && <Check size={10} className="text-white" strokeWidth={4} />}
                  </div>
                  <span className="text-[10px] font-black">احتساب العمولة حتى على المرتجعات</span>
                </button>
              </div>

              {/* Return Shipping Deduction */}
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                  خصم مصاريف شحن المرتجعات
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeductReturnsFee(!deductReturnsFee)}
                    className={`px-4 py-3 rounded-xl font-black text-xs flex-1 transition-all cursor-pointer ${
                      deductReturnsFee
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {deductReturnsFee ? 'تفعيل خصم المرتجع' : 'بدون خصم مرتجع'}
                  </button>
                  {deductReturnsFee && (
                    <input
                      type="number"
                      value={returnShippingFeeAmount}
                      onChange={e => setReturnShippingFeeAmount(Number(e.target.value) || 0)}
                      className="w-24 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs text-center font-mono outline-none focus:ring-2 focus:ring-emerald-600"
                      title="رسوم شحن المرتجع للأوردر الواحد"
                    />
                  )}
                </div>
              </div>

              {/* Per-Order Marketing Fee */}
              <div>
                <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1.5">
                  مصاريف التسويق لكل أوردر (ج.م)
                </label>
                <div className="relative">
                  <Speaker size={14} className="absolute left-3.5 top-3.5 text-amber-500" />
                  <input
                    type="number"
                    value={batchMarketingFee || ''}
                    onChange={e => setBatchMarketingFee(Number(e.target.value) || 0)}
                    placeholder="مثلاً 30 ج.م لكل أوردر..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-black text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Lump Sum Ad Spend */}
              <div>
                <label className="block text-xs font-black text-emerald-700 dark:text-emerald-400 mb-1.5">
                  إجمالي حملة إعلانات مجمعة للكشف (ج.م)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign size={14} className="absolute left-3.5 top-3.5 text-emerald-600" />
                    <input
                      type="number"
                      value={lumpSumAdSpend || ''}
                      onChange={e => setLumpSumAdSpend(Number(e.target.value) || 0)}
                      placeholder="صرف إعلانات مجمع..."
                      className="w-full pl-9 pr-3 py-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/70 rounded-xl font-black text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-600 text-emerald-800 dark:text-emerald-300"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLumpSumShared(!isLumpSumShared)}
                    className={`px-3.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                      isLumpSumShared 
                        ? 'bg-[#008060] border-[#008060] text-white' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {isLumpSumShared ? 'تقاسم' : 'خصم كامل'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* STEP 2: SELECT ORDERS TABLE (2. اختيار الأوردرات الجاهزة) */}
          {/* ======================================================== */}
          {selectedMerchantId && (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-[#008060] text-white font-mono text-xs flex items-center justify-center">02</span>
                    <span>2. اختيار الأوردرات الجاهزة للتسوية ({eligibleOrders.length} أوردر)</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    يمكنك تعديل تكلفة البضاعة أو مصاريف التسويق أو نظام المحاسبة لأي أوردر مباشرة من الجدول قبل الاعتماد.
                  </p>
                </div>

                {/* Quick Selection Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds(eligibleOrders.map(o => o.id))}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-black hover:bg-emerald-600 hover:text-white transition-colors cursor-pointer"
                  >
                    تحديد الكل ({eligibleOrders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds(eligibleOrders.filter(o => DELIVERED_STATUSES.includes(o.status)).map(o => o.id))}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    تحديد المسلم فقط ({eligibleOrders.filter(o => DELIVERED_STATUSES.includes(o.status)).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds(eligibleOrders.filter(o => RETURN_STATUSES.includes(o.status)).map(o => o.id))}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    تحديد المرتجع فقط ({eligibleOrders.filter(o => RETURN_STATUSES.includes(o.status)).length})
                  </button>
                  {selectedOrderIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrderIds([])}
                      className="px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-bold transition-colors cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>
              </div>

              {/* Filter & Search Bar inside Step 2 */}
              {eligibleOrders.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
                    {[
                      { id: 'all', label: `الكل (${eligibleOrders.length})` },
                      { id: 'delivered', label: `تم التوصيل والتحصيل (${eligibleOrders.filter(o => DELIVERED_STATUSES.includes(o.status)).length})` },
                      { id: 'returns', label: `مرتجعات وفشل (${eligibleOrders.filter(o => RETURN_STATUSES.includes(o.status)).length})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setOrderTableFilter(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          orderTableFilter === tab.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[220px]">
                    <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={orderTableSearch}
                      onChange={e => setOrderTableSearch(e.target.value)}
                      placeholder="فلترة برقم الطلب أو اسم العميل..."
                      className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              )}

              {displayedEligibleOrders.length === 0 ? (
                <div className="p-10 text-center text-slate-400 font-bold bg-slate-50 dark:bg-slate-800/30 rounded-2xl text-xs">
                  لا توجد أوردرات مطابقة للفلتر المحدد حالياً.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-right text-xs min-w-[980px]">
                    <thead className="bg-slate-900 text-white font-black">
                      <tr>
                        <th className="p-3.5 text-center w-12">تحديد</th>
                        <th className="p-3.5">الطلب والعميل</th>
                        <th className="p-3.5 text-center">الحالة</th>
                        <th className="p-3.5 text-center">نظام المحاسبة</th>
                        <th className="p-3.5 text-center">التحصيل (ج.م)</th>
                        <th className="p-3.5 text-center">تكلفة البضاعة (تعديل)</th>
                        <th className="p-3.5 text-center">فروق الشحن وCOD</th>
                        <th className="p-3.5 text-center">التسويق (تعديل)</th>
                        <th className="p-3.5 text-center">صافي الموكل</th>
                        <th className="p-3.5 text-center w-14">تفصيل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                      {displayedEligibleOrders.map(ord => {
                        const isSelected = selectedOrderIds.includes(ord.id);
                        const calc = computeOrderFinancials(ord);
                        const isExpanded = expandedOrderId === ord.id;

                        return (
                          <React.Fragment key={ord.id}>
                            <tr
                              className={`transition-colors ${
                                isSelected
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Checkbox */}
                              <td className="p-3 text-center" onClick={() => toggleOrderSelection(ord.id)}>
                                <button
                                  type="button"
                                  className={`w-5 h-5 rounded-md mx-auto flex items-center justify-center border transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#008060] border-[#008060] text-white'
                                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                                  }`}
                                >
                                  {isSelected && <Check size={12} />}
                                </button>
                              </td>

                              {/* Order Number & Customer */}
                              <td className="p-3" onClick={() => toggleOrderSelection(ord.id)}>
                                <div className="flex items-center gap-2 cursor-pointer">
                                  <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">
                                    #{ord.orderNumber || ord.id.slice(0, 8)}
                                  </span>
                                  <span className="text-slate-800 dark:text-slate-200 font-black">
                                    {ord.customerName}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                  <span>{new Date(ord.date).toLocaleDateString('ar-EG')} · {ord.shippingCompany || 'شحن افتراضي'}</span>
                                  {selectedMerchantId === 'all' && (
                                    <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md text-[10px] font-black border border-indigo-200 dark:border-indigo-800">
                                      💼 {ord.merchantName || 'موكل عام'}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="p-3 text-center">
                                <span className={`text-xs font-black ${
                                  calc.isDelivered
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {ord.status.replace(/_/g, ' ')}
                                </span>
                              </td>

                              {/* Interactive Accounting Mode Switcher */}
                              <td className="p-3 text-center">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextMode: 'fixed_fee' | 'profit_share' | 'wholesale' = 
                                        calc.effectiveMode === 'fixed_fee' ? 'profit_share' :
                                        calc.effectiveMode === 'profit_share' ? 'wholesale' : 'fixed_fee';
                                      updateOrderOverride(ord.id, { mode: nextMode });
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
                                      calc.effectiveMode === 'profit_share'
                                        ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                                        : calc.effectiveMode === 'wholesale'
                                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                        : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                    }`}
                                    title="اضغط للتبديل بين: عمولة ثابتة / مشاركة أرباح / سعر جملة"
                                  >
                                    {calc.effectiveMode === 'profit_share'
                                      ? `مشاركة (${calc.effectiveSharePercent}%)`
                                      : calc.effectiveMode === 'wholesale'
                                      ? 'سعر جملة'
                                      : `عمولة (${calc.serviceFee} ج)`}
                                  </button>
                                </div>
                              </td>

                              {/* Collected Revenue */}
                              <td className="p-3 text-center font-mono tabular-nums text-slate-900 dark:text-white">
                                {calc.isDelivered ? `${calc.orderRevenue.toLocaleString()} ج.م` : '0 ج.م'}
                              </td>

                              {/* Editable Goods Cost */}
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  value={calc.goodsCost}
                                  onChange={e => updateOrderOverride(ord.id, { goodsCost: Number(e.target.value) || 0 })}
                                  className="w-24 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-black text-emerald-700 dark:text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-600"
                                  title="تعديل تكلفة البضاعة لصاحبها"
                                />
                              </td>

                              {/* Shipping & COD Burden */}
                              <td className="p-3 text-center font-mono tabular-nums text-amber-600 dark:text-amber-400">
                                -{(calc.shippingAndFees + calc.returnFee).toLocaleString()} ج.م
                              </td>

                              {/* Editable Marketing Fee */}
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  value={calc.marketingCost}
                                  onChange={e => updateOrderOverride(ord.id, { marketingFee: Number(e.target.value) || 0 })}
                                  className="w-20 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                  title="مصاريف إعلانات وتسويق هذا الأوردر"
                                />
                              </td>

                              {/* Net Payout for Order */}
                              <td className="p-3 text-center font-mono tabular-nums">
                                <span className={`text-sm font-black ${
                                  calc.orderPayout >= 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                  {calc.orderPayout.toLocaleString()} ج.م
                                </span>
                              </td>

                              {/* Expand Formula Details */}
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isExpanded
                                        ? 'bg-[#008060] text-white'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                    }`}
                                    title="عرض تفصيل المعادلة المالية للأوردر"
                                  >
                                    <Info size={14} />
                                  </button>
                                  {calc.hasCustomOverride && (
                                    <button
                                      type="button"
                                      onClick={() => resetOrderOverride(ord.id)}
                                      className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 hover:bg-amber-100 cursor-pointer"
                                      title="استعادة القيم الافتراضية للأوردر"
                                    >
                                      <RotateCcw size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expandable Order Financial Formula & Customization Panel */}
                            {isExpanded && (
                              <tr className="bg-slate-100/80 dark:bg-slate-900/80 border-y-2 border-indigo-500/30">
                                <td colSpan={10} className="p-4 space-y-4">
                                  {/* Section 1: Detailed Interactive Fee Adjustment Inputs */}
                                  <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2.5">
                                      <div className="flex items-center gap-2">
                                        <SlidersHorizontal size={16} className="text-indigo-600 dark:text-indigo-400" />
                                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                                          تخصيص بنود ومصاريف الأوردر #{ord.orderNumber || ord.id.slice(0, 8)}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                          (يمكنك تعديل أي بند يدوياً وسيعاد حساب المستحق فوراً)
                                        </span>
                                      </div>
                                      {calc.hasCustomOverride && (
                                        <button
                                          type="button"
                                          onClick={() => resetOrderOverride(ord.id)}
                                          className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 hover:bg-amber-100 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <RotateCcw size={12} />
                                          <span>استعادة القيم الأصلية للطلب</span>
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                                      {/* مصاريف الشحن */}
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                                          مصاريف الشحن الأساسية
                                        </label>
                                        <input
                                          type="number"
                                          value={calc.shippingBreakdown.baseShippingFee}
                                          onChange={e => updateOrderOverride(ord.id, { shippingFee: Number(e.target.value) || 0 })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      {/* رسوم التأمين */}
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                                          رسوم التأمين
                                        </label>
                                        <input
                                          type="number"
                                          step="0.05"
                                          value={calc.shippingBreakdown.insuranceFee}
                                          onChange={e => updateOrderOverride(ord.id, { insuranceFee: Number(e.target.value) || 0 })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      {/* رسوم المعاينة */}
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                                          رسوم المعاينة والفتح
                                        </label>
                                        <input
                                          type="number"
                                          step="0.5"
                                          value={calc.shippingBreakdown.inspectionFee}
                                          onChange={e => updateOrderOverride(ord.id, { inspectionFee: Number(e.target.value) || 0 })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      {/* ضريبة القيمة المضافة */}
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                                          ضريبة الشحن (VAT)
                                        </label>
                                        <input
                                          type="number"
                                          step="0.05"
                                          value={calc.shippingBreakdown.vatFee}
                                          onChange={e => updateOrderOverride(ord.id, { vatFee: Number(e.target.value) || 0 })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      {/* عمولة COD */}
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                                          عمولة تحصيل COD
                                        </label>
                                        <input
                                          type="number"
                                          step="0.5"
                                          value={calc.codFee}
                                          onChange={e => updateOrderOverride(ord.id, { codFee: Number(e.target.value) || 0 })}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-amber-700 dark:text-amber-400 outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                      </div>

                                      {/* عمولة الخدمة */}
                                      <div className="space-y-1">
                                        <label className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">
                                          عمولة الخدمة / الأوردر
                                        </label>
                                        <input
                                          type="number"
                                          value={calc.serviceFee}
                                          onChange={e => updateOrderOverride(ord.id, { serviceFee: Number(e.target.value) || 0 })}
                                          disabled={calc.effectiveMode === 'profit_share'}
                                          className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                                        />
                                      </div>
                                    </div>

                                    {/* مدة تعليق رصيد هذا الأوردر بعد التسوية (تحكم مدير المتجر لكل أوردر) */}
                                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-black text-teal-700 dark:text-teal-400">
                                          مدة تعليق رصيد هذا الأوردر بعد التسوية قبل التحويل الأسبوعي:
                                        </span>
                                        <input
                                          type="number"
                                          min={0}
                                          max={60}
                                          value={orderOverrides[ord.id]?.customHoldingDays ?? ord.customHoldingDays ?? 7}
                                          onChange={e => updateOrderOverride(ord.id, { customHoldingDays: Math.max(0, Number(e.target.value) || 0) })}
                                          className="w-20 px-2.5 py-1 bg-teal-50 dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-lg text-center font-mono font-black text-teal-700 dark:text-teal-300 outline-none"
                                        />
                                        <span className="text-xs font-bold text-slate-400">يوم</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => updateOrderOverride(ord.id, { customHoldingDays: 0 })}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black cursor-pointer hover:bg-emerald-100"
                                      >
                                        إتاحة فورية للتحويل (0 يوم تعليق) ⚡
                                      </button>
                                    </div>

                                    {/* نسبة المشاركة إذا كان وضع الأرباح */}
                                    {calc.effectiveMode === 'profit_share' && (
                                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-3">
                                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                          نسبة الموكل من صافي أرباح الأوردر:
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            type="number"
                                            value={calc.effectiveSharePercent}
                                            onChange={e => updateOrderOverride(ord.id, { sharePercent: Number(e.target.value) || 0 })}
                                            className="w-20 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-mono font-bold text-indigo-600 outline-none"
                                          />
                                          <span className="text-xs text-slate-400">%</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Section 2: Mathematical Step-by-Step Breakdown Banner */}
                                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border border-slate-700 text-xs space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                                      <span className="text-emerald-400 flex items-center gap-1">
                                        <Calculator size={14} />
                                        <span>المعادلة الحسابية المعتمدة لهذا الأوردر ({calc.effectiveMode === 'profit_share' ? 'مشاركة أرباح' : calc.effectiveMode === 'wholesale' ? 'سعر جملة' : 'عمولة ثابتة'}):</span>
                                      </span>
                                      <span className="font-mono text-emerald-300 font-black">
                                        صافي المستحق = {calc.orderPayout.toLocaleString()} ج.م
                                      </span>
                                    </div>
                                    
                                    {calc.effectiveMode === 'profit_share' ? (
                                      <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                                        [ التحصيل ({calc.orderRevenue}) - تكلفة البضاعة ({calc.goodsCost}) - إجمالي الشحن والرسوم ({calc.shippingAndFees}) - التسويق ({calc.marketingCost}) ] = صافي ربح الأوردر ({Math.round((calc.orderRevenue - calc.goodsCost - calc.shippingAndFees - calc.marketingCost) * 100) / 100} ج.م) × {calc.effectiveSharePercent}% = ربح الموكل ({Math.round((calc.orderRevenue - calc.goodsCost - calc.shippingAndFees - calc.marketingCost) * (calc.effectiveSharePercent / 100) * 100) / 100}) + تكلفة البضاعة ({calc.goodsCost}) = <strong className="text-emerald-400 font-bold">{calc.orderPayout.toLocaleString()} ج.م</strong>
                                      </p>
                                    ) : calc.effectiveMode === 'wholesale' ? (
                                      <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                                        سعر الجملة ({calc.goodsCost}) - [ الشحن والرسوم ({calc.shippingAndFees}) + عمولة الخدمة ({calc.serviceFee}) + التسويق ({calc.marketingCost}) + المرتجع ({calc.returnFee}) ] = <strong className="text-emerald-400 font-bold">{calc.orderPayout.toLocaleString()} ج.م</strong>
                                      </p>
                                    ) : (
                                      <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
                                        إجمالي التحصيل ({calc.orderRevenue}) - [ الشحن الأساسي ({calc.shippingBreakdown.baseShippingFee}) + التأمين ({calc.shippingBreakdown.insuranceFee}) + المعاينة ({calc.shippingBreakdown.inspectionFee}) + الضريبة ({calc.shippingBreakdown.vatFee}) + COD ({calc.codFee}) + عمولة الخدمة ({calc.serviceFee}) + التسويق ({calc.marketingCost}) + المرتجع ({calc.returnFee}) ] = <strong className="text-emerald-400 font-bold">{calc.orderPayout.toLocaleString()} ج.م</strong>
                                      </p>
                                    )}

                                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-400 border-t border-white/10">
                                      <span>إجمالي استقطاعات شركة الشحن: <strong className="text-amber-300 font-mono">{calc.shippingBreakdown.total} ج.م</strong> (شحن {calc.shippingBreakdown.baseShippingFee} + إضافية وتأمين وضريبة {calc.shippingBreakdown.carrierAdditionalFees} + COD {calc.codFee})</span>
                                      <span>حصة المنصة / المشغل: <strong className="text-indigo-300 font-mono">{calc.operatorOrderEarning} ج.م</strong></span>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* STEP 3: BALANCE SUMMARY & PAYOUT (3. ملخص الموازنة)      */}
          {/* ======================================================== */}
          {selectedOrderIds.length > 0 && (
            <div className="relative overflow-hidden p-6 sm:p-8 rounded-[2.25rem] bg-gradient-to-br from-slate-900 via-[#0d1b2a] to-emerald-950 text-white border border-slate-800 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div>
                  <h3 className="font-black text-xl flex items-center gap-2.5 text-white">
                    <span className="w-8 h-8 rounded-xl bg-[#008060] text-white font-mono text-xs flex items-center justify-center shadow-md">03</span>
                    <span>3. ملخص الموازنة والمستحق للتحويل</span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    ميزان المراجعة النهائي لعدد ({settlementCalculation.ordersCount}) أوردر محدد ({settlementCalculation.deliveredOrdersCount} مسلم · {settlementCalculation.returnOrdersCount} مرتجع/ملغي)
                  </p>
                </div>

                {/* Pre-Execution Preview & Export Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintSettlement(buildDraftSettlement('draft'))}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-black text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Printer size={15} className="text-emerald-400" />
                    <span>معاينة وطباعة الكشف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportSettlementToExcel(buildDraftSettlement('draft'))}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-black text-white flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-400" />
                    <span>تصدير Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShareWhatsApp(buildDraftSettlement('draft'))}
                    className="px-3.5 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/30 text-xs font-black text-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MessageSquare size={15} />
                    <span>مشاركة واتساب</span>
                  </button>
                </div>
              </div>

              {/* Financial Equation Grid — Cohesive Brand Palette */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-bold">
                {/* 1. Total Collected */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>إجمالي التحصيل الفعلي</span>
                    <Landmark size={15} className="text-slate-400" />
                  </div>
                  <div className="text-xl font-black text-white font-mono tabular-nums">
                    {settlementCalculation.totalCollected.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    من {settlementCalculation.deliveredOrdersCount} أوردر تم تحصيله
                  </div>
                </div>

                {/* 2. Merchant Goods Entitlement */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                  <div className="flex items-center justify-between text-emerald-300">
                    <span>إجمالي مستحقات البضاعة</span>
                    <ArrowUpRight size={15} className="text-emerald-400" />
                  </div>
                  <div className="text-xl font-black text-emerald-400 font-mono tabular-nums">
                    {settlementCalculation.totalMerchantGoodsCost.toLocaleString()} <span className="text-xs text-emerald-300/70">ج.م</span>
                  </div>
                  <div className="text-[11px] text-emerald-300/80">
                    التكلفة الأساسية لبضاعة الموكل المباعة
                  </div>
                </div>

                {/* 3. Shipping & Carrier Logistics Deductions */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-amber-300">
                    <span>مصاريف الشحن ورسوم الشركة</span>
                    <ArrowDownLeft size={15} className="text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono tabular-nums">
                    -{Math.round((settlementCalculation.totalShippingCosts + settlementCalculation.totalCarrierAdditionalFees) * 100) / 100} <span className="text-xs text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    شحن أساسي: {settlementCalculation.totalShippingCosts.toLocaleString()} · رسوم إضافية وتأمين وضريبة: {settlementCalculation.totalCarrierAdditionalFees.toLocaleString()}
                  </div>
                </div>

                {/* 4. COD Collection Fees */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-amber-300">
                    <span>عمولات تحصيل النقدية COD</span>
                    <Calculator size={15} className="text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-amber-400 font-mono tabular-nums">
                    -{settlementCalculation.totalCollectionFees.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    رسوم تحصيل شركات الشحن المعتمدة
                  </div>
                </div>

                {/* 5. Marketing & Ad Spend */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between text-indigo-300">
                    <span>إجمالي مصاريف التسويق والإعلانات</span>
                    <Speaker size={15} className="text-indigo-400" />
                  </div>
                  <div className="text-xl font-black text-indigo-300 font-mono tabular-nums">
                    -{settlementCalculation.totalMarketingCosts.toLocaleString()} <span className="text-xs text-slate-400">ج.م</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    شامل إعلانات الأوردرات والحملات المجمعة
                  </div>
                </div>

                {/* 6. Return Losses & Return Fees */}
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1.5">
                  <div className="flex items-center justify-between text-rose-300">
                    <span>رسوم وخسائر المرتجعات</span>
                    <TrendingDown size={15} className="text-rose-400" />
                  </div>
                  <div className="text-xl font-black text-rose-400 font-mono tabular-nums">
                    -{settlementCalculation.totalReturnLosses.toLocaleString()} <span className="text-xs text-rose-300/70">ج.م</span>
                  </div>
                  <div className="text-[11px] text-rose-300/80">
                    عن عدد ({settlementCalculation.returnOrdersCount}) أوردر مرتجع أو فاشل
                  </div>
                </div>

                {/* 7. Agency / Operator Service Earnings */}
                <div className="p-4 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 space-y-1.5">
                  <div className="flex items-center justify-between text-indigo-200">
                    <span>عائد وعمولة التشغيل (حصة النظام)</span>
                    <TrendingUp size={15} className="text-indigo-300" />
                  </div>
                  <div className="text-xl font-black text-indigo-300 font-mono tabular-nums">
                    {settlementCalculation.totalOperatorEarnings.toLocaleString()} <span className="text-xs text-indigo-200/70">ج.م</span>
                  </div>
                  <div className="text-[11px] text-indigo-200/80">
                    عمولات الخدمة الثابتة: {settlementCalculation.totalServiceFees.toLocaleString()} ج.م
                  </div>
                </div>

                {/* 8. HERO NET PAYOUT TO MERCHANT */}
                <div className={`p-4 rounded-2xl border-2 space-y-1.5 shadow-xl ${
                  settlementCalculation.netPayoutToMerchant >= 0
                    ? 'bg-[#008060]/30 border-emerald-400'
                    : 'bg-rose-950/60 border-rose-500'
                }`}>
                  <div className="flex items-center justify-between text-emerald-200">
                    <span className="font-black">الصافي النهائي المستحق للتحويل</span>
                    <CheckCircle2 size={16} className="text-emerald-300" />
                  </div>
                  <div className="text-2xl font-black text-white font-mono tabular-nums">
                    {settlementCalculation.netPayoutToMerchant.toLocaleString()} <span className="text-xs text-emerald-200">ج.م</span>
                  </div>
                  <div className="text-[11px] text-emerald-200 font-bold">
                    {settlementCalculation.netPayoutToMerchant >= 0
                      ? 'صافي مستحق الدفع والتحويل للموكل'
                      : 'رصيد مديونية مستحق على الموكل'}
                  </div>
                </div>
              </div>

              {/* Partner Profit / Loss Breakdown Banner (فوق تكلفة البضاعة) */}
              {(() => {
                const partnerNetProfitOrLoss = Math.round((settlementCalculation.netPayoutToMerchant - settlementCalculation.totalMerchantGoodsCost) * 100) / 100;
                const roiPercent = settlementCalculation.totalMerchantGoodsCost > 0
                  ? Math.round((partnerNetProfitOrLoss / settlementCalculation.totalMerchantGoodsCost) * 1000) / 10
                  : 0;
                const isProfit = partnerNetProfitOrLoss >= 0;

                return (
                  <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isProfit
                      ? 'bg-emerald-500/10 border-emerald-400/30'
                      : 'bg-rose-500/10 border-rose-400/30'
                  }`}>
                    <div className="space-y-1">
                      <div className="text-xs font-black text-white flex items-center gap-2">
                        <span>موقف الربح والخسارة الفعلي لصاحب البضاعة (الذي يظهر له في الكشف المطبوع):</span>
                      </div>
                      <p className="text-xs text-slate-300">
                        المعادلة: الصافي المحول للموكل (<strong className="font-mono text-white">{settlementCalculation.netPayoutToMerchant.toLocaleString()} ج.م</strong>) = استرداد رأس مال البضاعة المباعة (<strong className="font-mono text-emerald-300">{settlementCalculation.totalMerchantGoodsCost.toLocaleString()} ج.م</strong>) {isProfit ? '+' : '-'} {isProfit ? 'صافي ربح الموكل' : 'صافي الخسارة'} (<strong className={`font-mono ${isProfit ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.abs(partnerNetProfitOrLoss).toLocaleString()} ج.م</strong>)
                      </p>
                    </div>

                    <div className={`px-4 py-2.5 rounded-xl font-black text-xs font-mono shrink-0 ${
                      isProfit
                        ? 'bg-[#008060] text-white'
                        : 'bg-rose-600 text-white'
                    }`}>
                      {partnerNetProfitOrLoss > 0
                        ? `صافي ربح الموكل: +${partnerNetProfitOrLoss.toLocaleString()} ج.م (+${roiPercent}%)`
                        : partnerNetProfitOrLoss < 0
                        ? `صافي خسارة الموكل: ${partnerNetProfitOrLoss.toLocaleString()} ج.م (${roiPercent}%)`
                        : 'نقطة تعادل (0 ج.م ربح/خسارة)'}
                    </div>
                  </div>
                );
              })()}

              {/* Payout Execution & Treasury Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1.5">
                    قناة وطريقة التحويل المالي
                  </label>
                  <select
                    value={payoutChannel}
                    onChange={e => {
                      const channel = e.target.value as typeof payoutChannel;
                      setPayoutChannel(channel);
                      if (channel === 'ledger_only') setSelectedTreasuryAccountId('');
                    }}
                    className="w-full p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl font-bold text-xs text-white outline-none focus:border-emerald-400"
                  >
                    <option value="instapay">إنستاباي (InstaPay)</option>
                    <option value="mobile_wallet">محفظة إلكترونية (فودافون كاش / غيرها)</option>
                    <option value="bank_transfer">تحويل بنكي مباشر</option>
                    <option value="treasury_cash">صرف نقدي من الخزينة</option>
                    <option value="ledger_only">تسوية دفترية فقط (بدون حركة خزينة)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1.5">
                    خصم المبلغ من وعاء الخزينة / الحساب
                  </label>
                  <select
                    value={selectedTreasuryAccountId}
                    onChange={e => setSelectedTreasuryAccountId(e.target.value)}
                    className="w-full p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl font-bold text-xs text-white outline-none focus:border-emerald-400"
                  >
                    <option value="">-- تسوية دفترية بدون خصم من خزينة --</option>
                    {(treasury?.accounts || []).map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (الرصيد المتاح: {acc.balance.toLocaleString()} ج.م)
                      </option>
                    ))}
                  </select>
                  {selectedTreasuryAccount && (
                    <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold px-1">
                      <span className="text-slate-400">الرصيد بعد الصرف:</span>
                      <span className={`font-mono ${
                        selectedTreasuryAccount.balance - settlementCalculation.netPayoutToMerchant >= 0
                          ? 'text-emerald-400'
                          : 'text-rose-400'
                      }`}>
                        {(selectedTreasuryAccount.balance - settlementCalculation.netPayoutToMerchant).toLocaleString()} ج.م
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1.5">
                    رقم مرجع التحويل / ملاحظات الكشف
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="رقم المرجع (اختياري)..."
                      value={transferReference}
                      onChange={e => setTransferReference(e.target.value)}
                      className="w-36 p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl font-mono text-xs text-white outline-none focus:border-emerald-400"
                    />
                    <input
                      type="text"
                      placeholder="ملاحظات إضافية للكشف..."
                      value={settlementNotes}
                      onChange={e => setSettlementNotes(e.target.value)}
                      className="flex-1 p-3.5 bg-slate-800/90 border border-slate-700 rounded-xl font-medium text-xs text-white outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              </div>

              {/* Attachments */}
              <div className="pt-1">
                <InvoiceAttachmentUploader
                  label="إرفاق صورة إيصال التحويل البنكي / إنستاباي / فودافون كاش (اختياري)"
                  helperText="يتم حفظ صورة الإيصال أرشيفياً مع الكشف وفي سجل حركات الخزينة"
                  attachments={settlementAttachments}
                  onChange={setSettlementAttachments}
                  activeStoreId="store-merchant-settlements"
                  folderCategory="expenses"
                  maxFiles={3}
                  compact
                />
              </div>

              {/* Final Execution Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleExecuteSettlement('draft')}
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <FileText size={16} />
                  <span>حفظ كمسودة مراجعة</span>
                </button>

                  <button
                  type="button"
                  onClick={() => handleExecuteSettlement('approved')}
                  className="px-5 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-2"
                >
                  <Check size={16} />
                  <span>اعتماد المستحق دون صرف</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExecuteSettlement('paid')}
                  className="px-8 py-3.5 bg-[#008060] hover:bg-emerald-500 text-white font-black rounded-xl text-sm shadow-xl shadow-emerald-950/60 transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  <span>اعتماد وتأكيد كشف التسوية وصرف الصافي ({settlementCalculation.netPayoutToMerchant.toLocaleString()} ج.م)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: PARTNERS FINANCIAL DIRECTORY & BALANCES           */}
      {/* ======================================================== */}
      {activeTab === 'merchants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                دليل أصحاب البضائع والموكلين المسجلين ({partnersSummary.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                يظهر هنا فقط الموردون وأصحاب البضائع والموكلون المرتبطون بأوردرات الوكالة (وليس عملاء المتجر العاديين).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setShowSmtpSetupModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="إعداد خادم إرسال البريد الفعلي (Gmail / SMTP / Resend)"
              >
                <Mail size={14} />
                <span>إعدادات خادم البريد (SMTP) ⚙️</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(true)}
                className="px-4 py-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus size={15} />
                <span>تسجيل موكل / صاحب بضاعة جديد</span>
              </button>
            </div>
          </div>

          {partnersSummary.length === 0 ? (
            <div className="p-14 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <User size={28} />
              </div>
              <div className="text-base font-black text-slate-800 dark:text-slate-100">
                لا يوجد موكلون أو أصحاب بضائع مسجلون حالياً
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                قم بإضافة صاحب بضاعة / موكل جديد وربطه بالأوردرات من شاشة إنشاء الطلب لتتبع مستحقاته وتسوياته المالية هنا.
              </p>
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(true)}
                className="px-5 py-2.5 bg-[#008060] hover:bg-[#006e52] text-white rounded-xl text-xs font-black inline-flex items-center gap-2 mt-2 cursor-pointer"
              >
                <Plus size={15} />
                <span>إضافة أول موكل / صاحب بضاعة</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partnersSummary.map(partner => (
                <div
                  key={partner.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-black text-base text-slate-900 dark:text-white">
                        {partner.name}
                      </h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        {partner.phone || 'بدون رقم هاتف مسجل'} · {partner.totalOrdersCount} أوردر وكالة
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono mt-1.5">
                        <Mail size={13} className={partner.email ? "text-emerald-500" : "text-amber-500"} />
                        {partner.email ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                            {partner.email}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPartnerForEmail({ id: partner.id, name: partner.name, currentEmail: partner.email });
                              setPartnerEmailInput('');
                            }}
                            className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                          >
                            <span>+ ربط إيميل لدخول البوابة</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                      partner.unsettledCount > 0
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {partner.unsettledCount > 0 ? `${partner.unsettledCount} جاهز للتسوية` : 'مسوّى بالكامل'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                      <span className="text-[11px] text-slate-500 block">الرصيد المستحق الحالي</span>
                      <strong className={`font-mono text-sm ${partner.currentBalance >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'}`}>{partner.currentBalance.toLocaleString()} ج.م</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <span className="text-[11px] text-slate-500 block">تحصيل الأوردرات المعلقة</span>
                      <strong className="font-mono text-sm text-slate-900 dark:text-white">{partner.pendingCollection.toLocaleString()} ج.م</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <span className="text-[11px] text-slate-500 block">بضاعة معلقة للموكل</span>
                      <strong className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{partner.pendingGoodsCost.toLocaleString()} ج.م</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <span className="text-[11px] text-slate-500 block">إجمالي المحول سابقاً</span>
                      <strong className="font-mono text-sm text-indigo-600 dark:text-indigo-400">{partner.totalPaidOut.toLocaleString()} ج.م</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70">
                      <span className="text-[11px] text-slate-500 block">نسبة المرتجعات</span>
                      <strong className={`font-mono text-sm ${partner.returnRate > 25 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-300'}`}>
                        {partner.returnRate}% ({partner.returnCount} مرتجع)
                      </strong>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-400">
                      {partner.settlementsCount} كشف سابق · عمولاتنا: {partner.totalAgencyEarned.toLocaleString()} ج.م
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const supp = (settings.suppliers || []).find(s => s.id === partner.id) || partner;
                          openMerchantPayoutPolicyModal(supp);
                        }}
                        className="px-2.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-black transition-colors cursor-pointer border border-amber-200 dark:border-amber-800 flex items-center gap-1"
                        title="تعديل استراتيجية تعليق وصرف أرباح الموكل"
                      >
                        <SettingsIcon size={13} />
                        <span>تعديل السياسة ⚙️</span>
                      </button>
                      <Link
                        to={`/store/${activeStoreId}/suppliers/${partner.id}`}
                        className="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border border-emerald-500/10 shadow-xs"
                        title="عرض محفظة الموكل والتحليلات"
                      >
                        <Wallet size={13} />
                        <span>المحفظة</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPartnerForEmail({ id: partner.id, name: partner.name, currentEmail: partner.email });
                          setPartnerEmailInput(partner.email || '');
                        }}
                        className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                        title="تعديل أو ربط البريد الإلكتروني للموكل"
                      >
                        <Mail size={13} />
                        <span>الإيميل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            sessionStorage.setItem('partner_portal_auth_default', JSON.stringify(partner));
                          } catch {}
                          setActiveTab('portal');
                        }}
                        className="px-3 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 text-xs font-bold transition-colors cursor-pointer border border-teal-200 flex items-center gap-1"
                        title="دخول بوابة الموكل مباشرة"
                      >
                        <Globe size={13} />
                        <span>دخول البوابة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTransparencyMerchantId(partner.id);
                          setActiveTab('transparency');
                        }}
                        className="px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-colors cursor-pointer border border-indigo-200"
                        title="عرض كشف الشفافية وحركة البضاعة للموكل"
                      >
                        كشف الشفافية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectMerchant(partner.id);
                          setActiveTab('create');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black transition-colors cursor-pointer"
                      >
                        بدء تسوية الموكل
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB: INCOMING MERCHANT PAYOUT & WITHDRAWAL REQUESTS     */}
      {/* ======================================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 border border-amber-500/30 rounded-3xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                <Coins size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-white">طلبات سحب المستحقات الواردة من الموكلين</h3>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {merchantRequests.length} طلب إجمالي
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  مراجعة طلبات السحب المالية والمصروفات المقدمة من الموكلين وأصحاب البضائع بالأمانة، مع إمكانية الاعتماد والتحويل المباشر لحساباتهم.
                </p>
              </div>
            </div>

            <button
              onClick={loadMerchantRequests}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 text-xs font-black transition-all flex items-center gap-2 cursor-pointer border border-amber-500/30 whitespace-nowrap shadow-sm"
            >
              <RefreshCw size={14} />
              <span>تحديث الطلبات</span>
            </button>
          </div>

          {/* ======================================================== */}
          {/* WEEKLY SCHEDULED PAYOUTS & 7-DAY HOLDING CONTROL CENTER  */}
          {/* ======================================================== */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>جدول التحويلات الأسبوعية وتعليق الأوردرات المسواة (٧ أيام)</span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      تحكم مدير المتجر
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                    يبدأ حساب مدة الـ 7 أيام من لحظة تسوية الأوردر مالياً، وبعد انتهائها يصبح الرصيد جاهزاً للتحويل في اليوم الأسبوعي الذي اختاره الموكل.
                  </p>
                </div>
              </div>
            </div>

            {weeklyScheduledPayoutsSummary.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-slate-400">
                لا يوجد موكلون مسجلون حالياً لعرض جدول التحويلات الأسبوعية.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {weeklyScheduledPayoutsSummary.map(row => (
                  <div
                    key={row.supplier.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h5 className="font-black text-xs text-slate-900 dark:text-white">{row.supplier.name}</h5>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300">
                            يوم التحويل: {row.weeklyDayNameAr} ({row.daysUntilNext === 0 ? 'اليوم 🔔' : `بعد ${row.daysUntilNext} يوم`})
                          </span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            row.weeklyPayoutMode === 'auto'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          }`}>
                            {row.weeklyPayoutMode === 'auto' ? 'تحويل آلي ⚡' : 'تأكيد بضغطة زر 👆'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openMerchantPayoutPolicyModal(row.supplier)}
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px] font-black cursor-pointer transition-all"
                        title="تعديل مدة التعليق والحد الأدنى والأقصى للسحبة الأسبوعية"
                      >
                        تعديل السياسة ⚙️
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400">رصيد المحفظة المسوّى</div>
                        <div className="text-xs font-black font-mono text-slate-900 dark:text-white mt-0.5">
                          {row.currentWalletBalance.toLocaleString()} ج.م
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
                        <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          {row.supplier.payoutStrategy === 'batch_weekly' 
                            ? 'بانتظار دورة التحويل' 
                            : row.supplier.payoutStrategy === 'manual_request'
                            ? 'معلق (بانتظار الطلب)'
                            : `قيد التعليق (${row.holdingDaysSetting} أيام)`}
                        </div>
                        <div className="text-xs font-black font-mono text-amber-700 dark:text-amber-300 mt-0.5">
                          {row.holdingAmount.toLocaleString()} ج.م ({row.holdingOrdersCount} طلب)
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">جاهز للتحويل</div>
                        <div className="text-xs font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5">
                          {row.nextScheduledPayoutAmount.toLocaleString()} ج.م
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                      <span>الحدود: {row.minWeeklyPayout.toLocaleString()} - {row.maxWeeklyPayout.toLocaleString()} ج.م</span>
                      <span>التحويل القادم: {row.nextDateFormatted}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {row.holdingOrdersCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleReleaseAllMerchantHoldOrders(row.supplier.id, row.supplier.name)}
                          className="flex-1 py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] cursor-pointer transition-all shadow-xs"
                        >
                          فك تعليق ({row.holdingOrdersCount}) أوردر فوراً ⚡
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={row.nextScheduledPayoutAmount <= 0}
                        onClick={() =>
                          handleExecuteWeeklyScheduledPayout({
                            supplier: row.supplier,
                            payoutAmount: row.nextScheduledPayoutAmount,
                            readyOrdersIds: row.readyOrdersIds
                          })
                        }
                        className="flex-1 py-2 px-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] disabled:opacity-40 text-white font-black text-[10px] cursor-pointer transition-all shadow-xs"
                      >
                        صرف الدفعة الأسبوعية ({row.nextScheduledPayoutAmount.toLocaleString()} ج.م) 💸
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">حالة الطلبات:</span>
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'pending', label: `قيد المراجعة (${pendingMerchantRequestsCount})` },
                  { id: 'approved', label: 'المعتمدة ✅' },
                  { id: 'rejected', label: 'المرفوضة ❌' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setRequestsFilterStatus(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      requestsFilterStatus === f.id
                        ? 'bg-[#008060] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs font-bold text-slate-500">
              إجمالي المعلق: <span className="font-mono text-amber-600 dark:text-amber-400 font-black">{pendingMerchantRequestsCount} طلبات</span>
            </div>
          </div>

          {/* Requests List Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            {merchantRequests.filter(r => requestsFilterStatus === 'all' || r.status === requestsFilterStatus).length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <Coins size={36} className="mx-auto opacity-30" />
                <p className="font-bold text-xs">لا توجد طلبات سحب مستحقات متطابقة مع التصفية الحالية</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black border-b border-slate-800">
                      <th className="py-3.5 px-4">التاريخ والرقم</th>
                      <th className="py-3.5 px-3">اسم الموكل / صاحب البضاعة</th>
                      <th className="py-3.5 px-3">نوع الطلب والتفاصيل</th>
                      <th className="py-3.5 px-3 text-center">المبلغ المطلوب</th>
                      <th className="py-3.5 px-3 text-center">الحالة الحالية</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات والتحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {merchantRequests
                      .filter(r => requestsFilterStatus === 'all' || r.status === requestsFilterStatus)
                      .map(req => {
                        const isPending = req.status === 'pending';
                        const isApproved = req.status === 'approved';
                        const isRejected = req.status === 'rejected';
                        const isCustomQuote = req.type === 'custom_plan_quote';
                        const isPlanChange = req.type === 'plan_change_request';
                        const quoteFeeVal = customQuoteFeeMap[req.id] ?? 20;
                        const targetOrders = Number(
                          req.planRequestMeta?.requestedCustomQuota ||
                            req.planRequestMeta?.requestedOrdersTarget ||
                            req.planRequestMeta?.ordersLimit ||
                            500
                        );
                        const isPrepaidQuote = Boolean(
                          req.planRequestMeta?.requestedPrepaidQuota ??
                            (req.planRequestMeta?.requestedCustomBillingPreference === 'prepaid_quota')
                        );
                        const resolvedPlanName =
                          req.planRequestMeta?.targetPlanNameAr ||
                          req.planRequestMeta?.planNameAr ||
                          (req.payoutAccount && req.payoutAccount !== 'undefined' ? req.payoutAccount : 'باقة المدير المخصصة');

                        return (
                          <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-4 px-4">
                              <div className="font-mono font-black text-slate-900 dark:text-white">#{req.id.slice(-8)}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{new Date(req.createdAt || req.date).toLocaleDateString('ar-EG')}</div>
                            </td>
                            <td className="py-4 px-3">
                              <div className="font-black text-slate-900 dark:text-white">{req.partnerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">كود: {req.partnerId}</div>
                            </td>
                            <td className="py-4 px-3">
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {isCustomQuote
                                  ? 'طلب تسعير باقة مدير مخصصة (تسعير خاص لكل أوردر)'
                                  : isPlanChange
                                  ? `طلب تغيير باقة (${resolvedPlanName})`
                                  : req.typeArabic || 'طلب سحب مستحقات'}
                              </div>
                              {req.notes && (
                                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg mt-1 border border-emerald-200 dark:border-emerald-800/50 max-w-md">
                                  {String(req.notes).replace(/\(undefined\)/g, '(باقة المدير المخصصة)')}
                                </div>
                              )}
                              {isCustomQuote && isPending && (
                                <div className="mt-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 max-w-md space-y-1.5">
                                  <label className="block text-[11px] font-black text-amber-900 dark:text-amber-300">
                                    حدد سعر إدارة الأوردر الواحد للموكل (ج.م):
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      value={quoteFeeVal}
                                      onChange={e =>
                                        setCustomQuoteFeeMap(prev => ({
                                          ...prev,
                                          [req.id]: Math.max(1, Number(e.target.value) || 0)
                                        }))
                                      }
                                      className="w-28 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-black font-mono"
                                    />
                                    <span className="text-[11px] font-black text-amber-700 dark:text-amber-400">
                                      ج.م / أوردر ({isPrepaidQuote ? 'دفع مسبق' : 'خصم تلقائي مع كل أوردر — ٠ ج.م مقدم'})
                                    </span>
                                  </div>
                                </div>
                              )}
                              {(req.transferReference || req.receiptImage) && (
                                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                  {req.transferReference && (
                                    <span className="text-[10px] font-mono font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800">
                                      مرجع التحويل: {req.transferReference}
                                    </span>
                                  )}
                                  {req.receiptImage && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewReceiptImage(req.receiptImage || null)}
                                      className="text-[10px] font-black bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1 cursor-pointer transition-all"
                                    >
                                      <Eye size={11} /> عرض إيصال التحويل 🧾
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-3 text-center font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                              {isCustomQuote ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                                    {targetOrders} أوردر مستهدف
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-bold">
                                    {isPrepaidQuote ? 'دفع مسبق للحصة' : 'خصم لكل أوردر (٠ ج.م الآن)'}
                                  </div>
                                </div>
                              ) : (
                                `${req.amount.toLocaleString()} ج.م`
                              )}
                            </td>
                            <td className="py-4 px-3 text-center">
                              <span className={`inline-flex items-center gap-1 font-black px-3 py-1 rounded-full text-[10px] border ${
                                isPending
                                  ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                                  : isApproved
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                              }`}>
                                {isPending ? 'قيد المراجعة ⏳' : isApproved ? 'تم الاعتماد ✅' : 'تم الرفض ❌'}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-center">
                              {isPending ? (
                                isCustomQuote ? (
                                  <div className="flex flex-col items-center justify-center gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleCustomQuoteAction(req, 'send_quote', quoteFeeVal)}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] transition-all cursor-pointer shadow-xs"
                                      >
                                        إرسال عرض السعر ({quoteFeeVal} ج/أوردر) 📤
                                      </button>
                                      <button
                                        onClick={() => handleRejectMerchantRequest(req)}
                                        className="px-2.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-bold text-[11px] transition-all cursor-pointer border border-rose-200 dark:border-rose-800"
                                      >
                                        رفض ❌
                                      </button>
                                    </div>
                                    <button
                                      onClick={() => handleCustomQuoteAction(req, 'activate_now', quoteFeeVal)}
                                      className="w-full px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-[11px] transition-all cursor-pointer shadow-xs"
                                    >
                                      تفعيل فوري للموكل ({quoteFeeVal} ج/أوردر) ⚡
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      onClick={() => {
                                        setApprovalTransferRef('');
                                        setApprovalReceiptImage('');
                                        setSelectedReqForApproval(req);
                                      }}
                                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all cursor-pointer shadow-xs flex items-center gap-1"
                                    >
                                      <Check size={14} />
                                      <span>اعتماد وتخصيم ✅</span>
                                    </button>
                                    <button
                                      onClick={() => handleRejectMerchantRequest(req)}
                                      className="px-3.5 py-1.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 font-bold text-xs transition-all cursor-pointer border border-rose-200 dark:border-rose-800 flex items-center gap-1"
                                    >
                                      <X size={14} />
                                      <span>رفض ❌</span>
                                    </button>
                                  </div>
                                )
                              ) : (
                                <span className="text-[11px] text-slate-400 font-bold">تم اتخاذ إجراء</span>
                              )}
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

      {/* ======================================================== */}
      {/* TAB 4: MERCHANT TRANSPARENCY DASHBOARD & ACCOUNTABILITY  */}
      {/* ======================================================== */}
      {activeTab === 'transparency' && (
        <MerchantTransparencyTab
          orders={orders}
          settings={settings}
          customers={customers}
          initialMerchantIdOrName={transparencyMerchantId}
          onNavigateToSettlement={(mId) => {
            handleSelectMerchant(mId);
            setActiveTab('create');
          }}
          onOpenPortal={(mId) => {
            if (mId && mId !== 'all') {
              const partnerMatch = partnersSummary.find(p => p.id === mId);
              if (partnerMatch) {
                try {
                  sessionStorage.setItem('partner_portal_auth_default', JSON.stringify(partnerMatch));
                } catch {}
              }
            }
            setActiveTab('portal');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* TAB 5: LIVE MERCHANT PORTAL VIEW              */}
      {/* ======================================================== */}
      {activeTab === 'portal' && (
        <div className="space-y-4">
          {/* Portal Top Bar with Control / Info */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-5 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
                <Globe size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-white">معاينة بوابة الموكل الإلكترونية (Live Merchant Portal)</h3>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    مباشر وحي 🚀
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  هذه هي البوابة التي يدخل إليها الموكل (ببريده الإلكتروني أو رمزه السري)، ليتابع أوردراته كاملة (المشحونة، المحصلة، المرتجعة، والمعلقة)، ويتحكم بمحفظته المالية وسحب الأرباح.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              <a
                href="/merchant-portal"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition-all flex items-center gap-2 cursor-pointer border border-white/20 whitespace-nowrap shadow-sm"
              >
                <ExternalLink size={15} />
                <span>فتح في نافذة كاملة مستقلة</span>
              </a>
            </div>
          </div>

          {/* The MerchantPortal Component */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl min-h-[700px]">
            <MerchantPortal
              allStoresData={{
                default: {
                  id: 'default',
                  name: settings.storeName || 'متجري',
                  settings,
                  orders,
                  treasury: treasury || { accounts: [], transactions: [] },
                  wallet: { balance: 0, transactions: [] }
                } as any
              }}
              updateSettings={(newSettings) => updateSettings(newSettings)}
              showToast={(msg, type) => {
                inAppToast(msg, type === 'error' ? 'error' : 'success');
              }}
            />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TREASURY-LINKED APPROVAL MODAL FOR PARTNER REQUEST       */}
      {/* ======================================================== */}
      {selectedReqForApproval && (
        <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200 dark:border-slate-800 text-right font-sans max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <Check size={18} />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-white">اعتماد وصرف طلب سحب المستحقات</h3>
              </div>
              <button 
                onClick={() => { setSelectedReqForApproval(null); setApprovalTreasuryAccountId(''); setApprovalTransferRef(''); setApprovalReceiptImage(''); }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-bold">الموكل:</span>
                <span className="font-black text-slate-900 dark:text-white">{selectedReqForApproval.partnerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-bold">مبلغ الطلب:</span>
                <span className="font-black font-mono text-emerald-700 dark:text-emerald-400 text-sm">{selectedReqForApproval.amount.toLocaleString()} ج.م</span>
              </div>
              {selectedReqForApproval.notes && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
                  📝 {selectedReqForApproval.notes}
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  حساب الخزينة المركزية للصرف المباشر:
                </label>
                <select
                  value={approvalTreasuryAccountId}
                  onChange={e => setApprovalTreasuryAccountId(e.target.value)}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-bold text-xs text-slate-900 dark:text-white"
                >
                  <option value="">تسوية دفترية فقط (خصم من رصيد الموكل دون الخزينة المركزية)</option>
                  {(treasury?.accounts || []).map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — الرصيد: {acc.balance.toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                  عند اختيار حساب خزينة، سيتم التحقق من كفاية رصيده وخصم المبلغ منه وتوثيق حركة الصرف آلياً في سجل الخزينة.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  رقم المرجع البنكي / عملية التحويل (اختياري):
                </label>
                <input
                  type="text"
                  value={approvalTransferRef}
                  onChange={e => setApprovalTransferRef(e.target.value)}
                  placeholder="مثال: INSTA-982341 أو رقم عملية فودافون كاش..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono font-bold text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1">
                  إرفاق صورة إيصال التحويل البنكي / المحفظة (تظهر للموكل في بوابته):
                </label>
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-center bg-slate-50/50 dark:bg-slate-800/40">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptFileUpload}
                    className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                  {approvalReceiptImage && (
                    <div className="mt-2 relative inline-block">
                      <img src={approvalReceiptImage} alt="إيصال التحويل" className="max-h-36 rounded-xl border border-slate-200 mx-auto object-contain" />
                      <button
                        type="button"
                        onClick={() => setApprovalReceiptImage('')}
                        className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-1 shadow-md cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleApproveMerchantRequest(selectedReqForApproval, approvalTreasuryAccountId)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition-all cursor-pointer"
                >
                  تأكيد الاعتماد والصرف ✅
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedReqForApproval(null); setApprovalTreasuryAccountId(''); setApprovalTransferRef(''); setApprovalReceiptImage(''); }}
                  className="px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {previewReceiptImage && (
        <div
          className="fixed inset-0 z-[150] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewReceiptImage(null)}
          dir="rtl"
        >
          <div className="relative max-w-2xl w-full bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-2xl border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <h4 className="font-black text-sm text-slate-900 dark:text-white">صورة إيصال التحويل البنكي / المحفظة 🧾</h4>
              <button onClick={() => setPreviewReceiptImage(null)} className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <img src={previewReceiptImage} alt="إيصال التحويل" className="max-h-[75vh] w-auto mx-auto rounded-2xl object-contain" />
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* QUICK ADD PARTNER / GOODS OWNER MODAL                    */}
      {/* ======================================================== */}
      {showAddPartnerModal && (
        <div
          className="fixed inset-0 z-[110] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowAddPartnerModal(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-slate-900 via-[#0d1b2a] to-emerald-950 text-white flex items-center justify-between">
              <h3 className="text-base font-black">تسجيل موكل / صاحب بضاعة جديد</h3>
              <button
                type="button"
                onClick={() => setShowAddPartnerModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  اسم الموكل / صاحب البضاعة *
                </label>
                <input
                  type="text"
                  value={newPartnerName}
                  onChange={e => setNewPartnerName(e.target.value)}
                  placeholder="مثال: مصنع النور للملابس / أ. أحمد..."
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  رقم الهاتف / واتساب
                </label>
                <input
                  type="text"
                  value={newPartnerPhone}
                  onChange={e => setNewPartnerPhone(e.target.value)}
                  placeholder="010XXXXXXXX"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>البريد الإلكتروني للموكل (مطلوب لدخول البوابة واستلام OTP) ✉️</span>
                </label>
                <input
                  type="email"
                  value={newPartnerEmail}
                  onChange={e => setNewPartnerEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  مصاريف تسويق افتراضية للأوردر (اختياري - ج.م)
                </label>
                <input
                  type="number"
                  value={newPartnerDefaultMarketing || ''}
                  onChange={e => setNewPartnerDefaultMarketing(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPartnerModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddNewPartner}
                  className="px-5 py-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer"
                >
                  حفظ وتسجيل الموكل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT / LINK PARTNER EMAIL MODAL                          */}
      {/* ======================================================== */}
      {editingPartnerForEmail && (
        <div
          className="fixed inset-0 z-[110] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setEditingPartnerForEmail(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Mail size={18} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-black">ربط البريد الإلكتروني للموكل</h3>
                  <p className="text-[11px] text-slate-300 font-bold">{editingPartnerForEmail.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPartnerForEmail(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان البريد الإلكتروني الفعلي:
                </label>
                <input
                  type="email"
                  value={partnerEmailInput}
                  onChange={e => setPartnerEmailInput(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none focus:border-emerald-600 text-slate-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-bold">
                💡 بمجرد حفظ هذا البريد، سيتمكن الموكل من فتح شاشة البوابة <strong>/merchant-portal</strong> وكتابة هذا الإيميل، وسيصله كود أمني (OTP) على بريده مباشرة للدخول الآمن.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPartnerForEmail(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePartnerEmail}
                  disabled={isSavingPartnerEmail || !partnerEmailInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingPartnerEmail ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>حفظ وتفعيل البريد الآن</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SMTP / GMAIL SERVER CONFIGURATION MODAL                  */}
      {/* ======================================================== */}
      {showSmtpSetupModal && (
        <div
          className="fixed inset-0 z-[110] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSmtpSetupModal(false)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Mail size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black">إعدادات خادم البريد الفعلي (SMTP)</h3>
                  <p className="text-[11px] text-slate-300">لإرسال أكواد الدخول الفعلية (OTP) إلى إيميلات الموكلين</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSmtpSetupModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                  مزود خدمة البريد:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSmtpProvider('gmail');
                      setSmtpHost('smtp.gmail.com');
                      setSmtpPort(587);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      smtpProvider === 'gmail' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Gmail (App Password)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmtpProvider('resend')}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      smtpProvider === 'resend' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Resend API
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmtpProvider('smtp')}
                    className={`p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      smtpProvider === 'smtp' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-600 text-emerald-800 dark:text-emerald-300 shadow-xs' 
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    SMTP مخصص
                  </button>
                </div>
              </div>

              {smtpProvider === 'resend' ? (
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                    مفتاح Resend API Key:
                  </label>
                  <input
                    type="password"
                    value={smtpResendKey}
                    onChange={e => setSmtpResendKey(e.target.value)}
                    placeholder="re_xxxxxxxxxxxxxx"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
                      عنوان بريدك الإلكتروني (Gmail / SMTP User):
                    </label>
                    <input
                      type="email"
                      value={smtpUser}
                      onChange={e => setSmtpUser(e.target.value)}
                      placeholder="your-store@gmail.com"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>كلمة مرور التطبيق (App Password):</span>
                      <span className="text-[10px] text-slate-400">16 حرفاً بدون مسافات</span>
                    </label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={e => setSmtpPass(e.target.value)}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      في حساب Google: الأمان ➔ التحقق بخطوتين ➔ كلمات مرور التطبيقات (App Passwords) ➔ أنشئ كلمة مرور لتطبيق "Mail".
                    </p>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleSaveSmtp}
                  disabled={isSavingSmtp}
                  className="px-5 py-2.5 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {isSavingSmtp ? 'جاري الحفظ...' : 'حفظ وتفعيل خادم البريد 💾'}
                </button>
              </div>

              {/* Test Email Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                <div className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>اختبار إرسال بريد حقيقي الآن:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testMailRecipient}
                    onChange={e => setTestMailRecipient(e.target.value)}
                    placeholder="أدخل بريدك للتجربة..."
                    className="flex-1 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSendTestMail}
                    disabled={isTestingMail || !testMailRecipient.trim()}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    {isTestingMail ? 'جاري الإرسال...' : 'إرسال تجربة ✉️'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SETTLEMENT SNAPSHOT DETAILS MODAL                        */}
      {/* ======================================================== */}
      {viewingSettlement && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setViewingSettlement(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 p-5 bg-gradient-to-r from-slate-900 via-[#0d1b2a] to-emerald-950 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <span>تفاصيل كشف التسوية {viewingSettlement.settlementNumber}</span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  الموكل: {viewingSettlement.merchantName} · التاريخ: {new Date(viewingSettlement.date).toLocaleDateString('ar-EG')} · بواسطة: {viewingSettlement.performedBy || 'النظام'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintSettlement(viewingSettlement)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} /> طباعة
                </button>
                <button
                  onClick={() => handleExportSettlementToExcel(viewingSettlement)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} /> Excel
                </button>
                <button
                  onClick={() => setViewingSettlement(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'إجمالي التحصيل', value: viewingSettlement.totalCollected, tone: 'text-slate-900 dark:text-white' },
                  { label: 'مستحقات البضاعة', value: viewingSettlement.totalMerchantGoodsCost, tone: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'فرق خصم الشحن', value: viewingSettlement.totalShippingDiscountDifference || 0, tone: 'text-amber-600 dark:text-amber-400' },
                  { label: 'رسوم شحن إضافية', value: viewingSettlement.totalCarrierAdditionalFees || 0, tone: 'text-amber-600 dark:text-amber-400' },
                  { label: 'مصاريف الإعلانات', value: viewingSettlement.totalMarketingCosts, tone: 'text-indigo-600 dark:text-indigo-400' },
                  { label: 'خسائر المرتجع', value: viewingSettlement.totalReturnLosses || 0, tone: 'text-rose-600 dark:text-rose-400' },
                  { label: 'عائد التشغيل (عمولتنا)', value: viewingSettlement.totalOperatorEarnings ?? viewingSettlement.totalServiceFees, tone: 'text-indigo-600 dark:text-indigo-400' },
                  { label: 'الصافي النهائي للموكل', value: viewingSettlement.netPayoutToMerchant, tone: 'text-emerald-700 dark:text-emerald-400' }
                ].map(item => (
                  <div key={item.label} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] font-bold text-slate-500">{item.label}</div>
                    <div className={`mt-1 text-base font-black font-mono tabular-nums ${item.tone}`}>
                      {Number(item.value).toLocaleString()} ج.م
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-right text-xs min-w-[900px]">
                  <thead className="bg-slate-900 text-white font-black">
                    <tr>
                      <th className="p-3">رقم الطلب</th>
                      <th className="p-3">العميل</th>
                      <th className="p-3">الحالة</th>
                      <th className="p-3 text-center">المحصل</th>
                      <th className="p-3 text-center">مستحق البضاعة</th>
                      <th className="p-3 text-center">فرق الشحن</th>
                      <th className="p-3 text-center">رسوم إضافية وCOD</th>
                      <th className="p-3 text-center">الإعلانات والعمولة</th>
                      <th className="p-3 text-center">خسارة المرتجع</th>
                      <th className="p-3 text-center">صافي الموكل</th>
                      <th className="p-3 text-center">حالة التعليق والتحويل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    {(viewingSettlement.orderSnapshots || []).map(snapshot => {
                      const liveOrder = orders.find(o => o.id === snapshot.orderId);
                      const matchedSupplier = (settings.suppliers || []).find(
                        s => s.id === viewingSettlement.merchantId
                      );
                      const defaultHoldDays = typeof matchedSupplier?.holdingDaysAfterSettlement === 'number'
                        ? matchedSupplier.holdingDaysAfterSettlement
                        : 7;
                      const orderHoldDays = typeof liveOrder?.customHoldingDays === 'number'
                        ? liveOrder.customHoldingDays
                        : defaultHoldDays;
                      const settledTime = liveOrder?.settledAt
                        ? new Date(liveOrder.settledAt).getTime()
                        : new Date(viewingSettlement.date).getTime();
                      const elapsedDays = Math.max(0, (Date.now() - settledTime) / 86400000);
                      const remHoldDays = liveOrder?.payoutStatus === 'ready' || liveOrder?.payoutStatus === 'paid'
                        ? 0
                        : Math.max(0, Math.ceil(orderHoldDays - elapsedDays));
                      const isOrderPaid = liveOrder?.payoutStatus === 'paid';

                      return (
                        <tr key={snapshot.orderId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">
                            #{snapshot.orderNumber || snapshot.orderId.slice(0, 8)}
                          </td>
                          <td className="p-3">{snapshot.customerName || '-'}</td>
                          <td className="p-3">{snapshot.status}</td>
                          <td className="p-3 text-center font-mono">{snapshot.collectedAmount.toLocaleString()}</td>
                          <td className="p-3 text-center font-mono text-emerald-600 dark:text-emerald-400">{snapshot.merchantGoodsCost.toLocaleString()}</td>
                          <td className="p-3 text-center font-mono text-amber-600">-{snapshot.shippingDiscountDifference.toLocaleString()}</td>
                          <td className="p-3 text-center font-mono text-amber-600">-{(snapshot.carrierAdditionalFees + snapshot.collectionFee).toLocaleString()}</td>
                          <td className="p-3 text-center font-mono text-indigo-600">-{(snapshot.marketingCost + snapshot.serviceFee).toLocaleString()}</td>
                          <td className="p-3 text-center font-mono text-rose-600">-{snapshot.returnLoss.toLocaleString()}</td>
                          <td className="p-3 text-center font-mono font-black text-emerald-700 dark:text-emerald-400">
                            {snapshot.netMerchantAmount.toLocaleString()} ج.م
                          </td>
                          <td className="p-3 text-center">
                            {isOrderPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-black">
                                مدفوع ومُحول ✅
                              </span>
                            ) : remHoldDays > 0 ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-black">
                                  قيد التعليق (متبقي {remHoldDays} يوم) ⏳
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleReleaseOrderHold(snapshot.orderId)}
                                  className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black cursor-pointer transition-all"
                                >
                                  فك التعليق فوراً ⚡
                                </button>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-[10px] font-black">
                                جاهز للتحويل الأسبوعي 🚀
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(!viewingSettlement.orderSnapshots || viewingSettlement.orderSnapshots.length === 0) && (
                  <div className="p-8 text-center text-xs text-slate-500">
                    هذا الكشف تم إصداره قبل تفعيل اللقطات التفصيلية للأوردرات.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* WEEKLY PAYOUT POLICY MODAL (تعديل سياسة التحويل الأسبوعي) */}
      {/* ======================================================== */}
      {editingPayoutPolicyMerchant && (
        <div
          className="fixed inset-0 z-[130] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setEditingPayoutPolicyMerchant(null)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  سياسة التحويل الأسبوعي وتعليق الأوردرات ({editingPayoutPolicyMerchant.name})
                </h3>
                <p className="text-[11px] font-bold text-slate-400">
                  تخصيص مدة تعليق الأوردر والحد الأدنى والأقصى للسحبة الأسبوعية
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPayoutPolicyMerchant(null)}
                className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs font-bold">
              {/* Payout Strategy Selector (New Request) */}
              <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <label className="block text-indigo-700 dark:text-indigo-300 text-[11px] font-black mb-1">
                  استراتيجية صرف الأرباح للموكل:
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setPolicyPayoutStrategy('rolling_hold')}
                    className={`w-full p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5 ${
                      policyPayoutStrategy === 'rolling_hold'
                        ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-transparent border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <span className="text-[11px] font-black">1. تعليق متدحرج (بالأيام) ⏳</span>
                    <span className="text-[9px] font-bold text-slate-500 italic">يتم تعليق كل أوردر لمدة X يوم من تاريخ تسويته (النظام الحالي).</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPolicyPayoutStrategy('batch_weekly')}
                    className={`w-full p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5 ${
                      policyPayoutStrategy === 'batch_weekly'
                        ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-transparent border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <span className="text-[11px] font-black">2. تجميع أسبوعي (أوردرات الأسبوع بالكامل) 📅</span>
                    <span className="text-[9px] font-bold text-slate-500 italic">كل ما يُسوى هذا الأسبوع، يُتاح للسحب في "يوم التحويل" من الأسبوع القادم.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPolicyPayoutStrategy('manual_request')}
                    className={`w-full p-2.5 rounded-xl border text-right transition-all flex flex-col gap-0.5 ${
                      policyPayoutStrategy === 'manual_request'
                        ? 'bg-white dark:bg-slate-900 border-indigo-500 shadow-sm ring-1 ring-indigo-500'
                        : 'bg-transparent border-slate-200 dark:border-slate-800 opacity-60'
                    }`}
                  >
                    <span className="text-[11px] font-black">3. سحب يدوي حر (بدون تعليق آلي) 🔓</span>
                    <span className="text-[9px] font-bold text-slate-500 italic">تنتقل الأرباح للمحفظة فور التسوية، والموكل يطلب السحب يدوياً في أي وقت.</span>
                  </button>
                </div>
                <div className="mt-2 p-2 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-indigo-100/50 dark:border-indigo-900/30 text-[10px] font-bold text-slate-500 space-y-1">
                  <p className="flex items-start gap-1.5">
                    <span className="text-indigo-500 shrink-0">💡</span>
                    <span>يمكنك "فك تعليق" أي أوردرات يدوياً من جدول الموكلين بضغطة زر واحدة لتنتقل فوراً من "قيد التعليق" إلى "الجاهز للتحويل".</span>
                  </p>
                  {policyPayoutStrategy === 'batch_weekly' && (
                    <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                      <span className="shrink-0">📅</span>
                      <span>في هذا النظام، يتم تأجيل صرف أرباح "الأسبوع الحالي" إلى موعد السحب في "الأسبوع القادم" لضمان تجميع الأرباح.</span>
                    </p>
                  )}
                  {policyPayoutStrategy === 'manual_request' && (
                    <p className="flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="shrink-0">🔓</span>
                      <span>في هذا النظام، تكون كافة الأرباح المسواة متاحة للسحب فوراً، والتحكم يكون عبر "طلب سحب" يرسله الموكل وتوافق عليه الإدارة.</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    تكرار السحب النقدي:
                  </label>
                  <select
                    value={policyPayoutFrequency}
                    onChange={e => setPolicyPayoutFrequency(e.target.value as 'weekly' | 'daily')}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-xs"
                  >
                    <option value="weekly">سحب أسبوعي</option>
                    <option value="daily">سحب يومي</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    يوم التحويل الأسبوعي:
                  </label>
                  <select
                    value={policyWeeklyDay}
                    onChange={e => setPolicyWeeklyDay(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-xs"
                  >
                    <option value={0}>الأحد</option>
                    <option value={1}>الإثنين</option>
                    <option value={2}>الثلاثاء</option>
                    <option value={3}>الأربعاء</option>
                    <option value={4}>الخميس</option>
                    <option value={5}>الجمعة</option>
                    <option value={6}>السبت</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    عمولة السحب الأسبوعي (الإدارة):
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step="0.5"
                      value={policyWeeklyTransferFee}
                      onChange={e => setPolicyWeeklyTransferFee(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-xs"
                    />
                    <select
                      value={policyWeeklyTransferFeeType}
                      onChange={e => setPolicyWeeklyTransferFeeType(e.target.value as 'fixed' | 'percentage')}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-[10px] shrink-0"
                    >
                      <option value="fixed">ج.م</option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    عمولة السحب اليومي (الإدارة):
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step="0.25"
                      value={policyDailyTransferFee}
                      onChange={e => setPolicyDailyTransferFee(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-xs"
                    />
                    <select
                      value={policyDailyTransferFeeType}
                      onChange={e => setPolicyDailyTransferFeeType(e.target.value as 'fixed' | 'percentage')}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-black text-[10px] shrink-0"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">ج.م</option>
                    </select>
                  </div>
                </div>
              </div>

              {policyPayoutStrategy === 'rolling_hold' && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    مدة التعليق بعد التسوية (أيام):
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={policyHoldingDays}
                      onChange={e => setPolicyHoldingDays(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setPolicyHoldingDays(0)}
                      className="px-2 py-2 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-black shrink-0 cursor-pointer"
                    >
                      0 يوم ⚡
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    الحد الأدنى للسحبة (ج.م):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyMinPayout}
                    onChange={e => setPolicyMinPayout(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 mb-1">
                    الحد الأقصى للسحبة (ج.م):
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyMaxPayout}
                    onChange={e => setPolicyMaxPayout(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-black text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 mb-1.5">
                  طريقة تنفيذ التحويل الأسبوعي:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPolicyPayoutMode('admin_confirm')}
                    className={`p-2.5 rounded-xl border text-[11px] font-black cursor-pointer transition-all ${
                      policyPayoutMode === 'admin_confirm'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    تأكيد بضغطة زر من الإدارة
                  </button>
                  <button
                    type="button"
                    onClick={() => setPolicyPayoutMode('auto')}
                    className={`p-2.5 rounded-xl border text-[11px] font-black cursor-pointer transition-all ${
                      policyPayoutMode === 'auto'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    تحويل آلي كامل في الموعد
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveMerchantPayoutPolicy}
                className="flex-1 py-3 rounded-xl bg-[#008060] hover:bg-[#006e52] text-white text-xs font-black cursor-pointer shadow-sm"
              >
                حفظ سياسة التحويل الأسبوعي ✅
              </button>
              <button
                type="button"
                onClick={() => setEditingPayoutPolicyMerchant(null)}
                className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
